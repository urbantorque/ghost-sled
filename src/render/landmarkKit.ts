import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { BiomeId } from '../sim/mountains';
import { flagColors } from './dressing';
import { SNOW, merge, paint, part, reseed, shade, softPart } from './flora';
import type { Palette } from './palette';

// The course's set pieces, modelled at scale (15 to 40 m) in the same parts style as the props:
// flat-shaded, vertex-coloured parts merged into one mesh per piece. Each is built in its site's own
// frame: x across the run (+x to the rider's right), y up from the corridor floor at the site, and +z
// up the slope, toward the rider coming down (the faces it is meant to be seen by). A piece that
// spans the run keeps everything over the corridor (and 9.2 m past its edges) above `clear`, and its
// posts and piers stand at |x| >= `post`. A bank piece stands on one side, past the treeline.
//
// Building is split into steps (each a few ms), so a piece is made over several idle callbacks.

export type Kind =
  // Spans the run.
  | 'gate'
  | 'bridge'
  | 'arch'
  | 'basalt'
  | 'torii'
  // Stands on the bank.
  | 'hut'
  | 'tower'
  | 'jump'
  | 'falls'
  | 'dome'
  | 'guardian'
  | 'pagoda';

export const SPANS: ReadonlySet<Kind> = new Set<Kind>(['gate', 'bridge', 'arch', 'basalt', 'torii']);

/** What a builder knows about its site. */
export interface SiteCtx {
  p: Palette;
  biome: BiomeId;
  /** Ground height at local (x, z), relative to the site's origin. */
  gy(x: number, z: number): number;
  /** Local x where the corridor's edge plus the dressing margin lies (posts stand outside it). */
  post: number;
  /** The lowest local height anything over the corridor may reach. */
  clear: number;
  /** The bank side a bank piece stands on (+1 right). */
  side: number;
  /** A night mood: windows and lamps are lit. */
  night: boolean;
  seed: number;
}

/** A crowd spot in the site frame: position and the yaw a figure there faces. */
export interface Spot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface Piece {
  /** Steps that each make a few parts; the piece is their merge. */
  steps: Array<() => BufferGeometry[]>;
  /** Figures standing on the piece itself (a bridge's deck, a terrace). */
  spots: Spot[];
  /** Translucent ice (the ice material). */
  ice: boolean;
}

// ---------------------------------------------------------------- helpers

type V3 = [number, number, number];
const UP = new Vector3(0, 1, 0);
const tq = new Quaternion();
const tv = new Vector3();
const tm = new Matrix4();

let rs = 1;
function rnd(): number {
  rs = (rs * 1664525 + 1013904223) >>> 0;
  return rs / 4294967296;
}
function seed(s: number): void {
  rs = s >>> 0 || 1;
  reseed(s);
}

function box(w: number, h: number, d: number, col: Color, pos: V3, rot?: V3): BufferGeometry {
  return part(new BoxGeometry(w, h, d), col, { pos, rot });
}

/** A timber or rod from a to b (square, or `sides` round). */
function seg(a: V3, b: V3, r: number, col: Color, sides = 4): BufferGeometry {
  tv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = Math.max(0.01, tv.length());
  const g = new CylinderGeometry(r, r, len, sides);
  if (sides === 4) g.rotateY(Math.PI / 4);
  tq.setFromUnitVectors(UP, tv.normalize());
  g.applyQuaternion(tq);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return part(g, col);
}

/** A flat slab (a deck) from (x0, y0) to (x1, y1) in the x-y plane, its underside on that line. */
function slab(x0: number, y0: number, x1: number, y1: number, w: number, t: number, col: Color): BufferGeometry {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const a = Math.atan2(y1 - y0, x1 - x0);
  return box(len + 0.05, t, w, col, [(x0 + x1) / 2 - Math.sin(a) * (t / 2), (y0 + y1) / 2 + Math.cos(a) * (t / 2), 0], [0, 0, a]);
}

/** A chunky faceted rock or ice mass. */
function crag(col: Color, pos: V3, scale: V3, jitter = 0.32): BufferGeometry {
  return part(new IcosahedronGeometry(1, 0), col, { pos, scale, rot: [rnd() * 0.5, rnd() * 6.28, rnd() * 0.5], jitter });
}

/** A lumpy drift of snow. */
function drift(pos: V3, scale: V3): BufferGeometry {
  return part(new IcosahedronGeometry(1, 1), SNOW, { pos, scale, rot: [0, rnd() * 3, 0], jitter: 0.1 });
}

/** A lamp: its colour pushed past 1, so it blooms on Medium and High in the plain toon material. */
function lampColor(night: boolean, hex = '#FFB45E'): Color {
  return new Color(hex).multiplyScalar(night ? 2.8 : 1.5);
}

/** A window: dark glass by day, warm light at night. */
function windowColor(night: boolean): Color {
  return night ? new Color('#FFC27A').multiplyScalar(1.9) : new Color('#2A2D48');
}

/** Moves a list of parts from a piece's own frame (facing +z) into the site frame. */
function place(parts: BufferGeometry[], x: number, y: number, z: number, yaw: number): BufferGeometry[] {
  tm.makeRotationY(yaw).setPosition(x, y, z);
  for (const g of parts) g.applyMatrix4(tm);
  return parts;
}

/** A sub-frame for a bank piece: its centre, yaw, and ground under it in its own coordinates. */
class Sub {
  readonly c: number;
  readonly s: number;
  constructor(
    private ctx: SiteCtx,
    readonly x: number,
    readonly z: number,
    readonly yaw: number,
  ) {
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
  }
  /** Ground under the piece's own (u, v). */
  gy(u: number, v: number): number {
    return this.ctx.gy(this.x + u * this.c + v * this.s, this.z - u * this.s + v * this.c);
  }
  /** Lowest and highest ground over a footprint (half sizes hu, hv). */
  range(hu: number, hv: number): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const y = this.gy((i / 2) * hu, (j / 2) * hv);
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
    }
    return [lo, hi];
  }
  out(parts: BufferGeometry[]): BufferGeometry[] {
    return place(parts, this.x, 0, this.z, this.yaw);
  }
  /** A spot in the piece's frame, turned into the site frame. */
  spot(u: number, y: number, v: number, yaw: number): Spot {
    return { x: this.x + u * this.c + v * this.s, y, z: this.z - u * this.s + v * this.c, yaw: yaw + this.yaw };
  }
}

/** A bank piece's sub-frame: `off` metres past the post line on its side, turned to face the run
 *  and up the slope (where the rider sees it from). */
function bankFrame(ctx: SiteCtx, off: number, zOff = 0, turn = 0.55): Sub {
  const s = ctx.side;
  return new Sub(ctx, s * (ctx.post + off), zOff, -s * turn);
}

/** Paints a part's vertices from k0 at y0 to k1 at y1 (value gradient up a post or wall). */
function grade(g: BufferGeometry, y0: number, y1: number, k0: number, k1: number, facet = 0.06): BufferGeometry {
  return paint(g, y0, y1, k0, k1, facet);
}

// ---------------------------------------------------------------- colours

const TIMBER = new Color('#6E4A36');
const TIMBER_DARK = new Color('#4E3428');
const TIMBER_LIGHT = new Color('#8A6248');
const CREAM = new Color('#F0E6D2');
const INK = new Color('#2A2D48');
const ROPE = new Color('#3A3046');

function stone(p: Palette, k = 1): Color {
  return p.low.clone().lerp(new Color('#9A94A8'), 0.45).multiplyScalar(k);
}

/** Banner colours: the mood's blue-violets (as the chute flags), cream and a deep teal. */
function banners(p: Palette): Color[] {
  const [a, b] = flagColors(p);
  return [a, CREAM, b, new Color('#2F6E78'), CREAM];
}

// ---------------------------------------------------------------- spans

/** A lattice tower of four timber legs, braced at every level, from its footing to `top`. */
function latticeTower(ctx: SiteCtx, cx: number, cz: number, w: number, top: number, wood: Color, dark: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const h = w / 2;
  const t = w * 0.36;
  let foot = Infinity;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) foot = Math.min(foot, ctx.gy(cx + sx * h, cz + sz * h));
  foot -= 1.4;
  const at = (sx: number, sz: number, y: number): V3 => {
    const k = (y - foot) / (top - foot);
    const r = h + (t - h) * k;
    return [cx + sx * r, y, cz + sz * r];
  };
  const corners: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) parts.push(grade(seg(at(sx, sz, foot), at(sx, sz, top), 0.34, wood), foot, top, 0.72, 1.06));
  const step = 4.6;
  for (let y = foot + 3.2; y < top - 0.5; y += step) {
    const y2 = Math.min(top, y + step);
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k];
      const [bx, bz] = corners[(k + 1) % 4];
      parts.push(seg(at(ax, az, y), at(bx, bz, y), 0.13, dark));
      parts.push(seg(at(ax, az, y), at(bx, bz, y2), 0.08, dark));
      parts.push(seg(at(bx, bz, y), at(ax, az, y2), 0.08, dark));
    }
  }
  // A collar of packed snow round the footing.
  parts.push(drift([cx, ctx.gy(cx, cz) - 0.2, cz], [w * 0.55, 0.5, w * 0.55]));
  return parts;
}

