import { hash32 } from '../sim/prng';
import type { Contract, ContractMetric, ContractsSave, RecentRun } from './spinesave';

// Contracts (round 8, G7 and G5). Three a day from page 2 of the Almanac: one on the Daily Mountain and two on
// named mountains you have open, drawn from the UTC day and the save's own seed (no server), each one finishable in
// one run and set from your own recent form; 50 XP each and 100 more for all three. And one standing "form
// contract" from the first run: a measure you usually reach, at about your median over your last runs, re-drawn
// the moment it is met. A recent run already did it, so the results always have a goal one run away (G5's rule),
// and a run that meets it is never dead.
//
// Pure: no DOM, render or audio imports.

export const CONTRACT_XP = 50;
export const CONTRACT_BONUS_XP = 100;
export const FORM_XP = 40;
/** A day's board refills (round 8, no dead runs): a contract met is replaced by a new one on the mountain it was met
 *  on, set from your form there, this many times a day; so a day holds up to six, and the third and fourth runs of a
 *  day on one mountain still have something there to take. The bonus is for the first three met. */
export const CONTRACT_REFILLS = 3;

/** What a run did, as a contract reads it. */
export interface ContractRun {
  /** The save key: a named mountain's id, 'daily:<day>' or 'cup:<week>'. */
  key: string;
  finished: boolean;
  time: number | null;
  passes: number;
  perfects: number;
  setPieces: number;
  tricks: number;
  lights: number;
  nearMisses: number;
  dashes: number;
  stageGolds: number;
}

export function metricOf(run: ContractRun, m: ContractMetric): number {
  switch (m) {
    case 'finish':
      return run.finished ? 1 : 0;
    case 'time':
      return run.time ?? Infinity;
    case 'stageGold':
      return run.stageGolds;
    default:
      return run[m];
  }
}

/** Whether a run meets a contract: on its mountain (or any, for the form contract), at its target. */
export function meets(c: Contract, run: ContractRun): boolean {
  const on = c.on === 'any' || (c.on === 'daily' ? run.key.startsWith('daily:') : run.key === c.on);
  if (!on) return false;
  const v = metricOf(run, c.metric);
  return c.metric === 'time' ? v <= c.target : v >= c.target;
}

/** A recent run's value of a measure (RecentRun keeps the summary's counts). */
function recentValue(r: RecentRun, m: ContractMetric): number {
  const s = r.s;
  const n = (k: string): number => (typeof s[k] === 'number' ? (s[k] as number) : 0);
  switch (m) {
    case 'finish':
      return s.finished === true ? 1 : 0;
    case 'passes':
      return n('ghostsPassed');
    case 'setPieces':
      return r.won;
    case 'tricks':
      return r.tricks;
    case 'time':
      return r.t ?? Infinity;
    case 'stageGold':
      return 0;
    default:
      return n(m);
  }
}

const median = (xs: number[]): number => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[(s.length - 1) >> 1] : 0;
};

const SAY: Record<ContractMetric, (n: number) => string> = {
  finish: () => 'Finish',
  passes: (n) => `Pass ${n} ${n === 1 ? 'ghost' : 'ghosts'}`,
  perfects: (n) => `Land ${n} perfect ${n === 1 ? 'landing' : 'landings'}`,
  setPieces: (n) => (n === 1 ? 'Win a set piece' : `Win ${n} set pieces`),
  tricks: (n) => (n === 1 ? 'Land a trick' : `Land ${n} different tricks`),
  lights: (n) => `Take ${n} spirit lights`,
  nearMisses: (n) => `Get ${n} near ${n === 1 ? 'miss' : 'misses'}`,
  dashes: (n) => `Dash ${n} ${n === 1 ? 'time' : 'times'}`,
  stageGold: () => 'Take a stage gold',
  time: (n) => `Finish under ${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`,
};

const PLACE: Record<string, string> = { daily: 'on the Daily', pinecrest: 'on Pinecrest', frostfang: 'on Frostfang', ember: 'on Ember Peak', sakura: 'on Sakura Ridge', lanternfall: 'on Lanternfall', any: '' };

/** A contract as its card says it ("Pass 4 ghosts on Frostfang"). */
export function contractText(c: Contract): string {
  return `${SAY[c.metric](c.target)} ${PLACE[c.on] ?? ''}`.trim() + '.';
}

/** The measures a named mountain's contract draws from. */
const DAY_METRICS: readonly ContractMetric[] = ['passes', 'perfects', 'setPieces', 'lights', 'nearMisses', 'dashes', 'tricks', 'time'];
/** The form contract's measures, in turn. */
const FORM_METRICS: readonly ContractMetric[] = ['passes', 'perfects', 'lights', 'setPieces', 'nearMisses', 'tricks', 'dashes'];

/** A target from your form: about 90% of your median over the recent runs (on the mountain, for a time), at least 1;
 *  with no form yet, a beginner's. */
function targetFor(m: ContractMetric, recent: readonly RecentRun[], on: string): number | null {
  if (m === 'time') {
    const ts = recent.filter((r) => r.k === on && r.t !== null).map((r) => r.t as number);
    return ts.length >= 2 ? Math.ceil(median(ts) + 3) : null;
  }
  if (!recent.length) return { passes: 2, perfects: 1, lights: 10, setPieces: 1, nearMisses: 2, dashes: 1, tricks: 1 }[m as string] ?? 1;
  const med = median(recent.map((r) => recentValue(r, m)));
  return med >= 1 ? Math.max(1, Math.floor(med * 0.9)) : null;
}

