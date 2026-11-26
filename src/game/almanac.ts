import { ROSTER } from '../bot/roster';
import type { SaveData } from './save';
import { SCARVES, type Source, TRAILS, chapterPieces } from './garage';
import { PAINTS } from './paints';

// The Almanac (round 8, G4): Rider Rank's track. Every run pays experience into one rank (rank.ts), and each
// page of the Almanac is a rank with a reward on it. Fifty pages, the first ten quick and each opening something
// that changes how a run plays, then charms, mirrors, a mountain's other hour, trick flourishes, pieces of the
// garage found nowhere else, titles and modes. A monthly chapter of ten pages runs beside it, by the calendar,
// with its own themed set; old chapters stay on the shelf and can be finished any time, so nothing is ever missed
// for good.
//
// Experience is a measure, not a currency: nothing spends it. Gifts stay the garage's one currency, and a
// chapter's set is on the garage's shelf for gifts as well as in its pages.
//
// The charm pool reaches the sim as a mask (src/sim/charms.ts, SimConfig.charmPool): the starter pool, widened by
// every charm page opened. The gates a run stands (SimConfig.charmGates) open on pages 1 and 4.
//
// Pure: no DOM, render or audio imports.

// ---------------------------------------------------------------- the curve

export const PAGES = 50;

/** XP to turn page n (1-based): 300 to 840 for the first ten, then 1,080 to 2,600, then 2,800 each: about 98,000 to
 *  page 50, which the mid pilot reaches near run 190 and the novice later (scripts/playtest/r8-bars.ts measures it). */
export function pageCost(n: number): number {
  if (n <= 10) return 240 + 60 * n;
  if (n <= 30) return 1000 + 80 * (n - 10);
  return 2800;
}

/** XP from nothing to the end of page n. */
export function xpToPage(n: number): number {
  let x = 0;
  for (let i = 1; i <= Math.min(n, PAGES); i++) x += pageCost(i);
  return x;
}

/** Pages a total of XP has turned (0 to 50), and how far into the next. */
export function pageAt(xp: number): { page: number; into: number; need: number } {
  let left = Math.max(0, Math.floor(xp));
  for (let n = 1; n <= PAGES; n++) {
    const c = pageCost(n);
    if (left < c) return { page: n - 1, into: left, need: c - left };
    left -= c;
  }
  return { page: PAGES, into: 0, need: 0 };
}

// ---------------------------------------------------------------- what a page holds

/** The charms by key, with the sim's ids (src/sim/charms.ts CHARM, stable from r8-sim c20e5e4). */
export const CHARM_IDS: Readonly<Record<string, number>> = {
  slip: 0, comet: 1, kite: 2, frost: 3, star: 4, drum: 5, step: 6, stride: 7, owl: 8, hearth: 9, paper: 10, whirl: 11,
  memory: 12, festival: 13, bell: 14, spirit: 15, second: 16, feather: 17, stone: 18, bark: 19, lamp: 20, path: 21, quick: 22, wisp: 23,
};
/** The pool every rider starts with: two charms of each family (charms.ts STARTER_POOL). */
export const STARTER_CHARMS: readonly string[] = ['comet', 'stride', 'owl', 'hearth', 'second', 'wisp'];

export type Feature = 'contracts' | 'album' | 'rival' | 'longNight' | 'trials';

export type Reward =
  | { kind: 'charm'; charm: string }
  | { kind: 'gate'; gates: 2 | 3 }
  | { kind: 'feature'; feature: Feature }
  | { kind: 'sled'; sled: number }
  | { kind: 'mirror'; mountain: string }
  | { kind: 'hour'; mountain: string }
  | { kind: 'flourish'; trick: string }
  | { kind: 'garage'; shelf: 'scarf' | 'trail' | 'paint' | 'ornament'; id: string }
  | { kind: 'title'; title: string }
  | { kind: 'gifts'; gifts: number }
  | { kind: 'legs'; legs: number }
  /** A mountain opened to ride (Lanternfall, for a rider still short of eleven of The Twelve). */
  | { kind: 'open'; mountain: string };

export interface Page {
  n: number;
  rewards: readonly Reward[];
}

const c = (charm: string): Reward => ({ kind: 'charm', charm });
const t = (title: string): Reward => ({ kind: 'title', title });
const f = (trick: string): Reward => ({ kind: 'flourish', trick });

