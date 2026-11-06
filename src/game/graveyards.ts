import { hashString } from '../sim/prng';
import { FINISH_Z } from './standing';

// Graveyards: the mountain's named dangerous places. Where 2 or more of the bundled (or Daily) pool's
// riders went down within 40 m of each other, a cairn stands on the bank (world.setGraveyards) with a
// tag ('Widow's Bend: 4 fell here'), and riding 20 m past it alive is a graveyard beat: 'Survived
// Widow's Bend' and 3 gifts inside the run's extras cap (the app credits them into passBonus).
//
// Clusters come from the FULL pool (not the run's field, whose 25 m spacing splits these pairs), and
// from where its riders really fell: every tumble and wreck the pool generator read off a replay
// (PoolGhostData.falls). Tumbles forgive most hits, so run-end crashes alone gave Sakura three places
// and the other mountains none, while their riders were going down in the same few spots all along.
// A pool from before falls were recorded still works, from its run-end distances, leaving out everyone
// who never crashed: a rider who reached the finish line ended there on purpose.
// A mountain has more such places than cairns, so the deadliest ones stand, nearest first on a tie, and
// no two so close that one 'Survived' lands on the last.
//
// The tag says how many fell, so `fell` counts riders: one rider's two tumbles in a spot are one, and a
// slow rider (slowriders.ts) is a real run under a second name, whose falls were already counted.
// Names are picked from a short list by mountain key and distance, so a mountain always calls the
// same place by the same name. Nothing here touches the sim: the cairns stand off the corridor.
//
// Pure: no DOM, render or audio imports.

/** Riders that make a graveyard, and how close (metres, first to last) their falls sit. */
export const GRAVE_MIN = 2;
export const GRAVE_SPAN = 40;
/** At most this many per mountain (the world's cairn batch cap). */
export const GRAVE_MAX = 4;
/** Two graveyards stand at least this far apart (metres): about 5 s at cruise. */
export const GRAVE_APART = 150;
/** Ride this far past a graveyard alive (metres) to survive it. */
export const GRAVE_PAST = 20;
/** What surviving one pays (gifts, inside EXTRA_GIFTS_CAP). */
export const GRAVE_GIFTS = 3;
/** A pool ghost that rode this long reached the generator's cap: it never crashed (no falls to go on). */
const CAPPED_TICKS = 18000;

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
  'Frost Mercy',
  'Broken Rein',
  'Last Orders',
  'Thin Prayer',
] as const;

export interface Graveyard {
  /** Sim z (metres; sim.distance is max z), the mean of the cluster's crash distances. */
  z: number;
  name: string;
  /** How many fell here. */
  fell: number;
}

/** What a pool rider needs to have for a graveyard. */
export type GraveRider = { distance: number; ticks?: number; score?: number; falls?: readonly number[] };

/** Every fall in a pool, nearest first, with who fell. */
function fallsIn(pool: ReadonlyArray<GraveRider>): Array<{ z: number; rider: number }> {
  const out: Array<{ z: number; rider: number }> = [];
  // (A slow rider carries its base's run whole: the same score, distance and falls under a new name.)
  const seen = new Set<string>();
  pool.forEach((g, rider) => {
    if (g.falls) {
      const run = `${g.score}/${g.distance}/${g.falls.join()}`;
      if (seen.has(run)) return;
      seen.add(run);
      for (const z of g.falls) if (Number.isFinite(z) && z > 0 && z < FINISH_Z) out.push({ z, rider });
    } else if (Number.isFinite(g.distance) && g.distance > 0 && g.distance < FINISH_Z && !((g.ticks ?? 0) >= CAPPED_TICKS)) out.push({ z: g.distance, rider });
  });
  return out.sort((a, b) => a.z - b.z);
}

/**
 * The graveyards of a pool: runs of falls within GRAVE_SPAN metres with GRAVE_MIN or more riders in
 * them, the most riders first (the nearest on a tie), GRAVE_APART from each other, at most GRAVE_MAX.
 * They come back nearest first, each named deterministically from the mountain key and its distance
 * with no two alike. `taken` holds names other mountains already gave their places
 * (bundledGraveyards): they are skipped while the list has others left, and this mountain's names are
 * added to it.
 */
export function graveyards(pool: ReadonlyArray<GraveRider>, key: string, taken?: Set<string>): Graveyard[] {
  const d = fallsIn(pool);
  const spots: Array<{ z: number; fell: number }> = [];
  while (spots.length < GRAVE_MAX) {
    let best: { z: number; fell: number } | null = null;
    for (let i = 0; i < d.length; i++) {
      const riders = new Set<number>();
      let sum = 0;
      let k = i;
      for (; k < d.length && d[k].z - d[i].z <= GRAVE_SPAN; k++) {
        riders.add(d[k].rider);
        sum += d[k].z;
      }
      const z = Math.round((sum / (k - i)) * 10) / 10;
      if (riders.size < GRAVE_MIN || (best && riders.size <= best.fell) || spots.some((s) => Math.abs(s.z - z) < GRAVE_APART)) continue;
      best = { z, fell: riders.size };
    }
    if (!best) break;
    spots.push(best);
  }
  spots.sort((a, b) => a.z - b.z);
  const out: Graveyard[] = [];
  const used = new Set<number>();
  const N = GRAVE_NAMES.length;
  for (const { z, fell } of spots) {
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
    out.push({ z, name: GRAVE_NAMES[at], fell });
  }
  return out;
}

/**
 * The bundled mountains' graveyards, named together in the given order with one shared set, so no
 * name stands on two mountains ('Bonepile Bend' was both Pinecrest's 370 m cairn and Sakura's 291 m
 * one). Deterministic: the same pools always give the same names.
 */
export function bundledGraveyards(mountains: ReadonlyArray<{ key: string; pool: ReadonlyArray<GraveRider> }>): Map<string, Graveyard[]> {
  const taken = new Set<string>();
  const out = new Map<string, Graveyard[]>();
  for (const m of mountains) out.set(m.key, graveyards(m.pool, m.key, taken));
  return out;
}
