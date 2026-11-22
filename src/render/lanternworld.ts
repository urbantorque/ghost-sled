import { AdditiveBlending, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, ZeroFactor, BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, InstancedMesh, Matrix4, Mesh, NormalBlending, Object3D, PlaneGeometry, Points, Quaternion, ShaderMaterial, Vector3 } from 'three';
import type { Beat } from '../game/beats';
import type { Snap } from '../game/run';
import { CHUNK_LEN, type Course } from '../sim/course';
import { type MomentPlay, RIBBON_HW, momentPlays, pathX } from '../sim/moments';
import type { Sim } from '../sim/sim';
import type { Clearing } from './dressing';
import { SNOW, merge, part } from './flora';
import { ledgeAt, standable, visualGround } from './ground';
import { box, seg } from './landmarkKit';
import { LAMP_BRONZE, LAMP_SLATE, LAMP_TIMBER, LAMP_TIMBER_LIT, PAPER_DARK, WAY_LAMP_FLAME, paper, wayLampGeometry } from './lanternkit';
import type { LegendShot } from './legendworld';
import { pushLocalLight } from './lights';
import { pushShaftSource } from './postfx/shafts';
import { NOISE } from './massif';
import { makeToonMaterial, shared } from './materials';
import { cloudLetGo, type Palette } from './palette';
import type { Particles } from './particles';
import type { Detail } from './postfx/tiers';

// Lanternfall's own world (round 7, ART.md 15 "Lanternfall: where the lights come from"). Everything here is
// light, and all of it is the mountain's: marigold, the course's fuel colour, is this world's own light.
//
//  - The cloud sea. Seen from the Crown it is a sea of cloud below the summit, three sheets of billows a
//    few metres apart (so they part and close with parallax), moonlit silver on top and lit warm from
//    beneath in pools. Ridden into, it is real volume: the palette closes the air to forty metres
//    (palette.ts PLACES.lantern) and banks of thicker cloud drift past the lens, in depth.
//  - The valley of lanterns. Out under the deck, thousands of lanterns rise through the whole valley: one
//    draw of points, animated on the GPU, each a paper lantern near the lens and a mote of light a
//    kilometre off. The Great Rising (a legend) doubles them; the lanterns the town lets go at the finish
//    ride in the same draw.
//  - Way lamps down the whole mountain, the flames of the stone lamps the sim stands in the run, and the
//    halos that loom in the cloud: one small draw of sprites, filled each frame, and the nearest are
//    offered as local lights (lights.ts), so the snow, the rider and the ghosts are lit by them.
//  - The canal that carries floating lights beside the Lamp Road.
//  - The three set pieces: the guide light and its wake (follow), the lamps that catch and the road that
//    blazes (kindle), the flame on the sled and the great lantern over the square (carry). And the two
//    legends: the Great Rising and the Tall Lamplighter.
// Reads public sim state and the director's beats; writes nothing back.

const MARIGOLD = new Color('#FFD34D');
const WHITE_GOLD = new Color('#FFF3C4');
const FLAME = new Color('#FFB24E');
const EMBER = new Color('#FF8A3C');
const COLD = new Color('#7A74C8');
/** A lamp's light on the snow, linear (landmarks.ts LAMP_LIGHT.lantern). */
const LAMP_RGB: [number, number, number] = [1, 0.66, 0.2];

/** Lanterns in the valley by tier, the lanterns a win lets go, and the banks of cloud at the lens. */
const BUDGET: Record<Detail, { valley: number; release: number; puffs: number; sheets: number; sprites: number; floats: number; lampAhead: number }> = {
  low: { valley: 2100, release: 160, puffs: 10, sheets: 1, sprites: 160, floats: 0, lampAhead: 170 },
  medium: { valley: 3600, release: 360, puffs: 18, sheets: 2, sprites: 320, floats: 36, lampAhead: 240 },
  high: { valley: 6000, release: 600, puffs: 28, sheets: 3, sprites: 480, floats: 72, lampAhead: 300 },
};

/** Way lamps stand this far past the corridor's edge, a pair of them every this many metres. */
const WAY_E = 2.7;
const WAY_STEP = 36;
/** Way-lamp posts are drawn from this far behind the rider to this far ahead. */
const LAMP_BACK = 70;
const LAMP_AHEAD = 400;
/** The great lantern hangs this far past the line, over the square, its foot this high over the snow, and as the
 *  rider comes to the line it is walked along its yoke this far toward the rider's side of the run. (Round 8, the
 *  light lane: at 28 m before the line it stood 95 m behind a stopped rider, just past the left edge of the
 *  results' frame, and no critic ever saw it lit with the rider; the finish lens swings round to look back up the
 *  run across the course's middle, and measured in that frame (scripts/playtest/finishprobe.js) a lantern 35 m
 *  past the line and 12 m to the rider's side hangs over the rider's head in the left column the results leave
 *  open, about a seventh of the frame tall. Round 7 had it 36 m past the line on the run's middle, where it was
 *  off the frame's edge. Round 8, the review: but a slow finisher stops 40 m past the line, under it, and in the
 *  results it hung cut by the frame's top edge, only its foot in the picture; 14 m past the line it stands 30 m or more
 *  behind any rider that stops, over the rider's head for a slow one and lower in the sky for a fast one.) */
const GREAT_Z = 14;
const GREAT_Y = 6.5;
const GREAT_SIDE = 12;
/** And let down this far on its chains as it is walked (round 8, the review: measured in the results of a slow
 *  finisher, scripts/playtest/rev4-motion.js, the paper's middle stood at the frame's top edge; let down, it hangs
 *  in the top third over the rider's head. It goes down once the rider is under and past it, and off the run.) */
const GREAT_DROP = 3.6;
/** The guide light keeps this far ahead of the rider. */
const GUIDE_AHEAD = 26;
/** The canal's reaches lie this far past the edge. */
const CANAL_E = 13;
const CANAL_W = 6.5;

/** How far out a legend is said (sim.ts's LEGEND_WARN), and how far past its end the look lets go (m). */
const LEGEND_WARN_M = 220;
const LEGEND_REACH_OUT = 120;

const smooth01 = (x: number): number => {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};

let rs = 1;
const rnd = (): number => {
  rs = (rs * 1664525 + 1013904223) >>> 0;
  return rs / 4294967296;
};

/** How deep in the Cloud Sea a rider at sim z is, 0..1: the same span the palette's place lies on. */
export function cloudDepth(c: Course, z: number): number {
  const cl = c.cloud;
  if (!cl) return 0;
  const z0 = cl.z0 + 55;
  const z1 = cloudLetGo(cl);
  if (z <= z0 || z >= z1 + 50) return 0;
  return smooth01((z - z0) / 150) * (1 - smooth01((z - (z1 - 10)) / 60));
}

// ---------------------------------------------------------------- materials

const LIGHT_VERT = /* glsl */ `
  uniform float uH;
  uniform vec2 uFogR;
  uniform float uCloud;
  // Pixels a light size metres across covers at view depth d.
  float lightPx(float size, float d) { return size * projectionMatrix[1][1] * uH * 0.5 / max(d, 0.5); }
  // Light carries through air: it keeps a third of itself at the fog's far end, and never pops at the lens.
  float lightAir(float d) {
    float f = clamp((d - uFogR.x) / max(uFogR.y - uFogR.x, 1.0), 0.0, 1.0);
    return (1.0 - 0.45 * f * f) * smoothstep(1.5, 5.0, d);
  }
`;

/** The shapes a point of light is drawn as (gl_PointCoord in q, +y up): a soft mote, a paper lantern, a
 *  flame. On Low (POSTER) they are flat painted shapes with one lighter value inside: no halo to bloom. */
const LIGHT_FRAG = /* glsl */ `
  float mote(vec2 q) { float r2 = dot(q, q); return exp(-r2 * 3.4) * (1.0 - smoothstep(0.55, 1.0, r2)); }
  vec3 paperLantern(vec2 q, vec3 col) {
    vec2 b = q / vec2(0.4, 0.56);
    float sq = pow(pow(abs(b.x), 2.8) + pow(abs(b.y), 2.8), 1.0 / 2.8);
    #ifdef POSTER
      float body = 1.0 - step(1.0, sq);
      float core = 1.0 - step(0.5, sq);
      return col * (body * 0.75 + core * 0.45);
    #else
      float body = 1.0 - smoothstep(0.82, 1.0, sq);
      float flame = exp(-(q.x * q.x * 26.0 + (q.y + 0.2) * (q.y + 0.2) * 12.0));
      // (Every halo reaches nothing inside the point's circle: cut off at the square's edge, a near light
      // was a glowing card.)
      float halo = exp(-dot(q, q) * 2.4) * 0.4 * (1.0 - smoothstep(0.45, 1.0, dot(q, q)));
      // (Round 8, the review loop: paper with ribs, ART.md 14, palest at its waist and rounding away at its sides:
      // a body of one glow read as an orange disc or a bokeh blob, never a paper lantern.)
      float waist = 1.0 - 0.5 * b.y * b.y;
      float roundK = 1.0 - 0.42 * b.x * b.x;
      float rib = 1.0 - 0.38 * (1.0 - smoothstep(0.0, 0.075, abs(fract(b.y * 2.0 + 0.5) - 0.5)));
      return col * (body * (0.42 + 0.42 * waist) * roundK * rib + halo) + vec3(1.0, 0.93, 0.72) * flame * body * 0.7;
    #endif
  }
  // A paper lantern's dark cap over it and its foot under it (round 8, the review loop): 1 on them, 0 elsewhere.
  float lanternCap(vec2 q) {
    float cap = (1.0 - smoothstep(0.24, 0.28, abs(q.x))) * smoothstep(0.5, 0.52, q.y) * (1.0 - smoothstep(0.64, 0.66, q.y));
    float foot = (1.0 - smoothstep(0.16, 0.2, abs(q.x))) * smoothstep(-0.65, -0.63, q.y) * (1.0 - smoothstep(-0.53, -0.51, q.y));
    float tassel = (1.0 - smoothstep(0.02, 0.04, abs(q.x))) * smoothstep(-0.9, -0.86, q.y) * (1.0 - smoothstep(-0.65, -0.63, q.y));
    return max(max(cap, foot), tassel * 0.8);
  }
  vec3 flameShape(vec2 q, vec3 col, float seed, float t) {
    // A teardrop that leans and licks: wide at its foot, a point at its head.
    float lean = sin(t * 9.0 + seed * 40.0) * 0.08 + sin(t * 15.0 + seed * 71.0) * 0.04;
    vec2 p = vec2(q.x - lean * (q.y + 0.6), q.y + 0.25);
    float w = 0.34 * (1.0 - smoothstep(-0.5, 0.95, p.y)) + 0.02;
    float inside = 1.0 - smoothstep(w * 0.6, w, abs(p.x));
    inside *= smoothstep(-0.62, -0.42, p.y) * (1.0 - smoothstep(0.75, 0.98, p.y));
    #ifdef POSTER
      // (A painted flame: wider than the lit one, flat, with one paler value at its heart.)
      float fat = 1.0 - step(w * 1.5 + 0.05, abs(p.x));
      fat *= step(-0.62, p.y) * step(p.y, 0.9);
      // (At 1.3 a near flame clipped to a white triangle with no tone curve to roll it off.)
      return col * fat * 0.8 + vec3(1.0, 0.86, 0.6) * fat * step(abs(p.x), w * 0.6) * step(p.y, 0.25) * 0.3;
    #else
      float core = inside * (1.0 - smoothstep(0.0, w * 0.5, abs(p.x))) * (1.0 - smoothstep(-0.3, 0.5, p.y));
      float halo = exp(-dot(q, q) * 2.0) * 0.45 * (1.0 - smoothstep(0.45, 1.0, dot(q, q)));
      return col * (inside * 0.9 + halo) + vec3(1.0, 0.95, 0.8) * core * 0.9;
    #endif
  }
`;

function defs(low: boolean): Record<string, number> {
  return low ? { POSTER: 1 } : {};
}

/** The valley's lanterns: static buffers, moved in the vertex shader. aA: phase, rise speed (m/s), size
 *  (m), the height it rises through (m). aB: hue, kind (0 the valley's, 1 the Great Rising's, 2 one the
 *  town lets go: then aA.x is its delay in seconds and aA.w unused). */
