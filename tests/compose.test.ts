import { describe, expect, it } from 'vitest';
import { courseFor, type Course } from '../src/sim/course';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { CamPlacer } from '../src/render/camera';
import { LOOKS, composeFor, fallProf, segWeight, stepsProf, wallProf, type ComposePlan } from '../src/render/compose';
import { shapeGround, visualGround } from '../src/render/ground';
import { OverlookPlan } from '../src/render/overlook';
import { framingGeometry } from '../src/render/framing';
import { getPalette } from '../src/render/palette';

// Round 8, break the trench: each mountain's opening and stage starts are a place of their own (ART.md 15), drawn
// past the sim's limits only. The corridor and its banks out to the limit are the sim's to the millimetre; what is
// shaped keeps clear of every landmark; whatever stands there stands on what is drawn; the lens moves by place and
// never by metre.

const NAMED = MOUNTAINS.filter((m) => m.id !== 'daily');

function planFor(c: Course): { plan: ComposePlan; looks: OverlookPlan } {
  const looks = new OverlookPlan(c);
  const plan = composeFor(c, {
    sites: () => looks.siteList(),
    overlooks: () => {
      looks.planTo(Infinity);
      return looks.planned;
    },
  });
  looks.compose = plan;
  return { plan, looks };
}

describe('the composed places', () => {
  const looksSeen = new Set<string>();
  for (const m of NAMED) {
    const c = courseFor(m.seed);
    const { plan, looks } = planFor(c);
    const list = plan.planned;

    it(`${m.name}: composes its opening and both stage starts`, () => {
      expect(list.map((p) => p.at)).toEqual(['opening', 'stage', 'stage']);
      // The opening runs from the start's stands toward the first leap; each stage start lies on its threshold.
      expect(list[0].z0).toBeGreaterThanOrEqual(c.section(0).z1);
      expect(list[0].z0).toBeLessThan(160);
      expect(list[0].z1).toBeGreaterThan(420);
      for (const p of list.slice(1)) {
        const sec = c.section((p.z0 + p.z1) / 2);
        expect(sec.gate, `${p.z0}`).toBe(true);
        expect(p.z1 - p.z0).toBeGreaterThanOrEqual(90);
      }
      for (const p of list) looksSeen.add(`${c.biome}:${p.look}`);
    });

    it(`${m.name}: nothing at or inside the limit moves`, () => {
      for (const p of list) {
        for (let z = p.z0; z <= p.z1; z += 7) {
          const lim = c.shapeAt(z).limit;
          const hw = c.halfWidth(z);
          for (const side of [-1, 1]) {
            for (const e of [-hw, -2, 0, 3, lim * 0.5, lim, lim + 0.25]) {
              const x = c.centerX(z) + side * (hw + e);
              expect(plan.delta(x, z, c.ground(x, z)), `${z} ${side} ${e}`).toBe(0);
              if (e <= lim) expect(visualGround(c, x, z) - c.ground(x, z), `${z} ${side} ${e}`).toBe(0);
            }
          }
        }
      }
    });

    it(`${m.name}: keeps clear of every landmark in any mood`, () => {
      for (const p of list) {
        for (const s of looks.siteList()) {
          const a = s.z - s.len;
          const b = s.z + s.len;
          const keep = s.kind === 'start' ? 8 : 40;
          expect(b + keep <= p.z0 + 1e-6 || a - keep >= p.z1 - 1e-6, `${s.kind} at ${Math.round(s.z)} in ${Math.round(p.z0)}..${Math.round(p.z1)}`).toBe(true);
        }
      }
    });

    it(`${m.name}: the banks it shapes read past the limit, and the lip of an overlook gives way to them`, () => {
      for (const p of list) {
        const z = (p.z0 + p.z1) / 2;
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        const lim = c.shapeAt(z).limit;
        for (const b of p.banks) {
          if (segWeight(b, z) < 0.9) continue;
          const at = (e: number) => visualGround(c, cx + b.side * (hw + e), z) - c.ground(cx + b.side * (hw + lim), z);
          if (b.kind === 'wall') {
            expect(at(lim + 14), 'a wall stands').toBeGreaterThan(b.h * 0.5);
            expect(at(lim + 60) - (c.ground(cx + b.side * (hw + lim + 60), z) - c.ground(cx + b.side * (hw + lim), z)), 'and gives back').toBeCloseTo(0, 6);
          }
          if (b.kind === 'fall') {
            expect(at(lim + 20), 'a fall falls').toBeLessThan(-8);
            expect(at(110), 'on to the valley').toBeLessThan(-100);
            expect(looks.drop(z, b.side, 40), 'the lip gives way').toBe(0);
            expect(looks.wide(z, b.side), 'the far side opens').toBeGreaterThan(0.9);
          }
          if (b.kind === 'steps') expect(at(lim + 40)).toBeLessThan(-8);
          if (b.kind === 'rise') expect(at(lim + 40)).toBeGreaterThan(8);
        }
      }
    });

    it(`${m.name}: is planned the same every time`, () => {
      const again = planFor(courseFor(m.seed)).plan.planned;
      expect(JSON.stringify(again)).toBe(JSON.stringify(list));
    });
  }

  it('gives each mountain a look of its own', () => {
    const opening = (b: string) => [...looksSeen].find((k) => k.startsWith(b + ':'));
    const firsts = NAMED.map((m) => planFor(courseFor(m.seed)).plan.planned[0].look);
    expect(new Set(firsts).size).toBe(5);
    expect(opening('alpine')).toBeDefined();
  });

  it('plans a Daily mountain without fault, inside its course', () => {
    for (let d = 1; d <= 12; d++) {
      const c = courseFor(dailySeed('2026-' + String(d).padStart(2, '0') + '-1' + (d % 9)));
      const { plan } = planFor(c);
      for (const p of plan.planned) {
        expect(p.z0).toBeGreaterThan(0);
        expect(p.z1).toBeLessThan(c.finishZ);
        expect(p.z1 - p.z0).toBeGreaterThanOrEqual(90);
      }
      shapeGround(c, null);
    }
  });

  it('draws nothing for a course nobody composes', () => {
    const c = courseFor(NAMED[0].seed);
    const z = 300;
    const x = c.centerX(z) + c.halfWidth(z) + 30;
    expect(visualGround(c, x, z)).toBe(c.ground(x, z));
  });
});

