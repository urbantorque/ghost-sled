import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, Object3D, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import { Course } from '../sim/course';
import type { BiomeId } from '../sim/mountains';
import { noise1, noise2 } from '../sim/noise';
import { LIGHT_GLSL, shared } from './materials';
import { Palette } from './palette';
import { VILLAGE_SLOTS, buildHamlet, buildVillage, makeVillageMaterial, type VillageBuild, type VillageLight } from './village';

// The middle of the world: the mountainside from the edge of the terrain mesh out to about a
// kilometre, between the run's banks and the distant ridges (sky.ts). It is world-anchored and
// streams with the course like Terrain, so it parallaxes and passes by as you descend:
//  - shoulders: one coarse ring-buffered heightfield on both sides, a row every ROW metres down the
//    course, that carries on from the terrain's edge (its first column is the terrain's last, a
//    sunk skirt tucks under it) and then either falls away into a valley far below or climbs into
//    a mountain flank: forest low down, crags, gullies and snowfields above the treeline. Only
//    what climbs shows over the run's banks, so the two sides are opposed (one falls away while
//    the other climbs) and the run nearly always has a wall on one hand;
//  - a forest carpet: thousands of instanced two-tier cones on the slopes, one draw call, coloured
//    per biome from the palette and fading with the aerial perspective;
//  - settlements (village.ts), all merged into one draw call: a village on the valley floor (a frozen
//    lake, a road, a church, a research station, a lava river, a pagoda town, per biome) and hamlets
//    perched on the flanks, where they show over the bank from the run. Windows, street lamps and
//    lanterns light up from dusk on, with halos that never shrink to nothing at a kilometre.
// The valley floor steps down the mountain in flats and icefalls (a staircase that tracks the run's
// own descent), so each village sits on level ground and the valley never drifts away from the run.
// Rows are built on a time slice and villages on idle time, never in a hitch at run start. High and
// Medium draw it all (Medium with fewer trees); Low draws the shoulders alone, forest-tinted.

/** Metres between shoulder rows (down the course). */
const ROW = 16;
/** Rows kept behind the rider (the title camera and the crash orbit look back up the slope). */
const BEHIND = 192;
/** Lateral reference: heights are measured from the High tier's terrain edge, so the geography is
 *  the same on every tier (a lower tier's narrower terrain is continued by the bank itself). */
const REF_REACH = 110;
/** The terrain's own lateral steps (terrain.ts OUTER_STEPS): its last column sits at the largest
 *  step within the tier's reach. */
const TERRAIN_STEPS = [12, 16, 22, 30, 42, 58, 80, 110];
/** Furthest the shoulders reach past the reference edge, metres. */
const E_MAX = 1150;
/** The valley floor's staircase: a flat of FLAT * STAIR metres, then an icefall down to the next. */
const STAIR = 900;
const FLAT = 0.6;
/** How far below the run the valley floor lies at the top of each flat. */
const VALLEY_DEPTH = 320;
/** A village's flat floor (radius, metres) and its distance past the edge. */
const VILLAGE_R = 175;
const VILLAGE_E = 500;
/** A flank hamlet's footprint radius and its distance past the edge (on a spur, it shows over the bank). */
const HAMLET_R = 95;
const HAMLET_E = 190;
/** One chance of a hamlet per this many metres of course. */
const HAMLET_STEP = 400;

interface TierCfg {
  /** Metres of shoulder kept ahead of the rider. */
  ahead: number;
  /** Trees tried per row per side (0: no forest carpet). */
  trees: number;
  villages: boolean;
  /** Outer column spacing: step = a + b * e. */
  step: [number, number];
  /** How strongly the shoulder's own forest tint shows (Low has no instanced trees over it). */
  forestTint: number;
}

const TIERS: Record<'low' | 'medium' | 'high', TierCfg> = {
  high: { ahead: 1300, trees: 52, villages: true, step: [8, 0.07], forestTint: 0.7 },
  medium: { ahead: 1200, trees: 32, villages: true, step: [10, 0.085], forestTint: 0.75 },
  low: { ahead: 900, trees: 0, villages: false, step: [16, 0.13], forestTint: 0.85 },
};

/** Runs fn on idle time (requestIdleCallback, at most a second late), or soon after where there is
 *  none (Safari), as props.ts makes its landmarks. */
