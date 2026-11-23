// Round 9, the garage lane (milestone 0): a first frame of the garage as a place. A sled-maker's workshop in the
// finish town at dusk: your rider on your sled on a stand in the middle of the floor, the hats on wooden blocks along
// one wall, the bench with its paint tins along the other, the Lantern Row hung from the rafters, a stove, and the big
// door at the back open on the yard, where a short loop of groomed snow lets a sled show its trail.
//
// Built with the game's own pieces: rider.ts's Rider (the live rig, its scarf on its verlet chain), meshes.ts's sled
// and hat geometry, materials.ts's toon material and shared light, lights.ts's local lights, palette.ts's palettes. One
// scene and one camera that moves to what you browse; putting a piece on is the rider's own setter (a geometry swap of
// a few milliseconds), so nothing is rendered per item (DECISIONS 262's objection to portraits).
//
// Dev only: prototypes/r9/garage.html loads it. In milestone 2 it would be a module the garage button imports on
// demand and the game's own renderer draws, never part of the first download.

import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  CylinderGeometry,
  DirectionalLight,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  NoToneMapping,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type ShaderMaterial,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rider, type RiderCue, type RiderPose } from '../../../src/render/rider';
import { RIDER_COLORS, RIDER_NECK, pineGeometry, riderHeadGeometry, withSway } from '../../../src/render/meshes';
import { applyPalette, makeToonMaterial, shared } from '../../../src/render/materials';
import { getPalette, setHour } from '../../../src/render/palette';
import { beginLocalLights, pushLocalLight, setLocalLightTier } from '../../../src/render/lights';
import { Mood } from '../../../src/sim/chaos';
import type { HatId } from '../../../src/game/garage';
import { applyLook, protoHead, type Look, type ProtoHat } from './items';

export type Preset = 'home' | 'hatFront' | 'hatBack' | 'paint' | 'trail' | 'chase';
export type Tier = 'high' | 'low';

interface Shot {
  pos: Vector3;
  look: Vector3;
  fov: number;
}

/** Where the camera stands for each thing browsed (the rider on the stand at the origin, facing -z). */
const SHOTS: Record<Preset, Shot> = {
  home: { pos: new Vector3(-2.35, 1.55, -3.1), look: new Vector3(0.25, 1.05, 0.3), fov: 42 },
  hatFront: { pos: new Vector3(-0.35, 1.95, -1.25), look: new Vector3(0, 1.62, 0.05), fov: 34 },
  hatBack: { pos: new Vector3(0.45, 2.05, 1.35), look: new Vector3(0, 1.6, 0.05), fov: 34 },
  paint: { pos: new Vector3(1.9, 1.05, 1.5), look: new Vector3(0, 0.6, 0.1), fov: 38 },
  trail: { pos: new Vector3(0.6, 2.1, 3.4), look: new Vector3(0, 0.6, 12), fov: 50 },
  chase: { pos: new Vector3(0, 2.0, 4.6), look: new Vector3(0, 1.05, -2), fov: 62 },
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

function box(w: number, h: number, d: number, c: Color, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]): BufferGeometry {
  return colour(new BoxGeometry(w, h, d), c, x, y, z, rot);
}

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

function merged(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts.map((p) => withSway(p)), false);
  if (!g) throw new Error('merge failed');
  return g;
}

