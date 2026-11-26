// Round 9, Gullhaven's world: the drawn ground across a row (the world builder's probe, notes only).
//   npx tsx scripts/r9/gullhaven-world-row.ts <z> [z...]
import { courseFor } from '../../src/sim/course';
import { GULLHAVEN_LAB_SEED } from '../../src/sim/mountains';
import { groundOf } from '../../src/render/ground';

const c = courseFor(GULLHAVEN_LAB_SEED);
const g = groundOf(c);
for (const a of process.argv.slice(2)) {
  const z = Number(a);
  const cx = c.centerX(z);
  const hw = c.halfWidth(z);
  const row: string[] = [];
  for (const d of [-60, -30, -22, -18, -10, 0, 5, 10, 15, 18, 20, 21, 22, 23, 25, 30, 40, 60, 90, 120]) row.push(`${d}:${(g(cx + d, z) - c.ground(cx, z)).toFixed(1)}`);
  console.log(`z ${z} cx ${cx.toFixed(1)} hw ${hw.toFixed(1)} | ${row.join(' ')}`);
}
