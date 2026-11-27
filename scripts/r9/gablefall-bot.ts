// Round 9, Gablefall: one bot's ride logged where it leaves the roofs or climbs back (with its last takeoff and landing,
// where it was across the street and what its line was), and its time. Light.
// `npx tsx scripts/r9/gablefall-bot.ts [skill] [seed] [racer]`
import { Bot } from '../../src/bot/bot';
import { PLAIN } from '../../src/sim/chaos';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { UP, rowAt } from '../../src/sim/gablefall';
import { Sim } from '../../src/sim/sim';

const skill = Number(process.argv[2] ?? 0.9);
const seed = Number(process.argv[3] ?? 1308);
const style = process.argv[4] === 'racer' ? 'racer' : undefined;
const sim = new Sim({ seed: GABLEFALL_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim.course;
const bot = new Bot(sim, { skill, seed, sled: 0, name: 'Lab', style });
const f1 = (v: number): string => v.toFixed(1);
let wasUp = false;
let lastOff = '';
let lastLand = '';
while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
  sim.step(bot.input());
  bot.observe();
  const s = sim.s;
  const dx = s.x - c.centerX(s.z);
  for (const e of sim.events) {
    if (e.type === 'takeoff') lastOff = `off ${e.kind} z ${f1(s.z)} dx ${f1(dx)} vy ${f1(e.vy)} v ${f1(s.speed)}`;
    if (e.type === 'land' && !e.late) lastLand = `land ${e.quality} ${f1(e.airtime)}s z ${f1(s.z)} dx ${f1(dx)}`;
    if (e.type === 'tumble' && e.phase === 'start') console.log(`FALL ${e.cause} z ${f1(s.z)} dx ${f1(dx)}; ${lastOff}; ${lastLand}`);
    if (e.type === 'dash' && e.phase === 'start') console.log(`dash z ${f1(s.z)} dx ${f1(dx)}`);
  }
  const row = rowAt(c, dx < 0 ? -1 : 1, s.z);
  if (!row || !s.grounded || s.tumble) continue;
  const up = c.ground(s.x, s.z) - c.baseY(s.z) >= UP - 0.5;
  if (wasUp && !up) console.log(`DROP z ${f1(s.z)} dx ${f1(dx)} v ${f1(s.speed)}; ${lastOff}; ${lastLand}`);
  if (!wasUp && up) console.log(`climb z ${f1(s.z)} dx ${f1(dx)} v ${f1(s.speed)}`);
  wasUp = up;
}
console.log(`finished ${sim.finished} ${f1(sim.tick / 60)} s`);
