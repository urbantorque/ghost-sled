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

/** Each slow rider's time is this much over the next one's. */
const STEP = 1.07;
/** The slowest time a slow rider rides, seconds: past this nobody is racing. */
const SLOWEST = 300;
/** Runs the slow riders are made from: the pool's slowest finishers, so they ride like beginners. */
const BASES = 6;

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
  let target = (finishers[0].finishTick! / 60) * STEP;
  for (let i = 0; target <= SLOWEST; i++, target *= STEP) {
    const base = bases[i % bases.length];
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
