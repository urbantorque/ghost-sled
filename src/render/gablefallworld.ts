import { BufferAttribute, BufferGeometry, Color, Mesh, Object3D, PerspectiveCamera, ShaderMaterial } from 'three';
import type { Snap } from '../game/run';
import type { Beat } from '../game/beats';
import type { Course } from '../sim/course';
import { BACK, FRONT, ROOF_GRADE, type Piece, type Row, placesOf, rowAt, rowsOf } from '../sim/gablefall';
import type { Sim } from '../sim/sim';
import { makeToonMaterial, shared } from './materials';
import { LANE, isGablefall } from './gablefallplan';
import type { Palette } from './palette';
import type { Detail } from './postfx/tiers';
import type { ViewMode } from './world';

// Gablefall's own world (round 9, notes/r9-gablefall-world.md), loaded with its course (world.ts imports this file on
// demand: nothing of it is in the first download). The town: the sim's ground is the snow on its roofs, its street and
// its drifts (the terrain draws it); this draws the houses under that snow. Each row's houses stand from the street to
// their eaves, their fronts on the street with lit windows, a slate fascia and a lip of snow along each eave; behind each
// row the town goes on, house after house with steep roofs, down to the river.
//
// Its cost (section 0 of the notes): the town is everywhere, so it is drawn as a few big pieces, not as houses. The course
// is cut into SEG-metre segments; each segment's near rows (fronts, backs, windows, eaves) are one mesh and the town past
// them one more (on Low the two are one), built once from the course, in one material whose windows glow from their own
// colour (materials.ts GLOW_MASK), not lights. A segment is drawn only within reach of the rider.

type V3 = [number, number, number];

/** Metres of course a segment holds. */
const SEG = 128;
/** How far ahead a segment is drawn (sim metres past the rider), and behind. */
const REACH: Record<Detail, number> = { low: 420, medium: 640, high: 760 };
const BEHIND = 60;
/** The houses' storeys: the window's sill and head over the street, ground floor and first floor. */
const STOREYS: ReadonlyArray<[number, number]> = [
  [1.15, 2.45],
  [3.35, 4.65],
];
/** Metres between window bays along a front (Low: wider), and from a house's ends to its first bay. */
const BAY = 3.2;
const BAY_END = 1.7;
/** How far the fascia and the snow's lip stand out from a wall at the eave. */
const FASCIA_OUT = 0.28;
const LIP_OUT = 0.42;

const C = (h: string): Color => new Color(h);
/** The houses' plaster: muted, cool-leaning (ART.md 1: no role's colour). */
const WALLS = [C('#E6DCC8'), C('#D8BC8A'), C('#A8B4C4'), C('#C8A8A4'), C('#A8B49C'), C('#9C98B0'), C('#E8E6E0'), C('#C4B49C')];
const PLINTH = C('#6C6A7E');
const SLATE = C('#3A3C52');
const SLATE_L = C('#4E5068');
const SNOW = C('#F4F7FF');
const SURROUND = C('#EFE8DA');
const DOORS = [C('#2E4A44'), C('#2E3A5A'), C('#4A3A30'), C('#3E3448')];
/** A lit window: a warm lamp in the glass (the house material's glow reads it), under the lantern's marigold. */
const LIT = C('#FFB866');
const DARK = C('#2A2E48');

/** A small deterministic hash, 0..1. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** A growing soup of flat-shaded, vertex-coloured triangles in world space (sim z turned to three.js -z as it goes in).
 *  Each face is wound to look along the side it is given, so the material can cull back faces. */
class Soup {
  readonly pos: number[] = [];
  readonly nrm: number[] = [];
  readonly col: number[] = [];

  get tris(): number {
    return this.pos.length / 9;
  }

