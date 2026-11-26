// What course.ts and each new mountain's own file (round 9: oldrun.ts and the rest) both need, in a module that
// imports neither: so a mountain's file can be imported first (its own test does) without a cycle through course.ts,
// which builds its tables from them. course.ts re-exports every name here, so nothing that imports them changes.
//
// Pure: no DOM, render or audio imports.

export const CHUNK_LEN = 64;
/** Half-width of the guaranteed obstacle-free lane around the safe line, metres. */
export const SAFE_LANE = 2.45;
/** Distance up the bank (past the corridor edge) where the treeline crashes you. */
export const FOREST_LIMIT = 10;

/** Corridor bank profile: a rounded rise past the edge that eases into a gentle forest floor. */
export function bank(e: number): number {
  if (e < 5) return 0.16 * e * e;
  if (e < 12) {
    const t = e - 5;
    return 4 + 1.6 * t - 0.1 * t * t;
  }
  return 10.3 + 0.2 * (e - 12);
}

/** The threshold at every stage line (round 8, the charm gates): a plain corridor from THRESHOLD_BEFORE metres above
 *  the line to THRESHOLD_AFTER past it, at least THRESHOLD_HW wide each side, with nothing standing on it, no kicker,
 *  mogul, drop, vent, rail or ice, and no place or set piece. Its kind is 'cruise' (every lane already draws one). The
 *  gate stands GATE_PAST_LINE past the line, 50 m into its body, with the 100 m above it plain and 80 m of it below.
 *  (Round 9: a new mountain lays its thresholds to the same bounds, as its own kind: Layout.threshold.) */
export const THRESHOLD_BEFORE = 40;
/** As far above the line as a threshold may start, where the stage above cannot fill its room exactly without it. */
export const THRESHOLD_BEFORE_MAX = 220;
export const THRESHOLD_AFTER = 180;
export const THRESHOLD_AFTER_MIN = 150;
export const THRESHOLD_HW = 11;
