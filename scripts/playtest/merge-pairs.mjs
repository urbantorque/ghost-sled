// The visual lift's merge: a mountain's pairs for its critic, round 7's final frame beside the merged build's at
// the same distance. A spread of the fixed list on each tier (every fourth frame on High, every fifth on Low, every
// sixth on the phone, each from its own offset so the tiers show different places), named moments kept first.
//   node scripts/playtest/merge-pairs.mjs <before dir> <after dir> <mountain 0-4> > pairs-m0.txt
import fs from 'node:fs';

const [before, after, mArg] = process.argv.slice(2);
const m = Number(mArg);
const list = JSON.parse(fs.readFileSync(new URL('./frames-r7.json', import.meta.url), 'utf8'))[String(m)];
const name = (z) => `m${m}-z${String(z).padStart(4, '0')}.png`;
const tiers = [
  { tier: 'high', every: 4, from: 0 },
  { tier: 'low', every: 5, from: 2 },
  { tier: 'phone-medium', every: 6, from: 1 },
];
let n = 0;
const out = [];
for (const { tier, every, from } of tiers) {
  const pick = new Set();
  list.forEach((f, i) => { if ((i - from) % every === 0 && i >= from) pick.add(i); });
  for (const i of [...pick].sort((a, b) => a - b)) {
    const f = list[i];
    const b = `${before}/${tier}/${name(f.z)}`;
    const a = `${after}/${tier}/${name(f.z)}`;
    if (!fs.existsSync(b) || !fs.existsSync(a)) continue;
    n++;
    out.push(`${n}. ${tier} ${name(f.z).replace('.png', '')} (${f.why})`, `   before: ${b}`, `   after:  ${a}`);
  }
}
console.log(out.join('\n'));
