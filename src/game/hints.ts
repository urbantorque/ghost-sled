import type { HintKind } from '../ui/contract';

// Teach-move hints: which one the HUD shows this frame, and for how long, as players reach each verb.
// The app feeds the frame's state and the save's lifetime counts (h); the coach keeps the per-run
// state (what is up, for how long, how often a nag has shown) and says when the shown hint changes.
//
// Pure: no DOM, render or audio imports.

/** A hint stays up at least this long (s) against an ordinary change of mind. */
export const HINT_HOLD_S = 1.6;
/** ...and at least this long (s) before the stomp cue may take its place: a spin hint flashed for
 *  0.09 s and cross-faded into the stomp cue. */
export const HINT_MIN_S = 0.8;
/** While the stomp is still being learned (fewer than 3), an air lesson needs this long (s) to land
 *  left, so it shows its HINT_MIN_S before the stomp cue (at 1.2 s) comes. */
export const AIR_LESSON_S = 2;
/** The stomp cue: this long (s) before touchdown while fewer than 3 perfect landings are learned. */
export const STOMP_CUE_S = 1.2;
/** ...on a real flight only: more than this many air ticks (as the air lessons), or at least
 *  STOMP_CUE_MIN_TTL_S still to fall. Without it the cue blinked on every bump's hop (15 ms, 16 ms). */
export const STOMP_CUE_AIR_TICKS = 6;
export const STOMP_CUE_MIN_TTL_S = 0.3;
/** A stomp cue shown holds HINT_MIN_S unless the sled has been back on the snow this long (s): a
 *  run of small hops reads as one cue, not a flicker with 65 ms gaps. A cue that went (stomped, or
 *  let go) comes back no sooner than this either: a stomp straight into the next flight blinked it
 *  off for one frame. */
export const STOMP_GROUND_S = 0.2;
/** The drift nag: at most this many showings, or this long on screen, per run (a player who never
 *  drifts is not nagged all run). */
export const DRIFT_SHOWS = 3;
export const DRIFT_UP_S = 20;
/** The spin lesson: at most this many showings per run. */
export const SPIN_SHOWS = 3;

/** The lifetime lesson counts (save.hints). */
export type HintCounts = Partial<Record<HintKind, number>>;

export interface HintFrame {
  /** Real seconds this frame. */
  dt: number;
  /** Seconds since the run started (the coach's own clock: hintTimer). */
  timer: number;
  steered: boolean;
  grounded: boolean;
  drifting: boolean;
  /** The action is held. */
  action: boolean;
  drafting: boolean;
  airTicks: number;
  /** Predicted seconds to touchdown (Infinity on the ground or unknown). */
  ttl: number;
  /** Runs played (the backflip lesson waits for the second). */
  runs: number;
  /** A kicker's lip is ahead on the line, within reach. */
  kickerAhead: boolean;
  /** The button was held through a kicker's lip: teach the boosted pop on the next approach. */
  heldLip: boolean;
  /** A ghost is 2 to 25 m ahead (a slipstream to try). */
  draftTarget: boolean;
  /** The avalanche owns the lower screen. */
  chased: boolean;
}

export interface HintStep {
  /** The hint to show, when it changed this frame (null hides it); undefined: no change. */
  show?: HintKind | null;
  /** Lessons the frame taught by doing (the app counts them into save.hints). */
  learned: HintKind[];
}

export class HintCoach {
  shown: HintKind | null = null;
  private hold = 0;
  private up = 0;
  private driftShows = 0;
  private driftUp = 0;
  private spinShows = 0;
  /** Seconds the sled has been on the snow (0 in the air). */
  private ground = 0;
  /** Seconds since a stomp cue last went. */
  private sinceStomp = Infinity;

  /** A new run: nothing up, the per-run caps start over. */
  reset(): void {
    this.shown = null;
    this.hold = 0;
    this.up = 0;
    this.driftShows = 0;
    this.driftUp = 0;
    this.spinShows = 0;
    this.ground = 0;
    this.sinceStomp = Infinity;
  }

  /** The shown hint was learned (its count went up): it goes at once. */
  drop(): void {
    if (this.shown === 'stomp') this.sinceStomp = 0;
    this.shown = null;
    this.hold = 0;
    this.up = 0;
  }

