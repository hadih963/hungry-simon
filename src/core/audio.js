// Web Audio stand-in for the ESP32 speaker + amplifier in a plywood sound box.
import { KEY_FREQS } from './notes.js';

let ctx = null;
let master = null;
let box = null;
const voices = new Map();

function ensure() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = audio.volume;
    // A gentle low-pass + resonance roughly imitates a small wooden sound box.
    box = ctx.createBiquadFilter();
    box.type = 'lowpass';
    box.frequency.value = 3400;
    box.Q.value = 1.2;
    box.connect(master);
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function voice(freq, { type = 'triangle', gain = 0.32, when = 0 } = {}) {
  const c = ensure();
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  const g2 = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o2.type = 'sine';
  o2.frequency.value = freq * 2;
  g2.gain.value = 0.18;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(gain * 0.55, t + 0.15);
  o.connect(g);
  o2.connect(g2).connect(g);
  g.connect(box);
  o.start(t);
  o2.start(t);
  return {
    release(after = 0, length = 0.25) {
      const r = Math.max(c.currentTime, t + after);
      g.gain.cancelScheduledValues(r);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), r);
      g.gain.exponentialRampToValueAtTime(0.0001, r + length);
      o.stop(r + length + 0.02);
      o2.stop(r + length + 0.02);
    },
  };
}

export const audio = {
  volume: 0.7,
  unlock() { ensure(); },
  setVolume(v) {
    this.volume = v;
    if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
  },
  /** Key held down: note sustains until noteOff (like tone() without a duration). */
  noteOn(i) {
    this.noteOff(i);
    voices.set(i, voice(KEY_FREQS[i]));
  },
  noteOff(i) {
    const v = voices.get(i);
    if (v) { v.release(0.05); voices.delete(i); }
  },
  /** Fixed-length note, used when the device demonstrates a sequence. */
  note(i, ms = 350) {
    voice(KEY_FREQS[i]).release(ms / 1000, 0.2);
  },
  tick(accent = false) {
    voice(accent ? 1568 : 1046.5, { type: 'square', gain: 0.08 }).release(0.03, 0.05);
  },
  success() {
    [523.25, 659.25, 783.99].forEach((f, k) =>
      voice(f, { type: 'square', gain: 0.09, when: k * 0.07 }).release(k * 0.07 + 0.08, 0.12));
  },
  win() {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, k) =>
      voice(f, { type: 'square', gain: 0.1, when: k * 0.11 }).release(k * 0.11 + 0.1, 0.18));
  },
  error() {
    voice(185, { type: 'sawtooth', gain: 0.16 }).release(0.18, 0.15);
    voice(139, { type: 'sawtooth', gain: 0.16, when: 0.2 }).release(0.45, 0.2);
  },
  wake() {
    [392, 523.25, 783.99].forEach((f, k) =>
      voice(f, { type: 'sine', gain: 0.14, when: k * 0.09 }).release(k * 0.09 + 0.12, 0.3));
  },
  sleep() {
    [783.99, 523.25, 392].forEach((f, k) =>
      voice(f, { type: 'sine', gain: 0.1, when: k * 0.12 }).release(k * 0.12 + 0.12, 0.35));
  },
};
