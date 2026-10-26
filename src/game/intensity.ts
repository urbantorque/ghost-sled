// Musical intensity: the 0..1 drive the music engine fades its layers in by (0 pad, 0.4 bass and hats,
// 0.7 arp and kick, 0.9 everything). The director fills IntensityInput once per frame from the sim
// and the race; the audio engine smooths the result (fast rise, slow fall).
//
// Pure: no DOM, render or audio imports.
//
// Scaffold: intensity() is the game's formula as it stood before the fun pass (speed, combo
// multiplier, danger and whether an event was rolled). The other inputs are carried so the new curve
// can land here without touching the director.

export interface IntensityInput {
  /** Horizontal speed, m/s. */
  speed: number;
  /** The sim combo's multiplier, 1..10. */
  mult: number;
  /** The live combo's non-draft style events (resets on bank, loss and revive). */
  skillChain: number;
  /** Flow earned by skill, 0..6 (drafting alone never lifts it). */
  earnedFlow: number;
  /** A live ghost is close. */
  raceNear: boolean;
  /** 0..1 tension: the avalanche closing in, the yeti near. */
  danger: number;
  /** This run rolled a chaos event. */
  eventRolled: boolean;
  /** Extra lift: New ground, an avalanche escape. */
  lift: number;
  /** Seconds of run time. */
  runTime: number;
  /** The run-start reveal is up on a chaos run. */
  countIn: boolean;
}

/** The skill multiplier a live combo has earned: 1 plus one per three skill events, capped at 10. */
export function skillMult(skillChain: number): number {
  return Math.min(10, 1 + Math.floor(Math.max(0, skillChain) / 3));
}

export function intensity(i: IntensityInput): number {
  return Math.min(1, Math.max(0, (i.speed - 10) / 34) * 0.55 + Math.min(1, i.mult / 8) * 0.3 + i.danger * 0.35 + (i.eventRolled ? 0.05 : 0));
}