  /** One triangle (sim coordinates), turned to face `out` (sim) if it does not. */
  tri(a: V3, b: V3, c: V3, col: Color, out: V3): void {
    const ax = a[0];
    const ay = a[1];
    const az = -a[2];
    let bx = b[0];
    let by = b[1];
    let bz = -b[2];
    let cx = c[0];
    let cy = c[1];
    let cz = -c[2];
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (nx * out[0] + ny * out[1] - nz * out[2] < 0) {
      [bx, cx] = [cx, bx];
      [by, cy] = [cy, by];
      [bz, cz] = [cz, bz];
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let i = 0; i < 3; i++) {
      this.nrm.push(nx, ny, nz);
      this.col.push(col.r, col.g, col.b);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, col: Color, out: V3): void {
    this.tri(a, b, c, col, out);
    this.tri(a, c, d, col, out);
  }

  /** A box standing at sim (x, y, z), w across (its local x), d along (its local z), h tall, turned by yaw; no
   *  underside, and no top when `top` is false. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, col: Color, yaw = 0, top = true): void {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const p = (u: number, v: number, t: number): V3 => [x + u * c + t * s, y + v, z - u * s + t * c];
    const ax = (u: number, t: number): V3 => [u * c + t * s, 0, -u * s + t * c];
    const hw = w / 2;
    const hd = d / 2;
    this.quad(p(-hw, 0, -hd), p(hw, 0, -hd), p(hw, h, -hd), p(-hw, h, -hd), col, ax(0, -1));
    this.quad(p(-hw, 0, hd), p(hw, 0, hd), p(hw, h, hd), p(-hw, h, hd), col, ax(0, 1));
    this.quad(p(-hw, 0, -hd), p(-hw, 0, hd), p(-hw, h, hd), p(-hw, h, -hd), col, ax(-1, 0));
    this.quad(p(hw, 0, -hd), p(hw, 0, hd), p(hw, h, hd), p(hw, h, -hd), col, ax(1, 0));
    if (top) this.quad(p(-hw, h, -hd), p(hw, h, -hd), p(hw, h, hd), p(-hw, h, hd), col, [0, 1, 0]);
  }

  /** A gable roof over a w (across) by d (along) footprint whose eaves stand at y, its ridge along the local z axis
   *  `rise` over the eaves, overhanging by `over` all round; the gable ends' triangles in `gableCol` (null: none). */
  gable(x: number, y: number, z: number, w: number, d: number, rise: number, over: number, col: Color, gableCol: Color | null, yaw: number): void {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const p = (u: number, v: number, t: number): V3 => [x + u * c + t * s, y + v, z - u * s + t * c];
    const ax = (u: number, v: number, t: number): V3 => [u * c + t * s, v, -u * s + t * c];
    const hw = w / 2 + over;
    const hd = d / 2 + over;
    const drop = (rise * over) / (w / 2);
    this.quad(p(-hw, -drop, -hd), p(-hw, -drop, hd), p(0, rise, hd), p(0, rise, -hd), col, ax(-rise, hw, 0));
    this.quad(p(hw, -drop, -hd), p(hw, -drop, hd), p(0, rise, hd), p(0, rise, -hd), col, ax(rise, hw, 0));
    if (!gableCol) return;
    this.tri(p(-w / 2, 0, -d / 2), p(w / 2, 0, -d / 2), p(0, rise, -d / 2), gableCol, ax(0, 0, -1));
    this.tri(p(-w / 2, 0, d / 2), p(w / 2, 0, d / 2), p(0, rise, d / 2), gableCol, ax(0, 0, 1));
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere();
    return g;
  }
}

/** One drawn segment of the town: its near rows and the town past them (one mesh on Low), and where it lies. */
interface Segment {
  z0: number;
  z1: number;
  meshes: Mesh[];
}

export class GablefallWorld {
  readonly root = new Object3D();
  private course: Course | null = null;
  private detail: Detail = 'high';
  /** The houses: plaster, slate, snow and glass in one material, its windows lit from their own colour. */
  private readonly mat: ShaderMaterial;
  private segs: Segment[] = [];
  /** Triangles built, near and far (the notes' count). */
  tris = { near: 0, far: 0 };

