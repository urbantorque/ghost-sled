import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, InstancedMesh, Matrix4, Mesh, Object3D, PerspectiveCamera, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { Snap } from '../game/run';
import type { Course } from '../sim/course';
import { CREST_TOP, CREST_U, FLOOR, LIP, WALL, placeOf, trackAt } from '../sim/oldrun';
import { crestGround as drawnGround } from './ground';
import type { Sim } from '../sim/sim';
import { SNOW, merge, part } from './flora';
import { box, quad, seg } from './landmarkKit';
import { withChamfer } from './chamfer';
import { makeToonMaterial, shared } from './materials';
import { LOW_BOLD, type StillFigure, crowdColors, stillCrowd } from './crowd';
import { getPalette } from './palette';
import { Mood } from '../sim/chaos';
import { pushLocalLight } from './lights';
import { HOTEL, START_HOUSE, TIMING, isOldRun } from './oldrunplan';
import { OldRunPieces } from './oldrunpieces';
import type { Particles } from './particles';
import type { Detail } from './postfx/tiers';
import type { Beat } from '../game/beats';
import { reduced } from '../ui/motion';
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
/** The light the lamps lay on the ice: a pale warm white. (Amber added to the moonlit lavender ice read as magenta;
 *  Lanternfall's silver pools are its own, tests/hours.test.ts.) */
