const PALETTE = ['#ff4d4d', '#ff9f1c', '#ffd60a', '#3ddc84', '#2ec4b6', '#3a86ff', '#8338ec', '#ff5fa2'];

export function createDevice(root, { keyCount = 8, keyNames = [], keyColors = [] } = {}) {
  const count = Math.max(1, Math.min(8, keyCount));
  root.innerHTML = '';
  root.classList.add('hungry-simon');
  root.setAttribute('aria-label', 'Hungry Simon rhythm instrument');
  root.innerHTML = `
    <div class="hs-stage">
      <svg class="hs-art" viewBox="0 0 1000 625" role="img" aria-label="Illustrated plywood rhythm instrument with treat dispenser">
        <defs>
          <linearGradient id="birch" x2="0" y2="1"><stop stop-color="#f9dda9"/><stop offset=".55" stop-color="#e9bd7e"/><stop offset="1" stop-color="#dba96c"/></linearGradient>
          <linearGradient id="edge" x2="0" y2="1"><stop stop-color="#c58e54"/><stop offset="1" stop-color="#9d693c"/></linearGradient>
          <linearGradient id="screen" x2="0" y2="1"><stop stop-color="#202b3c"/><stop offset="1" stop-color="#101723"/></linearGradient>
          <pattern id="grain" width="150" height="34" patternUnits="userSpaceOnUse"><path d="M0 8 Q38 2 80 9 T150 7 M-20 24 Q30 18 70 25 T160 22" fill="none" stroke="#b77f48" stroke-opacity=".18" stroke-width="2"/></pattern>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#514331" flood-opacity=".22"/></filter>
        </defs>
        <ellipse cx="500" cy="570" rx="390" ry="25" fill="#715d46" opacity=".12"/>
        <g filter="url(#shadow)">
          <path d="M118 102 Q118 82 140 82 H814 L842 105 V506 Q842 526 820 526 H137 Q118 526 118 506Z" fill="url(#edge)" stroke="#1f2430" stroke-width="5"/>
          <path d="M132 87 H811 L829 105 V493 Q829 511 810 511 H145 Q132 511 132 493Z" fill="url(#birch)" stroke="#1f2430" stroke-width="4"/>
          <path d="M132 87 H811 L829 105 V493 Q829 511 810 511 H145 Q132 511 132 493Z" fill="url(#grain)"/>
          <!-- finger joints and engraved fasteners -->
          <g fill="#c58d53" stroke="#1f2430" stroke-width="2"><path d="M132 95h15v18h-15m682-18h15v18h-15M132 475h15v18h-15m682 0h15v18h-15"/></g>
          <g fill="#7f5738" stroke="#1f2430" stroke-width="1.5"><circle cx="158" cy="112" r="4"/><circle cx="802" cy="112" r="4"/><circle cx="158" cy="486" r="4"/><circle cx="802" cy="486" r="4"/></g>
          <path d="M210 188 Q210 174 225 174 H713 Q728 174 728 189 V300 H210Z" fill="#343a43" stroke="#1f2430" stroke-width="5"/>
          <path d="M225 188 Q225 186 230 186 H708 Q713 186 713 191 V285 H225Z" fill="url(#screen)" stroke="#111722" stroke-width="3"/>
          <text x="469" y="165" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="800" letter-spacing="3" fill="#715233">HUNGRY SIMON · PLAY &amp; LEARN</text>
          <!-- sensor module -->
          <g class="hs-sensor-art"><rect x="400" y="103" width="143" height="39" rx="10" fill="#344052" stroke="#1f2430" stroke-width="3"/><circle cx="430" cy="122" r="11" fill="#b7c4cf" stroke="#1f2430" stroke-width="3"/><circle cx="513" cy="122" r="11" fill="#b7c4cf" stroke="#1f2430" stroke-width="3"/><circle cx="430" cy="122" r="5" fill="#263343"/><circle cx="513" cy="122" r="5" fill="#263343"/></g>
          <!-- keys platform and speaker -->
          <path d="M170 328 Q170 315 184 315 H750 Q764 315 764 329 V446 H170Z" fill="#d7a96e" stroke="#1f2430" stroke-width="3"/>
          <g class="hs-grille" fill="#554531">${Array.from({length: 6}, (_,r)=>Array.from({length:8},(_,c)=>`<circle cx="${689+c*9+(r%2)*4}" cy="${349+r*10}" r="2.5"/>`).join('')).join('')}</g>
          <text x="722" y="421" text-anchor="middle" font-family="system-ui" font-size="10" font-weight="700" fill="#684d30">SPEAKER</text>
          <!-- status and power details -->
          <circle class="hs-power-dot" cx="190" cy="476" r="5" fill="#49d99a" stroke="#1f2430" stroke-width="2"/><text x="204" y="480" font-family="system-ui" font-size="10" fill="#654b32">POWER</text>
          <rect x="302" y="465" width="45" height="14" rx="7" fill="#303744" stroke="#1f2430" stroke-width="2"/><path d="M324 468v8" stroke="#e6c48f" stroke-width="2"/>
          <rect x="365" y="463" width="48" height="18" rx="5" fill="#303744" stroke="#1f2430" stroke-width="2"/><path d="M379 468h20v7h-20z" fill="#8392a3"/><text x="389" y="493" text-anchor="middle" font-family="system-ui" font-size="8" fill="#654b32">USB-C</text>
        </g>
        <!-- dispenser assembly -->
        <g class="hs-dispenser" filter="url(#shadow)">
          <path d="M843 168h105q14 0 14 14v167H843Z" fill="#e6c993" stroke="#1f2430" stroke-width="4"/>
          <rect x="856" y="183" width="78" height="112" rx="14" fill="#eff6ed" fill-opacity=".58" stroke="#1f2430" stroke-width="3"/>
          <path d="M865 202h60v83h-60Z" fill="#efc269" fill-opacity=".35"/>
          <rect x="850" y="169" width="91" height="20" rx="5" fill="#c68e54" stroke="#1f2430" stroke-width="3"/>
          <g class="hs-treat-stock"></g>
          <rect x="845" y="298" width="20" height="8" rx="4" fill="#354253"/><circle cx="851" cy="302" r="2" fill="#e66744"/><circle cx="859" cy="302" r="2" fill="#55c7d4"/>
          <rect x="867" y="316" width="76" height="61" rx="12" fill="#424955" stroke="#1f2430" stroke-width="4"/><text x="905" y="331" text-anchor="middle" font-family="system-ui" font-size="8" font-weight="800" fill="#f7d79d">SG90 · COVERED</text>
          <rect x="884" y="337" width="43" height="29" rx="6" fill="#222a35" stroke="#131923" stroke-width="2"/>
          <g class="hs-wheel"><circle cx="905" cy="351" r="10" fill="#e9b556" stroke="#f2d28e" stroke-width="2"/><path d="M905 341v20M895 351h20M898 344l14 14M912 344l-14 14" stroke="#5c452f" stroke-width="3"/></g>
          <path d="M853 376h84l25 57h-32l-25-30h-40Z" fill="#bd8950" stroke="#1f2430" stroke-width="4"/>
          <path d="M878 402l45 30" stroke="#f4d7a7" stroke-width="4" opacity=".8"/>
          <path d="M893 434q0-19 29-19t29 19v12q0 12-29 12t-29-12Z" fill="#f1d8a7" stroke="#1f2430" stroke-width="3"/><ellipse cx="922" cy="434" rx="29" ry="10" fill="#fff0ce" stroke="#1f2430" stroke-width="3"/><g class="hs-bowl"></g>
        </g>
        <g class="hs-sonar" fill="none" stroke="#ff6a1a" stroke-width="3" opacity="0"><path d="M378 116q-17 7-17 15t17 15M556 116q17 7 17 15t-17 15"/><path d="M365 108q-29 23 0 47M569 108q29 23 0 47"/></g>
        <g class="hs-person" opacity="0"><circle cx="757" cy="108" r="12" fill="#ffcf91" stroke="#1f2430" stroke-width="2"/><path d="M744 123q13-7 26 0l6 33h-38Z" fill="#ff8a4b" stroke="#1f2430" stroke-width="2"/><path d="M746 155l-7 22m26-22 7 22" stroke="#1f2430" stroke-width="5" stroke-linecap="round"/><path d="M742 128l-12 18m39-18 11 17" stroke="#1f2430" stroke-width="4" stroke-linecap="round"/></g>
      </svg>
      <div class="hs-screen"><canvas width="480" height="160" aria-label="Game display"></canvas></div>
      <div class="hs-keys" role="group" aria-label="Musical keys"></div>
      <button class="hs-presence-hit" type="button" aria-label="Toggle presence sensor"></button>
      <div class="hs-sleep" aria-hidden="true">zZ</div>
      <div class="hs-treat-fly" aria-hidden="true">●</div>
    </div>`;
  const stage = root.querySelector('.hs-stage');
  const canvas = root.querySelector('canvas');
  const keyWrap = root.querySelector('.hs-keys');
  const keys = [];
  const ledState = Array.from({ length: count }, () => ({ color: null, intensity: 0 }));
  const pressed = new Set();
  let keyInput = () => {}, presenceCb = () => {}, petMode = false, awake = true, volume = 1, treatLevel = 1, dispenseBusy = false;
  const stock = root.querySelector('.hs-treat-stock');
  const bowl = root.querySelector('.hs-bowl');
  const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const stockTreats = () => {
    stock.innerHTML = '';
    const n = Math.round(treatLevel * 12);
    for (let i=0;i<n;i++) {
      const x=872+(i%4)*14, y=275-Math.floor(i/4)*21;
      stock.insertAdjacentHTML('beforeend', `<circle cx="${x}" cy="${y}" r="6.5" fill="${['#f4a65a','#f7c66e','#d98b4d'][i%3]}" stroke="#8b5b37" stroke-width="1.5"/>`);
    }
  };
  const bowlTreats = [];
  const drawBowl = () => { bowl.innerHTML = bowlTreats.slice(-5).map((_,i)=>`<circle cx="${905+i*8}" cy="${439-(i%2)*5}" r="5" fill="#f1ad58" stroke="#8b5b37" stroke-width="1.3" opacity="${i<5?1:.25}"/>`).join(''); };
  const updateLed = i => {
    const s=ledState[i], el=keys[i]; if(!el) return;
    const c=s.color, a=s.intensity;
    el.style.setProperty('--led-color', c || '#ffbd61');
    el.style.setProperty('--led-alpha', c ? String(.22 + .78*a) : '.16');
    el.classList.toggle('lit', !!c && awake);
    el.classList.toggle('dim', !awake);
  };
  for(let i=0;i<count;i++) {
    const k=document.createElement('button'); k.type='button'; k.className='hs-key';
    k.dataset.index=String(i); k.style.setProperty('--key-color',keyColors[i]||PALETTE[i]||'#888');
    k.innerHTML=`<span class="hs-key-led"></span><span class="hs-key-label">${escapeHtml(keyNames[i]||['Do','Re','Mi','Fa','Sol','La','Si',"Do′"][i])}</span>`;
    k.setAttribute('aria-label', `${keyNames[i]||`Key ${i+1}`}`);
    const down=e=>{e.preventDefault(); if(!awake||pressed.has(e.pointerId)) return; pressed.add(e.pointerId); k.setPointerCapture?.(e.pointerId); k.classList.add('down'); keyInput(petMode?i-i%2:i,true);};
    const up=e=>{if(!pressed.has(e.pointerId))return; pressed.delete(e.pointerId); k.classList.remove('down'); keyInput(petMode?i-i%2:i,false);};
    k.addEventListener('pointerdown',down); k.addEventListener('pointerup',up); k.addEventListener('pointercancel',up);
    k.addEventListener('lostpointercapture',up); k.addEventListener('pointerleave',e=>{if(pressed.has(e.pointerId))up(e);});
    keyWrap.append(k); keys.push(k);
  }
  const presenceHit=root.querySelector('.hs-presence-hit');
  presenceHit.addEventListener('click',()=>presenceCb());
  stockTreats(); drawBowl();
  return {
    onKeyInput(cb) { keyInput=typeof cb==='function'?cb:()=>{}; },
    pressKey(index,isDown) { for(const j of indices(index,petMode,count)) keys[j]?.classList.toggle('down',!!isDown); },
    setKeyLed(index,color,intensity=1) { for(const j of indices(index,petMode,count)){ledState[j]={color:color||null,intensity:clamp(intensity)};updateLed(j);} },
    flashAll(color,ms=300) { const old=ledState.map(s=>({...s})); ledState.forEach((s,i)=>{s.color=color||'#fff';s.intensity=1;updateLed(i);}); setTimeout(()=>{ledState.forEach((s,i)=>{ledState[i]=old[i];updateLed(i);});},Math.max(0,ms)); },
    getDisplayCanvas() { return canvas; },
    setPresence(isPresent) { root.classList.toggle('present',!!isPresent); },
    onPresenceToggle(cb) { presenceCb=typeof cb==='function'?cb:()=>{}; },
    setAwake(isAwake) { awake=!!isAwake; root.classList.toggle('asleep',!awake); keys.forEach((_,i)=>updateLed(i)); if(awake){root.classList.add('waking');setTimeout(()=>root.classList.remove('waking'),650);} },
    setTreatLevel(level) { treatLevel=clamp(level);stockTreats(); },
    dispense() { if(dispenseBusy)return Promise.resolve(); dispenseBusy=true; root.classList.add('dispensing'); const fly=root.querySelector('.hs-treat-fly'); fly.classList.remove('drop'); void fly.offsetWidth; fly.classList.add('drop'); return new Promise(resolve=>setTimeout(()=>{root.classList.remove('dispensing');fly.classList.remove('drop');bowlTreats.push(Date.now());drawBowl();dispenseBusy=false;resolve();},1000)); },
    setPetMode(isPet) { petMode=!!isPet;root.classList.toggle('pet-mode',petMode); },
    setVolume(v) { volume=clamp(v);root.style.setProperty('--speaker-volume',String(volume)); },
    pulseSpeaker() { root.classList.remove('speaker-pulse');void stage.offsetWidth;root.classList.add('speaker-pulse');setTimeout(()=>root.classList.remove('speaker-pulse'),450); },
  };
}
function indices(i,pet,count){const n=Math.max(0,Math.min(count-1,Math.trunc(i)||0));return pet?[n-n%2,Math.min(count-1,n-n%2+1)]:[n];}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
