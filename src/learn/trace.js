// The trace player: the simulator emits firmware step ids; each step highlights its line of C,
// pulses the signal-flow diagram, outlines the part on the device, explains it, and prints the
// Serial output the real ESP32 would print.

/** id → [flow pulses, device part, explanation] */
export const STEPS = {
  'setup':            [['esp32'], 'esp32', 'setup() runs once after power-on or after waking up. It starts every part, then loop() takes over.'],
  'setup.wake':       [['pir-esp32'], 'pir', 'The ESP32 asks why it woke up. The PIR pin (an RTC pin, "ext0") pulled it out of deep sleep. RAM was wiped; only RTC_DATA_ATTR variables survived.'],
  'setup.cloud':      [['esp32-wifi'], 'wifi', 'Wi-Fi starts connecting in the background. setup() does not wait, so the instrument works even without Wi-Fi.'],
  'setup.game':       [['esp32'], 'esp32', 'The game starts in the current mode.'],
  'loop':             [['esp32'], 'esp32', 'loop() runs again and again, thousands of times per second. It never waits, so no key press is missed.'],
  'loop.keys':        [[], 'keys', 'Each pass of loop() starts by scanning all 8 keys.'],
  'loop.display':     [['esp32-display'], 'display', 'Every 40 ms, loop() redraws the screen.'],
  'loop.sleep':       [[], 'pir', 'loop() checks whether anybody is still around.'],

  'keys.read':        [['keys-esp32'], 'keys', 'digitalRead() samples the key\'s GPIO pin. Pressed = LOW, because the switch connects the pin to GND (the pull-up keeps it HIGH otherwise).'],
  'keys.bounce':      [[], 'keys', 'The raw level changed, so the debounce timer restarts. Metal contacts bounce on and off for a few milliseconds.'],
  'keys.debounce':    [[], 'keys', 'The new level stayed the same for 15 ms, so it counts as a real press, not bounce.'],
  'keys.down':        [[], 'keys', 'onKeyDown() runs. millis() gives the exact time of the press, used to judge timing against the beat.'],
  'keys.sound':       [[], 'speaker', 'Every key plays its own note in every mode, so it is a real instrument.'],
  'keys.game':        [[], 'esp32', 'Now the current game mode decides whether the press was right, and in time.'],
  'keys.up':          [['keys-esp32'], 'keys', 'The key was released: the pin is back to HIGH.'],
  'buttons.mode':     [['buttons-esp32'], 'buttons', 'The MODE button on the board was pressed (also debounced). The next game mode starts.'],

  'sound.on':         [['esp32-speaker'], 'speaker', 'ledcWriteTone() sets the PWM frequency to the note (Do = 262 Hz). The LEDC hardware keeps producing the square wave by itself, so the CPU is free.'],
  'sound.off':        [['esp32-speaker'], 'speaker', 'Duty cycle 0 = no wave = silence.'],
  'sound.note':       [['esp32-speaker'], 'speaker', 'A note with a fixed length. outputsTick() switches it off later, without delay().'],
  'sound.fx':         [['esp32-speaker'], 'speaker', 'A sound effect (success, error, tick) is queued. outputsTick() plays it note by note.'],

  'leds.held':        [[], 'leds', 'A held key glows in its own colour.'],
  'leds.hint':        [[], 'leds', 'The LED under the next key to press lights up, brighter as the note gets closer.'],
  'leds.flash':       [[], 'leds', 'All LEDs flash: green for success, red for a mistake.'],
  'leds.show':        [['esp32-leds'], 'leds', 'strip.show() clocks 8 × 24 colour bits out of GPIO 27 at 800 kHz. It only runs when a colour changed.'],
  'display.note':     [[], 'display', 'Each note\'s height on screen = how many milliseconds are left before it must be played.'],
  'display.push':     [['esp32-display'], 'display', 'The finished frame goes from RAM to the screen over SPI in one go, so it never flickers.'],

  'game.start':       [['esp32'], 'esp32', 'gameStart() resets the score and starts the chosen mode.'],
  'simon.new':        [[], 'esp32', 'Simon picks a random sequence of keys.'],
  'simon.show':       [[], 'display', 'Simon starts showing the sequence. The state machine moves on by itself in gameTick().'],
  'simon.shownote':   [['esp32-speaker', 'esp32-leds'], 'leds', 'gameTick() noticed enough time passed: light the next key of the sequence and play its note.'],
  'simon.yourturn':   [[], 'display', 'All notes shown. Now it is your turn to repeat them.'],
  'simon.correct':    [[], 'keys', 'Right key! On to the next note of the sequence.'],
  'simon.wrong':      [[], 'keys', 'Wrong key. That means the error sound, a red flash, and the sequence restarts.'],
  'simon.grow':       [[], 'esp32', 'Round complete. The sequence gets one note longer.'],
  'simon.goal':       [[], 'esp32', 'The sequence reached its goal length. That is a win!'],
  'song.start':       [['esp32-display'], 'display', 'A song starts. The 4-beat count-in begins.'],
  'song.chart':       [[], 'esp32', 'From the BPM and note lengths, the firmware computes the exact millisecond at which each note must be played.'],
  'song.countin':     [['esp32-speaker'], 'speaker', 'Count-in tick: 4, 3, 2, 1…'],
  'song.timing':      [[], 'esp32', 'Timing check: press time minus the note\'s target time. Negative = early, positive = late.'],
  'song.hit':         [[], 'esp32', 'Inside the timing window: points depend on how close you were and on your combo.'],
  'song.wrong':       [[], 'keys', 'Wrong key, or outside the timing window. The song restarts.'],
  'song.missed':      [[], 'display', 'The note fell past the hit line and nobody played it. That counts as a mistake.'],
  'song.complete':    [[], 'esp32', 'Last note played: the song is complete!'],
  'game.fail':        [['esp32-speaker', 'esp32-leds'], 'speaker', 'Mistake: the error sound plays and the LEDs flash red.'],
  'game.retry':       [[], 'esp32', '1.5 s later, the sequence or song starts again.'],
  'game.win':         [['esp32-speaker', 'esp32-leds'], 'leds', 'Win! A victory jingle plays, the LEDs flash green, and the score is sent to the cloud.'],
  'game.treat':       [['esp32-servo'], 'servo', 'The reward: ask the dispenser for a treat.'],

  'treat.limit':      [[], 'servo', 'Safety check first: is the daily treat limit already reached?'],
  'servo.dispense':   [['esp32-servo'], 'servo', 'wheel.write(90) sends a 50 Hz pulse of ~1.5 ms. The servo turns the paddle wheel 90° and one treat falls.'],
  'servo.back':       [['esp32-servo'], 'servo', 'The wheel goes back to 0°, ready for the next treat.'],
  'sensors.drop':     [['irDrop-esp32'], 'irDrop', 'The falling treat broke the IR beam at the slide. An interrupt caught that short pulse.'],
  'treat.confirmed':  [[], 'irDrop', 'The drop is confirmed, so the treat counts toward today\'s total.'],
  'treat.nodrop':     [[], 'irDrop', 'No pulse within 1.5 s: the reservoir is empty or jammed. An alert goes to the web app.'],

  'sensors.presence': [['pir-esp32'], 'pir', 'The PIR output is read 10 times per second. HIGH = a warm body is moving in front of it.'],
  'sensors.level':    [['irLevel-esp32'], 'irLevel', 'The IR sensor at the reservoir\'s low mark: HIGH = no treat in front of it, so the level is low.'],
  'sensors.battery':  [['battery-esp32'], 'battery', 'Every 10 s the ADC measures the battery voltage through a divider.'],
  'sleep.enter':      [[], 'pir', 'Nobody there for 25 s: save the battery.'],
  'sleep.arm':        [[], 'pir', 'Arm the wake-up: the PIR pin going HIGH will wake the ESP32 (ext0).'],
  'sleep.start':      [['esp32'], 'esp32', 'esp_deep_sleep_start(): CPU, RAM and radio switch off (~10 µA). Waking up starts again at setup().'],

  'cloud.publish':    [['esp32-wifi', 'wifi-webapp'], 'wifi', 'A small JSON message is published to the MQTT broker over TLS, and the web app receives it.'],
  'cloud.loop':       [['esp32-wifi'], 'wifi', 'mqtt.loop() keeps the connection alive and checks for incoming messages.'],
  'cloud.receive':    [['webapp-wifi', 'wifi-esp32'], 'wifi', 'A command arrived from the web app. The JSON payload is parsed with ArduinoJson.'],
  'cloud.settings':   [[], 'esp32', 'New settings are applied: difficulty, volume and the daily treat limit.'],
  'cloud.song':       [[], 'display', 'The web app picked a song, so the song challenge starts.'],
  'cloud.player':     [[], 'esp32', 'Scores will now be saved for this player.'],
  'cloud.dispense':   [['esp32-servo'], 'servo', 'Remote treat. The same safety checks (daily limit) still apply.'],
};

