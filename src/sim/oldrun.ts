// The Old Run (round 9, notes/r9-ground.md section 5): an old ice track down a forest, ridden on its banked walls.
// Its descent is laid here, through course.ts's kit seam (kit.ts), never by the five's acts. As round 9's groundwork
// left it, a lab course (mountains.ts OLDRUN_LAB_SEED, not in MOUNTAINS): the wall's physics and the line its riders
// take, for the Old Run's own lane to build its mountain on.
//
// The channel: a 5.2 m floor and curved walls to a lip 7.5 m from the middle, measured square to the channel, which
// bends left and right down a steady 0.17 (|dx/dz| at most 0.7, radius 40 m and more). On a straight both walls stand
// 2.6 m; through a bend the outside wall rises (to 7.5 m at radius 70 or tighter) on its own smooth profile over 70 m
// either side, so no line up a wall ever crests. A sled settles on a bend's outside wall where the wall's yaw turns it
// as fast as the channel turns (sim.ts wallYaw): tan(theta) = v^2 / (g R), so the slush rider sits low in the floor and
// the glaze rider high. The surfaces: fast track ice on the straights and walls, the glaze high on a bend's outside
// wall, slush in a bend's floor. Nothing stands in the track and nothing in it can floor a rider: its lip only scrapes.
//
// Pure: no DOM, render or audio imports. Values only from chaos.ts and dmath.ts; course.ts and kit.ts for types.

import { ChaosEvent } from './chaos';
import { smoothstep } from './dmath';
import type { Chunk, Course, Layout, Section, SectionKind, Surface } from './course';
import type { Kit, KitBeat, KitPlan, KitRider } from './kit';
import type { Rng } from './prng';

/** Its descent: three stages of 950, 1,000 and 1,050 m; no ramp, kicker or leap in its first minute; the outrun to the
 *  timing house (120 m before the line, 200 past it); thresholds on the track's straights, as wide as the channel;
 *  the light storm and the spirit train, never an avalanche (it would catch a rider in the slush) or a yeti (no room
 *  to cross a 15 m channel). */
export const OLDRUN_LAYOUT: Layout = {
  stages: [950, 1000, 1050],
  grammar: 'oldrun',
  square: 120,
  runOut: 200,
  finish: 'outrun',
  threshold: 'track',
  thresholdHW: 7.2,
  firstKick: null,
  kickFrom: 800,
  picketsFrom: 900,
  lightRun: null,
  events: (1 << ChaosEvent.GiftStorm) | (1 << ChaosEvent.GhostTrain),
};

/** The channel, square to its line: the floor's half-width, the wall's width and the lip. */
export const FLOOR = 2.6;
export const WALL = 4.9;
export const LIP = FLOOR + WALL;
/** A straight's walls, and a bend's outside wall at its deepest (radius TIGHT or less) and at its gentlest. */
export const WALL_LOW = 2.6;
export const WALL_DEEP = 7.5;
const WALL_GENTLE = 5;
const TIGHT = 70;
const GENTLE = 130;
/** How far before and after a bend its outside wall takes to rise and fall (a smootherstep: |H''| <= 0.0069 for the
 *  whole 4.9 m, under the curvature that lifts a sled at 46 m/s anywhere up the wall). */
export const WALL_RAMP = 70;
/** The glaze: the band of a bend's outside wall it lies on (shares of the wall's width up), on a wall this high. */
export const GLAZE_LO = 0.5;
export const GLAZE_HI = 0.85;
const GLAZE_WALL = 4;
/** A bend whose curvature is this share of the deepest's (1/60) or more has slush in its floor. */
const SLUSH_BEND = 1 / 3;
const DEEP = 1 / 60;
/** The steepest the line runs off the fall line (the five's own: 35 degrees). */
export const MAX_SLOPE = 0.7;

/** The track's surfaces (round 9). Only the glaze is ice, so the ice charms bite only on the line that earns them. */
export const TRACK_ICE: Surface = { grip: 0.8, drag: 0.55, ice: false };
export const GLAZE: Surface = { grip: 0.85, drag: 0.4, ice: true };
export const SLUSH: Surface = { grip: 1, drag: 1.6, ice: false };

/** One turn of the line: its slope dx/dz changes by `dp` over `len` metres from z0, on a smoothstep, so the line's
 *  curvature is at most 1.5 dp / len (= 1 / R, the radius it was laid for). Its outside wall is `side` (the side the
 *  channel turns away from) and rises to `h`. */
