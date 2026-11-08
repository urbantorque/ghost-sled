import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRAVE_APART, GRAVE_MAX, GRAVE_NAMES, bundledGraveyards, graveyards } from '../src/game/graveyards';
import type { PoolGhostData } from '../src/game/ghostdata';
import { withSlowRiders } from '../src/game/slowriders';
import { FINISH_Z } from '../src/game/standing';

// Graveyards from the bundled pools: where 2 or more riders really fell within 40 m, named per mountain.

const pool = (id: string): PoolGhostData[] => (JSON.parse(readFileSync(join(process.cwd(), `src/data/ghosts/${id}.json`), 'utf8')) as { ghosts: PoolGhostData[] }).ghosts;
const pinecrest = 'pinecrest';
const frostfang = 'frostfang';
const ember = 'ember';
const sakura = 'sakura';
const at = (d: number, ticks = 600) => ({ distance: d, ticks });
/** A rider with its falls recorded (and its own run, by its score). */
const rider = (score: number, ...falls: number[]) => ({ distance: FINISH_Z + 40, ticks: 11000, score, falls });

describe('graveyards and the finish line', () => {
  it('never forms at the line: reaching it is no crash', () => {
    const finishers = [FINISH_Z, FINISH_Z + 2, FINISH_Z + 3, FINISH_Z + 4, FINISH_Z + 6].map((d) => at(d, 11000));
    expect(graveyards(finishers, 'pinecrest')).toEqual([]);
  });

  it('still forms where riders crashed just short of it', () => {
    expect(graveyards([at(FINISH_Z - 8), at(FINISH_Z - 6), at(FINISH_Z - 3)], 'pinecrest').map((g) => g.fell)).toEqual([3]);
  });
});

