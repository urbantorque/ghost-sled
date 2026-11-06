import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Object3D, OctahedronGeometry, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { CHUNK_LEN, Course, type Ledge, type Rail, type Section } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { flagColors } from './dressing';
import { SNOW, crystal, merge, part, reseed, softPart, variantDepthMaterial, variantMaterial, variantRange, variantSet, variantView } from './flora';
import { visualGround } from './ground';
import { makeToonMaterial } from './materials';
import type { Palette } from './palette';

// What the course is furnished with so a place reads before you reach it, on every tier, in one draw:
// the grindable rails, and the leaps' and the forks' markers. One instanced variant set (flora.ts), so
// Low keeps a readable lip and a readable choice with no dressing at all.
//   rail       a bar rising out of a mound of snow at its low end and running on over its posts, along
//              the line the sim grinds (the height it reaches in the first third, then parallel to the
//              ground). It is laid in short straight lengths, so it follows the ground too.
//   flag       a tall marker pole with a pennant in the slalom blue-violets: two lines funnel you to a
//              leap's lip, a step's or an outlet's edge, and on down both sides of the landing below
//   shoulder   a mass of the mountain's own rock standing either side of a lip, off the line
//   cornice    a wind-torn snow lip across the brow, flush with it, hanging out over the drop
//   sign       the fork's: a gantry across the corridor before the ridge stands up, one board high over
//              each channel, so the two read either side of the rider from 150 m and more at speed: the
//              calm route's pale with a blue-violet disc, the bold route's dark with a white diamond
//              and a marigold band for the gifts down it.

export const P_RAMP = 0;
export const P_BAR = 1;
export const P_FLAG = 2;
export const P_SHOULDER = 3;
export const P_CORNICE = 4;
/** The sign with its bold arm to the left, and to the right. */
export const P_SIGN_L = 5;
export const P_SIGN_R = 6;

/** The window's instances at most: rails in short lengths, flags and a leap's stones. */
const CAP = 420;
/** A rail's length in metres the model's posts and mound are proportioned for, and one length's reach. */
const LEN = 8;
/** The share of a rail in which it climbs to its height (sim.ts grindStep). */
const RISE = 1 / 3;
/** How far up the run a leap's funnel of flags starts, and their spacing. */
const FUNNEL = 96;
const FLAG_STEP = 16;
const LAND_STEP = 30;
/** How many metres a cornice length covers. */
const LIP_LEN = 6;
/** The fork's gantry: its span as modelled, how far past the edge its posts stand, and how far into the
 *  section it stands (the ridge starts rising about 47 m in). */
const GANTRY = 36;
const GANTRY_E = 2.6;
const GANTRY_Z = 34;

