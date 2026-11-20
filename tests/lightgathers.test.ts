import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { Mood } from '../src/sim/chaos';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { LIGHT_GLSL, applyPalette, setCloudShadows, shared } from '../src/render/materials';
import { getPalette, journeyPalette } from '../src/render/palette';

// Round 8, the light lane (V5, "light that gathers"): the value pass and the air that takes a lamp's light. Ember's snow is
// lit from the lava's side with a cold far bank; the haze of a lamp's colour is drawn only where a palette asks for it,
// and never on Low. (Lanternfall's darker night went back to round 7's after three blind critics: notes/r8-light.md.)

const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const CHAOS = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];
const course = (id: string) => courseFor(MOUNTAINS.find((m) => m.id === id)!.seed);

describe('light that gathers', () => {
  it('lights Ember from the lava\'s side: the key low and further round than the dim disc, above the slope', () => {
    for (const z of [0, 900, 2000, 3000]) {
      const p = journeyPalette('volcanic', z, getPalette('volcanic', Mood.None));
      const keyAz = (Math.atan2(p.sunDir.x, -p.sunDir.z) * 180) / Math.PI;
      const discAz = (Math.atan2(p.diskDir.x, -p.diskDir.z) * 180) / Math.PI;
      expect(keyAz - discAz, `at ${z} m`).toBeGreaterThan(15);
      expect((Math.asin(p.sunDir.y) * 180) / Math.PI, `at ${z} m`).toBeGreaterThanOrEqual(17);
      // The shade a cold one, and a step under the lit snow, never a dark slab (the first critic's worst fault).
      expect(p.snowShade.b, `at ${z} m`).toBeGreaterThan(p.snowShade.r);
      expect(lum(p.snowShade), `at ${z} m`).toBeGreaterThan(lum(p.snowLit) * 0.12);
    }
  });

  it('keeps the chaos moods as they were: no lamp haze', () => {
    for (const b of ['alpine', 'glacier', 'volcanic', 'blossom', 'lantern'] as const) {
      for (const m of CHAOS) {
        const p = getPalette(b, m);
        expect(p.lampAir, `${b} mood ${m}`).toBe(0);
      }
    }
  });

  it('draws the lamps\' haze from the lights the props take, so Low (which gives the props none) draws none', () => {
    expect(LIGHT_GLSL).toContain('vec3 lampAir(');
    expect(LIGHT_GLSL).toMatch(/float\(i\) >= uLocalProps/);
    expect(LIGHT_GLSL).toMatch(/fogColor\(dir, d\), f\) \+ lampAir\(dir, d\)/);
    const p = journeyPalette('volcanic', 3500, getPalette('volcanic', Mood.None), course('ember'));
    setCloudShadows(true);
    applyPalette(p);
    expect(shared.uLampAir.value).toBeCloseTo(p.lampAir, 6);
    setCloudShadows(false);
    applyPalette(p);
    expect(shared.uLocalProps.value).toBe(0);
    setCloudShadows(true);
  });
});
