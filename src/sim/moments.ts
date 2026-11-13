import { type ChaosRoll, moodInfo } from './chaos';
import type { Course, Ledge, Obstacle, SectionKind, SkyGate } from './course';
import { PI, TAU, dsin } from './dmath';
import { MOUNTAINS } from './mountains';
import { hash32 } from './prng';

// Set pieces: each mountain's three biggest places, one a stage, each with a verb of its own that the sim plays,
// so every rider (a ghost too) meets the same moments and its record carries how it went.
//
// Round 7 (DECISIONS 277, notes/r7-moments.md). Twelve verbs over fifteen set pieces: none appears more than
// twice in the game, a mountain's three are three different verbs, and where one appears twice the two play
// differently (its `style`). Each set piece has two or three seeded variants, picked from the run's own roll
// (variantOf), so a ghost rides the variant of its own run and a replay meets the same one. One or two legend
// moments a mountain ride on the roll too (ChaosRoll.legend).
//   rings     three rings of light along a big leap's flight; hit the lip in line and at speed
//   slide     hold one long drift across glass ice
//   shatter   pop, and be up in the air under each bell hung over the run, as high as it hangs (and no higher,
//             where a bell hangs under a beam). The action button's, not the steering's
//   collapse  the snow and ice of a span fall in; stay ahead of the fall
//   race      a machine on its cable: 'sprint', it leaves as the rider arrives and the far end decides it;
//             'chase', it left before the rider and passing it wins
//   gates     a slalom of lantern gates, through every one in order: 'sit', they hang still and the rider
//             weaves; 'swing', each sways across the run and the rider reads it
//   surge     leave a leap's lip at a speed or better and clear to its far shelf (what a dash is for)
//   steps     stomp landings: 'stair', the ones a terrace's steps give; 'hops', the ones the rider's own pops
//             make down a street
//   flourish  land a named trick clean over a leap (the stunt rider's)
//   follow    stay in the wake of a guide light that weaves through the cloud (Lanternfall)
//   kindle    ride close along rows of unlit stone lamps to light them, on both sides of the road (Lanternfall)
//   carry     take a flame at the shrine and bring it to the great lantern at the line; it burns down, and a hit
//             gutters it (Lanternfall)
// This file names them and says where they are and what each holds. What happens in them is the sim's (sim.ts).
//
// Pure: no DOM, render or audio imports.

export type MomentVerb = 'race' | 'gates' | 'rings' | 'collapse' | 'steps' | 'slide' | 'shatter' | 'surge' | 'flourish' | 'follow' | 'kindle' | 'carry';
/** Every verb, in an order that will not change: the music's stingers and the boards key on it. */
export const VERBS: readonly MomentVerb[] = ['race', 'gates', 'rings', 'collapse', 'steps', 'slide', 'shatter', 'surge', 'flourish', 'follow', 'kindle', 'carry'];
/** How a verb is played where it appears twice ('' where it has one way). */
export type MomentStyle = '' | 'sprint' | 'chase' | 'sit' | 'swing' | 'stair' | 'hops';
/** How the lens frames it: out and up over a drop ('wide'), low and close down a street or a tube
 *  ('low'), or off to one side across a span or beside a machine ('side'). */
export type MomentCam = 'wide' | 'low' | 'side';
/** A light beat the world plays with it (palette and post): a burst of morning light out of a tube, the
 *  aurora breaking, the lanterns of a festival street, embers off the caldera, petals. */
export type MomentLight = 'dawn' | 'aurora' | 'lanterns' | 'embers' | 'petals' | null;

/** A variant's numbers, by name; a builder reads the ones its verb knows and takes its default for the rest. */
type Tune = Readonly<Record<string, number>>;

interface Variant {
  key: string;
  /** What the variant is called (the lab's tables, the notes, a later HUD). */
  name: string;
  /** What to play this run: the card's line. `{m}` is the race's machine. */
  line: string;
  t?: Tune;
}

/** A verb's variants where it is played one way: a family. The first is the plainest. */
const FAMILY: Record<string, readonly Variant[]> = {
  rings: [
    { key: 'low', name: 'The low line', line: 'Fly all three rings' },
    { key: 'far', name: 'The far side', line: 'Fly all three rings, on the far side', t: { flip: 1 } },
    { key: 'high', name: 'The high line', line: 'Pop off the lip and fly the high rings', t: { pop: 1 } },
  ],
  slide: [
    { key: 'long', name: 'One long slide', line: 'Hold one long slide across the ice', t: { need: 132 } },
    { key: 'both', name: 'A slide each way', line: 'Slide both ways across the ice', t: { each: 66 } },
  ],
  shatter: [
    { key: 'even', name: 'Hung level', line: 'Pop up and ring every bell' },
    { key: 'rising', name: 'Each higher than the last', line: 'Ring every bell: each hangs higher than the last', t: { rising: 1 } },
    { key: 'under', name: 'Under the beams', line: 'Ring every bell, and stay under the beams', t: { under: 1 } },
  ],
  collapse: [
    { key: 'chase', name: 'The fall chases', line: 'Outrun the span as it falls' },
    { key: 'surges', name: 'It falls in surges', line: 'Outrun the span: it falls in surges', t: { surge: 1 } },
    { key: 'far', name: 'From the far end', line: 'Reach the keystone before the fall does', t: { far: 1 } },
  ],
  'race:sprint': [
    { key: 'even', name: 'It leaves as you arrive', line: 'Beat the {m} to the far end' },
    { key: 'early', name: 'It left early', line: 'The {m} left early: run it down', t: { lead: 44, pace: -2.2, v0: 1.05 } },
    { key: 'late', name: 'It leaves late', line: 'The {m} leaves late: do not let it by', t: { lead: -12, pace: 1.2, v0: 0.8 } },
  ],
  'race:chase': [
    { key: 'near', name: 'One car, near', line: 'Catch the {m} before the far station', t: { lead: 58, pace: -2.5 } },
    { key: 'far', name: 'One car, a long start', line: 'Catch the {m}: it has a long start', t: { lead: 96, pace: -5.5 } },
    { key: 'pair', name: 'Two cars on the rope', line: 'Catch both cars on the rope', t: { lead: 44, pace: -3, cars: 2, gap: 54, slow: 2.4 } },
  ],
  'gates:sit': [
    { key: 'weave', name: 'Turn about', line: 'Thread every lantern gate' },
    { key: 'mirror', name: 'From the other wall', line: 'Thread every lantern gate, from the other side', t: { flip: 1 } },
    { key: 'doubles', name: 'Two and two', line: 'Thread the lantern gates, two and two', t: { doubles: 1 } },
  ],
  'gates:swing': [
    { key: 'sway', name: 'A steady sway', line: 'Thread the swinging lanterns', t: { amp: 3.3, period: 228 } },
    { key: 'counter', name: 'Swinging against each other', line: 'Thread the lanterns: they swing against each other', t: { amp: 3.2, period: 204, counter: 1 } },
    { key: 'wide', name: 'Slow and wide', line: 'Thread the lanterns: they swing slow and wide', t: { amp: 3.9, period: 330 } },
  ],
  surge: [
    { key: 'shelf', name: 'The shelf', line: 'Hit the lip at 44 m/s and clear to the shelf', t: { speed: 44 } },
    { key: 'far', name: 'The far shelf', line: 'Hit the lip at 47 m/s: only a dash will do', t: { speed: 47 } },
  ],
  'steps:stair': [
    { key: 'three', name: 'Three of the four', line: 'Stomp three landings down the steps' },
    { key: 'row', name: 'Three in a row', line: 'Stomp three landings in a row', t: { row: 1 } },
  ],
  'steps:hops': [
    { key: 'three', name: 'Three stomps', line: 'Pop and stomp your landings down the street' },
    { key: 'row', name: 'Stomps in a row', line: 'Pop and stomp your landings, one after another', t: { row: 1 } },
  ],
  flourish: [
    { key: 'spinflip', name: 'A spin and a flip', line: 'Land a full spin and a flip', t: { half: 2, flips: 1 } },
    { key: 'spins', name: 'Two full spins', line: 'Land two full spins', t: { half: 4, flips: 0 } },
    { key: 'flips', name: 'Two flips', line: 'Land two flips', t: { half: 0, flips: 2 } },
  ],
  follow: [
    { key: 'wide', name: 'A slow, wide weave', line: "Stay in the guide light's wake", t: { amp: 4.0, wave: 132 } },
    { key: 'quick', name: 'A quick weave', line: "Stay in the guide light's wake: it weaves quick", t: { amp: 3.3, wave: 96 } },
    { key: 'darts', name: 'It darts', line: "Stay in the guide light's wake: it darts", t: { amp: 3.4, wave: 128, darts: 1 } },
  ],
  kindle: [
    { key: 'both', name: 'Both rows dark', line: 'Light the lamps on both sides of the road' },
    { key: 'turns', name: 'Dark turn about', line: 'Light the dark lamps: they stand turn about', t: { pattern: 1 } },
    { key: 'halves', name: 'One row, then the other', line: 'Light the dark lamps: one row, then the other', t: { pattern: 2 } },
  ],
  carry: [
    { key: 'still', name: 'Still air', line: 'Carry the flame to the great lantern', t: { slack: 1, hit: 0.3 } },
    { key: 'wind', name: 'A wind off the Crown', line: 'Carry the flame: a wind is up, so do not slow', t: { slack: 0.93, hit: 0.18 } },
    { key: 'ember', name: 'A low flame', line: 'Carry a low flame: feed it at the brazier', t: { slack: 1, hit: 0.24, start: 0.62, relight: 1 } },
  ],
};

