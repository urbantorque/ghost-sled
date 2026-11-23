import { BackSide, BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, Euler, Group, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Quaternion, Scene, SphereGeometry, TorusGeometry, Vector3, type ShaderMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HatId, ScarfDef, TrailDef } from '../game/garage';
import { Mood } from '../sim/chaos';
import { SIGNATURE } from '../sim/tricks';
import { beginLocalLights, pushLocalLight, setLocalLightTier } from './lights';
import { applyPalette, makeToonMaterial, shared } from './materials';
import { type FinishLook, RIDER_COLORS, pineGeometry, riderHeadGeometry, withSway } from './meshes';
import { getPalette, type Palette } from './palette';
import { Rider, type RiderCue, type RiderPose } from './rider';
import { TrailForms } from './trailforms';

// Round 9, the shop lane (G1): the garage as a place. A sled-maker's workshop in the finish town at dusk (Pinecrest's
// other hour): your rider on your sled on a trestle stand in the middle of the floor, the hats on wooden head blocks
// along one wall, the bench with its finish tins along the other, the Lantern Row hung from the rafters, a stove, and
// the big door at the back open on the yard, where a short loop of groomed snow lets a sled show its trail (milestone
// 0's prototypes/r9/garage/scene.ts, made the game's).
//
// Built from the game's own pieces: rider.ts's Rider (the live rig, its scarf on its verlet chain, its cheer), meshes.ts's
// sleds, hats, tiers and pines, materials.ts's toon material and shared light, lights.ts's local lights, trailforms.ts's
// trails. It is a module the garage imports on demand (app.ts openGarage), drawn by the game's own renderer through
// its own post pipeline (post.ts renderPlain): no second WebGL context, nothing of it in the first download, the
// title's world paused while it is open, disposed on close.
//
// DECISIONS 262 rejected a portrait per item (a render and a read-back each, and a second camera for the back of the
// head). A live place has one rider and one camera that moves: a piece goes on with the rider's own setter (a geometry
// swap of a few milliseconds), so nothing is rendered per item and the back of a hat is the camera turning round.
//
// Low and the phone get a designed cheaper place, never a broken High: no shadow map (the rug and the stand's feet
// carry the contact), the rider's Low build, one shelf of hat blocks, half the pines, no drifts by the door; the same
// room, light, rider and camera moves. On a phone held upright the camera stands back so the rider holds the top half.

/** Where the camera goes for what is browsed. */
export type PlaceShot = 'home' | 'sled' | 'hatBack' | 'hatFront' | 'scarf' | 'finish' | 'trail' | 'sound' | 'lanterns' | 'trick' | 'post';

interface Shot {
  pos: Vector3;
  look: Vector3;
  fov: number;
}

const v3 = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

/** The rider on the stand at the origin, facing -z (the door and the yard are behind it, +z). */
const SHOTS: Record<PlaceShot, Shot> = {
  home: { pos: v3(-3.2, 2.2, -4.7), look: v3(0.1, 1.25, 0.2), fov: 48 },
  sled: { pos: v3(-2.4, 1.7, -3.4), look: v3(0.2, 0.75, 0.3), fov: 42 },
  hatBack: { pos: v3(0.9, 2.6, 3.9), look: v3(0.3, 1.8, 0), fov: 38 },
  hatFront: { pos: v3(-0.8, 2.5, -3.9), look: v3(-0.3, 1.8, 0), fov: 38 },
  scarf: { pos: v3(1.4, 2.1, 3.9), look: v3(0.2, 1.2, 0), fov: 44 },
  finish: { pos: v3(2.9, 1.25, 2.6), look: v3(0, 0.5, 0.25), fov: 42 },
  trail: { pos: v3(0.6, 2.2, 3.6), look: v3(0, 0.6, 12), fov: 52 },
  sound: { pos: v3(-2.6, 1.4, -2.4), look: v3(0.3, 0.7, 0.3), fov: 40 },
  lanterns: { pos: v3(0.2, 1.3, -4.0), look: v3(0, 3.3, 0.6), fov: 56 },
  trick: { pos: v3(-3.1, 2.4, -4.3), look: v3(0.2, 1.55, 0.3), fov: 50 },
  post: { pos: v3(2.0, 1.9, 2.8), look: v3(0.3, 1.0, 0.7), fov: 38 },
};

/** A phone held upright: the rider in the top half (the shelf's sheet covers the bottom), the camera stood back inside
 *  the room (the front wall is at z = -5) with a wider lens, looking low so the rider rides high. */
