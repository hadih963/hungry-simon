// Wires the simulated hardware (device visuals), the firmware logic (game) and the cloud web app together.
import { createDevice } from './visuals/device.js';
import { KEY_NAMES, KEY_COLORS, KEYBOARD, PET_KEYS } from './core/notes.js';
import { audio } from './core/audio.js';
import { SONGS } from './core/songs.js';
import { Game } from './core/game.js';
import { createDisplay } from './core/display.js';
import { createCloud, BROKER } from './core/cloud.js';

const $ = (id) => document.getElementById(id);
const SLEEP_AFTER_MS = 25000;   // no presence + no input → deep sleep
const CAPACITY = 20;            // treats in a full reservoir
const LOW_LEVEL = 3;

const dev = {
  awake: false,
  presence: false,
  treatsLeft: 12,
  treatsToday: 0,
  dailyLimit: 5,
  dispensing: false,
  pendingRemote: 0,
  lastActivity: performance.now(),
  stats: { gamesPlayed: 0, treatsDispensed: 0, mistakes: 0, best: {} },
};

// ------------------------------------------------------------------ hardware + logic
const device = createDevice($('device'), { keyCount: 8, keyNames: KEY_NAMES, keyColors: KEY_COLORS });
const cloud = createCloud($('mqtt'));
$('broker').textContent = BROKER;

