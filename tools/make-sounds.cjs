// Synthesises SurfPlace's chiptune sound effects and the ocean loop. No audio libraries and
// no downloaded samples: every sound is generated from waves and noise, written as
// 22 kHz mono 16-bit WAV into assets/sounds/.   Run: node tools/make-sounds.cjs
const fs = require('fs');
const path = require('path');

const SR = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(OUT, { recursive: true });

// ---------- tiny synth ----------
const TAU = Math.PI * 2;
const wave = {
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  pulse: (p) => (p % 1 < 0.25 ? 1 : -1),
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  saw: (p) => 2 * (p % 1) - 1,
  sine: (p) => Math.sin(p * TAU),
};
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

// one note (or chord): freqs in Hz, length in seconds
function note(freqs, len, o = {}) {
  const f = Array.isArray(freqs) ? freqs : [freqs];
  const n = Math.round(len * SR), out = new Float32Array(n);
  const w = wave[o.wave || 'pulse'], vol = o.vol === undefined ? 0.5 : o.vol;
  const attack = Math.round(0.003 * SR), decay = o.decay === undefined ? 4 : o.decay;
  for (let i = 0; i < n; i++) {
    const t = i / SR, k = i / n;
    const slide = o.slideTo ? 1 + (o.slideTo / f[0] - 1) * k : 1;
    const vib = o.vibrato ? 1 + 0.02 * Math.sin(TAU * 7 * t) : 1;
    let s = 0;
    for (const hz of f) s += w(hz * slide * vib * t);
    s /= f.length;
    const env = Math.min(1, i / attack) * Math.exp(-decay * k) * (k > 0.9 ? (1 - k) / 0.1 : 1);
    out[i] = s * env * vol;
  }
  return out;
}
const gap = (len) => new Float32Array(Math.round(len * SR));
function seq(...parts) {
  const total = parts.reduce((a, p) => a + p.length, 0), out = new Float32Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
// noise through a low-pass whose cutoff glides a -> b -> a (a "whoosh")
function whoosh(len, a, b, vol) {
  const n = Math.round(len * SR), out = new Float32Array(n);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n, bell = Math.sin(Math.PI * k);
    const alpha = a + (b - a) * bell;
    y += alpha * (rnd() - y);
    out[i] = y * bell * bell * vol * 4;
  }
  return out;
}

function save(name, data, peak = 0.8) {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
  const gain = max > 0 ? peak / max : 1;
  const pcm = Buffer.alloc(data.length * 2);
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i] * gain * 32767))), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.concat([head, pcm]));
  console.log('wrote ' + name + '.wav  ' + (data.length / SR).toFixed(2) + ' s  ' + Math.round((44 + pcm.length) / 1024) + ' KB');
}

// ---------- notes ----------
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, G6 = 1568;

save('tap', note(1100, 0.05, { wave: 'square', decay: 5, vol: 0.4 }), 0.5);
save('select', seq(note(660, 0.06, { wave: 'pulse' }), note(990, 0.1, { wave: 'pulse', decay: 5 })), 0.6);
save('back', seq(note(660, 0.06, { wave: 'pulse' }), note(440, 0.1, { wave: 'pulse', decay: 5 })), 0.55);
save('toggle', seq(note(1600, 0.02, { wave: 'square', decay: 2 }), note(900, 0.03, { wave: 'square', decay: 4 })), 0.5);
// flag plop: a falling blip plus a tick, like a water drop
save('flag', seq(note(520, 0.11, { wave: 'sine', slideTo: 190, decay: 3, vol: 0.9 }), note(1500, 0.025, { wave: 'square', decay: 4, vol: 0.3 })), 0.7);
save('swoosh', whoosh(0.4, 0.04, 0.32, 0.5), 0.55);
save('maybe', seq(note(D5, 0.09, { wave: 'pulse' }), gap(0.03), note(D5, 0.16, { wave: 'pulse', decay: 5 })), 0.55);
save('yes', seq(note(C5, 0.07), note(E5, 0.07), note(G5, 0.07), note([C6, G5], 0.22, { decay: 4 })), 0.65);
save('epic', seq(
  note(C5, 0.06), note(E5, 0.06), note(G5, 0.06), note(C6, 0.06), note(E6, 0.06), note(G6, 0.06),
  note([C6, E6, G6], 0.34, { wave: 'tri', decay: 3, vol: 0.9 }),
), 0.75);
save('no', seq(note(196, 0.13, { wave: 'saw', vibrato: true, vol: 0.45 }), note(147, 0.28, { wave: 'saw', vibrato: true, decay: 3, vol: 0.45 })), 0.5);

// ---------- ocean loop: 8 s of slowly swelling surf, crossfaded so it loops without a click ----------
{
  const LEN = 8, N = LEN * SR, X = Math.round(0.4 * SR);
  const gen = new Float32Array(N + X);
  let y = 0, y2 = 0;
  for (let i = 0; i < N + X; i++) {
    const t = i / SR;
    const swell = Math.pow(0.5 - 0.5 * Math.cos(TAU * t / LEN), 1.4);       // one big wave per loop
    const swell2 = Math.pow(0.5 - 0.5 * Math.cos(TAU * (t / LEN * 2 + 0.3)), 2);
    const alpha = 0.012 + 0.07 * swell;                                      // brighter at the crest
    const x = rnd();
    y += alpha * (x - y);
    y2 += 0.004 * (x - y2);                                                  // deep rumble underneath
    gen[i] = y * (0.12 + 0.88 * Math.max(swell, swell2 * 0.55)) * 5 + y2 * 4;
  }
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = i < X ? gen[i] * (i / X) + gen[N + i] * (1 - i / X) : gen[i];
  save('ocean', out, 0.6);
}
