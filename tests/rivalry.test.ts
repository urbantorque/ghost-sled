import { describe, expect, it } from 'vitest';
import { type FieldInput, type FieldPick, pickField, rivalOf } from '../src/game/field';
import type { PoolGhostData } from '../src/game/ghostdata';
import { dailyHook, resultsRaceLine, runAgainLabel } from '../src/game/progress';
import { callPick } from '../src/game/race';
import { FINISH_Z } from '../src/game/standing';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { recordToString } from '../src/sim/replay';

// One rival for the run: named at the start, read on every stage line, and on the results what decided
// it. Rematch always names who is about to ride, so whoever it names has to ride.

function fin(time: number, o: Partial<PoolGhostData> = {}): PoolGhostData {
  const name = `f${time}`;
  return { name, score: 1000, distance: FINISH_Z + 120, ticks: 18000, finishTick: Math.round(time * 60), sled: 0, mood: 0, event: 0, record: `rec-${name}`, ...o };
}

function rec(distance: number, ticks: number, name: string): string {
  return recordToString({ seed: 1, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 1 }, sled: 0, inputs: new Uint8Array([4, 4]), ticks, score: 100, distance, name });
}

const POOL = Array.from({ length: 60 }, (_, i) => fin(100 + i * 4));

function input(p: Partial<FieldInput> = {}): FieldInput {
  return { pool: POOL, kind: 'pool', mood: Mood.None, event: ChaosEvent.None, count: 5, anchor: 200, seed: 7, bestScore: 0, you: null, grudge: null, friend: null, ...p };
}

const rivals = (out: FieldPick[]) => out.filter((p) => p.rival);

describe('the rival', () => {
  it('is the field ghost right ahead of you: the one just quicker than your anchor', () => {
    const out = pickField(input());
    expect(rivals(out)).toHaveLength(1);
    const quicker = out.filter((p) => p.time! < 200).map((p) => p.time!);
    expect(rivals(out)[0].time).toBe(Math.max(...quicker));
  });

  it('is one rider in every field, and never your own best', () => {
    for (let seed = 1; seed < 40; seed++) {
      const out = pickField(input({ seed, anchor: 110 + seed * 5, you: { name: 'Me', score: 90, distance: FINISH_Z, record: rec(FINISH_Z, 200 * 60, 'Me') } }));
      expect(rivals(out), `seed ${seed}`).toHaveLength(1);
      expect(rivals(out)[0].kind).not.toBe('you');
    }
  });

  it('takes the quickest rider when nobody is quicker than you', () => {
    const out: FieldPick[] = [
      { name: 'a', kind: 'pool', score: 1, record: 'a', time: 150, distance: FINISH_Z },
      { name: 'b', kind: 'pool', score: 1, record: 'b', time: 140, distance: FINISH_Z },
    ];
    expect(rivalOf(out, 100)?.name).toBe('b');
  });

  it('prefers a finisher: a rider who crashes is gone by the last line', () => {
    const out: FieldPick[] = [
      { name: 'wreck', kind: 'pool', score: 1, record: 'a', time: 195, distance: 2000 },
      { name: 'finisher', kind: 'pool', score: 1, record: 'b', time: 180, distance: FINISH_Z },
    ];
    expect(rivalOf(out, 200)?.name).toBe('finisher');
  });

  it('is your grudge when one rides, and a friend over that', () => {
    const grudge = { name: 'Mila', score: 900, record: rec(FINISH_Z, 190 * 60, 'Mila'), distance: FINISH_Z };
    const friend = { name: 'Tove', score: 800, record: rec(FINISH_Z, 195 * 60, 'Tove') };
    expect(rivals(pickField(input({ grudge })))[0]).toMatchObject({ name: 'Mila', kind: 'grudge' });
    expect(rivals(pickField(input({ grudge, friend })))[0]).toMatchObject({ name: 'Tove', kind: 'friend' });
  });

  it('is nobody in an empty field', () => {
    expect(rivalOf([], 200)).toBeNull();
  });
});

describe('the rider Run Again names', () => {
  const promised = { name: 'Rook', score: 700, record: rec(FINISH_Z, 196 * 60, 'Rook') };

  it('rides, whoever the field would have picked, and is the rival', () => {
    const out = pickField(input({ promised }));
    expect(out.filter((p) => p.record === promised.record)).toHaveLength(1);
    expect(rivals(out)[0].name).toBe('Rook');
    expect(out.filter((p) => p.kind === 'pool').length).toBe(5);
  });

  it('is not doubled when the field had it already', () => {
    const pick = pickField(input())[0];
    const out = pickField(input({ promised: { name: pick.name, score: pick.score, record: pick.record } }));
    expect(out.filter((p) => p.record === pick.record)).toHaveLength(1);
  });

  it('rides off a mood the field would have refused it', () => {
    const record = recordToString({ seed: 1, chaos: { mood: Mood.Comet, event: ChaosEvent.None, seed: 1 }, sled: 0, inputs: new Uint8Array([4, 4]), ticks: 190 * 60, score: 100, distance: FINISH_Z, name: 'Comet' });
    expect(pickField(input({ mood: Mood.None, promised: { name: 'Comet', score: 700, record } })).some((p) => p.name === 'Comet')).toBe(true);
  });

  it('is dropped quietly if its record no longer rides', () => {
    const out = pickField(input({ promised: { name: 'Gone', score: 1, record: 'not-a-record' } }));
    expect(out.some((p) => p.name === 'Gone')).toBe(false);
    expect(rivals(out)).toHaveLength(1);
  });

  it('never rides your own best twice', () => {
    const record = rec(FINISH_Z, 196 * 60, 'Me');
    const out = pickField(input({ promised: { name: 'Me', score: 90, record }, you: { name: 'Me', score: 90, distance: FINISH_Z, record } }));
    expect(out.filter((p) => p.record === record)).toHaveLength(1);
  });
});

