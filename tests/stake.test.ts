import { describe, expect, it } from 'vitest';
import { BANK_MS, BANK_ROLL_MS, BANK_T1, BANK_T2, BANK_T3, BANK_TICKS, bankHeader, bankTier, fuseLevel, rollValue } from '../src/game/stake';

describe('bankTier', () => {
  it('grades a bank by size', () => {
    expect(bankTier(80, 6, 0)).toBe(0);
    expect(bankTier(2400, 6, 0)).toBe(1);
    expect(bankTier(9000, 6, 0)).toBe(2);
    expect(bankTier(40000, 6, 0)).toBe(3);
  });

  it('puts each threshold on its own tier', () => {
    expect(bankTier(BANK_T1 - 1, 6, 0)).toBe(0);
    expect(bankTier(BANK_T1, 6, 0)).toBe(1);
    expect(bankTier(BANK_T2 - 1, 6, 0)).toBe(1);
    expect(bankTier(BANK_T2, 6, 0)).toBe(2);
    expect(bankTier(BANK_T3 - 1, 6, 0)).toBe(2);
    expect(bankTier(BANK_T3, 6, 0)).toBe(3);
  });

  it('caps a draft-dominated combo at tier 1', () => {
    expect(bankTier(40000, 2, 0)).toBe(1);
    expect(bankTier(9000, 0, 0)).toBe(1);
    expect(bankTier(2400, 0, 0)).toBe(1);
    expect(bankTier(80, 0, 0)).toBe(0);
    // Even a new lifetime best stays at tier 1 when it was drafted.
    expect(bankTier(30000, 2, 10000)).toBe(1);
  });

  it('grades a new lifetime best as tier 3 with its header', () => {
    expect(bankTier(4000, 5, 3000)).toBe(3);
    expect(bankHeader(4000, 3, 3000)).toBe('New best combo');
    // Not beaten: graded by size, a big one is 'Massive'.
    expect(bankTier(4000, 5, 6000)).toBe(1);
    expect(bankHeader(4000, 1, 6000)).toBeNull();
    expect(bankHeader(25000, 3, 30000)).toBe('Massive');
    // A first record is no news.
    expect(bankTier(4000, 5, 0)).toBe(1);
    expect(bankHeader(25000, 3, 0)).toBe('Massive');
    // A best beaten by a tiny bank is not a slam.
    expect(bankTier(300, 5, 200)).toBe(0);
  });
});

describe('fuseLevel', () => {
  it('is 0 under the stake threshold', () => {
    expect(fuseLevel(1499, 0.1, true)).toBe(0);
  });

  it('is 0 at or above 40% of the timer', () => {
    expect(fuseLevel(5000, 0.4, true)).toBe(0);
    expect(fuseLevel(5000, 0.9, true)).toBe(0);
  });

  it('is 0 while the timer is not draining', () => {
    expect(fuseLevel(5000, 0.1, false)).toBe(0);
  });

  it('rises from 0 to 1 as the timer falls', () => {
    const a = fuseLevel(5000, 0.39, true);
    const b = fuseLevel(5000, 0.2, true);
    const c = fuseLevel(5000, 0.05, true);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(fuseLevel(5000, 0, true)).toBe(1);
    expect(fuseLevel(5000, -0.1, true)).toBe(1);
    expect(b).toBeCloseTo(0.5, 6);
  });
});

describe('the roll', () => {
  it('counts from the origin to the product, ending on the product', () => {
    const n = BANK_TICKS[2];
    expect(rollValue(1240, 4960, 0, n)).toBe(1240);
    expect(rollValue(1240, 4960, n, n)).toBe(4960);
    let prev = 1240;
    for (let i = 1; i <= n; i++) {
      const v = rollValue(1240, 4960, i, n);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('fits every tier inside its total time', () => {
    for (let t = 0; t < 4; t++) expect(BANK_ROLL_MS[t]).toBeLessThan(BANK_MS[t]);
  });
});
