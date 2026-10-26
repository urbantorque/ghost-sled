import { describe, expect, it } from 'vitest';
import { challengeShareTitle, ellipsize, friendBeatenText, friendLine, nextUnlock, resultsRaceLine, revealGoal, runAgainLabel, titleGreeting } from '../src/game/progress';
import { defaultSave } from '../src/game/save';
import { ChaosEvent } from '../src/sim/chaos';

function returning(p: Partial<ReturnType<typeof defaultSave>> = {}) {
  return { ...defaultSave('Rider'), runs: 3, ...p };
}

describe('title greeting', () => {
  it('says nothing on a first visit', () => {
    expect(titleGreeting(defaultSave('New'), 'pinecrest', 'Pinecrest')).toBeNull();
  });

  it('a grudge on this mountain comes first, a nemesis says so', () => {
    const d = returning({ ghostsPassed: 3 });
    d.grudge.pinecrest = { name: 'Mila', score: 900, record: 'rec' };
    expect(titleGreeting(d, 'pinecrest', 'Pinecrest')).toBe('Mila is waiting on Pinecrest');
    d.grudge.pinecrest.streak = 3;
    expect(titleGreeting(d, 'pinecrest', 'Pinecrest')).toBe('Your nemesis Mila is waiting on Pinecrest');
    // Another mountain's grudge does not greet here; a grudge that can no longer ride does not either.
    expect(titleGreeting(d, 'frostfang', 'Frostfang Glacier')).not.toContain('Mila');
    d.grudge.pinecrest.record = '';
    expect(titleGreeting(d, 'pinecrest', 'Pinecrest')).not.toContain('Mila');
  });

  it('a daily grudge waits on the Daily Mountain', () => {
    const d = returning();
    d.grudge['daily:2026-10-26'] = { name: 'Tess', score: 1, record: 'rec' };
    expect(titleGreeting(d, 'daily:2026-10-26', 'Daily Mountain')).toBe('Tess is waiting on the Daily Mountain');
  });

  it('then the next mountain when 2 ghosts or fewer open it', () => {
    expect(titleGreeting(returning({ ghostsPassed: 2 }), 'pinecrest', 'Pinecrest')).toBe('2 more ghosts open Frostfang Glacier');
    expect(titleGreeting(returning({ ghostsPassed: 3 }), 'pinecrest', 'Pinecrest')).toBe('1 more ghost opens Frostfang Glacier');
    expect(titleGreeting(returning({ ghostsPassed: 11 }), 'pinecrest', 'Pinecrest')).toBe('1 more ghost opens Ember Peak');
  });

  it('then the closest open mission, with how far along it is', () => {
    const d = returning({ ghostsPassed: 5 });
    d.missions.active = [{ id: 'dist800', best: 540.6 }, { id: 'perfect2', best: 1 }, { id: 'pass1', best: 0 }];
    expect(titleGreeting(d, 'pinecrest', 'Pinecrest')).toBe('Ride 800 m in one run: 540 of 800 m');
    d.missions.active[1].best = 1.9;
    d.missions.active[0].best = 0;
    expect(titleGreeting(d, 'pinecrest', 'Pinecrest')).toBe('Land 2 perfect landings: 1 of 2');
    d.missions.active = [{ id: 'air15', best: 1.24 }];
    expect(titleGreeting(d, 'pinecrest', 'Pinecrest')).toBe('Get 1.5 seconds of air: 1.2 of 1.5 s');
    d.missions.active = [{ id: 'pass3', best: 0, tier: 2 }];
    expect(titleGreeting(d, 'pinecrest', 'Pinecrest')).toBe('Pass 4 ghosts in one run (II)');
  });
});

