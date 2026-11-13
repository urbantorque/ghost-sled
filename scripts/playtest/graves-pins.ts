// Prints each bundled pool's graveyards as the graveyards test pins them ([z, fell]), for after a pool regen:
//   npx tsx scripts/playtest/graves-pins.ts
import { readFileSync } from 'node:fs';
import { graveyards } from '../../src/game/graveyards';
import { MOUNTAINS } from '../../src/sim/mountains';
// (Every bundled mountain: the fifth, Lanternfall, since round 7.)
for (const k of MOUNTAINS.map((m) => m.id)) {
  const pool = JSON.parse(readFileSync(`src/data/ghosts/${k}.json`, 'utf8')).ghosts;
  console.log(k, JSON.stringify(graveyards(pool, k).map((g: { z: number; fell: number }) => [Math.round(g.z), g.fell])));
}
