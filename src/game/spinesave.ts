import { PAGES, pageAt } from './almanac';

// The spine's save fields (round 8, milestone 3): their shapes, the readers merge() runs them through, and the
// one-time seeding of a save made before the spine. Every field is optional and written only once it holds
// something, as `twelve` was added (round 7): an old save loads unchanged and writes back in its own shape until it
// earns something new. A reader never throws: a value it cannot read is dropped and the rest kept.
//
// Kept apart from save.ts so the systems (rank.ts, flame.ts, contracts.ts, league.ts, album.ts) can share the
// shapes without importing the store.
//
// Pure: no DOM, render or audio imports.

/** Rider Rank: total experience, and the Almanac's pages opened (each page's reward is opened on the results). */
export interface RankSave {
  xp: number;
  claimed: number;
  /** Round 9 (M3): rewards told that no page turned in their settle gave (almanac.ts owedRewards): a new mountain's other
   *  hour on a page turned before the page held it, and its mirror once its home riders are all beaten to the line
   *  ('hour:<id>', 'mirror:<id>'). Written only once it holds one. */
  told?: string[];
}

/** A monthly chapter's progress, by month key ('2026-12'). */
export interface ChapterSave {
  xp: number;
  claimed: number;
}

/** The Spirit Album: each sticker's id with the run (save.runs) it came on, and the records of the runs that earned
 *  them (the last ALBUM_RUNS such runs, by run number), for the sticker's frame. */
export interface AlbumSave {
  got: Record<string, number>;
  runs?: Record<string, string>;
}
export const ALBUM_RUNS = 40;

/** Keep the lantern lit: days in a row with a run, the best run of days, embers held (0 or 1), days ridden in all
 *  (the seven-day calendar's place), and the last day ridden. */
export interface FlameSave {
  last: string;
  streak: number;
  best: number;
  ember: number;
  days: number;
}

/** One contract: on a mountain key ('daily' for the day's Daily Mountain), a measure and a target. */
export interface Contract {
  id: string;
  /** A named mountain's id, or 'daily'. */
  on: string;
  metric: ContractMetric;
  target: number;
}
export type ContractMetric = 'finish' | 'passes' | 'perfects' | 'setPieces' | 'tricks' | 'lights' | 'nearMisses' | 'dashes' | 'stageGold' | 'time';

/** Today's three contracts (done: a bit each), whether the bonus for all three is paid, and the standing form
 *  contract (re-drawn each time it is met; `drawn` counts how often, to rotate its measure). */
export interface ContractsSave {
  day: string;
  list: Contract[];
  done: number;
  bonus?: boolean;
  /** Contracts met today, and the refills drawn (round 8: contracts.ts CONTRACT_REFILLS). */
  met?: number;
  refills?: number;
  form?: Contract;
  drawn?: number;
}

/** The Cup's league: this week's division (1 top to 5), your best time this week and where it stands, and how last
 *  week ended. */
export interface LeagueSave {
  week: string;
  div: number;
  best?: number;
  place?: number;
  last?: { week: string; div: number; place: number | null; moved: number };
}

/** The Long Night's best depth: legs finished and metres into the next. */
export interface LongNightSave {
  legs: number;
  z: number;
}

/** A recent run, as the next-run goals read it: its key, finish time, stage times, the summary's counts, set
 *  pieces won, distinct named tricks and XP. */
export interface RecentRun {
  k: string;
  t: number | null;
  ss: number[];
  s: Record<string, number | boolean | string>;
  won: number;
  tricks: number;
  xp: number;
}
export const RECENT_RUNS = 5;

// ---------------------------------------------------------------- readers

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const day = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

export function readRank(v: unknown): RankSave | null {
  if (!isObj(v)) return null;
  const xp = Math.floor(num(v.xp, 0, 1e9) ?? 0);
  // A page cannot be opened before it is turned.
  const claimed = Math.min(Math.floor(num(v.claimed, 0, PAGES) ?? 0), pageAt(xp).page);
  // (Round 9: what was told, in its known shapes, once each.)
  const told: string[] = [];
  if (Array.isArray(v.told)) for (const k of v.told as unknown[]) if (typeof k === 'string' && /^(hour|mirror):[a-z]{1,24}$/.test(k) && !told.includes(k)) told.push(k);
  return xp > 0 ? { xp, claimed, ...(told.length ? { told: told.slice(0, 32) } : {}) } : null;
}

export function readChapters(v: unknown): Record<string, ChapterSave> | null {
  if (!isObj(v)) return null;
  const out: Record<string, ChapterSave> = {};
  for (const [k, c] of Object.entries(v)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(k) || !isObj(c)) continue;
    out[k] = { xp: Math.floor(num(c.xp, 0, 1e8) ?? 0), claimed: Math.floor(num(c.claimed, 0, 10) ?? 0) };
  }
  return Object.keys(out).length ? out : null;
}

export function readAlbum(v: unknown, known: (id: string) => boolean): AlbumSave | null {
  if (!isObj(v) || !isObj(v.got)) return null;
  const got: Record<string, number> = {};
  for (const [k, n] of Object.entries(v.got)) if (known(k)) got[k] = Math.floor(num(n, 0, 1e7) ?? 0);
  if (!Object.keys(got).length) return null;
  const out: AlbumSave = { got };
  const rv = v.runs;
  if (isObj(rv)) {
    const runs: Record<string, string> = {};
    const keys = Object.keys(rv).filter((k) => /^\d+$/.test(k) && typeof rv[k] === 'string').sort((a, b) => Number(b) - Number(a)).slice(0, ALBUM_RUNS);
    for (const k of keys) runs[k] = rv[k] as string;
    if (keys.length) out.runs = runs;
  }
  return out;
}