const TALL: Record<PlaceShot, Shot> = {
  home: { pos: v3(-1.4, 2.6, -4.8), look: v3(0, 1.0, 0.3), fov: 80 },
  sled: { pos: v3(-1.0, 2.2, -4.2), look: v3(0, 0.6, 0.3), fov: 74 },
  hatBack: { pos: v3(0.5, 2.9, 4.3), look: v3(0, 1.75, 0), fov: 52 },
  hatFront: { pos: v3(-0.5, 2.8, -4.3), look: v3(0, 1.75, 0), fov: 52 },
  scarf: { pos: v3(0.6, 2.8, 4.4), look: v3(0, 1.2, 0), fov: 60 },
  finish: { pos: v3(2.4, 1.7, 2.6), look: v3(0, 0.15, 0.1), fov: 50 },
  trail: { pos: v3(0.8, 2.4, 3.6), look: v3(0, 1.0, 12), fov: 70 },
  sound: { pos: v3(-1.0, 2.0, -3.6), look: v3(0, 0.1, 0.3), fov: 62 },
  lanterns: { pos: v3(0.2, 1.0, -4.2), look: v3(0, 3.6, 0.6), fov: 70 },
  trick: { pos: v3(-1.0, 2.2, -4.2), look: v3(0, 0.6, 0.3), fov: 64 },
  post: { pos: v3(1.6, 2.4, 3.2), look: v3(0, 0.3, 0.6), fov: 54 },
};

const WOOD = RIDER_COLORS.wood;
const WOOD_DARK = RIDER_COLORS.woodDark;
const BEAM = new Color('#5A3A2A');
const PLANK = new Color('#8C6446');
const PLANK_DARK = new Color('#6E4C36');
const CREAM = new Color('#F3E6D4');
const INK = new Color('#1A2140');
const SNOW = new Color('#F4F7FF');
const STEEL = new Color('#7E8AA6');
const PAPER = new Color('#FFF1D6');
const GLOW = new Color('#FFD08A');
const STAND_Y = 0.52;

function colour(geo: BufferGeometry, c: Color, x = 0, y = 0, z = 0, rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(...scale)));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const n = g.getAttribute('position').count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(a, 3));
  return g;
}

const box = (w: number, h: number, d: number, c: Color, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]): BufferGeometry => colour(new BoxGeometry(w, h, d), c, x, y, z, rot);

function merged(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts.map((p) => withSway(p)), false);
  if (!g) throw new Error('garagescene: merge failed');
  g.computeBoundingSphere();
  return g;
}

/** A head block for the hat wall: the rider's head in a hat, its face and hair turned to pale wood. */
function hatBlock(hat: HatId): BufferGeometry {
  const g = riderHeadGeometry(false, hat, true);
  const col = g.getAttribute('color') as BufferAttribute;
  const skin = RIDER_COLORS.skin;
  const hair = RIDER_COLORS.hair;
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i);
    const gg = col.getY(i);
    const b = col.getZ(i);
    const near = (c: Color, t: number) => Math.abs(c.r - r) + Math.abs(c.g - gg) + Math.abs(c.b - b) < t;
    if (near(skin, 0.25) || near(hair, 0.3) || (r < 0.15 && gg < 0.15 && b < 0.25)) col.setXYZ(i, WOOD.r * 0.92, WOOD.g * 0.92, WOOD.b * 0.92);
  }
  return g;
}

/** The yard's loop of groomed snow: a rounded oval past the door. */
function loopAt(u: number, out: Vector3): { heading: number } {
  const a = u * Math.PI * 2;
  const rx = 4.6;
  const rz = 2.6;
  out.set(Math.sin(a) * rx, 0, 12 - Math.cos(a) * rz);
  const dx = Math.cos(a) * rx;
  const dz = Math.sin(a) * rz;
  return { heading: Math.atan2(dx, -dz) };
}

/** What the rider wears in the place (the save's look, or a piece tried on). */
export interface PlaceLook {
  sled: number;
  hat: HatId;
  scarf: ScarfDef;
  finish: FinishLook | null;
  /** Fitted tiers by sled id, and the post's ornament. */
  tiers: Readonly<Record<number, number>>;
  ornament: string;
  trail: TrailDef;
}

export interface PlaceCost {
  buildMs: number;
  firstFrameMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  programs: number;
}

export class GarageScene {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(42, 1, 0.05, 400);
  readonly rider = new Rider();
  readonly trail = new TrailForms();
  private sun = new DirectionalLight(0xffffff, 1);
  private shot: PlaceShot = 'home';
  private from: Shot = { pos: SHOTS.home.pos.clone(), look: SHOTS.home.look.clone(), fov: SHOTS.home.fov };
  private camT = 1;
  private lookAt = SHOTS.home.look.clone();
  private riding = false;
  private loopU = 0;
  private time = 0;
  private propMat: ShaderMaterial;
  private lanterns: Mesh[] = [];
  private lanternRow: Mesh | null = null;
  private bulbs: Mesh[] = [];
  private tall = false;
  /** The signature trick playing on the stand (seconds left), and which. */
  private trickT = 0;
  private trickMove = 0;
  /** The buy moment (G4): a gift on the rug that opens, the piece going on, the rider showing it off. */
  private gift: Group | null = null;
  private giftLid: Mesh | null = null;
  private momentT = -1;
  private momentPut: (() => void) | null = null;
  private momentDone: (() => void) | null = null;
  private momentTier = false;
  private confetti: Mesh[] = [];
  private cue: RiderCue | null = null;
  private cueN = 0;
  private readonly pose: RiderPose;
  private readonly look: PlaceLook;
  readonly cost: PlaceCost = { buildMs: 0, firstFrameMs: 0, calls: 0, triangles: 0, geometries: 0, programs: 0 };
  readonly palette: Palette;

