import { Biquad, Delay, SR, type Stereo, TAU, db, secs, stereo, tc } from './dsp';

// The renderer's space and dynamics (round 7): a feedback-delay-network reverb with early reflections, a
// tempo delay, a chorus, a compressor whose gain can be computed on one signal and applied to others (so
// stems are mastered together and still sum to the mastered mix), a kick's duck, tape, width that folds
// to mono, and a lookahead limiter.

export interface VerbOpts {
  /** Room size, 1 = a hall whose longest line is about 70 ms. */
  size: number;
  /** Seconds to -60 dB in the mids. */
  t60: number;
  /** Where the highs start to die faster, Hz. */
  damp: number;
  /** Seconds before the first reflection. */
  pre: number;
  /** Early reflections against the tail, 0..1. */
  early: number;
  /** The wet signal's band. */
  lo: number;
  hi: number;
}

export const HALL: VerbOpts = { size: 1, t60: 2.4, damp: 6500, pre: 0.022, early: 0.45, lo: 220, hi: 9000 };
export const PLATE: VerbOpts = { size: 0.55, t60: 1.5, damp: 9000, pre: 0.008, early: 0.25, lo: 260, hi: 11000 };
export const ROOM: VerbOpts = { size: 0.4, t60: 0.7, damp: 7000, pre: 0.004, early: 0.7, lo: 180, hi: 10000 };
export const CAVERN: VerbOpts = { size: 1.5, t60: 4.6, damp: 4800, pre: 0.035, early: 0.3, lo: 240, hi: 8000 };

const LINES = [1423, 1637, 1873, 2143, 2423, 2713, 3049, 3391];
const ER_MS = [7.1, 11.3, 17.9, 23.3, 31.7, 41.9, 53.3, 67.1];
const ER_PAN = [-0.6, 0.7, -0.2, 0.4, 0.9, -0.8, 0.1, -0.4];

/**
 * A stereo reverb, wet only: pre-delay, eight early reflections, two allpass diffusers a side, then an
 * eight-line feedback delay network (a Householder mix, a damping lowpass in every line, two lines
 * slowly modulated so no mode rings). The tail's length is `t60`; the input is read past its end until
 * the tail is written.
 */
export function reverb(input: Stereo, o: VerbOpts): Stereo {
  const n = input.l.length;
  const out = stereo(n);
  const pre = Math.max(1, secs(o.pre));
  const preL = new Delay(pre + secs(0.08));
  const preR = new Delay(pre + secs(0.08));
  const len = LINES.map((x) => Math.round(x * o.size));
  const lines = len.map((x) => new Delay(x + 64));
  const g = len.map((x) => Math.pow(10, (-3 * x) / (o.t60 * SR)));
  const kd = 1 - Math.exp((-TAU * o.damp) / SR);
  const lp = new Float64Array(8);
  const apLen = [142, 379, 107, 277].map((x) => Math.round(x * Math.max(0.6, o.size)));
  const ap = apLen.map((x) => new Delay(x + 4));
  const erN = ER_MS.map((ms) => Math.round((ms / 1000) * SR * Math.max(0.5, o.size)));
  const erG = ER_MS.map((_, i) => 0.7 * Math.pow(0.82, i));
  const erP = ER_PAN.map((p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)]);
  const v = new Float64Array(8);
  const allpass = (d: Delay, m: number, x: number): number => {
    const z = d.readInt(m);
    const y = -0.6 * x + z;
    d.write(x + 0.6 * y);
    return y;
  };
  let ph1 = 0;
  let ph2 = 0.3;
  const early = o.early;
  for (let i = 0; i < n; i++) {
    preL.write(input.l[i]);
    preR.write(input.r[i]);
    const xl = preL.readInt(pre);
    const xr = preR.readInt(pre);
    // Early reflections: the room's first walls, each from its own side.
    let el = 0;
    let er = 0;
    for (let k = 0; k < 8; k++) {
      const s = (k & 1 ? preR : preL).readInt(pre + erN[k]) * erG[k];
      el += s * erP[k][0];
      er += s * erP[k][1];
    }
    const dl = allpass(ap[1], apLen[1], allpass(ap[0], apLen[0], xl));
    const dr = allpass(ap[3], apLen[3], allpass(ap[2], apLen[2], xr));
    ph1 += (TAU * 0.31) / SR;
    ph2 += (TAU * 0.47) / SR;
    let sum = 0;
    for (let k = 0; k < 8; k++) {
      const d = k === 0 ? lines[0].read(len[0] + 5 * Math.sin(ph1)) : k === 4 ? lines[4].read(len[4] + 6 * Math.sin(ph2)) : lines[k].readInt(len[k]);
      lp[k] += (d - lp[k]) * kd;
      v[k] = lp[k] * g[k];
      sum += v[k];
    }
    const h = sum * 0.25;
    for (let k = 0; k < 8; k++) lines[k].write((k & 1 ? dr : dl) * 0.5 + v[k] - h);
    out.l[i] = early * el + (1 - early * 0.4) * 0.5 * (v[0] - v[2] + v[4] - v[6] + 0.6 * (v[1] + v[5]));
    out.r[i] = early * er + (1 - early * 0.4) * 0.5 * (v[1] - v[3] + v[5] - v[7] + 0.6 * (v[2] + v[6]));
  }
  for (const ch of [out.l, out.r]) {
    Biquad.design('hp', o.lo, 0.7).run(ch);
    Biquad.design('lp', o.hi, 0.7).run(ch);
  }
  return out;
}

