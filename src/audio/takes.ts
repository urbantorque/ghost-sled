// The soundscape's takes: the world's one-shots (a crowd's cheer, a cowbell, a crow, a church bell,
// ice groaning, wind chimes) synthesized once, sample by sample in plain JS, into mono buffers. A take
// then plays as one buffer source into a long-lived lane (scape.ts), so a crow or a cheer costs one
// node however rich it is. Synthesis runs as generators sliced to about a millisecond per scheduler
// pass (TakeBank.pump), from the moment the context exists, so the title screen pays for it in small
// steps and a run never does. Everything is seeded: a take is the same on every machine.

/** Takes are rendered at this rate (the context resamples them): the world's sounds sit under 12
 *  kHz, and it keeps the bank near 5 MB. */
export const TAKE_RATE = 32000;

export type TakeName =
  | 'cheer'
  | 'whistle'
  | 'cowbell'
  | 'taiko'
  | 'temple'
  | 'church'
  | 'chimes'
  | 'caw'
  | 'crane'
  | 'flaps'
  | 'owl'
  | 'creak'
  | 'crackle'
  | 'rumble'
  | 'clack'
  | 'diesel'
  | 'slough';

/** A take being synthesized: yields between slices, returns its samples. */
type Gen = Generator<void, Float32Array, void>;

/** Samples synthesized between checks of the time budget (the cheer, the dearest, makes 1024 in
 *  about 1 ms on a desktop). */
const SLICE = 1024;

/** A small seeded generator (mulberry32), so a take is the same every time it is made. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A direct-form biquad (the RBJ cookbook), run on one sample at a time. */
class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(
    private readonly type: 'lowpass' | 'highpass' | 'bandpass',
    f: number,
    q: number,
  ) {
    this.set(f, q);
  }

  /** Retunes it (cheap enough to call every few samples for a glide). */
  set(f: number, q: number): void {
    const w0 = (2 * Math.PI * Math.min(Math.max(f, 10), TAKE_RATE * 0.45)) / TAKE_RATE;
    const cw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    if (this.type === 'lowpass') {
      this.b0 = (1 - cw) / 2 / a0;
      this.b1 = (1 - cw) / a0;
      this.b2 = this.b0;
    } else if (this.type === 'highpass') {
      this.b0 = (1 + cw) / 2 / a0;
      this.b1 = -(1 + cw) / a0;
      this.b2 = this.b0;
    } else {
      this.b0 = alpha / a0;
      this.b1 = 0;
      this.b2 = -alpha / a0;
    }
    this.a1 = (-2 * cw) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  run(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Adds a decaying partial (amplitude a, time constant tau s) at f Hz from sample i0, with a phasor
 *  recurrence instead of a Math.sin per sample. */
function partial(d: Float32Array, i0: number, f: number, a: number, tau: number, phase = 0): void {
  const g = partialSliced(d, i0, f, a, tau, phase);
  while (!g.next().done);
}

/** partial(), yielding every SLICE samples (a long bell partial is several slices' work). */
function* partialSliced(d: Float32Array, i0: number, f: number, a: number, tau: number, phase = 0): Generator<void, void, void> {
  if (f <= 0 || f >= TAKE_RATE * 0.45 || i0 >= d.length) return;
  const w = (2 * Math.PI * f) / TAKE_RATE;
  const fall = Math.exp(-1 / (tau * TAKE_RATE));
  const c = Math.cos(w) * fall;
  const s = Math.sin(w) * fall;
  let x = a * Math.cos(phase);
  let y = a * Math.sin(phase);
  const n = Math.min(d.length - i0, Math.ceil(tau * TAKE_RATE * 7));
  // A 2 ms attack, so a strike never clicks.
  const att = Math.floor(0.002 * TAKE_RATE);
  for (let k = 0; k < n; k++) {
    d[i0 + k] += k < att ? (y * k) / att : y;
    const nx = x * c - y * s;
    y = x * s + y * c;
    x = nx;
    if (k % SLICE === SLICE - 1) yield;
  }
}

/** Peak-normalises to `peak` and fades the last 20 ms, so a take never ends on a click. */
function finish(d: Float32Array, peak = 0.9): Float32Array {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  const k = m > 0 ? peak / m : 1;
  const fade = Math.min(d.length, Math.floor(0.02 * TAKE_RATE));
  for (let i = 0; i < d.length; i++) {
    const tail = d.length - i;
    d[i] *= tail < fade ? (k * tail) / fade : k;
  }
  return d;
}

const len = (s: number): number => Math.ceil(s * TAKE_RATE);

// ---------------------------------------------------------------- crowd and set pieces

/** A crowd's cheer: a dozen voices whooping up and down (naive saws through three shared formants)
 *  over the roar of the rest (noise through the same formants), swelling and falling in 2.4 s. */
function* cheer(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(2.4));
  const voices = Array.from({ length: 11 }, () => ({
    f0: 190 + r() * 260,
    on: r() * 0.35,
    dur: 0.6 + r() * 1.2,
    rise: 1.15 + r() * 0.35,
    vib: 4 + r() * 3,
    ph: 0,
    amp: 0.5 + r() * 0.5,
  }));
  const formants = [new Biquad('bandpass', 720, 2.5), new Biquad('bandpass', 1240, 3), new Biquad('bandpass', 2600, 4)];
  const fw = [1, 0.7, 0.35];
  const crowd = [new Biquad('bandpass', 650, 1.2), new Biquad('bandpass', 1500, 1.4)];
  for (let i = 0; i < d.length; i++) {
    const t = i / TAKE_RATE;
    let v = 0;
    for (const o of voices) {
      const u = (t - o.on) / o.dur;
      if (u <= 0 || u >= 1) continue;
      // A whoop: up to the peak a third of the way in, down at the end.
      const glide = u < 0.33 ? 1 + (o.rise - 1) * (u / 0.33) : o.rise - (o.rise - 0.85) * ((u - 0.33) / 0.67) ** 1.5;
      const f = o.f0 * glide * (1 + 0.025 * Math.sin(2 * Math.PI * o.vib * t));
      o.ph += f / TAKE_RATE;
      o.ph -= Math.floor(o.ph);
      const env = Math.min(1, u * 8) * (1 - u) ** 0.6;
      v += (o.ph * 2 - 1) * env * o.amp;
    }
    let y = 0;
    for (let k = 0; k < 3; k++) y += formants[k].run(v) * fw[k];
    const n = r() * 2 - 1;
    const sw = Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 0.5) / 0.75);
    y += (crowd[0].run(n) + crowd[1].run(n) * 0.6) * sw * 1.6;
    d[i] = y;
    if (i % SLICE === 0) yield;
  }
  return finish(d, 0.85);
}

