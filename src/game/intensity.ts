// Musical intensity: the 0..1 drive the music engine builds its arrangement by. The director fills
// IntensityInput once per frame from the sim and the race; the audio engine smooths the result (fast
// rise, slow fall), adds short accents on big moments and holds it low under a chaos reveal.
//
// Where the layers come in (music.ts levels()): pad always; bass from 0.26 (full at 0.40); hats from
// 0.30 (full at 0.45); arp from 0.58 and kick from 0.60 (full at about 0.73); clap and sparkle from
// 0.80; the lead from 0.85. So:
//   - the run floor (0.30 from 2.5 s) already has the bass under the pad;
//   - cruising (18 m/s or more, about 10 s into a novice run) sits at 0.36: bass and hats;
//   - the pack within 8 m (+0.06), a skill chain (+0.07 at x3, +0.22 at x10), earned flow (up to
//     +0.18) and New ground (+0.08) climb toward the arp and kick at 0.6 and the full band past 0.8;
//   - boosting alone tops out at +0.16 more (0.52 at 42 m/s), so speed never pins the arrangement.
// Drafting never pumps the band: skillChain counts only non-draft style events and earnedFlow is
// capped by it (see earnedFlow), so a draft-only x10 adds nothing but the speed it brings.
//
// Pure: no DOM, render or audio imports.

export interface IntensityInput {
  /** Horizontal speed, m/s. */
  speed: number;
  /** The sim combo's multiplier, 1..10 (not used by the curve: drafting alone climbs it). */
  mult: number;
  /** The live combo's non-draft style events (resets on bank, loss and revive). */
  skillChain: number;
  /** Flow earned by skill, 0..6 (drafting alone never lifts it; see earnedFlow()). */
  earnedFlow: number;
  /** A live ghost is within 8 m, or a duel is open. */
  raceNear: boolean;
  /** 0..1 tension: the avalanche closing in, the yeti near. */
  danger: number;
  /** This run rolled a chaos event. */
  eventRolled: boolean;
  /** Extra lift: New ground (+0.08 for the rest of the run), an avalanche escape (+0.2 fading over 8 s). */
  lift: number;
  /** Seconds of run time. */
  runTime: number;
  /** The run-start reveal is up on a chaos run: the band waits for the card to collapse. */
  countIn: boolean;
}

/** Run time (s) from which the floor holds: the bass is in a breath after Ride. */
export const FLOOR_FROM = 2.5;
/** The run floor: bass in under the pad, hats still waiting for speed. */
export const RUN_FLOOR = 0.3;
/** The ceiling while the chaos reveal counts the band in. */
export const COUNT_IN_MAX = 0.25;
/** Skill multiplier cap (as the sim's combo multiplier). */
export const SKILL_MULT_MAX = 10;

const clamp = (v: number, lo: number, hi: number): number => (v > lo ? (v < hi ? v : hi) : lo);
/** NaN and missing fields read as 0, so a stray value can never reach an AudioParam. */
const num = (v: number): number => (Number.isFinite(v) ? v : 0);

/** The skill multiplier a live combo has earned: 1 plus one per three skill events, capped at 10. */
export function skillMult(skillChain: number): number {
  return Math.min(SKILL_MULT_MAX, 1 + Math.floor(Math.max(0, num(skillChain)) / 3));
}

/**
 * Flow that skill earned: the sim's flow (0..6), but never more than the live combo's skill chain
 * (a quarter per non-draft style event) plus half a point per perfect landing in it. Drafting alone
 * fills the sim's flow in about 12 s and earns none of it.
 */
export function earnedFlow(simFlow: number, skillChain: number, perfects: number): number {
  const cap = Math.max(0, num(skillChain)) / 4 + 0.5 * Math.max(0, num(perfects));
  return clamp(Math.min(num(simFlow), cap), 0, 6);
}

export interface IntensityTerms {
  /** Ramps 0 to 0.36 from 8 to 18 m/s (measured novice speeds: 15.9 m/s at 6 s, 19 m/s at 10 s), then +0.16 more from 22 to 42 m/s. */
  speedK: number;
  /** 0.22 * log10(skillMult): +0.07 at x3, +0.22 at x10. */
  skill: number;
  /** 0.18 * earnedFlow / 6. */
  flowK: number;
  /** 0.06 with the pack close or a duel open. */
  race: number;
  /** 0.35 * danger. */
  danger: number;
  /** 0.04 on a run with a chaos event. */
  event: number;
  lift: number;
  /** RUN_FLOOR from FLOOR_FROM seconds, else 0. */
  floor: number;
}

/** Each term of the curve, for the probes and the tests. */
export function intensityTerms(i: IntensityInput): IntensityTerms {
  const speed = num(i.speed);
  return {
    speedK: 0.36 * clamp((speed - 8) / 10, 0, 1) + 0.16 * clamp((speed - 22) / 20, 0, 1),
    skill: 0.22 * Math.log10(skillMult(i.skillChain)),
    flowK: (0.18 * clamp(num(i.earnedFlow), 0, 6)) / 6,
    race: i.raceNear ? 0.06 : 0,
    danger: 0.35 * clamp(num(i.danger), 0, 1),
    event: i.eventRolled ? 0.04 : 0,
    lift: Math.max(0, num(i.lift)),
    floor: num(i.runTime) >= FLOOR_FROM ? RUN_FLOOR : 0,
  };
}

export function intensity(i: IntensityInput): number {
  const t = intensityTerms(i);
  const sum = t.speedK + t.skill + t.flowK + t.race + t.danger + t.event + t.lift;
  const v = clamp(Math.max(t.floor, sum), 0, 1);
  return i.countIn ? Math.min(v, COUNT_IN_MAX) : v;
}
