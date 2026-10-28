import { describe, expect, it } from 'vitest';
import { CHOIR_VOICES, GROOVE_STREAK, NEW_BEST_LEAD_MS, UI_SAME_S, UiOnce, bankRoll, choirSize, grooveLift, resultsCues, revealCues, stormCascade } from '../src/audio/cues';
import { BANK_CHIP_MS, BANK_ROLL_MS, BANK_TICKS, rollValue } from '../src/game/stake';
import { RESULTS_TIMING } from '../src/ui/results';
import { REVEAL_TIMING } from '../src/ui/reveal';

// The audio's timelines against the picture's clocks (src/audio/cues.ts): the bank roll on the HUD's
// count steps, the results card on RESULTS_TIMING, the reveal reel, the choir's size, the groove lift
// and the one-sound-per-moment guard.

/** The HUD's count step shown at cash-in time ct (ms), exactly as fx.cashIn computes it. */
function hudStep(ct: number, tier: 1 | 2 | 3): number {
  const C = BANK_CHIP_MS;
  const R = BANK_ROLL_MS[tier];
  const n = BANK_TICKS[tier];
  return ct < C ? 0 : Math.min(n, Math.floor(((ct - C) * n) / Math.max(1, R)) + 1);
}

describe('bank roll on the HUD clock', () => {
  for (const tier of [1, 2, 3] as const) {
    it(`tier ${tier}: one tick on each count step, the landing at chip + roll`, () => {
      const r = bankRoll({ tier, points: 9000, mult: 6, origin: 1500 });
      expect(r.multiply).toBe(true);
      expect(r.chip).toBeCloseTo(BANK_CHIP_MS / 1000, 9);
      expect(r.ticks).toHaveLength(BANK_TICKS[tier]);
      expect(r.land).toBeCloseTo((BANK_CHIP_MS + BANK_ROLL_MS[tier]) / 1000, 9);
      r.ticks.forEach((t, i) => {
        const ms = t * 1000;
        // The figure changes to step i + 1 exactly at the tick (and not a hair before).
        expect(hudStep(ms + 0.01, tier)).toBe(i + 1);
        expect(hudStep(ms - 0.01, tier)).toBe(i);
        // Each step shows a new figure, the last the product.
        if (i > 0) expect(rollValue(1500, 9000, i + 1, BANK_TICKS[tier])).toBeGreaterThan(rollValue(1500, 9000, i, BANK_TICKS[tier]));
      });
      expect(rollValue(1500, 9000, BANK_TICKS[tier], BANK_TICKS[tier])).toBe(9000);
      // Equal steps in time, all before the landing.
      const gaps = r.ticks.slice(1).map((t, i) => t - r.ticks[i]);
      for (const g of gaps) expect(g).toBeCloseTo(BANK_ROLL_MS[tier] / BANK_TICKS[tier] / 1000, 9);
      expect(r.ticks[r.ticks.length - 1]).toBeLessThan(r.land);
    });
  }

  it('a bank the HUD does not roll has no ticks and lands at once', () => {
    expect(bankRoll({ tier: 0, points: 400, mult: 2, origin: 200 })).toEqual({ multiply: false, chip: null, ticks: [], land: 0 });
    // x1, or nothing to multiply: fx.cashIn punches the figure at once.
    expect(bankRoll({ tier: 2, points: 6000, mult: 1, origin: 6000 }).ticks).toHaveLength(0);
    expect(bankRoll({ tier: 3, points: 24000, mult: 4, origin: 0 }).land).toBe(0);
  });
});

