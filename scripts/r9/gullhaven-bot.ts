// Round 9, Gullhaven's lane: one bot's run, a line at each gully: its speed and line 60 m out, at the lip, its takeoffs
// and landings there (notes only). `npx tsx scripts/r9/gullhaven-bot.ts <skill> [seed] [style]`
import { Bot } from '../../src/bot/bot';
import { PLAIN } from '../../src/sim/chaos';
import { GULLHAVEN_LAB_SEED } from '../../src/sim/mountains';
import { gulliesOf } from '../../src/sim/gullhaven';
import { Sim } from '../../src/sim/sim';

const skill = Number(process.argv[2] ?? 0.9);
const seed = Number(process.argv[3] ?? 1234);
const style = process.argv[4] as 'racer' | undefined;
const sim = new Sim({ seed: GULLHAVEN_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim.course;
const gs = gulliesOf(c);
const bot = new Bot(sim, { skill, seed, sled: 0, name: 'Lab', style });
const seen = new Set<string>();
while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
  const s = sim.s;
  const pz = s.z;
  sim.step(bot.input());
  bot.observe();
  for (const g of gs) {
    for (const [k, at] of [['90', g.zL - 90], ['60', g.zL - 60], ['30', g.zL - 30], ['lip', g.zL]] as const) {
      if (pz < at && s.z >= at && !seen.has(`${g.index}${k}`)) {
        seen.add(`${g.index}${k}`);
        console.log(`g${g.index} ${k.padEnd(3)} v ${s.speed.toFixed(1)} x-bx ${(s.x - g.bx).toFixed(1)} x-cx ${(s.x - c.centerX(s.z)).toFixed(1)} ${s.grounded ? 'G' : 'A'} act ${s.action} drift ${s.drifting}`);
      }
    }
  }
  for (const e of sim.events) {
    if (e.type === 'takeoff' && gs.some((g) => Math.abs(g.zL - s.z) < 40)) console.log(`   takeoff ${e.kind} at ${s.z.toFixed(0)} x-cx ${(s.x - c.centerX(s.z)).toFixed(1)}`);
    if (e.type === 'land' && e.airtime > 0.5) console.log(`   land ${e.quality} ${e.airtime.toFixed(1)} s at ${s.z.toFixed(0)} x-cx ${(s.x - c.centerX(s.z)).toFixed(1)}`);
  }
}
console.log(`finished ${sim.finished} ${(sim.tick / 60).toFixed(1)} s`);
