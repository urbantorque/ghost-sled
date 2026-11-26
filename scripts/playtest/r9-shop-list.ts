// Round 9, the shop lane: every piece the garage holds, shelf by shelf, as the notes' table (name, what it is, price or
// where it is found). Reads the game's own catalogue (garage.ts, paints.ts, tracks.ts).
//   npx tsx scripts/playtest/r9-shop-list.ts
import { HATS, SCARVES, TRAILS, SOUNDS, ORNAMENTS, sourceLine, type Source } from '../../src/game/garage';
import { PAINTS } from '../../src/game/paints';
import { SLED_SHOP, TIER_NAMES, trackPrice } from '../../src/game/tracks';

const where = (price: number, src: Source): string => (src.kind === 'shop' ? `${price.toLocaleString('en-GB')} gifts` : src.kind === 'free' ? 'free' : `${sourceLine(src)}${src.kind === 'chapter' ? ` (${price} gifts in its month)` : ''}`);
const rows = (title: string, list: readonly { id: string; name: string; blurb: string; price: number; source: Source }[]): string[] => [
  `**${title}** (${list.length})`,
  '',
  '| Piece | What it is | Price or where |',
  '| --- | --- | --- |',
  ...list.map((x) => `| ${x.name} | ${x.blurb} | ${where(x.price, x.source)} |`),
  '',
];
const out: string[] = [];
out.push(...rows('Hats', HATS));
out.push(...rows('Scarves', SCARVES));
out.push(...rows('Trails', TRAILS));
out.push(...rows('Finishes', PAINTS));
out.push(...rows('Sounds', SOUNDS));
out.push(...rows('Ornaments', ORNAMENTS));
out.push('**Sleds and their tracks**', '', `| Sled | How it comes | Signature | ${TIER_NAMES.join(' | ')} |`, `| --- | --- | --- | ${TIER_NAMES.map(() => '---').join(' | ')} |`);
SLED_SHOP.forEach((s, i) => {
  const how = s.from === 'almanac' ? `Almanac page ${s.page}` : s.price ? `${s.price.toLocaleString('en-GB')} gifts` : 'free';
  out.push(`| ${s.name} | ${how} | ${s.signature} | ${TIER_NAMES.map((_, t) => `${trackPrice(i, t).toLocaleString('en-GB')}`).join(' | ')} |`);
});
console.log(out.join('\n'));
