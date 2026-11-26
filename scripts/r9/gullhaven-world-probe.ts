// Round 9, Gullhaven's world: where its gullies, places and edges are on a course (the world builder's probe, notes only).
//   npx tsx scripts/r9/gullhaven-world-probe.ts [seed hex]
import { PLAIN } from '../../src/sim/chaos';
import { GULLHAVEN_LAB_SEED } from '../../src/sim/mountains';
import { cliffEdgeX, gulliesOf, gullySpan, placesOf, rimY } from '../../src/sim/gullhaven';
import { Sim } from '../../src/sim/sim';

const seed = process.argv[2] ? parseInt(process.argv[2], 16) >>> 0 : GULLHAVEN_LAB_SEED;
const sim = new Sim({ seed, chaos: PLAIN, sled: 0 });
const c = sim.course;
console.log(`finishZ ${c.finishZ.toFixed(0)}`);
for (const g of gulliesOf(c)) {
  const sp = gullySpan(g);
  console.log(`gully ${g.index}${g.great ? ' GREAT' : ''} zL ${g.zL.toFixed(1)} bx ${g.bx.toFixed(1)} z0 ${g.z0} z1 ${g.z1} span ${sp.z0.toFixed(0)}..${sp.z1.toFixed(0)} cliff ${g.cliff} drop ${g.drop} mouth ${g.mouth} column ${g.column} cx@zL ${c.centerX(g.zL).toFixed(1)} edge@zL ${cliffEdgeX(c, g.zL).toFixed(1)} rim@zL ${rimY(c, g, g.zL).toFixed(1)} path@zL ${c.ground(c.centerX(g.zL), g.zL).toFixed(1)}`);
}
console.log(JSON.stringify({ ...placesOf(c), great: placesOf(c).great.zL }));
for (let z = 0; z <= c.finishZ + 200; z += 100) {
  const cx = c.centerX(z);
  const hw = c.halfWidth(z);
  const row = [-60, -30, -hw, 0, hw, hw + 2, hw + 10, hw + 40].map((d) => c.ground(cx + d, z).toFixed(0)).join(' ');
  console.log(`z ${z} cx ${cx.toFixed(1)} hw ${hw.toFixed(1)} y ${c.ground(cx, z).toFixed(1)} sec ${c.section(z).kind} | ${row}`);
}
