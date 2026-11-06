import { MissionResult, MissionState, RunSummary, applyRun, unlockedBiomes } from './missions';
import { RUN_TIMES_KEEP, pruneDaily, type BestRun, type DailyRecord, type Grudge, type SaveData } from './save';
import { type Standing, FINISH_Z, aheadOf, clock, marginPhrase, predictedTime } from './standing';
import { dailyKey } from '../sim/mountains';
import type { GhostKind } from '../ui/contract';
import type { GhostRole } from './beats';

// Settling a run into the save: the run count, ghosts passed, lifetime stats, missions and the
// run-end distance. A revive followed by a second crash settles the same run again, so everything is
// credited as the difference from the first settlement: a run counts once, its passes once, its
// missions are judged once on the run's final summary (as if the first results screen had never been
// shown), and its predicted finish time replaces the one the first settlement pushed.
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
  /** The Daily or Cup medal this run has credited (0 none). */
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
   *  line ("Daily: Silver. Gold at 2:31.4.", null without thresholds). */
  daily?: DailyOutcome;
  /** A Cup run: the medal it earned, the week's best medal and the results line. (streak: unused, 0.) */
  cup?: DailyOutcome;
}

// ---------- Daily medal and streak (stretch)

/** The medal thresholds sit at these percentiles of a pool's finish times, fastest first: beat the
 *  time 60% of the pool managed for bronze, 30% for silver, 10% for gold. */
export const MEDAL_PCT = [0.6, 0.3, 0.1] as const;
/** Medals sit at least this far apart (s): a pool of tied or few finishers still has three to reach. */
export const MEDAL_GAP_S = 1;
export const MEDAL_NAMES = ['', 'Bronze', 'Silver', 'Gold'] as const;
/** The bronze, silver and gold times, seconds, slowest first. */
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

