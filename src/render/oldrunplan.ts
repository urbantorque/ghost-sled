import type { Course } from '../sim/course';
import type { Clearing } from './dressing';

// Where the Old Run's own places stand (round 9, notes/r9-oldrun-world.md): what the world built on demand
// (oldrunworld.ts) builds there, and what the forest, laid before that module has loaded, keeps clear of. Small and
// static, so the first chunk of forest already stands back from the hotel.

/** The grand hotel: on the right of the start house's straight, its three blocks stepping down the slope beside the
 *  track, its facade toward the low sun on the left (sim z from FROM to TO, its front FRONT metres past the lip, its
 *  depth DEEP). */
export const HOTEL = { side: 1 as const, from: 14, to: 112, front: 17, deep: 17 };
/** The start house over the track's first metres (sim z). */
export const START_HOUSE = { z0: -9, z1: 7 };
/** The timing house beside the finish line, on the left, past the crest. */
export const TIMING = { side: -1 as const, e: 9 };

/** Whether a course is the Old Run's (its kit is the track's). */
export function isOldRun(c: Course): boolean {
  return c.kit?.id === 'oldrun';
}

/** Ground the Old Run's places keep clear of the forest (props.ts asks through world.ts): the hotel and its terrace,
 *  and the timing house's yard. */
export function oldrunClearings(c: Course, z0: number, z1: number, out: Clearing[]): void {
  if (!isOldRun(c)) return;
  if (z0 < HOTEL.to + 20 && z1 > HOTEL.from - 30) out.push({ side: HOTEL.side, e: HOTEL.front + HOTEL.deep * 0.5, z0: HOTEL.from - 24, z1: HOTEL.to + 14, w: HOTEL.deep * 0.5 + HOTEL.front - 1 });
  const fz = c.finishZ;
  if (z0 < fz + 40 && z1 > fz - 40) out.push({ side: TIMING.side, e: TIMING.e + 6, z0: fz - 22, z1: fz + 26, w: 10 });
}
