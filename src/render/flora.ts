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
import { silverTreeGeometry } from './lanternkit';
import { bareTreeGeometry } from './oldrunflora';
import { charPineGeometry, seracGeometry, spireGeometry } from './meshes';
import { Palette } from './palette';
import { Facets, columnInto, columnsInto, honeycomb } from './rockforms';
import { liftEdges } from './chamfer';

// Forest variety without extra draw calls. A batch's geometry holds several variants merged into one
// mesh, each vertex tagged with its variant (aVar); each instance picks one (aPick, per instance) and
// the vertex shader collapses every other variant to a point, so its triangles draw nothing. One
// InstancedMesh then shows two or more different trees (or, for the bank dressing, a whole kit of
// pieces) in a single draw. The same parts style as meshes.ts: flat-shaded, vertex-coloured.

// ---------------------------------------------------------------- shared helpers (as meshes.ts)

type V3 = [number, number, number];

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
  // (A chamfered box's chamfers take their light: chamfer.ts.)
  liftEdges(g);
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

/** Drops the slivers a lathe leaves at its tip (two corners a fraction of a millimetre apart, so they
 *  never cover a pixel) and fully collapsed triangles, from a non-indexed geometry: the GPU still
 *  shades every one of their corners. Nothing visible changes. */
export function dropSlivers(g: BufferGeometry): BufferGeometry {
  if (g.index) return g;
  const pos = g.getAttribute('position') as BufferAttribute;
  const keep: number[] = [];
  const d = (a: number, b: number) => Math.hypot(pos.getX(a) - pos.getX(b), pos.getY(a) - pos.getY(b), pos.getZ(a) - pos.getZ(b));
  for (let f = 0; f + 2 < pos.count; f += 3) {
    if (Math.min(d(f, f + 1), d(f + 1, f + 2), d(f + 2, f)) > 0.002) keep.push(f);
  }
  if (keep.length * 3 === pos.count) return g;
  for (const name of Object.keys(g.attributes)) {
    const a = g.getAttribute(name) as BufferAttribute;
    const w = a.itemSize;
    const out = new Float32Array(keep.length * 3 * w);
    keep.forEach((f, k) => out.set((a.array as Float32Array).subarray(f * w, (f + 3) * w), k * 3 * w));
    g.setAttribute(name, new BufferAttribute(out, w));
  }
  g.computeBoundingSphere();
  return g;
}

/** Merges variants into one geometry, each vertex tagged with its variant's index (aVar). */
export function variantSet(list: BufferGeometry[]): BufferGeometry {
  const tagged = list.map((g, i) => {
    const keep = new BufferGeometry();
    keep.setAttribute('position', g.getAttribute('position'));
    keep.setAttribute('normal', g.getAttribute('normal'));
    keep.setAttribute('color', g.getAttribute('color'));
    dropSlivers(keep);
    keep.setAttribute('aVar', new BufferAttribute(new Float32Array(keep.getAttribute('position').count).fill(i), 1));
    return keep;
  });
  const g = merge(tagged);
  // Where each variant's vertices start, and the end (variantRange).
  const starts: number[] = [0];
  for (const t of tagged) starts.push(starts[starts.length - 1] + t.getAttribute('position').count);
  g.userData.variantStarts = starts;
  return g;
}

/** A batch's own view of a shared variant set: the same vertex buffers, plus its per-instance pick. */
export function variantView(src: BufferGeometry, pick: InstancedBufferAttribute): BufferGeometry {
  const g = new BufferGeometry();
  for (const name of ['position', 'normal', 'color', 'aVar']) g.setAttribute(name, src.getAttribute(name));
  g.setAttribute('aPick', pick);
  g.boundingSphere = src.boundingSphere;
  g.userData.variantStarts = src.userData.variantStarts;
  return g;
}

/** Narrows a view's draw range to the variants its first `n` instances pick (lowest to highest): the
 *  variants outside it are never drawn, so their vertices need not be run at all. A batch whose picks
 *  are all one variant pays for that variant alone. */
