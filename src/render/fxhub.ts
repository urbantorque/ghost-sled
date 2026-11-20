import type { Color, Vector3 } from 'three';

// What the effects lane's systems share (round 7): the tier they are drawn on, the particle budget, reduced
// motion, and a few handles between them, so a new effect asks here instead of being wired through the world.
// Render only: nothing here is read by the sim.
//
// Who writes it: Particles.setQuality (the tier's particle budget names the tier), SpiritFx.setReduced (the
// frame's reduced-motion state), Props (itself, for the trees a rider passes). Everything else only reads.

/** 0 Low, 1 Medium, 2 High, 3 Ultra. */
export type FxTier = 0 | 1 | 2 | 3;

export interface TreeSource {
  /** props.ts Props.treesNear: the near rows' snow-carrying trees round a sim (x, z). */
  treesNear(x: number, z: number, r: number, ahead: number, out: number[]): number;
}

/** The snow's moving parts that other systems set off (round 8, the snow lane; particles.ts Particles). */
export interface SnowSink {
  /** Powder a ghost left hanging where it rode by, at three.js (x, y, z) on the snow, moving (vx, vz) at `speed`. */
  ghostPowder(x: number, y: number, z: number, vx: number, vz: number, speed: number): void;
  /** Round 8 (the events lane): a passed ghost coming apart into motes of its kind colour (particles.ts). */
  ghostMotes(pos: Vector3, h: number, color: Color, carrier: Vector3, count: number): void;
}

export const fx = {
  tier: 2 as FxTier,
  /** The tier's particle budget (world.ts QUALITY: 0.45, 0.75, 1, and more on Ultra). */
  budget: 1,
  /** Reduced motion, from the system or the game's own setting: beats stay, motion goes. */
  reduced: false,
  trees: null as TreeSource | null,
  /** The particles' snow (round 8): set by Particles as it is made. */
  snow: null as SnowSink | null,
};

/** The tier, from its particle budget (the one number every tier already hands the effects). */
export function setFxBudget(budget: number): void {
  fx.budget = budget;
  fx.tier = budget < 0.6 ? 0 : budget < 0.9 ? 1 : budget <= 1.001 ? 2 : 3;
}

/** A per-tier pick: [low, medium, high, ultra]. */
export function byTier<T>(v: readonly [T, T, T, T]): T {
  return v[fx.tier];
}

/** Pooled budgets (tests/fxbudget): how many of each pooled thing a tier may have alive at once. Nothing is
 *  allocated past these, and Low's column is never larger than round 6's own cost for the same job. */
export const BUDGET = {
  /** Samples a ghost's rut keeps (its spacing is RUT_GAP): the visible range ahead of the rider. */
  rutSamples: [360, 480, 720, 720],
  /** Metres between a rut's samples. */
  rutGap: [0.9, 0.75, 0.6, 0.6],
  /** Metres ahead a rut is drawn, and where it drops to every third sample. */
  rutFar: [330, 420, 520, 620],
  rutCoarse: [70, 110, 140, 180],
  /** Pieces of a broken thing in the air at once (breaks.ts), and its dust motes a burst. */
  shards: [24, 72, 128, 192],
  /** Trees shaken at once (flora's shiver; Low has none, the sift alone). */
  shivers: [0, 4, 4, 4],
  /** Weather: the share of the tier's flakes each depth layer takes is the same; the count is world.ts's. */
  /** Firework streaks alive at once (fireworks.ts), and the local lights a show may push a frame. */
  streaks: [420, 900, 1700, 2600],
  showLights: [1, 2, 3, 4],
  /** Round 8, the snow that moves (particles.ts): metres of a ghost's line between the veils of powder it leaves
   *  hanging (Low none), and spindrift wisps a second off the crests ahead (Low none). */
  hangEvery: [Infinity, 4.5, 3, 2.5],
  spindrift: [0, 7, 12, 16],
} as const;
