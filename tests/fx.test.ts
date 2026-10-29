import { describe, expect, it } from 'vitest';
import { admit, HOLD_MS, queueFresh, raceHolds, SAME_FRAME_MS, sideAction, stepBackAt } from '../src/ui/fx';

// The one-line callout slot: a payoff line that has only just landed (New ground, New best, a trick)
// keeps the slot against a lower-ranked or 'lost' newcomer, which waits its turn instead of erasing it.

describe('admit', () => {
  it('holds a young New ground against a Sketchy landing, then lets it through', () => {
    const top = { tone: 'best' as const, born: 1000 };
    expect(admit(top, 'lost', 1200)).toBe('queue');
    expect(admit(top, 'lost', 1000 + HOLD_MS - 1)).toBe('queue');
    expect(admit(top, 'lost', 1000 + HOLD_MS)).toBe('show');
  });

  it('holds a young payoff line against lower and equal ranks', () => {
    const top = { tone: 'big' as const, born: 0 };
    expect(admit(top, 'lost', 100)).toBe('queue');
    expect(admit(top, 'normal', 100)).toBe('queue');
    // IN THE FLOW keeps its moment against SURVIVED WRECK HOLLOW 0.35 s later.
    expect(admit(top, 'big', 350)).toBe('queue');
    expect(admit(top, 'big', HOLD_MS)).toBe('show');
    // A higher rank still takes the slot (your best, the landing stamp).
    expect(admit(top, 'best', 100)).toBe('show');
    expect(admit(top, 'perfect', 100)).toBe('show');
  });

  it('holds New ground against a New best in the same frame or the next', () => {
    const top = { tone: 'best' as const, born: 0 };
    expect(admit(top, 'best', 0)).toBe('queue');
    expect(admit(top, 'best', 25)).toBe('queue');
    expect(admit(top, 'lost', 1)).toBe('queue');
    expect(admit(top, 'best', HOLD_MS)).toBe('show');
  });

  it('never holds a plain or lost line, an empty slot, or against a crash', () => {
    expect(admit(null, 'lost', 0)).toBe('show');
    expect(admit({ tone: 'normal', born: 0 }, 'lost', 10)).toBe('show');
    expect(admit({ tone: 'lost', born: 0 }, 'lost', 10)).toBe('show');
    expect(admit({ tone: 'best', born: 0 }, 'lost', 10, true)).toBe('show');
  });

  it('lets the later beat of one frame take the slot (a sketchy landing spin, then Streak broken)', () => {
    const top = { tone: 'big' as const, born: 500 };
    expect(admit(top, 'lost', 500)).toBe('show');
    expect(admit(top, 'lost', 500 + SAME_FRAME_MS - 1)).toBe('show');
    expect(admit(top, 'lost', 500 + SAME_FRAME_MS)).toBe('queue');
  });

  it("lets a landing's two tricks of one frame replace each other (the stamp names both)", () => {
    expect(admit({ tone: 'big', born: 500 }, 'big', 500 + SAME_FRAME_MS - 1)).toBe('show');
  });

  it('keeps the hold about 600 ms', () => {
    expect(HOLD_MS).toBeGreaterThanOrEqual(500);
    expect(HOLD_MS).toBeLessThanOrEqual(700);
  });
});

describe('sideAction', () => {
  it('holds a race word on the side line against the next one, which waits its turn', () => {
    const top = { race: 'fjord348', born: 8267 };
    // 'Passed MarmotMateo' 130 ms after 'Took back fjord348' waits, then shows.
    expect(sideAction(top, 'MarmotMateo', 8400)).toBe('queue');
    expect(sideAction(top, 'MarmotMateo', 8267 + HOLD_MS)).toBe('show');
  });

  it('grows a slingshot burst (or a newer word about the same ghost) in place', () => {
    expect(sideAction({ race: 'slung', born: 0 }, 'slung', 33)).toBe('replace');
    expect(sideAction({ race: 'Tess', born: 0 }, 'Tess', 200)).toBe('replace');
  });

  it('goes through the line slot over anything but a young race word', () => {
    expect(sideAction(null, 'Tess', 0)).toBe('show');
    expect(sideAction({ born: 0 }, 'Tess', 10)).toBe('show');
  });
});

describe('stepBackAt', () => {
  it('steps a young race word back once, on the stale clock of its first arrival', () => {
    // 'TobogganTeo wiped out' arrived at 32,820 ms and showed at 32,850; a trick lands at 33,080.
    const word = { race: 'news\u0000TobogganTeo', born: 32850, arrived: 32820, stepped: false };
    expect(stepBackAt(word, 33080)).toBe(32820);
    // Back on the line after the trick (born again), a second trick on it retires it.
    expect(stepBackAt({ ...word, born: 33700, stepped: true }, 33900)).toBeNull();
    // Its moment had passed, or it is no race word: nothing steps back.
    expect(stepBackAt({ ...word, born: 32850 }, 32850 + HOLD_MS)).toBeNull();
    expect(stepBackAt({ born: 0, arrived: 0, stepped: false }, 10)).toBeNull();
    expect(stepBackAt(undefined, 10)).toBeNull();
  });

  it('lets it go stale from its first arrival, however often it came back', () => {
    // Before: the clock restarted at each showing, so one word printed four times over 4 s.
    expect(queueFresh(32820, 32820 + 1000)).toBe(true);
    expect(queueFresh(32820, 32820 + 2 * HOLD_MS + 251)).toBe(false);
  });
});

describe('raceHolds', () => {
  it('keeps a minor line out under a race word for its hold, as under a pass in the pill', () => {
    expect(raceHolds({ race: 'Tess', born: 1000 }, 1200)).toBe(true);
    expect(raceHolds({ race: 'Tess', born: 1000 }, 1000 + HOLD_MS)).toBe(false);
    expect(raceHolds({ born: 1000 }, 1200)).toBe(false);
    expect(raceHolds(undefined, 1200)).toBe(false);
  });
});
