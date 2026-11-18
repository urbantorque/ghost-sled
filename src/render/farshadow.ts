import { DataTexture, DataUtils, HalfFloatType, LinearFilter, RGBAFormat, type BufferGeometry, type Texture, Vector2, Vector3, Vector4, type WebGLRenderer } from 'three';
import { CHUNK_LEN, type Course } from '../sim/course';

// The far-shadow field (the visual lift, DECISIONS 360 and 361): how much of the key light reaches anything
// over the course window, out past the near shadow map's reach and on Low, which has no shadow map at all.
//
// It is a set of world-space tiles baked on idle time for each stretch's own sun (palette.ts: the light is
// keyed to metres, so a stretch's sun is known before the rider gets there):
//  - fine tiles, one a chunk of course (64 m) and 282 m across, 1.1 m by 2 m a texel, from a chunk behind
//    the rider to the end of the streamed terrain: the terrain's own banks, walls and ridges, the forest,
//    the run's hazards, the bank dressing and the set pieces;
//  - coarse tiles, 256 m of course and 2.56 km across, 10 m by 16 m a texel, over the mid-ground's window:
//    the flanks and the valley (midground.ts), so a spur or the far wall lays its shadow over the valley.
// A texel does not hold "lit or not": it holds the shadow's ceiling there, the height under which the sun is
// hidden, and how soft the shadow is (it softens with the distance to what casts it). Anything at that
// place compares its own height with it: the snow, a tree, a house, the rider far down a shaded valley. A
// ceiling is smooth where a shadow's edge is not, so a coarse texel still draws a clean edge, and the
// terrain's and the casters' are kept apart because the near shadow map has the casters but not the terrain.
//
// How a tile is baked: the casters are laid into a grid turned to the sun (rows run toward it), and one walk
// down each row toward the lens carries the highest ray that has passed over something (a sweep): the
// ceiling at a cell is the highest thing upwind of it, lowered by the ray's slope for every metre between.
// A turned grid keeps a thin tree's shadow whole however the sun stands to the course; the tile is then read
// out of it into the course's own frame.
//
// Every lit material reads it in one function (FAR_GLSL, in materials.ts LIGHT_GLSL).

/** Fine tiles: slots in the atlas, texels across, metres a texel across, rows a chunk and metres a row. */
export const FINE_SLOTS = 12;
export const FINE_W = 256;
export const FINE_DX = 1.1;
export const FINE_ROWS = 32;
export const FINE_DZ = CHUNK_LEN / FINE_ROWS;
/** Coarse tiles: slots, metres a texel across, rows a tile (one a mid-ground row, 16 m) and its length. */
export const COARSE_SLOTS = 8;
export const COARSE_W = 256;
export const COARSE_DX = 10;
export const COARSE_ROWS = 16;
export const COARSE_DZ = 16;
export const COARSE_LEN = COARSE_ROWS * COARSE_DZ;
/** Each tile carries a row either side of its own (the neighbouring stretch's, baked the same way), so the
 *  filter never reads another tile across a seam. */
const FINE_H = FINE_ROWS + 2;
const COARSE_H = COARSE_ROWS + 2;
export const ATLAS_W = 256;
export const ATLAS_H = FINE_SLOTS * FINE_H + COARSE_SLOTS * COARSE_H;
const COARSE_V0 = FINE_SLOTS * FINE_H;

/** No caster upwind. Stored ceilings are clamped to FLOOR under the tile's own base height. */
const NONE = -1e9;
/** A free slot's key (never a chunk's or a tile's index). */
const FREE = -99999;
/** How far up and down the run a fine tile looks for set pieces that shadow it (metres). */
const SITE_REACH = 300;
const FINE_FLOOR = -90;
const COARSE_FLOOR = -1600;

/** How soft a shadow is (metres of height either side of its ceiling): at the caster, and per metre the
 *  light travels on past it. Things standing in a shadow use the same band. */
export const SOFT_OBJ = [0.1, 0.028] as const;
export const SOFT_TERRAIN = [0.25, 0.03] as const;
/** How deep a terrain shadow is (of the full strength a caster's has). */
export const TERRAIN_K = 0.82;
/** The terrain's ceiling sits this far under itself, so a slope never shadows its own face. The coarse
 *  tiles' cells are wide, and a smooth flank reads a few metres of curvature as an occluder. */
const BIAS_TERRAIN = 0.55;
const BIAS_COARSE = 3;
const BIAS_OBJ = 0.04;
/** Texels out from a fine tile's middle where it starts to ease into the coarse tile (it is 128 to its side). */
const SIDE_FROM = 112;
/** Where nothing casts, how far the casters' ceiling lies under the terrain's (metres). */
const OPEN_DROP = 1.5;

/** The sweep grids: the casters' (fine), the terrain's near the run, and the valley's. */
const OBJ_DA = 1.5;
const OBJ_DB = 1;
const TER_D = 3;
const VAL_D = 20;
/** How far upwind a tile looks for what shadows it (metres): past this a shadow has thinned to nothing in
 *  the snow's own soft band, and the coarse tiles carry the great ridges. */
const OBJ_MARGIN = 170;
const TER_MARGIN = 260;
const VAL_MARGIN = 1500;
/** A shadow's lowest light: under about 6 degrees a ray runs a whole tile before it falls a metre. */
const MIN_TAN = 0.1;

/** Where the shoulders' row heights come from beyond the run's own ground (midground.ts REF_REACH): past
 *  this many metres from the corridor's edge, the mid-ground's own height model. */
const REF_REACH = 110;

/** The run's own ground as the bake keeps it: metres between samples, how far out from the course's middle
 *  (past the widest corridor and the reference edge), and chunks kept. */
const GROUND_D = 4;
const GROUND_HALF = 148;
const GROUND_COLS = (2 * GROUND_HALF) / GROUND_D + 1;
const GROUND_ROWS = CHUNK_LEN / GROUND_D + 1;
const GROUND_SLOTS = 24;
/** Fine tiles more than this many chunks ahead of the rider wait for their casters to be laid out. */
const WAIT_AHEAD = 4;
/** How often the tiles baked without some of the mid-ground's rows look for them again (seconds). */
const ROW_CHECK_S = 0.4;
/** The valley's height rows (one each mid-ground row), metres between columns and how many. */
const VROW_DX = 10;
const VROW_N = 264;
const VROW_SLOTS = 200;

/** The light's direction over the ground: a unit vector toward the sun in the sim's (x, z) and the slope of
 *  its rays (rise per metre). Built from palette.shadowDir (three.js: z is the sim's negated). */
export interface SunFrame {
  sx: number;
  sz: number;
  tanE: number;
}

export function sunFrame(dir: Vector3, out: SunFrame = { sx: 0, sz: 1, tanE: 0.3 }): SunFrame {
  const h = Math.hypot(dir.x, dir.z);
  if (h < 1e-4) {
    // A sun overhead casts straight down: any horizontal frame will do, and its rays are steep.
    out.sx = 0;
    out.sz = 1;
    out.tanE = 50;
    return out;
  }
  out.sx = dir.x / h;
  out.sz = -dir.z / h;
  out.tanE = Math.max(MIN_TAN, dir.y / h);
  return out;
}

/** How much of the light a point gets under a ceiling `c` with a soft band `s` (the GLSL's smoothstep). */
export function underCeiling(y: number, c: number, s: number): number {
  const t = Math.max(0, Math.min(1, (y - c + s) / (2 * s)));
  return t * t * (3 - 2 * t);
}

/** The near shadow map's weight at a point (1 inside its box, 0 outside, eased over the last part of its
 *  reach): `u`, `v` are the point's light-space offsets from the box's middle, `r` its half size. The GLSL's
 *  blend, so the two never cut against each other at the box's edge. */
export function nearWeight(u: number, v: number, r: number): number {
  if (r <= 0) return 0;
  const q = Math.max(Math.abs(u), Math.abs(v)) / r;
  const t = Math.max(0, Math.min(1, (q - NEAR_FROM) / (NEAR_TO - NEAR_FROM)));
  return 1 - t * t * (3 - 2 * t);
}
/** Where in the near map's box (a share of its half size) the field starts to take over, and where it has. */
export const NEAR_FROM = 0.72;
export const NEAR_TO = 0.96;

/**
 * A grid laid toward the sun: cell (ia, ib) sits ia steps toward the sun (a) and ib across (b), so a row
 * of cells along a is one line of light. `occ` holds what stands in each cell (a world height, NONE for
 * nothing), and sweep() writes each cell's ceiling (the highest ray over anything strictly upwind of it,
 * so nothing shadows itself from its own cell) and the metres from the cell to what casts it.
 */
export class SweepGrid {
  sx = 0;
  sz = 1;
  tanE = 0.3;
  a0 = 0;
  b0 = 0;
  da = 1;
  db = 1;
  na = 0;
  nb = 0;
  occ = new Float32Array(0);
  ceil = new Float32Array(0);
  dist = new Float32Array(0);

