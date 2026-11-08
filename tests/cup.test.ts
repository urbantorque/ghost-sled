import { describe, expect, it } from 'vitest';
import { cupChaos, cupMountain, cupSeed, weekKey, weekNumber, weekOfDay } from '../src/game/cup';
import { pickField, poolTime, rivalOf } from '../src/game/field';
import type { PoolGhostData } from '../src/game/ghostdata';
import { type SaveData, SAVE_KEY, SaveStore, defaultSave, pruneDaily } from '../src/game/save';
import { cupMedalNow, dailyLine, medalThresholds, settleRun } from '../src/game/settle';
import type { RunSummary } from '../src/game/missions';
import { FINISH_Z } from '../src/game/standing';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { dailySeed } from '../src/sim/mountains';

// One mountain a week, derived purely from the week key: everyone rides the same seed, mood, event and
// field. Same run flow as the Daily, and its entries are pruned the same way.

const WEEK = '2026-W45';
const TODAY = '2026-11-06';

describe('the ISO week', () => {
  it('reads a date as its week', () => {
    expect(weekKey(new Date(Date.UTC(2026, 10, 6)))).toBe(WEEK);
    expect(weekOfDay(TODAY)).toBe(WEEK);
    expect(weekNumber(WEEK)).toBe(45);
  });

  it('runs Monday to Sunday', () => {
    expect(weekOfDay('2026-11-01')).toBe('2026-W44'); // a Sunday
    expect(weekOfDay('2026-11-02')).toBe('2026-W45'); // the Monday after it
    expect(weekOfDay('2026-11-08')).toBe('2026-W45'); // that week's Sunday
  });

  it('gives a week its Thursday\'s year, across New Year', () => {
    expect(weekOfDay('2021-01-03')).toBe('2020-W53');
    expect(weekOfDay('2021-01-04')).toBe('2021-W01');
    expect(weekOfDay('2024-12-30')).toBe('2025-W01');
    expect(weekOfDay('2026-01-01')).toBe('2026-W01');
    expect(weekOfDay('2026-12-31')).toBe('2026-W53');
  });

  it('reads junk as no week', () => {
    expect(weekOfDay('')).toBe('');
    expect(weekOfDay('soon')).toBe('');
    expect(weekNumber('soon')).toBe(0);
  });
});

describe('the week\'s Cup', () => {
  it('is the same from the key alone, and never another day\'s Daily', () => {
    expect(cupSeed(WEEK)).toBe(cupSeed(WEEK));
    expect(cupSeed(WEEK)).not.toBe(cupSeed('2026-W46'));
    expect(cupSeed(WEEK)).not.toBe(dailySeed(WEEK));
    expect(cupMountain(WEEK)).toMatchObject({ id: 'cup', name: 'Weekly Cup', tagline: WEEK, seed: cupSeed(WEEK), unlockGhosts: 0 });
  });

  it('fixes its mood, event and event placement for the week', () => {
    expect(cupChaos(WEEK)).toEqual(cupChaos(WEEK));
  });

  it('always has a mood, and the weeks vary', () => {
    const weeks = Array.from({ length: 52 }, (_, i) => `2026-W${String(i + 1).padStart(2, '0')}`);
    const rolls = weeks.map(cupChaos);
    for (const r of rolls) expect(r.mood).not.toBe(Mood.None);
    expect(new Set(rolls.map((r) => r.mood)).size).toBeGreaterThan(3);
    expect(new Set(rolls.map((r) => r.event)).size).toBeGreaterThan(2);
    expect(rolls.some((r) => r.event === ChaosEvent.None)).toBe(true);
  });
});

function poolGhost(i: number): PoolGhostData {
  return { name: `g${i}`, score: 1000 + i, distance: FINISH_Z + 80, ticks: 9000, finishTick: (120 + i * 6) * 60, sled: 0, mood: 0, event: 0, record: 'x' };
}

describe('its field', () => {
  // The app calls pickField with no anchor and no best: the same picks for everyone.
  const roll = cupChaos(WEEK);
  const pool = Array.from({ length: 10 }, (_, i) => poolGhost(i));
  const at = (name: string) => pickField({ pool, kind: 'daily', mood: Mood.None, event: ChaosEvent.None, count: 5, anchor: 0, seed: roll.seed, bestScore: name === 'A' ? 9000 : 0, you: null, grudge: null, friend: null });

  it('is fixed by the week whoever rides', () => {
    expect(medalThresholds(pool.map(poolTime))).not.toBeNull();
    // (poolGhost records never decode, so only the pool's picks are compared.)
    expect(at('A').map((p) => p.name)).toEqual(at('B').map((p) => p.name));
  });

  it('names one rival', () => {
    const field = at('A');
    expect(field.filter((p) => p.rival).length).toBe(1);
    expect(rivalOf(field, 150)?.time).toBeLessThanOrEqual(150);
  });
});

