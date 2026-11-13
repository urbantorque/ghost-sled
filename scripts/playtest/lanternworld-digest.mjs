// Reads one of frames.js's reports and prints its cost: mean and worst draw calls and triangles, each
// frame's own, and the console's errors.
//   node scripts/playtest/lanternworld-digest.mjs shots/r7/lanternworld/final/high-m4.json
import fs from 'fs';

const t = fs.readFileSync(process.argv[2], 'utf8');
let j;
try {
  j = JSON.parse(JSON.parse(t));
} catch {
  try {
    j = JSON.parse(t);
  } catch {
    console.log('unreadable report', t.slice(0, 300));
    process.exit(0);
  }
}
const r = j.report || [];
const avg = (k) => Math.round(r.reduce((a, b) => a + b[k], 0) / Math.max(1, r.length));
console.log('frames', r.length, 'mean calls', avg('calls'), 'mean tris', avg('tris'), 'max calls', Math.max(...r.map((x) => x.calls)), 'max tris', Math.max(...r.map((x) => x.tris)));
console.log(r.map((x) => x.name.replace(/m\d-z/, '').replace('.png', '') + ':' + x.calls + '/' + Math.round(x.tris / 1000) + 'k').join(' '));
console.log('errors', JSON.stringify(j.errors).slice(0, 800));
