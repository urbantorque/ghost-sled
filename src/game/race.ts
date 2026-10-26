import type { GhostKind } from '../ui/contract';
import type { GhostRef, GhostRole, PassWord } from './beats';

// Race words and duels: what each pass is called and pays, the duel tracker, which ghost the rival
// pill names, the start-line call and the pass ladder.
//
// Pure: no DOM, render or audio imports.
//
// Scaffold: today's race. Every pass is 'Passed'; only the first pass of a ghost pays (5 gifts, 10
// for the grudge, doubled in Haunted); duels never open; the rival is the nearest ghost ahead.

export interface PassContext {
  tick: number;
  /** The first time this ghost is passed this run. */
  first: boolean;
  ghost: GhostRef;
  /** The ghost has already crashed (its wreck is passed). */
  wreck: boolean;
  everLedBy2m: boolean;
  lastSlingTick: number;
  lastShownPassTick: number;
  chainN: number;
  passedYouBefore: boolean;
  duel: 'won' | 'heldOff' | null;
  haunted: boolean;
  newGroundTick: number;
}

/** What a pass is called, what it pays (gifts: base pay; extra: capped extras) and whether it shows. */
export function classifyPass(c: PassContext): { word: PassWord; text: string; gifts: number; extra: number; muted: boolean } {
  const base = (c.haunted ? 2 : 1) * (c.ghost.kind === 'grudge' ? 10 : 5);
  return { word: 'passed', text: 'Passed', gifts: c.first ? base : 0, extra: 0, muted: false };
}

export type DuelEvent = { phase: 'open' | 'won' | 'heldOff' | 'lost' | 'closed'; id: number };

export class DuelTracker {
  private openId: number | null = null;
  private amt = 0;

  /** The ghost id of the open duel, or null. */
  get open(): number | null {
    return this.openId;
  }

  /** 0..1 tension of the open duel. */
  get amount(): number {
    return this.amt;
  }

  /** Advance by whole sim ticks with each ghost's signed gap. Scaffold: duels never open. */
  step(_dTicks: number, _tick: number, _gaps: ReadonlyArray<{ id: number; gap: number; live: boolean }>): DuelEvent[] {
    return [];
  }

  /** Your crash closes an open duel silently. */
  crash(): void {
    this.openId = null;
    this.amt = 0;
  }

  reset(): void {
    this.openId = null;
    this.amt = 0;
  }
}

/** The ghost the rival pill and the C1/C11 marker name. Scaffold: the nearest ghost ahead (standings). */
export function rivalPick(next: { id: number; gap: number } | null, _duel: { id: number; gap: number } | null, _call: { id: number; gap: number } | null): { id: number; gap: number } | null {
  return next;
}

/** The start-line call ('Racing Mila'), or null. Scaffold: none. */
export function callPick(_c: ReadonlyArray<{ id: number; kind: GhostKind; role?: GhostRole; ready: boolean; nemesis?: boolean }>, _bestDist: number): { id: number; word: 'Racing' | 'Nemesis' | 'Rematch' | 'Chase' } | null {
  return null;
}

/** The pass ping's ladder step for the n-th shown pass. Scaffold: today's sfx ladder (wraps every 8). */
export function ladderIndex(n: number): { step: number; octave: boolean } {
  return { step: 5 + ((Math.max(1, n) - 1) % 8), octave: false };
}
