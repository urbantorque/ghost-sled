import { ALMANAC, CHAPTER_PAGES, CHAPTER_PAGE_XP, PAGES, type Reward, chapterKey, chapterOf, chapterRewards, featureOpen, pageAt, rewardName } from './almanac';
import { type AlbumRun, awardStickers, stickersFor } from './album';
import { type ContractRun, settleContracts } from './contracts';
import { lightDay } from './flame';
import { type GoalContext, type LostTo, type NextGoal, type PrimaryButton, nextGoals, primaryButton } from './goals';
import type { PoolGhostData } from './ghostdata';
import type { Board } from './ladder';
import { leagueXp, settleLeague } from './league';
import type { RunSummary } from './missions';
import type { SaveData } from './save';
import { RECENT_RUNS, type RecentRun } from './spinesave';

// Rider Rank (round 8, G4): one bar every run moves. Each run pays experience by the table below, from what the
// run did and what the game layer's own settles already found (missions, the ladder and its medals, mastery's stars,
// The Twelve, the Daily's and the Cup's medals): so every scattered goal moves the one bar the player always sees.
// The Almanac's pages (almanac.ts) are the rank's track. settleSpine is the one call the app makes on the results,
// after the existing settles: experience, pages opened and their rewards, the monthly chapter, the flame, the
// contracts, the Cup's league, the album, the last runs for the goals, and the card's one primary button.
//
// Experience is never spent: it is a measure, not a currency. Gifts stay the garage's one currency.
//
// Pure: no DOM, render or audio imports.

/** The experience table. */
export const XP = {
  ride: 20,
  stage: 10,
  finish: 60,
  /** A rider in the field finished behind you. */
  place: 8,
  /** A rider passed, once a rider a run, at most `passCap` of them. */
  pass: 6,
  passCap: 10,
  /** A named trick landed; a trick new to the run 2 more; at most `trickCap` a run. */
  trick: 3,
  trickFresh: 2,
  trickCap: 60,
  setPiece: 25,
  /** A set piece's variant won for the first time ever. */
  variantNew: 25,
  showdown: 20,
  /** A charm ridden for the first time ever. */
  charmNew: 25,
  mission: [0, 40, 60, 90] as readonly number[],
  rung: 5,
  rungCap: 100,
  stageMedal: [0, 15, 25, 40] as readonly number[],
  runMedal: [0, 30, 50, 80] as readonly number[],
  dayMedal: [0, 20, 35, 60] as readonly number[],
  star: 30,
  duel: 150,
  crown: 400,
  bestTime: 20,
  /** The day's first run: its experience again, up to this much more. */
  firstOfDay: 200,
};

/** What one run did, as the spine reads it. The app builds it on the results from the run and from what its own
 *  settles returned (spineRunFrom), and so does the bars harness. */
export interface SpineRun {
  /** The save key: a named mountain's id, `daily:<day>`, `cup:<week>` or `mirror:<id>`. */
  key: string;
  /** The named mountain's index (-1 for a Daily or a Cup). */
  mi: number;
  mountainId: string;
  mirror: boolean;
  day: string;
  week: string;
  sum: RunSummary;
  time: number | null;
  stageSeconds: number[];
  /** Riders in the field who finished behind you. */
  beaten: number;
  /** Riders passed (each once). */
  passed: number;
  /** Named tricks landed, by key, and whether each was new to the run. */
  tricks: ReadonlyArray<{ key: string; fresh: boolean }>;
  /** Set pieces met: key, variant index, won. */
  moments: ReadonlyArray<{ key: string; variant: number; won: boolean }>;
  showdownsWon: number;
  charms: readonly string[];
  synergies: readonly string[];
  legend: number;
  mood: number;
  /** Missions this run completed, by tier. */
  missions: readonly number[];
  /** Ladder rungs climbed, stage medals raised (the new medal each), the run medal raised to (0 none), the Daily's or
   *  Cup's day medal raised to (0 none), mastery stars, a duel's rider beaten, the last race won, a new best time. */
  rungs: number;
  stageMedals: readonly number[];
  runMedal: number;
  dayMedal: number;
  stars: number;
  duelWon: string | null;
  crowned: boolean;
  newBestTime: boolean;
  /** How the run ended against a named rival it lost to, for a rematch. */
  lostTo: LostTo | null;
  /** The mountain's ladder (a named mountain), the named mountains open, the Daily ready to ride. */
  board: Board | null;
  open: readonly string[];
  dailyReady: boolean;
  /** A Cup run: the week's pool, for its league. */
  cupPool?: readonly PoolGhostData[];
  /** The run's record, for the album's frames. */
  record?: string;
  nightLegs?: number;
}

