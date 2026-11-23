import { describe, expect, it } from 'vitest';
import type { ResultsGhost, ResultsModel, RewardCard } from '../src/ui/contract';
import { rankBar } from '../src/game/spineview';
import { STORY_TIMING, barSegments, fillPlan, nearLine, storyButton, storyReward } from '../src/ui/sequence';

// The results in three beats (round 9, U2): how you did, the one reward that matters most turned over with Rider
// Rank's bar at its foot, and the one button with its reason, in about 2.5 s. These pin the story's arithmetic: what
// each beat says and when it lands.

const FINISH_Z = 4500;
const plain = (t: string | null): string | null => (t === null ? null : t.replace(/ /g, ' '));

function ghost(name: string, time: number | null, distance = FINISH_Z + 60, kind: ResultsGhost['kind'] = 'pool'): ResultsGhost {
  return { name, kind, score: 1000, time, distance, passed: false };
}

function model(over: Partial<ResultsModel> = {}): ResultsModel {
  return {
    score: 12000,
    distance: FINISH_Z + 40,
    finishZ: FINISH_Z,
    finish: { seconds: 171.4, medal: 0, splits: [], bestTime: null, newBest: false },
    best: 0,
    newBest: false,
    giftsEarned: 40,
    wallet: 400,
    ghosts: [],
    ghostsPassed: 0,
    missions: [],
    crashCause: '',
    bestCombo: 0,
    perfects: 0,
    maxAir: 0,
    mountain: 'Pinecrest',
    mood: '',
    canRevive: false,
    canDouble: false,
    doubled: false,
    canChallenge: false,
    unlocked: [],
    ...over,
  };
}

describe('the nearest rider', () => {
  it('names the rider just ahead and the margin as the rows read', () => {
    const n = nearLine(model({ ghosts: [ghost('Rook', 166.8), ghost('Old Wren', 171.0), ghost('Mika', 175.2)] }));
    expect(n).toMatchObject({ side: 'behind', name: 'Old Wren' });
    expect(plain(n!.gap)).toBe('0.4 s');
  });

  it('a winner is told how far clear of the next', () => {
    const n = nearLine(model({ ghosts: [ghost('Mika', 173.2), ghost('Rook', 180)] }));
    expect(n).toMatchObject({ side: 'clear', name: 'Mika' });
    expect(plain(n!.gap)).toBe('1.8 s');
  });

  it('a rider who stopped short of a finisher above is told how far short of the line', () => {
    const n = nearLine(model({ finish: null, distance: 3212, ghosts: [ghost('Rook', 166.8)] }));
    expect(n?.side).toBe('short');
    expect(plain(n!.gap)).toBe('1,288 m');
  });

  it('between riders who did not finish, metres', () => {
    const n = nearLine(model({ finish: null, distance: 2140, ghosts: [ghost('Juniper', null, 2310, 'grudge'), ghost('Mika', null, 1980)] }));
    expect(n).toMatchObject({ side: 'behind', name: 'Juniper', kind: 'grudge' });
    expect(plain(n!.gap)).toBe('170 m');
  });

  it('says nothing with nobody to race', () => {
    expect(nearLine(model())).toBeNull();
  });
});

describe('the rank bar', () => {
  it('fills within a page and stops short of the next', () => {
    const segs = barSegments(rankBar(2100), rankBar(2610));
    expect(segs).toHaveLength(1);
    expect(segs[0].page).toBe(rankBar(2100).page);
    expect(segs[0].to).toBeLessThan(1);
    expect(segs[0].to).toBeGreaterThan(segs[0].from);
  });

  it('a page turned fills to the top, then on from empty on the next page', () => {
    const before = rankBar(1900);
    const after = rankBar(2400);
    expect(after.page).toBe(before.page + 1);
    const segs = barSegments(before, after);
    expect(segs.map((s) => s.page)).toEqual([before.page, after.page]);
    expect(segs[0].to).toBe(1);
    expect(segs[1].from).toBe(0);
  });

  it('shows at most two whole pages between, however many a returning save opens', () => {
    const segs = barSegments(rankBar(0), rankBar(12000));
    expect(segs.length).toBeLessThanOrEqual(4);
    expect(segs[segs.length - 1].page).toBe(rankBar(12000).page);
  });

  it('nothing moved, nothing fills', () => {
    expect(barSegments(rankBar(500), rankBar(500))).toEqual([]);
  });
});

describe('the timeline', () => {
  it('lands in about 2.5 s, every beat in order, the fill between the card and the button', () => {
    const T = STORY_TIMING;
    expect(T.FIGURE_MS).toBeLessThan(T.WORD_MS);
    expect(T.WORD_MS).toBeLessThan(T.FACT_MS);
    expect(T.FACT_MS).toBeLessThan(T.CARD_MS);
    expect(T.CARD_MS).toBeLessThan(T.FILL_AT);
    expect(T.FILL_AT + T.FILL_MS).toBeLessThan(T.BUTTON_MS);
    expect(T.BUTTON_MS).toBeLessThan(T.FOOT_MS);
    expect(T.END_MS).toBeGreaterThan(T.FOOT_MS);
    expect(T.END_MS).toBeLessThanOrEqual(2600);
  });

  it('shares the fill between its stretches by their length, inside the one stretch of time', () => {
    const plan = fillPlan(barSegments(rankBar(1900), rankBar(2400)));
    expect(plan[0].at).toBe(STORY_TIMING.FILL_AT);
    expect(plan[1].at).toBe(plan[0].at + plan[0].ms);
    const end = plan[plan.length - 1].at + plan[plan.length - 1].ms;
    expect(end).toBeLessThanOrEqual(STORY_TIMING.FILL_AT + STORY_TIMING.FILL_MS + 120);
  });
});

