import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, RepeatWrapping, type Texture, UnsignedByteType, Vector4 } from 'three';

// Round 8, snow as the hero material, second attempt (the snow2 lane): the wind's relief in the snow, as a
// height field the light draws. The first attempt painted powder's pillows as values laid over noise, and every
// critic read them as smudges, camouflage or caustics: shapes from noise are not forms. Here the forms are made
// first and the light finds them. Two small tiles are baked once on idle time after the first frame and read by
// the snow shader (materials.ts SNOW_RELIEF_GLSL), world-anchored, so the relief stays put under the lens:
//  - pillows: powder laid by the wind in rounded mounds a metre or two across and three to eight metres long,
//    lying about 30 degrees off the fall line, a blunt nose upwind and a long tail down it, merging here and
//    there into a ridge, on a slow swell; and the fields where the wind has carved the surface (the alpha);
//  - sastrugi: round 7's wind-carved ridges across the wind (a long windward rise to a crisp crest and a short
//    steep lee), wandering and broken into short lengths.
// Each texel holds the height (0 to 1) and its slope along the tile's two axes, so the shader has the normal
// without differencing an 8-bit height. The shader marches the height toward the key light a few steps, so
// each form casts its own shadow, crisp at the form and long under a low sun: the snow is drawn by the light.
// Nothing here touches the ground the sim reads: the relief lives in the shading normal and the light alone.

/** Texels along each side of a tile. */
export const RELIEF_N = 256;
/** Metres a pillows tile spans (it repeats), and a sastrugi tile. */
export const PILLOW_TILE = 56;
export const SASTRUGI_TILE = 14;

/** The tiles' axes in the world's xz (three.js): a pillow lies along PV, about 30 degrees off the fall line, as the
 *  ripples do; a sastrugi's ridges lie across SU, the wind's own heading in round 7's sastrugi. */
export const PU: readonly [number, number] = [0.866, 0.5];
export const PV: readonly [number, number] = [-0.5, 0.866];
export const SU: readonly [number, number] = [0.42, 0.91];
export const SV: readonly [number, number] = [-0.91, 0.42];

