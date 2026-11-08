import type { Course } from '../sim/course';
import { CHUNK_LEN } from '../sim/course';
import { type MomentCam, type MomentLight, type MomentVerb, planMoments } from '../sim/moments';

// Marquee moments: each mountain's three biggest places, one a stage, played as set pieces (round 6). Where
// they are and what each asks of you (its verb) is the sim's (src/sim/moments.ts), so every rider meets the
// same moments and a ghost's record carries how it rode them. This adds what the presentation needs: the
// lights inside each (a clean sweep is still worth saying on the way out).
//
// Pure: no DOM, render or audio imports.

export type MarqueeCam = MomentCam;
export type MarqueeLight = MomentLight;
export type { MomentVerb } from '../sim/moments';

export interface Marquee {
  /** Index down the course (0 the first). */
  index: number;
  key: string;
  name: string;
  verb: MomentVerb;
  line: string;
  cam: MarqueeCam;
  light: MarqueeLight;
  /** Where it starts and ends, metres down the course. */
  z0: number;
  z1: number;
  /** The lights it holds (what a clean sweep takes). */
  total: number;
}

function lightsIn(course: Course, z0: number, z1: number): number {
  let n = 0;
  for (let k = Math.floor(z0 / CHUNK_LEN); k <= Math.floor(z1 / CHUNK_LEN); k++) for (const l of course.chunk(k).lights) if (l.z >= z0 && l.z < z1) n++;
  return n;
}

/** The run's marquee moments, in order down the course. (`_mountain` is kept for callers: the course's seed
 *  says which mountain it is.) */
export function planMarquee(course: Course, _mountain?: string | null): Marquee[] {
  return planMoments(course).map((m) => ({ index: m.index, key: m.key, name: m.name, verb: m.verb, line: m.line, cam: m.cam, light: m.light, z0: m.z0, z1: m.z1, total: lightsIn(course, m.z0, m.z1) }));
}
