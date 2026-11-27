// Round 9, the look lane (the brief's section 3): the sorting test across all eight. The five's stills
// (shots/r9/measure/stills/gray/ or colour/: each one's opening, three places and finish) and each new mountain's own five
// from a pass of this lane (look-shoot.mjs: the opening, three places and the finish), shuffled together under neutral names
// by a seeded order into a folder named for nothing, with ART.md beside them; the key written OUTSIDE that folder.
// Greyscale by default (ffmpeg-static format=gray, as the five's gray set was made); --colour keeps every frame's colour.
//   node scripts/r9/look-sort.mjs --set p2 --out <folder> --key <file.json> [--colour] [--seed 4471]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const colour = argv.includes('--colour');
const set = opt('set', 'p2');
const out = opt('out');
const keyFile = opt('key');
let seed = Number(opt('seed', '4471')) >>> 0;
if (!out || !keyFile || path.resolve(keyFile).startsWith(path.resolve(out))) throw new Error('needs --out and a --key outside it');
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const shots = 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/';
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const fiveDir = `${shots}measure/stills/${colour ? 'colour' : 'gray'}/`;
const list = fs.readdirSync(fiveDir).filter((f) => f.endsWith('.png')).map((f) => ({ src: fiveDir + f, from: f.split('-')[0], name: f, conv: false }));
// Each new mountain's opening, three places down its run and its finish, from the lane's pass.
const NEW = {
  oldrun: ['a-opening', 'c-q1', 'd-q2', 'f-q3', 'h-finish'],
  gullhaven: ['a-opening', 'c-lip', 'd-air', 'e-shelf', 'g-finish'],
  gablefall: ['a-opening', 'c-roof', 'e-street', 'f-washing', 'g-finish'],
};
for (const [m, names] of Object.entries(NEW)) for (const n of names) list.push({ src: `${shots}look/sets/${set}/${m}/${n}.png`, from: m, name: n, conv: !colour });
for (let i = list.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [list[i], list[j]] = [list[j], list[i]];
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const key = {};
list.forEach((f, i) => {
  const name = `frame-${String(i + 1).padStart(2, '0')}.png`;
  const dst = path.join(out, name);
  if (f.conv) execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', f.src, '-vf', 'format=gray', dst]);
  else fs.copyFileSync(f.src, dst);
  key[name] = `${f.from}:${f.name}`;
});
fs.copyFileSync(path.join(repo, 'ART.md'), path.join(out, 'ART.md'));
fs.mkdirSync(path.dirname(keyFile), { recursive: true });
fs.writeFileSync(keyFile, JSON.stringify(key, null, 1));
console.log(`${list.length} frames (${colour ? 'colour' : 'greyscale'}) into ${out}; key in ${keyFile}`);
