// Round 7's tiers and the frame's passes, as plain data: which pass a tier may run, and which of them a
// given frame does run. Nothing here touches the GPU, so the tables and the plan are tested without one
// (tests/pipeline.test.ts). post.ts builds the passes this names and runs the plan it is handed.

/** Ultra sits above High: the showpiece, for a discrete GPU. Nothing steps into it by itself on an
 *  integrated one (quality.ts). */
export type Tier = 'low' | 'medium' | 'high' | 'ultra';

/** The world's own dressing (forests, crowds, life, the far ranges) has three levels. Ultra dresses the
 *  world as High does and spends what it has on the frame's passes, so every system written against the
 *  three keeps its tables. */
export type Detail = 'low' | 'medium' | 'high';

export const TIERS: readonly Tier[] = ['low', 'medium', 'high', 'ultra'];

export function detailOf(t: Tier): Detail {
  return t === 'ultra' ? 'high' : t;
}

export interface PassSettings {
  /** Ambient occlusion from the frame's depth, at half the frame: 'lite' is one horizon slice a pixel
   *  (four depth taps), 'gtao' three slices of three steps (eighteen). */
  ao: 'off' | 'lite' | 'gtao';
  /** Contact shadows: a short march toward the sun in the same pass, so feet, runners and trunks meet
   *  the snow where the shadow map's texels are too coarse to. */
  contact: boolean;
  /** Depth-marched light shafts: taps in each of the two radial passes (their product is the reach:
   *  6 is 36 samples along the ray), 0 for none. */
  shaftTaps: number;
  /** The divisor of the frame the shafts are marched at. */
  shaftDiv: 2 | 4;
  /** Depth of field in the camera's beats: taps of the gather at half the frame (0: none). */
  dofTaps: number;
  /** Camera-motion blur from the depth's reprojection: taps along the motion (0: none). */
  blurTaps: number;
  /** What glazed ice mirrors. 'sky': the painted gradient and ridges (round 6). 'bake': the baked sky
   *  and peaks on every glaze, with the riders standing in it. 'screen': the frame itself, marched. */
  mirror: 'sky' | 'bake' | 'screen';
  /** Temporal reconstruction (the visual lift, notes/vl-temporal.md): the scene is drawn at `scale` of
   *  the frame with the lens moved inside a pixel each frame, and rebuilt to the full frame from the
   *  frames before it. Where it runs it replaces the edge walk and most of the MSAA (both come back with
   *  `?post=-taa`). */
  taa: boolean;
  /** The MSAA samples the scene is drawn with while the reconstruction runs (at most the tier's own). Two
   *  keep a cable thinner than a pixel, and an outline the rider has just uncovered, drawn in every frame:
   *  without them the rasteriser dropped a far cable in some frames, the history could not follow a line the
   *  frame did not draw, and it broke into dashes. On a dense screen the scene is drawn at `scale`, so two
   *  samples there cost about half of round 7's two at the frame's own size. */
  taaMsaa: number;
  /** The scene's resolution on each axis as a share of the frame's while the reconstruction runs (1: the
   *  frame's own). Never below one scene pixel to a page pixel (renderScale). */
  scale: number;
  /** The contrast-adaptive sharpen after the reconstruction, 0 none to 1 the most. */
  sharpen: number;
  /** Edge anti-aliasing in the composite, on top of whatever MSAA the tier has: 0 none, 1 round 6's
   *  (five taps to find an edge, four along it), 2 the edge walk (the edge is followed to both its ends,
   *  so a long shallow stair, a wire or a roof line, is smoothed along its whole length). */
  fxaa: 0 | 1 | 2;
  /** Lens character at speed: a hair of colour fringe in the frame's corners, 0 for none. A calm frame
   *  has none on any tier (ART.md: a lens that stays out of the way). */
  fringe: number;
  /** The shadow map's reach round what the lens sees, metres (half its side). */
  shadowReach: number;
}

const OFF: PassSettings = { ao: 'off', contact: false, shaftTaps: 0, shaftDiv: 4, dofTaps: 0, blurTaps: 0, mirror: 'sky', taa: false, taaMsaa: 0, scale: 1, sharpen: 0, fxaa: 0, fringe: 0, shadowReach: 26 };

