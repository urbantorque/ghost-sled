// Reads perf-r6.sh's files and prints each probe per build: fps (median of passes), min fps, p90, draw calls, triangles.
//   node scripts/playtest/perf-digest.mjs shots/r6/perf
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
const rows = {};
for (const f of readdirSync(dir).filter((x) => x.endsWith('.txt') && x !== 'firstframe.txt')) {
  const build = /-a\.txt$/.test(f) ? 'A' : 'B';
  const t = readFileSync(join(dir, f), 'utf8');
  const i = t.indexOf('### Result');
  if (i < 0) { console.log('no result in', f); continue; }
  const line = t.slice(i).split('\n').find((l) => l.startsWith('"') || l.startsWith('{') || l.startsWith('['));
  let o = JSON.parse(line);
  if (typeof o === 'string') o = JSON.parse(o);
  const list = Array.isArray(o) ? o : o.out ?? o.probes ?? [];
  for (const p of list) ((rows[p.name] ??= { A: [], B: [] })[build]).push(p);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
for (const [name, r] of Object.entries(rows)) {
  const fmt = (L) => L.length ? `${L.map((p) => p.fpsMed).join(',')} med ${med(L.map((p) => p.fpsMed))} min ${Math.min(...L.map((p) => p.fpsMin))} p90 ${med(L.map((p) => p.p90Med))} calls ${med(L.map((p) => p.calls))}/${Math.max(...L.map((p) => p.callsPeak))} tris ${Math.round(med(L.map((p) => p.tris)) / 1000)}k/${Math.round(Math.max(...L.map((p) => p.trisPeak)) / 1000)}k` : '-';
  console.log(name.padEnd(18), 'A', fmt(r.A));
  console.log(''.padEnd(18), 'B', fmt(r.B));
}
