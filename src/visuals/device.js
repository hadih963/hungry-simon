// PLACEHOLDER device visuals. GPT (Codex) replaces this file on branch gpt/visuals.
// Implements the contract in AGENTS.md with plain DOM so the core can be developed meanwhile.

export function createDevice(root, { keyCount = 8, keyNames = [], keyColors = [] } = {}) {
  root.innerHTML = '';
  root.classList.add('device-stub');

  const status = el('div', 'stub-status');
  const presenceBtn = el('button', 'stub-presence', 'Presence: no');
  const treat = el('div', 'stub-treat', 'Treats: 100%');
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 160;
  canvas.className = 'stub-display';
  const keysRow = el('div', 'stub-keys');
  status.append(presenceBtn, treat);
  root.append(status, canvas, keysRow);

  let keyInput = () => {};
  let presenceCb = () => {};
  let petMode = false;
  const keys = [];
  for (let i = 0; i < keyCount; i++) {
    const k = el('div', 'stub-key', keyNames[i] || String(i + 1));
    k.style.setProperty('--key-color', keyColors[i] || '#888');
    const down = (e) => { e.preventDefault(); k.setPointerCapture?.(e.pointerId); keyInput(idx(i), true); };
    const up = () => keyInput(idx(i), false);
    k.addEventListener('pointerdown', down);
    k.addEventListener('pointerup', up);
    k.addEventListener('pointercancel', up);
    keysRow.append(k);
    keys.push(k);
  }
  const idx = (i) => (petMode ? i - (i % 2) : i);
  presenceBtn.addEventListener('click', () => presenceCb());

  const pair = (i) => (petMode ? [i - (i % 2), i - (i % 2) + 1] : [i]);

  return {
    onKeyInput(cb) { keyInput = cb; },
    pressKey(i, isDown) { pair(i).forEach((j) => keys[j]?.classList.toggle('down', isDown)); },
    setKeyLed(i, color, intensity = 1) {
      pair(i).forEach((j) => {
        const k = keys[j]; if (!k) return;
        k.style.boxShadow = color ? `0 0 ${8 + 22 * intensity}px ${color}` : '';
        k.style.outline = color ? `3px solid ${color}` : '';
      });
    },
    flashAll(color, ms = 300) {
      keys.forEach((k) => { k.style.background = color; });
      setTimeout(() => keys.forEach((k) => { k.style.background = ''; }), ms);
    },
    getDisplayCanvas() { return canvas; },
    setPresence(p) { presenceBtn.textContent = `Presence: ${p ? 'yes' : 'no'}`; },
    onPresenceToggle(cb) { presenceCb = cb; },
    setAwake(a) { root.style.opacity = a ? '1' : '0.45'; },
    setTreatLevel(l) { treat.textContent = `Treats: ${Math.round(l * 100)}%`; },
    dispense() {
      treat.textContent += ' 🍬';
      return new Promise((r) => setTimeout(r, 900));
    },
    setPetMode(p) { petMode = p; keys.forEach((k, j) => k.classList.toggle('pet-merged', p && j % 2 === 1)); },
    setVolume() {},
    pulseSpeaker() {},
  };
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}
