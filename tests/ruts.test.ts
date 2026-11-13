import { type BufferAttribute, Color } from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import { BUDGET, fx, setFxBudget } from '../src/render/fxhub';
import { shared } from '../src/render/materials';
import { GhostTrails, Trail } from '../src/render/trails';
import type { Course } from '../src/sim/course';

// Round 7's ruts: they last the run inside the visible range, to a budget per tier, with a cheaper far
// representation, and Low keeps round 6's vertex count.

const flat = { ground: () => 0 } as unknown as Course;
const mint = [new Color('#8FF3E4'), new Color('#8FF3E4'), new Color('#8FF3E4')];

/** Rides ghost `i` straight down the run from z0 to z1 in half-metre steps. */
function ride(t: GhostTrails, i: number, z0: number, z1: number, time: number): void {
  for (let z = z0; z <= z1; z += 0.5) t.add(i, 3 * i, z, time + z / 30);
}

afterAll(() => setFxBudget(1));

describe('ghost ruts', () => {
  it('Low keeps round 6 vertex count; higher tiers keep more of the run', () => {
    setFxBudget(0.45);
    expect(fx.tier).toBe(0);
    expect(BUDGET.rutSamples[0]).toBe(360);
    const low = new GhostTrails(flat, 3, 360, mint);
    expect(low.mesh.geometry.getAttribute('position').count).toBe(3 * 360 * 2);
    setFxBudget(1);
    const high = new GhostTrails(flat, 3, 360, mint);
    expect(high.mesh.geometry.getAttribute('position').count).toBe(3 * BUDGET.rutSamples[2] * 2);
  });

  for (const [budget, tier] of [[0.45, 0], [0.75, 1], [1, 2]] as const) {
    it(`tier ${tier}: a rut does not age away, is kept to its range, and is coarser far off`, () => {
      setFxBudget(budget);
      const t = new GhostTrails(flat, 1, 360, mint);
      ride(t, 0, 0, 900, 0);
      const gap = BUDGET.rutGap[tier];
      const kept = BUDGET.rutSamples[tier] * gap;
      // The rider well behind the ghost: the rut between them is all on the snow, however old it is.
      const riderZ = 900 - Math.min(kept, BUDGET.rutFar[tier]) + 20;
      shared.uFocus.value.set(0, 0, -riderZ);
      shared.uTime.value = 5;
      t.flush();
      const fresh = t.triangles;
      expect(fresh).toBeGreaterThan(40);
      shared.uTime.value = 500;
      t.add(0, 0, 901, 500);
      t.flush();
      expect(Math.abs(t.triangles - fresh)).toBeLessThanOrEqual(4);
      // Never more than the range allows: full detail to `coarse`, every third sample past it.
      const near = BUDGET.rutCoarse[tier] + 60;
      const far = Math.max(0, BUDGET.rutFar[tier] - BUDGET.rutCoarse[tier]);
      expect(t.triangles).toBeLessThanOrEqual(Math.ceil((near / gap + far / gap / 3 + 8) * 2));
      // Behind the rider it is let go (the lens never looks back further than the mirror does).
      shared.uFocus.value.set(0, 0, -(900 + 200));
      t.add(0, 0, 902, 501);
      t.flush();
      expect(t.triangles).toBe(0);
    });
  }

  it('an airborne stretch leaves no rut', () => {
    setFxBudget(1);
    const t = new GhostTrails(flat, 1, 360, mint);
    ride(t, 0, 0, 30, 0);
    t.lift(0);
    ride(t, 0, 50, 80, 2);
    shared.uFocus.value.set(0, 0, 0);
    t.flush();
    const samples = Math.floor(30 / 0.6) + Math.floor(30 / 0.6) + 2;
    expect(t.triangles).toBeLessThanOrEqual(samples * 2);
    expect(t.triangles).toBeGreaterThan(90);
  });
});

describe("the rider's groove", () => {
  it('uploads only the samples it adds', () => {
    setFxBudget(1);
    const t = new Trail(flat, 900, 'groove');
    for (let z = 0; z < 30; z += 1) t.add(0, z, 0.5, 0.4, z / 30, 30);
    const pos = t.mesh.geometry.getAttribute('position') as BufferAttribute;
    const sent = pos.updateRanges.reduce((n, r) => n + r.count, 0);
    expect(sent).toBe(30 * 6);
    t.flush();
    expect(t.mesh.geometry.drawRange.count).toBe(29 * 6);
  });
});
