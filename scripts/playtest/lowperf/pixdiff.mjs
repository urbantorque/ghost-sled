// Two directories of stills with the same names, compared pixel by pixel: the share of pixels that differ by more than
// 8 levels in any channel, the mean difference, and the box holding the differing pixels.
//   node scripts/playtest/lowperf/pixdiff.mjs <dir a> <dir b>
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

const [da, db] = process.argv.slice(2);
for (const name of readdirSync(da).filter((f) => f.endsWith('.png')).sort()) {
  let A;
  let B;
  try {
    A = readPng(join(da, name));
    B = readPng(join(db, name));
  } catch {
    console.log(name, 'missing');
    continue;
  }
  let n = 0;
  let sum = 0;
  let x0 = A.w;
  let y0 = A.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < A.h; y++) {
    for (let x = 0; x < A.w; x++) {
      const i = (y * A.w + x) * A.bpp;
      const j = (y * B.w + x) * B.bpp;
      const d = Math.max(Math.abs(A.px[i] - B.px[j]), Math.abs(A.px[i + 1] - B.px[j + 1]), Math.abs(A.px[i + 2] - B.px[j + 2]));
      sum += d;
      if (d > 8) {
        n++;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  const all = A.w * A.h;
  console.log(`${name.padEnd(16)} differ ${((100 * n) / all).toFixed(2)}%  mean ${(sum / all).toFixed(2)}  box ${x1 >= 0 ? `${x0},${y0} to ${x1},${y1}` : '-'}`);
}
