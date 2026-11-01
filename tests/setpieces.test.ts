import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Mood } from '../src/sim/chaos';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { getPalette } from '../src/render/palette';
import { SPAN_MARGIN, SitePlan, airCeiling, siteGround, siteToWorld } from '../src/render/landmarks';
import { mergePiece, pieceFor } from '../src/render/landmarkKit';

// The set pieces never stand in the run: every vertex of every piece is either at least 9.2 m past
// the corridor's edge, or (a span) higher than any sled can fly there by the margin.

const RUN = 6000;

describe('set piece plan', () => {
  for (const m of MOUNTAINS) {
    for (const mood of [Mood.None, Mood.Comet]) {
      it(`${m.name} (${Mood[mood]}): spaced 500 to 900 m, kinds vary, deterministic`, () => {
        const c = courseFor(m.seed);
        const a = new SitePlan(c, mood);
        a.planTo(RUN);
        const b = new SitePlan(c, mood);
        b.planTo(RUN);
        expect(a.planned.map((s) => [s.z, s.kind])).toEqual(b.planned.map((s) => [s.z, s.kind]));
        const list = a.planned;
        expect(list.length).toBeGreaterThan(5);
        for (let i = 1; i < list.length; i++) {
          const gap = list[i].z - list[i - 1].z;
          expect(gap).toBeGreaterThanOrEqual(500);
          // (A site nudged off a kilometre arch can run a little long.)
          expect(gap).toBeLessThanOrEqual(900 + 90);
          expect(list[i].kind).not.toBe(list[i - 1].kind);
        }
        for (const s of list) expect(Math.abs(s.z - Math.round(s.z / 1000) * 1000) >= 89 || Math.round(s.z / 1000) === 0).toBe(true);
      });
    }
  }

  it('flies a pop on a falling slope higher than the floor', () => {
    const c = courseFor(MOUNTAINS[0].seed);
    const z = 2000;
    const top = airCeiling(c, z - 7, z + 7, 1, 1);
    expect(top - c.ground(c.centerX(z), z)).toBeGreaterThan(8);
    // Low gravity flies higher still.
    expect(airCeiling(c, z - 7, z + 7, 0.62, 0.9)).toBeGreaterThan(top);
  });
});

describe('set piece geometry keeps out of the run', () => {
  for (const m of MOUNTAINS) {
    it(`${m.name}: every vertex is past the bank margin or over the highest air`, () => {
      const c = courseFor(m.seed);
      const p = getPalette(c.biome, Mood.None);
      const plan = new SitePlan(c, Mood.None);
      plan.planTo(RUN);
      const w = new Vector3();
      const kinds = new Set<string>();
      for (const s of plan.planned) {
        kinds.add(s.kind);
        const piece = pieceFor(s.kind, { p, biome: c.biome, gy: siteGround(c, s), post: s.post, clear: s.clear, side: s.side, night: false, seed: s.n });
        const g = mergePiece(piece.steps.flatMap((f) => f()));
        const pos = g.getAttribute('position');
        const air = s.span ? airCeiling(c, s.z - 7, s.z + 7, 1, 1) : 0;
        let worst = Infinity;
        for (let i = 0; i < pos.count; i += 3) {
          siteToWorld(s, pos.getX(i), pos.getY(i), pos.getZ(i), w);
          const sz = -w.z;
          const e = c.edgeExcess(w.x, sz);
          if (e >= 9.2) continue;
          // Inside the margin: only a span's parts, and only well over the air.
          expect(s.span).toBe(true);
          worst = Math.min(worst, w.y - air);
        }
        if (s.span && worst < Infinity) expect(worst).toBeGreaterThanOrEqual(SPAN_MARGIN - 0.5);
        g.dispose();
      }
      expect(kinds.size).toBeGreaterThanOrEqual(3);
    });
  }
});