function hashf(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

interface RailLook {
  bar: Color;
  top: Color;
  post: Color;
}

function railLook(biome: BiomeId): RailLook {
  if (biome === 'glacier') return { bar: new Color('#4E6288'), top: new Color('#E2ECF8'), post: new Color('#383C54') };
  if (biome === 'volcanic') return { bar: new Color('#3C343A'), top: new Color('#B4A8A6'), post: new Color('#2C2630') };
  if (biome === 'blossom') return { bar: new Color('#5E2C3C'), top: new Color('#F0E0D0'), post: new Color('#3A2A36') };
  return { bar: new Color('#74563F'), top: new Color('#D8DCE6'), post: new Color('#54402F') };
}

/** A rail length runs from z 0 to z -1 (each instance's z axis is the length itself, its y axis stays
 *  world up, so posts stand plumb); these keep a post's section round whatever the length. */
const zk = 1 / LEN;

function barGeometry(look: RailLook): BufferGeometry {
  const parts: BufferGeometry[] = [
    part(new BoxGeometry(0.15, 0.1, 1), look.bar, { pos: [0, -0.05, -0.5] }),
    part(new BoxGeometry(0.09, 0.03, 1), look.top, { pos: [0, 0.012, -0.5] }),
    part(new CylinderGeometry(0.075, 0.09, 2.6, 6), look.post, { pos: [0, -1.34, -0.5], scale: [1, 1, zk] }),
    part(new BoxGeometry(0.1, 0.1, 0.3), look.post, { pos: [0, -0.14, -0.5], scale: [1, 1, zk] }),
    part(new IcosahedronGeometry(0.34, 0), SNOW, { pos: [0, -1.18, -0.5], scale: [1, 0.34, zk * 1.1], jitter: 0.05 }),
  ];
  return merge(parts);
}

function rampGeometry(look: RailLook): BufferGeometry {
  // The low end: the bar comes up out of a long mound of packed snow, a strap holding it down.
  return merge([
    part(new BoxGeometry(0.15, 0.1, 1), look.bar, { pos: [0, -0.05, -0.5] }),
    part(new BoxGeometry(0.09, 0.03, 1), look.top, { pos: [0, 0.012, -0.5] }),
    softPart(new SphereGeometry(1, 6, 3), SNOW, { pos: [0, -0.1, -0.03], scale: [0.5, 0.2, 0.16] }),
    part(new CylinderGeometry(0.07, 0.085, 1.8, 6), look.post, { pos: [0, -0.9, -0.82], scale: [1, 1, zk] }),
  ]);
}

function flagGeometry(): BufferGeometry {
  const pennant = new ConeGeometry(0.56, 1.7, 3);
  return merge([
    part(new CylinderGeometry(0.05, 0.07, 3.9, 5), new Color('#E6E8F2'), { pos: [0, 1.85, 0] }),
    // (White, so each instance's colour paints it.)
    part(pennant, new Color('#FFFFFF'), { pos: [0.86, 3.3, 0], rot: [0, 0, -Math.PI / 2], scale: [1, 1, 0.05] }),
    part(new BoxGeometry(0.16, 0.08, 0.16), new Color('#C8CCDC'), { pos: [0, 3.82, 0] }),
    part(new IcosahedronGeometry(0.34, 0), SNOW, { pos: [0, 0.02, 0], scale: [1.2, 0.42, 1.2], jitter: 0.06 }),
  ]);
}

/** A rock's mass, its foot buried: faces of the mountain's own colour, a cap of what lies on them. */
function shoulderGeometry(biome: BiomeId): BufferGeometry {
  reseed(7711);
  if (biome === 'glacier') {
    const a = new Color('#2E74C4');
    const b = new Color('#1B4A9E');
    const c = new Color('#8FCDF2');
    return merge([
      crystal(b, 1.7, 5.2, [0, -0.6, 0], [0.05, 0.4, -0.08]),
      crystal(a, 1.25, 4.6, [1.7, -0.6, 0.5], [0.1, 1.1, 0.16]),
      crystal(a, 1.1, 3.1, [-1.7, -0.6, 0.3], [-0.06, 0.7, -0.2]),
      crystal(c, 0.62, 2.6, [0.7, -0.5, 1.3], [0.2, 2.1, 0.1]),
      softPart(new SphereGeometry(1, 7, 3), SNOW, { pos: [0, -0.5, 0.3], scale: [4.4, 1.1, 3.6] }),
    ]);
  }
  if (biome === 'volcanic') {
    const a = new Color('#2C2630');
    const b = new Color('#1C1820');
    const cap = new Color('#8C8288');
    const col = (x: number, z: number, r: number, h: number, c: Color): BufferGeometry[] => [
      part(new CylinderGeometry(r * 0.94, r, h, 6), c, { pos: [x, h / 2 - 0.8, z], rot: [0, x * 1.3, 0] }),
      part(new CylinderGeometry(r * 0.6, r * 0.94, 0.3, 6), cap, { pos: [x, h - 0.65, z], rot: [0, x * 1.3, 0] }),
    ];
    return merge([...col(0, 0, 1.1, 7.2, a), ...col(1.75, 0.3, 0.95, 5.4, b), ...col(-1.6, 0.4, 1.0, 4.4, b), ...col(0.5, 1.5, 0.8, 3.2, a), ...col(-0.8, -1.3, 0.9, 6.0, b), softPart(new SphereGeometry(1, 7, 3), new Color('#AFA6AC'), { pos: [0, -0.5, 0.4], scale: [4.4, 1.1, 3.6] })]);
  }
  const blossom = biome === 'blossom';
  const dark = blossom ? new Color('#807A92') : new Color('#57506C');
  const mid = blossom ? new Color('#9C94A6') : new Color('#7A7088');
  const pale = blossom ? new Color('#B2A8B4') : new Color('#94889E');
  const lid = blossom ? new Color('#7E9868') : SNOW;
  // Tall fins of rock leaning together, broken at the top, each a few hard planes (ART.md section 3:
  // a rock is a chunky crystal, never a pebble), with what lies on their ledges.
  const fin = (r: number, h: number, pos: [number, number, number], rot: [number, number, number], c: Color, jit: number): BufferGeometry => part(new ConeGeometry(r, h, 5, 2), c, { pos, rot, scale: [1, 1, 0.72], jitter: jit });
  return merge([
    fin(2.5, 8.6, [0, 3.2, 0], [0.05, 0.5, -0.1], dark, 0.5),
    fin(1.9, 6.4, [2.1, 2.2, 0.5], [0.1, 1.7, 0.14], mid, 0.42),
    fin(2.0, 5.2, [-2.2, 1.7, 0.4], [-0.08, 3.1, -0.17], mid, 0.42),
    fin(1.3, 3.8, [0.9, 1.0, 1.7], [0.22, 4.4, 0.08], pale, 0.3),
    part(new IcosahedronGeometry(1.0, 0), pale, { pos: [-1.2, 0.5, 1.7], scale: [1.3, 0.9, 1], rot: [0.3, 1.1, 0.2], jitter: 0.26 }),
    part(new IcosahedronGeometry(1.3, 0), lid, { pos: [0.5, 4.2, 0.55], scale: [1.1, 0.3, 0.7], rot: [0.26, 0, 0.1], jitter: 0.2 }),
    part(new IcosahedronGeometry(1.0, 0), lid, { pos: [2.5, 2.7, 0.75], scale: [1.1, 0.26, 0.8], rot: [0.2, 0, -0.14], jitter: 0.16 }),
    part(new IcosahedronGeometry(1.0, 0), lid, { pos: [-2.4, 2.1, 0.7], scale: [1.15, 0.26, 0.8], rot: [0.2, 0, 0.2], jitter: 0.16 }),
    softPart(new SphereGeometry(1, 7, 3), SNOW, { pos: [0, -0.5, 0.4], scale: [5, 1.2, 4] }),
  ]);
}

/** A length of wind-torn lip, LIP_LEN along x, flush with the brow at y 0, hanging out over the drop
 *  (toward -z) in scallops, its underside in cold shade. */
function corniceGeometry(p: Palette): BufferGeometry {
  const under = SNOW.clone().lerp(p.snowShade, 0.85);
  const parts: BufferGeometry[] = [];
  const lumps: Array<[number, number]> = [
    [-1.9, 1.6],
    [0.1, 2.2],
    [2.1, 1.4],
  ];
  for (const [x, reach] of lumps) {
    parts.push(softPart(new SphereGeometry(1, 7, 3), SNOW, { pos: [x, -0.5, -0.3 - reach * 0.32], scale: [1.6, 0.5, reach] }));
    parts.push(softPart(new SphereGeometry(1, 5, 2), under, { pos: [x, -0.82, -0.2 - reach * 0.42], scale: [1.3, 0.38, reach * 0.84] }));
    // A torn tongue of snow off each scallop.
    parts.push(softPart(new ConeGeometry(0.42, reach * 1.2, 4), SNOW, { pos: [x + 0.4, -0.3, -0.5 - reach * 1.05], rot: [-Math.PI / 2, 0, 0], scale: [1.3, 1, 0.4] }));
  }
  return merge(parts);
}

/** The fork's gantry, facing up the run (+z), GANTRY across between its posts, their feet well under
 *  the higher bank: `bold` is the side (-1 left, 1 right) of the bold route. Each board hangs over its
 *  channel, an arrow turned out and down toward it. */
function signGeometry(bold: number): BufferGeometry {
  const wood = new Color('#3E3442');
  const light = new Color('#EFE9DE');
  const dark = new Color('#161A30');
  const disc = new Color('#3E56C8');
  const gold = new Color('#FFD34D');
  const half = GANTRY / 2;
  const y = 10.4;
  const board = (dir: number, face: Color, tip: Color): BufferGeometry[] => [
    part(new BoxGeometry(11.4, 3.3, 0.2), face, { pos: [dir * 8.8, y, 0.3] }),
    part(new BoxGeometry(11.6, 0.2, 0.26), wood, { pos: [dir * 8.8, y - 1.74, 0.3] }),
    part(new BoxGeometry(11.6, 0.26, 0.5), SNOW, { pos: [dir * 8.8, y + 1.78, 0.3] }),
    // The arrow, pointing out over the channel and down into it.
    part(new ConeGeometry(1.5, 2.3, 3), tip, { pos: [dir * 12.6, y - 0.1, 0.42], rot: [0, 0, dir * (Math.PI * 0.72)], scale: [1, 1, 0.08] }),
    part(new BoxGeometry(5.2, 0.8, 0.08), tip, { pos: [dir * 9.0, y - 0.1 + 0.34, 0.42], rot: [0, 0, -dir * 0.12] }),
  ];
  const safe = -bold;
  return merge([
    part(new BoxGeometry(GANTRY + 1, 0.42, 0.42), wood, { pos: [0, y + 1.5, 0] }),
    part(new BoxGeometry(GANTRY + 1, 0.3, 0.3), wood, { pos: [0, y - 1.5, 0] }),
    part(new BoxGeometry(0.46, 22, 0.46), wood, { pos: [-half, y - 9.4, 0] }),
    part(new BoxGeometry(0.46, 22, 0.46), wood, { pos: [half, y - 9.4, 0] }),
    part(new BoxGeometry(0.2, 3.2, 0.2), wood, { pos: [0, y, 0] }),
    ...board(safe, light, new Color('#2A3350')),
    part(new CylinderGeometry(1.2, 1.2, 0.06, 12), disc, { pos: [safe * 4.8, y, 0.44], rot: [Math.PI / 2, 0, 0] }),
    ...board(bold, dark, light),
    part(new OctahedronGeometry(1.45, 0), SNOW, { pos: [bold * 4.8, y, 0.44], scale: [1, 1, 0.05] }),
    part(new BoxGeometry(11.4, 0.42, 0.06), gold, { pos: [bold * 8.8, y - 1.42, 0.44] }),
  ]);
}

/** One placed piece, in sim metres, baked to its matrix. */
interface Item {
  m: Float32Array;
  pick: number;
  r: number;
  g: number;
  b: number;
}

export class Rails {
  readonly root = new Object3D();
  private mesh: InstancedMesh;
  private pick = new InstancedBufferAttribute(new Float32Array(CAP), 1);
  private src: BufferGeometry;
  private view: BufferGeometry;
  private mat: ShaderMaterial;
  /** The furniture of the ledges and forks by chunk, as far as it has been laid, and what has. */
  private fixed = new Map<number, Item[]>();
  private laid = new Set<object>();
  /** What each chunk's rails add to that, kept while it is in range. */
  private cache = new Map<number, Item[]>();
  private range = { from: 1, to: 0 };
  private flags: [Color, Color];
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3();
  private a = new Vector3();
  private b = new Vector3();
  private x = new Vector3();
  private y = new Vector3(0, 1, 0);
  private z = new Vector3();

  constructor(
    private course: Course,
    private palette: Palette,
    shadows: boolean,
    smoothFade: boolean,
  ) {
    this.root.name = 'rails';
    this.mat = this.makeMaterial(smoothFade);
    this.flags = flagColors(palette);
    this.src = this.kit();
    this.view = variantView(this.src, this.pick);
    this.mesh = new InstancedMesh(this.view, this.mat, CAP);
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(CAP * 3).fill(1), 3);
    this.mesh.castShadow = shadows;
    this.mesh.customDepthMaterial = variantDepthMaterial();
    this.root.add(this.mesh);
    this.layCourse();
  }

  private makeMaterial(smoothFade: boolean): ShaderMaterial {
    return variantMaterial(makeToonMaterial({ coolShade: 0.5, nearFade: [1.4, 2.6], coverageFade: smoothFade }));
  }

  private kit(): BufferGeometry {
    const biome = this.course.biome;
    const look = railLook(biome);
    const list = [rampGeometry(look), barGeometry(look), flagGeometry(), shoulderGeometry(biome), corniceGeometry(this.palette), signGeometry(-1), signGeometry(1)];
    const g = variantSet(list);
    for (const b of list) b.dispose();
    return g;
  }

  setCourse(course: Course, palette: Palette): void {
    if (course === this.course && palette === this.palette) return;
    this.course = course;
    this.palette = palette;
    this.flags = flagColors(palette);
    this.src.dispose();
    this.view.dispose();
    this.src = this.kit();
    this.view = variantView(this.src, this.pick);
    this.mesh.geometry = this.view;
    this.layCourse();
  }

  setQuality(shadows: boolean, smoothFade: boolean): void {
    this.mesh.castShadow = shadows;
    this.mat.dispose();
    this.mat = this.makeMaterial(smoothFade);
    this.mesh.material = this.mat;
  }

  /** Bakes one instance from the transform in m. */
  private bake(pick: number, r = 1, g = 1, b = 1): Item {
    return { m: Float32Array.from(this.m.elements), pick, r, g, b };
  }

  private add(list: Map<number, Item[]>, z: number, it: Item): void {
    const i = Math.floor(z / CHUNK_LEN);
    const l = list.get(i);
    if (l) l.push(it);
    else list.set(i, [it]);
  }

  private upright(x: number, y: number, z: number, yaw: number, sx: number, sy = sx, sz = sx): void {
    this.q.setFromAxisAngle(this.y, yaw);
    this.m.compose(this.v.set(x, y, -z), this.q, this.s.set(sx, sy, sz));
  }

  /** A flag `e` metres past the edge on `side`, at sim z, its pennant streaming down the run. */
  private flag(list: Map<number, Item[]>, side: number, e: number, z: number, n: number, scale = 1): void {
    const c = this.course;
    const x = c.centerX(z) + side * (c.halfWidth(z) + e);
    this.upright(x, visualGround(c, x, z) - 0.1, z, side < 0 ? 0.25 : Math.PI - 0.25, scale);
    const col = this.flags[n & 1];
    this.add(list, z, this.bake(P_FLAG, col.r, col.g, col.b));
  }

  /** A lip: rock either side, flags funnelling in, a cornice across it. `big` is a leap's. */
  private dressLip(l: Ledge, n: number, big: boolean): void {
    const c = this.course;
    const f = this.fixed;
    const hw = c.halfWidth(l.z);
    for (let side = -1; side <= 1; side += 2) {
      const sd = side < 0 ? 0 : 1;
      // Stepping up the bank toward the lip, so a pair of shoulders frames the sky past it.
      const stones = big ? [[-1.5, 2.6, 1.5], [-11, 4.2, 1.15], [-23, 3.4, 0.8]] : [[-1, 2.6, 0.7]];
      stones.forEach(([dz, e, sc], k) => {
        const z = l.z + dz;
        const x = c.centerX(z) + side * (c.halfWidth(z) + e + hashf(n, sd, k) * 0.8);
        const s = sc * (0.92 + 0.2 * hashf(n, sd, k + 5));
        this.upright(x, visualGround(c, x, z) - 0.2, z, hashf(n, sd, k + 9) * 6.28, s, s * (big ? 1.2 : 1), s);
        this.add(f, z, this.bake(P_SHOULDER));
      });
      // Flags funnel in along the edge, closing on the lip.
      const run = big ? FUNNEL : 32;
      for (let d = run; d >= 0; d -= big ? FLAG_STEP : 16) {
        const z = l.z - d - 0.5;
        this.flag(f, side, 0.6 + 2.4 * (d / run), z, Math.round(d / FLAG_STEP), big ? 1.05 : 0.85);
      }
    }
    // The cornice runs across the brow, a piece's width at a time.
    const cx = c.centerX(l.z);
    const y = c.baseY(l.z);
    const count = Math.ceil(((hw + 1) * 2) / LIP_LEN);
    for (let k = 0; k < count; k++) {
      const x = cx - hw - 1 + (k + 0.5) * LIP_LEN + (hashf(n, k, 21) - 0.5);
      const s = 0.96 + 0.2 * hashf(n, k, 22);
      this.upright(x, Math.min(y, c.ground(x, l.z)) + 0.01, l.z + 0.1, (hashf(n, k, 23) - 0.5) * 0.12, s, 1, 0.9 + 0.5 * hashf(n, k, 24));
      this.add(f, l.z, this.bake(P_CORNICE));
    }
  }

  /** Forgets the course's furniture: it is laid again as each piece comes into range. */
  private layCourse(): void {
    this.fixed.clear();
    this.cache.clear();
    this.laid.clear();
    this.range = { from: 1, to: 0 };
  }

  /** Lays everything that reaches into chunk i and has not been laid yet, in one go (it spans chunks,
   *  and reading the ground it stands on builds their zones, so none of it is done before it is seen). */
  private layInto(i: number): void {
    const c = this.course;
    const z0 = i * CHUNK_LEN - CHUNK_LEN;
    const z1 = (i + 1) * CHUNK_LEN + CHUNK_LEN;
    c.ledges.forEach((l, n) => {
      if (l.z - FUNNEL - 30 > z1 || l.land1 + 10 < z0 || this.laid.has(l)) return;
      this.laid.add(l);
      if (l.kind === 'leap') {
        this.dressLip(l, n, true);
        // Flags down both sides of the landing, read from the air: the slope's scale and its line.
        for (let side = -1; side <= 1; side += 2) {
          for (let d = l.land0 - 6, k = 0; d < l.land1; d += LAND_STEP, k++) this.flag(this.fixed, side, 0.4, d, k, 1.5);
        }
      } else if (l.kind === 'outlet') this.dressLip(l, n, false);
      else {
        for (let side = -1; side <= 1; side += 2) this.flag(this.fixed, side, 0.5, l.z - 0.5, n, 0.8);
      }
    });
    for (let z = z0; z <= z1; z += 16) {
      const s = c.section(Math.max(0, z));
      if (s.kind !== 'fork' || this.laid.has(s)) continue;
      this.laid.add(s);
      this.laySign(s);
    }
  }

  /** A rail's lengths: the climb, then on over the ground at its height. */
  private layRail(r: Rail, out: Item[]): void {
    const c = this.course;
    const len = r.z1 - r.z0;
    const at = (u: number, to: Vector3): Vector3 => {
      const x = r.x0 + (r.x1 - r.x0) * u;
      const z = r.z0 + len * u;
      return to.set(x, c.ground(x, z) + r.h * Math.min(1, u / RISE), -z);
    };
    const lengths = Math.max(2, Math.round((len * (1 - RISE)) / LEN));
    const stops = [0, RISE];
    for (let k = 1; k <= lengths; k++) stops.push(RISE + ((1 - RISE) * k) / lengths);
    for (let k = 0; k + 1 < stops.length; k++) {
      at(stops[k], this.a);
      at(stops[k + 1], this.b);
      // (y stays world up and z is the length, so the post in the model stands plumb under a sloped bar.)
      this.z.subVectors(this.a, this.b);
      this.x.crossVectors(this.y, this.z).normalize();
      this.m.makeBasis(this.x, this.y, this.z);
      this.m.setPosition(this.a);
      out.push(this.bake(k === 0 ? P_RAMP : P_BAR));
    }
  }

  /** The fork's gantry, spanning the corridor where it will divide. (The safe line takes `side`, and the
   *  bold route the other.) */
  private laySign(sec: Section): void {
    const c = this.course;
    const z = sec.z0 + GANTRY_Z;
    const cx = c.centerX(z);
    const hw = c.halfWidth(z) + GANTRY_E;
    const y = Math.max(c.ground(cx - hw, z), c.ground(cx + hw, z));
    this.upright(cx, y, z, 0, (2 * hw) / GANTRY, 1, 1);
    this.add(this.fixed, z, this.bake(sec.side > 0 ? P_SIGN_L : P_SIGN_R));
  }

  private chunkItems(i: number): Item[] {
    let list = this.cache.get(i);
    if (list) return list;
    this.layInto(i);
    list = this.fixed.get(i)?.slice() ?? [];
    for (const r of this.course.zones(i).rails) this.layRail(r, list);
    this.cache.set(i, list);
    return list;
  }

  /** Keeps the chunks [from, to] standing: rebuilt only when that window moves. */
  update(from: number, to: number): void {
    if (from === this.range.from && to === this.range.to) return;
    this.range = { from, to };
    for (const k of this.cache.keys()) if (k < from - 2 || k > to + 2) this.cache.delete(k);
    const mats = this.mesh.instanceMatrix.array as Float32Array;
    const cols = this.mesh.instanceColor!.array as Float32Array;
    const picks = this.pick.array as Float32Array;
    let n = 0;
    for (let i = from; i <= to; i++) {
      for (const it of this.chunkItems(i)) {
        if (n >= CAP) break;
        mats.set(it.m, n * 16);
        picks[n] = it.pick;
        cols[n * 3] = it.r;
        cols[n * 3 + 1] = it.g;
        cols[n * 3 + 2] = it.b;
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n === 0) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.pick.needsUpdate = true;
    variantRange(this.view, this.pick, n);
  }
}
