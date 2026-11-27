import { describe, expect, it } from 'vitest';
import { Midground } from '../src/render/midground';
import { getPalette } from '../src/render/palette';
import { Mood } from '../src/sim/chaos';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { isGullhaven, seaLevelOf } from '../src/render/gullhavenplan';
import { isGablefall } from '../src/render/gablefallplan';

// A tree's foot may sink into the ground (each is planted 1.5 m deep) but never hang over it. Trees
// scatter along z between the mesh's rows and used to take the height of the row they were scattered
// from: 8% of spots stood over 2 m clear of the ground, up to 25.7 m at 224 m on Pinecrest's left, in
// front of the far ranges.
const ROW = 16;

describe('midground forest', () => {
  for (const m of MOUNTAINS) {
    it(`stands on the ground on ${m.id}`, () => {
      const course = courseFor(m.seed);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mg = new Midground(course, getPalette(course.biome, Mood.None), 'high', 110) as any;
      // (Round 9, Gablefall: no forest stands in its town or on its valley's far side, midground.ts's town, so there is no
      // tree to stand: none in any window down the run.)
      if (isGablefall(course)) {
        for (let at = 100; at < course.finishZ; at += 300) {
          mg.update(at, true);
          for (let q = 0; q < mg.aT.length / 4; q++) expect(mg.aT[q * 4 + 3], `a tree at ${at}`).toBeLessThanOrEqual(0);
        }
        return;
      }
      // (Round 9, Gullhaven: no forest stands on its moor or its cliff, so there is no tree to stand. Its mid-ground is
      // the sea cliff falling under the sea's level seaward, the water drawn over it, and the moor rising landward.)
      if (isGullhaven(course)) {
        const sea = seaLevelOf(course);
        for (let at = 100; at < course.finishZ; at += 300) {
          mg.update(at, true);
          for (let q = 0; q < mg.aT.length / 4; q++) expect(mg.aT[q * 4 + 3], `a tree at ${at}`).toBeLessThanOrEqual(0);
          for (const side of [-1, 1]) {
            const info = mg.sideG;
            mg.sideInfo(at, side, info);
            const foot = course.ground(course.centerX(at) + side * course.halfWidth(at), at);
            for (let i = 0; i < mg.colU.length; i++) {
              if (mg.colKind[i] !== 0 || Math.sign(mg.colU[i]) !== side) continue;
              const e = mg.colE[i];
              const y = mg.height(info, e, mg.colX(info, e), at);
              if (side > 0) expect(y, `the cliff's foot at ${at}`).toBeLessThan(sea - 20);
              else expect(y, `the moor at ${at}`).toBeGreaterThan(foot - 2);
            }
          }
        }
        return;
      }
      // The drawn surface: the mesh's own columns either side of e, lerped across, as a row holds them.
      const profile = (z: number, side: number, e: number): number => {
        const info = mg.sideG;
        mg.sideInfo(z, side, info);
        let lo = -1;
        for (let i = 0; i < mg.colU.length; i++) {
          const nx = side > 0 ? i + 1 : i - 1;
          if (mg.colKind[i] !== 0 || Math.sign(mg.colU[i]) !== side || nx < 0 || nx >= mg.colU.length || mg.colKind[nx] !== 0) continue;
          if (mg.colE[i] <= e && mg.colE[nx] > e) {
            lo = i;
            break;
          }
        }
        const hi = side > 0 ? lo + 1 : lo - 1;
        const e0 = mg.colE[lo];
        const e1 = mg.colE[hi];
        const y0 = mg.height(info, e0, mg.colX(info, e0), z);
        const y1 = mg.height(info, e1, mg.colX(info, e1), z);
        return y0 + ((y1 - y0) * (e - e0)) / (e1 - e0);
      };
      let trees = 0;
      let worst = -Infinity;
      // The stream's window moves down the first 2 km, past the spot this bug was seen at.
      for (let at = 100; at < 2000; at += 300) {
        mg.update(at, true);
        for (let q = 0; q < mg.aT.length / 4; q++) {
          if (mg.aT[q * 4 + 3] <= 0) continue;
          const e = mg.aV[q * 4 + 2];
          if (e > 620) continue;
          const zz = -mg.aT[q * 4 + 2];
          const side = mg.aT[q * 4] < course.centerX(zz) ? -1 : 1;
          const z0 = Math.floor(zz / ROW) * ROW;
          const a = profile(z0, side, e);
          const b = profile(z0 + ROW, side, e);
          worst = Math.max(worst, mg.aT[q * 4 + 1] - (a + (b - a) * ((zz - z0) / ROW)));
          trees++;
        }
      }
      expect(trees).toBeGreaterThan(300);
      expect(worst).toBeLessThan(0.6);
    });
  }
});
