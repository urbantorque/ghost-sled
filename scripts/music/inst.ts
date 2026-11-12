import { Biquad, type EqBand, Pulse, Rng, SR, Saw, type Stereo, Svf, TAU, adsr, bend, clamp, eqMono, fadeTail, mtof, panGains, secs, stereo, tc } from './dsp';

// The renderer's pitched instruments (round 7). Each is a function from one note to its sound, mono or
// stereo, starting at the note's first sample: physical models where a model is the sound (plucked
// strings), source and body where it is a player's gesture (the fiddle's bow, a brass attack that
// brightens as it swells, breath in a flute), modal and FM bells, additive piano, pads and a choir of
// formants. None of them is a recording or a copy of one.

export interface Note {
  /** Seconds from the section's first beat. */
  t: number;
  /** Seconds held. */
  dur: number;
  /** MIDI pitch (fractions bend). */
  m: number;
  /** Velocity, 0..1. */
  v: number;
  /** Semitones the note starts off its pitch and slides in from (a fiddle's cut, a bass slide). */
  slide?: number;
  /** Pan offset for this note alone. */
  pan?: number;
}

export type Voice = Float32Array | Stereo;
export type Inst = (n: Note, rng: Rng) => Voice;

/** A decaying sine added into `out` by recursion (two multiplies a sample): amp * r^n * sin(w n + ph). */
export function ring(out: Float32Array, f: number, amp: number, tau: number, ph = 0, from = 0): void {
  if (f >= SR * 0.47 || amp === 0) return;
  const w = (TAU * f) / SR;
  const r = Math.exp(-1 / (Math.max(1e-4, tau) * SR));
  const k = 2 * r * Math.cos(w);
  const r2 = r * r;
  let y2 = amp * Math.sin(ph - w) / r;
  let y1 = amp * Math.sin(ph);
  const n = Math.min(out.length, from + Math.ceil(tau * SR * 9));
  for (let i = from; i < n; i++) {
    out[i] += y1;
    const y = k * y1 - r2 * y2;
    y2 = y1;
    y1 = y;
  }
}

// ------------------------------------------------------------------- plucked strings

export interface PluckOpts {
  /** 0 dark to 1 bright: how little the string's highs are damped each trip round. */
  bright: number;
  /** Seconds for the fundamental to fall 60 dB when left to ring. */
  decay: number;
  /** Where the string is plucked, 0..0.5 of its length (near the bridge is thin and nasal). */
  pick: number;
  body: 'guitar' | 'koto' | 'harp' | 'bass' | 'mando' | 'none';
  /** The string rings on after the note ends (a harp, a koto) instead of being damped. */
  ringOut?: boolean;
  /** A muted stroke: the hand on the strings. */
  mute?: boolean;
}

const BODY: Record<PluckOpts['body'], readonly EqBand[]> = {
  guitar: [['hp', 72, 0.7], ['peak', 105, 2.2, 4], ['peak', 215, 2, 3], ['peak', 410, 2, 1.5], ['peak', 2600, 1.2, 2], ['hishelf', 6000, 0.7, 2.5]],
  koto: [['hp', 110, 0.7], ['peak', 330, 2.5, 3], ['peak', 1250, 1.6, 4.5], ['peak', 3400, 1.4, 3], ['lp', 11000, 0.7]],
  harp: [['hp', 60, 0.7], ['peak', 250, 1.5, 2], ['peak', 1800, 1, 1.5], ['lp', 7500, 0.7]],
  bass: [['hp', 34, 0.7], ['peak', 85, 1.6, 3.5], ['peak', 750, 1.2, 2.5], ['lp', 2600, 0.7]],
  mando: [['hp', 190, 0.7], ['peak', 900, 1.8, 4], ['peak', 2900, 1.5, 3], ['hishelf', 7000, 0.7, 2]],
  none: [],
};

/**
 * A plucked string (Karplus and Strong's loop, extended): a period of noise shaped by the pick's place and
 * force goes round a delay line, losing a little each trip, more of it in the highs. The loop's length
 * is tuned with an allpass, so a note is in tune to a few cents at any pitch; a body of resonances
 * follows.
 */
