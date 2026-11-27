// Round 9, the look lane: a contact sheet of frames (each scaled to --w wide, --cols to a row, in the order given), for
// looking at a probe's variants side by side. ffmpeg-static, no fonts: the order is the label.
//   node scripts/r9/look-sheet.mjs --out sheet.png [--w 640] [--cols 2] a.png b.png ...
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
// (--before <dir> --after <dir>: each frame of after's beside the same frame of before's, before on the left; --only a,b
// keeps the frames whose names start with those.)
let files = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (opt('after')) {
  const only = (opt('only', '') || '').split(',').filter(Boolean);
  const names = fs.readdirSync(opt('after')).filter((f) => f.endsWith('.png') && (!only.length || only.some((o) => f.startsWith(o))));
  files = names.flatMap((f) => [path.join(opt('before'), f), path.join(opt('after'), f)]);
}
const out = opt('out');
const w = Number(opt('w', '640'));
const cols = Number(opt('cols', '2'));
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const h = Math.round((w * 9) / 16);
const inputs = files.flatMap((f) => ['-i', f]);
const n = files.length;
const scale = files.map((_, i) => `[${i}:v]scale=${w}:${h}[s${i}]`).join(';');
const layout = files.map((_, i) => `${(i % cols) * w}_${Math.floor(i / cols) * h}`).join('|');
const fill = n === 1 ? `[s0]copy[o]` : `${files.map((_, i) => `[s${i}]`).join('')}xstack=inputs=${n}:layout=${layout}:fill=black[o]`;
execFileSync(ffmpeg, ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${scale};${fill}`, '-map', '[o]', out]);
console.log(out);