function valleyMaterial(low: boolean): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Each lantern covers what is behind it and then adds its light (premultiplied): added alone, marigold
    // over a pale range is only a paler pink, and the valley reads as snowfall.
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
    defines: defs(low),
    uniforms: { uTime: shared.uTime, uH: { value: 720 }, uFogR: { value: [60, 600] }, uCloud: { value: 0 }, uShow: { value: 0 }, uSurge: { value: 0 }, uRelease: { value: -1 }, uMinPx: { value: low ? 4.6 : 2.1 }, uGain: { value: low ? 1.7 : 1.9 } },
    vertexShader: /* glsl */ `
      attribute vec4 aA;
      attribute vec2 aB;
      uniform float uTime;
      uniform float uShow;
      uniform float uSurge;
      uniform float uRelease;
      uniform float uMinPx;
      varying vec3 vCol;
      varying float vA;
      varying float vBig;
      ${LIGHT_VERT}
      void main() {
        vec3 p = position;
        float a = 1.0;
        float size = aA.z;
        if (aB.y < 1.5) {
          float t = fract(aA.x + uTime * aA.y * (1.0 + uSurge * 0.9) / aA.w);
          p.y += t * aA.w;
          a = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.86, 1.0, t)) * uShow;
          p.x += sin(uTime * 0.31 + aA.x * 40.0) * 1.8;
          p.z += cos(uTime * 0.27 + aA.x * 31.0) * 1.8;
          if (aB.y > 0.5) a *= uSurge;
          size *= 1.0 + uSurge * 0.2;
        } else {
          float t = uTime - uRelease - aA.x;
          a = uRelease < 0.0 || t < 0.0 ? 0.0 : smoothstep(0.0, 0.7, t) * (1.0 - smoothstep(45.0, 80.0, t));
          t = max(t, 0.0);
          p.y += t * aA.y * (0.55 + 0.45 * min(t, 5.0) / 5.0);
          p.x += sin(t * 0.5 + aB.x * 20.0) * (0.5 + t * 0.16);
          p.z += cos(t * 0.43 + aB.x * 17.0) * (0.5 + t * 0.16);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float d = -mv.z;
        float px = lightPx(size, d);
        // A lantern too far to cover a pixel dims; it never flickers in and out of the raster.
        a *= clamp(px / uMinPx, 0.5, 1.0) * lightAir(d);
        gl_PointSize = a < 0.004 ? 0.0 : min(max(px, uMinPx), 200.0);
        vBig = smoothstep(4.0, 11.0, px);
        vCol = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.76, 0.3), aB.x) * (0.86 + 0.2 * sin(uTime * (1.6 + aB.x * 2.4) + aA.x * 90.0));
        vA = a;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGain;
      varying vec3 vCol;
      varying float vA;
      varying float vBig;
      ${LIGHT_FRAG}
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        q.y = -q.y;
        #ifdef POSTER
          // (A round dab with a soft edge: a square one read as a pixel, not a lantern.)
          float dotK = 1.0 - smoothstep(0.5, 0.8, length(q));
        #else
          float dotK = mote(q) * 1.25;
        #endif
        vec2 b = q / vec2(0.4, 0.56);
        float bodyK = 1.0 - smoothstep(0.8, 1.0, pow(pow(abs(b.x), 2.8) + pow(abs(b.y), 2.8), 1.0 / 2.8));
        vec3 col = mix(vCol * dotK, paperLantern(q, vCol), vBig);
        // (A paper lantern near the lens covers what is behind it; a far mote covers little: thousands of them
        // each taking 85% of the air behind them made the lit valley under the break a dark hole full of dots.)
        float cover = mix(min(dotK, 1.0) * 0.28, bodyK * 0.92, vBig) * vA;
        #ifndef POSTER
          // Its cap and foot in ink, where it is big enough to read as a lantern.
          float capK = lanternCap(q) * smoothstep(0.7, 1.0, vBig);
          col *= 1.0 - capK;
          cover = max(cover, capK * 0.95 * vA);
        #endif
        gl_FragColor = vec4(col * vA * uGain, cover);
      }
    `,
  });
}

/** The frame's own lights (flames, halos, floats, the guide light): filled each frame. aS: size (m), kind
 *  (0 a glow, 1 a flame, 2 a paper lantern), a seed. */
function spriteMaterial(low: boolean): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    defines: defs(low),
    uniforms: { uTime: shared.uTime, uH: { value: 720 }, uFogR: { value: [60, 600] }, uCloud: { value: 0 }, uGain: { value: low ? 1 : 1.3 } },
    vertexShader: /* glsl */ `
      attribute vec3 aS;
      attribute vec3 aC;
      uniform float uTime;
      varying vec3 vCol;
      varying float vKind;
      varying float vSeed;
      ${LIGHT_VERT}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = -mv.z;
        float f = clamp((d - uFogR.x) / max(uFogR.y - uFogR.x, 1.0), 0.0, 1.0);
        // In cloud a light far off is a wide soft halo, and it tightens to a flame as it comes: the looming.
        float size = aS.x * (1.0 + uCloud * f * (aS.y < 0.5 ? 3.6 : 1.4));
        float px = lightPx(size, d);
        float a = lightAir(d) * clamp(px / 1.5, 0.25, 1.0) * (1.0 - uCloud * f * 0.35);
        gl_PointSize = a < 0.004 ? 0.0 : min(max(px, 1.5), 256.0);
        vCol = aC * a;
        vKind = aS.y;
        vSeed = aS.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uGain;
      varying vec3 vCol;
      varying float vKind;
      varying float vSeed;
      ${LIGHT_FRAG}
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        q.y = -q.y;
        vec3 col;
        if (vKind < 0.5) {
          #ifdef POSTER
            col = vCol * (1.0 - smoothstep(0.15, 0.9, length(q))) * 0.4;
          #else
            col = vCol * mote(q * 0.9);
          #endif
        } else if (vKind < 1.5) col = flameShape(q, vCol, vSeed, uTime);
        else col = paperLantern(q, vCol);
        #ifdef POSTER
          // (No tone curve on Low: a light over 1 clipped to a white shape. It keeps its hue at full value.)
          col *= uGain;
          col /= max(1.0, max(col.r, max(col.g, col.b)));
          gl_FragColor = vec4(col, 1.0);
          return;
        #endif
        gl_FragColor = vec4(col * uGain, 1.0);
      }
    `,
  });
}

/** The sea of cloud's sheets (see the file's head). aL: which sheet, 0 the crests to 1 the floor. */
function sheetMaterial(low: boolean): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
    defines: defs(low),
    uniforms: {
      uTime: shared.uTime,
      uK: { value: 1 },
      uR: { value: 2600 },
      uLit: { value: new Color() },
      uShade: { value: new Color() },
      uRim: { value: new Color() },
      uWarm: { value: new Color() },
      uHaze: { value: new Color() },
      uMoon: { value: new Vector3(0.3, 0.3, -0.9) },
    },
    vertexShader: /* glsl */ `
      attribute float aL;
      varying vec3 vW;
      varying float vL;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vL = aL;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uK;
      uniform float uR;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uRim;
      uniform vec3 uWarm;
      uniform vec3 uHaze;
      uniform vec3 uMoon;
      varying vec3 vW;
      varying float vL;
      ${NOISE}
      float billow(vec2 q) {
        float n = snoise(q) * 0.6 + snoise(q * 2.7 + 3.1) * 0.28;
        #ifndef POSTER
          n += snoise(q * 7.1 + 1.7) * 0.12;
        #endif
        return n;
      }
      void main() {
        // (Round 8, the review loop: billows a third of a kilometre across read from the Crown as one mottled sheet;
        // two thirds of that size, they read as heaped cloud, each with its moonlit rim.)
        vec2 q = vW.xz * 0.0048 + vec2(uTime * 0.004, uTime * 0.0015);
        float n = billow(q);
        // The top sheet is the billows' crests alone; each one under it is fuller, and the floor is whole.
        float cover = smoothstep(0.42 - vL * 0.9, 0.62 - vL * 0.8, n * 0.5 + 0.5);
        vec2 sxz = normalize(uMoon.xz + vec2(0.0001, 0.0));
        float facing = clamp(0.5 + (n - billow(q - sxz * 0.16)) * 3.2, 0.0, 1.0);
        float l = facing * 0.7 + (n * 0.5 + 0.5) * 0.4 - 0.14 + (1.0 - vL) * 0.12;
        #ifdef POSTER
          // (Low draws the floor alone: at the floor's own value, under the crests High lays over it, the sea read as
          // dark water or a lava field from the Crown, the review loop. It takes the crests' light instead.)
          l += 0.5;
        #endif
        l = clamp(l, 0.0, 0.999) * 3.0;
        float st = (floor(l) + smoothstep(0.35, 0.65, fract(l))) / 3.0;
        #ifdef POSTER
          // (Its shade a step lighter too: Low's floor in the night's navy read as water under the moon.)
          vec3 col = mix(mix(uShade, uLit, 0.3), uLit, st);
        #else
          vec3 col = mix(uShade, uLit, st);
        #endif
        col = mix(col, uRim, pow(facing, 3.0) * 0.6 * (1.0 - vL));
        // Lit from beneath in pools that hold their place (massif.ts paints the same pools on the far sea).
        vec2 wq = vW.xz * 0.00042;
        float pool = snoise(wq + vec2(1.7, -4.2)) * 0.6 + snoise(wq * 2.3 + vec2(-3.1, 2.6)) * 0.4;
        pool = smoothstep(0.22, 0.78, pool + 0.08 * sin(uTime * 0.21 + wq.x * 3.0));
        col += uWarm * pool * (0.3 + 0.7 * (1.0 - smoothstep(-0.35, 0.55, n))) * (0.45 + 0.55 * vL);
        #ifdef POSTER
          // (A warm pool over a cool floor in flat values is a peach glow, never a maroon blot.)
          col = mix(col, uLit, 0.18 * pool);
        #endif
        float d = distance(vW, cameraPosition);
        float a = cover * (1.0 - smoothstep(0.7, 1.0, length(vW.xz - cameraPosition.xz) / uR)) * smoothstep(3.0, 26.0, d);
        col = mix(col, uHaze, smoothstep(700.0, 2500.0, d) * 0.85);
        gl_FragColor = vec4(col, a * uK);
      }
    `,
  });
}

/** Banks of cloud at the lens: camera-facing soft quads, each instance a place (aP: xyz, size) and a colour
 *  with its strength (aQ). They fade at the lens and with distance, so none ever shows an edge. */
function puffMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    uniforms: { uK: { value: 0 }, uReach: { value: 60 } },
    vertexShader: /* glsl */ `
      attribute vec4 aP;
      attribute vec4 aQ;
      uniform float uK;
      uniform float uReach;
      varying vec2 vUv;
      varying vec4 vCol;
      void main() {
        vec4 mv = viewMatrix * vec4(aP.xyz, 1.0);
        float d = -mv.z;
        mv.xy += position.xy * aP.w;
        vUv = position.xy * 2.0;
        vCol = vec4(aQ.rgb, aQ.a * uK * smoothstep(2.0, 14.0, d) * (1.0 - smoothstep(uReach * 0.55, uReach, d)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec4 vCol;
      void main() {
        float r = dot(vUv, vUv);
        float a = (1.0 - smoothstep(0.05, 1.0, r));
        gl_FragColor = vec4(vCol.rgb, a * a * vCol.a);
      }
    `,
  });
}

/** Light lying on the snow: an ellipse per instance, laid along the slope. aP: xyz, yaw. aG: the ground's
 *  slope across and down its own frame, its width and its length. aQ: colour and strength. Additive. */
function poolMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uFogR: { value: [60, 600] } },
    vertexShader: /* glsl */ `
      attribute vec4 aP;
      attribute vec4 aG;
      attribute vec4 aQ;
      uniform vec2 uFogR;
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vec2 l = position.xz * aG.zw;
        float c = cos(aP.w);
        float s = sin(aP.w);
        vec3 w = vec3(aP.x + l.x * c + l.y * s, aP.y + l.x * aG.x + l.y * aG.y, aP.z - l.x * s + l.y * c);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        float f = clamp((-mv.z - uFogR.x) / max(uFogR.y - uFogR.x, 1.0), 0.0, 1.0);
        vUv = position.xz * 2.0;
        vCol = aQ.rgb * aQ.a * (1.0 - 0.8 * f);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        float r = dot(vUv, vUv);
        float a = 1.0 - smoothstep(0.1, 1.0, r);
        gl_FragColor = vec4(vCol * a * a, 1.0);
      }
    `,
  });
}

/** The canal's water: near black with the night in it, and lights carried down it: each a small flame and
 *  the streak of it on the water. uv.x across (0..1), uv.y metres down the reach. */
