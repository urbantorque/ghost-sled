// Round 8 (speed): tiles each strip that speedstrips.js shot into one picture, two frames a row and four rows, read
// left to right and down (ffmpeg-static; no browser). The strips go into `<out>/<name>.png`, named as the strip is
// (`m0-z0300.png`), so blind-pairs.mjs pairs the before and after folders by name.
//   node scripts/playtest/speedstrips-tile.mjs <frames dir> <out dir> [frame width 640]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [dir, out, wS] = process.argv.slice(2);
if (!dir || !out) {
  console.log('usage: node scripts/playtest/speedstrips-tile.mjs <frames dir> <out dir> [frame width]');
  process.exit(1);
}
const w = Number(wS) || 640;
const h = Math.round((w * 9) / 16);
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
fs.mkdirSync(out, { recursive: true });
const strips = new Map();
for (const f of fs.readdirSync(dir)) {
  const m = /^(m\d-z\d{4})-f(\d+)\.png$/.exec(f);
  if (!m) continue;
  if (!strips.has(m[1])) strips.set(m[1], []);
  strips.get(m[1])[Number(m[2])] = path.join(dir, f);
}
for (const [name, frames] of strips) {
  const fr = frames.filter(Boolean);
  if (fr.length < 2) continue;
  const n = fr.length;
  const args = ['-loglevel', 'error', '-y'];
  for (const f of fr) args.push('-i', f);
  const scaled = fr.map((_, i) => `[${i}:v]scale=${w}:${h}[s${i}]`).join(';');
  const layout = fr.map((_, i) => `${(i % 2) * w}_${Math.floor(i / 2) * h}`).join('|');
  const inputs = fr.map((_, i) => `[s${i}]`).join('');
  args.push('-filter_complex', `${scaled};${inputs}xstack=inputs=${n}:layout=${layout}:fill=black[o]`, '-map', '[o]', path.join(out, `${name}.png`));
  execFileSync(ffmpeg, args);
  console.log(name, n);
}
