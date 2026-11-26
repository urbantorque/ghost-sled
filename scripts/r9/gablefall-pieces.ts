// Round 9, Gablefall's lane: its set pieces in the lab (notes/r9-gablefall.md section 2). Every variant of each, ridden
// by the novice, mid and expert pilots and the bot at three skills on four seeds, and how often each wins it; with
// `--trace <key> <variant> <pilot> <seed>`, one ride's roofs, awnings or lines, line by line.
// `npx tsx scripts/r9/gablefall-pieces.ts [--trace ...]` (a lab sweep: the heavy slot).

import { Bot } from '../../src/bot/bot';
import { PLAIN } from '../../src/sim/chaos';
import { courseFor } from '../../src/sim/course';
import { gateX, machineZ, momentPlays, pathX, rollForVariant } from '../../src/sim/moments';
import { GABLEFALL_SEED } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';
import { classic, spenderFor } from '../playtest/labpilots';

const kit = { gateX, pathX, machineZ };
const course = courseFor(GABLEFALL_SEED);
const SEEDS = [1234, 1271, 1308, 1345];
type Who = 'novice' | 'mid' | 'expert' | number;

function ride(who: Who, v: number, seed: number, trace?: string): Sim {
  const roll = rollForVariant(course, PLAIN, v);
  const sim = new Sim({ seed: GABLEFALL_SEED, chaos: roll, sled: 0, charmPool: 0 });
  const p = typeof who === 'number' ? null : classic(who, sim, seed, kit);
  // (As tests/moments.test.ts rides them: no charm, and each pilot's own way with its lanterns.)
  const spend = typeof who === 'number' ? null : spenderFor(who, sim, seed);
  const bot = typeof who === 'number' ? new Bot(sim, { skill: who, seed, sled: 0, name: 'Lab' }) : null;
  while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
    if (p) {
      const o = p();
      sim.step((o.steer | 0) | (o.action ? 16 : 0) | (spend!() ? 64 : 0));
    } else {
      sim.step(bot!.input());
      bot!.observe();
    }
    if (trace) {
      const pl = sim.plays.find((q) => q.key === trace);
      for (const e of sim.events) {
        if (e.type === 'moment' && pl && e.index === pl.index) {
          const g = pl.gates[sim.mo.at - 1];
          const t = pl.targets[sim.mo.at - 1];
          const at = g ? ` mark x ${gateX(g, sim.tick - sim.mo.t0).toFixed(1)} hw ${g.hw}` : t ? ` target x ${t.x.toFixed(1)} hw ${t.hw}` : '';
          console.log(`  ${e.phase} ${e.n}/${e.of} z ${sim.s.z.toFixed(0)} x ${sim.s.x.toFixed(1)} v ${sim.s.speed.toFixed(1)}${at}`);
        }
        if (e.type === 'land' && pl && sim.mo.active === pl.index) console.log(`  land ${e.quality} ${e.airtime.toFixed(2)} s at ${sim.s.z.toFixed(0)}`);
      }
    }
  }
  return sim;
}

const ti = process.argv.indexOf('--trace');
if (ti >= 0) {
  const [key, v, who, seed] = process.argv.slice(ti + 1);
  ride((Number.isNaN(Number(who)) ? who : Number(who)) as Who, Number(v), Number(seed), key);
} else {
  const plays0 = momentPlays(course, rollForVariant(course, PLAIN, 0));
  console.log(plays0.map((p) => `${p.name} (${p.verb}) ${p.z0} to ${p.z1}`).join('\n'));
  const who: Who[] = ['novice', 'mid', 'expert', 0.25, 0.55, 0.9];
  for (let v = 0; v < 3; v++) {
    const plays = momentPlays(course, rollForVariant(course, PLAIN, v));
    const wins = plays.map(() => who.map(() => 0));
    who.forEach((w, wi) => {
      for (const seed of SEEDS) {
        const sim = ride(w, v, seed);
        plays.forEach((p, pi) => {
          if ((sim.stats.momentMask >> p.index) & 1) wins[pi][wi]++;
        });
      }
    });
    plays.forEach((p, pi) => console.log(`${p.key.padEnd(11)} ${p.variantKey.padEnd(7)} ${who.map((w, wi) => `${typeof w === 'number' ? `bot ${w}` : w} ${wins[pi][wi]}/4`).join('  ')}`));
  }
}
