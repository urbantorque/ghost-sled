import type { Course } from '../sim/course';
import { BACK, FRONT, NAVE_LEN, PAVE, STREET_HW, placesOf, rowAt } from '../sim/gablefall';
import type { Clearing } from './dressing';

// Where Gablefall's own world stands (round 9, notes/r9-gablefall-world.md): what the shared systems need to know before
// its world (gablefallworld.ts, loaded on demand) has loaded. Small and static: whether a course is Gablefall's, the
// ground its world draws past the corridor (the town's lanes behind the rows, the hillside under the church, the river's
// ice and the quay), the columns and rows the terrain needs so a house front and a roof's step are drawn sheer, and the
// ground the five's forest and dressing keep off (all of it: a town has no forest).

/** Whether a course is Gablefall's (its kit is the town's). */
export function isGablefall(c: Course): boolean {
  return c.kit?.id === 'gablefall';
}

/** How far over the street the town's lanes behind the rows lie (trodden snow over the cobbles). */
export const LANE = 0.3;
/** The quay at the river: its top over the ice on the town's side (the left), and on the other the river's ice running
 *  out to its far bank RIVER_FAR metres from the line's middle, where the bank rises to the town's other half. */
export const QUAY_TOP = 2.8;
export const RIVER_FAR = 62;
/** The church's nave: its roof's snow falls from the corridor's limit at NAVE_PITCH to its eave NAVE_EAVE metres past the
 *  corridor's edge, and its walls stand from the hillside under it (hillY) to that eave. */
export const NAVE_PITCH = 0.95;
export const NAVE_EAVE = 5.5;
/** The hillside the church stands on falls more gently than its nave, so the nave's east end is buried in the drift at
 *  the close and its west end, under the steeple, stands high over the hill. */
const HILL_GRADE = 0.18;

const smooth01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** The hillside's level under the church at sim z (world y): the close's level at the nave's foot, rising up the hill
 *  behind it at HILL_GRADE, never over the course's own level there. */
export function hillY(c: Course, z: number): number {
  const foot = c.baseY(NAVE_LEN);
  return Math.min(c.baseY(z) - 0.5, foot + HILL_GRADE * (NAVE_LEN - z));
}

/** Round 9 (Gablefall's world): the ground its world draws past the corridor's edges. Inside the corridor and out to its
 *  limit (where a sled is turned back) it is the sim's to the millimetre. Past it: behind a row of houses, the town's
 *  lane at the street's level (the sim's own roof carries on falling past the back eave, a slope nobody rides: drawn, it
 *  was a pit behind every row); round the squares and the quay, the paving at their level; beside the church's nave, the
 *  nave's roof falling steeply to its eave and then the hillside under it. */
export function townGround(c: Course, x: number, z: number): number {
  const y = c.ground(x, z);
  const cx = c.centerX(z);
  const hw = c.halfWidth(z);
  const dx = x - cx;
  const e = (dx < 0 ? -dx : dx) - hw;
  const lim = c.edgeLimit(z);
  if (e <= lim) return y;
  const base = c.baseY(z);
  // The lanes and the paving: the street's own level, a little over it where snow lies on them.
  const town = y + (base + LANE - y) * smooth01((e - lim) / 1.2);
  const q = placesOf(c).quay;
  if (z >= q - 24) {
    // The quay: on the town's side its wall stands sheer at the limit to its top; on the other the river's ice runs on
    // to its far bank, which rises over twenty metres.
    const k = smooth01((z - q + 24) / 24);
    const w = smooth01((e - lim) / 0.3);
    const far = (dx < 0 ? -dx : dx) - RIVER_FAR;
    const river = dx < 0 ? base + QUAY_TOP : base + (far > 0 ? 8 * smooth01(far / 22) + 0.04 * far : 0);
    return town + (y + (river - y) * w - town) * k;
  }
  if (z >= NAVE_LEN + 40) return town;
  // The nave and the hillside under it, eased out into the close over the close's first 40 m.
  const top = c.ground(cx + (dx < 0 ? -1 : 1) * (hw + lim), z);
  const hill = hillY(c, z);
  let nave = e < NAVE_EAVE ? top - NAVE_PITCH * (e - lim) : hill;
  if (e >= NAVE_EAVE && e < NAVE_EAVE + 0.6) nave = top - NAVE_PITCH * (NAVE_EAVE - lim) + (hill - top + NAVE_PITCH * (NAVE_EAVE - lim)) * smooth01((e - NAVE_EAVE) / 0.6);
  if (nave < hill) nave = hill;
  return nave + (town - nave) * smooth01((z - NAVE_LEN) / 40);
}

/** The terrain's columns Gablefall needs besides its even ones (metres across from the street's middle, both sides): a
 *  pair either side of the house fronts, of a corner drift's inner side and of the rows' backs, so each is drawn sheer
 *  (at Low's 1.6 m a house front was a snow ramp a metre and a half deep into the street). */
export function townColumns(): number[] {
  const out: number[] = [];
  for (const a of [PAVE, FRONT, BACK + 0.6]) out.push(a - 0.03, a + 0.03);
  return out;
}

/** The terrain's rows Gablefall needs in [z0, z1): a pair at each end of a roof's step (the step falls over the kit's
 *  STEP_RUN, half a metre), so a step is drawn sheer and not smeared over a whole row's spacing. */
export function townRows(c: Course, z0: number, z1: number, out: Set<number>): void {
  if (!isGablefall(c)) return;
  for (const side of [-1, 1] as const) {
    // (A row's pieces round the chunk: the row standing at its middle, and the next one past it.)
    const row = rowAt(c, side, (z0 + z1) / 2) ?? rowAt(c, side, z0) ?? rowAt(c, side, z1 - 0.01);
    if (!row) continue;
    for (const p of row.pieces) {
      if (p.z0 >= z1) break;
      for (const z of [p.z0 - 0.02, p.z0 + 0.02, p.z0 + 0.5]) if (z > z0 && z < z1) out.add(z);
    }
  }
}

/** How much of the street's cobbles show at sim z (0..1): the street and the squares are paved, the church's nave and
 *  the river's ice are not (eased in over the close's first 30 m and out onto the quay over 20 m). */
export function pavedAt(c: Course, z: number): number {
  const q = placesOf(c).quay;
  return smooth01((z - NAVE_LEN - 6) / 30) * (1 - smooth01((z - q + 4) / 20));
}

/** How much of the corridor at sim z is the river's ice (0..1): from where the quay's ice begins (gablefall.ts RIVER_ICE,
 *  20 m into the quay) on, drawn as the frozen lake is (materials.ts), black ice with blown snow lying toward its banks. */
export function riverAt(c: Course, z: number): number {
  return smooth01((z - placesOf(c).quay - 16) / 14);
}

/** The street's share across at `adx` metres from its middle: the cobbles, to a little short of their edge. */
export function streetShare(adx: number): number {
  return 1 - smooth01((adx - STREET_HW + 0.7) / 0.8);
}

/** Ground the five's forest, dressing and life keep off on Gablefall: everything past the corridor's edge on both sides
 *  (the rows' backs, the town's lanes and houses, the hillside under the church, the quay and the river), which its world
 *  dresses with its own houses. No forest grows in a town. */
export function gablefallClearings(c: Course, z0: number, z1: number, out: Clearing[]): void {
  if (!isGablefall(c)) return;
  out.push({ side: 1, e: 600, z0: z0 - 10, z1: z1 + 10, w: 610 });
  out.push({ side: -1, e: 600, z0: z0 - 10, z1: z1 + 10, w: 610 });
}