/** Bunting: a string sagging from a to b with triangular pennants hanging under it. */
function bunting(a: V3, b: V3, sag: number, cols: Color[], size = 0.9): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(4, Math.round(len / (size * 1.5)));
  const pt = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
  for (let i = 0; i < n; i++) {
    const p0 = pt(i / n);
    const p1 = pt((i + 1) / n);
    parts.push(seg(p0, p1, 0.04, ROPE, 3));
    if (i === 0) continue;
    // A pennant: a flat triangle, point down.
    const g = new ConeGeometry(size * 0.45, size, 3);
    g.rotateX(Math.PI);
    g.scale(1, 1, 0.08);
    g.rotateY(Math.atan2(-(b[2] - a[2]), b[0] - a[0]));
    g.translate(p0[0], p0[1] - size * 0.5, p0[2]);
    parts.push(part(g, cols[i % cols.length]));
  }
  return parts;
}

/** A start/check gate: two lattice timber towers on the banks, a deep truss across the run high
 *  overhead with the course's emblem board, long banners down the towers, lanterns under their caps
 *  and bunting from the tower tops to the truss. Glacier: weathered blue-grey timber. */
export function gatePiece(ctx: SiteCtx): Piece {
  const { p, clear: H, night } = ctx;
  const ice = ctx.biome === 'glacier';
  const wood = ice ? new Color('#6A7088') : TIMBER;
  const dark = ice ? new Color('#4A5068') : TIMBER_DARK;
  const beam = ice ? new Color('#7A8098') : TIMBER_LIGHT;
  const X = ctx.post + 2.9;
  const T = H + 8;
  const cols = banners(p);
  const steps: Array<() => BufferGeometry[]> = [];
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + s * 7);
      const cx = s * X;
      const parts = latticeTower(ctx, cx, 0, 3.6, T, wood, dark);
      // The cap: a four-sided roof heavy with snow, a lantern hung under it.
      parts.push(part(new ConeGeometry(2.9, 2.4, 4), dark, { pos: [cx, T + 1.15, 0], rot: [0, Math.PI / 4, 0] }));
      parts.push(part(new ConeGeometry(2.4, 1.5, 4), SNOW, { pos: [cx, T + 1.85, 0], rot: [0, Math.PI / 4, 0], jitter: 0.08 }));
      parts.push(box(2.6, 0.3, 2.6, beam, [cx, T, 0]));
      // A planked lookout cabin at the top, with a lit window toward the run.
      parts.push(grade(box(3.4, 3.4, 3.4, beam, [cx, T - 1.85, 0]), T - 3.6, T, 0.82, 1.04));
      parts.push(box(3.6, 0.3, 3.6, dark, [cx, T - 3.55, 0]));
      parts.push(box(1.8, 1.1, 0.12, windowColor(night), [cx, T - 1.6, 1.72]));
      parts.push(box(0.12, 1.1, 1.8, windowColor(night), [cx - s * 1.72, T - 1.6, 0]));
      parts.push(part(new SphereGeometry(0.5, 10, 8), lampColor(night), { pos: [cx, T - 4.3, 1.95] }));
      // A flagpole with a long pennant streaming off it.
      parts.push(seg([cx, T + 2.2, 0], [cx, T + 8, 0], 0.09, INK, 5));
      const pen = new ConeGeometry(0.7, 4.4, 3);
      pen.rotateZ(-s * Math.PI / 2);
      pen.scale(1, 1, 0.12);
      parts.push(part(pen, cols[0], { pos: [cx - s * 2.2, T + 7.2, 0] }));
      // Two long banners hanging down the tower's uphill face.
      for (let k = 0; k < 2; k++) {
        const bx = cx + (k === 0 ? -0.8 : 0.8);
        const bh = 9 + (k === 0 ? 0 : -2.2);
        parts.push(box(1.25, bh, 0.06, cols[(k + (s > 0 ? 1 : 0)) * 2 % cols.length], [bx, T - 1.6 - bh / 2, 1.95]));
        parts.push(box(1.25, 0.32, 0.08, cols[3], [bx, T - 1.6 - bh + 0.16, 1.97]));
        parts.push(seg([bx - 0.8, T - 1.5, 1.95], [bx + 0.8, T - 1.5, 1.95], 0.06, INK, 4));
      }
      return parts;
    });
  }
  // The truss.
  steps.push(() => {
    seed(ctx.seed + 3);
    const parts: BufferGeometry[] = [];
    const L = 2 * X;
    const d = 3.4;
    const yb = H + 0.35;
    const yt = H + d;
    for (const z of [-0.85, 0.85]) {
      parts.push(grade(box(L + 1.2, 0.85, 0.7, beam, [0, yb, z]), yb - 0.3, yb + 0.3, 0.85, 1.05));
      parts.push(grade(box(L + 1.2, 0.85, 0.7, beam, [0, yt, z]), yt - 0.3, yt + 0.3, 0.85, 1.05));
      const n = Math.max(6, Math.round(L / 4.2));
      for (let i = 0; i <= n; i++) {
        const x = -L / 2 + (L * i) / n;
        parts.push(seg([x, yb, z], [x, yt, z], 0.18, dark));
        if (i < n) {
          const x2 = -L / 2 + (L * (i + 1)) / n;
          const up = (i < n / 2) === (i % 2 === 0);
          parts.push(up ? seg([x, yb, z], [x2, yt, z], 0.13, dark) : seg([x, yt, z], [x2, yb, z], 0.13, dark));
        }
      }
    }
    // Snow along the top chords.
    parts.push(softPart(new CylinderGeometry(0.55, 0.55, L + 1.6, 10, 1), SNOW, { pos: [0, yt + 0.42, 0], rot: [0, 0, Math.PI / 2], scale: [0.55, 1, 1.9] }));
    // The emblem board on the uphill face: cream, two banded stripes and a round badge with a peak.
    const bw = Math.min(L * 0.5, 22);
    const by = H + d / 2 + 0.15;
    parts.push(box(bw, d - 0.5, 0.25, CREAM, [0, by, 1.2]));
    parts.push(box(bw, 0.42, 0.28, cols[0], [0, by + 0.95, 1.22]));
    parts.push(box(bw, 0.42, 0.28, cols[2], [0, by - 0.95, 1.22]));
    const disc = new CylinderGeometry(2.1, 2.1, 0.3, 20);
    disc.rotateX(Math.PI / 2);
    parts.push(part(disc, INK, { pos: [0, by, 1.4] }));
    const peak = new ConeGeometry(1.35, 1.7, 3);
    peak.scale(1, 1, 0.1);
    parts.push(part(peak, CREAM, { pos: [0, by + 0.1, 1.58] }));
    const cap = new ConeGeometry(0.52, 0.6, 3);
    cap.scale(1, 1, 0.1);
    parts.push(part(cap, SNOW, { pos: [0, by + 0.65, 1.66] }));
    // Bunting from each tower top to the middle of the truss (all of it over the truss's foot).
    for (const s of [-1, 1]) parts.push(...bunting([s * X, T - 0.4, 0.3], [s * bw * 0.52, H + d + 0.4, 0.3], 1.2, cols, 1.0));
    return parts;
  });
  return { steps, spots: [], ice: false };
}

/** A trestle footbridge high over the run: a covered truss across the corridor and timber bents
 *  marching out over each bank, with figures on the deck. Blossom: lacquered, the deck arched over
 *  the run. Volcanic: dark stone piers and slab, with braziers. */