  /** Lays the grid over the sim rectangle [x0, x1] x [z0, z1], reaching `margin` metres further toward the
   *  sun, with cells da by db, and clears it. */
  fit(sun: SunFrame, x0: number, x1: number, z0: number, z1: number, margin: number, da: number, db: number): void {
    this.sx = sun.sx;
    this.sz = sun.sz;
    this.tanE = sun.tanE;
    this.da = da;
    this.db = db;
    let amin = Infinity;
    let amax = -Infinity;
    let bmin = Infinity;
    let bmax = -Infinity;
    for (let k = 0; k < 4; k++) {
      const x = k & 1 ? x1 : x0;
      const z = k & 2 ? z1 : z0;
      const a = x * sun.sx + z * sun.sz;
      const b = -x * sun.sz + z * sun.sx;
      amin = Math.min(amin, a);
      amax = Math.max(amax, a);
      bmin = Math.min(bmin, b);
      bmax = Math.max(bmax, b);
    }
    this.a0 = amin - da;
    this.b0 = bmin - db;
    this.na = Math.ceil((amax + margin - this.a0) / da) + 2;
    this.nb = Math.ceil((bmax - this.b0) / db) + 2;
    const n = this.na * this.nb;
    if (this.occ.length < n) {
      this.occ = new Float32Array(n);
      this.ceil = new Float32Array(n);
      this.dist = new Float32Array(n);
    }
    this.occ.fill(NONE, 0, n);
  }

  /** The sim x and z of a cell's middle. */
  cellX(ia: number, ib: number): number {
    const a = this.a0 + (ia + 0.5) * this.da;
    const b = this.b0 + (ib + 0.5) * this.db;
    return a * this.sx - b * this.sz;
  }
  cellZ(ia: number, ib: number): number {
    const a = this.a0 + (ia + 0.5) * this.da;
    const b = this.b0 + (ib + 0.5) * this.db;
    return a * this.sz + b * this.sx;
  }

  /** Raises one cell's occluder (a sim point) to `top`. */
  point(x: number, z: number, top: number): void {
    const ia = Math.floor((x * this.sx + z * this.sz - this.a0) / this.da);
    const ib = Math.floor((-x * this.sz + z * this.sx - this.b0) / this.db);
    if (ia < 0 || ib < 0 || ia >= this.na || ib >= this.nb) return;
    const i = ib * this.na + ia;
    if (top > this.occ[i]) this.occ[i] = top;
  }

  /** A cone standing on y0 at sim (x, z): radius r at its foot, its tip at `top` (a tree). */
  cone(x: number, z: number, y0: number, top: number, r: number): void {
    const a = x * this.sx + z * this.sz - this.a0;
    const b = -x * this.sz + z * this.sx - this.b0;
    const reach = r + Math.max(this.da, this.db);
    const ia0 = Math.max(0, Math.floor((a - reach) / this.da));
    const ia1 = Math.min(this.na - 1, Math.floor((a + reach) / this.da));
    const ib0 = Math.max(0, Math.floor((b - reach) / this.db));
    const ib1 = Math.min(this.nb - 1, Math.floor((b + reach) / this.db));
    const h = top - y0;
    let hit = false;
    // Each cell holds the cone's highest point over it (measured from the cell's nearest point to the axis), so
    // the tip is never lost between cell centres and the shadow is as long as the tree.
    const ha = this.da / 2;
    const hb = this.db / 2;
    for (let ib = ib0; ib <= ib1; ib++) {
      const cb = Math.max(0, Math.abs((ib + 0.5) * this.db - b) - hb);
      for (let ia = ia0; ia <= ia1; ia++) {
        const ca = Math.max(0, Math.abs((ia + 0.5) * this.da - a) - ha);
        const d = Math.sqrt(ca * ca + cb * cb);
        if (d > r) continue;
        const y = y0 + h * Math.max(0, 1 - d / Math.max(r, 0.01));
        const i = ib * this.na + ia;
        if (y > this.occ[i]) this.occ[i] = y;
        hit = true;
      }
    }
    // (A trunk thinner than a cell still stands in the one it is in.)
    if (!hit) this.point(x, z, top);
  }

  /** A box standing at sim (cx, cz) with half extents hx along (ex, ez) and hz across it, its top at `top`. */
  box(cx: number, cz: number, hx: number, hz: number, ex: number, ez: number, top: number): void {
    const a = cx * this.sx + cz * this.sz - this.a0;
    const b = -cx * this.sz + cz * this.sx - this.b0;
    // The box's axes in the grid's frame.
    const e1a = ex * this.sx + ez * this.sz;
    const e1b = -ex * this.sz + ez * this.sx;
    const ra = Math.abs(e1a) * hx + Math.abs(e1b) * hz + this.da;
    const rb = Math.abs(e1b) * hx + Math.abs(e1a) * hz + this.db;
    const ia0 = Math.max(0, Math.floor((a - ra) / this.da));
    const ia1 = Math.min(this.na - 1, Math.floor((a + ra) / this.da));
    const ib0 = Math.max(0, Math.floor((b - rb) / this.db));
    const ib1 = Math.min(this.nb - 1, Math.floor((b + rb) / this.db));
    const px = hx + 0.35 * this.da;
    const pz = hz + 0.35 * this.db;
    let hit = false;
    for (let ib = ib0; ib <= ib1; ib++) {
      const cb = (ib + 0.5) * this.db - b;
      for (let ia = ia0; ia <= ia1; ia++) {
        const ca = (ia + 0.5) * this.da - a;
        // (ca, cb) in the box's own axes: e1 = (e1a, e1b), e2 = (-e1b, e1a).
        const u = ca * e1a + cb * e1b;
        const w = -ca * e1b + cb * e1a;
        if (Math.abs(u) > px || Math.abs(w) > pz) continue;
        const i = ib * this.na + ia;
        if (top > this.occ[i]) this.occ[i] = top;
        hit = true;
      }
    }
    if (!hit) this.point(cx, cz, top);
  }

  /** Every cell's ceiling and the metres to what casts it, walking each line of light from the sun's end. */
  sweep(): void {
    const na = this.na;
    const fall = this.da * this.tanE;
    for (let ib = 0; ib < this.nb; ib++) {
      const row = ib * na;
      let c = NONE;
      let d = 0;
      for (let ia = na - 1; ia >= 0; ia--) {
        const i = row + ia;
        this.ceil[i] = c;
        this.dist[i] = d;
        const o = this.occ[i];
        if (o >= c) {
          c = o;
          d = 0;
        }
        c -= fall;
        d += this.da;
      }
    }
  }

  /** The ceiling and the distance to its caster at sim (x, z), read across the four nearest cells (each
   *  ceiling held at least at `floor`). Writes out.x, out.y. */
  sample(x: number, z: number, floor: number, out: Vector2): Vector2 {
    const fa = (x * this.sx + z * this.sz - this.a0) / this.da - 0.5;
    const fb = (-x * this.sz + z * this.sx - this.b0) / this.db - 0.5;
    const ia = Math.max(0, Math.min(this.na - 2, Math.floor(fa)));
    const ib = Math.max(0, Math.min(this.nb - 2, Math.floor(fb)));
    const ta = Math.max(0, Math.min(1, fa - ia));
    const tb = Math.max(0, Math.min(1, fb - ib));
    const i = ib * this.na + ia;
    const j = i + this.na;
    const c = this.ceil;
    const d = this.dist;
    const c00 = Math.max(floor, c[i]);
    const c10 = Math.max(floor, c[i + 1]);
    const c01 = Math.max(floor, c[j]);
    const c11 = Math.max(floor, c[j + 1]);
    out.x = (c00 * (1 - ta) + c10 * ta) * (1 - tb) + (c01 * (1 - ta) + c11 * ta) * tb;
    // The distance follows whichever corner casts highest (a mean would blend a near and a far caster).
    let best = c00;
    out.y = d[i];
    if (c10 > best) {
      best = c10;
      out.y = d[i + 1];
    }
    if (c01 > best) {
      best = c01;
      out.y = d[j];
    }
    if (c11 > best) {
      best = c11;
      out.y = d[j + 1];
    }
    // (Nothing casts here: no distance to soften by.)
    if (best <= floor) out.y = 0;
    return out;
  }
}

/** What casts, one record a caster: kind (0 a cone, 1 a box), sim x and z, its foot's height and its top,
 *  then a cone's radius, or a box's half extents along and across (ex, ez). */
export const CASTER = 9;
export class Casters {
  data = new Float32Array(CASTER * 512);
  n = 0;
  clear(): void {
    this.n = 0;
  }
  private room(): number {
    if ((this.n + 1) * CASTER > this.data.length) {
      const d = new Float32Array(this.data.length * 2);
      d.set(this.data);
      this.data = d;
    }
    return this.n++ * CASTER;
  }
  cone(x: number, z: number, y0: number, top: number, r: number): void {
    const o = this.room();
    const d = this.data;
    d[o] = 0;
    d[o + 1] = x;
    d[o + 2] = z;
    d[o + 3] = y0;
    d[o + 4] = top;
    d[o + 5] = r;
  }
  box(x: number, z: number, y0: number, top: number, hx: number, hz: number, ex: number, ez: number): void {
    const o = this.room();
    const d = this.data;
    d[o] = 1;
    d[o + 1] = x;
    d[o + 2] = z;
    d[o + 3] = y0;
    d[o + 4] = top;
    d[o + 5] = hx;
    d[o + 6] = hz;
    d[o + 7] = ex;
    d[o + 8] = ez;
  }
}

