import { poolTime } from './field';
import type { PoolGhostData } from './ghostdata';
import type { Climb, SaveData } from './save';
import { type MedalThresholds, MEDAL_GAP_S, MEDAL_NAMES, medalFor, medalThresholds, pctAt } from './settle';
import { type Standing, aheadOf, byStanding, figure, gapSeconds, margin, timeGap } from './standing';

// What a mountain gives you to climb. Its pool is a ladder of named riders in race order (standing.ts),
// and your rank on it is your best run's. Its stage splits set three medals on each stage, so a rider
// who cannot yet hold the whole descent together can still gold one stage. All of it pays gifts once.
//
// settleClimb is a pure function of the save, so settling twice (the coast, a revive's second crash)
// credits only the difference: what a Climb has earned has a value, and only the change in that value
// is paid. A stale pool cannot lie either: a Climb names the sim version it was earned on, and a new
// course moves it to the archive (save.ts).
//
// Pure: no DOM, render or audio imports. Copy rules: no em dashes, and a figure beside a word agrees
// with the rows it sits next to.

/** Gifts for each rung climbed, once. */
export const RUNG_GIFTS = 5;
/** Gifts for taking the top of a mountain's ladder, once, over its rung. */
export const TOP_GIFTS = 100;
/** Gifts for a stage's bronze, silver and gold, each once (a gold on the first try pays all three). */
export const STAGE_GIFTS = [0, 10, 15, 25] as const;
/** The same for the whole run's medals, which ask for more. */
export const RUN_GIFTS = [0, 20, 30, 50] as const;
/** Stage medals are kinder than the whole run's (settle.ts MEDAL_PCT): gold matches the pool's median
 *  on that stage, silver the 85th percentile, and bronze is the pool's slowest with a quarter in hand.
 *  So a clean stage golds well before a clean run bronzes, which is the point of them, and the first
 *  bronze comes at about the pace of the 'finish under 3:30' mission (the pool's slowest finish in about
 *  2:30, so a bronze any tighter asks a new rider for a pace no mission has taught them yet). */
export const STAGE_GOLD_PCT = 0.5;
export const STAGE_SILVER_PCT = 0.85;
export const STAGE_BRONZE_K = 1.25;
/** A rung missed by less than this (s) is worth saying, on the results' one line. */
export const NEAR_RUNG_S = 2;
/** A stage gold missed by this much or less (s) is too. */
export const NEAR_GOLD_S = 1;
/** How many stages a descent has. */
export const STAGES = 3;

export interface Rider {
  name: string;
  score: number;
  distance: number;
  record: string;
  standing: Standing;
}

/** A mountain's pool read as a ladder (top first) and its medal times. */
export interface Board {
  riders: readonly Rider[];
  /** Bronze, silver and gold for each stage, null for a pool with no splits on it. */
  stages: ReadonlyArray<MedalThresholds | null>;
  run: MedalThresholds | null;
}

/** Where you stand on a ladder. rank is null until you have a run here; next is the rider above you
 *  (the bottom rung with no run yet), null at the top. */
export interface Spot {
  rank: number | null;
  of: number;
  next: Rider | null;
  top: boolean;
}

/** Differences between successive marks: a stage's own length out of the clock at each line. */
export function laps(marks: readonly number[]): number[] {
  return marks.map((m, i) => m - (i > 0 ? marks[i - 1] : 0));
}

/** Each stage's own time in seconds, from the tick each line was crossed. */
export function stageSeconds(ticks: readonly number[]): number[] {
  return laps(ticks).map((t) => t / 60);
}

/** The bronze, silver and gold times for a stage (seconds, to the tenth, slowest first), or null for
 *  a stage no rider reached. Each sits MEDAL_GAP_S under the last, as the whole run's do. */
export function stageThresholds(times: readonly number[]): MedalThresholds | null {
  const xs = times.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const tenth = (v: number): number => Math.round(v * 10) / 10;
  const b = tenth(xs[xs.length - 1] * STAGE_BRONZE_K);
  const s = Math.min(b - MEDAL_GAP_S, tenth(pctAt(xs, STAGE_SILVER_PCT)));
  return [b, s, Math.min(s - MEDAL_GAP_S, tenth(pctAt(xs, STAGE_GOLD_PCT)))];
}

/** The medal a stage time earns, read to the tenth a clock shows: 46.14 reads 0:46.1, which is gold
 *  at a 46.1 line, so a card and its line never disagree. */
export function stageMedal(seconds: number, t: MedalThresholds | null): number {
  return t ? medalFor(Math.floor(seconds * 10 + 1e-6) / 10, t) : 0;
}

export function boardOf(pool: readonly PoolGhostData[]): Board {
  const riders = pool
    .filter((g) => Number.isFinite(g.distance) && g.distance > 0)
    .map((g): Rider => ({ name: g.name, score: g.score, distance: g.distance, record: g.record, standing: { time: typeof g.finishTick === 'number' && g.finishTick > 0 ? g.finishTick / 60 : null, distance: g.distance } }))
    .sort((a, b) => byStanding(a.standing, b.standing));
  const times: number[][] = Array.from({ length: STAGES }, () => []);
  for (const g of pool) stageSeconds(g.stageTicks ?? []).forEach((s, i) => times[i]?.push(s));
  return { riders, stages: times.map(stageThresholds), run: medalThresholds(pool.map(poolTime)) };
}

