import type { Course, SectionKind } from '../sim/course';
import { CHUNK_LEN } from '../sim/course';

// Marquee moments (round 5): each mountain's biggest places, played as set pieces. A moment has a name, a
// camera beat that frames it without taking the steering, a swell in the music, and a line of lights to
// ride through it (course.ts lays a line through every place, and over every leap). Its score is what you
// took of those lights, and whether you came through clean. Every rider meets the same moments: they are
// the course's places, read from its sections, so nothing here touches a run.
//
// Pure: no DOM, render or audio imports.

/** How the lens frames it: out and up over a drop ('wide'), low and close down a street or a tube
 *  ('low'), or off to one side across a span ('side'). */
export type MarqueeCam = 'wide' | 'low' | 'side';
/** A light beat the world plays with it (palette and post): a burst of morning light out of a tube, the
 *  aurora breaking over the last straight, the lanterns of a festival street, embers off the caldera. */
export type MarqueeLight = 'dawn' | 'aurora' | 'lanterns' | 'embers' | 'petals' | null;

interface Def {
  key: string;
  name: string;
  /** The place it is, and which of that kind down the course (0 the first). */
  kind: SectionKind;
  nth: number;
  /** It runs on through the next section too (a tunnel into a bridge). */
  through?: number;
  cam: MarqueeCam;
  light?: MarqueeLight;
  /** What to play: one line, said as it comes up. */
  line: string;
}

/** The named mountains' set pieces, in order down each descent (DECISIONS 220). */
const AUTHORED: Record<string, readonly Def[]> = {
  pinecrest: [
    { key: 'firstdrop', name: 'The First Drop', kind: 'leap', nth: 0, cam: 'wide', line: 'Hold a straight line through the air' },
    { key: 'mirror', name: 'Mirror Lake', kind: 'lake', nth: 0, cam: 'wide', line: 'Swing the lights across the ice' },
    { key: 'oldtown', name: 'Old Town', kind: 'bridge', nth: 0, through: 1, cam: 'low', light: 'lanterns', line: 'Weave the lanterns down the street' },
    { key: 'valley', name: 'The Valley Leap', kind: 'leap', nth: 2, cam: 'wide', light: 'dawn', line: 'Take the whole valley in one flight' },
  ],
  frostfang: [
    { key: 'seracgate', name: 'Serac Gate', kind: 'ravine', nth: 0, through: 1, cam: 'low', line: 'Thread the ice, then cross the crevasse' },
    { key: 'crevasse', name: 'The Crevasse Fields', kind: 'bridge', nth: 1, cam: 'side', line: 'Hold the span' },
    { key: 'cavern', name: 'The Ice Cavern', kind: 'tunnel', nth: 0, through: 1, cam: 'low', light: 'dawn', line: 'Burst out into the light' },
    { key: 'aurora', name: 'Aurora Straight', kind: 'leap', nth: 2, cam: 'wide', light: 'aurora', line: 'The last leap, under the lights' },
  ],
  ember: [
    { key: 'cindergate', name: 'Cinder Gate', kind: 'tunnel', nth: 0, cam: 'low', light: 'embers', line: 'Through the mountain' },
    { key: 'caldera', name: 'The Caldera Leap', kind: 'leap', nth: 1, cam: 'wide', light: 'embers', line: 'Fly the caldera' },
    { key: 'halls', name: 'Basalt Halls', kind: 'tunnel', nth: 1, through: 1, cam: 'low', light: 'embers', line: 'Out of the halls and over the span' },
    { key: 'emberstreet', name: 'Ash Market', kind: 'street', nth: 0, cam: 'low', light: 'lanterns', line: 'Weave the lanterns to the line' },
  ],
  sakura: [
    { key: 'petals', name: 'Petal Steps', kind: 'terraces', nth: 0, through: 1, cam: 'wide', light: 'petals', line: 'Step down the terraces into town' },
    { key: 'torii', name: 'The Thousand Torii', kind: 'tunnel', nth: 0, through: 1, cam: 'low', light: 'petals', line: 'Through the gates and over the gorge' },
    { key: 'blossomleap', name: 'The Blossom Leap', kind: 'leap', nth: 1, cam: 'wide', light: 'petals', line: 'Over the orchards' },
    { key: 'temple', name: 'Temple Town', kind: 'street', nth: 1, cam: 'low', light: 'lanterns', line: 'Under the lanterns to the square' },
  ],
};

