import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  LatheGeometry,
  Matrix4,
  MeshDepthMaterial,
  OctahedronGeometry,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BiomeId } from '../sim/mountains';
import { basaltGeometry, blossomGeometry, charPineGeometry, seracGeometry, spireGeometry } from './meshes';
import { Palette } from './palette';

// Forest variety without extra draw calls. A batch's geometry holds several variants merged into one
// mesh, each vertex tagged with its variant (aVar); each instance picks one (aPick, per instance) and
// the vertex shader collapses every other variant to a point, so its triangles draw nothing. One
// InstancedMesh then shows two or more different trees (or, for the bank dressing, a whole kit of
// pieces) in a single draw. The same parts style as meshes.ts: flat-shaded, vertex-coloured.

// ---------------------------------------------------------------- shared helpers (as meshes.ts)

let seedState = 12345;
function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 4294967296;
}
export function reseed(s: number): void {
  seedState = s >>> 0;
}

export interface PartOpts {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  jitter?: number;
}

/** One flat-shaded, vertex-coloured part (as meshes.ts part()). */
export function part(geo: BufferGeometry, color: Color | string, o: PartOpts = {}): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (o.jitter) {
    const p = g.getAttribute('position') as BufferAttribute;
    // Shared vertices keyed by position to the millimetre (a number key: string keys cost most of
    // a part's build time).
    const map = new Map<number, [number, number, number]>();
    for (let i = 0; i < p.count; i++) {
      const key = (Math.round(p.getX(i) * 1000) + 49999) * 1e10 + (Math.round(p.getY(i) * 1000) + 49999) * 1e5 + (Math.round(p.getZ(i) * 1000) + 49999);
      let d = map.get(key);
      if (!d) {
        d = [(rnd() - 0.5) * o.jitter, (rnd() - 0.5) * o.jitter, (rnd() - 0.5) * o.jitter];
        map.set(key, d);
      }
      p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
    }
  }
  const m = new Matrix4().compose(
    new Vector3(...(o.pos ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(o.rot ?? [0, 0, 0]))),
    new Vector3(...(o.scale ?? [1, 1, 1])),
  );
  g.applyMatrix4(m);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const col = color instanceof Color ? color : new Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

/** A part with smooth normals (snow: broad, soft, rounded; ART.md section 3). */
export function softPart(geo: BufferGeometry, color: Color | string, o: PartOpts = {}): BufferGeometry {
  const m = new Matrix4().compose(
    new Vector3(...(o.pos ?? [0, 0, 0])),
    new Quaternion().setFromEuler(new Euler(...(o.rot ?? [0, 0, 0]))),
    new Vector3(...(o.scale ?? [1, 1, 1])),
  );
  geo.applyMatrix4(m);
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  const g = geo.index ? geo.toNonIndexed() : geo;
  const col = color instanceof Color ? color : new Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = col.r;
    arr[i * 3 + 1] = col.g;
    arr[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new BufferAttribute(arr, 3));
  return g;
}

export function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('merge failed');
  g.computeBoundingSphere();
  return g;
}

export function shade(c: Color, k: number): Color {
  return c.clone().multiplyScalar(k);
}

/** Value gradient up a part plus a small per-facet step (as meshes.ts paint()). */
export function paint(g: BufferGeometry, y0: number, y1: number, k0: number, k1: number, facet: number): BufferGeometry {
  const pos = g.getAttribute('position') as BufferAttribute;
  const col = g.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    const f = 1 + (rnd() - 0.5) * facet;
    for (let j = i; j < i + 3 && j < pos.count; j++) {
      const t = Math.max(0, Math.min(1, (pos.getY(j) - y0) / (y1 - y0)));
      const k = (k0 + (k1 - k0) * t) * f;
      col.setXYZ(j, col.getX(j) * k, col.getY(j) * k, col.getZ(j) * k);
    }
  }
  return g;
}