/** A set piece as the field sees it: its frame (landmarks.ts Site) and its made geometry, in that frame. */
export interface FarSite {
  n: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** Its half length along the run (0 for one at a point). */
  len: number;
  /** Over the run (a gate, a bridge): what hangs over the corridor casts nothing here (posts and towers do). */
  span: boolean;
  /** A roof over the run: the whole of it casts (its floor lies in its shadow). */
  roof: boolean;
}

/** What the field reads of the world (World supplies it; the tests a flat slope and a tree). */
export interface FarWorld {
  readonly course: Course;
  /** The shadow light's direction (three.js, toward the light) for the stretch at sim z: what the casters' shadows
   *  fall from (palette.shadowDir: low and swung across the slope, so they rake toward the lens). */
  sunAt(z: number, out: Vector3): Vector3;
  /** The key light that shades the snow there (palette.sunDir, lifted so slopes stay lit at sunset: DECISIONS 27):
   *  what the far ridges' shadows fall from, so a spur a kilometre off never lays a whole run in its shade. */
  keyAt(z: number, out: Vector3): Vector3;
  /** The ground as drawn near the run at sim (x, z). */
  ground(x: number, z: number): number;
  /** The far shoulders as drawn along mid-ground row r (sim z = 16 r): n heights from world x0 every dx metres,
   *  NaN over the run's own ground (where ground() holds). 1 written, 0 not built yet, -1 never built here. */
  shoulders(r: number, x0: number, dx: number, n: number, out: Float32Array, at: number): number;
  /** What stands in chunk i and casts; false (and nothing written) while the chunk is not laid out. */
  casters(i: number, out: Casters | null): boolean;
  /** The made set pieces whose span touches sim [z0, z1]. */
  sites(z0: number, z1: number, cb: (site: FarSite, geo: BufferGeometry) => void): void;
}

/** One slot's tile, as baked. */
interface Tile {
  /** The chunk (fine) or the coarse tile's index; NaN while free. */
  key: number;
  /** The sim x its columns centre on, and the height its ceilings are stored under. */
  xc: number;
  base: number;
  /** Seconds since it was uploaded (its casters fade in). */
  age: number;
  /** The set pieces it was baked with (fine), and whether one has been made since (it is baked again). */
  sites: Set<number>;
  stale: boolean;
  /** Chunks whose casters were not laid out when it was baked, and the mid-ground's rows still to be built then
   *  (it is baked again once they are). */
  missing: number[];
  rows: number[];
  /** Its sun's way down the run (+1 straight down it): which way its upwind set pieces lie. */
  sz: number;
  /** Coarse tiles keep their ceilings on the CPU for the fine tiles' terrain. */
  ceil?: Float32Array;
  soft?: Float32Array;
}

/** A tile being baked: which stage it is at, and where in that stage. */
interface Job {
  fine: boolean;
  key: number;
  slot: number;
  stage: number;
  row: number;
  sun: SunFrame;
  /** The key light's frame, for the far ridges (coarse tiles). */
  lit: SunFrame;
  xc: number;
  base: number;
  z0: number;
  z1: number;
  sites: Set<number>;
  missing: number[];
  /** The mid-ground's rows it stood on that were still to be built. */
  rows: number[];
  /** Where a set piece's cells were left off (a big town is laid in over several slices). */
  cell: number;
}

/** The GLSL every lit material shares (materials.ts LIGHT_GLSL). farShadow(wp, near) takes the near shadow
 *  map's answer at world position wp (1 where there is none) and returns the light that reaches wp: inside
 *  the near map's box its casters, eased over the last part of its reach into the field's, and everywhere the
 *  terrain's own shadow (which the near map never had). On Low the field is the only cast shadow there is. */
export const FAR_GLSL = /* glsl */ `
uniform sampler2D uFarMap;
/** Per slot: the sim x its columns centre on, the chunk (fine) or tile (coarse) it holds, its ceilings'
 *  base height, and how far its casters have faded in. Fine slots first. */
uniform vec4 uFarSlot[${FINE_SLOTS + COARSE_SLOTS}];
/** The near shadow map's box: its middle and half size (w 0: no map), and the light's two axes across it. */
uniform vec4 uFarBox[3];
/** x: 1 while any tile is ready, y: the field's strength (the palette's), z: how far a shadow thins, w: how
 *  much wider every soft band is (1 in a clear sun). */
uniform vec4 uFarK;
float farShadow(vec3 wp, float nearShadow) {
  if (uFarK.x <= 0.0) return nearShadow;
  float z = -wp.z;
  float ci = floor(z * ${(1 / CHUNK_LEN).toFixed(6)});
  float k = mod(ci, ${FINE_SLOTS.toFixed(1)});
  vec4 sl = uFarSlot[int(k + 0.5)];
  float u = ${(FINE_W / 2).toFixed(1)} + (wp.x - sl.x) * ${(1 / FINE_DX).toFixed(6)};
  vec2 px;
  if (sl.y == ci && u > 1.0 && u < ${(FINE_W - 1).toFixed(1)}) {
    px = vec2(u, k * ${FINE_H.toFixed(1)} + 1.0 + (z - ci * ${CHUNK_LEN.toFixed(1)}) * ${(1 / FINE_DZ).toFixed(6)});
  } else {
    float ti = floor(z * ${(1 / COARSE_LEN).toFixed(6)});
    k = mod(ti, ${COARSE_SLOTS.toFixed(1)});
    sl = uFarSlot[${FINE_SLOTS} + int(k + 0.5)];
    u = ${(COARSE_W / 2).toFixed(1)} + (wp.x - sl.x) * ${(1 / COARSE_DX).toFixed(6)};
    if (sl.y != ti || u < 1.0 || u > ${(COARSE_W - 1).toFixed(1)}) return nearShadow;
    px = vec2(u, ${COARSE_V0.toFixed(1)} + k * ${COARSE_H.toFixed(1)} + 1.0 + (z - ti * ${COARSE_LEN.toFixed(1)}) * ${(1 / COARSE_DZ).toFixed(6)});
  }
  vec4 f = textureLod(uFarMap, px * vec2(${(1 / ATLAS_W).toFixed(8)}, ${(1 / ATLAS_H).toFixed(8)}), 0.0);
  float y = wp.y - sl.z;
  f.yw *= uFarK.w;
  float terr = smoothstep(-f.y, f.y, y - f.x);
  // A caster's shadow thins as it reaches away from it (ART.md 4: long shadows taper into soft blue).
  float obj = max(smoothstep(-f.w, f.w, y - f.z), uFarK.z * smoothstep(${SOFT_OBJ[0].toFixed(3)}, ${(SOFT_OBJ[0] + SOFT_OBJ[1] * 70).toFixed(3)}, f.w / uFarK.w));
  vec3 r = wp - uFarBox[0].xyz;
  float q = max(abs(dot(r, uFarBox[1].xyz)), abs(dot(r, uFarBox[2].xyz))) / max(uFarBox[0].w, 1e-3);
  float nearK = uFarBox[0].w > 0.0 ? 1.0 - smoothstep(${NEAR_FROM.toFixed(3)}, ${NEAR_TO.toFixed(3)}, q) : 0.0;
  // (A ridge's shadow keeps a little light, so the trees' own shadows still read inside it.)
  return min(mix(mix(1.0, obj, uFarK.y * sl.w), nearShadow, nearK), mix(1.0, terr, uFarK.y * ${TERRAIN_K.toFixed(2)}));
}
`;

const dummy = new DataTexture(new Uint16Array([0, 0, 0, 0]), 1, 1, RGBAFormat, HalfFloatType);
dummy.needsUpdate = true;

/** The field's uniforms, spread into materials.ts `shared` so every lit material has them. */
export const farUniforms = {
  uFarMap: { value: dummy as Texture },
  uFarSlot: { value: Array.from({ length: FINE_SLOTS + COARSE_SLOTS }, () => new Vector4(0, FREE, 0, 0)) },
  uFarBox: { value: [new Vector4(), new Vector4(1, 0, 0, 0), new Vector4(0, 1, 0, 0)] },
  uFarK: { value: new Vector4(0, 1, 0.42, 1) },
};

/** Runs fn on idle time with its deadline, or soon after where there is none (Safari). */
function whenIdle(fn: (deadline: IdleDeadline | null) => void): void {
  // (A busy frame leaves no idle time at all: a starved queue still runs a slice every IDLE_LATE_MS.)
  if (typeof requestIdleCallback === 'function') requestIdleCallback((d) => fn(d), { timeout: IDLE_LATE_MS });
  else setTimeout(() => fn(null), 30);
}

const tmp2 = new Vector2();
const tmp2b = new Vector2();
const tmp3 = new Vector3();

