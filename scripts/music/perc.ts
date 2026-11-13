import { Biquad, Rng, SR, TAU, eqMono, fadeTail, mtof, secs, stereo } from './dsp';
import { type Inst, type Partial, ring } from './inst';

// The renderer's drums and percussion (round 7), all synthesised: kicks and booms (a sine that falls,
// a click, a clip), snares and claps (tone and noise), stomps on a wooden floor, hats and shakers
// (bands of noise and clustered metal partials), drums with skins (the modes of a round membrane, the
// big barrel drum's long low ring), struck metal (anvils and plates by modal synthesis), cymbals, and
// the risers and booms that mark a drop. A note's pitch is used where a drum has one; its velocity
// always is.

const env = (i: number, tau: number): number => Math.exp(-i / (tau * SR));

function burst(len: number, rng: Rng, tau: number, lo: number, hi: number, q = 0.7): Float32Array {
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) x[i] = rng.bip() * env(i, tau);
  if (lo > 0) Biquad.design('hp', lo, q).run(x);
  if (hi > 0) Biquad.design('lp', hi, q).run(x);
  return x;
}

export interface KickOpts {
  /** Where the pitch starts and settles, Hz, and how fast it falls (s). */
  from: number;
  to: number;
  sweep: number;
  /** Seconds to -60 dB. */
  decay: number;
  /** The beater's click, 0..1, and how hard the body is clipped. */
  click: number;
  drive: number;
}

export const KICK_TIGHT: KickOpts = { from: 150, to: 50, sweep: 0.035, decay: 0.32, click: 0.5, drive: 1.6 };
export const KICK_DEEP: KickOpts = { from: 190, to: 41, sweep: 0.05, decay: 0.55, click: 0.7, drive: 2.6 };
export const KICK_SOFT: KickOpts = { from: 110, to: 52, sweep: 0.03, decay: 0.3, click: 0.15, drive: 1.1 };
export const KICK_CLUB: KickOpts = { from: 170, to: 46, sweep: 0.045, decay: 0.42, click: 0.6, drive: 2 };

export function kick(o: KickOpts): Inst {
  return (n, rng) => {
    const len = secs(o.decay * 1.3);
    const out = new Float32Array(len);
    let p = 0;
    const k = 1 / Math.tanh(o.drive);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const f = o.to + (o.from - o.to) * Math.exp(-t / o.sweep);
      p += (TAU * f) / SR;
      out[i] = Math.tanh(Math.sin(p) * o.drive * Math.exp(-t / (o.decay / 6.9)) * Math.min(1, i / 24)) * k;
    }
    const c = burst(secs(0.02), rng, 0.003, 1800, 9000);
    for (let i = 0; i < c.length; i++) out[i] += c[i] * o.click;
    const v = 0.35 + 0.65 * n.v;
    for (let i = 0; i < len; i++) out[i] *= v;
    return fadeTail(out, 15);
  };
}

/** A long low boom under a drop: a sub that falls for a second. */
export function boom(): Inst {
  return (n, rng) => {
    const len = secs(2.2);
    const out = new Float32Array(len);
    let p = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      p += (TAU * (38 + 70 * Math.exp(-t / 0.09))) / SR;
      out[i] = Math.tanh(Math.sin(p) * 2.2 * Math.exp(-t / 0.5)) * 0.9;
    }
    const c = burst(secs(0.4), rng, 0.06, 60, 900);
    for (let i = 0; i < c.length; i++) out[i] += c[i] * 0.5;
    for (let i = 0; i < len; i++) out[i] *= 0.4 + 0.6 * n.v;
    return fadeTail(out, 60);
  };
}

export interface SnareOpts {
  /** The shell's two tones, Hz, and their decay. */
  tone: number;
  toneDecay: number;
  /** The wires: decay, band and level. */
  wires: number;
  lo: number;
  hi: number;
  noise: number;
}

export const SNARE_CRISP: SnareOpts = { tone: 195, toneDecay: 0.11, wires: 0.17, lo: 1400, hi: 11000, noise: 1 };
export const SNARE_BIG: SnareOpts = { tone: 150, toneDecay: 0.2, wires: 0.34, lo: 700, hi: 9000, noise: 1.25 };
export const SNARE_FIELD: SnareOpts = { tone: 230, toneDecay: 0.07, wires: 0.12, lo: 2000, hi: 12000, noise: 1.1 };
export const RIM: SnareOpts = { tone: 420, toneDecay: 0.035, wires: 0.02, lo: 2500, hi: 9000, noise: 0.35 };

