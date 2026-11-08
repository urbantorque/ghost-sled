import { BufferAttribute, BufferGeometry, Mesh, Object3D, ShaderMaterial } from 'three';
import { CHUNK_LEN, Course, Ramp } from '../sim/course';
import { HANDOVER_FROM, HANDOVER_TO, MID_ROW, handoverRow, ledgeAt, rampart, rockWeight, smoothK, vnoise2, wallK } from './ground';
import { makeSnowMaterial, shared } from './materials';
import { LIP, LIP_FROM, lipDrop, type OverlookPlan, type Overlooks } from './overlook';

// Terrain chunks that bend with the corridor: each row of vertices is laid out relative to the
// centreline at that z, so the playable lane gets dense vertices and the far forest floor is
// coarse. Heights come straight from the sim's ground function, so what you see is what you ride.
// Chunk builds are time-sliced across frames so streaming the course never hitches.
// On an overlook (overlook.ts) the snow past the lip rolls over and falls away; inside LIP_FROM it is
// untouched, so the corridor, its banks and the shelf the dressing stands on are still the sim's.
// Past a section's edgeLimit a wall stands up into rock (ground.ts), and round a ledge the outer columns
// ease onto the mid-ground's rows, so the terrain's edge never stands clear of it at the step.

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface TerrainDetail {
  /** Lateral vertex spacing inside the corridor, metres. */
  inner: number;
  /** Row spacing, metres. */
  row: number;
  /** How far past the corridor edge the mesh extends. */
  reach: number;
}

const OUTER_STEPS = [12, 16, 22, 30, 42, 58, 80, 110];
/** Medium and High: about twice the outer columns, so the drifts past the treeline have vertices to
 *  sit on. */
const OUTER_STEPS_FINE = [11.5, 13, 14.5, 16, 18, 20, 22, 24.5, 27, 30, 34, 38, 42, 47, 52, 58, 66, 74, 80, 92, 110];

// ---------------------------------------------------------------- drifts past the treeline
//
// Visual-only snow relief, laid only where no sled can ride: from just past FOREST_LIMIT (10 m past
// the corridor edge, where the sim's forest crash begins) outward. Inside that the mesh is the sim's
// ground to the millimetre. Two layers: soft drift dunes (long swells lying across the wind, their
// crests narrow and their troughs broad) and a pillowed rim where the banks meet the trees. The lift is
// never negative, so a tree or a bank piece placed on course.ground() can sink into a drift but never
// float over a hollow.

/** Metres past the corridor edge where the drifts begin, and where they reach full height. */
export const DRIFT_FROM = 10.5;
const DRIFT_FULL = 22;

/** The drift field at sim (x, z), `edge` metres past the corridor edge (course.edgeExcess): out[0] is
 *  the lift in metres (never negative), out[1] how near a swell's crest this is (0..1), so the snow
 *  shader can catch the sun on it. Zero everywhere a sled can ride. */
export function snowDrift(x: number, z: number, edge: number, out: [number, number]): [number, number] {
  if (edge <= DRIFT_FROM) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  const ramp = Math.min(1, (edge - DRIFT_FROM) / (DRIFT_FULL - DRIFT_FROM));
  const rk = ramp * ramp * (3 - 2 * ramp);
  // Swells lie across a wind blowing about 25 degrees off the fall line: long along the crest, short
  // across it, with a slow warp so the crests wander instead of ruling the slope.
  const u = x * 0.906 + z * 0.423;
  const v = -x * 0.423 + z * 0.906;
  const warp = vnoise2(u * 0.02, v * 0.02, 7) * 3.2;
  const swell = vnoise2(v * 0.07 + warp, u * 0.02, 3) * 0.7 + vnoise2(v * 0.15 + warp, u * 0.05, 5) * 0.3;
  // Drifts pile up: a sharpened swell, so crests are narrow and the troughs broad and soft.
  const crest = Math.max(0, swell - 0.3) / 0.7;
  const pile = crest * crest;
  // The pillowed rim where the banks meet the treeline: soft mounds a few metres across.
  const rim = Math.exp(-((edge - 13) * (edge - 13)) / 10) * vnoise2(x * 0.3, z * 0.22, 11);
  out[0] = rk * (pile * 1.7 + 0.3 * vnoise2(x * 0.06, z * 0.06, 13)) + rim * 0.45 * Math.min(1, (edge - DRIFT_FROM) * 0.6);
  out[1] = rk * crest;
  return out;
}

