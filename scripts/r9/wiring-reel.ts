// Round 9, the wiring lane: how each pool rider rides through a mountain's title shot (keyart.ts TITLE_SHOTS), so the
// reel's field can be drawn from riders who ride the line the shot was composed for. For a new mountain, the share of
// the shot's stretch each rider spends on its mechanic (r9-courselib.ts MECHANICS: the Old Run's wall, Gullhaven's
// column of wind, Gablefall's roofs), and how much of it grounded; for Gablefall also the share in the street. Prints
// one row a rider, weakest first (the pool's order), and marks the reel's field as the app draws it (keyart.ts
// reelField, app.ts setAttractField).
//
//   npx tsx scripts/r9/wiring-reel.ts [mountain ...]      (the three new mountains by default; seconds, one process)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOUNTAINS } from '../../src/sim/mountains';
import { recordFromString, replayRecord } from '../../src/sim/replay';
import { reelField, titleShot } from '../../src/game/keyart';
import { withSlowRiders } from '../../src/game/slowriders';
import { KING } from '../../src/game/twelve';
import { MECHANICS } from '../playtest/r9-courselib';

const ids = process.argv.length > 2 ? process.argv.slice(2) : ['oldrun', 'gullhaven', 'gablefall'];
for (const id of ids) {
  const m = MOUNTAINS.find((x) => x.id === id);
  if (!m) throw new Error(`no mountain ${id}`);
  const shot = titleShot(id);
  const mech = MECHANICS[id] ?? (() => false);
  // (The pool as the app holds it, app.ts poolFor: the bundled riders and the slow riders made to fill its slow end.)
  const pool = { ghosts: withSlowRiders(JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'ghosts', `${id}.json`), 'utf8')).ghosts, id) as Array<{ name: string; finishTick: number; record: string }> };
  // (A save before The Hollow King's duel, as every save is until eleven of The Twelve fall.)
  const field = new Set(reelField(pool.ghosts.map((g) => g.name), id, [KING.name]));
  console.log(`\n${m.name}: the title shot ${shot.from} to ${shot.to} m; pool ${pool.ghosts.length}; the reel's field ${[...field].join(', ')}`);
  console.log('   i  name                   time  mechanic  grounded on it  in the street');
  pool.ghosts.forEach((g, i) => {
    let n = 0;
    let on = 0;
    let onGround = 0;
    let street = 0;
    replayRecord(recordFromString(g.record)!, (sim) => {
      const s = sim.s;
      if (s.z < shot.from || s.z > shot.to || s.finished) return;
      n++;
      if (mech({ sim, input: 0 })) {
        on++;
        if (s.grounded) onGround++;
      }
      const c = sim.course;
      if (c.hasLevels && c.streetAt(s.z) !== null && s.grounded && c.ground(s.x, s.z) - c.baseY(s.z) < 1.5) street++;
    });
    const pc = (k: number): string => `${((100 * k) / Math.max(1, n)).toFixed(0).padStart(3)}%`;
    console.log(`${field.has(i) ? '*' : ' '}${String(i).padStart(3)}  ${g.name.padEnd(20)} ${(g.finishTick / 60).toFixed(1).padStart(6)}  ${pc(on)}      ${pc(onGround)}            ${pc(street)}`);
  });
}