export function snare(o: SnareOpts): Inst {
  return (n, rng) => {
    const len = secs(Math.max(o.toneDecay, o.wires) * 1.6 + 0.02);
    const out = new Float32Array(len);
    let p = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      p += (TAU * o.tone * (1 + 0.5 * Math.exp(-t / 0.008))) / SR;
      out[i] = (Math.sin(p) + 0.5 * Math.sin(p * 1.71)) * Math.exp(-t / (o.toneDecay / 6.9)) * 0.7;
    }
    const w = burst(len, rng, o.wires / 6.9, o.lo, o.hi);
    // Ghost notes are mostly wires; a full stroke has the shell in it.
    const v = n.v;
    for (let i = 0; i < len; i++) out[i] = (out[i] * v * v + w[i] * o.noise * (0.25 + 0.75 * v)) * 0.8;
    for (let i = 0; i < 12; i++) out[i] *= i / 12;
    return fadeTail(out, 10);
  };
}

/** Hand claps from a small crowd: each pair of hands a few bursts of noise a few ms apart, no two pairs
 *  together or in the same band. Stereo. */
export function claps(people = 4): Inst {
  return (n, rng) => {
    const len = secs(0.4);
    const out = stereo(len);
    for (let k = 0; k < people; k++) {
      const r = rng.fork(k);
      const at = Math.floor(r.next() * secs(0.022));
      const fc = 900 + r.next() * 900;
      const x = new Float32Array(len);
      for (let b = 0; b < 3; b++) {
        const s = at + b * secs(0.009 + r.next() * 0.004);
        const tau = b === 2 ? 0.045 : 0.006;
        for (let i = s; i < len; i++) x[i] += r.bip() * env(i - s, tau) * (b === 2 ? 1 : 0.7);
      }
      Biquad.design('bp', fc, 1.1).run(x);
      Biquad.design('hp', 500, 0.7).run(x);
      const pan = people > 1 ? (k / (people - 1)) * 2 - 1 : 0;
      const a = ((pan * 0.7 + 1) * Math.PI) / 4;
      const g = (0.35 + 0.65 * n.v) * 1.6 / Math.sqrt(people);
      for (let i = 0; i < len; i++) {
        out.l[i] += x[i] * Math.cos(a) * g;
        out.r[i] += x[i] * Math.sin(a) * g;
      }
    }
    fadeTail(out.l);
    fadeTail(out.r);
    return out;
  };
}

/** A boot on a wooden floor: a low thud, the board's knock, the dust. */
export function stomp(): Inst {
  return (n, rng) => {
    const len = secs(0.45);
    const out = new Float32Array(len);
    let p = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      p += (TAU * (58 + 55 * Math.exp(-t / 0.02))) / SR;
      out[i] = Math.sin(p) * Math.exp(-t / 0.07);
    }
    ring(out, 185 + rng.bip() * 10, 0.4, 0.03);
    ring(out, 310 + rng.bip() * 20, 0.25, 0.018);
    const d = burst(secs(0.12), rng, 0.02, 150, 2400);
    for (let i = 0; i < d.length; i++) out[i] += d[i] * 0.45;
    const v = 0.35 + 0.65 * n.v;
    for (let i = 0; i < len; i++) out[i] = Math.tanh(out[i] * 1.5) * 0.8 * v;
    return fadeTail(out);
  };
}

export interface HatOpts {
  /** Seconds to -60 dB closed; an open hat rings for the note's length. */
  decay: number;
  /** The band's floor, Hz. */
  lo: number;
  /** 0 all noise (a soft, sandy hat), 1 all metal (six clashing square partials). */
  metal: number;
}

const HAT_RATIOS = [1, 1.342, 1.2312, 1.6532, 1.9523, 2.1523];

export function hat(o: HatOpts, open = false): Inst {
  return (n, rng) => {
    const dec = open ? Math.max(0.18, n.dur) : o.decay;
    const len = secs(dec * 1.2 + 0.01);
    const out = new Float32Array(len);
    const ph = HAT_RATIOS.map(() => rng.next());
    for (let i = 0; i < len; i++) {
      let m = 0;
      for (let k = 0; k < 6; k++) {
        ph[k] += (540 * HAT_RATIOS[k] * 6.2) / SR;
        m += ph[k] % 1 < 0.5 ? 1 : -1;
      }
      out[i] = ((m / 6) * o.metal + rng.bip() * (1 - o.metal * 0.6)) * Math.exp(-i / ((dec / 6.9) * SR));
    }
    Biquad.design('hp', o.lo, 0.8).run(out);
    Biquad.design('hp', o.lo * 0.8, 0.7).run(out);
    Biquad.design('lp', 15000, 0.7).run(out);
    const v = 0.25 + 0.75 * n.v;
    for (let i = 0; i < len; i++) out[i] *= v;
    for (let i = 0; i < 8; i++) out[i] *= i / 8;
    return fadeTail(out, 6);
  };
}

