import { describe, expect, it } from 'vitest';
import { GapReadout } from '../src/game/race';
import { rivalChipText } from '../src/render/ghosts';
import { pillGap } from '../src/ui/hud';

// Contract C12: the off-screen rival chip and the rival pill read one number, the director's held gap.
describe('rivalChipText (C12)', () => {
  it('shows the held gap as a positive whole number of metres, 1 m when neck and neck', () => {
    expect(rivalChipText(15)).toBe('15 m');
    expect(rivalChipText(-15)).toBe('15 m');
    expect(rivalChipText(1)).toBe('1 m');
    expect(rivalChipText(-1)).toBe('1 m');
    expect(rivalChipText(0)).toBe('1 m');
  });

  it("reads the pill's number for every gap the director holds, frame by frame", () => {
    const g = new GapReadout();
    let last = Number.NaN;
    // A rival dropping from 30 m ahead to 30 m behind and back, 60 frames a second.
    for (let i = 0; i <= 2400; i++) {
      const t = i / 60;
      const raw = 30 * Math.cos(t * 0.3) + 0.4 * Math.sin(t * 7);
      const shown = g.show(7, raw, t);
      expect(Number.isInteger(shown)).toBe(true);
      const pill = pillGap(shown, last, 0);
      last = pill;
      expect(rivalChipText(shown)).toBe(`${pill} m`);
    }
  });
});
