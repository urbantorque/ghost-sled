import { BufferAttribute, BufferGeometry, Color } from 'three';
import { describe, expect, it } from 'vitest';
import { basaltClusterGeometry, basaltSentinelGeometry, organPipeGeometry } from '../src/render/flora';
import { BASALT_MODEL_H, BASALT_MODEL_R, ROCK_MODEL_H, ROCK_MODEL_R, obstacleGeometry, obstacleModelRadius } from '../src/render/meshes';
import { getPalette } from '../src/render/palette';
import { Facets, columns, formBounds, strata, strataInto } from '../src/render/rockforms';
import { Mood } from '../src/sim/chaos';
import type { BiomeId } from '../src/sim/mountains';

// Round 7's rock forms: a rock's drawn form stays inside what the sim collides with, every facet faces out
// (a flat-shaded form with a flipped face is a hole), and the forms hold their triangle budgets.

const tris = (g: BufferGeometry) => g.getAttribute('position').count / 3;
const BIOMES: BiomeId[] = ['alpine', 'glacier', 'volcanic', 'blossom'];

/** The share of a closed form's facets whose normal looks away from the form's own axis or up (a facet
 *  looking in and down, other than a soffit, is wound the wrong way). */
function outward(g: BufferGeometry): number {
  const p = g.getAttribute('position') as BufferAttribute;
  const n = g.getAttribute('normal') as BufferAttribute;
  let ok = 0;
  let all = 0;
  for (let f = 0; f < p.count; f += 3) {
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    const ny = n.getY(f);
    // Walls only: a wall's facet looks away from the axis.
    if (Math.abs(ny) > 0.5) continue;
    all++;
    if (n.getX(f) * cx + n.getZ(f) * cz > 0) ok++;
  }
  return ok / Math.max(1, all);
}

describe('rock forms', () => {
  it('a rock in beds stays inside its bounds, whatever its seed', () => {
    for (let seed = 1; seed < 60; seed++) {
      const g = strata({ rx: 1.4, rz: 0.9, h: 1.2, layers: 2 + (seed % 4), sides: 5 + (seed % 5), rock: [new Color(0.2, 0.2, 0.3), new Color(0.4, 0.4, 0.5)], lie: new Color(1, 1, 1), taper: 0.1 + (seed % 5) * 0.08, shift: (seed % 6) * 0.05, dip: ((seed % 7) - 3) * 0.04, rough: 0.1 + (seed % 4) * 0.08, seed });
      const p = g.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(1.4 + 1e-6);
        expect(Math.abs(p.getZ(i))).toBeLessThanOrEqual(0.9 + 1e-6);
        expect(p.getY(i)).toBeLessThanOrEqual(1.2 + 1e-6);
        expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
      }
    }
  });

  it('its walls face out', () => {
    // (Beds shifted off the axis put a few facets of a far wall on the near side of it: nearly all, not all.)
    const g = strata({ rx: 2, rz: 2, h: 3, layers: 4, sides: 8, rock: [new Color(0.2, 0.2, 0.3)], lie: null, taper: 0.2, shift: 0.05, seed: 7 });
    expect(outward(g)).toBeGreaterThan(0.97);
    const c = columns({ cols: [[0, 0, 0.5, 4]], rock: [new Color(0.1, 0.1, 0.1), new Color(0.2, 0.2, 0.2)], broke: new Color(0.4, 0.4, 0.4), top: null, seed: 3 });
    expect(outward(c)).toBe(1);
    expect(tris(c)).toBe(16);
  });

  it('a bed that steps in holds snow and one that juts out is in shade', () => {
    const snow = new Color(1, 1, 1);
    const g = strata({ rx: 2, rz: 2, h: 3, layers: 5, sides: 8, rock: [new Color(0.1, 0.1, 0.1), new Color(0.2, 0.2, 0.2)], lie: snow, taper: 0.3, shift: 0.2, seed: 11 });
    const col = g.getAttribute('color') as BufferAttribute;
    const n = g.getAttribute('normal') as BufferAttribute;
    let ledges = 0;
    let soffits = 0;
    for (let f = 0; f < col.count; f += 3) {
      const bright = col.getX(f) > 0.8;
      if (bright && n.getY(f) > 0.3) ledges++;
      if (!bright && n.getY(f) < -0.9) soffits++;
    }
    expect(ledges).toBeGreaterThan(8);
    expect(soffits).toBeGreaterThan(2);
  });

  it('a column in drums is 16 triangles a drum, faces out and stays under its height', () => {
    for (let seed = 1; seed < 20; seed++) {
      const c = columns({ cols: [[0, 0, 0.5, 6]], rock: [new Color(0.1, 0.1, 0.1), new Color(0.2, 0.2, 0.2)], broke: new Color(0.4, 0.4, 0.4), top: null, drum: 2, seed });
      expect(tris(c) % 16).toBe(0);
      expect(tris(c)).toBeLessThanOrEqual(48);
      expect(outward(c)).toBe(1);
      const b = formBounds(c, 0);
      expect(b.h).toBeLessThanOrEqual(6 + 1e-6);
      expect(b.r).toBeLessThanOrEqual(0.5 * 1.04 + 1e-6);
    }
  });

  it('a long outcrop: its beds run up along it, no joint level, and its top is still level at h', () => {
    const g = strata({ rx: 4, rz: 12, h: 6, foot: 0, layers: 5, sides: 14, rock: [new Color(0.2, 0.2, 0.2), new Color(0.3, 0.3, 0.3)], lie: null, flat: true, dipZ: 0.09, warp: 0.3, bays: 0.1, square: 0.6, seed: 21 });
    const pos = g.getAttribute('position') as BufferAttribute;
    let top = -Infinity;
    const levels = new Set<number>();
    for (let i = 0; i < pos.count; i++) {
      top = Math.max(top, pos.getY(i));
      expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(4 + 1e-6);
      expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(12 + 1e-6);
      if (pos.getY(i) > 0.1 && pos.getY(i) < 5.5) levels.add(Math.round(pos.getY(i) * 20));
    }
    expect(top).toBeCloseTo(6.02, 2);
    // (Five level courses would put every corner on one of four heights.)
    expect(levels.size).toBeGreaterThan(20);
  });

  it('a rock without a level top has a broken crown: its rim stands under its peak', () => {
    const g = strata({ rx: 2, rz: 2, h: 3, layers: 3, sides: 7, rock: [new Color(0.2, 0.2, 0.3)], lie: null, taper: 0.3, seed: 9 });
    const pos = g.getAttribute('position') as BufferAttribute;
    let atPeak = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 3 - 1e-4) atPeak++;
    // Only the crown's own peak (one corner of each of its seven facets) reaches h.
    expect(atPeak).toBe(7);
  });

  it('a foot that knows the ground follows it', () => {
    const f = new Facets();
    // Ground falling away along z: the lowest corners go down with it.
    strataInto(f, { rx: 3, rz: 8, h: 6, layers: 3, sides: 8, rock: [new Color(0.2, 0.2, 0.2)], lie: null, flat: true, ground: (_x, z) => -z * 0.5, seed: 5 });
    const g = f.build();
    g.computeBoundingBox();
    expect(g.boundingBox!.min.y).toBeLessThan(-3.5);
    expect(g.boundingBox!.max.y).toBeCloseTo(6.02, 2);
  });
});

