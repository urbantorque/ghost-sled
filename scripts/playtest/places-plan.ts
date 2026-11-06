// The places on each mountain, without a browser: what stands where in Clear Skies and Comet (low gravity),
// the overlooks, the air over the long sites, the longest stretch with nothing in it, and what each kind
// of piece costs.
//   npx tsx scripts/playtest/places-plan.ts
import { RUN_OUT, Course } from '../../src/sim/course';
import { MOUNTAINS } from '../../src/sim/mountains';
import { Mood } from '../../src/sim/chaos';
import { getPalette } from '../../src/render/palette';
import { SitePlan, pieceCtx, siteAir } from '../../src/render/landmarks';
import { ENCLOSED, mergePiece, pieceFor } from '../../src/render/landmarkKit';
import { OverlookPlan } from '../../src/render/overlook';

for (const m of MOUNTAINS) {
  const c = new Course(m.seed);
  const t0 = performance.now();
  const looks = new OverlookPlan(c);
  looks.planTo(c.finishZ);
  const layMs = performance.now() - t0;
  const views = looks.planned.filter((o) => o.z0 < c.finishZ + RUN_OUT);
  console.log(`== ${m.name}: laid in ${layMs.toFixed(1)} ms; overlooks ${views.map((o) => `${Math.round(o.z0)}-${Math.round(o.z1)}`).join(' ')}`);
  for (const mood of [Mood.None, Mood.Comet]) {
    const plan = new SitePlan(c, mood);
    const t1 = performance.now();
    plan.flyTo(c.finishZ + RUN_OUT);
    const list = plan.planned;
    const spans = [...list.map((s) => [s.z - s.len, s.z + s.len]), ...views.map((o) => [o.z0, o.z1])].sort((a, b) => a[0] - b[0]);
    let gap = 0;
    let end = 0;
    let where = 0;
    for (const [a, b] of spans) {
      if (a - end > gap) {
        gap = a - end;
        where = end;
      }
      end = Math.max(end, b);
    }
    console.log(`  ${Mood[mood]}: flown in ${(performance.now() - t1).toFixed(0)} ms (longest ${plan.stats.maxPlanMs.toFixed(1)}); longest bare ${Math.round(gap)} m from ${Math.round(where)}`);
    console.log('   ' + list.map((s) => `${s.kind}@${Math.round(s.z - s.len)}${s.len ? '-' + Math.round(s.z + s.len) : ''}${s.clear ? ' c' + Math.round(s.clear) : ''}`).join('  '));
    for (const s of list) {
      if (!ENCLOSED.has(s.kind)) continue;
      const row: string[] = [];
      for (let dz = -s.len; dz <= s.len; dz += 20) row.push((siteAir(s, s.z + dz - 4, s.z + dz + 4) - c.baseY(s.z + dz)).toFixed(0));
      console.log(`   ${s.kind} air over floor: ${row.join(' ')}`);
    }
  }
  const p = getPalette(c.biome, Mood.None);
  const plan = new SitePlan(c, Mood.None);
  plan.flyTo(c.finishZ + RUN_OUT);
  const seen = new Set<string>();
  for (const s of plan.planned) {
    if (seen.has(s.kind)) continue;
    seen.add(s.kind);
    const cost = [false, true].map((low) => {
      const piece = pieceFor(s.kind, pieceCtx(c, s, p, true, low));
      let top = 0;
      const made = piece.steps.flatMap((f) => {
        const a = performance.now();
        const r = f();
        top = Math.max(top, performance.now() - a);
        return r;
      });
      const a = performance.now();
      const g = mergePiece(made);
      const merged = performance.now() - a;
      const tris = g.getAttribute('position').count / 3;
      g.dispose();
      return `${low ? 'low' : 'high'} ${tris} tris, ${piece.steps.length} steps (worst ${top.toFixed(1)} ms, merge ${merged.toFixed(1)} ms), ${piece.spots.length} figures`;
    });
    console.log(`   ${s.kind}: ${cost.join(' | ')}`);
  }
}
