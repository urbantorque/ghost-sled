import { MOUNTAINS } from '../sim/mountains';
import { ALMANAC, PAGES, pageAt, rewardName } from './almanac';
import { contractText, metricOf, type ContractRun } from './contracts';
import { type Board, NEAR_GOLD_S, NEAR_RUNG_S, bestStanding, medalsHeld, spotOn } from './ladder';
import { type RunSummary, missionDef, missionTier } from './missions';
import type { SaveData } from './save';
import type { Contract, RecentRun } from './spinesave';
import { homeTime, mountainOpen, nextDuel } from './twelve';

// The next run (round 8, G5): every goal the results could name, whether your last runs put it in reach, and the
// rule that picks the card's ONE primary button. The bars harness (scripts/playtest/r8career.ts) judges reach the
// same way from the pilots' own runs: a goal is in reach when one of your last runs (save.recent) came that close.
//
// The rule, first that applies:
//   1. Rematch <rider>: this run lost to a named rival within reach (a duel by 3 s or less, the grudge or the run's
//      rival by 2 s or 50 m).
//   2. Finish the mission ("12 m short"): an active mission within 15% of its target, or one short of a small count.
//   3. Next Duel <rider>: the next duel's rider is within reach of your times there (0.4 s).
//   4. Today's Daily: the day's Daily is open and not ridden today (a day of the flame, and its contract).
//   5. Run Again, with the nearest goal in reach as its line: a page, a rung, a stage gold, a contract, the form
//      contract (which a recent run already met, so there is always one).
//
// Pure: no DOM, render or audio imports.

export type GoalKind = 'rematch' | 'mission' | 'duel' | 'daily' | 'page' | 'rung' | 'gold' | 'contract' | 'form';

export interface NextGoal {
  kind: GoalKind;
  /** The card's words ("Finish: Ride 2,000 m in one run", "Rank 7: SparkleCedar, 1.2 s up"). */
  text: string;
  /** How short, as the card says it ("12 m short", "0.4 s"), or ''. */
  short: string;
  reachable: boolean;
  /** How near, as a share of the way still to go (0 is there): the rule's tie-break. */
  gap: number;
  /** Names the card says it with (a rider, a mission's text, a page). */
  names: string[];
  /** Round 9: a contract another mountain serves (false): Run Again rides this one, so the button names one served here
   *  first. Absent: served wherever you ride. */
  here?: boolean;
}

export interface PrimaryButton {
  kind: 'rematch' | 'mission' | 'duel' | 'daily' | 'again';
  text: string;
  /** The line under it: the goal it is for ("12 m short", "Page 8 is 60 away"), or null. */
  sub: string | null;
  aria: string;
  /** The goal it names. */
  goal: { kind: GoalKind; names: string[] } | null;
}

/** How this run ended against a named rival, when it lost to one. */
export interface LostTo {
  name: string;
  kind: 'duel' | 'grudge' | 'rival';
  /** Seconds behind (both finished), else metres. */
  seconds: number | null;
  metres: number | null;
}

export interface GoalContext {
  key: string;
  /** The named mountain's index, -1 for a Daily or a Cup. */
  mi: number;
  day: string;
  /** The mountain's ladder (a named mountain). */
  board: Board | null;
  /** This run lost to a named rival. */
  lostTo: LostTo | null;
  duelWon: boolean;
  /** The day's Daily is ready to ride (its pool generated). */
  dailyReady: boolean;
}

export const REACH_MISSION = 0.85;
export const NEAR_MISSION = 0.15;
export const REMATCH_DUEL_S = 3;
export const REMATCH_S = 2;
export const REMATCH_M = 50;
/** The next duel is in reach when one of your recent runs on its mountain came within this of the rider's time (s). */
export const REACH_DUEL_S = 0.4;

