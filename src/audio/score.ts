import type { BiomeId } from '../sim/mountains';
import type { Chord } from './theory';

// The written music (round 6): each mountain's song, the title's main theme and the results' reprise, as
// scale degrees, so one song plays in any mode a mood colours it with. Pure data and pure functions: no
// WebAudio, so the tests read it in node.
//
// A song has an intro (2 bars), a verse (8), a chorus (8) and a bridge (4, the breakdown), one chord a bar,
// and a build chord the bar before a drop leans on. The chorus carries the hook (8 bars: a 4-bar phrase and
// its answer, which turns through the borrowed chords); the verse carries a sparse answering line; the
// hook's head (its first bar) opens every run and is the set pieces' call. All of it is original.
//
// Degrees count from the tonic (0) in the deck's mode, 7 to the octave. A chord or a note given `alt` (a
// chord) or `a` (a note) is borrowed: its pitch is the major scale's degree plus that many semitones, in
// any mode, so a bVI or a bVII stays where it was written when a mood changes the mode under it.

export type ModeName = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixo';

export const MODES: Record<ModeName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixo: [0, 2, 4, 5, 7, 9, 10],
};

const MAJOR = MODES.major;

/** A chord in a song: a degree, an optional borrowed shift, an optional forced quality ('M' major, 'm'
 *  minor, 'D' dominant seventh, 's4' and 's2' suspended) and an optional extension. */
export interface ChordSpec {
  d: number;
  alt?: number;
  q?: 'M' | 'm' | 'D' | 's4' | 's2';
  x?: 7 | 9 | 6 | 'add9';
}

/** A melody note: start step (16ths from the line's start), length in steps, degree, borrowed shift. */
export interface Note {
  s: number;
  l: number;
  d: number;
  a?: number;
}

export interface Song {
  intro: readonly ChordSpec[];
  verse: readonly ChordSpec[];
  chorus: readonly ChordSpec[];
  bridge: readonly ChordSpec[];
  /** The chord the bar before a drop leans on. */
  build: ChordSpec;
  /** Over the chorus: 8 bars (128 steps). */
  hook: readonly Note[];
  /** Over the verse: 8 bars, sparse. */
  answer: readonly Note[];
}

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Semitones over the tonic of degree d in a mode; with `a`, the major scale's degree d plus a. */
export function degree(mode: readonly number[], d: number, a?: number): number {
  const scale = a === undefined ? mode : MAJOR;
  const k = Math.round(d);
  return scale[mod(k, 7)] + 12 * Math.floor(k / 7) + (a ?? 0);
}

/** A chord spec in a mode: its root (semitones over the tonic) and its tones over the root. */
export function realize(mode: readonly number[], c: ChordSpec): Chord {
  const root = c.alt !== undefined ? degree(MAJOR, c.d) + c.alt : degree(mode, c.d);
  const q = c.q ?? (c.alt !== undefined ? 'M' : null);
  let third: number;
  let fifth: number;
  let seventh: number;
  let ninth = 14;
  if (q === null) {
    const r = degree(mode, c.d);
    third = degree(mode, c.d + 2) - r;
    fifth = degree(mode, c.d + 4) - r;
    seventh = degree(mode, c.d + 6) - r;
    ninth = degree(mode, c.d + 8) - r;
  } else if (q === 'M') {
    third = 4;
    fifth = 7;
    seventh = 11;
  } else if (q === 'D') {
    third = 4;
    fifth = 7;
    seventh = 10;
  } else if (q === 'm') {
    third = 3;
    fifth = 7;
    seventh = 10;
  } else {
    third = q === 's4' ? 5 : 2;
    fifth = 7;
    seventh = 10;
  }
  const tones = [0, third, fifth];
  if (c.x === 7 || c.x === 9 || q === 'D') tones.push(seventh);
  // A flat ninth (a phrygian tonic, a dominant's) is left out: it would sour the bed.
  if ((c.x === 9 || c.x === 'add9') && ninth === 14) tones.push(14);
  if (c.x === 6) tones.push(9);
  return { root: mod(root, 12), tones, bars: 1 };
}

