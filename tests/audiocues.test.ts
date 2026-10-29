import { describe, expect, it } from 'vitest';
import { CHOIR_HOLD_S, CHOIR_VOICES, ChoirTracker, GROOVE_STREAK, NEW_BEST_LEAD_MS, RETAKE_WAIT_S, UI_SAME_S, UiOnce, bankRoll, choirSize, floorDrive, grooveLift, resultsCues, revealCues, stormCascade } from '../src/audio/cues';
import type { Beat } from '../src/game/beats';
import { FLOOR_FROM, RUN_FLOOR } from '../src/game/intensity';
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

describe('the run floor arrives at once', () => {
  it('snaps the drive to the floor the first time the target reaches it, then smooths as before', () => {
    // Plain run at 2.5 s: the drive has crept to about 0.12, the floor engages.
    expect(floorDrive(0.12, RUN_FLOOR, false, false)).toBe(RUN_FLOOR);
    // Already above (a fast start), already floored this run, or held: untouched.
    expect(floorDrive(0.4, 0.45, false, false)).toBe(0.4);
    expect(floorDrive(0.2, RUN_FLOOR, true, false)).toBe(0.2);
    expect(floorDrive(0.12, RUN_FLOOR, false, true)).toBe(0.12);
    // Below the floor the target has not reached it: no snap.
    expect(floorDrive(0.12, 0.25, false, false)).toBe(0.12);
    expect(floorDrive(0.12, Number.NaN, false, false)).toBe(0.12);
  });

  it('a plain run has the bass in a breath after the floor engages (the engine smoothing replayed)', () => {
    // The engine's smoothing (rise 0.7 s) on the game's intensity for a novice start: speed ramps
    // 8 to 16 m/s over 4 s (speedK below the floor), the floor engages at FLOOR_FROM.
    const firstBass = (snap: boolean): number => {
      let drive = 0;
      let floored = false;
      const dt = 1 / 60;
      for (let t = 0; t < 8; t += dt) {
        const speed = 8 + 2 * Math.min(t, 4);
        const target = Math.max(t >= FLOOR_FROM ? RUN_FLOOR : 0, 0.36 * Math.max(0, Math.min(1, (speed - 8) / 10)) - 0.1);
        if (snap) drive = floorDrive(drive, target, floored, false);
        if (drive >= RUN_FLOOR) floored = true;
        drive += (target - drive) * (1 - Math.exp(-dt / (target > drive ? 0.7 : 2.2)));
        // music.ts: the bass layer is smoothstep(0.26, 0.40, drive); audible past 0.15.
        const x = Math.max(0, Math.min(1, (drive - 0.26) / 0.14));
        if (x * x * (3 - 2 * x) > 0.15) return t;
      }
      return 99;
    };
    expect(firstBass(true)).toBeLessThan(FLOOR_FROM + 0.1);
    expect(firstBass(false)).toBeGreaterThan(FLOOR_FROM + 1.5);
  });
});

