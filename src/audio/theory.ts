import { Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';

// Musical material: a key, mode and progression per mood, a timbre accent per biome, and the
// pentatonic ladder every reward sound climbs. Rewards only ever use pentatonic tones of the
// current key (and the bright chord is built from those same tones), which avoids the 4th and
// 7th that would clash against the pad, so rewards always sit inside the soundtrack.

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Shift a MIDI note by octaves into [lo, lo + 12). */
export function fit(m: number, lo: number): number {
  let x = m;
  while (x < lo) x += 12;
  while (x >= lo + 12) x -= 12;
  return x;
}

export interface Key {
  /** MIDI note of the tonic. */
  tonic: number;
  /** Pentatonic offsets from the tonic used by every reward sound. */
  penta: readonly number[];
  /** Offset of the bright major add9 reward chord root: 0 in major keys, the relative major in
   *  minor ones, so the chord is made of pentatonic tones only. */
  bright: number;
  bpm: number;
}

export const MAJOR_PENTA: readonly number[] = [0, 2, 4, 7, 9];
export const MINOR_PENTA: readonly number[] = [0, 3, 5, 7, 10];

/** Bottom rung of the reward ladder: the tonic placed between A3 and G#4. */
export function ladderBase(k: Key): number {
  return fit(k.tonic, 57);
}

/** MIDI note of pentatonic ladder step i (negative steps go below the base). */
export function ladder(k: Key, i: number): number {
  return ladderAt(k, ladderBase(k), i);
}

/** Pentatonic step i of the key, counted from `base` (a tonic in any octave). */
export function ladderAt(k: Key, base: number, i: number): number {
  const n = k.penta.length;
  const step = Math.round(i);
  const oct = Math.floor(step / n);
  return base + k.penta[step - oct * n] + 12 * oct;
}

/** The ladder step of MIDI note m (the nearest step at or below it when m is off the scale). */
export function ladderIndexOf(k: Key, m: number): number {
  const n = k.penta.length;
  const rel = Math.round(m) - ladderBase(k);
  const oct = Math.floor(rel / 12);
  const pc = rel - 12 * oct;
  let j = 0;
  for (let x = 0; x < n; x++) if (k.penta[x] <= pc) j = x;
  return oct * n + j;
}

/** Root of the bright reward chord, placed at or above `lo`. */
export function brightRoot(k: Key, lo = 52): number {
  return fit(k.tonic + k.bright, lo);
}

/** Major add9 spread for bells: R 5 9 3 R. */
export const BRIGHT_VOICING: readonly number[] = [0, 7, 14, 16, 24];
/** Pentatonic chord ladder used by cash-in arpeggios. */
export const BRIGHT_ARP: readonly number[] = [0, 4, 7, 12, 14, 16, 19, 24, 28, 31];

export type Timbre = 'pluck' | 'koto' | 'bell' | 'box' | 'glass' | 'mallet';
export type LeadKind = 'square' | 'flute' | 'theremin';
export type ArpKind = 'up' | 'updown' | 'box' | 'random';

export interface Chord {
  /** Semitones from the tonic. */
  root: number;
  /** Semitones from the chord root, extensions included. */
  tones: readonly number[];
  bars: number;
}

export interface Style extends Key {
  prog: readonly Chord[];
  /** Fraction of a 16th that odd 16ths are delayed by. */
  swing: number;
  pad: { cutoff: number; attack: number; detune: number; wobble: number };
  /** 16 steps; semitones above the chord root, or null for a rest. */
  bass: readonly (number | null)[];
  arp: { kind: ArpKind; rate: number; timbre: Timbre; prob: number; oct: number };
  /** 16-step velocity patterns. */
  kick: readonly number[];
  hat: readonly number[];
  clap: readonly number[];
  sparkle: { prob: number; timbre: Timbre };
  lead: LeadKind;
  /** Reverb send multiplier for the whole deck. */
  verb: number;
}

const _ = null;

export const STYLES: Record<Mood, Style> = {
  // Clear Skies: warm D major; the II chord (E major over the key) is the lydian lift.
  [Mood.None]: {
    tonic: 50,
    bpm: 112,
    penta: MAJOR_PENTA,
    bright: 0,
    prog: [
      { root: 0, tones: [0, 4, 7, 11, 14], bars: 1 },
      { root: 2, tones: [0, 4, 7, 14], bars: 1 },
      { root: 9, tones: [0, 3, 7, 10], bars: 1 },
      { root: 5, tones: [0, 4, 7, 11, 14], bars: 1 },
    ],
    swing: 0.08,
    pad: { cutoff: 1900, attack: 0.5, detune: 7, wobble: 0 },
    bass: [0, _, _, 0, _, _, 7, _, 0, _, _, 0, _, 12, 7, _],
    arp: { kind: 'updown', rate: 2, timbre: 'pluck', prob: 1, oct: 0 },
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0.5, 0, 0, 0, 0, 0],
    hat: [0.25, 0, 0.7, 0, 0.25, 0, 0.7, 0, 0.25, 0, 0.7, 0, 0.25, 0, 0.7, 0.3],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    sparkle: { prob: 0.06, timbre: 'bell' },
    lead: 'square',
    verb: 1,
  },
  // Blizzard: sparse, airy A minor; long chords, half-time pulse, high glassy arp.
  [Mood.Blizzard]: {
    tonic: 45,
    bpm: 100,
    penta: MINOR_PENTA,
    bright: 3,
    prog: [
      { root: 0, tones: [0, 3, 7, 14], bars: 2 },
      { root: 8, tones: [0, 4, 7, 11], bars: 2 },
      { root: 3, tones: [0, 4, 7, 11, 14], bars: 2 },
      { root: 7, tones: [0, 3, 7, 10], bars: 2 },
    ],
    swing: 0,
    pad: { cutoff: 2600, attack: 1.2, detune: 10, wobble: 0 },
    bass: [0, _, _, _, _, _, _, _, _, _, 7, _, _, _, _, _],
    arp: { kind: 'random', rate: 2, timbre: 'bell', prob: 0.55, oct: 1 },
    kick: [0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0],
    hat: [0, 0, 0.35, 0, 0, 0, 0.35, 0, 0, 0, 0.35, 0, 0, 0, 0.35, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
    sparkle: { prob: 0.05, timbre: 'glass' },
    lead: 'flute',
    verb: 1.4,
  },
  // Lantern Night: F major lullaby with a music-box broken chord and a lilting swing.
  [Mood.Lantern]: {
    tonic: 53,
    bpm: 96,
    penta: MAJOR_PENTA,
    bright: 0,
    prog: [
      { root: 0, tones: [0, 4, 7, 14], bars: 1 },
      { root: 9, tones: [0, 3, 7], bars: 1 },
      { root: 5, tones: [0, 4, 7, 11], bars: 1 },
      { root: 7, tones: [0, 5, 7, 14], bars: 1 },
    ],
    swing: 0.14,
    pad: { cutoff: 1400, attack: 0.6, detune: 6, wobble: 0 },
    bass: [0, _, _, _, 7, _, _, _, 12, _, _, _, 7, _, _, _],
    arp: { kind: 'box', rate: 2, timbre: 'box', prob: 1, oct: 1 },
    kick: [0.6, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0],
    sparkle: { prob: 0.04, timbre: 'box' },
    lead: 'flute',
    verb: 1.2,
  },
  // Glass Ice: crystalline E major, 16th-note glass bells, a #11 on the IV, a suspended V.
  [Mood.GlassIce]: {
    tonic: 52,
    bpm: 108,
    penta: MAJOR_PENTA,
    bright: 0,
    prog: [
      { root: 0, tones: [0, 4, 7, 11], bars: 1 },
      { root: 9, tones: [0, 3, 7, 10, 14], bars: 1 },
      { root: 5, tones: [0, 4, 7, 11, 18], bars: 1 },
      { root: 7, tones: [0, 5, 7, 9], bars: 1 },
    ],
    swing: 0.04,
    pad: { cutoff: 2400, attack: 0.4, detune: 5, wobble: 0 },
    bass: [0, _, _, 0, _, _, 0, _, _, _, 7, _, 12, _, _, _],
    arp: { kind: 'up', rate: 1, timbre: 'glass', prob: 0.85, oct: 1 },
    kick: [1, 0, 0, 0, 0, 0, 0.6, 0, 0.9, 0, 0, 0, 0, 0, 0.4, 0],
    hat: [0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.3],
    clap: [0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0],
    sparkle: { prob: 0.1, timbre: 'glass' },
    lead: 'flute',
    verb: 1.2,
  },
  // Comet Night: dreamy Db major, two-bar chords, a lydian IV and a floating ii9, dotted arp.
  [Mood.Comet]: {
    tonic: 49,
    bpm: 98,
    penta: MAJOR_PENTA,
    bright: 0,
    prog: [
      { root: 0, tones: [0, 4, 7, 11, 14], bars: 2 },
      { root: 9, tones: [0, 3, 7, 10, 14], bars: 2 },
      { root: 5, tones: [0, 4, 7, 11, 18], bars: 2 },
      { root: 2, tones: [0, 3, 7, 10, 14], bars: 2 },
    ],
    swing: 0,
    pad: { cutoff: 1600, attack: 1.4, detune: 9, wobble: 0 },
    bass: [0, _, _, _, _, _, _, _, 0, _, _, 7, _, _, _, _],
    arp: { kind: 'updown', rate: 3, timbre: 'bell', prob: 1, oct: 1 },
    kick: [0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0],
    hat: [0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0, 0, 0, 0.3, 0],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0, 0],
    sparkle: { prob: 0.08, timbre: 'bell' },
    lead: 'flute',
    verb: 1.6,
  },
  // Haunted Hollow: E phrygian (the bII and the half-diminished v), heartbeat kick, theremin lead.
  [Mood.Haunted]: {
    tonic: 52,
    bpm: 104,
    penta: MINOR_PENTA,
    bright: 3,
    prog: [
      { root: 0, tones: [0, 3, 7, 10], bars: 1 },
      { root: 1, tones: [0, 4, 7, 11], bars: 1 },
      { root: 0, tones: [0, 3, 7, 10], bars: 1 },
      { root: 7, tones: [0, 3, 6, 10], bars: 1 },
    ],
    swing: 0.06,
    pad: { cutoff: 1250, attack: 0.9, detune: 8, wobble: 14 },
    bass: [0, _, 0, _, _, _, _, _, 0, _, 0, _, _, _, 1, _],
    arp: { kind: 'random', rate: 2, timbre: 'glass', prob: 0.7, oct: 0 },
    kick: [1, 0, 0.6, 0, 0, 0, 0, 0, 1, 0, 0.6, 0, 0, 0, 0, 0],
    hat: [0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0.2],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, 0],
    sparkle: { prob: 0.05, timbre: 'glass' },
    lead: 'theremin',
    verb: 1.5,
  },
  // Powder Day: bright, bouncy G major; octave bass, four on the floor, 16th plucks.
  [Mood.Powder]: {
    tonic: 55,
    bpm: 124,
    penta: MAJOR_PENTA,
    bright: 0,
    prog: [
      { root: 0, tones: [0, 4, 7, 14], bars: 1 },
      { root: 7, tones: [0, 4, 7], bars: 1 },
      { root: 9, tones: [0, 3, 7, 10], bars: 1 },
      { root: 5, tones: [0, 4, 7, 14], bars: 1 },
    ],
    swing: 0.1,
    pad: { cutoff: 2200, attack: 0.25, detune: 6, wobble: 0 },
    bass: [0, _, 12, _, 0, _, 12, _, 0, _, 12, _, 7, _, 12, 7],
    arp: { kind: 'up', rate: 1, timbre: 'pluck', prob: 1, oct: 0 },
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0.3, 0.8, 0.3, 0, 0.3, 0.8, 0.3, 0, 0.3, 0.8, 0.3, 0, 0.3, 0.8, 0.5],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    sparkle: { prob: 0.07, timbre: 'bell' },
    lead: 'square',
    verb: 0.9,
  },
};

