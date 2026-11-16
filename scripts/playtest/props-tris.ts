// The visual lift's props lane: what the kit's geometry costs, built the way the game builds it, with the
// shared chamfer on and off (chamfer.ts). For every mountain: every set piece on the course (High's and Low's
// builds), the run's obstacles a kind, and the forest's sets a level of detail. Triangles, and build time.
//   npx tsx scripts/playtest/props-tris.ts            (all five mountains)
//   npx tsx scripts/playtest/props-tris.ts 3          (Sakura only)
import type { BufferGeometry } from 'three';
import { Mood } from '../../src/sim/chaos';
import { courseFor } from '../../src/sim/course';
import { MOUNTAINS } from '../../src/sim/mountains';
import { pinChamfer, withChamfer } from '../../src/render/chamfer';
import { forestSet, hasLod } from '../../src/render/flora';
import { mergePiece, pieceFor } from '../../src/render/landmarkKit';
import { SitePlan, pieceCtx } from '../../src/render/landmarks';
import { gateBeamGeometry, kickerLipGeometry, kmArchGeometry, obstacleGeometry } from '../../src/render/meshes';
import { getPalette } from '../../src/render/palette';

const pinned = <T>(f: () => T): T => { pinChamfer('off'); try { return f(); } finally { pinChamfer(null); } };
const tris = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const only = process.argv[2] !== undefined ? [Number(process.argv[2])] : MOUNTAINS.map((_, i) => i);
const KINDS = ['pine', 'charpine', 'blossom', 'rock', 'iceblock', 'spire', 'serac', 'basalt', 'lavarock', 'lantern', 'pillar', 'log', 'snowman'] as const;

for (const mi of only) {
  const m = MOUNTAINS[mi];
  const c = courseFor(m.seed);
  const p = getPalette(c.biome, Mood.None);
  const plan = new SitePlan(c, Mood.None);
  plan.flyTo(c.finishZ + 200);
  const byKind = new Map<string, number[]>();
  const t0 = performance.now();
  // High and Low, each with the chamfer pinned off and as the tier builds it.
  const levels: Array<[boolean, boolean]> = [
    [false, true],
    [false, false],
    [true, true],
    [true, false],
  ];
  const ms: number[] = [];
  for (const [li, [low, off]] of levels.entries()) {
    const s0 = performance.now();
    pinChamfer(off ? 'off' : null);
    for (const s of plan.planned) {
      const g = mergePiece(pieceFor(s.kind, pieceCtx(c, s, p, false, low)).steps.flatMap((f) => f()));
      const row = byKind.get(s.kind) ?? [0, 0, 0, 0, 0];
      row[li] += tris(g);
      row[4] += li === 0 ? 1 : 0;
      byKind.set(s.kind, row);
      g.dispose();
    }
    pinChamfer(null);
    ms.push(performance.now() - s0);
  }
  console.log(`\n${m.name} (${c.biome}): set pieces, triangles summed over the course (high off / high / low off / low), build ms ${ms.map((x) => x.toFixed(0)).join(' / ')}`);
  let tot = [0, 0, 0, 0];
  for (const [k, r] of [...byKind].sort((a, b) => b[1][1] - a[1][1])) {
    console.log(`  ${k.padEnd(11)} x${String(r[4]).padEnd(3)} ${r.slice(0, 4).map((x) => String(x).padStart(8)).join(' ')}  ${((r[1] / Math.max(1, r[0]) - 1) * 100).toFixed(1).padStart(6)}%  low ${((r[3] / Math.max(1, r[2]) - 1) * 100).toFixed(1)}%`);
    tot = tot.map((v, i) => v + r[i]);
  }
  console.log(`  ${'all'.padEnd(16)}${tot.map((x) => String(x).padStart(8)).join(' ')}  ${((tot[1] / tot[0] - 1) * 100).toFixed(1).padStart(6)}%  low ${((tot[3] / tot[2] - 1) * 100).toFixed(1)}%`);
  const ob: string[] = [];
  for (const k of KINDS) {
    const hi = withChamfer('full', () => obstacleGeometry(k, p, false, c.biome));
    const lo = withChamfer('low', () => obstacleGeometry(k, p, true, c.biome));
    const off = pinned(() => obstacleGeometry(k, p, false, c.biome));
    ob.push(`${k} ${tris(off)}>${tris(hi)}/${tris(lo)}`);
  }
  console.log(`  obstacles (off>high/low): ${ob.join(', ')}`);
  console.log(`  lip ${tris(pinned(() => kickerLipGeometry(p)))}>${tris(withChamfer('full', () => kickerLipGeometry(p)))}/${tris(withChamfer('low', () => kickerLipGeometry(p)))}, beam ${tris(pinned(() => gateBeamGeometry(p, c.biome === 'lantern')))}>${tris(withChamfer('full', () => gateBeamGeometry(p, c.biome === 'lantern')))}, km arch ${tris(pinned(() => kmArchGeometry(12, c.biome === 'lantern')))}>${tris(withChamfer('full', () => kmArchGeometry(12, c.biome === 'lantern')))}`);
  const fs: string[] = [];
  for (const set of ['a', 'b'] as const) for (const lod of [0, 1, 2] as const) {
    if (lod > 0 && !hasLod(c.biome, set)) continue;
    const g = forestSet(c.biome, p, set, lod);
    const st = g.userData.variantStarts as number[];
    fs.push(`${set}${lod}: ${st.slice(1).map((v, i) => (v - st[i]) / 3).join('+')}`);
  }
  console.log(`  forest: ${fs.join(', ')}  (${(performance.now() - t0).toFixed(0)} ms in all)`);
}
