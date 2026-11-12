import { BufferAttribute, BufferGeometry, Color } from 'three';

// Round 7's rock forms (ART.md 15, rule 3: painted detail, never noise; nothing in the frame is an
// untextured box). Two builders, both flat-shaded and vertex-coloured like every other part in the game, so
// they read under any material:
//
//   strata()   a rock laid down in beds: stacked layers, each its own outline, value and thickness, each
//              shifted a little off the one under it, so one side of a bed steps in (a ledge that holds
//              snow) and the other juts out (an overhang with a dark soffit). The beds dip a little.
//   columns()  basalt: hexagonal columns packed shoulder to shoulder, each broken off at its own height on
//              its own slant, ash lying on the flatter tops.
//
// Geometry carries the bands and the ledges; no texture and no shader is asked for. A form made for a
// collider is built inside it: `rx`, `rz` and `h` are outer bounds the rock never passes (tests/rockforms).

type V3 = [number, number, number];

/** Collects flat-shaded, coloured triangles and makes one non-indexed geometry of them. */
export class Facets {
  private pos: number[] = [];
  private col: number[] = [];

  get triangles(): number {
    return this.pos.length / 9;
  }

  /** One triangle, wound so its face looks along `out` (a hint: any vector on its outer side), with a
   *  value on each corner. */
  tri(a: V3, b: V3, c: V3, col: Color, out: V3, ka = 1, kb = ka, kc = ka): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    // (A sliver draws nothing and its normal is noise: left out.)
    if (nx * nx + ny * ny + nz * nz < 1e-10) return;
    const keep = nx * out[0] + ny * out[1] + nz * out[2] >= 0;
    const p = keep ? b : c;
    const q = keep ? c : b;
    const kp = keep ? kb : kc;
    const kq = keep ? kc : kb;
    this.pos.push(a[0], a[1], a[2], p[0], p[1], p[2], q[0], q[1], q[2]);
    this.col.push(col.r * ka, col.g * ka, col.b * ka, col.r * kp, col.g * kp, col.b * kp, col.r * kq, col.g * kq, col.b * kq);
  }

  /** A quad a, b, c, d (in order round its edge) as two triangles: value `k0` on a and b, `k1` on c and d
   *  (a gradient up a wall). */
  quad(a: V3, b: V3, c: V3, d: V3, col: Color, out: V3, k0 = 1, k1 = k0): void {
    this.tri(a, b, c, col, out, k0, k0, k1);
    this.tri(a, c, d, col, out, k0, k1, k1);
  }

  /** Moves everything added since `from` triangles (a part built at the origin, set in its place). */
  place(from: number, x: number, y: number, z: number, yaw = 0, leanX = 0, leanZ = 0): void {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cx = Math.cos(leanX);
    const sx = Math.sin(leanX);
    const cz = Math.cos(leanZ);
    const sz = Math.sin(leanZ);
    for (let i = from * 9; i < this.pos.length; i += 3) {
      let px = this.pos[i];
      let py = this.pos[i + 1];
      let pz = this.pos[i + 2];
      // Lean about x, then about z, then turn about y.
      let t = py * cx - pz * sx;
      pz = py * sx + pz * cx;
      py = t;
      t = px * cz - py * sz;
      py = px * sz + py * cz;
      px = t;
      t = px * cy + pz * sy;
      pz = -px * sy + pz * cy;
      px = t;
      this.pos[i] = px + x;
      this.pos[i + 1] = py + y;
      this.pos[i + 2] = pz + z;
    }
  }

  /** The geometry: position, flat normal and colour, as meshes.ts part() makes them. */
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** A small seeded generator of its own (a form is the same on every machine and every build). */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface StrataSpec {
  /** The footprint's half extents and the top's height: outer bounds the rock never passes. */
  rx: number;
  rz: number;
  h: number;
  /** How far the foot runs on under y = 0 (it stands in the snow, on a slope). */
  foot?: number;
  /** Beds, and the corners of each bed's outline. */
  layers: number;
  sides: number;
  /** The rock's values, darkest first (two or three). */
  rock: readonly Color[];
  /** What lies on the ledges and the top (snow, ash, moss); null leaves the rock bare. */
  lie: Color | null;
  /** How much smaller the top bed is than the foot (0 a tower, 0.5 a cairn). */
  taper?: number;
  /** How far a bed shifts off the one under it, as a share of the smaller half extent: what makes one
   *  side a ledge and the other an overhang. */
  shift?: number;
  /** The beds' dip across x, metres of rise a metre. */
  dip?: number;
  /** A level top at exactly `h` that something stands on, under a slab of `lie` whose lip droops over
   *  the edge. Without it the top is a low broken crown with `lie` on its gentler facets. */
  flat?: boolean;
  /** How rough the outline is (0.1 dressed, 0.3 broken). */
  rough?: number;
  /** The outline's squareness: 1 an ellipse, toward 0.5 a rounded rectangle (a long shoulder whose top
   *  must hold a crowd out to its corners). */
  square?: number;
  /** A drift of `lie` banked round the foot (a clean seam with the slope): its reach past the foot as a
   *  share of the half extents (0 for none), and the ground under a point, if the builder knows it. */
  apron?: number;
  ground?: (x: number, z: number) => number;
  seed: number;
}

