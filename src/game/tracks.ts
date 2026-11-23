// Each sled's track (round 9, G2): five visible tiers, each opened by riding that sled (the stage lines a run
// crossed on it, a finish is three) and then fitted for gifts (DECISIONS 392: both, because each alone fails:
// riding alone makes gifts worthless again; gifts alone sells a sled's whole history in one tap). A tier is a look
// built where the chase lens sees a sled (its tail, its runners' tails, the sides past the rider's hips, a post over
// the stern), keyed on the save like a finish: nothing here reaches the sim, the bot or a sled's handling
// (tests/garage.test.ts), and the lines are credited by the game layer after a run has settled.
//
// The sleds' prices are the garage's, not the sim's (sim/sleds.ts keeps its own, which nothing in the shop reads):
// the Whirl Saucer left the shop and is the Almanac's page 5 (DECISIONS 392), and the others were repriced for the
// economy (notes/r9-shop.md).
//
// Pure data and save logic: no DOM, render or audio imports.

import type { SaveData } from './save';

export const TIER_NAMES = ['Runners', 'Deck', 'Crest', 'Stern post', 'Spirit inlay'] as const;
/** Stage lines ridden on a sled that open each tier: one, three, six, ten and fifteen finishes' worth. */
export const TRACK_LINES = [3, 9, 18, 30, 45] as const;
/** The Pine Flyer's tier prices; every other sled's are these times its factor, to the nearest ten. */
export const TRACK_BASE = [80, 150, 240, 360, 520] as const;

export interface SledShop {
  /** sim/sleds.ts index. */
  index: number;
  key: string;
  name: string;
  /** Gifts in the shop (0: every rider's, or never sold). */
  price: number;
  /** Where it comes from: every rider's, the shop, or found on an Almanac page. */
  from: 'free' | 'shop' | 'almanac';
  page?: number;
  /** The track's price factor. */
  factor: number;
  /** The sled's own move (sim/tricks.ts SIGNATURE), named on its card with how to do it. */
  signature: string;
  signatureHow: string;
  /** What each tier puts on this sled. */
  tiers: readonly [string, string, string, string, string];
}

export const SLED_SHOP: readonly SledShop[] = [
  {
    index: 0,
    key: 'flyer',
    name: 'Pine Flyer',
    price: 0,
    from: 'free',
    factor: 1,
    signature: 'Pine Bow',
    signatureHow: 'Standing on the sled, a slow bow with both arms out',
    tiers: ['The runner tails scroll up into two curls behind the seat', 'A cream quilted pad over the seat, its stitched edge proud past the hips', 'The bow becomes a carved crest twice its height, edged in vermillion', 'A stern post and its lamp, lit, that warms the snow behind', 'Ink inlay down the runners and round the crest that burns with your scarf in the flow'],
  },
  {
    index: 1,
    key: 'whirl',
    name: 'Whirl Saucer',
    price: 0,
    from: 'almanac',
    page: 5,
    factor: 1,
    signature: 'Spinning Top',
    signatureHow: 'Sitting still and upright while the saucer spins flat under you',
    tiers: ['A chased steel skid ring round the rim', 'A cream quilted cushion in the dish', 'A tall curved backrest of bent wood behind you', 'A short mast at the back of the rim and its lamp, lit', 'An ink spiral in the dish that burns outward with your scarf in the flow'],
  },
  {
    index: 2,
    key: 'lodge',
    name: 'Lodge Toboggan',
    price: 300,
    from: 'shop',
    factor: 1.1,
    signature: 'Fireside',
    signatureHow: 'Lying back along the toboggan, hands behind the head, boots up',
    tiers: ['Steel-shod runner strips, their ends curled up at the tail', 'A cream blanket roll strapped across the deck behind you', 'A crest board standing at the tail, edged in vermillion', 'A bent-wood hoop over the tail and its lantern, lit', 'Ink inlay along the slats that burns with your scarf in the flow'],
  },
  {
    index: 3,
    key: 'comet',
    name: 'Comet Bob',
    price: 600,
    from: 'shop',
    factor: 1.25,
    signature: 'Comet Tail',
    signatureHow: 'Let go and trailing behind the sled from one runner, body streamed out flat',
    tiers: ['A second, raised steel shoe curling off each runner\'s tail', 'Quilted cream backrest panels inside the sideboards', 'A tall tail fin between the push bars, the comet streaking up it', 'A lamp on a post off the push bar, lit', 'The comet inlaid in ink that burns from its head to its tail in the flow'],
  },
  {
    index: 4,
    key: 'wisp',
    name: 'Wisp',
    price: 950,
    from: 'shop',
    factor: 1.4,
    signature: "Will-o'-Wisp",
    signatureHow: 'Floating a hand above the sled, both hands off, arms loose like a drifting light',
    tiers: ['Runners drawn out into long thin curls at the tail', 'A pale pad with three cream cords laced across it', 'Two swept wings off the deck\'s sides behind you', 'A hanging lamp on a long bent stalk, lit', 'Ink filigree on the wings that burns with your scarf in the flow'],
  },
  {
    index: 5,
    key: 'crumpet',
    name: 'Tea Tray',
    price: 1400,
    from: 'shop',
    factor: 1.6,
    signature: 'Teacup',
    signatureHow: 'Sitting cross-legged, turning the tray slowly with both hands',
    tiers: ['A raised gallery rail round the rim', 'A cream embroidered cloth in the tray under you', 'Two tall curled handles fore and aft, the aft one a crest behind you', 'A small lamp on the aft handle, lit', 'The chased ring inlaid in ink that burns in the flow'],
  },
];

