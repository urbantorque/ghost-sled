// The offline renderer's signal primitives (round 7). Everything here runs in Node at 48 kHz with no
// real-time limit: seeded noise, buffers, filters, band-limited oscillators and delay lines. Nothing
// reads a clock or Math.random, so a render is the same bytes every time.

export const SR = 48000;
export const TAU = Math.PI * 2;

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
/** 2^(cents/1200) for small bends (a vibrato, a drift): within a thousandth of a cent under 50 cents. */
export const bend = (cents: number): number => {
  const x = cents * 0.0005776226504666211;
  return 1 + x + 0.5 * x * x;
};
export const db = (x: number): number => Math.pow(10, x / 20);
export const todb = (x: number): number => 20 * Math.log10(Math.max(1e-12, x));
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** FNV-1a over a string: seeds from names, so a part's noise does not move when another part is added. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: the renderer's only source of chance. */
export class Rng {
  private s: number;
  constructor(seed: number | string) {
    this.s = (typeof seed === 'string' ? hash(seed) : seed) >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** -1..1. */
  bip(): number {
    return this.next() * 2 - 1;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  /** Roughly normal, -1..1 mostly (three uniforms). */
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }
  fork(tag: string | number): Rng {
    return new Rng((this.s ^ (typeof tag === 'string' ? hash(tag) : Math.imul(tag + 1, 0x9e3779b1))) >>> 0);
  }
}

export interface Stereo {
  l: Float32Array;
  r: Float32Array;
}

export const stereo = (n: number): Stereo => ({ l: new Float32Array(n), r: new Float32Array(n) });
export const secs = (s: number): number => Math.max(0, Math.round(s * SR));

/** Equal-power pan gains for pan -1..1. */
export function panGains(pan: number): [number, number] {
  const a = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}

/** Adds a mono voice into a stereo buffer at sample `at`. */
export function addMono(dst: Stereo, src: Float32Array, at: number, gain: number, pan: number): void {
  const [gl, gr] = panGains(pan);
  const a = gain * gl;
  const b = gain * gr;
  const n = Math.min(src.length, dst.l.length - at);
  const from = at < 0 ? -at : 0;
  for (let i = from; i < n; i++) {
    const x = src[i];
    dst.l[at + i] += x * a;
    dst.r[at + i] += x * b;
  }
}

export function addStereo(dst: Stereo, src: Stereo, at: number, gain: number): void {
  const n = Math.min(src.l.length, dst.l.length - at);
  const from = at < 0 ? -at : 0;
  for (let i = from; i < n; i++) {
    dst.l[at + i] += src.l[i] * gain;
    dst.r[at + i] += src.r[i] * gain;
  }
}

export function scale(b: Stereo, g: number): Stereo {
  for (let i = 0; i < b.l.length; i++) {
    b.l[i] *= g;
    b.r[i] *= g;
  }
  return b;
}

export function copy(b: Stereo): Stereo {
  return { l: b.l.slice(), r: b.r.slice() };
}

export function peakOf(b: Stereo): number {
  let p = 0;
  for (let i = 0; i < b.l.length; i++) {
    const a = Math.abs(b.l[i]);
    const c = Math.abs(b.r[i]);
    if (a > p) p = a;
    if (c > p) p = c;
  }
  return p;
}

export function rmsOf(b: Stereo, from = 0, to = b.l.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += b.l[i] * b.l[i] + b.r[i] * b.r[i];
  return Math.sqrt(s / Math.max(1, 2 * (to - from)));
}

// ------------------------------------------------------------------- filters

/** A biquad (RBJ cookbook designs), direct form 1 transposed. */
export class Biquad {
  b0 = 1;
  b1 = 0;
  b2 = 0;
  a1 = 0;
  a2 = 0;
  private z1 = 0;
  private z2 = 0;