/** A shaker: grains of noise that swell and stop, never a click. */
export function shaker(lo = 4500, hi = 11000): Inst {
  return (n, rng) => {
    const len = secs(0.11);
    const out = new Float32Array(len);
    const a = secs(0.018 - 0.01 * n.v);
    for (let i = 0; i < len; i++) out[i] = rng.bip() * (i < a ? i / a : Math.exp(-(i - a) / (0.014 * SR)));
    Biquad.design('hp', lo, 0.8).run(out);
    Biquad.design('lp', hi, 0.8).run(out);
    const v = 0.3 + 0.7 * n.v;
    for (let i = 0; i < len; i++) out[i] *= v;
    return fadeTail(out, 5);
  };
}

/** A tambourine, or a strap of sleigh bells: many small jingles, each a couple of high partials, struck a
 *  few ms apart. Stereo. */
export function jingles(count = 7, base = 5200, tail = 0.16): Inst {
  return (n, rng) => {
    const len = secs(tail * 1.6);
    const out = stereo(len);
    for (let k = 0; k < count; k++) {
      const r = rng.fork(k);
      const at = Math.floor(r.next() * secs(0.02));
      const f = base * (0.75 + r.next() * 1.1);
      const ch = k % 2 ? out.l : out.r;
      ring(ch, f, 0.2, tail / 6.9 * (0.6 + r.next() * 0.8), r.next(), at);
      ring(ch, f * 1.52, 0.12, tail / 9, r.next(), at);
    }
    const hiss = burst(len, rng, 0.02, 6000, 14000);
    const v = 0.3 + 0.7 * n.v;
    for (let i = 0; i < len; i++) {
      out.l[i] = (out.l[i] + hiss[i] * 0.25) * v;
      out.r[i] = (out.r[i] + hiss[i] * 0.25) * v;
    }
    fadeTail(out.l);
    fadeTail(out.r);
    return out;
  };
}

/** The modes of a round skin against its fundamental. */
const SKIN: readonly number[] = [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.16, 3.5];

export interface SkinOpts {
  /** Seconds to -60 dB for the fundamental. */
  decay: number;
  /** How far the pitch falls after the stroke (a slack skin falls far), as a ratio over 1. */
  fall: number;
  /** The stick: its click and the band of its noise. */
  stick: number;
  /** How much of the upper modes sound (a soft mallet wakes few). */
  modes: number;
  drive?: number;
}

export const TOM: SkinOpts = { decay: 0.5, fall: 0.25, stick: 0.5, modes: 0.5 };
export const TAIKO: SkinOpts = { decay: 1.3, fall: 0.18, stick: 0.9, modes: 0.8, drive: 1.8 };
export const FRAME_DRUM: SkinOpts = { decay: 0.6, fall: 0.1, stick: 0.25, modes: 0.4 };
export const TIMPANI: SkinOpts = { decay: 2.2, fall: 0.04, stick: 0.15, modes: 0.35 };
export const BASS_DRUM: SkinOpts = { decay: 1.6, fall: 0.3, stick: 0.1, modes: 0.25 };

/** A drum with a skin: the membrane's modes over a fundamental that falls as the skin settles. */
export function skin(o: SkinOpts): Inst {
  return (n, rng) => {
    const f0 = mtof(n.m);
    const len = secs(o.decay * 1.15);
    const out = new Float32Array(len);
    const ph = SKIN.map(() => rng.next() * 0.5);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const bend = 1 + o.fall * Math.exp(-t / 0.045);
      let x = 0;
      for (let k = 0; k < SKIN.length; k++) {
        const a = k === 0 ? 1 : (o.modes * (0.3 + 0.7 * n.v)) / (1 + k * 0.55);
        ph[k] += (f0 * SKIN[k] * bend) / SR;
        x += a * Math.sin(TAU * ph[k]) * Math.exp(-t / (o.decay / 6.9 / (1 + k * 0.8)));
      }
      out[i] = x;
    }
    const st = burst(secs(0.05), rng, 0.006, 600, 7000);
    for (let i = 0; i < st.length; i++) out[i] += st[i] * o.stick * (0.3 + 0.7 * n.v);
    const dr = o.drive ?? 1;
    const v = 0.35 + 0.65 * n.v;
    for (let i = 0; i < len; i++) out[i] = (dr > 1 ? Math.tanh(out[i] * dr) / Math.tanh(dr) : out[i]) * v * 0.8;
    for (let i = 0; i < 16; i++) out[i] *= i / 16;
    return fadeTail(out, 20);
  };
}

