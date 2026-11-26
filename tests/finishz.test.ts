import { describe, expect, it } from 'vitest';
import { targetZ } from '../src/game/challenge';
import { ANCHOR_MAX, ANCHOR_MIN, anchorFor, fieldPace, finishZOfKey, pickField, poolTime, rivalOf } from '../src/game/field';
import type { PoolGhostData } from '../src/game/ghostdata';
import { graveyards } from '../src/game/graveyards';
import { MISSIONS, type RunSummary } from '../src/game/missions';
import { reading } from '../src/game/pacer';
import { FINISH_Z, finishZOf, predictedTime, recordStanding } from '../src/game/standing';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { Course, finishZFor } from '../src/sim/course';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';

// Round 9: a new mountain is its own length, so the game reads each course's finish line where it read the five's
// FINISH_Z (notes/r9-ground.md section 9). Every reader takes the line it is given (or a record's own seed) and
// defaults to the five's, so the five's figures are what they were.

const pool = (n: number, distance: number, ticks: number): PoolGhostData[] =>
  Array.from({ length: n }, (_, i) => ({ name: `R${i}`, score: 100 + i, distance, ticks: ticks + i * 300, finishTick: -1, sled: 0, mood: 0, event: 0, record: `rec${i}` }));

describe("each course's own finish line", () => {
  it('is 4,500 m on the five and every Daily, from the seed alone and from the course', () => {
    for (const m of MOUNTAINS) {
      expect(finishZOf(m.seed), m.id).toBe(FINISH_Z);
      expect(finishZFor(m.seed), m.id).toBe(new Course(m.seed).finishZ);
    }
    for (const k of ['2026-11-08', '2027-02-14']) expect(finishZOf(dailySeed(k))).toBe(FINISH_Z);
    expect(FINISH_Z).toBe(4500);
  });

  it("a record is finished on its own course's line", () => {
    const seed = MOUNTAINS[0].seed;
    expect(recordStanding({ ticks: 7000, distance: 4500, seed })).toEqual({ time: 7000 / 60, distance: 4500 });
    expect(recordStanding({ ticks: 7000, distance: 4499, seed })).toEqual({ time: null, distance: 4499 });
    // With no seed, the five's line, as before.
    expect(recordStanding({ ticks: 7000, distance: 4500 }).time).toBeCloseTo(7000 / 60, 9);
    // A shorter course's line.
    expect(recordStanding({ ticks: 6000, distance: 3000, seed }, 3000).time).toBeCloseTo(100, 9);
    expect(recordStanding({ ticks: 6000, distance: 2999, seed }, 3000).time).toBeNull();
  });

  it('an old link is clamped to its own course', () => {
    expect(targetZ({ distance: 5200, seed: MOUNTAINS[1].seed })).toBe(4500);
    expect(targetZ({ distance: 2340, seed: MOUNTAINS[1].seed })).toBe(2340);
  });

  it("a pool rider's time, a field and its rival read the course's line", () => {
    const g = pool(1, 1500, 3000)[0];
    expect(poolTime(g)).toBe(predictedTime(1500, 50, FINISH_Z));
    expect(poolTime(g, 3000)).toBe(predictedTime(1500, 50, 3000));
    // Riders who stopped at 3,000 m finished a 3,000 m course and did not finish a 4,500 m one.
    const riders = pool(12, 3000, 5400);
    const base = { pool: riders, kind: 'pool' as const, mood: Mood.None, event: ChaosEvent.None, count: 5, anchor: 100, seed: 7, bestScore: 0, you: null, grudge: null, friend: null };
    const long = pickField(base);
    const short = pickField({ ...base, finishZ: 3000 });
    expect(long.length).toBeGreaterThan(0);
    expect(short.length).toBeGreaterThan(0);
    const rows = riders.slice(0, 3).map((r, i) => ({ name: r.name, kind: 'pool' as const, score: r.score, record: r.record, time: 90 + i, distance: 3000 }));
    expect(rivalOf(rows, 100, null, 3000)?.name).toBe('R2');
    expect(rivalOf(rows, 100)?.name).toBe('R2');
  });

  it("the anchor reads another mountain's times at this one's length, and on the five every ratio is 1", () => {
    const times = { pinecrest: [130, 128, 131], frostfang: [122] };
    // (Every other key's last five, 130, 128, 131 and 122: their median 129.)
    expect(anchorFor(times, 'ember')).toBe(Math.min(ANCHOR_MAX, Math.max(ANCHOR_MIN, 1.1 * 129)));
    expect(anchorFor(times, 'pinecrest')).toBe(Math.min(130, 1.1 * 131));
    expect(finishZOfKey('night:mirror:sakura')).toBe(4500);
    expect(finishZOfKey('trial:2026-W48')).toBe(4500);
    expect(fieldPace(130, [90, 92, 95])).toBe(100);
    expect(fieldPace(130, [90, 92, 95], 3000)).toBe(92);
  });

  it('graveyards count falls short of the line they are given', () => {
    const riders = [3500, 3502, 3505, 3510].map((z) => ({ distance: z, ticks: 9000, falls: [z] }));
    expect(graveyards(riders, 'pinecrest').length).toBe(1);
    expect(graveyards(riders, 'pinecrest', undefined, 3000).length).toBe(0);
  });

  it("the riders stop reading you at the course's own last stage", () => {
    expect(reading(2949, 4500)).toBe(true);
    expect(reading(2951, 4500)).toBe(false);
    expect(reading(1949, 3000, 1050)).toBe(true);
    expect(reading(1951, 3000, 1050)).toBe(false);
  });

  it("a time mission counts only on a course of the five's length", () => {
    const def = MISSIONS.find((m) => m.id === 'time210')!;
    const sum = { finished: true, finishSeconds: 140 } as RunSummary;
    expect(def.metric(sum)).toBe(1);
    expect(def.metric({ ...sum, finishZ: 4500 })).toBe(1);
    expect(def.metric({ ...sum, finishZ: 2800 })).toBe(0);
  });
});