const game = new Game({
  playNote(k, ms) { audio.note(k, ms); device.pulseSpeaker(); },
  flash(color, ms) { device.flashAll(color, ms); },
  sound(name) {
    if (name === 'tick') audio.tick(false);
    else if (name === 'tickAccent') audio.tick(true);
    else audio[name]?.();
  },
  reward(reason) { dispense('game', reason); },
  publish(kind, data) {
    if (kind === 'game_start') {
      dev.stats.gamesPlayed++;
      cloud.publish('stats', statsPayload());
    } else if (kind === 'mistake') {
      dev.stats.mistakes++;
    } else if (kind === 'score') {
      const key = `${data.player}|${data.mode}`;
      dev.stats.best[key] = Math.max(dev.stats.best[key] || 0, data.score);
      cloud.publish('score', data);
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
    if (down) setStatus('Asleep. Step in front of the presence sensor to wake Hungry Simon.', true);
    return;
  }
  dev.lastActivity = performance.now();
  if (down) {
    if (held.has(i)) return;
    held.add(i);
    audio.noteOn(i);
    device.pressKey(i, true);
    device.pulseSpeaker();
    game.keyDown(i);
  } else {
    if (!held.delete(i)) return;
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
}

function wake(reason) {
  dev.awake = true;
  dev.lastActivity = performance.now();
  device.setAwake(true);
  audio.wake();
  game.start(game.mode);
  cloud.publish('state', { awake: true, wakeReason: reason, mode: game.mode });
  setStatus(`Awake (${reason}). Mode: ${modeName(game.mode)}.`);
  if (dev.pendingRemote) {
    const n = dev.pendingRemote;
    dev.pendingRemote = 0;
    for (let k = 0; k < n; k++) setTimeout(() => dispense('remote', 'queued remote dispense'), 800 + k * 1300);
  }
}

function sleep(reason) {
  releaseAll();
  game.stop();
  dev.awake = false;
  device.setAwake(false);
  audio.sleep();
  cloud.publish('state', { awake: false, sleepReason: reason });
  setStatus('Deep sleep. Step in front of the presence sensor to wake it.');
}

device.onPresenceToggle(() => setPresence(!dev.presence));
$('presence').addEventListener('click', () => setPresence(!dev.presence));
$('sleep').addEventListener('click', () => { if (dev.awake) { setPresence(false); sleep('button'); } });

// ------------------------------------------------------------------ treats
async function dispense(source, reason) {
  if (dev.dispensing) return;
  if (dev.treatsToday >= dev.dailyLimit) {
    game.say('TREAT LIMIT', '#ffd60a', 1400);
    cloud.publish('treat/blocked', { source, reason: 'daily_limit', limit: dev.dailyLimit });
    setStatus(`No treat: the daily limit of ${dev.dailyLimit} is reached.`, true);
    return;
  }
  if (dev.treatsLeft <= 0) {
    game.say('REFILL ME', '#ff9f1c', 1400);
    cloud.publish('alert/treat_empty', { level: 0 });
    setStatus('No treat: the reservoir is empty (IR level sensor).', true);
    return;
  }
  dev.dispensing = true;
  await device.dispense();
  dev.dispensing = false;
  dev.treatsLeft--;
  dev.treatsToday++;
  dev.stats.treatsDispensed++;
  device.setTreatLevel(dev.treatsLeft / CAPACITY);
  // On the real device the IR sensor at the slide confirms the drop.
  cloud.publish('treat/dispensed', { source, reason, dropConfirmedByIR: true, left: dev.treatsLeft, today: dev.treatsToday });
  if (dev.treatsLeft <= LOW_LEVEL) cloud.publish('alert/treat_low', { left: dev.treatsLeft, capacity: CAPACITY });
  setStatus(`Treat released (${reason}). ${dev.treatsLeft} left in the reservoir.`);
  renderStats();
}

$('refill').addEventListener('click', () => {
  dev.treatsLeft = CAPACITY;
  device.setTreatLevel(1);
  cloud.publish('state', { treatsLeft: CAPACITY, event: 'refilled' });
  setStatus('Reservoir refilled.');
  renderStats();
});

// ------------------------------------------------------------------ modes (physical button)
const modeName = (m) => ({ free: 'Free play', simon: 'Simon says', song: 'Song challenge', pet: 'Pet mode' }[m]);

function setMode(m) {
  releaseAll();
  device.setPetMode(m === 'pet');
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  if (dev.awake) {
    game.start(m);
    dev.lastActivity = performance.now();
    cloud.publish('state', { mode: m });
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

cloud.subscribe('cmd/settings', (s) => {
  if (s.difficulty && s.difficulty !== game.difficulty) {
    game.difficulty = s.difficulty;
    if (dev.awake && game.mode !== 'free' && game.mode !== 'pet') game.start(game.mode);
  }
  if (s.volume !== undefined) { audio.setVolume(s.volume); device.setVolume(s.volume); }
  if (s.dailyTreatLimit !== undefined) dev.dailyLimit = s.dailyTreatLimit;
  renderStats();
});
cloud.subscribe('cmd/song', ({ song }) => {
  game.songId = song;
  setMode('song');
});
cloud.subscribe('cmd/player', ({ player }) => { game.player = player; renderStats(); });
cloud.subscribe('cmd/dispense', () => {
  if (!dev.awake) {
    dev.pendingRemote++;
    setStatus('Remote treat queued: the device picks it up when it wakes (no Wi-Fi in deep sleep).', true);
    return;
  }
  dispense('remote', 'web app');
});

const settings = () => ({
  difficulty: $('difficulty').value,
  volume: Number($('volume').value) / 100,
  dailyTreatLimit: Math.max(0, Math.min(50, Number($('limit').value) || 0)),
});
$('difficulty').addEventListener('change', () => cloud.send('cmd/settings', settings()));
$('limit').addEventListener('change', () => cloud.send('cmd/settings', settings()));
$('volume').addEventListener('input', () => { $('volumeOut').textContent = `${$('volume').value}%`; });
$('volume').addEventListener('change', () => cloud.send('cmd/settings', settings()));
songSel.addEventListener('change', () => cloud.send('cmd/song', { song: songSel.value }));
$('player').addEventListener('change', () => cloud.send('cmd/player', { player: $('player').value }));
$('remoteDispense').addEventListener('click', () => { audio.unlock(); cloud.send('cmd/dispense', { count: 1 }); });

// ------------------------------------------------------------------ stats + status
function statsPayload() {
  return {
    gamesPlayed: dev.stats.gamesPlayed, treatsDispensed: dev.stats.treatsDispensed,
    treatsToday: dev.treatsToday, treatsLeft: dev.treatsLeft, mistakes: dev.stats.mistakes,
  };
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

let statusTimer = 0;
function setStatus(msg, warn = false) {
  const el = $('status');
  el.textContent = msg;
  el.classList.toggle('warn', warn);
  clearTimeout(statusTimer);
}

// ------------------------------------------------------------------ main loop (display refresh ≥ 20 Hz)
const lastLed = new Map();
function frame(now) {
  game.tick(now);

  // LEDs: a held key shows its own colour; otherwise whatever the game wants (next note / Simon playback).
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

  if (dev.awake && !dev.presence && !held.size && now - dev.lastActivity > SLEEP_AFTER_MS) sleep('idle');

  display.render(now);
  requestAnimationFrame(frame);
}

// Debug handle for the team and automated tests: window.hungrySimon.game / .dev / .keyEvent
window.hungrySimon = { game, dev, keyEvent, dispense, setMode, setPresence };

// ------------------------------------------------------------------ boot
device.setAwake(false);
device.setTreatLevel(dev.treatsLeft / CAPACITY);
device.setVolume(0.7);
setStatus('Deep sleep. Click "Step in front" (or the sensor on the device) to wake Hungry Simon.');
renderStats();
setInterval(renderStats, 1000);
cloud.publish('state', { online: true, firmware: 'sim-0.1', awake: false });
requestAnimationFrame(frame);
