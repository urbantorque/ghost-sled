import { describe, expect, it } from 'vitest';
import { cupChaos, cupSeed, weekKey } from '../src/game/cup';
import { SAVE_KEY, SaveStore, defaultSave, pruneDaily } from '../src/game/save';
import {
  MEASURES,
  type TrialTally,
  TRIAL_WEEKS,
  atLeast,
  familyPool,
  newTally,
  readTrials,
  settleTrial,
  stageWords,
  trialConfig,
  trialFor,
  trialKey,
  trialLine,
  trialMedal,
  trialMountain,
  trialTargets,
  trialValue,
  weekIndex,
} from '../src/game/trial';
import { ALL_CHARMS, CHARMS } from '../src/sim/charms';
import { Mood } from '../src/sim/chaos';
import { MOUNTAINS } from '../src/sim/mountains';
import { rideTrial, weekField } from '../scripts/playtest/r8trial';

// Trials (round 8, the trials lane): a weekly rule twist with its own medal. The week's Trial is a pure function of
// its ISO week and never a second Cup; the medal's targets come out of the week's own field, ordered; a medal is kept
// per week, survives a reload and never goes down; and a Trial reaches the sim only through what a run can already be
// given (the mountain, the chaos, the charm pool).

const TODAY = '2026-11-25';
const WEEK = weekKey(new Date(Date.UTC(2026, 10, 25)));

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

/** The weeks from WEEK on, n of them. */
function weeks(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(weekKey(new Date(Date.UTC(2026, 10, 25 + 7 * i))));
  return out;
}

const tally = (seconds: number, score: number, perfects: number, tumbles = 0): TrialTally => ({ tumbles, line: { seconds, score, perfects } });

describe("the week's Trial", () => {
  it('is the same for everyone: a pure function of the week', () => {
    for (const w of weeks(12)) expect(trialFor(w)).toEqual(trialFor(w));
    expect(WEEK).toBe('2026-W48');
  });

  it('is never a second Cup: a named mountain, never the Cup mood, and the clock always comes with a twist', () => {
    const cups = new Set(MOUNTAINS.map((m) => m.seed));
    for (const w of weeks(104)) {
      const t = trialFor(w);
      expect(cups.has(trialConfig(t, 0).seed), w).toBe(true);
      expect(trialConfig(t, 0).seed).not.toBe(cupSeed(w));
      if (t.chaos.mood !== Mood.None) expect(t.chaos.mood, w).not.toBe(cupChaos(w).mood);
      if (t.measure === 'time' || t.measure === 'clean') {
        expect(t.mirror || t.sky !== 'plain' || t.family !== null, w).toBe(true);
        expect(t.chaos.mood, w).not.toBe(Mood.GlassIce);
      }
      if (t.measure === 'clean') expect(t.family, w).not.toBe('speed');
    }
  });

  it('turns over week by week: a new mountain every week, every measure in any four weeks running', () => {
    const ws = weeks(40);
    for (let i = 1; i < ws.length; i++) {
      expect(weekIndex(ws[i]) - weekIndex(ws[i - 1])).toBe(1);
      expect(trialFor(ws[i]).mountain, ws[i]).not.toBe(trialFor(ws[i - 1]).mountain);
    }
    for (let i = 0; i + 4 <= ws.length; i++) expect(new Set(ws.slice(i, i + 4).map((w) => trialFor(w).measure)).size).toBe(MEASURES.length);
    // (A year that ends on week 53 runs on into week 1 with no gap.)
    expect(weekIndex('2027-W01') - weekIndex('2026-W53')).toBe(1);
  });

  it('names its twist in a few plain words: no em dash, a rule a player reads in a second', () => {
    for (const w of weeks(52)) {
      const t = trialFor(w);
      expect(t.name).not.toMatch(/[–—]/);
      expect(t.rule).not.toMatch(/[–—]/);
      expect(t.name.split(' ').length, t.name).toBeLessThanOrEqual(7);
      expect(t.rule.length, t.rule).toBeLessThanOrEqual(50);
      if (t.family) expect(t.charmPool).toBe(familyPool(t.family));
      else expect(t.charmPool).toBe(ALL_CHARMS);
    }
    expect(CHARMS.filter((c) => (familyPool('survival') & (1 << c.id)) !== 0).every((c) => c.family === 'survival')).toBe(true);
  });
});

