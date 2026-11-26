// Round 9, Gablefall: one pilot's ride logged where it leaves the roofs (notes/r9-gablefall.md, the lab's probe): each
// drop into the street with where the sled was across the row, its speed, its last takeoff and landing, and the piece
// under it. Light: one ride. `npx tsx scripts/r9/gablefall-who.ts [mid|expert|novice] [seed]`
import { PLAIN } from '../../src/sim/chaos';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { FRONT, UP, rowAt } from '../../src/sim/gablefall';
import { Sim } from '../../src/sim/sim';
import { classic } from '../playtest/labpilots';

const who = (process.argv[2] ?? 'expert') as 'mid' | 'expert' | 'novice';
const seed = Number(process.argv[3] ?? 1234);
const sim = new Sim({ seed: GABLEFALL_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim.course;
const pilot = classic(who, sim, seed, { gateX, pathX, machineZ });
const f1 = (v: number): string => v.toFixed(1);
let wasUp = false;
let lastOff = '';
let lastLand = '';
const trail: string[] = [];
while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
  const o = pilot();
  sim.step((o.steer | 0) | (o.action ? 16 : 0));
  pilot.after?.();
  const s = sim.s;
  const cx = c.centerX(s.z);
  const dx = s.x - cx;
  trail.push(`${f1(s.z)}:${f1(dx)}/${f1(s.y - c.baseY(s.z))}${s.grounded ? 'g' : 'a'}${o.action ? '*' : ''}`);
  if (trail.length > 24) trail.shift();
  for (const e of sim.events) {
    if (e.type === 'takeoff') lastOff = `off ${e.kind} z ${f1(s.z)} dx ${f1(dx)} vy ${f1(e.vy)} v ${f1(s.speed)}`;
    if (e.type === 'land' && !e.late) lastLand = `land ${e.quality} ${f1(e.airtime)}s z ${f1(s.z)} dx ${f1(dx)}`;
    if (e.type === 'scrape') console.log(`  scrape z ${f1(s.z)} dx ${f1(dx)} y ${f1(s.y - c.baseY(s.z))}`);
    if (e.type === 'tumble' && e.phase === 'start') console.log(`FALL ${e.cause} z ${f1(s.z)} dx ${f1(dx)}; ${lastOff}; ${lastLand}`);
  }
  const row = rowAt(c, dx < 0 ? -1 : 1, s.z);
  if (!row || !s.grounded || s.tumble) continue;
  const up = s.y - c.baseY(s.z) >= UP;
  if (wasUp && !up) {
    console.log(`DROP z ${f1(s.z)} dx ${f1(dx)} v ${f1(s.speed)}; ${lastOff}; ${lastLand}`);
    console.log('   ' + trail.join(' '));
  }
  if (!wasUp && up) console.log(`climb z ${f1(s.z)} dx ${f1(dx)} v ${f1(s.speed)}`);
  wasUp = up;
}
console.log(`finished ${sim.finished} ${f1(sim.tick / 60)} s; front ${FRONT}`);
