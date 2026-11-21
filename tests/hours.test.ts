import { afterAll, describe, expect, it } from 'vitest';
import { Color } from 'three';
import { Mood } from '../src/sim/chaos';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { readFileSync } from 'fs';
import { ALT_HOURS, JOURNEY, type Palette, getPalette, hourOf, hourSwatches, journeyDusk, journeyOf, journeyPalette, journeyStamp, setHour } from '../src/render/palette';
import { ALMANAC, HOUR_PHRASES, hourOpen, rewardName, xpToPage } from '../src/game/almanac';
import { SAVE_KEY, SaveStore, defaultSave, readHours } from '../src/game/save';

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
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const b = c.biome;
      if (!ALT_HOURS[b]) continue;
      // (Smooth as the day is: a roof's place closes over and lets go in under two seconds, so where the day itself
      // steps more than 0.2 in 10 m, at Frostfang's cavern, the hour may step as far again and a quarter.)
      setHour('day');
      const daySteps: number[] = [];
      let dprev: Palette | null = null;
      for (let z = 0; z <= 4600; z += 10) {
        const p = journeyPalette(b, z, getPalette(b, Mood.None), c);
        daySteps.push(dprev ? dist(p.skyZenith, dprev.skyZenith) + dist(p.snowLit, dprev.snowLit) : 0);
        dprev = p;
      }
      setHour('alt');
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
        if (prev) expect(dist(p.skyZenith, prev.skyZenith) + dist(p.snowLit, prev.snowLit), `${b} at ${z} m`).toBeLessThan(Math.max(0.2, daySteps[z / 10] * 1.25));
        prev = p;
        const dk = journeyDusk(b, z);
        expect(dk).toBeGreaterThanOrEqual(dusk - 1e-9);
        dusk = dk;
      }
    }
    setHour('day');
  });
});

// Round 8, the hours lane: an hour for every mountain the Almanac promises one on, named the same on its card and the
// title, Lanternfall's pools as a lift of its own lilac toward silver, and the pick remembered per mountain in the save.

const hue = (c: Color): number => {
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return hsl.h * 360;
};