export function pluck(o: PluckOpts): Inst {
  return (n, rng) => {
    const f0 = mtof(n.m);
    const P = SR / f0;
    const s = clamp(0.5 - 0.47 * (o.mute ? o.bright * 0.4 : o.bright), 0.02, 0.5);
    const N = Math.floor(P - s - 0.2);
    const d = P - s - N;
    const C = (1 - d) / (1 + d);
    const t60 = o.mute ? 0.09 : o.decay * Math.pow(220 / f0, 0.35);
    const rho = Math.pow(10, (-3 * P) / (t60 * SR));
    const rhoOff = Math.pow(10, (-3 * P) / (0.11 * SR));
    const held = secs(n.dur);
    const len = held + secs(o.ringOut ? Math.min(t60, 3.2) : 0.35);
    const out = new Float32Array(len);
    if (N < 2) return out;
    // The excitation: one period of noise, darker for a soft stroke, combed by the pick's position.
    const line = new Float32Array(N);
    const k = tc(0.00002 + 0.0005 * (1 - n.v) * (1.2 - o.bright));
    let lp = 0;
    let mean = 0;
    for (let i = 0; i < N; i++) {
      lp += (rng.bip() - lp) * k;
      line[i] = lp;
      mean += lp;
    }
    mean /= N;
    const pk = Math.max(1, Math.round(clamp(o.pick, 0.04, 0.5) * N));
    const ex = new Float32Array(N);
    let top = 1e-9;
    for (let i = 0; i < N; i++) {
      ex[i] = line[i] - mean - (line[(i - pk + N) % N] - mean);
      top = Math.max(top, Math.abs(ex[i]));
    }
    for (let i = 0; i < N; i++) line[i] = (ex[i] / top) * (0.35 + 0.65 * n.v);
    let w = 0;
    let x1 = 0;
    let ap1 = 0;
    let apy = 0;
    for (let i = 0; i < len; i++) {
      const y = line[w];
      out[i] = y;
      const f = (1 - s) * y + s * x1;
      x1 = y;
      const a = C * f + ap1 - C * apy;
      ap1 = f;
      apy = a;
      line[w] = a * (i < held || o.ringOut ? rho : rhoOff);
      w = w + 1 === N ? 0 : w + 1;
    }
    eqMono(out, BODY[o.body]);
    return fadeTail(out, 12);
  };
}

// ------------------------------------------------------------------- bowed strings

export interface BowOpts {
  body: 'violin' | 'viola' | 'cello' | 'bass';
  /** Players: 1 is a soloist, more is a section spread across the stage. */
  voices: number;
  bright: number;
  /** Vibrato depth in cents, and seconds before it starts. */
  vib: number;
  vibDelay?: number;
  /** Seconds for the bow to take the string. */
  attack: number;
  /** Stage width, 0..1. */
  spread?: number;
}

const BOW_BODY: Record<BowOpts['body'], readonly EqBand[]> = {
  violin: [['hp', 185, 0.7], ['peak', 285, 4, 5], ['peak', 470, 4, 4], ['peak', 720, 3, 2], ['peak', 2600, 1.1, 5], ['lp', 8500, 0.7]],
  viola: [['hp', 125, 0.7], ['peak', 220, 4, 5], ['peak', 380, 4, 4], ['peak', 1900, 1.1, 4], ['lp', 7000, 0.7]],
  cello: [['hp', 62, 0.7], ['peak', 110, 3, 4], ['peak', 185, 3, 4], ['peak', 320, 3, 2], ['peak', 1500, 1.1, 4], ['lp', 5200, 0.7]],
  bass: [['hp', 36, 0.7], ['peak', 70, 3, 4], ['peak', 140, 3, 3], ['peak', 900, 1.1, 3], ['lp', 3200, 0.7]],
};

/**
 * A bowed string: the string under a bow moves as a sawtooth, so a band-limited saw is the source; the
 * player is in the envelope (the bow biting, then drawing), the pitch (a cut sliding into the note, a
 * vibrato that waits and then widens, the small wander of a hand) and the bow's hiss; the instrument is
 * a body of fixed resonances with a bridge hill over them.
 */
export function bowed(o: BowOpts): Inst {
  return (n, rng) => {
    const held = secs(n.dur);
    const rel = secs(0.11);
    const len = held + rel + secs(0.02);
    const out = stereo(len);
    const env = adsr(len, o.attack * (1.25 - 0.5 * n.v), 0.25, 0.86, 0.09, n.dur);
    const vd = o.vibDelay ?? 0.16;
    const spread = o.spread ?? (o.voices > 1 ? 0.7 : 0);
    for (let v = 0; v < o.voices; v++) {
      const r = rng.fork(v);
      const mono = new Float32Array(len);
      const det = o.voices > 1 ? r.bip() * 7 : 0;
      const late = o.voices > 1 ? Math.floor(r.next() * secs(0.018)) : 0;
      const saw = new Saw(r.next());
      const lp = new Svf();
      const vibRate = 5.3 + r.bip() * 0.5;
      let wander = 0;
      let ph = r.next() * TAU;
      const f0 = mtof(n.m);
      const base = clamp(f0 * (3.5 + 9 * o.bright * (0.45 + 0.55 * n.v)), 900, 9000);
      const hiss = Biquad.design('bp', 3600, 0.8);
      for (let i = late; i < len; i++) {
        const t = (i - late) / SR;
        wander += (r.bip() * 4 - wander) * 0.0006;
        const vibIn = n.dur > 0.24 ? clamp((t - vd) / 0.3, 0, 1) : 0;
        ph += (TAU * vibRate) / SR;
        const slide = n.slide && t < 0.2 ? n.slide * 100 * Math.exp(-t / 0.022) : 0;
        const f = f0 * bend(det + wander + o.vib * vibIn * Math.sin(ph) + slide);
        const e = env[i - late];
        const x = saw.tick(f / SR) + hiss.tick(r.bip()) * (0.05 + (t < 0.25 ? 0.25 * Math.exp(-t / 0.03) : 0));
        mono[i] = lp.tick(x, base * (0.55 + 0.45 * e), 0.9) * e;
      }
      const pan = o.voices > 1 ? (v / (o.voices - 1)) * 2 - 1 : 0;
      const [gl, gr] = panGains(pan * spread);
      const g = (0.5 + 0.5 * n.v) / Math.sqrt(o.voices);
      for (let i = 0; i < len; i++) {
        out.l[i] += mono[i] * gl * g;
        out.r[i] += mono[i] * gr * g;
      }
    }
    // The body is the same wood for every player: one pass a side.
    eqMono(out.l, BOW_BODY[o.body]);
    eqMono(out.r, BOW_BODY[o.body]);
    fadeTail(out.l);
    fadeTail(out.r);
    return out;
  };
}

