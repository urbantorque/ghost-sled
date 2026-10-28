import { MOUNTAINS, biomeForSeed } from '../sim/mountains';
import { Rng, hash32 } from '../sim/prng';

// Rotating missions: three active at a time, each a one-run goal. Completing one pays gifts and
// the slot rolls to the next mission in the rotation. The rotation is a seeded shuffle per cycle
// (one pass through every mission), drawn inside difficulty bands so a new player is never handed a
// 720 first; the seed is captured into the save once, so a later name change never reorders a cycle.
// A biome mission whose mountain is still locked is skipped and comes back in a later cycle. From the
// second cycle on, missions grow: a tier II or III entry asks for more and pays more.

export interface RunSummary {
  mountain: string;
  biome: string;
  score: number;
  distance: number;
  gifts: number;
  perfects: number;
  maxAirtime: number;
  maxHalfTurns: number;
  flips: number;
  driftSeconds: number;
  draftSeconds: number;
  nearMisses: number;
  bestCombo: number;
  maxSpeed: number;
  smashes: number;
  gates: number;
  yetiHop: boolean;
  outranAvalanche: boolean;
  /** For mid-run pops the director passes min(passedThisRun, shownPasses), so a jostle never pops. */
  ghostsPassed: number;
  grudgeBeaten: boolean;
  chaos: boolean;
}

/** How a progress figure reads: metres, seconds, m/s, spin degrees (half turns x 180) or a count. */
export type MissionUnit = 'm' | 's' | 'm/s' | 'deg' | 'n';

export interface MissionDef {
  id: string;
  /** The tier I text (tiered text comes from missionTier). */
  text: string;
  target: number;
  reward: number;
  metric: (r: RunSummary) => number;
  /** Only offered on this biome. */
  biome?: string;
  /** Per tier above I: 'x2' doubles the target (up to `cap`), a number is added, 0 never grows. */
  grow: 'x2' | number;
  /** The tiered target's ceiling, so a tier III never asks for a run nobody can ride. */
  cap?: number;
  /** The mission's text for a target. */
  say: (target: number) => string;
  unit: MissionUnit;
}

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
/** 1600 -> "1,600"; 1.5 -> "1.5"; 2 -> "2". */
const n = (v: number): string => NF.format(v);
const plural = (v: number, one: string, many: string): string => (v === 1 ? one : many);

