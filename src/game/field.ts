import { riderByName } from '../bot/roster';
import { ChaosEvent, Mood } from '../sim/chaos';
import { recordFromString } from '../sim/replay';
import type { GhostKind } from '../ui/contract';
import type { GhostRole } from './beats';
import type { PoolGhostData } from './ghostdata';
import { MOUNTAINS } from '../sim/mountains';
import { FINISH_Z, finishZOf, predictedTime, recordStanding } from './standing';

// The race field: which ghosts ride a run. A run has an end now, so the field is built around when
// this player would reach it (the anchor, anchorFor: their predicted finish time) rather than where
// they crash: an opener a bit slower than you, a pack around you, a pace rider a bit faster and a
// stretch rider beyond that. Whether you take 150 s or five minutes, ghosts are racing just ahead and
// just behind you all the way down. Your best, the grudge and a friend's challenge ride on top.
//
// The app gathers the inputs (the bundled or Daily pool, the run's chaos, your best, the grudge and
// a friend's challenge) and maps the picks to GhostEntry.
//
// Candidates climb a ladder, stopping once there are count + 3: (1) the run's mood, with no event or
// the run's event; (2) plus plain ghosts; (3) plus plain-mood ghosts with any event and the run's
// mood with any event. A ghost of a different non-plain mood never rides (ghosts replay under their
// recorded chaos, so a Comet ghost would float visibly wrong through a plain run): a field rides
// short instead.
//
// Every ghost has a predicted time (poolTime): its finish, or its pace carried to the line. Roles
// (A the anchor, in seconds): opener in [1.05, 1.22]A aiming at 1.1A; two pack ghosts in [0.93, 1.07]A
// aiming at 0.98 and 1.03A; pace in [0.88, 0.97]A aiming at 0.93A; and the stretch rider (role pace
// too) in [0.75, 0.9]A aiming at 0.85A. Haunted Hollow's four extra ghosts add an opener at 1.16A and
// pack at 0.96, 1.0 and 1.05A. Within a window the pick nearest its target wins; candidates within
// FIELD_TIE_S of the target tie, and a generator seeded with the run's chaos seed picks among them. An
// empty window widens by 25% up to three times (flagged widened), then the nearest unused candidate
// is taken. Every pick sits FIELD_SPACING_S or more from every other pick and from your best, and two
// riders who crashed sit FIELD_SPACING metres apart as well (twin wrecks like Pinecrest's 604.4 and
// 604.4 m never ride together). Finishers are spaced by time alone: they all end at the same line, so
// spacing them by distance rode one.
//
// Once you have ridden a mountain the field is laid across where you finish (round 7, FieldInput.recent).
// The fixed roles above put five riders between 0.88A and 1.07A whoever you were, and a skilled player's
// times move more than that from one run to the next (the expert pilot: 116 to 139 s in five runs), so on a
// slow day the whole field rode away and on a quick one it was left at the first stage line. Now the riders
// are spaced evenly from a little quicker than your quickest recent run (the one to chase on a good day)
// to your slowest of the last three, and never tighter than 1.10A at the slow end or wider than 1.16A (round 7's simfix, on the final pools: 1.08 and 1.12 left a skilled pilot's slow run without a rider 20 times in 300, and this 8). A
// steady player gets a tight pack and an erratic one a long string, and whichever run you have, somebody
// real is near it. And two more riders ride (FIELD_MORE, fieldCount): the race lab (scripts/playtest/
// race-lab.ts) says what makes a race live is how many real riders are spread over where you might finish.
// Five on the fixed roles were within 40 m for 0.53 of a skilled pilot's run; five picked with hindsight,
// nearest the time the pilot then rode, for 0.71; seven laid across its runs, 0.66, with a third of the
// quiet runs; nine, 0.72. The roles are read off the targets (an opener is over 1.03A, pace is under 0.97A), the
// field's pace follows your last three runs when they are quicker than the median of five, and every
// record is still a real run replayed as it was ridden.
//
// Pure: no DOM, render or audio imports.

