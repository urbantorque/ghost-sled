import { describe, expect, it } from 'vitest';
import { EXTRA_GIFTS_CAP, type GhostRef } from '../src/game/beats';
import { DUEL_MAX_TICKS, DuelTracker, ExtraGifts, RIVAL_DWELL_S, callPick, classifyPass, ladderIndex, rivalPick, steadyNext, type PassContext } from '../src/game/race';

const ghost = (kind: GhostRef['kind'] = 'pool', name = 'Mila'): GhostRef => ({ id: 1001, name, kind, dx: 1 });

function ctx(over: Partial<PassContext> = {}): PassContext {
  return {
    tick: 2000,
    first: true,
    ghost: ghost(),
    wreck: false,
    everLedBy2m: true,
    lastSlingTick: -1e9,
    lastShownPassTick: -1e9,
    chainN: 1,
    passedYouBefore: false,
    duel: null,
    haunted: false,
    newGroundTick: -1e9,
    ...over,
  };
}

describe('classifyPass precedence', () => {
  it('a start-line jostle pays and is muted', () => {
    const c = classifyPass(ctx({ tick: 200, everLedBy2m: false }));
    expect(c).toMatchObject({ word: 'jostle', gifts: 5, muted: true });
    // A ghost that got 2 m clear and was then caught is a real pass, even early.
    expect(classifyPass(ctx({ tick: 200, everLedBy2m: true })).word).toBe('passed');
    // The jostle rule outranks everything, a slingshot included.
    expect(classifyPass(ctx({ tick: 200, everLedBy2m: false, lastSlingTick: 190 })).word).toBe('jostle');
  });

  it('a wreck is Beat, before duels and slingshots', () => {
    const c = classifyPass(ctx({ wreck: true, lastSlingTick: 1990, duel: 'won', chainN: 3, lastShownPassTick: 1950 }));
    expect(c).toMatchObject({ word: 'beat', text: 'Beat', gifts: 5, extra: 0, muted: false });
  });

  it("your best's wreck right on New ground is muted (New ground owns the beat)", () => {
    expect(classifyPass(ctx({ wreck: true, ghost: ghost('you'), newGroundTick: 1960 })).muted).toBe(true);
    expect(classifyPass(ctx({ wreck: true, ghost: ghost('you'), newGroundTick: 1900 })).muted).toBe(false);
    expect(classifyPass(ctx({ wreck: true, ghost: ghost('pool'), newGroundTick: 1990 })).muted).toBe(false);
  });

  it('a duel decided on the pass names it', () => {
    expect(classifyPass(ctx({ duel: 'won', lastSlingTick: 1990 })).word).toBe('duelWon');
    expect(classifyPass(ctx({ duel: 'heldOff' })).text).toBe('Held off');
  });

  it('slung past within 90 ticks of a slingshot pays +2', () => {
    expect(classifyPass(ctx({ lastSlingTick: 1910 }))).toMatchObject({ word: 'slung', text: 'Slung past', gifts: 5, extra: 2 });
    expect(classifyPass(ctx({ lastSlingTick: 1909 })).word).toBe('passed');
    // Before a chain.
    expect(classifyPass(ctx({ lastSlingTick: 1990, chainN: 2, lastShownPassTick: 1950 })).word).toBe('slung');
  });

  it('took back pays nothing more', () => {
    expect(classifyPass(ctx({ first: false, passedYouBefore: true, chainN: 3, lastShownPassTick: 1950 }))).toMatchObject({ word: 'tookBack', text: 'Took back', gifts: 0, extra: 0 });
  });

  it('chains: Double, Triple, then Pass streak N, +2 each', () => {
    expect(classifyPass(ctx({ chainN: 2, lastShownPassTick: 1900 }))).toMatchObject({ word: 'double', text: 'Double pass', extra: 2 });
    expect(classifyPass(ctx({ chainN: 3, lastShownPassTick: 1900 }))).toMatchObject({ word: 'triple', text: 'Triple pass' });
    expect(classifyPass(ctx({ chainN: 5, lastShownPassTick: 1900 }))).toMatchObject({ word: 'streak', text: 'Pass streak 5' });
    // More than 3 s since the last one: no chain.
    expect(classifyPass(ctx({ chainN: 2, lastShownPassTick: 1800 })).word).toBe('passed');
  });

  it('your best, live, then a plain pass', () => {
    expect(classifyPass(ctx({ ghost: ghost('you') })).word).toBe('yourBest');
    expect(classifyPass(ctx())).toMatchObject({ word: 'passed', text: 'Passed', gifts: 5 });
  });

  it('pays a first pass 5, doubled in Haunted Hollow; the grudge too (its premium is the settle)', () => {
    expect(classifyPass(ctx({ ghost: ghost('grudge') })).gifts).toBe(5);
    expect(classifyPass(ctx({ ghost: ghost('grudge'), haunted: true })).gifts).toBe(10);
    // A start-line jostle past the grudge pays only the base.
    expect(classifyPass(ctx({ ghost: ghost('grudge'), tick: 200, everLedBy2m: false })).gifts).toBe(5);
    expect(classifyPass(ctx({ haunted: true })).gifts).toBe(10);
    expect(classifyPass(ctx({ first: false })).gifts).toBe(0);
  });

  it('a burst of slung passes out of one slingshot counts up, at the same pay', () => {
    expect(classifyPass(ctx({ lastSlingTick: 1990, slungN: 1 })).text).toBe('Slung past');
    expect(classifyPass(ctx({ lastSlingTick: 1990, slungN: 2 }))).toMatchObject({ word: 'slung', text: 'Slung past 2', gifts: 5, extra: 2 });
    expect(classifyPass(ctx({ lastSlingTick: 1990, slungN: 3 })).text).toBe('Slung past 3');
  });
});