// ------------------------------------------------------------------- brass

export interface BrassOpts {
  kind: 'trumpet' | 'horn' | 'trombone' | 'tuba';
  voices: number;
  /** 0 a plain attack and hold, 1 a crescendo through the whole note. */
  swell?: number;
  spread?: number;
}

const BRASS: Record<BrassOpts['kind'], { open: number; eq: readonly EqBand[]; att: number }> = {
  trumpet: { open: 15, att: 0.028, eq: [['hp', 160, 0.7], ['peak', 1250, 1.4, 4], ['peak', 2600, 1.4, 3], ['lp', 9000, 0.7]] },
  horn: { open: 7, att: 0.05, eq: [['hp', 80, 0.7], ['peak', 450, 1.6, 4], ['lp', 3000, 0.7]] },
  trombone: { open: 11, att: 0.04, eq: [['hp', 60, 0.7], ['peak', 520, 1.5, 4], ['peak', 1500, 1.4, 2], ['lp', 5200, 0.7]] },
  tuba: { open: 6, att: 0.06, eq: [['hp', 34, 0.7], ['peak', 230, 1.5, 4], ['lp', 1500, 0.7]] },
};

/**
 * Brass: a saw through a lowpass that opens with the player's breath, so a loud note is a bright note and
 * a swell is heard as tone, not only as level. The attack scoops up to pitch with a little of the lip's
 * noise in it. A section is several players a few cents and a few milliseconds apart.
 */
export function brass(o: BrassOpts): Inst {
  const k = BRASS[o.kind];
  return (n, rng) => {
    const held = secs(n.dur);
    const len = held + secs(0.16);
    const out = stereo(len);
    const sw = o.swell ?? 0;
    const spread = o.spread ?? (o.voices > 1 ? 0.5 : 0);
    for (let v = 0; v < o.voices; v++) {
      const r = rng.fork(v);
      const mono = new Float32Array(len);
      const det = o.voices > 1 ? r.bip() * 6 : 0;
      const late = o.voices > 1 ? Math.floor(r.next() * secs(0.014)) : 0;
      const env = adsr(len, k.att, 0.18, 0.8, 0.07, n.dur);
      const saw = new Saw(r.next());
      const lp = new Svf();
      const f0 = mtof(n.m);
      for (let i = late; i < len; i++) {
        const t = (i - late) / SR;
        let e = env[i - late];
        if (sw > 0 && i < held) e *= 1 - sw + sw * Math.pow(i / Math.max(1, held), 1.6);
        const early = t < 0.15;
        const f = f0 * bend(det - (early ? 28 * Math.exp(-t / 0.018) : 0));
        const breath = e * (0.35 + 0.65 * n.v);
        const x = saw.tick(f / SR) + (early ? r.bip() * 0.12 * Math.exp(-t / 0.02) : 0);
        mono[i] = lp.tick(x, clamp(f0 * (1.4 + k.open * breath * breath), 200, 11000), 0.8) * e;
      }
      const pan = o.voices > 1 ? (v / (o.voices - 1)) * 2 - 1 : 0;
      const [gl, gr] = panGains(pan * spread);
      const g = (0.4 + 0.6 * n.v) / Math.sqrt(o.voices);
      for (let i = 0; i < len; i++) {
        out.l[i] += mono[i] * gl * g;
        out.r[i] += mono[i] * gr * g;
      }
    }
    eqMono(out.l, k.eq);
    eqMono(out.r, k.eq);
    fadeTail(out.l);
    fadeTail(out.r);
    return out;
  };
}

// ------------------------------------------------------------------- winds

export interface WindOpts {
  kind: 'flute' | 'shaku' | 'whistle';
  /** How much air is in the tone, 0..1. */
  breath: number;
  /** Vibrato depth in cents. */
  vib: number;
  /** Cents under the note the attack starts from. */
  scoop: number;
}

/**
 * A flute: nearly a sine with a little second and third harmonic, and the player's air as band-passed
 * noise round the note, loudest in the chiff of the attack. The bamboo flute has more air, odd harmonics,
 * a deeper scoop into the note and an unsteady pitch; the whistle is the plain bright one.
 */
