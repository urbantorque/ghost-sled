// Round 9, milestone 0: what a mountain is, read off the sim's own course, and how a pilot rides it. Shared by
// r9-courses.ts (the table and the bars) and r9-profiles.ts (the profile charts). Node only: nothing here is imported
// by the game, so the game's boot does no more work for it. It reads src/sim and src/bot's neighbours and edits none
// of them (the sim is closed in milestone 0).
//
// The measures, exactly (each is the same function on every mountain, so a new course and a reskin come out
// different only where the ground is different):
//
// THE COURSE (no rider; course.ts's own functions, sampled every metre from z = 0 to the finish line)
//   length       the finish line, metres (course.finishZ)
//   stages       each stage's metres (course.stages)
//   drop         metres of height lost from the gate to the line: baseY(0) - baseY(finishZ)
//   slope        the plain grade: drop less every ledge's own fall (leaps, terrace steps, lake outlets), over the
//                length. slopeSd is the spread of the grade over 25 m windows outside ledges.
//   pitches      stretches of 40 m or more whose 25 m grade is 0.38 or steeper, outside a ledge (count, metres)
//   flats        the same at 0.16 or gentler
//   stageSlope   each stage's plain grade (its drop less its ledges, over its length): steady, steepening or not
//   width        the corridor between its edges, 2 x halfWidth(z), where the banks begin: mean, and the share
//                of the run under 12 m and over 30 m
//   reach        the width a sled can use before the bank turns it back: 2 x (halfWidth + edgeLimit)
//   bank         the bank's rise where a sled is turned back (ground at the edge plus edgeLimit, less the floor
//                at the edge), mean over the run: how high the frame is
//   walled       share of the run whose turn-back is 5 m or nearer past the edge (ravine, street, bridge, tunnel,
//                the square): ridden between walls, not banks
//   bends        the safe line's direction changes: a turning point counts once the line has come back 2 m from
//                it (hysteresis), per km. turning is the line's whole heading change, degrees per km (10 m steps).
//   hazards      every collider the sim's collide() reads (course.chunk(k).obstacles) with its middle short of the
//                line, per km: all, solid (soft snowmen apart), by kind group (tall: trees, spires, seracs,
//                basalt; low: rocks, ice blocks, lava rocks, lanterns; logs; pillars, the spirit gates' posts;
//                soft), and `near`, the solid ones whose edge is within 6 m of the safe line
//   features     per km: online kickers (on the line), offline kickers, scattered drops, mogul fields, ice patches,
//                vents, rails; glassM, metres of the safe line on glass (a lake's sheet or a fork's strip)
//   leaps        each leap's lip z and cliff height; steps and outlets counted; firstLeap the first lip
//   kickFirst    the first online kicker's z
//   kinds        the section kinds the descent is laid from, and each one's share of the run
//   setPieces    each set piece's extent (moments.ts planMoments) and their share of the run
//   legends      each legend's extent (planLegends) and their share
//   opening      the kinds and lengths up to the first leap's section's end
//   finish       the square: the finish section's metres before the line, its half-width and grade
//
// A RIDE (one pilot, one seed; the lab's pilots, rolls and seeds exactly as lab.ts rides them)
//   seconds      ticks to the line / 60 (to the end of the ride if it did not finish)
//   meanSpeed    the mean of the sled's speed over every tick (lab.ts's measure)
//   air          ticks with the sled off the ground and not on a rail: share of the run and seconds;
//                flights over 0.5 s counted, the longest in seconds, and each flight's z extent (for the charts)
//   steerRev     reversals of the steer the pilot sent (a side held, then the other side), per km ridden
//   riderBends   the rider's own path's direction changes, by the same 2 m hysteresis as the course's bends, per km
//   falls        falls got up from, wards that took a hit, and the wreck if the run ended in one
//   setPiecesWon set pieces won of those met
//   mechanic     the share of the run's ticks a new mountain's signature mechanic is in play (MECHANICS below;
//                zero on the five, and on a new mountain until its lane writes its function)
import { CHUNK_LEN, Course, type Ledge, type Obstacle, type SectionKind, courseFor } from '../../src/sim/course';
import { MOUNTAINS, type MountainDef } from '../../src/sim/mountains';
import { planLegends, planMoments, gateX, pathX, machineZ } from '../../src/sim/moments';
import { Sim, TRACK_BANK, TRACK_DAMP, wallYaw } from '../../src/sim/sim';
import { WALL_LOW, trackAt, wallU } from '../../src/sim/oldrun';
import { type Kit, type Pilot, classic, clumsy, spenderFor, trickster } from './labpilots';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** The five as they shipped in round 8. Anything else MOUNTAINS registers is a new mountain. */
export const FIVE: readonly string[] = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];