export interface XpTick {
  source: string;
  label: string;
  xp: number;
}

/** A thing the run gained that the save keeps (the results' "what opened" step; the no-dead-runs bar). */
export interface SpineGain {
  kind: 'page' | 'sticker' | 'streak' | 'contract' | 'chapter' | 'league' | 'ember' | 'unlock';
  text: string;
  durable: true;
}

export interface OpenedReward {
  page: number;
  /** The chapter's month key for a chapter page. */
  chapter?: string;
  reward: Reward;
  name: string;
}

export interface SpineOutcome {
  ticks: XpTick[];
  xp: number;
  xpBefore: number;
  xpAfter: number;
  pageBefore: number;
  pageAfter: number;
  opened: OpenedReward[];
  stickers: string[];
  gains: SpineGain[];
  goals: NextGoal[];
  primary: PrimaryButton;
  flame: { lit: boolean; streak: number; calendar: number; embered: boolean; emberEarned: boolean };
  contracts: { met: string[]; bonus: boolean; form: string | null };
  league: { place: number | null; was: number | null; div: number } | null;
  /** What this settle paid in gifts and granted, so a revive's second settle can take it back first. */
  settlement: SpineSettlement;
}

export interface SpineSettlement {
  snapshot: string;
  gifts: number;
  items: Array<{ list: 'scarves' | 'trails' | 'paints'; id: string }>;
  sleds: number[];
}

const SPINE_KEYS = ['rank', 'chapters', 'album', 'flame', 'contracts', 'league', 'longNight', 'recent'] as const;

/** The experience a run's own doing pays, line by line (without contracts, the calendar, the league and the day's
 *  first-run bonus, which settleSpine adds). */
export function xpTicks(run: SpineRun, fresh: { variants: number; charms: number }): XpTick[] {
  const t: XpTick[] = [];
  const add = (source: string, label: string, xp: number): void => {
    if (xp > 0) t.push({ source, label, xp: Math.round(xp) });
  };
  add('ride', run.sum.finished ? 'Finished' : `${run.stageSeconds.length} stage ${run.stageSeconds.length === 1 ? 'line' : 'lines'}`, XP.ride + XP.stage * run.stageSeconds.length + (run.sum.finished ? XP.finish : 0));
  add('place', `${run.beaten} behind you`, XP.place * run.beaten);
  add('pass', `${run.passed} passed`, XP.pass * Math.min(XP.passCap, run.passed));
  add('tricks', `${run.tricks.length} ${run.tricks.length === 1 ? 'trick' : 'tricks'}`, Math.min(XP.trickCap, run.tricks.reduce((a, k) => a + XP.trick + (k.fresh ? XP.trickFresh : 0), 0)));
  const won = run.moments.filter((m) => m.won).length;
  add('setPiece', `${won} set ${won === 1 ? 'piece' : 'pieces'}`, XP.setPiece * won + XP.variantNew * fresh.variants);
  add('showdown', `${run.showdownsWon} ${run.showdownsWon === 1 ? 'showdown' : 'showdowns'}`, XP.showdown * run.showdownsWon);
  add('charm', 'A new charm', XP.charmNew * fresh.charms);
  add('mission', `${run.missions.length} ${run.missions.length === 1 ? 'mission' : 'missions'}`, run.missions.reduce((a, tier) => a + (XP.mission[tier] ?? XP.mission[1]), 0));
  add('rung', `${run.rungs} ${run.rungs === 1 ? 'rung' : 'rungs'}`, Math.min(XP.rungCap, XP.rung * run.rungs));
  add('medal', 'Medals', run.stageMedals.reduce((a, m) => a + (XP.stageMedal[m] ?? 0), 0) + (XP.runMedal[run.runMedal] ?? 0) + (XP.dayMedal[run.dayMedal] ?? 0));
  add('star', `${run.stars} ${run.stars === 1 ? 'star' : 'stars'}`, XP.star * run.stars);
  add('duel', run.crowned ? 'The last race' : 'A duel won', run.crowned ? XP.crown : run.duelWon ? XP.duel : 0);
  add('best', 'A new best time', run.newBestTime ? XP.bestTime : 0);
  return t;
}