export function wind(o: WindOpts): Inst {
  return (n, rng) => {
    const held = secs(n.dur);
    const len = held + secs(0.14);
    const out = new Float32Array(len);
    const att = o.kind === 'shaku' ? 0.07 : o.kind === 'whistle' ? 0.02 : 0.045;
    const env = adsr(len, att, 0.3, 0.85, 0.08, n.dur);
    const f0 = mtof(n.m);
    const bp = new Svf();
    const air = Biquad.design('hp', 3200, 0.7);
    let p1 = 0;
    let ph = rng.next() * TAU;
    let flutter = 0;
    const h2 = o.kind === 'shaku' ? 0.12 : o.kind === 'whistle' ? 0.22 : 0.32;
    const h3 = o.kind === 'shaku' ? 0.3 : 0.1;
    const rate = o.kind === 'shaku' ? 4.4 : 5;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const e = env[i];
      const vibIn = n.dur > 0.3 ? clamp((t - 0.18) / 0.35, 0, 1) : 0;
      ph += (TAU * rate) / SR;
      flutter += (rng.bip() * (o.kind === 'shaku' ? 9 : 3) - flutter) * 0.0008;
      const early = t < 0.4;
      const slide = n.slide && early ? n.slide * 100 * Math.exp(-t / 0.03) : 0;
      const cents = (early ? -o.scoop * Math.exp(-t / 0.045) : 0) + o.vib * vibIn * Math.sin(ph) + flutter + slide;
      const f = f0 * bend(cents);
      p1 += (TAU * f) / SR;
      const tone = Math.sin(p1) + h2 * e * Math.sin(2 * p1) + h3 * e * Math.sin(3 * p1);
      const w = rng.bip();
      const chiff = early ? 1 + 3.5 * Math.exp(-t / 0.035) : 1;
      bp.tick(w, f * 2, 1.4);
      const noise = bp.bp * 0.9 + air.tick(w) * 0.12;
      out[i] = (tone * (1 - 0.35 * o.breath) * (1 + 0.08 * vibIn * Math.sin(ph)) + noise * o.breath * chiff) * e * (0.35 + 0.65 * n.v);
    }
    eqMono(out, o.kind === 'shaku' ? [['hp', 180, 0.7], ['peak', 1100, 1.2, 3], ['lp', 7500, 0.7]] : [['hp', 220, 0.7], ['lp', 9500, 0.7]]);
    return fadeTail(out);
  };
}

// ------------------------------------------------------------------- bells

export interface FmBellOpts {
  /** Modulator over carrier: 3.5 a bell, 2.76 glass, 5.19 a small chime, 1 a soft mallet. */
  ratio: number;
  /** How bright the strike is. */
  index: number;
  /** Seconds to -60 dB. */
  decay: number;
  /** Cents between the two sides. */
  spread?: number;
}

/** An FM bell: one modulator a side, its depth dying faster than the tone, the two sides a few cents apart. */
export function fmBell(o: FmBellOpts): Inst {
  return (n) => {
    const t60 = o.decay * Math.pow(440 / mtof(n.m), 0.3);
    const len = Math.max(secs(n.dur), secs(Math.min(t60, 6))) + secs(0.05);
    const out = stereo(len);
    const tauA = t60 / 6.9;
    const tauI = tauA * 0.35;
    const cents = o.spread ?? 4;
    [out.l, out.r].forEach((ch, side) => {
      const f = mtof(n.m + ((side ? 1 : -1) * cents) / 200);
      const wc = (TAU * f) / SR;
      const wm = wc * o.ratio;
      const idx = o.index * (0.4 + 0.6 * n.v);
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const a = Math.min(1, i / 48) * Math.exp(-t / tauA);
        ch[i] = Math.sin(wc * i + idx * Math.exp(-t / tauI) * Math.sin(wm * i)) * a * (0.3 + 0.7 * n.v);
      }
      fadeTail(ch, 20);
    });
    return out;
  };
}

/** One partial of a struck thing: its pitch against the note's, its level, and seconds to -60 dB. */
export type Partial = readonly [ratio: number, amp: number, decay: number];

export interface ModalOpts {
  partials: readonly Partial[];
  /** The strike: a burst of noise, its level, its length in ms and its band. */
  strike?: { amp: number; ms: number; lo: number; hi: number };
  /** Decays scale with pitch: low notes ring longer by this power. */
  track?: number;
  /** Cents of random detune a note (a hand-made thing is never quite in tune). */
  loose?: number;
  eq?: readonly EqBand[];
  /** Cents between the two sides (stereo when set). */
  spread?: number;
}

/** A struck bar, tube, bowl or tine: a sum of decaying partials and the noise of the strike. */
export function modal(o: ModalOpts): Inst {
  return (n, rng) => {
    const f0 = mtof(n.m + ((o.loose ?? 0) * rng.bip()) / 100);
    const k = Math.pow(440 / f0, o.track ?? 0.3);
    let longest = 0.05;
    for (const p of o.partials) if (f0 * p[0] < SR * 0.45) longest = Math.max(longest, p[2] * k);
    const len = Math.max(secs(n.dur * 0.2), secs(Math.min(longest, 7))) + secs(0.05);
    const make = (cents: number, r: Rng): Float32Array => {
      const out = new Float32Array(len);
      const f = f0 * Math.pow(2, cents / 1200);
      for (const [ratio, amp, dec] of o.partials) {
        // A hard strike wakes the upper partials more than a soft one.
        const hard = Math.pow(0.35 + 0.65 * n.v, 1 + Math.log2(Math.max(1, ratio)) * 0.6);
        ring(out, f * ratio, amp * hard, (dec * k) / 6.9, r.next() * 0.4);
      }
      if (o.strike) {
        const sn = secs(o.strike.ms / 1000);
        const burst = new Float32Array(Math.min(len, sn * 4));
        for (let i = 0; i < burst.length; i++) burst[i] = r.bip() * Math.exp(-i / sn) * o.strike.amp * (0.3 + 0.7 * n.v);
        Biquad.design('hp', o.strike.lo, 0.7).run(burst);
        Biquad.design('lp', o.strike.hi, 0.7).run(burst);
        for (let i = 0; i < burst.length; i++) out[i] += burst[i];
      }
      if (o.eq) eqMono(out, o.eq);
      for (let i = 0; i < 24 && i < len; i++) out[i] *= i / 24;
      return fadeTail(out, 20);
    };
    if (o.spread === undefined) return make(0, rng);
    return { l: make(-o.spread / 2, rng.fork(1)), r: make(o.spread / 2, rng.fork(2)) };
  };
}

