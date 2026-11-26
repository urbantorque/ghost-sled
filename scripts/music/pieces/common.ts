import type { Note } from '../inst';
import { boom, cymbal, riser } from '../perc';
import { type Grid, type Key, degree, stepDur } from '../notation';
import type { Shot, Track } from '../piece';

// What every piece shares (round 7): the game's motif, the gestures the set pieces' stingers are written
// from, and the builders that turn a gesture into a one-shot in a piece's own instruments.

/**
 * The game's motif: four bars in common time, a dotted quarter and an eighth and then long notes, every
 * bar. A rising fourth to the octave and a step down; a fall through the sixth; a small arch; home. Its
 * harmony is I V, IV I/3, ii V, I. The title states it, each course's finale quotes its first two bars,
 * each results reprise plays it through, and Lanternfall grows into it. Written here once; original.
 */
export const MOTIF: readonly string[] = ["5:6 1':2 7:4 5:4", '6:6 5:2 3:8', '4:6 6:2 5:4 2:4', '3:6 2:2 1:8'];
/** The same in a slow 6/8 (twelve steps a bar: a quarter and an eighth, then dotted quarters). */
export const MOTIF_68: readonly string[] = ["5:4 1':2 7:3 5:3", '6:4 5:2 3:6', '4:4 6:2 5:3 2:3', '3:4 2:2 1:6'];
export const MOTIF_CHORDS = 'I V | IV I/3 | ii V | I';

/** A set piece's verb as a musical gesture, in beats, so it plays at any tempo and in any metre: a tune in
 *  scale degrees (8 is the octave), which voice carries it, the percussion under it, a chord held. */
export interface Gesture {
  verb: string;
  /** What the gesture is, for the notes and the listening guide. */
  says: string;
  voice: 'lead' | 'low' | 'bell';
  /** [beat, beats held, degree]. */
  tune: ReadonlyArray<readonly [number, number, number]>;
  /** [beat, velocity]. */
  perc: ReadonlyArray<readonly [number, number]>;
  /** [from beat, beats, degrees]. */
  hold?: readonly [number, number, readonly number[]];
  /** A swell into the first beat instead of an attack. */
  swell?: boolean;
  beats: number;
}

/**
 * The verbs. A new set piece's verb is one entry here: `npm run music` renders it in every course's
 * instruments and lists it in the manifest, and the game plays it at that verb's first metre. A verb
 * with no entry plays 'any'.
 */
