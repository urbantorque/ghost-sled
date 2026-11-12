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

export const fx = {
  tier: 2 as FxTier,
  /** The tier's particle budget (world.ts QUALITY: 0.45, 0.75, 1, and more on Ultra). */
  budget: 1,
  /** Reduced motion, from the system or the game's own setting: beats stay, motion goes. */
  reduced: false,
  trees: null as TreeSource | null,
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
  streaks: [220, 520, 900, 1300],
  showLights: [1, 2, 3, 4],
} as const;
