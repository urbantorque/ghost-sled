import { ChaosEvent, Mood } from '../sim/chaos';
import { recordFromString } from '../sim/replay';
import type { GhostKind } from '../ui/contract';
import type { GhostRole } from './beats';
import type { PoolGhostData } from './ghostdata';

// The race field: which ghosts ride a run. It is built around where this player usually crashes
// (the anchor, anchorFor): an opener to pass early, a pack fighting right where you tend to fall, a
// pace rider who leaves the start with you and goes on ahead, and a stretch rider who keeps going
// long past it, so whether you crash at 300 m or ride on for kilometres, ghosts are still racing
// just ahead and just behind you. Your best, the grudge and a friend's challenge ride on top.
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
// Roles (A the anchor; a ghost's speed is its distance over its ride time): opener in [0.5, 0.75]A
// aiming at 0.62A; two pack ghosts in [0.8, 1.3]A aiming at 0.85 and 1.05A; pace, a long runner at
// P = max(1.7A, A + 250, 1,500 m) or more that averaged 23 m/s or more when there is one; and the
// stretch rider (role pace too) at max(2.2A, P + 25) or more, of any speed. Haunted Hollow's four
// extra ghosts add an opener at 0.55A and pack at 0.95, 1.15 and 1.25A. Within a window the pick
// nearest its target wins (pace looks among its fast riders first); candidates within 30 m of the
// target tie, and a generator seeded with the run's chaos seed picks among them. An empty window
// widens by 25% up to three times (flagged widened), then the nearest unused candidate is taken.
// Capped 18,000-tick finishers ride only as pace or stretch. Every pick sits 25 m or more from every
// other pick and from the spot where your best crashed (twin wrecks like Pinecrest's 604.4 and
// 604.4 m never ride together).
//
// Why pace and stretch are long runners whatever the anchor (measured on fresh saves with the
// novice pilot): every pool ghost covers about the same 140 m in its first 10 s, so the field rides
// bunched and a novice slings past all of it within about 6 s; and the bots that crash before 1 km
// also ride slower than a novice afterwards, so a field picked by distance alone was behind you or
// wrecked by 40 s, and a durable run rode on alone for minutes. A fast pace rider (23 m/s is about a
// mid player's long-run average; a novice averages 19 to 20) comes back past you in the first 30 s
// and leads; the stretch rider, usually near a novice's speed, is still close a minute or two in.
//
// Pure: no DOM, render or audio imports.

export interface FieldInput {
  pool: readonly PoolGhostData[];
  kind: 'pool' | 'daily';
  mood: Mood;
  event: ChaosEvent;
  /** Pool ghosts to pick: 5 plus the mood's extra ghosts. */
  count: number;
  /** Where this player usually crashes, in metres (anchorFor). */
  anchor: number;
  /** chaos.seed, for reproducible tie-breaks. */
  seed: number;
  /** Your best score on this mountain key (0 for none). Kept for the app's call; the field is built by distance. */
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
  /** Its role window was widened to find it. */
  widened?: boolean;
  nemesis?: boolean;
}

/** The anchor with no runs anywhere yet, and its bounds (metres). A brand-new player's runs swing
 *  widely: 33 fresh novice runs on Pinecrest ended between 215 m and 2.7 km, about a third past
 *  750 m. At 700 m the pack rides the first 35 to 45 s, through most of those crashes, and pace and
 *  stretch carry the long ones. */
export const ANCHOR_DEFAULT = 700;
export const ANCHOR_MIN = 200;
export const ANCHOR_MAX = 5000;
/** Run-end distances the anchor reads per key (the most recent). */
export const ANCHOR_RUNS = 5;
/** One long run lifts the next anchor to this share of it at least (anchorFor). */
export const ANCHOR_LAST = 0.7;
/** Metres every pick keeps from every other pick and from your best's crash spot. */
export const FIELD_SPACING = 25;
/** Candidates this close to a role's target tie, and the seeded generator picks. */
export const FIELD_TIE = 30;
/** A pool ghost that rode this long finished (the generator's cap): pace or stretch only. */
export const FINISH_TICKS = 18000;
/** The pace rider is a long runner: its window starts here at the least (metres). */
export const PACE_MIN = 1500;
/** The pace rider looks first among ghosts that averaged this speed or more (m/s). */
export const PACE_SPEED = 23;

