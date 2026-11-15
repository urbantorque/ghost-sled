import { AddEquation, BufferAttribute, BufferGeometry, Color, CustomBlending, LatheGeometry, Matrix4, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, Vector2, Vector4 } from 'three';
import { LIGHT_GLSL, shared } from './materials';

// Spirit lights, the course's fuel (round 7, the shared lane). The review loop's critics put the old ones first
// among every mountain's faults: flat marigold polygons, as big as the rider near the lens, hanging in the sky like
// stickers. A light is now a small flame of light that belongs to the frame it is in:
//
// - The flame: a smooth teardrop that licks at its tip, brightest where it faces the lens and deeper amber at its
//   rim (a form lit from inside, ART.md 14), with a pale hot heart low in it; its side toward the frame's light a
//   touch brighter and its far side a step deeper, so the frame's light is on it as it is on everything else. It
//   writes depth like any prop.
// - Its glow: a soft camera-facing halo round each flame, premultiplied, so it tints what is behind it by day (paint
//   on sunlit snow) and adds light at night. On Low, which has no bloom, the halo is the glow. A great light's thin
//   ring at its waist and the second small flame it carries are drawn in its glow, as light. Past the detail range
//   a light keeps a glow a few pixels across, so a line far down the run reads as points of warm light.
// - Never big: a flame stands at most about a twentieth of the frame's height (a great light half as tall again),
//   so one met at the lens or beside the rider is a small flame, not a slab; it shrinks away inside 6 m of the lens,
//   off the sight line to the rider and, after a perfect landing, from round the rider (as the old ones did); and
//   one near the lens that is out of reach (high in the frame over a kicker passed under, or out at the frame's side
//   being passed) goes before it can hang in the sky or be dragged into a smear by the speed streak.
// - In the air: the lights over a leap's flight and a kicker's high line hang where the sim put them, and the glow
//   batch threads a few small motes between neighbours of the same arc (props.ts), so they read as a trail of light
//   over the leap rather than a drop stuck in the sky.
//
// Two draws for every light on the course, as before (the sparks' and the great lights' batches became one flame
// batch and one glow batch). A great light is pushed mirrored in x, the one flag the flame batch carries, and its
// shader undoes the mirror. Colours: marigold, the lantern's (ART.md 1), deepening to amber at the rim and burning
// toward white-gold at the heart.

const MARIGOLD = new Color('#FFD34D');
const AMBER = new Color('#FF9E1A');
const WHITE_GOLD = new Color('#FFF3C4');

/** A great light's size against a spark's (they were drawn at 2.5 and 1.7). */
export const GREAT_SCALE = 1.47;
/** A spark's flame in metres: its foot 0.32 m under the light's point, its tip 0.58 m over it. */
const FLAME_H = 0.9;
const FLAME_FOOT = -0.32;
/** The tallest a spark stands on screen, as a share of the frame's height (a great light GREAT_SCALE times it). */
const CAP = 0.052;
/** Metres from the lens: gone at the first, whole from the second. */
const LENS: [number, number] = [3.4, 6.0];
/** What a glow instance is (its z column): a spark's, a great light's, or a mote of a trail in the air. */
const SPARK = 1;
const GREAT = 2;
const MOTE = -1;
/** Added to a light's kind past the detail range. */
const FAR = 2;

/** Kept small, gone near the lens, off the sight line to the rider, out of the rider's outline (and from round it
 *  after a perfect landing), and out of the results' frame edge: what a flame and its glow have left of their size.
 *  `gc` is the light's point in the world, `sc` its scale, `great` 1 for a great light. */
