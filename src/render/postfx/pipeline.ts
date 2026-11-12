import { DepthStencilFormat, DepthTexture, NearestFilter, UnsignedInt248Type, Vector3, Vector2, type PerspectiveCamera, type Texture, type WebGLRenderTarget, type WebGLRenderer } from 'three';
import { cine } from '../cine';
import { AOPass, AO_COMPOSITE_GLSL, aoComposite } from './ao';
import { DEPTH_GLSL, aimDepth, depthUniforms, keepLens, lensMotionPx } from './depth';
import { LensPass } from './lens';
import { Quad } from './quad';
import { SHAFT_COMPOSITE_GLSL, ShaftsPass, shaftComposite, shaftPlace } from './shafts';
import { PASSES, allSwitches, planFrame, wantsDepth, type FramePlan, type FrameSignals, type PassSettings, type PassSwitches } from './tiers';
import { GpuTimer } from './timing';

// Round 7's passes between the scene and the composite. post.ts owns the scene target, the bloom and
// the composite; this owns everything new: the frame's depth, the occlusion, the shafts, the lens pass.
// Each frame it is asked three things in order: begin() before the scene is drawn (does the target need
// its depth resolved?), run() after it (draw the passes the plan names, and say which picture the bloom
// and the composite read), end() once the composite is on screen.
//
// Every pass is gated twice: by the tier's row in tiers.ts and by this frame's plan. A pass that is not
// in the plan draws nothing and its composite function returns on its first line.

/** What the composite shows instead of the picture (dev: `?postview=`). */
export const VIEWS = ['none', 'depth', 'ao', 'contact', 'shafts', 'coc', 'motion'] as const;
export type PipeView = (typeof VIEWS)[number];

/** The composite's side of the pipeline: uniforms to spread into its own, GLSL to splice in before
 *  main(). post.ts adds nothing else for these passes but the calls. */
export const pipeUniforms = {
  tDepth: depthUniforms.tDepth,
  uDepthNF: depthUniforms.uDepthNF,
  uProj: depthUniforms.uProj,
  uProjScale: depthUniforms.uProjScale,
  uDepthTexel: depthUniforms.uDepthTexel,
  ...aoComposite,
  ...shaftComposite,
  /** The letterbox: each bar's height as a share of the frame's (0: none). */
  uBars: { value: 0 },
  uPipeView: { value: 0 },
};

export const PIPE_COMPOSITE_GLSL = /* glsl */ `
  ${DEPTH_GLSL}
  ${AO_COMPOSITE_GLSL}
  ${SHAFT_COMPOSITE_GLSL}
  uniform float uBars;
  uniform float uPipeView;
  // A beat's letterbox: two bars eased in by the camera (cine.letterbox), black, with a hairline of
  // softness so their edge does not stair-step. The HUD is the page's and draws over them.
  float pipeBars(vec2 uv) {
    if (uBars <= 0.0) return 1.0;
    float edge = min(uv.y, 1.0 - uv.y);
    return smoothstep(uBars - uDepthTexel.y, uBars + uDepthTexel.y, edge);
  }
  // Dev views of what the passes made.
  vec3 pipeView(vec3 col, vec2 uv) {
    if (uPipeView < 0.5) return col;
    float raw = texture2D(tDepth, uv).r;
    if (uPipeView < 1.5) return raw >= 1.0 ? vec3(0.0, 0.0, 0.2) : vec3(1.0 - depthKey(linDepth(raw)) * 1.6);
    if (uPipeView < 2.5) return vec3(texture2D(tAO, uv).r);
    if (uPipeView < 3.5) return vec3(texture2D(tAO, uv).g);
    if (uPipeView < 4.5) return vec3(uShaftSun.z > 0.001 ? texture2D(tShaftSun, uv).r : 0.0, uShaftPlace.z > 0.001 ? texture2D(tShaftPlace, uv).r : 0.0, 0.0);
    return col;
  }
`;

export class Pipeline {
  readonly quad: Quad;
  readonly timer: GpuTimer;
  /** The dev switches (`?post=`); flip one at run time for a before and after at the same frame. */
  switches: PassSwitches = allSwitches(true);
  passes: PassSettings = PASSES.low;
  /** This frame's plan (the last frame's, between frames). */
  readonly plan: FramePlan = planFrame(PASSES.low, this.switches, { post: false, dof: 0, motionBlur: 0, letterbox: 0, shafts: 0, reduced: false });
  /** The world direction to the light that casts the shadows (world.ts sets it each frame). */
  readonly lightDir = new Vector3(0.3, 0.8, 0.2);
  view: PipeView = 'none';
  readonly ao: AOPass;
  readonly shafts: ShaftsPass;
  readonly lens: LensPass;
  /** The rider's place on screen (uv, origin bottom left) and the clock, set by post.ts each frame. */
  readonly rider = new Vector2(0.5, 0.4);
  time = 0;
  private lastTime = 0;
  private depthTex: DepthTexture | null = null;
  private signals: FrameSignals = { post: true, dof: 0, motionBlur: 0, letterbox: 0, shafts: 0, reduced: false, motionPx: 0 };
  private w = 2;
  private h = 2;

