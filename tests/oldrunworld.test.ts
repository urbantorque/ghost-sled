import { BufferAttribute, BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { forestSteps, hasLod } from '../src/render/flora';
import { crestGround, groundOf, visualGround } from '../src/render/ground';
import { bareTreeGeometry } from '../src/render/oldrunflora';
import { getPalette } from '../src/render/palette';
import { buildTerrainGeometry } from '../src/render/terrain';
import { Mood } from '../src/sim/chaos';
import { CHUNK_LEN, courseFor } from '../src/sim/course';
import { MOUNTAINS, OLDRUN_LAB_SEED } from '../src/sim/mountains';
import { FLOOR, GLAZE, GLAZE_HI, GLAZE_LO, LIP, SLUSH, WALL, drawnGround, trackAt } from '../src/sim/oldrun';

// Round 9, the Old Run's world (notes/r9-oldrun-world.md): what its drawing promises. The track's ice, glaze and slush
// are painted from the sim's own surfaces; past the lip everything stands on the crest of snow, never the sim's rising
// wall; its forest is its own bare wood at every distance; and none of it reaches the five.

const tris = (g: BufferGeometry) => g.getAttribute('position').count / 3;
const DETAIL = { inner: 0.85, row: 2, reach: 110 };

describe("the Old Run's world", () => {
  const c = courseFor(OLDRUN_LAB_SEED);

  it('paints the glaze and the slush where the sim lays them', () => {
    let glazed = 0;
    let checked = 0;
    for (const i of [3, 8, 14, 20, 27]) {
      const g = buildTerrainGeometry(c, i, DETAIL);
      const tr = g.getAttribute('aTrack') as BufferAttribute;
      const pos = g.getAttribute('position') as BufferAttribute;
      expect(tr).toBeDefined();
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v);
        const z = -pos.getZ(v);
        const u = tr.getX(v);
        // Well inside the band or well outside it, the paint and the sim agree.
        if (u > GLAZE_LO + 0.06 && u < GLAZE_HI - 0.06) {
          checked++;
          const s = c.surface(x, z);
          expect(tr.getY(v) === 1, `glaze at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(s === GLAZE);
          if (s === GLAZE) glazed++;
        }
        if (u < -0.08) expect(tr.getZ(v) === 1, `slush at ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(c.surface(x, z) === SLUSH);
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(glazed).toBeGreaterThan(20);
  });

  it('draws the crest of snow past the lip, never the sim wall rising into a cliff, and the same ground inside it', () => {
    const gnd = groundOf(c);
    for (let z = 40; z < c.finishZ; z += 97) {
      const t = trackAt(c, z);
      const q = Math.sqrt(1 + t.p * t.p);
      for (const side of [-1, 1]) {
        // Inside the lip's reach the drawn ground is the sim's, to the millimetre.
        for (let d = 0; d <= LIP + 0.5; d += 0.5) {
          const x = t.cx + side * d * q;
          expect(Math.abs(gnd(x, z) - c.ground(x, z))).toBeLessThan(1e-6);
        }
        // Well past it the crest has fallen to the forest floor: within a few metres of the lip's height.
        const far = t.cx + side * (FLOOR + WALL * 4) * q;
        const lip = c.ground(t.cx + side * LIP * q, z);
        expect(gnd(far, z)).toBeLessThan(lip + 3);
        expect(c.ground(far, z)).toBeGreaterThan(lip + 20);
        // Props stand on what is drawn.
        expect(visualGround(c, far, z)).toBeCloseTo(crestGround(c, far, z), 6);
        // Its crest is the sim's drawn crest to the top, and only its fall is longer.
        const top = t.cx + side * (FLOOR + WALL * 1.3) * q;
        expect(crestGround(c, top, z)).toBeCloseTo(drawnGround(c, top, z), 6);
      }
    }
  });

  it('grows its own bare wood at every distance, lighter than a spruce on Low and far off', () => {
    const p = getPalette('oldrun', Mood.None);
    expect(hasLod('oldrun', 'a')).toBe(true);
    expect(hasLod('oldrun', 'b')).toBe(true);
    for (const kind of ['beech', 'oldbeech', 'birch', 'twinbirch'] as const) {
      const full = tris(bareTreeGeometry(kind, 0));
      const low = tris(bareTreeGeometry(kind, 1));
      const far = tris(bareTreeGeometry(kind, 2));
      expect(full, kind).toBeLessThan(1500);
      expect(low, kind).toBeLessThan(full);
      expect(far, kind).toBeLessThan(low);
    }
    for (const set of ['a', 'b'] as const) for (const make of forestSteps('oldrun', p, set, 0)) expect(tris(make())).toBeGreaterThan(50);
  });

  it('reaches none of the five: their terrain carries no track and their ground is the sim own', () => {
    for (const m of MOUNTAINS) {
      const five = courseFor(m.seed);
      if (five.kit) continue;
      const g = buildTerrainGeometry(five, 2, DETAIL);
      expect(g.getAttribute('aTrack')).toBeUndefined();
      const gnd = groundOf(five);
      for (let z = 100; z < 1400; z += 211) for (const x of [-30, -5, 0, 12, 40]) expect(gnd(five.centerX(z) + x, z)).toBe(five.ground(five.centerX(z) + x, z));
    }
    expect(CHUNK_LEN).toBeGreaterThan(0);
  });
});