/** Struck metal by its modes. An anvil rings high and short; a plate or a pipe clangs lower and longer; a
 *  girder is the low one. */
const METAL: Record<'anvil' | 'plate' | 'pipe' | 'girder', { partials: readonly Partial[]; strike: number }> = {
  anvil: { partials: [[1, 1, 0.5], [1.47, 0.7, 0.42], [2.09, 0.55, 0.3], [2.56, 0.45, 0.24], [3.14, 0.3, 0.18], [4.2, 0.25, 0.12], [5.4, 0.15, 0.08]], strike: 0.8 },
  plate: { partials: [[1, 1, 1.4], [1.31, 0.8, 1.2], [1.83, 0.7, 0.9], [2.41, 0.6, 0.8], [2.95, 0.5, 0.6], [3.7, 0.4, 0.45], [4.6, 0.3, 0.3], [6.1, 0.2, 0.2]], strike: 1 },
  pipe: { partials: [[1, 1, 0.9], [2.76, 0.6, 0.5], [5.4, 0.35, 0.25], [8.93, 0.2, 0.12]], strike: 0.6 },
  girder: { partials: [[1, 1, 1.8], [1.19, 0.6, 1.5], [2.3, 0.7, 1], [3.6, 0.4, 0.6], [5.1, 0.3, 0.35]], strike: 1.2 },
};

export function metal(kind: keyof typeof METAL, drive = 1.5): Inst {
  const k = METAL[kind];
  return (n, rng) => {
    const f0 = mtof(n.m);
    let longest = 0;
    for (const p of k.partials) longest = Math.max(longest, p[2]);
    const len = secs(longest * 1.1);
    const make = (r: Rng, cents: number): Float32Array => {
      const out = new Float32Array(len);
      for (const [ratio, amp, dec] of k.partials) ring(out, f0 * ratio * Math.pow(2, cents / 1200) * (1 + r.bip() * 0.004), amp * Math.pow(0.4 + 0.6 * n.v, 1 + ratio * 0.15), dec / 6.9, r.next());
      const st = burst(secs(0.03), r, 0.004, 1500, 12000);
      for (let i = 0; i < st.length; i++) out[i] += st[i] * k.strike * (0.3 + 0.7 * n.v);
      const g = 1 / Math.tanh(drive);
      for (let i = 0; i < len; i++) out[i] = Math.tanh(out[i] * 0.5 * drive) * g * 0.7;
      for (let i = 0; i < 8; i++) out[i] *= i / 8;
      return fadeTail(out, 15);
    };
    return { l: make(rng.fork(1), -5), r: make(rng.fork(2), 5) };
  };
}

/** A wood block, a temple block or claves: one bar of wood, gone in a moment. */
export function wood(decay = 0.09): Inst {
  return (n, rng) => {
    const f0 = mtof(n.m);
    const out = new Float32Array(secs(decay * 1.5));
    ring(out, f0, 1, decay / 6.9);
    ring(out, f0 * 2.47, 0.35, decay / 12);
    ring(out, f0 * 4.1, 0.15, decay / 20);
    const c = burst(secs(0.01), rng, 0.0015, 1500, 9000);
    for (let i = 0; i < c.length; i++) out[i] += c[i] * 0.4;
    const v = 0.3 + 0.7 * n.v;
    for (let i = 0; i < out.length; i++) out[i] *= v * 0.8;
    for (let i = 0; i < 8; i++) out[i] *= i / 8;
    return fadeTail(out);
  };
}

/** A cymbal: hundreds of modes are noise with a metallic grain, so: clustered square partials and noise
 *  through a high band, bright at the stroke and darkening as it dies. Stereo. `soft`: rolled, no stroke. */
