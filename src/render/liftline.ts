import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DynamicDrawUsage, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { Course } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { SNOW, merge, part, softPart } from './flora';

// A lift line that crosses the run: the shape the piece and its chairs share. It leaves a station beside
// the run, crosses overhead at one height, reaches a tower on the far bank and climbs away from the run
// over two more to its end wheel. The chairs are one instanced batch over the lines in view (Medium and
// High, +1 draw, no shadow), written each frame: a few dozen matrices. A chair hangs CHAIR_DROP under
// its cable, and SitePlan.spanNeed lifts the cable so a chair clears the highest air like any span.

/** How far under its cable a chair's lowest point hangs. */
export const CHAIR_DROP = 5.2;
/** The two cables stand this far either side of the line. */
export const LINE_Z = 2.6;
/** Metres a second, and metres between chairs. */
const SPEED = 3.4;
const SPACE = 13;
/** Chairs drawn at once: two lines' worth. */
const CAP = 72;

export interface LiftLayout {
  /** The cable's height over the corridor (local y). */
  C: number;
  /** The tower on the far bank, the two beyond it and the station's wheel: local x and height. */
  nodes: ReadonlyArray<readonly [number, number]>;
}

/** The line of a lift whose span clears `clear` over the site's floor, its station on `side`. */
export function liftLayout(post: number, clear: number, side: number, gy: (x: number, z: number) => number): LiftLayout {
  const X = post + 2.9;
  const C = clear + CHAIR_DROP + 0.8;
  const a = -side * X;
  const b = -side * (X + 46);
  const c = -side * (X + 92);
  const yb = Math.max(C, gy(b, 0) + 14);
  const yc = Math.max(yb - 18, gy(c, 0) + 9);
  return { C, nodes: [[side * (X + 8), C], [a, C], [b, yb], [c, yc]] };
}

/** A figure in a chair, seated facing +z on the seat at y. */
function rider(x: number, y: number, coat: Color, hat: Color): BufferGeometry[] {
  return [
    part(new BoxGeometry(0.42, 0.62, 0.32), coat, { pos: [x, y + 0.32, -0.08] }),
    part(new BoxGeometry(0.17, 0.16, 0.56), new Color('#3A3550'), { pos: [x - 0.11, y + 0.02, 0.24] }),
    part(new BoxGeometry(0.17, 0.16, 0.56), new Color('#3A3550'), { pos: [x + 0.11, y + 0.02, 0.24] }),
    part(new BoxGeometry(0.15, 0.5, 0.15), new Color('#3A3550'), { pos: [x - 0.11, y - 0.26, 0.48] }),
    part(new BoxGeometry(0.15, 0.5, 0.15), new Color('#3A3550'), { pos: [x + 0.11, y - 0.26, 0.48] }),
    softPart(new SphereGeometry(0.2, 7, 5), new Color('#F2C9A8'), { pos: [x, y + 0.82, -0.05] }),
    softPart(new SphereGeometry(0.215, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.55), hat, { pos: [x, y + 0.86, -0.05] }),
  ];
}

/** One carrier, hanging from the origin (the cable), its foot about CHAIR_DROP below: an open double
 *  chair on Pinecrest, a red gondola on Frostfang, an ore skip on Ember, a lacquered cabin on Sakura. */