/** A two-finger whistle from the bank: a fast rise into a held note and a fall, with breath. */
function* whistle(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(1.0));
  const f0 = 2100 + r() * 400;
  const breath = new Biquad('bandpass', f0, 6);
  let ph = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / TAKE_RATE;
    const f = t < 0.12 ? f0 * (0.7 + 0.3 * (t / 0.12)) : t < 0.55 ? f0 * (1 + 0.04 * (t - 0.12)) : f0 * (1.02 - 0.32 * ((t - 0.55) / 0.4));
    if (i % 32 === 0) breath.set(f, 6);
    ph += (2 * Math.PI * f) / TAKE_RATE;
    const env = Math.min(1, t / 0.03) * (t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.2));
    d[i] = (Math.sin(ph) * 0.8 + breath.run(r() * 2 - 1) * 0.9) * env;
    if (i % SLICE === 0) yield;
  }
  return finish(d, 0.8);
}

/** A cowbell shaken: four to six clanks of two inharmonic partials and a knock. */
function* cowbell(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(1.6));
  let t = 0.004;
  const base = 520 + r() * 120;
  for (let k = 0; k < 6 && t < 1.1; k++) {
    const i0 = Math.floor(t * TAKE_RATE);
    const a = (k === 0 ? 1 : 0.55 + r() * 0.4) * (1 - k * 0.08);
    partial(d, i0, base, a, 0.22, r() * 6);
    partial(d, i0, base * 1.48, a * 0.8, 0.16, r() * 6);
    partial(d, i0, base * 2.61, a * 0.35, 0.07, r() * 6);
    partial(d, i0, base * 3.9, a * 0.18, 0.04, r() * 6);
    // The clapper's knock.
    for (let j = 0; j < 90 && i0 + j < d.length; j++) d[i0 + j] += (r() * 2 - 1) * a * 0.35 * (1 - j / 90);
    t += 0.09 + r() * 0.2;
  }
  yield;
  return finish(d, 0.8);
}

