import { afterAll, describe, expect, it } from 'vitest';
import { Color } from 'three';
import { Mood } from '../src/sim/chaos';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { ALT_HOURS, JOURNEY, type Palette, getPalette, hourOf, journeyDusk, journeyOf, journeyPalette, journeyStamp, setHour } from '../src/render/palette';

// Round 8, the light lane: a mountain's other hour (palette.ts ALT_HOURS, the Almanac's hourOpen). It is a second
// Clear Skies with its own journey, held to every rule the day is (palette.test.ts), and it changes nothing until
// it is picked.

const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const dist = (a: Color, b: Color) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
const elevation = (d: { y: number }) => (Math.asin(d.y) * 180) / Math.PI;
const mint = new Color('#8FF3E4');

afterAll(() => setHour('day'));

describe('the other hours', () => {
  it('exist for at least two mountains, and change nothing until picked', () => {
    const ids = Object.keys(ALT_HOURS);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    setHour('day');
    for (const b of ids as Array<keyof typeof ALT_HOURS>) {
      expect(hourOf(b)).toBe('day');
      expect(journeyOf(b)).toBe(JOURNEY[b]);
    }
    // A mountain with no other hour keeps its day when one is picked.
    setHour('alt');
    expect(hourOf('lantern')).toBe(ALT_HOURS.lantern ? 'alt' : 'day');
    setHour('day');
  });

  it('give the picked mountain a different first light and a journey of its own', () => {
    for (const b of Object.keys(ALT_HOURS) as Array<keyof typeof ALT_HOURS>) {
      setHour('day');
      const day = getPalette(b, Mood.None);
      setHour('alt');
      const alt = getPalette(b, Mood.None);
      const d = dist(day.skyZenith, alt.skyZenith) + dist(day.skyHorizon, alt.skyHorizon) + dist(day.snowLit, alt.snowLit);
      expect(d, b).toBeGreaterThan(0.3);
      expect(journeyOf(b)).toBe(ALT_HOURS[b]!.journey);
      // The stamp knows the hour, so a world that changes hour re-blends.
      setHour('day');
      const s0 = journeyStamp(b, 100);
      setHour('alt');
      expect(journeyStamp(b, 100)).not.toBe(s0);
    }
    setHour('day');
  });

  it('holds the day rules all the way down: the key above the slope, hazards dark, the sky clear of mint, smooth, a dusk that only rises', () => {
    setHour('alt');
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const b = c.biome;
      if (!ALT_HOURS[b]) continue;
      const baked = getPalette(b, Mood.None);
      let prev: Palette | null = null;
      let dusk = 0;
      for (let z = 0; z <= 4600; z += 10) {
        const p = journeyPalette(b, z, getPalette(b, Mood.None), c);
        expect(elevation(p.sunDir), `${b} at ${z} m`).toBeGreaterThanOrEqual(17);
        expect(elevation(p.diskDir), `${b} at ${z} m`).toBeGreaterThanOrEqual(2.9);
        expect(lum(baked.low) * p.hazardDim, `${b} rock at ${z} m`).toBeLessThan(lum(p.snowLit) * 0.6);
        expect(lum(baked.tall) * p.hazardDim, `${b} trees at ${z} m`).toBeLessThan(lum(p.snowLit));
        for (const col of [p.skyZenith, p.skyMid as Color, p.skyHorizon]) expect(dist(col, mint), `${b} sky at ${z} m`).toBeGreaterThan(0.25);
        expect(p.grade.exposure).toBeGreaterThan(0.85);
        expect(p.grade.exposure).toBeLessThan(1.25);
        if (prev) expect(dist(p.skyZenith, prev.skyZenith) + dist(p.snowLit, prev.snowLit), `${b} at ${z} m`).toBeLessThan(0.2);
        prev = p;
        const dk = journeyDusk(b, z);
        expect(dk).toBeGreaterThanOrEqual(dusk - 1e-9);
        dusk = dk;
      }
    }
    setHour('day');
  });
});
