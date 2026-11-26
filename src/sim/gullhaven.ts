// Gullhaven (round 9, notes/r9-ground.md section 6, notes/r9-gullhaven.md): a run down the seaward flank of a cape, from
// the old beacon on its head along the clifftop shelves to the harbour at its foot, the sea always on the right (+x).
// Its descent is laid here, through course.ts's kit seam (kit.ts), never by the five's acts.
//
// The path runs along the clifftop shelf, a fence between it and the cliff's fall to the sea, the moor rising on its
// left. Where a gully (a geo) cuts the cliff the path swings inland round its head and drops down through it, while the
// shelf seaward of it runs straight on, held level, to the gully's lip: a corniced edge over the gully's mouth. The sea
// wind climbs the gully: over its mouth a column of rising air (lift) holds a sled in flight. So a rider who leaves the
// path at the head and holds the straight line pops off the lip and is carried over the mouth for three to five seconds,
// comes down on the gully's face or the far shelf and stomps it; a rider who keeps to the path goes round the head,
// through the drift the wind leaves there. The corridor's centre is the path (the safe line, the let-go's line); the
// shelf, the lip and the mouth lie seaward of it inside a corridor that widens to hold them, so a rider not steering
// stays on the path (the review's finding 5). Nothing the five lay (ledges, kickers, fields, rails) is laid here, and
// nothing stands on it: what floors a rider here is a long flight landed wrong, nothing else (its rocks and huts are
// the world's, out past where any sled goes).
//
// Pure: no DOM, render or audio imports. Values only from chaos.ts, courseparts.ts and dmath.ts; course.ts and kit.ts for
// types.

import { ChaosEvent } from './chaos';
import { bank } from './courseparts';
import { smoothstep } from './dmath';
import type { Chunk, Course, Layout, Section, SectionKind, Surface } from './course';
import type { Kit, KitBeat, KitPlan, KitRider } from './kit';
import type { Rng } from './prng';

/** The grades (course.ts's GRADE reads them): the beacon's slope off the cape's head, the clifftop shelves, a gully's head
 *  (the path's drop through it, HEAD_EXTRA over the shelf's), the cut down to the harbour, the fish sheds and the harbour's
 *  ice. */
export const BEACON_GRADE = 0.3;
export const BEACON_LEN = 200;
export const SHELF_GRADE = 0.2;
export const HEAD_EXTRA = 0.1;
export const DESCENT_GRADE = 0.38;
export const SHEDS_GRADE = 0.2;
export const HARBOUR_GRADE = 0.025;

/** Its descent: three stages of 1,550, 1,600 and 1,650 m; no ramp, kicker or leap in its first minute; the run-in's light
 *  line (the beacon's slope is open); the harbour's ice the finish (260 m before the line, 200 past it); thresholds on
 *  the clifftop path; the avalanche, the light storm and the spirit train, never the yeti (it would walk out of the sea). */
export const GULLHAVEN_LAYOUT: Layout = {
  stages: [1550, 1600, 1650],
  grammar: 'gullhaven',
  square: 260,
  runOut: 200,
  finish: 'harbour',
  threshold: 'cliffpath',
  thresholdHW: 11,
  firstKick: null,
  kickFrom: 800,
  picketsFrom: 900,
  lightRun: { z: 130, len: 160, step: 8, wave: 110 },
  events: (1 << ChaosEvent.Avalanche) | (1 << ChaosEvent.GiftStorm) | (1 << ChaosEvent.GhostTrain),
};

/** The path's half-width on the shelves, at a threshold and on the beacon's slope. */
export const PATH_HW = 10;
const GATE_HW = 12;
const BEACON_HW = 13;
/** A gully: the bold line runs straight on BOLD m seaward of where the path was before it swung inland DETOUR m round the
 *  head; the column of lift is COLUMN_HW either side of the bold line, softening over COLUMN_SOFT; the shelf seaward of
 *  the path rises from SHELF_W0 to SHELF_W1 off the path's middle. The cliff at the lip is CLIFF m, the gully's whole
 *  drop DROP m (the path's own, through the head), the mouth (and the column over it) MOUTH m long. The Great Geo is
 *  wider and deeper. */
