import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, InstancedMesh, Matrix4, Mesh, Object3D, PerspectiveCamera, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { Snap } from '../game/run';
import type { Course } from '../sim/course';
import { CREST_TOP, CREST_U, FLOOR, LIP, WALL, drawnGround, trackAt } from '../sim/oldrun';
import type { Sim } from '../sim/sim';
import { SNOW, merge, part } from './flora';
import { box, quad, seg } from './landmarkKit';
import { withChamfer } from './chamfer';
import { makeToonMaterial, shared } from './materials';
import { pushLocalLight } from './lights';
import { HOTEL, START_HOUSE, TIMING, isOldRun } from './oldrunplan';
import type { Detail } from './postfx/tiers';
import type { ViewMode } from './world';

// The Old Run's own world (round 9, notes/r9-oldrun-world.md), loaded with its course (world.ts imports this file on
// demand: nothing of it is in the first download). What makes the place its own and none of the five's grammar:
//  - the grand hotel at its head, three blocks stepping down the slope beside the start house's straight, many
//    windows, slate mansards, two towers, its facade to the low sun; and the start house, a timber shed over the
//    track's first metres that the rider leaves from under;
//  - the track's parapet: a low timber rail along the crest of snow past each lip, and iron lamps on it the length of
//    the run, their glass lit as the day goes and their light pooled amber on the ice at dusk and by Lamplight;
//  - the timing house at the outrun, its clock on its gable toward the track, and the line painted across the ice;
//  - the lake and its town far below, down the valley (the lake's own mesh past the run's end).
// Everything is a few instanced or merged draws (Low: fewer posts, one rail, the lamps' glass in the posts' draw).

type V3 = [number, number, number];

const IRON = new Color('#26242E');
const IRON_LIT = new Color('#3A3644');
const RAIL = new Color('#6A5048');
const POST = new Color('#4C3A36');
const RENDER_C = new Color('#EADCC6');
const RENDER_SHADE = new Color('#D8C6AE');
const PLINTH = new Color('#8C8290');
const SLATE = new Color('#3E3C54');
const TRIM = new Color('#2F5446');
const GLASS = new Color('#2A2D48');
const TIMBER_C = new Color('#5E4640');
const TIMBER_D = new Color('#3E2E2C');
const CREAM = new Color('#EEE4D0');
/** The lamps' and the windows' light: warm, under the lantern's marigold (it is lamplight, not a thing to take). */
const LAMP_HEX = new Color('#FFC27A');
const LAMP_LIN = new Color('#FFC27A').convertSRGBToLinear();

/** Metres between the parapet's posts (Low: twice that), and between its lamps down each side. */
const POST_GAP = 4.4;
const LAMP_GAP = 46;
/** The crest's top, square to the channel from its middle: where the parapet stands. */
const CREST_D = FLOOR + CREST_U * WALL + CREST_TOP * 0.55;

const m4 = new Matrix4();
const q4 = new Quaternion();
const v3 = new Vector3();
const s3 = new Vector3();
const up = new Vector3(0, 1, 0);


/** The crest's top on `side` at sim z: sim x, the drawn ground there, and the channel's slope (dx/dz). */
function crestAt(c: Course, side: number, z: number, d = CREST_D): { x: number; y: number; p: number } {
  const t = trackAt(c, z);
  const x = t.cx + side * d * Math.sqrt(1 + t.p * t.p);
  return { x, y: drawnGround(c, x, z), p: t.p };
}

/** Moves parts (built about the origin, +z up the run) to sim (x, y, z) turned by yaw: into three.js space. */
function placed(parts: BufferGeometry[], x: number, y: number, z: number, yaw: number): BufferGeometry[] {
  const m = new Matrix4().compose(new Vector3(x, y, -z), new Quaternion().setFromAxisAngle(up, yaw), new Vector3(1, 1, 1));
  for (const g of parts) g.applyMatrix4(m);
  return parts;
}

