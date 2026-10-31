import type { Beat } from '../game/beats';
import { RUN_FLOOR } from '../game/intensity';
import { BANK_CHIP_MS, BANK_ROLL_MS, BANK_TICKS } from '../game/stake';
import type { UiSound } from './engine';

// Pure timing for the sounds that sit on a picture's clock: the bank roll on the HUD's count steps,
// the results card on its CSS beats, the reveal reel, the ghost choir's bookkeeping, the drive's
// groove lift and run-floor arrival, and a guard that keeps one UI sound from playing twice. No
// WebAudio here, so the tests run it in node; sfx.ts and engine.ts schedule what it returns.

const clampInt = (v: number, lo: number, hi: number): number => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : lo);

/** A bank's sound timeline (seconds from the bank beat), mirroring fx.cashIn (src/ui/fx.ts). */
export interface BankRoll {
  /** The HUD rolls the figure (tier 1 to 3 with a real multiplier); else it punches at once. */
  multiply: boolean;
  /** When the 'xN' chip has slammed on (the roll starts), or null with no roll. */
  chip: number | null;
  /** One time per HUD count step: step k (1..n) shows at chip + (k - 1) * roll / n. */
  ticks: number[];
  /** The figure lands (the punch to its peak): the bell, and on tiers 2 and 3 the slam. */
  land: number;
}

/**
 * The roll in step with the HUD's cash-in (src/game/stake.ts timing): the chip slams on over
 * BANK_CHIP_MS, then the figure counts up in BANK_TICKS[tier] equal steps over BANK_ROLL_MS[tier]
 * (fx.ts: step i shows once (t - chip) * n / roll reaches i - 1), and lands at chip + roll. A bank the
 * HUD does not roll (tier 0, a multiplier under 2, or nothing to multiply) has no ticks and lands at
 * once.
 */
export function bankRoll(b: { tier: number; points: number; mult: number; origin: number }): BankRoll {
  const tier = clampInt(b.tier, 0, 3);
  const multiply = tier > 0 && b.mult >= 2 && b.origin > 0 && b.origin < b.points;
  if (!multiply) return { multiply, chip: null, ticks: [], land: 0 };
  const chip = BANK_CHIP_MS / 1000;
  const roll = BANK_ROLL_MS[tier] / 1000;
  const n = BANK_TICKS[tier];
  const ticks: number[] = [];
  for (let k = 1; k <= n; k++) ticks.push(chip + ((k - 1) * roll) / n);
  return { multiply, chip, ticks, land: chip + roll };
}

/** One UI sound on a timeline: its name, detail (ladder step or index) and seconds from now. */
export interface Cue {
  name: UiSound;
  detail: number;
  at: number;
}

/** Results timeline (ms after the card opens); results.ts exports it as RESULTS_TIMING. */
export interface ResultsCue {
  COUNT_MS: number;
  PLACE_MS: number;
  NEW_BEST_MS: number;
  BEAT_MS: number;
  BEAT_STEP: number;
  DONE_MS: number;
  DONE_STEP: number;
  FLY_MS: number;
  FLY_STEP: number;
  FLY_DUR: number;
}

/** Reveal timeline (ms from the card's start); reveal.ts exports it as REVEAL_TIMING. */
export interface RevealCue {
  T_REEL: number;
  REEL_MS: number;
  T_STAMP: number;
}

/**
 * What the results card shows. missions and coins are a count (the Done stamps and reward fly-ins
 * are then taken to be rows 0..n-1) or the rows themselves: the index of each mission in
 * ResultsModel.missions, which is the stamp's CSS --i (title.ts missionList) and the fly-in's i
 * (results.ts flyRewards). [] puts none on the timeline: the app plays each coin from
 * UIHandlers.onRewardLanded and each Done chime from onMissionStamp, as the card lands or stamps it.
 */
export interface ResultsShow {
  count: boolean;
  newBest: boolean;
  beats: number;
  missions: number | readonly number[];
  coins: number | readonly number[];
}

/** The new-best arpeggio's chord lands this long after it starts (6 notes, 70 ms apart). */
export const NEW_BEST_LEAD_MS = 420;

/** A count or the rows; an empty list (the app plays those sounds from the card's callbacks) or a
 *  missing one is none. */
