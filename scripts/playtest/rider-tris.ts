// Triangle counts for the hero and a ghost, by build (round 7 hero lane): npx tsx scripts/playtest/rider-tris.ts
import { ghostRiderGeometry, riderArmGeometry, riderHeadGeometry, riderTorsoGeometry, sledGeometryFor, sledSeat } from '../../src/render/meshes';

const tris = (g: { getAttribute(n: string): { count: number }; index: { count: number } | null }) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
for (const lite of [false, true]) {
  const head = tris(riderHeadGeometry(false, 'beanie', lite));
  const torso = tris(riderTorsoGeometry(false, false, lite));
  const arm = tris(riderArmGeometry({ bend: 0, lite }));
  const sled = tris(sledGeometryFor(0, lite));
  console.log(`hero (${lite ? 'lite, Low' : 'full'}): head ${head}, coat and legs ${torso}, arms 2 x ${arm}, sled ${sled}: ${head + torso + 2 * arm + sled} triangles in 5 draws (plus the scarf, 76)`);
}
console.log(`ghost body: ${tris(ghostRiderGeometry(false, sledSeat(0)))} triangles before the weld`);