export function bridgePiece(ctx: SiteCtx): Piece {
  const { p, clear: H, night, biome } = ctx;
  const blossom = biome === 'blossom';
  const vol = biome === 'volcanic';
  const wood = blossom ? new Color('#5A2F42') : vol ? shade(p.low, 0.72) : biome === 'glacier' ? new Color('#6A7088') : TIMBER;
  const dark = blossom ? new Color('#2E2230') : vol ? shade(p.low, 0.55) : biome === 'glacier' ? new Color('#4A5068') : TIMBER_DARK;
  const deckC = blossom ? new Color('#3A2A36') : vol ? shade(p.low, 0.62) : TIMBER_LIGHT;
  const X = ctx.post + 1.6;
  const arch = blossom ? 3.2 : 0;
  /** The deck's underside at x. */
  const under = (x: number) => H + 0.2 + (Math.abs(x) < X ? arch * (1 - (x / X) ** 2) : 0);
  const reach = 30;
  const steps: Array<() => BufferGeometry[]> = [];
  const spots: Spot[] = [];
  // The deck and its trusses, in segments so the arch can curve.
  steps.push(() => {
    seed(ctx.seed + 11);
    const parts: BufferGeometry[] = [];
    const L = X + reach;
    const n = Math.round((2 * L) / 3);
    for (let i = 0; i < n; i++) {
      const x0 = -L + (2 * L * i) / n;
      const x1 = -L + (2 * L * (i + 1)) / n;
      const y0 = under(x0);
      const y1 = under(x1);
      parts.push(slab(x0, y0, x1, y1, 4.2, 0.9, deckC));
    }
    // Over the run the deck is carried by side trusses (a covered bridge's walls); over the banks, a
    // plain rail on posts.
    for (const z of [-1.75, 1.75]) {
      const m = Math.round((2 * X) / 3.2);
      for (let i = 0; i <= m; i++) {
        const x = -X + (2 * X * i) / m;
        const y = under(x) + 1.1;
        const th = vol ? 2.0 : 3.0;
        parts.push(seg([x, y, z], [x, y + th, z], vol ? 0.32 : 0.17, dark));
        if (i < m) {
          const xn = -X + (2 * X * (i + 1)) / m;
          const yn = under(xn) + 1.1;
          parts.push(seg([x, y + th, z], [xn, yn + th, z], 0.22, wood));
          if (!vol) parts.push((i % 2 === 0) === (i < m / 2) ? seg([x, y, z], [xn, yn + th, z], 0.1, dark) : seg([x, y + th, z], [xn, yn, z], 0.1, dark));
          if (blossom) parts.push(seg([x, y + th + 0.25, z], [xn, yn + th + 0.25, z], 0.13, CREAM));
        }
      }
      for (const s of [-1, 1]) {
        for (let x = X; x < X + reach; x += 2.5) {
          const y = under(s * x) + 1.1;
          parts.push(seg([s * x, y, z], [s * x, y + 1.2, z], 0.07, dark));
          parts.push(seg([s * x, y + 1.2, z], [s * (x + 2.5), y + 1.2, z], 0.07, wood));
        }
      }
    }
    // Snow on the deck edges and the truss tops.
    parts.push(box(2 * L, 0.18, 0.7, SNOW, [0, under(X) + 1.15, 1.3]));
    if (!blossom) for (const z of [-1.75, 1.75]) parts.push(box(2 * X, 0.16, 0.45, SNOW, [0, under(0) + 1.1 + (vol ? 2.0 : 3.0) + 0.2, z]));
    return parts;
  });
  // Bents (or stone piers) out over each bank.
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 13 + s);
      const parts: BufferGeometry[] = [];
      for (let k = 0; k < 5; k++) {
        const x = s * (X + k * 7 + (vol ? 1.8 : 0));
        const top = under(x);
        if (vol) {
          const foot = Math.min(ctx.gy(x, -1.5), ctx.gy(x, 1.5)) - 1.5;
          parts.push(grade(part(new CylinderGeometry(1.5, 1.9, top - foot, 6), wood, { pos: [x, (top + foot) / 2, 0] }), foot, top, 0.7, 1.0));
          parts.push(part(new CylinderGeometry(1.7, 1.7, 0.4, 6), SNOW, { pos: [x, top - 0.1, 0] }));
          continue;
        }
        for (const z of [-1, 1]) {
          const foot = ctx.gy(x, z * 3.6) - 1;
          parts.push(grade(seg([x, foot, z * 3.6], [x, top, z * 1.6], 0.26, wood), foot, top, 0.75, 1.05));
          parts.push(drift([x, ctx.gy(x, z * 3.6) - 0.2, z * 3.6], [0.8, 0.35, 0.8]));
        }
        const foot = Math.min(ctx.gy(x, 3.6), ctx.gy(x, -3.6));
        for (let y = foot + 3; y < top - 1.5; y += 5) {
          const f = (y - foot) / (top - foot);
          const zw = 3.6 + (1.6 - 3.6) * f;
          const f2 = Math.min(1, (y + 5 - foot) / (top - foot));
          const zw2 = 3.6 + (1.6 - 3.6) * f2;
          parts.push(seg([x, y, -zw], [x, y, zw], 0.14, dark));
          if (y + 5 < top) {
            parts.push(seg([x, y, -zw], [x, y + 5, zw2], 0.09, dark));
            parts.push(seg([x, y, zw], [x, y + 5, -zw2], 0.09, dark));
          }
        }
        // Sway braces from bent to bent along the run of the bridge.
        if (k > 0) parts.push(seg([x - s * 7, top - 2.5, 0], [x, top - 0.6, 0], 0.1, dark));
      }
      if (vol || blossom) {
        // Lamps over the first pier each side (braziers in Ember, paper lanterns in Sakura).
        const x = s * X;
        const y = under(x) + 1.1;
        parts.push(part(new CylinderGeometry(0.55, 0.3, 0.6, 7), INK, { pos: [x, y + 2.2, 2.2] }));
        parts.push(part(new SphereGeometry(0.55, 10, 8), lampColor(night || vol, vol ? '#FF9A40' : '#FFB45E'), { pos: [x, y + 2.9, 2.2], scale: [1, vol ? 1.4 : 1.2, 1] }));
        parts.push(seg([x, y, 2.2], [x, y + 2, 2.2], 0.08, dark, 5));
      }
      return parts;
    });
  }
  // Figures on the deck's uphill rail, looking up the run; a few over each bank.
  for (let i = 0; i < 18; i++) {
    const t = (i + 0.5) / 18;
    const x = -X * 0.92 + 2 * X * 0.92 * t + (((i * 7919) % 13) / 13 - 0.5) * 1.2;
    spots.push({ x, y: under(x) + 1.0, z: 1.05, yaw: 0 });
  }
  return { steps, spots, ice: false };
}

/** A natural arch the run passes beneath: chunky crags along a squared curve from bank to bank, snow
 *  on its crown and icicles under it. Glacier: blue ice (the ice material); Ember: basalt with magma
 *  glowing in its seams. */
export function archPiece(ctx: SiteCtx): Piece {
  const { p, clear: H, biome } = ctx;
  const ice = biome === 'glacier';
  const Xc = ctx.post;
  const Rx = Xc + 6;
  // The underside: a superellipse (exponent 4) over x in [-Rx, Rx], at least H + 2 over the corridor.
  const f = Math.pow(1 - Math.pow(Xc / Rx, 4), 0.25);
  const Ry = (H + 2.2) / f;
  const under = (t: number): [number, number] => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [Rx * Math.sign(c) * Math.sqrt(Math.abs(c)), Ry * Math.sqrt(Math.abs(s))];
  };
  // Even steps along the curve's length over t in [0, pi / 2] (the exponent bunches t at the crown).
  const table: number[] = [0];
  for (let k = 1; k <= 64; k++) {
    const [ax, ay] = under(((k - 1) / 64) * (Math.PI / 2));
    const [bx, by] = under((k / 64) * (Math.PI / 2));
    table.push(table[k - 1] + Math.hypot(bx - ax, by - ay));
  }
  const even = (u: number): number => {
    const L = u * table[64];
    let k = 1;
    while (k < 64 && table[k] < L) k++;
    const f = (L - table[k - 1]) / Math.max(1e-6, table[k] - table[k - 1]);
    return ((k - 1 + f) / 64) * (Math.PI / 2);
  };
  const body = ice ? [new Color('#7FC4E6'), new Color('#A8DDF2'), new Color('#5E9FD0')] : [shade(p.low, 0.6), shade(p.low, 0.75), shade(p.low, 0.5)];
  const steps: Array<() => BufferGeometry[]> = [];
  for (const half of [0, 1]) {
    steps.push(() => {
      seed(ctx.seed + 21 + half);
      const parts: BufferGeometry[] = [];
      const n = 16;
      for (let i = 0; i < n; i++) {
        const t = half ? Math.PI - even((i + 0.5) / n) : even((i + 0.5) / n);
        const [ux, uy] = under(t);
        // Outward normal of the curve (approximately radial, scaled).
        const nx = ux / Rx;
        const ny = uy / Ry;
        const nl = Math.hypot(nx, ny) || 1;
        const leg = 1 - Math.abs(Math.sin(t));
        const th = 6.5 + leg * 4;
        const cx = ux + (nx / nl) * th * 0.98;
        const cy = uy + (ny / nl) * th * 0.9;
        parts.push(crag(body[i % 3], [cx, cy, (rnd() - 0.5) * 2], [th * 0.95, th * 0.8, 6.5 + rnd() * 2.5], 0.3));
        if (i % 2 === 0) parts.push(crag(body[(i + 1) % 3], [cx + (rnd() - 0.5) * 3, cy + (rnd() - 0.2) * 2, (rnd() - 0.5) * 6], [th * 0.6, th * 0.55, 4.5], 0.28));
        // Snow on the crown's top.
        if (Math.abs(Math.cos(t)) < 0.75) parts.push(drift([cx, cy + th * 0.6, 0], [th * 0.85, 0.9, 4.6]));
      }
      if (!half) {
        // The keystone mass at the crown, joining the two halves, snow heaped on it.
        parts.push(crag(body[1], [0, Ry + 6.2, 0], [7.5, 6.2, 8], 0.3));
        parts.push(drift([0, Ry + 11.4, 0], [6.2, 1.3, 5]));
      }
      // The feet: big buttresses buried in the bank.
      const sx = half ? -1 : 1;
      parts.push(crag(body[2], [sx * (Rx + 6), ctx.gy(sx * (Rx + 6), 0) + 2, 0], [8, 9, 9], 0.3));
      parts.push(crag(body[0], [sx * (Rx + 9), ctx.gy(sx * (Rx + 9), 2) + 1, 3], [6, 6, 6], 0.3));
      // Icicles (Glacier) or glowing seams (Ember) under the crown, only where they keep above H.
      const tip = ice ? new Color('#E4F6FF') : lampColor(true, '#FF8A3C');
      for (let k = 0; k < 9; k++) {
        const t = half ? Math.PI - even(0.35 + 0.65 * rnd()) : even(0.35 + 0.65 * rnd());
        const [ux, uy] = under(t);
        const len = ice ? 1.2 + rnd() * 2 : 0.6 + rnd() * 0.8;
        if (uy - len < H + 0.5) continue;
        if (ice) parts.push(part(new ConeGeometry(0.25 + rnd() * 0.25, len, 5), tip, { pos: [ux, uy - len / 2 + 0.2, (rnd() - 0.5) * 5], rot: [Math.PI, 0, 0] }));
        else parts.push(box(0.3, len, 1.8 + rnd() * 2, tip, [ux, uy + 0.2, (rnd() - 0.5) * 4], [0, 0, rnd() - 0.5]));
      }
      return parts;
    });
  }
  return { steps, spots: [], ice };
}