/** What each tier may run. Low has no post pass at all, so every row of it is off: its look is
 *  designed in the materials and the sky, never stripped from here. `fxaa` is what the composite runs
 *  when the reconstruction does not (its switch off, or the frames before its programs are built).
 *  The reconstruction ships off (`taa: false`; `?taa` turns it on with High's and Ultra's tuning below): its
 *  second critic found the rider softer with a pale halo and moving lifts doubled, and ART.md puts the hero
 *  first, so High and Ultra keep round 7's MSAA and edge walk (DECISIONS 362, notes/vl-temporal.md). */
export const PASSES: Record<Tier, PassSettings> = {
  low: { ...OFF },
  medium: { ...OFF, shaftTaps: 6, shaftDiv: 4, mirror: 'bake', fxaa: 2 },
  high: { ...OFF, ao: 'lite', shaftTaps: 8, shaftDiv: 2, dofTaps: 8, blurTaps: 5, mirror: 'bake', taa: false, taaMsaa: 2, scale: 0.7, sharpen: 0.8, fxaa: 2, fringe: 0.3, shadowReach: 34 },
  ultra: { ao: 'gtao', contact: true, shaftTaps: 12, shaftDiv: 2, dofTaps: 22, blurTaps: 9, mirror: 'screen', taa: false, taaMsaa: 2, scale: 0.85, sharpen: 0.7, fxaa: 2, fringe: 1, shadowReach: 44 },
};

/** The fewest scene pixels to a page (CSS) pixel the reconstruction draws: at a pixel ratio of 1 it
 *  rebuilds at the frame's own size, on a dense screen it draws fewer pixels than the screen has. */
export const SCALE_FLOOR = 1;

/**
 * The share of the frame (each axis) the scene is drawn at: `p.scale` while the reconstruction runs, but
 * never fewer scene pixels than the page has pixels (SCALE_FLOOR at the renderer's pixel ratio), and the
 * whole frame without it or with `?post=-scale`.
 */
export function renderScale(p: PassSettings, sw: PassSwitches, pixelRatio: number): number {
  if (!p.taa || !sw.taa || !sw.scale) return 1;
  return Math.min(1, Math.max(p.scale, SCALE_FLOOR / Math.max(pixelRatio, 1e-3)));
}

/** The MSAA samples the scene target is drawn with: the tier's own, or under the reconstruction its
 *  `taaMsaa` (never more than the tier's own). */
export function sceneSamples(msaa: number, p: PassSettings, sw: PassSwitches): number {
  return p.taa && sw.taa ? Math.min(msaa, p.taaMsaa) : msaa;
}

/** How many places inside a pixel the lens visits before it repeats: 8 at the frame's own size, more as
 *  the scene is drawn smaller (each frame pixel then needs more of them to be visited at all). */
export function jitterPhases(scale: number): number {
  return scale < 0.95 ? 16 : 8;
}

/** The i-th place inside a pixel (a Halton set on 2 and 3, from 1), as an offset from its middle in pixels. */
export function jitterAt(i: number, phases: number): [number, number] {
  const k = (i % phases) + 1;
  const halton = (n: number, b: number) => {
    let f = 1;
    let x = 0;
    while (n > 0) {
      f /= b;
      x += f * (n % b);
      n = Math.floor(n / b);
    }
    return x;
  };
  return [halton(k, 2) - 0.5, halton(k, 3) - 0.5];
}

/** The dev switch `?post=` (and `world.post.switches` at run time): each pass can be turned off for a
 *  before and after at the same frame. All on by default. */
export interface PassSwitches {
  ao: boolean;
  contact: boolean;
  shafts: boolean;
  dof: boolean;
  blur: boolean;
  mirror: boolean;
  /** The temporal reconstruction (off: the tier's MSAA and edge walk, as round 7). */
  taa: boolean;
  /** The reconstruction's smaller scene (off: it rebuilds from a scene at the frame's own size). */
  scale: boolean;
  /** The contrast-adaptive sharpen after the reconstruction. */
  sharpen: boolean;
  /** Round 7's edge anti-aliasing (off: round 6's, FXAA only where there is no MSAA). */
  aa: boolean;
  letterbox: boolean;
  /** The shadow frustum's fit to the lens and its texel snap (off: round 6's box round the rider). */
  fit: boolean;
  /** Lens character at speed (the corners' fringe). */
  lens: boolean;
}

