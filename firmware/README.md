# Hungry Simon firmware (ESP32)

Real Arduino firmware for the device. The browser simulator shows these files and highlights
the line that runs (lines ending in `//@trace.id`).

## Build
1. Arduino IDE 2 → Boards Manager → **esp32 by Espressif, 3.x** → board **ESP32 Dev Module**
   (LilyGO T-Display ESP32).
2. Library Manager: **TFT_eSPI**, **Adafruit NeoPixel**, **ESP32Servo**, **PubSubClient**, **ArduinoJson** (7.x), **VL53L1X by Pololu**.
3. TFT_eSPI: in `User_Setup_Select.h`, enable `#include <User_Setups/Setup25_TTGO_T_Display.h>`.
4. Copy `hungry_simon/secrets.h.example` to `hungry_simon/secrets.h` and fill in Wi-Fi + broker.
5. Open `hungry_simon/hungry_simon.ino`, upload, open the Serial Monitor at 115200 baud.

Not compiled yet: no ESP32 toolchain on the machine where it was written. Expect small fixes on first build.

## Pins
See `src/learn/hardware.js` (`PINS`, `PIN_TABLE`). `node tools/check-pins.mjs` checks that the
firmware and the simulator agree.

## Wiring the hand sensor and the treat light
- **TOF400C-VL53L1X**: VIN → 3.3 V, GND → GND, SDA → GPIO 21, SCL → GPIO 22. Leave XSHUT and INT
  unconnected (the module pulls XSHUT up). Mount it under the treat outlet, looking down at the bowl,
  with nothing else in its 27° cone. The firmware measures the empty bowl at start-up.
- **Treat light**: one more WS2812B after the last key LED. Connect DOUT of LED 8 to DIN of the treat
  light, plus 5 V and GND. No extra GPIO.
- Keys Fa and Sol moved to **GPIO 2 and 12** to free 21/22 for I2C. They are boot-strapping pins:
  wire the keys to GND only and do **not** add external pull-ups there.
