// Round 9, the concepts lane: the greybox frames shuffled under neutral names for a blind critic (the sorting test).
// Copies shots/r9/concepts/<scene>-<view>.png to shots/r9/concepts/blind/fNN.png in a seeded order and writes the
// key beside the folder, never in it. `node scripts/r9/concepts-blind.mjs [seed]`.
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const root = 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/concepts/';
const seed = Number(process.argv[2] ?? 9091);
const frames = readdirSync(root).filter((f) => /^[a-z]+-(opening|place)\.png$/.test(f)).sort();
let s = seed >>> 0;
const rand = () => ((s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
for (let i = frames.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [frames[i], frames[j]] = [frames[j], frames[i]];
}
rmSync(root + 'blind', { recursive: true, force: true });
mkdirSync(root + 'blind');
const key = {};
frames.forEach((f, i) => {
  const name = `f${String(i + 1).padStart(2, '0')}.png`;
  copyFileSync(root + f, root + 'blind/' + name);
  key[name] = f.replace('.png', '');
});
writeFileSync(root + 'blind-key.json', JSON.stringify({ seed, key }, null, 1));
console.log(`${frames.length} frames shuffled with seed ${seed}`);