/** A music box's comb: a steel tine (a clamped bar: its overtones are far up and gone at once), the pin's
 *  click, a small wooden box. */
export const musicBox = (): Inst =>
  modal({
    partials: [[1, 1, 2.6], [2.02, 0.06, 1.1], [6.27, 0.22, 0.22], [17.5, 0.07, 0.06]],
    strike: { amp: 0.25, ms: 1.5, lo: 3500, hi: 14000 },
    track: 0.45,
    loose: 5,
    eq: [['hp', 240, 0.7], ['peak', 1400, 1.2, 3]],
    spread: 3,
  });

/** A tubular or hand bell: the hum, the strike note, the tierce, the quint and the nominal over them. */
export const churchBell = (): Inst =>
  modal({
    partials: [[0.5, 0.35, 7], [1, 1, 5], [1.183, 0.5, 3.6], [1.506, 0.35, 2.6], [2, 0.6, 2.4], [2.514, 0.25, 1.6], [2.662, 0.2, 1.4], [3.011, 0.2, 1.1], [4.166, 0.12, 0.7]],
    strike: { amp: 0.2, ms: 3, lo: 1200, hi: 9000 },
    track: 0.25,
    spread: 5,
  });

/** A glass rim or bowl: nearly pure, a slow beat between two close partials. */
export const glass = (): Inst =>
  modal({ partials: [[1, 1, 3.2], [1.004, 0.6, 3.0], [2.32, 0.18, 1.2], [4.25, 0.08, 0.5]], strike: { amp: 0.08, ms: 2, lo: 2500, hi: 12000 }, track: 0.35, spread: 6 });

/** A glockenspiel bar. */
export const glock = (): Inst =>
  modal({ partials: [[1, 1, 2.2], [2.76, 0.3, 0.8], [5.4, 0.12, 0.3], [8.93, 0.05, 0.12]], strike: { amp: 0.18, ms: 1.2, lo: 3000, hi: 15000 }, track: 0.4, spread: 3 });

/** A marimba or wooden bar: the fourth harmonic tuned in, gone quickly. */
export const marimba = (): Inst =>
  modal({ partials: [[1, 1, 0.9], [3.93, 0.25, 0.25], [9.2, 0.06, 0.08]], strike: { amp: 0.2, ms: 3, lo: 300, hi: 4000 }, track: 0.5, eq: [['hp', 90, 0.7]] });

// ------------------------------------------------------------------- piano

/**
 * A felt piano: every string a sum of slightly stretched harmonics, two strings a note a hair apart so the
 * tone beats, the highs rolled off as felt between hammer and string rolls them off (less when struck
 * hard), each harmonic dying faster than the one under it, and the hammer's soft thump in front.
 */
export function feltPiano(bright = 0.5): Inst {
  return (n, rng) => {
    const f0 = mtof(n.m);
    const tau0 = clamp(1.6 * Math.pow(220 / f0, 0.55), 0.35, 4.5);
    const held = secs(n.dur);
    const len = held + secs(0.5);
    const out = new Float32Array(len);
    const B = 0.00035 * Math.pow(f0 / 261.6, 0.9);
    const fc = (700 + 2600 * bright) * (0.45 + 0.9 * n.v);
    const K = Math.min(26, Math.floor(10000 / f0));
    for (const cents of [-0.7, 0.8]) {
      const fs = f0 * Math.pow(2, cents / 1200);
      for (let k = 1; k <= K; k++) {
        const f = k * fs * Math.sqrt(1 + B * k * k);
        const amp = (0.5 / Math.pow(k, 1.05)) * Math.exp((-k * f0) / fc);
        if (amp < 1e-4) break;
        ring(out, f, amp, tau0 / (1 + 0.22 * (k - 1)), rng.next() * 0.3);
      }
    }
    // The hammer: a soft thump, and the action's small knock.
    const hn = secs(0.012);
    const thump = new Float32Array(hn * 5);
    for (let i = 0; i < thump.length; i++) thump[i] = rng.bip() * Math.exp(-i / hn);
    Biquad.design('bp', clamp(f0 * 2.2, 250, 1400), 0.9).run(thump);
    for (let i = 0; i < thump.length && i < len; i++) out[i] += thump[i] * 0.5 * n.v;
    // The damper comes down at the note's end.
    const kr = Math.exp(-1 / (0.09 * SR));
    let g = 1;
    for (let i = held; i < len; i++) {
      g *= kr;
      out[i] *= g;
    }
    for (let i = 0; i < 48 && i < len; i++) out[i] *= i / 48;
    const v = 0.3 + 0.7 * n.v;
    for (let i = 0; i < len; i++) out[i] *= v;
    return fadeTail(eqMono(out, [['hp', 45, 0.7], ['peak', 260, 1, 1.5]]), 20);
  };
}

