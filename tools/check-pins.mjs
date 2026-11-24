// Checks that the firmware's pin numbers match src/learn/hardware.js.  Run: node tools/check-pins.mjs
import { readFileSync } from 'node:fs';
import { PINS } from '../src/learn/hardware.js';
const ino = readFileSync(new URL('../firmware/hungry_simon/hungry_simon.ino', import.meta.url), 'utf8');
const tft = readFileSync(new URL('../firmware/User_Setup_HungrySimon.h', import.meta.url), 'utf8');
const def = (src, name) => Number(src.match(new RegExp(`#define\\s+${name}\\s+(-?\\d+)`))?.[1]);
const keys = ino.match(/KEY_PINS\[8\]\s*=\s*\{([^}]*)\}/)[1].split(',').map(Number);
const checks = [
  ['KEYS', JSON.stringify(keys), JSON.stringify(PINS.KEYS)],
  ...['LEDS', 'SERVO', 'I2S_BCLK', 'I2S_LRC', 'I2S_DOUT', 'I2C_SDA', 'I2C_SCL', 'PIR', 'IR_LEVEL', 'IR_DROP', 'BATTERY', 'BTN_MODE']
    .map((k) => [k, def(ino, `PIN_${k}`), PINS[k]]),
  ['TFT_SCLK', def(tft, 'TFT_SCLK'), PINS.TFT.SCK],
  ['TFT_MOSI', def(tft, 'TFT_MOSI'), PINS.TFT.MOSI],
  ['TFT_CS', def(tft, 'TFT_CS'), PINS.TFT.CS],
  ['TFT_DC', def(tft, 'TFT_DC'), PINS.TFT.DC],
];
let bad = 0;
for (const [name, fw, web] of checks) {
  const ok = String(fw) === String(web);
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'DIFF'} ${name}: firmware ${fw} / simulator ${web}`);
}
// every GPIO used once
const used = [...keys, ...['LEDS', 'SERVO', 'I2S_BCLK', 'I2S_LRC', 'I2S_DOUT', 'I2C_SDA', 'I2C_SCL', 'PIR', 'IR_LEVEL', 'IR_DROP', 'BATTERY', 'BTN_MODE'].map((k) => PINS[k]), ...Object.values(PINS.TFT)];
const dup = used.filter((p, i) => used.indexOf(p) !== i);
if (dup.length) { bad++; console.log(`DIFF duplicate GPIOs: ${dup.join(', ')}`); } else console.log(`ok   ${used.length} GPIOs, no duplicates`);
process.exit(bad ? 1 : 0);
