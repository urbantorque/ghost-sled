import { AdditiveBlending, BufferGeometry, Color, CylinderGeometry, DoubleSide, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { Beat } from '../game/beats';
import type { Snap } from '../game/run';
import type { Course } from '../sim/course';
import { type MomentPlay, fallZ, machineZ, momentPlays } from '../sim/moments';
import type { BiomeId } from '../sim/mountains';
import type { Sim } from '../sim/sim';
import { merge, part, shade } from './flora';
import { box, seg } from './landmarkKit';
import { makeToonMaterial } from './materials';
import type { Particles } from './particles';

// The set pieces' own world (round 6, DECISIONS 240): what each verb needs to be seen.
//  - Race: the machine on its cable along the bank, its towers where the ground is open, waiting at its
//    station until the rider arrives and then away at the sim's own schedule (moments.ts machineZ), so what
//    you see racing you is exactly what the sim races you against.
//  - Gates: pairs of lantern light, soft pillars a sled passes through (never posts), a paper lantern
//    floating over each. Threaded, a gate's lanterns rise into the sky; missed, its light gutters.
//  - Collapse: the span's cornices of snow and ice break off at the sim's fall line and drop into the gap
//    behind the rider, with powder; the deck itself holds (a ghost behind you never rides on air).
//  - Rings and steps: a burst where each is flown or stomped (the rings themselves are sky gates, drawn
//    with the stage gates in spirit.ts).
// Everything reads public sim state and the director's beats; nothing is written back.

const LIGHT = new Color('#FFD34D');
const WHITE_GOLD = new Color('#FFF3C4');
const PETAL = new Color('#FFC9DA');
const ICE = new Color('#E4F1FF');

/** How high the cable runs over the bank, in the open and inside a tube or a slot. */
const CABLE_H = 11;
const CABLE_H_IN = 7;
/** How far past the corridor's edge the cable runs (out over a wide lake, no further than CABLE_FAR from the
 *  middle, so the lens keeps it in frame). */
const CABLE_OUT = 2.6;
const CABLE_FAR = 15;
/** A gate's wire over the snow, the foot of its lantern strings, and the lanterns a string holds. */
const WIRE_H = 8.5;
const STRING_LOW = 2.8;
const PER_STRING = 3;
/** A set piece's world is drawn from this far up the run. */
const SHOW_M = 520;
const LANTERN_K = 1.7;
const GARLAND = new Color('#FFE29A').multiplyScalar(1.4);

interface Machine {
  play: MomentPlay;
  cabin: Mesh;
  /** Where the cabin stood last frame, and whether the race is over for it. */
  z: number;
}

interface GateLook {
  play: MomentPlay;
  /** Per gate: 0 waiting, 1 threaded (its lanterns rise), -1 missed; and when it changed. */
  state: number[];
  at: number[];
  /** Index of the first pillar and lantern instance of this play's gates. */
  base: number;
}

const tm = new Matrix4();
const tq = new Quaternion();
const tv = new Vector3();
const ts = new Vector3();
const tc = new Color();

/** A soft pillar of light: brightest in a band up its middle, gone at its foot and its head. Additive. */
function pillarMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
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
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float core = pow(across, 2.2);
        float up = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));
        float a = core * up;
        vec3 c = mix(vCol, vec3(1.0, 0.98, 0.9) * length(vCol) * 0.62, pow(across, 6.0));
        gl_FragColor = vec4(c * a, 1.0);
      }
    `,
  });
}

/** A pool of lantern light on the snow in a gate's opening: an ellipse that fades to nothing. Additive. */
function poolMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
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
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        float r = dot(d, d);
        float a = (1.0 - smoothstep(0.15, 1.0, r)) * 0.5;
        gl_FragColor = vec4(vCol * a, 1.0);
      }
    `,
  });
}

