const NS = 'http://www.w3.org/2000/svg';
const COLORS = { input: '#6f879a', output: '#b1784e', cloud: '#688668' };

export function createFlow(root, { nodes, edges }) {
  root.innerHTML = '';
  root.classList.add('signal-flow');

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 460');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Hungry Simon signal flow schematic');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = `<defs>
    <filter id="flowGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <marker id="flowArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 7 4 1 7" fill="none" stroke="context-stroke" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker>
  </defs><rect class="flow-paper" x="0" y="0" width="1000" height="460" rx="22"/>`;

  const inputNodes = nodes.filter((node) => node.side === 'in');
  const outputNodes = nodes.filter((node) => node.side === 'out' && node.id !== 'wifi');
  const positions = new Map();
  inputNodes.forEach((node, i) => positions.set(node.id, { x: 28, y: 57 + i * 54, w: 188, h: 42 }));
  outputNodes.forEach((node, i) => positions.set(node.id, { x: 710, y: 62 + i * 62, w: 166, h: 46 }));
  positions.set('esp32', { x: 382, y: 48, w: 250, h: 360 });
  positions.set('wifi', { x: 710, y: 345, w: 166, h: 52 });
  positions.set('webapp', { x: 875, y: 345, w: 112, h: 52 });

  const inputPins = new Map(inputNodes.map((node, i) => [node.id, 78 + i * 54]));
  const outputPins = new Map(outputNodes.map((node, i) => [node.id, 85 + i * 62]));
  const paths = new Map();
  const wireLayer = document.createElementNS(NS, 'g');
  wireLayer.classList.add('flow-wires');

  function addWire(edge, d, direction, dashed = false) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', `flow-wire flow-${direction}${dashed ? ' flow-command' : ''}`);
    path.setAttribute('marker-end', 'url(#flowArrow)');
    path.dataset.edge = edge.id;
    wireLayer.append(path);
    paths.set(edge.id, path);
  }

  edges.forEach((edge) => {
    if (edge.to === 'esp32' && edge.from !== 'wifi') {
      const y = inputPins.get(edge.from);
      addWire(edge, `M216 ${y} H382`, 'input');
    } else if (edge.from === 'esp32' && edge.to !== 'wifi') {
      const y = outputPins.get(edge.to);
      addWire(edge, `M632 ${y} H710`, 'output');
    } else if (edge.id === 'esp32-wifi') {
      addWire(edge, 'M632 371 H710', 'output');
    } else if (edge.id === 'wifi-esp32') {
      addWire(edge, 'M710 389 H665 V398 H632', 'input', true);
    } else if (edge.id === 'wifi-webapp') {
      addWire(edge, 'M876 357 H985', 'cloud');
    } else if (edge.id === 'webapp-wifi') {
      addWire(edge, 'M985 385 H876', 'cloud');
    }
  });
  svg.append(wireLayer);

  // The processor has only the pins that carry a signal in this diagram.
  const chip = positions.get('esp32');
  const chipGroup = document.createElementNS(NS, 'g');
  chipGroup.classList.add('flow-chip-decoration');
  chipGroup.innerHTML = `<rect class="chip" x="${chip.x}" y="${chip.y}" width="${chip.w}" height="${chip.h}" rx="16"/>`;
  [...inputPins.values()].forEach((y) => chipGroup.insertAdjacentHTML('beforeend', `<path class="pin pin-left" d="M${chip.x - 10} ${y}h10"/>`));
  [...outputPins.values(), 371, 398].forEach((y) => chipGroup.insertAdjacentHTML('beforeend', `<path class="pin pin-right" d="M${chip.x + chip.w} ${y}h10"/>`));
  chipGroup.insertAdjacentHTML('beforeend', `<text class="chip-title" x="${chip.x + chip.w / 2}" y="${chip.y + 156}" text-anchor="middle">ESP32 · setup() · loop()</text>
    <text class="chip-sub" x="${chip.x + chip.w / 2}" y="${chip.y + 182}" text-anchor="middle">T-Display</text>
    <text class="chip-micro" x="${chip.x + chip.w / 2}" y="${chip.y + 221}" text-anchor="middle">READ · DECIDE · DRIVE</text>`);
  svg.append(chipGroup);

  const nodeLayer = document.createElementNS(NS, 'g');
  nodes.forEach((node) => {
    const box = positions.get(node.id);
    const group = document.createElementNS(NS, 'g');
    group.classList.add('flow-node', `side-${node.side}`);
    group.dataset.id = node.id;
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${node.label}, ${node.sub}`);
    const sub = /^GPIO\b/.test(node.sub) ? '' : node.sub;

    if (node.side === 'core') {
      // Core artwork sits behind the separately drawn wires and pin stubs.
      group.innerHTML = `<rect class="chip-hit" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="16"/>`;
    } else if (node.side === 'cloud') {
      group.innerHTML = `<path class="cloud-shape" d="M${box.x + 12} ${box.y + 42}h82a18 18 0 0 0 0-36 24 24 0 0 0-47-2 19 19 0 0 0-28 19 11 11 0 0 0-7 19Z"/>
        <text class="node-label cloud-label" x="${box.x + 53}" y="${box.y + 24}" text-anchor="middle">${node.label}</text>`;
    } else {
      const h = node.id === 'wifi' ? 52 : box.h;
      group.innerHTML = `<rect class="node-box" x="${box.x}" y="${box.y}" width="${box.w}" height="${h}" rx="9"/>
        <text class="node-label" x="${box.x + 12}" y="${box.y + (h === 52 ? 23 : 18)}">${node.label}</text>
        ${sub ? `<text class="node-sub" x="${box.x + 12}" y="${box.y + (h === 52 ? 42 : 34)}">${sub}</text>` : ''}`;
    }
    group.addEventListener('click', () => selectCallback(node.id));
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectCallback(node.id);
      }
    });
    nodeLayer.append(group);
  });
  svg.append(nodeLayer);

  // GPIO/peripheral labels sit on the wire near the processor edge.
  function addPill(text, x, y) {
    const width = Math.max(42, text.length * 7.2 + 14);
    const group = document.createElementNS(NS, 'g');
    group.classList.add('gpio-pill');
    group.innerHTML = `<rect x="${x - width / 2}" y="${y - 11}" width="${width}" height="22" rx="11"/><text x="${x}" y="${y + 4}" text-anchor="middle">${text}</text>`;
    svg.append(group);
  }
  inputNodes.forEach((node) => addPill(node.sub.replace(/^GPIO\s*/, 'G'), 340, inputPins.get(node.id)));
  outputNodes.forEach((node) => addPill(node.sub === 'SPI' ? 'SPI' : node.sub.replace(/^GPIO\s*/, 'G'), 676, outputPins.get(node.id)));
  addPill('Wi-Fi', 675, 371);
  addPill('command', 651, 398);

  const legend = document.createElementNS(NS, 'g');
  legend.classList.add('flow-legend');
  legend.innerHTML = `<circle class="legend-input" cx="34" cy="434" r="5"/><text x="46" y="438">input</text>
    <circle class="legend-output" cx="126" cy="434" r="5"/><text x="138" y="438">output</text>
    <circle class="legend-cloud" cx="232" cy="434" r="5"/><text x="244" y="438">cloud</text>
    <path class="legend-command" d="M326 434h36"/><text x="371" y="438">command from the web app</text>`;
  svg.append(legend);
  root.append(svg);

  let selectCallback = () => {};
  const active = new Map();
  function pulse(id, ms = 650) {
    const node = svg.querySelector(`[data-id="${CSS.escape(id)}"]`);
    const path = paths.get(id);
    const target = node || path;
    if (!target) return;
    target.classList.add(node ? 'pulsing' : 'bright');
    const previous = active.get(target);
    if (previous) {
      clearTimeout(previous.timer);
      if (previous.frame) cancelAnimationFrame(previous.frame);
      previous.dot?.remove();
    }
    const state = { timer: null, frame: null, dot: null };
    active.set(target, state);
    state.timer = setTimeout(() => {
      target.classList.remove(node ? 'pulsing' : 'bright');
      state.dot?.remove();
      active.delete(target);
    }, ms);
    if (!path || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '6');
    dot.setAttribute('class', 'flow-dot');
    svg.append(dot);
    state.dot = dot;
    const length = path.getTotalLength();
    const duration = Math.max(180, Math.min(1500, ms));
    let started;
    const animate = (now) => {
      if (!active.has(target)) return;
      if (started === undefined) started = now;
      const fraction = Math.min(1, (now - started) / duration);
      const point = path.getPointAtLength(length * fraction);
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
      if (fraction < 1) state.frame = requestAnimationFrame(animate);
    };
    state.frame = requestAnimationFrame(animate);
  }

  return {
    pulse,
    onSelect(callback) { selectCallback = typeof callback === 'function' ? callback : () => {}; },
    select(id) {
      svg.querySelectorAll('.flow-node').forEach((node) => node.classList.toggle('selected', node.dataset.id === id));
    },
  };
}