/** A turning point of a line counts once the line has come back this far from it. */
export const BEND_M = 2;
/** The window a grade is read over, and the grades that make a pitch and a flat, and how long one must run. */
const GRADE_WIN = 25;
const PITCH = 0.38;
const FLAT = 0.16;
const RUN_MIN = 40;
/** A flight is counted from this long. */
export const FLIGHT_S = 0.5;
/** A solid collider whose edge is this close to the safe line shapes the line. */
const NEAR_M = 6;
/** A turn-back this close past the edge is a wall. */
const WALL_M = 5;

const TALL = new Set(['pine', 'spire', 'serac', 'basalt', 'charpine', 'blossom']);
const LOW = new Set(['rock', 'iceblock', 'lavarock', 'lantern']);
export function groupOf(o: Obstacle): 'tall' | 'low' | 'log' | 'pillar' | 'soft' {
  if (o.soft) return 'soft';
  if (o.kind === 'log') return 'log';
  if (o.kind === 'pillar') return 'pillar';
  if (TALL.has(o.kind)) return 'tall';
  if (LOW.has(o.kind)) return 'low';
  return 'low';
}

/** Turning points of a sampled line (x by metre or by tick), counted once the line has come back `m` from each. */
export function bendsOf(xs: readonly number[], m = BEND_M): number[] {
  const at: number[] = [];
  if (xs.length < 2) return at;
  // (Until the line has moved `m` either way it has no direction yet, and its start is not a turn.)
  let dir = 0;
  let hi = xs[0];
  let lo = xs[0];
  let ext = xs[0];
  let extI = 0;
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    if (dir === 0) {
      hi = Math.max(hi, x);
      lo = Math.min(lo, x);
      if (hi - x >= m) dir = -1;
      else if (x - lo >= m) dir = 1;
      if (dir !== 0) {
        ext = x;
        extI = i;
      }
      continue;
    }
    if (dir > 0) {
      if (x > ext) {
        ext = x;
        extI = i;
      } else if (ext - x >= m) {
        at.push(extI);
        dir = -1;
        ext = x;
        extI = i;
      }
    } else if (x < ext) {
      ext = x;
      extI = i;
    } else if (x - ext >= m) {
      at.push(extI);
      dir = 1;
      ext = x;
      extI = i;
    }
  }
  return at;
}

export interface Span {
  z0: number;
  z1: number;
}

/** Stretches where a test holds for at least `min` metres (samples by metre). */
function runs(n: number, ok: (i: number) => boolean, min: number): Span[] {
  const out: Span[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const yes = i < n && ok(i);
    if (yes && start < 0) start = i;
    if (!yes && start >= 0) {
      if (i - start >= min) out.push({ z0: start, z1: i });
      start = -1;
    }
  }
  return out;
}

/** Where a ledge's own fall is: from the brow's run-up to the end of its landing face. */
function ledgeSpan(l: Ledge): Span {
  return { z0: l.z - l.kickLen, z1: l.faceHold > 0 ? l.foot + l.faceHold + l.faceEase : l.foot + 2 };
}

/** The course sampled every metre: what the charts draw and the measures read. */
export interface Samples {
  z: number[];
  /** baseY: the ground's long profile (leaps and steps cut into it). */
  y: number[];
  cx: number[];
  hw: number[];
  sx: number[];
  limit: number[];
  bank: number[];
  kind: SectionKind[];
  /** The safe line's surface: glass (a lake's sheet, a fork's strip) or any ice at all (a patch too). */
  glass: boolean[];
  ice: boolean[];
}

