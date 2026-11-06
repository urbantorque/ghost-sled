import { Course, type Ledge } from '../sim/course';

// What the ground is, as opposed to how high it is. The sim's ground() says how high every surface
// stands; everything here is the look laid over it, and every number past `limit` (where a sled is
// already being turned back) is free to leave the sim's ground. Inside `limit` nothing moves: what you
// see is what you ride.
//   rock        how bare the ground is, from what shaped it (a wall, a ledge's face, the fork's ridge,
//               a bridge's gorge) rather than from its slope alone: a plain bank is as steep as a ravine's
//               foot and stays snow
//   rampart     the rock a ravine's wall stands up into past the limit: low-poly, jagged along its crest
//   handover    the terrain's outer columns easing onto the mid-ground's rows round a ledge
//   standable   whether a tree or a piece of dressing can stand here at all
// Terrain, the forest, the dressing and the rails all read these, so a prop stands on what is drawn.

/** The mid-ground's row spacing (midground.ts): its surface runs straight between two rows. */
export const MID_ROW = 16;
/** Metres past the corridor's edge where the terrain starts handing over to the mid-ground's rows at a
 *  ledge, and where it has. The terrain's lower tiers end well past HANDOVER_TO. */
export const HANDOVER_FROM = 24;
export const HANDOVER_TO = 44;

/** A ravine's wall stands 13 m over the bank at its top, a tunnel's 6 (course.ts). */
const WALL_FULL = 5;
/** How far past the sim's `limit` the rock climbs, and how far back it stands before it dies away. */
const RAMPART_RISE = 4.5;
const RAMPART_BACK = 15;
/** The fork's ridge: the half-width of its rocky spine, metres. */
const SPINE = 2.2;
/** A bridge's gorge wall is bare from this slope across the fall. */
const GORGE_SLOPE = 0.85;

