// Combo and style scoring.
//
// Every stylish action adds points to a pending pool and refreshes the combo timer. The multiplier
// grows with the chain length. When the timer runs out the pool is banked (pool x multiplier).
// Crashing loses the pool; a bump banks it early. Repeating the same move inside one combo pays
// 30% less each time, so variety is what builds big scores.

export type StyleKind =
  | 'carve'
  | 'drift'
  | 'air'
  | 'spin'
  | 'flip'
  | 'clean'
  | 'perfect'
  | 'nearMiss'
  | 'cleared'
  | 'gift'
  | 'draft'
  | 'slingshot'
  | 'smash'
  | 'gate'
  | 'geyser'
  | 'yetiHop'
  | 'avalanche'
  | 'boostPop';

export const STYLE_LABEL: Record<StyleKind, string> = {
  carve: 'Deep carve',
  drift: 'Drift',
  air: 'Air',
  spin: 'Spin',
  flip: 'Flip',
  clean: 'Clean landing',
  perfect: 'Perfect landing',
  nearMiss: 'Near miss',
  cleared: 'Cleared',
  gift: 'Gift',
  draft: 'Draft',
  slingshot: 'Slingshot',
  smash: 'Smash',
  gate: 'Spirit gate',
  geyser: 'Geyser',
  yetiHop: 'Yeti hop',
  avalanche: 'Outran the avalanche',
  boostPop: 'Boosted pop',
};

export const COMBO_WINDOW_TICKS = 156; // 2.6 s at 60 Hz
export const MAX_MULTIPLIER = 10;

export interface StyleResult {
  points: number;
  chain: number;
  mult: number;
}

export class Combo {
  pending = 0;
  chain = 0;
  timer = 0;
  /** Total banked style points this run. */
  banked = 0;
  best = 0;
  window: number;
  private variety = new Map<StyleKind, number>();

  constructor(windowScale = 1) {
    this.window = Math.round(COMBO_WINDOW_TICKS * windowScale);
  }

  get active(): boolean {
    return this.chain > 0;
  }

  get multiplier(): number {
    const m = 1 + Math.floor(this.chain / 3);
    return m > MAX_MULTIPLIER ? MAX_MULTIPLIER : m;
  }

  add(kind: StyleKind, base: number): StyleResult {
    const f = this.variety.get(kind) ?? 1;
    this.variety.set(kind, f * 0.7 < 0.2 ? 0.2 : f * 0.7);
    const points = Math.round(base * f);
    this.pending += points;
    this.chain++;
    this.timer = this.window;
    return { points, chain: this.chain, mult: this.multiplier };
  }

  /** Advance one tick. `hold` freezes the timer (airborne, drifting, drafting). Returns banked
   *  points if the combo just ended, else 0. */
  tick(hold: boolean): number {
    if (!this.active) return 0;
    if (hold) {
      if (this.timer < 30) this.timer = 30;
      return 0;
    }
    this.timer--;
    if (this.timer <= 0) return this.bank();
    return 0;
  }

  /** Multiplier of the most recently banked combo. */
  lastMult = 1;

  bank(): number {
    if (!this.active) return 0;
    this.lastMult = this.multiplier;
    const total = this.pending * this.multiplier;
    this.banked += total;
    if (total > this.best) this.best = total;
    this.reset();
    return total;
  }

  lose(): number {
    const lost = this.pending * this.multiplier;
    this.reset();
    return lost;
  }

  private reset(): void {
    this.pending = 0;
    this.chain = 0;
    this.timer = 0;
    this.variety.clear();
  }
}