export function readFlame(v: unknown, today: string): FlameSave | null {
  if (!isObj(v)) return null;
  const last = day(v.last);
  if (!last) return null;
  // A day ahead of today is a clock that was wrong: the flame is kept, its day is not.
  const f: FlameSave = {
    last: today && last > today ? today : last,
    streak: Math.floor(num(v.streak, 0, 1e5) ?? 0),
    best: Math.floor(num(v.best, 0, 1e5) ?? 0),
    ember: Math.floor(num(v.ember, 0, 1) ?? 0),
    days: Math.floor(num(v.days, 0, 1e5) ?? 0),
  };
  f.best = Math.max(f.best, f.streak);
  return f;
}

const METRICS: ReadonlySet<string> = new Set(['finish', 'passes', 'perfects', 'setPieces', 'tricks', 'lights', 'nearMisses', 'dashes', 'stageGold', 'time']);
function readContract(v: unknown): Contract | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.on !== 'string' || typeof v.metric !== 'string' || !METRICS.has(v.metric)) return null;
  const target = num(v.target, 0, 1e6);
  return target === null ? null : { id: v.id, on: v.on, metric: v.metric as ContractMetric, target };
}

export function readContracts(v: unknown): ContractsSave | null {
  if (!isObj(v)) return null;
  const list = Array.isArray(v.list) ? v.list.map(readContract).filter((c): c is Contract => c !== null).slice(0, 3) : [];
  const form = readContract(v.form);
  const out: ContractsSave = { day: day(v.day), list, done: Math.floor(num(v.done, 0, 7) ?? 0) };
  if (v.bonus === true) out.bonus = true;
  const met = num(v.met, 0, 99);
  if (met) out.met = Math.floor(met);
  const refills = num(v.refills, 0, 99);
  if (refills) out.refills = Math.floor(refills);
  if (form) out.form = form;
  const drawn = num(v.drawn, 0, 1e6);
  if (drawn) out.drawn = Math.floor(drawn);
  return out.day || form ? out : null;
}

export function readLeague(v: unknown): LeagueSave | null {
  if (!isObj(v) || typeof v.week !== 'string' || !/^\d{4}-W\d{2}$/.test(v.week)) return null;
  const out: LeagueSave = { week: v.week, div: Math.round(num(v.div, 1, 5) ?? 5) };
  const best = num(v.best, 0, 1e5);
  if (best) out.best = best;
  const place = num(v.place, 1, 20);
  if (place) out.place = Math.round(place);
  if (isObj(v.last) && typeof v.last.week === 'string') out.last = { week: v.last.week, div: Math.round(num(v.last.div, 1, 5) ?? 5), place: num(v.last.place, 1, 20), moved: Math.round(num(v.last.moved, -1, 1) ?? 0) };
  return out;
}

export function readLongNight(v: unknown): LongNightSave | null {
  if (!isObj(v)) return null;
  const legs = Math.floor(num(v.legs, 0, 100) ?? 0);
  const z = num(v.z, 0, 1e5) ?? 0;
  return legs > 0 || z > 0 ? { legs, z } : null;
}

export function readRecent(v: unknown): RecentRun[] | null {
  if (!Array.isArray(v)) return null;
  const out: RecentRun[] = [];
  for (const r of v) {
    if (!isObj(r) || typeof r.k !== 'string' || !isObj(r.s)) continue;
    const s: Record<string, number | boolean | string> = {};
    for (const [k, x] of Object.entries(r.s)) if (typeof x === 'number' || typeof x === 'boolean' || typeof x === 'string') s[k] = x;
    out.push({ k: r.k, t: num(r.t, 0, 1e5), ss: Array.isArray(r.ss) ? r.ss.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).slice(0, 3) : [], s, won: Math.floor(num(r.won, 0, 99) ?? 0), tricks: Math.floor(num(r.tricks, 0, 99) ?? 0), xp: Math.floor(num(r.xp, 0, 1e5) ?? 0) });
  }
  return out.length ? out.slice(-RECENT_RUNS) : null;
}

// ---------------------------------------------------------------- a save from before the spine

/** What a save from before the spine has earned, as experience (rank.ts's rates), at most to the end of page 25:
 *  a veteran starts well along and still has half the Almanac to turn. Its pages open one a run on the next
 *  results, so the first runs on the new build each open something. */
export const SEED_PAGE_CAP = 25;

export interface SeedSource {
  runs: number;
  missionsDone: number;
  stars: number;
  medals: number;
  twelve: number;
  crowned: boolean;
}

export function seedXp(s: SeedSource, xpToPage: (n: number) => number): number {
  const xp = 30 * s.runs + 40 * s.missionsDone + 30 * s.stars + 40 * s.medals + 150 * s.twelve + (s.crowned ? 400 : 0);
  return Math.min(Math.max(0, Math.floor(xp)), xpToPage(SEED_PAGE_CAP));
}