/** One hexagonal ice crystal standing on `pos`, leaning by `rot` (as meshes.ts crystal()). */
export function crystal(col: Color, r: number, h: number, pos: [number, number, number], rot: [number, number, number]): BufferGeometry {
  const tip = r * 1.7;
  const g = merge([part(new CylinderGeometry(r * 0.9, r, h, 6), col, { pos: [0, h / 2, 0] }), part(new ConeGeometry(r * 0.9, tip, 6), shade(col, 1.12), { pos: [0, h + tip / 2, 0] })]);
  return g.applyMatrix4(new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(1, 1, 1)));
}

export const SNOW = new Color('#F4F7FF');
/** Weathered grey-violet bark: hazards and dead wood are never warm (ART.md section 1, as the logs). */
export const BARK = new Color('#4F4459');
export const BARK_DARK = new Color('#3A3144');
const WOOD = new Color('#8A5A3C');

// ---------------------------------------------------------------- variant machinery

/** Merges variants into one geometry, each vertex tagged with its variant's index (aVar). */
export function variantSet(list: BufferGeometry[]): BufferGeometry {
  const tagged = list.map((g, i) => {
    const n = g.getAttribute('position').count;
    const keep = new BufferGeometry();
    keep.setAttribute('position', g.getAttribute('position'));
    keep.setAttribute('normal', g.getAttribute('normal'));
    keep.setAttribute('color', g.getAttribute('color'));
    keep.setAttribute('aVar', new BufferAttribute(new Float32Array(n).fill(i), 1));
    return keep;
  });
  return merge(tagged);
}

/** A batch's own view of a shared variant set: the same vertex buffers, plus its per-instance pick. */
export function variantView(src: BufferGeometry, pick: InstancedBufferAttribute): BufferGeometry {
  const g = new BufferGeometry();
  for (const name of ['position', 'normal', 'color', 'aVar']) g.setAttribute(name, src.getAttribute(name));
  g.setAttribute('aPick', pick);
  g.boundingSphere = src.boundingSphere;
  return g;
}

// Another variant's vertex leaves at once, every corner of its triangles at one point outside the
// clip volume: nothing rasterizes, and it skips the rest of the shader (a variant's vertices are
// contiguous, so the GPU's vertex groups stay coherent).
const COLLAPSE = /* glsl */ `#include <begin_vertex>
  if (abs(aVar - aPick) > 0.5) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }`;
const VARIANT_ATTRS = 'attribute float aVar;\nattribute float aPick;\n';

/** Makes a toon material draw one variant per instance (the others collapse to a point). A batch
 *  whose geometry has no aVar or aPick reads both as 0, so it draws whole, as before. */
export function variantMaterial(mat: ShaderMaterial): ShaderMaterial {
  if (!mat.vertexShader.includes('#include <begin_vertex>')) throw new Error('variantMaterial: no begin_vertex');
  mat.vertexShader = VARIANT_ATTRS + mat.vertexShader.replace('#include <begin_vertex>', COLLAPSE);
  return mat;
}

let depthMat: MeshDepthMaterial | null = null;
/** The shadow pass's depth material for variant batches: a wall tree casts only its own shadow. */
export function variantDepthMaterial(): MeshDepthMaterial {
  if (depthMat) return depthMat;
  const m = new MeshDepthMaterial();
  m.onBeforeCompile = (s) => {
    s.vertexShader = VARIANT_ATTRS + s.vertexShader.replace('#include <begin_vertex>', COLLAPSE);
  };
  m.customProgramCacheKey = () => 'gs-variant-depth';
  depthMat = m;
  return m;
}

// ---------------------------------------------------------------- tree variants

interface BoughTier {
  /** Height of the tier's tip, its depth (tip to bough ends) and its reach (radius at the bough ends). */
  top: number;
  h: number;
  r: number;
}

/** How a bough pine is built: its tiers, its trunk, how far down each tier the snow lies (0..1 of the
 *  upper face), and how many clumps of snow sit out on the bough tips. */
interface BoughSpec {
  seed: number;
  tiers: BoughTier[];
  trunk: number;
  trunkR: number;
  snow: number;
  clumps: number;
  /** Value multiplier on the needles (the young trees are a step lighter, the heavy ones darker). */
  tone: number;
}

/** Bough segments round a tier: even ones are bough tips, odd ones the gaps between them (four
 *  boughs; the small top tier has three). */