/** Taiko: two hits (don ... don), a pitch-dropping membrane and a slap. */
function* taiko(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(1.6));
  const slap = new Biquad('lowpass', 900, 0.7);
  for (const [at, amp] of [
    [0.004, 1],
    [0.42, 0.8],
  ] as const) {
    const i0 = Math.floor(at * TAKE_RATE);
    let ph = 0;
    for (let k = 0; i0 + k < d.length; k++) {
      const t = k / TAKE_RATE;
      const f = 58 + 34 * Math.exp(-t / 0.06);
      ph += (2 * Math.PI * f) / TAKE_RATE;
      const env = Math.min(1, k / 40) * Math.exp(-t / 0.38);
      const n = t < 0.06 ? slap.run(r() * 2 - 1) * Math.exp(-t / 0.018) * 1.4 : 0;
      d[i0 + k] += (Math.sin(ph) + 0.35 * Math.sin(ph * 2.03)) * env * amp + n * amp;
      if (k % SLICE === 0) yield;
    }
  }
  return finish(d, 0.9);
}

/** A bell's partials (ratios to the strike note, amplitudes, decays), struck once with a knock. */
function* bell(seed: number, seconds: number, f: number, parts: ReadonlyArray<readonly [number, number, number]>, knock: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(seconds));
  for (const [ratio, a, tau] of parts) {
    // Each partial is a pair a hair apart, so the bell beats as it rings.
    yield* partialSliced(d, 1, f * ratio, a * 0.6, tau, r() * 6);
    yield* partialSliced(d, 1, f * ratio * 1.0025, a * 0.4, tau * 0.9, r() * 6);
  }
  for (let j = 0; j < 160; j++) d[1 + j] += (r() * 2 - 1) * knock * (1 - j / 160);
  return finish(d, 0.85);
}

/** Wind chimes stirring: six bars of a pentatonic set struck in a ripple. */
function* chimes(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(3.2));
  const notes = [1046.5, 1174.7, 1396.9, 1568, 1760, 2093];
  let t = 0.004;
  for (let k = 0; k < 7; k++) {
    const f = notes[Math.floor(r() * notes.length)];
    const i0 = Math.floor(t * TAKE_RATE);
    const a = 0.45 + r() * 0.55;
    // A free bar's modes: 1, 2.76, 5.40.
    partial(d, i0, f, a, 0.9, r() * 6);
    partial(d, i0, f * 2.756, a * 0.3, 0.3, r() * 6);
    partial(d, i0, f * 5.404, a * 0.12, 0.1, r() * 6);
    t += 0.08 + r() * 0.38;
    yield;
  }
  return finish(d, 0.75);
}

// ---------------------------------------------------------------- birds

/** Harsh calls: a buzzy glottal saw roughened at about 70 Hz through a beak's formants. */
function* calls(seed: number, seconds: number, n: number, f0: number, dur: number, gap: number, shape: 'caw' | 'crane'): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(seconds));
  const f1 = new Biquad('bandpass', shape === 'caw' ? 1350 : 900, 2.2);
  const f2 = new Biquad('bandpass', shape === 'caw' ? 2500 : 2000, 3);
  const hiss = new Biquad('bandpass', 1800, 1.5);
  let ph = 0;
  let t0 = 0.004;
  for (let c = 0; c < n; c++) {
    const i0 = Math.floor(t0 * TAKE_RATE);
    const cd = dur * (0.85 + r() * 0.3);
    const fc = f0 * (0.93 + r() * 0.14);
    const nn = Math.min(d.length - i0, Math.floor(cd * TAKE_RATE));
    for (let k = 0; k < nn; k++) {
      const u = k / nn;
      const glide = shape === 'caw' ? 1.08 - 0.22 * u : 0.9 + 0.25 * Math.min(1, u * 3) - 0.1 * u;
      const f = fc * glide;
      ph += f / TAKE_RATE;
      ph -= Math.floor(ph);
      const rough = 0.6 + 0.4 * Math.sin((2 * Math.PI * 70 * k) / TAKE_RATE);
      const env = Math.min(1, u * 14) * (1 - u) ** 0.7;
      const src = (ph * 2 - 1) * rough + (shape === 'caw' ? hiss.run(r() * 2 - 1) * 0.9 : 0);
      d[i0 + k] += (f1.run(src) + 0.6 * f2.run(src)) * env;
      if (k % SLICE === 0) yield;
    }
    t0 += cd + gap * (0.8 + r() * 0.5);
  }
  return finish(d, 0.8);
}