const rows = (v: number | readonly number[] | null | undefined): number[] =>
  typeof v === 'number' ? Array.from({ length: clampInt(v, 0, 64) }, (_, i) => i) : Array.isArray(v) ? v.filter((x) => Number.isFinite(x) && x >= 0).map((x) => Math.round(x)) : [];

/**
 * The results card's sounds on its CSS beats: ten ticks up the ladder where the score's ease-out
 * count (1 - (1 - x)^3 over COUNT_MS) passes each tenth, the place stamp, the new-best chord on its
 * stamp (the arpeggio starts NEW_BEST_LEAD_MS early), a mallet per Beat stamp (BEAT_MS + BEAT_STEP *
 * i), a chime per mission Done stamp (DONE_MS + DONE_STEP * row) and a coin as each reward lands in
 * the wallet (FLY_MS + FLY_STEP * row + FLY_DUR). Reduced motion: the card lands whole, so everything
 * plays at once with a single tick.
 */
export function resultsCues(r: ResultsShow, t: ResultsCue, reduced: boolean): Cue[] {
  const out: Cue[] = [];
  const mis = rows(r.missions);
  const coins = rows(r.coins);
  if (reduced) {
    if (r.count) out.push({ name: 'results-tick', detail: 9, at: 0 });
    out.push({ name: 'results-stamp', detail: 0, at: 0 });
    if (r.newBest) out.push({ name: 'new-best', detail: 0, at: 0 });
    if (r.beats > 0) out.push({ name: 'results-mallet', detail: 0, at: 0 });
    if (mis.length > 0) out.push({ name: 'mission', detail: 0, at: 0 });
    if (coins.length > 0) out.push({ name: 'coin', detail: 0, at: 0 });
    return out;
  }
  if (r.count) {
    for (let i = 0; i < 10; i++) out.push({ name: 'results-tick', detail: i, at: (t.COUNT_MS * (1 - Math.cbrt(1 - (i + 1) / 10))) / 1000 });
  }
  out.push({ name: 'results-stamp', detail: 0, at: t.PLACE_MS / 1000 });
  if (r.newBest) out.push({ name: 'new-best', detail: 0, at: Math.max(0, t.NEW_BEST_MS - NEW_BEST_LEAD_MS) / 1000 });
  const beats = clampInt(r.beats, 0, 64);
  for (let i = 0; i < beats; i++) out.push({ name: 'results-mallet', detail: i, at: (t.BEAT_MS + t.BEAT_STEP * i) / 1000 });
  mis.forEach((row, k) => out.push({ name: 'mission', detail: k, at: (t.DONE_MS + t.DONE_STEP * row) / 1000 }));
  coins.forEach((row, k) => out.push({ name: 'coin', detail: k, at: (t.FLY_MS + t.FLY_STEP * row + t.FLY_DUR) / 1000 }));
  return out;
}

/** The reel's easing in reveal.ts (cubic-bezier(0.18, 0.62, 0.22, 1)). */
const REEL_EASE = [0.18, 0.62, 0.22, 1] as const;

function bezier(p1: number, p2: number, s: number): number {
  const u = 1 - s;
  return 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s;
}

/** Time fraction (0..1) at which a CSS cubic-bezier easing reaches progress y. */
export function easeTimeAt(e: readonly [number, number, number, number], y: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (bezier(e[1], e[3], m) < y) lo = m;
    else hi = m;
  }
  return bezier(e[0], e[2], (lo + hi) / 2);
}

/**
 * The reveal's sounds: a tick each time the reel shows its next name (the strip has travelled past
 * half a row toward it), climbing ladder steps 3 to 9, and the slam as the name lands (T_STAMP).
 * Reduced motion has no reel: the name lands at 200 ms. `names` is the reel's length (12).
 */
export function revealCues(t: RevealCue, reduced: boolean, names = 12): Cue[] {
  if (reduced) return [{ name: 'reveal-land', detail: 0, at: 0.2 }];
  const out: Cue[] = [];
  const n = Math.max(1, clampInt(names, 1, 64) - 1);
  for (let k = 1; k <= n; k++) {
    const at = t.T_REEL + t.REEL_MS * easeTimeAt(REEL_EASE, (k - 0.5) / n);
    out.push({ name: 'reveal-tick', detail: 3 + Math.round((6 * (k - 1)) / Math.max(1, n - 1)), at: at / 1000 });
  }
  out.push({ name: 'reveal-land', detail: 0, at: t.T_STAMP / 1000 });
  return out;
}