/** A paper lantern: a rounded drum with a dark cap and foot. */
function lanternGeometry(): BufferGeometry {
  const body = new CylinderGeometry(0.34, 0.34, 0.62, 10);
  const pos = body.getAttribute('position');
  // Bulge the drum (a paper lantern is fuller at its waist).
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 + 0.32 * (1 - Math.min(1, Math.abs(y) / 0.31) ** 2);
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  return merge([part(body, '#FFC46A'), box(0.36, 0.08, 0.36, new Color('#3A2A30'), [0, 0.35, 0]), box(0.3, 0.06, 0.3, new Color('#3A2A30'), [0, -0.34, 0])]);
}

/** The cabin each mountain races you with: a cable car, a research-station gondola, an ore skip, a lacquered
 *  car. Built in its own frame (facing +z, hanger at the origin), its windows lit so it reads against snow. */
function cabinGeometry(key: string, biome: BiomeId): BufferGeometry {
  const lit = new Color('#FFD08A').multiplyScalar(1.7);
  const dark = new Color('#2A2D48');
  const parts: BufferGeometry[] = [seg([0, 0, 0], [0, -1.15, 0], 0.07, dark), box(0.5, 0.18, 1.2, dark, [0, 0.05, 0])];
  const kind = key === 'cindergate' ? 'skip' : key === 'crevasse' ? 'gondola' : biome === 'volcanic' ? 'skip' : biome === 'glacier' ? 'gondola' : biome === 'blossom' ? 'lacquer' : 'car';
  if (kind === 'skip') {
    // An iron bucket of ore, glowing from inside, with a lamp on its lip.
    const iron = new Color('#3B3036');
    parts.push(box(2.2, 1.3, 2.6, iron, [0, -1.9, 0]), box(2.4, 0.16, 2.8, shade(iron, 1.3), [0, -1.24, 0]));
    parts.push(box(1.9, 0.3, 2.3, new Color('#FF8A3A').multiplyScalar(1.6), [0, -1.22, 0]));
    parts.push(box(0.26, 0.26, 0.26, lit, [0.95, -1.05, 1.2]));
  } else {
    const body = kind === 'gondola' ? new Color('#B5523E') : kind === 'lacquer' ? new Color('#5E2A3A') : new Color('#2F4A6E');
    const band = kind === 'lacquer' ? new Color('#EDE4D8') : new Color('#F0E6D2');
    const w = kind === 'gondola' ? 2.4 : 2.6;
    parts.push(box(w, 2.1, 3.2, body, [0, -2.35, 0]));
    parts.push(box(w + 0.12, 0.34, 3.32, band, [0, -1.95, 0]));
    // Windows all round, lit warm.
    parts.push(box(w + 0.04, 0.72, 2.6, lit, [0, -2.25, 0]));
    parts.push(box(w - 0.5, 0.72, 3.24, lit, [0, -2.25, 0]));
    parts.push(box(w + 0.2, 0.22, 3.4, shade(body, 0.62), [0, -1.24, 0]));
    parts.push(box(w * 0.92, 0.16, 3.0, shade(body, 0.7), [0, -3.42, 0]));
  }
  return merge(parts);
}

export class MarqueeWorld {
  readonly root = new Object3D();
  private plays: readonly MomentPlay[] = [];
  private biome: BiomeId = 'alpine';
  private readonly statics: Mesh[] = [];
  /** Each set piece's meshes and the stretch of course they belong to: drawn only within SHOW_M of the rider,
   *  so a run pays for the one ahead and nothing else. */
  private readonly shown: { objs: Object3D[]; z0: number; z1: number }[] = [];
  private machines: Machine[] = [];
  private gates: GateLook[] = [];
  private pillars: InstancedMesh | null = null;
  private pools: InstancedMesh | null = null;
  private lanterns: InstancedMesh | null = null;
  private readonly chunks: InstancedMesh;
  private readonly chunkState: { x: number; y: number; z: number; vx: number; vy: number; vz: number; r: number; spin: number; life: number }[] = [];
  private chunkNext = 0;
  private fallAcc = 0;
  private lastFall = -1e9;
  private readonly toon = makeToonMaterial({ coolShade: 0.1, rim: 0.4 });
  private readonly lanternMat = makeToonMaterial({ coolShade: 0.05, emissive: new Color('#FFC46A'), emissiveStrength: 0.9, rim: 0.3 });
  private readonly pillarMat = pillarMaterial();
  private readonly poolMat = poolMaterial();
  /** The set piece the director is playing (from its beats), so steps and misses land on the right gate. */
  private active: { key: string; seen: number } | null = null;