export const BOLD = 4.5;
export const DETOUR = 10;
export const COLUMN_HW = 2.5;
export const COLUMN_SOFT = 1.2;
export const SHELF_W0 = 5;
export const SHELF_W1 = 13;
export const CLIFF = 5;
export const DROP = 20;
export const MOUTH = 100;
const GREAT = { cliff: 7, drop: 26, mouth: 140, detour: 12, lift: 0.62, column: 115 };
/** The lift over a gully's mouth, a share of gravity (always under it: the air slows a fall, never carries a sled up);
 *  the Great Geo's is stronger (GREAT.lift), its flights the longest in the game. */
export const LIFT = 0.45;
/** How far over the mouth the column reaches from the lip: a sled is held three seconds or so, then drops to the face or
 *  the far shelf (the Great Geo's longer). */
export const COLUMN = 65;
/** How far the column reaches back over the shelf before the lip (a pop a beat early is still caught), and how far its
 *  far end takes to fade. */
const COLUMN_BACK = 4;
const COLUMN_FADE = 12;
/** The path swings inland over DETOUR_IN m, ending DETOUR_AT before the lip, and back over DETOUR_OUT once past the
 *  mouth's last DETOUR_HOLD m. */
const DETOUR_IN = 60;
const DETOUR_AT = 55;
const DETOUR_OUT = 60;
const DETOUR_HOLD = 10;
/** The cliff at the lip falls over this many metres (a corniced edge: it leaves a sled in the air at any speed). */
const CLIFF_RUN = 3;
/** A rider decides a gully this far before its lip: by its speed before it, and once past by where it is. */
export const DECIDE = 60;
/** The bold line leaves the path over BOLD_LEAD m before the path swings inland, and comes back to it over REJOIN m past
 *  the mouth. */
const BOLD_LEAD = 40;
const REJOIN = 60;
/** The moor inside the corridor: rising from MOOR_FROM inland of the path's middle. */
const MOOR_FROM = 6;
const MOOR_K = 0.02;
/** The sea cliff past the fence (the corridor's seaward edge): a fall of SEA_DROP from a metre past it. */
export const SEA_DROP = 120;

/** The surfaces (round 9). The shelf is wind-packed, quick; the head of a gully holds the drift the wind leaves there,
 *  slow; the gully's face is plain snow; the harbour is sea ice, where the ice charms bite. */
export const PACKED: Surface = { grip: 0.85, drag: 0.8, ice: false };
export const DRIFT: Surface = { grip: 1, drag: 1.5, ice: false };
export const FACE: Surface = { grip: 1, drag: 1, ice: false };
export const HARBOUR_ICE: Surface = { grip: 0.6, drag: 0.45, ice: true };

/** The soaring choice: a rider takes the bold line into a gully when its speed DECIDE m before the lip is at least
 *  SOAR_V less SOAR_DARE times its daring (skill and nerve); a rider not yet daring that much (a first-timer, a timid
 *  rider) only when it comes in faster than SOAR_TIMID. */
const SOAR_V = 31;
const SOAR_DARE = 14;
const SOAR_FROM = 0.3;
const SOAR_TIMID = 36;

/** One gully as the kit laid it. */
export interface Gully {
  /** Its order down the run, 0 first. */
  index: number;
  /** The lip (the shelf's corniced edge over the mouth), and the bold line's x. */
  zL: number;
  bx: number;
  /** The path's section through the head (its kind 'geo'), its blend in and the next section's blend out, and the extra
   *  grade it falls at. */
  z0: number;
  z1: number;
  b1: number;
  b2: number;
  /** The cliff at the lip, the whole drop, the mouth's length, how far inland the path swings. */
  cliff: number;
  drop: number;
  mouth: number;
  detour: number;
  /** The Great Geo, the widest crossing. */
  great: boolean;
  /** Its column's lift, a share of gravity, and its length from the lip. */
  lift: number;
  column: number;
}

/** A wiggle of the path on a shelf between gullies: x moves by `a` and back from z0 to z1. */
interface Wiggle {
  z0: number;
  z1: number;
  a: number;
}

/** What the kit laid on a course. */
interface Laid {
  gullies: Gully[];
  wiggles: Wiggle[];
  /** The thresholds (z0, z1), wider and calm. */
  gates: { z0: number; z1: number }[];
  /** Where the descent, the sheds and the harbour begin. */
  descent: number;
  sheds: number;
  harbour: number;
}

const LAID = new WeakMap<Course, Laid>();