/** The fifty pages. Pages 1 to 10 each open something that changes play. */
export const ALMANAC: readonly Page[] = (
  [
    [{ kind: 'gate', gates: 2 }, c('slip')],
    [{ kind: 'feature', feature: 'contracts' }, c('step')],
    [{ kind: 'feature', feature: 'album' }, t('Rider')],
    [{ kind: 'gate', gates: 3 }, c('paper')],
    [{ kind: 'sled', sled: 1 }, f('spinningTop')],
    [{ kind: 'feature', feature: 'rival' }, c('bark')],
    [c('kite')],
    [{ kind: 'hour', mountain: 'pinecrest' }, c('feather')],
    [{ kind: 'mirror', mountain: 'pinecrest' }],
    [{ kind: 'feature', feature: 'longNight' }, { kind: 'legs', legs: 3 }, t('Night Rider')],
    [c('drum')],
    [{ kind: 'hour', mountain: 'frostfang' }],
    [c('whirl')],
    [f('spin')],
    [{ kind: 'mirror', mountain: 'frostfang' }, t('Glass Walker')],
    [c('quick')],
    [{ kind: 'garage', shelf: 'scarf', id: 'almanacknot' }],
    [{ kind: 'hour', mountain: 'ember' }],
    [c('festival')],
    [{ kind: 'mirror', mountain: 'ember' }, t('Ash Runner')],
    [{ kind: 'open', mountain: 'lanternfall' }, f('backflip')],
    [{ kind: 'legs', legs: 6 }, c('stone')],
    [{ kind: 'gifts', gifts: 200 }],
    [{ kind: 'hour', mountain: 'sakura' }],
    [{ kind: 'mirror', mountain: 'sakura' }, t('Petal Chaser')],
    [c('memory')],
    [f('railGrab')],
    [{ kind: 'garage', shelf: 'trail', id: 'almanacmoth' }],
    [c('frost')],
    [{ kind: 'mirror', mountain: 'lanternfall' }, t('Mirror Walker')],
    [f('lanternReach')],
    [{ kind: 'hour', mountain: 'lanternfall' }],
    [{ kind: 'legs', legs: 10 }, c('bell')],
    [{ kind: 'gifts', gifts: 250 }],
    [{ kind: 'feature', feature: 'trials' }, t('Trial Rider')],
    [c('lamp')],
    [f('paperWheel')],
    [{ kind: 'garage', shelf: 'paint', id: 'almanacdusk' }],
    [c('spirit')],
    [c('path'), t('Pathfinder')],
    [f('craneFold')],
    [{ kind: 'garage', shelf: 'scarf', id: 'almanacveil' }],
    [c('star')],
    [f('emberTwist')],
    [{ kind: 'gifts', gifts: 300 }, t('Old Hand')],
    [{ kind: 'garage', shelf: 'trail', id: 'almanacember' }],
    [f('spiritKnot')],
    [{ kind: 'gifts', gifts: 300 }],
    [f('crosswind')],
    [t('Lantern Keeper'), { kind: 'garage', shelf: 'trail', id: 'almanackeeper' }],
  ] as Reward[][]
).map((rewards, i) => ({ n: i + 1, rewards }));

/** Pages opened (claimed) on a save. */
export function pagesOpened(d: Pick<SaveData, 'rank'>): number {
  return Math.max(0, Math.min(PAGES, Math.floor(d.rank?.claimed ?? 0)));
}

/** Every reward on the pages opened so far. */
export function rewardsOpened(d: Pick<SaveData, 'rank'>): Reward[] {
  return ALMANAC.slice(0, pagesOpened(d)).flatMap((p) => p.rewards);
}

/** The charm pool the Almanac has opened, as the sim's 24-bit mask (SimConfig.charmPool). */
export function almanacPool(d: Pick<SaveData, 'rank'>): number {
  let m = 0;
  for (const k of STARTER_CHARMS) m |= 1 << CHARM_IDS[k];
  for (const r of rewardsOpened(d)) if (r.kind === 'charm') m |= 1 << CHARM_IDS[r.charm];
  return m >>> 0;
}

/** Charm gates a run stands (SimConfig.charmGates): one at the start, the second from page 1, the third from page 4. */
export function almanacGates(d: Pick<SaveData, 'rank'>): 1 | 2 | 3 {
  let g: 1 | 2 | 3 = 1;
  for (const r of rewardsOpened(d)) if (r.kind === 'gate' && r.gates > g) g = r.gates;
  return g;
}

