import { describe, expect, it } from 'vitest';
import { cupSeed } from '../src/game/cup';
import { ChaosEvent, PLAIN } from '../src/sim/chaos';
import { CHUNK_LEN, Course, THRESHOLD_AFTER, THRESHOLD_AFTER_MIN, THRESHOLD_BEFORE, THRESHOLD_BEFORE_MAX, eventsFor, finishZFor } from '../src/sim/course';
import { packInput } from '../src/sim/input';
import { GULLHAVEN_LAB_SEED, dailySeed } from '../src/sim/mountains';
import { gateX, machineZ, pathX } from '../src/sim/moments';
import { COLUMN_HW, COLUMN_SOFT, DRIFT, GULLHAVEN_LAYOUT, SHELF_W0, boldX, gullySpan, gulliesOf } from '../src/sim/gullhaven';
import { DT, Sim } from '../src/sim/sim';
import { classic, clumsy } from '../scripts/playtest/labpilots';

// Gullhaven's own promises (round 9, notes/r9-ground.md section 6, notes/r9-gullhaven.md): the five's (the first minute,
// the leaps, the kickers, the square) are not its, and these are. A rider who does not steer stays on the path; one who
// holds the straight line at a gully's lip is carried over its mouth and comes down on its face or the far shelf; nobody
// goes over the cliff; and nothing floors a rider here but a long flight landed wrong.

const SEED = GULLHAVEN_LAB_SEED;
const course = new Course(SEED);
const END = course.finishZ;
const GS = gulliesOf(course);

/** A sim with the sled set down at z on x, moving at v along the line's own direction there (as a revive sets it). */
function placed(z: number, x: number, v: number, chaos = PLAIN): Sim {
  const sim = new Sim({ seed: SEED, chaos, sled: 0 });
  const c = sim.course;
  const s = sim.s;
  const dir = Math.atan((c.centerX(z + 1) - c.centerX(z - 1)) / 2);
  s.z = z;
  s.x = x;
  s.y = c.ground(x, z);
  s.speed = v;
  s.heading = dir;
  s.velHeading = dir;
  s.vx = v * Math.sin(dir);
  s.vz = v * Math.cos(dir);
  const grad = { x: 0, z: 0 };
  c.gradient(x, z, grad);
  s.vy = grad.x * s.vx + grad.z * s.vz;
  sim.maxZ = z;
  return sim;
}

/** A steady hand to a line: steer for it, no button (or the crouch into a lip and the spring at it). */
function toLine(sim: Sim, line: (z: number) => number, lip = -1): () => number {
  return () => {
    const s = sim.s;
    if (!s.grounded) return packInput(4, false, false);
    const look = s.z + 4 + s.speed * 0.35;
    const err = Math.atan2(line(look) - s.x, look - s.z) - s.velHeading + (line(s.z) - s.x) * 0.08;
    let lvl = Math.max(0, Math.min(8, Math.round(4 + err * 14)));
    const d = lip - s.z;
    const crouch = lip > 0 && d < s.speed * 0.9 && d > s.speed * DT * 1.5;
    if (crouch) lvl = Math.max(3, Math.min(5, lvl));
    return packInput(lvl, crouch, false);
  };
}

