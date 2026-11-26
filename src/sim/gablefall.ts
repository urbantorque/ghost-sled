// Gablefall (round 9, notes/r9-ground.md section 7, notes/r9-gablefall.md): a hill town of steep roofs packed down a
// valley side, so snowed in that the roofs are the way down. Its descent is laid here, through course.ts's kit seam
// (kit.ts), never by the five's acts.
//
// The run starts on the ridge of the church's nave at the head of the town, crosses the close below it, then runs down
// the street between two rows of houses to the river. The street is the course's own level (baseY), its middle the
// safe line, its cobbles slow. Either side a row of houses stands back from it, laid as blocks between alleys; each
// house's roof is snow on slate, a gable whose ridge runs down the row's middle, falling along the street a little
// less steeply than the street does, so each roof is a step down from the last and never higher. A rider on the roofs
// hops each step and each alley and stomps the landings, which is what pays there; a rider who misses one, or rides off
// the front eave, drops into the street, and rides it until a drift banked against a corner (one at least every 250 m,
// sides alternating) takes it back up onto a row. Chimneys stand beside the ridges, never on them.
//
// The ground is one height a point, so a roof over the street is a step in it: a sled meeting a step from below would
// be lifted onto it in a tick. Every step here is one a sled can only leave from above (a roof is never higher than the
// last; an alley's drift and a corner drift rise along the run, never across it), and the sim holds a sled that would
// meet one from the side (hook D, sim.ts levelHold): a house front and a drift's side mid-ramp only scrape. What floors a
// rider here is a chimney met head on, or a long flight landed wrong.
//
// Pure: no DOM, render or audio imports. Values only from chaos.ts, courseparts.ts and dmath.ts; course.ts and kit.ts for
// types.

import { ALL_EVENTS } from './chaos';
import { bank } from './courseparts';
import { smoothstep } from './dmath';
import type { Chunk, Course, Layout, Section, SectionKind, Surface } from './course';
import type { Kit, KitBeat, KitPlan, KitRider, Placer, Street } from './kit';
import type { Rng } from './prng';

/** The grades (course.ts's GRADE reads them): down the church's nave at the start, the close and the market squares,
 *  the street between the rows, the quay and the river's ice it finishes on. A roof falls at ROOF_GRADE along the
 *  street, less than the street, so each house is a step under the last. */
export const NAVE_GRADE = 0.4;
export const NAVE_LEN = 80;
export const SQUARE_GRADE = 0.1;
export const STREET_GRADE = 0.22;
export const QUAY_GRADE = 0.04;
export const ROOF_GRADE = 0.2;

/** Its descent: three stages of 900, 950 and 950 m (Church Hill, the Market, the Water Stairs); no ramp, kicker or leap
 *  in its first minute, and no run-in light line (the close is a square); the river's ice the finish (140 m before the
 *  line, 240 past it); thresholds on the market squares; all four of the mid-run events. */
export const GABLEFALL_LAYOUT: Layout = {
  stages: [900, 950, 950],
  grammar: 'gablefall',
  square: 140,
  runOut: 240,
  finish: 'quay',
  threshold: 'square',
  thresholdHW: 11,
  firstKick: null,
  kickFrom: 800,
  picketsFrom: 900,
  lightRun: null,
  events: ALL_EVENTS,
};

/** The corridor's half-width: the nave's ridge, the close and the squares, the street and its two rows, the quay. */
export const NAVE_HW = 6;
export const SQUARE_HW = 12;
export const QUAY_HW = 13;
/** Across the street, metres from its middle: the cobbles to STREET_HW, the pavement to the house fronts at FRONT, the
 *  row to its back at BACK (the corridor's edge), its ridge at RIDGE. A corner drift's inner edge is at PAVE. */