describe("the Trial's medal", () => {
  it("sets its targets from the week's own field, ordered bronze under silver under gold", () => {
    const w = weekField(WEEK);
    expect(w.field.length).toBeGreaterThanOrEqual(20);
    expect(w.targets).not.toBeNull();
    const [b, s, g] = w.targets!;
    const m = w.trial.measure;
    expect(atLeast(m, s, b) && s !== b).toBe(true);
    expect(atLeast(m, g, s) && g !== s).toBe(true);
    // The targets are the field's: every one is within the field's spread, and the field's best takes gold.
    const xs = w.values.filter((v): v is number => v !== null);
    const best = xs.reduce((a, v) => (atLeast(m, v, a) ? v : a), xs[0]);
    expect(trialMedal(m, best, w.targets!)).toBe(3);
    // Every field rider ride is the record replayed: its record judged again gives the same figure.
    expect(w.field.every((r) => r.ghost.record.length > 0)).toBe(true);
  });

  it('keeps the order on any spread, the clock and the counts alike', () => {
    for (const m of MEASURES) {
      for (const xs of [[1, 1, 1, 1, 1], [3, 5, 8, 13, 21, 34], [120, 121, 122, 180]]) {
        const t = trialTargets(m, xs);
        expect(t).not.toBeNull();
        expect(atLeast(m, t![1], t![0]) && t![1] !== t![0], `${m} ${xs}`).toBe(true);
        expect(atLeast(m, t![2], t![1]) && t![2] !== t![1], `${m} ${xs}`).toBe(true);
      }
      expect(trialTargets(m, [null, 3, null])).toBeNull();
    }
  });

  it('judges a run as the field is judged: the line crossed, and no get-up on a week without one', () => {
    expect(trialValue('time', newTally())).toBeNull();
    expect(trialValue('time', tally(123.456, 1, 2))).toBe(123.5);
    expect(trialValue('clean', tally(123.4, 1, 2, 1))).toBeNull();
    expect(trialValue('clean', tally(123.4, 1, 2, 0))).toBe(123.4);
    expect(trialValue('score', tally(123.4, 9876, 2))).toBe(9876);
    expect(trialValue('perfects', tally(123.4, 9876, 14))).toBe(14);
  });

  it('says which medal and how far from the next', () => {
    const t = { ...trialFor(WEEK), measure: 'perfects' as const };
    const g = [10, 13, 16] as const;
    expect(trialLine(t, 1, g, 11)).toBe('Trial: Bronze. Silver at 13 perfects, 2 more.');
    expect(trialLine(t, 3, g, 17)).toBe('Trial: Gold.');
    expect(trialLine(t, 0, g, null)).toBe('Trial: Bronze at 10 perfects. Finish to take a medal.');
    const c = { ...t, measure: 'clean' as const };
    expect(trialLine(c, 2, [130, 125, 120], 123.4)).toBe('Trial: Silver. Gold at 2:00.0, 3.4 s faster.');
    expect(trialLine(c, 0, [130, 125, 120], null, 1)).toBe('Trial: Bronze at 2:10.0. Ride it without a get-up.');
    expect(stageWords(c, [130, 125, 120], { seconds: 121, score: 0, perfects: 0, tumbles: 0 })).toBe('Silver under 2:05.0');
    expect(stageWords(c, [130, 125, 120], { seconds: 10, score: 0, perfects: 0, tumbles: 1 })).toBe('A get-up used: no medal');
    expect(stageWords(t, g, { seconds: 10, score: 0, perfects: 11, tumbles: 0 })).toBe('11 of 13 perfects for Silver');
  });

  it('saves per week, survives a reload and never goes down', () => {
    const t = { ...trialFor(WEEK), measure: 'perfects' as const };
    const g = [10, 13, 16] as const;
    const storage = new MemStorage(defaultSave('Rider'));
    const s = new SaveStore(storage as unknown as Storage, 'Rider', TODAY);
    // A run that finished nowhere near the medals writes the week's best and no medal.
    let out = settleTrial(s.data, t, tally(130, 1, 4), g, 0);
    expect(out.medal).toBe(0);
    expect(s.data.trials?.[WEEK]).toEqual({ medal: 0, best: 4 });
    out = settleTrial(s.data, t, tally(130, 1, 14), g, 0);
    expect(out).toMatchObject({ medal: 2, best: 2, was: 0 });
    s.flush();
    const again = new SaveStore(storage as unknown as Storage, 'Rider', TODAY);
    expect(again.data.trials?.[WEEK]).toEqual({ medal: 2, best: 14 });
    // A worse run, and a crash, never lower it; a revive's second settle of the same run gives the same answer.
    out = settleTrial(again.data, t, tally(130, 1, 11), g, 2);
    expect(out.medal).toBe(1);
    expect(out.best).toBe(2);
    settleTrial(again.data, t, newTally(), g, 2);
    expect(again.data.trials?.[WEEK]).toEqual({ medal: 2, best: 14 });
    const gold = settleTrial(again.data, t, tally(130, 1, 17), g, 2);
    const twice = settleTrial(again.data, t, tally(130, 1, 17), g, 2);
    expect(twice).toEqual(gold);
    expect(again.data.trials?.[WEEK]).toEqual({ medal: 3, best: 17 });
  });

  it('is read safely: weeks only, a medal 0 to 3, the latest year kept, nothing written for nothing', () => {
    expect(readTrials(null)).toBeNull();
    expect(readTrials({ 'not-a-week': { medal: 3 }, '2026-W48': { medal: 9, best: -1 }, '2026-W47': { medal: 0 } })).toEqual({ '2026-W48': { medal: 3 } });
    const many: Record<string, unknown> = {};
    for (const w of weeks(TRIAL_WEEKS + 10)) many[w] = { medal: 1 };
    expect(Object.keys(readTrials(many)!).length).toBe(TRIAL_WEEKS);
    const s = new SaveStore(new MemStorage(defaultSave('New')) as unknown as Storage, 'New', TODAY);
    s.flush();
    expect(JSON.parse((s['storage' as never] as MemStorage).getItem(SAVE_KEY)!).trials).toBeUndefined();
  });

  it("keeps only this week's Trial runs among the bests and the run lists (its medal stays in trials)", () => {
    const d = defaultSave('Rider');
    d.best[trialKey('2026-W47')] = { score: 1, distance: 1 } as never;
    d.best[trialKey(WEEK)] = { score: 2, distance: 2 } as never;
    d.trials = { '2026-W47': { medal: 2 } };
    pruneDaily(d, TODAY);
    expect(Object.keys(d.best)).toEqual([trialKey(WEEK)]);
    expect(d.trials['2026-W47'].medal).toBe(2);
  });
});

describe("a Trial's run", () => {
  it('hands the sim only its mountain, its chaos, the sled and its charm pool, and replays to the same figure', () => {
    const w = weekField(WEEK);
    const r = rideTrial(w, 'mid', 1000);
    expect(Object.keys(r.config).sort()).toEqual(['chaos', 'charmPool', 'seed', 'sled']);
    expect(r.config).toEqual(trialConfig(w.trial, 0));
    expect(r.config.seed).toBe(trialMountain(w.trial).seed);
    expect(r.replays).toBe(true);
    expect(r.field).toBeGreaterThanOrEqual(5);
  });

  it('builds the same SimConfig for every week, whatever the sled', () => {
    for (const wk of weeks(8)) {
      const t = trialFor(wk);
      for (const sled of [0, 3]) {
        const c = trialConfig(t, sled);
        expect(Object.keys(c).sort()).toEqual(['chaos', 'charmPool', 'seed', 'sled']);
        expect(c).toEqual({ seed: trialMountain(t).seed, chaos: t.chaos, sled, charmPool: t.charmPool });
      }
    }
  });
});
