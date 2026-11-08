import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { poolTime } from '../src/game/field';
import type { PoolGhostData } from '../src/game/ghostdata';
import { clock, unclock } from '../src/game/ghosts';
import { paceOf, withSlowRiders } from '../src/game/slowriders';
import { recordFromString, replayRecord } from '../src/sim/replay';

const pool = (id: string): PoolGhostData[] => JSON.parse(readFileSync(join('src/data/ghosts', `${id}.json`), 'utf8')).ghosts;

describe('slow riders', () => {
  for (const id of ['pinecrest', 'frostfang', 'ember', 'sakura']) {
    it(`closes the gap under the bots on ${id}`, () => {
      const raw = pool(id);
      const full = withSlowRiders(raw, id);
      expect(full.length).toBeGreaterThan(raw.length + 6);
      const times = full.filter((g) => (g.finishTick ?? -1) > 0).map((g) => g.finishTick! / 60).sort((a, b) => a - b);
      // No hole on the ladder from the fastest down to five minutes: a rider always has one close by.
      for (let i = 1; i < times.length; i++) expect(times[i] / times[i - 1], `${times[i - 1]} to ${times[i]}`).toBeLessThan(1.08);
      expect(times[times.length - 1]).toBeGreaterThan(270);
      expect(times[times.length - 1]).toBeLessThanOrEqual(301);
      // Weakest first, the order every reader expects.
      const race = (g: PoolGhostData): number => ((g.finishTick ?? -1) > 0 ? 1e7 - g.finishTick! : g.distance);
      for (let i = 1; i < full.length; i++) expect(race(full[i])).toBeGreaterThanOrEqual(race(full[i - 1]));
    });

    it(`keeps every rider its own, and replays the same run on ${id}`, () => {
      const raw = pool(id);
      const full = withSlowRiders(raw, id);
      expect(new Set(full.map((g) => g.record)).size).toBe(full.length);
      expect(new Set(full.map((g) => g.name.toLowerCase())).size).toBe(full.length);
      const added = full.filter((g) => !raw.some((r) => r.record === g.record));
      for (const g of added) {
        const pace = paceOf(g.record);
        expect(pace).toBeLessThan(1);
        expect(pace).toBeGreaterThan(0.35);
        // A slow rider's record is a real run: it replays to its base's finish, and the pace scales that.
        const r = recordFromString(g.record);
        expect(r.name).toBe(g.name);
        const sim = replayRecord(r);
        expect(sim.finished).toBe(true);
        expect(g.finishTick).toBe(Math.round(sim.s.finishTick / pace));
      }
      for (const g of raw) expect(paceOf(g.record)).toBe(1);
    });
  }

  it('makes the same riders every time, and field times read them', () => {
    const a = withSlowRiders(pool('pinecrest'), 'pinecrest');
    const b = withSlowRiders(pool('pinecrest'), 'pinecrest');
    expect(b).toEqual(a);
    expect(Math.max(...a.map((g) => poolTime(g)))).toBeGreaterThan(270);
  });

  it('leaves a pool with no finishers alone', () => {
    const none: PoolGhostData[] = [{ name: 'a', score: 1, distance: 100, ticks: 300, finishTick: -1, sled: 0, mood: 0, event: 0, record: 'x' }];
    expect(withSlowRiders(none, 'k')).toEqual(none);
  });
});

describe('a pack rider surges and fades', () => {
  const t = { pace: 1, swing: 0.018 * 8000, swingEnd: 8000 };

  it('finishes on its real time, always moving forward', () => {
    expect(clock(t, 0)).toBe(0);
    expect(clock(t, 8000)).toBe(8000);
    let prev = -1;
    for (let tick = 0; tick <= 8200; tick += 5) {
      const at = clock(t, tick);
      expect(at).toBeGreaterThan(prev);
      prev = at;
    }
  });

  it('really leaves its own pace, and comes back through it', () => {
    let crossings = 0;
    let last = 0;
    for (let tick = 1; tick < 8000; tick += 10) {
      const d = clock(t, tick) - tick;
      if (d * last < 0) crossings++;
      if (d !== 0) last = d;
    }
    expect(crossings).toBeGreaterThanOrEqual(2);
    expect(Math.max(...[1000, 1300, 1400].map((k) => Math.abs(clock(t, k) - k)))).toBeGreaterThan(100);
  });

  it('inverts exactly, at any pace', () => {
    for (const pace of [1, 0.8, 0.55]) {
      const p = { ...t, pace };
      for (let tick = 0; tick <= 8000; tick += 137) expect(Math.abs(unclock(p, clock(p, tick)) - tick)).toBeLessThanOrEqual(1);
    }
  });

  it('leaves an untouched rider untouched', () => {
    const plain = { pace: 1, swing: 0, swingEnd: 8000 };
    expect(clock(plain, 1234)).toBe(1234);
    expect(unclock(plain, 1234)).toBe(1234);
  });
});
