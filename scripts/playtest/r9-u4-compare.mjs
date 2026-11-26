// Round 9, the u4 lane: today's screens against the lane's, from the two `u4-counts.json` r9-u4-count.ts writes (one
// for `before/`, one for `after/`). A row a surface and stage, words on the first view, controls and tab stops, lone
// icons and bare figures, desk then phone. Exits 0.
//   node scripts/playtest/r9-u4-compare.mjs C:/.../shots/r9/u4/before C:/.../shots/r9/u4/after
import fs from 'node:fs';
import path from 'node:path';

const [b, a] = process.argv.slice(2);
const read = (d) => JSON.parse(fs.readFileSync(path.join(d, 'u4-counts.json'), 'utf8'));
const before = read(b);
const after = read(a);
// (A room is shot by both parts, sheets and titles: the first of each name is kept.)
const pick = (rows, form, shot) => rows.find((r) => r.form === form && r.shot === shot) ?? null;
const shots = [...new Set([...before, ...after].map((r) => r.shot))].sort();
const cell = (r, k) => (r ? (Array.isArray(r[k]) ? String(r[k].length) : String(r[k])) : '-');
console.log('| Surface | Desk words, today | Desk words, now | Phone words, today | Phone words, now | Controls, desk (today, now) | Lone icons, desk (today, now) | Bare figures, desk (today, now) |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const s of shots) {
  const db = pick(before, 'desk', s);
  const da = pick(after, 'desk', s);
  const pb = pick(before, 'phone', s);
  const pa = pick(after, 'phone', s);
  console.log(`| ${s} | ${cell(db, 'words')} | ${cell(da, 'words')} | ${cell(pb, 'words')} | ${cell(pa, 'words')} | ${cell(db, 'controls')}, ${cell(da, 'controls')} | ${cell(db, 'loneIcons')}, ${cell(da, 'loneIcons')} | ${cell(db, 'bare')}, ${cell(da, 'bare')} |`);
}
const left = after.filter((r) => r.loneIcons.length || r.bare.length);
if (left.length) {
  console.log('\nStill on the lane\'s screens:');
  for (const r of left) console.log(`${r.form} ${r.shot}: ${[...r.loneIcons.map((x) => `lone icon ${x}`), ...r.bare].join('; ')}`);
}
