import { describe, expect, it } from 'vitest';
import { challengeShareTitle, crashLine, ellipsize, eventNote, friendBeatenText, friendLine, liveMissionViews, livePassed, nextUnlock, resultsRaceLine, revealGoal, runAgainLabel, titleGreeting, unlockCrossed, unlockTease } from '../src/game/progress';
import type { MissionState, RunSummary } from '../src/game/missions';
import { defaultSave } from '../src/game/save';
import { progFigures } from '../src/ui/fmt';
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
  it('shows one line by priority: friend, Daily medal, settled or nemesis grudge, crash, event note, other grudge', () => {
    const tess = { text: 'Tess beat you by 3 m. Tess will be waiting.', strong: false };
    const settled = { text: 'Grudge settled with Tess.', strong: true };
    const daily = 'Daily: Bronze. Silver at 2,916 m.';
    const yeti = 'The yeti was 220 m away.';
    const crash = 'You led at the crash. Mila rode on past.';
    expect(resultsRaceLine({ friend: 'You beat Mila by 120 m.', daily, grudge: settled, crash, event: yeti })).toEqual({ text: 'You beat Mila by 120 m.', tone: 'friend' });
    expect(resultsRaceLine({ friend: null, daily, grudge: settled, crash, event: yeti })).toEqual({ text: daily, tone: 'event' });
    expect(resultsRaceLine({ friend: null, grudge: settled, crash, event: yeti })).toEqual({ text: settled.text, tone: 'grudge' });
    // Why the card's place is not the HUD's: the crash line outranks the event note and a fresh grudge.
    expect(resultsRaceLine({ friend: null, grudge: tess, crash, event: yeti })).toEqual({ text: crash, tone: 'crash' });
    // A fresh grudge line exists after almost every run: the event note outranks it.
    expect(resultsRaceLine({ friend: null, grudge: tess, crash: null, event: yeti })).toEqual({ text: yeti, tone: 'event' });
    expect(resultsRaceLine({ friend: null, grudge: tess, event: null })).toEqual({ text: tess.text, tone: 'grudge' });
    expect(resultsRaceLine({ friend: null, daily: null, grudge: null, event: null })).toBeNull();
  });

  it('friend lines read in race-gap grammar, a loss in the past tense, with the rows as shown', () => {
    expect(friendLine('Mila', 2340, 2460)).toBe('You beat Mila by 120 m.');
    expect(friendLine('Mila', 2340, 2000)).toBe('Mila beat you by 340 m.');
    // Rows of 760 m and 753 m: 7 m, never the raw gap's 8 m.
    expect(friendLine('fjord348', 759.6, 752.5)).toBe('fjord348 beat you by 7 m.');
    expect(friendLine('fjord348', 752.4, 760.4)).toBe('You beat fjord348 by 8 m.');
    // Both rows read the same distance: less than a metre in it.
    expect(friendLine('Mila', 500.2, 500.1)).toBe('Mila beat you by less than 1 m.');
    expect(friendLine('Mila', 500.1, 500.3)).toBe('You beat Mila by less than 1 m.');
    expect(friendBeatenText('Mila', 2340)).toBe('Beat Mila\u2019s 2,340 m');
  });
});

describe('the crash line', () => {
  it('says where you stood as you fell and who rode on past: two names, then a count', () => {
    expect(crashLine(1, ['SparkleCedar', 'RidgeUlla'])).toBe('You led at the crash. SparkleCedar and RidgeUlla rode on past.');
    expect(crashLine(1, ['Your best'])).toBe('You led at the crash. Your best rode on past.');
    expect(crashLine(2, ['fox84', 'Your best', 'Mila'])).toBe('2nd at the crash. 3 ghosts rode on past.');
    expect(crashLine(3, ['Mila'])).toBe('3rd at the crash. Mila rode on past.');
    expect(crashLine(11, ['Mila'])).toBe('11th at the crash. Mila rode on past.');
    expect(crashLine(22, ['Mila'])).toBe('22nd at the crash. Mila rode on past.');
  });

  it('is null when nobody rode past (the place held)', () => {
    expect(crashLine(1, [])).toBeNull();
    expect(crashLine(4, [])).toBeNull();
    expect(crashLine(0, ['Mila'])).toBeNull();
  });
});

