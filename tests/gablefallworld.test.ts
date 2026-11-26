import { readFileSync } from 'node:fs';
import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { courseFor } from '../src/sim/course';
import { GABLEFALL_LAB_SEED, MOUNTAINS } from '../src/sim/mountains';
import { BACK, FRONT, HOLD, PAVE, placesOf, rowsOf, streetOf } from '../src/sim/gablefall';
import { groundOf } from '../src/render/ground';
import { LANE, isGablefall, pavedAt, riverAt, townColumns, townGround } from '../src/render/gablefallplan';
import { GablefallWorld } from '../src/render/gablefallworld';
import { lateralOffsets } from '../src/render/terrain';

// Round 9, Gablefall's world (notes/r9-gablefall-world.md): the ground drawn past the corridor's edges (the lanes behind
// the rows, the hillside under the church, the quay and the river), the terrain's columns that draw a front and a step
// sheer, the world's own places on both tiers, nothing of it on the snow a sled rides, and none of it in the first
// download. (The lab seed until the mountain is registered; its MOUNTAINS row after.)

const m = MOUNTAINS.find((q) => courseFor(q.seed).kit?.id === 'gablefall');
const c = courseFor(m ? m.seed : GABLEFALL_LAB_SEED);

describe("Gablefall's ground", () => {
  it('is a course the world knows by its kit', () => {
    expect(isGablefall(c)).toBe(true);
    for (const q of MOUNTAINS) if (q !== m) expect(isGablefall(courseFor(q.seed))).toBe(false);
    expect(groundOf(c)(c.centerX(900) + 40, 900)).toBe(townGround(c, c.centerX(900) + 40, 900));
  });

  it("is the sim's to the millimetre out to the limit, both sides, the whole run", () => {
    for (let z = -10; z <= c.finishZ + c.runOut; z += 1.5) {
      const lim = c.edgeLimit(z);
      const hw = c.halfWidth(z);
      for (const side of [-1, 1]) {
        for (const e of [-hw, -hw + PAVE, -hw + FRONT + 0.05, -2, 0, lim * 0.5, lim]) {
          const x = c.centerX(z) + side * (hw + e);
          expect(townGround(c, x, z), `${z} ${side} ${e}`).toBe(c.ground(x, z));
        }
      }
    }
  });

  it("lays the town's lanes behind the rows at the street's level, never a pit or a spike", () => {
    const offs = lateralOffsets(c, { inner: 0.85, row: 2, reach: 110 });
    for (let z = 0; z <= c.finishZ + c.runOut; z += 2) {
      const cx = c.centerX(z);
      const b = c.baseY(z);
      for (const off of offs) {
        const y = townGround(c, cx + off, z) - b;
        // (Nothing drawn stands over the street by more than a roof's ridge and a little, anywhere across the terrain.)
        expect(y, `${z} ${off.toFixed(1)}`).toBeLessThan(12);
      }
    }
    for (const r of rowsOf(c)) {
      for (const p of r.pieces) {
        if (p.kind !== 'house') continue;
        const z = (p.z0 + p.z1) / 2;
        const x = c.centerX(z) + r.side * (BACK + c.edgeLimit(z) + 3);
        expect(Math.abs(townGround(c, x, z) - c.baseY(z) - LANE), `behind a house at ${z}`).toBeLessThan(0.05);
      }
    }
  });

  it('draws a front, a drift side and a back sheer: a pair of columns either side of each', () => {
    const offs = lateralOffsets(c, { inner: 1.6, row: 3, reach: 60 });
    for (const a of townColumns()) {
      expect(offs).toContain(a);
      expect(offs).toContain(-a);
    }
    for (const a of [PAVE, FRONT]) expect(townColumns().some((q) => q < a) && townColumns().some((q) => q > a)).toBe(true);
  });

  it('paves the street and the squares, not the nave nor the river; the river is ice from the quay on', () => {
    expect(pavedAt(c, 20)).toBe(0);
    expect(pavedAt(c, 400)).toBe(1);
    expect(pavedAt(c, placesOf(c).quay + 40)).toBe(0);
    expect(riverAt(c, placesOf(c).quay)).toBe(0);
    expect(riverAt(c, c.finishZ)).toBe(1);
  });
});

