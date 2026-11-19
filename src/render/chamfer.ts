import { BoxGeometry, BufferAttribute, BufferGeometry, Color } from 'three';

// Edges that look made (the visual lift, DECISIONS 360 and 361). Every kit piece in the game is a box at heart
// (a plank, a post, a lantern's body, an eave, a sign, a bench, a rail's cap), and a box's edge is a hairline
// where two flat values meet: at the lens it read as cardboard on every mountain. A chamfered box has a narrow
// face along each edge, turned half way between the two faces it joins, and a small one at each corner, so an
// edge catches the light the way a planed timber or a dressed stone does. The chamfer is painted as well as
// cut, because the toon light's two values cannot by themselves put a highlight on a face turned half way: a
// chamfer that looks up is a step lighter (the sky along a top edge), one on the side a little lighter (an
// arris), one that looks down a step darker (the crease under a board). So it reads under whatever light a
// frame has, on every tier: on Medium and Low, which have no occlusion pass to draw a crease, the geometry is
// what gives an edge.
//
// Everything is made at build time with the piece (on idle time, as the landmarks and props are) and costs no
// draw and no shader. A chamfered box is 44 triangles where a box is 12, so the chamfer goes where it reads:
// on Low only on the pieces that ask for it by name (the ones seen at the lens); on Medium and High on every
// kit box 20 cm or more thick (a street holds thin boards, seats and trim by the thousand, and their chamfer
// would be a pixel at best), and on a thinner sign or board that asks; never on a light (a part whose colour
// is pushed past 1 to bloom: its edge is lost in its glow).

/** How many triangles a chamfered box has (a plain box has 12). */
export const CHAMFER_TRIS = 44;

/** A part thinner than this keeps its plain box (a board, a seat, a cord, a pane, a trim line), unless it asks
 *  as a sign (THIN_SIDE): its chamfer would be a pixel at best at the distances a street is seen from. */
const MIN_SIDE = 0.2;
const THIN_SIDE = 0.06;
/** A chamfer is this share of the part's thinnest side... */
const SHARE = 0.16;
/** ...and never wider than this (a tower's corner is a dressed arris, not a bevel). */
const MAX_C = 0.11;

/** What the automatic chamfer does: 'full' on Medium and High, 'low' on Low (none, but where a builder asks
 *  for one by name), 'off' (tests and probes: every box plain, to weigh the chamfer's cost). */
export type ChamferLevel = 'full' | 'low' | 'off';
let level: ChamferLevel = 'full';
/** A level that wins over every other (probes weighing the chamfer: scripts/playtest/props-tris.ts). */
let pinned: ChamferLevel | null = null;

export function chamferLevel(): ChamferLevel {
  return pinned ?? level;
}

/** The level for whatever is built from now on (Props sets it by its tier as it builds, before the set
 *  pieces' worlds build theirs on idle time). */
export function setChamferTier(low: boolean): void {
  level = low ? 'low' : 'full';
}

/** Pins every build to one level (null lets go): probes only. */
export function pinChamfer(l: ChamferLevel | null): void {
  pinned = l;
}

/** Runs `fn` with the automatic chamfer at `l` (a builder's steps run one at a time, so a module-wide level
 *  set round each is exact). */
export function withChamfer<T>(l: ChamferLevel, fn: () => T): T {
  const was = level;
  level = l;
  try {
    return fn();
  } finally {
    level = was;
  }
}

/** The chamfer a box of these sides takes at the current level (0: a plain box). `col` is its colour: a
 *  light keeps its plain box. A `sign` (a board read at the lens) takes one down to 6 cm thick. */
export function chamferFor(w: number, h: number, d: number, col?: Color, sign = false): number {
  if (chamferLevel() !== 'full') return 0;
  const t = Math.min(w, h, d);
  if (t < (sign ? THIN_SIDE : MIN_SIDE)) return 0;
  // (Nor on a light, nor on snow: a slab of snow on a sill or a cap is soft already, and its chamfer could take
  // no lift.)
  if (col && (Math.max(col.r, col.g, col.b) > 1.001 || Math.min(col.r, col.g, col.b) > 0.86)) return 0;
  return Math.min(MAX_C, t * SHARE);
}

/** A chamfer a builder asks for by name (a named piece at the lens keeps its edges on every tier): `c`, or 0
 *  while a probe pins every build plain. */
export function namedChamfer(c: number): number {
  return pinned === 'off' ? 0 : c;
}

/** A box for a kit's part: chamfered where the current level and its size say so, else a plain box. */
export function kitBox(w: number, h: number, d: number, col?: Color, sign = false): BufferGeometry {
  const c = chamferFor(w, h, d, col, sign);
  return c > 0 ? chamferBox(w, h, d, c) : new BoxGeometry(w, h, d);
}

type V3 = [number, number, number];

/** A box w by h by d centred on the origin, its twelve edges chamfered `c` wide (a face's own width shrinks
 *  by 2c) and its eight corners cut by a triangle. Flat-shaded and non-indexed; `userData.edge` marks the
 *  chamfer's vertices (1) for liftEdges. `taper` scales the top's x and z (a tapering post): 1 is square. */
