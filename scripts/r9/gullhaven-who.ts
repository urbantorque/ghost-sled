// Round 9, Gullhaven's lane: one lab pilot's run, a line at each gully: where it was 60 m out, at the lip and what flew
// (notes only). `npx tsx scripts/r9/gullhaven-who.ts <novice|mid|expert> [seed]`
import { PLAIN } from '../../src/sim/chaos';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { GULLHAVEN_LAB_SEED } from '../../src/sim/mountains';
import { gulliesOf } from '../../src/sim/gullhaven';
import { Sim } from '../../src/sim/sim';
import { classic } from '../playtest/labpilots';

const who = (process.argv[2] ?? 'expert') as 'mid';
const seed = Number(process.argv[3] ?? 1234);
const sim = new Sim({ seed: GULLHAVEN_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim.course;
const gs = gulliesOf(c);
const p = classic(who, sim, seed, { gateX, pathX, machineZ });
const seen = new Set<string>();
const Z0 = Number(process.argv[4] ?? -1);
const Z1 = Number(process.argv[5] ?? -1);
while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
  const o = p();
  const s = sim.s;
  const pz = s.z;
  sim.step((o.steer | 0) | (o.action ? 16 : 0));
  if (s.z >= Z0 && s.z < Z1 && sim.tick % 6 === 0) console.log(`  z ${s.z.toFixed(1)} x-cx ${(s.x - c.centerX(s.z)).toFixed(1)} line-cx ${(c.lineFor(s.z, { x: s.x, y: s.y, z: s.z, v: s.speed, skill: 0.9, nerve: 0.7 }) - c.centerX(s.z)).toFixed(1)} v ${s.speed.toFixed(1)} ${s.grounded ? 'G' : 'A'} steer ${o.steer} act ${o.action} head ${s.heading.toFixed(2)} drift ${s.drifting}`);
  for (const g of gs) {
    for (const [k, at] of [['60', g.zL - 60], ['lip', g.zL]] as const) {
      if (pz < at && s.z >= at && !seen.has(`${g.index}${k}`)) {
        seen.add(`${g.index}${k}`);
        console.log(`g${g.index} ${k.padEnd(3)} z ${s.z.toFixed(0)} v ${s.speed.toFixed(1)} x-bx ${(s.x - g.bx).toFixed(1)} x-cx ${(s.x - c.centerX(s.z)).toFixed(1)} ${s.grounded ? 'G' : 'A'} act ${o.action} steer ${o.steer}`);
      }
    }
  }
  for (const e of sim.events) if (e.type === 'land' && e.airtime > 1) console.log(`   land ${e.quality} ${e.airtime.toFixed(1)} s at ${s.z.toFixed(0)} x-cx ${(s.x - c.centerX(s.z)).toFixed(1)}`);
}
