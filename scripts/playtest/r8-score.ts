// The expert's score and time on each mountain, one ride each (round 8: the points budget against the trickster).
//   npx tsx scripts/playtest/r8-score.ts [--root <checkout>]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { classic, spenderFor } from './labpilots';
const i = process.argv.indexOf('--root');
const ROOT = resolve(i >= 0 ? process.argv[i + 1] : '.');
const load = async (p: string) => import(pathToFileURL(resolve(ROOT, p)).href);
const { Sim } = await load('src/sim/sim.ts');
const { MOUNTAINS } = await load('src/sim/mountains.ts');
const mo = await load('src/sim/moments.ts');
const j = process.argv.indexOf('--pool');
/** --pool 0 rides with no charm at all. */
const POOL = j >= 0 ? +process.argv[j + 1] : undefined;
for (const m of [0, 1, 2, 3, 4]) {
  const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: 0, event: 0, seed: 0x1234 }, sled: 0, charmPool: POOL });
  const p = classic('expert', sim, 0, { gateX: mo.gateX, pathX: mo.pathX, machineZ: mo.machineZ });
  const sp = spenderFor('expert', sim, 0);
  while (!sim.s.crashed && !sim.finished && sim.tick < 300 * 60) {
    const o = p();
    sim.step((o.steer | 0) | (o.action ? 16 : 0) | (sp() ? 64 : 0));
  }
  console.log(`${MOUNTAINS[m].id} ${(sim.tick / 60).toFixed(1)} s, score ${sim.score}, best combo ${sim.stats.bestCombo}, perfects ${sim.stats.perfects}, best flow ${sim.stats.bestFlow ?? '-'}, charms ${(sim.charms ?? []).join(',')}, flow s ${(sim.stats.flowTicks ?? []).map((t: number) => Math.round(t / 60)).join('/')}`);
}
