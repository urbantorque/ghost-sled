import { hashString } from '../sim/prng';

// Graveyards: the mountain's named dangerous places. Where 3 or more of the bundled (or Daily) pool's
// riders crashed within 8 m of each other, a cairn stands on the bank (world.setGraveyards) with a tag
// ('Widow's Bend: 4 fell here'), and riding 20 m past it alive is a graveyard beat: 'Survived Widow's
// Bend' and 3 gifts inside the run's extras cap (the app credits them into passBonus).
//
// Clusters come from the FULL pool (not the run's field, whose 25 m spacing splits these pairs): the
// pool riders' run-end distances, minus capped finishers (they never crashed). Pinecrest has two
// (365 to 372 m and 604 m), Ember one (350 m), Sakura four (216, 291, 395 with 4 riders, 1,728 m).
// Names are picked from a short list by mountain key and distance, so a mountain always calls the
// same place by the same name. Nothing here touches the sim: the cairns stand off the corridor.
//
// Pure: no DOM, render or audio imports.

/** Riders that make a graveyard, and how close (metres, first to last) their crashes sit. */
export const GRAVE_MIN = 3;
export const GRAVE_SPAN = 8;
/** At most this many per mountain (the world's cairn batch cap). */
export const GRAVE_MAX = 4;
/** Ride this far past a graveyard alive (metres) to survive it. */
export const GRAVE_PAST = 20;
/** What surviving one pays (gifts, inside EXTRA_GIFTS_CAP). */
export const GRAVE_GIFTS = 3;
/** A pool ghost that rode this long finished the generator's run: it never crashed (field.ts FINISH_TICKS). */
const FINISHED_TICKS = 18000;

/** Short place names (proper nouns, no pronouns, typographic apostrophes), at most 14 characters so
 *  'Name: 4 fell here' fits a phone tag. */
export const GRAVE_NAMES = [
  'Widow’s Bend',
  'Lantern Rest',
  'Hush Hollow',
  'Bonepile Bend',
  'Last Light',
  'Tumbler’s Gate',
  'Cold Comfort',
  'Grim Gully',
  'Rattle Run',
  'Sorrow Shelf',
  'Wreck Hollow',
  'Quiet Drop',
] as const;

export interface Graveyard {
  /** Sim z (metres; sim.distance is max z), the mean of the cluster's crash distances. */
  z: number;
  name: string;
  /** How many fell here. */
  fell: number;
}

/**
 * The graveyards of a pool: runs of GRAVE_MIN or more crash distances within GRAVE_SPAN metres
 * (greedy from the nearest), nearest first, at most GRAVE_MAX, each named deterministically from
 * the mountain key and its distance with no two alike. `taken` holds names other mountains already
 * gave their places (bundledGraveyards): they are skipped while the list has others left, and this
 * mountain's names are added to it.
 */
export function graveyards(pool: ReadonlyArray<{ distance: number; ticks?: number }>, key: string, taken?: Set<string>): Graveyard[] {
  const d = pool
    .filter((g) => Number.isFinite(g.distance) && g.distance > 0 && !((g.ticks ?? 0) >= FINISHED_TICKS))
    .map((g) => g.distance)
    .sort((a, b) => a - b);
  const out: Graveyard[] = [];
  const used = new Set<number>();
  let i = 0;
  while (i < d.length && out.length < GRAVE_MAX) {
    let k = i;
    while (k + 1 < d.length && d[k + 1] - d[i] <= GRAVE_SPAN) k++;
    const n = k - i + 1;
    if (n < GRAVE_MIN) {
      i++;
      continue;
    }
    let sum = 0;
    for (let j = i; j <= k; j++) sum += d[j];
    const z = Math.round((sum / n) * 10) / 10;
    const N = GRAVE_NAMES.length;
    // A per-mountain offset into the list, then the place's own hash; skip what is used here, and what
    // another mountain took while any name is still free.
    let at = (hashString(key) + hashString(`${key}:${Math.round(z)}`)) % N;
    const blocked = (j: number): boolean => used.has(j) || !!taken?.has(GRAVE_NAMES[j]);
    let tries = 0;
    while (blocked(at) && tries++ < N) at = (at + 1) % N;
    // (Every name taken somewhere: only this mountain's own must differ.)
    while (used.has(at)) at = (at + 1) % N;
    used.add(at);
    taken?.add(GRAVE_NAMES[at]);
    out.push({ z, name: GRAVE_NAMES[at], fell: n });
    i = k + 1;
  }
  return out;
}

/**
 * The bundled mountains' graveyards, named together in the given order with one shared set, so no
 * name stands on two mountains ('Bonepile Bend' was both Pinecrest's 370 m cairn and Sakura's 291 m
 * one). Deterministic: the same pools always give the same names.
 */
export function bundledGraveyards(mountains: ReadonlyArray<{ key: string; pool: ReadonlyArray<{ distance: number; ticks?: number }> }>): Map<string, Graveyard[]> {
  const taken = new Set<string>();
  const out = new Map<string, Graveyard[]>();
  for (const m of mountains) out.set(m.key, graveyards(m.pool, m.key, taken));
  return out;
}
