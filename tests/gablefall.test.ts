import { describe, expect, it } from 'vitest';
import { cupSeed } from '../src/game/cup';
import { ALL_EVENTS, PLAIN } from '../src/sim/chaos';
import { CHUNK_LEN, Course, THRESHOLD_AFTER, THRESHOLD_AFTER_MIN, THRESHOLD_BEFORE, THRESHOLD_BEFORE_MAX, eventsFor, finishZFor } from '../src/sim/course';
import { GABLEFALL_SEED, dailySeed } from '../src/sim/mountains';
import { gateX, machineZ, pathX } from '../src/sim/moments';
import { BACK, CHIMNEY_CLEAR, FRONT, GABLEFALL_LAYOUT, PAVE, RIDGE, UP, driftsOf, rowsOf } from '../src/sim/gablefall';
import { Sim } from '../src/sim/sim';
import { classic, clumsy } from '../scripts/playtest/labpilots';

// Gablefall's own promises (round 9, notes/r9-ground.md section 7, notes/r9-gablefall.md): the five's (the first minute,
// the leaps, the kickers, the square) are not its, and these are. The street is the safe line, clear, slow and always
// there; each roof is a step under the last and never higher; a sled is never lifted onto a roof from the side; a drift
// back up is never far; and nothing floors a rider here but a chimney met head on or a long flight landed wrong.

const SEED = GABLEFALL_SEED;
const course = new Course(SEED);
const END = course.finishZ;
const ROWS = rowsOf(course);
const DRIFTS = driftsOf(course);

/** A sim with the sled set down at (x, z), moving at v at `yaw` off the street's own direction there, on the ground or
 *  `up` m over it. */
function placed(z: number, x: number, v: number, yaw: number, up = 0): Sim {
  const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 0 });
  const c = sim.course;
  const s = sim.s;
  const dir = Math.atan((c.centerX(z + 1) - c.centerX(z - 1)) / 2) + yaw;
  s.z = z;
  s.x = x;
  s.y = c.ground(x, z) + up;
  s.speed = v;
  s.heading = dir;
  s.velHeading = dir;
  s.vx = v * Math.sin(dir);
  s.vz = v * Math.cos(dir);
  s.vy = 0;
  s.grounded = up === 0;
  sim.maxZ = z;
  return sim;
}

/** The piece of a row at z, or null. */
const pieceAt = (side: -1 | 1, z: number) => {
  const row = ROWS.find((r) => r.side === side && z >= r.z0 && z < r.z1);
  return row ? (row.pieces.find((p) => z >= p.z0 && z < p.z1) ?? null) : null;
};

