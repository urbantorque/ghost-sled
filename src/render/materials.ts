import { Color, DoubleSide, FrontSide, type Material, NormalBlending, NotEqualStencilFunc, ShaderMaterial, type Texture, UniformsLib, UniformsUtils, Vector2, Vector3, Vector4 } from 'three';
import { BEST_HEX, FRIEND_HEX } from '../game/beats';
import { Palette } from './palette';

// One shared stylized lighting model for every surface (ART.md section 2). All materials share the
// same uniform objects by reference, so a mood change updates the whole world at once.

export const shared = {
  uSunDir: { value: new Vector3(0, 1, 0) },
  uSunColor: { value: new Color(1, 1, 1) },
  uHemi: { value: new Color(0.5, 0.6, 0.9) },
  uRim: { value: new Color(1, 0.8, 0.7) },
  uFog: { value: new Color(1, 0.8, 0.8) },
  uFogNear: { value: 60 },
  uFogFar: { value: 500 },
  uLanternPos: { value: new Vector3() },
  uLanternColor: { value: new Color('#FFB45E') },
  uLantern: { value: 0 },
  /** The sled lantern's pool (Lantern Night): xyz is the point on the snow under the sled's prow that
   *  the pool centres on, w its strength, 1 on the snow and easing to 0 as the sled rises about 3.5 m
   *  off it (world.ts), so the pool never lies detached under an airborne rider. lanternLight() uses
   *  it too: the pool's warm light fills the legs, the sled and the lower coat from below. */
  uLanternLow: { value: new Vector4(0, 0, 0, 0) },
  uTime: { value: 0 },
  uSnowLit: { value: new Color(1, 1, 1) },
  uSnowShade: { value: new Color(0.6, 0.7, 0.9) },
  uSnowDeep: { value: new Color(0.4, 0.45, 0.8) },
  uSparkle: { value: 1 },
  uIceMood: { value: 0 },
  uShadeTint: { value: new Color('#5868B8') },
  /** The rider's position: props between it and the camera dissolve. */
  uFocus: { value: new Vector3() },
  /** 1 right after a perfect landing (decaying to 0) and while the results frame the wreck: every
   *  gift within about 3 m of the rider shrinks away. */
  uFocusClear: { value: 0 },
  /** Sky gradient, for what glazed ice mirrors. */
  uSkyZenith: { value: new Color(0.2, 0.3, 0.6) },
  uSkyHorizon: { value: new Color(1, 0.8, 0.7) },
  /** Shadow map texels per metre (x) and shadow depth per metre (y), for the snow's soft shadows. */
  uShadowScale: { value: new Vector2(30, 1 / 219) },
  /** Value multiplier on hazards (trees, rocks): below 1 where the mood's snow is dark enough that
   *  hazards would otherwise match it (Glass Ice), so a danger stays the darkest thing on screen. */
  uHazardDim: { value: 1 },
  /** Where the sun or moon disc sits (palette.diskDir): what glazed ice mirrors as its sun path. */
  uDiskDir: { value: new Vector3(0, 0.2, -1).normalize() },
  /** 0 in play, easing to 1 while the results frame the wreck: props dissolve further out from the
   *  lens (no near-plane branches over the hero shot) and gifts cut by the frame edge shrink away. */
  uResults: { value: 0 },
  /** 1 while the title's attract reel plays: a hazard standing right behind the hero on screen
   *  dissolves, so the key art keeps a clean silhouette (world.ts sets it). */
  uTitleClear: { value: 0 },
  /** Gifts glow marigold from within and hold through the fog (Blizzard); 0 in clear moods. */
  uGiftGlow: { value: 0 },
  /** Cast-shadow strength (palette.shadowK): 1 normally, faint and soft in Blizzard's diffuse light. */
  uShadowK: { value: 1 },
  /** How much the fog swallows hazards (palette.hazardFog). */
  uHazardFog: { value: 1 },
  /** 1 in bright day moods, 0 at night (from the lit snow's luminance, as the snow shader's dayK). */
  uDayK: { value: 1 },
  /** How deep the painted clouds' slow shadows drift over the snow (palette.clouds.shadow; 0 on Low
   *  and in moods without sun). */
  uCloudShadow: { value: 0 },
  /** Mist pooled low over the course (fogged()): x its strength (0..1), y how thick it lies, metres. It
   *  settles on the course's floor (uFogFloor), so the corridor far ahead and the hollows past the banks
   *  sit in a soft layer of it while the banks, the treetops and the rider stand clear. */
  uMist: { value: new Vector2(0, 7) },
  uMistColor: { value: new Color(1, 1, 1) },
  /** The floor the mist settles on, a plane down the stretch of course ahead in three.js coordinates:
   *  y = x + y * z. Terrain fits it to the course's base height as the chunks stream. */
  uFogFloor: { value: new Vector2(0, 0) },
  /** Aerial perspective: looking toward the sun the fog takes on its warmth (forward scatter). */
  uFogSun: { value: 0 },
  /** How much the low mist drifts in banks over the course (palette atmo.drift; 0 on Low). */
  uMistDrift: { value: 0 },
  /** 1 on Medium and High: the snow's finer painted detail (sastrugi, packed tracks, micro glitter).
   *  Low skips it (setCloudShadows carries the tier). */
  uSnowFx: { value: 1 },
};

/** Cloud shadows on the snow are a Medium and High touch (world.ts turns them off on Low), and so is
 *  the snow's finer painted detail (uSnowFx). */
let cloudShadowsOn = true;
let cloudShadowK = 0;
let mistDriftK = 0;
export function setCloudShadows(on: boolean): void {
  cloudShadowsOn = on;
  shared.uCloudShadow.value = on ? cloudShadowK : 0;
  shared.uSnowFx.value = on ? 1 : 0;
  shared.uMistDrift.value = on ? mistDriftK : 0;
}

/** Your best distance (gold-white) and an unbeaten friend's (mint) as bands painted across the
 *  corridor by the snow shader: zero draw calls on every tier and nothing extra in the mirror. Declared
 *  with the snow material, so nothing recompiles when a band appears. World sets them each run frame
 *  (three.js z, corridor centre x, half-width with 2 m over each bank, and the best band's flare
 *  0..1); a half-width of 0 hides a band. */
export const bands = {
  uBestZ: { value: 0 },
  uBestX: { value: 0 },
  uBestHW: { value: 0 },
  uBestK: { value: 0 },
  /** New ground: metres the flare's wave of light has run on down the slope from the band (0: none). */
  uBestWave: { value: 0 },
  uBestC: { value: new Color(BEST_HEX) },
  uFriendZ: { value: 0 },
  uFriendX: { value: 0 },
  uFriendHW: { value: 0 },
  uFriendC: { value: new Color(FRIEND_HEX) },
};

/** The bare ground, one set per mountain (ART.md section 4): the snow shader lays it wherever the
 *  terrain says the ground is bare (ground.ts). uRockStyle is x: metres between strata, y: metres along a
 *  cell, z: how it is cut (0 faceted strata, 1 fluted ice, 2 basalt columns, 3 dressed stone), w: the
 *  strata's dip. uRockGlow is the thin light in Ember's cracks. */
export const rock = {
  uRockLit: { value: new Color(0.5, 0.45, 0.55) },
  uRockShade: { value: new Color(0.2, 0.18, 0.28) },
  uRockDeep: { value: new Color(0.1, 0.09, 0.16) },
  uRockLedge: { value: new Color(1, 1, 1) },
  uRockGlow: { value: new Color(0, 0, 0) },
  uRockStyle: { value: new Vector4(1.35, 3.6, 0, 0.1) },
};

/** What the frozen lake mirrors (lakemirror.ts): the sky and the peaks, baked down the fall line. x and
 *  y are the tangents the bake's edge and top reach, z how much of it to use (0 until the first bake). */
export const lake = {
  uLakeSky: { value: null as Texture | null },
  uLakeMap: { value: new Vector3(3.7, 1.2, 0) },
  /** The forest on the lake's banks, as the ice mirrors it. */
  uLakeTrees: { value: new Color(0.05, 0.2, 0.2) },
  /** The clock of the ground's own small loops (spindrift, a crack's breath), held under reduced motion. */
  uGroundTime: { value: 0 },
};

interface RockSet {
  lit: string;
  shade: string;
  deep: string;
  ledge: string;
  style: [number, number, number, number];
}

const ROCK: Record<string, RockSet> = {
  summit: { lit: '#94889E', shade: '#3C3654', deep: '#25213A', ledge: '#FFFFFF', style: [1.35, 3.6, 0, 0.1] },
  fang: { lit: '#8FCDF2', shade: '#1B4A9E', deep: '#071A58', ledge: '#D6ECFF', style: [1.8, 8.5, 1, 0] },
  volcano: { lit: '#5E5058', shade: '#1F1A22', deep: '#0E0C13', ledge: '#8C8288', style: [1.5, 6.5, 2, 0] },
  cone: { lit: '#B2A6AE', shade: '#5C5672', deep: '#3C3852', ledge: '#6F8C5A', style: [1.2, 2.5, 3, 0.02] },
};

function applyRock(p: Palette): void {
  const set = ROCK[p.massif.peak] ?? ROCK.summit;
  // A night mood's snow goes down with the light, and the rock has to go with it.
  const lum = p.snowLit.r * 0.3 + p.snowLit.g * 0.59 + p.snowLit.b * 0.11;
  const k = 0.3 + 0.7 * Math.min(1, lum);
  rock.uRockLit.value.set(set.lit).multiplyScalar(k);
  rock.uRockShade.value.set(set.shade).lerp(p.snowDeep, 0.18).multiplyScalar(0.5 + 0.5 * k);
  rock.uRockDeep.value.set(set.deep).multiplyScalar(0.5 + 0.5 * k);
  rock.uRockLedge.value.set(set.ledge).multiplyScalar(set.style[2] === 3 ? k : 1);
  rock.uRockGlow.value.copy(p.accentProp).multiplyScalar(p.massif.lava > 0 ? 1.1 : 0);
  rock.uRockStyle.value.set(...set.style);
  lake.uLakeTrees.value.copy(p.tallDark).lerp(p.tall, 0.35).multiplyScalar(0.8);
}

export function applyPalette(p: Palette): void {
  applyRock(p);
  shared.uSunDir.value.copy(p.sunDir);
  shared.uSunColor.value.copy(p.sunColor);
  shared.uHemi.value.copy(p.hemiSky);
  shared.uRim.value.copy(p.rim);
  shared.uFog.value.copy(p.fog);
  shared.uFogNear.value = p.fogNear;
  shared.uFogFar.value = p.fogFar;
  shared.uLantern.value = p.lantern ? 1 : p.lanternGlow;
  cloudShadowK = p.clouds.shadow;
  shared.uCloudShadow.value = cloudShadowsOn ? cloudShadowK : 0;
  shared.uSnowLit.value.copy(p.snowLit);
  shared.uSnowShade.value.copy(p.snowShade);
  shared.uSnowDeep.value.copy(p.snowDeep);
  shared.uSparkle.value = p.sparkle;
  shared.uIceMood.value = p.ice;
  shared.uShadeTint.value.copy(p.snowShade).lerp(p.snowDeep, 0.5);
  shared.uSkyZenith.value.copy(p.skyMid ?? p.skyZenith).lerp(p.skyZenith, 0.5);
  shared.uSkyHorizon.value.copy(p.skyHorizon);
  shared.uHazardDim.value = p.hazardDim;
  shared.uDiskDir.value.copy(p.diskDir);
  shared.uGiftGlow.value = p.giftGlow;
  shared.uShadowK.value = p.shadowK;
  shared.uHazardFog.value = p.hazardFog;
  const lum = (p.snowLit.r * 0.3 + p.snowLit.g * 0.59 + p.snowLit.b * 0.11 - 0.7) / 0.25;
  const k = Math.max(0, Math.min(1, lum));
  shared.uDayK.value = k * k * (3 - 2 * k);
  // The mist: by day a cool breath of the fog (cold air pools, so it leans to the shade's periwinkle);
  // at night the moonlit valley mist the sky already paints between its ridges, so the two meet. A
  // whiteout is all fog already and takes less of it.
  const dense = Math.max(0, Math.min(1, (260 - p.fogFar) / 110));
  if (p.mist) shared.uMistColor.value.copy(p.mist).lerp(p.fog, 0.3);
  else shared.uMistColor.value.copy(p.fog).lerp(p.skyHorizon, 0.35).lerp(p.snowLit, 0.25);
  // A drifting mist (Haunted Hollow's above all) lies a little deeper, so its banks roll round the
  // hazards' feet and the hollows past the banks brim with it.
  shared.uMist.value.set((p.mist ? 0.5 + 0.3 * p.mistK : 0.58) * (1 - 0.5 * dense), 5 + 4 * dense + 3 * p.atmo.drift * (p.mist ? 1 : 0.4));
  mistDriftK = p.atmo.drift;
  shared.uMistDrift.value = cloudShadowsOn ? mistDriftK : 0;
  // Forward scatter toward the sun, strongest by day; a moon gets a little.
  shared.uFogSun.value = (0.2 + 0.4 * shared.uDayK.value) * (1 - 0.6 * dense);
}

export const LIGHT_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uHemi;
uniform vec3 uRim;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uLanternPos;
uniform vec3 uLanternColor;
uniform float uLantern;
uniform vec4 uLanternLow;
uniform float uTime;
uniform vec3 uShadeTint;

vec3 toonLightK(vec3 lit, vec3 shade, vec3 n, vec3 v, float shadow, float rimK) {
  float ndl = dot(n, uSunDir);
  float t = smoothstep(-0.12, 0.42, ndl) * mix(0.18, 1.0, shadow);
  vec3 col = mix(shade, lit * uSunColor, t);
  col += uHemi * 0.07 * (0.5 + 0.5 * n.y);
  float fres = 1.0 - clamp(dot(n, v), 0.0, 1.0);
  fres = fres * fres * fres;
  col += uRim * fres * rimK * (0.35 + 0.65 * t);
  return col;
}

vec3 toonLight(vec3 lit, vec3 shade, vec3 n, vec3 v, float shadow) {
  return toonLightK(lit, shade, n, v, shadow, 0.3);
}

