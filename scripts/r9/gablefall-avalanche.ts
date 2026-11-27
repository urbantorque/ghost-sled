// Round 9, Gablefall: the fairness suite's avalanche promise (tests/fairness.test.ts, "a clean, boost-free rider
// outruns the avalanche on every mountain in every mood") ridden on the lab course before it is registered, so its
// events can be chosen: the avalanche joins only if every mood is outrun (notes/r9-ground.md section 8). Light.
import { ChaosEvent, type Mood } from '../../src/sim/chaos';
import { packInput } from '../../src/sim/input';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { Sim } from '../../src/sim/sim';

for (let mood = 0; mood <= 6; mood++) {
  const sim = new Sim({ seed: GABLEFALL_LAB_SEED, chaos: { mood: mood as Mood, event: ChaosEvent.Avalanche, seed: 17 }, sled: 0 });
  let t = 0;
  for (; t < 60 * 120 && !sim.s.crashed && sim.dyn.avalanche.phase !== 3; t++) {
    const s = sim.s;
    let lvl = 4;
    if (s.grounded) {
      const look = s.z + 4 + s.speed * 0.35;
      const err = Math.atan2(sim.course.safeX(look) - s.x, look - s.z) - s.velHeading + (sim.course.safeX(s.z) - s.x) * 0.08;
      lvl = Math.max(0, Math.min(8, Math.round(4 + err * 14)));
    }
    sim.step(packInput(lvl, false, false));
  }
  console.log(`mood ${mood}: ${sim.s.crashed ? `caught (${sim.s.crashCause}) at ${sim.s.z.toFixed(0)} m` : sim.dyn.avalanche.phase === 3 ? `outrun by ${(t / 60).toFixed(1)} s` : 'not decided'}`);
}