export function sample(c: Course): Samples {
  const L = Math.floor(c.finishZ);
  const s: Samples = { z: [], y: [], cx: [], hw: [], sx: [], limit: [], bank: [], kind: [], glass: [], ice: [] };
  for (let z = 0; z <= L; z++) {
    const cx = c.centerX(z);
    const hw = c.halfWidth(z);
    const lim = c.edgeLimit(z);
    const sx = c.safeX(z);
    s.z.push(z);
    s.y.push(c.baseY(z));
    s.cx.push(cx);
    s.hw.push(hw);
    s.sx.push(sx);
    s.limit.push(lim);
    // (Both banks, at the turn-back, over the floor at each edge.)
    const left = c.ground(cx - hw - lim, z) - c.ground(cx - hw, z);
    const right = c.ground(cx + hw + lim, z) - c.ground(cx + hw, z);
    s.bank.push((left + right) / 2);
    s.kind.push(c.section(z).kind);
    const surf = c.surface(sx, z);
    s.glass.push(surf.ice && surf.drag < 0.5);
    s.ice.push(surf.ice);
  }
  return s;
}

export interface CourseFacts {
  id: string;
  name: string;
  seed: number;
  biome: string;
  paramsSlope: number;
  length: number;
  stages: { name: string; z0: number; z1: number; len: number }[];
  drop: number;
  ledgeDrop: number;
  slope: number;
  slopeSd: number;
  slopeP10: number;
  slopeP90: number;
  pitches: Span[];
  flats: Span[];
  stageSlope: number[];
  width: number;
  widthMin: number;
  widthMax: number;
  under12: number;
  over30: number;
  reach: number;
  bank: number;
  walled: number;
  bends: number;
  bendZ: number[];
  turning: number;
  hazards: { all: number; solid: number; tall: number; low: number; log: number; pillar: number; soft: number; near: number; byKind: Record<string, number> };
  hazardZ: { z: number; x: number; group: string }[];
  features: { kickOn: number; kickOff: number; drops: number; moguls: number; ice: number; vents: number; rails: number; glassM: number; iceM: number; skyGates: number; spiritGates: number };
  kicks: { z: number; online: boolean }[];
  leaps: { z: number; height: number; land1: number }[];
  steps: number;
  outlets: number;
  ledges: { kind: string; z: number; height: number }[];
  firstLeap: number;
  kickFirst: number;
  sections: { kind: SectionKind; z0: number; z1: number; gate: boolean }[];
  kinds: Record<string, number>;
  setPieces: { key: string; verb: string; z0: number; z1: number }[];
  setPieceShare: number;
  legends: { key: string; kind: string; z0: number; z1: number }[];
  legendShare: number;
  opening: { kind: string; len: number }[];
  finish: { square: number; halfWidth: number; grade: number };
  charmGates: number[];
}

const mean = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const sd = (a: readonly number[]): number => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) * (v - m))));
};
const quant = (a: readonly number[], q: number): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};

/** Every chunk's colliders down to the line (the sim builds the same chunks for every rider). */
export function collidersOf(c: Course): Obstacle[] {
  const out: Obstacle[] = [];
  for (let k = 0; k * CHUNK_LEN < c.finishZ; k++) for (const o of c.chunk(k).obstacles) if ((o.z + o.z2) / 2 < c.finishZ) out.push(o);
  return out;
}

