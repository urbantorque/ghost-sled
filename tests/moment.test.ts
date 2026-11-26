import { describe, expect, it } from 'vitest';
import type { ResultsGhost, ResultsModel } from '../src/ui/contract';
import { type Moment, factText, resultsMoment as moment } from '../src/ui/sequence';

/** The moment with its no-break spaces read as spaces ("2,140 m" never breaks before its unit on screen). */
function resultsMoment(m: ResultsModel): Moment & { said: string | null } {
  const mo = moment(m);
  const plain = (t: string): string => t.replace(/ /g, ' ');
  return { ...mo, figure: plain(mo.figure), said: mo.fact === null ? null : plain(factText(mo.fact)) };
}

// The results lead with the moment (round 9, beat one): a win, a podium, a finish and a wreck each say a different
// thing, and the one fact under it is the best thing the run did, in words.

const FINISH_Z = 4500;

function ghost(name: string, time: number | null, distance = FINISH_Z + 60, kind: ResultsGhost['kind'] = 'pool'): ResultsGhost {
  return { name, kind, score: 1000, time, distance, passed: false };
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

  it('a wreck leads with how far it got, and says how it ended and how far from the line in one fact', () => {
    const mo = resultsMoment(model({ finish: null, distance: 2140, crashCause: 'Hugged a tree' }));
    expect(mo).toMatchObject({ kind: 'wreck', figure: '2,140 m', word: 'Wiped out', time: null, said: 'Hugged a tree, 2,360 m from the line' });
  });

  it('a wreck is never a win, wherever it stood', () => {
    expect(resultsMoment(model({ finish: null, distance: 4400, ghosts: [ghost('f', null, 2000)] })).kind).toBe('wreck');
  });
});

describe('the one fact', () => {
  const rider = { key: 'bram', name: 'Bram Oakhollow', hat: 'antlers', emblem: 'leaf', accent: '#CFE8B8' };
  const fell: NonNullable<ResultsModel['twelve']> = { tone: 'fell', line: 'Bram Oakhollow falls. 3 of 12 beaten.', rider, says: 'Good on you.', beaten: 3, of: 12, gifts: 40 };

  it('a rider of The Twelve beaten comes before everything, named in their colour', () => {
    const mo = resultsMoment(model({ ...withTime(139, { newBest: true }), twelve: fell }));
    expect(mo.said).toBe('Bram Oakhollow beaten. 3 of 12 down.');
    expect(mo.fact).toMatchObject({ tone: 'twelve', who: 'rider', name: 'Bram Oakhollow' });
  });

  it('a duel lost says who held you off, and by how much', () => {
    const held = { ...fell, tone: 'held' as const, line: 'Bram Oakhollow held you off by 1.2 s.', gifts: 0 };
    const mo = resultsMoment(model({ ...withTime(149.2), ghosts: [ghost('Bram Oakhollow', 148), ghost('b', 155)], twelve: held }));
    expect(mo.said).toBe('Bram Oakhollow held you off by 1.2 s');
  });

  it('then a new best, with how much quicker, or the first finish here', () => {
    const mo = resultsMoment(model(withTime(150, { newBest: true })));
    expect(mo.said).toBe('A new best, 2.9 s quicker');
    expect(mo.fact?.tone).toBe('best');
    expect(resultsMoment(model(withTime(150, { newBest: true, bestTime: null }))).said).toBe('Your first finish here');
  });

  it('else the nearest rider, the gap and the name: the rider just ahead, or for a winner the one just behind', () => {
    expect(resultsMoment(model()).said).toBe('2.0 s behind c');
    expect(resultsMoment(model(withTime(139))).said).toBe('1.0 s ahead of a');
    const mo = resultsMoment(model({ ...withTime(150), ghosts: [ghost('Juniper', 149.6, FINISH_Z + 60, 'grudge')] }));
    expect(mo.said).toBe('0.4 s behind Juniper');
    expect(mo.fact?.who).toBe('grudge');
  });

  it("a Daily's medal leads with the time it was won on, so the place cannot read as disagreeing with it", () => {
    const mo = resultsMoment(model({ ...withTime(146), raceLine: { text: 'Daily: Silver. Gold at 2:21.4.', tone: 'event' } }));
    expect(mo).toMatchObject({ kind: 'podium', figure: '2:26.0', word: 'Silver on today’s Daily', medal: 2, time: null });
    expect(mo.said).toBe('3rd of 7 in the race');
    expect(resultsMoment(model({ ...withTime(130), raceLine: { text: 'Cup: Gold.', tone: 'event' } }))).toMatchObject({ kind: 'win', word: 'Gold in this week’s Cup', medal: 3 });
  });

  it("a Trial leads with its own figure, lit by its medal, and needs no fact", () => {
    const mo = resultsMoment(model({ trial: { medal: 2, line: 'Trial: Silver. Gold at 19.', figure: '17', unit: 'perfects', word: 'Silver in the Trial', fact: '17 perfects, 2 short of gold' } }));
    expect(mo).toMatchObject({ kind: 'podium', figure: '17', of: 'perfects', word: 'Silver in the Trial', medal: 2, fact: null });
  });

  it('carries no em dash and no emoji in any of its words', () => {
    const all = [model(), model(withTime(139)), model(withTime(142)), model({ finish: null, distance: 900, crashCause: 'Found a rock' }), model({ ghosts: [] })].map(resultsMoment);
    for (const mo of all) expect(`${mo.figure}${mo.of}${mo.word}${mo.said ?? ''}`).not.toMatch(/[–—]|\p{Extended_Pictographic}/u);
  });
});
