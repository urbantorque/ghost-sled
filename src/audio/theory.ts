import { Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import type { KickKind, SnareKind } from './drums';
import type { ModeName } from './score';

// Musical material: a key, mode, tempo, groove and timbre per mood and (on Clear Skies) per mountain, a
// timbre accent per biome, and the pentatonic ladder every reward sound climbs. Rewards only ever use
// pentatonic tones of the current key (and the bright chord is built from those same tones), which avoids
// the 4th and 7th that would clash against the pad, so rewards always sit inside the soundtrack. The songs
// themselves (chords and melodies, as degrees) are in score.ts.

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
  /** The mode its songs are played in (score.ts). */
  mode: ModeName;
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
  /** The drum kit (drums.ts) and how deep the kick pumps the pad and the bass (the sidechain, 0..1). */
  kit: { kick: KickKind; snare: SnareKind; pump: number };
}

const _ = null;

/**
 * The moods (chaos runs): each keeps its key, mode, tempo, drums and timbres, and plays the mountain's
 * song in its own mode (score.ts), so a Blizzard on Pinecrest is still Pinecrest's hook, in A minor.
 * Mood.None is Pinecrest's own style (the Clear Skies styles are CLEAR, by mountain).
 */
export const STYLES: Record<Mood, Style> = {
  // Clear Skies: warm D major (Pinecrest's).
  [Mood.None]: {
    tonic: 50,
    bpm: 112,
    mode: 'major',
    penta: MAJOR_PENTA,
    bright: 0,
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
    kit: { kick: 'tight', snare: 'snare', pump: 0.3 },
  },
  // Blizzard: sparse, airy A minor; half-time pulse, high glassy arp.
  [Mood.Blizzard]: {
    tonic: 45,
    bpm: 100,
    mode: 'minor',
    penta: MINOR_PENTA,
    bright: 3,
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
    kit: { kick: 'soft', snare: 'clap', pump: 0.15 },
  },
  // Lantern Night: F major lullaby with a music-box broken chord and a lilting swing.
  [Mood.Lantern]: {
    tonic: 53,
    bpm: 96,
    mode: 'major',
    penta: MAJOR_PENTA,
    bright: 0,
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
    kit: { kick: 'soft', snare: 'rim', pump: 0.1 },
  },
  // Glass Ice: crystalline E lydian, 16th-note glass bells.
  [Mood.GlassIce]: {
    tonic: 52,
    bpm: 108,
    mode: 'lydian',
    penta: MAJOR_PENTA,
    bright: 0,
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
    kit: { kick: 'tight', snare: 'clap', pump: 0.25 },
  },
  // Comet Night: dreamy Db lydian, a dotted bell arp.
  [Mood.Comet]: {
    tonic: 49,
    bpm: 98,
    mode: 'lydian',
    penta: MAJOR_PENTA,
    bright: 0,
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
    kit: { kick: 'soft', snare: 'clap', pump: 0.15 },
  },
  // Haunted Hollow: E phrygian, heartbeat kick, theremin lead, a seasick pad.
  [Mood.Haunted]: {
    tonic: 52,
    bpm: 104,
    mode: 'phrygian',
    penta: MINOR_PENTA,
    bright: 3,
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
    kit: { kick: 'deep', snare: 'rim', pump: 0.2 },
  },
  // Powder Day: bright, bouncy G major; octave bass, four on the floor, 16th plucks.
  [Mood.Powder]: {
    tonic: 55,
    bpm: 124,
    mode: 'major',
    penta: MAJOR_PENTA,
    bright: 0,
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
    kit: { kick: 'tight', snare: 'clap', pump: 0.35 },
  },
};

/**
 * Clear Skies, by mountain (round 6): each its own key, tempo, groove and timbre, so the four mountains no
 * longer share one D major at 112. Pinecrest keeps the original band.
 */
