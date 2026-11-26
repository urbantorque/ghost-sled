import { ALL_EVENTS, ChaosEvent, type ChaosRoll, Mood, eventInfo, moodInfo, withEvents } from '../sim/chaos';
import { eventsFor } from '../sim/course';
import { MOUNTAINS } from '../sim/mountains';
import { CHARMS } from '../sim/charms';
import { hash32 } from '../sim/prng';
import { LANTERN } from '../sim/sim';
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

/** The night's mountains in the ladder's order (round 9: the three new ones where they unlock, Lanternfall the finale),
 *  then the same mirrored. The five's ten until all three are registered, then all sixteen, in one change. */
const NIGHT: readonly string[] = ['pinecrest', 'frostfang', 'gablefall', 'ember', 'oldrun', 'sakura', 'gullhaven', 'lanternfall'];
const FIVE_NIGHT: readonly string[] = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];
const NIGHT_ORDER = NIGHT.every((id) => MOUNTAINS.some((m) => m.id === id)) ? NIGHT : FIVE_NIGHT;
export const LEGS: readonly { mountain: string; mirror: boolean }[] = [...NIGHT_ORDER, ...NIGHT_ORDER].map((mountain, i) => ({ mountain, mirror: i >= NIGHT_ORDER.length }));
/** The legs the Almanac's last night page opens ("all ten" when it was written): every leg. */
const ALL_LEGS_PAGE = 10;

/** The mid-run events a leg's mountain may meet (course.ts eventsFor; every event for an id not registered). */
function eventsOf(id: string): number {
  const m = MOUNTAINS.find((q) => q.id === id);
  return m ? eventsFor(m.seed) : ALL_EVENTS;
}

/** What one leg hands the next: the names of SimConfig.carry (r8-sim's batch). */
export interface LongNightCarry {
  lantern: number;
  getUps: number;
  charms: number[];
  chaos: number;
}

/** The chaos step of a leg: plain, then a mood from the second leg, a mood and an event from the third (the modes
 *  lane: the first night the Almanac opens is three legs, so it rises on every one of them; the spine had the event
 *  from the fourth, and a three-leg night never met it). */
