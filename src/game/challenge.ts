import { MOUNTAINS } from '../sim/mountains';
import { type RunRecord, headerFromString, recordFromString } from '../sim/replay';
import { SIM_VERSION } from '../sim/sim';
import { FINISH_Z } from './standing';

// Reading a challenge link, whichever way it arrived (`?c=` or the platform's invite param). A link
// from this build is a friend's ghost to race. A link from an older build cannot ride this course, but
// it says whose run it was, where and how far: on its mountain that distance is a target.
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

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** The title's line for an old link: "Mila rode 2,340 m on the old Pinecrest. Beat it." */
export function oldLinkLine(o: Pick<OldLink, 'name' | 'distance' | 'mountain'>): string {
  return `${o.name} rode ${NF.format(Math.round(o.distance))} m on the old ${o.mountain}. Beat it.`;
}
