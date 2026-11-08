import { uniqueGhostName } from '../bot/names';
import { Rng, hashString } from '../sim/prng';
import { recordFromString, recordToString } from '../sim/replay';
import type { PoolGhostData } from './ghostdata';

// The slow end of the race. Bots are good: the slowest of them finishes a descent in about 2:30, and a
// beginner in 3:30 had nobody near them, so the field rode away in the first seconds and the ladder had
// one rung for everybody between 2:35 and 4:00. Making a bot ride badly only makes it crash (a weaving
// bot wrecked rather than finished slower, measured), so a slow rider here is a real finisher's run
// replayed at a steady slower pace. Ghosts are never colliders, so only where they are at a tick matters,
// and the record itself replays exactly as it always did: the pace is applied to its playback.
//
// Each slow rider is its own record under its own name, so the field, the grudge and the ladder, which
// all tell riders apart by record, need to know nothing about any of this. A saved grudge comes back to
// its pace because the same pool always makes the same riders.

/** Each slow rider's time is this much over the next one's: close enough to fill a pack at any pace. */
const STEP = 1.035;
/** The slowest time a slow rider rides, seconds: past this nobody is racing. */
const SLOWEST = 300;
/** Runs the slow riders are made from: the pool's slowest finishers, so they ride like beginners. */
const BASES = 6;
/** A gap in the pool's own finish times this wide or wider (one time over the next) is filled too. */
const HOLE = 1.07;

const paces = new Map<string, number>();

/** The rate a record plays at: 1 for every real run. */
export function paceOf(record: string): number {
  return paces.get(record) ?? 1;
}

const race = (g: PoolGhostData): number => (typeof g.finishTick === 'number' && g.finishTick > 0 ? 1e7 - g.finishTick : g.distance);

/** The pool with slow riders filling the race down to SLOWEST, in race order, weakest first. The same
 *  pool and salt always make the same riders. */
export function withSlowRiders(pool: readonly PoolGhostData[], salt: string): PoolGhostData[] {
  const finishers = pool.filter((g) => typeof g.finishTick === 'number' && g.finishTick > 0).sort((a, b) => race(a) - race(b));
  if (finishers.length === 0) return [...pool];
  const rng = new Rng(hashString('slow/' + salt));
  const taken = new Set(pool.map((g) => g.name.toLowerCase()));
  const rows: PoolGhostData[] = [];
  const bases = finishers.slice(0, BASES);
  const secs = (g: PoolGhostData): number => g.finishTick! / 60;
  // Where the pool's own slow end has a hole (a beginner bot that tumbled twice finishes well behind the
  // next), slow riders fill it too, each made from the slowest finisher still faster than it.
  const targets: number[] = [];
  const fastest = [...finishers].reverse();
  for (let i = 1; i < fastest.length; i++) {
    const a = secs(fastest[i - 1]);
    const b = secs(fastest[i]);
    if (b / a < HOLE) continue;
    for (let t = a * STEP; t < b / 1.02; t *= STEP) targets.push(t);
  }
  for (let t = secs(finishers[0]) * STEP; t <= SLOWEST; t *= STEP) targets.push(t);
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const under = finishers.filter((g) => secs(g) < target * 0.999);
    const base = target > secs(finishers[0]) ? bases[i % bases.length] : under[0];
    if (!base) continue;
    const pace = base.finishTick! / 60 / target;
    let rec;
    try {
      rec = recordFromString(base.record);
    } catch {
      // A stale pool has no replays to slow down.
      return [...pool];
    }
    const name = uniqueGhostName(rng, taken);
    const record = recordToString({ ...rec, name });
    paces.set(record, pace);
    rows.push({
      ...base,
      name,
      record,
      ticks: Math.round(base.ticks / pace),
      finishTick: Math.round(base.finishTick! / pace),
      stageTicks: base.stageTicks?.map((t) => Math.round(t / pace)),
    });
  }
  return [...pool, ...rows].sort((a, b) => race(a) - race(b));
}
