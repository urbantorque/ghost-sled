import { describe, expect, it } from 'vitest';
import { startsFromMenu } from '../src/game/input';

// The title and results keyboard path: Shift+Tab moves focus back and must never start a run.

describe('menu presses', () => {
  it('only Space among the action keys, and any click or tap, start a run from a menu', () => {
    expect(startsFromMenu('keyboard', 'Space')).toBe(true);
    for (const code of ['ShiftLeft', 'ShiftRight', 'KeyS', 'KeyW', 'ArrowUp', 'ArrowDown']) expect(startsFromMenu('keyboard', code)).toBe(false);
    expect(startsFromMenu('keyboard')).toBe(false);
    expect(startsFromMenu('mouse')).toBe(true);
    expect(startsFromMenu('touch')).toBe(true);
  });
});