interface Def {
  key: string;
  name: string;
  verb: MomentVerb;
  style?: MomentStyle;
  /** The place it is, and which of that kind down the course (0 the first). */
  kind: SectionKind;
  nth: number;
  /** It runs on through the next sections too (a ravine into its bridge). */
  through?: number;
  /** It runs on to the finish line itself (the carry). */
  toLine?: boolean;
  cam: MomentCam;
  light?: MomentLight;
  /** The goal as the mastery board says it (a variant's own line is on the card). */
  line: string;
  /** The race's machine, as its lines call it. */
  machine?: string;
}

/** The named mountains' set pieces, one a stage, in order down each descent. */
const AUTHORED: Record<string, readonly Def[]> = {
  pinecrest: [
    { key: 'firstdrop', name: 'The First Drop', verb: 'rings', kind: 'leap', nth: 0, cam: 'wide', line: 'Fly all three rings' },
    { key: 'mirror', name: 'Mirror Lake', verb: 'slide', kind: 'lake', nth: 0, cam: 'side', line: 'Hold a long slide across the ice' },
    { key: 'oldtown', name: 'Old Town', verb: 'steps', style: 'hops', kind: 'bridge', nth: 0, through: 1, cam: 'low', light: 'lanterns', line: 'Pop and stomp your landings through the town' },
  ],
  frostfang: [
    { key: 'seracgate', name: 'Serac Gate', verb: 'collapse', kind: 'bridge', nth: 0, cam: 'side', line: 'Outrun the span as it falls' },
    { key: 'crevasse', name: 'The Crevasse Fields', verb: 'race', style: 'chase', kind: 'ravine', nth: 1, through: 1, cam: 'side', light: 'aurora', line: 'Catch the ropeway down the crevasse', machine: 'ropeway' },
    { key: 'cavern', name: 'The Ice Cavern', verb: 'gates', style: 'sit', kind: 'tunnel', nth: 0, through: 1, cam: 'low', light: 'dawn', line: 'Follow the lanterns out to the dawn' },
  ],
  ember: [
    { key: 'cindergate', name: 'Cinder Gate', verb: 'race', style: 'sprint', kind: 'tunnel', nth: 0, cam: 'side', light: 'embers', line: 'Beat the ore train through the mountain', machine: 'ore train' },
    { key: 'caldera', name: 'The Caldera Leap', verb: 'surge', kind: 'leap', nth: 1, cam: 'wide', light: 'embers', line: 'Clear the caldera to the far shelf' },
    { key: 'emberstreet', name: 'Ash Market', verb: 'gates', style: 'swing', kind: 'street', nth: 0, cam: 'low', light: 'lanterns', line: 'Thread the swinging lanterns to the line' },
  ],
  sakura: [
    { key: 'petals', name: 'Petal Steps', verb: 'steps', style: 'stair', kind: 'terraces', nth: 0, cam: 'wide', light: 'petals', line: 'Stomp three landings down the steps' },
    { key: 'blossomleap', name: 'The Blossom Leap', verb: 'flourish', kind: 'leap', nth: 1, cam: 'wide', light: 'petals', line: 'Land the trick over the orchards' },
    { key: 'temple', name: 'Temple Town', verb: 'shatter', kind: 'street', nth: 1, cam: 'low', light: 'lanterns', line: 'Ring every bell down to the square' },
  ],
  lanternfall: [
    { key: 'cloudsea', name: 'The Cloud Sea', verb: 'follow', kind: 'ravine', nth: 0, through: 1, cam: 'low', line: 'Follow the guide light through the cloud' },
    { key: 'lamproad', name: 'The Lamp Road', verb: 'kindle', kind: 'street', nth: 0, cam: 'low', light: 'lanterns', line: 'Light the lamps on both sides of the road' },
    { key: 'firstflame', name: 'The First Flame', verb: 'carry', kind: 'chute', nth: 0, toLine: true, cam: 'wide', light: 'lanterns', line: 'Carry the flame to the great lantern' },
  ],
};

