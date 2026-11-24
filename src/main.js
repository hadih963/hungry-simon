// Wires the simulated hardware (device visuals), the game logic, the cloud web app and the
// learning layer (firmware code viewer, trace player, signal flow, parts) together.
import { createDevice } from './visuals/device.js';
import { createFlow } from './visuals/flow.js';
import { KEY_NAMES, KEY_COLORS, KEYBOARD, PET_KEYS } from './core/notes.js';
import { audio } from './core/audio.js';
import { SONGS } from './core/songs.js';
import { Game } from './core/game.js';
import { createDisplay } from './core/display.js';
import { createCloud, BROKER, DEVICE_ID } from './core/cloud.js';
import { FLOW, PINS } from './learn/hardware.js';
import { createCodeView } from './learn/codeview.js';
import { createTracer, SPEEDS } from './learn/trace.js';
import { createPartsPanel, createPinoutPanel } from './learn/panels.js';

const $ = (id) => document.getElementById(id);
const SLEEP_AFTER_MS = 25000;   // no presence + no input → deep sleep (same as the firmware)
const CAPACITY = 20;
const LOW_LEVEL = 3;

const dev = {
  awake: false,
  presence: false,
  treatsLeft: 12,
  treatsToday: 0,
  dailyLimit: 5,
  dispensing: false,
  offer: null,          // treat waiting for a hand: { source, reason, since }
  hand: false,          // a hand is under the chute (ToF sensor)
  pendingRemote: 0,
  bootAt: performance.now(),
  lastActivity: performance.now(),
  stats: { gamesPlayed: 0, treatsDispensed: 0, mistakes: 0, best: {} },
};
const millis = () => Math.round(performance.now() - dev.bootAt);   // like millis(): restarts after deep sleep

// ------------------------------------------------------------------ hardware views
const device = createDevice($('device'), { keyCount: 8, keyNames: KEY_NAMES, keyColors: KEY_COLORS });
const flow = createFlow($('flow'), FLOW);
const cloud = createCloud($('mqtt'));
$('broker').textContent = BROKER;

// ------------------------------------------------------------------ learning layer
const code = await createCodeView({ tabsEl: $('fileTabs'), codeEl: $('code') });
const tracer = createTracer({ code, flow, device, serialEl: $('serial'), nowEl: $('now'), counterEl: $('counter') });
const trace = (...steps) => tracer.emit(...steps);

$('speeds').innerHTML = Object.entries(SPEEDS).map(([k, s]) =>
  `<button data-speed="${k}" class="${k === 'realtime' ? 'on' : ''}">${s.label}</button>`).join('');
$('speeds').addEventListener('click', (e) => {
  const s = e.target.closest('button')?.dataset.speed;
  if (!s) return;
  tracer.setSpeed(s);
  document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('on', b.dataset.speed === s));
  $('nextStep').hidden = s !== 'step';
});
$('nextStep').addEventListener('click', () => tracer.next());
$('follow').addEventListener('change', (e) => tracer.setFollow(e.target.checked));
$('clearSerial').addEventListener('click', () => { $('serial').innerHTML = ''; });

const partsPanel = createPartsPanel($('partsPanel'), {
  onSelect: (id) => selectPart(id),
  onShowCode: (id) => { trace({ id }); if (tracer.speed === 'step') tracer.next(); },
});
const pinoutPanel = createPinoutPanel($('pinoutPanel'), { onSelect: (id) => selectPart(id, false) });

// part ids vs. diagram node ids: a few parts share a node in the signal-flow diagram
const FLOW_NODE = { power: 'battery', amp: 'speaker', treatLight: 'leds' };
const PART_OF_NODE = { webapp: 'wifi', battery: 'power' };

