import { ChaosEvent, ChaosRoll, Mood, rollChaos } from '../sim/chaos';
import { clamp } from '../sim/dmath';
import { Rng, hash32 } from '../sim/prng';
import { RunRecord, recordToString } from '../sim/replay';
import { Sim } from '../sim/sim';
import { runBot } from './bot';
import { uniqueGhostName } from './names';

// Ghost pools: run bots across the skill range on one mountain, then keep a spread of results from the
// weakest in the race to the best. Picking by result (not by skill) keeps the spread right even after
// the physics is retuned. No Node APIs: this also runs in a worker for the Daily Mountain.

export interface PoolGhost {
  name: string;
  score: number;
  distance: number;
  ticks: number;
  /** Tick the finish line was crossed, or -1 for a rider who never reached it. */
  finishTick: number;
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

/** A run's place in the race: higher is better. */
function raceKey(r: PoolRun): number {
  return r.sim.s.finished ? 1e7 - r.sim.s.finishTick : r.record.distance;
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

  // Race order, weakest first: riders who never finished by distance, then finishers by time. The pool
  // steps evenly through that order, and always keeps the best run, so every pace has a rival near it.
  runs.sort((a, b) => raceKey(a) - raceKey(b));
  const n = Math.min(count, runs.length);
  const picked: PoolRun[] = [];
  for (let j = 0; j < n; j++) {
    const at = n === 1 ? runs.length - 1 : Math.round((j * (runs.length - 1)) / (n - 1));
    runs[at].selected = true;
    picked.push(runs[at]);
  }

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
      finishTick: r.sim.s.finishTick,
      sled: record.sled,
      mood: record.chaos.mood,
      event: record.chaos.event,
      record: recordToString(record),
    };
  });
  opts.report?.(runs);
  return ghosts;
}
