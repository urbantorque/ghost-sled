// Two lab.ts outputs side by side, per pilot: median finish by mountain, finishes, lanterns lit, dashes, wards.
//   node scripts/playtest/lab-digest.mjs <before.txt> <after.txt>
import { readFileSync } from 'node:fs';
const rows = (f) => {
  const out = {};
  for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const c = l.trim().split(/\s+/);
    if (c.length < 17 || !/^(hands-off|hold2s-r|hold2s-l|hold-r|zigzag|clumsy|novice|mid|expert|line|stunt)$/.test(c[0])) continue;
    const fin = Number((/FINISH:(\d+)/.exec(l) || [0, 0])[1]);
    (out[c[0]] ??= []).push({ m: c[1], runs: +c[2], secs: +c[3], lanterns: +c[13], dashes: +c[14], wards: +c[15], fin });
  }
  return out;
};
const [a, b] = [rows(process.argv[2]), rows(process.argv[3])];
console.log('pilot      time before (P/F/E/S)      time after                 fin b/a   lanterns b/a  dashes b/a  wards b/a');
for (const p of Object.keys(a)) {
  const A = a[p], B = b[p] || [];
  const t = (L) => L.map((r) => (r.fin ? r.secs.toFixed(0) : 'dnf')).join('/');
  const s = (L, k) => L.reduce((x, r) => x + r[k], 0);
  const m = (L, k) => (L.reduce((x, r) => x + r[k], 0) / Math.max(1, L.length)).toFixed(1);
  console.log(p.padEnd(10), t(A).padEnd(26), t(B).padEnd(26), `${s(A, 'fin')}/${s(A, 'runs')} ${s(B, 'fin')}/${s(B, 'runs')}`.padEnd(9), `${m(A, 'lanterns')}/${m(B, 'lanterns')}`.padEnd(13), `${m(A, 'dashes')}/${m(B, 'dashes')}`.padEnd(11), `${m(A, 'wards')}/${m(B, 'wards')}`);
}
