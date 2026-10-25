import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PoolRun, generatePool } from '../src/bot/pool';
import { MOUNTAINS } from '../src/sim/mountains';
import { hashString } from '../src/sim/prng';
import { replayRecord } from '../src/sim/replay';
import { SIM_VERSION, TICK_RATE } from '../src/sim/sim';

// Builds the bundled ghost pools: src/data/ghosts/<mountain>.json for every mountain.
// Run with: npx tsx scripts/generate-ghosts.ts

const COUNT = 36;
const BUDGET = 110;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src', 'data', 'ghosts');
mkdirSync(outDir, { recursive: true });

const BANDS = [
  { name: 'beginner', lo: 0, hi: 0.34 },
  { name: 'mid', lo: 0.34, hi: 0.67 },
  { name: 'expert', lo: 0.67, hi: 1.01 },
];

function pad(v: string | number, n: number): string {
  return String(v).padStart(n);
}

/** Average airtime per real landing (bumps excluded), from a replay of the run. */
function airtime(r: PoolRun): { sum: number; n: number } {
  let sum = 0;
  let n = 0;
  replayRecord(r.record, (sim) => {
    for (const e of sim.events) {
      if (e.type === 'land' && !e.late && e.quality !== 'hop') {
        sum += e.airtime;
        n++;
      }
    }
  });
  return { sum, n };
}

function causes(runs: PoolRun[]): string {
  const c = new Map<string, number>();
  for (const r of runs) {
    const k = r.sim.s.crashCause ?? 'survived';
    c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
}

let total = 0;
for (const m of MOUNTAINS) {
  const t0 = performance.now();
  let runs: PoolRun[] = [];
  const ghosts = generatePool(m.seed, COUNT, hashString('bundled/' + m.id), { budgetRuns: BUDGET, report: (r) => (runs = r) });
  const json = JSON.stringify({ version: 1, simVersion: SIM_VERSION, mountain: m.id, seed: m.seed, ghosts });
  writeFileSync(join(outDir, `${m.id}.json`), json);
  total += json.length;
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  const scores = ghosts.map((g) => g.score);
  const picked = runs.filter((r) => r.selected);
  console.log(`\n${m.name} (${m.id}): ${ghosts.length} ghosts from ${runs.length} runs in ${secs} s, ${(json.length / 1024).toFixed(1)} KB`);
  console.log(`  scores ${scores[0]} .. ${scores[scores.length - 1]}, median ${scores[Math.floor(scores.length / 2)]}`);
  console.log(`  scores: ${scores.join(' ')}`);
  console.log(`  pool crash causes: ${causes(picked)}`);
  console.log(`  moods/events: ${ghosts.filter((g) => g.mood !== 0).length} with a mood, ${ghosts.filter((g) => g.event !== 0).length} with an event; sleds ${ghosts.map((g) => g.sled).join('')}`);
  console.log(`  ${'band'.padEnd(9)} ${pad('runs', 4)} ${pad('avg score', 10)} ${pad('avg sec', 8)} ${pad('air s', 6)} ${pad('perfect/min', 11)} ${pad('flips/min', 9)}  crashes`);
  for (const b of BANDS) {
    const rs = runs.filter((r) => r.skill >= b.lo && r.skill < b.hi);
    if (!rs.length) continue;
    const sec = rs.reduce((a, r) => a + r.record.ticks / TICK_RATE, 0);
    const score = rs.reduce((a, r) => a + r.record.score, 0) / rs.length;
    let airSum = 0;
    let airN = 0;
    for (const r of rs) {
      const a = airtime(r);
      airSum += a.sum;
      airN += a.n;
    }
    const air = airN ? airSum / airN : 0;
    const perfects = rs.reduce((a, r) => a + r.sim.stats.perfects, 0);
    const flips = rs.reduce((a, r) => a + r.sim.stats.flips, 0);
    console.log(
      `  ${b.name.padEnd(9)} ${pad(rs.length, 4)} ${pad(Math.round(score), 10)} ${pad((sec / rs.length).toFixed(0), 8)} ${pad(air.toFixed(2), 6)} ${pad(((perfects * 60) / sec).toFixed(1), 11)} ${pad(((flips * 60) / sec).toFixed(1), 9)}  ${causes(rs)}`,
    );
  }
}
console.log(`\nwrote ${MOUNTAINS.length} pools, ${(total / 1024).toFixed(1)} KB total, to ${outDir}`);