/** An integer hash of a lattice point and a seed, 0 to 1. */
export function hashI(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const wrap = (i: number, p: number): number => ((i % p) + p) % p;

/** Value noise that repeats every px by py lattice cells (x, y in cells), smooth, 0 to 1. */
export function pnoise(x: number, y: number, px: number, py: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const x0 = wrap(ix, px);
  const x1 = wrap(ix + 1, px);
  const y0 = wrap(iy, py);
  const y1 = wrap(iy + 1, py);
  const a = hashI(x0, y0, s);
  const b = hashI(x1, y0, s);
  const c = hashI(x0, y1, s);
  const d = hashI(x1, y1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Pillow cells: metres across (u) and along (v); the tile holds a whole number of each. */
const CELL_U = 5.6;
const CELL_V = 11.2;
const NU = PILLOW_TILE / CELL_U;
const NV = PILLOW_TILE / CELL_V;

/** One pillow a cell (or none): where it lies, how wide, long and tall, and how it is turned. */
interface Pillow {
  u: number;
  v: number;
  half: number;
  len: number;
  tall: number;
  ca: number;
  sa: number;
}

let cells: Array<Pillow | null> | null = null;

/** The tile's pillows, one a cell, laid once. */
function pillowCells(): Array<Pillow | null> {
  if (cells) return cells;
  cells = [];
  for (let wv = 0; wv < NV; wv++) {
    for (let wu = 0; wu < NU; wu++) {
      if (hashI(wu, wv, 11) > 0.9) {
        cells.push(null);
        continue;
      }
      // A little turned off the wind, each its own way.
      const a = (hashI(wu, wv, 17) - 0.5) * 0.45;
      cells.push({
        u: (wu + 0.25 + 0.5 * hashI(wu, wv, 12)) * CELL_U,
        v: (wv + 0.2 + 0.6 * hashI(wu, wv, 13)) * CELL_V,
        half: 2.4 + 1.4 * hashI(wu, wv, 14),
        len: 4.4 + 3.4 * hashI(wu, wv, 15),
        tall: 0.4 + 0.6 * hashI(wu, wv, 16),
        ca: Math.cos(a),
        sa: Math.sin(a),
      });
    }
  }
  return cells;
}

/** The pillows' height at (u, v), metres in the tile (u across a pillow, v along it, the wind blowing toward +v),
 *  before it is scaled to 0..1: rounded mounds shouldering each other, each a little blunter upwind than down,
 *  merged softly, on a slow swell. */
export function pillowHeight(u: number, v: number): number {
  const list = pillowCells();
  const cu = Math.floor(u / CELL_U);
  const cv = Math.floor(v / CELL_V);
  // (A soft union: each mound fills part of what is left, so two that meet make a saddle, not a crease.)
  let open = 1;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gu = cu + i;
      const gv = cv + j;
      const p = list[wrap(gv, NV) * NU + wrap(gu, NU)];
      if (!p) continue;
      const du = u - (p.u + (gu - wrap(gu, NU)) * CELL_U);
      const dv = v - (p.v + (gv - wrap(gv, NV)) * CELL_V);
      const ru = du * p.ca - dv * p.sa;
      const rv = du * p.sa + dv * p.ca;
      const lv = rv > 0 ? p.len * 1.6 : p.len * 1.25;
      const hu = p.half * 1.4;
      const r2 = (ru / hu) * (ru / hu) + (rv / lv) * (rv / lv);
      if (r2 >= 1) continue;
      // (A cubic falloff, with no slope left at its edge: a squared one drew each pillow's rim as an egg's outline.)
      const b = (1 - r2) * (1 - r2) * (1 - r2);
      open *= 1 - b * p.tall;
    }
  }
  const swell = pnoise(u / 14, v / 28, PILLOW_TILE / 14, PILLOW_TILE / 28, 21) * 0.7 + pnoise(u / 7, v / 14, PILLOW_TILE / 7, PILLOW_TILE / 14, 22) * 0.3;
  return (1 - open) * 0.8 + swell * 0.35;
}

/** Where the wind has carved the snow into sastrugi (0..1), in fields some fifteen to thirty metres across. */
export function sastrugiField(u: number, v: number): number {
  const f = pnoise(u / 14, v / 7, PILLOW_TILE / 14, PILLOW_TILE / 7, 31) * 0.7 + pnoise(u / 4, v / 3.5, PILLOW_TILE / 4, PILLOW_TILE / 3.5, 32) * 0.3;
  return smooth(0.36, 0.62, f);
}

/** Round 7's sastrugi (materials.ts `sastrugi`), made to repeat over the tile: at (a, b), metres across the ridges
 *  and along them, a sawtooth (a long windward rise, a crisp crest, a short lee drop) whose crests wander, broken
 *  into short carved lengths of a metre or three, each its own height. 0..1. */
export function sastrugiHeight(a: number, b: number): number {
  const x = a / SASTRUGI_TILE;
  const y = b / SASTRUGI_TILE;
  const s = 9 * x + pnoise(x * 1, y * 3, 1, 3, 41) * 2.4 + pnoise(x * 3, y * 7, 3, 7, 42) * 0.7;
  const f = s - Math.floor(s);
  const ridge = smooth(0, 0.84, f) * (1 - smooth(0.84, 1, f));
  // (Each ridge's own lengths, keyed to its index, so neighbouring ridges break in different places.)
  const k = wrap(Math.floor(s), 9);
  const lengths = smooth(0.3, 0.62, pnoise(y * 7 + k * 0.37, k * 1.7, 7, 9, 43));
  return ridge * (0.5 + 0.5 * pnoise(x * 5, y * 4, 5, 4, 44)) * lengths;
}

export interface ReliefTile {
  /** RGBA8: height, slope along u, slope along v (each 0.5 for level), and a fourth channel. */
  data: Uint8Array;
  /** The steepest slope (height units of the tile per metre) the slope channels' 0 and 255 stand for. */
  slope: number;
}

/** Bakes a tile from a height function a row at a time (call rows until it returns true), then pack() writes it.
 *  Time-sliced on idle, as every bake here is. */
export class TileBake {
  readonly h: Float32Array;
  readonly extra: Float32Array;
  private gu: Float32Array;
  private gv: Float32Array;
  /** Rows of heights baked, then rows of slopes (RELIEF_N more). */
  row = 0;
  private lo = Infinity;
  private hi = -Infinity;
  private slope = 1e-6;
  constructor(
    readonly metres: number,
    private height: (u: number, v: number) => number,
    private more: ((u: number, v: number) => number) | null = null,
  ) {
    this.h = new Float32Array(RELIEF_N * RELIEF_N);
    this.extra = new Float32Array(RELIEF_N * RELIEF_N);
    this.gu = new Float32Array(RELIEF_N * RELIEF_N);
    this.gv = new Float32Array(RELIEF_N * RELIEF_N);
  }

  get done(): boolean {
    return this.row >= RELIEF_N * 2;
  }

  /** Bakes rows until the deadline (performance.now()), or the whole tile with Infinity: the heights a row at a time,
   *  then the slopes from central differences across the wrap. True when all are done. */
  rows(deadline: number, now: () => number = () => performance.now()): boolean {
    const n = RELIEF_N;
    const d = this.metres / n;
    while (this.row < n) {
      const v = (this.row + 0.5) * d;
      const o = this.row * n;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) * d;
        const hv = this.height(u, v);
        this.h[o + i] = hv;
        if (hv < this.lo) this.lo = hv;
        if (hv > this.hi) this.hi = hv;
        if (this.more) this.extra[o + i] = this.more(u, v);
      }
      this.row++;
      if (now() > deadline) return false;
    }
    const h = this.h;
    const k = 1 / (2 * d * Math.max(this.hi - this.lo, 1e-6));
    while (this.row < n * 2) {
      const y = this.row - n;
      const up = ((y + 1) % n) * n;
      const dn = ((y + n - 1) % n) * n;
      const o = y * n;
      for (let x = 0; x < n; x++) {
        const gu = (h[o + (x + 1 === n ? 0 : x + 1)] - h[o + (x === 0 ? n - 1 : x - 1)]) * k;
        const gv = (h[up + x] - h[dn + x]) * k;
        this.gu[o + x] = gu;
        this.gv[o + x] = gv;
        this.slope = Math.max(this.slope, Math.abs(gu), Math.abs(gv));
      }
      this.row++;
      if (now() > deadline) return false;
    }
    return true;
  }

  /** The tile (call once rows() has returned true): heights scaled to 0..1, the slopes to the steepest. */
  pack(): ReliefTile {
    if (!this.done) this.rows(Infinity);
    const n = RELIEF_N;
    const span = Math.max(this.hi - this.lo, 1e-6);
    const data = new Uint8Array(n * n * 4);
    const s = 127.5 / this.slope;
    for (let i = 0; i < n * n; i++) {
      data[i * 4] = ((this.h[i] - this.lo) / span) * 255 + 0.5;
      data[i * 4 + 1] = 127.5 + this.gu[i] * s;
      data[i * 4 + 2] = 127.5 + this.gv[i] * s;
      data[i * 4 + 3] = Math.max(0, Math.min(1, this.extra[i])) * 255 + 0.5;
    }
    return { data, slope: this.slope };
  }
}

