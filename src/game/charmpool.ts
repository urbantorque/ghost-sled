import { STARTER_POOL } from '../sim/charms';
import type { SaveData } from './save';

// What a run's charm gates may offer, how many stand, and whether this is a save's very first run (round 8): the
// three things the save decides for SimConfig. One getter each, so the Almanac (the spine lane) widens the pool and
// opens the gates in one place. The record carries all three, so a run replays as it was dealt.

/** The charms this rider may be offered (charms.ts, a 24-bit mask). The Almanac widens it; for now the starter pool. */
export function charmPoolOf(save: SaveData): number {
  void save;
  return STARTER_POOL;
}

/** How many charm gates stand this run (1: only the start's). The Almanac opens the second and third. */
export function charmGatesOf(save: SaveData): 1 | 2 | 3 {
  void save;
  return 3;
}

/** A fresh save's very first run: its stomp window is wider (sim.ts FIRST_RUN_STOMP). */
export function firstRunOf(save: SaveData): boolean {
  return save.runs === 0;
}
