import { type BufferGeometry, Color, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Matrix4, Mesh, Object3D, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { Snap } from '../game/run';
import type { Course } from '../sim/course';
import type { Sim } from '../sim/sim';
import type { Breaks } from './breaks';
import type { Fireworks } from './fireworks';
import { makeToonMaterial, shared } from './materials';
import type { Particles } from './particles';

// Round 7 (the momentsworld lane): what the set pieces' and the legends' worlds are drawn with. A stage
// (verbworld.ts, legendworld.ts, climaxworld.ts) puts what it shows this frame into pooled instanced
// draws and the kit hides every draw that holds nothing, so a run pays for the one thing in front of
// the rider and an idle mountain pays for nothing.
//   kit.glow   a camera-facing sprite of light (additive): a halo, a ring, a star, a flame
//   kit.decal  a mark of light lying on the snow, tilted to the slope: a pool, a ring, a scribed line,
//              a chevron, ripples
//   kit.pool   a pooled instanced mesh of one solid form (a lantern, a bell, a crane): put() it each frame
// Everything takes positions in the sim's frame (x across, y up, z metres down the course); the kit
// turns z into three.js space. Nothing here is a collider and nothing is written back to the sim.

/** 0 Low (and the phone's cheap form), 1 Medium, 2 High, 3 Ultra. */
export type Tier = 0 | 1 | 2 | 3;

/** One of a tier's four budgets. */
export function tiered<T>(t: Tier, v: readonly [T, T, T, T]): T {
  return v[t];
}

export const GLOW_SOFT = 0;
export const GLOW_RING = 1;
export const GLOW_STAR = 2;
export const GLOW_FLAME = 3;
export const DECAL_POOL = 0;
export const DECAL_RING = 1;
export const DECAL_LINE = 2;
export const DECAL_CHEVRON = 3;
export const DECAL_RIPPLE = 4;

const GLOW_CAP: readonly [number, number, number, number] = [72, 180, 360, 440];
const DECAL_CAP: readonly [number, number, number, number] = [56, 120, 200, 240];

const tm = new Matrix4();
const tq = new Quaternion();
const tp = new Vector3();
const ts = new Vector3();
const tc = new Color();
const ax = new Vector3();
const ay = new Vector3();
const az = new Vector3();
const ID = new Quaternion();

/** What a stage is handed each frame. */
export interface StageCtx {
  dt: number;
  /** The world's clock (it stands still on a paused frame). */
  time: number;
  mode: 'run' | 'title' | 'results';
  s: Snap;
  sim: Sim | null;
  course: Course;
  tier: Tier;
  low: boolean;
  /** Reduced motion: keep every beat, drop the motion (no swing, no flicker, no travelling wave). */
  reduced: boolean;
  kit: MomentKit;
  particles: Particles;
  fireworks: Fireworks | null;
  breaks: Breaks | null;
}

/** A pooled instanced form. put() what is there this frame; the kit hides it when nothing was put. */
export class Pool {
  n = 0;
  constructor(readonly mesh: InstancedMesh, readonly cap: number) {}

  /** A form at a sim-frame place. `q` null stands it upright; `lum` scales its colour (over 1 blooms). */
  put(x: number, y: number, z: number, q: Quaternion | null, sx: number, sy: number, sz: number, col: Color | null = null, lum = 1): boolean {
    if (this.n >= this.cap) return false;
    tm.compose(tp.set(x, y, -z), q ?? ID, ts.set(sx, sy, sz));
    this.mesh.setMatrixAt(this.n, tm);
    if (col) this.mesh.setColorAt(this.n, tc.copy(col).multiplyScalar(lum));
    this.n++;
    return true;
  }
}

/** The brightest a lit form may be drawn: Low has no bloom and no film curve, so a colour over 1 clips to a
 *  white block there. Capped by its brightest channel, it keeps its hue. */
const LIT_CAP = { value: 8 };

/** Paper lit from inside, and anything else that is its own light: vertex colour times the instance's, a
 *  little form from the normal, the mood's fog, no lighting. A colour over 1 blooms. */
export function litMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexColors: true,
    uniforms: { uFog: shared.uFog, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uCap: LIT_CAP },
    vertexShader: /* glsl */ `
      varying vec3 vCol;
      varying float vForm;
      varying float vDist;
      varying float vUp;
      void main() {
        vCol = color;
        #ifdef USE_INSTANCING_COLOR
          vCol *= instanceColor;
        #endif
        #ifdef USE_INSTANCING
          mat4 m = modelMatrix * instanceMatrix;
        #else
          mat4 m = modelMatrix;
        #endif
        vec3 n = normalize(mat3(m) * normal);
        vec4 wp = m * vec4(position, 1.0);
        // (Brightest where it faces the lens and deeper at its rim, so a drum of paper reads as round and
        // lit from inside, never as a flat block of its colour.)
        float facing = abs(dot(n, normalize(cameraPosition - wp.xyz)));
        vForm = (0.5 + 0.6 * facing * facing) * (0.9 + 0.1 * n.y);
        vec4 mv = viewMatrix * wp;
        vDist = -mv.z;
        vUp = wp.y - cameraPosition.y;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uCap;
      varying vec3 vCol;
      varying float vForm;
      varying float vDist;
      varying float vUp;
      void main() {
        // (A light in fog is seen further than a wall is: half the fog.)
        float f = 0.5 * smoothstep(uFogNear, uFogFar, vDist);
        // (A lantern the lens passes through dissolves over its last metres, as the world's props do: at the
        // lens it would be a block of its colour across the frame.)
        // (The review loop: dithered from 7 m in, a street's near lanterns hung as half-transparent
        // scanline ghosts across the top of a still. Each holds solid to 5.2 m and is gone by 4.4 m.)
        // (Round 8's review, Frostfang: a gate's lanterns hanging over the run 5 to 7 m ahead of the lens were two great
        // blocks of their colour across the top of the frame in the Ice Cavern. What hangs over the lens goes over
        // ART.md 14's last 7 m, gone by 6.6 m; a bell or a wheel by the snow, which the rider meets, keeps 4.4 m.)
        float near0 = mix(4.4, 6.6, smoothstep(0.2, 1.4, vUp));
        float thr = (mod(floor(gl_FragCoord.x), 2.0) + 2.0 * mod(floor(gl_FragCoord.y), 2.0)) / 4.0 + 0.125;
        if (smoothstep(near0, near0 + 0.8, vDist) < thr) discard;
        vec3 c = vCol * vForm;
        c *= min(1.0, uCap / max(max(c.r, max(c.g, c.b)), 0.001));
        gl_FragColor = vec4(mix(c, uFog, f), 1.0);
      }
    `,
  });
}