export function chamferBox(w: number, h: number, d: number, c: number, taper: [number, number] = [1, 1]): BufferGeometry {
  const a: V3 = [w / 2, h / 2, d / 2];
  const cc = Math.max(0, Math.min(c, 0.45 * Math.min(w, h, d)));
  const pos: number[] = [];
  const edge: number[] = [];
  const tri = (p: V3, q: V3, r: V3, out: V3, e: number) => {
    // Wound so its face looks along `out`.
    const ux = q[0] - p[0];
    const uy = q[1] - p[1];
    const uz = q[2] - p[2];
    const vx = r[0] - p[0];
    const vy = r[1] - p[1];
    const vz = r[2] - p[2];
    const flip = (uy * vz - uz * vy) * out[0] + (uz * vx - ux * vz) * out[1] + (ux * vy - uy * vx) * out[2] < 0;
    const s = flip ? [p, r, q] : [p, q, r];
    for (const v of s) pos.push(v[0], v[1], v[2]);
    edge.push(e, e, e);
  };
  const quad = (p: V3, q: V3, r: V3, s: V3, out: V3, e: number) => {
    tri(p, q, r, out, e);
    tri(p, r, s, out, e);
  };
  const pt = (i: number, si: number, j: number, sj: number, k: number, sk: number, ci: number, cj: number, ck: number): V3 => {
    const v: V3 = [0, 0, 0];
    v[i] = si * (a[i] - ci);
    v[j] = sj * (a[j] - cj);
    v[k] = sk * (a[k] - ck);
    return v;
  };
  const axes: Array<[number, number, number]> = [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
  ];
  // The six faces, each inset by c from its edges.
  for (const [i, j, k] of axes) {
    for (const si of [-1, 1]) {
      const out: V3 = [0, 0, 0];
      out[i] = si;
      quad(pt(i, si, j, -1, k, -1, 0, cc, cc), pt(i, si, j, 1, k, -1, 0, cc, cc), pt(i, si, j, 1, k, 1, 0, cc, cc), pt(i, si, j, -1, k, 1, 0, cc, cc), out, 0);
    }
  }
  if (cc > 0) {
    // The twelve chamfers: between face i (at si) and face j (at sj), running along k.
    for (const [i, j, k] of axes) {
      for (const si of [-1, 1]) {
        for (const sj of [-1, 1]) {
          const out: V3 = [0, 0, 0];
          out[i] = si;
          out[j] = sj;
          quad(pt(i, si, j, sj, k, -1, 0, cc, cc), pt(i, si, j, sj, k, 1, 0, cc, cc), pt(i, si, j, sj, k, 1, cc, 0, cc), pt(i, si, j, sj, k, -1, cc, 0, cc), out, 1);
        }
      }
    }
    // The eight corners.
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          tri(pt(0, sx, 1, sy, 2, sz, 0, cc, cc), pt(0, sx, 1, sy, 2, sz, cc, 0, cc), pt(0, sx, 1, sy, 2, sz, cc, cc, 0), [sx, sy, sz], 1);
        }
      }
    }
  }
  if (taper[0] !== 1 || taper[1] !== 1) {
    // A post that tapers: x and z scale from the foot's to the head's up its height.
    for (let v = 0; v < pos.length; v += 3) {
      const u = (pos[v + 1] + a[1]) / Math.max(h, 1e-6);
      pos[v] *= 1 + (taper[0] - 1) * u;
      pos[v + 2] *= 1 + (taper[1] - 1) * u;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.computeVertexNormals();
  g.userData.edge = new Float32Array(edge);
  return g;
}

/** A turned or cut part whose chamfers are its slanted faces (a lathed plinth's bevelled rim, an extruded
 *  letter's bevel): made flat-shaded and non-indexed, every face turned between 17 and 72 degrees off its
 *  axis's plane (y: a turned part's level faces; z: a letter's face) marked for liftEdges. Only for parts whose
 *  slanted faces are all chamfers (not a roof). */
export function bevelled(geo: BufferGeometry, axis: 'y' | 'z' = 'y'): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  const n = g.getAttribute('normal') as BufferAttribute;
  const e = new Float32Array(n.count);
  for (let i = 0; i + 2 < n.count; i += 3) {
    const na = Math.abs(axis === 'y' ? n.getY(i) : n.getZ(i));
    const flag = na > 0.3 && na < 0.95 ? 1 : 0;
    e[i] = e[i + 1] = e[i + 2] = flag;
  }
  g.userData.edge = e;
  return g;
}

/** How much lighter a chamfer is: on the side, and for each unit it looks up (a top edge catches the sky);
 *  one that looks down goes darker by DOWN a unit (the crease under a board). */
const SIDE = 0.1;
const UP = 0.22;
const DOWN = 0.3;

/** Paints a chamfered part's chamfers (its `userData.edge`) by where each looks once the part is in place: a
 *  part()'s last step, after its colour is laid. A colour pushed past 1 (a light) is left as it is, and a lift
 *  never takes a colour past white. */
export function liftEdges(g: BufferGeometry): void {
  const e = g.userData.edge as Float32Array | undefined;
  if (!e) return;
  const n = g.getAttribute('normal') as BufferAttribute;
  const col = g.getAttribute('color') as BufferAttribute;
  for (let i = 0; i < col.count && i < e.length; i++) {
    if (e[i] === 0) continue;
    const ny = n.getY(i);
    let k = 1 + SIDE + (ny >= 0 ? UP * ny : DOWN * ny);
    const r = col.getX(i);
    const gg = col.getY(i);
    const b = col.getZ(i);
    const m = Math.max(r, gg, b);
    if (m > 1) continue;
    if (k > 1) k = Math.min(k, 1 / Math.max(m, 1e-3));
    col.setXYZ(i, r * k, gg * k, b * k);
  }
  delete g.userData.edge;
}
