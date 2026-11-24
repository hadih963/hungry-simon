// Game logic for all four modes. No DOM here: the outside world is reached through `io`.
import { KEY_COLORS, PET_KEYS } from './notes.js';
import { songById } from './songs.js';

export const DIFFICULTY = {
  easy:   { label: 'Easy',   tempo: 0.8, window: 240, simonStart: 2, simonGoal: 5, gap: 700 },
  normal: { label: 'Normal', tempo: 1.0, window: 160, simonStart: 3, simonGoal: 7, gap: 560 },
  hard:   { label: 'Hard',   tempo: 1.2, window: 100, simonStart: 4, simonGoal: 9, gap: 440 },
};
const PET = { start: 1, goal: 3, gap: 850 };
export const FALL_MS = 2000; // time a note needs to fall from the top of the display to the hit line
const COUNT_IN = 4;
const ALL_KEYS = [0, 1, 2, 3, 4, 5, 6, 7];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Game {
  /**
   * io: { playNote(k, ms), flash(color, ms), sound(name), reward(reason), publish(kind, data) }
   */
  constructor(io) {
    this.io = io;
    this.mode = 'free';
    this.difficulty = 'normal';
    this.songId = 'ode';
    this.player = 'Player 1';
    this.timeouts = new Set();
    this.messages = [];
    this.trail = [];
    this.held = new Set();
    this.state = 'idle';
    this.score = 0;
  }

  get cfg() { return DIFFICULTY[this.difficulty]; }
  get isSimon() { return this.mode === 'simon' || this.mode === 'pet'; }

  after(ms, fn) {
    const id = setTimeout(() => { this.timeouts.delete(id); fn(); }, Math.max(0, ms));
    this.timeouts.add(id);
  }

  say(text, color = '#ffffff', ms = 900) {
    this.messages.push({ text, color, t0: performance.now(), ms });
    if (this.messages.length > 4) this.messages.shift();
  }

  start(mode = this.mode) {
    this.stop();
    this.mode = mode;
    this.score = 0;
    this.combo = 0;
    if (this.isSimon) this.startSimon(true);
    else if (mode === 'song') this.startSong(false);
    else this.state = 'free';
  }

  stop() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts.clear();
    this.state = 'idle';
    this.chart = null;
    this.seq = [];
    this.lit = null;
    this.messages = [];
  }

  // ---------------------------------------------------------------- input
  keyDown(k) {
    const now = performance.now();
    this.held.add(k);
    this.trail.push({ k, t0: now, t1: null });
    if (this.trail.length > 48) this.trail.shift();
    if (this.isSimon) this.simonInput(k);
    else if (this.mode === 'song') this.songInput(k, now);
  }

  keyUp(k) {
    this.held.delete(k);
    for (let i = this.trail.length - 1; i >= 0; i--) {
      if (this.trail[i].k === k && this.trail[i].t1 === null) { this.trail[i].t1 = performance.now(); break; }
    }
  }

  // ---------------------------------------------------------------- simon / pet
  startSimon(fresh) {
    const pet = this.mode === 'pet';
    if (fresh) this.wins = 0;
    this.pool = pet ? PET_KEYS : ALL_KEYS;
    this.goal = pet ? PET.goal : this.cfg.simonGoal + this.wins * 2;
    this.gap = pet ? PET.gap : Math.max(260, this.cfg.gap * 0.88 ** this.wins);
    const len = pet ? PET.start : this.cfg.simonStart;
    this.seq = Array.from({ length: len }, () => pick(this.pool));
    this.pos = 0;
    this.state = 'ready';
    this.io.publish('game_start', { mode: this.mode, goal: this.goal });
    this.after(700, () => this.showSequence());
  }

  showSequence() {
    this.state = 'watch';
    this.pos = 0;
    this.lit = null;
    const on = this.gap * 0.62;
    this.seq.forEach((k, i) => {
      this.after(450 + i * this.gap, () => { this.lit = k; this.io.playNote(k, on); });
      this.after(450 + i * this.gap + on, () => { this.lit = null; });
    });
    this.after(450 + this.seq.length * this.gap - this.gap * 0.3, () => { this.state = 'input'; });
  }

  simonInput(k) {
    if (this.state !== 'input') return;
    if (k !== this.seq[this.pos]) {
      this.fail('WRONG NOTE', () => this.showSequence());
      return;
    }
    this.pos++;
    if (this.pos < this.seq.length) return;

    this.state = 'done';
    this.score += this.seq.length * (this.mode === 'pet' ? 5 : 10) * (1 + this.wins);
    if (this.seq.length >= this.goal) {
      this.wins++;
      this.win(`${this.mode === 'pet' ? 'Pet pattern' : 'Simon sequence'} of ${this.seq.length}`);
      this.after(3200, () => this.startSimon(false));
    } else {
      this.io.sound('success');
      this.say('NICE!', '#3ddc84', 700);
      this.seq.push(pick(this.pool));
      this.after(1000, () => this.showSequence());
    }
  }

  // ---------------------------------------------------------------- song challenge
  startSong(restart) {
    const song = songById(this.songId);
    const beatMs = 60000 / (song.bpm * this.cfg.tempo);
    let t = 0;
    this.chart = song.notes.map((n) => {
      const note = { key: n.key, t, dur: n.beats * beatMs, hit: false, off: 0 };
      t += n.beats * beatMs;
      return note;
    });
    this.song = song;
    this.beatMs = beatMs;
    this.idx = 0;
    this.offsets = [];
    this.combo = 0;
    this.score = 0;
    this.attempts = restart ? (this.attempts || 0) + 1 : 1;

    const now = performance.now();
    this.songStart = now + Math.max(FALL_MS + 300, COUNT_IN * beatMs + 600);
    this.state = 'countin';
    this.countBeat = COUNT_IN;
    for (let b = 0; b < COUNT_IN; b++) {
      this.after(this.songStart - (COUNT_IN - b) * beatMs - now, () => {
        this.io.sound(b === 0 ? 'tickAccent' : 'tick');
        this.countBeat = COUNT_IN - b;
      });
    }
    this.after(this.songStart - now - this.cfg.window, () => { if (this.state === 'countin') this.state = 'play'; });
    this.io.publish('game_start', { mode: 'song', song: song.id, attempt: this.attempts });
  }

  songInput(k, now) {
    if (this.state === 'won' && now - this.wonAt > 1500) { this.startSong(false); return; }
    if (this.state !== 'play' && this.state !== 'countin') return;
    const n = this.chart[this.idx];
    if (!n) return;
    const off = now - this.songStart - n.t;
    const w = this.cfg.window;
    if (this.state === 'countin' && !(k === n.key && off >= -w)) return; // ignore noodling during the count-in
    if (k !== n.key) return this.fail('WRONG NOTE', () => this.startSong(true));
    if (off < -w) return this.fail('TOO EARLY', () => this.startSong(true));
    if (off > w) return this.fail('TOO LATE', () => this.startSong(true));

    this.state = 'play';
    n.hit = true;
    n.off = off;
    this.offsets.push(off);
    this.idx++;
    this.combo++;
    const acc = 1 - Math.abs(off) / w;
    this.score += Math.round((50 + 50 * acc) * (1 + Math.min(this.combo, 20) / 10));
    this.say(acc > 0.6 ? 'PERFECT' : 'GOOD', acc > 0.6 ? '#ffd60a' : '#3ddc84', 450);
    if (this.idx >= this.chart.length) {
      this.state = 'done';
      this.after(500, () => this.win(this.song.title));
    }
  }

  /** Called every frame. Detects notes that fell past the timing window. */
  tick(now) {
    if (this.mode === 'song' && this.state === 'play') {
      const n = this.chart[this.idx];
      if (n && now - this.songStart - n.t > this.cfg.window) this.fail('MISSED', () => this.startSong(true));
    }
    this.messages = this.messages.filter((m) => now - m.t0 < m.ms);
  }

  get avgOffsetMs() {
    if (!this.offsets?.length) return null;
    return Math.round(this.offsets.reduce((a, b) => a + Math.abs(b), 0) / this.offsets.length);
  }

  // ---------------------------------------------------------------- outcomes
  fail(reason, then) {
    this.state = 'fail';
    this.combo = 0;
    this.lit = null;
    this.io.sound('error');
    this.io.flash('#ff2d2d', 380);
    this.say(reason, '#ff4d4d', 1300);
    this.io.publish('mistake', { mode: this.mode, reason });
    this.after(1500, then);
  }

  win(what) {
    this.state = 'won';
    this.wonAt = performance.now();
    this.io.sound('win');
    this.io.flash('#3ddc84', 650);
    this.say('YOU WIN!', '#3ddc84', 2200);
    this.io.publish('score', {
      player: this.player, mode: this.mode, difficulty: this.difficulty,
      score: this.score, detail: what, avgTimingErrorMs: this.mode === 'song' ? this.avgOffsetMs : undefined,
    });
    this.io.reward(what);
  }

  // ---------------------------------------------------------------- LEDs
  /** What the LED under key k should show right now (besides "held"): [color, intensity] or null. */
  ledFor(k, now) {
    if (this.isSimon && this.state === 'watch' && this.lit === k) return [KEY_COLORS[k], 1];
    if (this.mode === 'song' && (this.state === 'play' || this.state === 'countin')) {
      const n = this.chart[this.idx];
      if (n && n.key === k) {
        const dt = n.t - (now - this.songStart);
        if (dt < FALL_MS) return [KEY_COLORS[k], dt < this.cfg.window ? 1 : 0.3 + 0.5 * (1 - dt / FALL_MS)];
      }
    }
    return null;
  }
}
