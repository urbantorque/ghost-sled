import type { Course, SectionKind } from '../sim/course';
import { namedMountain } from '../sim/moments';

// Round 7's directed shots, as data keyed to a place (ART.md 15). The chase camera plays them and the
// director names the slow hero frame; none of them takes the steering, and nothing here reaches the sim.
//
//  - 'wide': a held wide over the mountain's biggest leap (the tallest cliff on the descent), with the
//    slow hero frame at the top of its flight;
//  - 'track': a low tracking shot down the mountain's first street;
//  - 'whip': a whip-pan that lands on the mountain's reveal, the frame a player remembers it by.
//
// Pure: a function of the course, so a Daily, a Cup and a ghost's replay all get the same shots.

export type ShotKind = 'wide' | 'track' | 'whip';

export interface Shot {
  kind: ShotKind;
  /** A stable name for probes, tests and whoever scores it. */
  key: string;
  name: string;
  /** Where it may play, metres down the course. */
  z0: number;
  z1: number;
  /** A wide: its lip. A whip: the metre the pan lands on. A track: where it starts. */
  at: number;
}

interface Reveal {
  name: string;
  /** The place it is: which section of a kind down the course (0 the first), and which end of it. */
  kind: SectionKind;
  nth: number;
  /** 'lip': as the leap's lip comes up and the valley opens under it. 'end': out of the section's far end. */
  at: 'lip' | 'end';
}

/** Each mountain's reveal (ART.md 15, "the mountain's jaw-drop"). Lanternfall's is the break out under the
 *  cloud deck, its second leap (Course.cloud ends on that lip); the row plays once the mountain is in
 *  MOUNTAINS under this id. */
export const REVEALS: Readonly<Record<string, Reveal>> = {
  pinecrest: { name: 'The First Drop', kind: 'leap', nth: 0, at: 'lip' },
  frostfang: { name: 'The cavern mouth at dawn', kind: 'tunnel', nth: 0, at: 'end' },
  ember: { name: 'The caldera', kind: 'leap', nth: 1, at: 'lip' },
  sakura: { name: 'The Blossom Leap', kind: 'leap', nth: 1, at: 'lip' },
  lanternfall: { name: 'The break out of the cloud', kind: 'leap', nth: 1, at: 'lip' },
};
/** A Daily or a Cup has no authored reveal: its first leap is one. */
const REVEAL_ANY: Reveal = { name: 'The first drop', kind: 'leap', nth: 0, at: 'lip' };

/** A whip lands this far short of a lip (the valley is opening and the take-off is still to come) or of a
 *  tunnel's far end (the mouth fills the frame). */
export const WHIP_BEFORE_LIP = 26;
export const WHIP_BEFORE_END = 14;
/** A tracking shot starts this far into its street (past the blend) and runs this far. */
export const TRACK_IN = 24;
export const TRACK_LEN = 120;
/** A wide may open this far before its lip (the camera waits for the air). */
export const WIDE_RUN = 30;

interface Sec {
  kind: SectionKind;
  z0: number;
  z1: number;
}

function sectionsOf(course: Course): Sec[] {
  const out: Sec[] = [];
  for (let z = 0; z < course.finishZ; ) {
    const s = course.section(z);
    out.push({ kind: s.kind, z0: s.z0, z1: s.z1 });
    z = s.z1 + 0.01;
  }
  return out;
}

/** The run's directed shots, in order down the course. */
export function planShots(course: Course): Shot[] {
  const secs = sectionsOf(course);
  const out: Shot[] = [];
  const leaps = course.leaps;

  // The held wide: the tallest cliff (the last of equals, the one nearer the line).
  let big = -1;
  for (let i = 0; i < leaps.length; i++) if (big < 0 || leaps[i].height >= leaps[big].height) big = i;
  if (big >= 0) {
    const l = leaps[big];
    out.push({ kind: 'wide', key: 'bigleap', name: 'The biggest leap', z0: l.z - WIDE_RUN, z1: l.land1, at: l.z });
  }

  // The tracking shot: the first street long enough to hold it.
  const street = secs.find((s) => s.kind === 'street' && s.z1 - s.z0 >= TRACK_IN + 60 && s.z0 + TRACK_IN < course.finishZ - 80);
  if (street) {
    const z0 = street.z0 + TRACK_IN;
    out.push({ kind: 'track', key: 'street', name: 'Down the street', z0, z1: Math.min(street.z1 - 10, z0 + TRACK_LEN), at: z0 });
  }

  // The whip-pan onto the reveal.
  const r = REVEALS[namedMountain(course.seed) ?? ''] ?? REVEAL_ANY;
  let seen = 0;
  const sec = secs.find((s) => s.kind === r.kind && seen++ === r.nth);
  if (sec) {
    const lip = r.at === 'lip' ? leaps.find((l) => l.z >= sec.z0 && l.z < sec.z1) : undefined;
    const at = lip ? lip.z - WHIP_BEFORE_LIP : r.at === 'end' ? sec.z1 - WHIP_BEFORE_END : NaN;
    if (Number.isFinite(at)) out.push({ kind: 'whip', key: 'reveal', name: r.name, z0: at - 70, z1: at + 45, at });
  }
  return out.sort((a, b) => a.z0 - b.z0);
}
