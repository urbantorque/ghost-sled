import { DataUtils, Vector2, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Course } from '../src/sim/course';
import { CHUNK_LEN } from '../src/sim/course';
import { Casters, FAR_GLSL, FINE_DX, FINE_DZ, FINE_W, FarShadow, NEAR_FROM, NEAR_TO, SOFT_OBJ, SweepGrid, nearWeight, sunFrame, underCeiling, type FarWorld } from '../src/render/farshadow';

// The far shadows (the visual lift's farlight lane): a field baked for each stretch's own sun, holding the height
// under which the light is hidden. These hold the bake's arithmetic: the walk toward the sun over the ground (a
// wall's shadow is as long as the wall is tall over the light's slope, and a slope turned to the light never
// shadows itself), a tree's footprint carried away from the sun whatever its bearing to the course, and the
// hand-over at the near shadow map's reach, which never cuts.

const deg = Math.PI / 180;
/** A shadow light from a bearing (degrees from down the run toward +x) and an elevation, in three.js terms
 *  (z is the sim's negated), as palette.ts hands it over. */
function light(az: number, el: number): Vector3 {
  return new Vector3(Math.sin(az * deg) * Math.cos(el * deg), Math.sin(el * deg), -Math.cos(az * deg) * Math.cos(el * deg));
}
const out = new Vector2();

describe('far shadows: the light over the ground', () => {
  it('turns the palette light into a direction toward the sun in the sim frame and the slope of its rays', () => {
    const s = sunFrame(light(30, 20));
    expect(s.sx).toBeCloseTo(Math.sin(30 * deg), 6);
    expect(s.sz).toBeCloseTo(Math.cos(30 * deg), 6);
    expect(s.tanE).toBeCloseTo(Math.tan(20 * deg), 6);
    // A sun ahead and low (the run's raking light) points down the run.
    expect(sunFrame(light(0, 10)).sz).toBeCloseTo(1, 6);
  });

  it('is half lit at the ceiling and eases over the soft band either side', () => {
    expect(underCeiling(2, 2, 0.5)).toBeCloseTo(0.5, 6);
    expect(underCeiling(1.4, 2, 0.5)).toBe(0);
    expect(underCeiling(2.6, 2, 0.5)).toBe(1);
    expect(underCeiling(1.9, 2, 0.5)).toBeLessThan(underCeiling(2.1, 2, 0.5));
  });
});

describe('far shadows: the walk toward the sun (horizon)', () => {
  it("lays a wall's shadow as long as the wall is tall over the light's slope", () => {
    const g = new SweepGrid();
    const sun = sunFrame(light(90, 15));
    g.fit(sun, -120, 0, -20, 20, 140, 3, 3);
    for (let ib = 0; ib < g.nb; ib++) for (let ia = 0; ia < g.na; ia++) g.occ[ib * g.na + ia] = g.cellX(ia, ib) > 10 ? 20 : 0;
    g.sweep();
    const reach = 20 / Math.tan(15 * deg);
    // Over the floor (shadowed) well inside the shadow, under it (lit) past its end.
    expect(g.sample(10 - reach * 0.6, 0, -100, out).x).toBeGreaterThan(1);
    expect(g.sample(10 - reach * 1.25, 0, -100, out).x).toBeLessThan(0);
    // The edge lands within a cell of where the wall's crest puts it.
    let edge = 0;
    for (let x = 0; x > -120; x -= 0.5) if (g.sample(x, 0, -100, out).x > 0) edge = x;
    expect(Math.abs(edge - (10 - reach))).toBeLessThan(3.5);
    // What casts is the wall: the distance to it grows across the floor.
    expect(g.sample(-30, 0, -100, out).y).toBeGreaterThan(g.sample(-5, 0, -100, out).y);
  });

  it('never shadows a slope turned to the light, and does shadow one turned away more steeply than it', () => {
    const sun = sunFrame(light(90, 20));
    const g = new SweepGrid();
    for (const s of [-0.4, 0, 0.2, Math.tan(20 * deg) - 0.12]) {
      g.fit(sun, -60, 60, -10, 10, 80, 3, 3);
      for (let ib = 0; ib < g.nb; ib++) for (let ia = 0; ia < g.na; ia++) g.occ[ib * g.na + ia] = s * g.cellX(ia, ib);
      g.sweep();
      // (The bake's terrain bias, 0.55 m, is what keeps a slope off its own face.)
      for (let x = -50; x <= 50; x += 7) expect(g.sample(x, 0, -100, out).x - 0.55).toBeLessThan(s * x);
    }
    const steep = 0.9;
    g.fit(sun, -60, 60, -10, 10, 80, 3, 3);
    for (let ib = 0; ib < g.nb; ib++) for (let ia = 0; ia < g.na; ia++) g.occ[ib * g.na + ia] = steep * g.cellX(ia, ib);
    g.sweep();
    expect(g.sample(0, 0, -100, out).x - 0.55).toBeGreaterThan(0);
  });
});

