// Round 8: a handful of bot runs on the batch's sim: finishes, falls, named tricks, charms, and that each record
// replays to its own score (the pools are made this way). One process, a minute at most.
//   npx tsx scripts/playtest/r8-bots.ts [--mountains 0,1] [--skills 0.2,0.5,0.9] [--style stunt]
import { runBot } from '../../src/bot/bot';
import type { RideStyle } from '../../src/bot/roster';
import { CHARMS } from '../../src/sim/charms';
import { MOUNTAINS } from '../../src/sim/mountains';
import { replayRecord } from '../../src/sim/replay';
import { TRICKS } from '../../src/sim/tricks';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const MTNS = opt('mountains', '0').split(',').map(Number);
const SKILLS = opt('skills', '0.2,0.5,0.9').split(',').map(Number);
const STYLE = opt('style', '') as RideStyle | '';
const SLED = +opt('sled', '0');
let bad = 0;
for (const m of MTNS) {
  for (const skill of SKILLS) {
    const chaos = { mood: 0, event: 0, seed: 0xabc + Math.round(skill * 100) };
    const { record, sim } = runBot(MOUNTAINS[m].seed, chaos, { skill, seed: 77 + m, sled: SLED, name: 'Bot', ...(STYLE ? { style: STYLE } : {}) });
    const tricks = new Map<number, number>();
    let grabs = 0;
    let deep = 0;
    replayRecord(record, (s) => {
      for (const e of s.events) {
        if (e.type === 'style' && e.trick) tricks.set(e.trick, (tricks.get(e.trick) ?? 0) + 1);
        if (e.type === 'grab' && e.phase === 'start') grabs++;
        if (e.type === 'land' && e.botched) deep++;
      }
    });
    const again = replayRecord(record);
    if (again.score !== record.score) bad++;
    console.log(
      `${MOUNTAINS[m].id} skill ${skill}: ${sim.finished ? 'finished ' + (sim.s.finishTick / 60).toFixed(1) + ' s' : 'out at ' + Math.round(sim.distance) + ' m'}, falls ${sim.s.falls}, wards ${sim.stats.wards}, botched landings ${deep}, grabs ${grabs}, score ${sim.score}${again.score === record.score ? '' : ' REPLAY ' + again.score}`,
    );
    console.log(`   charms ${sim.charms.map((c) => CHARMS[c].name).join(', ') || '-'}; flow best ${sim.stats.bestFlow}; tricks ${[...tricks.entries()].map(([k, v]) => `${TRICKS[k].name} ${v}`).join(', ')}`);
  }
}
if (bad) console.log(`${bad} records did not replay to their score`);