describe("a hazard's drawn form is inside its collider", () => {
  for (const biome of BIOMES) {
    const p = getPalette(biome, Mood.None);
    it(`${biome}: rock, lava rock and basalt`, () => {
      for (const kind of ['rock', 'lavarock'] as const) {
        const b = formBounds(obstacleGeometry(kind, p), 0);
        expect(obstacleModelRadius(kind)).toBe(ROCK_MODEL_R);
        expect(b.r).toBeLessThanOrEqual(ROCK_MODEL_R);
        expect(b.h).toBeLessThanOrEqual(ROCK_MODEL_H + 1e-6);
        // ...and it fills it: a rock much smaller than its collider would stop a sled in clear air.
        expect(b.r).toBeGreaterThan(ROCK_MODEL_R * 0.85);
        expect(b.h).toBeGreaterThan(ROCK_MODEL_H * 0.95);
      }
      const b = formBounds(obstacleGeometry('basalt', p), 0);
      expect(obstacleModelRadius('basalt')).toBe(BASALT_MODEL_R);
      expect(b.r).toBeLessThanOrEqual(BASALT_MODEL_R);
      expect(b.h).toBeLessThanOrEqual(BASALT_MODEL_H + 1e-6);
      expect(b.r).toBeGreaterThan(BASALT_MODEL_R * 0.85);
      expect(b.h).toBeGreaterThan(BASALT_MODEL_H * 0.95);
    });
  }
});

describe('the forms hold their triangle budgets', () => {
  const p = getPalette('volcanic', Mood.None);
  it('the run hazards: no heavier on Low than round 6 (rock 60, basalt 192, lava rock 80)', () => {
    expect(tris(obstacleGeometry('rock', p, true))).toBeLessThanOrEqual(60);
    expect(tris(obstacleGeometry('lavarock', p, true))).toBeLessThanOrEqual(80);
    expect(tris(obstacleGeometry('basalt', p, true))).toBeLessThanOrEqual(124);
    expect(tris(obstacleGeometry('rock', p))).toBeLessThanOrEqual(110);
    expect(tris(obstacleGeometry('basalt', p))).toBeLessThanOrEqual(192);
  });
  it("Ember's formations", () => {
    expect(tris(organPipeGeometry(p))).toBeLessThanOrEqual(520);
    // (The cluster and the sentinel are Medium's and High's pieces, cross-jointed into drums; the organ
    // pipes are Low's one piece too and stay whole.)
    expect(tris(basaltClusterGeometry(p))).toBeLessThanOrEqual(180);
    expect(tris(basaltSentinelGeometry(p))).toBeLessThanOrEqual(200);
  });
});