describe('far shadows: footprints along the sun', () => {
  it("carries a tree's shadow away from the sun, as long as the tree over the light's slope, at any bearing", () => {
    const g = new SweepGrid();
    for (const az of [0, 37, 90, 133, 200, 290]) {
      const sun = sunFrame(light(az, 20));
      g.fit(sun, -45, 45, -45, 45, 60, 1.5, 1);
      g.cone(0, 0, 0, 12, 2.5);
      g.sweep();
      const len = 12 / Math.tan(20 * deg);
      // (Read as the bake reads it: where nothing casts, the ceiling lies just under the snow.)
      const at = (d: number, side = 0) => g.sample(-sun.sx * d - sun.sz * side, -sun.sz * d + sun.sx * side, -1.5, out).x;
      let far = 0;
      for (let d = 0.5; d < 60; d += 0.25) if (Math.max(at(d, -0.5), at(d), at(d, 0.5)) > 0) far = d;
      expect(Math.abs(far - len)).toBeLessThan(2.5);
      // Toward the sun there is none, nor a few metres to its side.
      expect(at(-6)).toBeLessThan(0);
      expect(at(10, 4.5)).toBeLessThan(0);
      expect(at(10, -4.5)).toBeLessThan(0);
      // Close behind it the ceiling is about the tree's own top less the ray's fall.
      expect(Math.max(at(10, -0.5), at(10), at(10, 0.5))).toBeGreaterThan(12 - 10 * Math.tan(20 * deg) - 2.5);
      expect(Math.max(at(10, -0.5), at(10), at(10, 0.5))).toBeLessThan(12 - 10 * Math.tan(20 * deg) + 0.5);
    }
  });

  it("lays a box's footprint turned with it, and a trunk thinner than a cell still casts", () => {
    const g = new SweepGrid();
    const sun = sunFrame(light(0, 25));
    g.fit(sun, -30, 30, -30, 30, 40, 1.5, 1);
    // A cabin 8 m along x, 3 m across, turned 90 degrees: it now stands 3 m wide across the run's x.
    g.box(0, 0, 4, 1.5, 0, 1, 6);
    g.cone(15, 0, 0, 9, 0.1);
    g.sweep();
    expect(g.sample(0, -5, -1.5, out).x).toBeGreaterThan(0);
    expect(g.sample(2.8, -5, -1.5, out).x).toBeLessThan(0);
    // A thin trunk's shadow keeps a cell or two's width, never filtered away.
    let wide = 0;
    for (let x = 12; x <= 18; x += 0.1) if (g.sample(x, -6, -1.5, out).x > 0) wide += 0.1;
    expect(wide).toBeGreaterThan(0.5);
    expect(wide).toBeLessThan(3.2);
  });

  it('keeps the casters of one stretch as records the bake reads', () => {
    const c = new Casters();
    for (let i = 0; i < 2000; i++) c.cone(i, 0, 0, 10, 2);
    c.box(1, 2, 0, 5, 3, 1, 1, 0);
    expect(c.n).toBe(2001);
    expect(c.data[2000 * 9]).toBe(1);
    c.clear();
    expect(c.n).toBe(0);
  });
});

describe('far shadows: the hand-over at the near map', () => {
  it('weighs the near map whole inside its box, eases it out over the last part of its reach, and has none on Low', () => {
    const r = 34;
    expect(nearWeight(0, 0, r)).toBe(1);
    expect(nearWeight(r * NEAR_FROM * 0.99, 0, r)).toBe(1);
    expect(nearWeight(0, r * NEAR_TO * 1.01, r)).toBe(0);
    expect(nearWeight(10, 10, 0)).toBe(0);
    let last = 1;
    for (let u = 0; u <= r; u += 0.25) {
      const w = nearWeight(u, 0.3 * u, r);
      expect(w).toBeLessThanOrEqual(last + 1e-9);
      last = w;
    }
  });

  it('never cuts: a shadow walked out through the box changes by small steps', () => {
    // The near map's answer and the field's differ (a caster drawn twice, a little apart); the blend is the
    // GLSL's mix(field, near, weight).
    const r = 26;
    let prev = -1;
    let worst = 0;
    for (let u = 0; u <= r * 1.1; u += 0.1) {
      const near = 0.25;
      const field = 0.7;
      const w = nearWeight(u, 0, r);
      const v = field + (near - field) * w;
      if (prev >= 0) worst = Math.max(worst, Math.abs(v - prev));
      prev = v;
    }
    expect(worst).toBeLessThan(0.02);
  });

  it('is one function every lit material calls', () => {
    expect(FAR_GLSL).toContain('float farShadow(vec3 wp, float nearShadow)');
    expect(FAR_GLSL.match(/uniform /g)?.length).toBe(4);
  });
});

