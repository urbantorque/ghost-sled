// Round 9, Gullhaven's lane: a probe of one gully under the bench's soaring hand, a line every 10 m (notes only).
import { PLAIN } from '../../src/sim/chaos';
import { GULLHAVEN_LAB_SEED } from '../../src/sim/mountains';
import { gulliesOf, gullySpan, rimY } from '../../src/sim/gullhaven';
import { Sim } from '../../src/sim/sim';
import { hand } from './gullhaven-tune';

const gi = Number(process.argv[2] ?? 5);
const sim = new Sim({ seed: GULLHAVEN_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim.course;
const g = gulliesOf(c)[gi];
const sp = gullySpan(g);
const go = hand(sim, true);
let next = sp.z0 - 20;
while (!sim.finished && sim.s.z < sp.z1 + 60) {
  sim.step(go());
  const s = sim.s;
  for (const e of sim.events) if (e.type !== 'style' && e.type !== 'comboBank') console.log(`   ${s.z.toFixed(1)} ${e.type} ${JSON.stringify(e).slice(0, 90)}`);
  if (s.z >= next) {
    next += 10;
    const sf = c.surface(s.x, s.z);
    console.log(`z ${s.z.toFixed(0)} dx ${(s.x - c.centerX(s.z)).toFixed(1)} hw ${c.halfWidth(s.z).toFixed(1)} v ${s.speed.toFixed(1)} ${s.grounded ? 'G' : 'A'} h ${(s.y - c.ground(s.x, s.z)).toFixed(1)} drag ${sf.drag} steer ${s.steer.toFixed(2)} slip ${s.slip.toFixed(2)} boost ${s.boostPool.toFixed(1)} lift ${c.liftAt(s.x, s.y, s.z).toFixed(2)} overRim ${(s.y - rimY(c, g, s.z)).toFixed(1)} vy ${s.vy.toFixed(1)}`);
  }
}