/** The choir is at most this many voices (music.ts CHOIR_MAX). */
export const CHOIR_VOICES = 3;

/** The choir's size: the director's live count when the frame carries one (passed ghosts still
 *  riding within 150 m behind), else the engine's own time-to-live proxy. */
export function choirSize(frameChoir: number | undefined, proxy: number): number {
  return typeof frameChoir === 'number' && Number.isFinite(frameChoir) ? clampInt(frameChoir, 0, CHOIR_VOICES) : clampInt(proxy, 0, CHOIR_VOICES);
}

/** Without the director's count (AudioFrame.choir absent) a ghost you passed sings this long,
 *  standing in for 'still riding within 150 m behind' (a retake, a wipeout or the crash ends it
 *  sooner). */
export const CHOIR_TTL_S = 30;
/** A retake's sigh waits this long (s) for the count to drop; past it (a full choir, more ghosts
 *  behind than voices) the top voice sighs and another takes its place. */
export const RETAKE_WAIT_S = 0.25;
/**
 * A drop in the count with no retake yet is held this long (s) before the voice fades. The
 * director counts a ghost out as it draws level (back <= 0), but the race's passedBy only fires
 * once it leads by 0.8 m (src/game/ghosts.ts), 2 to 6 frames later at a typical closing speed and
 * about 0.4 s for a ghost creeping past at 2 m/s. A retake landing in the hold sighs the voice that
 * was about to fade; a ghost that only drew level and fell back never changes the choir at all. A
 * wipeout or the crash releases at once.
 */
export const CHOIR_HOLD_S = 0.5;

/**
 * The ghost choir's bookkeeping (engine.ts applies it to music.setChoir every frame). The beats keep
 * the set of ghosts you passed that have not passed you back: a shown pass or a won duel adds one
 * (as the director's count does), a passedBy of one of them is a retake (its sigh), a wipeout
 * releases its voice without the hold, and the crash clears the set. Each frame takes the count to
 * sing, the director's when the frame carries it (else this set with a time to live), and returns
 * the voices to sing and whether a voice leaves with the retake's sigh.
 */
export class ChoirTracker {
  /** Passed ghosts (id to the time of the pass) that have not passed you back. */
  readonly passed = new Map<number, number>();
  /** Voices sung now: the count plus the drops still held. */
  n = 0;
  /** The count last frame, and when each voice the count has dropped since is held (oldest first). */
  private want = 0;
  private readonly holds: number[] = [];
  private retakeAt = -1;
  private releaseAt = -1;

  reset(): void {
    this.passed.clear();
    this.n = 0;
    this.want = 0;
    this.holds.length = 0;
    this.retakeAt = -1;
    this.releaseAt = -1;
  }

  beats(list: readonly Beat[], now: number): void {
    for (const b of list) {
      if (b.type === 'pass') {
        if (!b.muted && b.word !== 'jostle' && b.word !== 'beat') this.passed.set(b.ghost.id, now);
      } else if (b.type === 'duel') {
        if (b.phase === 'won' || b.phase === 'heldOff') this.passed.set(b.ghost.id, now);
      } else if (b.type === 'passedBy') {
        if (this.passed.delete(b.ghost.id)) this.retakeAt = now;
      } else if (b.type === 'raceNews') {
        if ((b.news === 'wipeout' || b.news === 'wipeoutBehind') && this.passed.delete(b.ghost.id)) this.releaseAt = now;
      } else if (b.type === 'crash') this.passed.clear();
    }
  }

