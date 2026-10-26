// Stomp streaks: consecutive perfect landings, with their titles.
//
// Pure: no DOM, render or audio imports.
//
// Scaffold: no streaks yet. A perfect landing is always n = 1 ('Perfect landing'), nothing breaks
// with a beat, and there is no streak line.

export class StompStreak {
  private cur = 0;
  private top = 0;

  /** The current streak (0 = none). */
  get n(): number {
    return this.cur;
  }

  /** The best streak this run. */
  get best(): number {
    return this.top;
  }

  /** A landing at sim `tick`. broke: the streak it ended (0 = none). */
  land(q: 'perfect' | 'clean' | 'sketchy' | 'hop', _late: boolean, _tick: number): { n: number; broke: number } {
    if (q === 'hop') return { n: this.cur, broke: 0 };
    this.cur = q === 'perfect' ? 1 : 0;
    this.top = Math.max(this.top, this.cur);
    return { n: this.cur, broke: 0 };
  }

  /** Once per frame with the latest sim tick: a deferred break that came due. Scaffold: none. */
  tick(_tick: number): { broke: number } | null {
    return null;
  }

  crash(): void {
    this.cur = 0;
  }

  revive(): void {
    this.cur = 0;
  }

  reset(): void {
    this.cur = 0;
    this.top = 0;
  }
}

/** The stamp's title for a streak of n. Scaffold: always 'Perfect landing'. */
export function stompTitle(_n: number): string {
  return 'Perfect landing';
}

/** The stamp's streak sub-line ('2 in a row'), or null. Scaffold: none. */
export function streakLine(_n: number): string | null {
  return null;
}