/** Ember's gateway: two clusters of basalt columns on the banks, a lintel of three columns laid across
 *  high overhead with glowing runes on its face, and lava-lit braziers on the tallest columns. */
export function basaltPiece(ctx: SiteCtx): Piece {
  const { p, clear: H } = ctx;
  const X = ctx.post + 4.6;
  const col = shade(p.tall, 0.95);
  const colD = shade(p.tallDark, 0.9);
  const fire = lampColor(true, '#FFA040');
  const fire2 = lampColor(true, '#FF6A30');
  const steps: Array<() => BufferGeometry[]> = [];
  for (const s of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 31 + s);
      const parts: BufferGeometry[] = [];
      const cols: Array<[number, number, number, number]> = [
        [0, 0, 1.7, H + 8.5],
        [1.9, 1.2, 1.3, H + 3.5],
        [-1.6, 1.5, 1.2, H + 1.5],
        [1.4, -1.8, 1.25, H - 2],
        [-1.9, -1.3, 1.4, H + 5.5],
        [3.2, -0.2, 1.0, H - 6],
        [-3.1, 0.4, 1.05, H - 4],
      ];
      for (const [dx, dz, r, top] of cols) {
        const x = s * X + dx;
        const foot = ctx.gy(x, dz) - 2;
        parts.push(grade(part(new CylinderGeometry(r, r * 1.04, top - foot, 6), dx === 0 ? colD : col, { pos: [x, (top + foot) / 2, dz], rot: [0, rnd(), 0] }), foot, top, 0.65, 1.0));
        parts.push(part(new CylinderGeometry(r * 0.96, r, 0.25, 6), SNOW, { pos: [x, top + 0.1, dz] }));
      }
      // The brazier on the tallest column.
      const bx = s * X;
      const by = H + 8.5;
      parts.push(part(new CylinderGeometry(1.9, 1.1, 1.3, 8), INK, { pos: [bx, by + 0.75, 0] }));
      parts.push(part(new ConeGeometry(1.7, 4.2, 7), fire, { pos: [bx, by + 3.1, 0], jitter: 0.3 }));
      parts.push(part(new ConeGeometry(1.1, 3.0, 6), fire2, { pos: [bx + 0.6, by + 2.5, 0.4], jitter: 0.2 }));
      return parts;
    });
  }
  steps.push(() => {
    seed(ctx.seed + 35);
    const parts: BufferGeometry[] = [];
    const L = 2 * X + 7;
    for (const [y, z, r] of [
      [H + 1.6, 0.6, 1.4],
      [H + 1.6, -1.6, 1.3],
      [H + 3.8, -0.5, 1.45],
    ] as const) {
      const g = new CylinderGeometry(r, r, L, 6);
      g.rotateZ(Math.PI / 2);
      parts.push(part(g, y > H + 3 ? colD : col, { pos: [0, y, z] }));
    }
    parts.push(drift([0, H + 5.3, -0.5], [L * 0.45, 0.5, 1.3]));
    // Runes: short glowing strokes along the lintel's uphill face.
    for (let i = -6; i <= 6; i++) {
      const x = i * (X / 7.5);
      parts.push(box(0.22, 1.1, 0.2, fire2, [x, H + 1.7, 2.0], [0, 0, (i % 2) * 0.5 - 0.25]));
      if (i % 3 === 0) parts.push(box(0.9, 0.2, 0.2, fire2, [x, H + 2.15, 2.0]));
    }
    return parts;
  });
  return { steps, spots: [], ice: false };
}

/** Sakura's great torii spanning the run: round lacquered pillars on black stone bases, a tie beam
 *  (nuki) and the sweeping top lintel (kasagi) with upturned ends, a name plaque between them. Deep
 *  wine lacquer, never the player's vermillion. */
export function toriiPiece(ctx: SiteCtx): Piece {
  const { clear: H, night } = ctx;
  const X = ctx.post + 3.2;
  const lac = new Color('#93405A');
  const lacD = new Color('#6A2A40');
  const black = new Color('#24202E');
  const steps: Array<() => BufferGeometry[]> = [];
  const top = H + 9;
  steps.push(() => {
    seed(ctx.seed + 41);
    const parts: BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const x = s * X;
      const foot = ctx.gy(x, 0) - 2;
      parts.push(grade(part(new CylinderGeometry(1.75, 2.05, top - foot, 14), lac, { pos: [x, (top + foot) / 2, 0] }), foot, top, 0.7, 1.05));
      // The black base (kamebara) and a snow collar.
      parts.push(part(new CylinderGeometry(2.5, 2.8, 2.6, 14), black, { pos: [x, ctx.gy(x, 0) + 0.6, 0] }));
      parts.push(drift([x, ctx.gy(x, 0) + 1.8, 0], [2.1, 0.45, 2.1]));
      // Paper lanterns hanging on the pillars' uphill faces.
      parts.push(part(new SphereGeometry(0.75, 12, 8), lampColor(night), { pos: [x, H - 3, 2.6], scale: [1, 1.3, 1] }));
      parts.push(box(0.9, 0.2, 0.9, black, [x, H - 1.9, 2.6]));
      parts.push(box(0.9, 0.2, 0.9, black, [x, H - 4.1, 2.6]));
    }
    return parts;
  });
  steps.push(() => {
    const parts: BufferGeometry[] = [];
    // The nuki (tie beam), its foot above the clearance, poking through each pillar.
    parts.push(grade(box(2 * X + 6, 1.8, 1.3, lac, [0, H + 1.35, 0]), H + 0.45, H + 2.25, 0.85, 1.05));
    // The gakuzuka (central strut) with a plaque.
    parts.push(box(1.1, top - H - 2.4, 0.9, lacD, [0, (H + 1.75 + top - 0.6) / 2, 0]));
    parts.push(box(3.0, 4.0, 0.35, black, [0, H + 4.6, 0.7]));
    parts.push(box(2.4, 3.3, 0.38, new Color('#C9A867'), [0, H + 4.6, 0.72]));
    // The shimaki and kasagi: the lintel, curving up toward its ends, black on top.
    const L = 2 * X + 12;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const x0 = -L / 2 + (L * i) / n;
      const x1 = -L / 2 + (L * (i + 1)) / n;
      const lift = (x: number) => 2.2 * Math.pow(Math.abs(x) / (L / 2), 2.6);
      parts.push(seg([x0, top + 0.3 + lift(x0), 0], [x1, top + 0.3 + lift(x1), 0], 1.05, lac, 4));
      parts.push(seg([x0, top + 1.5 + lift(x0) * 1.15, 0], [x1, top + 1.5 + lift(x1) * 1.15, 0], 1.2, black, 4));
      parts.push(seg([x0, top + 2.45 + lift(x0) * 1.15, 0], [x1, top + 2.45 + lift(x1) * 1.15, 0], 0.55, SNOW, 4));
    }
    return parts;
  });
  return { steps, spots: [], ice: false };
}

// ---------------------------------------------------------------- bank pieces