const BOUGH_SEGS = 8;

/** One drooping tier of boughs, faceted: a lathe from the tip out over the shoulder to the bough ends
 *  and back in underneath, its outer ring scalloped into hanging bough tips with gaps between
 *  them. Coloured per facet: the upper face carries a snow cap whose lower edge is ragged (deeper on
 *  the boughs, shallower in the gaps), snow runs out along the tops of the boughs, the needles darken
 *  toward the skirt, and the underside is the darkest value on the tree. */
function boughTier(t: BoughTier, needle: Color, under: Color, snowK: number, twist: number, segs: number): BufferGeometry {
  const { top, h, r } = t;
  // Profile: tip, shoulder, bough end (the droop), underside back toward the trunk.
  const prof = [
    new Vector2(0.001, top),
    new Vector2(r * 0.5, top - h * 0.46),
    new Vector2(r, top - h),
    new Vector2(r * 0.26, top - h * 0.7),
  ];
  const lathe = new LatheGeometry(prof, segs);
  const pos = lathe.getAttribute('position') as BufferAttribute;
  const P = prof.length;
  for (let i = 0; i <= segs; i++) {
    const seg = i % segs;
    const tip = seg % 2 === 0;
    // The seam vertex repeats the first, so it takes the same jitter.
    reseed(9000 + Math.round(twist * 1000) + seg * 7);
    const jr = 0.92 + rnd() * 0.16;
    const jy = (rnd() - 0.5) * 0.12 * h;
    for (let j = 1; j < P; j++) {
      const k = i * P + j;
      let x = pos.getX(k);
      let y = pos.getY(k);
      let z = pos.getZ(k);
      if (j === 1) {
        // The shoulder: a little lumpy, so the snow line wanders.
        x *= jr;
        z *= jr;
        y += jy;
      } else {
        // Bough tips hang lower and reach further; the gaps between them tuck in and up.
        const s = (tip ? 1.04 : 0.74) * jr;
        x *= s;
        z *= s;
        y += (tip ? -0.13 : 0.09) * h * (j === 2 ? 1 : 0.6);
      }
      const ca = Math.cos(twist);
      const sa = Math.sin(twist);
      pos.setXYZ(k, x * ca - z * sa, y, x * sa + z * ca);
    }
  }
  const g = lathe.toNonIndexed();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const gp = g.getAttribute('position') as BufferAttribute;
  const gn = g.getAttribute('normal') as BufferAttribute;
  const col = new Float32Array(gp.count * 3);
  const c = new Color();
  for (let f = 0; f < gp.count; f += 3) {
    const ny = gn.getY(f);
    let ym = 0;
    let rm = 0;
    for (let j = f; j < f + 3; j++) {
      ym += gp.getY(j) / 3;
      rm += Math.hypot(gp.getX(j), gp.getZ(j)) / 3;
    }
    // 0 at the tip, 1 at the bough ends.
    const down = Math.max(0, Math.min(1, (top - ym) / h));
    const facet = 1 + (rnd() - 0.5) * 0.16;
    if (ny < -0.05) {
      // The underside, in its own shade: the darkest value on the tree, so each tier stands off the next.
      c.copy(under).multiplyScalar(facet);
    } else if (down < snowK * (0.75 + 0.5 * rnd()) || (ny > 0.62 && rm > r * 0.6 && rnd() < 0.7 * snowK + 0.2)) {
      // The snow cap and the snow lying along the bough tops (a step cooler where it hangs lower).
      c.copy(SNOW).multiplyScalar((1 - down * 0.12) * (0.97 + rnd() * 0.05));
    } else {
      // Needles: lighter up the tier, darker toward its skirt (painted value structure).
      c.copy(needle).multiplyScalar((1.08 - down * 0.32) * facet);
    }
    for (let j = f; j < f + 3; j++) col.set([c.r, c.g, c.b], j * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

/** A tree well: the hollow the snow leaves round a trunk under the boughs, with a soft rim, faceted;
 *  its floor in the snow's shade (it reads as a dip even in full sun), the rim lit snow that runs on
 *  under the slope. */
function treeWell(r: number, shadeC: Color): BufferGeometry {
  const prof = [new Vector2(r * 1.45, -0.3), new Vector2(r, 0.12), new Vector2(0.2, -0.04)];
  const g = new LatheGeometry(prof, 6).toNonIndexed();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const gp = g.getAttribute('position') as BufferAttribute;
  const col = new Float32Array(gp.count * 3);
  const dip = SNOW.clone().lerp(shadeC, 0.55);
  for (let f = 0; f < gp.count; f += 3) {
    let rm = 0;
    for (let j = f; j < f + 3; j++) rm += Math.hypot(gp.getX(j), gp.getZ(j)) / 3;
    const c = rm < r * 0.8 ? dip : SNOW;
    for (let j = f; j < f + 3; j++) col.set([c.r, c.g, c.b], j * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
  return g;
}

/** A painterly spruce (the forest's pine, ART.md section 3): tiers of drooping, scalloped boughs
 *  instead of stacked cones, each with a ragged snow cap, snow along the bough tops and clumps out on
 *  the tips, a dark underside under every tier, and a tree well at its foot. Faceted and flat-shaded,
 *  so the low sun splits it into a lit side and a cool shade side. About the old pine's footprint (it
 *  stands where that one stood). */
function boughPine(p: Palette, s: BoughSpec): BufferGeometry {
  reseed(s.seed);
  const needle = shade(p.tall, s.tone);
  const under = shade(p.tallDark.clone().lerp(p.tall, 0.3), 0.62 * s.tone);
  const parts: BufferGeometry[] = [part(new CylinderGeometry(s.trunkR * 0.65, s.trunkR, s.trunk, 5, 1, true), WOOD, { pos: [0, s.trunk / 2, 0] })];
  s.tiers.forEach((t, i) => {
    const twist = rnd() * 6.28;
    const top = i === s.tiers.length - 1 && i > 2;
    parts.push(boughTier(t, i % 2 ? shade(needle, 0.9) : needle, under, s.snow * (1 - i * 0.08), twist, top ? 6 : BOUGH_SEGS));
    // Snow clumps out on bough tips of the lower tiers (placed as the lathe lays its tips out, then
    // turned by the tier's twist).
    if (i < 2) {
      for (let k = 0; k < s.clumps; k++) {
        const phi = ((k * 2 + i * 2) * Math.PI * 2) / BOUGH_SEGS;
        const rr = t.r * 0.9;
        const x0 = Math.sin(phi) * rr;
        const z0 = Math.cos(phi) * rr;
        const x = x0 * Math.cos(twist) - z0 * Math.sin(twist);
        const z = x0 * Math.sin(twist) + z0 * Math.cos(twist);
        parts.push(part(new OctahedronGeometry(0.2 + 0.05 * rnd(), 0), SNOW, { pos: [x, t.top - t.h * 1.06 + 0.12, z], scale: [1.5, 0.62, 1.2], rot: [0, Math.atan2(x, z), 0], jitter: 0.05 }));
      }
    }
  });
  parts.push(treeWell(Math.max(0.7, s.tiers[0].r * 0.62), p.snowShade));
  return merge(parts);
}

/** The forest's spruce, in its plain and blossom-ridge colourings (variant reseeds it). */
export function boughPineGeometry(p: Palette, variant = 0): BufferGeometry {
  return boughPine(p, {
    seed: 501 + variant,
    trunk: 1.3,
    trunkR: 0.24,
    snow: 0.42,
    clumps: 1,
    tone: 1,
    tiers: [
      { top: 2.95, h: 2.05, r: 1.5 },
      { top: 3.9, h: 1.85, r: 1.18 },
      { top: 4.75, h: 1.55, r: 0.88 },
      { top: 5.5, h: 1.2, r: 0.56 },
    ],
  });
}

/** The run's own pine hazard in the bough style (for meshes.ts obstacleGeometry 'pine'): the forest
 *  spruce with less snow on it, so it stays the dark, hard silhouette a hazard must be (ART.md section
 *  1), and a bottom tier as wide as the old pine's (1.35 m; colliders are 0.7 to 0.95 m), so it looks
 *  at least as wide as it collides. */
export function hazardPineGeometry(p: Palette): BufferGeometry {
  return boughPine(p, {
    seed: 511,
    trunk: 1.3,
    trunkR: 0.24,
    snow: 0.3,
    clumps: 1,
    tone: 0.96,
    tiers: [
      { top: 2.95, h: 2.05, r: 1.45 },
      { top: 3.9, h: 1.85, r: 1.15 },
      { top: 4.75, h: 1.55, r: 0.86 },
      { top: 5.5, h: 1.2, r: 0.55 },
    ],
  });
}

/** A snow-laden spruce: broad, a little shorter, its boughs bowed under deep caps and clumps. */
export function heavyPineGeometry(p: Palette): BufferGeometry {
  return boughPine(p, {
    seed: 121,
    trunk: 1.1,
    trunkR: 0.27,
    snow: 0.7,
    clumps: 2,
    tone: 0.9,
    tiers: [
      { top: 2.75, h: 2.1, r: 1.68 },
      { top: 3.7, h: 1.9, r: 1.32 },
      { top: 4.5, h: 1.55, r: 0.95 },
      { top: 5.15, h: 1.15, r: 0.58 },
    ],
  });
}

/** A young spruce: three small tiers on a thin stem, about half a grown tree's height. */
export function youngPineGeometry(p: Palette): BufferGeometry {
  return boughPine(p, {
    seed: 131,
    trunk: 0.7,
    trunkR: 0.12,
    snow: 0.36,
    clumps: 1,
    tone: 1.06,
    tiers: [
      { top: 1.95, h: 1.45, r: 0.95 },
      { top: 2.65, h: 1.2, r: 0.68 },
      { top: 3.2, h: 0.85, r: 0.4 },
    ],
  });
}

/** A dead snag: a bare, broken grey trunk with a few stub branches, snow on its stubs and foot. */
export function snagGeometry(): BufferGeometry {
  reseed(141);
  const trunk = part(new CylinderGeometry(0.1, 0.27, 4.2, 5, 3), BARK, { pos: [0, 2.1, 0], jitter: 0.07 });
  const parts: BufferGeometry[] = [paint(trunk, 0, 4.2, 0.8, 1.15, 0.2)];
  // The splintered top.
  parts.push(part(new ConeGeometry(0.13, 0.55, 4), BARK_DARK, { pos: [0.04, 4.42, 0], rot: [0, 0, 0.35] }));
  for (let i = 0; i < 5; i++) {
    const y = 1.6 + i * 0.5;
    const a = rnd() * 6.28;
    const len = 1.25 - i * 0.16;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    parts.push(part(new CylinderGeometry(0.03, 0.06, len, 4), BARK_DARK, { pos: [ca * len * 0.42, y + 0.18, sa * len * 0.42], rot: [0, -a, -1.05] }));
    if (i % 2 === 0) parts.push(part(new BoxGeometry(len * 0.5, 0.07, 0.12), SNOW, { pos: [ca * len * 0.42, y + 0.44, sa * len * 0.42], rot: [0, -a, -0.5] }));
  }
  parts.push(part(new IcosahedronGeometry(0.7, 0), SNOW, { pos: [0, 0.04, 0], scale: [1.3, 0.32, 1.2], jitter: 0.1 }));
  return merge(parts);
}

/** Frostfang: a snapped spire with its twin beside it and the broken tip lying in the snow. */
export function brokenSpireGeometry(p: Palette): BufferGeometry {
  reseed(616);
  return merge([
    part(new CylinderGeometry(0.28, 0.95, 3.6, 5, 2), p.tall, { pos: [0, 1.8, 0], jitter: 0.2 }),
    part(new ConeGeometry(0.34, 0.55, 5), shade(p.tall, 1.15), { pos: [0.05, 3.85, 0], rot: [0.2, 0, 0.3], jitter: 0.08 }),
    part(new ConeGeometry(0.6, 4.4, 5, 1), p.tallDark, { pos: [0.8, 2.2, -0.25], rot: [0, 0, -0.12], jitter: 0.12 }),
    part(new ConeGeometry(0.32, 1.7, 5), shade(p.tall, 1.1), { pos: [-1.0, 0.32, 0.6], rot: [0.3, 0, 1.45] }),
    part(new IcosahedronGeometry(1.25, 0), SNOW, { pos: [0, 0.05, 0], scale: [1.3, 0.28, 1.2], jitter: 0.18 }),
  ]);
}

/** Frostfang: a low mound of leaning crystals out of a dark boulder. */
export function iceMoundGeometry(p: Palette): BufferGeometry {
  reseed(626);
  return merge([
    part(new IcosahedronGeometry(1.1, 0), shade(p.tallDark, 0.8), { pos: [0, 0.3, 0], scale: [1.4, 0.55, 1.2], rot: [rnd(), rnd() * 3, rnd()], jitter: 0.26 }),
    crystal(p.tall, 0.45, 1.7, [0, 0.2, 0], [0.1, 0.3, -0.15]),
    crystal(p.tallDark, 0.35, 1.15, [0.8, 0.1, 0.3], [0.3, 0.5, 0.45]),
    crystal(shade(p.tall, 1.1), 0.3, 0.9, [-0.7, 0.05, -0.3], [-0.35, 0.2, -0.4]),
    crystal(p.tall, 0.22, 0.6, [0.2, 0.05, -0.8], [-0.5, 1, 0.1]),
    part(new IcosahedronGeometry(1.3, 0), SNOW, { pos: [0, 0.02, 0], scale: [1.3, 0.25, 1.15], jitter: 0.16 }),
  ]);
}

/** Ember Peak: a charred pine burnt down to a broken trunk with two stubs. */
export function charSnagGeometry(p: Palette): BufferGeometry {
  reseed(212);
  const trunk = part(new CylinderGeometry(0.1, 0.3, 3.1, 5, 2), p.tall, { pos: [0, 1.55, 0], jitter: 0.07 });
  const parts: BufferGeometry[] = [paint(trunk, 0, 3.1, 0.75, 1.15, 0.25)];
  parts.push(part(new ConeGeometry(0.12, 0.5, 4), p.tallDark, { pos: [-0.04, 3.3, 0], rot: [0, 0, -0.4] }));
  for (let i = 0; i < 2; i++) {
    const a = rnd() * 6.28;
    parts.push(part(new CylinderGeometry(0.04, 0.07, 0.8, 4), p.tallDark, { pos: [Math.cos(a) * 0.3, 1.9 + i * 0.7, Math.sin(a) * 0.3], rot: [0, -a, 1.0] }));
  }
  parts.push(part(new ConeGeometry(0.2, 0.2, 5), SNOW, { pos: [0, 3.12, 0] }));
  parts.push(part(new IcosahedronGeometry(0.6, 0), SNOW, { pos: [0, 0.04, 0], scale: [1.3, 0.3, 1.2], jitter: 0.1 }));
  return merge(parts);
}

/** Ember Peak: a stand of short broken basalt columns, one fallen against the rest. */
export function basaltStubGeometry(p: Palette): BufferGeometry {
  reseed(818);
  const parts: BufferGeometry[] = [];
  const cols = [
    [0, 0, 0.66, 2.4],
    [0.88, 0.28, 0.5, 1.6],
    [-0.62, 0.55, 0.48, 1.1],
  ];
  cols.forEach(([x, z, r, h], i) => {
    parts.push(part(new CylinderGeometry(r, r * 1.05, h, 6), i % 2 ? p.tallDark : p.tall, { pos: [x, h / 2, z], rot: [0, rnd(), 0] }));
    parts.push(part(new CylinderGeometry(r * 0.95, r, 0.12, 6), SNOW, { pos: [x, h + 0.06, z] }));
  });
  parts.push(part(new CylinderGeometry(0.42, 0.44, 2.6, 6), p.tallDark, { pos: [-0.3, 1.0, -0.95], rot: [0.62, 0.2, 0] }));
  parts.push(part(new IcosahedronGeometry(1.1, 0), SNOW, { pos: [0, 0.02, 0], scale: [1.4, 0.24, 1.3], jitter: 0.16 }));
  return merge(parts);
}

/** Sakura Ridge: a paler, spreading blossom tree on a taller, leaning trunk. */
export function paleBlossomGeometry(p: Palette): BufferGeometry {
  reseed(313);
  const parts: BufferGeometry[] = [part(new CylinderGeometry(0.14, 0.26, 3.0, 6), new Color('#5A3A3E'), { pos: [0.12, 1.5, 0], rot: [0, 0, -0.08], jitter: 0.05 })];
  const pinkA = p.tall.clone().lerp(new Color('#FFFFFF'), 0.42);
  const pinkB = shade(pinkA, 0.86);
  const blobs = [
    [0.2, 3.5, 0, 1.2],
    [1.4, 3.05, 0.2, 0.9],
    [-1.1, 3.15, -0.3, 0.95],
    [0.3, 3.0, 1.15, 0.82],
    [-0.2, 2.95, -1.15, 0.86],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    parts.push(part(new IcosahedronGeometry(r, 0), i % 2 ? pinkB : pinkA, { pos: [x, y, z], scale: [1, 0.78, 1], rot: [rnd(), rnd(), rnd()], jitter: 0.16 }));
  });
  parts.push(part(new IcosahedronGeometry(0.85, 0), SNOW, { pos: [0.2, 4.05, 0], scale: [1.4, 0.35, 1.3], jitter: 0.1 }));
  return merge(parts);
}

/** The two forest variant sets for a biome: 'a' and 'b', each [the original tree, a variant]. Each
 *  instance picks one (see props.ts forest()). */
export function forestSteps(biome: BiomeId, p: Palette, set: 'a' | 'b'): Array<() => BufferGeometry> {
  const a = set === 'a';
  if (biome === 'alpine') return a ? [() => boughPineGeometry(p, 1), () => heavyPineGeometry(p)] : [() => youngPineGeometry(p), () => snagGeometry()];
  if (biome === 'glacier') return a ? [() => spireGeometry(p), () => brokenSpireGeometry(p)] : [() => seracGeometry(p), () => iceMoundGeometry(p)];
  if (biome === 'volcanic') return a ? [() => charPineGeometry(p), () => charSnagGeometry(p)] : [() => basaltGeometry(p), () => basaltStubGeometry(p)];
  return a ? [() => blossomGeometry(p), () => paleBlossomGeometry(p)] : [() => boughPineGeometry(p, 3), () => youngPineGeometry(p)];
}

/** A forest set made at once (tests and probes; the game makes it a variant per idle callback). */
export function forestSet(biome: BiomeId, p: Palette, set: 'a' | 'b'): BufferGeometry {
  return variantSet(forestSteps(biome, p, set).map((f) => f()));
}

/** The first variant of each set, for the first frames before the sets are made on idle time. */
export function forestBase(biome: BiomeId, p: Palette): { a: BufferGeometry; b: BufferGeometry } {
  if (biome === 'alpine') return { a: boughPineGeometry(p, 1), b: youngPineGeometry(p) };
  if (biome === 'glacier') return { a: spireGeometry(p), b: seracGeometry(p) };
  if (biome === 'volcanic') return { a: charPineGeometry(p), b: basaltGeometry(p) };
  return { a: blossomGeometry(p), b: boughPineGeometry(p, 3) };
}

/** Chance an instance of set 'a' or 'b' takes the variant (pick 1) rather than the original. */
export const VARIANT_SHARE: Record<BiomeId, { a: number; b: number }> = {
  alpine: { a: 0.3, b: 0.24 },
  glacier: { a: 0.3, b: 0.4 },
  volcanic: { a: 0.35, b: 0.4 },
  blossom: { a: 0.4, b: 0.4 },
};

/** Whether a pick is an upright tree that may lean (mounds, stubs and seracs stay planted). */
export function canLean(biome: BiomeId, set: 'a' | 'b', pick: number): boolean {
  if (biome === 'alpine') return !(set === 'a' && pick === 1);
  if (biome === 'glacier') return set === 'a';
  if (biome === 'volcanic') return set === 'a';
  return true;
}
