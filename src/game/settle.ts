import { MissionResult, MissionState, RunSummary, applyRun, unlockedBiomes } from './missions';
import { RUN_DISTS_KEEP, pruneDaily, type Grudge, type SaveData } from './save';
import type { GhostKind } from '../ui/contract';

// Settling a run into the save: the run count, ghosts passed, lifetime stats, missions and the
// run-end distance. A revive followed by a second crash settles the same run again, so everything is
// credited as the difference from the first settlement: a run counts once, its passes once, its
// missions are judged once on the run's final summary (as if the first results screen had never been
// shown), and its distance replaces the one the first settlement pushed.
//
// The grudge is settled the same way, from a snapshot taken when the run started: settleGrudge is a
// pure function of that snapshot and the run's outcome, so a second call gives the same answer.

/** What one run has credited to the save so far. */
export interface Settlement {
  /** The mission state from before this run settled; a re-settle replays the run onto it. */
  missionsBefore: MissionState;
  missionReward: number;
  passed: number;
  perfects: number;
  yetiHop: boolean;
  outranAvalanche: boolean;
  /** The Daily medal this run has credited (0 none). */
  medal?: number;
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

/** How the run ended against the grudge it started with. */
export interface GrudgeOutcome {
  /** How far you went (sim.distance at the crash). */
  youDistance: number;
  /** The grudge at start, if it rode in this field: its whole run's distance and whether you passed it. */
  rode: { distance: number; passed: boolean } | null;
  /** The results' Next row: the ghost with the smallest positive distance - youDistance. */
  next: { name: string; score: number; record: string; distance: number; kind: GhostKind } | null;
}

/** A grudge on this many wins in a row is a nemesis. */
export const NEMESIS_STREAK = 3;

export function isNemesis(g: Pick<Grudge, 'streak'> | null | undefined): boolean {
  return !!g && (g.streak ?? 1) >= NEMESIS_STREAK;
}

/** The results line for a grudge that beat you (names only: handles carry no pronouns). */
export function grudgeLine(name: string, streak: number, by: number): string {
  if (streak >= NEMESIS_STREAK) return `${name} beat you ${streak} runs running. Nemesis.`;
  if (streak === 2) return `${name} beat you 2 runs running.`;
  return `${name} beat you by ${fmtM(by)}. ${name} will be waiting.`;
}

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fmtM = (m: number): string => `${NF.format(Math.max(1, Math.round(m)))} m`;

/**
 * The grudge after a run: tally, nemesis promotion and the results line. Idempotent from one
 * snapshot, so a revive's second settle gives the same answer.
 * - The grudge rode, finished ahead of you and was never passed: it stays, them +1, streak +1.
 * - You passed it or out-distanced it: settled (nemesisDown when its streak was 3 or more), and the
 *   Next row becomes the new grudge at 1 and 1.
 * - It did not ride (no grudge yet, or a record that can no longer ride): the Next row is elected.
 * A friend or your own best is never elected.
 */
export function settleGrudge(atStart: Grudge | null, o: GrudgeOutcome): { grudge: Grudge | null; settled: boolean; nemesisDown: boolean; line: string | null } {
  const next = o.next && o.next.kind !== 'friend' && o.next.kind !== 'you' && o.next.distance > o.youDistance ? o.next : null;
  const elect = (): Grudge | null => (next ? { name: next.name, score: next.score, record: next.record, them: 1, streak: 1, by: Math.round(next.distance - o.youDistance), distance: next.distance } : null);
  if (atStart && o.rode) {
    const them = atStart.them ?? 1;
    const streak = atStart.streak ?? 1;
    if (!o.rode.passed && o.rode.distance > o.youDistance) {
      const by = Math.round(o.rode.distance - o.youDistance);
      const g: Grudge = { ...atStart, them: them + 1, streak: streak + 1, by, distance: o.rode.distance };
      return { grudge: g, settled: false, nemesisDown: false, line: grudgeLine(g.name, g.streak ?? 1, by) };
    }
    const after = them >= 2 ? ` after ${them} runs` : '';
    return { grudge: elect(), settled: true, nemesisDown: streak >= NEMESIS_STREAK, line: `You settled it with ${atStart.name}${after}.` };
  }
  const g = elect();
  if (g) return { grudge: g, settled: false, nemesisDown: false, line: grudgeLine(g.name, 1, g.by ?? 0) };
  // Nothing finished ahead of you: a grudge that did not ride keeps waiting, unchanged.
  return { grudge: atStart, settled: false, nemesisDown: false, line: null };
}

/**
 * `key` is the save key of the mountain (daily runs use `daily:<day>`): the run-end distance is
 * pushed to runDists[key] (capped at 5; a re-settle replaces the entry the first settle pushed), and
 * a daily settle prunes the other days' entries.
 */
export function settleRun(d: SaveData, sum: RunSummary, prior: Settlement | null, key?: string): SettleResult {
  if (!prior) d.runs++;
  const passedBefore = d.ghostsPassed;
  d.ghostsPassed += Math.max(0, sum.ghostsPassed - (prior?.passed ?? 0));
  // Missions refill from the biomes open now, so a mountain this run unlocked joins the rotation.
  const missionsBefore = prior ? prior.missionsBefore : clone(d.missions);
  d.missions = clone(missionsBefore);
  const m = applyRun(d.missions, sum, { unlockedBiomes: unlockedBiomes(d.ghostsPassed) });
  const missionReward = Math.max(0, m.reward - (prior?.missionReward ?? 0));
  d.gifts += missionReward;
  d.lifetimeGifts += missionReward;
  d.stats.perfects += Math.max(0, sum.perfects - (prior?.perfects ?? 0));
  if (sum.yetiHop && !prior?.yetiHop) d.stats.yetiHops++;
  if (sum.outranAvalanche && !prior?.outranAvalanche) d.stats.avalanches++;

  const k = key ?? sum.mountain;
  const dists = (d.runDists ??= {});
  const list = dists[k] ?? [];
  const dist = Math.max(0, Math.round(sum.distance * 10) / 10);
  if (prior && list.length > 0) list[list.length - 1] = dist;
  else list.push(dist);
  dists[k] = list.slice(-RUN_DISTS_KEEP);
  if (k.startsWith('daily:')) pruneDaily(d, k.slice(6));

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
