// Round 9, the "Not paintings" bar: names the still set stills.js shot (m<i>-z<metre>.png, one folder a tier) by the
// plan r9-stills-plan.ts wrote, keeps the colour originals under those names, writes greyscale copies (ffmpeg-static,
// as blind-pairs.mjs --gray does) and a contact sheet of each, a row a mountain. No browser.
//   node scripts/playtest/r9-stills-name.mjs --raw <dir of m*-z*.png> --plan <plan.json> --out <dir>
// Writes <out>/colour/<id>-<n>-<slot>-z<metre>-<kind>[-<set piece>].png, the same under <out>/gray/, and
// <out>/colour-sheet.png and <out>/gray-sheet.png.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const RAW = opt('raw', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/stills/raw/high');
const PLAN = opt('plan', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/stills-plan.json');
const OUT = opt('out', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/stills');
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
for (const d of ['colour', 'gray']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const tmp = path.join(OUT, '.tile');
const rows = [];
let missing = 0;
for (const [m, p] of Object.entries(plan)) {
  const row = [];
  p.frames.forEach((f, i) => {
    const src = path.join(RAW, `m${m}-z${String(f.z).padStart(4, '0')}.png`);
    const name = `${p.id}-${i + 1}-${f.slot}-z${String(f.z).padStart(4, '0')}-${f.kind}${f.piece ? `-${f.piece}` : ''}.png`;
    if (!fs.existsSync(src)) {
      console.log(`missing ${src}`);
      missing++;
      return;
    }
    fs.copyFileSync(src, path.join(OUT, 'colour', name));
    execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', src, '-vf', 'format=gray', path.join(OUT, 'gray', name)]);
    row.push(name);
  });
  rows.push(row);
}
// A contact sheet of each set: the frames in order, a row a mountain (ffmpeg's tile filter over numbered copies).
const cols = Math.max(...rows.map((r) => r.length));
for (const d of ['colour', 'gray']) {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp);
  let n = 0;
  for (const row of rows) for (let c = 0; c < cols; c++) {
    const f = row[c];
    const to = path.join(tmp, `${String(n++).padStart(3, '0')}.png`);
    if (f) fs.copyFileSync(path.join(OUT, d, f), to);
    else execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720', '-frames:v', '1', to]);
  }
  execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', path.join(tmp, '%03d.png'), '-vf', `scale=384:-1,tile=${cols}x${rows.length}:padding=4:color=white`, '-frames:v', '1', path.join(OUT, `${d}-sheet.png`)]);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`named ${rows.reduce((a, r) => a + r.length, 0)} stills in ${OUT} (colour, gray, and a sheet of each)${missing ? `; ${missing} missing` : ''}`);
