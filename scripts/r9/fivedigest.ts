// Round 9, the ground lane: the five's fingerprint. Digests of everything the five mountains (and the fairness suite's
// six Dailies) are made of, and of the rolls and rides the game makes on them, so the one additive sim batch can prove
// it changed none of it by a bit (notes/r9-ground.md section 0). Captured on round-9 at 6255b8d by
// scripts/r9/five-fingerprint.ts; tests/five.test.ts (the courses and the chaos) and tests/five-rides.test.ts (the
// rides) recompute them against those literals. Reads the sim; writes nothing.
//
// Each digest is a 64-bit FNV-1a (two 32-bit lanes) over a JSON text of the values, with -0, NaN and the infinities
// written out so no bit of a number can hide. It reads only what the base build already had: a field or method added
// later is not in it, so the five's own values are what is compared.

import { ChaosEvent, Mood, rollChaos, eventTriggerZ, type ChaosRoll } from '../../src/sim/chaos';
import { CHUNK_LEN, Course } from '../../src/sim/course';
import { InputRecorder, LogEvent, packInput } from '../../src/sim/input';
import { MOUNTAINS, dailySeed } from '../../src/sim/mountains';
import { Rng } from '../../src/sim/prng';
import { climaxOf, gateX, machineZ, momentPlays, pathX, planLegends, planMoments, rollForVariant } from '../../src/sim/moments';
import { Sim } from '../../src/sim/sim';
import { runBot } from '../../src/bot/bot';
import { cupChaos } from '../../src/game/cup';
import { legChaos } from '../../src/game/modes';
import { trialFor } from '../../src/game/trial';
import { classic, clumsy } from '../playtest/labpilots';

/** The fairness suite's six Dailies (tests/fairness.test.ts DAILIES). */
export const DAILY_KEYS = ['2026-10-24', '2026-12-25', '2027-03-01', '2027-07-19', '2027-01-02', '2027-05-30'];
/** The five, by id and seed as they stood at the base (round 9 appends mountains; it never moves these). */
export const FIVE_IDS = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];
export function fiveSeeds(): { id: string; seed: number }[] {
  return FIVE_IDS.map((id) => {
    const m = MOUNTAINS.find((q) => q.id === id);
    if (!m) throw new Error(`no ${id}`);
    return { id, seed: m.seed };
  });
}
/** The courses the course digest covers: the five, then the six Dailies. */
export function courseSeeds(): { id: string; seed: number }[] {
  return [...fiveSeeds(), ...DAILY_KEYS.map((k) => ({ id: `daily ${k}`, seed: dailySeed(k) }))];
}

const replacer = (_k: string, v: unknown): unknown => {
  if (typeof v === 'number') {
    if (Object.is(v, -0)) return '-0';
    if (!Number.isFinite(v)) return String(v);
  }
  if (v instanceof Uint8Array || v instanceof Float32Array || v instanceof Float64Array) return Array.from(v);
  return v;
};

