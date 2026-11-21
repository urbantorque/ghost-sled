import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Group, Mesh, NormalBlending, Points, ShaderMaterial, Vector3 } from 'three';
import { ghostStencil, shared } from './materials';
import type { Tier } from './world';

// Spirit Flow, the visible top gear (round 8, V4). The sim's flow level (0 to 6: style built up and held, cooled by
// five dull seconds, dropped by a bump, a ward or a fall; DECISIONS 370) is read as `s.flow`, eased, and its `flow`
// event { level, from } as it moves. The picture changes state as it climbs, never as HUD:
//  - richer colour: the frame's muted colours gain vibrance, its lights warm a touch toward their own hue and its
//    shade deepens a step (FLOW_GLSL, in the composite after the grade; the colour roles hold, since what is already
//    saturated gains least);
//  - the scarf's tip burning: tongues of flame shed off its last third, the rider's vermillion at their birth burning
//    into the lantern's marigold as they climb (never mint: that is the ghosts'), a soft glow on the tip, the rider's
//    rim and scarf lit with it (world.ts), and at the top levels sparks shed off the flame;
//  - wind lines: thin pale streams of air hung beside and over the line, drawn on and gone in under a second, racing
//    with the rider so they whip past at the lens's height;
//  - the ghosts brighter (world.ts lifts their glow by the flow);
//  - a breath on each level: a level gained draws the lens in and opens it out (camera.ts flowBreath), flares the
//    trail and throws a ring of sparks, and lifts the colour for a moment; a level lost sags the lens, gutters the
//    trail (it flickers, shortens and drops dim embers) and drains the colour for a moment.
// Reduced motion keeps the colour, the trail and the ghosts, and drops the wind lines, the sparks and the breath.
// Low draws the flame alone (one draw, fewer and fuller tongues, no sparks or wind; its colour is baked and has no
// composite to lift); Medium and the phone half the wind and the sparks. Nothing here reads the sim but what it is handed, and nothing feeds
// back.

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x: number): number => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

/** The flow's picture, each part 0 to 1, from the eased flow (0 to 6). */
export interface FlowLook {
  /** The composite's richer colour. */
  colour: number;
  /** The scarf's spirit trail. */
  trail: number;
  /** The wind lines in the air. */
  wind: number;
  /** The ghosts' extra glow. */
  ghost: number;
  /** The lens opening out (camera.ts). */
  fov: number;
  /** The top of it: sparks off the trail, the trail at its brightest (levels 5 to 6). */
  top: number;
}

/** What each level shows. Level 1 is a hint in the colour; the trail lights from 2; the wind comes from 3; full
 *  flow (6) is everything at once, and the state a player chases. */
export function flowLook(flow: number): FlowLook {
  const f = Math.max(0, Math.min(6, flow));
  return {
    colour: Math.pow(smooth01((f - 0.5) / 5.5), 0.85),
    trail: smooth01((f - 1.4) / 3.6),
    wind: smooth01((f - 2.4) / 3.6),
    ghost: smooth01((f - 1) / 5),
    fov: smooth01((f - 2) / 4),
    top: smooth01((f - 4.6) / 1.4),
  };
}

/** Wind lines alive at once at full wind, per tier (Low none). */
export const WIND_MAX: Record<Tier, number> = { low: 0, medium: 5, high: 9, ultra: 9 };
/** Sparks off the trail per second at the top of flow, per tier (Low none). */
export const SPARK_RATE: Record<Tier, number> = { low: 0, medium: 22, high: 44, ultra: 44 };
/** The flame's tongues alive at most, per tier, and how many it sheds a second at full flow: Low fewer and fuller. */
export const FLAME_MAX: Record<Tier, number> = { low: 28, medium: 70, high: 110, ultra: 110 };
export const FLAME_RATE: Record<Tier, number> = { low: 55, medium: 120, high: 180, ultra: 180 };

/** How long a tongue of the flame lives (seconds): a lick at level 2, the tallest flame at full flow. */
export function trailLife(look: FlowLook): number {
  return 0.16 + 0.12 * look.trail + 0.06 * look.top;
}

/** The breath a level change carries: + a level gained, - one lost, 0 to 1 each way. A bigger step is a bigger
 *  breath, and a climb near the top breathes deeper than one at the bottom. */
export function flowBreathOf(level: number, from: number): number {
  if (level === from) return 0;
  if (level > from) return Math.min(1, 0.35 + 0.12 * (level - from) + 0.06 * level);
  return -Math.min(1, 0.3 + 0.14 * (from - level) + 0.04 * from);
}

/** The composite's flow look (post.ts calls pipeFlow after the grade). x the colour, y the breath's pulse (-1 to
 *  1: + a breath in, - a gutter out), z the top of flow. */
