import { readFileSync, readdirSync } from 'node:fs';
import { InstancedMesh, Matrix4, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { gullPlaceOf, gulliesOf, placesOf } from '../src/sim/gullhaven';
import { momentPlays } from '../src/sim/moments';
import { CLIFF_FROM, cliffGround, groundOf } from '../src/render/ground';
import { BEACON, cleftAt, isGullhaven, lighthouseZ, pointAt, seaLevelOf } from '../src/render/gullhavenplan';
import { GullhavenWorld } from '../src/render/gullhavenworld';
import { GullhavenPieces } from '../src/render/gullhavenpieces';
import { makeSeaUniforms } from '../src/render/massif';

// Round 9, Gullhaven's world (notes/r9-gullhaven-world.md): the sea at its own level under the harbour's ice, the ground
// drawn past the corridor's edges (the sea cliff and its clefts, the moor), the world's own places on both tiers, its
// set pieces' props from the plays, and none of it in the first download.

const m = MOUNTAINS.find((q) => courseFor(q.seed).kit?.id === 'gullhaven');
const c = courseFor(m!.seed);

describe("Gullhaven's ground", () => {
  it('is a mountain the world knows by its kit', () => {
    expect(m).toBeDefined();
    expect(isGullhaven(c)).toBe(true);
    for (const q of MOUNTAINS) if (q !== m) expect(isGullhaven(courseFor(q.seed))).toBe(false);
    expect(groundOf(c)(c.centerX(900) + 40, 900)).toBe(cliffGround(c, c.centerX(900) + 40, 900));
  });

  it('lays the sea a little under the harbour ice, a thousand metres under the cape', () => {
    const sea = seaLevelOf(c);
    const fz = c.finishZ;
    expect(c.ground(c.centerX(fz), fz) - sea).toBeGreaterThan(0.5);
    expect(c.ground(c.centerX(fz), fz) - sea).toBeLessThan(12);
    expect(c.ground(c.centerX(fz + 200), fz + 200) - sea).toBeCloseTo(0.6, 3);
    expect(c.ground(c.centerX(BEACON.z), BEACON.z) - sea).toBeGreaterThan(900);
  });

  it("is the sim's to the millimetre out to the limit, both sides, the whole run", () => {
    for (let z = 0; z <= c.finishZ + c.runOut; z += 1.5) {
      const lim = c.edgeLimit(z);
      const hw = c.halfWidth(z);
      for (const side of [-1, 1]) {
        for (const e of [-hw, -2, 0, CLIFF_FROM, lim * 0.5, lim]) {
          const x = c.centerX(z) + side * (hw + e);
          expect(cliffGround(c, x, z), `${z} ${side} ${e}`).toBe(c.ground(x, z));
        }
      }
    }
  });

  it('stops the cliff on the sea floor, cuts each cleft to the fence, and holds the points out past it', () => {
    const floor = seaLevelOf(c) - 30;
    for (let z = 0; z <= c.finishZ + c.runOut; z += 7) {
      const x0 = c.centerX(z) + c.halfWidth(z);
      for (const e of [12, 40, 120, 400]) expect(cliffGround(c, x0 + e, z)).toBeGreaterThanOrEqual(floor);
    }
    for (const g of gulliesOf(c)) {
      const z = g.zL + g.mouth / 2;
      expect(cleftAt(c, z), `the cleft at ${g.index}`).toBe(1);
      const x0 = c.centerX(z) + c.halfWidth(z);
      const from = Math.max(CLIFF_FROM, c.edgeLimit(z));
      const top = c.ground(x0 + from, z);
      // (A sheer drop of some thirty metres under the fence.)
      expect(cliffGround(c, x0 + from + 2.6, z), `the cleft at ${g.index}`).toBeLessThan(top - 25);
      expect(cleftAt(c, g.zL - 30)).toBe(0);
    }
    // (The beacon's knoll and the lighthouse's point: the cliff top held out past the fence.)
    for (const p of [BEACON, { z: lighthouseZ(c), e: 20, r: 22 }]) {
      expect(pointAt(c, p.e, p.z)).toBe(1);
      const x0 = c.centerX(p.z) + c.halfWidth(p.z);
      expect(cliffGround(c, x0 + p.e, p.z)).toBeGreaterThan(c.ground(x0 + 0.6, p.z) - 1.5);
    }
  });

  it('raises the moor gently landward, never a wall', () => {
    for (let z = 50; z < c.finishZ; z += 50) {
      const x0 = c.centerX(z) - c.halfWidth(z);
      const a = cliffGround(c, x0 - 10, z);
      const b = cliffGround(c, x0 - 60, z);
      expect(b - a, `${z}`).toBeGreaterThan(0);
      expect((b - a) / 50, `${z}`).toBeLessThan(0.45);
    }
  });
});

/** Every named piece of the world on a tier, and its triangles. */
function worldOf(low: boolean): { w: GullhavenWorld; names: Map<string, number> } {
  const w = new GullhavenWorld(null, makeSeaUniforms());
  w.setDetail(low ? 'low' : 'high');
  w.setCourse(c);
  const names = new Map<string, number>();
  w.root.traverse((o) => {
    if (!(o instanceof Mesh) || !o.name) return;
    const g = o.geometry;
    const tris = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    names.set(o.name, (names.get(o.name) ?? 0) + tris * (o instanceof InstancedMesh ? o.count : 1));
  });
  return { w, names };
}

describe("Gullhaven's world", () => {
  const high = worldOf(false);
  const low = worldOf(true);

  it('stands its places on both tiers, Low the cheaper', () => {
    const want = ['sea', 'fence', 'moor-wall', 'cornices', 'geo-walls', 'sea-stacks', 'surf', 'beacon', 'lighthouse', 'lighthouse-beam', 'harbour', 'finish-line', 'harbour-lights', 'onlookers', 'gulls'];
    for (const n of want) {
      expect(high.names.get(n), `${n} high`).toBeGreaterThan(0);
      expect(low.names.get(n), `${n} low`).toBeGreaterThan(0);
    }
    const sum = (q: Map<string, number>) => [...q.values()].reduce((a, b) => a + b, 0);
    expect(sum(low.names)).toBeLessThan(sum(high.names) * 0.75);
    let draws = [0, 0];
    for (const [k, q] of [high, low].entries()) q.w.root.traverse((o) => void (o instanceof Mesh && draws[k]++));
    expect(draws[1]).toBeLessThan(draws[0]);
  });

  it("stands the fence with its posts' inner face at the limit, on the cliff top", () => {
    const end = placesOf(c).harbour;
    const mm = new Matrix4();
    const v = new Vector3();
    let seen = 0;
    high.w.root.traverse((o) => {
      if (!(o instanceof InstancedMesh) || o.name !== 'fence' || o.count < 1000) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, mm);
        v.setFromMatrixPosition(mm);
        const z = -v.z;
        if (z > end) continue;
        const e = c.edgeExcess(v.x, z);
        const want = Math.min(c.edgeLimit(z), 0.8) + 0.08;
        expect(Math.abs(e - want), `a post at ${z.toFixed(0)}`).toBeLessThan(0.05);
        seen++;
      }
    });
    expect(seen).toBeGreaterThan(1000);
  });

  it('stands the lighthouse at The Lighthouse, seaward of the end of its shelf', () => {
    const cape = gullPlaceOf(c, 'cape');
    expect(lighthouseZ(c)).toBeGreaterThan(cape.z1);
    expect(lighthouseZ(c)).toBeLessThan(cape.z1 + 30);
    // (Clear of the next gully's cleft.)
    expect(cleftAt(c, lighthouseZ(c) + 22)).toBe(0);
  });

  it('keeps the shore road among its stacks: one in the sea off each of The Sea Stacks gaps', () => {
    const play = momentPlays(c).find((p) => p.verb === 'stacks')!;
    const mm = new Matrix4();
    const v = new Vector3();
    const at: number[] = [];
    high.w.root.traverse((o) => {
      if (!(o instanceof InstancedMesh) || o.name !== 'sea-stacks') return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, mm);
        v.setFromMatrixPosition(mm);
        at.push(-v.z);
      }
    });
    for (const t of play.targets) expect(at.some((z) => Math.abs(z - t.z) < 10), `a stack off the gap at ${t.z}`).toBe(true);
  });
});

