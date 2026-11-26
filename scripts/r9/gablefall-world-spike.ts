// Round 9, Gablefall's world: the drawn ground's highest point over the course's level, across the terrain's columns and
// rows down the whole run (a spike in it stands in the frame as a pillar from kilometres off).
// `npx tsx scripts/r9/gablefall-world-spike.ts`
import { Course } from '../../src/sim/course';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { townGround } from '../../src/render/gablefallplan';
import { lateralOffsets } from '../../src/render/terrain';

const c = new Course(GABLEFALL_LAB_SEED);
const offs = lateralOffsets(c, { inner: 0.85, row: 2, reach: 110 });
let worst = { d: -1e9, z: 0, off: 0, sim: 0 };
let worstSim = { d: -1e9, z: 0, off: 0 };
for (let z = -40; z < c.finishZ + 600; z += 0.5) {
  const cx = c.centerX(z);
  const b = c.baseY(z);
  for (const off of offs) {
    const d = townGround(c, cx + off, z) - b;
    const s = c.ground(cx + off, z) - b;
    if (d > worst.d) worst = { d, z, off, sim: s };
    if (s > worstSim.d) worstSim = { d: s, z, off };
  }
}
console.log('drawn', worst, 'sim', worstSim, 'finish', c.finishZ, 'runout', c.runOut);
// The pieces whose eave was never set (a row that ends on an alley or a drift keeps e0 at 0).
import { rowsOf } from '../../src/sim/gablefall';
for (const r of rowsOf(c)) {
  const last = r.pieces[r.pieces.length - 1];
  for (const p of r.pieces) if (p.e0 === 0) console.log('unset eave:', r.side > 0 ? 'R' : 'L', p.kind, p.z0, p.z1, 'row', r.z0, r.z1, 'last', last === p);
}
