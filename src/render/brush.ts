import { Vector3, type Camera } from 'three';

// Where a near miss's burst goes so the chase lens sees it. The sim resolves a near miss once the sled
// is a radius and 1.5 m past the hazard, so by the time the beat lands the hazard itself stands beside
// or behind the lens: snow thrown off its boughs there was mostly out of the picture (two puffs at the
// top of the frame for a pine, nothing at all for a spire's or a lava rock's grit). The burst you see
// is set beside the rider on the side you shaved and a little ahead of it, and pulled in toward the
// rider until it sits inside the frame (a phone's narrow portrait frame pulls it in furthest).
//
// The sim grades a near miss on the level gap alone, so one also lands in the air, shaved high over a
// hazard's edge. The lens rides with the rider, so a burst left on the snow below is out of the bottom
// of the frame (its middle at ndc y -2.4 from 13.6 m up, -0.84 from 3.5 m). A tree's boughs reach up
// past the rider: its burst rises with the rider (as on the ground, at the rider's own runners), up to
// the crown. Grit is kicked off a hazard's foot and stays on the snow. A rider more than BRUSH_CLEAR
// over what the hazard can throw (2 m over a rock, clear over a tree's top) shook nothing loose: no
// burst, the callout alone. So does one whose burst would still sit under the frame's foot.

/** How far ahead of the sled, along its travel, the burst is set (m). */
export const BRUSH_LEAD = 1.2;
/** How far out to the side you shaved (m), before the frame pulls it in. */
export const BRUSH_LAT = 1.6;
/** The closest it is pulled in (m): about the rider's own half-width plus a hand, so it never sits on it. */
export const BRUSH_LAT_MIN = 0.7;
/** The furthest off centre its middle may sit, in normalised device x (1 is the frame's edge). */
export const BRUSH_NDC = 0.74;
/** The lowest its middle may sit, in normalised device y (-1 is the frame's foot); lower is skipped. */
export const BRUSH_NDC_Y = -0.85;
/** The highest a tree's burst is lifted with an airborne rider (m over the snow): its snow then comes
 *  off at about 4.4 to 5.6 m, inside a 5.5 to 6.5 m crown. Grit is not lifted (0). */
export const BRUSH_REACH_BOUGH = 3.5;
/** How far over a hazard's reach the rider may be (m) and still shake a burst loose. */
export const BRUSH_CLEAR = 2;
/** The burst's middle, above the snow, that the frame test projects (m). */
const MID_Y = 1;

const probe = new Vector3();

export interface BrushSled {
  x: number;
  /** Height (sim y); left out, the sled is taken as on the snow. */
  y?: number;
  z: number;
  vx: number;
  vz: number;
}

/**
 * Fills `at` with the burst's point (three.js space, z flipped: on the snow, or lifted toward an
 * airborne rider by up to `reach`) and `toward` with the level unit direction from it back toward the
 * rider's line, for a near miss of the hazard at sim (hx, hz). `ground(x, z)` is the snow's height at a
 * sim point; `eye` the chase lens (its matrices as last drawn), or null to skip the frame test;
 * `reach` how high (m over the snow) the hazard can throw its burst (BRUSH_REACH_BOUGH for a tree, 0
 * for grit). Returns the lateral distance used, or 0 when there is no burst to throw (the rider is
 * more than BRUSH_CLEAR over the reach, or the burst's middle would sit under the frame).
 */
export function brushPoint(s: BrushSled, hx: number, hz: number, ground: (x: number, z: number) => number, eye: Camera | null, at: Vector3, toward: Vector3, reach = 0): number {
  // Travel direction in three.js space (vx, -vz); nearly stopped, straight downhill.
  const l = Math.hypot(s.vx, s.vz);
  const fx = l > 0.5 ? s.vx / l : 0;
  const fz = l > 0.5 ? -s.vz / l : -1;
  // Right of travel, level: (-fz, fx). The hazard's side of the sled's line.
  const rx = -fz;
  const rz = fx;
  const dot = (hx - s.x) * rx + -(hz - s.z) * rz;
  const side = dot >= 0 ? 1 : -1;
  toward.set(-rx * side, 0, -rz * side);
  // The rider's height over the snow under it: in the air the burst rises with it, up to the reach.
  const rise = s.y === undefined ? 0 : Math.max(0, s.y - ground(s.x, s.z));
  if (rise > Math.max(0, reach) + BRUSH_CLEAR) return 0;
  const lift = Math.min(rise, Math.max(0, reach));
  const sx = s.x;
  const sz = -s.z;
  let lat = BRUSH_LAT;
  for (let i = 0; i < 6; i++) {
    const px = sx + rx * side * lat + fx * BRUSH_LEAD;
    const pz = sz + rz * side * lat + fz * BRUSH_LEAD;
    at.set(px, ground(px, -pz) + lift, pz);
    if (!eye || lat <= BRUSH_LAT_MIN) break;
    probe.set(px, at.y + MID_Y, pz).project(eye);
    if (Math.abs(probe.x) <= BRUSH_NDC) break;
    lat = Math.max(BRUSH_LAT_MIN, lat * 0.8);
  }
  if (eye && rise > 0) {
    // Still under the frame's foot (a rider high over a short tree, a lens pitched up on a kicker).
    probe.set(at.x, at.y + MID_Y, at.z).project(eye);
    if (probe.y < BRUSH_NDC_Y) return 0;
  }
  return lat;
}
