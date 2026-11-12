import { Color, Vector3 } from 'three';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Breaks } from '../src/render/breaks';
import { Fireworks, FW_MARIGOLD, FW_VERMILLION } from '../src/render/fireworks';
import { BUDGET, fx, setFxBudget } from '../src/render/fxhub';
import { beginLocalLights, localLights, MAX_LOCAL_LIGHTS } from '../src/render/lights';
import { Particles, Weather } from '../src/render/particles';
import { TreeLife, wind } from '../src/render/treelife';
import type { Course } from '../src/sim/course';

// Round 7's effects are pooled and gated by tier: nothing is spawned past a tier's budget, nothing is
// drawn while nothing plays, Low's budgets are never above the tiers over it, and reduced motion stills
// what moves. (No renderer: these are the pools and their rules.)

const course = { ground: () => 0, biome: 'alpine', section: () => ({ kind: 'cruise' }), centerX: () => 0, halfWidth: () => 8, shapeAt: () => ({ limit: 6 }) } as unknown as Course;
const TIERS = [0.45, 0.75, 1] as const;

beforeEach(() => {
  fx.reduced = false;
});
afterAll(() => {
  setFxBudget(1);
  fx.reduced = false;
  fx.trees = null;
});

describe('budgets by tier', () => {
  it('names the tier from its particle budget', () => {
    expect(TIERS.map((b) => (setFxBudget(b), fx.tier))).toEqual([0, 1, 2]);
    setFxBudget(1.3);
    expect(fx.tier).toBe(3);
  });

  it('Low never has more than the tiers above it', () => {
    for (const k of ['rutSamples', 'rutFar', 'rutCoarse', 'shards', 'shivers', 'streaks', 'showLights'] as const) {
      const v = BUDGET[k];
      for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
    }
  });
});

describe('what breaks', () => {
  for (const b of TIERS) {
    it(`budget ${b}: pieces never pass the tier's pool, and nothing is drawn once they are gone`, () => {
      setFxBudget(b);
      const br = new Breaks(new Particles(1800));
      br.setCourse(course);
      expect(br.mesh.visible).toBe(false);
      for (let i = 0; i < 40; i++) br.shatter(i % 2 ? 'snowman' : 'ice', i, 1, -i, null, 1.5);
      br.update(1 / 60, 0, 30, true);
      expect(br.pieces).toBeGreaterThan(0);
      expect(br.pieces).toBeLessThanOrEqual(BUDGET.shards[fx.tier]);
      expect(br.mesh.count).toBeLessThanOrEqual(BUDGET.shards[fx.tier]);
      for (let t = 0; t < 180; t++) br.update(1 / 60, 0, 30, true);
      expect(br.pieces).toBe(0);
      expect(br.mesh.visible).toBe(false);
    });
  }

  it('icicles fall only in a gully, and never on Low or under reduced motion', () => {
    const gully = { ...course, section: () => ({ kind: 'gully' }) } as unknown as Course;
    const drops = (budget: number, c: Course, reduced: boolean) => {
      setFxBudget(budget);
      fx.reduced = reduced;
      const br = new Breaks(new Particles(1800));
      br.setCourse(c);
      for (let t = 0; t < 120; t++) br.update(1 / 60, t, 30, true);
      return br.count;
    };
    expect(drops(1, gully, false)).toBeGreaterThan(2);
    expect(drops(1, course, false)).toBe(0);
    expect(drops(0.45, gully, false)).toBe(0);
    expect(drops(1, gully, true)).toBe(0);
  });
});