export const smoothK = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function hash2(ix: number, iz: number, salt: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(salt, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise2(x: number, z: number, salt: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, salt);
  const b = hash2(ix + 1, iz, salt);
  const c = hash2(ix, iz + 1, salt);
  const d = hash2(ix + 1, iz + 1, salt);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Noise that is flat on every triangle of a lattice, each cell split along its own diagonal: sampled by
 *  a fine mesh it draws a coarse low-poly surface, planes and creases, where smooth noise draws a hill.
 *  0..1, one cell per unit. */
export function facetNoise(u: number, v: number, salt: number): number {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fu = u - iu;
  const fv = v - iv;
  const a = hash2(iu, iv, salt);
  const b = hash2(iu + 1, iv, salt);
  const c = hash2(iu, iv + 1, salt);
  const d = hash2(iu + 1, iv + 1, salt);
  if (hash2(iu, iv, salt + 1) < 0.5) {
    if (fu > fv) return a + (b - a) * fu + (d - b) * fv;
    return a + (d - c) * fu + (c - a) * fv;
  }
  if (fu + fv < 1) return a + (b - a) * fu + (c - a) * fv;
  return d + (c - d) * (1 - fu) + (b - d) * (1 - fv);
}

/** How much of a wall stands at this shape (0 on plain ground, 1 in a ravine or a tunnel). */
export function wallK(wall: number): number {
  return Math.min(1, wall / WALL_FULL);
}

/** Metres past the corridor's edge of a wall's crest. */
export function crestE(limit: number): number {
  return limit + RAMPART_RISE + 2.5;
}

/** Metres the rock of a wall stands over the sim's bank, `e` past the edge on `side` at sim z: nothing
 *  inside the limit, a jagged low-poly crest past it, gone by limit + RAMPART_BACK (the forest stands
 *  behind it). `k` is wallK. */
export function rampart(z: number, e: number, side: number, k: number, limit: number): number {
  if (k <= 0 || e <= limit) return 0;
  const up = smoothK(limit, limit + RAMPART_RISE, e);
  const down = 1 - smoothK(limit + RAMPART_BACK * 0.6, limit + RAMPART_BACK, e);
  if (down <= 0) return 0;
  const s = side > 0 ? 1 : 0;
  const crest = facetNoise(z / 7.5 + s * 41, e / 4.2, 301 + s);
  const fine = facetNoise(z / 3.1 + s * 17, e / 2.3, 311 + s);
  return k * up * down * (2.5 + 11.5 * crest * crest + 2.6 * fine) * (0.55 + 0.45 * Math.min(1, k * k));
}

/** The ledge whose face holds sim z (lip to foot, with `pad` metres either way), or null. */
export function ledgeAt(c: Course, z: number, pad = 0): Ledge | null {
  for (const l of c.ledges) {
    if (z >= l.z - pad && z <= l.foot + pad) return l;
    if (l.z - pad > z) break;
  }
  return null;
}

/** Whether a row at sim z lies between two mid-ground rows with a ledge's step between them: there the
 *  terrain's outer columns take the rows' own straight line, or the mid-ground's edge would stand clear
 *  of the terrain's by up to half the step. */
export function handoverRow(c: Course, z: number): boolean {
  const a = Math.floor(z / MID_ROW) * MID_ROW;
  const b = a + MID_ROW;
  for (const l of c.ledges) {
    if (l.foot >= a && l.z <= b) return true;
    if (l.z > b) break;
  }
  return false;
}

/** How high the terrain draws at `off` metres across from the centreline at sim z, `e` past the edge, on
 *  a handover row: the sim's own y, easing onto the straight line between the two mid-ground rows round
 *  z (so at HANDOVER_TO and past it the terrain's edge is the mid-ground's). */
export function handoverY(c: Course, y: number, off: number, z: number, e: number): number {
  if (e <= HANDOVER_FROM) return y;
  const a = Math.floor(z / MID_ROW) * MID_ROW;
  const b = a + MID_ROW;
  const ya = c.ground(c.centerX(a) + off, a);
  const yb = c.ground(c.centerX(b) + off, b);
  return y + (ya + ((yb - ya) * (z - a)) / MID_ROW - y) * smoothK(HANDOVER_FROM, HANDOVER_TO, e);
}

/** The height of what is drawn at sim (x, z), before the drifts and an overlook's fall: the sim's ground,
 *  a wall's rock and a ledge's handover. What a prop past the corridor should stand on. */
export function visualGround(c: Course, x: number, z: number): number {
  const off = x - c.centerX(z);
  const e = Math.abs(off) - c.halfWidth(z);
  let y = c.ground(x, z);
  if (e <= 0) return y;
  const sh = c.shapeAt(z);
  if (sh.wall > 0) y += rampart(z, e, Math.sign(off), wallK(sh.wall), sh.limit);
  if (e > HANDOVER_FROM && handoverRow(c, z)) y = handoverY(c, y, off, z, e);
  return y;
}

/** How bare the ground is at a vertex, 0 (snow) to 1 (rock). `e` is metres past the edge (negative
 *  inside), `off` metres across from the centreline, (gx, gz) the sim ground's gradient there, `kick`
 *  whether a kicker's wedge lies here (its takeoff wall is built snow). */
export function rockWeight(ridge: number, wall: number, fall: number, limit: number, e: number, off: number, gx: number, gz: number, z: number, kick: boolean): number {
  let k = 0;
  if (wall > 0.3) {
    // A wall rises out of a snow apron drifted against its foot, its edge wandering, and the rock runs
    // to the crest, past which snow lies on the top.
    const side = off < 0 ? 0 : 1;
    const apron = 0.55 + 1.5 * vnoise2(z * 0.085, side * 3, 7);
    const crest = crestE(limit) + 1.5 + 3 * vnoise2(z * 0.05, side * 3, 9);
    k = wallK(wall) * smoothK(apron, apron + 1.1, e) * (1 - smoothK(crest, crest + 3.5, e));
  }
  if (ridge > 0.4) {
    // The fork's spine: a broken rocky crest over its snow flanks, stronger as the ridge stands up.
    // It comes and goes in outcrops, wide and narrow, never a ruled strip along the top.
    const wide = SPINE * (0.25 + 1.5 * vnoise2(z * 0.06 + off * 0.05, 2, 11));
    const spine = 1 - smoothK(wide * 0.5, wide, Math.abs(off));
    k = Math.max(k, spine * smoothK(0.45, 0.95, ridge / 3.2) * smoothK(0.42, 0.56, vnoise2(z * 0.045, 5, 13)));
  }
  if (fall > 1 && Math.abs(gx) > GORGE_SLOPE * 0.7) k = Math.max(k, smoothK(GORGE_SLOPE * 0.7, GORGE_SLOPE * 1.3, Math.abs(gx)));
  // A ledge's face, whatever it is cut into: nothing else on a course falls away this hard down the run.
  if (!kick && gz < -0.75) k = Math.max(k, smoothK(0.75, 1.15, -gz));
  return k;
}

/** Whether a tree or a piece of dressing can stand at sim (x, z), `e` past the edge: not on a wall or
 *  under its crest, not on a ledge's face. */
export function standable(c: Course, z: number, e: number): boolean {
  const sh = c.shapeAt(z);
  if (sh.wall > 0.3 && e < crestE(sh.limit) + 6) return false;
  return ledgeAt(c, z, 2.5) === null;
}