  constructor(
    readonly low: boolean,
    lit: number,
    look: PlaceLook,
    private readonly reduced: () => boolean,
  ) {
    const t0 = performance.now();
    // The light: Pinecrest's dusk (the caller has set the hour), a low warm sun in through the door behind the stand.
    this.palette = getPalette('alpine', Mood.None);
    this.applyLight();
    this.sun.castShadow = !low;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -6;
    sc.right = 6;
    sc.top = 6;
    sc.bottom = -6;
    sc.near = 1;
    sc.far = 40;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);
    this.propMat = makeToonMaterial({ coolShade: 0.4, rim: 0.25, nearFade: [0.001, 0.002] });
    this.build(lit);
    this.rider.eye = this.camera;
    this.rider.setDetail(low ? 'lite' : 'full');
    for (const o of this.rider.objects) this.scene.add(o);
    this.scene.add(this.trail.root);
    this.trail.setLow(low);
    this.look = { ...look };
    this.wear(look);
    this.rider.reset(new Vector3(0, STAND_Y, 0));
    this.pose = { pos: new Vector3(0, STAND_Y, 0), heading: 0, airYaw: 0, airPitch: 0, normal: new Vector3(0, 1, 0), lean: 0, crouch: 0, drifting: false, driftDir: 0, airborne: false, speed: 1.5, wobble: 0, vel: new Vector3(0.3, 0, -1.5), perfectPulse: 0 };
    this.cost.buildMs = performance.now() - t0;
  }

  /** Puts the place's light into the shared uniforms (the world takes its own back when the garage closes). */
  applyLight(): void {
    applyPalette(this.palette);
    setLocalLightTier(this.low);
    shared.uSunDir.value.set(-0.32, 0.34, 0.88).normalize();
    shared.uFogNear.value = 80;
    shared.uFogFar.value = 900;
    shared.uLampK.value = 1;
    shared.uFocus.value.set(0, -1000, 0);
    this.sun.position.copy(shared.uSunDir.value).multiplyScalar(14);
  }

  /** The workshop, merged into a few draws: the room, the props, the hat wall, the Lantern Row, the yard. */
  private build(lit: number): void {
    const low = this.low;
    const room: BufferGeometry[] = [];
    for (let i = 0; i < 20; i++) room.push(box(0.5, 0.06, 10.4, i % 2 ? PLANK : PLANK_DARK, -4.75 + i * 0.5, -0.03, 0));
    for (let i = 0; i < 18; i++) {
      const y = 0.2 + i * 0.24;
      const c = i % 2 ? PLANK : PLANK_DARK;
      room.push(box(0.08, 0.24, 10, c, -5, y, 0), box(0.08, 0.24, 10, c, 5, y, 0), box(10, 0.24, 0.08, c, 0, y, -5));
      if (y > 3.1) room.push(box(10, 0.24, 0.08, c, 0, y, 5));
      else for (const sx of [-1, 1]) room.push(box(2.8, 0.24, 0.08, c, sx * 3.6, y, 5));
    }
    room.push(box(0.22, 3.3, 0.22, BEAM, -2.25, 1.6, 5), box(0.22, 3.3, 0.22, BEAM, 2.25, 1.6, 5), box(4.7, 0.24, 0.24, BEAM, 0, 3.2, 5));
    for (const sx of [-1, 1]) room.push(box(2.0, 3.0, 0.08, PLANK_DARK, sx * 3.35, 1.5, 4.85), box(1.9, 0.12, 0.1, BEAM, sx * 3.35, 2.4, 4.8), box(1.9, 0.12, 0.1, BEAM, sx * 3.35, 0.6, 4.8));
    for (const z of [-4.9, -1.6, 1.7, 4.9]) {
      room.push(box(0.2, 4.0, 0.2, BEAM, -4.85, 2, z), box(0.2, 4.0, 0.2, BEAM, 4.85, 2, z));
      room.push(box(10, 0.2, 0.2, BEAM, 0, 3.95, z));
    }
    for (const sx of [-1, 1]) for (const z of [-4.9, -1.6, 1.7, 4.9]) room.push(box(0.16, 0.16, 0.16, BEAM, sx * 2.4, 4.45, z));
    room.push(box(0.22, 0.22, 10, BEAM, 0, 5.4, 0));
    for (const sx of [-1, 1]) room.push(box(5.6, 0.1, 10.2, PLANK_DARK, sx * 2.55, 4.7, 0, [0, 0, sx * -0.45]));
    const stand: BufferGeometry[] = [];
    for (const z of [-0.42, 0.48]) {
      stand.push(box(1.0, 0.1, 0.16, WOOD_DARK, 0, 0.42, z));
      stand.push(box(0.84, 0.06, 0.2, CREAM, 0, 0.5, z));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) stand.push(box(0.07, 0.48, 0.07, WOOD_DARK, sx * 0.42, 0.2, z + sz * 0.09, [sz * 0.18, 0, sx * -0.12]));
    }
    stand.push(colour(new CylinderGeometry(1.5, 1.5, 0.02, 32), new Color('#3B4A86'), 0, 0.01, 0));
    stand.push(colour(new TorusGeometry(1.42, 0.03, 4, 40), CREAM, 0, 0.025, 0, [Math.PI / 2, 0, 0]));
    stand.push(box(0.8, 0.08, 3.2, WOOD, -4.5, 0.92, -1.6));
    for (const z of [-3.1, -0.1]) for (const x of [-4.2, -4.85]) stand.push(box(0.08, 0.9, 0.08, WOOD_DARK, x, 0.45, z));
    stand.push(box(0.75, 0.05, 3.0, WOOD_DARK, -4.5, 0.25, -1.6));
    stand.push(box(0.18, 0.16, 0.26, STEEL, -4.25, 1.04, -0.4), box(0.04, 0.04, 0.4, STEEL, -4.18, 1.06, -0.4));
    // The finishes' tins on the bench, in the shelf's own grounds.
    ['#2F6A4E', '#BFD8EC', '#3A2C2A', '#6E3F82', '#6A4636', '#EEF0F6', '#57535F', '#9A6A2E', '#5E2430'].forEach((c, i) => {
      stand.push(colour(new CylinderGeometry(0.09, 0.09, 0.16, 12), STEEL, -4.55, 1.04, -3.0 + i * 0.2));
      stand.push(colour(new CylinderGeometry(0.092, 0.092, 0.03, 12), new Color(c), -4.55, 1.13, -3.0 + i * 0.2));
    });
    stand.push(box(0.04, 1.1, 2.8, WOOD, -4.93, 1.75, -1.6));
    stand.push(box(0.03, 0.5, 0.06, STEEL, -4.88, 1.8, -2.6), box(0.04, 0.12, 0.3, WOOD_DARK, -4.88, 2.05, -2.6));
    for (let i = 0; i < 4; i++) stand.push(box(0.03, 0.34, 0.03, STEEL, -4.88, 1.7, -1.6 + i * 0.12), box(0.04, 0.12, 0.04, WOOD_DARK, -4.88, 1.95, -1.6 + i * 0.12));
    stand.push(box(0.12, 0.1, 0.36, WOOD_DARK, -4.86, 1.5, -0.6));
    for (let i = 0; i < 5; i++) stand.push(box(0.11, 1.3, 0.04, i % 2 ? WOOD_DARK : WOOD, 3.6 - 0.25 + i * 0.125, 0.7, 4.75, [-0.15, 0, 0]));
    stand.push(colour(new CylinderGeometry(0.38, 0.32, 0.85, 14), new Color('#2A2E3E'), -3.4, 0.5, 3.9));
    stand.push(colour(new CylinderGeometry(0.42, 0.42, 0.08, 14), new Color('#3A3F52'), -3.4, 0.95, 3.9));
    stand.push(colour(new CylinderGeometry(0.08, 0.08, 3.8, 8), new Color('#2A2E3E'), -3.4, 2.9, 3.9));
    stand.push(box(0.36, 0.2, 0.06, new Color('#FF9A4A'), -3.4, 0.45, 3.57));
    for (let i = 0; i < 9; i++) stand.push(colour(new CylinderGeometry(0.08, 0.08, 0.6, 7), i % 2 ? WOOD : WOOD_DARK, -4.4 + (i % 3) * 0.17, 0.09 + Math.floor(i / 3) * 0.15, 3.0, [Math.PI / 2, 0, 0]));
    // The scarf rail on the front wall: knits hanging in their patterns.
    stand.push(box(3.0, 0.05, 0.05, WOOD_DARK, -1.6, 2.2, -4.85));
    const V = RIDER_COLORS.accent;
    for (let i = 0; i < 9; i++) {
      const x = -2.9 + i * 0.32;
      for (let r = 0; r < 8; r++) {
        const patterned = (i % 3 === 0 && r % 3 === 2) || (i % 3 === 1 && r >= 6) || (i % 3 === 2 && r % 2 === 0);
        const c = patterned ? (i % 2 ? CREAM : INK) : V.clone().multiplyScalar(r % 2 ? 0.95 : 0.86);
        stand.push(box(0.16, 0.12, 0.02, c, x, 2.12 - r * 0.12 - (i % 2) * 0.05, -4.82));
      }
    }
    if (!low) {
      stand.push(colour(new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), SNOW, -1.6, 0, 4.7, [0, 0, 0], [1.1, 0.18, 0.6]));
      stand.push(colour(new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), SNOW, 1.9, 0, 4.8, [0, 0, 0], [0.8, 0.14, 0.5]));
    }
    this.add(merged(room), 'room');
    this.add(merged(stand), 'props');
    // The hat wall: shelves on the left wall, each hat on a wooden block (Low: one shelf of six).
    const hats: HatId[] = ['beanie', 'watch', 'twinpom', 'trapper', 'bobbles', 'chullo', 'longcap', 'muffs', 'downcap', 'twintails', 'floppeak'];
    const wall: BufferGeometry[] = [];
    const rows = low ? 1 : 2;
    for (let r = 0; r < rows; r++) wall.push(box(0.36, 0.05, 3.9, WOOD_DARK, 4.78, 1.45 + r * 0.75, 2.45));
    hats.slice(0, rows * 6).forEach((h, i) => {
      const r = Math.floor(i / 6);
      const g = hatBlock(h).applyMatrix4(new Matrix4().compose(new Vector3(4.72, 1.47 + r * 0.75 - 0.6 * 0.62, 0.8 + (i % 6) * 0.62), new Quaternion().setFromEuler(new Euler(0, Math.PI / 2 - 0.5, 0)), new Vector3(0.62, 0.62, 0.62)));
      wall.push(g);
      wall.push(colour(new CylinderGeometry(0.05, 0.08, 0.1, 8), WOOD_DARK, 4.72, 1.47 + r * 0.75 + 0.05, 0.8 + (i % 6) * 0.62));
    });
    this.add(merged(wall), 'hats');
    this.setLanterns(lit);
    // The hanging lamp over the stand.
    this.add(merged([colour(new CylinderGeometry(0.006, 0.006, 1.2, 4), INK, 0.4, 3.35, 0.2), colour(new ConeGeometry(0.34, 0.24, 16, 1, true), new Color('#2A3060'), 0.4, 2.68, 0.2)]), 'lamp', true);
    const bulb = new Mesh(new SphereGeometry(0.09, 10, 8), new MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(1.4) }));
    bulb.position.set(0.4, 2.56, 0.2);
    this.scene.add(bulb);
    this.bulbs.push(bulb);
    // The yard: snow, the loop groomed into it, pines, a far ridge, and the dusk sky.
    const yard: BufferGeometry[] = [colour(new PlaneGeometry(80, 70, 1, 1), SNOW, 0, 0, 40, [-Math.PI / 2, 0, 0])];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      yard.push(colour(new PlaneGeometry(0.9, 0.75), new Color('#FFFFFF'), Math.sin(a) * 4.6, 0.006, 12 - Math.cos(a) * 2.6, [-Math.PI / 2, 0, a]));
    }
    yard.push(colour(new SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), SNOW.clone().multiplyScalar(0.96), 0, -2, 46, [0, 0, 0], [60, 14, 18]));
    this.add(merged(yard), 'yard');
    const pal = this.palette;
    const pines: BufferGeometry[] = [];
    for (let i = 0; i < (low ? 6 : 14); i++) {
      const side = i % 2 ? 1 : -1;
      const g = pineGeometry(pal, i % 3).clone();
      const s = 0.9 + ((i * 37) % 7) / 10;
      g.applyMatrix4(new Matrix4().compose(new Vector3(side * (6.5 + ((i * 13) % 9)), 0, 9 + ((i * 29) % 26)), new Quaternion(), new Vector3(s, s, s)));
      pines.push(g);
    }
    this.add(merged(pines), 'pines');
    const dome = new SphereGeometry(300, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = dome.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, pos.getY(i) / 300);
      c.copy(pal.skyHorizon).lerp(pal.skyMid ?? pal.skyZenith, Math.min(1, h * 2.2)).lerp(pal.skyZenith, Math.max(0, h * 1.6 - 0.6));
      col.set([c.r, c.g, c.b], i * 3);
    }
    dome.setAttribute('color', new BufferAttribute(col, 3));
    this.scene.add(new Mesh(dome, new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false, fog: false })));
    const ridge: number[] = [];
    const rcol: number[] = [];
    for (const [d, k] of [
      [220, 0.62],
      [160, 0.5],
    ] as const) {
      const base = pal.skyHorizon.clone().lerp(pal.snowShade, k);
      for (let i = 0; i < 24; i++) {
        const a0 = -0.9 + (i / 24) * 1.8;
        const a1 = -0.9 + ((i + 1) / 24) * 1.8;
        const h0 = 18 + 22 * Math.abs(Math.sin(i * 1.7 + d)) * (k + 0.3);
        const h1 = 18 + 22 * Math.abs(Math.sin((i + 1) * 1.7 + d)) * (k + 0.3);
        const p0 = [Math.sin(a0) * d, -4, Math.cos(a0) * d];
        const p1 = [Math.sin(a1) * d, -4, Math.cos(a1) * d];
        ridge.push(...p0, ...p1, Math.sin(a1) * d, h1, Math.cos(a1) * d, ...p0, Math.sin(a1) * d, h1, Math.cos(a1) * d, Math.sin(a0) * d, h0, Math.cos(a0) * d);
        for (let v = 0; v < 6; v++) rcol.push(base.r, base.g, base.b);
      }
    }
    const rg = new BufferGeometry();
    rg.setAttribute('position', new BufferAttribute(new Float32Array(ridge), 3));
    rg.setAttribute('color', new BufferAttribute(new Float32Array(rcol), 3));
    this.scene.add(new Mesh(rg, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, fog: false })));
  }

  /** The Lantern Row in the rafters: a wire across and eight paper lanterns, as many lit as the player has lit
   *  (lanterns.ts), the lit ones glowing. */
  setLanterns(lit: number): void {
    if (this.lanternRow) {
      this.lanternRow.removeFromParent();
      this.lanternRow.geometry.dispose();
    }
    for (const l of this.lanterns) {
      l.removeFromParent();
      l.geometry.dispose();
    }
    this.lanterns = [];
    const row: BufferGeometry[] = [colour(new CylinderGeometry(0.008, 0.008, 9.4, 4), INK, 0, 3.55, 0.05, [0, 0, Math.PI / 2])];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const x = -3.85 + i * 1.1;
      const y = 3.32 - 0.12 * Math.sin((i / 7) * Math.PI);
      const on = i < Math.min(n, lit);
      row.push(colour(new CylinderGeometry(0.14, 0.16, 0.34, 10), on ? PAPER : new Color('#C9B79C'), x, y, 0.05));
      row.push(colour(new ConeGeometry(0.16, 0.08, 10), INK, x, y + 0.21, 0.05), colour(new CylinderGeometry(0.1, 0.13, 0.04, 10), INK, x, y - 0.19, 0.05));
      for (const dy of [-0.09, 0, 0.09]) row.push(colour(new TorusGeometry(0.155, 0.007, 3, 14), PAPER.clone().multiplyScalar(0.82), x, y + dy, 0.05, [Math.PI / 2, 0, 0]));
      if (on) {
        const heart = new Mesh(new SphereGeometry(0.1, 10, 8), new MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(1.25) }));
        heart.position.set(x, y, 0.05);
        this.lanterns.push(heart);
        this.scene.add(heart);
      }
    }
    this.lanternRow = this.add(merged(row), 'row');
  }

  private add(g: BufferGeometry, name: string, noShadow = false): Mesh {
    const m = new Mesh(g, this.propMat);
    m.name = name;
    m.receiveShadow = !this.low;
    m.castShadow = !this.low && !noShadow && name !== 'yard' && name !== 'room';
    this.scene.add(m);
    return m;
  }

  /** Puts a look on the rider (the save's, or a piece tried on): each part through the rider's own setter, so trying
   *  ten hats is ten geometry swaps and no render. */
  wear(look: PlaceLook): void {
    const r = this.rider;
    if (r.sledLook.id !== look.sled) r.setSled(look.sled);
    r.setHat(look.hat);
    r.setScarf(look.scarf);
    r.setFinish(look.finish);
    r.setTracks(look.tiers, look.ornament);
    this.trail.set(look.trail.form);
    Object.assign(this.look, look);
  }

  get worn(): Readonly<PlaceLook> {
    return this.look;
  }

  /** Moves the camera to what is browsed; the trail's shot sends the rider out round the yard's loop. */
  show(p: PlaceShot, instant = false): void {
    const set = this.tall ? TALL : SHOTS;
    const at = set[p];
    const now = this.reduced() || instant;
    this.from = now ? { pos: at.pos.clone(), look: at.look.clone(), fov: at.fov } : { pos: this.camera.position.clone(), look: this.lookAt.clone(), fov: this.camera.fov };
    this.shot = p;
    this.camT = now ? 1 : 0;
    const ride = p === 'trail';
    if (ride !== this.riding) {
      this.riding = ride;
      this.trail.clear();
      if (!ride) this.rider.reset(new Vector3(0, STAND_Y, 0));
    }
  }

  get current(): PlaceShot {
    return this.shot;
  }

  /** Plays the sled's signature trick on the stand: the rider's own trick pose (trickpose.ts) in a short loop, the
   *  sled lifted a hand on the stand's cradles. Reduced motion holds the pose without the lift. */
  watchTrick(sled: number, seconds = 2.4): void {
    this.trickMove = SIGNATURE[sled] ?? SIGNATURE[0];
    this.trickT = seconds;
    this.show('trick');
  }

  /** A purchase is a gift opened: a marigold box (the gifts' own, ART.md 13) drops on the rug, lifts its lid, paper
   *  flies, the piece goes on (`put`), the rider throws both arms up, and the camera is on the piece (`shot`). About
   *  two seconds; skipMoment ends it at once; reduced motion puts the piece on and cheers with nothing moving. A tier
   *  landing is the same with the sled lifted on its cradles (`tier`). */
  buyMoment(put: () => void, done: () => void, shot: PlaceShot, tier = false): void {
    this.endMoment();
    this.momentPut = put;
    this.momentDone = done;
    this.momentTier = tier;
    if (this.reduced()) {
      this.finishMoment();
      this.show(shot, true);
      return;
    }
    const g = new Group();
    const marigold = new Color('#FFD34D');
    const deep = new Color('#F2B935');
    const parts: BufferGeometry[] = [box(0.5, 0.36, 0.5, marigold, 0, 0.18, 0)];
    for (const x of [-0.17, 0.17]) parts.push(box(0.06, 0.362, 0.505, deep, x, 0.18, 0));
    parts.push(box(0.09, 0.365, 0.51, CREAM, 0, 0.18, 0), box(0.51, 0.365, 0.09, CREAM, 0, 0.18, 0));
    g.add(new Mesh(merged(parts), this.propMat));
    const lid = new Mesh(merged([box(0.56, 0.1, 0.56, marigold, 0, 0.05, 0), box(0.1, 0.105, 0.57, CREAM, 0, 0.05, 0), box(0.57, 0.105, 0.1, CREAM, 0, 0.05, 0), colour(new TorusGeometry(0.08, 0.03, 6, 12), CREAM, -0.07, 0.14, 0, [0, 0.6, 0.5]), colour(new TorusGeometry(0.08, 0.03, 6, 12), CREAM, 0.07, 0.14, 0, [0, -0.6, -0.5])]), this.propMat);
    lid.position.y = 0.36;
    g.add(lid);
    g.position.set(0.95, 0.02, -0.85);
    for (const o of [g, ...g.children]) o.castShadow = !this.low;
    this.scene.add(g);
    this.gift = g;
    this.giftLid = lid;
    this.momentT = 0;
    this.momentShot = shot;
    this.show(this.tall ? 'home' : 'sled');
  }

  private momentShot: PlaceShot = 'home';

  get inMoment(): boolean {
    return this.momentT >= 0;
  }

  skipMoment(): void {
    if (this.momentT >= 0) {
      this.finishMoment();
      this.show(this.momentShot, true);
    }
  }

  private finishMoment(): void {
    this.momentPut?.();
    this.momentPut = null;
    this.cue = 'cheer';
    this.cueN++;
    this.endMoment();
    const d = this.momentDone;
    this.momentDone = null;
    d?.();
  }

  private endMoment(): void {
    if (this.gift) {
      this.gift.removeFromParent();
      this.gift.traverse((o) => (o as Mesh).geometry?.dispose());
    }
    for (const c of this.confetti) {
      c.removeFromParent();
      c.geometry.dispose();
      (c.material as MeshBasicMaterial).dispose();
    }
    this.confetti = [];
    this.gift = null;
    this.giftLid = null;
    this.momentT = -1;
  }

  private tickMoment(dt: number): void {
    if (this.momentT < 0 || !this.gift || !this.giftLid) return;
    this.momentT += dt;
    const t = this.momentT;
    const drop = Math.min(1, t / 0.35);
    this.gift.position.y = 0.02 + (1 - drop * drop) * 1.4;
    const sq = t > 0.35 && t < 0.55 ? 1 - 0.12 * Math.sin(((t - 0.35) / 0.2) * Math.PI) : 1;
    this.gift.scale.set(2 - sq, sq, 2 - sq);
    if (t > 0.6) {
      const k = Math.min(1, (t - 0.6) / 0.5);
      this.giftLid.position.set(0.25 * k, 0.36 + 0.9 * k - 0.6 * k * k, -0.1 * k);
      this.giftLid.rotation.set(-1.2 * k, 0, 0.9 * k);
      if (!this.confetti.length) {
        for (let i = 0; i < (this.low ? 14 : 26); i++) {
          const m = new Mesh(new PlaneGeometry(0.06, 0.1), new MeshBasicMaterial({ color: [PAPER, new Color('#FFD34D'), CREAM][i % 3], side: DoubleSide }));
          m.userData.v = new Vector3(Math.cos(i * 2.4) * (0.8 + (i % 5) * 0.2), 2.4 + (i % 4) * 0.5, Math.sin(i * 2.4) * (0.8 + (i % 3) * 0.2));
          m.position.copy(this.gift.position).add(new Vector3(0, 0.35, 0));
          this.scene.add(m);
          this.confetti.push(m);
        }
      }
      for (const m of this.confetti) {
        const v = m.userData.v as Vector3;
        v.y -= 4.5 * dt;
        v.multiplyScalar(1 - 0.8 * dt);
        m.position.addScaledVector(v, dt);
        m.rotation.x += dt * 7;
        m.rotation.y += dt * 5;
      }
    }
    // The piece goes on as the box opens; the rider shows it off and the camera goes to the piece.
    if (t > 0.9 && this.momentPut) {
      this.momentPut();
      this.momentPut = null;
      this.cue = 'cheer';
      this.cueN++;
      this.show(this.momentShot);
    }
    if (t > 2.3) this.finishMoment();
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.tall = this.camera.aspect < 0.8;
    if (this.tall) this.camera.setViewOffset(w, h, 0, h * 0.16, w, h);
    else this.camera.setViewOffset(w, h, w * 0.17, 0, w, h);
    this.camera.updateProjectionMatrix();
    this.show(this.shot, true);
  }

  /** One frame of the place: the camera, the rider on its stand or the yard's loop, the trail, the moment, the light. */
  frame(dt: number): void {
    this.time += dt;
    const set = this.tall ? TALL : SHOTS;
    this.camT = Math.min(1, this.camT + dt / 0.9);
    const e = this.camT * this.camT * (3 - 2 * this.camT);
    const to = set[this.shot];
    this.camera.position.lerpVectors(this.from.pos, to.pos, e);
    this.lookAt.lerpVectors(this.from.look, to.look, e);
    this.camera.fov = this.from.fov + (to.fov - this.from.fov) * e;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.lookAt);
    const p = this.pose;
    p.pos.set(0, STAND_Y, 0);
    p.heading = 0;
    p.lean = 0;
    p.speed = 1.5;
    p.airborne = false;
    p.vel.set(0.3, 0, -1.5);
    p.trick = undefined;
    if (this.riding) {
      this.loopU = (this.loopU + dt * 0.12) % 1;
      const at = loopAt(this.loopU, p.pos);
      p.heading = at.heading;
      p.lean = -0.55;
      p.speed = 9;
      p.vel.set(Math.sin(at.heading) * 9, 0, -Math.cos(at.heading) * 9);
    } else if (this.trickT > 0) {
      // The signature on the stand: the sled lifted on its cradles and the rider in its trick pose, held.
      this.trickT -= dt;
      const lift = this.reduced() ? 0 : 0.22 * Math.sin(Math.min(1, (2.4 - this.trickT) / 0.3) * Math.PI * 0.5);
      p.pos.y = STAND_Y + lift;
      p.airborne = true;
      p.trick = { move: this.trickMove, grab: 0, tier: 0, tweak: 0, danger: 0 };
    } else if (this.momentTier && this.momentT >= 0 && !this.reduced()) {
      p.pos.y = STAND_Y + 0.12 * Math.sin(Math.min(1, this.momentT / 0.6) * Math.PI);
    }
    p.act = { tumble: 0, grind: false, wall: 0, finish: false, cue: this.cue, cueN: this.cueN, cueSide: 1 };
    this.tickMoment(dt);
    this.rider.update(p, dt, this.time);
    shared.uTime.value = this.time;
    // The trail rides the loop with the rider (on the stand it leaves nothing).
    this.trail.update(dt, { pos: p.pos, vel: p.vel, heading: p.heading, speed: p.speed * (this.riding ? 3 : 0), grounded: true, active: this.riding, time: this.time, eye: this.camera.position });
    // Local lights: the lamp over the stand, the stove, the lit lanterns, a lamp on the sled's post.
    beginLocalLights(p.pos.x, p.pos.y, p.pos.z);
    pushLocalLight(0.4, 2.5, 0.2, 1.0, 0.78, 0.52, 4.2, 1.15);
    pushLocalLight(-3.4, 0.6, 3.5, 1.0, 0.55, 0.28, 3.2, 1.0);
    for (const l of this.lanterns.slice(0, this.low ? 2 : 4)) pushLocalLight(l.position.x, l.position.y, l.position.z, 1.0, 0.82, 0.5, 2.6, 0.7);
    const post = this.rider.postLight(this.postV);
    if (post) pushLocalLight(post.x, post.y, post.z, 1.0, 0.82, 0.52, 2.2, 0.7);
    if (this.trail.lightOn) pushLocalLight(this.trail.light.x, this.trail.light.y, this.trail.light.z, 1.0, 0.8, 0.5, 3.0, 0.9);
    this.sun.target.position.set(p.pos.x, 0, p.pos.z);
    this.sun.position.copy(shared.uSunDir.value).multiplyScalar(14).add(this.sun.target.position);
  }

  private readonly postV = new Vector3();

  /** Every material and geometry the place made (the rider's too): call on close. */
  dispose(): void {
    this.endMoment();
    this.trail.dispose();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as MeshBasicMaterial | MeshBasicMaterial[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.sun.shadow.map?.dispose();
  }
}