  constructor(private readonly particles: Particles) {
    const chunk = new IcosahedronGeometry(1, 0);
    this.chunks = new InstancedMesh(part(chunk, ICE, { jitter: 0.25 }), makeToonMaterial({ coolShade: 0.25, ice: true }), 36);
    this.chunks.count = 0;
    this.chunks.frustumCulled = false;
    this.chunks.visible = false;
    this.root.add(this.chunks);
    for (let i = 0; i < 36; i++) this.chunkState.push({ x: 0, y: -1e4, z: 0, vx: 0, vy: 0, vz: 0, r: 0.5, spin: 0, life: 0 });
  }

  setCourse(c: Course): void {
    for (const m of this.statics) {
      this.root.remove(m);
      m.geometry.dispose();
    }
    this.statics.length = 0;
    this.shown.length = 0;
    for (const m of this.machines) {
      this.root.remove(m.cabin);
      m.cabin.geometry.dispose();
    }
    if (this.pillars) this.root.remove(this.pillars);
    if (this.lanterns) this.root.remove(this.lanterns);
    if (this.pools) this.root.remove(this.pools);
    this.pools = null;
    this.pillars = null;
    this.lanterns = null;
    this.machines = [];
    this.gates = [];
    this.biome = c.biome;
    this.plays = momentPlays(c);
    for (const p of this.plays) {
      if (p.verb === 'race') this.buildMachine(c, p);
      else if (p.verb === 'gates' && p.gates.length) this.gates.push({ play: p, state: p.gates.map(() => 0), at: p.gates.map(() => 0), base: 0 });
    }
    this.buildGates(c);
    this.reset();
  }

  /** A new run on the same course: every machine back at its station, every gate lit again. */
  reset(): void {
    this.active = null;
    for (const m of this.machines) m.z = m.play.z0 + m.play.lead;
    for (const g of this.gates) {
      g.state.fill(0);
      g.at.fill(0);
    }
    for (const s of this.chunkState) s.life = 0;
    this.chunks.count = 0;
    this.lastFall = -1e9;
  }

  private cableAt(c: Course, side: number, z: number, out: Vector3): Vector3 {
    const k = c.section(z).kind;
    const inside = k === 'tunnel' || k === 'ravine' || k === 'street';
    // In a tube the wall stands 3 m past the edge: the cable runs just over the edge, clear of it.
    const off = k === 'tunnel' ? 0.8 : CABLE_OUT;
    const x = c.centerX(z) + side * Math.min(CABLE_FAR, c.halfWidth(z) + off);
    // Over the bank's own ground where it rises, never into it.
    const y = Math.max(c.baseY(z) + (inside ? CABLE_H_IN : CABLE_H), c.ground(x, z) + 6.5);
    return out.set(x, y, -z);
  }

