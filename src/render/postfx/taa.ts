import {
  AlwaysDepth,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Quaternion,
  RGBAFormat,
  RGBFormat,
  ShaderMaterial,
  UnsignedInt101111Type,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { shared } from '../materials';
import { AO_COMPOSITE_GLSL, aoComposite } from './ao';
import { DEPTH_GLSL, depthUniforms, lastViewProj, lensKept } from './depth';
import { QUAD_VERT, type Quad } from './quad';
import { jitterAt, jitterPhases } from './tiers';

// The temporal reconstruction (the visual lift, notes/vl-temporal.md). Round 7 drew High at up to twice the
// page's pixel density with 2x MSAA and the edge walk, Ultra with 4x, and thin things still crawled at speed
// (cables, bunting, rails, tree edges, the snow's glitter); its temporal blend (DECISIONS 287) steadied a
// still frame and went soft in motion, because it read the history through a bilinear tap every frame and
// knew only the lens's own motion. This one:
//
//  - draws the scene at part of the frame's size (tiers.ts renderScale), with the lens moved to one of 8 or
//    16 places inside a scene pixel each frame (a Halton set), and no MSAA;
//  - rebuilds the full frame in one pass: this frame's 3x3 scene pixels round each frame pixel, weighed by
//    how near each fell to the pixel's middle; the history read where the pixel's point of the world was a
//    frame ago through a Catmull-Rom filter (five taps, sharp, where a bilinear tap softens a little more
//    every frame); the history held inside the colours this frame has round the pixel (a variance box in
//    YCoCg, tighter as things move, clipped toward its middle); more of this frame the further the history
//    moved, and all of it where last frame's depth says the point was hidden (a disocclusion);
//  - knows the motion of what moves on its own and is large on screen: the rider and the nearest ghosts
//    each carry a box in their sled's frame, and a pixel whose point of the world is inside one is
//    reprojected by that body's own last pose, not the world's (so the rider, who rides with the lens, is
//    not smeared by the world streaming past behind it);
//  - lays the occlusion on this frame before the blend (it was the composite's), so the occlusion is rebuilt
//    with the picture instead of crawling with the lens's moves;
//  - sharpens the rebuilt frame (a contrast-adaptive sharpen in the spirit of RCAS) into the frame the bloom
//    and the composite read, and in the same pass writes the scene's depth at the frame's size, so what the
//    history cannot know (particles, weather, sparks, glows, fireworks: postfx/after.ts) is drawn over it
//    afterwards, sharp, at the frame's size, depth-tested against the world and never kept in the history.
//
// Every pass that reads the scene's depth reads it with the projection it was drawn with (depth.ts
// aimDepth), so a position from depth is where the world is; what is kept for next frame's reprojection is
// the lens without its move.

/** The bodies with motion of their own the rebuild knows each frame (the rider and the nearest ghosts). */
export const BODIES = 6;

const RESOLVE_FRAG = /* glsl */ `
  precision highp float;
  precision highp int;
  ${DEPTH_GLSL}
  ${AO_COMPOSITE_GLSL}
  #define BODIES ${BODIES}
  uniform sampler2D tScene;
  uniform sampler2D tHistory;
  uniform sampler2D tPrevDepth;
  uniform mat4 uReproject;
  // xy where this frame drew the world point a frame pixel shows (its uv plus this, uv), zw last frame's.
  uniform vec4 uJit;
  // xy the scene's size, zw the frame's (pixels).
  uniform vec4 uSize;
  // x the least share of this frame (at rest), y the most (in motion), z 1 once there is a history, w how
  // much a new highlight is let through.
  uniform vec4 uTaaK;
  // x the motion (frame pixels) at which this frame's share reaches its most, y the box's width at rest,
  // z in motion, w 1 when last frame's depth is there to test against.
  uniform vec4 uTaaM;
  // Each body: view space to its box (inside where every axis is within 1), view space to last frame's clip
  // space for a point carried by it, and its box on screen (uv: x0, y0, x1, y1; empty when x0 > x1).
  uniform mat4 uBodyLocal[BODIES];
  uniform mat4 uBodyPrev[BODIES];
  uniform vec4 uBodyRect[BODIES];
  uniform float uTaaView;
  // How far the box is drawn toward the cross's (0: the 3x3's).
  uniform float uTaaR;
  // How quickly a scene pixel's weight falls with its distance from the frame pixel's middle (per frame pixel
  // squared): 2.29 is a Blackman-Harris's width; 4, narrower, kept the trees as crisp as round 7's at speed,
  // where 2.29 laid a half-pixel blur on every frame before it was blended.
  uniform float uTaaKern;
  varying vec2 vUv;

  float top3(vec3 c) { return max(c.r, max(c.g, c.b)); }
  // Blended in a compressed range, so one frame's spark does not own the average.
  vec3 squash(vec3 c) { return c / (1.0 + top3(c)); }
  vec3 unsquash(vec3 c) { return c / max(1.0 - top3(c), 1e-3); }
  vec3 toYC(vec3 c) { return vec3(dot(c, vec3(0.25, 0.5, 0.25)), dot(c, vec3(0.5, 0.0, -0.5)), dot(c, vec3(-0.25, 0.5, -0.25))); }
  vec3 fromYC(vec3 y) { return vec3(y.x + y.y - y.z, y.x + y.z, y.x - y.y - y.z); }

  // The history (kept in the compressed range) through a Catmull-Rom filter, in five bilinear taps (the four
  // corners' weights are small enough to leave out). (In the compressed range its negative lobe beside a
  // bright sky cannot take a dark pennant below black: kept linear, it did, and the clamp left black specks
  // along the bunting that a low share of the new frame held for a dozen frames.)
  vec3 history(vec2 uv) {
    vec2 sz = uSize.zw;
    vec2 pos = uv * sz;
    vec2 c = floor(pos - 0.5) + 0.5;
    vec2 f = pos - c;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 t12 = (c + w2 / w12) / sz;
    vec2 t0 = (c - 1.0) / sz;
    vec2 t3 = (c + 2.0) / sz;
    vec3 r = textureLod(tHistory, vec2(t12.x, t0.y), 0.0).rgb * (w12.x * w0.y)
      + textureLod(tHistory, vec2(t0.x, t12.y), 0.0).rgb * (w0.x * w12.y)
      + textureLod(tHistory, t12, 0.0).rgb * (w12.x * w12.y)
      + textureLod(tHistory, vec2(t3.x, t12.y), 0.0).rgb * (w3.x * w12.y)
      + textureLod(tHistory, vec2(t12.x, t3.y), 0.0).rgb * (w12.x * w3.y);
    float ws = w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y;
    return clamp(r / ws, vec3(0.0), vec3(0.998));
  }

  // Pulls q toward the box's middle until it is inside (a clip, not a clamp per channel, which would shift
  // its hue).
  vec3 clipBox(vec3 q, vec3 lo, vec3 hi) {
    vec3 c = 0.5 * (hi + lo);
    vec3 e = 0.5 * (hi - lo) + 1e-5;
    vec3 v = q - c;
    vec3 a = abs(v / e);
    float m = max(a.x, max(a.y, a.z));
    return m > 1.0 ? c + v / m : q;
  }

  void main() {
    vec2 uv = vUv;
    vec2 uvR = uv + uJit.xy;
    vec2 tp = uvR * uSize.xy - 0.5;
    ivec2 ib = ivec2(floor(tp + 0.5));
    ivec2 lim = ivec2(uSize.xy) - 1;
    float ratio = uSize.z / uSize.x;

    // The nearest depth of the cross round the nearest scene pixel: an edge carries its nearer side's motion.
    ivec2 at = clamp(ib, ivec2(0), lim);
    float dC = texelFetch(tDepth, at, 0).r;
    for (int k = 0; k < 4; k++) {
      ivec2 o = k == 0 ? ivec2(1, 0) : k == 1 ? ivec2(-1, 0) : k == 2 ? ivec2(0, 1) : ivec2(0, -1);
      ivec2 q = clamp(ib + o, ivec2(0), lim);
      float dn = texelFetch(tDepth, q, 0).r;
      if (dn < dC) { dC = dn; at = q; }
    }
    vec2 atUv = (vec2(at) + 0.5) / uSize.xy;
    float lin = dC >= 1.0 ? uDepthNF.y : linDepth(dC);
    vec3 P = viewPos(atUv, lin);
    vec4 pc = uReproject * vec4(P, 1.0);
    float own = 0.0;
    for (int b = 0; b < BODIES; b++) {
      vec4 r = uBodyRect[b];
      if (uv.x < r.x || uv.y < r.y || uv.x > r.z || uv.y > r.w) continue;
      vec3 l = (uBodyLocal[b] * vec4(P, 1.0)).xyz;
      if (max(abs(l.x), max(abs(l.y), abs(l.z))) < 1.0) {
        pc = uBodyPrev[b] * vec4(P, 1.0);
        own = 1.0;
        break;
      }
    }
    vec2 prevUv = pc.xy / max(pc.w, 1e-4) * 0.5 + 0.5;
    vec2 motion = prevUv - (atUv - uJit.xy);
    vec2 hUv = uv + motion;
    float motionPx = length(motion * uSize.zw);

    // This frame at the pixel: the 3x3 scene pixels round it, each weighed by how near it fell to the
    // pixel's middle (in frame pixels), and the colours round it for the box.
    vec3 sum = vec3(0.0);
    float wsum = 0.0;
    float wmax = 0.0;
    vec3 m1 = vec3(0.0);
    vec3 m2 = vec3(0.0);
    vec3 lo = vec3(1e4);
    vec3 hi = vec3(-1e4);
    vec3 lo5 = vec3(1e4);
    vec3 hi5 = vec3(-1e4);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        ivec2 q = ib + ivec2(i, j);
        vec3 s = squash(max(texelFetch(tScene, clamp(q, ivec2(0), lim), 0).rgb, vec3(0.0)));
        vec2 d = (vec2(q) - tp) * ratio;
        float w = exp(-uTaaKern * dot(d, d));
        sum += s * w;
        wsum += w;
        wmax = max(wmax, w);
        vec3 y = toYC(s);
        m1 += y;
        m2 += y * y;
        lo = min(lo, y);
        hi = max(hi, y);
        if (i == 0 || j == 0) {
          lo5 = min(lo5, y);
          hi5 = max(hi5, y);
        }
      }
    }
    // The box's corners: the 3x3's, drawn toward the cross's (a rounder box: a lone dark or bright pixel on
    // the diagonal does not open the box for the whole pixel).
    lo = mix(lo, lo5, uTaaR);
    hi = mix(hi, hi5, uTaaR);
    vec3 curS = sum / wsum;
    vec3 cur = unsquash(curS);
    // The occlusion, laid on this frame before the blend; the box moves with it.
    vec3 curAO = pipeAO(cur, uvR);
    vec3 curY = toYC(squash(curAO));
    vec3 shift = curY - toYC(curS);
    vec3 mean = m1 / 9.0;
    vec3 sd = sqrt(max(m2 / 9.0 - mean * mean, vec3(0.0)));
    mean += shift;
    lo += shift;
    hi += shift;

    vec3 res = toYC(squash(curAO));
    float fresh = 1.0;
    if (uTaaK.z > 0.5 && pc.w > 0.0 && hUv.x >= 0.0 && hUv.y >= 0.0 && hUv.x <= 1.0 && hUv.y <= 1.0) {
      fresh = 0.0;
      if (uTaaM.w > 0.5) {
        // Was this point what last frame saw there? Its distance from last frame's lens against last frame's
        // depth round where it was (the nearest of four, so an edge a part-pixel off is not a miss).
        vec2 pp = (prevUv + uJit.zw) * uSize.xy - 0.5;
        ivec2 pb = ivec2(floor(pp));
        float best = 1e9;
        for (int k = 0; k < 4; k++) {
          ivec2 q = clamp(pb + ivec2(k - (k / 2) * 2, k / 2), ivec2(0), lim);
          float r = texelFetch(tPrevDepth, q, 0).r;
          float pl = r >= 1.0 ? uDepthNF.y : linDepth(r);
          best = min(best, abs(pl - pc.w) / max(pc.w, 0.05));
        }
        fresh = smoothstep(0.06, 0.18, best);
      }
      float alpha = mix(uTaaK.x, uTaaK.y, smoothstep(1.0, uTaaM.x, motionPx));
      // A frame pixel far from every scene pixel drawn this frame leans on the history; one right on one
      // takes more of it (this is what rebuilds a frame larger than the scene).
      alpha *= mix(0.35, 1.0, wmax);
      vec3 hS = history(hUv);
      // A highlight that was not there a frame ago (a glint's flash, a spark on the scene's side): taken as it
      // comes, not faded in over a dozen frames.
      float lc = dot(curAO, vec3(0.2126, 0.7152, 0.0722));
      float lh = dot(unsquash(hS), vec3(0.2126, 0.7152, 0.0722));
      alpha = max(alpha, uTaaK.w * smoothstep(0.9, 1.8, lc) * smoothstep(1.3, 2.4, lc / max(lh, 0.05)));
      alpha = max(alpha, fresh);
      float g = mix(uTaaM.y, uTaaM.z, smoothstep(2.0, 24.0, motionPx));
      vec3 bl = max(mean - g * sd, lo);
      vec3 bh = min(mean + g * sd, hi);
      vec3 hY = clipBox(toYC(hS), bl, bh);
      res = mix(hY, curY, alpha);
    }
    // The history is kept compressed (squash()): the sharpen reads it so, and expands it.
    vec3 outS = fromYC(res);
    // (A pixel that is not a number, should a material ever write one, is never kept.)
    if (!(outS.r == outS.r && outS.g == outS.g && outS.b == outS.b)) outS = vec3(0.0);
    if (uTaaView > 0.5) outS = squash(vec3(own, fresh, min(1.0, motionPx / 32.0)));
    gl_FragColor = vec4(clamp(outS, vec3(0.0), vec3(0.998)), 1.0);
  }
`;

const PRESENT_FRAG = /* glsl */ `
  precision highp float;
  precision highp int;
  uniform sampler2D tSrc;
  uniform sampler2D tDepth;
  // xy this frame's move (uv), z the sharpen (0 none to 1 the most).
  uniform vec3 uPresent;
  varying vec2 vUv;
  float top3(vec3 c) { return max(c.r, max(c.g, c.b)); }
  vec3 squash(vec3 c) { return c / (1.0 + top3(c)); }
  vec3 unsquash(vec3 c) { return c / max(1.0 - top3(c), 1e-3); }
  void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    ivec2 lim = textureSize(tSrc, 0) - 1;
    // (The history is kept compressed: taa.ts squash().)
    vec3 es = texelFetch(tSrc, p, 0).rgb;
    vec3 col = unsquash(es);
    if (uPresent.z > 0.0) {
      // The contrast-adaptive sharpen (after AMD's RCAS): a negative lobe on the four neighbours, as strong
      // as it can be without taking a channel past black or white, and never past three sixteenths; so a
      // soft edge is lifted and a flat or already hard one is left alone. In the compressed range, where
      // every value is under 1.
      vec3 b = texelFetch(tSrc, clamp(p + ivec2(0, 1), ivec2(0), lim), 0).rgb;
      vec3 d = texelFetch(tSrc, clamp(p + ivec2(-1, 0), ivec2(0), lim), 0).rgb;
      vec3 f = texelFetch(tSrc, clamp(p + ivec2(1, 0), ivec2(0), lim), 0).rgb;
      vec3 h = texelFetch(tSrc, clamp(p + ivec2(0, -1), ivec2(0), lim), 0).rgb;
      vec3 mn4 = min(min(b, d), min(f, h));
      vec3 mx4 = max(max(b, d), max(f, h));
      vec3 hitMin = min(mn4, es) / max(4.0 * mx4, vec3(1e-4));
      vec3 hitMax = (1.0 - max(mx4, es)) / min(4.0 * mn4 - 4.0, vec3(-1e-4));
      vec3 lobeC = max(-hitMin, hitMax);
      float lobe = max(-0.1875, min(max(lobeC.r, max(lobeC.g, lobeC.b)), 0.0)) * uPresent.z;
      vec3 o = (lobe * (b + d + f + h) + es) / (4.0 * lobe + 1.0);
      col = unsquash(clamp(o, vec3(0.0), vec3(0.998)));
    }
    gl_FragColor = vec4(col, 1.0);
    // The scene's depth at the frame's size, for what is drawn over the rebuilt frame (after.ts).
    gl_FragDepth = texture(tDepth, vUv + uPresent.xy).r;
  }
`;

interface Body {
  id: number;
  world: Matrix4;
  center: Vector3;
  half: Vector3;
}

const tmpM = new Matrix4();
const tmpN = new Matrix4();
const tmpV = new Vector3();
const tmpQ = new Quaternion();
const viewProj = new Matrix4();
const ONE = new Vector3(1, 1, 1);

export class TemporalPass {
  private hist: [WebGLRenderTarget, WebGLRenderTarget];
  /** The rebuilt and sharpened frame with the scene's depth: what is drawn after the rebuild draws here,
   *  and the bloom and the composite read it. */
  readonly out: WebGLRenderTarget;
  private resolveMat: ShaderMaterial;
  private presentMat: ShaderMaterial;
  private ow = 2;
  private oh = 2;
  private rw = 2;
  private rh = 2;
  private sized = false;
  /** The history holds last frame's rebuilt picture (false after a cut, a resize or a frame without it). */
  private valid = false;
  private frame = 0;
  private phases = 8;
  /** This frame's and last frame's move, in uv of the scene (where the world point a frame pixel shows was
   *  drawn, less that pixel's uv). */
  private jit = new Vector2();
  private lastJit = new Vector2();
  private moved = false;
  /** The lens's view before the move (null: none), to put it back exactly. */
  private view: { full: [number, number]; offset: [number, number]; size: [number, number] } | null = null;
  private set = false;
  /** The projection this frame's scene was drawn with (the lens moved inside a pixel). */
  readonly drawnWith = new Matrix4();
  private lastPos = new Vector3();
  private lastDir = new Vector3();
  private havePose = false;
  private programs: 'none' | 'building' | 'ready' = 'none';
  /** Tuning (dev: `world.post.pipe.taa.k`): the least and most share of this frame (0.22 in motion read
   *  aliased just after a fast pan, 0.12 soft), the motion at the most, the box at rest and in motion, a new
   *  highlight's share, how far the box is drawn toward the cross's, the reconstruction filter's width. */
  readonly k = { min: 0.08, max: 0.16, motionPx: 40, boxRest: 1.25, boxMove: 0.9, flash: 0.6, round: 0.5, kernel: 4 };
  private bodies: Body[] = Array.from({ length: BODIES }, () => ({ id: 0, world: new Matrix4(), center: new Vector3(), half: new Vector3() }));
  private nBodies = 0;
  private prevBody = new Map<number, Matrix4>();
  private spare: Matrix4[] = [];
  /** Dev: shows the rebuild's own reading (red: a body's own motion, green: a disocclusion, blue: motion). */
  debugView = false;

  constructor(private quad: Quad, private renderer: WebGLRenderer) {
    const make = (name: string) => {
      // (Half floats, where round 7's blend kept R11G11B10F: a history fed back every frame through a
      // five-bit mantissa sticks short of a slow change, by up to a few per cent in blue.)
      const t = new WebGLRenderTarget(2, 2, { format: RGBAFormat, type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
      t.texture.name = name;
      return t;
    };
    this.hist = [make('taa-history-a'), make('taa-history-b')];
    const packed = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    this.out = new WebGLRenderTarget(2, 2, { format: packed ? RGBFormat : RGBAFormat, type: packed ? UnsignedInt101111Type : HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: true, stencilBuffer: false, generateMipmaps: false });
    this.out.texture.name = 'taa-frame';
    const d = depthUniforms;
    const a = aoComposite;
    this.resolveMat = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: RESOLVE_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDepth: d.tDepth,
        uDepthNF: d.uDepthNF,
        uProj: d.uProj,
        uProjScale: d.uProjScale,
        uDepthTexel: d.uDepthTexel,
        uReproject: d.uReproject,
        tAO: a.tAO,
        uAO: a.uAO,
        uAOTint: a.uAOTint,
        tScene: { value: null as Texture | null },
        tHistory: { value: null as Texture | null },
        tPrevDepth: { value: null as Texture | null },
        uJit: { value: new Vector4() },
        uSize: { value: new Vector4(2, 2, 2, 2) },
        uTaaK: { value: new Vector4(0.08, 0.16, 0, 0.6) },
        uTaaM: { value: new Vector4(40, 1.25, 0.9, 0) },
        uBodyLocal: { value: Array.from({ length: BODIES }, () => new Matrix4()) },
        uBodyPrev: { value: Array.from({ length: BODIES }, () => new Matrix4()) },
        uBodyRect: { value: Array.from({ length: BODIES }, () => new Vector4(1, 1, 0, 0)) },
        uTaaView: { value: 0 },
        uTaaR: { value: 0.5 },
        uTaaKern: { value: 4 },
      },
    });
    this.presentMat = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: PRESENT_FRAG,
      depthTest: true,
      depthWrite: true,
      depthFunc: AlwaysDepth,
      uniforms: {
        tSrc: { value: null as Texture | null },
        tDepth: d.tDepth,
        uPresent: { value: new Vector3() },
      },
    });
  }

  /** The frame's size and the scene's (pixels). */
  setSize(ow: number, oh: number, rw: number, rh: number): void {
    if (ow === this.ow && oh === this.oh && rw === this.rw && rh === this.rh) return;
    this.ow = ow;
    this.oh = oh;
    this.rw = rw;
    this.rh = rh;
    this.phases = jitterPhases(rw / Math.max(1, ow));
    this.sized = false;
    this.valid = false;
  }

  /** Whether the programs are built. Asked the first time, it has them compiled on idle time (in parallel
   *  where the browser can), so nothing of this runs before the first frame. */
  ready(): boolean {
    if (this.programs === 'none') {
      this.programs = 'building';
      const go = () => {
        const prev = this.renderer.getRenderTarget();
        const done = Promise.all([this.quad.compileAsync(this.resolveMat, this.hist[0]), this.quad.compileAsync(this.presentMat, this.out)]);
        this.renderer.setRenderTarget(prev);
        done.then(() => (this.programs = 'ready')).catch(() => (this.programs = 'ready'));
      };
      if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 600 });
      else setTimeout(go, 50);
    }
    return this.programs === 'ready';
  }

  /** Last frame's finished picture, before this frame's rebuild: what the ice's screen mirror reads (the
   *  history itself is kept compressed). */
  get lastFrame(): Texture | null {
    return this.valid ? this.out.texture : null;
  }

  /** Before the scene is drawn: moves the lens to this frame's place inside a scene pixel. */
  move(camera: PerspectiveCamera): void {
    // A cut (a new shot, the reel's next lens, a revive) is not motion: nothing is kept across it.
    const e = camera.matrixWorld.elements;
    tmpV.set(-e[8], -e[9], -e[10]);
    if (this.havePose && (camera.position.distanceTo(this.lastPos) > 6 || tmpV.dot(this.lastDir) < 0.82)) this.valid = false;
    this.lastPos.copy(camera.position);
    this.lastDir.copy(tmpV);
    this.havePose = true;
    if (!lensKept()) this.valid = false;
    const [px, py] = jitterAt(this.frame, this.phases);
    // The screen-space dithers move with it (materials.ts uNoiseFrame), so they are rebuilt into fades.
    shared.uNoiseFrame.value = this.frame % 64;
    this.frame++;
    // (A view offset already on the lens is kept under the move: the play-test's own part-pixel shifts, in
    // whatever pixels it gave them.)
    const v = camera.view;
    let bx = 0;
    let by = 0;
    if (v !== null && v.enabled) {
      this.view = { full: [v.fullWidth, v.fullHeight], offset: [v.offsetX, v.offsetY], size: [v.width, v.height] };
      bx = (v.offsetX / v.fullWidth) * this.rw;
      by = (v.offsetY / v.fullHeight) * this.rh;
    } else this.view = null;
    camera.setViewOffset(this.rw, this.rh, bx + px, by + py, this.rw, this.rh);
    this.drawnWith.copy(camera.projectionMatrix);
    this.set = true;
    // A view moved right and down by (x, y) pixels shows the world moved left and up: the world point a
    // frame pixel shows at uv was drawn at uv + (-x / w, y / h).
    this.lastJit.copy(this.jit);
    this.jit.set(-px / this.rw, py / this.rh);
    if (!this.moved) this.lastJit.copy(this.jit);
    this.moved = true;
  }

  /** Once the scene is drawn: the lens goes back to its place (the rebuild's frame, the particles' and
   *  everything after them see the lens itself). Safe to call twice. */
  settle(camera: PerspectiveCamera): void {
    if (!this.set) return;
    this.set = false;
    const v = this.view;
    if (v) camera.setViewOffset(v.full[0], v.full[1], v.offset[0], v.offset[1], v.size[0], v.size[1]);
    else camera.clearViewOffset();
  }

  /** A frame without the reconstruction: the history is stale. */
  rest(): void {
    this.valid = false;
    this.moved = false;
    shared.uNoiseFrame.value = 0;
  }

  /** This frame's bodies with motion of their own start empty; body() adds them (world.ts, before the frame). */
  clearBodies(): void {
    this.nBodies = 0;
  }

  /**
   * A body that moves on its own this frame: `id` stable across frames, `world` its frame's world matrix
   * (its sled's), its box in that frame (centre and half sizes, metres). Past BODIES the rest are ignored
   * (the caller gives the nearest first).
   */
  body(id: number, world: Matrix4, center: Vector3, half: Vector3): void {
    if (this.nBodies >= BODIES) return;
    const b = this.bodies[this.nBodies++];
    b.id = id;
    b.world.copy(world);
    b.center.copy(center);
    b.half.copy(half);
  }

  /** body() from a position and an orientation. */
  bodyAt(id: number, pos: Vector3, q: Quaternion, center: Vector3, half: Vector3): void {
    this.body(id, tmpN.compose(pos, q, ONE), center, half);
  }

  /** The bodies' uniforms for this frame, against the lens as it stands (moved back) and last frame's. */
  private aimBodies(camera: PerspectiveCamera): void {
    const u = this.resolveMat.uniforms;
    const local = u.uBodyLocal.value as Matrix4[];
    const prev = u.uBodyPrev.value as Matrix4[];
    const rect = u.uBodyRect.value as Vector4[];
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const last = lastViewProj();
    const seen = new Set<number>();
    for (let i = 0; i < BODIES; i++) {
      if (i >= this.nBodies) {
        rect[i].set(1, 1, 0, 0);
        continue;
      }
      const b = this.bodies[i];
      seen.add(b.id);
      // View space to the box: into the body's frame, then the box's own, scaled so its faces are at 1.
      tmpM.compose(b.center, tmpQ.identity(), b.half).invert();
      local[i].copy(tmpM).multiply(tmpN.copy(b.world).invert()).multiply(camera.matrixWorld);
      // View space to last frame's clip space, for a point carried by the body: back into its frame, out by
      // its last pose, through last frame's lens.
      const was = this.prevBody.get(b.id) ?? b.world;
      prev[i].copy(last).multiply(was).multiply(tmpN.copy(b.world).invert()).multiply(camera.matrixWorld);
      // Its box on screen (a margin of a few pixels); the whole frame if a corner is behind the lens.
      let x0 = 2;
      let y0 = 2;
      let x1 = -1;
      let y1 = -1;
      let behind = false;
      for (let c = 0; c < 8; c++) {
        tmpV.set(c & 1 ? 1 : -1, c & 2 ? 1 : -1, c & 4 ? 1 : -1).multiply(b.half).add(b.center).applyMatrix4(b.world);
        const x = tmpV.x;
        const y = tmpV.y;
        const z = tmpV.z;
        const el = viewProj.elements;
        const w = el[3] * x + el[7] * y + el[11] * z + el[15];
        if (w <= 0.05) {
          behind = true;
          break;
        }
        const sx = ((el[0] * x + el[4] * y + el[8] * z + el[12]) / w) * 0.5 + 0.5;
        const sy = ((el[1] * x + el[5] * y + el[9] * z + el[13]) / w) * 0.5 + 0.5;
        x0 = Math.min(x0, sx);
        y0 = Math.min(y0, sy);
        x1 = Math.max(x1, sx);
        y1 = Math.max(y1, sy);
      }
      if (behind) rect[i].set(0, 0, 1, 1);
      else rect[i].set(x0 - 4 / this.ow, y0 - 4 / this.oh, x1 + 4 / this.ow, y1 + 4 / this.oh);
    }
    // Each body's pose is kept for next frame; a body not seen this frame is forgotten.
    for (const [id, m] of this.prevBody) {
      if (!seen.has(id)) {
        this.prevBody.delete(id);
        this.spare.push(m);
      }
    }
    for (let i = 0; i < this.nBodies; i++) {
      const b = this.bodies[i];
      let m = this.prevBody.get(b.id);
      if (!m) {
        m = this.spare.pop() ?? new Matrix4();
        this.prevBody.set(b.id, m);
      }
      m.copy(b.world);
    }
  }

  private fit(): void {
    if (this.sized) return;
    this.sized = true;
    for (const t of this.hist) t.setSize(this.ow, this.oh);
    this.out.setSize(this.ow, this.oh);
  }

  /**
   * Rebuilds this frame into the history from the scene's picture (and its depth, already aimed:
   * depth.ts), and last frame's depth (null: none to test against). Then sharpens it into `out` with the
   * depth (present). The camera is the lens as it stands (moved back).
   */
  render(scene: Texture, prevDepth: Texture | null, camera: PerspectiveCamera, sharpen: number): Texture {
    this.fit();
    this.aimBodies(camera);
    const u = this.resolveMat.uniforms;
    const k = this.k;
    u.tScene.value = scene;
    u.tHistory.value = this.hist[0].texture;
    u.tPrevDepth.value = prevDepth;
    (u.uJit.value as Vector4).set(this.jit.x, this.jit.y, this.lastJit.x, this.lastJit.y);
    (u.uSize.value as Vector4).set(this.rw, this.rh, this.ow, this.oh);
    (u.uTaaK.value as Vector4).set(k.min, k.max, this.valid ? 1 : 0, k.flash);
    (u.uTaaM.value as Vector4).set(k.motionPx, k.boxRest, k.boxMove, prevDepth && this.valid ? 1 : 0);
    u.uTaaView.value = this.debugView ? 1 : 0;
    u.uTaaR.value = k.round;
    u.uTaaKern.value = k.kernel;
    this.quad.draw(this.resolveMat, this.hist[1]);
    const t = this.hist[0];
    this.hist[0] = this.hist[1];
    this.hist[1] = t;
    this.valid = true;
    const p = this.presentMat.uniforms;
    p.tSrc.value = this.hist[0].texture;
    (p.uPresent.value as Vector3).set(this.jit.x, this.jit.y, this.debugView ? 0 : sharpen);
    this.quad.draw(this.presentMat, this.out);
    return this.out.texture;
  }

  dispose(): void {
    for (const t of this.hist) t.dispose();
    this.out.dispose();
    this.resolveMat.dispose();
    this.presentMat.dispose();
  }
}