/** A pool ghost's average speed over its whole ride, in m/s. */
export function poolSpeed(g: Pick<PoolGhostData, 'distance' | 'ticks'>): number {
  return g.ticks > 0 ? g.distance / (g.ticks / 60) : 0;
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

/** The distance a field is built around for this mountain key: the median of its last 5 run-end
 *  distances, or 0.7 times the last one when that is more (one long run lifts the next field right
 *  away); with none, 0.8 times the median of every other key's; else 700 m. Clamped to 200 to
 *  5,000 m. */
export function anchorFor(runDists: Readonly<Record<string, number[]>>, key: string): number {
  const own = runs(runDists?.[key]).slice(-ANCHOR_RUNS);
  let a = ANCHOR_DEFAULT;
  if (own.length) a = Math.max(median(own), ANCHOR_LAST * own[own.length - 1]);
  else {
    const others: number[] = [];
    for (const k of Object.keys(runDists ?? {})) if (k !== key) others.push(...runs(runDists[k]).slice(-ANCHOR_RUNS));
    if (others.length) a = 0.8 * median(others);
  }
  return Math.min(ANCHOR_MAX, Math.max(ANCHOR_MIN, a));
}

interface Role {
  role: GhostRole;
  target: number;
  lo: number;
  hi: number;
  /** Look first among candidates at this average speed or more (pace). */
  fast?: number;
}

/** The roles in priority order (a field shorter than 5 keeps the first ones). */
function roles(a: number, count: number): Role[] {
  const pace = Math.max(1.7 * a, a + 250, PACE_MIN);
  const stretch = Math.max(2.2 * a, pace + FIELD_SPACING);
  const pack = (k: number): Role => ({ role: 'pack', target: k * a, lo: 0.8 * a, hi: 1.3 * a });
  const opener = (k: number): Role => ({ role: 'opener', target: k * a, lo: 0.5 * a, hi: 0.75 * a });
  const all: Role[] = [
    pack(1.05),
    opener(0.62),
    { role: 'pace', target: pace, lo: pace, hi: Infinity, fast: PACE_SPEED },
    pack(0.85),
    // The stretch rider.
    { role: 'pace', target: stretch, lo: stretch, hi: Infinity },
    // Haunted Hollow's four extra ghosts.
    opener(0.55),
    pack(0.95),
    pack(1.15),
    pack(1.25),
  ];
  // Any further ghosts join the pack around the anchor.
  const more = [1.0, 0.9, 1.1, 1.2, 0.8];
  for (let i = 0; all.length < count; i++) all.push(pack(more[i % more.length]));
  const out = all.slice(0, Math.max(0, count));
  // Filled from the start line down: openers, then the pack, then pace and stretch.
  const order: Record<GhostRole, number> = { opener: 0, pack: 1, pace: 2 };
  return out.sort((x, y) => order[x.role] - order[y.role] || x.target - y.target);
}

/** The window after k widenings: 25% wider each time about its middle; a pace window opens downward
 *  toward the pack's top edge. */
function widen(r: Role, k: number, a: number): { lo: number; hi: number } {
  if (k === 0) return { lo: r.lo, hi: r.hi };
  if (r.hi === Infinity) {
    const floor = Math.min(r.lo, 1.3 * a);
    return { lo: r.lo - Math.min(1, 0.25 * k) * (r.lo - floor), hi: Infinity };
  }
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

/** A record that still decodes on this game version (its distance), or null for a stale one. */
function check(record: string | undefined | null): { distance: number } | null {
  if (!record) return null;
  try {
    const r = recordFromString(record);
    return { distance: r.distance };
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

export function pickField(i: FieldInput): FieldPick[] {
  const a = Number.isFinite(i.anchor) && i.anchor > 0 ? i.anchor : ANCHOR_DEFAULT;
  const count = Math.max(0, Math.floor(i.count));
  const kind: GhostKind = i.kind === 'daily' ? 'daily' : 'pool';
  const rand = rng(i.seed);

  // Your best, the grudge and the friend ride only on records this version still replays (a stale one
  // is dropped silently). The friend wins a record the grudge shares, so one line never carries two
  // ghosts that pay twice.
  const you = i.you && check(i.you.record) ? i.you : null;
  const friendRec = i.friend ? check(i.friend.record) : null;
  const friend = i.friend && friendRec ? i.friend : null;
  const grudgeRec = i.grudge ? check(i.grudge.record) : null;
  const grudge = i.grudge && grudgeRec && i.grudge.record !== friend?.record && i.grudge.record !== you?.record ? i.grudge : null;

  // The pool's candidates (your best and the friend never ride twice; the grudge may be picked here).
  const cands = fieldCandidates(i.pool, i.mood, i.event, count + 3)
    .filter((g) => g.record !== you?.record && g.record !== friend?.record)
    .sort((x, y) => x.distance - y.distance);
  const used = new Set<PoolGhostData>();
  const spots: number[] = [];
  if (you) spots.push(you.distance);
  const spaced = (d: number) => spots.every((s) => Math.abs(s - d) >= FIELD_SPACING);

  const picks: Array<{ g: PoolGhostData; role: GhostRole; widened: boolean }> = [];
  for (const r of roles(a, count)) {
    const fits = (g: PoolGhostData) => !used.has(g) && (r.role === 'pace' || g.ticks < FINISH_TICKS) && spaced(g.distance);
    let found: PoolGhostData | null = null;
    let widened = false;
    for (let k = 0; k <= 3 && !found; k++) {
      const w = widen(r, k, a);
      let inside = cands.filter((g) => g.distance >= w.lo && g.distance <= w.hi && fits(g));
      if (!inside.length) continue;
      // Pace looks among its fast riders first, then takes whoever the window holds.
      if (r.fast) {
        const quick = inside.filter((g) => poolSpeed(g) >= r.fast!);
        if (quick.length) inside = quick;
      }
      const ties = inside.filter((g) => Math.abs(g.distance - r.target) <= FIELD_TIE);
      if (ties.length > 1) found = ties[Math.min(ties.length - 1, Math.floor(rand() * ties.length))];
      else found = inside.reduce((b, g) => (Math.abs(g.distance - r.target) < Math.abs(b.distance - r.target) ? g : b));
      widened = k > 0;
    }
    if (!found) {
      // Still nothing: the nearest unused candidate anywhere.
      let best = Infinity;
      for (const g of cands) {
        if (!fits(g)) continue;
        const d = Math.abs(g.distance - r.target);
        if (d < best) {
          best = d;
          found = g;
        }
      }
      widened = true;
    }
    if (!found) continue; // the field rides short
    used.add(found);
    spots.push(found.distance);
    picks.push({ g: found, role: r.role, widened });
  }

  const out: FieldPick[] = picks.map(({ g, role, widened }) => {
    const p: FieldPick = { name: g.name, kind, score: g.score, record: g.record, role, distance: g.distance };
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
      const g: FieldPick = { name: grudge.name, kind: 'grudge', score: grudge.score, record: grudge.record, distance: grudge.distance ?? grudgeRec!.distance };
      if (nemesis) g.nemesis = true;
      const d = grudge.distance;
      let at = -1;
      if (typeof d === 'number' && Number.isFinite(d)) {
        // It takes the pack slot nearest where it crashed.
        let best = Infinity;
        out.forEach((p, k) => {
          if (p.role !== 'pack' || p.distance === undefined) return;
          const gap = Math.abs(p.distance - d);
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
  if (you) out.push({ name: you.name, kind: 'you', score: you.score, record: you.record, distance: you.distance });
  if (tail) out.push(tail);
  if (friend) out.push({ name: friend.name, kind: 'friend', score: friend.score, record: friend.record, distance: friendRec!.distance });
  return out;
}
