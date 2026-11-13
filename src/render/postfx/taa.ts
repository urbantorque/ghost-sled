import { HalfFloatType, LinearFilter, RGBAFormat, RGBFormat, ShaderMaterial, UnsignedInt101111Type, Vector2, Vector4, WebGLRenderTarget, type PerspectiveCamera, type Texture, type WebGLRenderer } from 'three';
import { DEPTH_GLSL, depthUniforms } from './depth';
import { QUAD_VERT, type Quad } from './quad';

// Temporal anti-aliasing: an Ultra experiment (tiers.ts `taa`; notes/r7-pipe.md says whether it is on
// and why). Each frame the lens is moved by part of a pixel (eight places inside one pixel, in turn),
// and one full-frame pass blends the new picture into a history of the frames before it, so over eight
// frames every pixel has been sampled in eight places. The history is looked up where each pixel's point
// of the world was a frame ago (the depth's reprojection, as the motion blur's; the nearest depth of a
// pixel's cross, so an edge carries its own motion), and held inside the colours the new frame has round
// that pixel, so what the reprojection cannot know about (the riders, particles, a moving shadow) is
// pulled to the new frame instead of trailing. The rider rides with the lens: inside the rider's ellipse
// the history is read in place.
//
// What it costs beyond its pass (15 taps a pixel and two full-frame float targets): everything else that
// reads the frame's depth reads a depth that moves by part of a pixel each frame.

const FRAG = /* glsl */ `
  precision highp float;
  ${DEPTH_GLSL}
  uniform sampler2D tScene;
  uniform sampler2D tHistory;
  uniform mat4 uReproject;
  // xy this frame's part-pixel move less last frame's (uv), z how much of the new frame goes in, w 1 once
  // there is a history.
  uniform vec4 uTaa;
  // The rider's ellipse: xy its middle (uv), zw its radii.
  uniform vec4 uKeep;
  varying vec2 vUv;
  // (Blended in a compressed range, so one frame's glint does not own the average.)
  vec3 squash(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
  vec3 unsquash(vec3 c) { return c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-3); }
  void main() {
    vec3 cur = texture2D(tScene, vUv).rgb;
    if (uTaa.w < 0.5) { gl_FragColor = vec4(cur, 1.0); return; }
    float d = texture2D(tDepth, vUv).r;
    vec2 at = vUv;
    for (int i = 0; i < 4; i++) {
      vec2 o = (i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0)) * uDepthTexel;
      float dn = texture2D(tDepth, vUv + o).r;
      if (dn < d) { d = dn; at = vUv + o; }
    }
    float lin = d >= 1.0 ? uDepthNF.y : linDepth(d);
    vec4 pc = uReproject * vec4(viewPos(at, lin), 1.0);
    vec2 motion = pc.xy / max(pc.w, 1e-4) * 0.5 + 0.5 - at;
    float keep = 1.0 - smoothstep(0.75, 1.0, length((vUv - uKeep.xy) / uKeep.zw));
    vec2 hUv = mix(vUv + motion + uTaa.xy, vUv, keep);
    if (pc.w <= 0.0 || hUv.x < 0.0 || hUv.x > 1.0 || hUv.y < 0.0 || hUv.y > 1.0) { gl_FragColor = vec4(cur, 1.0); return; }
    vec3 m1 = vec3(0.0);
    vec3 m2 = vec3(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 c = squash(texture2D(tScene, vUv + vec2(float(x), float(y)) * uDepthTexel).rgb);
        m1 += c;
        m2 += c * c;
      }
    }
    vec3 mean = m1 / 9.0;
    vec3 sd = sqrt(max(m2 / 9.0 - mean * mean, vec3(0.0)));
    vec3 hist = clamp(squash(texture2D(tHistory, hUv).rgb), mean - 1.25 * sd, mean + 1.25 * sd);
    // More of the new frame the further the history had to be fetched from (it has been through a
    // bilinear read each frame on the way: a long fetch is a soft one).
    float k = mix(uTaa.z, 0.3, clamp(length(motion / uDepthTexel) / 24.0, 0.0, 1.0));
    gl_FragColor = vec4(unsquash(mix(hist, squash(cur), k)), 1.0);
  }
`;