  /**
   * count: AudioFrame.choir (undefined: the time-to-live proxy). Each voice the count drops is held
   * on its own clock (two ghosts leaving a moment apart each get their full hold); a rise takes a
   * held voice back first (a ghost that drew level and fell behind again), and a hold that runs out
   * fades its voice. A retake sighs the newest held voice, or with none held (a full choir with more
   * ghosts behind than voices) sighs the top voice after RETAKE_WAIT_S and lets another take its
   * place.
   */
  frame(count: number | undefined, now: number, crashed: boolean): { n: number; retaken: boolean } {
    if (crashed) {
      this.reset();
      return { n: 0, retaken: false };
    }
    if (!(typeof count === 'number' && Number.isFinite(count))) for (const [id, at] of this.passed) if (now - at > CHOIR_TTL_S) this.passed.delete(id);
    const want = choirSize(count, this.passed.size);
    if (want < this.want) {
      // A wipeout just released its voice: that drop is not held.
      let k = this.want - want;
      if (this.releaseAt >= 0 && now - this.releaseAt < CHOIR_HOLD_S) {
        k--;
        this.releaseAt = -1;
      }
      for (; k > 0; k--) this.holds.push(now);
    } else for (let k = want - this.want; k > 0 && this.holds.length > 0; k--) this.holds.pop();
    this.want = want;
    while (this.holds.length > 0 && now - this.holds[0] >= CHOIR_HOLD_S) this.holds.shift();
    let retaken = false;
    if (this.retakeAt >= 0 && (this.holds.length > 0 || now - this.retakeAt >= RETAKE_WAIT_S)) {
      this.holds.pop();
      retaken = true;
      this.retakeAt = -1;
    }
    this.n = Math.min(CHOIR_VOICES, want + this.holds.length);
    return { n: this.n, retaken };
  }
}

/** The groove's lift by stomp streak (0, 1, 2, 3, 4, 5+): consecutive perfect landings hold the band
 *  up a layer at a time for as long as the streak lives. Drafting can never earn one. */
export const GROOVE_STREAK = [0, 0, 0.06, 0.11, 0.15, 0.18] as const;

export function grooveLift(streak: number | undefined): number {
  return GROOVE_STREAK[clampInt(streak ?? 0, 0, GROOVE_STREAK.length - 1)];
}

/**
 * The run floor's arrival: the first time a run's target reaches RUN_FLOOR (src/game/intensity.ts,
 * from FLOOR_FROM), the smoothed drive jumps to the floor instead of rising to it from about 0.12
 * over the 0.7 s rise, which kept the bass out until about 5 s. `floored`: the drive has already
 * reached the floor this run; `held`: a crash or the chaos count-in (the count-in's release snaps
 * on its own).
 */
export function floorDrive(drive: number, target: number, floored: boolean, held: boolean): number {
  if (floored || held || !(target >= RUN_FLOOR - 1e-6)) return drive;
  return drive < RUN_FLOOR ? RUN_FLOOR : drive;
}

/** Two requests for the same UI sound this close together (s) are one sound (the app and a cue
 *  helper both scheduling the same coin, say). The closest real pair, the count's first ticks, sit
 *  22 ms apart. */
export const UI_SAME_S = 0.01;
/**
 * The results card's coin and Done chime are asked for by the picture (UIHandlers.onRewardLanded and
 * onMissionStamp, as each lands or stamps) as well as by the app: the doubled reward's coin comes 15 to
 * 20 ms after the re-render's landings, and a stamp's callback can come a frame or two from another
 * ask for the same moment (a reduced-motion card stamping every row at once, a hitch bunching two
 * stamps into one frame). Within this (s) they are one coin or one chime, not a flam. Real rows sit
 * DONE_STEP and FLY_STEP (140 ms) apart.
 */
export const UI_SAME_CHIME_S = 0.06;

/** The one-sound window for a UI sound (s). */
export const uiSameWindow = (name: UiSound): number => (name === 'coin' || name === 'mission' ? UI_SAME_CHIME_S : UI_SAME_S);

/** Remembers the UI sounds scheduled recently, so a duplicate request is dropped. */
export class UiOnce {
  private readonly seen: Array<{ name: UiSound; t: number }> = [];

  /** True if `name` at time t is new (and records it); false if it is already scheduled. */
  admit(name: UiSound, t: number, now: number): boolean {
    for (let i = this.seen.length - 1; i >= 0; i--) if (this.seen[i].t < now - 0.5) this.seen.splice(i, 1);
    const win = uiSameWindow(name);
    for (const s of this.seen) if (s.name === name && Math.abs(s.t - t) < win) return false;
    this.seen.push({ name, t });
    return true;
  }

  clear(): void {
    this.seen.length = 0;
  }
}

/** The Gift Storm's finale by grade (0 none, 1 some, 2 a big haul, 3 a clean sweep): the cascade's
 *  length, and whether it lands on the bright chord. */
export function stormCascade(grade: number): { notes: number; chord: boolean; falling: boolean } {
  const g = clampInt(grade, 0, 3);
  if (g === 0) return { notes: 2, chord: false, falling: true };
  return { notes: 3 + 2 * g, chord: g === 3, falling: false };
}