describe("Gullhaven's set pieces", () => {
  const plays = momentPlays(c);

  it('has three, the five verbs stand nothing for them', () => {
    expect(plays.map((p) => p.verb).sort()).toEqual(['beam', 'soar', 'stacks']);
    const verbs = readFileSync('src/render/verbworld.ts', 'utf8');
    for (const v of ['beam', 'soar', 'stacks']) expect(verbs).toContain(`p.verb !== '${v}'`);
    const marquee = readFileSync('src/render/marqueeworld.ts', 'utf8');
    for (const v of ['beam', 'soar', 'stacks']) expect(marquee).toContain(`p.verb === '${v}'`);
  });

  it('stands their props from the plays, nothing above the snow inside the limit, on both tiers', () => {
    for (const low of [false, true]) {
      const p = new GullhavenPieces(null);
      p.build(c, plays, low);
      let paint = 0;
      let pools = 0;
      for (const o of p.root.children) {
        if (o instanceof InstancedMesh) {
          if (o.material === (p as unknown as { poolMat: unknown }).poolMat) pools = o.instanceMatrix.count;
          continue;
        }
        if (!(o instanceof Mesh) || o.visible === false) continue;
        const pos = o.geometry.getAttribute('position');
        for (let v = 0; v < pos.count; v++) {
          const x = pos.getX(v);
          const z = -pos.getZ(v);
          if (c.edgeExcess(x, z) >= c.edgeLimit(z)) continue;
          paint++;
          expect(pos.getY(v) - c.ground(x, z), `on the run at ${z.toFixed(0)}`).toBeLessThan(0.1);
        }
      }
      // (The beam's and the gaps' paint lies on the run; a pool for every mark and every gap.)
      expect(paint).toBeGreaterThan(0);
      const beam = plays.find((q) => q.verb === 'beam')!;
      const stacks = plays.find((q) => q.verb === 'stacks')!;
      expect(pools).toBe(beam.gates.length + stacks.targets.length);
    }
  });
});

describe('the first download', () => {
  it("holds none of Gullhaven's world: it is loaded the first time its course is drawn", () => {
    const own = new Set(['gullhavenworld.ts', 'gullhavenpieces.ts']);
    for (const f of readdirSync('src/render')) {
      if (!f.endsWith('.ts') || own.has(f)) continue;
      const src = readFileSync(`src/render/${f}`, 'utf8');
      for (const mod of ['gullhavenworld', 'gullhavenpieces']) {
        const fixed = new RegExp(`^import (?!type )[^;]*from '\\./${mod}'`, 'm');
        expect(fixed.test(src), `${f} imports ${mod}`).toBe(false);
      }
    }
    expect(readFileSync('src/render/world.ts', 'utf8')).toContain("import('./gullhavenworld')");
  });
});
