import { describe, expect, it } from 'vitest';
import { Mood } from '../src/sim/chaos';
import { courseFor, FOREST_LIMIT } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { SitePlan } from '../src/render/landmarks';
import { LIP, LIP_FROM, OverlookPlan, lipDrop } from '../src/render/overlook';
import { buildTerrainGeometry } from '../src/render/terrain';

// Overlooks: deterministic stretches where one bank opens over the valley. The corridor, its banks and
// the shelf the dressing stands on keep the sim's ground; the first comes in the first 600 m; none
// comes near a set piece.

const RUN = 5000;
const MOUNTAIN_SEEDS = MOUNTAINS.filter((m) => m.id !== 'daily').map((m) => m.seed);

describe('overlook plan', () => {
  for (const seed of MOUNTAIN_SEEDS) {
    const c = courseFor(seed);
    const plan = new OverlookPlan(c);
    plan.planTo(RUN);
    const list = plan.planned.filter((o) => o.z0 < RUN);

    it(`${c.biome}: wherever the open ground allows, 120 to 300 m long, the first inside 600 m`, () => {
      // (Open ground is about a quarter of a descent, and places and set pieces take most of that: the big
      // views are the leaps' now.)
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list.length).toBeLessThanOrEqual(10);
      expect(list[0].z1).toBeLessThanOrEqual(600);
      for (const o of list) {
        expect(o.z1 - o.z0).toBeGreaterThanOrEqual(120);
        expect(o.z1 - o.z0).toBeLessThanOrEqual(300);
      }
      for (let i = 1; i < list.length; i++) expect(list[i].z0).toBeGreaterThan(list[i - 1].z1 + 250);
    });

    it(`${c.biome}: keeps 120 m from every set piece's ends in every mood, and its outer fall 110 m`, () => {
      for (const mood of [Mood.None, Mood.Comet, Mood.Powder]) {
        const sites = new SitePlan(c, mood);
        sites.planTo(RUN + 1000);
        for (const o of list) {
          for (const s of sites.planned) {
            const d = s.z < o.z0 ? o.z0 - s.z - s.len : s.z > o.z1 ? s.z - s.len - o.z1 : 0;
            expect(d).toBeGreaterThanOrEqual(120);
            const od = s.z < o.oz0 ? o.oz0 - s.z : s.z > o.oz1 ? s.z - o.oz1 : 0;
            expect(od).toBeGreaterThanOrEqual(110);
            // (No fall at all at the set piece's own spot.)
            expect(plan.fall(s.z, -1) + plan.fall(s.z, 1)).toBe(0);
          }
        }
      }
    });

    it(`${c.biome}: opens only on open ground, never beside a wall, a kerb or a ledge`, () => {
      const narrow = new Set(['ravine', 'treerun', 'street', 'bridge', 'tunnel', 'gully', 'leap', 'terraces', 'lake', 'fork', 'finish']);
      for (const o of list) for (let z = o.z0; z <= o.z1; z += 10) expect(narrow.has(c.section(z).kind)).toBe(false);
    });

    it(`${c.biome}: is the same every time`, () => {
      const again = new OverlookPlan(c);
      again.planTo(RUN);
      expect(again.planned.filter((o) => o.z0 < RUN)).toEqual(list);
    });
  }

  it('lowers nothing inside the lip, and never lifts the cornice more than a metre', () => {
    for (let e = 0; e <= LIP_FROM; e += 0.25) expect(lipDrop(e)).toBe(0);
    for (let e = LIP_FROM; e < LIP + 60; e += 0.25) expect(lipDrop(e)).toBeGreaterThan(-1);
    // ...and the face falls away steeply past it.
    expect(lipDrop(LIP + 40)).toBeGreaterThan(25);
    expect(LIP_FROM).toBeGreaterThan(FOREST_LIMIT + 0.5);
  });
});

describe('overlook terrain', () => {
  it("keeps the sim's ground exactly out to the lip, and falls away past it", () => {
    const c = courseFor(MOUNTAINS[0].seed);
    const plan = new OverlookPlan(c);
    plan.planTo(1000);
    const o = plan.planned[0];
    const side = o.side === 0 ? 1 : o.side;
    const zm = (o.z0 + o.z1) / 2;
    const ci = Math.floor(zm / 64);
    const geo = buildTerrainGeometry(c, ci, { inner: 0.85, row: 2, reach: 110 }, plan);
    const plain = buildTerrainGeometry(c, ci, { inner: 0.85, row: 2, reach: 110 });
    const p = geo.getAttribute('position');
    const q = plain.getAttribute('position');
    const edge = geo.getAttribute('aEdge');
    let fell = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = -p.getZ(i);
      const e = edge.getX(i);
      if (e <= LIP_FROM) {
        // Inside the lip: the same vertex as with no overlook, and on the corridor the sim's ground.
        expect(p.getY(i)).toBe(q.getY(i));
        if (e <= FOREST_LIMIT) expect(p.getY(i)).toBeCloseTo(c.ground(x, z), 4);
      } else if (e > LIP + 20 && Math.sign(x - c.centerX(z)) === side && plan.weight(z, side) > 0.99) {
        expect(p.getY(i)).toBeLessThan(q.getY(i) - 10);
        fell++;
      }
    }
    expect(fell).toBeGreaterThan(50);
  });
});
