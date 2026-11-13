// How fast the bots can ride a mountain: finish times by skill and sled over many seeds, plain chaos.
// It answers what the fast end of a pool could hold before pool.ts is asked for it.
//   npx tsx scripts/playtest/pool-fast.ts [--m 0] [--n 24] [--skills 0.85,0.95,1] [--sleds 0,1,2,3,4,5]
import { runBot } from '../../src/bot/bot';
import { ChaosEvent, Mood } from '../../src/sim/chaos';
import { MOUNTAINS } from '../../src/sim/mountains';
import { hash32 } from '../../src/sim/prng';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const M = +opt('m', '0');
const N = +opt('n', '24');
const SKILLS = opt('skills', '0.85,0.95,1').split(',').map(Number);
const SLEDS = opt('sleds', '0,1,2,3,4,5').split(',').map(Number);
const m = MOUNTAINS[M];
const t0 = performance.now();
console.log(`${m.id}: ${N} seeds a cell, plain chaos. Finish time s: fastest / p25 / median, and how many finished`);
for (const skill of SKILLS) {
  for (const sled of SLEDS) {
    const times: number[] = [];
    for (let i = 0; i < N; i++) {
      const { sim } = runBot(m.seed, { mood: Mood.None, event: ChaosEvent.None, seed: hash32(m.seed, 0xfa57, i) }, { skill, seed: hash32(m.seed, 0xfa58, i, sled), sled, name: '' }, 60 * 60 * 5);
      if (sim.s.finished) times.push(sim.s.finishTick / 60);
    }
    times.sort((a, b) => a - b);
    const q = (k: number): string => (times.length ? times[Math.min(times.length - 1, Math.floor(k * times.length))].toFixed(1) : '-');
    console.log(`  skill ${skill.toFixed(2)} sled ${sled}: ${q(0)} / ${q(0.25)} / ${q(0.5)}   ${times.length}/${N}`);
  }
}
console.log(`${((performance.now() - t0) / 1000).toFixed(0)} s`);