/** A steep hipped (mansard-like) roof of `w` by `d` over y0, `h` tall, with snow on its upper slope. */
function mansard(w: number, d: number, y0: number, h: number, pos: V3): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  // The steep lower slope, then a low cap: a mansard's two pitches.
  const low = new CylinderGeometry(Math.SQRT1_2 * 0.82, Math.SQRT1_2, h * 0.72, 4, 1);
  out.push(part(low, SLATE, { pos: [pos[0], y0 + h * 0.36, pos[2]], rot: [0, Math.PI / 4, 0], scale: [w, 1, d] }));
  const cap = new ConeGeometry(Math.SQRT1_2 * 0.82, h * 0.34, 4, 1);
  out.push(part(cap, SNOW, { pos: [pos[0], y0 + h * 0.72 + h * 0.17, pos[2]], rot: [0, Math.PI / 4, 0], scale: [w, 1, d] }));
  return out;
}

export class OldRunWorld {
  readonly root = new Object3D();
  private course: Course | null = null;
  private detail: Detail = 'high';
  private readonly mat: ShaderMaterial;
  private readonly glow: ShaderMaterial;
  private readonly owned: Array<{ dispose(): void }> = [];
  /** The lamps down the run: sim x, y of the glass, sim z. */
  private lamps: Float32Array = new Float32Array(0);
  private lampN = 0;
  /** The hotel's windows and the timing house's, lit as the day goes (world y, for their lights' pools). */
  private litZ: number[] = [];

  constructor() {
    this.root.name = 'oldrun-world';
    this.mat = makeToonMaterial({ coolShade: 0.5, stone: true });
    this.glow = makeToonMaterial({ coolShade: 0.4, emissive: LAMP_HEX.clone(), emissiveStrength: 0 });
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

  reset(): void {
    // (Nothing of a run is kept yet: the set pieces' props join here when the sim lands them.)
  }

  private dispose(): void {
    for (const o of [...this.root.children]) this.root.remove(o);
    for (const o of this.owned) o.dispose();
    this.owned.length = 0;
    this.lamps = new Float32Array(0);
    this.lampN = 0;
    this.litZ = [];
  }

  private keep<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  private add(g: BufferGeometry, glow = false): Mesh {
    const m = new Mesh(this.keep(g), glow ? this.glow : this.mat);
    m.castShadow = !glow;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    this.root.add(m);
    return m;
  }

  private build(c: Course): void {
    this.dispose();
    if (!isOldRun(c)) return;
    const low = this.detail === 'low';
    withChamfer(low ? 'low' : 'full', () => {
      this.parapet(c, low);
      this.lampsDown(c, low);
      this.startHouse(c, low);
      this.hotel(c, low);
      this.timingHouse(c, low);
      this.finishLine(c);
    });
  }

  // ------------------------------------------------------------------ the parapet

  /** A low timber rail along the crest of snow past each lip, the whole run: posts every POST_GAP metres (Low: twice
   *  that) and two rails between them (Low: one), instanced, two draws. It is the run's strobe at speed where the five
   *  have stakes and flags (speedposts.ts stands none here). */
  private parapet(c: Course, low: boolean): void {
    const gap = POST_GAP * (low ? 2 : 1);
    const z0 = START_HOUSE.z1 + 2;
    const z1 = c.finishZ + c.runOut - 4;
    const n = Math.ceil((z1 - z0) / gap) + 1;
    const postG = part(new CylinderGeometry(0.07, 0.085, 1.15, low ? 4 : 5, 1), POST, { pos: [0, 0.5, 0] });
    // (A rail is a unit rod along its own +z at the rail's height: turned onto the line from one post to the next and
    // stretched to it.)
    const railParts = [part(new CylinderGeometry(0.045, 0.045, 1, 4, 1), RAIL, { pos: [0, 0.92, 0.5], rot: [Math.PI / 2, 0, 0] })];
    if (!low) railParts.push(part(new CylinderGeometry(0.035, 0.035, 1, 4, 1), RAIL, { pos: [0, 0.52, 0.5], rot: [Math.PI / 2, 0, 0] }));
    const railG = merge(railParts);
    const posts = new InstancedMesh(this.keep(postG), this.mat, n * 2);
    const rails = new InstancedMesh(this.keep(railG), this.mat, n * 2);
    let k = 0;
    let r = 0;
    for (const side of [-1, 1]) {
      let prev: Vector3 | null = null;
      for (let i = 0; i < n; i++) {
        const z = Math.min(z1, z0 + i * gap);
        const a = crestAt(c, side, z);
        // (The hotel's terrace stands on its own balustrade, and the timing house's yard is open.)
        if (side === HOTEL.side && z > HOTEL.from - 6 && z < HOTEL.to + 4) {
          prev = null;
          continue;
        }
        v3.set(a.x, a.y - 0.05, -z);
        m4.compose(v3, q4.identity(), s3.set(1, 1, 1));
        posts.setMatrixAt(k++, m4);
        if (prev) {
          // From the last post to this one: along the rod's local +z, which the rotation above made its length.
          const d = v3.clone().sub(prev);
          const len = d.length();
          q4.setFromUnitVectors(new Vector3(0, 0, 1), d.clone().normalize());
          m4.compose(prev, q4, s3.set(1, 1, len));
          rails.setMatrixAt(r++, m4);
        }
        prev = v3.clone();
      }
    }
    posts.count = k;
    rails.count = r;
    for (const im of [posts, rails]) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.root.add(im);
    }
  }