function laid(c: Course): Laid {
  let d = LAID.get(c);
  if (!d) {
    c.section(0);
    d = LAID.get(c);
    if (!d) throw new Error('Gullhaven was not laid');
  }
  return d;
}

/** The smootherstep the path's swings ease on. */
function smoother(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/** How far the path has swung inland at z for gully g (0 to 1). */
function detourOf(g: Gully, z: number): number {
  const in0 = g.zL - DETOUR_AT - DETOUR_IN;
  if (z <= in0) return 0;
  const out0 = g.zL + g.mouth - DETOUR_HOLD;
  if (z < g.zL - DETOUR_AT) return smoother((z - in0) / DETOUR_IN);
  if (z <= out0) return 1;
  return 1 - smoother((z - out0) / DETOUR_OUT);
}

/** The first and last metre of a gully along the run: from where its bold line leaves the path to where it is back on
 *  it (the path's swing round the head lies inside). */
export function gullySpan(g: Gully): { z0: number; z1: number } {
  return { z0: g.zL - DETOUR_AT - DETOUR_IN - BOLD_LEAD, z1: g.zL + g.mouth + REJOIN };
}

/** The extra metres the path has fallen below the shelf's line through gully g by z: the integral of the head's extra
 *  grade over the section's smoothstep blends, as course.ts's baseY lays it (sectionInt). */
export function fallOf(g: Gully, z: number): number {
  const d = z - g.z0;
  if (d <= 0) return 0;
  const X = HEAD_EXTRA;
  if (d < g.b1) {
    const u = d / g.b1;
    return X * g.b1 * (u * u * u - (u * u * u * u) / 2);
  }
  const L = g.z1 - g.z0;
  if (d <= L) return X * (d - g.b1 / 2);
  const e = d - L;
  const base = X * (L - g.b1 / 2);
  if (e < g.b2) {
    const v = e / g.b2;
    return base + X * (e - g.b2 * (v * v * v - (v * v * v * v) / 2));
  }
  return base + (X * g.b2) / 2;
}

/** The shelf seaward of the path above the path's own ground at z, for gully g: the path's fall below the held shelf
 *  before the lip, gone over the cliff at the lip (past it the gully's face falls with the path to the far shelf). */
function shelfOver(g: Gully, z: number): number {
  if (z <= g.z0) return 0;
  const f = fallOf(g, z < g.zL ? z : g.zL);
  if (z < g.zL) return f;
  if (z >= g.zL + CLIFF_RUN) return 0;
  return f * (1 - smoothstep(g.zL, g.zL + CLIFF_RUN, z));
}

/** The rim's height over gully g's mouth at z: the shelf's line held on past the lip (the path's ground, and its fall
 *  below the shelf there). */
export function rimY(c: Course, g: Gully, z: number): number {
  return c.baseY(z) + fallOf(g, z);
}

/** The gully whose span holds z, or null. */
function gullyAt(c: Course, z: number): Gully | null {
  for (const g of laid(c).gullies) {
    const sp = gullySpan(g);
    if (z >= sp.z0 && z <= sp.z1) return g;
  }
  return null;
}

/** The last two z each course was asked for (the ground is asked a row of x at one z at a time). */
interface At {
  z: number;
  cx: number;
  hw: number;
  g: Gully | null;
}
const MEMO = new WeakMap<Course, [At, At]>();
let memoFlip = 0;

function at(c: Course, z: number): At {
  let m = MEMO.get(c);
  if (!m) {
    m = [
      { z: NaN, cx: 0, hw: 0, g: null },
      { z: NaN, cx: 0, hw: 0, g: null },
    ];
    MEMO.set(c, m);
  }
  if (m[0].z === z) return m[0];
  if (m[1].z === z) return m[1];
  const o = m[memoFlip];
  memoFlip ^= 1;
  const d = laid(c);
  let cx = 0;
  let widen = 0;
  let g: Gully | null = null;
  for (const w of d.wiggles) {
    if (z <= w.z0 || z >= w.z1) continue;
    const u = (z - w.z0) / (w.z1 - w.z0);
    cx += w.a * (u < 0.5 ? smoother(2 * u) : smoother(2 - 2 * u));
  }
  for (const q of d.gullies) {
    const k = detourOf(q, z);
    if (k <= 0) continue;
    g = q;
    cx -= q.detour * k;
    // Wide enough for the bold line, its column and room beside it, as far as the path has swung from it.
    widen = (q.detour + BOLD + COLUMN_HW + COLUMN_SOFT + 2.5 - PATH_HW) * k;
  }
  let hw = PATH_HW + widen;
  if (z < BEACON_LEN + 80) hw += (BEACON_HW - PATH_HW) * (1 - smoothstep(BEACON_LEN - 40, BEACON_LEN + 80, z));
  for (const t of d.gates) {
    const k = smoothstep(t.z0 - 120, t.z0, z) * (1 - smoothstep(t.z1, t.z1 + 60, z));
    if (k > 0) hw += (GATE_HW - PATH_HW) * k;
  }
  if (z > d.harbour - 120) hw += 4 * smoothstep(d.harbour - 120, d.harbour, z);
  o.z = z;
  o.cx = cx;
  o.hw = hw;
  o.g = g;
  return o;
}

/** The gullies the kit laid, in order (the world, the tests and the lab read them). */
export function gulliesOf(c: Course): readonly Readonly<Gully>[] {
  return laid(c).gullies;
}

/** The shelf's share at x across the path at z (0 on the path, 1 on the shelf or face seaward of it). */
export function shelfShare(c: Course, x: number, z: number): number {
  return smoothstep(SHELF_W0, SHELF_W1, x - at(c, z).cx);
}

/** The bold line into gully g at z: straight on at its x to the mouth's end, then back to the path. */
export function boldX(c: Course, g: Gully, z: number): number {
  const cx = at(c, z).cx;
  const z0 = g.zL - DETOUR_AT - DETOUR_IN - BOLD_LEAD;
  return cx + (g.bx - cx) * smoothstep(z0, z0 + BOLD_LEAD, z) * (1 - smoothstep(g.zL + g.mouth, g.zL + g.mouth + REJOIN, z));
}

/** Gullhaven's places (moments.ts lays its set pieces on them): its gullies, the Great Geo, the shore road (the last
 *  stretch above the descent) and the harbour road's end. */
export function placesOf(c: Course): { great: Gully; descent: number; sheds: number; harbour: number } {
  const d = laid(c);
  return { great: d.gullies.find((g) => g.great) ?? d.gullies[0], descent: d.descent, sheds: d.sheds, harbour: d.harbour };
}

/** Whether a rider of this kind, here and now, soars gully g: by its speed while it is still DECIDE m short of the lip,
 *  and from there on by which line it is nearer (so a choice once made holds to the gully's end). */
function soars(c: Course, g: Gully, r: KitRider): boolean {
  if (r.z < g.zL - DECIDE) {
    const dare = 0.7 * (r.skill > 1 ? 1 : r.skill < 0 ? 0 : r.skill) + 0.3 * (r.nerve > 1 ? 1 : r.nerve < 0 ? 0 : r.nerve);
    return r.v >= (dare < SOAR_FROM ? SOAR_TIMID : SOAR_V - SOAR_DARE * dare);
  }
  if (r.z > g.zL + g.mouth + REJOIN) return false;
  const cx = at(c, r.z).cx;
  const bx = boldX(c, g, r.z);
  return (r.x - cx < 0 ? cx - r.x : r.x - cx) > (r.x - bx < 0 ? bx - r.x : r.x - bx);
}

/** The ground as the world draws it past the fence (read only; the sim's own past it is the same: no sled is ever there). */
export function cliffEdgeX(c: Course, z: number): number {
  const a = at(c, z);
  return a.cx + a.hw;
}

export const GULLHAVEN_KIT: Kit = {
  id: 'gullhaven',
  layout: GULLHAVEN_LAYOUT,

  compose(c: Course, rng: Rng, blendOf: (k: SectionKind, prev: SectionKind | null) => number): KitBeat[] {
    const L = GULLHAVEN_LAYOUT;
    const s0 = L.stages[0];
    const s1 = s0 + L.stages[1];
    const fin = s1 + L.stages[2];
    const gate = (line: number): { z0: number; z1: number } => ({ z0: line - 40, z1: line + 160 });
    const gates = [gate(s0), gate(s1)];
    const harbour = fin - L.square;
    const sheds = harbour - 340;
    const descent = sheds - 160;
    // The lips: three over the Cape, four over the Geos (the second of them the Great Geo), two on the Harbour Road, each
    // gully clear of the next and of the thresholds' approaches.
    const plan: { z: number; great: boolean }[] = [];
    const jit = (): number => rng.range(-5, 5);
    for (const z of [400, 870, 1340]) plan.push({ z: z + jit(), great: false });
    for (const z of [1885, 2225, 2590, 2910]) plan.push({ z: z + jit(), great: z === 2225 });
    for (const z of [3490, 3850]) plan.push({ z: z + jit(), great: false });
    const b1 = blendOf('geo', 'cliffpath');
    const b2 = blendOf('cliffpath', 'geo');
    const gullies: Gully[] = plan.map((p, index) => {
      const cliff = p.great ? GREAT.cliff : CLIFF;
      const drop = p.great ? GREAT.drop : DROP;
      // The head's section starts where the path has fallen `cliff` below the shelf by the lip, and runs on until it has
      // fallen the whole drop once the next section's blend is through.
      const pre = cliff / HEAD_EXTRA + b1 / 2;
      const len = drop / HEAD_EXTRA + b1 / 2 - b2 / 2;
      const z0 = Math.round(p.z - pre);
      return { index, zL: z0 + pre, bx: 0, z0, z1: z0 + Math.round(len), b1, b2, cliff, drop, mouth: p.great ? GREAT.mouth : MOUTH, detour: p.great ? GREAT.detour : DETOUR, great: p.great, lift: p.great ? GREAT.lift : LIFT, column: p.great ? GREAT.column : COLUMN };
    });
    // The path's wiggles on the shelves between gullies, away from the thresholds and the start's gate.
    const wiggles: Wiggle[] = [];
    const calm = [{ z0: 0, z1: BEACON_LEN + 40 }, ...gates.map((t) => ({ z0: t.z0 - 130, z1: t.z1 + 20 }))];
    let from = BEACON_LEN + 40;
    for (let i = 0; i <= gullies.length; i++) {
      const to = i < gullies.length ? gullySpan(gullies[i]).z0 : descent - 20;
      // (Split round any calm stretch inside it.)
      let a = from;
      const stops = calm.filter((q) => q.z1 > a && q.z0 < to).sort((p, q) => p.z0 - q.z0);
      for (const q of [...stops, { z0: to, z1: to }]) {
        const b = Math.min(q.z0, to);
        if (b - a >= 110) wiggles.push({ z0: a + 5, z1: b - 5, a: rng.range(3, 7) * (rng.chance(0.5) ? 1 : -1) });
        a = Math.max(a, q.z1);
      }
      if (i < gullies.length) from = gullySpan(gullies[i]).z1;
    }
    const d: Laid = { gullies, wiggles, gates, descent, sheds, harbour };
    LAID.set(c, d);
    // The bold lines: straight on from where the path ran before it swung inland.
    for (const g of gullies) g.bx = at(c, gullySpan(g).z0).cx + BOLD;
    MEMO.delete(c);
    const beats: KitBeat[] = [];
    let prev: SectionKind | null = null;
    let z = 0;
    const push = (kind: SectionKind, to: number, gateOn = false): void => {
      beats.push({ kind, len: to - z, blend: blendOf(kind, prev), ...(gateOn ? { gate: true as const } : {}) });
      prev = kind;
      z = to;
    };
    push('beacon', BEACON_LEN);
    for (const g of gullies) {
      for (const t of gates) if (t.z0 > z && t.z0 < g.z0) {
        push('cliffpath', t.z0);
        push('cliffpath', t.z1, true);
      }
      push('cliffpath', g.z0);
      push('geo', g.z1);
    }
    for (const t of gates) if (t.z0 > z) {
      push('cliffpath', t.z0);
      push('cliffpath', t.z1, true);
    }
    push('cliffpath', descent);
    push('descent', sheds);
    push('sheds', harbour);
    push('harbour', harbour + L.square + L.runOut);
    return beats;
  },

  lay(c: Course, sec: Section, rng: Rng, plan: KitPlan): void {
    void c;
    void rng;
    // Nothing launches anywhere here but a gully's lip, and that is its own; the thresholds and the harbour are clear
    // across (as layBands does for the five's 'cruise' gate and 'finish').
    if (sec.gate || sec.kind === 'harbour') plan.clear.push({ z0: sec.z0, z1: sec.kind === 'harbour' ? 1e9 : sec.z1 });
    plan.busy.push({ z0: sec.z0, z1: sec.kind === 'harbour' ? 1e9 : sec.z1 });
  },

  centre(c: Course, z: number): number {
    return at(c, z).cx;
  },

  halfWidth(c: Course, z: number): number {
    return at(c, z).hw;
  },

  ground(c: Course, x: number, z: number, base: number): number {
    const a = at(c, z);
    const dx = x - a.cx;
    let h = base;
    // A gully: the shelf seaward of the path held level to the lip, then the cliff, then the face falling with the path.
    const g = a.g;
    if (g && dx > SHELF_W0) {
      const over = shelfOver(g, z);
      if (over > 0) h += over * smoothstep(SHELF_W0, SHELF_W1, dx);
    }
    // The moor rising inland.
    if (dx < -MOOR_FROM) h += MOOR_K * (dx + MOOR_FROM) * (dx + MOOR_FROM);
    const e = (dx < 0 ? -dx : dx) - a.hw;
    if (e > 0) {
      if (dx < 0) h += bank(e);
      // Seaward: the fence at the edge, and past it the cliff's fall to the sea.
      else h -= 0.1 * e * e + SEA_DROP * smoothstep(1, 9, e);
    }
    return h;
  },

  surface(c: Course, x: number, z: number): Surface | null {
    const d = laid(c);
    if (z >= d.harbour - 30) return HARBOUR_ICE;
    if (z >= d.descent && z < d.harbour) return null;
    const a = at(c, z);
    const g = a.g;
    if (g) {
      const dx = x - a.cx;
      // The drift in the head, on and inland of the path; the gully's face seaward of it past the lip.
      if (z >= g.zL - 25 && z < g.zL + g.mouth * 0.8 && dx < SHELF_W0 + 2) return DRIFT;
      if (z >= g.zL && dx >= (SHELF_W0 + SHELF_W1) / 2 && z < g.z1 + g.b2) return FACE;
    }
    return PACKED;
  },

  lift(c: Course, x: number, y: number, z: number): number {
    const g = at(c, z).g;
    if (!g || z < g.zL - COLUMN_BACK || z > g.zL + g.column + COLUMN_FADE) return 0;
    const ax = x - g.bx < 0 ? g.bx - x : x - g.bx;
    if (ax >= COLUMN_HW + COLUMN_SOFT) return 0;
    const wx = ax <= COLUMN_HW ? 1 : 1 - smoothstep(COLUMN_HW, COLUMN_HW + COLUMN_SOFT, ax);
    void y;
    const wz = z <= g.zL + g.column ? 1 : 1 - smoothstep(g.zL + g.column, g.zL + g.column + COLUMN_FADE, z);
    return g.lift * 9.81 * wx * wz;
  },

  liftX(c: Course, z: number): number | null {
    const g = at(c, z).g;
    if (!g || z < g.zL - COLUMN_BACK || z > g.zL + g.column + COLUMN_FADE) return null;
    return g.bx;
  },

  lineFor(c: Course, z: number, r: KitRider): number {
    const g = gullyAt(c, z);
    const cx = at(c, z).cx;
    if (!g || !soars(c, g, r)) return cx;
    return boldX(c, g, z);
  },

  lips(c: Course, z0: number, z1: number): readonly { z: number; x0: number; x1: number }[] {
    const out: { z: number; x0: number; x1: number }[] = [];
    for (const g of laid(c).gullies) if (g.zL >= z0 && g.zL <= z1) out.push({ z: g.zL, x0: g.bx - COLUMN_HW, x1: g.bx + COLUMN_HW });
    return out;
  },

  lights(c: Course, chunk: Chunk, rng: Rng, diff: number, push: (x: number, z: number, hover: number, value: number) => void): void {
    void rng;
    void diff;
    // Over each gully's mouth, high in the column, the great light only a soaring line reaches; sparks along the shelf to
    // the lip show the line that leads to it.
    for (const g of laid(c).gullies) {
      for (let k = 0; k < 4; k++) {
        const z = g.zL - 50 + k * 12;
        if (z >= chunk.z0 && z < chunk.z1) push(g.bx, z, 0.8, 1);
      }
      const z = g.zL + g.mouth * 0.45;
      if (z >= chunk.z0 && z < chunk.z1) push(g.bx, z, g.great ? 9 : 6, 3);
    }
  },
};
