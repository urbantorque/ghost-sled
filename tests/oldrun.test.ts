import { describe, expect, it } from 'vitest';
import { cupSeed } from '../src/game/cup';
import { ChaosEvent, PLAIN } from '../src/sim/chaos';
import { CHUNK_LEN, Course, THRESHOLD_AFTER, THRESHOLD_AFTER_MIN, THRESHOLD_BEFORE, THRESHOLD_BEFORE_MAX, eventsFor, finishZFor } from '../src/sim/course';
import { packInput } from '../src/sim/input';
import { MOUNTAINS, OLDRUN_LAB_SEED, dailySeed } from '../src/sim/mountains';
import { gateX, machineZ, pathX } from '../src/sim/moments';
import { FLOOR, GLAZE, LIP, MAX_SLOPE, OLDRUN_LAYOUT, WALL } from '../src/sim/oldrun';
import { Sim, TRACK_BANK, TRACK_DAMP, wallYaw } from '../src/sim/sim';
import { classic, clumsy } from '../scripts/playtest/labpilots';

// The Old Run's own promises (round 9, notes/r9-ground.md section 5), on its lab course: the five's (the first minute,
// the leaps, the kickers, the square) are not its, and these are. Nothing in its track can floor a rider: its walls
// turn a sled, its lip only scrapes, and no wall launches one that does not press.

const SEED = OLDRUN_LAB_SEED;
const course = new Course(SEED);
const END = course.finishZ;

/** A sled's run under one hand, with its takeoffs off the ground (not pops), scrapes and falls. */
function rideWith(hand: (sim: Sim) => number, chaos = PLAIN): { sim: Sim; lips: number; scrapes: number; falls: number } {
  const sim = new Sim({ seed: SEED, chaos, sled: 0 });
  let lips = 0;
  let scrapes = 0;
  let falls = 0;
  while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 600) {
    sim.step(hand(sim));
    for (const e of sim.events) {
      if (e.type === 'takeoff' && e.kind === 'lip') lips++;
      else if (e.type === 'scrape') scrapes++;
      else if (e.type === 'tumble' && e.phase === 'start') falls++;
    }
  }
  return { sim, lips, scrapes, falls };
}

