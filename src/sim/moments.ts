import type { Course, SectionKind } from './course';
import { MOUNTAINS } from './mountains';

// Set pieces (round 6): each mountain's three biggest places, one a stage, each with a verb of its own that
// the sim plays, so every rider (a ghost too) meets the same moments and its record carries how it went.
//   race      a machine (a cable car, a ropeway gondola, an ore train, a cableway car) leaves its station as
//             the rider arrives; beat it to the far end
//   gates     a slalom of lantern gates down a street or a cavern, set about a beat apart at cruise; ride
//             through every one in order
//   rings     three rings of light along a big leap's flight; hit the lip in line and at speed
//   collapse  the snow and ice of a span fall in behind the rider; stay ahead of the fall
//   steps     a terrace's steps; land every one perfectly
// This file names them and says where they are. What happens in them is the sim's (sim.ts).
//
// Pure: no DOM, render or audio imports.

export type MomentVerb = 'race' | 'gates' | 'rings' | 'collapse' | 'steps';
/** How the lens frames it: out and up over a drop ('wide'), low and close down a street or a tube
 *  ('low'), or off to one side across a span or beside a machine ('side'). */
export type MomentCam = 'wide' | 'low' | 'side';
/** A light beat the world plays with it (palette and post): a burst of morning light out of a tube, the
 *  aurora breaking, the lanterns of a festival street, embers off the caldera, petals. */
export type MomentLight = 'dawn' | 'aurora' | 'lanterns' | 'embers' | 'petals' | null;

interface Def {
  key: string;
  name: string;
  verb: MomentVerb;
  /** The place it is, and which of that kind down the course (0 the first). */
  kind: SectionKind;
  nth: number;
  /** It runs on through the next sections too (a ravine into its bridge). */
  through?: number;
  cam: MomentCam;
  light?: MomentLight;
  /** What to play: one line, said as it comes up. */
  line: string;
}

/** The named mountains' set pieces, one a stage, in order down each descent (DECISIONS 240). */
const AUTHORED: Record<string, readonly Def[]> = {
  pinecrest: [
    { key: 'firstdrop', name: 'The First Drop', verb: 'rings', kind: 'leap', nth: 0, cam: 'wide', line: 'Fly all three rings' },
    { key: 'mirror', name: 'Mirror Lake', verb: 'race', kind: 'lake', nth: 0, cam: 'side', line: 'Beat the cable car across the ice' },
    { key: 'oldtown', name: 'Old Town', verb: 'gates', kind: 'bridge', nth: 0, through: 1, cam: 'low', light: 'lanterns', line: 'Thread every lantern gate' },
  ],
  frostfang: [
    { key: 'seracgate', name: 'Serac Gate', verb: 'collapse', kind: 'bridge', nth: 0, cam: 'side', line: 'Outrun the span as it falls' },
    { key: 'crevasse', name: 'The Crevasse Fields', verb: 'race', kind: 'ravine', nth: 1, through: 1, cam: 'side', light: 'aurora', line: 'Race the ropeway down the crevasse' },
    { key: 'cavern', name: 'The Ice Cavern', verb: 'gates', kind: 'tunnel', nth: 0, through: 1, cam: 'low', light: 'dawn', line: 'Follow the lanterns out to the dawn' },
  ],
  ember: [
    { key: 'cindergate', name: 'Cinder Gate', verb: 'race', kind: 'tunnel', nth: 0, cam: 'side', light: 'embers', line: 'Beat the ore train through the mountain' },
    { key: 'caldera', name: 'The Caldera Leap', verb: 'rings', kind: 'leap', nth: 1, cam: 'wide', light: 'embers', line: 'Fly all three rings over the caldera' },
    { key: 'emberstreet', name: 'Ash Market', verb: 'gates', kind: 'street', nth: 0, cam: 'low', light: 'lanterns', line: 'Thread the lantern gates to the line' },
  ],
  sakura: [
    { key: 'petals', name: 'Petal Steps', verb: 'steps', kind: 'terraces', nth: 0, cam: 'wide', light: 'petals', line: 'Stomp every step' },
    { key: 'blossomleap', name: 'The Blossom Leap', verb: 'rings', kind: 'leap', nth: 1, cam: 'wide', light: 'petals', line: 'Fly all three rings over the orchards' },
    { key: 'temple', name: 'Temple Town', verb: 'gates', kind: 'street', nth: 1, cam: 'low', light: 'lanterns', line: 'Thread the lantern gates to the square' },
  ],
};