/**
 * Today's three contracts, drawn once a day: the first on the Daily, two on named mountains you have open (two
 * different ones when you can), each a measure your recent form reaches. The same day and seed draw the same.
 */
export function drawContracts(day: string, seed: number, open: readonly string[], recent: readonly RecentRun[]): Contract[] {
  const h = (i: number): number => hash32(seed >>> 0, Number(day.replace(/-/g, '')) | 0, 0xc0ac, i);
  const out: Contract[] = [];
  const dailyTarget = targetFor('passes', recent, 'daily');
  out.push(dailyTarget !== null && dailyTarget >= 2 ? { id: `${day}:0`, on: 'daily', metric: 'passes', target: dailyTarget } : { id: `${day}:0`, on: 'daily', metric: 'finish', target: 1 });
  const mountains = open.length ? open : ['pinecrest'];
  const first = h(1) % mountains.length;
  const picks = mountains.length > 1 ? [mountains[first], mountains[(first + 1 + (h(2) % (mountains.length - 1))) % mountains.length]] : [mountains[0], mountains[0]];
  picks.forEach((on, i) => out.push(drawOn(on, `${day}:${i + 1}`, h(3 + i), recent, out)));
  return out;
}

/** One contract on a mountain: the first measure in turn (from `salt`) your form reaches that the board does not hold
 *  there already. */
function drawOn(on: string, id: string, salt: number, recent: readonly RecentRun[], held: readonly Contract[]): Contract {
  for (let k = 0; k < DAY_METRICS.length; k++) {
    const m = DAY_METRICS[(salt + k) % DAY_METRICS.length];
    if (held.some((c) => c.on === on && c.metric === m)) continue;
    const t = targetFor(m, recent, on);
    if (t !== null) return { id, on, metric: m, target: t };
  }
  return { id, on, metric: 'finish', target: 1 };
}

/** The next form contract: the next measure in turn your recent runs reach at all, at your median there (so at least
 *  half of them reached it). */
export function drawForm(drawn: number, recent: readonly RecentRun[]): Contract {
  for (let k = 0; k < FORM_METRICS.length; k++) {
    const m = FORM_METRICS[(drawn + k) % FORM_METRICS.length];
    const vals = recent.map((r) => recentValue(r, m));
    const med = median(vals);
    if (recent.length && med >= 1) return { id: `form:${drawn}`, on: 'any', metric: m, target: Math.max(1, Math.floor(med)) };
  }
  return { id: `form:${drawn}`, on: 'any', metric: 'finish', target: 1 };
}

export interface ContractsOutcome {
  save: ContractsSave;
  /** Contracts this run met (their text), the bonus, and the XP they paid. */
  met: string[];
  bonus: boolean;
  formMet: string | null;
  xp: number;
}

/**
 * Settles a run against the day's contracts (drawn here on the day's first run, when `daily` is open) and the form
 * contract (re-drawn when met, from the recent runs this run is already among). Pure in what it is given.
 */
export function settleContracts(was: ContractsSave | undefined, day: string, run: ContractRun, o: { seed: number; open: readonly string[]; recent: readonly RecentRun[]; daily: boolean }): ContractsOutcome {
  const s: ContractsSave = was ? { ...was, list: was.list.slice() } : { day: '', list: [], done: 0 };
  if (o.daily && s.day !== day) {
    s.day = day;
    s.list = drawContracts(day, o.seed, o.open, o.recent.slice(0, -1));
    s.done = 0;
    delete s.bonus;
    delete s.met;
    delete s.refills;
  }
  const met: string[] = [];
  let xp = 0;
  if (o.daily) {
    s.list.forEach((c, i) => {
      if (s.done & (1 << i)) return;
      if (!meets(c, run)) return;
      met.push(contractText(c));
      xp += CONTRACT_XP;
      s.met = (s.met ?? 0) + 1;
      // The board refills: a new contract on the mountain this one was met on (a Daily's or a Cup's on the first open
      // named mountain), at your form there.
      if ((s.refills ?? 0) < CONTRACT_REFILLS) {
        s.refills = (s.refills ?? 0) + 1;
        const on = o.open.includes(run.key) ? run.key : (o.open[0] ?? 'pinecrest');
        s.list[i] = drawOn(on, `${day}:r${s.refills}`, hash32(o.seed >>> 0, s.refills, 0xc0ad) % 97, o.recent, s.list);
      } else s.done |= 1 << i;
    });
  }
  let bonus = false;
  if (o.daily && (s.met ?? 0) >= 3 && !s.bonus) {
    s.bonus = true;
    bonus = true;
    xp += CONTRACT_BONUS_XP;
  }
  let formMet: string | null = null;
  if (s.form && meets(s.form, run)) {
    formMet = contractText(s.form);
    xp += FORM_XP;
    s.drawn = (s.drawn ?? 0) + 1;
    s.form = drawForm(s.drawn, o.recent);
  } else if (!s.form) s.form = drawForm(s.drawn ?? 0, o.recent);
  return { save: s, met, bonus, formMet, xp };
}