export function featureOpen(d: Pick<SaveData, 'rank'>, feature: Feature): boolean {
  return rewardsOpened(d).some((r) => r.kind === 'feature' && r.feature === feature);
}

/** A mirror opens on its page, or once every one of The Twelve who calls that mountain home has fallen in a duel:
 *  a mountain you have finished with gives you its mirror (and Lanternfall's, after the King, is somewhere to go). */
export function mirrorOpen(d: Pick<SaveData, 'rank' | 'twelve'>, mountain: string): boolean {
  if (rewardsOpened(d).some((r) => r.kind === 'mirror' && r.mountain === mountain)) return true;
  const mi = MOUNTAIN_ORDER.indexOf(mountain);
  const home = ROSTER.filter((r) => r.home === mi);
  return home.length > 0 && home.every((r) => d.twelve?.beaten.includes(r.key));
}

const MOUNTAIN_ORDER = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];

/** The page that opens Lanternfall to ride and explore (its King and the last race still wait for eleven of The
 *  Twelve): about run 40 for the mid pilot and run 70 for the novice in the bars' careers. */
export const LANTERNFALL_PAGE = 21;

/** A mountain the Almanac has opened to ride. */
export function almanacOpens(d: Pick<SaveData, 'rank'>, mountain: string): boolean {
  return rewardsOpened(d).some((r) => r.kind === 'open' && r.mountain === mountain);
}

export function hourOpen(d: Pick<SaveData, 'rank'>, mountain: string): boolean {
  return rewardsOpened(d).some((r) => r.kind === 'hour' && r.mountain === mountain);
}

/** The Long Night's legs open (0 before page 10). */
export function legsOpen(d: Pick<SaveData, 'rank'>): number {
  return rewardsOpened(d).reduce((a, r) => (r.kind === 'legs' ? Math.max(a, r.legs) : a), 0);
}

/** Titles earned, the Almanac's and the chapters'. */
export function titlesEarned(d: Pick<SaveData, 'rank' | 'chapters'>): string[] {
  const out = rewardsOpened(d).filter((r): r is Extract<Reward, { kind: 'title' }> => r.kind === 'title').map((r) => r.title);
  for (const [key, ch] of Object.entries(d.chapters ?? {})) {
    const def = chapterOf(key);
    if (def && (ch.claimed ?? 0) >= CHAPTER_PAGES) out.push(def.title);
  }
  return out;
}

/** What a reward is called on its card. */
export function rewardName(r: Reward): string {
  switch (r.kind) {
    case 'charm':
      return `Charm: ${CHARM_NAMES[r.charm] ?? r.charm}`;
    case 'gate':
      return r.gates === 2 ? 'A second charm gate' : 'A third charm gate';
    case 'feature':
      return { contracts: 'Daily contracts', album: 'The Spirit Album', rival: 'Call your rival', longNight: 'The Long Night', trials: 'Trials' }[r.feature];
    case 'sled':
      return r.sled === 1 ? 'The Whirl Saucer' : 'A new sled';
    case 'mirror':
      return `Mirror ${MOUNTAIN_NAMES[r.mountain] ?? r.mountain}`;
    case 'hour':
      return `${MOUNTAIN_NAMES[r.mountain] ?? r.mountain} ${HOUR_PHRASES[r.mountain] ?? 'at its other hour'}`;
    case 'flourish':
      return `A flourish for ${TRICK_NAMES[r.trick] ?? r.trick}`;
    case 'garage':
      return [...GARAGE_EXTRAS, ...CHAPTER_EXTRAS].find((g) => g.id === r.id)?.name ?? r.id;
    case 'title':
      return `Title: ${r.title}`;
    case 'gifts':
      return `${r.gifts} gifts`;
    case 'legs':
      return r.legs >= 10 ? 'Every leg of the Long Night' : `The Long Night to ${r.legs} legs`;
    case 'open':
      return `${MOUNTAIN_NAMES[r.mountain] ?? r.mountain}, open to ride`;
  }
}

