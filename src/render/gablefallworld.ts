import { BufferAttribute, BufferGeometry, Color, Mesh, Object3D, PerspectiveCamera, ShaderMaterial } from 'three';
import type { Snap } from '../game/run';
import type { Beat } from '../game/beats';
import type { Course } from '../sim/course';
import { BACK, FRONT, NAVE_LEN, PAVE, ROOF_GRADE, gable, type Piece, type Row, placesOf, rowAt, rowsOf } from '../sim/gablefall';
import { LANE_W } from '../sim/charms';
import { Mood } from '../sim/chaos';
import type { Sim } from '../sim/sim';
import { makeToonMaterial, shared } from './materials';
import { pushLocalLight } from './lights';
import { LANE, NAVE_EAVE, NAVE_PITCH, QUAY_TOP, RIVER_FAR, hillY, isGablefall } from './gablefallplan';
import { LOW_BOLD, type StillFigure, crowdColors, stillCrowd } from './crowd';
import { type Palette, getPalette } from './palette';
import { reduced } from '../ui/motion';
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
/** How far a wall stands in front of the terrain's sheer step it covers (the terrain's columns either side of a front,
 *  gablefallplan.ts townColumns, lean its face 3 cm either way: a wall in the step's own plane lost its lower half to
 *  the snow's face). Never more than a sled would notice. */
const PROUD = 0.06;
/** How far the fascia and the snow's lip stand out from a wall at the eave. */
const FASCIA_OUT = 0.5;
const LIP_OUT = 0.36;

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
// (A pale warm lamp, not an orange card: by day it reads as glass with a light behind it, the material's glow growing
// with the hour, GablefallWorld.update.)
const LIT = C('#F6D09A');
const MULLION = C('#3A3446');
/** Bunting: cloth in the town's own muted colours (no role's). */
const BUNTING = [C('#3E5C86'), C('#E8E2D4'), C('#4E6E5A'), C('#6A5A7E'), C('#E8E2D4')];
const SHUTTERS = [C('#3E5A5A'), C('#3A4664'), C('#5A4A3E'), C('#4E5A44')];
/** The lamps' light on the snow (linear). */
const LAMP_LIN = new Color('#FFD2A0').convertSRGBToLinear();
const DARK = C('#2A2E48');
const ICE = C('#DCE8F6');
/** A drift's boards: weathered timber, a step lighter and darker by the bay. */
const BOARD = C('#7A6C64');
const BOARD_D = C('#6A5E5A');
const IRON = C('#262834');
/** The church's stone: a pale grey-buff ashlar, its buttresses a step darker; its windows' glass amber and a deep blue. */
const CHURCH = C('#B4AEA6');
const CHURCH_D = C('#948E8A');
/** The nave's pinnacles: the palest dressed stone, slim, so they stand beside the run as markers and never as dark
 *  hazards (ART.md 12, close to the lens: pale and slim). */
const PINNACLE = C('#DAD4CA');
const GLASS_BLUE = C('#3E4E86');
const BELFRY = C('#22243A');
const CLOCK = C('#E6E0D4');
const GRAVE = C('#6A6878');
const WALL_STONE = C('#8A8696');
const WALL_STONE_D = C('#76727F');
/** The market halls' plaster under their timber framing, their arcades' dark, the timber. */
const MARKET = C('#E4D8C2');
const ARCADE = C('#2C2A3C');
const TIMBER = C('#4A3C38');
/** The stalls' goods and their awnings' stripes (muted: no role's colour, never the rider's vermillion). */
const GOODS = [C('#8A6A4A'), C('#6A7A5A'), C('#A08A6A'), C('#5A6A84')];
const AWNINGS = [C('#3E5C86'), C('#4E6E5A'), C('#6A5A7E'), C('#7A6A4A')];
const CANVAS = C('#E8E2D4');
const BOATHOUSE = C('#5A4E4C');
/** The old bridge's stone, its voussoirs and face course a step darker. */
const BRIDGE = C('#A49E96');
const BRIDGE_D = C('#86808A');
/** The line's checks (ART.md 12). */
const CREAM = C('#EEE4D0');
const INK = C('#1C2030');
/** The far side of the valley, in values the haze takes over. */
const SNOW_FAR = C('#EEF0F8');
const WALLS_FAR = [C('#C8BEB0'), C('#A8ACBC'), C('#B8A8A4'), C('#D4CCBC')];
const SLATE_FAR = C('#5A5C70');
const VIADUCT = C('#A8A4A8');
const VIADUCT_D = C('#8A8690');
/** The gallery's underside over the market square, metres over its snow: over any sled's air by the five's margin
 *  (town.ts AIR_MARGIN over a pop's 2.2 m). */