function selectPart(id, openParts = true) {
  id = PART_OF_NODE[id] || id;
  partsPanel.show(id);
  pinoutPanel.show(id);
  flow.select(FLOW_NODE[id] || id);
  tracer.setSelectedPart(id);
  if (openParts) {
    showTab('parts');
    const info = document.querySelector('.info');
    const r = info.getBoundingClientRect();
    if (r.top > innerHeight - 80) info.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
device.onPartClick?.((id) => selectPart(id));
flow.onSelect((id) => selectPart(id));

function showTab(name) {
  document.querySelectorAll('#infoTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
}
$('infoTabs').addEventListener('click', (e) => { const t = e.target.closest('button')?.dataset.tab; if (t) showTab(t); });

// ------------------------------------------------------------------ cloud publish (device → web app)
function publish(topic, payload) {
  cloud.publish(topic, payload);
  trace({ id: 'cloud.publish', serial: `[mqtt] publish hungrysimon/${DEVICE_ID}/${topic} ${JSON.stringify(payload)}` });
}

// ------------------------------------------------------------------ game
const game = new Game({
  playNote(k, ms) { audio.note(k, ms); device.pulseSpeaker(); },
  flash(color, ms) { device.flashAll(color, ms); },
  sound(name) {
    if (name === 'tick') audio.tick(false);
    else if (name === 'tickAccent') audio.tick(true);
    else audio[name]?.();
  },
  reward(reason) { trace('game.treat'); dispense('game', reason); },
  trace,
  publish(kind, data) {
    if (kind === 'game_start') {
      dev.stats.gamesPlayed++;
      publish('stats', statsPayload());
    } else if (kind === 'mistake') {
      dev.stats.mistakes++;
    } else if (kind === 'score') {
      const key = `${data.player}|${data.mode}`;
      dev.stats.best[key] = Math.max(dev.stats.best[key] || 0, data.score);
      publish('score', data);
    }
    renderStats();
  },
});

const display = createDisplay(device.getDisplayCanvas(), game, () => dev);

// ------------------------------------------------------------------ keys
const held = new Set();

function keyEvent(i, down) {
  if (game.mode === 'pet') i = i - (i % 2);
  if (!dev.awake) {
    if (down) setStatus('Asleep: the CPU is off, so keys do nothing. Step in front of the PIR sensor to wake it.', true);
    return;
  }
  dev.lastActivity = performance.now();
  if (down) {
    if (held.has(i)) return;
    held.add(i);
    trace('loop.keys', 'keys.read', 'keys.bounce', 'keys.debounce',
      { id: 'keys.down', serial: `[key] ${KEY_NAMES[i]} down (GPIO ${PINS.KEYS[i]}) t=${millis()} ms` },
      'keys.sound', 'sound.on', 'keys.game');
    audio.noteOn(i);
    device.pressKey(i, true);
    device.pulseSpeaker();
    game.keyDown(i);
    trace('leds.held', 'leds.show', 'display.push');
  } else {
    if (!held.delete(i)) return;
    trace('keys.read', 'keys.debounce', 'keys.up', 'sound.off', 'leds.show');
    audio.noteOff(i);
    device.pressKey(i, false);
    game.keyUp(i);
  }
}

function releaseAll() {
  [...held].forEach((i) => keyEvent(i, false));
}

device.onKeyInput(keyEvent);

window.addEventListener('keydown', (e) => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('input, select, textarea')) return;
  const i = KEYBOARD.indexOf(e.key.toLowerCase());
  if (i >= 0) { e.preventDefault(); keyEvent(i, true); }
  else if (e.key.toLowerCase() === 'h') setHand(!dev.hand);
});
window.addEventListener('keyup', (e) => {
  const i = KEYBOARD.indexOf(e.key.toLowerCase());
  if (i >= 0) keyEvent(i, false);
});
window.addEventListener('blur', releaseAll);

// ------------------------------------------------------------------ presence / sleep
function setPresence(p) {
  audio.unlock();
  dev.presence = p;
  device.setPresence(p);
  $('presence').classList.toggle('on', p);
  $('presence').textContent = p ? '🚶 Walk away' : '🧍 Step in front';
  dev.lastActivity = performance.now();
  if (p && !dev.awake) wake('presence');
  else if (dev.awake) trace({ id: 'sensors.presence', serial: `[pir] presence: ${p ? 'yes' : 'no'}` });
}

function wake(reason) {
  dev.awake = true;
  dev.bootAt = performance.now();
  dev.lastActivity = performance.now();
  device.setAwake(true);
  audio.wake();
  trace(
    { id: 'setup', serial: '[boot] Hungry Simon firmware v0.1' },
    { id: 'setup.wake', serial: '[boot] woken from deep sleep by the PIR sensor (ext0)' },
    'setup.cloud',
    { id: 'tof.init', serial: `[tof] ready, bowl at ${TOF_BOWL_MM} mm (centre zone)` },
    { id: 'cloud.connect', serial: '[mqtt] connected over TLS, subscribed to cmd/#',
      note: 'Once Wi-Fi is up, loop() connects to the MQTT broker over TLS (port 8883) and subscribes to its command topics. The "last will" makes the broker announce "offline" if the device disappears.' },
    'setup.game',
  );
  game.start(game.mode);
  trace('loop');
  publish('state', { awake: true, wakeReason: reason, mode: game.mode });
  setStatus(`Awake (${reason}). Mode: ${modeName(game.mode)}.`);
  if (dev.pendingRemote) {
    const n = dev.pendingRemote;
    dev.pendingRemote = 0;
    for (let k = 0; k < n; k++) {
      setTimeout(() => {
        trace('cloud.loop', { id: 'cloud.receive', serial: '[mqtt] received cmd/dispense (kept by the broker while asleep)' }, 'cloud.dispense');
        dispense('remote', 'queued remote dispense');
      }, 900 + k * 1400);
    }
  }
}

function sleep(reason) {
  releaseAll();
  game.stop();
  if (dev.offer) { dev.offer = null; device.setTreatLight?.(null); }
  trace('loop.sleep', { id: 'sleep.enter', serial: '[sleep] nobody here -> deep sleep' });
  publish('state', { awake: false, sleepReason: reason });
  trace('sleep.arm', 'sleep.start');
  dev.awake = false;
  device.setAwake(false);
  audio.sleep();
  setStatus('Deep sleep. Step in front of the PIR sensor to wake it.');
}

device.onPresenceToggle(() => setPresence(!dev.presence));
$('presence').addEventListener('click', () => setPresence(!dev.presence));
$('sleep').addEventListener('click', () => { if (dev.awake) { setPresence(false); sleep('button'); } });

// ------------------------------------------------------------------ treats
// A win or the web app OFFERS a treat; it only drops when the ToF sensor sees a hand under the chute.
const OFFER_TIMEOUT_MS = 60000;
const TOF_BOWL_MM = 180;

function dispense(source, reason) {
  if (dev.dispensing || dev.offer) return;
  trace('treat.limit');
  if (dev.treatsToday >= dev.dailyLimit) {
    game.say('TREAT LIMIT', '#ffd60a', 1400);
    tracer.serial(`[treat] blocked: daily limit ${dev.dailyLimit} reached`);
    publish('treat/blocked', { source, reason: 'daily_limit', limit: dev.dailyLimit });
    setStatus(`No treat: the daily limit of ${dev.dailyLimit} is reached.`, true);
    return;
  }
  dev.offer = { source, reason, since: performance.now() };
  device.setTreatLight?.('#ff8a1a', 'pulse');
  trace({ id: 'treat.offer', serial: `[treat] ready (${reason}): hold your hand under the chute` }, 'light.wait', 'display.offer');
  setStatus('Treat ready! Hold your hand under the chute: click below it, use the ✋ button, or press H.');
  if (dev.hand) setTimeout(() => takeOffer(), 150);   // a hand was already waiting there
}

// ToF sensor: a hand appears or disappears under the chute
function setHand(p) {
  if (p === dev.hand) return;
  audio.unlock();
  dev.hand = p;
  device.setHand?.(p);
  $('hand').classList.toggle('on', p);
  $('hand').textContent = p ? '✋ Take hand away' : '✋ Hand under chute';
  const mm = p ? 50 + Math.round(Math.random() * 25) : TOF_BOWL_MM + Math.round(Math.random() * 4 - 2);
  device.setTofReading?.(mm, p);
  if (!dev.awake) return;                     // asleep: the sensor isn't powered
  dev.lastActivity = performance.now();
  trace('tof.read', { id: 'tof.hand', serial: p ? `[tof] hand under the chute (${mm} mm, 9 zones)` : `[tof] hand gone (${mm} mm, 0 zones)` });
  if (p) takeOffer();
}

function takeOffer() {
  if (!dev.offer || !dev.hand || dev.dispensing) return;
  const { source, reason } = dev.offer;
  dev.offer = null;
  trace({ id: 'treat.hand', serial: '[treat] hand detected -> drop' });
  drop(source, reason);
}

async function drop(source, reason) {
  if (dev.treatsLeft <= 0) {
    device.setTreatLight?.(null);
    game.say('REFILL ME', '#ff9f1c', 1400);
    trace('servo.dispense', 'servo.back', { id: 'treat.nodrop', serial: '[treat] no drop seen: reservoir empty or jammed' });
    publish('alert/treat_empty', { confirmed: false });
    setStatus('No treat fell: the reservoir is empty (the IR drop sensor saw nothing).', true);
    return;
  }
  dev.dispensing = true;
  device.setTreatLight?.('#3ddc84', 'solid');
  trace('servo.dispense', 'light.drop');
  const landed = device.dispense({ intoHand: dev.hand });
  setTimeout(() => trace('servo.back'), 350);
  await landed;
  dev.dispensing = false;
  device.setTreatLight?.(null);
  dev.treatsLeft--;
  dev.treatsToday++;
  dev.stats.treatsDispensed++;
  device.setTreatLevel(dev.treatsLeft / CAPACITY);
  trace('sensors.drop', { id: 'treat.confirmed', serial: `[treat] drop confirmed by IR, ${dev.treatsToday} today` });
  publish('treat/dispensed', { source, reason, intoHand: dev.hand, dropConfirmedByIR: true, today: dev.treatsToday });
  if (dev.treatsLeft <= LOW_LEVEL) {
    trace({ id: 'sensors.level', serial: '[treat] level LOW -> alert' });
    publish('alert/treat_low', { left: dev.treatsLeft, capacity: CAPACITY });
  }
  setStatus(`Treat released into ${dev.hand ? 'your hand' : 'the bowl'}. ${dev.treatsLeft} left in the reservoir.`);
  renderStats();
}

function expireOffer() {
  dev.offer = null;
  device.setTreatLight?.(null);
  trace({ id: 'treat.expired', serial: '[treat] offer expired' });
  publish('treat/expired', {});
  setStatus('The treat offer expired: nobody held a hand under the chute for 60 s.', true);
}

device.onHandToggle?.(() => setHand(!dev.hand));
$('hand').addEventListener('click', () => setHand(!dev.hand));

$('refill').addEventListener('click', () => {
  dev.treatsLeft = CAPACITY;
  device.setTreatLevel(1);
  if (dev.awake) trace({ id: 'sensors.level', serial: '[treat] level OK' });
  setStatus('Reservoir refilled.');
  renderStats();
});

// ------------------------------------------------------------------ modes (MODE button on the board)
const modeName = (m) => ({ free: 'Free play', simon: 'Simon says', song: 'Song challenge', pet: 'Pet mode' }[m]);

function setMode(m, viaButton = true) {
  releaseAll();
  device.setPetMode(m === 'pet');
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  if (dev.awake) {
    if (viaButton) trace('loop.keys', { id: 'buttons.mode', serial: `[button] mode -> ${m}` });
    game.start(m);
    dev.lastActivity = performance.now();
    setStatus(`Mode: ${modeName(m)}.`);
  } else {
    game.mode = m;
    setStatus(`Mode set to ${modeName(m)}. Wake the device to play.`);
  }
}
document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ------------------------------------------------------------------ cloud web app → device
const songSel = $('song');
SONGS.forEach((s) => songSel.add(new Option(s.title, s.id)));

function received(cmd) {
  trace('cloud.loop', { id: 'cloud.receive', serial: `[mqtt] received ${cmd}` });
}

cloud.subscribe('cmd/settings', (s) => {
  if (!dev.awake) return;
  received('cmd/settings');
  if (s.difficulty && s.difficulty !== game.difficulty) {
    game.difficulty = s.difficulty;
    if (game.mode === 'simon' || game.mode === 'song') game.start(game.mode);
  }
  if (s.volume !== undefined) { audio.setVolume(s.volume); device.setVolume(s.volume); }
  if (s.dailyTreatLimit !== undefined) dev.dailyLimit = s.dailyTreatLimit;
  const d = { easy: 0, normal: 1, hard: 2 }[game.difficulty];
  trace({ id: 'cloud.settings', serial: `[settings] difficulty=${d} volume=${Math.round(audio.volume * 100)}% limit=${dev.dailyLimit}` });
  renderStats();
});
cloud.subscribe('cmd/song', ({ song }) => {
  if (!dev.awake) return;
  received('cmd/song');
  trace('cloud.song');
  game.songId = song;
  setMode('song', false);
});
cloud.subscribe('cmd/player', ({ player }) => {
  game.player = player;
  if (dev.awake) { received('cmd/player'); trace('cloud.player'); }
  renderStats();
});
cloud.subscribe('cmd/dispense', () => {
  if (!dev.awake) {
    dev.pendingRemote++;
    setStatus('Remote treat queued: the radio is off in deep sleep, so the broker keeps the command (QoS 1) until the device wakes.', true);
    return;
  }
  received('cmd/dispense');
  trace('cloud.dispense');
  dispense('remote', 'web app');
});

// Settings changed while asleep are retained by the broker and applied on wake; here we simply apply them.
const settings = () => ({
  difficulty: $('difficulty').value,
  volume: Number($('volume').value) / 100,
  dailyTreatLimit: Math.max(0, Math.min(50, Number($('limit').value) || 0)),
});
function sendSettings() {
  const s = settings();
  if (!dev.awake) { game.difficulty = s.difficulty; audio.setVolume(s.volume); dev.dailyLimit = s.dailyTreatLimit; renderStats(); }
  cloud.send('cmd/settings', s);
}
$('difficulty').addEventListener('change', sendSettings);
$('limit').addEventListener('change', sendSettings);
$('volume').addEventListener('input', () => { $('volumeOut').textContent = `${$('volume').value}%`; });
$('volume').addEventListener('change', sendSettings);
songSel.addEventListener('change', () => { game.songId = songSel.value; cloud.send('cmd/song', { song: songSel.value }); });
$('player').addEventListener('change', () => cloud.send('cmd/player', { player: $('player').value }));
$('remoteDispense').addEventListener('click', () => { audio.unlock(); cloud.send('cmd/dispense', { count: 1 }); });

// ------------------------------------------------------------------ stats + status
function statsPayload() {
  return { gamesPlayed: dev.stats.gamesPlayed, treatsToday: dev.treatsToday, treatsLeft: dev.treatsLeft };
}

function renderStats() {
  const low = dev.treatsLeft <= LOW_LEVEL;
  $('stats').innerHTML = `
    <div class="stat"><b>${dev.stats.gamesPlayed}</b><span>games played</span></div>
    <div class="stat"><b>${dev.treatsToday}/${dev.dailyLimit}</b><span>treats today</span></div>
    <div class="stat ${low ? 'alert' : ''}"><b>${dev.treatsLeft}/${CAPACITY}</b><span>${low ? 'treat level LOW' : 'in reservoir'}</span>
      <div class="meter"><i style="width:${(dev.treatsLeft / CAPACITY) * 100}%"></i></div></div>
    <div class="stat"><b>${game.avgOffsetMs ?? '–'}${game.avgOffsetMs != null ? ' ms' : ''}</b><span>avg timing error (song)</span></div>`;
  const players = ['Player 1', 'Player 2', 'Guest', 'Pet'];
  $('best').innerHTML = players.map((p) => `<tr><td>${p}${p === game.player ? ' ◂' : ''}</td>${
    ['simon', 'song', 'pet'].map((m) => `<td>${dev.stats.best[`${p}|${m}`] ?? '–'}</td>`).join('')}</tr>`).join('');
}

function setStatus(msg, warn = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('warn', warn);
}

// ------------------------------------------------------------------ main loop (like loop() on the ESP32)
const lastLed = new Map();
function frame(now) {
  game.tick(now);

  const keys = game.mode === 'pet' ? PET_KEYS : [0, 1, 2, 3, 4, 5, 6, 7];
  for (const k of keys) {
    let want = null;
    if (dev.awake) want = held.has(k) ? [KEY_COLORS[k], 1] : game.ledFor(k, now);
    const sig = want ? `${want[0]}|${want[1].toFixed(2)}` : 'off';
    if (lastLed.get(k) !== sig) {
      lastLed.set(k, sig);
      device.setKeyLed(k, want ? want[0] : null, want ? want[1] : 0);
    }
  }

  if (dev.offer && now - dev.offer.since > OFFER_TIMEOUT_MS) expireOffer();
  if (dev.awake && !dev.presence && !dev.offer && !held.size && tracer.speed === 'realtime' && now - dev.lastActivity > SLEEP_AFTER_MS) sleep('idle');

  display.render(now);
  requestAnimationFrame(frame);
}

// Debug handle for the team and automated tests
window.hungrySimon = { game, dev, keyEvent, dispense, setHand, setMode, setPresence, selectPart, tracer, code };

// ------------------------------------------------------------------ boot
device.setAwake(false);
device.setTreatLevel(dev.treatsLeft / CAPACITY);
device.setVolume(0.7);
device.setTofReading?.(TOF_BOWL_MM, false);
setStatus('Deep sleep. Click "Step in front" (or the PIR sensor on the device) to wake Hungry Simon.');
tracer.serial('-- ESP32 is in deep sleep (≈10 µA). The PIR sensor will wake it. --');
renderStats();
setInterval(renderStats, 1000);
requestAnimationFrame(frame);
