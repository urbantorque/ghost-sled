import { describe, expect, it } from 'vitest';
import { makeSnowMaterial, makeToonMaterial, shared } from '../src/render/materials';
import { PILLOW_TILE, RELIEF_N, SASTRUGI_TILE, TileBake, pillowHeight, relief, sastrugiField, sastrugiHeight, startReliefBake } from '../src/render/snowrelief';

// Round 8, snow as the hero material, second attempt (the snow2 lane): the wind's relief is a height field the
// light draws (powder's pillows and the sastrugi), baked once on idle into two small tiles that repeat seamlessly,
// read by the snow shader alone, and never by the sim.

describe('the relief tiles', () => {
  it('repeat without a seam, so the snow carries no line every tile', () => {
    for (let k = 0; k < 40; k++) {
      const u = (k * 7.31) % PILLOW_TILE;
      const v = (k * 3.17) % PILLOW_TILE;
      expect(pillowHeight(u + PILLOW_TILE, v)).toBeCloseTo(pillowHeight(u, v), 6);
      expect(pillowHeight(u, v + PILLOW_TILE)).toBeCloseTo(pillowHeight(u, v), 6);
      expect(sastrugiField(u + PILLOW_TILE, v - PILLOW_TILE)).toBeCloseTo(sastrugiField(u, v), 6);
      const a = (k * 1.93) % SASTRUGI_TILE;
      const b = (k * 0.77) % SASTRUGI_TILE;
      expect(sastrugiHeight(a + SASTRUGI_TILE, b)).toBeCloseTo(sastrugiHeight(a, b), 6);
      expect(sastrugiHeight(a, b + SASTRUGI_TILE)).toBeCloseTo(sastrugiHeight(a, b), 6);
    }
  });

  it('hold forms, not noise: pillows a few metres across with hollows between, and sastrugi in fields', () => {
    const bake = new TileBake(PILLOW_TILE, pillowHeight, sastrugiField);
    const tile = bake.pack();
    const n = RELIEF_N;
    let high = 0;
    let low = 0;
    let field = 0;
    for (let i = 0; i < n * n; i++) {
      if (tile.data[i * 4] > 170) high++;
      if (tile.data[i * 4] < 85) low++;
      if (tile.data[i * 4 + 3] > 128) field++;
    }
    // Crowns and hollows both, neither the whole tile.
    expect(high / (n * n)).toBeGreaterThan(0.02);
    expect(low / (n * n)).toBeGreaterThan(0.2);
    expect(high / (n * n)).toBeLessThan(0.5);
    // The sastrugi lie in fields, not everywhere.
    expect(field / (n * n)).toBeGreaterThan(0.2);
    expect(field / (n * n)).toBeLessThan(0.85);
    // How wide a crown runs across a row, in metres: a pillow, never a grain.
    const dm = PILLOW_TILE / n;
    let runs = 0;
    let run = 0;
    let total = 0;
    for (let y = 0; y < n; y += 8) {
      for (let x = 0; x < n; x++) {
        const on = tile.data[(y * n + x) * 4] > 150;
        if (on) run++;
        if ((!on || x === n - 1) && run > 0) {
          runs++;
          total += run;
          run = 0;
        }
      }
    }
    expect((total / runs) * dm).toBeGreaterThan(0.8);
    expect((total / runs) * dm).toBeLessThan(8);
  });

  it("writes each texel's slope so the shader's normal agrees with its height", () => {
    const bake = new TileBake(SASTRUGI_TILE, sastrugiHeight);
    const tile = bake.pack();
    const n = RELIEF_N;
    const dm = SASTRUGI_TILE / n;
    let agree = 0;
    let asked = 0;
    for (let y = 3; y < n; y += 17) {
      for (let x = 3; x < n - 3; x += 13) {
        const i = y * n + x;
        const rise = tile.data[(i + 1) * 4] - tile.data[(i - 1) * 4];
        if (Math.abs(rise) < 6) continue;
        asked++;
        const slope = ((tile.data[i * 4 + 1] - 127.5) / 127.5) * tile.slope;
        // The stored slope (height units a metre) and the height's own rise over two texels.
        if (Math.sign(slope) === Math.sign(rise) && Math.abs(slope * 2 * dm * 255 - rise) < Math.abs(rise) * 0.6 + 4) agree++;
      }
    }
    expect(asked).toBeGreaterThan(20);
    expect(agree / asked).toBeGreaterThan(0.9);
  });

  it('bakes in slices on idle time, never all at once', () => {
    const bake = new TileBake(PILLOW_TILE, pillowHeight, sastrugiField);
    let t = 0;
    // A clock that runs out after every row: each call bakes one row and stops.
    const done = bake.rows(0, () => ++t);
    expect(done).toBe(false);
    expect(bake.row).toBe(1);
    let calls = 1;
    while (!bake.rows(0, () => 1) && calls < RELIEF_N * 3) calls++;
    expect(bake.done).toBe(true);
    expect(calls).toBeGreaterThan(RELIEF_N);
  });
});

describe('the relief in the picture', () => {
  it('is the snow material\'s alone: no lit material carries its uniforms, and none is an array', () => {
    const snow = makeSnowMaterial();
    expect(snow.uniforms.uReliefP).toBe(relief.uReliefP);
    expect(snow.uniforms.uRelief).toBe(relief.uRelief);
    expect(snow.fragmentShader).toContain('reliefShadow(');
    expect('uReliefP' in shared).toBe(false);
    const toon = makeToonMaterial({});
    expect(toon.uniforms.uReliefP).toBeUndefined();
    for (const u of Object.values(relief)) expect(Array.isArray(u.value)).toBe(false);
  });

  it('is off until its tiles are baked, and nothing bakes outside a page (or before the first frame)', () => {
    startReliefBake(() => true);
    expect(relief.uRelief.value.x).toBe(0);
  });
});
