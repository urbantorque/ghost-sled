import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Mood } from '../src/sim/chaos';
import { Course, RUN_OUT, Section, courseFor } from '../src/sim/course';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { getPalette } from '../src/render/palette';
import { Listener, type ListenSources, newView } from '../src/audio/listen';
import { SPAN_MARGIN, Site, SitePlan, airCeiling, pieceCtx, siteAir, siteRail, siteToWorld, underRoof } from '../src/render/landmarks';
import { ENCLOSED, LONG, mergePiece, pieceFor } from '../src/render/landmarkKit';
import { CHAIR_DROP, LINE_Z, liftLayout } from '../src/render/liftline';
import { OverlookPlan } from '../src/render/overlook';

// The course's sections are the plan: a street is a town, a tunnel an enclosure, a bridge a bridge, and
// nothing stands in the run. Every vertex of every piece is past the course's own edge limit there (the
// sim turns a sled back at it: 10 m on plain ground, 2 in a street, 0.8 on a bridge), or (a span, an
// enclosure's roof, a town's strings and banners) higher than any sled can fly by the margin.

const MOODS = [Mood.None, Mood.Comet];
/** The longest a run may go between places, overlooks counted. */
const BARE_MOST = 330;

const flown = (c: Course, mood: Mood): SitePlan => {
  const plan = new SitePlan(c, mood);
  plan.flyTo(c.finishZ + RUN_OUT);
  return plan;
};

const sections = (c: Course): Section[] => {
  const out: Section[] = [];
  for (let z = 0; z < c.finishZ + RUN_OUT; ) {
    const s = c.section(z);
    out.push(s);
    z = s.z1;
  }
  return out;
};

/** The longest stretch with nothing in it, set pieces and overlooks both counted. */
function longestBare(c: Course, list: readonly Site[]): { gap: number; at: number } {
  const looks = new OverlookPlan(c);
  looks.planTo(c.finishZ);
  const spans: Array<[number, number]> = [...list.map((s): [number, number] => [s.z - s.len, s.z + s.len]), ...looks.planned.map((o): [number, number] => [o.z0, o.z1])];
  spans.sort((a, b) => a[0] - b[0]);
  let end = 0;
  let gap = 0;
  let at = 0;
  for (const [a, b] of spans) {
    if (a - end > gap) {
      gap = a - end;
      at = end;
    }
    end = Math.max(end, b);
  }
  return { gap, at };
}

