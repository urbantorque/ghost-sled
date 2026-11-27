// Round 9, the wiring lane: a mountain's first run's field against a run that does nothing and one that only steers
// (the round 8 career harness's floor, tests/r8bars.test.ts), to lay FIRST_RUN_PACE round (field.ts). As the mountain
// lanes' gullhaven-floor.ts and gablefall-floor.ts, for any mountain: `npx tsx scripts/r9/wiring-floor.ts oldrun [--pace 94] [--seeds]`.
import { firstRun, loadMods } from '../playtest/r8career';

const id = process.argv[2] ?? 'oldrun';
const M = await loadMods('.', (p: string) => import(`../../${p}`));
const m = M.mountains.MOUNTAINS.findIndex((q: { id: string }) => q.id === id);
if (m < 0) throw new Error(`no mountain ${id}`);
// (`--pace N` tries another pace for the mountain, for this run only.)
const paceAt = process.argv.indexOf('--pace');
if (paceAt >= 0) (M.field.FIRST_RUN_PACE as Record<string, number>)[id] = Number(process.argv[paceAt + 1]);
console.log(`${id}: FIRST_RUN_PACE ${M.field.FIRST_RUN_PACE[id]} s`);
// (The bar rides seed 1234, tests/r8bars.test.ts; `--seeds` rides more, to see how thin the floor is.)
const seeds = process.argv.includes('--seeds') ? [1234, 1271, 1308, 1345] : [1234];
for (const seed of seeds) for (const pilot of ['hands-off', 'line']) {
  const f = firstRun(M, pilot, seed, m);
  const you = { time: f.time, distance: f.distance };
  const field = f.field.filter((q: { kind: string }) => q.kind !== 'you').map((q: { time: number | null }) => q.time ?? Infinity).sort((a: number, b: number) => a - b);
  const ahead = f.field.filter((q: { kind: string; time: number | null; distance: number }) => q.kind !== 'you' && M.standing.aheadOf({ time: q.time, distance: q.distance }, you)).length;
  console.log(`${seed} ${pilot}: ${f.time?.toFixed(1)} s, place ${ahead + 1}; the field ${field.slice(0, 6).map((t: number) => t?.toFixed(1)).join(' ')} ...`);
}