const KEEP_GLSL = /* glsl */ `
  uniform vec3 uFocus;
  uniform float uFocusClear;
  uniform float uResults;
  uniform vec4 uSpirit;
  float spiritKeep(vec3 gc, float sc, float great) {
    float keep = smoothstep(uSpirit.y, uSpirit.z, distance(gc, cameraPosition));
    // Off the sight line from the lens to the rider.
    vec3 seg = uFocus - cameraPosition;
    float segL = length(seg);
    vec3 segD = seg / max(segL, 0.001);
    float along = dot(gc - cameraPosition, segD);
    float off = length(gc - (cameraPosition + segD * along));
    if (along > 0.0 && along < segL - 1.2) keep = min(keep, smoothstep(0.8, 2.0, off));
    // Never in the rider's outline, where a light reads as a backpack or a hat; right after a perfect landing
    // (uFocusClear) every light within about 3 m goes too.
    float gd = distance(gc, uFocus);
    float crowd = smoothstep(mix(1.0, 2.4, uFocusClear), mix(1.7, 3.4, uFocusClear), gd);
    vec4 rv = viewMatrix * vec4(uFocus, 1.0);
    vec4 gv = viewMatrix * vec4(gc, 1.0);
    if (rv.z < -0.5 && gv.z < -0.3) {
      vec2 reach = vec2(0.85, 1.0) / -rv.z + 0.42 * sc / -gv.z;
      float ov = length((gv.xy / -gv.z - rv.xy / -rv.z) / reach);
      crowd = min(crowd, mix(1.0, smoothstep(1.0, 1.3, ov), 1.0 - smoothstep(7.0, 12.0, gd)));
    }
    keep = min(keep, crowd);
    vec4 cg = projectionMatrix * gv;
    // One hanging near the lens high in the frame (over a kicker the rider is passing under) is out of its reach
    // and up in the sky: it goes as it climbs into the top fifth, where a light near the lens read as a drop
    // stuck in the sky. One the rider flies toward rides lower in the frame, with the rider.
    if (cg.w > 0.1) keep *= 1.0 - smoothstep(0.6, 0.86, cg.y / cg.w) * (1.0 - smoothstep(10.0, 20.0, -gv.z));
    // One near the lens out at the frame's side is being passed, out of reach: it goes before the speed streak at
    // the frame's edges can drag it into a smear.
    if (cg.w > 0.1) keep *= 1.0 - smoothstep(0.55, 0.85, abs(cg.x / cg.w)) * (1.0 - smoothstep(8.0, 14.0, -gv.z));
    // While the results are up, a light the frame's edge would cut shrinks away.
    if (uResults > 0.0) {
      if (cg.w > 0.1) {
        vec2 e = abs(cg.xy / cg.w) + vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * 0.5 * sc / cg.w;
        keep = min(keep, mix(1.0, smoothstep(1.0, 0.92, max(e.x, e.y)), uResults));
      }
    }
    // Never more than a small flame on screen: at most uSpirit.x of the frame's height (of 1.6 widths on a screen
    // held upright), however near it comes.
    float tall = ${FLAME_H.toFixed(2)} * sc * projectionMatrix[1][1] / (2.0 * max(-gv.z, 0.05));
    float cap = uSpirit.x * mix(1.0, ${GREAT_SCALE.toFixed(2)}, great) * min(1.0, 1.6 * projectionMatrix[1][1] / projectionMatrix[0][0]);
    return keep * min(1.0, cap / max(tall, 1e-4));
  }
`;

/** One uniform for both materials: x the cap, yz the lens's fade (gone, whole). */
const spiritU = { value: new Vector4(CAP, LENS[0], LENS[1], 0) };

/** A flame's outline from its foot (y 0) to its tip (y 1), as (radius, height) in flame heights: a full belly
 *  low down, drawn out to a point. */
const FLAME: Array<[number, number]> = [
  [0, 0],
  [0.13, 0.035],
  [0.215, 0.11],
  [0.26, 0.22],
  [0.25, 0.34],
  [0.21, 0.47],
  [0.155, 0.6],
  [0.095, 0.74],
  [0.045, 0.87],
  [0, 1],
];

let flameGeo: BufferGeometry | null = null;
let glowGeo: BufferGeometry | null = null;

/** The flame batch's geometry: one smooth teardrop (aH its height, 0 at the foot to 1 at the tip). 180 triangles,
 *  as the spark's skin and core were. */
export function spiritFlameGeometry(): BufferGeometry {
  if (flameGeo) return flameGeo;
  const g = new LatheGeometry(
    FLAME.map(([r, y]) => new Vector2(r * FLAME_H, FLAME_FOOT + y * FLAME_H)),
    10,
  );
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position');
  const hs = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) hs[i] = Math.max(0, Math.min(1, (pos.getY(i) - FLAME_FOOT) / FLAME_H));
  g.setAttribute('aH', new BufferAttribute(hs, 1));
  g.computeBoundingSphere();
  flameGeo = g;
  return g;
}