// (Both of the kit's own materials are premultiplied and cover a part of what is behind them: pure added
// light is lost on sunlit snow and on a bright sky, where half of a run is ridden. At night the cover is
// nothing and they are light.)
function glowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    uniforms: { uTime: shared.uTime },
    vertexShader: /* glsl */ `
      attribute vec4 aCenter;
      attribute vec4 aTint;
      attribute vec4 aShape;
      varying vec2 vP;
      varying vec4 vTint;
      varying float vSeed;
      void main() {
        vP = position.xy * 2.0;
        vTint = aTint;
        vSeed = aShape.z;
        vec4 mv = viewMatrix * vec4(aCenter.xyz, 1.0);
        float c = cos(aShape.y);
        float s = sin(aShape.y);
        vec2 p = position.xy * aCenter.w * vec2(aShape.x, 1.0);
        mv.xy += vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vP;
      varying vec4 vTint;
      varying float vSeed;
      void main() {
        float r = length(vP);
        float edge = max(0.0, 1.0 - r);
        float a;
        if (vTint.a < 0.5) {
          // A halo: a hot heart in a soft fall.
          a = edge * edge * 0.55 + exp(-r * r * 14.0) * 0.9;
        } else if (vTint.a < 1.5) {
          // A ring.
          float d = (r - 0.78) / 0.09;
          a = exp(-d * d) + edge * edge * 0.08;
        } else if (vTint.a < 2.5) {
          // A star: four rays and a heart.
          vec2 q = abs(vP);
          float ray = max(0.0, 1.0 - q.x * 9.0) * max(0.0, 1.0 - q.y) + max(0.0, 1.0 - q.y * 9.0) * max(0.0, 1.0 - q.x);
          a = ray * 0.8 + exp(-r * r * 22.0);
        } else {
          // A flame: a teardrop that leans and licks.
          float lick = sin(uTime * 13.0 + vSeed * 40.0 + vP.y * 4.0) * 0.12 * (vP.y + 1.0);
          float x = (vP.x + lick) / max(0.12, 0.62 * (1.0 - vP.y * 0.5 - 0.5) + 0.1);
          float body = max(0.0, 1.0 - x * x) * smoothstep(-1.0, -0.6, vP.y) * max(0.0, 1.0 - max(vP.y, 0.0));
          a = body * body * 1.3 + exp(-dot(vP - vec2(0.0, -0.45), vP - vec2(0.0, -0.45)) * 9.0) * 0.6;
        }
        a = min(a, 1.6);
        gl_FragColor = vec4(vTint.rgb * a, min(1.0, a) * 0.5);
      }
    `,
  });
}

function decalMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    polygonOffset: true,
    // (The drawn snow is a mesh and c.ground() is the surface it samples: between its vertices a mark must
    // be pulled well toward the lens or the slope buries it.)
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -14,
    vertexShader: /* glsl */ `
      attribute float aKind;
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vKind;
      void main() {
        vUv = uv;
        vKind = aKind;
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
      varying float vKind;
      void main() {
        vec2 d = (vUv - 0.5) * 2.0;
        float r = length(d);
        float edge = max(0.0, 1.0 - r);
        float a;
        if (vKind < 0.5) {
          a = edge * edge * (3.0 - 2.0 * edge) * 0.55;
        } else if (vKind < 1.5) {
          float k = (r - 0.8) / 0.12;
          a = exp(-k * k) * 1.0 + edge * edge * 0.12;
        } else if (vKind < 2.5) {
          // A line scribed down the mark's length: a fine bright core in a soft band, gone at both ends.
          float across = max(0.0, 1.0 - abs(d.x));
          float ends = smoothstep(0.0, 0.12, 1.0 - abs(d.y));
          a = (exp(-d.x * d.x * 60.0) + across * across * 0.22) * ends;
        } else if (vKind < 3.5) {
          // A chevron pointing down the run.
          float v = d.y - (0.55 - abs(d.x) * 0.9);
          float k = v / 0.34;
          a = exp(-k * k * k * k) * smoothstep(0.0, 0.25, 1.0 - abs(d.x)) * 1.2;
        } else {
          // Ripples: three rings, the outer the faintest.
          float w = max(0.0, sin(r * 9.42)) ;
          a = w * w * edge * 0.9;
        }
        a = min(a, 1.4);
        gl_FragColor = vec4(vCol * a, min(1.0, a) * 0.92);
      }
    `,
  });
}

export class MomentKit {
  readonly root = new Object3D();
  /** Shared by every stage: the world's toon (dark timber, rope, iron) and paper lit from inside. */
  readonly toon = makeToonMaterial({ coolShade: 0.1, rim: 0.4 });
  readonly lit = litMaterial();
  private readonly pools: Pool[] = [];
  private readonly glows: Mesh;
  private readonly gCenter: InstancedBufferAttribute;
  private readonly gTint: InstancedBufferAttribute;
  private readonly gShape: InstancedBufferAttribute;
  private readonly gGeo: InstancedBufferGeometry;
  private nGlow = 0;
  private glowCap = GLOW_CAP[2];
  private readonly decals: InstancedMesh;
  private readonly dKind: InstancedBufferAttribute;
  private nDecal = 0;
  private decalCap = DECAL_CAP[2];
  tier: Tier = 2;

  constructor() {
    const max = GLOW_CAP[3];
    const quad = new PlaneGeometry(1, 1);
    const g = new InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    this.gCenter = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.gTint = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.gShape = new InstancedBufferAttribute(new Float32Array(max * 4), 4);
    g.setAttribute('aCenter', this.gCenter);
    g.setAttribute('aTint', this.gTint);
    g.setAttribute('aShape', this.gShape);
    g.instanceCount = 0;
    this.gGeo = g;
    this.glows = new Mesh(g, glowMaterial());
    this.glows.frustumCulled = false;
    this.glows.renderOrder = 7;
    this.glows.visible = false;
    const dmax = DECAL_CAP[3];
    const plane = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.dKind = new InstancedBufferAttribute(new Float32Array(dmax), 1);
    plane.setAttribute('aKind', this.dKind);
    this.decals = new InstancedMesh(plane, decalMaterial(), dmax);
    this.decals.setColorAt(0, tc.set(1, 1, 1));
    this.decals.count = 0;
    this.decals.frustumCulled = false;
    this.decals.renderOrder = 5;
    this.decals.visible = false;
    this.root.add(this.decals, this.glows);
  }

  setTier(t: Tier): void {
    this.tier = t;
    LIT_CAP.value = t === 0 ? 1 : 8;
    this.glowCap = GLOW_CAP[t];
    this.decalCap = DECAL_CAP[t];
  }

  /** A pooled form of `cap` instances at most, drawn with `mat` (the kit's toon when none is given). */
  pool(geo: BufferGeometry, cap: number, mat: ShaderMaterial = this.toon): Pool {
    const mesh = new InstancedMesh(geo, mat, cap);
    mesh.setColorAt(0, tc.set(1, 1, 1));
    mesh.count = 0;
    mesh.visible = false;
    mesh.frustumCulled = false;
    this.root.add(mesh);
    const p = new Pool(mesh, cap);
    this.pools.push(p);
    return p;
  }

