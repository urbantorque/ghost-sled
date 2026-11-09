import { BufferAttribute, BufferGeometry, Color, CustomBlending, AddEquation, OneFactor, OneMinusSrcAlphaFactor, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, TorusGeometry, Vector3, DoubleSide } from 'three';
import type { SkyGate } from '../sim/course';
import { LIGHT_GLSL, shared } from './materials';

// Sky gates as rings of light (round 6). A gate was a thin outline that showed at about 20 m; now each is
// a bold ring (a deep amber edge, a marigold body, a white-gold line along its core), a soft marigold halo
// round it and four beacon motes riding the ring, with a slow shimmer running round it. The ring and its
// halo are one geometry in one instanced draw for every gate on the course, on every tier: a premultiplied
// blend lets the ring write opaque light (alpha 1) while the halo both tints what is behind it and adds
// light, so it reads on white snow as well as a dusk sky (added light alone vanished on the snow). Low has
// no bloom, so the halo is what glows there; on Medium and High the ring's core also runs past the bloom
// threshold.
//
// From 60 m a 2.4 m ring is about fifty pixels tall but its tube would be two: the vertex shader holds the
// tube at least a few pixels thick and the halo a few more, so a ring reads as a ring of light at any
// distance. Every entry of `course.skyGates` draws at its own radius, so a set piece's line of smaller
// rings is the same family. Flying through one bursts it: it swells, burns white-gold and is gone in
// about 0.7 s. Colours: marigold (the lantern's fuel, ART.md section 1) burning toward white-gold.

export const MAX_SKY_GATES = 16;
/** Seconds a flown gate takes to burst and go. */
const BURST_S = 0.7;
/** The tube's radius in ring units (0.17 m on a 2.4 m gate) before the pixel floor. */
const TUBE = 0.072;

export const GATE_MARIGOLD = new Color('#FFD34D');
export const GATE_WHITE_GOLD = new Color('#FFF3C4');
/** The ring's silhouette edge: a deep amber inside the lantern's own warm family, for contrast on snow. */
const GATE_AMBER = new Color('#E07A12');

/** The ring (aPart 0) and its halo quad in the ring's plane (aPart 1), in ring units (radius 1, axis z). */
export function gateGeometry(): BufferGeometry {
  const torus = new TorusGeometry(1, TUBE, 6, 60).toNonIndexed();
  torus.deleteAttribute('uv');
  const tp = torus.getAttribute('position') as BufferAttribute;
  const n = tp.count;
  const pos = new Float32Array((n + 6) * 3);
  pos.set(tp.array as Float32Array, 0);
  // The halo: one quad, scaled in the vertex shader to cover the glow at any distance.
  const quad = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
  for (let i = 0; i < 6; i++) pos.set([quad[i * 2], quad[i * 2 + 1], 0], (n + i) * 3);
  const part = new Float32Array(n + 6);
  for (let i = n; i < n + 6; i++) part[i] = 1;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aPart', new BufferAttribute(part, 1));
  return g;
}

function gateMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    uniforms: {
      ...shared,
      uViewH: { value: 720 },
      uGlowK: { value: 1 },
      uCoreK: { value: 1 },
      uAmber: { value: GATE_AMBER.clone() },
      uMarigold: { value: GATE_MARIGOLD.clone() },
      uWhiteGold: { value: GATE_WHITE_GOLD.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float aPart;
      attribute float aBurst;
      attribute float aSeed;
      uniform float uTime;
      uniform float uViewH;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec2 vUv;
      varying float vAng;
      varying float vPart;
      varying float vBurst;
      varying float vSeed;
      varying float vW;
      varying float vM;
      void main() {
        vec3 p = position;
        mat4 m = modelMatrix * instanceMatrix;
        float sc = length(m[0].xyz);
        vec3 centre = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float dist = max(1.0, distance(centre, cameraPosition));
        // Metres a pixel spans at the gate's distance, in ring units.
        float px = 2.0 * dist / (projectionMatrix[1][1] * uViewH) / sc;
        float b = aBurst;
        // A flown gate swells as it bursts; a hanging one breathes a little.
        float grow = (1.0 + 0.6 * b * (2.0 - b)) * (1.0 + 0.03 * sin(uTime * 2.1 + aSeed * 7.0));
        vPart = aPart;
        vBurst = b;
        vSeed = aSeed;
        vec3 nrm = vec3(0.0, 0.0, 1.0);
        if (aPart < 0.5) {
          vec2 dir = normalize(p.xy);
          vec3 c = vec3(dir, 0.0);
          vec3 tube = p - c;
          // At least about 2.2 px across the tube's radius however far off it hangs.
          float t = max(${TUBE.toFixed(3)}, 2.7 * px) * (1.0 - 0.5 * b);
          nrm = tube / ${TUBE.toFixed(3)};
          p = c * grow + nrm * t;
          vAng = atan(dir.y, dir.x);
          vW = 0.0;
          vM = 0.0;
        } else {
          // The halo's glow: a soft band either side of the ring, never under about 9 px wide.
          float w = max(0.2, 10.0 * px);
          vW = w;
          vM = max(0.11, 5.0 * px);
          float span = 1.0 + 2.6 * w;
          vUv = p.xy * span;
          p.xy *= span * grow;
          vAng = 0.0;
        }
        vec4 wp = m * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(m) * nrm);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform float uGlowK;
      uniform float uCoreK;
      uniform vec3 uAmber;
      uniform vec3 uMarigold;
      uniform vec3 uWhiteGold;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec2 vUv;
      varying float vAng;
      varying float vPart;
      varying float vBurst;
      varying float vSeed;
      varying float vW;
      varying float vM;
      void main() {
        vec3 dv = vWorldPos - cameraPosition;
        float d = length(dv);
        // A light holds through the fog better than paint does.
        float fogK = smoothstep(uFogNear, uFogFar, d);
        float b = vBurst;
        float fade = 1.0 - b * b;
        float spin = uTime * 1.1 + vSeed * 6.2831;
        if (vPart < 0.5) {
          vec3 v = normalize(-dv);
          float face = abs(dot(normalize(vNormalW), v));
          // A deep amber edge on the tube's silhouette (it holds on bright snow and pale sky, where a pale
          // ring vanished), marigold through its body and a thin white-gold line of light along its core,
          // with a shimmer running round the ring and one bright run of light chasing it.
          float shim = 0.5 + 0.5 * sin(vAng * 3.0 - uTime * 2.4 + vSeed * 9.0);
          float run = pow(max(0.0, cos(vAng - spin * 1.3)), 18.0);
          vec3 col = mix(uAmber, uMarigold, smoothstep(0.12, 0.62, face));
          col = mix(col, uWhiteGold, smoothstep(0.78, 1.0, face) * 0.75 + run * 0.6);
          col *= (1.0 + 0.16 * shim + 0.5 * run) * mix(1.0, uCoreK, smoothstep(0.7, 1.0, face));
          col = mix(col, uWhiteGold * 2.2, b);
          col = mix(col, fogged(col, vWorldPos), 0.45 * fogK);
          gl_FragColor = vec4(linearToOutputTexel(vec4(col, 1.0)).rgb * fade, fade);
          return;
        }
        float r = length(vUv);
        float w = vW;
        float x = (r - 1.0) / w;
        float glow = 0.72 * exp(-x * x * 1.6) + 0.22 * exp(-x * x * 0.22);
        // A faint veil inside the ring, so it reads as a gate to go through rather than a hoop.
        glow += 0.06 * (1.0 - smoothstep(0.2, 1.0, r));
        // Four beacon motes riding the ring, pulsing in turn: soft round lights, never stars (ART.md 10).
        float motes = 0.0;
        float hot = 0.0;
        for (int k = 0; k < 4; k++) {
          float a = spin * 0.35 + float(k) * 1.5708;
          vec2 c = vec2(cos(a), sin(a));
          float dm = length(vUv - c) / vM;
          float pulse = 0.65 + 0.35 * sin(uTime * 3.2 + float(k) * 1.9 + vSeed * 4.0);
          motes += exp(-dm * dm * 1.4) * pulse;
          hot += exp(-dm * dm * 5.0) * pulse;
        }
        motes = min(motes, 1.0);
        // The halo tints what is behind it toward marigold as well as adding light (a premultiplied blend
        // with some alpha), so it reads on white snow as well as against a dusk sky.
        float burst = b * (1.0 - b) * 4.0;
        float ga = clamp(glow * uGlowK * (1.0 + burst) * fade * (1.0 - 0.6 * fogK), 0.0, 1.0);
        float ma = clamp(motes * fade * (1.0 - 0.5 * fogK), 0.0, 1.0);
        vec3 gc = linearToOutputTexel(vec4(mix(uMarigold, uWhiteGold, b), 1.0)).rgb;
        vec3 mc = linearToOutputTexel(vec4(mix(uMarigold, uWhiteGold, clamp(hot, 0.0, 1.0)), 1.0)).rgb;
        vec3 col = gc * ga * 0.62 + mc * ma * 0.9;
        float alpha = ga * 0.58 + ma * 0.55;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.92));
      }
    `,
  });
}

/** Every sky gate on the course in one instanced draw. */
export class SkyGates {
  readonly mesh: InstancedMesh;
  private readonly burst: InstancedBufferAttribute;
  private readonly seed: InstancedBufferAttribute;
  private readonly mat: ShaderMaterial;
  private gates: readonly SkyGate[] = [];
  /** Seconds since each flown gate was flown, by id (gone once it has burst). */
  private readonly flown = new Map<number, number>();
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly v = new Vector3();
  private readonly s = new Vector3();
  private dirty = true;

  constructor() {
    this.mat = gateMaterial();
    const geo = gateGeometry();
    this.burst = new InstancedBufferAttribute(new Float32Array(MAX_SKY_GATES), 1).setUsage(DynamicDrawUsage);
    this.seed = new InstancedBufferAttribute(new Float32Array(MAX_SKY_GATES), 1);
    geo.setAttribute('aBurst', this.burst);
    geo.setAttribute('aSeed', this.seed);
    this.mesh = new InstancedMesh(geo, this.mat, MAX_SKY_GATES);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    // Drawn after the world's other light, so a ring hung over the snow lays its light on top.
    this.mesh.renderOrder = 2;
  }

  /** The viewport's height in device pixels (the pixel floor on the ring's thickness). */
  setViewport(px: number): void {
    this.mat.uniforms.uViewH.value = Math.max(1, px);
  }

  /** Low has no bloom: the halo carries all of a ring's glow there. */
  setBloom(on: boolean): void {
    this.mat.uniforms.uGlowK.value = on ? 0.85 : 1.1;
    this.mat.uniforms.uCoreK.value = on ? 1.45 : 1.0;
  }

  setGates(list: readonly SkyGate[]): void {
    this.gates = list.slice(0, MAX_SKY_GATES);
    this.flown.clear();
    this.dirty = true;
  }

  /** A new run: every gate hangs again. */
  reset(): void {
    this.flown.clear();
    this.dirty = true;
  }

  /** A gate flown through: it bursts. */
  fly(id: number): void {
    if (!this.flown.has(id)) this.flown.set(id, 0);
    this.dirty = true;
  }

  get(id: number): SkyGate | undefined {
    return this.gates.find((g) => g.id === id);
  }

  update(dt: number): void {
    if (this.flown.size > 0) {
      for (const [id, t] of this.flown) if (t < BURST_S) this.flown.set(id, t + dt);
      this.dirty = true;
    }
    if (!this.dirty) return;
    this.dirty = false;
    let n = 0;
    const b = this.burst.array as Float32Array;
    const sd = this.seed.array as Float32Array;
    for (const g of this.gates) {
      const t = this.flown.get(g.id);
      if (t !== undefined && t >= BURST_S) continue;
      this.q.identity();
      this.s.setScalar(g.r);
      this.m.compose(this.v.set(g.x, g.y, -g.z), this.q, this.s);
      this.mesh.setMatrixAt(n, this.m);
      b[n] = t === undefined ? 0 : Math.min(1, t / BURST_S);
      sd[n] = ((g.id * 0.618034 + g.z * 0.0137) % 1 + 1) % 1;
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.burst.needsUpdate = true;
    this.seed.needsUpdate = true;
  }
}