export interface Turn {
  z0: number;
  len: number;
  dp: number;
  r: number;
  side: 1 | -1;
  h: number;
}

/** What the kit laid on a course: its turns, in order. */
interface Laid {
  turns: Turn[];
}

const LAID = new WeakMap<Course, Laid>();

function laid(c: Course): Laid {
  let d = LAID.get(c);
  if (!d) {
    c.section(0);
    d = LAID.get(c);
    if (!d) throw new Error('the Old Run was not laid');
  }
  return d;
}

/** A turn's wall height for its radius: the deepest at TIGHT or tighter, easing to WALL_GENTLE at GENTLE. */
function wallFor(r: number): number {
  const t = (r - TIGHT) / (GENTLE - TIGHT);
  return t <= 0 ? WALL_DEEP : t >= 1 ? WALL_GENTLE : WALL_DEEP + (WALL_GENTLE - WALL_DEEP) * t;
}

/** A turn of `dp` laid for radius `r` from z0. */
function turn(z0: number, dp: number, r: number): Turn {
  return { z0, len: 1.5 * Math.abs(dp) * r, dp, r, side: dp > 0 ? -1 : 1, h: wallFor(r) };
}

/** An S-bend from z0: a, then -2a, then a again (back to the slope it started on), each turn laid for radius r, with
 *  `hold` metres between them. */
function sBend(z0: number, a: number, r: number, hold: number): Turn[] {
  const t1 = turn(z0, a, r);
  const t2 = turn(t1.z0 + t1.len + hold, -2 * a, r);
  const t3 = turn(t2.z0 + t2.len + hold, a, r);
  return [t1, t2, t3];
}

const endOf = (ts: readonly Turn[]): number => ts[ts.length - 1].z0 + ts[ts.length - 1].len;

/** S-bends drawn for one act and spread from z0 to z1 with even straights between (and before and after): when the
 *  draw is too long for the room, its holds and radii shrink together, never under radius 40. */
function act(z0: number, z1: number, n: number, rng: Rng, a: readonly [number, number], r: readonly [number, number], hold: readonly [number, number]): Turn[] {
  const specs = Array.from({ length: n }, () => ({ a: rng.range(a[0], a[1]) * (rng.chance(0.5) ? 1 : -1), r: rng.range(r[0], r[1]), hold: rng.range(hold[0], hold[1]) }));
  const length = (k: number): number => specs.reduce((s, q) => s + 6 * Math.abs(q.a) * Math.max(40, q.r * k) + 2 * q.hold * k, 0);
  let k = 1;
  const room = z1 - z0 - 30 * (n + 1);
  while (length(k) > room && k > 0.3) k -= 0.02;
  const gap = (z1 - z0 - length(k)) / (n + 1);
  const out: Turn[] = [];
  let z = z0 + gap;
  for (const q of specs) {
    const s = sBend(z, q.a, Math.max(40, q.r * k), q.hold * k);
    out.push(...s);
    z = endOf(s) + gap;
  }
  return out;
}

