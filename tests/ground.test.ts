import { describe, expect, it } from 'vitest';
import { CHUNK_LEN, courseFor, type Course, type Section, type SectionKind } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { coastOn, rodeHome } from '../src/render/ghosts';
import { HANDOVER_TO, MID_ROW, crestE, facetNoise, handoverRow, openFoot, rampart, rockWeight, standable, visualGround, wallK } from '../src/render/ground';
import { buildTerrainGeometry } from '../src/render/terrain';

// What the ground is: rock where something shaped it, snow everywhere a sled rides, the terrain's edge
// on the mid-ground's rows at a ledge, and nothing standing on a wall.

const SEEDS = MOUNTAINS.filter((m) => m.id !== 'daily').map((m) => m.seed);
const DETAIL = { inner: 1.1, row: 2.2, reach: 90 };

function sections(c: Course, kind: SectionKind): Section[] {
  const out: Section[] = [];
  for (let z = 0; z < c.finishZ; ) {
    const s = c.section(z);
    if (s.kind === kind) out.push(s);
    z = s.z1;
  }
  return out;
}

describe('rock', () => {
  it('leaves a plain bank as snow, however steep', () => {
    // bank(5) is as steep as the bank gets: a slope of 1.6.
    expect(rockWeight(0, 0, 0, 10, 5, 20, 1.6, -0.3, 400, false)).toBe(0);
  });

  it('bares a wall from its foot to its crest', () => {
    expect(rockWeight(0, 13, 0, 5, -1, 6, 0, -0.4, 900, false)).toBe(0);
    expect(rockWeight(0, 13, 0, 5, 4, 11, 3, -0.4, 900, false)).toBe(1);
    expect(rockWeight(0, 13, 0, 5, 22, 29, 0.2, -0.4, 900, false)).toBe(0);
  });

  it("bares a ledge's face, but never a kicker's built takeoff wall", () => {
    expect(rockWeight(0, 0, 0, 10, -3, 2, 0, -3.5, 620, false)).toBe(1);
    expect(rockWeight(0, 0, 0, 10, -3, 2, 0, -3.5, 620, true)).toBe(0);
  });

  it('puts no rock on any line a sled rides', () => {
    for (const seed of SEEDS) {
      const c = courseFor(seed);
      for (const sec of [...sections(c, 'ravine'), ...sections(c, 'tunnel')]) {
        const z = sec.z0 + sec.blend + 20;
        const sh = c.shapeAt(z);
        expect(rockWeight(sh.ridge, sh.wall, sh.fall, sh.limit, -0.5, c.safeX(z) - c.centerX(z), 0, -0.4, z, false)).toBe(0);
      }
    }
  });
});