/** A 64-bit FNV-1a of a value's JSON (16 hex digits). */
export function digest(value: unknown): string {
  const s = JSON.stringify(value, replacer);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c ^ (i & 255), 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

/** SectionShape's fields as the base had them, in PLAIN's key order. */
const SHAPE_KEYS = ['slope', 'width', 'wander', 'wave', 'span', 'split', 'roller', 'obstacles', 'kickers', 'moguls', 'drops', 'pin', 'wall', 'fall', 'relief', 'limit', 'ice', 'ridge', 'lane', 'shift', 'reach'] as const;
/** The run-out as the base had it (course.ts RUN_OUT). */
const RUN_OUT = 260;
/** The grid's x offsets from the centre line. */
const XS = [0, -2, 2, -5, 5, -9, 9, -14, 14, -20, 20];

/** Everything a course is made of, as values. */
export function courseFacts(seed: number): unknown {
  const c = new Course(seed);
  const end = c.finishZ + RUN_OUT + 200;
  const sections: unknown[] = [];
  for (let z = 0; z < end; ) {
    const s = c.section(z);
    sections.push([s.kind, s.z0, s.z1, s.blend, s.side, s.drop0, s.phase0, s.fall0, SHAPE_KEYS.map((k) => s.shape[k]), s.gate === true, s.ledges.length]);
    z = s.z1;
  }
  const chunks: unknown[] = [];
  const n = Math.ceil((c.finishZ + RUN_OUT) / CHUNK_LEN) + 2;
  for (let i = 0; i < n; i++) {
    const ch = c.chunk(i);
    const zn = ch.zones;
    chunks.push([
      ch.index,
      ch.z0,
      ch.z1,
      ch.obstacles.map((o) => [o.id, o.kind, o.x, o.z, o.x2, o.z2, o.r, o.h, o.y, o.soft, o.scale, o.rot]),
      zn.ramps.map((r) => [r.x, r.z, r.len, r.w, r.h, r.online === true]),
      zn.drops.map((d) => [d.z, d.depth, d.len, d.rec]),
      zn.moguls.map((m) => [m.z0, m.z1, m.amp, m.phase, m.wave]),
      zn.ice.map((p) => [p.x, p.z, p.rx, p.rz]),
      zn.vents.map((v) => [v.id, v.x, v.z, v.r, v.power]),
      zn.rails.map((r) => [r.id, r.x0, r.z0, r.x1, r.z1, r.h]),
      zn.keepOut.map((b) => [b.z0, b.z1, b.x0, b.x1, b.vents === true]),
      ch.gates.map((g) => [g.id, g.x1, g.x2, g.z]),
      ch.lights.map((l) => [l.id, l.x, l.z, l.hover, l.value]),
    ]);
  }
  const grid: number[] = [];
  for (let z = -10; z < end; z += 2.5) {
    const cx = c.centerX(z);
    grid.push(z, cx, c.safeX(z), c.halfWidth(z), c.baseY(z), c.edgeLimit(z), c.altX(z) ?? -1e9);
    for (const dx of XS) {
      const x = cx + dx;
      const sf = c.surface(x, z);
      grid.push(c.ground(x, z), c.edgeExcess(x, z), c.backX(z, x), sf.grip, sf.drag, sf.ice ? 1 : 0);
    }
  }
  const plain: ChaosRoll = { mood: Mood.None, event: ChaosEvent.None, seed: 0x5eed };
  const comet: ChaosRoll = { mood: Mood.Comet, event: ChaosEvent.None, seed: 0x5eed };
  const plays = [0, 1, 2].map((v) => momentPlays(c, rollForVariant(c, plain, v)));
  return {
    stages: c.stages,
    finishZ: c.finishZ,
    sections,
    ledges: c.ledges,
    leaps: c.leaps.map((l) => l.z),
    charmGateZs: c.charmGateZs,
    stageGates: c.stageGates,
    skyGates: c.skyGates,
    wallLines: c.wallLines,
    chunks,
    grid,
    moments: planMoments(c),
    plays,
    comet: momentPlays(c, comet),
    legends: planLegends(c),
    climax: climaxOf(c),
  };
}

/** Every roll the game makes, as values: a run's chaos, its event's trigger, the Cup's and the Trial's weeks, a night's
 *  legs. */
export function chaosFacts(): unknown {
  const rolls: unknown[] = [];
  for (let s = 0; s < 2000; s++) {
    const seed = (s * 2654435761) >>> 0;
    for (const run of [0, 1, 3]) for (const last of [Mood.None, Mood.GlassIce]) {
      const r = rollChaos(seed, run, last);
      rolls.push([r.mood, r.event, r.seed, r.legend ?? 0, eventTriggerZ(r)]);
    }
  }
  const weeks: string[] = [];
  for (let w = 0; w < 60; w++) {
    const y = 2026 + Math.floor(w / 30);
    weeks.push(`${y}-W${String(1 + (w % 30) + (w >= 30 ? 10 : 0)).padStart(2, '0')}`);
  }
  const cups = weeks.map((k) => cupChaos(k));
  const trials = weeks.map((k) => trialFor(k));
  const legs: unknown[] = [];
  for (let n = 0; n < 20; n++) for (let leg = 0; leg < 10; leg++) legs.push(legChaos((n * 40503 + 17) >>> 0, leg));
  return { rolls, cups, trials, legs };
}

/** tests/determinism.test.ts's busy scripted rider, copied as it stood at the base so it never moves: it follows the
 *  line, carves, drifts, pops, spins, flips, stomps and drafts. The hash of every 30th tick. */
export function scriptedRide(seed: number, chaos: ChaosRoll, sled: number, ticks: number): number[] {
  const sim = new Sim({ seed, chaos, sled });
  const rec = new InputRecorder();
  const rng = new Rng(seed ^ chaos.seed);
  const out: number[] = [];
  let steer = 4;
  let action = false;
  let hold = 0;
  let revived = false;
  for (let t = 0; t < ticks; t++) {
    if (sim.s.crashed) {
      if (revived) break;
      revived = true;
      rec.event(LogEvent.Revive);
      sim.revive();
    }
    const s = sim.s;
    if (hold-- <= 0) {
      hold = rng.int(5, 30);
      if (s.grounded) {
        const look = s.z + 6 + s.speed * 0.4;
        const want = Math.atan2(sim.course.safeX(look) - s.x, look - s.z) - s.velHeading;
        steer = Math.max(0, Math.min(8, Math.round(4 + want * 9 + rng.int(-2, 2))));
        action = rng.chance(0.35);
      } else {
        steer = rng.chance(0.4) ? (rng.chance(0.5) ? 0 : 8) : 4;
        action = rng.chance(0.3);
        hold = rng.int(3, 12);
      }
    }
    const byte = packInput(steer, action, rng.chance(0.01));
    rec.push(byte);
    sim.step(byte);
    if (t % 30 === 0) out.push(sim.hash());
  }
  out.push(sim.hash(), sim.score, sim.distance, sim.tick);
  return out;
}

/** The three rolls a scripted ride runs on: plain, a mood with an event, a legend's. */
export const SCRIPT_ROLLS: readonly ChaosRoll[] = [
  { mood: Mood.None, event: ChaosEvent.None, seed: 11 },
  { mood: Mood.Powder, event: ChaosEvent.Avalanche, seed: 2024 },
  { mood: Mood.Lantern, event: ChaosEvent.None, seed: 77, legend: 1 },
];

/** A bot's whole run: its input bytes, its length, its score and distance, and the sim's last hash. */
export function botRide(seed: number, skill: number, style: 'racer' | 'stunt'): unknown {
  const { record, sim } = runBot(seed, rollChaos(seed ^ 0xb0b, 3), { skill, seed: (seed ^ Math.round(skill * 1000)) >>> 0, sled: 0, name: 'Five', style });
  return [Array.from(record.inputs), record.ticks, record.score, record.distance, sim.hash(), sim.tick];
}

/** The bot rides the digest takes: three skills and two styles, on the five and one Daily. */
export const BOT_SKILLS = [0.25, 0.55, 0.9] as const;
export const BOT_STYLES = ['racer', 'stunt'] as const;

/** A lab pilot's whole ride (scripts/playtest/labpilots.ts, as lab.ts rides it, with no lantern spent): the sim's
 *  last hash, its tick, score and distance. */
export function pilotRide(seed: number, name: 'mid' | 'clumsy', pilotSeed: number): unknown {
  const sim = new Sim({ seed, chaos: rollChaos(pilotSeed, 3), sled: 0 });
  const pilot = name === 'clumsy' ? clumsy(sim, pilotSeed) : classic('mid', sim, pilotSeed, { gateX, pathX, machineZ });
  while (!sim.s.crashed && !sim.finished && sim.tick < 900 * 60) {
    const o = pilot();
    sim.step((o.steer | 0) | (o.action ? 16 : 0));
    pilot.after?.();
  }
  return [sim.hash(), sim.tick, sim.score, sim.distance];
}
