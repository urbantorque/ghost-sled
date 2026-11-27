import { BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide, InstancedMesh, Matrix4, Mesh, NormalBlending, Object3D, OctahedronGeometry, PerspectiveCamera, PlaneGeometry, Points, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { Snap } from '../game/run';
import type { Beat } from '../game/beats';
import type { Course } from '../sim/course';
import { type Gully, gulliesOf, placesOf } from '../sim/gullhaven';
import type { Sim } from '../sim/sim';
import { SNOW, merge, part } from './flora';
import { box, quad, seg } from './landmarkKit';
import { strata } from './rockforms';
import { withChamfer } from './chamfer';
import { makeToonMaterial, shared } from './materials';
import { pushLocalLight } from './lights';
import { cliffGround, visualGround } from './ground';
import { SEA_GLSL, type SeaUniforms } from './massif';
import { BEACON, LIGHT_POINT, cleftAt, isGullhaven, lighthouseZ, seaLevelOf } from './gullhavenplan';
import { type Palette, getPalette } from './palette';
import { Mood } from '../sim/chaos';
import { LOW_BOLD, type StillFigure, crowdColors, stillCrowd } from './crowd';
import type { Particles } from './particles';
import { GullhavenPieces } from './gullhavenpieces';
import { GullhavenLegends } from './gullhavenlegends';
import { momentPlays } from '../sim/moments';
import type { Detail } from './postfx/tiers';
import { reduced } from '../ui/motion';
import type { ViewMode } from './world';

// Gullhaven's own world (round 9, notes/r9-gullhaven-world.md), loaded with its course (world.ts imports this file on
// demand: nothing of it is in the first download). What makes the place its own, and none of the five's grammar nor the
// Old Run's:
//  - the sea: a plane at its own level (gullhavenplan.ts seaLevelOf), a thousand metres under the cape's head and
//    beside the ice at the harbour, painted by the same water as the sky's dome past it (massif.ts seaOcean), with the
//    surf white along the cliff's foot and round the sea stacks standing out of it;
//  - the clifftop path's snow fence along the seaward edge, its pennants streaming inland on the sea wind and standing
//    straight up where a gully's wind climbs; a dry-stone wall and the moor's cairns and stones on the land side;
//  - each gully: its cleft in the sea cliff (ground.ts cliffGround), a cornice along its lip, spindrift streaming up
//    the column of rising air over its mouth, gulls hanging still in it, a windsock on the fence standing on end;
//  - the old beacon on the cape's head burning, its smoke torn inland; the lighthouse on its point ahead, its beam
//    turning; the fish sheds down the harbour road, the slipway, the harbour's ice between frozen-in boats and the line
//    between the two pier-head lights.
// Everything is a few instanced or merged draws. Low draws a designed cheaper version: posts twice as far apart and no
// laths, fewer stones, stacks and gulls, the sea's fine octave off, the spindrift thinner, the places only within reach.

type V3 = [number, number, number];

const ROCK = new Color('#363850');
const ROCK_D = new Color('#26283C');
const ROCK_L = new Color('#4C4E68');
// (The fence is weathered pale timber with a little light of its own: in near-navy slats against the low sun it stood
// along the run as a hard dark barcode, a hazard's silhouette, the first critic.)
const POST_C = new Color('#9A8E86');
const LATH = new Color('#C2B6A6');
const RAIL_C = new Color('#8A7E76');
const STONE = new Color('#7E7C8E');
const STONE_D = new Color('#5C5A6E');
const WHITE = new Color('#EEEAE2');
const LIME = new Color('#E4DED2');
const SLATE = new Color('#3C3E54');
const TAR = new Color('#3A3236');
const TAR_L = new Color('#4E4246');
const IRON = new Color('#262430');
const GLASS = new Color('#2A2E48');
const FLAG_A = new Color('#3E6CA8');
const FLAG_B = new Color('#E8E2D2');
const SOCK_A = new Color('#E8E2D2');
const SOCK_B = new Color('#4A72AE');
const HULLS = [new Color('#2E4A6A'), new Color('#3E5E50'), new Color('#E4DED0'), new Color('#4C3E5A'), new Color('#2A3A4E')];
const GULL = new Color('#F4F2EE');
const CREAM = new Color('#EEE4D0');
/** The harbour's sea ice beyond the corridor: a pale cold sheet, a step under the snow. */
const ICE = new Color('#D6E0F2');
const GULL_W = new Color('#A8AEBC');
const GULL_T = new Color('#2A2A34');
/** Lamplight in the windows and the pier-head lights: warm, under the lantern's marigold (it is lamplight, not a thing
 *  to take). The lighthouse's beam is a cold white. */
const LAMP_HEX = new Color('#FFC88A');
const LAMP_LIN = new Color('#FFE2BC').convertSRGBToLinear();
const FIRE_LIN = new Color('#FFB27A').convertSRGBToLinear();

/** Metres between the fence's posts (Low: twice that), and between its pennants. */
const POST_GAP = 3.2;
const FLAG_EVERY = 4;
/** The fence's posts stand with their inner face at the run's limit, where the sim turns a sled back (they stood a
 *  quarter metre inside the edge, and a sled pressed against the fence ran a metre through it), never further out than
 *  the cliffpath's limit: past it the cliff's fall begins. */
const FENCE_MAX = 0.8;

const m4 = new Matrix4();
const q4 = new Quaternion();
const v3 = new Vector3();
const s3 = new Vector3();
const up = new Vector3(0, 1, 0);

/** A small deterministic hash, 0..1. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/** Moves parts (built about the origin, +z up the run, as landmarkKit builds) to sim (x, y, z) turned by yaw. */
function placed(parts: BufferGeometry[], x: number, y: number, z: number, yaw: number): BufferGeometry[] {
  const m = new Matrix4().compose(new Vector3(x, y, -z), new Quaternion().setFromAxisAngle(up, yaw), new Vector3(1, 1, 1));
  for (const g of parts) g.applyMatrix4(m);
  return parts;
}

/** The corridor's seaward edge at z (sim x), where the fence stands. */
function edgeX(c: Course, z: number): number {
  return c.centerX(z) + c.halfWidth(z);
}

/** Where the fence stands at z (sim x). */
function fenceX(c: Course, z: number): number {
  return edgeX(c, z) + Math.min(c.edgeLimit(z), FENCE_MAX) + 0.08;
}

/** The shore at z: the first metre past the seaward edge where the drawn cliff reaches the sea (sim x). */
function shoreX(c: Course, z: number, sea: number): number {
  const x0 = edgeX(c, z);
  let e = 0.8;
  for (; e < 160; e += 4) if (cliffGround(c, x0 + e, z) <= sea + 0.5) break;
  let a = Math.max(0.6, e - 4);
  let b = e;
  for (let i = 0; i < 6; i++) {
    const m = (a + b) / 2;
    if (cliffGround(c, x0 + m, z) <= sea + 0.5) b = m;
    else a = m;
  }
  return x0 + b;
}

// ------------------------------------------------------------------ the sea's materials

/** The sea plane: the same water as the dome's, at the sea's level, so the near sea hides the cliff's foot under it and
 *  meets the far sea past its rim without a seam. */
function seaMaterial(sea: SeaUniforms, q: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...sea, uTime: shared.uTime },
    defines: { SEA_Q: q },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vW;
      ${SEA_GLSL}
      void main() {
        vec3 d = normalize(vW - cameraPosition);
        gl_FragColor = vec4(seaOfClouds(d).rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** A disc of rings round the lens, finer near it (the sea plane follows the lens across the water). */
function discGeometry(r: number, rings: number, seg: number): BufferGeometry {
  const pos: number[] = [0, 0, 0];
  for (let j = 1; j <= rings; j++) {
    const rr = r * Math.pow(j / rings, 2);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.sin(a) * rr, 0, Math.cos(a) * rr);
    }
  }
  const idx: number[] = [];
  // (Wound to face up: the lens looks down on the sea.)
  for (let i = 0; i < seg; i++) idx.push(0, 1 + i, 1 + ((i + 1) % seg));
  for (let j = 1; j < rings; j++) {
    const a0 = 1 + (j - 1) * seg;
    const b0 = 1 + j * seg;
    for (let i = 0; i < seg; i++) {
      const i1 = (i + 1) % seg;
      idx.push(a0 + i, b0 + i, a0 + i1, a0 + i1, b0 + i, b0 + i1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

/** The surf: a band of foam along the cliff's foot and round each stack, breaking in toward the shore and drawing back,
 *  its far reaches gone into the sea's own haze. One draw; Low's foam holds still. */
function surfMaterial(sea: SeaUniforms): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { ...sea, uTime: shared.uTime, uFoam: { value: new Color() }, uFoamShade: { value: new Color() }, uLive: { value: 1 } },
    defines: { SEA_Q: 0 },
    vertexShader: /* glsl */ `
      attribute float aU;
      attribute float aS;
      varying float vU;
      varying float vS;
      varying vec3 vW;
      void main() {
        vU = aU;
        vS = aS;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uLive;
      uniform vec3 uFoam;
      uniform vec3 uFoamShade;
      varying float vU;
      varying float vS;
      varying vec3 vW;
      ${SEA_GLSL}
      void main() {
        float T = uTime * uLive;
        // Lines of breaking water running in to the shore, broken along their length, and the wash at the foot.
        float run = vU * 6.0 + T * 0.55 + snoise(vec2(vS * 0.05, 1.0)) * 1.5;
        float line = smoothstep(0.55, 0.95, sin(run * 3.14159) * 0.5 + 0.5) * smoothstep(-0.3, 0.5, snoise(vec2(vS * 0.08, vU * 3.0 - T * 0.2)));
        float wash = 1.0 - smoothstep(0.0, 0.35, vU);
        float a = max(line * (1.0 - vU) * 0.8, wash * (0.75 + 0.25 * sin(T * 0.9 + vS * 0.03)));
        a *= smoothstep(1.0, 0.7, vU);
        vec3 d = vW - cameraPosition;
        float dist = length(d);
        a *= 1.0 - smoothstep(2600.0, 4200.0, dist);
        if (a < 0.01) discard;
        vec3 col = mix(uFoamShade, uFoam, smoothstep(0.2, 0.9, line + wash * 0.5));
        float t = dist;
        col = mix(col, uSeaHaze, smoothstep(2500.0, 18000.0, t) * 0.85);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Spindrift up a gully's column: streaks of snow lifted out of the cleft on the sea wind and carried up past the lip,
 *  thinning out over the rim where the wind spills inland. Points, one draw for every column; held still under reduced
 *  motion. */
function driftMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: { ...shared, uLive: { value: 1 }, uScale: { value: 400 }, uLit: { value: new Color() }, uShade: { value: new Color() } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uLive;
      uniform float uScale;
      attribute vec4 aSeed;
      attribute vec3 aSpan;
      varying float vA;
      varying float vH;
      void main() {
        float T = uTime * uLive;
        // aSpan: the column's height (from its foot under the rim to well over it), its rise speed, and its half-width.
        float H = aSpan.x;
        float k = fract(aSeed.w + T * aSpan.y / H);
        vec3 p = position;
        p.y += k * H;
        // Swirling as it climbs, and leaning inland (-x) where it spills over the rim.
        float sw = sin(T * 1.7 + aSeed.x * 6.28 + k * 9.0);
        p.x += sw * aSpan.z * 0.5 - smoothstep(0.65, 1.0, k) * 4.0;
        p.z += cos(T * 1.3 + aSeed.y * 6.28 + k * 7.0) * 1.2;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * (0.2 + 0.24 * aSeed.z) / max(-mv.z, 1.0), 1.5, 18.0);
        // (Gone near the lens, where a mote is a blot on the glass.)
        vA = smoothstep(0.0, 0.18, k) * (1.0 - smoothstep(0.62, 1.0, k)) * (1.0 - smoothstep(160.0, 420.0, -mv.z)) * smoothstep(7.0, 22.0, -mv.z);
        vH = k;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uLit;
      uniform vec3 uShade;
      varying float vA;
      varying float vH;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        // A streak drawn up by the wind: narrow across, long upward.
        float r = length(vec2(q.x * 2.6, q.y * 0.9));
        float a = (1.0 - smoothstep(0.12, 0.5, r)) * vA * 0.72;
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uShade, uLit, 0.4 + 0.6 * vH), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** The lighthouse's beam: a long cone of pale light turning over the sea and the cliff top, brightest at its source,
 *  soft at its edges, a breath of it in the air (additive, depth-tested, never over the near rider). */
function beamMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: 2,
    uniforms: { uK: { value: 0.3 }, uCol: { value: new Color('#F4F2E6') } },
    vertexShader: /* glsl */ `
      varying float vAlong;
      varying float vFace;
      varying float vFade;
      void main() {
        // (The cone runs along its own +x from the lantern: how far along it, 0 to 1.)
        vAlong = clamp(position.x / 900.0, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFace = abs(dot(n, normalize(-mv.xyz)));
        vFade = smoothstep(12.0, 40.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uK;
      uniform vec3 uCol;
      varying float vAlong;
      varying float vFace;
      varying float vFade;
      void main() {
        float a = pow(vFace, 2.2) * pow(1.0 - vAlong, 2.6) * uK * vFade * 0.5;
        gl_FragColor = vec4(uCol * a, 1.0);
      }
    `,
  });
}

/** A billboard of smoke torn off the beacon's fire on the wind, lit warm from under by it. */
function smokeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { ...shared, uLit: { value: new Color() }, uShade: { value: new Color() }, uFire: { value: new Color('#FF9A5A') }, uLive: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uLive;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uFire;
      varying vec2 vUv;
      ${SNOISE2}
      void main() {
        float T = uTime * uLive;
        // The plume leaves the fire upward and is bent flat inland (along +u) by the wind, widening as it goes.
        float t = vUv.x;
        float yc = 0.12 + 0.35 * pow(t, 0.55) * 0.5 + 0.03 * sin(t * 9.0 - T * 1.4);
        float w = 0.02 + 0.13 * t;
        float dy = (vUv.y - yc) / w;
        float n = snoise2(vec2(t * 5.0 - T * 0.5, vUv.y * 6.0)) * 0.6 + snoise2(vec2(t * 13.0 - T * 1.1, vUv.y * 15.0 + 2.0)) * 0.4;
        float dens = exp(-dy * dy * 1.4) * (0.7 + 0.5 * n) * (1.0 - smoothstep(0.55, 1.0, t)) * smoothstep(0.0, 0.04, t);
        float a = smoothstep(0.12, 0.6, dens) * 0.4;
        if (a < 0.01) discard;
        vec3 col = mix(uShade, uLit, clamp(0.5 + n * 0.4 - dy * 0.2, 0.0, 1.0));
        col = mix(col, uFire, (1.0 - smoothstep(0.0, 0.05, t)) * 0.35);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** 2D simplex noise for the smoke (as massif.ts NOISE, under its own name so the two never collide in one program). */
const SNOISE2 = /* glsl */ `
  vec3 g289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 g289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 gperm(vec3 x) { return g289(((x * 34.0) + 10.0) * x); }
  float snoise2(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = g289(i);
    vec3 p = gperm(gperm(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// ------------------------------------------------------------------ the world

export class GullhavenWorld {
  readonly root = new Object3D();
  private course: Course | null = null;
  private detail: Detail = 'high';
  private sea = 0;
  private readonly mat: ShaderMaterial;
  private readonly glow: ShaderMaterial;
  private readonly cloth: ShaderMaterial;
  private readonly rockMat: ShaderMaterial;
  private readonly fenceMat: ShaderMaterial;
  private readonly paintMat: ShaderMaterial;
  private readonly owned: Array<{ dispose(): void }> = [];
  private readonly seaMat: ShaderMaterial;
  private readonly seaMesh: Mesh;
  private readonly surfMat: ShaderMaterial;
  private readonly driftMat: ShaderMaterial;
  private readonly beamMat: ShaderMaterial;
  private readonly smokeMat: ShaderMaterial;
  /** The places drawn only from within reach of them (sim z). */
  private windows: Array<{ m: Object3D; z0: number; z1: number }> = [];
  /** Lamps and lit windows that light the snow once the day has gone (sim x, y, z, radius). */
  private lamps: Array<[number, number, number, number]> = [];
  /** The beacon's fire (sim x, y, z), the lighthouse's lantern and its beam. */
  private fire: V3 | null = null;
  private light: V3 | null = null;
  private beam: Mesh | null = null;
  /** The gulls that wheel (instance, centre x, y, z, radius, speed, phase) and those that hang in the columns. */
  private gulls: InstancedMesh | null = null;
  private wheel: Array<[number, number, number, number, number, number, number]> = [];
  private hang: Array<[number, number, number, number, number]> = [];
  /** The three set pieces' props (gullhavenpieces.ts): the lighthouse's marks and its beam on the path, the Great Geo's
   *  far line, the stacks' gaps on the shore road. */
  private readonly pieces: GullhavenPieces;
  /** Its two legends, the Beacon Keeper and the Herring Lights (gullhavenlegends.ts, round 9's feel pass). */
  private readonly legends = new GullhavenLegends();

  constructor(particles: Particles | null, sea: SeaUniforms) {
    this.root.name = 'gullhaven-world';
    this.pieces = new GullhavenPieces(particles);
    this.mat = makeToonMaterial({ coolShade: 0.5, stone: true });
    this.glow = makeToonMaterial({ coolShade: 0.4, emissive: LAMP_HEX.clone(), emissiveStrength: 0 });
    this.cloth = makeToonMaterial({ coolShade: 0.45, cloth: true, doubleSided: true });
    // (The sea's rock keeps its own dark in shade: at the props' cool shade, seen against the low sun, the stacks and
    // the clefts' walls took the snow's pale shade and read as white posts.)
    // (Not the stone shader: it lays snow on whatever faces up, and from the cliff top a stack is all ledges and crown;
    // its beds are the form's own three values, rockforms.ts.)
    // (Round 9's feel pass: and it keeps the sea's clear air far under the cliff, materials.ts DEEP_CLEAR. Fogged to the
    // sky's pale air a thousand metres down, the stacks under the Great Geo and on the title still read as posts.)
    this.rockMat = makeToonMaterial({ coolShade: 0.12, doubleSided: true, rim: 0.12, deepClear: true });
    // (The fence's timber is pale and weathered, its shade its own: with a light of its own it read to the second critic
    // as lit from nowhere, and orange under the moon; dark against the low sun its posts rake their shadows to the lens.)
    this.fenceMat = makeToonMaterial({ coolShade: 0.3 });
    // (Painted and limewashed work, the lighthouse and the houses: its shade its own colour, so a white tower seen
    // against the low sun or the moon is shaded and rimmed, not the brightest thing in the frame.)
    this.paintMat = makeToonMaterial({ coolShade: 0.18, rim: 0.22 });
    this.cloth.uniforms.uCloth.value = 0.16;
    this.seaMat = seaMaterial(sea, 1);
    this.seaMesh = new Mesh(discGeometry(4800, 28, 96), this.seaMat);
    this.seaMesh.name = 'sea';
    this.seaMesh.frustumCulled = false;
    // (Straight after the panorama and the dome, before the world: it writes depth, so what lies under the water is
    // hidden by it.)
    this.seaMesh.renderOrder = -8;
    this.surfMat = surfMaterial(sea);
    this.driftMat = driftMaterial();
    this.beamMat = beamMaterial();
    this.smokeMat = smokeMaterial();
  }

  setDetail(d: Detail): void {
    if (d === this.detail) return;
    this.detail = d;
    const q = d === 'low' ? 0 : 1;
    if (this.seaMat.defines.SEA_Q !== q) {
      this.seaMat.defines.SEA_Q = q;
      this.seaMat.needsUpdate = true;
    }
    if (this.course) this.build(this.course);
  }

  setCourse(c: Course): void {
    if (c === this.course) return;
    this.course = c;
    this.build(c);
  }

  reset(): void {
    this.pieces.reset();
    this.legends.reset();
  }

  /** The set pieces' named moments this frame (a run's only): a mark ridden in the beam, a gap threaded, the Great Geo
   *  won or lost (gullhavenpieces.ts). */
  beats(list: readonly Beat[], s: Snap): void {
    if (this.course && isGullhaven(this.course)) this.pieces.beats(list, s);
  }

  private dispose(): void {
    for (const o of [...this.root.children]) this.root.remove(o);
    for (const o of this.owned) o.dispose();
    this.owned.length = 0;
    this.pieces.clear();
    this.windows = [];
    this.lamps = [];
    this.fire = null;
    this.light = null;
    this.beam = null;
    this.gulls = null;
    this.wheel = [];
    this.hang = [];
  }

  private keep<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  private add(g: BufferGeometry, mat: ShaderMaterial = this.mat, z0 = -Infinity, z1 = Infinity, shadow = true): Mesh {
    const m = new Mesh(this.keep(g), mat);
    if (z0 > -Infinity) this.windows.push({ m, z0, z1 });
    m.castShadow = shadow && mat !== this.glow;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    this.root.add(m);
    return m;
  }

  private inst(g: BufferGeometry, n: number, mat: ShaderMaterial = this.mat): InstancedMesh {
    const im = new InstancedMesh(this.keep(g), mat, Math.max(1, n));
    im.castShadow = true;
    im.receiveShadow = true;
    return im;
  }

  private build(c: Course): void {
    this.dispose();
    if (!isGullhaven(c)) return;
    this.sea = seaLevelOf(c);
    const low = this.detail === 'low';
    this.root.add(this.seaMesh);
    withChamfer(low ? 'low' : 'full', () => {
      this.fence(c, low);
      // (No outcrops on the brow: the third critic read them as pale untextured stubs lining the edge, and picked the edge
      // without them in every pair. brow() is kept for the lane to try again with the cliff's own face.)
      void this.brow;
      this.moorWall(c, low);
      this.moorStones(c, low);
      this.gullies(c, low);
      this.stacks(c, low);
      this.surf(c, low);
      this.beacon(c, low);
      this.lighthouse(c, low);
      this.harbour(c, low);
      this.birds(c, low);
    });
    // (The set pieces' props are built from the plays on the first frame: a run's own, or the course's on the title.)
    this.pieces.lantern = this.light;
    this.root.add(this.pieces.root);
    this.root.add(this.legends.root);
  }

  // ------------------------------------------------------------------ the fence

  /** The snow fence along the seaward edge, the whole run: posts every POST_GAP metres (Low: twice that), two rails, and
   *  on Medium and High a panel of laths between each pair, instanced; a pennant on every FLAG_EVERY-th post, streaming
   *  inland on the sea wind, and over a gully's column standing straight up on it. It is the run's strobe at speed where
   *  the five have stakes and flags (speedposts.ts stands none here). */
  private fence(c: Course, low: boolean): void {
    const gap = POST_GAP * (low ? 2 : 1);
    const z0 = 4;
    // (To the slipway's head: past it the run's edge is open onto the basin's ice, and the fence ran across the slip.)
    const z1 = placesOf(c).harbour + 8;
    const n = Math.ceil((z1 - z0) / gap) + 1;
    const postG = part(new CylinderGeometry(0.06, 0.08, 1.45, low ? 4 : 5, 1), POST_C, { pos: [0, 0.62, 0] });
    const railParts = [part(new CylinderGeometry(0.035, 0.035, 1, 4, 1), RAIL_C, { pos: [0, 1.15, 0.5], rot: [Math.PI / 2, 0, 0] })];
    if (!low) railParts.push(part(new CylinderGeometry(0.03, 0.03, 1, 4, 1), RAIL_C, { pos: [0, 0.38, 0.5], rot: [Math.PI / 2, 0, 0] }));
    const railG = merge(railParts);
    // A panel of laths, a unit long along +z (stretched to the gap), each lath a narrow board with a gap beside it.
    const laths: BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) laths.push(box(0.03, 1.1, 0.12, LATH, [0, 0.72 + (i % 2) * 0.05, (i + 0.5) / 4]));
    const lathG = merge(laths);
    const posts = this.inst(postG, n, this.fenceMat);
    const rails = this.inst(railG, n, this.fenceMat);
    const panels = low ? null : this.inst(lathG, n, this.fenceMat);
    // (The laths cast no shadow: seen from a flight their shadows laid a blue barcode along the edge.)
    if (panels) panels.castShadow = false;
    // The pennants: a triangle of cloth on a short staff over the post, flying along its own +x (aSway 0 at the staff).
    const nf = Math.ceil(n / FLAG_EVERY);
    const flagsA = this.inst(pennant(FLAG_A), nf, this.cloth);
    // (Low: one colour of pennant on the posts themselves, no staffs: two draws fewer.)
    const flagsB = low ? null : this.inst(pennant(FLAG_B), nf, this.cloth);
    const staffG = part(new CylinderGeometry(0.025, 0.025, 1.0, 4, 1), POST_C, { pos: [0, 1.85, 0] });
    const staffs = low ? null : this.inst(staffG, nf, this.fenceMat);
    const gullies = gulliesOf(c);
    const upAt = (z: number): number => {
      let k = 0;
      for (const g of gullies) {
        if (z < g.zL - 30 || z > g.zL + g.column + 20) continue;
        k = Math.max(k, smoothstep(g.zL - 24, g.zL - 6, z) * (1 - smoothstep(g.zL + g.column - 10, g.zL + g.column + 14, z)));
      }
      return k;
    };
    let k = 0;
    let r = 0;
    let f = 0;
    let fa = 0;
    let fb = 0;
    let prev: Vector3 | null = null;
    for (let i = 0; i < n; i++) {
      const z = Math.min(z1, z0 + i * gap);
      const x = fenceX(c, z);
      const y = visualGround(c, x, z);
      v3.set(x, y - 0.06, -z);
      m4.compose(v3, q4.identity(), s3.set(1, 1, 1));
      posts.setMatrixAt(k++, m4);
      if (prev) {
        const d = v3.clone().sub(prev);
        const len = d.length();
        q4.setFromUnitVectors(new Vector3(0, 0, 1), d.clone().normalize());
        m4.compose(prev, q4, s3.set(1, 1, len));
        rails.setMatrixAt(r, m4);
        if (panels) {
          // (Laths stand upright: the panel keeps the run's direction in plan and the ground's rise along it.)
          const yaw = Math.atan2(d.x, d.z);
          q4.setFromAxisAngle(up, yaw);
          m4.compose(prev, q4, s3.set(1, 1, Math.hypot(d.x, d.z)));
          const e = m4.elements;
          e[9] += d.y;
          panels.setMatrixAt(r, m4);
        }
        r++;
      }
      prev = v3.clone();
      if (i % FLAG_EVERY === 0) {
        if (staffs) staffs.setMatrixAt(f++, m4.compose(v3, q4.identity(), s3.set(1, 1, 1)));
        // Inland (-x, away from the sea) on the wind, a little up; over a column straight up.
        const k2 = upAt(z);
        const yaw = Math.PI + (hash(i, 3) - 0.5) * 0.3;
        const pitch = -0.18 - k2 * 1.35;
        q4.setFromAxisAngle(up, yaw).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -pitch));
        m4.compose(v3.clone().add(new Vector3(0, staffs ? 1.98 : 1.2, 0)), q4, s3.set(1, 1, 1));
        if (!flagsB || Math.floor(i / FLAG_EVERY) % 2 === 0) flagsA.setMatrixAt(fa++, m4);
        else flagsB.setMatrixAt(fb++, m4);
      }
    }
    posts.count = k;
    rails.count = r;
    if (panels) panels.count = r;
    if (staffs) staffs.count = f;
    flagsA.count = fa;
    if (flagsB) flagsB.count = fb;
    // (The pennants and their staffs cast no shadow: the low light laid their shapes across the run as figures with an
    // arm raised, cast by nothing in view, the first critic.)
    for (const im of [staffs, flagsA, flagsB]) if (im) im.castShadow = false;
    for (const im of [posts, rails, panels, staffs, flagsA, flagsB]) {
      if (!im) continue;
      im.computeBoundingSphere();
      im.name = 'fence';
      this.root.add(im);
    }
  }

  /** The cliff's brow: outcrops of its bedded rock along the edge past the fence, every so often, standing a little
   *  over the edge and running down the face, with a tongue of snow on their tops. They break the edge's line (from a
   *  flight it read as a table's edge with the sea under it, the second critic) and say the face is rock. One draw. */
  private brow(c: Course, low: boolean): void {
    const g = strata({ rx: 0.5, rz: 0.5, h: 1, foot: 3, layers: low ? 4 : 6, sides: low ? 5 : 7, rock: [ROCK_D, ROCK, ROCK_L], lie: SNOW, taper: 0.25, shift: 0.2, dip: 0.2, warp: 0.35, rough: 0.35, lieMin: 0.12, seed: 0xb40 });
    const spots: Array<[number, number, number, number, number]> = [];
    const gl = gulliesOf(c);
    const end = placesOf(c).descent;
    for (let z = 40, j = 0; z < end; j++) {
      z += (low ? 34 : 18) + hash(j, 61) * 22;
      // (Never on a lip's cornice, nor on the beacon's or the lighthouse's points.)
      if (gl.some((g) => z > g.zL - 12 && z < g.zL + 6)) continue;
      if (Math.abs(z - BEACON.z) < 20 || Math.abs(z - lighthouseZ(c)) < 30) continue;
      const x = edgeX(c, z) + 1.6 + hash(j, 62) * 2.5;
      const top = c.ground(edgeX(c, z) - 0.2, z);
      const w = 3 + hash(j, 63) * 5;
      spots.push([x, top - w * 0.55, z, w, hash(j, 64) * 6.28]);
    }
    const im = this.inst(g, spots.length, this.rockMat);
    spots.forEach(([x, y, z, w, yaw], i) => {
      q4.setFromAxisAngle(up, yaw);
      m4.compose(v3.set(x, y, -z), q4, s3.set(w, w * 0.8, w));
      im.setMatrixAt(i, m4);
    });
    im.computeBoundingSphere();
    im.name = 'brow';
    this.root.add(im);
  }

  // ------------------------------------------------------------------ the moor

  /** A dry-stone wall along the moor's side of the run, a few metres past the corridor's edge, in lengths with gaps where
   *  a gate or a fallen stretch would be; and walls climbing the moor from it, field boundaries running up to the tops.
   *  Each length is a block of stacked stone with a snow cap, instanced (one draw). The strobe on the land side. */
  private moorWall(c: Course, low: boolean): void {
    const len = 2.6;
    // (A length of dry stone, its stones laid in two courses under a row of upright coping stones, snow lying along
    // the top: a block under a white lid read to the first critic as a lidded prism, and from a flight a row of them as
    // a dotted line. Each length runs into the next. Low keeps one block a length.)
    const stones: BufferGeometry[] = [];
    if (low) {
      stones.push(part(new CylinderGeometry(0.42, 0.55, 1.0, 5, 2), STONE, { pos: [0, 0.48, 0], rot: [0, 0.3, 0], scale: [1, 1, (len * 1.04) / 1.0], jitter: 0.12 }));
      stones.push(part(new CylinderGeometry(0.36, 0.42, 0.14, 5, 1), SNOW, { pos: [0, 1.0, 0], rot: [0, 0.3, 0], scale: [1, 1, (len * 1.02) / 0.82], jitter: 0.06 }));
    } else {
      for (let k = 0; k < 3; k++) stones.push(part(new BoxGeometry(0.62, 0.42, 0.9), k % 2 ? STONE : STONE_D, { pos: [0, 0.21, -len / 2 + 0.45 + k * 0.86], jitter: 0.07 }));
      for (let k = 0; k < 3; k++) stones.push(part(new BoxGeometry(0.5, 0.36, 0.82), k % 2 ? STONE_D : STONE, { pos: [0, 0.6, -len / 2 + 0.85 + k * 0.86], jitter: 0.07 }));
      for (let k = 0; k < 6; k++) stones.push(part(new BoxGeometry(0.38, 0.32, 0.16), k % 2 ? STONE_D : STONE, { pos: [0, 0.94, -len / 2 + 0.22 + k * 0.43], rot: [0.12 * (k % 3 - 1), 0, 0], jitter: 0.04 }));
      stones.push(part(new BoxGeometry(0.42, 0.08, len * 0.98), SNOW, { pos: [0.02, 1.12, 0], jitter: 0.03 }));
    }
    const blockG = merge(stones);
    const spots: Array<[number, number, number, number]> = [];
    const end = placesOf(c).descent;
    const e0 = 4.2;
    for (let z = 210; z < end; z += len * (low ? 1.0 : 1.0)) {
      // (Gaps: a gateway every so often, and stretches tumbled.)
      if (hash(Math.floor(z / 37), 11) < 0.16) continue;
      const x = c.centerX(z) - c.halfWidth(z) - e0;
      const x2 = c.centerX(z + len) - c.halfWidth(z + len) - e0;
      spots.push([x, visualGround(c, x, z), z, Math.atan2(x2 - x, len)]);
    }
    // Field walls up the moor, square to the run.
    for (let j = 0; j < 40; j++) {
      const zc = 300 + j * 210 + hash(j, 5) * 90;
      if (zc > end - 40) break;
      const L = 30 + hash(j, 6) * 80;
      const xs = c.centerX(zc) - c.halfWidth(zc) - e0;
      for (let d = 1.5; d < L; d += len) {
        if (low && hash(j, Math.floor(d)) < 0.2) continue;
        const x = xs - d;
        const zz = zc + d * 0.12;
        spots.push([x, visualGround(c, x, zz), zz, Math.PI / 2 + 0.12]);
      }
    }
    const im = this.inst(blockG, spots.length);
    spots.forEach(([x, y, z, yaw], i) => {
      q4.setFromAxisAngle(up, yaw);
      m4.compose(v3.set(x, y - 0.12, -z), q4, s3.set(1, 0.85 + hash(i, 1) * 0.3, 1));
      im.setMatrixAt(i, m4);
    });
    im.computeBoundingSphere();
    im.name = 'moor-wall';
    this.root.add(im);
  }

  /** The moor's stones and cairns: boulders broken out of the snow up the slope, and a cairn on a knoll now and then. */
  private moorStones(c: Course, low: boolean): void {
    const rockG = part(new DodecahedronGeometry(1, 0), ROCK_L, { jitter: 0.35 });
    const capG = part(new SphereGeometry(0.8, 5, 3, 0, Math.PI * 2, 0, Math.PI / 2), SNOW, { pos: [0.15, 0.55, -0.1], scale: [1, 0.45, 1], jitter: 0.1 });
    const boulder = merge([rockG, capG]);
    const spots: Array<[number, number, number, number, number]> = [];
    const end = placesOf(c).sheds;
    const step = low ? 24 : 12;
    for (let z = 120, j = 0; z < end; z += step, j++) {
      const e = 9 + hash(j, 21) * 120;
      const x = c.centerX(z) - c.halfWidth(z) - e;
      const zz = z + hash(j, 22) * step;
      spots.push([x, visualGround(c, x, zz), zz, 0.6 + hash(j, 23) * 1.6, hash(j, 24) * 6.28]);
    }
    const im = this.inst(boulder, spots.length);
    spots.forEach(([x, y, z, s, yaw], i) => {
      q4.setFromAxisAngle(up, yaw);
      m4.compose(v3.set(x, y - s * 0.35, -z), q4, s3.set(s * 1.3, s * 0.8, s));
      im.setMatrixAt(i, m4);
    });
    im.computeBoundingSphere();
    im.name = 'moor-stones';
    this.root.add(im);
    // Cairns: stacked stones on a knoll, every few hundred metres up the moor.
    const cairn: BufferGeometry[] = [];
    for (let j = 0; j < 14; j++) {
      const z = 260 + j * 330 + hash(j, 31) * 120;
      if (z > end) break;
      const x = c.centerX(z) - c.halfWidth(z) - 18 - hash(j, 32) * 50;
      const y = visualGround(c, x, z);
      const h = 1.6 + hash(j, 33) * 1.4;
      cairn.push(part(new ConeGeometry(0.9, h, 6, 3), STONE_D, { pos: [x, y + h / 2 - 0.1, -z], jitter: 0.18 }));
      cairn.push(part(new SphereGeometry(0.35, 5, 3), STONE, { pos: [x, y + h - 0.05, -z], jitter: 0.08 }));
    }
    if (cairn.length) this.add(merge(cairn)).name = 'cairns';
  }

  // ------------------------------------------------------------------ the gullies

  /** Each gully: a cornice of wind-packed snow along its lip, curled over the drop; a windsock on the fence by the lip
   *  standing on end in the wind that climbs the gully; and the spindrift streaming up its column. */
  private gullies(c: Course, low: boolean): void {
    const cornice: BufferGeometry[] = [];
    const socks: BufferGeometry[] = [];
    const pts: number[] = [];
    const seeds: number[] = [];
    const spans: number[] = [];
    const walls: BufferGeometry[] = [];
    for (const g of gulliesOf(c)) {
      this.lip(c, g, cornice);
      this.sock(c, g, socks);
      this.geoWalls(c, g, walls, low);
      const per = low ? 70 : 220;
      const rim = c.baseY(g.zL);
      for (let i = 0; i < per; i++) {
        const h1 = hash(g.index * 977 + i, 41);
        const h2 = hash(g.index * 977 + i, 42);
        const z = g.zL - 4 + h1 * (g.column + 8);
        // (Beside the line, over the cleft's edge and out over the slot, where the wind comes up out of it: drawn up the
        // line itself it rose out of the rider's beanie.)
        const x = g.bx + 2.5 + h2 * (edgeX(c, z) - g.bx + 7);
        // From the face and the cleft under the rim to well over it.
        const foot = rim - 26 - h2 * 10;
        pts.push(x, foot, -z);
        seeds.push(hash(i, g.index), hash(i + 7, g.index), hash(i + 13, g.index), hash(i + 29, g.index));
        spans.push(40 + h1 * 8, 6 + h2 * 4, 3.4);
      }
    }
    // (Low: the windsocks stand still in the cornices' draw.)
    this.add(merge(low ? [...cornice, ...socks.map((g) => (g.deleteAttribute('aSway'), g))] : cornice)).name = 'cornices';
    if (walls.length) this.add(merge(walls), this.rockMat).name = 'geo-walls';
    if (socks.length && !low) {
      const m = new Mesh(this.keep(merge(socks)), this.cloth);
      m.name = 'windsocks';
      m.castShadow = true;
      this.root.add(m);
    }
    const geo = this.keep(new BufferGeometry());
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(seeds), 4));
    geo.setAttribute('aSpan', new BufferAttribute(new Float32Array(spans), 3));
    const p = new Points(geo, this.driftMat);
    p.frustumCulled = false;
    p.name = 'spindrift';
    p.renderOrder = 3;
    this.root.add(p);
  }

  /** A gully's cleft's two side walls: where the sea cliff is cut back to the fence, its rock stands sheer from the sea
   *  to the cliff top across the slot, in beds a few metres thick each a little out of line with the one under it, ledges
   *  of snow on them. The far wall faces the lip and the flight across the slot; the near one looks down the run. */
  private geoWalls(c: Course, g: Gully, out: BufferGeometry[], low: boolean): void {
    const floor = this.sea - 25;
    for (const [zw, face] of [
      [g.zL - 10, 1],
      [g.zL + g.mouth - 1, -1],
    ] as const) {
      // (From just past the fence: never inside the run's limit.)
      const x0 = fenceX(c, zw) + 0.15;
      const xs = Math.max(x0 + 20, shoreX(c, zw + face * 14, this.sea) + 8);
      const n = low ? 8 : 16;
      let prevT: V3 | null = null;
      let prevB: V3 | null = null;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((xs - x0) * i) / n;
        const zz = zw + face * (hash(g.index * 31 + i, face > 0 ? 5 : 6) - 0.5) * 3;
        const top = Math.max(floor, cliffGround(c, x, zw + face * 16));
        const t: V3 = [x, top + 0.2, -zz];
        const b: V3 = [x, floor, -zz];
        if (prevT && prevB) {
          // Both faces, so the wall reads from either side.
          const rc = i % 3 ? ROCK : ROCK_D;
          out.push(quad(prevB, b, t, prevT, rc));
          out.push(quad(prevT, t, b, prevB, rc));
          // Bands of a paler rock and a ledge of snow down the face, a bed every so often.
          const hh = prevT[1] - floor;
          for (let k = 1; k < 6; k++) {
            const y = floor + hh * (k / 6) + (hash(i, k + g.index) - 0.5) * 6;
            if (y > Math.min(prevT[1], t[1]) - 2) continue;
            const off = face * -0.6;
            out.push(quad([prevT[0], y, prevT[2] + off], [t[0], y + 1.2, t[2] + off], [t[0], y + 2.4, t[2] + off], [prevT[0], y + 1.6, prevT[2] + off], k % 2 ? ROCK_L : SNOW));
          }
        }
        prevT = t;
        prevB = b;
      }
    }
    void cleftAt;
  }

  /** The lip's cornice: a rounded bar of packed snow along the shelf's corniced edge from where the shelf has risen off
   *  the path to the fence, its brow overhanging the drop and its underside in shade. */
  private lip(c: Course, g: Gully, out: BufferGeometry[]): void {
    const z = g.zL;
    const cx = c.centerX(z);
    const x0 = cx + 9.5;
    const x1 = fenceX(c, z) - 0.3;
    // (Flush with the shelf, never standing proud of it: a raised bar across the line read to the first critic as a
    // wall to stop at. Its brow overhangs the drop by a metre or so, torn along its edge by the wind, its underside in
    // shade and a darker lip of shadow under that, so the edge reads as the place the shelf ends.)
    const steps = 16;
    const prof: Array<[number, number, number]> = [
      [-1.6, -0.02, 0],
      [-0.4, 0.04, 0],
      [0.35, 0.03, 0],
      [0.85, -0.1, 1],
      [1.1, -0.4, 1],
      [0.95, -0.85, 2],
      [0.5, -1.25, 2],
    ];
    const under = [SNOW, new Color('#D4DCF0'), new Color('#9CA6CA')];
    for (let i = 0; i < steps; i++) {
      const xa = x0 + ((x1 - x0) * i) / steps;
      const xb = x0 + ((x1 - x0) * (i + 1)) / steps;
      const ya = c.ground(xa, z - 1.8);
      const yb = c.ground(xb, z - 1.8);
      // (Torn: each stretch of the brow reaches out its own way.)
      const ta = 0.65 + 0.7 * hash(g.index * 53 + i, 71);
      const tb = 0.65 + 0.7 * hash(g.index * 53 + i + 1, 71);
      for (let k = 0; k + 1 < prof.length; k++) {
        const [da, ha] = prof[k];
        const [db, hb, kc] = prof[k + 1];
        const pa0: V3 = [xa, ya + ha, -(z + da * (da > 0 ? ta : 1))];
        const pb0: V3 = [xb, yb + ha, -(z + da * (da > 0 ? tb : 1))];
        const pa1: V3 = [xa, ya + hb, -(z + db * (db > 0 ? ta : 1))];
        const pb1: V3 = [xb, yb + hb, -(z + db * (db > 0 ? tb : 1))];
        out.push(quad(pa0, pb0, pb1, pa1, under[kc]));
      }
    }
  }

  /** A windsock on a pole by the fence at the lip: banded cloth, filled by the wind climbing the gully and standing on
   *  end over the column (aSway lets it flutter at its tail). */
  private sock(c: Course, g: Gully, out: BufferGeometry[]): void {
    const z = g.zL - 1;
    const x = fenceX(c, z);
    const y = visualGround(c, x, z);
    out.push(placedOne(part(new CylinderGeometry(0.035, 0.05, 5.2, 5, 1), LATH, { pos: [0, 2.6, 0] }), x, y, z));
    // The sock: five bands, a cone frustum from the hoop up, leaning a little inland off the vertical.
    const bands = 5;
    for (let b = 0; b < bands; b++) {
      const r0 = 0.34 - b * 0.04;
      const r1 = r0 - 0.04;
      const cyl = new CylinderGeometry(r1, r0, 0.42, 8, 1, true);
      const sway = new Float32Array(cyl.getAttribute('position').count).fill(Math.min(1, b / (bands - 1) + 0.1));
      const gp = part(cyl, b % 2 ? SOCK_B : SOCK_A, { pos: [0, 5.4 + b * 0.42, 0] });
      gp.setAttribute('aSway', new BufferAttribute(new Float32Array(gp.getAttribute('position').count).fill(sway[0]), 1));
      gp.applyMatrix4(new Matrix4().makeRotationZ(0.14));
      out.push(placedOne(gp, x, y, z));
    }
    for (const o of out) if (!o.getAttribute('aSway')) o.setAttribute('aSway', new BufferAttribute(new Float32Array(o.getAttribute('position').count), 1));
  }

  // ------------------------------------------------------------------ the sea's stacks and surf

  /** Sea stacks standing out of the sea along the cliff's foot: tall broken columns of the cliff's dark rock in beds, a
   *  cap of snow on each, instanced (one draw; Low half as many). */
  private stacks(c: Course, low: boolean): void {
    // (The cliff's rock in beds, as the five's outcrops are laid down, rockforms.ts: each bed its own value, shifted off
    // the one under it, snow on the ledges and the broken crown. Three forms at their own proportions, a tall needle, a
    // column and a squat broken block, each scaled whole: a stack stretched to its height turned its ledges' normals up
    // and drew it as snow.)
    const forms = [
      { h: 5, rx: 0.5, rz: 0.4, layers: 13, seed: 0x5ea },
      { h: 3, rx: 0.55, rz: 0.45, layers: 10, seed: 0x5eb },
      { h: 1.6, rx: 0.6, rz: 0.5, layers: 7, seed: 0x5ec },
    ]
      // (Low: the column alone, one draw.)
      .filter((_, k) => !low || k === 1)
      .map((q) => strata({ rx: q.rx, rz: q.rz, h: q.h, layers: low ? Math.ceil(q.layers * 0.6) : q.layers, sides: low ? 6 : 8, rock: [ROCK_D, ROCK, ROCK_L], lie: null, taper: 0.28, shift: 0.12, dip: 0.07, warp: 0.25, bays: 0.25, rough: 0.3, seed: q.seed }));
    const spots: Array<Array<[number, number, number, number, number]>> = [[], [], []];
    const end = placesOf(c).sheds - 200;
    // The Sea Stacks: down the shore road a stack stands in the sea off each of the set piece's gaps, near the cliff's
    // foot, so the road threads among them (the gaps themselves are the pieces', gullhavenpieces.ts).
    const shore = momentPlays(c).find((q) => q.verb === 'stacks');
    for (const [i, t] of (shore?.targets ?? []).entries()) {
      const sx = shoreX(c, t.z, this.sea);
      // (Columns and squat blocks, a little lower than the road at its foot: needles there stood over the sheds.)
      const w = 12 + hash(i, 151) * 8;
      spots[low ? 0 : i % 2 ? 1 : 2].push([sx + 26 + hash(i, 152) * 24, t.z + (hash(i, 153) - 0.5) * 16, w, hash(i, 154) * 6.28, 0]);
    }
    let j = 0;
    for (let z = 60; z < end; j++) {
      z += (low ? 220 : 120) + hash(j, 51) * 140;
      if (z > end) break;
      const sx = shoreX(c, z, this.sea);
      const out = 40 + hash(j, 52) * 220;
      const w = 16 + hash(j, 54) * 20;
      const k = low ? 0 : Math.floor(hash(j, 53) * 3);
      spots[k].push([sx + out, z, w, hash(j, 55) * 6.28, 0]);
      // A smaller one beside it now and then.
      if (hash(j, 56) < 0.45) spots[low ? 0 : (k + 1) % 3].push([sx + out + 20 + hash(j, 57) * 24, z + 14 + hash(j, 58) * 30, w * 0.55, hash(j, 59) * 6.28, 0]);
    }
    this.stackSpots = [];
    forms.forEach((g, k) => {
      const list = spots[k];
      if (!list.length) return;
      const im = this.inst(g, list.length, this.rockMat);
      list.forEach(([x, z, w, yaw], i) => {
        q4.setFromAxisAngle(up, yaw);
        // (Its foot well under the water.)
        m4.compose(v3.set(x, this.sea - w * 0.6, -z), q4, s3.set(w, w, w));
        im.setMatrixAt(i, m4);
        this.stackSpots.push([x, z, w * 0.5]);
      });
      im.computeBoundingSphere();
      im.name = 'sea-stacks';
      this.root.add(im);
    });
  }
  private stackSpots: Array<[number, number, number]> = [];

  /** The surf along the cliff's foot (the shore traced row by row down the run) and round each stack. One draw. */
  private surf(c: Course, low: boolean): void {
    const pos: number[] = [];
    const us: number[] = [];
    const ss: number[] = [];
    const idx: number[] = [];
    const y = this.sea + 0.15;
    const W = 9;
    const step = low ? 8 : 4;
    let prev = -1;
    let s = 0;
    const end = c.finishZ + 400;
    for (let z = -60; z <= end; z += step) {
      const x = shoreX(c, z, this.sea);
      const base = pos.length / 3;
      pos.push(x - 0.6, y, -z, x + W, y, -z);
      us.push(0, 1);
      ss.push(s, s);
      if (prev >= 0) idx.push(prev, base, prev + 1, prev + 1, base, base + 1);
      prev = base;
      s += step;
    }
    // A ring round each stack's foot.
    for (const [sx, sz, w] of this.stackSpots) {
      const n = 14;
      const first = pos.length / 3;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r0 = w * 0.95;
        pos.push(sx + Math.sin(a) * r0, y, -(sz + Math.cos(a) * r0), sx + Math.sin(a) * (r0 + W * 0.7), y, -(sz + Math.cos(a) * (r0 + W * 0.7)));
        us.push(0, 1);
        ss.push(i * 6, i * 6);
        if (i > 0) {
          const a0 = first + (i - 1) * 2;
          const b0 = first + i * 2;
          idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('aU', new BufferAttribute(new Float32Array(us), 1));
    g.setAttribute('aS', new BufferAttribute(new Float32Array(ss), 1));
    g.setIndex(idx);
    const m = new Mesh(this.keep(g), this.surfMat);
    m.frustumCulled = false;
    m.renderOrder = -7;
    m.name = 'surf';
    this.root.add(m);
  }

  // ------------------------------------------------------------------ the beacon

  /** The old beacon on the cape's head, on a knoll of the cliff's rock out past the fence ahead of the start: a round
   *  drum of stone, corbelled at its top, an iron fire basket on it burning, the smoke torn inland on the wind over the
   *  path. Ahead and to the right of the opening's lens, against the sea and the low sun. */
  private beacon(c: Course, low: boolean): void {
    const z = BEACON.z;
    const x = edgeX(c, z) + BEACON.e;
    const top = cliffGround(c, x, z);
    const parts: BufferGeometry[] = [];
    // (Its knoll is the cliff top held out past the fence, ground.ts cliffGround; a mound of drifted snow round its foot.)
    parts.push(part(new SphereGeometry(6.4, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), SNOW, { pos: [0, -0.4, 0], scale: [1, 0.32, 1], jitter: 0.3 }));
    // The drum: coursed stone, a corbel at its head, the fire basket of iron bars on it.
    const B = 1.5;
    parts.push(part(new CylinderGeometry(2.1 * B, 2.5 * B, 5.2 * B, low ? 8 : 12, 4), STONE_D, { pos: [0, 2.6 * B, 0], jitter: 0.08 }));
    for (let k = 0; k < 4; k++) parts.push(part(new CylinderGeometry((2.52 - k * 0.1) * B, (2.52 - k * 0.1) * B, 0.1, low ? 8 : 12, 1), STONE, { pos: [0, (0.8 + k * 1.3) * B, 0] }));
    parts.push(part(new CylinderGeometry(2.55 * B, 2.15 * B, 0.5 * B, low ? 8 : 12, 1), STONE, { pos: [0, 5.4 * B, 0] }));
    parts.push(part(new CylinderGeometry(2.6 * B, 2.6 * B, 0.2, low ? 8 : 12, 1), SNOW, { pos: [0, 5.75 * B, 0] }));
    // A door on the landward side, dark.
    parts.push(box(0.2, 2.2, 1.1, GLASS, [-2.25 * B, 1.1, 0]));
    const bars = low ? 6 : 10;
    for (let k = 0; k < bars; k++) {
      const a = (k / bars) * Math.PI * 2;
      parts.push(seg([Math.cos(a) * 0.7 * B, 5.85 * B, Math.sin(a) * 0.7 * B], [Math.cos(a) * 1.15 * B, 7.3 * B, Math.sin(a) * 1.15 * B], 0.07, IRON));
    }
    parts.push(part(new CylinderGeometry(1.18 * B, 1.18 * B, 0.1, 10, 1, true), IRON, { pos: [0, 7.3 * B, 0] }));
    parts.push(part(new CylinderGeometry(0.72 * B, 0.72 * B, 0.1, 10, 1), IRON, { pos: [0, 5.85 * B, 0] }));
    this.add(merge(placed(parts, x, top, z, 0)), this.mat, z - 10, z + 10).name = 'beacon';
    // The fire in the basket: lit coals and tongues of flame, glowing.
    const fire = merge([
      part(new ConeGeometry(1.4, 2.2, 7, 1), new Color('#FFB060'), { pos: [0, 6.7 * B + 0.6, 0], jitter: 0.16 }),
      part(new ConeGeometry(0.75, 2.0, 5, 1), new Color('#FFE0A0'), { pos: [0.3, 6.9 * B + 0.8, 0.15], jitter: 0.12 }),
    ]);
    const fm = this.add(merge(placed([fire], x, top, z, 0)), this.glow, z - 10, z + 10, false);
    fm.name = 'beacon-fire';
    this.fire = [x, top + 7 * B, z];
    // The smoke: a billboard plume leaving the fire and torn flat inland over the path.
    const pg = new PlaneGeometry(1, 1);
    pg.translate(0.5, 0.5, 0);
    const smoke = new Mesh(this.keep(pg), this.smokeMat);
    smoke.position.set(x, top + 7.2 * B, -z);
    // (Inland is -x: the plume's +u along it, its quad standing upright across the run's line of sight.)
    smoke.rotation.set(0, Math.PI, 0);
    smoke.scale.set(60, 26, 1);
    smoke.frustumCulled = false;
    smoke.renderOrder = 4;
    smoke.name = 'beacon-smoke';
    this.root.add(smoke);
    this.windows.push({ m: smoke, z0: z - 10, z1: z + 10 });
  }

  // ------------------------------------------------------------------ the lighthouse

  /** The lighthouse on the cape's point at the end of the Cape: a white round tower on a headland of the cliff's rock
   *  standing out past the fence, an ink lantern room with its gallery, a keeper's cottage beside it; its beam turns
   *  over the sea and across the cliff top. */
  private lighthouse(c: Course, low: boolean): void {
    const z = lighthouseZ(c);
    const ex = edgeX(c, z);
    const x = ex + LIGHT_POINT.e + 4;
    const top = cliffGround(c, x, z);
    const parts: BufferGeometry[] = [];
    // (Its point is the cliff top held out past the fence, ground.ts cliffGround.)
    const H = 24;
    const seg16 = low ? 10 : 16;
    // The tower: limewashed, in courses (a slightly wider ring every few metres), one slate band round its middle,
    // a door at its foot and small windows climbing it. (A plain taper read to the first critic as untextured.)
    parts.push(part(new CylinderGeometry(2.4, 3.3, H, seg16, 1), WHITE, { pos: [0, H / 2, 0] }));
    parts.push(part(new CylinderGeometry(3.6, 3.7, 0.9, seg16, 1), STONE, { pos: [0, 0.45, 0] }));
    for (let k = 1; k < 6; k++) {
      const yk = (H * k) / 6;
      const r = 3.3 - (0.9 * yk) / H;
      parts.push(part(new CylinderGeometry(r + 0.06, r + 0.06, 0.18, seg16, 1, true), LIME, { pos: [0, yk, 0] }));
    }
    parts.push(part(new CylinderGeometry(2.86, 2.98, 3.2, seg16, 1, true), SLATE, { pos: [0, H * 0.5, 0] }));
    parts.push(box(0.3, 2.3, 1.3, GLASS, [-3.15, 1.6, 0]));
    if (!low) for (const [yk, a] of [[6.5, 0.4], [11.5, -0.6], [17, 0.2], [21, -0.3]]) parts.push(box(0.25, 1.1, 0.6, GLASS, [-Math.cos(a) * (3.15 - (0.9 * yk) / H), yk, Math.sin(a) * (3.15 - (0.9 * yk) / H)], [0, -a, 0]));
    // The gallery and its rail, the lantern room's glass and ink frame, the dome and its vent.
    parts.push(part(new CylinderGeometry(3.4, 2.5, 0.5, seg16, 1), IRON, { pos: [0, H + 0.2, 0] }));
    parts.push(part(new CylinderGeometry(3.3, 3.3, 0.12, seg16, 1, true), IRON, { pos: [0, H + 1.4, 0] }));
    for (let k = 0; k < (low ? 8 : 16); k++) {
      const a = (k / (low ? 8 : 16)) * Math.PI * 2;
      parts.push(seg([Math.cos(a) * 3.25, H + 0.4, Math.sin(a) * 3.25], [Math.cos(a) * 3.25, H + 1.45, Math.sin(a) * 3.25], 0.04, IRON));
    }
    parts.push(part(new CylinderGeometry(1.9, 1.9, 0.5, low ? 8 : 12, 1), IRON, { pos: [0, H + 0.7, 0] }));
    parts.push(part(new ConeGeometry(2.2, 1.6, low ? 8 : 12, 1), IRON, { pos: [0, H + 4.4, 0] }));
    parts.push(part(new SphereGeometry(0.35, 6, 4), IRON, { pos: [0, H + 5.3, 0] }));
    for (let k = 0; k < (low ? 6 : 10); k++) {
      const a = (k / (low ? 6 : 10)) * Math.PI * 2;
      parts.push(seg([Math.cos(a) * 1.85, H + 0.95, Math.sin(a) * 1.85], [Math.cos(a) * 1.85, H + 3.6, Math.sin(a) * 1.85], 0.06, IRON));
    }
    // The keeper's cottage, limewashed with a slate roof and a chimney, on the landward side of the tower: a door, two
    // windows on its long side, snow on the roof's ridge.
    parts.push(box(6, 3.4, 9, LIME, [-8, 1.7, 0]));
    // (Each roof a pyramid turned square to the walls before it is stretched to them, and its snow the same pyramid smaller
    // a hand over its top: stretched after turning, the roofs were diamonds reaching past their walls.)
    parts.push(part(new CylinderGeometry(0, 4.9, 2.6, 4, 1).rotateY(Math.PI / 4), SLATE, { pos: [-8, 4.7, 0], scale: [0.95, 1, 1.35] }));
    parts.push(part(new CylinderGeometry(0, 3.43, 1.82, 4, 1).rotateY(Math.PI / 4), SNOW, { pos: [-8, 5.17, 0], scale: [0.95, 1, 1.35] }));
    parts.push(box(0.8, 2.2, 0.8, STONE_D, [-8, 5.4, 3.2]));
    parts.push(box(0.12, 2.0, 1.0, GLASS, [-11.03, 1.1, 2.4]));
    this.add(merge(placed(parts, x, top, z, 0)), this.paintMat).name = 'lighthouse';
    const glass = merge(placed([part(new CylinderGeometry(1.8, 1.8, 2.6, low ? 8 : 12, 1), GLASS, { pos: [0, H + 2.25, 0] }), box(0.1, 1.2, 1.2, GLASS, [-11.03, 1.8, -2]), box(0.1, 1.2, 1.2, GLASS, [-11.03, 1.8, 1])], x, top, z, 0));
    this.add(glass, this.glow).name = 'lighthouse-lamp';
    this.light = [x, top + H + 2.3, z];
    // The beam: a long cone of light from the lantern (open at both ends, both faces), turned by update(). Its light is
    // the length of air it passes through, so it is strongest along its middle and soft at its edges, never a sheet
    // seen edge-on (two crossed quads read as a wire along the beam's foot, the first critic).
    const L = 900;
    const cone = new CylinderGeometry(26, 0.9, L, low ? 10 : 18, 1, true);
    cone.rotateZ(Math.PI / 2);
    cone.translate(L / 2, 0, 0);
    const beam = new Mesh(this.keep(cone), this.beamMat);
    beam.position.set(x, top + H + 2.3, -z);
    beam.frustumCulled = false;
    beam.renderOrder = 5;
    beam.name = 'lighthouse-beam';
    this.root.add(beam);
    this.beam = beam;
  }

  // ------------------------------------------------------------------ the harbour

  /** Down the Harbour Road: the fish sheds along the lane (tarred timber gables to the lane, snow on their roofs, their
   *  windows lit as the day goes), the slipway at the harbour's head, the harbour's ice between the quay and the pier
   *  with the boats frozen into it, and the two pier-head lights the line runs between. */
  private harbour(c: Course, low: boolean): void {
    const pl = placesOf(c);
    const fz = c.finishZ;
    const sheds: BufferGeometry[] = [];
    const lit: BufferGeometry[] = [];
    // The sheds: on the land side in a row, gable ends to the lane, a few on the seaward edge on posts over the drop.
    for (let i = 0, z = pl.descent + 70; z < pl.harbour + 40; i++) {
      const w = 5 + hash(i, 71) * 2;
      const d = 7 + hash(i, 72) * 4;
      const side = hash(i, 73) < 0.7 ? -1 : 1;
      // (Seaward, past the run's limit: they stood inside it.)
      const e = side < 0 ? 5 + hash(i, 74) * 3 : Math.max(1.5, c.edgeLimit(z) + 0.3);
      const x = c.centerX(z) + side * (c.halfWidth(z) + e + w / 2);
      const y = side < 0 ? visualGround(c, x, z) : c.ground(edgeX(c, z) - 0.5, z);
      const h = 3.2 + hash(i, 75) * 1.2;
      const p: BufferGeometry[] = [];
      p.push(box(w, h, d, hash(i, 76) < 0.5 ? TAR : TAR_L, [0, h / 2, 0]));
      p.push(part(new CylinderGeometry(0, w * 0.74, w * 0.55, 4, 1).rotateY(Math.PI / 4), SLATE, { pos: [0, h + w * 0.27, 0], scale: [1, 1, (d / w) * 1.02] }));
      p.push(part(new CylinderGeometry(0, w * 0.59, w * 0.44, 4, 1).rotateY(Math.PI / 4), SNOW, { pos: [0, h + w * 0.325 + 0.08, 0], scale: [1, 1, (d / w) * 1.02] }));
      if (side > 0) for (const dz of [-d / 2 + 0.4, d / 2 - 0.4]) for (const dx of [-w / 2 + 0.3, w / 2 - 0.3]) p.push(box(0.25, 18, 0.25, TAR, [dx, -9, dz]));
      // Doors and a window on the gable to the lane.
      const gx = -side * (w / 2 + 0.02);
      p.push(box(0.06, 2.2, 1.6, new Color('#5A4A40'), [gx, 1.1, 0]));
      const win = box(0.06, 0.8, 0.9, GLASS, [gx, h - 0.8, d / 4]);
      sheds.push(...placed(p, x, y, z, Math.PI / 2 * 0));
      lit.push(...placed([win], x, y, z, 0));
      this.lamps.push([x - side * (w / 2 + 1.5), y + 2, z, 11]);
      z += d + 2 + hash(i, 77) * 9;
    }
    // The slipway at the harbour's head: a ramp of dressed stone from the lane down onto the ice, on the seaward side.
    const sz = pl.harbour + 10;
    const sx = fenceX(c, sz) + 3;
    const slip: BufferGeometry[] = [];
    slip.push(box(6, 1.2, 40, STONE, [0, -0.6, 0], [-0.06, 0, 0]));
    slip.push(box(0.6, 1.6, 40, STONE_D, [3.2, -0.2, 0], [-0.06, 0, 0]));
    sheds.push(...placed(slip, sx, c.ground(edgeX(c, sz) - 0.5, sz), sz + 20, 0));
    // The harbour's ice beyond the corridor's own: the basin from the corridor's seaward edge out to the pier, and past
    // the line the shore-fast ice running on round the pier head until it ends on the open water. A sheet a few
    // centimetres over the course's own ice level, row by row.
    const z0 = pl.harbour - 10;
    const z1 = fz + 160;
    const ice: number[] = [];
    const iceIdx: number[] = [];
    const rows = Math.ceil((z1 - z0) / 8);
    for (let r = 0; r <= rows; r++) {
      const z = z0 + r * 8;
      const cx = c.centerX(z);
      const hw = c.halfWidth(z);
      const y = c.ground(cx + hw, z) + 0.03;
      // (Out to the pier inside the harbour; past the line out to a ragged edge on the sea.)
      const out = z < fz ? hw + 14 : hw + 30 + 10 * Math.sin(z * 0.11) - (z - fz) * 0.1;
      ice.push(cx + hw - 0.6, y, -z, cx + out, y, -z);
      if (r > 0) {
        const A = (r - 1) * 2;
        const B = r * 2;
        iceIdx.push(A, A + 1, B, A + 1, B + 1, B);
      }
    }
    const iceG = new BufferGeometry();
    iceG.setAttribute('position', new BufferAttribute(new Float32Array(ice), 3));
    iceG.setIndex(iceIdx);
    sheds.push(part(iceG, ICE));
    // The pier (seaward, out past the basin) and the quay (landward, along the corridor's edge, under the moor): stone
    // walls with snow on their tops, bollards along the quay, each ending at the line in a pier head and its light.
    const pier: BufferGeometry[] = [];
    const PIER_E = 13;
    // (The quay's face stands just past the run's limit, which is three metres out on the harbour: at a metre and a half
    // its wall and the folk on it stood inside it, where a sled pressed to the edge rode through them. Its top stands over
    // the bank the sim raises against it there, snow banked to its face.)
    const quayE = (z: number): number => c.edgeLimit(z) + 0.05;
    const quayTop = (z: number): number => {
      const cx = c.centerX(z);
      return Math.max(c.ground(cx, z) + 1.2, c.ground(cx - c.halfWidth(z) - c.edgeLimit(z), z) + 0.35);
    };
    for (const side of [-1, 1]) {
      const za = side > 0 ? pl.harbour + 30 : pl.harbour + 60;
      const w = side > 0 ? 4.4 : 3;
      for (let z = za; z < fz; z += 8) {
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        const y = c.ground(cx, z);
        const e = side > 0 ? PIER_E : quayE(z + 4);
        const top = side > 0 ? y + 1.2 : quayTop(z + 4);
        const x = cx + side * (hw + e + w / 2);
        pier.push(box(w, top - y + 2, 8.2, z % 16 < 8 ? STONE : STONE_D, [x, (top + y - 2) / 2, -(z + 4)]));
        pier.push(box(w - 0.2, 0.25, 8.0, SNOW, [x, top + 0.12, -(z + 4)]));
        if (side < 0 && !low) pier.push(part(new CylinderGeometry(0.22, 0.28, 0.7, 6, 1), IRON, { pos: [x + w * 0.3, top + 0.4, -(z + 2)] }));
      }
      // The pier head and its light: a round stone head, a short white tower, its lantern. (The quay's head stands with
      // its round face at the limit.)
      const cx = c.centerX(fz);
      const y = c.ground(cx, fz);
      const top = side > 0 ? y + 1.4 : quayTop(fz) + 0.2;
      const hx = cx + side * (c.halfWidth(fz) + (side > 0 ? PIER_E + w / 2 : quayE(fz) + 4.05));
      pier.push(part(new CylinderGeometry(3.6, 4.0, top - y + 1.6, 12, 1), STONE_D, { pos: [hx, (top + y - 1.6) / 2, -fz] }));
      pier.push(part(new CylinderGeometry(3.4, 3.4, 0.25, 12, 1), SNOW, { pos: [hx, top + 0.05, -fz] }));
      pier.push(part(new CylinderGeometry(1.1, 1.5, 8, 10, 1), WHITE, { pos: [hx, top + 4.1, -fz] }));
      pier.push(part(new CylinderGeometry(1.3, 1.3, 0.3, 10, 1), IRON, { pos: [hx, top + 8.2, -fz] }));
      pier.push(part(new ConeGeometry(1.15, 1.0, 10, 1), IRON, { pos: [hx, top + 9.9, -fz] }));
      lit.push(part(new CylinderGeometry(0.8, 0.8, 1.3, 8, 1), GLASS, { pos: [hx, top + 9.0, -fz] }));
      this.lamps.push([hx, top + 9.0, fz, 18]);
    }
    sheds.push(...pier);
    // The boats, frozen into the basin at angles between the corridor and the pier: a hull, a wheelhouse, a mast.
    for (let i = 0; i < (low ? 6 : 11); i++) {
      const z = pl.harbour + 40 + i * 22 + hash(i, 81) * 10;
      if (z > fz - 14) break;
      const cx = c.centerX(z);
      // (Their hulls past the fence's line however they lie, and clear of the pier.)
      const x = cx + c.halfWidth(z) + 5.4 + hash(i, 82) * (PIER_E - 9.8);
      const y = c.ground(cx, z) - 0.3;
      const L = 7 + hash(i, 83) * 4;
      const hull = HULLS[i % HULLS.length];
      const b: BufferGeometry[] = [];
      b.push(part(new CylinderGeometry(1.4, 0.9, L, 8, 1), hull, { pos: [0, 0.6, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.55] }));
      b.push(part(new ConeGeometry(1.4, 2.2, 8, 1), hull, { pos: [0, 0.6, -L / 2 - 1.0], rot: [-Math.PI / 2, 0, 0], scale: [1, 0.55, 1] }));
      b.push(box(2.5, 0.12, L + 1, SNOW, [0, 1.36, -0.4]));
      b.push(box(1.6, 1.6, 2.0, LIME, [0, 2.1, 1.0]));
      b.push(box(1.8, 0.2, 2.3, SNOW, [0, 3.0, 1.0]));
      b.push(seg([0, 1.4, -1.8], [0, 6.8, -1.8], 0.07, IRON));
      sheds.push(...placed(b, x, y, z, (hash(i, 84) - 0.5) * 0.7 + 0.15));
    }
    // The line across the harbour's ice between the two pier-head lights: four rows of big ink and cream checks over
    // the whole corridor, long down the run so the lens sees them square (ART.md 12's line).
    const hwL = c.halfWidth(fz);
    // (Its own draw, in paint: in the stone shader the ink checks took the snow that lies on what faces up, and the line
    // vanished, the second critic: the run read as riding into the sea.)
    const line: BufferGeometry[] = [];
    const sq = 1.1;
    const nq = Math.floor((hwL * 2) / sq);
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < nq; i++) {
        const za = fz + row * sq;
        const zb = za + sq;
        const pt = (d: number, zz: number): V3 => {
          const x = c.centerX(zz) - hwL + d;
          return [x, c.ground(x, zz) + 0.04, -zz];
        };
        line.push(quad(pt(i * sq, za), pt((i + 1) * sq, za), pt((i + 1) * sq, zb), pt(i * sq, zb), (i + row) % 2 ? CREAM : IRON));
      }
    }
    // The harbour's houses up the slope behind the quay, in two rows stepping up the moor's foot: limewashed and tarred
    // fronts to the harbour, slate roofs under snow, a chimney each, their windows lit as the day goes. A harbour
    // hamlet beside the line, never a square round it.
    const homes: BufferGeometry[] = [];
    for (let i = 0; i < (low ? 6 : 11); i++) {
      const row = i % 2;
      const z = pl.harbour - 30 + Math.floor(i / 2) * 44 + row * 20 + hash(i, 91) * 10;
      if (z > fz + 70) break;
      const cx = c.centerX(z);
      const e = 12 + row * 15 + hash(i, 92) * 5;
      const x = cx - c.halfWidth(z) - e;
      const y = visualGround(c, x, z) - 0.3;
      const w = 6 + hash(i, 93) * 2.5;
      const d = 5 + hash(i, 94) * 2;
      const h = 4 + hash(i, 95) * 2.2;
      const wall = hash(i, 96) < 0.55 ? LIME : hash(i, 96) < 0.8 ? TAR_L : new Color('#C8B6A0');
      const p: BufferGeometry[] = [];
      p.push(box(d, h, w, wall, [0, h / 2, 0]));
      p.push(part(new CylinderGeometry(0, w * 0.68, w * 0.42, 4, 1).rotateY(Math.PI / 4), SLATE, { pos: [0, h + w * 0.2, 0], scale: [(d / w) * 1.05, 1, 1.02] }));
      p.push(part(new CylinderGeometry(0, w * 0.51, w * 0.315, 4, 1).rotateY(Math.PI / 4), SNOW, { pos: [0, h + w * 0.2525 + 0.08, 0], scale: [(d / w) * 1.05, 1, 1.02] }));
      p.push(box(0.7, 1.8, 0.7, STONE_D, [0.6, h + w * 0.3, w / 2 - 0.6]));
      p.push(box(0.08, 2.0, 0.95, new Color('#4A3E3A'), [d / 2 + 0.02, 1.0, -w / 4]));
      homes.push(...placed(p, x, y, z, 0));
      // Two windows to the harbour, on the side facing the run.
      lit.push(...placed([box(0.08, 1.0, 0.9, GLASS, [d / 2 + 0.03, h * 0.62, w / 5]), box(0.08, 1.0, 0.9, GLASS, [d / 2 + 0.03, h * 0.62, -w / 2.6])], x, y, z, 0));
      this.lamps.push([x + d / 2 + 2, y + 2, z, 10]);
    }
    sheds.push(...homes);
    // (In paint, not the stone shader: tarred walls and boats' hulls took its strata and its snow on their roofs' undersides.)
    this.add(merge(sheds), this.paintMat, pl.descent - 60, fz + 260).name = 'harbour';
    const lm = this.add(merge(line), this.paintMat, fz - 300, fz + 260, false);
    lm.name = 'finish-line';
    this.add(merge(lit), this.glow, pl.descent - 60, fz + 260).name = 'harbour-lights';
    // The harbour's folk on the quay to see the line crossed, still, in their knitwear and oilskins (crowd.ts
    // stillCrowd, one draw; Low fewer and bolder), facing the ice.
    const p = getPalette('gullhaven', Mood.None);
    const { coats, hats } = crowdColors('gullhaven', p);
    const folk: StillFigure[] = [];
    let k = 0;
    for (let z = fz - 90; z < fz + 16; z += 3.1) {
      k++;
      if (low && k % 2) continue;
      const cx = c.centerX(z);
      const x = cx - c.halfWidth(z) - quayE(z) - 0.6 - hash(k, 97) * 1.6;
      const y = Math.max(quayTop(z), visualGround(c, x, z)) + 0.05;
      folk.push({ x, y, z: -(z + (hash(k, 98) - 0.5) * 1.2), face: 1, coat: coats[k % coats.length], hat: hats[(k * 3) % hats.length] });
    }
    if (folk.length) {
      const m = this.add(stillCrowd(folk, 'gullhaven', low ? LOW_BOLD : 1), this.mat, pl.harbour, fz + 200);
      m.name = 'onlookers';
      m.castShadow = false;
    }
  }

  // ------------------------------------------------------------------ the gulls

  /** Gulls: a few hanging still in each column over its rim, wings held out on the rising air, rocking a little; and
   *  more wheeling slowly along the cliff over the sea. One instanced draw, moved by update() within reach. */
  private birds(c: Course, low: boolean): void {
    // A gull soaring: a slim white body, long wings held out in a shallow M (the inner wing up from the body, the outer
    // wing bent down at the wrist), grey on top with ink tips, a short tail. Both faces of each wing.
    const wing = (s: number): BufferGeometry[] => {
      const r = (p: V3): V3 => [p[0] * s, p[1], p[2]];
      const a: V3 = r([0.06, 0.02, 0.1]);
      const b: V3 = r([0.62, 0.16, 0.04]);
      const c2: V3 = r([0.6, 0.15, -0.16]);
      const d: V3 = r([0.06, 0.02, -0.12]);
      const e: V3 = r([1.22, 0.04, -0.12]);
      const f2: V3 = r([1.18, 0.04, -0.22]);
      return [quad(a, b, c2, d, GULL_W), quad(d, c2, b, a, GULL), quad(b, e, f2, c2, GULL_T), quad(c2, f2, e, b, GULL)];
    };
    const g = merge([
      part(new OctahedronGeometry(0.1, 0), GULL, { scale: [1, 0.9, 3.4] }),
      part(new OctahedronGeometry(0.07, 0), GULL, { pos: [0, 0.04, 0.32] }),
      quad([0, 0.01, -0.26], [0.09, 0.0, -0.44], [-0.09, 0.0, -0.44], [0, 0.01, -0.26], GULL_W),
      ...wing(1),
      ...wing(-1),
    ]);
    const hangN = low ? 2 : 4;
    const gullies = gulliesOf(c);
    const wheelN = low ? 14 : 30;
    const im = this.inst(g, gullies.length * hangN + wheelN, this.mat);
    im.castShadow = false;
    for (const gl of gullies) {
      const rim = c.baseY(gl.zL);
      for (let i = 0; i < hangN; i++) {
        const z = gl.zL + 10 + (i / hangN) * gl.column * 0.8 + hash(gl.index, i) * 8;
        this.hang.push([gl.bx + (hash(i, gl.index + 3) - 0.5) * 5, rim + 9 + hash(i, gl.index + 5) * 14, z, hash(i, gl.index + 7) * 6.28, this.hang.length]);
      }
    }
    for (let i = 0; i < wheelN; i++) {
      const z = 150 + (i / wheelN) * (c.finishZ - 200) + hash(i, 91) * 60;
      const sx = shoreX(c, z, this.sea);
      const ex = edgeX(c, z);
      const y = c.baseY(z) - 20 - hash(i, 92) * 60;
      this.wheel.push([this.hang.length + i, (ex + sx) / 2 + 30 + hash(i, 93) * 60, y, z, 18 + hash(i, 94) * 30, 0.15 + hash(i, 95) * 0.12, hash(i, 96) * 6.28]);
    }
    im.count = this.hang.length + this.wheel.length;
    im.frustumCulled = false;
    im.name = 'gulls';
    this.gulls = im;
    this.place(0, -1e9);
    this.root.add(im);
  }

  /** Poses the gulls at time t: the hanging ones rocking on the column, the wheeling ones on their circles (only those
   *  within reach of sim z move). */
  private place(t: number, z: number): void {
    const im = this.gulls;
    if (!im) return;
    for (const [x, y, gz, ph, i] of this.hang) {
      if (Math.abs(gz - z) > 500 && z > -1e8) continue;
      const rock = Math.sin(t * 1.3 + ph) * 0.12;
      // (Facing into the wind off the sea, +x, held still.)
      const q = new Quaternion().setFromAxisAngle(up, Math.PI / 2 + Math.sin(ph) * 0.3).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rock));
      m4.compose(v3.set(x, y + Math.sin(t * 0.9 + ph) * 0.6, -gz), q, s3.set(1.1, 1.1, 1.1));
      im.setMatrixAt(i, m4);
    }
    for (const [i, cx, cy, cz, r, sp, ph] of this.wheel) {
      if (Math.abs(cz - z) > 900 && z > -1e8) continue;
      const a = t * sp + ph;
      const q = new Quaternion().setFromAxisAngle(up, -a).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.35));
      m4.compose(v3.set(cx + Math.cos(a) * r, cy + Math.sin(a * 2.0) * 3, -(cz + Math.sin(a) * r)), q, s3.set(1.2, 1.2, 1.2));
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ each frame

  update(dt: number, time: number, mode: ViewMode, s: Snap, sim: Sim | null, camera: PerspectiveCamera, p: Palette): void {
    if (!this.course) return;
    const live = reduced() ? 0 : 1;
    const low = this.detail === 'low';
    // The sea plane under the lens, at the sea's level.
    this.seaMesh.position.set(camera.position.x, this.sea, camera.position.z);
    this.seaMesh.updateMatrixWorld();
    const reach = low ? 520 : 900;
    for (const w of this.windows) w.m.visible = s.z > w.z0 - reach && s.z < w.z1 + 120;
    // The surf's foam in the light's colour, its shade the sea's.
    (this.surfMat.uniforms.uFoam.value as Color).copy(p.snowLit).lerp(p.fog, 0.25);
    (this.surfMat.uniforms.uFoamShade.value as Color).copy(p.snowShade).lerp(p.fog, 0.35);
    this.surfMat.uniforms.uLive.value = live * (low ? 0 : 1);
    (this.driftMat.uniforms.uLit.value as Color).copy(p.snowLit).lerp(p.rim, 0.2);
    (this.driftMat.uniforms.uShade.value as Color).copy(p.snowShade).lerp(p.snowLit, 0.4);
    this.driftMat.uniforms.uLive.value = live;
    this.driftMat.uniforms.uScale.value = 1500;
    // (A pale grey smoke in the air's own colours: dark, against the sea at the opening it read as an island or a stain.)
    (this.smokeMat.uniforms.uLit.value as Color).copy(p.clouds.lit).lerp(p.fog, 0.5);
    (this.smokeMat.uniforms.uShade.value as Color).copy(p.clouds.shade).lerp(p.fog, 0.55);
    this.smokeMat.uniforms.uLive.value = live;
    this.place(time * live, s.z);
    // The lighthouse's beam turns (a sweep every ten seconds), stronger as the day goes.
    const lampK = shared.uLampK.value as number;
    if (this.beam) {
      this.beam.rotation.set(0, time * live * 0.63, -0.025);
      // (By dusk and night only: by day a beam in the low sun's air read as a hard milky slab, the third critic.)
      this.beamMat.uniforms.uK.value = 0.26 * Math.max(0, Math.min(1, (lampK - 0.6) / 0.8));
      this.beam.visible = this.beamMat.uniforms.uK.value > 0.004;
    }
    const lit = Math.max(0, Math.min(1.6, (lampK - 0.35) / 0.8));
    this.glow.uniforms.uEmissiveStrength.value = Math.max(0.35 * (this.fire ? 1 : 0), Math.min(1.25, lit * 1.3));
    // The beacon's fire lights the snow round it, by day too.
    if (this.fire && Math.abs(this.fire[2] - s.z) < 220) pushLocalLight(this.fire[0], this.fire[1], -this.fire[2], FIRE_LIN.r, FIRE_LIN.g, FIRE_LIN.b, 22, 0.6 * (0.85 + 0.15 * Math.sin(time * 9 * live)));
    if (this.light && Math.abs(this.light[2] - s.z) < 400) pushLocalLight(this.light[0], this.light[1], -this.light[2], 1, 0.97, 0.9, 30, 0.3 + 0.5 * Math.min(1, lampK));
    this.pieces.update(this.course, time, s, sim, mode === 'run', low, reduced(), lampK);
    const course = this.course;
    this.legends.update(course, time, dt, s, sim, mode === 'run', low, reduced(), this.sea, (z) => shoreX(course, z, this.sea));
    if (lit <= 0.02) return;
    for (const [x, y, z, r] of this.lamps) if (z > s.z - 30 && z < s.z + 160) pushLocalLight(x, y, -z, LAMP_LIN.r, LAMP_LIN.g, LAMP_LIN.b, r, 0.5 * Math.min(1, lit));
  }
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};

/** One part moved to sim (x, y, z). */
function placedOne(g: BufferGeometry, x: number, y: number, z: number): BufferGeometry {
  g.applyMatrix4(new Matrix4().makeTranslation(x, y, -z));
  return g;
}

/** A pennant: a triangle of cloth flying along its own +x from the staff (aSway 0 at the staff, 1 at the tip), both
 *  faces, in one colour. */
function pennant(col: Color): BufferGeometry {
  const g = new BufferGeometry();
  const pos = [0, 0, 0, 0.95, 0.16, 0, 0, 0.36, 0, 0, 0, 0, 0, 0.36, 0, 0.95, 0.16, 0];
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aSway', new BufferAttribute(new Float32Array([0, 1, 0, 0, 0, 1]), 1));
  const cols = new Float32Array(18);
  for (let i = 0; i < 6; i++) cols.set([col.r, col.g, col.b], i * 3);
  g.setAttribute('color', new BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
