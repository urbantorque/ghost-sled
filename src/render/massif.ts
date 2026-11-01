import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, Object3D, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import { HeroPeak, Palette } from './palette';
import { shared } from './materials';

// The mountain panorama: three ranges of real, lit, faceted peaks round the horizon, each biome's
// hero mountain, and a sea of clouds below the horizon that the far ranges rise out of. It follows the
// camera (sky.ts), so it reads as infinitely far away.
//
// The whole panorama is one draw: a flat grid of polar bands (azimuth by distance) and a polar patch
// for the hero, raised into mountains in the vertex shader (ridged noise, so crests are crisp and the
// faces between them fall away into couloirs). There is nothing to build on the CPU but the grid's
// index, and changing biome is a uniform. The faces are shaded flat (normals from screen derivatives)
// with the art bible's wrap lighting, stepped into gouache values: snow holds on the gentler faces
// above a snow line, the steep faces show rock, the sun side is warm and the shade side takes the
// mood's cool shade. Aerial perspective dissolves the far ranges into the horizon haze, the valleys
// fill with haze, and below a level the sea of clouds swallows the mountains' feet.

/** One band of the grid: its azimuth segments and distance rows. */
interface Band { seg: number; rows: number }
/** The grid per tier: the three ranges (nearest first) and the hero patch (spokes and rings). Low
 *  draws the middle range alone, coarse, and a coarse hero (one draw, as the old single ridge strip
 *  cost three). */
const GRID: Record<'low' | 'medium' | 'high', { bands: Array<Band | null>; hero: Band }> = {
  high: { bands: [{ seg: 720, rows: 14 }, { seg: 720, rows: 16 }, { seg: 640, rows: 18 }], hero: { seg: 128, rows: 48 } },
  medium: { bands: [{ seg: 540, rows: 12 }, { seg: 540, rows: 14 }, { seg: 480, rows: 14 }], hero: { seg: 96, rows: 36 } },
  low: { bands: [null, { seg: 256, rows: 8 }, null], hero: { seg: 64, rows: 20 } },
};

/** The hero's distance from the lens (metres), and how far round from the sun it stands (degrees,
 *  to the side away from the sun's bearing): down the fall line, where the chase camera sees it most
 *  of the run, but never crowding the disc. */
const HERO_DIST = 4400;
const HERO_AZ = 24;
/** The sea of clouds' level relative to the lens (metres). */
const SEA_Y = -330;
const PEAK_ID: Record<HeroPeak, number> = { summit: 0, fang: 1, volcano: 2, cone: 3 };

/** 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT), shared by the panorama and the sky dome's
 *  sea of clouds. */