/** A melody note's MIDI pitch: degree d (borrowed by a) over `base`, the tonic in the line's octave. */
export function notePitch(mode: readonly number[], base: number, n: Note): number {
  return base + degree(mode, n.d, n.a);
}

// ------------------------------------------------------------------- the songs

const I = (x?: ChordSpec['x']): ChordSpec => ({ d: 0, x });
const at = (d: number, x?: ChordSpec['x'], q?: ChordSpec['q']): ChordSpec => ({ d, x, q });
const bor = (d: number, alt: number, x?: ChordSpec['x'], q?: ChordSpec['q']): ChordSpec => ({ d, alt, x, q });

/** Notes from a compact list: [step, length, degree, borrowed?]. */
const line = (xs: ReadonlyArray<readonly [number, number, number, number?]>): Note[] => xs.map(([s, l, d, a]) => (a === undefined ? { s, l, d } : { s, l, d, a }));

/**
 * Pinecrest (D major, 112): sunlit and climbing. The verse walks I vi IV Vsus and borrows the bVII to turn
 * home; the chorus rises IV V vi iii and its answer lands on the bVI and bVII before the verse's I. The
 * hook leans on a long-short-short-long figure that climbs to the octave.
 */
const PINECREST: Song = {
  intro: [I('add9'), at(4, undefined, 's4')],
  verse: [I('add9'), at(5, 7), at(3, 9), at(4, undefined, 's4'), I('add9'), at(2, 7), at(3, 7), bor(6, -1, 'add9')],
  chorus: [at(3, 7), at(4), at(5, 7), at(2, 7), at(3, 7), at(4), bor(5, -1), bor(6, -1, 'add9')],
  bridge: [at(5, 9), at(3, 9), at(1, 9), at(4, undefined, 's4')],
  build: bor(6, -1, 'add9'),
  hook: line([
    [0, 3, 5], [3, 1, 4], [4, 2, 5], [6, 4, 7], [10, 2, 6], [12, 4, 5],
    [16, 6, 4], [22, 2, 2], [24, 4, 4], [28, 4, 1],
    [32, 3, 2], [35, 1, 1], [36, 2, 2], [38, 4, 4], [42, 2, 5], [44, 4, 7],
    [48, 8, 6], [56, 4, 4], [60, 4, 2],
    [64, 3, 5], [67, 1, 4], [68, 2, 5], [70, 4, 7], [74, 2, 6], [76, 4, 5],
    [80, 6, 4], [86, 2, 6], [88, 8, 8],
    [96, 4, 7], [100, 2, 6, -1], [102, 2, 7], [104, 8, 9, -1],
    [112, 4, 9, -1], [116, 4, 8], [120, 8, 7],
  ]),
  answer: line([
    [24, 2, 4], [26, 2, 5], [28, 4, 7],
    [56, 2, 8], [58, 2, 7], [60, 4, 4],
    [88, 2, 2], [90, 2, 4], [92, 4, 6],
    [120, 2, 8], [122, 2, 7], [124, 4, 6, -1],
  ]),
};

/**
 * Frostfang (F# dorian, 100): cold air and long light. The dorian's raised sixth is the ice in it (the IV
 * is major); the verse borrows the bVI, the chorus climbs bVI bVII i and ends on a major V for the pull
 * home. The hook is slow: long notes that hang, then a reach up the ninth.
 */
