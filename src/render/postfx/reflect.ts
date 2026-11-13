import { Matrix4, type Texture, Vector4 } from 'three';

// What glazed ice mirrors (ART.md 4 and 15: ice holds the sky, the aurora and the riders). Round 6 gave
// the frozen lake a baked sky and a figure of the rider; every other glaze (an ice patch, Glass Ice, the
// fork's strip) mirrored a painted gradient. Round 7, by tier (tiers.ts `mirror`):
//
//  - 'sky' (Low): as round 6.
//  - 'bake' (Medium, High): the lake's baked sky and peaks on every glaze (lakemirror.ts bakes it on any
//    mountain now, a small target every few seconds), and the rider's figure standing in it. No pass, no
//    draw: a texture read on ice pixels only.
//  - 'screen' (Ultra): the frame itself. The snow shader marches the mirrored ray through last frame's
//    depth and reads last frame's picture where it lands, so trees, towers, lamps, the rider and the
//    ghosts stand in the ice, and a ray that leaves for the sky reads the real sky there (the aurora).
//    Last frame's targets are the scene target's own resolved textures: under MSAA the scene is drawn
//    into renderbuffers, so reading the resolve while drawing is no feedback loop, and it costs no copy.
//    The march runs on ice pixels only (it sits inside the shader's ice branch).
//
// The GLSL is spliced into the snow shader (materials.ts) after its own uniforms; that file adds one
// call. It reads uLakeSky, uLakeMap and uFocus, which the snow shader already declares.

export const iceMirror = {
  /** x the mode (0 sky, 1 bake, 2 screen), y 1 once last frame's targets exist, z near, w far. */
  uIceMirror: { value: new Vector4(0, 0, 0.3, 5200) },
  tMirrorColor: { value: null as Texture | null },
  tMirrorDepth: { value: null as Texture | null },
  /** World space to last frame's clip space. */
  uMirrorVP: { value: new Matrix4() },
};

