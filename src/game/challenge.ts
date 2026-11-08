import { MOUNTAINS } from '../sim/mountains';
import { type RunRecord, headerFromString, recordFromString } from '../sim/replay';
import { SIM_VERSION } from '../sim/sim';
import type { RideMountain } from './cup';
import { FINISH_Z, recordStanding } from './standing';

// Reading a challenge link, whichever way it arrived (`?c=` or the platform's invite param). A link
// from this build is a friend's ghost to race. A link from an older build cannot ride this course, but
// it says whose run it was, where and how far: on its mountain that distance is a target. A run on a
// Daily or a Cup is a ghost only while that day or week lasts: its course is today's, or it is gone.
//
// Pure: no DOM, render or audio imports.

/** A challenge from an older build, read from its header. */
export interface OldLink {
  name: string;
  score: number;
  seed: number;
  mountain: string;
  /** How far their run went, as it says. It can be further than this course goes (targetZ). */
  distance: number;
}

export type ChallengeLink = { ghost: RunRecord; old?: undefined } | { old: OldLink; ghost?: undefined } | null;

/** Null for anything that is no link: a mangled string, or an old run on a mountain that is gone (a
 *  past Daily). Those are simply no challenge: there is nothing true to say about them. */
export function readChallengeLink(raw: string): ChallengeLink {
  try {
    return { ghost: recordFromString(raw) };
  } catch {
    try {
      const h = headerFromString(raw);
      const m = h.simVersion === SIM_VERSION ? undefined : MOUNTAINS.find((mm) => mm.seed === h.seed);
      return m ? { old: { name: h.name, score: h.score, seed: h.seed, mountain: m.name, distance: h.distance } } : null;
    } catch {
      return null;
    }
  }
}

/** Where an old link's band stands on this course: its distance, clamped to the finish. */
export function targetZ(o: Pick<OldLink, 'distance'>): number {
  return Math.min(o.distance, FINISH_Z);
}

/** The mountain a link's run was ridden on, among what can be ridden today (the four, today's Daily,
 *  this week's Cup): null for a day or a week that has gone, whose course no ride can open. */
export function linkMountain<M extends Pick<RideMountain, 'seed'>>(seed: number | undefined, today: readonly M[]): M | null {
  return today.find((m) => m.seed === seed) ?? null;
}

/** The friend line on the title. */
export interface LinkLine {
  name: string;
  score: number;
  /** Where, as the banner reads it: '' for a day or a week that has gone (the first line alone). */
  mountain: string;
  distance?: number;
  time?: number | null;
  daily?: boolean;
  /** Its mountain's rivals are still generating: the line stands, and Ride waits for them. */
  waiting?: boolean;
}

/**
 * What the title says about a friend's run, given what Ride would do: `riding` is the selected
 * mountain, `today` all a link can open. Null once another mountain is picked, or the link's could not
 * be got ready, because the ride under that button would not be theirs.
 */
export function linkLine(rec: Pick<RunRecord, 'name' | 'score' | 'distance' | 'seed' | 'ticks'>, today: readonly Pick<RideMountain, 'id' | 'name' | 'seed'>[], riding: Pick<RideMountain, 'seed'>, waiting: boolean): LinkLine | null {
  const who = { name: rec.name, score: rec.score };
  const at = linkMountain(rec.seed, today);
  // Another day's Daily or another week's Cup: no mountain named, and no ghost can ride.
  if (!at) return { ...who, mountain: '', daily: true };
  if (at.seed !== riding.seed) return null;
  const run = { distance: rec.distance, time: recordStanding(rec).time };
  if (at.id === 'daily') return { ...who, ...run, mountain: 'the Daily Mountain', daily: true, waiting };
  if (at.id === 'cup') return { ...who, ...run, mountain: 'the Weekly Cup', waiting };
  return { ...who, ...run, mountain: at.name };
}

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** The title's line for an old link: "Mila rode 2,340 m on the old Pinecrest. Beat it." */
export function oldLinkLine(o: Pick<OldLink, 'name' | 'distance' | 'mountain'>): string {
  return `${o.name} rode ${NF.format(Math.round(o.distance))} m on the old ${o.mountain}. Beat it.`;
}
