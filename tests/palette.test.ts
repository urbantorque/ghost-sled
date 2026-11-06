import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { Mood } from '../src/sim/chaos';
import { BiomeId } from '../src/sim/mountains';
import { JOURNEY, Palette, getPalette, journeyDusk, journeyPalette, journeyProgress } from '../src/render/palette';

const BIOMES: BiomeId[] = ['alpine', 'glacier', 'volcanic', 'blossom'];
const CHAOS = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];

const dist = (a: Color, b: Color) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
const bearing = (p: Palette) => (Math.atan2(p.diskDir.x, -p.diskDir.z) * 180) / Math.PI;
const elevation = (d: { y: number }) => (Math.asin(d.y) * 180) / Math.PI;
/** Every metre that matters on a mountain: the start, each stop's two ends and past the last. */
const marks = (b: BiomeId) => [0, ...JOURNEY[b].flatMap((s) => [s.from, (s.from + s.at) / 2, s.at]), 9000];

describe('Clear Skies per mountain', () => {
  it('gives each mountain its own sky, sun and hero side', () => {
    const ps = BIOMES.map((b) => getPalette(b, Mood.None));
    // No two mountains share a frame at the start: the sky, the air and the snow, taken together.
    const look = (p: Palette) => [p.skyZenith, p.skyHorizon, p.fog, p.snowLit, p.snowShade];
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = look(ps[i]);
        const b = look(ps[j]);
        const d = a.reduce((sum, col, k) => sum + dist(col, b[k]), 0);
        expect(d, `${BIOMES[i]} and ${BIOMES[j]}`).toBeGreaterThan(1.5);
      }
    }
    // The sun is never dead centre, and the bearings are all different.
    const az = ps.map(bearing);
    for (const a of az) expect(Math.abs(a)).toBeGreaterThan(15);
    expect(new Set(az.map((a) => Math.round(a / 5))).size).toBe(4);
    // Pinecrest is the high sun, Frostfang the low one.
    expect(elevation(ps[0].sunDir)).toBeGreaterThan(40);
    expect(elevation(ps[1].diskDir)).toBeLessThan(7);
  });

  it('keeps a hazard darker than the lit snow, on every mountain and all the way down', () => {
    for (const b of BIOMES) {
      const baked = getPalette(b, Mood.None);
      for (const m of marks(b)) {
        const p = journeyPalette(b, m, getPalette(b, Mood.None));
        // Props bake tall and low at the start; the late light only reaches them through the shared
        // uniforms, so it is the baked colours, dimmed, that must stay under the live snow.
        expect(lum(baked.low) * p.hazardDim, `${b} rock at ${m} m`).toBeLessThan(lum(p.snowLit) * 0.6);
        expect(lum(baked.tall) * p.hazardDim, `${b} trees at ${m} m`).toBeLessThan(lum(p.snowLit));
      }
    }
  });

  it('never lets the sky or the air take a signal colour', () => {
    const mint = new Color('#8FF3E4');
    for (const b of BIOMES) {
      for (const m of marks(b)) {
        const p = journeyPalette(b, m, getPalette(b, Mood.None));
        // The ghosts' mint stays theirs: no sky colour comes close to it (linear distance).
        for (const col of [p.skyZenith, p.skyMid as Color, p.skyHorizon]) expect(dist(col, mint), `${b} sky at ${m} m`).toBeGreaterThan(0.25);
      }
    }
  });

  it('holds the key light above the slope at every stop (decision 27)', () => {
    for (const b of BIOMES) {
      for (const m of marks(b)) {
        const p = journeyPalette(b, m, getPalette(b, Mood.None));
        expect(elevation(p.sunDir), `${b} at ${m} m`).toBeGreaterThanOrEqual(17);
        expect(elevation(p.diskDir), `${b} at ${m} m`).toBeGreaterThanOrEqual(2.9);
      }
    }
  });

  it('never strobes: a Clear Skies volcano stays under the lava level that wakes the lightning', () => {
    for (const m of marks('volcanic')) expect(journeyPalette('volcanic', m, getPalette('volcanic', Mood.None)).massif.lava).toBeLessThan(0.75);
  });

  it('keeps the hero on one side of the frame all run, whatever the sun does', () => {
    for (const b of BIOMES) {
      const start = getPalette(b, Mood.None).massif.heroAz;
      expect(start).not.toBe(0);
      for (const m of marks(b)) expect(journeyPalette(b, m, getPalette(b, Mood.None)).massif.heroAz).toBe(start);
    }
  });
});

