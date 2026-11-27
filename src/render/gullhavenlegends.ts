import { AdditiveBlending, BufferGeometry, Color, ConeGeometry, CylinderGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { Snap } from '../game/run';
import type { Course } from '../sim/course';
import { LEGEND_AHEAD, pathX } from '../sim/moments';
import type { Sim } from '../sim/sim';
import { merge, part } from './flora';
import { pushLocalLight } from './lights';

// Gullhaven's two legends as its world draws them (round 9's feel pass, the look lane; their sim is the lane's,
// moments.ts LEGENDS.gullhaven). Until now the marquee's stand-ins drew them, orbs on the runner's line, and the Herring
// Lights took Pinecrest's Lantern Fleet's key and rose as its lanterns from a lake that is not there.
//  - The Beacon Keeper (a runner, 'keeper'): the old beacon's keeper walking the clifftop ahead of the rider on the
//    legend's line, in an oilskin and a sou'wester, his lamp held out, a pool of its light on the snow round his feet. Like
//    every legend he is light, not a solid on the line: a pale figure of it, his lamp the warm heart of it.
//  - The Herring Lights (a sky legend, 'fleet'): the harbour's boats coming home along the coast far below the Geos, each a
//    dark hull with a lamp at its masthead and the lamp's light lying on the swell under it, the whole fleet lit while
//    it plays and going on down the coast after.
// Both are spectacle only: nothing here touches the sim or stands on the snow a sled rides.

const KEEPER = new Color('#C4CEE6');
const LAMP = new Color('#FFE7A8');
const LAMP_LIN = new Color('#FFE2BC').convertSRGBToLinear();
const HULL = new Color('#1C2232');

/** How far either side of the legend's place it is drawn (metres, as the legends' own: legendworld.ts). */
const REACH_IN = 520;
const REACH_OUT = 150;
/** The fleet: how many boats (Low half), how far out to sea from the cliff's foot they sail, and their speed. */
const BOATS = 16;
const OUT_MIN = 140;
const OUT_MAX = 1000;
/** How far ahead of the rider the keeper walks: past the rider's head from the chase lens. And his size. */
const KEEPER_AHEAD = 30;
const KEEPER_SCALE = 2.3;

const tm = new Matrix4();
const tq = new Quaternion();
const tv = new Vector3();
const ts = new Vector3();
const tc = new Color();
const Y = new Vector3(0, 1, 0);

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** A soft point of light turned to the lens (instanced: each instance's position, size and colour), for the lamps far
 *  off, where a lamp is a few pixels and its glow is what reads; and flat on the water, its light lying on the swell. */
export function glowMaterial(flat: boolean): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
        vCol = instanceColor;
        #else
        vCol = vec3(1.0);
        #endif
        ${
          flat
            ? 'gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);'
            : `vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float k = length(instanceMatrix[0].xyz);
        c.xy += position.xy * k;
        gl_Position = projectionMatrix * c;`
        }
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vec2 q = vUv - 0.5;
        float d = length(q) * 2.0;
        float a = ${flat ? '(1.0 - smoothstep(0.0, 1.0, length(q * vec2(2.0, 1.0)) * 2.0)) * 0.7' : 'exp(-d * d * 5.0) + (1.0 - smoothstep(0.0, 1.0, d)) * 0.25'};
        gl_FragColor = vec4(vCol * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/** The keeper: an oilskin coat to the knees, the sou'wester's brim and crown, an arm held out with his lamp on it, built
 *  facing down the run (+z sim is -z three) about his feet. */
function keeperGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const add = (g: BufferGeometry, x: number, y: number, z: number, rz = 0, rx = 0): void => {
    parts.push(part(g, KEEPER, { pos: [x, y, z], rot: [rx, 0, rz] }));
  };
  add(new CylinderGeometry(0.26, 0.46, 1.35, 8), 0, 0.9, 0);
  add(new CylinderGeometry(0.16, 0.2, 0.4, 7), 0.12, 0.25, 0);
  add(new CylinderGeometry(0.16, 0.2, 0.4, 7), -0.12, 0.25, 0);
  add(new SphereGeometry(0.17, 8, 6), 0, 1.75, 0);
  add(new CylinderGeometry(0.34, 0.38, 0.05, 10), 0, 1.86, 0.03);
  add(new CylinderGeometry(0.12, 0.17, 0.2, 8), 0, 1.97, 0);
  // His lamp arm out to his side and a little ahead, the other at his side.
  add(new CylinderGeometry(0.07, 0.08, 0.62, 6), 0.36, 1.36, -0.1, 1.05);
  add(new CylinderGeometry(0.07, 0.08, 0.6, 6), -0.3, 1.1, 0, -0.25);
  return merge(parts);
}

/** A boat of the herring fleet: a low dark hull with its bow up, a wheelhouse, a mast. Built along +x three. */
function boatGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const hull = new CylinderGeometry(1.6, 1.1, 13, 6, 1).rotateZ(Math.PI / 2);
  parts.push(part(hull, HULL, { pos: [0, 0.6, 0] }));
  parts.push(part(new ConeGeometry(1.6, 3.4, 6).rotateZ(-Math.PI / 2), HULL, { pos: [8.1, 0.6, 0] }));
  parts.push(part(new CylinderGeometry(1.1, 1.1, 2.2, 4).rotateY(Math.PI / 4), HULL, { pos: [-2.5, 2.4, 0] }));
  parts.push(part(new CylinderGeometry(0.12, 0.16, 7, 5), HULL, { pos: [2.2, 4.5, 0] }));
  return merge(parts);
}

export class GullhavenLegends {
  readonly root = new Object3D();
  // (A pale figure of light over the snow, a step under the snow's white so it reads by day: added light, on white snow
  // in the low sun he was not there at all.)
  private readonly figMat = new MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false });
  private readonly hullMat = new MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false });
  private readonly glowMat = glowMaterial(false);
  private readonly lieMat = glowMaterial(true);
  private keeper: Mesh | null = null;
  private keeperLamp: InstancedMesh | null = null;
  private keeperPool: Mesh | null = null;
  private boats: InstancedMesh | null = null;
  private boatLamps: InstancedMesh | null = null;
  private boatLie: InstancedMesh | null = null;
  /** The fleet's own clock while it shows (its boats sail on it), and when the legend was over. */
  private fleetT = 0;
  private overAt = -1;

  constructor() {
    this.root.name = 'gullhaven-legends';
  }

  private ensure(low: boolean): void {
    if (this.keeper) return;
    const k = new Mesh(keeperGeometry(), this.figMat);
    k.frustumCulled = false;
    k.renderOrder = 6;
    k.visible = false;
    this.keeper = k;
    const glowPlane = new PlaneGeometry(1, 1);
    const kl = new InstancedMesh(glowPlane, this.glowMat, 1);
    kl.frustumCulled = false;
    kl.renderOrder = 7;
    kl.visible = false;
    kl.setColorAt(0, tc.copy(LAMP));
    this.keeperLamp = kl;
    const pool = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: LAMP, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false }));
    pool.frustumCulled = false;
    pool.renderOrder = 5;
    pool.visible = false;
    this.keeperPool = pool;
    const n = low ? BOATS / 2 : BOATS;
    const b = new InstancedMesh(boatGeometry(), this.hullMat, n);
    b.frustumCulled = false;
    b.visible = false;
    this.boats = b;
    const bl = new InstancedMesh(glowPlane, this.glowMat, n);
    bl.frustumCulled = false;
    bl.renderOrder = 7;
    bl.visible = false;
    bl.setColorAt(0, tc.copy(LAMP));
    this.boatLamps = bl;
    const lie = new InstancedMesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.lieMat, n);
    lie.frustumCulled = false;
    lie.renderOrder = 6;
    lie.visible = false;
    lie.setColorAt(0, tc.copy(LAMP));
    this.boatLie = lie;
    this.root.add(k, kl, pool, b, bl, lie);
  }

  reset(): void {
    this.fleetT = 0;
    this.overAt = -1;
    this.hide();
  }

  private hide(): void {
    for (const o of this.root.children) o.visible = false;
  }

  /** sea: the sea's level (three y); shore: the cliff's foot at sim z (sim x). */
  update(c: Course, time: number, dt: number, s: Snap, sim: Sim | null, run: boolean, low: boolean, reduced: boolean, sea: number, shore: (z: number) => number): void {
    this.hide();
    const lg = run && sim ? sim.legend : null;
    if (!sim || !lg || s.z < lg.z0 - REACH_IN || s.z > lg.z1 + REACH_OUT) return;
    this.ensure(low);
    const st = sim.lg;
    if (lg.key === 'keeper' && lg.path && st.phase >= 1) this.keeperAt(c, time, s, lg, st.phase, st.head, reduced);
    else if (lg.key === 'fleet') this.fleetAt(c, time, dt, s, lg, st.phase, reduced, sea, shore);
  }

  /** The keeper walks the legend's line ahead of the rider, never nearer than LEGEND_AHEAD: said, he waits at its head with
   *  his lamp up; playing, he walks on before the rider; over, he goes on down the cliff path and fades. */
  private keeperAt(c: Course, time: number, s: Snap, lg: NonNullable<Sim['legend']>, phase: number, head: number, reduced: boolean): void {
    const path = lg.path!;
    const over = phase >= 3;
    let z = phase === 2 ? head : lg.z0 + LEGEND_AHEAD;
    z = Math.max(z, s.z + Math.max(LEGEND_AHEAD, KEEPER_AHEAD));
    if (over) z = Math.max(z, Math.min(path.z1 + 40, s.z + LEGEND_AHEAD + 10));
    const zc = Math.max(path.z0, Math.min(path.z1, z));
    const x = pathX(c, path, zc);
    const y = c.ground(x, zc);
    const fade = over ? Math.max(0, 1 - (s.z - lg.z1) / 90) : phase === 1 ? 0.75 : 1;
    if (fade <= 0.01) return;
    const step = reduced ? 0 : time * 6.5;
    const bob = Math.abs(Math.sin(step)) * 0.07;
    const sway = Math.sin(step) * 0.05;
    const along = (pathX(c, path, Math.min(path.z1, zc + 2)) - pathX(c, path, Math.max(path.z0, zc - 2))) / 4;
    const k = this.keeper!;
    k.visible = true;
    k.position.set(x, y + bob, -zc);
    k.rotation.set(0, Math.PI + Math.atan(along), sway);
    // (A legend's size: the old keeper as the clifftop remembers him, twice a man's height, so he reads where the sim's
    // runner keeps him, tens of metres ahead.)
    k.scale.setScalar(KEEPER_SCALE);
    this.figMat.opacity = 0.8 * fade;
    // His lamp, out at his side, swinging a little as he walks.
    const lx = x + 0.75 * KEEPER_SCALE * Math.cos(Math.atan(along));
    const ly = y + 1.35 * KEEPER_SCALE + bob + 0.05 * Math.sin(step * 2);
    const kl = this.keeperLamp!;
    kl.visible = true;
    tm.compose(tv.set(lx, ly, -zc + 0.1), tq.identity(), ts.setScalar(4.5));
    kl.setMatrixAt(0, tm);
    kl.setColorAt(0, tc.copy(LAMP).multiplyScalar((1.6 + 0.2 * Math.sin(time * 11)) * fade));
    kl.instanceMatrix.needsUpdate = true;
    if (kl.instanceColor) kl.instanceColor.needsUpdate = true;
    const pool = this.keeperPool!;
    pool.visible = true;
    pool.position.set(x + 0.3, y + 0.08, -zc);
    pool.scale.set(12, 1, 12);
    (pool.material as MeshBasicMaterial).opacity = 0.22 * fade;
    if (Math.abs(zc - s.z) < 140) pushLocalLight(lx, ly, -zc, LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, 9, 0.9 * fade);
  }

  /** The herring fleet coming home down the coast far below: each boat on its own line out at sea, sailing on with the
   *  run, its lamp lit as the legend is said and all of them at full while it plays, going on after. */
  private fleetAt(c: Course, time: number, dt: number, s: Snap, lg: NonNullable<Sim['legend']>, phase: number, reduced: boolean, sea: number, shore: (z: number) => number): void {
    if (phase === 0) {
      this.fleetT = 0;
      this.overAt = -1;
    }
    this.fleetT += reduced ? 0 : dt;
    if (phase >= 3 && this.overAt < 0) this.overAt = time;
    const lit = phase === 0 ? 0.25 : phase === 1 ? 0.6 : phase === 2 ? 1 : Math.max(0, 1 - (time - this.overAt) / 6);
    if (lit <= 0.01) return;
    const b = this.boats!;
    const bl = this.boatLamps!;
    const lie = this.boatLie!;
    const n = b.count;
    const span = lg.z1 - lg.z0 + 700;
    for (let i = 0; i < n; i++) {
      const speed = 5 + hash(i, 3) * 4;
      // Strung along the coast round the legend's place, each on its own line out to sea, sailing on down the coast.
      const z = lg.z0 - 300 + ((hash(i, 1) * span + this.fleetT * speed) % span);
      const out = OUT_MIN + (OUT_MAX - OUT_MIN) * (0.15 + 0.85 * hash(i, 2));
      const x = shore(Math.max(0, Math.min(c.finishZ, z))) + out;
      const yaw = -0.08 + 0.16 * hash(i, 4);
      const rock = reduced ? 0 : 0.05 * Math.sin(time * (0.9 + hash(i, 5)) + i);
      tq.setFromAxisAngle(Y, -Math.PI / 2 + yaw);
      tm.compose(tv.set(x, sea + 0.4, -z), tq, ts.set(1.5, 1.5, 1.5));
      tm.multiply(new Matrix4().makeRotationX(rock));
      b.setMatrixAt(i, tm);
      // Its lamp at the masthead, a soft point that holds at any distance (a few pixels a boat from the clifftop).
      const d = Math.hypot(x - s.x, z - s.z);
      tm.compose(tv.set(x, sea + 12, -z), tq.identity(), ts.setScalar(10 + d * 0.035));
      bl.setMatrixAt(i, tm);
      bl.setColorAt(i, tc.copy(LAMP).multiplyScalar((1.3 + 0.4 * hash(i, 6)) * lit));
      // Its light lying on the swell under it, long toward the lens as a light on water lies.
      const toward = Math.atan2(s.x - x, -(s.z - z));
      tq.setFromAxisAngle(Y, toward);
      tm.compose(tv.set(x, sea + 2.5, -z), tq, ts.set(10 + d * 0.008, 1, 50 + d * 0.05));
      lie.setMatrixAt(i, tm);
      lie.setColorAt(i, tc.copy(LAMP).multiplyScalar(0.7 * lit));
    }
    for (const m of [b, bl, lie]) {
      m.visible = true;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    this.hullMat.opacity = 0.85 * Math.min(1, lit + 0.4);
  }

  dispose(): void {
    for (const o of this.root.children) {
      const m = o as Mesh;
      m.geometry?.dispose();
    }
    this.figMat.dispose();
    this.hullMat.dispose();
    this.glowMat.dispose();
    this.lieMat.dispose();
  }
}