  // ------------------------------------------------------------------ the iron lamps

  /** Iron lamp standards on the crest, every LAMP_GAP metres down each side, staggered so one stands every half of it
   *  down the run: a fluted post on a plinth, a scrolled arm out toward the track and a lantern on it. The lanterns'
   *  glass is lit as the day goes (shared.uLampK) and the nearest light the ice (update). */
  private lampsDown(c: Course, low: boolean): void {
    const z0 = START_HOUSE.z1 + 8;
    const z1 = c.finishZ + c.runOut - 10;
    const spots: Array<[number, number, number, number]> = [];
    for (const side of [-1, 1]) {
      for (let z = z0 + (side > 0 ? LAMP_GAP / 2 : 0); z < z1; z += LAMP_GAP) {
        if (side === HOTEL.side && z > HOTEL.from - 6 && z < HOTEL.to + 4) continue;
        const a = crestAt(c, side, z, CREST_D - 0.35);
        spots.push([a.x, a.y, z, side]);
      }
    }
    // The standard: plinth, post, collar, arm, and the lantern's cage and cap (iron); its glass apart (glow).
    const iron: BufferGeometry[] = [
      part(new CylinderGeometry(0.2, 0.26, 0.5, 6, 1), IRON, { pos: [0, 0.2, 0] }),
      part(new CylinderGeometry(0.065, 0.09, 3.6, low ? 5 : 8, 1), IRON, { pos: [0, 2.2, 0] }),
      part(new CylinderGeometry(0.11, 0.11, 0.14, 6, 1), IRON_LIT, { pos: [0, 1.1, 0] }),
      part(new CylinderGeometry(0.1, 0.1, 0.1, 6, 1), IRON_LIT, { pos: [0, 3.9, 0] }),
      seg([0, 3.85, 0], [0, 4.15, 0.55], 0.035, IRON),
      seg([0, 4.15, 0.55], [0, 4.1, 0.95], 0.035, IRON),
      part(new ConeGeometry(0.3, 0.32, 4, 1), IRON, { pos: [0, 4.12, 0.95], rot: [0, Math.PI / 4, 0] }),
      part(new SphereGeometry(0.05, 5, 4), IRON_LIT, { pos: [0, 4.32, 0.95] }),
      part(new CylinderGeometry(0.17, 0.12, 0.06, 4, 1), IRON, { pos: [0, 3.42, 0.95], rot: [0, Math.PI / 4, 0] }),
    ];
    const glass = part(new CylinderGeometry(0.22, 0.15, 0.5, 4, 1), GLASS, { pos: [0, 3.7, 0.95], rot: [0, Math.PI / 4, 0] });
    const ironG = merge(iron);
    const posts = new InstancedMesh(this.keep(ironG), this.mat, spots.length);
    const glows = new InstancedMesh(this.keep(glass), this.glow, spots.length);
    this.lamps = new Float32Array(spots.length * 3);
    spots.forEach(([x, y, z, side], i) => {
      // (Each faces across the track, its arm out over the wall.)
      const t = trackAt(c, z);
      const yaw = side > 0 ? Math.atan2(-1, -t.p) : Math.atan2(1, t.p);
      q4.setFromAxisAngle(up, yaw);
      m4.compose(v3.set(x, y - 0.1, -z), q4, s3.set(1, 1, 1));
      posts.setMatrixAt(i, m4);
      glows.setMatrixAt(i, m4);
      // Where the glass hangs: the arm's end, turned the same way.
      const ax = Math.sin(yaw) * 0.95;
      const az = Math.cos(yaw) * 0.95;
      this.lamps[i * 3] = x + ax;
      this.lamps[i * 3 + 1] = y + 3.6;
      this.lamps[i * 3 + 2] = z - az;
    });
    this.lampN = spots.length;
    posts.castShadow = true;
    posts.receiveShadow = true;
    glows.castShadow = false;
    for (const im of [posts, glows]) {
      im.computeBoundingSphere();
      this.root.add(im);
    }
  }

