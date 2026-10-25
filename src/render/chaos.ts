import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  NotEqualStencilFunc,
  Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ChaosEvent } from '../sim/chaos';
import { Course } from '../sim/course';
import type { Sim } from '../sim/sim';
import { makeGhostMaterial, makeToonMaterial, shared } from './materials';
import { ghostRiderGeometry, giftGeometry } from './meshes';
import type { Tier } from './world';

// Visuals for the mid-run events. Each one is telegraphed well before it can hurt you.

function colored(g: BufferGeometry, hex: string): BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  const c = new Color(hex);
  const count = n.getAttribute('position').count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) arr.set([c.r, c.g, c.b], i * 3);
  n.setAttribute('color', new BufferAttribute(arr, 3));
  return n;
}

function yetiGeometry(): { body: BufferGeometry; arm: BufferGeometry } {
  const fur = '#E4EEFA';
  const furDark = '#B9C8E4';
  const face = '#3A4560';
  const body = mergeGeometries([
    colored(new IcosahedronGeometry(0.95, 1).scale(1.0, 1.25, 0.85).translate(0, 1.55, 0), fur),
    colored(new IcosahedronGeometry(0.6, 1).scale(1, 0.9, 0.6).translate(0, 1.35, -0.42), furDark),
    colored(new IcosahedronGeometry(0.55, 1).translate(0, 2.55, -0.05), fur),
    colored(new SphereGeometry(0.34, 10, 8).scale(1, 0.85, 0.6).translate(0, 2.5, -0.38), face),
    colored(new SphereGeometry(0.06, 6, 5).translate(-0.12, 2.6, -0.58), '#FFE08A'),
    colored(new SphereGeometry(0.06, 6, 5).translate(0.12, 2.6, -0.58), '#FFE08A'),
    colored(new BoxGeometry(0.26, 0.06, 0.06).translate(0, 2.36, -0.55), '#FFFFFF'),
    colored(new CylinderGeometry(0.26, 0.3, 0.9, 7).translate(-0.4, 0.45, 0), furDark),
    colored(new CylinderGeometry(0.26, 0.3, 0.9, 7).translate(0.4, 0.45, 0), furDark),
    colored(new BoxGeometry(0.42, 0.16, 0.6).translate(-0.4, 0.06, -0.1), face),
    colored(new BoxGeometry(0.42, 0.16, 0.6).translate(0.4, 0.06, -0.1), face),
  ])!;
  const arm = mergeGeometries([
    colored(new CylinderGeometry(0.2, 0.24, 1.3, 7).translate(0, -0.65, 0), fur),
    colored(new SphereGeometry(0.24, 8, 6).translate(0, -1.35, 0), face),
  ])!;
  return { body, arm };
}

function sleighGeometry(): BufferGeometry {
  return mergeGeometries([
    colored(new BoxGeometry(2.2, 0.8, 1.2).translate(0, 0.6, 0), '#FF4D2E'),
    colored(new BoxGeometry(2.6, 0.12, 0.12).translate(0, 0.05, -0.5), '#FFD34D'),
    colored(new BoxGeometry(2.6, 0.12, 0.12).translate(0, 0.05, 0.5), '#FFD34D'),
    colored(new BoxGeometry(0.8, 0.7, 0.8).translate(0.3, 1.3, 0), '#FFD34D'),
    colored(new IcosahedronGeometry(0.45, 0).translate(-3.4, 0.9, 0), '#8A5A3C'),
    colored(new ConeGeometry(0.08, 0.6, 4).translate(-3.6, 1.5, 0.2), '#5A3A28'),
    colored(new ConeGeometry(0.08, 0.6, 4).translate(-3.6, 1.5, -0.2), '#5A3A28'),
    colored(new IcosahedronGeometry(0.45, 0).translate(-5.0, 1.0, 0), '#8A5A3C'),
    colored(new SphereGeometry(0.12, 6, 5).translate(-5.4, 1.1, 0), '#FF4D2E'),
  ])!;
}

