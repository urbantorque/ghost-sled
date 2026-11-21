// Round 8 (image): the rider's sharpness in a strip, the image lane's second measure beside DECISIONS 287's shimmer.
// For each strip image-strips.sh shot, the mean luma step between neighbours (thousandths of white, as pipe.js's
// `grad`) inside a box round the rider's place in the chase, over the strip's frames: a softer rider reads lower.
// Compare two folders of the same strips (the same ticks), never across strips. PNG reader as histo.mjs's.
//   node scripts/playtest/image-measure.mjs <frames dir A> <frames dir B> [x,y,w,h]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
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
      type = d[9];
    } else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    o += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
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

function grad(path, [rx, ry, rw, rh]) {
  const { w, bpp, px } = readPng(path);
  const L = (x, y) => {
    const p = (y * w + x) * bpp;
    return 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
  };
  let g = 0;
  for (let y = ry; y < ry + rh - 1; y++) for (let x = rx; x < rx + rw - 1; x++) g += Math.abs(L(x + 1, y) - L(x, y)) + Math.abs(L(x, y + 1) - L(x, y));
  return (g / ((rw - 1) * (rh - 1) * 255)) * 1000;
}

const [a, b, rS] = process.argv.slice(2);
const rect = (rS || '540,380,200,220').split(',').map(Number);
const strips = (d) => {
  const m = new Map();
  for (const f of readdirSync(d)) {
    const r = /^(m\d-z\d{4})-f(\d+)\.png$/.exec(f);
    if (!r) continue;
    if (!m.has(r[1])) m.set(r[1], []);
    m.get(r[1]).push(join(d, f));
  }
  return m;
};
const A = strips(a);
const B = strips(b);
let sa = 0;
let sb = 0;
let n = 0;
for (const [name, fa] of A) {
  const fb = B.get(name);
  if (!fb) continue;
  const ga = fa.map((f) => grad(f, rect)).reduce((x, y) => x + y, 0) / fa.length;
  const gb = fb.map((f) => grad(f, rect)).reduce((x, y) => x + y, 0) / fb.length;
  sa += ga;
  sb += gb;
  n++;
  console.log(name.padEnd(10), ga.toFixed(1).padStart(6), gb.toFixed(1).padStart(6), `${(((gb - ga) / ga) * 100).toFixed(1)}%`);
}
if (n) console.log('mean'.padEnd(10), (sa / n).toFixed(1).padStart(6), (sb / n).toFixed(1).padStart(6), `${(((sb - sa) / sa) * 100).toFixed(1)}%`);
