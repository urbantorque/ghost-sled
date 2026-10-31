import type { BankTier } from './beats';

// The number at stake: bank tiers by size and the fuse while a big stake drains.
//
// Pure: no DOM, render or audio imports. Plain arithmetic only.
//
// One combo is one number at stake (pending x multiplier). Cashing it in is graded by size, so 80
// and 40,000 never feel alike: tier 0 is a plain "+80" flying into the score, tier 1 rolls the
// origin up by its multiplier, tier 2 adds sparks and a music drop, tier 3 (or a new lifetime best
// combo) adds a header and the biggest slam. A combo built mostly by drafting caps at tier 1, so a
// draft-only x10 never slams. The fuse is the tension while a big stake drains: from 1,500 at stake,
// once the combo timer is under 40% and actually draining, it rises from 0 to 1 as the timer runs
// out. The timing constants below are shared by the HUD's roll and the audio's roll ticks, so the
// two land together.

export const BANK_T1 = 1500;
export const BANK_T2 = 5000;
export const BANK_T3 = 20000;

/** Under this many non-draft moves in the banked combo, a bank never grades above tier 1. */
export const SKILL_CHAIN_MIN = 3;
/** The fuse lights from this stake... */
export const FUSE_STAKE = BANK_T1;
/** ...once the combo timer's remaining fraction is under this. */
export const FUSE_FRAC = 0.4;

/** ms before the roll starts: the origin pops in and the "x4" chip slams onto it (tiers 1 to 3). */
export const BANK_CHIP_MS = 120;
/** ms the figure takes to roll from the origin up to the product, per tier (tier 0 does not roll). */
export const BANK_ROLL_MS: readonly [number, number, number, number] = [0, 350, 600, 900];
/** Count ticks along the roll, per tier: equal steps in time, the last one shows the product. */
export const BANK_TICKS: readonly [number, number, number, number] = [0, 6, 10, 14];
/** Off-white sparks thrown from the figure as the roll lands, per tier. */
export const BANK_SPARKS: readonly [number, number, number, number] = [0, 0, 12, 16];
/** Peak scale of the figure's landing punch, per tier. */
export const BANK_PEAK: readonly [number, number, number, number] = [1.16, 1.3, 1.5, 1.6];
/** ms from the bank beat until the figure lands in the score, per tier (a deferred New best waits this long). */
export const BANK_MS: readonly [number, number, number, number] = [1000, 1250, 1550, 1900];

/**
 * A bank's tier from its points, the banked combo's skill chain (its non-draft style events) and
 * your lifetime best combo at the start of the run. A new lifetime best (beating a best above 0,
 * and itself at least BANK_T1) grades as tier 3. Draft-dominated combos (skill chain under 3) cap
 * at tier 1.
 */
export function bankTier(points: number, skillChain: number, bestComboAtStart: number): BankTier {
  let tier: BankTier = points >= BANK_T3 ? 3 : points >= BANK_T2 ? 2 : points >= BANK_T1 ? 1 : 0;
  if (isLifetimeBest(points, bestComboAtStart)) tier = 3;
  if (skillChain < SKILL_CHAIN_MIN && tier > 1) tier = 1;
  return tier;
}

/** True when this bank beats your lifetime best combo (a first record is no news). */
export function isLifetimeBest(points: number, bestComboAtStart: number): boolean {
  return bestComboAtStart > 0 && points > bestComboAtStart && points >= BANK_T1;
}

/**
 * The header over a tier-3 figure: 'New best combo' (gold-white) when it beats your lifetime best,
 * otherwise 'Massive'. Lower tiers have none.
 */
export function bankHeader(points: number, tier: BankTier, bestComboAtStart: number): 'New best combo' | 'Massive' | null {
  if (tier < 3) return null;
  return isLifetimeBest(points, bestComboAtStart) ? 'New best combo' : 'Massive';
}

/**
 * 0..1 fuse tension from the stake, the combo timer's remaining fraction and whether it drains
 * (grounded and not drifting or drafting). 0 under FUSE_STAKE, at or above FUSE_FRAC, or while the
 * timer holds; otherwise it rises linearly to 1 as the timer runs out.
 */
export function fuseLevel(stake: number, timerFrac: number, draining: boolean): number {
  if (!draining || stake < FUSE_STAKE || !(timerFrac < FUSE_FRAC)) return 0;
  const k = 1 - Math.max(0, timerFrac) / FUSE_FRAC;
  return k > 1 ? 1 : k;
}

/** The figure shown at roll tick i of n (1..n): eased out from the origin, the product at i = n. */
export function rollValue(origin: number, points: number, i: number, n: number): number {
  if (n <= 0 || i >= n) return points;
  if (i <= 0) return origin;
  const t = i / n;
  const e = 1 - (1 - t) * (1 - t) * (1 - t);
  return Math.round(origin + (points - origin) * e);
}