/** An electric piano: a tine's ping over a bell-like FM body that barks when struck hard, drifting slowly
 *  from side to side. */
export function ePiano(): Inst {
  return (n, rng) => {
    const f0 = mtof(n.m);
    const held = secs(n.dur);
    const len = held + secs(0.35);
    const out = stereo(len);
    const wc = (TAU * f0) / SR;
    const idx = 1.1 * n.v * n.v + 0.15;
    const tau = clamp(1.6 * Math.pow(220 / f0, 0.4), 0.5, 3);
    const ph = rng.next() * TAU;
    const kr = Math.exp(-1 / (0.07 * SR));
    let g = 1;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      if (i >= held) g *= kr;
      const a = Math.min(1, i / 96) * Math.exp(-t / tau) * g * (0.3 + 0.7 * n.v);
      const body = Math.sin(wc * i + idx * Math.exp(-t / (tau * 0.5)) * Math.sin(wc * i));
      const tine = 0.18 * Math.exp(-t / 0.05) * Math.sin(wc * 14 * i);
      const x = (body + tine) * a;
      const pan = 0.28 * Math.sin(ph + TAU * 0.9 * t);
      out.l[i] = x * (1 - pan);
      out.r[i] = x * (1 + pan);
    }
    fadeTail(out.l);
    fadeTail(out.r);
    return out;
  };
}

// ------------------------------------------------------------------- pads

export interface PadOpts {
  /** Saws a note, and cents from the outermost to the centre. */
  voices: number;
  detune: number;
  /** The lowpass at rest and fully open, Hz. */
  cutoff: number;
  open: number;
  attack: number;
  release: number;
  /** Resonance. */
  q?: number;
}

/** A supersaw pad: detuned saws spread across the stage through one slow lowpass a side. */
export function superSaw(o: PadOpts): Inst {
  return (n, rng) => {
    const held = secs(n.dur);
    const len = held + secs(o.release * 1.6);
    const out = stereo(len);
    const env = adsr(len, o.attack, 0.6, 0.85, o.release, n.dur);
    const saws: Saw[] = [];
    const dts: number[] = [];
    const pans: Array<[number, number]> = [];
    for (let v = 0; v < o.voices; v++) {
      const x = o.voices > 1 ? (v / (o.voices - 1)) * 2 - 1 : 0;
      saws.push(new Saw(rng.next()));
      dts.push(mtof(n.m + (x * Math.abs(x) * o.detune) / 100 + (rng.bip() * 1.5) / 100) / SR);
      pans.push(panGains(v % 2 ? x * 0.9 : -x * 0.9));
    }
    const fl = new Svf();
    const fr = new Svf();
    const g = (0.3 + 0.7 * n.v) / Math.sqrt(o.voices);
    const q = o.q ?? 0.7;
    for (let i = 0; i < len; i++) {
      let l = 0;
      let r = 0;
      for (let v = 0; v < saws.length; v++) {
        const s = saws[v].tick(dts[v]);
        l += s * pans[v][0];
        r += s * pans[v][1];
      }
      const e = env[i];
      const fc = o.cutoff + (o.open - o.cutoff) * e * e;
      out.l[i] = fl.tick(l, fc, q) * e * g;
      out.r[i] = fr.tick(r, fc, q) * e * g;
    }
    fadeTail(out.l, 30);
    fadeTail(out.r, 30);
    return out;
  };
}

/** A glass pad: a few harmonics a side that swap places slowly, so the tone moves without a filter; cold
 *  and still against the supersaw's warmth. */
export function glassPad(attack = 0.8, release = 1.2): Inst {
  return (n, rng) => {
    const held = secs(n.dur);
    const len = held + secs(release * 1.5);
    const out = stereo(len);
    const env = adsr(len, attack, 0.5, 0.9, release, n.dur);
    const f0 = mtof(n.m);
    const H = [1, 2, 3, 4, 6, 8];
    [out.l, out.r].forEach((ch, side) => {
      const det = Math.pow(2, ((side ? 3 : -3) + rng.bip()) / 1200);
      const ph = H.map(() => rng.next() * TAU);
      const lf = H.map(() => 0.07 + rng.next() * 0.16);
      const lp = H.map(() => rng.next() * TAU);
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        let x = 0;
        for (let k = 0; k < H.length; k++) {
          const f = f0 * H[k] * det;
          if (f > 15000) continue;
          const a = (0.55 + 0.45 * Math.sin(lp[k] + TAU * lf[k] * t)) / (1 + k * 0.9);
          x += a * Math.sin(ph[k] + (TAU * f * i) / SR);
        }
        ch[i] = x * env[i] * 0.4 * (0.3 + 0.7 * n.v);
      }
      fadeTail(ch, 30);
    });
    return out;
  };
}

