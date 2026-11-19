import { almanacGates, almanacPool } from './almanac';
import type { SaveData } from './save';

// What a run's charm gates may offer, how many stand, and whether this is a save's very first run (round 8): the
// three things the save decides for SimConfig. One getter each: the Almanac widens the pool and opens the gates
// (almanac.ts almanacPool, almanacGates). The record carries all three, so a run replays as it was dealt.

/** The charms this rider may be offered (charms.ts, a 24-bit mask): the six starters, widened page by page. */
export function charmPoolOf(save: SaveData): number {
  return almanacPool(save);
}

/** How many charm gates stand this run (1: only the start's). The Almanac opens the second (page 1) and third (page 4). */
export function charmGatesOf(save: SaveData): 1 | 2 | 3 {
  return almanacGates(save);
}

/** A fresh save's very first run: its stomp window is wider (sim.ts FIRST_RUN_STOMP). */
export function firstRunOf(save: SaveData): boolean {
  return save.runs === 0;
}
