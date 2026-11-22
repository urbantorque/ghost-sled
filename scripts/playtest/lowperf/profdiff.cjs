// Diffs CPU profiles (profile.js output) of two builds, by function name without its bundle line, per frame.
const fs = require('fs');
const [aFiles, bFiles] = [process.argv[2].split(','), process.argv[3].split(',')];
function load(f) {
  let j = JSON.parse(fs.readFileSync(f, 'utf8').trim());
  if (typeof j === 'string') j = JSON.parse(j);
  return j;
}
function per(files, key) {
  const m = new Map();
  let frames = 0;
  for (const f of files) {
    const j = load(f);
    frames += j.frames;
    for (const row of j[key]) {
      const mm = row.match(/^([\d.]+) ms [\d.]+% (.*)$/);
      if (!mm) continue;
      const name = mm[2].replace(/ index-[^ ]*\.js:\d+$/, '').replace(/ :0$/, '');
      m.set(name, (m.get(name) ?? 0) + +mm[1]);
    }
  }
  for (const [k, v] of m) m.set(k, v / frames);
  return { m, frames };
}
for (const key of ['self', 'total']) {
  const A = per(aFiles, key), B = per(bFiles, key);
  const names = new Set([...A.m.keys(), ...B.m.keys()]);
  const rows = [...names].map((n) => [n, A.m.get(n) ?? 0, B.m.get(n) ?? 0]).map(([n, a, b]) => [n, a, b, b - a]);
  rows.sort((x, y) => y[3] - x[3]);
  console.log(`== ${key} (ms a frame; frames ${A.frames} / ${B.frames})`);
  for (const r of rows.slice(0, 30)) console.log(`${r[3] >= 0 ? '+' : ''}${r[3].toFixed(3)}  ${r[1].toFixed(3)} -> ${r[2].toFixed(3)}  ${r[0]}`);
}
