// Midgame ad pacing, stricter than the SDK's own ~3 min cooldown: a short-run arcade game ends a run
// every minute or so, and an ad on every Run Again would wreck the instant-retry loop.
//
// Rules: no midgame until `minRunsBeforeFirst` runs have ended; after any ad, wait for both
// `minRunsBetween` more runs and `minMsBetween` of wall time. Rewarded ads count as an ad shown,
// so a revive never sits right next to a midgame.

export interface AdPacingOptions {
  minRunsBeforeFirst?: number;
  minRunsBetween?: number;
  minMsBetween?: number;
}

export class AdPacing {
  private readonly minRunsBeforeFirst: number;
  private readonly minRunsBetween: number;
  private readonly minMsBetween: number;
  private runsTotal = 0;
  private runsSinceAd = 0;
  private lastAdMs = -Infinity;

  constructor(opts: AdPacingOptions = {}) {
    this.minRunsBeforeFirst = Math.max(0, opts.minRunsBeforeFirst ?? 3);
    this.minRunsBetween = Math.max(0, opts.minRunsBetween ?? 4);
    this.minMsBetween = Math.max(0, opts.minMsBetween ?? 210000);
  }

  /** Call when a run ends. */
  runEnded(): void {
    this.runsTotal++;
    this.runsSinceAd++;
  }

  /** Should we request a midgame ad now (between runs, on the Run Again transition)? */
  shouldShowMidgame(nowMs: number): boolean {
    if (this.runsTotal < this.minRunsBeforeFirst) return false;
    if (this.lastAdMs === -Infinity) return true;
    return this.runsSinceAd >= this.minRunsBetween && nowMs - this.lastAdMs >= this.minMsBetween;
  }

  /** Call after a midgame or rewarded ad actually showed (rewarded ads also reset the midgame clock). */
  adShown(nowMs: number): void {
    this.lastAdMs = nowMs;
    this.runsSinceAd = 0;
  }
}