describe('The journey table', () => {
  it('runs in order, in metres, with no overlap', () => {
    for (const b of BIOMES) {
      let last = 0;
      for (const s of JOURNEY[b]) {
        expect(s.from).toBeGreaterThanOrEqual(last);
        expect(s.at).toBeGreaterThan(s.from);
        last = s.at;
      }
    }
  });

  it('starts at the title light and ends on the last stop', () => {
    for (const b of BIOMES) {
      const start = getPalette(b, Mood.None);
      const p = journeyPalette(b, 0, getPalette(b, Mood.None));
      expect(p.skyZenith.getHex()).toBe(start.skyZenith.getHex());
      expect(p.snowLit.getHex()).toBe(start.snowLit.getHex());
      expect(journeyProgress(b, 0)).toBe(0);
      expect(journeyProgress(b, 1e6)).toBe(JOURNEY[b].length);
      expect(journeyPalette(b, 1e6, getPalette(b, Mood.None)).skyZenith.getHex()).toBe(journeyPalette(b, JOURNEY[b][JOURNEY[b].length - 1].at, getPalette(b, Mood.None)).skyZenith.getHex());
    }
  });

  it('moves smoothly: no step between neighbouring metres', () => {
    for (const b of BIOMES) {
      let prev = journeyPalette(b, 0, getPalette(b, Mood.None)).skyZenith.clone();
      for (let m = 5; m <= 4200; m += 5) {
        const z = journeyPalette(b, m, getPalette(b, Mood.None)).skyZenith;
        expect(Math.hypot(z.r - prev.r, z.g - prev.g, z.b - prev.b), `${b} at ${m} m`).toBeLessThan(0.01);
        prev.copy(z);
      }
    }
  });

  it('holds still between stops, so the world re-blends only while the light moves', () => {
    for (const b of BIOMES) {
      const stops = JOURNEY[b];
      for (let i = 0; i + 1 < stops.length; i++) {
        const gap = stops[i + 1].from - stops[i].at;
        if (gap <= 0) continue;
        expect(journeyProgress(b, stops[i].at + gap * 0.25)).toBe(journeyProgress(b, stops[i].at + gap * 0.75));
      }
    }
  });

  it('gives the soundscape a dusk in range that only ever rises', () => {
    for (const b of BIOMES) {
      let prev = 0;
      for (let m = 0; m <= 5000; m += 25) {
        const d = journeyDusk(b, m);
        expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
        expect(d).toBeLessThanOrEqual(1);
        prev = d;
      }
    }
  });
});

describe('The chaos moods', () => {
  it('see nothing of Clear Skies', () => {
    for (const b of BIOMES) {
      for (const m of CHAOS) {
        const p = getPalette(b, m);
        expect(p.deck.k).toBe(0);
        expect(p.massif.flow).toBe(0);
        expect(p.massif.heroAz).toBe(0);
        expect(p.sunTint).toBe(0.2);
        expect(p.skyBand.color).toBeNull();
        expect(p.sunCore.r).toBeCloseTo(2.3, 5);
      }
    }
  });

  it('keep their own sun: the disc is where the mood put it, the key light lifted from it', () => {
    for (const b of BIOMES) {
      for (const m of CHAOS) {
        const p = getPalette(b, m);
        expect(elevation(p.sunDir)).toBeGreaterThanOrEqual(elevation(p.diskDir) - 1e-6);
        expect(elevation(p.sunDir)).toBeGreaterThanOrEqual(p.lightMin - 1e-6);
      }
    }
  });
});
