// How the bundled pools' riders played each set piece (round 6): replays every record and counts, per set
// piece, the riders who met it and the ones who won it, signature riders apart.
//   npx tsx scripts/playtest/pool-moments.ts
import { readFileSync } from 'node:fs';
import { recordFromString, replayRecord } from '../../src/sim/replay';
for (const k of ['pinecrest', 'frostfang', 'ember', 'sakura']) {
  const pool = JSON.parse(readFileSync(`src/data/ghosts/${k}.json`, 'utf8')).ghosts as { record: string; name: string; rider?: string }[];
  const met: number[] = [];
  const won: number[] = [];
  const sig: string[] = [];
  let keys: string[] = [];
  for (const g of pool) {
    const sim = replayRecord(recordFromString(g.record));
    keys = sim.plays.map((p) => `${p.key}:${p.verb}`);
    sim.plays.forEach((p, i) => {
      if (sim.distance >= p.z0) met[i] = (met[i] ?? 0) + 1;
      if ((sim.stats.momentMask >> i) & 1) {
        won[i] = (won[i] ?? 0) + 1;
        if (g.rider) sig.push(`${g.rider}@${p.key}`);
      }
    });
  }
  console.log(k, keys.map((key, i) => `${key} ${won[i] ?? 0}/${met[i] ?? 0}`).join(' | '));
  console.log('   signature winners:', sig.join(' '));
}