describe('graveyards', () => {
  it('finds the places on every mountain, from where riders really fell', () => {
    const at = (key: string) => graveyards(pool(key), key).map((g) => [Math.round(g.z), g.fell]);
    expect(at(pinecrest)).toEqual([
      [417, 6],
      [1183, 3],
      [1420, 2],
      [3002, 4],
    ]);
    expect(at(frostfang)).toEqual([
      [1084, 3],
      [2706, 2],
      [2894, 2],
      [3115, 14],
    ]);
    expect(at(ember)).toEqual([
      [2506, 2],
      [3053, 5],
    ]);
    expect(at(sakura)).toEqual([
      [2131, 9],
      [2345, 4],
      [3504, 16],
      [4109, 7],
    ]);
  });

  it('counts each place in riders, and every fall in it is a recorded one', () => {
    for (const key of [pinecrest, frostfang, ember, sakura]) {
      const riders = pool(key);
      for (const g of graveyards(riders, key)) {
        const there = riders.filter((r) => r.falls?.some((z) => Math.abs(z - g.z) <= 40));
        expect(there.length, `${key} at ${g.z}`).toBeGreaterThanOrEqual(g.fell);
        expect(g.fell).toBeGreaterThanOrEqual(2);
      }
    }
    // One rider's two tumbles in a spot are one fall from that place's count, and no place at all.
    expect(graveyards([rider(1, 500, 505)], 'k')).toEqual([]);
    expect(graveyards([rider(1, 500, 505), rider(2, 510)], 'k')).toMatchObject([{ fell: 2 }]);
  });

  it('takes the deadliest places, nearest first on a tie, and comes back in the order they are ridden', () => {
    const pack = (z: number, n: number) => Array.from({ length: n }, (_, i) => rider(z + i, z + i));
    const many = [...pack(300, 2), ...pack(900, 2), ...pack(1500, 3), ...pack(2100, 2), ...pack(2700, 5), ...pack(3300, 4)];
    expect(graveyards(many, 'k').map((g) => g.fell)).toEqual([2, 3, 5, 4]);
    expect(graveyards(many, 'k').map((g) => Math.round(g.z))).toEqual([301, 1501, 2702, 3302]);
  });

  it('keeps two places far enough apart that one survival does not land on the last', () => {
    const near = [rider(1, 1000), rider(2, 1001), rider(3, 1100), rider(4, 1101), rider(5, 1102), rider(6, 1000 + GRAVE_APART + 120), rider(7, 1001 + GRAVE_APART + 120)];
    const list = graveyards(near, 'k');
    expect(list.map((g) => g.fell)).toEqual([3, 2]);
    expect(list[1].z - list[0].z).toBeGreaterThanOrEqual(GRAVE_APART);
    for (const key of [pinecrest, frostfang, ember, sakura]) {
      const g = graveyards(pool(key), key);
      for (let i = 1; i < g.length; i++) expect(g[i].z - g[i - 1].z).toBeGreaterThanOrEqual(GRAVE_APART);
    }
  });

  it('never counts a slow rider: it is a real run under a second name, already counted', () => {
    for (const key of [pinecrest, frostfang, ember, sakura]) {
      const slow = withSlowRiders(pool(key), key);
      expect(slow.length).toBeGreaterThan(pool(key).length);
      expect(graveyards(slow, key)).toEqual(graveyards(pool(key), key));
    }
    // (Those two tumbled in one spot: one rider's run under two names is no graveyard.)
    const base = { ...rider(7, 2000), finishTick: 9000, name: 'A', record: 'x' };
    expect(graveyards([base, { ...base, name: 'B' }], 'k')).toEqual([]);
  });

  it('still reads an older pool, from where its runs ended', () => {
    const old = pool(sakura).map(({ falls: _, ...g }) => g);
    expect(graveyards(old, sakura).map((g) => [Math.round(g.z), g.fell])).toEqual([
      [3507, 2],
      [4110, 2],
    ]);
  });

  it('leaves out a recorded fall at or past the line, and takes a clean run for a clean run', () => {
    expect(graveyards([rider(1, FINISH_Z), rider(2, FINISH_Z + 3)], 'k')).toEqual([]);
    // (Never fell, never finished: reached the cap. No falls is the record, not a missing one.)
    expect(graveyards([{ distance: 700, ticks: 9000, score: 1, falls: [] }, { distance: 701, ticks: 9000, score: 2, falls: [] }], 'k')).toEqual([]);
  });

  it('names come from the list, stay the same per mountain and never repeat on one', () => {
    const a = graveyards(pool(sakura), 'sakura');
    const b = graveyards(pool(sakura), 'sakura');
    expect(a).toEqual(b);
    for (const n of GRAVE_NAMES) {
      expect(n.length).toBeLessThanOrEqual(14);
      expect(n).not.toMatch(/[—']/);
    }
    expect(new Set(a.map((g) => g.name)).size).toBe(a.length);
    for (const g of a) {
      expect(GRAVE_NAMES).toContain(g.name);
      // 'Name: 4 fell here' fits a phone tag; copy rules: no em dash.
      expect(g.name.length).toBeLessThanOrEqual(14);
      expect(g.name).not.toMatch(/—/);
    }
  });

  it('names never repeat across the bundled mountains, and come out the same every time', () => {
    const all = () => bundledGraveyards([pinecrest, frostfang, ember, sakura].map((key) => ({ key, pool: pool(key) })));
    const a = all();
    const names = [...a.values()].flat().map((g) => g.name);
    expect(names.length).toBe(14);
    expect(new Set(names).size).toBe(names.length);
    expect(all()).toEqual(a);
    // The clusters are the same ones the per-mountain call finds.
    expect(a.get(sakura)!.map((g) => [Math.round(g.z), g.fell])).toEqual(graveyards(pool(sakura), sakura).map((g) => [Math.round(g.z), g.fell]));
    // More places than names: each mountain still never repeats its own.
    const many = [100, 300, 500, 700].flatMap((z) => [at(z), at(z + 1), at(z + 2)]);
    const crowd = bundledGraveyards(['a', 'b', 'c', 'd', 'e'].map((key) => ({ key, pool: many })));
    for (const list of crowd.values()) expect(new Set(list.map((g) => g.name)).size).toBe(list.length);
  });

  it('needs 2 within 40 m (first to last), skips finishers, caps at 4, handles an empty pool', () => {
    expect(graveyards([at(100), at(141)], 'k')).toHaveLength(0);
    expect(graveyards([at(100), at(140)], 'k')).toMatchObject([{ fell: 2, z: 120 }]);
    // Capped finishers never crashed.
    expect(graveyards([at(100), at(102, 18000)], 'k')).toHaveLength(0);
    const many = [100, 300, 500, 700, 900, 1100].flatMap((z) => [at(z), at(z + 1), at(z + 2)]);
    const g = graveyards(many, 'k');
    expect(g).toHaveLength(GRAVE_MAX);
    expect(g.map((x) => Math.round(x.z))).toEqual([101, 301, 501, 701]);
    expect(graveyards([], 'k')).toEqual([]);
  });
});