/** The longest an idle callback waits before it runs a slice anyway (ms). */
const IDLE_LATE_MS = 200;
/** The longest a job may run before it hands the main thread back (ms). */
const SLICE_MS = 1.6;
/** Nothing is baked before this long after the first frame (ms). */
const START_MS = 900;
/** Seconds a fresh tile's casters take to fade in. */
const FADE_S = 0.6;

/**
 * The field: its tiles, the atlas they live in, and the idle-time jobs that bake them. update() each frame
 * (the window to keep, the near map's box and the light's strength); everything else happens on idle time.
 */
export class FarShadow {
  private atlas: DataTexture | null = null;
  private stageFine = new DataTexture(new Uint16Array(ATLAS_W * FINE_H * 4), ATLAS_W, FINE_H, RGBAFormat, HalfFloatType);
  private stageCoarse = new DataTexture(new Uint16Array(ATLAS_W * COARSE_H * 4), ATLAS_W, COARSE_H, RGBAFormat, HalfFloatType);
  private fine: Tile[] = Array.from({ length: FINE_SLOTS }, () => ({ key: NaN, xc: 0, base: 0, age: 0, sites: new Set<number>(), stale: false, missing: [] as number[], rows: [] as number[], sz: 0 }));
  private coarse: Tile[] = Array.from({ length: COARSE_SLOTS }, () => ({ key: NaN, xc: 0, base: 0, age: 0, sites: new Set<number>(), stale: false, missing: [] as number[], rows: [] as number[], sz: 0, ceil: new Float32Array(COARSE_W * COARSE_H), soft: new Float32Array(COARSE_W * COARSE_H) }));
  private job: Job | null = null;
  private obj = new SweepGrid();
  private ter = new SweepGrid();
  private val = new SweepGrid();
  private casters = new Casters();
  /** A coarse tile's ceilings and soft bands while it is read out (copied to its slot once uploaded). */
  private cCeil = new Float32Array(COARSE_W * COARSE_H);
  private cSoft = new Float32Array(COARSE_W * COARSE_H);
  /** Each mid-ground row's heights (VROW_N columns, VROW_DX apart, centred on the course at that row). */
  private vrow = new Float32Array(VROW_N * VROW_SLOTS);
  private vrowKey = new Float64Array(VROW_SLOTS).fill(NaN);
  /** The run's own ground, a chunk a slot (groundChunk): heights, the chunk each slot holds and is filling,
   *  how many rows are in, and the x its columns centre on. */
  private grid = new Float32Array(GROUND_SLOTS * GROUND_COLS * GROUND_ROWS);
  private gKey = new Float64Array(GROUND_SLOTS).fill(NaN);
  private gFill = new Float64Array(GROUND_SLOTS).fill(NaN);
  private gRow = new Int32Array(GROUND_SLOTS);
  private gXc = new Float32Array(GROUND_SLOTS);
  private vrowXc = new Float32Array(VROW_SLOTS);
  /** The set pieces' standing cells (sim x, z, top), made once a piece and kept while it is made. */
  private siteCells = new Map<number, { geo: BufferGeometry; cells: Float32Array | null; job: SiteCells | null }>();
  private renderer: WebGLRenderer | null = null;
  private idleOpen = false;
  private idleBusy = false;
  private started = false;
  /** The window to keep: chunks [c0, c1], coarse tiles [t0, t1], and the rider's sim z (nearest first). */
  private c0 = 0;
  private c1 = -1;
  private t0 = 0;
  private t1 = -1;
  private riderZ = 0;
  private gen = 0;
  private rowCheck = 0;
  private sunOut = new Vector3();
  /** The longest single job (ms), how many there were, and each kind's total (ms). */
  readonly stats = { maxJobMs: 0, jobs: 0, fineMs: 0, coarseMs: 0, fineTiles: 0, coarseTiles: 0, siteMs: 0, uploadMs: 0, initMs: 0, uploads: [] as number[], worst: '', top: [] as string[], over: [0, 0, 0, 0] };

  constructor(private world: FarWorld) {
    this.stageFine.flipY = false;
    this.stageCoarse.flipY = false;
  }

  /** Everything baked is dropped and made again (a new course, mood or tier). */
  invalidate(): void {
    this.gen++;
    this.job = null;
    for (const t of this.fine) t.key = NaN;
    for (const t of this.coarse) t.key = NaN;
    this.vrowKey.fill(NaN);
    this.gKey.fill(NaN);
    this.gFill.fill(NaN);
    for (const s of farUniforms.uFarSlot.value) s.y = FREE;
    farUniforms.uFarK.value.x = 0;
    this.siteCells.clear();
    this.pump();
  }

  /**
   * Per frame: the rider's sim z, the chunk window the terrain streams [c0, c1], how far ahead the mid-ground
   * reaches, the light's strength (palette.shadowK and how soft the sun is), how much wider every shadow's
   * soft band is (a sun behind cloud) and the frame's seconds.
   */
  update(renderer: WebGLRenderer, riderZ: number, c0: number, c1: number, ahead: number, strength: number, soften: number, dt: number): void {
    this.renderer = renderer;
    if (!this.started) {
      this.started = true;
      setTimeout(() => {
        this.idleOpen = true;
        this.pump();
      }, START_MS);
    }
    this.riderZ = riderZ;
    this.c0 = c0;
    this.c1 = c1;
    this.t0 = Math.floor((riderZ - 200) / COARSE_LEN);
    this.t1 = Math.min(this.t0 + COARSE_SLOTS - 1, Math.floor((riderZ + ahead) / COARSE_LEN));
    const slots = farUniforms.uFarSlot.value;
    let any = false;
    for (let s = 0; s < FINE_SLOTS; s++) {
      const t = this.fine[s];
      if (Number.isNaN(t.key)) continue;
      // (The ring holds the window exactly: a chunk left behind gives its slot to the next one ahead.)
      if (t.key < c0 || t.key > c1) {
        t.key = NaN;
        slots[s].y = FREE;
        continue;
      }
      t.age += dt;
      slots[s].w = Math.min(1, t.age / FADE_S);
      any = true;
    }
    for (let s = 0; s < COARSE_SLOTS; s++) {
      const t = this.coarse[s];
      if (Number.isNaN(t.key)) continue;
      if (t.key < this.t0 || t.key > this.t1) {
        t.key = NaN;
        slots[FINE_SLOTS + s].y = FREE;
        continue;
      }
      t.age += dt;
      slots[FINE_SLOTS + s].w = Math.min(1, t.age / FADE_S);
      any = true;
    }
    const k = farUniforms.uFarK.value;
    k.x = any ? 1 : 0;
    k.y = strength;
    k.w = soften;
    // (A tile the window has left is not finished.)
    const j = this.job;
    if (j && (j.fine ? j.key < c0 || j.key > c1 : j.key < this.t0 || j.key > this.t1)) this.job = null;
    // The mid-ground's rows built since a tile was baked without them: the tile is baked again with them.
    this.rowCheck += dt;
    if (this.rowCheck > ROW_CHECK_S) {
      this.rowCheck = 0;
      for (const t of [...this.fine, ...this.coarse]) {
        if (Number.isNaN(t.key) || t.stale || t.rows.length === 0) continue;
        let got = 0;
        for (const r of t.rows) if (this.world.shoulders(r, 0, 0, 0, this.vrow, 0) === 1) got++;
        if (got * 2 >= t.rows.length) t.stale = true;
      }
    }
    // Casters laid out since a tile was baked (the window moved on): the tile is baked again with them.
    for (const t of this.fine) {
      if (Number.isNaN(t.key) || t.stale || t.missing.length === 0) continue;
      // (Once all of them are: one bake more, not one each time a chunk comes.)
      let all = true;
      for (const i of t.missing) if (!this.world.casters(i, null)) all = false;
      if (all) t.stale = true;
    }
    // A set piece made since a tile was baked: the tile is baked again with it.
    this.world.sites((c0 - 1) * CHUNK_LEN - SITE_REACH, (c1 + 2) * CHUNK_LEN + SITE_REACH, (site) => {
      for (const t of this.fine) {
        if (Number.isNaN(t.key) || t.stale || t.sites.has(site.n)) continue;
        // (Only a piece upwind of the tile, toward its sun, can shadow it.)
        const ahead = SITE_REACH * Math.max(0, t.sz) + 20;
        const behind = SITE_REACH * Math.max(0, -t.sz) + 20;
        if (site.z + site.len > t.key * CHUNK_LEN - behind && site.z - site.len < (t.key + 1) * CHUNK_LEN + ahead) t.stale = true;
      }
    });
    this.pump();
  }

  /** The near shadow map's box this frame: its middle (world), half size (0: none) and the light's direction. */
  setNearBox(cx: number, cy: number, cz: number, r: number, light: Vector3): void {
    const b = farUniforms.uFarBox.value;
    b[0].set(cx, cy, cz, r);
    // The shadow camera's axes as three builds them (looking along -light with y up): x = up x light.
    const h = Math.hypot(light.x, light.z);
    if (h < 1e-4 || r <= 0) {
      b[0].w = 0;
      return;
    }
    b[1].set(light.z / h, 0, -light.x / h, 0);
    tmp3.set(light.z / h, 0, -light.x / h);
    tmp3.crossVectors(light, tmp3).normalize();
    b[2].set(tmp3.x, tmp3.y, tmp3.z, 0);
  }

