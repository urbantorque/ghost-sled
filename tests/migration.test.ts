import { describe, expect, it } from 'vitest';
import { oldLinkLine, readChallengeLink, targetZ } from '../src/game/challenge';
import { anchorFor, pickField } from '../src/game/field';
import { runAgainLabel } from '../src/game/progress';
import { boardOf, medalsHeld, spotOn } from '../src/game/ladder';
import { SAVE_KEY, type Climb, type SaveData, SaveStore, oldBest, recordOk, retireGrudge, rideableGrudge } from '../src/game/save';
import { settleBest, settleGrudge, settleRun, topScore } from '../src/game/settle';
import { FINISH_Z } from '../src/game/standing';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { MOUNTAINS } from '../src/sim/mountains';
import { encodeRecord, headerFromString, type RunRecord, recordFromString, recordToString, toBase64Url } from '../src/sim/replay';
import { SIM_VERSION } from '../src/sim/sim';

// The owner's call: a clean break that erases nothing. A save holding SIM_VERSION 5 records keeps every
// figure it had, and a new course starts fresh around them.

const TODAY = '2026-11-06';
const OLD_VERSION = 5;
const PINECREST = MOUNTAINS[0];

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

function run(name: string, score: number, distance: number, seed = PINECREST.seed): RunRecord {
  return { seed, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 7 }, sled: 0, inputs: new Uint8Array([4, 4, 4, 4, 4, 4]), ticks: 2400, score, distance, name };
}

/** A record exactly as a v5 build wrote it: this layout, with 5 in the header. */
function v5(name: string, score: number, distance: number, seed = PINECREST.seed): string {
  const bytes = encodeRecord(run(name, score, distance, seed));
  bytes[3] = OLD_VERSION;
  return toBase64Url(bytes);
}

const BEST_RECORD = v5('Nico', 5400, 2340);
const GRUDGE_RECORD = v5('Tess', 6100, 2980);

/** A real save from the last build: what is on a player's disk today. */
function v5Save(): Record<string, unknown> {
  return {
    v: 1,
    name: 'Nico',
    gifts: 412,
    lifetimeGifts: 1980,
    ghostsPassed: 27,
    runs: 88,
    sled: 2,
    ownedSleds: [0, 1, 2],
    mountain: 'pinecrest',
    best: {
      pinecrest: { score: 5400, distance: 2340, record: BEST_RECORD },
      ember: { score: 3900, distance: 1500, record: v5('Nico', 3900, 1500, MOUNTAINS[2].seed) },
    },
    grudge: {
      pinecrest: { name: 'Tess', score: 6100, record: GRUDGE_RECORD, them: 4, streak: 3, by: 640, distance: 2980 },
    },
    missions: { active: [{ id: 'pass3', best: 2 }, { id: 'gifts20', best: 11 }, { id: 'near4', best: 3 }], cursor: 41, completed: 19, seed: 1234 },
    settings: { master: 0.6, music: 0.5, sfx: 0.75, quality: 'high', hints: true },
    stats: { bestScore: 6400, bestCombo: 3120, longestAir: 2.2, perfects: 90, topSpeed: 38.5, yetiHops: 2, avalanches: 3 },
    hints: { steer: 1, drift: 4, pop: 3, boostPop: 1, stomp: 6 },
    daily: { key: '2026-11-05', best: 2900, medal: 2, streak: 6, last: '2026-11-05' },
    runDists: { pinecrest: [2100, 2340, 1980], ember: [1500] },
  };
}

const load = (raw: unknown = v5Save()): SaveData => new SaveStore(new MemStorage(raw), 'Fallback', TODAY).data;

/** Loads, writes back, and loads what was written, `n` times over. */
function cycle(raw: unknown, n: number): string {
  const s = new MemStorage(raw);
  for (let i = 0; i < n; i++) new SaveStore(s, 'Fallback', TODAY).flush();
  return s.getItem(SAVE_KEY)!;
}

describe('the fixture is what it says', () => {
  it('is a v5 record: this build will not replay it', () => {
    expect(SIM_VERSION).not.toBe(OLD_VERSION);
    expect(() => recordFromString(BEST_RECORD)).toThrow();
    expect(recordOk(BEST_RECORD)).toBe(false);
    expect(headerFromString(BEST_RECORD)).toMatchObject({ simVersion: 5, name: 'Nico', score: 5400, distance: 2340, seed: PINECREST.seed });
  });
});