function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 1000 });
  else setTimeout(fn, 50);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hashf(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

interface Village {
  /** Which flat of the staircase it stands on. */
  k: number;
  side: number;
  /** Sim z of its middle, metres past the reference edge, and its floor height. */
  z: number;
  e: number;
  y: number;
  seed: number;
  /** A hamlet on a mountain flank (village.ts buildHamlet) rather than a valley-floor village. */
  slope: boolean;
}

/** One side of one row: what the profile function needs, computed once per row. */
interface SideInfo {
  side: number;
  /** Ground height and x at the reference edge. */
  yE: number;
  xE: number;
  /** Corridor centre, and a heavily smoothed one the far columns follow. */
  cx: number;
  cs: number;
  /** 0 a valley falling away, 1 a spur climbing. */
  k: number;
  /** The valley floor here, the far wall's rise, and the spur's height. */
  yF: number;
  wall: number;
  spur: number;
  vil: Village | null;
  /** The hamlet on this flank nearby, if any. */
  ham: Village | null;
}

function newSide(side: number): SideInfo {
  return { side, yE: 0, xE: 0, cx: 0, cs: 0, k: 0, yF: 0, wall: 0, spur: 0, vil: null, ham: null };
}

/** Where the streamed shoulders begin behind and end ahead (three.js z), shared by every midground
 *  material. A fully fogged mountain still cuts a silhouette out of a sky bluer than the fog, so the
 *  ring's ends (and its outer edge) are lowered to the run's own level in the vertex shader and rise
 *  out of the haze as they come into range: the cut never stands as a cliff against the sky. */
const ring = { value: new Vector2(1e6, -1e6) };

const SINK_GLSL = /* glsl */ `
uniform vec2 uRing;
float midSink(float z, float e) {
  float s = max(smoothstep(uRing.y + 380.0, uRing.y + 30.0, z), smoothstep(uRing.x - 150.0, uRing.x - 10.0, z));
  return max(s, smoothstep(1060.0, 1150.0, e));
}
`;

/** The shared aerial perspective. Near the terrain's edge it is exactly the terrain's fog, so the seam
 *  never shows; further out it eases into a longer haze (in clear moods about three times the fog's
 *  reach, barely longer in a blizzard), deepens a little over the valley floor below, and swallows
 *  everything by about 1.45 km, where the distant ridges take over. */
const AERIAL_GLSL = /* glsl */ `
uniform vec2 uRing;
vec3 midAerial(vec3 col, vec3 wp, float e) {
  float d = length(wp - cameraPosition);
  float fT = smoothstep(uFogNear, uFogFar, d);
  float far2 = uFogFar * mix(1.15, 3.1, smoothstep(250.0, 480.0, uFogFar));
  float fE = smoothstep(uFogNear * 1.5, far2, d);
  fE = pow(fE, 1.5) * 0.82;
  float f = mix(fT, fE, smoothstep(0.0, 180.0, e));
  float below = smoothstep(-40.0, -360.0, wp.y - cameraPosition.y) * smoothstep(250.0, 900.0, d);
  f = mix(f, 1.0, below * 0.2);
  f = max(f, smoothstep(1150.0, 1450.0, d));
  f = max(f, smoothstep(uRing.y + 420.0, uRing.y + 60.0, wp.z));
  return mix(col, uFog, f);
}
`;

const NOISE_GLSL = /* glsl */ `
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash13(vec3(i, 0.0));
  float b = hash13(vec3(i + vec2(1.0, 0.0), 0.0));
  float c = hash13(vec3(i + vec2(0.0, 1.0), 0.0));
  float d = hash13(vec3(i + vec2(1.0, 1.0), 0.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

function shoulderMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...shared,
      uRock: { value: new Color() },
      uRockLit: { value: new Color() },
      uForest: { value: new Color() },
      uForestK: { value: 0.4 },
      uRing: ring,
    },
    vertexShader: /* glsl */ `
      ${SINK_GLSL}
      attribute float aE;
      attribute float aForest;
      attribute float aBase;
      varying vec3 vWorldPos;
      varying vec3 vN;
      varying float vE;
      varying float vForest;
      varying float vAlt;
      void main() {
        vE = aE;
        vForest = aForest;
        vec3 p = position;
        p.y = mix(p.y, min(p.y, aBase), midSink(p.z, aE));
        vAlt = p.y - aBase - 14.0;
        vWorldPos = p;
        vN = normal;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      ${AERIAL_GLSL}
      ${NOISE_GLSL}
      uniform vec3 uSnowLit;
      uniform vec3 uSnowShade;
      uniform vec3 uSnowDeep;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyHorizon;
      uniform float uIceMood;
      uniform vec3 uRock;
      uniform vec3 uRockLit;
      uniform vec3 uForest;
      uniform float uForestK;
      varying vec3 vWorldPos;
      varying vec3 vN;
      varying float vE;
      varying float vForest;
      varying float vAlt;
      void main() {
        vec3 n = normalize(vN);
        vec3 fn = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
        fn *= sign(fn.y + 1e-4);
        vec3 toCam = cameraPosition - vWorldPos;
        float d = length(toCam);
        vec3 v = toCam / max(d, 0.001);
        // Steep faces turn to rock, broken up so a spur reads as crags and snow gullies, never
        // right at the terrain's edge (where the snow must match the bank).
        float crag = vnoise(vWorldPos.xz * vec2(0.018, 0.03)) * 0.6 + vnoise(vWorldPos.xz * 0.07) * 0.4;
        float rockK = smoothstep(0.78 + crag * 0.1, 0.58 + crag * 0.1, n.y);
        // Above the treeline (vAlt: metres above the run) bare crags break out of the snow, and on a
        // steep face gullies streak down the fall line: snow chutes between ribs of rock.
        float steep = smoothstep(0.95, 0.72, n.y);
        float high = smoothstep(130.0, 260.0, vAlt);
        rockK = max(rockK, smoothstep(0.58, 0.78, crag) * high * smoothstep(0.97, 0.85, n.y));
        vec2 fall = normalize(n.xz + vec2(1e-4, 0.0));
        vec2 sq = vec2(dot(vWorldPos.xz, vec2(-fall.y, fall.x)) * 0.03, dot(vWorldPos.xz, fall) * 0.004);
        float rib = smoothstep(0.5, 0.78, vnoise(sq) * 0.7 + vnoise(sq * 2.7 + 5.3) * 0.3);
        rockK = max(rockK, rib * steep * (0.45 + 0.55 * high));
        rockK *= smoothstep(10.0, 60.0, vE);
        // A painterly plane to every facet away from the edge, harder on the rock.
        vec3 nn = normalize(mix(n, fn, smoothstep(20.0, 160.0, vE) * 0.3 + rockK * 0.5));
        // The snow: the terrain's own far-bank formula (materials.ts makeSnowMaterial), so the two
        // meet without a seam.
        float dayK = smoothstep(0.7, 0.95, dot(uSnowLit, vec3(0.3, 0.59, 0.11)));
        vec3 lit = mix(uSnowLit, uSnowShade, 0.25) * 0.88 * mix(1.0, 0.94, dayK);
        vec3 shade = mix(mix(uSnowShade, uSnowDeep, 0.2), uSnowDeep, 0.35);
        float ndl = dot(nn, uSunDir);
        float t = smoothstep(-0.12, 0.42, ndl);
        vec3 sunN = uSunColor / max(max(uSunColor.r, uSunColor.g), max(uSunColor.b, 0.001));
        vec3 sunSnow = mix(uSunColor, mix(vec3(1.0), sunN, 0.15), dayK);
        vec3 col = mix(shade, lit * sunSnow, t);
        col *= mix(1.0, 0.8 + 0.28 * smoothstep(0.1, 0.95, ndl), t);
        // Broad wind-drifted snowfields: soft cool hollows across the open slopes, so a far flank
        // reads as snow with a lie to it rather than one flat sheet (none at the edge, as the bank).
        float drift = vnoise(vWorldPos.xz * vec2(0.011, 0.007) + 2.3) * 0.65 + vnoise(vWorldPos.xz * 0.031 + 7.1) * 0.35;
        col = mix(col, col * mix(vec3(0.9), uSnowShade / max(uSnowLit, vec3(0.05)), 0.5), smoothstep(0.45, 0.8, drift) * 0.45 * smoothstep(30.0, 200.0, vE));
        vec3 rockShade = mix(uRock * 0.55, uShadeTint * 0.5, 0.35);
        vec3 rockCol = mix(rockShade, uRockLit * sunN, t);
        col = mix(col, rockCol, rockK);
        // Forest floor: the canopy's colour carpets the slope where the trees stand, strongest far off
        // (where the instanced cones thin to specks), shaded like a canopy.
        float fk = smoothstep(0.15, 0.6, vForest) * uForestK * (0.6 + 0.4 * smoothstep(200.0, 800.0, d)) * (1.0 - rockK * 0.7);
        vec3 canopy = mix(uForest * 0.45 + uShadeTint * 0.08, uForest * mix(vec3(1.0), sunN, 0.4), t * 0.75);
        canopy *= 0.7 + 0.5 * vnoise(vWorldPos.xz * 0.09) * vnoise(vWorldPos.xz * 0.023 + 3.1);
        col = mix(col, canopy, fk);
        col += uHemi * 0.07 * (0.5 + 0.5 * nn.y);
        float fres = 1.0 - clamp(dot(nn, v), 0.0, 1.0);
        col += uRim * fres * fres * fres * 0.05 * (0.35 + 0.65 * t);
        if (uIceMood > 0.0) {
          // Glazed moods: the same cool body and mirrored sky the run's ice gets, on the open snow.
          float ice = (uIceMood >= 1.0 ? 0.85 : uIceMood * 0.55) * (1.0 - rockK) * (1.0 - fk);
          col = mix(col, mix(uSnowShade, uSnowDeep, 0.55), 0.62 * ice);
          vec3 rr = reflect(-v, n);
          vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.42, rr.y));
          float fr = 0.32 + 0.68 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.6);
          col = mix(col, sky * 0.86, clamp(fr * 1.15, 0.0, 0.95) * ice);
        }
        col = midAerial(col, vWorldPos, vE);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** One faceted two-tier cone, a metre tall, its tip marked for a frosting of snow (aCap). */
