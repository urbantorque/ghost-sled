import { ChaosEvent, ChaosRoll, Mood, rollChaos } from '../sim/chaos';
import { clamp } from '../sim/dmath';
import { Rng, hash32 } from '../sim/prng';
import { RunRecord, recordToString, replayRecord } from '../sim/replay';
import { Sim } from '../sim/sim';
import { eventsFor, finishZFor } from '../sim/course';
import { type Field, type Track, runBot } from './bot';
import { ALL_CHARMS, STARTER_POOL } from '../sim/charms';
import { uniqueGhostName } from './names';
import { HOME_RIDERS, ROSTER, riderSkill } from './roster';

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
  /** Where the rider really went down, metres down the run, in the order it did: every tumble, and the
   *  wreck that ended the run if one did (graveyards.ts clusters them). Empty for a clean run. */
  falls: number[];
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
  /** The mountain's index, when the pool is a named mountain's: its signature riders ride it, each once. */
  mountain?: number;
  /** How many signature riders join (default all of them on a named mountain, none otherwise). */
  riders?: number;
  /** Riders added at the fast end (round 7; default FAST_RIDERS on a named mountain, none otherwise): the
   *  quickest of FAST_TRIES times as many runs by the best bots, plain chaos so they can ride any run. */
  fast?: number;
  /** Runs tried for each of them (default FAST_TRIES; a Daily's worker pool asks for fewer). */
  fastTries?: number;
  /** Bot runs to choose from (default about 2.4 per ghost). */
  budgetRuns?: number;
  /** Cap on a run's length in ticks (default 5 minutes). */
  maxTicks?: number;
  /** Called once with every candidate run after selection. */
  report?: (runs: PoolRun[]) => void;
}

/** The fast end (round 7). A pool stepped evenly through the bots' results holds two or three riders
 *  within 2 s of its quickest, so a player near the top of it had nobody ahead after the first stage and
 *  one rider to chase at most. These riders are the quickest of many more top-skill runs, each a real
 *  record: the quickest a bot can ride this mountain, and a rider every FAST_GAP_S down from there. */
export const FAST_RIDERS = 8;
/** (Twelve tries a rider since the racers: a pool is ridden offline, and the quickest of 96 is a second or two
 *  quicker than the quickest of 48.) */
const FAST_TRIES = 12;
const FAST_GAP_S = 0.5;

/** A run's place in the race: higher is better. */
function raceKey(r: PoolRun): number {
  return r.sim.s.finished ? 1e7 - r.sim.s.finishTick : r.record.distance;
}

function chaosFor(rng: Rng, seed: number, salt: number, i: number): ChaosRoll {
  const s = hash32(seed, salt, i, 0xc4a0);
  // About 60% plain; the rest are real chaos rolls (which can still come up plain).
  if (rng.chance(0.6)) return { mood: Mood.None, event: ChaosEvent.None, seed: s };
  return rollChaos(s, 1 + rng.int(0, 5), Mood.None, eventsFor(seed));
}

/** Where a run went down, read off a replay of its record: the sim says so in its events, and a replay
 *  changes nothing about the run. The whole metre is close enough for a cairn and costs a pool almost
 *  nothing. */
export function fallsOf(record: RunRecord): number[] {
  const falls: number[] = [];
  replayRecord(record, (sim) => {
    // A ward is a fall the lantern took: the place is as deadly, so it counts.
    for (const e of sim.events) if (e.type === 'crash' || e.type === 'ward' || (e.type === 'tumble' && e.phase === 'start')) falls.push(Math.round(sim.s.z));
  });
  return falls;
}

/** The field a pool run races (round 8): up to FIELD of the runs made before it, the nearest to its skill, and of
 *  them the signature riders may be met in a showdown (a player meets the same kinds). */
const FIELD = 7;