/** The smootherstep a turn's wall rises and falls on. */
function smoother(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/** The line and the walls at one z. */
interface At {
  z: number;
  /** The centre line, its slope dx/dz and its curvature d2x/dz2. */
  cx: number;
  p: number;
  pp: number;
  /** The walls' heights, left (-x) and right (+x). */
  hl: number;
  hr: number;
}

/** The last two z each course was asked for (the ground is asked a row of x at one z at a time). */
const MEMO = new WeakMap<Course, [At, At]>();
let memoFlip = 0;

function at(c: Course, z: number): At {
  let m = MEMO.get(c);
  if (!m) {
    m = [
      { z: NaN, cx: 0, p: 0, pp: 0, hl: 0, hr: 0 },
      { z: NaN, cx: 0, p: 0, pp: 0, hl: 0, hr: 0 },
    ];
    MEMO.set(c, m);
  }
  if (m[0].z === z) return m[0];
  if (m[1].z === z) return m[1];
  const o = m[memoFlip];
  memoFlip ^= 1;
  let cx = 0;
  let p = 0;
  let pp = 0;
  let hl = 0;
  let hr = 0;
  for (const t of laid(c).turns) {
    const u = (z - t.z0) / t.len;
    if (u > 0) {
      if (u < 1) {
        // smoothstep's integral (u^3 - u^4/2) for x, itself for the slope, its derivative for the curvature.
        cx += t.dp * t.len * (u * u * u - 0.5 * u * u * u * u);
        p += t.dp * u * u * (3 - 2 * u);
        pp += (t.dp * 6 * u * (1 - u)) / t.len;
      } else {
        cx += t.dp * t.len * (u - 0.5);
        p += t.dp;
      }
    }
    // Its outside wall: up over WALL_RAMP before it, held through it, down over WALL_RAMP after.
    const end = t.z0 + t.len;
    const k = z < t.z0 ? smoother((z - (t.z0 - WALL_RAMP)) / WALL_RAMP) : z <= end ? 1 : 1 - smoother((z - end) / WALL_RAMP);
    if (k > 0) {
      const lift = (t.h - WALL_LOW) * k;
      if (t.side < 0) hl = lift > hl ? lift : hl;
      else hr = lift > hr ? lift : hr;
    }
  }
  o.z = z;
  o.cx = cx;
  o.p = p;
  o.pp = pp;
  o.hl = WALL_LOW + hl;
  o.hr = WALL_LOW + hr;
  return o;
}

/** Where (x, z) is across the channel: the distance square to it from the middle, the side, that side's wall. */
function across(c: Course, x: number, z: number): { d: number; side: 1 | -1; h: number; a: At; q: number } {
  const a = at(c, z);
  const q = Math.sqrt(1 + a.p * a.p);
  const dx = x - a.cx;
  const side: 1 | -1 = dx >= 0 ? 1 : -1;
  return { d: (dx >= 0 ? dx : -dx) / q, side, h: side > 0 ? a.hr : a.hl, a, q };
}

/** The outside of the bend at z (the side the channel turns away from), and how deep the bend is (1 at radius 60). */
function bendAt(a: At): { side: 1 | -1; deep: number } {
  return { side: a.pp > 0 ? -1 : 1, deep: (a.pp >= 0 ? a.pp : -a.pp) / DEEP };
}

const G = 9.81;

/** The share up the outside wall a sled at v settles at in the bend at z (0 on a straight). */
function settles(c: Course, z: number, v: number): { u: number; side: 1 | -1; a: At } {
  const a = at(c, z);
  const q = Math.sqrt(1 + a.p * a.p);
  const k = (a.pp >= 0 ? a.pp : -a.pp) / (q * q * q);
  const { side } = bendAt(a);
  if (k < 1e-4) return { u: 0, side, a };
  const h = side > 0 ? a.hr : a.hl;
  const tan = (v * v * k) / G;
  const u = (tan * WALL) / (2 * h);
  return { u: u > GLAZE_HI ? GLAZE_HI : u, side, a };
}

/** A share up the wall as metres across the channel from the middle (the floor's edge comes in gently, so the line
 *  leaves the middle smoothly). */
function across0(u: number): number {
  return FLOOR * smoothstep(0, 0.15, u) + u * WALL;
}

export const OLDRUN_KIT: Kit = {
  id: 'oldrun',
  layout: OLDRUN_LAYOUT,

  compose(c: Course, rng: Rng, blendOf: (k: SectionKind, prev: SectionKind | null) => number): KitBeat[] {
    // Stage lines at 950 and 1,950; each one's threshold a straight from 40 m above it to 160 m below; the finish
    // line at 3,000 inside the outrun's 120 m.
    const s0 = OLDRUN_LAYOUT.stages[0];
    const s1 = s0 + OLDRUN_LAYOUT.stages[1];
    const fin = s1 + OLDRUN_LAYOUT.stages[2];
    const gate = (line: number): [number, number] => [line - 40, line + 160];
    const [g0a, g0b] = gate(s0);
    const [g1a, g1b] = gate(s1);
    const out0 = fin - OLDRUN_LAYOUT.square;
    // The Hotel Straights: the start house's 160 m straight, then two long S-bends.
    const hotel = act(170, g0a - 20, 2, rng, [0.3, 0.45], [85, 130], [40, 80]);
    // The Labyrinth: three short S-bends close together.
    const labyrinth = act(g0b + 20, g1a - 20, 3, rng, [0.4, 0.55], [42, 58], [8, 25]);
    // The Horseshoe: an S-bend, then one long hook (35 degrees off the fall line, held, and back), the deepest bank,
    // into the outrun.
    const lead = act(g1b + 20, g1b + 330, 1, rng, [0.3, 0.42], [70, 100], [20, 40]);
    const hookSide = rng.chance(0.5) ? 1 : -1;
    const hold = rng.range(140, 160);
    const backAt = out0 - 30 - turn(0, MAX_SLOPE, 60).len;
    const hookIn = turn(backAt - hold - turn(0, MAX_SLOPE, 60).len, hookSide * MAX_SLOPE, 60);
    const hookOut = turn(backAt, -hookSide * MAX_SLOPE, 60);
    LAID.set(c, { turns: [...hotel, ...labyrinth, ...lead, hookIn, hookOut] });
    const beats: KitBeat[] = [];
    let prev: SectionKind | null = null;
    const push = (kind: SectionKind, len: number, gateOn = false): void => {
      beats.push({ kind, len, blend: blendOf(kind, prev), ...(gateOn ? { gate: true as const } : {}) });
      prev = kind;
    };
    push('track', g0a);
    push('track', g0b - g0a, true);
    push('labyrinth', g1a - g0b);
    push('track', g1b - g1a, true);
    push('track', out0 - g1b);
    push('outrun', OLDRUN_LAYOUT.square + OLDRUN_LAYOUT.runOut);
    return beats;
  },

  lay(c: Course, sec: Section, rng: Rng, plan: KitPlan): void {
    void c;
    void rng;
    // Nothing launches in the track; the thresholds and the outrun are clear across (as layBands does for the five's
    // 'cruise' gate and 'finish').
    if (sec.gate || sec.kind === 'outrun') plan.clear.push({ z0: sec.z0, z1: sec.kind === 'outrun' ? 1e9 : sec.z1 });
    plan.busy.push({ z0: sec.z0, z1: sec.kind === 'outrun' ? 1e9 : sec.z1 });
  },

  centre(c: Course, z: number): number {
    return at(c, z).cx;
  },

  slope(c: Course, z: number): number {
    return at(c, z).p;
  },

  halfWidth(c: Course, z: number): number {
    const p = at(c, z).p;
    return LIP * Math.sqrt(1 + p * p);
  },

  ground(c: Course, x: number, z: number, base: number): number {
    const { d, h } = across(c, x, z);
    if (d <= FLOOR) return base;
    // The wall, and past the lip the parapet: the wall's own curve carried on up, so the lip is never a crest and the
    // ground stays smooth enough there for the sim's gradient (a steeper parapet, curving six times as hard, read as
    // the ground falling away under a sled that reached it).
    const u = (d - FLOOR) / WALL;
    return base + h * u * u;
  },

  surface(c: Course, x: number, z: number): Surface | null {
    const { d, side, h, a } = across(c, x, z);
    const bend = bendAt(a);
    if (d <= FLOOR) return bend.deep >= SLUSH_BEND ? SLUSH : TRACK_ICE;
    if (d <= LIP && side === bend.side && h >= GLAZE_WALL) {
      const u = (d - FLOOR) / WALL;
      if (u >= GLAZE_LO && u <= GLAZE_HI) return GLAZE;
    }
    return TRACK_ICE;
  },

  raceX(c: Course, z: number, v: number): number {
    const { u, side, a } = settles(c, z, v);
    return a.cx + side * across0(u) * Math.sqrt(1 + a.p * a.p);
  },

  lineFor(c: Course, z: number, r: KitRider): number {
    // A careful or new rider lets the walls turn it (its own settling height); a skilled one rides up into the glaze.
    const reach = r.skill <= 0.3 ? 0 : r.skill >= 0.8 ? 1 : (r.skill - 0.3) / 0.5;
    const { u, side, a } = settles(c, z, r.v);
    const want = u > 0.02 ? u + reach * (u < 0.62 ? 0.62 - u : 0) : 0;
    return a.cx + side * across0(want > GLAZE_HI ? GLAZE_HI : want) * Math.sqrt(1 + a.p * a.p);
  },

  lights(c: Course, chunk: Chunk, rng: Rng, diff: number, push: (x: number, z: number, hover: number, value: number) => void): void {
    void rng;
    void diff;
    // Up the glaze through every bend of radius 100 or tighter: six sparks along its middle, the middle one great. What
    // a rider takes there it takes by riding the line the bend pays for.
    for (const t of laid(c).turns) {
      if (t.r > 100 || t.h < GLAZE_WALL) continue;
      for (let k = 0; k < 6; k++) {
        const z = t.z0 + (t.len * (k + 0.5)) / 6;
        if (z < chunk.z0 || z >= chunk.z1) continue;
        const a = at(c, z);
        push(a.cx + t.side * across0(0.67) * Math.sqrt(1 + a.p * a.p), z, 0.8, k === 2 ? 3 : 1);
      }
    }
  },
};