  private buildMachine(c: Course, p: MomentPlay): void {
    const dark = new Color('#2A2D48');
    const parts: BufferGeometry[] = [];
    const a = new Vector3();
    const b = new Vector3();
    const from = p.z0 - 20;
    const to = p.z1 + 24;
    // The cable, in short straight runs that follow the bank.
    for (let z = from; z < to; z += 6) {
      this.cableAt(c, p.side, z, a);
      this.cableAt(c, p.side, Math.min(to, z + 6), b);
      parts.push(seg([a.x, a.y, a.z], [b.x, b.y, b.z], 0.06, dark, 3));
    }
    // Towers where the ground is open; in a tube or a slot the cable rides brackets on the wall.
    const wood = this.biome === 'volcanic' ? new Color('#3B3036') : this.biome === 'blossom' ? new Color('#5E2A3A') : this.biome === 'glacier' ? new Color('#6A7088') : new Color('#4E3428');
    for (let z = from + 4; z < to; z += 54) {
      const k = c.section(z).kind;
      this.cableAt(c, p.side, z, a);
      if (k === 'tunnel' || k === 'ravine' || k === 'street' || k === 'bridge') {
        parts.push(box(1.4, 0.3, 0.3, dark, [a.x - p.side * 0.5, a.y + 0.1, a.z]));
        continue;
      }
      const g = c.ground(a.x, z);
      parts.push(seg([a.x - 0.9, g - 0.4, a.z], [a.x - 0.15, a.y + 0.8, a.z], 0.16, wood), seg([a.x + 0.9, g - 0.4, a.z], [a.x + 0.15, a.y + 0.8, a.z], 0.16, wood));
      parts.push(box(2.6, 0.26, 0.5, shade(wood, 0.8), [a.x, a.y + 0.75, a.z]), box(0.5, 0.5, 0.5, dark, [a.x, a.y + 0.35, a.z]));
    }
    // The stations at each end: a roofed house on the bank the cable runs into.
    for (const z of [p.z0 + p.lead, p.z1 + 6]) {
      this.cableAt(c, p.side, z, a);
      const k = c.section(z).kind;
      if (k === 'tunnel' || k === 'ravine') continue;
      const g = c.ground(a.x + p.side * 2, z);
      const house = this.biome === 'glacier' ? new Color('#B5523E') : this.biome === 'volcanic' ? new Color('#4A3A40') : this.biome === 'blossom' ? new Color('#EDE4D8') : new Color('#ECE4D6');
      const roof = this.biome === 'blossom' ? new Color('#3E3A50') : new Color('#3A3448');
      const h = a.y - g + 1.4;
      parts.push(box(4.2, h, 5, house, [a.x + p.side * 2.2, g + h / 2 - 0.4, a.z]), box(5.2, 0.5, 6, roof, [a.x + p.side * 2.2, g + h, a.z]));
      parts.push(box(1.6, 1.6, 0.2, new Color('#FFD08A').multiplyScalar(1.5), [a.x + p.side * 2.2, a.y - 1.6, a.z + 2.55]));
    }
    const mesh = new Mesh(merge(parts), this.toon);
    this.statics.push(mesh);
    this.root.add(mesh);
    const cabin = new Mesh(cabinGeometry(p.key, this.biome).scale(1.35, 1.35, 1.35), this.toon);
    this.root.add(cabin);
    this.shown.push({ objs: [mesh, cabin], z0: from, z1: to });
    this.machines.push({ play: p, cabin, z: p.z0 + p.lead });
  }

