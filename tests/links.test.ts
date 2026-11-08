import { describe, expect, it } from 'vitest';
import { linkLine, linkMountain, readChallengeLink } from '../src/game/challenge';
import { cupChaos, cupMountain, weekKey } from '../src/game/cup';
import { pickField } from '../src/game/field';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { MOUNTAINS, dailyMountain } from '../src/sim/mountains';
import { type RunRecord, recordToString } from '../src/sim/replay';

// A friend's link opens the course their run was ridden on, or says nothing about a course at all: a
// ghost on the wrong course is the one thing it must never do. A Daily lasts its day and a Cup its week.

const TODAY = '2026-11-06';
const YESTERDAY = '2026-11-05';
const WEEK = weekKey(new Date(Date.UTC(2026, 10, 6)));
const LAST_WEEK = weekKey(new Date(Date.UTC(2026, 9, 30)));

const daily = dailyMountain(TODAY);
const cup = cupMountain(WEEK);
const today = [...MOUNTAINS, daily, cup];

function run(seed: number, over: Partial<RunRecord> = {}): RunRecord {
  return { seed, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 7 }, sled: 0, inputs: new Uint8Array([4, 0]), ticks: 9840, score: 21000, distance: 4500, name: 'Mila', ...over };
}

/** A record the way a link carries it. */
function opened(rec: RunRecord): RunRecord {
  const g = readChallengeLink(recordToString(rec))?.ghost;
  if (!g) throw new Error('no ghost');
  return g;
}

describe('the mountain a link opens', () => {
  it('opens each of the four on its own seed', () => {
    for (const m of MOUNTAINS) expect(linkMountain(opened(run(m.seed)).seed, today)).toBe(m);
  });

  it("opens this week's Cup and today's Daily", () => {
    expect(linkMountain(opened(run(cup.seed)).seed, today)).toBe(cup);
    expect(linkMountain(opened(run(daily.seed)).seed, today)).toBe(daily);
  });

  it("opens nothing for an earlier week's Cup or another day's Daily", () => {
    expect(linkMountain(opened(run(cupMountain(LAST_WEEK).seed)).seed, today)).toBeNull();
    expect(linkMountain(opened(run(dailyMountain(YESTERDAY).seed)).seed, today)).toBeNull();
  });

  it('opens nothing for no link at all', () => {
    expect(linkMountain(undefined, today)).toBeNull();
  });
});

describe('what the title says about it', () => {
  const rec = run(cup.seed);

  it('names who and where on the Cup, with their finish', () => {
    const l = linkLine(rec, today, cup, false);
    expect(l).toMatchObject({ name: 'Mila', mountain: 'the Weekly Cup', distance: 4500, time: 164, waiting: false });
  });

  it('says so while the Cup is still finding its rivals, and keeps the line', () => {
    expect(linkLine(rec, today, cup, true)).toMatchObject({ mountain: 'the Weekly Cup', waiting: true });
  });

  it("names today's Daily, the same way", () => {
    expect(linkLine(run(daily.seed), today, daily, true)).toMatchObject({ mountain: 'the Daily Mountain', daily: true, waiting: true });
  });

  it('names a mountain, which never waits', () => {
    const l = linkLine(run(MOUNTAINS[1].seed), today, MOUNTAINS[1], false);
    expect(l).toMatchObject({ mountain: MOUNTAINS[1].name });
    expect(l?.waiting).toBeUndefined();
  });

  it("shows only the rider for an earlier week's Cup, exactly as for another day's Daily", () => {
    const week = linkLine(run(cupMountain(LAST_WEEK).seed), today, MOUNTAINS[0], false);
    const day = linkLine(run(dailyMountain(YESTERDAY).seed), today, MOUNTAINS[0], false);
    expect(week).toEqual(day);
    expect(week).toEqual({ name: 'Mila', score: 21000, mountain: '', daily: true });
  });

  it('says nothing once Ride would ride another mountain: picked by hand, or a Cup that could not be got ready', () => {
    expect(linkLine(rec, today, MOUNTAINS[0], false)).toBeNull();
    expect(linkLine(run(MOUNTAINS[2].seed), today, MOUNTAINS[0], false)).toBeNull();
  });

  it('gives a run that did not finish no time', () => {
    expect(linkLine(run(cup.seed, { distance: 2340 }), today, cup, false)).toMatchObject({ distance: 2340, time: null });
  });
});

describe('the ride a link opens', () => {
  it("puts the friend's ghost in the Cup's field, on the week's own mood", () => {
    const rec = run(cup.seed, { chaos: cupChaos(WEEK) });
    const chaos = cupChaos(WEEK);
    const field = pickField({ pool: [], kind: 'daily', mood: chaos.mood, event: chaos.event, count: 5, anchor: 0, seed: chaos.seed, bestScore: 0, you: null, grudge: null, friend: { name: rec.name, score: rec.score, record: recordToString(rec) }, promised: null });
    expect(field.filter((p) => p.kind === 'friend').map((p) => p.name)).toEqual(['Mila']);
  });
});