function treeTemplate(): BufferGeometry {
  const pos: number[] = [];
  const cap: number[] = [];
  const N = 5;
  const tier = (r: number, y0: number, y1: number, rot: number, c0: number, c1: number) => {
    for (let i = 0; i < N; i++) {
      const a0 = rot + (i / N) * Math.PI * 2;
      const a1 = rot + ((i + 1) / N) * Math.PI * 2;
      pos.push(Math.cos(a0) * r, y0, Math.sin(a0) * r, 0, y1, 0, Math.cos(a1) * r, y0, Math.sin(a1) * r);
      cap.push(c0, c1, c0);
    }
  };
  tier(0.36, 0.06, 0.66, 0, 0, 0.7);
  tier(0.25, 0.42, 1.0, 0.6, 0.15, 1);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aCap', new BufferAttribute(new Float32Array(cap), 1));
  g.computeVertexNormals();
  return g;
}

function treeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...shared,
      uTreeA: { value: new Color() },
      uTreeB: { value: new Color() },
      uTreeAlt: { value: new Color() },
      uCapK: { value: 0.6 },
      uRing: ring,
    },
    vertexShader: /* glsl */ `
      ${SINK_GLSL}
      attribute vec4 aT;
      attribute vec4 aV;
      attribute float aB;
      attribute float aCap;
      varying vec3 vWorldPos;
      varying vec3 vN;
      varying float vCap;
      varying float vShade;
      varying float vAlt;
      varying float vE;
      void main() {
        float w = abs(aV.x);
        float c = cos(aV.w);
        float s = sin(aV.w);
        vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
        vec3 nm = vec3(normal.x * c - normal.z * s, normal.y, normal.x * s + normal.z * c);
        vN = normalize(vec3(nm.x / max(w, 0.05), nm.y, nm.z / max(w, 0.05)));
        // A tree on sinking ground sinks with it, and shrinks away.
        float sk = midSink(aT.z, aV.z);
        vec3 root = vec3(aT.x, mix(aT.y, min(aT.y, aB), sk), aT.z);
        vec3 wp = root + vec3(p.x * w, p.y, p.z * w) * aT.w * (1.0 - sk);
        vWorldPos = wp;
        vCap = aCap;
        vShade = aV.y;
        vAlt = step(aV.x, 0.0);
        vE = aV.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      ${AERIAL_GLSL}
      uniform vec3 uSnowLit;
      uniform vec3 uTreeA;
      uniform vec3 uTreeB;
      uniform vec3 uTreeAlt;
      uniform float uCapK;
      uniform float uHazardDim;
      varying vec3 vWorldPos;
      varying vec3 vN;
      varying float vCap;
      varying float vShade;
      varying float vAlt;
      varying float vE;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vWorldPos);
        vec3 base = mix(mix(uTreeA, uTreeAlt, vAlt), uTreeB, vShade);
        // Frosted tips on the sun side of the crown.
        float capK = smoothstep(0.35, 0.9, vCap) * uCapK;
        base = mix(base, uSnowLit * 0.9, capK);
        vec3 shade = mix(base * 0.42, uShadeTint * (0.35 + 0.4 * dot(base, vec3(0.33))), 0.45);
        vec3 col = toonLightK(base, shade, n, v, 1.0, 0.25) * mix(1.0, uHazardDim, 0.5);
        col = midAerial(col, vWorldPos, vE);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Village lights after dark: camera-facing additive halos that never shrink below a few pixels, so a
 *  street lamp a kilometre down the valley still reads as a point of warm light (props.ts haloMaterial). */
function haloMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uGlow: { value: 0 },
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uTones: { value: [new Color('#FFB45E'), new Color('#FFD08A'), new Color('#FF5A3A'), new Color('#FF6A20')] },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aL;
      attribute float aTone;
      uniform float uGlow;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uTones[4];
      varying vec2 vQ;
      varying vec3 vC;
      void main() {
        vQ = position.xy * 2.0;
        vec4 c = viewMatrix * vec4(aL.xyz, 1.0);
        float d = max(-c.z, 0.1);
        c.xy += position.xy * max(aL.w, 0.011 * d / projectionMatrix[1][1]);
        // Lava glows by day too; the town's lights only once the light goes.
        float k = aTone > 2.5 ? 0.35 + 0.65 * uGlow : uGlow;
        vC = uTones[int(aTone + 0.5)] * k * (1.0 - 0.6 * smoothstep(uFogNear, uFogFar * 2.6, d));
        gl_Position = projectionMatrix * c;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vQ;
      varying vec3 vC;
      void main() {
        float r = length(vQ);
        float a = (exp(-r * r * 10.0) + exp(-r * 3.4) * 0.25) * (1.0 - smoothstep(0.75, 1.0, r));
        if (a < 0.003) discard;
        gl_FragColor = vec4(vC * 1.6 * a, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

const SHOULDER_ATTRS = ['position', 'normal', 'aE', 'aForest', 'aBase'] as const;
const VILLAGE_ATTRS = ['position', 'normal', 'color', 'aKind', 'aSlot'] as const;

/** Most halos alive at once (two or three villages in view). */
const HALO_CAP = 900;

interface BuiltVillage {
  key: number;
  v: Village;
  /** Its slot in the merged village mesh's uniforms (village.ts VILLAGE_SLOTS). */
  slot: number;
  /** Where its local frame sits in the world. */
  origin: Vector3;
  geometry: BufferGeometry;
  lights: VillageLight[];
  chimneys: number[];
  /** 0 to 1 over its first second and a half: it fades in out of the haze. */
  appear: number;
}

/** Vertices the merged village mesh holds (three valley villages and five hamlets fit with room). */
const VILLAGE_VERTS = 60000;

export class Midground {
  readonly root = new Object3D();
  private course: Course;
  private biome: BiomeId;
  private cfg: TierCfg;
  /** Signed lateral offsets of the columns (from the corridor centre, at the reference frame) and how
   *  each is made: 0 outer (e = metres past the reference edge), 1 the tier's own terrain edge,
   *  2 the sunk skirt under it, 3 the corridor fill far below the run. */
  private colU: number[] = [];
  private colKind: number[] = [];
  private colE: number[] = [];
  private nRows = 0;
  private slotRow: Int32Array = new Int32Array(0);
  private geo = new BufferGeometry();
  private pos = new Float32Array(0);
  private nrm = new Float32Array(0);
  private aE = new Float32Array(0);
  private aF = new Float32Array(0);
  private aBase = new Float32Array(0);
  private index = new Uint32Array(0);
  private shoulder: Mesh;
  private shoulderMat = shoulderMaterial();
  private trees: Mesh | null = null;
  private treeGeo: InstancedBufferGeometry | null = null;
  private treeMat = treeMaterial();
  private aT = new Float32Array(0);
  private aV = new Float32Array(0);
  private aB = new Float32Array(0);
  /** The row being built: its run level, under which sinking ground settles. */
  private rowBase = 0;
  private perRow = 0;
  private villageMat = makeVillageMaterial(AERIAL_GLSL, { uRing: ring });
  /** Every standing village merged into one mesh (one draw call), world space. */
  private villageGeo = new BufferGeometry();
  private villageMesh: Mesh;
  private vPos = new Float32Array(VILLAGE_VERTS * 3);
  private vNrm = new Float32Array(VILLAGE_VERTS * 3);
  private vCol = new Float32Array(VILLAGE_VERTS * 3);
  private vKind = new Float32Array(VILLAGE_VERTS);
  private vSlot = new Float32Array(VILLAGE_VERTS);
  /** How many of the standing villages (in order) are in the merged mesh, and their vertices. */
  private mergedN = 0;
  private mergedVerts = 0;
  private pendingMerge = false;
  /** A village is waiting for idle time to be made; gen changes when the course or tier does, so a
   *  late one for the last mountain is dropped. */
  private waiting = false;
  private gen = 0;
  private villages = new Map<number, Village | null>();
  private hamlets = new Map<number, Village | null>();
  private built: BuiltVillage[] = [];
  private haloGeo: InstancedBufferGeometry;
  private haloMat = haloMaterial();
  private halos: Mesh;
  private haloL = new Float32Array(HALO_CAP * 4);
  private haloT = new Float32Array(HALO_CAP);
  private dirty = false;
  private sideA = newSide(-1);
  private sideB = newSide(1);
  private sideN = newSide(1);
  private sideG = newSide(1);
  private lastT = 0;
  private rowY = new Float32Array(0);
  private rowX = new Float32Array(0);
  private grad = { x: 0, z: 0 };
  /** Main-thread milliseconds per frame allowed for building rows. */
  budgetMs = 1.2;

  constructor(course: Course, palette: Palette, tier: 'low' | 'medium' | 'high', reach: number) {
    this.course = course;
    this.biome = course.biome;
    this.cfg = TIERS[tier];
    this.root.name = 'midground';
    this.shoulder = new Mesh(this.geo, this.shoulderMat);
    this.shoulder.frustumCulled = false;
    this.shoulder.matrixAutoUpdate = false;
    this.root.add(this.shoulder);
    const quad = new PlaneGeometry(1, 1);
    this.haloGeo = new InstancedBufferGeometry();
    this.haloGeo.setAttribute('position', quad.getAttribute('position'));
    this.haloGeo.setIndex(quad.getIndex());
    this.haloGeo.setAttribute('aL', new InstancedBufferAttribute(this.haloL, 4));
    this.haloGeo.setAttribute('aTone', new InstancedBufferAttribute(this.haloT, 1));
    this.haloGeo.instanceCount = 0;
    this.halos = new Mesh(this.haloGeo, this.haloMat);
    this.halos.frustumCulled = false;
    this.halos.renderOrder = 2;
    this.halos.visible = false;
    this.root.add(this.halos);
    this.villageGeo.setAttribute('position', new BufferAttribute(this.vPos, 3));
    this.villageGeo.setAttribute('normal', new BufferAttribute(this.vNrm, 3));
    this.villageGeo.setAttribute('color', new BufferAttribute(this.vCol, 3));
    this.villageGeo.setAttribute('aKind', new BufferAttribute(this.vKind, 1));
    this.villageGeo.setAttribute('aSlot', new BufferAttribute(this.vSlot, 1));
    this.villageGeo.setDrawRange(0, 0);
    this.villageMesh = new Mesh(this.villageGeo, this.villageMat);
    this.villageMesh.frustumCulled = false;
    this.villageMesh.matrixAutoUpdate = false;
    this.villageMesh.visible = false;
    this.root.add(this.villageMesh);
    this.layout(reach);
    this.setPalette(palette);
  }

  setCourse(course: Course, palette: Palette): void {
    if (course !== this.course) {
      this.course = course;
      this.biome = course.biome;
      this.villages.clear();
      this.hamlets.clear();
      this.clear();
    }
    this.setPalette(palette);
  }

  setTier(tier: 'low' | 'medium' | 'high', reach: number): void {
    this.cfg = TIERS[tier];
    this.layout(reach);
  }

  /** Per biome and mood: the rock, the forest and the trees' colours (the light itself comes through
   *  the shared uniforms, so the sun's journey re-lights everything without a call here). */
  setPalette(p: Palette): void {
    const u = this.shoulderMat.uniforms;
    u.uRock.value.copy(p.low);
    u.uRockLit.value.copy(p.lowLit);
    const t = this.treeMat.uniforms;
    t.uTreeA.value.copy(p.tall);
    t.uTreeB.value.copy(p.tallDark);
    // Sakura's slopes mix spruce among the blossom; Frostfang's ice spires stand among dark firs.
    const alt = this.biome === 'blossom' ? '#1F5753' : this.biome === 'glacier' ? '#2C5872' : this.biome === 'volcanic' ? '#3A3036' : '#24605A';
    t.uTreeAlt.value.set(alt);
    t.uCapK.value = this.biome === 'alpine' ? 0.7 : this.biome === 'glacier' ? 0.45 : this.biome === 'volcanic' ? 0.3 : 0.35;
    // The carpet's colour on the shoulder: the forest's own mix, a step darker.
    const f = u.uForest.value as Color;
    f.copy(p.tall).lerp(p.tallDark, 0.55);
    if (this.biome === 'blossom') f.lerp(new Color('#1F5753'), 0.35);
    if (this.biome === 'glacier') f.lerp(new Color('#2C5872'), 0.4);
  }

  /** Chimney tops of the villages standing now (world space), for smoke. Writes up to out.length
   *  points and returns how many. */
  chimneys(out: Vector3[]): number {
    let n = 0;
    for (let j = 0; j < this.built.length; j++) {
      const b = this.built[j];
      const c = b.chimneys;
      for (let i = 0; i + 2 < c.length && n < out.length; i += 3) out[n++].set(c[i] + b.origin.x, c[i + 1] + b.origin.y, c[i + 2] + b.origin.z);
    }
    return n;
  }

  private clear(): void {
    this.gen++;
    this.slotRow.fill(-2147483647);
    this.aT.fill(0);
    for (const b of this.built) b.geometry.dispose();
    this.built.length = 0;
    this.mergeVillages();
    this.dirty = true;
  }

  /** The columns and the ring buffers for a tier. */
  private layout(reach: number): void {
    const hw = this.course.params.halfWidthStart + 2.6;
    let edge = 0;
    for (const s of TERRAIN_STEPS) if (s > 10 && s <= reach) edge = s;
    const u0 = hw + edge;
    const uRef = hw + REF_REACH;
    const side: Array<[number, number, number]> = [];
    side.push([Math.max(u0 - 34, hw + 14), 3, 0]);
    side.push([u0 - Math.min(10, (edge - 10) * 0.4), 2, 0]);
    side.push([u0, 1, 0]);
    // A lower tier's narrower terrain: the bank carries on to the reference edge.
    for (let u = u0 + 14; u < uRef - 4; u += 14) side.push([u, 1, 0]);
    const [a, b] = this.cfg.step;
    for (let e = 0; e <= E_MAX; e += a + b * e) side.push([uRef + e, 0, e]);
    this.colU = [];
    this.colKind = [];
    this.colE = [];
    for (let i = side.length - 1; i >= 0; i--) {
      this.colU.push(-side[i][0]);
      this.colKind.push(side[i][1]);
      this.colE.push(side[i][2]);
    }
    this.colU.push(0);
    this.colKind.push(3);
    this.colE.push(0);
    for (const s of side) {
      this.colU.push(s[0]);
      this.colKind.push(s[1]);
      this.colE.push(s[2]);
    }
    const cols = this.colU.length;
    this.nRows = Math.ceil((BEHIND + this.cfg.ahead) / ROW) + 2;
    const verts = cols * this.nRows;
    this.slotRow = new Int32Array(this.nRows).fill(-2147483647);
    this.pos = new Float32Array(verts * 3);
    this.nrm = new Float32Array(verts * 3);
    this.aE = new Float32Array(verts);
    this.aF = new Float32Array(verts);
    this.aBase = new Float32Array(verts);
    this.index = new Uint32Array((this.nRows - 1) * (cols - 1) * 6);
    this.rowY = new Float32Array(cols);
    this.rowX = new Float32Array(cols);
    this.geo.dispose();
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geo.setAttribute('normal', new BufferAttribute(this.nrm, 3));
    this.geo.setAttribute('aE', new BufferAttribute(this.aE, 1));
    this.geo.setAttribute('aForest', new BufferAttribute(this.aF, 1));
    this.geo.setAttribute('aBase', new BufferAttribute(this.aBase, 1));
    this.geo.setIndex(new BufferAttribute(this.index, 1));
    this.geo.setDrawRange(0, 0);
    this.shoulder.geometry = this.geo;
    this.shoulderMat.uniforms.uForestK.value = this.cfg.forestTint;

    // The forest carpet.
    if (this.trees) {
      this.root.remove(this.trees);
      this.treeGeo?.dispose();
      this.trees = null;
      this.treeGeo = null;
    }
    this.perRow = this.cfg.trees * 2;
    if (this.perRow > 0) {
      const n = this.perRow * this.nRows;
      this.aT = new Float32Array(n * 4);
      this.aV = new Float32Array(n * 4);
      this.aB = new Float32Array(n);
      const tg = new InstancedBufferGeometry();
      const tpl = treeTemplate();
      tg.setAttribute('position', tpl.getAttribute('position'));
      tg.setAttribute('normal', tpl.getAttribute('normal'));
      tg.setAttribute('aCap', tpl.getAttribute('aCap'));
      tg.setAttribute('aT', new InstancedBufferAttribute(this.aT, 4));
      tg.setAttribute('aV', new InstancedBufferAttribute(this.aV, 4));
      tg.setAttribute('aB', new InstancedBufferAttribute(this.aB, 1));
      tg.instanceCount = n;
      this.treeGeo = tg;
      this.trees = new Mesh(tg, this.treeMat);
      this.trees.frustumCulled = false;
      this.trees.matrixAutoUpdate = false;
      this.root.add(this.trees);
    } else {
      this.aT = new Float32Array(0);
      this.aV = new Float32Array(0);
      this.aB = new Float32Array(0);
    }
    this.clear();
  }

  // ------------------------------------------------------------------ the shape of the world

  /** The village on staircase flat k, if it has one (deterministic per course). */
  private village(k: number): Village | null {
    let v = this.villages.get(k);
    if (v !== undefined) return v;
    v = null;
    const seed = this.course.seed;
    if (hashf(seed, k, 11) < 0.8) {
      const z = STAIR * k + STAIR * FLAT * (0.42 + 0.16 * hashf(seed, k, 13));
      // On whichever side already falls away there (a coin toss where both do).
      const l = this.modeRaw(z, -1);
      const r = this.modeRaw(z, 1);
      const side = Math.abs(l - r) < 0.15 ? (hashf(seed, k, 12) < 0.5 ? -1 : 1) : l < r ? -1 : 1;
      v = { k, side, z, e: VILLAGE_E + (hashf(seed, k, 14) - 0.5) * 80, y: this.course.baseY(STAIR * k) - VALLEY_DEPTH, seed: Math.floor(hashf(seed, k, 15) * 1e9) + 1, slope: false };
    }
    this.villages.set(k, v);
    return v;
  }

  /** The hamlet perched on a mountain flank in stretch j of the course (HAMLET_STEP metres each), if
   *  any: only where that side climbs into a spur (it must show over the bank), never by a valley
   *  village. */
  private hamlet(j: number): Village | null {
    let v = this.hamlets.get(j);
    if (v !== undefined) return v;
    v = null;
    const seed = this.course.seed;
    if (hashf(seed, j, 21) < 0.85) {
      const z = HAMLET_STEP * j + HAMLET_STEP * (0.15 + 0.7 * hashf(seed, j, 22));
      const first = hashf(seed, j, 23) < 0.5 ? -1 : 1;
      for (let t = 0; t < 2 && !v; t++) {
        const side = t === 0 ? first : -first;
        if (Math.min(this.modeK(z - 110, side), this.modeK(z, side), this.modeK(z + 110, side)) < 0.5) continue;
        v = { k: j, side, z, e: HAMLET_E + (hashf(seed, j, 24) - 0.5) * 80, y: 0, seed: Math.floor(hashf(seed, j, 25) * 1e9) + 1, slope: true };
      }
    }
    this.hamlets.set(j, v);
    return v;
  }

  /** 0 where a side falls away into the valley, 1 where it climbs into a spur: one slow noise, the two
   *  sides opposed (one falls away while the other climbs; both climb a little where it is near zero),
   *  so the run nearly always has a mountain wall on at least one hand. */
  private modeRaw(z: number, side: number): number {
    const seed = this.course.seed;
    const a = noise1(seed ^ 0x51ed, z / 820) * 0.7 + noise1(seed ^ 0x2a17, z / 330) * 0.3;
    const m = side * a * 1.6 + 0.12 + noise1(seed ^ (side > 0 ? 0x77a1 : 0x19c3), z / 600) * 0.35;
    return smooth(-0.35, 0.35, m);
  }

  /** modeRaw, and always a valley round a valley village. */
  private modeK(z: number, side: number): number {
    let k = this.modeRaw(z, side);
    const k0 = Math.floor(z / STAIR);
    for (let j = k0 - 1; j <= k0 + 1; j++) {
      const v = this.village(j);
      if (v && v.side === side) k *= smooth(260, 520, Math.abs(z - v.z));
    }
    return k;
  }

  /** The staircase's z: constant along a flat, climbing smoothly to the next through its icefall. */
  private stairZ(z: number): number {
    const k = Math.floor(z / STAIR);
    return STAIR * k + STAIR * smooth(FLAT, 1, z / STAIR - k);
  }

  private sideInfo(z: number, side: number, out: SideInfo): void {
    const c = this.course;
    const seed = c.seed;
    out.side = side;
    out.cx = c.centerX(z);
    let cs = 0;
    for (let k = -2; k <= 2; k++) cs += c.centerX(z + k * 120);
    out.cs = cs / 5;
    const uRef = c.params.halfWidthStart + 2.6 + REF_REACH;
    out.xE = out.cx + side * uRef;
    out.yE = c.ground(out.xE, z);
    out.k = this.modeK(z, side);
    out.yF = c.baseY(this.stairZ(z)) - VALLEY_DEPTH;
    out.wall = 640 + 170 * noise1(seed ^ (side > 0 ? 0x3bd : 0x91f), z / 520);
    out.spur = 340 + 150 * noise1(seed ^ (side > 0 ? 0x6c1 : 0x4e3), z / 430);
    out.vil = null;
    out.ham = null;
    const k0 = Math.floor(z / STAIR);
    let best = 1e9;
    let bestH = 1e9;
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      const v = this.village(k);
      if (v && v.side === side && Math.abs(z - v.z) < Math.min(760, best)) {
        best = Math.abs(z - v.z);
        out.vil = v;
      }
    }
    const j0 = Math.floor(z / HAMLET_STEP);
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      const h = this.hamlet(j);
      if (h && h.side === side && Math.abs(z - h.z) < Math.min(400, bestH)) {
        bestH = Math.abs(z - h.z);
        out.ham = h;
      }
    }
  }

  /** Height `e` metres past the reference edge, at world x (for the detail noise). */
  private height(s: SideInfo, e: number, x: number, z: number): number {
    const seed = this.course.seed;
    // The bank's crest carries on a little past the edge (more where a spur climbs from it).
    const near = s.yE + (6 + 16 * s.k) * (1 - Math.exp(-e / 60));
    const fall = smooth(30, 360, e);
    // Across the valley floor the far side climbs into the next mountain wall, its crest the skyline
    // seen over the bank from the run.
    const yv = near + (s.yF - near) * fall + s.wall * (Math.pow(smooth(600, 1000, e), 0.8) - 0.15 * smooth(1020, 1150, e));
    // A spur climbs steeply from the bank (it towers over the run within a few hundred metres) to a
    // crest about 650 m out and eases off beyond it.
    const ys = near + s.spur * (Math.pow(smooth(0, 650, e), 0.72) - 0.22 * smooth(700, 1150, e));
    let y = yv + (ys - yv) * s.k;
    const floorK = (1 - s.k) * smooth(330, 420, e) * (1 - smooth(600, 760, e));
    let amp = smooth(15, 260, e) * (12 + 70 * s.k) * (1 - 0.75 * floorK);
    // A hamlet's slope is smoothed (its houses step down a slope, not a scree of spikes).
    if (s.ham) amp *= 0.3 + 0.7 * smooth(HAMLET_R * 0.6, HAMLET_R + 120, Math.hypot(e - s.ham.e, z - s.ham.z));
    const r = 1 - Math.abs(noise2(seed ^ 0x1d3, x / 210, z / 260));
    const r2 = 1 - Math.abs(noise2(seed ^ 0x4b7, x / 80, z / 95));
    y += amp * (r * r - 0.4 + 0.3 * (r2 * r2 - 0.4) + 0.2 * noise2(seed ^ 0x2e5, x / 45, z / 45));
    const v = s.vil;
    if (v) {
      const w = 1 - smooth(VILLAGE_R + 10, VILLAGE_R + 160, Math.hypot(e - v.e, z - v.z));
      y += (v.y - y) * w;
    }
    return y;
  }

  /** Forest cover 0..1 at a point. */
  private forest(s: SideInfo, e: number, x: number, z: number, y: number, slope: number): number {
    const seed = this.course.seed;
    const n = noise2(seed ^ 0x7f1, x / 260, z / 260) * 0.7 + noise2(seed ^ 0x3c9, x / 90, z / 90) * 0.3;
    let f = smooth(-0.35, 0.15, n);
    // A treeline (bare snow and rock above it), and no trees on cliffs.
    f *= 1 - smooth(150, 240, y - s.yE);
    f *= 1 - smooth(1.15, 1.7, slope);
    const floorK = (1 - s.k) * smooth(330, 420, e) * (1 - smooth(600, 760, e));
    f *= 1 - 0.5 * floorK;
    const v = s.vil;
    if (v) f *= 0.2 + 0.8 * smooth(VILLAGE_R * 0.7, VILLAGE_R + 40, Math.hypot(e - v.e, z - v.z));
    const h = s.ham;
    if (h) f *= 0.1 + 0.9 * smooth(HAMLET_R * 0.8, HAMLET_R + 40, Math.hypot(e - h.e, z - h.z));
    if (this.biome === 'volcanic') f *= 0.6;
    else if (this.biome === 'glacier') f *= 0.7;
    return f;
  }

  /** World x of a column `e` past the reference edge: near columns follow the corridor exactly, far
   *  ones its smoothed line (so the far mountainside does not wriggle with every bend). */
  private colX(s: SideInfo, e: number): number {
    return s.xE + s.side * e + (s.cs - s.cx) * smooth(0, 320, e);
  }

  // ------------------------------------------------------------------ building rows

  private buildRow(r: number): void {
    const c = this.course;
    const z = r * ROW;
    const slot = ((r % this.nRows) + this.nRows) % this.nRows;
    this.slotRow[slot] = r;
    const cols = this.colU.length;
    const L = this.sideA;
    const R = this.sideB;
    this.sideInfo(z, -1, L);
    this.sideInfo(z, 1, R);
    const cx = L.cx;
    const by = c.baseY(z);
    this.rowBase = by - 14;
    const base = slot * cols;
    const ys = this.rowY;
    const xs = this.rowX;
    for (let i = 0; i < cols; i++) {
      const u = this.colU[i];
      const kind = this.colKind[i];
      const s = u < 0 ? L : R;
      let x: number;
      let y: number;
      if (kind === 0) {
        x = this.colX(s, this.colE[i]);
        y = this.height(s, this.colE[i], x, z);
      } else {
        // The terrain's own edge (and, on a lower tier, the bank carrying on past it) exactly; the
        // skirt tucked 2.5 m under the terrain; the fill far under the run (it only shows past the
        // end of the streamed terrain, in the haze, and stays under the deepest drop).
        x = cx + u;
        y = kind === 3 ? by - 14 : c.ground(x, z) - (kind === 2 ? 2.5 : 0);
      }
      xs[i] = x;
      ys[i] = y;
      const p = (base + i) * 3;
      this.pos[p] = x;
      this.pos[p + 1] = y;
      this.pos[p + 2] = -z;
      this.aE[base + i] = kind === 0 ? this.colE[i] : kind === 1 ? 0 : -20;
      this.aBase[base + i] = by - 14;
    }
    // Normals: across from the row's own neighbours, down the slope from the same profile a few
    // metres on (the inner columns from the ground itself, as the terrain does).
    const N = this.sideN;
    const dz = 4;
    for (let side = -1; side <= 1; side += 2) {
      this.sideInfo(z + dz, side, N);
      for (let i = 0; i < cols; i++) {
        const u = this.colU[i];
        if (Math.sign(u) !== side || this.colKind[i] !== 0) continue;
        const e = this.colE[i];
        const yn = this.height(N, e, this.colX(N, e), z + dz);
        this.writeNormal(base, i, (yn - ys[i]) / dz);
      }
    }
    const g = this.grad;
    for (let i = 0; i < cols; i++) {
      const kind = this.colKind[i];
      if (kind === 0) continue;
      if (kind === 3) g.x = g.z = 0;
      else c.gradient(xs[i], z, g);
      const inv = 1 / Math.sqrt(g.x * g.x + 1 + g.z * g.z);
      const p = (base + i) * 3;
      this.nrm[p] = -g.x * inv;
      this.nrm[p + 1] = inv;
      this.nrm[p + 2] = g.z * inv;
    }
    // Forest cover per vertex, and the trees.
    for (let i = 0; i < cols; i++) {
      if (this.colKind[i] !== 0) {
        this.aF[base + i] = 0;
        continue;
      }
      const s = this.colU[i] < 0 ? L : R;
      const slope = this.lateralSlope(i);
      this.aF[base + i] = this.forest(s, this.colE[i], xs[i], z, ys[i], slope) * smooth(0, 30, this.colE[i]);
    }
    if (this.perRow > 0) this.plantRow(r, slot, z);
    this.dirty = true;
  }

  private lateralSlope(i: number): number {
    const a = Math.max(0, i - 1);
    const b = Math.min(this.colU.length - 1, i + 1);
    const dx = Math.abs(this.rowX[b] - this.rowX[a]) || 1;
    return Math.abs(this.rowY[b] - this.rowY[a]) / dx;
  }

  private writeNormal(base: number, i: number, gz: number): void {
    const a = Math.max(0, i - 1);
    const b = Math.min(this.colU.length - 1, i + 1);
    const dx = this.rowX[b] - this.rowX[a];
    const gx = dx !== 0 ? (this.rowY[b] - this.rowY[a]) / dx : 0;
    const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
    const p = (base + i) * 3;
    this.nrm[p] = -gx * inv;
    this.nrm[p + 1] = inv;
    this.nrm[p + 2] = gz * inv;
  }

  /** The row's trees: candidates scattered past the edge (denser near, where they are big on
   *  screen), kept where the forest stands, set on the row's own profile. */
  private plantRow(r: number, slot: number, z: number): void {
    const seed = this.course.seed;
    const per = this.cfg.trees;
    const cols = this.colU.length;
    const T = this.aT;
    const V = this.aV;
    let q = slot * this.perRow;
    const biome = this.biome;
    for (let side = -1; side <= 1; side += 2) {
      const s = side < 0 ? this.sideA : this.sideB;
      for (let j = 0; j < per; j++, q++) {
        const h0 = hashf(seed, r * 131 + j, side + 7);
        const e = 3 + Math.pow(hashf(seed, r * 131 + j, side + 19), 1.6) * (E_MAX - 120);
        const zz = z + (hashf(seed, r * 131 + j, side + 29) - 0.5) * ROW;
        // Find the columns either side of e on this side of the row.
        let i0 = -1;
        for (let i = 0; i < cols; i++) {
          if (this.colKind[i] !== 0 || Math.sign(this.colU[i]) !== side) continue;
          const ei = this.colE[i];
          const nx = side > 0 ? i + 1 : i - 1;
          if (nx < 0 || nx >= cols || this.colKind[nx] !== 0) continue;
          if (ei <= e && this.colE[nx] > e) {
            i0 = i;
            break;
          }
        }
        if (i0 < 0) {
          T[q * 4 + 3] = 0;
          continue;
        }
        const i1 = side > 0 ? i0 + 1 : i0 - 1;
        const t = (e - this.colE[i0]) / (this.colE[i1] - this.colE[i0]);
        const x = this.rowX[i0] + (this.rowX[i1] - this.rowX[i0]) * t;
        const y = this.rowY[i0] + (this.rowY[i1] - this.rowY[i0]) * t;
        const slope = Math.abs(this.rowY[i1] - this.rowY[i0]) / (Math.abs(this.rowX[i1] - this.rowX[i0]) || 1);
        const f = this.forest(s, e, x, zz, y, slope);
        if (h0 > f) {
          T[q * 4 + 3] = 0;
          continue;
        }
        // Bigger than life further out (they are specks at a kilometre), never bigger than the bank's
        // own pines right at the edge.
        const hv = hashf(seed, r * 131 + j, side + 41);
        let h = (9 + 10 * smooth(0, 450, e)) * (0.75 + 0.5 * hv);
        let w = 0.95 + 0.3 * hashf(seed, r * 131 + j, side + 53);
        let alt = false;
        const pick = hashf(seed, r * 131 + j, side + 67);
        if (biome === 'blossom') {
          alt = pick < 0.4;
          if (!alt) {
            w = 1.7 + 0.4 * hv;
            h *= 0.6;
          }
        } else if (biome === 'glacier') {
          alt = pick < 0.45;
          if (!alt) {
            w = 0.45 + 0.2 * hv;
            h *= 1.1;
          }
        } else if (biome === 'volcanic') {
          if (pick < 0.45) {
            w = 0.28;
            h *= 0.9;
          }
          alt = pick > 0.8;
        }
        T[q * 4] = x;
        T[q * 4 + 1] = y - 1.5;
        this.aB[q] = this.rowBase - 1.5;
        T[q * 4 + 2] = -zz;
        T[q * 4 + 3] = h;
        V[q * 4] = alt ? -w : w;
        V[q * 4 + 1] = hashf(seed, r * 131 + j, side + 79);
        V[q * 4 + 2] = e;
        V[q * 4 + 3] = hv * 6.283;
      }
    }
  }

  private rebuildIndex(): void {
    const cols = this.colU.length;
    const idx = this.index;
    let q = 0;
    for (let s = 0; s < this.nRows; s++) {
      const r = this.slotRow[s];
      if (r === -2147483647) continue;
      const s2 = (((r + 1) % this.nRows) + this.nRows) % this.nRows;
      if (this.slotRow[s2] !== r + 1) continue;
      const A = s * cols;
      const B = s2 * cols;
      for (let col = 0; col < cols - 1; col++) {
        const a = A + col;
        const b = a + 1;
        const e = B + col;
        const f = e + 1;
        idx[q++] = a;
        idx[q++] = b;
        idx[q++] = e;
        idx[q++] = b;
        idx[q++] = f;
        idx[q++] = e;
      }
    }
    this.geo.setDrawRange(0, q);
    this.geo.index!.needsUpdate = true;
    for (const n of SHOULDER_ATTRS) this.geo.getAttribute(n).needsUpdate = true;
    if (this.treeGeo) {
      this.treeGeo.getAttribute('aT').needsUpdate = true;
      this.treeGeo.getAttribute('aV').needsUpdate = true;
      this.treeGeo.getAttribute('aB').needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ per frame

  /** Keep the rows round sim z built (nearest first, on a time slice; `prime`, at run start, allows a
   *  few milliseconds more), the villages in range standing, and the lights' glow in step with the light. */
  update(z: number, prime = false): void {
    const cur = Math.floor(z / ROW);
    const r0 = Math.floor((z - BEHIND) / ROW);
    const r1 = r0 + this.nRows - 2;
    ring.value.set(-r0 * ROW, -r1 * ROW);
    const deadline = performance.now() + (prime ? 4 : this.budgetMs);
    let builtRows = false;
    // Nearest first, ahead before behind.
    for (let d = 0; d <= r1 - r0; d++) {
      for (let t = 0; t < (d === 0 ? 1 : 2); t++) {
        const r = t === 0 ? cur + d : cur - d;
        if (r < r0 || r > r1) continue;
        const slot = ((r % this.nRows) + this.nRows) % this.nRows;
        if (this.slotRow[slot] === r) continue;
        this.buildRow(r);
        builtRows = true;
        if (performance.now() > deadline) {
          d = 1e9;
          break;
        }
      }
    }
    if (this.dirty) {
      this.dirty = false;
      this.rebuildIndex();
    }
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    // (A village is built only in a frame that built no rows, so the two never stack into a hitch.)
    if (this.cfg.villages && !builtRows) this.updateVillages(z, dt);
    else if (this.cfg.villages) this.fadeVillages(dt);
    else if (this.built.length) this.dropVillages(-1e9, -1e9);
    // Lights come on as the light goes: at night, through blue hour, and faintly in the alpenglow.
    const sunLow = smooth(0.42, 0.22, shared.uSunDir.value.y);
    const glow = Math.min(1, Math.max(1 - shared.uDayK.value, shared.uLantern.value * 1.6, sunLow * 0.45));
    this.villageMat.uniforms.uGlow.value = glow;
    this.haloMat.uniforms.uGlow.value = glow;
    this.halos.visible = this.haloGeo.instanceCount > 0 && (glow > 0.02 || this.biome === 'volcanic');
  }

  private dropVillages(lo: number, hi: number): void {
    let changed = false;
    for (let i = this.built.length - 1; i >= 0; i--) {
      const b = this.built[i];
      if (b.v.z >= lo && b.v.z <= hi) continue;
      b.geometry.dispose();
      this.built.splice(i, 1);
      changed = true;
    }
    if (changed) this.mergeVillages();
  }

  private isBuilt(key: number): boolean {
    for (let i = 0; i < this.built.length; i++) if (this.built[i].key === key) return true;
    return false;
  }

  private freeSlot(): number {
    for (let s = 0; s < VILLAGE_SLOTS; s++) {
      let used = false;
      for (let i = 0; i < this.built.length; i++) if (this.built[i].slot === s) used = true;
      if (!used) return s;
    }
    return -1;
  }

  private updateVillages(z: number, dt: number): void {
    const lo = z - BEHIND - 400;
    // A valley village stands once its whole floor is streamed (the valley floor never sinks, and the
    // haze at the ring's end fades it in); a hamlet once its flank has risen out of the sink.
    const hiV = z + this.cfg.ahead - VILLAGE_R - 40;
    const hiH = z + this.cfg.ahead - 400 - HAMLET_R;
    this.dropVillages(lo, hiV);
    this.fadeVillages(dt);
    if (this.pendingMerge) {
      this.mergeVillages(this.mergedN);
      return;
    }
    // One village at a time is made, on idle time (a few milliseconds each, never inside a frame).
    if (this.waiting || this.freeSlot() < 0) return;
    for (let kind = 0; kind < 2; kind++) {
      const step = kind === 0 ? STAIR : HAMLET_STEP;
      for (let k = Math.floor(lo / step); k <= Math.floor(hiV / step); k++) {
        const v = kind === 0 ? this.village(k) : this.hamlet(k);
        const key = k * 2 + kind;
        if (!v || v.z < lo || v.z > (kind === 0 ? hiV : hiH) || this.isBuilt(key)) continue;
        this.waiting = true;
        const gen = this.gen;
        whenIdle(() => {
          this.waiting = false;
          if (gen === this.gen) this.makeVillage(key, v);
        });
        return;
      }
    }
  }

  private makeVillage(key: number, v: Village): void {
    const slot = this.freeSlot();
    if (slot < 0 || this.isBuilt(key)) return;
    const s = this.sideN;
    this.sideInfo(v.z, v.side, s);
    const ox = this.colX(s, v.e);
    let b: VillageBuild;
    let oy = v.y;
    if (!v.slope) b = buildVillage({ biome: this.biome, seed: v.seed, radius: VILLAGE_R - 20, side: v.side });
    else {
      oy = this.height(s, v.e, ox, v.z);
      b = buildHamlet({ biome: this.biome, seed: v.seed, radius: HAMLET_R, side: v.side }, this.hamletGround(ox, oy, v));
    }
    this.built.push({ key, v, slot, origin: new Vector3(ox, oy, -v.z), geometry: b.geometry, lights: b.lights, chimneys: b.chimneys, appear: 0 });
    (this.villageMat.uniforms.uAppearA.value as number[])[slot] = 0;
    // (Merged into the village mesh in the next frame's update.)
    this.pendingMerge = true;
  }

  /** Each standing village eases in out of the haze over its first second and a half. */
  private fadeVillages(dt: number): void {
    const appear = this.villageMat.uniforms.uAppearA.value as number[];
    const ve = this.villageMat.uniforms.uVE.value as number[];
    for (let i = 0; i < this.built.length; i++) {
      const b = this.built[i];
      b.appear = Math.min(1, b.appear + dt / 1.5);
      appear[b.slot] = b.appear;
      ve[b.slot] = b.v.e;
    }
  }

  /** A hamlet's slope as a small height grid round it (sampled once, then read bilinearly), in its
   *  local frame relative to its origin: its houses ask for dozens of heights, and each full sample
   *  costs a profile evaluation. */
  private hamletGround(ox: number, oy: number, v: Village): (x: number, z: number) => number {
    const G = 9;
    const span = HAMLET_R * 2.4;
    const step = span / (G - 1);
    const grid = new Float32Array(G * G);
    for (let j = 0; j < G; j++) {
      const lz = -span / 2 + j * step;
      for (let i = 0; i < G; i++) {
        const lx = -span / 2 + i * step;
        grid[j * G + i] = this.groundAt(ox + lx, v.z - lz, v.side) - oy;
      }
    }
    return (x: number, z: number) => {
      const fx = Math.max(0, Math.min(G - 1.001, (x + span / 2) / step));
      const fz = Math.max(0, Math.min(G - 1.001, (z + span / 2) / step));
      const i = Math.floor(fx);
      const j = Math.floor(fz);
      const tx = fx - i;
      const tz = fz - j;
      const a = grid[j * G + i] + (grid[j * G + i + 1] - grid[j * G + i]) * tx;
      const b = grid[(j + 1) * G + i] + (grid[(j + 1) * G + i + 1] - grid[(j + 1) * G + i]) * tx;
      return a + (b - a) * tz;
    };
  }

  /** Shoulder height at world x and sim z on one side (for a hamlet's houses). */
  private groundAt(x: number, z: number, side: number): number {
    const s = this.sideG;
    this.sideInfo(z, side, s);
    // Invert colX: near enough after one correction (the smoothed centre barely moves in a step).
    let e = side * (x - s.xE);
    e += side * (x - this.colX(s, e));
    return this.height(s, Math.max(0, e), x, z);
  }

  /** Copies every standing village into the one village mesh (world space, tagged with its slot),
   *  and their lights into the halo pass. Only when a village comes or goes. */
  private mergeVillages(from = 0): void {
    this.pendingMerge = false;
    const P = this.vPos;
    const S = this.vSlot;
    let n = from === 0 ? 0 : this.mergedVerts;
    const n0 = n;
    for (let bi = from; bi < this.built.length; bi++) {
      const b = this.built[bi];
      const g = b.geometry;
      const p = g.getAttribute('position').array as Float32Array;
      const count = p.length / 3;
      if (n + count > VILLAGE_VERTS) continue;
      const o = b.origin;
      for (let i = 0; i < count; i++) {
        const q = (n + i) * 3;
        P[q] = p[i * 3] + o.x;
        P[q + 1] = p[i * 3 + 1] + o.y;
        P[q + 2] = p[i * 3 + 2] + o.z;
        S[n + i] = b.slot;
      }
      this.vNrm.set(g.getAttribute('normal').array as Float32Array, n * 3);
      this.vCol.set(g.getAttribute('color').array as Float32Array, n * 3);
      this.vKind.set(g.getAttribute('aKind').array as Float32Array, n);
      n += count;
    }
    this.villageGeo.setDrawRange(0, n);
    // (Only the part in use goes up to the GPU.)
    for (const a of VILLAGE_ATTRS) {
      const attr = this.villageGeo.getAttribute(a) as BufferAttribute;
      attr.clearUpdateRanges();
      attr.addUpdateRange(n0 * attr.itemSize, Math.max(1, n - n0) * attr.itemSize);
      attr.needsUpdate = true;
    }
    this.villageMesh.visible = n > 0;
    this.mergedVerts = n;
    this.mergedN = this.built.length;
    let h = 0;
    for (const b of this.built) {
      const o = b.origin;
      for (const l of b.lights) {
        if (h >= HALO_CAP) break;
        this.haloL[h * 4] = l.x + o.x;
        this.haloL[h * 4 + 1] = l.y + o.y;
        this.haloL[h * 4 + 2] = l.z + o.z;
        this.haloL[h * 4 + 3] = l.size;
        this.haloT[h] = l.tone;
        h++;
      }
    }
    this.haloGeo.instanceCount = h;
    this.haloGeo.getAttribute('aL').needsUpdate = true;
    this.haloGeo.getAttribute('aTone').needsUpdate = true;
  }
}
