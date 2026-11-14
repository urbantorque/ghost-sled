import { describe, expect, it } from 'vitest';
import { LOW_LIGHTS, MAX_LOCAL_LIGHTS, MAX_SKY_LIGHTS, beginLocalLights, localLights, pushLocalLight, pushSkyLight, setLocalLightTier } from '../src/render/lights';

// The frame's local lights: the nearest few to the rider are kept, and lights in the sky (a firework's
// burst, 150 m of reach) hold two slots at most, so a finale's volley never puts out the street under it.

/** The kept lights' radii and powers, in slot order. */
const kept = (): { radius: number; power: number }[] => Array.from({ length: localLights.count }, (_, i) => ({ radius: localLights.pos[i * 4 + 3], power: localLights.col[i * 4 + 3] }));
const lamps = (n: number): void => {
  for (let i = 0; i < n; i++) pushLocalLight(4, 3, -(10 + i * 9), 1, 0.8, 0.5, 12, 1);
};
const burst = (power: number, i = 0): void => pushSkyLight(20 - i * 7, 60, -80, 1, 0.9, 0.7, 150, power);

describe('local lights', () => {
  it('keeps the nearest to the focus when more are offered than there are slots', () => {
    setLocalLightTier(false);
    beginLocalLights(0, 0, 0);
    for (let i = 0; i < 20; i++) pushLocalLight(0, 2, -(200 - i * 10), 1, 1, 1, 10, 1);
    expect(localLights.count).toBe(MAX_LOCAL_LIGHTS);
    expect(localLights.pushed).toBe(20);
    // The last eight pushed are the eight nearest.
    const zs = Array.from({ length: localLights.count }, (_, i) => -localLights.pos[i * 4 + 2]).sort((a, b) => a - b);
    expect(zs).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
  });

  it('a volley of eight bursts holds two slots: the street keeps six lamps, whichever came first', () => {
    for (const first of ['lamps', 'bursts'] as const) {
      setLocalLightTier(false);
      beginLocalLights(0, 0, 0);
      if (first === 'lamps') lamps(8);
      for (let i = 0; i < 8; i++) burst(0.4 + i * 0.2, i);
      if (first === 'bursts') lamps(8);
      const k = kept();
      expect(k).toHaveLength(MAX_LOCAL_LIGHTS);
      expect(k.filter((l) => l.radius === 150), first).toHaveLength(MAX_SKY_LIGHTS);
      expect(k.filter((l) => l.radius === 12), first).toHaveLength(MAX_LOCAL_LIGHTS - MAX_SKY_LIGHTS);
      // The two kept are the two brightest.
      expect(k.filter((l) => l.radius === 150).map((l) => +l.power.toFixed(2)).sort(), first).toEqual([1.6, 1.8]);
    }
  });

  it('bursts alone still light the snow, and a frame starts with none', () => {
    setLocalLightTier(false);
    beginLocalLights(0, 0, 0);
    burst(1);
    expect(kept()).toEqual([{ radius: 150, power: 1 }]);
    burst(2, 1);
    burst(0.5, 2);
    expect(kept().map((l) => l.power).sort()).toEqual([1, 2]);
    beginLocalLights(0, 0, 0);
    expect(localLights.count).toBe(0);
    lamps(MAX_LOCAL_LIGHTS);
    expect(kept().every((l) => l.radius === 12)).toBe(true);
  });

  it('Low keeps one burst among its four', () => {
    setLocalLightTier(true);
    beginLocalLights(0, 0, 0);
    for (let i = 0; i < 5; i++) burst(1 + i, i);
    lamps(8);
    const k = kept();
    expect(k).toHaveLength(LOW_LIGHTS);
    expect(k.filter((l) => l.radius === 150).map((l) => l.power)).toEqual([5]);
    setLocalLightTier(false);
  });
});

describe('the volley over the line', () => {
  it('is full for a rider who leads and modest for one who does not', async () => {
    const { lineShells } = await import('../src/render/climaxworld');
    const win = lineShells(true);
    const other = lineShells(false);
    expect(win).toEqual({ n: 5, high: 58 });
    expect(other.n).toBeGreaterThan(0);
    expect(other.n).toBeLessThanOrEqual(win.n / 2);
    expect(other.high).toBeLessThan(win.high);
  });
});