describe('run again label', () => {
  it('rematches an unbeaten friend, else the grudge, else runs again', () => {
    expect(runAgainLabel({ name: 'Mila', beaten: false }, { name: 'Tess' })).toEqual({ text: 'Rematch Mila', aria: 'Rematch Mila, run again' });
    expect(runAgainLabel({ name: 'Mila', beaten: true }, { name: 'Tess' })).toEqual({ text: 'Rematch Tess', aria: 'Rematch Tess, run again' });
    expect(runAgainLabel({ name: 'Mila', beaten: true }, null)).toEqual({ text: 'Run Again', aria: 'Run Again' });
    expect(runAgainLabel(null, null)).toEqual({ text: 'Run Again', aria: 'Run Again' });
  });

  it('ellipsizes a long name on the button and keeps it whole in the accessible name', () => {
    const r = runAgainLabel(null, { name: 'KestrelHailstone' });
    expect(r.text).toBe('Rematch KestrelHail…');
    expect([...r.text.slice('Rematch '.length)]).toHaveLength(12);
    expect(r.aria).toBe('Rematch KestrelHailstone, run again');
    expect(ellipsize('Exactly12chr')).toBe('Exactly12chr');
  });
});

describe('results race line', () => {
  it('shows one line by priority: friend, then grudge, then event note', () => {
    expect(resultsRaceLine('You beat Mila by 120 m.', 'Tess beat you by 3 m. Tess will be waiting.', 'The yeti was 220 m away.')).toEqual({ text: 'You beat Mila by 120 m.', tone: 'friend' });
    expect(resultsRaceLine(null, 'Tess beat you by 3 m. Tess will be waiting.', 'The yeti was 220 m away.')).toEqual({ text: 'Tess beat you by 3 m. Tess will be waiting.', tone: 'grudge' });
    expect(resultsRaceLine(null, null, 'The yeti was 220 m away.')).toEqual({ text: 'The yeti was 220 m away.', tone: 'event' });
    expect(resultsRaceLine(null, null, null)).toBeNull();
  });

  it('friend lines read in race-gap grammar', () => {
    expect(friendLine('Mila', 2340, 2460)).toBe('You beat Mila by 120 m.');
    expect(friendLine('Mila', 2340, 2000)).toBe('Mila is 340 m ahead.');
    expect(friendBeatenText('Mila', 2340)).toBe("Beat Mila's 2,340 m");
  });
});

describe('next unlock', () => {
  it('moves from the next mountain to the next sled to nothing', () => {
    expect(nextUnlock({ ...defaultSave('A'), ghostsPassed: 2 })).toEqual({ kind: 'mountain', name: 'Frostfang Glacier', biome: 'glacier', have: 2, need: 4 });
    expect(nextUnlock({ ...defaultSave('A'), ghostsPassed: 13 })).toEqual({ kind: 'mountain', name: 'Sakura Ridge', biome: 'blossom', have: 13, need: 24 });
    expect(nextUnlock({ ...defaultSave('A'), ghostsPassed: 30, gifts: 50 })).toEqual({ kind: 'sled', name: 'Whirl Saucer', gifts: 70 });
    expect(nextUnlock({ ...defaultSave('A'), ghostsPassed: 30, gifts: 500, ownedSleds: [0, 1] })).toEqual({ kind: 'sled', name: 'Lodge Toboggan', gifts: 0 });
    expect(nextUnlock({ ...defaultSave('A'), ghostsPassed: 30, ownedSleds: [0, 1, 2, 3, 4, 5] })).toBeNull();
  });
});

describe('challenge share title and reveal goal', () => {
  it('answers a friend back, or opens a challenge', () => {
    expect(challengeShareTitle('Mila', 2340, 'Pinecrest', 120)).toBe('Mila, I beat your 2,340 m on Pinecrest by 120 m. Your move.');
    expect(challengeShareTitle('Me', 1810, 'Frostfang Glacier', null)).toBe('Beat my 1,810 m on Frostfang Glacier in Ghost Sled');
    expect(challengeShareTitle('Mila', 900, 'Daily Mountain', 40)).toBe('Mila, I beat your 900 m on the Daily Mountain by 40 m. Your move.');
    expect(challengeShareTitle('Me', 0, 'Pinecrest', null)).toBe('Beat my Ghost Sled run');
  });

  it('names what each event pays', () => {
    expect(revealGoal(ChaosEvent.Avalanche)).toBe('Outrun it: +2,000');
    expect(revealGoal(ChaosEvent.Yeti)).toBe('Hop it: +1,500');
    expect(revealGoal(ChaosEvent.GiftStorm)).toBe('Catch all 48');
    expect(revealGoal(ChaosEvent.GhostTrain)).toBe('Ride its slipstream');
    expect(revealGoal(ChaosEvent.None)).toBeNull();
  });
});