export const SPEEDS = {
  realtime: { label: 'Real time', ms: 45 },
  slow:     { label: 'Slow motion', ms: 650 },
  slower:   { label: 'Very slow', ms: 1600 },
  step:     { label: 'Step by step', ms: Infinity },
};

export function createTracer({ code, flow, device, serialEl, nowEl, counterEl }) {
  const queue = [];
  let speed = 'realtime';
  let follow = true;
  let timer = 0;
  let selectedPart = null;
  let partTimer = 0;

  function printSerial(text) {
    if (!text) return;
    const line = document.createElement('div');
    line.textContent = text;
    serialEl.append(line);
    while (serialEl.children.length > 200) serialEl.firstChild.remove();
    serialEl.scrollTop = serialEl.scrollHeight;
  }

  function play(step) {
    const meta = STEPS[step.id] || [[], null, ''];
    const [pulses, part, why] = meta;
    const ms = Math.min(SPEEDS[speed].ms === Infinity ? 1400 : SPEEDS[speed].ms * 1.6, 1600);
    pulses.forEach((p) => flow.pulse(p, Math.max(450, ms)));
    const where = code.hit(step.id, follow);
    if (part && speed !== 'realtime') {
      device.highlightPart?.(part);
      clearTimeout(partTimer);
      partTimer = setTimeout(() => device.highlightPart?.(selectedPart), Math.max(600, ms));
    }
    printSerial(step.serial);
    nowEl.innerHTML = where
      ? `<span class="now-where"><b>${where.fn ? where.fn + '()' : ''}</b> ${where.file}:${where.line}</span><span class="now-why"></span>`
      : '<span class="now-why"></span>';
    nowEl.querySelector('.now-why').textContent = step.note || why;
    updateCounter();
  }

  function updateCounter() {
    counterEl.textContent = queue.length ? `${queue.length} step${queue.length > 1 ? 's' : ''} waiting` : '';
  }

  function pump() {
    timer = 0;
    if (!queue.length || speed === 'step') { updateCounter(); return; }
    play(queue.shift());
    timer = setTimeout(pump, SPEEDS[speed].ms);
  }

  return {
    /** steps: array of ids or {id, serial, note} */
    emit(...steps) {
      for (const s of steps.flat()) {
        const step = typeof s === 'string' ? { id: s } : s;
        queue.push(step);
      }
      if (speed === 'realtime' && queue.length > 40) {
        // can't keep up: skip ahead but never lose Serial output
        queue.splice(0, queue.length - 20).forEach((s) => printSerial(s.serial));
      }
      updateCounter();
      if (!timer && speed !== 'step') pump();
    },
    serial: printSerial,
    next() { if (queue.length) play(queue.shift()); updateCounter(); },
    setSpeed(s) { speed = s; clearTimeout(timer); timer = 0; if (s !== 'step') pump(); updateCounter(); },
    get speed() { return speed; },
    setFollow(f) { follow = f; },
    setSelectedPart(p) { selectedPart = p; device.highlightPart?.(p); },
    clear() { queue.length = 0; updateCounter(); },
  };
}