export const STREET_HW = 4.5;
export const PAVE = 4.8;
export const FRONT = 6;
export const BACK = 16;
export const RIDGE = (FRONT + BACK) / 2;
/** A roof's gable: PITCH across from the ridge to each eave, HALF either side of it, rounded over 2 ROUND m at the ridge
 *  so a sled crossing it sideways is not thrown and one riding it is not pulled off it. */
export const PITCH = 0.3;
const HALF = (BACK - FRONT) / 2;
const ROUND = 3.5;
/** The eave over the street at a house's top, and how high over the street a sled must be to ride on past the street's
 *  sides (the eave less a metre, over any pop's peak: Powder Day's 2.2 m, Comet Night's 2.1). */
export const EAVE = 6;
export const HOLD = 5;
/** A step's eave falls over STEP_RUN. (A house front and a corner drift's inner side are sheer: a sled is on the roof or
 *  the drift, or on the pavement, never half way up a wall, where a sled riding along it would be lifted as the wall's
 *  height changed under it.) */
const STEP_RUN = 0.5;
/** A house is HOUSE_MIN to HOUSE_MAX m along the street, a block BLOCK_MIN to BLOCK_MAX houses, an alley between blocks
 *  ALLEY_MIN to ALLEY_MAX m wide, its floor ALLEY_DIP under the next roof. A roof is at least MIN_STEP under the last. */
const HOUSE_MIN = 14;
const HOUSE_MAX = 20;
const BLOCK_MIN = 2;
const BLOCK_MAX = 4;
const ALLEY_MIN = 4;
const ALLEY_MAX = 8;
export const ALLEY_DIP = 0.5;
const MIN_STEP = 0.3;
/** A corner drift: DRIFT_LEN m from the street at its foot to the next roof at its top; one every DRIFT_EVERY m down
 *  the run, sides alternating, and one at the head of each row. */
export const DRIFT_LEN = 44;
/** A corner drift's rise over the street steepens over its first DRIFT_FOOT of its length (a foot flush with the street,
 *  where a sled steers onto it), then rolls over to the roof's own fall over the rest, gently enough that a sled riding
 *  up it at speed is not thrown off its top. */
const DRIFT_FOOT = 0.25;
const DRIFT_EVERY: readonly [number, number] = [130, 170];
/** The rows end ROW_END m before a square or the quay. */
const ROW_END = 20;
/** Chimneys stand beside the ridge, their nearest edge CHIMNEY_CLEAR m off it, their middle at most CHIMNEY_OUT m off
 *  it; CHIMNEY_END m from a house's ends. */
export const CHIMNEY_CLEAR = 2;
const CHIMNEY_OUT = 4.2;
const CHIMNEY_END = 2.5;
/** A rider in the street takes a drift onto the roofs when it dares this much (skill and nerve, as Gullhaven's soaring
 *  choice); a rider is on a roof when it is UP m or more over the street. */
const ROOF_DARE = 0.3;
export const UP = 2;
/** A rider is off the street (on a drift) when it is OFF_STREET m over it; a rider on its row is drawn back to the ridge
 *  from where it is over APPROACH m. */
const OFF_STREET = 0.3;
const APPROACH = 30;
/** (Up the near edge of a drift or a roof, nearer: its inner side falls to the street.) */
const APPROACH_NEAR = 15;
/** A rider bound for a drift leaves the street's middle LEAD m before its foot, for FOOT_X off the middle (over the
 *  pavement, clear of the drift's inner side), and is on the ridge's line by CLIMB of the drift's length; a rider still
 *  in the street FOOT_OPEN m past the foot has missed it (the drift has risen too far there to step onto). */
const CLIMB = 0.6;
const LEAD = 60;
const FOOT_X = 6.5;
const FOOT_OPEN = 5;

/** The surfaces (round 9). The street is trodden snow over cobbles, slow; the roofs snow on slate; a drift loose snow;
 *  the river's ice at the finish, where the ice charms bite. */
