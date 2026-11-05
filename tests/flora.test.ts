import { BufferAttribute, BufferGeometry, InstancedBufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { L_CABIN, L_CORNICE, L_ROCKBAND, L_SIGN, L_WALL, largeKitSteps } from '../src/render/dressing';
import { AERIAL_PICK, Lod, boughPineGeometry, dropSlivers, forestSet, hasLod, variantRange, variantSet, variantView } from '../src/render/flora';
import { getPalette } from '../src/render/palette';
import { Mood } from '../src/sim/chaos';

const tris = (g: BufferGeometry) => g.getAttribute('position').count / 3;

/** Sum of triangle areas (what a geometry covers). */
function area(g: BufferGeometry): number {
  const p = g.getAttribute('position') as BufferAttribute;
  let s = 0;
  for (let f = 0; f < p.count; f += 3) {
    const ax = p.getX(f + 1) - p.getX(f);
    const ay = p.getY(f + 1) - p.getY(f);
    const az = p.getZ(f + 1) - p.getZ(f);
    const bx = p.getX(f + 2) - p.getX(f);
    const by = p.getY(f + 2) - p.getY(f);
    const bz = p.getZ(f + 2) - p.getZ(f);
    s += Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx) / 2;
  }
  return s;
}

/** Height and reach of a geometry (its silhouette's extent). */
function extent(g: BufferGeometry): { h: number; r: number } {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  return { h: b.max.y - b.min.y, r: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2 };
}

describe('forest detail levels', () => {
  const p = getPalette('alpine', Mood.None);

  it('drops a lathe tip slivers without losing any covered area', () => {
    const before = boughPineGeometry(p, 1);
    const sl = before.clone();
    // A fresh build already went through dropSlivers: nothing more to drop.
    expect(tris(dropSlivers(sl))).toBe(tris(before));
    expect(area(sl)).toBeCloseTo(area(before), 6);
  });

  it('builds a far tree with under 60% of the triangles and the same silhouette', () => {
    for (const set of ['a', 'b'] as const) {
      const full = forestSet('alpine', p, set, 0);
      const far = forestSet('alpine', p, set, 2);
      expect(tris(far)).toBeLessThan(tris(full) * 0.6);
    }
    const full = extent(boughPineGeometry(p, 1, 0));
    const far = extent(boughPineGeometry(p, 1, 2));
    expect(far.h).toBeCloseTo(full.h, 1);
    expect(Math.abs(far.r - full.r)).toBeLessThan(0.15);
  });

  it("gives Low its own pine, cheaper than the full one", () => {
    const lods: Lod[] = [0, 1, 2];
    const n = lods.map((l) => tris(boughPineGeometry(p, 1, l)));
    expect(n[1]).toBeLessThan(n[0] * 0.75);
    expect(n[2]).toBeLessThanOrEqual(n[1]);
  });

  it('shares the full set where a biome has no cheaper build', () => {
    expect(hasLod('alpine', 'a')).toBe(true);
    expect(hasLod('glacier', 'b')).toBe(false);
  });
});

describe('variant draw ranges', () => {
  const p = getPalette('alpine', Mood.None);

  it('draws only the variants a batch picks, aerial marks included', () => {
    const set = variantSet(largeKitSteps('alpine', p).map((f) => f()));
    const starts = set.userData.variantStarts as number[];
    const pick = new InstancedBufferAttribute(new Float32Array(8), 1);
    const view = variantView(set, pick);
    pick.array.set([L_CORNICE, L_CORNICE, L_CORNICE + AERIAL_PICK]);
    variantRange(view, pick, 3);
    expect(view.drawRange.start).toBe(starts[L_CORNICE]);
    expect(view.drawRange.count).toBe(starts[L_CORNICE + 1] - starts[L_CORNICE]);
    pick.array.set([L_ROCKBAND, L_WALL]);
    variantRange(view, pick, 2);
    expect(view.drawRange.start).toBe(starts[L_ROCKBAND]);
    expect(view.drawRange.start + view.drawRange.count).toBe(starts[starts.length - 1]);
    variantRange(view, pick, 0);
    expect(view.drawRange.count).toBe(0);
  });

  it("keeps the large kit's signature pieces last, so their batch's range never spans the others", () => {
    expect(Math.max(L_CABIN, L_SIGN)).toBeLessThan(Math.min(L_ROCKBAND, L_CORNICE, L_WALL));
    expect(largeKitSteps('alpine', p).length).toBe(L_WALL + 1);
  });
});