/** A Daily or a Cup has no authored moments: its biggest places, a kilometre or so apart. */
const PICK: ReadonlyArray<{ kind: SectionKind; cam: MarqueeCam; light: MarqueeLight; name: string; line: string }> = [
  { kind: 'tunnel', cam: 'low', light: 'dawn', name: 'The Tunnel', line: 'Burst out into the light' },
  { kind: 'bridge', cam: 'side', light: null, name: 'The Span', line: 'Hold the span' },
  { kind: 'lake', cam: 'wide', light: null, name: 'The Frozen Lake', line: 'Swing the lights across the ice' },
  { kind: 'street', cam: 'low', light: 'lanterns', name: 'The Lantern Street', line: 'Weave the lanterns' },
  { kind: 'leap', cam: 'wide', light: null, name: 'The Big Leap', line: 'Hold a straight line through the air' },
  { kind: 'ravine', cam: 'low', light: null, name: 'The Ravine', line: 'Thread the walls' },
];

export interface Marquee {
  key: string;
  name: string;
  line: string;
  cam: MarqueeCam;
  light: MarqueeLight;
  /** Where it starts and ends, metres down the course. */
  z0: number;
  z1: number;
  /** The lights it holds (what a clean sweep takes). */
  total: number;
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

function lightsIn(course: Course, z0: number, z1: number): number {
  let n = 0;
  for (let k = Math.floor(z0 / CHUNK_LEN); k <= Math.floor(z1 / CHUNK_LEN); k++) for (const l of course.chunk(k).lights) if (l.z >= z0 && l.z < z1) n++;
  return n;
}

/** The run's marquee moments, in order down the course. `mountain`: a named mountain's id, else null. */
export function planMarquee(course: Course, mountain: string | null): Marquee[] {
  const secs = sectionsOf(course);
  const out: Marquee[] = [];
  const make = (i: number, d: { key: string; name: string; line: string; cam: MarqueeCam; light?: MarqueeLight; through?: number }): void => {
    const a = secs[i];
    const b = secs[Math.min(secs.length - 1, i + (d.through ?? 0))];
    // A leap's moment is its flight and landing; a place's, its body (from its blend) to its end.
    const z0 = a.kind === 'leap' ? Math.max(a.z0, (course.leaps.find((l) => l.z >= a.z0 && l.z < a.z1)?.z ?? a.z0) - 40) : a.z0;
    const z1 = b.kind === 'finish' ? b.z0 : b.z1;
    out.push({ key: d.key, name: d.name, line: d.line, cam: d.cam, light: d.light ?? null, z0, z1, total: lightsIn(course, z0, z1) });
  };
  const authored = mountain ? AUTHORED[mountain] : undefined;
  if (authored) {
    for (const d of authored) {
      let seen = 0;
      const i = secs.findIndex((s) => s.kind === d.kind && seen++ === d.nth);
      if (i >= 0) make(i, d);
    }
  } else {
    // The biggest places, the first past 600 m, about a kilometre apart.
    let next = 600;
    for (let i = 0; i < secs.length; i++) {
      const s = secs[i];
      if (s.z0 < next) continue;
      const p = PICK.find((q) => q.kind === s.kind);
      if (!p) continue;
      make(i, { key: `${p.kind}${i}`, name: p.name, line: p.line, cam: p.cam, light: p.light });
      next = s.z1 + 850;
    }
  }
  return out.sort((a, b) => a.z0 - b.z0);
}
