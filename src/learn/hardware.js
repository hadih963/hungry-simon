// Single source of truth for the hardware: parts, pins and the signal-flow graph.
// Matches docs/components.md and the #defines in firmware/hungry_simon/hungry_simon.ino
// (checked by tools/check-pins.mjs). Board: DOIT ESP32 DevKit V1 (ESP32-WROOM-32).

export const PINS = {
  KEYS: [13, 14, 27, 32, 33, 15, 2, 12], // Do..Do'  lever microswitches to GND (2, 12, 15 are boot straps: OK for keys)
  LEDS: 16,        // WS2812 data for 9 sticks × 8 LEDs (via 74AHCT125 + 330 Ω)
  SERVO: 17,       // MG90S, 50 Hz PWM
  I2S_BCLK: 26,    // MAX98357A bit clock
  I2S_LRC: 25,     // MAX98357A word clock
  I2S_DOUT: 22,    // MAX98357A data
  I2C_SDA: 21,     // VL53L7CX
  I2C_SCL: 19,
  PIR: 36,         // HC-SR501, RTC pin → deep-sleep wake (ext0)
  IR_LEVEL: 39,    // IR module across the reservoir
  IR_DROP: 35,     // IR module at the chute (interrupt)
  BATTERY: 34,     // 2S pack via 100k/33k divider, ADC1
  BTN_MODE: 0,     // BOOT button on the DevKit
  TFT: { SCK: 18, MOSI: 23, CS: 5, DC: 4 }, // ILI9341 (RST → EN, backlight → 3.3 V)
};