  private buildGates(c: Course): void {
    let n = 0;
    for (const g of this.gates) {
      g.base = n;
      n += g.play.gates.length;
    }
    if (n === 0) return;
    // A gate is two strings of paper lanterns hung from a wire across the run, the opening between them:
    // solid marigold that reads on bright snow, and nothing standing on the snow, so a sled that misses a gate
    // brushes through a string of paper, never a post. Under each string a soft pillar of light, which is
    // what carries the gate at dusk, at night and in the cavern.
    const plane = new PlaneGeometry(1.1, 4.2);
    plane.translate(0, 2.1, 0);
    const cross = plane.clone().rotateY(Math.PI / 2);
    const pillars = new InstancedMesh(merge([plane, cross].map((q) => q.toNonIndexed())), this.pillarMat, n * 2);
    pillars.renderOrder = 6;
    const lanterns = new InstancedMesh(lanternGeometry().scale(LANTERN_K, LANTERN_K, LANTERN_K), this.lanternMat, n * 2 * PER_STRING);
    const disc = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pools = new InstancedMesh(disc, this.poolMat, n);
    pools.renderOrder = 5;
    const cord = new Color('#2A2D48');
    const wires: BufferGeometry[] = [];
    const garland: BufferGeometry[] = [];
    for (const g of this.gates) {
      g.play.gates.forEach((q, i) => {
        const y0 = c.ground(q.x, q.z);
        const wy = y0 + WIRE_H;
        const half = c.halfWidth(q.z) + 1.2;
        const cx = c.centerX(q.z);
        wires.push(seg([cx - half, wy + 0.6, -q.z], [cx + half, wy + 0.6, -q.z], 0.045, cord, 3));
        tm.compose(tv.set(q.x, y0 + 0.08, -q.z), tq.identity(), ts.set(2 * q.hw + 1.4, 1, 4.2));
        pools.setMatrixAt(g.base + i, tm);
        pools.setColorAt(g.base + i, LIGHT);
        // A garland of small lights sags between the two strings' heads: the gate's lintel.
        const xa = q.x - q.hw - 0.15;
        const xb = q.x + q.hw + 0.15;
        for (let j = 0; j <= 6; j++) {
          const u = j / 6;
          const x = xa + (xb - xa) * u;
          const y = y0 + STRING_LOW + PER_STRING * 0.95 + 0.5 - 0.7 * Math.sin(Math.PI * u);
          garland.push(box(0.26, 0.26, 0.26, GARLAND, [x, y, -q.z]));
          if (j < 6) wires.push(seg([x, y, -q.z], [xa + (xb - xa) * ((j + 1) / 6), y0 + STRING_LOW + PER_STRING * 0.95 + 0.5 - 0.7 * Math.sin(Math.PI * ((j + 1) / 6)), -q.z], 0.02, cord, 3));
        }
        for (let s = 0; s < 2; s++) {
          const x = q.x + (s === 0 ? -1 : 1) * (q.hw + 0.15);
          const k = (g.base + i) * 2 + s;
          wires.push(seg([x, wy + 0.6, -q.z], [x, y0 + STRING_LOW, -q.z], 0.03, cord, 3));
          tm.compose(tv.set(x, c.ground(x, q.z), -q.z), tq.identity(), ts.set(1, 1, 1));
          pillars.setMatrixAt(k, tm);
          pillars.setColorAt(k, LIGHT);
          for (let j = 0; j < PER_STRING; j++) {
            tm.compose(tv.set(x, y0 + STRING_LOW + 0.3 + j * 0.95, -q.z), tq.identity(), ts.setScalar(1 - j * 0.12));
            lanterns.setMatrixAt(k * PER_STRING + j, tm);
          }
        }
      });
    }
    const wireMesh = new Mesh(merge(wires), this.toon);
    this.statics.push(wireMesh);
    const garMesh = new Mesh(merge(garland), this.lanternMat);
    this.statics.push(garMesh);
    this.root.add(garMesh);
    // Instanced: their bounds are their instances' (a threaded gate's lanterns rise out of them, and the
    // frame they rise in is the one the rider is in, so a stale bound never hides one in view).
    pillars.computeBoundingSphere();
    pools.computeBoundingSphere();
    this.pools = pools;
    this.root.add(pools);
    lanterns.computeBoundingSphere();
    lanterns.frustumCulled = false;
    const z0 = Math.min(...this.gates.map((g) => g.play.z0)) - 40;
    const z1 = Math.max(...this.gates.map((g) => g.play.z1)) + 40;
    this.shown.push({ objs: [pillars, lanterns, wireMesh, garMesh, pools], z0, z1 });
    this.pillars = pillars;
    this.lanterns = lanterns;
    this.root.add(pillars, lanterns, wireMesh);
  }