describe('Gullhaven: its descent', () => {
  it('is its own: three stages to 4,800 m, a threshold at each stage line, the harbour at the line', () => {
    expect(course.layout).toBe(GULLHAVEN_LAYOUT);
    expect(course.kit?.id).toBe('gullhaven');
    expect(finishZFor(SEED)).toBe(4800);
    expect(course.stages.map((s) => s.name)).toEqual(['The Cape', 'The Geos', 'The Harbour Road']);
    for (const st of course.stages.slice(1)) {
      const sec = course.section(st.z0);
      expect(sec.gate, `threshold at ${st.z0}`).toBe(true);
      expect(sec.kind).toBe('cliffpath');
      expect(st.z0 - sec.z0).toBeGreaterThanOrEqual(THRESHOLD_BEFORE);
      expect(st.z0 - sec.z0).toBeLessThanOrEqual(THRESHOLD_BEFORE_MAX);
      expect(sec.z1 - st.z0).toBeGreaterThanOrEqual(THRESHOLD_AFTER_MIN);
      expect(sec.z1 - st.z0).toBeLessThanOrEqual(THRESHOLD_AFTER);
    }
    expect(course.section(END - 1).kind).toBe('harbour');
    expect(course.leaps).toEqual([]);
    expect(course.ledges).toEqual([]);
    expect(course.charmGateZs).toEqual([110, 1650, 3250]);
  });

  it('has a gully at least every 600 m, the first lip past 330 m, one the Great Geo, none in a threshold', () => {
    expect(GS.length).toBeGreaterThanOrEqual(9);
    expect(GS[0].zL).toBeGreaterThanOrEqual(330);
    expect(GS[0].zL).toBeLessThanOrEqual(600);
    for (let i = 1; i < GS.length; i++) expect(GS[i].zL - GS[i - 1].zL, `gully ${i}`).toBeLessThanOrEqual(600);
    expect(GS.filter((g) => g.great).length).toBe(1);
    for (const g of GS) {
      const sp = gullySpan(g);
      for (let z = sp.z0; z <= sp.z1; z += 5) expect(course.section(z).gate, `threshold in gully ${g.index} at ${z}`).toBeFalsy();
      if (g.index > 0) expect(sp.z0).toBeGreaterThan(gullySpan(GS[g.index - 1]).z1);
    }
  });

  it('stands nothing on the run, launches nothing of the five\'s, and its path has no crest', () => {
    for (let i = 0; i * CHUNK_LEN < END + 400; i++) {
      const ch = course.chunk(i);
      expect(ch.obstacles, `chunk ${i}`).toEqual([]);
      expect(ch.zones.ramps).toEqual([]);
      expect(ch.zones.vents).toEqual([]);
      expect(ch.zones.rails).toEqual([]);
      expect(ch.zones.drops).toEqual([]);
    }
    const h = 2;
    const y = (z: number): number => course.ground(course.safeX(z), z);
    for (let z = 4; z < END; z += 1) expect((y(z + h) - 2 * y(z) + y(z - h)) / (h * h), `crest at ${z}`).toBeGreaterThan(-0.0112);
  });

  it('keeps the safe line off every gully\'s mouth: 4 m clear of the shelf\'s rise and of the column', () => {
    for (const g of GS) {
      const sp = gullySpan(g);
      for (let z = sp.z0; z <= sp.z1; z += 2) {
        const sx = course.safeX(z);
        // (The path's middle, but where a threshold's calm wander still reaches.)
        expect(Math.abs(sx - course.centerX(z)), `line off the path at ${z}`).toBeLessThan(1);
        expect(sx + 3).toBeLessThan(course.centerX(z) + SHELF_W0 + 1e-9);
        for (const y of [-50, 0, 50, 200]) expect(course.liftAt(sx + 4, course.ground(sx, z) + y, z), `lift at ${z}`).toBe(0);
        if (course.liftX(z) !== null) expect(Math.abs(course.liftX(z)! - sx)).toBeGreaterThan(COLUMN_HW + COLUMN_SOFT + 4);
      }
    }
  });

  it('meets the avalanche, the light storm and the spirit train, never the yeti', () => {
    expect(eventsFor(SEED)).toBe((1 << ChaosEvent.Avalanche) | (1 << ChaosEvent.GiftStorm) | (1 << ChaosEvent.GhostTrain));
    const sim = new Sim({ seed: SEED, chaos: { mood: 0, event: ChaosEvent.Yeti, seed: 3 }, sled: 0 });
    expect(sim.dyn.triggerZ).toBe(Infinity);
  });

  it('is no Daily and no Cup, to 2040', () => {
    const day0 = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 365 * 15; d++) expect(dailySeed(new Date(day0 + d * 86400000).toISOString().slice(0, 10))).not.toBe(SEED);
    for (let yr = 2026; yr <= 2040; yr++) for (let w = 1; w <= 53; w++) expect(cupSeed(`${yr}-W${String(w).padStart(2, '0')}`)).not.toBe(SEED);
  });
});