function fieldFor(made: readonly { skill: number; track: Track; signature: boolean }[], skill: number): Field {
  const near = made
    .map((r, i) => ({ r, i, d: Math.abs(r.skill - skill) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, FIELD)
    .sort((a, b) => a.i - b.i);
  return { tracks: near.map((n) => n.r.track), duel: near.map((n) => n.r.signature) };
}

/** How much of the skill range the crowd spans (round 8; see generatePool). */
const CROWD_REACH = 0.72;

/** The charms a pool rider may be offered: a newcomer the starter pool, everyone else all of them. */
function poolCharms(skill: number): number {
  return skill < 0.35 ? STARTER_POOL : ALL_CHARMS;
}

export function generatePool(seed: number, count: number, salt: number, opts: PoolOptions = {}): PoolGhost[] {
  // Without this an empty request would still pay for a handful of bot runs.
  if (!(count >= 1)) return [];
  const rng = new Rng(hash32(seed, salt, 0x9057));
  const budget = Math.max(count, opts.budgetRuns ?? Math.max(count + 4, Math.round(count * 2.4)));
  const maxTicks = opts.maxTicks ?? 60 * 60 * 5;
  const runs: PoolRun[] = [];
  // Every run, in the order made, for the fields of the runs after it.
  const made: { skill: number; track: Track; signature: boolean }[] = [];

  // The signature riders ride first (round 8), so the crowd after them can meet them in a showdown, as a player
  // does: each rides once at its own level and style, on its own sled, plain chaos.
  const riders = opts.riders ?? (opts.mountain !== undefined ? ROSTER.length : 0);
  const signed: PoolRun[] = [];
  if (riders > 0) {
    const pick = new Rng(hash32(seed, salt, 0x51d3));
    const cast = ROSTER.slice();
    for (let i = cast.length - 1; i > 0; i--) {
      const j = pick.int(0, i);
      const t = cast[i];
      cast[i] = cast[j];
      cast[j] = t;
    }
    for (const rd of cast.slice(0, Math.min(riders, cast.length))) {
      const skill = riderSkill(rd, opts.mountain ?? -1);
      const chaos = { mood: Mood.None, event: ChaosEvent.None, seed: hash32(seed, salt, 0xc4a1, rd.key.length) };
      const { record, sim, track } = runBot(seed, chaos, { skill, seed: hash32(seed, salt, 0x51d0, ROSTER.indexOf(rd)), sled: rd.sled, name: rd.name, style: rd.style, charmPool: ALL_CHARMS }, maxTicks, fieldFor(made, skill));
      made.push({ skill, track, signature: true });
      signed.push({ skill, record, sim, selected: true });
    }
    // (Round 9: a new mountain's home riders after them, each once, on draws of their own: none on the five, whose
    // pools draw exactly what they drew.)
    for (const rd of HOME_RIDERS) {
      if (rd.home !== opts.mountain) continue;
      const skill = riderSkill(rd, opts.mountain);
      const chaos = { mood: Mood.None, event: ChaosEvent.None, seed: hash32(seed, salt, 0x40e1, HOME_RIDERS.indexOf(rd)) };
      const { record, sim, track } = runBot(seed, chaos, { skill, seed: hash32(seed, salt, 0x40e2, HOME_RIDERS.indexOf(rd)), sled: rd.sled, name: rd.name, style: rd.style, charmPool: ALL_CHARMS }, maxTicks, fieldFor(made, skill));
      made.push({ skill, track, signature: true });
      signed.push({ skill, record, sim, selected: true });
    }
  }

  for (let i = 0; i < budget; i++) {
    // Stratified over the skill range, leaning a little toward the top where scores spread most.
    const u = (i + rng.next()) / budget;
    // (Round 8: the crowd's skills reach CROWD_REACH of the old range. Riders who draft their field, take charms and
    // win lanterns off rivals ride faster than round 7's at the same skill, and the pool lost its slow end.)
    const skill = clamp(u * (1.25 - 0.25 * u) * CROWD_REACH, 0, 1);
    const sled = rng.chance(0.65) ? 0 : rng.int(1, 5);
    const chaos = chaosFor(rng, seed, salt, i);
    const { record, sim, track } = runBot(seed, chaos, { skill, seed: hash32(seed, salt, i, 0xb075), sled, name: '', charmPool: poolCharms(skill) }, maxTicks, fieldFor(made, skill));
    made.push({ skill, track, signature: false });
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

  // The signature riders join the crowd in race order, so the pool still steps evenly through every pace.
  if (signed.length) {
    runs.push(...signed);
    picked.push(...signed);
    picked.sort((a, b) => raceKey(a) - raceKey(b));
  }

  // The fast end: many runs by the best bots, on every sled, and the quickest of them kept, each at least
  // FAST_GAP_S from the last and from every rider already in.
  const fast = Math.max(0, Math.floor(opts.fast ?? (opts.mountain !== undefined ? FAST_RIDERS : 0)));
  if (fast > 0) {
    const tries: PoolRun[] = [];
    for (let i = 0; i < fast * (opts.fastTries ?? FAST_TRIES); i++) {
      const skill = i % 3 === 2 ? 0.95 : 1;
      const chaos = { mood: Mood.None, event: ChaosEvent.None, seed: hash32(seed, salt, 0xfa57, i) };
      // (Racers, round 7's simfix: tucked on every straight, every set piece tried, every lantern a dash. They
      // are two to four seconds quicker at the top than the best of the crowd's own kind.)
      const { record, sim, track } = runBot(seed, chaos, { skill, seed: hash32(seed, salt, 0xfa58, i), sled: i % 6, name: '', style: 'racer', charmPool: ALL_CHARMS }, maxTicks, fieldFor(made, skill));
      made.push({ skill, track, signature: false });
      if (sim.s.finished) tries.push({ skill, record, sim, selected: false });
    }
    tries.sort((a, b) => a.sim.s.finishTick - b.sim.s.finishTick);
    // (Round 9: the gap in ticks, scaled to the course's length: the five's 4,500 m read FAST_GAP_S as it is, the Old Run's
    // 3,000 m two thirds of it, or a run a third shorter keeps a third fewer of its quickest.)
    const gap = FAST_GAP_S * 60 * (finishZFor(seed) / 4500);
    const taken = picked.filter((r) => r.sim.s.finished).map((r) => r.sim.s.finishTick);
    let kept = 0;
    for (const r of tries) {
      if (kept >= fast) break;
      if (taken.some((t) => Math.abs(t - r.sim.s.finishTick) < gap)) continue;
      r.selected = true;
      taken.push(r.sim.s.finishTick);
      picked.push(r);
      kept++;
    }
    runs.push(...tries);
    picked.sort((a, b) => raceKey(a) - raceKey(b));
  }

  const names = new Rng(hash32(seed, salt, 0x4a3e));
  const taken = new Set<string>(picked.map((r) => r.record.name).filter((n) => n));
  const ghosts = picked.map((r): PoolGhost => {
    const record = { ...r.record, name: r.record.name || uniqueGhostName(names, taken) };
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
      falls: fallsOf(record),
      record: recordToString(record),
    };
  });
  opts.report?.(runs);
  return ghosts;
}
