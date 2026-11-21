import { DepthStencilFormat, DepthTexture, NearestFilter, UnsignedInt248Type, Vector3, Vector2, type PerspectiveCamera, type Scene, type Texture, type WebGLRenderTarget, type WebGLRenderer } from 'three';
import { cine } from '../cine';
import { AfterDraw } from './after';
import { AOPass, AO_COMPOSITE_GLSL, aoComposite } from './ao';
import { DEPTH_GLSL, aimDepth, depthUniforms, keepLens, lastViewProj, lensMotionPx } from './depth';
import { LensPass } from './lens';
import { Quad } from './quad';
import { aimIceMirror } from './reflect';
import { TemporalPass } from './taa';
import { SHAFT_COMPOSITE_GLSL, ShaftsPass, shaftComposite, shaftPlace } from './shafts';
import { PASSES, allSwitches, planFrame, wantsDepth, wantsTaa, type FramePlan, type FrameSignals, type PassSettings, type PassSwitches } from './tiers';
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
export const VIEWS = ['none', 'depth', 'ao', 'contact', 'shafts', 'coc', 'motion', 'taa'] as const;
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
  readonly taa: TemporalPass;
  /** What the reconstruction cannot know, drawn after it (after.ts). */
  readonly after = new AfterDraw();
  /** The rider's place on screen (uv, origin bottom left) and the clock, set by post.ts each frame. */
  readonly rider = new Vector2(0.5, 0.4);
  time = 0;
  private lastTime = 0;
  /** Last frame left a resolved picture and depth in the scene target (under the reconstruction, in the
   *  other of the two it draws into in turn). */
  private drawn = false;
  /** One depth texture a scene target (the reconstruction keeps two targets, in turn). */
  private depthTexs: DepthTexture[] = [];
  private signals: FrameSignals = { post: true, dof: 0, motionBlur: 0, letterbox: 0, shafts: 0, reduced: false, motionPx: 0 };
  /** The frame's size (the scene's is smaller under the reconstruction). */
  private w = 2;
  private h = 2;

  constructor(private renderer: WebGLRenderer) {
    this.quad = new Quad(renderer);
    this.timer = new GpuTimer(renderer);
    this.ao = new AOPass(this.quad);
    this.shafts = new ShaftsPass(this.quad);
    this.lens = new LensPass(this.quad, renderer);
    this.taa = new TemporalPass(this.quad, renderer);
  }

  /** A tier's passes (and the dev switches): builds or drops the scene targets' depth textures and
   *  compiles the programs the tier will use. `targets` are the scene targets (two under the
   *  reconstruction, drawn into in turn). */
  configure(passes: PassSettings, targets: readonly WebGLRenderTarget[]): void {
    this.passes = passes;
    const want = wantsDepth(passes, this.switches);
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const has = this.depthTexs[i] ?? null;
      if (want && (!has || target.depthTexture !== has)) {
        // 24 bits of depth and the 8 of stencil the rider's mask needs (contract C10), as one texture.
        const t = has ?? new DepthTexture(target.width, target.height, UnsignedInt248Type);
        t.format = DepthStencilFormat;
        t.minFilter = NearestFilter;
        t.magFilter = NearestFilter;
        t.name = 'scene-depth-' + i;
        this.depthTexs[i] = t;
        target.depthTexture = t;
        target.dispose();
      } else if (!want && has) {
        target.depthTexture = null;
        target.resolveDepthBuffer = false;
        target.dispose();
        has.dispose();
        delete this.depthTexs[i];
      }
    }
    // A target dropped (the reconstruction off): its depth goes with it.
    for (let i = targets.length; i < this.depthTexs.length; i++) {
      this.depthTexs[i]?.dispose();
      delete this.depthTexs[i];
    }
    this.depthTexs.length = Math.min(this.depthTexs.length, targets.length);
    this.drawn = false;
    this.ao.configure(this.switches.ao ? passes.ao : 'off', passes.contact && this.switches.contact);
    this.shafts.configure(this.switches.shafts ? passes.shaftTaps : 0, passes.shaftDiv);
    this.lens.configure(this.switches.dof ? passes.dofTaps : 0, this.switches.blur ? passes.blurTaps : 0);
    if (!wantsTaa(passes, this.switches)) this.taa.rest();
  }

  /** The frame's size, and the scene's (smaller under the reconstruction). What reads the scene's own
   *  depth and picture (the occlusion, the shafts) works from the scene's; the lens pass reads the frame. */
  setSize(w: number, h: number, rw = w, rh = h): void {
    this.w = w;
    this.h = h;
    this.drawn = false;
    this.ao.setSize(rw, rh);
    this.shafts.setSize(rw, rh);
    this.lens.setSize(w, h);
    this.taa.setSize(w, h, rw, rh);
  }

  private depthOf(target: WebGLRenderTarget | null): DepthTexture | null {
    if (!target || !target.depthTexture) return null;
    return this.depthTexs.includes(target.depthTexture as DepthTexture) ? (target.depthTexture as DepthTexture) : null;
  }

  /** Before the scene pass: reads the camera's cine state and decides whether this frame's depth is
   *  needed at all (under MSAA an unread depth is not resolved). `shafts` is the most the shafts could
   *  be this frame (the mood's strength; where the light is on screen is known after the scene). `last`
   *  is the scene target drawn last frame when it is not `target` (the reconstruction's other one). */
  begin(target: WebGLRenderTarget, last: WebGLRenderTarget | null, camera: PerspectiveCamera, post: boolean, shafts: number, reducedMotion: boolean): void {
    const f = this.signals;
    f.post = post;
    f.dof = cine.dof;
    f.motionBlur = cine.motionBlur;
    f.letterbox = cine.letterbox;
    f.shafts = Math.max(shafts, shaftPlace.strength);
    f.reduced = reducedMotion;
    f.motionPx = lensMotionPx(camera, this.h);
    f.taaReady = post && wantsTaa(this.passes, this.switches) ? this.taa.ready() : true;
    planFrame(this.passes, this.switches, f, this.w / this.h, this.plan);
    const depth = this.depthOf(target);
    if (depth) target.resolveDepthBuffer = this.plan.depth;
    // What glazed ice mirrors while the scene is drawn: last frame's own picture and depth on Ultra. Under
    // the reconstruction, the last rebuilt frame and the other scene target's depth; under MSAA, the
    // target's resolved textures (drawing into renderbuffers does not write them).
    const mode = !post || !this.switches.mirror || this.passes.mirror === 'sky' ? 0 : this.passes.mirror === 'bake' ? 1 : 2;
    let color: Texture | null = null;
    let mirrorDepth: Texture | null = null;
    if (mode === 2 && this.drawn) {
      if (this.plan.taa && last) {
        color = this.taa.lastFrame;
        mirrorDepth = this.depthOf(last);
      } else if (!this.plan.taa && target.samples > 0 && depth) {
        color = target.texture;
        mirrorDepth = depth;
      }
    }
    aimIceMirror(mode, color && mirrorDepth ? color : null, color && mirrorDepth ? mirrorDepth : null, lastViewProj(), camera.near, camera.far);
    // (After the lens's own motion is measured: the part-pixel move is not motion.)
    if (this.plan.taa && depth) this.taa.move(camera);
    else this.taa.rest();
    this.timer.begin('scene');
  }

  /** Right after the scene pass: the lens goes back to its place, and the reconstruction finds what it
   *  should draw after itself from now on (after.ts). */
  afterScene(camera: PerspectiveCamera, scene: Scene): void {
    if (!this.plan.taa) return;
    this.taa.settle(camera);
    this.after.scan(this.renderer, scene);
  }

  /**
   * After the scene pass: draws this frame's passes and returns the picture the bloom and the composite
   * read (the scene's own, the rebuilt frame under the reconstruction, or the lens pass's when a beat blurs
   * it). `sunK` is the sun's shafts' strength now that its place on screen (`sunUv`) is known; `last` as in
   * begin(); `scene` is drawn again for what the reconstruction draws after itself.
   */
  run(target: WebGLRenderTarget, last: WebGLRenderTarget | null, camera: PerspectiveCamera, sunK: number, sunUv: Vector2, scene: Scene): Texture {
    const f = this.signals;
    f.shafts = Math.max(sunK, shaftPlace.strength);
    const plan = planFrame(this.passes, this.switches, f, this.w / this.h, this.plan);
    const depth = plan.depth ? this.depthOf(target) : null;
    aimDepth(camera, depth, target.width, target.height, plan.taa ? this.taa.drawnWith : undefined);
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
    if (plan.taa && depth) {
      this.timer.begin('taa');
      this.taa.debugView = this.view === 'taa';
      const prevDepth = this.drawn && last ? this.depthOf(last) : null;
      picture = this.taa.render(target.texture, prevDepth, camera, this.switches.sharpen ? this.passes.sharpen : 0);
      // (The occlusion is in the rebuilt frame now: the composite lays on none.)
      this.ao.rest();
      this.timer.begin('after');
      this.after.draw(this.renderer, scene, camera, this.taa.out);
    }
    if (plan.lens && depth) {
      this.timer.begin('lens');
      const dt = Math.max(1 / 240, Math.min(0.1, this.time - this.lastTime));
      picture = this.lens.render(picture, plan.dof ? cine.dof : 0, cine.focus, plan.blur ? cine.motionBlur : 0, dt, this.rider, cine.edge);
    }
    this.lastTime = this.time;
    this.timer.begin('bloom');
    return picture;
  }

  /** Once the composite is on screen. */
  end(camera?: PerspectiveCamera): void {
    if (camera) this.taa.settle(camera);
    this.drawn = this.plan.depth;
    keepLens();
    this.timer.collect();
  }

  dispose(): void {
    this.ao.dispose();
    this.shafts.dispose();
    this.lens.dispose();
    this.taa.dispose();
    for (const t of this.depthTexs) t?.dispose();
  }
}