function waterMaterial(low: boolean): ShaderMaterial {
  return new ShaderMaterial({
    defines: defs(low),
    uniforms: { uTime: shared.uTime, uFog: shared.uFog, uFogR: { value: [60, 600] }, uSky: shared.uSkyZenith, uStone: { value: new Color('#2C2850') } },
    vertexShader: /* glsl */ `
      attribute vec2 aUv;
      attribute float aKind;
      varying vec2 vUv;
      varying float vKind;
      varying float vD;
      void main() {
        vUv = aUv;
        vKind = aKind;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uFog;
      uniform vec2 uFogR;
      uniform vec3 uSky;
      uniform vec3 uStone;
      varying vec2 vUv;
      varying float vKind;
      varying float vD;
      float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      void main() {
        vec3 col;
        if (vKind > 0.5) {
          // The kerb and the channel's walls: dressed stone in two values, snow along the kerb's top.
          col = mix(uStone * 0.7, uStone * 1.25, step(0.5, fract(vUv.y * 0.31)) * 0.5 + 0.25);
          if (vKind > 1.5) col = vec3(0.78, 0.76, 0.92);
        } else {
          float flow = vUv.y - uTime * 2.6;
          col = mix(vec3(0.02, 0.018, 0.07), uSky * 0.55, 0.35 + 0.25 * sin(flow * 0.8 + sin(vUv.x * 9.0) * 0.7));
          // Lights on the water: one every few metres, each in its own lane, bobbing.
          vec3 glow = vec3(0.0);
          // (Each a hand across and its streak long on the water: at a third of that the lights were under a
          // pixel from the run, and the river read as a dark ditch.)
          for (int k = 0; k < 2; k++) {
            float cell = 4.0 + float(k) * 2.5;
            float id = floor(flow / cell) + float(k) * 57.0;
            float fy = fract(flow / cell) * cell - cell * 0.5;
            float fx = (vUv.x - (0.2 + 0.6 * hash(id))) * ${CANAL_W.toFixed(1)};
            float on = step(0.2, hash(id + 9.0));
            float core = exp(-(fx * fx * 2.6 + fy * fy * 2.6));
            float streak = exp(-(fx * fx * 2.2)) * exp(-max(fy, 0.0) * 0.55) * step(0.0, fy) * 0.5;
            glow += vec3(1.0, 0.66, 0.24) * (core * 2.8 + streak) * on * (0.8 + 0.2 * sin(uTime * 3.0 + id));
          }
          col += glow;
        }
        float f = clamp((vD - uFogR.x) / max(uFogR.y - uFogR.x, 1.0), 0.0, 1.0);
        gl_FragColor = vec4(mix(col, uFog, f * f * 0.9), 1.0);
      }
    `,
  });
}

// ---------------------------------------------------------------- the great lantern

/** The frame the great lantern hangs from, in its own frame (the line's middle at the origin, +z up the
 *  run): two timber masts on each side past the barriers, a doubled beam between each pair, and the yoke
 *  across. `X` is how far out the masts stand, `top` how high the yoke. */
function greatFrame(X: number, top: number, gy: (x: number) => number): BufferGeometry {
  const t = new Color(LAMP_TIMBER);
  const lit = new Color(LAMP_TIMBER_LIT);
  const parts: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const g = gy(s * X);
    for (const z of [-2.6, 2.6]) {
      parts.push(seg([s * (X + 1.4), g - 1, z * 1.5], [s * X, top + 1.2, z * 0.4], 0.36, t));
      parts.push(box(1.3, 0.9, 1.3, new Color('#3E3960'), [s * (X + 1.4), g + 0.2, z * 1.5]));
    }
    parts.push(box(0.5, 0.5, 6.4, lit, [s * (X + 0.8), g + (top - g) * 0.45, 0]));
    parts.push(box(0.9, 0.2, 2.2, new Color(LAMP_SLATE), [s * X, top + 1.9, 0]));
    parts.push(box(0.8, 0.26, 2.0, SNOW, [s * X, top + 2.1, 0]));
  }
  for (const z of [-0.55, 0.55]) parts.push(box(2 * X + 2.4, 0.8, 0.55, lit, [0, top + 0.6, z]));
  parts.push(box(2 * X + 3, 0.2, 2, new Color(LAMP_SLATE), [0, top + 1.2, 0]));
  parts.push(box(2 * X + 2.6, 0.24, 1.7, SNOW, [0, top + 1.42, 0]));
  return merge(parts);
}

/** The chains the great lantern hangs by from the yoke (they travel with it along the yoke). */
function greatChains(top: number): BufferGeometry[] {
  return [-1, 1].map((s) => seg([s * 1.5, top + 0.3, 0], [s * 1.1, top - 2.1, 0], 0.07, new Color(LAMP_BRONZE), 4));
}

/** The great lantern itself, hanging from the origin: a paper drum fuller at its waist on eight timber ribs
 *  and three hoops, a slate cap and foot, a tassel. Its paper is dark until it is lit (the material's
 *  emissive carries the light, masked to the paper). R is its waist, H its height. */
function greatLantern(R: number, H: number): { paper: BufferGeometry; frame: BufferGeometry } {
  const body = new CylinderGeometry(R * 0.72, R * 0.72, H, 16, 6);
  const pos = body.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / (H / 2);
    const k = 1 + 0.39 * (1 - y * y);
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  body.translate(0, -2.2 - H / 2, 0);
  const t = new Color(LAMP_TIMBER);
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let j = 0; j < 4; j++) {
      const y0 = -1 + (j / 4) * 2;
      const y1 = -1 + ((j + 1) / 4) * 2;
      const r0 = R * 0.72 * (1 + 0.39 * (1 - y0 * y0)) + 0.06;
      const r1 = R * 0.72 * (1 + 0.39 * (1 - y1 * y1)) + 0.06;
      parts.push(seg([Math.cos(a) * r0, -2.2 - H / 2 + (y0 * H) / 2, Math.sin(a) * r0], [Math.cos(a) * r1, -2.2 - H / 2 + (y1 * H) / 2, Math.sin(a) * r1], 0.11, t));
    }
  }
  for (const y of [-0.55, 0, 0.55]) {
    const r = R * 0.72 * (1 + 0.39 * (1 - y * y)) + 0.07;
    parts.push(part(new CylinderGeometry(r, r, 0.16, 16, 1, true), t, { pos: [0, -2.2 - H / 2 + (y * H) / 2, 0] }));
  }
  parts.push(part(new CylinderGeometry(R * 0.5, R * 0.78, 0.7, 12), new Color(LAMP_SLATE), { pos: [0, -1.95, 0] }));
  parts.push(part(new CylinderGeometry(R * 0.8, R * 0.8, 0.14, 12), SNOW, { pos: [0, -1.55, 0], scale: [0.8, 1, 0.8] }));
  parts.push(part(new CylinderGeometry(R * 0.76, R * 0.46, 0.6, 12), new Color(LAMP_SLATE), { pos: [0, -2.2 - H - 0.2, 0] }));
  parts.push(seg([0, -2.2 - H - 0.5, 0], [0, -2.2 - H - 2.1, 0], 0.09, new Color(LAMP_BRONZE), 5));
  parts.push(part(new CylinderGeometry(0.3, 0.05, 1.1, 6), new Color('#8E86C8'), { pos: [0, -2.2 - H - 2.6, 0] }));
  return { paper: part(body, new Color(PAPER_DARK)), frame: merge(parts) };
}

/** The Tall Lamplighter (a legend): a robed figure three storeys tall, a deep cowl with no face in it, a
 *  pole over his shoulder and a lantern at its tip (drawn as light). In his own frame, feet at the origin,
 *  facing +z; the pole's tip is at TALL_TIP. */
const TALL_H = 9.5;
/** He is drawn this much larger than he was modelled: at 9.5 m he was one more post among the standing stones. */
const TALL_S = 1.4;
const TALL_TIP: [number, number, number] = [3.4, 10.6, 1.2];
function tallLamplighter(): BufferGeometry {
  const robe = new Color('#4A4092');
  const cape = new Color('#6C5EB8');
  const parts: BufferGeometry[] = [];
  const bell = new CylinderGeometry(0.7, 1.75, 7.2, 9, 3);
  parts.push(part(bell, robe, { pos: [0, 3.6, 0], jitter: 0.12 }));
  parts.push(part(new CylinderGeometry(0.5, 1.15, 2.2, 9, 1), cape, { pos: [0, 7.1, 0] }));
  parts.push(part(new CylinderGeometry(0.78, 0.8, 0.18, 9), new Color('#B4A8E0'), { pos: [0, 5.1, 0] }));
  // The cowl: a cone tipped back, its mouth dark.
  parts.push(part(new CylinderGeometry(0.2, 0.72, 1.7, 8, 1), cape, { pos: [0, 8.6, -0.1], rot: [-0.18, 0, 0] }));
  parts.push(part(new CylinderGeometry(0.44, 0.44, 0.1, 8), new Color('#0E0C22'), { pos: [0, 8.25, 0.42], rot: [Math.PI / 2 - 0.2, 0, 0] }));
  // The robe's making: a dark hem, folds falling from the waist, a bronze cord at the waist with a small
  // lantern of his own on it, and the other sleeve hanging long. (Without them he read as a bare cone.)
  const dark = new Color('#241E52');
  parts.push(part(new CylinderGeometry(1.78, 1.82, 0.5, 9, 1, true), dark, { pos: [0, 0.35, 0] }));
  for (let k = 0; k < 5; k++) {
    const a = -0.9 + k * 0.45;
    parts.push(seg([Math.sin(a) * 0.82, 5.0, Math.cos(a) * 0.82], [Math.sin(a) * 1.72, 0.6, Math.cos(a) * 1.72], 0.07, dark, 4));
  }
  parts.push(part(new CylinderGeometry(0.84, 0.86, 0.14, 9, 1, true), new Color(LAMP_BRONZE), { pos: [0, 5.35, 0] }));
  parts.push(seg([-0.5, 5.3, 0.6], [-0.62, 4.5, 0.82], 0.03, new Color(LAMP_BRONZE), 3));
  parts.push(part(new CylinderGeometry(0.26, 0.26, 0.55, 6), paper(1.2), { pos: [-0.64, 4.2, 0.86] }));
  parts.push(seg([-0.55, 7.4, 0.1], [-1.05, 5.4, 0.35], 0.34, cape, 6));
  // The arm that holds the pole, and the pole.
  parts.push(seg([0.55, 7.4, 0.1], [1.3, 6.2, 0.7], 0.2, cape, 5));
  parts.push(seg([0.9, 0.2, 0.5], [TALL_TIP[0], TALL_TIP[1], TALL_TIP[2]], 0.11, new Color(LAMP_TIMBER_LIT), 5));
  parts.push(seg([TALL_TIP[0], TALL_TIP[1], TALL_TIP[2]], [TALL_TIP[0], TALL_TIP[1] - 0.9, TALL_TIP[2]], 0.03, new Color(LAMP_BRONZE), 4));
  return merge(parts);
}

// ---------------------------------------------------------------- the world

interface WayLamp {
  x: number;
  y: number;
  z: number;
  /** A lamp with no post: hung on a wall. */
  hung: boolean;
  seed: number;
}

interface Reach {
  /** Samples down the reach: sim x, world y of the water, sim z. */
  pts: Array<[number, number, number]>;
  side: number;
  z0: number;
  z1: number;
}

const tm = new Matrix4();
const tq = new Quaternion();
const tv = new Vector3();
const ts = new Vector3();
const UP = new Vector3(0, 1, 0);
const grad = { x: 0, z: 0 };

export class LanternWorld {
  readonly root = new Object3D();
  private course: Course | null = null;
  private detail: Detail = 'high';
  private built = false;
  private hPx = 720;
  /** Whether a site stands at sim (x, z) (world.ts hands the set pieces' keep test over). */
  kept: (x: number, z: number) => boolean = () => false;