const MOUNTAIN_NAMES: Readonly<Record<string, string>> = { pinecrest: 'Pinecrest', frostfang: 'Frostfang', ember: 'Ember Peak', sakura: 'Sakura Ridge', lanternfall: 'Lanternfall', oldrun: 'The Old Run' };
/** Round 8, the hours lane: each mountain's other hour as its card says it after the name ("Ember Peak at Night"). The
 *  same words as the palettes' (render/palette.ts ALT_HOURS phrase, which tests/hours.test.ts holds them to), kept here
 *  so the game layer reads no render code. */
export const HOUR_PHRASES: Readonly<Record<string, string>> = { pinecrest: 'at Dusk', frostfang: 'at Noon', ember: 'at Night', sakura: 'in the Evening', lanternfall: 'at First Light', oldrun: 'by Lamplight' };
/** The charms' names (charms.ts CHARMS), for the cards. */
export const CHARM_NAMES: Readonly<Record<string, string>> = {
  slip: 'Slipstream Lantern', comet: "Comet's Tail", kite: 'Kite String', frost: 'Frost Runners', star: 'Falling Star', drum: 'Drift Drum', step: 'Ember Step', stride: 'Long Stride',
  owl: "Owl's Breath", hearth: 'Hearthstone', paper: 'Paper Kite', whirl: 'Whirlwind', memory: "Crane's Memory", festival: 'Festival Drum', bell: 'Bell Rope', spirit: 'Spirit Drum',
  second: 'Second Wind', feather: 'Featherfall', stone: 'Stone Lantern', bark: 'Bark Skin', lamp: 'Last Lamp', path: 'Lamplit Path', quick: 'Quick Feet', wisp: 'Guardian Wisp',
};
/** The tricks' names (tricks.ts TRICKS), for the flourish cards. */
export const TRICK_NAMES: Readonly<Record<string, string>> = {
  spin: 'Spin', backflip: 'Backflip', railGrab: 'Rail Grab', lanternReach: 'Lantern Reach', spiritStretch: 'Spirit Stretch', paperWheel: 'Paper Wheel', craneFold: 'Crane Fold',
  emberTwist: 'Ember Twist', spiritKnot: 'Spirit Knot', crosswind: 'Crosswind', spinningTop: 'Spinning Top',
};

// ---------------------------------------------------------------- the garage's pieces

/** A piece the Almanac or a chapter adds to the garage, as the app lists it: a scarf, a trail, a finish or an
 *  ornament (garage.ts and paints.ts hold the looks). `page`: found only on that Almanac page (never sold).
 *  `chapter`: a chapter's set, sold for gifts from its month on and found on its pages. */
export interface GarageExtra {
  id: string;
  shelf: 'scarf' | 'trail' | 'paint' | 'ornament';
  name: string;
  blurb: string;
  price: number;
  page?: number;
  chapter?: number;
}

const extraOf = (shelf: GarageExtra['shelf'], d: { id: string; name: string; blurb: string; price: number; source: Source }): GarageExtra => ({
  id: d.id,
  shelf,
  name: d.name,
  blurb: d.blurb,
  price: d.price,
  ...(d.source.kind === 'almanac' ? { page: d.source.page } : {}),
  ...(d.source.kind === 'chapter' ? { chapter: d.source.month } : {}),
});

/** The Almanac's own pieces: things the shop never sells (pages 17, 28, 38, 42, 46 and 50). */
export const GARAGE_EXTRAS: readonly GarageExtra[] = [
  ...SCARVES.filter((s) => s.source.kind === 'almanac').map((s) => extraOf('scarf', s)),
  ...TRAILS.filter((s) => s.source.kind === 'almanac').map((s) => extraOf('trail', s)),
  ...PAINTS.filter((s) => s.source.kind === 'almanac').map((s) => extraOf('paint', s)),
].sort((a, b) => (a.page ?? 0) - (b.page ?? 0));

// ---------------------------------------------------------------- chapters

/** Pages in a chapter, and what each costs. */
export const CHAPTER_PAGES = 10;
export const CHAPTER_PAGE_XP = 1500;

export interface Chapter {
  /** 1 to 12: the calendar month it arrives in, every year. */
  month: number;
  name: string;
  line: string;
  title: string;
  /** The mountain its contracts lean on. */
  mountain: string;
}