describe('Gullhaven: the wind', () => {
  it('lifts only over a gully\'s mouth, below gravity, the same for any course built from the seed', () => {
    const other = new Course(SEED);
    let lifted = 0;
    for (let z = 0; z < END; z += 3) {
      for (let dx = -25; dx <= 25; dx += 1.5) {
        const x = course.centerX(z) + dx;
        const a = course.liftAt(x, 0, z);
        expect(a).toBe(other.liftAt(x, 0, z));
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(9.81);
        if (a > 0) {
          lifted++;
          const g = GS.find((q) => z >= q.zL - 4 && z <= q.zL + q.column + 12);
          expect(g, `lift at ${z} outside a mouth`).toBeDefined();
        }
      }
    }
    expect(lifted).toBeGreaterThan(100);
  });

  it('acts only on a sled in the air: a run on the path never asks for it, a soaring one only while airborne', () => {
    for (const soar of [false, true]) {
      const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 0 });
      const c = sim.course;
      const raw = c.liftAt.bind(c);
      let asked = 0;
      let onSnow = 0;
      c.liftAt = (x: number, y: number, z: number): number => {
        asked++;
        if (sim.s.grounded) onSnow++;
        return raw(x, y, z);
      };
      const g = GS[1];
      const go = toLine(sim, soar ? (z) => boldX(c, g, z) : (z) => c.safeX(z), soar ? g.zL : -1);
      while (sim.s.z < gullySpan(g).z1 && !sim.s.crashed) sim.step(go());
      if (soar) expect(asked).toBeGreaterThan(60);
      else expect(asked).toBe(0);
      expect(onSnow).toBe(0);
    }
  });

  it('carries a sled off every lip, at 24, 30 and 36 m/s, plain and popped, down on its face or the far shelf', () => {
    for (const g of GS) {
      const land: Record<string, number> = {};
      for (const v of [24, 30, 36]) {
        for (const pop of [false, true]) {
          const z0 = g.zL - 60;
          const sim = placed(z0, boldX(course, g, z0), v);
          const c = sim.course;
          const go = toLine(sim, (z) => boldX(c, g, z), pop ? g.zL : -1);
          let flew = 0;
          let landed: { z: number; slope: number; x: number; drift: boolean } | null = null;
          while (!landed && sim.s.z < gullySpan(g).z1 + 200 && !sim.s.crashed) {
            sim.step(go());
            if (!sim.s.grounded) flew++;
            for (const e of sim.events) {
              if (e.type === 'land' && e.airtime > 1 && !landed) {
                const grad = { x: 0, z: 0 };
                c.gradient(sim.s.x, sim.s.z, grad);
                landed = { z: sim.s.z, slope: -grad.z, x: sim.s.x, drift: c.surface(sim.s.x, sim.s.z) === DRIFT };
              }
            }
          }
          const tag = `gully ${g.index} at ${v} m/s ${pop ? 'popped' : 'plain'}`;
          expect(landed, tag).not.toBeNull();
          expect(landed!.z, tag).toBeGreaterThan(g.zL + 20);
          expect(landed!.slope, tag).toBeLessThanOrEqual(0.8);
          expect(landed!.drift, tag).toBe(false);
          expect(Math.abs(landed!.x - c.centerX(landed!.z)), tag).toBeLessThan(c.halfWidth(landed!.z) - 1);
          expect(flew, tag).toBeGreaterThan(60);
          land[`${v}${pop}`] = landed!.z;
        }
      }
      // (Slower comes down sooner, on the face.)
      expect(land['24false']).toBeLessThan(land['36false']);
      expect(land['24true']).toBeLessThan(land['36true']);
    }
  }, 60_000);

  it('leaves a sled let go on the path 20 m before every gully on the path through it', () => {
    for (const g of GS) {
      const z0 = gullySpan(g).z0 - 20;
      const sim = placed(z0, course.safeX(z0), 27);
      const c = sim.course;
      let maxOff = 0;
      let air = 0;
      while (sim.s.z < gullySpan(g).z1 && !sim.s.crashed) {
        sim.step(packInput(4, false, false));
        maxOff = Math.max(maxOff, sim.s.x - c.centerX(sim.s.z));
        if (!sim.s.grounded) air++;
      }
      expect(maxOff, `gully ${g.index}`).toBeLessThan(SHELF_W0);
      expect(air, `gully ${g.index}`).toBeLessThan(6);
    }
  });

  it('turns every sled back at the fence: a hand that steers for the sea through every gully never goes over', () => {
    const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 0 });
    const c = sim.course;
    let lowest = 0;
    let scrapes = 0;
    while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 500) {
      const s = sim.s;
      // Full lock seaward through every gully, else back toward the path.
      const inGully = GS.some((g) => s.z > gullySpan(g).z0 && s.z < gullySpan(g).z1);
      sim.step(packInput(inGully ? 8 : s.x > c.centerX(s.z) ? 1 : 7, sim.tick % 120 < 40, false));
      for (const e of sim.events) if (e.type === 'scrape') scrapes++;
      if (!s.finished) {
        lowest = Math.min(lowest, s.y - c.baseY(s.z));
        const k = c.section(s.z).kind;
        if (k === 'cliffpath' || k === 'geo') expect(s.x - c.centerX(s.z) - c.halfWidth(s.z)).toBeLessThan(c.edgeLimit(s.z) + 0.05);
      }
    }
    expect(sim.finished).toBe(true);
    expect(scrapes).toBeGreaterThan(0);
    expect(lowest).toBeGreaterThan(-30);
  });

  it('lets the clumsy pilot finish, every time', () => {
    for (const seed of [1234, 1271, 1308, 1345, 1382, 1419]) {
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

describe('Gullhaven: soaring pays (notes/r9-gullhaven.md section 1, the lab bar)', () => {
  const kit = { gateX, pathX, machineZ };
  /** One lab pilot's run: its time, its gullies' time, its soared flights and every fall's cause. */
  const pilot = (skill: 'mid', seed: number, floor = false): { seconds: number; gullies: number; flights: number[]; falls: number } => {
    const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 0 });
    const p = classic(skill, sim, seed, { ...kit, floor });
    let gullies = 0;
    let falls = 0;
    let off = -1;
    const flights: number[] = [];
    while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
      const o = p();
      sim.step((o.steer | 0) | (o.action ? 16 : 0));
      const s = sim.s;
      if (!s.finished && GS.some((g) => s.z >= gullySpan(g).z0 && s.z < gullySpan(g).z1)) gullies += DT;
      for (const e of sim.events) {
        if (e.type === 'takeoff') off = GS.some((g) => Math.abs(g.zL - s.z) < 12) ? sim.tick : -1;
        else if (e.type === 'land' && off >= 0 && e.airtime > 1) flights.push(e.airtime);
        else if (e.type === 'tumble' && e.phase === 'start') falls++;
      }
    }
    expect(sim.finished).toBe(true);
    return { seconds: sim.s.finishTick / 60, gullies, flights, falls };
  };

  it('the mid pilot soaring beats its own hands on the path by 10 to 20% of the gullies, in flights of 3 to 7 s', () => {
    for (const seed of [1234, 1271]) {
      const soar = pilot('mid', seed);
      const path = pilot('mid', seed, true);
      const gain = (path.gullies - soar.gullies) / path.gullies;
      expect(gain, `seed ${seed}`).toBeGreaterThanOrEqual(0.1);
      expect(gain, `seed ${seed}`).toBeLessThanOrEqual(0.2);
      expect(soar.flights.length).toBeGreaterThanOrEqual(Math.ceil(0.7 * GS.length));
      const sorted = soar.flights.slice().sort((a, b) => a - b);
      expect(sorted[sorted.length >> 1]).toBeGreaterThanOrEqual(3);
      expect(sorted[sorted.length >> 1]).toBeLessThanOrEqual(5);
      expect(Math.max(...soar.flights)).toBeGreaterThan(5.78);
      expect(soar.seconds).toBeGreaterThan(140);
      expect(soar.seconds).toBeLessThan(172);
      expect(path.flights).toEqual([]);
    }
  }, 60_000);
});