export const ICE_MIRROR_GLSL = /* glsl */ `
  uniform vec4 uIceMirror;
  uniform sampler2D tMirrorColor;
  uniform sampler2D tMirrorDepth;
  uniform mat4 uMirrorVP;
  float mirrorLin(float d) { return uIceMirror.z * uIceMirror.w / (uIceMirror.w - d * (uIceMirror.w - uIceMirror.z)); }
  // The mirrored colour for a ray rr leaving the ice at wp: sky is what round 6 would show (the painted
  // gradient, and on a lake the bake and its banks), lakeK how much of a lake this is.
  vec3 iceMirror(vec3 sky, vec3 wp, vec3 rr, float lakeK) {
    if (uIceMirror.x < 0.5) return sky;
    // The baked sky and peaks, on every glaze (the lake has laid its own on already).
    if (uLakeMap.z > 0.0 && rr.z < -0.02 && lakeK < 1.0) {
      vec2 buv = vec2(rr.x / -rr.z / uLakeMap.x * 0.5 + 0.5, rr.y / -rr.z / uLakeMap.y);
      // (A glaze on a slope sends its grazing rays under the horizon, where the bake has nothing: it
      // fades out toward its foot so the painted gradient takes over without an edge, and it is held a
      // little under the lake's, which is the one true mirror.)
      if (buv.y < 1.0 && buv.y > 0.0) sky = mix(sky, textureLod(uLakeSky, clamp(buv, vec2(0.002), vec2(0.998)), 0.0).rgb, 0.8 * uLakeMap.z * smoothstep(0.0, 0.1, 1.0 - buv.y) * smoothstep(0.0, 0.09, buv.y) * (1.0 - lakeK));
    }
    if (uIceMirror.x < 1.5 || uIceMirror.y < 0.5) {
      // The rider standing in the glaze (off the lake, which draws its own): the ray against a soft
      // upright figure at the rider, as the lake's.
      vec3 tf = uFocus - wp;
      if (lakeK < 0.5 && dot(tf.xz, tf.xz) < 90.0) {
        vec2 rh = normalize(rr.xz + vec2(0.0001, 0.0));
        float along = dot(tf.xz, rh);
        float miss = abs(tf.x * rh.y - tf.z * rh.x);
        float hb = along * rr.y / max(length(rr.xz), 0.05) - (tf.y - 0.9);
        float wide = mix(0.46, 0.3, smoothstep(0.16, 0.3, hb)) * mix(1.0, 0.7, smoothstep(0.6, 1.0, hb));
        float fig = (1.0 - smoothstep(wide * 0.55, wide * 1.2, miss)) * smoothstep(-0.08, 0.06, hb) * (1.0 - smoothstep(1.08, 1.32, hb)) * step(0.0, along);
        vec3 figC = mix(vec3(0.42, 0.16, 0.07), vec3(0.018, 0.028, 0.075), smoothstep(0.14, 0.26, hb));
        figC = mix(figC, vec3(0.62, 0.06, 0.03), smoothstep(0.76, 0.84, hb) * (1.0 - smoothstep(0.9, 0.98, hb)));
        sky = mix(sky, figC, fig * 0.6);
      }
      return sky;
    }
    // The frame itself: twenty-four growing steps along the ray (a hand's width at first, so the sled
    // and the rider a metre off are not stepped over; a hundred metres in all), each asked whether it
    // has passed behind what last frame saw there. A step that has is halved back five times to the
    // crossing. If the depth there is the ray's own, the ray met a surface: a hit. If it is not, the
    // ray went behind something's outline and met nothing: it marches on. (A test on thickness alone
    // smears whatever floats, a gift, a lamp, down the ice, and with a jittered start it stipples.)
    float stepLen = 0.12;
    float t = 0.26;
    float tPrev = 0.1;
    bool front = true;
    vec2 hitUv = vec2(-1.0);
    float edge = 1.0;
    for (int i = 0; i < 24; i++) {
      vec4 c = uMirrorVP * vec4(wp + rr * t, 1.0);
      if (c.w <= 0.05) break;
      vec2 uv = c.xy / c.w * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
      float raw = textureLod(tMirrorDepth, uv, 0.0).r;
      bool behind = raw < 1.0 && c.w > mirrorLin(raw);
      if (behind && front) {
        float lo = tPrev;
        float hi = t;
        vec2 at = uv;
        float gap = c.w - mirrorLin(raw);
        for (int k = 0; k < 5; k++) {
          float mid = 0.5 * (lo + hi);
          vec4 cm = uMirrorVP * vec4(wp + rr * mid, 1.0);
          vec2 um = cm.xy / max(cm.w, 0.05) * 0.5 + 0.5;
          float rm = textureLod(tMirrorDepth, um, 0.0).r;
          float gm = cm.w - mirrorLin(rm);
          if (rm < 1.0 && gm > 0.0) { hi = mid; at = um; gap = gm; } else lo = mid;
        }
        if (gap < 0.12 + 0.06 * stepLen + 0.012 * c.w) {
          hitUv = at;
          break;
        }
      }
      front = !behind;
      tPrev = t;
      t += stepLen;
      stepLen *= 1.25;
    }
    if (hitUv.x < 0.0) {
      // Nothing in the way: the ray's own direction on last frame's screen, if the sky is there.
      vec4 c = uMirrorVP * vec4(rr, 0.0);
      if (c.w > 0.0) {
        vec2 uv = c.xy / c.w * 0.5 + 0.5;
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 && textureLod(tMirrorDepth, uv, 0.0).r >= 1.0) hitUv = uv;
      }
    }
    if (hitUv.x >= 0.0) {
      vec2 e = min(hitUv, 1.0 - hitUv);
      edge = smoothstep(0.0, 0.06, min(e.x, e.y));
      // (A reflection is never brighter than lit snow: a lamp in the ice glows, it does not burn.)
      vec3 got = min(textureLod(tMirrorColor, hitUv, 0.0).rgb, vec3(1.6));
      sky = mix(sky, got, edge * 0.9);
    }
    return sky;
  }
`;

/** Points the mirror at last frame's picture and depth (null: no screen mirror this frame). */
export function aimIceMirror(mode: 0 | 1 | 2, color: Texture | null, depth: Texture | null, lastVP: Matrix4, near: number, far: number): void {
  const u = iceMirror;
  const ready = mode === 2 && color !== null && depth !== null;
  u.uIceMirror.value.set(mode, ready ? 1 : 0, near, far);
  u.tMirrorColor.value = ready ? color : null;
  u.tMirrorDepth.value = ready ? depth : null;
  u.uMirrorVP.value.copy(lastVP);
}
