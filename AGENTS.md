# Hungry Simon simulator: rules for every contributor (human or AI)

Browser simulator of **Hungry Simon**, an ESP32 rhythm instrument (Project Group 9, ACS_1C,
The Hague University of Applied Sciences). It lets the team demo and test game logic before the
hardware exists. See `README.md` for the product summary.

## Tech rules
- Plain HTML + CSS + ES modules. **No build step, no npm dependencies, no CDN imports.**
- Run with `python3 -m http.server 8000` and open http://localhost:8000.
- Must work in a current Chrome/Firefox without WebGL (use SVG / Canvas 2D / CSS only).
- Sound uses the Web Audio API only (in `src/core/audio.js`).

## Who owns what (only edit your own files; ask in a commit message / PR if you need a change elsewhere)
| Area | Owner | Files |
|---|---|---|
| Game logic, audio, songs, falling-notes display, app wiring, control panel | Claude | `index.html`, `styles/app.css`, `src/main.js`, `src/core/**`, `src/learn/**`, `firmware/**`, `tools/**` |
| Device visuals + signal-flow diagram | GPT (Codex) | `src/visuals/**`, `styles/device.css`, `styles/flow.css` |
| Technical report text, reviews, diagrams-as-text | Gemini (via Hadi) | `docs/gemini-output/**` |
| Prompts for Gemini | Claude | `docs/gemini-prompts/**` |

## Git
- `main` is integrated by Claude. Each model works on its own branch: `gpt/<topic>`, `gemini/<topic>`.
- Small commits, imperative messages, say which model wrote it (e.g. `visuals: draw dispenser (GPT)`).

## Device visuals contract (`src/visuals/device.js`)
The core code only talks to the device through this API. Keep the signatures stable.

```js
import { createDevice } from './visuals/device.js';
const device = createDevice(rootElement, { keyCount: 8, keyNames, keyColors });

device.onKeyInput((index, isDown) => {});   // pointer/touch on a keycap; index 0..7
device.pressKey(index, isDown);             // show keycap pressed/released (also used for keyboard input)
device.setKeyLed(index, color, intensity);  // RGB LED under a key; color = CSS colour or null (off); intensity 0..1
device.flashAll(color, ms);                 // all LEDs flash (success / error feedback)
device.getDisplayCanvas();                  // <canvas> inside the display bezel, 320x240 internal pixels (2.8" ILI9341, 4:3); core draws on it
device.setPresence(isPresent);              // presence sensor (PIR/HC-SR04) indicator, + "person" silhouette
device.onPresenceToggle(cb);                // user clicked the presence sensor / person to toggle
device.setAwake(isAwake);                   // deep sleep look (dim everything) vs awake
device.setTreatLevel(level);                // 0..1 fill of the treat reservoir
device.dispense();                          // animate servo wheel turning + one treat dropping down the slide; returns Promise resolved when the treat lands
device.setPetMode(isPet);                   // pet mode: keys are merged pairwise into 4 big keys (0+1, 2+3, 4+5, 6+7); onKeyInput still reports the left index of the pair
device.setVolume(v);                        // 0..1, optional speaker-grille animation strength
device.pulseSpeaker();                      // a note was played (speaker grille pulse)
```

Added in round 2 (learning layer):
```js
device.onPartClick(cb);                     // user clicked a part; cb(partId)
device.highlightPart(partId);               // outline/glow one part (null = none). Called while the firmware trace runs.
// partIds: 'esp32' (the T-Display board = the display module), 'keys', 'leds', 'speaker', 'display',
//          'pir', 'servo', 'irLevel', 'irDrop', 'battery', 'buttons', 'wifi'
```

Added in round 3 (hand-triggered treats: VL53L1X ToF sensor + treat light):
```js
device.setHand(isPresent);                  // show/hide a hand held under the dispenser outlet
device.onHandToggle(cb);                    // user clicked the area under the outlet / the hand; cb()
device.setTofReading(mm, isHand);           // ToF beam: show the measured distance; beam turns orange when isHand
device.setTreatLight(color, mode);          // treat light at the outlet (9th WS2812B): color or null (off); mode 'pulse' | 'solid'
device.dispense({ intoHand });              // as before, but when intoHand the treat lands in the hand, not the bowl
// new partIds: 'tof' (VL53L7CX 8x8 multizone module under the chute), 'treatLight' (the chute LED stick)
```

Added in round 4 (final component list, see docs/components.md):
```js
// Board is now a DOIT ESP32 DevKit V1 (separate from the display); display = 2.8" ILI9341 320x240.
// Each key has a WS2812 stick of 8 LEDs; the chute has its own stick (treat light).
// new partIds: 'power' (2S 18650 pack + USB-C 2S charger + 5 V 5 A buck + power switch), 'amp' (MAX98357A)
// 'buttons' = the BOOT button on the DevKit; 'battery' is kept as an alias of 'power'.
```

## Signal-flow diagram contract (`src/visuals/flow.js`, owner GPT)
Data comes from `FLOW` in `src/learn/hardware.js` (nodes have `side`: in | core | out | cloud).
```js
import { createFlow } from './visuals/flow.js';
const flow = createFlow(rootElement, FLOW);
flow.pulse(id, ms);   // id = node id (glow) or edge id like 'keys-esp32' (a dot travels from → to along the wire)
flow.onSelect(cb);    // user clicked a node; cb(nodeId)
flow.select(id);      // persistent selection outline (null = none)
```

## Firmware & trace
`firmware/hungry_simon/*.ino` is real Arduino-ESP32 firmware (owner Claude). Lines tagged `//@trace-id`
are what the code viewer highlights when the simulator emits that trace id. Pins must match `PINS`
in `src/learn/hardware.js` (`node tools/check-pins.mjs`).

Key colours (Do→Do'): `#ff4d4d #ff9f1c #ffd60a #3ddc84 #2ec4b6 #3a86ff #8338ec #ff5fa2`.