/** A small gap in words: "0.4 s", or "a whisker" under a tenth ("0.0 s ahead" read as level). */
const secs = (gap: number): string => (gap < 0.05 ? 'a whisker' : `${gap.toFixed(1)} s`);

const median = (xs: number[]): number => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? s[(s.length - 1) >> 1] : 0;
};

/** A recent run as a contract reads it. */
export function contractRunOf(r: RecentRun): ContractRun {
  const n = (k: string): number => (typeof r.s[k] === 'number' ? (r.s[k] as number) : 0);
  return { key: r.k, finished: r.s.finished === true, time: r.t, passes: n('ghostsPassed'), perfects: n('perfects'), setPieces: r.won, tricks: r.tricks, lights: n('lights'), nearMisses: n('nearMisses'), dashes: n('dashes'), stageGolds: 0 };
}

/** A contract is in reach when a recent run (anywhere, for a count; there, for a time) met its measure. */
function contractInReach(c: Contract, recent: readonly RecentRun[]): boolean {
  return recent.some((r) => {
    if (c.metric === 'time' && r.k !== c.on) return false;
    const v = metricOf(contractRunOf(r), c.metric);
    return c.metric === 'time' ? v <= c.target : v >= c.target;
  });
}

/** Every goal the card could name after a run, with its reach. */
export function nextGoals(d: SaveData, ctx: GoalContext): NextGoal[] {
  const out: NextGoal[] = [];
  const recent = d.recent ?? [];
  const sums = recent.map((r) => r.s as unknown as RunSummary);
  const open = (i: number): boolean => mountainOpen(d, MOUNTAINS[i]);
  const quickest = (key: string): number | null => {
    const ts = recent.filter((r) => r.k === key && r.t !== null).map((r) => r.t as number);
    return ts.length ? Math.min(...ts) : null;
  };
  // 1. A rematch.
  if (ctx.lostTo) {
    const l = ctx.lostTo;
    const near = l.seconds !== null ? l.seconds <= (l.kind === 'duel' ? REMATCH_DUEL_S : REMATCH_S) : l.metres !== null && l.metres <= REMATCH_M;
    out.push({ kind: 'rematch', text: `Rematch ${l.name}`, short: l.seconds !== null ? `${l.seconds.toFixed(1)} s behind` : `${Math.round(l.metres ?? 0)} m behind`, reachable: near, gap: l.seconds !== null ? l.seconds / 10 : (l.metres ?? 999) / 500, names: [l.name] });
  }
  // 2. Missions.
  for (const a of d.missions.active) {
    const def = missionDef(a.id);
    if (!def) continue;
    const t = missionTier(def, a.tier);
    const vals = sums.filter((s) => !def.biome || s.biome === def.biome).map((s) => def.metric(s));
    // Reach is read from your last runs only; how short it says is from your best since the mission came up.
    const top = Math.max(...vals, 0);
    const reachable = top >= t.target * REACH_MISSION || (def.unit === 'n' && t.target >= 2 && top >= t.target - 1);
    const left = Math.max(0, t.target - Math.max(top, a.best));
    // (Round 9: a target one of your last runs met before the mission was drawn is not offered. A mission completes
    // on the run that meets it, so `left` at nothing means the run that met it came first, and the card used to say
    // "done before, so again", on about half of all results.)
    if (left <= 0) continue;
    const short = def.unit === 'm' ? `${Math.ceil(left)} m short` : def.unit === 's' ? `${left.toFixed(1)} s short` : def.unit === 'deg' ? `${left * 180} degrees short` : def.unit === 'm/s' ? `${Math.ceil(left)} m/s short` : `${Math.ceil(left)} more to go`;
    out.push({ kind: 'mission', text: `Finish: ${t.text}`, short, reachable, gap: t.target > 0 ? left / t.target : 0, names: [t.text] });
  }
  // 3. The next duel.
  const nd = nextDuel(d.twelve, open);
  if (nd?.kind === 'duel') {
    const rt = homeTime(nd.rider);
    const q = quickest(MOUNTAINS[nd.rider.home].id);
    const gap = rt !== null && q !== null ? q - rt : Infinity;
    // (Round 9: the duel's line names where it rides, not the rider's time: a duel is won head to head, and the rider's
    // slower time beside your faster best read as already beaten, DECISIONS 391.)
    // (Round 9: the duel this run just lost, again, is a rematch, said as one.)
    const again = ctx.lostTo?.kind === 'duel' && ctx.lostTo.name === nd.rider.name;
    out.push({ kind: 'duel', text: `${again ? 'Rematch' : 'Duel'} ${nd.rider.name}`, short: MOUNTAINS[nd.rider.home].name, reachable: gap <= REACH_DUEL_S, gap: Number.isFinite(gap) ? Math.max(0, gap) / 10 : 1, names: [nd.rider.name] });
  }
  // 4. Today's Daily.
  if (ctx.dailyReady && !ctx.key.startsWith('daily:') && !recentDaily(recent, ctx.day)) out.push({ kind: 'daily', text: "Today's Daily", short: '', reachable: true, gap: 0.05, names: ['Daily'] });
  // 5. The next page.
  const at = pageAt(d.rank?.xp ?? 0);
  if (at.page < PAGES) {
    const per = median(recent.map((r) => r.xp));
    const next = ALMANAC[at.page];
    // (Round 9: a page is Rider Rank's, said with its unit: "Page 8: 300 to go" was a figure a new player could not read.)
    out.push({ kind: 'page', text: `Rider Rank ${at.page + 1}: ${next.rewards.map(rewardName).join(', ')}`, short: `${NF.format(at.need)} XP`, reachable: per > 0 && at.need <= per, gap: per > 0 ? at.need / per / 2 : 1, names: [`Rider Rank ${at.page + 1}`] });
  }
  // 6. The ladder and the golds, on a named mountain.
  if (ctx.mi >= 0 && ctx.board) {
    const spot = spotOn(ctx.board, bestStanding(d.best[ctx.key]));
    const q = quickest(ctx.key);
    if (spot.next && spot.next.standing.time !== null && q !== null && spot.rank !== null) {
      const gap = q - spot.next.standing.time;
      out.push({ kind: 'rung', text: `Rank ${spot.rank - 1}: ${spot.next.name}`, short: secs(gap), reachable: gap <= NEAR_RUNG_S, gap: Math.max(0, gap) / 20, names: [spot.next.name] });
    }
    const held = medalsHeld(d.climb?.[ctx.key]);
    for (let i = 0; i < 3; i++) {
      const gold = ctx.board.stages[i]?.[2];
      if (gold === undefined || held.stages[i] >= 3) continue;
      const ss = recent.filter((r) => r.k === ctx.key).map((r) => r.ss[i]).filter((s): s is number => typeof s === 'number');
      if (!ss.length) continue;
      const gap = Math.min(...ss) - gold;
      out.push({ kind: 'gold', text: `Gold in stage ${i + 1}`, short: secs(gap), reachable: gap <= NEAR_GOLD_S, gap: Math.max(0, gap) / 10, names: [`Stage ${i + 1}`] });
    }
  }
  // 7. Contracts: today's not yet met, and the form contract.
  const c = d.contracts;
  if (c && c.day === ctx.day) c.list.forEach((k, i) => {
    if (c.done & (1 << i)) return;
    out.push({ kind: 'contract', text: contractText(k), short: '', reachable: contractInReach(k, recent), gap: 0.2, names: [contractText(k)], here: servedHere(k.on, ctx.key) });
  });
  if (c?.form) out.push({ kind: 'form', text: contractText(c.form), short: '', reachable: contractInReach(c.form, recent), gap: 0.3, names: [contractText(c.form)], here: servedHere(c.form.on, ctx.key) });
  return out;
}