describe('the Old Run: its descent', () => {
  it('is its own: three stages to 3,000 m, its kinds, a threshold at each stage line, the outrun at the line', () => {
    expect(course.layout).toBe(OLDRUN_LAYOUT);
    expect(course.kit?.id).toBe('oldrun');
    expect(finishZFor(SEED)).toBe(3000);
    expect(END).toBe(3000);
    expect(course.stages.map((s) => s.name)).toEqual(['The Hotel Straights', 'The Labyrinth', 'The Horseshoe']);
    for (const st of course.stages.slice(1)) {
      const sec = course.section(st.z0);
      expect(sec.gate, `threshold at ${st.z0}`).toBe(true);
      expect(st.z0 - sec.z0).toBeGreaterThanOrEqual(THRESHOLD_BEFORE);
      expect(st.z0 - sec.z0).toBeLessThanOrEqual(THRESHOLD_BEFORE_MAX);
      expect(sec.z1 - st.z0).toBeGreaterThanOrEqual(THRESHOLD_AFTER_MIN);
      expect(sec.z1 - st.z0).toBeLessThanOrEqual(THRESHOLD_AFTER);
    }
    expect(course.section(END - 1).kind).toBe('outrun');
    expect(course.leaps).toEqual([]);
    expect(course.charmGateZs).toEqual([110, 1050, 2050]);
  });

  it('runs no more than 35 degrees off the fall line, and bends no tighter than radius 40', () => {
    for (let z = 2; z < END + 200; z += 1) {
      expect(Math.abs(course.channelSlope(z)), `slope at ${z}`).toBeLessThanOrEqual(MAX_SLOPE + 1e-9);
      const k = Math.abs(course.centerX(z + 2) - 2 * course.centerX(z) + course.centerX(z - 2)) / 4;
      expect(k, `curvature at ${z}`).toBeLessThanOrEqual(1 / 40);
    }
  });

  it('stands nothing in the track: no collider, kicker, vent or rail, and its line is the floor', () => {
    for (let i = 0; i * CHUNK_LEN < END + 400; i++) {
      const ch = course.chunk(i);
      expect(ch.obstacles, `chunk ${i}`).toEqual([]);
      expect(ch.zones.ramps).toEqual([]);
      expect(ch.zones.vents).toEqual([]);
      expect(ch.zones.rails).toEqual([]);
    }
    // (The line keeps to the floor: a threshold lets it wander a little, as the five's do, never off the floor.)
    for (let z = 0; z < END; z += 5) expect(Math.abs(course.safeX(z) - course.centerX(z))).toBeLessThan(FLOOR - 1);
  });

  it('puts the charm gates on calm, plain track: straight, not ice, the arches inside the lip', () => {
    for (const gz of course.charmGateZs) {
      for (let z = gz - 50; z <= gz + 30; z += 2) {
        expect(Math.abs(course.channelSlope(z) - course.channelSlope(gz)), `bend at ${z}`).toBeLessThan(0.02);
        expect(course.surface(course.safeX(z), z).ice, `ice at ${z}`).toBe(false);
        expect(course.halfWidth(z)).toBeGreaterThan(4.6 + 1);
      }
    }
  });

  it('has no crest up either wall that would lift a sled at 46 m/s', () => {
    const limit = (1.5 * 9.81) / (46 * 46);
    const h = 2;
    for (const u of [0, 0.3, 0.5, 0.7, 0.85, 1]) {
      for (const side of [-1, 1]) {
        const y = (z: number): number => {
          const p = course.channelSlope(z);
          const q = Math.sqrt(1 + p * p);
          return course.ground(course.centerX(z) + side * (FLOOR + u * WALL) * q, z);
        };
        for (let z = 4; z < END; z += 1) {
          const k = (y(z + h) - 2 * y(z) + y(z - h)) / (h * h);
          expect(k, `crest at ${z}, u ${u}, side ${side}`).toBeGreaterThan(-limit);
        }
      }
    }
  });

  it('meets only the light storm and the spirit train', () => {
    expect(eventsFor(SEED)).toBe((1 << ChaosEvent.GiftStorm) | (1 << ChaosEvent.GhostTrain));
    const sim = new Sim({ seed: SEED, chaos: { mood: 0, event: ChaosEvent.Avalanche, seed: 3 }, sled: 0 });
    expect(sim.dyn.triggerZ).toBe(Infinity);
  });

  it('is no Daily, Cup or named mountain, to 2040', () => {
    expect(MOUNTAINS.some((m) => m.seed === SEED)).toBe(false);
    const day0 = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 365 * 15; d++) expect(dailySeed(new Date(day0 + d * 86400000).toISOString().slice(0, 10))).not.toBe(SEED);
    for (let y = 2026; y <= 2040; y++) for (let w = 1; w <= 53; w++) expect(cupSeed(`${y}-W${String(w).padStart(2, '0')}`)).not.toBe(SEED);
  });
});