describe('the plan is the course', () => {
  for (const m of MOUNTAINS) {
    for (const mood of MOODS) {
      it(`${m.name} (${Mood[mood]}): sections are places, deterministic`, () => {
        const c = courseFor(m.seed);
        const a = flown(c, mood);
        const b = flown(c, mood);
        expect(a.planned.map((s) => [s.z, s.kind, s.len, s.clear])).toEqual(b.planned.map((s) => [s.z, s.kind, s.len, s.clear]));
        const list = a.planned;
        const holds = (z0: number, z1: number, want: (s: Site) => boolean) => list.some((s) => want(s) && s.z - s.len <= z0 + 2 && s.z + s.len >= z1 - 2);
        for (const sec of sections(c)) {
          const body = sec.z0 + sec.blend;
          if (sec.kind === 'street') expect(holds(body, sec.z1, (s) => s.kind === 'village'), `street at ${sec.z0}`).toBe(true);
          if (sec.kind === 'tunnel') expect(holds(body + 2, sec.z1, (s) => ENCLOSED.has(s.kind)), `tunnel at ${sec.z0}`).toBe(true);
          if (sec.kind === 'bridge') expect(holds(body, sec.z1, (s) => s.kind === 'viaduct'), `bridge at ${sec.z0}`).toBe(true);
        }
        // The finish town holds the line and the whole run-out; a start stands at z = 0; every leap is watched.
        expect(holds(c.finishZ - 200, c.finishZ + RUN_OUT, (s) => s.kind === 'finish')).toBe(true);
        expect(holds(0, 100, (s) => s.kind === 'start')).toBe(true);
        for (const l of c.leaps) expect(list.some((s) => s.kind === 'lip' && s.z === l.z)).toBe(true);
        // In z order, and nothing overlaps.
        for (let i = 1; i < list.length; i++) {
          expect(list[i].z).toBeGreaterThan(list[i - 1].z);
          const gap = list[i].z - list[i].len - (list[i - 1].z + list[i - 1].len);
          expect(gap, `${list[i - 1].kind} then ${list[i].kind}`).toBeGreaterThan(0);
        }
        // A point piece keeps off the kilometre arches (a leap's lip is where it is).
        for (const s of list) if (s.len === 0 && s.kind !== 'lip' && s.z > 500) expect(Math.abs(s.z - Math.round(s.z / 1000) * 1000)).toBeGreaterThanOrEqual(89);
        // The same fills from one to the next rarely repeat a kind (Comet flies higher, so a span can drop
        // to the bank piece beside another).
        let repeats = 0;
        for (let i = 1; i < list.length; i++) if (list[i].len === 0 && list[i].kind !== 'lip' && list[i].kind !== 'lift' && list[i].kind === list[i - 1].kind) repeats++;
        expect(repeats).toBeLessThanOrEqual(1);
      });

      it(`${m.name} (${Mood[mood]}): no bare stretch runs past about 300 m`, () => {
        const c = courseFor(m.seed);
        const { gap, at } = longestBare(c, flown(c, mood).planned);
        expect(gap, `bare from ${Math.round(at)}`).toBeLessThanOrEqual(BARE_MOST);
      });
    }
  }

  it("the echo and the frame's dark read one truth: an enclosure rings and darkens only under a roof that stands", () => {
    const heard = (c: Course, mood: Mood, sites: readonly Site[]): ListenSources => ({ course: c, biome: c.biome, mood, tier: 'high', sites, crowds: false, flocks: [], birds: null, lifts: false, lift: () => null, chimneys: [], chimneyCount: 0, vista: 0, dusk: 0, night: false });
    let roofed = 0;
    let open = 0;
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      for (const mood of MOODS) {
        const list = flown(c, mood).planned;
        const src = heard(c, mood, list);
        const l = new Listener();
        const v = newView();
        for (const s of list) {
          if (!ENCLOSED.has(s.kind)) continue;
          for (const z of [s.z - s.len * 0.5, s.z, s.z + s.len * 0.5]) {
            l.hear(src, c.centerX(z), z, 0, v);
            const dark = underRoof(s, z);
            expect(v.enclosed > 0).toBe(dark > 0);
            if (mood === Mood.Comet) expect(dark).toBe(0);
            if (dark > 0) roofed++;
            else open++;
          }
        }
      }
    }
    // Low gravity takes every roof off; a plain day has roofs to ride under.
    expect(roofed).toBeGreaterThan(0);
    expect(open).toBeGreaterThan(0);
  });

  it('where things stand does not depend on the mood; how high they stand does', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const day = new SitePlan(c, Mood.None).planned.map((s) => [s.z, s.len]);
      expect(new SitePlan(c, Mood.Comet).planned.map((s) => [s.z, s.len])).toEqual(day);
    }
  });

  it('dailies plan too, in any order of their acts', () => {
    for (const day of ['2026-10-24', '2026-11-06', '2026-12-25', '2027-02-14', '2027-07-04']) {
      const c = courseFor(dailySeed(day));
      const plan = flown(c, Mood.None);
      expect(plan.planned.length).toBeGreaterThan(9);
      const list = plan.planned;
      for (let i = 1; i < list.length; i++) expect(list[i].z - list[i].len, day).toBeGreaterThan(list[i - 1].z + list[i - 1].len);
      expect(longestBare(c, plan.planned).gap, day).toBeLessThanOrEqual(BARE_MOST);
    }
  });

  it('roofs what they can: every tunnel of the plain moods, none where gravity is low', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      for (const s of flown(c, Mood.None).planned) if (ENCLOSED.has(s.kind)) expect(s.clear, `${m.name} ${s.kind}`).toBeGreaterThan(0);
      for (const s of flown(c, Mood.Comet).planned) if (ENCLOSED.has(s.kind)) expect(s.clear).toBe(0);
    }
  });

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
      for (const s of flown(c, Mood.None).planned) {
        if (s.len === 0 || s.len > 150) continue;
        for (const dz of [-s.len, -s.len / 2, 0, s.len / 2, s.len]) {
          const z = s.z + dz;
          expect(siteAir(s, z - 1, z + 1)).toBeGreaterThanOrEqual(airCeiling(c, z - 1, z + 1, 1, 1) - 1e-3);
        }
      }
    }
  });
});

describe('every kind of place appears', () => {
  it('towns, the finish, the start, bridges, lifts and each biome tunnel are all planned somewhere', () => {
    const kinds = new Set<string>();
    for (const m of MOUNTAINS) for (const s of new SitePlan(courseFor(m.seed), Mood.None).planned) kinds.add(s.kind);
    for (const k of ['village', 'finish', 'start', 'lip', 'lift', 'viaduct', 'gallery', 'lavatunnel', 'toriirow']) expect(kinds.has(k), k).toBe(true);
  });

  it('a falls never stands behind a wall, where it rears over the run', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      for (const mood of MOODS) for (const s of flown(c, mood).planned) if (s.kind === 'falls') expect(['ravine', 'gully', 'tunnel', 'treerun']).not.toContain(c.section(s.z).kind);
    }
  });
});