/** A ping-pong delay, wet only: the mono sum goes left first, each repeat darker and thinner. */
export function pingPong(input: Stereo, time: number, feedback: number, lo = 300, hi = 4200): Stereo {
  const n = input.l.length;
  const out = stereo(n);
  const d = Math.max(1, secs(time));
  const a = new Delay(d);
  const b = new Delay(d);
  const lpA = Biquad.design('lp', hi, 0.6);
  const hpA = Biquad.design('hp', lo, 0.6);
  const lpB = Biquad.design('lp', hi, 0.6);
  const hpB = Biquad.design('hp', lo, 0.6);
  for (let i = 0; i < n; i++) {
    const x = (input.l[i] + input.r[i]) * 0.5;
    const ya = a.readInt(d);
    const yb = b.readInt(d);
    a.write(x + hpB.tick(lpB.tick(yb)) * feedback);
    b.write(hpA.tick(lpA.tick(ya)) * feedback);
    out.l[i] = ya;
    out.r[i] = yb;
  }
  return out;
}

/** A chorus in place: two slow modulated taps, one a side, mixed under the dry. */
export function chorus(b: Stereo, depthMs = 3, rate = 0.6, mix = 0.35): Stereo {
  const base = secs(0.012);
  const dep = (depthMs / 1000) * SR;
  const dl = new Delay(base + dep + 8);
  const dr = new Delay(base + dep + 8);
  let ph = 0;
  for (let i = 0; i < b.l.length; i++) {
    ph += (TAU * rate) / SR;
    dl.write(b.l[i]);
    dr.write(b.r[i]);
    const wl = dl.read(base + dep * (0.5 + 0.5 * Math.sin(ph)));
    const wr = dr.read(base + dep * (0.5 + 0.5 * Math.sin(ph + 2.1)));
    b.l[i] = b.l[i] * (1 - mix * 0.4) + wr * mix;
    b.r[i] = b.r[i] * (1 - mix * 0.4) + wl * mix;
  }
  return b;
}

export interface CompOpts {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee?: number;
  makeup?: number;
}

/** The gain a compressor would apply to `b` (linear, per sample, makeup included): stereo-linked peak
 *  detection, a soft knee, attack and release in the dB domain. */
export function compGain(b: Stereo, o: CompOpts): Float32Array {
  const n = b.l.length;
  const g = new Float32Array(n);
  const ka = tc(o.attack);
  const kr = tc(o.release);
  const knee = o.knee ?? 6;
  const mk = o.makeup ?? 0;
  let red = 0;
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(b.l[i]), Math.abs(b.r[i]));
    const lv = 20 * Math.log10(p + 1e-9);
    const over = lv - o.threshold;
    let want = 0;
    if (over > knee / 2) want = over * (1 - 1 / o.ratio);
    else if (over > -knee / 2) want = ((over + knee / 2) * (over + knee / 2) * (1 - 1 / o.ratio)) / (2 * knee);
    red += (want - red) * (want > red ? ka : kr);
    g[i] = Math.pow(10, (mk - red) / 20);
  }
  return g;
}

export function applyGain(b: Stereo, g: Float32Array): Stereo {
  for (let i = 0; i < b.l.length; i++) {
    b.l[i] *= g[i];
    b.r[i] *= g[i];
  }
  return b;
}

export function compress(b: Stereo, o: CompOpts): Stereo {
  return applyGain(b, compGain(b, o));
}

/** The kick's duck: a gain curve that dips by `depth` (0..1) at each time in `hits` and comes back over
 *  `release` seconds, the pump of a sidechain without a detector. */