  private valley: Points | null = null;
  private valleyN = 0;
  private sprites: Points | null = null;
  private spP = new Float32Array(0);
  private spS = new Float32Array(0);
  private spC = new Float32Array(0);
  private nSp = 0;
  private sheets: Mesh | null = null;
  private puffs: Mesh | null = null;
  private puffP = new Float32Array(0);
  private puffQ = new Float32Array(0);
  private pools: Mesh | null = null;
  private poolP = new Float32Array(0);
  private poolG = new Float32Array(0);
  private poolQ = new Float32Array(0);
  private nPool = 0;
  private lamps: WayLamp[] = [];
  private lampMesh: InstancedMesh | null = null;
  /** Every post's matrix in order down the run, the brazier's last; the mesh draws a window of them. */
  private lampAll = new Float32Array(0);
  private lampZ: number[] = [];
  private lampWin = '';
  /** The far valley's hamlets: sim x, world y, sim z, and how wide its pool of light is (m). */
  private hamlets: Array<[number, number, number, number]> = [];
  private canal: Mesh | null = null;
  private reaches: Reach[] = [];
  private greatRoot: Object3D | null = null;
  private greatPaper: Mesh | null = null;
  /** The lantern on its yoke (the paper, ribs and chains), walked along it toward the rider's side: which side
   *  (0 not yet known), and when the walk began. */
  private greatNode: Object3D | null = null;
  private greatSide = 0;
  private greatWalk = -1;
  private tall: Mesh | null = null;
  private readonly owned: Array<{ dispose(): void }> = [];
  private cloudTop = 0;

  // The run's state the picture keeps (cleared by reset).
  private plays: readonly MomentPlay[] = [];
  private dark = new Map<number, { play: number; i: number }>();
  /** When each kindle lamp caught (seconds, the frame clock), by play index * 64 + lamp. */
  private caught = new Map<number, number>();
  private kindleWon = -1;
  private guideK = 1;
  private guideEnd = -1;
  private guideWon = false;
  private guidePulse = -9;
  private gutter = false;
  private flare = -9;
  private flameOut = -1;
  private greatLit = -1;
  private greatWon = false;
  private surge = 0;
  private show = 0;
  private time = 0;
  private sparkAcc = 0;
  private tallZ = 0;

  constructor(private readonly particles: Particles) {}

  setViewport(hPx: number): void {
    this.hPx = hPx;
  }

  setDetail(d: Detail): void {
    if (d === this.detail) return;
    this.detail = d;
    if (this.course) this.build(this.course);
  }

  setCourse(c: Course): void {
    this.course = c;
    this.build(c);
  }

  /** A new run: every lamp as the course laid it, the great lantern dark. */
  reset(): void {
    this.caught.clear();
    this.kindleWon = -1;
    this.guideK = 1;
    this.guideEnd = -1;
    this.guideWon = false;
    this.guidePulse = -9;
    this.gutter = false;
    this.flare = -9;
    this.flameOut = -1;
    this.greatLit = -1;
    this.greatWon = false;
    this.greatSide = 0;
    this.greatWalk = -1;
    if (this.greatNode) this.greatNode.position.set(0, 0, 0);
    this.surge = 0;
    this.tallZ = 0;
    if (this.valley) (this.valley.material as ShaderMaterial).uniforms.uRelease.value = -1;
  }

  /** Ground the canal keeps clear of the forest (props.ts asks through world.ts). */
  clearings(z0: number, z1: number, out: Clearing[]): void {
    for (const r of this.reaches) if (r.z1 >= z0 - 10 && r.z0 <= z1 + 10) out.push({ side: r.side, e: CANAL_E, z0: r.z0 - 4, z1: r.z1 + 4, w: CANAL_W / 2 + 4 });
  }

  private dispose(): void {
    for (const o of [...this.root.children]) this.root.remove(o);
    for (const o of this.owned) o.dispose();
    this.owned.length = 0;
    this.valley = this.sprites = null;
    this.sheets = this.puffs = this.pools = this.canal = this.greatPaper = this.tall = null;
    this.lampMesh = null;
    this.greatRoot = this.greatNode = null;
    this.lamps = [];
    this.reaches = [];
    this.built = false;
  }

  private keep<T extends { dispose(): void }>(o: T): T {
    this.owned.push(o);
    return o;
  }

  private build(c: Course): void {
    this.dispose();
    this.plays = [];
    this.dark.clear();
    this.reset();
    if (c.biome !== 'lantern' || !c.cloud) return;
    const low = this.detail === 'low';
    const B = BUDGET[this.detail];
    const cl = c.cloud;
    this.cloudTop = c.ground(c.centerX(cl.z0 + 62), cl.z0 + 62) + 3;
    this.buildValley(c, B.valley, B.release, low);
    this.buildSheets(B.sheets, low);
    this.buildPuffs(B.puffs);
    this.buildSprites(B.sprites, low);
    this.buildPools(low ? 40 : 96);
    this.buildLamps(c);
    if (!low) this.buildCanal(c);
    this.buildGreat(c);
    const tall = new Mesh(this.keep(tallLamplighter()), this.keep(makeToonMaterial({ coolShade: 0.35, rim: 0.55 })));
    tall.visible = false;
    tall.frustumCulled = false;
    this.tall = tall;
    this.root.add(tall);
    this.built = true;
  }

  private buildValley(c: Course, n: number, release: number, low: boolean): void {
    rs = 0x1a27e2;
    const cl = c.cloud!;
    const zA = cl.z1 - 70;
    const zB = c.finishZ + 760;
    // The valley's own, then as many again for the Great Rising, then the town's release.
    const total = n * 2 + release;
    const P = new Float32Array(total * 3);
    const A = new Float32Array(total * 4);
    const Bb = new Float32Array(total * 2);
    const deck = c.ground(c.centerX(cl.z1), cl.z1) + 16;
    for (let i = 0; i < n * 2; i++) {
      const z = zA + rnd() * (zB - zA);
      const zc = Math.min(z, c.finishZ + 250);
      const cx = c.centerX(zc);
      const hw = c.halfWidth(zc);
      const yc = c.ground(cx, zc) - Math.max(0, z - zc) * 0.05;
      const r = rnd();
      const side = rnd() < 0.5 ? -1 : 1;
      let off: number;
      let y0: number;
      let size: number;
      const near = r < 0.17;
      if (near) {
        // Beside the run: lanterns a rider passes among, each a paper lantern at the lens. They drift up
        // slowly through the first few tens of metres, so a frame always holds some at the rider's height.
        // (Round 8, the review loop: from 11 m out and at 2.2 m they were orange discs at frame size; nearer and a
        // little larger, a rider passes paper lanterns with ribs and caps.)
        off = hw + 8 + Math.pow(rnd(), 1.4) * 60;
        y0 = c.ground(cx + side * off, zc) + 1.5 + rnd() * 12;
        size = 2.6 + rnd() * 1.8;
      } else if (r < 0.22) {
        // Over the road, well above any flight.
        off = rnd() * (hw + 13);
        y0 = yc + 42 + rnd() * 120;
        size = 3 + rnd() * 2;
      } else if (r < 0.56) {
        off = 95 + rnd() * 400;
        y0 = yc - 30 + Math.pow(rnd(), 1.6) * 420;
        size = 5 + rnd() * 5;
      } else {
        // The far valley: the thousands. Bigger than life, as a far thing is drawn.
        off = 480 + Math.pow(rnd(), 1.25) * 1900;
        y0 = yc - 110 + Math.pow(rnd(), 1.4) * 620;
        size = 11 + rnd() * 11;
      }
      const range = near ? 26 + rnd() * 44 : 70 + rnd() * 190;
      y0 = Math.min(y0, deck - 20 - range * 0.5);
      P[i * 3] = cx + side * off;
      P[i * 3 + 1] = y0;
      P[i * 3 + 2] = -z;
      A[i * 4] = rnd();
      A[i * 4 + 1] = near ? 0.5 + rnd() * 0.9 : 1.3 + rnd() * 2.4;
      A[i * 4 + 2] = size;
      A[i * 4 + 3] = range;
      Bb[i * 2] = rnd();
      Bb[i * 2 + 1] = i < n ? 0 : 1;
    }
    // What Firstlight lets go when the great lantern lights: from the square, the street and the roofs.
    for (let k = 0; k < release; k++) {
      const i = n * 2 + k;
      const z = c.finishZ - 60 + rnd() * 190;
      const cx = c.centerX(z);
      const hw = c.halfWidth(z);
      const off = (rnd() < 0.5 ? -1 : 1) * (hw + 3 + Math.pow(rnd(), 1.3) * 46);
      P[i * 3] = cx + off;
      P[i * 3 + 1] = c.ground(cx + off, z) + 2 + rnd() * 9;
      P[i * 3 + 2] = -z;
      A[i * 4] = Math.pow(rnd(), 1.5) * 7;
      A[i * 4 + 1] = 2.4 + rnd() * 2.8;
      A[i * 4 + 2] = 0.9 + rnd() * 0.7;
      A[i * 4 + 3] = 1;
      Bb[i * 2] = rnd();
      Bb[i * 2 + 1] = 2;
    }
    // The valley's floor is lived in: hamlets out on it, each a pool of lamplight seen from the break, so
    // the lanterns rise from a lit country and not from a dark patch.
    this.hamlets = [];
    for (let k = 0; k < 18; k++) {
      const z = cl.z1 + 260 + rnd() * (c.finishZ + 500 - cl.z1 - 260);
      const zc = Math.min(z, c.finishZ + 250);
      const cx = c.centerX(zc);
      const side = k % 2 === 0 ? -1 : 1;
      const off = 170 + Math.pow(rnd(), 1.3) * 1150;
      const x = cx + side * off;
      this.hamlets.push([x, c.ground(x, zc) - Math.max(0, z - zc) * 0.05 + 6, z, 70 + rnd() * 90]);
    }
    const g = this.keep(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(P, 3));
    g.setAttribute('aA', new BufferAttribute(A, 4));
    g.setAttribute('aB', new BufferAttribute(Bb, 2));
    const pts = new Points(g, this.keep(valleyMaterial(low)));
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    pts.visible = false;
    this.valley = pts;
    this.valleyN = n;
    this.root.add(pts);
  }

  private buildSheets(n: number, low: boolean): void {
    const parts: BufferGeometry[] = [];
    for (let k = 0; k < n; k++) {
      const g = new CircleGeometry(1, low ? 20 : 40);
      g.rotateX(-Math.PI / 2);
      // The crests on top, the floor lowest. One sheet (Low) is the floor alone.
      const l = n === 1 ? 1 : k / (n - 1);
      g.translate(0, -l * (n === 3 ? 0.0092 : 0.006), 0);
      const a = new Float32Array(g.getAttribute('position').count).fill(l);
      g.setAttribute('aL', new BufferAttribute(a, 1));
      g.deleteAttribute('uv');
      g.deleteAttribute('normal');
      parts.push(g);
    }
    // (Drawn floor first, crests last: the merge keeps the order, so the sheets blend back to front.)
    const geo = this.keep(merge(parts.reverse()));
    const m = new Mesh(geo, this.keep(sheetMaterial(low)));
    m.frustumCulled = false;
    m.renderOrder = 2;
    m.visible = false;
    m.scale.setScalar(2600);
    this.sheets = m;
    this.root.add(m);
  }

