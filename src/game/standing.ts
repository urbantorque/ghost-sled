import { STAGE_LENGTHS } from '../sim/course';

// The race's one order. Finishers rank by finish time, then riders who did not finish rank by
// distance. Every comparator, every row and every line of copy goes through here, so no two places
// can disagree: distance is max z, so finishers tie on it, and a stopped ghost must never read as
// passed.
//
// Pure: no DOM, render or audio imports.

/** The finish line, metres (every course runs the same stages). */
export const FINISH_Z = STAGE_LENGTHS.reduce((a, b) => a + b, 0);

export interface Standing {
  /** Finish time in seconds, or null for a rider who did not finish. */
  time: number | null;
  /** How far the whole run went, metres. */
  distance: number;
}

/** a ranks ahead of b. A dead heat is no lead: a tie leaves you where you are. */
export function aheadOf(a: Standing, b: Standing): boolean {
  if (a.time !== null && b.time !== null) return a.time < b.time;
  if (a.time !== null) return true;
  if (b.time !== null) return false;
  return a.distance > b.distance;
}

/** Array.sort order: first place first. */
export function byStanding(a: Standing, b: Standing): number {
  return aheadOf(a, b) ? -1 : aheadOf(b, a) ? 1 : 0;
}

/** Your place once you crossed the line on `finishTick`: only a ghost already over it leads you. A
 *  coast past where a ghost stopped changes nothing, and everyone still riding has lost to you. */
export function placeAtFinish(tracks: ReadonlyArray<{ ready: boolean; finishTick: number }>, finishTick: number): { rank: number; of: number } {
  let ahead = 0;
  let n = 0;
  for (const t of tracks) {
    if (!t.ready) continue;
    n++;
    if (t.finishTick >= 0 && t.finishTick < finishTick) ahead++;
  }
  return { rank: ahead + 1, of: n + 1 };
}

/** A record's standing from its header: a finished run's `ticks` is the tick it crossed the line. */
export function recordStanding(r: { ticks: number; distance: number }): Standing {
  return { time: r.distance >= FINISH_Z && r.ticks > 0 ? r.ticks / 60 : null, distance: r.distance };
}

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Whole tenths, floored, as a clock reads them (a tick past .4 is still .4). */
function tenths(s: number): number {
  return Math.floor(s * 10 + 1e-6);
}

/** A time as the clock shows it: 151.46 -> "2:31.4". */
export function clock(seconds: number): string {
  const t = Math.max(0, tenths(seconds));
  const m = Math.floor(t / 600);
  const s = t - m * 600;
  const whole = Math.floor(s / 10);
  return `${m}:${whole < 10 ? '0' : ''}${whole}.${s % 10}`;
}

/** A gap in whole tenths as words: 12 -> "1.2 s". */
export function gapSeconds(tenthsGap: number): string {
  return `${(tenthsGap / 10).toFixed(1)} s`;
}

/** What a row shows: a time for a finisher, metres for the rest. */
export function figure(s: Standing): string {
  return s.time !== null ? clock(s.time) : `${NF.format(Math.round(s.distance))} m`;
}

/** The gap between two times as their rows read, in whole tenths (2:31.4 over 2:32.6 is 12). */
export function timeGap(a: number, b: number): number {
  return Math.abs(tenths(a) - tenths(b));
}

/** A split as the clocks read it: `seconds` on yours, `delta` from theirs (+ = you are behind). "1.2 s",
 *  or null under a tenth. The same sum as a margin, so a line and the card beside it cannot disagree. */
export function splitGap(seconds: number, delta: number): string | null {
  const d = timeGap(seconds, seconds - delta);
  return d < 1 ? null : gapSeconds(d);
}

/**
 * The margin of `lead` over `trail`, as their two rows read: "1.2 s" between finishers, "85 m" between
 * riders who did not finish, under a tenth or a metre "less than ...". Null when only `lead` finished:
 * a time and a distance share no unit, so the words are 'to the finish' (marginPhrase).
 */
export function margin(lead: Standing, trail: Standing): string | null {
  if (lead.time !== null && trail.time !== null) {
    const d = timeGap(lead.time, trail.time);
    return d < 1 ? 'less than 0.1 s' : gapSeconds(d);
  }
  if (lead.time === null && trail.time === null) {
    const d = Math.round(lead.distance) - Math.round(trail.distance);
    return d < 1 ? 'less than 1 m' : `${NF.format(d)} m`;
  }
  return null;
}

/** "by 1.2 s", "by 85 m" or "to the finish": what follows "beat you" or "You beat Mila". */
export function marginPhrase(lead: Standing, trail: Standing): string {
  const m = margin(lead, trail);
  return m === null ? 'to the finish' : `by ${m}`;
}

/**
 * A rider's predicted finish time, seconds: the time itself for a finisher, else the pace so far
 * carried to the line (distance over seconds, extrapolated). 0 when nothing can be said.
 */
export function predictedTime(distance: number, seconds: number, finishZ = FINISH_Z): number {
  if (!(distance > 0) || !(seconds > 0)) return 0;
  return distance >= finishZ ? seconds : (seconds * finishZ) / distance;
}