export function courseFacts(def: MountainDef, smp?: Samples): CourseFacts {
  const c = courseFor(def.seed);
  const s = smp ?? sample(c);
  const L = c.finishZ;
  const km = L / 1000;
  const n = s.z.length;
  // The ledges, and where their own falls are.
  const ledges = c.ledges;
  const spans = ledges.map(ledgeSpan);
  const inLedge = (z: number): boolean => spans.some((p) => z >= p.z0 && z < p.z1);
  const ledgeDrop = ledges.reduce((a, l) => a + l.height, 0);
  const drop = s.y[0] - s.y[n - 1];
  // The grade over a window ahead, outside the ledges.
  const grade: number[] = [];
  const free: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const j = Math.min(n - 1, i + GRADE_WIN);
    grade.push(j > i ? (s.y[i] - s.y[j]) / (j - i) : 0);
    free.push(!inLedge(i) && !inLedge(j));
  }
  const freeGrades = grade.filter((_, i) => free[i]);
  const pitches = runs(n, (i) => free[i] && grade[i] >= PITCH, RUN_MIN);
  const flats = runs(n, (i) => free[i] && grade[i] <= FLAT, RUN_MIN);
  const stages = c.stages.map((st) => ({ name: st.name, z0: st.z0, z1: st.z1, len: st.z1 - st.z0 }));
  const stageSlope = c.stages.map((st) => {
    const a = Math.round(st.z0);
    const b = Math.min(n - 1, Math.round(st.z1));
    const own = ledges.filter((l) => l.z >= st.z0 && l.z < st.z1).reduce((x, l) => x + l.height, 0);
    return (s.y[a] - s.y[b] - own) / (b - a);
  });
  // The frame.
  const widths = s.hw.map((h) => 2 * h);
  const reachW = s.hw.map((h, i) => 2 * (h + s.limit[i]));
  // The line's turns.
  const bendI = bendsOf(s.sx);
  let turn = 0;
  for (let i = 10; i + 10 < n; i += 10) {
    const a = Math.atan2(s.sx[i] - s.sx[i - 10], 10);
    const b = Math.atan2(s.sx[i + 10] - s.sx[i], 10);
    turn += Math.abs(b - a);
  }
  // What the sim collides with.
  const obs = collidersOf(c);
  const byKind: Record<string, number> = {};
  const g = { tall: 0, low: 0, log: 0, pillar: 0, soft: 0 };
  let near = 0;
  const hazardZ: { z: number; x: number; group: string }[] = [];
  for (const o of obs) {
    byKind[o.kind] = (byKind[o.kind] ?? 0) + 1;
    const grp = groupOf(o);
    g[grp]++;
    const z = (o.z + o.z2) / 2;
    const x = (o.x + o.x2) / 2;
    const half = Math.abs(o.x2 - o.x) / 2;
    if (!o.soft && Math.abs(x - c.safeX(z)) - o.r - half <= NEAR_M) near++;
    hazardZ.push({ z, x: x - c.safeX(z), group: grp });
  }
  const solid = obs.length - g.soft;
  // Features.
  let kickOn = 0;
  let kickOff = 0;
  let drops = 0;
  let moguls = 0;
  let ice = 0;
  let vents = 0;
  let spiritGates = 0;
  const kicks: { z: number; online: boolean }[] = [];
  const ledgeZ = new Set(ledges.map((l) => Math.round(l.z * 1000)));
  for (let k = 0; k * CHUNK_LEN < L; k++) {
    const zn = c.zones(k);
    for (const r of zn.ramps) {
      if (r.z >= L) continue;
      if (r.online) kickOn++;
      else kickOff++;
      kicks.push({ z: r.z, online: !!r.online });
    }
    for (const d of zn.drops) if (d.z < L && d.depth > 0 && !ledgeZ.has(Math.round(d.z * 1000))) drops++;
    moguls += zn.moguls.filter((m) => m.z0 < L).length;
    // (The sheet and the strip lay a chunk-long patch each chunk: only the scattered patches are counted here.)
    ice += zn.ice.filter((p) => p.z < L && p.rx >= 5).length;
    vents += zn.vents.filter((v) => v.z < L).length;
    spiritGates += c.chunk(k).gates.filter((q) => q.z < L).length;
  }
  kicks.sort((a, b) => a.z - b.z);
  let rails = 0;
  for (let k = 0; k * CHUNK_LEN < L; k++) rails += c.zones(k).rails.filter((r) => r.z0 < L).length;
  const glassM = s.glass.filter((v) => v).length;
  const iceM = s.ice.filter((v) => v).length;
  // Sections, set pieces, legends.
  const sections: { kind: SectionKind; z0: number; z1: number; gate: boolean }[] = [];
  for (let z = 0; z < L; ) {
    const sec = c.section(z);
    sections.push({ kind: sec.kind, z0: sec.z0, z1: Math.min(sec.z1, L), gate: !!sec.gate });
    z = sec.z1 + 0.01;
  }
  const kinds: Record<string, number> = {};
  for (const sec of sections) kinds[sec.kind] = (kinds[sec.kind] ?? 0) + (sec.z1 - sec.z0) / L;
  const pieces = planMoments(c).map((p) => ({ key: p.key, verb: p.style ? `${p.verb}:${p.style}` : p.verb, z0: p.z0, z1: p.z1 }));
  const legends = planLegends(c)
    .filter((q): q is NonNullable<typeof q> => !!q)
    .map((q) => ({ key: q.key, kind: q.kind, z0: q.z0, z1: q.z1 }));
  const leaps = c.leaps.map((l) => ({ z: l.z, height: l.height, land1: l.land1 }));
  const firstLeapSec = sections.findIndex((q) => q.kind === 'leap');
  const opening = sections.slice(0, firstLeapSec + 1).map((q) => ({ kind: q.kind, len: q.z1 - q.z0 }));
  const fin = c.section(L - 1);
  const sq = Math.round(fin.z0);
  return {
    id: def.id,
    name: def.name,
    seed: def.seed,
    biome: c.trueBiome,
    paramsSlope: c.params.slope,
    length: L,
    stages,
    drop,
    ledgeDrop,
    slope: (drop - ledgeDrop) / L,
    slopeSd: sd(freeGrades),
    slopeP10: quant(freeGrades, 0.1),
    slopeP90: quant(freeGrades, 0.9),
    pitches,
    flats,
    stageSlope,
    width: mean(widths),
    widthMin: Math.min(...widths),
    widthMax: Math.max(...widths),
    under12: widths.filter((w) => w < 12).length / n,
    over30: widths.filter((w) => w > 30).length / n,
    reach: mean(reachW),
    bank: mean(s.bank),
    walled: s.limit.filter((v) => v <= WALL_M).length / n,
    bends: bendI.length / km,
    bendZ: bendI.map((i) => s.z[i]),
    turning: (turn * 180) / Math.PI / km,
    hazards: { all: obs.length / km, solid: solid / km, tall: g.tall / km, low: g.low / km, log: g.log / km, pillar: g.pillar / km, soft: g.soft / km, near: near / km, byKind },
    hazardZ,
    features: { kickOn: kickOn / km, kickOff: kickOff / km, drops: drops / km, moguls: moguls / km, ice: ice / km, vents: vents / km, rails: rails / km, glassM, iceM, skyGates: c.stageGates.length, spiritGates: spiritGates / km },
    kicks,
    leaps,
    steps: ledges.filter((l) => l.kind === 'step').length,
    outlets: ledges.filter((l) => l.kind === 'outlet').length,
    ledges: ledges.map((l) => ({ kind: l.kind, z: l.z, height: l.height })),
    firstLeap: leaps.length ? leaps[0].z : -1,
    kickFirst: kicks.find((k) => k.online)?.z ?? -1,
    sections,
    kinds,
    setPieces: pieces,
    setPieceShare: pieces.reduce((a, p) => a + (p.z1 - p.z0), 0) / L,
    legends,
    legendShare: legends.reduce((a, p) => a + (p.z1 - p.z0), 0) / L,
    opening,
    finish: { square: L - fin.z0, halfWidth: s.hw[Math.min(n - 1, sq + Math.round((L - fin.z0) / 2))], grade: (s.y[Math.min(n - 1, sq + 150)] - s.y[n - 1]) / Math.max(1, n - 1 - (sq + 150)) },
    charmGates: [...c.charmGateZs],
  };
}