export interface FieldInput {
  pool: readonly PoolGhostData[];
  kind: 'pool' | 'daily';
  mood: Mood;
  event: ChaosEvent;
  /** Pool ghosts to pick: 5 plus the mood's extra ghosts. */
  count: number;
  /** Your predicted finish time in seconds (anchorFor), or 0 with no runs: a mid-pack time. */
  anchor: number;
  /** Your last predicted finish times on this mountain, oldest first (recentFor). With any, the field is
   *  laid across where you finish; with none it is the fixed roles around the anchor. */
  recent?: readonly number[];
  /** chaos.seed, for reproducible tie-breaks. */
  seed: number;
  /** Your best score on this mountain key (0 for none). Kept for the app's call; the field is built by time. */
  bestScore: number;
  you: { name: string; score: number; distance: number; record: string } | null;
  grudge: { name: string; score: number; record: string; distance?: number; nemesis?: boolean } | null;
  friend: { name: string; score: number; record: string } | null;
  /** The rider the last results promised by name (the Run Again button): it rides next, whatever the
   *  mood, and it is the rival. The app promises nobody while an unbeaten friend or a grudge rides. */
  promised?: { name: string; score: number; record: string } | null;
  /** The mountain's save key (round 8): a very first run's field is laid round FIRST_RUN_PACE for it. */
  key?: string;
  /** Riders who may not ride yet, by name (round 8: The Hollow King before his duel, twelve.ts withheldRiders). */
  withheld?: readonly string[];
  /** The course's finish line (round 9: a new mountain's own length; absent, the five's). */
  finishZ?: number;
}

export interface FieldPick {
  name: string;
  kind: GhostKind;
  score: number;
  record: string;
  role?: GhostRole;
  /** How far its whole run went, in metres, when known. */
  distance?: number;
  /** Its predicted finish time, seconds. */
  time?: number;
  /** Its role window was widened to find it. */
  widened?: boolean;
  nemesis?: boolean;
  /** Your rival for the run: one rider, named at the start and on every stage line. */
  rival?: boolean;
  /** It reads your pace as you ride: a very first run on a bundled mountain (pacer.ts). */
  reads?: boolean;
}

/** The anchor's bounds (seconds). */
export const ANCHOR_MIN = 100;
export const ANCHOR_MAX = 420;
/** Who a first run rides with: a pack where most riders land (about 2:30). On a bundled mountain they
 *  read you (pacer.ts). A Daily or a Cup shares its field, so two true beginners ride far behind it there,
 *  and anyone finds a rider near them. */
export const ANCHOR_DEFAULT = 150;
/** A save's very first run on a bundled mountain (round 8, the race's floor): what a steady hand that only steers
 *  rides there (the lab's `line` pilot on run 1, scripts/playtest/r8-floor.ts; tests/r8bars.test.ts holds it
 *  within 6%). The field is laid round it (firstRoles): three riders quicker than a run that only steers or does
 *  nothing, so the podium is earned, and two a little slower, so a beginner who rides has someone to beat. The riders
 *  still read you (pacer.ts) until the last stage, which they ride on their own pace. A Daily or a Cup is shared and
 *  keeps ANCHOR_DEFAULT. */
export const FIRST_RUN_PACE: Readonly<Record<string, number>> = { pinecrest: 138, frostfang: 138, ember: 128, sakura: 132, lanternfall: 136, oldrun: 92, gullhaven: 157, gablefall: 124 };
/** Predicted times the anchor reads per key (the most recent). */
export const ANCHOR_RUNS = 5;
/** One quick run pulls the next anchor to this multiple of it at most (anchorFor). */
export const ANCHOR_LAST = 1.1;
/** A mountain you have not ridden: your other mountains' median, this much slower. */
export const ANCHOR_NEW = 1.1;
/** The quickest rider of a field laid across your runs: this share of your quickest recent run, by how
 *  many runs are known (one, two, three or more). A new player is still getting quicker fast, so the
 *  carrot hangs further out; and never under FIELD_FAST_MIN of the field's pace, whatever a short
 *  wrecked run predicted. */
