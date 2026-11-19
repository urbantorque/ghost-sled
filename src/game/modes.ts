import { ChaosEvent, type ChaosRoll, Mood } from '../sim/chaos';
import { hash32 } from '../sim/prng';
import type { LongNightSave } from './spinesave';

// Somewhere to go after The Twelve (round 8, G9): the Long Night and the mirror mountains.
//
// The Long Night is a gauntlet of whole mountains back to back, never stitched mid-course: Pinecrest, Frostfang,
// Ember, Sakura and Lanternfall, then the same five mirrored. What a rider holds at one line carries into the next
// leg (SimConfig.carry: the lantern, the get-ups left, the charms held, and the chaos step), the start line's charm
// gate is the pick between legs, chaos rises each leg, and the best depth (legs finished, then metres into the next)
// is kept. The legs a save may ride open on the Almanac's pages (almanac.ts legsOpen: 3, then 6, then all ten).
//
// A mirror mountain flips the picture and the steering and leaves the sim alone: a mirrored run is an ordinary run
// with its steering read the other way, so its record is an ordinary record and replays as one, and every ghost is
// drawn mirrored with you. Its bests, times and ladder live under their own key (mirrorKey).
//
// Pure: no DOM, render or audio imports.

export const LEGS: readonly { mountain: string; mirror: boolean }[] = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall', 'pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'].map((mountain, i) => ({ mountain, mirror: i >= 5 }));

/** What one leg hands the next: the names of SimConfig.carry (r8-sim's batch). */
export interface LongNightCarry {
  lantern: number;
  getUps: number;
  charms: number[];
  chaos: number;
}

/** The chaos step of a leg: plain, then a mood from the second leg, a mood and an event from the fourth. */
export function legStep(leg: number): number {
  return leg <= 0 ? 0 : leg < 3 ? 1 : 2;
}

/** A leg's roll: its mood and event from the night's seed, rising by legStep. */
export function legChaos(seed: number, leg: number): ChaosRoll {
  const step = legStep(leg);
  const moods = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];
  const events = [ChaosEvent.Avalanche, ChaosEvent.Yeti, ChaosEvent.GiftStorm, ChaosEvent.GhostTrain];
  const s = hash32(seed >>> 0, 0x10a6, leg);
  return {
    mood: step >= 1 ? moods[s % moods.length] : Mood.None,
    event: step >= 2 ? events[hash32(s, 1) % events.length] : ChaosEvent.None,
    seed: hash32(s, 2),
  };
}

/** The carry into the next leg from where a leg ended: what the rider held at the line. */
export function carryFrom(held: { lantern: number; getUps: number; charms: readonly number[] }, nextLeg: number): LongNightCarry {
  return { lantern: Math.max(0, held.lantern), getUps: Math.max(0, Math.floor(held.getUps)), charms: [...held.charms], chaos: legStep(nextLeg) };
}

/** A night's depth: legs finished and metres into the next. */
export function deeper(a: LongNightSave | null | undefined, b: LongNightSave): boolean {
  if (!a) return b.legs > 0 || b.z > 0;
  return b.legs > a.legs || (b.legs === a.legs && b.z > a.z);
}

/** The best depth after a night ended: legs finished, metres into the last. */
export function settleLongNight(best: LongNightSave | undefined, legs: number, z: number): { save: LongNightSave | undefined; newBest: boolean } {
  const run = { legs: Math.max(0, Math.floor(legs)), z: Math.max(0, Math.round(z)) };
  return deeper(best, run) ? { save: run, newBest: true } : { save: best, newBest: false };
}

/** The save key of a mountain mirrored. */
export function mirrorKey(id: string): string {
  return `mirror:${id}`;
}

export function isMirrorKey(key: string): boolean {
  return key.startsWith('mirror:');
}

/** The steering a mirrored run sends the sim: the input's steer read the other way (0 to 8 about 4). */
export function mirrorSteer(steer: number): number {
  return 8 - steer;
}