/** The next page and what it takes. */
export function nextPage(d: Pick<SaveData, 'rank'>): { page: number; need: number; label: string } | null {
  const at = pageAt(d.rank?.xp ?? 0);
  if (at.page >= PAGES) return null;
  return { page: at.page + 1, need: at.need, label: `Page ${at.page + 1}` };
}

/** A run as the recent list keeps it. */
function recentOf(run: SpineRun, xp: number): RecentRun {
  const s: Record<string, number | boolean | string> = {};
  for (const [k, v] of Object.entries(run.sum)) if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') s[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  return { k: run.key, t: run.time, ss: run.stageSeconds.slice(0, 3).map((x) => Math.round(x * 10) / 10), s, won: run.moments.filter((m) => m.won).length, tricks: new Set(run.tricks.map((k) => k.key)).size, xp };
}

/** Applies a reward to the save (what is not implied by the pages opened), recording what it granted. */
function grant(d: SaveData, r: Reward, st: SpineSettlement): void {
  if (r.kind === 'gifts') {
    d.gifts += r.gifts;
    d.lifetimeGifts += r.gifts;
    st.gifts += r.gifts;
  } else if (r.kind === 'sled' && !d.ownedSleds.includes(r.sled)) {
    d.ownedSleds = [...d.ownedSleds, r.sled];
    st.sleds.push(r.sled);
  } else if (r.kind === 'garage') {
    const list = r.shelf === 'scarf' ? 'scarves' : r.shelf === 'trail' ? 'trails' : 'paints';
    const have = d[list] ?? [];
    if (!have.includes(r.id)) {
      d[list] = [...have, r.id];
      st.items.push({ list, id: r.id });
    }
  }
}

/** Takes back what an earlier settle of this same run paid and granted, and restores the spine's fields. */
function undo(d: SaveData, prior: SpineSettlement): void {
  const was = JSON.parse(prior.snapshot) as Partial<SaveData>;
  for (const k of SPINE_KEYS) {
    if (was[k] === undefined) delete d[k];
    else (d as unknown as Record<string, unknown>)[k] = was[k];
  }
  d.gifts -= prior.gifts;
  d.lifetimeGifts -= prior.gifts;
  for (const it of prior.items) d[it.list] = (d[it.list] ?? []).filter((x) => x !== it.id);
  d.ownedSleds = d.ownedSleds.filter((s) => !prior.sleds.includes(s));
}

/**
 * Settles a run into the spine, once (a revive's second settle passes the first's `settlement` as `prior`, which is
 * taken back first, so the run is settled once on its final self). Call after the existing settles, with save.runs
 * already counting this run.
 */
