// Round 9, the ground lane: one steering hand on the Old Run's lab course, three lines (the floor's middle, the line
// kit.ts gives a skilled rider up into the glaze, and a mid rider's), each at two gains: how long each takes and what
// it rides on. The lab's question for the Old Run's lane: does the glaze pay (notes/r9-ground.md section 15, step 7).
// `npx tsx scripts/r9/oldrun-hand.ts` (a few seconds).
import { PLAIN } from '../../src/sim/chaos';
import { OLDRUN_LAB_SEED } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';
function go(label: string, skill: number, gain: number) {
  const sim = new Sim({ seed: OLDRUN_LAB_SEED, chaos: PLAIN, sled: 0 });
  const c = sim.course;
  const rider = { x: 0, y: 0, z: 0, v: 0, skill, nerve: 0.5 };
  let g = 0, gv = 0, sl = 0, slv = 0, ice = 0, icev = 0, bend = 0, bendG = 0, scr = 0, lips = 0;
  while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 400) {
    const s = sim.s;
    Object.assign(rider, { x: s.x, y: s.y, z: s.z, v: s.speed });
    const look = s.z + 5 + s.speed * 0.3;
    const tx = skill < 0 ? c.centerX(look) : c.lineFor(look, rider);
    const err = Math.atan2(tx - s.x, look - s.z) - s.velHeading;
    const lvl = Math.max(0, Math.min(8, Math.round(4 + err * gain)));
    sim.step(lvl | (Math.abs(lvl - 4) <= 1 ? 16 : 0));
    for (const e of sim.events) { if (e.type === 'scrape') scr++; if (e.type === 'takeoff' && e.kind === 'lip') lips++; }
    if (s.grounded && !s.finished) {
      const f = c.surface(s.x, s.z).drag;
      if (f === 0.4) { g++; gv += s.speed; } else if (f === 1.6) { sl++; slv += s.speed; } else { ice++; icev += s.speed; }
      const pp = Math.abs(c.centerX(s.z + 2) - 2 * c.centerX(s.z) + c.centerX(s.z - 2)) / 4;
      if (pp >= 1 / 180) { bend++; if (f === 0.4) bendG++; }
    }
  }
  console.log(label.padEnd(12), 'time', (sim.s.finishTick / 60).toFixed(1), 'mean', (3000 / (sim.s.finishTick / 60)).toFixed(1), 'glaze', (g / 60).toFixed(1), 's at', (gv / Math.max(1, g)).toFixed(1), 'slush', (sl / 60).toFixed(1), 's at', (slv / Math.max(1, sl)).toFixed(1), 'ice', (ice / 60).toFixed(1), 's at', (icev / Math.max(1, ice)).toFixed(1), 'bends on glaze', (bendG / Math.max(1, bend)).toFixed(2), 'scrapes', scr, 'lips', lips, 'max', sim.stats.maxSpeed.toFixed(1));
}
for (const gain of [10, 16]) { go(`floor g${gain}`, -1, gain); go(`glaze g${gain}`, 1, gain); go(`mid g${gain}`, 0.55, gain); }
