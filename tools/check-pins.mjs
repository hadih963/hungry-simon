// Checks that the firmware's pin numbers match src/learn/hardware.js.  Run: node tools/check-pins.mjs
import { readFileSync } from 'node:fs';
import { PINS } from '../src/learn/hardware.js';
const ino = readFileSync(new URL('../firmware/hungry_simon/hungry_simon.ino', import.meta.url), 'utf8');
const def = (name) => Number(ino.match(new RegExp(`#define\\s+${name}\\s+(\\d+)`))?.[1]);
const keys = ino.match(/KEY_PINS\[8\]\s*=\s*\{([^}]*)\}/)[1].split(',').map(Number);
const checks = [
  ['KEYS', JSON.stringify(keys), JSON.stringify(PINS.KEYS)],
  ...['SPEAKER', 'LEDS', 'SERVO', 'PIR', 'IR_LEVEL', 'IR_DROP', 'BATTERY', 'BTN_MODE', 'BTN_OPTION']
    .map((k) => [k, def(`PIN_${k}`), PINS[k]]),
];
let bad = 0;
for (const [name, fw, web] of checks) {
  const ok = String(fw) === String(web);
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'DIFF'} ${name}: firmware ${fw} / simulator ${web}`);
}
process.exit(bad ? 1 : 0);