describe('results cues', () => {
  const T = RESULTS_TIMING;

  it('lands every sound on its RESULTS_TIMING step', () => {
    const q = resultsCues({ count: true, newBest: true, beats: 2, missions: [0, 2], coins: [2] }, T, false);
    const at = (name: string) => q.filter((c) => c.name === name).map((c) => Math.round(c.at * 1000));
    // The count ticks where 1 - (1 - x)^3 passes each tenth: the last on COUNT_MS.
    const ticks = at('results-tick');
    expect(ticks).toHaveLength(10);
    expect(ticks[9]).toBe(T.COUNT_MS);
    ticks.forEach((ms, i) => expect(1 - Math.pow(1 - ms / T.COUNT_MS, 3)).toBeCloseTo((i + 1) / 10, 2));
    expect(at('results-stamp')).toEqual([T.PLACE_MS]);
    // The arpeggio starts early so its chord lands on the New best stamp.
    expect(at('new-best')).toEqual([T.NEW_BEST_MS - NEW_BEST_LEAD_MS]);
    expect(at('results-mallet')).toEqual([T.BEAT_MS, T.BEAT_MS + T.BEAT_STEP]);
    // Done stamps and fly-ins by mission row (the CSS --i), not by count.
    expect(at('mission')).toEqual([T.DONE_MS, T.DONE_MS + 2 * T.DONE_STEP]);
    expect(at('coin')).toEqual([T.FLY_MS + 2 * T.FLY_STEP + T.FLY_DUR]);
  });

  it('a plain count means rows 0..n-1 (the old signature)', () => {
    const q = resultsCues({ count: false, newBest: false, beats: 0, missions: 2, coins: 2 }, T, false);
    expect(q.filter((c) => c.name === 'mission').map((c) => Math.round(c.at * 1000))).toEqual([T.DONE_MS, T.DONE_MS + T.DONE_STEP]);
    expect(q.filter((c) => c.name === 'coin').map((c) => Math.round(c.at * 1000))).toEqual([T.FLY_MS + T.FLY_DUR, T.FLY_MS + T.FLY_STEP + T.FLY_DUR]);
    expect(q.some((c) => c.name === 'results-tick')).toBe(false);
  });

  it('reduced motion plays everything at once with a single tick', () => {
    const q = resultsCues({ count: true, newBest: true, beats: 3, missions: [1], coins: [1] }, T, true);
    expect(q.every((c) => c.at === 0)).toBe(true);
    expect(q.filter((c) => c.name === 'results-tick')).toHaveLength(1);
    expect(q.map((c) => c.name).sort()).toEqual(['coin', 'mission', 'new-best', 'results-mallet', 'results-stamp', 'results-tick']);
  });

  it('the closest pair of results sounds is wider than the one-sound guard', () => {
    const q = resultsCues({ count: true, newBest: true, beats: 4, missions: [0, 1, 2], coins: [0, 1, 2] }, T, false);
    for (const a of q) for (const b of q) if (a !== b && a.name === b.name) expect(Math.abs(a.at - b.at)).toBeGreaterThan(UI_SAME_S);
  });
});

describe('reveal cues', () => {
  it('ticks climb 3 to 9 along the reel and the slam lands on T_STAMP', () => {
    const q = revealCues(REVEAL_TIMING, false);
    const ticks = q.filter((c) => c.name === 'reveal-tick');
    expect(ticks).toHaveLength(11);
    expect(ticks[0].detail).toBe(3);
    expect(ticks[ticks.length - 1].detail).toBe(9);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].at).toBeGreaterThan(ticks[i - 1].at + UI_SAME_S);
      expect(ticks[i].detail).toBeGreaterThanOrEqual(ticks[i - 1].detail);
    }
    expect(ticks[0].at * 1000).toBeGreaterThan(REVEAL_TIMING.T_REEL);
    const land = q.filter((c) => c.name === 'reveal-land');
    expect(land.map((c) => Math.round(c.at * 1000))).toEqual([REVEAL_TIMING.T_STAMP]);
    expect(ticks[ticks.length - 1].at * 1000).toBeLessThan(REVEAL_TIMING.T_STAMP);
  });

  it('reduced motion has no reel: the name lands at 200 ms', () => {
    expect(revealCues(REVEAL_TIMING, true)).toEqual([{ name: 'reveal-land', detail: 0, at: 0.2 }]);
  });
});

describe('the one-sound guard', () => {
  it('drops the same sound asked for again at the same moment, keeps the rest', () => {
    const g = new UiOnce();
    expect(g.admit('coin', 10, 9)).toBe(true);
    expect(g.admit('coin', 10.004, 9)).toBe(false);
    expect(g.admit('mission', 10, 9)).toBe(true);
    expect(g.admit('coin', 10.14, 9)).toBe(true);
    // Long gone entries are forgotten; clear() forgets everything (cancelPending).
    expect(g.admit('coin', 10, 11)).toBe(true);
    g.clear();
    expect(g.admit('coin', 10.14, 9)).toBe(true);
  });
});

describe('choir size and groove', () => {
  it("prefers the director's count, else the proxy, capped at the voices", () => {
    expect(choirSize(2, 0)).toBe(2);
    expect(choirSize(0, 3)).toBe(0);
    expect(choirSize(7, 0)).toBe(CHOIR_VOICES);
    expect(choirSize(undefined, 2)).toBe(2);
    expect(choirSize(Number.NaN, 5)).toBe(CHOIR_VOICES);
    expect(choirSize(-1, 1)).toBe(0);
  });

  it('a stomp streak lifts the groove a step at a time, a single stomp or none adds nothing', () => {
    expect(grooveLift(0)).toBe(0);
    expect(grooveLift(1)).toBe(0);
    expect(grooveLift(undefined)).toBe(0);
    for (let n = 2; n < GROOVE_STREAK.length; n++) expect(grooveLift(n)).toBeGreaterThan(grooveLift(n - 1));
    expect(grooveLift(12)).toBe(GROOVE_STREAK[GROOVE_STREAK.length - 1]);
  });
});

describe('the Gift Storm finale by grade', () => {
  it('grows with the grade and only the sweep lands on the chord', () => {
    expect(stormCascade(0)).toEqual({ notes: 2, chord: false, falling: true });
    expect(stormCascade(1).chord).toBe(false);
    expect(stormCascade(2).notes).toBeGreaterThan(stormCascade(1).notes);
    expect(stormCascade(3)).toEqual({ notes: 9, chord: true, falling: false });
  });
});