  constructor() {
    this.root.name = 'gablefall-world';
    this.mat = makeToonMaterial({ coolShade: 0.3, glowMask: true, emissive: C('#FFB45E'), emissiveStrength: 0.8, rim: 0.2 });
  }

  setDetail(d: Detail): void {
    if (d === this.detail) return;
    this.detail = d;
    if (this.course) this.build(this.course);
  }

  setCourse(c: Course): void {
    if (c === this.course) return;
    this.course = c;
    this.build(c);
  }

  reset(): void {}

  beats(_list: readonly Beat[], _s: Snap): void {}

  private dispose(): void {
    for (const o of [...this.root.children]) this.root.remove(o);
    for (const s of this.segs) for (const m of s.meshes) m.geometry.dispose();
    this.segs = [];
    this.tris = { near: 0, far: 0 };
  }

  private build(c: Course): void {
    this.dispose();
    if (!isGablefall(c)) return;
    const low = this.detail === 'low';
    const end = placesOf(c).quay + 60;
    const rows = rowsOf(c);
    for (let z0 = 0; z0 < end; z0 += SEG) {
      const z1 = Math.min(end, z0 + SEG);
      const near = new Soup();
      const far = low ? near : new Soup();
      for (const row of rows) if (row.z1 > z0 && row.z0 < z1) this.nearRow(c, row, z0, z1, near, low);
      this.farTown(c, z0, z1, far, low);
      const meshes: Mesh[] = [];
      const add = (s: Soup, shadow: boolean, name: string): void => {
        if (!s.tris) return;
        const m = new Mesh(s.geometry(), this.mat);
        m.name = name;
        m.castShadow = shadow;
        m.receiveShadow = true;
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        this.root.add(m);
        meshes.push(m);
      };
      if (far === near) this.tris.near += near.tris;
      else {
        this.tris.near += near.tris;
        this.tris.far += far.tris;
      }
      add(near, true, 'town-near');
      if (far !== near) add(far, false, 'town-far');
      this.segs.push({ z0, z1, meshes });
    }
  }

  /** The houses of one row whose tops lie inside [z0, z1): their fronts on the street and their backs on the lane. */
  private nearRow(c: Course, row: Row, z0: number, z1: number, s: Soup, low: boolean): void {
    const sd = row.side;
    for (const p of row.pieces) {
      if (p.kind !== 'house' || p.z0 < z0 || p.z0 >= z1) continue;
      const id = Math.floor(p.z0 * 2) * 2 + (sd > 0 ? 1 : 0);
      const wall = WALLS[Math.floor(hash(id, 1) * WALLS.length)];
      this.wallRun(c, s, p, sd, FRONT, wall, id, low, true);
      this.wallRun(c, s, p, sd, BACK, wall, id + 7, low, false);
    }
  }

