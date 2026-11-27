// Round 9, Gablefall's world: the rows' pieces round a stretch of the lab course, both sides (what the world stands where).
// `npx tsx scripts/r9/gablefall-world-rows.ts <z0> <z1>`
import { Course } from '../../src/sim/course';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { FRONT, rowsOf } from '../../src/sim/gablefall';

const c = new Course(GABLEFALL_LAB_SEED);
const z0 = Number(process.argv[2] ?? 500);
const z1 = Number(process.argv[3] ?? 700);
for (const r of rowsOf(c)) {
  for (const p of r.pieces) {
    if (p.z1 < z0 || p.z0 > z1) continue;
    const zm = (p.z0 + p.z1) / 2;
    const cx = c.centerX(zm);
    console.log(`${r.side > 0 ? 'R' : 'L'} ${p.kind.padEnd(5)} ${p.z0.toFixed(1)}-${p.z1.toFixed(1)} front ${(c.ground(cx + r.side * (FRONT + 0.05), zm) - c.baseY(zm)).toFixed(1)} chimneys ${p.chimneys.length}`);
  }
}
