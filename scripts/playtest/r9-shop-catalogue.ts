// Round 9, the shop lane: milestone 0's catalogue (prototypes/r9/garage/catalogue.ts) as the game now ships it, read
// from the real data (src/game/garage.ts, paints.ts, tracks.ts, almanac.ts), in the shape the economy's spender reads
// (scripts/playtest/r9-shop-econ.ts, milestone 0's economy.ts pointed here). Nothing of the game imports this.

import { CHAPTERS as ALMANAC_CHAPTERS } from '../../src/game/almanac';
import { HATS, ORNAMENTS, SCARVES, SETS as GARAGE_SETS, SET_SHARES as SHARES, SOUNDS, TRAILS, ornamentById, scarfById, trailById, type Source as GameSource } from '../../src/game/garage';
import { PAINTS } from '../../src/game/paints';
import { SLED_SHOP, TRACK_LINES as LINES, trackPrice } from '../../src/game/tracks';

export type ShelfId = 'sled' | 'track' | 'hat' | 'scarf' | 'trail' | 'finish' | 'ornament' | 'sound' | 'lantern';

export type Source =
  | { kind: 'free' }
  | { kind: 'shop'; price: number }
  | { kind: 'almanac'; page: number }
  | { kind: 'set'; mountain: string; share: number }
  | { kind: 'chapter'; month: number; page: number; price: number }
  | { kind: 'track'; sled: string; tier: number; lines: number; price: number };

export interface Item {
  id: string;
  shelf: ShelfId;
  name: string;
  source: Source;
}

const conv = (s: GameSource, price: number, shelf: ShelfId): Source => {
  switch (s.kind) {
    case 'shop':
      return { kind: 'shop', price };
    case 'almanac':
      return { kind: 'almanac', page: s.page };
    case 'set':
      return { kind: 'set', mountain: s.mountain, share: SHARES[s.piece] };
    case 'chapter':
      return { kind: 'chapter', month: s.month, page: shelf === 'scarf' ? 3 : shelf === 'trail' ? 6 : 8, price };
    default:
      return { kind: 'free' };
  }
};

// (Round 9, G6: a piece no longer sold, kept by those who hold it, is neither bought nor free: left out.)
const live = (x: { source: GameSource }): boolean => x.source.kind !== 'kept';

export const ITEMS: readonly Item[] = [
  ...HATS.filter(live).map((x) => ({ id: x.id, shelf: 'hat' as const, name: x.name, source: conv(x.source, x.price, 'hat') })),
  ...SCARVES.filter((x) => live(x) && x.source.kind !== 'chapter' && x.source.kind !== 'set').map((x) => ({ id: x.id, shelf: 'scarf' as const, name: x.name, source: conv(x.source, x.price, 'scarf') })),
  ...TRAILS.filter((x) => live(x) && x.source.kind !== 'chapter' && x.source.kind !== 'set').map((x) => ({ id: x.id, shelf: 'trail' as const, name: x.name, source: conv(x.source, x.price, 'trail') })),
  ...PAINTS.map((x) => ({ id: x.id, shelf: 'finish' as const, name: x.name, source: conv(x.source, x.price, 'finish') })),
  ...ORNAMENTS.filter((x) => x.source.kind === 'free').map((x) => ({ id: x.id, shelf: 'ornament' as const, name: x.name, source: conv(x.source, x.price, 'ornament') })),
  ...SOUNDS.map((x) => ({ id: x.id, shelf: 'sound' as const, name: x.name, source: conv(x.source, x.price, 'sound') })),
];

export interface SledLook {
  id: string;
  index: number;
  name: string;
  source: Source;
}

export const SLEDS: readonly SledLook[] = SLED_SHOP.map((s) => ({ id: s.key, index: s.index, name: s.name, source: s.from === 'shop' ? { kind: 'shop', price: s.price } : s.from === 'almanac' ? { kind: 'almanac', page: s.page ?? 5 } : { kind: 'free' } }));

export const TRACK_LINES = LINES;
export const SET_SHARES = SHARES;
export const CHAPTER_PRICES = { scarf: 260, trail: 380, ornament: 320 } as const;

export const SETS = Object.entries(GARAGE_SETS).map(([mountain, ids]) => ({ mountain, name: mountain, motif: '', scarf: { name: scarfById(ids[0]).name, reads: '' }, trail: { name: trailById(ids[1]).name, reads: '' }, ornament: { name: ornamentById(ids[2]).name, reads: '' } }));

export const CHAPTERS = ALMANAC_CHAPTERS.map((c) => ({ month: c.month, name: c.name, motif: '', scarf: { name: scarfById(`ch${c.month}scarf`).name, reads: '' }, trail: { name: trailById(`ch${c.month}trail`).name, reads: '' }, ornament: { name: ornamentById(`ch${c.month}orn`).name, reads: '' } }));

export interface Buyable {
  id: string;
  shelf: ShelfId;
  price: number;
  track?: { sled: string; tier: number; lines: number };
  month?: number;
}

export function proposedBuyables(): Buyable[] {
  const out: Buyable[] = [];
  for (const s of SLED_SHOP) if (s.from === 'shop') out.push({ id: `sled:${s.key}`, shelf: 'sled', price: s.price });
  for (const s of SLED_SHOP) for (let t = 0; t < 5; t++) out.push({ id: `track:${s.key}:${t}`, shelf: 'track', price: trackPrice(s.index, t), track: { sled: s.key, tier: t, lines: LINES[t] } });
  for (const it of ITEMS) if (it.source.kind === 'shop') out.push({ id: `${it.shelf}:${it.id}`, shelf: it.shelf, price: it.source.price });
  // (Round 9, G6: a chapter is its trail and its ornament; its scarf's page gives gifts, which the career's lifetime
  // already holds.)
  for (const ch of ALMANAC_CHAPTERS) {
    out.push({ id: `chapter:${ch.month}:ornament`, shelf: 'ornament', price: CHAPTER_PRICES.ornament, month: ch.month });
  }
  return out;
}
