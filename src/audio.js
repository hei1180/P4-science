// Tiny WebAudio sound engine — no audio files, no licensing.
import { loadMuted, storeMuted } from './state.js';

let ctx = null;
let muted = loadMuted();

export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  storeMuted(muted);
  if (!muted) {
    initAudio();
    tone(660, 0.07, 'sine', 0, 0.05);
  }
  return muted;
}

function tone(freq, duration, type = 'sine', delay = 0, volume = 0.06, glideTo = null) {
  if (muted || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, glideTo), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

export const sfx = {
  click() {
    tone(520, 0.045, 'triangle', 0, 0.035);
  },
  tap() {
    tone(340, 0.06, 'sine', 0, 0.04);
  },
  tick() {
    tone(880, 0.035, 'square', 0, 0.018);
  },
  chime() {
    tone(660, 0.18, 'sine', 0, 0.055);
    tone(990, 0.24, 'sine', 0.11, 0.045);
    tone(1320, 0.3, 'sine', 0.23, 0.03);
  },
  correct() {
    tone(523, 0.12, 'triangle', 0, 0.05);
    tone(659, 0.12, 'triangle', 0.1, 0.05);
    tone(784, 0.2, 'triangle', 0.2, 0.055);
  },
  wrong() {
    tone(220, 0.16, 'sine', 0, 0.045, 160);
  },
  star() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, 'sine', i * 0.08, 0.04));
  },
  whoosh() {
    tone(180, 0.35, 'sine', 0, 0.025, 520);
  },
  record() {
    tone(700, 0.08, 'square', 0, 0.03);
    tone(980, 0.08, 'square', 0.07, 0.025);
  },
};
