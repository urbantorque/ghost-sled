import type { BankTier } from './beats';

// The number at stake: bank tiers by size and the fuse while a big stake drains.
//
// Pure: no DOM, render or audio imports.
//
// Scaffold: every bank is tier 0 and the fuse never lights, as today.

export const BANK_T1 = 1500;
export const BANK_T2 = 5000;
export const BANK_T3 = 20000;

/** A bank's tier from its points, the banked combo's skill chain and your lifetime best combo. */
export function bankTier(_points: number, _skillChain: number, _bestComboAtStart: number): BankTier {
  return 0;
}

/** 0..1 fuse tension from the stake, the combo timer's remaining fraction and whether it drains. */
export function fuseLevel(_stake: number, _timerFrac: number, _draining: boolean): number {
  return 0;
}
