// Round 8 (image): crops each strip image-strips.sh shot to one region and tiles its frames two to a row, so a crawl,
// a doubled edge or a soft rider shows at 1:1 or enlarged (a whole frame tiled at half size hides exactly what is
// judged). ffmpeg-static, no browser. Strips are named as shot (`m0-z0900`), so blind-pairs.mjs pairs two folders.
//   node scripts/playtest/image-tile.mjs <frames dir> <out dir> <crop> [scale 1] [only m0-z0900,...]
//   <crop> is x,y,w,h in the frame's pixels, or `rider` (a box round the rider's place in the chase) or `full`.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [dir, out, cropS, scaleS, onlyS] = process.argv.slice(2);
if (!dir || !out || !cropS) {
  console.log('usage: node scripts/playtest/image-tile.mjs <frames dir> <out dir> <x,y,w,h|rider|full> [scale] [only]');
  process.exit(1);
}
const named = { rider: [480, 330, 320, 240], full: [0, 0, 1280, 720] };
// (`rider`: a 320 by 240 box centred on where the rider was at the strip's first frame, from image-strips.js's report
// beside the frames, `<frames>/../m<m>.json`; the fixed box if there is none.)
const riderAt = (name) => {
  try {
    const j = JSON.parse(JSON.parse(fs.readFileSync(path.join(dir, '..', name.slice(0, 2) + '.json'), 'utf8')));
    const s = j.strips.find((x) => x.z === Number(name.slice(4)));
    const b = s && s.rider0;
    if (!b) return null;
    const x = Math.max(0, Math.min(1280 - 320, Math.round(b[0] + b[2] / 2 - 160)));
    const y = Math.max(0, Math.min(720 - 240, Math.round(b[1] + b[3] / 2 - 120)));
    return [x, y, 320, 240];
  } catch {
    return null;
  }
};
const crop = named[cropS] ?? cropS.split(',').map(Number);
const scale = Number(scaleS) || 1;
const only = onlyS ? new Set(onlyS.split(',')) : null;
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
fs.mkdirSync(out, { recursive: true });
const strips = new Map();
for (const f of fs.readdirSync(dir)) {
  const m = /^(m\d-z\d{4})-f(\d+)\.png$/.exec(f);
  if (!m || (only && !only.has(m[1]))) continue;
  if (!strips.has(m[1])) strips.set(m[1], []);
  strips.get(m[1])[Number(m[2])] = path.join(dir, f);
}
for (const [name, frames] of strips) {
  const fr = frames.filter(Boolean);
  if (fr.length < 2) continue;
  const n = fr.length;
  const [cx, cy, cw, ch] = (cropS === 'rider' && riderAt(name)) || crop;
  const w = Math.round(cw * scale);
  const h = Math.round(ch * scale);
  const args = ['-loglevel', 'error', '-y'];
  for (const f of fr) args.push('-i', f);
  // (Nearest-neighbour enlargement: a pixel stays a pixel, so a stair-step is seen as it is.)
  const scaled = fr.map((_, i) => `[${i}:v]crop=${cw}:${ch}:${cx}:${cy},scale=${w}:${h}:flags=neighbor[s${i}]`).join(';');
  const layout = fr.map((_, i) => `${(i % 2) * w}_${Math.floor(i / 2) * h}`).join('|');
  const inputs = fr.map((_, i) => `[s${i}]`).join('');
  args.push('-filter_complex', `${scaled};${inputs}xstack=inputs=${n}:layout=${layout}:fill=black[o]`, '-map', '[o]', path.join(out, `${name}.png`));
  execFileSync(ffmpeg, args);
  console.log(name, n);
}