const LAMP_LIN = new Color('#FFE4BC').convertSRGBToLinear();

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

  /** The three set pieces' props (oldrunpieces.ts): the bells, the split's board, the Horseshoe's lanterns. */
  private readonly pieces: OldRunPieces;

  constructor(particles: Particles | null = null) {
    this.root.name = 'oldrun-world';
    this.pieces = new OldRunPieces(particles);
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
    this.pieces.reset();
  }

  /** The set pieces' named moments this frame (a run's only). */
  beats(list: readonly Beat[], s: Snap): void {
    if (this.course && isOldRun(this.course)) this.pieces.beats(list, s);
  }

  private dispose(): void {
    for (const o of [...this.root.children]) this.root.remove(o);
    this.pieces.clear();
    for (const o of this.owned) o.dispose();
    this.owned.length = 0;
    this.lamps = new Float32Array(0);
    this.lampN = 0;
    this.litZ = [];
    this.windows = [];
    this.spill = [];
  }

  private keep<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  /** The places' meshes and the stretch of run each is seen from (sim z): drawn only from within reach of it. */
  private windows: Array<{ m: Mesh; z0: number; z1: number }> = [];
  /** Where the lit windows' light falls on the snow before them (sim x, y, z). */
  private spill: V3[] = [];

  private add(g: BufferGeometry, glow = false, z0 = -Infinity, z1 = Infinity): Mesh {
    const m = new Mesh(this.keep(g), glow ? this.glow : this.mat);
    if (z0 > -Infinity) this.windows.push({ m, z0, z1 });
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
      this.onlookers(c, low);
    });
    this.root.add(this.pieces.root);
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
    this.add(merge(placed(parts, t.cx, by, zc, -Math.atan(t.p))), false, START_HOUSE.z0, START_HOUSE.z1);
    this.add(merge(placed(win, t.cx, by, zc, -Math.atan(t.p))), true, START_HOUSE.z0, START_HOUSE.z1);
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
          const wh = sh * (s === 0 ? 0.64 : s === storeys - 1 ? 0.46 : 0.56);
          glass.push(box(0.12, wh, bw * 0.32, GLASS, [front - side * 0.06, y, -zz]));
          // Its surround in cream, a sill under it, and on the first floor a pediment over it; green shutters either side.
          parts.push(box(0.1, wh + 0.3, bw * 0.44, CREAM, [front - side * 0.03, y, -zz]));
          parts.push(box(0.26, 0.14, bw * 0.5, CREAM, [front - side * 0.1, y - wh / 2 - 0.12, -zz]));
          if (!low) {
            parts.push(box(0.1, wh, 0.26, TRIM, [front - side * 0.07, y, -(zz - bw * 0.31)]));
            parts.push(box(0.1, wh, 0.26, TRIM, [front - side * 0.07, y, -(zz + bw * 0.31)]));
            if (s === 0) parts.push(part(new ConeGeometry(bw * 0.3, 0.5, 3, 1), CREAM, { pos: [front - side * 0.12, y + wh / 2 + 0.38, -zz], rot: [0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0], scale: [1, 1, 0.35] }));
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
      // A string course at every storey, and quoins down the block's corners: the render in panels, as a grand hotel's.
      for (let s = 1; s < storeys; s++) parts.push(box(HOTEL.deep + 0.24, 0.16, blen + 0.24, CREAM, [xMid, floor + plinthH + s * sh, -zc]));
      if (!low) {
        for (let y = floor + plinthH + 0.5; y < top - 0.3; y += 0.9) for (const ez of [z0 + 0.25, z1 - 0.25]) parts.push(box(0.5, 0.4, 0.62, CREAM, [front - side * 0.06, y, -ez]));
      }
      // The first floor's balcony: an iron rail along the whole facade on a slab.
      const by1 = floor + plinthH + sh * 0.02;
      parts.push(box(1.4, 0.22, blen - 1, CREAM, [front - side * 0.7, by1, -zc]));
      parts.push(box(0.06, 1, blen - 1, IRON, [front - side * 1.36, by1 + 0.6, -zc]));
      // Chimneys on the ridge.
      for (const k of [0.22, 0.78]) parts.push(box(0.9, 3.2, 1.4, PLINTH, [xMid + side * 2.5, top + rh + 0.6, -(z0 + blen * k)]));
      // A glazed veranda along the plinth's front, its roof a terrace for the first floor: the hotel's long gallery.
      const vx = front - side * 1.9;
      parts.push(box(3.6, 0.28, blen - 0.6, CREAM, [vx, floor + plinthH - 0.1, -zc]));
      const posts = Math.round(blen / 3);
      for (let i = 0; i <= posts; i++) parts.push(box(0.2, plinthH - 0.2, 0.2, CREAM, [front - side * 3.55, floor + plinthH / 2 - 0.1, -(z0 + 0.3 + ((blen - 0.6) * i) / posts)]));
      glass.push(box(0.08, plinthH - 0.9, blen - 0.8, GLASS, [front - side * 3.5, floor + plinthH / 2 - 0.15, -zc]));
      if (b === 1) {
        // The middle block's pavilion: brought forward of the facade and carried up through the cornice into a tall
        // gable with a round window, so the roofline has a gable to the track between its two towers.
        const pw = blen * 0.36;
        const px = front - side * 1.2;
        parts.push(box(2.6, storeys * sh + plinthH, pw, RENDER_C, [px + side * 1.3 - side * 0.1, floor + (storeys * sh + plinthH) / 2, -zc]));
        const gy = top + 0.4;
        const gh = 5.8;
        parts.push(quad([px, gy, -(zc - pw / 2 - 0.2)], [px, gy, -(zc + pw / 2 + 0.2)], [px, gy + gh, -zc], [px, gy + gh, -zc], side > 0 ? CREAM : CREAM));
        parts.push(quad([px, gy, -(zc + pw / 2 + 0.2)], [px, gy, -(zc - pw / 2 - 0.2)], [px, gy + gh, -zc], [px, gy + gh, -zc], CREAM));
        const slope = Math.atan2(gh, pw / 2 + 0.4);
        for (const s2 of [-1, 1]) parts.push(box(2.8, 0.3, Math.hypot(gh, pw / 2 + 0.4) + 0.3, SLATE, [px + side * 1.3, gy + gh / 2 + 0.15, -(zc + (s2 * (pw / 2 + 0.4)) / 2)], [s2 * slope, 0, 0]));
        glass.push(part(new CylinderGeometry(0.9, 0.9, 0.12, 14, 1), GLASS, { pos: [px - side * 0.05, gy + gh * 0.4, -zc], rot: [0, 0, Math.PI / 2] }));
      }
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
      {
        const sp = tall ? 13 : 9;
        parts.push(part(new ConeGeometry(w * 0.74, sp, 4, 1), SLATE, { pos: [tx, floor + hgt + sp / 2 + 0.2, -zc], rot: [0, Math.PI / 4, 0] }));
        // A ring of snow on its lower slope, and an iron finial.
        parts.push(part(new ConeGeometry(w * 0.7, sp * 0.18, 4, 1, true), SNOW, { pos: [tx, floor + hgt + sp * 0.42, -zc], rot: [0, Math.PI / 4, 0] }));
      }
      if (tall) {
        parts.push(seg([tx, floor + hgt + 12, -zc], [tx, floor + hgt + 18.5, -zc], 0.07, IRON));
        parts.push(box(0.05, 1.2, 2, TRIM, [tx, floor + hgt + 17.6, -(zc - 1)]));
      } else {
        parts.push(seg([tx, floor + hgt + 8.5, -zc], [tx, floor + hgt + 10.5, -zc], 0.06, IRON));
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
    this.add(merge(placed(parts, t.cx, c.baseY(zMid), zMid, 0)), false, HOTEL.from - 10, HOTEL.to);
    this.add(merge(placed(glass, t.cx, c.baseY(zMid), zMid, 0)), true, HOTEL.from - 10, HOTEL.to);
    for (let b = 0; b < blocks; b++) {
      const zz = HOTEL.from + (b + 0.5) * blen;
      const x = t.cx + front - side * 4;
      this.spill.push([x, drawnGround(c, x, zz) + 2.5, zz]);
    }
    this.litZ.push(zMid);
  }

  // ------------------------------------------------------------------ the timing house

  /** The timing house at the outrun: a two-storey timber house past the crest on the left, the judges' balcony along
   *  its track side, its windows lit as the evening comes, and on its up-run end a square clock tower whose great
   *  face looks up the track at the rider coming down (the finish's mark, seen from the last bend); a flagpole by it.
   *  Its plinth takes up the crest's fall under it. */
  private timingHouse(c: Course, low: boolean): void {
    const fz = c.finishZ;
    const zc = fz - 4;
    const side = TIMING.side;
    const t = trackAt(c, zc);
    const edge = LIP * Math.sqrt(1 + t.p * t.p);
    const W = 8.5;
    const D = 10;
    const H = 7;
    const x0 = side * (edge + TIMING.e + W / 2);
    const by = c.baseY(zc);
    const g = (x: number, dz: number) => drawnGround(c, t.cx + x, zc + dz) - by;
    let lo = Infinity;
    let hi = -Infinity;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const y = g(x0 + (a * W) / 2, (b * D) / 2);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    const f0 = hi + 0.6;
    const parts: BufferGeometry[] = [];
    const glass: BufferGeometry[] = [];
    parts.push(box(W + 0.5, f0 - lo + 0.6, D + 0.5, PLINTH, [x0, (f0 + lo - 0.6) / 2, 0]));
    parts.push(box(W, H, D, TIMBER_C, [x0, f0 + H / 2, 0]));
    // Cream boards at the corners and a band between the storeys.
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(box(0.32, H, 0.32, CREAM, [x0 + (a * W) / 2, f0 + H / 2, (b * D) / 2]));
    parts.push(box(W + 0.2, 0.25, D + 0.2, CREAM, [x0, f0 + H * 0.5, 0]));
    // The roof, its ridge along the run.
    const rh = 3.8;
    const run = W / 2 + 0.8;
    const slope = Math.atan2(rh, run);
    for (const s of [-1, 1]) {
      parts.push(box(Math.hypot(rh, run), 0.24, D + 1.4, SLATE, [x0 + (s * run) / 2, f0 + H + rh / 2, 0], [0, 0, -s * slope]));
      parts.push(box(Math.hypot(rh, run) * 0.5, 0.16, D + 1.3, SNOW, [x0 + (s * run) / 4, f0 + H + rh * 0.74, 0], [0, 0, -s * slope]));
    }
    const gy = f0 + H;
    for (const dz of [-D / 2 - 0.05, D / 2 + 0.05]) {
      parts.push(quad([x0 - W / 2 - 0.2, gy, dz], [x0 + W / 2 + 0.2, gy, dz], [x0, gy + rh, dz], [x0, gy + rh, dz], CREAM));
      parts.push(quad([x0 + W / 2 + 0.2, gy, dz], [x0 - W / 2 - 0.2, gy, dz], [x0, gy + rh, dz], [x0, gy + rh, dz], CREAM));
    }
    // The clock tower on the up-run end: square, boarded, rising clear of the roof, its clock under a pyramid cap.
    const TW = 3.6;
    const tz = D / 2 - TW / 2 + 0.3;
    const tTop = f0 + H + rh + 5.6;
    parts.push(box(TW, tTop - f0, TW, TIMBER_D, [x0, (f0 + tTop) / 2, tz]));
    parts.push(box(TW + 0.5, 0.4, TW + 0.5, CREAM, [x0, tTop, tz]));
    // A low hipped cap and on it an open cupola for the timing bell, never a church's spire.
    parts.push(part(new ConeGeometry(TW * 0.86, 1.5, 4, 1), SLATE, { pos: [x0, tTop + 0.95, tz], rot: [0, Math.PI / 4, 0] }));
    for (const [a, b] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) parts.push(box(0.12, 1.3, 0.12, CREAM, [x0 + a, tTop + 1.9, tz + b]));
    parts.push(box(1.4, 0.16, 1.4, CREAM, [x0, tTop + 2.6, tz]));
    parts.push(part(new CylinderGeometry(0.16, 0.26, 0.4, 8, 1, true), new Color('#8A6A3E'), { pos: [x0, tTop + 2.1, tz] }));
    parts.push(part(new ConeGeometry(0.95, 0.7, 4, 1), SLATE, { pos: [x0, tTop + 3.0, tz], rot: [0, Math.PI / 4, 0] }));
    const cy = tTop - 1.9;
    const cz = tz + TW / 2 + 0.06;
    parts.push(box(TW - 0.4, TW - 0.4, 0.1, CREAM, [x0, cy, cz - 0.02]));
    parts.push(part(new CylinderGeometry(1.4, 1.4, 0.12, 24, 1), IRON, { pos: [x0, cy, cz + 0.04], rot: [Math.PI / 2, 0, 0] }));
    parts.push(part(new CylinderGeometry(1.24, 1.24, 0.1, 24, 1), new Color('#F4EEE0'), { pos: [x0, cy, cz + 0.09], rot: [Math.PI / 2, 0, 0] }));
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      parts.push(box(0.09, h % 3 === 0 ? 0.3 : 0.17, 0.04, IRON, [x0 + Math.sin(a) * 1.02, cy + Math.cos(a) * 1.02, cz + 0.15], [0, 0, -a]));
    }
    parts.push(box(0.08, 0.72, 0.04, IRON, [x0 + 0.24, cy + 0.24, cz + 0.17], [0, 0, -0.8]));
    parts.push(box(0.06, 1.04, 0.04, IRON, [x0 - 0.06, cy + 0.5, cz + 0.18], [0, 0, 0.12]));
    // A louvred belfry under the cap on the other three faces, dark in their openings.
    if (!low) for (const [dx, dz2, w, d] of [[TW / 2 + 0.03, 0, 0.1, 1.6], [-TW / 2 - 0.03, 0, 0.1, 1.6], [0, -TW / 2 - 0.03, 1.6, 0.1]] as const) parts.push(box(w, 1.8, d, GLASS, [x0 + dx, cy, tz + dz2]));
    // The judges' balcony along the track side, and the windows.
    const bxs = x0 - side * (W / 2 + 0.7);
    parts.push(box(1.4, 0.2, D - 1, CREAM, [bxs, f0 + H * 0.52, 0]));
    parts.push(box(0.06, 0.95, D - 1, IRON, [bxs - side * 0.66, f0 + H * 0.52 + 0.55, 0]));
    for (const zz of [-3, 0, 3]) {
      glass.push(box(0.12, 1.7, 1.3, GLASS, [x0 - side * (W / 2 + 0.03), f0 + H * 0.75, zz]));
      glass.push(box(0.12, 1.5, 1.1, GLASS, [x0 - side * (W / 2 + 0.03), f0 + H * 0.25, zz]));
    }
    glass.push(box(1.2, 1.5, 0.12, GLASS, [x0 + side * 2.4, f0 + H * 0.25, D / 2 + 0.03]));
    // The flagpole, in iron, the resort's green flag.
    const fx = x0 + side * (W / 2 + 3);
    const fg = g(fx, -D / 2);
    parts.push(seg([fx, fg, -D / 2], [fx, fg + 16, -D / 2], 0.08, IRON));
    if (!low) parts.push(box(0.05, 1.3, 2.2, TRIM, [fx, fg + 15.1, -D / 2 + 1.15]));
    this.add(merge(placed(parts, t.cx, by, zc, -Math.atan(t.p))), false, zc - 8, zc + 8);
    this.add(merge(placed(glass, t.cx, by, zc, -Math.atan(t.p))), true, zc - 8, zc + 8);
    {
      const x = t.cx + x0 - side * (W / 2 + 2.5);
      this.spill.push([x, drawnGround(c, x, zc) + 2.5, zc]);
    }
    this.litZ.push(zc);
  }

  /** The line across the ice at the finish: four rows of big ink and cream checks over the whole channel, wall to
   *  wall, long down the run so the lens sees them square (ART.md 12's line). */
  private finishLine(c: Course): void {
    const z = c.finishZ;
    const t = trackAt(c, z);
    const q = Math.sqrt(1 + t.p * t.p);
    const sq = 0.9;
    const n = Math.floor((LIP * 2) / sq);
    const ink: BufferGeometry[] = [];
    const cream: BufferGeometry[] = [];
    for (let row = 0; row < 4; row++) {
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
    const m = this.add(merge([...ink, ...cream]), false, z, z + 2);
    m.castShadow = false;
  }

  // ------------------------------------------------------------------ the onlookers

  /** The hotel's guests and the town come up to watch: still figures in the resort's coats and hats (crowd.ts
   *  stillCrowd, one draw, Low fewer and bolder) set back on the hotel's terrace, behind the bells'
   *  brackets on the Hotel Straights' crests, at the Labyrinth's board, in two stands at the Horseshoe and lining the
   *  outrun to the timing house. Never on the ice. */
  private onlookers(c: Course, low: boolean): void {
    const p = getPalette('oldrun', Mood.None);
    const { coats, hats } = crowdColors('oldrun', p);
    const list: StillFigure[] = [];
    let k = 0;
    const put = (side: number, z0: number, z1: number, n: number, d0 = CREST_D + 0.35, deep = 1.1): void => {
      for (let i = 0; i < n; i++) {
        k++;
        if (low && k % 2 === 0) continue;
        const h = (k * 0.618034) % 1;
        const z = z0 + ((z1 - z0) * (i + 0.5)) / n + (h - 0.5) * 0.8;
        const t = trackAt(c, z);
        const d = d0 + ((k * 0.41421) % 1) * deep;
        const x = t.cx + side * d * Math.sqrt(1 + t.p * t.p);
        list.push({ x, y: drawnGround(c, x, z) - 0.05, z: -z, face: -side, coat: coats[k % coats.length], hat: hats[(k * 3) % hats.length] });
      }
    };
    // The hotel's terrace, along its balustrade.
    // (Set back from the balustrade: by the lens, still figures read as stacked boxes.)
    const terrace = LIP + 9;
    put(HOTEL.side, HOTEL.from + 6, HOTEL.to - 10, 22, terrace, 3);
    // The Hotel Straights' bends, on their outside crests, where the bells hang (every other one).
    const turns = placeOf(c, 'hotel').turns;
    turns.forEach((tn, i) => {
      if (i % 2) return;
      const zm = tn.z0 + tn.len / 2;
      put(tn.side, zm + 3, zm + 15, 6);
    });
    // The Labyrinth's exit, by its board, and its entry.
    const lab = placeOf(c, 'labyrinth');
    put(-1, lab.z1 + 2, lab.z1 + 18, 8);
    put(1, lab.z0 - 30, lab.z0 - 18, 5);
    // Two stands at the Horseshoe: deep on its outside crest, a row on its inside one.
    const hook = placeOf(c, 'hook');
    const ht = hook.turns[1] ?? hook.turns[0];
    put(ht.side, ht.z0 + ht.len * 0.3, ht.z0 + ht.len * 0.55, 16, CREST_D + 1.2, 3.2);
    put(-ht.side, ht.z0 + ht.len * 0.45, ht.z0 + ht.len * 0.6, 8);
    // The outrun, lining both crests to the timing house and past the line.
    put(1, c.finishZ - 70, c.finishZ + 25, 22);
    put(-1, c.finishZ - 70, c.finishZ - 16, 12);
    if (!list.length) return;
    const m = this.add(stillCrowd(list, 'oldrun', low ? LOW_BOLD : 1));
    m.castShadow = false;
  }

  // ------------------------------------------------------------------ each frame

  update(_dt: number, time: number, mode: ViewMode, s: Snap, sim: Sim | null, _camera: PerspectiveCamera): void {
    if (!this.course || this.lampN === 0) return;
    this.pieces.update(this.course, time, s, sim, mode === 'run', this.detail === 'low', reduced());
    // A place is drawn from within reach of it only (Low's reach is shorter): the hotel and the start house off the
    // first few hundred metres, the timing house and the line off the last. Its parapet and lamps are always drawn.
    const reach = this.detail === 'low' ? 420 : 700;
    for (const w of this.windows) w.m.visible = s.z > w.z0 - reach && s.z < w.z1 + 90;
    // The lamps' glass and the windows light as the day goes (the palette's lamps, by the journey): dark glass by
    // day, the lamp's light at dusk and by Lamplight.
    const lampK = shared.uLampK.value as number;
    const lit = Math.max(0, Math.min(1.6, (lampK - 0.35) / 0.8));
    this.glow.uniforms.uEmissiveStrength.value = Math.min(1.25, lit * 1.3);
    if (lit <= 0.02) return;
    // The hotel's and the timing house's windows spill their light onto the snow before them once they are lit.
    if (lit > 0.3) {
      for (const sp of this.spill) if (Math.abs(sp[2] - s.z) < 160) pushLocalLight(sp[0], sp[1], -sp[2], LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 14, 0.5 * Math.min(1, lit));
    }
    // The nearest lamps light the ice under them: from a little behind the rider to 110 m ahead.
    const z = s.z;
    for (let i = 0; i < this.lampN; i++) {
      const lz = this.lamps[i * 3 + 2];
      if (lz < z - 25 || lz > z + 110) continue;
      // (Soft: a lamp over a deep wall lit the wall's face under it, which the lens sees edge-on as a stripe of light.)
      pushLocalLight(this.lamps[i * 3], this.lamps[i * 3 + 1] + 3, -lz, LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 15, 0.42 * Math.min(1, lit));
    }
  }
}
