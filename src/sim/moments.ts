import type { Course, SectionKind, SkyGate } from './course';
import { MOUNTAINS } from './mountains';

// Set pieces (round 6): each mountain's three biggest places, one a stage, each with a verb of its own that
// the sim plays, so every rider (a ghost too) meets the same moments and its record carries how it went.
//   race      a machine (a cable car, a ropeway gondola, an ore train, a cableway car) leaves its station as
//             the rider arrives; beat it to the far end
//   gates     a slalom of lantern gates down a street or a cavern, set about a beat apart at cruise; ride
//             through every one in order
//   rings     three rings of light along a big leap's flight; hit the lip in line and at speed
//   collapse  the snow and ice of a span fall in behind the rider; stay ahead of the fall
//   steps     a terrace's steps; land every one clean
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
    { key: 'petals', name: 'Petal Steps', verb: 'steps', kind: 'terraces', nth: 0, cam: 'wide', light: 'petals', line: 'Land every step clean' },
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
  { kind: 'terraces', verb: 'steps', cam: 'wide', light: null, name: 'The Terraces', line: 'Land every step clean' },
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

// ---------------------------------------------------------------- what each verb holds

/** A lantern gate: two posts across the run at z, threaded when the sled's middle passes within hw of x. */
export interface MomentGate {
  z: number;
  x: number;
  hw: number;
}

/** A set piece with what its verb needs. Pure geometry and numbers, the same for every rider. */
export interface MomentPlay extends MomentSpec {
  /** race: the machine's average pace over its trip (m/s); collapse: the fall's pace. */
  pace: number;
  /** race: metres the machine stands ahead of z0 as it leaves; collapse: metres behind z0 the fall starts. */
  lead: number;
  /** race: the side of the run its machine travels (+1 right of the line). */
  side: 1 | -1;
  /** gates: in order down the run. */
  gates: MomentGate[];
  /** rings: three along the flight, in order (also in Course.skyGates, tagged with this moment). */
  rings: SkyGate[];
  /** steps: each step's lip, in order. */
  steps: number[];
}

/** The race: the machine's average pace over its trip, and how far ahead of the rider it leaves. A plain
 *  cruise loses it by a little; a rider who keeps the speed up (a tuck, a drift's release, a dash) wins. */
export const RACE_PACE: Record<string, number> = { mirror: 34, crevasse: 37, cindergate: 36, default: 35 };
export const RACE_LEAD = 16;
/** The machine leaves at this share of its pace and eases to (2 - it) as it comes into its far station: it
 *  pulls away first, and a rider at its pace closes on it at the end, so a race is decided late. */
const RACE_V0 = 1.25;
/** The collapse: the fall's least pace, the share of the rider's speed onto the span it runs at when that is
 *  faster, and how far behind the rider it starts. A span is flat, so a sled slows on it: hold your speed (a
 *  tuck, no drift, no wall) and the fall stays at your heels; bleed it and it takes the snow from under you. */
export const COLLAPSE_PACE = 30;
export const COLLAPSE_SHARE = 0.86;
export const COLLAPSE_HEAD = 18;
/** Lantern gates: how far apart (a street is ridden fast, often straight off a leap or a dash, so its gates
 *  stand further apart than a cavern's), half-width of the opening, and how far off the line. */
const GATE_STEP: Partial<Record<SectionKind, number>> = { street: 40, tunnel: 32 };
const GATE_HW = 2;
const GATE_OFF = 2.6;
/** Rings: the takeoff speed the line is set for, when along the flight they hang, their radius, and how far
 *  off the safe line the lip must be taken. */
export const RING_V = 34;
const RING_T = [0.4, 0.85, 1.3] as const;
export const RING_R = 3;
const RING_OFF = 2.2;
/** First id of a set piece's rings in Course.skyGates (the stage gates are 0 to 2). */
export const RING_ID0 = 100;

const playCache = new WeakMap<Course, MomentPlay[]>();