  static design(type: 'lp' | 'hp' | 'bp' | 'peak' | 'loshelf' | 'hishelf' | 'notch' | 'ap', f: number, q: number, gainDb = 0, sr = SR): Biquad {
    const o = new Biquad();
    const w = (TAU * clamp(f, 5, sr * 0.49)) / sr;
    const cs = Math.cos(w);
    const sn = Math.sin(w);
    const A = Math.pow(10, gainDb / 40);
    const al = sn / (2 * Math.max(0.05, q));
    let b0 = 1;
    let b1 = 0;
    let b2 = 0;
    let a0 = 1;
    let a1 = 0;
    let a2 = 0;
    switch (type) {
      case 'lp':
        b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
        break;
      case 'hp':
        b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
        break;
      case 'bp':
        b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
        break;
      case 'notch':
        b0 = 1; b1 = -2 * cs; b2 = 1; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
        break;
      case 'ap':
        b0 = 1 - al; b1 = -2 * cs; b2 = 1 + al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
        break;
      case 'peak':
        b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A;
        break;
      case 'loshelf': {
        const s = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 - (A - 1) * cs + s); b1 = 2 * A * (A - 1 - (A + 1) * cs); b2 = A * (A + 1 - (A - 1) * cs - s);
        a0 = A + 1 + (A - 1) * cs + s; a1 = -2 * (A - 1 + (A + 1) * cs); a2 = A + 1 + (A - 1) * cs - s;
        break;
      }
      case 'hishelf': {
        const s = 2 * Math.sqrt(A) * al;
        b0 = A * (A + 1 + (A - 1) * cs + s); b1 = -2 * A * (A - 1 + (A + 1) * cs); b2 = A * (A + 1 + (A - 1) * cs - s);
        a0 = A + 1 - (A - 1) * cs + s; a1 = 2 * (A - 1 - (A + 1) * cs); a2 = A + 1 - (A - 1) * cs - s;
        break;
      }
    }
    o.b0 = b0 / a0; o.b1 = b1 / a0; o.b2 = b2 / a0; o.a1 = a1 / a0; o.a2 = a2 / a0;
    return o;
  }

  tick(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  run(buf: Float32Array): Float32Array {
    const { b0, b1, b2, a1, a2 } = this;
    let z1 = this.z1;
    let z2 = this.z2;
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i];
      const y = b0 * x + z1;
      z1 = b1 * x - a1 * y + z2;
      z2 = b2 * x - a2 * y;
      buf[i] = y;
    }
    this.z1 = Math.abs(z1) < 1e-20 ? 0 : z1;
    this.z2 = Math.abs(z2) < 1e-20 ? 0 : z2;
    return buf;
  }

  clone(): Biquad {
    const o = new Biquad();
    o.b0 = this.b0; o.b1 = this.b1; o.b2 = this.b2; o.a1 = this.a1; o.a2 = this.a2;
    return o;
  }
}

export type EqBand = readonly ['lp' | 'hp' | 'bp' | 'peak' | 'loshelf' | 'hishelf' | 'notch', number, number, number?];

/** An EQ curve applied to both sides. */
export function eq(b: Stereo, bands: readonly EqBand[]): Stereo {
  for (const [type, f, q, g] of bands) {
    Biquad.design(type, f, q, g ?? 0).run(b.l);
    Biquad.design(type, f, q, g ?? 0).run(b.r);
  }
  return b;
}

export function eqMono(x: Float32Array, bands: readonly EqBand[]): Float32Array {
  for (const [type, f, q, g] of bands) Biquad.design(type, f, q, g ?? 0).run(x);
  return x;
}

/**
 * A state-variable filter (the trapezoidal one), for cutoffs that move every sample: `lp`, `bp` and `hp`
 * are all there after a tick.
 */