/** A Daily or a Cup has no authored moments: each stage's biggest place, in this order of preference, with the
 *  first verb the place can host that the run has not played yet. (Follow, kindle and carry are Lanternfall's
 *  alone.) */
const PICK: ReadonlyArray<{ kind: SectionKind; cam: MomentCam; light: MomentLight; name: string; hosts: ReadonlyArray<{ verb: MomentVerb; style?: MomentStyle; line: string; machine?: string }> }> = [
  { kind: 'street', cam: 'low', light: 'lanterns', name: 'The Lantern Street', hosts: [{ verb: 'gates', style: 'sit', line: 'Thread every lantern gate' }, { verb: 'shatter', line: 'Pop up and ring every bell' }, { verb: 'steps', style: 'hops', line: 'Pop and stomp your landings down the street' }] },
  { kind: 'lake', cam: 'side', light: null, name: 'The Frozen Lake', hosts: [{ verb: 'slide', line: 'Hold a long slide across the ice' }, { verb: 'race', style: 'sprint', line: 'Beat the cable car across the ice', machine: 'cable car' }] },
  { kind: 'leap', cam: 'wide', light: null, name: 'The Big Leap', hosts: [{ verb: 'rings', line: 'Fly all three rings' }, { verb: 'surge', line: 'Clear the leap to the far shelf' }, { verb: 'flourish', line: 'Land the trick over the leap' }] },
  { kind: 'bridge', cam: 'side', light: null, name: 'The Span', hosts: [{ verb: 'collapse', line: 'Outrun the span as it falls' }] },
  { kind: 'tunnel', cam: 'low', light: 'dawn', name: 'The Tunnel', hosts: [{ verb: 'gates', style: 'sit', line: 'Follow the lanterns out to the light' }, { verb: 'race', style: 'sprint', line: 'Beat the cable car through the mountain', machine: 'cable car' }] },
  { kind: 'terraces', cam: 'wide', light: null, name: 'The Terraces', hosts: [{ verb: 'steps', style: 'stair', line: 'Stomp three landings down the steps' }] },
];

