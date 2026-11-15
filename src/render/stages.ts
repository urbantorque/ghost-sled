import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Material, Mesh, Object3D, ShaderMaterial } from 'three';
import { Course, type Ledge } from '../sim/course';
import { ASH_TOP, basaltTones } from './flora';
import { fx } from './fxhub';
import { visualGround } from './ground';
import type { Kind } from './landmarkKit';
import { pushLocalLight } from './lights';
import { shared } from './materials';
import { Palette } from './palette';
import { Facets, columnInto } from './rockforms';
import { snowDrift } from './terrain';

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

/** Light added over the scene: vertex colours past white bloom; it thins into the fog. `near` makes it
 *  thin out close to the lens too (sheets of light in the air: met at the lens, a sheet is a flat pale
 *  card over the whole frame). */
function beamMaterial(near = false): ShaderMaterial {
  return new ShaderMaterial({
    defines: near ? { NEAR_FADE: 1 } : {},
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
        #ifdef NEAR_FADE
          fog *= smoothstep(6.0, 30.0, length(vW - cameraPosition));
        #endif
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
    uniforms: { uFlow: { value: 0 }, uFog: shared.uFog, uFogNear: shared.uFogNear, uFogFar: shared.uFogFar },
    vertexShader: /* glsl */ `
      attribute float aHeat;
      varying float vHeat;
      varying vec3 vW;
      void main() {
        vHeat = aHeat;
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
      varying float vHeat;
      varying vec3 vW;
      vec2 hash2(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }
      void main() {
        float heat = clamp(vHeat, 0.0, 1.0);
        // (The fall line is world -z: the plates drift down it, the big ones slower than the small.)
        vec2 p = vec2(vW.x, vW.z + vW.y * 0.6) * 0.21;
        vec3 crust = mix(vec3(0.016, 0.01, 0.014), vec3(0.2, 0.035, 0.012), heat * heat * 0.6);
        #ifdef LAVA_LOW
          vec2 c = floor(p * 0.8);
          float pick = hash2(c).x;
          float hot = step(1.0 - 0.55 * heat, pick);
          vec3 col = mix(crust, vec3(2.2, 0.62, 0.1), hot);
        #else
          p.y += uFlow * 0.16;
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
          float w = mix(0.03, 0.17, heat * heat) * breathe;
          float crack = 1.0 - smoothstep(0.0, w, ed);
          // A plate near the heart is thin: it glows through, and some are not crust at all.
          float thin = heat * heat * smoothstep(0.72, 1.0, id + heat * 0.3);
          vec3 hotc = mix(vec3(1.9, 0.42, 0.05), vec3(3.4, 1.9, 0.5), crack * crack * (0.4 + 0.6 * heat));
          vec3 col = mix(crust * (0.6 + 0.8 * id), hotc, max(crack, thin * 0.7));
        #endif
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
        // (A painted mirror: it holds the horizon's colour well up the reflection, so a flat seen from
        // the air is the morning's peach going to blue, not one tile of zenith.)
        vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.75, r.y));
        float f = 0.25 + 0.75 * pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
        // (Looking straight down it is the sky a step deeper: still water is never a hole, and never
        // darker than the shade on the snow beside it.)
        // (Seen from above it is the zenith, a step deeper and with its colour pushed: grey water is a
        // roof tile. The mist lies on it half as thick as on the snow, so a far flat stays blue.)
        vec3 deep = mix(uSkyZenith, sky, 0.2);
        deep = mix(vec3(dot(deep, vec3(0.3, 0.59, 0.11))), deep, 1.6) * 0.8;
        // (A painted mirror holds more of the sky over it than glass would: the flats are the zenith's blue
        // going to peach at their far edge, so a step of water never reads as a step of snow.)
        vec3 col = mix(deep, sky * 0.98, f * 0.4);
        vec3 dd = normalize(uDiskDir);
        float gl = max(dot(r, dd), 0.0);
        // The sun finds the flats one by one: a soft sheen round a hot core. (Narrow: a wide sheen turned
        // every flat on the sun's side to one white slab.)
        col += uSunColor * (pow(gl, 260.0) * 2.2 + pow(gl, 40.0) * 0.22);
        float fog = smoothstep(uFogNear, uFogFar, dist) * 0.35;
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
  private airMat = beamMaterial(true);
  private lavaMat: ShaderMaterial;
  private emberMat = emberMaterial();
  private paddyMat = paddyMaterial();
  private flow = 0;
  private lastT = 0;
  private caldera: Ledge | null = null;

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
    if (c) want('caldera', c.z - 30, c.land1 + 20, () => this.makeCaldera(c));
    paddySpans(this.course).forEach(([a, b], i) => want('paddies' + i, a, b, () => this.makePaddies('paddies' + i, a, b)));
    for (const s of sites) {
      if (!s.flown || s.len <= 0) continue;
      if (s.kind === 'icetunnel' && s.clear > 0) want('mouth' + s.n, s.z - s.len, s.z + s.len, () => this.makeMouth(s, night));
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
    const zB = l.land1 + 6;
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
    const idx: number[] = [];
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
          // The field's own edges cut the columns: the first and last are moved onto them.
          const e = Math.max(e0, Math.min(e1, cols[k] - hw));
          const x = cx + side * (hw + e);
          pos.push(x, snowY(c, x, z) + 0.45, -z);
          const u = e1 > e0 ? (e - e0) / (e1 - e0) : 0;
          // Brightest at the heart of the field, a cooled margin at both shores.
          heat.push(Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.7) * (0.35 + 0.65 * along));
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
    const lg = new BufferGeometry();
    lg.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    lg.setAttribute('aHeat', new BufferAttribute(new Float32Array(heat), 1));
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
      for (let z = l.z + 20; z < zB; z += low ? 7.5 : 3.4) {
        const zz = z + (rnd() - 0.5) * 1.6;
        const cx = c.centerX(zz);
        const hw = c.halfWidth(zz);
        const e = outer(zz, side) + 0.6 + rnd() * 2.4;
        const x = cx + side * (hw + e);
        const gy = snowY(c, x, zz);
        const h = (low ? 4 : 2.6) + rnd() * 5.5 + (rnd() < 0.2 ? 4 : 0);
        const a = rnd() * 6.28;
        const k = rnd() * 0.5;
        columnInto(f, { x, z: -zz, y: gy - 1.5, r: (low ? 1.9 : 1.25) * (0.85 + 0.4 * rnd()), h: h + 1.5, foot: 0, yaw: rnd(), slant: [Math.cos(a) * k, Math.sin(a) * k], col: t.rock[rnd() < 0.5 ? 0 : 1], top: rnd() < 0.5 ? ASH_TOP : null, broke: t.broke, drums: low ? 1 : 2 }, rnd);
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
    const count = this.tier === 'high' ? 260 : this.tier === 'medium' ? 130 : 0;
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
        const onRun = rnd() < 0.22;
        const e = onRun ? -hw * rnd() : inner(z, side) + rnd() * Math.max(1, outer(z, side) - inner(z, side));
        const x = cx + side * (hw + e);
        const y = snowY(c, x, z) + 0.5;
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
          return [x, snowY(c, x, zz) + 0.7 + up, -zz];
        };
        const k = 0.5;
        b.quad(p(z, 0), p(z2, 0), p(z2, 15), p(z, 15), glow, k, k, 0, 0);
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
        pushLocalLight(x, snowY(c, x, zl) + 2.2, -zl, 1, 0.33, 0.07, 46, 1.25 * br);
      }
    };
    return { key: 'caldera', z0: zA, z1: zB, root, lights };
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
    const bund = new Color('#4A2C44');
    // (The bund's top is wet earth, a step lighter than its face: capped with snow, the steps were a grid
    // of white rails and the water between them read as pale slabs.)
    const cap = new Color('#6A4256');
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

  private makeMouth(s: StageSite, night: boolean): Stage {
    const c = this.course;
    const low = this.tier === 'low';
    const root = new Object3D();
    const b = new Beams();
    const end = s.z + s.len;
    // (Saturated: added over blue ice, a paler warm turns to lilac.)
    const dawn = night ? new Color(0.5, 0.62, 1.0) : new Color(1.0, 0.42, 0.26);
    const gold = night ? new Color(0.7, 0.8, 1.0) : new Color(1.0, 0.62, 0.22);
    const k0 = night ? 0.5 : 1;
    const at = (z: number, off: number, up: number): number[] => {
      const x = c.centerX(z) + off;
      return [x, c.ground(x, z) + up, -z];
    };
    const hwE = c.halfWidth(end) + c.edgeLimit(end);
    // (Round 7's review: the cavern is the dark of the frame and the mouth is all of its light. The dawn
    // used to reach 44 m in as one broad lamp, which washed the floor and the walls lilac from the middle of
    // the cavern on, so the mouth had no dark to stand in. Now the light is drawn where it falls: a blade
    // of gold laid narrow along the floor from the mouth, sheets of it slanting in from the opening, a
    // veil filling the opening from the horizon up, and a short warm pool at the lip.)
    // The blade on the floor: dawn spilling in along the snow from the mouth, narrow far in and widening
    // to the lip, brightest there.
    const REACH = 70;
    const N = low ? 4 : 10;
    const lift = (zz: number): number => 0.2 + Math.max(0, visualGround(c, c.centerX(zz), zz) - c.ground(c.centerX(zz), zz));
    for (let i = 0; i < N; i++) {
      const za = end - REACH * (1 - i / N);
      const zb = end - REACH * (1 - (i + 1) / N);
      const wa = 0.4 + hwE * 0.55 * Math.pow(i / N, 1.6);
      const wb = 0.4 + hwE * 0.55 * Math.pow((i + 1) / N, 1.6);
      const ka = (low ? 0.55 : 0.95) * Math.pow(i / N, 1.2) * k0;
      const kb = (low ? 0.55 : 0.95) * Math.pow((i + 1) / N, 1.2) * k0;
      for (const sd of [-1, 1]) {
        b.quad(at(za, 0, lift(za)), at(zb, 0, lift(zb)), at(zb, sd * wb, lift(zb) + (wb > c.halfWidth(zb) ? 0.5 : 0)), at(za, sd * wa, lift(za)), gold, ka, kb, 0, 0);
      }
    }
    // The light in the air (Medium and High: its own mesh, thinning out close to the lens, so a sheet met
    // at the lens is never a pale card over the frame; Low draws the veil with the floor, in one draw).
    const air = low ? b : new Beams();
    // The mouth itself: a veil of rose-gold standing in the opening, hottest low at the horizon where the
    // sun is, cooling to rose up toward the lintel, and soft at its sides.
    const H = Math.max(22, s.clear + 8);
    const rose = night ? dawn : new Color(1.0, 0.5, 0.42);
    const vk = (low ? 0.45 : 1) * k0;
    // (A deeper gold than the floor's: added over the lilac of the dawn sky, a pale gold went to white.)
    const ember = night ? gold : new Color(1.0, 0.48, 0.16);
    // (Seen from inside, the horizon crosses the opening a third to a half of the way up, the floor
    // falling away to the mouth: the veil burns hottest there.)
    for (const sd of [-1, 1]) {
      const w0 = sd * hwE * 1.25;
      const w1 = sd * hwE * 1.15;
      air.quad(at(end + 2, 0, 0), at(end + 2, w0, 0), at(end + 2, w1, H * 0.35), at(end + 2, 0, H * 0.35), ember, 1.0 * vk, 0.25 * vk, 0.6 * vk, 1.9 * vk);
      air.quad(at(end + 2, 0, H * 0.35), at(end + 2, w1, H * 0.35), at(end + 2, w1, H * 0.6), at(end + 2, 0, H * 0.6), ember, 1.9 * vk, 0.6 * vk, 0.15 * vk, 0.6 * vk);
      air.quad(at(end + 2, 0, H * 0.6), at(end + 2, w1, H * 0.6), at(end + 2, sd * hwE, H), at(end + 2, 0, H), rose, 0.6 * vk, 0.15 * vk, 0, 0);
    }
    // Shafts: beams of light slanting down from the opening onto the floor inside, through the dark air the
    // rider rides in: each brightest along its middle and gone at its edges, so it reads as light in the
    // air and not as a cut sheet (Medium and High).
    if (!low) {
      // (Gold, not the veil's rose: a sheet of rose over blue air read as lilac.)
      const shaft = night ? dawn : new Color(1.0, 0.56, 0.24);
      const fan: Array<[number, number, number, number]> = [
        [-0.55, 4.6, 46, 0.85],
        [-0.12, 3.4, 62, 0.7],
        [0.3, 5.0, 40, 0.85],
        [0.66, 3.0, 54, 0.62],
        [-0.82, 2.6, 32, 0.55],
      ];
      for (const [u, w, reach, k] of fan) {
        const x1 = u * hwE * 0.9;
        const x0 = u * hwE * 0.7;
        const top = H * (0.55 + 0.25 * Math.abs(u));
        const kk = k * k0;
        for (const sd of [-1, 1]) {
          air.quad(at(end + 1, x0, top), at(end + 1, x0 + sd * w * 0.45, top), at(end - reach, x1 + sd * w, 0.4), at(end - reach, x1, 0.4), shaft, kk, 0, 0, kk * 0.15);
        }
      }
    }
    for (const [geo, mat] of [[b, this.beamMat], ...(air === b ? [] : [[air, this.airMat]])] as Array<[Beams, ShaderMaterial]>) {
      const mesh = new Mesh(geo.build(), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      root.add(mesh);
    }
    const lights = (z: number): void => {
      // The dawn reaches in at the lip: a short warm pool on the floor, the walls of the mouth and
      // whoever rides out, which leaves the cavern behind it dark.
      if (z < end - 150 || z > end + 20) return;
      const zl = end - 4;
      const x = c.centerX(zl);
      pushLocalLight(x, c.ground(x, zl) + 4, -zl, dawn.r, dawn.g, dawn.b, 24, 1.0 * k0);
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
    // (A rose gold, its green held down: the paler gold added over the lacquer and the cut banks turned
    // them olive.)
    const warm = new Color(1.0, 0.66, 0.4);
    const at = (z: number, off: number, up: number): number[] => {
      const x = c.centerX(z) + off;
      return [x, c.ground(x, z) + up, -z];
    };
    for (let i = 1; i < n; i++) {
      // A gap between two gates: the bar lies across the snow under it, a touch down-sun of the gap.
      const z = a + i * step;
      const hw = c.halfWidth(z) + Math.min(3, c.edgeLimit(z));
      // (Low has no film curve over the frame: at full strength its bars added up to paper white. Medium and
      // High lay them half as hard again, so a bar of sun is a band on the snow and not a haze over it.)
      const k = (0.3 + 0.3 * hashf(s.n * 31 + 7, i)) * smooth(0, 3, i) * smooth(0, 3, n - i) * (low ? 0.3 : 1.45);
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
        // (Thin enough that the bars on the snow are what reads, not a veil across the frame.)
        const ks = k * 0.2;
        const x0 = sun * (hw + 1.2);
        const x1 = -sun * hw * 0.82;
        b.quad(at(z - W * 0.8, x0, top), at(z + W * 0.8, x0, top), at(z + W * 1.2, x1, 0.2), at(z - W * 1.2, x1, 0.2), warm, ks, ks, ks * 0.25, ks * 0.25);
      }
    }
    // The far end: the day beyond the last gate, a veil of it standing in the way out.
    const end = s.z + s.len;
    const hwE = c.halfWidth(end) + c.edgeLimit(end);
    const H = Math.max(10, s.clear);
    for (const sd of [-1, 1]) b.quad(at(end + 1.5, 0, 0), at(end + 1.5, sd * hwE, 0), at(end + 1.5, sd * hwE, H), at(end + 1.5, 0, H), warm, 0.07, 0.03, 0.0, 0.02);
    const mesh = new Mesh(b.build(), this.beamMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    root.add(mesh);
    // The bars fall on whoever rides through them, and on the lacquer (ART.md 15: the sun cut into bars
    // by the posts, flickering over the rider at speed). One warm light rides with the sled on the sun's
    // side, full in a gap and gone behind a post; two more stand in the next gaps ahead and light the
    // posts' faces, so the row is lacquer in sun and not a dark wall. Reduced motion holds the rider's
    // light steady at half. Keyed to the sled's place, never the clock.
    const lights = (z: number): void => {
      if (z < a - 30 || z > end + 6) return;
      const at3 = (zz: number, off: number, up: number): [number, number, number] => {
        const x = c.centerX(zz) + off;
        return [x, c.ground(x, zz) + up, -zz];
      };
      const ph = (z - a) / step;
      const bar = Math.pow(0.5 + 0.5 * Math.cos(ph * Math.PI * 2), 2);
      const inK = smooth(a - 4, a + 10, z) * (1 - smooth(end - 6, end + 4, z));
      if (inK > 0) {
        const [x, y, zz] = at3(z + 0.6, sun * 2.6, 3.4);
        // (Low paints a local light on the snow as a pool with no film over it: at full strength the floor
        // under the sled went to paper white.)
        pushLocalLight(x, y, zz, warm.r, warm.g * 0.92, warm.b * 0.8, 8.5, (fx.reduced ? 0.42 : 0.2 + 0.85 * bar) * inK * (low ? 0.5 : 1));
      }
      const i0 = Math.max(1, Math.ceil(ph));
      for (let i = i0 + 1; i <= i0 + (low ? 1 : 3) && i < n; i += 2) {
        const zg = a + i * step;
        const hw = c.halfWidth(zg);
        const [x, y, zz] = at3(zg, -sun * (hw - 1.2), 4.5);
        pushLocalLight(x, y, zz, warm.r, warm.g * 0.86, warm.b * 0.74, 11, low ? 0.4 : 0.7);
      }
    };
    return { key: 'torii' + s.n, z0: a, z1: end, root, lights };
  }
}