export const FLOW_GLSL = /* glsl */ `
  uniform vec4 uFlowLook;
  vec3 pipeFlow(vec3 col, vec3 lightHue) {
    float k = uFlowLook.x;
    float p = uFlowLook.y;
    if (k < 0.001 && abs(p) < 0.001) return col;
    col = max(col, 0.0);
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float mx = max(col.r, max(col.g, col.b));
    float sat = (mx - min(col.r, min(col.g, col.b))) / max(mx, 0.001);
    // Vibrance: the muted colours gain most, so the vermillion, the marigold and the mint hold their own roles.
    float vib = (0.34 * k + 0.14 * max(p, 0.0) - 0.3 * max(-p, 0.0)) * (1.0 - sat);
    col = max(mix(vec3(l), col, 1.0 + vib), 0.0);
    // The lights warm a touch toward their own light and the shade deepens a step: more light against shade.
    float hi = smoothstep(0.35, 0.95, l);
    col *= mix(vec3(1.0), mix(vec3(1.0), lightHue, 0.6), hi * (0.07 * k + 0.05 * uFlowLook.z));
    col *= 1.0 - 0.08 * k * (1.0 - smoothstep(0.04, 0.45, l));
    // The breath: a lift of light as a level is gained, a drain as one is lost.
    return col * (1.0 + 0.05 * p);
  }
`;

const ROOT_C = new Color('#FF4D2E');
const MID_C = new Color('#FFD34D');
const TIP_C = new Color('#FFF1C8');

/** The flame's material (round 8, the flow pass): soft tongues of fire shed off the scarf's last third, each a teardrop
 *  stood along the way it rises (round at its foot, tapering to its tip), burning from the rider's vermillion at its
 *  birth into the lantern's marigold as it climbs and fades, with a hot pale heart while it is young; and one soft glow
 *  on the scarf's tip under them. No outline anywhere: every edge is a falloff. aFlame: x its age over its life, y its
 *  size (m), z its alpha, w its kind (0 a tongue, 1 the glow); aRise: the way it rises (three.js, unit). (A ribbon here
 *  read to two critics as a strip, a plank, a baton, a sickle and lightning; a flame is made of tongues.) */
