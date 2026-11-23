import type { LanternTownView } from './contract';

// Round 9, the shop lane: what the garage's UI is shown (the app builds it from the save: app.ts garageView) and what
// it asks for (GarageAct). Types only, so the app and the garage's own module (loaded on demand) share them without
// either pulling in the other.

/** The garage's shelves: the place's tabs. */
export type GarageShelfKey = 'sled' | 'hat' | 'scarf' | 'trail' | 'finish' | 'sound';
/** A shelf, or the ornament on a sled's stern post (chosen on the Sled card). */
export type GaragePieceShelf = GarageShelfKey | 'ornament';

export interface GarageItemView {
  id: string;
  name: string;
  /** What tells it apart, in a line. */
  blurb: string;
  /** Where a piece that is not the shop's comes from ("Found on Almanac page 42"); '' for a shop piece. */
  from: string;
  price: number;
  /** Worn now; owned; for sale and affordable; for sale and short of gifts; found elsewhere (not sold); a chapter's
   *  piece whose month has not come. */
  state: 'on' | 'owned' | 'buy' | 'short' | 'found' | 'later';
  /** New since the garage was last opened. */
  isNew?: boolean;
}

export interface GarageTierView {
  name: string;
  what: string;
  price: number;
  /** Fitted; ready to fit (ridden enough) and affordable; ridden enough but short of gifts; still to ride; waiting on
   *  the tier before it. */
  state: 'fitted' | 'open' | 'short' | 'ride' | 'later';
  linesToGo: number;
}

export interface GarageSledView {
  id: number;
  name: string;
  trait: string;
  signature: string;
  signatureHow: string;
  price: number;
  state: 'on' | 'owned' | 'buy' | 'short' | 'found';
  from: string;
  tiers: GarageTierView[];
  /** Stage lines ridden on it. */
  lines: number;
}

export interface GarageView {
  wallet: number;
  shelves: Record<Exclude<GarageShelfKey, 'sled'>, GarageItemView[]>;
  sleds: GarageSledView[];
  /** The stern post's ornaments (shown on the Sled card once a sled's fourth tier is fitted). */
  ornaments: GarageItemView[];
  lanterns: LanternTownView[];
  /** Open at this piece (the results' "Ready in the shop"). */
  focus?: { shelf: GarageShelfKey; id: string } | null;
}

export type GarageAct =
  | { kind: 'try'; shelf: GaragePieceShelf; id: string }
  | { kind: 'buy'; shelf: GaragePieceShelf; id: string }
  | { kind: 'wear'; shelf: GaragePieceShelf; id: string }
  | { kind: 'fit'; sled: number }
  | { kind: 'ride'; sled: number }
  | { kind: 'watch'; sled: number }
  | { kind: 'listen'; id: string }
  | { kind: 'rafters'; on: boolean }
  | { kind: 'light'; town: string }
  | { kind: 'skip' }
  | { kind: 'close' };
