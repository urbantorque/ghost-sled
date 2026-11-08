import { Course } from '../../src/sim/course';
import { planMoments } from '../../src/sim/moments';
import { MOUNTAINS, dailySeed } from '../../src/sim/mountains';
for (const m of MOUNTAINS) {
  const c = new Course(m.seed);
  console.log(m.id, planMoments(c).map((x) => `${x.key}:${x.verb} ${Math.round(x.z0)}-${Math.round(x.z1)} s${x.stage}`).join(' | '));
}
for (const k of ['2026-11-08', '2026-11-09', '2026-11-10', '2026-12-01']) {
  const c = new Course(dailySeed(k));
  console.log(k, c.biome, planMoments(c).map((x) => `${x.key}:${x.verb} ${Math.round(x.z0)}-${Math.round(x.z1)} s${x.stage}`).join(' | '));
}