/** Eight places inside a pixel (a Halton set on 2 and 3), as offsets from its middle. */
const PLACES: ReadonlyArray<readonly [number, number]> = [
  [0, -1 / 6], [-0.25, 1 / 6], [0.25, -7 / 18], [-0.375, -1 / 18], [0.125, 5 / 18], [-0.125, -5 / 18], [0.375, 1 / 18], [-0.4375, 7 / 18],
];

export class TaaPass {
  private a: WebGLRenderTarget;
  private b: WebGLRenderTarget;
  private mat: ShaderMaterial;
  private w = 2;
  private h = 2;
  private sized = false;
  private ready = false;
  private frame = 0;
  private moved = false;
  private set = false;
  private base: [number, number] | null = null;
  private now = new Vector2();
  private last = new Vector2();

  constructor(private quad: Quad, renderer: WebGLRenderer) {
    const packed = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    const make = (name: string) => {
      const t = new WebGLRenderTarget(2, 2, { format: packed ? RGBFormat : RGBAFormat, type: packed ? UnsignedInt101111Type : HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
      t.texture.name = name;
      return t;
    };
    this.a = make('taa-a');
    this.b = make('taa-b');
    const d = depthUniforms;
    this.mat = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDepth: d.tDepth,
        uDepthNF: d.uDepthNF,
        uProj: d.uProj,
        uProjScale: d.uProjScale,
        uDepthTexel: d.uDepthTexel,
        uReproject: d.uReproject,
        tScene: { value: null as Texture | null },
        tHistory: { value: null as Texture | null },
        uTaa: { value: new Vector4(0, 0, 0.1, 0) },
        uKeep: { value: new Vector4(0.5, 0.4, 0.1, 0.2) },
      },
    });
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.sized = false;
    this.ready = false;
  }

  /** Before the scene is drawn: moves the lens to this frame's place inside the pixel. */
  move(camera: PerspectiveCamera): void {
    const p = PLACES[this.frame++ % PLACES.length];
    // (A view offset already on the lens is kept under the move: the play-test's own part-pixel shifts.)
    const v = camera.view;
    this.base = v !== null && v.enabled ? [v.offsetX, v.offsetY] : null;
    camera.setViewOffset(this.w, this.h, (this.base ? this.base[0] : 0) + p[0], (this.base ? this.base[1] : 0) + p[1], this.w, this.h);
    this.set = true;
    // A view moved right and down by (x, y) pixels shows the world moved left and up: in uv (origin
    // bottom left) the picture moves by (-x / w, y / h).
    this.last.copy(this.now);
    this.now.set(-p[0] / this.w, p[1] / this.h);
    if (!this.moved) this.last.copy(this.now);
    this.moved = true;
  }

  /** Once the frame is on screen (or on a frame the pass sits out): the lens goes back to its place. */
  settle(camera: PerspectiveCamera): void {
    if (!this.set) return;
    this.set = false;
    if (this.base) camera.setViewOffset(this.w, this.h, this.base[0], this.base[1], this.w, this.h);
    else camera.clearViewOffset();
  }

  /** A frame without the pass: the history is stale. */
  rest(): void {
    this.ready = false;
    this.moved = false;
  }

  /** Blends the scene into the history and returns the result. */
  render(scene: Texture, rider: Vector2): Texture {
    if (!this.sized) {
      this.sized = true;
      this.a.setSize(this.w, this.h);
      this.b.setSize(this.w, this.h);
    }
    const u = this.mat.uniforms;
    u.tScene.value = scene;
    u.tHistory.value = this.a.texture;
    (u.uTaa.value as Vector4).set(this.now.x - this.last.x, this.now.y - this.last.y, 0.1, this.ready ? 1 : 0);
    const aspect = this.w / this.h;
    (u.uKeep.value as Vector4).set(rider.x, rider.y + 0.02, 0.11 / aspect + 0.03, 0.2);
    this.quad.draw(this.mat, this.b);
    const out = this.b;
    this.b = this.a;
    this.a = out;
    this.ready = true;
    return out.texture;
  }

  dispose(): void {
    this.a.dispose();
    this.b.dispose();
    this.mat.dispose();
  }
}