export const COBBLES: Surface = { grip: 1, drag: 1.25, ice: false };
export const ROOF: Surface = { grip: 1, drag: 2, ice: false };
export const DRIFT: Surface = { grip: 1, drag: 1.1, ice: false };
export const RIVER_ICE: Surface = { grip: 0.6, drag: 0.45, ice: true };

/** One chimney on a house: across from the ridge (t, signed toward the street negative), along the house (dz from its
 *  top), its radius and height over the roof. */
export interface Chimney {
  t: number;
  dz: number;
  r: number;
  h: number;
}

/** What lies along a row: a house (its roof), an alley (its floor rising to the next roof), a corner drift (from the
 *  street up to the next roof). */
export type PieceKind = 'house' | 'alley' | 'drift';
export interface Piece {
  kind: PieceKind;
  z0: number;
  z1: number;
  /** A house: its eave at z0. An alley or a drift: the eave of the house it leads to. Laid once the course's levels are. */
  e0: number;
  chimneys: Chimney[];
}

/** One side's row through a run of rooftops: its pieces in order, contiguous from z0 to z1. */
export interface Row {
  side: -1 | 1;
  z0: number;
  z1: number;
  pieces: Piece[];
}

/** A wiggle of the street: x moves by `a` and back from z0 to z1. */
interface Wiggle {
  z0: number;
  z1: number;
  a: number;
}

interface Span {
  kind: SectionKind;
  z0: number;
  z1: number;
}

/** What the kit laid on a course. */
interface Laid {
  spans: Span[];
  rows: Row[];
  /** The corner drifts in order down the run (both sides). */
  drifts: { side: -1 | 1; z0: number; z1: number; row: Row }[];
  wiggles: Wiggle[];
  gates: { z0: number; z1: number }[];
  quay: number;
  /** Whether the houses' eaves have been set from the course's levels (once, after it is laid). */
  levelled: boolean;
}

const LAID = new WeakMap<Course, Laid>();

function laid(c: Course): Laid {
  let d = LAID.get(c);
  if (!d) {
    c.section(0);
    d = LAID.get(c);
    if (!d) throw new Error('Gablefall was not laid');
  }
  if (!d.levelled) level(c, d);
  return d;
}

/** The eaves, from the street's level at each house's top, each roof at least MIN_STEP under the last on its row. */
function level(c: Course, d: Laid): void {
  d.levelled = true;
  for (const row of d.rows) {
    let prevEnd = Infinity;
    for (const p of row.pieces) {
      if (p.kind !== 'house') {
        if (p.kind === 'drift') prevEnd = Infinity;
        continue;
      }
      const e = c.baseY(p.z0) + EAVE;
      p.e0 = e < prevEnd - MIN_STEP ? e : prevEnd - MIN_STEP;
      prevEnd = p.e0 - ROOF_GRADE * (p.z1 - p.z0);
    }
    // An alley or a drift leads to the house after it.
    for (let i = row.pieces.length - 2; i >= 0; i--) if (row.pieces[i].kind !== 'house') row.pieces[i].e0 = row.pieces[i + 1].e0;
  }
}

