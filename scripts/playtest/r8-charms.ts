// Round 8 (G2's fairness bar): does any charm, or pair, win more than about 60% of races? The same pilot rides the
// same runs (mountains x seeds) once with each charm held from the start (a Long Night carry holds it the same way,
// and no gate deals another: --gates 1 and an empty pool), and every two charms are raced head to head on each run:
// the quicker finish wins (a run not finished loses to one that did; two unfinished, the further; a tie is half a win
// each). A charm's win
// rate is its wins over its races. Pairs (--pairs) ride every pair held together against every other pair.
//   npx tsx scripts/playtest/r8-charms.ts [--pilots mid,expert] [--mountains 0,1,2,3,4] [--seeds 2] [--pairs]
import { CHARMS, CHARM_COUNT, SYNERGIES } from '../../src/sim/charms';
import { MOUNTAINS } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';
import { spenderFor, trickster } from './labpilots';
import { gateX, machineZ, pathX } from '../../src/sim/moments';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const PILOTS = opt('pilots', 'mid').split(',') as ('mid' | 'expert')[];
const MTNS = opt('mountains', '0,1,2,3,4').split(',').map(Number);
const SEEDS = +opt('seeds', '2');
const PAIRS = argv.includes('--pairs');
const KIT = { gateX, pathX, machineZ };

/** A ride's result: finished and its time, or how far. */
function ride(pilot: 'mid' | 'expert', m: number, seed: number, charms: number[]): { fin: boolean; t: number; z: number } {
  const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: 0, event: 0, seed: (0x1234 + seed * 2654435761) >>> 0 }, sled: 0, charmPool: 0, charmGates: 1, carry: { lantern: 0, getUps: 3, charms } });
  const p = trickster(pilot, sim, seed, KIT);
  const spend = spenderFor(pilot, sim, seed);
  while (!sim.s.crashed && !sim.finished && sim.tick < 300 * 60) {
    const o = p();
    sim.step((o.steer | 0) | (o.action ? 16 : 0) | (spend() ? 64 : 0));
    p.after?.();
  }
  return { fin: sim.finished, t: sim.finished ? sim.s.finishTick / 60 : Infinity, z: sim.distance };
}

const beats = (a: { fin: boolean; t: number; z: number }, b: { fin: boolean; t: number; z: number }): number => (a.fin && b.fin ? Math.sign(b.t - a.t) : a.fin !== b.fin ? (a.fin ? 1 : -1) : Math.sign(a.z - b.z));

const builds: { name: string; charms: number[] }[] = PAIRS
  ? SYNERGIES.map((s) => ({ name: s.name, charms: [s.a, s.b] }))
  : Array.from({ length: CHARM_COUNT }, (_, id) => ({ name: CHARMS[id].name, charms: [id] }));
builds.push({ name: '(none)', charms: [] });
for (const pilot of PILOTS) {
  const wins = builds.map(() => 0);
  const races = builds.map(() => 0);
  const times = builds.map(() => [] as number[]);
  for (const m of MTNS) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const res = builds.map((b) => ride(pilot, m, seed, b.charms));
      res.forEach((r, i) => {
        if (r.fin) times[i].push(r.t);
        for (let j = 0; j < res.length; j++) {
          if (j === i) continue;
          // (A tie, the charm changing nothing on that run, is half a win each.)
          const w = beats(r, res[j]);
          races[i]++;
          wins[i] += w > 0 ? 1 : w === 0 ? 0.5 : 0;
        }
      });
    }
  }
  console.log(`\n${pilot}: ${MTNS.length} mountains x ${SEEDS} seeds, each ${PAIRS ? 'named pair' : 'charm'} raced against every other on the same run`);
  const rows = builds.map((b, i) => ({ name: b.name, rate: races[i] ? wins[i] / races[i] : 0, med: times[i].sort((a, c) => a - c)[Math.floor(times[i].length / 2)] ?? NaN, fin: times[i].length }));
  rows.sort((a, b) => b.rate - a.rate);
  for (const r of rows) console.log(`  ${r.name.padEnd(20)} wins ${(100 * r.rate).toFixed(0).padStart(3)}%   median ${r.med.toFixed(1)} s   finished ${r.fin}/${MTNS.length * SEEDS}${r.rate > 0.6 ? '   OVER 60%' : ''}`);
}