/** A rock in beds (see the head of this file). Stands on y = 0, centred on the origin. */
export function strataInto(f: Facets, s: StrataSpec): void {
  const r = rng(s.seed);
  const N = Math.max(5, s.sides);
  const L = Math.max(1, s.layers);
  const foot = s.foot ?? 0.5;
  const taper = s.taper ?? 0.25;
  const shift = s.shift ?? 0.1;
  const rough = s.rough ?? 0.2;
  const dip = s.dip ?? 0;
  const small = Math.min(s.rx, s.rz);
  const sq = s.square ?? 1;
  const pw = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), sq);
  // The shared outline: every bed is this shape, scaled, shifted and a little roughened, so the rock is one
  // mass and not a stack of unrelated discs.
  const ang: number[] = [];
  const base: number[] = [];
  for (let k = 0; k < N; k++) {
    ang.push(((k + (r() - 0.5) * 0.5) / N) * Math.PI * 2);
    base.push(1 - rough * r());
  }
  // (The outline reaches its bounds at its widest corner: a form made for a collider fills it.)
  const widest = Math.max(...base);
  for (let k = 0; k < N; k++) base[k] /= widest;
  // Bed boundaries: uneven thicknesses.
  const ys: number[] = [-foot];
  let sum = 0;
  const th: number[] = [];
  for (let i = 0; i < L; i++) {
    th.push(0.65 + r() * 0.7);
    sum += th[i];
  }
  let acc = 0;
  for (let i = 0; i < L; i++) {
    acc += th[i];
    ys.push((acc / sum) * s.h);
  }
  // Each bed: its scale (stepping in up the rock), its shift, and its own outline noise. Everything is
  // kept inside the bounds: scale plus shift never passes 1.
  interface Bed {
    lo: V3[];
    hi: V3[];
    cx: number;
    cz: number;
    tone: number;
  }
  const beds: Bed[] = [];
  let scale = 1;
  for (let i = 0; i < L; i++) {
    const top = i === L - 1;
    const sh = i === 0 ? 0 : shift * (0.4 + 0.6 * r());
    const a = r() * Math.PI * 2;
    const room = Math.max(0, 1 - sh);
    const sc = Math.min(scale, room);
    const cx = Math.cos(a) * sh * small;
    const cz = Math.sin(a) * sh * small;
    const lo: V3[] = [];
    const hi: V3[] = [];
    for (let k = 0; k < N; k++) {
      const n = base[k] * (1 - rough * 0.35 * r());
      // Walls lean in a little up each bed (a battered face catches the light along its top edge).
      const x0 = pw(Math.cos(ang[k])) * s.rx * sc * n + cx;
      const z0 = pw(Math.sin(ang[k])) * s.rz * sc * n + cz;
      const x1 = pw(Math.cos(ang[k])) * s.rx * sc * n * 0.95 + cx;
      const z1 = pw(Math.sin(ang[k])) * s.rz * sc * n * 0.95 + cz;
      // The dip fades out toward a level top.
      const d0 = dip * (s.flat ? 1 - Math.max(0, ys[i]) / s.h : 1);
      const d1 = dip * (s.flat ? 1 - Math.max(0, ys[i + 1]) / s.h : 1);
      // (The lowest bed's foot follows the ground where the builder knows it, a metre under the snow: a
      // shoulder that runs out over a leap's drop never shows its underside.)
      lo.push([x0, i === 0 ? (s.ground ? Math.min(s.ground(x0, z0) - 1, ys[1] - 0.2) : ys[0]) : ys[i] + x0 * d0, z0]);
      hi.push([x1, Math.min(s.h, ys[i + 1] + (top && s.flat ? 0 : x1 * d1)), z1]);
    }
    beds.push({ lo, hi, cx, cz, tone: i % s.rock.length });
    scale = sc - (taper / Math.max(1, L - 1)) * (0.5 + r());
    scale = Math.max(1 - taper - 0.1, scale);
  }
  const DOWN: V3 = [0, -1, 0];
  const UP: V3 = [0, 1, 0];
  for (let i = 0; i < L; i++) {
    const b = beds[i];
    const col = s.rock[b.tone];
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      const out: V3 = [(b.lo[k][0] + b.lo[k1][0]) / 2 - b.cx, 0, (b.lo[k][2] + b.lo[k1][2]) / 2 - b.cz];
      // A bed's face: darker at its foot than at its top edge, each facet its own small step of value.
      const fk = 0.94 + r() * 0.12;
      f.quad(b.lo[k], b.lo[k1], b.hi[k1], b.hi[k], col, out, 0.8 * fk, 1.06 * fk);
    }
    if (i === L - 1) break;
    // Between this bed and the next: where the next steps in, a ledge (and what lies on it, banked up
    // against the wall behind); where it juts out, a soffit in the rock's darkest value.
    const u = beds[i + 1];
    const soffit = s.rock[0];
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      const mx = (b.hi[k][0] + b.hi[k1][0]) / 2;
      const mz = (b.hi[k][2] + b.hi[k1][2]) / 2;
      const ux = (u.lo[k][0] + u.lo[k1][0]) / 2;
      const uz = (u.lo[k][2] + u.lo[k1][2]) / 2;
      const inner = Math.hypot(ux - b.cx, uz - b.cz);
      const outer = Math.hypot(mx - b.cx, mz - b.cz);
      const ledge = outer - inner;
      if (ledge > 0) {
        if (s.lie && ledge > small * 0.05) {
          // Banked against the wall: the snow's inner edge stands up the next bed's face.
          const bank = Math.min(ledge * 0.7, (ys[i + 2] - ys[i + 1]) * 0.45);
          const a: V3 = [u.lo[k][0], u.lo[k][1] + bank, u.lo[k][2]];
          const c: V3 = [u.lo[k1][0], u.lo[k1][1] + bank, u.lo[k1][2]];
          f.quad(b.hi[k], b.hi[k1], c, a, s.lie, UP, 0.93, 1);
        } else f.quad(b.hi[k], b.hi[k1], u.lo[k1], u.lo[k], s.rock[s.rock.length - 1], UP, 1.05);
      } else f.quad(b.hi[k], b.hi[k1], u.lo[k1], u.lo[k], soffit, DOWN, 0.62);
    }
  }
  // The top.
  const t = beds[L - 1];
  if (s.flat) {
    // A slab of snow (or ash) a hand deep, its lip drooping over the edge all round.
    const lie = s.lie ?? s.rock[s.rock.length - 1];
    const c: V3 = [t.cx, s.h + 0.02, t.cz];
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      const a: V3 = [t.hi[k][0], s.h + 0.02, t.hi[k][2]];
      const b: V3 = [t.hi[k1][0], s.h + 0.02, t.hi[k1][2]];
      f.tri(c, a, b, lie, UP);
      if (!s.lie) continue;
      const droop = 0.22 + 0.2 * r();
      const la: V3 = [t.cx + (a[0] - t.cx) * 1.03, s.h - droop, t.cz + (a[2] - t.cz) * 1.03];
      const lb: V3 = [t.cx + (b[0] - t.cx) * 1.03, s.h - droop * (0.7 + 0.5 * r()), t.cz + (b[2] - t.cz) * 1.03];
      f.quad(la, lb, b, a, lie, [a[0] - t.cx, 0.4, a[2] - t.cz], 0.88, 1);
    }
  } else {
    // A low broken crown: its peak off-centre and inside the height bound, what lies on it on the
    // facets that face up.
    const peak: V3 = [t.cx + (r() - 0.5) * small * 0.3, s.h, t.cz + (r() - 0.5) * small * 0.3];
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      const a = t.hi[k];
      const b = t.hi[k1];
      const snowy = s.lie && r() < 0.72;
      f.tri(peak, a, b, snowy ? s.lie! : s.rock[s.rock.length - 1], UP, snowy ? 0.96 + r() * 0.04 : 1.02);
    }
  }
  // The drift banked round the foot.
  const apron = s.apron ?? 0;
  if (apron > 0 && s.lie) {
    const b = beds[0];
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      const pt = (v: V3, up: boolean): V3 => {
        const x = up ? v[0] : v[0] * (1 + apron);
        const z = up ? v[2] : v[2] * (1 + apron);
        const g = s.ground ? s.ground(x, z) : 0;
        return [x, up ? g + 0.16 * s.h * (0.5 + r()) : g - (s.ground ? 0.15 : foot), z];
      };
      // (The wall's own lower corners, lifted to where the drift meets it.)
      const a = pt(b.lo[k], true);
      const c = pt(b.lo[k1], true);
      f.quad(pt(b.lo[k], false), pt(b.lo[k1], false), c, a, s.lie, [b.lo[k][0], small, b.lo[k][2]], 0.95, 1);
    }
  }
}