describe('the archive', () => {
  it('holds every stale record byte for byte, with its figures and tally', () => {
    const d = load();
    expect(d.archive!.best.pinecrest).toEqual({ score: 5400, distance: 2340, record: BEST_RECORD });
    expect(d.archive!.best.pinecrest.record).toBe(BEST_RECORD);
    expect(d.archive!.best.ember.score).toBe(3900);
    expect(d.archive!.grudge.pinecrest).toEqual({ name: 'Tess', score: 6100, record: GRUDGE_RECORD, them: 4, streak: 3, by: 640, distance: 2980 });
    expect(d.archive!.grudge.pinecrest.record).toBe(GRUDGE_RECORD);
  });

  it('keeps fields a build it never knew wrote', () => {
    const raw = v5Save();
    (raw.best as Record<string, Record<string, unknown>>).pinecrest.future = 'kept';
    expect(load(raw).archive!.best.pinecrest.future).toBe('kept');
  });

  it('a second load changes nothing, however many times it goes round', () => {
    const once = cycle(v5Save(), 1);
    expect(cycle(JSON.parse(once), 1)).toBe(once);
    expect(cycle(JSON.parse(once), 5)).toBe(once);
    // A rebind (the SDK's store coming up) reads the same save a second way.
    const s = new MemStorage(JSON.parse(once));
    const store = new SaveStore(s, 'Fallback', TODAY);
    store.rebind(s);
    store.flush();
    expect(s.getItem(SAVE_KEY)).toBe(once);
  });

  it('is never rewritten: a later run leaves it alone', () => {
    const d = load();
    const before = JSON.stringify(d.archive);
    settleBest(d, 'pinecrest', null, { score: 80, distance: 900, time: null, splits: [], record: () => recordToString(run('Nico', 80, 900)) });
    settleRun(d, { mountain: 'pinecrest', biome: 'alpine', score: 80, distance: 900, gifts: 0, perfects: 0, maxAirtime: 0, maxHalfTurns: 0, flips: 0, driftSeconds: 0, draftSeconds: 0, nearMisses: 0, bestCombo: 0, maxSpeed: 0, smashes: 0, gates: 0, yetiHop: false, outranAvalanche: false, ghostsPassed: 0, grudgeBeaten: false, chaos: false, seconds: 40, finished: false, finishSeconds: 0, tumbles: 0, wallRides: 0, grinds: 0 }, null, 'pinecrest');
    expect(JSON.stringify(d.archive)).toBe(before);
  });

  it('is never pruned, Daily entries included', () => {
    const raw = v5Save();
    (raw.best as Record<string, unknown>)['daily:2026-10-01'] = { score: 700, distance: 500, record: v5('Nico', 700, 500) };
    const d = load(raw);
    expect(d.best['daily:2026-10-01']).toBeUndefined();
    expect(d.archive!.best['daily:2026-10-01'].score).toBe(700);
  });

  it('takes in figures an earlier build already blanked', () => {
    const raw = v5Save();
    raw.best = { pinecrest: { score: 5400, distance: 2340, record: '' } };
    raw.grudge = { pinecrest: { name: 'Tess', score: 6100, record: '', them: 4, streak: 3, distance: 2980 } };
    const d = load(raw);
    expect(d.best.pinecrest).toBeUndefined();
    expect(oldBest(d, 'pinecrest')).toEqual({ score: 5400, distance: 2340 });
    expect(d.archive!.grudge.pinecrest).toMatchObject({ name: 'Tess', them: 4 });
    expect(cycle(raw, 3)).toBe(cycle(raw, 1));
  });

  it('never loses a second record to a taken key', () => {
    const d = load();
    const keep = { ...d.archive!.grudge.pinecrest };
    const other = { name: 'Bo', score: 900, record: recordToString(run('Bo', 900, 800)), them: 2, streak: 1 };
    retireGrudge(d, 'pinecrest', other);
    retireGrudge(d, 'pinecrest', other);
    expect(d.archive!.grudge.pinecrest).toEqual(keep);
    expect(d.archive!.grudge['pinecrest#2']).toMatchObject({ name: 'Bo', them: 2 });
    expect(Object.keys(d.archive!.grudge)).toHaveLength(2);
  });
});