describe('live missions (the pause card)', () => {
  const sum = (p: Partial<RunSummary> = {}): RunSummary => ({
    mountain: 'pinecrest',
    biome: 'alpine',
    score: 0,
    distance: 0,
    gifts: 0,
    perfects: 0,
    maxAirtime: 0,
    maxHalfTurns: 0,
    flips: 0,
    driftSeconds: 0,
    draftSeconds: 0,
    nearMisses: 0,
    bestCombo: 0,
    maxSpeed: 0,
    smashes: 0,
    gates: 0,
    yetiHop: false,
    outranAvalanche: false,
    ghostsPassed: 0,
    grudgeBeaten: false,
    chaos: false,
    ...p,
  });
  const state = (active: MissionState['active']): MissionState => ({ active, cursor: 3, completed: 0 });
  const alpine = { unlockedBiomes: new Set(['alpine']) };

  it('shows the active missions in order, each at the better of its stored best and this run', () => {
    const s = state([{ id: 'dist800', best: 540 }, { id: 'perfect2', best: 1 }, { id: 'pass1', best: 0 }]);
    const v = liveMissionViews(s, sum({ distance: 312.7, perfects: 1 }), alpine, new Set());
    expect(v.map((x) => x.id)).toEqual(['dist800', 'perfect2', 'pass1']);
    expect(v[0]).toMatchObject({ text: 'Ride 800 m in one run', progress: 540, target: 800, done: false });
    expect(v[1]).toMatchObject({ progress: 1, target: 2, done: false });
    const w = liveMissionViews(s, sum({ distance: 753, perfects: 2 }), alpine, new Set());
    expect(w[0]).toMatchObject({ progress: 753, done: false });
    // Reached its target this run: done.
    expect(w[1]).toMatchObject({ progress: 2, done: true });
    // Display only: the save's mission state is untouched.
    expect(s.active[0].best).toBe(540);
  });

  it('marks a mission that popped this run done, and counts a biome mission only on its open biome', () => {
    const s = state([{ id: 'pass1', best: 0 }, { id: 'smash3', best: 1 }, { id: 'gates3', best: 0 }]);
    const v = liveMissionViews(s, sum({ smashes: 2, gates: 3 }), alpine, new Set(['pass1']));
    expect(v[0]).toMatchObject({ id: 'pass1', done: true, progress: 1 });
    expect(v[1]).toMatchObject({ id: 'smash3', progress: 2, done: false });
    // Spirit gates count on the blossom mountain only: here the stored best stands.
    expect(v[2]).toMatchObject({ id: 'gates3', progress: 0, done: false });
    // On a locked biome its own metric does not count either.
    const locked = liveMissionViews(s, sum({ biome: 'blossom', gates: 3 }), alpine, new Set());
    expect(locked[2]).toMatchObject({ progress: 0, done: false });
    const open = liveMissionViews(s, sum({ biome: 'blossom', gates: 3 }), { unlockedBiomes: new Set(['alpine', 'blossom']) }, new Set());
    expect(open[2]).toMatchObject({ progress: 3, done: true });
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
    expect(revealGoal(ChaosEvent.Avalanche)).toBe('Outrun it: +2,000 style');
    expect(revealGoal(ChaosEvent.Yeti)).toBe('Hop it: +1,500 style');
    expect(revealGoal(ChaosEvent.GiftStorm)).toBe('Catch all 48 gifts');
    expect(revealGoal(ChaosEvent.GhostTrain)).toBe('Ride its slipstream');
    expect(revealGoal(ChaosEvent.None)).toBeNull();
  });
});

describe('mid-run unlocks and event notes', () => {
  it('counts this run live, minus what a revive already settled', () => {
    expect(livePassed(3, 2, 0)).toBe(5);
    expect(livePassed(5, 2, 2)).toBe(5);
    expect(livePassed(5, 3, 2)).toBe(6);
    expect(livePassed(5, 0, 2)).toBe(5);
  });

  it('pops the mountain a pass just opened, once', () => {
    expect(unlockCrossed(3, 4)).toEqual({ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier' });
    expect(unlockCrossed(4, 5)).toBeNull();
    expect(unlockCrossed(4, 4)).toBeNull();
    expect(unlockCrossed(11, 13)?.name).toBe('Ember Peak');
  });

  it('teases the next mountain with one ghost to go', () => {
    expect(unlockTease(3)).toBe('1 more ghost opens Frostfang Glacier');
    expect(unlockTease(2)).toBeNull();
    expect(unlockTease(23)).toBe('1 more ghost opens Sakura Ridge');
    expect(unlockTease(30)).toBeNull();
  });

  it('names an event the run never reached, with its distance', () => {
    expect(eventNote(ChaosEvent.Yeti, 220.4)).toBe('The yeti was 220 m away.');
    expect(eventNote(ChaosEvent.GhostTrain, 1340)).toBe('The Spirit Train was 1,340 m away.');
    expect(eventNote(ChaosEvent.None, 200)).toBeNull();
    expect(eventNote(ChaosEvent.Avalanche, 0.2)).toBeNull();
  });
});
describe('mission progress figures', () => {
  it('floors the progress and reads a mission in seconds in tenths', () => {
    expect(progFigures(799.6, 800)).toEqual(['799', '800']);
    expect(progFigures(1.9, 2, 1)).toEqual(['1.9', '2']);
    expect(progFigures(1.25, 1.5)).toEqual(['1.2', '1.5']);
    expect(progFigures(4.96, 5, 1)).toEqual(['4.9', '5']);
    expect(progFigures(2, 2, 1)).toEqual(['2', '2']);
    expect(progFigures(1240, 2000)).toEqual(['1,240', '2,000']);
  });
});