describe('what frames them', () => {
  for (const m of NAMED) {
    it(`${m.name}: stands its pieces past the limit, a bough over it at most (or high over the run), within a draw's budget`, () => {
      const c = courseFor(m.seed);
      const { plan } = planFor(c);
      const pal = getPalette(c.biome, 0);
      for (let n = 0; n < plan.planned.length; n++) {
        const g = framingGeometry(c, plan, n, pal);
        if (!g) continue;
        const pos = g.getAttribute('position');
        expect(pos.count / 3, 'triangles').toBeLessThan(8000);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = -pos.getZ(i);
          const e = Math.abs(x - c.centerX(z)) - c.halfWidth(z);
          const over = pos.getY(i) - c.ground(x, z);
          if (e < c.shapeAt(z).limit - 1) expect(over, `a piece over the run at ${Math.round(z)}`).toBeGreaterThan(24);
        }
      }
      shapeGround(c, null);
    });
  }
});

describe('the profiles', () => {
  it('rolls a fall over a cornice and steepens it to the mid-ground\'s own slope', () => {
    expect(fallProf(0)).toBe(0);
    expect(fallProf(2.5)).toBeGreaterThan(0.4);
    let last = Infinity;
    for (let t = 3; t < 200; t += 1) {
      const s = fallProf(t) - fallProf(t + 1);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThanOrEqual(1.8 + 1e-9);
      expect(fallProf(t)).toBeLessThan(last);
      last = fallProf(t);
    }
  });

  it('steps terraces in flats and risers, down and up', () => {
    // A flat is level, a riser four metres.
    expect(stepsProf(5, 1)).toBeCloseTo(stepsProf(9, 1), 6);
    expect(stepsProf(3 + 10.4 * 2 + 2, 1) - stepsProf(3 + 10.4 * 3 + 2, 1)).toBeCloseTo(4, 6);
    expect(stepsProf(40, -1)).toBeCloseTo(-stepsProf(40, 1), 6);
  });

  it('stands a wall up within ten metres and breaks its crest', () => {
    expect(wallProf(0.3, 30, 300, 1)).toBe(0);
    const tops = [0, 9, 18, 27, 36].map((z) => wallProf(14, 30, 300 + z, 1));
    for (const h of tops) expect(h).toBeGreaterThan(15);
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(2);
  });
});

describe('the lens by place', () => {
  const want = { up: LOOKS.valley.up, back: LOOKS.valley.back, aside: LOOKS.valley.aside, yaw: LOOKS.valley.yaw, horizon: LOOKS.valley.horizon, row: LOOKS.valley.row };

  it('eases toward a place and back, never jumping', () => {
    const p = new CamPlacer();
    p.step(want, 1 / 60, true, false, false);
    expect(p.now.up).toBeGreaterThan(0);
    expect(p.now.up).toBeLessThan(want.up * 0.05);
    for (let i = 0; i < 600; i++) p.step(want, 1 / 60, true, false, false);
    expect(p.now.up).toBeCloseTo(want.up, 3);
    expect(p.now.yaw).toBeCloseTo(want.yaw, 3);
    for (let i = 0; i < 600; i++) p.step(null, 1 / 60, true, false, false);
    expect(Math.abs(p.now.up)).toBeLessThan(1e-3);
  });

  it('takes half on a phone, keeps the framing under reduced motion (slower), and lets go outside the chase', () => {
    const tall = new CamPlacer();
    const calm = new CamPlacer();
    const off = new CamPlacer();
    for (let i = 0; i < 60; i++) calm.step(want, 1 / 60, true, false, true);
    const fast = new CamPlacer();
    for (let i = 0; i < 60; i++) fast.step(want, 1 / 60, true, false, false);
    expect(calm.now.up).toBeGreaterThan(0);
    expect(calm.now.up).toBeLessThan(fast.now.up);
    for (let i = 0; i < 900; i++) {
      tall.step(want, 1 / 60, true, true, false);
      off.step(want, 1 / 60, false, false, false);
    }
    expect(tall.now.up).toBeCloseTo(want.up / 2, 3);
    expect(off.now.up).toBe(0);
  });

  it('places the lens by the composed place, at its weight, and nowhere else', () => {
    const c = courseFor(NAMED[0].seed);
    const { plan } = planFor(c);
    const out = { up: 0, back: 0, aside: 0, yaw: 0, horizon: 0, row: 0 };
    const p0 = plan.planned[0];
    plan.place((p0.z0 + p0.z1) / 2, out);
    expect(out.up).toBeCloseTo(LOOKS[p0.look].up, 6);
    expect(Math.sign(out.yaw)).toBe(p0.open);
    plan.place(p0.z0 - 5, out);
    expect(out.up).toBe(0);
    plan.place(1000, out);
    expect(out.up).toBe(0);
    shapeGround(c, null);
  });
});
