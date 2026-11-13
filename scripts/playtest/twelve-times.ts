// The Twelve's home times: each signature rider's record on its home mountain, read from the bundled pools
// (finish time, falls and wards), beside what that rider usually rides there: the same skill, style and sled
// over other seeds, so a home record that is one unlucky (or lucky) run shows as one.
//   npx tsx scripts/playtest/twelve-times.ts [--n 16]
import { readFileSync } from 'node:fs';
import { runBot } from '../../src/bot/bot';
import { ROSTER, riderSkill } from '../../src/bot/roster';
import { ChaosEvent, Mood } from '../../src/sim/chaos';
import { MOUNTAINS } from '../../src/sim/mountains';
import { hash32 } from '../../src/sim/prng';

const argv = process.argv.slice(2);
const N = +(argv[argv.indexOf('--n') + 1] || 16);
const rows: { name: string; skill: number; home: string; t: number; falls: number; med: number; lo: number; hi: number; dnf: number; others: string }[] = [];
for (const r of ROSTER) {
  const m = MOUNTAINS[r.home];
  const times: string[] = [];
  let home = { t: NaN, falls: 0 };
  MOUNTAINS.forEach((mm, i) => {
    const pool = JSON.parse(readFileSync(`src/data/ghosts/${mm.id}.json`, 'utf8')).ghosts as { name: string; finishTick: number; falls: number[] }[];
    const g = pool.find((q) => q.name === r.name);
    const t = g && g.finishTick > 0 ? g.finishTick / 60 : NaN;
    if (i === r.home) home = { t, falls: g ? g.falls.length : 0 };
    else times.push(Number.isFinite(t) ? t.toFixed(0) : 'dnf');
  });
  const sample: number[] = [];
  let dnf = 0;
  for (let i = 0; i < N; i++) {
    const { sim } = runBot(m.seed, { mood: Mood.None, event: ChaosEvent.None, seed: hash32(m.seed, 0x7e1, i) }, { skill: riderSkill(r, r.home), seed: hash32(m.seed, 0x7e2, i, ROSTER.indexOf(r)), sled: r.sled, name: r.name, style: r.style }, 60 * 60 * 5);
    if (sim.s.finished) sample.push(sim.s.finishTick / 60);
    else dnf++;
  }
  sample.sort((a, b) => a - b);
  rows.push({ name: r.name, skill: r.skill, home: m.id, t: home.t, falls: home.falls, med: sample[sample.length >> 1] ?? NaN, lo: sample[0] ?? NaN, hi: sample[sample.length - 1] ?? NaN, dnf, others: times.join(' ') });
}
rows.sort((a, b) => a.skill - b.skill);
console.log(`ladder (by skill)  home          home record s  falls+wards   usual there over ${N} seeds: median (quickest..slowest)  dnf   elsewhere`);
rows.forEach((q, i) => console.log(`${String(i + 1).padStart(2)} ${q.name.padEnd(16)} ${q.skill.toFixed(2)} ${q.home.padEnd(12)} ${q.t.toFixed(1).padStart(8)} ${String(q.falls).padStart(10)}      ${q.med.toFixed(1).padStart(6)} (${q.lo.toFixed(1)}..${q.hi.toFixed(1)})`.padEnd(100) + ` ${q.dnf}     ${q.others}`));
console.log('\nby home record, slowest first: ' + [...rows].sort((a, b) => b.t - a.t).map((q) => `${q.name} ${q.t.toFixed(1)}`).join(', '));
console.log('by usual time,  slowest first: ' + [...rows].sort((a, b) => b.med - a.med).map((q) => `${q.name} ${q.med.toFixed(1)}`).join(', '));
