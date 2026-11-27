// Round 9, the look lane: one critic pass's blind pairs for one mountain, last pass's set against this one's, through
// blind-pairs.mjs (the new frame on a seeded side, the key outside the folder the critic sees), with ART.md copied in
// beside them so the critic is given that and nothing else. The folder is named for nothing (crit-k<n>).
//   node scripts/r9/look-pairs.mjs --mtn oldrun --before p0 --after p1 --n 1 [--seed 7]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const mtn = opt('mtn');
const before = opt('before');
const after = opt('after');
const n = opt('n');
const seed = opt('seed', '7');
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const shots = 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/';
const sets = `${shots}look/sets/`;
const out = `${shots}crit-k${n}/`;
const key = `${shots}look/keys/k${n}-${mtn}-${before}-${after}.json`;
fs.rmSync(out, { recursive: true, force: true });
const frames = fs
  .readdirSync(`${sets}${after}/${mtn}`)
  .filter((f) => f.endsWith('.png') && fs.existsSync(`${sets}${before}/${mtn}/${f}`))
  .map((f) => `${mtn}/${f.replace(/\.png$/, '')}`);
execFileSync(process.execPath, [path.join(repo, 'scripts/playtest/blind-pairs.mjs'), '--before', `${sets}${before}`, '--after', `${sets}${after}`, '--out', out, '--key', key, '--frames', frames.join(','), '--seed', seed], { stdio: 'inherit' });
fs.copyFileSync(path.join(repo, 'ART.md'), `${out}ART.md`);
console.log(`${frames.length} pairs for ${mtn}, ${before} against ${after}: ${out} (key ${key})`);