export function variantRange(view: BufferGeometry, pick: InstancedBufferAttribute, n: number): void {
  const starts = view.userData.variantStarts as number[] | undefined;
  if (!starts) return;
  const a = pick.array as Float32Array;
  let lo = starts.length;
  let hi = -1;
  for (let i = 0; i < n; i++) {
    const v = a[i] >= AERIAL_PICK - 0.5 ? a[i] - AERIAL_PICK : a[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi < 0) view.setDrawRange(0, 0);
  else view.setDrawRange(starts[lo], starts[Math.min(hi + 1, starts.length - 1)] - starts[lo]);
}

/** An instance's pick may carry AERIAL_PICK on top of its variant: that instance leans into the fog
 *  with distance as the far forest rows do (variantMaterial's `aerialPick`), the rest stay dark as
 *  the treeline wall. So the wall and the far rows can share one batch past the detail range. */
export const AERIAL_PICK = 16;

// Another variant's vertex leaves at once, every corner of its triangles at one point outside the
// clip volume: nothing rasterizes, and it skips the rest of the shader (a variant's vertices are
// contiguous, so the GPU's vertex groups stay coherent).
const COLLAPSE = /* glsl */ `#include <begin_vertex>
  float aPickV = aPick - ${AERIAL_PICK.toFixed(1)} * step(${(AERIAL_PICK - 0.5).toFixed(1)}, aPick);
  #ifdef AERIAL_PICK
    vAerialPick = step(${(AERIAL_PICK - 0.5).toFixed(1)}, aPick);
  #endif
  if (abs(aVar - aPickV) > 0.5) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }`;
const VARIANT_ATTRS = 'attribute float aVar;\nattribute float aPick;\n';
/** The far rows' fog lift in the toon material (materials.ts AERIAL), scaled per instance. */
const AERIAL_LIFT = '* 0.45 * uHazardFog';

/** Makes a toon material draw one variant per instance (the others collapse to a point). A batch
 *  whose geometry has no aVar or aPick reads both as 0, so it draws whole, as before. With
 *  `aerialPick` (a material made with `aerial`), only instances whose pick carries AERIAL_PICK take
 *  the far rows' fog lift. */
export function variantMaterial(mat: ShaderMaterial, aerialPick = false): ShaderMaterial {
  if (!mat.vertexShader.includes('#include <begin_vertex>')) throw new Error('variantMaterial: no begin_vertex');
  mat.vertexShader = VARIANT_ATTRS + mat.vertexShader.replace('#include <begin_vertex>', COLLAPSE);
  if (aerialPick) {
    if (!mat.fragmentShader.includes(AERIAL_LIFT)) throw new Error('variantMaterial: no aerial lift');
    mat.defines = { ...mat.defines, AERIAL_PICK: 1 };
    mat.vertexShader = 'varying float vAerialPick;\n' + mat.vertexShader;
    mat.fragmentShader = 'varying float vAerialPick;\n' + mat.fragmentShader.replace(AERIAL_LIFT, '* 0.45 * vAerialPick * uHazardFog');
  }
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
  /** The needles' own colours where a mountain's are not its palette's (Sakura's cedars). */
  tones?: PineTones;
}

/** A pine's lit needles and the dark under its boughs. */
export interface PineTones {
  needle: Color;
  under: Color;
}

/** Sakura Ridge's conifers are deep cedar green (ART.md 15: with the ink and the lacquer they hold the
 *  values the blossom glows against). Its palette's tall colours are the blossom's. */
export const CEDAR: PineTones = { needle: new Color('#2C6A56'), under: new Color('#123230') };

/** Bough segments round a tier: even ones are bough tips, odd ones the gaps between them (four
 *  boughs; the small top tier has three). */
const BOUGH_SEGS = 8;

/** A forest tree's level of detail: 0 the full tree, 1 Low's own cheaper tree (about two thirds of
 *  the triangles: fewer boughs a tier, one tier of clumps), 2 the far tree, drawn only past the
 *  forest's detail range (props.ts LOD_AHEAD, 128 m and more ahead), where a tree stands a few dozen
 *  pixels tall: the same tiers, snow and silhouette at under half the triangles. */
export type Lod = 0 | 1 | 2;

/** One drooping tier of boughs, faceted: a lathe from the tip out over the shoulder to the bough ends
 *  and back in underneath, its outer ring scalloped into hanging bough tips with gaps between
 *  them. Coloured per facet: the upper face carries a snow cap whose lower edge is ragged (deeper on
 *  the boughs, shallower in the gaps), snow runs out along the tops of the boughs, the needles darken
 *  toward the skirt, and the underside is the darkest value on the tree. */
function boughTier(t: BoughTier, needle: Color, under: Color, snowK: number, twist: number, segs: number, closed = false): BufferGeometry {
  const { top, h, r } = t;
  // Profile: tip, shoulder, bough end (the droop), underside back toward the trunk (a far tree's
  // underside closes on the trunk's axis: one fan instead of a ring of quads).
  const prof = [
    new Vector2(0.001, top),
    new Vector2(r * 0.5, top - h * 0.46),
    new Vector2(r, top - h),
    new Vector2(closed ? 0 : r * 0.26, top - h * 0.7),
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
    // (A closed underside's centre stays one point on the axis.)
    for (let j = 1; j < (closed ? P - 1 : P); j++) {
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
function treeWell(r: number, shadeC: Color, segs = 6): BufferGeometry {
  const prof = [new Vector2(r * 1.45, -0.3), new Vector2(r, 0.12), new Vector2(0.2, -0.04)];
  const g = new LatheGeometry(prof, segs).toNonIndexed();
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
function boughPine(p: Palette, s: BoughSpec, lod: Lod = 0, twists?: number[]): BufferGeometry {
  reseed(s.seed);
  const needle = shade(s.tones ? s.tones.needle : p.tall, s.tone);
  const under = s.tones ? shade(s.tones.under, s.tone) : shade(p.tallDark.clone().lerp(p.tall, 0.3), 0.62 * s.tone);
  // Fewer boughs a tier for Low's pine and the far tree (three tips round a tier, two on the top
  // one), a thinner trunk, and on the far tree no clumps (a few pixels at that range).
  const parts: BufferGeometry[] = [part(new CylinderGeometry(s.trunkR * 0.65, s.trunkR, s.trunk, lod === 0 ? 5 : lod === 1 ? 4 : 3, 1, true), WOOD, { pos: [0, s.trunk / 2, 0] })];
  s.tiers.forEach((t, i) => {
    const twist = rnd() * 6.28;
    // (The near tree turns each tier as this one does: nearPine.)
    twists?.push(twist);
    const top = i === s.tiers.length - 1 && i > 2;
    const segs = lod === 0 ? (top ? 6 : BOUGH_SEGS) : top ? 4 : 6;
    parts.push(boughTier(t, i % 2 ? shade(needle, 0.9) : needle, under, s.snow * (1 - i * 0.08), twist, segs, lod > 0));
    // Snow clumps out on bough tips of the lower tiers (placed as the lathe lays its tips out, then
    // turned by the tier's twist).
    if (i < (lod === 0 ? 2 : lod === 1 ? 1 : 0)) {
      for (let k = 0; k < s.clumps; k++) {
        const phi = ((k * 2 + i * 2) * Math.PI * 2) / segs;
        const rr = t.r * 0.9;
        const x0 = Math.sin(phi) * rr;
        const z0 = Math.cos(phi) * rr;
        const x = x0 * Math.cos(twist) - z0 * Math.sin(twist);
        const z = x0 * Math.sin(twist) + z0 * Math.cos(twist);
        parts.push(part(new OctahedronGeometry(0.2 + 0.05 * rnd(), 0), SNOW, { pos: [x, t.top - t.h * 1.06 + 0.12, z], scale: [1.5, 0.62, 1.2], rot: [0, Math.atan2(x, z), 0], jitter: 0.05 }));
      }
    }
  });
  parts.push(treeWell(Math.max(0.7, s.tiers[0].r * 0.62), p.snowShade, lod === 2 ? 5 : 6));
  return dropSlivers(merge(parts));
}

/** The spruces' specs: the forest's own (variant reseeds it), the run's hazard, the snow-laden one and the young one.
 *  Each is drawn far, near (nearPine) and on Low from the one spec, so a tree keeps its tiers at every distance. */
function pineSpec(kind: PineKind, variant = 0, tones?: PineTones): BoughSpec {
  if (kind === 'hazard') {
    return {
      tones,
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
    };
  }
  if (kind === 'heavy') {
    return {
      tones,
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
    };
  }
  if (kind === 'young') {
    return {
      tones,
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
    };
  }
  return {
    tones,
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
  };
}

/** Which spruce: the forest's, the run's hazard, the snow-laden one, the young one. */
export type PineKind = 'bough' | 'hazard' | 'heavy' | 'young';

/** The forest's spruce, in its plain and blossom-ridge colourings (variant reseeds it). */
export function boughPineGeometry(p: Palette, variant = 0, lod: Lod = 0, tones?: PineTones): BufferGeometry {
  return boughPine(p, pineSpec('bough', variant, tones), lod);
}

/** The run's own pine hazard in the bough style (for meshes.ts obstacleGeometry 'pine'): the forest
 *  spruce with less snow on it, so it stays the dark, hard silhouette a hazard must be (ART.md section
 *  1), and a bottom tier as wide as the old pine's (1.35 m; colliders are 0.7 to 0.95 m), so it looks
 *  at least as wide as it collides. */
export function hazardPineGeometry(p: Palette, tones?: PineTones): BufferGeometry {
  return boughPine(p, pineSpec('hazard', 0, tones));
}

/** A snow-laden spruce: broad, a little shorter, its boughs bowed under deep caps and clumps. */
export function heavyPineGeometry(p: Palette, lod: Lod = 0): BufferGeometry {
  return boughPine(p, pineSpec('heavy'), lod);
}

/** A young spruce: three small tiers on a thin stem, about half a grown tree's height. */
export function youngPineGeometry(p: Palette, lod: Lod = 0, tones?: PineTones): BufferGeometry {
  return boughPine(p, pineSpec('young', 0, tones), lod);
}

// ---------------------------------------------------------------- the near trees (round 8)

/** How fine a near tree is built (nearforest.ts): 'fine' on High and Ultra, 'lean' on Medium and the phone. */
export type NearBuild = 'fine' | 'lean';

/** How finely a near tier is cut: about how wide a facet is round the tier and down its face (metres; a big tier is cut
 *  into more of them), rows under it, rows of its shelf of snow (0: the snow painted on the face, as the far tree's). */
interface TierRes {
  col: number;
  row: number;
  under: number;
  shelf: number;
}

/** The outer layer of boughs and the shorter one under its notches, by build. */
const NEAR_RES: Record<NearBuild, { outer: TierRes; inner: TierRes }> = {
  fine: { outer: { col: 0.3, row: 0.4, under: 3, shelf: 3 }, inner: { col: 0.42, row: 0.45, under: 2, shelf: 0 } },
  lean: { outer: { col: 0.42, row: 0.52, under: 2, shelf: 2 }, inner: { col: 0.6, row: 0.6, under: 2, shelf: 0 } },
};

/** One far tier's ring, segment by segment, as boughTier lays it out (the same seeds), so a near tier keeps the far
 *  one's bough tips, gaps and wander: its jitter in reach and height at each segment, and whether it is a tip. */
function farRing(t: BoughTier, twist: number, segs: number): { jr: number[]; jy: number[] } {
  const jr: number[] = [];
  const jy: number[] = [];
  for (let seg = 0; seg < segs; seg++) {
    reseed(9000 + Math.round(twist * 1000) + seg * 7);
    jr.push(0.92 + rnd() * 0.16);
    jy.push((rnd() - 0.5) * 0.12 * t.h);
  }
  return { jr, jy };
}

/** A small value hash (a near tier's ragged snow line, its facets' steps): 0 to 1. */
function nh(a: number, b: number): number {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/** One tier of a near spruce (round 8): the far tier's form (its tips, gaps, droop and wander, segment for segment)
 *  drawn as layered, rounded boughs. Each bough is a lobe that swells out to its tip and arches before it droops, a
 *  notch between it and the next; a second, shorter layer of boughs sits under the notches, so a tier reads as boughs
 *  laid over boughs and not one skirt; under the tier, a lip of thickness at the bough ends and the dark underside.
 *  Snow lies on it as a shelf with depth: a crust standing off the boughs, out along each bough's top further than in
 *  the notches, its ragged edge folding down in a band of shade. Facets are about a third of a metre and flat, as a
 *  hazard's are (ART.md 3): many small planes the low sun models a bough with, never a few that split the tree. (Softened
 *  normals were tried: the tree went to a smooth green blob beside the far forest's crisp facets.) */
function nearTier(f: Facets, t: BoughTier, needle: Color, under: Color, snowShade: Color, snowK: number, twist: number, segs: number, res: TierRes, inner: boolean): void {
  const { top, h, r } = t;
  const ring = farRing(t, twist, segs);
  const w = (Math.PI * 2) / segs;
  const N = segs * Math.max(2, Math.min(5, Math.ceil((w * r) / res.col)));
  const M = Math.max(3, Math.min(9, Math.ceil(Math.hypot(r, h) / res.row)));
  const ca = Math.cos(twist);
  const sa = Math.sin(twist);
  // A column's lobe (1 at a bough tip, 0 in a notch), its reach and height wander (between the far ring's).
  const lobe: number[] = [];
  const jr: number[] = [];
  const jy: number[] = [];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const q = th / w;
    const k0 = Math.floor(q) % segs;
    const fr = q - Math.floor(q);
    const k1 = (k0 + 1) % segs;
    // Distance from the nearest tip, in segments (tips are the even segments).
    const d = k0 % 2 === 0 ? fr : 1 - fr;
    lobe.push(Math.pow(Math.cos((d * Math.PI) / 2), 0.8));
    jr.push(ring.jr[k0] + (ring.jr[k1] - ring.jr[k0]) * fr);
    jy.push(ring.jy[k0] + (ring.jy[k1] - ring.jy[k0]) * fr);
  }
  // The inner layer's boughs stand under the outer one's notches, shorter, their tips no lower than the outer's.
  const rr = inner ? r * 0.92 : r;
  const hh = inner ? h * 0.72 : h;
  const tt = inner ? top - h * 0.3 : top;
  const L = (i: number) => (inner ? 1 - lobe[i] : lobe[i]);
  /** A point on the tier's upper face: column i, u from the tier's tip (0) to the bough end (1). */
  const at = (i: number, u: number): V3 => {
    const l = L(i);
    const sEnd = (0.74 + 0.3 * l) * jr[i];
    const yEnd = (0.09 - 0.22 * l) * hh;
    let rad: number;
    let y: number;
    if (u <= 0.5) {
      const v = u / 0.5;
      rad = rr * 0.5 * jr[i] * v * (1 + 0.04 * Math.sin(Math.PI * v));
      y = tt + v * (-0.46 * hh + jy[i]);
    } else {
      const v = (u - 0.5) / 0.5;
      rad = rr * (0.5 * jr[i] + (sEnd - 0.5 * jr[i]) * v);
      // The bough holds up, then droops to its tip; its middle stands a little proud of its sides.
      const sh = tt - 0.46 * hh + jy[i];
      y = sh + (tt - hh + yEnd - sh) * v + 0.05 * hh * (l - 0.45) * Math.sin(Math.PI * v);
    }
    const th = (i / N) * Math.PI * 2;
    const x0 = Math.sin(th) * rad;
    const z0 = Math.cos(th) * rad;
    return [x0 * ca - z0 * sa, y, x0 * sa + z0 * ca];
  };
  const out = (p: V3): V3 => [p[0], 0.35, p[2]];
  // How far down each column the snow lies, ragged: the tier above hides the top of this one from a lens by the run, so
  // what shows is the skirt, and the snow lies out along each bough's top nearly to its tip (as the far tree paints it
  // there), a cap only part way into a notch.
  const sn: number[] = [];
  for (let i = 0; i <= N; i++) {
    const j = i % N;
    const l = L(j);
    const base = inner ? snowK * 0.35 : 0.22 + snowK * 0.45 + (0.18 + 0.3 * snowK) * Math.pow(l, 1.2);
    // (Ragged by the bough, not by the facet: a wander from one half-segment to the next, eased between, so a shelf's
    // edge is a wavy line along each bough. Noise a column read as loose white shards, the second critic; none, as
    // rings of white cake.)
    const q = (j / N) * segs * 2;
    const q0 = Math.floor(q);
    const fq = q - q0;
    const e = fq * fq * (3 - 2 * fq);
    const wob = nh((q0 % (segs * 2)) + twist * 10, top) * (1 - e) + nh(((q0 + 1) % (segs * 2)) + twist * 10, top) * e;
    sn.push(Math.max(0.06, Math.min(0.94, base + 0.26 * (wob - 0.5))));
  }
  sn[N] = sn[0];
  const c = new Color();
  // (Rows a little closer down the droop, where the face turns.)
  const us = Array.from({ length: M + 1 }, (_, j) => Math.pow(j / M, 0.85));
  // (A deep shelf on a laden tree is cut in as many rows as the face it covers.)
  const Ks = res.shelf > 0 ? Math.max(res.shelf, Math.ceil(Math.max(...sn) * M * 0.9)) : 0;
  // The upper face of needles, row by row, but none of what a shelf of snow covers (without one, the snow is painted
  // on the face, as the far tree's is).
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const covered = us[j + 1] <= Math.min(sn[i], sn[i + 1]) - 0.02;
      if (covered && Ks > 0) continue;
      const a = at(i, us[j]);
      const b = at(i + 1, us[j]);
      const d = at(i + 1, us[j + 1]);
      const e = at(i, us[j + 1]);
      const l = (L(i) + L(i + 1)) / 2;
      const down = (us[j] + us[j + 1]) / 2;
      if (covered) c.copy(SNOW).multiplyScalar(0.95 - 0.08 * down);
      // Lighter up a bough's top, darker toward its skirt and into the notches (the boughs read as laid one over
      // the next), a step per facet.
      else c.copy(needle).multiplyScalar((1.08 - down * 0.3) * (0.8 + 0.22 * l) * (0.93 + 0.14 * nh(i * 3.1 + twist, j + top)) * (inner ? 0.86 : 1));
      f.quad(a, b, d, e, c, out(a));
    }
  }
  // The bough ends' lip and the underside, back in to the trunk in rows: the darkest values on the tree.
  const U = res.under;
  const ringU = (ii: number): V3[] => {
    const e = at(ii, 1);
    const l = L(ii % N);
    const th = (ii / N) * Math.PI * 2;
    const sEnd = (0.74 + 0.3 * l) * jr[ii];
    const yEnd = (0.09 - 0.22 * l) * hh;
    const ux = Math.sin(th);
    const uz = Math.cos(th);
    const rot = (rad: number, y: number): V3 => [ux * rad * ca - uz * rad * sa, y, ux * rad * sa + uz * rad * ca];
    const lipY = e[1] - hh * (0.035 + 0.03 * l);
    const pts: V3[] = [e, rot(rr * sEnd * 0.95, lipY)];
    // From the lip in to the trunk, rising to the underside's heart: the far tree's underside, in U rows.
    for (let k = 1; k <= U; k++) {
      const v = k / U;
      pts.push(rot(rr * sEnd * (0.95 - 0.69 * v), lipY + (tt - hh * 0.7 + yEnd * 0.6 - lipY) * Math.pow(v, 0.8)));
    }
    return pts;
  };
  for (let i = 0; i < N; i++) {
    const r0 = ringU(i);
    const r1 = ringU(i + 1);
    for (let k = 0; k + 1 < r0.length; k++) {
      c.copy(under).multiplyScalar(k === 0 ? 1.35 * (0.95 + 0.1 * nh(i, top)) : 1.12 - 0.14 * (k / (r0.length - 1)));
      f.quad(r0[k], r1[k], r1[k + 1], r0[k + 1], c, k === 0 ? [r0[k][0], -0.2, r0[k][2]] : [0, -1, 0]);
    }
  }
  if (Ks === 0) return;
  // The snow: a crust standing off the boughs to each column's snow line, its edge folding down in shade.
  // (A thin crust: a thick one with a shaded fold read as rolls of marshmallow, the fourth critic.)
  const thick = (inner ? 0.025 : 0.03) + 0.02 * snowK;
  const shell = (i: number, u: number): V3 => {
    const p = at(i, u);
    // Off the face along its upward normal (the face's slope from a step down it).
    const q = at(i, Math.min(1, u + 0.04));
    const radial = Math.hypot(q[0], q[2]) - Math.hypot(p[0], p[2]);
    const drop = p[1] - q[1];
    const n = Math.hypot(radial, drop) || 1;
    const rx = Math.hypot(p[0], p[2]) || 1;
    const up = radial / n;
    const outK = drop / n;
    return [p[0] + (p[0] / rx) * outK * thick, p[1] + up * thick, p[2] + (p[2] / rx) * outK * thick];
  };
  if (inner && snowK < 0.2) return;
  const lit = new Color();
  const cool = SNOW.clone().lerp(snowShade, 0.25);
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < Ks; k++) {
      const a = shell(i, (sn[i] * k) / Ks);
      const b = shell(i + 1, (sn[i + 1] * k) / Ks);
      const d = shell(i + 1, (sn[i + 1] * (k + 1)) / Ks);
      const e = shell(i, (sn[i] * (k + 1)) / Ks);
      lit.copy(SNOW).multiplyScalar((1 - 0.1 * ((k + 0.5) / Ks) * sn[i]) * (0.97 + 0.05 * nh(i + k * 7.3, top + twist)));
      f.quad(a, b, d, e, lit, [a[0] * 0.3, 1, a[2] * 0.3]);
    }
    // The shelf's edge: down from the crust to under the face, a band in the snow's shade.
    const a = shell(i, sn[i]);
    const b = shell(i + 1, sn[i + 1]);
    const a2 = at(i, Math.min(1, sn[i] + 0.035));
    const b2 = at(i + 1, Math.min(1, sn[i + 1] + 0.035));
    a2[1] -= thick * 0.7;
    b2[1] -= thick * 0.7;
    f.quad(a, b, b2, a2, cool, [a[0], 0.2, a[2]]);
  }
}

/** A near spruce (round 8, nearforest.ts): the far tree's tiers, height, reach, snow and turn (ART.md 12: a far tree
 *  that reads differently from a near one is a bug), drawn so it holds up at the lens. Each tier is layered, rounded
 *  boughs under a shelf of snow (nearTier); the trunk is a real one, barked, broad at the foot, with a few
 *  dead stubs under the lowest boughs; clumps of snow sit out on the lower tips; a tree well at the foot. About 4,000
 *  triangles 'fine' and 2,300 'lean', drawn only for the few trees within about 26 m of the lens. */
export function nearPineGeometry(p: Palette, kind: PineKind, variant = 0, tones?: PineTones, nb: NearBuild = 'fine'): BufferGeometry {
  const s = pineSpec(kind, variant, tones);
  const twists: number[] = [];
  boughPine(p, s, 0, twists).dispose();
  const needle = shade(s.tones ? s.tones.needle : p.tall, s.tone);
  const under = s.tones ? shade(s.tones.under, s.tone) : shade(p.tallDark.clone().lerp(p.tall, 0.3), 0.62 * s.tone);
  const f = new Facets();
  const fine = nb === 'fine';
  s.tiers.forEach((t, i) => {
    const topTier = i === s.tiers.length - 1 && i > 2;
    const segs = topTier ? 6 : BOUGH_SEGS;
    const nd = i % 2 ? shade(needle, 0.9) : needle;
    // (Sakura's cedars carry less: they are the ink spine the blossom glows against, ART.md 15.)
    const snowK = s.snow * (1 - i * 0.08) * (s.tones ? 0.6 : 1);
    // (The top tier is a small cone of a few boughs: no layer under it.)
    if (!topTier && (fine || i < 2)) nearTier(f, t, nd, under, p.snowShade, snowK, twists[i], segs, NEAR_RES[nb].inner, true);
    nearTier(f, t, nd, under, p.snowShade, snowK, twists[i], segs, NEAR_RES[nb].outer, false);
  });
  const g = f.build();
  reseed(s.seed + 77);
  // The trunk: up into the crown, a little bark in its value, broad at the foot. (Roots splayed from it read as a dark
  // star at the foot of a tree dissolving by the lens, the first critic: the tree well hides the foot instead.)
  const bark = WOOD.clone().multiplyScalar(0.82);
  const trunkTop = s.tiers[Math.min(2, s.tiers.length - 1)].top - 0.4;
  const trunk = part(new CylinderGeometry(s.trunkR * 0.42, s.trunkR * 1.05, trunkTop, fine ? 8 : 6, fine ? 4 : 2, true), bark, { pos: [0, trunkTop / 2, 0], jitter: s.trunkR * 0.12 });
  const tp = trunk.getAttribute('position') as BufferAttribute;
  const tc = trunk.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < tp.count; i += 3) {
    const ax = (tp.getX(i) + tp.getX(i + 1) + tp.getX(i + 2)) / 3;
    const az = (tp.getZ(i) + tp.getZ(i + 1) + tp.getZ(i + 2)) / 3;
    // Bark in strips up the trunk, darker toward the foot where the snow wets it.
    const k = (0.82 + 0.3 * nh(Math.round(Math.atan2(az, ax) * 4), 3)) * (0.85 + 0.15 * Math.min(1, tp.getY(i) / 0.8));
    for (let j = i; j < i + 3; j++) tc.setXYZ(j, tc.getX(j) * k, tc.getY(j) * k, tc.getZ(j) * k);
  }
  const parts: BufferGeometry[] = [g, trunk];
  // Dead stubs under the lowest boughs, where a spruce sheds its shaded branches.
  const low = s.tiers[0].top - s.tiers[0].h * 0.75;
  for (let k = 0; k < (fine ? 4 : 2); k++) {
    const a = rnd() * 6.28;
    const len = 0.35 + 0.3 * rnd();
    parts.push(part(new CylinderGeometry(0.012, 0.03, len, 3, 1, true), BARK_DARK, { pos: [Math.cos(a) * len * 0.45, low - 0.15 * k, Math.sin(a) * len * 0.45], rot: [0, -a, -1.2] }));
  }
  // (No clumps out on the tips: on the near build's drooping boughs they floated off the bough ends as pillows, the
  // fourth critic. The shelf carries the snow out along each bough.)
  parts.push(treeWell(Math.max(0.7, s.tiers[0].r * 0.62), p.snowShade, fine ? 12 : 9));
  for (const q of parts) if (q.getAttribute('uv')) q.deleteAttribute('uv');
  return dropSlivers(merge(parts.map((q) => (q.index ? q.toNonIndexed() : q))));
}

