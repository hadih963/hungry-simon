// Single source of truth for the hardware: parts, pins and the signal-flow graph.
// Must match the #defines in firmware/hungry_simon/hungry_simon.ino (checked by tools/check-pins.mjs).
// Board: LilyGO T-Display ESP32 (ESP32-D0WDQ6, 240x135 ST7789 TFT built in).

export const PINS = {
  KEYS: [13, 15, 17, 2, 12, 25, 36, 37],  // Do..Do'  (36/37 input-only: external 10k pull-ups; 2/12 strapping pins, OK for keys)
  SPEAKER: 26,     // LEDC PWM → PAM8302 amplifier → 8 Ω speaker
  LEDS: 27,        // WS2812B data for 9 LEDs: 8 under the keys + the treat light (via 74AHCT125, 3.3 V → 5 V)
  I2C_SDA: 21,     // I2C bus → TOF400C-VL53L1X
  I2C_SCL: 22,
  SERVO: 32,       // SG90 control, 50 Hz PWM
  PIR: 33,         // HC-SR501 PIR output, RTC pin → wakes from deep sleep (ext0)
  IR_LEVEL: 39,    // IR obstacle module looking across the reservoir (LOW = treats present)
  IR_DROP: 38,     // IR obstacle module at the slide (LOW pulse = a treat passed)
  BATTERY: 34,     // battery voltage divider (on the T-Display board), ADC1
  BTN_MODE: 0,     // built-in button: next mode
  BTN_OPTION: 35,  // built-in button: difficulty
  TFT: { MOSI: 19, SCLK: 18, CS: 5, DC: 16, RST: 23, BL: 4 }, // built in, used by TFT_eSPI
};

