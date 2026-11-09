// What each set piece holds on every named mountain and a few dailies (src/sim/moments.ts), without a browser:
//   npx tsx scripts/playtest/moments-plan.ts
import { Course } from '../../src/sim/course';
import { momentPlays } from '../../src/sim/moments';
import { MOUNTAINS, dailySeed } from '../../src/sim/mountains';

const show = (label: string, c: Course): void => {
  console.log(`== ${label} (${c.biome})`);
  for (const p of momentPlays(c)) {
    let what = '';
    if (p.verb === 'race' || p.verb === 'collapse') what = `pace ${p.pace} m/s, ${p.verb === 'race' ? 'lead' : 'behind'} ${p.lead} m, span ${Math.round(p.z1 - p.z0)} m`;
    if (p.verb === 'gates') what = `${p.gates.length} gates: ` + p.gates.map((g) => `${Math.round(g.z)}@${(g.x - c.safeX(g.z)).toFixed(1)}`).join(' ');
    if (p.verb === 'rings') what = p.rings.map((r) => `z${Math.round(r.z)} x${(r.x - c.safeX(r.z)).toFixed(1)} h${(r.y - c.ground(r.x, r.z)).toFixed(1)}`).join(' | ');
    if (p.verb === 'steps') what = `${p.steps.length} steps at ` + p.steps.map((z) => Math.round(z)).join(' ');
    console.log(`  ${p.index} ${p.key} ${p.verb} ${Math.round(p.z0)}-${Math.round(p.z1)} stage ${p.stage}: ${what}`);
  }
};
for (const m of MOUNTAINS) show(m.id, new Course(m.seed));
for (const k of ['2026-11-08', '2026-11-10', '2026-12-01']) show(k, new Course(dailySeed(k)));