/** Parts of the device. `fn` = firmware trace id to jump to in the code viewer. */
export const PARTS = [
  {
    id: 'esp32', name: 'ESP32 DevKit V1', model: 'DOIT ESP32 DevKit V1 (ESP32-WROOM-32, 4 MB flash, Wi-Fi + Bluetooth)',
    pins: 'all', fn: 'loop',
    what: 'The brain. A dual-core 240 MHz microcontroller with Wi-Fi. It runs the games, keeps the sound clips in its flash memory and talks to the cloud.',
    how: 'After power-on, setup() runs once and starts every part. Then loop() runs again and again on core 1: it scans the keys, polls the sensors, moves the game forward and services MQTT, without ever waiting. Two background tasks run on core 0: one streams audio to the amplifier, the other redraws the screen. That way a slow job never delays a key press.',
    specs: ['2 × 240 MHz Xtensa LX6 cores', '520 KB RAM, 4 MB flash (≈1.3 MB for sound clips)', 'Wi-Fi 802.11 b/g/n', 'Powered with 5 V on VIN; 3.3 V logic', 'All 24 usable GPIOs are assigned'],
  },
  {
    id: 'keys', name: '8 piano keys', model: 'Hinged keys on KW11-3Z lever microswitches (8 + 2 spare)',
    pins: PINS.KEYS, fn: 'keys.read',
    what: 'Eight hinged keys, Do to high Do. Pressing a key pushes the lever of a microswitch underneath.',
    how: 'Each microswitch connects its GPIO to GND when pressed (COM to GND, NO to the pin). The internal pull-up keeps the pin HIGH otherwise, so pressed = LOW. The metal contacts bounce for a few milliseconds, so the firmware only accepts a new state after it has stayed the same for 15 ms (debouncing). The time of each press is stored with millis() so the game can measure your timing against the beat.',
    specs: ['Active LOW, INPUT_PULLUP', 'Debounce 15 ms', 'Timing resolution 1 ms', 'GPIO 2, 12, 15 are boot pins: no external pull-ups'],
  },
  {
    id: 'leds', name: 'Key lighting (LED sticks)', model: '8 × WS2812 5050 RGB stick (8 LEDs each, 5 V)',
    pins: [PINS.LEDS], fn: 'leds.show',
    what: 'A stick of 8 colour LEDs under each key. It shows which key to press next and flashes green or red for feedback.',
    how: 'WS2812 LEDs are daisy-chained: 9 sticks × 8 = 72 LEDs on ONE data wire. The ESP32 sends 24 colour bits per LED at 800 kHz; each LED keeps its own 24 bits and passes the rest on. The firmware gives all 8 LEDs of a stick the same colour, and only sends new data (~2.2 ms) when something changed. A 74AHCT125 turns the 3.3 V data signal into the 5 V the LEDs expect. Brightness is capped at 50 % so 72 LEDs can never draw more than ~2.2 A.',
    specs: ['72 LEDs in use (+1 spare stick)', '60 mA per LED at full white', '1 data pin (GPIO 16)', 'Brightness cap 50 %', 'Library: Adafruit_NeoPixel'],
  },
  {
    id: 'treatLight', name: 'Chute light', model: 'WS2812 stick (8 LEDs) at the chute, 9th stick on the chain',
    pins: [PINS.LEDS], fn: 'light.wait',
    what: 'Tells you a treat is waiting: it pulses orange until a hand or paw is under the chute, then turns green while the treat drops.',
    how: 'It is simply the 9th stick at the end of the LED chain, so it needs no extra GPIO. Its colour is computed every loop(): a slow sine wave on the brightness makes it "breathe".',
    specs: ['LEDs 64–71 of the chain', 'Pulse ≈ 1.6 s'],
  },
  {
    id: 'display', name: 'Display', model: '2.8" ILI9341 TFT, 320 × 240, SPI',
    pins: Object.values(PINS.TFT), fn: 'display.note',
    what: 'Shows the falling notes, Simon\'s status, menus, the score and the treat counter.',
    how: 'The screen is driven over SPI at 40 MHz. Each frame is drawn into a sprite (a frame buffer in RAM, 8-bit colour = 77 KB) and then sent in one go, so it never flickers. Sending a full frame takes about 31 ms, which is why the display has its own task on core 0. A note\'s height = how many milliseconds are left before it must be played.',
    specs: ['320 × 240, 2.8"', 'SPI 40 MHz', '25 frames per second', 'Library: TFT_eSPI (User_Setup_HungrySimon.h)'],
  },
  {
    id: 'amp', name: 'Audio amplifier', model: 'MAX98357A I2S class-D amplifier, 3 W',
    pins: [PINS.I2S_BCLK, PINS.I2S_LRC, PINS.I2S_DOUT], fn: 'sound.on',
    what: 'Turns the digital sound from the ESP32 into enough power for the speaker. It plays recorded clips with about 10–20 ms delay.',
    how: 'I2S is a 3-wire digital audio bus: a bit clock (BCLK), a word clock that marks each sample (LRC) and the data (DIN). The ESP32 streams 16 000 samples per second, 16 bits each. The MAX98357A has its own DAC and class-D amplifier: it switches the speaker on and off very fast, and the speaker smooths that into sound. That wastes very little energy. The clips are WAV files stored in the ESP32\'s flash (LittleFS).',
    specs: ['3.2 W into 4 Ω at 5 V', 'I2S, 16 kHz / 16-bit mono', 'Gain 9 dB (GAIN pin open)', 'Library: ESP_I2S (in the ESP32 core)'],
  },
  {
    id: 'speaker', name: 'Speaker', model: '4 Ω, 3 W, 40 mm full-range',
    pins: 'via amp', fn: 'sound.on',
    what: 'Makes the sound. The plywood frame acts as the speaker box.',
    how: 'A coil on the speaker cone sits in a magnet\'s field. The amplifier\'s current through the coil pushes the cone back and forth, which moves air: sound. A closed box stops the front and back waves from cancelling each other, so the bass gets louder. A passive radiator salvaged from a Bluetooth speaker can add even more bass.',
    specs: ['4 Ω, 3 W', '40 mm', 'Driven by the MAX98357A'],
  },
  {
    id: 'servo', name: 'Treat motor', model: 'MG90S metal-gear micro servo + treat wheel',
    pins: [PINS.SERVO], fn: 'servo.dispense',
    what: 'Turns the treat wheel one slot per win, dropping one treat into the chute.',
    how: 'A servo turns to the angle encoded in a 50 Hz pulse: about 0.5 ms = 0° and 2.4 ms = 180°. To dispense, the firmware moves the wheel 90° and back, which pushes exactly one slot\'s treat out. Metal gears survive a jammed treat better than plastic ones. It gets 5 V straight from the buck converter, with a 470 µF capacitor, because starting up it can draw ~0.8 A.',
    specs: ['4.8–6 V, stall ≈ 0.8 A', '50 Hz PWM, 0.5–2.4 ms', 'Metal gears', 'Library: ESP32Servo'],
  },
  {
    id: 'tof', name: 'Hand / paw sensor', model: 'VL53L7CX 8×8 multizone time-of-flight sensor (I2C)',
    pins: [PINS.I2C_SDA, PINS.I2C_SCL], fn: 'tof.read',
    what: 'Looks down from the chute. When a hand or a paw is under it, the waiting treat drops.',
    how: 'The VL53L7CX fires invisible 940 nm laser light and times how long it takes to bounce back (time of flight), separately for 8 × 8 = 64 zones in a 60° × 60° view. At start-up it uploads its own ranging firmware (~84 KB, 1–2 s) and the ESP32 learns the distance of every zone to the empty bowl. A hand counts when at least 4 of the 16 centre zones are 5 cm closer, two frames in a row, so a single falling treat never triggers it.',
    specs: ['64 zones, 60° × 60°', 'Up to 3.5 m', '15 frames per second', 'I2C 400 kHz, address 0x29', 'Library: STM32duino VL53L7CX'],
  },
  {
    id: 'pir', name: 'Presence sensor', model: 'HC-SR501 PIR (not on the component list yet: required by the brief)',
    pins: [PINS.PIR], fn: 'sensors.presence',
    what: 'Notices when someone (or a pet) is in front of the instrument, and wakes it from deep sleep.',
    how: 'A pyroelectric sensor behind a Fresnel lens notices changes in infrared heat as a warm body moves. Its output goes HIGH for a few seconds. GPIO 36 is an RTC pin, so even in deep sleep, with the CPU off, the ESP32 is woken when it goes HIGH (ext0 wake-up).',
    specs: ['≈ 50 µA', 'Range up to 7 m, 110°', 'Digital HIGH on motion'],
  },
  {
    id: 'irLevel', name: 'Treat level sensor', model: 'IR obstacle module (not on the component list yet: required by the brief)',
    pins: [PINS.IR_LEVEL], fn: 'sensors.level',
    what: 'Detects when the reservoir is almost empty, so the web app can send a "refill" alert.',
    how: 'An IR LED shines across the reservoir at the low mark and a photodiode measures the reflection. A comparator on the module turns that into a digital signal: LOW = treats there, HIGH = level low.',
    specs: ['Digital output', 'Input-only GPIO 39'],
  },
  {
    id: 'irDrop', name: 'Treat drop sensor', model: 'IR obstacle module at the chute (not on the component list yet)',
    pins: [PINS.IR_DROP], fn: 'sensors.drop',
    what: 'Confirms a treat really fell, so a jam or an empty reservoir is noticed.',
    how: 'The same kind of IR module, aimed across the chute. A passing treat makes the output go LOW for a few milliseconds, too short to poll, so an interrupt catches it. No pulse within 1.5 s means a jam or an empty reservoir.',
    specs: ['Digital, active LOW', 'Interrupt on GPIO 35'],
  },
  {
    id: 'power', name: 'Power', model: '2 × 18650 (2S, protected, e.g. Samsung 30Q) + USB-C 2S charger/BMS + 5 V 5 A buck + switch',
    pins: [PINS.BATTERY], fn: 'sensors.battery',
    what: 'Runs everything from two Li-ion cells, about 4 hours of play, and charges over USB-C.',
    how: 'Two cells in series make 7.4 V (8.4 V full, ~6 V empty). The charger board raises USB-C 5 V to charge them and its BMS protects against over-charge, over-discharge and short circuits. A buck converter steps 7.4 V down to a steady 5 V (up to 5 A) for the LEDs, servo, amplifier and the DevKit\'s VIN. The ESP32 measures the pack through a 100k/33k divider: 8.4 V becomes 2.08 V, safe for the ADC.',
    specs: ['2S, 7.4 V, ≈ 22 Wh', 'Peak ≈ 4.1 A at 5 V (LEDs capped at 50 %)', 'Typical ≈ 0.9 A → ≈ 4 h', 'Low warning < 6.8 V'],
  },
  {
    id: 'buttons', name: 'BOOT button', model: 'The BOOT button on the DevKit V1',
    pins: [PINS.BTN_MODE], fn: 'buttons.mode',
    what: 'Short press: next game mode. Long press (0.8 s): next difficulty.',
    how: 'Like the keys: pressed = LOW, debounced in firmware. The firmware times how long it was held. GPIO 0 is also the "enter flash mode" pin, which is why it is only read after start-up.',
    specs: ['GPIO 0', 'Long press ≥ 800 ms'],
  },
  {
    id: 'wifi', name: 'Wi-Fi + MQTT over TLS', model: 'ESP32 radio, PubSubClient + WiFiClientSecure',
    pins: 'radio', fn: 'cloud.publish',
    what: 'Sends scores, stats and alerts to the cloud, and receives settings and remote commands from the web app.',
    how: 'The ESP32 joins Wi-Fi, opens an encrypted TLS connection to the MQTT broker on port 8883 and subscribes to its own command topics. Messages are small JSON texts. In deep sleep the radio is off, so the broker keeps commands (persistent session, QoS 1) until the device wakes up.',
    specs: ['MQTT 3.1.1, QoS 0/1', 'TLS 1.2, port 8883', 'Topics: hungrysimon/<id>/…'],
  },
];