  /** The next tile to bake, nearest the rider first: a coarse tile before the fine tiles over it. */
  private nextJob(): Job | null {
    const c = this.world.course;
    const zr = this.riderZ;
    const ci = Math.floor(zr / CHUNK_LEN);
    const tr = Math.floor(zr / COARSE_LEN);
    // The coarse tile under the rider, then the fine tiles out from it, then the coarse tiles further on.
    const order: Array<[boolean, number]> = [];
    order.push([false, tr]);
    for (let d = 0; d <= this.c1 - this.c0 + 1; d++) {
      for (const i of d === 0 ? [ci] : [ci + d, ci - d]) {
        if (i < this.c0 || i > this.c1) continue;
        const t = Math.floor((i * CHUNK_LEN) / COARSE_LEN);
        if (!this.hasCoarse(t) && t >= this.t0 && t <= this.t1) order.push([false, t]);
        order.push([true, i]);
      }
    }
    for (let t = this.t0; t <= this.t1; t++) order.push([false, t]);
    for (const [fine, key] of order) {
      if (fine) {
        const s = ((key % FINE_SLOTS) + FINE_SLOTS) % FINE_SLOTS;
        const t = this.fine[s];
        // (Baked already, unless a set piece was made since; or still holding a chunk in the window.)
        if (t.key === key && !t.stale) continue;
        if (!Number.isNaN(t.key) && t.key !== key && t.key >= this.c0 && t.key <= this.c1) continue;
        // A tile far ahead waits for the chunks round it to be laid out (it would be baked twice otherwise); one
        // near the rider is baked with what there is.
        if (key > ci + WAIT_AHEAD && !this.laidOut(key)) continue;
        return this.makeJob(true, key, s);
      }
      if (key < this.t0 || key > this.t1) continue;
      const s = ((key % COARSE_SLOTS) + COARSE_SLOTS) % COARSE_SLOTS;
      const t = this.coarse[s];
      if (t.key === key && !t.stale) continue;
      if (!Number.isNaN(t.key) && t.key !== key && t.key >= this.t0 && t.key <= this.t1) continue;
      return this.makeJob(false, key, s);
    }
    void c;
    return null;
  }

  /** Whether the chunks a tile's casters can stand in (three either way, a shadow's reach) are laid out. */
  private laidOut(i: number): boolean {
    for (let k = i - 3; k <= i + 3; k++) if (k >= 0 && !this.world.casters(k, null)) return false;
    return true;
  }

  private hasCoarse(t: number): boolean {
    const s = ((t % COARSE_SLOTS) + COARSE_SLOTS) % COARSE_SLOTS;
    return this.coarse[s].key === t;
  }

  private makeJob(fine: boolean, key: number, slot: number): Job {
    const c = this.world.course;
    const z0 = fine ? key * CHUNK_LEN : key * COARSE_LEN;
    const z1 = z0 + (fine ? CHUNK_LEN : COARSE_LEN);
    const zm = (z0 + z1) / 2;
    const sun = sunFrame(this.world.sunAt(zm, this.sunOut));
    const lit = sunFrame(this.world.keyAt(zm, this.sunOut));
    return { fine, key, slot, stage: 0, row: 0, sun, lit, xc: c.centerX(zm), base: c.baseY(zm), z0, z1, sites: new Set<number>(), missing: [], rows: [], cell: 0 };
  }

  /** Idle jobs, as many as each idle period has room for. */
  private pump(): void {
    if (!this.idleOpen || this.idleBusy) return;
    if (!this.job) this.job = this.nextJob();
    if (!this.job) return;
    this.idleBusy = true;
    const gen = this.gen;
    whenIdle((deadline) => {
      this.idleBusy = false;
      if (gen !== this.gen) {
        this.pump();
        return;
      }
      for (let k = 0; k < 8; k++) {
        if (!this.job) this.job = this.nextJob();
        const job = this.job;
        if (!job) break;
        const t0 = performance.now();
        const stage = job.stage;
        const done = this.step(job, t0 + SLICE_MS);
        const ms = performance.now() - t0;
        this.stats.jobs++;
        const st = this.stats;
        if (ms > st.maxJobMs) st.worst = (job.fine ? 'fine ' : 'coarse ') + stage + '..' + job.stage;
        st.maxJobMs = Math.max(st.maxJobMs, ms);
        // (Slices over 2, 4, 8 and 16 ms, and the five longest, for play-tests.)
        for (let b = 0; b < 4; b++) if (ms > 2 << b) st.over[b]++;
        if (ms > 2) {
          st.top.push(ms.toFixed(1) + ' ' + (job.fine ? 'fine ' : 'coarse ') + stage + '..' + job.stage);
          st.top.sort((a, b) => parseFloat(b) - parseFloat(a));
          if (st.top.length > 5) st.top.length = 5;
        }
        if (job.fine) this.stats.fineMs += ms;
        else this.stats.coarseMs += ms;
        if (done) this.job = null;
        if (!deadline || deadline.timeRemaining() < 3) break;
      }
      this.pump();
    });
  }

  /** Runs a job until `until` (performance.now ms); true when its tile is in the atlas. */
  private step(job: Job, until: number): boolean {
    return job.fine ? this.stepFine(job, until) : this.stepCoarse(job, until);
  }

  // ------------------------------------------------------------------ the valley (coarse tiles)

  /**
   * Valley row r (sim z = 16 r): the mid-ground's built row, and the run's own ground between its edges, kept
   * in a ring. False while the mid-ground has still to build it. A row it never builds stays unknown (open sky):
   * nothing is planned or laid out here for the asking, so no job pays for another system's first look.
   */
  private valleyRow(r: number): boolean {
    const s = ((r % VROW_SLOTS) + VROW_SLOTS) % VROW_SLOTS;
    if (this.vrowKey[s] === r) return true;
    const c = this.world.course;
    const z = r * COARSE_DZ;
    const xc = c.centerX(z);
    const x0 = xc - (VROW_N / 2 - 0.5) * VROW_DX;
    const o = s * VROW_N;
    const got = this.world.shoulders(r, x0, VROW_DX, VROW_N, this.vrow, o);
    if (got <= 0) return got < 0;
    const hw = c.halfWidth(z);
    for (let k = 0; k < VROW_N; k++) {
      const x = x0 + k * VROW_DX;
      if (Number.isNaN(this.vrow[o + k]) || Math.abs(x - xc) - hw <= REF_REACH) this.vrow[o + k] = this.world.ground(x, z);
    }
    this.vrowKey[s] = r;
    this.vrowXc[s] = x0;
    return true;
  }

  /**
   * The run's own ground over chunk i as drawn (ground(), the overlooks' fall in it), every GROUND_D metres
   * across and down out to the reference edge, kept in a ring a chunk a slot. Filled a row at a time until
   * `until`; false while unfinished. Only once its valley rows are in hand: the ground there has been made.
   */
  private groundChunk(i: number, until: number): boolean {
    const s = ((i % GROUND_SLOTS) + GROUND_SLOTS) % GROUND_SLOTS;
    if (this.gKey[s] === i) return true;
    const c = this.world.course;
    if (this.gFill[s] !== i) {
      this.gFill[s] = i;
      this.gRow[s] = 0;
      this.gXc[s] = c.centerX(i * CHUNK_LEN + CHUNK_LEN / 2);
    }
    const x0 = this.gXc[s] - GROUND_HALF;
    const o = s * GROUND_COLS * GROUND_ROWS;
    for (let j = this.gRow[s]; j < GROUND_ROWS; j++) {
      const z = i * CHUNK_LEN + j * GROUND_D;
      if (!this.known(z)) {
        this.grid.fill(NONE, o + j * GROUND_COLS, o + (j + 1) * GROUND_COLS);
      } else {
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        for (let k = 0; k < GROUND_COLS; k++) {
          const x = x0 + k * GROUND_D;
          // (Only the run's own ground, out to the reference edge: the mountainside past it casts through the coarse
          // tiles, by the key light.)
          this.grid[o + j * GROUND_COLS + k] = Math.abs(x - cx) - hw <= REF_REACH ? this.world.ground(x, z) : NONE;
        }
      }
      this.gRow[s] = j + 1;
      if (performance.now() > until && j < GROUND_ROWS - 1) return false;
    }
    this.gKey[s] = i;
    return true;
  }

