import { describe, expect, it } from 'vitest';
import type { MountainCard, ResultsModel, TitleModel, TitleTwelve, TwelveRung } from '../src/ui/contract';
import { bareFigures } from '../scripts/playtest/r9-screenbars';
import { rankBar } from '../src/game/spineview';
import { factText, resultsMoment, storyButton, storyReward } from '../src/ui/sequence';
import { pickerOrder, shortName, titleAim, titleRide } from '../src/ui/title';

// Round 9 (the ui lane): the words the new title and results say, held to section 2's copy bars without a browser.
// Ride's reason is the run's purpose, never a duel the run is not and never the rider's time (DECISIONS 391); the
// quiet line is one goal in words; the results' beats and button carry no "+1", no "Page N", no "done before" and no
// figure without its word.

const plain = (t: string): string => t.replace(/\u00a0/g, ' ');
const bare = (t: string): number => bareFigures([{ t: plain(t), box: 0 }]).length;

function card(id: string, name: string, over: Partial<MountainCard> = {}): MountainCard {
  return { id, name, tagline: 'Its own feeling', biome: 'alpine', locked: false, unlockText: '', best: 0, ...over };
}

function rung(name: string, state: TwelveRung['state']): TwelveRung {
  return { key: name, name, hat: 'crown', emblem: 'leaf', accent: '#FFFFFF', bio: 'A bio.', mountain: 'Ember Peak', time: '2:07.0', state };
}

function twelve(rides: boolean, here = true): TitleTwelve {
  return { beaten: 10, of: 12, tally: '10 of 12 beaten', next: { ...rung('Suki Ember', 'next'), mountainId: 'ember', here }, final: null, waiting: null, hook: null, crowned: false, rungs: [], rides };
}

function title(over: Partial<TitleModel> = {}): TitleModel {
  return {
    mountains: [card('pinecrest', 'Pinecrest', { bestTime: 124 }), card('frostfang', 'Frostfang Glacier'), card('ember', 'Ember Peak'), card('sakura', 'Sakura Ridge', { locked: true, unlockText: 'Pass 3 more ghosts to unlock' }), card('lanternfall', 'Lanternfall', { locked: true, unlockText: 'Beat 6 more of The Twelve to unlock' })],
    selected: 'pinecrest',
    daily: { key: '2026-11-23', best: 0, ready: true },
    best: 0,
    wallet: 90,
    sledName: 'Pine Flyer',
    challenge: null,
    missions: [],
    inputMode: 'keyboard',
    firstVisit: false,
    ...over,
  };
}

describe("Ride's reason", () => {
  it('names the duel when the next run is one, as the duel and never with the rider time', () => {
    const w = titleRide(title({ selected: 'ember', twelve: twelve(true) }));
    expect(w).toMatchObject({ verb: 'Duel', why: 'Suki Ember, head to head' });
    expect(w.why).not.toMatch(/\d:\d\d/);
  });

  it('never promises a duel the run is not (a save before its third run)', () => {
    expect(titleRide(title({ selected: 'ember', twelve: twelve(false) })).verb).toBe('Ride');
  });

  it("names the rung above you, and never the picked chip's name a second time", () => {
    expect(plain(titleRide(title({ nextRung: 'Next: valo_rides, 2:06.3, 0.1 s up' })).why)).toBe('valo_rides is 0.1 s ahead');
    const w = titleRide(title());
    expect(w.why).not.toMatch(/Pinecrest/);
    expect(w.why).toBe('Its own feeling');
  });

  it('says the Daily and the Cup when they are chosen', () => {
    expect(titleRide(title({ selected: 'daily' })).why).toBe('Today\u2019s Daily. Keeps your flame lit');
    expect(titleRide(title({ selected: 'cup', cup: { key: 'w', week: 48, ready: true, mood: 'Powder Day', event: null, best: 0, medal: 0 } })).why).toBe('This week\u2019s Cup');
  });
});

describe('the picker of eight', () => {
  // Phase B appends Gablefall, the Old Run and Gullhaven to MOUNTAINS (indices 5 to 7): the picker keys on the unlock
  // path, the finale last, not on the index.
  const eight: MountainCard[] = [
    card('pinecrest', 'Pinecrest', { unlockGhosts: 0 }),
    card('frostfang', 'Frostfang Glacier', { unlockGhosts: 4 }),
    card('ember', 'Ember Peak', { unlockGhosts: 12 }),
    card('sakura', 'Sakura Ridge', { unlockGhosts: 24, locked: true, unlockText: 'Pass 6 more ghosts to unlock' }),
    card('lanternfall', 'Lanternfall', { unlockGhosts: 48, finale: true, biome: 'lantern', locked: true, unlockText: 'Beat 9 more of The Twelve to unlock' }),
    card('gablefall', 'Gablefall', { unlockGhosts: 8 }),
    card('oldrun', 'The Old Run', { unlockGhosts: 18 }),
    card('gullhaven', 'Gullhaven', { unlockGhosts: 32, locked: true, unlockText: 'Pass 14 more ghosts to unlock' }),
  ];

  it('orders the chips on the unlock path, the finale last, whatever their index', () => {
    expect(pickerOrder(eight).map((c) => c.id)).toEqual(['pinecrest', 'frostfang', 'gablefall', 'ember', 'oldrun', 'sakura', 'gullhaven', 'lanternfall']);
    // (The five today, which carry no order yet in an old model, keep theirs.)
    expect(pickerOrder(title().mountains.map((c) => ({ ...c, unlockGhosts: undefined }))).map((c) => c.id)).toEqual(['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall']);
  });

  it('gives every mountain a short name a player says', () => {
    expect(eight.map(shortName)).toEqual(['Pinecrest', 'Frostfang', 'Ember', 'Sakura', 'Lanternfall', 'Gablefall', 'Old Run', 'Gullhaven']);
  });

  it('says what opens the nearest locked one in the quiet line', () => {
    expect(titleAim(title({ mountains: eight })).text).toBe('6 more ghosts open Sakura Ridge');
  });
});

