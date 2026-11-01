import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Mood } from '../src/sim/chaos';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { getPalette } from '../src/render/palette';
import { SPAN_MARGIN, Site, SitePlan, airCeiling, siteAir, siteGround, siteRail, siteToWorld } from '../src/render/landmarks';
import { ENCLOSED, mergePiece, pieceFor } from '../src/render/landmarkKit';

// The set pieces never stand in the run: every vertex of every piece is either at least 9.2 m past
// the corridor's edge, or (a span, an enclosure's roof, a village's strings and banners) higher than
// any sled can fly there by the margin.

const RUN = 8000;

/** Clear metres between two consecutive sites (end of one to the start of the next). */
function gapOf(a: Site, b: Site): number {
  return b.z - b.len - (a.z + a.len);
}

describe('set piece plan', () => {
  for (const m of MOUNTAINS) {
    for (const mood of [Mood.None, Mood.Comet]) {
      it(`${m.name} (${Mood[mood]}): spaced, kinds vary, deterministic, villages and enclosures`, () => {
        const c = courseFor(m.seed);
        const a = new SitePlan(c, mood);
        a.planTo(RUN);
        const b = new SitePlan(c, mood);
        b.planTo(RUN);
        expect(a.planned.map((s) => [s.z, s.kind, s.len])).toEqual(b.planned.map((s) => [s.z, s.kind, s.len]));
        const list = a.planned;
        expect(list.length).toBeGreaterThan(5);
        for (let i = 1; i < list.length; i++) {
          const long = list[i].len > 0 || list[i - 1].len > 0;
          const gap = gapOf(list[i - 1], list[i]);
          // (A village and an enclosed run may follow each other closely: out of the street into the shed.)
          const pair = list[i].len > 0 && list[i - 1].len > 0;
          expect(gap).toBeGreaterThanOrEqual(pair ? 99 : long ? 290 : 500);
          // (A site nudged off a kilometre arch can run a little long; a long one further, as it steers
          // clear of the arches, the bowls and gullies, and the air.)
          expect(gap).toBeLessThanOrEqual(long ? 1700 : 900 + 100);
          expect(list[i].kind).not.toBe(list[i - 1].kind);
        }
        for (const s of list) {
          if (s.len === 0) expect(Math.abs(s.z - Math.round(s.z / 1000) * 1000) >= 89 || Math.round(s.z / 1000) === 0).toBe(true);
          // A long site keeps its whole stretch off the kilometre arches.
          else for (let km = 1; km <= 9; km++) expect(km * 1000 < s.z - s.len - 39 || km * 1000 > s.z + s.len + 39).toBe(true);
        }
        // Villages every 1.5 to 2.5 km (or a little more where they steer off a bowl), the first by 2 km.
        const villages = list.filter((s) => s.kind === 'village');
        expect(villages.length).toBeGreaterThanOrEqual(2);
        expect(villages[0].z).toBeLessThan(2000);
        for (const v of villages) expect(v.len * 2).toBeGreaterThanOrEqual(150);
        if (mood === Mood.None) expect(list.some((s) => ENCLOSED.has(s.kind))).toBe(true);
        for (const s of list) if (ENCLOSED.has(s.kind)) expect(s.clear).toBeLessThanOrEqual(33);
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

  it("a long site's air profile is never below the air ceiling it bins", () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const plan = new SitePlan(c, Mood.None);
      plan.planTo(RUN);
      for (const s of plan.planned) {
        if (s.len === 0) continue;
        for (const dz of [-s.len, -s.len / 2, 0, s.len / 2, s.len]) {
          const z = s.z + dz;
          const exact = airCeiling(c, z - 1, z + 1, 1, 1);
          expect(siteAir(s, z - 1, z + 1)).toBeGreaterThanOrEqual(exact - 1e-3);
        }
      }
    }
  });
});

describe('every new kind of place appears', () => {
  it('villages, galleries and each biome tunnel are all planned somewhere', () => {
    const kinds = new Set<string>();
    for (const m of MOUNTAINS) {
      const plan = new SitePlan(courseFor(m.seed), Mood.None);
      plan.planTo(RUN);
      for (const s of plan.planned) kinds.add(s.kind);
    }
    for (const k of ['village', 'gallery', 'icetunnel', 'lavatunnel', 'toriirow']) expect(kinds.has(k), k).toBe(true);
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
        for (const night of s.len > 0 ? [false, true] : [false]) {
          const piece = pieceFor(s.kind, { p, biome: c.biome, gy: siteGround(c, s), post: s.post, clear: s.clear, side: s.side, night, seed: s.n, rail: s.len > 0 ? siteRail(c, s) : undefined });
          const g = mergePiece(piece.steps.flatMap((f) => f()));
          const pos = g.getAttribute('position');
          const air = s.span ? airCeiling(c, s.z - 7, s.z + 7, 1, 1) : 0;
          let worst = Infinity;
          for (let i = 0; i < pos.count; i += s.len > 0 ? 2 : 3) {
            siteToWorld(s, pos.getX(i), pos.getY(i), pos.getZ(i), w);
            const sz = -w.z;
            const e = c.edgeExcess(w.x, sz);
            if (e >= 9.2) continue;
            if (s.len > 0) {
              // A long site's overhead parts: over the air in the bin they hang in (and its
              // neighbours), and never low over the snow where nothing flies.
              const top = Math.max(siteAir(s, sz - 2, sz + 2), c.ground(w.x, sz));
              worst = Math.min(worst, w.y - top);
              continue;
            }
            // Inside the margin: only a span's parts, and only well over the air.
            expect(s.span).toBe(true);
            worst = Math.min(worst, w.y - air);
          }
          if ((s.span || s.len > 0) && worst < Infinity) expect(worst, `${s.kind} at ${Math.round(s.z)}`).toBeGreaterThanOrEqual(SPAN_MARGIN - 0.5);
          // A village's crowd and lamplight stand past the margin too.
          for (const sp of piece.spots) {
            siteToWorld(s, sp.x, sp.y, sp.z, w);
            if (s.len > 0) expect(c.edgeExcess(w.x, -w.z)).toBeGreaterThanOrEqual(9.4);
          }
          for (const gl of piece.glows ?? []) {
            siteToWorld(s, gl.x, 0, gl.z, w);
            expect(c.edgeExcess(w.x, -w.z) - gl.r).toBeGreaterThanOrEqual(3.5);
          }
          g.dispose();
        }
      }
      expect(kinds.size).toBeGreaterThanOrEqual(4);
      expect(kinds.has('village')).toBe(true);
    });
  }
});
