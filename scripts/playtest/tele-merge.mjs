// Merges tele-batch.sh's per-pilot files into one result tele-r5.mjs can read:
//   node scripts/playtest/tele-merge.mjs <dir> <out.txt>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [dir, out] = process.argv.slice(2);
const runs = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.txt'))) {
  const t = readFileSync(join(dir, f), 'utf8');
  const i = t.indexOf('### Result');
  if (i < 0) continue;
  const line = t.slice(i).split('\n').find((l) => l.startsWith('"') || l.startsWith('{'));
  const o = JSON.parse(line.startsWith('"') ? JSON.parse(line) : line);
  runs.push(...o.runs);
}
writeFileSync(out, '### Result\n' + JSON.stringify({ runs }) + '\n');
console.log(`${runs.length} runs -> ${out}`);