describe('the start-line call', () => {
  const pace = { id: 1, kind: 'pool' as const, role: 'pace' as const, ready: true };
  const you = { id: 2, kind: 'you' as const, ready: true };
  const rival = { id: 3, kind: 'pool' as const, role: 'pack' as const, ready: true, rival: true };

  it('names the rival over your best and the pace rider', () => {
    expect(callPick([pace, you, rival], 900)).toEqual({ id: 3, word: 'Chase' });
  });

  it('still gives way to a grudge or a friend', () => {
    expect(callPick([rival, { id: 4, kind: 'grudge', ready: true }], 900)).toEqual({ id: 4, word: 'Rematch' });
    expect(callPick([rival, { id: 5, kind: 'friend', ready: true }], 900)).toEqual({ id: 5, word: 'Racing' });
  });

  it('waits for the rival to load rather than settle for a lesser ghost', () => {
    expect(callPick([pace, { ...rival, ready: false }], 0)).toBeNull();
  });
});

describe('Run Again', () => {
  it('names a rider who rode as a rematch, and one new to you as a race', () => {
    expect(runAgainLabel(null, null, { name: 'Rook', rode: true })).toEqual({ text: 'Rematch Rook', aria: 'Rematch Rook, run again' });
    expect(runAgainLabel(null, null, { name: 'Rook', rode: false })).toEqual({ text: 'Race Rook', aria: 'Race Rook, run again' });
  });

  it('keeps a friend and a grudge first', () => {
    expect(runAgainLabel({ name: 'Mila', beaten: false }, { name: 'Tess' }, { name: 'Rook', rode: true }).text).toBe('Rematch Mila');
    expect(runAgainLabel({ name: 'Mila', beaten: true }, { name: 'Tess' }, { name: 'Rook', rode: true }).text).toBe('Rematch Tess');
    expect(runAgainLabel({ name: 'Mila', beaten: true }, null, { name: 'Rook', rode: true }).text).toBe('Rematch Rook');
  });

  it('keeps the whole name for readers when the button cuts it', () => {
    const r = runAgainLabel(null, null, { name: 'KestrelHailstone', rode: false });
    expect(r.text).toBe('Race KestrelHail…');
    expect(r.aria).toBe('Race KestrelHailstone, run again');
  });

  it('says Run Again only with nobody to name', () => {
    expect(runAgainLabel(null, null, null).text).toBe('Run Again');
    expect(runAgainLabel(null, null).text).toBe('Run Again');
  });
});

describe('the one line on the results', () => {
  const base = { friend: null, grudge: null, event: null };
  const rung = '1.6 s from Tess and Rank 2.';
  const gold = '0.4 s from gold in Stage 2.';
  const decided = { text: 'You lost 2.1 s to Mila in Stage 2.', grudge: true, friend: false };
  const plain = { text: 'Mila beat you by 1.2 s. Mila will be waiting.', strong: false };
  const settled = { text: 'Grudge settled with Mila.', strong: true };

  it('keeps the old order over the hooks: friend, Daily, then a settled grudge', () => {
    expect(resultsRaceLine({ ...base, friend: 'You beat Mila by 1.2 s.', rung, gold })?.tone).toBe('friend');
    expect(resultsRaceLine({ ...base, daily: 'Daily: Silver.', rung, gold })?.text).toBe('Daily: Silver.');
    expect(resultsRaceLine({ ...base, grudge: settled, rung, gold })?.text).toBe(settled.text);
  });

  it('then runs the hooks in the brief\'s order: a rung, a gold, a grudge, the Daily', () => {
    const all = { ...base, grudge: plain, rung, gold, dailyOpen: "Today's Daily is still open." };
    expect(resultsRaceLine(all)).toEqual({ text: rung, tone: 'rung' });
    expect(resultsRaceLine({ ...all, rung: null })).toEqual({ text: gold, tone: 'medal' });
    expect(resultsRaceLine({ ...all, rung: null, gold: null })).toEqual({ text: plain.text, tone: 'grudge' });
    expect(resultsRaceLine({ ...all, rung: null, gold: null, grudge: null })?.text).toBe("Today's Daily is still open.");
  });

  it('never stacks: one result, whatever is true', () => {
    const r = resultsRaceLine({ friend: 'a', daily: 'b', grudge: settled, crash: 'c', event: 'd', rung, gold, decided, dailyOpen: 'e' });
    expect(r?.text).toBe('a');
  });

  it('lets what decided it stand in for the plain grudge line, in the rider\'s colour', () => {
    expect(resultsRaceLine({ ...base, grudge: plain, decided })).toEqual({ text: decided.text, tone: 'grudge' });
    expect(resultsRaceLine({ ...base, decided: { ...decided, grudge: false } })?.tone).toBe('rung');
    expect(resultsRaceLine({ ...base, decided: { ...decided, grudge: false, friend: true } })?.tone).toBe('friend');
  });

  it('keeps the crash and event notes over what decided it: the wreck is what decided that', () => {
    expect(resultsRaceLine({ ...base, crash: 'Led at the crash.', decided })?.tone).toBe('crash');
    expect(resultsRaceLine({ ...base, event: 'The yeti was 130 m away.', decided })?.tone).toBe('event');
  });

  it('asks you to ride the Daily only while it is open, and names a streak at stake', () => {
    expect(dailyHook(0, false)).toBe("Today's Daily is still open.");
    expect(dailyHook(1, false)).toBe("Today's Daily is still open.");
    expect(dailyHook(3, false)).toBe("Ride today's Daily to keep your 3 day streak.");
    expect(dailyHook(3, true)).toBeNull();
  });
});
