// The band's drum kit (round 6), synthesized in JS once per context into short buffers, so a hit is one
// buffer source into its lane and no filters or envelopes are made per hit. The transients are shaped where
// they are made: a kick is a click, a fast pitch drop and a short hold before its decay, then softly
// clipped so its body has harmonics a phone speaker can play; a snare's first 5 ms are its loudest; hats are
// six detuned square partials (a metal plate) over noise, high-passed. Each buffer peaks at 1.

export type KickKind = 'tight' | 'deep' | 'soft';
export type SnareKind = 'snare' | 'clap' | 'rim';

export interface Kit {
  kick: Record<KickKind, AudioBuffer>;
  snare: Record<SnareKind, AudioBuffer>;
  hat: AudioBuffer;
  open: AudioBuffer;
  shaker: AudioBuffer;
  crash: AudioBuffer;
  taiko: AudioBuffer;
  /** A low boom under a drop: a sine falling from 80 to 32 Hz over half a second. */
  boom: AudioBuffer;
}

/** A tiny seeded noise: the kit sounds the same every session. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

function normalize(x: Float32Array, peak = 1): Float32Array {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m;
  return x;
}

/** One-pole high-pass and low-pass, in place. */
function hp1(x: Float32Array, f: number, sr: number): void {
  const a = Math.exp((-2 * Math.PI * f) / sr);
  let y = 0;
  let px = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    y = a * (y + v - px);
    px = v;
    x[i] = y;
  }
}
function lp1(x: Float32Array, f: number, sr: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * f) / sr);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y += a * (x[i] - y);
    x[i] = y;
  }
}
/** A two-pole band-pass (RBJ, constant peak gain), in place. */
function bp2(x: Float32Array, f: number, q: number, sr: number): void {
  const w = (2 * Math.PI * f) / sr;
  const al = Math.sin(w) / (2 * q);
  const a0 = 1 + al;
  const b0 = al / a0;
  const a1 = (-2 * Math.cos(w)) / a0;
  const a2 = (1 - al) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const y = b0 * v - b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = v;
    y2 = y1;
    y1 = y;
    x[i] = y;
  }
}

function kick(sr: number, kind: KickKind): Float32Array {
  const p = kind === 'deep' ? { f0: 130, f1: 41, drop: 0.055, hold: 0.03, tau: 0.22, len: 0.6, drive: 2.2, click: 0.35 } : kind === 'soft' ? { f0: 110, f1: 48, drop: 0.05, hold: 0.012, tau: 0.13, len: 0.45, drive: 1.2, click: 0.12 } : { f0: 160, f1: 50, drop: 0.045, hold: 0.018, tau: 0.15, len: 0.5, drive: 1.6, click: 0.28 };
  const n = Math.floor(sr * p.len);
  const x = new Float32Array(n);
  const r = rng(11);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = p.f1 + (p.f0 - p.f1) * Math.exp(-t / p.drop);
    ph += (2 * Math.PI * f) / sr;
    // A 1 ms rise (no click from the sine itself), the hold that gives it punch, then the decay.
    const env = t < 0.001 ? t / 0.001 : t < p.hold ? 1 : Math.exp(-(t - p.hold) / p.tau);
    let v = Math.sin(ph) * env;
    v = Math.tanh(v * p.drive) / Math.tanh(p.drive);
    // The beater: a 2 ms burst of bright noise.
    if (t < 0.003) v += r() * p.click * (1 - t / 0.003);
    x[i] = v;
  }
  return normalize(x);
}

function snare(sr: number, kind: SnareKind): Float32Array {
  const r = rng(kind === 'clap' ? 23 : kind === 'rim' ? 29 : 17);
  if (kind === 'rim') {
    const n = Math.floor(sr * 0.12);
    const x = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      ph += (2 * Math.PI * 1720) / sr;
      x[i] = (Math.sin(ph) * 0.6 + r() * 0.5) * Math.exp(-t / 0.018);
    }
    hp1(x, 400, sr);
    return normalize(x);
  }
  const len = kind === 'clap' ? 0.4 : 0.32;
  const n = Math.floor(sr * len);
  const noise = new Float32Array(n);
  for (let i = 0; i < n; i++) noise[i] = r();
  if (kind === 'clap') {
    bp2(noise, 1300, 0.9, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // Three hands a hair apart, then the room's tail.
      let env = 0;
      for (let k = 0; k < 3; k++) {
        const tk = t - k * 0.011;
        if (tk >= 0) env = Math.max(env, (1 - k * 0.12) * Math.exp(-tk / 0.0045));
      }
      const tail = t >= 0.03 ? 0.62 * Math.exp(-(t - 0.03) / 0.07) : 0;
      noise[i] *= Math.max(env, tail);
    }
    return normalize(noise);
  }
  // The snare: a tuned skin (two sines) under band-passed noise; its first 5 ms the loudest.
  hp1(noise, 1500, sr);
  lp1(noise, 9000, sr);
  const x = new Float32Array(n);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    p1 += (2 * Math.PI * (185 + 40 * Math.exp(-t / 0.01))) / sr;
    p2 += (2 * Math.PI * 330) / sr;
    const skin = (Math.sin(p1) * 0.8 + Math.sin(p2) * 0.3) * Math.exp(-t / 0.05);
    const snap = t < 0.005 ? 1.6 : 1;
    x[i] = skin * 0.7 + noise[i] * snap * Math.exp(-t / 0.085);
  }
  return normalize(x);
}

