import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, LatheGeometry, OctahedronGeometry, Vector2 } from 'three';
import { SNOW, dropSlivers, merge, part, shade, type Lod } from './flora';

// The Old Run's forest (round 9, notes/r9-oldrun-world.md): an old wood of bare winter trees round the track, never the
// five's spruces. The blind sort put the groundwork's pines with the five's forest (notes/r9-concepts.md), so the Old
// Run's trees are another kind of thing in silhouette: tall straight trunks, limbs that fork, and a lace of twigs in
// fans at their ends where a spruce has a cone of boughs. Two kinds: old beeches, smooth grey trunks under wide
// spreading crowns, and birches, white trunks ringed in dark under narrow upswept crowns. Bark stays cool (grey-violet,
// a plum twig haze), so the low late sun is what warms them, and snow lies along the tops of the limbs and in the
// crooks. Each is built at three levels (forestSteps): the full tree, Low's (fewer branches and fans), and the far one
// (trunk, limbs and big fans), all the same silhouette, so a tree reads the same at every distance (ART.md 12).

type V3 = [number, number, number];

let state = 1;
function rnd(): number {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 4294967296;
}

/** Smooth beech bark (a cool silver-grey) and its shade, a beech's twig haze, a birch's white bark, its dark rings and
 *  its red-plum twigs. */
const BEECH = new Color('#6E6A80');
const BEECH_DARK = new Color('#4A4560');
const BEECH_TWIG = new Color('#7C6C84');
const BIRCH = new Color('#E6E0DA');
const BIRCH_RING = new Color('#34303E');
const BIRCH_TWIG = new Color('#86627A');

/** A limb from a to b, tapering r0 to r1 (no caps: a forest holds a few thousand). */
function limb(a: V3, b: V3, r0: number, r1: number, col: Color, sides: number): BufferGeometry {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  const g = new CylinderGeometry(r1, r0, len, sides, 1, true);
  g.translate(0, len / 2, 0);
  g.rotateZ(-Math.atan2(Math.hypot(dx, dz), dy));
  g.rotateY(-Math.atan2(dz, dx));
  g.translate(a[0], a[1], a[2]);
  return part(g, col);
}

/** A spray of twigs at a branch's end: thin spikes fanning out along the branch (`n` of them; a birch's droop with
 *  `down`), so the crown is a lace with the sky through it, never a clump of foliage. */
function sprig(at: V3, dir: V3, len: number, col: Color, down: number, n: number, out: BufferGeometry[]): void {
  for (let k = 0; k < n; k++) {
    const yaw = Math.atan2(dir[0], dir[2]) + (k / Math.max(1, n - 1) - 0.5) * 1.5 + (rnd() - 0.5) * 0.4;
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir[1]))) * 0.7 + (rnd() - 0.5) * 0.7 - down * 0.9;
    const l = len * (0.65 + 0.45 * rnd());
    const d: V3 = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    out.push(limb(at, [at[0] + d[0] * l, at[1] + d[1] * l, at[2] + d[2] * l], 0.035 + 0.012 * len, 0.006, col, 3));
  }
}

/** The haze of fine twigs round a branch's end, a step paler than its spikes: a thin faceted lens laid along the
 *  branch, its top paler where the light falls on it. What a bare crown is from further off than its twigs. */
function fan(at: V3, dir: V3, r: number, col: Color, down = 0): BufferGeometry {
  const yaw = Math.atan2(dir[0], dir[2]);
  const g = part(new OctahedronGeometry(r, 0), col, { pos: [at[0] + dir[0] * r * 0.45, at[1] + dir[1] * r * 0.3 - down * r * 0.35, at[2] + dir[2] * r * 0.45], rot: [0.25 * (rnd() - 0.5), yaw, 0.3 * (rnd() - 0.5)], scale: [0.7 + 0.25 * rnd(), 0.3 + 0.3 * down, 1.15 + 0.25 * rnd()], jitter: r * 0.2 });
  // The upper facets take a little of the sky, the lower a little shade: three values, as a gouache haze.
  const pos = g.getAttribute('position') as BufferAttribute;
  const c = g.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 - at[1];
    const k = y > r * 0.1 ? 1.16 : y < -r * 0.15 ? 0.82 : 1;
    for (let j = i; j < i + 3; j++) c.setXYZ(j, c.getX(j) * k, c.getY(j) * k, c.getZ(j) * k);
  }
  return g;
}

