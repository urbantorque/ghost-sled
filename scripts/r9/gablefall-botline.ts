// Round 9, Gablefall: a bot's ride traced over a stretch: where it is across the street, its kit line ahead (as its last
// thought asked it), on the ground or not, its speed and its input. Light.
// `npx tsx scripts/r9/gablefall-botline.ts [skill] [seed] [z0] [z1] [every]`
import { Bot } from '../../src/bot/bot';
import { PLAIN } from '../../src/sim/chaos';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';

const skill = Number(process.argv[2] ?? 0.9);
const seed = Number(process.argv[3] ?? 1308);
const z0 = Number(process.argv[4] ?? 100);
const z1 = Number(process.argv[5] ?? 260);
const every = Number(process.argv[6] ?? 6);
const sim = new Sim({ seed: GABLEFALL_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim.course;
const bot = new Bot(sim, { skill, seed, sled: 0, name: 'Lab' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b = bot as any;
const f1 = (v: number): string => v.toFixed(1);
while (!sim.finished && sim.s.z < z1 && sim.tick < 60 * 400) {
  const inp = bot.input();
  sim.step(inp);
  bot.observe();
  const s = sim.s;
  if (s.z < z0 || sim.tick % every) continue;
  const cx = c.centerX(s.z);
  const ahead = s.z + 20;
  console.log(`${f1(s.z)} x ${f1(s.x - cx)} y-S ${f1(s.y - c.baseY(s.z))} ${s.grounded ? 'G' : 'a'} v ${f1(s.speed)} line+20 ${f1(b.lineX(ahead) - c.centerX(ahead))} kit+20 ${f1(c.lineFor(ahead, b.rider) - c.centerX(ahead))} path+20 ${f1(b.pathX(ahead) - c.centerX(ahead))} goal ${b.goal ? b.goal.kind : '-'} off ${f1(b.off)} in ${inp & 15} ${inp & 16 ? '*' : ''}`);
}
