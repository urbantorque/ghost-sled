import { describe, expect, it } from 'vitest';
import { ALL_CHARMS, CHARMS, CHARM_COUNT, LANE_W, STARTER_POOL, laneOf, laneX, offersFor } from '../src/sim/charms';
import { CHUNK_LEN, Course, THRESHOLD_AFTER, THRESHOLD_AFTER_MIN, THRESHOLD_BEFORE, THRESHOLD_BEFORE_MAX, THRESHOLD_HW } from '../src/sim/course';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { momentPlays, planLegends } from '../src/sim/moments';
import { packInput } from '../src/sim/input';
import { Sim } from '../src/sim/sim';

// Round 8 (G2): the charm gates stand where every rider can reach all three arches fairly. Every stage line has its
// threshold, wide and plain; nothing stands, launches or is laid in a gate's approach; no set piece or legend comes
// near one; and the deal is fair and replays.

const DAILIES = Array.from({ length: 60 }, (_, i) => dailySeed(`2027-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + ((i * 7) % 28)).padStart(2, '0')}`));
const SEEDS = [...MOUNTAINS.map((m) => m.seed), ...DAILIES];
/** A gate's approach: this far above it, and a little past. */
const APPROACH = 100;
const PAST = 15;

describe('charm gates stand on fair ground', () => {
  it('every course builds with a threshold at each stage line, and its gates on them', () => {
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const c = new Course(seed);
      const zs = c.charmGateZs;
      if (zs.length !== 3) bad.push(`${seed}: ${zs.length} gates`);
      for (const st of c.stages.slice(1)) {
        const sec = c.section(st.z0);
        if (!sec.gate || st.z0 - sec.z0 < THRESHOLD_BEFORE - 0.01 || st.z0 - sec.z0 > THRESHOLD_BEFORE_MAX + 0.01 || sec.z1 - st.z0 < THRESHOLD_AFTER_MIN - 0.01 || sec.z1 - st.z0 > THRESHOLD_AFTER + 0.01) bad.push(`${seed}: no threshold at ${st.z0}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('is wide, bare and away from every set piece and legend over each approach', () => {
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const c = new Course(seed);
      const plays = momentPlays(c);
      const legends = planLegends(c).filter((l) => l !== null);
      for (const gz of c.charmGateZs) {
        const z0 = gz - APPROACH;
        const z1 = gz + PAST;
        for (let z = Math.max(z0, 2); z <= z1; z += 2) {
          const hw = c.halfWidth(z);
          const sx = c.safeX(z);
          const cx = c.centerX(z);
          // Every arch's centre is inside the corridor with a metre to spare.
          if (z >= gz - 50) for (const lane of [0, 2]) if (Math.abs(laneX(sx, lane) - cx) > hw - 1) bad.push(`${seed} gate ${gz}: arch ${lane} outside at ${z.toFixed(0)}`);
          if (gz > 200 && z >= gz - 50 && hw < THRESHOLD_HW - 0.5) bad.push(`${seed} gate ${gz}: half-width ${hw.toFixed(1)} at ${z.toFixed(0)}`);
        }
        for (let i = Math.floor(z0 / CHUNK_LEN); i <= Math.floor(z1 / CHUNK_LEN); i++) {
          if (i < 0) continue;
          const ch = c.chunk(i);
          for (const o of ch.obstacles) if (Math.max(o.z, o.z2) + o.r >= z0 && Math.min(o.z, o.z2) - o.r <= z1 && Math.abs(o.x - c.centerX(o.z)) < c.halfWidth(o.z)) bad.push(`${seed} gate ${gz}: ${o.kind} at ${o.z.toFixed(0)}`);
          const zn = ch.zones;
          for (const r of zn.ramps) if (r.z + r.len >= z0 && r.z <= z1) bad.push(`${seed} gate ${gz}: kicker at ${r.z.toFixed(0)}`);
          for (const m of zn.moguls) if (m.z1 >= z0 && m.z0 <= z1) bad.push(`${seed} gate ${gz}: moguls`);
          for (const v of zn.vents) if (v.z >= z0 && v.z <= z1) bad.push(`${seed} gate ${gz}: vent`);
          for (const r of zn.rails) if (r.z1 >= z0 && r.z0 <= z1) bad.push(`${seed} gate ${gz}: rail`);
          for (const d of zn.drops) if (d.z + d.len >= z0 && d.z <= z1) bad.push(`${seed} gate ${gz}: drop`);
        }
        for (let z = gz - 50; z <= z1; z += 4) if (c.surface(c.safeX(z), z).ice) bad.push(`${seed} gate ${gz}: ice at ${z}`);
        for (const p of plays) if (p.z1 + 30 > z0 && p.z0 - 30 < z1) bad.push(`${seed} gate ${gz}: set piece ${p.key}`);
        for (const l of legends) if (l && l.z1 + 30 > z0 && l.z0 - 30 < z1) bad.push(`${seed} gate ${gz}: legend ${l.key}`);
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });
});

describe('the deal', () => {
  it('offers survival in the middle and one of each family where the pool has them, never a charm held', () => {
    for (let seed = 1; seed < 400; seed++) {
      const held: number[] = [];
      for (let g = 0; g < 3; g++) {
        const o = offersFor(seed * 2654435761, g, ALL_CHARMS, held);
        expect(CHARMS[o[1]].family).toBe('survival');
        expect(new Set(o.map((id) => CHARMS[id].family)).size).toBe(3);
        for (const id of o) expect(held).not.toContain(id);
        held.push(o[seed % 3]);
      }
    }
  });

  it('deals from the starter pool to the last arch, and leaves an arch empty only when the pool is spent', () => {
    const held: number[] = [];
    for (let g = 0; g < 3; g++) {
      const o = offersFor(77, g, STARTER_POOL, held);
      expect(o.every((id) => id >= 0 && (STARTER_POOL & (1 << id)) !== 0)).toBe(true);
      held.push(o[1]);
    }
    expect(offersFor(77, 0, 1 << 3, [])).toContain(-1);
  });

  it('a lane is the x as the gate is crossed', () => {
    expect(laneOf(10, 10)).toBe(1);
    expect(laneOf(10, 10 - LANE_W)).toBe(0);
    expect(laneOf(10, 10 + LANE_W)).toBe(2);
    expect(CHARMS.length).toBe(CHARM_COUNT);
  });

  it('a rider who steers to a lane takes its charm, one who does nothing the middle, and a replay the same', () => {
    const seed = MOUNTAINS[0].seed;
    for (const want of [0, 1, 2]) {
      const sim = new Sim({ seed, chaos: { mood: 0, event: 0, seed: 5 }, sled: 0, charmPool: ALL_CHARMS });
      const g = sim.charmGates[0];
      while (sim.s.z < g.z + 2) {
        const target = laneX(sim.course.safeX(sim.s.z + 20), want);
        const off = target - sim.s.x;
        sim.step(packInput(sim.s.z > g.z - 90 ? 4 + Math.max(-4, Math.min(4, Math.round(off * 1.5 - sim.s.vx * 0.6))) : 4, false, false));
      }
      expect(g.lane).toBe(want);
      expect(sim.charms[0]).toBe(g.offers[want]);
    }
  });
});