describe('a new best on the new course', () => {
  it('clears the slot, so no personal ghost is expected to ride', () => {
    const d = load();
    expect(d.best.pinecrest).toBeUndefined();
    const own = d.best.pinecrest;
    const out = pickField({ pool: [], kind: 'pool', mood: Mood.None, event: ChaosEvent.None, count: 5, anchor: 0, seed: 1, bestScore: own?.score ?? 0, you: own ? { name: d.name, score: own.score, distance: own.distance, record: own.record } : null, grudge: null, friend: null });
    expect(out).toEqual([]);
  });

  it('shows the old figures as Old best until a new one exists', () => {
    const d = load();
    expect(oldBest(d, 'pinecrest')).toEqual({ score: 5400, distance: 2340 });
    expect(oldBest(d, 'frostfang')).toBeNull();
    settleBest(d, 'pinecrest', null, { score: 80, distance: 900, time: null, splits: [], record: () => recordToString(run('Nico', 80, 900)) });
    expect(oldBest(d, 'pinecrest')).toBeNull();
    // Its figures are still in the archive.
    expect(d.archive!.best.pinecrest.score).toBe(5400);
  });

  it('a new run sets a best, however far under the old score', () => {
    const d = load();
    const record = recordToString(run('Nico', 80, 900));
    const out = settleBest(d, 'pinecrest', null, { score: 80, distance: 900, time: null, splits: [], record: () => record });
    expect(out.newTop).toBe(true);
    expect(d.best.pinecrest).toEqual({ score: 80, distance: 900, record, topScore: 80 });
    expect(recordOk(d.best.pinecrest.record)).toBe(true);
  });

  it('then goes by the race order, not the score', () => {
    const d = load();
    const rec = (n: number) => () => recordToString(run('Nico', n, 900));
    settleBest(d, 'pinecrest', null, { score: 9000, distance: 3000, time: null, splits: [], record: rec(1) });
    const at = { ...d.best.pinecrest };
    // A finish beats any distance, on a lower score.
    const fin = settleBest(d, 'pinecrest', at, { score: 4000, distance: FINISH_Z + 80, time: 190, splits: [60, 125, 190], record: rec(2) });
    expect(fin.newTime).toBe(true);
    expect(d.best.pinecrest).toMatchObject({ score: 4000, time: 190, splits: [60, 125, 190], topScore: 9000 });
    // A slower finish with a higher score keeps the ghost and lifts the top score alone.
    const at2 = { ...d.best.pinecrest };
    const slow = settleBest(d, 'pinecrest', at2, { score: 12000, distance: FINISH_Z + 90, time: 200, splits: [], record: rec(3) });
    expect(slow).toEqual({ newTop: true, newTime: false });
    expect(d.best.pinecrest).toMatchObject({ time: 190, topScore: 12000 });
    expect(topScore(d.best.pinecrest)).toBe(12000);
  });
});

describe('a grudge whose replay is stale', () => {
  it('keeps its name and tally', () => {
    expect(load().grudge.pinecrest).toEqual({ name: 'Tess', score: 6100, record: '', them: 4, streak: 3, by: 640, distance: 2980 });
  });

  it('claims no rematch: the button never names a ghost that will not ride', () => {
    const d = load();
    expect(rideableGrudge(d, 'pinecrest')).toBeNull();
    expect(runAgainLabel(null, rideableGrudge(d, 'pinecrest'))).toEqual({ text: 'Run Again', aria: 'Run Again' });
    d.grudge.ember = { name: 'Bo', score: 1, record: recordToString(run('Bo', 1, 900)) };
    expect(runAgainLabel(null, rideableGrudge(d, 'ember')).text).toBe('Rematch Bo');
  });

  it('waits unchanged while nobody is elected', () => {
    const d = load();
    const out = settleGrudge(d.grudge.pinecrest, { youDistance: 900, rode: null, next: null });
    expect(out.grudge).toEqual(d.grudge.pinecrest);
    expect(out.retired).toBeUndefined();
  });

  it('electing a new grudge does not wipe the tally', () => {
    const d = load();
    const out = settleGrudge(d.grudge.pinecrest, { youDistance: 900, rode: null, next: { name: 'Bo', score: 1200, record: recordToString(run('Bo', 1200, 1000)), distance: 1000, kind: 'pool' } });
    expect(out.grudge?.name).toBe('Bo');
    expect(out.retired).toEqual(d.grudge.pinecrest);
    // Its record is already in the archive, from the load: retiring it writes nothing twice.
    const before = JSON.stringify(d.archive);
    retireGrudge(d, 'pinecrest', out.retired!);
    expect(JSON.stringify(d.archive)).toBe(before);
    expect(d.archive!.grudge.pinecrest).toMatchObject({ name: 'Tess', them: 4, streak: 3 });
  });
});