describe('the ghost choir keeps a retake for its sigh', () => {
  const g = (id: number) => ({ id, name: 'G' + id, kind: 'pool' as const, dx: 0 });
  const pass = (id: number, word: 'passed' | 'slung' | 'jostle' = 'passed', muted = false): Beat => ({ type: 'pass', tick: 0, ghost: g(id), word, text: 'Passed', first: true, chain: 1, ladder: 1, octave: false, gifts: 1, muted });
  const passedBy = (id: number): Beat => ({ type: 'passedBy', tick: 0, ghost: g(id), muted: false });

  it('a count that drops a few frames before the passedBy still sighs (the real-run order)', () => {
    const c = new ChoirTracker();
    c.beats([pass(1, 'slung')], 5.47);
    expect(c.frame(1, 5.47, false)).toEqual({ n: 1, retaken: false });
    // The director counts it out as it draws level (5.93 s): the voice is held, not faded.
    expect(c.frame(0, 5.93, false)).toEqual({ n: 1, retaken: false });
    expect(c.frame(0, 5.98, false)).toEqual({ n: 1, retaken: false });
    // passedBy at 6.02 s: the held voice leaves with the sigh.
    c.beats([passedBy(1)], 6.02);
    expect(c.frame(0, 6.02, false)).toEqual({ n: 0, retaken: true });
    expect(c.frame(0, 6.1, false)).toEqual({ n: 0, retaken: false });
  });

  it('each drop is held on its own clock: a ghost leaving range, then a retake 0.5 s later, still sighs', () => {
    // Real run (novice m=0): the count went 3 -> 2 at 33.92 s, 2 -> 1 at 34.42 s as fjord348 drew
    // level, and its passedBy came at 34.45 s.
    const c = new ChoirTracker();
    c.beats([pass(1), pass(2), pass(3)], 7);
    c.frame(3, 7.2, false);
    expect(c.frame(2, 33.92, false).n).toBe(3);
    // The first drop's hold runs out as the second drop starts its own: one voice fades.
    expect(c.frame(1, 34.42, false)).toEqual({ n: 2, retaken: false });
    c.beats([passedBy(2)], 34.45);
    expect(c.frame(1, 34.45, false)).toEqual({ n: 1, retaken: true });
  });

  it('a slow retake (0.8 m at 2 m/s, 0.4 s) is still inside the hold', () => {
    const c = new ChoirTracker();
    c.beats([pass(1)], 1);
    c.frame(1, 1, false);
    for (let t = 2; t < 2 + 0.4; t += 1 / 60) expect(c.frame(0, t, false).n).toBe(1);
    c.beats([passedBy(1)], 2.4);
    expect(c.frame(0, 2.4, false)).toEqual({ n: 0, retaken: true });
  });

  it('a drop with no retake fades after the hold; a ghost that only drew level never changes the choir', () => {
    const c = new ChoirTracker();
    c.beats([pass(1), pass(2)], 1);
    c.frame(2, 1, false);
    expect(c.frame(1, 3, false).n).toBe(2);
    expect(c.frame(1, 3 + CHOIR_HOLD_S - 0.01, false).n).toBe(2);
    expect(c.frame(1, 3 + CHOIR_HOLD_S + 0.01, false)).toEqual({ n: 1, retaken: false });
    // Level for 0.3 s, then back behind: the count dips and recovers inside the hold, no change sung.
    const d = new ChoirTracker();
    d.beats([pass(1)], 1);
    d.frame(1, 1, false);
    expect(d.frame(0, 4, false).n).toBe(1);
    expect(d.frame(0, 4.3, false).n).toBe(1);
    expect(d.frame(1, 4.32, false)).toEqual({ n: 1, retaken: false });
    expect(d.frame(1, 5, false).n).toBe(1);
  });

  it('a wipeout releases at once; a full choir still sighs and refills after the wait', () => {
    const c = new ChoirTracker();
    c.beats([pass(1)], 1);
    c.frame(1, 1, false);
    c.beats([{ type: 'raceNews', tick: 0, ghost: g(1), news: 'wipeoutBehind', text: 'G1 wiped out behind you', pan: 0, gain: 1 }], 3);
    expect(c.frame(0, 3.02, false)).toEqual({ n: 0, retaken: false });
    // Three voices with a fourth ghost behind: the count never drops, the sigh comes after the wait.
    const f = new ChoirTracker();
    f.beats([pass(1), pass(2), pass(3), pass(4)], 1);
    f.frame(3, 1, false);
    f.beats([passedBy(2)], 2);
    expect(f.frame(3, 2, false)).toEqual({ n: 3, retaken: false });
    expect(f.frame(3, 2 + RETAKE_WAIT_S, false)).toEqual({ n: 3, retaken: true });
  });

  it('a won duel joins like a pass (its retake sighs); muted passes, jostles and the crash do not', () => {
    const c = new ChoirTracker();
    c.beats([{ type: 'duel', tick: 0, phase: 'won', ghost: g(5), gifts: 3 }, pass(6, 'jostle', true), pass(7, 'passed', true)], 1);
    expect([...c.passed.keys()]).toEqual([5]);
    c.frame(1, 1, false);
    c.beats([passedBy(6), passedBy(7)], 2);
    expect(c.frame(1, 2 + RETAKE_WAIT_S, false).retaken).toBe(false);
    c.beats([passedBy(5)], 3);
    expect(c.frame(0, 3, false)).toEqual({ n: 0, retaken: true });
    c.beats([pass(8)], 4);
    c.frame(1, 4, false);
    expect(c.frame(1, 5, true)).toEqual({ n: 0, retaken: false });
    expect(c.passed.size).toBe(0);
  });

  it('without the director count, the time-to-live proxy still sings and expires', () => {
    const c = new ChoirTracker();
    c.beats([pass(1), pass(2)], 0);
    expect(c.frame(undefined, 1, false).n).toBe(2);
    expect(c.frame(undefined, 31, false).n).toBe(2);
    expect(c.frame(undefined, 31 + CHOIR_HOLD_S, false).n).toBe(0);
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
