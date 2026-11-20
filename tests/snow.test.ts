import { type BufferAttribute, Color, Vector3 } from 'three';
import { afterAll, describe, expect, it } from 'vitest';
import { BUDGET, fx, setFxBudget } from '../src/render/fxhub';
import { shared } from '../src/render/materials';
import { Particles } from '../src/render/particles';
import { GROOM_BLEND, groomedAt, rutSurface } from '../src/render/snowsurf';
import { buildTerrainGeometry } from '../src/render/terrain';
import { GhostTrails, Trail, grooveReach } from '../src/render/trails';
import { type Course, courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';

// Round 8, snow as the hero material (the snow lane): the three surfaces are read from what the sim already
// knows and drawn, never fed back; a sled's trench is deep in powder, shallow on a groomed lane and a scratch on
// ice; a perfect landing throws more snow than a fall; the moving snow keeps to its tier's budget.

afterAll(() => {
  setFxBudget(1);
  fx.reduced = false;
});

const pine = courseFor(MOUNTAINS[0].seed);

/** The middle of the first section of `kind` on course c, past its blend in. */
function bodyOf(c: Course, kind: string): number {
  for (let z = 0; z < 4600; z += 10) {
    const s = c.section(z);
    if (s.kind === kind && s.z1 - s.z0 > GROOM_BLEND * 3) return (s.z0 + GROOM_BLEND + s.z1) / 2;
  }
  throw new Error(`no ${kind}`);
}

describe('the three surfaces', () => {
  it('a made place is a groomed lane, a wild one powder, and one gives way to the next over a blend', () => {
    expect(groomedAt(pine, bodyOf(pine, 'cruise'))).toBe(1);
    expect(groomedAt(pine, bodyOf(pine, 'street'))).toBe(1);
    expect(groomedAt(pine, bodyOf(pine, 'treerun'))).toBe(0);
    expect(groomedAt(pine, bodyOf(pine, 'bowl'))).toBe(0);
    // Every change between the two is a ramp, never a step.
    let last = groomedAt(pine, 0);
    for (let z = 0.5; z < 4500; z += 0.5) {
      const g = groomedAt(pine, z);
      expect(Math.abs(g - last)).toBeLessThan(0.06);
      last = g;
    }
  });

  it("a leap's landing is groomed, as ART.md 4 has it", () => {
    let seen = 0;
    for (const l of pine.ledges) {
      if (l.kind !== 'leap') continue;
      expect(groomedAt(pine, (l.land0 + l.land1) / 2 - 12)).toBeGreaterThan(0.9);
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('a rut reads ice where the sim has ice, and the bank past the edge is powder', () => {
    let iced = 0;
    for (let z = 0; z < 4500 && iced < 3; z += 4) {
      const x = pine.safeX(z);
      if (pine.surface(x, z).ice) {
        expect(rutSurface(pine, x, z)).toBe(2);
        iced++;
      }
    }
    expect(iced).toBeGreaterThan(0);
    const z = bodyOf(pine, 'cruise');
    expect(rutSurface(pine, pine.centerX(z), z)).toBe(1);
    expect(rutSurface(pine, pine.centerX(z) + pine.halfWidth(z) + 2, z)).toBe(0);
  });

  it('the terrain carries the groomed weight per vertex and changes no height', () => {
    const z = bodyOf(pine, 'cruise');
    const i = Math.floor(z / 40);
    const geo = buildTerrainGeometry(pine, i, { inner: 1.2, row: 2, reach: 60 });
    const groom = geo.getAttribute('aGroom') as BufferAttribute;
    const pos = geo.getAttribute('position') as BufferAttribute;
    expect(groom.count).toBe(pos.count);
    let lane = 0;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const sz = -pos.getZ(k);
      if (pine.edgeExcess(x, sz) < -1) {
        expect(pos.getY(k)).toBeCloseTo(pine.ground(x, sz), 4);
        lane += groom.getX(k);
      }
    }
    expect(lane).toBeGreaterThan(0);
  });
});

describe('ruts with depth', () => {
  it('a trench in powder reaches further than a groomed cut, and ice is a scratch', () => {
    for (const d of [0.12, 0.5, 1]) {
      expect(grooveReach(d, 0)).toBeGreaterThan(grooveReach(d, 1));
      expect(grooveReach(d, 1)).toBeGreaterThan(grooveReach(d, 2));
    }
    expect(grooveReach(1, 0)).toBeLessThan(1.4);
  });

  it('the groove and the ghosts upload what each sample cut, and only the samples added', () => {
    setFxBudget(1);
    const t = new Trail(pine, 900, 'groove');
    const z0 = bodyOf(pine, 'treerun');
    for (let k = 0; k < 20; k++) t.add(pine.safeX(z0 + k), z0 + k, 0.5, 0.4, k / 30, 30);
    const surf = t.mesh.geometry.getAttribute('aSurf') as BufferAttribute;
    expect(surf.updateRanges.reduce((n, r) => n + r.count, 0)).toBe(20 * 2);
    const g = new GhostTrails(pine, 2, 360, [new Color('#8FF3E4'), new Color('#8FF3E4')]);
    for (let k = 0; k < 10; k++) g.add(1, pine.safeX(z0 + k), z0 + k, k / 30);
    const gs = g.mesh.geometry.getAttribute('aSurf') as BufferAttribute;
    expect(gs.updateRanges.reduce((n, r) => n + r.count, 0)).toBe(10 * 2);
  });
});

/** Billows (and dabs) alive in the powder layer: the body of what a moment throws. */
function billows(p: Particles): number {
  p.update(1e-4);
  const kind = p.powder.points.geometry.getAttribute('aKind') as BufferAttribute;
  const n = p.powder.points.geometry.drawRange.count;
  let b = 0;
  for (let k = 0; k < n; k++) if (kind.getX(k) >= 3 && kind.getX(k) < 5) b++;
  return b;
}

describe('snow that moves', () => {
  const at = new Vector3(0, 10, -500);
  const vel = new Vector3(0, -3, -28);

  it('a perfect landing throws more snow than a fall', () => {
    setFxBudget(1);
    const a = new Particles(1800);
    a.setQuality(1, 720);
    a.perfect(at, vel, 1);
    const fall = new Particles(1800);
    fall.setQuality(1, 720);
    // (world.ts: a crash's burst.)
    fall.burst(at, 2, 60);
    expect(billows(a)).toBeGreaterThan(billows(fall));
  });

  it("a ghost leaves powder hanging on Medium and High, none on Low, and the hub knows who to ask", () => {
    for (const [budget, tier] of [[0.45, 0], [0.75, 1], [1, 2]] as const) {
      const p = new Particles(1800);
      p.setQuality(budget, 720);
      expect(fx.tier).toBe(tier);
      expect(fx.snow).toBe(p);
      p.ghostPowder(0, 0, -100, 0, -30, 30);
      p.update(1e-4);
      const n = p.powder.points.geometry.drawRange.count;
      if (tier === 0) expect(n).toBe(0);
      else expect(n).toBeGreaterThan(0);
    }
    expect(BUDGET.hangEvery[0]).toBe(Infinity);
  });

  it('spindrift keeps to its budget, is none on Low and none under reduced motion', () => {
    shared.uTime.value = 0;
    for (const [budget, tier] of [[0.45, 0], [1, 2]] as const) {
      const p = new Particles(1800);
      p.setQuality(budget, 720);
      fx.reduced = false;
      for (let f = 0; f < 60; f++) p.spindrift(pine, 300, 1 / 60);
      p.update(1e-4);
      const n = p.powder.points.geometry.drawRange.count;
      // At most every wisp's puffs for a second's worth at the tier's rate.
      expect(n).toBeLessThanOrEqual(BUDGET.spindrift[tier] * 4 + 4);
      if (tier === 0) expect(n).toBe(0);
    }
    const r = new Particles(1800);
    r.setQuality(1, 720);
    fx.reduced = true;
    for (let f = 0; f < 60; f++) r.spindrift(pine, 300, 1 / 60);
    r.update(1e-4);
    expect(r.powder.points.geometry.drawRange.count).toBe(0);
    fx.reduced = false;
  });
});
