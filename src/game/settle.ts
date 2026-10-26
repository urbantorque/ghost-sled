import { MissionResult, MissionState, RunSummary, applyRun } from './missions';
import type { SaveData } from './save';

// Settling a run into the save: the run count, ghosts passed, lifetime stats and missions. A revive
// followed by a second crash settles the same run again, so everything is credited as the difference
// from the first settlement: a run counts once, its passes once, and its missions are judged once on
// the run's final summary (as if the first results screen had never been shown).

/** What one run has credited to the save so far. */
export interface Settlement {
  /** The mission state from before this run settled; a re-settle replays the run onto it. */
  missionsBefore: MissionState;
  missionReward: number;
  passed: number;
  perfects: number;
  yetiHop: boolean;
  outranAvalanche: boolean;
}

export interface SettleResult {
  settlement: Settlement;
  missions: MissionResult[];
  /** Gifts newly credited for missions by this call (0 on a re-settle that finished nothing new). */
  missionReward: number;
  /** Lifetime ghosts passed before this call credited its passes (for unlock checks). */
  passedBefore: number;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function settleRun(d: SaveData, sum: RunSummary, prior: Settlement | null): SettleResult {
  if (!prior) d.runs++;
  const missionsBefore = prior ? prior.missionsBefore : clone(d.missions);
  d.missions = clone(missionsBefore);
  const m = applyRun(d.missions, sum);
  const missionReward = Math.max(0, m.reward - (prior?.missionReward ?? 0));
  d.gifts += missionReward;
  d.lifetimeGifts += missionReward;
  const passedBefore = d.ghostsPassed;
  d.ghostsPassed += Math.max(0, sum.ghostsPassed - (prior?.passed ?? 0));
  d.stats.perfects += Math.max(0, sum.perfects - (prior?.perfects ?? 0));
  if (sum.yetiHop && !prior?.yetiHop) d.stats.yetiHops++;
  if (sum.outranAvalanche && !prior?.outranAvalanche) d.stats.avalanches++;
  return {
    settlement: {
      missionsBefore,
      missionReward: Math.max(m.reward, prior?.missionReward ?? 0),
      passed: Math.max(sum.ghostsPassed, prior?.passed ?? 0),
      perfects: Math.max(sum.perfects, prior?.perfects ?? 0),
      yetiHop: sum.yetiHop || !!prior?.yetiHop,
      outranAvalanche: sum.outranAvalanche || !!prior?.outranAvalanche,
    },
    missions: m.views,
    missionReward,
    passedBefore,
  };
}
