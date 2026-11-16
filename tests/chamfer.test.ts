import { BufferAttribute, BufferGeometry, Color } from 'three';
import { describe, expect, it } from 'vitest';
import { CHAMFER_TRIS, chamferBox, kitBox, withChamfer } from '../src/render/chamfer';
import { blossomGeometry, forestSet, paleBlossomGeometry, part } from '../src/render/flora';
import { stoneLampGeometry } from '../src/render/lanternkit';
import { builtLetters } from '../src/render/lettering';
import { kickerLipGeometry, lanternGeometry, obstacleGeometry } from '../src/render/meshes';
import { getPalette } from '../src/render/palette';
import { Facets, formBounds } from '../src/render/rockforms';
import { Mood } from '../src/sim/chaos';

// The visual lift's edges that look made: a chamfered box stays inside its box and faces out, its chamfers
// take their light by where they look, Low and thin parts keep their plain box, and the named pieces (the
// kicker's lip, the stone lantern, Lanternfall's stone lamp, the blossom, the boards' letters) hold their forms
// and their triangle budgets.

const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('a chamfered box', () => {
  it('is 44 triangles inside its box, every face looking out', () => {
    const g = chamferBox(1, 0.5, 0.3, 0.05);
    expect(tris(g)).toBe(CHAMFER_TRIS);
    const p = g.getAttribute('position') as BufferAttribute;
    const n = g.getAttribute('normal') as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(0.25 + 1e-6);
      expect(Math.abs(p.getZ(i))).toBeLessThanOrEqual(0.15 + 1e-6);
    }
    for (let f = 0; f < p.count; f += 3) {
      const cx = p.getX(f) + p.getX(f + 1) + p.getX(f + 2);
      const cy = p.getY(f) + p.getY(f + 1) + p.getY(f + 2);
      const cz = p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2);
      expect(n.getX(f) * cx + n.getY(f) * cy + n.getZ(f) * cz).toBeGreaterThan(0);
    }
    // A tapered post keeps its foot and narrows to its head.
    const t = chamferBox(0.4, 1, 0.4, 0.03, [0.5, 0.5]);
    const tp = t.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < tp.count; i++) if (tp.getY(i) > 0.49) expect(Math.abs(tp.getX(i))).toBeLessThanOrEqual(0.1 + 1e-6);
  });

  it('takes its light by where its chamfers look: lighter up, darker down, never past white, a light untouched', () => {
    const mid = new Color(0.5, 0.5, 0.5);
    const g = part(chamferBox(1, 1, 1, 0.1), mid);
    const n = g.getAttribute('normal') as BufferAttribute;
    const c = g.getAttribute('color') as BufferAttribute;
    let up = 0;
    let down = 0;
    let face = 0;
    for (let i = 0; i < n.count; i++) {
      const ny = n.getY(i);
      if (Math.abs(ny) > 0.99 || Math.abs(n.getX(i)) > 0.99 || Math.abs(n.getZ(i)) > 0.99) {
        expect(c.getX(i)).toBeCloseTo(0.5, 5);
        face++;
      } else if (ny > 0.5) {
        expect(c.getX(i)).toBeGreaterThan(0.6);
        up++;
      } else if (ny < -0.5) {
        expect(c.getX(i)).toBeLessThan(0.5);
        down++;
      }
    }
    expect(face).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(0);
    const white = part(chamferBox(1, 1, 1, 0.1), new Color(0.95, 0.95, 0.95)).getAttribute('color') as BufferAttribute;
    for (let i = 0; i < white.count; i++) expect(white.getX(i)).toBeLessThanOrEqual(1 + 1e-6);
    const lamp = part(chamferBox(1, 1, 1, 0.1), new Color(2, 1.6, 1)).getAttribute('color') as BufferAttribute;
    for (let i = 0; i < lamp.count; i++) if (lamp.getX(i) > 1.5) expect(lamp.getX(i)).toBeCloseTo(2, 5);
  });

  it("is a kit's on Medium and High where it is thick enough; Low, thin parts and lights keep a box", () => {
    const full = (w: number, h: number, d: number, col?: Color, sign = false) => withChamfer('full', () => tris(kitBox(w, h, d, col, sign)));
    expect(full(1, 1, 1)).toBe(CHAMFER_TRIS);
    expect(full(2, 0.1, 1)).toBe(12);
    expect(full(2, 0.1, 1, undefined, true)).toBe(CHAMFER_TRIS);
    expect(full(1, 1, 1, new Color(2.2, 1.8, 1))).toBe(12);
    expect(withChamfer('low', () => tris(kitBox(1, 1, 1)))).toBe(12);
    expect(withChamfer('off', () => tris(kitBox(1, 1, 1)))).toBe(12);
  });
});