/** Where a best run puts you. Your rank counts the riders ahead of you in race order: a rider who has
 *  not finished sits below every finisher, and a dead heat leaves you level, so no rider is ahead. The
 *  ladder has you on it, so it has one more place than riders. */
export function spotOn(board: Pick<Board, 'riders'>, you: Standing | null): Spot {
  const r = board.riders;
  const of = r.length + 1;
  if (r.length === 0) return { rank: null, of, next: null, top: false };
  if (!you) return { rank: null, of, next: r[r.length - 1], top: false };
  const ahead = r.filter((x) => aheadOf(x.standing, you)).length;
  return { rank: ahead + 1, of, next: ahead > 0 ? r[ahead - 1] : null, top: ahead === 0 };
}

/** Your best as the ladder reads it. */
export function bestStanding(b: { time?: number; distance: number } | null | undefined): Standing | null {
  return b ? { time: b.time ?? null, distance: b.distance } : null;
}

/** "Rank 19 of 37", or null with no run here. */
export function rankLine(s: Pick<Spot, 'rank' | 'of'>): string | null {
  return s.rank === null ? null : `Rank ${s.rank} of ${s.of}`;
}

/**
 * The name above you and what to beat: "Next: SparkleCedar, 2:11.4, 1.6 s up". A rider who has not
 * finished is told only the time: a time and a distance share no unit (standing.ts). With no run here
 * it names the bottom rung. Null at the top, or on a ladder with nobody on it.
 */
export function nextLine(s: Pick<Spot, 'next'>, you: Standing | null): string | null {
  if (!s.next) return null;
  const head = `Next: ${s.next.name}, ${figure(s.next.standing)}`;
  const gap = you ? margin(s.next.standing, you) : null;
  return gap === null ? head : `${head}, ${gap} up`;
}

/** Your held medals as the card and the results show them: one per stage, then the whole run. */
export function medalsHeld(c: Climb | null | undefined): { stages: number[]; run: number } {
  return { stages: Array.from({ length: STAGES }, (_, i) => c?.stages?.[i] ?? 0), run: c?.medal ?? 0 };
}

/** Everything a Climb has earned, in gifts: paying the change in this pays each thing once. */
function climbValue(c: Climb, of: number): number {
  const tiers = (table: readonly number[], m: number): number => table.slice(0, m + 1).reduce((a, b) => a + b, 0);
  let v = Math.max(0, of - (c.rung ?? of)) * RUNG_GIFTS + (c.top ? TOP_GIFTS : 0) + tiers(RUN_GIFTS, c.medal ?? 0);
  for (const m of c.stages ?? []) v += tiers(STAGE_GIFTS, m);
  return v;
}

/** The run as settleClimb reads it. */
export interface ClimbRun {
  /** This run's own place in the race order. */
  standing: Standing;
  /** Your best here after this run (settleBest has run). */
  best: Standing | null;
  /** Your best as the run started: an old save has one and no Climb yet, and a rank it already held is
   *  neither paid again nor claimed as this run's. */
  bestBefore: Standing | null;
  /** The tick it crossed each stage line it reached. */
  ticks: readonly number[];
}

export interface ClimbOutcome {
  /** Where your best stands now. */
  spot: Spot;
  /** Your rank as the run started (null with no run here). */
  rankWas: number | null;
  /** Riders this run newly beat, highest first. */
  beaten: string[];
  /** This run took the top of the ladder, for the first time. */
  topNow: boolean;
  /** What this run itself earned on each stage it finished, and on the whole run. */
  stageMedals: number[];
  runMedal: number;
  /** Medals this run raised: 0 to 2 for a stage, 3 for the whole run. */
  fresh: number[];
  /** Gifts this run has earned here in all, a revive's second settle included. */
  gifts: number;
  /** Gifts this call credited to the wallet. */
  credit: number;
}

/**
 * Credits a run to a mountain's Climb. `atStart` is the Climb as the run started, for what the card
 * says it earned; what it pays is the change from what the save already holds, so a second call with
 * the same run credits nothing. With no Climb yet, the rank your best already held is where it starts:
 * this run did not climb that, and an old save is not paid for it. The save takes a Climb only when a
 * run earned something.
 */
