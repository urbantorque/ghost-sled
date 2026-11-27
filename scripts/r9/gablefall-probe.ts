// Round 9, Gablefall's lab course read off (notes/r9-gablefall.md): its sections, its rows (pieces, eaves, steps), its
// drifts, its chimneys, and a cross-section and a profile where asked. Read-only, light: no heavy slot.
// `npx tsx scripts/r9/gablefall-probe.ts [--rows] [--x <adx>]`

import { Course } from '../../src/sim/course';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { BACK, FRONT, RIDGE, driftsOf, rowsOf } from '../../src/sim/gablefall';

const c = new Course(GABLEFALL_LAB_SEED);
const f1 = (v: number): string => v.toFixed(1);
const secs: string[] = [];
for (let z = 0; z < c.finishZ + 240; ) {
  const s = c.section(z);
  secs.push(`${s.kind}${s.gate ? '*' : ''} ${f1(s.z0)}-${f1(s.z1)}`);
  z = s.z1 + 0.01;
}
console.log('sections:', secs.join(', '));
console.log('stages:', c.stages.map((s) => `${s.name} ${s.z0}-${s.z1}`).join(', '), 'finish', c.finishZ);
const rows = rowsOf(c);
for (const r of rows) {
  const n = (k: string): number => r.pieces.filter((p) => p.kind === k).length;
  console.log(`row ${r.side > 0 ? 'R' : 'L'} ${r.z0}-${r.z1}: houses ${n('house')}, alleys ${n('alley')}, drifts ${n('drift')}, chimneys ${r.pieces.reduce((a, p) => a + p.chimneys.length, 0)}`);
}
console.log('drifts:', driftsOf(c).map((d) => `${d.side > 0 ? 'R' : 'L'}${d.z0}`).join(' '));
if (process.argv.includes('--rows')) {
  const r = rows[1];
  for (const p of r.pieces.slice(0, 30)) {
    const s0 = c.baseY(p.z0);
    const cx = c.centerX(p.z0);
    const g = (adx: number, z: number): string => f1(c.ground(cx + r.side * adx, z) - c.baseY(z));
    console.log(`  ${p.kind.padEnd(5)} ${f1(p.z0)}-${f1(p.z1)} e0-street ${f1(p.e0 - s0)}  over street at x=${RIDGE}: z0+0.6 ${g(RIDGE, p.z0 + 0.6)} mid ${g(RIDGE, (p.z0 + p.z1) / 2)} end-0.1 ${g(RIDGE, p.z1 - 0.1)}; front ${g(FRONT + 0.1, (p.z0 + p.z1) / 2)} back ${g(BACK, (p.z0 + p.z1) / 2)}`);
  }
}
let count = 0;
for (let k = 0; k * 64 < c.finishZ + 240; k++) count += c.chunk(k).obstacles.filter((o) => o.kind === 'chimney').length;
console.log('chimneys placed:', count, `(${f1(count / (c.finishZ / 1000))} a km)`);