describe('ExtraGifts', () => {
  it('the per-run extras cap holds', () => {
    const x = new ExtraGifts();
    let total = 0;
    for (let i = 0; i < 40; i++) total += x.take(2);
    expect(total).toBe(EXTRA_GIFTS_CAP);
    expect(x.take(5)).toBe(0);
    x.reset();
    expect(x.take(5)).toBe(5);
  });
});

describe('DuelTracker', () => {
  const near = (gap: number, live = true) => [{ id: 7, gap, live }];

  it('opens at exactly 60 accumulated ticks, fed 1 or 3 per call', () => {
    for (const step of [1, 3]) {
      const d = new DuelTracker();
      let tick = 1000;
      let openedAt = -1;
      let fed = 0;
      while (openedAt < 0 && fed < 200) {
        tick += step;
        fed += step;
        const ev = d.step(step, tick, near(0.9));
        if (ev.some((e) => e.phase === 'open')) openedAt = fed;
      }
      expect(openedAt).toBe(60);
      expect(d.open).toBe(7);
    }
  });

  it('canOpen false holds a new duel back while closeness keeps accruing', () => {
    const d = new DuelTracker();
    let t = 1000;
    for (let i = 0; i < 90; i++) expect(d.step(1, ++t, near(0.9), false)).toEqual([]);
    expect(d.open).toBeNull();
    expect(d.step(1, ++t, near(0.9), true)).toEqual([{ phase: 'open', id: 7 }]);
  });

  it('never opens before tick 360', () => {
    const d = new DuelTracker();
    for (let t = 1; t < 300; t++) expect(d.step(1, t, near(0.5))).toEqual([]);
    expect(d.open).toBeNull();
  });

  it('resolves past 4 m: won, held off or lost; pays once; one reopen; cooldown', () => {
    const d = new DuelTracker();
    let t = 1000;
    const run = (gap: number, n: number) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(...d.step(1, ++t, near(gap)));
      return out;
    };
    expect(run(1, 60).map((e) => e.phase)).toEqual(['open']);
    // Mostly level, then the ghost pulls away ahead.
    expect(run(3.9, 20)).toEqual([]);
    expect(run(4.2, 1)).toEqual([{ phase: 'lost', id: 7 }]);
    expect(d.open).toBeNull();
    // Cooldown: 3 s before it can open again, however close.
    expect(run(1, 120)).toEqual([]);
    const re = run(1, 120);
    expect(re.map((e) => e.phase)).toEqual(['open']);
    // You get ahead and away: mostly ahead of it, so it is 'won' unless it spent most of it behind.
    expect(run(-4.5, 1)).toEqual([{ phase: 'won', id: 7 }]);
    // Paid once: never again with this ghost.
    expect(run(1, 400)).toEqual([]);
  });

  it('a lost duel reopens only once', () => {
    const d = new DuelTracker();
    let t = 1000;
    const run = (gap: number, n: number) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(...d.step(1, ++t, near(gap)));
      return out.map((e) => e.phase);
    };
    expect(run(1, 60)).toEqual(['open']);
    expect(run(5, 1)).toEqual(['lost']);
    expect(run(1, 300)).toEqual(['open']);
    expect(run(5, 1)).toEqual(['lost']);
    expect(run(1, 600)).toEqual([]);
  });

  it('held off when the ghost spent most of the duel behind you; its crash is yours', () => {
    const d = new DuelTracker();
    let t = 1000;
    for (let i = 0; i < 60; i++) d.step(1, ++t, near(0.5));
    for (let i = 0; i < 100; i++) d.step(1, ++t, near(-1));
    expect(d.step(1, ++t, near(-4.5))).toEqual([{ phase: 'heldOff', id: 7 }]);

    const e = new DuelTracker();
    for (let i = 0; i < 60; i++) e.step(1, ++t, near(0.5));
    expect(e.amount).toBeGreaterThan(0.9);
    expect(e.step(1, ++t, near(0.5, false))).toEqual([{ phase: 'won', id: 7 }]);
  });

  it('resolves after 8 s by who leads then', () => {
    const run = (d: DuelTracker, t: { v: number }, gap: number, n: number) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(...d.step(1, ++t.v, near(gap)));
      return out.map((e) => e.phase);
    };
    const a = new DuelTracker();
    const ta = { v: 1000 };
    expect(run(a, ta, 1, 60)).toEqual(['open']);
    // Level for 8 s, you a hand ahead at the bell: won.
    expect(run(a, ta, -0.5, DUEL_MAX_TICKS - 1)).toEqual([]);
    expect(run(a, ta, -0.5, 1)).toEqual(['heldOff']);
    expect(a.open).toBeNull();
    const b = new DuelTracker();
    const tb = { v: 1000 };
    expect(run(b, tb, 1, 60)).toEqual(['open']);
    expect(run(b, tb, 0.6, DUEL_MAX_TICKS)).toEqual(['lost']);
  });

  it('your crash closes it silently', () => {
    const d = new DuelTracker();
    let t = 1000;
    for (let i = 0; i < 60; i++) d.step(1, ++t, near(0.5));
    expect(d.open).toBe(7);
    d.crash();
    expect(d.open).toBeNull();
    expect(d.amount).toBe(0);
  });
});