  /** What this frame wants on screen. */
  want(f: HintFrame, h: HintCounts): { want: HintKind | null; learned: HintKind[] } {
    const learned: HintKind[] = [];
    const n = (k: HintKind): number => h[k] ?? 0;
    let want: HintKind | null = null;
    if (n('steer') < 1 && f.timer > 0.6) want = 'steer';
    if (f.steered && want === 'steer') {
      learned.push('steer');
      want = null;
    }
    // A kicker ahead is a short window: the boosted pop goes before the drift nag on that approach.
    if (!want && f.grounded && ((n('pop') >= 1 && n('boostPop') < 1) || f.heldLip) && f.kickerAhead) want = 'boostPop';
    const driftLeft = this.shown === 'drift' ? this.driftUp < DRIFT_UP_S : this.driftShows < DRIFT_SHOWS && this.driftUp < DRIFT_UP_S;
    if (!want && n('drift') < 2 && f.timer > 6 && f.grounded && !f.drifting && driftLeft) want = 'drift';
    if (!want && n('pop') < 1 && f.action && f.grounded && !f.drifting) want = 'pop';
    // New verbs as players reach them: a long flight teaches the spin (once the stomp is known), then
    // the backflip (from the second run). While the stomp is still being learned, an air lesson needs
    // time to be read before the stomp cue takes over.
    if (!want && !f.grounded && f.airTicks > 6 && f.ttl < 5) {
      const room = (k: HintKind, base: number): number => (this.shown === k ? 0.8 : n('stomp') < 3 ? AIR_LESSON_S : base);
      if (n('spin') < 2 && n('stomp') >= 1 && f.ttl > room('spin', 0.8) && (this.shown === 'spin' || this.spinShows < SPIN_SHOWS)) want = 'spin';
      else if (n('spin') >= 1 && n('flip') < 1 && f.runs >= 2 && f.ttl > room('flip', 0.9)) want = 'flip';
    }
    // The stomp cue always wins (one threshold; it waits only for a hint's HINT_MIN_S), on a real flight.
    const realFlight = f.airTicks > STOMP_CUE_AIR_TICKS || f.ttl >= STOMP_CUE_MIN_TTL_S;
    const stompBack = this.shown === 'stomp' || this.sinceStomp >= STOMP_GROUND_S;
    if (!f.grounded && n('stomp') < 3 && f.ttl < STOMP_CUE_S && realFlight && stompBack) want = 'stomp';
    if (!want && n('draft') < 1 && f.timer > 20 && f.draftTarget) want = 'draft';
    if (f.drafting && n('draft') < 1) learned.push('draft');
    if (f.chased) want = null;
    return { want, learned };
  }

  /** Steps the coach; `show` is set when the hint on screen changes. */
  step(f: HintFrame, h: HintCounts): HintStep {
    this.sinceStomp += f.dt;
    const { want, learned } = this.want(f, h);
    this.hold = Math.max(0, this.hold - f.dt);
    if (this.shown) this.up += f.dt;
    if (this.shown === 'drift') this.driftUp += f.dt;
    this.ground = f.grounded ? this.ground + f.dt : 0;
    // A hint the player is already doing goes at once, without the hold: steering, or a drift that is
    // under way (the drift is only counted on its release); an air lesson is over on touchdown, the
    // boosted pop's once the sled leaves the snow.
    const doing =
      (this.shown === 'steer' && f.steered) ||
      (this.shown === 'drift' && f.drifting) ||
      ((this.shown === 'spin' || this.shown === 'flip') && f.grounded) ||
      (this.shown === 'boostPop' && !f.grounded);
    const stompIn = want === 'stomp' && (this.shown === null || this.up >= HINT_MIN_S);
    // A stomp cue goes once it has had HINT_MIN_S (at touchdown, usually), or at once after
    // STOMP_GROUND_S back on the snow; through a quick hop in between it stays up.
    const stompOut = this.shown === 'stomp' && want !== 'stomp' && (this.up >= HINT_MIN_S || this.ground > STOMP_GROUND_S);
    const stompHeld = this.shown === 'stomp' && want !== 'stomp' && !stompOut && !f.chased;
    const swap = !stompHeld && (this.hold <= 0 || f.chased || doing || stompIn || stompOut);
    if (want === this.shown || !swap) return { learned };
    if (this.shown === 'stomp') this.sinceStomp = 0;
    this.shown = want;
    this.hold = want ? HINT_HOLD_S : 0;
    this.up = 0;
    if (want === 'drift') this.driftShows++;
    if (want === 'spin') this.spinShows++;
    return { show: want, learned };
  }
}
