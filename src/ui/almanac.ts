import type { RankBarView, RewardCard } from './contract';
import { type IconName } from './icons';

// Round 8: the spine's small shared pieces: a reward's glyph and Rider Rank's bar share. (Round 9, U4: the two books
// they once drew are books.ts, loaded on demand.)

/** A garage piece's glyph, by its shelf (round 9, U4: a scarf drawn under a sled read as the wrong thing). */
const SHELF_GLYPH: Readonly<Record<string, IconName>> = { scarf: 'scarf', trail: 'trail', ornament: 'ornament', paint: 'brush' };

/** A reward's glyph, as the results' cards and the Almanac's ranks draw it; a garage piece by its shelf. */
export function rewardGlyph(k: RewardCard['kind'], card?: Pick<RewardCard, 'shelf'>): IconName {
  switch (k) {
    case 'sled':
      return 'sledBold';
    case 'gifts':
      return 'gift';
    case 'garage':
      return SHELF_GLYPH[card?.shelf ?? ''] ?? 'sled';
    case 'mirror':
    case 'hour':
    case 'open':
    case 'legs':
      return 'flag';
    case 'feature':
      return 'book';
    default:
      return 'star';
  }
}

/** The bar's share toward the next page, 0 to 1. */
export function barShare(b: RankBarView): number {
  return b.need <= 0 ? 1 : Math.max(0, Math.min(1, b.into / (b.into + b.need)));
}

export type RideMode = { kind: 'night' } | { kind: 'mirror'; mountain: string } | { kind: 'trial' };