const GALLERY_UNDER = 10.5;
/** The old bridge's great arch over the run: half its span, its piers past the quay's limit (13 + 2 m). */
const BRIDGE_HALF = 15.5;

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

  /** A quad whose first edge (a, b) takes `foot` and whose last (c, d) takes `head`, the colour running between: a
   *  plastered wall darker at its damp foot and paler under the eave, in one face. */
  quadV(a: V3, b: V3, c: V3, d: V3, foot: Color, head: Color, out: V3): void {
    const n0 = this.col.length;
    this.tri(a, b, c, foot, out);
    this.tri(a, c, d, foot, out);
    // (Each vertex's colour by which edge it is on: tri() may have swapped b and c to face it out.)
    const ya = Math.min(a[1], b[1]);
    const yd = Math.max(c[1], d[1]);
    for (let i = n0 / 3; i < this.col.length / 3; i++) {
      const y = this.pos[i * 3 + 1];
      const t = yd > ya ? Math.max(0, Math.min(1, (y - ya) / (yd - ya))) : 0;
      this.col[i * 3] = foot.r + (head.r - foot.r) * t;
      this.col[i * 3 + 1] = foot.g + (head.g - foot.g) * t;
      this.col[i * 3 + 2] = foot.b + (head.b - foot.b) * t;
    }
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

/** One drawn piece of the town: a segment of its rows and the town past them, or one of its places, and the course's
 *  metres it is drawn from within reach of. */
interface Piece3 {
  z0: number;
  z1: number;
  meshes: Mesh[];
}

/** The far side of the valley (the town's other half, the viaduct) in the snowfall's haze: flat values a face (lit,
 *  shade), leaning into the air's colour with distance on its own long scale (the scene's fog would have taken it whole
 *  from the head of the town; too little, and the viaduct three kilometres off read as a dotted seam across the run and
 *  the far terraces as dashes), its windows keeping a little of their light through it. Drawn after the sky, before the
 *  world. */
function hazeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uHaze: { value: new Color('#CCCAD6') }, uNear: { value: 150 }, uFar: { value: 2600 }, uMax: { value: 0.88 }, uSunDir: shared.uSunDir, uWarm: { value: new Color('#FFB45E') }, uGlowK: { value: 0.7 }, uLight: { value: new Color(1, 1, 1) } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vCol;
      varying float vDist;
      varying float vLit;
      varying float vGlow;
      uniform vec3 uSunDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDist = length(wp.xyz - cameraPosition);
        // (A window is painted in the lamp's colour: its glow keeps through the haze.)
        vGlow = step(0.9, color.r) * step(color.b, 0.35);
        vCol = color;
        vLit = 0.86 + 0.14 * smoothstep(-0.1, 0.4, dot(normalize(normal), uSunDir)) + 0.05 * normal.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uHaze;
      uniform float uNear;
      uniform float uFar;
      uniform float uMax;
      uniform vec3 uWarm;
      uniform float uGlowK;
      uniform vec3 uLight;
      varying vec3 vCol;
      varying float vDist;
      varying float vLit;
      varying float vGlow;
      void main() {
        float k = smoothstep(uNear, uFar, vDist) * uMax;
        vec3 c = mix(vCol * vLit * uLight, uHaze, k);
        c = mix(c, mix(uWarm, uHaze, k * 0.7), vGlow * uGlowK);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Smoke from the chimneys: soft puffs rising and leaning on the wind, in three flat values lit warm on the cloud's
 *  bright side (ART.md 12: three-value gouache smoke over a town's roofs), each a quad turned to the lens. One draw: every
 *  stack within reach that smokes. Still under reduced motion (the puffs keep their place). */
function smokeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: shared.uTime, uLive: { value: 1 }, uLit: { value: new Color('#E8E4EA') }, uShade: { value: new Color('#9C9AB2') } },
    vertexShader: /* glsl */ `
      attribute vec4 aPuff;
      varying vec2 vUv;
      varying float vA;
      varying float vK;
      uniform float uTime;
      uniform float uLive;
      void main() {
        // aPuff: x its phase, y its stack's height scale, z its size, w which corner (0..3).
        float t = fract(aPuff.x + uTime * 0.07 * uLive);
        vec3 base = (modelMatrix * vec4(position, 1.0)).xyz;
        // (Separate round puffs rising well apart and leaning off on the wind: a column of big overlapping ones read to
        // the second critic as a translucent slab.)
        vec3 p = base + vec3(3.2 * t * t + 0.6 * t, (0.3 + 8.5 * t) * aPuff.y, 0.9 * t);
        float s = aPuff.z * (0.4 + 1.1 * t);
        vec2 corner = vec2(mod(aPuff.w, 2.0), floor(aPuff.w / 2.0)) * 2.0 - 1.0;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        p += (right * corner.x + up * corner.y) * s;
        vUv = corner;
        vA = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.5, 1.0, t));
        vK = 0.5 + 0.5 * (corner.y * 0.75 - corner.x * 0.25);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLit;
      uniform vec3 uShade;
      varying vec2 vUv;
      varying float vA;
      varying float vK;
      void main() {
        float r = length(vUv);
        float a = (1.0 - smoothstep(0.5, 0.95, r)) * vA * 0.55;
        if (a < 0.01) discard;
        // Three values a puff, its shade under it and its crown lit toward the sky, softly stepped round the puff's own
        // middle (hard bands across a column of puffs read as stripes).
        float v = vK + 0.12 * (1.0 - r);
        vec3 c = mix(uShade, uLit, smoothstep(0.3, 0.42, v) * 0.55 + smoothstep(0.62, 0.74, v) * 0.45);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

export class GablefallWorld {
  readonly root = new Object3D();
  private course: Course | null = null;
  private detail: Detail = 'high';
  /** The houses, the church, the markets, the quay and the bridge: plaster, stone, slate, snow, paint and glass in one
   *  material, its windows lit from their own colour. */
  private readonly mat: ShaderMaterial;
  private readonly haze: ShaderMaterial;
  private readonly smokeMat: ShaderMaterial;
  /** The town's segments and its places, each drawn only within reach. */
  private pieces: Piece3[] = [];
  private valleyMesh: Mesh | null = null;
  private smokeMesh: Mesh | null = null;
  /** Lamps whose light pools on the snow by them (sim x, y, z, radius): over the doors, at the alleys' gates, on the
   *  bridge and the market halls. Pushed as local lights within reach (lights.ts). */
  private lamps: Array<[number, number, number, number]> = [];
  /** Triangles built: the rows, the town past them, the places, the valley's far side (the notes' counts). */
  tris = { near: 0, far: 0, places: 0, valley: 0 };

  constructor() {
    this.root.name = 'gablefall-world';
    this.mat = makeToonMaterial({ coolShade: 0.3, glowMask: true, emissive: C('#FFB45E'), emissiveStrength: 0.8, rim: 0.2 });
    this.haze = hazeMaterial();
    this.smokeMat = smokeMaterial();
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
    for (const p of this.pieces) for (const m of p.meshes) m.geometry.dispose();
    this.valleyMesh?.geometry.dispose();
    this.smokeMesh?.geometry.dispose();
    this.valleyMesh = null;
    this.smokeMesh = null;
    this.pieces = [];
    this.lamps = [];
    this.tris = { near: 0, far: 0, places: 0, valley: 0 };
  }

  /** A soup's mesh in the town's material, drawn from within reach of [z0, z1). */
  private piece(s: Soup, z0: number, z1: number, name: string, shadow: boolean, into?: Piece3): Piece3 | null {
    if (!s.tris) return into ?? null;
    const m = new Mesh(s.geometry(), this.mat);
    m.name = name;
    m.castShadow = shadow;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    this.root.add(m);
    const p = into ?? { z0, z1, meshes: [] };
    p.meshes.push(m);
    if (!into) this.pieces.push(p);
    return p;
  }

  private build(c: Course): void {
    this.dispose();
    if (!isGablefall(c)) return;
    const low = this.detail === 'low';
    const pl = placesOf(c);
    const end = pl.quay + 60;
    const rows = rowsOf(c);
    for (let z0 = 0; z0 < end; z0 += SEG) {
      const z1 = Math.min(end, z0 + SEG);
      const near = new Soup();
      const far = low ? near : new Soup();
      for (const row of rows) if (row.z1 > z0 && row.z0 < z1) this.nearRow(c, row, z0, z1, near, low);
      this.farTown(c, z0, z1, far, low);
      this.tris.near += near.tris;
      if (far !== near) this.tris.far += far.tris;
      const p = this.piece(near, z0, z1, 'town-near', true);
      if (far !== near) this.piece(far, z0, z1, 'town-far', false, p ?? undefined);
    }
    const t0 = this.tris.near + this.tris.far;
    this.church(c, low);
    for (const g of c.charmGateZs.slice(1)) this.market(c, g, low);
    this.quay(c, low);
    let placed = 0;
    for (const p of this.pieces) for (const m of p.meshes) placed += m.geometry.getAttribute('position').count / 3;
    this.tris.places = placed - t0;
    this.valley(c, low);
    this.smoke(c, low);
  }

  // ------------------------------------------------------------------ the rows

  /** The houses of one row whose tops lie inside [z0, z1): their fronts on the street and their backs on the lane. */
  private nearRow(c: Course, row: Row, z0: number, z1: number, s: Soup, low: boolean): void {
    const sd = row.side;
    for (const p of row.pieces) {
      if (p.z0 < z0 || p.z0 >= z1) continue;
      const id = Math.floor(p.z0 * 2) * 2 + (sd > 0 ? 1 : 0);
      if (p.kind === 'alley') this.gateway(c, s, p, sd, id, low);
      else if (p.kind === 'drift') this.boards(c, s, p, sd, low);
      if (p.kind !== 'house') continue;
      const wall = WALLS[Math.floor(hash(id, 1) * WALLS.length)];
      this.wallRun(c, s, p, sd, FRONT - PROUD, wall, id, low, true);
      this.wallRun(c, s, p, sd, BACK + 0.6 + PROUD, wall, id + 7, low, false);
    }
  }

  /** One long wall of house p, at `adx` across from the street's middle on side sd (its front on the street, or its
   *  back on the lane), from the ground under it to the eave: plaster, its windows (most lit), and on the front a door
   *  and a stone plinth; a slate fascia and the snow's lip along the eave, icicles under it (Medium and High). */
  private wallRun(c: Course, s: Soup, p: Piece, sd: number, adx: number, wall: Color, id: number, low: boolean, front: boolean): void {
    const L = p.z1 - p.z0;
    const n = Math.max(1, Math.ceil(L / 4));
    // (Painted in three values up the wall, not one flat colour: darker at the damp foot, the plaster, paler under the
    // eave. An even face read to the first critic as an untextured box.)
    const wallFoot = wall.clone().multiplyScalar(0.8);
    const wallHead = wall.clone().multiplyScalar(1.05);
    // Facing the street (front) or the lane (back), across: out along x, signed.
    const o = front ? -sd : sd;
    const out: V3 = [o, 0, 0];
    const at = (z: number, off: number): number => c.centerX(z) + sd * adx + o * off;
    const foot = (z: number): number => (front ? c.baseY(z) : c.baseY(z) + LANE) - 0.35;
    // (The roof's snow over the wall's line: its eave on the street; behind, where the snow carries on past the eave to
    // the corridor's limit, a little under it.)
    const eave = (z: number): number => p.e0 - ROOF_GRADE * (z - p.z0) + (front ? 0 : gable(adx - PROUD));
    for (let k = 0; k < n; k++) {
      const za = p.z0 + (k * L) / n;
      const zb = p.z0 + ((k + 1) * L) / n;
      const xa = at(za, 0);
      const xb = at(zb, 0);
      s.quadV([xa, foot(za), za], [xb, foot(zb), zb], [xb, eave(zb) - 0.3, zb], [xa, eave(za) - 0.3, za], wallFoot, wallHead, out);
      if (front) {
        // A string course between the storeys, a pale band a hand proud of the plaster.
        const ca = at(za, 0.025);
        const cb = at(zb, 0.025);
        s.quad([ca, c.baseY(za) + 2.86, za], [cb, c.baseY(zb) + 2.86, zb], [cb, c.baseY(zb) + 3.04, zb], [ca, c.baseY(za) + 3.04, za], SURROUND, out);
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
      // (Its top, past the snow's lip: from the roofs the eave's edge is a dark line of slate over the drop, so the roof's
      // end is read before it is ridden off.)
      s.quad([at(za, LIP_OUT - 0.04), eave(za) - 0.04, za], [at(zb, LIP_OUT - 0.04), eave(zb) - 0.04, zb], [fb, eave(zb) - 0.02, zb], [fa, eave(za) - 0.02, za], SLATE, [0, 1, 0]);
      const la = at(za, LIP_OUT);
      const lb = at(zb, LIP_OUT);
      const ra = at(za, -0.05);
      const rb = at(zb, -0.05);
      s.quad([ra, eave(za) + 0.04, za], [rb, eave(zb) + 0.04, zb], [lb, eave(zb) - 0.08, zb], [la, eave(za) - 0.08, za], SNOW, [o * 0.3, 1, 0]);
      if (!low) s.quad([la, eave(za) - 0.08, za], [lb, eave(zb) - 0.08, zb], [lb, eave(zb) - 0.24, zb], [la, eave(za) - 0.24, za], SNOW, out);
      if (!low && front) {
        // Icicles under the fascia: a few thin cones of ice, longer where the eave is in the lee.
        for (let j = 0; j < 3; j++) {
          if (hash(id + k * 5, j + 41) < 0.72) continue;
          const zi = za + (zb - za) * (0.2 + 0.3 * j + 0.1 * hash(id, j + k));
          const xi = at(zi, FASCIA_OUT - 0.08);
          const yi = eave(zi) - 0.36;
          const len = 0.25 + 0.55 * hash(id + j, k + 43);
          s.tri([xi, yi, zi - 0.06], [xi, yi, zi + 0.06], [xi + o * 0.02, yi - len, zi], ICE, out);
          s.tri([xi - o * 0.06, yi, zi], [xi + o * 0.04, yi, zi], [xi + o * 0.02, yi - len, zi], ICE, [0, 0, -1]);
        }
      }
    }
    // Windows in bays along the wall, two storeys; on the front one bay is the door, and on Medium and High a lamp on a
    // bracket over it on some houses.
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
          if (!low && hash(id, 6) < 0.45) {
            // A lamp on a short iron bracket over the door, close to the wall and over a sled's head.
            const lx = at(zc, 0.24);
            s.box(at(zc, 0.1), by + 3.0, zc, 0.2, 0.06, 0.06, IRON, 0);
            this.lamps.push([lx, by + 2.8, zc, 9]);
            s.box(lx, by + 2.6, zc, 0.28, 0.36, 0.28, LIT, 0);
            s.box(lx, by + 2.96, zc, 0.36, 0.08, 0.36, IRON, 0);
          }
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
        if (!low && front) {
          // Glazing bars across the glass, so a window reads as a window and not a painted card; shutters folded back
          // either side on some houses; now and then a townsman at an upper window, watching the street.
          const m = at(zc, 0.045);
          s.quad([m, by + y0, zc - 0.035], [m, by + y0, zc + 0.035], [m, by + y1, zc + 0.035], [m, by + y1, zc - 0.035], MULLION, out);
          const ym = by + (y0 + y1) / 2 + 0.15;
          s.quad([w0 + o * 0.015, ym - 0.035, zc - 0.46], [w1 + o * 0.015, ym - 0.035, zc + 0.46], [w1 + o * 0.015, ym + 0.035, zc + 0.46], [w0 + o * 0.015, ym + 0.035, zc - 0.46], MULLION, out);
          if (hash(id, 13) < 0.45) {
            const sh = SHUTTERS[Math.floor(hash(id, 14) * SHUTTERS.length)];
            for (const dz of [-1, 1]) {
              const za = zc + dz * 0.66;
              const zb2 = zc + dz * 1.12;
              s.quad([at(za, 0.03), by + y0, za], [at(zb2, 0.03), by + y0, zb2], [at(zb2, 0.03), by + y1, zb2], [at(za, 0.03), by + y1, za], sh, out);
            }
          }
          if (lit && st === 1 && hash(id + b, 19) < 0.18) {
            const f0 = at(zc, 0.05);
            s.quad([f0, by + y0, zc - 0.3], [f0, by + y0, zc + 0.3], [f0, by + y0 + 0.5, zc + 0.24], [f0, by + y0 + 0.5, zc - 0.24], DARK, out);
            s.quad([f0, by + y0 + 0.5, zc - 0.12], [f0, by + y0 + 0.5, zc + 0.12], [f0, by + y0 + 0.78, zc + 0.1], [f0, by + y0 + 0.78, zc - 0.1], DARK, out);
          }
        }
        if (!low && lit && st === 0 && front) {
          // A lit window's sill holds a little snow.
          const k0 = at(zc - 0.5, 0.1);
          const k1 = at(zc + 0.5, 0.1);
          s.quad([k0, by + y0 - 0.02, zc - 0.5], [k1, by + y0 - 0.02, zc + 0.5], [k1, by + y0 + 0.06, zc + 0.5], [k0, by + y0 + 0.06, zc - 0.5], SNOW, out);
        }
      }
    }
  }

  /** An alley's mouth on the street: the alley is drifted full to near its eaves, so from the street it is a wall of
   *  stone between two houses with an arched timber gate in it (an old town's covered way, its snow lying on it), never
   *  a bare face of snow (sheer, the snow shader drew it as a curtain). */
  private gateway(c: Course, s: Soup, p: Piece, sd: number, id: number, low: boolean): void {
    const o = -sd;
    const out: V3 = [o, 0, 0];
    const at = (z: number, off: number): number => c.centerX(z) + sd * (FRONT - PROUD) + o * off;
    const top = (z: number): number => c.ground(c.centerX(z) + sd * (FRONT + 0.05), z) - 0.08;
    const L = p.z1 - p.z0;
    const n = Math.max(1, Math.ceil(L / 3));
    for (let k = 0; k < n; k++) {
      const za = p.z0 + (k * L) / n;
      const zb = p.z0 + ((k + 1) * L) / n;
      s.quad([at(za, 0), c.baseY(za) - 0.35, za], [at(zb, 0), c.baseY(zb) - 0.35, zb], [at(zb, 0), top(zb), zb], [at(za, 0), top(za), za], WALL_STONE, out);
      s.quad([at(za, -0.05), top(za) + 0.06, za], [at(zb, -0.05), top(zb) + 0.06, zb], [at(zb, 0.3), top(zb) - 0.06, zb], [at(za, 0.3), top(za) - 0.06, za], SNOW, [o * 0.3, 1, 0]);
    }
    // The gate: two timber leaves under a round head, an iron lamp over it on some.
    const zc = (p.z0 + p.z1) / 2;
    const by = c.baseY(zc);
    const hw = Math.min(1.4, L / 2 - 0.7);
    const x = at(zc, 0.03);
    const y1 = by + 2.6;
    s.quad([x, by - 0.1, zc - hw], [x, by - 0.1, zc + hw], [x, y1, zc + hw], [x, y1, zc - hw], TIMBER, out);
    for (let j = 0; j < 6; j++) {
      const a0 = (j / 6) * Math.PI;
      const a1 = ((j + 1) / 6) * Math.PI;
      s.tri([x, y1, zc], [x, y1 + Math.sin(a0) * hw, zc + Math.cos(a0) * hw], [x, y1 + Math.sin(a1) * hw, zc + Math.cos(a1) * hw], TIMBER, out);
    }
    const xs = at(zc, 0.05);
    s.quad([xs, by - 0.1, zc - 0.04], [xs, by - 0.1, zc + 0.04], [xs, y1 + hw - 0.1, zc + 0.04], [xs, y1 + hw - 0.1, zc - 0.04], IRON, out);
    if (!low && hash(id, 9) < 0.5) {
      this.lamps.push([at(zc, 0.4), y1 + hw + 0.6, zc, 9]);
      s.box(at(zc, 0.4), y1 + hw + 0.5, zc, 0.26, 0.34, 0.26, LIT, 0);
      s.box(at(zc, 0.4), y1 + hw + 0.84, zc, 0.34, 0.08, 0.34, IRON, 0);
    }
  }

  /** A corner drift's side on the street: the snow is banked up from the street onto the next roofs, held by a wall of
   *  weathered boards on posts that rises with it, a lip of snow along its top: a made way up, ridden from its foot. */
  private boards(c: Course, s: Soup, p: Piece, sd: number, low: boolean): void {
    const o = -sd;
    const out: V3 = [o, 0, 0];
    const at = (z: number, off: number): number => c.centerX(z) + sd * (PAVE - PROUD) + o * off;
    const top = (z: number): number => c.ground(c.centerX(z) + sd * (PAVE + 0.05), z) - 0.06;
    const step = 2;
    for (let z = p.z0; z < p.z1 - 0.01; z += step) {
      const za = z;
      const zb = Math.min(p.z1, z + step);
      const ya = top(za);
      const yb = top(zb);
      const ba = c.baseY(za);
      const bb = c.baseY(zb);
      if (ya - ba < 0.12 && yb - bb < 0.12) continue;
      s.quad([at(za, 0.02), ba - 0.3, za], [at(zb, 0.02), bb - 0.3, zb], [at(zb, 0.02), yb, zb], [at(za, 0.02), ya, za], Math.floor(z / step) % 2 ? BOARD : BOARD_D, out);
      s.quad([at(za, -0.05), ya + 0.07, za], [at(zb, -0.05), yb + 0.07, zb], [at(zb, 0.22), yb - 0.04, zb], [at(za, 0.22), ya - 0.04, za], SNOW, [o * 0.3, 1, 0]);
      if (!low) s.box(at(za, 0.1), ba - 0.3, za, 0.16, ya - ba + 0.42, 0.16, TIMBER, 0);
      // Over its upper posts, little flags on staffs: the way up onto the roofs is marked from down the street.
      if (ya - ba > 2.6 && Math.floor(z / step) % 2 === 0) {
        const fx = at(za, 0.1);
        s.box(fx, ya, za, 0.05, 1.3, 0.05, TIMBER, 0);
        s.tri([fx, ya + 1.3, za], [fx, ya + 0.85, za], [fx, ya + 1.08, za - 0.75], BUNTING[Math.floor(z / step) % BUNTING.length], [-sd, 0, 0]);
      }
    }
  }

  // ------------------------------------------------------------------ the town past the rows

  /** The town past the rows inside [z0, z1): rows of houses with steep roofs, snow on their slate, behind each row of
   *  the run and round the squares, their windows lit toward the run (none where a place of its own stands: the church's
   *  hill, the market halls, the quay). */
  private farTown(c: Course, z0: number, z1: number, s: Soup, low: boolean): void {
    const pl = placesOf(c);
    const gates = c.charmGateZs.slice(1);
    const deep = low ? 2 : 3;
    for (const sd of [-1, 1] as const) {
      for (let k = 0; k < deep; k++) {
        let z = z0 + hash(k + (sd > 0 ? 9 : 0), Math.floor(z0)) * 4;
        while (z < z1) {
          const id = Math.floor(z * 4) * 8 + k * 2 + (sd > 0 ? 1 : 0);
          const L = 7 + hash(id, 21) * 6;
          const zc = z + L / 2;
          z += L + hash(id, 22) * 2.5;
          if (zc < 120 || zc > pl.quay - 14) continue;
          if (k === 0 && gates.some((g) => Math.abs(zc - g) < 16)) continue;
          const sec = c.section(zc);
          const hw = c.halfWidth(zc);
          const row = sec.kind === 'rooftops' ? rowAt(c, sd, zc) : null;
          const inner = row ? BACK + 3.6 : hw + c.edgeLimit(zc) + 2.5;
          const D = 8 + hash(id, 23) * 3;
          const adx = inner + k * 13 + hash(id, 24) * 2;
          const y = c.baseY(zc) + LANE - 0.4 + k * 0.5;
          this.house(s, c.centerX(zc) + sd * (adx + D / 2), y, zc, D, L, id, sd, k === deep - 1 ? 1 : 0, low);
        }
      }
    }
  }

  /** One house of the town past the rows: plaster walls, a steep slate roof (its ridge along the run or across it) under
   *  snow, a chimney, its windows lit toward the run (side sd's run is at -sd). */
  private house(s: Soup, x: number, y: number, zc: number, D: number, L: number, id: number, sd: number, tall: number, low: boolean): void {
    const H = 4.2 + hash(id, 25) * 1.8 + tall * 0.6;
    const wall = WALLS[Math.floor(hash(id, 26) * WALLS.length)];
    const across = hash(id, 27) < 0.45;
    const w = across ? L : D;
    const d = across ? D : L;
    const yaw = across ? Math.PI / 2 : 0;
    s.box(x, y, zc, D, H, L, wall, 0, false);
    const rise = (w / 2) * (0.85 + hash(id, 28) * 0.35);
    s.gable(x, y + H, zc, w, d, rise, 0.35, SLATE, wall, yaw);
    s.gable(x, y + H + 0.12 + rise * 0.18, zc, w * 0.82, d, rise * 0.82, 0.32, SNOW, null, yaw);
    if (!low && hash(id, 29) < 0.7) s.box(x + (hash(id, 30) - 0.5) * D * 0.5, y + H + rise * 0.4, zc + (hash(id, 31) - 0.5) * L * 0.5, 0.7, rise * 0.75 + 1.1, 0.7, SLATE_L);
    // Its windows on the face toward the run.
    const fx = x - sd * (D / 2 + 0.03);
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

  // ------------------------------------------------------------------ the church

  /** The church at the head of the town: the run starts on the snow along its nave's ridge, its roof falling steeply
   *  either side to the eaves over buttressed walls with tall lit windows, standing from the hillside up; the west tower
   *  behind the start with its belfry and a slate spire; the churchyard's stones under the snow on the hill. */
  private church(c: Course, low: boolean): void {
    const s = new Soup();
    const z0 = -6;
    const z1 = NAVE_LEN + 4;
    const lim = c.edgeLimit(10);
    const top = (z: number): number => c.ground(c.centerX(z), z);
    const eave = (z: number): number => top(z) - NAVE_PITCH * (NAVE_EAVE - lim);
    const ex = (z: number, sd: number): number => c.centerX(z) + sd * (c.halfWidth(z) + NAVE_EAVE);
    const step = 4;
    for (const sd of [-1, 1] as const) {
      const out: V3 = [sd, 0, 0];
      for (let z = z0; z < z1 - 0.01; z += step) {
        const za = z;
        const zb = Math.min(z1, z + step);
        const ha = eave(za) - hillY(c, za);
        const hb = eave(zb) - hillY(c, zb);
        if (ha < 0.2 && hb < 0.2) continue;
        const xa = ex(za, sd);
        const xb = ex(zb, sd);
        s.quad([xa, hillY(c, za) - 1, za], [xb, hillY(c, zb) - 1, zb], [xb, eave(zb) - 0.3, zb], [xa, eave(za) - 0.3, za], CHURCH, out);
        // The fascia and the snow's lip along the eave.
        s.quad([xa + sd * 0.3, eave(za) - 0.4, za], [xb + sd * 0.3, eave(zb) - 0.4, zb], [xb + sd * 0.3, eave(zb), zb], [xa + sd * 0.3, eave(za), za], SLATE, out);
        s.quad([xa - sd * 0.05, eave(za) + 0.05, za], [xb - sd * 0.05, eave(zb) + 0.05, zb], [xb + sd * 0.45, eave(zb) - 0.1, zb], [xa + sd * 0.45, eave(za) - 0.1, za], SNOW, [sd * 0.3, 1, 0]);
      }
      // Buttresses and the tall windows between them.
      for (let z = z0 + 3; z < z1 - 4; z += 7.2) {
        const h = eave(z) - hillY(c, z);
        if (h < 2.5) continue;
        const x = ex(z, sd);
        const y = hillY(c, z) - 1;
        s.box(x + sd * 0.7, y, z, 1.4, h - 0.6, 0.9, CHURCH_D, 0);
        s.box(x + sd * 0.95, y + h - 0.6, z, 0.9, 0.5, 0.9, SNOW, 0);
        // Its pinnacle standing over the eave: a slim stone shaft and a slate point, a rhythm down both sides of the
        // nave past the run's limit, so the start reads as a church's roof.
        // (They stand over the nave's snow by two metres: drawn to the eave's height they hid under the roof's fall and
        // the start read as a snowfield.)
        const px = x + sd * 0.8;
        const pb = eave(z) - 1.2;
        const ph = top(z) + 1 - pb;
        s.box(px, pb, z, 0.5, ph, 0.5, PINNACLE, 0);
        s.box(px, pb + ph, z, 0.6, 0.12, 0.6, SNOW, 0);
        for (let j = 0; j < 4; j++) {
          const a: V3 = [px + (j === 0 || j === 3 ? -0.27 : 0.27), pb + ph + 0.12, z + (j < 2 ? -0.27 : 0.27)];
          const b: V3 = [px + ((j + 1) % 4 === 0 || (j + 1) % 4 === 3 ? -0.27 : 0.27), pb + ph + 0.12, z + ((j + 1) % 4 < 2 ? -0.27 : 0.27)];
          // (Pale stone to its point: dark slate points read to the sort's critic as spikes lining the run.)
          s.tri(a, b, [px, pb + ph + 1.3, z], j % 2 ? PINNACLE : SNOW, [(a[0] + b[0]) / 2 - px, 0.3, (a[2] + b[2]) / 2 - z]);
        }
        if (h < 6) continue;
        const wz = z + 3.6;
        const w0 = y + 3;
        const w1 = y + h - 2.6;
        const wx = ex(wz, sd) + sd * 0.03;
        s.quad([wx, w0, wz - 0.6], [wx, w0, wz + 0.6], [wx, w1, wz + 0.6], [wx, w1, wz - 0.6], hash(Math.floor(z), sd + 3) < 0.7 ? LIT : GLASS_BLUE, out);
        s.tri([wx, w1, wz - 0.6], [wx, w1, wz + 0.6], [wx, w1 + 0.9, wz], LIT, out);
        s.quad([wx + sd * 0.02, w0 - 0.3, wz - 0.85], [wx + sd * 0.02, w0 - 0.3, wz + 0.85], [wx + sd * 0.02, w0 - 0.05, wz + 0.85], [wx + sd * 0.02, w0 - 0.05, wz - 0.85], SNOW, out);
      }
    }
    // The west front under the tower and the tower itself: a square stone tower behind the start, its belfry's dark
    // openings on each face, a cornice, a pinnacle at each corner and a tall slate spire, a weathervane on it.
    const tz = z0 - 5;
    const tx = c.centerX(0);
    const ty0 = hillY(c, tz) - 1.5;
    const tTop = top(0) + 15;
    const TW = 9.6;
    s.box(tx, ty0, tz, TW, tTop - ty0, 10, CHURCH, 0, false);
    s.box(tx, tTop - 1.4, tz, TW + 0.8, 0.9, 10.8, CHURCH_D, 0);
    for (const [fx, fz, f] of [
      [0, tz - 5.02, [0, 0, -1]],
      [0, tz + 5.02, [0, 0, 1]],
      [-TW / 2 - 0.02, tz, [-1, 0, 0]],
      [TW / 2 + 0.02, tz, [1, 0, 0]],
    ] as Array<[number, number, V3]>) {
      // Two tall openings a face, dark, round-headed.
      for (const o of [-1.6, 1.6]) {
        const along = f[2] !== 0;
        const ax = along ? tx + o : tx + fx;
        const az = along ? fz : tz + o;
        const y0 = tTop - 7.4;
        const y1 = tTop - 3.6;
        const a: V3 = along ? [ax - 0.7, y0, az] : [ax, y0, az - 0.7];
        const b: V3 = along ? [ax + 0.7, y0, az] : [ax, y0, az + 0.7];
        const cc: V3 = along ? [ax + 0.7, y1, az] : [ax, y1, az + 0.7];
        const dd: V3 = along ? [ax - 0.7, y1, az] : [ax, y1, az - 0.7];
        s.quad(a, b, cc, dd, BELFRY, f);
        s.tri(dd, cc, along ? [ax, y1 + 0.7, az] : [ax, y1 + 0.7, az], BELFRY, f);
      }
      // A clock face on the face toward the run (no figures: hands only).
      if (f[2] === 1) {
        const cy = tTop - 11;
        const r = 1.6;
        for (let i = 0; i < 12; i++) {
          const a0 = (i / 12) * Math.PI * 2;
          const a1 = ((i + 1) / 12) * Math.PI * 2;
          s.tri([tx, cy, fz + 0.03], [tx + Math.cos(a0) * r, cy + Math.sin(a0) * r, fz + 0.03], [tx + Math.cos(a1) * r, cy + Math.sin(a1) * r, fz + 0.03], CLOCK, f);
        }
        s.quad([tx - 0.06, cy, fz + 0.06], [tx + 0.06, cy, fz + 0.06], [tx + 0.06, cy + 1.15, fz + 0.06], [tx - 0.06, cy + 1.15, fz + 0.06], IRON, f);
        s.quad([tx, cy - 0.06, fz + 0.06], [tx + 0.85, cy + 0.42, fz + 0.06], [tx + 0.85, cy + 0.54, fz + 0.06], [tx, cy + 0.06, fz + 0.06], IRON, f);
      }
    }
    // The spire, four slate faces to a point, snow lying on the faces in streaks; pinnacles at the corners.
    const sb = tTop - 0.5;
    const sh = 24;
    const r0 = TW / 2 - 0.3;
    const apex: V3 = [tx, sb + sh, tz];
    const corner = (i: number): V3 => [tx + (i === 0 || i === 3 ? -r0 : r0), sb, tz + (i < 2 ? -r0 : r0)];
    for (let i = 0; i < 4; i++) {
      const a = corner(i);
      const b = corner((i + 1) % 4);
      const mid: V3 = [(a[0] + b[0]) / 2 - tx, 0, (a[2] + b[2]) / 2 - tz];
      s.tri(a, b, apex, SLATE, [mid[0], 0.3, mid[2]]);
      // A tongue of snow up the lower third of each face.
      const t = 0.32;
      const a2: V3 = [a[0] + (apex[0] - a[0]) * t, a[1] + (apex[1] - a[1]) * t, a[2] + (apex[2] - a[2]) * t];
      const b2: V3 = [b[0] + (apex[0] - b[0]) * t, b[1] + (apex[1] - b[1]) * t, b[2] + (apex[2] - b[2]) * t];
      const lift = (v: V3): V3 => [v[0] + mid[0] * 0.012, v[1] + 0.04, v[2] + mid[2] * 0.012];
      s.quad(lift(a), lift(b), lift(b2), lift(a2), SNOW, [mid[0], 0.3, mid[2]]);
    }
    for (let i = 0; i < 4; i++) {
      const [px, , pz] = corner(i);
      const qx = tx + (px - tx) * 1.08;
      const qz = tz + (pz - tz) * 1.08;
      s.box(qx, sb - 0.3, qz, 0.8, 1.4, 0.8, CHURCH_D, 0);
      for (let j = 0; j < 4; j++) {
        const a: V3 = [qx + (j === 0 || j === 3 ? -0.4 : 0.4), sb + 1.1, qz + (j < 2 ? -0.4 : 0.4)];
        const b: V3 = [qx + ((j + 1) % 4 === 0 || (j + 1) % 4 === 3 ? -0.4 : 0.4), sb + 1.1, qz + ((j + 1) % 4 < 2 ? -0.4 : 0.4)];
        s.tri(a, b, [qx, sb + 3.4, qz], SLATE_L, [(a[0] + b[0]) / 2 - qx, 0.3, (a[2] + b[2]) / 2 - qz]);
      }
    }
    s.box(tx, sb + sh - 0.2, tz, 0.08, 1.6, 0.08, IRON, 0);
    s.box(tx + 0.35, sb + sh + 1.1, tz, 0.9, 0.18, 0.04, IRON, 0);
    // The churchyard on the hill each side: old stones leaning in the snow, a low wall round it.
    if (!low) {
      for (let i = 0; i < 46; i++) {
        const sd = i % 2 ? 1 : -1;
        const z = 4 + hash(i, 51) * 62;
        const e = 7.5 + hash(i, 52) * 16;
        const x = c.centerX(z) + sd * (c.halfWidth(z) + NAVE_EAVE + e);
        const y = hillY(c, z);
        const h = 0.6 + hash(i, 53) * 0.6;
        s.box(x, y - 0.3, z, 0.5, h + 0.3, 0.16, GRAVE, (hash(i, 54) - 0.5) * 0.4);
        s.box(x, y + h - 0.02, z, 0.52, 0.08, 0.2, SNOW, (hash(i, 54) - 0.5) * 0.4);
      }
    }
    for (const sd of [-1, 1] as const) {
      for (let z = 0; z < 76; z += 4) {
        const x0 = c.centerX(z) + sd * (c.halfWidth(z) + NAVE_EAVE + 25);
        const x1 = c.centerX(z + 4) + sd * (c.halfWidth(z + 4) + NAVE_EAVE + 25);
        const y0 = hillY(c, z);
        const y1 = hillY(c, z + 4);
        s.quad([x0, y0 - 0.5, z], [x1, y1 - 0.5, z + 4], [x1, y1 + 1, z + 4], [x0, y0 + 1, z], WALL_STONE, [-sd, 0, 0]);
        s.quad([x0 - sd * 0.2, y0 + 1, z], [x1 - sd * 0.2, y1 + 1, z + 4], [x1 + sd * 0.4, y1 + 1.12, z + 4], [x0 + sd * 0.4, y0 + 1.12, z], SNOW, [0, 1, 0]);
      }
    }
    // Bunting strung along both sides of the nave from pinnacle to pinnacle, past the run's limit, and the townsfolk
    // come up into the churchyard to see the riders off: the start is an occasion of the town's own.
    for (const sd of [-1, 1] as const) {
      for (let z = z0 + 3; z < z1 - 11.2; z += 7.2) {
        if (eave(z) - hillY(c, z) < 2.5 || eave(z + 7.2) - hillY(c, z + 7.2) < 2.5) continue;
        const xa = ex(z, sd) + sd * 0.8;
        const xb = ex(z + 7.2, sd) + sd * 0.8;
        const ya = top(z) + 1.6;
        const yb = top(z + 7.2) + 1.6;
        for (let i = 0; i < 8; i++) {
          const u = (i + 0.5) / 8;
          const x = xa + (xb - xa) * u;
          const zz = z + 7.2 * u;
          const y = ya + (yb - ya) * u - 0.9 * Math.sin(Math.PI * u);
          s.tri([x, y, zz - 0.3], [x, y, zz + 0.3], [x, y - 0.6, zz], BUNTING[(i + (sd > 0 ? 2 : 0)) % BUNTING.length], [-sd, 0, 0]);
        }
      }
    }
    this.piece(s, -40, 200, 'church', true);
    const p = getPalette('gablefall', Mood.None);
    const { coats, hats } = crowdColors('gablefall', p);
    const folk: StillFigure[] = [];
    for (let i = 0; i < (low ? 14 : 30); i++) {
      const sd = i % 2 ? 1 : -1;
      const z = 6 + hash(i, 141) * 46;
      const x = c.centerX(z) + sd * (c.halfWidth(z) + NAVE_EAVE + 3.5 + hash(i, 142) * 6);
      folk.push({ x, y: hillY(c, z) + 0.02, z: -z, face: -sd, coat: coats[i % coats.length], hat: hats[(i * 3) % hats.length] });
    }
    const m = new Mesh(stillCrowd(folk, 'gablefall', low ? LOW_BOLD : 1), this.mat);
    m.name = 'churchyard-folk';
    m.castShadow = false;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    this.root.add(m);
    this.pieces[this.pieces.length - 1]?.meshes.push(m);
  }

  // ------------------------------------------------------------------ the market squares

  /** The market at a stage line's square, where the charm gate stands (sim z `g`): a market hall either side past the
   *  limit, an arcade on the ground floor with stalls lit inside, timber-framed storeys over it and a steep roof; and
   *  between them, high over the square, the hall's gallery across the street on a beam, its three arched lights one
   *  over each of the gate's lanes (charms.ts laneX), so the gate's arches stand in the market's. Stalls under striped
   *  awnings and barrows round the square's edges. Nothing stands on the snow a sled rides. */
  private market(c: Course, g: number, low: boolean): void {
    const s = new Soup();
    const cx = c.centerX(g);
    const by = c.baseY(g);
    const inner = c.halfWidth(g) + c.edgeLimit(g) + 0.5;
    const HD = 18;
    const HH = 13;
    for (const sd of [-1, 1] as const) {
      const xIn = cx + sd * inner;
      const W = 11;
      const xc = xIn + sd * (W / 2);
      const out: V3 = [-sd, 0, 0];
      s.box(xc, by - 0.5, g, W, HH + 0.5, HD, MARKET, 0, false);
      // The arcade: four round-headed openings, dark, each with a lit stall inside.
      for (let i = 0; i < 4; i++) {
        const z = g - HD / 2 + 2.25 + i * 4.5;
        const fx = xIn - sd * 0.03;
        s.quad([fx, by, z - 1.5], [fx, by, z + 1.5], [fx, by + 3, z + 1.5], [fx, by + 3, z - 1.5], ARCADE, out);
        for (let j = 0; j < 6; j++) {
          const a0 = Math.PI - (j / 6) * Math.PI;
          const a1 = Math.PI - ((j + 1) / 6) * Math.PI;
          s.tri([fx, by + 3, z], [fx, by + 3 + Math.sin(a0) * 1.5, z + Math.cos(a0) * 1.5], [fx, by + 3 + Math.sin(a1) * 1.5, z + Math.cos(a1) * 1.5], ARCADE, out);
        }
        s.quad([fx - sd * 0.01, by + 0.9, z - 1.0], [fx - sd * 0.01, by + 0.9, z + 1.0], [fx - sd * 0.01, by + 1.9, z + 1.0], [fx - sd * 0.01, by + 1.9, z - 1.0], LIT, out);
      }
      // Timber framing on the storeys over it: posts, rails and braces in a dark timber over the plaster.
      for (let i = 0; i <= 6; i++) {
        const z = g - HD / 2 + i * (HD / 6);
        s.quad([xIn - sd * 0.04, by + 4.6, z - 0.12], [xIn - sd * 0.04, by + 4.6, z + 0.12], [xIn - sd * 0.04, by + HH, z + 0.12], [xIn - sd * 0.04, by + HH, z - 0.12], TIMBER, out);
        if (i < 6) {
          for (const y of [4.6, 8.6]) {
            const zz = z + HD / 12;
            s.quad([xIn - sd * 0.05, by + y + 0.4, zz - 0.8], [xIn - sd * 0.05, by + y + 0.4, zz + 0.8], [xIn - sd * 0.05, by + y + 1.8, zz + 0.8], [xIn - sd * 0.05, by + y + 1.8, zz - 0.8], hash(Math.floor(z), Math.floor(y) + sd) < 0.65 ? LIT : DARK, out);
          }
        }
      }
      // Braces in the bays' lower corners, so the framing is carpentry and not a ruled grid.
      for (let i = 0; i < 6; i++) {
        const za = g - HD / 2 + i * (HD / 6) + 0.12;
        const zb = za + HD / 6 - 0.24;
        for (const y of [4.6, 8.6]) {
          const bx2 = xIn - sd * 0.05;
          s.quad([bx2, by + y + 0.15, za], [bx2, by + y + 0.15, za + 0.18], [bx2, by + y + 1.25, za + 0.95], [bx2, by + y + 1.25, za + 0.77], TIMBER, out);
          s.quad([bx2, by + y + 0.15, zb], [bx2, by + y + 0.15, zb - 0.18], [bx2, by + y + 1.25, zb - 0.95], [bx2, by + y + 1.25, zb - 0.77], TIMBER, out);
        }
      }
      for (const y of [4.5, 8.5, HH - 0.2]) s.quad([xIn - sd * 0.04, by + y - 0.12, g - HD / 2], [xIn - sd * 0.04, by + y - 0.12, g + HD / 2], [xIn - sd * 0.04, by + y + 0.12, g + HD / 2], [xIn - sd * 0.04, by + y + 0.12, g - HD / 2], TIMBER, out);
      s.gable(xc, by + HH, g, W, HD, W * 0.62, 0.45, SLATE, MARKET, 0);
      s.gable(xc, by + HH + 0.14 + W * 0.1, g, W * 0.84, HD, W * 0.5, 0.42, SNOW, null, 0);
      // A little bell-cote on the ridge.
      s.box(xc, by + HH + W * 0.6, g, 1.4, 1.8, 1.4, TIMBER, 0);
      s.gable(xc, by + HH + W * 0.6 + 1.8, g, 1.6, 1.6, 1.2, 0.2, SLATE, null, Math.PI / 2);
    }
    // The gallery across the square: a timber-framed bridge-house on a deep beam, its underside well over any sled.
    const span = inner * 2;
    const yb = by + GALLERY_UNDER;
    const GD = 6;
    s.box(cx, yb, g, span, 0.9, GD + 0.4, TIMBER, 0);
    s.box(cx, yb + 0.9, g, span, 4.6, GD, MARKET, 0, false);
    // (Its faces framed in timber like the halls', posts between and either side of its three lights: a plain plastered
    // face read to the second critic as an untextured box.)
    for (const f of [-1, 1] as const) {
      const zf = g + f * (GD / 2 + 0.035);
      for (const px of [-span / 2 + 0.2, -LANE_W * 1.5, -LANE_W * 0.5, LANE_W * 0.5, LANE_W * 1.5, span / 2 - 0.2]) s.quad([cx + px - 0.12, yb + 0.9, zf], [cx + px + 0.12, yb + 0.9, zf], [cx + px + 0.12, yb + 5.5, zf], [cx + px - 0.12, yb + 5.5, zf], TIMBER, [0, 0, f]);
      s.quad([cx - span / 2, yb + 5.3, zf], [cx + span / 2, yb + 5.3, zf], [cx + span / 2, yb + 5.55, zf], [cx - span / 2, yb + 5.55, zf], TIMBER, [0, 0, f]);
      for (const sgn of [-1, 1]) {
        const x0 = cx + sgn * (LANE_W * 1.5 + 0.2);
        const x1 = cx + sgn * (span / 2 - 0.4);
        s.quad([x0, yb + 1.2, zf], [x0 + sgn * 0.25, yb + 1.2, zf], [x1, yb + 5.0, zf], [x1 - sgn * 0.25, yb + 5.0, zf], TIMBER, [0, 0, f]);
      }
    }
    s.gable(cx, yb + 5.5, g, GD, span + 0.6, 2.8, 0.4, SLATE, MARKET, Math.PI / 2);
    s.gable(cx, yb + 5.64 + 0.3, g, GD * 0.84, span + 0.6, 2.3, 0.38, SNOW, null, Math.PI / 2);
    // The underside, seen from the run: a dark soffit with the beams across it.
    s.quad([cx - span / 2, yb - 0.01, g - GD / 2 - 0.2], [cx + span / 2, yb - 0.01, g - GD / 2 - 0.2], [cx + span / 2, yb - 0.01, g + GD / 2 + 0.2], [cx - span / 2, yb - 0.01, g + GD / 2 + 0.2], TIMBER, [0, -1, 0]);
    // Three arched lights in each face, one over each lane of the gate.
    for (const f of [-1, 1] as const) {
      const fz = g + f * (GD / 2 + 0.03);
      const fo: V3 = [0, 0, f];
      for (let lane = 0; lane < 3; lane++) {
        const lx = cx + (lane - 1) * LANE_W;
        const y0 = yb + 1.5;
        const y1 = yb + 3.6;
        const hw = 1.25;
        s.quad([lx - hw - 0.25, y0 - 0.25, fz], [lx + hw + 0.25, y0 - 0.25, fz], [lx + hw + 0.25, y1, fz], [lx - hw - 0.25, y1, fz], TIMBER, fo);
        s.quad([lx - hw, y0, fz + f * 0.02], [lx + hw, y0, fz + f * 0.02], [lx + hw, y1, fz + f * 0.02], [lx - hw, y1, fz + f * 0.02], LIT, fo);
        for (let j = 0; j < 8; j++) {
          const a0 = (j / 8) * Math.PI;
          const a1 = ((j + 1) / 8) * Math.PI;
          s.tri([lx, y1, fz + f * 0.02], [lx + Math.cos(a0) * hw, y1 + Math.sin(a0) * hw, fz + f * 0.02], [lx + Math.cos(a1) * hw, y1 + Math.sin(a1) * hw, fz + f * 0.02], LIT, fo);
          s.tri([lx, y1, fz], [lx + Math.cos(a0) * (hw + 0.25), y1 + Math.sin(a0) * (hw + 0.25), fz], [lx + Math.cos(a1) * (hw + 0.25), y1 + Math.sin(a1) * (hw + 0.25), fz], TIMBER, fo);
        }
      }
    }
    // Stalls under striped awnings and barrows round the square's edges, past the limit.
    const sq = c.section(g);
    for (const sd of [-1, 1] as const) {
      for (let z = sq.z0 + 26, i = 0; z < sq.z1 - 24; z += low ? 14 : 8, i++) {
        if (Math.abs(z - g) < HD / 2 + 3) continue;
        const x = c.centerX(z) + sd * (c.halfWidth(z) + c.edgeLimit(z) + 1.6);
        const y = c.baseY(z) + LANE - 0.1;
        const id = Math.floor(z) * 2 + (sd > 0 ? 1 : 0);
        if (hash(id, 61) < 0.68) {
          // A stall: a counter with goods on it, posts, and an awning sloping toward the square in two stripes.
          s.box(x, y, z, 1.4, 1.0, 2.6, TIMBER, 0);
          s.box(x, y + 1.0, z, 1.2, 0.25, 2.4, GOODS[Math.floor(hash(id, 62) * GOODS.length)], 0);
          for (const zz of [z - 1.2, z + 1.2]) s.box(x + sd * 0.55, y, zz, 0.1, 2.5, 0.1, TIMBER, 0);
          const stripe = AWNINGS[Math.floor(hash(id, 63) * AWNINGS.length)];
          for (let k = 0; k < 4; k++) {
            const za = z - 1.45 + k * 0.725;
            const zb = za + 0.725;
            s.quad([x + sd * 0.75, y + 2.5, za], [x + sd * 0.75, y + 2.5, zb], [x - sd * 0.9, y + 2.05, zb], [x - sd * 0.9, y + 2.05, za], k % 2 ? stripe : CANVAS, [-sd * 0.3, 1, 0]);
          }
          s.quad([x + sd * 0.73, y + 2.55, z - 1.45], [x + sd * 0.73, y + 2.55, z + 1.45], [x - sd * 0.9, y + 2.12, z + 1.45], [x - sd * 0.9, y + 2.12, z - 1.45], SNOW, [-sd * 0.3, 1, 0]);
        } else {
          // A barrow: a box on two wheels, its shafts down on the snow.
          s.box(x, y + 0.45, z, 1.0, 0.55, 1.6, TIMBER, 0);
          s.box(x, y + 1.0, z, 0.9, 0.12, 1.5, SNOW, 0);
          for (const xx of [-0.55, 0.55]) s.box(x + xx, y, z + 0.2, 0.08, 0.8, 0.8, IRON, 0);
          s.box(x, y + 0.3, z - 1.3, 0.8, 0.08, 1.2, TIMBER, 0);
        }
      }
    }
    this.piece(s, sq.z0 - 40, sq.z1 + 40, 'market', true);
  }

  // ------------------------------------------------------------------ the quay, the river and the bridge

  /** The river at the foot of the town: the quay's stone wall along the town's side with its houses tall and narrow,
   *  their steep gables to the river; the boathouse at the quay's head, where the last roofs come down to the ice; the far
   *  bank low across the ice with its sheds; and at the line the old stone bridge over the river, its great middle arch
   *  over the run, a gatehouse at its town end, the townsfolk on it, and the line's checks on the ice under it. In
   *  daylight and the snowfall: no grandstands, no arch with a board, no lamplit square. */
  private quay(c: Course, low: boolean): void {
    const s = new Soup();
    const pl = placesOf(c);
    const fz = c.finishZ;
    const zA = pl.quay - 20;
    const zB = fz + 230;
    // The quay's wall along the town's side, and the houses on it.
    for (let z = zA; z < zB; z += 4) {
      const zb = z + 4;
      const xa = c.centerX(z) - c.halfWidth(z) - c.edgeLimit(z) - 0.05;
      const xb = c.centerX(zb) - c.halfWidth(zb) - c.edgeLimit(zb) - 0.05;
      const ya = c.baseY(z);
      const yb = c.baseY(zb);
      s.quad([xa, ya - 0.6, z], [xb, yb - 0.6, zb], [xb, yb + QUAY_TOP, zb], [xa, ya + QUAY_TOP, z], Math.floor(z / 4) % 2 ? WALL_STONE : WALL_STONE_D, [1, 0, 0]);
      s.quad([xa, ya + QUAY_TOP, z], [xb, yb + QUAY_TOP, zb], [xb - 1.2, yb + QUAY_TOP + 0.12, zb], [xa - 1.2, ya + QUAY_TOP + 0.12, z], SNOW, [0, 1, 0]);
      if (!low && Math.floor(z / 4) % 3 === 0) s.box(xa - 0.8, ya + QUAY_TOP, z + 2, 0.4, 0.6, 0.4, IRON, 0);
    }
    for (let z = zA + 34, i = 0; z < zB; i++) {
      const L = 6 + hash(i, 71) * 3;
      const zc = z + L / 2;
      z += L + 0.3;
      if (Math.abs(zc - fz) < 14) continue;
      const x = c.centerX(zc) - c.halfWidth(zc) - c.edgeLimit(zc) - 5.5;
      const y = c.baseY(zc) + QUAY_TOP;
      const H = 8 + hash(i, 72) * 5;
      const wall = WALLS[Math.floor(hash(i, 73) * WALLS.length)];
      s.box(x - 4, y - 0.3, zc, 8, H, L, wall, 0, false);
      // A steep gable to the river: the ridge across it.
      s.gable(x - 4, y - 0.3 + H, zc, L, 8, L * 0.85, 0.3, SLATE, wall, Math.PI / 2);
      s.gable(x - 4, y - 0.3 + H + 0.14 + L * 0.12, zc, L * 0.82, 8, L * 0.7, 0.28, SNOW, null, Math.PI / 2);
      for (let st = 0; st < 3; st++) {
        for (let j = 0; j < 2; j++) {
          if (hash(i + j * 7, st + 74) < 0.35) continue;
          const wz = zc + (j - 0.5) * (L * 0.45);
          const y0 = y + 1.2 + st * 2.8;
          if (y0 + 1.3 > y + H - 0.4) continue;
          s.quad([x + 0.03, y0, wz - 0.45], [x + 0.03, y0, wz + 0.45], [x + 0.03, y0 + 1.3, wz + 0.45], [x + 0.03, y0 + 1.3, wz - 0.45], LIT, [1, 0, 0]);
        }
      }
    }
    // The boathouse at the quay's head, on the town's side: a timber shed on stone, its big doors onto the ice, a steep
    // roof; the last row's roofs come down beside it.
    {
      const z = pl.quay + 4;
      const x = c.centerX(z) - c.halfWidth(z) - c.edgeLimit(z) - 6.5;
      const y = c.baseY(z);
      s.box(x, y - 0.6, z, 12, 1.8, 16, WALL_STONE, 0, false);
      s.box(x, y + 1.2, z, 12, 5.5, 16, BOATHOUSE, 0, false);
      s.gable(x, y + 6.7, z, 12, 16, 6.5, 0.5, SLATE, BOATHOUSE, 0);
      s.gable(x, y + 6.86 + 1.2, z, 10, 16, 5.2, 0.45, SNOW, null, 0);
      s.quad([x + 6.02, y, z - 3], [x + 6.02, y, z + 3], [x + 6.02, y + 4.6, z + 3], [x + 6.02, y + 4.6, z - 3], TIMBER, [1, 0, 0]);
      s.quad([x + 6.04, y + 5, z - 1], [x + 6.04, y + 5, z + 1], [x + 6.04, y + 6.2, z + 1], [x + 6.04, y + 6.2, z - 1], LIT, [1, 0, 0]);
    }
    // The far bank across the ice: its sheds and houses low along it, a few windows lit.
    for (let z = pl.quay, i = 0; z < zB; i++) {
      const L = 7 + hash(i, 81) * 5;
      const zc = z + L / 2;
      z += L + 2 + hash(i, 82) * 6;
      const x = c.centerX(zc) + RIVER_FAR + 14 + hash(i, 83) * 8;
      const y = c.baseY(zc) + 8.2 + 0.04 * (x - c.centerX(zc) - RIVER_FAR);
      this.house(s, x, y, zc, 8, L, 9000 + i, 1, 1, low);
    }
    // The old stone bridge at the line: a great segmental arch over the run, two more over the river, its piers with
    // cutwaters, a deck under snow with low parapets and lamps, and a gatehouse at its town end.
    const bx = c.centerX(fz);
    const by = c.baseY(fz);
    const spans: Array<[number, number, number, number]> = [
      [-BRIDGE_HALF, BRIDGE_HALF, by + 7, by + 12.2],
      [BRIDGE_HALF + 2.5, 41.8, by + 4.5, by + 10.5],
      [44.2, RIVER_FAR + 4, by + 4, by + 10],
    ];
    const deck = by + 14.2;
    const BD = 8;
    for (const [a0, a1, spring, crown] of spans) {
      const n = 14;
      for (const f of [-1, 1] as const) {
        const zf = fz + f * (BD / 2);
        // The spandrel: from the arch's curve up to the deck, between this arch's ends.
        for (let i = 0; i < n; i++) {
          const u0 = i / n;
          const u1 = (i + 1) / n;
          const xa = a0 + (a1 - a0) * u0;
          const xb = a0 + (a1 - a0) * u1;
          const ya = spring + (crown - spring) * (1 - (2 * u0 - 1) * (2 * u0 - 1));
          const yb = spring + (crown - spring) * (1 - (2 * u1 - 1) * (2 * u1 - 1));
          s.quad([bx + xa, ya, zf], [bx + xb, yb, zf], [bx + xb, deck, zf], [bx + xa, deck, zf], BRIDGE, [0, 0, f]);
          // The voussoirs: a darker ring round the arch.
          s.quad([bx + xa, ya - 0.02, zf + f * 0.04], [bx + xb, yb - 0.02, zf + f * 0.04], [bx + xb, yb + 0.9, zf + f * 0.04], [bx + xa, ya + 0.9, zf + f * 0.04], BRIDGE_D, [0, 0, f]);
          // The arch's soffit, seen from under it.
          if (f === 1) s.quad([bx + xa, ya, fz - BD / 2], [bx + xb, yb, fz - BD / 2], [bx + xb, yb, fz + BD / 2], [bx + xa, ya, fz + BD / 2], BRIDGE_D, [0, -1, 0]);
        }
      }
    }
    // The stone's courses on both faces: thin dark joints every 0.9 m over the arches' crowns to the deck, and up the
    // piers and abutments (an untextured face read to the sort's critic as concrete).
    for (const f of [-1, 1] as const) {
      const zf = fz + f * (BD / 2 + 0.03);
      for (let y = spans[0][3] + 1.3; y < deck - 0.6; y += 0.9) s.quad([bx - BRIDGE_HALF - 9, y, zf], [bx + RIVER_FAR + 14, y, zf], [bx + RIVER_FAR + 14, y + 0.07, zf], [bx - BRIDGE_HALF - 9, y + 0.07, zf], BRIDGE_D, [0, 0, f]);
      for (const [p0, p1, y0] of [[-BRIDGE_HALF - 2.4, -BRIDGE_HALF, by], [BRIDGE_HALF + 0.1, BRIDGE_HALF + 2.5, by], [41.8, 44.2, by], [-BRIDGE_HALF - 9, -BRIDGE_HALF - 2.4, by + QUAY_TOP]] as Array<[number, number, number]>) {
        for (let y = y0 + 0.6; y < spans[0][3] + 1.2; y += 0.9) s.quad([bx + p0, y, zf], [bx + p1, y, zf], [bx + p1, y + 0.07, zf], [bx + p0, y + 0.07, zf], BRIDGE_D, [0, 0, f]);
      }
    }
    // The piers between the arches (outside the run), with a cutwater upstream and down.
    for (const px of [-BRIDGE_HALF - 1.2, BRIDGE_HALF + 1.3, 43]) {
      s.box(bx + px, by - 1, fz, 2.4, spans[0][2] - by + 1.2, BD, BRIDGE, 0, false);
      for (const f of [-1, 1]) s.box(bx + px, by - 1, fz + f * (BD / 2 + 0.9), 1.6, 3.2, 1.8, BRIDGE_D, Math.PI / 4);
    }
    // The deck's face course, parapets with snow on them, the deck's snow, and a lamp on each pier's parapet.
    const xL = -BRIDGE_HALF - 9;
    const xR = RIVER_FAR + 14;
    // (Its abutments: on the quay at the town's end, on the far bank at the other.)
    s.box(bx + (xL - BRIDGE_HALF - 2.4) / 2, by + QUAY_TOP - 0.5, fz, -BRIDGE_HALF - 2.4 - xL, deck - by - QUAY_TOP + 0.5, BD, BRIDGE, 0, false);
    s.box(bx + (RIVER_FAR + 4 + xR) / 2, by - 0.5, fz, xR - RIVER_FAR - 4, deck - by + 0.5, BD, BRIDGE, 0, false);
    for (const f of [-1, 1] as const) {
      const zf = fz + f * (BD / 2 + 0.05);
      s.quad([bx + xL, deck - 0.5, zf], [bx + xR, deck - 0.5, zf], [bx + xR, deck, zf], [bx + xL, deck, zf], BRIDGE_D, [0, 0, f]);
      s.box(bx + (xL + xR) / 2, deck, fz + f * (BD / 2 - 0.3), xR - xL, 1.05, 0.6, BRIDGE, 0);
      s.box(bx + (xL + xR) / 2, deck + 1.05, fz + f * (BD / 2 - 0.3), xR - xL, 0.12, 0.66, SNOW, 0);
      for (const px of [-BRIDGE_HALF - 1.2, BRIDGE_HALF + 1.3, 43]) {
        s.box(bx + px, deck + 1.05, fz + f * (BD / 2 - 0.3), 0.18, 2.4, 0.18, IRON, 0);
        s.box(bx + px, deck + 3.2, fz + f * (BD / 2 - 0.3), 0.42, 0.55, 0.42, LIT, 0);
        if (f < 0) this.lamps.push([bx + px, deck + 3.4, fz - BD / 2, 16]);
        s.box(bx + px, deck + 3.75, fz + f * (BD / 2 - 0.3), 0.5, 0.1, 0.5, IRON, 0);
      }
    }
    s.box(bx + (xL + xR) / 2, deck - 0.02, fz, xR - xL, 0.14, BD - 1.2, SNOW, 0);
    // The line's cloth: a long banner of ink and cream checks hung from the parapet over the great arch's crown, toward
    // the riders coming down, sagging a little between its ties (the line's own checks, ART.md 12; no board, no word).
    {
      const zf = fz - BD / 2 - 0.12;
      const half = 11;
      const nC = 20;
      const top = deck + 0.9;
      for (let r = 0; r < 3; r++) {
        for (let i = 0; i < nC; i++) {
          const u0 = i / nC;
          const u1 = (i + 1) / nC;
          const sag = (u: number): number => 0.35 * Math.sin(Math.PI * u);
          const xa = bx - half + 2 * half * u0;
          const xb = bx - half + 2 * half * u1;
          const ya = top - sag(u0) - r * 1.0;
          const yb = top - sag(u1) - r * 1.0;
          s.quad([xa, ya - 1.0, zf], [xb, yb - 1.0, zf], [xb, yb, zf], [xa, ya, zf], (i + r) % 2 ? CREAM : INK, [0, 0, -1]);
        }
      }
    }
    // Bunting along both parapets the bridge's length, sagging between its lamps: the town's festival, never a sign.
    for (const f of [-1, 1] as const) {
      const zf = fz + f * (BD / 2 + 0.16);
      const posts = [xL, -BRIDGE_HALF - 1.2, BRIDGE_HALF + 1.3, 43, xR];
      for (let k = 0; k + 1 < posts.length; k++) {
        const a0 = posts[k];
        const a1 = posts[k + 1];
        const n = Math.max(2, Math.floor((a1 - a0) / 0.9));
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n;
          const x = bx + a0 + (a1 - a0) * u;
          const y = deck + 3.0 - 1.4 * Math.sin(Math.PI * u);
          if (Math.abs(x - bx) < 11.5 && f < 0) continue;
          s.tri([x - 0.32, y, zf], [x + 0.32, y, zf], [x, y - 0.7, zf], BUNTING[(i + k) % BUNTING.length], [0, 0, f]);
        }
      }
    }
    // The gatehouse at the town's end: a square tower over the bridge's end, an arch through it, a steep hipped cap.
    {
      const gx = bx + xL - 4;
      s.box(gx, by + QUAY_TOP - 0.5, fz, 9, deck - by - QUAY_TOP + 9.5, 10, BRIDGE, 0, false);
      const top = deck + 9;
      s.gable(gx, top, fz, 9, 10, 7, 0.5, SLATE, BRIDGE, 0);
      s.gable(gx, top + 0.16 + 1.4, fz, 7.6, 10, 5.8, 0.45, SNOW, null, 0);
      for (const f of [-1, 1] as const) {
        const zf = fz + f * 5.03;
        s.quad([gx - 1.2, deck + 3.5, zf], [gx + 1.2, deck + 3.5, zf], [gx + 1.2, deck + 5.5, zf], [gx - 1.2, deck + 5.5, zf], LIT, [0, 0, f]);
      }
      s.quad([gx + 4.53, deck, fz - 2], [gx + 4.53, deck, fz + 2], [gx + 4.53, deck + 4.5, fz + 2], [gx + 4.53, deck + 4.5, fz - 2], ARCADE, [1, 0, 0]);
    }
    // The line: four rows of big ink and cream checks across the run's ice under the bridge (ART.md 12's line).
    const hwL = c.halfWidth(fz);
    const sq = 1.1;
    const nq = Math.floor((hwL * 2) / sq);
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < nq; i++) {
        const za = fz + row * sq;
        const zb = za + sq;
        const pt = (dd: number, zz: number): V3 => {
          const x = c.centerX(zz) - hwL + dd;
          return [x, c.ground(x, zz) + 0.035, zz];
        };
        s.quad(pt(i * sq, za), pt((i + 1) * sq, za), pt((i + 1) * sq, zb), pt(i * sq, zb), (i + row) % 2 ? CREAM : INK, [0, 1, 0]);
      }
    }
    this.piece(s, zA - 60, zB + 400, 'quay', true);
    // The townsfolk on the bridge's parapet and along the quay to see the line crossed, still, in their winter wool
    // (crowd.ts stillCrowd, one draw; Low fewer and bolder).
    const p = getPalette('gablefall', Mood.None);
    const { coats, hats } = crowdColors('gablefall', p);
    const folk: StillFigure[] = [];
    let k = 0;
    for (let x = xL + 2; x < xR - 2; x += 1.15) {
      k++;
      if (low && k % 2) continue;
      if (hash(k, 91) < 0.25) continue;
      const f = hash(k, 92) < 0.5 ? -1 : 1;
      folk.push({ x: bx + x, y: deck + 0.05, z: -(fz + f * (BD / 2 - 1.1)), face: 0, coat: coats[k % coats.length], hat: hats[(k * 3) % hats.length] });
    }
    for (let z = fz - 110; z < fz + 20; z += 2.6) {
      k++;
      if (low && k % 2) continue;
      if (hash(k, 93) < 0.3 || Math.abs(z - fz) < 8) continue;
      const x = c.centerX(z) - c.halfWidth(z) - c.edgeLimit(z) - 0.9 - hash(k, 94) * 1.2;
      folk.push({ x, y: c.baseY(z) + QUAY_TOP + 0.12, z: -z, face: 1, coat: coats[k % coats.length], hat: hats[(k * 5) % hats.length] });
    }
    if (folk.length) {
      const m = new Mesh(stillCrowd(folk, 'gablefall', low ? LOW_BOLD : 1), this.mat);
      m.name = 'onlookers';
      m.castShadow = false;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      this.root.add(m);
      const q = this.pieces[this.pieces.length - 1];
      if (q) q.meshes.push(m);
    }
  }

  // ------------------------------------------------------------------ across the valley

  /** The far side of the valley past the river: its hillside rising out of the snowfall's haze, the town's other half on
   *  its lower slopes (houses with steep roofs and lit windows, a church's spire), and the railway viaduct striding across
   *  the valley on its tall arches in front of it. Seen from the head of the town down the whole run, a pale ghost in the
   *  snow (the haze material). One draw. */
  private valley(c: Course, low: boolean): void {
    const s = new Soup();
    const fz = c.finishZ;
    const cx = c.centerX(fz);
    const y0 = c.baseY(fz) - 1;
    // The floor of the valley past the run's end and the far hillside, rising and rolling.
    const hill = (x: number, z: number): number => {
      const u = Math.max(0, z - (fz + 520));
      return y0 + 0.24 * u + 30 * smooth01(u / 300) + 18 * Math.sin(x * 0.0042 + 1.3) * smooth01(u / 400) + 9 * Math.sin(x * 0.011 + z * 0.004);
    };
    const X0 = cx - 2600;
    const X1 = cx + 2600;
    const nx = low ? 30 : 56;
    const zs = [fz + 300, fz + 480, fz + 560, fz + 660, fz + 800, fz + 980, fz + 1200, fz + 1500, fz + 1900, fz + 2400];
    for (let j = 0; j + 1 < zs.length; j++) {
      for (let i = 0; i < nx; i++) {
        const xa = X0 + ((X1 - X0) * i) / nx;
        const xb = X0 + ((X1 - X0) * (i + 1)) / nx;
        const za = zs[j];
        const zb = zs[j + 1];
        s.quad([xa, hill(xa, za), za], [xb, hill(xb, za), za], [xb, hill(xb, zb), zb], [xa, hill(xa, zb), zb], SNOW_FAR, [0, 1, -0.2]);
      }
    }
    // The town's other half on the hill's lower slopes: terraces along the contours, each a long block under one roof with
    // a cross gable here and there, stepping up from the river and breaking as they climb. (House by house at that
    // distance they read to the second critic as speckle; a terrace is one shape with a roofline.)
    const rowsN = low ? 4 : 6;
    for (let j = 0; j < rowsN; j++) {
      const z = fz + 570 + j * 52 + hash(j, 110) * 10;
      const span = 700 + j * 120;
      for (let x = cx - span, i = 0; x < cx + span; i++) {
        const id = j * 1000 + i;
        const len = 40 + hash(id, 113) * 70;
        const xc = x + len / 2;
        x += len + 10 + hash(id, 119) * (20 + j * 18);
        const y = Math.min(hill(xc - len / 2, z), hill(xc + len / 2, z));
        const d = 10 + hash(id, 114) * 3;
        const H = 7 + hash(id, 115) * 3;
        const wall = WALLS_FAR[Math.floor(hash(id, 116) * WALLS_FAR.length)];
        s.box(xc, y - 4, z, len, H + 4, d, wall, 0, false);
        s.gable(xc, y + H, z, d, len, d * 0.6, 0.3, SNOW_FAR, wall, Math.PI / 2);
        if (!low && hash(id, 117) < 0.6) s.gable(xc + (hash(id, 118) - 0.5) * len * 0.6, y + H, z - 1, 8, d + 2, 5, 0.3, SNOW_FAR, wall, 0);
        // A few lit windows along its face toward the run.
        for (let k = 0; k < len / 9; k++) if (hash(id + k, 123) < 0.3) s.quad([xc - len / 2 + 4 + k * 9, y + 2, z - d / 2 - 0.05], [xc - len / 2 + 5.6 + k * 9, y + 2, z - d / 2 - 0.05], [xc - len / 2 + 5.6 + k * 9, y + 3.6, z - d / 2 - 0.05], [xc - len / 2 + 4 + k * 9, y + 3.6, z - d / 2 - 0.05], LIT, [0, 0, -1]);
      }
    }
    // Its church, its spire over the roofs.
    {
      const z = fz + 760;
      const x = cx - 260;
      const y = hill(x, z);
      s.box(x, y - 2, z, 9, 30, 9, WALLS_FAR[0], 0, false);
      for (let i = 0; i < 4; i++) {
        const a: V3 = [x + (i === 0 || i === 3 ? -4.5 : 4.5), y + 28, z + (i < 2 ? -4.5 : 4.5)];
        const b: V3 = [x + ((i + 1) % 4 === 0 || (i + 1) % 4 === 3 ? -4.5 : 4.5), y + 28, z + ((i + 1) % 4 < 2 ? -4.5 : 4.5)];
        s.tri(a, b, [x, y + 52, z], SLATE_FAR, [(a[0] + b[0]) / 2 - x, 0.3, (a[2] + b[2]) / 2 - z]);
      }
    }
    // The viaduct across the valley in front of it: tall piers, round arches between them, a deck with a parapet.
    const vz = fz + 430;
    const vy = y0 + 46;
    const vx0 = cx - 1500;
    const vx1 = cx + 1500;
    const pitch = 34;
    for (let x = vx0; x < vx1; x += pitch) {
      const pyB = y0 - 2 + Math.max(0, Math.abs(x - cx) - 700) * 0.1;
      if (pyB > vy - 8) continue;
      s.box(x, pyB, vz, 4.4, vy - pyB, 7, VIADUCT, 0, false);
      if (!low) for (let y = pyB + 3; y < vy - 1; y += 3.2) s.quad([x - 2.22, y, vz - 3.52], [x + 2.22, y, vz - 3.52], [x + 2.22, y + 0.35, vz - 3.52], [x - 2.22, y + 0.35, vz - 3.52], VIADUCT_D, [0, 0, -1]);
      // The arch to the next pier: its ring and the spandrel to the deck, both faces.
      const r = (pitch - 4.4) / 2;
      const ax = x + 2.2 + r;
      const ay = vy - 4 - r;
      for (const f of [-1, 1]) {
        const zf = vz + f * 3.5;
        for (let j = 0; j < (low ? 5 : 8); j++) {
          const m = low ? 5 : 8;
          const a0 = Math.PI - (j / m) * Math.PI;
          const a1 = Math.PI - ((j + 1) / m) * Math.PI;
          const p0: V3 = [ax + Math.cos(a0) * r, ay + Math.sin(a0) * r, zf];
          const p1: V3 = [ax + Math.cos(a1) * r, ay + Math.sin(a1) * r, zf];
          s.quad(p0, p1, [p1[0], vy, zf], [p0[0], vy, zf], VIADUCT, [0, 0, f]);
        }
      }
    }
    s.box((vx0 + vx1) / 2, vy, vz, vx1 - vx0, 2.2, 7.6, VIADUCT_D, 0);
    s.box((vx0 + vx1) / 2, vy + 2.2, vz, vx1 - vx0, 0.3, 7.8, SNOW_FAR, 0);
    const g = s.geometry();
    this.tris.valley = s.tris;
    const m = new Mesh(g, this.haze);
    m.name = 'valley';
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    m.renderOrder = -6;
    this.root.add(m);
    this.valleyMesh = m;
  }

  // ------------------------------------------------------------------ smoke

  /** About half the chimneys smoke (ART.md 12): a column of soft puffs over each, leaning down the wind. */
  private smoke(c: Course, low: boolean): void {
    const pos: number[] = [];
    const puff: number[] = [];
    const per = low ? 3 : 4;
    const end = placesOf(c).quay;
    for (let k = 0; k * 64 < end; k++) {
      for (const o of c.chunk(k).obstacles) {
        if (o.kind !== 'chimney' || hash(o.id, 121) < 0.5) continue;
        for (let i = 0; i < per; i++) {
          const ph = i / per + hash(o.id, i + 122) * 0.15;
          for (let q = 0; q < 4; q++) {
            pos.push(o.x, o.y + o.h + 0.1, -o.z);
            puff.push(ph, 1, 0.75 + hash(o.id, 123) * 0.35, q);
          }
        }
      }
    }
    if (!pos.length) return;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aPuff', new BufferAttribute(new Float32Array(puff), 4));
    const idx: number[] = [];
    for (let i = 0; i < pos.length / 12; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 3, i * 4, i * 4 + 3, i * 4 + 2);
    g.setIndex(idx);
    const m = new Mesh(g, this.smokeMat);
    m.name = 'smoke';
    m.frustumCulled = false;
    m.renderOrder = 2;
    this.root.add(m);
    this.smokeMesh = m;
  }

  // ------------------------------------------------------------------ each frame

  update(_dt: number, _time: number, _mode: ViewMode, s: Snap, _sim: Sim | null, _camera: PerspectiveCamera, p: Palette): void {
    if (!this.course) return;
    const reach = REACH[this.detail];
    for (const g of this.pieces) {
      const on = s.z > g.z0 - reach && s.z < g.z1 + BEHIND;
      for (const m of g.meshes) m.visible = on;
    }
    const lampK = Math.min(1, shared.uLampK.value as number);
    // The windows: a little light behind the glass all afternoon in the snowfall, lamplit as the day goes (glowing
    // orange by day they read to the first critic as stickers, ART.md 12: windows glow from dusk).
    const lampHour = Math.min(1.6, shared.uLampK.value as number);
    this.mat.uniforms.uEmissiveStrength.value = 0.14 + 0.85 * Math.max(0, Math.min(1, (lampHour - 0.5) / 0.9));
    // (The far side takes the hour's light, and its haze leans a step toward the far plane's own colour so it parts from
    // the sky: at the fog's colour alone the first critic found the far plain and the sky one value.)
    (this.haze.uniforms.uHaze.value as Color).copy(p.fog).lerp(p.air.far, 0.22);
    (this.haze.uniforms.uLight.value as Color).copy(p.snowLit);
    this.haze.uniforms.uGlowK.value = 0.45 + 0.4 * lampK;
    // The lamps' light on the snow by them: a street of soft amber pools with the grey between, stronger as the day goes.
    const pool = 0.12 + 0.16 * Math.max(0, Math.min(1, (lampHour - 0.4) / 1));
    for (const [x, y, z, r] of this.lamps) if (z > s.z - 20 && z < s.z + 120) pushLocalLight(x, y, -z, LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, r * 0.8, pool);
    // (A step under the sky's own grey, so it reads against it: in the clouds' pale it did not show at all.)
    (this.smokeMat.uniforms.uLit.value as Color).copy(p.fog).lerp(p.snowShade, 0.2);
    (this.smokeMat.uniforms.uShade.value as Color).copy(p.snowShade).lerp(p.snowDeep, 0.25);
    this.smokeMat.uniforms.uLive.value = reduced() ? 0 : 1;
  }
}

const smooth01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
