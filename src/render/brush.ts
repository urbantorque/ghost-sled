import { Vector3, type Camera } from 'three';

// Where a near miss's burst goes so the chase lens sees it. The sim resolves a near miss once the sled
// is a radius and 1.5 m past the hazard, so by the time the beat lands the hazard itself stands beside
// or behind the lens: snow thrown off its boughs there was mostly out of the picture (two puffs at the
// top of the frame for a pine, nothing at all for a spire's or a lava rock's grit). The burst you see
// is set beside the rider on the side you shaved and a little ahead of it, and pulled in toward the
// rider until it sits inside the frame (a phone's narrow portrait frame pulls it in furthest).

/** How far ahead of the sled, along its travel, the burst is set (m). */
export const BRUSH_LEAD = 1.2;
/** How far out to the side you shaved (m), before the frame pulls it in. */
export const BRUSH_LAT = 1.6;
/** The closest it is pulled in (m): about the rider's own half-width plus a hand, so it never sits on it. */
export const BRUSH_LAT_MIN = 0.7;
/** The furthest off centre its middle may sit, in normalised device x (1 is the frame's edge). */
export const BRUSH_NDC = 0.74;
/** The burst's middle, above the snow, that the frame test projects (m). */
const MID_Y = 1;

const probe = new Vector3();

export interface BrushSled {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

/**
 * Fills `at` with the burst's point on the snow (three.js space, z flipped) and `toward` with the level
 * unit direction from it back toward the rider's line, for a near miss of the hazard at sim (hx, hz).
 * `ground(x, z)` is the snow's height at a sim point; `eye` the chase lens (its matrices as last drawn),
 * or null to skip the frame test. Returns the lateral distance used.
 */
export function brushPoint(s: BrushSled, hx: number, hz: number, ground: (x: number, z: number) => number, eye: Camera | null, at: Vector3, toward: Vector3): number {
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
  const sx = s.x;
  const sz = -s.z;
  let lat = BRUSH_LAT;
  for (let i = 0; i < 6; i++) {
    const px = sx + rx * side * lat + fx * BRUSH_LEAD;
    const pz = sz + rz * side * lat + fz * BRUSH_LEAD;
    at.set(px, ground(px, -pz), pz);
    if (!eye || lat <= BRUSH_LAT_MIN) break;
    probe.set(px, at.y + MID_Y, pz).project(eye);
    if (Math.abs(probe.x) <= BRUSH_NDC) break;
    lat = Math.max(BRUSH_LAT_MIN, lat * 0.8);
  }
  return lat;
}