/** A pagoda-style roof: a wide square slab with its corners swept up and a snow layer. */
function sweptRoof(w: number, y: number, slate: Color, trim: Color): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  parts.push(part(new ConeGeometry(w * 0.74, w * 0.28, 4, 1), slate, { pos: [0, y + w * 0.12, 0], rot: [0, Math.PI / 4, 0] }));
  parts.push(box(w, 0.45, w, slate, [0, y, 0]));
  parts.push(part(new ConeGeometry(w * 0.66, w * 0.22, 4, 1), SNOW, { pos: [0, y + w * 0.17, 0], rot: [0, Math.PI / 4, 0], jitter: 0.06 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    parts.push(seg([sx * w * 0.38, y, sz * w * 0.38], [sx * w * 0.6, y + w * 0.12, sz * w * 0.6], 0.22, trim));
  }
  return parts;
}

/** A big mountain hut on the bank: a stone ground floor, a timber storey with a long balcony, a steep
 *  roof heavy with snow, a chimney, a flag, and a sun terrace with parasols in front. Sakura's is a
 *  tea house (plaster panels, swept roofs, lanterns); Ember's a basalt lodge with ember-lit windows. */
export function hutPiece(ctx: SiteCtx): Piece {
  const { p, night, biome } = ctx;
  const f = bankFrame(ctx, 27, 0, 0.5);
  const W = 18;
  const D = 12;
  const [lo0, hi] = f.range((W / 2 + 2) * 1.4, (D / 2 + 6) * 1.4);
  // (The plinth's foot, before the 1.4 times growth about the floor below.)
  const lo = hi + 0.6 - (hi + 0.6 - lo0) / 1.4;
  const F = hi + 0.6;
  const vol = biome === 'volcanic';
  const blossom = biome === 'blossom';
  const wallLo = vol ? shade(p.low, 0.62) : stone(p, 0.95);
  const wallHi = vol ? shade(p.low, 0.8) : blossom ? new Color('#EDE4D8') : biome === 'glacier' ? new Color('#7A6458') : TIMBER;
  const trim = blossom ? new Color('#3A2A36') : vol ? INK : TIMBER_DARK;
  const roof = blossom ? new Color('#3E3A50') : new Color('#3A3448');
  const win = vol ? lampColor(true, '#FF9A50') : windowColor(night);
  const cols = banners(p);
  const steps: Array<() => BufferGeometry[]> = [];
  steps.push(() => {
    seed(ctx.seed + 51);
    const parts: BufferGeometry[] = [];
    // The plinth fills the slope under the hut and its terrace.
    parts.push(grade(box(W + 3, F - lo + 2, D + 11, stone(p, 0.8), [0, (F + lo - 2) / 2, 2.5]), lo - 2, F, 0.7, 1.0));
    parts.push(box(W + 3.2, 0.25, D + 11.2, SNOW, [0, F + 0.05, 2.5]));
    parts.push(grade(box(W, 5, D, wallLo, [0, F + 2.5, 0]), F, F + 5, 0.82, 1.0));
    parts.push(grade(box(W - 0.2, 5, D - 0.2, wallHi, [0, F + 7.5, 0]), F + 5, F + 10, 0.88, 1.05));
    if (blossom) {
      // Dark timber framing over the plaster.
      for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 6) parts.push(box(0.35, 10, 0.25, trim, [x, F + 5, D / 2 + 0.05]));
      parts.push(box(W, 0.4, 0.3, trim, [0, F + 5, D / 2 + 0.08]));
    }
    // Windows: four below, five above, lit at night.
    for (let i = 0; i < 4; i++) parts.push(box(2.0, 1.6, 0.2, win, [-W / 2 + 2.6 + i * ((W - 5.2) / 3), F + 2.6, D / 2 + 0.02]));
    for (let i = 0; i < 5; i++) parts.push(box(1.6, 1.8, 0.2, win, [-W / 2 + 2.2 + i * ((W - 4.4) / 4), F + 7.6, D / 2 - 0.08]));
    parts.push(box(2.4, 3.4, 0.25, trim, [0, F + 1.7, D / 2 + 0.05]));
    return parts;
  });
  steps.push(() => {
    seed(ctx.seed + 52);
    const parts: BufferGeometry[] = [];
    const ry = F + 10;
    if (blossom) {
      parts.push(...place(sweptRoof(W + 4, 0, roof, trim), 0, ry, 0, 0).map((g) => g.scale(1, 1, (D + 4) / (W + 4))));
      parts.push(...place(sweptRoof(W * 0.6, 0, roof, trim), 0, ry + 4.2, 0, 0));
      parts.push(box(W * 0.5, 3.4, D * 0.5, wallHi, [0, ry + 2.4, 0]));
    } else {
      // A gable: the diamond prism half sunk in the walls, the two pitched slabs, snow on them.
      const a = D / Math.SQRT2;
      parts.push(part(new BoxGeometry(W - 0.2, a, a), shade(wallHi, 0.9), { pos: [0, ry, 0], rot: [Math.PI / 4, 0, 0] }));
      const sl = D / 2 / Math.cos(Math.PI / 4) + 1.8;
      for (const sz of [-1, 1]) {
        parts.push(box(W + 2.4, 0.5, sl, roof, [0, ry + D / 4 - 0.3, sz * (D / 4 + 0.35)], [sz * Math.PI / 4, 0, 0]));
        parts.push(softPart(new BoxGeometry(W + 2.6, 0.8, sl - 0.3, 2, 1, 2), SNOW, { pos: [0, ry + D / 4 + 0.3, sz * (D / 4 + 0.25)], rot: [sz * Math.PI / 4, 0, 0] }));
      }
      parts.push(softPart(new CylinderGeometry(0.75, 0.75, W + 2.6, 10), SNOW, { pos: [0, ry + D / 2 - 0.05, 0], rot: [0, 0, Math.PI / 2], scale: [0.7, 1, 1] }));
      // The chimney.
      parts.push(box(1.4, 4.2, 1.4, stone(p, 0.9), [W / 4, ry + D / 2, -1.5]));
      parts.push(box(1.8, 0.5, 1.8, SNOW, [W / 4, ry + D / 2 + 2.2, -1.5]));
    }
    // The balcony along the timber storey, its rail and a snow line on it.
    parts.push(box(W + 1, 0.35, 2.2, trim, [0, F + 5.2, D / 2 + 1.1]));
    for (let x = -W / 2; x <= W / 2 + 0.01; x += 1.5) parts.push(box(0.14, 1.1, 0.14, trim, [x, F + 5.9, D / 2 + 2.1]));
    parts.push(box(W + 1, 0.16, 0.2, trim, [0, F + 6.45, D / 2 + 2.1]));
    parts.push(box(W + 1, 0.14, 0.32, SNOW, [0, F + 6.6, D / 2 + 2.1]));
    // Lanterns under the balcony (Sakura) or a lamp by the door.
    if (blossom) for (let i = 0; i < 5; i++) parts.push(part(new SphereGeometry(0.42, 10, 8), lampColor(night), { pos: [-W / 2 + 1.5 + i * ((W - 3) / 4), F + 4.4, D / 2 + 1.7], scale: [1, 1.3, 1] }));
    else parts.push(part(new SphereGeometry(0.3, 8, 6), lampColor(night), { pos: [1.7, F + 3.2, D / 2 + 0.4] }));
    // A tall flagpole with a long banner by the terrace.
    parts.push(seg([-W / 2 - 1.2, F, D / 2 + 6], [-W / 2 - 1.2, F + 15, D / 2 + 6], 0.12, INK, 6));
    parts.push(box(0.06, 5.5, 2.2, cols[0], [-W / 2 - 1.2, F + 11.6, D / 2 + 7.2]));
    return parts;
  });
  steps.push(() => {
    seed(ctx.seed + 53);
    const parts: BufferGeometry[] = [];
    // The sun terrace: tables under striped parasols, a rail along its front.
    for (let i = 0; i < 4; i++) {
      const x = -W / 2 + 2.5 + i * ((W - 5) / 3);
      const z = D / 2 + 4.6 + (i % 2) * 1.2;
      parts.push(seg([x, F, z], [x, F + 2.8, z], 0.06, INK, 5));
      parts.push(part(new ConeGeometry(1.9, 0.75, 8), i % 2 ? CREAM : cols[0], { pos: [x, F + 2.9, z] }));
      parts.push(part(new ConeGeometry(1.5, 0.45, 8), SNOW, { pos: [x, F + 3.25, z] }));
      parts.push(part(new CylinderGeometry(0.75, 0.75, 0.12, 10), TIMBER_LIGHT, { pos: [x, F + 0.85, z] }));
    }
    for (let x = -W / 2 - 1; x <= W / 2 + 1.01; x += 1.6) parts.push(box(0.12, 1.0, 0.12, trim, [x, F + 0.5, D / 2 + 7.7]));
    parts.push(box(W + 2.5, 0.14, 0.18, trim, [0, F + 1.0, D / 2 + 7.7]));
    return parts;
  });
  const spots: Spot[] = [];
  // The whole hut is built at 1.4 times, about its floor, so it stands over the treeline it sits in.
  const K = 1.4;
  const grow = (parts: BufferGeometry[]) => parts.map((g) => g.translate(0, -F, 0).scale(K, K, K).translate(0, F, 0));
  for (let i = 0; i < 10; i++) spots.push(f.spot(K * (-W / 2 + 1.2 + i * ((W - 2.4) / 9)), F + 0.05, K * (D / 2 + 6.6 + ((i * 3) % 4) * 0.25), 0));
  return { steps: steps.map((s) => () => f.out(grow(s()))), spots, ice: false };
}

