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
    expect(tris(obstacleGeometry('basalt', p, true))).toBeLessThanOrEqual(192);
    expect(tris(obstacleGeometry('rock', p))).toBeLessThanOrEqual(110);
    expect(tris(obstacleGeometry('basalt', p))).toBeLessThanOrEqual(192);
  });
  it("Ember's formations", () => {
    expect(tris(organPipeGeometry(p))).toBeLessThanOrEqual(520);
    expect(tris(basaltClusterGeometry(p))).toBeLessThanOrEqual(140);
    expect(tris(basaltSentinelGeometry(p))).toBeLessThanOrEqual(110);
  });
});