export const SWITCH_NAMES: ReadonlyArray<keyof PassSwitches> = ['ao', 'contact', 'shafts', 'dof', 'blur', 'mirror', 'taa', 'scale', 'sharpen', 'aa', 'letterbox', 'fit', 'lens'];

export function allSwitches(on = true): PassSwitches {
  return { ao: on, contact: on, shafts: on, dof: on, blur: on, mirror: on, taa: on, scale: on, sharpen: on, aa: on, letterbox: on, fit: on, lens: on };
}

/**
 * Reads `?post=`. `none` (or `off`) is round 6's stack; `all` is everything the tier has; a list of
 * names keeps only those (`ao,shafts`); names with a minus drop them from the rest (`-ao,-blur`).
 * Unknown names are ignored. Null or empty reads as all on.
 */
export function parseSwitches(spec: string | null | undefined): PassSwitches {
  const out = allSwitches(true);
  if (!spec) return out;
  const tokens = spec.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const names = SWITCH_NAMES as readonly string[];
  if (tokens.some((t) => t === 'none' || t === 'off' || (!t.startsWith('-') && t !== 'all' && names.includes(t)))) {
    for (const k of SWITCH_NAMES) out[k] = false;
  }
  for (const t of tokens) {
    if (t === 'all') for (const k of SWITCH_NAMES) out[k] = true;
    else if (t.startsWith('-') && names.includes(t.slice(1))) out[t.slice(1) as keyof PassSwitches] = false;
    else if (names.includes(t)) out[t as keyof PassSwitches] = true;
  }
  return out;
}

/** What a frame asks of the stack: the camera's cine state (cine.ts), the light's shafts, the player's
 *  reduced-motion setting. */
export interface FrameSignals {
  /** The post stack is on at all (Low renders straight to the canvas). */
  post: boolean;
  /** cine.dof, cine.motionBlur, cine.letterbox. */
  dof: number;
  motionBlur: number;
  letterbox: number;
  /** How strong the shafts are this frame (the mood's, times how far its source is in view), per source. */
  shafts: number;
  reduced: boolean;
  /** How far the lens moved this frame, as the largest screen motion in pixels (a still lens blurs nothing). */
  motionPx?: number;
  /** The reconstruction's programs are built (they compile on idle after the first frame; until then the
   *  composite's edge walk stands in). Absent reads as ready. */
  taaReady?: boolean;
}

export interface FramePlan {
  /** The scene target carries a depth texture this frame (and resolves it under MSAA). */
  depth: boolean;
  ao: boolean;
  contact: boolean;
  shafts: boolean;
  dof: boolean;
  blur: boolean;
  /** The temporal reconstruction runs (the lens is moved inside its pixel this frame, the frame is rebuilt
   *  and sharpened, and what the history cannot know is drawn over it at the frame's size). */
  taa: boolean;
  /** The full-frame lens pass runs (depth of field or motion blur is in the frame). */
  lens: boolean;
  /** The letterbox's height as a share of the frame's (0: none). */
  letterbox: number;
  /** Full-screen passes this frame adds to round 6's stack (bloom and the composite). */
  added: number;
}

/** Below this a cine value is at rest: its pass is not drawn at all. */
export const CINE_EPS = 0.004;

/** The widest letterbox: a 2.39:1 picture inside a 16:9 frame takes about an eighth off each edge. A
 *  frame already wider than that, or a portrait one, gets none. */
export function letterboxShare(k: number, aspect: number): number {
  if (k <= CINE_EPS || aspect <= 1) return 0;
  const full = Math.max(0, (1 - aspect / 2.39) / 2);
  return Math.min(0.13, full) * Math.min(1, k);
}

/**
 * The frame's plan: which passes run. A pass runs only when its tier has it, its switch is on and the
 * frame asks for it, so the cine contract's rest state (dof, motionBlur and letterbox all 0) adds
 * nothing over the tier's standing passes, and Low adds nothing ever.
 */