describe('the named pieces', () => {
  const sakura = getPalette('blossom', Mood.None);
  const lantern = getPalette('lantern', Mood.None);

  it("the kicker's lip: unit wide, its roll tucked in at the ends, no heavier than a lip should be", () => {
    for (const low of [false, true]) {
      const g = kickerLipGeometry(sakura, low);
      const p = g.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))).toBe(true);
        expect(Math.abs(p.getX(i))).toBeLessThanOrEqual(0.503);
        // (Nothing stands more than a hand over the ramp: a sled rides over it.)
        expect(p.getY(i)).toBeLessThanOrEqual(0.12);
        // At its very ends the roll lies down into the ramp.
        if (Math.abs(p.getX(i)) > 0.499 && p.getZ(i) > -0.2) expect(p.getY(i)).toBeLessThanOrEqual(-0.03);
      }
      expect(tris(g)).toBeLessThanOrEqual(low ? 300 : 360);
    }
  });

  it('the stone lantern and the stone lamp stand within their colliders and their budgets', () => {
    for (const low of [false, true]) {
      const g = lanternGeometry(low);
      const b = formBounds(g, 0.05);
      // (The collider is 0.6 m, drawn at 0.85 to 1.2 times: the stone stays about inside it, and only the cap's
      // corners reach past it, over a rider's knees.)
      expect(b.r).toBeLessThanOrEqual(0.66);
      expect(b.h).toBeLessThanOrEqual(1.75);
      expect(tris(g)).toBeLessThanOrEqual(low ? 500 : 580);
      expect(tris(obstacleGeometry('lantern', sakura, low, 'blossom'))).toBe(tris(g));
      const s = stoneLampGeometry(low);
      expect(formBounds(s, 0.05).r).toBeLessThanOrEqual(0.7);
      expect(tris(s)).toBeLessThanOrEqual(low ? 200 : 460);
      expect(tris(obstacleGeometry('lantern', lantern, low, 'lantern'))).toBe(tris(s));
    }
  });

  it('the blossom: a soft canopy, and the far orchard at half the triangles of round 7', () => {
    const budget = { rich: 560, near: 300, lean: 150, far: 72 } as const;
    for (const build of ['rich', 'near', 'lean', 'far'] as const) {
      for (const g of [blossomGeometry(sakura, build), paleBlossomGeometry(sakura, build)]) {
        expect(tris(g)).toBeLessThanOrEqual(budget[build]);
        const n = g.getAttribute('normal') as BufferAttribute;
        let soft = 0;
        for (let f = 0; f < n.count; f += 3) {
          for (let j = f; j < f + 3; j++) expect(Math.hypot(n.getX(j), n.getY(j), n.getZ(j))).toBeCloseTo(1, 3);
          // A canopy's corners carry their own normals (the cloud shades as one soft mass), not its face's.
          if (Math.abs(n.getX(f) - n.getX(f + 1)) + Math.abs(n.getY(f) - n.getY(f + 1)) > 0.05) soft++;
        }
        expect(soft / (n.count / 3)).toBeGreaterThan(0.5);
      }
    }
    // The orchards: the near set and the far set, each a full and a pale tree.
    expect(forestSet('blossom', sakura, 'a', 2).getAttribute('position').count / 3).toBeLessThanOrEqual(2 * budget.far);
    expect(tris(obstacleGeometry('blossom', sakura, true))).toBeLessThanOrEqual(budget.lean);
  });

  it("built letters keep the dot font's box: 5 units wide, 7 tall, 6 to the next", () => {
    const u = 0.46;
    const g = builtLetters('FINISH', 2, 1, u, new Color('#2A2D48'));
    expect(g).toHaveLength(6);
    const x0 = -((6 * 6 * u - u) / 2);
    g.forEach((q, i) => {
      q.computeBoundingBox();
      const b = q.boundingBox!;
      expect(b.min.x).toBeGreaterThanOrEqual(x0 + i * 6 * u - 0.02);
      expect(b.max.x).toBeLessThanOrEqual(x0 + i * 6 * u + 5.1 * u + 0.02);
      expect(b.min.y).toBeGreaterThanOrEqual(2 - 0.02);
      expect(b.max.y).toBeLessThanOrEqual(2 + 7 * u + 0.02);
      // Its face is at z (plus the board's offset the caller gives), its back sunk into the board.
      expect(b.max.z).toBeLessThanOrEqual(1.01);
      expect(tris(q)).toBeLessThanOrEqual(420);
    });
    expect(builtLetters('START', 0, 0, 0.34, new Color(1, 1, 1))).toHaveLength(5);
  });

  it("a weathered rock's walls are soft and its joints crisp (Facets' smoothing groups)", () => {
    const f = new Facets();
    f.soft = 1;
    f.group = 1;
    const red = new Color(0.4, 0.4, 0.4);
    // Two walls meeting at a corner, one group: at their shared corner the normals agree.
    f.quad([0, 0, 1], [1, 0, 0], [1, 1, 0], [0, 1, 1], red, [1, 0, 1]);
    f.quad([1, 0, 0], [0, 0, -1], [0, 1, -1], [1, 1, 0], red, [1, 0, -1]);
    f.group = 0;
    f.quad([0, 1, 1], [1, 1, 0], [0, 1, -1], [-1, 1, 0], red, [0, 1, 0]);
    const g = f.build();
    const p = g.getAttribute('position') as BufferAttribute;
    const n = g.getAttribute('normal') as BufferAttribute;
    const at = (x: number, y: number, z: number, from: number, to: number) => {
      for (let i = from; i < to; i++) if (Math.abs(p.getX(i) - x) + Math.abs(p.getY(i) - y) + Math.abs(p.getZ(i) - z) < 1e-6) return [n.getX(i), n.getY(i), n.getZ(i)];
      return null;
    };
    const a = at(1, 0, 0, 0, 6)!;
    const b = at(1, 0, 0, 6, 12)!;
    expect(a[0]).toBeCloseTo(b[0], 5);
    expect(a[2]).toBeCloseTo(b[2], 5);
    // The top (group 0) keeps its flat face.
    expect(n.getY(12)).toBeCloseTo(1, 5);
  });
});
