// Round 8: blind pairs for a critic. The brief's bar for a visual item is "a critic picks the new frame in at least
// 9 of 10 blind pairs and names the change unprompted", so the critic must not know which side is which. Each pair
// is copied as `pair-NN-A.png` and `pair-NN-B.png`, the new frame on a side chosen by a seeded hash of the pair's
// name, and the key (which side is new) goes to a file OUTSIDE the folder the critic is shown. `--gray` writes the
// frames in greyscale (ffmpeg-static), for the composition test (V3: tell the five openings apart without colour).
//   node scripts/playtest/blind-pairs.mjs --before <dir> --after <dir> --out <dir> --key <file.json> [--gray]
//        [--frames high/m0-z0900,low/m1-z1200,...]   (default: every file present in both, under every tier folder)
//        [--seed 7] [--max 10]
// Score a critic's picks (a JSON of { "01": "A", ... }) against the key:
//   node scripts/playtest/blind-pairs.mjs --score <picks.json> --key <file.json>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (k) => argv.includes(`--${k}`);

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

if (has('score')) {
  const picks = JSON.parse(fs.readFileSync(opt('score'), 'utf8'));
  const key = JSON.parse(fs.readFileSync(opt('key'), 'utf8'));
  let right = 0;
  let n = 0;
  for (const [id, k] of Object.entries(key.pairs)) {
    const p = String(picks[id] ?? '').trim().toUpperCase();
    if (!p) continue;
    n++;
    if (p === k.newSide) right++;
    else console.log(`pair ${id}: picked the old frame (${k.frame})`);
  }
  console.log(`${right} of ${n} pairs: the new frame picked`);
  process.exit(0);
}

const before = opt('before');
const after = opt('after');
const out = opt('out');
const keyFile = opt('key');
const seed = Number(opt('seed', '7'));
const max = Number(opt('max', '0'));
const gray = has('gray');
if (!before || !after || !out || !keyFile) {
  console.error('needs --before --after --out --key');
  process.exit(1);
}
if (path.resolve(keyFile).startsWith(path.resolve(out))) {
  console.error('the key must not be inside the folder the critic sees');
  process.exit(1);
}

let frames = (opt('frames', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!frames.length) {
  const tiers = fs.readdirSync(before).filter((d) => fs.statSync(path.join(before, d)).isDirectory());
  for (const t of tiers) {
    for (const f of fs.readdirSync(path.join(before, t))) {
      if (f.endsWith('.png') && fs.existsSync(path.join(after, t, f))) frames.push(`${t}/${f.replace(/\.png$/, '')}`);
    }
  }
}
frames = frames.filter((f) => fs.existsSync(path.join(before, `${f}.png`)) && fs.existsSync(path.join(after, `${f}.png`)));
if (max > 0 && frames.length > max) {
  frames = frames.map((f) => [hash(`${seed}:${f}`), f]).sort((a, b) => a[0] - b[0]).slice(0, max).map((x) => x[1]).sort();
}

let ffmpeg = null;
if (gray) {
  const require = createRequire(import.meta.url);
  ffmpeg = require('ffmpeg-static');
}
fs.mkdirSync(out, { recursive: true });
const key = { before, after, gray, pairs: {} };
frames.forEach((f, i) => {
  const id = String(i + 1).padStart(2, '0');
  const newSide = hash(`${seed}:${f}`) & 1 ? 'A' : 'B';
  const sides = newSide === 'A' ? { A: after, B: before } : { A: before, B: after };
  for (const s of ['A', 'B']) {
    const src = path.join(sides[s], `${f}.png`);
    const dst = path.join(out, `pair-${id}-${s}.png`);
    if (gray) execFileSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', src, '-vf', 'format=gray', dst]);
    else fs.copyFileSync(src, dst);
  }
  key.pairs[id] = { frame: f, newSide };
});
fs.mkdirSync(path.dirname(path.resolve(keyFile)), { recursive: true });
fs.writeFileSync(keyFile, JSON.stringify(key, null, 2));
console.log(`${frames.length} pairs in ${out} (key: ${keyFile})`);
