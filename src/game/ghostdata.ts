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
  | { type: 'pool'; reqId: number; seed: number; count: number; salt: number; budgetRuns?: number; maxTicks?: number };

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
  | { type: 'pool'; reqId: number; ghosts: PoolGhostData[] };
