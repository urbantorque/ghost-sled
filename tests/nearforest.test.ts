import { BufferAttribute, BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { blossomGeometry, boughPineGeometry, hazardPineGeometry, heavyPineGeometry, nearPineGeometry, nearSteps, nearWall, youngPineGeometry } from '../src/render/flora';
import { NEAR_IN, NEAR_OUT, nearSlots } from '../src/render/nearforest';
import { getPalette } from '../src/render/palette';
import { liveTree, wind } from '../src/render/treelife';
import { makeToonMaterial } from '../src/render/materials';
import { variantMaterial } from '../src/render/flora';
import { sledGeometryFor } from '../src/render/meshes';
import { Mood } from '../src/sim/chaos';

// Round 8, the forest lane: the trees nearest the lens are drawn from a near build (nearforest.ts). These hold the
// near build to the far tree's silhouette (ART.md 12), to facets small enough to hold at the lens, and the hand-over
// to drawing every tree exactly once.

const tris = (g: BufferGeometry) => g.getAttribute('position').count / 3;

/** Height, reach and foot of a geometry. */
function extent(g: BufferGeometry): { h: number; r: number; top: number } {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  return { h: b.max.y - b.min.y, r: Math.max(b.max.x, -b.min.x, b.max.z, -b.min.z), top: b.max.y };
}

/** The broadest triangle above the tree well (the foliage, the snow and the trunk): its height off its longest edge,
 *  metres. A shard is broad; a sliver of trunk a metre long and a hand wide is not. */
function broadest(g: BufferGeometry, above = 0.3): number {
  const p = g.getAttribute('position') as BufferAttribute;
  let w = 0;
  for (let f = 0; f < p.count; f += 3) {
    if (Math.min(p.getY(f), p.getY(f + 1), p.getY(f + 2)) < above) continue;
    const ax = p.getX(f + 1) - p.getX(f);
    const ay = p.getY(f + 1) - p.getY(f);
    const az = p.getZ(f + 1) - p.getZ(f);
    const bx = p.getX(f + 2) - p.getX(f);
    const by = p.getY(f + 2) - p.getY(f);
    const bz = p.getZ(f + 2) - p.getZ(f);
    const area2 = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
    let long = 0;
    for (const [a, b] of [[f, f + 1], [f + 1, f + 2], [f + 2, f]]) long = Math.max(long, Math.hypot(p.getX(a) - p.getX(b), p.getY(a) - p.getY(b), p.getZ(a) - p.getZ(b)));
    w = Math.max(w, area2 / Math.max(long, 1e-6));
  }
  return w;
}

/** The reach of a geometry's faces in a band of height (the outline at that height). */
function reachAt(g: BufferGeometry, y0: number, y1: number): number {
  const p = g.getAttribute('position') as BufferAttribute;
  let r = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) >= y0 && p.getY(i) <= y1) r = Math.max(r, Math.hypot(p.getX(i), p.getZ(i)));
  return r;
}