describe('what stands near the run keeps out of it', () => {
  for (const m of MOUNTAINS) {
    for (const mood of MOODS) {
      it(`${m.name} (${Mood[mood]}): every vertex is past the limit or over the highest air`, () => {
        const c = courseFor(m.seed);
        const p = getPalette(c.biome, mood);
        const plan = flown(c, mood);
        const w = new Vector3();
        const end = c.finishZ + RUN_OUT;
        // The sim's limit on plain ground is 10 m: the rule there stays 9.2.
        const keep = (z: number) => Math.min(9.2, c.edgeLimit(z));
        for (const s of plan.planned) {
          for (const night of s.len > 0 ? [false, true] : [false]) {
            const piece = pieceFor(s.kind, pieceCtx(c, s, p, night, false));
            const g = mergePiece(piece.steps.flatMap((f) => f()));
            const pos = g.getAttribute('position');
            const air = s.span ? airCeiling(c, s.z - 7, s.z + 7, 1, 1) : 0;
            const point = LONG.has(s.kind) ? false : !s.span;
            let worst = Infinity;
            let where = '';
            for (let i = 0; i < pos.count; i += s.len > 0 ? 2 : 3) {
              siteToWorld(s, pos.getX(i), pos.getY(i), pos.getZ(i), w);
              const sz = -w.z;
              const e = c.edgeExcess(w.x, sz);
              if (e >= keep(sz)) continue;
              // (Buried in the bank is not in the run.)
              if (w.y < c.ground(w.x, sz)) continue;
              // Past the run-out a sled never comes: the hall that closes the view stands there.
              if (sz > end) continue;
              // The painted line lies on the snow.
              if (s.kind === 'finish' && Math.abs(sz - c.finishZ) < 3 && w.y - c.ground(w.x, sz) < 0.2) continue;
              if (s.len > 0) {
                // A long site's overhead parts: over the air in the bin they hang in (and its
                // neighbours), and never low over the snow where nothing flies.
                const top = Math.max(siteAir(s, sz - 2, sz + 2), c.ground(w.x, sz));
                if (w.y - top < worst) {
                  worst = w.y - top;
                  where = `z ${sz.toFixed(1)}, ${e.toFixed(2)} past the edge (limit ${c.edgeLimit(sz).toFixed(2)}), ${(w.y - c.ground(w.x, sz)).toFixed(1)} over the snow`;
                }
                continue;
              }
              // Inside the margin: only a span's parts, and only well over the air.
              expect(point, `${s.kind} at ${Math.round(s.z)}: ${e.toFixed(1)} past the edge`).toBe(false);
              worst = Math.min(worst, w.y - air);
            }
            if (worst < Infinity) expect(worst, `${s.kind} at ${Math.round(s.z)}: ${where}`).toBeGreaterThanOrEqual(SPAN_MARGIN - 0.5);
            // A crowd stands past the limit too, and lamplight stays near the run's edge.
            for (const sp of piece.spots) {
              // (A span's own spots stand on its deck, high over the run.)
              if (s.span) continue;
              siteToWorld(s, sp.x, sp.y, sp.z, w);
              const sz = -w.z;
              expect(c.edgeExcess(w.x, sz), `${s.kind} crowd`).toBeGreaterThanOrEqual(keep(sz));
            }
            for (const gl of piece.glows ?? []) {
              siteToWorld(s, gl.x, 0, gl.z, w);
              expect(c.edgeExcess(w.x, -w.z) - gl.r).toBeGreaterThanOrEqual(-4);
            }
            g.dispose();
          }
        }
      });
    }

    it(`${m.name}: a chair clears the highest air under its line`, () => {
      const c = courseFor(m.seed);
      for (const mood of MOODS) {
        const mp = mood === Mood.Comet ? { g: 0.62, pop: 0.9 } : { g: 1, pop: 1 };
        for (const s of flown(c, mood).planned) {
          if (s.kind !== 'lift') continue;
          const rail = siteRail;
          expect(rail).toBeDefined();
          const { C } = liftLayout(s.post, s.clear, s.side, (x, z) => c.ground(s.x + x * Math.cos(s.yaw) + z * Math.sin(s.yaw), s.z + x * Math.sin(s.yaw) - z * Math.cos(s.yaw)) - s.y);
          const air = airCeiling(c, s.z - LINE_Z - 4, s.z + LINE_Z + 4, mp.g, mp.pop) - s.y;
          expect(C - CHAIR_DROP - air).toBeGreaterThanOrEqual(SPAN_MARGIN - 0.5);
        }
      }
    });
  }
});

describe('the budget', () => {
  it('holds a street to the old village, and the finish to the biggest thing in the game', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const p = getPalette(c.biome, Mood.None);
      for (const s of flown(c, Mood.None).planned) {
        if (s.kind !== 'village' && s.kind !== 'finish') continue;
        for (const low of [false, true]) {
          const g = mergePiece(pieceFor(s.kind, pieceCtx(c, s, p, true, low)).steps.flatMap((f) => f()));
          const tris = g.getAttribute('position').count / 3;
          const most = s.kind === 'finish' ? (low ? 70000 : 130000) : low ? 28000 : 60000;
          expect(tris, `${m.name} ${s.kind} low ${low}`).toBeLessThanOrEqual(most);
          g.dispose();
        }
      }
    }
  });
});