/** The snow's lift past the treeline on an overlook opened by `w`, from the drifts' own `lift`. */
function overLip(lift: number, e: number, w: number): number {
  return lift * (1 - w * smooth(LIP - 2, LIP + 8, e)) - w * lipDrop(e);
}

/** The same offsets for every chunk of a course, so neighbouring chunks share edge vertices
 *  exactly and no cracks open between them. */
function lateralOffsets(course: Course, d: TerrainDetail): number[] {
  const hw = course.params.halfWidthStart + 2.6;
  const inner = hw + 10;
  const n = Math.ceil((inner * 2) / d.inner);
  const out: number[] = [];
  // Low (reach 60) keeps the original coarse columns.
  for (const s of d.reach > 60 ? OUTER_STEPS_FINE : OUTER_STEPS) if (s > 10 && s <= d.reach) out.push(-(hw + s), hw + s);
  for (let k = 0; k <= n; k++) out.push(-inner + (k * inner * 2) / n);
  out.sort((a, b) => a - b);
  return out;
}

function rowPositions(course: Course, index: number, d: TerrainDetail): number[] {
  const z0 = index * CHUNK_LEN;
  const z1 = z0 + CHUNK_LEN;
  const rows = new Set<number>();
  for (let z = z0; z <= z1 + 1e-6; z += d.row) rows.add(Math.min(z, z1));
  rows.add(z1);
  // Extra rows where features have sharp edges (ramp lips, drop lips, moguls).
  for (let k = index - 2; k <= index; k++) {
    if (k < 0) continue;
    const zn = course.zones(k);
    // (Kickers run on past the lip: their takeoff wall and the contact shadow at its foot.)
    for (const r of zn.ramps) for (let z = r.z - 0.5; z <= r.z + r.len + 2.9; z += 0.45) if (z > z0 && z < z1) rows.add(z);
    for (const dr of zn.drops) for (let z = dr.z - 1; z <= dr.z + dr.len + 2; z += 0.6) if (z > z0 && z < z1) rows.add(z);
    for (const m of zn.moguls) for (let z = m.z0; z <= m.z1; z += 0.8) if (z > z0 && z < z1) rows.add(z);
  }
  return [...rows].sort((a, b) => a - b);
}

/** Incremental chunk geometry builder. */
class ChunkJob {
  readonly zRows: number[];
  readonly offs: number[];
  readonly pos: Float32Array;
  readonly nrm: Float32Array;
  readonly edge: Float32Array;
  readonly ice: Float32Array;
  /** Per vertex, for a built kicker (snow shader): how fully it lies across the ramp (1 on it, falling
   *  to 0 off its flanks), how far up the face (0 at its foot, 1 at the lip), metres across from the
   *  ramp's middle and metres past the lip. (0, -1, 0, -10) away from any kicker. */
  readonly kick: Float32Array;
  /** Per vertex: metres across from the corridor's centreline (the packed sled lane down its middle)
   *  and how near a drift's crest it lies (0..1; snow shader). */
  readonly snow: Float32Array;
  /** Per vertex: how bare the ground is (0 snow, 1 rock), its height over the floor and metres along the
   *  face (what the snow shader lays its strata on), and the crest of the wall standing here, metres
   *  over the floor (0 for none), whose shadow crosses the floor. */
  readonly rock: Float32Array;
  /** Per vertex: the lake (1 on the sheet), the fork's strip, a leap's groomed landing and a tree run's
   *  canopy, each 0..1. */
  readonly paint: Float32Array;
  private ramps: Ramp[] = [];
  private drift: [number, number] = [0, 0];
  row = 0;

  constructor(
    readonly course: Course,
    readonly index: number,
    d: TerrainDetail,
    /** The overlooks' plan (null: none), read once per row. */
    readonly ov: OverlookPlan | null = null,
  ) {
    this.zRows = rowPositions(course, index, d);
    this.offs = lateralOffsets(course, d);
    const n = this.zRows.length * this.offs.length;
    this.pos = new Float32Array(n * 3);
    this.nrm = new Float32Array(n * 3);
    this.edge = new Float32Array(n);
    this.ice = new Float32Array(n);
    this.kick = new Float32Array(n * 4);
    this.snow = new Float32Array(n * 2);
    this.rock = new Float32Array(n * 4);
    this.paint = new Float32Array(n * 4);
  }