  /** Start a frame: nothing is drawn until a stage puts it. */
  begin(): void {
    this.nGlow = 0;
    this.nDecal = 0;
    for (const p of this.pools) p.n = 0;
  }

  /** A sprite of light at a sim-frame place, `size` metres tall; `aspect` widens it, `rot` turns it. */
  glow(x: number, y: number, z: number, size: number, col: Color, lum = 1, kind = GLOW_SOFT, aspect = 1, rot = 0): void {
    if (this.nGlow >= this.glowCap || !(lum > 0.004)) return;
    const i = this.nGlow++;
    this.gCenter.setXYZW(i, x, y, -z, size);
    this.gTint.setXYZW(i, col.r * lum, col.g * lum, col.b * lum, kind);
    this.gShape.setXYZW(i, aspect, rot, (i * 0.618034) % 1, 0);
  }

  /** A mark of light on the snow at a sim-frame place, `w` across and `len` down the run, turned by `yaw`
   *  (radians from down the run toward +x) and tilted to the slope under it. */
  decal(c: Course, x: number, z: number, w: number, len: number, col: Color, lum = 1, kind = DECAL_POOL, yaw = 0, lift = 0.3): void {
    if (this.nDecal >= this.decalCap || !(lum > 0.004)) return;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    // Along the mark and across it, on the ground's own slope there (a metre either way).
    const y = c.ground(x, z);
    const dl = (c.ground(x + sy, z + cy) - c.ground(x - sy, z - cy)) / 2;
    const dw = (c.ground(x + cy, z - sy) - c.ground(x - cy, z + sy)) / 2;
    az.set(-sy, -dl, cy).normalize();
    ax.set(cy, dw, sy).normalize();
    ay.crossVectors(az, ax).normalize();
    tm.makeBasis(ax, ay, az);
    tq.setFromRotationMatrix(tm);
    tm.compose(tp.set(x, y + lift, -z), tq, ts.set(w, 1, len));
    const i = this.nDecal++;
    this.decals.setMatrixAt(i, tm);
    this.decals.setColorAt(i, tc.copy(col).multiplyScalar(lum));
    this.dKind.setX(i, kind);
  }

  /** A mark of light lying flat at a given height (on a lake's ice, on a deck): no ground is asked. */
  decalAt(x: number, y: number, z: number, w: number, len: number, col: Color, lum = 1, kind = DECAL_POOL, yaw = 0): void {
    if (this.nDecal >= this.decalCap || !(lum > 0.004)) return;
    tq.setFromAxisAngle(ay.set(0, 1, 0), -yaw);
    tm.compose(tp.set(x, y, -z), tq, ts.set(w, 1, len));
    const i = this.nDecal++;
    this.decals.setMatrixAt(i, tm);
    this.decals.setColorAt(i, tc.copy(col).multiplyScalar(lum));
    this.dKind.setX(i, kind);
  }

  /** End a frame: every draw that holds nothing is hidden. */
  end(): void {
    this.gGeo.instanceCount = this.nGlow;
    this.glows.visible = this.nGlow > 0;
    if (this.nGlow > 0) {
      this.gCenter.needsUpdate = true;
      this.gTint.needsUpdate = true;
      this.gShape.needsUpdate = true;
    }
    this.decals.count = this.nDecal;
    this.decals.visible = this.nDecal > 0;
    if (this.nDecal > 0) {
      this.decals.instanceMatrix.needsUpdate = true;
      if (this.decals.instanceColor) this.decals.instanceColor.needsUpdate = true;
      this.dKind.needsUpdate = true;
    }
    for (const p of this.pools) {
      p.mesh.count = p.n;
      p.mesh.visible = p.n > 0;
      if (p.n > 0) {
        p.mesh.instanceMatrix.needsUpdate = true;
        if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /** What the kit is drawing this frame, for the cost table: draws, instances and triangles. */
  cost(): { draws: number; tris: number; glows: number; decals: number } {
    let draws = (this.nGlow > 0 ? 1 : 0) + (this.nDecal > 0 ? 1 : 0);
    let tris = this.nGlow * 2 + this.nDecal * 2;
    for (const p of this.pools) {
      if (p.n === 0) continue;
      draws++;
      const g = p.mesh.geometry;
      tris += p.n * ((g.index ? g.index.count : g.getAttribute('position').count) / 3);
    }
    return { draws, tris, glows: this.nGlow, decals: this.nDecal };
  }
}