function flameMaterial(hdr: number): ShaderMaterial {
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: { uScale: { value: 600 }, uHdr: { value: hdr }, uRoot: { value: ROOT_C.clone() }, uMid: { value: MID_C.clone() } },
    vertexShader: /* glsl */ `
      attribute vec4 aFlame;
      attribute vec3 aRise;
      uniform float uScale;
      varying vec4 vFlame;
      varying vec2 vAxis;
      varying float vRatio;
      void main() {
        vFlame = aFlame;
        vec4 mv = viewMatrix * vec4(position, 1.0);
        float d = max(-mv.z, 0.05);
        vec4 c0 = projectionMatrix * mv;
        vec4 c1 = projectionMatrix * viewMatrix * vec4(position + aRise * 0.1, 1.0);
        vAxis = vec2(0.0, 1.0);
        if (c0.w > 0.05 && c1.w > 0.05) {
          vec2 s = (c1.xy / c1.w - c0.xy / c0.w) * vec2(projectionMatrix[1][1] / projectionMatrix[0][0], 1.0);
          float l = length(s);
          if (l > 1e-5) vAxis = vec2(s.x, -s.y) / l;
        }
        // A tongue stands half as tall again as it is wide (thinner, a cluster read as a sparkler); the glow is round.
        vRatio = aFlame.w > 0.5 ? 1.0 : 0.68;
        // (Nothing grows into a blot at the lens: a tongue thins away inside about two metres.)
        vFlame.z *= smoothstep(1.2, 2.2, d);
        gl_PointSize = clamp(aFlame.y * uScale / d, 2.0 * uScale / 720.0, uScale * 0.12);
        gl_Position = c0;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHdr;
      uniform vec3 uRoot;
      uniform vec3 uMid;
      varying vec4 vFlame;
      varying vec2 vAxis;
      varying float vRatio;
      void main() {
        vec2 c = (gl_PointCoord - 0.5) * 2.0;
        // Along the rise (-1 its foot, 1 its tip) and across it.
        float al = dot(c, vAxis);
        float ac = dot(c, vec2(-vAxis.y, vAxis.x)) / vRatio;
        float t = vFlame.x;
        vec3 col;
        float a;
        if (vFlame.w > 0.5) {
          // The glow on the scarf's tip: a soft round light, vermillion warming to orange.
          float g2 = dot(c, c);
          a = exp(-g2 * 3.2) * (1.0 - smoothstep(0.75, 1.0, g2));
          col = mix(uRoot, uMid, 0.4) * uHdr;
        } else {
          // A teardrop: full at its foot, narrowing to a point at its tip.
          float w = mix(1.0, 0.38, clamp(al * 0.5 + 0.5, 0.0, 1.0));
          float r2 = al * al + (ac * ac) / (w * w);
          a = pow(clamp(1.0 - r2, 0.0, 1.0), 1.05);
          // Vermillion at its birth burning into marigold as it climbs; a hot pale heart while it is young.
          col = mix(uRoot, uMid, smoothstep(0.05, 0.6, t));
          col = mix(col, vec3(1.0, 0.93, 0.72), clamp(1.0 - r2, 0.0, 1.0) * 0.45 * (1.0 - t));
          col *= uHdr;
        }
        a *= vFlame.z;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
  // Never over the rider's own pixels (contract C10): the flame burns off the scarf's tip, behind the scarf itself.
  ghostStencil(m);
  return m;
}

/** The wind lines' material: world-space strips built on the CPU each frame, faced to the lens. aRib: x along the
 *  line (0 its head, 1 its tail), y across (-1 to 1), z its alpha, w unused. */
function ribbonMaterial(hdr: number): ShaderMaterial {
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: {
      uTip: { value: TIP_C.clone() },
      uHdr: { value: hdr },
      uTime: shared.uTime,
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aRib;
      varying vec4 vRib;
      varying float vFog;
      varying float vNear;
      uniform float uFogNear;
      uniform float uFogFar;
      void main() {
        vRib = aRib;
        vec4 mv = viewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        vFog = smoothstep(uFogNear, uFogFar, d);
        // Nothing grows into a blot at the lens: a ribbon thins away inside about two and a half metres.
        vNear = smoothstep(2.2, 3.4, d);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTip;
      uniform float uHdr;
      uniform vec3 uFog;
      varying vec4 vRib;
      varying float vFog;
      varying float vNear;
      void main() {
        float u = vRib.x;
        float across = 1.0 - vRib.y * vRib.y;
        // A wind line: a pale stream of air, a little of the lantern's gold in it, faint at its ends.
        vec3 col = mix(vec3(0.96, 0.97, 1.0), uTip, 0.45) * mix(1.0, uHdr, 0.5);
        float a = 0.7 * across * across * smoothstep(0.0, 0.2, u) * (1.0 - smoothstep(0.75, 1.0, u));
        // (It takes little of the fog's colour: in Sakura's lilac air it turned into hard cyan lines.)
        col = mix(col, uFog, vFog * 0.25);
        a *= vRib.z * vNear * (1.0 - vFog * 0.5);
        if (a < 0.005) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
  // Never over the rider (contract C10: the rider's pixels hold stencil 1).
  ghostStencil(m);
  return m;
}

/** The sparks' material: round motes in the lantern's warm family, a short smear along their motion. */
function sparkMaterial(hdr: number): ShaderMaterial {
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: { uScale: { value: 600 }, uHdr: { value: hdr }, uMid: { value: MID_C.clone() }, uTip: { value: TIP_C.clone() } },
    vertexShader: /* glsl */ `
      attribute vec2 aSpark;
      uniform float uScale;
      varying float vA;
      varying float vHot;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(-mv.z, 0.05);
        vA = aSpark.y * smoothstep(1.4, 3.0, d);
        vHot = aSpark.x;
        gl_PointSize = clamp(0.05 * uScale / d, 1.6 * uScale / 720.0, uScale * 0.014);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHdr;
      uniform vec3 uMid;
      uniform vec3 uTip;
      varying float vA;
      varying float vHot;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r2 = dot(c, c) * 4.0;
        if (r2 > 1.0) discard;
        // A hot spark is marigold with a pale heart; a guttering ember is a dim amber going grey.
        vec3 hot = mix(uMid, uTip, 0.35 * smoothstep(0.6, 0.0, r2)) * uHdr;
        vec3 dim = vec3(0.55, 0.36, 0.22);
        vec3 col = mix(dim, hot, vHot);
        float a = (1.0 - r2) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }
    `,
  });
  ghostStencil(m);
  return m;
}

/** What the world hands the flow each frame. */
export interface SpiritFlowInput {
  /** Real seconds (the picture's clock) and the shared time. */
  dt: number;
  time: number;
  /** The sim's eased flow, 0 to 6 (0 outside a run, in a crash or at the finish). */
  flow: number;
  /** The rider's world velocity (three.js), the scarf's knot and tip, and any point along it (rider.scarfPoint: u 0 at
   *  the knot, 1 at the tip). */
  vel: Vector3;
  knot: Vector3;
  tip: Vector3;
  scarfAt: (u: number, out: Vector3) => Vector3;
  /** Direction of travel (three.js, unit, horizontal) and the lens. */
  dir: Vector3;
  cam: Vector3;
  /** The snow's height at three.js (x, z). */
  ground: (x: number, z: number) => number;
  reduced: boolean;
}

const MAX_WIND = 9;
const WIND_PTS = 12;
const MAX_SPARK = 160;
const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();

interface Wind {
  /** Seconds lived and lifetime. */
  t: number;
  life: number;
  /** Its centre line (three.js), WIND_PTS points, and the velocity it races with. */
  pts: Float32Array;
  vx: number;
  vz: number;
  width: number;
  alpha: number;
}

export class SpiritFlow {
  readonly root = new Group();
  private tier: Tier;
  private flameGeo = new BufferGeometry();
  private windGeo = new BufferGeometry();
  private sparkGeo = new BufferGeometry();
  private flameMat: ShaderMaterial;
  private windMat = ribbonMaterial(1.2);
  private sparkMat = sparkMaterial(1.4);
  private flame: Points;
  private wind: Mesh;
  private sparks: Points;
  // The flame's tongues: where along the scarf each was born (u, 0 at the knot to 1 at the tip), how far it has risen
  // off that point (m), the way it rises (m/s), its age, life and size. Slot 0 of the drawn buffer is the glow on the
  // tip. (Round 8, the flow pass: held as an offset from the knot, a tongue stayed where the scarf had been and read as
  // a campfire on the snow beside the sled; riding its own point of the scarf, the scarf itself burns.)
  private fp = new Float32Array(FLAME_MAX.high * 3);
  private fv = new Float32Array(FLAME_MAX.high * 3);
  private fa = new Float32Array(FLAME_MAX.high);
  private fl = new Float32Array(FLAME_MAX.high);
  private fs = new Float32Array(FLAME_MAX.high);
  private fu = new Float32Array(FLAME_MAX.high);
  private fn = 0;
  private fAcc = 0;
  private winds: Wind[] = [];
  private windAcc = 0;
  private sp = new Float32Array(MAX_SPARK * 3);
  private sv = new Float32Array(MAX_SPARK * 3);
  private sl = new Float32Array(MAX_SPARK * 2);
  private sn = 0;
  private sAcc = 0;
  /** The look now, the breath waiting for the camera, the colour's pulse, and the trail's flare and gutter. */
  look: FlowLook = flowLook(0);
  private breath = 0;
  private stepUp = 0;
  private stepDown = 0;
  /** The colour's breath (-1 to 1), easing back to 0. */
  pulse = 0;
  private flare = 0;
  private gutter = 0;
  private lastLevelAt = -1;

  constructor(tier: Tier) {
    this.tier = tier;
    const n = FLAME_MAX.high + 1;
    this.flameGeo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3).setUsage(DynamicDrawUsage));
    this.flameGeo.setAttribute('aFlame', new BufferAttribute(new Float32Array(n * 4), 4).setUsage(DynamicDrawUsage));
    this.flameGeo.setAttribute('aRise', new BufferAttribute(new Float32Array(n * 3), 3).setUsage(DynamicDrawUsage));
    // (Low has no bloom: its flame keeps its colour at full value rather than going over it.)
    this.flameMat = flameMaterial(tier === 'low' ? 1 : 1.35);
    const wPos = new BufferAttribute(new Float32Array(MAX_WIND * WIND_PTS * 2 * 3), 3).setUsage(DynamicDrawUsage);
    const wRib = new BufferAttribute(new Float32Array(MAX_WIND * WIND_PTS * 2 * 4), 4).setUsage(DynamicDrawUsage);
    this.windGeo.setAttribute('position', wPos);
    this.windGeo.setAttribute('aRib', wRib);
    this.windGeo.setIndex(stripIndex(MAX_WIND, WIND_PTS));
    this.sparkGeo.setAttribute('position', new BufferAttribute(this.sp, 3).setUsage(DynamicDrawUsage));
    this.sparkGeo.setAttribute('aSpark', new BufferAttribute(this.sl, 2).setUsage(DynamicDrawUsage));
    this.flame = new Points(this.flameGeo, this.flameMat);
    this.wind = new Mesh(this.windGeo, this.windMat);
    this.sparks = new Points(this.sparkGeo, this.sparkMat);
    for (const o of [this.flame, this.wind, this.sparks]) {
      o.frustumCulled = false;
      o.visible = false;
      // After the rider (its stencil) and the near field.
      o.renderOrder = 6;
      this.root.add(o);
    }
  }

  setTier(tier: Tier): void {
    this.tier = tier;
    this.flameMat.uniforms.uHdr.value = tier === 'low' ? 1 : 1.35;
    this.clear();
  }

  clear(): void {
    this.fn = this.sn = 0;
    this.winds.length = 0;
    this.fAcc = this.windAcc = this.sAcc = 0;
    this.breath = this.stepUp = this.stepDown = 0;
    this.pulse = this.flare = this.gutter = 0;
    this.look = flowLook(0);
    this.flame.visible = this.wind.visible = this.sparks.visible = false;
  }

  /** The sim's `flow` event: a level gained or lost. Several in one frame (a combo banking two levels at once)
   *  are one breath. */
  onLevel(level: number, from: number): void {
    if (level > from) this.stepUp = Math.max(this.stepUp, flowBreathOf(level, from));
    else if (level < from) this.stepDown = Math.min(this.stepDown, flowBreathOf(level, from));
  }

  /** The breath for the camera this frame (camera.ts flowBreath), once: 0 when none. */
  takeBreath(): number {
    const b = this.breath;
    this.breath = 0;
    return b;
  }

  /** The sizes the lens and the sparks use (lensPx, particles.ts). */
  setScale(px: number): void {
    this.sparkMat.uniforms.uScale.value = px;
    this.flameMat.uniforms.uScale.value = px;
  }

  update(o: SpiritFlowInput): void {
    const dt = Math.min(0.05, Math.max(0, o.dt));
    this.look = flowLook(o.flow);
    const L = this.look;
    // A level's breath: a climb wins over a drop in the same frame (a bank that crossed a level and fell back).
    if (this.stepUp > 0 || this.stepDown < 0) {
      const k = this.stepUp > 0 ? this.stepUp : this.stepDown;
      this.stepUp = this.stepDown = 0;
      // (Two levels inside a third of a second breathe once.)
      if (o.time - this.lastLevelAt > 0.33 || Math.sign(k) !== Math.sign(this.pulse)) {
        this.lastLevelAt = o.time;
        this.breath = k;
        if (k > 0) {
          this.pulse = Math.max(this.pulse, k);
          this.flare = Math.max(this.flare, k);
          this.gutter = 0;
          if (!o.reduced && L.trail > 0.05) this.burst(o, Math.round(8 + 10 * k));
        } else {
          this.pulse = Math.min(this.pulse, k);
          this.gutter = Math.max(this.gutter, -k);
        }
      }
    }
    this.pulse *= Math.exp(-dt / (this.pulse > 0 ? 0.32 : 0.45));
    this.flare *= Math.exp(-dt / 0.35);
    this.gutter = Math.max(0, this.gutter - dt / 0.75);
    this.stepFlame(o, dt);
    this.stepWind(o, dt);
    this.stepSparks(o, dt);
  }

  /** Sheds the flame's tongues off the scarf's last third and lays them, with the glow on its tip, into the buffer. They
   *  are held in the rider's own frame (offsets from the knot), so the flame stays on the scarf at any speed: left in the
   *  air, anything behind the rider is nearer the lens, which looks down on it, and it ran down the frame. */
  private stepFlame(o: SpiritFlowInput, dt: number): void {
    const L = this.look;
    const cap = FLAME_MAX[this.tier];
    const on = L.trail > 0.02 || this.gutter > 0;
    // Age the tongues and let them rise; drop the dead.
    let i = 0;
    while (i < this.fn) {
      this.fa[i] += dt;
      if (this.fa[i] >= this.fl[i]) {
        const j = --this.fn;
        if (i !== j) {
          this.fp.copyWithin(i * 3, j * 3, j * 3 + 3);
          this.fv.copyWithin(i * 3, j * 3, j * 3 + 3);
          this.fa[i] = this.fa[j];
          this.fl[i] = this.fl[j];
          this.fs[i] = this.fs[j];
          this.fu[i] = this.fu[j];
        }
        continue;
      }
      this.fp[i * 3] += this.fv[i * 3] * dt;
      this.fp[i * 3 + 1] += this.fv[i * 3 + 1] * dt;
      this.fp[i * 3 + 2] += this.fv[i * 3 + 2] * dt;
      i++;
    }
    // Shed new tongues: more and taller with the flow, a flare on a level gained; a guttering flame sheds few, short ones.
    if (on) {
      const rate = FLAME_RATE[this.tier] * (this.gutter > 0 && L.trail < 0.05 ? 0.35 : 0.3 + 0.7 * L.trail) * (1 + 0.8 * this.flare);
      this.fAcc += rate * dt;
      const life0 = trailLife(L);
      const size0 = (0.15 + 0.07 * L.trail + 0.05 * L.top) * (1 + 0.5 * this.flare) * (this.tier === 'low' ? 1.6 : 1);
      while (this.fAcc >= 1 && this.fn < cap) {
        this.fAcc -= 1;
        const k = this.fn++;
        // Along the whole tail, more toward the tip, so the scarf reads as alight along its length and not a fire beside it.
        const r = Math.random();
        this.fu[k] = 1 - 0.7 * r * r;
        this.fp[k * 3] = (Math.random() - 0.5) * 0.04;
        this.fp[k * 3 + 1] = (Math.random() - 0.5) * 0.04;
        this.fp[k * 3 + 2] = (Math.random() - 0.5) * 0.04;
        // Up, swaying a little either side; never back toward the lens (it would read as hanging under the scarf).
        const sway = (Math.random() - 0.5) * 0.7;
        this.fv[k * 3] = -o.dir.z * sway;
        this.fv[k * 3 + 1] = 1.2 + Math.random() * 1.3 + 0.6 * L.top;
        this.fv[k * 3 + 2] = o.dir.x * sway;
        this.fa[k] = 0;
        this.fl[k] = life0 * (0.7 + 0.6 * Math.random()) * (this.gutter > 0 && L.trail < 0.05 ? 0.6 : 1);
        // (Smaller toward the knot: the flame grows toward the tip.)
        this.fs[k] = size0 * (0.75 + 0.5 * Math.random()) * (0.55 + 0.45 * this.fu[k]);
      }
      if (this.fAcc > 1) this.fAcc = 1;
    } else this.fAcc = 0;
    const show = this.fn > 0 || L.trail > 0.02;
    this.flame.visible = show;
    if (!show) {
      this.flameGeo.setDrawRange(0, 0);
      return;
    }
    const pa = (this.flameGeo.getAttribute('position') as BufferAttribute).array as Float32Array;
    const fa = (this.flameGeo.getAttribute('aFlame') as BufferAttribute).array as Float32Array;
    const ra = (this.flameGeo.getAttribute('aRise') as BufferAttribute).array as Float32Array;
    // A guttering flame flickers.
    const flick = this.gutter > 0 && !o.reduced ? 0.4 + 0.6 * Math.abs(Math.sin(o.time * 41) * Math.sin(o.time * 17 + 1)) : 1;
    const alpha = Math.min(1, (0.55 + 0.45 * L.trail) * (1 + 0.3 * this.flare)) * flick;
    // Slot 0: the glow on the scarf's tip.
    pa[0] = o.tip.x;
    pa[1] = o.tip.y;
    pa[2] = o.tip.z;
    fa[0] = 0;
    fa[1] = (0.4 + 0.26 * L.trail + 0.14 * L.top) * (1 + 0.4 * this.flare) * (this.tier === 'low' ? 1.4 : 1);
    fa[2] = (0.35 + 0.4 * L.trail) * flick * (L.trail > 0.02 ? 1 : this.gutter);
    fa[3] = 1;
    ra[0] = 0;
    ra[1] = 1;
    ra[2] = 0;
    for (let k = 0; k < this.fn; k++) {
      const v = k + 1;
      const at = o.scarfAt(this.fu[k], tmpB);
      pa[v * 3] = this.fp[k * 3] + at.x;
      pa[v * 3 + 1] = this.fp[k * 3 + 1] + at.y;
      pa[v * 3 + 2] = this.fp[k * 3 + 2] + at.z;
      const t = this.fa[k] / this.fl[k];
      // Each tongue grows a moment, then narrows to nothing as it climbs; a flicker in its size (never under reduced motion).
      const jit = o.reduced ? 1 : 0.85 + 0.3 * Math.abs(Math.sin(o.time * 37 + k * 1.7));
      fa[v * 4] = t;
      fa[v * 4 + 1] = this.fs[k] * Math.min(1, 0.55 + t * 4) * (1 - 0.7 * t) * jit;
      fa[v * 4 + 2] = alpha * Math.min(1, t * 10) * (1 - t * t);
      fa[v * 4 + 3] = 0;
      const vl = Math.hypot(this.fv[k * 3], this.fv[k * 3 + 1], this.fv[k * 3 + 2]) || 1;
      ra[v * 3] = this.fv[k * 3] / vl;
      ra[v * 3 + 1] = this.fv[k * 3 + 1] / vl;
      ra[v * 3 + 2] = this.fv[k * 3 + 2] / vl;
    }
    for (const a of ['position', 'aFlame', 'aRise']) (this.flameGeo.getAttribute(a) as BufferAttribute).needsUpdate = true;
    this.flameGeo.setDrawRange(0, this.fn + 1);
  }

  /** Wind lines: spawned ahead in the air beside and over the line, racing a little with the rider so they whip past. */
  private stepWind(o: SpiritFlowInput, dt: number): void {
    const L = this.look;
    const max = o.reduced ? 0 : Math.round(WIND_MAX[this.tier] * L.wind);
    for (let i = this.winds.length - 1; i >= 0; i--) {
      const w = this.winds[i];
      w.t += dt;
      if (w.t >= w.life) {
        this.winds.splice(i, 1);
        continue;
      }
      for (let k = 0; k < WIND_PTS; k++) {
        w.pts[k * 3] += w.vx * dt;
        w.pts[k * 3 + 2] += w.vz * dt;
      }
    }
    // About one new line a tenth of a second at full wind, up to the tier's count.
    this.windAcc += dt * max * 1.6;
    while (this.windAcc >= 1 && this.winds.length < max) {
      this.windAcc -= 1;
      this.spawnWind(o);
    }
    if (this.windAcc > 1) this.windAcc = 1;
    const show = this.winds.length > 0;
    this.wind.visible = show;
    if (!show) {
      this.windGeo.setDrawRange(0, 0);
      return;
    }
    const pos = this.windGeo.getAttribute('position') as BufferAttribute;
    const rib = this.windGeo.getAttribute('aRib') as BufferAttribute;
    const pa = pos.array as Float32Array;
    const ra = rib.array as Float32Array;
    let n = 0;
    for (const w of this.winds) {
      const t = w.t / w.life;
      // Drawn on from its tail to its head over its first half, then let go from the tail.
      const head = Math.min(1, t / 0.45);
      const tail = Math.max(0, (t - 0.45) / 0.55);
      for (let k = 0; k < WIND_PTS; k++) {
        const a = Math.max(0, k - 1);
        const b = Math.min(WIND_PTS - 1, k + 1);
        tmpA.set(w.pts[b * 3] - w.pts[a * 3], w.pts[b * 3 + 1] - w.pts[a * 3 + 1], w.pts[b * 3 + 2] - w.pts[a * 3 + 2]);
        const p = tmpB.set(w.pts[k * 3], w.pts[k * 3 + 1], w.pts[k * 3 + 2]);
        const side = tmpA.cross(tmpC.copy(o.cam).sub(p));
        const sl = side.length();
        if (sl > 1e-6) side.multiplyScalar(1 / sl);
        // u runs 0 at the line's head (its downhill end) to 1 at its tail; only the drawn span shows.
        const s = 1 - k / (WIND_PTS - 1);
        const span = head > tail ? clamp01((s - tail) / Math.max(0.05, head - tail)) : 1;
        const vis = s >= tail && s <= head ? 1 : 0;
        for (let q = 0; q < 2; q++) {
          const sg = q === 0 ? -1 : 1;
          const v = (n * WIND_PTS + k) * 2 + q;
          pa[v * 3] = p.x + side.x * w.width * sg;
          pa[v * 3 + 1] = p.y + side.y * w.width * sg;
          pa[v * 3 + 2] = p.z + side.z * w.width * sg;
          ra[v * 4] = 1 - span;
          ra[v * 4 + 1] = sg;
          ra[v * 4 + 2] = w.alpha * vis;
          ra[v * 4 + 3] = 1;
        }
      }
      n++;
    }
    pos.needsUpdate = true;
    rib.needsUpdate = true;
    this.windGeo.setDrawRange(0, n * (WIND_PTS - 1) * 6);
  }

  private spawnWind(o: SpiritFlowInput): void {
    const f = o.dir;
    const rx = -f.z;
    const rz = f.x;
    // Ahead of the lens, out to either side or high over the line (never on the line of sight to the rider).
    const ahead = 7 + Math.random() * 20;
    const sideS = Math.random() < 0.5 ? -1 : 1;
    const side = sideS * (1.8 + Math.random() * 5);
    const len = 3.5 + Math.random() * 4;
    const cx = o.cam.x + f.x * ahead + rx * side;
    const cz = o.cam.z + f.z * ahead + rz * side;
    const g = o.ground(cx, cz);
    // (Low over the snow and under the lens: the first look hung one across the sky as a white scratch.)
    const h = 0.3 + Math.random() * Math.max(0.2, Math.min(1.6, o.cam.y - g - 0.6));
    const pts = new Float32Array(WIND_PTS * 3);
    const ph = Math.random() * 6.28;
    const amp = 0.18 + Math.random() * 0.25;
    const twist = (Math.random() - 0.5) * 0.08;
    for (let k = 0; k < WIND_PTS; k++) {
      // k = 0 is the head (downhill), the last the tail (uphill): a gentle S with a lift, along the travel.
      const s = k / (WIND_PTS - 1) - 0.5;
      const along = -s * len;
      const wave = Math.sin(ph + s * 5.2) * amp;
      const x = cx + f.x * along + rx * (wave + twist * along * along);
      const z = cz + f.z * along + rz * (wave + twist * along * along);
      pts[k * 3] = x;
      pts[k * 3 + 1] = Math.max(o.ground(x, z), g) + h + Math.cos(ph + s * 4.1) * amp * 0.5;
      pts[k * 3 + 2] = z;
    }
    const race = Math.hypot(o.vel.x, o.vel.z) * (0.3 + Math.random() * 0.15);
    this.winds.push({ t: 0, life: 0.55 + Math.random() * 0.35, pts, vx: f.x * race, vz: f.z * race, width: 0.016 + Math.random() * 0.014, alpha: 0.28 + 0.3 * Math.random() });
  }

  /** A ring of sparks off the scarf for a level gained. */
  private burst(o: SpiritFlowInput, count: number): void {
    if (SPARK_RATE[this.tier] <= 0) return;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 2.5 + Math.random() * 2;
      this.spark(o.tip, o.vel.x * 0.75 + Math.cos(a) * sp, o.vel.y * 0.75 + Math.sin(a) * sp * 0.8 + 1, o.vel.z * 0.75 + Math.sin(a + 1.3) * sp * 0.6, 0.5 + Math.random() * 0.3, 1);
    }
  }

  private spark(p: Vector3, vx: number, vy: number, vz: number, life: number, hot: number): void {
    if (this.sn >= MAX_SPARK) return;
    const i = this.sn++;
    this.sp[i * 3] = p.x;
    this.sp[i * 3 + 1] = p.y;
    this.sp[i * 3 + 2] = p.z;
    this.sv[i * 3] = vx;
    this.sv[i * 3 + 1] = vy;
    this.sv[i * 3 + 2] = vz;
    // (Its life left, and how hot: negative life marks a guttering ember's fall.)
    this.sl[i * 2] = hot;
    this.sl[i * 2 + 1] = life;
  }

  /** Sparks off the trail at the top of flow, and dim embers dropping off it as it gutters. */
  private stepSparks(o: SpiritFlowInput, dt: number): void {
    const L = this.look;
    const rate = SPARK_RATE[this.tier];
    if (rate > 0 && !o.reduced && this.fn > 2) {
      const want = rate * L.top + (this.gutter > 0 ? rate * 0.5 * this.gutter : 0);
      this.sAcc += want * dt;
      while (this.sAcc >= 1) {
        this.sAcc -= 1;
        // Off a point along the ribbon's first half, keeping less of the rider's speed so they fall behind past the lens.
        const j = Math.floor(Math.random() * this.fn);
        tmpA.set(this.fp[j * 3], this.fp[j * 3 + 1], this.fp[j * 3 + 2]).add(o.scarfAt(this.fu[j], tmpC));
        const ember = this.gutter > 0 && Math.random() < 0.7;
        const keep = ember ? 0.7 : 0.55 + Math.random() * 0.2;
        this.spark(tmpA, o.vel.x * keep + (Math.random() - 0.5) * 2, o.vel.y * keep + (ember ? -0.5 : 0.4 + Math.random()), o.vel.z * keep + (Math.random() - 0.5) * 2, ember ? 0.45 : 0.4 + Math.random() * 0.35, ember ? 0 : 1);
      }
    } else this.sAcc = 0;
    let i = 0;
    while (i < this.sn) {
      this.sl[i * 2 + 1] -= dt;
      if (this.sl[i * 2 + 1] <= 0) {
        const j = --this.sn;
        if (i !== j) {
          this.sp.copyWithin(i * 3, j * 3, j * 3 + 3);
          this.sv.copyWithin(i * 3, j * 3, j * 3 + 3);
          this.sl.copyWithin(i * 2, j * 2, j * 2 + 2);
        }
        continue;
      }
      this.sv[i * 3 + 1] -= (this.sl[i * 2] < 0.5 ? 6 : 1.5) * dt;
      this.sp[i * 3] += this.sv[i * 3] * dt;
      this.sp[i * 3 + 1] += this.sv[i * 3 + 1] * dt;
      this.sp[i * 3 + 2] += this.sv[i * 3 + 2] * dt;
      i++;
    }
    // (Nothing is sent while none fly: an idle frame at 6x costs its full time on Low's saturated thread.)
    if (this.sn === 0 && !this.sparks.visible) return;
    this.sparks.visible = this.sn > 0;
    // (The second slot is the life left; the shader reads it as the alpha, capped at 1.)
    this.sparkGeo.setDrawRange(0, this.sn);
    (this.sparkGeo.getAttribute('position') as BufferAttribute).needsUpdate = true;
    (this.sparkGeo.getAttribute('aSpark') as BufferAttribute).needsUpdate = true;
  }
}

/** Indices for `strips` triangle strips of `n` points each (two vertices a point). */
function stripIndex(strips: number, n: number): number[] {
  const idx: number[] = [];
  for (let s = 0; s < strips; s++) {
    for (let i = 0; i < n - 1; i++) {
      const a = (s * n + i) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return idx;
}
