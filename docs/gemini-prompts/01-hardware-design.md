# 1. Hardware design and GPIO budget

**Attach:** `Project Description - Q2 Group 9.pdf` (the assignment)

**Save the answer as:** `docs/gemini-output/01-hardware-design.md`

## Prompt

You are an embedded-systems engineer helping a first-year Applied Computer Science student group
(The Hague University of Applied Sciences) write the "Hardware system design" chapter of their
technical report. The project is **Hungry Simon**: an ESP32-based interactive keyboard instrument
(Simon-says / Guitar Hero style) with a treat dispenser. The attached PDF is the assignment. Base
everything on it.

Fixed facts:
- Controller: ESP32, programmed in C (choose between LilyGO T-Display ESP32 and ESP32 DevKit V1 and justify the choice).
- 8 spring-loaded key switches (debounced), with an RGB LED under each key.
- A display above the keys, refreshing at ≥ 20 Hz, that shows falling notes.
- A small speaker with an amplifier; the laser-cut plywood frame acts as the sound box.
- Presence sensor (HC-SR04 ultrasonic **or** PIR) to wake from deep sleep.
- Treat-level sensor (IR obstacle module **or** VL53L1X ToF) that detects an empty reservoir and confirms a treat dropped.
- SG90 servo turning a gumball-style wheel onto a slide.
- Rechargeable lithium battery charged over USB-C; wireless charging is a stretch goal.
- Optional: an LDR for LED brightness, an IMU to detect tip-over.

Write, in clear English for a technical report, in Markdown:
1. **Component selection table**: component, chosen part (with a realistic model number), why it was
   chosen over the alternative, approximate price in EUR.
2. **Operating principle** of each component in 3–5 sentences (how the sensor or actuator works
   physically and how the ESP32 reads or drives it).
3. **GPIO budget table**: every signal → ESP32 GPIO number, direction, peripheral used
   (GPIO / ADC / PWM-LEDC / RMT / I2C / SPI / I2S), and notes. Respect the ESP32's real constraints:
   input-only pins 34–39, strapping pins (0, 2, 5, 12, 15), flash pins 6–11, ADC2 not usable with
   Wi-Fi, and RTC-capable pins needed for deep-sleep wake (ext0/ext1). If you pick the T-Display,
   remove the pins its TFT and buttons already use. Recommend addressable LEDs (WS2812B / SK6812,
   1 data pin) for the 8 RGB LEDs, and say whether to read the 8 keys directly or through a
   shift register / I/O expander. Show the pin count adds up.
4. **Block diagram** as a Mermaid `flowchart LR` (ESP32 at the centre; sensors, keys, LEDs,
   display, audio amp + speaker, servo, power path with battery, charger, protection and regulator,
   and Wi-Fi → MQTT broker).
5. **Wiring description**: a table of connections, including level shifting for the LED data line,
   the 5 V vs 3.3 V rails, the HC-SR04 echo divider if used, and decoupling or bulk capacitors for
   the servo and LEDs.
6. **Power budget**: estimated current of each part when active and in deep sleep, battery
   capacity choice, and expected play time and standby time. Show your calculation.
7. **Safety**: battery protection (BMS / protected cell), a covered servo mechanism, food-safe and
   cleanable dispenser materials, and how the daily treat limit is enforced in firmware.

Be concrete and realistic. Where you make an assumption, say so in one line. Don't invent parts
that don't exist.
