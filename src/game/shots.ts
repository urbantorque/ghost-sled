import type { Course, SectionKind } from '../sim/course';
import { namedMountain } from '../sim/moments';

// Round 7's directed shots, as data keyed to a place (ART.md 15). The chase camera plays them and the
// director names the slow hero frame; none of them takes the steering, and nothing here reaches the sim.
//
//  - 'wide': a held wide over the mountain's biggest leap (the tallest cliff on the descent), with the
//    slow hero frame at the top of its flight;
//  - 'track': a low tracking shot down the mountain's first street;
//  - 'whip': a whip-pan that lands on the mountain's reveal, the frame a player remembers it by.
//  - 'place' (round 8, the compose lane): a lens that is not the chase's for the first seconds of the opening and of
//    each stage start's threshold, each mountain's own (PLACE_LENS): Pinecrest high over the valley side, Frostfang
//    low in the canyon looking up at its arch, Ember beside the ridge with the fall below, Sakura over the terraces
//    stepping down, Lanternfall high on the crest with the cloud on both sides. It hands back to the chase inside
//    about three seconds, gives way in the air and in a tumble, and under reduced motion only its letterbox plays.
//
// Pure: a function of the course, so a Daily, a Cup and a ghost's replay all get the same shots.

export type ShotKind = 'wide' | 'track' | 'whip' | 'place';

/** A place shot's lens, in the rider's frame at full weight: metres back, up and aside, and where it looks: metres
 *  ahead of the rider, up from it and aside toward the open side; degrees added to the lens. */
export interface PlaceLens {
  back: number;
  up: number;
  /** Metres aside: toward the open side when `toOpen`, else toward the place's stand side. */
  aside: number;
  toOpen: boolean;
  ahead: number;
  lookUp: number;
  lookAside: number;
  fov: number;
}

/** Each biome's opening and stage-start lens (the compose lane's places, render/compose.ts). The lenses that look
 *  over a bank stand 8 to 11 m up: the sim's bank stands 9.5 m by the limit, and a lens under its crest saw only the
 *  bank (Ember's ridge at 3.6 m showed its own bank, not the fall). */
export const PLACE_LENS: Readonly<Partial<Record<string, PlaceLens>>> = {
  alpine: { back: 8, up: 11, aside: 4, toOpen: true, ahead: 34, lookUp: -6, lookAside: 8, fov: 4 },
  glacier: { back: 4.4, up: 0.55, aside: 0, toOpen: false, ahead: 30, lookUp: 9, lookAside: 0, fov: 7 },
  // (Ember's ridge has none: from over the fall the rider was a figure in the frame's corner, and a critic on stills
  // chose the chase's big rider under the cone every time.)
  blossom: { back: 7, up: 10, aside: 4, toOpen: true, ahead: 30, lookUp: -6, lookAside: 5, fov: 4 },
  lantern: { back: 8, up: 8, aside: 0, toOpen: false, ahead: 40, lookUp: -6, lookAside: 0, fov: 6 },
};
/** The shoulder lenses (the default): close behind and low on the side away from the open one, so the rider stands big
 *  in the foreground (as big as the chase has it) and the place opens past its shoulder: Pinecrest's fall and the
 *  valley, Frostfang's arch over the slot (looking up), Ember's fall toward the lava, Sakura's terraces, Lanternfall's
 *  cloud. A negative `aside` with `toOpen` stands the lens on the far side from the open one. */
export const PLACE_SHOULDER: Readonly<Partial<Record<string, PlaceLens>>> = {
  alpine: { back: 2.8, up: 1.25, aside: -1.7, toOpen: true, ahead: 20, lookUp: -0.6, lookAside: 7, fov: 2 },
  glacier: { back: 2.9, up: 0.7, aside: 0, toOpen: false, ahead: 22, lookUp: 6, lookAside: 0, fov: 4 },
  volcanic: { back: 2.8, up: 1.25, aside: -1.7, toOpen: true, ahead: 20, lookUp: -0.2, lookAside: 6, fov: 2 },
  blossom: { back: 2.8, up: 1.3, aside: -1.7, toOpen: true, ahead: 20, lookUp: -0.4, lookAside: 7, fov: 2 },
  lantern: { back: 2.8, up: 1.4, aside: -1.5, toOpen: true, ahead: 22, lookUp: -0.8, lookAside: 5, fov: 2 },
};
/** Whether the openings take the high lenses (PLACE_LENS, the second pass, 6 of 10 on stills) instead of the
 *  shoulder ones. Kept to compare. */
export const PLACE_HIGH = false;
/** A place shot starts this far into the opening's first section after the start (none) or into a stage line's
 *  threshold (past its blend, so the charm gate is ahead in the frame), and lasts this many metres: about three
 *  seconds at 30 m/s, the last of them easing back to the chase. */
export const PLACE_IN_OPEN = 0;
export const PLACE_IN_STAGE = 40;
export const PLACE_LEN = 100;
/** Whether the stage starts get a place shot too. Off: just past a threshold the charm gates' gantry crosses the
 *  run, and from a lens over the open side its beam and lantern string cut the frame in two (the fourth critic on
 *  stills, both stage starts it saw); the composed banks there stand without a shot. */
export const PLACE_STAGES = false;

export interface Shot {
  kind: ShotKind;
  /** A stable name for probes, tests and whoever scores it. */
  key: string;
  name: string;
  /** Where it may play, metres down the course. */
  z0: number;
  z1: number;
  /** A wide: its lip. A whip: the metre the pan lands on. A track: where it starts. A place: where it starts. */
  at: number;
  /** A place: its lens, and the sides the composed place stands and opens on (+1 toward three.js +x; 0 none),
   *  which the world fills in from the place (render/compose.ts ComposePlan.sideShots). */
  lens?: PlaceLens;
  open?: number;
  stand?: number;
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
  // The places: the opening, then each stage start's threshold.
  const lens = (PLACE_HIGH ? PLACE_LENS : PLACE_SHOULDER)[course.biome];
  if (lens) {
    const first = secs[0];
    if (first && first.kind === 'start') out.push({ kind: 'place', key: 'opening', name: 'The opening', z0: first.z1 + PLACE_IN_OPEN, z1: first.z1 + PLACE_IN_OPEN + PLACE_LEN, at: first.z1 + PLACE_IN_OPEN, lens });
    let n = 0;
    for (let z = 0; PLACE_STAGES && z < course.finishZ; ) {
      const sec = course.section(z);
      if (sec.gate) {
        n++;
        const z0 = sec.z0 + PLACE_IN_STAGE;
        out.push({ kind: 'place', key: 'stage' + n, name: 'Stage ' + (n + 1), z0, z1: Math.min(sec.z1, z0 + PLACE_LEN), at: z0, lens });
      }
      z = sec.z1 + 0.01;
    }
  }
  return out.sort((a, b) => a.z0 - b.z0);
}