export function strata(s: StrataSpec): BufferGeometry {
  const f = new Facets();
  strataInto(f, s);
  return f.build();
}

export interface ColumnSpec {
  x: number;
  z: number;
  /** Where its foot's y = 0 stands (default 0). */
  y?: number;
  /** Radius to the corners, and the height of its highest corner. */
  r: number;
  h: number;
  /** How far the foot runs on under y = 0. */
  foot?: number;
  yaw?: number;
  /** The break's slant: the top's rise per metre along x and z. */
  slant?: [number, number];
  /** The column's value, and what lies on its top (null: the bare break, in `broke`). */
  col: Color;
  top: Color | null;
  broke: Color;
  /** Lean, radians about x and z (a column fallen against its neighbours). */
  lean?: [number, number];
}

/** One basalt column: a hexagonal prism open at the foot, dark at the foot and its own value at the top,
 *  each face its own small step of value, broken off on a slant. 16 triangles. */
export function columnInto(f: Facets, c: ColumnSpec, r: () => number): void {
  const from = f.triangles;
  const foot = c.foot ?? 0.4;
  const yaw = c.yaw ?? 0;
  const sl = c.slant ?? [0, 0];
  const lo: V3[] = [];
  const hi: V3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = yaw + (k / 6) * Math.PI * 2;
    const x = Math.cos(a) * c.r;
    const z = Math.sin(a) * c.r;
    lo.push([x * 1.04, -foot, z * 1.04]);
    // (Never above h: the slant only ever cuts down from the high corner.)
    hi.push([x, c.h - Math.abs(sl[0]) * c.r - Math.abs(sl[1]) * c.r + x * sl[0] + z * sl[1], z]);
  }
  for (let k = 0; k < 6; k++) {
    const k1 = (k + 1) % 6;
    // Two values round a column: its faces alternate a step apart, so the joints read.
    const fk = (k % 2 ? 0.86 : 1.04) * (0.95 + r() * 0.1);
    f.quad(lo[k], lo[k1], hi[k1], hi[k], c.col, [lo[k][0] + lo[k1][0], 0, lo[k][2] + lo[k1][2]], 0.62 * fk, 1.05 * fk);
  }
  const cap = c.top ?? c.broke;
  for (let k = 1; k < 5; k++) f.tri(hi[0], hi[k], hi[k + 1], cap, [0, 1, 0], c.top ? 0.96 + r() * 0.06 : 0.9 + r() * 0.2);
  const lean = c.lean ?? [0, 0];
  f.place(from, c.x, c.y ?? 0, c.z, 0, lean[0], lean[1]);
}