  /** The director's beats: which set piece is on, and each gate threaded or missed as the sim decides it. */
  beats(list: readonly Beat[], s: Snap): void {
    for (const b of list) {
      if (b.type === 'marquee' && b.phase === 'enter') this.active = { key: b.key, seen: 0 };
      if (b.type !== 'moment') continue;
      const carrier = tv.set(s.vx, 0, -s.vz);
      if (b.verb === 'gates' && (b.phase === 'step' || b.phase === 'miss')) {
        const g = this.gates.find((q) => q.play.key === b.key);
        const a = this.active;
        if (!g || !a || a.key !== b.key) continue;
        const i = a.seen++;
        if (i >= g.state.length) continue;
        g.state[i] = b.phase === 'step' ? 1 : -1;
        g.at[i] = performance.now() / 1000;
        if (b.phase === 'step') {
          const q = g.play.gates[i];
          this.particles.sparkle(ts.set(q.x, s.y + 1.4, -q.z), WHITE_GOLD, 22, 3.4, 0.6, 0.24, carrier, 0.5);
        }
      } else if (b.verb === 'rings' && b.phase === 'step') {
        this.particles.sparkle(ts.set(s.x, s.y + 0.8, -s.z), WHITE_GOLD, 30, 4, 0.7, 0.26, carrier, 0.3);
      } else if (b.verb === 'steps' && b.phase === 'step') {
        this.particles.sparkle(ts.set(s.x, s.y + 0.6, -s.z), PETAL, 26, 3.6, 0.9, 0.24, carrier, 0.6);
      } else if (b.phase === 'won') {
        this.particles.sparkle(ts.set(s.x, s.y + 1.2, -s.z), LIGHT, 40, 4.5, 0.8, 0.28, carrier, 0.5);
      }
    }
  }

  /** Per frame: the machines where the sim's schedule puts them, the gates' light, the span's fall. */
  update(dt: number, time: number, mode: 'run' | 'title' | 'results', s: Snap, sim: Sim | null, low: boolean): void {
    const now = performance.now() / 1000;
    for (const g of this.shown) {
      const on = s.z > g.z0 - SHOW_M && s.z < g.z1 + 30;
      if (g.objs[0].visible !== on) for (const o of g.objs) o.visible = on;
    }
    const c = sim?.course;
    for (const m of this.machines) {
      const p = m.play;
      let z = p.z0 + p.lead;
      if (sim && mode !== 'title') {
        const mo = sim.mo;
        if (mo.active === p.index) z = machineZ(p, sim.tick - mo.t0);
        else if (mo.next > p.index) z = Math.min(p.z1, m.z + 34 * dt);
        else if (mo.next <= p.index) z = p.z0 + p.lead;
      }
      m.z = z;
      if (!c) continue;
      this.cableAt(c, p.side, z, tv);
      // It swings a little on its hanger as it goes, more as it leaves and arrives.
      const sway = 0.06 * Math.sin(time * 1.7 + p.index) + (z > p.z0 + p.lead + 1 && z < p.z1 - 1 ? 0.03 : 0);
      m.cabin.position.copy(tv);
      const ahead = this.cableAt(c, p.side, z + 4, ts);
      m.cabin.rotation.set(0, Math.atan2(ahead.x - tv.x, ahead.z - tv.z), sway);
    }
    if (this.pillars && this.lanterns && c && this.pillars.visible) {
      let dirty = false;
      for (const g of this.gates) {
        g.play.gates.forEach((q, i) => {
          const st = g.state[i];
          const age = now - g.at[i];
          for (let k = 0; k < 2; k++) {
            const idx = (g.base + i) * 2 + k;
            // The next gate burns brightest and breathes, so the eye goes to it through a festival street;
            // later ones wait dimmer. Threaded: a white-gold flare, then gone. Missed: an ember glow.
            const next = this.active?.key === g.play.key ? i === this.active.seen : i === 0;
            let lum = next ? 1.55 + 0.45 * Math.sin(time * 6.2) : 0.55 + 0.15 * Math.sin(time * 2.4 + i * 1.3 + k);
            let col = LIGHT;
            if (st === 1) {
              lum = age < 0.25 ? 2.2 : Math.max(0, 1.6 * (1 - (age - 0.25) / 0.9));
              col = WHITE_GOLD;
            } else if (st === -1) lum = 0.22;
            this.pillars!.setColorAt(idx, tc.copy(col).multiplyScalar(lum * (low ? 1.25 : 1)));
            if (k === 0 && this.pools) this.pools.setColorAt(g.base + i, tc.copy(col).multiplyScalar(lum * (low ? 1.2 : 1)));
            if (st === 1 && age < 8) {
              // Threaded: its lanterns slip their string and rise into the sky, drifting apart.
              for (let j = 0; j < PER_STRING; j++) {
                const t = Math.max(0, age - j * 0.12);
                const x = q.x + (k === 0 ? -1 : 1) * (q.hw + 0.15 + t * (0.3 + 0.15 * j));
                const y = c.ground(q.x, q.z) + STRING_LOW + 0.3 + j * 0.95 + t * (2 + t * 0.55);
                tm.compose(tv.set(x, y, -q.z), tq.identity(), ts.setScalar(age > 7.5 ? 0.001 : 1 - j * 0.12));
                this.lanterns!.setMatrixAt(idx * PER_STRING + j, tm);
              }
              dirty = true;
            }
          }
        });
      }
      if (this.pillars.instanceColor) this.pillars.instanceColor.needsUpdate = true;
      if (this.pools?.instanceColor) this.pools.instanceColor.needsUpdate = true;
      if (dirty) this.lanterns.instanceMatrix.needsUpdate = true;
    }
    this.collapse(dt, s, sim, low);
  }