  // ------------------------------------------------------------------ the start house

  /** The start house: a timber shed over the track's first metres, its posts on both crests, a steep shingled roof
   *  and boarded gables, a bell turret on its ridge and the starter's box on the hotel's side. The rider leaves from
   *  under it, and the lens's first frames look out of its dark mouth down the bright straight. */
  private startHouse(c: Course, low: boolean): void {
    const zc = (START_HOUSE.z0 + START_HOUSE.z1) / 2;
    const len = START_HOUSE.z1 - START_HOUSE.z0;
    const t = trackAt(c, zc);
    const by = c.baseY(zc);
    const half = CREST_D + 0.6;
    const eave = 6.2;
    const parts: BufferGeometry[] = [];
    // Posts on the crests either side, front, middle and back, and the beams over them.
    for (const side of [-1, 1]) {
      for (const dz of [-len / 2, 0, len / 2]) {
        const x = side * half;
        const g = drawnGround(c, t.cx + x, zc + dz) - by;
        parts.push(box(0.34, eave - g + 0.4, 0.34, TIMBER_C, [x, (g + eave) / 2 - 0.2, -dz]));
        // A knee brace from the post to the beam.
        parts.push(seg([x, eave - 1.6, -dz], [x - side * 1.4, eave - 0.1, -dz], 0.09, TIMBER_D));
      }
      parts.push(box(0.36, 0.42, len + 0.8, TIMBER_D, [side * half, eave, 0]));
      // Boarding along the side's lower half, so the house is a house and not a shelter.
      parts.push(box(0.12, 1.4, len, TIMBER_C, [side * (half + 0.12), eave - 3.2, 0]));
    }
    // Tie beams across, front and back.
    for (const dz of [-len / 2, len / 2]) parts.push(box(half * 2 + 0.6, 0.4, 0.36, TIMBER_D, [0, eave + 0.1, -dz]));
    // The roof: two steep planes of shingles, snow along their upper halves, the ridge running down the track.
    const rh = 5.2;
    const run = half + 1.2;
    const slope = Math.atan2(rh, run);
    const plane = Math.hypot(rh, run);
    for (const side of [-1, 1]) {
      parts.push(box(plane, 0.28, len + 2.2, SLATE, [side * run * 0.5, eave + 0.3 + rh * 0.5, 0], [0, 0, -side * slope]));
      parts.push(box(plane * 0.55, 0.18, len + 2.1, SNOW, [side * run * 0.27, eave + 0.55 + rh * 0.73, 0], [0, 0, -side * slope]));
    }
    // The gables, boarded, down-run end open below its tie beam: a triangle of boards over each end.
    for (const dz of [-len / 2 - 0.1, len / 2 + 0.1]) {
      const gy = eave + 0.3;
      parts.push(quad([-run + 0.4, gy, -dz], [run - 0.4, gy, -dz], [0, gy + rh - 0.3, -dz], [0, gy + rh - 0.3, -dz], CREAM));
      parts.push(quad([run - 0.4, gy, -dz], [-run + 0.4, gy, -dz], [0, gy + rh - 0.3, -dz], [0, gy + rh - 0.3, -dz], CREAM));
    }
    // The bell turret on the ridge: four posts, a little pyramid roof, the bell (bronze, not lit).
    const ty = eave + rh + 0.2;
    for (const [a, b] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) parts.push(box(0.12, 1.5, 0.12, TIMBER_D, [a, ty + 0.75, b]));
    parts.push(part(new ConeGeometry(1.05, 1.2, 4, 1), SLATE, { pos: [0, ty + 2.1, 0], rot: [0, Math.PI / 4, 0] }));
    parts.push(part(new CylinderGeometry(0.2, 0.32, 0.5, 8, 1, true), new Color('#8A6A3E'), { pos: [0, ty + 0.95, 0] }));
    // The starter's box on the hotel's side: a small boarded cabin with a window toward the track.
    const sx = HOTEL.side * (half + 2.2);
    const sg = drawnGround(c, t.cx + sx, zc + 2) - by;
    parts.push(box(2.4, 2.6, 2.6, TIMBER_C, [sx, sg + 1.3, -2]));
    parts.push(part(new ConeGeometry(2.1, 1.2, 4, 1), SLATE, { pos: [sx, sg + 3.2, -2], rot: [0, Math.PI / 4, 0] }));
    const win = [box(0.08, 0.9, 1.4, GLASS, [sx - HOTEL.side * 1.22, sg + 1.6, -2])];
    if (!low) parts.push(box(0.1, 0.12, 1.6, CREAM, [sx - HOTEL.side * 1.24, sg + 1.12, -2]));
    this.add(merge(placed(parts, t.cx, by, zc, -Math.atan(t.p))));
    this.add(merge(placed(win, t.cx, by, zc, -Math.atan(t.p))), true);
  }