function tileTexture(t: ReliefTile): DataTexture {
  const tex = new DataTexture(t.data, RELIEF_N, RELIEF_N, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  // (Seen at a grazing angle down the run: three clamps it to what the GPU offers.)
  tex.anisotropy = 4;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

const blank = new DataTexture(new Uint8Array([0, 128, 128, 0]), 1, 1, RGBAFormat, UnsignedByteType);
blank.needsUpdate = true;

/** The relief's uniforms, spread into the snow material alone (materials.ts makeSnowMaterial). uRelief: x how much
 *  of it is drawn (0 until the tiles are baked, then 1), y the pillows' and z the sastrugi's steepest slope (the
 *  slope channels' scale), w how much harder the glitter gathers toward the sun (materials.ts, the star glints). */
export const relief = {
  uReliefP: { value: blank as Texture },
  uReliefS: { value: blank as Texture },
  uRelief: { value: new Vector4(0, 1, 1, 1.1) },
  /** x the pillows' height and y the sastrugi's (metres), z the light the forms turn to and from, w the sheen on them. */
  uReliefK: { value: new Vector4(0.8, 0.09, 1.2, 1) },
};

/** Dev only (`?debug&rk=0.55,0.09,1,1&rg=1`): the relief's heights, light and sheen and the glitter's gathering toward the
 *  sun, set from the page's query, so variants are shot from one build. */
if (typeof location !== 'undefined') {
  const q = new URLSearchParams(location.search);
  if (q.has('debug')) {
    const k = (q.get('rk') ?? '').split(',').map(Number);
    const u = relief.uReliefK.value;
    if (k.length === 4 && k.every((x) => Number.isFinite(x))) u.set(k[0], k[1], k[2], k[3]);
    const g = Number(q.get('rg'));
    if (q.has('rg') && Number.isFinite(g)) relief.uRelief.value.w = g;
  }
}

let started = false;

/** Bakes the tiles on idle time, once, after the first frame (nothing new runs before it): the pillows first, which
 *  every tier draws and which turn the relief on, then the sastrugi, only once a tier that draws them (Medium and
 *  above, `fine`) is in force, so Low never pays for them. Safe to call more than once. */
export function startReliefBake(fine: () => boolean): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const pillows = new TileBake(PILLOW_TILE, pillowHeight, sastrugiField);
  const sastrugi = new TileBake(SASTRUGI_TILE, sastrugiHeight);
  const firstFrame = (): boolean => typeof performance.getEntriesByName !== 'function' || performance.getEntriesByName('gs-first-frame').length > 0;
  const later = (ms = 0): void => {
    if (ms > 0) setTimeout(() => later(), ms);
    else if (typeof requestIdleCallback === 'function') requestIdleCallback(slice, { timeout: 500 });
    else setTimeout(() => slice(null), 60);
  };
  function slice(deadline: IdleDeadline | null): void {
    if (!firstFrame()) return later(250);
    // (A slice of at most 4 ms, or what the idle period has left; a starved queue still gets one every half second.)
    const end = performance.now() + Math.min(4, deadline && !deadline.didTimeout ? Math.max(1, deadline.timeRemaining()) : 4);
    // (Low draws no relief: its snow is round 7's painted slab, and it never pays for the tiles.)
    if (!fine()) return later(1000);
    if (pillows.row < RELIEF_N) {
      if (!pillows.rows(end)) return later();
      const p = pillows.pack();
      relief.uReliefP.value = tileTexture(p);
      relief.uRelief.value.x = 1;
      relief.uRelief.value.y = p.slope;
      return later();
    }
    if (!fine()) return later(1000);
    if (!sastrugi.rows(end)) return later();
    const s = sastrugi.pack();
    relief.uReliefS.value = tileTexture(s);
    relief.uRelief.value.z = s.slope;
  }
  later();
}