  get done(): boolean {
    return this.row >= this.zRows.length;
  }

  /** Build rows until `deadline` (performance.now() ms) or completion. */
  step(deadline: number): void {
    const c = this.course;
    const cols = this.offs.length;
    const e = 0.25;
    while (this.row < this.zRows.length) {
      const z = this.zRows[this.row];
      const cx = c.centerX(z);
      const hw = c.halfWidth(z);
      // What shapes this row (read now: the shape is a reused object).
      const sh = c.shapeAt(z);
      const wall = sh.wall;
      const ridge = sh.ridge;
      const fall = sh.fall;
      const limit = sh.limit;
      const wk = wallK(wall);
      const crestH = wk > 0 ? wk * (wall + 16) : 0;
      const lakeK = smoothK(0.3, 0.7, sh.ice);
      const by = c.baseY(z);
      const sec = c.section(z);
      const body = sec.z0 + sec.blend;
      const canopy = sec.kind === 'treerun' ? smoothK(sec.z0 + sec.blend * 0.3, body, z) * (1 - smoothK(sec.z1 - 24, sec.z1, z)) : 0;
      // A ledge's face has its strata laid across the run.
      const led = ledgeAt(c, z, 1);
      const lipY = led ? c.baseY(led.z) : 0;
      let groom = 0;
      for (const l of sec.ledges) {
        if (l.kind === 'leap' && z > l.foot) groom = smoothK(l.foot, l.land0, z) * (1 - smoothK(l.land1 - 24, l.land1, z));
      }
      const alt = ridge >= 1.6 ? c.altX(z) : null;
      const stripK = alt === null ? 0 : smoothK(1.6, 2.4, ridge);
      // Between two mid-ground rows a ledge steps in, the outer columns take the rows' straight line.
      const hand = handoverRow(c, z);
      const za = Math.floor(z / MID_ROW) * MID_ROW;
      const zb = za + MID_ROW;
      const cxA = hand ? c.centerX(za) : 0;
      const cxB = hand ? c.centerX(zb) : 0;
      // Only rows near an ice patch need the per-vertex surface test.
      let iceRow = false;
      const ci = Math.floor(z / CHUNK_LEN);
      for (let k = ci - 1; k <= ci && !iceRow; k++) {
        if (k < 0) continue;
        for (const p of c.zones(k).ice) if (Math.abs(z - p.z) < p.rz) iceRow = true;
      }
      // The kickers whose footprint this row crosses.
      const ramps = this.ramps;
      ramps.length = 0;
      for (let k = ci - 2; k <= ci; k++) {
        if (k < 0) continue;
        for (const r of c.zones(k).ramps) if (z > r.z - 0.6 && z < r.z + r.len + 3) ramps.push(r);
      }
      // How fully the land past the lip falls away on each side of this row (an overlook).
      const wl = this.ov ? this.ov.fall(z, -1) : 0;
      const wr = this.ov ? this.ov.fall(z, 1) : 0;
      let p = this.row * cols;
      for (let col = 0; col < cols; col++) {
        const x = cx + this.offs[col];
        const ed = Math.abs(this.offs[col]) - hw;
        const off = this.offs[col];
        const side = off < 0 ? -1 : 1;
        const y0 = c.ground(x, z);
        let y = y0;
        const yx = c.ground(x + e, z);
        const yz = c.ground(x, z + e);
        const sx = (yx - y0) / e;
        const sz = (yz - y0) / e;
        let gx = sx;
        let gz = sz;
        this.snow[p * 2] = off;
        if (ed > DRIFT_FROM) {
          // Past the treeline: the drifts lift the snow, and their slope bends the normal too.
          let lift = snowDrift(x, z, ed, this.drift)[0];
          this.snow[p * 2 + 1] = this.drift[1];
          let lx = snowDrift(x + e, z, c.edgeExcess(x + e, z), this.drift)[0];
          let lz = snowDrift(x, z + e, c.edgeExcess(x, z + e), this.drift)[0];
          const w = this.offs[col] < 0 ? wl : wr;
          if (w > 0 && ed > LIP_FROM - 1) {
            // An overlook: the cornice's crest, then the lip rolls over, and the drifts thin out down
            // its face (so the edge meets the mid-ground's fall cleanly).
            lift = overLip(lift, ed, w);
            lx = overLip(lx, c.edgeExcess(x + e, z), w);
            lz = overLip(lz, c.edgeExcess(x, z + e), w);
          }
          gx = (yx + lx - y - lift) / e;
          gz = (yz + lz - y - lift) / e;
          y += lift;
        } else {
          this.snow[p * 2 + 1] = 0;
        }
        if (hand && ed > HANDOVER_FROM) {
          const ya = c.ground(cxA + off, za);
          const yb = c.ground(cxB + off, zb);
          const w = smoothK(HANDOVER_FROM, HANDOVER_TO, ed);
          y += (ya + ((yb - ya) * (z - za)) / MID_ROW - y0) * w;
          gz += ((yb - ya) / MID_ROW - gz) * w;
        }
        if (wk > 0 && ed > limit) {
          // Past the limit a wall stands up into rock, its planes and crest the sim never rides.
          const r = rampart(z, ed, side, wk, limit);
          gx += (rampart(z, c.edgeExcess(x + e, z), side, wk, limit) - r) / e;
          gz += (rampart(z + e, c.edgeExcess(x, z + e), side, wk, limit) - r) / e;
          y += r;
        }
        this.pos[p * 3] = x;
        this.pos[p * 3 + 1] = y;
        this.pos[p * 3 + 2] = -z;
        const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
        this.nrm[p * 3] = -gx * inv;
        this.nrm[p * 3 + 1] = inv;
        this.nrm[p * 3 + 2] = gz * inv;
        this.edge[p] = ed;
        // (The lake is painted from its own weight, its shoreline softened in the shader.)
        this.ice[p] = iceRow && lakeK === 0 && c.surface(x, z).ice ? 1 : 0;
        const kq = p * 4;
        this.kick[kq] = 0;
        this.kick[kq + 1] = -1;
        this.kick[kq + 2] = 0;
        this.kick[kq + 3] = -10;
        for (const r of ramps) {
          const dx = Math.abs(x - r.x);
          if (dx > r.w * 0.5 + 1.6) continue;
          const t = Math.max(0, Math.min(1, (dx - r.w * 0.5) / 1.4));
          this.kick[kq] = 1 - t * t * (3 - 2 * t);
          this.kick[kq + 1] = (z - r.z) / r.len;
          this.kick[kq + 2] = x - r.x;
          this.kick[kq + 3] = z - r.z - r.len;
          break;
        }
        const rq = p * 4;
        this.rock[rq] = rockWeight(ridge, wall, fall, limit, ed, off, sx, sz, z, this.kick[kq] > 0);
        this.rock[rq + 1] = led ? y - lipY : y - by;
        this.rock[rq + 2] = led ? x : z;
        this.rock[rq + 3] = crestH;
        this.paint[rq] = lakeK;
        this.paint[rq + 1] = alt === null ? 0 : stripK * (1 - smoothK(2.3, 3.1, Math.abs(x - alt)));
        this.paint[rq + 2] = groom;
        this.paint[rq + 3] = canopy;
        p++;
      }
      this.row++;
      if (performance.now() > deadline) return;
    }
  }

