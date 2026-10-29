import { MissionResult, MissionState, RunSummary, applyRun, unlockedBiomes } from './missions';
import { RUN_DISTS_KEEP, pruneDaily, type DailyRecord, type Grudge, type SaveData } from './save';
import { dailyKey } from '../sim/mountains';
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
  /** A Daily Mountain run: the medal it earned, today's best medal, the day streak and the results
   *  line ("Daily: Silver. Gold at 2,410 m.", null without thresholds). */
  daily?: DailyOutcome;
}

// ---------- Daily medal and streak (stretch)

/** The medal thresholds sit at these percentiles of the day's pool distances: bronze, silver, gold. */
export const MEDAL_PCT = [0.4, 0.7, 0.9] as const;
export const MEDAL_NAMES = ['', 'Bronze', 'Silver', 'Gold'] as const;
export type MedalThresholds = readonly [number, number, number];

export interface DailyOutcome {
  /** This run's medal (0 none, 1 bronze, 2 silver, 3 gold). */
  medal: number;
  /** Today's best medal, this run included. */
  best: number;
  /** Days in a row with a Daily run, today included. */
  streak: number;
  line: string | null;
}

/** The bronze, silver and gold distances for a day's pool (whole metres), or null for an empty pool. */
export function medalThresholds(distances: readonly number[]): MedalThresholds | null {
  const xs = distances.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const at = (p: number): number => {
    const i = p * (xs.length - 1);
    const lo = Math.floor(i);
    const hi = Math.min(xs.length - 1, lo + 1);
    return Math.round(xs[lo] + (xs[hi] - xs[lo]) * (i - lo));
  };
  const b = at(MEDAL_PCT[0]);
  const s = Math.max(b + 1, at(MEDAL_PCT[1]));
  return [b, s, Math.max(s + 1, at(MEDAL_PCT[2]))];
}

export function medalFor(distance: number, t: MedalThresholds): number {
  let medal = 0;
  for (let i = 0; i < 3; i++) if (distance >= t[i]) medal = i + 1;
  return medal;
}

/** "Daily: Silver. Gold at 2,410 m.", "Daily: Gold.", or "Daily: Bronze at 1,180 m." with none yet. */
export function dailyLine(medal: number, t: MedalThresholds): string {
  if (medal >= 3) return 'Daily: Gold.';
  if (medal <= 0) return `Daily: Bronze at ${fmtM(t[0])}.`;
  return `Daily: ${MEDAL_NAMES[medal]}. ${MEDAL_NAMES[medal + 1]} at ${fmtM(t[medal])}.`;
}

/** The UTC day before a 'YYYY-MM-DD' key ('' when the key is not a day). */
export function prevDay(day: string): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!p) return '';
  return dailyKey(new Date(Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3]) - 1)));
}

/** The day streak as the title shows it today: alive while the last Daily run was today or yesterday. */
export function dailyStreakNow(daily: DailyRecord, today: string): number {
  const last = daily.last ?? '';
  return last && (last === today || last === prevDay(today)) ? Math.max(1, daily.streak ?? 1) : 0;
}

/** Today's best medal (0 when the last Daily run was another day). */
export function dailyMedalNow(daily: DailyRecord, today: string): number {
  return daily.last === today ? (daily.medal ?? 0) : 0;
}

/**
 * Credits a Daily run once per day: the streak grows on the day after the last run, holds on the same
 * day (a second run or a revive's re-settle) and restarts at 1 after a missed day; the medal is the
 * day's best. Pure in the save's daily record, so settling twice gives the same answer.
 */
function settleDaily(d: SaveData, day: string, distance: number, t: MedalThresholds | null | undefined): DailyOutcome {
  const dr = d.daily;
  const medal = t ? medalFor(distance, t) : 0;
  if (dr.last === day) {
    dr.streak = Math.max(1, dr.streak ?? 1);
    dr.medal = Math.max(dr.medal ?? 0, medal);
  } else {
    dr.streak = dr.last && dr.last === prevDay(day) ? Math.max(1, dr.streak ?? 1) + 1 : 1;
    dr.medal = medal;
    dr.last = day;
  }
  return { medal, best: dr.medal ?? 0, streak: dr.streak, line: t ? dailyLine(medal, t) : null };
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
  /** Every ghost whose whole run went further than yours (any order). A settled grudge elects its
   *  successor from these, never itself: the grudge you just beat can still be the Next row. Without
   *  it, only `next` is considered. */
  ahead?: ReadonlyArray<{ name: string; score: number; record: string; distance: number; kind: GhostKind }>;
}

/** A grudge on this many wins in a row is a nemesis. */
export const NEMESIS_STREAK = 3;

export function isNemesis(g: Pick<Grudge, 'streak'> | null | undefined): boolean {
  return !!g && (g.streak ?? 1) >= NEMESIS_STREAK;
}

