// The far shadows' bake at 1x in node, on real course data (sites aside):   npx tsx scripts/playtest/far-bench.ts 0,1,2,3,4
// farlight: the bake's work at 1x, each timed as the least of several runs (the shared machine deschedules the
// thread; the least run is the work itself): a whole fine and coarse tile, and the sweeps (the largest steps a
// slice cannot stop inside).
import { courseFor } from '../../src/sim/course';
import { MOUNTAINS } from '../../src/sim/mountains';
import { Mood } from '../../src/sim/chaos';
import { getPalette, journeyPalette, type Palette } from '../../src/render/palette';
import { Midground } from '../../src/render/midground';
import { Props } from '../../src/render/props';
import { visualGround } from '../../src/render/ground';
import { FarShadow, type FarWorld } from '../../src/render/farshadow';
(globalThis as any).requestIdleCallback = undefined;
const least = (n: number, f: () => void): number => { let b = Infinity; for (let i = 0; i < n; i++) { const t = performance.now(); f(); b = Math.min(b, performance.now() - t); } return b; };
for (const mi of (process.argv[2] ?? '0,1,2,3,4').split(',').map(Number)) {
  const m = MOUNTAINS[mi];
  const course = courseFor(m.seed);
  const pal = getPalette(course.biome, Mood.None);
  const mid = new Midground(course, pal, 'high', 110);
  const props = new Props(course, pal, 1, true, false, true);
  const fp = {} as Palette;
  const world: FarWorld = { course, sunAt: (z, out) => out.copy(journeyPalette(course.biome, z, fp, course).shadowDir), ground: (x, z) => visualGround(course, x, z), shoulders: (r, x0, dx, n, out, at) => mid.shoulders(r, x0, dx, n, out, at), casters: (i, out) => props.farCasters(i, out), sites: () => {} };
  const far = new FarShadow(world) as any;
  far.upload = () => true;
  const z = 2000;
  for (let k = 0; k < 60; k++) mid.update(z, true);
  const ci = Math.floor(z / 64);
  props.update(ci - 1, ci + 10, new Set(), new Set(), ci);
  far.riderZ = z; far.c0 = ci - 1; far.c1 = ci + 10; far.t0 = Math.floor((z - 200) / 256); far.t1 = far.t0 + 6;
  // Warm: bake the window once.
  let job; while ((job = far.nextJob())) { while (!far.step(job, Infinity)); far.job = null; }
  const coarse = least(5, () => { const j = far.makeJob(false, Math.floor(z / 256), 0); while (!far.step(j, Infinity)); });
  const fine = least(5, () => { far.gKey.fill(NaN); const j = far.makeJob(true, ci + 2, (ci + 2) % 12); while (!far.step(j, Infinity)); });
  const fineWarm = least(5, () => { const j = far.makeJob(true, ci + 2, (ci + 2) % 12); while (!far.step(j, Infinity)); });
  const obj = least(9, () => far.obj.sweep());
  const ter = least(9, () => far.ter.sweep());
  const val = least(9, () => far.val.sweep());
  console.log(`${m.id}: a fine tile ${fine.toFixed(1)} ms (${fineWarm.toFixed(1)} with its ground kept), a coarse tile ${coarse.toFixed(1)} ms; sweeps: casters ${obj.toFixed(2)} (${far.obj.na * far.obj.nb} cells), terrain ${ter.toFixed(2)}, valley ${val.toFixed(2)} ms`);
}