type Vowel = 'ah' | 'oh' | 'oo' | 'mm';
/** Formants: [centre Hz, level dB, bandwidth Hz], high voices then low. */
const FORMANTS: Record<'hi' | 'lo', Record<Vowel, ReadonlyArray<readonly [number, number, number]>>> = {
  hi: {
    ah: [[800, 0, 80], [1150, -6, 90], [2900, -24, 120], [3900, -20, 130]],
    oh: [[450, 0, 70], [800, -11, 80], [2830, -22, 100], [3800, -24, 130]],
    oo: [[325, 0, 50], [700, -16, 60], [2700, -32, 170], [3800, -36, 180]],
    mm: [[280, 0, 60], [1000, -26, 90], [2500, -36, 150], [3300, -40, 180]],
  },
  lo: {
    ah: [[650, 0, 80], [1080, -6, 90], [2650, -12, 120], [2900, -14, 130]],
    oh: [[400, 0, 70], [800, -10, 80], [2600, -18, 100], [2800, -18, 120]],
    oo: [[350, 0, 50], [600, -18, 60], [2700, -24, 100], [2900, -22, 120]],
    mm: [[250, 0, 60], [900, -28, 90], [2400, -36, 120], [2800, -38, 130]],
  },
};

export interface ChoirOpts {
  /** The vowel the note opens on and the one it settles to. */
  from: Vowel;
  to: Vowel;
  voices: number;
  attack: number;
  release: number;
  /** Air in the voice, 0..1. */
  breath?: number;
}

/**
 * A choir pad: each singer is a narrow pulse (a voice's buzz) with its own drift and a vibrato that comes
 * in late, a little air beside it, through two banks of vowel formants that cross from one vowel to the
 * other over the note. Voices like, not voices: no words, and no one's.
 */
export function choir(o: ChoirOpts): Inst {
  return (n, rng) => {
    const held = secs(n.dur);
    const len = held + secs(o.release * 1.6);
    const out = stereo(len);
    const env = adsr(len, o.attack, 0.5, 0.9, o.release, n.dur);
    const reg = n.m >= 60 ? 'hi' : 'lo';
    const src = stereo(len);
    for (let v = 0; v < o.voices; v++) {
      const r = rng.fork(v);
      const osc = new Pulse(r.next());
      const det = r.bip() * 9;
      const rate = 4.9 + r.bip() * 0.6;
      let ph = r.next() * TAU;
      let drift = 0;
      const pan = o.voices > 1 ? ((v / (o.voices - 1)) * 2 - 1) * 0.8 : 0;
      const [gl, gr] = panGains(pan);
      const f0 = mtof(n.m);
      const late = Math.floor(r.next() * secs(0.03));
      for (let i = late; i < len; i++) {
        const t = i / SR;
        drift += (r.bip() * 7 - drift) * 0.0004;
        ph += (TAU * rate) / SR;
        const vib = clamp((t - 0.35) / 0.5, 0, 1) * 11 * Math.sin(ph);
        const f = f0 * bend(det + drift + vib);
        const x = osc.tick(f / SR, 0.22) + r.bip() * (o.breath ?? 0.25) * 0.5;
        src.l[i] += x * gl;
        src.r[i] += x * gr;
      }
    }
    const g = (0.3 + 0.7 * n.v) / Math.sqrt(o.voices);
    [[src.l, out.l], [src.r, out.r]].forEach(([s, d]) => {
      const bank = (vw: Vowel): Float32Array => {
        const acc = new Float32Array(len);
        for (const [fc, lv, bw] of FORMANTS[reg][vw]) {
          const y = Biquad.design('bp', fc, fc / bw).run(s.slice());
          const a = Math.pow(10, lv / 20);
          for (let i = 0; i < len; i++) acc[i] += y[i] * a;
        }
        return acc;
      };
      const a = bank(o.from);
      const b = o.to === o.from ? a : bank(o.to);
      for (let i = 0; i < len; i++) {
        const x = clamp(i / Math.max(1, held * 0.6), 0, 1);
        d[i] = (a[i] * (1 - x) + b[i] * x) * env[i] * g * 1.6;
      }
      fadeTail(d, 30);
    });
    return out;
  };
}

// ------------------------------------------------------------------- basses

/** A sub: a sine with a little second harmonic so a small speaker still says the note. */
export function subBass(harm = 0.3, attack = 0.008, release = 0.07): Inst {
  return (n) => {
    const held = secs(n.dur);
    const len = held + secs(release * 3);
    const out = new Float32Array(len);
    const env = adsr(len, attack, 0.2, 0.9, release, n.dur);
    const f0 = mtof(n.m);
    let p = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const f = n.slide && t < 0.4 ? mtof(n.m + n.slide * Math.exp(-t / 0.04)) : f0;
      p += (TAU * f) / SR;
      out[i] = Math.tanh((Math.sin(p) + harm * Math.sin(2 * p) + harm * 0.4 * Math.sin(3 * p)) * 1.2) * env[i] * (0.4 + 0.6 * n.v);
    }
    return fadeTail(out);
  };
}

