// Round 8, the light lane: each frame's value structure, the brief's measure of "light that gathers" (V5): the
// share of the frame under 15% and over 85% luminance (sRGB-encoded Rec. 709 luma), its mean, and a ten-bin
// histogram. No dependencies: a small PNG reader over node's zlib (8-bit RGB or RGBA, not interlaced, which is
// what the captures write).
//   node scripts/playtest/histo.mjs <dir or png>... [--prefix m4] [--json out.json]
// A directory is read for every PNG in it (optionally only those starting with --prefix); the table is printed
// per file and as a mean per directory.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { inflateSync } from 'node:zlib';

function readPng(path) {
  const buf = readFileSync(path);
  let o = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const t = buf.toString('ascii', o + 4, o + 8);
    const d = buf.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      if (d[8] !== 8 || d[12] !== 0) throw new Error(`${path}: only 8-bit, non-interlaced PNGs`);
      type = d[9];
    } else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    o += 12 + len;
  }
  const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!bpp) throw new Error(`${path}: colour type ${type}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0;
      const b = y > 0 ? px[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, px };
}

function measure(path) {
  const { w, h, bpp, px } = readPng(path);
  const bins = new Array(10).fill(0);
  let dark = 0;
  let light = 0;
  let sum = 0;
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const r = px[i * bpp] / 255;
    const g = px[i * bpp + 1] / 255;
    const b = px[i * bpp + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += l;
    if (l < 0.15) dark++;
    if (l > 0.85) light++;
    bins[Math.min(9, Math.floor(l * 10))]++;
  }
  return { file: basename(path), dark: dark / n, light: light / n, mean: sum / n, bins: bins.map((x) => x / n) };
}

const args = process.argv.slice(2);
let prefix = '';
let jsonOut = '';
const paths = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prefix') prefix = args[++i];
  else if (args[i] === '--json') jsonOut = args[++i];
  else paths.push(args[i]);
}
const pct = (x) => (x * 100).toFixed(1).padStart(5);
const all = [];
for (const p of paths) {
  const files = statSync(p).isDirectory()
    ? readdirSync(p)
        .filter((f) => f.endsWith('.png') && f.startsWith(prefix))
        .sort()
        .map((f) => join(p, f))
    : [p];
  const rows = files.map(measure);
  console.log(`\n${p}`);
  console.log('frame              <15%   >85%   mean   histogram (0..1 in tenths, %)');
  for (const r of rows) console.log(`${r.file.padEnd(18)} ${pct(r.dark)}  ${pct(r.light)}  ${pct(r.mean)}   ${r.bins.map((b) => Math.round(b * 100)).join(' ')}`);
  if (rows.length > 1) {
    const m = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    console.log(`${'mean'.padEnd(18)} ${pct(m('dark'))}  ${pct(m('light'))}  ${pct(m('mean'))}`);
  }
  all.push({ dir: p, rows });
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all, null, 1));