describe('walls', () => {
  it('stays on the sim\'s ground inside the limit, and stands up past it', () => {
    for (const seed of SEEDS) {
      const c = courseFor(seed);
      for (const sec of sections(c, 'ravine')) {
        const z = sec.z0 + sec.blend + 40;
        const sh = c.shapeAt(z);
        const k = wallK(sh.wall);
        expect(rampart(z, sh.limit, 1, k, sh.limit)).toBe(0);
        expect(rampart(z, sh.limit - 2, -1, k, sh.limit)).toBe(0);
        expect(rampart(z, crestE(sh.limit), 1, k, sh.limit)).toBeGreaterThan(2);
        const x = c.centerX(z) + c.halfWidth(z) + sh.limit - 0.5;
        expect(visualGround(c, x, z)).toBe(c.ground(x, z));
      }
    }
  });

  it('draws the ravine inside the limit exactly as the sim rides it', () => {
    const c = courseFor(SEEDS[1]);
    const sec = sections(c, 'ravine')[0];
    const i = Math.floor((sec.z0 + sec.blend + 30) / CHUNK_LEN);
    const g = buildTerrainGeometry(c, i, DETAIL);
    const pos = g.getAttribute('position');
    const edge = g.getAttribute('aEdge');
    let seen = 0;
    for (let v = 0; v < pos.count; v += 3) {
      const z = -pos.getZ(v);
      if (edge.getX(v) > c.edgeLimit(z)) continue;
      seen++;
      expect(pos.getY(v)).toBeCloseTo(c.ground(pos.getX(v), z), 3);
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('is a low-poly surface: flat across a cell', () => {
    const a = facetNoise(3.1, 7.1, 301);
    const b = facetNoise(3.15, 7.1, 301);
    const d = facetNoise(3.2, 7.1, 301);
    expect(d - b).toBeCloseTo(b - a, 8);
  });
});

describe('the handover at a ledge', () => {
  it("meets the mid-ground's straight rows at the terrain's edge", () => {
    for (const seed of SEEDS) {
      const c = courseFor(seed);
      const l = c.leaps[0];
      expect(handoverRow(c, l.z)).toBe(true);
      const i = Math.floor(l.z / CHUNK_LEN);
      const g = buildTerrainGeometry(c, i, DETAIL);
      const pos = g.getAttribute('position');
      const edge = g.getAttribute('aEdge');
      let seen = 0;
      for (let v = 0; v < pos.count; v++) {
        const z = -pos.getZ(v);
        if (edge.getX(v) < HANDOVER_TO + 1 || !handoverRow(c, z) || z < l.z || z > l.foot + 2) continue;
        const off = pos.getX(v) - c.centerX(z);
        const a = Math.floor(z / MID_ROW) * MID_ROW;
        const b = a + MID_ROW;
        const ya = c.ground(c.centerX(a) + off, a);
        const yb = c.ground(c.centerX(b) + off, b);
        // (Above the rows' line by what the drifts lift the snow, never under it.)
        const line = ya + ((yb - ya) * (z - a)) / MID_ROW;
        expect(pos.getY(v) - line).toBeGreaterThan(-0.01);
        expect(pos.getY(v) - line).toBeLessThan(2.6);
        seen++;
      }
      expect(seen).toBeGreaterThan(10);
    }
  });
});

describe('what can stand', () => {
  it('keeps trees off walls and ledge faces, and on the rest of the bank', () => {
    for (const seed of SEEDS) {
      const c = courseFor(seed);
      for (const sec of sections(c, 'ravine')) {
        const z = sec.z0 + sec.blend + 50;
        expect(standable(c, z, 7)).toBe(false);
        expect(standable(c, z, crestE(c.edgeLimit(z)) + 7)).toBe(true);
      }
      const l = c.leaps[0];
      expect(standable(c, l.z + 1, 14)).toBe(false);
      expect(standable(c, l.z - 30, 14)).toBe(true);
    }
  });
});

describe('a ghost that finished', () => {
  it('is told from one that crashed by where its track ended', () => {
    expect(rodeHome(4500.2, 4500)).toBe(true);
    expect(rodeHome(4503, 4500)).toBe(true);
    expect(rodeHome(4300, 4500)).toBe(false);
  });

  it('rides on and eases to a stop', () => {
    expect(coastOn(30, 0)).toBe(0);
    expect(coastOn(30, 1)).toBeGreaterThan(20);
    const far = coastOn(30, 100);
    expect(coastOn(30, 200)).toBe(far);
    expect(far).toBeLessThan(80);
  });
});

describe('an animal at the treeline', () => {
  /** Where Life stands them: about 9.3 to 10 m past the edge. */
  const EDGES = [9.3, 9.8, 10.2];

  it('never stands in rock, in a street, or over a gorge, on any mountain', () => {
    for (const seed of SEEDS) {
      const c = courseFor(seed);
      let open = 0;
      for (let z = 80; z < c.finishZ; z += 3) {
        for (const e of EDGES) {
          if (!openFoot(c, z, e)) continue;
          open++;
          for (const side of [-1, 1]) {
            const x = c.centerX(z) + side * (c.halfWidth(z) + e);
            expect(visualGround(c, x, z) - c.ground(x, z), `rock over it at ${z}`).toBeLessThan(0.3);
          }
          // (shapeAt hands back a shared object: read it last.)
          const sh = c.shapeAt(z);
          expect(sh.limit, `inside what bounds the run at ${z}`).toBeGreaterThan(e - 1);
          expect(sh.fall, `over a gorge at ${z}`).toBeLessThan(1);
        }
      }
      // ...and there is still plenty of treeline to stand at.
      expect(open).toBeGreaterThan(500);
    }
  });

  it('nor does the life lower on the bank: perched flocks, kids sledding and a drop-in', () => {
    // (Life asks openFoot a little further out than each stands: 4.5 to 8.4 m, plus up to 1.5.)
    for (const seed of SEEDS) {
      const c = courseFor(seed);
      let open = 0;
      for (let z = 80; z < c.finishZ; z += 3) {
        for (const e of [3.6, 4.6, 6.4, 8.4]) {
          if (!openFoot(c, z, e + 1.5)) continue;
          open++;
          for (const side of [-1, 1]) {
            const x = c.centerX(z) + side * (c.halfWidth(z) + e);
            expect(visualGround(c, x, z) - c.ground(x, z), `rock over it at ${z}`).toBeLessThan(0.3);
          }
          const sh = c.shapeAt(z);
          expect(sh.limit, `inside what bounds the run at ${z}`).toBeGreaterThan(e);
          expect(sh.fall, `over a gorge at ${z}`).toBeLessThan(1);
        }
      }
      expect(open).toBeGreaterThan(500);
    }
  });

  it('keeps out of every wall, and of the houses and gorges past a small limit', () => {
    for (const seed of SEEDS) {
      const c = courseFor(seed);
      for (const kind of ['ravine', 'tunnel', 'street', 'bridge'] as const) {
        for (const s of sections(c, kind)) for (let z = s.z0 + s.blend; z < s.z1; z += 5) for (const e of EDGES) expect(openFoot(c, z, e), `${kind} at ${z}`).toBe(false);
      }
    }
  });
});