  constructor(renderer: WebGLRenderer) {
    this.quad = new Quad(renderer);
    this.timer = new GpuTimer(renderer);
    this.ao = new AOPass(this.quad);
    this.shafts = new ShaftsPass(this.quad);
    this.lens = new LensPass(this.quad, renderer);
  }

  /** A tier's passes (and the dev switches): builds or drops the scene target's depth texture and
   *  compiles the programs the tier will use. */
  configure(passes: PassSettings, target: WebGLRenderTarget): void {
    this.passes = passes;
    const want = wantsDepth(passes, this.switches);
    if (want && !this.depthTex) {
      // 24 bits of depth and the 8 of stencil the rider's mask needs (contract C10), as one texture.
      const t = new DepthTexture(target.width, target.height, UnsignedInt248Type);
      t.format = DepthStencilFormat;
      t.minFilter = NearestFilter;
      t.magFilter = NearestFilter;
      t.name = 'scene-depth';
      this.depthTex = t;
      target.depthTexture = t;
      target.dispose();
    } else if (!want && this.depthTex) {
      target.depthTexture = null;
      target.resolveDepthBuffer = false;
      target.dispose();
      this.depthTex.dispose();
      this.depthTex = null;
    }
    this.ao.configure(this.switches.ao ? passes.ao : 'off', passes.contact && this.switches.contact);
    this.shafts.configure(this.switches.shafts ? passes.shaftTaps : 0, passes.shaftDiv);
    this.lens.configure(this.switches.dof ? passes.dofTaps : 0, this.switches.blur ? passes.blurTaps : 0);
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.ao.setSize(w, h);
    this.shafts.setSize(w, h);
    this.lens.setSize(w, h);
  }

  /** Before the scene pass: reads the camera's cine state and decides whether this frame's depth is
   *  needed at all (under MSAA an unread depth is not resolved). `shafts` is the most the shafts could
   *  be this frame (the mood's strength; where the light is on screen is known after the scene). */
  begin(target: WebGLRenderTarget, camera: PerspectiveCamera, post: boolean, shafts: number, reducedMotion: boolean): void {
    const f = this.signals;
    f.post = post;
    f.dof = cine.dof;
    f.motionBlur = cine.motionBlur;
    f.letterbox = cine.letterbox;
    f.shafts = Math.max(shafts, shaftPlace.strength);
    f.reduced = reducedMotion;
    f.motionPx = lensMotionPx(camera, this.h);
    planFrame(this.passes, this.switches, f, this.w / this.h, this.plan);
    if (this.depthTex) target.resolveDepthBuffer = this.plan.depth;
    this.timer.begin('scene');
  }

  /**
   * After the scene pass: draws this frame's passes and returns the picture the bloom and the composite
   * read (the scene's own, or the lens pass's when a beat blurs it). `sunK` is the sun's shafts'
   * strength now that its place on screen (`sunUv`) is known.
   */
  run(target: WebGLRenderTarget, camera: PerspectiveCamera, sunK: number, sunUv: Vector2): Texture {
    const f = this.signals;
    f.shafts = Math.max(sunK, shaftPlace.strength);
    const plan = planFrame(this.passes, this.switches, f, this.w / this.h, this.plan);
    const depth = this.depthTex && plan.depth ? this.depthTex : null;
    aimDepth(camera, depth, target.width, target.height);
    if (plan.ao && depth) {
      this.timer.begin('ao');
      this.ao.render(camera, this.lightDir, plan.contact);
    } else this.ao.rest();
    if (plan.shafts && depth) {
      this.timer.begin('shafts');
      // (A place that turns out to be behind the lens marches nothing; the plan still counted it.)
      this.shafts.render(target.texture, camera, sunUv, sunK);
    } else this.shafts.rest();
    pipeUniforms.uBars.value = plan.letterbox;
    pipeUniforms.uPipeView.value = depth ? VIEWS.indexOf(this.view) : 0;
    let picture = target.texture;
    if (plan.lens && depth) {
      this.timer.begin('lens');
      const dt = Math.max(1 / 240, Math.min(0.1, this.time - this.lastTime));
      picture = this.lens.render(picture, plan.dof ? cine.dof : 0, cine.focus, plan.blur ? cine.motionBlur : 0, dt, this.rider);
    }
    this.lastTime = this.time;
    this.timer.begin('bloom');
    return picture;
  }

  /** Once the composite is on screen. */
  end(): void {
    keepLens();
    this.timer.collect();
  }

  dispose(): void {
    this.ao.dispose();
    this.shafts.dispose();
    this.lens.dispose();
    this.depthTex?.dispose();
  }
}
