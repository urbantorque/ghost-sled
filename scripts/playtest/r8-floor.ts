// The race's floor (round 8, phase 3): every pilot's place on run 1 of every mountain with a fresh save's field, so a
// change to the first run's race can be read before and after. One short node run, no browser.
//   npx tsx scripts/playtest/r8-floor.ts [--root <checkout>] [--seeds 1234,1271]
import { resolve } from 'node:path';
import { firstRunPlaces, loadMods } from './r8career';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const M = await loadMods(resolve(opt('root', '.')));
const seeds = opt('seeds', '1234,1271').split(',').map(Number);
const pilots = opt('pilots', 'hands-off,line,clumsy,novice-prompted,mid').split(',');
const t0 = performance.now();
const all = firstRunPlaces(M, pilots, seeds);
console.log(`run 1 places, a fresh save, seeds ${seeds.join(' ')}: mountain:place/of (time)`);
for (const [pilot, rows] of Object.entries(all)) {
  const podium = rows.filter((r) => r.place <= 3).length;
  const wins = rows.filter((r) => r.place === 1).length;
  console.log(`${pilot.padEnd(16)} podium ${podium}/${rows.length}  wins ${wins}  ${rows.map((r) => `${r.mountain.slice(0, 4)}:${r.place}/${r.of}${r.time ? ` (${r.time.toFixed(0)})` : ' (dnf)'}`).join('  ')}`);
}
console.log(`(${((performance.now() - t0) / 1000).toFixed(1)} s)`);
