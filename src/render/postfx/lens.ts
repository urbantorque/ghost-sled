import { HalfFloatType, LinearFilter, RGBAFormat, RGBFormat, ShaderMaterial, UnsignedInt101111Type, Vector2, Vector4, WebGLRenderTarget, type Texture, type WebGLRenderer } from 'three';
import { DEPTH_GLSL, depthUniforms } from './depth';
import { QUAD_VERT, type Quad } from './quad';

// The lens pass: depth of field and camera-motion blur for the camera's beats (cine.ts). It runs only
// while cine.dof or cine.motionBlur is above rest; at rest none of its targets is drawn into and the
// bloom and the composite read the scene itself.
//
// Depth of field. The circle of confusion comes from the depth and cine.focus: nothing at the focus,
// growing behind it to a set most and in front of it faster. A half-frame pass gathers the picture over
// a disc of taps (a spiral of 22 on Ultra, with bright taps weighted up so highlights open into discs; 8
// on High), each tap counted only if its own circle reaches the pixel, so a sharp rider never bleeds
// into the blurred valley behind. The full-frame pass then mixes sharp and blurred by each pixel's own
// circle. Ghosts and particles write no depth: they blur with what is behind them.
//
// Motion blur. Each pixel's motion is where its point of the world was on screen a frame ago (depth
// reprojection: the lens's motion only), scaled by cine.motionBlur and held to a few pixels. Taps run
// along it, centred on the pixel. The rider rides with the lens, so the depth alone would smear it: an
// ellipse round the rider's place on screen is left sharp and is never gathered from. Reduced motion
// turns the whole pass off (tiers.ts planFrame).

const GATHER_FRAG = /* glsl */ `
  precision highp float;
  ${DEPTH_GLSL}
  uniform sampler2D tScene;
  // x the focus (m), y the most a circle grows to (uv of the frame's height), z the frame's aspect.
  uniform vec3 uDof;
  varying vec2 vUv;
  float coc(float lin) {
    float c = 1.0 - uDof.x / max(lin, 0.05);
    // Behind the focus it tends to 1; in front it runs away, and is held to the same most.
    return clamp(c, -1.0, 1.0) * uDof.y;
  }
  void main() {
    float raw = texture2D(tDepth, vUv).r;
    float c0 = abs(coc(raw >= 1.0 ? 1e5 : linDepth(raw)));
    vec3 acc = min(texture2D(tScene, vUv).rgb, vec3(6.0));
    float wsum = 1.0;
    // A golden-angle spiral over the widest circle, turned a different way at each pixel: with one spiral
    // for the whole frame a small bright light behind the focus was printed as the spiral's own eight dots,
    // a frost of little stars (a night of lanterns was covered in them). Turned, the dots fill a soft disc.
    float turn = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(TAPS));
      float a = fi * 2.39996323 + turn;
      vec2 off = vec2(cos(a), sin(a)) * r * uDof.y;
      vec2 uv = vUv + off * vec2(1.0 / uDof.z, 1.0);
      float rs = texture2D(tDepth, uv).r;
      float cs = abs(coc(rs >= 1.0 ? 1e5 : linDepth(rs)));
      // A tap counts if its own circle reaches this pixel, or this pixel's reaches it and the tap is
      // no sharper than half of it (the background fills in behind a soft edge).
      float w = smoothstep(0.0, uDof.y * 0.12, max(cs, min(c0, cs * 2.0)) - r * uDof.y * 0.9);
      // (A lamp's core is far over white; held here so one tap cannot own the disc.)
      vec3 s = min(texture2D(tScene, uv).rgb, vec3(6.0));
      #ifdef BOKEH
      w *= 1.0 + 2.0 * smoothstep(0.9, 2.0, max(s.r, max(s.g, s.b)));
      #endif
      acc += s * w;
      wsum += w;
    }
    gl_FragColor = vec4(acc / wsum, c0 / max(uDof.y, 1e-5));
  }
`;

