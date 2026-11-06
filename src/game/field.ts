import { ChaosEvent, Mood } from '../sim/chaos';
import { recordFromString } from '../sim/replay';
import type { GhostKind } from '../ui/contract';
import type { GhostRole } from './beats';
import type { PoolGhostData } from './ghostdata';
import { FINISH_Z, predictedTime, recordStanding } from './standing';

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
  /** chaos.seed, for reproducible tie-breaks. */
  seed: number;
  /** Your best score on this mountain key (0 for none). Kept for the app's call; the field is built by time. */
  bestScore: number;
  you: { name: string; score: number; distance: number; record: string } | null;
  grudge: { name: string; score: number; record: string; distance?: number; nemesis?: boolean } | null;
  friend: { name: string; score: number; record: string } | null;
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
}

/** The anchor's bounds (seconds). */
export const ANCHOR_MIN = 100;
export const ANCHOR_MAX = 420;
/** Used only with no runs and an empty pool to read a mid-pack time from. */
export const ANCHOR_DEFAULT = 200;
/** Predicted times the anchor reads per key (the most recent). */
export const ANCHOR_RUNS = 5;
/** One quick run pulls the next anchor to this multiple of it at most (anchorFor). */
export const ANCHOR_LAST = 1.1;
/** A mountain you have not ridden: your other mountains' median, this much slower. */
export const ANCHOR_NEW = 1.1;
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
export function poolTime(g: Pick<PoolGhostData, 'distance' | 'ticks' | 'finishTick'>): number {
  if (typeof g.finishTick === 'number' && g.finishTick > 0) return g.finishTick / 60;
  return predictedTime(g.distance, g.ticks / 60);
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
  let a = 0;
  if (own.length) a = Math.min(median(own), ANCHOR_LAST * own[own.length - 1]);
  else {
    const others: number[] = [];
    for (const k of Object.keys(runTimes ?? {})) if (k !== key) others.push(...runs(runTimes[k]).slice(-ANCHOR_RUNS));
    if (others.length) a = ANCHOR_NEW * median(others);
  }
  return a > 0 ? Math.min(ANCHOR_MAX, Math.max(ANCHOR_MIN, a)) : 0;
}

interface Role {
  role: GhostRole;
  target: number;
  lo: number;
  hi: number;
}

/** The roles in priority order (a field shorter than 5 keeps the first ones). */
function roles(a: number, count: number): Role[] {
  const pack = (k: number): Role => ({ role: 'pack', target: k * a, lo: 0.93 * a, hi: 1.07 * a });
  const opener = (k: number): Role => ({ role: 'opener', target: k * a, lo: 1.05 * a, hi: 1.22 * a });
  const all: Role[] = [
    pack(1.03),
    opener(1.1),
    { role: 'pace', target: 0.93 * a, lo: 0.88 * a, hi: 0.97 * a },
    pack(0.98),
    // The stretch rider.
    { role: 'pace', target: 0.85 * a, lo: 0.75 * a, hi: 0.9 * a },
    // Haunted Hollow's four extra ghosts.
    opener(1.16),
    pack(0.96),
    pack(1.0),
    pack(1.05),
  ];
  // Any further ghosts join the pack around the anchor.
  const more = [1.0, 1.02, 0.97, 1.04, 0.95];
  for (let i = 0; all.length < count; i++) all.push(pack(more[i % more.length]));
  const out = all.slice(0, Math.max(0, count));
  // Filled from the start line down: openers, then the pack, then pace and stretch.
  const order: Record<GhostRole, number> = { opener: 0, pack: 1, pace: 2 };
  return out.sort((x, y) => order[x.role] - order[y.role] || y.target - x.target);
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
    return { distance: r.distance, time: recordStanding(r).time ?? predictedTime(r.distance, r.ticks / 60) };
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
  const times = new Map<PoolGhostData, number>();
  for (const g of i.pool) times.set(g, poolTime(g));
  const timeOf = (g: PoolGhostData): number => times.get(g) ?? 0;
  const cands = fieldCandidates(i.pool, i.mood, i.event, count + 3)
    .filter((g) => g.record !== you?.record && g.record !== friend?.record && timeOf(g) > 0)
    .sort((x, y) => timeOf(x) - timeOf(y));
  // With no runs to go on, the pack rides at a mid-pack time.
  const a = Number.isFinite(i.anchor) && i.anchor > 0 ? i.anchor : cands.length ? median(cands.map(timeOf)) : ANCHOR_DEFAULT;

  const wreckOf = (distance: number): number | null => (distance >= FINISH_Z ? null : distance);
  const used = new Set<PoolGhostData>();
  const spots: Spot[] = [];
  if (you && youRec) spots.push({ time: youRec.time, wreck: wreckOf(you.distance) });
  const spaced = (g: PoolGhostData): boolean => {
    const t = timeOf(g);
    const w = wreckOf(g.distance);
    return spots.every((s) => Math.abs(s.time - t) >= FIELD_SPACING_S && (s.wreck === null || w === null || Math.abs(s.wreck - w) >= FIELD_SPACING));
  };

  const picks: Array<{ g: PoolGhostData; role: GhostRole; widened: boolean }> = [];
  for (const r of roles(a, count)) {
    const fits = (g: PoolGhostData) => !used.has(g) && spaced(g);
    let found: PoolGhostData | null = null;
    let widened = false;
    for (let k = 0; k <= 3 && !found; k++) {
      const w = widen(r, k);
      const inside = cands.filter((g) => timeOf(g) >= w.lo && timeOf(g) <= w.hi && fits(g));
      if (!inside.length) continue;
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
  if (you) out.push({ name: you.name, kind: 'you', score: you.score, record: you.record, distance: you.distance, time: youRec!.time });
  if (tail) out.push(tail);
  if (friend) out.push({ name: friend.name, kind: 'friend', score: friend.score, record: friend.record, distance: friendRec!.distance, time: friendRec!.time });
  return out;
}