/** The smootherstep the street's bends ease on. */
function smoother(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/** A gable's height over its eave at a distance across from the street's middle: PITCH a metre up to the ridge, rounded
 *  there; past either eave it falls on (the row's back, the next row behind). */
export function gable(adx: number): number {
  const t = adx - RIDGE;
  const at = t < 0 ? -t : t;
  const soft = at >= ROUND ? at : (at * at) / (2 * ROUND) + ROUND / 2;
  return PITCH * (HALF - soft);
}

/** The roof of house p at z, across at adx (adx at FRONT or more). */
function roofY(p: Piece, adx: number, z: number): number {
  return p.e0 - ROOF_GRADE * (z - p.z0) + gable(adx);
}

/** A piece's own surface at (adx, z), adx from the drift's inner edge outward; `s` the street's level at z. */
function pieceY(c: Course, p: Piece, next: Piece | null, adx: number, z: number, s: number): number {
  const ax = adx > FRONT ? adx : FRONT;
  if (p.kind === 'house') return roofY(p, ax, z);
  if (p.kind === 'alley') {
    // The floor of snow in the alley, rising to the next roof's surface at every x by the alley's end, and falling with
    // it there (no crest where it meets the roof).
    const k = 1 - smoothstep(p.z0, p.z1, z);
    return p.e0 - ROOF_GRADE * (z - p.z1) + gable(ax) - ALLEY_DIP * k;
  }
  // A corner drift: from the street's level at its foot to the next roof's surface at every x at its top, its rise over
  // the street steepening over its foot and rolling over to its top.
  void next;
  const top = p.e0 + gable(ax) - c.baseY(p.z1);
  return s + top * driftRise((z - p.z0) / (p.z1 - p.z0));
}

/** A corner drift's rise over the street, 0 at its foot to 1 at its top: its slope climbs evenly to its steepest at
 *  DRIFT_FOOT and falls evenly back to nothing at its top (a parabola each side), so it bends up at its foot and over at
 *  its top no more sharply than its length allows. */
export function driftRise(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const a = DRIFT_FOOT;
  return u <= a ? (u * u) / a : 1 - ((1 - u) * (1 - u)) / (1 - a);
}

/** The piece of a row at z (binary search), or -1. */
function pieceIndex(row: Row, z: number): number {
  const ps = row.pieces;
  if (z < row.z0 || z >= row.z1) return -1;
  let lo = 0;
  let hi = ps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ps[mid].z0 <= z) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The ground of one side's row at (adx, z), or null where it stands nothing there (the street's level). */
function rowY(c: Course, row: Row, adx: number, z: number, s: number): number | null {
  const i = pieceIndex(row, z);
  if (i < 0) return null;
  const p = row.pieces[i];
  const next = i + 1 < row.pieces.length ? row.pieces[i + 1] : null;
  if (p.kind === 'drift') {
    // Its inner side sheer at PAVE, over the pavement.
    if (adx < PAVE) return null;
    return pieceY(c, p, next, adx, z, s);
  }
  // A house or an alley: the pavement in front of it, then its front, then its roof or floor.
  if (adx < FRONT) return null;
  let y = pieceY(c, p, next, adx, z, s);
  // A step: the last piece's end, higher, falling over STEP_RUN into this one.
  const dz = z - p.z0;
  if (dz < STEP_RUN && i > 0) {
    const q = row.pieces[i - 1];
    const prev = pieceY(c, q, p, adx, p.z0, c.baseY(p.z0)) - (q.kind === 'house' ? 0 : 0);
    if (prev > y) y = prev + (y - prev) * smoothstep(0, STEP_RUN, dz);
  }
  return y;
}

/** The last two z each course was asked for (the ground is asked a row of x at one z at a time). */
interface At {
  z: number;
  cx: number;
  hw: number;
  /** The rows standing at z, left and right (or null). */
  left: Row | null;
  right: Row | null;
}
const MEMO = new WeakMap<Course, [At, At]>();
let memoFlip = 0;

const HW: Partial<Record<SectionKind, number>> = { nave: NAVE_HW, square: SQUARE_HW, rooftops: BACK, quay: QUAY_HW };