  geometry(): BufferGeometry {
    const rows = this.zRows.length;
    const cols = this.offs.length;
    const idx = new Uint32Array((rows - 1) * (cols - 1) * 6);
    let q = 0;
    for (let r = 0; r < rows - 1; r++) {
      for (let col = 0; col < cols - 1; col++) {
        const a = r * cols + col;
        const b = a + 1;
        const e = a + cols;
        const f = e + 1;
        // Winding chosen so faces point up in three.js space (z is flipped).
        idx[q++] = a;
        idx[q++] = b;
        idx[q++] = e;
        idx[q++] = b;
        idx[q++] = f;
        idx[q++] = e;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new BufferAttribute(this.nrm, 3));
    geo.setAttribute('aEdge', new BufferAttribute(this.edge, 1));
    geo.setAttribute('aIce', new BufferAttribute(this.ice, 1));
    geo.setAttribute('aKick', new BufferAttribute(this.kick, 4));
    geo.setAttribute('aSnow', new BufferAttribute(this.snow, 2));
    geo.setAttribute('aRock', new BufferAttribute(this.rock, 4));
    geo.setAttribute('aPaint', new BufferAttribute(this.paint, 4));
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

export function buildTerrainGeometry(course: Course, index: number, d: TerrainDetail, ov: OverlookPlan | null = null): BufferGeometry {
  const job = new ChunkJob(course, index, d, ov);
  job.step(Infinity);
  return job.geometry();
}

export class Terrain {
  readonly root = new Object3D();
  readonly material: ShaderMaterial;
  private meshes = new Map<number, Mesh>();
  private job: ChunkJob | null = null;
  private fogCourse: Course | null = null;
  /** Main-thread milliseconds per frame allowed for streaming terrain. */
  budgetMs = 2.5;
  /** The course's overlooks (null: none). Chunks built for another plan are rebuilt. */
  overlooks: Overlooks | null = null;
  private plan: OverlookPlan | null = null;

  constructor(
    private course: Course,
    private detail: TerrainDetail,
    private shadows: boolean,
  ) {
    this.material = makeSnowMaterial();
    this.root.name = 'terrain';
  }

  setCourse(course: Course): void {
    if (course === this.course) return;
    this.course = course;
    this.clear();
  }

  setDetail(detail: TerrainDetail, shadows: boolean): void {
    this.detail = detail;
    this.shadows = shadows;
    this.clear();
  }

  clear(): void {
    for (const m of this.meshes.values()) {
      m.geometry.dispose();
      this.root.remove(m);
    }
    this.meshes.clear();
    this.job = null;
  }

  /** Fits the floor the low mist settles on (shared.uFogFloor) to the course's base height over the
   *  stretch ahead of chunk `from`, easing toward it as the window moves (a jump snaps). */
  private fitFogFloor(from: number): void {
    const z0 = Math.max(0, from + 1) * CHUNK_LEN;
    const z1 = z0 + 4 * CHUNK_LEN;
    const y0 = this.course.baseY(z0);
    const k = (this.course.baseY(z1) - y0) / (z1 - z0);
    // Three.js z is the sim's z negated: y = y0 + k * (simZ - z0) = (y0 - k * z0) - k * z.
    const a = y0 - k * z0;
    const f = shared.uFogFloor.value;
    if (Math.abs(f.x - a) > 25 || this.fogCourse !== this.course) f.set(a, -k);
    else f.set(f.x + (a - f.x) * 0.04, f.y + (-k - f.y) * 0.04);
    this.fogCourse = this.course;
  }

  /** Keep chunks [from, to] built, streaming at most budgetMs of work per call. */
  update(from: number, to: number): void {
    this.syncPlan();
    this.fitFogFloor(from);
    for (const [i, m] of this.meshes) {
      if (i < from - 1 || i > to + 1) {
        m.geometry.dispose();
        this.root.remove(m);
        this.meshes.delete(i);
      }
    }
    if (this.job && (this.job.index < from - 1 || this.job.index > to + 1 || this.job.course !== this.course)) this.job = null;
    const deadline = performance.now() + this.budgetMs;
    while (performance.now() < deadline) {
      if (!this.job) {
        let next = -1;
        // Nearest missing chunk first, so the one you are about to ride is always ready.
        for (let i = Math.max(-2, from); i <= to; i++) {
          if (!this.meshes.has(i)) {
            next = i;
            break;
          }
        }
        if (next < 0) return;
        this.job = new ChunkJob(this.course, next, this.detail, this.plan);
      }
      this.job.step(deadline);
      if (this.job.done) {
        this.add(this.job.index, this.job.geometry());
        this.job = null;
      }
    }
  }

  /** Build everything in range immediately (run start). */
  prime(from: number, to: number): void {
    this.syncPlan();
    for (let i = Math.max(-2, from); i <= to; i++) {
      if (this.meshes.has(i)) continue;
      if (this.job?.index === i) this.job = null;
      this.add(i, buildTerrainGeometry(this.course, i, this.detail, this.plan));
    }
  }

  /** The overlooks' plan in force (none on a tier without them); a new one rebuilds every chunk. */
  private syncPlan(): void {
    const ov = this.overlooks;
    const plan = ov && ov.open && ov.plan.course === this.course ? ov.plan : null;
    if (plan === this.plan) return;
    this.plan = plan;
    this.clear();
  }

  private add(i: number, geo: BufferGeometry): void {
    const mesh = new Mesh(geo, this.material);
    mesh.receiveShadow = this.shadows;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.root.add(mesh);
    this.meshes.set(i, mesh);
  }
}