describe('the one reward', () => {
  const page = (n: number, kind: RewardCard['kind'], name: string): RewardCard => ({ kind, name, page: n, chapter: null });

  it('a mountain first', () => {
    const r = storyReward(model({ unlockedMountains: [{ id: 'ember', name: 'Ember Peak', biome: 'volcanic', tagline: '' }], spine: { ...spineStub(), opened: [page(4, 'charm', 'Charm: Ember Step')] } }));
    expect(r).toMatchObject({ kind: 'mountain', mountain: { id: 'ember' } });
  });

  it('else the page prize that changes play most, named in words by the rank the bar reached', () => {
    const r = storyReward(model({ spine: { ...spineStub(5), opened: [page(4, 'charm', 'Charm: Kite String'), page(5, 'sled', 'A new sled')] } }));
    expect(r).toMatchObject({ kind: 'prize', name: 'A new sled', kicker: 'Reached Rider Rank 5' });
    const c = storyReward(model({ spine: { ...spineStub(5), opened: [page(4, 'charm', 'Charm: Kite String')] } }));
    expect(c).toMatchObject({ name: 'The Kite String charm' });
  });

  it('a system met for the first time says what it is, in one line', () => {
    const r = storyReward(model({ spine: { ...spineStub(2), opened: [page(2, 'feature', 'Daily contracts')] } }));
    expect(r).toMatchObject({ name: 'Daily contracts', line: 'Three small goals a day' });
  });

  it('a run that opened nothing turns over the bar alone', () => {
    expect(storyReward(model({ spine: spineStub() }))).toBeNull();
  });
});

describe('the one button', () => {
  it('is always the run: a mission is its reason, never "Finish the mission"', () => {
    const b = storyButton(model({ runAgainLabel: { text: 'Run Again', aria: 'Run again' }, spine: { ...spineStub(), primary: { kind: 'mission', text: 'Run Again', sub: 'Mission: ride 800 m in one run. 12 m short', aria: 'Run again' } } }));
    expect(b.label).toBe('Run Again');
    expect(plain(b.why)).toBe('Mission: ride 800 m in one run. 12 m short');
  });

  it('a mountain this run opened is the button when the choice was a plain run again', () => {
    const b = storyButton(model({ unlockedMountains: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', tagline: 'Blue hour, aurora, dawn' }], runAgainLabel: { text: 'Run Again', aria: 'Run again' }, spine: spineStub() }));
    expect(b.label).toBe('Ride Frostfang Glacier');
    const duel = storyButton(model({ unlockedMountains: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', tagline: '' }], runAgainLabel: { text: 'Next Duel: Old Wren', aria: 'Duel Old Wren' }, spine: { ...spineStub(), primary: { kind: 'duel', text: 'Next Duel: Old Wren', sub: 'On Pinecrest, head to head', aria: 'Duel Old Wren' } } }));
    expect(duel.label).toBe('Next Duel: Old Wren');
  });

  it("a rematch's reason is the rival's own time to beat", () => {
    const b = storyButton(model({ ghosts: [ghost('Pip Thistle', 166.1)], runAgainLabel: { text: 'Rematch Pip Thistle', aria: 'Rematch' }, spine: { ...spineStub(), primary: { kind: 'rematch', text: 'Rematch Pip Thistle', sub: '5.3 s behind', aria: 'Rematch' } } }));
    expect(b.why).toBe('2:46.1 to beat');
  });

  it("a Daily's reason is the next medal's mark and how far off it was", () => {
    const b = storyButton(model({ finish: { seconds: 150.2, medal: 1, splits: [], bestTime: null, newBest: false }, raceLine: { text: 'Daily: Bronze. Silver at 2:27.6.', tone: 'event' }, runAgainLabel: { text: 'Run Again', aria: 'Run again' }, spine: spineStub() }));
    expect(plain(b.why)).toBe('Silver at 2:27.6, 2.6 s to find');
  });
});

function spineStub(after = 0): NonNullable<ResultsModel['spine']> {
  return {
    ticks: [],
    before: rankBar(0),
    after: { ...rankBar(0), page: after },
    opened: [],
    stickers: [],
    flame: { lit: false, streak: 0, calendarDay: 0, embered: false, emberEarned: false },
    contracts: { met: [], bonus: false, form: null, today: [], formNext: null },
    league: null,
    primary: { kind: 'again', text: 'Run Again', sub: null, aria: 'Run Again' },
    swap: null,
  };
}
