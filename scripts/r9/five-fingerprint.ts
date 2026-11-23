// Round 9, the ground lane: prints the five's fingerprint (scripts/r9/fivedigest.ts) with what each part cost, as the
// literals tests/five.test.ts and tests/five-rides.test.ts hold. Captured on round-9 at 6255b8d, before the sim batch;
// run again after any step to see what moved. `npx tsx scripts/r9/five-fingerprint.ts [courses|chaos|rides]`.

import { BOT_SKILLS, BOT_STYLES, DAILY_KEYS, SCRIPT_ROLLS, botRide, chaosFacts, courseFacts, courseSeeds, digest, fiveSeeds, pilotRide, scriptedRide } from './fivedigest';
import { dailySeed } from '../../src/sim/mountains';

const only = process.argv[2];
const t0 = performance.now();
const lap = (label: string, from: number): void => console.log(`// ${label}: ${((performance.now() - from) / 1000).toFixed(1)} s`);

if (!only || only === 'courses') {
  const t = performance.now();
  console.log('export const COURSES: Record<string, string> = {');
  for (const { id, seed } of courseSeeds()) console.log(`  '${id}': '${digest(courseFacts(seed))}',`);
  console.log('};');
  lap('courses', t);
}
if (!only || only === 'chaos') {
  const t = performance.now();
  console.log(`export const CHAOS = '${digest(chaosFacts())}';`);
  lap('chaos', t);
}
if (!only || only === 'rides') {
  let t = performance.now();
  console.log('export const SCRIPTED: Record<string, string> = {');
  for (const { id, seed } of fiveSeeds()) console.log(`  '${id}': '${digest(SCRIPT_ROLLS.map((r, k) => scriptedRide(seed, r, k * 2 + 1, 60 * 90)))}',`);
  console.log('};');
  lap('scripted rides', t);
  t = performance.now();
  console.log('export const BOTS: Record<string, string> = {');
  for (const { id, seed } of [...fiveSeeds(), { id: `daily ${DAILY_KEYS[0]}`, seed: dailySeed(DAILY_KEYS[0]) }]) {
    const rides: unknown[] = [];
    for (const skill of BOT_SKILLS) for (const style of BOT_STYLES) rides.push(botRide(seed, skill, style));
    console.log(`  '${id}': '${digest(rides)}',`);
  }
  console.log('};');
  lap('bot rides', t);
  t = performance.now();
  console.log('export const PILOTS: Record<string, string> = {');
  for (const { id, seed } of fiveSeeds()) console.log(`  '${id}': '${digest([pilotRide(seed, 'mid', 1234), pilotRide(seed, 'clumsy', 1271)])}',`);
  console.log('};');
  lap('pilot rides', t);
}
lap('all', t0);