export const CHAPTERS: readonly Chapter[] = [
  { month: 1, name: 'First Light', line: 'The year opens on Pinecrest', title: 'First Tracks', mountain: 'pinecrest' },
  { month: 2, name: 'The Long Frost', line: 'Glass ice and a low sun', title: 'Frostbound', mountain: 'frostfang' },
  { month: 3, name: 'Thaw Lanterns', line: 'The lanterns come out for the thaw', title: 'Thaw Keeper', mountain: 'lanternfall' },
  { month: 4, name: 'Blossom Run', line: 'Sakura in bloom', title: 'Petal Rider', mountain: 'sakura' },
  { month: 5, name: 'Ash and Ember', line: 'The cone stirs', title: 'Ember Born', mountain: 'ember' },
  { month: 6, name: 'Midsummer Snow', line: 'The longest day on the high snow', title: 'Sun Chaser', mountain: 'frostfang' },
  { month: 7, name: 'Night Market', line: 'Lanterns over the ash market', title: 'Night Trader', mountain: 'ember' },
  { month: 8, name: 'Paper Cranes', line: 'A thousand cranes over the benches', title: 'Crane Folder', mountain: 'sakura' },
  { month: 9, name: 'Harvest Moon', line: 'A low gold moon over the glades', title: 'Moon Rider', mountain: 'pinecrest' },
  { month: 10, name: 'The Haunting', line: 'The hollow is full of riders', title: 'Hollow Friend', mountain: 'lanternfall' },
  { month: 11, name: 'First Snow', line: 'Fresh powder on every run', title: 'Powder Hound', mountain: 'pinecrest' },
  { month: 12, name: 'Lantern Night', line: 'Every lantern lit for the year', title: 'Lamplighter', mountain: 'lanternfall' },
];

/** The chapter key of a day ('2026-12-03' to '2026-12'). */
export function chapterKey(day: string): string {
  return /^\d{4}-\d{2}/.test(day) ? day.slice(0, 7) : '';
}

export function chapterOf(key: string): Chapter | null {
  const m = /^\d{4}-(\d{2})$/.exec(key);
  return m ? (CHAPTERS[Number(m[1]) - 1] ?? null) : null;
}

/** A chapter's set: a scarf, a trail and an ornament that look like their month (garage.ts), each sold for gifts
 *  from its month on and found on its pages. (Round 8's were one pattern list and two colour lists turned, so they
 *  repeated the shop; a chapter's third piece was a paint, the piece least seen at race distance.) */
export function chapterSet(month: number): GarageExtra[] {
  const p = chapterPieces(month);
  return [extraOf('scarf', p.scarf), extraOf('trail', p.trail), extraOf('ornament', p.ornament)];
}

/** A chapter's ten pages: its scarf on page 3, its trail on page 6, its ornament on page 8 and its title on page 10;
 *  gifts between. */
export function chapterRewards(month: number, page: number): Reward[] {
  const set = chapterSet(month);
  if (page === 3) return [{ kind: 'garage', shelf: 'scarf', id: set[0].id }];
  if (page === 6) return [{ kind: 'garage', shelf: 'trail', id: set[1].id }];
  if (page === 8) return [{ kind: 'garage', shelf: 'ornament', id: set[2].id }];
  if (page === 10) return [{ kind: 'title', title: CHAPTERS[month - 1].title }];
  return [{ kind: 'gifts', gifts: 25 + 5 * page }];
}

/** Every chapter piece, every month: what the garage must know to keep an owned one. */
export const CHAPTER_EXTRAS: readonly GarageExtra[] = CHAPTERS.flatMap((ch) => chapterSet(ch.month));

/** The months whose chapters have arrived by a day (chapters arrive from ROUND8_START: none before the game had
 *  them), at most a year back (a year holds all twelve). */
export const ROUND8_START = '2026-12';
export function monthsOpen(day: string): Set<number> {
  const now = chapterKey(day);
  const seen = new Set<number>();
  if (!now || now < ROUND8_START) return seen;
  let [y, m] = ROUND8_START.split('-').map(Number);
  const [ny, nm] = now.split('-').map(Number);
  while (y < ny || (y === ny && m <= nm)) {
    seen.add(m);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return seen;
}

/** The pieces on the garage's shelf for gifts on a day: every chapter's set from its first month on. Almanac pieces
 *  are never sold. */
export function shelfExtras(day: string): GarageExtra[] {
  const out: GarageExtra[] = [];
  for (const month of monthsOpen(day)) out.push(...chapterSet(month));
  return out;
}