export const FIELD_CARROT = [0.94, 0.95, 0.97] as const;
export const FIELD_FAST_MIN = 0.85;
/** Its slowest rider: your slowest of the last FIELD_SLOW_RUNS, but at least and at most these shares
 *  of the field's pace. (Round 8: 1.13 from 1.1. The expert's quiet runs were its slow days, a ride 10% or more
 *  over its pace with nobody past 1.1; race-lab on the round 8 pools, expert quiet runs 58 of 600 to 27.) */
export const FIELD_SLOW_RUNS = 3;
export const FIELD_SLOW_MIN = 1.13;
export const FIELD_SLOW_MAX = 1.16;
/** Riders added to a field laid across your runs, and the most a field holds (Haunted Hollow's nine). */
export const FIELD_MORE = 2;
export const FIELD_MOST = 9;
/** Seconds every pick keeps from every other pick and from your best. */
export const FIELD_SPACING_S = 1;
/** Metres two riders who crashed keep between their wrecks. */
export const FIELD_SPACING = 25;
/** Candidates this close to a role's target (seconds) tie, and the seeded generator picks. */
export const FIELD_TIE_S = 1.5;

/**
 * A pool ghost's predicted finish time in seconds: its finish tick when the pool says, else its pace
 * carried to the line. (A pool that does not record finishTick reads a finisher's `ticks`, which
 * includes however long the generator kept the run going past the line.)
 */
export function poolTime(g: Pick<PoolGhostData, 'distance' | 'ticks' | 'finishTick'>, finishZ = FINISH_Z): number {
  if (typeof g.finishTick === 'number' && g.finishTick > 0) return g.finishTick / 60;
  return predictedTime(g.distance, g.ticks / 60, finishZ);
}

/** A save key's course length (round 9): its mountain's own, through the night and mirror prefixes; the five's for a
 *  Daily, a Cup and a Trial's key (which names a week, not a mountain). */