/** Wings: half a dozen birds taking off, each flap a soft thump of air, thinning as they climb away. */
function* flaps(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(1.6));
  const lp = new Biquad('lowpass', 1300, 0.8);
  const noise = new Float32Array(d.length);
  for (let b = 0; b < 7; b++) {
    const hz = 8 + r() * 5;
    let t = r() * 0.15;
    const a0 = 0.5 + r() * 0.5;
    while (t < 1.5) {
      const i0 = Math.floor(t * TAKE_RATE);
      const fade = Math.exp(-t / 0.55);
      const w = Math.floor(0.03 * TAKE_RATE);
      for (let k = 0; k < w && i0 + k < d.length; k++) noise[i0 + k] += (r() * 2 - 1) * a0 * fade * Math.sin((Math.PI * k) / w);
      t += (1 / hz) * (0.9 + r() * 0.2);
    }
    yield;
  }
  for (let i = 0; i < d.length; i++) {
    d[i] = lp.run(noise[i]);
    if (i % SLICE === 0) yield;
  }
  return finish(d, 0.8);
}

/** An owl: hoo ... hoo-hoo-hooo, soft sine hoots with breath. */
function* owl(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(2.4));
  const breath = new Biquad('lowpass', 900, 0.7);
  const f0 = 340 + r() * 50;
  let ph = 0;
  const hoots: Array<[number, number]> = [
    [0.004, 0.42],
    [0.85, 0.16],
    [1.08, 0.16],
    [1.32, 0.6],
  ];
  for (const [at, dur] of hoots) {
    const i0 = Math.floor(at * TAKE_RATE);
    const nn = Math.min(d.length - i0, Math.floor(dur * TAKE_RATE));
    for (let k = 0; k < nn; k++) {
      const u = k / nn;
      const f = f0 * (1.03 - 0.06 * u);
      ph += (2 * Math.PI * f) / TAKE_RATE;
      const env = Math.min(1, u * 6) * Math.min(1, (1 - u) * 4);
      d[i0 + k] += (Math.sin(ph) + 0.08 * Math.sin(2 * ph) + breath.run(r() * 2 - 1) * 0.25) * env;
    }
    yield;
  }
  return finish(d, 0.75);
}

// ---------------------------------------------------------------- moods and places

/** Ice under strain: a low groan (a resonance gliding down, driven stick-slip) and the high "pew" of
 *  a frozen lake's crack running away. */
function* creak(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(2.2));
  const res = new Biquad('bandpass', 180, 22);
  let next = 0;
  const groan = Math.floor(1.2 * TAKE_RATE);
  for (let i = 0; i < groan; i++) {
    const u = i / groan;
    if (i % 32 === 0) res.set(190 - 90 * u, 22);
    let x = 0;
    if (i >= next) {
      x = (0.6 + r() * 0.4) * (r() < 0.5 ? -1 : 1);
      next = i + Math.floor(TAKE_RATE / (35 + 45 * r()));
    }
    d[i] = res.run(x) * Math.min(1, u * 6) * (1 - u);
    if (i % SLICE === 0) yield;
  }
  // The crack's "pew": a dispersive chirp falling from about 3 kHz.
  const i0 = Math.floor((0.9 + r() * 0.4) * TAKE_RATE);
  let ph = 0;
  const nn = Math.min(d.length - i0, Math.floor(0.28 * TAKE_RATE));
  for (let k = 0; k < nn; k++) {
    const t = k / TAKE_RATE;
    const f = 700 + 2600 * Math.exp(-t / 0.05);
    ph += (2 * Math.PI * f) / TAKE_RATE;
    d[i0 + k] += Math.sin(ph) * Math.exp(-t / 0.08) * 0.08;
  }
  return finish(d, 0.8);
}

