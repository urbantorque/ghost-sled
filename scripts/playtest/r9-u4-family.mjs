// Round 9, the u4 lane: the family test's frames. Copies the frames named (paths under a root) into one folder as
// f01.png, f02.png ... in an order shuffled by a seed, and writes which frame is which to a key OUTSIDE that folder,
// so a critic sees only the screens and ART.md.
//   node scripts/playtest/r9-u4-family.mjs --root C:/.../shots/r9/u4 --out C:/.../shots/r9/u4/family1 --key C:/.../shots/r9/u4/keys/family1.json --seed 5 after/desk-mid-50-almanac.png look4/desk-title.png ...
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv.splice(i, 2)[1] : undefined;
};
const root = opt('root');
const out = opt('out');
const keyFile = opt('key');
const seed = Number(opt('seed') ?? '5');
if (!root || !out || !keyFile) throw new Error('needs --root --out --key');
if (path.resolve(keyFile).startsWith(path.resolve(out))) throw new Error('the key must not be inside the folder the critic sees');
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const frames = argv.filter((f) => fs.existsSync(path.join(root, f)));
const order = frames.map((f) => [hash(`${seed}:${f}`), f]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
fs.mkdirSync(out, { recursive: true });
const key = {};
order.forEach((f, i) => {
  const id = `f${String(i + 1).padStart(2, '0')}`;
  fs.copyFileSync(path.join(root, f), path.join(out, `${id}.png`));
  key[id] = f;
});
fs.mkdirSync(path.dirname(path.resolve(keyFile)), { recursive: true });
fs.writeFileSync(keyFile, JSON.stringify(key, null, 2));
console.log(`${order.length} frames in ${out} (key: ${keyFile}); missing: ${argv.filter((f) => !frames.includes(f)).join(', ') || 'none'}`);