  /** The run's own ground at sim (x, z) from its ring (NONE past the reference edge and where unknown): what the fine
   *  tiles' terrain casts from, by the low shadow light. */
  private groundAt(x: number, z: number): number {
    const i = Math.floor(z / CHUNK_LEN);
    const s = ((i % GROUND_SLOTS) + GROUND_SLOTS) % GROUND_SLOTS;
    if (this.gKey[s] !== i) return NONE;
    const fu = (x - this.gXc[s] + GROUND_HALF) / GROUND_D;
    if (fu < 0 || fu > GROUND_COLS - 1) return NONE;
    const fv = (z - i * CHUNK_LEN) / GROUND_D;
    const k = Math.min(GROUND_COLS - 2, Math.floor(fu));
    const j = Math.min(GROUND_ROWS - 2, Math.floor(fv));
    const a = fu - k;
    const b = fv - j;
    const o = s * GROUND_COLS * GROUND_ROWS + j * GROUND_COLS + k;
    const g = this.grid;
    const y = (g[o] * (1 - a) + g[o + 1] * a) * (1 - b) + (g[o + GROUND_COLS] * (1 - a) + g[o + GROUND_COLS + 1] * a) * b;
    return y < NONE * 0.5 ? NONE : y;
  }

  /** Whether the ground at sim z has been made (its valley rows are in hand). */
  private known(z: number): boolean {
    const r = Math.floor(z / COARSE_DZ);
    const s = ((r % VROW_SLOTS) + VROW_SLOTS) % VROW_SLOTS;
    const s1 = (s + 1) % VROW_SLOTS;
    return this.vrowKey[s] === r && this.vrowKey[s1] === r + 1;
  }

  /** Makes the valley rows over sim [za, zb] (from job.row on); false until `until` runs out first. A row the
   *  mid-ground has still to build is noted, and the tile is baked again once it is (update). */
  private rows(job: Job, za: number, zb: number, until: number): boolean {
    const r0 = Math.floor(za / COARSE_DZ);
    const r1 = Math.ceil(zb / COARSE_DZ);
    for (let r = r0 + job.row; r <= r1; r++, job.row++) {
      if (!this.valleyRow(r)) job.rows.push(r);
      if (performance.now() > until) {
        job.row++;
        return false;
      }
    }
    return true;
  }

  /** The valley's height at sim (x, z) from its rows (rows not yet made: NONE). */
  private valleyAt(x: number, z: number): number {
    const fr = z / COARSE_DZ;
    const r = Math.floor(fr);
    const t = fr - r;
    const a = this.rowY(r, x);
    const b = this.rowY(r + 1, x);
    if (a <= NONE || b <= NONE) return Math.max(a, b);
    return a + (b - a) * t;
  }

  private rowY(r: number, x: number): number {
    const s = ((r % VROW_SLOTS) + VROW_SLOTS) % VROW_SLOTS;
    if (this.vrowKey[s] !== r) return NONE;
    const f = (x - this.vrowXc[s]) / VROW_DX;
    if (f < 0 || f > VROW_N - 1) return NONE;
    const k = Math.min(VROW_N - 2, Math.floor(f));
    const o = s * VROW_N + k;
    return this.vrow[o] + (this.vrow[o + 1] - this.vrow[o]) * (f - k);
  }

  private stepCoarse(job: Job, until: number): boolean {
    const g = this.val;
    const halfW = (COARSE_W / 2) * COARSE_DX;
    if (job.stage === 0) {
      // The rows of the valley the tile and its upwind reach stand on.
      const za = job.z0 - COARSE_DZ * 2 + Math.min(0, job.lit.sz) * VAL_MARGIN;
      const zb = job.z1 + COARSE_DZ * 2 + Math.max(0, job.lit.sz) * VAL_MARGIN;
      if (!this.rows(job, za, zb, until)) return false;
      g.fit(job.lit, job.xc - halfW, job.xc + halfW, job.z0 - COARSE_DZ, job.z1 + COARSE_DZ, VAL_MARGIN, VAL_D, VAL_D);
      job.stage = 1;
      job.row = 0;
    }
    if (job.stage === 1) {
      // Each cell's ground (the casters out here are the land itself).
      for (let ib = job.row; ib < g.nb; ib++, job.row++) {
        const row = ib * g.na;
        for (let ia = 0; ia < g.na; ia++) g.occ[row + ia] = this.valleyAt(g.cellX(ia, ib), g.cellZ(ia, ib));
        if (performance.now() > until) {
          job.row++;
          return false;
        }
      }
      job.stage = 2;
      job.row = 0;
    }
    if (job.stage === 2) {
      g.sweep();
      job.stage = 3;
      if (performance.now() > until) return false;
    }
    // Read out into the tile: ceilings relative to its base, and the soft band (kept apart until it is uploaded,
    // so the fine tiles never read half a tile).
    const t = this.coarse[job.slot];
    const ceil = this.cCeil;
    const soft = this.cSoft;
    if (job.stage === 3) {
      for (let j = job.row; j < COARSE_H; j++, job.row++) {
        const z = job.z0 + (j - 1 + 0.5) * COARSE_DZ;
        for (let i = 0; i < COARSE_W; i++) {
          const x = job.xc + (i + 0.5 - COARSE_W / 2) * COARSE_DX;
          g.sample(x, z, job.base + COARSE_FLOOR, tmp2);
          const o = j * COARSE_W + i;
          ceil[o] = tmp2.x - BIAS_COARSE - job.base;
          soft[o] = SOFT_TERRAIN[0] * 4 + SOFT_TERRAIN[1] * tmp2.y;
        }
        if (performance.now() > until && j < COARSE_H - 1) {
          job.row++;
          return false;
        }
      }
      job.stage = 4;
      job.row = 0;
      if (performance.now() > until) return false;
    }
    // Coarse tiles carry the terrain alone (their casters' channel is open sky).
    const data = this.stageCoarse.image.data as Uint16Array;
    const h = DataUtils.toHalfFloat;
    const none = h(COARSE_FLOOR);
    const one = h(1);
    for (let j = job.row; j < COARSE_H; j++, job.row++) {
      for (let o = j * COARSE_W; o < (j + 1) * COARSE_W; o++) {
        data[o * 4] = h(ceil[o]);
        data[o * 4 + 1] = h(soft[o]);
        data[o * 4 + 2] = none;
        data[o * 4 + 3] = one;
      }
      if (performance.now() > until && j < COARSE_H - 1) {
        job.row++;
        return false;
      }
    }
    if (!this.upload(this.stageCoarse, COARSE_V0 + job.slot * COARSE_H)) return false;
    // (Baked again with rows it lacked: the fine tiles over it take its ridges again too.)
    if (t.key === job.key) for (const f of this.fine) if (Math.floor((f.key * CHUNK_LEN) / COARSE_LEN) === job.key) f.stale = true;
    t.key = job.key;
    t.xc = job.xc;
    t.base = job.base;
    t.age = 0;
    t.ceil!.set(ceil);
    t.soft!.set(soft);
    farUniforms.uFarSlot.value[FINE_SLOTS + job.slot].set(job.xc, job.key, job.base, 0);
    t.stale = false;
    t.rows = job.rows;
    this.stats.coarseTiles++;
    return true;
  }

  /** The coarse tiles' terrain ceiling (world y) and soft band at sim (x, z); null where none is baked. */
  private coarseAt(x: number, z: number, out: Vector2): Vector2 | null {
    const ti = Math.floor(z / COARSE_LEN);
    const s = ((ti % COARSE_SLOTS) + COARSE_SLOTS) % COARSE_SLOTS;
    const t = this.coarse[s];
    if (t.key !== ti) return null;
    const fu = (x - t.xc) / COARSE_DX + COARSE_W / 2 - 0.5;
    const fv = (z - ti * COARSE_LEN) / COARSE_DZ + 0.5;
    const i = Math.max(0, Math.min(COARSE_W - 2, Math.floor(fu)));
    const j = Math.max(0, Math.min(COARSE_H - 2, Math.floor(fv)));
    const a = Math.max(0, Math.min(1, fu - i));
    const b = Math.max(0, Math.min(1, fv - j));
    const o = j * COARSE_W + i;
    const c = t.ceil!;
    const sft = t.soft!;
    out.x = t.base + (c[o] * (1 - a) + c[o + 1] * a) * (1 - b) + (c[o + COARSE_W] * (1 - a) + c[o + COARSE_W + 1] * a) * b;
    out.y = (sft[o] * (1 - a) + sft[o + 1] * a) * (1 - b) + (sft[o + COARSE_W] * (1 - a) + sft[o + COARSE_W + 1] * a) * b;
    return out;
  }

  // ------------------------------------------------------------------ the course (fine tiles)