function carrier(biome: BiomeId): BufferGeometry {
  const steel = new Color('#3A3D52');
  const parts: BufferGeometry[] = [
    part(new CylinderGeometry(0.34, 0.34, 0.2, 8), steel, { pos: [0, 0.05, 0], rot: [0, 0, Math.PI / 2] }),
    part(new BoxGeometry(0.09, 0.09, 0.09).scale(1, 28, 1), steel, { pos: [0, -1.3, 0] }),
  ];
  if (biome === 'alpine') {
    const seat = new Color('#3F6A6E');
    parts.push(part(new BoxGeometry(0.09, 0.09, 0.09).scale(1, 24, 1), steel, { pos: [0, -3.75, -0.3] }));
    parts.push(part(new BoxGeometry(1.5, 0.12, 0.62), seat, { pos: [0, -4.15, 0.02] }));
    parts.push(part(new BoxGeometry(1.5, 0.7, 0.1), seat, { pos: [0, -3.8, -0.3] }));
    parts.push(part(new BoxGeometry(1.5, 0.05, 0.05), steel, { pos: [0, -3.5, 0.56] }));
    parts.push(...rider(-0.38, -4.05, new Color('#3E5A9A'), new Color('#F2EBDD')), ...rider(0.38, -4.05, new Color('#6A4C86'), new Color('#9CC0EE')));
  } else if (biome === 'volcanic') {
    const iron = new Color('#4A3E44');
    const skip = new CylinderGeometry(1.0, 0.72, 1.3, 7);
    parts.push(part(new BoxGeometry(0.09, 0.09, 0.09).scale(1, 28, 1), steel, { pos: [0, -3.6, 0] }));
    parts.push(part(skip, iron, { pos: [0, -4.5, 0], scale: [1, 1, 0.8] }));
    parts.push(part(new CylinderGeometry(0.96, 0.96, 0.1, 7), new Color('#2A2230'), { pos: [0, -3.86, 0], scale: [1, 1, 0.8] }));
  } else {
    const blossom = biome === 'blossom';
    const shell = blossom ? new Color('#EDE4D8') : new Color('#B5523E');
    const trim = blossom ? new Color('#93405A') : new Color('#EEF4FA');
    parts.push(part(new BoxGeometry(0.09, 0.09, 0.09).scale(1, 12, 1), steel, { pos: [0, -2.9, 0] }));
    parts.push(part(new BoxGeometry(1.7, 1.5, 1.5), shell, { pos: [0, -4.05, 0] }));
    parts.push(part(new BoxGeometry(1.74, 0.5, 1.54), new Color('#2A2D48'), { pos: [0, -3.85, 0] }));
    parts.push(part(new BoxGeometry(1.76, 0.12, 1.56), trim, { pos: [0, -4.45, 0] }));
    const roof = new ConeGeometry(1.4, 0.5, 4);
    parts.push(part(roof, trim, { pos: [0, -3.03, 0], rot: [0, Math.PI / 4, 0] }));
    parts.push(softPart(new SphereGeometry(0.9, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), SNOW, { pos: [0, -2.92, 0], scale: [1, 0.3, 1] }));
  }
  return merge(parts);
}

interface Line {
  /** The loop's corners (world), the metres to each and its length. */
  pts: Vector3[];
  at: number[];
  total: number;
}

/** The chairs on the lift lines in view. */
export class Chairs {
  readonly mesh: InstancedMesh;
  private lines: Line[] = [];
  private biome: BiomeId;
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3(1, 1, 1);
  private up = new Vector3(0, 1, 0);

  constructor(material: ShaderMaterial, biome: BiomeId) {
    this.biome = biome;
    this.mesh = new InstancedMesh(carrier(biome), material, CAP);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
  }

  setBiome(biome: BiomeId): void {
    if (biome === this.biome) return;
    this.biome = biome;
    this.mesh.geometry.dispose();
    this.mesh.geometry = carrier(biome);
  }

  clear(): void {
    this.lines.length = 0;
  }

  /** A lift site's line joins the batch (its loop up one cable and back down the other). */
  add(c: Course, s: { x: number; y: number; z: number; yaw: number; post: number; clear: number; side: number }): void {
    const cy = Math.cos(s.yaw);
    const sy = Math.sin(s.yaw);
    const gy = (lx: number, lz: number) => c.ground(s.x + lx * cy + lz * sy, s.z + lx * sy - lz * cy) - s.y;
    const { nodes } = liftLayout(s.post, s.clear, s.side, gy);
    const world = (lx: number, ly: number, lz: number) => new Vector3(s.x + lx * cy + lz * sy, s.y + ly, -s.z - lx * sy + lz * cy);
    const pts = [...nodes.map(([x, y]) => world(x, y, LINE_Z)), ...nodes.slice().reverse().map(([x, y]) => world(x, y, -LINE_Z))];
    pts.push(pts[0].clone());
    const at = [0];
    for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.lines.push({ pts, at, total: at[at.length - 1] });
  }

  update(time: number): void {
    let n = 0;
    for (const l of this.lines) {
      const count = Math.min(Math.floor(l.total / SPACE), CAP - n);
      const gap = l.total / Math.max(1, count);
      for (let k = 0; k < count; k++) {
        const d = (time * SPEED + k * gap) % l.total;
        let i = 1;
        while (i < l.at.length - 1 && l.at[i] < d) i++;
        const a = l.pts[i - 1];
        const b = l.pts[i];
        const t = (d - l.at[i - 1]) / (l.at[i] - l.at[i - 1] || 1);
        this.v.lerpVectors(a, b, t);
        this.q.setFromAxisAngle(this.up, Math.atan2(b.x - a.x, b.z - a.z));
        this.m.compose(this.v, this.q, this.s);
        this.mesh.setMatrixAt(n++, this.m);
      }
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