/** Parts of the device. `fn` = firmware trace id to jump to in the code viewer. */
export const PARTS = [
  {
    id: 'esp32', name: 'ESP32 (LilyGO T-Display)', model: 'ESP32-D0WDQ6, 4 MB flash',
    pins: 'all', fn: 'loop',
    what: 'The brain. A dual-core 240 MHz microcontroller with Wi-Fi and Bluetooth. It runs the firmware: it reads every sensor, runs the game, drives the outputs and talks to the cloud.',
    how: 'After power-on, setup() runs once and starts every part. Then loop() runs again and again, thousands of times a second. Each pass scans the keys, polls the sensors, advances the game timers, refreshes the LEDs and screen and services MQTT. Nothing in loop() waits with delay(), so the device never misses a key press.',
    specs: ['240 MHz Xtensa LX6, 2 cores', '520 KB SRAM, 4 MB flash', 'Wi-Fi 802.11 b/g/n', 'Deep sleep ≈ 10 µA (chip only)', '3.3 V logic'],
  },
  {
    id: 'keys', name: '8 piano keys', model: 'Tactile switches under 3D-printed keycaps with springs',
    pins: PINS.KEYS, fn: 'keys.read',
    what: 'Eight spring-loaded keys, Do to high Do. Each one closes a switch.',
    how: 'Each key connects its GPIO to GND when pressed. A pull-up resistor keeps the pin HIGH otherwise, so pressed = LOW. Metal contacts bounce for a few milliseconds, so the firmware only accepts a new state after it has stayed the same for 15 ms (debouncing). The time of each press is stored with millis() so the game can measure your timing against the beat.',
    specs: ['Active LOW, INPUT_PULLUP', 'GPIO 36/37 have no internal pull-up: 10 kΩ external', 'Debounce 15 ms', 'Timing resolution 1 ms'],
  },
  {
    id: 'leds', name: 'RGB LEDs under the keys', model: '8 × WS2812B addressable LEDs',
    pins: [PINS.LEDS], fn: 'leds.show',
    what: 'One colour LED under each key. It shows which key to press next and gives feedback. A 9th LED on the same wire is the treat light.',
    how: 'WS2812B LEDs are daisy-chained. The ESP32 sends 24 bits (green, red, blue) per LED down one data wire with precise timing (800 kHz), and each LED keeps its own colour and passes the rest on. The firmware only sends new data when something changed. A 74AHCT125 converts the 3.3 V data signal to the 5 V the LEDs expect.',
    specs: ['5 V, up to 60 mA each at full white', '1 data pin for all 9', '24-bit colour', 'Library: Adafruit_NeoPixel'],
  },
  {
    id: 'speaker', name: 'Speaker + amplifier', model: 'PAM8302 2.5 W class-D amp + 8 Ω 40 mm speaker',
    pins: [PINS.SPEAKER], fn: 'sound.on',
    what: 'Plays a note for every key, plus the success and error sounds. The plywood frame acts as a sound box.',
    how: 'The ESP32\'s LEDC peripheral generates a square wave at the note\'s frequency (Do = 262 Hz) on GPIO 26. ledcWriteTone() changes the frequency without stopping the CPU. The class-D amplifier boosts that weak signal to drive the speaker cone. The closed plywood box makes the sound louder and warmer.',
    specs: ['Square wave, 8-bit duty', 'C4 262 Hz … C5 523 Hz', 'Volume = PWM duty cycle', 'Amp shutdown pin can cut idle current'],
  },
  {
    id: 'display', name: 'Display', model: '1.14" ST7789 TFT, 240 × 135 (built into the T-Display)',
    pins: Object.values(PINS.TFT), fn: 'display.note',
    what: 'Shows the falling notes, Simon\'s status, the score and the treat counter.',
    how: 'The screen is driven over SPI at 40 MHz. To avoid flicker the firmware draws each frame into an off-screen sprite (a frame buffer in RAM) and pushes it to the screen in one go, every 40 ms (25 Hz, above the 20 Hz the brief requires). A note\'s y position is computed from how many milliseconds remain before it should be played.',
    specs: ['240 × 135 px, 16-bit colour', 'SPI 40 MHz', 'Refresh 25 Hz', 'Library: TFT_eSPI (sprite)'],
  },
  {
    id: 'pir', name: 'Presence sensor', model: 'HC-SR501 PIR motion sensor',
    pins: [PINS.PIR], fn: 'sensors.presence',
    what: 'Notices when someone (or a pet) is in front of the instrument, and wakes it from deep sleep.',
    how: 'A pyroelectric sensor behind a Fresnel lens notices changes in infrared heat as a warm body moves. Its output goes HIGH for a few seconds. GPIO 33 is an RTC pin, so even in deep sleep, when the CPU is off, the ESP32 can be woken by this pin going HIGH (ext0 wake-up). A PIR was chosen over an ultrasonic HC-SR04 because it uses about 50 µA and needs no CPU to trigger, which ultrasonic ranging does.',
    specs: ['≈ 50 µA idle', 'Range up to 7 m, 110° cone', 'Digital HIGH on motion', 'Wake source: esp_sleep_enable_ext0_wakeup'],
  },
  {
    id: 'servo', name: 'Treat dispenser servo', model: 'SG90 micro servo + 3D-printed paddle wheel',
    pins: [PINS.SERVO], fn: 'servo.dispense',
    what: 'Turns a paddle wheel under the treat reservoir, which drops one treat onto the slide.',
    how: 'A servo turns to the angle encoded in a 50 Hz pulse: about 0.5 ms = 0° and 2.4 ms = 180°. To dispense, the firmware moves the wheel 90° and back, which pushes exactly one compartment\'s treat out. The servo sits inside a closed housing so fingers and paws can\'t reach it.',
    specs: ['4.8–6 V, stall ≈ 650 mA', '50 Hz PWM, 0.5–2.4 ms', '≈ 0.1 s / 60°', 'Library: ESP32Servo'],
  },
  {
    id: 'tof', name: 'Hand sensor (time of flight)', model: 'TOF400C-VL53L1X module (ST VL53L1X, I2C)',
    pins: [PINS.I2C_SDA, PINS.I2C_SCL], fn: 'tof.read',
    what: 'Looks down from the treat outlet. When you hold your hand under it, the waiting treat drops into your hand.',
    how: 'The VL53L1X fires invisible 940 nm laser pulses and times how long the light takes to bounce back. Light travels about 30 cm per nanosecond, so the chip measures picosecond delays to get millimetres. It talks to the ESP32 over I2C (two wires, SDA and SCL, address 0x29). At start-up the firmware measures the distance to the empty bowl. Two readings in a row that are at least 5 cm closer mean a hand.',
    specs: ['Range up to 4 m (Short mode ≈ 1.3 m)', '27° field of view', '20 measurements per second (33 ms budget)', 'I2C address 0x29, 400 kHz', '3.3–5 V, ≈ 20 mA while ranging', 'Library: VL53L1X by Pololu'],
  },
  {
    id: 'treatLight', name: 'Treat light', model: 'WS2812B LED at the outlet (9th LED on the chain)',
    pins: [PINS.LEDS], fn: 'light.wait',
    what: 'Tells you a treat is waiting: it pulses orange until you hold your hand under the outlet, then turns green while the treat drops.',
    how: 'It is simply one more WS2812B LED at the end of the key-LED chain: the data wire continues from the last key LED to this one. So it needs no extra GPIO. The firmware computes its colour every loop(): a slow sine wave on the brightness makes it "breathe".',
    specs: ['Same data wire as the key LEDs (GPIO 27)', 'Index 8 in the chain', 'Pulse ≈ 1.6 s'],
  },
  {
    id: 'irLevel', name: 'Treat level sensor', model: 'IR obstacle module (TCRT5000-style) across the reservoir',
    pins: [PINS.IR_LEVEL], fn: 'sensors.level',
    what: 'Detects when the reservoir is almost empty so the web app can send a "refill" alert.',
    how: 'An IR LED shines across the reservoir at the low-level mark and a photodiode measures the reflection. A comparator on the module turns it into a digital signal: LOW = something (treats) is there, HIGH = nothing, so the level is low.',
    specs: ['Digital output, adjustable threshold', '2–30 mm range', 'Input-only GPIO 39'],
  },
  {
    id: 'irDrop', name: 'Treat drop sensor', model: 'IR obstacle module at the slide',
    pins: [PINS.IR_DROP], fn: 'sensors.drop',
    what: 'Confirms a treat really fell, so a jam is noticed and reported.',
    how: 'Same kind of IR module, aimed across the slide. When a treat passes, the output goes LOW for a few milliseconds. The firmware waits up to 1.5 s after turning the wheel for that pulse. No pulse means the dispenser is jammed or empty.',
    specs: ['Digital, active LOW', 'Input-only GPIO 38'],
  },
  {
    id: 'battery', name: 'Battery + charging', model: '1S Li-ion 2000 mAh (protected) + TP4056 USB-C charger',
    pins: [PINS.BATTERY], fn: 'sensors.battery',
    what: 'Powers everything without a cable, and charges over USB-C.',
    how: 'A protected cell (with a built-in BMS against over-charge, over-discharge and short circuit) feeds the board. A boost converter makes 5 V for the LEDs, servo and amplifier, and the T-Display regulates 3.3 V for the ESP32. The ESP32 reads the battery voltage through a divider on GPIO 34. In deep sleep the whole device draws well under 1 mA, so it can wait for days.',
    specs: ['3.7 V nominal, 4.2 V full', 'USB-C 5 V charging, 1 A', 'Low-battery warning < 3.4 V'],
  },
  {
    id: 'buttons', name: 'Mode & option buttons', model: '2 built-in T-Display buttons',
    pins: [PINS.BTN_MODE, PINS.BTN_OPTION], fn: 'buttons.mode',
    what: 'Pick the game mode and difficulty on the device itself.',
    how: 'Same as the keys: pressed = LOW, debounced in firmware. GPIO 0 is also the boot-mode pin, so it is only read after startup.',
    specs: ['GPIO 0: mode', 'GPIO 35: difficulty'],
  },
  {
    id: 'wifi', name: 'Wi-Fi + MQTT over TLS', model: 'ESP32 radio, PubSubClient + WiFiClientSecure',
    pins: 'radio', fn: 'cloud.publish',
    what: 'Sends scores, stats and alerts to the cloud, and receives settings and remote commands from the web app.',
    how: 'The ESP32 joins Wi-Fi, opens an encrypted TLS connection to the MQTT broker on port 8883 and subscribes to its own command topics. Messages are small JSON texts. Publishing never blocks the game. In deep sleep the radio is off, so the broker keeps commands (persistent session, QoS 1) until the device wakes up.',
    specs: ['MQTT 3.1.1, QoS 0/1', 'TLS 1.2, port 8883', 'Topics: hungrysimon/<id>/…'],
  },
];