/** Embers: sparse sharp pops, each a tiny ringing click, a few low ones among them. */
function* crackle(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(2.2));
  let t = 0.01;
  while (t < 2.1) {
    const i0 = Math.floor(t * TAKE_RATE);
    const big = r() < 0.15;
    partial(d, i0, big ? 300 + r() * 300 : 1500 + r() * 3500, (big ? 0.7 : 0.25 + r() * 0.5) * (r() < 0.5 ? -1 : 1), big ? 0.012 : 0.003, r() * 6);
    t += -Math.log(1 - r()) / 22;
  }
  yield;
  return finish(d, 0.7);
}

/** A far rumble: brown noise swelling under 120 Hz, a slow thump in it. */
function* rumble(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(4));
  const lp = new Biquad('lowpass', 120, 0.7);
  let br = 0;
  for (let i = 0; i < d.length; i++) {
    const t = i / TAKE_RATE;
    br = (br + 0.02 * (r() * 2 - 1)) / 1.02;
    const env = Math.min(1, t / 0.9) * Math.exp(-Math.max(0, t - 1.2) / 0.9);
    d[i] = lp.run(br) * env;
    if (i % SLICE === 0) yield;
  }
  return finish(d, 0.9);
}

/** A chair through a lift tower: two metal clacks, the sheave's ring, and the hanger creaking. */
function* clack(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(1.3));
  for (const at of [0.004, 0.07]) {
    const i0 = Math.floor(at * TAKE_RATE);
    partial(d, i0, 1250 + r() * 100, 0.6, 0.05, r() * 6);
    partial(d, i0, 2130 + r() * 100, 0.4, 0.035, r() * 6);
    partial(d, i0, 3400, 0.2, 0.02, r() * 6);
    for (let j = 0; j < 60; j++) d[i0 + j] += (r() * 2 - 1) * 0.5 * (1 - j / 60);
  }
  yield;
  // The creak: friction, a sine stuttering at about 18 Hz as it slides down.
  const i0 = Math.floor(0.35 * TAKE_RATE);
  const nn = Math.min(d.length - i0, Math.floor(0.6 * TAKE_RATE));
  let ph = 0;
  for (let k = 0; k < nn; k++) {
    const u = k / nn;
    ph += (2 * Math.PI * (760 - 90 * u)) / TAKE_RATE;
    const stick = Math.max(0, Math.sin((2 * Math.PI * 18 * k) / TAKE_RATE)) ** 3;
    d[i0 + k] += Math.sin(ph) * stick * Math.sin(Math.PI * u) * 0.35;
  }
  return finish(d, 0.75);
}

/** A snowcat's diesel at idle, one seamless loop: 15 firings in 0.6 s (25 Hz), each a dull thump with
 *  a little crank rattle. */
function* diesel(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(0.6));
  const period = d.length / 15;
  for (let p = 0; p < 15; p++) {
    const i0 = Math.floor(p * period);
    const a = 0.75 + r() * 0.25;
    for (let k = 0; k < period * 1.6; k++) {
      const t = k / TAKE_RATE;
      // Wrapped, so the last firing's tail runs into the first: the loop has no seam.
      d[(i0 + k) % d.length] += Math.sin(2 * Math.PI * 82 * t) * Math.exp(-t / 0.012) * a + (r() * 2 - 1) * Math.exp(-t / 0.004) * 0.25 * a;
    }
    if (p % 4 === 0) yield;
  }
  return finish(d, 0.8);
}

/** Powder sloughing off a bough: a soft flump and a patter of what follows it. */
function* slough(seed: number): Gen {
  const r = rng(seed);
  const d = new Float32Array(len(1.6));
  const lp = new Biquad('lowpass', 520, 0.7);
  const hp = new Biquad('highpass', 120, 0.7);
  for (let i = 0; i < d.length; i++) {
    const t = i / TAKE_RATE;
    const flump = Math.min(1, t / 0.04) * Math.exp(-t / 0.18);
    const patter = r() < 0.004 * Math.exp(-t / 0.5) ? r() * 2 - 1 : 0;
    d[i] = hp.run(lp.run((r() * 2 - 1) * flump + patter * 6));
    if (i % SLICE === 0) yield;
  }
  return finish(d, 0.8);
}