/** The glow batch's geometry: one quad, turned to the lens and sized in the vertex shader. */
export function spiritGlowGeometry(): BufferGeometry {
  if (glowGeo) return glowGeo;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  glowGeo = g;
  return g;
}

/** The flame: lit by the frame's light and from inside, opaque, written to depth. */
export function spiritFlameMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...shared,
      uSpirit: spiritU,
      uMarigold: { value: MARIGOLD.clone() },
      uAmber: { value: AMBER.clone() },
      uWhiteGold: { value: WHITE_GOLD.clone() },
    },
    vertexShader: /* glsl */ `
      attribute float aH;
      uniform float uTime;
      ${KEEP_GLSL}
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vH;
      varying float vPhase;
      void main() {
        mat4 im = instanceMatrix;
        // A great light is pushed mirrored in x (props.ts): undone here, it is the batch's one flag.
        float great = step(dot(cross(im[0].xyz, im[1].xyz), im[2].xyz), 0.0);
        im[0].xyz *= 1.0 - 2.0 * great;
        vec3 ip = im[3].xyz;
        float phase = ip.x * 0.37 + ip.z * 0.21;
        vPhase = phase;
        vH = aH;
        vec3 p = position;
        vec3 nrm = normal;
        float t = uTime;
        // The flame licks: its upper half sways and breathes, its foot holds. It bobs as the old lights did.
        float lk = aH * aH;
        p.x += (0.6 * sin(t * 6.1 + phase * 5.0) + 0.4 * sin(t * 9.7 + phase * 2.0)) * 0.05 * lk;
        p.z += (0.6 * cos(t * 5.3 + phase * 3.0) + 0.4 * sin(t * 11.3 + phase)) * 0.04 * lk;
        p.y += (p.y - (${FLAME_FOOT.toFixed(2)})) * 0.06 * sin(t * 8.0 + phase * 7.0) * aH;
        p.y += sin(t * 3.0 + phase * 5.0) * 0.12;
        float sc = length(im[1].xyz);
        vec3 gc = (modelMatrix * vec4(ip, 1.0)).xyz;
        p *= spiritKeep(gc, sc, great);
        vec4 wp = modelMatrix * im * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * mat3(im) * nrm);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      ${LIGHT_GLSL}
      uniform float uDayK;
      uniform float uGiftGlow;
      uniform vec3 uMarigold;
      uniform vec3 uAmber;
      uniform vec3 uWhiteGold;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      varying float vH;
      varying float vPhase;
      void main() {
        vec3 n = normalize(vNormalW);
        vec3 v = normalize(cameraPosition - vWorldPos);
        float face = clamp(dot(n, v), 0.0, 1.0);
        // Lit from inside: marigold where it faces the lens, deep amber at its rim, a pale hot heart low in it,
        // and its tip a step deeper again.
        vec3 col = mix(uAmber, uMarigold, smoothstep(0.08, 0.62, face));
        float heart = smoothstep(0.5, 0.95, face) * (1.0 - smoothstep(0.2, 0.75, vH));
        col = mix(col, uWhiteGold * 1.18, heart * 0.85);
        col = mix(col, uAmber * 0.92, smoothstep(0.62, 1.0, vH) * (1.0 - heart) * 0.55);
        // The frame's light on it: its side toward the light a touch brighter, with a rim of the light's own
        // colour on that edge, its far side a step deeper (still warm: it is a light, never shaded grey).
        float key = smoothstep(-0.25, 0.75, dot(n, uSunDir));
        col *= mix(0.8, 1.04, key);
        col += uRim * pow(1.0 - face, 2.5) * key * 0.22;
        // By night it is the light in the frame; by day paint with a glow.
        col *= mix(1.3, 1.0, uDayK);
        // It flickers, gently.
        col *= 0.95 + 0.05 * sin(uTime * 13.0 + vPhase * 7.0) * sin(uTime * 7.3 + vPhase * 3.1);
        // Low visibility (Blizzard): it burns brighter and the fog takes less of it, as the old lights did.
        col *= 1.0 + 0.35 * uGiftGlow;
        // A light holds through the fog better than paint does.
        col = mix(fogged(col, vWorldPos), col, 0.5 + 0.4 * uGiftGlow);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

/** The glow round each flame (with a great light's ring and second flame), and the motes of a trail in the air:
 *  premultiplied, depth tested, and pulled toward the lens by its own radius so the snow under a flame never cuts
 *  it. */
export function spiritGlowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    uniforms: {
      ...shared,
      uSpirit: spiritU,
      uMarigold: { value: MARIGOLD.clone() },
      uWhiteGold: { value: WHITE_GOLD.clone() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uFogNear;
      uniform float uFogFar;
      ${KEEP_GLSL}
      varying vec2 vU;
      varying float vFade;
      varying float vKind;
      varying float vRing;
      varying float vSway;
      varying float vFar;
      void main() {
        // The instance carries the light's point, its scale (x) and what it is (z: a spark, a great light, either
        // past the detail range, or a mote).
        mat4 im = instanceMatrix;
        float sc = abs(im[0].x);
        float far = step(2.5, im[2].z);
        float kind = im[2].z - 2.0 * far;
        float mote = step(kind, 0.0);
        float great = step(1.5, kind);
        vFar = far;
        vec3 ip = im[3].xyz;
        float phase = ip.x * 0.37 + ip.z * 0.21;
        vec3 gc = (modelMatrix * vec4(ip, 1.0)).xyz;
        float keep = spiritKeep(gc, mote > 0.5 ? 1.0 : sc, great);
        // Centred on the flame's belly as it bobs; a mote breathes where it hangs.
        vec3 c = gc + vec3(0.0, (0.13 + 0.12 * sin(uTime * 3.0 + phase * 5.0)) * sc * (1.0 - mote), 0.0);
        vec4 vc = viewMatrix * vec4(c, 1.0);
        float d = max(-vc.z, 0.1);
        // The quad's half-width in the light's own units, then in metres.
        float span = mote > 0.5 ? 0.3 * (0.85 + 0.15 * sin(uTime * 4.0 + phase * 9.0)) : 0.62;
        float r = span * sc * keep;
        // Far off it never goes under a few pixels, so a line down the run reads as warm points of light.
        float px = d / projectionMatrix[1][1];
        r = max(r, (mote > 0.5 ? 0.005 : 0.009) * px * step(0.02, keep));
        vU = position.xy * span;
        vKind = kind;
        // How flat a ring lying level looks from here (the sine of the sight line's slope).
        vRing = max(abs(normalize(c - cameraPosition).y), 0.1);
        vSway = sin(uTime * 1.7 + phase * 4.0);
        vFade = keep > 0.0 ? (1.0 - 0.6 * smoothstep(uFogNear, uFogFar * 1.4, d)) : 0.0;
        // (Pulled toward the lens by its radius: the snow right under a flame never cuts its glow.)
        vc.xyz *= max(0.1, (d - r) / d);
        vc.xy += position.xy * r;
        gl_Position = projectionMatrix * vc;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uMarigold;
      uniform vec3 uWhiteGold;
      uniform float uDayK;
      uniform float uGiftGlow;
      varying vec2 vU;
      varying float vFade;
      varying float vKind;
      varying float vRing;
      varying float vSway;
      varying float vFar;
      void main() {
        if (vFade <= 0.0) discard;
        vec2 u = vU;
        float mote = step(vKind, 0.0);
        float great = step(1.5, vKind);
        // In the light's own units (a spark's flame is 0.9 tall): a soft glow with a warm heart round a flame,
        // small and round as a mote.
        float span = mote > 0.5 ? 0.3 : 0.62;
        float r2 = dot(u, u) / (span * span);
        float wide = exp(-r2 * 3.4) * (1.0 - smoothstep(0.55, 1.0, r2));
        float core = exp(-r2 * 14.0);
        float g = mix(wide, core * 1.4 + wide * 0.4, mote);
        float hot = 0.35 * core;
        if (great > 0.5) {
          // A great light: a thin ring of light at its waist, lying level (its far half dimmer where the flame
          // stands in front of it), and a second small flame beside it, swaying a little.
          vec2 q = vec2(u.x, (u.y + 0.2) / vRing);
          float ring = exp(-pow((length(q) - 0.34) / 0.03, 2.0));
          ring *= u.y > -0.2 && abs(u.x) < 0.2 ? 0.4 : 1.0;
          vec2 s = u - vec2(0.37 + 0.03 * vSway, -0.12);
          // A small teardrop: round at its foot, drawn to a point above.
          float sy = clamp((s.y + 0.1) / 0.3, 0.0, 1.0);
          float sw = mix(0.075, 0.0, sy * sy);
          float side = (1.0 - smoothstep(sw * 0.6, sw + 0.02, abs(s.x))) * step(-0.12, s.y) * step(s.y, 0.2);
          side = max(side, 1.0 - smoothstep(0.05, 0.085, length(s - vec2(0.0, -0.06))));
          g += ring * 0.95 + side * 1.1;
          hot += ring * 0.6 + side * 0.5;
        }
        g *= vFade * (1.0 + 0.4 * uGiftGlow);
        vec3 col = mix(uMarigold, uWhiteGold, clamp(hot, 0.0, 1.0)) * mix(0.75, 0.5, uDayK);
        // By day it tints what is behind it toward marigold (light alone is lost on bright snow); at night it is
        // light.
        vec3 rgb = linearToOutputTexel(vec4(col, 1.0)).rgb * g;
        float cover = clamp(g * mix(0.06, 0.32, uDayK), 0.0, 0.6);
        if (vFar > 0.5) {
          // Past the detail range, where no flame is drawn, the flame is painted here, a few pixels tall: round at
          // its foot (a little under the glow's middle) and drawn to a point, with a pale heart.
          vec2 f = u - vec2(0.0, -0.17);
          float hw = 0.19 * pow(clamp(1.0 - f.y / 0.45, 0.0, 1.0), 1.3);
          float taper = (1.0 - smoothstep(hw - 0.025, hw + 0.025, abs(f.x))) * step(0.0, f.y) * step(f.y, 0.45);
          float body = max(taper, 1.0 - smoothstep(0.17, 0.21, length(f))) * vFade;
          float heart = exp(-(f.x * f.x) / 0.008 - (f.y + 0.02) * (f.y + 0.02) / 0.02);
          vec3 bodyC = mix(uMarigold, uWhiteGold * 1.1, heart * 0.8) * mix(1.25, 1.0, uDayK);
          rgb = mix(rgb, linearToOutputTexel(vec4(bodyC, 1.0)).rgb, body);
          cover = mix(cover, 1.0, body);
        }
        gl_FragColor = vec4(rgb, cover);
      }
    `,
  });
}

