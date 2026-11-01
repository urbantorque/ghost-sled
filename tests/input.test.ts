import { describe, expect, it } from 'vitest';
import { InputController, startsFromMenu } from '../src/game/input';
import { STEER_CENTER } from '../src/sim/input';

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

// Keyboard steering builds up: a tap is a correction, a hold reaches full lock in about 0.2 s.
describe('keyboard steering', () => {
  const key = (type: string, code: string): Event => Object.assign(new Event(type), { code, repeat: false, preventDefault() {} });
  const setup = (): InputController => {
    const win = Object.assign(new EventTarget(), { innerWidth: 1280, innerHeight: 720 });
    (globalThis as { window?: unknown }).window = win;
    return new InputController(new EventTarget() as unknown as HTMLElement);
  };

  it('starts at a partial lock, reaches full lock in about 12 ticks and drops on release', () => {
    const input = setup();
    window.dispatchEvent(key('keydown', 'ArrowRight'));
    const levels: number[] = [];
    for (let i = 0; i < 16; i++) levels.push(input.sample().steer - STEER_CENTER);
    expect(levels[0]).toBe(1);
    expect(levels.indexOf(4)).toBeGreaterThanOrEqual(10);
    expect(levels.indexOf(4)).toBeLessThanOrEqual(14);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    window.dispatchEvent(key('keyup', 'ArrowRight'));
    expect(input.sample().steer).toBe(STEER_CENTER);
    // Reversing starts over from a partial lock the other way.
    window.dispatchEvent(key('keydown', 'KeyA'));
    expect(input.sample().steer - STEER_CENTER).toBe(-1);
    input.dispose();
  });
});
