const PALETTE = ['#ff4d4d', '#ff9f1c', '#ffd60a', '#3ddc84', '#2ec4b6', '#3a86ff', '#8338ec', '#ff5fa2'];
const VIEW = { w: 1100, h: 780, screen: { x: 220, y: 142, w: 440, h: 330 }, keys: { x: 155, y: 490, w: 590, h: 108 } };
const pct = (v, axis) => `${v / VIEW[axis] * 100}%`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createDevice(root, { keyCount = 8, keyNames = [], keyColors = [] } = {}) {
  const count = Math.max(1, Math.min(8, keyCount));
  root.innerHTML = '';
  root.classList.add('hungry-simon');
  root.innerHTML = `<div class="hs-stage"><svg class="hs-art" viewBox="0 0 1100 780" role="img" aria-label="Hungry Simon plywood rhythm instrument and treat dispenser">
  <defs>
    <linearGradient id="birch" x2="0" y2="1"><stop stop-color="#f9dda9"/><stop offset="1" stop-color="#dba96c"/></linearGradient>
    <linearGradient id="edge" x2="0" y2="1"><stop stop-color="#c58e54"/><stop offset="1" stop-color="#9d693c"/></linearGradient>
    <linearGradient id="displayPcb" x2="1" y2="1"><stop stop-color="#df3e45"/><stop offset="1" stop-color="#294c93"/></linearGradient>
    <pattern id="grain" width="150" height="34" patternUnits="userSpaceOnUse"><path d="M0 8Q38 2 80 9T150 7M-20 24Q30 18 70 25T160 22" fill="none" stroke="#b77f48" stroke-opacity=".18" stroke-width="2"/></pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#514331" flood-opacity=".2"/></filter>
  </defs>
  <ellipse cx="510" cy="744" rx="420" ry="20" fill="#715d46" opacity=".12"/>
  <g filter="url(#shadow)"><path d="M105 88Q105 68 128 68H775l30 24v620q0 21-22 21H126q-21 0-21-21Z" fill="url(#edge)" stroke="#1f2430" stroke-width="5"/><path d="M120 74H773l18 18v614q0 18-19 18H139q-19 0-19-18Z" fill="url(#birch)" stroke="#1f2430" stroke-width="4"/><path d="M120 74H773l18 18v614q0 18-19 18H139q-19 0-19-18Z" fill="url(#grain)"/>
  <text x="450" y="112" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="3" fill="#715233">HUNGRY SIMON · PLAY &amp; LEARN</text>
  <!-- ILI9341 module: red/blue PCB, 4:3 glass and short-side pin header. -->
  <g class="part-display"><rect x="205" y="120" width="470" height="383" rx="12" fill="url(#displayPcb)" stroke="#1f2430" stroke-width="4"/><rect x="220" y="142" width="440" height="330" rx="4" fill="#101723" stroke="#26313e" stroke-width="4"/><g fill="#d9c79a"><circle cx="217" cy="132" r="4"/><circle cx="663" cy="132" r="4"/><circle cx="217" cy="492" r="4"/><circle cx="663" cy="492" r="4"/></g><g fill="#d6bd75" stroke="#344054" stroke-width="1">${Array.from({length:14},(_,i)=>`<rect x="275" y="489" width="7" height="20" rx="1" transform="translate(${i*17} 0)"/>`).join('')}</g><text x="440" y="138" text-anchor="middle" font-size="8" font-weight="800" fill="#f5dfc3">ILI9341 · SPI</text></g>
  <!-- Presence sensor. -->
  <g class="part-pir"><rect x="390" y="80" width="112" height="53" rx="8" fill="#397346" stroke="#1f2430" stroke-width="3"/><circle cx="446" cy="103" r="23" fill="#f4f0dd" stroke="#1f2430" stroke-width="3"/><path d="M425 103q21-22 42 0-21 22-42 0M431 91q15 12 0 24m30-24q-15 12 0 24" fill="none" stroke="#d6d0bc" stroke-width="2"/><text x="446" y="129" text-anchor="middle" font-size="7" fill="#fff">PIR</text></g>
  <!-- Separate DOIT DevKit V1 with shield, USB and labelled controls. -->
  <g class="part-esp32" transform="translate(95 232) scale(.68)"><rect x="229" y="566" width="255" height="103" rx="9" fill="#174c3c" stroke="#1f2430" stroke-width="3"/><g fill="#d3b66c">${Array.from({length:15},(_,i)=>`<rect x="242" y="575" width="5" height="18" rx="1" transform="translate(${i*14} 0)"/><rect x="242" y="643" width="5" height="18" rx="1" transform="translate(${i*14} 0)"/>`).join('')}</g><rect x="291" y="589" width="133" height="54" rx="5" fill="#aeb7bc" stroke="#303b43" stroke-width="2"/><text x="357" y="612" text-anchor="middle" font-size="11" font-weight="800" fill="#29343b">ESP-WROOM-32</text><text x="357" y="629" text-anchor="middle" font-size="8" fill="#3b464c">DOIT · 4 MB</text><path d="M322 588v-8h70v8" fill="none" stroke="#30404b" stroke-width="2"/><rect x="336" y="666" width="37" height="12" rx="3" fill="#bbc1c5" stroke="#1f2430" stroke-width="2"/><text x="354" y="690" text-anchor="middle" font-size="7" font-weight="700" fill="#654b32">micro-USB</text><rect x="260" y="600" width="18" height="10" rx="3" fill="#242b34"/><text x="269" y="598" text-anchor="middle" font-size="7" fill="#fff">EN</text></g>
  <g class="part-buttons" transform="translate(95 232) scale(.68)"><rect x="438" y="600" width="18" height="10" rx="3" fill="#252b33" stroke="#bec4c5"/><text x="447" y="598" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">BOOT</text><text x="447" y="620" text-anchor="middle" font-size="7" fill="#f3ddb8">MODE</text></g>
  <g class="part-wifi" transform="translate(95 232) scale(.68)" fill="none" stroke="#ff6a1a" stroke-width="2"><path d="M440 575q18-17 36 0M445 581q13-12 26 0M452 587q6-6 12 0"/><circle cx="458" cy="591" r="2" fill="#ff6a1a"/></g>
  <!-- Amplifier and speaker enclosure. -->
  <g class="part-amp"><rect x="534" y="570" width="95" height="56" rx="5" fill="#593b82" stroke="#1f2430" stroke-width="3"/><rect x="556" y="580" width="42" height="24" rx="3" fill="#252b33"/><text x="581" y="616" text-anchor="middle" font-size="8" font-weight="800" fill="#f3e5ff">MAX98357A</text><circle cx="545" cy="580" r="3" fill="#dfc46d"/><circle cx="618" cy="615" r="3" fill="#dfc46d"/></g>
  <g class="part-speaker hs-grille"><circle cx="690" cy="625" r="47" fill="#594831" stroke="#1f2430" stroke-width="4"/><circle cx="690" cy="625" r="38" fill="#252b32" stroke="#b18b59" stroke-width="2"/>${Array.from({length:7},(_,r)=>Array.from({length:9},(_,c)=>`<circle cx="${660+c*7.5}" cy="${601+r*7.5}" r="1.8"/>`).join('')).join('')}<text x="690" y="682" text-anchor="middle" font-size="8" font-weight="800" fill="#684d30">40 mm · 4 Ω</text></g>
  <!-- Power assembly: 2S holder, charger, buck and rocker. -->
  <g class="part-power"><rect x="165" y="685" width="232" height="37" rx="7" fill="#29323a" stroke="#1f2430" stroke-width="3"/><rect x="176" y="690" width="86" height="27" rx="8" fill="#35734e" stroke="#18231d" stroke-width="2"/><rect x="270" y="690" width="86" height="27" rx="8" fill="#386c9b" stroke="#18231d" stroke-width="2"/><text x="219" y="708" text-anchor="middle" font-size="8" font-weight="800" fill="#eff3e8">18650</text><text x="313" y="708" text-anchor="middle" font-size="8" font-weight="800" fill="#eff3e8">18650</text><rect x="409" y="689" width="68" height="30" rx="4" fill="#537b55" stroke="#1f2430" stroke-width="2"/><text x="443" y="702" text-anchor="middle" font-size="6" font-weight="800" fill="#fff">USB-C 2S</text><text x="443" y="711" text-anchor="middle" font-size="6" fill="#fff">CHARGER</text><rect x="487" y="689" width="73" height="30" rx="4" fill="#278c83" stroke="#1f2430" stroke-width="2"/><rect x="510" y="693" width="25" height="12" rx="2" fill="#b5c1b6"/><text x="523" y="714" text-anchor="middle" font-size="6" font-weight="800" fill="#fff">5 V · 5 A BUCK</text><rect x="586" y="688" width="37" height="28" rx="5" fill="#252b34" stroke="#1f2430" stroke-width="2"/><path d="M592 694h25v15q-12 7-25 0Z" fill="#e14b42"/><text x="605" y="727" text-anchor="middle" font-size="6" font-weight="800" fill="#654b32">POWER</text></g>
  <!-- Chute and treat reservoir. -->
  <path d="M800 150h185q17 0 17 17v180H800Z" fill="#e6c993" stroke="#1f2430" stroke-width="4"/><rect x="819" y="171" width="145" height="117" rx="14" fill="#eff6ed" fill-opacity=".58" stroke="#1f2430" stroke-width="3"/><path d="M831 190h121v88H831Z" fill="#efc269" fill-opacity=".35"/><rect x="810" y="151" width="165" height="21" rx="5" fill="#c68e54" stroke="#1f2430" stroke-width="3"/><g class="hs-treat-stock"></g>
  <g class="part-irLevel"><rect x="807" y="247" width="19" height="10" rx="2" fill="#263d3a" stroke="#1f2430"/><circle cx="812" cy="252" r="2" fill="#ff6a1a"/><text x="835" y="255" font-size="7" fill="#654b32">IR LEVEL</text></g>
  <rect x="832" y="332" width="122" height="68" rx="12" fill="#424955" stroke="#1f2430" stroke-width="4"/><text x="893" y="347" text-anchor="middle" font-size="8" font-weight="800" fill="#f7d79d">MG90S · COVERED</text><g class="hs-wheel"><circle cx="893" cy="371" r="15" fill="#e9b556" stroke="#f2d28e" stroke-width="2"/><path d="M893 356v30m-15-15h30m-26-11 22 22m0-22-22 22" stroke="#5c452f" stroke-width="3"/></g><path d="M820 400h146l34 67h-45l-31-36h-72Z" fill="#bd8950" stroke="#1f2430" stroke-width="4"/><path d="M860 419l58 40" stroke="#f4d7a7" stroke-width="4"/><g class="part-irDrop"><rect x="906" y="462" width="20" height="9" rx="2" fill="#263d3a" stroke="#1f2430"/><circle cx="922" cy="466" r="2" fill="#ff6a1a"/><text x="935" y="474" font-size="7" fill="#654b32">IR DROP</text></g><g class="part-treatLight"><circle class="treat-light-spill" cx="927" cy="488" r="24"/><g class="treat-led-stick">${Array.from({length:8},(_,i)=>`<rect class="treat-led" x="892" y="480" width="8" height="8" rx="1" transform="translate(${i*9} 0)"/>`).join('')}</g></g>
  <!-- VL53L7CX faces downward; broad fan shows its 60 degree multizone field. -->
  <g class="part-tof"><path class="tof-beam" d="M878 506L820 665Q927 704 1034 665L976 506Z"/><g class="tof-grid"><path d="M878 506L820 665M892 506L872 679M906 506L901 688M920 506L927 693M934 506L953 688M948 506L988 679M976 506L1034 665M842 606Q927 634 1012 606M832 634Q927 666 1022 634M827 650Q927 684 1027 650"/></g><rect x="895" y="493" width="64" height="22" rx="4" fill="#55408d" stroke="#20202a" stroke-width="2"/><rect x="918" y="497" width="20" height="12" rx="2" fill="#141923"/><text x="927" y="490" text-anchor="middle" font-size="6" font-weight="800" fill="#e9ddff">VL53L7CX 8×8</text></g>
  <g class="part-bowl"><ellipse cx="932" cy="710" rx="68" ry="15" fill="#d2a66e" stroke="#1f2430" stroke-width="3"/><path d="M866 708q8 35 66 35t66-35" fill="#e7c68f" stroke="#1f2430" stroke-width="3"/><g class="hs-bowl"></g></g>
  <g class="hs-sonar" fill="none" stroke="#ff6a1a" stroke-width="3" opacity="0"><path d="M378 88q-17 16 0 32m136-32q17 16 0 32m-148-40q-29 24 0 48m160-48q29 24 0 48"/></g><g class="hs-person" opacity="0"><circle cx="735" cy="104" r="12" fill="#ffcf91" stroke="#1f2430" stroke-width="2"/><path d="M722 119q13-7 26 0l6 33h-38Z" fill="#ff8a4b" stroke="#1f2430" stroke-width="2"/></g></g></svg>
  <div class="hs-screen"><canvas width="320" height="240" aria-label="Game display"></canvas></div><div class="hs-keys" role="group" aria-label="Musical keys"></div><button class="hs-hand-hit" type="button" aria-label="Hold hand under the dispenser">✋</button><span class="hs-hand" aria-hidden="true">🤲</span><span class="hs-mm" aria-hidden="true">180 mm</span><button class="hs-presence-hit" aria-label="Toggle presence sensor" type="button"></button><span class="hs-sleep" aria-hidden="true">z Z</span><span class="hs-treat-fly" aria-hidden="true">●</span><div class="hs-part-hits"></div></div>`;

  const stage = root.querySelector('.hs-stage');
  const canvas = root.querySelector('canvas');
  const keyWrap = root.querySelector('.hs-keys');
  const keys = [];
  const sticks = [];
  const states = Array.from({ length: count }, () => ({ color: null, intensity: 0 }));
  const pressed = new Set();
  const pos = (el, r) => { el.style.left = pct(r.x, 'w'); el.style.top = pct(r.y, 'h'); el.style.width = pct(r.w, 'w'); el.style.height = pct(r.h, 'h'); };
  pos(root.querySelector('.hs-screen'), VIEW.screen);
  pos(keyWrap, VIEW.keys);
  let input = () => {}, presence = () => {}, partCb = () => {}, handCb = () => {};
  let pet = false, awake = true, level = 1, busy = false, handPresent = false, treats = 0;
  const stock = root.querySelector('.hs-treat-stock');
  const update = i => {
    const key = keys[i], stick = sticks[i], state = states[i];
    if (!key) return;
    key.style.setProperty('--led-color', state.color || '#252a31');
    key.style.setProperty('--led-strength', String(state.intensity));
    key.classList.toggle('lit', !!state.color && awake);
    key.classList.toggle('dim', !awake);
    stick.querySelectorAll('.key-led').forEach(led => {
      led.style.setProperty('--led-color', state.color || '#252a31');
      led.style.opacity = state.color && awake ? String(.18 + .82 * state.intensity) : '.2';
      led.style.filter = state.color && awake ? `drop-shadow(0 0 4px ${state.color})` : 'none';
    });
  };
  const stockDraw = () => {
    stock.innerHTML = '';
    for (let i = 0; i < Math.round(level * 12); i++) stock.insertAdjacentHTML('beforeend', `<circle cx="${850 + i % 5 * 20}" cy="${273 - Math.floor(i / 5) * 20}" r="7" fill="${['#f4a65a', '#f7c66e', '#d98b4d'][i % 3]}" stroke="#8b5b37" stroke-width="1.5"/>`);
  };
  for (let i = 0; i < count; i++) {
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'hs-key'; key.dataset.index = i;
    key.style.setProperty('--key-color', keyColors[i] || PALETTE[i]);
    key.innerHTML = `<span class="hs-key-led"></span><span class="hs-key-paw" aria-hidden="true">✦</span><span class="hs-key-label">${esc(keyNames[i] || ['Do','Re','Mi','Fa','Sol','La','Si',"Do′"][i])}</span>`;
    key.setAttribute('aria-label', keyNames[i] || `Key ${i + 1}`);
    const down = e => { e.preventDefault(); if (!awake || pressed.has(e.pointerId)) return; pressed.add(e.pointerId); key.setPointerCapture?.(e.pointerId); key.classList.add('down'); input(pet ? i - i % 2 : i, true); };
    const up = e => { if (!pressed.has(e.pointerId)) return; pressed.delete(e.pointerId); key.classList.remove('down'); input(pet ? i - i % 2 : i, false); };
    key.addEventListener('pointerdown', down);
    ['pointerup','pointercancel','lostpointercapture','pointerleave'].forEach(ev => key.addEventListener(ev, up));
    keyWrap.append(key); keys.push(key);
    const strip = document.createElement('div'); strip.className = 'hs-key-stick'; strip.setAttribute('aria-hidden', 'true');
    strip.innerHTML = Array.from({ length: 8 }, () => '<i class="key-led"></i>').join('');
    key.append(strip); sticks.push(strip);
  }
  const parts = {
    tof: ['VL53L7CX ToF sensor', { x: 895, y: 485, w: 64, h: 34 }], treatLight: ['Chute LED stick', { x: 890, y: 478, w: 78, h: 17 }],
    esp32: ['DOIT ESP32 DevKit V1', { x: 250, y: 610, w: 174, h: 74 }], display: ['ILI9341 display', { x: 205, y: 120, w: 470, h: 383 }],
    pir: ['PIR sensor', { x: 390, y: 80, w: 112, h: 53 }], speaker: ['40 mm speaker', { x: 642, y: 575, w: 96, h: 113 }], amp: ['MAX98357A amplifier', { x: 530, y: 567, w: 103, h: 64 }],
    servo: ['MG90S covered servo', { x: 832, y: 332, w: 122, h: 68 }], irLevel: ['IR level sensor', { x: 806, y: 244, w: 65, h: 18 }], irDrop: ['IR drop sensor', { x: 903, y: 458, w: 67, h: 19 }],
    power: ['2S battery, charger, buck and switch', { x: 160, y: 681, w: 466, h: 48 }], buttons: ['BOOT button · mode / difficulty', { x: 450, y: 635, w: 13, h: 17 }],
    wifi: ['Wi-Fi antenna', { x: 394, y: 622, w: 29, h: 20 }], keys: ['Keys', { x: 395, y: 686, w: 90, h: 18 }], leds: ['Key LED sticks', { x: 496, y: 686, w: 90, h: 18 }],
  };
  const hitBox = root.querySelector('.hs-part-hits');
  for (const [id, [name, rect]] of Object.entries(parts)) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `hs-part-hit part-${id}`;
    button.setAttribute('aria-label', name); button.title = name;
    if (id === 'keys' || id === 'leds') { button.textContent = name; button.classList.add('hs-label-hit'); }
    button.addEventListener('click', () => id === 'pir' ? presence() : partCb(id));
    pos(button, rect); hitBox.append(button);
  }
  root.querySelector('.hs-hand-hit').addEventListener('click', () => handCb());
  root.querySelector('.hs-presence-hit').addEventListener('click', () => presence());
  stockDraw();
  return {
    onKeyInput(cb) { input = typeof cb === 'function' ? cb : () => {}; },
    pressKey(i, down) { for (const j of idx(i, pet, count)) keys[j]?.classList.toggle('down', !!down); },
    setKeyLed(i, color, intensity = 1) { for (const j of idx(i, pet, count)) { states[j] = { color: color || null, intensity: clamp(intensity) }; update(j); } },
    flashAll(color, ms = 300) { const old = states.map(s => ({ ...s })); states.forEach((_, i) => { states[i] = { color: color || '#fff', intensity: 1 }; update(i); }); setTimeout(() => old.forEach((s, i) => { states[i] = s; update(i); }), ms); },
    getDisplayCanvas() { return canvas; },
    setPresence(value) { root.classList.toggle('present', !!value); },
    onPresenceToggle(cb) { presence = typeof cb === 'function' ? cb : () => {}; },
    setAwake(value) { awake = !!value; root.classList.toggle('asleep', !awake); keys.forEach((_, i) => update(i)); if (awake) { root.classList.add('waking'); setTimeout(() => root.classList.remove('waking'), 750); } },
    setTreatLevel(value) { level = clamp(value); stockDraw(); },
    setHand(value) { handPresent = !!value; root.classList.toggle('hand-present', handPresent); if (!handPresent) root.querySelector('.hs-treat-fly').classList.remove('treat-in-hand'); },
    onHandToggle(cb) { handCb = typeof cb === 'function' ? cb : () => {}; },
    setTofReading(mm, isHand = false) { const length = Math.max(0, Math.min(180, Number(mm) || 0)) / 180 * 140; const beam = root.querySelector('.tof-beam'); beam.setAttribute('d', `M878 506L${820 - length * .1} ${665 + length * .1}Q927 ${704 + length} ${1034 + length * .1} ${665 + length * .1}L976 506Z`); beam.classList.toggle('hand-detected', !!isHand); const tag = root.querySelector('.hs-mm'); tag.textContent = `${Math.round(Number(mm) || 0)} mm`; tag.classList.toggle('hand-detected', !!isHand); },
    setTreatLight(color, mode = 'solid') { root.querySelectorAll('.treat-led').forEach(led => { led.style.fill = color || '#555'; led.classList.toggle('light-pulse', !!color && mode === 'pulse'); }); const spill = root.querySelector('.treat-light-spill'); spill.style.fill = color || 'transparent'; spill.classList.toggle('spill-on', !!color); },
    dispense(options = {}) { if (busy) return Promise.resolve(); busy = true; root.classList.add('dispensing'); const intoHand = !!options.intoHand, fly = root.querySelector('.hs-treat-fly'); fly.classList.toggle('into-hand', intoHand); fly.classList.remove('drop'); void fly.offsetWidth; fly.classList.add('drop'); return new Promise(resolve => setTimeout(() => { root.classList.remove('dispensing'); fly.classList.remove('drop'); if (intoHand && handPresent) fly.classList.add('treat-in-hand'); else { fly.classList.remove('treat-in-hand'); treats++; root.querySelector('.hs-bowl').innerHTML = Array.from({ length: Math.min(5, treats) }, (_, i) => `<circle cx="${900 + i * 12}" cy="${706 - i % 2 * 5}" r="5" fill="#f1ad58" stroke="#8b5b37"/>`).join(''); } busy = false; resolve(); }, 1050)); },
    setPetMode(value) { pet = !!value; root.classList.toggle('pet-mode', pet); },
    setVolume(value) { root.style.setProperty('--speaker-volume', String(clamp(value))); },
    pulseSpeaker() { root.classList.remove('speaker-pulse'); void stage.offsetWidth; root.classList.add('speaker-pulse'); setTimeout(() => root.classList.remove('speaker-pulse'), 450); },
    onPartClick(cb) { partCb = typeof cb === 'function' ? cb : () => {}; },
    highlightPart(id) { const alias = id === 'battery' ? 'power' : id; root.querySelectorAll('.hs-part-hit').forEach(hit => hit.classList.toggle('highlight', hit.classList.contains(`part-${alias}`))); root.querySelectorAll('[class*="part-"]').forEach(el => el.classList.toggle('part-highlight', el.classList.contains(`part-${alias}`))); },
  };
}

function clamp(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
function idx(i, pet, count) { const n = Math.max(0, Math.min(count - 1, Math.trunc(i) || 0)); return pet ? [n - n % 2, Math.min(count - 1, n - n % 2 + 1)] : [n]; }