describe('the near trees', () => {
  const p = getPalette('alpine', Mood.None);

  it("keep the far tree's height, reach and tiers (a near tree never reads as another tree)", () => {
    const pairs: Array<[BufferGeometry, BufferGeometry]> = [
      [boughPineGeometry(p, 1), nearPineGeometry(p, 'bough', 1)],
      [heavyPineGeometry(p), nearPineGeometry(p, 'heavy')],
      [youngPineGeometry(p), nearPineGeometry(p, 'young')],
      [hazardPineGeometry(p), nearPineGeometry(p, 'hazard')],
    ];
    for (const [far, near] of pairs) {
      const a = extent(far);
      const b = extent(near);
      expect(Math.abs(b.top - a.top)).toBeLessThan(0.12);
      expect(Math.abs(b.r - a.r) / a.r).toBeLessThan(0.08);
      // Tier by tier: the outline in each half metre of height stays within about a fifth of a metre of the far tree's
      // at that height or a quarter of a metre either side of it (a near bough's tip may hang a hand lower).
      for (let y = 0; y < a.top - 0.5; y += 0.5) {
        const rb = reachAt(near, y, y + 0.5);
        expect(rb).toBeLessThan(reachAt(far, y - 0.25, y + 0.75) + 0.22);
        expect(rb).toBeGreaterThan(reachAt(far, y + 0.25, y + 0.25) * 0 + reachAt(far, y + 0.2, y + 0.3) - 0.22);
      }
    }
  });

  it("are built in facets that hold at the lens: none broader than 0.36 m where the far tree's are over 0.6 m", () => {
    expect(broadest(boughPineGeometry(p, 1))).toBeGreaterThan(0.6);
    for (const g of [nearPineGeometry(p, 'bough', 1), nearPineGeometry(p, 'heavy'), nearPineGeometry(p, 'hazard'), nearPineGeometry(p, 'young')]) expect(broadest(g)).toBeLessThan(0.36);
    for (const k of ['bough', 'heavy'] as const) expect(broadest(nearPineGeometry(p, k, 1, undefined, 'lean'))).toBeLessThan(0.48);
  });

  it('cost what a few trees by the lens can: High under 4,600 triangles a spruce, Medium under 2,800', () => {
    const fine = tris(nearPineGeometry(p, 'bough', 1));
    const lean = tris(nearPineGeometry(p, 'bough', 1, undefined, 'lean'));
    expect(fine).toBeLessThan(4600);
    expect(lean).toBeLessThan(2800);
    expect(lean).toBeLessThan(fine * 0.7);
    // (And more than the far tree, or there was no point.)
    expect(fine).toBeGreaterThan(tris(boughPineGeometry(p, 1)) * 3);
  });

  it('carry a shelf of snow with depth, a dark underside and a trunk', () => {
    const g = nearPineGeometry(p, 'bough', 1);
    const c = g.getAttribute('color') as BufferAttribute;
    const n = g.getAttribute('normal') as BufferAttribute;
    let snowUp = 0;
    let darkDown = 0;
    for (let i = 0; i < c.count; i += 3) {
      const v = (c.getX(i) + c.getY(i) + c.getZ(i)) / 3;
      if (v > 0.85 && n.getY(i) > 0.3) snowUp++;
      if (v < 0.12 && n.getY(i) < -0.3) darkDown++;
    }
    expect(snowUp).toBeGreaterThan(200);
    expect(darkDown).toBeGreaterThan(100);
  });

  it('draw the blossom a step rounder at the lens', () => {
    const sp = getPalette('blossom', Mood.None);
    expect(tris(blossomGeometry(sp, 'close'))).toBeGreaterThan(tris(blossomGeometry(sp, 'rich')) * 1.8);
    expect(extent(blossomGeometry(sp, 'close')).top).toBeCloseTo(extent(blossomGeometry(sp, 'rich')).top, 0);
  });

  it('cover every kind a mountain draws near, and only the wind-moved walls', () => {
    expect(nearWall('alpine') && nearWall('blossom') && nearWall('lantern')).toBe(true);
    expect(nearWall('glacier') || nearWall('volcanic')).toBe(false);
    const kinds = (b: Parameters<typeof nearSlots>[0]) => nearSlots(b, getPalette(b, Mood.None), 'lean').map((s) => s.from + ':' + s.pick);
    expect(kinds('alpine')).toEqual(['fw:a:0', 'fw:a:1', 'fw:b:0', 'fw:b:1', 'ob:pine:0']);
    expect(kinds('blossom')).toEqual(['fw:a:0', 'fw:a:1', 'fw:b:0', 'fw:b:1', 'ob:pine:0', 'ob:blossom:0']);
    expect(kinds('glacier')).toEqual([]);
    expect(kinds('volcanic')).toEqual([]);
    // A wall's near set has a maker for every pick its far set draws.
    for (const b of ['alpine', 'lantern', 'blossom'] as const) for (const set of ['a', 'b'] as const) expect(nearSteps(b, getPalette(b, Mood.None), set, 'lean')).toHaveLength(2);
  });

  it('hand each tree over whole, the far batch and the near one through one screen-door between them', () => {
    expect(NEAR_IN).toBeLessThan(NEAR_OUT);
    const far = liveTree(variantMaterial(makeToonMaterial({ sway: 0.12 })), true);
    const ob = liveTree(makeToonMaterial({ sway: 0.12 }), true);
    const near = liveTree(makeToonMaterial({ sway: 0.12 }), true, 'wall');
    // The wall's batch (a variant material) and its near build read the wall's band; the run's trees their own.
    expect(far.uniforms.uNearLod).toBe(wind.uNearWall);
    expect(near.uniforms.uNearLod).toBe(wind.uNearWall);
    expect(ob.uniforms.uNearLod).toBe(wind.uNearOb);
    expect(far.defines.GS_HANDOFF).toBe(1);
    expect(far.defines.GS_NEAR).toBeUndefined();
    expect(near.defines.GS_NEAR).toBe(1);
    // The far keeps a pixel where the noise is under the hand-over's share, the near where it is not.
    expect(far.fragmentShader).toContain('if (gsN >= vHand) discard;');
    expect(far.fragmentShader).toContain('if (gsN < vHand) discard;');
    // Off until the near trees are made: no far tree hides.
    expect(wind.uNearWall.value.x).toBeLessThan(0);
    // Low's trees (no shiver) never hand over: they dissolve whole beside the lens instead, and only there.
    const low = liveTree(makeToonMaterial({ sway: 0.12 }), false);
    expect(low.defines.GS_HANDOFF).toBeUndefined();
    expect(low.defines.GS_LENS).toBe(1);
    expect(far.defines.GS_LENS).toBeUndefined();
    expect(low.vertexShader).toContain('smoothstep(4.50, 8.00,');
  });
});

describe('Comet Bob', () => {
  it('reads as a sled: slats and runners in its own paint, the size of the classic sled, never a pale pod', () => {
    for (const lite of [false, true]) {
      const g = sledGeometryFor(3, lite);
      const classic = sledGeometryFor(0, lite);
      const a = extent(g);
      const b = extent(classic);
      expect(Math.abs(a.r - b.r)).toBeLessThan(0.2);
      expect(a.h).toBeLessThan(0.6);
      const c = g.getAttribute('color') as BufferAttribute;
      let lacquer = 0;
      let vermillion = 0;
      let pale = 0;
      for (let i = 0; i < c.count; i++) {
        const r = c.getX(i);
        const gg = c.getY(i);
        const bb = c.getZ(i);
        if (bb > r && bb > gg && r > gg) lacquer++;
        if (r > 0.8 && gg < 0.45 && bb < 0.35) vermillion++;
        if (Math.min(r, gg, bb) > 0.75) pale++;
      }
      // (By corners.) The body is its violet lacquer; the vermillion is the runners'; what is pale is the comet and the steel, a
      // small share of it.
      expect(lacquer / c.count).toBeGreaterThan(0.2);
      expect(vermillion).toBeGreaterThan(100);
      expect(pale / c.count).toBeLessThan(0.3);
    }
  });
});