const NOISE = /* glsl */ `
  vec3 mm289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mm289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 perm3(vec3 x) { return mm289(((x * 34.0) + 10.0) * x); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mm289(i);
    vec3 p = perm3(perm3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
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

/** The sea of clouds: a plane of billows uSeaY below the lens, seen along a direction. The sky dome
 *  paints it below the horizon and the panorama paints it over the mountains' feet, with the same
 *  function, so they meet without a seam. Painterly: three flat values, the billows' sides toward
 *  the sun lit and rimmed warm, gaps opening onto the deep valley, and the far sea dissolving into
 *  the horizon colour. SEA_Q 0 (Low) drops the fine octave and the shading sample. */
export const SEA_GLSL = /* glsl */ `
  uniform float uSeaY;
  uniform float uSea;
  uniform vec3 uSeaLit;
  uniform vec3 uSeaShade;
  uniform vec3 uSeaRim;
  uniform vec3 uSeaHaze;
  uniform vec3 uSeaDeep;
  uniform vec3 uSeaSun;
  ${NOISE}
  float seaBillow(vec2 p, float detail) {
    vec2 q = p * 0.0009 + vec2(uTime * 0.0032, uTime * 0.0011);
    float n = snoise(q) * 0.62 + snoise(q * 2.6 + 3.1) * 0.3;
    #if SEA_Q > 0
      n += snoise(q * 6.8 + 7.7) * 0.14 * detail;
    #endif
    return n;
  }
  float seaSteps(float l) {
    float q = clamp(l, 0.0, 0.999) * 3.0;
    return (floor(q) + smoothstep(0.35, 0.65, fract(q))) / 3.0;
  }
  vec4 seaOfClouds(vec3 d) {
    float t = uSeaY / min(d.y, -0.0004);
    vec2 p = d.xz * t;
    // Fine detail fades with distance, where it would shimmer at a grazing angle.
    float detail = 1.0 - smoothstep(2500.0, 7000.0, t);
    float n = seaBillow(p, detail);
    vec2 sxz = normalize(uSeaSun.xz + vec2(0.0001, 0.0));
    #if SEA_Q > 0
      float facing = clamp(0.5 + (n - seaBillow(p - sxz * 160.0, detail)) * 2.2, 0.0, 1.0);
    #else
      float facing = 0.5;
    #endif
    float l = facing * 0.55 + clamp(n * 0.5 + 0.5, 0.0, 1.0) * 0.45;
    vec3 col = mix(uSeaShade, uSeaLit, seaSteps(l));
    // Warm toward the sun's bearing (the billows there are lit through and rimmed).
    float sunSide = pow(max(dot(normalize(d.xz), sxz), 0.0), 5.0) * smoothstep(-0.05, 0.05, uSeaSun.y);
    col = mix(col, uSeaRim, sunSide * (0.25 + 0.5 * smoothstep(0.6, 0.9, l)));
    // Gaps between the billows look down into the deep valley (fewer as the sea fills).
    float cov = smoothstep(-0.62, -0.48, n + (uSea - 1.0) * 1.2);
    col = mix(uSeaDeep, col, cov);
    // Aerial perspective: the far sea melts into the horizon.
    col = mix(col, uSeaHaze, smoothstep(1200.0, 12000.0, t) * 0.92);
    return vec4(col, step(0.001, uSea));
  }