export function legStep(leg: number): number {
  return leg <= 0 ? 0 : leg < 2 ? 1 : 2;
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

/** Charms a leg carries into the next (SimConfig.carry holds three). */
export const CARRIED_CHARMS = 3;

/** The carry into the next leg from where a leg ended: what the rider held at the line. The charms carried are the
 *  last three taken (the modes lane): each leg's gates add to what you hold, so what you chose this leg rides with you
 *  and the oldest gives way. Carried first-taken, a night's charms were set on its first leg and every later gate was
 *  a pick for one leg only. */
export function carryFrom(held: { lantern: number; getUps: number; charms: readonly number[] }, nextLeg: number): LongNightCarry {
  return { lantern: Math.max(0, held.lantern), getUps: Math.max(0, Math.floor(held.getUps)), charms: held.charms.slice(-CARRIED_CHARMS), chaos: legStep(nextLeg) };
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

// ---------------------------------------------------------------- a night under way (the modes lane)

/** A Long Night being ridden: its seed (every leg's chaos is drawn from it), the leg now ridden (0 first), how many
 *  legs the save may ride (almanac.ts legsOpen), and what this leg carried in from the last (null on the first). */
export interface Night {
  seed: number;
  leg: number;
  legs: number;
  carry: LongNightCarry | null;
}

/** One leg as a run starts it: the mountain, mirrored or not, its chaos, the carry the sim takes in
 *  (SimConfig.carry: the chaos step is the roll's, so it is not sent), its save key, and where it stands in the night. */
export interface NightLeg {
  mountain: string;
  mirror: boolean;
  chaos: ChaosRoll;
  carry: { lantern: number; getUps: number; charms: number[] } | undefined;
  key: string;
  /** 1-based, and of how many. */
  n: number;
  of: number;
}

/** A night starts at its first leg, or not at all before the Almanac opens it. */
export function startNight(seed: number, legsOpen: number): Night | null {
  // (Round 9: the page that opened all ten legs opens every leg there is.)
  const legs = Math.max(0, Math.min(LEGS.length, Math.floor(legsOpen >= ALL_LEGS_PAGE ? LEGS.length : legsOpen)));
  return legs > 0 ? { seed: seed >>> 0, leg: 0, legs, carry: null } : null;
}

/** The save key a night's leg keeps its best under: its own, so a leg's carried lantern and its risen chaos never
 *  stand on the mountain's ladder, and your best leg there rides as your ghost the next night. */
export function nightKey(mountain: string, mirror: boolean): string {
  return `night:${mirror ? mirrorKey(mountain) : mountain}`;
}

export function isNightKey(key: string): boolean {
  return key.startsWith('night:');
}

/** The leg a night is on, as its run starts it. */
export function nightLeg(n: Night): NightLeg {
  const leg = LEGS[Math.max(0, Math.min(LEGS.length - 1, n.leg))];
  const c = n.leg > 0 ? n.carry : null;
  return {
    mountain: leg.mountain,
    mirror: leg.mirror,
    chaos: withEvents(legChaos(n.seed, n.leg), eventsOf(leg.mountain)),
    carry: c ? { lantern: c.lantern, getUps: c.getUps, charms: [...c.charms] } : undefined,
    key: nightKey(leg.mountain, leg.mirror),
    n: n.leg + 1,
    of: n.legs,
  };
}

/** A leg crossed its line holding this: the night's next leg (carrying it in), or null once every open leg is done. */
export function nightOn(n: Night, held: { lantern: number; getUps: number; charms: readonly number[] }): Night | null {
  const next = n.leg + 1;
  if (next >= n.legs) return null;
  return { seed: n.seed, leg: next, legs: n.legs, carry: carryFrom(held, next) };
}

/** How deep a night went: legs finished, and metres into the leg it ended on (0 once every open leg is done). */
export function nightDepth(n: Night, finished: boolean, metres: number): LongNightSave {
  const legs = n.leg + (finished ? 1 : 0);
  return { legs, z: finished ? 0 : Math.max(0, Math.round(metres)) };
}

const LEG_NAMES: Readonly<Record<string, string>> = { pinecrest: 'Pinecrest', frostfang: 'Frostfang', ember: 'Ember Peak', sakura: 'Sakura Ridge', lanternfall: 'Lanternfall', oldrun: 'The Old Run', gullhaven: 'Gullhaven', gablefall: 'Gablefall' };

/** A depth in words: "3 legs", "2 legs and 640 m", "640 m into the first leg". */
export function depthWords(d: LongNightSave): string {
  const m = `${Math.round(d.z).toLocaleString('en-GB')} m`;
  if (d.legs <= 0) return `${m} into the first leg`;
  const legs = `${d.legs} ${d.legs === 1 ? 'leg' : 'legs'}`;
  return d.z > 0 ? `${legs} and ${m}` : legs;
}

/** What the beat between two legs says over the live scene: the leg to come and where, the night's chaos for it, and
 *  what rides in with you (the lantern's share of a full one, the get-ups, the charms held by name). */
export interface NightBeatView {
  n: number;
  of: number;
  mountain: string;
  mirror: boolean;
  /** The leg's mood and event by name ('' for none): the night deepening. */
  mood: string;
  event: string;
  lantern: number;
  getUps: number;
  charms: string[];
}

export function nightBeat(n: Night): NightBeatView {
  const leg = nightLeg(n);
  const c = n.carry;
  return {
    n: leg.n,
    of: leg.of,
    mountain: LEG_NAMES[leg.mountain] ?? leg.mountain,
    mirror: leg.mirror,
    mood: leg.chaos.mood !== Mood.None ? moodInfo(leg.chaos.mood).name : '',
    event: leg.chaos.event !== ChaosEvent.None ? eventInfo(leg.chaos.event).name : '',
    lantern: c ? Math.max(0, Math.min(3, c.lantern / LANTERN)) : 0,
    getUps: c ? c.getUps : 0,
    charms: c ? c.charms.filter((id) => id >= 0 && id < CHARMS.length).map((id) => CHARMS[id].name) : [],
  };
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
