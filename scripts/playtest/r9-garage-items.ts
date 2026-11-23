// Round 9, the garage lane: every item of the proposed garage as markdown tables, from prototypes/r9/garage/catalogue.ts
// (the notes' section 3 is this output, so the list and the data never drift apart).
//   npx tsx scripts/playtest/r9-garage-items.ts > <file>
import { CHAPTERS, ITEMS, NEAR_DUPLICATES, SETS, SLEDS, TIER_NAMES, TRACK_LINES, shelfCounts, trackPrice, type Item, type Source } from '../../prototypes/r9/garage/catalogue';

const src = (s: Source): string => {
  switch (s.kind) {
    case 'free':
      return 'every rider';
    case 'shop':
      return `${s.price.toLocaleString('en-GB')} gifts`;
    case 'almanac':
      return `Almanac page ${s.page} (never sold)`;
    case 'set':
      return `${s.mountain} mastery`;
    case 'chapter':
      return `chapter ${s.month}`;
    case 'track':
      return `${s.lines} lines, ${s.price} gifts`;
  }
};

const L: string[] = [];
const shelfName: Record<string, string> = { hat: 'Hats', scarf: 'Scarves', trail: 'Trails', finish: 'Finishes', ornament: 'Ornaments', sound: 'Sounds' };
for (const shelf of ['hat', 'scarf', 'trail', 'finish', 'ornament', 'sound']) {
  const items = ITEMS.filter((i) => i.shelf === shelf);
  L.push(`**${shelfName[shelf]}** (${items.length})`, '', '| Piece | Source | Against today | What tells it apart at race distance | Levers |', '| --- | --- | --- | --- | --- |');
  for (const it of items as Item[]) L.push(`| ${it.name} | ${src(it.source)} | ${it.status}${it.was ? ` (was ${it.was})` : ''} | ${it.reads} | ${it.levers.join(', ') || '-'} |`);
  L.push('');
}
L.push('**Sleds and their tracks** (each tier opened by stage lines on that sled, then fitted for gifts)', '', `| Sled | Source | Signature | ${TIER_NAMES.map((n, t) => `${n} (${TRACK_LINES[t]} lines)`).join(' | ')} |`, `| --- | --- | --- | ${TIER_NAMES.map(() => '---').join(' | ')} |`);
for (const s of SLEDS) L.push(`| ${s.name} | ${src(s.source)} | ${s.signature}: ${s.signatureHow} | ${s.tiers.map((t, i) => `${t} (${trackPrice(s.id, i)})`).join(' | ')} |`);
L.push('', '**The mountains\' sets** (a third, two thirds and all of the mastery board; never sold)', '', '| Mountain | Motif | Scarf | Trail | Ornament |', '| --- | --- | --- | --- | --- |');
for (const st of SETS) L.push(`| ${st.mountain} | ${st.motif} | ${st.scarf.name}: ${st.scarf.reads} | ${st.trail.name}: ${st.trail.reads} | ${st.ornament.name}: ${st.ornament.reads} |`);
L.push('| the three new mountains | designed with each mountain once the owner has picked them | | | |');
L.push('', '**The months\' chapters** (scarf on page 3, trail on page 6, ornament on page 8; 260, 380 and 320 gifts on the shelf from their month)', '', '| Month | Motif | Scarf | Trail | Ornament |', '| --- | --- | --- | --- | --- |');
for (const ch of CHAPTERS) L.push(`| ${ch.month} ${ch.name} | ${ch.motif} | ${ch.scarf.name}: ${ch.scarf.reads} | ${ch.trail.name}: ${ch.trail.reads} | ${ch.ornament.name}: ${ch.ornament.reads} |`);
L.push('', '**Today\'s near-duplicates, and what becomes of each**', '', '| This | Nearly | Why | What becomes of it |', '| --- | --- | --- | --- |');
for (const d of NEAR_DUPLICATES) L.push(`| ${d.a} | ${d.b} | ${d.why} | ${d.fate} |`);
L.push('', '**Counts by shelf**', '', '| Shelf | Free | Shop | Almanac | Sets | Chapters |', '| --- | --- | --- | --- | --- | --- |');
for (const [k, v] of Object.entries(shelfCounts())) L.push(`| ${k} | ${v.free} | ${v.shop} | ${v.almanac} | ${v.sets} | ${v.chapters} |`);
console.log(L.join('\n'));
