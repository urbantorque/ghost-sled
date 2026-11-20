import { describe, expect, it } from 'vitest';
import type { ResultsGhost, ResultsModel, RewardCard } from '../src/ui/contract';
import { rankBar } from '../src/game/spineview';
import { MAX_CARDS, SEQ_TIMING, barSegments, namedTicks, nearLine, seqPlan, storyCards } from '../src/ui/sequence';

// The results as a directed sequence (round 8, V8 with G5): the place with the nearest rider named, Rider Rank's bar
// filling short of the next page, what opened turning over, then the one button, in about five seconds. These pin the
// story's arithmetic: what each beat says and when it lands.

const FINISH_Z = 4500;
const plain = (t: string): string => t.replace(/ /g, ' ');

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

describe('the place, with the nearest rider named', () => {
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
    // The page it started on, two whole pages, the page it ended on.
    expect(segs.length).toBeLessThanOrEqual(4);
    expect(segs[segs.length - 1].page).toBe(rankBar(12000).page);
  });

  it('nothing moved, nothing fills', () => {
    expect(barSegments(rankBar(500), rankBar(500))).toEqual([]);
  });
});

describe('the timeline', () => {
  it('lands in about five seconds on a full run, every beat in order', () => {
    const segs = barSegments(rankBar(1900), rankBar(2400));
    const p = seqPlan({ place: true, segments: segs, bar: true, cards: 3 });
    expect(p.place!).toBeLessThan(p.bar!);
    expect(p.fill[0].at).toBeGreaterThan(p.bar!);
    const fillEnd = p.fill[p.fill.length - 1].at + p.fill[p.fill.length - 1].ms;
    expect(p.cards[0]).toBeGreaterThan(fillEnd);
    expect(p.button).toBeGreaterThan(p.cards[p.cards.length - 1]);
    expect(p.end).toBeGreaterThan(4000);
    expect(p.end).toBeLessThan(6000);
  });

  it('a run with nothing opened comes to its button sooner', () => {
    const segs = barSegments(rankBar(2100), rankBar(2610));
    const quiet = seqPlan({ place: true, segments: segs, bar: true, cards: 0 });
    const full = seqPlan({ place: true, segments: segs, bar: true, cards: 2 });
    expect(quiet.button).toBeLessThan(full.button);
    expect(quiet.end).toBeLessThan(4000);
  });

  it('without the spine the button follows the place', () => {
    const p = seqPlan({ place: true, segments: [], bar: false, cards: 0 });
    expect(p.bar).toBeNull();
    expect(p.button).toBeGreaterThanOrEqual(SEQ_TIMING.PLACE_MS);
    expect(p.end).toBeLessThan(2000);
  });
});

describe('what turned over', () => {
  const page = (n: number, name: string): RewardCard => ({ kind: 'charm', name, page: n, chapter: null });

  it('a mountain first, then the pages, then the stickers as one card', () => {
    const cards = storyCards(
      model({
        unlockedMountains: [{ id: 'ember', name: 'Ember Peak', biome: 'volcanic', tagline: '' }],
        spine: { ...spineStub(), opened: [page(4, 'Ember Step')], stickers: [{ id: 'a', name: 'Crane Fold', mountain: '', group: 'trick', hint: '', frame: false }] },
      }),
    );
    expect(cards.map((c) => c.kind)).toEqual(['mountain', 'reward', 'stickers']);
  });

  it('past three, the last slot says how many more wait in Details', () => {
    const cards = storyCards(model({ spine: { ...spineStub(), opened: [page(1, 'A'), page(2, 'B'), page(3, 'C'), page(4, 'D')] } }));
    expect(cards).toHaveLength(MAX_CARDS);
    expect(cards[MAX_CARDS - 1]).toEqual({ kind: 'more', count: 2 });
  });

  it('a page that opens a mountain is not shown twice', () => {
    const cards = storyCards(model({ unlockedMountains: [{ id: 'lanternfall', name: 'Lanternfall', biome: 'lantern', tagline: '' }], spine: { ...spineStub(), opened: [{ kind: 'open', name: 'Lanternfall', page: 21, chapter: null }] } }));
    expect(cards).toHaveLength(1);
  });
});

describe('the ticks the bar names', () => {
  it('the biggest few, in the order they were paid', () => {
    const t = (label: string, xp: number) => ({ source: label, label, xp });
    const named = namedTicks([t('Finished', 110), t('Pass', 20), t("Day's first run", 200), t('Medals', 120), t('Star', 30)], 3);
    expect(named.map((x) => x.label)).toEqual(['Finished', "Day's first run", 'Medals']);
  });
});

function spineStub(): NonNullable<ResultsModel['spine']> {
  return {
    ticks: [],
    before: rankBar(0),
    after: rankBar(0),
    opened: [],
    stickers: [],
    flame: { lit: false, streak: 0, calendarDay: 0, embered: false, emberEarned: false },
    contracts: { met: [], bonus: false, form: null, today: [], formNext: null },
    league: null,
    primary: { kind: 'again', text: 'Run Again', sub: null, aria: 'Run Again' },
    swap: null,
  };
}
