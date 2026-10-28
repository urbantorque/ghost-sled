import type { Course } from '../sim/course';
import { fmt, NBSP } from '../ui/fmt';

// Graveyards: this run's spots where several pool ghosts fell (the director's clusters). Each gets a
// cairn on the bank beside the corridor (props.ts, Medium and High) and a tag over it in the ghost
// layer (ghosts.ts, every tier). Pure placement and copy, so both are testable without a renderer.

/** At most this many graveyards a run (the cairn batch's cap). */
export const GRAVE_CAP = 4;
/** Metres outside the corridor's edge where a cairn stands: on the bank, never in the line. */
export const GRAVE_OUT = 1.4;
/** The tag's anchor over the snow: just above the marker stake's top (about 4.1 m at the cairn's
 *  1.7 scale), so the pill never covers the ribbon. */
export const GRAVE_TAG_Y = 4.4;

export interface GravePlace {
  name: string;
  fell: number;
  /** Sim metres: the cairn on the bank and the tag's anchor height over the snow there. */
  x: number;
  z: number;
  y: number;
}

/** The side of the course a graveyard's cairn stands on (-1 or 1), from a hash of its z, so the same
 *  spot always gets the same side. Static: it never depends on chaos. */
export function graveSide(z: number): -1 | 1 {
  return Math.imul(Math.round(z * 7), 0x9e3779b1) >>> 31 ? 1 : -1;
}

/** Places up to GRAVE_CAP graveyards on the bank beside their sim z. */
export function placeGraves(c: Course, list: ReadonlyArray<{ z: number; name: string; fell: number }>): GravePlace[] {
  return list.slice(0, GRAVE_CAP).map((g) => {
    const x = c.centerX(g.z) + graveSide(g.z) * (c.halfWidth(g.z) + GRAVE_OUT);
    return { name: g.name, fell: g.fell, x, z: g.z, y: c.ground(x, g.z) + GRAVE_TAG_Y };
  });
}

/** The tag's two lines: the place's name over how many ghosts fell there ('Widow's Bend' over
 *  '4 ghosts fell here'). The count carries its noun (decision 35); a nameless spot reads 'Graveyard'. */
export function graveCopy(name: string, fell: number): { name: string; line: string } {
  const n = Math.max(1, Math.round(fell));
  return { name: name.trim() || 'Graveyard', line: `${fmt(n)}${NBSP}${n === 1 ? 'ghost' : 'ghosts'} fell here` };
}
