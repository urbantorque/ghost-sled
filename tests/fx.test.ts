import { describe, expect, it } from 'vitest';
import { admit, HOLD_MS, SAME_FRAME_MS } from '../src/ui/fx';

// The one-line callout slot: a payoff line that has only just landed (New ground, New best, a trick)
// keeps the slot against a lower-ranked or 'lost' newcomer, which waits its turn instead of erasing it.

describe('admit', () => {
  it('holds a young New ground against a Sketchy landing, then lets it through', () => {
    const top = { tone: 'best' as const, born: 1000 };
    expect(admit(top, 'lost', 1200)).toBe('queue');
    expect(admit(top, 'lost', 1000 + HOLD_MS - 1)).toBe('queue');
    expect(admit(top, 'lost', 1000 + HOLD_MS)).toBe('show');
  });

  it('holds a young trick line against lower ranks only', () => {
    const top = { tone: 'big' as const, born: 0 };
    expect(admit(top, 'lost', 100)).toBe('queue');
    expect(admit(top, 'normal', 100)).toBe('queue');
    // An equal or higher rank still takes the slot (the newest payoff is the news).
    expect(admit(top, 'big', 100)).toBe('show');
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

  it('keeps the hold about 600 ms', () => {
    expect(HOLD_MS).toBeGreaterThanOrEqual(500);
    expect(HOLD_MS).toBeLessThanOrEqual(700);
  });
});