export const GESTURES: readonly Gesture[] = [
  { verb: 'race', says: 'a gallop on one note that jumps a fifth, then the octave', voice: 'lead', beats: 4, tune: [[0, 0.25, 1], [0.25, 0.25, 1], [0.5, 0.5, 5], [1, 0.25, 5], [1.25, 0.25, 5], [1.5, 0.5, 8], [2, 1.6, 9]], perc: [[0, 0.9], [0.25, 0.5], [0.5, 0.8], [1, 0.9], [1.25, 0.5], [1.5, 0.8], [2, 1]], hold: [2, 2, [1, 5]] },
  { verb: 'gates', says: 'a run up the chord, a note a gate, to a held top', voice: 'bell', beats: 4, tune: [[0, 0.5, 1], [0.5, 0.5, 3], [1, 0.5, 5], [1.5, 0.5, 8], [2, 0.5, 10], [2.5, 1.4, 12]], perc: [[0, 0.7], [1, 0.6], [2, 0.7], [2.5, 0.9]], hold: [2.5, 1.5, [1, 5]] },
  { verb: 'rings', says: 'three ringing chords, each higher', voice: 'bell', beats: 4, tune: [[0, 1, 5], [0, 1, 8], [1, 1, 8], [1, 1, 10], [2, 1.8, 10], [2, 1.8, 12], [2, 1.8, 15]], perc: [[0, 0.7], [1, 0.8], [2, 1]], hold: [2, 2, [1, 5]] },
  { verb: 'collapse', says: 'a low line falling by step under a roll', voice: 'low', beats: 4, tune: [[0, 0.75, 8], [0.75, 0.75, 7], [1.5, 0.5, 5], [2, 0.5, 4], [2.5, 1.5, 1]], perc: [[0, 1], [0.5, 0.5], [0.75, 0.6], [1, 0.6], [1.25, 0.65], [1.5, 0.7], [1.75, 0.75], [2, 0.8], [2.25, 0.85], [2.5, 1]] },
  { verb: 'steps', says: 'a staircase: pairs of notes coming down a step at a time', voice: 'lead', beats: 4, tune: [[0, 0.4, 8], [0.5, 0.4, 8], [1, 0.4, 7], [1.5, 0.4, 7], [2, 0.4, 6], [2.5, 0.4, 6], [3, 1, 5]], perc: [[0, 0.9], [1, 0.9], [2, 0.9], [3, 1]] },
  { verb: 'follow', says: 'a call of three rising notes and its echo an octave up', voice: 'bell', beats: 4, tune: [[0, 0.5, 5], [0.5, 0.5, 8], [1, 1, 9], [2, 0.5, 12], [2.5, 0.5, 15], [3, 1, 16]], perc: [], hold: [0, 4, [1, 5]], swell: true },
  { verb: 'kindle', says: 'sparks: three quick flickers upward, then the chord blooms', voice: 'bell', beats: 4, tune: [[0, 0.12, 1], [0.12, 0.5, 5], [0.75, 0.12, 3], [0.87, 0.5, 8], [1.5, 0.12, 5], [1.62, 0.5, 10], [2.25, 1.6, 12]], perc: [[0, 0.5], [0.75, 0.6], [1.5, 0.7], [2.25, 0.9]], hold: [2.25, 1.75, [1, 3, 5]] },
  { verb: 'carry', says: 'three slow steps upward, held like a hymn', voice: 'lead', beats: 4, tune: [[0, 1, 1], [1, 1, 2], [2, 2, 3]], perc: [[0, 0.6], [2, 0.8]], hold: [0, 4, [1, 5]], swell: true },
  { verb: 'slide', says: 'a fast run down the scale to a low landing', voice: 'lead', beats: 3, tune: [[0, 0.25, 8], [0.25, 0.25, 7], [0.5, 0.25, 6], [0.75, 0.25, 5], [1, 0.25, 4], [1.25, 0.25, 3], [1.5, 0.25, 2], [1.75, 1.2, 1]], perc: [[0, 0.6], [1.75, 1]] },
  { verb: 'shatter', says: 'a high struck cluster, then shards falling slower and slower', voice: 'bell', beats: 4, tune: [[0, 0.3, 15], [0, 0.3, 16], [0.3, 0.25, 12], [0.6, 0.3, 11], [0.95, 0.35, 9], [1.4, 0.45, 8], [1.95, 0.6, 6], [2.65, 1.2, 5]], perc: [[0, 1], [0.3, 0.4], [0.95, 0.4], [1.95, 0.4]] },
  { verb: 'surge', says: 'one note hammered faster and faster, breaking upward a fourth', voice: 'lead', beats: 4, tune: [[0, 0.5, 1], [0.75, 0.4, 1], [1.35, 0.3, 1], [1.8, 0.25, 1], [2.15, 0.2, 1], [2.4, 0.2, 1], [2.6, 0.15, 1], [2.75, 0.15, 1], [2.9, 1.1, 4]], perc: [[0, 0.5], [0.75, 0.55], [1.35, 0.6], [1.8, 0.7], [2.15, 0.75], [2.4, 0.8], [2.6, 0.85], [2.75, 0.9], [2.9, 1]], hold: [2.9, 1.1, [1, 4]] },
  { verb: 'flourish', says: 'a turn round the fifth and a leap to the octave', voice: 'lead', beats: 3, tune: [[0, 0.25, 5], [0.25, 0.25, 6], [0.5, 0.25, 5], [0.75, 0.25, 4], [1, 0.5, 5], [1.5, 1.4, 8]], perc: [[0, 0.6], [1.5, 0.9]], hold: [1.5, 1.5, [1, 5]] },
  { verb: 'any', says: 'a rising fifth, plainly', voice: 'lead', beats: 3, tune: [[0, 0.75, 1], [0.75, 1.6, 5]], perc: [[0, 0.7], [0.75, 0.9]], hold: [0.75, 2, [1, 5]] },
  { verb: 'won', says: "the game's motif, its first bar, landing on the octave over a held chord", voice: 'lead', beats: 4.5, tune: [[0, 0.75, 5], [0.75, 0.25, 8], [1, 0.5, 7], [1.5, 0.5, 5], [2, 2.2, 8]], perc: [[0, 0.8], [2, 1]], hold: [2, 2.4, [1, 3, 5]] },
  { verb: 'lost', says: 'three soft notes stepping down to the tonic', voice: 'bell', beats: 3.5, tune: [[0, 0.9, 3], [1, 0.9, 2], [2, 1.5, 1]], perc: [], hold: [2, 1.5, [1, 5]] },
];

/**
 * Round 9: a new mountain's verbs, met on that mountain alone (no Daily, Cup or other course lays them), so only its
 * own piece carries their stingers: the five's packs keep the stingers they had, and nobody downloads one the run can
 * never play. A piece renders GESTURES and its own list here.
 */
