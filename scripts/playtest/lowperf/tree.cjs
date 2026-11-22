// Reads scripts/playtest/lowperf/prof.js output offline.
//   node scripts/playtest/lowperf/tree.cjs <file> flat [n]                 inclusive and self ms a frame by function (no bundle line)
//   node scripts/playtest/lowperf/tree.cjs <file> under <regex> [depth] [minMs]   the merged tree under every node whose label matches
//   node scripts/playtest/lowperf/tree.cjs <a> diff <b> [n]               inclusive by function, b minus a
const fs = require('fs');
const load = (f) => {
  let j = JSON.parse(fs.readFileSync(f, 'utf8').trim());
  if (typeof j === 'string') j = JSON.parse(j);
  return j;
};
const strip = (l) => l.replace(/ index-[^ ]*\.js:(\d+)$/, ' :$1');
const name = (l) => l.replace(/ [^ ]*:\d+$/, '');
function flat(j, byName) {
  const kids = new Map();
  j.tree.forEach((n, i) => {
    if (!kids.has(n[0])) kids.set(n[0], []);
    kids.get(n[0]).push(i);
  });
  const incl = new Map();
  const self = new Map();
  // Inclusive once per stack: walk with the set of labels above.
  const walk = (i, above) => {
    const n = j.tree[i];
    const k = byName ? name(n[1]) : strip(n[1]);
    self.set(k, (self.get(k) ?? 0) + n[2]);
    const fresh = !above.has(k);
    if (fresh) {
      incl.set(k, (incl.get(k) ?? 0) + n[3]);
      above.add(k);
    }
    for (const c of kids.get(i) ?? []) walk(c, above);
    if (fresh) above.delete(k);
  };
  for (const r of kids.get(-1) ?? []) walk(r, new Set());
  return { incl, self, f: j.frames };
}
const [file, mode, a3, a4, a5] = process.argv.slice(2);
const j = load(file);
// R=1: in rulers (workcal's arithmetic timed in the same run), so runs on a swinging machine compare.
const unit = (jj) => (process.env.R && jj.calMs ? jj.calMs : 1);
const ms = (us, f, jj = j) => us / 1000 / f / unit(jj);
if (mode === 'flat') {
  const { incl, self, f } = flat(j, false);
  console.log(`frames ${j.frames} fps ${j.fps} z ${j.z}`);
  const n = +(a3 ?? 60);
  console.log('-- inclusive');
  for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(ms(v, f).toFixed(3), k);
  console.log('-- self');
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(ms(v, f).toFixed(3), k);
  console.log('-- counts a frame');
  console.log(JSON.stringify(j.counts));
} else if (mode === 'under') {
  const re = new RegExp(a3);
  const depth = +(a4 ?? 3);
  const min = +(a5 ?? 0.02);
  const kids = new Map();
  j.tree.forEach((n, i) => {
    if (!kids.has(n[0])) kids.set(n[0], []);
    kids.get(n[0]).push(i);
  });
  // Merge every matching node's subtree by label path.
  const acc = new Map();
  const add = (i, path, d) => {
    const n = j.tree[i];
    const k = path + ' > ' + strip(n[1]);
    const a = acc.get(k) ?? { t: 0, s: 0, d };
    a.t += n[3];
    a.s += n[2];
    acc.set(k, a);
    if (d < depth) for (const c of kids.get(i) ?? []) add(c, k, d + 1);
  };
  const find = (i, inside) => {
    const n = j.tree[i];
    const hit = !inside && i >= 0 && re.test(strip(n[1]));
    if (hit) add(i, '', 0);
    for (const c of kids.get(i) ?? []) find(c, inside || hit);
  };
  find(-1, false);
  const rows = [...acc].filter(([, a]) => ms(a.t, j.frames) >= min);
  // Print as a tree, children sorted by time.
  const ch = new Map();
  for (const [k] of rows) {
    const p = k.slice(0, k.lastIndexOf(' > '));
    if (!ch.has(p)) ch.set(p, []);
    ch.get(p).push(k);
  }
  const pr = (p, ind) => {
    for (const k of (ch.get(p) ?? []).sort((x, y) => acc.get(y).t - acc.get(x).t)) {
      const a = acc.get(k);
      console.log(`${'  '.repeat(ind)}${ms(a.t, j.frames).toFixed(3)} (self ${ms(a.s, j.frames).toFixed(3)}) ${k.slice(k.lastIndexOf(' > ') + 3)}`);
      pr(k, ind + 1);
    }
  };
  pr('', 0);
} else if (mode === 'diff') {
  const b = load(a3);
  const A = flat(j, true);
  const B = flat(b, true);
  const n = +(a4 ?? 50);
  console.log(`a: frames ${j.frames} fps ${j.fps}; b: frames ${b.frames} fps ${b.fps}`);
  const names = new Set([...A.incl.keys(), ...B.incl.keys()]);
  const rows = [...names].map((k) => [k, ms(A.incl.get(k) ?? 0, A.f, j), ms(B.incl.get(k) ?? 0, B.f, b)]).sort((x, y) => y[2] - y[1] - (x[2] - x[1]));
  for (const r of rows.slice(0, n)) console.log(`${(r[2] - r[1]).toFixed(3)}  ${r[1].toFixed(3)} -> ${r[2].toFixed(3)}  ${r[0]}`);
}