const LENS_FRAG = /* glsl */ `
  precision highp float;
  ${DEPTH_GLSL}
  uniform sampler2D tScene;
  uniform sampler2D tDofBlur;
  uniform mat4 uReproject;
  // x depth of field on, y the focus (m), z the most a circle grows to.
  uniform vec3 uDofMix;
  // x the motion's scale (0: off), y the longest blur (uv of the frame's height), z the aspect, w how much
  // of it keeps to the frame's edge (cine.edge).
  uniform vec4 uBlur;
  // The rider on screen: xy its uv, zw the ellipse's radii (uv).
  uniform vec4 uKeep;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float keep(vec2 uv) {
    vec2 q = (uv - uKeep.xy) / uKeep.zw;
    return 1.0 - smoothstep(0.55, 1.0, dot(q, q));
  }
  vec3 tap(vec2 uv) {
    vec3 c = min(texture2D(tScene, uv).rgb, vec3(16.0));
    if (uDofMix.x > 0.5) {
      float raw = texture2D(tDepth, uv).r;
      float lin = raw >= 1.0 ? 1e5 : linDepth(raw);
      float k = abs(clamp(1.0 - uDofMix.y / max(lin, 0.05), -1.0, 1.0));
      // Sharp until the circle is about a pixel and a half wide, then the half-frame's blur.
      c = mix(c, texture2D(tDofBlur, uv).rgb, smoothstep(0.08, 0.4, k));
    }
    return c;
  }
  void main() {
    vec3 col = tap(vUv);
    if (uBlur.x > 0.0) {
      float raw = texture2D(tDepth, vUv).r;
      // The sky is at no distance: only the lens turning moves it.
      vec4 pc = raw >= 1.0 ? uReproject * vec4(viewPos(vUv, 1.0), 0.0) : uReproject * vec4(viewPos(vUv, linDepth(raw)), 1.0);
      vec2 vel = pc.w > 0.0 ? (vUv - (pc.xy / pc.w * 0.5 + 0.5)) * uBlur.x : vec2(0.0);
      float len = length(vel * vec2(uBlur.z, 1.0));
      float here = keep(vUv);
      // Round 8 (speed): speed's blur keeps to the frame's edge. Over the whole frame it smeared the near
      // banks and the snow under the lens into one soft sheet; held to the outer band (the sides and the
      // corners, little across the foot) the middle stays sharp and what rushes past the sides streaks along
      // its own path. A whip's blur (w 0) is still the whole frame's.
      float rim = length((vUv - 0.5) * vec2(uBlur.z, 1.0));
      // (And there it runs longer, up to three times a beat's: held to a beat's length the sides were as
      // still as the middle, and a sharp frame read slower than the old whole-frame smear.)
      float edgeM = smoothstep(0.46, 0.95, rim);
      vel *= mix(1.0, edgeM, uBlur.w);
      len *= mix(1.0, edgeM, uBlur.w);
      float cap = uBlur.y * mix(1.0, 1.0 + 2.2 * edgeM, uBlur.w);
      if (len > uDepthTexel.y * 0.75 && here < 0.98) {
        vel *= min(1.0, cap / len) * (1.0 - here);
        float j = hash(gl_FragCoord.xy) - 0.5;
        vec3 acc = col;
        float wsum = 1.0;
        for (int i = 0; i < TAPS; i++) {
          float t = (float(i) + 0.5 + j) / float(TAPS) - 0.5;
          vec2 uv = vUv + vel * t;
          // The rider is never gathered into the snow beside it.
          float w = 1.0 - keep(uv);
          acc += tap(clamp(uv, vec2(0.001), vec2(0.999))) * w;
          wsum += w;
        }
        col = acc / wsum;
      }
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class LensPass {
  private half: WebGLRenderTarget;
  private full: WebGLRenderTarget;
  private gather: ShaderMaterial;
  private lens: ShaderMaterial;
  private dofTaps = 0;
  private blurTaps = 0;
  /** The widest circle of confusion at cine.dof = 1, and the longest motion blur at cine.motionBlur =
   *  1, both as a share of the frame's height. Kept small: a beat's blur, never a smear. */
  maxCoc = 0.011;
  maxBlur = 0.022;
  /** The shutter at cine.motionBlur = 1: the share of a 60 Hz frame's motion that blurs. */
  shutter = 0.6;

  constructor(private quad: Quad, renderer: WebGLRenderer) {
    const packed = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
    this.half = new WebGLRenderTarget(2, 2, { format: RGBAFormat, type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
    this.full = new WebGLRenderTarget(2, 2, { format: packed ? RGBFormat : RGBAFormat, type: packed ? UnsignedInt101111Type : HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
    this.half.texture.name = 'dof-blur';
    this.full.texture.name = 'lens';
    const d = depthUniforms;
    this.gather = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: GATHER_FRAG,
      defines: { TAPS: 8 },
      uniforms: { tDepth: d.tDepth, uDepthNF: d.uDepthNF, tScene: { value: null }, uDof: { value: new Vector4(12, 0.01, 1.78, 0) } },
      depthTest: false,
      depthWrite: false,
    });
    this.lens = new ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: LENS_FRAG,
      defines: { TAPS: 5 },
      uniforms: {
        tDepth: d.tDepth,
        uDepthNF: d.uDepthNF,
        uProj: d.uProj,
        uDepthTexel: d.uDepthTexel,
        uReproject: d.uReproject,
        tScene: { value: null },
        tDofBlur: { value: this.half.texture },
        uDofMix: { value: new Vector4(0, 12, 0.01, 0) },
        uBlur: { value: new Vector4(0, 0.02, 1.78, 0) },
        uKeep: { value: new Vector4(0.5, 0.4, 0.1, 0.16) },
      },
      depthTest: false,
      depthWrite: false,
    });
  }

  private sized = false;
  private w = 2;
  private h = 2;

  /** Taps of the depth of field's gather and of the motion blur (0: the tier has neither). The programs
   *  are compiled here, not on a beat's first frame. */
  configure(dofTaps: number, blurTaps: number): void {
    if (dofTaps === this.dofTaps && blurTaps === this.blurTaps) return;
    this.dofTaps = dofTaps;
    this.blurTaps = blurTaps;
    if (dofTaps > 0) {
      const g: Record<string, number | string> = { TAPS: dofTaps };
      if (dofTaps >= 16) g.BOKEH = '';
      this.gather.defines = g;
      this.gather.needsUpdate = true;
      this.quad.compile(this.gather, this.half);
    }
    if (dofTaps > 0 || blurTaps > 0) {
      this.lens.defines = { TAPS: Math.max(1, blurTaps) };
      this.lens.needsUpdate = true;
      this.quad.compile(this.lens, this.full);
    }
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.sized = false;
  }

  /** The targets are full-frame and half-frame floats: they are only given their size when a beat first
   *  needs them, so a tier that never plays a beat never holds them. */
  private fit(): void {
    if (this.sized) return;
    this.sized = true;
    this.full.setSize(this.w, this.h);
    this.half.setSize(Math.max(1, Math.ceil(this.w / 2)), Math.max(1, Math.ceil(this.h / 2)));
  }

  /**
   * Draws the beat. dof and blur are cine's values (0 when the plan left that half out); focus is
   * cine.focus; dt the frame's seconds; rider the rider's place on screen (uv, origin bottom left); edge
   * how much of the blur keeps to the frame's edge (cine.edge).
   * Returns the picture for the bloom and the composite.
   */
  render(scene: Texture, dof: number, focus: number, blur: number, dt: number, rider: Vector2, edge = 0): Texture {
    this.fit();
    const aspect = this.w / this.h;
    const coc = this.maxCoc * Math.min(1, dof);
    if (dof > 0) {
      const g = this.gather.uniforms;
      g.tScene.value = scene;
      g.uDof.value.set(Math.max(0.5, focus), coc, aspect, 0);
      this.quad.draw(this.gather, this.half);
    }
    const u = this.lens.uniforms;
    u.tScene.value = scene;
    u.uDofMix.value.set(dof > 0 ? 1 : 0, Math.max(0.5, focus), coc, 0);
    // The motion is a frame's worth; a long frame is brought back to a 60 Hz shutter.
    const scale = blur > 0 ? this.shutter * Math.min(1, blur) * Math.min(1, 1 / 60 / Math.max(dt, 1 / 240)) : 0;
    u.uBlur.value.set(scale, this.maxBlur * Math.min(1, blur), aspect, Math.max(0, Math.min(1, edge)));
    u.uKeep.value.set(rider.x, rider.y + 0.02, 0.11 / aspect + 0.03, 0.2);
    this.quad.draw(this.lens, this.full);
    return this.full.texture;
  }

  dispose(): void {
    this.half.dispose();
    this.full.dispose();
    this.gather.dispose();
    this.lens.dispose();
  }
}