/** How many of the recipes below Low hears: the birds and the mood and mountain beds. */
export const LOW_TAKES = 9;

/** Every take's recipe, in the order they are made: Low's first, the crowd's and the lifts' after. */
const RECIPES: ReadonlyArray<readonly [TakeName, () => Gen]> = [
  ['caw', () => calls(11, 1.4, 3, 520, 0.24, 0.12, 'caw')],
  ['flaps', () => flaps(12)],
  ['owl', () => owl(18)],
  ['crane', () => calls(26, 1.4, 2, 380, 0.42, 0.18, 'crane')],
  ['slough', () => slough(20)],
  ['creak', () => creak(21)],
  ['crackle', () => crackle(22)],
  ['rumble', () => rumble(23)],
  ['chimes', () => chimes(24)],
  ['cheer', () => cheer(13)],
  ['cowbell', () => cowbell(14)],
  ['whistle', () => whistle(15)],
  ['clack', () => clack(16)],
  ['church', () => bell(17, 5, 311, [[0.5, 0.5, 2.6], [1, 0.8, 1.6], [1.19, 0.5, 1.1], [1.5, 0.3, 0.9], [2, 0.45, 0.8], [2.51, 0.2, 0.5], [3.01, 0.15, 0.35]], 0.25)],
  ['diesel', () => diesel(19)],
  ['taiko', () => taiko(25)],
  ['temple', () => bell(27, 6, 196, [[0.5, 0.6, 3.2], [1, 0.8, 2.4], [1.21, 0.4, 1.6], [1.53, 0.3, 1.2], [2.02, 0.35, 0.9], [2.77, 0.15, 0.5]], 0.15)],
];

/** Every take name, in the order the bank makes them. */
export const TAKE_NAMES: readonly TakeName[] = RECIPES.map(([n]) => n);

/** The takes, made a slice at a time and kept as AudioBuffers on the context. */
export class TakeBank {
  private readonly ready = new Map<TakeName, AudioBuffer>();
  private next = 0;
  private gen: Gen | null = null;
  /** Probe: samples made so far. */
  samples = 0;

  constructor(private readonly ctx: BaseAudioContext) {}

  /** A take, or null while it is still being made. */
  get(name: TakeName): AudioBuffer | null {
    return this.ready.get(name) ?? null;
  }

  get done(): boolean {
    return this.next >= RECIPES.length && this.gen === null;
  }

  /** Synthesizes for about `budgetMs` (the scheduler pass, between frames), stopping at the first
   *  `upto` recipes. */
  pump(budgetMs: number, upto = RECIPES.length): void {
    if (this.done || budgetMs <= 0 || (this.next >= upto && this.gen === null)) return;
    const clock = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();
    const until = clock() + budgetMs;
    do {
      if (this.next >= upto && this.gen === null) return;
      if (!this.step()) return;
    } while (clock() < until);
  }

  /** Makes every take now (offline renders and tests). */
  finishAll(): void {
    while (this.step());
  }

  /** One slice of the take being made; false once every take is made. */
  private step(): boolean {
    if (!this.gen) {
      if (this.next >= RECIPES.length) return false;
      this.gen = RECIPES[this.next][1]();
    }
    const r = this.gen.next();
    if (r.done) {
      const name = RECIPES[this.next][0];
      const d = r.value;
      try {
        const buf = this.ctx.createBuffer(1, d.length, TAKE_RATE);
        buf.getChannelData(0).set(d);
        this.ready.set(name, buf);
      } catch {
        // A context that cannot hold a 32 kHz buffer: that sound stays silent.
      }
      this.samples += d.length;
      this.gen = null;
      this.next++;
    }
    return true;
  }
}

/** Test hook: a take's samples, made in one go. */
export function synthesize(name: TakeName): Float32Array {
  const rec = RECIPES.find(([n]) => n === name);
  if (!rec) throw new Error(`no take ${name}`);
  const g = rec[1]();
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}