/** A dead snag: a bare, broken grey trunk with a few stub branches, snow on its stubs and foot. */
export function snagGeometry(lod: Lod = 0): BufferGeometry {
  reseed(141);
  let trunk = paint(part(new CylinderGeometry(0.1, 0.27, 4.2, 5, 3), BARK, { pos: [0, 2.1, 0], jitter: 0.07 }), 0, 4.2, 0.8, 1.15, 0.2);
  const far = lod === 2;
  if (far) {
    // The far snag's trunk and stubs have fewer facets; its stubs keep the full snag's bearings (the
    // full trunk is made first, so the random sequence after it is the same).
    trunk.dispose();
    const s = seedState;
    trunk = paint(part(new CylinderGeometry(0.1, 0.27, 4.2, 4, 2, true), BARK, { pos: [0, 2.1, 0], jitter: 0.07 }), 0, 4.2, 0.8, 1.15, 0.2);
    seedState = s;
  }
  const parts: BufferGeometry[] = [trunk];
  // The splintered top.
  parts.push(part(new ConeGeometry(0.13, 0.55, 4), BARK_DARK, { pos: [0.04, 4.42, 0], rot: [0, 0, 0.35] }));
  for (let i = 0; i < 5; i++) {
    const y = 1.6 + i * 0.5;
    const a = rnd() * 6.28;
    const len = 1.25 - i * 0.16;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    parts.push(part(far ? new CylinderGeometry(0.03, 0.06, len, 3, 1, true) : new CylinderGeometry(0.03, 0.06, len, 4), BARK_DARK, { pos: [ca * len * 0.42, y + 0.18, sa * len * 0.42], rot: [0, -a, -1.05] }));
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
  // (Round 8's review: a white cone on each broken top read as a field of pencils. A burnt snag holds no snow on its
  // splintered tip, only at its foot.)
  parts.push(part(new IcosahedronGeometry(0.6, 0), SNOW, { pos: [0, 0.04, 0], scale: [1.3, 0.3, 1.2], jitter: 0.1 }));
  return merge(parts);
}

/** Ash and old snow on Ember's broken tops: the snow's white a step toward the ash. */
export const ASH_TOP = SNOW.clone().lerp(new Color('#B9AEB6'), 0.3);

/** Ember's basalt in the palette's own darks, pulled toward a cold near-black (ART.md 15: true black, a
 *  hazard's hard silhouette, never brown): the columns' two values, and the paler, dull plum-grey of a
 *  fresh break. */
export function basaltTones(p: Palette): { rock: [Color, Color]; broke: Color } {
  const ink = new Color('#15121B');
  return { rock: [p.tallDark.clone().lerp(ink, 0.55), p.tall.clone().lerp(ink, 0.38)], broke: p.tall.clone().lerp(new Color('#5E566C'), 0.5) };
}

/** A low drift of ash and snow banked round a formation's foot (a clean seam with the slope): a faceted
 *  skirt from up the columns out to under the snow. */
function ashSkirt(f: Facets, x: number, z: number, rx: number, rz: number, reach: number, up: number, sides = 7): void {
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2;
    const a1 = ((k + 1) / sides) * Math.PI * 2;
    const j0 = 0.85 + 0.3 * rnd();
    const j1 = 0.85 + 0.3 * rnd();
    f.quad(
      [x + Math.cos(a0) * rx * reach, -0.5, z + Math.sin(a0) * rz * reach],
      [x + Math.cos(a1) * rx * reach, -0.5, z + Math.sin(a1) * rz * reach],
      [x + Math.cos(a1) * rx * 0.82, up * j1, z + Math.sin(a1) * rz * 0.82],
      [x + Math.cos(a0) * rx * 0.82, up * j0, z + Math.sin(a0) * rz * 0.82],
      ASH_TOP,
      [Math.cos(a0), 1, Math.sin(a0)],
      0.93,
      1,
    );
  }
}

