// Round 9, Gullhaven's world: the greyscale sorting test (notes/r9-briefs/gullhaven.md section 2), as the Old Run's was
// run (oldrun-world-sort.mjs). Gullhaven's first frames (its opening, three places and its finish) and the Old Run's
// made grey as the five's set in shots/r9/measure/stills/gray/ was made (ffmpeg-static, format=gray), shuffled with that
// set under neutral names by a seeded order, the key written OUTSIDE the folder a critic is shown.
//   node scripts/r9/gullhaven-world-sort.mjs --new <dir,dir,...> --five <the five's gray dir> --out <folder for the critic>
//        --key <file.json> [--seed 9391]
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const fresh = arg('new');
const five = arg('five');
const out = arg('out');
const keyFile = arg('key');
let seed = Number(arg('seed', '9391')) >>> 0;
if (!fresh || !five || !out || !keyFile) throw new Error('usage: --new <dir,dir> --five <dir> --out <dir> --key <file>');
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const list = [...readdirSync(five).filter((f) => f.endsWith('.png')).map((f) => ({ src: join(five, f), from: 'five', name: f, gray: true }))];
for (const dir of fresh.split(',')) list.push(...readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => ({ src: join(dir, f), from: dir.replace(/[\/]+$/, '').split(/[\/]/).slice(-3).join('/'), name: f, gray: false })));
for (let i = list.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [list[i], list[j]] = [list[j], list[i]];
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const key = {};
list.forEach((f, i) => {
  const name = `frame-${String(i + 1).padStart(2, '0')}.png`;
  const dst = join(out, name);
  if (f.gray) copyFileSync(f.src, dst);
  else execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', f.src, '-vf', 'format=gray', dst]);
  key[name] = `${f.from}:${f.name}`;
});
writeFileSync(keyFile, JSON.stringify(key, null, 1));
console.log(`${list.length} frames into ${out}; key in ${keyFile}`);
