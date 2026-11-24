// Shows the real firmware files and highlights the line a trace id points at.
// Lines in the firmware end with `//@trace.id`; those markers are hidden here.

export const FIRMWARE_DIR = 'firmware/hungry_simon/';
export const FIRMWARE_FILES = ['hungry_simon.ino', 'keys.ino', 'game.ino', 'audio.ino', 'outputs.ino', 'sensors.ino', 'display.ino', 'cloud.ino'];

const MARKER = /\s*\/\/@([\w.-]+)\s*$/;
const KEYWORDS = /\b(void|bool|int|int8_t|int16_t|int32_t|uint8_t|uint16_t|uint32_t|float|char|byte|const|static|struct|enum|return|if|else|for|while|switch|case|break|default|continue|true|false|nullptr|volatile|unsigned|sizeof|auto)\b/g;
const FN_DEF = /^(?:[\w:<>&*]+\s+)+[&*]?(\w+)\s*\([^;]*\)\s*\{/;

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// Tiny C highlighter: comments, strings, preprocessor, keywords, numbers, function calls.
function highlight(line) {
  const out = [];
  let rest = line;
  const ci = findComment(rest);
  let comment = '';
  if (ci >= 0) { comment = rest.slice(ci); rest = rest.slice(0, ci); }
  const parts = rest.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
  parts.forEach((p, i) => {
    if (i % 2) { out.push(`<span class="c-str">${escapeHtml(p)}</span>`); return; }
    let h = escapeHtml(p);
    if (/^\s*#/.test(p)) { out.push(`<span class="c-pre">${h}</span>`); return; }
    h = h.replace(/\b(\d+(?:\.\d+)?f?|0x[0-9A-Fa-f]+)\b/g, '<span class="c-num">$1</span>')
      .replace(KEYWORDS, '<span class="c-kw">$1</span>')
      .replace(/\b([A-Za-z_]\w*)(?=\s*\()/g, '<span class="c-fn">$1</span>');
    out.push(h);
  });
  if (comment) out.push(`<span class="c-com">${escapeHtml(comment)}</span>`);
  return out.join('');
}

function findComment(s) {
  let inStr = false;
  for (let i = 0; i < s.length - 1; i++) {
    if (s[i] === '"' && s[i - 1] !== '\\') inStr = !inStr;
    if (!inStr && s[i] === '/' && s[i + 1] === '/') return i;
  }
  return -1;
}

export async function createCodeView({ tabsEl, codeEl }) {
  const files = {};
  const markers = new Map();   // trace id → { file, line }
  await Promise.all(FIRMWARE_FILES.map(async (name) => {
    const res = await fetch(FIRMWARE_DIR + name);
    const text = res.ok ? await res.text() : `// could not load ${name}`;
    const lines = text.replace(/\r/g, '').split('\n').map((raw, i) => {
      const m = raw.match(MARKER);
      if (m) markers.set(m[1], { file: name, line: i });
      return raw.replace(MARKER, '').replace(/\s+$/, '');
    });
    files[name] = { lines, fnAt: functionIndex(lines) };
  }));

  let current = null;
  let lineEls = [];
  let lastHit = null;

  function functionIndex(lines) {
    const at = [];
    let fn = null;
    lines.forEach((l, i) => {
      const m = l.match(FN_DEF);
      if (m && !/^\s/.test(l)) fn = m[1];
      at[i] = fn;
    });
    return at;
  }

  function show(name) {
    if (current === name) return;
    current = name;
    tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.file === name));
    codeEl.innerHTML = files[name].lines.map((l, i) =>
      `<div class="ln" data-n="${i + 1}">${highlight(l) || ' '}</div>`).join('');
    lineEls = [...codeEl.children];
    lastHit = null;
  }

  tabsEl.innerHTML = FIRMWARE_FILES.map((f) => `<button data-file="${f}">${f}</button>`).join('');
  tabsEl.addEventListener('click', (e) => { const f = e.target.closest('button')?.dataset.file; if (f) show(f); });
  show(FIRMWARE_FILES[0]);

  function scrollTo(el) {
    // scroll inside the code box only (never the page)
    const top = el.offsetTop - codeEl.clientHeight / 2 + el.clientHeight / 2;
    // only scroll when the line is outside the middle part of the box; jumps are instant so fast traces keep up
    const visTop = codeEl.scrollTop + codeEl.clientHeight * 0.2;
    const visBot = codeEl.scrollTop + codeEl.clientHeight * 0.8;
    if (el.offsetTop < visTop || el.offsetTop > visBot) codeEl.scrollTop = Math.max(0, top);
  }

  return {
    has: (id) => markers.has(id),
    /** Highlight the line for trace id. Returns {file, line, fn} or null. */
    hit(id, follow = true) {
      const m = markers.get(id);
      if (!m) return null;
      if (follow) show(m.file);
      if (current === m.file) {
        lastHit?.classList.remove('run');
        lastHit?.classList.add('ran');
        const el = lineEls[m.line];
        el.classList.remove('ran');
        void el.offsetWidth;
        el.classList.add('run');
        lastHit = el;
        setTimeout(() => el.classList.remove('ran'), 2500);
        if (follow) scrollTo(el);
      }
      return { file: m.file, line: m.line + 1, fn: files[m.file].fnAt[m.line] };
    },
    reveal(id) { return this.hit(id, true); },
    markers,
  };
}