const DEFS: MissionDef[] = [
  { id: 'dist800', text: '', target: 800, reward: 25, metric: (r) => r.distance, grow: 'x2', cap: 6000, unit: 'm', say: (t) => `Ride ${n(t)} m in one run` },
  { id: 'perfect2', text: '', target: 2, reward: 30, metric: (r) => r.perfects, grow: 1, unit: 'n', say: (t) => `Land ${n(t)} perfect landings` },
  { id: 'pass1', text: '', target: 1, reward: 25, metric: (r) => r.ghostsPassed, grow: 1, unit: 'n', say: (t) => (t === 1 ? 'Pass a ghost' : `Pass ${n(t)} ghosts in one run`) },
  { id: 'gifts20', text: '', target: 20, reward: 25, metric: (r) => r.gifts, grow: 10, unit: 'n', say: (t) => `Collect ${n(t)} gifts in one run` },
  { id: 'drift5', text: '', target: 5, reward: 30, metric: (r) => r.driftSeconds, grow: 2, unit: 's', say: (t) => `Drift for ${n(t)} seconds in one run` },
  { id: 'air15', text: '', target: 1.5, reward: 25, metric: (r) => r.maxAirtime, grow: 0.5, unit: 's', say: (t) => `Get ${n(t)} ${plural(t, 'second', 'seconds')} of air` },
  { id: 'near4', text: '', target: 4, reward: 35, metric: (r) => r.nearMisses, grow: 1, unit: 'n', say: (t) => `Get ${n(t)} near misses in one run` },
  { id: 'spin360', text: '', target: 2, reward: 35, metric: (r) => r.maxHalfTurns, grow: 1, unit: 'deg', say: (t) => `Land a ${n(t * 180)} spin` },
  { id: 'draft4', text: '', target: 4, reward: 35, metric: (r) => r.draftSeconds, grow: 2, unit: 's', say: (t) => `Draft ghosts for ${n(t)} seconds` },
  { id: 'combo3k', text: '', target: 3000, reward: 40, metric: (r) => r.bestCombo, grow: 'x2', cap: 40000, unit: 'n', say: (t) => `Bank a ${n(t)} point combo` },
  { id: 'dist2000', text: '', target: 2000, reward: 45, metric: (r) => r.distance, grow: 'x2', cap: 6000, unit: 'm', say: (t) => `Ride ${n(t)} m in one run` },
  { id: 'flip1', text: '', target: 1, reward: 50, metric: (r) => r.flips, grow: 1, unit: 'n', say: (t) => (t === 1 ? 'Land a backflip' : `Land ${n(t)} backflips in one run`) },
  { id: 'pass3', text: '', target: 3, reward: 50, metric: (r) => r.ghostsPassed, grow: 1, unit: 'n', say: (t) => `Pass ${n(t)} ghosts in one run` },
  { id: 'speed36', text: '', target: 36, reward: 40, metric: (r) => r.maxSpeed, grow: 2, cap: 42, unit: 'm/s', say: (t) => `Hit ${n(t)} m/s` },
  { id: 'perfect5', text: '', target: 5, reward: 55, metric: (r) => r.perfects, grow: 1, unit: 'n', say: (t) => `Land ${n(t)} perfect landings` },
  { id: 'smash3', text: '', target: 3, reward: 35, metric: (r) => r.smashes, biome: 'alpine', grow: 1, unit: 'n', say: (t) => `Smash ${n(t)} snowmen` },
  { id: 'gates3', text: '', target: 3, reward: 40, metric: (r) => r.gates, biome: 'blossom', grow: 1, unit: 'n', say: (t) => `Ride through ${n(t)} spirit gates` },
  { id: 'score12k', text: '', target: 12000, reward: 60, metric: (r) => r.score, grow: 'x2', cap: 100000, unit: 'n', say: (t) => `Score ${n(t)} in one run` },
  { id: 'spin720', text: '', target: 4, reward: 70, metric: (r) => r.maxHalfTurns, grow: 1, unit: 'deg', say: (t) => `Land a ${n(t * 180)}` },
  { id: 'grudge', text: '', target: 1, reward: 60, metric: (r) => (r.grudgeBeaten ? 1 : 0), grow: 0, unit: 'n', say: () => 'Beat your grudge ghost' },
  { id: 'combo10k', text: '', target: 10000, reward: 80, metric: (r) => r.bestCombo, grow: 'x2', cap: 40000, unit: 'n', say: (t) => `Bank a ${n(t)} point combo` },
  { id: 'dist4000', text: '', target: 4000, reward: 90, metric: (r) => r.distance, grow: 'x2', cap: 6000, unit: 'm', say: (t) => `Ride ${n(t)} m in one run` },
  { id: 'score40k', text: '', target: 40000, reward: 120, metric: (r) => r.score, grow: 'x2', cap: 100000, unit: 'n', say: (t) => `Score ${n(t)} in one run` },
];

export const MISSIONS: readonly MissionDef[] = DEFS.map((d) => ({ ...d, text: d.say(d.target) }));

/** Difficulty bands, by index into MISSIONS: the rotation shuffles inside each band. The first band
 *  is the onboarding trio, kept in order on the first cycle so a fresh save rides 800 m, lands two
 *  perfects and passes a ghost first. */
const BANDS: ReadonlyArray<readonly [number, number]> = [
  [0, 3],
  [3, 9],
  [9, 16],
  [16, MISSIONS.length],
];

const ROMAN = ['', '', ' (II)', ' (III)'];

export interface MissionState {
  /** tier: 1 to 3 from the second cycle on (read as a.tier ?? 1). */
  active: Array<{ id: string; best: number; tier?: number }>;
  /** Next index into the rotation (cycle = floor(cursor / MISSIONS.length)). */
  cursor: number;
  completed: number;
  /** The rotation's shuffle seed, captured once so a later name change never reshuffles it. */
  seed?: number;
}

/** Which biomes count for the rotation: the ones whose mountain is unlocked. */
export interface MissionCtx {
  unlockedBiomes: ReadonlySet<string>;
}

/** The biomes of every mountain open at this many lifetime passes. */
export function unlockedBiomes(ghostsPassed: number): Set<string> {
  const out = new Set<string>();
  for (const m of MOUNTAINS) if (ghostsPassed >= m.unlockGhosts) out.add(biomeForSeed(m.seed));
  return out;
}

/** A seed for saves made before the seed was captured (the save store passes hashString(name)). */
const DEFAULT_SEED = 0x6d15510e;

export function newMissionState(seed = DEFAULT_SEED, ctx: MissionCtx = { unlockedBiomes: unlockedBiomes(0) }): MissionState {
  const s: MissionState = { active: [], cursor: 0, completed: 0, seed: seed >>> 0 };
  topUp(s, ctx);
  return s;
}

let orderMemo: { seed: number; cycle: number; order: number[] } | null = null;

/**
 * One cycle of the rotation: every mission index exactly once, shuffled inside its difficulty band by
 * an rng seeded from the captured seed and the cycle. The first cycle keeps the onboarding band in
 * order.
 */