function at(c: Course, z: number): At {
  let m = MEMO.get(c);
  if (!m) {
    m = [
      { z: NaN, cx: 0, hw: 0, left: null, right: null },
      { z: NaN, cx: 0, hw: 0, left: null, right: null },
    ];
    MEMO.set(c, m);
  }
  if (m[0].z === z) return m[0];
  if (m[1].z === z) return m[1];
  const o = m[memoFlip];
  memoFlip ^= 1;
  const d = laid(c);
  let cx = 0;
  for (const w of d.wiggles) {
    if (z <= w.z0 || z >= w.z1) continue;
    const u = (z - w.z0) / (w.z1 - w.z0);
    cx += w.a * (u < 0.5 ? smoother(2 * u) : smoother(2 - 2 * u));
  }
  // The width of the span z is in, eased in from the last over its first 30 m.
  let hw = NAVE_HW;
  for (let i = 0; i < d.spans.length; i++) {
    const sp = d.spans[i];
    if (z < sp.z0 && i > 0) break;
    const w = HW[sp.kind] ?? SQUARE_HW;
    if (i === 0) hw = w;
    else hw = hw + (w - hw) * smoothstep(sp.z0, sp.z0 + 30, z);
  }
  let left: Row | null = null;
  let right: Row | null = null;
  for (const r of d.rows) {
    if (z < r.z0 || z >= r.z1) continue;
    if (r.side < 0) left = r;
    else right = r;
  }
  o.z = z;
  o.cx = cx;
  o.hw = hw;
  o.left = left;
  o.right = right;
  return o;
}

/** The rows the kit laid (the world, the tests and the lab read them). */
export function rowsOf(c: Course): readonly Readonly<Row>[] {
  return laid(c).rows;
}

/** The corner drifts in order down the run. */
export function driftsOf(c: Course): readonly { side: -1 | 1; z0: number; z1: number }[] {
  return laid(c).drifts;
}

/** The places the kit laid: the close, the squares, the quay (the world reads them). */
export function placesOf(c: Course): { close: { z0: number; z1: number }; gates: readonly { z0: number; z1: number }[]; quay: number } {
  const d = laid(c);
  const close = d.spans[1];
  return { close: { z0: close.z0, z1: close.z1 }, gates: d.gates, quay: d.quay };
}

/** The row of one side at z, or null. */
export function rowAt(c: Course, side: -1 | 1, z: number): Row | null {
  const a = at(c, z);
  return side < 0 ? a.left : a.right;
}

/** The street's level over which a sled is held to it, and its sides, at z; null where there is no street (the nave, the
 *  squares, the quay): hook D (sim.ts levelHold, the bot, the tests). */
export function streetOf(c: Course, z: number): Street | null {
  const a = at(c, z);
  if (!a.left && !a.right) return null;
  // Each side: the house fronts, a corner drift's inner side, or open ground to the corridor's edge.
  const reach = (row: Row | null): number => {
    if (!row) return a.hw;
    const i = pieceIndex(row, z);
    return i < 0 ? a.hw : row.pieces[i].kind === 'drift' ? PAVE : FRONT;
  };
  return { x0: a.cx - reach(a.left), x1: a.cx + reach(a.right), y: c.baseY(z), hold: HOLD };
}

/** How far up a sled at (x, y, z) is over the street (the measure of the roofs: UP or more is on them). */
export function overStreet(c: Course, y: number, z: number): number {
  return y - c.baseY(z);
}

/** Whether a rider of this kind takes the roofs (by skill and nerve). */
function dares(r: KitRider): boolean {
  const sk = r.skill > 1 ? 1 : r.skill < 0 ? 0 : r.skill;
  const nv = r.nerve > 1 ? 1 : r.nerve < 0 ? 0 : r.nerve;
  return 0.7 * sk + 0.3 * nv >= ROOF_DARE;
}