const ALIASES = { battery: 'power' };
export const partById = (id) => PARTS.find((p) => p.id === (ALIASES[id] || id));

/** Signal-flow graph drawn by src/visuals/flow.js. */
export const FLOW = {
  nodes: [
    { id: 'pir', label: 'PIR sensor', sub: 'GPIO 36', side: 'in' },
    { id: 'keys', label: '8 keys', sub: 'GPIO 13…12', side: 'in' },
    { id: 'buttons', label: 'BOOT button', sub: 'GPIO 0', side: 'in' },
    { id: 'irLevel', label: 'IR level', sub: 'GPIO 39', side: 'in' },
    { id: 'irDrop', label: 'IR drop', sub: 'GPIO 35', side: 'in' },
    { id: 'battery', label: '2S battery', sub: 'GPIO 34 (ADC)', side: 'in' },
    { id: 'tof', label: 'VL53L7CX (I2C)', sub: 'GPIO 21 · 19', side: 'in' },
    { id: 'esp32', label: 'ESP32', sub: 'setup() · loop()', side: 'core' },
    { id: 'leds', label: 'LED sticks ×9', sub: 'GPIO 16', side: 'out' },
    { id: 'speaker', label: 'Amp + speaker', sub: 'I2S 26·25·22', side: 'out' },
    { id: 'display', label: 'ILI9341', sub: 'SPI', side: 'out' },
    { id: 'servo', label: 'MG90S', sub: 'GPIO 17', side: 'out' },
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
  [14, 'Key Re', 'keys', 'in', 'GPIO', 'INPUT_PULLUP'],
  [27, 'Key Mi', 'keys', 'in', 'GPIO', 'INPUT_PULLUP'],
  [32, 'Key Fa', 'keys', 'in', 'GPIO', 'INPUT_PULLUP'],
  [33, 'Key Sol', 'keys', 'in', 'GPIO', 'INPUT_PULLUP'],
  [15, 'Key La', 'keys', 'in', 'GPIO', 'boot strap: key to GND only'],
  [2, 'Key Si', 'keys', 'in', 'GPIO', 'boot strap: key to GND only'],
  [12, "Key Do'", 'keys', 'in', 'GPIO', 'boot strap: key to GND only, never a pull-up'],
  [16, 'LED data', 'leds', 'out', 'RMT', '72 WS2812 via 74AHCT125 + 330 Ω'],
  [17, 'Servo', 'servo', 'out', 'LEDC PWM 50 Hz', 'MG90S on the 5 V rail'],
  [26, 'I2S BCLK', 'amp', 'out', 'I2S', 'MAX98357A'],
  [25, 'I2S LRC', 'amp', 'out', 'I2S', 'MAX98357A word clock'],
  [22, 'I2S DIN', 'amp', 'out', 'I2S', 'MAX98357A data'],
  [21, 'I2C SDA', 'tof', 'in/out', 'I2C', 'VL53L7CX'],
  [19, 'I2C SCL', 'tof', 'out', 'I2C', 'VL53L7CX, 400 kHz'],
  [18, 'TFT SCK', 'display', 'out', 'SPI', 'ILI9341'],
  [23, 'TFT MOSI', 'display', 'out', 'SPI', 'ILI9341'],
  [5, 'TFT CS', 'display', 'out', 'SPI', 'boot strap: idles HIGH, fine'],
  [4, 'TFT DC', 'display', 'out', 'GPIO', 'ILI9341 data/command'],
  [36, 'PIR', 'pir', 'in', 'GPIO + RTC', 'input-only; ext0 deep-sleep wake'],
  [39, 'IR level', 'irLevel', 'in', 'GPIO', 'input-only'],
  [35, 'IR drop', 'irDrop', 'in', 'GPIO interrupt', 'input-only; FALLING edge'],
  [34, 'Battery', 'power', 'in', 'ADC1', '100k/33k divider: 8.4 V → 2.08 V'],
  [0, 'BOOT button', 'buttons', 'in', 'GPIO', 'on the DevKit; short = mode, long = difficulty'],
];