export interface MomentSpec {
  /** Index down the course (0 the first). */
  index: number;
  key: string;
  name: string;
  verb: MomentVerb;
  style: MomentStyle;
  /** The goal, as the board says it. */
  line: string;
  cam: MomentCam;
  light: MomentLight;
  /** Where it starts and ends, metres down the course (the same in every variant). */
  z0: number;
  z1: number;
  /** Which stage it belongs to. */
  stage: number;
  /** How many variants it has. */
  variants: number;
  /** The race's machine, as its lines call it ('' for the rest). */
  machine: string;
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

const family = (verb: MomentVerb, style: MomentStyle): readonly Variant[] => FAMILY[style ? `${verb}:${style}` : verb];

const specCache = new WeakMap<Course, MomentSpec[]>();

/** The run's set pieces, in order down the course: a pure function of the course. */
export function planMoments(course: Course): MomentSpec[] {
  const hit = specCache.get(course);
  if (hit) return hit;
  const secs = sectionsOf(course);
  const out: MomentSpec[] = [];
  const make = (i: number, d: Omit<Def, 'kind' | 'nth'>): void => {
    const a = secs[i];
    const b = secs[Math.min(secs.length - 1, i + (d.through ?? 0))];
    // A leap's moment is its run to the lip, its flight and its landing; a place's, its body (from its
    // blend) to its end.
    const lip = a.kind === 'leap' ? course.leaps.find((l) => l.z >= a.z0 && l.z < a.z1) : undefined;
    const z0 = lip ? Math.max(a.z0, lip.z - 40) : a.z0;
    const z1 = d.toLine ? course.finishZ : lip ? Math.min(a.z1, lip.land1 + 30) : b.kind === 'finish' ? b.z0 : b.z1;
    const style = d.style ?? '';
    out.push({ index: 0, key: d.key, name: d.name, verb: d.verb, style, line: d.line, cam: d.cam, light: d.light ?? null, z0, z1, stage: course.stageAt(z0).index, variants: family(d.verb, style).length, machine: d.machine ?? '' });
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
    // played yet where the place can host one.
    const used = new Set<MomentVerb>();
    for (const st of course.stages) {
      let pick: { i: number; p: (typeof PICK)[number]; h: (typeof PICK)[number]['hosts'][number]; rank: number } | null = null;
      for (let i = 0; i < secs.length; i++) {
        const s = secs[i];
        if (s.z0 < Math.max(500, st.z0) || s.z0 >= st.z1 || s.z1 > course.finishZ - 120) continue;
        const k = PICK.findIndex((q) => q.kind === s.kind);
        if (k < 0) continue;
        const h = PICK[k].hosts.find((q) => !used.has(q.verb));
        const rank = k + (h ? 0 : PICK.length);
        if (pick && pick.rank <= rank) continue;
        pick = { i, p: PICK[k], h: h ?? PICK[k].hosts[0], rank };
      }
      if (pick) {
        used.add(pick.h.verb);
        make(pick.i, { key: `${pick.p.kind}${pick.i}`, name: pick.p.name, verb: pick.h.verb, style: pick.h.style, line: pick.h.line, machine: pick.h.machine, cam: pick.p.cam, light: pick.p.light });
      }
    }
  }
  out.sort((a, b) => a.z0 - b.z0);
  out.forEach((m, i) => (m.index = i));
  specCache.set(course, out);
  return out;
}

// ---------------------------------------------------------------- variants

/** Which variant of a set piece a run rides: from the run's own roll, which its record carries, so a ghost and a
 *  replay ride the same one. Even over the variants, and a session's first run rolls like any other. */
export function variantOf(roll: ChaosRoll | undefined, index: number, count: number): number {
  if (!roll || count <= 1) return 0;
  return hash32(roll.seed, 0x7a21, index) % count;
}

/** A roll whose set pieces all ride variant `v` (each modulo its own count): the same roll with another seed,
 *  found by search. For dev switches, captures and tests; a record made on it replays as any other does. */
export function rollForVariant(course: Course, roll: ChaosRoll, v: number): ChaosRoll {
  const specs = planMoments(course);
  for (let k = 0; k < 20000; k++) {
    const seed = (hash32(roll.seed, 0x5eed, k) | 0) >>> 0;
    if (specs.every((s) => hash32(seed, 0x7a21, s.index) % s.variants === v % s.variants)) return { ...roll, seed };
  }
  return roll;
}

// ---------------------------------------------------------------- what each verb holds

/** A lantern gate: two posts across the run at z, threaded when the sled's middle passes within hw of its
 *  centre. A gate that swings (amp > 0) sways about x: see gateX. */
export interface MomentGate {
  z: number;
  x: number;
  hw: number;
  /** Metres either side of x it swings, the swing's length in ticks and where in it the gate starts. */
  amp: number;
  period: number;
  phase: number;
}

/** A bell hung over the run, right across it. */
export interface MomentTarget {
  z: number;
  x: number;
  hw: number;
  /** How far over the snow a sled must be as it passes under, and the most it may be (a beam over the bell). */
  h: number;
  top: number;
}

/** A line across the corridor's length: metres off the safe line, sampled every `step` from z0. */
export interface MomentPath {
  z0: number;
  z1: number;
  step: number;
  off: number[];
}

/** An unlit stone lamp of the Lamp Road (a real obstacle: Obstacle.id). */
export interface MomentLamp {
  id: number;
  x: number;
  z: number;
  r: number;
  side: 1 | -1;
  /** Unlit this run: one to kindle. The rest already burn. */
  dark: boolean;
}

/** A set piece with what its verb needs this run. Pure geometry and numbers, the same for every rider who
 *  rides the same variant. */
export interface MomentPlay extends MomentSpec {
  /** Which variant, its key and its name; `say` is its line for the card. */
  variant: number;
  variantKey: string;
  variantName: string;
  say: string;
  /** race sprint: the machine's average pace over its trip (m/s); chase: its steady pace; collapse: the fall's
   *  least pace. */
  pace: number;
  /** race: metres the machine stands ahead of z0 as it leaves (behind, if negative); collapse: metres behind z0
   *  the fall starts. */
  lead: number;
  /** race: the side of the run its machine travels (+1 right of the line). */
  side: 1 | -1;
  /** race sprint: the share of its pace the machine leaves at. chase: how many cars, and each one's lead and pace. */
  v0: number;
  cars: { lead: number; pace: number }[];
  /** collapse: 0 chased from behind, 1 falling from the far end; its surge (m/s either way); the keystone. */
  from: 0 | 1;
  surge: number;
  keystone: number;
  /** gates: in order down the run. */
  gates: MomentGate[];
  /** rings: three along the flight, in order. */
  rings: SkyGate[];
  /** steps: each step's lip, in order (none down a street); `row` when the stomps must come in a row. */
  steps: number[];
  row: boolean;
  /** shatter: the bells, in order. */
  targets: MomentTarget[];
  /** What wins it, where the verb counts: steps, stomps; slide, ticks of one drift ('long') or of each of two
   *  ('both' is set); shatter, targets; follow, metres in the wake; kindle, lamps (and `each` a side). */
  need: number;
  each: number;
  both: boolean;
  /** surge and flourish: the leap's lip; surge: the takeoff speed the far line is set for, and the far line. */
  lip: number;
  speed: number;
  far: number;
  /** flourish: half turns and flips to land. */
  half: number;
  flips: number;
  /** follow: the guide light's line and the wake's half-width. */
  path: MomentPath | null;
  hw: number;
  /** kindle: the road's lamps, in order. */
  lamps: MomentLamp[];
  /** carry: the flame's life in ticks from full, what it starts at, what a hit takes, and a brazier off the line
   *  that feeds it (null when there is none). */
  flameTicks: number;
  flame0: number;
  hit: number;
  relight: { x: number; z: number; r: number; gain: number } | null;
}

/** The race. Sprint: the machine's average pace over its trip, and how far ahead of the rider it leaves; a plain
 *  cruise loses it by a little, a rider who keeps the speed up (a tuck, a drift's release, a dash) wins. Chase:
 *  the machine left before the rider at a steady pace under a skilled rider's, and passing it wins on the spot. */
export const RACE_PACE: Record<string, number> = { mirror: 34, crevasse: 37, cindergate: 36, default: 35 };
export const RACE_LEAD = 16;
/** A sprint's machine leaves at this share of its pace and eases to (2 - it) as it comes into its far station:
 *  it pulls away first, and a rider at its pace closes on it at the end, so a sprint is decided late. */
const RACE_V0 = 1.25;
/** The collapse: the fall's least pace, the share of the rider's speed onto the span it runs at when that is
 *  faster, and how far behind the rider it starts. A span is flat, so a sled slows on it: hold your speed (a
 *  tuck, no drift, no wall) and the fall stays at your heels; bleed it and it takes the snow from under you. */
export const COLLAPSE_PACE = 30;
export const COLLAPSE_SHARE = 0.86;
export const COLLAPSE_HEAD = 18;
/** In surges the fall runs this much faster and slower than its pace, over this many ticks. */
const COLLAPSE_SURGE = 9;
const COLLAPSE_SURGE_TICKS = 240;
/** From the far end: the keystone stands this share of the way across, and the fall runs at this share of the
 *  pace a chase would (it has less far to go). */
const KEYSTONE = 0.64;
const FAR_SHARE = 0.94;
/** Lantern gates: how far apart (a street is ridden fast, often straight off a leap or a dash, so its gates
 *  stand further apart than a cavern's), half-width of the opening, and how far off the line. */
const GATE_STEP: Partial<Record<SectionKind, number>> = { street: 40, tunnel: 32 };
const GATE_HW = 2;
const GATE_OFF = 2.6;
/** Rings: the takeoff speed the line is set for, when along the flight they hang, their radius, how far
 *  off the safe line the lip must be taken, and the pop the high line is set for. */
export const RING_V = 34;
const RING_T = [0.4, 0.85, 1.3] as const;
export const RING_R = 3;
const RING_OFF = 2.2;
const RING_POP = 5.4;
/** First id of a set piece's rings among a run's sky gates (the stage gates are 0 to 2). */
export const RING_ID0 = 100;
/** Bells (shatter). A pop on a falling street is a real flight (the sled leaves level while the ground drops
 *  away: two seconds and 70 to 110 m at speed, 3 to 7 m up), so a bell asks for height at its place, not for a
 *  hop: how far into the street the first hangs, how far apart, how high a sled must be to ring one, how much
 *  higher each hangs in the rising peal, and the band under the beams. */
const BELL_LEAD = 50;
const BELL_STEP = 78;
const BELL_H = 2.6;
const BELL_RISE = [1.6, 2.6, 3.6, 4.4] as const;
const BELL_UNDER = [1.2, 3.8] as const;
/** Follow: the wake's half-width, the path's sample step, how far off the safe line the light must be for its
 *  wake to count (where it rides the line itself, over a kicker and its flight, following it is nothing), and
 *  the share of what counts that wins. */
export const WAKE_HW = 2.4;
const PATH_STEP = 4;
export const WAKE_MIN = 0.6;
const FOLLOW_SHARE = 0.6;
/** Kindle: how near a lamp's middle the sled's must pass to light it (an edge gap of about 1.5 m). */
export const KINDLE_REACH = 2.7;
/** Carry: the flame lasts this share of the time a clean coast from the shrine to the line takes. */
const CARRY_SLACK = 1.02;
const G = 9.81;
const CD = 0.0027;
const MU = 0.03;
/** course.ts's chunk length (a value import from there would close a cycle). */
const CHUNK = 64;

function obstaclesNear(course: Course, z: number): Obstacle[] {
  const out: Obstacle[] = [];
  const ci = Math.floor(z / CHUNK);
  for (let k = ci - 1; k <= ci + 1; k++) if (k >= 0) out.push(...course.chunk(k).obstacles);
  return out;
}

/** Whether a kicker's run-up or its flight lies under (x, z): a line that weaves there would throw a sled off it. */
function launches(course: Course, x: number, z: number): boolean {
  const ci = Math.floor(z / CHUNK);
  for (let k = ci - 2; k <= ci; k++) {
    if (k < 0) continue;
    for (const r of course.zones(k).ramps) if (z > r.z - 26 && z < r.z + r.len + 72 && Math.abs(r.x - x) < r.w * 0.5 + 5) return true;
  }
  return false;
}

/** Whether a sled's middle may ride at (x, z) with `pad` to spare from every obstacle, `edge` inside the corridor. */
function open(course: Course, x: number, z: number, pad: number, edge = Math.max(0.8, pad * 0.6)): boolean {
  if (course.edgeExcess(x, z) > -edge) return false;
  for (const o of obstaclesNear(course, z)) {
    let px = o.x;
    let pz = o.z;
    if (o.x2 !== o.x || o.z2 !== o.z) {
      const ex = o.x2 - o.x;
      const ez = o.z2 - o.z;
      const t = Math.max(0, Math.min(1, ((x - o.x) * ex + (z - o.z) * ez) / (ex * ex + ez * ez)));
      px = o.x + ex * t;
      pz = o.z + ez * t;
    }
    const dx = px - x;
    const dz = pz - z;
    const r = o.r + pad;
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}

/** A line that weaves either side of the safe line from zA to zB: lobes of `amp` metres, `wave` metres a full
 *  swing, each lobe as wide as stays `pad` clear of everything (down to none at all, where the safe line is the
 *  only way). `darts`: mostly on the line, with a quick lobe out now and then. Pure in the course. */
function weave(course: Course, zA: number, zB: number, amp: number, wave: number, pad: number, first: 1 | -1, darts: boolean): MomentPath {
  const n = Math.max(1, Math.ceil((zB - zA) / PATH_STEP));
  const off = new Array<number>(n + 1).fill(0);
  const half = wave / 2;
  let side = first;
  for (let a = zA; a < zB - 8; a += half) {
    const b = Math.min(zB, a + (darts ? half * 0.5 : half));
    const i0 = Math.ceil((a - zA) / PATH_STEP);
    const i1 = Math.floor((b - zA) / PATH_STEP);
    for (const k of [1, 0.75, 0.5, 0.3, 0]) {
      let ok = true;
      for (let i = i0; i <= i1 && ok; i++) {
        const z = zA + i * PATH_STEP;
        const s = dsin((PI * (z - a)) / (b - a));
        const o = side * amp * k * (darts ? s * s : s);
        if (k > 0 && (!open(course, course.safeX(z) + o, z, pad) || launches(course, course.safeX(z) + o, z))) ok = false;
        else off[i] = o;
      }
      if (ok) break;
    }
    side = side === 1 ? -1 : 1;
  }
  return { z0: zA, z1: zA + n * PATH_STEP, step: PATH_STEP, off };
}

/** A path's metres off the safe line at z (none outside it). */
export function pathOff(p: MomentPath, z: number): number {
  if (z <= p.z0 || z >= p.z1) return 0;
  const u = (z - p.z0) / p.step;
  const i = Math.floor(u);
  const f = u - i;
  return p.off[i] + (p.off[i + 1] - p.off[i]) * f;
}

/** A path's x at z. */
export function pathX(course: Course, p: MomentPath, z: number): number {
  return course.safeX(z) + pathOff(p, z);
}

/** Where a sled leaving a leap's lip on the safe line at `v`, with `pop` more lift, comes down: metres past the
 *  lip. The fairness test's flat model: the real sim lands a little short of it. */
function flightReach(course: Course, lip: Ledge, v: number, pop: number, g: number): number {
  const dt = 1 / 120;
  const z0 = lip.z;
  const x = course.safeX(z0);
  let z = z0;
  let y = course.ground(x, z0);
  let vy = v * ((y - course.ground(x, z0 - 0.5)) / 0.5) + pop;
  for (let t = 0; t < 12; t += dt) {
    vy -= g * dt;
    z += v * dt;
    y += vy * dt;
    if (y <= course.ground(course.safeX(z), z)) break;
  }
  return z - z0;
}

/** Seconds a sled coasting the safe line from z0 to z1 takes, from `v` m/s: the sim's own slope, drag and
 *  friction, with no hands. What the carry's flame is measured against, and what the music can count down by. */
export function coastSeconds(course: Course, z0: number, z1: number, v: number): number {
  let t = 0;
  for (let z = z0; z < z1; z += 1) {
    const sl = (course.baseY(z - 2) - course.baseY(z + 2)) / 4;
    const drag = course.surface(course.safeX(z), z).drag;
    v = Math.sqrt(Math.max(64, v * v + 2 * ((G * sl) / (1 + sl * sl) - MU * G - CD * drag * v * v)));
    if (v > 46) v = 46;
    t += 1 / v;
  }
  return t;
}

const playCache = new WeakMap<Course, Map<string, MomentPlay[]>>();

/** Each set piece with what its verb holds on a run with this roll (no roll: every first variant, on a plain
 *  day). Worked out once per course and combination. */
export function momentPlays(course: Course, roll?: ChaosRoll): readonly MomentPlay[] {
  const specs = planMoments(course);
  const g = G * (roll ? moodInfo(roll.mood).params.gravity : 1);
  const picks = specs.map((s) => variantOf(roll, s.index, s.variants));
  const key = `${picks.join('.')}/${g}`;
  let byKey = playCache.get(course);
  if (!byKey) playCache.set(course, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const out = specs.map((m, i) => build(course, m, picks[i], g));
  byKey.set(key, out);
  return out;
}

function build(course: Course, m: MomentSpec, vi: number, g: number): MomentPlay {
  const v = family(m.verb, m.style)[vi];
  const t: Tune = v.t ?? {};
  const k = (name: string, d: number): number => t[name] ?? d;
  const side0: 1 | -1 = m.index % 2 === 0 ? 1 : -1;
  const side: 1 | -1 = t.flip ? (side0 === 1 ? -1 : 1) : side0;
  const p: MomentPlay = {
    ...m,
    variant: vi,
    variantKey: v.key,
    variantName: v.name,
    say: v.line.replace('{m}', m.machine || 'cable car'),
    pace: 0,
    lead: 0,
    side: side0,
    v0: RACE_V0,
    cars: [],
    from: 0,
    surge: 0,
    keystone: 0,
    gates: [],
    rings: [],
    steps: [],
    row: false,
    targets: [],
    need: 0,
    each: 0,
    both: false,
    lip: 0,
    speed: 0,
    far: 0,
    half: 0,
    flips: 0,
    path: null,
    hw: 0,
    lamps: [],
    flameTicks: 0,
    flame0: 1,
    hit: 0,
    relight: null,
  };
  const lip = course.leaps.find((l) => l.z >= m.z0 && l.z < m.z1);
  switch (m.verb) {
    case 'race': {
      const base = RACE_PACE[m.key] ?? RACE_PACE.default;
      if (m.style === 'chase') {
        const n = k('cars', 1);
        for (let c = 0; c < n; c++) p.cars.push({ lead: k('lead', 58) + c * k('gap', 0), pace: base + k('pace', 0) - c * k('slow', 0) });
        p.pace = p.cars[0].pace;
        p.lead = p.cars[0].lead;
      } else {
        p.pace = base + k('pace', 0);
        p.lead = k('lead', RACE_LEAD);
        p.v0 = k('v0', RACE_V0);
      }
      break;
    }
    case 'collapse':
      p.pace = COLLAPSE_PACE;
      p.lead = COLLAPSE_HEAD;
      p.surge = t.surge ? COLLAPSE_SURGE : 0;
      p.from = t.far ? 1 : 0;
      p.keystone = m.z0 + KEYSTONE * (m.z1 - m.z0);
      break;
    case 'gates':
      p.gates = gatesFor(course, m, side, t);
      break;
    case 'rings':
      p.rings = ringsFor(course, m, side, t.pop ? RING_POP : 0, g);
      break;
    case 'steps':
      if (m.style === 'hops') p.need = m.z1 - m.z0 >= 330 ? 3 : 2;
      else {
        for (const l of course.ledges) if (l.kind === 'step' && l.z >= m.z0 && l.z < m.z1) p.steps.push(l.z);
        p.need = Math.max(1, Math.min(3, p.steps.length - 1));
      }
      p.row = !!t.row;
      break;
    case 'slide':
      p.both = t.each !== undefined;
      p.each = k('each', 0);
      p.need = p.both ? p.each : k('need', 132);
      break;
    case 'shatter':
      p.targets = bellsFor(course, m, t);
      p.need = p.targets.length;
      break;
    case 'surge':
      if (lip) {
        p.lip = lip.z;
        p.speed = k('speed', 44);
        // The far line is where a plain flight at that speed comes down (the real sim lands about a seventh
        // short of the flat model at these speeds), and never past the landing's own end. A pop off the lip
        // flies far past it at any speed, so the speed off the lip is what the sim holds a rider to.
        p.far = lip.z + Math.min(0.86 * flightReach(course, lip, p.speed, 0, g), lip.land1 - lip.z - 24);
      }
      break;
    case 'flourish':
      p.lip = lip ? lip.z : m.z0;
      p.half = k('half', 2);
      p.flips = k('flips', 1);
      break;
    case 'follow': {
      p.hw = WAKE_HW;
      p.path = weave(course, m.z0 + 50, m.z1 - 30, k('amp', 4), k('wave', 132), WAKE_HW + 0.5, side, !!t.darts);
      p.need = Math.round(FOLLOW_SHARE * PATH_STEP * p.path.off.filter((o) => o >= WAKE_MIN || o <= -WAKE_MIN).length);
      break;
    }
    case 'kindle':
      lampsFor(course, m, k('pattern', 0), p);
      break;
    case 'carry': {
      p.flameTicks = Math.round(coastSeconds(course, m.z0, m.z1, 36) * 60 * CARRY_SLACK * k('slack', 1));
      p.flame0 = k('start', 1);
      p.hit = k('hit', 0.3);
      if (t.relight) {
        // A brazier beside the line, a little past the last leap's landing: feeding the flame is a choice.
        const l = course.leaps[course.leaps.length - 1];
        const z = Math.min(course.finishZ - 200, (l ? l.land1 : m.z0 + 300) + 26);
        p.relight = { x: course.safeX(z) + side * 4.2, z, r: 2.4, gain: 0.45 };
      }
      break;
    }
  }
  return p;
}

/** Whether anything stands in a gate's opening at (x, z), out to `reach` either side of it. */
function gateBlocked(course: Course, x: number, z: number, reach: number): boolean {
  for (const dx of reach > 0 ? [-reach, 0, reach] : [0]) if (!open(course, x + dx, z, GATE_HW + 0.4, 0.4)) return true;
  return false;
}

/** Gates down a street or a tube, each where nothing stands in its opening; a gate that would sit on something
 *  moves down the run a little or is left out. Sitting gates stand on alternate sides of the safe line (or two
 *  and two); swinging ones sway across it. */
function gatesFor(course: Course, m: MomentSpec, first: 1 | -1, t: Tune): MomentGate[] {
  const out: MomentGate[] = [];
  const swing = m.style === 'swing';
  const amp = swing ? (t.amp ?? 3.3) : 0;
  const period = swing ? (t.period ?? 228) : 0;
  let side = first;
  for (let z = m.z0 + 26; z < m.z1 - 18; ) {
    // Gates hang in a street or a tube, never out on a span (a bridge's rails stand too close).
    const kind = course.section(z).kind;
    const step = GATE_STEP[kind];
    if (!step) {
      z += 8;
      continue;
    }
    z += step;
    if (z >= m.z1 - 18) break;
    for (const dz of [0, 4, -4, 8]) {
      const zz = z + dz;
      const room = Math.max(0, course.halfWidth(zz) - GATE_HW - 0.6);
      const a = Math.min(amp, Math.max(0, room - 0.4));
      const x = course.safeX(zz) + (swing ? 0 : side * Math.min(GATE_OFF, room));
      if (gateBlocked(course, x, zz, a)) continue;
      const i = out.length;
      out.push({ z: zz, x, hw: GATE_HW, amp: a, period, phase: swing ? (t.counter && i % 2 === 1 ? PI : 0) + i * 0.9 : 0 });
      // Turn about, or two and two.
      if (!t.doubles || i % 2 === 1) side = side === 1 ? -1 : 1;
      break;
    }
  }
  return out;
}

/** A gate's middle `ticks` after the rider reached its set piece (a gate that sits never moves). */
export function gateX(g: MomentGate, ticks: number): number {
  return g.amp > 0 ? g.x + g.amp * dsin((TAU * ticks) / g.period + g.phase) : g.x;
}

/** Three rings along the flight off a leap's lip, taken RING_OFF to one side at RING_V with `pop` more lift. */
function ringsFor(course: Course, m: MomentSpec, side: 1 | -1, pop: number, g: number): SkyGate[] {
  const lip = course.leaps.find((l) => l.z >= m.z0 && l.z < m.z1);
  if (!lip) return [];
  const x0 = course.safeX(lip.z) + side * RING_OFF;
  const lean = (course.safeX(lip.z + 1) - course.safeX(lip.z - 1)) / 2;
  const y0 = course.ground(x0, lip.z - 0.05);
  const slope = y0 - course.ground(x0, lip.z - 1.05);
  // (A pop leaves level and adds its lift: the sim's pop() takes the lip's own fall out of the launch.)
  const vy = pop > 0 ? pop : RING_V * slope;
  const out: SkyGate[] = [];
  RING_T.forEach((t, k) => {
    const z = lip.z + RING_V * t;
    out.push({ id: RING_ID0 + m.index * 4 + k, stage: m.stage, x: x0 + lean * RING_V * t, y: y0 + vy * t - 0.5 * g * t * t + 0.5, z, r: RING_R, moment: m.index });
  });
  return out;
}

/** Bells down a street, right across the run: no steering rings one, only being up in the air under it. Hung
 *  level, each higher than the last, or under beams a sled must not fly over. */
function bellsFor(course: Course, m: MomentSpec, t: Tune): MomentTarget[] {
  const out: MomentTarget[] = [];
  for (let z = m.z0 + BELL_LEAD, i = 0; z < m.z1 - 24 && i < 4; z += BELL_STEP, i++) {
    out.push({ z, x: course.centerX(z), hw: Math.max(2.5, course.halfWidth(z) - 1.4), h: t.under ? BELL_UNDER[0] : t.rising ? BELL_RISE[i] : BELL_H, top: t.under ? BELL_UNDER[1] : 99 });
  }
  return out;
}

/** The Lamp Road's stone lamps (course.ts lays them in pairs down a Lanternfall street), and which stand unlit
 *  this run: both rows, turn about, or one row and then the other. */
function lampsFor(course: Course, m: MomentSpec, pattern: number, p: MomentPlay): void {
  const seen = new Set<number>();
  for (let k = Math.floor(m.z0 / CHUNK); k <= Math.floor(m.z1 / CHUNK); k++) {
    for (const o of course.chunk(k).obstacles) {
      if (o.kind !== 'lantern' || o.z < m.z0 || o.z >= m.z1 || seen.has(o.id)) continue;
      const off = o.x - course.safeX(o.z);
      const d = off < 0 ? -off : off;
      if (d < 3.2 || d > 5.4) continue;
      seen.add(o.id);
      p.lamps.push({ id: o.id, x: o.x, z: o.z, r: o.r, side: off > 0 ? 1 : -1, dark: true });
    }
  }
  p.lamps.sort((a, b) => a.z - b.z || a.side - b.side);
  if (p.lamps.length > 30) p.lamps.length = 30;
  const z0 = p.lamps.length ? p.lamps[0].z : 0;
  const zm = p.lamps.length ? (z0 + p.lamps[p.lamps.length - 1].z) / 2 : 0;
  for (const l of p.lamps) {
    const pair = Math.round((l.z - z0) / 20);
    if (pattern === 1) l.dark = (pair % 2 === 0) === (l.side === p.side);
    else if (pattern === 2) l.dark = l.z <= zm ? l.side === p.side : l.side !== p.side;
  }
  const dark = p.lamps.filter((l) => l.dark).length;
  // Both rows dark: a rider can hug one row and cross once. Half of them dark: most of what there is.
  p.need = Math.max(2, Math.round(dark * (pattern === 0 ? 0.42 : 0.7)));
  p.each = Math.max(1, Math.min(3, Math.floor(p.need / 3)));
}

/** A sprint's machine: metres down the course `ticks` after it left (it leaves as the rider reaches z0). It runs
 *  at v0 of its pace and changes speed evenly to (2 - v0), so its average is the pace. */
export function machineZ(p: MomentPlay, ticks: number, car = 0): number {
  const t = ticks / 60;
  if (p.style === 'chase') {
    const c = p.cars[car] ?? p.cars[0];
    const z = p.z0 + c.lead + c.pace * t;
    return z < p.z1 ? z : p.z1;
  }
  const D = p.z1 - p.z0 - p.lead;
  const v0 = p.v0 * p.pace;
  const v1 = (2 - p.v0) * p.pace;
  const a = (v1 * v1 - v0 * v0) / (2 * D);
  const d = v0 * t + 0.5 * a * t * t;
  return p.z0 + p.lead + (d < D && v0 + a * t > 0 ? d : D);
}

/** The fall's pace for a rider who came onto the span at `v` m/s. From the far end it has less far to go than
 *  the rider has to the keystone, so it runs slower by that share. */
export function fallPace(p: MomentPlay, v: number): number {
  const k = COLLAPSE_SHARE * v;
  const pace = k > p.pace ? k : p.pace;
  return p.from === 1 ? (FAR_SHARE * pace * (p.z1 - p.keystone)) / (p.keystone - p.z0) : pace;
}

/** The collapse's fall line: metres down the course `ticks` after the rider reached z0 at its `pace`. Chased, it
 *  runs down the span from behind the rider (in surges, faster and slower by turns about the same pace); from
 *  the far end, it runs up the span from z1. */
export function fallZ(p: MomentPlay, ticks: number, pace: number): number {
  if (p.from === 1) return p.z1 - (pace * ticks) / 60;
  // (In surges its speed swings `surge` either side of its pace: it comes on first, then hangs back.)
  const w = TAU / COLLAPSE_SURGE_TICKS;
  const surge = p.surge > 0 ? (p.surge / 60 / w) * dsin(w * ticks) : 0;
  return p.z0 - p.lead + (pace * ticks) / 60 + surge;
}

// ---------------------------------------------------------------- legends

// Legend moments (round 7): one or two a mountain, on about one run in ten and never a session's first
// (chaos.ts rolls ChaosRoll.legend with the mood and the event, so the record carries it). Each is spectacle
// first. Where one changes play it only ever gives: lights to take, laid off the safe line, or a lane of light
// that charges the lantern, the same for every rider whose run rolled it, with no collider anywhere.
//   runner  something runs the place ahead of the rider, laying spirit lights along its weaving line
//   ribbon  a lane of light lies along the place; riding in it lights the lantern, up to one lantern's worth
//   sky     the sky or the valley does something as the rider crosses the place; nothing to take
export type LegendKind = 'runner' | 'ribbon' | 'sky';

interface LegendDef {
  key: string;
  name: string;
  /** What the HUD says as it comes. */
  line: string;
  kind: LegendKind;
  at: SectionKind;
  nth: number;
  amp?: number;
  wave?: number;
}

const LEGENDS: Record<string, readonly LegendDef[]> = {
  pinecrest: [
    { key: 'stag', name: 'The White Stag', line: 'The white stag runs the glades: follow its lights', kind: 'runner', at: 'treerun', nth: 0, amp: 2.2, wave: 96 },
    { key: 'fleet', name: 'The Lantern Fleet', line: 'A thousand lanterns rise from the lake', kind: 'sky', at: 'lake', nth: 0 },
  ],
  frostfang: [
    { key: 'aurora', name: 'The Aurora Comes Down', line: 'The aurora has come down to the snow: ride in it', kind: 'ribbon', at: 'switchbacks', nth: 0, amp: 3.4, wave: 150 },
    { key: 'herd', name: 'The Ghost Herd', line: 'The ghost herd is running: ride with it', kind: 'runner', at: 'chute', nth: 0, amp: 3.6, wave: 120 },
  ],
  ember: [
    { key: 'eruption', name: 'The Cone Wakes', line: 'The cone is awake', kind: 'sky', at: 'bridge', nth: 0 },
    { key: 'wyrm', name: 'The Cinder Wyrm', line: 'The cinder wyrm swims the halls: follow its sparks', kind: 'runner', at: 'ravine', nth: 1, amp: 2.4, wave: 110 },
  ],
  sakura: [
    { key: 'dragon', name: 'The Lantern Dragon', line: 'The lantern dragon winds down the benches: follow it', kind: 'runner', at: 'benches', nth: 0, amp: 5, wave: 140 },
    { key: 'cranes', name: 'The Thousand Cranes', line: 'A thousand paper cranes take the air', kind: 'sky', at: 'leap', nth: 2 },
  ],
  lanternfall: [
    { key: 'rising', name: 'The Great Rising', line: 'Every lantern in the valley is rising', kind: 'sky', at: 'leap', nth: 1 },
    { key: 'lamplighter', name: 'The Tall Lamplighter', line: "The tall lamplighter walks the grove: ride in his lantern's light", kind: 'ribbon', at: 'treerun', nth: 0, amp: 1.6, wave: 120 },
  ],
};

/** A Daily's or a Cup's legends are its biome's, by what the course holds. */
const LEGEND_LOOK: Record<string, string> = { alpine: 'pinecrest', glacier: 'frostfang', volcanic: 'ember', blossom: 'sakura', lantern: 'lanternfall' };

/** A runner's lights: how far apart along its line, and how far ahead of the rider it keeps. */
const LEGEND_LIGHT_STEP = 14;
export const LEGEND_AHEAD = 18;
/** A ribbon: its half-width, what a tick in it lights, and the most it gives (one lantern). */
export const RIBBON_HW = 2.3;
export const RIBBON_RATE = 0.5;
export const RIBBON_CAP = 100;
/** First id of a legend's lights (the storm's are 10,000,000 on). */
export const LEGEND_ID0 = 11_000_000;

export interface LegendPlay {
  /** Which of the mountain's legends (1 or 2: ChaosRoll.legend). */
  slot: number;
  key: string;
  name: string;
  line: string;
  kind: LegendKind;
  /** Where it plays, metres down the course. */
  z0: number;
  z1: number;
  /** The side of the run its spectacle keeps to (+1 right of the line). */
  side: 1 | -1;
  /** runner and ribbon: its line. */
  path: MomentPath | null;
  /** runner: the lights it lays, in order down the course. */
  lights: { x: number; z: number; hover: number; value: number }[];
}

const legendCache = new WeakMap<Course, (LegendPlay | null)[]>();

/** A course's legends, by slot (index 0 is slot 1). A slot the course has no place for is null. */
export function planLegends(course: Course): readonly (LegendPlay | null)[] {
  const hit = legendCache.get(course);
  if (hit) return hit;
  const defs = LEGENDS[namedMountain(course.seed) ?? LEGEND_LOOK[course.trueBiome]] ?? [];
  const secs = sectionsOf(course);
  const pieces = planMoments(course);
  const out: (LegendPlay | null)[] = defs.map((d, slot) => {
    let seen = 0;
    const sec = secs.find((s) => s.kind === d.at && seen++ === d.nth) ?? (namedMountain(course.seed) ? undefined : secs.find((s) => s.kind === d.at && s.z0 > 500));
    // Never over a set piece: one thing asks for the rider's eyes at a time.
    if (!sec || sec.z1 > course.finishZ - 100 || pieces.some((p) => p.z0 < sec.z1 && p.z1 > sec.z0 && d.kind !== 'sky')) return null;
    const side: 1 | -1 = hash32(course.seed, 0x1e6e, slot) & 1 ? 1 : -1;
    const z0 = sec.z0 + 30;
    const z1 = sec.z1 - 20;
    const lg: LegendPlay = { slot: slot + 1, key: d.key, name: d.name, line: d.line, kind: d.kind, z0, z1, side, path: null, lights: [] };
    if (d.kind !== 'sky') lg.path = weave(course, z0 + 20, z1 - 10, d.amp ?? 3, d.wave ?? 120, RIBBON_HW + 0.4, side, false);
    if (d.kind === 'runner' && lg.path) {
      const n = Math.floor((lg.path.z1 - lg.path.z0 - 10) / LEGEND_LIGHT_STEP);
      for (let i = 0; i <= n; i++) {
        const z = lg.path.z0 + 6 + i * LEGEND_LIGHT_STEP;
        lg.lights.push({ x: pathX(course, lg.path, z), z, hover: 0.8, value: i === n ? 3 : 1 });
      }
    }
    return lg;
  });
  legendCache.set(course, out);
  return out;
}

/** The legend a run with this roll rides, or null. */
export function legendFor(course: Course, roll: ChaosRoll | undefined): LegendPlay | null {
  const slot = roll?.legend ?? 0;
  if (slot <= 0) return null;
  return planLegends(course)[slot - 1] ?? null;
}

// ---------------------------------------------------------------- the climax

/** The last stage's shape, for whoever scores and frames it: the last set piece, the last leap (the peak) and
 *  the way into the finish town. Metres down the course; coastSeconds turns any of them into time. */
export interface Climax {
  /** The last stage's set piece: its index and its extent. */
  piece: number;
  pieceZ0: number;
  pieceZ1: number;
  /** The last leap: its lip (the peak, where the music can take its breath), and where a sled at 38 m/s lands. */
  peakZ: number;
  landZ: number;
  /** Where the finish town's square begins, and the line. */
  townZ: number;
  lineZ: number;
}

const climaxCache = new WeakMap<Course, Climax>();

export function climaxOf(course: Course): Climax {
  const hit = climaxCache.get(course);
  if (hit) return hit;
  const pieces = planMoments(course);
  const last = pieces[pieces.length - 1];
  const leap = course.leaps[course.leaps.length - 1];
  const town = course.section(course.finishZ - 1).z0;
  const c: Climax = {
    piece: last ? last.index : -1,
    pieceZ0: last ? last.z0 : town,
    pieceZ1: last ? last.z1 : town,
    peakZ: leap ? leap.z : town,
    landZ: leap ? leap.z + 0.955 * flightReach(course, leap, 38, 0, G) : town,
    townZ: town,
    lineZ: course.finishZ,
  };
  climaxCache.set(course, c);
  return c;
}