const FROSTFANG: Song = {
  intro: [I(9), bor(5, -1, 7)],
  verse: [I(9), at(6, 'add9'), bor(5, -1, 7), at(3), I(9), at(4, 7), bor(5, -1, 7), at(6, undefined, 's4')],
  chorus: [bor(5, -1, 7), at(6), I(9), at(4, 7), bor(5, -1, 7), at(6), at(3), at(4, undefined, 'M')],
  bridge: [at(3, 9, 'm'), bor(5, -1, 7), bor(2, -1), at(4, undefined, 's4')],
  build: at(4, undefined, 's4'),
  hook: line([
    [0, 8, 4], [8, 4, 2], [12, 4, 4],
    [16, 12, 6], [28, 4, 7],
    [32, 6, 8], [38, 2, 7], [40, 8, 4],
    [48, 8, 3], [56, 8, 1],
    [64, 8, 4], [72, 4, 2], [76, 4, 4],
    [80, 8, 6], [88, 4, 8], [92, 4, 9],
    [96, 8, 10], [104, 4, 9], [108, 4, 8],
    [112, 6, 8], [118, 2, 6, 0], [120, 8, 8],
  ]),
  answer: line([
    [24, 4, 8], [28, 4, 6],
    [56, 4, 5], [60, 4, 3],
    [88, 4, 8], [92, 4, 4],
    [120, 4, 6], [124, 4, 7],
  ]),
};

/**
 * Ember Peak (C minor, 124): heat and drive. A minor verse that rocks i bVI bIII bVII and turns on a major V;
 * the chorus pushes bVI bVII i v and its answer slips through the phrygian bII before the V. The hook is a
 * syncopated riff of repeated notes, a hammer more than a song.
 */
const EMBER: Song = {
  intro: [I('add9'), at(5, 7)],
  verse: [I('add9'), at(5, 7), at(2), at(6), I(), at(5), at(3, 7), at(4, undefined, 'M')],
  chorus: [at(5), at(6), I(), at(4, 7), at(5), at(6), bor(1, -1, 7), at(4, undefined, 'M')],
  bridge: [at(3, 9), bor(1, -1, 7), at(5, 7), at(4, undefined, 's4')],
  build: at(4, undefined, 'M'),
  hook: line([
    [0, 3, 7], [3, 3, 7], [6, 2, 6], [8, 4, 5], [12, 4, 4],
    [16, 3, 6], [19, 3, 6], [22, 2, 5], [24, 4, 4], [28, 4, 3],
    [32, 3, 4], [35, 3, 4], [38, 2, 6], [40, 8, 7],
    [48, 6, 8], [54, 2, 7], [56, 8, 6],
    [64, 3, 7], [67, 3, 7], [70, 2, 6], [72, 4, 5], [76, 4, 4],
    [80, 3, 6], [83, 3, 6], [86, 2, 5], [88, 4, 4], [92, 4, 3],
    [96, 3, 5], [99, 3, 5], [102, 2, 7], [104, 8, 8, -1],
    [112, 4, 8], [116, 4, 6, 0], [120, 8, 4],
  ]),
  answer: line([
    [24, 2, 4], [26, 2, 5], [28, 4, 7],
    [56, 2, 3], [58, 2, 4], [60, 4, 6],
    [88, 2, 7], [90, 2, 6], [92, 4, 5],
    [120, 2, 4], [122, 2, 6, 0], [124, 4, 8],
  ]),
};

/**
 * Sakura Ridge (Eb major, 96, swung): blossom and a lilt. A gentle I iii vi IV verse; the chorus runs IV V iii
 * vi ii V IV and ends on the minor iv, the bittersweet turn before home. The hook keeps to the pentatonic,
 * a turn and a step, like a song sung walking.
 */
