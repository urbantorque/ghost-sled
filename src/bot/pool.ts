import { ChaosEvent, ChaosRoll, Mood, rollChaos } from '../sim/chaos';
import { clamp } from '../sim/dmath';
import { Rng, hash32 } from '../sim/prng';
import { RunRecord, recordToString } from '../sim/replay';
import { Sim } from '../sim/sim';
import { runBot } from './bot';
import { uniqueGhostName } from './names';

// Ghost pools: run bots across the skill range on one mountain, then keep a spread of results whose
// scores climb roughly log-uniformly from beginner to expert. Picking by score (not by skill) keeps
// the spread right even after the physics is retuned. No Node APIs: this also runs in a worker for
// the Daily Mountain.

export interface PoolGhost {
  name: string;
  score: number;
  distance: number;
  ticks: number;
  sled: number;
  mood: number;
  event: number;
  /** recordToString of the full run record. */
  record: string;
}

/** One candidate run, for reporting (the generator script prints these). */
export interface PoolRun {
  skill: number;
  record: RunRecord;
  sim: Sim;
  selected: boolean;
}

export interface PoolOptions {
  /** Bot runs to choose from (default about 2.4 per ghost). */
  budgetRuns?: number;
  /** Cap on a run's length in ticks (default 5 minutes). */
  maxTicks?: number;
  /** Called once with every candidate run after selection. */
  report?: (runs: PoolRun[]) => void;
}

const LN2 = 0.6931471805599453;
/** Where the score targets start: a beginner who crashed early. */
const MIN_SCORE = 250;

/** Natural log from + - * / only (the bot code avoids engine-dependent Math functions). */
function ln(x: number): number {
  if (!(x > 0)) return -Infinity;
  // Halving Infinity never gets below 2, so it would spin forever.
  if (x === Infinity) return Infinity;
  let e = 0;
  while (x >= 2) {
    x /= 2;
    e++;
  }
  while (x < 1) {
    x *= 2;
    e--;
  }
  // ln(m) = 2 atanh((m - 1) / (m + 1)), |y| <= 1/3 so the series converges quickly.
  const y = (x - 1) / (x + 1);
  const y2 = y * y;
  let term = y;
  let sum = 0;
  for (let n = 1; n <= 31; n += 2) {
    sum += term / n;
    term *= y2;
  }
  return 2 * sum + e * LN2;
}

function chaosFor(rng: Rng, seed: number, salt: number, i: number): ChaosRoll {
  const s = hash32(seed, salt, i, 0xc4a0);
  // About 60% plain; the rest are real chaos rolls (which can still come up plain).
  if (rng.chance(0.6)) return { mood: Mood.None, event: ChaosEvent.None, seed: s };
  return rollChaos(s, 1 + rng.int(0, 5));
}

export function generatePool(seed: number, count: number, salt: number, opts: PoolOptions = {}): PoolGhost[] {
  // Without this an empty request would still pay for a handful of bot runs.
  if (!(count >= 1)) return [];
  const rng = new Rng(hash32(seed, salt, 0x9057));
  const budget = Math.max(count, opts.budgetRuns ?? Math.max(count + 4, Math.round(count * 2.4)));
  const maxTicks = opts.maxTicks ?? 60 * 60 * 5;
  const runs: PoolRun[] = [];
  for (let i = 0; i < budget; i++) {
    // Stratified over the skill range, leaning a little toward the top where scores spread most.
    const u = (i + rng.next()) / budget;
    const skill = clamp(u * (1.25 - 0.25 * u), 0, 1);
    const sled = rng.chance(0.65) ? 0 : rng.int(1, 5);
    const chaos = chaosFor(rng, seed, salt, i);
    const { record, sim } = runBot(seed, chaos, { skill, seed: hash32(seed, salt, i, 0xb075), sled, name: '' }, maxTicks);
    runs.push({ skill, record, sim, selected: false });
  }

  // Log-spaced score targets from a beginner's few hundred points (or the weakest run, if better) up
  // to the best run, each filled by the closest unused run. The top target is filled first so the
  // pool always contains the best run.
  let lo = Infinity;
  let hi = 0;
  for (const r of runs) {
    lo = Math.min(lo, Math.max(1, r.record.score));
    hi = Math.max(hi, r.record.score);
  }
  lo = Math.max(lo, Math.min(MIN_SCORE, hi));
  const lnLo = ln(lo);
  const lnHi = ln(Math.max(hi, lo + 1));
  const n = Math.min(count, runs.length);
  const picked: PoolRun[] = [];
  for (let j = n - 1; j >= 0; j--) {
    const target = n === 1 ? lnHi : lnLo + ((lnHi - lnLo) * j) / (n - 1);
    let best: PoolRun | null = null;
    let bestD = Infinity;
    for (const r of runs) {
      if (r.selected) continue;
      let d = Math.abs(ln(Math.max(1, r.record.score)) - target);
      // Two ghosts with the same score usually crashed into the same tree; prefer variety.
      for (const q of picked) if (Math.abs(q.record.score - r.record.score) <= 2 + q.record.score * 0.002) d += 1;
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    if (!best) break;
    best.selected = true;
    picked.push(best);
  }
  picked.sort((a, b) => a.record.score - b.record.score || a.record.ticks - b.record.ticks);

  const names = new Rng(hash32(seed, salt, 0x4a3e));
  const taken = new Set<string>();
  const ghosts = picked.map((r): PoolGhost => {
    const record = { ...r.record, name: uniqueGhostName(names, taken) };
    r.record = record;
    return {
      name: record.name,
      score: record.score,
      distance: Math.round(record.distance * 10) / 10,
      ticks: record.ticks,
      sled: record.sled,
      mood: record.chaos.mood,
      event: record.chaos.event,
      record: recordToString(record),
    };
  });
  opts.report?.(runs);
  return ghosts;
}