  /** One long wall of house p, at `adx` across from the street's middle on side sd (its front on the street, or its
   *  back on the lane), from the ground under it to the eave: plaster, its windows (most lit), and on the front a door,
   *  a stone plinth; a slate fascia and the snow's lip along the eave. */
  private wallRun(c: Course, s: Soup, p: Piece, sd: number, adx: number, wall: Color, id: number, low: boolean, front: boolean): void {
    const L = p.z1 - p.z0;
    const n = Math.max(1, Math.ceil(L / 4));
    // Facing the street (front) or the lane (back), across: out along x, signed.
    const o = front ? -sd : sd;
    const out: V3 = [o, 0, 0];
    const at = (z: number, off: number): number => c.centerX(z) + sd * adx + o * off;
    const foot = (z: number): number => (front ? c.baseY(z) : c.baseY(z) + LANE) - 0.35;
    const eave = (z: number): number => p.e0 - ROOF_GRADE * (z - p.z0);
    for (let k = 0; k < n; k++) {
      const za = p.z0 + (k * L) / n;
      const zb = p.z0 + ((k + 1) * L) / n;
      const xa = at(za, 0);
      const xb = at(zb, 0);
      s.quad([xa, foot(za), za], [xb, foot(zb), zb], [xb, eave(zb) - 0.3, zb], [xa, eave(za) - 0.3, za], wall, out);
      if (front) {
        // The plinth, a step proud of the plaster.
        const pa = at(za, 0.04);
        const pb = at(zb, 0.04);
        s.quad([pa, foot(za), za], [pb, foot(zb), zb], [pb, c.baseY(zb) + 0.65, zb], [pa, c.baseY(za) + 0.65, za], PLINTH, out);
      }
      // The fascia under the eave (its face and its soffit) and the snow's lip over it, rounding off the roof's edge.
      const fa = at(za, FASCIA_OUT);
      const fb = at(zb, FASCIA_OUT);
      s.quad([fa, eave(za) - 0.36, za], [fb, eave(zb) - 0.36, zb], [fb, eave(zb) - 0.02, zb], [fa, eave(za) - 0.02, za], SLATE, out);
      s.quad([xa, eave(za) - 0.36, za], [xb, eave(zb) - 0.36, zb], [fb, eave(zb) - 0.36, zb], [fa, eave(za) - 0.36, za], SLATE_L, [0, -1, 0]);
      const la = at(za, LIP_OUT);
      const lb = at(zb, LIP_OUT);
      const ra = at(za, -0.05);
      const rb = at(zb, -0.05);
      s.quad([ra, eave(za) + 0.04, za], [rb, eave(zb) + 0.04, zb], [lb, eave(zb) - 0.08, zb], [la, eave(za) - 0.08, za], SNOW, [o * 0.3, 1, 0]);
      if (!low) s.quad([la, eave(za) - 0.08, za], [lb, eave(zb) - 0.08, zb], [lb, eave(zb) - 0.24, zb], [la, eave(za) - 0.24, za], SNOW, out);
    }
    // Windows in bays along the wall, two storeys; on the front one bay is the door.
    const bay = low ? BAY * 1.3 : BAY;
    const nb = Math.max(1, Math.floor((L - 2 * BAY_END) / bay) + 1);
    const span = (nb - 1) * bay;
    const door = front ? Math.floor(hash(id, 3) * nb) : -1;
    for (let b = 0; b < nb; b++) {
      const zc = p.z0 + (L - span) / 2 + b * bay;
      const by = front ? c.baseY(zc) : c.baseY(zc) + LANE;
      for (let st = 0; st < STOREYS.length; st++) {
        if (!front && hash(id + b, st + 11) < 0.4) continue;
        const [y0, y1] = STOREYS[st];
        if (st === 0 && b === door) {
          const d0 = at(zc - 0.6, 0.03);
          const d1 = at(zc + 0.6, 0.03);
          s.quad([d0, by - 0.1, zc - 0.6], [d1, by - 0.1, zc + 0.6], [d1, by + 2.3, zc + 0.6], [d0, by + 2.3, zc - 0.6], DOORS[Math.floor(hash(id, 5) * DOORS.length)], out);
          continue;
        }
        if (!low) {
          const s0 = at(zc - 0.62, 0.015);
          const s1 = at(zc + 0.62, 0.015);
          s.quad([s0, by + y0 - 0.16, zc - 0.62], [s1, by + y0 - 0.16, zc + 0.62], [s1, by + y1 + 0.14, zc + 0.62], [s0, by + y1 + 0.14, zc - 0.62], SURROUND, out);
        }
        const w0 = at(zc - 0.46, 0.03);
        const w1 = at(zc + 0.46, 0.03);
        const lit = hash(id + b * 3, st + 17) < (front ? 0.6 : 0.5);
        s.quad([w0, by + y0, zc - 0.46], [w1, by + y0, zc + 0.46], [w1, by + y1, zc + 0.46], [w0, by + y1, zc - 0.46], lit ? LIT : DARK, out);
      }
    }
  }