describe('Gablefall: its descent', () => {
  it('is its own: three stages to 2,800 m, a market square at each stage line, the river at the line', () => {
    expect(course.layout).toBe(GABLEFALL_LAYOUT);
    expect(course.kit?.id).toBe('gablefall');
    expect(course.hasLevels).toBe(true);
    expect(finishZFor(SEED)).toBe(2800);
    expect(course.stages.map((s) => s.name)).toEqual(['Church Hill', 'The Market', 'The Water Stairs']);
    expect(course.section(10).kind).toBe('nave');
    for (const st of course.stages.slice(1)) {
      const sec = course.section(st.z0);
      expect(sec.gate, `threshold at ${st.z0}`).toBe(true);
      expect(sec.kind).toBe('square');
      expect(st.z0 - sec.z0).toBeGreaterThanOrEqual(THRESHOLD_BEFORE);
      expect(st.z0 - sec.z0).toBeLessThanOrEqual(THRESHOLD_BEFORE_MAX);
      expect(sec.z1 - st.z0).toBeGreaterThanOrEqual(THRESHOLD_AFTER_MIN);
      expect(sec.z1 - st.z0).toBeLessThanOrEqual(THRESHOLD_AFTER);
    }
    expect(course.section(END - 1).kind).toBe('quay');
    expect(course.leaps).toEqual([]);
    expect(course.ledges).toEqual([]);
    expect(course.charmGateZs).toEqual([110, 1000, 1950]);
  });

  it('lays rows both sides of each run of street, each ending on a house before the square or the river', () => {
    expect(ROWS.length).toBe(6);
    for (const r of ROWS) {
      expect(r.pieces[0].kind, `row ${r.side} ${r.z0}`).toBe('drift');
      expect(r.pieces[r.pieces.length - 1].kind, `row ${r.side} ${r.z0}`).toBe('house');
      for (let i = 1; i < r.pieces.length; i++) expect(r.pieces[i].z0).toBe(r.pieces[i - 1].z1);
      expect(course.section(r.z1 + 15).kind, `row ${r.side} ${r.z0}`).toBe('rooftops');
      // (Nobody crosses the finish line on a roof.)
      expect(r.z1).toBeLessThan(END - 60);
    }
  });

  it('keeps the street clear and stands nothing of the five\'s: every obstacle a chimney on a roof, clear of the ridge', () => {
    let chimneys = 0;
    for (let i = 0; i * CHUNK_LEN < END + 300; i++) {
      const ch = course.chunk(i);
      expect(ch.zones.ramps).toEqual([]);
      expect(ch.zones.vents).toEqual([]);
      expect(ch.zones.rails).toEqual([]);
      expect(ch.zones.drops).toEqual([]);
      for (const o of ch.obstacles) {
        chimneys++;
        expect(o.kind).toBe('chimney');
        const adx = Math.abs(o.x - course.centerX(o.z));
        expect(adx - o.r, `chimney at ${o.z.toFixed(0)}`).toBeGreaterThan(FRONT);
        expect(adx + o.r).toBeLessThan(BACK);
        expect(Math.abs(adx - RIDGE) - o.r, `chimney at ${o.z.toFixed(0)} on the ridge`).toBeGreaterThanOrEqual(Math.min(CHIMNEY_CLEAR, 1.5));
        expect(o.y - course.baseY(o.z), `chimney at ${o.z.toFixed(0)} not on a roof`).toBeGreaterThan(UP);
      }
    }
    expect(chimneys / (END / 1000)).toBeGreaterThan(40);
  });

  it('never rises along any line across the rows but up a drift or an alley\'s floor', () => {
    for (const r of ROWS) {
      // (Every 0.5 m of x, a quarter off the walls: a line along a sheer house front is on both sides of it at once.)
      for (let adx = 0.25; adx <= BACK; adx += 0.5) {
        let prev = course.ground(course.centerX(r.z0) + r.side * adx, r.z0);
        for (let z = r.z0 + 0.25; z < r.z1; z += 0.25) {
          const y = course.ground(course.centerX(z) + r.side * adx, z);
          if (y > prev + 1e-6) {
            const p = pieceAt(r.side, z);
            expect(p && adx >= PAVE && (p.kind === 'drift' || p.kind === 'alley'), `rise at ${z} x ${adx} (${p?.kind})`).toBe(true);
          }
          prev = y;
        }
      }
    }
  });

  it('drops a sled off a roof onto ground at most 9 m lower: off a front eave, a step, an alley or a row\'s end', () => {
    for (const r of ROWS) {
      for (const p of r.pieces) {
        if (p.kind !== 'house') continue;
        for (const adx of [FRONT + 0.1, RIDGE, BACK - 0.1]) {
          const x = (z: number): number => course.centerX(z) + r.side * adx;
          const top = course.ground(x(p.z1 - 0.05), p.z1 - 0.05);
          const below = course.ground(x(p.z1 + 1), p.z1 + 1);
          expect(top - below, `step at ${p.z1}`).toBeLessThanOrEqual(9);
        }
        for (let z = p.z0 + 0.5; z < p.z1; z += 2) {
          const eave = course.ground(course.centerX(z) + r.side * (FRONT + 0.05), z);
          const street = course.ground(course.centerX(z) + r.side * (FRONT - 0.3), z);
          expect(eave - street, `front at ${z}`).toBeLessThanOrEqual(9);
          expect(eave - street, `front at ${z}`).toBeGreaterThan(UP);
        }
      }
    }
  });

  it('has a corner drift up onto the roofs at the head of every row and at least every 250 m down each run', () => {
    for (const r of ROWS) expect(DRIFTS.some((d) => d.side === r.side && d.z0 === r.z0)).toBe(true);
    const runs = [...new Set(ROWS.map((r) => r.z0))];
    for (const z0 of runs) {
      const end = Math.max(...ROWS.filter((r) => r.z0 === z0).map((r) => r.z1));
      const feet = DRIFTS.filter((d) => d.z0 >= z0 && d.z0 < end).map((d) => d.z0);
      feet.push(end);
      for (let i = 1; i < feet.length; i++) expect(feet[i] - feet[i - 1], `from ${feet[i - 1]}`).toBeLessThanOrEqual(250);
    }
  });

  it('meets all four mid-run events, and is no Daily and no Cup, to 2040', () => {
    expect(eventsFor(SEED)).toBe(ALL_EVENTS);
    const day0 = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 365 * 15; d++) expect(dailySeed(new Date(day0 + d * 86400000).toISOString().slice(0, 10))).not.toBe(SEED);
    for (let yr = 2026; yr <= 2040; yr++) for (let w = 1; w <= 53; w++) expect(cupSeed(`${yr}-W${String(w).padStart(2, '0')}`)).not.toBe(SEED);
  });
});