/** Six square partials at inharmonic ratios (a struck plate), summed with noise and high-passed. */
function metal(sr: number, n: number, seed: number, base: number): Float32Array {
  const r = rng(seed);
  const x = new Float32Array(n);
  const fs = [1, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637].map((k) => k * base);
  const ph = fs.map(() => 0);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let k = 0; k < fs.length; k++) {
      ph[k] += fs[k] / sr;
      v += ph[k] % 1 < 0.5 ? 1 : -1;
    }
    x[i] = v / 6 * 0.55 + r() * 0.45;
  }
  hp1(x, 6800, sr);
  hp1(x, 6800, sr);
  return x;
}

function hat(sr: number, open: boolean): Float32Array {
  const n = Math.floor(sr * (open ? 0.5 : 0.09));
  const x = metal(sr, n, open ? 41 : 37, 410);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    x[i] *= open ? Math.exp(-t / 0.12) : Math.exp(-t / 0.018) * (t < 0.0006 ? t / 0.0006 : 1);
  }
  return normalize(x);
}

function shaker(sr: number): Float32Array {
  const r = rng(53);
  const n = Math.floor(sr * 0.11);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = t < 0.018 ? t / 0.018 : Math.exp(-(t - 0.018) / 0.025);
    x[i] = r() * env;
  }
  bp2(x, 6200, 1.2, sr);
  return normalize(x);
}

function crash(sr: number, ch: number): Float32Array {
  const n = Math.floor(sr * 2.2);
  const x = metal(sr, n, 61 + ch * 7, 330 + ch * 9);
  const r = rng(71 + ch);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    x[i] = (x[i] * 0.6 + r() * 0.4) * (t < 0.002 ? t / 0.002 : Math.exp(-t / 0.55));
  }
  hp1(x, 3200, sr);
  return x;
}

function taiko(sr: number): Float32Array {
  const n = Math.floor(sr * 0.7);
  const x = new Float32Array(n);
  const r = rng(83);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * (78 + 50 * Math.exp(-t / 0.03))) / sr;
    const env = t < 0.002 ? t / 0.002 : Math.exp(-t / 0.2);
    const skin = r() * Math.exp(-t / 0.012) * 0.5;
    x[i] = Math.tanh((Math.sin(ph) * env + skin) * 1.8);
  }
  return normalize(x);
}

function boom(sr: number): Float32Array {
  const n = Math.floor(sr * 0.9);
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * (32 + 48 * Math.exp(-t / 0.12))) / sr;
    const env = t < 0.004 ? t / 0.004 : Math.exp(-t / 0.28);
    x[i] = Math.tanh(Math.sin(ph) * env * 1.4);
  }
  return normalize(x);
}

function buf(ctx: BaseAudioContext, chans: Float32Array[]): AudioBuffer {
  const b = ctx.createBuffer(chans.length, chans[0].length, ctx.sampleRate);
  chans.forEach((c, i) => {
    const d = b.getChannelData(i);
    d.set(c);
  });
  return b;
}

export function createKit(ctx: BaseAudioContext): Kit {
  const sr = ctx.sampleRate;
  const crashL = crash(sr, 0);
  const crashR = crash(sr, 1);
  let m = 0;
  for (let i = 0; i < crashL.length; i++) m = Math.max(m, Math.abs(crashL[i]), Math.abs(crashR[i]));
  if (m > 0) for (let i = 0; i < crashL.length; i++) {
    crashL[i] /= m;
    crashR[i] /= m;
  }
  return {
    kick: { tight: buf(ctx, [kick(sr, 'tight')]), deep: buf(ctx, [kick(sr, 'deep')]), soft: buf(ctx, [kick(sr, 'soft')]) },
    snare: { snare: buf(ctx, [snare(sr, 'snare')]), clap: buf(ctx, [snare(sr, 'clap')]), rim: buf(ctx, [snare(sr, 'rim')]) },
    hat: buf(ctx, [hat(sr, false)]),
    open: buf(ctx, [hat(sr, true)]),
    shaker: buf(ctx, [shaker(sr)]),
    crash: buf(ctx, [crashL, crashR]),
    taiko: buf(ctx, [taiko(sr)]),
    boom: buf(ctx, [boom(sr)]),
  };
}