  // ------------------------------------------------------------------ the grand hotel

  /** The grand hotel: three blocks stepping down the slope on the right of the start house's straight, each on a
   *  rusticated plinth, four storeys of cream render with tall windows in green-shuttered bays, iron balconies on its
   *  first floor and a slate mansard with dormers; a tower where the blocks meet, the lower one taller and spired
   *  with a flag, chimneys along the ridges. Its facade looks across the track toward the low sun. On a terrace with
   *  a balustrade over the crest. */
  private hotel(c: Course, low: boolean): void {
    const side = HOTEL.side;
    const blocks = 3;
    const blen = (HOTEL.to - HOTEL.from) / blocks;
    const parts: BufferGeometry[] = [];
    const glass: BufferGeometry[] = [];
    // The hotel's frame: x across (toward the track is -side), z down the run in sim metres from HOTEL.from.
    const zMid = (HOTEL.from + HOTEL.to) / 2;
    const t = trackAt(c, zMid);
    const edge = LIP * Math.sqrt(1 + t.p * t.p);
    const front = side * (edge + HOTEL.front);
    const back = front + side * HOTEL.deep;
    const xMid = (front + back) / 2;
    const ground = (dz: number, x: number) => drawnGround(c, t.cx + x, zMid + dz) - c.baseY(zMid);
    const storeys = 4;
    const sh = 3.5;
    for (let b = 0; b < blocks; b++) {
      const z0 = HOTEL.from + b * blen - zMid;
      const z1 = z0 + blen;
      const zc = (z0 + z1) / 2;
      // Its floor: the ground at its uphill front corner (the plinth takes up what the slope falls under it).
      const floor = Math.max(ground(z0, front), ground(z0, back)) + 0.3;
      const foot = Math.min(ground(z1, front), ground(z1, back)) - 1;
      const plinthH = 3.6;
      parts.push(box(HOTEL.deep + 0.6, floor + plinthH - foot, blen + 0.4, PLINTH, [xMid, (floor + plinthH + foot) / 2, -zc]));
      // A string course over the plinth, the render above, a cornice under the roof.
      const top = floor + plinthH + storeys * sh;
      parts.push(box(HOTEL.deep, storeys * sh, blen, b === 1 ? RENDER_SHADE : RENDER_C, [xMid, floor + plinthH + (storeys * sh) / 2, -zc]));
      parts.push(box(HOTEL.deep + 0.5, 0.35, blen + 0.5, CREAM, [xMid, floor + plinthH, -zc]));
      parts.push(box(HOTEL.deep + 0.9, 0.5, blen + 0.9, CREAM, [xMid, top + 0.2, -zc]));
      // The mansard, and its dormers on the track's side.
      const rh = 6.2;
      parts.push(...mansard(HOTEL.deep + 0.4, blen + 0.4, top + 0.4, rh, [xMid, 0, -zc]));
      const bays = Math.round(blen / 3.4);
      const bw = blen / bays;
      for (let i = 0; i < bays; i++) {
        const zz = z0 + bw * (i + 0.5);
        // The windows: storey by storey on the facade, tall and narrow, shutters either side (Medium and High).
        for (let s = 0; s < storeys; s++) {
          const y = floor + plinthH + s * sh + sh * 0.52;
          glass.push(box(0.12, sh * 0.56, bw * 0.42, GLASS, [front - side * 0.04, y, -zz]));
          if (!low) {
            parts.push(box(0.1, sh * 0.58, 0.22, TRIM, [front - side * 0.07, y, -(zz - bw * 0.33)]));
            parts.push(box(0.1, sh * 0.58, 0.22, TRIM, [front - side * 0.07, y, -(zz + bw * 0.33)]));
            parts.push(box(0.16, 0.14, bw * 0.5, CREAM, [front - side * 0.08, y + sh * 0.33, -zz]));
          }
          // And the back, plainer (seen from the title's lens and over the crest).
          if (!low && s < 3) glass.push(box(0.1, sh * 0.5, bw * 0.38, GLASS, [back + side * 0.04, y, -zz]));
        }
        // Plinth windows, arched in their stone (squat).
        glass.push(box(0.12, 1.5, bw * 0.38, GLASS, [front - side * 0.04, floor + 1.9, -zz]));
        // The dormers in the roof.
        if (i % 2 === 0 || !low) {
          const dx = front + side * 1.6;
          parts.push(box(1.1, 1.6, bw * 0.5, SLATE, [dx, top + 1.8, -zz]));
          parts.push(part(new ConeGeometry(bw * 0.4, 1.1, 4, 1), SNOW, { pos: [dx, top + 3.1, -zz], rot: [0, Math.PI / 4, 0], scale: [0.7, 1, 1] }));
          glass.push(box(0.12, 1, bw * 0.3, GLASS, [dx - side * 0.56, top + 1.75, -zz]));
        }
      }
      // The first floor's balcony: an iron rail along the whole facade on a slab.
      const by1 = floor + plinthH + sh * 0.02;
      parts.push(box(1.4, 0.22, blen - 1, CREAM, [front - side * 0.7, by1, -zc]));
      parts.push(box(0.06, 1, blen - 1, IRON, [front - side * 1.36, by1 + 0.6, -zc]));
      // Chimneys on the ridge.
      for (const k of [0.22, 0.78]) parts.push(box(0.9, 3.2, 1.4, PLINTH, [xMid + side * 2.5, top + rh + 0.6, -(z0 + blen * k)]));
    }
    // The towers where the blocks meet: square, a storey and a roof over the mansards; the lower one taller, spired,
    // flying a flag in the resort's green.
    for (let b = 1; b < blocks; b++) {
      const zc = HOTEL.from + b * blen - zMid;
      const floor = Math.max(ground(zc - 3, front), ground(zc - 3, back)) + 0.3;
      const tall = b === blocks - 1;
      const w = 7;
      const hgt = 3.6 + storeys * sh + (tall ? 11 : 7);
      const tx = front + side * (w / 2 - 0.6);
      parts.push(box(w, hgt, w, b === 1 ? RENDER_C : RENDER_SHADE, [tx, floor + hgt / 2, -zc]));
      parts.push(box(w + 0.6, 0.5, w + 0.6, CREAM, [tx, floor + hgt, -zc]));
      for (let s = 0; s < storeys + (tall ? 3 : 2); s++) {
        const y = floor + 3.6 + s * sh + sh * 0.5;
        if (y > floor + hgt - 1.6) break;
        glass.push(box(0.12, sh * 0.55, 1.4, GLASS, [tx - side * (w / 2 + 0.03), y, -zc]));
        if (!low) glass.push(box(1.4, sh * 0.55, 0.12, GLASS, [tx, y, -(zc - w / 2 - 0.03)]));
      }
      if (tall) {
        parts.push(part(new ConeGeometry(w * 0.74, 9, 4, 1), SLATE, { pos: [tx, floor + hgt + 4.7, -zc], rot: [0, Math.PI / 4, 0] }));
        parts.push(seg([tx, floor + hgt + 9, -zc], [tx, floor + hgt + 14.5, -zc], 0.07, IRON));
        parts.push(box(0.05, 1.2, 2, TRIM, [tx, floor + hgt + 13.6, -(zc - 1)]));
      } else {
        parts.push(...mansard(w + 0.4, w + 0.4, floor + hgt + 0.2, 5, [tx, 0, -zc]));
      }
    }
    // The terrace before it: a level of snow behind a stone balustrade over the crest, lamps at its corners.
    const tz0 = HOTEL.from - zMid - 4;
    const tz1 = HOTEL.to - zMid + 2;
    const bx = side * (edge + 3.2);
    const n = Math.round((tz1 - tz0) / 2.2);
    for (let i = 0; i <= n; i++) {
      const dz = tz0 + ((tz1 - tz0) * i) / n;
      const g = ground(dz, bx);
      parts.push(box(0.36, 1.05, 0.36, PLINTH, [bx, g + 0.5, -dz]));
      if (i < n) {
        const g2 = ground(dz + (tz1 - tz0) / n, bx);
        const len = Math.hypot((tz1 - tz0) / n, g2 - g);
        parts.push(box(0.5, 0.16, len, CREAM, [bx, (g + g2) / 2 + 1.05, -(dz + (tz1 - tz0) / n / 2)], [Math.atan2(g2 - g, (tz1 - tz0) / n), 0, 0]));
      }
    }
    this.add(merge(placed(parts, t.cx, c.baseY(zMid), zMid, 0)));
    this.add(merge(placed(glass, t.cx, c.baseY(zMid), zMid, 0)), true);
    this.litZ.push(zMid);
  }

