// Prints each bundled pool's graveyards as the graveyards test pins them ([z, fell]), for after a pool regen:
//   npx tsx scripts/playtest/graves-pins.ts
import { readFileSync } from 'node:fs';
import { graveyards } from '../../src/game/graveyards';
for (const k of ['pinecrest', 'frostfang', 'ember', 'sakura']) {
  const pool = JSON.parse(readFileSync(`src/data/ghosts/${k}.json`, 'utf8')).ghosts;
  console.log(k, JSON.stringify(graveyards(pool, k).map((g: { z: number; fell: number }) => [Math.round(g.z), g.fell])));
}