export const OWN_GESTURES: Readonly<Record<string, readonly Gesture[]>> = {
  // The Old Run: struck bells climbing a wall; a clock's tick doubling into a rush; a line that climbs and holds.
  oldrun: [
    { verb: 'peal', says: 'three bells struck one after another, each higher, to a held chime', voice: 'bell', beats: 3, tune: [[0, 0.5, 5], [0.5, 0.5, 8], [1, 0.5, 10], [1.5, 1.4, 12]], perc: [[0, 0.6], [0.5, 0.7], [1, 0.8], [1.5, 1]], hold: [1.5, 1.5, [1, 5]] },
    { verb: 'split', says: "a clock's tick on one note doubling into a rush, then the octave", voice: 'lead', beats: 4, tune: [[0, 0.25, 5], [0.5, 0.25, 5], [1, 0.25, 5], [1.5, 0.25, 5], [2, 0.125, 5], [2.25, 0.125, 5], [2.5, 0.125, 6], [2.75, 0.125, 7], [3, 1, 8]], perc: [[0, 0.5], [0.5, 0.55], [1, 0.6], [1.5, 0.65], [2, 0.75], [2.25, 0.8], [2.5, 0.85], [2.75, 0.9], [3, 1]], hold: [3, 1, [1, 5]] },
    { verb: 'glaze', says: 'a line that climbs a sixth and holds there, high and smooth', voice: 'lead', beats: 4, tune: [[0, 1, 3], [1, 1, 5], [2, 1.9, 8]], perc: [], hold: [0, 4, [1, 3, 5]], swell: true },
  ],
};

/** Which of a piece's tracks play a gesture's parts, and where. */
export interface StingBand {
  lead: ReadonlyArray<{ track: string; oct: number; vel?: number }>;
  low: ReadonlyArray<{ track: string; oct: number; vel?: number }>;
  bell: ReadonlyArray<{ track: string; oct: number; vel?: number }>;
  perc: ReadonlyArray<{ track: string; m: number; vel?: number }>;
  hold: ReadonlyArray<{ track: string; oct: number; vel?: number }>;
}

export const beatDur = (g: Grid): number => stepDur(g) * g.div;

/** A gesture as a one-shot in a piece's instruments and key. */
export function stinger(gs: Gesture, g: Grid, key: Key, band: StingBand): Shot {
  const b = beatDur(g);
  const parts: Record<string, Note[]> = {};
  const add = (track: string, n: Note): void => void (parts[track] ??= []).push(n);
  for (const v of band[gs.voice]) {
    const base = 12 * (v.oct + 1) + key.pc;
    for (const [at, len, d] of gs.tune) add(v.track, { t: at * b, dur: Math.max(0.05, len * b * 0.95), m: base + degree(key.mode, d), v: (v.vel ?? 0.85) * (gs.swell ? 0.7 : 1) });
  }
  for (const p of band.perc) for (const [at, vel] of gs.perc) add(p.track, { t: at * b, dur: 0.1, m: p.m, v: vel * (p.vel ?? 1) });
  if (gs.hold) {
    const [from, len, degs] = gs.hold;
    for (const h of band.hold) {
      const base = 12 * (h.oct + 1) + key.pc;
      for (const d of degs) add(h.track, { t: from * b, dur: len * b, m: base + degree(key.mode, d), v: h.vel ?? 0.6 });
    }
  }
  return { id: `st.${gs.verb}`, len: gs.beats * b, parts, tail: 2.2 };
}

/** The tracks every piece carries for its drops: a riser, a cymbal and a boom. Their notes come from
 *  buildShot and hitShot; a piece may add its own roll and swell. */
export function fxTracks(riserTone = 0.4, crashLo = 3200): Track[] {
  return [
    { id: 'riser', family: 'riser', inst: riser(riserTone), layer: 'drive', gain: -24, verb: 0.2 },
    { id: 'crash', family: 'cymbal', inst: cymbal(2.4, crashLo), layer: 'drive', gain: -23, verb: 0.3 },
    { id: 'swell', family: 'cymbal', inst: cymbal(1.2, crashLo, true), layer: 'drive', gain: -27, verb: 0.3 },
    { id: 'boom', family: 'boom', inst: boom(), layer: 'drive', gain: -19 },
  ];
}

/** The build into a drop: `bars` of riser ending on the drop, with whatever roll the piece adds. */
export function buildShot(g: Grid, key: Key, bars: number, extra: Record<string, Note[]> = {}): Shot {
  const len = bars * g.beats * beatDur(g);
  return { id: 'build', len, tail: 0.6, parts: { riser: [{ t: 0, dur: len, m: 48 + key.pc, v: 0.9 }], ...extra } };
}

/** The hit on a drop: the cymbal and the boom, and whatever the piece strikes with them. */
export function hitShot(extra: Record<string, Note[]> = {}): Shot {
  return { id: 'hit', len: 0.5, tail: 2.6, parts: { crash: [{ t: 0, dur: 2, m: 60, v: 0.95 }], boom: [{ t: 0, dur: 2, m: 36, v: 0.9 }], ...extra } };
}

/** The first note of every bar of a melody, an octave up: what a glockenspiel or a bell doubles. */
export function downbeats(notes: readonly Note[], g: Grid, up = 12, vel = 0.7): Note[] {
  const bar = g.beats * g.div * stepDur(g);
  const out: Note[] = [];
  let last = -1;
  for (const n of notes) {
    const k = Math.floor((n.t + 1e-4) / bar);
    if (k !== last && n.t - k * bar < stepDur(g) * 0.6) {
      out.push({ t: n.t, dur: n.dur, m: n.m + up, v: vel });
      last = k;
    }
  }
  return out;
}
