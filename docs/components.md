# Hungry Simon: component list

*Updated 24 Nov 2026*

Hungry Simon is an 8-key, Simon-says-style piano that lights up, plays recorded sounds and
dispenses a treat when a player wins. It runs on an ESP32, logs stats to the cloud, and works for
humans and pets.

The ESP32 board and the VL53L7CX sensor are provided. The lever microswitches and the WS2812 LED
sticks have been found. Everything else still has to be bought. The power setup assumes the
80-LED version (10 LED sticks).

## Electronics

| # | Component | Model / type | Qty | Function |
|---|---|---|---|---|
| 1 | Microcontroller | DOIT ESP32 DevKit V1 (ESP32-WROOM-32, 4 MB flash, Wi-Fi + Bluetooth) | 1 | Runs the games, stores the sound clips, connects to the cloud |
| 2 | Hand / paw sensor | VL53L7CX 8×8 multizone time-of-flight sensor (I2C) | 1 | Detects a hand or paw under the chute and starts the dispenser |
| 3 | Key switches | Lever microswitch, KW11-3Z type | 8 + 2 spare | One under each hinged piano key |
| 4 | Key lighting | WS2812 5050 RGB LED stick, 8 LEDs, 5 V | 8 + 1 chute + 1 spare | Lights each key and the chute; one data line for all |
| 5 | Level shifter | 74AHCT125 | 1 | Converts the 3.3 V LED data signal to 5 V |
| 6 | Display | 2.8" ILI9341 TFT, 320×240, SPI | 1 | Falling-note view, menus, scores |
| 7 | Audio amplifier | MAX98357A I2S class-D amplifier, 3 W | 1 | Plays recorded clips with about 10 ms delay |
| 8 | Speaker | 4 Ω, 3 W, 40 mm full-range | 1 | Sound output; the plywood frame acts as the speaker box |
| 9 | Treat motor | MG90S metal-gear micro servo | 1 | Turns the treat wheel one slot per win |

## Power

A 2-cell Li-ion pack with a 5 V, 5 A step-down converter powers everything, with USB-C charging.

| # | Component | Model / type | Qty | Function |
|---|---|---|---|---|
| 10 | Battery cells | 18650 Li-ion, protected, high-drain (≥10 A, e.g. Samsung 30Q) | 2 | 2S pack, 7.4 V nominal |
| 11 | Battery holder | 2× 18650 holder, series (2S) | 1 | Holds and connects the cells |
| 12 | Charger | USB-C 2S Li-ion charger board with protection (BMS) | 1 | Charges the pack over USB-C |
| 13 | 5 V supply | 5 V, 5 A step-down (buck) converter | 1 | Powers LEDs, servo, amplifier and the ESP32 (VIN pin) |
| 14 | Power switch | Panel rocker or slide switch | 1 | Turns the device on and off |

### Estimated peak current at 5 V

| Load | Worst case | With the firmware brightness cap (50 %) | Typical while playing |
|---|---|---|---|
| 72 WS2812 LEDs in use (9 sticks × 8; the spare stick is not installed) | 4.32 A (all full white, 60 mA each) | 2.16 A | ≈ 0.4 A (one key + hints lit) |
| ESP32 DevKit V1 (Wi-Fi transmitting) | 0.25 A | 0.25 A | 0.12 A |
| MAX98357A + 4 Ω speaker at 3 W | 0.70 A | 0.70 A | 0.15 A |
| MG90S servo (stall / start-up) | 0.80 A | 0.80 A | 0 A (moves ~0.4 s per win) |
| ILI9341 display + backlight | 0.08 A | 0.08 A | 0.08 A |
| VL53L7CX (ranging) | 0.10 A | 0.10 A | 0.10 A |
| **Total** | **≈ 6.3 A** | **≈ 4.1 A** | **≈ 0.9 A** |

- At full white the LEDs alone would exceed the 5 A converter. The firmware therefore caps LED
  brightness at 50 % (`strip.setBrightness(128)`), which keeps the worst case at about 4.1 A.
- From the battery side, 4.1 A at 5 V is about 22 W, or ≈ 3.3 A from the 2S pack at 7.4 V with
  ~90 % buck efficiency. That is well inside the ≥ 10 A rating of the cells.
- Two 3000 mAh cells in series give ≈ 22 Wh. At the typical ≈ 0.9 A (4.5 W) that is roughly
  **4 hours of play**.

## Pin budget (ESP32 DevKit V1)

All 24 usable GPIOs are assigned. GPIO 1/3 (USB serial) and 6–11 (flash) are never used.

| GPIO | Signal | Part | Notes |
|---|---|---|---|
| 13, 14, 27, 32, 33, 15, 2, 12 | Keys Do … Do' | lever microswitches | COM → GND, NO → GPIO, `INPUT_PULLUP`. 2, 12 and 15 are boot straps: fine because the keys only pull to GND |
| 16 | LED data | 9 LED sticks | via 74AHCT125 + 330 Ω series resistor |
| 17 | Servo PWM | MG90S | 50 Hz |
| 26 / 25 / 22 | I2S BCLK / LRC / DIN | MAX98357A | SD pin to VIN = always on, GAIN floating = 9 dB |
| 21 / 19 | I2C SDA / SCL | VL53L7CX | LPn tied to 3.3 V (47 kΩ), 400 kHz |
| 18 / 23 / 5 / 4 | SPI SCK / MOSI / CS / DC | ILI9341 | RST → EN, LED (backlight) → 3.3 V, MISO not needed |
| 36 | PIR output | HC-SR501 *(see "not on the list")* | RTC pin: wakes from deep sleep |
| 39 | IR level | IR obstacle module *(see "not on the list")* | input-only |
| 35 | IR drop | IR obstacle module *(see "not on the list")* | input-only, interrupt |
| 34 | Battery voltage | 100 kΩ / 33 kΩ divider | 8.4 V → 2.08 V, ADC1 |
| 0 | BOOT button on the DevKit | mode / difficulty | short press = next mode, long press = difficulty |

## Not on the list yet

| Part | Why |
|---|---|
| **Presence sensor** (HC-SR501 PIR, ~€1) | **Required by the assignment**: wakes the device from deep sleep and starts a game. The VL53L7CX looks at the chute, not at the player. |
| **2 × IR obstacle module** (~€1 each) | **Required by the assignment**: one at the reservoir's low mark (empty alert), one at the chute (confirms a treat really dropped). |
| 330 Ω resistor | In series with the LED data line (protects the first LED). |
| 1000 µF / 10 V capacitor | Across 5 V and GND at the first LED stick (inrush). |
| 470 µF / 10 V capacitor | Near the servo (stops brown-outs when it starts). |
| 100 kΩ + 33 kΩ resistors | Battery voltage divider for GPIO 34. |
| Wire, connectors, heat-shrink | Power wiring for 4+ A: at least 20 AWG from the buck converter to the LEDs. Inject 5 V at both ends of the LED chain. |

## Salvaged from the T&G Bluetooth speaker (optional)

- **Passive radiator** in the plywood box next to the 4 Ω speaker gives more bass.
- **USB-C socket and power switch** can be reused in the case.
- Its 1200 mAh battery is **not** used: the 2S pack above replaces it.