/** A flat world with one tree standing beside the run in chunk 15, for the whole bake. */
function flatWorld(sun: Vector3, tree: { x: number; z: number; h: number } | null, wall = false): FarWorld {
  const course = { centerX: () => 0, halfWidth: () => 10, baseY: () => 0, biome: 'alpine' } as unknown as Course;
  const ground = (x: number) => (wall && x > 60 ? 30 : 0);
  return {
    course,
    sunAt: (_z, o) => o.copy(sun),
    ground: (x) => ground(x),
    shoulders: (_r, x0, dx, n, o, at) => {
      for (let k = 0; k < n; k++) o[at + k] = ground(x0 + k * dx);
      return 1;
    },
    casters: (i, o) => {
      if (o && tree && i === Math.floor(tree.z / CHUNK_LEN)) o.cone(tree.x, tree.z, 0, tree.h, 2.4);
      return true;
    },
    sites: () => {},
  };
}

/** Bakes every tile around sim z and returns the fine tile holding chunk `ci`, decoded. */
function bake(world: FarWorld, z: number, ci: number): { at: (x: number, zz: number) => [number, number, number, number]; base: number } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const far = new FarShadow(world) as any;
  const rows = new Map<number, Uint16Array>();
  far.upload = (stage: { image: { data: Uint16Array } }, v: number) => {
    rows.set(v, stage.image.data.slice());
    return true;
  };
  far.riderZ = z;
  far.c0 = ci - 1;
  far.c1 = ci + 1;
  far.t0 = Math.floor((z - 200) / 256);
  far.t1 = far.t0 + 2;
  for (let n = 0, job; (job = far.nextJob()) && n < 50; n++) while (!far.step(job, Infinity));
  const slot = ((ci % 12) + 12) % 12;
  const data = rows.get(slot * (32 + 2))!;
  const xc = far.fine[slot].xc;
  const base = far.fine[slot].base;
  return {
    base,
    at: (x, zz) => {
      const i = Math.round((x - xc) / FINE_DX + FINE_W / 2 - 0.5);
      const j = Math.round((zz - ci * CHUNK_LEN) / FINE_DZ + 0.5);
      const o = (j * FINE_W + i) * 4;
      return [0, 1, 2, 3].map((k) => DataUtils.fromHalfFloat(data[o + k])) as [number, number, number, number];
    },
  };
}

describe('far shadows: a stretch baked whole', () => {
  it("bakes a tree's shadow into its stretch, crisp at the tree and softer down its length, and the flat snow never shadows itself", () => {
    const sun = light(-60, 18);
    const s = sunFrame(sun);
    const tree = { x: 30, z: 15 * CHUNK_LEN + 40, h: 12 };
    const t = bake(flatWorld(sun, tree), tree.z, 15);
    const behind = (d: number) => t.at(tree.x - s.sx * d, tree.z - s.sz * d);
    // Its ceiling stands over the snow behind it, and is gone toward the sun.
    expect(behind(8)[2]).toBeGreaterThan(1);
    expect(behind(-8)[2]).toBeLessThan(0);
    // The soft band widens down its length.
    expect(behind(25)[3]).toBeGreaterThan(behind(5)[3]);
    expect(behind(5)[3]).toBeGreaterThan(SOFT_OBJ[0] * 0.99);
    // The terrain's own ceiling stays under the flat snow everywhere.
    for (let x = -120; x <= 120; x += 15) for (let z = 15 * CHUNK_LEN; z < 16 * CHUNK_LEN; z += 9) expect(t.at(x, z)[0]).toBeLessThan(0);
  });

  it("lays a ridge's shadow over the snow beside it: the terrain's own, which the near map never had", () => {
    // A bank 30 m tall standing 60 m out on the sun's side, a low sun from that side.
    const sun = light(80, 14);
    const t = bake(flatWorld(sun, null, true), 15 * CHUNK_LEN + 30, 15);
    const z = 15 * CHUNK_LEN + 30;
    expect(t.at(40, z)[0]).toBeGreaterThan(1);
    // Past the shadow's end (the bank's height over the ray's slope, from its crest) the snow is lit again.
    expect(t.at(60 - 30 / Math.tan(14 * deg) - 25, z)[0]).toBeLessThan(0);
  });
});
