import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRAVE_MAX, GRAVE_NAMES, graveyards } from '../src/game/graveyards';
import type { PoolGhostData } from '../src/game/ghostdata';

// Graveyards from the bundled pools: where 3 or more riders crashed within 8 m, named per mountain.

const pool = (id: string): PoolGhostData[] => (JSON.parse(readFileSync(join(process.cwd(), `src/data/ghosts/${id}.json`), 'utf8')) as { ghosts: PoolGhostData[] }).ghosts;
const pinecrest = 'pinecrest';
const frostfang = 'frostfang';
const ember = 'ember';
const sakura = 'sakura';
const at = (d: number, ticks = 600) => ({ distance: d, ticks });

describe('graveyards', () => {
  it('finds the bundled clusters: Pinecrest 2, Frostfang none, Ember 1, Sakura 4 with 4 at 395 m', () => {
    const p = graveyards(pool(pinecrest), 'pinecrest');
    expect(p.map((g) => [Math.round(g.z), g.fell])).toEqual([
      [370, 3],
      [605, 3],
    ]);
    expect(graveyards(pool(frostfang), 'frostfang')).toEqual([]);
    expect(graveyards(pool(ember), 'ember').map((g) => [Math.round(g.z), g.fell])).toEqual([[350, 3]]);
    const s = graveyards(pool(sakura), 'sakura');
    expect(s.map((g) => [Math.round(g.z), g.fell])).toEqual([
      [216, 3],
      [291, 3],
      [395, 4],
      [1729, 3],
    ]);
  });

  it('names come from the list, stay the same per mountain and never repeat on one', () => {
    const a = graveyards(pool(sakura), 'sakura');
    const b = graveyards(pool(sakura), 'sakura');
    expect(a).toEqual(b);
    expect(new Set(a.map((g) => g.name)).size).toBe(a.length);
    for (const g of a) {
      expect(GRAVE_NAMES).toContain(g.name);
      // 'Name: 4 fell here' fits a phone tag; copy rules: no em dash.
      expect(g.name.length).toBeLessThanOrEqual(14);
      expect(g.name).not.toMatch(/—/);
    }
  });

  it('needs 3 within 8 m (first to last), skips finishers, caps at 4, handles an empty pool', () => {
    expect(graveyards([at(100), at(105), at(109)], 'k')).toHaveLength(0);
    expect(graveyards([at(100), at(104), at(108)], 'k')).toMatchObject([{ fell: 3, z: 104 }]);
    // Capped finishers never crashed.
    expect(graveyards([at(100), at(101), at(102, 18000)], 'k')).toHaveLength(0);
    const many = [100, 300, 500, 700, 900, 1100].flatMap((z) => [at(z), at(z + 1), at(z + 2)]);
    const g = graveyards(many, 'k');
    expect(g).toHaveLength(GRAVE_MAX);
    expect(g.map((x) => Math.round(x.z))).toEqual([101, 301, 501, 701]);
    expect(graveyards([], 'k')).toEqual([]);
  });
});
