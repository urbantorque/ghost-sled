import { ChaosEvent, type ChaosRoll, Mood } from '../sim/chaos';
import type { MountainDef } from '../sim/mountains';
import { hash32, hashString } from '../sim/prng';

// The weekly Cup: one mountain for the ISO week, with the same mood, event and field for everyone,
// every bit of it derived from the week key the way dailySeed derives a Daily from its day. Same run
// flow as the Daily, sharing its worker pool generation: best time this week, a Cup medal, and the
// week's entries pruned with the Daily's. The mood and event are the Cup's identity, so a Cup always
// has a mood (the Daily's plain days are the Daily's).
//
// (MountainId is the sim's and has no Cup: a seed is all the sim ever reads of a mountain, so the game
// layer widens the id here rather than asking the sim to know about weeks.)
//
// Pure: no DOM, render or audio imports.

export interface CupMountain extends Omit<MountainDef, 'id'> {
  id: 'cup';
}

/** Any mountain a run can ride. */
export type RideMountain = MountainDef | CupMountain;

const CUP_MOODS: readonly Mood[] = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];
const CUP_EVENTS: readonly ChaosEvent[] = [ChaosEvent.None, ChaosEvent.Avalanche, ChaosEvent.Yeti, ChaosEvent.GiftStorm, ChaosEvent.GhostTrain];

/** The ISO week of a UTC date, like 2026-W45: Monday to Sunday, and the week's year is its Thursday's. */
export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** The week of a 'YYYY-MM-DD' day key ('' when the key is not a day). */
export function weekOfDay(day: string): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return p ? weekKey(new Date(Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3])))) : '';
}

/** 45 from '2026-W45' (0 when the key is not a week). */
export function weekNumber(key: string): number {
  const p = /-W(\d{2})$/.exec(key);
  return p ? Number(p[1]) : 0;
}

export function cupSeed(key: string): number {
  return hashString('ghost-sled-cup/' + key);
}

export function cupMountain(key: string): CupMountain {
  return { id: 'cup', name: 'Weekly Cup', tagline: key, seed: cupSeed(key), unlockGhosts: 0 };
}

/** The week's mood, event and event placement: fixed, whoever rides and however often. */
export function cupChaos(key: string): ChaosRoll {
  const seed = cupSeed(key);
  return {
    mood: CUP_MOODS[hash32(seed, 0xc0b1) % CUP_MOODS.length],
    event: CUP_EVENTS[hash32(seed, 0xc0b2) % CUP_EVENTS.length],
    seed: hash32(seed, 0xc0b3),
  };
}