describe('the hours lane', () => {
  it('gives every mountain whose Almanac page promises an hour one, its card naming it as the palette does', () => {
    const pages = ALMANAC.flatMap((pg) => pg.rewards).filter((r) => r.kind === 'hour');
    expect(pages.length).toBe(5);
    for (const r of pages) {
      if (r.kind !== 'hour') continue;
      const m = MOUNTAINS.find((x) => x.id === r.mountain)!;
      const alt = ALT_HOURS[courseFor(m.seed).biome];
      expect(alt, r.mountain).toBeDefined();
      expect(HOUR_PHRASES[r.mountain]).toBe(alt!.phrase);
      expect(rewardName(r).endsWith(` ${alt!.phrase}`), rewardName(r)).toBe(true);
      expect(m.name.startsWith(rewardName(r).slice(0, -alt!.phrase.length - 1))).toBe(true);
    }
    expect(rewardName({ kind: 'hour', mountain: 'ember' })).toBe('Ember Peak at Night');
  });

  it('paints a swatch of each hour that differs from the day', () => {
    for (const b of Object.keys(ALT_HOURS) as Array<keyof typeof ALT_HOURS>) {
      const sw = hourSwatches(b);
      for (const x of [...sw.day, ...sw.alt]) expect(x).toMatch(/^#[0-9a-f]{6}$/);
      expect(sw.alt.join()).not.toBe(sw.day.join());
    }
    // (Building them leaves the hour in force alone.)
    setHour('day');
    hourSwatches('volcanic');
    expect(hourOf('volcanic')).toBe('day');
  });

  it("keeps Lanternfall's other hour lilac and silver, never a gold floor, and Ember's a night under a lit deck", () => {
    setHour('alt');
    const lf = courseFor(MOUNTAINS.find((m) => m.id === 'lanternfall')!.seed);
    for (let z = 0; z <= 4600; z += 50) {
      const p = journeyPalette('lantern', z, getPalette('lantern', Mood.None), lf);
      // The lit snow is a cool silver-lilac (its blue at least its red), the shade violet.
      expect(p.snowLit.b, `lit at ${z} m`).toBeGreaterThanOrEqual(p.snowLit.r);
      const hs = hue(p.snowShade);
      expect(hs > 225 && hs < 290, `shade hue ${hs.toFixed(0)} at ${z} m`).toBe(true);
      // The key light never goes gold: its blue stays near its red.
      expect(p.sunColor.b / Math.max(p.sunColor.r, 1e-4), `key at ${z} m`).toBeGreaterThan(0.7);
      expect(p.poolSilver.k).toBeGreaterThan(0.5);
    }
    const em = getPalette('volcanic', Mood.None);
    expect(lum(em.skyZenith)).toBeLessThan(0.01);
    expect(em.deck.k).toBe(1);
    expect(em.sunDisc).toBe(0);
    // (Under the 0.75 that wakes a night mood's lightning: a plain run never flashes, ART.md 2.)
    expect(em.massif.lava).toBeLessThan(0.75);
    expect(journeyDusk('volcanic', 0)).toBe(1);
    setHour('day');
    expect(journeyDusk('volcanic', 0)).toBe(0);
  });
});

describe("Lanternfall's pools", () => {
  it('lift the snow toward a silver on Lanternfall alone, at every metre and both hours', () => {
    for (const h of ['day', 'alt'] as const) {
      setHour(h);
      for (const m of MOUNTAINS) {
        const c = courseFor(m.seed);
        for (let z = 0; z <= 4600; z += 100) {
          const p = journeyPalette(c.biome, z, getPalette(c.biome, Mood.None), c);
          if (c.biome !== 'lantern') {
            expect(p.poolSilver.k, `${c.biome} ${z}`).toBe(0);
            continue;
          }
          expect(p.poolSilver.k).toBeGreaterThan(0.5);
          // The silver is the snow's own family: pale, cool, a lilac a little bluer than it is red.
          const sv = p.poolSilver.color;
          expect(lum(sv)).toBeGreaterThan(0.7);
          expect(sv.b).toBeGreaterThanOrEqual(sv.r);
        }
      }
    }
    setHour('day');
  });

  it('are drawn by the snow through silverPool where the palette asks, and in the lamp hue elsewhere', () => {
    const src = readFileSync('src/render/materials.ts', 'utf8');
    expect(src).toContain('vec3 silverPool(vec3 col, vec3 L, float painted)');
    expect(src).toContain('if (uPoolSilver.w > 0.0) col = silverPool(col, L, uSnowFx <= 0.0 ? 1.0 : 0.0);');
    // (A vec4, never an array of vectors: notes/r8-perf.md.)
    expect(src).toContain('uniform vec4 uPoolSilver;');
    expect(src).toContain('shared.uPoolSilver.value.set(');
  });
});

class MemStorage {
  map = new Map<string, string>();
  constructor(raw?: unknown) {
    if (raw !== undefined) this.map.set(SAVE_KEY, JSON.stringify(raw));
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

describe('the hour picked, in the save', () => {
  const TODAY = '2026-11-22';
  const load = (raw: unknown): SaveStore => new SaveStore(new MemStorage(raw), 'Rider', TODAY);

  it('keeps its shape: a save that never picked writes no hours', () => {
    const s = load(defaultSave('New'));
    s.flush();
    expect(JSON.parse((s['storage' as never] as MemStorage).getItem(SAVE_KEY)!).hours).toBeUndefined();
  });

  it('loads a save from before the hours (round 7, or round 8 before this lane) with every hour on its day', () => {
    const old = { ...defaultSave('Old'), runs: 40, rank: { xp: xpToPage(13), claimed: 13 } };
    delete (old as { hours?: string[] }).hours;
    const d = load(old).data;
    expect(d.hours).toBeUndefined();
    // Its pages opened Pinecrest's and Frostfang's hours: open, and still the day until picked.
    expect(hourOpen(d, 'pinecrest')).toBe(true);
    expect(hourOpen(d, 'frostfang')).toBe(true);
    expect(hourOpen(d, 'ember')).toBe(false);
  });

  it('remembers the pick per mountain, round trip, and drops what is strange', () => {
    const s = load({ ...defaultSave('P'), hours: ['ember', 'ember', 'lanternfall', 7, 'Not An Id', null] });
    expect(s.data.hours).toEqual(['ember', 'lanternfall']);
    s.flush();
    const again = new SaveStore(s['storage' as never], 'P', TODAY).data;
    expect(again.hours).toEqual(['ember', 'lanternfall']);
    expect(readHours('ember')).toEqual([]);
    expect(load({ ...defaultSave('Q'), hours: [] }).data.hours).toBeUndefined();
  });
});
