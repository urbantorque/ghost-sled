import { describe, expect, it } from 'vitest';
import { ChaosEvent, Mood, PLAIN } from '../src/sim/chaos';
import { CHUNK_LEN, Course, Obstacle, SAFE_LANE } from '../src/sim/course';
import { packInput } from '../src/sim/input';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { SLED_RADIUS, Sim } from '../src/sim/sim';

// Generation must guarantee a passable line at all times: a lane around the safe line that no
// collider, ramp or vent touches, that stays inside the corridor, and that a sled can physically
// follow at top speed. Violations are collected and asserted once so the scan stays fast.

const SEEDS = [
  ...MOUNTAINS.map((m) => m.seed),
  dailySeed('2026-10-24'),
  dailySeed('2026-12-25'),
  dailySeed('2027-03-01'),
  dailySeed('2027-07-19'),
];
const CHUNKS = 260; // ~16.6 km per seed

function distToObstacle(o: Obstacle, x: number, z: number): number {
  let px = o.x;
  let pz = o.z;
  if (o.x2 !== o.x || o.z2 !== o.z) {
    const ex = o.x2 - o.x;
    const ez = o.z2 - o.z;
    const t = Math.max(0, Math.min(1, ((x - o.x) * ex + (z - o.z) * ez) / (ex * ex + ez * ez)));
    px = o.x + ex * t;
    pz = o.z + ez * t;
  }
  return Math.hypot(x - px, z - pz) - o.r;
}

describe('fairness: guaranteed passable line', () => {
  for (const seed of SEEDS) {
    const tag = seed.toString(16);

    it(`seed ${tag}: lane is clear of colliders, ramps and vents for ${CHUNKS} chunks`, () => {
      const c = new Course(seed);
      const problems: string[] = [];
      let minClear = Infinity;
      let samples = 0;
      for (let i = 0; i < CHUNKS; i++) {
        const near = [c.chunk(Math.max(0, i - 1)), c.chunk(i), c.chunk(i + 1)].flatMap((k) => k.obstacles);
        const zones = [c.zones(Math.max(0, i - 1)), c.zones(i)];
        for (let z = i * CHUNK_LEN; z < (i + 1) * CHUNK_LEN; z += 0.5) {
          const x = c.safeX(z);
          samples++;
          if (Math.abs(x - c.centerX(z)) >= c.halfWidth(z) - 2) problems.push(`line leaves corridor at z=${z}`);
          for (const o of near) {
            const d = distToObstacle(o, x, z) - SLED_RADIUS;
            if (d < minClear) minClear = d;
            if (d <= 1.0) problems.push(`${o.kind} ${o.id} only ${d.toFixed(2)} m from the line at z=${z}`);
          }
          for (const zn of zones) {
            for (const r of zn.ramps) {
              if (z >= r.z - 1 && z <= r.z + r.len + 1.5 && Math.abs(x - r.x) <= r.w / 2 + 1.4 + 1.0) {
                problems.push(`ramp z=${r.z.toFixed(1)} overlaps the lane at z=${z} (dx=${Math.abs(x - r.x).toFixed(2)} w=${r.w.toFixed(2)})`);
              }
            }
            for (const v of zn.vents) {
              if (Math.hypot(x - v.x, z - v.z) <= v.r + 1) problems.push(`vent ${v.id} on the lane at z=${z}`);
            }
          }
        }
      }
      expect(samples).toBe(CHUNKS * CHUNK_LEN * 2);
      expect(problems.slice(0, 8)).toEqual([]);
      expect(minClear).toBeGreaterThan(1.0);
    });

    it(`seed ${tag}: line is smooth enough to follow at top speed`, () => {
      const c = new Course(seed);
      const bad: string[] = [];
      const h = 2;
      for (let z = 4; z < CHUNKS * CHUNK_LEN; z += 1) {
        const slope = (c.safeX(z + h) - c.safeX(z - h)) / (2 * h);
        const curv = (c.safeX(z + h) - 2 * c.safeX(z) + c.safeX(z - h)) / (h * h);
        if (Math.abs(slope) >= 0.7) bad.push(`slope ${slope.toFixed(2)} at z=${z}`);
        // A carving sled at 40 m/s turns with a ~56 m radius (curvature 0.018).
        if (Math.abs(curv) >= 0.018) bad.push(`curvature ${curv.toFixed(4)} at z=${z}`);
      }
      expect(bad.slice(0, 8)).toEqual([]);
    });
  }

  it('a simple line-following driver survives every mountain on the real sim', () => {
    const crashes: string[] = [];
    for (const seed of SEEDS.slice(0, 6)) {
      const sim = new Sim({ seed, chaos: PLAIN, sled: 0 });
      for (let t = 0; t < 60 * 60 * 4 && !sim.s.crashed && sim.s.z < 6000; t++) {
        const s = sim.s;
        let lvl = 4;
        if (s.grounded) {
          const look = s.z + 4 + s.speed * 0.35;
          const target = sim.course.safeX(look);
          const desired = Math.atan2(target - s.x, look - s.z);
          const lateral = sim.course.safeX(s.z) - s.x;
          const err = desired - s.velHeading + lateral * 0.08;
          lvl = Math.max(0, Math.min(8, Math.round(4 + err * 14)));
        }
        sim.step(packInput(lvl, false, false));
      }
      if (sim.s.crashed || sim.s.z < 3000) crashes.push(`seed ${seed.toString(16)}: ${sim.s.crashCause} at z=${sim.s.z.toFixed(0)}`);
    }
    expect(crashes).toEqual([]);
  });

  it('a clean, boost-free rider outruns the avalanche on every mountain in every mood', () => {
    const caught: string[] = [];
    for (const m of MOUNTAINS) {
      for (let mood = 0; mood <= 6; mood++) {
        const sim = new Sim({ seed: m.seed, chaos: { mood: mood as Mood, event: ChaosEvent.Avalanche, seed: 17 }, sled: 0 });
        for (let t = 0; t < 60 * 120 && !sim.s.crashed && sim.dyn.avalanche.phase !== 3; t++) {
          const s = sim.s;
          let lvl = 4;
          if (s.grounded) {
            const look = s.z + 4 + s.speed * 0.35;
            const err = Math.atan2(sim.course.safeX(look) - s.x, look - s.z) - s.velHeading + (sim.course.safeX(s.z) - s.x) * 0.08;
            lvl = Math.max(0, Math.min(8, Math.round(4 + err * 14)));
          }
          sim.step(packInput(lvl, false, false));
        }
        if (sim.s.crashed || sim.dyn.avalanche.phase !== 3) caught.push(`${m.id} mood ${mood}: ${sim.s.crashCause ?? 'not finished'}`);
      }
    }
    expect(caught).toEqual([]);
  });

  it('the safe lane constant is wide enough for the sled', () => {
    expect(SAFE_LANE - SLED_RADIUS).toBeGreaterThan(1.5);
  });
});