describe('what stays where it was', () => {
  it('drops old run distances from the anchor, and keeps them on the save', () => {
    const d = load();
    expect(d.runDists).toEqual({ pinecrest: [2100, 2340, 1980], ember: [1500] });
    expect(d.runTimes).toEqual({});
    expect(anchorFor(d.runTimes ?? {}, 'pinecrest')).toBe(0);
  });

  it('keeps the Daily medal, streak and last day', () => {
    expect(load().daily).toEqual({ key: '2026-11-05', best: 2900, medal: 2, streak: 6, last: '2026-11-05' });
  });

  it('leaves gifts, sleds, stats, passes and missions untouched', () => {
    const d = load();
    expect(d).toMatchObject({ gifts: 412, lifetimeGifts: 1980, ghostsPassed: 27, runs: 88, sled: 2, ownedSleds: [0, 1, 2] });
    expect(d.stats).toEqual({ bestScore: 6400, bestCombo: 3120, longestAir: 2.2, perfects: 90, topSpeed: 38.5, yetiHops: 2, avalanches: 3 });
    expect(d.missions).toEqual({ active: [{ id: 'pass3', best: 2 }, { id: 'gifts20', best: 11 }, { id: 'near4', best: 3 }], cursor: 41, completed: 19, seed: 1234 });
  });

  it('leaves v6 records alone', () => {
    const raw = v5Save();
    const record = recordToString(run('Nico', 800, 900));
    raw.best = { pinecrest: { score: 800, distance: 900, record, time: 190, splits: [60, 125, 190], topScore: 900 } };
    raw.grudge = { pinecrest: { name: 'Bo', score: 700, record, them: 2, streak: 2, time: 180 } };
    const d = load(raw);
    expect(d.best.pinecrest).toEqual({ score: 800, distance: 900, record, time: 190, splits: [60, 125, 190], topScore: 900 });
    expect(d.grudge.pinecrest).toEqual({ name: 'Bo', score: 700, record, them: 2, streak: 2, time: 180 });
    expect(d.archive).toBeUndefined();
    expect(recordOk(record)).toBe(true);
  });
});