export function planFrame(p: PassSettings, sw: PassSwitches, f: FrameSignals, aspect = 16 / 9, out?: FramePlan): FramePlan {
  const plan: FramePlan = out ?? { depth: false, ao: false, contact: false, shafts: false, dof: false, blur: false, taa: false, lens: false, letterbox: 0, added: 0 };
  plan.depth = plan.ao = plan.contact = plan.shafts = plan.dof = plan.blur = plan.taa = plan.lens = false;
  plan.letterbox = plan.added = 0;
  if (!f.post) return plan;
  plan.ao = p.ao !== 'off' && sw.ao;
  plan.contact = plan.ao && p.contact && sw.contact;
  plan.shafts = p.shaftTaps > 0 && sw.shafts && f.shafts > 0.001;
  plan.dof = p.dofTaps > 0 && sw.dof && f.dof > CINE_EPS;
  plan.blur = p.blurTaps > 0 && sw.blur && !f.reduced && f.motionBlur > CINE_EPS && (f.motionPx === undefined || f.motionPx > 0.5);
  plan.lens = plan.dof || plan.blur;
  plan.taa = p.taa && sw.taa && f.taaReady !== false;
  plan.letterbox = sw.letterbox ? letterboxShare(f.letterbox, aspect) : 0;
  // (The ice's screen mirror marches against last frame's depth, so it needs every frame's.)
  plan.depth = plan.ao || plan.shafts || plan.lens || plan.taa || (p.mirror === 'screen' && sw.mirror);
  // The occlusion and its blur; the shafts' two radial passes; depth of field's gather at half the frame;
  // the lens pass; the reconstruction's two (the rebuild into the history, and the sharpen into the frame,
  // which writes the depth the particles are drawn against; the particles themselves only move from the
  // scene's draw to their own, no draw is added). The letterbox is a few lines of the composite.
  plan.added = (plan.ao ? 2 : 0) + (plan.shafts ? 2 : 0) + (plan.dof ? 1 : 0) + (plan.lens ? 1 : 0) + (plan.taa ? 2 : 0);
  return plan;
}

/** Whether the reconstruction is configured on a tier (its targets are built and the scene is drawn at
 *  renderScale without MSAA), whether or not its programs are ready this frame. */
export function wantsTaa(p: PassSettings, sw: PassSwitches): boolean {
  return p.taa && sw.taa;
}

/** Whether a tier ever samples the frame's depth (so the scene target is built with a depth texture). */
export function wantsDepth(p: PassSettings, sw: PassSwitches): boolean {
  return (p.ao !== 'off' && sw.ao) || (p.shaftTaps > 0 && sw.shafts) || (p.dofTaps > 0 && sw.dof) || (p.blurTaps > 0 && sw.blur) || (p.taa && sw.taa) || (p.mirror === 'screen' && sw.mirror);
}

/** One row of a tier's cost table: what a pass draws and into what. Timings are not here (they are
 *  measured, in notes/r7-pipe.md); everything here follows from the tables above and the frame's size. */
export interface PassCost {
  /** The switch that turns it off (`?post=-name`). */
  name: keyof PassSwitches;
  /** Full-screen draws a frame (each is one triangle). */
  draws: number;
  /** The target it draws into: width, height, format ('' and 0 by 0 when it draws into none). */
  w: number;
  h: number;
  format: string;
  /** How many targets of that size it holds. */
  targets: number;
  /** Texture reads a pixel at the most (where it reads at all). */
  taps: number;
  /** Where the cost falls when it is not a pass of its own. */
  where: string;
}

/**
 * The cost table of one frame w by h on a tier: a row for every pass in this frame's plan, and one for
 * each thing that is not a pass but is paid for (the mirror's march in the snow shader, the edge walk
 * and the fringe in the composite, the shadow map's reach). The rows' draws add up to `plan.added`.
 */
