// Round 9, the shop lane: every piece the garage holds, shelf by shelf, as the notes' table (name, what it is, price or
// where it is found). Reads the game's own catalogue (garage.ts, paints.ts, tracks.ts).
//   npx tsx scripts/playtest/r9-shop-list.ts
import { HATS, SCARVES, TRAILS, SOUNDS, ORNAMENTS, sourceLine, type Source, type TrailDef, type ScarfDef } from '../../src/game/garage';
import { PAINTS } from '../../src/game/paints';
import { SLED_SHOP, TIER_NAMES, trackPrice } from '../../src/game/tracks';

const where = (price: number, src: Source): string => (src.kind === 'shop' ? `${price.toLocaleString('en-GB')} gifts` : src.kind === 'free' ? 'free' : `${sourceLine(src)}${src.kind === 'chapter' ? ` (${price} gifts in its month)` : ''}`);
// What Low and the phone draw instead (render/meshes.ts lite, rider.ts, render/trailforms.ts setLow).
const lowTrail = (t: TrailDef): string => {
  const f = t.form;
  if (!f) return t.plume ? 'the same plume' : 'the same';
  if (f.kind === 'flakes') return '80 flakes in the air, not 220, thrown at half the rate';
  if (f.kind === 'ribbons') return 'ribbons of 24 segments, not 44';
  if (f.kind === 'kites') return '7 shapes a string, not 11';
  if (f.kind === 'moths') return 'the same three lights';
  return 'an 8-sided lantern, not 12; its light painted on the snow';
};
const lowScarf = (x: ScarfDef): string => (x.form === 'four' ? 'the same (two draws)' : 'the same (one draw)');
const rows = (title: string, list: readonly { id: string; name: string; blurb: string; price: number; source: Source }[], low: (x: never) => string): string[] => [
  `**${title}** (${list.length})`,
  '',
  '| Piece | What it is | Price or where | Low and phone |',
  '| --- | --- | --- | --- |',
  ...list.map((x) => `| ${x.name} | ${x.blurb} | ${where(x.price, x.source)} | ${low(x as never)} |`),
  '',
];
const out: string[] = [];
out.push(...rows('Hats', HATS, () => 'the same outline, fewer facets'));
out.push(...rows('Scarves', SCARVES, lowScarf));
out.push(...rows('Trails', TRAILS, lowTrail));
out.push(...rows('Finishes', PAINTS, () => "the same motif on Low's three-slat sled"));
out.push(...rows('Sounds', SOUNDS, () => 'the same'));
out.push(...rows('Ornaments', ORNAMENTS, () => 'fewer facets; a lit one paints its light on the snow'));
out.push('**Sleds and their tracks**', '', `| Sled | How it comes | Signature | ${TIER_NAMES.join(' | ')} |`, `| --- | --- | --- | ${TIER_NAMES.map(() => '---').join(' | ')} |`);
SLED_SHOP.forEach((s, i) => {
  const how = s.from === 'almanac' ? `Almanac page ${s.page}` : s.price ? `${s.price.toLocaleString('en-GB')} gifts` : 'free';
  out.push(`| ${s.name} | ${how} | ${s.signature} | ${TIER_NAMES.map((_, t) => `${trackPrice(i, t).toLocaleString('en-GB')}`).join(' | ')} |`);
});
console.log(out.join('\n'));