describe('ladders, medals and the Cup on an old save', () => {
  it('loads a save from before them with nothing invented and nothing lost', () => {
    const d = load();
    expect(d.climb).toBeUndefined();
    expect(d.cup).toBeUndefined();
    expect(d.gifts).toBe(412);
    expect(d.daily).toMatchObject({ medal: 2, streak: 6 });
  });

  it('a save with nothing earned keeps its shape: no empty climb or cup written back', () => {
    const once = JSON.parse(cycle(v5Save(), 1)) as Record<string, unknown>;
    expect('climb' in once).toBe(false);
    expect('cup' in once).toBe(false);
  });

  it('reads no medals and no rung for a mountain with no Climb', () => {
    expect(medalsHeld(load().climb?.pinecrest)).toEqual({ stages: [0, 0, 0], run: 0 });
  });

  const climb: Climb = { v: SIM_VERSION, rung: 19, top: true, stages: [3, 2, 0], medal: 1 };

  it('round-trips a Climb and a Cup record exactly', () => {
    const week = '2026-W45';
    const s = new MemStorage({ ...v5Save(), climb: { pinecrest: climb }, cup: { key: week, best: 140.5, medal: 2 } });
    new SaveStore(s, 'Fallback', TODAY).flush();
    const d = new SaveStore(s, 'Fallback', TODAY).data;
    expect(d.climb).toEqual({ pinecrest: climb });
    expect(d.cup).toEqual({ key: week, best: 140.5, medal: 2 });
  });

  it('keeps fields a later build wrote on a Climb', () => {
    expect((load({ ...v5Save(), climb: { pinecrest: { ...climb, future: 'kept' } } }).climb!.pinecrest as unknown as Record<string, unknown>).future).toBe('kept');
  });

  it('moves a Climb from an old course to the archive whole, and that mountain starts clean', () => {
    const old = { v: OLD_VERSION, rung: 2, top: true, stages: [3, 3, 3], medal: 3 };
    const d = load({ ...v5Save(), climb: { pinecrest: old, ember: climb } });
    expect(d.climb).toEqual({ ember: climb });
    expect(d.archive!.climb!.pinecrest).toEqual(old);
  });

  it('never loses the archive\'s Climbs, and a second load changes nothing', () => {
    const old = { v: OLD_VERSION, rung: 2, stages: [1, 0, 0] };
    const once = cycle({ ...v5Save(), climb: { pinecrest: old } }, 1);
    expect(cycle(JSON.parse(once), 3)).toBe(once);
    expect((JSON.parse(once) as SaveData).archive!.climb!.pinecrest).toEqual(old);
  });

  it('reads junk as nothing, clamps what it can, and never throws', () => {
    for (const junk of [null, 7, 'x', [], { pinecrest: 3 }, { pinecrest: null }, { pinecrest: [] }]) expect(() => load({ ...v5Save(), climb: junk })).not.toThrow();
    const d = load({ ...v5Save(), climb: { pinecrest: { v: SIM_VERSION, rung: -4, top: 'yes', stages: [9, -1, 'gold', 2.7], medal: 'gold' } } });
    expect(d.climb!.pinecrest).toEqual({ v: SIM_VERSION, stages: [3, 0, 0, 2] });
  });

  it('a Climb with no sim version is from no pool it can vouch for', () => {
    const d = load({ ...v5Save(), climb: { pinecrest: { rung: 2 } } });
    expect(d.climb).toBeUndefined();
    expect(d.archive!.climb!.pinecrest).toEqual({ rung: 2 });
  });

  it('an old best on the new course holds no rank until a new one exists', () => {
    const d = load();
    const b = boardOf([{ name: 'Mila', score: 1, distance: FINISH_Z + 9, ticks: 9000, finishTick: 7200, sled: 0, mood: 0, event: 0, record: 'x' }]);
    expect(d.best.pinecrest).toBeUndefined();
    expect(spotOn(b, null).rank).toBeNull();
  });
});

describe('old challenge links', () => {
  const link = v5('Mila', 4100, 2340);

  it('an old link yields a target on its mountain, with the friend and the old distance', () => {
    const r = readChallengeLink(link);
    expect(r?.ghost).toBeUndefined();
    expect(r?.old).toEqual({ name: 'Mila', score: 4100, seed: PINECREST.seed, mountain: PINECREST.name, distance: 2340 });
    expect(targetZ(r!.old!)).toBe(2340);
    expect(oldLinkLine(r!.old!)).toBe('Mila rode 2,340 m on the old Pinecrest. Beat it.');
  });

  it('clamps to the finish a distance the new course never reaches', () => {
    const r = readChallengeLink(v5('Mila', 9000, 6120.5));
    expect(oldLinkLine(r!.old!)).toBe('Mila rode 6,121 m on the old Pinecrest. Beat it.');
    expect(targetZ(r!.old!)).toBe(FINISH_Z);
  });

  it('a v6 link still yields a ghost', () => {
    const r = readChallengeLink(recordToString(run('Mila', 4100, 2340)));
    expect(r?.old).toBeUndefined();
    expect(r?.ghost).toMatchObject({ name: 'Mila', score: 4100, distance: 2340, seed: PINECREST.seed });
  });

  it('reads the same however it arrived: both paths hand it over as this one string', () => {
    const viaUrl = new URLSearchParams(`c=${link}`).get('c')!;
    expect(viaUrl).toBe(link);
    expect(readChallengeLink(viaUrl)).toEqual(readChallengeLink(link));
  });

  it('makes nothing up from what is no link, or from a mountain that is gone', () => {
    expect(readChallengeLink('garbage!')).toBeNull();
    expect(readChallengeLink('')).toBeNull();
    expect(readChallengeLink(v5('Mila', 4100, 2340, 12345))).toBeNull();
    // Damaged on this very version: not an old link, and no ghost either.
    const bytes = encodeRecord(run('Mila', 10, 20));
    bytes[27] = 200;
    expect(readChallengeLink(toBase64Url(bytes))).toBeNull();
  });
});