vec3 lanternLight(vec3 col, vec3 base, vec3 wp, vec3 n) {
  if (uLantern <= 0.0) return col;
  vec3 d = uLanternPos - wp;
  float dist = length(d);
  float att = clamp(1.0 - dist / 34.0, 0.0, 1.0);
  att *= att * uLantern * 1.3;
  // Right round the sled the lamp's forward beam gives way to the pool's fill below: at full strength it
  // blew the sled deck out to a pinkish white while the rider stayed cold.
  att *= 1.0 - 0.6 * uLanternLow.w * (1.0 - smoothstep(1.2, 3.2, length(wp - uLanternLow.xyz)));
  float ndl = max(dot(n, d / max(dist, 0.001)), 0.0) * 0.75 + 0.25;
  // Near-white parts (a kicker's snow cap, a gift's pale ribbon) take the lamp more gently: at full
  // strength they bloomed into a white hairline across the frame.
  float whiteB = smoothstep(0.55, 0.85, min(base.r, min(base.g, base.b)));
  vec3 lit = col + base * uLanternColor * att * ndl * 1.7 * (1.0 - 0.6 * whiteB);
  // The pool the lantern throws on the snow lights the rider from below (uLanternLow): the legs, the
  // sled and the lower coat sit in its warm light, fading up the body (the head and shoulders keep the
  // moon), out past the pool's edge and as the sled leaves the snow. Lit only from ahead, the rider
  // stayed cold while the pool washed the deck pink. A small floor on the base keeps it visible on the
  // ink-navy coat.
  vec3 dl = wp - uLanternLow.xyz;
  float fill = uLanternLow.w * (1.0 - smoothstep(0.12, 1.0, dl.y)) * step(-0.4, dl.y) * (1.0 - smoothstep(0.9, 1.9, length(dl.xz)));
  vec3 lampC = mix(vec3(dot(uLanternColor, vec3(0.2126, 0.7152, 0.0722))), uLanternColor, 0.66);
  lit += (base * 0.45 + 0.09) * lampC * fill * (0.6 + 0.4 * clamp(0.5 - 0.5 * n.y, 0.0, 1.0)) * uLantern;
  // Lamplight on a saturated warm surface (the runners, beanie and scarf) keeps that surface's own
  // hue: added over the cool moonlit rim it drifted to a hot pink-magenta once it bloomed, and the
  // player's colour is vermillion (ART.md section 1).
  float hiB = max(base.r, 0.001);
  float warmK = smoothstep(0.55, 0.85, (base.r - max(base.g, base.b)) / hiB) * smoothstep(0.05, 0.4, att * ndl + fill * 0.5);
  return mix(lit, base / hiB * lit.r, warmK);
}

uniform vec2 uMist;
uniform vec3 uMistColor;
uniform vec2 uFogFloor;
uniform float uFogSun;
uniform float uMistDrift;

/** How much of the low mist lies over a point d metres from the lens: it settles on the course's floor
 *  (uFogFloor) and thins with height above it, and it only gathers with distance, so the rider and the
 *  snow round it always stay clear. */
float mistHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float mistNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mistHash(i), mistHash(i + vec2(1.0, 0.0)), f.x), mix(mistHash(i + vec2(0.0, 1.0)), mistHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float mistAt(vec3 wp, float d) {
  float h = wp.y - (uFogFloor.x + uFogFloor.y * wp.z);
  float m = uMist.x * exp(-max(h, 0.0) / max(uMist.y, 0.5)) * smoothstep(18.0, 120.0, d);
  if (uMistDrift > 0.0) {
    // The mist drifts: banks some 30 m across roll slowly over the course on the wind, thinning to
    // gaps between them and changing as they go. It never lies thicker than the still mist did, so a
    // hazard in it reads no worse.
    vec2 q = wp.xz * 0.034 + vec2(uTime * 0.11, uTime * 0.045);
    float n = mistNoise(q) * 0.65 + mistNoise(q * 2.3 + vec2(3.1, -uTime * 0.05)) * 0.35;
    m *= mix(1.0, 0.25 + 0.75 * n, uMistDrift);
  }
  return m;
}

/** The fog's colour along a sight line: toward the sun it takes on the sun's warmth (aerial
 *  perspective), elsewhere it is the mood's fog. */
vec3 fogColor(vec3 dir) {
  float s = pow(max(dot(dir, uSunDir), 0.0), 4.0) * uFogSun;
  return mix(uFog, max(uFog, uSunColor * 0.92), s);
}

vec3 fogged(vec3 col, vec3 wp) {
  vec3 dv = wp - cameraPosition;
  float d = length(dv);
  float f = smoothstep(uFogNear, uFogFar, d);
  col = mix(col, uMistColor, mistAt(wp, d) * (1.0 - f));
  return mix(col, fogColor(dv / max(d, 0.001)), f);
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
`;

/** The sled lantern's pool of light on the snow (Lantern Night, ART.md section 7), shared by the snow
 *  and the groove so the cut never glows on its own: a tight round pool about 3.5 to 4 m across,
 *  centred just under the sled's prow (`low`, shared.uLanternLow), brightest at its heart and falling
 *  off softly all the way to its edge. A flat fill with a hard rim read as an orange decal or a stage
 *  spotlight; a wide soft spill smeared into a long beige streak across the foreground. As the sled
 *  rises off the snow the pool shrinks and dims (low.w), so it never lies detached ahead of an
 *  airborne rider. The lamp colour is a desaturated amber. */
export const LANTERN_POOL_GLSL = /* glsl */ `
float lanternPool(vec2 p, vec4 low) {
  float d = length(p - low.xz) / mix(0.6, 1.0, low.w);
  return exp(-d * d * 0.62) * (1.0 - smoothstep(1.7, 2.3, d)) * low.w;
}
vec3 lanternLamp(vec3 lanternColor) {
  // A desaturated amber: at full saturation the pool read as a peach ellipse.
  return mix(vec3(dot(lanternColor, vec3(0.2126, 0.7152, 0.0722))), lanternColor, 0.66);
}
`;

const SHADOW_VERT_PARS = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>
`;

const SHADOW_FRAG_PARS = /* glsl */ `
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
`;

/** Vertex body that fills vWorldPos / vNormalW and drives three's shadow chunks. */
const STD_VERT = /* glsl */ `
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <project_vertex>
  #include <worldpos_vertex>
  #include <shadowmap_vertex>
  vec4 wp4 = vec4(transformed, 1.0);
  vec3 nrm = objectNormal;
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
    nrm = mat3(instanceMatrix) * nrm;
  #endif
  wp4 = modelMatrix * wp4;
  vWorldPos = wp4.xyz;
  vNormalW = normalize(mat3(modelMatrix) * nrm);
`;

function lightsUniforms() {
  return UniformsUtils.clone(UniformsLib.lights);
}

export function makeSnowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    lights: true,
    uniforms: { ...lightsUniforms(), ...shared, ...bands, ...rock, ...lake },
    vertexShader: /* glsl */ `
      ${SHADOW_VERT_PARS}
      attribute float aEdge;
      attribute float aIce;
      attribute vec4 aKick;
      attribute vec2 aSnow;
      attribute vec4 aRock;
      attribute vec4 aPaint;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vEdge;
      varying float vIce;
      varying vec4 vKick;
      varying vec2 vSnow;
      varying vec4 vRock;
      varying vec4 vPaint;
      void main() {
        ${STD_VERT}
        vEdge = aEdge;
        vIce = aIce;
        vKick = aKick;
        vSnow = aSnow;
        vRock = aRock;
        vPaint = aPaint;
      }
    `,
    fragmentShader: /* glsl */ `
      ${SHADOW_FRAG_PARS}
      ${LIGHT_GLSL}
      ${LANTERN_POOL_GLSL}
      uniform vec3 uSnowLit;
      uniform vec3 uSnowShade;
      uniform vec3 uSnowDeep;
      uniform float uSparkle;
      uniform float uIceMood;
      uniform vec3 uFocus;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyHorizon;
      uniform vec3 uDiskDir;
      uniform float uBestZ;
      uniform float uBestX;
      uniform float uBestHW;
      uniform float uBestK;
      uniform float uBestWave;
      uniform vec3 uBestC;
      uniform float uFriendZ;
      uniform float uFriendX;
      uniform float uFriendHW;
      uniform vec3 uFriendC;
      uniform vec3 uRockLit;
      uniform vec3 uRockShade;
      uniform vec3 uRockDeep;
      uniform vec3 uRockLedge;
      uniform vec3 uRockGlow;
      uniform vec4 uRockStyle;
      uniform sampler2D uLakeSky;
      uniform vec3 uLakeMap;
      uniform vec3 uLakeTrees;
      uniform float uGroundTime;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vEdge;
      varying float vIce;
      varying vec4 vKick;
      /** Terrain (aSnow): metres across from the corridor's centreline, and how near a drift's crest. */
      varying vec2 vSnow;
      /** Terrain (aRock): how bare the ground is, its height over the floor and metres along the face,
       *  and the crest of the wall standing here over the floor (0: none). */
      varying vec4 vRock;
      /** Terrain (aPaint): the lake, the fork's strip, a leap's groomed landing, a tree run's canopy. */
      varying vec4 vPaint;
      uniform float uSnowFx;
      /** A distance band across the corridor at three.js z0 (centre x0, half-width hw), halfD metres
       *  deep each way: 1 on it, feathering out over its last metre and a half at the banks. Never
       *  thinner than about two pixels (fwz: metres of z one pixel spans), so a band far down the
       *  slope stays a thin bright line you can aim for instead of breaking up; that far it thins a
       *  little by coverage. */
      float distBand(float z0, float x0, float hw, float halfD, float fwz) {
        float hd = max(halfD, fwz * 1.1);
        float dz = abs(vWorldPos.z - z0);
        float m = 1.0 - smoothstep(hd - fwz * 0.5, hd + fwz * 0.5, dz);
        m *= 1.0 - smoothstep(hw - 1.5, hw, abs(vWorldPos.x - x0));
        return m * pow(halfD / hd, 0.3);
      }
      /** The band's light spilling onto the snow either side of it (its glow on the powder). */
      float bandSpill(float z0, float x0, float hw, float reach) {
        float dz = abs(vWorldPos.z - z0);
        return exp(-dz / reach) * (1.0 - smoothstep(hw - 1.5, hw + 0.5, abs(vWorldPos.x - x0)));
      }
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
      float dunes(vec2 p) {
        // Wind-sculpted snow: stretched along the fall line, two octaves.
        vec2 q = vec2(p.x * 0.55, p.y * 0.22);
        return vnoise(q) * 0.65 + vnoise(q * 2.7 + 13.1) * 0.35;
      }
      /** Wind-carved sastrugi on the banks: a sawtooth across the wind (a long gentle windward rise and
       *  a short steep lee drop under a crisp crest), the crests wandering. 0..1 at p (metres). */
      float sastrugi(vec2 p) {
        const vec2 W = vec2(0.42, 0.91);
        vec2 sp = vec2(dot(p, W), dot(p, vec2(-W.y, W.x)));
        float s = fract(sp.x * 0.62 + vnoise(sp * vec2(0.09, 0.22)) * 2.4 + vnoise(sp * vec2(0.4, 0.9) + 3.0) * 0.25);
        return smoothstep(0.0, 0.84, s) * (1.0 - smoothstep(0.84, 1.0, s));
      }
      /** Old sled tracks down the corridor's packed middle lane: pairs of faint runner grooves that
       *  wander a little and come and go. lat is metres from the centreline, z the three.js z, w the
       *  groove's half-width with its anti-aliasing. */
      float oldTracks(float lat, float z, float w) {
        float acc = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float c = (fi - 1.0) * 1.9 + 1.0 * sin(z * 0.021 + fi * 2.3) + 0.45 * sin(z * 0.057 + fi * 1.1);
          float dl = abs(abs(lat - c) - 0.32);
          float on = smoothstep(0.3, 0.55, vnoise(vec2(z * 0.03, fi * 7.3)));
          acc = max(acc, (1.0 - smoothstep(w * 0.4, w, dl)) * on);
        }
        return acc;
      }
      /** 1 on the border between two cells of a jittered grid (plates of ice). pw is how many
       *  cells one pixel spans, for anti-aliasing (derivatives are not reliable inside a branch). */
      float iceCracks(vec2 p, float pw, float thin) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float d1 = 8.0;
        float d2 = 8.0;
        vec2 c1 = vec2(0.0);
        vec2 c2 = vec2(0.0);
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y));
            vec2 o = vec2(hash13(vec3(i + g, 3.1)), hash13(vec3(i + g, 7.7))) * 0.85 + 0.075;
            float d = length(g + o - f);
            if (d < d1) {
              d2 = d1;
              c2 = c1;
              d1 = d;
              c1 = i + g;
            } else if (d < d2) {
              d2 = d;
              c2 = i + g;
            }
          }
        }
        float e = d2 - d1;
        // Each border between two plates gets its own strength and width (symmetric in the pair), so
        // some cracks run bright, some faint and some not at all: fractures, never a tiled floor.
        float hs = hash13(vec3(c1 + c2, 11.3));
        float w = (0.006 + 0.02 * hash13(vec3(c1 + c2, 2.9))) * thin;
        return (1.0 - smoothstep(w, w + 0.022 * thin + pw * 1.5, e)) * smoothstep(0.3, 0.62, hs) * (0.5 + 0.5 * hs) * (1.0 - smoothstep(0.1, 0.3, pw));
      }
      /** Bare ground as gouache: one cell of the mountain's cut at p (metres along the face, metres up
       *  it), in flat planes with hard edges and no noise: a few hashes a pixel, no search. tilt turns the
       *  plane (along, up), tone is its value, ledge says it lies flat enough to hold snow, ash or moss,
       *  and crack is a thin line along its edge (fp: metres one pixel spans). */
      void rockCells(vec2 p, float fp, out vec2 tilt, out float tone, out float ledge, out float crack) {
        float kind = uRockStyle.z;
        // Frostfang's flutes and Ember's columns run up the face, strata and courses along it.
        bool upright = kind > 0.5 && kind < 2.5;
        vec2 q = upright ? p.yx : p;
        q.y += uRockStyle.w * q.x + 0.55 * sin(q.x * 0.17) + 0.3 * sin(q.x * 0.41 + 1.7);
        // (A monotone warp: strata, flutes and columns come in uneven widths, never a ruled comb.)
        q.y += 0.42 * uRockStyle.x * sin(q.y * 1.7 / uRockStyle.x);
        float ry = q.y / uRockStyle.x;
        float r = floor(ry);
        float fy = ry - r;
        float h0 = hash13(vec3(r, 3.3, 9.1));
        float cw = uRockStyle.y * (0.7 + 0.6 * h0);
        float x = q.x / cw + h0 * 31.0;
        float c = floor(x);
        float fx = x - c;
        float h = hash13(vec3(c, r, 1.3));
        tilt = vec2(0.0);
        tone = 1.0;
        ledge = 0.0;
        crack = 0.0;
        if (kind < 0.5) {
          // Pinecrest: strata broken into faceted plates, each cell split along its own diagonal, the top
          // of a stratum a shelf that holds snow.
          float tri = step(h < 0.5 ? fx : 1.0 - fx, fy);
          float a = hash13(vec3(c, r, 2.1 + tri));
          float b = hash13(vec3(c, r, 4.7 + tri));
          tilt = vec2(a - 0.5, b - 0.42);
          tone = 0.74 + 0.5 * a;
          ledge = step(0.6 + 0.32 * b, fy) * step(0.34, h);
        } else if (kind < 1.5) {
          // Frostfang: crevasse ice in tall shards, each flute split along its own diagonal, pale
          // fractures running down some of the splits.
          float diag = (h < 0.5 ? fx : 1.0 - fx) - fy;
          float tri = step(diag, 0.0);
          float a = hash13(vec3(c, r, 2.1 + tri));
          float b = hash13(vec3(c, r, 4.7 + tri));
          tilt = vec2((a - 0.5) * 1.5 + (fy - 0.5) * 0.7, (b - 0.5) * 0.7);
          tone = 0.66 + 0.62 * a;
          crack = (1.0 - smoothstep(0.008, 0.02 + fp * 0.3, abs(diag))) * step(0.55, b);
        } else if (kind < 2.5) {
          // Ember: basalt columns, two faces a column, ash on their broken tops, and thin lava in some
          // of the joints between them.
          float a = hash13(vec3(c, r, 2.1));
          float face = step(0.5, fy);
          tilt = vec2(mix(-0.8, 0.8, face), (a - 0.5) * 0.3);
          tone = (0.78 + 0.34 * a) * mix(0.8, 1.14, face);
          ledge = step(0.94 + 0.05 * h, fx) * step(0.5, a);
          // A joint glows for one column's length in about one in ten: short thin runs, never a
          // lit grid.
          float edge = min(fy, 1.0 - fy) * uRockStyle.x;
          float width = 0.012 + 0.03 * smoothstep(0.0, 0.5, min(fx, 1.0 - fx)) + fp * 0.3;
          crack = (1.0 - smoothstep(width * 0.5, width, edge)) * step(0.9, hash13(vec3(c, r, 6.1)));
        } else {
          // Sakura: dressed stone in courses, each block a little pillowed, dark in its joints, moss
          // lying along the tops.
          float jx = min(fx, 1.0 - fx) * cw;
          float jy = min(fy, 1.0 - fy) * uRockStyle.x;
          tilt = vec2(fx - 0.5, fy - 0.5) * vec2(0.7, 1.1);
          tone = 0.8 + 0.4 * h;
          crack = 1.0 - smoothstep(0.04, 0.09 + fp, min(jx, jy));
          // Moss gathers in patches, on the tops of the stones it reaches.
          float mossy = vnoise(p * vec2(0.075, 0.19) + 2.0) * 0.7 + vnoise(p * vec2(0.23, 0.5)) * 0.3;
          ledge = smoothstep(0.5, 0.56, mossy + (fy - 0.62) * 0.34 + (h - 0.5) * 0.16);
        }
      }
      uniform vec2 uShadowScale;
      uniform float uShadowK;
      uniform float uCloudShadow;
      vec2 vogel(int i, int count, float phi) {
        float r = sqrt((float(i) + 0.5) / float(count));
        float th = float(i) * 2.39996323 + phi;
        return vec2(cos(th), sin(th)) * r;
      }
      /** Cast shadows on the snow (pines, banks, the rider), crisp right by their caster and softer
       *  and fainter the further they reach from it, like real penumbrae: the treeline's long raking
       *  shadows taper off into soft blue instead of printing hard blocks across the banks. How far
       *  away the caster is comes from asking the shadow map again a few metres nearer the light:
       *  still in shadow there means whatever casts it stands well off. */
      float snowShadow() {
        #if defined(USE_SHADOWMAP) && defined(SHADOWMAP_TYPE_PCF) && NUM_DIR_LIGHT_SHADOWS > 0
          if (!receiveShadow) return 1.0;
          vec4 sc = vDirectionalShadowCoord[0];
          sc.xyz /= sc.w;
          sc.z += directionalLightShadows[0].shadowBias;
          if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
          vec2 tx = uShadowScale.x / directionalLightShadows[0].shadowMapSize;
          float phi = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2831853;
          // The taps are unrolled (three's unroll pragma) and read at LOD 0: the shadow map has no mips,
          // and a texture read inside a per-pixel loop with branches makes D3D's compiler warn that
          // its derivatives are undefined.
          // Look for casters over the widest penumbra; most of the snow is in open sun and stops here.
          float nb = 1.0 - textureLod(directionalShadowMap[0], sc.xyz, 0.0);
          vec2 o;
          #pragma unroll_loop_start
          for ( int i = 0; i < 4; i ++ ) {
            o = sc.xy + vogel(UNROLLED_LOOP_INDEX, 4, phi) * tx * 0.5;
            nb += 1.0 - textureLod(directionalShadowMap[0], vec3(o, sc.z), 0.0);
          }
          #pragma unroll_loop_end
          if (nb < 0.01) return 1.0;
          // How far away the caster stands (0 near, 1 far): the shadow is asked again at four steps
          // between 1.5 and 9.5 m nearer the light, the steps dithered per pixel, and the share still
          // shadowed is the answer. One yes-or-no ask at 7 m stepped the penumbra and the thinning at
          // a hard line across a lone caster's long shadow (a pale band in it, cut square).
          float jit = fract(phi * 0.1591549);
          float far = 0.0;
          #pragma unroll_loop_start
          for ( int i = 0; i < 4; i ++ ) {
            far += 1.0 - textureLod(directionalShadowMap[0], vec3(sc.xy, sc.z - uShadowScale.y * (1.5 + 2.0 * (float(UNROLLED_LOOP_INDEX) + jit))), 0.0);
          }
          #pragma unroll_loop_end
          far = smoothstep(0.0, 1.0, far * 0.25);
          // A few centimetres of penumbra at the caster, a third of a metre at the far end, where the
          // shadow also thins out: a long shadow tapers away instead of ending in a stencilled edge.
          // Blizzard's diffuse light (uShadowK under 1) widens every penumbra too.
          vec2 rad = tx * mix(0.04, 0.34, far) * mix(2.6, 1.0, uShadowK);
          float s = 0.0;
          #pragma unroll_loop_start
          for ( int i = 0; i < 8; i ++ ) {
            s += textureLod(directionalShadowMap[0], vec3(sc.xy + vogel(UNROLLED_LOOP_INDEX, 8, phi + 1.3) * rad, sc.z), 0.0);
          }
          #pragma unroll_loop_end
          return mix(s / 8.0, 1.0, far * 0.42);
        #elif defined(USE_SHADOWMAP)
          return getShadowMask();
        #else
          return 1.0;
        #endif
      }
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float shadow = mix(1.0, snowShadow(), uShadowK);
        // A wall's shadow over the floor (the terrain casts none into the shadow map): the sun has to clear
        // the crest on its own side, which stands across the floor from here at the wall's height.
        if (vRock.w > 0.5) {
          float across = abs(vSnow.x) - vEdge - sign(uSunDir.x) * vSnow.x + 4.0;
          float crest = vRock.w + (vnoise(vec2(vRock.z * 0.13, 3.0)) - 0.5) * 8.0;
          float cleared = across * uSunDir.y / max(abs(uSunDir.x), 0.05) + vRock.y - crest;
          shadow = min(shadow, mix(1.0, 0.28 + 0.72 * smoothstep(-1.5, 1.5, cleared), uShadowK));
        }
        vec3 dpx = dFdx(vWorldPos);
        vec3 dpy = dFdy(vWorldPos);
        float dist = length(cameraPosition - vWorldPos);
        // Metres of snow one pixel spans (taken here, outside any branch, where derivatives are valid).
        float footprint = length(fwidth(vWorldPos.xz));
        float fwz = fwidth(vWorldPos.z);
        float fwx = fwidth(vWorldPos.x);
        // Where rock has taken over entirely, the snow's own fine work is skipped.
        float bare = smoothstep(0.8, 1.0, vRock.x);
        // The frozen lake gives way to drifted snow along a wandering, feathered shore.
        float lakeK = vPaint.x;
        float shoreIn = 0.0;
        if (lakeK > 0.0) {
          float wob = vnoise(vWorldPos.xz * 0.075) * 3.4 + vnoise(vWorldPos.xz * vec2(0.3, 0.13) + 4.0) * 1.8;
          shoreIn = 1.0 - smoothstep(-5.6, -0.5, vEdge + wob - 2.6);
          lakeK *= shoreIn;
        }
        // Glass Ice glazes the whole course; elsewhere ice patches (and the glacier's base sheen) glaze.
        float ice = max(max(max(vIce, vPaint.y), lakeK), uIceMood >= 1.0 ? 0.85 : uIceMood * 0.55) * (1.0 - bare);
        // 1 in bright day moods, 0 at night.
        float dayK = smoothstep(0.7, 0.95, dot(uSnowLit, vec3(0.3, 0.59, 0.11)));
        // Micro-dunes perturb the shading normal (visual only, fades out with distance).
        float detail = (1.0 - smoothstep(25.0, 140.0, dist)) * (1.0 - ice * 0.8) * (1.0 - bare);
        // The near ripples' tilt on its own, so the light can rake them (below) even where the toon
        // ramp is already saturated (a high moon, the lantern pool), and how deep in a trough this is.
        vec2 rip = vec2(0.0);
        float trough = 0.0;
        float crestR = 0.0;
        // The packed lane down the corridor's middle, where every sled before you rode: smoother
        // (fewer ripples), a step cooler, with old runner tracks in it (below). It wanders a little and
        // stays inside the corridor; Medium and High.
        float packed = (1.0 - smoothstep(-1.5, 0.5, vEdge)) * (1.0 - smoothstep(2.2, 4.8, abs(vSnow.x - 0.9 * sin(vWorldPos.z * 0.017)))) * uSnowFx * (1.0 - ice);
        // Sastrugi on the banks: wind-carved ridges with crisp crests, in patches. Medium and High.
        float sastC = 0.0;
        float sastL = 0.0;
        float bankS = smoothstep(1.5, 6.0, vEdge) * (1.0 - smoothstep(30.0, 70.0, dist)) * (1.0 - smoothstep(0.2, 0.5, footprint)) * uSnowFx * (1.0 - ice);
        if (detail > 0.0) {
          vec2 p = vWorldPos.xz;
          float h0 = dunes(p);
          float hx = dunes(p + vec2(0.35, 0.0));
          float hz = dunes(p + vec2(0.0, 0.35));
          // The broad dunes lie gentler under the lens, where at full tilt they rolled like sand.
          vec3 pert = vec3(h0 - hx, 0.0, h0 - hz) * 1.05 * detail * mix(0.5, 1.0, smoothstep(5.0, 24.0, dist));
          // Wind ripples: stretched noise running down the fall line, in patches over the dune
          // crests, gone before they are small enough to alias.
          float rk = (1.0 - smoothstep(6.0, 34.0, dist)) * smoothstep(0.28, 0.6, h0) * (1.0 - ice) * (1.0 - 0.6 * packed);
          if (rk > 0.0) {
            // At the same slant as the fine ripples below (straight down the fall line they fanned out
            // from the vanishing point like speed lines).
            vec2 rq = vec2(dot(p, vec2(0.866, 0.5)) * 4.2 + h0 * 5.0, dot(p, vec2(-0.5, 0.866)) * 0.3);
            pert.xz += vec2(0.866, 0.5) * (vnoise(rq) - vnoise(rq + vec2(0.3, 0.0))) * 1.1 * rk;
          }
          // Under the lens the dunes are too broad to read, so the snow there gets a finer grain: faint
          // wind ripples, stretched noise rather than a ruled wave, so they never line up into dune
          // bands across the slope. They lie at a slant to the fall line (the wind crosses the slope):
          // straight down it they converged on the vanishing point from the chase camera and read as
          // speed lines. They wander, break into short patches and thin out before they are fine
          // enough to alias, and their troughs hold a little periwinkle, so the lower third keeps a
          // snowy texture.
          float nk = (1.0 - smoothstep(0.03, 0.07, footprint * 0.8)) * (1.0 - smoothstep(10.0, 24.0, dist)) * (1.0 - ice) * (1.0 - 0.55 * packed);
          if (nk > 0.0) {
            // The ripple frame: across the crests, and along them (about 30 degrees off the fall line).
            const vec2 RA = vec2(0.866, 0.5);
            vec2 pr = vec2(dot(p, RA), dot(p, vec2(-RA.y, RA.x)));
            float warp = vnoise(pr * vec2(0.5, 0.12) + 4.7) * 1.8 + vnoise(pr * vec2(1.3, 0.3) + 9.1) * 0.5;
            vec2 rq = vec2(pr.x * 2.6 + warp, pr.y * 0.42);
            vec2 rq1 = rq + vec2(0.18, 0.0);
            float r0 = vnoise(rq) * 0.7 + vnoise(rq * vec2(2.1, 1.7) + 3.3) * 0.3;
            float r1 = vnoise(rq1) * 0.7 + vnoise(rq1 * vec2(2.1, 1.7) + 3.3) * 0.3;
            float k = nk * (0.45 + 0.55 * smoothstep(0.3, 0.75, vnoise(pr * vec2(0.18, 0.08) + 1.3)));
            rip = RA * ((r0 - r1) * 1.25 * k);
            pert.xz += rip;
            trough = smoothstep(0.5, 0.18, r0) * k;
            // A thin bright line along each ripple crest, where the wind packed it.
            crestR = smoothstep(0.62, 0.7, r0) * smoothstep(0.84, 0.72, r0) * k;
          }
          if (bankS > 0.0) {
            // About 15 cm of relief: the gentle windward faces take the light, the short lee faces drop
            // into shade under a bright crest line.
            float s0 = sastrugi(p);
            float sx = sastrugi(p + vec2(0.12, 0.0));
            float sz = sastrugi(p + vec2(0.0, 0.12));
            // In fields, and each ridge broken into short carved lengths (unbroken they combed the bank).
            float k = bankS * smoothstep(0.38, 0.66, vnoise(p * vec2(0.07, 0.035) + 2.2)) * smoothstep(0.28, 0.62, vnoise(p * vec2(0.55, 0.24) + 7.7));
            pert.xz += vec2(s0 - sx, s0 - sz) * 0.9 * k;
            sastC = smoothstep(0.72, 0.84, s0) * k;
            // The crease under each lee face holds a little cold blue whatever the light (it reads in a
            // flat, fully lit bank too, where the tilt alone barely moves the toon ramp).
            sastL = (1.0 - smoothstep(0.05, 0.4, s0)) * k;
          }
          n = normalize(n + pert);
        }
        vec3 lit = uSnowLit;
        vec3 shade = mix(uSnowShade, uSnowDeep, 0.2);
        // Banks deepen toward the treeline; the forest floor is cooler still.
        float bank = smoothstep(0.0, 10.0, vEdge);
        shade = mix(shade, uSnowDeep, bank * 0.35);
        // Cast shadows (pines, banks, the rider) fall to a deeper, bluer shade.
        shade = mix(shade, uSnowDeep, (1.0 - shadow) * 0.3);
        lit = mix(lit, mix(lit, uSnowShade, 0.25), smoothstep(9.0, 16.0, vEdge));
        // Lit snow stays below the bloom threshold, a little lower in bright day moods, where full
        // strength washes the whole foreground out to one value.
        lit *= 0.88 * mix(1.0, 0.94, dayK);
        float ndl = dot(n, uSunDir);
        float t = smoothstep(-0.12, 0.42, ndl) * mix(0.18, 1.0, shadow);
        // The painted clouds' shadows: big, very soft, slow cool patches drifting over the slope (about
        // 40 m across, sliding at under 2 m/s). They only take part of the light, so the sled's contact
        // shadow and every cast shadow stay darker than they are, and the bands are laid over them.
        if (uCloudShadow > 0.0) {
          vec2 cp = vWorldPos.xz * vec2(0.011, 0.008) + vec2(uTime * 0.017, uTime * 0.006);
          float cn = vnoise(cp) * 0.65 + vnoise(cp * 2.3 + 5.1) * 0.35;
          t *= 1.0 - smoothstep(0.5, 0.74, cn) * uCloudShadow;
        }
        // A tree run's canopy: the light comes through the boughs overhead in soft pools.
        if (vPaint.w > 0.0) {
          vec2 dq = vWorldPos.xz + vec2(sin(vWorldPos.z * 0.05) * 3.0, 0.0);
          float pools = smoothstep(0.42, 0.66, vnoise(dq * vec2(0.26, 0.13)) * 0.62 + vnoise(dq * vec2(0.7, 0.42) + 6.0) * 0.38);
          t *= 1.0 - vPaint.w * (0.82 - 0.62 * pools);
        }
        // By day a low sunset sun warms lit snow to cream, never to peach: the snow takes only a
        // trace of the key's colour (the mood's grade adds warmth of its own), so the warm light reads
        // against the periwinkle shade while the snow itself stays white rather than sand. Night
        // moods keep their moonlight's full colour.
        vec3 sunN = uSunColor / max(max(uSunColor.r, uSunColor.g), max(uSunColor.b, 0.001));
        vec3 sunSnow = mix(uSunColor, mix(vec3(1.0), sunN, 0.15), dayK);
        // Macro tone: broad, soft patches of warmer and cooler snow, 30 to 90 m across (older, sun-baked
        // crust against fresh, blue-shadowed powder), so the slope never reads as one flat value.
        float macro = vnoise(vWorldPos.xz * 0.012 + 3.1) * 0.6 + vnoise(vWorldPos.xz * 0.031 + 8.3) * 0.4;
        float mk = smoothstep(0.28, 0.72, macro) - 0.5;
        lit = mix(lit, lit * mix(vec3(1.0), sunN, 0.3) * 1.03, max(mk, 0.0) * 0.9);
        lit = mix(lit, mix(lit, uSnowShade, 0.3), max(-mk, 0.0) * 0.6);
        shade = mix(shade, uSnowDeep, max(-mk, 0.0) * 0.3);
        // The drifts past the treeline (terrain.ts): their crests catch the sun, their troughs hold cold
        // blue, and the light breaks over them a little more crisply than on the groomed run (gouache
        // drifts have an edge to their light).
        float driftK = smoothstep(10.5, 16.0, vEdge);
        t = mix(t, smoothstep(0.0, 0.2, ndl) * mix(0.18, 1.0, shadow), driftK * 0.45);
        vec3 col = mix(shade, lit * sunSnow, t);
        col = mix(col, col * mix(vec3(0.92), uSnowShade / max(uSnowLit, vec3(0.05)), 0.4), driftK * (1.0 - vSnow.y) * 0.3);
        col += lit * sunSnow * smoothstep(0.55, 0.95, vSnow.y) * 0.09 * t;
        // The lit side keeps a gentle Lambert falloff, so dunes and ripples hold their form.
        col *= mix(1.0, 0.8 + 0.28 * smoothstep(0.1, 0.95, ndl), t);
        // Raking light: ripple faces turned toward the sun's (or moon's) bearing catch it and the lee
        // faces drop into shade, whatever its height. The ripples run down the fall line, so it is the
        // sun's bearing across the slope that rakes them (a sun dead ahead still picks out one side).
        vec2 sunXZ = normalize(uSunDir.xz + vec2(0.0001, 0.0));
        float sunAcross = dot(vec2(0.866, 0.5), sunXZ);
        col *= 1.0 + dot(rip, vec2(0.866, 0.5)) * sign(sunAcross) * max(abs(sunAcross), 0.6);
        col += lit * sunSnow * (crestR * 0.07 + sastC * 0.14) * t;
        col = mix(col, col * mix(vec3(0.9), uSnowShade / max(uSnowLit, vec3(0.05)), 0.55), sastL * 0.32);
        // Periwinkle settles in the ripple troughs.
        col = mix(col, col * mix(vec3(1.0), uSnowShade / max(uSnowLit, vec3(0.05)), 0.5), trough * 0.8);
        // Wind-scoured patches: broad, soft-edged hollows a step cooler than the powder around them,
        // scattered over the near and middle run, so the groomed corridor under the lens is never one
        // flat sheet of a single value. Patches, never bands (bands read as dunes).
        float scour = smoothstep(0.52, 0.8, vnoise(vWorldPos.xz * vec2(0.17, 0.055) + 7.7)) * (1.0 - smoothstep(18.0, 50.0, dist)) * (1.0 - ice);
        col = mix(col, col * mix(vec3(0.92), uSnowShade / max(uSnowLit, vec3(0.05)), 0.4), scour * (0.22 + 0.12 * dayK));
        if (packed > 0.01 && dist < 60.0) {
          // The packed lane a step cooler, and the old runner tracks pressed into it: faint periwinkle
          // grooves, never as deep as your own (trails.ts), thinning before they can alias.
          vec3 coolP = mix(vec3(0.93), uSnowShade / max(uSnowLit, vec3(0.05)), 0.4);
          col = mix(col, col * coolP, packed * 0.25);
          float w = 0.08 + fwx * 1.5;
          float tr = oldTracks(vSnow.x, vWorldPos.z, w) * packed * min(1.0, 0.1 / w) * (1.0 - smoothstep(28.0, 60.0, dist));
          col = mix(col, col * coolP * coolP * 0.88, tr * 0.75);
        }
        if (vKick.x > 0.002) {
          // A built kicker (terrain.ts aKick): its face is packed, groomed snow a step cooler than the
          // powder around it, with corduroy running up to the lip; its flanks, where it falls back to
          // the slope, sit a step deeper; past the lip its takeoff wall drops into shade over a soft
          // contact shadow at its foot. As plain powder a kicker vanished, leaving only the lip board,
          // which read as a loose plank lying on the snow.
          vec3 coolK = mix(vec3(0.9), uSnowShade / max(uSnowLit, vec3(0.05)), 0.35);
          float faceK = smoothstep(0.04, 0.2, vKick.y) * (1.0 - smoothstep(0.985, 1.0, vKick.y)) * smoothstep(0.5, 0.9, vKick.x);
          float cord = smoothstep(0.3, 0.48, abs(fract(vKick.z / 0.3) - 0.5));
          col = mix(col, col * coolK * (1.0 - 0.08 * cord), faceK * 0.8);
          float flank = smoothstep(0.03, 0.35, vKick.x) * (1.0 - smoothstep(0.55, 0.92, vKick.x)) * smoothstep(0.02, 0.3, vKick.y) * (1.0 - smoothstep(0.0, 0.3, vKick.w));
          col = mix(col, col * coolK * coolK, flank * 0.7);
          float wall = smoothstep(0.0, 0.2, vKick.w) * (1.0 - smoothstep(1.2, 1.5, vKick.w));
          float foot = smoothstep(1.1, 1.5, vKick.w) * (1.0 - smoothstep(1.7, 2.8, vKick.w));
          col = mix(col, mix(uSnowShade, uSnowDeep, 0.35), (wall * 0.55 + foot * 0.4) * smoothstep(0.2, 0.8, vKick.x));
        }
        if (vPaint.z > 0.0) {
          // A leap's landing is groomed: corduroy across the fall line and broad swaths of it, so from
          // the air the face has a grain to read its distance and its slope by. Never a painted mark.
          float gk = vPaint.z * (1.0 - smoothstep(-3.5, 0.5, vEdge));
          vec3 coolG = mix(vec3(0.9), uSnowShade / max(uSnowLit, vec3(0.05)), 0.38);
          float fineG = smoothstep(0.26, 0.44, abs(fract(vWorldPos.z / 0.8) - 0.5)) * (1.0 - smoothstep(0.03, 0.09, fwz));
          float broadG = smoothstep(0.16, 0.34, abs(fract(vWorldPos.z / 5.5 + 0.05 * sin(vWorldPos.x * 0.21)) - 0.5));
          col = mix(col, col * coolG, gk * (0.14 + 0.2 * fineG + 0.3 * broadG * (1.0 - smoothstep(0.5, 1.2, fwz))));
        }
        col += uHemi * 0.07 * (0.5 + 0.5 * n.y);
        // Terrain gets almost no rim: the ground is always seen at grazing angles, where a rim term
        // turns the whole foreground into a cream wash.
        float fres = 1.0 - clamp(dot(n, v), 0.0, 1.0);
        col += uRim * fres * fres * fres * 0.05 * (0.35 + 0.65 * t);
        // The snow right under the lens sits a little cooler and darker: a value frame that holds
        // the eye on the rider instead of a bright foreground wash.
        float nearK = 1.0 - smoothstep(3.0, 11.0, dist);
        col = mix(col, col * mix(vec3(0.94), uSnowShade / max(uSnowLit, vec3(0.05)), 0.28), nearK * mix(0.35, 0.42, dayK));
        if (ice > 0.0) {
          // Glazed ice is a mirror over deep body ice. The glaze is flat (the dunes do not dent it),
          // so it reflects with the terrain's own normal: looking down into it under the lens you see
          // the deep blue body with pale fractures frozen inside, and toward grazing angles it turns
          // into a mirror of the sky that brightens to the pale horizon.
          vec3 ng = normalize(mix(n, normalize(vNormalW), 0.8));
          // A lake lies level, whatever its bed does: its mirror is a horizontal plane.
          ng = normalize(mix(ng, vec3(0.0, 1.0, 0.0), lakeK));
          float frs = 1.0 - clamp(dot(ng, v), 0.0, 1.0);
          // Polished glaze reflects a little even looking straight down, so the ice under the lens
          // carries the sky's blue instead of reading as a matte pale floor.
          // A strong mirror (critics read a weaker one as matte snow with crack lines).
          float fr = mix(0.32 + 0.68 * pow(frs, 2.6), 0.5 + 0.5 * pow(frs, 1.7), lakeK);
          vec3 rr = reflect(-v, ng);
          vec3 body = mix(uSnowShade, uSnowDeep, 0.55) * (0.6 + 0.4 * shadow);
          // The lake's body is black ice over deep water; the fork's strip a clear blue, so it holds
          // its colour against the snow even from far up the run, where a mirror alone goes white.
          body = mix(body, uSnowDeep * vec3(0.3, 0.36, 0.5), lakeK);
          body = mix(body, uSnowDeep * vec3(0.62, 0.8, 1.0), vPaint.y);
          // Fractures frozen in the body: the borders of irregular ice plates, straight-edged and
          // sharp like real cracks (smooth noise contours read as a topographic map), near the lens only.
          float nearC = 1.0 - smoothstep(5.0, 24.0, dist);
          if (nearC > 0.0) {
            float crack = max(iceCracks(vWorldPos.xz * 0.42, footprint * 0.42, 1.0), iceCracks(vWorldPos.xz * 1.1 + 5.3, footprint * 1.1, 1.0) * 0.55);
            body = mix(body, mix(uSnowShade, uSnowLit, 0.6), crack * nearC * 0.5);
          }
          col = mix(col, body, 0.62 * ice);
          // The mirror: the sky, and low along the horizon the far ridges, mirrored dark and soft in
          // the glaze, so the ice reads as a reflection and not a matte colour.
          vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.42, rr.y));
          float az = atan(rr.x, -rr.z);
          float ridgeH = 0.03 + 0.05 * vnoise(vec2(az * 5.0, 1.7)) + 0.025 * vnoise(vec2(az * 16.0, 4.2));
          sky = mix(sky, mix(uSkyHorizon, uSnowDeep, 0.55), smoothstep(ridgeH + 0.006, ridgeH - 0.006, rr.y) * 0.7);
          if (lakeK > 0.0) {
            // The real sky and peaks, baked looking down the fall line (lakemirror.ts): the sky is so far
            // off that one bake holds for any lens on the lake.
            if (uLakeMap.z > 0.0 && rr.z < -0.02) {
              vec2 uv = vec2(rr.x / -rr.z / uLakeMap.x * 0.5 + 0.5, rr.y / -rr.z / uLakeMap.y);
              if (uv.y < 1.0) sky = mix(sky, textureLod(uLakeSky, clamp(uv, vec2(0.002), vec2(0.998)), 0.0).rgb, uLakeMap.z * smoothstep(0.0, 0.1, 1.0 - uv.y) * lakeK);
            }
            // The banks and their forest stand in the mirror on the side the ray leaves by: where it
            // crosses the treeline's plane, snow up to the bank's top, dark trees to their jagged tips.
            float sd = rr.x >= 0.0 ? 1.0 : -1.0;
            float dp = abs(vSnow.x) - vEdge + 11.0 - sd * vSnow.x;
            float ta = dp / max(abs(rr.x), 0.03);
            float hr = ta * rr.y;
            float zr = vWorldPos.z + rr.z * ta;
            float tips = 16.5 + 7.0 * vnoise(vec2(zr * 0.07, sd + 2.0)) + 4.0 * abs(fract(zr * 0.21) - 0.5) + 2.5 * abs(fract(zr * 0.53 + 0.3) - 0.5);
            float near = 1.0 - smoothstep(90.0, 340.0, ta);
            vec3 stood = mix(uLakeTrees, uFog, 0.12 + 0.5 * smoothstep(40.0, 240.0, ta));
            stood = mix(stood, mix(uSnowShade, uSnowLit, 0.45), smoothstep(10.5, 9.0, hr));
            sky = mix(sky, stood, smoothstep(tips + 0.5, tips - 0.5, hr) * near * lakeK);
          }
          col = mix(col, sky * (0.72 + 0.28 * shadow), clamp(fr * 1.15, 0.0, 0.95) * ice * (1.0 - 0.6 * vPaint.y));
          if (lakeK > 0.0) {
            vec2 lp = vWorldPos.xz;
            // The rider in the mirror: the reflected ray is tested against a soft upright figure at the
            // rider (uFocus sits 0.9 m over the sled), so it falls where a reflection falls, leaves the ice
            // with an airborne sled, and costs no draw at all.
            vec3 tf = uFocus - vWorldPos;
            if (dot(tf.xz, tf.xz) < 90.0) {
              vec2 rh = normalize(rr.xz + vec2(0.0001, 0.0));
              float along = dot(tf.xz, rh);
              float miss = abs(tf.x * rh.y - tf.z * rh.x);
              float hb = along * rr.y / max(length(rr.xz), 0.05) - (tf.y - 0.9);
              float wide = mix(0.46, 0.3, smoothstep(0.16, 0.3, hb)) * mix(1.0, 0.7, smoothstep(0.6, 1.0, hb));
              float fig = (1.0 - smoothstep(wide * 0.55, wide * 1.2, miss)) * smoothstep(-0.08, 0.06, hb) * (1.0 - smoothstep(1.08, 1.32, hb)) * step(0.0, along);
              vec3 figC = mix(vec3(0.42, 0.16, 0.07), vec3(0.018, 0.028, 0.075), smoothstep(0.14, 0.26, hb));
              figC = mix(figC, vec3(0.62, 0.06, 0.03), smoothstep(0.76, 0.84, hb) * (1.0 - smoothstep(0.9, 0.98, hb)));
              figC = mix(figC, vec3(0.22, 0.05, 0.08), smoothstep(0.92, 1.0, hb));
              // (A reflection stands a little cooler and softer than what it mirrors.)
              col = mix(col, mix(figC, sky, 0.14), fig * lakeK * 0.7);
            }
            // Long fractures through the whole sheet, close cracks, and a deeper layer of them that slides
            // under the surface as you ride: the speed of a mirror is in what is under it.
            vec2 deep = lp - v.xz / max(v.y, 0.12) * 0.75;
            // (Low keeps the mirror, the near cracks and the blown snow: these are the Voronois and the wisps.)
            if (uSnowFx > 0.0 && dist < 130.0) {
              float major = iceCracks(lp * 0.05 + 3.1, footprint * 0.05, 0.13) * (1.0 - smoothstep(80.0, 130.0, dist));
              col = mix(col, uSnowLit * 0.95, major * 0.85 * lakeK);
            }
            if (uSnowFx > 0.0 && dist < 30.0) {
              float under = iceCracks(deep * 0.34 + 7.7, footprint * 0.34, 0.7) * (1.0 - smoothstep(16.0, 30.0, dist));
              col = mix(col, mix(uSnowShade, uSnowDeep, 0.3) * 1.3, under * 0.55 * lakeK);
              // Bubbles frozen in the ice, stacked under the surface.
              vec2 bq = deep * 2.6;
              vec2 bc = floor(bq);
              float bh = hash13(vec3(bc, 12.0));
              if (bh > 0.86) {
                float br = length(fract(bq) - 0.5 - (vec2(hash13(vec3(bc, 3.0)), hash13(vec3(bc, 5.0))) - 0.5) * 0.5);
                float bs = 0.09 + 0.1 * (bh - 0.86) / 0.14;
                col = mix(col, mix(uSnowShade, uSnowLit, 0.8), (1.0 - smoothstep(bs * 0.7, bs + footprint * 2.6, br)) * 0.5 * lakeK * (1.0 - smoothstep(7.0, 22.0, dist)));
              }
            }
            // Wind-swept snow in long feathered tongues, about 25 degrees off the fall line (never down
            // it, where they would converge like speed lines), thickest toward the shore.
            const vec2 WD = vec2(0.423, 0.906);
            vec2 wq = vec2(dot(lp, vec2(WD.y, -WD.x)), dot(lp, WD));
            float s1 = vnoise(vec2(wq.x * 0.13, wq.y * 0.0085) + 3.0);
            float s2 = vnoise(vec2(wq.x * 0.52, wq.y * 0.028) + 8.0);
            float s3 = vnoise(vec2(wq.x * 1.9, wq.y * 0.075) + 1.0);
            float lie = smoothstep(0.5 + 0.12 * shoreIn, 0.72 + 0.1 * shoreIn, s1 * 0.62 + s2 * 0.26 + s3 * 0.12);
            lie *= 1.0 - smoothstep(150.0, 260.0, dist) * 0.5;
            vec3 onIce = mix(mix(uSnowShade, uSnowDeep, 0.15), uSnowLit * sunSnow * 0.9, t);
            col = mix(col, onIce, lie * 0.86 * lakeK);
            // Spindrift running across the ice in thin bright wisps, near the lens only.
            if (uSnowFx > 0.0 && dist < 46.0) {
              float wisp = vnoise(vec2(wq.x * 0.7 + uGroundTime * 0.25, wq.y * 0.05 - uGroundTime * 0.85));
              wisp = smoothstep(0.66, 0.8, wisp) * vnoise(vec2(wq.x * 3.2, wq.y * 0.32 - uGroundTime * 2.2));
              col += uSnowLit * sunSnow * wisp * 0.3 * lakeK * (1.0 - smoothstep(24.0, 46.0, dist));
            }
          }
          vec3 glaze = col;
          // The sun: a long glittering path below it (tight across the view, loose along it), broken
          // into polished runs and fine scratches that all run toward the sun, so the streaks point
          // at it on screen instead of fanning out from the bottom of the frame like speed lines.
          vec2 sAz = normalize(uSunDir.xz + vec2(0.0001, 0.0));
          vec2 sq = vec2(dot(vWorldPos.xz, vec2(-sAz.y, sAz.x)), dot(vWorldPos.xz, sAz));
          vec3 hv = normalize(uSunDir + v);
          vec3 alongV = normalize(v - ng * dot(v, ng) + vec3(0.0, 0.0, 0.0001));
          vec3 acrossV = cross(ng, alongV);
          float hs = dot(hv, acrossV);
          float ha = dot(hv, alongV);
          float hn = max(dot(hv, ng), 0.2);
          float aniso = exp(-(hs * hs / 0.005 + ha * ha / 0.09) / (hn * hn));
          float polish = smoothstep(0.3, 0.75, vnoise(vec2(sq.x * 1.1, sq.y * 0.035)));
          // The sun path stays on the open glaze rather than blowing out across the banks.
          float open = mix(0.2, 1.0, smoothstep(0.82, 0.96, ng.y));
          col += uSunColor * aniso * (0.25 + 0.85 * polish) * ice * shadow * open * 0.45;
          // Scratches glint only in and around the sun path (a wide lobe lit them across the whole
          // foreground as a fan of speed lines), barely at all elsewhere.
          float sunR = pow(max(dot(rr, uSunDir), 0.0), 14.0);
          float scratch = smoothstep(0.62, 0.92, vnoise(vec2(sq.x * 6.0, sq.y * 0.06)));
          col += mix(uSunColor, vec3(1.0), 0.3) * scratch * (0.012 + 0.6 * sunR) * ice * shadow * (1.0 - smoothstep(14.0, 70.0, dist));
          // The brightest sun streaks roll off short of white (about 90% once graded) instead of
          // clipping, so they keep their gold and the glaze under them its form.
          vec3 over = max(col - 0.6, 0.0);
          col = mix(col, max(glaze, min(col, vec3(0.6)) + 0.16 * (1.0 - exp(-over / 0.16))), ice);
          // The gold sun path (ART.md section 7): the glaze mirrors the low sun disc as one long streak
          // running from under it all the way to the lens, tight across the view and loose along it,
          // broken into glittering polished runs. Laid over the rolled-off glaze rather than added to it,
          // so it keeps its gold instead of bleaching to a white beam.
          vec3 dd = normalize(uDiskDir);
          vec2 rA = normalize(rr.xz + vec2(0.0001, 0.0));
          vec2 dA = normalize(dd.xz + vec2(0.0001, 0.0));
          float acrossA = rA.x * dA.y - rA.y * dA.x;
          float elevD = rr.y - dd.y;
          float path = exp(-acrossA * acrossA / 0.005 - elevD * elevD / 0.08) * step(0.0, dot(rA, dA));
          float runs = 0.55 + 0.45 * smoothstep(0.25, 0.7, vnoise(vec2(sq.x * 0.9, sq.y * 0.05)));
          vec3 goldC = mix(mix(uSunColor, vec3(1.0, 0.78, 0.4), 0.5) * 0.86, uSunColor * 0.95, lakeK * 0.75);
          col = mix(col, goldC, path * runs * ice * mix(0.25, 1.0, shadow) * open * 0.92);
        }
        // Sparkle glints: one candidate per cell of a world-anchored grid on the snow, flashing as
        // the view sweeps past, on the lit side only: a bright core with two short rays, held at a
        // steady size on screen at any distance.
        // 1 on a moonlit night (Lantern Night), when the snow outside the lantern pool would
        // otherwise be one flat plane of mid lavender.
        float nightK = 1.0 - smoothstep(0.35, 0.6, dot(uSnowLit, vec3(0.3, 0.59, 0.11)));
        if (nightK > 0.0 && ice < 0.5) {
          // Moonlit drifts: long, soft swells of brighter and deeper snow down the fall line, with
          // wind ripples whose crests catch the moon, so the banks have form at any distance.
          float drift = vnoise(vWorldPos.xz * vec2(0.045, 0.014));
          float lift = smoothstep(-0.05, 0.4, ndl);
          col *= 1.0 + (drift - 0.45) * 0.42 * nightK * mix(0.6, 1.0, lift);
          float rip = vnoise(vec2(vWorldPos.x * 1.05 + drift * 5.0, vWorldPos.z * 0.085));
          float crest = smoothstep(0.6, 0.78, rip) * smoothstep(0.92, 0.78, rip);
          col += uSunColor * uSnowLit * crest * 0.16 * nightK * lift * smoothstep(5.0, 12.0, dist) * (1.0 - smoothstep(70.0, 120.0, dist));
        }
        float glint = 0.0;
        // Under the moon the snow glitters further out and more densely: it is the night's texture.
        float glintFar = mix(44.0, 72.0, nightK);
        if (dist < glintFar && uSparkle > 0.0) {
          vec2 gp = vWorldPos.xz * 2.4;
          vec2 cell = floor(gp);
          float h = hash13(vec3(cell, 5.0));
          // Right under the lens the glitter is denser and catches more than the sun's own mirror
          // angle, so the foreground sparkles instead of reading as a smooth plane.
          float nearG = 1.0 - smoothstep(4.0, 18.0, dist);
          // Snow looking toward the sun's bearing glitters more densely and brighter (it is the side
          // that mirrors the sun), so the glints gather on the sunward side of the frame.
          float toSun = smoothstep(0.35, 0.95, dot(normalize(vWorldPos.xz - cameraPosition.xz + vec2(0.0001, 0.0)), normalize(uSunDir.xz + vec2(0.0001, 0.0))));
          if (h > 0.87 - 0.07 * nightK - 0.06 * nearG - 0.05 * toSun) {
            vec2 pt = cell + 0.18 + 0.64 * vec2(hash13(vec3(cell, 1.7)), hash13(vec3(cell, 9.2)));
            vec2 o = (gp - pt) / 2.4;
            float rad = 0.008 + 0.004 * nearG + dist * 0.0021;
            // The z offset is foreshortened at grazing angles: undo it, so the glint stays round.
            vec2 q = vec2(o.x, o.y * max(abs(dot(v, n)), 0.12)) / rad;
            // Past the near snow a glint is a round point a couple of pixels across (each axis by its own
            // footprint): sized in metres, the foreshortening squashed it and its rays into a short
            // horizontal dash, and a field of them read as rain.
            float farG = smoothstep(4.0, 10.0, dist);
            q = mix(q, o / max(vec2(fwx, fwz) * 1.7, vec2(0.0005)), farG);
            float core = smoothstep(1.0, 0.0, length(q));
            float rays = (smoothstep(0.3, 0.0, abs(q.y)) * smoothstep(3.0, 0.0, abs(q.x)) + smoothstep(0.3, 0.0, abs(q.x)) * smoothstep(3.0, 0.0, abs(q.y))) * (1.0 - farG);
            float tw = fract(h * 37.0 + dot(v, vec3(1.3, 0.9, 1.1)) * 1.6);
            float on = smoothstep(0.64, 0.75, tw) * smoothstep(0.96, 0.86, tw);
            // Brightest toward the sun, where the snow mirrors it; only a faint glitter elsewhere.
            float facing = pow(max(dot(reflect(-uSunDir, n), v), 0.0), 5.0) * 0.85 + mix(0.15, 0.42, nearG) + 0.4 * toSun;
            glint = on * (core * core + rays * 0.45) * facing * uSparkle * (1.0 - ice * 0.6) * (1.0 - smoothstep(glintFar * 0.64, glintFar, dist));
            col += uSunColor * glint * smoothstep(0.05 - 0.15 * nightK, 0.45 - 0.15 * nightK, ndl) * mix(shadow, 1.0, 0.45 * nightK) * 3.4;
          }
        }
        if (uSnowFx > 0.0 && dist < 15.0 && ice < 0.5) {
          // Crystal glitter under the lens (Medium and High): a fine field of pin-point facets, a pixel
          // or two each, that wink on and off as the view sweeps over them, some faintly prismatic,
          // under the larger star glints. Lit snow only.
          vec2 mp = vWorldPos.xz * 7.0;
          vec2 mc = floor(mp);
          float mh = hash13(vec3(mc, 21.0));
          if (mh > 0.86) {
            vec2 mpt = mc + 0.2 + 0.6 * vec2(hash13(vec3(mc, 4.1)), hash13(vec3(mc, 6.6)));
            vec2 mo = (mp - mpt) / 7.0;
            // One pixel either way on screen, whatever the foreshortening (each axis by its own footprint).
            vec2 mq = mo / max(vec2(fwx, fwz) * 1.1, vec2(0.002));
            float mtw = fract(mh * 91.0 + dot(v, vec3(2.1, 1.7, 2.6)) * 3.0);
            float mon = smoothstep(0.7, 0.8, mtw) * smoothstep(1.0, 0.9, mtw);
            vec3 prism = mix(vec3(1.0), 0.5 + 0.5 * cos(6.2831 * (mh * 7.0 + vec3(0.0, 0.33, 0.67))), 0.4);
            col += mix(uSunColor, vec3(1.0), 0.3) * prism * smoothstep(1.0, 0.25, length(mq)) * mon * (1.0 - smoothstep(9.0, 15.0, dist)) * smoothstep(0.0, 0.35, ndl) * mix(shadow, 1.0, 0.3) * 1.8 * uSparkle;
          }
        }
        if (vPaint.y > 0.01) {
          // The fork's strip glints from far up the run: a scribed bright edge, and hard points of light
          // that wink as the view sweeps over them, on any bearing to the sun.
          float scribe = smoothstep(0.1, 0.4, vPaint.y) * (1.0 - smoothstep(0.4, 0.8, vPaint.y));
          col += mix(uSnowLit, vec3(1.0), 0.4) * scribe * 0.45;
          vec2 sq = vWorldPos.xz * vec2(0.8, 0.22);
          vec2 sc = floor(sq);
          float sh = hash13(vec3(sc, 31.0));
          float st = fract(sh * 17.0 + dot(v, vec3(9.0, 3.0, 13.0)) * 1.4);
          vec2 so = (fract(sq) - 0.5) / max(vec2(fwx * 0.8, fwz * 0.22) * 2.6, vec2(0.04));
          col += mix(uSunColor, vec3(1.0), 0.5) * step(0.5, sh) * smoothstep(0.78, 0.9, st) * max(0.0, 1.0 - length(so)) * vPaint.y * 3.2;
        }
        if (vRock.x > 0.004) {
          // Bare ground, in the art's language: flat planes and hard edges, in three values, with the
          // mountain's own cut (rockCells). The snow gives way to it along those edges, not in a soft
          // airbrushed fade, and what lies flat keeps snow, ash or moss.
          float kind = uRockStyle.z;
          vec2 tilt;
          float tone;
          float shelf;
          float crack;
          rockCells(vec2(vRock.z, vRock.y), footprint, tilt, tone, shelf, crack);
          float fine = 1.0 - smoothstep(0.1, 0.42, footprint);
          float rk = smoothstep(0.46, 0.54, vRock.x + (tone - 1.0) * 0.55 * fine);
          vec3 gn = normalize(vNormalW);
          vec3 fl = normalize(cross(dpx, dpy));
          fl *= sign(dot(fl, gn));
          gn = normalize(mix(fl, gn, 0.4 + 0.6 * smoothstep(40.0, 120.0, dist)));
          vec3 tu = cross(vec3(0.0, 1.0, 0.0), gn);
          tu /= max(length(tu), 0.08);
          vec3 tv = cross(gn, tu);
          vec3 rn = normalize(gn + (tu * tilt.x + tv * tilt.y) * fine);
          float ndr = dot(rn, uSunDir);
          float tr = smoothstep(-0.05, 0.5, ndr);
          // Three values, the steps a little soft: gouache, not a gradient.
          tr = mix(tr, (floor(tr * 2.999) + 0.5) / 3.0, 0.75) * mix(0.14, 1.0, shadow);
          vec3 sunRock = mix(vec3(1.0), sunN, 0.45);
          vec3 rc = mix(uRockShade, uRockLit * sunRock, tr);
          rc *= mix(1.0, tone, fine);
          float over = vRock.y / max(vRock.w, 14.0);
          if (kind > 0.5 && kind < 1.5) {
            // Crevasse ice: pale where it meets the light, going down through cobalt to near black.
            float dk = clamp(over, 0.0, 1.0);
            vec3 ramp = mix(uRockDeep, uRockShade * 1.15, smoothstep(0.0, 0.5, dk));
            ramp = mix(ramp, uRockLit, smoothstep(0.42, 1.0, dk) * (0.35 + 0.65 * tr));
            rc = ramp * mix(1.0, tone, fine) + uRockLit * 0.1 * tr;
            float fres = pow(1.0 - clamp(dot(rn, v), 0.0, 1.0), 3.0);
            rc += mix(uSkyHorizon, uSnowLit, 0.5) * fres * 0.25;
            rc += uSunColor * pow(max(dot(reflect(-v, rn), uSunDir), 0.0), 26.0) * 0.5 * shadow;
            rc = mix(rc, uRockLit * 1.15, crack * fine * (0.3 + 0.5 * dk));
          } else {
            // Rock darkens into the ground it stands in, and where a wall meets the floor.
            rc = mix(rc, uRockDeep, (1.0 - smoothstep(0.0, 0.34, abs(over))) * 0.55 * step(0.5, vRock.w));
          }
          if (kind > 2.5) rc = mix(rc, uRockDeep, crack * fine * 0.8);
          float lay = shelf * fine;
          if (kind < 0.5) {
            vec3 sn = mix(mix(uSnowShade, uSnowDeep, 0.25), uSnowLit * sunSnow * 0.92, tr);
            rc = mix(rc, sn, lay);
          } else if (kind > 2.5) {
            rc = mix(rc, uRockLedge * (0.55 + 0.6 * tr) * (0.8 + 0.3 * tone), lay * 0.92);
          } else {
            rc = mix(rc, uRockLedge * (0.5 + 0.7 * tr), lay);
          }
          float fresR = 1.0 - clamp(dot(rn, v), 0.0, 1.0);
          rc += uRim * fresR * fresR * fresR * 0.1 * (0.35 + 0.65 * tr);
          col = mix(col, rc, rk);
          if (kind > 1.5 && kind < 2.5) {
            // Ember's cracks: thin, dim, breathing; never a warm wash over the hazard's dark.
            float breathe = 0.7 + 0.3 * sin(uGroundTime * 1.1 + vRock.z * 0.13);
            col += uRockGlow * crack * rk * breathe * (1.0 - smoothstep(24.0, 80.0, dist)) * (1.0 - 0.6 * shelf);
          }
        }
        if (uLantern > 0.0) {
          // Lantern Night: a tight round pool of lamplight on the snow around and just ahead of the sled
          // (lanternPool), with its own warm glints. It is light laid over the moonlit snow in a
          // desaturated amber (a flat ochre fill read as a dirt road). Inside it all but replaces the
          // moonlit colour, so a moon shadow inside the pool never tints it pink; past its edge the snow
          // is saturated moonlit periwinkle again, glints and all.
          float pool = lanternPool(vWorldPos.xz, uLanternLow) * uLantern;
          vec3 lamp = lanternLamp(uLanternColor);
          // The lantern sits low, so it rakes the ripples too: crests facing the sled glow.
          lamp *= (0.55 + 0.45 * clamp(n.y, 0.0, 1.0)) * (1.0 + dot(rip, normalize(uLanternPos.xz - vWorldPos.xz + vec2(0.0001, 0.0))) * 0.55);
          col = col * (1.0 - 0.88 * min(pool, 1.0)) + lamp * pool * 1.1;
          col += uLanternColor * glint * pool * 2.5;
        }
        // Your best is a place on the mountain: a gold-white band across the corridor at that distance
        // (the stated exception to decision 69, which keeps the snow's own marks carved). Emissive, so it
        // blooms on Medium and High and reads as a bright stripe on Low, with a little of its light on
        // the powder either side. Its flare (uBestK) deepens and brightens it. A friend's unbeaten
        // distance is the same band in mint.
        if (uBestHW > 0.0) {
          float m = distBand(uBestZ, uBestX, uBestHW, 0.175 + 0.5 * uBestK, fwz);
          vec3 bc = uBestC * (1.4 + 1.1 * uBestK);
          col += uBestC * bandSpill(uBestZ, uBestX, uBestHW, 0.7 + 1.2 * uBestK) * (0.2 + 0.4 * uBestK);
          col = mix(col, bc * mix(0.86, 1.0, shadow), m);
          if (uBestWave > 0.0) {
            // New ground: a wave of gold-white light runs on down the slope ahead of you from the band,
            // a bright front with a short fading wake, gone with the flare.
            float down = uBestZ - vWorldPos.z;
            float d = down - uBestWave;
            float wave = exp(-abs(d) / 0.45) + (d < 0.0 && down > 0.0 ? exp(d / 3.5) * 0.35 : 0.0);
            col += uBestC * wave * uBestK * 1.1 * (1.0 - smoothstep(uBestHW - 1.5, uBestHW, abs(vWorldPos.x - uBestX)));
          }
        }
        if (uFriendHW > 0.0) {
          float m = distBand(uFriendZ, uFriendX, uFriendHW, 0.175, fwz);
          col += uFriendC * bandSpill(uFriendZ, uFriendX, uFriendHW, 0.7) * 0.15;
          col = mix(col, uFriendC * 1.25 * mix(0.86, 1.0, shadow), m);
        }
        col = fogged(col, vWorldPos);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export interface ToonOptions {
  /** Multiplies vertex colour for the lit side. */
  tint?: Color;
  /** 0 = shade derives from the colour, 1 = shade is the shared cool tint. */
  coolShade?: number;
  emissive?: Color;
  emissiveStrength?: number;
  /** Gentle sway for foliage, metres at the top. */
  sway?: number;
  /** Bob and spin (gifts). */
  bob?: boolean;
  doubleSided?: boolean;
  /** Fresnel rim strength (characters get more so they pop off shaded snow). */
  rim?: number;
  /** Camera distances (m) over which the surface dissolves in: fully gone at [0], solid at [1]. */
  nearFade?: [number, number];
  /** Gifts: shrink away right around the rider for a moment after a perfect landing. */
  clearFocus?: boolean;
  /** Dissolve through MSAA coverage (a smooth fade) instead of a per-pixel dither. Only for a
   *  multisampled target: without one the surface would never fade at all. */
  coverageFade?: boolean;
  /** Hazards (trees, rocks, logs): never lit warm by the sled lantern (ART.md section 1); at night
   *  they take a cool moon rim instead, so they read as hard silhouettes on the dark snow. */
  hazard?: boolean;
  /** The emissive lights only the bright, saturated parts (a stone lantern's window), not the whole
   *  prop: a uniform glow over a hazard warms its body and turns a dark rock into a lit crate. */
  glowMask?: boolean;
  /** Translucent ice (Frostfang's spires, seracs and crystal rocks): a value gradient to white-cyan at
   *  the tips, a faint inner glow, a bright fresnel rim and a pale-gold rim on the sun side. */
  ice?: boolean;
  /** The far rows of the decorative forest: they lean into the fog colour with distance (atmospheric
   *  perspective), so a forest has depth rather than reading as one flat dark mass. */
  aerial?: boolean;
  /** Cloth the wind moves (a set piece's bunting, banners and lantern strings): each vertex's aSway
   *  (0 held, 1 hanging free) swings it with the wind in the vertex shader, off the shared clock, by
   *  uCloth metres; a geometry without aSway stands still. */
  cloth?: boolean;
}

export function makeToonMaterial(opts: ToonOptions = {}): ShaderMaterial {
  const mat = new ShaderMaterial({
    lights: true,
    vertexColors: true,
    alphaToCoverage: !!opts.coverageFade,
    side: opts.doubleSided ? DoubleSide : FrontSide,
    uniforms: {
      ...lightsUniforms(),
      ...shared,
      uTint: { value: opts.tint ?? new Color(1, 1, 1) },
      uCool: { value: opts.coolShade ?? 0.45 },
      uEmissive: { value: opts.emissive ?? new Color(0, 0, 0) },
      uEmissiveStrength: { value: opts.emissiveStrength ?? 0 },
      uSway: { value: opts.sway ?? 0 },
      uRimK: { value: opts.rim ?? 0.3 },
      uCloth: { value: 0.35 },
      uNearFade: { value: new Vector2(...(opts.nearFade ?? [0.9, 3.2])) },
    },
    defines: { ...(opts.bob ? { BOB: 1 } : {}), ...(opts.clearFocus ? { CLEAR_FOCUS: 1 } : {}), ...(opts.coverageFade ? { COVERAGE_FADE: 1 } : {}), ...(opts.hazard ? { HAZARD: 1 } : {}), ...(opts.glowMask ? { GLOW_MASK: 1 } : {}), ...(opts.ice ? { ICE: 1 } : {}), ...(opts.aerial ? { AERIAL: 1 } : {}), ...(opts.cloth ? { CLOTH: 1 } : {}) },
    vertexShader: /* glsl */ `
      ${SHADOW_VERT_PARS}
      #ifdef CLOTH
        attribute float aSway;
        uniform float uCloth;
      #endif
      uniform float uTime;
      uniform float uSway;
      uniform vec2 uNearFade;
      uniform vec3 uFocus;
      uniform float uFocusClear;
      uniform float uResults;
      uniform float uTitleClear;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec3 vColor;
      varying float vGlow;
      varying vec4 vClip;
      varying float vLocalY;
      varying float vCull;
      /** Closest distance between segments p1-q1 and p2-q2. */
      float segSeg(vec3 p1, vec3 q1, vec3 p2, vec3 q2) {
        vec3 d1 = q1 - p1;
        vec3 d2 = q2 - p2;
        vec3 r = p1 - p2;
        float a = dot(d1, d1);
        float e = dot(d2, d2);
        float f = dot(d2, r);
        float c = dot(d1, r);
        float b = dot(d1, d2);
        // Every divisor is clamped away from zero (D3D warns on a guarded division too).
        float den = a * e - b * b;
        float s = clamp((b * f - c * e) / max(den, 1e-5), 0.0, 1.0) * step(1e-5, den);
        float t = (b * s + f) / max(e, 1e-5);
        if (t < 0.0) {
          t = 0.0;
          s = clamp(-c / max(a, 1e-5), 0.0, 1.0);
        } else if (t > 1.0) {
          t = 1.0;
          s = clamp((b - c) / max(a, 1e-5), 0.0, 1.0);
        }
        return length(p1 + d1 * s - p2 - d2 * t);
      }
      void main() {
        vColor = color;
        vLocalY = position.y;
        vCull = 0.0;
        #ifdef USE_INSTANCING_COLOR
          vColor *= instanceColor;
        #endif
        vGlow = 0.0;
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          float phase = ip.x * 0.37 + ip.z * 0.21;
        #else
          float phase = 0.0;
        #endif
        if (uSway > 0.0) {
          float k = max(transformed.y, 0.0) / 6.0;
          transformed.x += sin(uTime * 1.3 + phase) * uSway * k * k;
          transformed.z += cos(uTime * 1.1 + phase * 1.3) * uSway * 0.6 * k * k;
        }
        #ifdef CLOTH
          if (aSway > 0.0) {
            // A gust runs along a string (its phase by where the vertex stands), and what hangs free
            // swings across the run and lifts a little at each end of its swing.
            vec3 cw = (modelMatrix * vec4(transformed, 1.0)).xyz;
            float cph = cw.x * 0.23 + cw.z * 0.19;
            float g = sin(uTime * 2.1 + cph) * 0.62 + sin(uTime * 3.4 + cph * 1.7 + 1.3) * 0.38;
            transformed.x += g * aSway * uCloth * 0.55;
            transformed.z += g * aSway * uCloth;
            transformed.y += abs(g) * aSway * uCloth * 0.3;
          }
        #endif
        #ifdef BOB
          float a = uTime * 2.2 + phase * 3.0;
          float ca = cos(a);
          float sa = sin(a);
          transformed = vec3(transformed.x * ca - transformed.z * sa, transformed.y + sin(uTime * 3.0 + phase * 5.0) * 0.12, transformed.x * sa + transformed.z * ca);
          objectNormal = vec3(objectNormal.x * ca - objectNormal.z * sa, objectNormal.y, objectNormal.x * sa + objectNormal.z * ca);
          vGlow = 1.0;
          #ifdef USE_INSTANCING
            // Gifts never dither: one passing the lens or sitting in the line of sight to the rider
            // (and, right after a perfect landing, one crowding the rider) shrinks away instead.
            vec3 gc = (modelMatrix * vec4(ip, 1.0)).xyz;
            float keepG = smoothstep(uNearFade.x, uNearFade.y, distance(gc, cameraPosition));
            vec3 segG = uFocus - cameraPosition;
            float segGL = length(segG);
            vec3 segGD = segG / max(segGL, 0.001);
            float alongG = dot(gc - cameraPosition, segGD);
            float offG = length(gc - (cameraPosition + segGD * alongG));
            if (alongG > 0.0 && alongG < segGL - 1.2) keepG = min(keepG, smoothstep(0.8, 2.0, offG));
            #ifdef CLEAR_FOCUS
              // A gift never sits in the rider's silhouette, where it reads as a backpack or a hat:
              // one right by the rider, or near it and overlapping it on screen, shrinks away. Right
              // after a perfect landing and while the results frame the wreck (uFocusClear) every
              // gift within about 3 m goes too.
              float gd = distance(gc, uFocus);
              float crowd = smoothstep(mix(1.0, 2.4, uFocusClear), mix(1.7, 3.4, uFocusClear), gd);
              vec4 rv = viewMatrix * vec4(uFocus, 1.0);
              vec4 gv = viewMatrix * vec4(gc, 1.0);
              if (rv.z < -0.5 && gv.z < -0.3) {
                // The rider's outline on screen (sled, beanie and the streaming scarf: about 0.85 m either
                // side of its middle, a metre up and down) grown by the gift's own size, bob included.
                vec2 reach = vec2(0.85, 1.0) / -rv.z + 0.42 / -gv.z;
                float ov = length((gv.xy / -gv.z - rv.xy / -rv.z) / reach);
                crowd = min(crowd, mix(1.0, smoothstep(1.0, 1.3, ov), 1.0 - smoothstep(7.0, 12.0, gd)));
              }
              keepG = min(keepG, crowd);
            #endif
            // While the results are up, a gift the frame edge would cut in half shrinks away: a half
            // gift at the edge of the hero shot read as a mistake.
            if (uResults > 0.0) {
              vec4 cg = projectionMatrix * viewMatrix * vec4(gc, 1.0);
              if (cg.w > 0.1) {
                vec2 e = abs(cg.xy / cg.w) + vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * 0.5 / cg.w;
                keepG = min(keepG, mix(1.0, smoothstep(1.0, 0.92, max(e.x, e.y)), uResults));
              }
            }
            transformed *= keepG;
          #endif
        #endif
        #if defined(HAZARD) && defined(USE_INSTANCING)
          // While the results frame the wreck, a whole hazard dissolves when its trunk comes within about
          // 1.2 m (plus its own canopy) of the sight line from the lens to the wreck, or within about
          // 4 m of the lens: cutting only the fragments near the line left canopies hanging over the
          // hero shot. The line stops a little short of the wreck, so the tree it hugged stays.
          if (uResults > 0.0) {
            vec3 b0 = (modelMatrix * vec4(ip, 1.0)).xyz;
            float sx = min(length(instanceMatrix[0].xyz), 2.0);
            vec3 b1 = b0 + vec3(0.0, 5.0 * length(instanceMatrix[1].xyz), 0.0);
            vec3 sl = uFocus - cameraPosition;
            float sll = length(sl);
            vec3 a1 = cameraPosition + sl * max(sll - 1.3, 0.0) / max(sll, 0.001);
            float line = segSeg(cameraPosition, a1, b0, b1) - sx * 1.1;
            float lens = segSeg(cameraPosition, cameraPosition, b0, b1) - sx * 0.8;
            vCull = max(1.0 - smoothstep(0.9, 1.3, line), 1.0 - smoothstep(3.6, 4.4, lens));
          }
          // The title reel's hero keeps a clean silhouette: a hazard standing right behind it on screen,
          // within about 20 m of it, dissolves whole (a dark log behind the rider merged with the coat
          // and muddied the key art).
          if (uTitleClear > 0.0) {
            vec3 t0 = (modelMatrix * vec4(ip, 1.0)).xyz;
            vec4 rv = viewMatrix * vec4(uFocus, 1.0);
            vec4 bv = viewMatrix * vec4(t0 + vec3(0.0, 0.5, 0.0), 1.0);
            float back = rv.z - bv.z;
            if (rv.z < -0.5 && back > -0.5 && back < 25.0) {
              // Its offset from the hero on screen, in metres at the hero's depth; a log's length lives in
              // its x scale.
              vec2 off = (bv.xy / -bv.z - rv.xy / -rv.z) * -rv.z;
              float hl = min(length(instanceMatrix[0].xyz), 8.0) * 0.5 * (rv.z / bv.z);
              float ov = length(off / vec2(1.5 + hl, 1.4 + hl * 0.4));
              vCull = max(vCull, (1.0 - smoothstep(0.9, 1.25, ov)) * (1.0 - smoothstep(18.0, 25.0, back)));
            }
          }
        #endif
        #include <project_vertex>
        vClip = gl_Position;
        #include <worldpos_vertex>
        #include <shadowmap_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        vec3 nrm = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
          nrm = mat3(instanceMatrix) * nrm;
        #endif
        wp4 = modelMatrix * wp4;
        vWorldPos = wp4.xyz;
        vNormalW = normalize(mat3(modelMatrix) * nrm);
      }
    `,
    fragmentShader: /* glsl */ `
      ${SHADOW_FRAG_PARS}
      ${LIGHT_GLSL}
      uniform vec3 uTint;
      uniform float uRimK;
      uniform vec3 uFocus;
      uniform vec2 uNearFade;
      uniform float uCool;
      uniform vec3 uEmissive;
      uniform float uEmissiveStrength;
      uniform float uHazardDim;
      uniform float uResults;
      uniform float uTitleClear;
      uniform float uGiftGlow;
      uniform float uShadowK;
      uniform float uHazardFog;
      uniform float uDayK;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying vec3 vColor;
      varying float vGlow;
      varying vec4 vClip;
      varying float vLocalY;
      varying float vCull;
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float shadow = 1.0;
        #ifdef USE_SHADOWMAP
          shadow = mix(1.0, getShadowMask(), uShadowK);
        #endif
        float keep = 1.0;
        #ifndef BOB
          // Props near the camera, or in the line of sight to the rider, dissolve instead of blocking it.
          float dCam = length(cameraPosition - vWorldPos);
          vec3 seg = uFocus - cameraPosition;
          float segL = length(seg);
          vec3 segD = seg / max(segL, 0.001);
          float along = dot(vWorldPos - cameraPosition, segD);
          float los = 1.0;
          if (along > 0.0 && along < segL - 0.8) los = smoothstep(0.7, 2.2, length(vWorldPos - (cameraPosition + segD * along)));
          keep = min(smoothstep(uNearFade.x, uNearFade.y, dCam), los);
          #ifdef HAZARD
            // While the results frame the wreck, hazards within about 3 m of the lens dissolve (gone by
            // 3.2 m, solid from 4.8 m): a pine right by the lens filled the top of the hero shot with
            // dark branch polygons that read as near-plane clipping. The trees behind the wreck stay.
            keep = min(keep, smoothstep(uNearFade.x + 1.4 * uResults, uNearFade.y + 1.2 * uResults, dCam));
            // A big hazard hugging the side of the frame within a few metres of the lens (a serac slab
            // you are passing) dissolves too, but only beside or behind the rider: ahead of it, it is
            // still a threat and stays solid.
            vec3 fwdV = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
            float rd = dot(uFocus - cameraPosition, fwdV);
            float side = smoothstep(0.6, 0.9, abs(vClip.x / max(vClip.w, 0.001))) * smoothstep(rd + 2.5, rd + 0.5, dot(vWorldPos - cameraPosition, fwdV));
            keep = min(keep, mix(1.0, smoothstep(3.0, 7.0, dCam), side));
            keep = min(keep, 1.0 - vCull * max(uResults, uTitleClear));
          #endif
          #ifdef COVERAGE_FADE
            if (keep < 0.02) discard;
          #else
            if (keep < 1.0) {
              // Interleaved gradient noise: a fine, unstructured per-pixel dither (an ordered 4x4 grid
              // reads as a coarse screen door on a big prop at the frame edge). The last fifth is
              // dropped outright, so a nearly gone prop never lingers as sparse specks.
              float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
              if (ign >= (keep - 0.2) / 0.8) discard;
            }
            keep = 1.0;
          #endif
        #endif
        vec3 base = vColor * uTint;
        vec3 shade = mix(base * 0.42, uShadeTint * (0.35 + 0.4 * dot(base, vec3(0.33))), uCool);
        // Snow caps and drifts (near-white parts) take only a trace of a low sun's colour by day, like
        // the snow they sit in (decision 47): under Glass Ice's gold sun a serac's drift read as a tan slab.
        vec3 sunN = uSunColor / max(max(uSunColor.r, uSunColor.g), max(uSunColor.b, 0.001));
        float whiteK = smoothstep(0.78, 0.92, min(base.r, min(base.g, base.b))) * uDayK;
        vec3 litBase = mix(base, base * mix(vec3(1.0), sunN, 0.15) / max(uSunColor, vec3(0.05)), whiteK);
        vec3 col = toonLightK(litBase, shade, n, v, shadow, uRimK);
        #ifdef ICE
          // Translucent ice, still a hard faceted hazard but never mint: deep blue at the foot rising to
          // white-cyan at the tips, lit by only a trace of the low sun's hue (gold over blue turned the
          // spires teal-green), with a faint inner glow where light passes through. The snow parts stay
          // snow. The rims go on after the hazard dim, below.
          float iceK = 1.0 - smoothstep(0.72, 0.88, min(base.r, min(base.g, base.b)));
          float tipK = smoothstep(0.3, 4.6, vLocalY);
          float fr = 1.0 - clamp(dot(n, v), 0.0, 1.0);
          // In low visibility (uHazardFog under 1) the tips whiten less, so the spire stays a dark shape.
          vec3 body = mix(base, vec3(0.78, 0.94, 1.0), tipK * 0.4 * uHazardFog) * 0.92;
          vec3 iceShade = mix(base * 0.4, uShadeTint * 0.45, 0.5) * vec3(0.85, 0.92, 1.12);
          float iceT = smoothstep(-0.12, 0.42, dot(n, uSunDir)) * mix(0.25, 1.0, shadow);
          vec3 iceCol = mix(iceShade, body * mix(vec3(1.0), sunN, 0.3), iceT) + uHemi * 0.06;
          iceCol += vec3(0.3, 0.7, 1.0) * 0.1 * (0.35 + 0.65 * tipK) * (1.0 - fr);
          col = mix(col, iceCol, iceK);
        #endif
        #ifdef GLOW_MASK
          float hiC = max(base.r, max(base.g, base.b));
          float loC = min(base.r, min(base.g, base.b));
          col += uEmissive * uEmissiveStrength * smoothstep(0.85, 0.95, hiC) * smoothstep(0.3, 0.45, (hiC - loC) / max(hiC, 0.001));
        #else
          col += uEmissive * uEmissiveStrength;
        #endif
        col += base * vGlow * 0.18;
        #ifdef BOB
          // Low visibility (Blizzard): gifts glow marigold from within, brightest on the sun side.
          col += vec3(1.0, 0.62, 0.16) * uGiftGlow * (0.3 + 0.3 * max(dot(n, uSunDir), 0.0));
        #endif
        #ifdef HAZARD
          col *= uHazardDim;
          // Contact occlusion: a hazard darkens and cools toward where it stands in the snow (its foot,
          // the snow heaped round it), so a tree or a rock sits in the slope instead of on it.
          col *= mix(vec3(0.6, 0.66, 0.84), vec3(1.0), smoothstep(-0.25, 0.95, vLocalY));
          #ifdef ICE
            // A bright fresnel rim, pale cyan away from the sun and pale gold on the sun side (the warm
            // rim on cold ice), and a glassy glint, kept bright over the hazard dim.
            float sunSide = smoothstep(-0.1, 0.6, dot(normalize(n.xz + vec2(0.0001, 0.0)), normalize(uSunDir.xz + vec2(0.0001, 0.0))));
            vec3 rimC = mix(vec3(0.72, 0.93, 1.0), mix(uRim, vec3(1.0, 0.86, 0.6), 0.4), sunSide);
            col += rimC * pow(fr, 2.2) * 0.55 * iceK * (0.35 + 0.65 * uHazardFog);
            col += uSunColor * pow(max(dot(reflect(-v, n), uSunDir), 0.0), 20.0) * 0.45 * iceK * shadow;
          #endif
          if (uLantern > 0.0) {
            // A cool moon rim instead of the lantern's amber: the silhouette stays dark and hard.
            float fr2 = 1.0 - clamp(dot(n, v), 0.0, 1.0);
            col += uRim * fr2 * fr2 * 0.4 * uLantern * (0.5 + 0.5 * smoothstep(-0.3, 0.4, dot(n, uSunDir)));
          }
        #else
          col = lanternLight(col, base, vWorldPos, n);
        #endif
        #ifdef BOB
          // A glowing gift cuts through the fog it would otherwise sink into.
          col = mix(fogged(col, vWorldPos), col, 0.8 * uGiftGlow);
        #elif defined(HAZARD)
          // In low visibility (uHazardFog under 1) the fog takes less of a hazard: dangers stay dark,
          // hard silhouettes in the murk instead of sinking to the value of the shaded snow.
          float dH = length(vWorldPos - cameraPosition);
          // The low mist veils a hazard's foot less than the snow round it (its body stands clear).
          col = mix(col, uMistColor, mistAt(vWorldPos, dH) * 0.7 * uHazardFog);
          col = mix(col, fogColor((vWorldPos - cameraPosition) / max(dH, 0.001)), smoothstep(uFogNear, uFogFar, dH) * uHazardFog);
          #ifdef AERIAL
            // The far forest rows lift into the fog colour well before the fog proper starts, so row
            // stands behind row in paler steps; the treeline wall and the run's own hazards stay dark.
            col = mix(col, uFog, smoothstep(22.0, 150.0, length(vWorldPos - cameraPosition)) * 0.45 * uHazardFog);
          #endif
        #else
          col = fogged(col, vWorldPos);
        #endif
        // With alpha to coverage, alpha is how many MSAA samples this fragment covers.
        gl_FragColor = vec4(col, keep);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return mat;
}

/** GLSL shared by the ghost body, wisp, aura and shadow: how bright the mood's snow is (0 = night,
 *  1 = day), how hard ghosts blaze (Blizzard passes uGlow 3; the clear-sky baseline is 1.25), the kind
 *  colour pushed a little past itself in saturation so mint never drifts toward cream on warm snow,
 *  and how a spirit dissolves from the shoulders down into its wisp (`h` is the height in the rider
 *  model, 0 at the runners, about 0.85 at the shoulders and 1.1 at the head; far ghosts, a few pixels
 *  tall, keep more of their lower half so they still read as riders). `climb` (0 to 1) raises the
 *  dissolve from the hips to the shoulders: a ghost grown big on screen or near the lens is a glass
 *  head and shoulders over its wisp, never a hollow outline of a whole body. */
export const GHOST_MOOD_GLSL = /* glsl */ `
float ghostDay(vec3 snowLit) {
  return smoothstep(0.25, 0.65, dot(snowLit, vec3(0.2126, 0.7152, 0.0722)));
}
float ghostBlaze(float glow) {
  return clamp((glow - 1.4) / 0.8, 0.0, 1.0);
}
vec3 ghostSat(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return max(mix(vec3(l), c, 1.25), vec3(0.0));
}
float ghostRise(float h, float farK, float climb) {
  return mix(smoothstep(mix(0.12, 0.66, climb), mix(0.86, 1.12, climb), h), 1.0, 0.45 * farK * (1.0 - climb));
}
// Smooth 2D value noise in 0..1 (arithmetic only: no texture reads).
float ghostHash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}
float ghostNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ghostHash(i), ghostHash(i + vec2(1.0, 0.0)), f.x), mix(ghostHash(i + vec2(0.0, 1.0)), ghostHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/** Contract C10: every ghost layer draws only where the stencil is not 1 (the rider's own pixels,
 *  which the rider's materials mark), and never changes the buffer. So no ghost covers or tints the
 *  rider, whether it rides beside, behind or in front of it. */
export function ghostStencil(m: Material): void {
  m.stencilWrite = true;
  m.stencilWriteMask = 0;
  m.stencilFunc = NotEqualStencilFunc;
  m.stencilRef = 1;
}

/** Spectral ghosts (ART.md section 6): one glass silhouette per rider (GhostVisuals draws a depth
 *  prepass first, so only the front-most surface shades). The body is the kind colour itself, never a
 *  tint over the snow: deep teal (amber, crimson) at the runners rising to saturated mint at the head,
 *  a clear core inside a crisp, bright fresnel rim (dense enough by day that warm snow cannot bleach
 *  it to cream), and drawn nowhere on the rider's own pixels (contract C10, ghostStencil). At night
 *  the body glows instead, and in Blizzard (uGlow > 1.4) the rim's outer lip runs hot enough to bloom
 *  and the fog barely touches them, so ghosts blaze through the white. uMood (night, dusk and
 *  whiteout moods) lifts the glow further, so a ghost ahead still reads as a light in the dark.
 *  A ghost is a spirit, not a statue: head and shoulders are solid glass, and from the chest down it
 *  dissolves into its wisp (the sled is only a faint outline), so a pack of near ghosts never reads
 *  as a wall of jade. One treatment in every fade: the rim stays in the kind colour and the inside
 *  stays tinted glass (never thinned toward white or cream), and a ghost never hollows into an
 *  outline. uFade fades a crashing ghost down to its rim (the body goes first). uBody is how small
 *  the ghost still is on screen: as it grows the dissolve climbs from the hips to the shoulders and
 *  its fill thins only to about 75% (its rim to 60%), so a big ghost is a glass head and shoulders over its wisp (two
 *  hollow outlines round the rider's head read as wireframes). uNear thins fill, rim and lip together
 *  (to about half the fill and a quarter of the rim) close to the lens, so a near ghost is a faint tinted veil, neither milky fog
 *  nor a hollow outline. uDim dims the one further back where two ghosts
 *  overlap on screen, so they never tangle into one shape. uLens fades all of it evenly, rim
 *  included: sitting on top of the rider (the shared start line) and right at the lens.
 *  `glass` 1 is your own best in gold-white glass: a pale gold inside, lit a little from within,
 *  inside a warm amber rim. The output is premultiplied: alpha is how much of the scene a ghost covers. */
export function makeGhostMaterial(color: Color, glass = 0): ShaderMaterial {
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    premultipliedAlpha: true,
    uniforms: {
      uColor: { value: color.clone() },
      uTime: shared.uTime,
      uFade: { value: 1 },
      uBody: { value: 1 },
      uLens: { value: 1 },
      uNear: { value: 1 },
      uDim: { value: 1 },
      uMood: { value: 0 },
      uFog: shared.uFog,
      uFogNear: shared.uFogNear,
      uFogFar: shared.uFogFar,
      uSunDir: shared.uSunDir,
      uSnowLit: shared.uSnowLit,
      uGlow: { value: 1 },
      uGlass: { value: glass },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vWorldPos;
      varying float vH;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vH = position.y;
        // Same expression as the depth prepass, so the front surface always passes LEQUAL.
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uFade;
      uniform float uBody;
      uniform float uLens;
      uniform float uNear;
      uniform float uDim;
      uniform float uMood;
      uniform float uGlow;
      uniform float uGlass;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec3 uSunDir;
      uniform vec3 uSnowLit;
      varying vec3 vN;
      varying vec3 vWorldPos;
      varying float vH;
      ${GHOST_MOOD_GLSL}
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float fres = 1.0 - abs(dot(n, v));
        float day = ghostDay(uSnowLit);
        float blaze = ghostBlaze(uGlow);
        // Whiteout, night and dusk: a ghost is a light, so one riding ahead never drops out of view.
        float glowK = max(blaze, uMood);
        float d = length(cameraPosition - vWorldPos);
        // Far ghosts are only a few pixels tall: widen the rim and fill the body so they stay solid.
        float farK = smoothstep(14.0, 45.0, d);
        // A crisp fresnel edge round a tinted core, so two ghosts overlapping on screen read as two
        // glass bodies (the one behind shows its edge through the one in front) instead of one milky
        // blob.
        float band = smoothstep(0.58 - 0.18 * farK, 0.88 - 0.3 * farK, fres);
        float lip = smoothstep(0.78, 0.97, fres);
        // Solid glass at the head and shoulders, dissolving from the chest down into the wisp; as the
        // ghost grows on screen or nears the lens the dissolve climbs toward the shoulders.
        float rise = ghostRise(vH, farK, 1.0 - min(uBody, uNear));
        // By day a darker band just inside the rim holds the silhouette against bright snow and sky.
        float inner = smoothstep(0.3, 0.56, fres) * (1.0 - band) * day;
        vec3 kc = ghostSat(uColor);
        // A power of the linear colour deepens it: mint to teal, gold to amber, rose to crimson.
        vec3 deep = kc * kc * 0.38;
        vec3 mid = kc * 0.66;
        float sunK = 0.5 + 0.5 * dot(n, uSunDir);
        // Light gathers in the head and shoulders like a lantern glass, deep teal where it dissolves.
        float up = smoothstep(0.3, 1.35, vH);
        vec3 face = mix(deep, mid, up * mix(1.0, 0.65 + 0.35 * sunK, day));
        // The grade and tone curve pull a mid-value fill toward grey-green; push it back to the hue.
        face = max(mix(vec3(dot(face, vec3(0.2126, 0.7152, 0.0722))), face, 1.3), vec3(0.0));
        // At night the body is its own light; in a whiteout it lifts so the hue reads through the grey.
        face *= mix(1.45, 1.0 + 0.3 * blaze, day) * (1.0 + 0.4 * uMood);
        // Gold-white glass: amber low down rising to a pale gold at the head, still gold (a white mix
        // read as a cream ghost), a little brighter at night where it is its own light.
        face = mix(face, mix(mix(kc * kc * 0.5, kc * 0.9, up), vec3(1.0), 0.12) * mix(1.25, 1.0, day), uGlass);
        // Thinned near the lens over bright snow, a mid-value fill only greyed the snow (a pale
        // grey-green veil read as milk): there the glass turns to the purest kind colour, so even a
        // thin veil tints what is behind it like coloured glass.
        // The same holds for every fade (the lens, a pass beat, one riding at your side): over a
        // sunset a thinned mid-value fill took on the sky's peach. The thinner the glass, the deeper
        // and purer its tint, so a faint ghost colours what is behind it like stained glass.
        float thin = 1.0 - min(uLens, uNear);
        face = mix(face, ghostSat(ghostSat(kc)) * mix(0.92, 0.62, thin), thin * 0.8 * day);
        face = mix(face, deep * 0.85, inner * 0.5);
        // A crashing ghost drops its body first and keeps its rim, in a deeper, saturated tone by day.
        float faint = 1.0 - uFade;
        vec3 rim = mix(kc * mix(1.3, 1.08, day), kc * 0.78, faint * day);
        // The gold glass's edge runs warm (toward amber) by day, so it reads as gold, not lemon.
        rim = mix(rim, kc * vec3(1.0, 0.82, 0.55) * mix(1.25, 1.0, day), uGlass);
        // The outer lip: a brighter line in the kind colour, only a breath of white in it (a near-white
        // lip read as chalk outlines on bright snow). Glowing it runs hot, so the bloom wraps each
        // ghost in a mint halo instead of a white one.
        vec3 lipCol = mix(kc, vec3(1.0), 0.12 * (1.0 - glowK)) * (1.25 + 2.4 * blaze + 0.9 * uMood);
        // The lip dims with the dissolve too: a blazing edge on every sled slat drew a neon wireframe.
        // Near the lens the lip goes with the rest, or a passing ghost hangs in the sky as a bright
        // wireframe bubble.
        rim = mix(rim, lipCol * mix(0.35, 1.0, rise), lip * mix(0.6, 0.9, glowK) * mix(0.3, 1.0, uNear) * mix(0.6, 1.0, uBody));
        // Spectral shimmer: soft bright bands drift up the body, over a gentle 6 Hz flicker.
        float wave = sin(vWorldPos.y * 9.0 - uTime * 4.5);
        float shimmer = 0.92 + 0.08 * wave;
        float flicker = 0.95 + 0.05 * sin(uTime * 37.7 + vWorldPos.y * 5.0);
        vec3 col = mix(face, rim, max(band, smoothstep(0.55, 1.0, wave) * 0.18));
        // A glassy glint where the sun catches the body.
        float glint = pow(max(dot(reflect(-v, n), uSunDir), 0.0), 18.0);
        col += kc * glint * 0.5 * day;
        // The core: tinted glass you can see the snow (and another ghost's edge) through, densest
        // toward its rim and on the inner edge band, at least about a third of the scene covered by
        // day; glassier at night, where it glows instead. It never hollows: a ghost growing on screen
        // keeps 75% of its fill and loses its lower body instead; only near the lens does it thin hard.
        float fill = mix(mix(0.48, 0.66, day), mix(0.44, 0.6, day), uGlass);
        float body = fill * mix(0.8, 1.0, smoothstep(0.05, 0.45, fres)) * (1.0 + 0.3 * inner) * shimmer * mix(0.75, 1.0, uBody) * mix(0.45, 1.0, uNear) * uFade * uFade * rise;
        // The rim dissolves with the body, keeping only a trace of the sled (the lower body writes no
        // depth, so each slat would draw its own outline); near the lens it thins as hard as the fill
        // (holding half, it left passing ghosts as hollow outline bubbles hanging in the sky).
        // A big ghost's rim thins with its fill too, keeping a small ghost's balance of edge to glass.
        float rimA = pow(uFade, 0.7) * mix(0.03, 1.0, rise) * mix(0.22, 1.0, uNear) * mix(0.6, 1.0, uBody);
        // The one further back of an overlapping pair keeps its tint but sinks into shadow: its rim
        // fades most and its glass darkens (thinned evenly it read as a grey ghost behind a mint one).
        float a = mix(body * mix(0.8, 1.0, uDim), rimA * uDim, max(band, farK * 0.6)) * flicker;
        col *= mix(0.62, 1.0, uDim);
        // Glowing ghosts all but ignore the fog: they are what guides you through the white or the dark.
        float fogF = smoothstep(uFogNear, uFogFar * 1.4, d) * (1.0 - 0.92 * glowK);
        // Distance thins a ghost rather than tinting it: half the sunset fog's peach read as a milky ghost.
        col = mix(col, uFog, fogF * 0.2);
        // Only a surface right at the lens dissolves: the ghost layer already fades one that would
        // fill the screen, and a wider fade here thinned ghosts riding beside you to hairlines.
        a *= (1.0 - fogF * 0.6) * smoothstep(0.5, 1.6, d) * uLens;
        // Additive core: night ghosts emit light of their own, the gold glass a little by day too, and
        // in the glowing moods every ghost does. Kept low by day: added over bright snow it bleached
        // the glass toward cream.
        vec3 core = kc * ((1.0 - day) * 0.2 + uGlass * uFade * mix(0.4, 0.12, day) + 0.35 * uMood) * (1.0 - 0.6 * band) * a;
        // At night the glass covers a little less and glows instead, but still more than half, so a
        // ghost over a lit patch (the lantern's pool) stays its own colour rather than a pale blend.
        float cover = a * mix(0.72, 1.0, day);
        vec3 c = linearToOutputTexel(vec4(col, 1.0)).rgb * a + linearToOutputTexel(vec4(core, 1.0)).rgb;
        gl_FragColor = vec4(c, cover);
      }
    `,
  });
  ghostStencil(m);
  return m;
}
