// Round 9, Gablefall: one lab pilot's ride, stopped where a sled on the ground rises more than half a metre in a tick
// (a lift from below), with the ticks before it. Light. `npx tsx scripts/r9/gablefall-lift.ts [mid|expert] [seed]`
import { PLAIN } from '../../src/sim/chaos';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';
import { classic } from '../playtest/labpilots';

const who = (process.argv[2] ?? 'mid') as 'mid' | 'expert';
const seed = Number(process.argv[3] ?? 1271);
const sim = new Sim({ seed: GABLEFALL_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim.course;
const pilot = classic(who, sim, seed, { gateX, pathX, machineZ });
const log: string[] = [];
while (!sim.finished && sim.tick < 60 * 400) {
  const s = sim.s;
  const y0 = s.y;
  const g0 = s.grounded;
  const o = pilot();
  sim.step((o.steer | 0) | (o.action ? 16 : 0));
  pilot.after?.();
  const cx = c.centerX(s.z);
  log.push(`t ${sim.tick} z ${s.z.toFixed(2)} x ${(s.x - cx).toFixed(3)} y-S ${(s.y - c.baseY(s.z)).toFixed(2)} ${s.grounded ? 'G' : 'a'} tumble ${s.tumble} v ${s.speed.toFixed(1)} vx ${s.vx.toFixed(2)} ev ${sim.events.map((e) => e.type).join(',')}`);
  if (log.length > 12) log.shift();
  if (g0 && s.grounded && s.y - y0 > 0.5) {
    console.log(log.join('\n'));
    break;
  }
}