/** Ember Peak: an organ-pipe outcrop. Three ranks of slim hexagonal columns packed shoulder to shoulder
 *  in a honeycomb, graded in height to a peak a third of the way along (so its silhouette leans, as a
 *  jointed flow cooled), every top broken off at its own height and slant, ash on the flatter ones, two
 *  fallen lengths at its foot and ash drifted against it. Its broad face looks along +z. About 500
 *  triangles: basalt country's formation, stood on crests and shoulders, never scattered. */
export function organPipeGeometry(p: Palette): BufferGeometry {
  reseed(828);
  const t = basaltTones(p);
  const f = new Facets();
  const r = 0.46;
  // The organ's profile: height by where a column stands along the face, peaking a third of the way along.
  const profile = (x: number) => {
    const u = (x + 4.2) / 8.4;
    const k = u < 0.36 ? u / 0.36 : 1 - (u - 0.36) / 0.64;
    return 2.6 + 6.6 * Math.pow(Math.max(0, k), 0.8);
  };
  const cols: Array<[number, number, number, number]> = [];
  for (const [x, z] of honeycomb(10, 3, r)) {
    // The front rank stands a little lower than the ranks behind it (steps up into the outcrop), and
    // every column is its own height: no two neighbours break at the same level.
    const rank = Math.round(-z / (r * 1.5));
    cols.push([x, z + 0.35, r * (0.92 + 0.14 * rnd()), profile(x) * (0.72 + 0.14 * rank) * (0.86 + 0.28 * rnd())]);
  }
  columnsInto(f, { cols, rock: t.rock, broke: t.broke, top: ASH_TOP, broken: 0.5, seed: 8281 });
  // Two lengths fallen off the face, lying in the ash.
  const lr = () => rnd();
  columnInto(f, { x: -2.3, z: 1.7, r: 0.42, h: 1.5, foot: 0, yaw: 0.4, col: t.rock[1], top: null, broke: t.broke, lean: [1.35, 0.3] }, lr);
  columnInto(f, { x: 1.6, z: 1.5, r: 0.4, h: 1.2, foot: 0, yaw: 1.1, col: t.rock[0], top: null, broke: t.broke, lean: [1.3, -0.5] }, lr);
  ashSkirt(f, 0, 0.1, 4.6, 1.7, 1.25, 0.5, 9);
  return f.build();
}

