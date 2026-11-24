# Hungry Simon firmware (ESP32)

Real Arduino firmware for the device. Parts: [../docs/components.md](../docs/components.md).
The browser simulator shows these files and highlights the line that runs (lines ending in `//@trace.id`).

## Build
1. Arduino IDE 2 → Boards Manager → **esp32 by Espressif, 3.x** → board **DOIT ESP32 DEVKIT V1**.
   Tools → Partition Scheme → **Default 4MB with spiffs (1.2MB APP / 1.5MB SPIFFS)**.
2. Library Manager: **TFT_eSPI**, **Adafruit NeoPixel**, **ESP32Servo**, **PubSubClient**,
   **ArduinoJson** (7.x), **STM32duino VL53L7CX**. (ESP_I2S and LittleFS come with the ESP32 core.)
3. TFT_eSPI: copy `User_Setup_HungrySimon.h` over `libraries/TFT_eSPI/User_Setup.h`.
4. Copy `hungry_simon/secrets.h.example` to `hungry_simon/secrets.h` and fill in Wi-Fi + broker.
5. Optional sound clips: put WAV files in `hungry_simon/data/` (see the README there) and upload them
   with the **arduino-littlefs-upload** plugin. Without clips the firmware synthesises tones.
6. Open `hungry_simon/hungry_simon.ino`, upload, open the Serial Monitor at 115200 baud.

Not compiled yet: no ESP32 toolchain on the machine where it was written, and the VL53L7CX
library's API differs a little between versions (`init_sensor()` vs `init()`). Expect small fixes
on the first build.

## How it is organised
- `loop()` (core 1) scans keys, sensors and the game; it never waits.
- **Audio** (`audio.ino`) and the **display** (`display.ino`) each run in their own FreeRTOS task on
  core 0, so a 31 ms screen update or a flash read never delays a key press.

## Wiring notes
- **Keys**: each KW11-3Z microswitch COM → GND, NO → its GPIO (13, 14, 27, 32, 33, 15, 2, 12).
  GPIO 2, 12 and 15 are boot-strapping pins: no external pull-ups there.
- **LED sticks**: GPIO 16 → 74AHCT125 → 330 Ω → DIN of stick 0; chain DOUT → DIN through the 8 key
  sticks, then the chute stick. Feed 5 V at both ends of the chain, 1000 µF across 5 V/GND at the start.
- **MAX98357A**: BCLK 26, LRC 25, DIN 22, VIN 5 V, SD to VIN (always on), GAIN floating (9 dB).
- **VL53L7CX**: SDA 21, SCL 19, 3.3 V, LPn → 3.3 V (47 kΩ). Mount it under the chute, looking down.
- **ILI9341**: SCK 18, MOSI 23, CS 5, DC 4, RST → EN, LED → 3.3 V.
- **MG90S**: signal 17, 5 V from the buck converter (not from the DevKit), 470 µF close to it.
- **Power**: 2S pack → USB-C 2S charger/BMS → power switch → 5 V 5 A buck → 5 V rail → DevKit **VIN**.
  Battery sense: pack + → 100 kΩ → GPIO 34 → 33 kΩ → GND.
- **PIR** on 36 (wakes from deep sleep), **IR level** on 39, **IR drop** on 35. These three are
  required by the assignment but not yet on the component list.

## Pins
See `docs/components.md` and `src/learn/hardware.js`. `node tools/check-pins.mjs` checks that the
firmware and the simulator agree.