describe('the Old Run: its walls', () => {
  it('turn a sled that never steers all the way to the line, with nothing launching it and nothing floored', () => {
    const r = rideWith(() => packInput(4, false, false));
    expect(r.sim.finished).toBe(true);
    expect(r.lips).toBe(0);
    expect(r.falls).toBe(0);
    expect(r.scrapes).toBe(0);
  });

  it('hold a rider who throws the sled at them, full lock one way then the other: scraped, never launched, never floored', () => {
    const r = rideWith((sim) => packInput(Math.floor(sim.tick / 150) % 2 ? 8 : 0, false, false));
    expect(r.sim.finished).toBe(true);
    expect(r.lips).toBe(0);
    expect(r.falls).toBe(0);
    expect(r.scrapes).toBeGreaterThan(0);
  });

  it('let the clumsy pilot finish, every time', () => {
    for (const seed of [1234, 1271, 1308, 1345, 1382, 1419]) {
      let pilot: ReturnType<typeof clumsy> | null = null;
      const r = rideWith((sim) => {
        if (!pilot) pilot = clumsy(sim, seed);
        const o = pilot();
        return (o.steer | 0) | (o.action ? 16 : 0);
      });
      expect(r.sim.finished, `clumsy ${seed}`).toBe(true);
    }
  }, 60_000);

  it('the surfaces lie where they should: slush in a bend floor, the glaze high on its outside wall, track ice elsewhere', () => {
    let slush = 0;
    let glaze = 0;
    for (let z = 150; z < END - 150; z += 3) {
      const pp = (course.centerX(z + 2) - 2 * course.centerX(z) + course.centerX(z - 2)) / 4;
      const p = course.channelSlope(z);
      const q = Math.sqrt(1 + p * p);
      if (Math.abs(pp) < 1 / 180) continue;
      const outside = pp > 0 ? -1 : 1;
      const floor = course.surface(course.centerX(z), z);
      if (floor.drag > 1) slush++;
      expect(course.surface(course.centerX(z) - outside * (FLOOR + 0.67 * WALL) * q, z).ice, `the inside wall at ${z}`).toBe(false);
      if (course.surface(course.centerX(z) + outside * (FLOOR + 0.67 * WALL) * q, z).ice) glaze++;
      expect(course.surface(course.centerX(z) + (LIP - 0.2) * q, z).drag).toBeLessThan(1);
    }
    expect(slush).toBeGreaterThan(50);
    expect(glaze).toBeGreaterThan(50);
  });
});

describe('the Old Run: its glaze pays (notes/r9-oldrun.md section 1, the lab bar)', () => {
  const kit = { gateX, pathX, machineZ, track: { wallYaw, damp: TRACK_DAMP, bank: TRACK_BANK } };
  /** One lab pilot's run: its time, the seconds it spends in the bends and the share of its grounded bend ticks on the glaze. */
  const pilot = (skill: 'mid' | 'expert', seed: number, floor = false): { seconds: number; bends: number; glaze: number } => {
    let p: ReturnType<typeof classic> | null = null;
    let bend = 0;
    let onGround = 0;
    let onGlaze = 0;
    const r = rideWith((sim) => {
      if (!p) p = classic(skill, sim, seed, { ...kit, floor });
      const s = sim.s;
      if (sim.tick > 0 && !sim.finished && Math.abs(course.centerX(s.z + 2) - 2 * course.centerX(s.z) + course.centerX(s.z - 2)) / 4 >= 1 / 180) {
        bend++;
        if (s.grounded) {
          onGround++;
          if (course.surface(s.x, s.z).drag === GLAZE.drag) onGlaze++;
        }
      }
      const o = p();
      return (o.steer | 0) | (o.action ? 16 : 0);
    });
    expect(r.sim.finished).toBe(true);
    expect(r.falls).toBe(0);
    return { seconds: r.sim.s.finishTick / 60, bends: bend / 60, glaze: onGlaze / Math.max(1, onGround) };
  };

  it('the mid pilot on its glaze line beats its own hands on the floor line by 10 to 20% of the bends, in 85 to 95 s', () => {
    for (const seed of [1234, 1271]) {
      const glaze = pilot('mid', seed);
      const floor = pilot('mid', seed, true);
      const gain = (floor.bends - glaze.bends) / floor.bends;
      expect(gain, `seed ${seed}`).toBeGreaterThanOrEqual(0.1);
      expect(gain, `seed ${seed}`).toBeLessThanOrEqual(0.2);
      expect(glaze.seconds).toBeGreaterThan(85);
      expect(glaze.seconds).toBeLessThan(95);
      expect(floor.glaze).toBe(0);
    }
  });

  it('the expert spends most of its bend time on the glaze', () => {
    expect(pilot('expert', 1234).glaze).toBeGreaterThan(0.5);
  });
});