export const CLEAR: Record<BiomeId, Style> = {
  alpine: STYLES[Mood.None],
  // Frostfang: F# dorian at 100, straight; a half-time snare, glass bells in 16ths, a breathy flute.
  glacier: {
    tonic: 54,
    bpm: 100,
    mode: 'dorian',
    penta: MINOR_PENTA,
    bright: 3,
    swing: 0.02,
    pad: { cutoff: 2500, attack: 0.9, detune: 9, wobble: 0 },
    bass: [0, _, _, _, _, _, _, _, 7, _, _, _, _, _, 12, _],
    arp: { kind: 'up', rate: 1, timbre: 'glass', prob: 0.9, oct: 1 },
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.75, 0, 0, 0, 0, 0],
    hat: [0.3, 0.12, 0.45, 0.12, 0.3, 0.12, 0.45, 0.12, 0.3, 0.12, 0.45, 0.12, 0.3, 0.12, 0.45, 0.2],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    sparkle: { prob: 0.09, timbre: 'glass' },
    lead: 'flute',
    verb: 1.35,
    kit: { kick: 'soft', snare: 'clap', pump: 0.18 },
  },
  // Ember Peak: C minor at 124, a driving octave bass, a heavy kick that pumps, a gritty square lead.
  volcanic: {
    tonic: 48,
    bpm: 124,
    mode: 'minor',
    penta: MINOR_PENTA,
    bright: 3,
    swing: 0,
    pad: { cutoff: 1350, attack: 0.35, detune: 8, wobble: 0 },
    bass: [0, _, 0, 12, _, 0, 0, _, 0, _, 0, 12, _, 0, 7, _],
    arp: { kind: 'box', rate: 2, timbre: 'pluck', prob: 1, oct: 0 },
    kick: [1, 0, 0, 0, 0.85, 0, 0, 0.3, 1, 0, 0, 0, 0.85, 0, 0.4, 0],
    hat: [0.2, 0.3, 0.7, 0.3, 0.2, 0.3, 0.7, 0.3, 0.2, 0.3, 0.7, 0.3, 0.2, 0.3, 0.7, 0.45],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.35],
    sparkle: { prob: 0.04, timbre: 'bell' },
    lead: 'square',
    verb: 0.8,
    kit: { kick: 'deep', snare: 'snare', pump: 0.45 },
  },
  // Sakura Ridge: Eb major at 96, swung; a gentle bass, a rim on four, a koto arp and a breathy flute.
  blossom: {
    tonic: 51,
    bpm: 96,
    mode: 'major',
    penta: MAJOR_PENTA,
    bright: 0,
    swing: 0.12,
    pad: { cutoff: 1750, attack: 0.6, detune: 6, wobble: 0 },
    bass: [0, _, _, _, _, _, 7, _, 12, _, _, 7, _, _, _, _],
    arp: { kind: 'updown', rate: 2, timbre: 'pluck', prob: 1, oct: 0 },
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 0],
    hat: [0, 0, 0.5, 0, 0, 0, 0.5, 0.2, 0, 0, 0.5, 0, 0, 0, 0.5, 0.25],
    clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0, 0, 0],
    sparkle: { prob: 0.07, timbre: 'bell' },
    lead: 'flute',
    verb: 1.15,
    kit: { kick: 'soft', snare: 'rim', pump: 0.2 },
  },
};

/** The title's main theme: D major at 88, a bell arp, a flute, brushed drums only in its answer. */
export const TITLE_STYLE: Style = {
  tonic: 50,
  bpm: 88,
  mode: 'major',
  penta: MAJOR_PENTA,
  bright: 0,
  swing: 0.06,
  pad: { cutoff: 1700, attack: 0.9, detune: 8, wobble: 0 },
  bass: [0, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _],
  arp: { kind: 'updown', rate: 2, timbre: 'bell', prob: 1, oct: 1 },
  kick: [0.7, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0, 0],
  hat: [0, 0, 0.35, 0, 0, 0, 0.35, 0, 0, 0, 0.35, 0, 0, 0, 0.35, 0],
  clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0, 0, 0],
  sparkle: { prob: 0.05, timbre: 'bell' },
  lead: 'flute',
  verb: 1.3,
  kit: { kick: 'soft', snare: 'rim', pump: 0.1 },
};

export type DeckScene = 'title' | 'run' | 'results';

/** A deck's style: the title's own; on a run or its results, the mood's, or on Clear Skies the mountain's. */
export function deckStyle(scene: DeckScene, mood: Mood, biome: BiomeId): Style {
  if (scene === 'title') return TITLE_STYLE;
  if (mood === Mood.None) return CLEAR[biome] ?? STYLES[Mood.None];
  return styleFor(mood);
}

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