/** Results scene: a gentle resolved loop on the bright (major) root of the mood's key. */
export const RESOLVED: readonly Chord[] = [
  { root: 0, tones: [0, 4, 7, 11, 14], bars: 2 },
  { root: 5, tones: [0, 4, 7, 11, 14], bars: 2 },
  { root: 9, tones: [0, 3, 7, 10, 14], bars: 2 },
  { root: 7, tones: [0, 5, 7, 14], bars: 1 },
  { root: 7, tones: [0, 4, 7, 14], bars: 1 },
];

/** Biome timbre accents: small, so the mood stays the identity of the run. */
export interface Accent {
  padCut: number;
  pluckBright: number;
  sparkleMul: number;
  /** Doubles the bass with a sine for weight. */
  sub: boolean;
  /** Plucks become koto-like (brighter attack, small pitch fall). */
  koto: boolean;
  /** Arp notes get a quiet glass octave above. */
  shimmer: boolean;
}

export const ACCENTS: Record<BiomeId, Accent> = {
  alpine: { padCut: 1, pluckBright: 0.8, sparkleMul: 1, sub: false, koto: false, shimmer: false },
  glacier: { padCut: 1.15, pluckBright: 1.1, sparkleMul: 1.6, sub: false, koto: false, shimmer: true },
  volcanic: { padCut: 0.72, pluckBright: 0.9, sparkleMul: 0.8, sub: true, koto: false, shimmer: false },
  blossom: { padCut: 1, pluckBright: 1, sparkleMul: 1.1, sub: false, koto: true, shimmer: false },
};

export function styleFor(mood: Mood): Style {
  return STYLES[mood] ?? STYLES[Mood.None];
}

export function accentFor(biome: BiomeId): Accent {
  return ACCENTS[biome] ?? ACCENTS.alpine;
}
