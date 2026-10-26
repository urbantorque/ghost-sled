import type { ResultsNextUnlock } from '../ui/contract';
import type { MissionState, RunSummary } from './missions';
import type { SaveData } from './save';

// Progress lines: mid-run mission pops, the next unlock, the title greeting, the Run Again label,
// the results race line and the challenge share title.
//
// Pure: no DOM, render or audio imports.
//
// Scaffold: the lines as they read today (no pops, no greeting, no extra race line, 'Run Again').

export interface MissionCtx {
  unlockedBiomes: ReadonlySet<string>;
}

/** Missions newly met mid-run that have not popped yet. Scaffold: none. */
export function missionsCrossed(_s: MissionState, _sum: RunSummary, _popped: ReadonlySet<string>, _ctx: MissionCtx): Array<{ id: string; text: string; reward: number }> {
  return [];
}

/** The next unlock to work toward (a mountain, then a sled), or null. Scaffold: null. */
export function nextUnlock(_d: SaveData): ResultsNextUnlock | null {
  return null;
}

/** A one-line title greeting, or null. Scaffold: null. */
export function titleGreeting(_d: SaveData, _mountainId: string, _mountainName: string): string | null {
  return null;
}

/** The Run Again button's label and accessible name. Scaffold: 'Run Again'. */
export function runAgainLabel(_friend: { name: string; beaten: boolean } | null, _grudge: { name: string } | null): { text: string; aria: string } {
  return { text: 'Run Again', aria: 'Run Again' };
}

/** The one extra race line on the results card (friend, then grudge, then event note). Scaffold: null. */
export function resultsRaceLine(_friendLine: string | null, _grudgeLine: string | null, _eventNote: string | null): { text: string; tone: 'friend' | 'grudge' | 'event' } | null {
  return null;
}

/** The share sheet's title for a challenge link. Scaffold: today's title. */
export function challengeShareTitle(_name: string, _distance: number, _mountain: string, _by: number | null): string {
  return 'Beat my Ghost Sled run';
}
