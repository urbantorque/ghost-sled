import { readFileSync } from 'node:fs';
import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { Mood } from '../src/sim/chaos';
import type { BiomeId } from '../src/sim/mountains';
import { POSTER_GLSL, makeToonMaterial, posterFrame, setCloudShadows, applyPalette, shared } from '../src/render/materials';
import { getPalette, lerpPalette, setPoster, tierLook } from '../src/render/palette';
import { posterGeometry, shaftReach } from '../src/render/poster';
import { RESULTS_BAND } from '../src/ui/contract';

// Low's poster (the visual lift, poster lane): what Low paints where the other tiers draw an effect. The layer
// is one draw (the frame's quad last, so the foot lies over the light), its shafts only come from a low sun in
// or near the frame, the palette's poster fields blend and grade like every colour Low draws with, and none
// of it reaches another tier. And the phone's results band is one number, in the contract and the stylesheet.

const biomes: readonly BiomeId[] = ['alpine', 'glacier', 'volcanic', 'blossom', 'lantern'];

describe("Low's poster", () => {
  it('is one draw: the frame quad first in the vertex list and last in the index list, every card a quad', () => {
    const g = posterGeometry();
    const pos = g.getAttribute('position');
    const idx = g.getIndex()!;
    expect((pos.count - 4) % 4).toBe(0);
    expect(idx.count).toBe((pos.count / 4) * 6);
    // The frame: group 0, its corners in x and y.
    for (let i = 0; i < 4; i++) expect(pos.getZ(i)).toBe(0);
    const last = Array.from(idx.array.slice(idx.count - 6));
    expect(Math.max(...last)).toBe(3);
    // Every card is a sun card (1) or a place card (2), and the sun's fan has light and shade beams in it.
    const card = g.getAttribute('aCard');
    let light = 0;
    let shade = 0;
    for (let v = 4; v < pos.count; v += 4) {
      expect([1, 2]).toContain(pos.getZ(v));
      if (pos.getZ(v) === 1) (card.getW(v) > 0 ? light++ : shade++);
    }
    expect(light).toBeGreaterThan(shade);
    expect(shade).toBeGreaterThan(0);
  });

  it('paints shafts only from a low sun in the frame or just off it, never from behind the lens', () => {
    expect(shaftReach(0.2, 0.5, false, 0.1)).toBe(1);
    expect(shaftReach(0.2, 0.5, true, 0.1)).toBe(0);
    // Off the frame's edge it fades out over the margin.
    expect(shaftReach(1.2, 0.5, false, 0.1)).toBeGreaterThan(0);
    expect(shaftReach(1.2, 0.5, false, 0.1)).toBeLessThan(1);
    expect(shaftReach(1.7, 0.5, false, 0.1)).toBe(0);
    // A climbing sun throws none you can see.
    expect(shaftReach(0, 0, false, 0.25)).toBeLessThan(1);
    expect(shaftReach(0, 0, false, 0.33)).toBe(0);
  });

  it("every Clear Skies mountain's poster is in range, and a night mood paints no shafts", () => {
    for (const b of biomes) {
      const p = getPalette(b, Mood.None).poster;
      for (const k of ['rim', 'hero', 'shafts', 'foot', 'vignette', 'stripe', 'soft', 'shadowK', 'edge'] as const) {
        expect(p[k], `${b} ${k}`).toBeGreaterThanOrEqual(0);
        expect(p[k], `${b} ${k}`).toBeLessThanOrEqual(k === 'shafts' || k === 'hero' ? 3 : 1);
      }
      expect(p.foot + p.vignette, b).toBeLessThan(1);
      expect(Number.isInteger(p.bands) && p.bands >= 0 && p.bands <= 12, b).toBe(true);
      expect(Number.isInteger(p.steps) && p.steps >= 0 && p.steps <= 4, b).toBe(true);
      expect(p.soft, b).toBeLessThanOrEqual(0.5);
      expect(p.hero, `${b}: the hero's rim is the frame's strongest`).toBeGreaterThanOrEqual(p.rim);
    }
    for (const mood of [Mood.Lantern, Mood.Comet, Mood.Haunted]) {
      const p = getPalette('alpine', mood);
      expect(p.grade.shafts * p.poster.shafts, `mood ${mood}`).toBe(0);
    }
  });

  it('blends between two palettes and grades its shadow colour only on Low', () => {
    const a = getPalette('alpine', Mood.None);
    const b = getPalette('glacier', Mood.None);
    const mid = lerpPalette(a, b, 0.5, {} as typeof a);
    expect(mid.poster.rim).toBeCloseTo((a.poster.rim + b.poster.rim) / 2, 6);
    expect(mid.poster.shadow).toBeInstanceOf(Color);
    expect(mid.poster.shadow).not.toBe(a.poster.shadow);
    setPoster(false);
    expect(tierLook(a)).toBe(a);
    setPoster(true);
    const low = tierLook(a);
    expect(low).not.toBe(a);
    expect(low.poster.shadow.equals(a.poster.shadow)).toBe(false);
    // The palette itself is never written.
    expect(a.poster.shadow.equals(getPalette('alpine', Mood.None).poster.shadow)).toBe(true);
    setPoster(false);
  });

  it('reaches no other tier: the shared switch is 1 on Low alone, and the frame reads the palette in force', () => {
    setCloudShadows(true);
    expect(shared.uPoster.value.x).toBe(0);
    setCloudShadows(false);
    expect(shared.uPoster.value.x).toBe(1);
    const p = getPalette('alpine', Mood.None);
    applyPalette(p);
    expect(shared.uPoster.value.x).toBe(1);
    expect(posterFrame.foot).toBe(p.poster.foot);
    expect(posterFrame.shafts).toBeCloseTo(p.grade.shafts * p.poster.shafts, 6);
    setCloudShadows(true);
    expect(shared.uPoster.value.x).toBe(0);
  });

  it("the toon material carries the poster's chunk, and only the hero's takes the hero's band", () => {
    const prop = makeToonMaterial({});
    const hero = makeToonMaterial({ hero: true });
    expect(prop.fragmentShader).toContain(POSTER_GLSL.trim().split('\n')[0]);
    expect(prop.fragmentShader).toContain('posterRim(col, base, n, v, shadow, uRimK, 0.0)');
    expect(prop.defines.HERO).toBeUndefined();
    expect(hero.defines.HERO).toBe(1);
    // The poster's uniforms are the shared ones, by reference.
    expect(prop.uniforms.uPoster).toBe(shared.uPoster);
  });
});

describe("the phone's results band (contract C6)", () => {
  it('is the same share in the contract and in the portrait results rule', () => {
    const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
    const m = /\.gs-results \{\s*grid-template-rows: calc\((\d+(?:\.\d+)?)% \+ env\(safe-area-inset-top/.exec(css);
    expect(m).not.toBeNull();
    expect(Number(m![1]) / 100).toBeCloseTo(RESULTS_BAND, 6);
    // Enough of the height for the rider under the moment's line, and the card still the larger part.
    expect(RESULTS_BAND).toBeGreaterThanOrEqual(0.4);
    expect(RESULTS_BAND).toBeLessThan(0.5);
  });
});