export function settleClimb(d: SaveData, key: string, board: Board, version: number, atStart: Climb | null, run: ClimbRun): ClimbOutcome {
  const spot = spotOn(board, run.best);
  const of = spot.of;
  const held = spotOn(board, run.bestBefore);
  // Where the run set out from, and where the save stands now (the same, on a first settle).
  const start: Climb = atStart ?? { v: version, ...(held.rank !== null ? { rung: held.rank } : {}), ...(held.top ? { top: true } : {}) };
  const was: Climb = d.climb?.[key] ?? start;
  const stageMedals = stageSeconds(run.ticks).map((s, i) => stageMedal(s, board.stages[i] ?? null));
  const runMedal = board.run ? medalFor(run.standing.time, board.run) : 0;
  const c: Climb = { ...was, v: version };
  c.stages = Array.from({ length: STAGES }, (_, i) => Math.max(was.stages?.[i] ?? 0, stageMedals[i] ?? 0));
  if (Math.max(was.medal ?? 0, runMedal) > 0) c.medal = Math.max(was.medal ?? 0, runMedal);
  if (spot.rank !== null && spot.rank < (was.rung ?? of)) c.rung = spot.rank;
  if (spot.top) c.top = true;
  const credit = Math.max(0, climbValue(c, of) - climbValue(was, of));
  if (credit > 0) (d.climb ??= {})[key] = c;
  d.gifts += credit;
  d.lifetimeGifts += credit;
  const fresh: number[] = [];
  c.stages.forEach((m, i) => {
    if (m > (start.stages?.[i] ?? 0)) fresh.push(i);
  });
  if ((c.medal ?? 0) > (start.medal ?? 0)) fresh.push(STAGES);
  const from = start.rung ?? of;
  const beaten = spot.rank !== null && spot.rank < from ? board.riders.slice(spot.rank - 1, from - 1).map((r) => r.name) : [];
  return {
    spot,
    rankWas: start.rung ?? null,
    beaten,
    topNow: spot.top && !start.top,
    stageMedals,
    runMedal,
    fresh,
    gifts: Math.max(0, climbValue(c, of) - climbValue(start, of)),
    credit,
  };
}

/** "Gold on Stage 1", "Gold on the whole run". */
function medalWords(medal: number, at: number): string {
  return `${MEDAL_NAMES[medal]} on ${at >= STAGES ? 'the whole run' : `Stage ${at + 1}`}`;
}

/**
 * The results' climbing moment, or null for a run that climbed nothing: the name beaten, and what else
 * the run took. Beating the top is a real achievement, so it says so.
 */
export function climbMoment(o: ClimbOutcome, mountain: string, held: { stages: number[]; run: number }): string | null {
  const medals = o.fresh.length;
  const one = medals === 1 ? medalWords(o.fresh[0] >= STAGES ? held.run : held.stages[o.fresh[0]], o.fresh[0]) : `${medals} new medals`;
  if (o.topNow) return `Top of the ${mountain} ladder. All ${o.spot.of - 1} riders beaten.`;
  if (o.beaten.length > 0) {
    const who = o.beaten.length === 1 ? `Beat ${o.beaten[0]}.` : `Beat ${o.beaten[0]} and ${o.beaten.length - 1} more.`;
    return medals > 0 ? `${who} ${one}.` : who;
  }
  return medals > 0 ? `${one}.` : null;
}

/** The results' hook for a rung this run just missed: under NEAR_RUNG_S off the rider above your best,
 *  on the clock. "1.6 s from SparkleCedar and Rank 18." */
export function rungHook(spot: Spot, run: Standing): string | null {
  const n = spot.next;
  if (!n || spot.rank === null || run.time === null || n.standing.time === null) return null;
  if (run.time <= n.standing.time || run.time - n.standing.time >= NEAR_RUNG_S) return null;
  return `${margin(n.standing, run)} from ${n.name} and Rank ${spot.rank - 1}.`;
}

/** The results' hook for the stage gold this run came closest to, within NEAR_GOLD_S, on a stage you
 *  have not got it: "0.4 s from gold in Stage 2." Stage times read as their clocks do. */
export function goldHook(ticks: readonly number[], board: Pick<Board, 'stages'>, held: readonly number[]): string | null {
  let best: { gap: number; stage: number } | null = null;
  stageSeconds(ticks).forEach((s, i) => {
    const gold = board.stages[i]?.[2];
    if (gold === undefined || (held[i] ?? 0) >= 3) return;
    const gap = timeGap(s, gold);
    if (s > gold && gap >= 1 && gap <= NEAR_GOLD_S * 10 && (!best || gap < best.gap)) best = { gap, stage: i };
  });
  const b = best as { gap: number; stage: number } | null;
  return b ? `${gapSeconds(b.gap)} from gold in Stage ${b.stage + 1}.` : null;
}

/**
 * What decided it against your rival, from stage times: the stage you lost most in, or took most from
 * them in if you won. "You lost 2.1 s to Mila in Stage 2." Null when no stage says so (a dead heat on
 * every stage, or a run that never reached a line they did).
 */
export function decidedLine(name: string, you: readonly number[], them: readonly number[], won: boolean): string | null {
  let at = -1;
  let most = 0;
  for (let i = 0; i < Math.min(you.length, them.length); i++) {
    const d = won ? them[i] - you[i] : you[i] - them[i];
    if (d > most) {
      most = d;
      at = i;
    }
  }
  if (at < 0) return null;
  const gap = timeGap(you[at], them[at]);
  if (gap < 1) return null;
  return won ? `You took ${gapSeconds(gap)} from ${name} in Stage ${at + 1}.` : `You lost ${gapSeconds(gap)} to ${name} in Stage ${at + 1}.`;
}