describe('the quiet line', () => {
  it('is one goal in words: the next mountain by ghosts first', () => {
    expect(titleAim(title()).text).toBe('3 more ghosts open Sakura Ridge');
  });

  it('then Lanternfall by The Twelve, then the next Rider Rank named as a prize', () => {
    const open = title().mountains.map((c) => (c.id === 'sakura' ? { ...c, locked: false, unlockText: '' } : c));
    expect(titleAim(title({ mountains: open })).text).toBe('Beat 6 more of The Twelve to open Lanternfall');
    const all = open.map((c) => ({ ...c, locked: false, unlockText: '' }));
    const bar = rankBar(31299);
    const spine = { bar } as unknown as NonNullable<TitleModel['spine']>;
    const t = plain(titleAim(title({ mountains: all, spine })).text);
    expect(t).toMatch(/^[\d,]+ XP to Rider Rank \d+: /);
    expect(bare(t)).toBe(0);
  });

  it('a locked chip pressed says what opens it', () => {
    const m = title();
    expect(titleAim(m, m.mountains[3]).text).toBe('Sakura Ridge: pass 3 more ghosts to open it');
  });
});

describe("the results' words", () => {
  const FINISH_Z = 4500;
  const base = (over: Partial<ResultsModel> = {}): ResultsModel => ({
    score: 12000,
    distance: FINISH_Z + 40,
    finishZ: FINISH_Z,
    finish: { seconds: 150, medal: 1, splits: [], bestTime: 152, newBest: true },
    best: 0,
    newBest: false,
    giftsEarned: 40,
    wallet: 400,
    ghosts: [{ name: 'Mika', kind: 'pool', score: 1, time: 149, distance: FINISH_Z + 60, passed: false }],
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
    runAgainLabel: { text: 'Run Again', aria: 'Run Again' },
    ...over,
  });
  const spine = (primary: NonNullable<ResultsModel['spine']>['primary'], opened: NonNullable<ResultsModel['spine']>['opened'] = []): NonNullable<ResultsModel['spine']> => ({
    ticks: [{ source: 'finish', label: 'Finished', xp: 110 }],
    before: rankBar(900),
    after: rankBar(1400),
    opened,
    stickers: [],
    flame: { lit: true, streak: 2, calendarDay: 2, embered: false, emberEarned: false },
    contracts: { met: [], bonus: false, form: null, today: [], formNext: null },
    league: null,
    primary,
    swap: null,
  });
  const cases: ResultsModel[] = [
    base({ spine: spine({ kind: 'again', text: 'Run Again', sub: '300 XP to Rider Rank 8', aria: 'Run Again' }, [{ kind: 'sled', name: 'A new sled', page: 5, chapter: null }, { kind: 'flourish', name: 'A flourish for Spinning Top', page: 5, chapter: null }]) }),
    base({ spine: spine({ kind: 'mission', text: 'Run Again', sub: 'Mission: ride 800 m in one run. 12 m short', aria: 'Run again' }) }),
    base({ runAgainLabel: { text: 'Next Duel: Old Wren', aria: 'Duel' }, spine: spine({ kind: 'duel', text: 'Next Duel: Old Wren', sub: 'On Pinecrest, head to head', aria: 'Duel' }, [{ kind: 'charm', name: 'Charm: Kite String', page: 2, chapter: null }]) }),
    base({ finish: null, distance: 2140, crashCause: 'Hugged a tree', spine: spine({ kind: 'again', text: 'Run Again', sub: null, aria: 'Run Again' }) }),
    base({ raceLine: { text: 'Daily: Bronze. Silver at 2:27.6.', tone: 'event' }, spine: spine({ kind: 'again', text: 'Run Again', sub: null, aria: 'Run Again' }) }),
  ];

  it('say every figure with its word, and never "+1", "Page N" or "done before"', () => {
    for (const m of cases) {
      const mo = resultsMoment(m);
      const r = storyReward(m);
      const b = storyButton(m);
      const said = [mo.word, mo.fact ? factText(mo.fact) : '', r?.kind === 'prize' ? `${r.kicker} ${r.name} ${r.line ?? ''}` : '', b.label, b.why ?? ''];
      for (const t of said) {
        expect(bare(t), t).toBe(0);
        expect(t).not.toMatch(/\+1\b|\bPage \d|done before/);
      }
    }
  });

  it('name every prize of a page in words', () => {
    expect(storyReward(cases[0])).toMatchObject({ name: 'A new sled' });
    expect(storyReward(cases[2])).toMatchObject({ name: 'The Kite String charm' });
  });
});