/** A rock spur under a bank piece: a heap of crags filling the slope up to `top`. */
function spur(f: Sub, r: number, top: number, cols: Color[]): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  const [lo] = f.range(r, r);
  const h = top - lo;
  parts.push(crag(cols[0], [0, lo + h * 0.4, 0], [r * 1.05, h * 0.75, r * 1.0], 0.25));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 6.28 + rnd();
    const rr = r * (0.6 + rnd() * 0.25);
    parts.push(crag(cols[k % cols.length], [Math.cos(a) * rr, lo + h * (0.25 + rnd() * 0.3), Math.sin(a) * rr], [r * 0.55, h * (0.45 + rnd() * 0.3), r * 0.5], 0.3));
  }
  parts.push(drift([0, top - 0.2, 0], [r * 0.85, 0.7, r * 0.8]));
  return parts;
}

/** A ruined watchtower on a rock spur: a round stone tower with string courses, slit windows (lit at
 *  night), a broken crenellated top and a tattered banner. Ember: basalt, its windows ember-lit. */
export function towerPiece(ctx: SiteCtx): Piece {
  const { p, night, biome } = ctx;
  const f = bankFrame(ctx, 22, 0, 0.45);
  const vol = biome === 'volcanic';
  const st = vol ? shade(p.low, 0.62) : stone(p, 0.92);
  const stD = vol ? shade(p.low, 0.45) : stone(p, 0.72);
  const rock = vol ? [shade(p.low, 0.55), shade(p.low, 0.68)] : [shade(p.low, 0.8), shade(p.lowLit, 0.8)];
  const win = vol ? lampColor(true, '#FF8A3C') : windowColor(night);
  const R = 4.4;
  const steps: Array<() => BufferGeometry[]> = [];
  const [, hi] = f.range(7, 7);
  const base = hi + 5;
  const top = base + 24;
  steps.push(() => {
    seed(ctx.seed + 61);
    return spur(f, 9, base + 0.6, rock);
  });
  steps.push(() => {
    seed(ctx.seed + 62);
    const parts: BufferGeometry[] = [];
    parts.push(grade(part(new CylinderGeometry(R, R * 1.15, top - base + 1, 12), st, { pos: [0, (base + top) / 2 - 0.5, 0] }), base, top, 0.75, 1.02, 0.1));
    for (const y of [base + 7, base + 15, top - 1]) {
      parts.push(part(new CylinderGeometry(R * 1.1, R * 1.1, 0.6, 12), stD, { pos: [0, y, 0] }));
      parts.push(part(new CylinderGeometry(R * 1.12, R * 1.1, 0.25, 12), SNOW, { pos: [0, y + 0.42, 0] }));
    }
    // Slit windows on the faces the run sees.
    for (const [y, a] of [
      [base + 4, 0.2],
      [base + 11, -0.4],
      [base + 11, 0.7],
      [base + 19, 0.1],
    ] as const) {
      parts.push(box(0.7, 2.2, 0.4, win, [Math.sin(a) * (R + 0.02), y, Math.cos(a) * (R + 0.02)], [0, a, 0]));
    }
    // Crenellations, three of them broken away, with a jagged gap.
    for (let k = 0; k < 12; k++) {
      if (k >= 2 && k <= 4) continue;
      const a = (k / 12) * 6.28;
      const h = 1.6 + (k === 5 || k === 1 ? -0.7 : 0);
      parts.push(box(1.5, h, 0.9, st, [Math.sin(a) * (R - 0.2), top + h / 2, Math.cos(a) * (R - 0.2)], [0, a, 0]));
      parts.push(box(1.55, 0.25, 1.0, SNOW, [Math.sin(a) * (R - 0.2), top + h + 0.1, Math.cos(a) * (R - 0.2)], [0, a, 0]));
    }
    parts.push(crag(stD, [Math.sin(2.2) * R, top - 1.4, Math.cos(2.2) * R], [1.6, 1.8, 1.4], 0.4));
    parts.push(drift([0, top + 0.1, 0], [R * 0.9, 0.4, R * 0.9]));
    // The banner pole and a tattered banner.
    parts.push(seg([0, top, 0], [0, top + 9, 0], 0.11, INK, 6));
    const tat = new BoxGeometry(3.6, 2.0, 0.06, 6, 1, 1);
    parts.push(part(tat, banners(p)[0], { pos: [1.85, top + 7.6, 0], jitter: 0.25 }));
    return parts;
  });
  return { steps: steps.map((s) => () => f.out(s())), spots: [], ice: false };
}

/** Frostfang's observatory: a pale drum and dome on a rock spur, the dome's slit open with a telescope
 *  poking out, a ring of lit windows and a mast. */
export function domePiece(ctx: SiteCtx): Piece {
  const { p, night } = ctx;
  const f = bankFrame(ctx, 24, 0, 0.4);
  const [, hi] = f.range(8, 8);
  const base = hi + 6;
  const steps: Array<() => BufferGeometry[]> = [];
  steps.push(() => {
    seed(ctx.seed + 71);
    return spur(f, 10, base + 0.6, [new Color('#6E8CB8'), new Color('#9CC2E2'), shade(p.low, 0.85)]);
  });
  steps.push(() => {
    seed(ctx.seed + 72);
    const parts: BufferGeometry[] = [];
    const drum = new Color('#C9D2E2');
    const dome = new Color('#E8EEF8');
    parts.push(grade(part(new CylinderGeometry(6.4, 7.0, 9, 16), drum, { pos: [0, base + 4.5, 0] }), base, base + 9, 0.8, 1.02));
    parts.push(part(new CylinderGeometry(7.2, 7.2, 0.6, 16), INK, { pos: [0, base + 9, 0] }));
    parts.push(softPart(new SphereGeometry(6.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), dome, { pos: [0, base + 9.2, 0] }));
    // The slit: a dark band over the dome toward the sky up the slope, and the telescope in it.
    const slit = new SphereGeometry(6.66, 4, 10, -0.28, 0.56, 0.05, Math.PI / 2 - 0.05);
    parts.push(softPart(slit, INK, { pos: [0, base + 9.2, 0] }));
    parts.push(seg([0, base + 10, 0.5], [0, base + 15.5, 6.2], 1.05, new Color('#5A6488'), 10));
    parts.push(part(new CylinderGeometry(1.2, 1.2, 0.5, 10), INK, { pos: [0, base + 15.6, 6.3], rot: [-0.85, 0, 0] }));
    // Snow on the dome's shoulders.
    parts.push(softPart(new TorusGeometry(5.6, 0.7, 6, 18), SNOW, { pos: [0, base + 11.6, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.5] }));
    // A ring of windows round the drum.
    const win = night ? lampColor(true, '#CFE4FF') : new Color('#3A4466');
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * 6.28;
      parts.push(box(1.1, 1.6, 0.3, win, [Math.sin(a) * 6.55, base + 5, Math.cos(a) * 6.55], [0, a, 0]));
    }
    // A radio mast beside the dome.
    parts.push(seg([-6, base, -4], [-6, base + 22, -4], 0.16, INK, 5));
    for (let y = base + 4; y < base + 22; y += 4) parts.push(seg([-6.8, y, -4], [-5.2, y, -4], 0.06, INK, 4));
    parts.push(part(new SphereGeometry(0.35, 8, 6), lampColor(true, '#FF8090'), { pos: [-6, base + 22.3, -4] }));
    return parts;
  });
  return { steps: steps.map((s) => () => f.out(s())), spots: [], ice: false };
}

/** A ski-jump tower beside the run: a long inrun deck on a timber lattice from a start hut high up
 *  the bank down to the takeoff, flags along its rails and floodlight masts. */
