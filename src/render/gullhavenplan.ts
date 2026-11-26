import type { Course } from '../sim/course';
import { gulliesOf } from '../sim/gullhaven';
import type { Clearing } from './dressing';

// Where Gullhaven's own world stands (round 9, notes/r9-gullhaven-world.md): what the shared systems need to know
// before its world (gullhavenworld.ts, loaded on demand) has loaded. Small and static: the sea's level, the gullies'
// clefts in the sea cliff, and the ground the five's forest and dressing keep off (the seaward side is the cliff and
// the sea; the moor is the world's own, with no forest on it).

/** Whether a course is Gullhaven's (its kit is the clifftop's). */
export function isGullhaven(c: Course): boolean {
  return c.kit?.id === 'gullhaven';
}

const SEA = new WeakMap<Course, number>();

/** The sea's level (world y): a little under the harbour's ice at the run-out's far end, the lowest ice drawn, so the
 *  harbour stands on the water and the sea lies a thousand metres under the cape's head. */
export function seaLevelOf(c: Course): number {
  let y = SEA.get(c);
  if (y === undefined) {
    y = c.ground(c.centerX(c.finishZ + 200), c.finishZ + 200) - 0.6;
    SEA.set(c, y);
  }
  return y;
}

/** How far into a gully's cleft the sea cliff is cut at z (0..1): from just short of the lip to the mouth's far end,
 *  the cleft (the geo) comes in to the seaward fence, its back wall falling at once to the sea. */
export function cleftAt(c: Course, z: number): number {
  for (const g of gulliesOf(c)) {
    if (z < g.zL - 20 || z > g.zL + g.mouth + 12) continue;
    const a = smooth(g.zL - 16, g.zL - 6, z);
    const b = 1 - smooth(g.zL + g.mouth - 8, g.zL + g.mouth + 6, z);
    return a * b;
  }
  return 0;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};

/** The old beacon's knoll on the cape's head (sim z, metres past the seaward edge, its radius): ahead and to the
 *  right of the opening's lens, against the sea. */
export const BEACON = { z: 132, e: 8, r: 9 };

/** Where the lighthouse stands (sim z): on its point past the end of the Cape, so its tower and its beam are ahead and
 *  to the right over the sea from every shelf of the Cape. */
export function lighthouseZ(c: Course): number {
  return c.layout.stages[0] + 60;
}
/** The lighthouse's point: metres past the seaward edge, and its radius. */
export const LIGHT_POINT = { e: 20, r: 22 };

/** The points of the cliff top standing out past the fence (the beacon's knoll, the lighthouse's point): sim z, metres
 *  past the edge, radius. The drawn cliff holds the cliff top's level over each (ground.ts cliffGround). */
export function pointsOf(c: Course): Array<{ z: number; e: number; r: number }> {
  return [BEACON, { z: lighthouseZ(c), ...LIGHT_POINT }];
}

/** How far a point holds the cliff top at (e past the edge, z): 1 on its top, 0 off it. */
export function pointAt(c: Course, e: number, z: number): number {
  let k = 0;
  for (const p of pointsOf(c)) {
    const dz = z - p.z;
    if (dz > p.r || dz < -p.r) continue;
    const d = Math.hypot(e - p.e, dz);
    const w = 1 - smooth(p.r * 0.72, p.r, d);
    if (w > k) k = w;
  }
  return k;
}

/** Ground the five's forest, dressing and life keep off on Gullhaven: everything past the seaward fence (the cliff and
 *  the sea), and the moor, which its world dresses with its own walls, cairns and stones (no forest stands on it).
 *  The harbour's sheds and slipway past the line are the world's too. */
export function gullhavenClearings(c: Course, z0: number, z1: number, out: Clearing[]): void {
  if (!isGullhaven(c)) return;
  out.push({ side: 1, e: 600, z0: z0 - 10, z1: z1 + 10, w: 610 });
  out.push({ side: -1, e: 600, z0: z0 - 10, z1: z1 + 10, w: 610 });
}