/** Writes a flame's instance matrix: at (x, y, z) in three.js space, turned `yaw`, `k` its own scale; a great
 *  light half as big again and mirrored in x (its flag). */
export function flameMatrix(m: Matrix4, x: number, y: number, z: number, yaw: number, k: number, great: boolean): Matrix4 {
  const s = great ? k * GREAT_SCALE : k;
  const c = Math.cos(yaw) * s;
  const sn = Math.sin(yaw) * s;
  const f = great ? -1 : 1;
  // (A turn about y, scaled; Matrix4.set takes rows.)
  return m.set(c * f, 0, sn, x, 0, s, 0, y, -sn * f, 0, c, z, 0, 0, 0, 1);
}

/** Writes a glow's instance matrix: the light's point, its scale (a great light's included) and what it is; `far`
 *  past the detail range, where the glow paints the flame itself. */
export function glowMatrix(m: Matrix4, x: number, y: number, z: number, k: number, kind: 'spark' | 'great' | 'mote', far = false): Matrix4 {
  const s = kind === 'great' ? k * GREAT_SCALE : k;
  const id = kind === 'great' ? GREAT : kind === 'mote' ? MOTE : SPARK;
  return m.set(s, 0, 0, x, 0, 1, 0, y, 0, 0, id + (far && kind !== 'mote' ? FAR : 0), z, 0, 0, 0, 1);
}

/** The motes between two neighbouring lights of one arc in the air, by the gap between them (metres). */
export function airMotes(gap: number): number {
  return Math.max(0, Math.min(4, Math.round(gap / 2.4) - 1));
}