describe('Gablefall: the held street', () => {
  it('holds a sled at the street\'s level to the street, on the ground or in a pop, everywhere but a drift\'s foot', () => {
    let feet = 0;
    for (const r of ROWS) {
      for (let z = r.z0 + 1; z < r.z1 - 1; z += 1.5) {
        const p = pieceAt(r.side, z);
        if (!p) continue;
        const edge = p.kind === 'drift' ? PAVE : FRONT;
        const x = course.centerX(z) + r.side * (edge - 0.05);
        const s0 = course.baseY(z);
        for (const up of [0, 1.8]) {
          const sim = placed(z, x, 26, r.side * 0.35, up);
          // (Two ticks: the most its height rose in either, a landing included.)
          let rose = 0;
          for (let k = 0; k < 2; k++) {
            const y = sim.s.y;
            sim.step(4);
            rose = Math.max(rose, sim.s.y - y);
          }
          const s = sim.s;
          // On a drift's foot it may step onto the drift, flush with the street; anywhere else it is never lifted.
          const foot = p.kind === 'drift' && course.ground(course.centerX(z) + r.side * (PAVE + 0.3), z) - s0 < 0.45;
          if (foot && Math.abs(s.x - course.centerX(s.z)) >= PAVE) feet++;
          if (!foot) {
            expect(rose, `lifted at ${z.toFixed(1)} ${p.kind} up ${up}`).toBeLessThan(0.5);
            if (up === 0) expect(Math.abs(s.x - course.centerX(s.z)), `through the side at ${z.toFixed(1)}`).toBeLessThan(edge);
          }
        }
      }
    }
    expect(feet, 'a drift\'s foot lets a sled on').toBeGreaterThan(0);
  });

  it('never lifts a rider in a tick: the mid, the expert, the novice and the clumsy pilot ride it with no jump of 0.5 m', () => {
    const kit = { gateX, pathX, machineZ };
    for (const who of ['mid', 'expert', 'novice', 'clumsy'] as const) {
      const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 0 });
      const pilot = who === 'clumsy' ? clumsy(sim, 1271) : classic(who, sim, 1271, kit);
      let most = 0;
      while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 900) {
        const y0 = sim.s.y;
        const g0 = sim.s.grounded;
        const o = pilot();
        sim.step((o.steer | 0) | (o.action ? 16 : 0));
        if (g0 && sim.s.grounded && sim.s.tumble === 0) most = Math.max(most, sim.s.y - y0);
      }
      expect(sim.finished, who).toBe(true);
      expect(most, who).toBeLessThan(0.5);
    }
  }, 60_000);

  it('lets the clumsy pilot finish, every time', () => {
    for (const seed of [1234, 1308, 1345, 1382, 1419, 1456]) {
      const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 0 });
      const pilot = clumsy(sim, seed);
      while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 900) {
        const o = pilot();
        sim.step((o.steer | 0) | (o.action ? 16 : 0));
      }
      expect(sim.finished, `clumsy ${seed}`).toBe(true);
    }
  }, 60_000);
});

describe('Gablefall: the roofs pay (notes/r9-gablefall.md section 1, the lab bar)', () => {
  it('the mid pilot on the roofs beats its own hands in the street by 10% or more, and floors only on a chimney or a landing', () => {
    const kit = { gateX, pathX, machineZ };
    for (const seed of [1234, 1271]) {
      const ride = (floor: boolean): { t: number; up: number; causes: string[] } => {
        const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 0 });
        const p = classic('mid', sim, seed, { ...kit, floor });
        let up = 0;
        const causes: string[] = [];
        while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
          const o = p();
          sim.step((o.steer | 0) | (o.action ? 16 : 0));
          const s = sim.s;
          if (course.ground(s.x, s.z) - course.baseY(s.z) >= UP - 0.5 && s.y >= course.ground(s.x, s.z) - 0.05) up++;
          for (const e of sim.events) if (e.type === 'tumble' && e.phase === 'start') causes.push(e.cause);
        }
        expect(sim.finished).toBe(true);
        return { t: sim.s.finishTick / 60, up: up / sim.tick, causes };
      };
      const roofs = ride(false);
      const street = ride(true);
      expect((street.t - roofs.t) / street.t, `seed ${seed}`).toBeGreaterThanOrEqual(0.1);
      expect(roofs.up).toBeGreaterThan(0.4);
      expect(street.up).toBe(0);
      for (const c of [...roofs.causes, ...street.causes]) expect(['chimney', 'landing']).toContain(c);
    }
  }, 60_000);
});