export function settleSpine(d: SaveData, run: SpineRun, prior: SpineSettlement | null = null): SpineOutcome {
  if (prior) undo(d, prior);
  const snap: Record<string, unknown> = {};
  for (const k of SPINE_KEYS) if (d[k] !== undefined) snap[k] = d[k];
  const st: SpineSettlement = { snapshot: JSON.stringify(snap), gifts: 0, items: [], sleds: [] };
  const gains: SpineGain[] = [];

  // The flame: any run lights the day.
  const fl = lightDay(d.flame, run.day);
  d.flame = fl.flame;
  if (fl.lit.lit) gains.push({ kind: 'streak', text: fl.lit.embered ? `Day ${fl.lit.streak}: your ember kept the flame` : `Day ${fl.lit.streak} of your flame`, durable: true });
  if (fl.lit.emberEarned) gains.push({ kind: 'ember', text: 'An ember for a missed day', durable: true });
  if (fl.lit.gifts) {
    d.gifts += fl.lit.gifts;
    d.lifetimeGifts += fl.lit.gifts;
    st.gifts += fl.lit.gifts;
  }

  // The album.
  const albumRun: AlbumRun = { mountain: run.mi >= 0 ? run.mountainId : '', mirror: run.mirror, finished: run.sum.finished, time: run.time, mood: run.mood, legend: run.legend, moments: run.moments, tricks: run.tricks.map((k) => k.key), duelWon: run.duelWon, charms: run.charms, synergies: run.synergies, nightLegs: run.nightLegs };
  // (Collected from the first run: the album opens on page 3 already holding them.)
  const stickers = stickersFor(d.album, albumRun);
  d.album = awardStickers(d.album, stickers, d.runs, run.record);
  if (!d.album) delete d.album;
  for (const id of stickers) gains.push({ kind: 'sticker', text: id, durable: true });

  // Experience from the run itself.
  const ticks = xpTicks(run, { variants: stickers.filter((s) => s.startsWith('v:')).length, charms: stickers.filter((s) => s.startsWith('c:')).length });

  // The recent runs (this one in, for the form contract and the goals).
  const recent = [...(d.recent ?? []), recentOf(run, 0)].slice(-RECENT_RUNS);
  d.recent = recent;

  // Contracts: the day's three once the Almanac opens them, and the standing form contract.
  const cr: ContractRun = { key: run.key, finished: run.sum.finished, time: run.time, passes: run.passed, perfects: run.sum.perfects, setPieces: run.moments.filter((m) => m.won).length, tricks: new Set(run.tricks.map((k) => k.key)).size, lights: run.sum.lights, nearMisses: run.sum.nearMisses, dashes: run.sum.dashes, stageGolds: run.stageMedals.filter((m) => m >= 3).length };
  const co = settleContracts(d.contracts, run.day, cr, { seed: d.missions.seed ?? 0, open: run.open, recent, daily: featureOpen(d, 'contracts') });
  d.contracts = co.save;
  for (const m of co.met) gains.push({ kind: 'contract', text: m, durable: true });
  if (co.bonus) gains.push({ kind: 'contract', text: 'All three contracts', durable: true });
  if (co.formMet) gains.push({ kind: 'contract', text: co.formMet, durable: true });
  if (co.xp) ticks.push({ source: 'contract', label: 'Contracts', xp: co.xp });
  if (fl.lit.xp) ticks.push({ source: 'calendar', label: `Calendar day ${fl.lit.calendar}`, xp: fl.lit.xp });

  // The Cup's league.
  let league: SpineOutcome['league'] = null;
  if (run.key.startsWith('cup:') && run.cupPool) {
    const lg = settleLeague(d.league, run.week, run.time, run.cupPool);
    d.league = lg.save;
    league = { place: lg.place, was: lg.was, div: lg.save.div };
    const x = leagueXp(lg.was, lg.place);
    if (x) {
      ticks.push({ source: 'league', label: `Cup league: ${lg.place}${ordinal(lg.place ?? 0)}`, xp: x });
      gains.push({ kind: 'league', text: `Cup league: ${lg.place}${ordinal(lg.place ?? 0)} in division ${lg.save.div}`, durable: true });
    }
  }

  // The day's first run counts twice, up to firstOfDay more.
  const base = ticks.reduce((a, k) => a + k.xp, 0);
  if (fl.lit.lit) ticks.push({ source: 'firstOfDay', label: "The day's first run", xp: Math.min(XP.firstOfDay, base) });
  const xp = ticks.reduce((a, k) => a + k.xp, 0);
  recent[recent.length - 1].xp = xp;

  // The rank and the Almanac: pages turned open now, and a backlog (a seeded save) opens one more a run.
  const xpBefore = d.rank?.xp ?? 0;
  const claimedBefore = d.rank?.claimed ?? 0;
  const pageBefore = pageAt(xpBefore).page;
  const xpAfter = xpBefore + xp;
  const pageAfter = pageAt(xpAfter).page;
  const backlog = Math.max(0, pageBefore - claimedBefore);
  const claimed = Math.min(pageAfter, claimedBefore + (pageAfter - pageBefore) + (backlog > 0 ? 1 : 0));
  d.rank = { xp: xpAfter, claimed };
  const opened: OpenedReward[] = [];
  for (let n = claimedBefore + 1; n <= claimed; n++) {
    for (const r of ALMANAC[n - 1].rewards) {
      grant(d, r, st);
      opened.push({ page: n, reward: r, name: rewardName(r) });
      if (r.kind === 'open') gains.push({ kind: 'unlock', text: MOUNTAIN_NAME[r.mountain] ?? r.mountain, durable: true });
    }
    gains.push({ kind: 'page', text: `Page ${n}`, durable: true });
  }

  // The month's chapter, and once it is done the oldest one unfinished.
  const ck = chapterKey(run.day);
  if (chapterOf(ck)) {
    const chapters = { ...(d.chapters ?? {}) };
    chapters[ck] ??= { xp: 0, claimed: 0 };
    let key = ck;
    if (chapters[ck].claimed >= CHAPTER_PAGES) {
      const older = Object.keys(chapters).filter((k) => chapters[k].claimed < CHAPTER_PAGES).sort()[0];
      if (older) key = older;
    }
    const ch = { ...chapters[key] };
    ch.xp += xp;
    const to = Math.min(CHAPTER_PAGES, Math.floor(ch.xp / CHAPTER_PAGE_XP));
    const month = chapterOf(key)!.month;
    for (let n = ch.claimed + 1; n <= to; n++) {
      for (const r of chapterRewards(month, n)) {
        grant(d, r, st);
        opened.push({ page: n, chapter: key, reward: r, name: rewardName(r) });
      }
      gains.push({ kind: 'chapter', text: `${chapterOf(key)!.name}, page ${n}`, durable: true });
    }
    ch.claimed = Math.max(ch.claimed, to);
    chapters[key] = ch;
    d.chapters = chapters;
  }

  // The next run: every goal in reach, and the one button.
  const ctx: GoalContext = { key: run.key, mi: run.mi, day: run.day, board: run.board, lostTo: run.lostTo, duelWon: run.duelWon !== null || run.crowned, dailyReady: run.dailyReady };
  const goals = nextGoals(d, ctx);
  const primary = primaryButton(goals);
  return {
    ticks,
    xp,
    xpBefore,
    xpAfter,
    pageBefore,
    pageAfter,
    opened,
    stickers,
    gains,
    goals,
    primary,
    flame: { lit: fl.lit.lit, streak: fl.lit.streak, calendar: fl.lit.calendar, embered: fl.lit.embered, emberEarned: fl.lit.emberEarned },
    contracts: { met: co.met, bonus: co.bonus, form: co.formMet },
    league,
    settlement: st,
  };
}

/** A mountain's name, as the unlock card and the career harness call it (sim/mountains.ts MOUNTAINS). */
const MOUNTAIN_NAME: Readonly<Record<string, string>> = { lanternfall: 'Lanternfall' };

function ordinal(n: number): string {
  const t = n % 100;
  const o = n % 10;
  return t >= 11 && t <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th';
}
