import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Material, Mesh, Object3D, ShaderMaterial } from 'three';
import { Course, type Ledge } from '../sim/course';
import { ASH_TOP, basaltTones } from './flora';
import { fx } from './fxhub';
import { visualGround, vnoise2 } from './ground';
import type { Kind } from './landmarkKit';
import { pushLocalLight } from './lights';
import { shared } from './materials';
import { Palette } from './palette';
import { Facets, columnInto } from './rockforms';
import { lateralOffsets, snowDrift } from './terrain';

// Round 7: the light a place holds, staged. Three places were objects in an even light; here each gets the
// thing that lights it, drawn in the air and on the ground round the run:
//  - Ember's Caldera Leap: the flight crosses a caldera. Lava lies down both banks from the lip to the far
//    shelf (dark plates drifting on bright cracks, brightest at the heart of each field, pouring over the
//    cliff either side of the lip), a rim of broken basalt stands round it, embers rise through the flight
//    in depth and the banks light the snow, the rider and the smoke from below.
//  - Frostfang's Ice Cavern: the way out is a blade of rose-gold dawn, with light spilling in along the
//    floor and shafts fanning down from the mouth.
//  - Sakura's Thousand Torii: the sun comes through the gaps between the gates as slanting shafts and lies
//    on the snow as bars, so a rider passes from light to shade and back every four metres.
// Render only. Nothing here is a collider and nothing stands inside the limit the sim turns a sled back at:
// the lava starts past it, the bars and shafts are light. Low draws a designed cheap form of each (flat
// painted plates and no embers, the bars and the blade without the shafts).

type Tier = 'low' | 'medium' | 'high';

/** What Stages needs of a planned site (landmarks.ts Site). */
export interface StageSite {
  n: number;
  kind: Kind;
  z: number;
  len: number;
  clear: number;
  flown: boolean;
}

/** How far ahead a stage is made, and how far behind it is dropped. */
const MAKE_AHEAD = 420;
const DROP_BEHIND = 180;