export interface ColumnsSpec {
  /** Each column: x, z, corner radius, height. */
  cols: ReadonlyArray<readonly [number, number, number, number]>;
  /** The basalt's two values (dark, a step lighter), the bare break's, and what lies on flat tops. */
  rock: readonly [Color, Color];
  broke: Color;
  top: Color | null;
  /** The share of tops broken on a steep slant (bare), the rest near level under `top`. */
  broken?: number;
  foot?: number;
  seed: number;
}

/** Columns standing together (an organ-pipe cluster): each turned a little its own way, broken at its own
 *  slant, the flatter tops holding ash. */
export function columnsInto(f: Facets, s: ColumnsSpec): void {
  const r = rng(s.seed);
  const broken = s.broken ?? 0.45;
  s.cols.forEach(([x, z, rad, h], i) => {
    const steep = r() < broken;
    const a = r() * Math.PI * 2;
    const k = steep ? 0.35 + r() * 0.45 : r() * 0.12;
    columnInto(f, { x, z, r: rad, h, foot: s.foot, yaw: (r() - 0.5) * 0.35, slant: [Math.cos(a) * k, Math.sin(a) * k], col: s.rock[i % 2], top: steep ? null : s.top, broke: s.broke }, r);
  });
}

export function columns(s: ColumnsSpec): BufferGeometry {
  const f = new Facets();
  columnsInto(f, s);
  return f.build();
}

/** A honeycomb of column centres: `ranks` rows along x, `n` in the front row, each row behind half a
 *  step across and one less wide. Returns [x, z] pairs, the front rank at z = 0 and the rest behind it. */
export function honeycomb(n: number, ranks: number, r: number): Array<[number, number]> {
  const dx = r * 1.74;
  const dz = r * 1.5;
  const out: Array<[number, number]> = [];
  for (let j = 0; j < ranks; j++) {
    const m = n - j;
    for (let k = 0; k < m; k++) out.push([(k - (m - 1) / 2) * dx, -j * dz]);
  }
  return out;
}

/** The outer bounds of a geometry's vertices above `yMin` (tests: a form inside its collider): the
 *  largest distance from the y axis, and the highest point. */
export function formBounds(g: BufferGeometry, yMin = 0): { r: number; h: number } {
  const p = g.getAttribute('position') as BufferAttribute;
  let r = 0;
  let h = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > h) h = y;
    if (y < yMin) continue;
    r = Math.max(r, Math.hypot(p.getX(i), p.getZ(i)));
  }
  return { r, h };
}
