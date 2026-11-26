// Round 9, Gullhaven's lane: its first run's field against a run that does nothing and one that only steers (the round 8
// career harness's floor, tests/r8bars.test.ts), to lay FIRST_RUN_PACE round (notes only).
import { firstRun, loadMods } from '../playtest/r8career';

const M = await loadMods('.', (p: string) => import(`../../${p}`));
const m = M.mountains.MOUNTAINS.findIndex((q: { id: string }) => q.id === 'gullhaven');
for (const pilot of ['hands-off', 'line']) {
  const f = firstRun(M, pilot, 1234, m);
  const you = { time: f.time, distance: f.distance };
  const field = f.field.filter((q: { kind: string }) => q.kind !== 'you').map((q: { time: number | null }) => q.time ?? Infinity).sort((a: number, b: number) => a - b);
  const ahead = f.field.filter((q: { kind: string; time: number | null; distance: number }) => q.kind !== 'you' && M.standing.aheadOf({ time: q.time, distance: q.distance }, you)).length;
  console.log(`${pilot}: ${f.time?.toFixed(1)} s, place ${ahead + 1}; the field ${field.slice(0, 6).map((t: number) => t?.toFixed(1)).join(' ')} ...`);
}
