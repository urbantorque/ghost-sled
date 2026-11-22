// Shared layout for ghost trajectories produced by the worker.
// One sample every SAMPLE_EVERY ticks, FRAME_STRIDE floats per sample.

export const SAMPLE_EVERY = 2;
export const FRAME_STRIDE = 10;
export const F_X = 0;
export const F_Y = 1;
export const F_Z = 2;
export const F_HEADING = 3;
export const F_AIRYAW = 4;
export const F_AIRPITCH = 5;
export const F_LEAN = 6;
export const F_SPEED = 7;
export const F_FLAGS = 8;
export const F_CARVE = 9;

export const FLAG_GROUNDED = 1;
export const FLAG_DRIFTING = 2;
export const FLAG_CRASHED = 4;
/** Dashing: a lantern spent, riding as a spirit (SIM_VERSION 7). */
export const FLAG_DASHING = 8;
/** A ward has just taken a hit (the half second the sled passes through what it hit). */
export const FLAG_WARDED = 16;
/** A fall (round 7), and where in it: tumbling to a stop, down in the snow, getting up. One at most is set. */
export const FLAG_FALLING = 32;
export const FLAG_DOWN = 64;
export const FLAG_UP = 128;
/** Round 8 (the events lane): what the rider is doing in the air, packed over the flags (a Float32 holds every
 *  integer to 2^24 exactly), so a ghost in glass takes the trick poses the rider does (render/ghosts.ts). Bits 8
 *  to 12 the trick posed (tricks.ts TRICK, sim s.move), 13 to 14 a grab's side plus one, 15 to 16 its tier. A
 *  sample without them (an older trajectory) reads as no trick. Presentation only: nothing reads them back. */
export const TRICK_SHIFT = 8;
export function packTrick(move: number, grab: number, tier: number): number {
  const m = Math.max(0, Math.min(31, Math.floor(move)));
  const g = Math.max(0, Math.min(2, Math.round(grab) + 1));
  const t = Math.max(0, Math.min(3, Math.floor(tier)));
  return (m << TRICK_SHIFT) | (g << (TRICK_SHIFT + 5)) | (t << (TRICK_SHIFT + 7));
}
export function unpackTrick(flags: number, out: { move: number; grab: number; tier: number }): void {
  const f = Math.floor(flags);
  out.move = (f >> TRICK_SHIFT) & 31;
  const g = (f >> (TRICK_SHIFT + 5)) & 3;
  out.grab = g === 0 && out.move === 0 ? 0 : g - 1;
  out.tier = (f >> (TRICK_SHIFT + 7)) & 3;
}

export interface PoolGhostData {
  name: string;
  score: number;
  distance: number;
  ticks: number;
  /** The tick it crossed the finish line, when it did. `ticks` runs on through the coast, up to the
   *  generator's cap, so it is no finish time. */
  finishTick?: number;
  /** The tick it crossed each stage line it reached. The bundled pools carry them (the stage medals
   *  read them); a pool generated in the worker does not, and needs no stage medals. */
  stageTicks?: number[];
  sled: number;
  mood: number;
  event: number;
  /** Where the rider went down, metres down the run: every tumble and any wreck. A pool from before
   *  these were recorded has none, and its graveyards fall back on where its runs ended. */
  falls?: number[];
  record: string;
}

export type WorkerIn =
  | { type: 'replay'; jobs: Array<{ id: number; record: string }> }
  | { type: 'pool'; reqId: number; seed: number; count: number; salt: number; budgetRuns?: number; maxTicks?: number }
  /** Round 8, the trials lane: the week's Trial field (trialfield.ts), by its ISO week. */
  | { type: 'trial'; reqId: number; week: string; maxTicks?: number };

/** A Trial field rider's tally as the worker sends it (trial.ts TrialTally). */
export interface TrialTallyData {
  tumbles: number;
  line: { seconds: number; score: number; perfects: number } | null;
}

export type WorkerOut =
  | {
      type: 'trajectory';
      id: number;
      frames: Float32Array;
      samples: number;
      ticks: number;
      crashTick: number;
      /** The tick it crossed the finish line, -1 for a run that did not finish. */
      finishTick: number;
      /** The tick it crossed each stage line it reached. */
      stageTicks: number[];
      score: number;
      distance: number;
      /** Flattened [tick, quality(0 clean,1 perfect,2 sketchy), halfTurns, flips] per notable landing. */
      tricks: Int32Array;
    }
  | { type: 'error'; id: number; message: string }
  | { type: 'pool'; reqId: number; ghosts: PoolGhostData[] }
  | { type: 'trial'; reqId: number; ghosts: PoolGhostData[]; tallies: TrialTallyData[] };