  // ------------------------------------------------------------------ the timing house

  /** The timing house at the outrun: a two-storey timber house past the crest on the left, its gable toward the
   *  track coming down, a great clock face in it, the judges' balcony under it, its windows lit as the evening comes;
   *  a flagpole beside it. */
  private timingHouse(c: Course, low: boolean): void {
    const fz = c.finishZ;
    const zc = fz - 3;
    const side = TIMING.side;
    const t = trackAt(c, zc);
    const edge = LIP * Math.sqrt(1 + t.p * t.p);
    const x0 = side * (edge + TIMING.e + 4);
    const g0 = drawnGround(c, t.cx + x0, zc) - c.baseY(zc);
    const parts: BufferGeometry[] = [];
    const glass: BufferGeometry[] = [];
    const W = 7.5;
    const D = 9;
    const H = 6.4;
    parts.push(box(W + 0.4, 1.2, D + 0.4, PLINTH, [x0, g0 + 0.3, 0]));
    parts.push(box(W, H, D, TIMBER_C, [x0, g0 + 0.9 + H / 2, 0]));
    // Cream boards at the corners and a band between the storeys.
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(box(0.3, H, 0.3, CREAM, [x0 + (a * W) / 2, g0 + 0.9 + H / 2, (b * D) / 2]));
    parts.push(box(W + 0.2, 0.25, D + 0.2, CREAM, [x0, g0 + 0.9 + H * 0.5, 0]));
    // The roof, its gable up the run (+z) and down it.
    const rh = 4.2;
    for (const s of [-1, 1]) {
      const run = W / 2 + 0.7;
      const slope = Math.atan2(rh, run);
      parts.push(box(Math.hypot(rh, run), 0.24, D + 1.4, SLATE, [x0 + (s * run) / 2, g0 + 0.9 + H + rh / 2, 0], [0, 0, -s * slope]));
      parts.push(box(Math.hypot(rh, run) * 0.5, 0.16, D + 1.3, SNOW, [x0 + (s * run) / 4, g0 + 0.9 + H + rh * 0.74, 0], [0, 0, -s * slope]));
    }
    const gy = g0 + 0.9 + H;
    parts.push(quad([x0 - W / 2 - 0.2, gy, D / 2 + 0.05], [x0 + W / 2 + 0.2, gy, D / 2 + 0.05], [x0, gy + rh, D / 2 + 0.05], [x0, gy + rh, D / 2 + 0.05], CREAM));
    // The clock in the gable facing up the run: a white face in an iron ring, twelve marks and its two hands.
    const cy = gy + 1.25;
    const cz = D / 2 + 0.2;
    parts.push(part(new CylinderGeometry(1.15, 1.15, 0.12, 20, 1), IRON, { pos: [x0, cy, cz], rot: [Math.PI / 2, 0, 0] }));
    parts.push(part(new CylinderGeometry(1, 1, 0.1, 20, 1), new Color('#F4EEE0'), { pos: [x0, cy, cz + 0.05], rot: [Math.PI / 2, 0, 0] }));
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      parts.push(box(0.07, h % 3 === 0 ? 0.24 : 0.14, 0.04, IRON, [x0 + Math.sin(a) * 0.82, cy + Math.cos(a) * 0.82, cz + 0.11], [0, 0, -a]));
    }
    parts.push(box(0.06, 0.62, 0.04, IRON, [x0 + 0.21, cy + 0.2, cz + 0.13], [0, 0, -0.8]));
    parts.push(box(0.05, 0.86, 0.04, IRON, [x0 - 0.05, cy + 0.42, cz + 0.14], [0, 0, 0.12]));
    // The judges' balcony on the track's side, under the eaves, and its windows.
    const bxs = x0 - side * (W / 2 + 0.7);
    parts.push(box(1.4, 0.2, D - 1, CREAM, [bxs, g0 + 0.9 + H * 0.52, 0]));
    parts.push(box(0.06, 0.95, D - 1, IRON, [bxs - side * 0.66, g0 + 0.9 + H * 0.52 + 0.55, 0]));
    for (const zz of [-2.6, 0, 2.6]) {
      glass.push(box(0.12, 1.6, 1.3, GLASS, [x0 - side * (W / 2 + 0.03), g0 + 0.9 + H * 0.75, zz]));
      glass.push(box(0.12, 1.4, 1.1, GLASS, [x0 - side * (W / 2 + 0.03), g0 + 0.9 + H * 0.25, zz]));
    }
    glass.push(box(1.2, 1.4, 0.12, GLASS, [x0 - 1.8, g0 + 0.9 + H * 0.25, D / 2 + 0.03]));
    glass.push(box(1.2, 1.4, 0.12, GLASS, [x0 + 1.8, g0 + 0.9 + H * 0.25, D / 2 + 0.03]));
    // The flagpole, in iron, the resort's green flag.
    const fx = x0 + side * (W / 2 + 3);
    parts.push(seg([fx, g0, -D / 2], [fx, g0 + 15, -D / 2], 0.08, IRON));
    if (!low) parts.push(box(0.05, 1.3, 2.2, TRIM, [fx, g0 + 14.1, -D / 2 + 1.15]));
    this.add(merge(placed(parts, t.cx, c.baseY(zc), zc, -Math.atan(t.p))));
    this.add(merge(placed(glass, t.cx, c.baseY(zc), zc, -Math.atan(t.p))), true);
    this.litZ.push(zc);
  }

  /** The line across the ice at the finish: two rows of ink and cream checks over the whole channel, wall to wall. */
  private finishLine(c: Course): void {
    const z = c.finishZ;
    const t = trackAt(c, z);
    const q = Math.sqrt(1 + t.p * t.p);
    const sq = 0.62;
    const n = Math.floor((LIP * 2) / sq);
    const ink: BufferGeometry[] = [];
    const cream: BufferGeometry[] = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < n; i++) {
        const d0 = -LIP + i * sq;
        const d1 = d0 + sq;
        const za = z + row * sq;
        const zb = za + sq;
        const pt = (d: number, zz: number): V3 => {
          const tt = trackAt(c, zz);
          const x = tt.cx + d * q;
          return [x, c.ground(x, zz) + 0.035, -zz];
        };
        const g = quad(pt(d0, za), pt(d1, za), pt(d1, zb), pt(d0, zb), (i + row) % 2 ? CREAM : IRON);
        ((i + row) % 2 ? cream : ink).push(g);
      }
    }
    const m = this.add(merge([...ink, ...cream]));
    m.castShadow = false;
  }

  // ------------------------------------------------------------------ each frame

  update(_dt: number, _time: number, _mode: ViewMode, s: Snap, _sim: Sim | null, _camera: PerspectiveCamera): void {
    if (!this.course || this.lampN === 0) return;
    // The lamps' glass and the windows light as the day goes (the palette's lamps, by the journey): dark glass by
    // day, the lamp's light at dusk and by Lamplight.
    const lampK = shared.uLampK.value as number;
    const lit = Math.max(0, Math.min(1.6, (lampK - 0.35) / 0.8));
    this.glow.uniforms.uEmissiveStrength.value = lit * 1.6;
    if (lit <= 0.02) return;
    // The nearest lamps light the ice under them: from a little behind the rider to 110 m ahead.
    const z = s.z;
    for (let i = 0; i < this.lampN; i++) {
      const lz = this.lamps[i * 3 + 2];
      if (lz < z - 25 || lz > z + 110) continue;
      pushLocalLight(this.lamps[i * 3], this.lamps[i * 3 + 1], -lz, LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 13, 0.9 * Math.min(1, lit));
    }
  }
}
