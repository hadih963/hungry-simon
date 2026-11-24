// Parts and Pinout panels.
import { PARTS, PIN_TABLE, partById } from './hardware.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createPartsPanel(el, { onSelect, onShowCode }) {
  el.innerHTML = `<div class="part-chips">${PARTS.map((p) =>
    `<button data-part="${p.id}">${esc(p.name.replace(/ \(.*\)/, ''))}</button>`).join('')}</div>
    <article class="part-card" id="partCard"><p class="muted">Click a part on the device, in the diagram or above to see what it does and how it works.</p></article>`;
  const card = el.querySelector('#partCard');

  el.querySelector('.part-chips').addEventListener('click', (e) => {
    const id = e.target.closest('button')?.dataset.part;
    if (id) onSelect(id);
  });

  function show(id) {
    const p = partById(id);
    el.querySelectorAll('.part-chips button').forEach((b) => b.classList.toggle('on', b.dataset.part === id));
    if (!p) return;
    const pins = Array.isArray(p.pins) ? p.pins.map((n) => `GPIO ${n}`).join(' · ') : p.pins === 'radio' ? 'built-in radio' : 'all pins';
    card.innerHTML = `
      <h3>${esc(p.name)}</h3>
      <p class="part-model">${esc(p.model)}</p>
      <p class="part-pins"><span>Wired to</span> ${esc(pins)}</p>
      <h4>What it does</h4><p>${esc(p.what)}</p>
      <h4>How it works</h4><p>${esc(p.how)}</p>
      <h4>Specs</h4><ul>${p.specs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <button class="primary show-code">Show its code ›</button>`;
    card.querySelector('.show-code').addEventListener('click', () => onShowCode(p.fn));
  }

  return { show };
}

export function createPinoutPanel(el, { onSelect }) {
  el.innerHTML = `
    <p class="muted small">GPIO budget of the LilyGO T-Display ESP32: all 16 header GPIOs plus the built-in display, buttons and battery pins are used. Click a row to see that part.</p>
    <table class="pins"><thead><tr><th>GPIO</th><th>Signal</th><th>Dir</th><th>Peripheral</th><th>Note</th></tr></thead>
    <tbody>${PIN_TABLE.map(([g, sig, part, dir, per, note]) =>
      `<tr data-part="${part}"><td><b>${g}</b></td><td>${esc(sig)}</td><td><span class="dir ${dir}">${dir}</span></td><td>${esc(per)}</td><td>${esc(note)}</td></tr>`).join('')}
    </tbody></table>
    <p class="muted small">Never used: GPIO 6–11 (flash). GPIO 2 and 12 are boot straps, so they only get keys that pull to GND, never a pull-up. Analog only on ADC1 (Wi-Fi uses ADC2).</p>`;
  el.querySelector('tbody').addEventListener('click', (e) => {
    const id = e.target.closest('tr')?.dataset.part;
    if (id) onSelect(id);
  });
  return {
    show(id) { el.querySelectorAll('tbody tr').forEach((r) => r.classList.toggle('on', r.dataset.part === id)); },
  };
}
