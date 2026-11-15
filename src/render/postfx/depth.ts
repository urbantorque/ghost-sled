import { Matrix4, type PerspectiveCamera, type Texture, Vector2, Vector3, Vector4 } from 'three';

// The frame's depth, shared by every pass that reads it: one set of uniforms (by reference, as
// materials.ts shares the light) and one block of GLSL to turn a depth sample into metres from the lens,
// a view-space position, or a compact key for depth-aware filters.
//
// Where it comes from: the scene target carries a 24-bit depth and 8-bit stencil texture (post.ts).
// Under MSAA the renderer resolves the depth with the colour at the end of the scene pass (sample 0, a
// GPU blit; the stencil is never resolved, which is the slow one on D3D). Without MSAA the texture is
// the attachment itself and costs nothing. Glass ghosts, particles, the sky dome and every other
// material that does not write depth are not in it: a pass sees the opaque world behind them. The sky
// reads as exactly 1.

export const depthUniforms = {
  tDepth: { value: null as Texture | null },
  /** x near, y far, z 1 / log2(far + 1) (the depth key's scale), w 1 when a depth texture is bound. */
  uDepthNF: { value: new Vector4(0.3, 5200, 1 / Math.log2(5201), 0) },
  /** View-space x and y from ndc at one metre: xy the scale (1 / P00, 1 / P11), zw the offset an
   *  off-centre projection adds. */
  uProj: { value: new Vector4(1, 1, 0, 0) },
  /** The projection's own scale (P00, P11): metres at depth 1 to half a frame. */
  uProjScale: { value: new Vector2(1, 1) },
  /** The depth texture's texel. */
  uDepthTexel: { value: new Vector2(1, 1) },
  /** View space to last frame's clip space: where a point of this frame was on screen a frame ago. */
  uReproject: { value: new Matrix4() },
  /** View space to world space (the camera's own matrix). */
  uViewToWorld: { value: new Matrix4() },
};

export const DEPTH_GLSL = /* glsl */ `
  uniform sampler2D tDepth;
  uniform vec4 uDepthNF;
  uniform vec4 uProj;
  uniform vec2 uProjScale;
  uniform vec2 uDepthTexel;
  // Metres from the lens along its axis, from a depth sample.
  float linDepth(float d) { return uDepthNF.x * uDepthNF.y / (uDepthNF.y - d * (uDepthNF.y - uDepthNF.x)); }
  // (Read at the base level, which is all a depth target has: an implicit-gradient read inside a march that
  // can stop early is a compile warning on Direct3D, X3595, printed on the console the first time it builds.)
  float depthAt(vec2 uv) { return linDepth(texture2DLodEXT(tDepth, uv, 0.0).r); }
  // The view-space point seen at uv, lin metres out (the lens looks down -z).
  vec3 viewPos(vec2 uv, float lin) { return vec3(((uv * 2.0 - 1.0) * uProj.xy + uProj.zw) * lin, -lin); }
  // Where a view-space point lands on screen.
  vec2 viewToUv(vec3 p) { return ((p.xy / -p.z) - uProj.zw) / uProj.xy * 0.5 + 0.5; }
  // A depth key in 0..1 whose differences are relative differences in distance (a logarithm), for
  // depth-aware filters; it packs into two bytes.
  float depthKey(float lin) { return clamp(log2(lin + 1.0) * uDepthNF.z, 0.0, 1.0); }
  vec2 packKey(float k) { float v = k * 255.0; float hi = floor(v); return vec2(hi / 255.0, v - hi); }
  float unpackKey(vec2 p) { return p.x + p.y / 255.0; }
`;

const viewProj = new Matrix4();
const prevViewProj = new Matrix4();
const nowViewProj = new Matrix4();
let havePrev = false;
const probe = new Vector3();

/** Points the shared uniforms at this frame's depth and lens. Call once a frame, before any pass. */
export function aimDepth(camera: PerspectiveCamera, depth: Texture | null, w: number, h: number): void {
  const u = depthUniforms;
  const p = camera.projectionMatrix.elements;
  u.tDepth.value = depth;
  u.uDepthNF.value.set(camera.near, camera.far, 1 / Math.log2(camera.far + 1), depth ? 1 : 0);
  u.uProj.value.set(1 / p[0], 1 / p[5], p[8] / p[0], p[9] / p[5]);
  u.uProjScale.value.set(p[0], p[5]);
  u.uDepthTexel.value.set(1 / Math.max(1, w), 1 / Math.max(1, h));
  u.uViewToWorld.value.copy(camera.matrixWorld);
  viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  if (!havePrev) prevViewProj.copy(viewProj);
  u.uReproject.value.multiplyMatrices(prevViewProj, camera.matrixWorld);
}

/** Last frame's world-to-clip matrix (what the ice's mirror marches against: reflect.ts). */
export function lastViewProj(): Matrix4 {
  return prevViewProj;
}

/** Keeps this frame's lens for the next one. Call once a frame, after the passes. */
export function keepLens(): void {
  prevViewProj.copy(viewProj);
  havePrev = true;
}

/** A hard cut (a new run, a revive, a camera snap): nothing reprojects across it. */
export function cutLens(): void {
  havePrev = false;
}

/**
 * The largest screen motion this frame, in pixels of a frame h tall: how far a point a few metres ahead
 * of the lens on the ground moved since last frame. The motion blur is skipped under half a pixel.
 */
export function lensMotionPx(camera: PerspectiveCamera, h: number): number {
  if (!havePrev) return 0;
  // (Asked before the scene is drawn: this frame's matrix is built here, from the lens as it stands.)
  nowViewProj.copy(camera.matrixWorld).invert().premultiply(camera.projectionMatrix);
  let worst = 0;
  // Three points fixed to the lens: low ahead (the near snow), off to each side.
  for (let i = 0; i < 3; i++) {
    probe.set(i === 0 ? 0 : i === 1 ? -4 : 4, -1.5, i === 0 ? -6 : -10).applyMatrix4(camera.matrixWorld);
    const ax = probe.x;
    const ay = probe.y;
    const az = probe.z;
    probe.applyMatrix4(nowViewProj);
    const cx = probe.x;
    const cy = probe.y;
    probe.set(ax, ay, az).applyMatrix4(prevViewProj);
    worst = Math.max(worst, Math.hypot(cx - probe.x, cy - probe.y) * 0.5 * h);
  }
  return worst;
}