/** A contract's place (a mountain's id, 'daily' or 'any') against the run's key ('pinecrest', 'daily:2026-11-23'). */
function servedHere(on: string, key: string): boolean {
  return on === 'any' || on === key || (on === 'daily' && key.startsWith('daily:'));
}

function recentDaily(recent: readonly RecentRun[], day: string): boolean {
  return recent.some((r) => r.k === `daily:${day}`);
}

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * A goal as the button's line says it (round 9's copy pass): a player's words, every figure with its unit, never
 * "Page 8: 300 to go". "Mission: ride 800 m in one run. 12 m short", "300 XP to Rider Rank 8", "SparkleCedar is 1.2 s
 * ahead", "Gold in stage 2: 0.4 s to find", "Contract: pass 3 ghosts on Ember Peak".
 */
export function goalWords(g: NextGoal): string {
  switch (g.kind) {
    case 'mission':
      return `Mission: ${lower(g.names[0])}.${g.short ? ` ${g.short[0].toUpperCase()}${g.short.slice(1)}` : ''}`;
    case 'page':
      return `${g.short} to ${g.names[0]}`;
    case 'rung':
      return `${g.names[0]} is ${g.short} ahead`;
    case 'gold':
      return `${g.text}: ${g.short} to find`;
    case 'contract':
      return `Contract: ${lower(g.text)}`;
    case 'form':
      return `Your form: ${lower(g.text)}`;
    default:
      return g.short ? `${g.text}: ${g.short}` : g.text;
  }
}