export function jumpPiece(ctx: SiteCtx): Piece {
  const { p, night } = ctx;
  const f = new Sub(ctx, ctx.side * (ctx.post + 17), 0, 0);
  const steps: Array<() => BufferGeometry[]> = [];
  const zTop = 30;
  const zTake = -16;
  const yTop = f.gy(0, zTop) + 30;
  const yTake = f.gy(0, zTake) + 5;
  const deck = (z: number) => yTake + ((z - zTake) / (zTop - zTake)) ** 1.35 * (yTop - yTake);
  const cols = banners(p);
  steps.push(() => {
    seed(ctx.seed + 81);
    const parts: BufferGeometry[] = [];
    const n = 16;
    for (let i = 0; i < n; i++) {
      const z0 = zTake + ((zTop - zTake) * i) / n;
      const z1 = zTake + ((zTop - zTake) * (i + 1)) / n;
      parts.push(seg([0, deck(z0), z0], [0, deck(z1), z1], 2.4, TIMBER_LIGHT, 4));
      parts.push(seg([0, deck(z0) + 0.45, z0], [0, deck(z1) + 0.45, z1], 1.5, SNOW, 4));
      for (const x of [-1.9, 1.9]) {
        parts.push(seg([x, deck(z0) + 1.0, z0], [x, deck(z1) + 1.0, z1], 0.08, TIMBER_DARK));
        if (i % 2 === 0) parts.push(seg([x, deck(z0), z0], [x, deck(z0) + 1.0, z0], 0.07, TIMBER_DARK));
      }
      if (i % 3 === 0) {
        for (const x of [-1.9, 1.9]) {
          parts.push(seg([x, deck(z0) + 1, z0], [x, deck(z0) + 2.6, z0], 0.05, INK, 4));
          const g = new BoxGeometry(0.05, 0.8, 1.1);
          parts.push(part(g, cols[(i / 3) % cols.length], { pos: [x, deck(z0) + 2.2, z0 - 0.55] }));
        }
      }
    }
    return parts;
  });
  steps.push(() => {
    seed(ctx.seed + 82);
    const parts: BufferGeometry[] = [];
    // The lattice under the inrun.
    for (let z = zTake + 2; z < zTop; z += 6) {
      const y = deck(z) - 0.6;
      for (const x of [-1.8, 1.8]) {
        const foot = f.gy(x * 1.8, z) - 1;
        parts.push(grade(seg([x * 1.8, foot, z], [x, y, z], 0.22, TIMBER), foot, y, 0.72, 1.05));
      }
      const foot = Math.min(f.gy(-3.2, z), f.gy(3.2, z));
      for (let yy = foot + 3; yy < y - 1; yy += 4.5) {
        parts.push(seg([-3.0, yy, z], [3.0, yy, z], 0.1, TIMBER_DARK));
        if (yy + 4.5 < y) parts.push(seg([-3.0, yy, z], [3.0, yy + 4.5, z], 0.07, TIMBER_DARK));
      }
      if (z + 6 < zTop) parts.push(seg([0, y - 1.5, z], [0, deck(z + 6) - 3, z + 6], 0.1, TIMBER_DARK));
    }
    // The start hut at the top and the takeoff table's lip.
    const yt = deck(zTop);
    parts.push(box(5.5, 4, 5, TIMBER, [0, yt + 1.5, zTop + 1.5]));
    parts.push(part(new ConeGeometry(4.6, 2.6, 4), new Color('#3A3448'), { pos: [0, yt + 4.8, zTop + 1.5], rot: [0, Math.PI / 4, 0] }));
    parts.push(part(new ConeGeometry(4.0, 1.8, 4), SNOW, { pos: [0, yt + 5.4, zTop + 1.5], rot: [0, Math.PI / 4, 0] }));
    parts.push(box(2.6, 1.2, 0.2, windowColor(night), [0, yt + 2, zTop - 1.05]));
    parts.push(box(4.4, 0.5, 1.4, TIMBER_DARK, [0, deck(zTake) + 0.1, zTake - 0.4]));
    // Floodlight masts.
    for (const [x, z] of [
      [-6, 6],
      [6, -8],
    ]) {
      const foot = f.gy(x, z);
      parts.push(seg([x, foot - 1, z], [x, foot + 26, z], 0.2, INK, 6));
      parts.push(box(2.6, 1.0, 0.6, INK, [x, foot + 26.4, z]));
      parts.push(box(2.2, 0.6, 0.2, lampColor(night, '#E8F0FF'), [x, foot + 26.4, z + 0.35]));
    }
    return parts;
  });
  return { steps: steps.map((s) => () => f.out(s())), spots: [], ice: false };
}

/** A tall cliff on the bank with a waterfall frozen down its face (Glacier: blue ice, the ice
 *  material) or a lava fall glowing down it (Ember), and a fan of ice or a lava pool at its foot. */
export function fallsPiece(ctx: SiteCtx): Piece {
  const { p, biome } = ctx;
  const lava = biome === 'volcanic';
  const f = bankFrame(ctx, 26, 0, 0.62);
  const [lo, hi] = f.range(22, 6);
  const top = hi + 30;
  const rock = lava ? [shade(p.low, 0.48), shade(p.low, 0.6), shade(p.low, 0.4)] : [new Color('#55689A'), new Color('#6E86B4'), new Color('#46578A')];
  const steps: Array<() => BufferGeometry[]> = [];
  for (const half of [-1, 1]) {
    steps.push(() => {
      seed(ctx.seed + 91 + half);
      const parts: BufferGeometry[] = [];
      for (let row = 0; row < 4; row++) {
        for (let k = 0; k < 4; k++) {
          const x = half * (4 + k * 5.2 + rnd() * 1.5);
          const y = lo + 2 + row * ((top - lo) / 4) + rnd() * 2;
          const sc = 4.6 + rnd() * 1.6 - row * 0.3;
          parts.push(crag(rock[(row + k) % 3], [x, y, -2 - row * 0.8 - k * 0.6], [sc * 1.25, sc * 1.35, 5.5], 0.3));
          if (rnd() < 0.55) parts.push(drift([x, y + sc * 1.25, -1.2 - row * 0.8], [sc * 0.8, 0.5, 2.0]));
        }
      }
      // The cliff's body behind the faces, so the ledges read as one wall, not a stack.
      for (let row = 0; row < 3; row++) parts.push(crag(rock[row % 3], [half * 11, lo + 4 + row * ((top - lo) / 3), -7 - row], [13, (top - lo) / 3.2, 6], 0.22));
      // The lip's overhang over the fall.
      parts.push(crag(rock[1], [half * 3.2, top + 0.5, -1.5], [4.5, 2.6, 4.5], 0.25));
      parts.push(drift([half * 3.2, top + 2.8, -1.8], [4.2, 0.9, 3.8]));
      return parts;
    });
  }
  steps.push(() => {
    seed(ctx.seed + 95);
    const parts: BufferGeometry[] = [];
    const fall = lava ? [lampColor(true, '#FF8A3C'), lampColor(true, '#FFB050'), new Color('#3A2A30')] : [new Color('#BFEAFF'), new Color('#E2F6FF'), new Color('#8FD0F0')];
    // The fall: columns from the lip to the foot, widening toward the bottom.
    for (let k = 0; k < 16; k++) {
      const t = k / 15;
      const x = (rnd() - 0.5) * (3 + t * 7);
      const y0 = top - t * (top - lo) * 0.25;
      const h = (top - lo) * (0.55 + rnd() * 0.4);
      const r = 0.8 + rnd() * 1.1;
      const g = new CylinderGeometry(r * 0.75, r, h, 7, 3);
      parts.push(part(g, fall[k % 3 === 2 && lava ? 0 : k % 3], { pos: [x, y0 - h / 2, 1.2 + rnd() * 1.4], jitter: 0.35 }));
    }
    // An icicle curtain (or lava drips) along the lip.
    for (let k = 0; k < 12; k++) {
      const len = 1.5 + rnd() * 3;
      parts.push(part(new ConeGeometry(0.3 + rnd() * 0.3, len, 5), fall[1], { pos: [-7 + k * 1.3, top - len / 2 - 0.3, 1.8], rot: [Math.PI, 0, 0] }));
    }
    // The fan of ice, or the glowing pool, at the foot.
    for (let k = 0; k < 6; k++) {
      parts.push(part(new IcosahedronGeometry(1, 1), fall[k % 2], { pos: [(rnd() - 0.5) * 12, lo + 0.8, 3 + rnd() * 3], scale: [3.5 + rnd() * 2, 1.4, 2.6], jitter: 0.2 }));
    }
    return parts;
  });
  return { steps: steps.map((s) => () => f.out(s())), spots: [], ice: !lava };
}

/** A giant stone guardian on a stepped plinth: a hooded, robed figure with its hands folded on a
 *  planted staff, snow on its hood and shoulders, its eyes lit (ice blue in Frostfang, ember in Ember
 *  Peak). Sakura: a colossal stone lantern instead, its firebox lit. */