/** A head block for the hat wall: the rider's head in a hat, its face and hair turned to pale wood. */
function hatBlock(hat: string): BufferGeometry {
  const g = hat.startsWith('proto:') ? protoHead(hat.slice(6) as ProtoHat).clone().translate(RIDER_NECK.x, RIDER_NECK.y, RIDER_NECK.z) : riderHeadGeometry(false, hat as HatId, true);
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
function loopAt(u: number, out: Vector3): { heading: number; lean: number } {
  const a = u * Math.PI * 2;
  const rx = 4.6;
  const rz = 2.6;
  out.set(Math.sin(a) * rx, 0, 12 - Math.cos(a) * rz);
  // Travelling with u: d/du of the point, as a heading (rider.ts: -z ahead at heading 0, +x at heading pi/2).
  const dx = Math.cos(a) * rx;
  const dz = Math.sin(a) * rz;
  return { heading: Math.atan2(dx, -dz), lean: -0.55 };
}

export class GarageScene {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(42, 1, 0.05, 400);
  readonly rider = new Rider();
  private sun = new DirectionalLight(0xffffff, 1);
  private preset: Preset = 'home';
  private from: Shot = { ...SHOTS.home };
  private camT = 1;
  private riding = false;
  private loopU = 0;
  private last = 0;
  private startT = 0;
  private lanterns: Mesh[] = [];
  /** Build and first-frame timings (ms), and what the first frame drew. */
  readonly cost = { buildMs: 0, firstFrameMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };
  private look: Look = {};
  private propMat: ShaderMaterial;
  /** The buy moment (G4): a gift on the rug that opens, the piece going on, the rider showing it off. */
  private gift: Group | null = null;
  private giftLid: Mesh | null = null;
  private momentT = -1;
  private momentPut: (() => void) | null = null;
  private momentDone: (() => void) | null = null;
  private confetti: Mesh[] = [];
  private cue: RiderCue | null = null;
  private cueN = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly tier: Tier = 'high',
    readonly lit = 5,
  ) {
    const t0 = performance.now();
    this.renderer = new WebGLRenderer({ canvas, antialias: tier === 'high', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, tier === 'high' ? 2 : 1));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = tier === 'high';
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    // The light: Pinecrest's dusk (the other hour), a low warm sun in through the door behind the stand.
    setHour('alt');
    applyPalette(getPalette('alpine', Mood.None));
    setLocalLightTier(tier === 'low');
    shared.uSunDir.value.set(-0.32, 0.34, 0.88).normalize();
    shared.uFogNear.value = 80;
    shared.uFogFar.value = 900;
    shared.uLampK.value = 1;
    shared.uFocus.value.set(0, -1000, 0);
    this.sun.position.copy(shared.uSunDir.value).multiplyScalar(14);
    this.sun.castShadow = tier === 'high';
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
    this.build();
    // The rider: the live rig, on the stand.
    this.rider.eye = this.camera;
    this.rider.setDetail(tier === 'low' ? 'lite' : 'full');
    for (const o of this.rider.objects) this.scene.add(o);
    this.rider.reset(new Vector3(0, 0.52, 0));
    this.cost.buildMs = performance.now() - t0;
    this.resize();
  }

  /** The workshop, merged into a few draws: the room, the props, the hat wall, the yard and the sky. */
  private build(): void {
    const low = this.tier === 'low';
    const room: BufferGeometry[] = [];
    // The floor: boards along z in two browns.
    for (let i = 0; i < 20; i++) room.push(box(0.5, 0.06, 10.4, i % 2 ? PLANK : PLANK_DARK, -4.75 + i * 0.5, -0.03, 0));
    // The walls: planks, the back one (z = +5) open on the yard through a big door.
    for (let i = 0; i < 18; i++) {
      const y = 0.2 + i * 0.24;
      const c = i % 2 ? PLANK : PLANK_DARK;
      room.push(box(0.08, 0.24, 10, c, -5, y, 0), box(0.08, 0.24, 10, c, 5, y, 0), box(10, 0.24, 0.08, c, 0, y, -5));
      if (y > 3.1) room.push(box(10, 0.24, 0.08, c, 0, y, 5));
      else for (const sx of [-1, 1]) room.push(box(2.8, 0.24, 0.08, c, sx * 3.6, y, 5));
    }
    // The door's frame, its two leaves swung open against the wall.
    room.push(box(0.22, 3.3, 0.22, BEAM, -2.25, 1.6, 5), box(0.22, 3.3, 0.22, BEAM, 2.25, 1.6, 5), box(4.7, 0.24, 0.24, BEAM, 0, 3.2, 5));
    for (const sx of [-1, 1]) room.push(box(2.0, 3.0, 0.08, PLANK_DARK, sx * 3.35, 1.5, 4.85), box(1.9, 0.12, 0.1, BEAM, sx * 3.35, 2.4, 4.8), box(1.9, 0.12, 0.1, BEAM, sx * 3.35, 0.6, 4.8));
    // Posts, rafters and the ridge.
    for (const z of [-4.9, -1.6, 1.7, 4.9]) {
      room.push(box(0.2, 4.0, 0.2, BEAM, -4.85, 2, z), box(0.2, 4.0, 0.2, BEAM, 4.85, 2, z));
      room.push(box(10, 0.2, 0.2, BEAM, 0, 3.95, z));
    }
    for (const sx of [-1, 1]) for (const z of [-4.9, -1.6, 1.7, 4.9]) room.push(box(0.16, 0.16, 0.16, BEAM, sx * 2.4, 4.45, z));
    room.push(box(0.22, 0.22, 10, BEAM, 0, 5.4, 0));
    for (const sx of [-1, 1]) room.push(box(5.6, 0.1, 10.2, PLANK_DARK, sx * 2.55, 4.7, 0, [0, 0, sx * -0.45]));
    // The stand: two trestles with cream padded cradles, the sled on them at 0.52 m.
    const stand: BufferGeometry[] = [];
    for (const z of [-0.42, 0.48]) {
      stand.push(box(1.0, 0.1, 0.16, WOOD_DARK, 0, 0.42, z));
      stand.push(box(0.84, 0.06, 0.2, CREAM, 0, 0.5, z));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) stand.push(box(0.07, 0.48, 0.07, WOOD_DARK, sx * 0.42, 0.2, z + sz * 0.09, [sz * 0.18, 0, sx * -0.12]));
    }
    // A round rug under the stand.
    stand.push(colour(new CylinderGeometry(1.5, 1.5, 0.02, 32), new Color('#3B4A86'), 0, 0.01, 0));
    stand.push(colour(new TorusGeometry(1.42, 0.03, 4, 40), CREAM, 0, 0.025, 0, [Math.PI / 2, 0, 0]));
    // The bench on the right wall: a top, legs, a vice, tools, and the finishes' tins.
    stand.push(box(0.8, 0.08, 3.2, WOOD, -4.5, 0.92, -1.6));
    for (const z of [-3.1, -0.1]) for (const x of [-4.2, -4.85]) stand.push(box(0.08, 0.9, 0.08, WOOD_DARK, x, 0.45, z));
    stand.push(box(0.75, 0.05, 3.0, WOOD_DARK, -4.5, 0.25, -1.6));
    stand.push(box(0.18, 0.16, 0.26, STEEL, -4.25, 1.04, -0.4), box(0.04, 0.04, 0.4, STEEL, -4.18, 1.06, -0.4));
    const tins = ['#2F6A4E', '#9FC4E8', '#232E66', '#6E3F82', '#4A3428', '#EDEFF6', '#2B2A33', '#3E7A5C'];
    tins.forEach((c, i) => {
      stand.push(colour(new CylinderGeometry(0.09, 0.09, 0.16, 12), STEEL, -4.55, 1.04, -3.0 + i * 0.2));
      stand.push(colour(new CylinderGeometry(0.092, 0.092, 0.03, 12), new Color(c), -4.55, 1.13, -3.0 + i * 0.2));
    });
    // A pegboard over the bench with tools: a saw, a mallet, a plane, chisels.
    stand.push(box(0.04, 1.1, 2.8, WOOD, -4.93, 1.75, -1.6));
    stand.push(box(0.03, 0.5, 0.06, STEEL, -4.88, 1.8, -2.6), box(0.04, 0.12, 0.3, WOOD_DARK, -4.88, 2.05, -2.6));
    for (let i = 0; i < 4; i++) stand.push(box(0.03, 0.34, 0.03, STEEL, -4.88, 1.7, -1.6 + i * 0.12), box(0.04, 0.12, 0.04, WOOD_DARK, -4.88, 1.95, -1.6 + i * 0.12));
    stand.push(box(0.12, 0.1, 0.36, WOOD_DARK, -4.86, 1.5, -0.6));
    // A spare sled leaning on the wall by the door.
    for (let i = 0; i < 5; i++) stand.push(box(0.11, 1.3, 0.04, i % 2 ? WOOD_DARK : WOOD, 3.6 - 0.25 + i * 0.125, 0.7, 4.75, [-0.15, 0, 0]));
    // The stove: a pot-bellied iron stove in the left back corner with its pipe.
    stand.push(colour(new CylinderGeometry(0.38, 0.32, 0.85, 14), new Color('#2A2E3E'), -3.4, 0.5, 3.9));
    stand.push(colour(new CylinderGeometry(0.42, 0.42, 0.08, 14), new Color('#3A3F52'), -3.4, 0.95, 3.9));
    stand.push(colour(new CylinderGeometry(0.08, 0.08, 3.8, 8), new Color('#2A2E3E'), -3.4, 2.9, 3.9));
    stand.push(box(0.36, 0.2, 0.06, new Color('#FF9A4A'), -3.4, 0.45, 3.57));
    // A log pile beside it.
    for (let i = 0; i < 9; i++) stand.push(colour(new CylinderGeometry(0.08, 0.08, 0.6, 7), i % 2 ? WOOD : WOOD_DARK, -4.4 + (i % 3) * 0.17, 0.09 + Math.floor(i / 3) * 0.15, 3.0, [Math.PI / 2, 0, 0]));
    // The scarf rail on the front wall: scarves hanging in their patterns.
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
      // Snow by the door, blown in.
      stand.push(colour(new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), SNOW, -1.6, 0, 4.7, [0, 0, 0], [1.1, 0.18, 0.6]));
      stand.push(colour(new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), SNOW, 1.9, 0, 4.8, [0, 0, 0], [0.8, 0.14, 0.5]));
    }
    this.add(merged(room), 'room');
    this.add(merged(stand), 'props');
    // The hat wall: shelves on the left wall, each hat on a wooden block (Low: one shelf of six).
    const hats: string[] = ['beanie', 'watch', 'twinpom', 'trapper', 'proto:bobbles2', 'chullo', 'longcap', 'proto:crest', 'proto:muffs', 'proto:downcap', 'proto:twintails', 'proto:floppeak'];
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
    // The Lantern Row from the rafters: a wire across and eight paper lanterns, the lit ones glowing.
    const wire = colour(new CylinderGeometry(0.008, 0.008, 9.4, 4), INK, 0, 3.55, 0.05, [0, 0, Math.PI / 2]);
    const row: BufferGeometry[] = [wire];
    for (let i = 0; i < 8; i++) {
      const x = -3.85 + i * 1.1;
      const y = 3.32 - 0.12 * Math.sin((i / 7) * Math.PI);
      const on = i < this.lit;
      row.push(colour(new CylinderGeometry(0.14, 0.16, 0.34, 10), on ? PAPER : new Color('#C9B79C'), x, y, 0.05));
      row.push(colour(new ConeGeometry(0.16, 0.08, 10), INK, x, y + 0.21, 0.05), colour(new CylinderGeometry(0.1, 0.13, 0.04, 10), INK, x, y - 0.19, 0.05));
      for (const dy of [-0.09, 0, 0.09]) row.push(colour(new TorusGeometry(0.155, 0.007, 3, 14), PAPER.clone().multiplyScalar(0.82), x, y + dy, 0.05, [Math.PI / 2, 0, 0]));
      if (on) {
        const heart = new Mesh(new SphereGeometry(0.1, 10, 8), new MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(1.25), transparent: true, opacity: 0.85 }));
        heart.position.set(x, y, 0.05);
        this.lanterns.push(heart);
        this.scene.add(heart);
      }
    }
    this.add(merged(row), 'row');
    // The hanging lamp over the stand.
    const lamp = merged([
      colour(new CylinderGeometry(0.006, 0.006, 1.2, 4), INK, 0.4, 3.35, 0.2),
      colour(new ConeGeometry(0.34, 0.24, 16, 1, true), new Color('#2A3060'), 0.4, 2.68, 0.2),
    ]);
    this.add(lamp, 'lamp', true);
    const bulb = new Mesh(new SphereGeometry(0.09, 10, 8), new MeshBasicMaterial({ color: GLOW.clone().multiplyScalar(1.4) }));
    bulb.position.set(0.4, 2.56, 0.2);
    this.scene.add(bulb);
    // The yard: snow, the loop groomed into it, pines, a far ridge, and the dusk sky.
    const yard: BufferGeometry[] = [colour(new PlaneGeometry(80, 70, 1, 1), SNOW, 0, 0, 40, [-Math.PI / 2, 0, 0])];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const p = new Vector3(Math.sin(a) * 4.6, 0.006, 12 - Math.cos(a) * 2.6);
      yard.push(colour(new PlaneGeometry(0.9, 0.75), new Color('#FFFFFF'), p.x, p.y, p.z, [-Math.PI / 2, 0, a]));
    }
    yard.push(colour(new SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), SNOW.clone().multiplyScalar(0.96), 0, -2, 46, [0, 0, 0], [60, 14, 18]));
    this.add(merged(yard), 'yard');
    const pal = getPalette('alpine', Mood.None);
    const pines: BufferGeometry[] = [];
    const spots = low ? 6 : 14;
    for (let i = 0; i < spots; i++) {
      const side = i % 2 ? 1 : -1;
      const g = pineGeometry(pal, i % 3).clone();
      const s = 0.9 + ((i * 37) % 7) / 10;
      g.applyMatrix4(new Matrix4().compose(new Vector3(side * (6.5 + ((i * 13) % 9)), 0, 9 + ((i * 29) % 26)), new Quaternion(), new Vector3(s, s, s)));
      pines.push(g);
    }
    this.add(merged(pines), 'pines');
    // The sky: a dome in the palette's own gradient, a far ridge in two values.
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

  private add(g: BufferGeometry, name: string, noShadow = false): Mesh {
    g.computeBoundingSphere();
    const m = new Mesh(g, this.propMat);
    m.name = name;
    m.receiveShadow = this.tier === 'high';
    m.castShadow = this.tier === 'high' && !noShadow && name !== 'yard' && name !== 'room';
    this.scene.add(m);
    return m;
  }

  /** Puts a look on the rider (items.ts applyLook: today's pieces by the rider's setters, proposals by its parts). */
  wear(look: Look): void {
    this.look = look;
    applyLook(this.rider, this.scene, look);
  }

  /** Moves the camera to what is browsed; the trail's shot sends the rider out round the yard's loop. */
  show(p: Preset, instant = false): void {
    this.from = { pos: this.camera.position.clone(), look: this.lookAt.clone(), fov: this.camera.fov };
    this.preset = p;
    this.camT = instant ? 1 : 0;
    this.riding = p === 'trail';
    if (!this.riding) this.rider.reset(new Vector3(0, 0.52, 0));
  }

  private lookAt = SHOTS.home.look.clone();

  /** A purchase is a gift opened: a marigold box (the gifts' own, ART.md 13) on the rug lifts its lid, paper flies,
   *  the piece goes on (put), the rider throws both arms up, and the camera is home on the piece. Two seconds; a tap
   *  skips to its end (skipMoment); reduced motion puts the piece on and plays the cheer with nothing moving. */
  buyMoment(put: () => void, done: () => void, reduced: boolean): void {
    this.endMoment();
    this.momentPut = put;
    this.momentDone = done;
    if (reduced) {
      this.finishMoment();
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
    this.scene.add(g);
    this.gift = g;
    this.giftLid = lid;
    this.momentT = 0;
    this.show('home');
  }

  skipMoment(): void {
    if (this.momentT >= 0) this.finishMoment();
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
    if (this.gift) this.gift.removeFromParent();
    for (const c of this.confetti) c.removeFromParent();
    this.confetti = [];
    this.gift = null;
    this.giftLid = null;
    this.momentT = -1;
  }

  private tickMoment(dt: number): void {
    if (this.momentT < 0 || !this.gift || !this.giftLid) return;
    this.momentT += dt;
    const t = this.momentT;
    // In: the box drops onto the rug with a squash.
    const drop = Math.min(1, t / 0.35);
    this.gift.position.y = 0.02 + (1 - drop * drop) * 1.4;
    const sq = t > 0.35 && t < 0.55 ? 1 - 0.12 * Math.sin(((t - 0.35) / 0.2) * Math.PI) : 1;
    this.gift.scale.set(2 - sq, sq, 2 - sq);
    // The lid lifts off and tumbles away; paper bursts out of the box.
    if (t > 0.6) {
      const k = Math.min(1, (t - 0.6) / 0.5);
      this.giftLid.position.set(0.25 * k, 0.36 + 0.9 * k - 0.6 * k * k, -0.1 * k);
      this.giftLid.rotation.set(-1.2 * k, 0, 0.9 * k);
      if (!this.confetti.length) {
        for (let i = 0; i < 26; i++) {
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
    // The piece goes on as the box opens; the rider shows it off.
    if (t > 0.9 && this.momentPut) {
      this.momentPut();
      this.momentPut = null;
      this.cue = 'cheer';
      this.cueN++;
    }
    if (t > 2.2) this.finishMoment();
  }

  resize(): void {
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** One frame. `t` in seconds. */
  frame(t: number): void {
    const dt = this.last ? Math.min(0.05, t - this.last) : 1 / 60;
    this.last = t;
    if (!this.startT) this.startT = t;
    // The camera eases to its shot (reduced motion: the page passes instant).
    this.camT = Math.min(1, this.camT + dt / 0.9);
    const e = this.camT * this.camT * (3 - 2 * this.camT);
    const to = SHOTS[this.preset];
    const tall = this.camera.aspect < 0.8;
    const toPos = tall ? to.pos.clone().sub(to.look).multiplyScalar(1.45).add(to.look) : to.pos;
    this.camera.position.lerpVectors(this.from.pos, toPos, e);
    this.lookAt.lerpVectors(this.from.look, to.look, e);
    this.camera.fov = this.from.fov + (to.fov + (tall ? 8 : 0) - this.from.fov) * e;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.lookAt);
    // The rider: seated on the stand with a breath of air through the door, or riding the loop.
    const pose: RiderPose = { pos: new Vector3(0, 0.52, 0), heading: 0, airYaw: 0, airPitch: 0, normal: new Vector3(0, 1, 0), lean: 0, crouch: 0, drifting: false, driftDir: 0, airborne: false, speed: 1.5, wobble: 0, vel: new Vector3(0.3, 0, -1.5), perfectPulse: 0 };
    if (this.riding) {
      this.loopU = (this.loopU + dt * 0.12) % 1;
      const at = loopAt(this.loopU, pose.pos);
      pose.heading = at.heading;
      pose.lean = at.lean;
      pose.speed = 9;
      pose.vel.set(Math.sin(at.heading) * 9, 0, -Math.cos(at.heading) * 9);
    }
    pose.act = { tumble: 0, grind: false, wall: 0, finish: false, cue: this.cue, cueN: this.cueN, cueSide: 1 };
    this.tickMoment(dt);
    this.rider.update(pose, dt, t - this.startT);
    shared.uTime.value = t - this.startT;
    // Local lights: the lamp over the stand, the stove, the lit lanterns.
    beginLocalLights(pose.pos.x, pose.pos.y, pose.pos.z);
    pushLocalLight(0.4, 2.5, 0.2, 1.0, 0.78, 0.52, 4.2, 1.15);
    pushLocalLight(-3.4, 0.6, 3.5, 1.0, 0.55, 0.28, 3.2, 1.0);
    for (const l of this.lanterns.slice(0, 4)) pushLocalLight(l.position.x, l.position.y, l.position.z, 1.0, 0.82, 0.5, 2.6, 0.7);
    this.sun.target.position.set(pose.pos.x, 0, pose.pos.z);
    this.sun.position.copy(shared.uSunDir.value).multiplyScalar(14).add(this.sun.target.position);
    const r0 = performance.now();
    this.renderer.render(this.scene, this.camera);
    if (!this.cost.firstFrameMs) {
      this.cost.firstFrameMs = performance.now() - r0;
      const i = this.renderer.info;
      Object.assign(this.cost, { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0 });
    }
  }

  /** What the last frame drew. */
  info(): { calls: number; triangles: number; geometries: number; textures: number; programs: number } {
    const i = this.renderer.info;
    return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length ?? 0 };
  }

  get current(): Look {
    return this.look;
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
  }
}

/** Kept so a page can name the group type without importing three. */
export type { Group };
