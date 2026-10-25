import { BufferAttribute, BufferGeometry, Mesh, Object3D, ShaderMaterial } from 'three';
import { CHUNK_LEN, Course, Ramp } from '../sim/course';
import { makeSnowMaterial } from './materials';

// Terrain chunks that bend with the corridor: each row of vertices is laid out relative to the
// centreline at that z, so the playable lane gets dense vertices and the far forest floor is
// coarse. Heights come straight from the sim's ground function, so what you see is what you ride.
// Chunk builds are time-sliced across frames so streaming the course never hitches.

export interface TerrainDetail {
  /** Lateral vertex spacing inside the corridor, metres. */
  inner: number;
  /** Row spacing, metres. */
  row: number;
  /** How far past the corridor edge the mesh extends. */
  reach: number;
}

const OUTER_STEPS = [12, 16, 22, 30, 42, 58, 80, 110];

/** The same offsets for every chunk of a course, so neighbouring chunks share edge vertices
 *  exactly and no cracks open between them. */
function lateralOffsets(course: Course, d: TerrainDetail): number[] {
  const hw = course.params.halfWidthStart + 2.6;
  const inner = hw + 10;
  const n = Math.ceil((inner * 2) / d.inner);
  const out: number[] = [];
  for (const s of OUTER_STEPS) if (s > 10 && s <= d.reach) out.push(-(hw + s), hw + s);
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
  private ramps: Ramp[] = [];
  row = 0;

  constructor(
    readonly course: Course,
    readonly index: number,
    d: TerrainDetail,
  ) {
    this.zRows = rowPositions(course, index, d);
    this.offs = lateralOffsets(course, d);
    const n = this.zRows.length * this.offs.length;
    this.pos = new Float32Array(n * 3);
    this.nrm = new Float32Array(n * 3);
    this.edge = new Float32Array(n);
    this.ice = new Float32Array(n);
    this.kick = new Float32Array(n * 4);
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
      let p = this.row * cols;
      for (let col = 0; col < cols; col++) {
        const x = cx + this.offs[col];
        const y = c.ground(x, z);
        const gx = (c.ground(x + e, z) - y) / e;
        const gz = (c.ground(x, z + e) - y) / e;
        this.pos[p * 3] = x;
        this.pos[p * 3 + 1] = y;
        this.pos[p * 3 + 2] = -z;
        const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
        this.nrm[p * 3] = -gx * inv;
        this.nrm[p * 3 + 1] = inv;
        this.nrm[p * 3 + 2] = gz * inv;
        this.edge[p] = Math.abs(this.offs[col]) - hw;
        this.ice[p] = iceRow && c.surface(x, z).ice ? 1 : 0;
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
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

export function buildTerrainGeometry(course: Course, index: number, d: TerrainDetail): BufferGeometry {
  const job = new ChunkJob(course, index, d);
  job.step(Infinity);
  return job.geometry();
}

export class Terrain {
  readonly root = new Object3D();
  readonly material: ShaderMaterial;
  private meshes = new Map<number, Mesh>();
  private job: ChunkJob | null = null;
  /** Main-thread milliseconds per frame allowed for streaming terrain. */
  budgetMs = 2.5;

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

  /** Keep chunks [from, to] built, streaming at most budgetMs of work per call. */
  update(from: number, to: number): void {
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
        this.job = new ChunkJob(this.course, next, this.detail);
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
    for (let i = Math.max(-2, from); i <= to; i++) {
      if (this.meshes.has(i)) continue;
      if (this.job?.index === i) this.job = null;
      this.add(i, buildTerrainGeometry(this.course, i, this.detail));
    }
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