  private stepFine(job: Job, until: number): boolean {
    const halfW = (FINE_W / 2) * FINE_DX;
    const x0 = job.xc - halfW;
    const x1 = job.xc + halfW;
    const za = job.z0 - FINE_DZ;
    const zb = job.z1 + FINE_DZ;
    const ter = this.ter;
    const obj = this.obj;
    const c = this.world.course;
    const zlo = za - Math.max(0, -job.sun.sz) * TER_MARGIN - COARSE_DZ;
    const zhi = zb + Math.max(0, job.sun.sz) * TER_MARGIN + COARSE_DZ;
    if (job.stage === 0) {
      // The rows its ground and its upwind reach stand on.
      if (!this.rows(job, zlo, zhi, until)) return false;
      job.stage = 1;
      job.row = 0;
    }
    if (job.stage === 1) {
      // The run's own ground, a chunk at a time (kept for the tiles round it).
      for (let i = Math.floor(zlo / CHUNK_LEN) + job.row; i <= Math.floor(zhi / CHUNK_LEN); i++, job.row++) {
        if (!this.groundChunk(i, until)) return false;
      }
      // (The run's own banks and walls cast by the low shadow light, as its casters do, so they rake long; a ridge
      // past them, from the coarse tile, by the key light.)
      ter.fit(job.sun, x0, x1, za, zb, TER_MARGIN, TER_D, TER_D);
      job.stage = 2;
      job.row = 0;
    }
    if (job.stage === 2) {
      // Each cell's ground: the run's, and the valley's past it.
      for (let ib = job.row; ib < ter.nb; ib++, job.row++) {
        const row = ib * ter.na;
        for (let ia = 0; ia < ter.na; ia++) ter.occ[row + ia] = this.groundAt(ter.cellX(ia, ib), ter.cellZ(ia, ib));
        if (performance.now() > until) {
          job.row++;
          return false;
        }
      }
      job.stage = 3;
    }
    if (job.stage === 3) {
      ter.sweep();
      obj.fit(job.sun, x0, x1, za, zb, OBJ_MARGIN, OBJ_DA, OBJ_DB);
      job.stage = 4;
      job.row = 0;
      if (performance.now() > until) return false;
    }
    if (job.stage === 4) {
      // The casters of every chunk the tile's upwind reach crosses, one chunk a slice.
      const i0 = Math.floor((za + Math.min(0, job.sun.sz) * OBJ_MARGIN) / CHUNK_LEN) - 1;
      const i1 = Math.floor((zb + Math.max(0, job.sun.sz) * OBJ_MARGIN) / CHUNK_LEN) + 1;
      for (let i = i0 + job.row; i <= i1; i++, job.row++) {
        const cs = this.casters;
        cs.clear();
        if (!this.world.casters(i, cs)) job.missing.push(i);
        const d = cs.data;
        for (let k = 0; k < cs.n; k++) {
          const o = k * CASTER;
          if (d[o] === 0) obj.cone(d[o + 1], d[o + 2], d[o + 3], d[o + 4], d[o + 5]);
          else obj.box(d[o + 1], d[o + 2], d[o + 5], d[o + 6], d[o + 7], d[o + 8], d[o + 4]);
        }
        if (performance.now() > until) {
          job.row++;
          return false;
        }
      }
      job.stage = 5;
      job.row = 0;
    }
    if (job.stage === 5) {
      // The set pieces: each made piece's standing cells (made once a piece, a slice at a time).
      let pending = false;
      let at = 0;
      this.world.sites(job.z0 - SITE_REACH, job.z1 + SITE_REACH, (site, geo) => {
        if (pending) return;
        // (Pieces splatted in an earlier slice are passed over: job.row counts them, job.cell a piece's cells.)
        if (at++ < job.row) return;
        let e = this.siteCells.get(site.n);
        if (!e || e.geo !== geo) {
          e = { geo, cells: null, job: new SiteCells(site, geo, c) };
          this.siteCells.set(site.n, e);
        }
        if (!e.cells) {
          const t0 = performance.now();
          const cells = e.job!.step(until);
          this.stats.siteMs += performance.now() - t0;
          if (!cells) {
            pending = true;
            return;
          }
          e.cells = cells;
          e.job = null;
        }
        const cells = e.cells;
        for (let k = job.cell; k < cells.length; k += 3) {
          obj.point(cells[k], cells[k + 1], cells[k + 2]);
          if (k % 12288 === 0 && performance.now() > until) {
            job.cell = k + 3;
            pending = true;
            return;
          }
        }
        job.cell = 0;
        job.row++;
        job.sites.add(site.n);
      });
      if (pending) return false;
      // (Pieces no longer made are forgotten.)
      if (this.siteCells.size > 24) for (const k of [...this.siteCells.keys()].slice(0, this.siteCells.size - 24)) this.siteCells.delete(k);
      job.stage = 6;
      if (performance.now() > until) return false;
    }
    if (job.stage === 6) {
      obj.sweep();
      job.stage = 7;
      job.row = 0;
      if (performance.now() > until) return false;
    }
    if (job.stage === 7) {
      const data = this.stageFine.image.data as Uint16Array;
      const h = DataUtils.toHalfFloat;
      for (let j = job.row; j < FINE_H; j++, job.row++) {
        const z = job.z0 + (j - 1 + 0.5) * FINE_DZ;
        for (let i = 0; i < FINE_W; i++) {
          const x = job.xc + (i + 0.5 - FINE_W / 2) * FINE_DX;
          ter.sample(x, z, job.base + FINE_FLOOR, tmp2);
          let tc = tmp2.x - BIAS_TERRAIN;
          let ts = SOFT_TERRAIN[0] + SOFT_TERRAIN[1] * tmp2.y;
          // The great ridges past the near reach, from the valley's tile.
          const far = this.coarseAt(x, z, tmp2b);
          if (far && far.x > tc) {
            tc = far.x;
            ts = far.y;
          }
          // Toward its sides the tile eases into the coarse tile's terrain and its casters into open sky, so where the
          // two meet (141 m out) no shadow ends in a straight line.
          const side = Math.abs(i + 0.5 - FINE_W / 2);
          const edge = side < SIDE_FROM ? 0 : Math.min(1, (side - SIDE_FROM) / (FINE_W / 2 - 2 - SIDE_FROM));
          if (edge > 0 && far) {
            tc += (far.x - tc) * edge;
            ts += (far.y - ts) * edge;
          }
          // Where nothing casts, the casters' ceiling lies just under the ground's own (the terrain's ceiling), so
          // the filter between a shadowed texel and an open one keeps a thin caster's shadow its own width.
          const open = Math.max(job.base + FINE_FLOOR, tc - OPEN_DROP);
          obj.sample(x, z, open, tmp2);
          const o = (j * FINE_W + i) * 4;
          data[o] = h(Math.max(FINE_FLOOR, tc - job.base));
          data[o + 1] = h(ts);
          data[o + 2] = h(Math.max(open, tmp2.x - BIAS_OBJ - 40 * edge * edge) - job.base);
          data[o + 3] = h(SOFT_OBJ[0] + SOFT_OBJ[1] * tmp2.y);
        }
        if (performance.now() > until && j < FINE_H - 1) {
          job.row++;
          return false;
        }
      }
      job.stage = 8;
      if (performance.now() > until) return false;
    }
    if (!this.upload(this.stageFine, job.slot * FINE_H)) return false;
    const t = this.fine[job.slot];
    const again = t.key === job.key;
    t.key = job.key;
    t.xc = job.xc;
    t.base = job.base;
    // (Baked again for a set piece that came: its casters do not fade in a second time.)
    if (!again) t.age = 0;
    t.sites = job.sites;
    t.stale = false;
    t.missing = job.missing;
    t.rows = job.rows;
    t.sz = job.sun.sz;
    farUniforms.uFarSlot.value[job.slot].set(job.xc, job.key, job.base, again ? farUniforms.uFarSlot.value[job.slot].w : 0);
    this.stats.fineTiles++;
    return true;
  }