/** Snow along the top of a limb from a to b: a thinner rod laid on it, only where the limb lies flat enough to hold it. */
function snowOn(a: V3, b: V3, r: number, sides: number): BufferGeometry | null {
  const dy = b[1] - a[1];
  const run = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (dy > run * 2.6) return null;
  const up = r * 0.7;
  return limb([a[0], a[1] + up, a[2]], [b[0], b[1] + up * 0.6, b[2]], r * 0.85, r * 0.35, SNOW, Math.max(3, sides - 1));
}

/** The hollow the snow leaves round a trunk: a soft ring of the snow's shade under a lit rim. */
function well(r: number, segs: number): BufferGeometry {
  const prof = [new Vector2(r * 1.6, -0.3), new Vector2(r, 0.1), new Vector2(0.15, -0.05)];
  const g = new LatheGeometry(prof, segs).toNonIndexed();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const gp = g.getAttribute('position') as BufferAttribute;
  const col = new Float32Array(gp.count * 3);
  const dip = SNOW.clone().lerp(new Color('#8C96D2'), 0.45);
  for (let f = 0; f < gp.count; f += 3) {
    let rm = 0;
    for (let j = f; j < f + 3; j++) rm += Math.hypot(gp.getX(j), gp.getZ(j)) / 3;
    const c = rm < r * 0.85 ? dip : SNOW;
    for (let j = f; j < f + 3; j++) col.set([c.r, c.g, c.b], j * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

interface BareSpec {
  seed: number;
  /** The leader's top (metres), the trunk's foot radius, and where the limbs start (a share of the height). */
  height: number;
  trunkR: number;
  from: number;
  /** Primary limbs, their reach (a share of the height) and their rise (radians over the level). */
  limbs: number;
  reach: number;
  rise: [number, number];
  /** Fans a branch end, their size, and how far they hang. */
  fanR: number;
  hang: number;
  bark: Color;
  barkDark: Color;
  twig: Color;
  /** A birch's dark rings up its white trunk. */
  rings: boolean;
  /** A second stem from the foot (a coppiced birch). */
  twin: boolean;
}

function spec(kind: 'beech' | 'oldbeech' | 'birch' | 'twinbirch'): BareSpec {
  switch (kind) {
    case 'beech':
      return { seed: 9101, height: 10.5, trunkR: 0.34, from: 0.36, limbs: 6, reach: 0.42, rise: [0.45, 0.85], fanR: 1.05, hang: 0, bark: BEECH, barkDark: BEECH_DARK, twig: BEECH_TWIG, rings: false, twin: false };
    case 'oldbeech':
      // A storm-thinned veteran: lower and broader, a limb lost, a stub where it was.
      return { seed: 9137, height: 9, trunkR: 0.42, from: 0.3, limbs: 5, reach: 0.5, rise: [0.3, 0.7], fanR: 1.15, hang: 0.1, bark: BEECH.clone().multiplyScalar(0.94), barkDark: BEECH_DARK, twig: BEECH_TWIG.clone().multiplyScalar(0.95), rings: false, twin: false };
    case 'birch':
      return { seed: 9203, height: 11, trunkR: 0.2, from: 0.48, limbs: 7, reach: 0.27, rise: [0.95, 1.25], fanR: 0.82, hang: 0.7, bark: BIRCH, barkDark: BIRCH_RING, twig: BIRCH_TWIG, rings: true, twin: false };
    case 'twinbirch':
      return { seed: 9241, height: 9, trunkR: 0.16, from: 0.45, limbs: 4, reach: 0.25, rise: [0.95, 1.3], fanR: 0.75, hang: 0.8, bark: BIRCH, barkDark: BIRCH_RING, twig: BIRCH_TWIG, rings: true, twin: true };
  }
}

/** One stem: its trunk, rings, limbs, branches, fans and snow into `out`, standing at (x0, z0) and leaning by (lx, lz). */
function stem(s: BareSpec, lod: Lod, x0: number, z0: number, lx: number, lz: number, k: number, out: BufferGeometry[]): void {
  const H = s.height * k;
  const R = s.trunkR * k;
  const sides = lod === 0 ? 6 : lod === 1 ? 5 : 4;
  const lsides = lod === 0 ? 5 : 4;
  // The trunk in two lengths with a slight kink, then the leader up into the crown.
  const mid: V3 = [x0 + lx * H * 0.45 + (rnd() - 0.5) * 0.25, H * 0.5, z0 + lz * H * 0.45 + (rnd() - 0.5) * 0.25];
  const top: V3 = [x0 + lx * H + (rnd() - 0.5) * 0.4, H, z0 + lz * H + (rnd() - 0.5) * 0.4];
  out.push(limb([x0, -0.5, z0], mid, R, R * 0.7, s.bark, sides));
  out.push(limb(mid, top, R * 0.7, R * 0.16, s.bark, sides));
  // A birch's dark rings: short bands up the white trunk, never even.
  if (s.rings && lod < 2) {
    for (let y = 0.5 + rnd() * 0.6; y < H * 0.62; y += 0.55 + rnd() * 1.1) {
      const t = y / H;
      const cx = x0 + (mid[0] - x0) * Math.min(1, t * 2);
      const cz = z0 + (mid[2] - z0) * Math.min(1, t * 2);
      const r = R * (1 - t * 0.55) * 1.03;
      out.push(part(new CylinderGeometry(r, r, 0.08 + rnd() * 0.12, sides, 1, true), s.barkDark, { pos: [cx, y, cz], rot: [0, rnd() * 3, 0] }));
    }
    // The foot of an old birch is dark and fissured.
    out.push(limb([x0, -0.4, z0], [x0 + lx * 1.2, 0.9, z0 + lz * 1.2], R * 1.04, R * 0.98, s.barkDark, sides));
  }
  const ends: Array<[V3, V3, number]> = [];
  const n = s.limbs;
  const a0 = rnd() * 6.283;
  for (let i = 0; i < n; i++) {
    // Lower limbs reach further; higher ones climb.
    const t = s.from + ((1 - s.from) * 0.82 * i) / Math.max(1, n - 1) + (rnd() - 0.5) * 0.06;
    const y = H * t;
    const ft = (y / H - 0.5) / 0.5;
    const along: V3 = ft <= 0 ? [x0 + (mid[0] - x0) * (y / (H * 0.5)), y, z0 + (mid[2] - z0) * (y / (H * 0.5))] : [mid[0] + (top[0] - mid[0]) * ft, y, mid[2] + (top[2] - mid[2]) * ft];
    const az = a0 + (i * 2.4) + (rnd() - 0.5) * 0.6;
    const rise = s.rise[0] + (s.rise[1] - s.rise[0]) * (0.4 * rnd() + 0.6 * (i / Math.max(1, n - 1)));
    const reach = H * s.reach * (1.15 - 0.5 * (i / Math.max(1, n - 1))) * (0.85 + 0.3 * rnd());
    const dir: V3 = [Math.cos(az) * Math.cos(rise), Math.sin(rise), Math.sin(az) * Math.cos(rise)];
    // A limb bends as it goes: out first, then up toward the light.
    const elbow: V3 = [along[0] + dir[0] * reach * 0.55, along[1] + dir[1] * reach * 0.42, along[2] + dir[2] * reach * 0.55];
    const tip: V3 = [elbow[0] + dir[0] * reach * 0.45, elbow[1] + (dir[1] * 0.6 + 0.3) * reach * 0.45, elbow[2] + dir[2] * reach * 0.45];
    const lr = R * (0.5 - 0.15 * (i / n));
    out.push(limb(along, elbow, lr, lr * 0.62, s.bark, lsides));
    out.push(limb(elbow, tip, lr * 0.62, lr * 0.25, s.bark, lsides));
    if (lod < 2) {
      const sn = snowOn(along, elbow, lr, lsides);
      if (sn) out.push(sn);
    }
    // A stub where an old limb broke (the veteran).
    if (s.seed === 9137 && i === 1) {
      out.pop();
      out.pop();
      out.push(limb(along, [along[0] + dir[0] * 0.9, along[1] + 0.2, along[2] + dir[2] * 0.9], lr, lr * 0.8, s.barkDark, lsides));
      continue;
    }
    ends.push([tip, dir, 1]);
    // Branches off the elbow and toward the tip.
    const nb = lod === 0 ? 3 : lod === 1 ? 2 : 0;
    for (let j = 0; j < nb; j++) {
      const from: V3 = j === 0 ? elbow : [elbow[0] + (tip[0] - elbow[0]) * 0.55, elbow[1] + (tip[1] - elbow[1]) * 0.55, elbow[2] + (tip[2] - elbow[2]) * 0.55];
      const ba = az + (j % 2 === 0 ? 0.75 : -0.75) + (rnd() - 0.5) * 0.4;
      const br = rise + 0.25 + rnd() * 0.3;
      const bl = reach * (0.32 + 0.18 * rnd());
      const bd: V3 = [Math.cos(ba) * Math.cos(br), Math.sin(br), Math.sin(ba) * Math.cos(br)];
      const bt: V3 = [from[0] + bd[0] * bl, from[1] + bd[1] * bl, from[2] + bd[2] * bl];
      out.push(limb(from, bt, lr * 0.4, lr * 0.14, s.bark, 4));
      if (lod === 0) {
        const sn = snowOn(from, bt, lr * 0.4, 4);
        if (sn) out.push(sn);
      }
      ends.push([bt, bd, 0.7]);
    }
  }
  // The crown's lace: a spray of twig spikes at every end, and the leader's own. The full tree is spikes alone, so its
  // shadow under the low sun is lace too (with a haze of finer twigs it laid a solid dark wedge across the far wall,
  // which a blind critic read as a slab of rock on the bank). Low's tree (no shadow map) and the far one, where the
  // spikes would be under a pixel, keep a thin haze of the finer twigs a step paler: what a bare crown is from there.
  ends.push([top, [0, 1, 0], 0.85]);
  const spikes = lod === 0 ? (s.twin ? 3 : 4) : lod === 1 ? (s.twin ? 1 : 2) : 0;
  const hk = lod === 2 ? 1.1 : 0.62;
  for (const [at, d, w] of ends) {
    const tw = s.twig.clone().multiplyScalar(0.94 + 0.12 * rnd());
    if (spikes > 0) sprig(at, d, s.fanR * k * w * 1.5, shade(tw, 0.8), s.hang, spikes, out);
    if (lod === 0 || (lod === 1 && w < 0.75 && rnd() < 0.5)) continue;
    if (lod === 2 && w < 0.75) continue;
    out.push(fan(at, d, s.fanR * k * w * hk * (0.85 + 0.3 * rnd()), tw, s.hang));
  }
  // Snow in the crook where the crown starts.
  if (lod < 2) out.push(part(new OctahedronGeometry(R * 1.6, 0), SNOW, { pos: [x0 + lx * H * s.from, H * s.from + R * 0.6, z0 + lz * H * s.from], scale: [1, 0.35, 1], jitter: 0.03 }));
}

/** A bare tree of the Old Run's wood: `kind` and the build for its distance (flora.ts Lod). */
export function bareTreeGeometry(kind: 'beech' | 'oldbeech' | 'birch' | 'twinbirch', lod: Lod = 0): BufferGeometry {
  const s = spec(kind);
  state = s.seed;
  const parts: BufferGeometry[] = [];
  const lean = s.seed === 9137 ? 0.05 : 0.015;
  stem(s, lod, 0, 0, lean, lean * 0.4, 1, parts);
  if (s.twin) stem(s, lod, 0.45, 0.2, 0.09, 0.05, 0.78, parts);
  parts.push(well(s.trunkR * (s.twin ? 3.2 : 2.6), lod === 2 ? 5 : 7));
  return dropSlivers(merge(parts));
}