export const partById = (id) => PARTS.find((p) => p.id === id);

/** Signal-flow graph drawn by src/visuals/flow.js. */
export const FLOW = {
  nodes: [
    { id: 'pir', label: 'PIR sensor', sub: 'GPIO 33', side: 'in' },
    { id: 'keys', label: '8 keys', sub: 'GPIO 13…37', side: 'in' },
    { id: 'buttons', label: 'Buttons', sub: 'GPIO 0 · 35', side: 'in' },
    { id: 'irLevel', label: 'IR level', sub: 'GPIO 39', side: 'in' },
    { id: 'irDrop', label: 'IR drop', sub: 'GPIO 38', side: 'in' },
    { id: 'battery', label: 'Battery', sub: 'GPIO 34 (ADC)', side: 'in' },
    { id: 'tof', label: 'ToF sensor (I2C)', sub: 'GPIO 21 · 22', side: 'in' },
    { id: 'esp32', label: 'ESP32', sub: 'setup() · loop()', side: 'core' },
    { id: 'leds', label: 'RGB LEDs ×9', sub: 'GPIO 27', side: 'out' },
    { id: 'speaker', label: 'Speaker', sub: 'GPIO 26 (PWM)', side: 'out' },
    { id: 'display', label: 'Display', sub: 'SPI', side: 'out' },
    { id: 'servo', label: 'Servo', sub: 'GPIO 32 (PWM)', side: 'out' },
    { id: 'wifi', label: 'MQTT / TLS', sub: 'Wi-Fi', side: 'out' },
    { id: 'webapp', label: 'Web app', sub: 'cloud', side: 'cloud' },
  ],
  edges: [
    { id: 'pir-esp32', from: 'pir', to: 'esp32' },
    { id: 'keys-esp32', from: 'keys', to: 'esp32' },
    { id: 'buttons-esp32', from: 'buttons', to: 'esp32' },
    { id: 'irLevel-esp32', from: 'irLevel', to: 'esp32' },
    { id: 'irDrop-esp32', from: 'irDrop', to: 'esp32' },
    { id: 'battery-esp32', from: 'battery', to: 'esp32' },
    { id: 'tof-esp32', from: 'tof', to: 'esp32' },
    { id: 'esp32-leds', from: 'esp32', to: 'leds' },
    { id: 'esp32-speaker', from: 'esp32', to: 'speaker' },
    { id: 'esp32-display', from: 'esp32', to: 'display' },
    { id: 'esp32-servo', from: 'esp32', to: 'servo' },
    { id: 'esp32-wifi', from: 'esp32', to: 'wifi' },
    { id: 'wifi-webapp', from: 'wifi', to: 'webapp' },
    { id: 'webapp-wifi', from: 'webapp', to: 'wifi' },
    { id: 'wifi-esp32', from: 'wifi', to: 'esp32' },
  ],
};