  /** Copies a baked tile into the atlas at row v (the atlas is made on the first). */
  private upload(stage: DataTexture, v: number): boolean {
    const r = this.renderer;
    if (!r) return false;
    let t0 = performance.now();
    if (!this.atlas) {
      const a = new DataTexture(new Uint16Array(ATLAS_W * ATLAS_H * 4), ATLAS_W, ATLAS_H, RGBAFormat, HalfFloatType);
      a.minFilter = LinearFilter;
      a.magFilter = LinearFilter;
      a.generateMipmaps = false;
      a.needsUpdate = true;
      r.initTexture(a);
      this.atlas = a;
      farUniforms.uFarMap.value = a;
      this.stats.initMs = performance.now() - t0;
      t0 = performance.now();
    }
    // Straight into the atlas's rows, through three's own state (copyTextureToTexture reads the GL's unpack state
    // back, a stall that cost the first tile about 100 ms).
    const src = stage.image.data as Uint16Array;
    const n = stage.image.width * stage.image.height * 4;
    const gl = r.getContext() as WebGL2RenderingContext;
    const tex = (r.properties.get(this.atlas) as { __webglTexture?: WebGLTexture }).__webglTexture;
    if (!tex) return false;
    r.state.bindTexture(gl.TEXTURE_2D, tex);
    r.state.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    r.state.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    r.state.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    r.state.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    r.state.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    r.state.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, v, stage.image.width, stage.image.height, gl.RGBA, gl.HALF_FLOAT, src, 0);
    // (The CPU's copy stays whole: a lost context is given it back, and play-tests read it.)
    (this.atlas.image.data as Uint16Array).set(src.subarray(0, n), v * ATLAS_W * 4);
    const ms = performance.now() - t0;
    this.stats.uploadMs = Math.max(this.stats.uploadMs, ms);
    if (this.stats.uploads.length < 12) this.stats.uploads.push(+ms.toFixed(2));
    return true;
  }

  /** Play-tests: what the field holds at sim (x, z) (the terrain's ceiling and soft band, the casters' ceiling
   *  and soft band, all world heights) and which tile it comes from, or null where none is baked. */
  sample(x: number, z: number): { tile: string; terrain: number; terrainSoft: number; casters: number; castersSoft: number; base: number } | null {
    const a = this.atlas;
    if (!a) return null;
    const ci = Math.floor(z / CHUNK_LEN);
    const fs = ((ci % FINE_SLOTS) + FINE_SLOTS) % FINE_SLOTS;
    const f = this.fine[fs];
    let u: number;
    let v: number;
    let base: number;
    let tile: string;
    if (f.key === ci && Math.abs(x - f.xc) < (FINE_W / 2 - 1) * FINE_DX) {
      u = FINE_W / 2 + (x - f.xc) / FINE_DX;
      v = fs * FINE_H + 1 + (z - ci * CHUNK_LEN) / FINE_DZ;
      base = f.base;
      tile = 'fine ' + ci;
    } else {
      const ti = Math.floor(z / COARSE_LEN);
      const cs = ((ti % COARSE_SLOTS) + COARSE_SLOTS) % COARSE_SLOTS;
      const t = this.coarse[cs];
      if (t.key !== ti || Math.abs(x - t.xc) > (COARSE_W / 2 - 1) * COARSE_DX) return null;
      u = COARSE_W / 2 + (x - t.xc) / COARSE_DX;
      v = COARSE_V0 + cs * COARSE_H + 1 + (z - ti * COARSE_LEN) / COARSE_DZ;
      base = t.base;
      tile = 'coarse ' + ti;
    }
    const o = (Math.floor(v) * ATLAS_W + Math.floor(u)) * 4;
    const d = a.image.data as Uint16Array;
    const h = DataUtils.fromHalfFloat;
    return { tile, terrain: base + h(d[o]), terrainSoft: h(d[o + 1]), casters: base + h(d[o + 2]), castersSoft: h(d[o + 3]), base };
  }

  /** How many tiles in the window are still to be baked now (play-tests wait for none, as for the set pieces): a
   *  far tile waiting for its casters to be laid out is not counted. */
  get pending(): number {
    let n = 0;
    const ci = Math.floor(this.riderZ / CHUNK_LEN);
    for (let i = this.c0; i <= this.c1; i++) {
      const t = this.fine[((i % FINE_SLOTS) + FINE_SLOTS) % FINE_SLOTS];
      if ((t.key !== i || t.stale) && !(i > ci + WAIT_AHEAD && !this.laidOut(i))) n++;
    }
    for (let i = this.t0; i <= this.t1; i++) {
      const t = this.coarse[((i % COARSE_SLOTS) + COARSE_SLOTS) % COARSE_SLOTS];
      if (t.key !== i || t.stale) n++;
    }
    return n;
  }

  /** Frees the GPU's copy (the world going away). */
  dispose(): void {
    this.atlas?.dispose();
    this.atlas = null;
    farUniforms.uFarMap.value = dummy;
  }
}

/** A set piece's standing cells: what its made geometry holds over each metre of ground (two on a very big piece),
 *  sampled over its triangles (corners, middles and, over a big face, a grid about a metre apart) into a grid
 *  over its footprint in the sim's frame, so a town's houses, a tower and a gate's posts cast and what hangs over
 *  the run does not. Made in slices: the footprint, the triangles, then the cells read out. */
class SiteCells {
  private stage = 0;
  private at = 0;
  private pos: ArrayLike<number>;
  private index: ArrayLike<number> | null;
  private verts: number;
  private count: number;
  private cy: number;
  private sy: number;
  private site: FarSite;
  /** The footprint's bounds (sim, relative to the site's origin), then the grid over it. */
  private x0 = Infinity;
  private x1 = -Infinity;
  private z0 = Infinity;
  private z1 = -Infinity;
  private d = 1;
  private w = 0;
  private h = 0;
  private top = new Float32Array(0);
  /** The lowest of what stands over each cell (a span's arch or beam floats: what floats casts nothing). */
  private bot = new Float32Array(0);
  private out = new Float32Array(3 * 1024);
  private n = 0;

  constructor(
    site: FarSite,
    geo: BufferGeometry,
    private course: Course,
  ) {
    // (The record is the caller's, reused between calls.)
    this.site = { ...site };
    const pos = geo.getAttribute('position');
    this.pos = pos.array as ArrayLike<number>;
    this.verts = pos.count;
    const idx = geo.getIndex();
    this.index = idx ? (idx.array as ArrayLike<number>) : null;
    this.count = idx ? idx.count / 3 : pos.count / 3;
    this.cy = Math.cos(site.yaw);
    this.sy = Math.sin(site.yaw);
  }

  /** Works until `until`; the cells (sim x, z and top a cell) once all is done. */
  step(until: number): Float32Array | null {
    const p = this.pos;
    if (this.stage === 0) {
      // The footprint (landmarks.ts siteToWorld, into the sim's frame: z down the run).
      for (; this.at < this.verts; this.at++) {
        const lx = p[this.at * 3];
        const lz = p[this.at * 3 + 2];
        const x = lx * this.cy + lz * this.sy;
        const z = lx * this.sy - lz * this.cy;
        if (x < this.x0) this.x0 = x;
        if (x > this.x1) this.x1 = x;
        if (z < this.z0) this.z0 = z;
        if (z > this.z1) this.z1 = z;
        if ((this.at & 1023) === 0 && performance.now() > until) {
          this.at++;
          return null;
        }
      }
      if (this.x0 > this.x1) return new Float32Array(0);
      this.d = (this.x1 - this.x0) * (this.z1 - this.z0) > 250000 ? 2 : 1;
      this.w = Math.ceil((this.x1 - this.x0) / this.d) + 1;
      this.h = Math.ceil((this.z1 - this.z0) / this.d) + 1;
      this.top = new Float32Array(this.w * this.h).fill(NONE);
      if (this.site.span && !this.site.roof) this.bot = new Float32Array(this.w * this.h).fill(1e9);
      this.stage = 1;
      this.at = 0;
    }
    if (this.stage === 1) {
      const ix = this.index;
      for (; this.at < this.count; this.at++) {
        const t3 = this.at * 3;
        const a = (ix ? ix[t3] : t3) * 3;
        const b = (ix ? ix[t3 + 1] : t3 + 1) * 3;
        const c = (ix ? ix[t3 + 2] : t3 + 2) * 3;
        const ax = p[a];
        const ay = p[a + 1];
        const az = p[a + 2];
        const bx = p[b] - ax;
        const by = p[b + 1] - ay;
        const bz = p[b + 2] - az;
        const cx = p[c] - ax;
        const cy = p[c + 1] - ay;
        const cz = p[c + 2] - az;
        const len = Math.max(Math.hypot(bx, bz), Math.hypot(cx, cz), Math.hypot(cx - bx, cz - bz), 0.5);
        const n = Math.min(24, Math.ceil(len / this.d));
        for (let u = 0; u <= n; u++) {
          for (let v = 0; v <= n - u; v++) this.add(ax + (bx * u + cx * v) / n, ay + (by * u + cy * v) / n, az + (bz * u + cz * v) / n);
        }
        if ((this.at & 15) === 0 && performance.now() > until) {
          this.at++;
          return null;
        }
      }
      this.stage = 2;
      this.at = 0;
    }
    // Read out, a row at a time. Spans: what hangs over the corridor goes (a beam or a deck's truss), what stands
    // outside it stays.
    const s = this.site;
    const c = this.course;
    for (; this.at < this.h; this.at++) {
      const z = s.z + this.z0 + (this.at + 0.5) * this.d;
      const cx = c.centerX(z);
      const hw = c.halfWidth(z) + 0.6;
      const row = this.at * this.w;
      for (let i = 0; i < this.w; i++) {
        const top = this.top[row + i];
        if (top <= NONE) continue;
        const x = s.x + this.x0 + (i + 0.5) * this.d;
        if (s.span && !s.roof && ((Math.abs(x - cx) < hw && top > c.ground(x, z) + 2.5) || this.bot[row + i] > c.ground(x, z) + 2.5)) continue;
        if (this.n + 3 > this.out.length) {
          const o = new Float32Array(this.out.length * 2);
          o.set(this.out);
          this.out = o;
        }
        this.out[this.n++] = x;
        this.out[this.n++] = z;
        this.out[this.n++] = top;
      }
      if (performance.now() > until && this.at < this.h - 1) {
        this.at++;
        return null;
      }
    }
    this.top = new Float32Array(0);
    this.bot = new Float32Array(0);
    return this.out.slice(0, this.n);
  }

  /** One sample in the site's frame: its cell's top rises to it. */
  private add(lx: number, ly: number, lz: number): void {
    const i = Math.floor((lx * this.cy + lz * this.sy - this.x0) / this.d);
    const j = Math.floor((lx * this.sy - lz * this.cy - this.z0) / this.d);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return;
    const k = j * this.w + i;
    const y = this.site.y + ly;
    if (y > this.top[k]) this.top[k] = y;
    if (this.bot.length && y < this.bot[k]) this.bot[k] = y;
  }
}