/** Billboard puffs for the avalanche. Each is shaded as a lumpy sphere under the world's own sun
 *  (the same two-tone wrap light as everything else): the billows up the wall are clean powder,
 *  cream in the sun and periwinkle in their own shade, so the crest reads as a breaking wave of snow;
 *  the lumps low on the wall are a dark, cold churn of snow and debris, the hard silhouette the
 *  danger reads by. The instance matrix carries the size in its first column and the puff's height
 *  up the wall (0 at the foot, 1 at the crest) in its z scale. */
function puffMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: shared.uTime,
      uLit: shared.uSnowLit,
      uShade: shared.uSnowShade,
      uDeep: shared.uSnowDeep,
      uSunDir: shared.uSunDir,
      uSunColor: shared.uSunColor,
      uInk: { value: new Color(HAZARD_INK) },
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
    },
    vertexShader: /* glsl */ `
      varying vec2 vQ;
      varying float vH;
      varying float vSeed;
      varying float vFog;
      varying vec3 vSun;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uSunDir;
      void main() {
        vQ = position.xy * 2.0;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(instanceMatrix[0].xyz);
        vH = instanceMatrix[2].z;
        vSeed = fract(instanceMatrix[3].x * 0.137 + instanceMatrix[3].z * 0.071);
        // The billboard faces the lens, so its sphere normal lives in view space: so does the sun.
        vSun = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
        vec4 mv = center + vec4(position.xy * s, 0.0, 0.0);
        vFog = smoothstep(uFogNear, uFogFar, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uDeep;
      uniform vec3 uSunColor;
      uniform vec3 uInk;
      uniform vec3 uFog;
      varying vec2 vQ;
      varying float vH;
      varying float vSeed;
      varying float vFog;
      varying vec3 vSun;
      void main() {
        float r = length(vQ);
        float crest = smoothstep(0.32, 0.72, vH);
        // Dust plumes (flagged by a height past the crest): big, soft-edged and thinner, the powder the
        // wave throws high above its crest, so it reads as a breaking wave and not a pile of balls.
        float dust = step(1.2, vH);
        // Cauliflower rim: a few slow bumps around the edge keep the silhouette lumpy and churning;
        // the powder billows up top are softer edged than the heavy churn below.
        float ang = atan(vQ.y, vQ.x);
        float edge = 0.88 + 0.06 * sin(ang * 5.0 + vSeed * 40.0 + uTime * 1.7) + 0.04 * sin(ang * 9.0 - vSeed * 23.0);
        float a = smoothstep(edge, edge - mix(mix(0.1, 0.2, crest), 0.6, dust), r) * mix(1.0, 0.55 * smoothstep(1.5, 1.56, vH) * (1.0 - smoothstep(1.7, 1.95, vH)), dust);
        if (a < 0.01) discard;
        vec3 n = vec3(vQ, sqrt(max(1.0 - r * r, 0.0)));
        // Two-tone wrap light (ART.md): sunlit cream powder, periwinkle in the billow's own shade.
        float t = smoothstep(-0.25, 0.6, dot(n, vSun));
        vec3 powder = mix(mix(uShade, uDeep, 0.3), uLit * uSunColor * 0.92, t);
        // A little extra light where each billow rolls over the top.
        powder += uLit * uSunColor * smoothstep(0.45, 0.95, n.y) * t * 0.08;
        // The churn low on the wall: dark ink-slate, only faintly modelled.
        vec3 churn = mix(uInk, mix(uDeep, uShade, 0.25) * 0.55, 0.2 + 0.45 * t);
        vec3 col = mix(churn, powder, crest);
        // The underside of each lump falls into the shadow of the one above it, a deep periwinkle navy.
        col = mix(col, col * vec3(0.36, 0.42, 0.62), smoothstep(0.1, -0.8, n.y) * mix(0.85, 0.55, crest) * (1.0 - dust));
        col = mix(col, mix(uLit * uSunColor * 0.9, uShade, 0.3), dust * 0.5);
        col = mix(col, uFog, vFog * 0.55);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** The avalanche's hazard colours: a cold, dark ink-slate (ART.md: a danger is a dark, hard silhouette). */
const HAZARD_INK = '#161C38';

/** Avalanche debris: a broken block of packed snow and ice, dark slate with a few pale snow facets. */
function chunkGeometry(): BufferGeometry {
  const g = new IcosahedronGeometry(1, 0);
  const n = g.index ? g.toNonIndexed() : g;
  const pos = n.getAttribute('position') as BufferAttribute;
  // Dent the corners (hashed by position, so shared corners stay welded) and squash the block.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const f = 0.74 + 0.4 * (k - Math.floor(k));
    pos.setXYZ(i, x * f * 1.2, y * f * 0.8, z * f);
  }
  n.deleteAttribute('uv');
  n.deleteAttribute('normal');
  n.computeVertexNormals();
  const nrm = n.getAttribute('normal');
  const dark = new Color('#1E2646');
  const mid = new Color('#303D66');
  const snow = new Color('#8F9DC6');
  const arr = new Float32Array(pos.count * 3);
  for (let f = 0; f < pos.count; f += 3) {
    const c = nrm.getY(f) > 0.72 ? snow : (f / 3) % 3 === 0 ? mid : dark;
    for (let k = 0; k < 3; k++) arr.set([c.r, c.g, c.b], (f + k) * 3);
  }
  n.setAttribute('color', new BufferAttribute(arr, 3));
  return n;
}

const PUFFS = 96;
const CHUNKS = 52;
const FOOTPRINTS = 16;
const AXIS_Y = new Vector3(0, 1, 0);

/** Puff and chunk budgets per quality tier (the wall is only ever seen in the mirror on Medium/High). */
const AV_DETAIL: Record<Tier, { puffs: number; chunks: number }> = {
  low: { puffs: 40, chunks: 22 },
  medium: { puffs: 70, chunks: 38 },
  high: { puffs: PUFFS, chunks: CHUNKS },
};

export class ChaosVisuals {
  readonly root = new Object3D();
  private event: ChaosEvent = ChaosEvent.None;
  /** Quality tier, set by the world each frame: scales the avalanche's puff and chunk counts. */
  detail: Tier = 'high';
  private puffs: InstancedMesh;
  private puffSeeds: Float32Array;
  /** Per puff this frame: x, y, z, size, height up the wall. Drawn far to near (sorted in place). */
  private puffData = new Float32Array(PUFFS * 5);
  private puffDist = new Float32Array(PUFFS);
  private puffOrder: number[] = [];
  private debris: InstancedMesh;
  private chunkSeeds: Float32Array;
  private e = new Euler();
  /** Where the wall's front is drawn; it keeps rolling for a moment over a rider it has buried. */
  private avFront = 0;
  private avBuriedAt = -1;
  private yeti = new Object3D();
  private yetiArmL = new Object3D();
  private yetiArmR = new Object3D();
  private prints: InstancedMesh;
  private storm: InstancedMesh;
  private storm5: InstancedMesh;
  private sleigh: Mesh;
  private spirits: Mesh[] = [];
  private m = new Matrix4();
  private q = new Quaternion();
  private v = new Vector3();
  private s = new Vector3();

  constructor(private course: Course) {
    this.puffs = new InstancedMesh(new PlaneGeometry(1, 1), puffMaterial(), PUFFS);
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = 6;
    this.puffSeeds = new Float32Array(PUFFS * 4);
    for (let i = 0; i < PUFFS * 4; i++) this.puffSeeds[i] = Math.random();
    for (let i = 0; i < PUFFS; i++) this.puffOrder.push(i);
    // Debris is lit like every other hazard (toon, flat facets, cool rim) and dissolves near the lens.
    // A cool tint keeps the debris cold even under an ember or golden sun.
    this.debris = new InstancedMesh(chunkGeometry(), makeToonMaterial({ coolShade: 0.6, rim: 0.4, tint: new Color(0.8, 0.9, 1.25) }), CHUNKS);
    this.debris.frustumCulled = false;
    this.chunkSeeds = new Float32Array(CHUNKS * 4);
    for (let i = 0; i < CHUNKS * 4; i++) this.chunkSeeds[i] = Math.random();
    const tint = new Color();
    for (let i = 0; i < CHUNKS; i++) this.debris.setColorAt(i, tint.setScalar(0.78 + this.chunkSeeds[i * 4 + 3] * 0.4));

    const toon = makeToonMaterial({ coolShade: 0.4 });
    const yg = yetiGeometry();
    const body = new Mesh(yg.body, toon);
    body.castShadow = true;
    const armMeshL = new Mesh(yg.arm, toon);
    const armMeshR = new Mesh(yg.arm, toon);
    this.yetiArmL.position.set(-0.95, 2.1, 0);
    this.yetiArmR.position.set(0.95, 2.1, 0);
    this.yetiArmL.add(armMeshL);
    this.yetiArmR.add(armMeshR);
    this.yeti.add(body, this.yetiArmL, this.yetiArmR);
    this.yeti.scale.setScalar(1.3);

    const printGeo = colored(new CylinderGeometry(0.28, 0.28, 0.02, 10).scale(1, 1, 1.6), '#3A4580');
    this.prints = new InstancedMesh(printGeo, makeToonMaterial({ coolShade: 0.1 }), FOOTPRINTS);
    this.prints.frustumCulled = false;

    const giftMat = makeToonMaterial({ coolShade: 0.25, emissive: new Color('#FFB040'), emissiveStrength: 0.15 });
    this.storm = new InstancedMesh(giftGeometry(false), giftMat, 64);
    this.storm5 = new InstancedMesh(giftGeometry(true), giftMat, 16);
    this.storm.frustumCulled = this.storm5.frustumCulled = false;
    this.sleigh = new Mesh(sleighGeometry(), toon);
    this.sleigh.scale.setScalar(1.8);

    const spiritGeo = ghostRiderGeometry();
    for (let i = 0; i < 8; i++) {
      const mat = makeGhostMaterial(new Color(i % 3 === 0 ? '#C8FFF4' : '#8FF3E4'));
      mat.uniforms.uGlow.value = 2.6;
      mat.blending = AdditiveBlending;
      // Contract C10: like every ghost layer, the train never draws over the rider's own pixels (the
      // rider writes stencil 1); a zero write mask leaves the buffer as the rider left it.
      mat.stencilWrite = true;
      mat.stencilFunc = NotEqualStencilFunc;
      mat.stencilRef = 1;
      mat.stencilWriteMask = 0;
      const m = new Mesh(spiritGeo, mat);
      m.frustumCulled = false;
      m.renderOrder = 5;
      m.scale.setScalar(1.15);
      this.spirits.push(m);
    }
    this.root.add(this.debris, this.puffs, this.yeti, this.prints, this.storm, this.storm5, this.sleigh, ...this.spirits);
    this.hideAll();
  }

  setCourse(course: Course): void {
    this.course = course;
  }

  begin(event: ChaosEvent): void {
    this.event = event;
    this.avBuriedAt = -1;
    this.hideAll();
  }

  private hideAll(): void {
    this.puffs.visible = false;
    this.debris.visible = false;
    this.yeti.visible = false;
    this.prints.visible = false;
    this.storm.visible = this.storm5.visible = false;
    this.sleigh.visible = false;
    for (const s of this.spirits) s.visible = false;
  }

  /** Returns a camera shake amount for rumbling events. */
  update(sim: Sim, time: number, camPos: Vector3): number {
    const d = sim.dyn;
    const c = this.course;
    let shake = 0;
    switch (this.event) {
      case ChaosEvent.Avalanche: {
        const a = d.avalanche;
        if (a.phase === 1) shake = 0.08 + (a.ticks / 180) * 0.25;
        // After it catches you the wall keeps rolling over the crash for a moment, then settles.
        const buried = a.phase === 3 && sim.s.crashed && sim.s.crashCause === 'avalanche';
        if (buried && this.avBuriedAt < 0) this.avBuriedAt = time;
        const on = a.phase === 2 || (buried && time - this.avBuriedAt < 4);
        this.puffs.visible = this.debris.visible = on;
        if (on) {
          if (a.phase === 2) {
            // The chase rumble is the world's (it rises as the gap closes under 30 m).
            this.avFront = a.z;
          } else {
            this.avFront = a.z + Math.min(time - this.avBuriedAt, 1.2) * 14;
            shake = 0.35;
          }
          this.updateAvalanche(this.avFront, time, camPos);
        }
        break;
      }
      case ChaosEvent.Yeti: {
        const y = d.yeti;
        const show = y.phase === 1 || y.phase === 2;
        this.yeti.visible = show;
        this.prints.visible = y.phase === 1 || (y.phase === 2 && y.ticks < 240);
        if (show) {
          const gy = c.ground(y.x, y.z);
          const walk = y.phase === 2 ? Math.sin(time * 7) : 0;
          this.yeti.position.set(y.x, gy + Math.abs(walk) * 0.12, -y.z);
          this.yeti.rotation.set(0, y.dir > 0 ? -Math.PI / 2 : Math.PI / 2, walk * 0.05);
          if (y.phase === 1) {
            // Roar: arms up, facing the course.
            const r = 0.5 + 0.5 * Math.sin(time * 10);
            this.yeti.rotation.y = Math.PI;
            this.yetiArmL.rotation.set(0, 0, -2.3 - r * 0.3);
            this.yetiArmR.rotation.set(0, 0, 2.3 + r * 0.3);
            shake = 0.12 * r;
          } else {
            this.yetiArmL.rotation.set(walk * 0.8, 0, -0.25);
            this.yetiArmR.rotation.set(-walk * 0.8, 0, 0.25);
          }
          // Footprints across the corridor: the path it will take, laid down ahead of time.
          const hw = c.halfWidth(y.z) + 6;
          const x0 = c.centerX(y.z) - y.dir * hw;
          const reveal = y.phase === 1 ? Math.min(1, y.ticks / 120) : 1;
          for (let k = 0; k < FOOTPRINTS; k++) {
            const t = k / (FOOTPRINTS - 1);
            const visible = t <= reveal;
            const px = x0 + y.dir * t * hw * 2;
            const pz = y.z + (k % 2 === 0 ? -0.35 : 0.35);
            this.v.set(px, c.ground(px, pz) + 0.03, -pz);
            this.m.compose(this.v, this.q.setFromAxisAngle(AXIS_Y, Math.PI / 2), this.s.setScalar(visible ? 1 : 0));
            this.prints.setMatrixAt(k, this.m);
          }
          this.prints.instanceMatrix.needsUpdate = true;
        }
        break;
      }
      case ChaosEvent.GiftStorm: {
        this.sleigh.visible = d.stormPhase === 1 || d.stormPhase === 2;
        if (this.sleigh.visible) {
          const t = d.stormPhase === 1 ? d.stormTicks / 120 - 1 : d.stormTicks / 720;
          const z = sim.s.z + 80;
          const x = c.centerX(z) + (t * 2 - 1) * 70;
          this.sleigh.position.set(x, c.ground(c.centerX(z), z) + 22 + Math.sin(time * 2) * 1.5, -z);
          this.sleigh.rotation.set(0, Math.PI, Math.sin(time * 1.3) * 0.08);
        }
        let n1 = 0;
        let n5 = 0;
        for (const g of d.storm) {
          if (g.collected || sim.tick < g.spawnTick) continue;
          const yv = sim.stormGiftY(g);
          this.v.set(g.x, yv, -g.z);
          this.q.setFromAxisAngle(AXIS_Y, time * 2 + g.id);
          this.m.compose(this.v, this.q, this.s.setScalar(1));
          if (g.value > 1 && n5 < 16) this.storm5.setMatrixAt(n5++, this.m);
          else if (n1 < 64) this.storm.setMatrixAt(n1++, this.m);
        }
        this.storm.count = n1;
        this.storm5.count = n5;
        this.storm.instanceMatrix.needsUpdate = this.storm5.instanceMatrix.needsUpdate = true;
        this.storm.visible = n1 > 0;
        this.storm5.visible = n5 > 0;
        break;
      }
      case ChaosEvent.GhostTrain: {
        const active = d.trainPhase === 2;
        this.spirits.forEach((m, i) => {
          const sp = d.spirits[i];
          m.visible = active && !!sp;
          if (sp) {
            m.position.set(sp.x, sp.y + 0.15 + Math.sin(time * 6 + i) * 0.1, -sp.z);
            const ahead = c.safeX(sp.z + 4) - sp.x + sp.offset;
            m.rotation.set(0, -Math.atan2(ahead, 4), 0);
            const dist = m.position.distanceTo(camPos);
            (m.material as ShaderMaterial).uniforms.uFade.value = Math.min(1, dist / 6);
          }
        });
        break;
      }
      default:
        break;
    }
    return shake;
  }

  /** The avalanche wall. `front` is the sim distance of its leading edge. Three parts: big slabs
   *  grinding along the foot and rolling over the face like a breaking wave, smaller chunks thrown
   *  over the lip that bounce ahead until the front swallows them again, and a churning cloud with a
   *  dark underside climbing behind. It spans the corridor and both banks, so there is no way round. */
  private updateAvalanche(front: number, time: number, camPos: Vector3): void {
    const c = this.course;
    const det = AV_DETAIL[this.detail];
    const cx = c.centerX(front);
    const hw = c.halfWidth(front) + 9;
    const nChunks = det.chunks;
    const nFoot = Math.round(nChunks * 0.38);
    const nFace = Math.round(nChunks * 0.32);
    for (let i = 0; i < nChunks; i++) {
      const s0 = this.chunkSeeds[i * 4];
      const s1 = this.chunkSeeds[i * 4 + 1];
      const s2 = this.chunkSeeds[i * 4 + 2];
      let u: number;
      let back: number;
      let lift: number;
      let size: number;
      let spin: number;
      let grow = 1;
      if (i < nFoot) {
        u = -1 + (2 * (i + 0.2 + s0 * 0.6)) / nFoot;
        size = 1.8 + s1 * 1.3;
        back = 0.8 + s2 * 2.2 + Math.sin(time * 2.1 + s0 * 30) * 0.4;
        lift = size * 0.45 + Math.abs(Math.sin(time * 3.2 + s1 * 20)) * 0.5;
        spin = time * (1.6 + s2 * 1.4) + s0 * 20;
      } else if (i < nFoot + nFace) {
        const k = i - nFoot;
        u = -1 + (2 * (k + 0.5 + (s0 - 0.5) * 0.8)) / nFace;
        size = 1.1 + s1 * 1.2;
        const th = s2 * 6.283 - time * (1.3 + s0 * 0.5);
        back = 3 + Math.cos(th) * 2.4;
        lift = 7.5 + Math.sin(th) * 4 + s1 * 2.5;
        spin = -th * 1.4;
      } else {
        const tau = (time / (2.2 + s1 * 0.9) + s2) % 1;
        u = s0 * 2 - 1;
        size = 0.55 + s1 * 0.9;
        back = -(4 + s0 * 4) * 4 * tau * (1 - tau);
        lift = tau < 0.35 ? 7.5 * (1 - (tau / 0.35) ** 2) + size * 0.6 : size * 0.6 + Math.abs(Math.sin((tau - 0.35) * 12.6)) * 1.5 * (1 - tau);
        spin = tau * 14 + s0 * 10;
        grow = Math.min(1, tau / 0.08) * Math.min(1, (1 - tau) / 0.15);
      }
      const z = front - back;
      const x = cx + u * hw;
      this.v.set(x, c.ground(x, z) + lift, -z);
      // Tumbling forward, downhill: a negative turn about +x.
      this.q.setFromEuler(this.e.set(-spin, s0 * 6.283, s2 * 0.6));
      // Slabs about to pass through the lens (the wall catching the camera) are dropped, not dithered.
      if (this.v.distanceToSquared(camPos) < (size + 2.5) * (size + 2.5)) grow = 0;
      const g = size * grow;
      this.m.compose(this.v, this.q, this.s.set(g * (0.9 + s2 * 0.3), g * (0.8 + s1 * 0.3), g));
      this.debris.setMatrixAt(i, this.m);
    }
    this.debris.count = nChunks;
    this.debris.instanceMatrix.needsUpdate = true;

    const nPuffs = det.puffs;
    const pd = this.puffData;
    for (let i = 0; i < nPuffs; i++) {
      const s0 = this.puffSeeds[i * 4];
      const s1 = this.puffSeeds[i * 4 + 1];
      const s2 = this.puffSeeds[i * 4 + 2];
      const s3 = this.puffSeeds[i * 4 + 3];
      // Denser near the front; each lump rolls forward over the top on its own slow orbit. The wall
      // stands tall (a wave, not a bank), and about one lump in seven is a dust plume thrown high above
      // the crest, swelling as it rises.
      const back = 1.6 + s1 * s1 * 20;
      const th = s2 * 6.283 - time * (0.9 + s3 * 0.8);
      const top = 16 + back * 0.5;
      const z = front - back - Math.cos(th) * 1.4;
      const x = cx + (s0 * 2 - 1) * (hw + 3);
      const gy = c.ground(x, z);
      const plume = s3 > 0.86;
      const rise = plume ? (time * (0.25 + s2 * 0.2) + s0) % 1 : 0;
      const y = plume ? gy + top + 1 + rise * 9 : gy + 3.5 + (top - 3.5) * s3 + Math.sin(th) * 1.3;
      let size = (5 + s2 * 6 + Math.sin(time * 1.7 + s0 * 17) * 0.8) * (0.8 + 0.4 * s3) * (plume ? 1.3 + rise * 0.9 : 1);
      const dx = x - camPos.x;
      const dy = y - camPos.y;
      const dz = -z - camPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // A lump around the lens would fill the frame; let it pass instead.
      if (dist < size * 0.8 + 2) size = 0;
      pd[i * 5] = x;
      pd[i * 5 + 1] = y;
      pd[i * 5 + 2] = -z;
      pd[i * 5 + 3] = size;
      // (A plume carries how far it has risen past 1.5, so it can swell in and fade as it climbs.)
      pd[i * 5 + 4] = plume ? 1.5 + rise * 0.45 : Math.min(1, Math.max(0.02, (y - gy) / (top + 2)));
      this.puffDist[i] = dist;
    }
    // Far to near, so the near lumps paint over the far ones (insertion sort: nearly sorted already).
    const order = this.puffOrder;
    if (order.length !== nPuffs) {
      order.length = 0;
      for (let i = 0; i < nPuffs; i++) order.push(i);
    }
    const dist = this.puffDist;
    for (let i = 1; i < nPuffs; i++) {
      const k = order[i];
      const dk = dist[k];
      let j = i - 1;
      while (j >= 0 && dist[order[j]] < dk) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = k;
    }
    this.q.identity();
    for (let n = 0; n < nPuffs; n++) {
      const k = order[n] * 5;
      this.v.set(pd[k], pd[k + 1], pd[k + 2]);
      this.m.compose(this.v, this.q, this.s.set(pd[k + 3], pd[k + 3], pd[k + 4]));
      this.puffs.setMatrixAt(n, this.m);
    }
    this.puffs.count = nPuffs;
    this.puffs.instanceMatrix.needsUpdate = true;
  }
}