  private buildPuffs(n: number): void {
    const g = this.keep(new InstancedBufferGeometry());
    const q = new PlaneGeometry(1, 1);
    g.setAttribute('position', q.getAttribute('position'));
    g.setIndex(q.getIndex());
    this.puffP = new Float32Array(n * 4);
    this.puffQ = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) this.puffP[i * 4 + 1] = -1e5;
    const aP = new InstancedBufferAttribute(this.puffP, 4);
    const aQ = new InstancedBufferAttribute(this.puffQ, 4);
    aP.setUsage(DynamicDrawUsage);
    aQ.setUsage(DynamicDrawUsage);
    g.setAttribute('aP', aP);
    g.setAttribute('aQ', aQ);
    g.instanceCount = n;
    const m = new Mesh(g, this.keep(puffMaterial()));
    m.frustumCulled = false;
    m.renderOrder = 3;
    m.visible = false;
    this.puffs = m;
    this.root.add(m);
  }

  private buildSprites(n: number, low: boolean): void {
    this.spP = new Float32Array(n * 3);
    this.spS = new Float32Array(n * 3);
    this.spC = new Float32Array(n * 3);
    const g = this.keep(new BufferGeometry());
    for (const [name, arr] of [['position', this.spP], ['aS', this.spS], ['aC', this.spC]] as const) {
      const a = new BufferAttribute(arr, 3);
      a.setUsage(DynamicDrawUsage);
      g.setAttribute(name, a);
    }
    const pts = new Points(g, this.keep(spriteMaterial(low)));
    pts.frustumCulled = false;
    pts.renderOrder = 7;
    this.sprites = pts;
    this.root.add(pts);
  }

  private buildPools(n: number): void {
    const g = this.keep(new InstancedBufferGeometry());
    const q = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    g.setAttribute('position', q.getAttribute('position'));
    g.setIndex(q.getIndex());
    this.poolP = new Float32Array(n * 4);
    this.poolG = new Float32Array(n * 4);
    this.poolQ = new Float32Array(n * 4);
    for (const [name, arr] of [['aP', this.poolP], ['aG', this.poolG], ['aQ', this.poolQ]] as const) {
      const a = new InstancedBufferAttribute(arr, 4);
      a.setUsage(DynamicDrawUsage);
      g.setAttribute(name, a);
    }
    g.instanceCount = 0;
    const m = new Mesh(g, this.keep(poolMaterial()));
    m.frustumCulled = false;
    m.renderOrder = 5;
    m.visible = false;
    this.pools = m;
    this.root.add(m);
  }

  /** Way lamps the length of the mountain: a pair every WAY_STEP metres, one each side, staggered; closer
   *  together in the cloud, where they are what a rider steers by. None where a site stands, on a wall or on
   *  a ledge's face; in a walled stretch a lantern hangs on the wall instead. */
  private buildLamps(c: Course): void {
    const cl = c.cloud!;
    const list: WayLamp[] = [];
    let k = 0;
    for (let z = 46; z < c.finishZ - 20; k++) {
      const inCloud = z > cl.z0 + 40 && z < cloudLetGo(cl);
      const side = k % 2 === 0 ? -1 : 1;
      const sec = c.section(z);
      const open = sec.kind !== 'street' && sec.kind !== 'bridge' && sec.kind !== 'tunnel' && sec.kind !== 'finish' && sec.kind !== 'start';
      if (open && !ledgeAt(c, z, 8)) {
        const limit = c.edgeLimit(z);
        const hung = limit < WAY_E + 1.2 || !standable(c, z, WAY_E);
        const e = hung ? Math.max(0.5, Math.min(limit, WAY_E) - 0.2) : WAY_E;
        const x = c.centerX(z) + side * (c.halfWidth(z) + e);
        if (!this.kept(x, z)) list.push({ x, y: hung ? c.ground(x, z) + 3.1 : visualGround(c, x, z) - 0.1, z, hung, seed: (k * 0.618034) % 1 });
      }
      z += (inCloud ? WAY_STEP * 0.72 : WAY_STEP) / 2;
    }
    this.lamps = list;
    const posts = list.filter((l) => !l.hung);
    // (One more instance: the brazier that feeds a low flame, stood when a run's carry has one.)
    const mesh = new InstancedMesh(this.keep(wayLampGeometry()), this.keep(makeToonMaterial({ coolShade: 0.45, rim: 0.3, nearFade: [1.6, 3.4], stone: true })), posts.length + 1);
    posts.forEach((l, i) => {
      tm.compose(tv.set(l.x, l.y, -l.z), tq.setFromAxisAngle(UP, l.seed * 6.283), ts.setScalar(1));
      mesh.setMatrixAt(i, tm);
    });
    tm.makeScale(0, 0, 0);
    mesh.setMatrixAt(posts.length, tm);
    // (Only the posts within LAMP_BACK and LAMP_AHEAD of the rider are drawn: the whole mountain's were up to
    // 46 thousand triangles in every frame, most of them behind a ridge or out of sight in the air.)
    this.lampAll = new Float32Array(mesh.instanceMatrix.array as Float32Array);
    this.lampZ = posts.map((l) => l.z);
    this.lampWin = '';
    mesh.frustumCulled = false;
    this.lampMesh = mesh;
    this.root.add(mesh);
  }

  /** The canal: a stone channel of level water down the open stretches of the Lamp Road, on the bank, with
   *  kerbs that stand a hand over the water and walls that run down into the snow. */
  private buildCanal(c: Course): void {
    const reaches: Reach[] = [];
    let cur: Reach | null = null;
    const cl = c.cloud!;
    for (let z = cl.z1 + 200; z < c.finishZ - 620; z += 6) {
      const sec = c.section(z);
      const ok = (sec.kind === 'fork' || sec.kind === 'bowl' || sec.kind === 'benches' || sec.kind === 'cruise' || sec.kind === 'treerun') && z > sec.z0 + 14 && z < sec.z1 - 14 && !ledgeAt(c, z, 30);
      const side = sec.side;
      const x = c.centerX(z) + side * (c.halfWidth(z) + CANAL_E);
      // (An open bank, not a walled one: the shoulder a sled may ride is at most ten metres, and the canal lies
      // past it. The first cut asked for a shoulder wider than the canal's far kerb, which no metre of the
      // course has, so the river of lights was never built.)
      if (ok && standable(c, z, CANAL_E) && !this.kept(x, z) && c.edgeLimit(z) >= 7) {
        if (!cur || cur.side !== side) {
          cur = { pts: [], side, z0: z, z1: z };
          reaches.push(cur);
        }
        // Level water: the lowest of the ground across the channel, so its uphill kerb is a step.
        let y = Infinity;
        for (const u of [-0.5, 0, 0.5]) y = Math.min(y, visualGround(c, x + u * CANAL_W, z));
        cur.pts.push([x, y - 0.25, z]);
        cur.z1 = z;
      } else cur = null;
    }
    this.reaches = reaches.filter((r) => r.pts.length > 8);
    if (!this.reaches.length) return;
    const P: number[] = [];
    const U: number[] = [];
    const K: number[] = [];
    const quad = (a: number[], b: number[], cc: number[], d: number[], ua: number[], ub: number[], uc: number[], ud: number[], kind: number) => {
      P.push(...a, ...b, ...cc, ...a, ...cc, ...d);
      U.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
      for (let i = 0; i < 6; i++) K.push(kind);
    };
    for (const r of this.reaches) {
      // The water never climbs: each sample is no higher than the one above it.
      for (let i = 1; i < r.pts.length; i++) r.pts[i][1] = Math.min(r.pts[i][1], r.pts[i - 1][1]);
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x0, y0, z0] = r.pts[i];
        const [x1, y1, z1] = r.pts[i + 1];
        const h = CANAL_W / 2;
        const v0 = z0 - r.z0;
        const v1 = z1 - r.z0;
        quad([x0 - h, y0, -z0], [x0 + h, y0, -z0], [x1 + h, y1, -z1], [x1 - h, y1, -z1], [0, v0], [1, v0], [1, v1], [0, v1], 0);
        for (const s of [-1, 1]) {
          const a0 = x0 + s * h;
          const a1 = x1 + s * h;
          const b0 = x0 + s * (h + 0.7);
          const b1 = x1 + s * (h + 0.7);
          // The kerb's inner face, its snowy top, and the wall outside it down into the bank.
          quad([a0, y0, -z0], [a0, y0 + 0.5, -z0], [a1, y1 + 0.5, -z1], [a1, y1, -z1], [0, v0], [0, v0], [0, v1], [0, v1], 1);
          quad([a0, y0 + 0.5, -z0], [b0, y0 + 0.5, -z0], [b1, y1 + 0.5, -z1], [a1, y1 + 0.5, -z1], [0, v0], [0, v0], [0, v1], [0, v1], 2);
          quad([b0, y0 + 0.5, -z0], [b0, y0 - 3, -z0], [b1, y1 - 3, -z1], [b1, y1 + 0.5, -z1], [0, v0], [0, v0], [0, v1], [0, v1], 1);
        }
      }
    }
    const g = this.keep(new BufferGeometry());
    g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('aUv', new BufferAttribute(new Float32Array(U), 2));
    g.setAttribute('aKind', new BufferAttribute(new Float32Array(K), 1));
    const mat = this.keep(waterMaterial(false));
    mat.side = DoubleSide;
    const m = new Mesh(g, mat);
    m.frustumCulled = false;
    this.canal = m;
    this.root.add(m);
  }

  private buildGreat(c: Course): void {
    const z = c.finishZ + GREAT_Z;
    const cx = c.centerX(z);
    const X = c.halfWidth(z) + c.edgeLimit(z) + 3.2;
    const g0 = c.ground(cx, z);
    const top = GREAT_Y + 11.6;
    const root = new Object3D();
    root.position.set(cx, g0, -z);
    const lan = greatLantern(3.3, 6.6);
    lan.frame.translate(0, top, 0);
    const toon = this.keep(makeToonMaterial({ coolShade: 0.4, rim: 0.3 }));
    const frame = new Mesh(this.keep(greatFrame(X, top, (x) => visualGround(c, cx + x, z) - g0)), toon);
    // (Round 8: the lantern's ribs, cap and chains in a draw of their own, so it can be walked along the yoke.)
    const ribs = new Mesh(this.keep(merge([lan.frame, ...greatChains(top)])), toon);
    // The paper: dark until lit. The emissive is the light inside it.
    const paper = new Mesh(this.keep(lan.paper), this.keep(makeToonMaterial({ coolShade: 0.25, rim: 0.2, emissive: new Color('#FFB84E'), emissiveStrength: 0 })));
    paper.position.y = top;
    const node = new Object3D();
    node.userData.reach = Math.max(0, X - 4.5);
    for (const m of [frame, ribs, paper]) m.frustumCulled = false;
    node.add(ribs, paper);
    root.add(frame, node);
    this.greatRoot = root;
    this.greatPaper = paper;
    this.greatNode = node;
    this.root.add(root);
  }

  // ---------------------------------------------------------------- per frame

  private sprite(x: number, y: number, z: number, size: number, kind: number, col: Color, lum: number, seed = 0): void {
    const i = this.nSp;
    if (i * 3 >= this.spP.length) return;
    this.spP[i * 3] = x;
    this.spP[i * 3 + 1] = y;
    this.spP[i * 3 + 2] = -z;
    this.spS[i * 3] = size;
    this.spS[i * 3 + 1] = kind;
    this.spS[i * 3 + 2] = seed;
    this.spC[i * 3] = col.r * lum;
    this.spC[i * 3 + 1] = col.g * lum;
    this.spC[i * 3 + 2] = col.b * lum;
    this.nSp = i + 1;
  }

  /** A lamp's flame: the flame, and the glow round it. */
  private flameAt(x: number, y: number, z: number, k: number, col: Color, lum: number, seed: number): void {
    this.sprite(x, y + 0.28 * k, z, 0.85 * k, 1, col, lum, seed);
    this.sprite(x, y + 0.2 * k, z, 2.2 * k, 0, col, 0.2 * lum, seed);
  }

  private pool(c: Course, x: number, z: number, w: number, len: number, col: Color, lum: number): void {
    const i = this.nPool;
    if (i * 4 >= this.poolP.length || lum <= 0.01) return;
    c.gradient(x, z, grad);
    this.poolP[i * 4] = x;
    this.poolP[i * 4 + 1] = c.ground(x, z) + 0.1;
    this.poolP[i * 4 + 2] = -z;
    this.poolP[i * 4 + 3] = 0;
    // (The course's gradient is per metre of sim x and z; the pool's own +z is three.js z, which is -sim z.)
    this.poolG[i * 4] = grad.x;
    this.poolG[i * 4 + 1] = -grad.z;
    this.poolG[i * 4 + 2] = w;
    this.poolG[i * 4 + 3] = len;
    this.poolQ[i * 4] = col.r;
    this.poolQ[i * 4 + 1] = col.g;
    this.poolQ[i * 4 + 2] = col.b;
    this.poolQ[i * 4 + 3] = lum;
    this.nPool = i + 1;
  }

  /** The director's beats: the moments the picture answers at once. */
  beats(list: readonly Beat[], s: Snap): void {
    if (!this.built) return;
    for (const b of list) {
      if (b.type === 'finish') {
        if (this.greatLit < 0) this.greatLit = this.time + (this.greatWon ? 0 : 1.1);
        continue;
      }
      if (b.type !== 'moment') continue;
      const carrier = tv.set(s.vx, 0, -s.vz);
      if (b.verb === 'follow') {
        if (b.phase === 'step') {
          this.guidePulse = this.time;
        } else if (b.phase === 'won' || b.phase === 'lost') {
          this.guideEnd = this.time;
          this.guideWon = b.phase === 'won';
        }
      } else if (b.verb === 'kindle') {
        if (b.phase === 'won') {
          this.kindleWon = this.time;
          this.particles.sparkle(ts.set(s.x, s.y + 1.2, -s.z), MARIGOLD, 46, 5, 0.9, 0.28, carrier, 0.6);
        }
      } else if (b.verb === 'carry') {
        if (b.phase === 'trail') this.gutter = true;
        else if (b.phase === 'lead') {
          this.gutter = false;
          this.flare = this.time;
          this.particles.sparkle(ts.set(s.x, s.y + 1.3, -s.z), WHITE_GOLD, 26, 3.4, 0.6, 0.22, carrier, 0.6);
        } else if (b.phase === 'step') {
          // (A step is the flame a tenth lower, or a hit: sparks off it either way.)
          this.particles.sparkle(ts.set(s.x, s.y + 1.2, -s.z), EMBER, 8, 2.2, 0.5, 0.16, carrier, 0.2);
        } else if (b.phase === 'won') {
          this.greatWon = true;
          this.greatLit = this.time;
        } else if (b.phase === 'lost') this.flameOut = this.time;
      }
    }
  }

  update(dt: number, time: number, mode: 'run' | 'title' | 'results', s: Snap, sim: Sim | null, cam: { position: Vector3 }, p: Palette): void {
    if (!this.built || !this.course) return;
    const c = this.course;
    this.time = time;
    const low = this.detail === 'low';
    const B = BUDGET[this.detail];
    const run = mode !== 'title' && sim !== null && sim.course === c;
    // (The title's reel rides a stretch of its own, keyart.ts: the cloud and the valley are where its hero is.)
    const z = Math.max(0, s.z);
    const cl = c.cloud!;
    const inCloud = cloudDepth(c, z);
    const fogR: [number, number] = [shared.uFogNear.value, shared.uFogFar.value];

    // The run's own variants: which lamps wait dark.
    const plays = run ? sim!.plays : this.plays.length ? this.plays : momentPlays(c);
    if (plays !== this.plays) {
      this.plays = plays;
      this.dark.clear();
      for (const pl of plays) if (pl.verb === 'kindle') pl.lamps.forEach((l, i) => l.dark && this.dark.set(Math.round(l.x * 8) * 100003 + Math.round(l.z * 8), { play: pl.index, i }));
      this.placeBrazier(c);
    }
    const mo = run ? sim!.mo : null;

    // ------------------------------------------------ the sea of cloud, from above
    if (this.sheets) {
      const above = cam.position.y - this.cloudTop;
      // (Only from well above its top, and gone once the dive has begun: below its top the sheet met the
      // slope, and the ground standing through it cut a hard-edged hole under the first flight.)
      const k = (1 - inCloud) * smooth01((above - 4) / 20) * (1 - smooth01((z - cl.z0) / 50));
      this.sheets.visible = k > 0.01;
      if (this.sheets.visible) {
        this.sheets.position.set(cam.position.x, this.cloudTop, cam.position.z);
        const u = (this.sheets.material as ShaderMaterial).uniforms;
        u.uK.value = k;
        // (Nearer the cloud's own violet than the snow's silver: at 0.6 of the snow the sea read as one more snowfield.)
        u.uLit.value.copy(p.clouds.lit).lerp(p.snowLit, 0.25);
        u.uShade.value.copy(p.clouds.shade).lerp(p.skyHorizon, 0.1);
        u.uRim.value.copy(p.rim);
        // (Low's flat values have no bloom to soften the pools: at High's strength they read as lava.)
        u.uWarm.value.copy(p.deck.glow).multiplyScalar(p.massif.seaWarm * (low ? 0.4 : 0.95));
        u.uHaze.value.copy(p.skyHorizon).lerp(p.fog, 0.3);
        u.uMoon.value.copy(p.diskDir);
      }
    }

    // ------------------------------------------------ in the cloud: banks of it at the lens
    if (this.puffs) {
      this.puffs.visible = inCloud > 0.02;
      if (this.puffs.visible) {
        const n = this.puffP.length / 4;
        const reach = 62;
        const fx = Math.sin(s.heading);
        const fz = -Math.cos(s.heading);
        let dirty = false;
        for (let i = 0; i < n; i++) {
          const dx = this.puffP[i * 4] - cam.position.x;
          const dz = this.puffP[i * 4 + 2] - cam.position.z;
          const ahead = dx * fx + dz * fz;
          if (this.puffP[i * 4 + 1] < -9e4 || ahead < -6 || ahead > reach + 12 || Math.abs(dx * fz - dz * fx) > 44) {
            // A new bank, down the run: further for the first fill, so they do not all arrive at once.
            const d = this.puffP[i * 4 + 1] < -9e4 ? 8 + rnd() * reach : reach * (0.75 + rnd() * 0.3);
            const lat = (rnd() - 0.5) * 60;
            const wx = cam.position.x + fx * d - fz * lat;
            const wz = cam.position.z + fz * d + fx * lat;
            const size = 12 + rnd() * 16;
            this.puffP[i * 4] = wx;
            this.puffP[i * 4 + 1] = c.ground(wx, -wz) + size * (0.1 + rnd() * 0.5);
            this.puffP[i * 4 + 2] = wz;
            this.puffP[i * 4 + 3] = size;
            const v = 0.92 + rnd() * 0.2;
            this.puffQ[i * 4] = v;
            this.puffQ[i * 4 + 1] = v;
            this.puffQ[i * 4 + 2] = v;
            this.puffQ[i * 4 + 3] = 0.2 + rnd() * 0.22;
            dirty = true;
          }
        }
        // The banks drift across the run on the wind.
        for (let i = 0; i < n; i++) this.puffP[i * 4] += dt * 1.6;
        const g = this.puffs.geometry as InstancedBufferGeometry;
        (g.getAttribute('aP') as InstancedBufferAttribute).needsUpdate = true;
        if (dirty) (g.getAttribute('aQ') as InstancedBufferAttribute).needsUpdate = true;
        const u = (this.puffs.material as ShaderMaterial).uniforms;
        u.uK.value = inCloud;
        u.uReach.value = reach;
        // Their colour is the air's own, a little above and below it: tinted in the buffer by value only.
        const col = shared.uFog.value;
        {
          for (let i = 0; i < n; i++) {
            const v = 0.92 + ((i * 0.618034) % 1) * 0.2;
            this.puffQ[i * 4] = col.r * v;
            this.puffQ[i * 4 + 1] = col.g * v;
            this.puffQ[i * 4 + 2] = col.b * v;
          }
          (g.getAttribute('aQ') as InstancedBufferAttribute).needsUpdate = true;
        }
      }
    }

    // ------------------------------------------------ the valley of lanterns
    const lg = run ? sim!.legend : null;
    const rising = !!lg && lg.key === 'rising' && sim!.lg.phase === 2;
    this.surge += ((rising ? 1 : 0) - this.surge) * Math.min(1, dt * (rising ? 1.4 : 0.5));
    // Under the deck only: nothing of the valley shows from the Crown, or through the cloud.
    const below = smooth01((z - (cloudLetGo(cl) - 12)) / 46);
    this.show += (below - this.show) * Math.min(1, dt * 6);
    if (this.valley) {
      const u = (this.valley.material as ShaderMaterial).uniforms;
      this.valley.visible = this.show > 0.01 || u.uRelease.value >= 0;
      u.uShow.value = this.show;
      u.uSurge.value = this.surge;
      u.uH.value = this.hPx;
      u.uFogR.value = fogR;
      this.valley.geometry.setDrawRange(0, this.surge > 0.01 || u.uRelease.value >= 0 ? this.valleyN * 2 + BUDGET[this.detail].release : this.valleyN);
    }

    // ------------------------------------------------ the frame's own lights
    this.windowLamps(z);
    this.nSp = 0;
    this.nPool = 0;
    const lampK = Math.min(1.25, 0.55 + 0.5 * p.lamps);
    // Way lamps: flames to the tier's reach, light on the snow from the near ones.
    for (const l of this.lamps) {
      const d = l.z - z;
      if (d < -45 || d > B.lampAhead) continue;
      const fl = 0.85 + 0.15 * Math.sin(time * 7 + l.seed * 50) * Math.sin(time * 3.1 + l.seed * 20);
      const y = l.hung ? l.y : l.y + WAY_LAMP_FLAME;
      if (l.hung) this.sprite(l.x, y, l.z, 1.15, 2, FLAME, 1.25 * fl, l.seed);
      else this.sprite(l.x, y + 0.26, l.z, 0.8, 1, FLAME, 1.5 * fl, l.seed);
      if (d < (low ? 90 : 170)) this.sprite(l.x, y + 0.2, l.z, 2.4, 0, FLAME, 0.16 * fl, l.seed);
      if (d > -22 && d < 84) pushLocalLight(l.x, y + 0.4, -l.z, LAMP_RGB[0], LAMP_RGB[1], LAMP_RGB[2], l.hung ? 14 : 16.5, 1.1 * fl * lampK);
      // Its pool on the snow, reaching in toward the line: the light falls off with distance and was gone a
      // few metres in, so a lamp lit nothing a rider could see. (Medium and High: Low keeps its draws.)
      if (!low && d > -24 && d < 150) {
        const toward = Math.sign(c.centerX(l.z) - l.x);
        this.pool(c, l.x + toward * 3.2, l.z, 11, 12, MARIGOLD, 0.16 * fl * Math.min(1.2, p.lamps));
      }
    }
    // The stone lamps the sim stands in the run: lit, unless one waits to be kindled.
    const ci = Math.floor(z / CHUNK_LEN);
    for (let k = Math.max(0, ci - 1); k <= ci + (low ? 3 : 5); k++) {
      for (const o of c.chunk(k).obstacles) {
        if (o.kind !== 'lantern') continue;
        const key = Math.round(o.x * 8) * 100003 + Math.round(o.z * 8);
        const dk = this.dark.get(key);
        const seed = (o.id * 0.618034) % 1;
        const fy = o.y + 1.02 * (o.scale || 1);
        let lum = 1.5;
        let size = 1;
        if (dk && run) {
          const pl = plays[dk.play];
          const active = mo!.active === pl.index;
          const done = mo!.next > pl.index && !active;
          const won = ((sim!.stats.momentMask >> pl.index) & 1) === 1;
          const ck = dk.play * 64 + dk.i;
          let at = this.caught.get(ck);
          if (active && at === undefined && (mo!.mask >> dk.i) & 1) {
            at = time;
            this.caught.set(ck, at);
            // It catches: a burst off the lamp's head, in the lamp's own light.
            this.particles.sparkle(ts.set(o.x, fy + 0.3, -o.z), WHITE_GOLD, 18, 3, 0.55, 0.2, null, 0.7);
          }
          if (at === undefined && !(done && won)) {
            // Dark: a cold glint in the box, and a mark on the snow where a sled passing lights it.
            this.sprite(o.x, fy + 0.1, o.z, 0.5, 0, COLD, 0.55 + 0.2 * Math.sin(time * 2 + seed * 9), seed);
            if (!done) {
              const l = pl.lamps[dk.i];
              const near = active && o.z > z - 2;
              this.pool(c, o.x - l.side * 2.1, o.z, 2.6, 4.2, MARIGOLD, near ? 0.3 + 0.12 * Math.sin(time * 5 + dk.i) : 0.12);
            }
            continue;
          }
          const t = at === undefined ? 9 : time - at;
          size = 1 + 1.6 * Math.exp(-t * 4);
          // (A catch is a flare in the lamp, not in the air round the lens: at 2.4 and a light to match, a row
          // catching at once washed the near plane peach.)
          lum = 1.5 + 1.3 * Math.exp(-t * 3);
        }
        // A road that is won blazes: every lamp of it stands taller, and lets a lantern go.
        const pk = this.playAt(plays, o.z);
        if (pk && this.kindleWon >= 0 && pk.verb === 'kindle') {
          const t = time - this.kindleWon - Math.max(0, (o.z - z) * 0.012);
          if (t > 0) {
            size *= 1.25 + 0.9 * Math.exp(-t * 0.5);
            lum *= 1.2 + 0.8 * Math.exp(-t * 0.6);
            const rise = t - seed * 1.5;
            if (rise > 0 && rise < 9) this.sprite(o.x, fy + 0.6 + rise * (1.6 + rise * 0.22), o.z, 0.8, 2, FLAME, 1.4 * (1 - smooth01((rise - 6) / 3)), seed);
          }
        }
        const fl = 0.86 + 0.14 * Math.sin(time * 8 + seed * 40);
        this.flameAt(o.x, fy, o.z, size, FLAME, lum * fl, seed);
        const d = o.z - z;
        if (d > -20 && d < 70) pushLocalLight(o.x, fy + 0.5, -o.z, LAMP_RGB[0], LAMP_RGB[1], LAMP_RGB[2], 9.5 + 3 * (size - 1), Math.min(1.15, 0.75 * lum * fl * 0.66) * lampK);
      }
    }
    // Floats on the canal, near the lens: the nearest of the water's lights, as light.
    if (B.floats > 0) {
      for (const r of this.reaches) {
        if (r.z1 < z - 30 || r.z0 > z + 220) continue;
        for (let k = 0; k < B.floats; k++) {
          const along = (((k * 0.618034 + time * 0.011 * (0.8 + (k % 5) * 0.1)) % 1) + 1) % 1;
          const fi = along * (r.pts.length - 1);
          const i0 = Math.floor(fi);
          const a = r.pts[i0];
          const b = r.pts[Math.min(r.pts.length - 1, i0 + 1)];
          const u = fi - i0;
          const fzz = a[2] + (b[2] - a[2]) * u;
          if (fzz < z - 30 || fzz > z + 220) continue;
          const lane = (((k * 0.37) % 1) - 0.5) * (CANAL_W - 2);
          this.sprite(a[0] + (b[0] - a[0]) * u + lane, a[1] + (b[1] - a[1]) * u + 0.45, fzz, 0.85, 2, FLAME, 1.4, (k * 0.37) % 1);
        }
        const mid = Math.max(r.z0, Math.min(r.z1, z + 18));
        if (Math.abs(mid - z) < 60) {
          const i = Math.min(r.pts.length - 1, Math.round(((mid - r.z0) / Math.max(1, r.z1 - r.z0)) * (r.pts.length - 1)));
          pushLocalLight(r.pts[i][0], r.pts[i][1] + 1.2, -r.pts[i][2], 1, 0.6, 0.2, 15, 0.6 * lampK);
        }
      }
    }

    if (run) {
      this.follow(c, s, sim!, time, dt, low, lampK);
      this.carry(c, s, sim!, time, dt, lampK);
      this.lamplighter(c, s, sim!, time, low, lampK);
    } else if (this.tall) this.tall.visible = false;
    this.aimLegend(run ? sim : null, s);
    this.great(c, s, time, dt, mode, lampK, cam);

    // The hamlets on the valley's floor: a wide pool of marigold each and a few windows in it. (Last, so a
    // full budget drops a far hamlet and never the guide light or the carried flame.)
    if (this.show > 0.01) {
      for (let k = 0; k < this.hamlets.length; k++) {
        const h = this.hamlets[k];
        const d = h[2] - z;
        if (d < 120 || d > 2600) continue;
        const near = smooth01((d - 120) / 200) * this.show;
        this.sprite(h[0], h[1], h[2], h[3], 0, FLAME, 0.45 * near, k * 0.13);
        if (low) continue;
        for (let j = 0; j < 4; j++) {
          const a = k * 2.4 + j * 1.9;
          this.sprite(h[0] + Math.cos(a) * h[3] * 0.16, h[1] + 2 + j * 1.5, h[2] + Math.sin(a) * h[3] * 0.16, 5 + j, 0, MARIGOLD, 0.9 * near, j * 0.2);
        }
      }
    }

    // Upload what the frame drew with.
    if (this.sprites) {
      const g = this.sprites.geometry;
      g.setDrawRange(0, this.nSp);
      this.sprites.visible = this.nSp > 0;
      for (const name of ['position', 'aS', 'aC']) (g.getAttribute(name) as BufferAttribute).needsUpdate = true;
      const u = (this.sprites.material as ShaderMaterial).uniforms;
      u.uH.value = this.hPx;
      u.uFogR.value = fogR;
      u.uCloud.value = inCloud;
    }
    if (this.pools) {
      const g = this.pools.geometry as InstancedBufferGeometry;
      g.instanceCount = this.nPool;
      this.pools.visible = this.nPool > 0;
      for (const name of ['aP', 'aG', 'aQ']) (g.getAttribute(name) as InstancedBufferAttribute).needsUpdate = true;
      (this.pools.material as ShaderMaterial).uniforms.uFogR.value = fogR;
    }
    if (this.canal) {
      // (Drawn while a reach is within 420 m: past that its lights are under a pixel.)
      this.canal.visible = this.reaches.some((r) => r.z1 > z - 60 && r.z0 < z + 420);
      (this.canal.material as ShaderMaterial).uniforms.uFogR.value = fogR;
    }
  }

  private playAt(plays: readonly MomentPlay[], z: number): MomentPlay | null {
    for (const p of plays) if (z >= p.z0 - 4 && z <= p.z1 + 4) return p;
    return null;
  }

  /** The brazier that feeds a low flame, where this run's carry has one (the last way-lamp instance). */
  private placeBrazier(c: Course): void {
    const m = this.lampMesh;
    if (!m) return;
    const r = this.plays.find((p) => p.verb === 'carry')?.relight ?? null;
    if (r) tm.compose(tv.set(r.x, c.ground(r.x, r.z) - 0.15, -r.z), tq.identity(), ts.set(1.7, 0.72, 1.7));
    else tm.makeScale(0, 0, 0);
    tm.toArray(this.lampAll, this.lampZ.length * 16);
    this.lampWin = '';
  }

  /** Draws the way lamps near the rider only: copies their matrices to the front of the buffer when the
   *  window moves on (a few times a second at most), the brazier's after them. */
  private windowLamps(z: number): void {
    const m = this.lampMesh;
    if (!m) return;
    const zs = this.lampZ;
    let i0 = 0;
    while (i0 < zs.length && zs[i0] < z - LAMP_BACK) i0++;
    let i1 = i0;
    while (i1 < zs.length && zs[i1] < z + LAMP_AHEAD) i1++;
    const key = i0 + ':' + i1;
    if (key === this.lampWin) return;
    this.lampWin = key;
    const a = m.instanceMatrix.array as Float32Array;
    a.set(this.lampAll.subarray(i0 * 16, i1 * 16), 0);
    a.set(this.lampAll.subarray(zs.length * 16, zs.length * 16 + 16), (i1 - i0) * 16);
    m.count = i1 - i0 + 1;
    m.instanceMatrix.needsUpdate = true;
  }

  /** Follow: the guide light, a lantern with a will of its own, and the wake it lays on the snow. */
  private follow(c: Course, s: Snap, sim: Sim, time: number, dt: number, low: boolean, lampK: number): void {
    const p = this.plays.find((q) => q.verb === 'follow');
    if (!p || !p.path || s.z < p.z0 - 320 || s.z > p.z1 + 140) return;
    const mo = sim.mo;
    const active = mo.active === p.index;
    const over = !active && mo.next > p.index;
    // It dims when the rider leaves its wake, and comes back when they return.
    const want = active ? (mo.ahead ? 1 : 0.38) : 0.8;
    this.guideK += (want - this.guideK) * Math.min(1, dt * 5);
    let k = this.guideK;
    let lift = 0;
    if (over) {
      const t = this.guideEnd < 0 ? 9 : time - this.guideEnd;
      if (t > 2.2) return;
      // Won, it climbs into the cloud and is gone in a flare; lost, it gutters where it hangs.
      if (this.guideWon) {
        lift = t * t * 9;
        k = 1.6 * (1 - smooth01((t - 1.2) / 1)) + 2.5 * Math.exp(-t * 6);
      } else k *= 1 - smooth01(t / 1.2);
    }
    const zl = Math.max(p.path.z0, Math.min(p.path.z1, s.z + GUIDE_AHEAD));
    const x = pathX(c, p.path, zl);
    const bob = 0.28 * Math.sin(time * 2.6) + 0.1 * Math.sin(time * 6.3);
    const y = c.ground(x, zl) + 2.3 + bob + lift;
    const pulse = Math.exp(-(time - this.guidePulse) * 4);
    // The light itself: a lantern, a white heart, a wide soft halo that the cloud spreads.
    this.sprite(x, y, zl, 1.5 + 0.5 * pulse, 2, WHITE_GOLD, 1.7 * k, 0.3);
    this.sprite(x, y - 0.1, zl, 0.9, 0, WHITE_GOLD, 2.2 * k);
    this.sprite(x, y, zl, 9 + 4 * pulse, 0, MARIGOLD, (0.6 + 0.5 * pulse) * k);
    // Three small lights that circle it, and a tail of them falling back down its line.
    for (let i = 0; i < 3; i++) {
      const a = time * 2.2 + (i * Math.PI * 2) / 3;
      this.sprite(x + Math.cos(a) * 0.9, y + Math.sin(a * 1.3) * 0.35, zl + Math.sin(a) * 0.9, 0.34, 0, WHITE_GOLD, 1.4 * k);
    }
    const tail = low ? 5 : 9;
    for (let i = 1; i <= tail; i++) {
      const zt = zl - i * 2.6;
      if (zt < p.path.z0) break;
      const xt = pathX(c, p.path, zt);
      const f = 1 - i / (tail + 1);
      this.sprite(xt + 0.3 * Math.sin(time * 3 + i), c.ground(xt, zt) + 0.5 + 1.7 * f * f + 0.15 * Math.sin(time * 4 + i * 1.7), zt, 0.3 + 0.35 * f, 0, MARIGOLD, 1.2 * f * k);
    }
    pushLocalLight(x, y, -zl, 1, 0.82, 0.42, 17, (1.1 + 0.6 * pulse) * Math.min(1.4, k) * lampK);
    // The wake: light lying on the snow from the rider to the lantern, as wide as the sim counts it. Whole
    // while the rider is in it; thin and cold when they are not.
    if (!over) {
      const inWake = active && mo.ahead;
      const from = Math.max(p.path.z0, s.z - 12);
      const col = inWake || !active ? MARIGOLD : COLD;
      for (let zt = from - (from % 5) + 5, n = 0; zt < zl - 2 && n < (low ? 6 : 9); zt += 5, n++) {
        const xt = pathX(c, p.path, zt);
        const near = 1 - Math.min(1, Math.abs(zt - s.z) / 40);
        // (Low adds it with no tone curve over the cloud's pale snow: at High's strength it clipped to a white glare
        // beside the sled, the review loop.)
        this.pool(c, xt, zt, 2 * p.hw + 0.6, 6.4, col, (inWake ? 0.5 : 0.2) * (low ? 0.45 : 1) * (0.5 + 0.5 * near) * (0.85 + 0.15 * Math.sin(time * 3 - zt * 0.3)));
      }
      if (inWake) pushLocalLight(pathX(c, p.path, s.z + 8), c.ground(s.x, s.z + 8) + 1.2, -(s.z + 8), 1, 0.8, 0.36, 10, 0.55 * lampK);
    }
  }

  /** Carry: the flame on the sled, as tall as it has left to burn; it gutters on a fall and catches again. */
  private carry(c: Course, s: Snap, sim: Sim, time: number, dt: number, lampK: number): void {
    const p = this.plays.find((q) => q.verb === 'carry');
    if (!p) return;
    const mo = sim.mo;
    const active = mo.active === p.index;
    const over = !active && mo.next > p.index;
    const mask = active ? mo.mask : 0;
    // The brazier that feeds a low flame.
    const r = p.relight;
    if (r && !over && s.z > p.z0 - 300 && s.z < r.z + 60) {
      const taken = (mask & 1) === 1;
      const gy = c.ground(r.x, r.z);
      const fl = 0.85 + 0.15 * Math.sin(time * 9);
      this.flameAt(r.x, gy + 1.5, r.z, taken ? 1.2 : 2.3, taken ? FLAME : WHITE_GOLD, (taken ? 1 : 1.9) * fl, 0.7);
      if (!taken) this.pool(c, r.x, r.z, 2 * r.r, 2 * r.r, MARIGOLD, 0.34 + 0.12 * Math.sin(time * 4));
      pushLocalLight(r.x, gy + 2, -r.z, 1, 0.62, 0.2, 16, (taken ? 0.7 : 1.3) * fl * lampK);
    }
    if (!active) {
      // Put out: a last curl of pale smoke off the prow.
      if (this.flameOut >= 0 && time - this.flameOut < 1.2) this.sprite(s.x, s.y + 1.2 + (time - this.flameOut) * 1.4, s.z, 0.8, 0, COLD, 0.5 * (1 - (time - this.flameOut) / 1.2));
      return;
    }
    const pace = Math.max(0, Math.min(1, mo.pace));
    if (pace <= 0) return;
    // (The simfix lane's guttering state: mo.at holds the ticks left to ride back up to the flame's pace,
    // and the 'trail' and 'lead' beats mark its ends. Without it, a flame under a third is a guttering one.)
    const gut = this.gutter || mo.at > 0 || pace < 0.22;
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    // (On a short staff at the sled's tail, a little to one side: the chase camera sees it over the rider's
    // shoulder, where a flame on the prow would hide behind the coat.)
    const x = s.x - fx * 0.5 + fz * 0.58;
    const zz = s.z - fz * 0.5 - fx * 0.58;
    const y = s.y + 1.7;
    const fl = gut ? 0.35 + 0.65 * Math.abs(Math.sin(time * 19) * Math.sin(time * 7.3)) : 0.88 + 0.12 * Math.sin(time * 11);
    // (Never white: a white-gold flame at the rider's shoulder bloomed over the coat and bleached it.)
    const col = gut ? EMBER : pace < 0.45 ? FLAME : MARIGOLD;
    const fk = 1 + 0.9 * Math.exp(-(time - this.flare) * 5);
    const size = (0.3 + 0.42 * pace) * fk * (gut ? 0.8 : 1);
    // It streams back off the prow with the speed.
    const lean = Math.min(0.5, s.speed / 90);
    this.sprite(x - fx * lean * size, y + 0.34 * size, zz - fz * lean * size, 1.05 * size, 1, col, (1.5 + 0.6 * pace) * fl, 0.12);
    this.sprite(x, y + 0.3 * size, zz, 1.7 * size, 0, col, 0.12 * fl);
    pushLocalLight(x, y + 0.6, -zz, 1, gut ? 0.5 : 0.72, gut ? 0.16 : 0.3, 5 + 4 * pace, (0.16 + 0.2 * pace) * fl * fk * lampK);
    this.sparkAcc += dt * (gut ? 8 : 2 + 3 * (1 - pace));
    if (this.sparkAcc > 1) {
      this.sparkAcc = 0;
      this.particles.sparkle(ts.set(x, y + 0.4, -zz), gut ? EMBER : FLAME, gut ? 2 : 1, 1.6, 0.5, 0.1, tv.set(s.vx * 0.8, 0.6, -s.vz * 0.8), 0.5);
    }
  }

  /** Lanternfall's legend in reach this frame, in the shape MarqueeWorld.legendShot() gives the other
   *  mountains' (the camera's look, the HUD and the reel read either): the Great Rising's focus is the valley
   *  ahead and above on its side, where the lanterns climb; the Tall Lamplighter's is the lantern on his pole. */
  private readonly look: LegendShot = { key: '', name: '', phase: 0, k: 0, peak: 0, x: 0, y: 0, z: 0, side: 1, kind: '', ahead: 0 };
  private lookLive = false;

  legendShot(): LegendShot | null {
    return this.lookLive ? this.look : null;
  }

  private aimLegend(sim: Sim | null, s: Snap): void {
    this.lookLive = false;
    const lg = sim?.legend;
    if (!sim || !lg || (lg.key !== 'rising' && lg.key !== 'lamplighter')) return;
    const st = sim.lg;
    if (st.phase === 0 || s.z > lg.z1 + LEGEND_REACH_OUT) return;
    const L = this.look;
    const span = Math.max(1, lg.z1 - lg.z0);
    const kIn = Math.max(0, Math.min(1, (s.z - (lg.z0 - LEGEND_WARN_M)) / LEGEND_WARN_M));
    const kOut = Math.max(0, Math.min(1, (s.z - lg.z1) / LEGEND_REACH_OUT));
    L.key = lg.key;
    L.name = lg.name;
    L.phase = st.phase;
    L.side = lg.side;
    L.kind = lg.kind;
    L.k = Math.max(0, Math.min(1, (s.z - (lg.z0 - LEGEND_WARN_M)) / (span + LEGEND_WARN_M + LEGEND_REACH_OUT)));
    // (The same shape as the other mountains' legends: a third as it is said, whole at its middle.)
    L.peak = st.phase === 2 ? 0.35 + 0.65 * Math.sin(Math.PI * Math.max(0, Math.min(1, (s.z - lg.z0) / span))) : st.phase === 1 ? 0.35 * kIn : 0.35 * (1 - kOut);
    const tall = this.tall;
    if (lg.key === 'lamplighter' && tall && tall.visible) {
      L.x = tall.position.x;
      L.y = tall.position.y + TALL_TIP[1] - 1.2;
      L.z = tall.position.z;
    } else {
      L.x = s.x + lg.side * 40;
      L.y = s.y + 34;
      L.z = -(s.z + 160);
    }
    L.ahead = -L.z - s.z;
    this.lookLive = true;
  }

  /** The Tall Lamplighter (a legend, the lamp grove): he walks the grove ahead of the rider, and the light
   *  of the lantern on his pole is the lane on the snow that charges theirs. */
  private lamplighter(c: Course, s: Snap, sim: Sim, time: number, low: boolean, lampK: number): void {
    const lg = sim.legend;
    const tall = this.tall;
    if (!tall) return;
    if (!lg || lg.key !== 'lamplighter' || !lg.path || s.z < lg.z0 - 420 || s.z > lg.z1 + 90) {
      tall.visible = false;
      return;
    }
    // He keeps forty metres ahead, never walks back up the hill, and stops at the lane's end.
    this.tallZ = Math.max(this.tallZ, Math.min(lg.z1 + 6, Math.max(lg.z0 + 30, s.z + 27)));
    const zt = this.tallZ;
    const side = lg.side;
    const x = pathX(c, lg.path, Math.min(zt, lg.path.z1)) + side * (RIBBON_HW + 3.4);
    const gy = c.ground(x, zt);
    const step = Math.sin(time * 2.1);
    tall.visible = true;
    tall.position.set(x, gy - 0.2 + Math.abs(step) * 0.12, -zt);
    // He faces up the run, toward the rider, his pole out over the lane.
    tall.rotation.set(0, side > 0 ? -0.5 : 0.5, step * 0.03);
    tall.scale.set(side > 0 ? -TALL_S : TALL_S, TALL_S, TALL_S);
    const tx = x + (side > 0 ? -1 : 1) * TALL_TIP[0] * TALL_S;
    const ty = gy + (TALL_TIP[1] - 1.2) * TALL_S;
    const tz = zt - TALL_TIP[2] * TALL_S;
    const on = sim.lg.phase === 2 ? 1.3 : 0.9;
    this.sprite(tx, ty, tz, 2.0, 2, WHITE_GOLD, 1.8 * on, 0.5);
    this.sprite(tx, ty, tz, 9, 0, MARIGOLD, 0.5 * on);
    this.sprite(x, gy + (TALL_H - 1.25) * TALL_S, zt - 0.45 * TALL_S, 0.6, 0, COLD, 0.9);
    pushLocalLight(tx, ty, -tz, 1, 0.8, 0.4, 22, 1.2 * on * lampK);
    // The lane: his light lying down the snow, breathing.
    const from = Math.max(lg.path.z0, s.z - 14);
    for (let zl = from - (from % 6) + 6, n = 0; zl < lg.path.z1 && n < (low ? 10 : 20); zl += 6, n++) {
      const near = 1 - Math.min(1, Math.abs(zl - s.z) / 90);
      this.pool(c, pathX(c, lg.path, zl), zl, 2 * RIBBON_HW + 0.8, 7.6, WHITE_GOLD, (0.12 + 0.14 * near) * on * (0.85 + 0.15 * Math.sin(time * 2 + zl * 0.2)));
    }
    if (s.z > lg.path.z0 - 10 && s.z < lg.path.z1) pushLocalLight(pathX(c, lg.path, s.z + 6), c.ground(s.x, s.z + 6) + 1.4, -(s.z + 6), 1, 0.85, 0.5, 11, 0.28 * on * lampK);
  }

  /** The great lantern over the square: dark all run, lit as the flame arrives (or, a breath later, by the
   *  lamplighters when a rider crosses the line without it), and the town lets its lanterns go. */
  private great(c: Course, s: Snap, time: number, dt: number, mode: 'run' | 'title' | 'results', lampK: number, cam: { position: Vector3 }): void {
    const root = this.greatRoot;
    const paper = this.greatPaper;
    if (!root || !paper) return;
    const z = c.finishZ + GREAT_Z;
    root.visible = mode !== 'title' && s.z > c.finishZ - 760;
    if (!root.visible) return;
    // Firstlight from far up the run: its lamps as a few soft lights over the roofs, so the town is a pool of
    // marigold in the valley before any of its windows can be read.
    const far = z - s.z;
    if (far > 160) {
      const k = Math.min(1, (far - 160) / 200);
      for (let i = 0; i < 9; i++) {
        const tz = c.finishZ - 250 + i * 48;
        const side = i % 2 === 0 ? -1 : 1;
        const tx = c.centerX(tz) + side * (c.halfWidth(tz) + 9 + (i % 3) * 5);
        this.sprite(tx, c.ground(tx, tz) + 9 + (i % 4) * 2, tz, 7 + (i % 3) * 2, 0, FLAME, 0.34 * k, i * 0.11);
      }
    }
    // (A run that ends in the results without a finish beat seen here still lights it at the line.)
    if (this.greatLit < 0 && mode !== 'title' && s.z >= c.finishZ) this.greatLit = time + (this.greatWon ? 0 : 1.1);
    const t = this.greatLit < 0 ? -1 : time - this.greatLit;
    const lit = t < 0 ? 0 : smooth01(t / 0.35);
    const u = (paper.material as ShaderMaterial).uniforms;
    const flash = t < 0 ? 0 : Math.exp(-t * 2.2);
    const full = this.greatWon ? 1 : 0.72;
    // (Round 8: banked low until it is lit, a lamp turned down and waiting. Dark, it hung behind the FINISH board on the
    // approach as a violet mass a critic read as "a dark unlit one" over the lettering.)
    // (Round 8, the review: at 0.14 the banked lantern read as a dim brown barrel over the square, a cage with nothing
    // in it; a lamp turned down still glows through its paper.)
    u.uEmissiveStrength.value = lit * full * (1.9 + 0.7 * flash + 0.06 * Math.sin(time * 5)) + (1 - lit) * 0.34;
    // (Round 8: once the rider is over the line and the finish lens has begun its swing round to the rider's front,
    // the lamplighters walk it along its yoke to the side away from the lens's, where the lens, looking back up the
    // run past the rider, finds it over the rider's head. Read from the lens itself, so the two always agree:
    // decided by the rider's side of the course, a rider who drifted across in the last metres left it out of the
    // frame, scripts/playtest/finishprobe.js.)
    const node = this.greatNode;
    if (node) {
      const dx = cam.position.x - s.x;
      if (this.greatSide === 0 && mode !== 'title' && s.z >= c.finishZ + 4 && Math.abs(dx) > 0.5) {
        this.greatSide = dx > 0 ? -1 : 1;
        this.greatWalk = time;
      }
      const reach = Math.min(GREAT_SIDE, node.userData.reach as number);
      const walk = this.greatWalk < 0 ? 0 : smooth01((time - this.greatWalk) / 1.2);
      node.position.x = this.greatSide * reach * walk;
      node.position.y = -GREAT_DROP * walk;
    }
    const x = root.position.x + (node ? node.position.x : 0);
    const y = root.position.y + (node ? node.position.y : 0) + GREAT_Y + 11.6 - 2.2 - 3.3;
    // It sways a little on its chains.
    paper.rotation.z = 0.02 * Math.sin(time * 0.9);
    if (lit > 0) {
      this.sprite(x, y, z, 17 + 6 * flash, 0, MARIGOLD, (0.3 + 0.25 * flash) * lit * full);
      this.sprite(x, y - 0.6, z, 6, 0, FLAME, (0.5 + 0.4 * flash) * lit * full);
      pushLocalLight(x, y - 3, -z, 1, 0.7, 0.3, 36, (0.3 + 0.08 * flash) * lit * full * lampK);
      // (Round 8, the light lane: lit, it is the frame's one light, and its light comes through the air past its
      // frame and the square's masts toward the lens as shafts. Medium and High; Low has none.)
      pushShaftSource(x, y, -z, 1, 0.72, 0.34, (0.75 + 0.35 * flash) * lit * full, 3.6);
      if (this.valley) {
        const vu = (this.valley.material as ShaderMaterial).uniforms;
        if (vu.uRelease.value < 0 && t > 0.25) {
          vu.uRelease.value = time;
          for (let k = 0; k < (this.greatWon ? 5 : 2); k++) this.particles.sparkle(ts.set(x + (k - 2) * 2.2, y - 3 + k * 0.6, -z), k % 2 ? WHITE_GOLD : MARIGOLD, 40, 7, 1.2, 0.34, null, 0.9);
        }
      }
    } else {
      // Waiting: a pale ring of moonlight on its shoulder, so it is seen dark against the sky.
      this.sprite(x, y + 2.6, z, 4.5, 0, COLD, 0.2);
    }
    void dt;
  }
}
