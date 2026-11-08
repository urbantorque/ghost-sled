// The run's arrangement in sections (round 6), pure, so the tests read it in node. A run opens on a
// two-bar intro (the hook's head on bells), then verses and choruses take turns; a set piece, a stage
// line or the finish lands a drop: the bars before it build (a riser, a snare roll, the kick out for the
// last two beats), and the drop starts a chorus on its downbeat (the finish, the finale). A set piece ridden
// out, or a wipeout, breaks the band down for four bars.
//
// Landings are placed on the band's grid: on the beat nearest the moment the rider gets there, at least
// LAND_MIN_STEPS ahead of what is already scheduled (the drop's pad is built half a bar ahead), on a bar
// line or on beat 3 or 4. A drop on beat 3 or 4 cuts its bar to 2/4 or 3/4: the beat becomes the next
// bar's downbeat, the oldest edit in the book, so the music meets the picture instead of the picture
// waiting a bar for the music.

export type SectionName = 'intro' | 'verse' | 'chorus' | 'bridge' | 'finale';

export interface Sec {
  name: SectionName;
  /** Bar within the section. */
  bar: number;
  len: number;
}

export const SECTION_LEN: Record<SectionName, number> = { intro: 2, verse: 8, chorus: 8, bridge: 4, finale: 64 };

export const sec = (name: SectionName, bar = 0): Sec => ({ name, bar, len: SECTION_LEN[name] });

/** What the next bar plays when no landing claims it. `breakdown`: a set piece just ended (or a wipeout):
 *  the bridge now. */
export function nextSec(s: Sec, breakdown: boolean): Sec {
  if (s.name === 'finale') return { ...s, bar: s.bar + 1 };
  if (breakdown && s.name !== 'bridge') return sec('bridge');
  if (s.bar + 1 < s.len) return { ...s, bar: s.bar + 1 };
  switch (s.name) {
    case 'intro':
      return sec('verse');
    case 'verse':
      return sec('chorus');
    case 'chorus':
      return sec('verse');
    case 'bridge':
      return sec('verse');
  }
}

/** A drop must sit at least this many 16ths past the next step to be scheduled: its pad is built half a bar
 *  (8 steps) ahead, and two more leave a scheduler pass to spare. At 112 bpm about 1.45 s from now. */
export const LAND_MIN_STEPS = 10;
/** How far ahead a landing may be placed (steps). */
export const LAND_MAX_STEPS = 48;
/** Where in a bar a drop may land: the downbeat, or beat 3 or 4 (cutting the bar short). */
export const LAND_BEATS: readonly number[] = [0, 8, 12];
/** A cut bar is a little less natural than a whole one: a downbeat wins a tie within this (s). */
export const CUT_PENALTY_S = 0.12;

/**
 * The step a landing goes on: of the beats LAND_MIN_STEPS to LAND_MAX_STEPS past `step` (the next step
 * to schedule, which sounds at `base`, `dur` seconds a step) at a bar line or on beat 3 or 4, the one
 * nearest `target` (a cut beat pays CUT_PENALTY_S).
 */
export function landingStep(step: number, base: number, dur: number, target: number): { step: number; t: number } {
  let best = -1;
  let bestT = 0;
  let bestCost = Infinity;
  const from = step + LAND_MIN_STEPS;
  for (let s = from; s <= step + LAND_MAX_STEPS; s++) {
    if ((s & 3) !== 0 || !LAND_BEATS.includes(s & 15)) continue;
    const t = base + (s - step) * dur;
    const cost = Math.abs(t - target) + ((s & 15) === 0 ? 0 : CUT_PENALTY_S);
    if (cost < bestCost) {
      bestCost = cost;
      best = s;
      bestT = t;
    }
  }
  return { step: best, t: bestT };
}

/** The bar line a cut landing makes: a step that is not a downbeat becomes the next bar's first step. */
export function cutTo(step: number): number {
  return (step & 15) === 0 ? step : (step | 15) + 1;
}
