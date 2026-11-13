// The race lab: how live a race the field gives a pilot over runs 2 to 6, in node, with no browser. It takes
// the pilot lab's rides (lab.ts --json: every ride carries the tick it passed each 10 m) as the player's runs,
// builds each run's field as the game does (field.ts on the bundled pools, with the slow riders), replays the
// picked records for where each ghost is at each tick, and counts what telemetry.js counts in a browser: the
// share of the run with a riding ghost within 40 m (race-live), and passes a minute. The pilots here ride
// without a slipstream, so their times are a few seconds slower than in the game; what it is for is the same
// runs raced against two ways of picking a field: five riders on the fixed roles round the anchor (rounds 4
// to 6), and the field laid across the player's own runs with two more riders (round 7). Every order of a pilot's six runs is a different history,
// so each pilot and mountain is raced over many of them.
//   npx tsx scripts/playtest/lab.ts --pilots mid,expert,stunt --json lab.json
//   npx tsx scripts/playtest/race-lab.ts --rides lab.json [--orders 24] [--pilots mid,expert,stunt]
import { readFileSync } from 'node:fs';
import { anchorFor, fieldCount, pickField, recentFor, type FieldPick } from '../../src/game/field';
import type { PoolGhostData } from '../../src/game/ghostdata';
import { paceOf, withSlowRiders } from '../../src/game/slowriders';
import { MOUNTAINS } from '../../src/sim/mountains';
import { recordFromString, replayRecord } from '../../src/sim/replay';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const ORDERS = +opt('orders', '24');
const PILOTS = opt('pilots', 'mid,expert,stunt').split(',');
const FINISH = 4500;
const NEAR = 40;

interface Ride {
  pilot: string;
  m: number;
  seed: number;
  finished: boolean;
  marks: number[];
}
const rides: Ride[] = JSON.parse(readFileSync(opt('rides', 'lab.json'), 'utf8'));

/** The tick a record passed each 10 m (its own clock), by record string. */
const tracks = new Map<string, number[]>();
function track(record: string): number[] {
  let t = tracks.get(record);
  if (t) return t;
  t = [];
  const marks = t;
  replayRecord(recordFromString(record), (sim) => {
    while (marks.length * 10 <= sim.s.z) marks.push(sim.tick);
  });
  tracks.set(record, t);
  return t;
}

/** Where a track is at a tick, metres (its last mark once it has stopped; riding: false then). */
function zAt(marks: number[], tick: number): { z: number; riding: boolean } {
  const n = marks.length;
  if (n === 0) return { z: 0, riding: false };
  if (tick >= marks[n - 1]) return { z: (n - 1) * 10, riding: false };
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (marks[mid] <= tick) lo = mid;
    else hi = mid;
  }
  const span = marks[hi] - marks[lo];
  return { z: lo * 10 + (span > 0 ? (10 * (tick - marks[lo])) / span : 0), riding: true };
}

interface Raced {
  live: number;
  passes: number;
  passedBy: number;
  mins: number;
  nearest: number;
}

/** One run raced against a field. */
function race(player: number[], field: FieldPick[]): Raced {
  const end = player[Math.min(player.length - 1, FINISH / 10)];
  const ghosts = field.map((p) => ({ marks: track(p.record), pace: paceOf(p.record), was: 0 }));
  let live = 0;
  let n = 0;
  let passes = 0;
  let passedBy = 0;
  let nearestSum = 0;
  for (let tick = 0; tick < end; tick += 15) {
    const pz = zAt(player, tick).z;
    let near = false;
    let nearest = 1e9;
    for (const g of ghosts) {
      const at = zAt(g.marks, tick * g.pace);
      const gap = at.z - pz;
      // A pass either way, once the start line's jostle is over (the first six seconds).
      const side = gap > 0.5 ? 1 : gap < -0.5 ? -1 : 0;
      if (tick > 360 && side !== 0 && g.was !== 0 && side !== g.was) {
        if (side < 0) passes++;
        else passedBy++;
      }
      if (side !== 0) g.was = side;
      if (!at.riding || at.z >= FINISH) continue;
      if (Math.abs(gap) <= NEAR) near = true;
      nearest = Math.min(nearest, Math.abs(gap));
    }
    n++;
    if (near) live++;
    nearestSum += Math.min(nearest, 400);
  }
  return { live: live / Math.max(1, n), passes, passedBy, mins: end / 3600, nearest: nearestSum / Math.max(1, n) };
}