export function duckCurve(n: number, hits: readonly number[], depth: number, release = 0.18, attack = 0.006): Float32Array {
  const g = new Float32Array(n).fill(1);
  const an = Math.max(1, secs(attack));
  const rn = secs(release * 4);
  for (const t of hits) {
    const at = secs(t);
    for (let i = 0; i < an + rn && at + i < n; i++) {
      const v = i < an ? 1 - depth * (i / an) : 1 - depth * Math.exp(-(i - an) / (release * SR));
      if (at + i >= 0 && v < g[at + i]) g[at + i] = v;
    }
  }
  return g;
}

/** Tape: a soft clip at twice the sample rate (a short FIR up and down), so its harmonics do not fold. */
export function saturate(b: Stereo, drive: number, mix = 1): Stereo {
  const k = 1 / Math.tanh(drive);
  for (const ch of [b.l, b.r]) {
    let prev = 0;
    let z = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const mid = 0.5 * (x + prev);
      const y0 = Math.tanh(mid * drive) * k;
      const y1 = Math.tanh(x * drive) * k;
      const y = 0.25 * z + 0.5 * y0 + 0.25 * y1;
      z = y1;
      prev = x;
      ch[i] = x + (y - x) * mix;
    }
  }
  return b;
}

/** Stereo width by mid and side: the side scaled by `w`, and nothing under `monoBelow` Hz left in it, so
 *  the low end is the same in one speaker as in two. */
export function width(b: Stereo, w: number, monoBelow = 140): Stereo {
  const hp = Biquad.design('hp', monoBelow, 0.7);
  for (let i = 0; i < b.l.length; i++) {
    const m = (b.l[i] + b.r[i]) * 0.5;
    const s = hp.tick((b.l[i] - b.r[i]) * 0.5) * w;
    b.l[i] = m + s;
    b.r[i] = m - s;
  }
  return b;
}

/**
 * The gain of a lookahead limiter for `b` at `ceilingDb` (linear, per sample), and its delay in samples:
 * the gain each sample needs is held as a sliding minimum over the lookahead, released slowly and
 * smoothed over the same window, so it is down before the peak arrives. Apply it to the signal delayed
 * by `delay` (applyLimiter): to a mix, or to each of its stems.
 */
export function limiterGain(b: Stereo, ceilingDb: number, lookMs = 2, release = 0.12): { gain: Float32Array; delay: number } {
  const n = b.l.length;
  const c = db(ceilingDb);
  const L = Math.max(8, secs(lookMs / 1000));
  const need = new Float32Array(n + L);
  need.fill(1);
  for (let i = 0; i < n; i++) {
    // A peak between samples can stand a little over both of its neighbours: read them half a sample apart.
    const a = Math.max(Math.abs(b.l[i]), Math.abs(b.r[i]));
    const m = i > 0 ? Math.max(Math.abs(b.l[i] + b.l[i - 1]), Math.abs(b.r[i] + b.r[i - 1])) * 0.55 : 0;
    const p = Math.max(a, m);
    need[i] = p > c ? c / p : 1;
  }
  const gain = new Float32Array(n);
  const kr = tc(release);
  // Sliding minimum over [i, i + L) with a monotonic queue.
  const q = new Int32Array(n + L);
  let head = 0;
  let tail = 0;
  let rel = 1;
  const box = new Float32Array(L).fill(1);
  let bi = 0;
  let sum = L;
  for (let i = 0; i < n; i++) {
    const j = i + L - 1;
    while (tail > head && need[q[tail - 1]] >= need[j]) tail--;
    q[tail++] = j;
    while (q[head] < i) head++;
    const m = need[q[head]];
    rel = m < rel ? m : rel + (1 - rel) * kr;
    const v = Math.min(m, rel);
    sum += v - box[bi];
    box[bi] = v;
    bi = (bi + 1) % L;
    gain[i] = Math.min(v, sum / L);
  }
  return { gain, delay: 0 };
}

/** A limiter's gain applied in place. (The gain already looks ahead, so the signal is not delayed.) */
export function applyLimiter(b: Stereo, lim: { gain: Float32Array }): Stereo {
  return applyGain(b, lim.gain);
}

/** A reversed copy (a reverse cymbal, a swell into a downbeat). */
export function reverse(b: Stereo): Stereo {
  return { l: b.l.slice().reverse(), r: b.r.slice().reverse() };
}

/** A linear fade in and out, in place. */
export function fades(b: Stereo, inS: number, outS: number): Stereo {
  const n = b.l.length;
  const a = Math.min(n, secs(inS));
  const z = Math.min(n, secs(outS));
  for (let i = 0; i < a; i++) {
    b.l[i] *= i / a;
    b.r[i] *= i / a;
  }
  for (let i = 0; i < z; i++) {
    const k = i / z;
    b.l[n - 1 - i] *= k;
    b.r[n - 1 - i] *= k;
  }
  return b;
}