/** GPIO budget: [gpio, signal, part id, direction, peripheral, note] */
export const PIN_TABLE = [
  [13, 'Key Do', 'keys', 'in', 'GPIO', 'INPUT_PULLUP'],
  [15, 'Key Re', 'keys', 'in', 'GPIO', 'strapping pin: fine with a pull-up'],
  [17, 'Key Mi', 'keys', 'in', 'GPIO', 'INPUT_PULLUP'],
  [2, 'Key Fa', 'keys', 'in', 'GPIO', 'strapping pin: key to GND only, no external pull-up'],
  [12, 'Key Sol', 'keys', 'in', 'GPIO', 'strapping pin: key to GND only, no external pull-up'],
  [25, 'Key La', 'keys', 'in', 'GPIO', 'INPUT_PULLUP'],
  [36, 'Key Si', 'keys', 'in', 'GPIO', 'input-only, external 10 kΩ pull-up'],
  [37, "Key Do'", 'keys', 'in', 'GPIO', 'input-only, external 10 kΩ pull-up'],
  [26, 'Speaker', 'speaker', 'out', 'LEDC PWM', 'square wave to the PAM8302 amp'],
  [27, 'LED data', 'leds', 'out', 'RMT / bit-bang', '9 × WS2812B (8 keys + treat light) via a 74AHCT125'],
  [21, 'I2C SDA', 'tof', 'in/out', 'I2C', 'TOF400C-VL53L1X (module has its own pull-ups)'],
  [22, 'I2C SCL', 'tof', 'out', 'I2C', 'TOF400C-VL53L1X, 400 kHz'],
  [32, 'Servo', 'servo', 'out', 'LEDC PWM 50 Hz', 'SG90 on 5 V, shared GND'],
  [33, 'PIR', 'pir', 'in', 'GPIO + RTC', 'ext0 deep-sleep wake-up'],
  [39, 'IR level', 'irLevel', 'in', 'GPIO', 'input-only; module drives the line'],
  [38, 'IR drop', 'irDrop', 'in', 'GPIO interrupt', 'input-only; FALLING edge'],
  [34, 'Battery', 'battery', 'in', 'ADC1', 'on-board divider ×2'],
  [0, 'MODE button', 'buttons', 'in', 'GPIO', 'boot pin: read only after start-up'],
  [35, 'OPTION button', 'buttons', 'in', 'GPIO', 'on-board button'],
  [19, 'TFT MOSI', 'display', 'out', 'SPI', 'built in'],
  [18, 'TFT SCLK', 'display', 'out', 'SPI', 'built in'],
  [5, 'TFT CS', 'display', 'out', 'SPI', 'built in'],
  [16, 'TFT DC', 'display', 'out', 'GPIO', 'built in'],
  [23, 'TFT RST', 'display', 'out', 'GPIO', 'built in'],
  [4, 'TFT backlight', 'display', 'out', 'GPIO', 'built in'],
];