/** Each set piece with what its verb holds, worked out once per course. */
export function momentPlays(course: Course): readonly MomentPlay[] {
  const hit = playCache.get(course);
  if (hit) return hit;
  const out: MomentPlay[] = planMoments(course).map((m) => {
    const p: MomentPlay = { ...m, pace: 0, lead: 0, side: m.index % 2 === 0 ? 1 : -1, gates: [], rings: [], steps: [] };
    if (m.verb === 'race') {
      p.pace = RACE_PACE[m.key] ?? RACE_PACE.default;
      p.lead = RACE_LEAD;
    } else if (m.verb === 'collapse') {
      p.pace = COLLAPSE_PACE;
      p.lead = COLLAPSE_HEAD;
    } else if (m.verb === 'gates') {
      p.gates = gatesFor(course, m, p.side);
    } else if (m.verb === 'rings') {
      p.rings = ringsFor(course, m, p.side);
    } else if (m.verb === 'steps') {
      for (const l of course.ledges) if (l.kind === 'step' && l.z >= m.z0 && l.z < m.z1) p.steps.push(l.z);
    }
    return p;
  });
  playCache.set(course, out);
  return out;
}

/** Gates on alternate sides of the safe line, about two beats apart, each where nothing stands in its
 *  opening; a gate that would sit on something moves down the run a little or is left out. */
function gatesFor(course: Course, m: MomentSpec, first: 1 | -1): MomentGate[] {
  const out: MomentGate[] = [];
  const blocked = (x: number, z: number): boolean => {
    if (course.edgeExcess(x, z) > -0.4) return true;
    const ci = Math.floor(z / 64);
    for (let k = ci - 1; k <= ci + 1; k++) {
      if (k < 0) continue;
      for (const o of course.chunk(k).obstacles) {
        const dx = o.x - x;
        const dz = o.z - z;
        if (dx * dx + dz * dz < (o.r + GATE_HW + 0.4) * (o.r + GATE_HW + 0.4)) return true;
      }
    }
    return false;
  };
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
    let placed = false;
    for (const dz of [0, 4, -4, 8]) {
      const zz = z + dz;
      const room = Math.max(0, course.halfWidth(zz) - GATE_HW - 0.6);
      const x = course.safeX(zz) + side * Math.min(GATE_OFF, room);
      if (blocked(x, zz)) continue;
      out.push({ z: zz, x, hw: GATE_HW });
      placed = true;
      break;
    }
    if (placed) side = side === 1 ? -1 : 1;
  }
  return out;
}

/** Three rings along the flight off a leap's lip, taken RING_OFF to one side at RING_V with no pop. */
function ringsFor(course: Course, m: MomentSpec, side: 1 | -1): SkyGate[] {
  const lip = course.leaps.find((l) => l.z >= m.z0 && l.z < m.z1);
  if (!lip) return [];
  const x0 = course.safeX(lip.z) + side * RING_OFF;
  const lean = (course.safeX(lip.z + 1) - course.safeX(lip.z - 1)) / 2;
  const y0 = course.ground(x0, lip.z - 0.05);
  const slope = y0 - course.ground(x0, lip.z - 1.05);
  const vy = RING_V * slope;
  const out: SkyGate[] = [];
  RING_T.forEach((t, k) => {
    const z = lip.z + RING_V * t;
    out.push({ id: RING_ID0 + m.index * 4 + k, stage: m.stage, x: x0 + lean * RING_V * t, y: y0 + vy * t - 0.5 * 9.81 * t * t + 0.5, z, r: RING_R, moment: m.index });
  });
  return out;
}

/** The race's machine: metres down the course `ticks` after it left (it leaves as the rider reaches z0).
 *  It runs at RACE_V0 of its pace and changes speed evenly to (2 - RACE_V0), so its average is the pace. */
export function machineZ(p: MomentPlay, ticks: number): number {
  const D = p.z1 - p.z0 - p.lead;
  const v0 = RACE_V0 * p.pace;
  const v1 = (2 - RACE_V0) * p.pace;
  const a = (v1 * v1 - v0 * v0) / (2 * D);
  const t = ticks / 60;
  const d = v0 * t + 0.5 * a * t * t;
  return p.z0 + p.lead + (d < D ? d : D);
}

/** The fall's pace for a rider who came onto the span at `v` m/s. */
export function fallPace(p: MomentPlay, v: number): number {
  const k = COLLAPSE_SHARE * v;
  return k > p.pace ? k : p.pace;
}

/** The collapse's fall: metres down the course `ticks` after the rider reached z0 at its `pace`. */
export function fallZ(p: MomentPlay, ticks: number, pace: number): number {
  return p.z0 - p.lead + (pace * ticks) / 60;
}
