import { describe, expect, it } from 'vitest';
import type { ResultsGhost, ResultsModel } from '../src/ui/contract';
import { type Moment, resultsMoment as moment } from '../src/ui/results';

/** The moment with its no-break spaces read as spaces ("2,140 m" never breaks before its unit on screen). */
function resultsMoment(m: ResultsModel): Moment {
  const mo = moment(m);
  const plain = (t: string): string => t.replace(/ /g, ' ');
  return { ...mo, figure: plain(mo.figure), fact: mo.fact === null ? null : plain(mo.fact) };
}

// The results lead with the moment: a win, a podium, a finish and a wreck each say a different thing, and
// the fact under it is the best thing the run did.

const FINISH_Z = 4500;

function ghost(name: string, time: number | null, distance = FINISH_Z + 60): ResultsGhost {
  return { name, kind: 'pool', score: 1000, time, distance, passed: false };
}

function model(over: Partial<ResultsModel> = {}): ResultsModel {
  return {
    score: 12000,
    distance: FINISH_Z + 80,
    finish: { seconds: 150, medal: 0, splits: [], bestTime: 152.9, newBest: false },
    finishZ: FINISH_Z,
    best: 12000,
    newBest: false,
    giftsEarned: 30,
    wallet: 100,
    ghosts: [ghost('a', 140), ghost('b', 145), ghost('c', 148), ghost('d', 155), ghost('e', 160), ghost('f', null, 2000)],
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

const withTime = (seconds: number, over: Partial<NonNullable<ResultsModel['finish']>> = {}): Partial<ResultsModel> => ({ finish: { seconds, medal: 0, splits: [], bestTime: 152.9, newBest: false, ...over } });

describe('the kind of ending', () => {
  it('first across the line is a win', () => {
    const mo = resultsMoment(model(withTime(139)));
    expect(mo).toMatchObject({ kind: 'win', figure: '1st', of: 'of 7', word: 'First down the mountain', time: '2:19.0' });
  });

  it('second or third of four or more is a podium', () => {
    expect(resultsMoment(model(withTime(142)))).toMatchObject({ kind: 'podium', figure: '2nd', word: 'On the podium' });
    expect(resultsMoment(model(withTime(146)))).toMatchObject({ kind: 'podium', figure: '3rd' });
  });

  it('third of three is a finish: a podium needs somebody off it', () => {
    const m = model({ ...withTime(150), ghosts: [ghost('a', 140), ghost('b', 145)] });
    expect(resultsMoment(m)).toMatchObject({ kind: 'finish', figure: '3rd', of: 'of 3', word: 'Across the line' });
  });

  it('any other finish is a finish, and leads with the place', () => {
    expect(resultsMoment(model())).toMatchObject({ kind: 'finish', figure: '4th', of: 'of 7', time: '2:30.0' });
  });

  it('a finish with nobody to race leads with its time', () => {
    expect(resultsMoment(model({ ghosts: [] }))).toMatchObject({ kind: 'finish', figure: '2:30.0', of: '', time: null });
  });

  it('a wreck leads with how far it got, and how far short that was', () => {
    const mo = resultsMoment(model({ finish: null, distance: 2140, crashCause: 'Clipped a pine' }));
    expect(mo).toMatchObject({ kind: 'wreck', figure: '2,140 m', word: 'Wiped out', time: null, fact: '2,360 m short of the finish.' });
  });

  it('a wreck is never a win, wherever it stood', () => {
    expect(resultsMoment(model({ finish: null, distance: 4400, ghosts: [ghost('f', null, 2000)] })).kind).toBe('wreck');
  });
});

describe('the fact under it', () => {
  const fell: NonNullable<ResultsModel['twelve']> = { tone: 'fell', line: 'Bram Oakhollow falls. 3 of 12 beaten.', rider: { key: 'bram', name: 'Bram Oakhollow', hat: 'antlers', emblem: 'leaf', accent: '#CFE8B8' }, says: 'Good on you.', beaten: 3, of: 12, gifts: 40 };
  const ladder: NonNullable<ResultsModel['ladder']> = { rank: 16, of: 37, top: false, next: null, up: 3, medals: { stages: [], run: 0 }, fresh: [], moment: 'Beat KestrelHailstone and 2 more.', topNow: false, gifts: 0 };

  it('a rider of The Twelve beaten comes before everything', () => {
    const mo = resultsMoment(model({ ...withTime(139, { newBest: true }), twelve: fell, ladder }));
    expect(mo.fact).toBe('Bram Oakhollow falls. 3 of 12 beaten.');
    expect(mo.factTone).toBe('twelve');
  });

  it('then a new best, with how much quicker', () => {
    const mo = resultsMoment(model({ ...withTime(150, { newBest: true }), ladder }));
    expect(mo.fact).toBe('New best, 2.9 s quicker.');
    expect(mo.factTone).toBe('best');
    expect(resultsMoment(model(withTime(150, { newBest: true, bestTime: null }))).fact).toBe('Your first finish here.');
  });

  it('then the ladder climbed, then a duel that was lost, then a medal', () => {
    expect(resultsMoment(model({ ladder })).fact).toBe('Beat KestrelHailstone and 2 more.');
    const held = { ...fell, tone: 'held' as const, line: 'Old Wren held you off by 1.2 s.', gifts: 0 };
    expect(resultsMoment(model({ twelve: held })).fact).toBe('Old Wren held you off by 1.2 s.');
    expect(resultsMoment(model({ twelve: held, ladder })).fact).toBe('Beat KestrelHailstone and 2 more.');
    expect(resultsMoment(model(withTime(150, { medal: 2 }))).fact).toBe('Silver run.');
    expect(resultsMoment(model()).fact).toBeNull();
  });

  it('a wreck that set a new best score says so', () => {
    const mo = resultsMoment(model({ finish: null, distance: 2140, newBest: true }));
    expect(mo.fact).toBe('New best score.');
    expect(mo.factTone).toBe('best');
  });

  it('carries no em dash and no emoji in any of its words', () => {
    const all = [model(), model(withTime(139)), model(withTime(142)), model({ finish: null, distance: 900 }), model({ ghosts: [] })].map(resultsMoment);
    for (const mo of all) expect(`${mo.figure}${mo.of}${mo.word}${mo.fact ?? ''}`).not.toMatch(/[–—]|\p{Extended_Pictographic}/u);
  });
});