/** Every named mesh of the world on a tier, its triangles, and the world. */
function worldOf(low: boolean): { w: GablefallWorld; names: Map<string, number>; meshes: Mesh[] } {
  const w = new GablefallWorld();
  w.setDetail(low ? 'low' : 'high');
  w.setCourse(c);
  const names = new Map<string, number>();
  const meshes: Mesh[] = [];
  w.root.traverse((o) => {
    if (!(o instanceof Mesh) || !o.name) return;
    meshes.push(o);
    const g = o.geometry;
    names.set(o.name, (names.get(o.name) ?? 0) + (g.index ? g.index.count : g.getAttribute('position').count) / 3);
  });
  return { w, names, meshes };
}

describe("Gablefall's world", () => {
  const high = worldOf(false);
  const low = worldOf(true);

  it('stands its places on both tiers, Low the cheaper and in fewer draws', () => {
    for (const n of ['town-near', 'church', 'market', 'quay', 'onlookers', 'churchyard-folk', 'valley', 'smoke']) {
      expect(high.names.get(n), `${n} high`).toBeGreaterThan(0);
      expect(low.names.get(n), `${n} low`).toBeGreaterThan(0);
    }
    expect(high.names.get('town-far')).toBeGreaterThan(0);
    // (Low draws the town past the rows in its segments' one mesh.)
    expect(low.names.has('town-far')).toBe(false);
    const sum = (q: Map<string, number>) => [...q.values()].reduce((a, b) => a + b, 0);
    expect(sum(low.names)).toBeLessThan(sum(high.names) * 0.75);
    expect(low.meshes.length).toBeLessThan(high.meshes.length);
    // (Section 0's design: a draw a 128 m segment for the town, never a draw a house.)
    expect(low.names.size).toBeLessThan(12);
    expect(low.meshes.filter((q) => q.name === 'town-near').length).toBeLessThanOrEqual(Math.ceil((placesOf(c).quay + 60) / 128));
  });

  it("stands nothing in the street's held lane under the hold, and nothing on the run's snow anywhere", () => {
    for (const q of high.meshes) {
      if (q.name === 'smoke' || q.name === 'valley') continue;
      const pos = q.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i += 3) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = -pos.getZ(i);
        if (z < 0 || z > c.finishZ + c.runOut) continue;
        const dx = Math.abs(x - c.centerX(z));
        const g = c.ground(x, z);
        const base = c.baseY(z);
        // (In the street: inside where a sled is held (the fronts, a drift's side), under the hold, only paint lying on the
        // snow.)
        const st = streetOf(c, z);
        const held = st ? Math.min(c.centerX(z) - st.x0, st.x1 - c.centerX(z)) : 0;
        if (st && dx < held - 0.7 && y < base + HOLD) expect(y - g, `${q.name} in the street at ${z.toFixed(0)}`).toBeLessThan(0.1);
        // (Anywhere inside the corridor's limit: nothing stands on the snow lower than a sled's air by the margin, but
        // what lies flat on it, the line's checks.)
        if (c.edgeExcess(x, z) < c.edgeLimit(z) - 0.1 && y > g + 0.1) expect(y - g, `${q.name} over the run at ${z.toFixed(0)}`).toBeGreaterThan(c.section(z).kind === 'rooftops' ? 0 : 7);
      }
    }
  });

  it("stands each house's front from the street to its eave, a little under the roof's snow", () => {
    let seen = 0;
    for (const r of rowsOf(c)) {
      for (const p of r.pieces) {
        if (p.kind !== 'house') continue;
        const z = (p.z0 + p.z1) / 2;
        const eave = c.ground(c.centerX(z) + r.side * (FRONT + 0.05), z);
        expect(eave - c.baseY(z), `a house at ${z}`).toBeGreaterThan(5);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('is none of the first download: the world loads it on demand', () => {
    const world = readFileSync('src/render/world.ts', 'utf8');
    expect(world).toContain("import('./gablefallworld')");
    expect(world).not.toMatch(/^import \{[^}]*\} from '\.\/gablefallworld'/m);
  });
});
