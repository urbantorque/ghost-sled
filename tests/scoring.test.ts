import { describe, expect, it } from 'vitest';
import { COMBO_WINDOW_TICKS, Combo, MAX_MULTIPLIER } from '../src/sim/scoring';

describe('combo scoring', () => {
  it('multiplier grows every three actions and caps', () => {
    const c = new Combo();
    expect(c.multiplier).toBe(1);
    c.add('air', 100);
    c.add('spin', 100);
    expect(c.multiplier).toBe(1);
    c.add('flip', 100);
    expect(c.multiplier).toBe(2);
    for (let i = 0; i < 60; i++) c.add('nearMiss', 10);
    expect(c.multiplier).toBe(MAX_MULTIPLIER);
  });

  it('repeating a move pays 30% less each time, floored at 20%', () => {
    const c = new Combo();
    expect(c.add('spin', 100).points).toBe(100);
    expect(c.add('spin', 100).points).toBe(70);
    expect(c.add('spin', 100).points).toBe(49);
    for (let i = 0; i < 10; i++) c.add('spin', 100);
    expect(c.add('spin', 100).points).toBe(20);
    expect(c.add('flip', 100).points).toBe(100);
  });

  it('banks pending x multiplier when the window expires', () => {
    const c = new Combo();
    c.add('air', 100);
    c.add('spin', 100);
    c.add('flip', 100); // chain 3 -> x2
    let banked = 0;
    for (let t = 0; t < COMBO_WINDOW_TICKS + 5 && banked === 0; t++) banked = c.tick(false);
    expect(banked).toBe(600);
    expect(c.banked).toBe(600);
    expect(c.active).toBe(false);
  });

  it('holding (airborne, drifting) freezes the timer', () => {
    const c = new Combo();
    c.add('air', 100);
    for (let t = 0; t < COMBO_WINDOW_TICKS * 3; t++) expect(c.tick(true)).toBe(0);
    expect(c.active).toBe(true);
  });

  it('crashing loses the pending pool', () => {
    const c = new Combo();
    c.add('air', 100);
    c.add('flip', 600);
    expect(c.lose()).toBe(700);
    expect(c.banked).toBe(0);
    expect(c.active).toBe(false);
  });

  it('a longer window scale keeps combos alive longer', () => {
    const a = new Combo(1);
    const b = new Combo(1.5);
    expect(b.window).toBeGreaterThan(a.window);
  });
});
