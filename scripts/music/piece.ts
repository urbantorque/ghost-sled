import { type EqBand, Rng, SR, type Stereo, addMono, addStereo, db, eq, scale, secs, stereo } from './dsp';
import { type CompOpts, type VerbOpts, applyGain, chorus, compGain, compress, duckCurve, limiterGain, pingPong, reverb, saturate, width } from './fx';
import type { Inst, Note } from './inst';
import { integrated, kWeight } from './meter';
import { type Grid, type Key, barDur, stepDur } from './notation';

// A piece and how it is rendered (round 7). A piece is a band (tracks: an instrument, the layer it belongs
// to, its place in the mix) and a list of sections (so many bars, each track's notes) and one-shots (a
// build into a drop, the hit on it, the stingers). Every section is rendered on its own with its tail
// (the reverb and the last notes ringing past its last bar), one stereo stem a layer, and the stems are
// mastered together: the bus EQ is linear, and the compressor's and the limiter's gain are computed on the
// full mix and applied to every stem, so the stems add up to the mastered mix exactly and any subset of
// them is that mix with instruments missing, not a different master.

/** The layers a section is shipped in, in the order the race brings them in. */
export type Layer = 'bed' | 'drive' | 'lead' | 'peak';
export const LAYERS: readonly Layer[] = ['bed', 'drive', 'lead', 'peak'];

/** What a section is for in a run (src/audio/stemform.ts sequences by role). */
export type Role = 'intro' | 'low' | 'high' | 'mid' | 'break' | 'climax' | 'climb' | 'finale' | 'results' | 'title';

export interface Track {
  id: string;
  /** The instrument family, for the notes and the test that no two courses share a band. */
  family: string;
  inst: Inst;
  layer: Layer;
  /** How loud the track is where it plays loudest: the integrated loudness (LUFS, before the master) of its
   *  loudest section. The renderer measures every track and sets its gain to meet this, so a mix is written
   *  as instruments against each other, whatever level an instrument happens to come out at. Pan -1..1. */
  gain: number;
  pan?: number;
  /** Sends to the piece's reverb and tempo delay, linear. */
  verb?: number;
  echo?: number;
  eq?: readonly EqBand[];
  comp?: CompOpts;
  /** Tape drive (1 is gentle, 4 is hot). */
  tape?: number;
  chorus?: number;
  wide?: number;
  /** How far the kick pushes this track down, 0..1; `kick` marks the track whose hits do the pushing. */
  duck?: number;
  kick?: boolean;
  /** A player's looseness: timing in ms and velocity as a fraction. */
  human?: readonly [number, number];
}

export interface Section {
  id: string;
  role: Role;
  bars: number;
  key: Key;
  /** The harmony, a bar between bars (notation.ts progression): the manifest's chords and the analysis read it. */
  chords: string;
  /** Each track's notes, by track id. */
  parts: Record<string, Note[]>;
  /** The melody as written (for the analysis of hooks), if the section has one. */
  tune?: string;
}

export interface Shot {
  id: string;
  /** Seconds of written content; the tail rings past it. A build is anchored at its end (the drop). */
  len: number;
  parts: Record<string, Note[]>;
  /** Seconds of tail to keep. */
  tail?: number;
}

export interface Piece {
  id: string;
  name: string;
  /** One line for the notes: the genre and the band. */
  style: string;
  grid: Grid;
  key: Key;
  tracks: Track[];
  sections: Section[];
  shots: Shot[];
  verb: VerbOpts;
  /** The tempo delay: its time in grid steps and its feedback. */
  echo: { steps: number; feedback: number };
  master: { eq: readonly EqBand[]; comp: CompOpts; width: number };
  /** The order sections are played in on a run, by stage (src/audio/stemform.ts). */
  form: { open: string; stages: string[][]; breakdown: string; finale: string; results: string };
}

/** Seconds a section's stems ring on past its last bar. */
export const TAIL_S = 3;

export interface RenderedSection {
  id: string;
  /** Samples of written music: the next section starts here. */
  frames: number;
  layers: Partial<Record<Layer, Stereo>>;
}

function human(n: Note, h: readonly [number, number] | undefined, rng: Rng): Note {
  if (!h) return n;
  return { ...n, t: Math.max(0, n.t + (rng.gauss() * h[0]) / 1000), v: Math.max(0.03, Math.min(1, n.v * (1 + rng.gauss() * h[1]))) };
}

/** One track of one section or one-shot: its notes played, then its own chain. Returns null when it rests. */
/** Seconds spent rendering each track (the instruments and their chains), for the build's report. */
export const TRACK_TIME: Record<string, number> = {};

