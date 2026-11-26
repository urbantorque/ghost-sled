// Round 9, the Old Run's lane: the bends as laid (notes/r9-oldrun.md section 1). Each stretch of bend (curvature a third
// of the deepest's or more): its z, its length, its tightest radius, and whether the glaze lies two thirds up its
// outside wall; then the bends' share of the run. `npx tsx scripts/r9/oldrun-diag.ts` (a second).
import { PLAIN } from '../../src/sim/chaos';
import { OLDRUN_LAB_SEED } from '../../src/sim/mountains';
import { FLOOR, GLAZE, WALL } from '../../src/sim/oldrun';
import { Sim } from '../../src/sim/sim';

const sim0 = new Sim({ seed: OLDRUN_LAB_SEED, chaos: PLAIN, sled: 0 });
const c = sim0.course;
const kOf = (z: number): number => (c.centerX(z + 2) - 2 * c.centerX(z) + c.centerX(z - 2)) / 4;
const across0 = (u: number): number => FLOOR * Math.min(1, Math.max(0, u / 0.15)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, u / 0.15))) + u * WALL;
let inB = false;
let z0 = 0;
let kmax = 0;
let gl = 0;
let n = 0;
const out: string[] = [];
let bendZ = 0;
for (let z = 0; z < 3000; z += 0.5) {
  const k = kOf(z);
  const on = Math.abs(k) >= 1 / 180;
  if (on && !inB) {
    inB = true;
    z0 = z;
    kmax = 0;
    gl = 0;
    n = 0;
  }
  if (on) {
    kmax = Math.max(kmax, Math.abs(k));
    const side = k > 0 ? -1 : 1;
    const p = c.channelSlope(z);
    const x = c.centerX(z) + side * across0(0.67) * Math.sqrt(1 + p * p);
    n++;
    if (c.surface(x, z).drag === GLAZE.drag) gl++;
    bendZ += 0.5;
  }
  if (!on && inB) {
    inB = false;
    out.push(`${z0.toFixed(0).padStart(5)}..${z.toFixed(0).padStart(5)} (${(z - z0).toFixed(0).padStart(3)} m) R${(1 / kmax).toFixed(0).padStart(4)} glaze at u0.67 ${Math.round((gl / n) * 100)}%`);
  }
}
console.log(out.join('\n'));
console.log(`bends ${bendZ.toFixed(0)} m of 3000 (${Math.round((bendZ / 3000) * 100)}%)`);