export function sledShop(index: number): SledShop {
  return SLED_SHOP[index] ?? SLED_SHOP[0];
}

export function trackPrice(sled: number, tier: number): number {
  return Math.round((TRACK_BASE[tier] * sledShop(sled).factor) / 10) * 10;
}

/** A sled's track as the save keeps it: the stage lines ridden on it and the tiers fitted (0 to 5, in order). */
export interface TrackSave {
  lines: number;
  fitted: number;
}

/** The tracks as a save holds them: known sleds only, whole numbers, fitted 0 to 5; null when none holds anything. */
export function readTracks(v: unknown): Record<string, TrackSave> | null {
  if (!v || typeof v !== 'object') return null;
  const out: Record<string, TrackSave> = {};
  for (const s of SLED_SHOP) {
    const t = (v as Record<string, unknown>)[s.key] as Partial<TrackSave> | undefined;
    if (!t || typeof t !== 'object') continue;
    const lines = Number.isFinite(t.lines) ? Math.max(0, Math.min(1e6, Math.floor(t.lines as number))) : 0;
    const fitted = Number.isFinite(t.fitted) ? Math.max(0, Math.min(5, Math.floor(t.fitted as number))) : 0;
    if (lines > 0 || fitted > 0) out[s.key] = { lines, fitted };
  }
  return Object.keys(out).length ? out : null;
}

export function trackOf(d: Pick<SaveData, 'tracks'>, sled: number): TrackSave {
  const t = d.tracks?.[sledShop(sled).key];
  return { lines: t?.lines ?? 0, fitted: t?.fitted ?? 0 };
}

function writeTrack(d: SaveData, sled: number, t: TrackSave): void {
  const key = sledShop(sled).key;
  const all = { ...(d.tracks ?? {}) };
  if (t.lines > 0 || t.fitted > 0) all[key] = t;
  else delete all[key];
  if (Object.keys(all).length) d.tracks = all;
  else delete d.tracks;
}

/** What a tier is on a save: fitted, open to fit (ridden enough, the one before it fitted), still to ride (lines
 *  short), or waiting on the tier before it. */
export type TierState = 'fitted' | 'open' | 'ride' | 'later';

export function tierState(d: Pick<SaveData, 'tracks'>, sled: number, tier: number): TierState {
  const t = trackOf(d, sled);
  if (tier < t.fitted) return 'fitted';
  if (tier > t.fitted) return 'later';
  return t.lines >= TRACK_LINES[tier] ? 'open' : 'ride';
}

/** Stage lines still to ride on a sled before a tier opens (0 once open). */
export function linesToGo(d: Pick<SaveData, 'tracks'>, sled: number, tier: number): number {
  return Math.max(0, TRACK_LINES[tier] - trackOf(d, sled).lines);
}

/** Credits a run's stage lines (0 to 3) to the sled it rode. The game layer calls it once a run has settled. */
export function creditLines(d: SaveData, sled: number, lines: number): void {
  const n = Math.max(0, Math.min(3, Math.floor(lines)));
  if (n <= 0 || !d.ownedSleds.includes(sled)) return;
  const t = trackOf(d, sled);
  writeTrack(d, sled, { lines: t.lines + n, fitted: t.fitted });
}

/** Fits a sled's next tier for gifts, if it is open and affordable. Returns the tier fitted, or -1. */
export function fitTier(d: SaveData, sled: number): number {
  const t = trackOf(d, sled);
  if (t.fitted >= 5 || !d.ownedSleds.includes(sled)) return -1;
  const price = trackPrice(sled, t.fitted);
  if (t.lines < TRACK_LINES[t.fitted] || d.gifts < price) return -1;
  d.gifts -= price;
  writeTrack(d, sled, { lines: t.lines, fitted: t.fitted + 1 });
  return t.fitted;
}

/** Fits tiers as a gift (the Almanac's page 5 on a save that bought the Saucer before round 9): up to `tiers`,
 *  whatever the lines, never lowering what is fitted. Returns the tiers it added. */
export function giveTiers(d: SaveData, sled: number, tiers: number): number {
  const t = trackOf(d, sled);
  const to = Math.max(t.fitted, Math.min(5, tiers));
  if (to === t.fitted) return 0;
  writeTrack(d, sled, { lines: t.lines, fitted: to });
  return to - t.fitted;
}

/** Sets a sled's fitted tiers back (a revive's second settle takes back what the first gave). */
export function setFitted(d: SaveData, sled: number, fitted: number): void {
  const t = trackOf(d, sled);
  writeTrack(d, sled, { lines: t.lines, fitted: Math.max(0, Math.min(5, fitted)) });
}

/** The tiers fitted on a sled, as render wants them (meshes.ts sledGeometryFor). */
export function tiersOn(d: Pick<SaveData, 'tracks'>, sled: number): number {
  return trackOf(d, sled).fitted;
}