export class Svf {
  private ic1 = 0;
  private ic2 = 0;
  lp = 0;
  bp = 0;
  hp = 0;
  private f = -1;
  private q = -1;
  private k = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;
  tick(x: number, f: number, q: number): number {
    // The coefficients are worked out again only when the cutoff has moved a fifth of a percent: a tangent
    // a sample was most of a render's time, and a filter that sweeps does not need it.
    if (q !== this.q || Math.abs(f - this.f) > this.f * 0.002) {
      const g = Math.tan((Math.PI * clamp(f, 10, SR * 0.45)) / SR);
      this.f = f;
      this.q = q;
      this.k = 1 / q;
      this.a1 = 1 / (1 + g * (g + this.k));
      this.a2 = g * this.a1;
      this.a3 = g * this.a2;
    }
    const { k, a1, a2, a3 } = this;
    const v3 = x - this.ic2;
    const v1 = a1 * this.ic1 + a2 * v3;
    const v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2;
    this.bp = v1;
    this.hp = x - k * v1 - v2;
    return v2;
  }
}

/** One-pole lowpass coefficient for a time constant in seconds. */
export const tc = (s: number): number => 1 - Math.exp(-1 / (Math.max(1e-5, s) * SR));

// ------------------------------------------------------------------- oscillators

/** The polyBLEP residual: takes the edge off a naive saw or square so it does not alias. */
function blep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** A band-limited saw, -1..1. */
export class Saw {
  constructor(public phase = 0) {}
  tick(dt: number): number {
    let p = this.phase + dt;
    if (p >= 1) p -= 1;
    this.phase = p;
    return 2 * p - 1 - blep(p, dt);
  }
}

/** A band-limited pulse of width `w`. */
export class Pulse {
  constructor(public phase = 0) {}
  tick(dt: number, w = 0.5): number {
    let p = this.phase + dt;
    if (p >= 1) p -= 1;
    this.phase = p;
    let y = p < w ? 1 : -1;
    y += blep(p, dt);
    let q = p - w;
    if (q < 0) q += 1;
    y -= blep(q, dt);
    return y;
  }
}

// ------------------------------------------------------------------- envelopes

/** An ADSR over n samples for a note held `hold` seconds: linear attack, exponential decay and release. */
export function adsr(n: number, a: number, d: number, s: number, r: number, hold: number): Float32Array {
  const out = new Float32Array(n);
  const an = Math.max(1, secs(a));
  const hn = Math.max(an, secs(hold));
  const kd = tc(d / 3);
  const kr = tc(r / 3);
  let v = 0;
  for (let i = 0; i < n; i++) {
    if (i < an) v = (i + 1) / an;
    else if (i < hn) v += (s - v) * kd;
    else v += (0 - v) * kr;
    out[i] = v;
  }
  return out;
}

/** Fades the last `ms` of a buffer to nothing, so a voice cut at its buffer's end never clicks. */
export function fadeTail(x: Float32Array, ms = 8): Float32Array {
  const n = Math.min(x.length, secs(ms / 1000));
  for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n;
  return x;
}

// ------------------------------------------------------------------- delay

/** A delay line read with linear interpolation. */
export class Delay {
  private readonly buf: Float32Array;
  private w = 0;
  private readonly mask: number;
  constructor(maxSamples: number) {
    let n = 1;
    while (n < maxSamples + 4) n <<= 1;
    this.buf = new Float32Array(n);
    this.mask = n - 1;
  }
  write(x: number): void {
    this.buf[this.w] = x;
    this.w = (this.w + 1) & this.mask;
  }
  /** The sample written `d` samples ago (d >= 1). */
  read(d: number): number {
    const p = this.w - d;
    const i = Math.floor(p);
    const f = p - i;
    const a = this.buf[i & this.mask];
    const b = this.buf[(i + 1) & this.mask];
    return a + (b - a) * f;
  }
  readInt(d: number): number {
    return this.buf[(this.w - d) & this.mask];
  }
}

/** A soft clip with a little even-order colour: the renderer's tape. */
export const sat = (x: number, drive: number): number => Math.tanh(x * drive) / Math.tanh(drive);

/** Noise: white, and pink by the Paul Kellet filter. */
export function white(n: number, rng: Rng): Float32Array {
  const o = new Float32Array(n);
  for (let i = 0; i < n; i++) o[i] = rng.bip();
  return o;
}

export function pink(n: number, rng: Rng): Float32Array {
  const o = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.bip();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return o;
}
