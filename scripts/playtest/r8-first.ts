// Round 8: a first run's stomp window. When the novice and the clumsy pilot land their first perfect, with the
// ordinary window and with the first run's (sim.ts FIRST_RUN_STOMP), riding each mountain on a few seeds.
//   npx tsx scripts/playtest/r8-first.ts [--seeds 3]
import { MOUNTAINS } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';
import { classic, clumsy, spenderFor } from './labpilots';

const i = process.argv.indexOf('--seeds');
const SEEDS = i >= 0 ? +process.argv[i + 1] : 3;
for (const pilotName of ['novice', 'clumsy']) {
  for (const first of [false, true]) {
    const at: number[] = [];
    let none = 0;
    for (let m = 0; m < MOUNTAINS.length; m++) {
      for (let seed = 0; seed < SEEDS; seed++) {
        const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: 0, event: 0, seed: (0x1234 + seed * 2654435761) >>> 0 }, sled: 0, firstRun: first });
        const p = pilotName === 'clumsy' ? clumsy(sim, seed) : classic('novice', sim, seed);
        const sp = spenderFor(pilotName, sim, seed);
        let got = -1;
        while (got < 0 && sim.tick < 90 * 60 && !sim.s.crashed) {
          const o = p();
          sim.step((o.steer | 0) | (o.action ? 16 : 0) | (sp() ? 64 : 0));
          for (const e of sim.events) if (e.type === 'land' && e.quality === 'perfect') got = sim.tick / 60;
        }
        if (got < 0) none++;
        else at.push(got);
      }
    }
    at.sort((a, b) => a - b);
    const n = at.length + none;
    const under45 = at.filter((t) => t <= 45).length;
    console.log(`${pilotName.padEnd(7)} ${first ? 'first run' : 'ordinary '}: first perfect inside 45 s on ${under45} of ${n} rides; median ${at.length ? at[Math.floor(at.length / 2)].toFixed(1) : '-'} s; none in 90 s on ${none}`);
  }
}