/** A synth bass pluck: a saw and a square an octave down through a lowpass that snaps shut, a sine under it. */
export function synthBass(cut = 9, snap = 0.11, q = 1.6): Inst {
  return (n, rng) => {
    const held = secs(n.dur);
    const len = held + secs(0.12);
    const out = new Float32Array(len);
    const env = adsr(len, 0.004, 0.3, 0.75, 0.04, n.dur);
    const f0 = mtof(n.m);
    const saw = new Saw(rng.next());
    const sq = new Pulse(rng.next());
    const lp = new Svf();
    let p = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      p += (TAU * f0) / SR;
      const x = saw.tick(f0 / SR) * 0.7 + sq.tick(f0 / 2 / SR, 0.5) * 0.4;
      const fc = f0 * (1.6 + cut * (0.4 + 0.6 * n.v) * Math.exp(-t / snap));
      out[i] = (lp.tick(x, fc, q) + 0.55 * Math.sin(p)) * env[i] * (0.4 + 0.6 * n.v);
    }
    return fadeTail(out);
  };
}

/** A distorted bass: two saws and a square through a lowpass, then driven hard into a clipper (run at
 *  twice the rate, so the grit does not fold) and a cabinet's band. */
export function distBass(drive = 5, tone = 3200): Inst {
  return (n, rng) => {
    const held = secs(n.dur);
    const len = held + secs(0.09);
    const out = new Float32Array(len);
    const env = adsr(len, 0.003, 0.2, 0.85, 0.03, n.dur);
    const f0 = mtof(n.m);
    const a = new Saw(rng.next());
    const b = new Saw(rng.next());
    const sq = new Pulse(rng.next());
    const lp = new Svf();
    let prev = 0;
    let z = 0;
    let p = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const f = n.slide && t < 0.3 ? mtof(n.m + n.slide * Math.exp(-t / 0.03)) : f0;
      p += (TAU * f) / SR;
      const src = a.tick((f * 1.004) / SR) * 0.5 + b.tick((f * 0.996) / SR) * 0.5 + sq.tick(f / SR, 0.5) * 0.35;
      const x = lp.tick(src, f0 * (3 + 10 * n.v * Math.exp(-t / 0.25)) + 300, 1.2) * env[i] * drive;
      const mid = 0.5 * (x + prev);
      // A little asymmetry in the clip adds the even harmonics a valve would.
      const shape = (u: number): number => Math.tanh(u + 0.05 * u * Math.abs(u));
      const y1 = shape(x);
      const y = 0.25 * z + 0.5 * shape(mid) + 0.25 * y1;
      z = y1;
      prev = x;
      out[i] = (y * 0.6 + 0.5 * Math.sin(p) * env[i]) * (0.5 + 0.5 * n.v);
    }
    return fadeTail(eqMono(out, [['hp', 38, 0.7], ['peak', 950, 1.1, 4], ['lp', tone, 0.7]]));
  };
}

/** A synth lead: a pulse and a saw with a late vibrato through a lowpass that follows the note, for the
 *  electronic courses' melodies. `glide` slides in from the note before. */
export function synthLead(cut = 5, vib = 9, width = 0.35): Inst {
  return (n, rng) => {
    const held = secs(n.dur);
    const len = held + secs(0.2);
    const out = new Float32Array(len);
    const env = adsr(len, 0.012, 0.25, 0.8, 0.09, n.dur);
    const saw = new Saw(rng.next());
    const pu = new Pulse(rng.next());
    const lp = new Svf();
    const f0 = mtof(n.m);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      ph += (TAU * 5.4) / SR;
      const vibIn = n.dur > 0.3 ? clamp((t - 0.2) / 0.3, 0, 1) : 0;
      const f = f0 * bend((n.slide && t < 0.35 ? n.slide * 100 * Math.exp(-t / 0.035) : 0) + vib * vibIn * Math.sin(ph));
      const x = saw.tick(f / SR) * 0.6 + pu.tick(f / SR, width) * 0.5;
      out[i] = lp.tick(x, clamp(f * (1.5 + cut * (0.4 + 0.6 * n.v) * (0.4 + 0.6 * env[i])), 200, 12000), 1.1) * env[i] * (0.4 + 0.6 * n.v);
    }
    return fadeTail(out);
  };
}

/** A pure, glassy sine lead with a breath of FM at the attack. */
export function sineLead(vib = 7): Inst {
  return (n) => {
    const held = secs(n.dur);
    const len = held + secs(0.3);
    const out = new Float32Array(len);
    const env = adsr(len, 0.015, 0.4, 0.8, 0.12, n.dur);
    const f0 = mtof(n.m);
    let p = 0;
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      ph += (TAU * 5) / SR;
      const vibIn = n.dur > 0.35 ? clamp((t - 0.25) / 0.35, 0, 1) : 0;
      const f = f0 * bend((n.slide && t < 0.4 ? n.slide * 100 * Math.exp(-t / 0.04) : 0) + vib * vibIn * Math.sin(ph));
      p += (TAU * f) / SR;
      out[i] = Math.sin(p + 0.9 * Math.exp(-t / 0.05) * Math.sin(2 * p)) * env[i] * (0.4 + 0.6 * n.v);
    }
    return fadeTail(out);
  };
}