  /** The town past the rows inside [z0, z1): rows of houses with steep roofs, snow on their slate, behind each row of
   *  the run and round the squares, their windows lit toward the run. */
  private farTown(c: Course, z0: number, z1: number, s: Soup, low: boolean): void {
    const pl = placesOf(c);
    const deep = low ? 2 : 3;
    for (const sd of [-1, 1] as const) {
      for (let k = 0; k < deep; k++) {
        let z = z0 + hash(k + (sd > 0 ? 9 : 0), Math.floor(z0)) * 4;
        let i = 0;
        while (z < z1) {
          const id = Math.floor(z * 4) * 8 + k * 2 + (sd > 0 ? 1 : 0);
          const L = 7 + hash(id, 21) * 6;
          const zc = z + L / 2;
          z += L + hash(id, 22) * 2.5;
          i++;
          // (Not on the church's hill nor on the river: their own pieces stand there.)
          if (zc < 120 || zc > pl.quay - 10) continue;
          const sec = c.section(zc);
          const hw = c.halfWidth(zc);
          const row = sec.kind === 'rooftops' ? rowAt(c, sd, zc) : null;
          const inner = row ? BACK + 3.6 : hw + c.edgeLimit(zc) + 2.5;
          const D = 8 + hash(id, 23) * 3;
          const adx = inner + k * 13 + hash(id, 24) * 2;
          const x = c.centerX(zc) + sd * (adx + D / 2);
          const y = c.baseY(zc) + LANE - 0.4 + k * 0.5;
          const H = 5.2 + hash(id, 25) * 2.6 + (k === deep - 1 ? 1 : 0);
          const wall = WALLS[Math.floor(hash(id, 26) * WALLS.length)];
          // Its ridge along the run (eaves to it) or across it (a gable end to it), steep: the town's roofs.
          const across = hash(id, 27) < 0.45;
          const w = across ? L : D;
          const d = across ? D : L;
          const yaw = across ? Math.PI / 2 : 0;
          s.box(x, y, zc, D, H, L, wall, 0, false);
          const rise = (w / 2) * (0.95 + hash(id, 28) * 0.4);
          s.gable(x, y + H, zc, w, d, rise, 0.35, SLATE, wall, yaw);
          s.gable(x, y + H + 0.12 + rise * 0.18, zc, w * 0.82, d * 1.0, rise * 0.82, 0.32, SNOW, null, yaw);
          if (!low && hash(id, 29) < 0.7) s.box(x + (hash(id, 30) - 0.5) * D * 0.5, y + H + rise * 0.4, zc + (hash(id, 31) - 0.5) * L * 0.5, 0.7, rise * 0.75 + 1.1, 0.7, SLATE_L);
          // Its windows on the face toward the run.
          const fx = c.centerX(zc) + sd * adx - sd * 0.03;
          const nw = Math.max(1, Math.floor((L - 2) / 2.6));
          for (let st = 0; st < (low ? 1 : 2); st++) {
            for (let j = 0; j < nw; j++) {
              if (hash(id + j, st + 33) < 0.45) continue;
              const wz = zc - ((nw - 1) * 2.6) / 2 + j * 2.6;
              const y0 = y + 1.4 + st * 2.3;
              s.quad([fx, y0, wz - 0.42], [fx, y0, wz + 0.42], [fx, y0 + 1.2, wz + 0.42], [fx, y0 + 1.2, wz - 0.42], LIT, [-sd, 0, 0]);
            }
          }
        }
        void i;
      }
    }
  }

  update(_dt: number, _time: number, _mode: ViewMode, s: Snap, _sim: Sim | null, _camera: PerspectiveCamera, _p: Palette): void {
    if (!this.course) return;
    const reach = REACH[this.detail];
    for (const g of this.segs) {
      const on = s.z > g.z0 - reach && s.z < g.z1 + BEHIND;
      for (const m of g.meshes) m.visible = on;
    }
    // The windows: lit all afternoon in the snowfall, brighter as the day goes.
    this.mat.uniforms.uEmissiveStrength.value = 0.55 + 0.6 * Math.min(1, shared.uLampK.value as number);
  }
}
