# 4. Check the part explanations and the firmware

**Attach:** `src/learn/hardware.js` and every file in `firmware/hungry_simon/` (7 `.ino` files)

**Save the answer as:** `docs/gemini-output/04-parts-and-firmware-review.md`

## Prompt

You are an embedded-systems teacher reviewing teaching material for first-year Applied Computer
Science students. **Hungry Simon** is an ESP32 rhythm instrument (LilyGO T-Display ESP32, 8 keys,
WS2812B LEDs, PAM8302 amp + speaker, SG90 treat servo, HC-SR501 PIR, two IR obstacle modules,
Li-ion battery, MQTT over TLS). Students learn it from a browser simulator that shows the attached
firmware running line by line, with the explanations in `hardware.js` (the `PARTS` list, fields
`what` and `how`) and a GPIO table (`PIN_TABLE`).

Please give:

1. **Fact check of every part** in `PARTS` and `PIN_TABLE`: anything technically wrong or
   misleading. Check currents, voltages, timings, the WS2812B protocol, servo pulse widths, PIR
   behaviour, whether the ESP32 really can wake from GPIO 33 with ext0, whether GPIO 36–39 have no
   pull-ups, and whether the T-Display pin assignments (TFT on 4/5/16/18/19/23, buttons on 0/35,
   battery on 34) are right. Give a table: part | issue | correction.
2. **Firmware compile check (by reading)**: Arduino-ESP32 core **3.x** API (`ledcAttach`,
   `ledcWriteTone`, `ledcWrite(pin, duty)`), TFT_eSPI, Adafruit_NeoPixel, ESP32Servo, PubSubClient,
   ArduinoJson 7. List every line likely to fail to compile or misbehave, with the fix. Remember that
   Arduino joins `.ino` tabs alphabetically after the main tab: check that every global is declared
   before it is used.
3. **Hardware conflicts**: can LEDC drive both the speaker (variable frequency) and ESP32Servo
   (50 Hz) without sharing a timer badly? Can the NeoPixel library run together with them? Any
   brown-out risk when the servo and LEDs start at the same time on one battery, and what fixes it
   (capacitor values)?
4. **Simpler explanations**: rewrite the `how` text of the 4 hardest parts so a first-year student
   understands them in under 60 words each. Keep the facts.

Be precise and brief. Quote line numbers.