export function cymbal(decay = 2.2, lo = 3200, soft = false): Inst {
  return (n, rng) => {
    const len = secs(decay * 1.1);
    const side = (r: Rng): Float32Array => {
      const out = new Float32Array(len);
      const ph = new Float64Array(10);
      const fr = new Float64Array(10);
      for (let k = 0; k < 10; k++) {
        ph[k] = r.next();
        fr[k] = (2400 + 7400 * r.next()) / SR;
      }
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        let m = 0;
        for (let k = 0; k < 10; k++) {
          ph[k] += fr[k];
          m += ph[k] % 1 < 0.5 ? 1 : -1;
        }
        const x = m * 0.07 + r.bip() * 0.6;
        // The top dies first.
        const kk = 0.9 * Math.exp(-t / (decay * 0.5)) + 0.08;
        lp += (x - lp) * kk;
        const a = soft ? Math.min(1, t / 0.25) : Math.min(1, i / 48);
        out[i] = lp * a * Math.exp(-t / (decay / 6.9));
      }
      Biquad.design('hp', lo, 0.7).run(out);
      const v = 0.3 + 0.7 * n.v;
      for (let i = 0; i < len; i++) out[i] *= v;
      return fadeTail(out, 40);
    };
    return { l: side(rng.fork(1)), r: side(rng.fork(2)) };
  };
}

/**
 * A riser: noise through a band that climbs for the whole of the note, swelling to its end, with a tone
 * sliding up under it. It ends at the note's end, on the drop. `tone`: how much pitched slide, 0..1.
 */
export function riser(tone = 0.4, from = 300, to = 9000): Inst {
  return (n, rng) => {
    const len = secs(n.dur);
    const out = stereo(len);
    const f0 = mtof(n.m);
    [out.l, out.r].forEach((ch, side) => {
      const r = rng.fork(side);
      let ic1 = 0;
      let ic2 = 0;
      let p = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        const fc = from * Math.pow(to / from, x);
        const g = Math.tan((Math.PI * fc) / SR);
        const kq = 1 / 1.6;
        const a1 = 1 / (1 + g * (g + kq));
        const v3 = r.bip() - ic2;
        const v1 = a1 * ic1 + g * a1 * v3;
        const v2 = ic2 + g * a1 * ic1 + g * g * a1 * v3;
        ic1 = 2 * v1 - ic1;
        ic2 = 2 * v2 - ic2;
        p += (TAU * f0 * Math.pow(2, x * x * 2 + (side ? 0.004 : -0.004))) / SR;
        const a = Math.pow(x, 2.2) * (0.3 + 0.7 * n.v);
        ch[i] = (v1 * 0.9 + tone * Math.sin(p) * 0.5) * a;
      }
      const z = Math.min(len, 96);
      for (let i = 0; i < z; i++) ch[len - 1 - i] *= i / z;
    });
    return out;
  };
}

/** Wind chimes or a bell tree: a run of small high bells, down or up, over the note's length. Stereo. */
export function chimes(up = false, count = 14): Inst {
  return (n, rng) => {
    const len = secs(n.dur + 1.6);
    const out = stereo(len);
    for (let k = 0; k < count; k++) {
      const x = k / (count - 1);
      const at = secs(n.dur * x * (0.9 + rng.next() * 0.1));
      const f = mtof(n.m + 24 * (up ? x : 1 - x) + rng.bip() * 0.6);
      const ch = k % 2 ? out.l : out.r;
      const other = k % 2 ? out.r : out.l;
      const a = 0.22 * (0.4 + 0.6 * n.v) * (0.7 + 0.3 * rng.next());
      ring(ch, f, a, 0.22, 0, at);
      ring(ch, f * 2.76, a * 0.3, 0.08, 0, at);
      ring(other, f, a * 0.35, 0.22, 0.5, at);
    }
    fadeTail(out.l, 30);
    fadeTail(out.r, 30);
    return out;
  };
}

/** Steam or a scrape: a burst of noise in a band, for the forge's machines. */
export function hiss(lo = 2500, hi = 9000, attack = 0.004): Inst {
  return (n, rng) => {
    const len = secs(n.dur + 0.08);
    const out = new Float32Array(len);
    const a = secs(attack);
    const hold = secs(n.dur);
    for (let i = 0; i < len; i++) out[i] = rng.bip() * (i < a ? i / a : i < hold ? 1 - 0.5 * ((i - a) / Math.max(1, hold - a)) : 0.5 * Math.exp(-(i - hold) / (0.015 * SR)));
    eqMono(out, [['hp', lo, 0.9], ['lp', hi, 0.9]]);
    const v = 0.3 + 0.7 * n.v;
    for (let i = 0; i < len; i++) out[i] *= v * 0.6;
    return fadeTail(out);
  };
}