export function cycleOrder(seed: number, cycle: number): readonly number[] {
  if (orderMemo && orderMemo.seed === seed && orderMemo.cycle === cycle) return orderMemo.order;
  const rng = new Rng(hash32(seed, cycle, 0x6d15));
  const order: number[] = [];
  BANDS.forEach(([a, b], bi) => {
    const band: number[] = [];
    for (let i = a; i < b; i++) band.push(i);
    if (!(cycle === 0 && bi === 0)) {
      for (let i = band.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const t = band[i];
        band[i] = band[j];
        band[j] = t;
      }
    }
    order.push(...band);
  });
  orderMemo = { seed, cycle, order };
  return order;
}

/** Fills the free slots from the rotation, skipping missions already active and biome missions whose
 *  mountain is locked (they come back in a later cycle). No ctx means every biome counts. */
export function topUp(s: MissionState, ctx?: MissionCtx): void {
  const ids = new Set(s.active.map((a) => a.id));
  const seed = (s.seed ?? DEFAULT_SEED) >>> 0;
  const L = MISSIONS.length;
  let guard = 0;
  while (s.active.length < 3 && guard++ < L * 3) {
    const cycle = Math.floor(s.cursor / L);
    const def = MISSIONS[cycleOrder(seed, cycle)[s.cursor % L]];
    s.cursor++;
    if (ids.has(def.id)) continue;
    if (def.biome && ctx && !ctx.unlockedBiomes.has(def.biome)) continue;
    ids.add(def.id);
    const tier = def.grow ? Math.min(3, 1 + cycle) : 1;
    s.active.push(tier > 1 ? { id: def.id, best: 0, tier } : { id: def.id, best: 0 });
  }
}

export function missionDef(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** A mission at a tier: its text (with " (II)" or " (III)"), target and reward. Old saves read as I. */
export function missionTier(def: MissionDef, tier: number | undefined): { tier: number; text: string; target: number; reward: number } {
  const t = def.grow ? Math.max(1, Math.min(3, Math.floor(tier ?? 1))) : 1;
  if (t === 1) return { tier: 1, text: def.text, target: def.target, reward: def.reward };
  const up = t - 1;
  let target = def.grow === 'x2' ? def.target * 2 ** up : def.target + def.grow * up;
  if (def.cap !== undefined) target = Math.min(def.cap, target);
  const reward = Math.round((def.reward * 1.5 ** up) / 5) * 5;
  return { tier: t, text: def.say(target) + ROMAN[t], target, reward };
}

/** How far along a mission is, in its own unit ("540 of 800 m", "1.2 of 1.5 s", "1 of 2"). */
export function missionProgressText(def: MissionDef, progress: number, target: number): string {
  const p = Math.min(progress, target);
  switch (def.unit) {
    case 'm':
      return `${n(Math.floor(p))} of ${n(target)} m`;
    case 's':
      return `${n(Math.floor(p * 10) / 10)} of ${n(target)} s`;
    case 'm/s':
      return `${n(Math.floor(p))} of ${n(target)} m/s`;
    case 'deg':
      return `${n(Math.floor(p) * 180)} of ${n(target * 180)}`;
    default:
      return `${n(Math.floor(p))} of ${n(target)}`;
  }
}

export interface MissionResult {
  id: string;
  text: string;
  progress: number;
  target: number;
  reward: number;
  done: boolean;
  justCompleted: boolean;
}

/** Apply a finished run. Returns the views for the results screen and the gifts earned. Unknown ids
 *  (a mission retired since the save was written) are dropped. */
export function applyRun(s: MissionState, r: RunSummary, ctx?: MissionCtx): { views: MissionResult[]; reward: number } {
  const views: MissionResult[] = [];
  let reward = 0;
  const keep: MissionState['active'] = [];
  for (const a of s.active) {
    const def = missionDef(a.id);
    if (!def) continue;
    const t = missionTier(def, a.tier);
    const applicable = !def.biome || def.biome === r.biome;
    const value = applicable ? def.metric(r) : 0;
    a.best = Math.max(a.best, value);
    const done = a.best >= t.target;
    views.push({ id: def.id, text: t.text, progress: Math.min(a.best, t.target), target: t.target, reward: t.reward, done, justCompleted: done });
    if (done) {
      reward += t.reward;
      s.completed++;
    } else keep.push(a);
  }
  s.active = keep;
  topUp(s, ctx);
  return { views, reward };
}

/** Live view of current missions (title screen). Unknown ids are left out. */
export function missionViews(s: MissionState): MissionResult[] {
  const out: MissionResult[] = [];
  for (const a of s.active) {
    const def = missionDef(a.id);
    if (!def) continue;
    const t = missionTier(def, a.tier);
    out.push({ id: def.id, text: t.text, progress: Math.min(a.best, t.target), target: t.target, reward: t.reward, done: false, justCompleted: false });
  }
  return out;
}