describe('fireworks', () => {
  for (const b of TIERS) {
    it(`budget ${b}: a win's whole show stays inside the tier's streaks and its lights`, () => {
      setFxBudget(b);
      const fw = new Fireworks();
      fw.setQuality(b, b > 0.6);
      let most = 0;
      let lights = 0;
      // Nineteen shells in six seconds (the show and its finale), stepped at 60 Hz.
      for (let t = 0; t < 60 * 10; t++) {
        if (t < 360 && t % 19 === 0) fw.shell(new Vector3(0, 0, 0), new Vector3(t % 7, 40, -60), 0.9, FW_VERMILLION, FW_MARIGOLD);
        beginLocalLights(0, 0, 0);
        fw.update(1 / 60);
        most = Math.max(most, fw.mesh.count);
        lights = Math.max(lights, localLights.pushed);
      }
      expect(most).toBeGreaterThan(100);
      // (The pool is the sparks; the heads of the few shells still climbing are drawn on top of it.)
      expect(most).toBeLessThanOrEqual(BUDGET.streaks[fx.tier] + 6);
      expect(lights).toBeGreaterThan(0);
      expect(lights).toBeLessThanOrEqual(BUDGET.showLights[fx.tier]);
      expect(lights).toBeLessThanOrEqual(MAX_LOCAL_LIGHTS);
      // The show over, nothing is drawn and nothing lights the snow.
      expect(fw.busy).toBe(false);
      expect(fw.mesh.visible).toBe(false);
      expect(fw.litBursts).toBe(0);
    });
  }
});

describe('trees', () => {
  it('a tree shakes on Medium and High only, and reduced motion stills the wind', () => {
    const tl = new TreeLife(new Particles(1800));
    tl.setCourse(course);
    setFxBudget(0.45);
    tl.shiver(3, 40, 1);
    expect(wind.uShiver.value.every((v) => v.w === 0)).toBe(true);
    setFxBudget(1);
    tl.shiver(3, 40, 1);
    expect(wind.uShiver.value.filter((v) => v.w > 0).length).toBe(1);
    // Never more than four at once: a fifth takes the oldest slot.
    for (let i = 0; i < 9; i++) tl.shiver(i, 40, 1);
    expect(wind.uShiver.value.length).toBe(BUDGET.shivers[2]);
    fx.reduced = true;
    for (let t = 0; t < 120; t++) tl.update(1 / 60, 'run', { x: 0, y: 0, z: 0, speed: 30, crashed: false } as never, new Map());
    expect(wind.uWindK.value).toBeLessThan(0.01);
    tl.reset();
    expect(wind.uShiver.value.every((v) => v.w === 0)).toBe(true);
  });

  it('sheds once a tree, for the rider', () => {
    setFxBudget(1);
    const tl = new TreeLife(new Particles(1800));
    tl.setCourse(course);
    fx.trees = {
      treesNear: (_x, z, _r, _ahead, out) => {
        out[0] = Math.floor(z / 10);
        out[1] = 2;
        out[2] = z;
        return 1;
      },
    };
    for (let t = 0; t < 60; t++) tl.update(1 / 60, 'run', { x: 0, y: 0, z: 100 + t * 0.5, speed: 30, crashed: false } as never, new Map());
    // Thirty metres ridden past trees keyed every ten: three or four sheds, not sixty.
    expect(tl.shed).toBeGreaterThanOrEqual(3);
    expect(tl.shed).toBeLessThanOrEqual(4);
  });
});

describe('weather', () => {
  it('falls in three layers on every tier, and Low keeps a far layer', () => {
    const w = new Weather(900);
    w.configure({ density: 0.3, kind: 0, color: new Color(1, 1, 1), streak: 0, size: 0.08, alpha: 0.85, fall: new Vector3(0.5, -1.6, 0.4), additive: false });
    for (const b of TIERS) {
      setFxBudget(b);
      w.follow(new Vector3());
      const [near, body, far] = w.layers;
      expect(near).toBeGreaterThan(0.04);
      expect(body).toBeGreaterThan(0.5);
      expect(far).toBeGreaterThan(0.15);
      expect(near + body + far).toBeCloseTo(1, 6);
    }
    expect(w.points.visible).toBe(true);
    w.configure({ density: 0, kind: 0, color: new Color(1, 1, 1), streak: 0, size: 0.08, alpha: 0.85, fall: new Vector3(0.5, -1.6, 0.4), additive: false });
    expect(w.points.visible).toBe(false);
  });
});
