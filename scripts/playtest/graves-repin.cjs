// Rewrites the graveyards test pinned places from the bundled pools, after a pool regen: node scripts/playtest/graves-repin.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const out = execSync('npx tsx scripts/playtest/graves-pins.ts', { encoding: 'utf8' });
const pins = {};
for (const line of out.trim().split(/\r?\n/)) pins[line.slice(0, line.indexOf(' '))] = JSON.parse(line.slice(line.indexOf(' ') + 1));
const f = 'tests/graveyards.test.ts';
let s = fs.readFileSync(f, 'utf8');
const crlf = s.includes('\r\n');
s = s.split('\r\n').join('\n');
for (const k of Object.keys(pins)) {
  const head = 'expect(at(' + k + ')).toEqual([';
  const a = s.indexOf(head);
  if (a < 0) throw new Error('no pin block for ' + k);
  const b = s.indexOf('\n    ]);', a);
  s = s.slice(0, a + head.length) + '\n' + pins[k].map(([z, n]) => '      [' + z + ', ' + n + '],').join('\n') + s.slice(b);
}
const total = Object.values(pins).reduce((x, l) => x + l.length, 0);
const nh = 'expect(names.length).toBe(';
const i = s.indexOf(nh);
s = s.slice(0, i + nh.length) + total + s.slice(s.indexOf(');', i));
if (crlf) s = s.split('\n').join('\r\n');
fs.writeFileSync(f, s);
console.log('pinned total', total);
