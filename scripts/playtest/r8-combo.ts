// Round 8 (the Expression bar): what ends the expert's combos. Rides the lab's expert (labpilots.ts trickster) once a
// mountain and says, for every combo that held a named trick: how many named tricks it held, what ended it (the
// window running out on the snow, a bump or scrape, a fall), and the snow time between one trick's landing and the
// next takeoff, against the combo's 2.6 s window.
//   npx tsx scripts/playtest/r8-combo.ts [--pilot expert] [--seeds 1]
import { MOUNTAINS } from '../../src/sim/mountains';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { COMBO_WINDOW_TICKS } from '../../src/sim/scoring';
import { Sim } from '../../src/sim/sim';
import { spenderFor, trickster } from './labpilots';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const PILOT = opt('pilot', 'expert') as 'mid' | 'expert';
const SEEDS = +opt('seeds', '1');
/** --pool <mask>: the charms the gates deal (default none: the bar is the pilot's, not a charm's). */
const POOL = +opt('pool', '0');
const best: number[] = [];
const ends = { window: 0, bump: 0, fall: 0, finish: 0 };
const gaps: number[] = [];
const times: number[] = [];
for (let m = 0; m < MOUNTAINS.length; m++) {
  for (let seed = 0; seed < SEEDS; seed++) {
    const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: 0, event: 0, seed: (0x1234 + seed * 2654435761) >>> 0 }, sled: 0, charmPool: POOL });
    const p = trickster(PILOT, sim, seed, { gateX, pathX, machineZ });
    const spend = spenderFor(PILOT, sim, seed);
    let combo = new Set<number>();
    let top = 0;
    let landed = -1;
    let why = '';
    while (!sim.s.crashed && !sim.finished && sim.tick < 300 * 60) {
      const o = p();
      sim.step((o.steer | 0) | (o.action ? 16 : 0) | (spend() ? 64 : 0));
      p.after?.();
      // (A bump banks the combo before it is said: what ended a combo is read off the whole tick first.)
      const ev = sim.events;
      why = ev.some((e) => e.type === 'bump' || e.type === 'scrape') ? 'bump' : ev.some((e) => (e.type === 'tumble' && e.phase === 'start') || e.type === 'ward' || e.type === 'crash') ? 'fall' : ev.some((e) => e.type === 'finish') ? 'finish' : '';
      if (why === 'bump' && combo.size && argv.includes('--where')) console.log(`  bump at ${Math.round(sim.s.z)} in ${sim.course.section(sim.s.z).kind}, ${(sim.s.x - sim.course.safeX(sim.s.z)).toFixed(1)} m off the line, ${sim.s.grounded ? 'on the snow' : 'in the air'}, ${landed >= 0 ? ((sim.tick - landed) / 60).toFixed(2) + ' s after a landing' : ''}`);
      for (const e of sim.events) {
        if (e.type === 'style' && e.trick) {
          combo.add(e.trick);
          top = Math.max(top, combo.size);
        } else if (e.type === 'land' && e.quality !== 'hop' && combo.size) landed = sim.tick;
        else if (e.type === 'takeoff' && landed >= 0) {
          gaps.push((sim.tick - landed) / 60);
          landed = -1;
        } else if (e.type === 'comboBank' || e.type === 'comboLost') {
          if (combo.size) ends[(why || 'window') as keyof typeof ends]++;
          combo = new Set();
          landed = -1;
        }
      }
    }
    best.push(top);
    if (sim.finished) times.push(sim.s.finishTick / 60);
  }
}
const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const win = COMBO_WINDOW_TICKS / 60;
console.log(`${PILOT}: best combo in named tricks ${best.join(' ')} (median ${med(best)}); median time ${med(times).toFixed(1)} s`);
console.log(`  combos with a trick ended by: the window ${ends.window}, a bump ${ends.bump}, a fall ${ends.fall}, the finish ${ends.finish}`);
console.log(`  snow between a trick's landing and the next takeoff in the same or next combo: median ${med(gaps).toFixed(2)} s; ${gaps.filter((g) => g > win).length} of ${gaps.length} over the ${win.toFixed(1)} s window`);