/** Ember Peak: a cluster of six columns of mixed height, broken on their own slants, one fallen against
 *  the rest: what stands round a formation's foot. */
export function basaltClusterGeometry(p: Palette): BufferGeometry {
  reseed(838);
  const t = basaltTones(p);
  const f = new Facets();
  const cols: Array<[number, number, number, number]> = [
    [0, 0, 0.44, 4.2],
    [0.74, 0.2, 0.4, 3.1],
    [-0.7, 0.3, 0.38, 2.3],
    [0.16, -0.72, 0.42, 3.5],
    [0.5, 0.82, 0.34, 1.5],
    [-0.52, -0.5, 0.36, 2.8],
  ];
  columnsInto(f, { cols, rock: t.rock, broke: t.broke, top: ASH_TOP, broken: 0.5, drum: 1.8, seed: 8381 });
  columnInto(f, { x: -0.6, z: 1.15, r: 0.36, h: 2.4, foot: 0.2, yaw: 0.3, col: t.rock[0], top: null, broke: t.broke, lean: [-0.95, 0.15] }, () => rnd());
  ashSkirt(f, 0, 0.15, 1.5, 1.4, 1.3, 0.34);
  return f.build();
}

/** Ember Peak: a sentinel, one tall column standing alone with a second most of its height beside it and
 *  stubs at its foot, set where it frames a view (either side of a leap's approach). Its top is snapped
 *  on a slant. */
