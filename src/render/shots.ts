import type { Course, SectionKind } from '../sim/course';
import { MOUNTAINS } from '../sim/mountains';

// The camera's directed shots (round 7), as data keyed to places. A shot never names a mountain in code:
// an entry says which mountain (or any), which kind of place and which of that kind down the course, and
// what the lens does there. A new mountain gets its reveal by adding a line to SHOTS; a Daily or a Cup
// gets the entries that name no mountain. camera.ts plays them; nothing here touches the sim.
//
// Pure: no DOM, render or audio imports.

/** What the lens does:
 *    wide    the held wide on a big leap: out, up and long, the valley under the rider
 *    street  the low tracking shot down a street: low, close, a step to one side
 *    reveal  a whip-pan: the look swings away for a beat, whips across onto the reveal and holds */
export type ShotKind = 'wide' | 'street' | 'reveal';

/** Where a reveal looks once it has whipped across:
 *    ahead  down the run (a valley opening under a lip): no turn, the tilt does it
 *    sun    toward the sun's disc (a dawn out of a tunnel), as far as the sightline lets it turn
 *    left, right  a landmark off to that side of the run */
export type ShotToward = 'ahead' | 'sun' | 'left' | 'right';

export interface ShotDef {
  /** A mountain's id (sim/mountains.ts), or '*' for every course. */
  mountain: string;
  /** The kind of place, and which of that kind down the course: its index, 'biggest' (a leap: the
   *  tallest) or 'any' (every one). */
  place: SectionKind;
  nth: number | 'biggest' | 'any';
  kind: ShotKind;
  /** A reveal's moment: the place's lip (a leap), its way out or its way in. */
  at?: 'lip' | 'out' | 'in';
  toward?: ShotToward;
  /** A reveal's tilt once it holds (radians, negative looks down) and how long it holds (seconds). */
  tilt?: number;
  hold?: number;
}

/** Every directed shot in the game. */
export const SHOTS: readonly ShotDef[] = [
  { mountain: '*', place: 'leap', nth: 'biggest', kind: 'wide' },
  { mountain: '*', place: 'street', nth: 'any', kind: 'street' },
  // Pinecrest's First Drop: the valley, the lake and the cloud shafts open under the lip.
  { mountain: 'pinecrest', place: 'leap', nth: 0, kind: 'reveal', at: 'lip', toward: 'ahead', tilt: -0.1, hold: 1.3 },
  // Frostfang's cavern mouth: out of the dark into the sunrise beside the Fang.
  { mountain: 'frostfang', place: 'tunnel', nth: 0, kind: 'reveal', at: 'out', toward: 'sun', tilt: 0.05, hold: 1.5 },
  // Ember's caldera: the lava lake under the leap.
  { mountain: 'ember', place: 'leap', nth: 1, kind: 'reveal', at: 'lip', toward: 'ahead', tilt: -0.14, hold: 1.3 },
  // Sakura's Blossom Leap: the cone, right of the run, over the orchard rows.
  { mountain: 'sakura', place: 'leap', nth: 1, kind: 'reveal', at: 'lip', toward: 'right', tilt: -0.05, hold: 1.4 },
];

/** A shot placed on a course (metres down it). */
export interface Shot {
  kind: ShotKind;
  /** Where it plays: a wide from a little before its lip to the end of its landing, a street its
   *  length, a reveal the spot it fires at (z0 and z1 the same). */
  z0: number;
  z1: number;
  toward: ShotToward;
  tilt: number;
  hold: number;
}

/** A course's shots, in order down it: a pure function of the course and SHOTS. */
export function planShots(course: Course, defs: readonly ShotDef[] = SHOTS): Shot[] {
  const mountain = MOUNTAINS.find((m) => m.seed >>> 0 === course.seed >>> 0)?.id ?? '';
  const secs: { kind: SectionKind; z0: number; z1: number }[] = [];
  for (let z = 0; z < course.finishZ; ) {
    const s = course.section(z);
    secs.push({ kind: s.kind, z0: s.z0, z1: s.z1 });
    z = s.z1 + 0.01;
  }
  const leaps = course.leaps;
  const out: Shot[] = [];
  for (const d of defs) {
    if (d.mountain !== '*' && d.mountain !== mountain) continue;
    const of = secs.filter((s) => s.kind === d.place);
    let picks = of;
    if (d.nth === 'biggest') {
      // (A leap's size is its ledge's: the section holding the tallest one.)
      let best = -1;
      let bh = 0;
      of.forEach((s, i) => {
        const l = leaps.find((q) => q.z >= s.z0 && q.z < s.z1);
        if (l && l.height > bh) {
          bh = l.height;
          best = i;
        }
      });
      picks = best >= 0 ? [of[best]] : [];
    } else if (d.nth !== 'any') picks = of[d.nth] ? [of[d.nth]] : [];
    for (const s of picks) {
      const lip = leaps.find((q) => q.z >= s.z0 && q.z < s.z1);
      if (d.kind === 'wide') {
        if (lip) out.push({ kind: 'wide', z0: lip.z - 30, z1: lip.land1, toward: 'ahead', tilt: 0, hold: 0 });
      } else if (d.kind === 'street') {
        out.push({ kind: 'street', z0: s.z0, z1: s.z1, toward: 'ahead', tilt: 0, hold: 0 });
      } else {
        const z = d.at === 'out' ? s.z1 : d.at === 'in' ? s.z0 : lip ? lip.z : s.z0;
        out.push({ kind: 'reveal', z0: z, z1: z, toward: d.toward ?? 'ahead', tilt: d.tilt ?? 0, hold: d.hold ?? 1.3 });
      }
    }
  }
  return out.sort((a, b) => a.z0 - b.z0);
}