describe('rivalPick and callPick', () => {
  it("an open duel, then a duel's result flash, then the call, override the nearest ghost", () => {
    const next = { id: 1, gap: 12 };
    expect(rivalPick(next, null, null)).toBe(next);
    expect(rivalPick(next, null, { id: 3, gap: -2 })).toEqual({ id: 3, gap: -2 });
    expect(rivalPick(next, { id: 2, gap: 0.4 }, { id: 3, gap: -2 })).toEqual({ id: 2, gap: 0.4 });
    expect(rivalPick(next, null, { id: 3, gap: -2 }, { id: 4, gap: -4.2 })).toEqual({ id: 4, gap: -4.2 });
    expect(rivalPick(next, { id: 2, gap: 0.4 }, null, { id: 4, gap: -4.2 })).toEqual({ id: 2, gap: 0.4 });
    expect(rivalPick(null, null, null)).toBeNull();
  });

  it('the nearest ghost holds through a bunched pack, and gives way past 1 m or across you', () => {
    // Two ghosts side by side ahead: the name the pill shows does not flip every frame.
    expect(steadyNext({ id: 1, gap: 6.4 }, { id: 2, gap: 6.1 })).toEqual({ id: 1, gap: 6.4 });
    expect(steadyNext({ id: 1, gap: 7.3 }, { id: 2, gap: 6.1 })).toEqual({ id: 2, gap: 6.1 });
    // In the bunch (both within 2 m) it holds through a sign flip; clear of it, the next one takes over.
    expect(steadyNext({ id: 1, gap: -0.2 }, { id: 2, gap: 0.5 })).toEqual({ id: 1, gap: -0.2 });
    expect(steadyNext({ id: 1, gap: -2.5 }, { id: 2, gap: 0.5 })).toEqual({ id: 2, gap: 0.5 });
    expect(steadyNext(null, { id: 2, gap: 3 })).toEqual({ id: 2, gap: 3 });
    expect(steadyNext({ id: 1, gap: 3 }, null)).toBeNull();
  });

  it('a newly named ghost stays named for 0.6 s (no 50 ms flapping)', () => {
    expect(steadyNext({ id: 1, gap: 9 }, { id: 2, gap: 3 }, 0.1)).toEqual({ id: 1, gap: 9 });
    expect(steadyNext({ id: 1, gap: 9 }, { id: 2, gap: 3 }, RIVAL_DWELL_S)).toEqual({ id: 2, gap: 3 });
    // A ghost that may not be named any more (held null) gives way at once.
    expect(steadyNext(null, { id: 2, gap: 3 }, 0.1)).toEqual({ id: 2, gap: 3 });
  });

  it('calls friend, nemesis, grudge, your best, then the pace ghost', () => {
    const pace = { id: 1, kind: 'pool' as const, role: 'pace' as const, ready: true };
    const you = { id: 2, kind: 'you' as const, ready: true };
    const grudge = { id: 3, kind: 'grudge' as const, ready: true };
    const nem = { id: 4, kind: 'grudge' as const, ready: true, nemesis: true };
    const friend = { id: 5, kind: 'friend' as const, ready: true };
    expect(callPick([pace], 0)).toEqual({ id: 1, word: 'Chase' });
    expect(callPick([pace, you], 900)).toEqual({ id: 2, word: 'Chase' });
    expect(callPick([pace, you], 100)).toEqual({ id: 1, word: 'Chase' });
    expect(callPick([pace, you, grudge], 900)).toEqual({ id: 3, word: 'Rematch' });
    expect(callPick([pace, you, nem], 900)).toEqual({ id: 4, word: 'Nemesis' });
    expect(callPick([pace, you, nem, friend], 900)).toEqual({ id: 5, word: 'Racing' });
    expect(callPick([{ id: 9, kind: 'pool', ready: true }], 0)).toBeNull();
  });

  it('waits for the best candidate to be ready instead of settling for a lesser one', () => {
    const pace = { id: 1, kind: 'pool' as const, role: 'pace' as const, ready: true };
    expect(callPick([pace, { id: 5, kind: 'friend', ready: false }], 0)).toBeNull();
    expect(callPick([pace, { id: 5, kind: 'friend', ready: true }], 0)).toEqual({ id: 5, word: 'Racing' });
  });
});

describe('ladderIndex', () => {
  it('climbs, then holds the top note with an octave from the 8th', () => {
    expect(ladderIndex(1)).toEqual({ step: 5, octave: false });
    expect(ladderIndex(7)).toEqual({ step: 11, octave: false });
    expect(ladderIndex(8)).toEqual({ step: 12, octave: true });
    expect(ladderIndex(20)).toEqual({ step: 12, octave: true });
    expect(ladderIndex(0)).toEqual({ step: 5, octave: false });
  });
});