export function finishZOfKey(key: string): number {
  const id = key.replace(/^(?:night:)?(?:mirror:)?/, '');
  const m = MOUNTAINS.find((q) => q.id === id);
  return m ? finishZOf(m.seed) : FINISH_Z;
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function runs(xs: unknown): number[] {
  if (!Array.isArray(xs)) return [];
  const out: number[] = [];
  for (const x of xs) if (typeof x === 'number' && Number.isFinite(x) && x > 0) out.push(x);
  return out;
}

/** The time a field is built around for this mountain key: the median of its last 5 predicted finish
 *  times, or 1.1 times the last one when that is quicker (one good run lifts the next field right
 *  away); with none, 1.1 times the median of every other key's; else 0, and pickField reads a mid-pack
 *  time from the pool. Clamped to 100 to 420 s. */
export function anchorFor(runTimes: Readonly<Record<string, number[]>>, key: string): number {
  const own = runs(runTimes?.[key]).slice(-ANCHOR_RUNS);
  // (Round 9: another mountain's times are read at this one's length, and the bounds scale with it: the five are all
  // 4,500 m, so on them every ratio is 1.)
  const fz = finishZOfKey(key);
  let a = 0;
  if (own.length) a = Math.min(median(own), ANCHOR_LAST * own[own.length - 1]);
  else {
    const others: number[] = [];
    for (const k of Object.keys(runTimes ?? {})) {
      if (k === key) continue;
      const r = fz / finishZOfKey(k);
      for (const t of runs(runTimes[k]).slice(-ANCHOR_RUNS)) others.push(t * r);
    }
    if (others.length) a = ANCHOR_NEW * median(others);
  }
  const s = fz / FINISH_Z;
  return a > 0 ? Math.min(ANCHOR_MAX * s, Math.max(ANCHOR_MIN * s, a)) : 0;
}

/** Your last predicted finish times on a mountain key, oldest first (FieldInput.recent). */
export function recentFor(runTimes: Readonly<Record<string, number[]>>, key: string): number[] {
  return runs(runTimes?.[key]).slice(-ANCHOR_RUNS);
}

/** How many pool riders a run's field holds: five and the mood's extra, and FIELD_MORE once you have a run
 *  here for the field to be laid across (`recent`), FIELD_MOST at most. */
export function fieldCount(extra: number, recent: readonly number[]): number {
  const base = 5 + Math.max(0, extra);
  return runs(recent).length ? Math.max(base, Math.min(FIELD_MOST, base + FIELD_MORE)) : base;
}

/** The pace a field laid across your runs is read at: the anchor, or the median of your last three
 *  when that is quicker (a player who is improving run by run is not raced on last week's pace). */
export function fieldPace(anchor: number, recent: readonly number[], finishZ = FINISH_Z): number {
  const last = runs(recent).slice(-FIELD_SLOW_RUNS);
  if (!last.length) return anchor;
  // (Round 9: the bounds at the course's own length.)
  const s = finishZ / FINISH_Z;
  const m = Math.min(ANCHOR_MAX * s, Math.max(ANCHOR_MIN * s, median(last)));
  return anchor > 0 ? Math.min(anchor, m) : m;
}

/** The roles of a field laid across your recent runs (see the header): `count` riders evenly from the
 *  carrot to your slow day, slowest first. */
function spread(a: number, count: number, recent: readonly number[]): Role[] {
  if (count <= 0) return [];
  const quickest = Math.min(...recent);
  const slowest = Math.max(...recent.slice(-FIELD_SLOW_RUNS));
  const carrot = FIELD_CARROT[Math.min(recent.length, FIELD_CARROT.length) - 1];
  const fast = Math.min(0.97 * a, Math.max(carrot * quickest, FIELD_FAST_MIN * a));
  const slow = Math.min(FIELD_SLOW_MAX * a, Math.max(slowest, FIELD_SLOW_MIN * a));
  const step = count > 1 ? (slow - fast) / (count - 1) : 0;
  const half = Math.max(1, step / 2);
  const out: Role[] = [];
  for (let k = 0; k < count; k++) {
    const target = count > 1 ? slow - k * step : a;
    const role: GhostRole = target > 1.03 * a ? 'opener' : target < 0.97 * a ? 'pace' : 'pack';
    out.push({ role, target, lo: target - half, hi: target + half });
  }
  // A grudge or a promised rider takes the pack slot nearest its pace: there is always one.
  if (!out.some((r) => r.role === 'pack')) out.reduce((b, r) => (Math.abs(r.target - a) < Math.abs(b.target - a) ? r : b)).role = 'pack';
  return out;
}

interface Role {
  role: GhostRole;
  target: number;
  lo: number;
  hi: number;
}

/** The roles in priority order (a field shorter than 5 keeps the first ones). */
function roles(a: number, count: number, beginners: boolean): Role[] {
  // The pack rides close: at 30 m/s a pack 7% apart is 200 m apart by the finish, and nobody races that.
  const pack = (k: number): Role => ({ role: 'pack', target: k * a, lo: 0.96 * a, hi: 1.04 * a });
  const opener = (k: number): Role => ({ role: 'opener', target: k * a, lo: 1.03 * a, hi: 1.2 * a });
  const all: Role[] = [
    pack(1.02),
    // A shared first run has no pace to read, so someone rides at a beginner's.
    beginners ? { role: 'opener', target: 1.45 * a, lo: 1.25 * a, hi: 1.6 * a } : opener(1.07),
    { role: 'pace', target: 0.95 * a, lo: 0.9 * a, hi: 0.98 * a },
    pack(0.985),
    // The stretch rider, or the slowest beginner.
    beginners ? { role: 'opener', target: 1.9 * a, lo: 1.6 * a, hi: 2.1 * a } : { role: 'pace', target: 0.88 * a, lo: 0.8 * a, hi: 0.93 * a },
    // Haunted Hollow's four extra ghosts.
    opener(1.14),
    pack(0.97),
    pack(1.0),
    pack(1.04),
  ];
  // Any further ghosts join the pack around the anchor.
  const more = [1.0, 1.02, 0.97, 1.04, 0.95];
  for (let i = 0; all.length < count; i++) all.push(pack(more[i % more.length]));
  const out = all.slice(0, Math.max(0, count));
  // Filled from the start line down: openers, then the pack, then pace and stretch.
  const order: Record<GhostRole, number> = { opener: 0, pack: 1, pace: 2 };
  return out.sort((x, y) => order[x.role] - order[y.role] || y.target - x.target);
}

/** A very first run's roles round the steady time (FIRST_RUN_PACE): three quicker (the podium is earned), two slower
 *  (a beginner who rides beats one or two). Further ghosts join the slow end. */
function firstRoles(a: number, count: number): Role[] {
  const all: Role[] = [
    { role: 'opener', target: 1.1 * a, lo: 1.05 * a, hi: 1.16 * a },
    { role: 'pack', target: 0.96 * a, lo: 0.93 * a, hi: 0.98 * a },
    { role: 'pace', target: 0.93 * a, lo: 0.9 * a, hi: 0.95 * a },
    { role: 'opener', target: 1.19 * a, lo: 1.13 * a, hi: 1.3 * a },
    { role: 'pace', target: 0.87 * a, lo: 0.8 * a, hi: 0.9 * a },
  ];
  const more = [1.05, 1.24, 1.12, 1.3];
  for (let k = 0; all.length < count; k++) all.push({ role: 'opener', target: more[k % more.length] * a, lo: 1.02 * a, hi: 1.4 * a });
  const order: Record<GhostRole, number> = { opener: 0, pack: 1, pace: 2 };
  return all.slice(0, Math.max(0, count)).sort((x, y) => order[x.role] - order[y.role] || y.target - x.target);
}

/** The window after k widenings: 25% wider each time about its middle. */
function widen(r: Role, k: number): { lo: number; hi: number } {
  if (k === 0) return { lo: r.lo, hi: r.hi };
  const mid = (r.lo + r.hi) / 2;
  const half = ((r.hi - r.lo) / 2) * Math.pow(1.25, k);
  return { lo: mid - half, hi: mid + half };
}

/** mulberry32: a small seeded generator (tie-breaks only). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A record that still decodes on this game version (its distance and predicted time), or null for a
 *  stale one. */
function check(record: string | undefined | null): { distance: number; time: number } | null {
  if (!record) return null;
  try {
    const r = recordFromString(record);
    return { distance: r.distance, time: recordStanding(r).time ?? predictedTime(r.distance, r.ticks / 60, finishZOf(r.seed)) };
  } catch {
    return null;
  }
}

/** The candidate ladder (see the header): never a ghost of a different non-plain mood. */
export function fieldCandidates(pool: readonly PoolGhostData[], mood: Mood, event: ChaosEvent, want: number): PoolGhostData[] {
  const ok = pool.filter((g) => Number.isFinite(g.distance) && g.distance > 0 && !!g.record);
  const l1 = (g: PoolGhostData) => g.mood === mood && (g.event === ChaosEvent.None || g.event === event);
  const l2 = (g: PoolGhostData) => l1(g) || (g.mood === Mood.None && g.event === ChaosEvent.None);
  const l3 = (g: PoolGhostData) => l2(g) || g.mood === Mood.None || g.mood === mood;
  let c = ok.filter(l1);
  if (c.length < want) c = ok.filter(l2);
  if (c.length < want) c = ok.filter(l3);
  return c;
}

/** Where a rider sits for spacing: its time, and where it crashed (null for a finisher). */
interface Spot {
  time: number;
  wreck: number | null;
}

export function pickField(i: FieldInput): FieldPick[] {
  const count = Math.max(0, Math.floor(i.count));
  const kind: GhostKind = i.kind === 'daily' ? 'daily' : 'pool';
  const rand = rng(i.seed);

  // Your best, the grudge and the friend ride only on records this version still replays (a stale one
  // is dropped silently). The friend wins a record the grudge shares, so one line never carries two
  // ghosts that pay twice.
  const youRec = i.you ? check(i.you.record) : null;
  const you = i.you && youRec ? i.you : null;
  const friendRec = i.friend ? check(i.friend.record) : null;
  const friend = i.friend && friendRec ? i.friend : null;
  const grudgeRec = i.grudge ? check(i.grudge.record) : null;
  const grudge = i.grudge && grudgeRec && i.grudge.record !== friend?.record && i.grudge.record !== you?.record ? i.grudge : null;

  // The pool's candidates (your best and the friend never ride twice; the grudge may be picked here),
  // fastest first, each with its predicted time.
  // (Round 9: the course's own line; the five's when the input does not say.)
  const fz = i.finishZ ?? FINISH_Z;
  const times = new Map<PoolGhostData, number>();
  for (const g of i.pool) times.set(g, poolTime(g, fz));
  const timeOf = (g: PoolGhostData): number => times.get(g) ?? 0;
  const cands = fieldCandidates(i.pool, i.mood, i.event, count + 3)
    .filter((g) => !i.withheld?.includes(g.name) && g.record !== you?.record && g.record !== friend?.record && timeOf(g) > 0)
    .sort((x, y) => timeOf(x) - timeOf(y));
  const first = !(Number.isFinite(i.anchor) && i.anchor > 0);
  const recent = runs(i.recent);
  const paced = first && i.kind === 'pool' && i.key !== undefined ? FIRST_RUN_PACE[i.key] : undefined;
  const a = first ? (paced ?? ANCHOR_DEFAULT * (fz / FINISH_Z)) : recent.length ? fieldPace(i.anchor, recent, fz) : i.anchor;

  const wreckOf = (distance: number): number | null => (distance >= fz ? null : distance);
  const used = new Set<PoolGhostData>();
  const spots: Spot[] = [];
  if (you && youRec) spots.push({ time: youRec.time, wreck: wreckOf(you.distance) });
  const spaced = (g: PoolGhostData): boolean => {
    const t = timeOf(g);
    const w = wreckOf(g.distance);
    return spots.every((s) => Math.abs(s.time - t) >= FIELD_SPACING_S && (s.wreck === null || w === null || Math.abs(s.wreck - w) >= FIELD_SPACING));
  };

  const picks: Array<{ g: PoolGhostData; role: GhostRole; widened: boolean }> = [];
  for (const r of !first && recent.length ? spread(a, count, recent) : paced ? firstRoles(a, count) : roles(a, count, first && i.kind !== 'pool')) {
    const fits = (g: PoolGhostData) => !used.has(g) && spaced(g);
    let found: PoolGhostData | null = null;
    let widened = false;
    for (let k = 0; k <= 3 && !found; k++) {
      const w = widen(r, k);
      const all = cands.filter((g) => timeOf(g) >= w.lo && timeOf(g) <= w.hi && fits(g));
      if (!all.length) continue;
      // A signature rider in the window rides before the crowd (round 5): the race is people you come to
      // know. Only inside the role's own window, so the pace of the field is unchanged.
      const named = all.filter((g) => riderByName(g.name) !== null);
      const inside = named.length ? named : all;
      const ties = inside.filter((g) => Math.abs(timeOf(g) - r.target) <= FIELD_TIE_S);
      if (ties.length > 1) found = ties[Math.min(ties.length - 1, Math.floor(rand() * ties.length))];
      else found = inside.reduce((b, g) => (Math.abs(timeOf(g) - r.target) < Math.abs(timeOf(b) - r.target) ? g : b));
      widened = k > 0;
    }
    if (!found) {
      // Still nothing: the nearest unused candidate anywhere.
      let best = Infinity;
      for (const g of cands) {
        if (!fits(g)) continue;
        const d = Math.abs(timeOf(g) - r.target);
        if (d < best) {
          best = d;
          found = g;
        }
      }
      widened = true;
    }
    if (!found) continue; // the field rides short
    used.add(found);
    spots.push({ time: timeOf(found), wreck: wreckOf(found.distance) });
    picks.push({ g: found, role: r.role, widened });
  }

  const out: FieldPick[] = picks.map(({ g, role, widened }) => {
    const p: FieldPick = { name: g.name, kind, score: g.score, record: g.record, role, distance: g.distance, time: timeOf(g) };
    if (widened) p.widened = true;
    return p;
  });

  // Your best rides after the pool picks, then a grudge that joins the field, then the friend.
  let tail: FieldPick | null = null;
  if (grudge) {
    const nemesis = grudge.nemesis === true;
    const mine = out.find((p) => p.record === grudge.record);
    if (mine) {
      // Picked on its own merits: it rides as the grudge (rose, and it settles when passed).
      mine.kind = 'grudge';
      if (nemesis) mine.nemesis = true;
    } else {
      const g: FieldPick = { name: grudge.name, kind: 'grudge', score: grudge.score, record: grudge.record, distance: grudge.distance ?? grudgeRec!.distance, time: grudgeRec!.time };
      if (nemesis) g.nemesis = true;
      let at = -1;
      if (typeof grudge.distance === 'number' && Number.isFinite(grudge.distance)) {
        // It takes the pack slot nearest its own pace.
        let best = Infinity;
        out.forEach((p, k) => {
          if (p.role !== 'pack' || p.time === undefined) return;
          const gap = Math.abs(p.time - grudgeRec!.time);
          if (gap < best) {
            best = gap;
            at = k;
          }
        });
      }
      if (at >= 0) {
        g.role = 'pack';
        out[at] = g;
      } else tail = g;
    }
  }
  // The promised rider rides like a grudge: its own record, in the pack slot nearest its pace.
  const promisedRec = i.promised ? check(i.promised.record) : null;
  const promised = i.promised && promisedRec && i.promised.record !== you?.record ? i.promised : null;
  if (promised && !out.some((p) => p.record === promised.record)) {
    let at = -1;
    let best = Infinity;
    out.forEach((p, k) => {
      // (Never the grudge's slot: a duel of The Twelve promises its rider while a grudge rides too.)
      if (p.role !== 'pack' || p.time === undefined || p.kind === 'grudge') return;
      const gap = Math.abs(p.time - promisedRec!.time);
      if (gap < best) {
        best = gap;
        at = k;
      }
    });
    const g: FieldPick = { name: promised.name, kind, score: promised.score, record: promised.record, distance: promisedRec!.distance, time: promisedRec!.time, role: 'pack' };
    if (at >= 0) out[at] = g;
    else out.push(g);
  }
  if (you) out.push({ name: you.name, kind: 'you', score: you.score, record: you.record, distance: you.distance, time: youRec!.time });
  if (tail) out.push(tail);
  if (friend) out.push({ name: friend.name, kind: 'friend', score: friend.score, record: friend.record, distance: friendRec!.distance, time: friendRec!.time });
  const rival = rivalOf(out, a, promised?.record ?? null, fz);
  if (rival) rival.rival = true;
  // Only here: the Daily and the Cup share their field, and a named rider is a promise.
  if (first && i.kind === 'pool') for (const p of out) if (p.kind === 'pool' && p.role && p.record !== promised?.record) p.reads = true;
  return out;
}

/**
 * The run's rival: the rider the results promised by name, else the friend who challenged you, else
 * your grudge, else the field ghost right ahead of you: the one just quicker than your anchor. A
 * finisher goes first, so the rival is still there at the last line. With nobody quicker, the quickest
 * rider in the field. Never your own best: that has its own figure.
 */
export function rivalOf(field: FieldPick[], anchor: number, promised: string | null = null, finishZ = FINISH_Z): FieldPick | null {
  const named = promised ? field.find((f) => f.record === promised) : undefined;
  if (named) return named;
  const friend = field.find((p) => p.kind === 'friend');
  if (friend) return friend;
  const grudge = field.find((p) => p.kind === 'grudge');
  if (grudge) return grudge;
  const rows = field.filter((p) => p.kind !== 'you' && typeof p.time === 'number');
  const riders = rows.filter((p) => (p.distance ?? 0) >= finishZ);
  const from = riders.length > 0 ? riders : rows;
  let best: FieldPick | null = null;
  for (const p of from) if (p.time! < anchor && (!best || p.time! > best.time!)) best = p;
  if (best) return best;
  for (const p of from) if (!best || p.time! < best.time!) best = p;
  return best;
}