export function basaltSentinelGeometry(p: Palette): BufferGeometry {
  reseed(848);
  const t = basaltTones(p);
  const f = new Facets();
  const lr = () => rnd();
  columnInto(f, { x: 0, z: 0, r: 0.58, h: 10.3, col: t.rock[1], top: null, broke: t.broke, slant: [0.9, 0.3], drums: 4 }, lr);
  columnInto(f, { x: 0.86, z: 0.42, r: 0.44, h: 7.1, yaw: 0.3, col: t.rock[0], top: null, broke: t.broke, slant: [-0.5, 0.4], drums: 3 }, lr);
  columnInto(f, { x: -0.7, z: 0.62, r: 0.42, h: 3.4, yaw: 0.1, col: t.rock[0], top: ASH_TOP, broke: t.broke, slant: [0.06, 0.04] }, lr);
  columnInto(f, { x: 0.3, z: -0.84, r: 0.4, h: 4.8, yaw: 0.5, col: t.rock[1], top: ASH_TOP, broke: t.broke, slant: [0.05, -0.08], drums: 2 }, lr);
  columnInto(f, { x: 1.5, z: -0.2, r: 0.36, h: 1.7, yaw: 0.2, col: t.rock[1], top: null, broke: t.broke, slant: [0.4, 0.2] }, lr);
  ashSkirt(f, 0.3, 0.1, 1.6, 1.3, 1.3, 0.34);
  return f.build();
}

// ---------------------------------------------------------------- blossom

/** How a blossom canopy is built (the visual lift): 'rich' for the run's own blossom trees, which pass at the
 *  lens (round puffs, about 80 triangles each); 'near' for the orchards' treeline and near rows on Medium and
 *  High (lumpier puffs of 32); 'lean' for Low's (puffs of 20); 'far' past the detail range (three puffs, under
 *  half a round 7 tree, where a tree is a few dozen pixels). Round 8: 'close' for the few within about 26 m of the lens
 *  on High and Ultra (nearforest.ts): the rich tree's puffs a step rounder, so a canopy passing at the lens is a cloud
 *  of bloom and never a few pink planes. */
export type CanopyBuild = 'close' | 'rich' | 'near' | 'lean' | 'far';

/** One puff of bloom: its centre and radius, how flat it is (sy), and a value of its own (k). */
export type Puff = [x: number, y: number, z: number, r: number, k?: number];

function puffShape(build: CanopyBuild, r: number, big: boolean): BufferGeometry {
  if (build === 'close') return new IcosahedronGeometry(r, big ? 2 : 1);
  if (build === 'rich')return big ? new IcosahedronGeometry(r, 1) : new OctahedronGeometry(r, 1);
  // (The near orchards: the heart of the cloud a rounder puff, the rest the leanest that still shade round; the
  // treeline is never nearer than 9 m, and a variant set counts both its trees in every instance.)
  if (build === 'near') return big && r > 1.2 ? new OctahedronGeometry(r, 1) : new IcosahedronGeometry(r, 0);
  return new IcosahedronGeometry(r, 0);
}

/** A hash of a direction (a puff's lumps: a corner shared by two faces moves once). */
function dirHash(x: number, y: number, z: number, s: number): number {
  const h = Math.sin(Math.round(x * 97) * 12.9898 + Math.round(y * 97) * 78.233 + Math.round(z * 97) * 37.719 + s * 4.37) * 43758.5453;
  return h - Math.floor(h);
}

/** A canopy of bloom: clustered rounded puffs, each lumpy, shaded as one soft mass (every corner's normal
 *  turned half way from its own puff's toward the canopy's heart, so the canopy lights as one cloud of bloom,
 *  its outline soft against the sky and light can come through it: the light lane's term reads the normal
 *  there), painted from a wine-rose underside up to its pale crown. Round 7's canopy was five faceted
 *  icosahedra: every critic read it as pink polyhedra, frontlit, never backlit. */
/** The petals' white a canopy pales toward over its crown, and the wine its underside deepens to. */
const PETAL = new Color('#FFF0F4');
const WINE = new Color('#8A3458');