/** A small seeded shuffle, so the orders are the same every time. */
function shuffled<T>(xs: T[], seed: number): T[] {
  const a = xs.slice();
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pools = MOUNTAINS.map((m) => withSlowRiders((JSON.parse(readFileSync(`src/data/ghosts/${m.id}.json`, 'utf8')) as { ghosts: PoolGhostData[] }).ghosts, m.id));
console.log(`race-live (a riding ghost within ${NEAR} m) and passes a minute, runs 2 to 6, ${ORDERS} orders of each pilot's six rides a mountain`);
console.log('pilot   mtn       times s (min..max)   five on fixed roles: live  passes/min  nearest m  quiet runs | laid across your runs: live  passes/min  nearest m  quiet runs');
const total: Record<string, { a: Raced[]; b: Raced[] }> = {};
for (const pilot of PILOTS) {
  for (let m = 0; m < MOUNTAINS.length; m++) {
    const mine = rides.filter((r) => r.pilot === pilot && r.m === m && r.finished && r.marks.length > FINISH / 10);
    if (mine.length < 3) continue;
    const key = MOUNTAINS[m].id;
    const time = (r: Ride): number => r.marks[FINISH / 10] / 60;
    const out = { a: [] as Raced[], b: [] as Raced[] };
    for (let o = 0; o < ORDERS; o++) {
      const order = shuffled(mine, 977 * (o + 1) + m);
      const runTimes: Record<string, number[]> = { [key]: [] };
      for (let k = 0; k < order.length; k++) {
        if (k > 0) {
          const base = { pool: pools[m], kind: 'pool' as const, mood: 0, event: 0, count: 5, anchor: anchorFor(runTimes, key), seed: 31 * o + k, bestScore: 0, you: null, grudge: null, friend: null };
          out.a.push(race(order[k].marks, pickField(base)));
          const recent = recentFor(runTimes, key);
          out.b.push(race(order[k].marks, pickField({ ...base, recent, count: fieldCount(0, recent) })));
        }
        runTimes[key].push(Math.round(time(order[k]) * 10) / 10);
      }
    }
    const mean = (xs: number[]): number => xs.reduce((x, y) => x + y, 0) / Math.max(1, xs.length);
    const row = (rs: Raced[]): string => `${mean(rs.map((r) => r.live)).toFixed(2).padStart(6)}  ${(rs.reduce((x, r) => x + r.passes, 0) / rs.reduce((x, r) => x + r.mins, 0)).toFixed(2).padStart(8)}  ${mean(rs.map((r) => r.nearest)).toFixed(0).padStart(9)}  ${String(rs.filter((r) => r.live < 0.35).length).padStart(4)}/${rs.length}`;
    const ts = mine.map(time);
    console.log(`${pilot.padEnd(7)} ${key.padEnd(9)} ${Math.min(...ts).toFixed(0)}..${Math.max(...ts).toFixed(0)}`.padEnd(40), row(out.a).padEnd(48), '|', row(out.b));
    const t = (total[pilot] ??= { a: [], b: [] });
    t.a.push(...out.a);
    t.b.push(...out.b);
  }
}
console.log('\npilot    five on fixed roles: live  passes/min  quiet runs (live under 0.35) | laid across your runs: live  passes/min  quiet runs');
for (const [pilot, t] of Object.entries(total)) {
  const mean = (rs: Raced[]): string => (rs.reduce((x, r) => x + r.live, 0) / Math.max(1, rs.length)).toFixed(2);
  const ppm = (rs: Raced[]): string => (rs.reduce((x, r) => x + r.passes, 0) / rs.reduce((x, r) => x + r.mins, 0)).toFixed(2);
  const quiet = (rs: Raced[]): string => `${rs.filter((r) => r.live < 0.35).length}/${rs.length}`;
  console.log(`${pilot.padEnd(8)} ${mean(t.a)}  ${ppm(t.a)}  ${quiet(t.a)}`.padEnd(60), '|', `${mean(t.b)}  ${ppm(t.b)}  ${quiet(t.b)}`);
}