function renderTrack(piece: Piece, tr: Track, notes: readonly Note[] | undefined, len: number, seed: string, gain: number): Stereo | null {
  if (!notes || notes.length === 0) return null;
  const t0 = performance.now();
  const buf = stereo(len);
  const rng = new Rng(`${piece.id}/${seed}/${tr.id}`);
  let stereoInst = false;
  notes.forEach((raw, i) => {
    const n = human(raw, tr.human, rng);
    const v = tr.inst(n, rng.fork(i));
    const at = secs(n.t);
    if (at >= len) return;
    if (v instanceof Float32Array) addMono(buf, v, at, 1, (tr.pan ?? 0) + (n.pan ?? 0));
    else {
      stereoInst = true;
      addStereo(buf, v, at, 1);
    }
  });
  if (tr.eq) eq(buf, tr.eq);
  if (tr.comp) compress(buf, tr.comp);
  if (tr.tape) saturate(buf, tr.tape, 0.7);
  if (tr.chorus) chorus(buf, 3, 0.55, tr.chorus);
  if (tr.wide !== undefined) width(buf, tr.wide);
  // A stereo instrument is placed by balance, not by pan.
  const p = tr.pan ?? 0;
  const g = gain;
  const gl = stereoInst ? g * Math.min(1, 1 - p) : g;
  const gr = stereoInst ? g * Math.min(1, 1 + p) : g;
  for (let i = 0; i < len; i++) {
    buf.l[i] *= gl;
    buf.r[i] *= gr;
  }
  TRACK_TIME[tr.id] = (TRACK_TIME[tr.id] ?? 0) + (performance.now() - t0) / 1000;
  return buf;
}

/** Each track's gain, linear, from the calibration pass. */
export type Gains = Record<string, number>;

/**
 * The calibration pass: every track of every section and one-shot played alone through its own chain, its
 * integrated loudness measured where it plays loudest, and the gain that puts that at the track's written
 * level. (The piece is then rendered again with these gains: twice the work, and the mix no longer depends
 * on what level an instrument happens to come out at.)
 */
export function calibrate(piece: Piece): Gains {
  const loud: Record<string, number> = {};
  const read = (parts: Record<string, Note[]>, frames: number, tail: number, seed: string): void => {
    const len = frames + secs(tail);
    for (const tr of piece.tracks) {
      const buf = renderTrack(piece, tr, parts[tr.id], len, seed, 1);
      if (!buf) continue;
      const lu = integrated(kWeight(buf.l), kWeight(buf.r));
      if (Number.isFinite(lu) && lu > (loud[tr.id] ?? -Infinity)) loud[tr.id] = lu;
    }
  };
  for (const s of piece.sections) read(s.parts, Math.round(s.bars * barDur(piece.grid) * SR), TAIL_S, s.id);
  for (const s of piece.shots) read(s.parts, secs(s.len), s.tail ?? 2.2, s.id);
  const out: Gains = {};
  for (const tr of piece.tracks) if (loud[tr.id] !== undefined) out[tr.id] = db(tr.gain - loud[tr.id]);
  return out;
}

function renderParts(piece: Piece, parts: Record<string, Note[]>, frames: number, tail: number, seed: string, gains: Gains): Partial<Record<Layer, Stereo>> {
  const len = frames + secs(tail);
  for (const id of Object.keys(parts)) if (!piece.tracks.some((t) => t.id === id)) throw new Error(`${piece.id}/${seed}: no track "${id}"`);
  const kicks: number[] = [];
  for (const tr of piece.tracks) if (tr.kick) for (const n of parts[tr.id] ?? []) if (n.v >= 0.55) kicks.push(n.t);
  const dry = {} as Partial<Record<Layer, Stereo>>;
  const verbIn = {} as Partial<Record<Layer, Stereo>>;
  const echoIn = {} as Partial<Record<Layer, Stereo>>;
  for (const tr of piece.tracks) {
    const buf = renderTrack(piece, tr, parts[tr.id], len, seed, gains[tr.id] ?? 1);
    if (!buf) continue;
    if (tr.duck && kicks.length) applyGain(buf, duckCurve(len, kicks, tr.duck));
    addStereo((dry[tr.layer] ??= stereo(len)), buf, 0, 1);
    if (tr.verb) addStereo((verbIn[tr.layer] ??= stereo(len)), buf, 0, tr.verb);
    if (tr.echo) addStereo((echoIn[tr.layer] ??= stereo(len)), buf, 0, tr.echo);
  }
  const out = {} as Partial<Record<Layer, Stereo>>;
  for (const l of LAYERS) {
    const d = dry[l];
    if (!d) continue;
    const e = echoIn[l];
    if (e) {
      const wet = pingPong(e, piece.echo.steps * stepDur(piece.grid), piece.echo.feedback);
      addStereo(d, wet, 0, 1);
      // The repeats go into the room too.
      addStereo((verbIn[l] ??= stereo(len)), wet, 0, 0.35);
    }
    const v = verbIn[l];
    if (v) addStereo(d, reverb(v, piece.verb), 0, 1);
    // Fade the very end of the tail, so a stem never stops on a step.
    const z = secs(0.5);
    for (let i = 0; i < z; i++) {
      const k = i / z;
      d.l[len - 1 - i] *= k;
      d.r[len - 1 - i] *= k;
    }
    out[l] = d;
  }
  return out;
}