export function guardianPiece(ctx: SiteCtx): Piece {
  const { p, biome, night } = ctx;
  const f = bankFrame(ctx, 21, 0, 0.5);
  const [lo, hi] = f.range(7, 7);
  const st = biome === 'volcanic' ? shade(p.low, 0.6) : stone(p, 0.95);
  const stD = biome === 'volcanic' ? shade(p.low, 0.45) : stone(p, 0.75);
  const steps: Array<() => BufferGeometry[]> = [];
  const b = hi + 2.4;
  steps.push(() => {
    seed(ctx.seed + 101);
    const parts: BufferGeometry[] = [];
    parts.push(grade(box(14, b - lo + 2, 14, stD, [0, (b + lo - 2) / 2, 0]), lo - 2, b, 0.7, 1.0));
    parts.push(box(14.2, 0.3, 14.2, SNOW, [0, b + 0.05, 0]));
    parts.push(box(10, 2.4, 10, st, [0, b + 1.2, 0]));
    parts.push(box(10.2, 0.3, 10.2, SNOW, [0, b + 2.5, 0]));
    return parts;
  });
  if (biome === 'blossom') {
    steps.push(() => {
      seed(ctx.seed + 102);
      const parts: BufferGeometry[] = [];
      const y = b + 2.4;
      const lamp = lampColor(true, '#FFB45E');
      parts.push(part(new CylinderGeometry(3.4, 4.0, 2.2, 6), st, { pos: [0, y + 1.1, 0] }));
      parts.push(grade(part(new CylinderGeometry(1.5, 1.7, 9, 8), st, { pos: [0, y + 6.6, 0] }), y + 2, y + 11, 0.8, 1.02));
      parts.push(part(new CylinderGeometry(4.2, 3.0, 1.6, 6), st, { pos: [0, y + 11.8, 0] }));
      parts.push(box(5.2, 4.2, 5.2, stD, [0, y + 14.7, 0]));
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) parts.push(box(2.4, 2.6, 0.3, night ? lamp : new Color('#E8D2A8'), [Math.sin(a) * 2.62, y + 14.9, Math.cos(a) * 2.62], [0, a, 0]));
      parts.push(part(new ConeGeometry(6.6, 3.4, 6), stD, { pos: [0, y + 18.4, 0] }));
      parts.push(part(new ConeGeometry(5.6, 2.4, 6), SNOW, { pos: [0, y + 19.0, 0], jitter: 0.08 }));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 6.28;
        parts.push(part(new SphereGeometry(0.5, 6, 4), stD, { pos: [Math.cos(a) * 6.2, y + 17.2, Math.sin(a) * 6.2] }));
      }
      parts.push(part(new SphereGeometry(1.1, 10, 8), st, { pos: [0, y + 21.2, 0] }));
      parts.push(part(new ConeGeometry(0.9, 1.6, 8), st, { pos: [0, y + 22.6, 0] }));
      return parts;
    });
  } else {
    steps.push(() => {
      seed(ctx.seed + 103);
      const parts: BufferGeometry[] = [];
      const y = b + 2.4;
      const eye = biome === 'volcanic' ? lampColor(true, '#FF9A40') : lampColor(true, '#CFF4FF');
      // The robe and its folds, the chest and shoulders.
      parts.push(grade(part(new CylinderGeometry(3.4, 5.2, 14, 10), st, { pos: [0, y + 7, 0], jitter: 0.25 }), y, y + 14, 0.78, 1.0, 0.1));
      for (let k = 0; k < 5; k++) {
        const a = -0.9 + k * 0.45;
        parts.push(seg([Math.sin(a) * 4.9, y + 0.3, Math.cos(a) * 4.9], [Math.sin(a) * 3.3, y + 12, Math.cos(a) * 3.3], 0.45, stD, 5));
      }
      parts.push(part(new CylinderGeometry(4.0, 3.4, 5, 10), st, { pos: [0, y + 16.4, 0] }));
      parts.push(part(new SphereGeometry(4.1, 12, 6), st, { pos: [0, y + 18.6, 0], scale: [1, 0.55, 0.8] }));
      // The hood, its peak falling back, the shadowed face and two lit eyes.
      parts.push(part(new SphereGeometry(2.8, 12, 10), st, { pos: [0, y + 22, -0.2], jitter: 0.15 }));
      parts.push(part(new ConeGeometry(2.2, 3.6, 8), st, { pos: [0, y + 24.2, -1.6], rot: [-0.7, 0, 0] }));
      parts.push(softPart(new SphereGeometry(1.95, 12, 10), new Color('#1C1A2C'), { pos: [0, y + 21.7, 1.25], scale: [1, 1.1, 0.7] }));
      for (const sx of [-0.7, 0.7]) parts.push(part(new SphereGeometry(0.34, 8, 6), eye, { pos: [sx, y + 22.0, 2.45], scale: [1.3, 0.8, 0.6] }));
      // Snow on the hood and shoulders.
      parts.push(drift([0, y + 24.0, -0.6], [2.3, 0.7, 2.2]));
      for (const sx of [-1, 1]) parts.push(drift([sx * 2.8, y + 19.8, 0], [1.9, 0.55, 2.2]));
      // The arms folded forward over the staff, which stands planted on the plinth.
      for (const sx of [-1, 1]) parts.push(seg([sx * 3.6, y + 17.5, 0.4], [sx * 0.9, y + 12.6, 4.0], 1.15, st, 8));
      parts.push(part(new SphereGeometry(1.5, 10, 8), stD, { pos: [0, y + 12.4, 4.2], scale: [1.4, 1, 1] }));
      parts.push(seg([0, y - 2.2, 4.4], [0, y + 25.5, 4.4], 0.55, stD, 7));
      parts.push(part(new IcosahedronGeometry(1.3, 0), eye, { pos: [0, y + 26.8, 4.4], scale: [1, 1.6, 1] }));
      parts.push(part(new TorusGeometry(1.4, 0.25, 5, 10), stD, { pos: [0, y + 25.6, 4.4], rot: [Math.PI / 2, 0, 0] }));
      return parts;
    });
  }
  return { steps: steps.map((s) => () => f.out(s())), spots: [], ice: false };
}

/** Sakura's five-tier pagoda on a stone base beside the run: plaster tiers under swept, snow-laden
 *  roofs, lit windows at night, and a bronze finial of rings. */
export function pagodaPiece(ctx: SiteCtx): Piece {
  const { p, night } = ctx;
  const f = bankFrame(ctx, 18, 0, 0.5);
  const [lo, hi] = f.range(7, 7);
  const b = hi + 1.5;
  const steps: Array<() => BufferGeometry[]> = [];
  const slate = new Color('#3E3A50');
  const trim = new Color('#5A2F42');
  const wall = new Color('#EDE4D8');
  const bronze = new Color('#5E5468');
  steps.push(() => {
    seed(ctx.seed + 111);
    const parts: BufferGeometry[] = [];
    parts.push(grade(box(13, b - lo + 2, 13, stone(p, 0.85), [0, (b + lo - 2) / 2, 0]), lo - 2, b, 0.7, 1.0));
    parts.push(box(13.2, 0.3, 13.2, SNOW, [0, b + 0.05, 0]));
    let y = b;
    for (let i = 0; i < 5; i++) {
      const w = 8.6 - i * 1.15;
      const h = i === 0 ? 4.4 : 3.2;
      parts.push(grade(box(w, h, w, wall, [0, y + h / 2, 0]), y, y + h, 0.9, 1.03));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.35, h, 0.35, trim, [(sx * w) / 2, y + h / 2, (sz * w) / 2]));
      const win = night ? lampColor(true, '#FFC27A') : new Color('#3A2A36');
      for (const a of [0, Math.PI / 2, -Math.PI / 2]) parts.push(box(w * 0.32, h * 0.45, 0.2, win, [Math.sin(a) * (w / 2 + 0.02), y + h * 0.5, Math.cos(a) * (w / 2 + 0.02)], [0, a, 0]));
      y += h;
      parts.push(...place(sweptRoof(w + 4.2, 0, slate, trim), 0, y + 0.1, 0, 0));
      y += 1.6;
    }
    return parts;
  });
  steps.push(() => {
    const parts: BufferGeometry[] = [];
    const y = b + 4.4 + 4 * 3.2 + 5 * 1.6 + 1.2;
    parts.push(seg([0, y - 1, 0], [0, y + 8, 0], 0.32, bronze, 8));
    for (let k = 0; k < 7; k++) parts.push(part(new TorusGeometry(0.75 - k * 0.05, 0.16, 5, 12), bronze, { pos: [0, y + 1.5 + k * 0.8, 0], rot: [Math.PI / 2, 0, 0] }));
    parts.push(part(new SphereGeometry(0.55, 10, 8), bronze, { pos: [0, y + 8.3, 0] }));
    return parts;
  });
  return { steps: steps.map((s) => () => f.out(s())), spots: [], ice: false };
}

/** The piece for a kind. */
export function pieceFor(kind: Kind, ctx: SiteCtx): Piece {
  switch (kind) {
    case 'gate':
      return gatePiece(ctx);
    case 'bridge':
      return bridgePiece(ctx);
    case 'arch':
      return archPiece(ctx);
    case 'basalt':
      return basaltPiece(ctx);
    case 'torii':
      return toriiPiece(ctx);
    case 'hut':
      return hutPiece(ctx);
    case 'tower':
      return towerPiece(ctx);
    case 'jump':
      return jumpPiece(ctx);
    case 'falls':
      return fallsPiece(ctx);
    case 'dome':
      return domePiece(ctx);
    case 'guardian':
      return guardianPiece(ctx);
    case 'pagoda':
      return pagodaPiece(ctx);
  }
}

/** Merges a piece's made parts (and frees them). */
export function mergePiece(parts: BufferGeometry[]): BufferGeometry {
  const g = merge(parts);
  for (const q of parts) q.dispose();
  return g;
}