function canopy(puffs: readonly Puff[], build: CanopyBuild, pink: Color, sy: number, y0: number, y1: number, k0: number, k1: number, seedK: number): BufferGeometry {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let wsum = 0;
  for (const [x, y, z, r] of puffs) {
    const w = r * r * r;
    cx += x * w;
    cy += y * w;
    cz += z * w;
    wsum += w;
  }
  cx /= wsum;
  cy = cy / wsum - 0.45;
  cz /= wsum;
  const bloom = Math.min(pink.r, pink.g, pink.b) < 0.85;
  const parts: BufferGeometry[] = [];
  puffs.forEach(([x, y, z, r, k = 1], i) => {
    const g0 = puffShape(build, 1, i < 5);
    const g = g0.index ? g0.toNonIndexed() : g0;
    const pos = g.getAttribute('position') as BufferAttribute;
    const nrm = new Float32Array(pos.count * 3);
    const col = new Float32Array(pos.count * 3);
    const amp = build === 'far' ? 0.08 : 0.16;
    for (let v = 0; v < pos.count; v++) {
      const dx = pos.getX(v);
      const dy = pos.getY(v);
      const dz = pos.getZ(v);
      const lump = 1 + amp * (dirHash(dx, dy, dz, seedK + i) - 0.5);
      const px = x + dx * r * lump;
      const py = y + dy * r * lump * sy;
      const pz = z + dz * r * lump;
      pos.setXYZ(v, px, py, pz);
      // Half its puff's own round, half the canopy's.
      let nx = dx;
      let ny = dy / sy;
      let nz = dz;
      let l = Math.hypot(nx, ny, nz) || 1;
      let mx = px - cx;
      let my = py - cy;
      let mz = pz - cz;
      const m = Math.hypot(mx, my, mz) || 1;
      nx = nx / l + mx / m;
      ny = ny / l + my / m;
      nz = nz / l + mz / m;
      l = Math.hypot(nx, ny, nz) || 1;
      nrm.set([nx / l, ny / l, nz / l], v * 3);
    }
    // Painted in three values, a flat one a facet (ART.md 3 and 15: the gouache's own values, a hazard's hard
    // steps): the wine-rose underside, the body, and the crown paling toward the petals' white, by where each
    // facet stands up the canopy and how far it looks up, each puff a step of its own. Snow keeps its own colour,
    // in the same three steps.
    for (let f = 0; f + 2 < pos.count; f += 3) {
      const py = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
      const ny = (nrm[f * 3 + 1] + nrm[f * 3 + 4] + nrm[f * 3 + 7]) / 3;
      const t = Math.max(0, Math.min(1, (py - y0) / (y1 - y0)));
      const score = t * 0.8 + 0.25 * ny;
      const band = score < 0.3 ? 0 : score < 0.68 ? 1 : 2;
      const kk = (band === 0 ? k0 * 1.05 : band === 1 ? (k0 + k1) / 2 + 0.04 : k1) * k;
      const wine = bloom && band === 0 ? 0.32 : 0;
      const pale = bloom && band === 2 ? 0.16 : 0;
      const r0 = pink.r + (WINE.r - pink.r) * wine;
      const g0 = pink.g + (WINE.g - pink.g) * wine;
      const b0 = pink.b + (WINE.b - pink.b) * wine;
      const c = [(r0 + (PETAL.r - r0) * pale) * kk, (g0 + (PETAL.g - g0) * pale) * kk, (b0 + (PETAL.b - b0) * pale) * kk];
      for (let j = f; j < f + 3; j++) col.set(c, j * 3);
    }
    g.setAttribute('normal', new BufferAttribute(nrm, 3));
    // (Low's lean canopy is flat-shaded, a facet one value of light: its few corners read as a polygon against
    // smooth shading, and its rims washed pale.)
    if (build === 'lean') g.computeVertexNormals();
    g.setAttribute('color', new BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  });
  return merge(parts);
}

/** A soft cap of snow lying on a canopy's crown: one more lumpy puff, sunk into the crown so only its top shows
 *  (a whole flattened puff read as a white slab laid on the bloom). */
function crownSnow(build: CanopyBuild, pos: [number, number, number], r: number): BufferGeometry {
  return canopy([[pos[0], pos[1], pos[2], r]], build === 'lean' ? 'lean' : build === 'close' ? 'close' : 'near', SNOW, 0.5, pos[1] - r, pos[1] + r * 0.5, 0.86, 1, 41);
}

/** Sakura Ridge's blossom tree (the run's `blossom` hazard and the orchards' first tree): a dark trunk under a
 *  rounded canopy of bloom, snow on its crown. `build` says how fine (CanopyBuild). */
export function blossomGeometry(p: Palette, build: CanopyBuild = 'rich'): BufferGeometry {
  reseed(303);
  const bark = new Color('#5A3A3E');
  const far = build === 'far';
  const close = build === 'close';
  const parts: BufferGeometry[] = [part(new CylinderGeometry(far ? 0.2 : 0.18, 0.3, 2.6, far ? 3 : build === 'lean' ? 5 : close ? 8 : 6, close ? 3 : 1, far || build === 'lean'), bark, { pos: [0, 1.3, 0], jitter: far ? 0 : 0.05 })];
  if (build === 'rich' || close) {
    // Two limbs up into the canopy, seen from under it as a rider passes.
    parts.push(part(new CylinderGeometry(0.07, 0.13, 1.3, 4, 1, true), bark, { pos: [0.35, 2.75, 0.1], rot: [0.1, 0, -0.6] }));
    parts.push(part(new CylinderGeometry(0.07, 0.12, 1.2, 4, 1, true), bark, { pos: [-0.3, 2.7, -0.15], rot: [-0.15, 0, 0.65] }));
  }
  const puffs: Puff[] = far
    ? [
        [0, 3.5, 0, 1.68],
        [1.0, 3.0, 0.3, 1.12, 0.94],
        [-0.9, 3.1, -0.35, 1.15, 1.04],
      ]
    : build === 'lean'
      ? [
          [0, 3.4, 0, 1.5],
          [1.0, 2.9, 0.3, 1.05, 0.92],
          [-0.9, 3.0, -0.4, 1.1, 1.05],
          [0.3, 4.3, -0.5, 1.0, 0.96],
          [-0.4, 3.9, 0.8, 0.95, 1.04],
        ]
      : [
          [0, 3.45, 0, 1.36],
          [1.05, 2.95, 0.35, 0.98, 0.92],
          [-0.95, 3.05, -0.4, 1.02, 1.05],
          [0.3, 4.25, -0.45, 0.96, 0.97],
          [-0.4, 3.95, 0.82, 0.92, 1.04],
          [0.9, 3.75, -0.85, 0.68, 0.98],
          [-0.95, 3.45, 0.8, 0.7, 0.93],
        ];
  parts.push(canopy(puffs, build, p.tall, 0.92, 2.0, 5.0, 0.62, 1.08, 3));
  if (!far) parts.push(crownSnow(build, [0.05, 4.5, -0.1], 0.82));
  return dropSlivers(merge(parts));
}

/** Sakura Ridge: a paler, spreading blossom tree on a taller, leaning trunk. */
export function paleBlossomGeometry(p: Palette, build: CanopyBuild = 'near'): BufferGeometry {
  reseed(313);
  const far = build === 'far';
  const parts: BufferGeometry[] = [part(new CylinderGeometry(0.14, 0.26, 3.0, far ? 3 : build === 'lean' ? 5 : 6, 1, far || build === 'lean'), new Color('#5A3A3E'), { pos: [0.12, 1.5, 0], rot: [0, 0, -0.08], jitter: far ? 0 : 0.05 })];
  const pinkA = p.tall.clone().lerp(new Color('#FFFFFF'), 0.42);
  const puffs: Puff[] = far
    ? [
        [0.2, 3.45, 0, 1.35],
        [1.3, 3.05, 0.2, 0.98, 0.9],
        [-1.1, 3.1, -0.3, 1.0, 1.04],
      ]
    : build === 'lean'
      ? [
          [0.2, 3.5, 0, 1.2],
          [1.4, 3.05, 0.2, 0.9, 0.88],
          [-1.1, 3.15, -0.3, 0.95, 1.03],
          [0.3, 3.0, 1.15, 0.82, 0.9],
          [-0.2, 2.95, -1.15, 0.86, 1.02],
        ]
      : [
          [0.2, 3.55, 0, 1.12],
          [1.4, 3.08, 0.2, 0.86, 0.88],
          [-1.1, 3.18, -0.3, 0.9, 1.03],
          [0.3, 3.02, 1.15, 0.8, 0.9],
          [-0.2, 2.98, -1.15, 0.84, 1.02],
          [0.95, 3.5, 0.85, 0.62, 0.97],
          [-0.75, 3.62, 0.7, 0.6, 0.94],
        ];
  // (A wine-rose underside lifting to the crown, as blossomGeometry.)
  parts.push(canopy(puffs, build, pinkA, 0.78, 2.2, 4.4, 0.66, 1.06, 9));
  if (!far) parts.push(crownSnow(build, [0.2, 4.0, 0], 0.86));
  return dropSlivers(merge(parts));
}

/** A street's blossom tree's canopy (town.ts), in the orchards' near build: its puffs, a pink, and the
 *  heights its underside and crown stand at. */
export function streetBlossomCanopy(pink: Color, puffs: readonly Puff[], y0: number, y1: number): BufferGeometry {
  return canopy(puffs, 'near', pink, 0.82, y0, y1, 0.74, 1.04, 17);
}

/** The two forest variant sets for a biome: 'a' and 'b', each [the original tree, a variant]. Each
 *  instance picks one (see props.ts forest()). At `lod` 1 and 2 the bough pines and the snag are
 *  their cheaper builds (Low's own trees and the far trees); the other biomes' pieces are already
 *  light, and stay as they are at every lod (hasLod). */
export function forestSteps(biome: BiomeId, p: Palette, set: 'a' | 'b', lod: Lod = 0): Array<() => BufferGeometry> {
  const a = set === 'a';
  if (biome === 'alpine') return a ? [() => boughPineGeometry(p, 1, lod), () => heavyPineGeometry(p, lod)] : [() => youngPineGeometry(p, lod), () => snagGeometry(lod)];
  if (biome === 'glacier') return a ? [() => spireGeometry(p), () => brokenSpireGeometry(p)] : [() => seracGeometry(p), () => iceMoundGeometry(p)];
  // Ember's second set is its basalt in formations (groves.ts): the organ pipes first (Low's one
  // piece), then the clusters round their feet and the sentinels that frame a leap.
  if (biome === 'volcanic') return a ? [() => charPineGeometry(p), () => charSnagGeometry(p)] : [() => organPipeGeometry(p), () => basaltClusterGeometry(p), () => basaltSentinelGeometry(p)];
  // Lanternfall: ink conifers hold the values, and bare silver trees are the light shape among them (the
  // second of them hung with small lit lanterns: the lamp grove's own tree).
  if (biome === 'lantern') return a ? [() => boughPineGeometry(p, 5, lod), () => heavyPineGeometry(p, lod)] : [() => silverTreeGeometry(0, false), () => silverTreeGeometry(1, true)];
  // The Old Run (round 9): an old wood of bare winter trees, beeches and birches, never the five's spruces
  // (oldrunflora.ts).
  if (biome === 'oldrun') return a ? [() => bareTreeGeometry('beech', lod), () => bareTreeGeometry('oldbeech', lod)] : [() => bareTreeGeometry('birch', lod), () => bareTreeGeometry('twinbirch', lod)];
  // (Sakura's blossom has a build a level: the treeline's and near rows' rounded puffs, Low's leaner ones, and
  // the far orchards' three puffs: chamfer.ts's lift, the visual lift's blossom.)
  const bl: CanopyBuild = lod === 0 ? 'near' : lod === 1 ? 'lean' : 'far';
  return a ? [() => blossomGeometry(p, bl), () => paleBlossomGeometry(p, bl)] : [() => boughPineGeometry(p, 3, lod, CEDAR), () => youngPineGeometry(p, lod, CEDAR)];
}

/** The near trees of a forest set (round 8, nearforest.ts), one maker a pick, in forestSteps' order: the spruces and
 *  the blossom are built for the lens (nearPineGeometry, the blossom's 'close' build on High and its rich one on
 *  Medium); what is already fine at the lens (a snag, a silver tree) is its own full build. */
export function nearSteps(biome: BiomeId, p: Palette, set: 'a' | 'b', nb: NearBuild): Array<() => BufferGeometry> {
  const a = set === 'a';
  const bl: CanopyBuild = nb === 'fine' ? 'close' : 'rich';
  if (biome === 'alpine') return a ? [() => nearPineGeometry(p, 'bough', 1, undefined, nb), () => nearPineGeometry(p, 'heavy', 0, undefined, nb)] : [() => nearPineGeometry(p, 'young', 0, undefined, nb), () => snagGeometry(0)];
  if (biome === 'lantern') return a ? [() => nearPineGeometry(p, 'bough', 5, undefined, nb), () => nearPineGeometry(p, 'heavy', 0, undefined, nb)] : forestSteps(biome, p, set, 0);
  if (biome === 'blossom') return a ? [() => blossomGeometry(p, bl), () => paleBlossomGeometry(p, bl)] : [() => nearPineGeometry(p, 'bough', 3, CEDAR, nb), () => nearPineGeometry(p, 'young', 0, CEDAR, nb)];
  return forestSteps(biome, p, set, 0);
}

/** Whether a biome's forest wall hands its trees near the lens to the near trees (its wall moves in the wind: the
 *  spruce and blossom mountains; Frostfang's ice and Ember's basalt stand still and are drawn as they are). */
export function nearWall(biome: BiomeId): boolean {
  return biome === 'alpine' || biome === 'lantern' || biome === 'blossom';
}

/** Whether a biome's set has cheaper builds at lod 1 and 2 (else every lod is the full set). */
export function hasLod(biome: BiomeId, set: 'a' | 'b'): boolean {
  return biome === 'alpine' || biome === 'blossom' || biome === 'oldrun' || (biome === 'lantern' && set === 'a');
}

/** A forest set made at once (tests and probes; the game makes it a variant per idle callback). */
export function forestSet(biome: BiomeId, p: Palette, set: 'a' | 'b', lod: Lod = 0): BufferGeometry {
  return variantSet(forestSteps(biome, p, set, lod).map((f) => f()));
}

/** The first variant of each set, for the first frames before the sets are made on idle time. */
export function forestBase(biome: BiomeId, p: Palette, lod: Lod = 0): { a: BufferGeometry; b: BufferGeometry } {
  return { a: forestSteps(biome, p, 'a', lod)[0](), b: forestSteps(biome, p, 'b', lod)[0]() };
}

/** Chance an instance of set 'a' or 'b' takes the variant (pick 1) rather than the original. */
export const VARIANT_SHARE: Record<BiomeId, { a: number; b: number }> = {
  alpine: { a: 0.3, b: 0.24 },
  // (The Old Run, round 9: a veteran beech in four, and one birch in three a coppiced pair.)
  oldrun: { a: 0.25, b: 0.33 },
  glacier: { a: 0.3, b: 0.4 },
  volcanic: { a: 0.35, b: 0.4 },
  blossom: { a: 0.4, b: 0.4 },
  lantern: { a: 0.3, b: 0.3 },
  // (Gullhaven, round 9: Pinecrest's, never read for a tree that stands: no forest grows on its moor or its cliff, gullhavenplan.ts gullhavenClearings.)
  gullhaven: { a: 0.3, b: 0.24 },
};

/** Whether a pick is an upright tree that may lean (mounds, stubs and seracs stay planted). */
export function canLean(biome: BiomeId, set: 'a' | 'b', pick: number): boolean {
  if (biome === 'alpine') return !(set === 'a' && pick === 1);
  if (biome === 'glacier') return set === 'a';
  if (biome === 'volcanic') return set === 'a';
  return true;
}