const SAKURA: Song = {
  intro: [I('add9'), at(3, 9)],
  verse: [I('add9'), at(2, 7), at(5, 7), at(3, 'add9'), I(), at(1, 7), at(4, undefined, 's4'), I('add9')],
  chorus: [at(3, 9), at(4), at(2, 7), at(5, 7), at(1, 9), at(4), at(3, 7), at(3, 6, 'm')],
  bridge: [at(5, 9), at(3, 9), I('add9'), at(4, undefined, 's4')],
  build: at(4, undefined, 's4'),
  hook: line([
    [0, 4, 4], [4, 2, 5], [6, 2, 4], [8, 8, 2],
    [16, 4, 1], [20, 2, 2], [22, 2, 1], [24, 4, 6], [28, 4, 4],
    [32, 4, 4], [36, 2, 5], [38, 2, 4], [40, 8, 6],
    [48, 12, 7], [60, 4, 5],
    [64, 4, 5], [68, 2, 7], [70, 2, 5], [72, 8, 2],
    [80, 4, 1], [84, 2, 2], [86, 2, 4], [88, 8, 6],
    [96, 4, 7], [100, 4, 5], [104, 8, 2],
    [112, 6, 5, -1], [118, 2, 4], [120, 8, 3],
  ]),
  answer: line([
    [24, 4, 4], [28, 4, 6],
    [56, 4, 5], [60, 4, 4],
    [88, 4, 5], [92, 4, 7],
    [120, 4, 4], [124, 4, 2],
  ]),
};

/**
 * The main theme (the title, D major, 88): A is the statement (I V vi IV ii Vsus, then the bVI and bVII
 * home), B the answer that climbs to the high fifth over IV V. The results replay it, slower, in the key the
 * run finished in.
 */
export const THEME: Song = {
  intro: [I('add9'), at(3, 7)],
  verse: [I('add9'), at(4), at(5, 7), at(3, 7), at(1, 7), at(4, undefined, 's4'), bor(5, -1), bor(6, -1, 'add9')],
  chorus: [at(3, 7), at(2, 7), at(1, 7), I('add9'), at(3, 7), at(4), at(5, 7), at(4, undefined, 's4')],
  bridge: [at(3, 9), at(1, 9), at(5, 9), at(4, undefined, 's4')],
  build: at(4, undefined, 's4'),
  hook: line([
    [0, 8, 8], [8, 4, 7], [12, 4, 6],
    [16, 6, 6], [22, 2, 5], [24, 8, 4],
    [32, 4, 4], [36, 4, 5], [40, 4, 6], [44, 4, 8],
    [48, 12, 7],
    [64, 6, 8], [70, 2, 9], [72, 8, 10],
    [80, 6, 9], [86, 2, 8], [88, 8, 6],
    [96, 4, 5], [100, 4, 7], [104, 8, 9],
    [112, 16, 8],
  ]),
  answer: line([
    [0, 6, 4], [6, 2, 5], [8, 8, 7],
    [16, 4, 6], [20, 2, 5], [22, 2, 4], [24, 8, 5],
    [32, 6, 4], [38, 2, 5], [40, 4, 9], [44, 4, 8],
    [48, 12, 7],
    [64, 6, 8], [70, 2, 7], [72, 4, 6], [76, 4, 4],
    [80, 6, 5], [86, 2, 4], [88, 4, 5], [92, 4, 6],
    [96, 6, 7], [102, 2, 6, -1], [104, 4, 7], [108, 4, 9, -1],
    [112, 14, 8],
  ]),
};

export const SONGS: Record<BiomeId, Song> = {
  alpine: PINECREST,
  glacier: FROSTFANG,
  volcanic: EMBER,
  blossom: SAKURA,
};

export function songFor(biome: BiomeId): Song {
  return SONGS[biome] ?? PINECREST;
}

/** The hook's head: its notes in the first bar (the run's opening call and the set pieces' motif). */
export function headOf(song: Song): Note[] {
  return song.hook.filter((n) => n.s < 16);
}

/** The notes of a line that start at step s (0..127). */
export function notesAt(xs: readonly Note[], s: number): Note[] {
  const out: Note[] = [];
  for (const n of xs) if (n.s === s) out.push(n);
  return out;
}

/** The written length of the line's note at s, cut where the next note starts (legato stays legato). */
export function lengthAt(xs: readonly Note[], n: Note): number {
  let next = 128;
  for (const m of xs) if (m.s > n.s && m.s < next) next = m.s;
  return Math.max(1, Math.min(n.l, next - n.s));
}
