import { describe, expect, it } from 'vitest';
import { Color, PerspectiveCamera, Vector3 } from 'three';
import { Mood } from '../src/sim/chaos';
import { BiomeId } from '../src/sim/mountains';
import { JOURNEY, getPalette, journeyPalette } from '../src/render/palette';
import { applyPalette, setCloudShadows, shared } from '../src/render/materials';
import { AOPass, aoComposite } from '../src/render/postfx/ao';
import type { Quad } from '../src/render/postfx/quad';

// The visual lift's light (the light lane, DECISIONS 361): the snow's bounce, the sky's fill, light through
// what is thin, the snow's sheen and the crease light. Neutral wherever a palette does not ask for it (the
// chaos moods keep round 7's light), never a signal colour and never more than the snow it comes off, none
// of it drawn on Low but a bounce carried in a constant Low already draws with, and the crease light only
// near the lens and never on the rider.

const BIOMES: BiomeId[] = ['alpine', 'glacier', 'volcanic', 'blossom', 'lantern'];
const CHAOS = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];
const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
/** The hue of a colour at full value, so two lights of the same colour and different strength compare. */
const hue = (c: Color) => {
  const m = Math.max(c.r, c.g, c.b, 1e-6);
  return new Color(c.r / m, c.g / m, c.b / m);
};
const dist = (a: Color, b: Color) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
const marks = (b: BiomeId) => [0, ...JOURNEY[b].flatMap((s) => [s.from, (s.from + s.at) / 2, s.at]), 9000];

describe('the lift in the palettes', () => {
  it('leaves every chaos mood as round 7 drew it', () => {
    for (const b of BIOMES) {
      for (const m of CHAOS) {
        const L = getPalette(b, m).lift;
        expect([L.bounce, L.sky, L.through, L.sheen], `${b} mood ${m}`).toEqual([0, 0, 0, 0]);
      }
    }
  });

  it('lifts every mountain all the way down its run, inside sane bounds', () => {
    for (const b of BIOMES) {
      for (const at of marks(b)) {
        const L = journeyPalette(b, at, getPalette(b, Mood.None)).lift;
        for (const [k, v] of Object.entries({ bounce: L.bounce, sky: L.sky, through: L.through, sheen: L.sheen })) {
          expect(v, `${b} ${k} at ${at} m`).toBeGreaterThanOrEqual(0);
          expect(v, `${b} ${k} at ${at} m`).toBeLessThanOrEqual(1.4);
        }
        expect(L.sun, `${b} sun share at ${at} m`).toBeGreaterThanOrEqual(0);
        expect(L.sun, `${b} sun share at ${at} m`).toBeLessThanOrEqual(1);
        expect(L.bounce + L.sky, `${b} at ${at} m`).toBeGreaterThan(0);
      }
    }
  });

  it('bounces the snow, never in a ghost colour and never more light than the lit snow', () => {
    setCloudShadows(true);
    const ghosts = ['#8FF3E4', '#FF5A7A'].map((h) => hue(new Color(h)));
    for (const b of BIOMES) {
      for (const at of marks(b)) {
        const p = journeyPalette(b, at, getPalette(b, Mood.None));
        applyPalette(p);
        const bounce = shared.uBounce.value;
        expect(lum(bounce), `${b} at ${at} m`).toBeGreaterThan(0);
        expect(lum(bounce), `${b} at ${at} m`).toBeLessThanOrEqual(lum(p.snowLit) + 1e-6);
        // The ghosts' mint and rose stay theirs. (A light may be warm: Ember's lava is orange, Lanternfall's lamps
        // marigold, and what the bounce lands on keeps its own colour, the coat its navy.)
        for (const g of ghosts) expect(dist(hue(bounce), g), `${b} at ${at} m`).toBeGreaterThan(0.25);
      }
    }
  });
});

describe('the lift by tier', () => {
  it('draws every term on Medium and up, and none on Low, whose bounce rides in the light from below', () => {
    const p = getPalette('alpine', Mood.None);
    setCloudShadows(true);
    applyPalette(p);
    const k = shared.uLiftK.value;
    expect([k.x, k.y, k.z, k.w]).toEqual([p.lift.bounce, p.lift.sky, p.lift.through, p.lift.sheen]);
    expect(shared.uUnder.value.w).toBeCloseTo(p.under.k, 6);
    setCloudShadows(false);
    applyPalette(p);
    expect([k.x, k.y, k.z, k.w]).toEqual([0, 0, 0, 0]);
    // (Pinecrest has no lava: what Low draws from below is the bounce alone, and it is a light, not nothing.)
    expect(shared.uUnder.value.w).toBeGreaterThan(p.under.k + 0.05);
    // Back up: the tier's own share again, and the light from below the palette's.
    setCloudShadows(true);
    expect([k.x, k.y, k.z, k.w]).toEqual([p.lift.bounce, p.lift.sky, p.lift.through, p.lift.sheen]);
    expect(shared.uUnder.value.w).toBeCloseTo(p.under.k, 6);
  });

  it('adds Ember\'s lava and Low\'s bounce together without losing either', () => {
    const p = getPalette('volcanic', Mood.None);
    setCloudShadows(false);
    applyPalette(p);
    const u = shared.uUnder.value;
    // The lava's own orange still leads: red over blue, and the sum over the lava alone.
    expect(u.x).toBeGreaterThan(u.z);
    expect(u.w).toBeGreaterThan(p.under.k);
    setCloudShadows(true);
  });
});

describe('the crease light', () => {
  const quad = { compile: () => {}, draw: () => {} } as unknown as Quad;
  const camera = new PerspectiveCamera(60, 16 / 9, 0.3, 5200);
  camera.updateMatrixWorld();

  it('reaches only the near frame, takes the key light, and keeps off the rider', () => {
    const ao = new AOPass(quad);
    applyPalette(getPalette('alpine', Mood.None));
    shared.uFocus.value.set(0.4, -1, -6);
    ao.render(camera, new Vector3(0.3, 0.8, -0.5).normalize(), false);
    const c = aoComposite.uCrease.value;
    expect(c.x).toBeGreaterThan(0);
    expect(c.y).toBeGreaterThan(0);
    expect(c.w).toBeLessThanOrEqual(60);
    expect(c.z).toBeLessThan(c.w);
    // The key's hue at full value, toward white.
    expect(Math.max(aoComposite.uCreaseC.value.x, aoComposite.uCreaseC.value.y, aoComposite.uCreaseC.value.z)).toBeCloseTo(1, 5);
    // The rider's middle in view space (the lens at the origin looking down -z), with a reach round it.
    const h = aoComposite.uCreaseHero.value;
    expect([h.x, h.y, h.z]).toEqual([0.4, -1, -6]);
    expect(h.w).toBeGreaterThan(1);
    // A thick fog draws it in with the occlusion.
    const near = shared.uFogFar.value;
    shared.uFogFar.value = 140;
    ao.render(camera, new Vector3(0, 1, 0), false);
    expect(aoComposite.uCrease.value.w).toBeLessThan(45);
    shared.uFogFar.value = near;
    // Off with the pass, and off when asked.
    ao.rest();
    expect([c.x, c.y]).toEqual([0, 0]);
    ao.crease = 0;
    ao.render(camera, new Vector3(0, 1, 0), false);
    expect([c.x, c.y]).toEqual([0, 0]);
    ao.dispose();
  });
});