// ---------------------------------------------------------------- rides

/** What lab.ts gives its pilots from moments.ts (round 9: and the Old Run's track, so its skilled pilots hold a height on
 *  its walls; a course with no kit never reads it). */
const KIT: Kit = { gateX, pathX, machineZ, track: { wallYaw, damp: TRACK_DAMP, bank: TRACK_BANK } };

/** The lab's seeds and rolls, exactly (lab.ts: seeds 1234 + i x 37, the roll's seed from the pilot's). */
export const seedOf = (i: number): number => 1234 + i * 37;
const rollOf = (seed: number): Any => ({ mood: 0, event: 0, seed: (0x1234 + seed * 2654435761) >>> 0 });
/** Every charm in the pool, as lab.ts deals by default. */
const POOL = (1 << 24) - 1;

/** One tick as a mechanic's function sees it: the sim after the step, and the input sent. */
export interface TickView {
  sim: Any;
  input: number;
}
/** A new mountain's signature mechanic: in play on this tick or not. The mountain lanes write these, by id. */
export type Mechanic = (t: TickView) => boolean;
/** Filled by the mountain lanes in milestone 3 (one entry per new mountain id). Empty today: every mountain reads 0. */
export const MECHANICS: Record<string, Mechanic> = {
  // The Old Run (notes/r9-oldrun.md section 1): on the snow, up a banked wall off the floor (a wall a bend has raised
  // over a straight's 2.6 m), the line the mountain is about.
  oldrun: ({ sim }) => {
    const s = sim.s;
    if (!s.grounded || s.tumble > 0) return false;
    const w = wallU(sim.course, s.x, s.z);
    if (w.u <= 0) return false;
    const t = trackAt(sim.course, s.z);
    return (w.side > 0 ? t.hr : t.hl) > WALL_LOW + 0.1;
  },
  // Gullhaven (notes/r9-gullhaven.md section 1): in the air inside a gully's column of lift, the sea wind holding the sled
  // over the mouth.
  gullhaven: ({ sim }) => !sim.s.grounded && sim.s.tumble === 0 && sim.course.liftAt(sim.s.x, sim.s.y, sim.s.z) > 0,
};

