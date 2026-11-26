// Round 9, the Old Run's lane: its three set pieces in the lab (notes/r9-oldrun.md section 2). Every variant of each,
// ridden by the lab's novice, mid and expert pilots and the bot at three skills, a few seeds each: how often each set
// piece is won, what each rider counted (bells rung, the split's time, seconds on the glaze), and any fall.
// `npx tsx scripts/r9/oldrun-pieces.ts [--seeds 3]` (a lab sweep: the heavy slot).

import { Bot } from '../../src/bot/bot';
import { PLAIN } from '../../src/sim/chaos';
import { courseFor } from '../../src/sim/course';
import { gateX, machineZ, momentPlays, pathX, rollForVariant } from '../../src/sim/moments';
import { OLDRUN_SEED } from '../../src/sim/mountains';
import { Sim, TRACK_BANK, TRACK_DAMP, wallYaw } from '../../src/sim/sim';
import { classic } from '../playtest/labpilots';

const at = process.argv.indexOf('--seeds');
const N = at >= 0 ? Number(process.argv[at + 1]) : 3;
const SEEDS = Array.from({ length: N }, (_, i) => 1234 + 37 * i);
const kit = { gateX, pathX, machineZ, track: { wallYaw, damp: TRACK_DAMP, bank: TRACK_BANK } };
const course = courseFor(OLDRUN_SEED);

interface Out {
  won: boolean[];
  n: number[];
  falls: number;
  t: number;
}

function ride(who: string, seed: number, v: number): Out {
  const chaos = rollForVariant(course, { ...PLAIN, seed: 0x5eed + seed }, v);
  const sim = new Sim({ seed: OLDRUN_SEED, chaos, sled: 0 });
  let input: () => number;
  let after: () => void = () => {};
  if (who.startsWith('bot')) {
    const bot = new Bot(sim, { skill: Number(who.slice(4)), seed, sled: 0, name: 'Lab' });
    input = () => bot.input();
    after = () => bot.observe();
  } else {
    const p = classic(who as 'mid', sim, seed, kit);
    input = () => {
      const o = p();
      return (o.steer | 0) | (o.action ? 16 : 0);
    };
    after = () => p.after?.();
  }
  const out: Out = { won: [false, false, false], n: [0, 0, 0], falls: 0, t: 0 };
  while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
    sim.step(input());
    after();
    for (const e of sim.events) {
      if (e.type === 'moment' && (e.phase === 'won' || e.phase === 'lost')) {
        out.won[e.index] = e.phase === 'won';
        out.n[e.index] = e.n;
      }
      if (e.type === 'tumble' && e.phase === 'start') out.falls++;
    }
  }
  out.t = sim.s.finishTick / 60;
  return out;
}

const plays = [0, 1, 2].map((v) => momentPlays(course, rollForVariant(course, { ...PLAIN, seed: 0x5eed }, v)));
const WHO = ['novice', 'mid', 'expert', 'bot 0.25', 'bot 0.55', 'bot 0.9'];
for (let i = 0; i < 3; i++) {
  console.log(`\n${plays[0][i].name} (${plays[0][i].verb})`);
  for (let v = 0; v < 3; v++) {
    const cells = WHO.map((w) => {
      const rs = SEEDS.map((s) => ride(w, s, v));
      const won = rs.filter((r) => r.won[i]).length;
      const ns = rs.map((r) => r.n[i]).join(',');
      return `${w} ${won}/${rs.length} (${ns})${rs.some((r) => r.falls) ? ` F${rs.reduce((a, r) => a + r.falls, 0)}` : ''}`;
    });
    console.log(`  ${plays[v][i].variantKey.padEnd(9)} ${cells.join('  ')}`);
  }
}