`;

/** The uniforms the sea shares between the dome and the panorama (one set, updated once). */
export function makeSeaUniforms() {
  return {
    uSeaY: { value: SEA_Y },
    uSea: { value: 1 },
    uSeaLit: { value: new Color() },
    uSeaShade: { value: new Color() },
    uSeaRim: { value: new Color() },
    uSeaHaze: { value: new Color() },
    uSeaDeep: { value: new Color() },
    uSeaSun: { value: new Vector3(0, 0.2, -1) },
  };
}
export type SeaUniforms = ReturnType<typeof makeSeaUniforms>;

/** Sets the shared sea colours from a palette. */
export function paletteSea(u: SeaUniforms, p: Palette): void {
  u.uSea.value = p.massif.sea;
  u.uSeaLit.value.copy(p.clouds.lit).lerp(p.snowLit, 0.25);
  u.uSeaShade.value.copy(p.clouds.shade).lerp(p.skyHorizon, 0.2);
  u.uSeaRim.value.copy(p.clouds.rim).lerp(p.sunColor, 0.3);
  u.uSeaHaze.value.copy(p.skyHorizon).lerp(p.fog, 0.3);
  u.uSeaDeep.value.copy(p.ridge[2]).lerp(p.snowDeep, 0.4);
  u.uSeaSun.value.copy(p.diskDir);
}

const VERT = /* glsl */ `
  uniform vec2 uSeed;
  uniform float uSunAz;
  uniform float uSunCap;
  uniform float uHeroAz;
  uniform float uPeak;
  varying vec3 vPos;
  varying vec3 vHero;
  ${NOISE}
  const float TAU = 6.2831853;
  // Ridged multifractal: sharp crests where the noise crosses zero, the faces between them falling
  // away into gullies, finer octaves weighted by the coarser so detail gathers on the crests.
  float ridged(vec2 p) {
    float s = 0.0;
    float a = 0.55;
    float w = 1.0;
    const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      float n = 1.0 - abs(snoise(p));
      n *= n;
      n *= w;
      w = clamp(n * 1.7, 0.0, 1.0);
      s += n * a;
      p = ROT * p * 2.07;
      a *= 0.48;
    }
    return s;
  }
  // 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT), for the ranges: laid on a cylinder round
  // the lens it has no seam anywhere round the ring.
  vec4 mm289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 mm289b(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 perm4(vec4 x) { return mm289(((x * 34.0) + 10.0) * x); }
  float snoise3(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mm289b(i);
    vec4 p = perm4(perm4(perm4(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    vec3 ns = 0.142857142857 * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 nrm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
    p0 *= nrm.x;
    p1 *= nrm.y;
    p2 *= nrm.z;
    p3 *= nrm.w;
    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
  // The same ridged noise in 3D, the first octave dominant so the ranges are broad peaks with finer
  // ridges on them rather than a field of needles.
  float ridged3(vec3 p) {
    float s = 0.0;
    float a = 0.6;
    float w = 1.0;
    for (int i = 0; i < 4; i++) {
      float n = 1.0 - abs(snoise3(p));
      n *= n;
      n *= w;
      w = clamp(n * 1.5, 0.0, 1.0);
      s += n * a;
      p = p * 2.03 + vec3(1.7, 9.2, 3.3);
      a *= 0.4;
    }
    return s;
  }
  float angDiff(float a, float b) { return abs(atan(sin(a - b), cos(a - b))); }
  void main() {
    float layer = position.z;
    vec3 P;
    if (layer < 2.5) {
      float az = position.x * TAU;
      float v = position.y;
      // Distance band, foot (just under the sea of clouds, so there is never a gap under a range), crest
      // height (metres relative to the lens), feature size.
      vec4 L = layer < 0.5 ? vec4(1350.0, 2400.0, -420.0, 230.0) : layer < 1.5 ? vec4(2150.0, 3500.0, -430.0, 520.0) : vec4(3200.0, 5000.0, -440.0, 1050.0);
      float scale = layer < 0.5 ? 640.0 : layer < 1.5 ? 900.0 : 1250.0;
      float r = mix(L.x, L.y, v);
      vec2 dir = vec2(sin(az), -cos(az));
      vec2 p = dir * r;
      // Massifs and saddles round the ring.
      vec2 ring = vec2(cos(az), sin(az));
      float env = 0.55 + 0.55 * snoise(ring * 1.6 + uSeed + layer * 3.1) + 0.25 * snoise(ring * 4.2 + uSeed.yx + layer * 1.3);
      env = clamp(env, 0.1, 1.3);
      // The valley down the fall line: the near ranges part there, so the view goes deep.
      float a0 = angDiff(az, 0.0);
      if (layer < 0.5) env *= mix(0.22, 1.0, smoothstep(0.1, 0.55, a0));
      else if (layer < 1.5) env *= mix(0.5, 1.0, smoothstep(0.05, 0.35, a0));
      else env *= mix(0.6, 1.0, smoothstep(0.04, 0.3, a0));
      // The ranges bow before the hero.
      float ah = angDiff(az, uHeroAz);
      env *= mix(1.0, layer > 1.5 ? 0.45 : 0.78, 1.0 - smoothstep(0.1, 0.36, ah));
      float rise = smoothstep(0.0, 0.7, v) * (1.0 - 0.25 * smoothstep(0.85, 1.0, v));
      // Ridges run across the view (features stretched round the ring and narrow in depth), as a range
      // seen from afar shows its crest lines side on; seen end on they read as a field of spires.
      float rmid = 0.5 * (L.x + L.y);
      float rg = ridged3(vec3(ring * rmid / scale + uSeed, r / (scale * 0.7) + layer * 17.0));
      // Sharpened, so a few big peaks stand out of lower ridges.
      float h = L.z + (L.w - L.z) * clamp(pow(clamp(rg, 0.0, 1.2), 1.3) * env, 0.0, 1.35) * rise;
      // Under the sun's bearing the crests stay below the disc, so it sets onto a ridge, never
      // behind a peak in the middle of the sky.
      float w = (1.0 - smoothstep(0.05, 0.2, angDiff(az, uSunAz))) * step(0.0, uSunCap);
      float cap = r * uSunCap;
      h = mix(h, min(h, cap + max(h - cap, 0.0) * 0.1), w);
      P = vec3(p.x, h, p.y);
      vHero = vec3(layer, position.x, v);
    } else {
      // The hero: a polar patch round its summit, denser near the top.
      float th = position.x * TAU;
      float v = position.y;
      vec2 hd = vec2(sin(uHeroAz), -cos(uHeroAz));
      // Across the view, pointing away from the sun's side of the frame.
      vec2 right = vec2(-hd.y, hd.x) * sign(uHeroAz);
      vec2 C = hd * ${HERO_DIST.toFixed(1)};
      vec2 off = vec2(cos(th), sin(th));
      float R;
      float top;
      float f;
      vec2 p;
      if (uPeak < 0.5) {
        // Pinecrest: a massive summit on three aretes, the faces between them hollowed into couloirs,
        // and a shoulder on the side away from the sun.
        R = 2900.0;
        top = 1080.0;
        p = C + off * v * R;
        float ar = pow(0.5 + 0.5 * cos(3.0 * th + 0.7), 2.0);
        f = pow(1.0 - v, 1.3) - (1.0 - ar) * 0.16 * v * (1.0 - v) * 4.0;
        vec2 lp = off * v - (right * 0.3 + hd * 0.08);
        f = max(f, 0.74 * pow(max(1.0 - length(lp) / 0.55, 0.0), 1.5));
        f += (ridged((p - C) / 340.0 + uSeed) - 0.5) * 0.09 * smoothstep(0.0, 0.3, v);
      } else if (uPeak < 1.5) {
        // Frostfang: a jagged ice fang, a lesser fang at its shoulder, standing on a broad glaciated
        // pedestal whose gentle flanks carry the glacier tongues.
        R = 2700.0;
        top = 1300.0;
        p = C + off * v * R;
        float ped = 0.4 * pow(1.0 - v, 1.2);
        float sp = max(1.0 - length(off * v + right * 0.03) / 0.3, 0.0);
        float sp2 = max(1.0 - length(off * v - (right * 0.2 + hd * 0.05)) / 0.15, 0.0);
        f = ped + max(0.6 * pow(sp, 1.25), 0.36 * pow(sp2, 1.2));
        f += (ridged((p - C) / 210.0 + uSeed) - 0.5) * (0.05 + 0.2 * sqrt(sp));
      } else if (uPeak < 2.5) {
        // Ember Peak: a broad, concave volcanic cone with a notched crater rim, scored by radial gullies.
        R = 3000.0;
        top = 900.0;
        p = C + off * v * R;
        float rc = 0.075;
        f = pow(1.0 - max(v, rc), 1.75) / pow(1.0 - rc, 1.75);
        f -= 0.05 * (1.0 - smoothstep(0.0, rc, v));
        f += 0.015 * snoise(off * 0.9 + 1.3) * (1.0 - smoothstep(rc, rc * 2.5, v));
        float g = abs(snoise(off * 7.5 + vec2(0.0, v * 2.5)));
        f -= 0.045 * smoothstep(0.08, 0.3, v) * (1.0 - v) * (1.0 - g);
      } else {
        // Sakura Ridge: a symmetrical cone, steepening toward a small flat-topped crater.
        R = 3300.0;
        top = 830.0;
        p = C + off * v * R;
        float rc = 0.045;
        f = pow(1.0 - max(v, rc), 2.15) / pow(1.0 - rc, 2.15);
        f -= 0.02 * (1.0 - smoothstep(0.0, rc, v));
        float g = abs(snoise(off * 10.5 + vec2(0.0, v * 3.0)));
        f -= 0.02 * smoothstep(0.1, 0.4, v) * (1.0 - v) * (1.0 - g);
      }
      float base = -760.0;
      P = vec3(p.x, base + (top - base) * f, p.y);
      vHero = vec3(3.0, position.x, v);
    }
    vPos = P;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLight;
  uniform vec3 uSnowLit;
  uniform vec3 uSnowShade;
  uniform vec3 uRockLit;
  uniform vec3 uRockShade;
  uniform vec3 uIce;
  uniform vec3 uHaze;
  uniform vec3 uHazeSun;
  uniform vec3 uGlow;
  uniform float uGlowK;
  uniform float uGlowLine;
  uniform float uVeil;
  uniform float uLava;
  uniform vec3 uLavaColor;
  uniform float uPeak;
  uniform float uSnowY;
  uniform float uHazeDist;
  uniform float uHazeK;
  varying vec3 vPos;
  varying vec3 vHero;
  ${SEA_GLSL}
  float steps3(float l) {
    float q = clamp(l, 0.0, 0.999) * 3.0;
    return (floor(q) + smoothstep(0.4, 0.6, fract(q))) / 3.0;
  }
  void main() {
    // Flat faces: the normal from the screen derivatives of the position, one per facet.
    vec3 N = normalize(cross(dFdx(vPos), dFdy(vPos)));
    float dist = length(vPos);
    vec3 dir = vPos / dist;
    float layer = vHero.x;
    float n1 = snoise(vPos.xz * 0.0055 + 11.0);
    #if SEA_Q > 0
      float n2 = snoise(vPos.xz * 0.021 + 4.0);
    #else
      float n2 = 0.0;
    #endif
    float slope = N.y;
    // Snow holds on the gentler faces above a ragged snow line; the steep faces show their rock.
    float snowLine = uSnowY + n1 * 120.0;
    // Higher up it clings to steeper faces too.
    float hold = 0.36 - 0.12 * smoothstep(snowLine, snowLine + 600.0, vPos.y);
    float snow = smoothstep(hold, hold + 0.06, slope + n2 * 0.08 + n1 * 0.04) * smoothstep(snowLine - 12.0, snowLine + 12.0, vPos.y);
    float ice = 0.0;
    float crater = 0.0;
    if (layer > 2.5) {
      float hv = vHero.z;
      // Round the hero by angle, as a point on a circle so the noise closes up without a seam.
      vec2 ring = vec2(cos(vHero.y * 6.2831853), sin(vHero.y * 6.2831853));
      if (uPeak < 0.5) {
        // The summit is heavy with snow: only the steepest faces and the aretes' flanks show rock.
        snow = smoothstep(0.38, 0.45, slope + n2 * 0.1) * smoothstep(0.62, 0.52, hv + n1 * 0.08);
      } else if (uPeak < 1.5) {
        // The fang: bare blue rock on its steep faces, snow on its ledges, and glacier tongues of
        // pale ice pouring down the gentler flanks.
        float tongue = snoise(ring * 4.2 + vec2(hv * 1.2, 0.0)) + n1 * 0.3;
        snow = smoothstep(0.5, 0.56, slope + n2 * 0.08) * (1.0 - smoothstep(0.2, 0.3, hv));
        ice = smoothstep(0.42, 0.5, slope + n1 * 0.1) * smoothstep(0.24, 0.32, hv) * smoothstep(-0.25, -0.1, tongue);
      } else if (uPeak < 2.5) {
        // The volcano: snow only in streaks down the upper gullies, none in the warm crater.
        float streak = snoise(ring * 14.5 + vec2(0.0, hv * 1.5)) * 0.08 + snoise(ring * 3.7 + 2.0) * 0.06;
        snow = step(hv, 0.3 + streak) * step(0.11, hv) * smoothstep(0.25, 0.35, slope + n2 * 0.2);
        crater = 1.0 - smoothstep(0.05, 0.085, hv);
      } else {
        // The cone: a clean snow cap whose lower edge runs down the gullies in long streaks.
        float streak = snoise(ring * 11.0 + 0.5) * 0.05 + snoise(ring * 30.0 + 1.5) * 0.025;
        snow = step(hv, 0.21 + streak);
      }
    }
    float wrap = smoothstep(-0.25, 0.6, dot(N, uLight));
    float lit = steps3(wrap);
    // Alpenglow: as the sun sinks the shadow climbs the ranges, the valleys go to shade first and the
    // snow still in the light takes the glow.
    float above = smoothstep(uGlowLine - 40.0, uGlowLine + 40.0, vPos.y + n1 * 70.0);
    float sun = lit * above;
    vec3 snowLit = mix(uSnowLit, uGlow, uGlowK * above);
    vec3 col = mix(mix(uRockShade, uRockLit, sun), mix(uSnowShade, snowLit, sun), snow);
    col = mix(col, mix(uSnowShade, mix(uIce, uGlow, uGlowK * above * 0.5), sun * 0.8 + 0.2), ice);
    // Aerial perspective: distance dissolves the far ranges into the haze, warmer toward the sun,
    // and the valleys fill with haze above the sea of clouds.
    float hz = (1.0 - exp(-max(dist - 1000.0, 0.0) / uHazeDist)) * (layer > 2.5 ? 0.62 : 1.0) * uHazeK;
    hz = max(hz, (1.0 - smoothstep(uSeaY, uSeaY + 380.0, vPos.y)) * 0.5);
    vec2 sxz = normalize(uSeaSun.xz + vec2(0.0001, 0.0));
    vec3 haze = mix(uHaze, uHazeSun, pow(max(dot(normalize(dir.xz), sxz), 0.0), 4.0) * 0.7);
    col = mix(col, haze, clamp(hz + uVeil, 0.0, 1.0));
    // The crater glows (stronger at night).
    col += uLavaColor * crater * uLava * (0.8 + 0.2 * sin(uTime * 1.3));
    // The sea of clouds swallows the mountains' feet, round a billowing surface.
    if (uSea > 0.0) {
      float surf = uSeaY + seaBillow(vPos.xz, 1.0) * 60.0 + 25.0;
      float under = smoothstep(surf + 22.0, surf - 22.0, vPos.y);
      if (under > 0.0) {
        vec4 s = seaOfClouds(dir);
        col = mix(col, s.rgb, under * s.a);
      }
    }
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** The volcano's plume: one camera-facing quad over the crater, painted as a column of billows that
 *  climbs and bends away on the wind, lit on its sun side and glowing at its foot at night. */
const PLUME_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const PLUME_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLit;
  uniform vec3 uShade;
  uniform vec3 uHaze;
  uniform vec3 uLavaColor;
  uniform float uLava;
  uniform float uSide;
  uniform float uAlpha;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    float y = vUv.y;
    float x = vUv.x - 0.5;
    // The column leans downwind (away from the sun's side of the frame) and widens as it climbs.
    float cx = 0.3 * uSide * pow(y, 1.4) + 0.02 * sin(y * 7.0 - uTime * 0.25);
    float w = 0.03 + 0.17 * y;
    float d = (x - cx) / w;
    float t = uTime * 0.035;
    float n = snoise(vec2(x * 5.0, y * 3.2 - t)) * 0.55 + snoise(vec2(x * 11.0 + 3.0, y * 7.0 - t * 2.1)) * 0.3;
    float dens = exp(-d * d * 1.6) * (0.75 + 0.6 * n);
    float a = smoothstep(0.3, 0.36, dens + y * 0.1) * (1.0 - smoothstep(0.3, 0.75, y)) * smoothstep(0.0, 0.02, y);
    if (a <= 0.0) discard;
    // Sun side of each billow lit, the far side in shade, three flat values.
    float l = clamp(0.5 - d * 0.25 * uSide + n * 0.45, 0.0, 0.999) * 3.0;
    float st = (floor(l) + smoothstep(0.4, 0.6, fract(l))) / 3.0;
    vec3 col = mix(uShade, uLit, st);
    col = mix(col, uHaze, 0.3 + 0.3 * y);
    col += uLavaColor * uLava * exp(-y * 9.0) * 0.8;
    gl_FragColor = vec4(col, a * uAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A grid of polar bands for the given tier: position holds (azimuth fraction, distance fraction,
 *  layer), and the hero patch is layer 3 (spoke angle fraction, distance from the summit). */
function buildGrid(tier: 'low' | 'medium' | 'high'): BufferGeometry {
  const g = GRID[tier];
  const parts: Array<{ band: Band; layer: number; pow: number }> = [];
  g.bands.forEach((b, i) => {
    if (b) parts.push({ band: b, layer: i, pow: 1 });
  });
  parts.push({ band: g.hero, layer: 3, pow: 1.5 });
  let verts = 0;
  let tris = 0;
  for (const p of parts) {
    verts += (p.band.seg + 1) * (p.band.rows + 1);
    tris += p.band.seg * p.band.rows * 2;
  }
  const pos = new Float32Array(verts * 3);
  const idx = verts > 65535 ? new Uint32Array(tris * 3) : new Uint16Array(tris * 3);
  let v = 0;
  let k = 0;
  for (const p of parts) {
    const { seg, rows } = p.band;
    const start = v;
    for (let j = 0; j <= rows; j++) {
      const t = Math.pow(j / rows, p.pow);
      for (let i = 0; i <= seg; i++) {
        pos[v * 3] = i / seg;
        pos[v * 3 + 1] = t;
        pos[v * 3 + 2] = p.layer;
        v++;
      }
    }
    const w = seg + 1;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < seg; i++) {
        const a = start + j * w + i;
        idx[k++] = a;
        idx[k++] = a + w;
        idx[k++] = a + 1;
        idx[k++] = a + 1;
        idx[k++] = a + w;
        idx[k++] = a + w + 1;
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(new BufferAttribute(idx, 1));
  return geo;
}

export class Massif {
  readonly root = new Object3D();
  private mesh: Mesh;
  private mat: ShaderMaterial;
  private plume: Mesh;
  private plumeMat: ShaderMaterial;
  private tier: 'low' | 'medium' | 'high' = 'high';
  private peak: HeroPeak = 'summit';
  private heroAz = 0;

  constructor(seed: number, readonly sea: SeaUniforms) {
    const sx = ((seed * 0.6180339) % 1) * 40 - 20;
    const sy = ((seed * 0.4142135) % 1) * 40 - 20;
    this.mat = new ShaderMaterial({
      side: DoubleSide,
      uniforms: {
        ...sea,
        uTime: shared.uTime,
        uSeed: { value: new Vector2(sx, sy) },
        uSunAz: { value: 0 },
        uSunCap: { value: 0.1 },
        uHeroAz: { value: 0.4 },
        uPeak: { value: 0 },
        uLight: { value: new Vector3(0, 1, 0) },
        uSnowLit: { value: new Color() },
        uSnowShade: { value: new Color() },
        uRockLit: { value: new Color() },
        uRockShade: { value: new Color() },
        uIce: { value: new Color() },
        uHaze: { value: new Color() },
        uHazeSun: { value: new Color() },
        uGlow: { value: new Color() },
        uGlowK: { value: 0 },
        uGlowLine: { value: -6000 },
        uVeil: { value: 0 },
        uLava: { value: 0 },
        uLavaColor: { value: new Color('#FF6A2A') },
        uSnowY: { value: -250 },
        uHazeDist: { value: 5200 },
        uHazeK: { value: 1 },
      },
      defines: { SEA_Q: 1 },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new Mesh(buildGrid('high'), this.mat);
    this.mesh.frustumCulled = false;
    // Drawn straight after the dome, before the world: it writes depth (its ranges hide each other),
    // but at 1.35 km and more it never hides anything nearer.
    this.mesh.renderOrder = -9;
    this.root.add(this.mesh);

    this.plumeMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTime: shared.uTime,
        uLit: { value: new Color() },
        uShade: { value: new Color() },
        uHaze: { value: new Color() },
        uLavaColor: { value: new Color('#FF6A2A') },
        uLava: { value: 0 },
        uSide: { value: 1 },
        uAlpha: { value: 0.92 },
      },
      vertexShader: PLUME_VERT,
      fragmentShader: PLUME_FRAG,
    });
    // 2.6 km wide and 1.7 km tall, its foot in the crater.
    const pg = new PlaneGeometry(2600, 1700);
    pg.translate(0, 850, 0);
    this.plume = new Mesh(pg, this.plumeMat);
    this.plume.frustumCulled = false;
    this.plume.visible = false;
    this.root.add(this.plume);
  }

  setPalette(p: Palette): void {
    const u = this.mat.uniforms;
    const disk = p.diskDir;
    const sunAz = Math.atan2(disk.x, -disk.z);
    const sunEl = Math.asin(Math.max(-1, Math.min(1, disk.y)));
    u.uSunAz.value = sunAz;
    // Crests under the disc stay about 2.5 degrees below its centre (no cap when there is no disc).
    u.uSunCap.value = p.sunDisc > 0 || p.moon ? Math.tan(Math.max(0.3 * (Math.PI / 180), sunEl - 2.5 * (Math.PI / 180))) : -1;
    // The hero stands on the far side of the fall line from the sun.
    const side = sunAz >= 0 ? -1 : 1;
    this.heroAz = side * HERO_AZ * (Math.PI / 180);
    u.uHeroAz.value = this.heroAz;
    this.peak = p.massif.peak;
    u.uPeak.value = PEAK_ID[this.peak];
    // The panorama's own light: the sun's bearing swung out to the side and lifted, so the faces
    // turned toward the lens are split into a lit and a shaded side instead of all backlit.
    const laz = sunAz - side * 1.0;
    const lel = Math.max(sunEl, 0.06) + 0.32;
    (u.uLight.value as Vector3).set(Math.sin(laz) * Math.cos(lel), Math.sin(lel), -Math.cos(laz) * Math.cos(lel)).normalize();
    const sunTint = new Color().copy(p.sunColor);
    (u.uSnowLit.value as Color).copy(p.snowLit).lerp(p.rim, 0.25).multiply(sunTint.lerp(new Color(1, 1, 1), 0.5));
    (u.uSnowShade.value as Color).copy(p.snowShade).lerp(p.skyHorizon, 0.12);
    // Lit rock keeps its own hue (the glacier's blue, the volcano's ash) with a touch of the sun.
    (u.uRockLit.value as Color).copy(p.massif.rock).lerp(p.sunColor, 0.2).multiplyScalar(1.35);
    (u.uRockShade.value as Color).copy(p.massif.rock).lerp(p.snowDeep, 0.4).multiplyScalar(0.75);
    (u.uIce.value as Color).copy(p.snowLit).lerp(p.hemiSky, 0.4);
    const haze = (u.uHaze.value as Color).copy(p.fog).lerp(p.skyHorizon, 0.5);
    if (p.mist) haze.lerp(p.mist, 0.35 * p.mistK);
    (u.uHazeSun.value as Color).copy(p.skyHorizon).lerp(p.sunColor, 0.25);
    (u.uGlow.value as Color).copy(p.massif.glow);
    u.uGlowK.value = p.massif.glowK;
    u.uGlowLine.value = p.massif.glowLine;
    u.uVeil.value = p.massif.veil;
    // At night the silhouettes hold: the ranges keep more of their dark value against the horizon glow.
    u.uHazeK.value = p.moon ? 0.6 : 1;
    u.uLava.value = p.massif.lava;
    u.uSnowY.value = this.peak === 'volcano' ? -60 : this.peak === 'fang' ? -380 : -260;
    paletteSea(this.sea, p);

    const pu = this.plumeMat.uniforms;
    (pu.uLit.value as Color).copy(p.clouds.lit).lerp(p.fog, 0.35);
    (pu.uShade.value as Color).copy(p.clouds.shade).lerp(p.massif.rock, 0.35);
    (pu.uHaze.value as Color).copy(haze);
    pu.uLava.value = p.massif.lava;
    pu.uSide.value = side;
    pu.uAlpha.value = 0.92 * (1 - p.massif.veil);
    this.placePlume();
  }

  private placePlume(): void {
    const show = this.peak === 'volcano' && this.tier !== 'low';
    this.plume.visible = show;
    if (!show) return;
    const hx = Math.sin(this.heroAz) * HERO_DIST;
    const hz = -Math.cos(this.heroAz) * HERO_DIST;
    this.plume.position.set(hx, 880, hz);
    // Faces the lens (at the root's origin).
    this.plume.rotation.set(0, Math.atan2(-hx, -hz), 0);
  }

  setDetail(tier: 'low' | 'medium' | 'high'): void {
    if (tier === this.tier) return;
    this.tier = tier;
    this.mesh.geometry.dispose();
    this.mesh.geometry = buildGrid(tier);
    const q = tier === 'low' ? 0 : 1;
    if (this.mat.defines.SEA_Q !== q) {
      this.mat.defines.SEA_Q = q;
      this.mat.needsUpdate = true;
    }
    this.placePlume();
  }
}