export interface Flight {
  z0: number;
  z1: number;
  s: number;
}

export interface RideFacts {
  pilot: string;
  id: string;
  seed: number;
  finished: boolean;
  seconds: number;
  distance: number;
  meanSpeed: number;
  airShare: number;
  airSeconds: number;
  flights: number;
  longest: number;
  flightList: Flight[];
  steerRev: number;
  riderBends: number;
  falls: number;
  wards: number;
  wreck: string | null;
  won: number;
  met: number;
  mechanic: number;
}

function pilotFor(name: string, sim: Any, seed: number): Pilot {
  switch (name) {
    case 'clumsy':
      return clumsy(sim, seed);
    case 'mid':
    case 'expert':
      return trickster(name, sim, seed, KIT);
    default:
      return classic(name as 'novice', sim, seed, KIT);
  }
}

/** One ride, as lab.ts rides it (the same Sim config, pilot, spender and input byte), noting what the measures read. */
export function ride(pilot: string, def: MountainDef, seed: number, maxSeconds: number): RideFacts {
  const sim = new Sim({ seed: def.seed, chaos: rollOf(seed), sled: 0, charmPool: POOL }) as Any;
  const p = pilotFor(pilot, sim, seed);
  const spend = spenderFor(pilot, sim, seed);
  const mech = MECHANICS[def.id];
  let speedSum = 0;
  let ticks = 0;
  let airTicks = 0;
  let flightStart = -1;
  let flightZ0 = 0;
  const flightList: Flight[] = [];
  let side = 0;
  let rev = 0;
  const xs: number[] = [];
  let falls = 0;
  let wards = 0;
  let won = 0;
  let met = 0;
  let mechTicks = 0;
  while (!sim.s.crashed && !sim.finished && sim.tick < maxSeconds * 60) {
    const o = p();
    const input = (o.steer | 0) | (o.action ? 16 : 0) | (spend() ? 64 : 0);
    sim.step(input);
    p.after?.();
    const s = sim.s;
    ticks++;
    speedSum += s.speed;
    // (Every 0.1 s of the path, for the rider's own bends.)
    if (ticks % 6 === 0) xs.push(s.x);
    const steer = (input & 15) - 4;
    const now = steer > 0 ? 1 : steer < 0 ? -1 : 0;
    if (now !== 0) {
      if (side !== 0 && now !== side) rev++;
      side = now;
    }
    const air = !s.grounded && !s.grinding;
    if (air) {
      airTicks++;
      if (flightStart < 0) {
        flightStart = sim.tick;
        flightZ0 = s.z;
      }
    } else if (flightStart >= 0) {
      const secs = (sim.tick - flightStart) / 60;
      if (secs >= 0.25) flightList.push({ z0: flightZ0, z1: s.z, s: secs });
      flightStart = -1;
    }
    for (const e of sim.events) {
      if (e.type === 'tumble' && e.phase === 'start') falls++;
      else if (e.type === 'ward') wards++;
      else if (e.type === 'moment' && (e.phase === 'won' || e.phase === 'lost')) {
        met++;
        if (e.phase === 'won') won++;
      }
    }
    if (mech && mech({ sim, input })) mechTicks++;
  }
  const km = Math.max(0.001, sim.distance / 1000);
  const long = flightList.filter((f) => f.s >= FLIGHT_S);
  return {
    pilot,
    id: def.id,
    seed,
    finished: !!sim.finished,
    seconds: ticks / 60,
    distance: sim.distance,
    meanSpeed: speedSum / Math.max(1, ticks),
    airShare: airTicks / Math.max(1, ticks),
    airSeconds: airTicks / 60,
    flights: long.length,
    longest: flightList.reduce((a, f) => Math.max(a, f.s), 0),
    flightList,
    steerRev: rev / km,
    riderBends: bendsOf(xs).length / km,
    falls,
    wards,
    wreck: sim.s.crashed ? sim.s.crashCause : null,
    won,
    met,
    mechanic: mechTicks / Math.max(1, ticks),
  };
}

export { MOUNTAINS };
