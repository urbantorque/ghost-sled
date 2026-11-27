// Round 9, Gablefall's lane: the round 8 bar's clumsy first minute (tests/r8bars.test.ts: the career harness's clumsy
// pilot in a pool field, six seeds a mountain, capped at 600 s) a mountain at a time, to see where it falls short. A lab
// sweep: the heavy slot. `npx tsx scripts/r9/gablefall-clumsy.ts [id,id]`
import { clumsyFinishes, loadMods } from '../playtest/r8career';

const M = await loadMods('.', (p: string) => import(`../../${p}`));
const only = process.argv[2]?.split(',');
for (const m of M.mountains.MOUNTAINS as { id: string }[]) {
  if (only && !only.includes(m.id)) continue;
  const one = { ...M, mountains: { ...M.mountains, MOUNTAINS: [m] } };
  const f = clumsyFinishes(one, 6);
  console.log(`${m.id.padEnd(12)} ${f.finished}/${f.of}`);
}
