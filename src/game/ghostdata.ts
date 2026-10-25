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

export interface PoolGhostData {
  name: string;
  score: number;
  distance: number;
  ticks: number;
  sled: number;
  mood: number;
  event: number;
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
      score: number;
      distance: number;
      /** Flattened [tick, quality(0 clean,1 perfect,2 sketchy), halfTurns, flips] per notable landing. */
      tricks: Int32Array;
    }
  | { type: 'error'; id: number; message: string }
  | { type: 'pool'; reqId: number; ghosts: PoolGhostData[] };