/** The value a share p of a sorted list sits at, between its neighbours. */
export function pctAt(xs: readonly number[], p: number): number {
  const i = p * (xs.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(xs.length - 1, lo + 1);
  return xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
}

/** The bronze, silver and gold times for a pool's predicted finish times (seconds, to the tenth, so
 *  a line reads the time it means), or null for an empty pool. Every medal stays reachable: however
 *  the pool ties, each sits MEDAL_GAP_S under the last, never over a time nobody can beat. */
export function medalThresholds(times: readonly number[]): MedalThresholds | null {
  const xs = times.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const at = (p: number): number => Math.round(pctAt(xs, p) * 10) / 10;
  const b = at(MEDAL_PCT[0]);
  const s = Math.min(b - MEDAL_GAP_S, at(MEDAL_PCT[1]));
  return [b, s, Math.min(s - MEDAL_GAP_S, at(MEDAL_PCT[2]))];
}

/** The medal a finish time earns; only a finish earns one (time null: 0). */
export function medalFor(time: number | null, t: MedalThresholds): number {
  if (time === null) return 0;
  let medal = 0;
  for (let i = 0; i < 3; i++) if (time <= t[i]) medal = i + 1;
  return medal;
}

/** "Daily: Silver. Gold at 2:31.4.", "Daily: Gold.", or "Daily: Bronze at 3:02.0." with none yet. The
 *  Cup says the same with its own name. */
export function dailyLine(medal: number, t: MedalThresholds, label: 'Daily' | 'Cup' = 'Daily'): string {
  if (medal >= 3) return `${label}: Gold.`;
  if (medal <= 0) return `${label}: Bronze at ${clock(t[0])}.`;
  return `${label}: ${MEDAL_NAMES[medal]}. ${MEDAL_NAMES[medal + 1]} at ${clock(t[medal])}.`;
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
function settleDaily(d: SaveData, day: string, time: number | null, t: MedalThresholds | null | undefined): DailyOutcome {
  const dr = d.daily;
  const medal = t ? medalFor(time, t) : 0;
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

/** This week's best medal (0 when the record is another week's). */
export function cupMedalNow(cup: DailyRecord | null | undefined, week: string): number {
  return cup?.key === week ? (cup.medal ?? 0) : 0;
}

/** Credits a Cup run to the week: the week's best time and medal. Pure in the record, so settling
 *  twice gives the same answer. There is no streak: a Cup is a week's best, not a habit. */
function settleCup(d: SaveData, week: string, time: number | null, t: MedalThresholds | null | undefined): DailyOutcome {
  const c: DailyRecord = d.cup?.key === week ? d.cup : { key: week, best: 0, medal: 0 };
  const medal = t ? medalFor(time, t) : 0;
  c.medal = Math.max(c.medal ?? 0, medal);
  if (time !== null && (c.best <= 0 || time < c.best)) c.best = time;
  d.cup = c;
  return { medal, best: c.medal ?? 0, streak: 0, line: t ? dailyLine(medal, t, 'Cup') : null };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** A ghost's row in the grudge's election. role and gapAtCrash are the run's own (the field's role,
 *  and how far ahead of you it was as you fell: metres, - = behind); neither is ever stored. */
export interface GrudgeRow {
  name: string;
  score: number;
  record: string;
  distance: number;
  /** Its finish time in seconds, when it finished. */
  time?: number | null;
  kind: GhostKind;
  role?: GhostRole;
  gapAtCrash?: number;
}

/** How the run ended against the grudge it started with. */
export interface GrudgeOutcome {
  /** How far you went (sim.distance at the crash). */
  youDistance: number;
  /** Your finish time in seconds, when you finished. */
  youTime?: number | null;
  /** The grudge at start, if it rode in this field: its whole run and whether you passed it. */
  rode: { distance: number; time?: number | null; passed: boolean } | null;
  /** The results' Next row: the ghost in the place right above yours. */
  next: GrudgeRow | null;
  /** Every ghost that finished ahead of you (any order). A settled grudge elects its successor from
   *  these, never itself: the grudge you just beat can still be the Next row. Without it, only `next`
   *  is considered. */
  ahead?: ReadonlyArray<GrudgeRow>;
}

/** Your highest style score on a mountain (0 with no best). */
export function topScore(b: BestRun | null | undefined): number {
  return b ? (b.topScore ?? b.score) : 0;
}

/** The run as settleBest reads it. `record` is called only if the run becomes your best. */
export interface BestInput {
  score: number;
  distance: number;
  /** Finish time in seconds, null for a run that did not finish. */
  time: number | null;
  /** The clock at each stage line it crossed, seconds. */
  splits: number[];
  record: () => string;
}

/**
 * Your best after a run. It is your best run in race order (standing.ts), measured against `at`, the
 * best the run set out to beat, so a run that persists twice (at the finish, again with its coast; a
 * revive's second crash) settles the same way. An empty slot takes any run: a score from an old course
 * lives in the archive and blocks nothing. On a dead heat the higher score keeps the ghost. The highest
 * style score is kept apart, whichever run set it.
 */
export function settleBest(d: SaveData, key: string, at: BestRun | null, run: BestInput): { newTop: boolean; newTime: boolean } {
  const prev = topScore(at);
  const top = Math.max(prev, run.score);
  const you: Standing = { time: run.time, distance: run.distance };
  const had: Standing | null = at ? { time: at.time ?? null, distance: at.distance } : null;
  if (!had || aheadOf(you, had) || (!aheadOf(had, you) && run.score > (at?.score ?? 0))) {
    const b: BestRun = { score: run.score, distance: run.distance, record: run.record(), topScore: top };
    if (run.time !== null) b.time = run.time;
    if (run.splits.length > 0) b.splits = run.splits;
    d.best[key] = b;
  } else if (d.best[key]) d.best[key].topScore = top;
  return { newTop: run.score > prev, newTime: run.time !== null && (at?.time === undefined || run.time < at.time) };
}

/** A grudge on this many wins in a row is a nemesis. */
export const NEMESIS_STREAK = 3;
/** The rival you were racing when you fell: a ghost this close to you at the crash (m, either side)
 *  is elected first, nearest first, unless it is the pace rider (built to finish far ahead: elected
 *  there, it pulled away from a novice all of the next run). */
export const GRUDGE_CRASH_M = 50;
/** Else the nearest within reach: at most this far past your distance (m), or this share of your
 *  distance on a long run, and never the pace rider. Nothing within reach elects no one. */
export const GRUDGE_REACH_M = 300;
export const GRUDGE_REACH_FRAC = 0.6;
/** Between two finishers, within reach is this far ahead on the clock (s), about 300 m of riding. */
export const GRUDGE_REACH_S = 12;

export function isNemesis(g: Pick<Grudge, 'streak'> | null | undefined): boolean {
  return !!g && (g.streak ?? 1) >= NEMESIS_STREAK;
}

/** The results line for a grudge that beat you (names only: handles carry no pronouns). `by` is how
 *  it won as marginPhrase says it ('by 1.2 s', 'by 85 m', 'to the finish'), the same words as the race
 *  rows; a number is metres, as rowMargin gives them. */
export function grudgeLine(name: string, streak: number, by: number | string): string {
  if (streak >= NEMESIS_STREAK) return `${name} beat you ${streak} runs running. Nemesis.`;
  if (streak === 2) return `${name} beat you 2 runs running.`;
  const how = typeof by === 'string' ? by : `by ${by < 1 ? 'less than 1 m' : fmtM(by)}`;
  return `${name} beat you ${how}. ${name} will be waiting.`;
}

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const fmtM = (m: number): string => `${NF.format(Math.max(1, Math.round(m)))} m`;

/** A margin as the race rows show it: the difference of the two distances in whole metres each, so
 *  "beat you by 7 m" sits over rows of 760 m and 753 m (the raw gap rounded read 8 m). */
export function rowMargin(them: number, you: number): number {
  return Math.round(them) - Math.round(you);
}

/**
 * The grudge after a run: tally, nemesis promotion and the results line. Idempotent from one
 * snapshot, so a revive's second settle gives the same answer.
 * - The grudge rode, finished ahead of you (standing.ts: by time, then by distance) and was never
 *   passed: it stays, them +1, streak +1. A dead heat on the line is no win for either: it settles.
 * - You passed it or beat it: settled (nemesisDown when its streak was 3 or more), and another ghost
 *   that finished ahead (never the grudge just settled, even when it did too) becomes the new grudge
 *   at 1 and 1; the line names it as the new grudge ('Grudge settled with Mila after 2 runs. New
 *   grudge: Tess.'), never as 'next': the race list's NEXT tag is the place above yours, which can be
 *   another ghost.
 * - It did not ride (no grudge yet, or a record that can no longer ride): a new one is elected, and
 *   the one it replaces comes back as `retired`, so its tally is kept in the archive.
 * The election is a rival you can catch, never the pace rider: first the ghost you were racing when
 * you fell (the smallest gap at the crash, within GRUDGE_CRASH_M either side), then the nearest within
 * reach. With nothing eligible within reach no grudge is elected (a settled grudge leaves none, and
 * the Run Again button falls back to the friend or 'Run Again'). A friend or your own best is never
 * elected. The Grudge keeps exactly its save fields: `by` and `distance` stay the whole-run margin.
 */
export function settleGrudge(atStart: Grudge | null, o: GrudgeOutcome): { grudge: Grudge | null; settled: boolean; nemesisDown: boolean; line: string | null; retired?: Grudge } {
  const you: Standing = { time: o.youTime ?? null, distance: o.youDistance };
  const of = (c: { distance: number; time?: number | null }): Standing => ({ time: c.time ?? null, distance: c.distance });
  const eligible = (c: GrudgeRow | null | undefined, skip: string | null): c is GrudgeRow => !!c && c.kind !== 'friend' && c.kind !== 'you' && aheadOf(of(c), you) && c.record !== skip;
  const crashGap = (c: GrudgeRow): number => (typeof c.gapAtCrash === 'number' && Number.isFinite(c.gapAtCrash) ? Math.abs(c.gapAtCrash) : Infinity);
  /** The elected row, and whether it was the rival you were racing at the crash. */
  const pick = (skip: string | null): { row: GrudgeRow; atCrash: boolean } | null => {
    const rows = (o.ahead ?? (o.next ? [o.next] : [])).filter((c) => eligible(c, skip));
    let best: GrudgeRow | null = null;
    for (const c of rows) if (c.role !== 'pace' && crashGap(c) <= GRUDGE_CRASH_M && (!best || crashGap(c) < crashGap(best))) best = c;
    if (best) return { row: best, atCrash: true };
    const reach = Math.max(GRUDGE_REACH_M, GRUDGE_REACH_FRAC * o.youDistance);
    const within = (c: GrudgeRow): boolean => (you.time !== null && typeof c.time === 'number' ? c.time >= you.time - GRUDGE_REACH_S : c.distance - o.youDistance <= reach);
    for (const c of rows) if (c.role !== 'pace' && within(c) && (!best || aheadOf(of(best), of(c)))) best = c;
    return best ? { row: best, atCrash: false } : null;
  };
  const elect = (n: GrudgeRow | null): Grudge | null => {
    if (!n) return null;
    const g: Grudge = { name: n.name, score: n.score, record: n.record, them: 1, streak: 1, by: Math.max(0, Math.round(n.distance - o.youDistance)), distance: n.distance };
    if (typeof n.time === 'number') g.time = n.time;
    return g;
  };
  if (atStart && o.rode) {
    const them = atStart.them ?? 1;
    const streak = atStart.streak ?? 1;
    const rode = of(o.rode);
    if (!o.rode.passed && aheadOf(rode, you)) {
      const g: Grudge = { ...atStart, them: them + 1, streak: streak + 1, by: Math.max(0, Math.round(o.rode.distance - o.youDistance)), distance: o.rode.distance };
      if (typeof o.rode.time === 'number') g.time = o.rode.time;
      return { grudge: g, settled: false, nemesisDown: false, line: grudgeLine(g.name, g.streak ?? 1, marginPhrase(rode, you)) };
    }
    const next = elect(pick(atStart.record)?.row ?? null);
    const after = them >= 2 ? ` after ${them} runs` : '';
    // The settled line keeps its tally and names the successor, so the Rematch button's new name is
    // introduced here.
    const line = `Grudge settled with ${atStart.name}${after}.${next ? ` New grudge: ${next.name}.` : ''}`;
    return { grudge: next, settled: true, nemesisDown: streak >= NEMESIS_STREAK, line };
  }
  const p = pick(null);
  const g = elect(p?.row ?? null);
  if (p && g) {
    // Elected where you fell: the line says so ('SparkleCedar was 13 m ahead when you fell.'). Over the
    // line nobody fell: its margin says it, in the rows' own terms.
    const gap = p.row.gapAtCrash ?? 0;
    const line = !p.atCrash || you.time !== null ? grudgeLine(g.name, 1, marginPhrase(of(p.row), you)) : gap > 0 ? `${g.name} was ${fmtM(gap)} ahead when you fell.` : `${g.name} rode past your wreck.`;
    const out: ReturnType<typeof settleGrudge> = { grudge: g, settled: false, nemesisDown: false, line };
    // The one it replaces did not ride (its record is stale): electing over it must not cost its tally.
    if (atStart) out.retired = atStart;
    return out;
  }
  // Nothing within reach finished ahead of you: a grudge that did not ride keeps waiting, unchanged.
  return { grudge: atStart, settled: false, nemesisDown: false, line: null };
}

/**
 * `key` is the save key of the mountain (daily runs use `daily:<day>`, Cup runs `cup:<week>`): the
 * run's predicted finish time is pushed to runTimes[key] (capped at 5; a re-settle replaces the entry
 * the first settle pushed), and a daily settle prunes the other days' entries. A daily settle also
 * credits the day streak and the medal against `medals` (medalThresholds of the day's pool times;
 * without them only the streak counts), and a Cup settle the week's time and medal.
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
  const times = (d.runTimes ??= {});
  const list = times[k] ?? [];
  const time = Math.round(predictedTime(sum.distance, sum.finished ? sum.finishSeconds : sum.seconds, FINISH_Z) * 10) / 10;
  if (prior && list.length > 0) list[list.length - 1] = time;
  else if (time > 0) list.push(time);
  times[k] = list.slice(-RUN_TIMES_KEEP);
  let daily: DailyOutcome | undefined;
  let cup: DailyOutcome | undefined;
  if (k.startsWith('daily:')) {
    pruneDaily(d, k.slice(6));
    daily = settleDaily(d, k.slice(6), sum.finished ? sum.finishSeconds : null, medals);
  } else if (k.startsWith('cup:')) cup = settleCup(d, k.slice(4), sum.finished ? sum.finishSeconds : null, medals);

  return {
    settlement: {
      missionsBefore,
      missionReward: Math.max(m.reward, prior?.missionReward ?? 0),
      passed: Math.max(sum.ghostsPassed, prior?.passed ?? 0),
      perfects: Math.max(sum.perfects, prior?.perfects ?? 0),
      yetiHop: sum.yetiHop || !!prior?.yetiHop,
      outranAvalanche: sum.outranAvalanche || !!prior?.outranAvalanche,
      medal: Math.max(daily?.medal ?? cup?.medal ?? 0, prior?.medal ?? 0),
    },
    missions: m.views,
    missionReward,
    passedBefore,
    daily,
    cup,
  };
}