export const GABLEFALL_KIT: Kit = {
  id: 'gablefall',
  layout: GABLEFALL_LAYOUT,

  compose(c: Course, rng: Rng, blendOf: (k: SectionKind, prev: SectionKind | null) => number): KitBeat[] {
    const L = GABLEFALL_LAYOUT;
    const s0 = L.stages[0];
    const s1 = s0 + L.stages[1];
    const fin = s1 + L.stages[2];
    const gate = (line: number): { z0: number; z1: number } => ({ z0: line - 40, z1: line + 150 });
    const gates = [gate(s0), gate(s1)];
    const quay = fin - L.square;
    const closeEnd = 180;
    const spans: Span[] = [
      { kind: 'nave', z0: 0, z1: NAVE_LEN },
      { kind: 'square', z0: NAVE_LEN, z1: closeEnd },
      { kind: 'rooftops', z0: closeEnd, z1: gates[0].z0 },
      { kind: 'square', z0: gates[0].z0, z1: gates[0].z1 },
      { kind: 'rooftops', z0: gates[0].z1, z1: gates[1].z0 },
      { kind: 'square', z0: gates[1].z0, z1: gates[1].z1 },
      { kind: 'rooftops', z0: gates[1].z1, z1: quay },
      { kind: 'quay', z0: quay, z1: fin + L.runOut },
    ];
    // The rows: each run of rooftops laid on both sides as blocks of houses between alleys, a corner drift at the head of
    // each row and down the run every DRIFT_EVERY, sides alternating.
    const rows: Row[] = [];
    const drifts: Laid['drifts'] = [];
    for (const sp of spans) {
      if (sp.kind !== 'rooftops') continue;
      const end = sp.z1 - ROW_END;
      // The drifts' places down this run, sides alternating from a side the seed picks.
      const due: { z: number; side: -1 | 1 }[] = [];
      let side: -1 | 1 = rng.chance(0.5) ? 1 : -1;
      for (let z = sp.z0 + rng.range(DRIFT_EVERY[0], DRIFT_EVERY[1]); z < end - DRIFT_LEN - HOUSE_MIN * 2; z += rng.range(DRIFT_EVERY[0], DRIFT_EVERY[1])) {
        due.push({ z, side });
        side = side > 0 ? -1 : 1;
      }
      for (const sd of [-1, 1] as const) {
        const row: Row = { side: sd, z0: sp.z0, z1: sp.z0, pieces: [] };
        const mine = due.filter((q) => q.side === sd).map((q) => q.z);
        let k = 0;
        let z = sp.z0;
        const piece = (kind: PieceKind, len: number): Piece => {
          const p: Piece = { kind, z0: z, z1: z + len, e0: 0, chimneys: [] };
          row.pieces.push(p);
          z += len;
          return p;
        };
        // The head: a drift from the square or the close up onto the row.
        piece('drift', DRIFT_LEN);
        drifts.push({ side: sd, z0: row.pieces[0].z0, z1: row.pieces[0].z1, row });
        for (;;) {
          // A block of houses, ended early if a drift is due.
          const n = rng.int(BLOCK_MIN, BLOCK_MAX);
          let laidAny = false;
          for (let h = 0; h < n; h++) {
            const len = Math.round(rng.range(HOUSE_MIN, HOUSE_MAX) * 2) / 2;
            if (z + len > end) break;
            if (laidAny && k < mine.length && z + len > mine[k]) break;
            const p = piece('house', len);
            laidAny = true;
            // Its chimneys, beside the ridge.
            const count = rng.weighted([0.25, 0.5, 0.25]);
            for (let j = 0; j < count; j++) {
              const r = rng.range(0.5, 0.7);
              const off = rng.range(CHIMNEY_CLEAR + r + 0.1, CHIMNEY_OUT);
              const t = (j === 0 ? (rng.chance(0.5) ? 1 : -1) : -Math.sign(p.chimneys[0].t)) * off;
              p.chimneys.push({ t, dz: rng.range(CHIMNEY_END, len - CHIMNEY_END), r, h: rng.range(1.6, 2.2) });
            }
          }
          if (!laidAny) break;
          // Then a drift if one is due, or an alley; the row ends where there is no room for a house after it.
          if (k < mine.length && z >= mine[k] - HOUSE_MAX) {
            if (z + DRIFT_LEN + HOUSE_MIN > end) break;
            k++;
            const p = piece('drift', DRIFT_LEN);
            drifts.push({ side: sd, z0: p.z0, z1: p.z1, row });
            continue;
          }
          const gap = Math.round(rng.range(ALLEY_MIN, ALLEY_MAX) * 2) / 2;
          if (z + gap + HOUSE_MIN > end) break;
          piece('alley', gap);
        }
        row.z1 = z;
        rows.push(row);
      }
    }
    drifts.sort((a, b) => a.z0 - b.z0 || a.side - b.side);
    // The street's bends down each run of rooftops, clear of the squares and the rows' heads.
    const wiggles: Wiggle[] = [];
    for (const sp of spans) {
      if (sp.kind !== 'rooftops') continue;
      let a = sp.z0 + DRIFT_LEN + 20;
      const to = sp.z1 - 40;
      while (to - a >= 140) {
        const len = Math.min(to - a, rng.range(140, 220));
        wiggles.push({ z0: a, z1: a + len, a: rng.range(2, 4.5) * (rng.chance(0.5) ? 1 : -1) });
        a += len + rng.range(10, 40);
      }
    }
    const d: Laid = { spans, rows, drifts, wiggles, gates, quay, levelled: false };
    LAID.set(c, d);
    MEMO.delete(c);
    const beats: KitBeat[] = [];
    let prev: SectionKind | null = null;
    let z = 0;
    for (const sp of spans) {
      const g = gates.some((t) => t.z0 === sp.z0);
      beats.push({ kind: sp.kind, len: sp.z1 - z, blend: blendOf(sp.kind, prev), ...(g ? { gate: true as const } : {}) });
      prev = sp.kind;
      z = sp.z1;
    }
    return beats;
  },

  lay(c: Course, sec: Section, rng: Rng, plan: KitPlan): void {
    void c;
    void rng;
    // Nothing of the five's launches anywhere here; the thresholds and the quay are clear across (as layBands does for
    // the five's 'cruise' gate and 'finish').
    if (sec.gate || sec.kind === 'quay') plan.clear.push({ z0: sec.z0, z1: sec.kind === 'quay' ? 1e9 : sec.z1 });
    plan.busy.push({ z0: sec.z0, z1: sec.kind === 'quay' ? 1e9 : sec.z1 });
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
    const adx = dx < 0 ? -dx : dx;
    const row = dx < 0 ? a.left : a.right;
    if (row) {
      const y = rowY(c, row, adx, z, base);
      if (y !== null) return y;
      return base;
    }
    const e = adx - a.hw;
    return e > 0 ? base + bank(e) : base;
  },

  surface(c: Course, x: number, z: number): Surface | null {
    const d = laid(c);
    if (z >= d.quay + 20) return RIVER_ICE;
    const a = at(c, z);
    const dx = x - a.cx;
    const adx = dx < 0 ? -dx : dx;
    const row = dx < 0 ? a.left : a.right;
    if (z < NAVE_LEN) return ROOF;
    if (!row) return null;
    const i = pieceIndex(row, z);
    if (i < 0) return COBBLES;
    const p = row.pieces[i];
    if (p.kind === 'drift') return adx >= PAVE ? DRIFT : COBBLES;
    if (adx < FRONT) return COBBLES;
    return p.kind === 'house' ? ROOF : DRIFT;
  },

  street(c: Course, z: number): Street | null {
    return streetOf(c, z);
  },

  obstacles(c: Course, chunk: Chunk, rng: Rng, p: Placer, diff: number): void {
    void rng;
    void diff;
    for (const row of laid(c).rows) {
      if (row.z1 <= chunk.z0 || row.z0 >= chunk.z1) continue;
      for (const q of row.pieces) {
        if (q.kind !== 'house' || q.z1 <= chunk.z0 || q.z0 >= chunk.z1) continue;
        for (const ch of q.chimneys) {
          const z = q.z0 + ch.dz;
          if (z < chunk.z0 || z >= chunk.z1) continue;
          const x = at(c, z).cx + row.side * (RIDGE + ch.t);
          if (p.clearOf(x, z, ch.r)) p.add('chimney', x, z, ch.r, ch.h);
        }
      }
    }
  },

  lights(c: Course, chunk: Chunk, rng: Rng, diff: number, push: (x: number, z: number, hover: number, value: number) => void): void {
    void rng;
    void diff;
    // Over each alley, on the ridge's line at a hop's height: a spark for a rider who hops it.
    for (const row of laid(c).rows) {
      if (row.z1 <= chunk.z0 || row.z0 >= chunk.z1) continue;
      for (const q of row.pieces) {
        if (q.kind !== 'alley') continue;
        const z = (q.z0 + q.z1) / 2;
        if (z >= chunk.z0 && z < chunk.z1) push(at(c, z).cx + row.side * RIDGE, z, 1.8, 1);
      }
    }
  },

  lineFor(c: Course, z: number, r: KitRider): number {
    const d = laid(c);
    const cx = at(c, z).cx;
    const here = at(c, r.z);
    const rdx = r.x - here.cx;
    const side: -1 | 1 = rdx < 0 ? -1 : 1;
    const row = side < 0 ? here.left : here.right;
    // On its row (a roof, an alley's floor, or up a drift off the street's level): to the ridge of its row, eased in from
    // where it is across over APPROACH m, as far as the row runs; past its end, back to the middle.
    if (row && r.y - c.baseY(r.z) >= OFF_STREET && (rdx < 0 ? -rdx : rdx) >= PAVE) {
      const k = smoother((z - r.z) / ((rdx < 0 ? -rdx : rdx) < FRONT + 1 ? APPROACH_NEAR : APPROACH));
      const on = cx + rdx + (side * RIDGE - rdx) * k;
      if (z < row.z1) return on;
      return cx + (on - cx) * (1 - smoother((z - row.z1) / 40));
    }
    // In the street: a rider who does not dare the roofs keeps to it.
    if (!dares(r)) return cx;
    // The next corner drift whose foot it has not passed (at the head of a row, both sides: the side it is on, or near the
    // middle a side of its own, from what kind of rider it is, so it does not change its mind): up it to the ridge.
    const pick: -1 | 1 = (rdx < 0 ? -rdx : rdx) > 1 ? side : ((Math.floor(r.skill * 97 + r.nerve * 61) & 1) === 1 ? 1 : -1);
    let next: Laid['drifts'][number] | null = null;
    for (const q of d.drifts) {
      if (q.z0 < r.z - FOOT_OPEN) continue;
      if (!next) next = q;
      else if (q.z0 === next.z0 && q.side === pick) next = q;
      if (q.z0 > next.z0) break;
    }
    if (!next || z < next.z0 - LEAD || z >= next.row.z1) return cx;
    const sd = next.side;
    if (z < next.z0) return cx + sd * FOOT_X * smoother((z - (next.z0 - LEAD)) / LEAD);
    if (z < next.z1) return cx + sd * (FOOT_X + (RIDGE - FOOT_X) * smoother((z - next.z0) / ((next.z1 - next.z0) * CLIMB)));
    return cx + sd * RIDGE;
  },

  lips(c: Course, z0: number, z1: number): readonly { z: number; x0: number; x1: number }[] {
    const out: { z: number; x0: number; x1: number }[] = [];
    for (const row of laid(c).rows) {
      if (row.z1 < z0 || row.z0 > z1) continue;
      for (let i = 0; i + 1 < row.pieces.length; i++) {
        const q = row.pieces[i];
        if (q.kind !== 'house' || row.pieces[i + 1].kind === 'house' || q.z1 < z0 || q.z1 > z1) continue;
        const cx = at(c, q.z1).cx;
        out.push(row.side > 0 ? { z: q.z1, x0: cx + FRONT, x1: cx + BACK } : { z: q.z1, x0: cx - BACK, x1: cx - FRONT });
      }
    }
    out.sort((a, b) => a.z - b.z);
    return out;
  },
};
