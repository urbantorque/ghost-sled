// Stomp streaks: consecutive perfect landings, with their titles.
//
// Pure: no DOM, render or audio imports.
//
// A perfect landing adds 1. A clean landing does not break the streak at once: a press just after a
// clean touchdown still upgrades it to a (late) perfect up to 5 ticks later (sim.ts lateStomp), so the
// break waits 6 ticks (by event tick) and a late perfect in that window cancels it and counts once.
// Sketchy landings, a crash and a revive break the streak. Hops (under 0.3 s of air) are neutral.

/** Ticks a clean landing waits before it breaks the streak (a late stomp lands within 5). */
export const CLEAN_BREAK_TICKS = 6;

export class StompStreak {
  private cur = 0;
  private top = 0;
  /** Event tick at which a clean landing's deferred break comes due, or -1. */
  private breakAt = -1;

  /** The current streak (0 = none). */
  get n(): number {
    return this.cur;
  }

  /** The best streak this run. */
  get best(): number {
    return this.top;
  }

  /** A landing at sim `tick`. broke: the streak it ended (0 = none). */
  land(q: 'perfect' | 'clean' | 'sketchy' | 'hop', late: boolean, tick: number): { n: number; broke: number } {
    if (q === 'hop') return { n: this.cur, broke: 0 };
    if (q === 'perfect') {
      let broke = 0;
      if (this.breakAt >= 0 && !late) {
        // A clean landing's break was still pending and this is a new flight: the clean broke it.
        broke = this.cur;
        this.cur = 0;
      }
      // A late perfect upgrades the clean landing it follows: the pending break is cancelled.
      this.breakAt = -1;
      this.cur++;
      if (this.cur > this.top) this.top = this.cur;
      return { n: this.cur, broke };
    }
    if (q === 'clean') {
      let broke = 0;
      if (this.breakAt >= 0) {
        broke = this.cur;
        this.cur = 0;
      }
      this.breakAt = this.cur > 0 ? tick + CLEAN_BREAK_TICKS : -1;
      return { n: this.cur, broke };
    }
    const broke = this.cur;
    this.cur = 0;
    this.breakAt = -1;
    return { n: 0, broke };
  }

  /** Once per frame with the latest sim tick: a deferred break that came due, or null. */
  tick(tick: number): { broke: number } | null {
    if (this.breakAt < 0 || tick < this.breakAt) return null;
    const broke = this.cur;
    this.cur = 0;
    this.breakAt = -1;
    return broke > 0 ? { broke } : null;
  }

  crash(): void {
    this.cur = 0;
    this.breakAt = -1;
  }

  revive(): void {
    this.cur = 0;
    this.breakAt = -1;
  }

  reset(): void {
    this.cur = 0;
    this.top = 0;
    this.breakAt = -1;
  }
}

/** The stamp's title for a streak of n: the name grows instead of its points shrinking. */
export function stompTitle(n: number): string {
  if (n <= 1) return 'Perfect landing';
  if (n === 2) return 'Double stomp';
  if (n === 3) return 'Triple stomp';
  if (n === 4) return 'Quad stomp';
  return `Stomp streak ${n}`;
}
