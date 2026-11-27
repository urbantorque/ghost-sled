// Round 9, Gablefall: one lab pilot's ride traced over a stretch (z, across, over the ground and the street, on the
// ground or not, speed, the pilot's steer and button, its line there, events). Light.
// `npx tsx scripts/r9/gablefall-ride.ts [mid|expert|novice] [seed] [z0] [z1] [every]`
import { PLAIN } from '../../src/sim/chaos';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';
import { classic } from '../playtest/labpilots';

const who = (process.argv[2] ?? 'mid') as 'mid' | 'expert' | 'novice';
const seed = Number(process.argv[3] ?? 1271);
const z0 = Number(process.argv[4] ?? 0);
const z1 = Number(process.argv[5] ?? 300);
const every = Number(process.argv[6] ?? 3);
const sim = new Sim({ seed: GABLEFALL_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim.course;
const pilot = classic(who, sim, seed, { gateX, pathX, machineZ });
const rider = { x: 0, y: 0, z: 0, v: 0, skill: who === 'expert' ? 0.9 : who === 'mid' ? 0.55 : 0.25, nerve: who === 'expert' ? 0.7 : 0.3 };
const f2 = (v: number): string => v.toFixed(2);
while (!sim.finished && sim.s.z < z1 && sim.tick < 60 * 400) {
  const s = sim.s;
  const o = pilot();
  sim.step((o.steer | 0) | (o.action ? 16 : 0));
  pilot.after?.();
  if (s.z < z0 || sim.tick % every) continue;
  Object.assign(rider, { x: s.x, y: s.y, z: s.z, v: s.speed });
  const cx = c.centerX(s.z);
  const ev = sim.events.map((e) => (e.type === 'land' ? `land ${e.quality} ${f2(e.airtime)}` : e.type === 'takeoff' ? `off ${e.kind}` : e.type)).join(' ');
  console.log(`${f2(s.z)} x ${f2(s.x - cx)} line ${f2(c.lineFor(s.z + 10, rider) - c.centerX(s.z + 10))} y-g ${f2(s.y - c.ground(s.x, s.z))} y-S ${f2(s.y - c.baseY(s.z))} ${s.grounded ? 'G' : 'a'} v ${f2(s.speed)} hd ${f2(s.heading)} st ${o.steer} ${o.action ? '*' : ' '} ${ev}`);
}
