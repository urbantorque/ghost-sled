// Triangle counts for the garage's hats and the lantern effects (round 6 feel lane): npx tsx scripts/playtest/garage-tris.ts
import { HATS } from '../../src/game/garage';
import { ghostRiderGeometry, riderHeadGeometry, sledSeat } from '../../src/render/meshes';
import { gateGeometry } from '../../src/render/skygates';

const tris = (g: { getAttribute(n: string): { count: number }; index: { count: number } | null }) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
for (const h of HATS) console.log(`hat ${h.id}: ${tris(riderHeadGeometry(false, h.id))} triangles`);
console.log(`sky gate (ring and halo): ${tris(gateGeometry())} triangles`);
console.log(`dash after-image (one): ${tris(ghostRiderGeometry(false, sledSeat(0)))} triangles`);