  /** While a collapse plays, the span's cornices break off at the sim's fall line and drop away. */
  private collapse(dt: number, s: Snap, sim: Sim | null, low: boolean): void {
    let live = 0;
    if (sim && sim.mo.active >= 0) {
      const p = this.plays[sim.mo.active];
      if (p && p.verb === 'collapse') {
        const c = sim.course;
        const fz = fallZ(p, sim.tick - sim.mo.t0, sim.mo.pace);
        this.fallAcc += dt;
        const step = low ? 0.11 : 0.055;
        if (fz > p.z0 - 2 && fz < p.z1 && this.fallAcc > step) {
          this.fallAcc = 0;
          for (const side of [-1, 1]) {
            const st = this.chunkState[this.chunkNext];
            this.chunkNext = (this.chunkNext + 1) % this.chunkState.length;
            const x = c.centerX(fz) + side * (c.halfWidth(fz) + 0.4 + Math.random() * 0.8);
            st.x = x;
            st.z = fz + (Math.random() - 0.5) * 2;
            st.y = c.ground(x, st.z) + 0.2;
            st.vx = side * (0.8 + Math.random() * 1.6);
            st.vy = 0.5 + Math.random();
            st.vz = (Math.random() - 0.5) * 0.8;
            st.r = 0.35 + Math.random() * 0.75;
            st.spin = (Math.random() - 0.5) * 6;
            st.life = 3.2;
          }
          if (fz - this.lastFall > 3) {
            this.lastFall = fz;
            for (const side of [-1, 1]) this.particles.burst(tv.set(c.centerX(fz) + side * c.halfWidth(fz), c.baseY(fz) + 0.3, -fz), 0.8, low ? 6 : 12, undefined, ICE);
          }
        }
      }
    }
    for (const st of this.chunkState) {
      if (st.life <= 0) continue;
      st.life -= dt;
      st.vy -= 9.81 * dt;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      st.z += st.vz * dt;
      const t = 3.2 - st.life;
      tq.setFromAxisAngle(tv.set(0.6, 0.3, 0.74).normalize(), st.spin * t);
      tm.compose(tv.set(st.x, st.y, -st.z), tq, ts.setScalar(st.r));
      this.chunks.setMatrixAt(live++, tm);
    }
    this.chunks.count = live;
    this.chunks.visible = live > 0;
    if (live > 0) this.chunks.instanceMatrix.needsUpdate = true;
    void s;
  }
}