/** The results line for a grudge that beat you (names only: handles carry no pronouns). `by` is the
 *  margin in metres, unrounded: under 1 m it says so, where both race rows read the same distance. */
export function grudgeLine(name: string, streak: number, by: number): string {
  if (streak >= NEMESIS_STREAK) return `${name} beat you ${streak} runs running. Nemesis.`;
  if (streak === 2) return `${name} beat you 2 runs running.`;
  return `${name} beat you by ${by < 1 ? 'less than 1 m' : fmtM(by)}. ${name} will be waiting.`;
}

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fmtM = (m: number): string => `${NF.format(Math.max(1, Math.round(m)))} m`;

/**
 * The grudge after a run: tally, nemesis promotion and the results line. Idempotent from one
 * snapshot, so a revive's second settle gives the same answer.
 * - The grudge rode, finished ahead of you and was never passed: it stays, them +1, streak +1.
 * - You passed it or out-distanced it: settled (nemesisDown when its streak was 3 or more), and the
 *   nearest other ghost that went further (never the grudge just settled, even when its whole run
 *   went further than yours) becomes the new grudge at 1 and 1.
 * - It did not ride (no grudge yet, or a record that can no longer ride): the Next row is elected.
 * A friend or your own best is never elected.
 */
export function settleGrudge(atStart: Grudge | null, o: GrudgeOutcome): { grudge: Grudge | null; settled: boolean; nemesisDown: boolean; line: string | null } {
  type Cand = NonNullable<GrudgeOutcome['next']>;
  const eligible = (c: Cand | null | undefined, skip: string | null): c is Cand => !!c && c.kind !== 'friend' && c.kind !== 'you' && c.distance > o.youDistance && c.record !== skip;
  const pick = (skip: string | null): Cand | null => {
    let best: Cand | null = null;
    for (const c of o.ahead ?? (o.next ? [o.next] : [])) if (eligible(c, skip) && (!best || c.distance < best.distance)) best = c;
    return best;
  };
  const elect = (skip: string | null): Grudge | null => {
    const n = pick(skip);
    return n ? { name: n.name, score: n.score, record: n.record, them: 1, streak: 1, by: Math.round(n.distance - o.youDistance), distance: n.distance } : null;
  };
  if (atStart && o.rode) {
    const them = atStart.them ?? 1;
    const streak = atStart.streak ?? 1;
    if (!o.rode.passed && o.rode.distance > o.youDistance) {
      const margin = o.rode.distance - o.youDistance;
      const g: Grudge = { ...atStart, them: them + 1, streak: streak + 1, by: Math.round(margin), distance: o.rode.distance };
      return { grudge: g, settled: false, nemesisDown: false, line: grudgeLine(g.name, g.streak ?? 1, margin) };
    }
    const after = them >= 2 ? ` after ${them} runs` : '';
    return { grudge: elect(atStart.record), settled: true, nemesisDown: streak >= NEMESIS_STREAK, line: `You settled it with ${atStart.name}${after}.` };
  }
  const g = elect(null);
  if (g) return { grudge: g, settled: false, nemesisDown: false, line: grudgeLine(g.name, 1, (g.distance ?? 0) - o.youDistance) };
  // Nothing finished ahead of you: a grudge that did not ride keeps waiting, unchanged.
  return { grudge: atStart, settled: false, nemesisDown: false, line: null };
}

/**
 * `key` is the save key of the mountain (daily runs use `daily:<day>`): the run-end distance is
 * pushed to runDists[key] (capped at 5; a re-settle replaces the entry the first settle pushed), and
 * a daily settle prunes the other days' entries. A daily settle also credits the day streak and the
 * medal against `medals` (medalThresholds of the day's pool distances; without them only the streak
 * counts).
 */
export function settleRun(d: SaveData, sum: RunSummary, prior: Settlement | null, key?: string, medals?: MedalThresholds | null): SettleResult {
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
  let daily: DailyOutcome | undefined;
  if (k.startsWith('daily:')) {
    pruneDaily(d, k.slice(6));
    daily = settleDaily(d, k.slice(6), sum.distance, medals);
  }

  return {
    settlement: {
      missionsBefore,
      missionReward: Math.max(m.reward, prior?.missionReward ?? 0),
      passed: Math.max(sum.ghostsPassed, prior?.passed ?? 0),
      perfects: Math.max(sum.perfects, prior?.perfects ?? 0),
      yetiHop: sum.yetiHop || !!prior?.yetiHop,
      outranAvalanche: sum.outranAvalanche || !!prior?.outranAvalanche,
      medal: Math.max(daily?.medal ?? 0, prior?.medal ?? 0),
    },
    missions: m.views,
    missionReward,
    passedBefore,
    daily,
  };
}
