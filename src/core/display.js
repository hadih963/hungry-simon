// Renders the device's display (480x160) — falling notes, Simon status, free-play trail.
import { KEY_COLORS, KEY_NAMES, PET_KEYS } from './notes.js';
import { FALL_MS } from './game.js';

const W = 480;
const H = 160;
const HUD = 18;          // top status bar height
const HIT_Y = 138;       // hit line
const MODE_LABEL = { free: 'FREE PLAY', simon: 'SIMON SAYS', song: 'SONG', pet: 'PET MODE' };

export function createDisplay(canvas, game, getDevice) {
  const ctx = canvas.getContext('2d');
  let lastFrame = performance.now();
  let fps = 60;

  const lanes = () => (game.mode === 'pet' ? PET_KEYS : [0, 1, 2, 3, 4, 5, 6, 7]);
  const laneOf = (k) => (game.mode === 'pet' ? PET_KEYS.indexOf(k) : k);

  function text(str, x, y, { size = 12, color = '#e9eef7', align = 'left', weight = 700 } = {}) {
    ctx.font = `${weight} ${size}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function render(now) {
    const dt = now - lastFrame;
    lastFrame = now;
    if (dt > 0) fps = fps * 0.92 + (1000 / dt) * 0.08;

    const dev = getDevice();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, H);

    if (!dev.awake) return drawSleep(now);

    const ls = lanes();
    const laneW = W / ls.length;

    // lanes
    ls.forEach((k, i) => {
      ctx.fillStyle = i % 2 ? '#10172b' : '#0d1426';
      ctx.fillRect(i * laneW, HUD, laneW, H - HUD);
      const held = game.held.has(k);
      ctx.globalAlpha = held ? 1 : 0.45;
      ctx.fillStyle = KEY_COLORS[k];
      ctx.fillRect(i * laneW + 2, HIT_Y + 4, laneW - 4, H - HIT_Y - 6);
      ctx.globalAlpha = 1;
      text(game.mode === 'pet' ? '●' : KEY_NAMES[k], i * laneW + laneW / 2, HIT_Y + 12, { size: 9, color: '#0b1020' });
      if (held) {
        const g = ctx.createLinearGradient(0, HIT_Y, 0, HUD);
        g.addColorStop(0, KEY_COLORS[k] + '66');
        g.addColorStop(1, KEY_COLORS[k] + '00');
        ctx.fillStyle = g;
        ctx.fillRect(i * laneW, HUD, laneW, HIT_Y - HUD);
      }
    });

    if (game.mode === 'song' && game.chart) drawSong(now, laneW);
    else if (game.isSimon) drawSimon(now, laneW);
    else drawFree(now, laneW);

    // hit line
    ctx.fillStyle = '#ffffffcc';
    ctx.fillRect(0, HIT_Y, W, 2);

    drawHud(dev);
    if (dev.offer) drawOffer(now);
    drawMessages(now);
    text(`${Math.round(fps)} Hz`, W - 4, H - 6, { size: 7, color: '#ffffff55', align: 'right', weight: 400 });
  }

  function drawHud(dev) {
    ctx.fillStyle = '#060912';
    ctx.fillRect(0, 0, W, HUD);
    text(MODE_LABEL[game.mode], 6, HUD / 2, { size: 10, color: '#ff8a3d' });
    let mid = game.player;
    if (game.mode === 'song' && game.song) mid = game.song.title;
    if (game.isSimon && game.seq?.length) mid = `${game.seq.length}/${game.goal} notes`;
    text(mid, W / 2, HUD / 2, { size: 9, color: '#c7d0e0', align: 'center', weight: 500 });
    const treat = `🍬${dev.treatsToday}/${dev.dailyLimit}`;
    text(`${treat}  ${String(game.score).padStart(5, '0')}`, W - 6, HUD / 2, { size: 10, align: 'right' });
  }

  function drawSong(now, laneW) {
    const t = now - game.songStart;
    const pxPerMs = (HIT_Y - HUD) / FALL_MS;
    game.chart.forEach((n, i) => {
      const dtHead = n.t - t;
      if (dtHead > FALL_MS + 50) return;
      const y = HIT_Y - dtHead * pxPerMs;
      const len = Math.max(8, n.dur * pxPerMs * 0.82);
      if (y - len > H) return;
      const x = laneOf(n.key) * laneW;
      ctx.globalAlpha = n.hit ? Math.max(0, 1 - (t - n.t) / 300) : 1;
      if (ctx.globalAlpha <= 0) { ctx.globalAlpha = 1; return; }
      ctx.fillStyle = KEY_COLORS[n.key];
      roundRect(x + 6, y - len, laneW - 12, len, 5);
      ctx.fill();
      if (i === game.idx && !n.hit) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    if (game.state === 'countin' && game.countBeat > 0 && t < 0) {
      text(String(game.countBeat), W / 2, 72, { size: 44, color: '#ffffffdd', align: 'center', weight: 800 });
    }
    if (game.state === 'won') {
      text('SONG COMPLETE', W / 2, 62, { size: 22, color: '#3ddc84', align: 'center', weight: 800 });
      text(`avg timing ±${game.avgOffsetMs} ms · press a key to replay`, W / 2, 90, { size: 10, align: 'center', weight: 500 });
    }
    // progress bar
    const p = game.idx / game.chart.length;
    ctx.fillStyle = '#ffffff22';
    ctx.fillRect(0, HUD, W, 2);
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(0, HUD, W * p, 2);
  }

  function drawSimon(now, laneW) {
    if (game.lit !== null && game.lit !== undefined) {
      const i = laneOf(game.lit);
      const g = ctx.createLinearGradient(0, HIT_Y, 0, HUD);
      g.addColorStop(0, KEY_COLORS[game.lit] + 'cc');
      g.addColorStop(1, KEY_COLORS[game.lit] + '11');
      ctx.fillStyle = g;
      ctx.fillRect(i * laneW, HUD, laneW, HIT_Y - HUD);
    }
    const label = { ready: 'GET READY', watch: 'WATCH & LISTEN', input: 'YOUR TURN!', done: '', fail: '', won: '' }[game.state] || '';
    if (label) text(label, W / 2, 46, { size: 18, align: 'center', weight: 800, color: game.state === 'input' ? '#ffd60a' : '#e9eef7' });
    // progress dots
    const n = game.seq?.length || 0;
    const size = Math.min(14, (W - 40) / Math.max(n, 1) - 4);
    const total = n * (size + 4) - 4;
    for (let i = 0; i < n; i++) {
      const x = W / 2 - total / 2 + i * (size + 4);
      const done = game.state === 'input' ? i < game.pos : game.state === 'done' || game.state === 'won';
      ctx.fillStyle = done ? KEY_COLORS[game.seq[i]] : '#ffffff22';
      roundRect(x, 78, size, size, size / 2);
      ctx.fill();
    }
    text(`goal ${game.goal} · wins ${game.wins || 0}`, W / 2, 108, { size: 9, color: '#8a96ad', align: 'center', weight: 500 });
  }

  function drawFree(now, laneW) {
    const speed = 0.07; // px per ms
    game.trail.forEach((tr) => {
      const end = tr.t1 ?? now;
      const yTop = HIT_Y - (now - tr.t0) * speed;
      const yBot = HIT_Y - (now - end) * speed;
      if (yBot < HUD) return;
      const x = laneOf(tr.k) * laneW;
      if (x < 0) return;
      ctx.fillStyle = KEY_COLORS[tr.k];
      roundRect(x + 8, Math.max(HUD, yTop), laneW - 16, Math.max(4, yBot - Math.max(HUD, yTop)), 4);
      ctx.fill();
    });
    if (!game.trail.length) text('play anything ♪', W / 2, 70, { size: 14, color: '#8a96ad', align: 'center', weight: 500 });
  }

  function drawMessages(now) {
    game.messages.forEach((m, i) => {
      const age = (now - m.t0) / m.ms;
      ctx.globalAlpha = Math.max(0, 1 - age * age);
      text(m.text, W / 2, 62 - age * 14 + i * 2, { size: 24, color: m.color, align: 'center', weight: 800 });
      ctx.globalAlpha = 1;
    });
  }

  function drawOffer(now) {
    const pulse = 0.75 + 0.25 * Math.sin(now / 250);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#ff8a1a';
    roundRect(W / 2 - 150, 40, 300, 72, 12);
    ctx.fill();
    ctx.globalAlpha = 1;
    text('TREAT READY!', W / 2, 62, { size: 22 * pulse + 4, color: '#1f2430', align: 'center', weight: 800 });
    text('hold your hand under the outlet ✋', W / 2, 92, { size: 12, color: '#1f2430', align: 'center', weight: 600 });
  }

  function drawSleep(now) {
    const a = 0.25 + 0.2 * Math.sin(now / 700);
    text('z Z', W / 2, 70, { size: 30, color: `rgba(140,160,200,${a})`, align: 'center', weight: 800 });
    text('deep sleep · waiting for presence sensor', W / 2, 110, { size: 10, color: '#5b6680', align: 'center', weight: 500 });
  }

  return { render, get fps() { return fps; } };
}