/** A Daily or a Cup has no authored moments: each stage's biggest place, in this order of preference. */
const PICK: ReadonlyArray<{ kind: SectionKind; verb: MomentVerb; cam: MomentCam; light: MomentLight; name: string; line: string }> = [
  { kind: 'street', verb: 'gates', cam: 'low', light: 'lanterns', name: 'The Lantern Street', line: 'Thread every lantern gate' },
  { kind: 'lake', verb: 'race', cam: 'side', light: null, name: 'The Frozen Lake', line: 'Beat the cable car across the ice' },
  { kind: 'leap', verb: 'rings', cam: 'wide', light: null, name: 'The Big Leap', line: 'Fly all three rings' },
  { kind: 'bridge', verb: 'collapse', cam: 'side', light: null, name: 'The Span', line: 'Outrun the span as it falls' },
  { kind: 'tunnel', verb: 'gates', cam: 'low', light: 'dawn', name: 'The Tunnel', line: 'Follow the lanterns out to the light' },
  { kind: 'terraces', verb: 'steps', cam: 'wide', light: null, name: 'The Terraces', line: 'Stomp every step' },
];

export interface MomentSpec {
  /** Index down the course (0 the first). */
  index: number;
  key: string;
  name: string;
  verb: MomentVerb;
  line: string;
  cam: MomentCam;
  light: MomentLight;
  /** Where it starts and ends, metres down the course. */
  z0: number;
  z1: number;
  /** Which stage it belongs to. */
  stage: number;
}

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

/** The named mountain a seed is, or null for a Daily or a Cup. */
export function namedMountain(seed: number): string | null {
  return MOUNTAINS.find((m) => m.seed >>> 0 === seed >>> 0)?.id ?? null;
}

/** The run's set pieces, in order down the course: a pure function of the course. */
export function planMoments(course: Course): MomentSpec[] {
  const secs = sectionsOf(course);
  const out: MomentSpec[] = [];
  const make = (i: number, d: Omit<Def, 'kind' | 'nth'>): void => {
    const a = secs[i];
    const b = secs[Math.min(secs.length - 1, i + (d.through ?? 0))];
    // A leap's moment is its run to the lip, its flight and its landing; a place's, its body (from its
    // blend) to its end.
    const lip = a.kind === 'leap' ? course.leaps.find((l) => l.z >= a.z0 && l.z < a.z1) : undefined;
    const z0 = lip ? Math.max(a.z0, lip.z - 40) : a.z0;
    const z1 = lip ? Math.min(a.z1, lip.land1 + 30) : b.kind === 'finish' ? b.z0 : b.z1;
    out.push({ index: 0, key: d.key, name: d.name, verb: d.verb, line: d.line, cam: d.cam, light: d.light ?? null, z0, z1, stage: course.stageAt(z0).index });
  };
  const authored = AUTHORED[namedMountain(course.seed) ?? ''];
  if (authored) {
    for (const d of authored) {
      let seen = 0;
      const i = secs.findIndex((s) => s.kind === d.kind && seen++ === d.nth);
      if (i >= 0) make(i, d);
    }
  } else {
    // Each stage's biggest place, past the first 500 m and short of the square, with a verb the run has not
    // played yet where the stage has one.
    const used = new Set<MomentVerb>();
    for (const st of course.stages) {
      let pick: { i: number; p: (typeof PICK)[number]; rank: number } | null = null;
      for (let i = 0; i < secs.length; i++) {
        const s = secs[i];
        if (s.z0 < Math.max(500, st.z0) || s.z0 >= st.z1 || s.z1 > course.finishZ - 120) continue;
        const k = PICK.findIndex((q) => q.kind === s.kind);
        if (k < 0) continue;
        const rank = k + (used.has(PICK[k].verb) ? PICK.length : 0);
        if (pick && pick.rank <= rank) continue;
        pick = { i, p: PICK[k], rank };
      }
      if (pick) {
        used.add(pick.p.verb);
        make(pick.i, { key: `${pick.p.kind}${pick.i}`, name: pick.p.name, verb: pick.p.verb, line: pick.p.line, cam: pick.p.cam, light: pick.p.light });
      }
    }
  }
  out.sort((a, b) => a.z0 - b.z0);
  out.forEach((m, i) => (m.index = i));
  return out;
}