function summary(over: Partial<RunSummary> = {}): RunSummary {
  return { mountain: 'cup', biome: 'alpine', score: 900, distance: FINISH_Z + 60, gifts: 3, perfects: 0, maxAirtime: 0, maxHalfTurns: 0, flips: 0, driftSeconds: 0, draftSeconds: 0, nearMisses: 0, bestCombo: 0, maxSpeed: 20, smashes: 0, gates: 0, yetiHop: false, outranAvalanche: false, ghostsPassed: 0, grudgeBeaten: false, chaos: true, seconds: 150, finished: true, finishSeconds: 140, tumbles: 0, wallRides: 0, grinds: 0, ...over };
}

const T: [number, number, number] = [160, 140, 120];

describe('settling a Cup run', () => {
  const key = `cup:${WEEK}`;

  it('keeps the week\'s best time and medal, in the Daily\'s shape', () => {
    const d = defaultSave('Nico');
    const r = settleRun(d, summary(), null, key, T);
    expect(d.cup).toEqual({ key: WEEK, best: 140, medal: 2 });
    expect(r.cup).toMatchObject({ medal: 2, best: 2, line: 'Cup: Silver. Gold at 2:00.0.' });
    expect(cupMedalNow(d.cup, WEEK)).toBe(2);
    expect(cupMedalNow(d.cup, '2026-W46')).toBe(0);
  });

  it('settles the same twice, and a slower run takes nothing away', () => {
    const d = defaultSave('Nico');
    const s = settleRun(d, summary(), null, key, T).settlement;
    settleRun(d, summary(), s, key, T);
    expect(d.cup).toEqual({ key: WEEK, best: 140, medal: 2 });
    settleRun(d, summary({ finishSeconds: 170 }), null, key, T);
    expect(d.cup).toEqual({ key: WEEK, best: 140, medal: 2 });
  });

  it('starts a new week clean', () => {
    const d = defaultSave('Nico');
    settleRun(d, summary(), null, key, T);
    settleRun(d, summary({ finishSeconds: 150 }), null, 'cup:2026-W46', T);
    expect(d.cup).toEqual({ key: '2026-W46', best: 150, medal: 1 });
  });

  it('gives a wreck no time and no medal', () => {
    const d = defaultSave('Nico');
    const r = settleRun(d, summary({ finished: false, finishSeconds: 0, distance: 900 }), null, key, T);
    expect(d.cup).toEqual({ key: WEEK, best: 0, medal: 0 });
    expect(r.cup?.line).toBe('Cup: Bronze at 2:40.0.');
  });

  it('leaves the Daily\'s record, medal and streak alone', () => {
    const d = defaultSave('Nico');
    const daily = JSON.stringify(d.daily);
    const r = settleRun(d, summary(), null, key, T);
    expect(JSON.stringify(d.daily)).toBe(daily);
    expect(r.daily).toBeUndefined();
  });

  it('words its line as the Daily\'s', () => {
    expect(dailyLine(3, T, 'Cup')).toBe('Cup: Gold.');
    expect(dailyLine(1, T)).toBe('Daily: Bronze. Silver at 2:20.0.');
  });
});

class Mem {
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

describe('pruning', () => {
  function stored(over: Partial<SaveData>): SaveData {
    return { ...defaultSave('Nico'), ...over };
  }
  const bestRun = { score: 1, distance: 2, record: '' };

  it('drops other weeks\' entries the way the Daily drops other days\'', () => {
    const d = stored({ best: { [`cup:${WEEK}`]: bestRun, 'cup:2026-W44': bestRun, 'daily:2026-11-05': bestRun, pinecrest: bestRun }, runTimes: { [`cup:${WEEK}`]: [140], 'cup:2026-W44': [150] } });
    pruneDaily(d, TODAY);
    expect(Object.keys(d.best).sort()).toEqual([`cup:${WEEK}`, 'pinecrest'].sort());
    expect(Object.keys(d.runTimes!)).toEqual([`cup:${WEEK}`]);
  });

  it('keeps this week\'s Cup through a load, and drops last week\'s', () => {
    const keep = new SaveStore(new Mem({ v: 1, name: 'Nico', cup: { key: WEEK, best: 140, medal: 2, extra: 'kept' } }), 'F', TODAY).data;
    expect(keep.cup).toEqual({ key: WEEK, best: 140, medal: 2, extra: 'kept' });
    const gone = new SaveStore(new Mem({ v: 1, name: 'Nico', cup: { key: '2026-W44', best: 140, medal: 2 } }), 'F', TODAY).data;
    expect(gone.cup).toBeUndefined();
  });

  it('reads a broken Cup record as none, and never throws', () => {
    for (const cup of [null, 7, 'x', [], {}, { key: 3 }]) expect(new SaveStore(new Mem({ v: 1, name: 'Nico', cup }), 'F', TODAY).data.cup).toBeUndefined();
    const odd = new SaveStore(new Mem({ v: 1, name: 'Nico', cup: { key: WEEK, best: 'fast', medal: 9 } }), 'F', TODAY).data;
    expect(odd.cup).toEqual({ key: WEEK, best: 0, medal: 3 });
  });
});