export function renderSection(piece: Piece, s: Section, gains: Gains): RenderedSection {
  const frames = Math.round(s.bars * barDur(piece.grid) * SR);
  return { id: s.id, frames, layers: renderParts(piece, s.parts, frames, TAIL_S, s.id, gains) };
}

export function renderShot(piece: Piece, s: Shot, gains: Gains): Stereo {
  const frames = secs(s.len);
  const layers = renderParts(piece, s.parts, frames, s.tail ?? 2.2, s.id, gains);
  const out = stereo(frames + secs(s.tail ?? 2.2));
  for (const l of LAYERS) if (layers[l]) addStereo(out, layers[l] as Stereo, 0, 1);
  return out;
}

export function sumLayers(layers: Partial<Record<Layer, Stereo>>, which: readonly Layer[] = LAYERS): Stereo {
  let n = 0;
  for (const l of which) if (layers[l]) n = Math.max(n, (layers[l] as Stereo).l.length);
  const out = stereo(n);
  for (const l of which) if (layers[l]) addStereo(out, layers[l] as Stereo, 0, 1);
  return out;
}

/** Peak ceiling of a mastered section with every layer in, dBFS. A lossy encode overshoots by a few tenths
 *  and sections' tails overlap the next section's head: the game's own true-peak limiter is the last word. */
export const CEILING_DB = -1.5;
/** What the music is mastered to: every section with every layer in, end to end, integrated. */
export const TARGET_LUFS = -16;

export interface Mastered {
  sections: RenderedSection[];
  shots: Array<{ id: string; len: number; audio: Stereo }>;
  /** The gain the loudness target asked for, dB. */
  gainDb: number;
  /** The limiter's deepest reduction over the piece, dB. */
  limitDb: number;
}

/**
 * The master, in place: the bus EQ and width on every stem; the glue compressor's gain from each section's
 * full mix on each of its stems; one gain for the whole piece that puts its sections, end to end with
 * every layer in, at TARGET_LUFS; then the limiter's gain from each section's full mix on each of its
 * stems. One-shots go through the same EQ, gain and limiter.
 */
export function master(piece: Piece, sections: RenderedSection[], shots: Array<{ id: string; len: number; audio: Stereo }>): Mastered {
  const m = piece.master;
  const kw: Float32Array[] = [];
  for (const s of sections) {
    for (const l of LAYERS) {
      const b = s.layers[l];
      if (!b) continue;
      eq(b, m.eq);
      width(b, m.width);
    }
    const mix = sumLayers(s.layers);
    const g = compGain(mix, m.comp);
    for (const l of LAYERS) if (s.layers[l]) applyGain(s.layers[l] as Stereo, g);
    applyGain(mix, g);
    kw.push(mix.l.subarray(0, s.frames), mix.r.subarray(0, s.frames));
  }
  // The piece's loudness: its sections' written bars end to end, every layer in. The results' reprise and
  // the title are quiet by design and would pull the gain up, so only run sections are read where there
  // are any.
  const run = sections.filter((s) => {
    const role = piece.sections.find((x) => x.id === s.id)?.role;
    return role !== 'results' && role !== 'intro' && role !== 'break';
  });
  const use = run.length ? run : sections;
  let total = 0;
  for (const s of use) total += s.frames;
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  let at = 0;
  for (const s of use) {
    const i = sections.indexOf(s);
    L.set(kw[2 * i], at);
    R.set(kw[2 * i + 1], at);
    at += s.frames;
  }
  const lufs = integrated(kWeight(L), kWeight(R));
  const gainDb = TARGET_LUFS - lufs;
  const G = db(gainDb);
  let deepest = 1;
  for (const s of sections) {
    for (const l of LAYERS) if (s.layers[l]) scale(s.layers[l] as Stereo, G);
    const lim = limiterGain(sumLayers(s.layers), CEILING_DB);
    for (let i = 0; i < lim.gain.length; i++) if (lim.gain[i] < deepest) deepest = lim.gain[i];
    for (const l of LAYERS) if (s.layers[l]) applyGain(s.layers[l] as Stereo, lim.gain);
  }
  for (const s of shots) {
    eq(s.audio, m.eq);
    width(s.audio, m.width);
    scale(s.audio, G);
    applyGain(s.audio, limiterGain(s.audio, CEILING_DB).gain);
  }
  return { sections, shots, gainDb, limitDb: 20 * Math.log10(deepest) };
}


/** Every track id a piece's sections and one-shots use that plays at least one note: its band. */
export function bandOf(piece: Piece): string[] {
  const fam = new Set<string>();
  for (const s of piece.sections) for (const tr of piece.tracks) if ((s.parts[tr.id] ?? []).length > 0) fam.add(tr.family);
  return [...fam].sort();
}

export type { Inst, Note };