/** Light added over the scene: vertex colours past white bloom; it thins into the fog. */
function beamMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uK: { value: 1 }, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      varying vec3 vC;
      varying vec3 vW;
      void main() {
        vC = color;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uK;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vC;
      varying vec3 vW;
      void main() {
        float fog = 1.0 - 0.8 * smoothstep(uFogNear, uFogFar, length(vW - cameraPosition));
        gl_FragColor = vec4(max(vC, 0.0) * uK * fog, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
}

/** Lava: plates of dark crust drifting down the fall line on bright cracks. `aHeat` is how near the heart
 *  of the field a point is: the cracks widen and the crust itself glows there. Low paints flat plates in
 *  two values and does not drift. */
function lavaMaterial(low: boolean): ShaderMaterial {
  return new ShaderMaterial({
    defines: low ? { LAVA_LOW: 1 } : {},
    uniforms: { uFlow: { value: 0 }, uFog: shared.uFog, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar, uFocus: shared.uFocus },
    vertexShader: /* glsl */ `
      attribute float aHeat;
      attribute float aCover;
      varying float vHeat;
      varying float vCover;
      varying vec3 vW;
      void main() {
        vHeat = aHeat;
        vCover = aCover;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFlow;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uFocus;
      varying float vHeat;
      varying float vCover;
      varying vec3 vW;
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }
      float vn(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash2(i).x, hash2(i + vec2(1.0, 0.0)).x, f.x), mix(hash2(i + vec2(0.0, 1.0)).x, hash2(i + vec2(1.0, 1.0)).x, f.x), f.y);
      }
      void main() {
        float heat = clamp(vHeat, 0.0, 1.0);
        // (Rivers of heat and rafts of crust, forty metres across: a field is never one even tiling.)
        heat = clamp(heat * (0.55 + 0.8 * vn(vW.xz * 0.045 + 3.7)), 0.0, 1.0);
        // (The fall line is world -z: the plates drift down it, the big ones slower than the small.)
        vec2 p = vec2(vW.x, vW.z + vW.y * 0.6) * 0.21;
        // (Basalt, not a hole: near the lens a near-black crust read as a void.)
    vec3 crust = mix(vec3(0.065, 0.03, 0.032), vec3(0.2, 0.035, 0.012), heat * heat * 0.6);
        #ifdef LAVA_LOW
          // The poster's lava: the same plates in two flat values, a dark crust and a line of fire between
          // them, in one pass over the cells and standing still (square cells in two values read as a
          // chequered floor).
          p += (vec2(vn(p * 0.31 + 1.3), vn(p * 0.31 + 8.7)) - 0.5) * 1.3;
          vec2 n = floor(p);
          vec2 f = fract(p);
          float f1 = 8.0;
          float f2 = 8.0;
          float id = 0.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash2(n + g);
              vec2 r = g + o - f;
              float d = dot(r, r);
              if (d < f1) { f2 = f1; f1 = d; id = o.x; } else if (d < f2) { f2 = d; }
            }
          }
          float edge = sqrt(f2) - sqrt(f1);
          // (As High's: most of a cool crust's cracks are a dark red seam, and what is lit is broken along
          // each crack; a lit yellow line round every cell read as a net laid on the floor.)
          float ln = vn(p * 0.9 + 11.0) * 0.55 + vn(p * 0.3 + 4.0) * 0.45;
          float live = smoothstep(0.52, 0.8, ln + heat * 0.6 - 0.1);
          float pool = step(1.0 - 0.3 * heat * heat, id);
          float hot = max(step(edge, mix(0.04, 0.2, heat * heat)), pool);
          vec3 fire = mix(vec3(1.15, 0.16, 0.03), vec3(1.9, 0.52, 0.08), heat);
          vec3 seam = mix(vec3(0.28, 0.03, 0.008), fire, max(live, pool));
          vec3 col = mix(crust * (0.7 + 0.6 * id), seam, hot);
        #else
          p.y += uFlow * 0.16;
          // (Warped, so the plates are rafts of every shape and size: unwarped, a cell field is a honeycomb.)
          p += (vec2(vn(p * 0.31 + 1.3), vn(p * 0.31 + 8.7)) - 0.5) * 1.3;
          vec2 n = floor(p);
          vec2 f = fract(p);
          float md = 8.0;
          vec2 mr = vec2(0.0);
          float id = 0.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 o = hash2(n + g);
              vec2 r = g + o - f;
              float d = dot(r, r);
              if (d < md) { md = d; mr = r; id = o.x; }
            }
          }
          // The distance to the plate's edge: the cracks.
          float ed = 8.0;
          for (int j = -1; j <= 1; j++) {
            for (int i = -1; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec2 r = g + hash2(n + g) - f;
              vec2 dr = r - mr;
              float l2 = dot(dr, dr);
              if (l2 > 0.0001) ed = min(ed, dot(0.5 * (mr + r), dr * inversesqrt(l2)));
            }
          }
          float breathe = 0.85 + 0.15 * sin(uFlow * 0.7 + id * 6.28);
          // The melt between the rafts: thin cracks at a cool shore, rivers between shrinking rafts toward
          // the heart, its width wandering along each crack. Near the heart some rafts have gone under.
          float w = mix(0.03, 0.3, heat * heat) * (0.6 + 0.8 * vn(p * 0.7 + 3.1)) * breathe;
          float gone = step(1.0 - 0.32 * heat * heat * heat, id);
          float crack = max(1.0 - smoothstep(w * 0.55, w, ed), gone);
          // Not every crack is live: across a cool crust most have dulled to a dark red seam, so the floor
          // is never a lit net (a net of even lines read as a grid laid on the ground).
          // (Broken along each crack too, so what is lit is a run of segments and never a whole cell's rim.)
          float ln = vn(p * 0.9 + 11.0) * 0.55 + vn(p * 0.3 + 4.0) * 0.45;
          float live = max(smoothstep(0.52, 0.82, ln + heat * 0.6 - 0.1), gone);
          // The melt itself: deep red to orange, streaked down the fall line, yellow only in the hottest
          // streaks (a sheet of yellow bloomed into a flat smear).
          float streak = vn(vec2(vW.x * 0.5, (vW.z + vW.y * 0.6) * 0.07 + uFlow * 0.05));
          vec3 melt = mix(vec3(0.95, 0.13, 0.02), vec3(1.75, 0.5, 0.07), smoothstep(0.15, 0.85, streak * 0.75 + heat * 0.45));
          melt = mix(melt, vec3(2.7, 1.3, 0.3), smoothstep(0.72, 1.0, streak) * heat * 0.8);
          // A crack's lip is darker red than its middle; a dulled crack is only its lip.
          float core = max(1.0 - smoothstep(0.0, w * 0.45, ed), gone);
          // (On a cool crust even a live crack is a dim one: at full heat the floor's net bloomed.)
          vec3 seam = mix(vec3(0.5, 0.05, 0.012), melt * mix(0.5, 1.0, smoothstep(0.25, 0.7, heat)), core * live);
          seam *= mix(0.28, 1.0, live);
          // The crust: dark rafts that redden toward a live edge (the heat under them shows at the rim).
          float halo = (1.0 - smoothstep(w, w + 0.14 + 0.12 * heat, ed)) * live;
          vec3 raft = mix(crust * (0.6 + 0.8 * id), vec3(0.4, 0.05, 0.012), halo * 0.6);
          vec3 col = mix(raft, seam, crack);
        #endif
        // A shore breaks along whole plates (the floor under the flight ends ragged, never on a ruled line).
        if (vCover < 0.999 && vCover < 0.22 + 0.6 * id) discard;
        // Whoever flies over it is marked on it: lava takes no cast shadow, and a flight needs its ground.
        vec2 dq = (vW.xz - uFocus.xz) * vec2(1.0, 0.8);
        float hgt = max(uFocus.y - vW.y, 0.0);
        float rad = 1.2 + hgt * 0.12;
        col *= 1.0 - (1.0 - smoothstep(rad * 0.45, rad, length(dq))) * 0.8 / (1.0 + hgt * 0.05) * step(hgt, 60.0);
        float fog = smoothstep(uFogNear, uFogFar, length(vW - cameraPosition));
        // (Lava shines through the haze: it takes a third of the air's fog, so the crust stays dark.)
        gl_FragColor = vec4(mix(col, uFog, fog * 0.35), 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
}

/** Embers: small hot sparks that rise off the lava through the flight, each on its own clock. */
function emberMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uFlow: { value: 0 }, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
    vertexShader: /* glsl */ `
      attribute vec3 aBase;
      attribute vec3 aSeed;
      uniform float uFlow;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying float vA;
      void main() {
        float t = fract(uFlow * (0.035 + 0.04 * aSeed.y) + aSeed.x);
        float rise = t * (26.0 + 22.0 * aSeed.z);
        vec3 c = aBase + vec3(sin(t * 9.0 + aSeed.x * 40.0) * (1.0 + 3.0 * t), rise, cos(t * 7.0 + aSeed.y * 31.0) * (1.0 + 2.0 * t));
        float size = (0.1 + 0.2 * aSeed.z) * (1.0 - 0.5 * t);
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float dist = length(c - cameraPosition);
        // (Never smaller than a pixel and a half at a distance: far embers hold as points of light.)
        size = max(size, dist * 0.0016);
        vec3 w = c + (right * position.x + up * position.y) * size;
        vUv = position.xy;
        float tw = 0.65 + 0.35 * sin(uFlow * (5.0 + 6.0 * aSeed.y) + aSeed.x * 60.0);
        vA = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.6, 1.0, t)) * tw * (1.0 - 0.7 * smoothstep(uFogNear, uFogFar, dist));
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vA;
      void main() {
        float r = dot(vUv, vUv);
        float a = (1.0 - smoothstep(0.15, 1.0, r)) * vA;
        gl_FragColor = vec4(vec3(3.2, 1.25, 0.28) * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

function hashf(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const driftBuf: [number, number] = [0, 0];

/** The drawn snow's height at sim (x, z): the ground a wall or a handover shapes, and the drifts the
 *  terrain lays past the treeline (terrain.ts). What lies on a bank lies on this. */
function snowY(c: Course, x: number, z: number): number {
  return visualGround(c, x, z) + snowDrift(x, z, c.edgeExcess(x, z), driftBuf)[0];
}

/** The terrain's own detail per tier (world.ts QUALITY): what lies on a steep bank is laid on the drawn
 *  chord between the terrain's columns, not on the true surface under it. */
const TERRAIN_DETAIL: Record<Tier, { inner: number; row: number; reach: number }> = {
  low: { inner: 1.6, row: 3, reach: 60 },
  medium: { inner: 1.1, row: 2.2, reach: 90 },
  high: { inner: 0.85, row: 2, reach: 110 },
};

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Coloured triangles for the beam material, in world space. */
class Beams {
  pos: number[] = [];
  col: number[] = [];
  /** A quad a-b-c-d (a to b one edge, d to c the opposite one) with a colour times a strength a corner. */
  quad(a: number[], b: number[], c: number[], d: number[], col: Color, ka: number, kb: number, kc: number, kd: number): void {
    const put = (p: number[], k: number) => {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(col.r * k, col.g * k, col.b * k);
    };
    put(a, ka);
    put(b, kb);
    put(c, kc);
    put(a, ka);
    put(c, kc);
    put(d, kd);
  }
  get triangles(): number {
    return this.pos.length / 9;
  }
  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    return g;
  }
}

/** Metres past the landing that the caldera's lava runs on down the banks: the landing is still the
 *  caldera (ended at the landing, the jaw-drop came down onto an empty slope). */
export const CALDERA_RUNOUT = 50;

const CALDERAS = new WeakMap<Course, Ledge | null>();

/** The Caldera Leap's ledge: Ember's second leap (sim/moments.ts: kind 'leap', nth 1), or null on any
 *  other mountain. The banks below it are kept clear of the forest for the lava (landmarks.ts
 *  SitePlan.clearings asks). */
export function calderaLedge(c: Course): Ledge | null {
  let l = CALDERAS.get(c);
  if (l !== undefined) return l;
  l = null;
  if (c.biome === 'volcanic') {
    let nth = 0;
    let last = null as unknown;
    for (let z = 0; z < c.finishZ && !l; z += 40) {
      const sec = c.section(z);
      if (sec === last) continue;
      last = sec;
      if (sec.kind === 'leap' && nth++ === 1) l = sec.ledges.find((q) => q.kind === 'leap') ?? null;
    }
  }
  CALDERAS.set(c, l);
  return l;
}

const RIVERS = new WeakMap<Course, Array<{ z0: number; z1: number; roof: boolean }>>();

/** Where Ember's walled places hold lava at the feet of their walls: the basalt slots and the roofed
 *  halls, from where the walls have risen to their end (empty on any other mountain). */
export function lavaRuns(c: Course): ReadonlyArray<{ z0: number; z1: number; roof: boolean }> {
  let out = RIVERS.get(c);
  if (out) return out;
  out = [];
  if (c.biome === 'volcanic') {
    let last = null as unknown;
    for (let z = 0; z < c.finishZ; z += 20) {
      const sec = c.section(z);
      if (sec === last) continue;
      last = sec;
      if (sec.kind === 'ravine' || sec.kind === 'tunnel') out.push({ z0: sec.z0 + sec.blend * 0.6, z1: sec.z1 - 8, roof: sec.kind === 'tunnel' });
    }
  }
  RIVERS.set(c, out);
  return out;
}

const PADDIES = new WeakMap<Course, Array<[number, number]>>();

/** Where Sakura's terraces hold paddies on their banks: the body of each `terraces` section, from the
 *  end of its blend to its foot (empty on any other mountain). The forest keeps off them (landmarks.ts
 *  SitePlan.clearings asks). */
export function paddySpans(c: Course): ReadonlyArray<[number, number]> {
  let out = PADDIES.get(c);
  if (out) return out;
  out = [];
  if (c.biome === 'blossom') {
    let last = null as unknown;
    for (let z = 0; z < c.finishZ; z += 20) {
      const sec = c.section(z);
      if (sec === last) continue;
      last = sec;
      if (sec.kind === 'terraces') out.push([sec.z0 + sec.blend * 0.5, sec.z1 - 6]);
    }
  }
  PADDIES.set(c, out);
  return out;
}

/** How far past the run's edge (its edge excess) the paddies start, and how wide each step is. */
export const PADDY_FROM = 4;
const PADDY_STEP = 8;

/** Still water in a paddy: the sky mirrored, darker straight down, the sun's glint in it, a slow shiver
 *  of wind over it (stopped under reduced motion: the clock it reads stops). */
function paddyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uFlow: { value: 0 },
      uSkyZenith: shared.uSkyZenith,
      uSkyHorizon: shared.uSkyHorizon,
      uSunColor: shared.uSunColor,
      uDiskDir: shared.uDiskDir,
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFlow;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSunColor;
      uniform vec3 uDiskDir;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec3 vW;
      void main() {
        vec3 d = cameraPosition - vW;
        float dist = max(length(d), 0.001);
        vec3 v = d / dist;
        // (A shiver of wind: the mirror's normal tips a little, in long bands.)
        float sh = sin(vW.x * 0.9 + vW.z * 0.35 + uFlow * 1.3) * sin(vW.z * 0.7 - uFlow * 0.9);
        vec3 n = normalize(vec3(sh * 0.025, 1.0, sh * 0.018));
        vec3 r = reflect(-v, n);
        vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.55, r.y));
        float f = 0.25 + 0.75 * pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
        // (Looking straight down it is the zenith, darkened: still water is never a hole.)
        vec3 col = mix(uSkyZenith * 0.5 + vec3(0.02, 0.03, 0.05), sky * 0.95, f);
        vec3 dd = normalize(uDiskDir);
        col += uSunColor * pow(max(dot(r, dd), 0.0), 120.0) * 1.6;
        float fog = smoothstep(uFogNear, uFogFar, dist);
        gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
        #include <colorspace_fragment>
      }
    `,
    // (The two banks mirror each other, so one is wound the other way round.)
    side: DoubleSide,
  });
}

interface Stage {
  key: string;
  z0: number;
  z1: number;
  root: Object3D;
  /** Per frame while the rider is near: its lights. */
  lights: ((z: number, t: number) => void) | null;
}

export class Stages {
  readonly root = new Object3D();
  /** Play-tests: what the stages in view draw. */
  readonly stats = { stages: 0, triangles: 0 };
  private made = new Map<string, Stage>();
  private beamMat = beamMaterial();
  private lavaMat: ShaderMaterial;
  private emberMat = emberMaterial();
  private paddyMat = paddyMaterial();
  private flow = 0;
  private lastT = 0;
  private caldera: Ledge | null = null;
  private cols: number[] | null = null;

  constructor(
    private course: Course,
    private palette: Palette,
    private tier: Tier,
    /** The set pieces' own toon material: the caldera's rim is rock like any other. */
    private rockMat: Material,
  ) {
    this.lavaMat = lavaMaterial(tier === 'low');
    this.find();
  }

  setCourse(course: Course, palette: Palette): void {
    this.course = course;
    this.palette = palette;
    this.clear();
    this.find();
  }

  setQuality(tier: Tier): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.lavaMat.dispose();
    this.lavaMat = lavaMaterial(tier === 'low');
    this.cols = null;
    this.clear();
  }

  private clear(): void {
    for (const s of this.made.values()) this.drop(s);
    this.made.clear();
  }

  private drop(s: Stage): void {
    this.root.remove(s.root);
    s.root.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }

  private find(): void {
    this.caldera = calderaLedge(this.course);
    this.cols = null;
  }

  /** The drawn snow's height at sim (x, z): the higher of the true surface and the terrain's chord
   *  between its two columns either side. At a wall's foot the chord stands well over the true surface
   *  (the rock climbs thirteen metres in four and a half), and laid on the surface the slots' lava was
   *  inside the drawn bank, unseen. */
  private drawnY(x: number, z: number): number {
    const c = this.course;
    const y = snowY(c, x, z);
    const offs = (this.cols ??= lateralOffsets(c, TERRAIN_DETAIL[this.tier]));
    const cx = c.centerX(z);
    const o = x - cx;
    if (o <= offs[0] || o >= offs[offs.length - 1]) return y;
    let i = 0;
    while (offs[i + 1] < o) i++;
    const a = offs[i];
    const b = offs[i + 1];
    const ya = snowY(c, cx + a, z);
    const yb = snowY(c, cx + b, z);
    return Math.max(y, ya + ((yb - ya) * (o - a)) / (b - a));
  }

  /**
   * Per frame. `z` is the rider's sim z, `time` the shared clock, `sites` the planned set pieces (the
   * cavern and the torii are found among them), `night` whether the mood is a night one (no sun to cut
   * into bars, and a paler dawn at the cavern's mouth).
   */
  update(z: number, time: number, sites: readonly StageSite[], night: boolean): void {
    const dt = Math.max(0, Math.min(0.1, time - this.lastT));
    this.lastT = time;
    // Reduced motion keeps the picture and stops the drift.
    if (!fx.reduced) this.flow += dt;
    this.lavaMat.uniforms.uFlow.value = this.flow;
    this.emberMat.uniforms.uFlow.value = this.flow;
    this.paddyMat.uniforms.uFlow.value = this.flow;
    const want = (key: string, z0: number, z1: number, make: () => Stage): void => {
      if (z < z0 - MAKE_AHEAD || z > z1 + DROP_BEHIND) return;
      if (!this.made.has(key)) {
        const s = make();
        this.made.set(key, s);
        this.root.add(s.root);
      }
    };
    const c = this.caldera;
    if (c) want('caldera', c.z - 30, c.land1 + CALDERA_RUNOUT + 14, () => this.makeCaldera(c));
    lavaRuns(this.course).forEach((r, i) => want('river' + i, r.z0, r.z1, () => this.makeRivers('river' + i, r.z0, r.z1, r.roof)));
    paddySpans(this.course).forEach(([a, b], i) => want('paddies' + i, a, b, () => this.makePaddies('paddies' + i, a, b)));
    for (const s of sites) {
      if (!s.flown || s.len <= 0) continue;
      if (s.kind === 'icetunnel' && s.clear > 0) want('mouth' + s.n, s.z - s.len, s.z + s.len, () => this.makeMouth(s, night));
      // Ember's lava tunnels: the far mouth is a hot disc and its heat spills in along the floor (Medium
      // and High; Low keeps the tunnel's own lava).
      else if (s.kind === 'lavatunnel' && s.clear > 0 && this.tier !== 'low') want('mouth' + s.n, s.z - s.len, s.z + s.len, () => this.makeMouth(s, night, true));
      else if (s.kind === 'toriirow' && !night) want('torii' + s.n, s.z - s.len, s.z + s.len, () => this.makeTorii(s));
    }
    let tris = 0;
    for (const [key, s] of this.made) {
      if (z < s.z0 - MAKE_AHEAD - 60 || z > s.z1 + DROP_BEHIND) {
        this.drop(s);
        this.made.delete(key);
        continue;
      }
      if (s.lights && z > s.z0 - 160 && z < s.z1 + 40) s.lights(z, time);
      s.root.traverse((o) => {
        const g = (o as Mesh).geometry;
        if (g) tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
      });
    }
    this.stats.stages = this.made.size;
    this.stats.triangles = tris;
  }

  // ------------------------------------------------------------------ Ember: the caldera

  private makeCaldera(l: Ledge): Stage {
    const c = this.course;
    const low = this.tier === 'low';
    const root = new Object3D();
    const zA = l.z - 10;
    const zB = l.land1 + CALDERA_RUNOUT;
    // Columns across a field, in metres from the centre line: the terrain's own outer columns (terrain.ts
    // lateralOffsets), so the lava lies on the drawn snow and not through it.
    const hwC = c.params.halfWidthStart + 2.6;
    const cols = (low ? [12, 16, 22, 30, 42, 58] : [11.5, 13, 14.5, 16, 18, 20, 22, 24.5, 27, 30, 34, 38, 42, 47, 52, 58]).map((s) => hwC + s);
    // Rows down the run, as close as the terrain's own: closer over the cliff, where the lava pours.
    const rows: number[] = [];
    for (let z = zA; z < zB; ) {
      rows.push(z);
      z += z > l.z - 2 && z < l.foot + 4 ? 1 : low ? 3 : 2;
    }
    rows.push(zB);
    const pos: number[] = [];
    const heat: number[] = [];
    const cover: number[] = [];
    const idx: number[] = [];
    // The caldera is a bowl: each field climbs from its near shore to the foot of the rim, so from the
    // run its lava faces the lens (lying on the bank it was a thin band seen edge on), and from the air
    // it is a lake with the flight down its middle.
    const LIFT = 11;
    const ends = (z: number): number => smooth(zA, zA + 24, z) * (1 - smooth(zB - 46, zB, z));
    const lift = (u: number, z: number): number => LIFT * Math.pow(Math.min(1, Math.max(0, u)), 1.5) * ends(z);
    // The floor under the flight: a crust over the lake, from the foot of the cliff to the far shelf's
    // shore. Dark plates on thin cracks where sleds cross it (a rider must read against it), hotter
    // toward the banks. The sim rides the same ground under it: a sled that lands short crosses crust.
    const zF0 = l.foot + 2;
    // (On past the landing face with the fields, so the whole of a fast flight is over lava: ended short
    // of the face's end, the flight's last second was over a tongue of snow, and ended at it, its ragged
    // last plates lay round a rider landed there like a hole.)
    const zF1 = l.land1 + CALDERA_RUNOUT - 2;
    /** Where a field starts and ends across the bank at z: outside the crowd's shoulder at the lip, from
     *  just past the limit below it, swelling to its widest under the middle of the flight. */
    const inner = (z: number, side: number): number => {
      const lim = c.edgeLimit(z) + 2;
      const past = smooth(l.z + 17, l.z + 30, z);
      const wob = 1.6 * Math.sin(z * 0.19 + side * 1.7) + 1.1 * Math.sin(z * 0.53 + side);
      return Math.max(lim, lim + (1 - past) * 24 + (wob + 1.2) * past);
    };
    const outer = (z: number, side: number): number => {
      const t = (z - zA) / (zB - zA);
      const swell = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.92 + 0.06))), 0.6);
      return Math.min(52, inner(z, side) + 9 + 30 * swell + 2.5 * Math.sin(z * 0.11 + side * 2.3));
    };
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      const n = cols.length;
      for (let r = 0; r < rows.length; r++) {
        const z = rows[r];
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        const e0 = inner(z, side);
        const e1 = outer(z, side);
        const along = smooth(zA, zA + 14, z) * (1 - smooth(zB - 40, zB, z));
        for (let k = 0; k < n; k++) {
          // The field's own edges cut the columns: the first and last are moved onto them. (Clamped only,
          // the first stood on the terrain's first column past the shore, and a strip of bare snow ran
          // between the floor and the field the length of the flight.)
          const e = k === 0 ? e0 : k === n - 1 ? e1 : Math.max(e0, Math.min(e1, cols[k] - hw));
          const x = cx + side * (hw + e);
          const u = e1 > e0 ? (e - e0) / (e1 - e0) : 0;
          pos.push(x, snowY(c, x, z) + 0.45 + lift(u, z), -z);
          // Brightest at the heart of the field, a cooled margin at both shores (where the floor joins
          // it, the near shore is the floor's own heat).
          const onFloor = smooth(zF0, zF0 + 8, z) * (1 - smooth(zF1 - 22, zF1, z));
          heat.push(Math.max(Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.7) * (0.35 + 0.65 * along), 0.34 * onFloor));
          cover.push(1);
        }
      }
      for (let r = 0; r + 1 < rows.length; r++) {
        for (let k = 0; k + 1 < n; k++) {
          const a = base + r * n + k;
          const b = a + 1;
          const d = a + n;
          const e = d + 1;
          if (side > 0) idx.push(a, d, b, b, d, e);
          else idx.push(a, b, d, b, e, d);
        }
      }
    }
    {
      // The floor, shore to shore across the run, on the drawn snow.
      // (Columns: the corridor's in the middle, then close ones out over each bank to the field's near
      // shore, where the field's first column stands. The bank's chord between them sags, so the floor
      // rides a little higher over it.)
      const mid = low ? 7 : 13;
      const wing = low ? 4 : 9;
      const n = mid + 2 * wing;
      const base = pos.length / 3;
      const frows = rows.filter((z) => z >= zF0 && z <= zF1);
      for (const z of frows) {
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        const xl = cx - (hw + inner(z, -1));
        const xr = cx + (hw + inner(z, 1));
        const cv = smooth(zF0, zF0 + 8, z) * (1 - smooth(zF1 - 22, zF1, z));
        const el = cx - (hw + 1);
        const er = cx + (hw + 1);
        for (let k = 0; k < n; k++) {
          let x: number;
          let out = 0;
          if (k < wing) {
            out = 1 - k / wing;
            x = el + (xl - el) * out;
          } else if (k >= wing + mid) {
            out = (k - wing - mid + 1) / wing;
            x = er + (xr - er) * out;
          } else x = el + ((er - el) * (k - wing)) / (mid - 1);
          pos.push(x, snowY(c, x, z) + (low ? 0.3 : 0.16) + (out > 0 ? 0.3 + 0.25 * out : 0), -z);
          heat.push(0.2 + 0.14 * out);
          cover.push(cv);
        }
      }
      for (let r = 0; r + 1 < frows.length; r++) {
        for (let k = 0; k + 1 < n; k++) {
          const a = base + r * n + k;
          idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
        }
      }
    }
    const lg = new BufferGeometry();
    lg.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    lg.setAttribute('aHeat', new BufferAttribute(new Float32Array(heat), 1));
    lg.setAttribute('aCover', new BufferAttribute(new Float32Array(cover), 1));
    lg.setIndex(idx);
    const lava = new Mesh(lg, this.lavaMat);
    lava.frustumCulled = false;
    root.add(lava);

    // The rim: broken basalt along each field's far shore, tall enough to stand black against the deck,
    // and a low kerb of stubs along its near shore, past the limit.
    const f = new Facets();
    const t = basaltTones(this.palette);
    let seedN = (c.seed ^ 0x5ca1) >>> 0;
    const rnd = (): number => {
      seedN = (Math.imul(seedN, 1664525) + 1013904223) >>> 0;
      return seedN / 4294967296;
    };
    for (const side of [-1, 1]) {
      for (let z = l.z + 20; z < zB; z += low ? 7.5 : 3.1) {
        const zz = z + (rnd() - 0.5) * 1.6;
        const cx = c.centerX(zz);
        const hw = c.halfWidth(zz);
        const e = outer(zz, side) + 0.6 + rnd() * 2.4;
        const x = cx + side * (hw + e);
        const gy = snowY(c, x, zz);
        // (The rim is the caldera's wall: it stands on the lifted shore, organ pipes of uneven height.)
        const up = lift(1, zz);
        const h = (low ? 5 : 3.6) + rnd() * 7 + (rnd() < 0.25 ? 6 : 0);
        const a = rnd() * 6.28;
        const k = rnd() * 0.5;
        columnInto(f, { x, z: -zz, y: gy - 1.5, r: (low ? 2.3 : 1.7) * (0.85 + 0.4 * rnd()), h: h + up + 1.5, foot: 0, yaw: rnd(), slant: [Math.cos(a) * k, Math.sin(a) * k], col: t.rock[rnd() < 0.5 ? 0 : 1], top: rnd() < 0.5 ? ASH_TOP : null, broke: t.broke, drums: low ? 1 : 2 }, rnd);
      }
      if (!low) {
        for (let z = l.z + 32; z < zB - 6; z += 4.6) {
          if (rnd() < 0.25) continue;
          const zz = z + (rnd() - 0.5) * 2;
          const cx = c.centerX(zz);
          const hw = c.halfWidth(zz);
          const x = cx + side * (hw + inner(zz, side) - 0.5 - rnd() * 0.9);
          const gy = snowY(c, x, zz);
          columnInto(f, { x, z: -zz, y: gy - 1, r: 0.75 + rnd() * 0.3, h: 1.5 + rnd() * 1.3, foot: 0, yaw: rnd(), slant: [(rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.8], col: t.rock[0], top: null, broke: t.broke }, rnd);
        }
      }
    }
    const rim = new Mesh(f.build(), this.rockMat);
    rim.frustumCulled = false;
    root.add(rim);

    // Embers off both fields and, thinner, over the run between them (Medium and High).
    const count = this.tier === 'high' ? 420 : this.tier === 'medium' ? 200 : 0;
    if (count > 0) {
      const corner = new Float32Array(count * 12);
      const bases = new Float32Array(count * 12);
      const seeds = new Float32Array(count * 12);
      const eidx: number[] = [];
      for (let i = 0; i < count; i++) {
        const z = l.z + 4 + rnd() * (zB - l.z - 10);
        const side = rnd() < 0.5 ? -1 : 1;
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        // (Nearly half rise through the flight itself, off the floor: embers in depth, before and behind the rider.)
        const onRun = rnd() < 0.45 && z > zF0 && z < zF1;
        const e = onRun ? -hw * rnd() : inner(z, side) + rnd() * Math.max(1, outer(z, side) - inner(z, side));
        const x = cx + side * (hw + e);
        const y = snowY(c, x, z) + 0.5 + (onRun ? 0 : lift((e - inner(z, side)) / Math.max(1, outer(z, side) - inner(z, side)), z));
        const s0 = rnd();
        const s1 = rnd();
        const s2 = rnd();
        for (let j = 0; j < 4; j++) {
          const o = (i * 4 + j) * 3;
          corner[o] = j === 0 || j === 3 ? -1 : 1;
          corner[o + 1] = j < 2 ? -1 : 1;
          bases[o] = x;
          bases[o + 1] = y;
          bases[o + 2] = -z;
          seeds[o] = s0;
          seeds[o + 1] = s1;
          seeds[o + 2] = s2;
        }
        eidx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
      }
      const eg = new BufferGeometry();
      eg.setAttribute('position', new BufferAttribute(corner, 3));
      eg.setAttribute('aBase', new BufferAttribute(bases, 3));
      eg.setAttribute('aSeed', new BufferAttribute(seeds, 3));
      eg.setIndex(eidx);
      const embers = new Mesh(eg, this.emberMat);
      embers.frustumCulled = false;
      embers.renderOrder = 4;
      root.add(embers);
    }

    // The glow over each field: a sheet of light standing in the air above the lava's heart, so the smoke
    // and the far bank take the lava's colour (Low keeps it: it is two quads).
    const b = new Beams();
    const glow = new Color(1, 0.3, 0.06);
    for (const side of [-1, 1]) {
      for (let z = l.z + 26; z < zB - 30; z += 34) {
        const z2 = Math.min(zB - 8, z + 34);
        const p = (zz: number, up: number): number[] => {
          const cx = c.centerX(zz);
          const hw = c.halfWidth(zz);
          const e = (inner(zz, side) + outer(zz, side)) / 2;
          const x = cx + side * (hw + e + up * 0.35);
          return [x, snowY(c, x, zz) + 0.7 + up + lift(0.5, zz), -zz];
        };
        // (Faint: at half strength the sheets joined into one flat orange band across the frame.)
        const k = 0.2;
        // (Tall enough to stand over the lip from the run-in: the bowl announces itself before the leap.)
        b.quad(p(z, 0), p(z2, 0), p(z2, 26), p(z, 26), glow, k, k, 0, 0);
      }
    }
    const haze = new Mesh(b.build(), this.beamMat);
    haze.frustumCulled = false;
    haze.renderOrder = 3;
    root.add(haze);

    const lights = (z: number, time: number): void => {
      // The banks light the run from both sides and below, a little ahead of the rider, breathing.
      const zl = Math.max(l.z + 22, Math.min(zB - 12, z + 12));
      for (const side of [-1, 1]) {
        if (low && side > 0) continue;
        const cx = c.centerX(zl);
        const x = cx + side * (c.halfWidth(zl) + (inner(zl, side) + outer(zl, side)) / 2);
        const br = 0.9 + 0.12 * Math.sin(time * 1.3 + side);
        pushLocalLight(x, snowY(c, x, zl) + 2.2 + lift(0.5, zl), -zl, 1, 0.33, 0.07, 46, 1.25 * br);
      }
      // The floor lights whoever is over it from underneath.
      if (!low && z > zF0 - 30 && z < zF1 + 10) {
        const zf = Math.max(zF0, Math.min(zF1, z + 3));
        const cx = c.centerX(zf);
        pushLocalLight(cx, snowY(c, cx, zf) + 0.8, -zf, 1, 0.36, 0.08, 30, 1.1 + 0.12 * Math.sin(time * 1.7));
      }
    };
    return { key: 'caldera', z0: zA, z1: zB, root, lights };
  }

  // ------------------------------------------------------------------ Ember: lava at the walls' feet

  /** The basalt slots and the halls: a river of lava along the foot of each wall, in runs with dark
   *  ground between them, a breath of its light standing up the rock over it, and (in the open slots)
   *  organ pipes of basalt against the wall behind it. It lies past the limit, on the wall's own foot,
   *  so it faces the lens. The pools of light on the snow beside it are terrain.ts's ground lights. */
  private makeRivers(key: string, z0: number, z1: number, roof: boolean): Stage {
    const c = this.course;
    const low = this.tier === 'low';
    const root = new Object3D();
    const pos: number[] = [];
    const heat: number[] = [];
    const cover: number[] = [];
    const idx: number[] = [];
    const step = low ? 4 : 2;
    const b = new Beams();
    const glow = new Color(1, 0.3, 0.06);
    /** How much of a river runs at z on a side (0 where the ground between two runs is dark). */
    const runs = (z: number, side: number): number => smooth(0.4, 0.56, vnoise2(z * 0.021, side * 3.3, 31)) * smooth(z0, z0 + 16, z) * (1 - smooth(z1 - 16, z1, z));
    const ACROSS = [0, 0.3, 0.68, 1];
    // (A crusted seam with live cracks, not open melt: a three-metre band of melt read as a neon strip.)
    const HEAT = roof ? [0.3, 0.6, 0.55, 0.25] : [0.4, 0.8, 0.72, 0.3];
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      let rows = 0;
      for (let z = z0; z <= z1; z += step, rows++) {
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        const lim = c.edgeLimit(z);
        const k = runs(z, side);
        // (The rock climbs thirteen metres in its first four and a half: a metre and a bit of the wall's
        // foot is a band of lava three metres high, facing the lens.)
        const w = 1.0 + 0.5 * vnoise2(z * 0.09, side * 5.1, 17);
        for (let j = 0; j < 4; j++) {
          const x = cx + side * (hw + lim - 0.25 + w * ACROSS[j]);
          pos.push(x, this.drawnY(x, z) + 0.4, -z);
          heat.push(HEAT[j] * (0.55 + 0.45 * k));
          cover.push(Math.min(0.99, k));
        }
        // Its light up the wall, every few metres of a run.
        // (Not on Low: the tier draws the river and nothing more beside it.)
        if (!low && k > 0.5 && rows % 4 === 0) {
          const zb = Math.min(z1, z + step * 4);
          const p = (zz: number, up: number): number[] => {
            const x = c.centerX(zz) + side * (c.halfWidth(zz) + c.edgeLimit(zz) - 0.6);
            return [x, this.drawnY(x, zz) + 0.3 + up, -zz];
          };
          // (Faint: at a third it stood up the wall as a sheet of flame.)
          const s = 0.1 * k;
          b.quad(p(z, 0), p(zb, 0), p(zb, 4.5), p(z, 4.5), glow, s, s, 0, 0);
        }
      }
      for (let r = 0; r + 1 < rows; r++) {
        for (let j = 0; j < 3; j++) {
          const a = base + r * 4 + j;
          idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
        }
      }
    }
    const lg = new BufferGeometry();
    lg.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    lg.setAttribute('aHeat', new BufferAttribute(new Float32Array(heat), 1));
    lg.setAttribute('aCover', new BufferAttribute(new Float32Array(cover), 1));
    lg.setIndex(idx);
    // (Each piece of a river is still and long: culled, the one made ahead or left behind costs nothing.)
    const lava = new Mesh(lg, this.lavaMat);
    root.add(lava);
    if (!low) {
      const haze = new Mesh(b.build(), this.beamMat);
      haze.renderOrder = 3;
      root.add(haze);
    }
    if (!roof && !low) {
      // Organ pipes against the walls, in stands with bare wall between them.
      const f = new Facets();
      const t = basaltTones(this.palette);
      let seedN = (c.seed ^ Math.imul(Math.round(z0), 0x9e37)) >>> 0;
      const rnd = (): number => {
        seedN = (Math.imul(seedN, 1664525) + 1013904223) >>> 0;
        return seedN / 4294967296;
      };
      for (const side of [-1, 1]) {
        for (let z = z0 + 6; z < z1 - 6; z += 2.7) {
          const stand = vnoise2(z * 0.034, side * 2.1, 53);
          if (stand < 0.45) continue;
          const zz = z + (rnd() - 0.5) * 1.2;
          const e = c.halfWidth(zz) + c.edgeLimit(zz);
          // (They stand in the river at the wall's foot, against its face, footed on the drawn rock where
          // they stand: footed on the river's line, a metre in, the steep face buried them whole.)
          const x = c.centerX(zz) + side * (e + 0.7 + rnd() * 0.6);
          const gy = this.drawnY(x, zz) + 0.5;
          const h = 8 + 10 * (stand - 0.45) / 0.55 + rnd() * 4;
          columnInto(f, { x, z: -zz, y: gy - 2, r: 1.15 * (0.85 + 0.4 * rnd()), h: h + 2, foot: 0, yaw: rnd(), slant: [(rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3], col: t.rock[rnd() < 0.5 ? 0 : 1], top: rnd() < 0.4 ? ASH_TOP : null, broke: t.broke, drums: 2 }, rnd);
        }
      }
      root.add(new Mesh(f.build(), this.rockMat));
    }
    return { key, z0, z1, root, lights: null };
  }

  // ------------------------------------------------------------------ Sakura: the flooded terraces

  /** Petal Steps' banks as paddies: level steps of still water up each wall, each held by a bund of
   *  earth capped with snow, cut into cells down the fall line so each holds its own level. From the run
   *  they read as a stair of snow-capped rims up the banks; from the air the water mirrors the sky. Low
   *  keeps three steps in longer cells. */
  private makePaddies(key: string, z0: number, z1: number): Stage {
    const c = this.course;
    const low = this.tier === 'low';
    const root = new Object3D();
    const levels = low ? 3 : this.tier === 'medium' ? 4 : 5;
    const L = low ? 16 : 11;
    const S = low ? 2 : 3;
    const pos: number[] = [];
    const f = new Facets();
    const bund = new Color('#8A7484');
    const cap = new Color('#F4EEF4');
    const at = (side: number, e: number, z: number, y?: number): [number, number, number] => {
      const x = c.centerX(z) + side * (c.halfWidth(z) + e);
      return [x, y ?? snowY(c, x, z), -z];
    };
    for (const side of [-1, 1]) {
      for (let za = z0; za < z1 - 4; za += L) {
        const zb = Math.min(z1, za + L);
        const zm = (za + zb) / 2;
        const e0 = c.edgeLimit(zm) + PADDY_FROM;
        for (let k = 0; k < levels; k++) {
          const ea = e0 + k * PADDY_STEP;
          const eb = ea + PADDY_STEP;
          // The water stands just under the ground at the next bund's foot, so it fills the step.
          const H = at(side, eb, zm)[1] - 0.3;
          // (A step whose ground already stands over the water at its inner edge has no water to hold.)
          if (at(side, ea, za)[1] > H && at(side, ea, zb)[1] > H) continue;
          const q = (e: number, z: number): number[] => at(side, e, z, H);
          const a = q(ea, za);
          const b = q(eb + 1.5, za);
          const cc = q(eb + 1.5, zb);
          const d = q(ea, zb);
          pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
          // The bund along the inner edge: a face of earth from the snow up to just over the water,
          // with a cap of snow along its top, the rim that catches the light.
          const top = H + 0.25;
          const out: [number, number, number] = [-side, 0, 0];
          for (let s = 0; s < S; s++) {
            const zA = za + ((zb - za) * s) / S;
            const zB = za + ((zb - za) * (s + 1)) / S;
            const gA = at(side, ea, zA)[1];
            const gB = at(side, ea, zB)[1];
            if (gA < top || gB < top) f.quad(at(side, ea, zA, Math.min(gA, top) - 0.4), at(side, ea, zB, Math.min(gB, top) - 0.4), at(side, ea, zB, top), at(side, ea, zA, top), bund, out, 0.8, 1);
            f.quad(at(side, ea - 0.25, zA, top + 0.12), at(side, ea - 0.25, zB, top + 0.12), at(side, ea + 0.5, zB, top + 0.12), at(side, ea + 0.5, zA, top + 0.12), cap, [0, 1, 0]);
          }
          // The cross bunds at the cell's ends (Medium and High): earth from the snow to the rim.
          if (!low) {
            for (const [z, dir] of [[za, 1], [zb, -1]] as const) {
              const n = 3;
              for (let s = 0; s < n; s++) {
                const eA = ea + ((eb - ea) * s) / n;
                const eB = ea + ((eb - ea) * (s + 1)) / n;
                const gA = at(side, eA, z)[1];
                const gB = at(side, eB, z)[1];
                if (gA >= top && gB >= top) continue;
                f.quad(at(side, eA, z, Math.min(gA, top) - 0.4), at(side, eB, z, Math.min(gB, top) - 0.4), at(side, eB, z, top), at(side, eA, z, top), bund, [0, 0, -dir], 0.8, 1);
                f.quad(at(side, eA, z - 0.2, top + 0.1), at(side, eB, z - 0.2, top + 0.1), at(side, eB, z + 0.2, top + 0.1), at(side, eA, z + 0.2, top + 0.1), cap, [0, 1, 0]);
              }
            }
          }
        }
      }
    }
    const wg = new BufferGeometry();
    wg.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    const water = new Mesh(wg, this.paddyMat);
    water.frustumCulled = false;
    root.add(water);
    const rims = new Mesh(f.build(), this.rockMat);
    rims.frustumCulled = false;
    root.add(rims);
    return { key, z0, z1, root, lights: null };
  }

  // ------------------------------------------------------------------ Frostfang: the cavern's mouth

  private makeMouth(s: StageSite, night: boolean, forge = false): Stage {
    const c = this.course;
    const low = this.tier === 'low';
    const root = new Object3D();
    const b = new Beams();
    const end = s.z + s.len;
    // (Saturated: added over blue ice, a paler warm turns to lilac.)
    // (A forge's mouth is the fire's own colour, deeper than a dawn, and a little fainter: it is lit by
    // the lava beyond it, not by a sun.)
    const dawn = forge ? new Color(1.0, 0.3, 0.06) : night ? new Color(0.5, 0.62, 1.0) : new Color(1.0, 0.42, 0.26);
    const gold = forge ? new Color(1.0, 0.4, 0.1) : night ? new Color(0.7, 0.8, 1.0) : new Color(1.0, 0.62, 0.22);
    const k0 = forge ? 0.8 : night ? 0.5 : 1;
    const at = (z: number, off: number, up: number): number[] => {
      const x = c.centerX(z) + off;
      return [x, c.ground(x, z) + up, -z];
    };
    const hwE = c.halfWidth(end) + c.edgeLimit(end);
    // The blade on the floor: dawn spilling in along the snow from the mouth, widest and brightest there.
    const REACH = 62;
    const N = low ? 4 : 8;
    for (let i = 0; i < N; i++) {
      const za = end - REACH * (1 - i / N);
      const zb = end - REACH * (1 - (i + 1) / N);
      const wa = 0.6 + hwE * 0.7 * Math.pow(i / N, 1.5);
      const wb = 0.6 + hwE * 0.7 * Math.pow((i + 1) / N, 1.5);
      const ka = 0.6 * Math.pow(i / N, 1.4) * k0;
      const kb = 0.6 * Math.pow((i + 1) / N, 1.4) * k0;
      for (const sd of [-1, 1]) {
        b.quad(at(za, 0, 0.12), at(zb, 0, 0.12), at(zb, sd * wb, 0.12 + (wb > c.halfWidth(zb) ? 0.5 : 0)), at(za, sd * wa, 0.12), gold, ka, kb, 0, 0);
      }
    }
    // The mouth itself: a veil of rose-gold standing in the opening, brightest low down where the sun is.
    const H = Math.max(12, s.clear - 2);
    for (const sd of [-1, 1]) {
      b.quad(at(end + 2, 0, 0), at(end + 2, sd * hwE, 0), at(end + 2, sd * hwE * 0.8, H), at(end + 2, 0, H), dawn, 1.5 * k0, 0.5 * k0, 0, 0.35 * k0);
    }
    // Shafts: sheets of light fanning down from the top of the mouth to the floor inside (Medium and High).
    if (!low) {
      const fan: Array<[number, number, number, number]> = [
        [-0.55, 3.2, 44, 0.5],
        [-0.12, 2.4, 58, 0.42],
        [0.3, 3.6, 38, 0.5],
        [0.66, 2.2, 50, 0.36],
        [-0.82, 1.8, 30, 0.34],
      ];
      for (const [u, w, reach, k] of fan) {
        const x1 = u * hwE * 0.9;
        const x0 = u * hwE * 0.7;
        const top = H * (0.72 + 0.2 * Math.abs(u));
        const kk = k * k0;
        b.quad(at(end + 1, x0 - w * 0.4, top), at(end + 1, x0 + w * 0.4, top), at(end - reach, x1 + w, 0.3), at(end - reach, x1 - w, 0.3), dawn, kk, kk, 0, 0);
      }
    }
    const mesh = new Mesh(b.build(), this.beamMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    root.add(mesh);
    const lights = (z: number): void => {
      // The dawn reaches in: one warm light inside the mouth, on the floor, the walls and whoever rides out.
      if (z < end - 150 || z > end + 20) return;
      const zl = end - 16;
      const x = c.centerX(zl);
      pushLocalLight(x, c.ground(x, zl) + 5, -zl, dawn.r, dawn.g, dawn.b, 44, 0.9 * k0);
    };
    return { key: 'mouth' + s.n, z0: s.z - s.len, z1: end, root, lights };
  }

  // ------------------------------------------------------------------ Sakura: the torii's bars of light

  private makeTorii(s: StageSite): Stage {
    const c = this.course;
    const low = this.tier === 'low';
    const root = new Object3D();
    const b = new Beams();
    const a = s.z - s.len;
    const n = Math.max(1, Math.round((2 * s.len) / 4.2));
    const step = (2 * s.len) / n;
    // The side the sun stands on (the gates' shadows fall away from it).
    const sun = this.palette.sunDir.x >= 0 ? 1 : -1;
    const warm = new Color(1.0, 0.8, 0.56);
    const at = (z: number, off: number, up: number): number[] => {
      const x = c.centerX(z) + off;
      return [x, c.ground(x, z) + up, -z];
    };
    for (let i = 1; i < n; i++) {
      // A gap between two gates: the bar lies across the snow under it, a touch down-sun of the gap.
      const z = a + i * step;
      const hw = c.halfWidth(z) + Math.min(3, c.edgeLimit(z));
      const k = (0.3 + 0.3 * hashf(s.n * 31 + 7, i)) * smooth(0, 3, i) * smooth(0, 3, n - i);
      const W = step * 0.3;
      const M = low ? 3 : 6;
      for (let j = 0; j < M; j++) {
        const xa = -hw + (2 * hw * j) / M;
        const xb = -hw + (2 * hw * (j + 1)) / M;
        // (Brighter toward the sun's side: the light comes in low across the run.)
        const ka = k * (0.55 + 0.45 * (sun * xa * 0.5) / hw + 0.225);
        const kb = k * (0.55 + 0.45 * (sun * xb * 0.5) / hw + 0.225);
        b.quad(at(z - W, xa, 0.1), at(z - W, xb, 0.1), at(z, xb, 0.1), at(z, xa, 0.1), warm, 0, 0, kb, ka);
        b.quad(at(z, xa, 0.1), at(z, xb, 0.1), at(z + W, xb, 0.1), at(z + W, xa, 0.1), warm, ka, kb, 0, 0);
      }
      // The shaft that lays it: a sheet of light slanting down from between the posts on the sun's side
      // to the snow on the far side (Medium and High; every gap on High, every second on Medium).
      if (!low && (this.tier === 'high' || i % 2 === 0)) {
        const top = Math.min(13, Math.max(9, s.clear - 1));
        const ks = k * 0.62;
        const x0 = sun * (hw + 1.2);
        const x1 = -sun * hw * 0.82;
        b.quad(at(z - W * 0.8, x0, top), at(z + W * 0.8, x0, top), at(z + W * 1.2, x1, 0.2), at(z - W * 1.2, x1, 0.2), warm, ks, ks, ks * 0.25, ks * 0.25);
      }
    }
    // The far end: the day beyond the last gate, a veil of it standing in the way out.
    const end = s.z + s.len;
    const hwE = c.halfWidth(end) + c.edgeLimit(end);
    const H = Math.max(10, s.clear);
    for (const sd of [-1, 1]) b.quad(at(end + 1.5, 0, 0), at(end + 1.5, sd * hwE, 0), at(end + 1.5, sd * hwE, H), at(end + 1.5, 0, H), warm, 0.6, 0.3, 0.1, 0.3);
    const mesh = new Mesh(b.build(), this.beamMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    root.add(mesh);
    return { key: 'torii' + s.n, z0: a, z1: end, root, lights: null };
  }
}