/**
 * The card's one primary button (the rule in the header). Round 9: the button is always the run (Run Again, Rematch,
 * Next Duel, Today's Daily); a mission is only ever its reason, never "Finish the mission" (read as resuming a run just
 * lost). Its kind stays the rule's, for the career harness's bars.
 */
export function primaryButton(goals: readonly NextGoal[]): PrimaryButton {
  const pick = (k: GoalKind): NextGoal | undefined => goals.filter((g) => g.kind === k && g.reachable).sort((a, b) => a.gap - b.gap)[0];
  const said = (g: NextGoal): PrimaryButton['goal'] => ({ kind: g.kind, names: g.names });
  const rematch = pick('rematch');
  if (rematch) return { kind: 'rematch', text: rematch.text, sub: rematch.short, aria: `${rematch.text}, ${rematch.short}, run again`, goal: said(rematch) };
  const mission = goals.filter((g) => g.kind === 'mission' && g.reachable && g.gap <= NEAR_MISSION).sort((a, b) => a.gap - b.gap)[0];
  if (mission) return { kind: 'mission', text: 'Run Again', sub: goalWords(mission), aria: `Run again. ${goalWords(mission)}`, goal: said(mission) };
  const duel = pick('duel');
  if (duel) return { kind: 'duel', text: duel.text.startsWith('Rematch') ? duel.text : `Next Duel: ${duel.names[0]}`, sub: duel.short ? `On ${duel.short}, head to head` : null, aria: `Duel ${duel.names[0]}${duel.short ? ` on ${duel.short}` : ''}`, goal: said(duel) };
  const daily = pick('daily');
  if (daily) return { kind: 'daily', text: "Today's Daily", sub: 'Keeps your flame lit', aria: "Ride today's Daily", goal: said(daily) };
  // (A goal this mountain serves before one only another can: Run Again rides this one.)
  const near = goals.filter((g) => g.reachable && (g.kind === 'page' || g.kind === 'rung' || g.kind === 'gold' || g.kind === 'contract' || g.kind === 'form' || g.kind === 'mission')).sort((a, b) => Number(a.here === false) - Number(b.here === false) || a.gap - b.gap)[0];
  if (near) return { kind: 'again', text: 'Run Again', sub: goalWords(near), aria: `Run Again. ${goalWords(near)}`, goal: said(near) };
  return { kind: 'again', text: 'Run Again', sub: null, aria: 'Run Again', goal: null };
}
