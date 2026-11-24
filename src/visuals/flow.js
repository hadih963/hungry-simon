// PLACEHOLDER signal-flow diagram. GPT (Codex) replaces this file on branch gpt/visuals.
// Contract: see AGENTS.md "Signal-flow diagram contract".
export function createFlow(root, { nodes, edges }) {
  root.innerHTML = '';
  root.classList.add('flow-stub');
  const els = new Map();
  let selectCb = () => {};
  for (const side of ['in', 'core', 'out', 'cloud']) {
    const col = document.createElement('div');
    col.className = 'flow-col';
    nodes.filter((n) => n.side === side).forEach((n) => {
      const b = document.createElement('button');
      b.className = 'flow-node';
      b.innerHTML = `<b>${n.label}</b><small>${n.sub}</small>`;
      b.addEventListener('click', () => selectCb(n.id));
      col.append(b);
      els.set(n.id, b);
    });
    root.append(col);
  }
  const flash = (el, cls, ms) => { if (!el) return; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };
  return {
    pulse(id, ms = 600) {
      const edge = edges.find((e) => e.id === id);
      if (edge) { flash(els.get(edge.from), 'pulse', ms); flash(els.get(edge.to), 'pulse', ms); } else flash(els.get(id), 'pulse', ms);
    },
    onSelect(cb) { selectCb = cb; },
    select(id) { els.forEach((el, k) => el.classList.toggle('selected', k === id)); },
  };
}