export function passCosts(p: PassSettings, sw: PassSwitches, f: FrameSignals, w: number, h: number, pixelRatio = 1): PassCost[] {
  const plan = planFrame(p, sw, f, w / Math.max(1, h));
  const rows: PassCost[] = [];
  if (!f.post) return rows;
  // What reads the scene's own depth and picture works at the scene's size (smaller under the
  // reconstruction); what reads the rebuilt frame at the frame's.
  const s = plan.taa ? renderScale(p, sw, pixelRatio) : 1;
  const sw0 = Math.max(1, Math.round(w * s));
  const sh0 = Math.max(1, Math.round(h * s));
  const half = [Math.max(1, Math.ceil(sw0 / 2)), Math.max(1, Math.ceil(sh0 / 2))];
  if (plan.ao) rows.push({ name: 'ao', draws: 2, w: half[0], h: half[1], format: 'RGBA8', targets: 2, taps: (p.ao === 'gtao' ? 18 : 4) + 16, where: plan.taa ? 'two passes, then four taps in the reconstruction' : 'two passes, then four taps in the composite' });
  if (plan.contact) rows.push({ name: 'contact', draws: 0, w: 0, h: 0, format: '', targets: 0, taps: 8, where: 'in the occlusion pass' });
  if (plan.shafts) rows.push({ name: 'shafts', draws: 2, w: Math.max(1, Math.ceil(sw0 / p.shaftDiv)), h: Math.max(1, Math.ceil(sh0 / p.shaftDiv)), format: 'R8', targets: 2, taps: p.shaftTaps, where: 'two passes a source, then one tap in the composite' });
  if (plan.taa) {
    // The rebuild: nine scene taps, five of depth, four of last frame's depth, five of the history (a
    // Catmull-Rom read), four of the occlusion. The sharpen: five, and one of depth for the particles.
    rows.push({ name: 'taa', draws: 2, w, h, format: 'R11G11B10F', targets: 3, taps: 27 + 6, where: 'the rebuild into the history (two targets, kept in turn) and the sharpen into the frame with its depth; the scene target is kept twice, in turn, at the scene\'s size' });
    if (sw.sharpen && p.sharpen > 0) rows.push({ name: 'sharpen', draws: 0, w: 0, h: 0, format: '', targets: 0, taps: 5, where: 'in the reconstruction\'s second pass' });
    if (s < 1) rows.push({ name: 'scale', draws: 0, w: sw0, h: sh0, format: 'R11G11B10F + D24S8', targets: 2, taps: 0, where: 'the scene is drawn at this size, no MSAA' });
  }
  if (plan.dof) rows.push({ name: 'dof', draws: plan.blur ? 1 : 2, w: half[0], h: half[1], format: 'RGBA16F', targets: 1, taps: 2 * p.dofTaps + 2, where: 'a gather at half the frame, mixed in by the lens pass (one full-frame draw, shared with the motion blur)' });
  if (plan.blur) rows.push({ name: 'blur', draws: 1, w, h, format: 'R11G11B10F', targets: 1, taps: p.blurTaps + 2, where: 'the lens pass' });
  if (plan.letterbox > 0) rows.push({ name: 'letterbox', draws: 0, w: 0, h: 0, format: '', targets: 0, taps: 0, where: 'in the composite' });
  if (p.mirror !== 'sky' && sw.mirror) rows.push(p.mirror === 'screen'
    ? { name: 'mirror', draws: 0, w: 0, h: 0, format: '', targets: 0, taps: 31, where: 'in the snow shader, on ice pixels only; reads last frame\'s resolved picture and depth' }
    : { name: 'mirror', draws: 0, w: 768, h: 200, format: 'RGBA16F', targets: 1, taps: 1, where: 'in the snow shader, on ice pixels only; the sky is baked again every 3.5 s' });
  if (p.fxaa > 0 && sw.aa && !plan.taa) rows.push({ name: 'aa', draws: 0, w: 0, h: 0, format: '', targets: 0, taps: p.fxaa === 2 ? 25 : 9, where: 'in the composite: five taps a pixel, the rest on edge pixels only' });
  if (p.fringe > 0 && sw.lens && !f.reduced) rows.push({ name: 'lens', draws: 0, w: 0, h: 0, format: '', targets: 0, taps: 2, where: 'in the composite: the frame\'s corners, at speed' });
  if (sw.fit) rows.push({ name: 'fit', draws: 0, w: 0, h: 0, format: '', targets: 0, taps: 0, where: 'the shadow map\'s own pass: ' + p.shadowReach + ' m of reach, no draw added' });
  return rows;
}
