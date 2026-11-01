import { Color, DirectionalLight, Object3D, PCFShadowMap, NoToneMapping, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer } from 'three';
import { ChaosEvent, Mood } from '../sim/chaos';
import { CHUNK_LEN, Course, courseFor } from '../sim/course';
import type { Snap } from '../game/run';
import type { GhostPose } from '../game/ghosts';
import { BEST_HEX, DRIFT_TIER_HEX, FLOW_HEX, IDLE_FEEL, type Beat, type BeatOf, type Feel, type GhostRole } from '../game/beats';
import type { ObstacleKind } from '../sim/course';
import type { Sim, SimEvent } from '../sim/sim';
import type { GhostKind } from '../ui/contract';
import { ChaseCamera, crashPack } from './camera';
import { ChaosVisuals } from './chaos';
import { GHOST_COLORS, GhostVisuals } from './ghosts';
import { placeGraves, type GravePlace } from './graves';
import { LandingAid } from './landing';
import { Life } from './life';
import { applyPalette, bands, setCloudShadows, shared } from './materials';
import { Palette, getPalette, journeyPalette, journeyWeights } from './palette';
import { Particles, Weather } from './particles';
import { BRUSH_REACH_BOUGH, brushPoint } from './brush';
import { PostFX } from './post';
import { Props } from './props';
import { Rider } from './rider';
import { Sky } from './sky';
import { Terrain, TerrainDetail } from './terrain';
import { Trail } from './trails';

// The scene orchestrator: owns the renderer and every visual system, and turns an interpolated
// sim snapshot plus this frame's sim events into a picture.

export type Tier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  tier: Tier;
  pixelRatio: number;
  shadows: boolean;
  shadowSize: number;
  post: boolean;
  bloom: boolean;
  msaa: number;
  particleBudget: number;
  forestDensity: number;
  viewChunks: number;
  terrain: TerrainDetail;
  weather: number;
}

export const QUALITY: Record<Tier, Omit<QualitySettings, 'pixelRatio'> & { maxPixelRatio: number }> = {
  low: { tier: 'low', maxPixelRatio: 1, shadows: false, shadowSize: 512, post: false, bloom: false, msaa: 0, particleBudget: 0.45, forestDensity: 0.45, viewChunks: 6, terrain: { inner: 1.6, row: 3, reach: 60 }, weather: 900 },
  medium: { tier: 'medium', maxPixelRatio: 1.5, shadows: true, shadowSize: 1024, post: true, bloom: true, msaa: 0, particleBudget: 0.75, forestDensity: 0.75, viewChunks: 8, terrain: { inner: 1.1, row: 2.2, reach: 90 }, weather: 1800 },
  high: { tier: 'high', maxPixelRatio: 2, shadows: true, shadowSize: 2048, post: true, bloom: true, msaa: 2, particleBudget: 1, forestDensity: 1, viewChunks: 10, terrain: { inner: 0.85, row: 2, reach: 110 }, weather: 3200 },
};

export function qualityFor(tier: Tier): QualitySettings {
  const q = QUALITY[tier];
  const dpr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);
  return { ...q, pixelRatio: tier === 'low' ? Math.max(0.75, Math.min(1, dpr)) : dpr };
}

export type ViewMode = 'run' | 'title' | 'results';

export interface FrameView {
  mode: ViewMode;
  /** Ghost name tags and crash-marker tags; off while the results panel covers the scene. */
  labels?: boolean;
  snap: Snap;
  dt: number;
  time: number;
  events: SimEvent[];
  collected: Set<number>;
  destroyed: Set<number>;
  sim: Sim | null;
  airTicks: number;
  ghostPoses: Map<number, GhostPose | null>;
  /** Hide the player's rider (title attract mode follows a ghost). */
  playerVisible: boolean;
  /** Viewport rects (CSS px, top-left origin) of visible HUD elements; ghost tags touching one hide. */
  occluders?: ReadonlyArray<{ x0: number; y0: number; x1: number; y1: number }>;
  /** Contract C1: the ghost the HUD's rival pill names (GhostEntry id, gap in metres, positive =
   *  ahead). While it is out of frame the ghost layer points at it from the screen edge. */
  rival?: { id: number; gap: number } | null;
  /** Contract C2: the avalanche mirror's rect (CSS px, top-left origin) from the HUD's own layout,
   *  null while no chase is on. Absent, the renderer falls back to its built-in geometry. */
  mirror?: { x: number; y: number; w: number; h: number } | null;
  /** This frame's named moments from the director (the same list the HUD and audio get; never kept). */
  beats?: readonly Beat[];
  /** This frame's continuous feel from the director; absent reads as IDLE_FEEL. */
  feel?: Feel;
}

const NO_BEATS: readonly Beat[] = [];

const tmpV = new Vector3();
const tmpV2 = new Vector3();
/** Event sparkles start just above the snow (particles.ts sparkle). */
const LOW = new Vector3(0, 0.15, 0);
const MARIGOLD = new Color('#FFD34D');
const GOLD_WHITE = new Color(BEST_HEX);
const BOOST_C = new Color('#FF8A5C');
/** Drift tiers 1 to 3: a ramp inside the player's own vermillion (pale coral, coral, vermillion), so a
 *  drift's heat never borrows the hazard ice blue or the grudge rose. */
const DRIFT_C = DRIFT_TIER_HEX.map((h) => new Color(h));
const FLOW_C = new Color(FLOW_HEX);
/** A snuffed flow's puff off the scarf: cold periwinkle-grey powder. */
const SNUFF_C = new Color('#8E96C6');
const GHOST_C: Record<GhostKind, Color> = {
  pool: new Color(GHOST_COLORS.pool),
  daily: new Color(GHOST_COLORS.daily),
  friend: new Color(GHOST_COLORS.friend),
  you: new Color(GHOST_COLORS.you),
  grudge: new Color(GHOST_COLORS.grudge),
};
/** Near misses: trees drop snow off their boughs, everything else kicks grit off its foot. */
const BOUGHS: ReadonlySet<ObstacleKind> = new Set<ObstacleKind>(['pine', 'blossom', 'charpine']);
const ICY: ReadonlySet<ObstacleKind> = new Set<ObstacleKind>(['spire', 'serac', 'iceblock']);
/** The best band's New ground flare and the 'In the flow' rim pulse, seconds. */
const FLARE_S = 0.6;
const FLOW_PULSE_S = 0.3;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

export class World {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly cam = new ChaseCamera();
  course: Course;
  palette: Palette;
  quality: QualitySettings;
  readonly terrain: Terrain;
  readonly props: Props;
  readonly sky: Sky;
  readonly rider = new Rider();
  readonly particles: Particles;
  readonly weather: Weather;
  readonly trail: Trail;
  readonly ghosts: GhostVisuals;
  readonly chaos: ChaosVisuals;
  readonly landing: LandingAid;
  readonly life: Life;
  readonly post: PostFX;
  readonly sun = new DirectionalLight(0xffffff, 1);
  private sunTarget = new Object3D();
  private mood: Mood = Mood.None;
  private lastChunkRange = '';
  private crouch = 0;
  private perfectPulse = 0;
  private flash = 0;
  private punch = 0;
  /** 1 while riding, easing to 0 through a crash: how much of the speed streaks the post pass gets. */
  private streakK = 1;
  private sprayAcc = 0;
  private wasGrounded = true;
  private width = 1;
  private height = 1;
  private ventAcc = 0;
  private resultsClear = 0;
  private danger = 0;
  readonly onResize: Array<(w: number, h: number) => void> = [];
  private mirrorCam = new PerspectiveCamera(36, 2.8, 0.5, 900);
  private mirrorFade = 0;
  private mirrorAim = new Vector3();
  private mirrorAway = new Vector3();
  private screenProbe = new Vector3();
  /** The rival ghost's chest, handed to the chase camera. */
  private rivalAt = new Vector3();
  /** The chest of the ghost riding past your wreck, and where you fell, handed to the crash orbit. */
  private packAt = new Vector3();
  private fellAt = new Vector3();
  private mirrorTick = 0;
  private lastMirror = { x: 0, y: 0, w: 0, h: 0, w0: -1, h0: -1 };
  private landG = { x: 0, z: 0 };
  private landV = new Vector3();
  /** This frame's feel from the director (IDLE_FEEL outside a run). */
  private feel: Feel = IDLE_FEEL;
  /** The streak this frame's stomp beat carries (0: none): the perfect landing's crater, ring and
   *  burst grow with it. Feel.streak stands in when the beat is not in the same frame. */
  private stompN = 0;
  /** Seconds since 'In the flow' (the rider's rim pulse). */
  private flowPulseT = 9;
  /** Seconds since New ground (the best band's flare), -1 while none. */
  private flareT = -1;
  /** The best band's sim z as last placed, -1 for none: the flare outlives the band being dropped. */
  private bestZ = -1;
  private fxA = new Vector3();
  private fxB = new Vector3();
  private fxV = new Vector3();
  private fxT = new Vector3();
  /** Projected screen position of the rider (for UI callouts). */
  readonly riderScreen = { x: 0, y: 0 };
  /** The sun's journey (palette.ts journeyPalette): the weights last applied, -1 to force a refresh. */
  private journeyKey = -1;
  /** Play-tests: ride the journey at this many metres instead of the run's distance (null: off). */
  journeyAt: number | null = null;

  constructor(container: HTMLElement, seed: number, quality: QualitySettings) {
    this.quality = quality;
    // Contract C10: the rider writes stencil 1 and ghosts never draw over it, so the canvas (where Low
    // renders the scene directly) carries a stencil buffer; it is cleared with depth every frame
    // (autoClearStencil stays on).
    this.renderer = new WebGLRenderer({ antialias: !quality.post, powerPreference: 'high-performance', alpha: false, stencil: true });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.course = courseFor(seed);
    this.palette = getPalette(this.course.biome, Mood.None);
    applyPalette(this.palette);
    this.terrain = new Terrain(this.course, quality.terrain, quality.shadows);
    this.props = new Props(this.course, this.palette, quality.forestDensity, quality.shadows, quality.post && quality.msaa > 0 && this.renderer.capabilities.isWebGL2, quality.tier !== 'low');
    this.sky = new Sky(seed);
    this.sky.setDetail(quality.tier);
    setCloudShadows(quality.tier !== 'low');
    this.sky.setPalette(this.palette);
    this.particles = new Particles(1800);
    this.weather = new Weather(3200);
    this.trail = new Trail(this.course, 900, 'groove');
    this.ghosts = new GhostVisuals(this.course, container);
    this.chaos = new ChaosVisuals(this.course);
    this.landing = new LandingAid(this.course);
    this.life = new Life(this.course, this.palette, quality.tier, quality.forestDensity);
    this.cam.ground = (x, z) => this.course.ground(x, -z);
    const cor = { x: 0, hw: 0 };
    this.cam.corridor = (z) => {
      cor.x = this.course.centerX(-z);
      cor.hw = this.course.halfWidth(-z);
      return cor;
    };
    // The results hero shot never sets its lens among the props: a tree within a few metres fills
    // the frame with a cone (or a dithered one). Only asked while it picks a framing.
    this.cam.blocked = (x, z, r) => {
      for (const o of this.props.root.children) {
        const im = o as unknown as { isInstancedMesh?: boolean; count: number; instanceMatrix: { array: ArrayLike<number> } };
        // (A km arch's instance sits on the corridor's middle, its posts far out: it blocks nothing.)
        if (!im.isInstancedMesh || o.userData.noBlock) continue;
        const a = im.instanceMatrix.array;
        for (let i = 0; i < im.count; i++) {
          const dx = a[i * 16 + 12] - x;
          const dz = a[i * 16 + 14] - z;
          if (dx * dx + dz * dz < r * r) return true;
        }
      }
      return false;
    };
    this.rider.eye = this.cam.camera;
    // An airborne sled's contact shadow is kept inside the chase camera's frame (landing.ts).
    this.landing.eye = this.cam.camera;
    // A wreck under the trees slides out to a clearing as it settles, where the hero shot can see it.
    this.rider.blocked = this.cam.blocked;

    this.scene.add(
      this.sky.root,
      this.terrain.root,
      this.props.root,
      this.trail.mesh,
      this.landing.root,
      this.ghosts.root,
      this.chaos.root,
      this.life.root,
      ...this.rider.objects,
      ...this.particles.objects,
      this.weather.points,
    );
    this.sun.castShadow = quality.shadows;
    this.configureShadow();
    this.scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;

    const canHalf = this.renderer.capabilities.isWebGL2 && (this.renderer.extensions.has('EXT_color_buffer_float') || this.renderer.extensions.has('EXT_color_buffer_half_float'));
    this.post = new PostFX(this.renderer, 2, 2, canHalf ? quality.msaa : 0, quality.tier === 'high' ? 5 : 4);
    this.post.enabled = quality.post && canHalf;
    this.post.bloomEnabled = quality.bloom;
    this.post.setGrade({ ...this.palette.grade, bloom: this.palette.bloom });
    this.applyWeather();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.prewarm();
  }

  /** Compiles every material in the scene now, the hidden ones too, into the target the scene pass
   *  draws into. The landing ring first draws on the run's first jump and the stomp crater on its first
   *  perfect landing: compiled there, each stalled the frame of the moment it was meant to sell. */
  private prewarm(): void {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    r.setRenderTarget(this.post.sceneTarget);
    r.compile(this.scene, this.cam.camera);
    r.setRenderTarget(prev);
  }

  private configureShadow(): void {
    const s = this.sun.shadow;
    s.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
    const r = this.quality.tier === 'high' ? 34 : 26;
    s.camera.left = -r;
    s.camera.right = r;
    s.camera.top = r;
    s.camera.bottom = -r;
    s.camera.near = 1;
    s.camera.far = 220;
    s.bias = -0.0006;
    s.normalBias = 0.04;
    s.radius = 2;
    s.camera.updateProjectionMatrix();
    // The snow filters its own soft shadows (materials.ts snowShadow) in metres, not texels.
    shared.uShadowScale.value.set(this.quality.shadowSize / (2 * r), 1 / (s.camera.far - s.camera.near));
    if (s.map) {
      s.map.dispose();
      s.map = null;
    }
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.cam.setAspect(w / h);
    const pr = this.renderer.getPixelRatio();
    const px = h * pr;
    this.particles.setQuality(this.quality.particleBudget, px);
    this.weather.setScale(px);
    this.post.setSize(Math.max(1, Math.floor(w * pr)), Math.max(1, Math.floor(h * pr)));
    for (const cb of this.onResize) cb(w, h);
  }

  get size(): { w: number; h: number } {
    return { w: this.width, h: this.height };
  }

  setQuality(q: QualitySettings): void {
    const shadowsChanged = q.shadows !== this.quality.shadows || q.shadowSize !== this.quality.shadowSize;
    this.quality = q;
    this.renderer.setPixelRatio(q.pixelRatio);
    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;
    if (shadowsChanged) this.configureShadow();
    this.terrain.setDetail(q.terrain, q.shadows);
    this.props.setQuality(q.forestDensity, q.shadows, q.post && q.msaa > 0 && this.renderer.capabilities.isWebGL2, q.tier !== 'low');
    const canHalf = this.renderer.capabilities.isWebGL2;
    this.post.enabled = q.post && canHalf;
    this.post.bloomEnabled = q.bloom;
    this.post.setMsaa(q.msaa);
    this.post.shaftTaps = q.tier === 'high' ? 10 : 6;
    this.sky.setDetail(q.tier);
    this.life.setQuality(q.tier, q.forestDensity);
    setCloudShadows(q.tier !== 'low');
    this.applyWeather();
    this.lastChunkRange = '';
    this.resize();
    // Materials recompile when the shadow define changes (the hidden ones now, not on first use).
    this.scene.traverse((o) => {
      const m = (o as { material?: { needsUpdate: boolean } }).material;
      if (m) m.needsUpdate = true;
    });
    this.prewarm();
  }

  setCourse(seed: number): void {
    const c = courseFor(seed);
    if (c === this.course) return;
    this.course = c;
    // Another mountain's graveyards never stand on this one (the next run sets its own).
    if (this.graves.length) this.setGraveyards([]);
    this.terrain.setCourse(c);
    this.palette = getPalette(c.biome, this.mood);
    applyPalette(this.palette);
    this.props.setCourse(c, this.palette);
    this.sky.setPalette(this.palette);
    this.ghosts.setGlow(this.palette.ghostGlow);
    this.trail.setCourse(c);
    this.ghosts.setCourse(c);
    this.chaos.setCourse(c);
    this.landing.setCourse(c);
    this.life.setCourse(c, this.palette, this.mood);
    this.post.setGrade({ ...this.palette.grade, bloom: this.palette.bloom });
    this.applyWeather();
    this.lastChunkRange = '';
    this.journeyKey = -1;
  }

  setMood(mood: Mood): void {
    const same = mood === this.mood;
    this.mood = mood;
    this.palette = getPalette(this.course.biome, mood);
    applyPalette(this.palette);
    // The props bake the palette into their meshes, and it is the same for the same mountain and
    // mood (setCourse builds them for the mood in force): the title straight after startup and a
    // plain run's start skip a full rebuild (at startup it repeated the constructor's whole build).
    if (!same) this.props.setCourse(this.course, this.palette);
    this.sky.setPalette(this.palette);
    this.life.setPalette(this.palette, mood);
    this.ghosts.setGlow(this.palette.ghostGlow);
    this.post.setGrade({ ...this.palette.grade, bloom: this.palette.bloom });
    this.applyWeather();
    this.lastChunkRange = '';
    this.journeyKey = -1;
  }

  /** The sun's journey over a Clear Skies run: golden at the start, deep alpenglow by about 2 km, blue
   *  hour from about 3.5 km, keyed off the distance ridden (the title reel stays at its start). It is
   *  re-blended into the live palette only while the weights move, a few times a second at most; the
   *  props keep their baked colours and take the light through the shared uniforms. Chaos moods keep
   *  their own palette. */
  private journey(metres: number): void {
    if (this.mood !== Mood.None) return;
    const w = journeyWeights(metres);
    const key = Math.round(w.alpenglow * 400) + Math.round(w.blue * 400) * 1000;
    if (key === this.journeyKey) return;
    this.journeyKey = key;
    journeyPalette(this.course.biome, metres, this.palette);
    applyPalette(this.palette);
    this.sky.setPalette(this.palette);
    this.ghosts.setGlow(this.palette.ghostGlow);
    this.post.setGrade({ ...this.palette.grade, bloom: this.palette.bloom });
  }

  setGhostField(list: Array<{ id: number; name: string; kind: GhostKind; role?: GhostRole; nemesis?: boolean; sled?: number }>): void {
    this.ghosts.setField(list);
  }

  /** Graveyards (stretch; a contract amendment): this run's spots where several pool ghosts fell (the
   *  director's clusters, sim z, with a name and how many fell). Each gets a cairn on the bank beside
   *  it (Medium and High; Low keeps no mesh), on the side its hash picks, 1.4 m outside the corridor so
   *  it is never in the line. Call it at each run's start, after setCourse; an empty list clears them.
   *  The placed spots go on to the ghost layer for their tags ('Widow's Bend' over '4 ghosts fell
   *  here'), which show on every tier. */
  setGraveyards(list: ReadonlyArray<{ z: number; name: string; fell: number }>): void {
    // (The tag hangs just over the marker stake's top; on Low, with no cairn, it marks the same spot.)
    const placed = placeGraves(this.course, list);
    this.graves = placed;
    this.props.setGraveyards(placed);
    this.ghosts.setGraveyards(placed);
  }

  /** The cairns placed this run (for the ghost layer's tags and play-tests). */
  graves: ReadonlyArray<GravePlace> = [];

  /** Clears held feel (the camera's freeze and jolts; the world's rim pulse and band flare) on revive
   *  and at a run's start. */
  resetFeel(): void {
    this.cam.resetFeel();
    this.flowPulseT = 9;
    this.flareT = -1;
    this.bestZ = -1;
    this.rider.setFlow(0, 0);
  }

  /** The sled shop's previews (src/render/portrait.ts): the real sled mesh, with the rider seated
   *  for the large preview, drawn once by this renderer through a small offscreen scene in the toon
   *  lighting, as an image URL. Null when it cannot draw (a lost context). Loaded on first use. */
  sledPortrait(id: number, seated: boolean): Promise<string | null> {
    return import('./portrait').then((m) => m.sledPortrait(this.renderer, id, seated));
  }

  private applyWeather(): void {
    const p = this.palette;
    const cap = this.quality.weather / 3200;
    if (p.windStreaks > 0) {
      // A hard crosswind: streaks race sideways across the frame rather than falling.
      this.weather.configure({ density: cap, kind: 0, color: new Color('#FFFFFF'), streak: 0.8, size: 0.09, alpha: 0.85, fall: new Vector3(16, -3, 2), additive: false });
    } else if (p.petals > 0) {
      this.weather.configure({ density: cap * 0.35, kind: 1, color: new Color('#FFB3CC'), streak: 0, size: 0.13, alpha: 0.9, fall: new Vector3(1.4, -1.2, 0.6), additive: false });
    } else if (p.embers > 0) {
      this.weather.configure({ density: cap * 0.22, kind: 2, color: new Color('#FF8A40'), streak: 0, size: 0.08, alpha: 0.9, fall: new Vector3(0.6, 1.1, 0.4), additive: true });
    } else if (p.wisps > 0) {
      this.weather.configure({ density: cap * 0.12, kind: 3, color: p.ghost, streak: 0, size: 0.18, alpha: 0.7, fall: new Vector3(0.4, 0.3, 0.2), additive: true });
    } else {
      this.weather.configure({ density: cap * p.snowfall, kind: 0, color: new Color('#FFFFFF'), streak: 0, size: 0.08, alpha: 0.85, fall: new Vector3(0.5, -1.6, 0.4), additive: false });
    }
  }

  /** Reset per-run visuals at the start of a run. */
  beginRun(snap: Snap, event: ChaosEvent, sled = 0): void {
    this.rider.setSled(sled);
    this.trail.clear();
    this.particles.clear();
    this.ghosts.resetRun();
    this.chaos.begin(event);
    tmpV.set(snap.x, snap.y, -snap.z);
    this.rider.reset(tmpV);
    this.cam.mode = 'chase';
    this.crouch = 0;
    this.wasGrounded = true;
    this.flash = 0;
    this.punch = 0;
    this.streakK = 1;
    this.flowPulseT = 9;
    this.flareT = -1;
    this.bestZ = -1;
    this.updateChunks(snap.z, true);
  }

  /** Snap the chase camera behind the sled (after a revive or a hard cut). */
  snapCamera(snap: Snap): void {
    tmpV.set(snap.x, snap.y, -snap.z);
    const dir = new Vector3(Math.sin(snap.heading), 0, -Math.cos(snap.heading));
    this.cam.snap({ pos: tmpV, dir, speed: snap.speed, steer: 0, airborne: false, boost: 0 });
  }

  private updateChunks(z: number, prime = false): void {
    const cur = Math.max(0, Math.floor(z / CHUNK_LEN));
    // Two chunks behind the start too, so the title camera never sees the edge of the world.
    const from = cur === 0 ? -2 : cur - 1;
    const to = cur + this.quality.viewChunks;
    if (prime) this.terrain.prime(from, Math.min(to, cur + 4));
    this.terrain.update(from, to);
    const key = `${from}:${to}`;
    if (key !== this.lastChunkRange) {
      this.lastChunkRange = key;
      this.props.markDirty();
    }
  }

  frame(v: FrameView): void {
    const s = v.snap;
    const dt = v.dt;
    shared.uTime.value = v.time;
    this.journey(this.journeyAt ?? (v.mode === 'title' ? 0 : Math.max(0, s.z)));
    this.updateChunks(s.z);
    const ci = Math.floor(s.z / CHUNK_LEN);
    this.props.update(ci <= 0 ? -2 : ci - 1, ci + this.quality.viewChunks, v.collected, v.destroyed, ci);

    const pos = tmpV.set(s.x, s.y, -s.z);
    const vel = tmpV2.set(s.vx, s.vy, -s.vz);
    const g = { x: 0, z: 0 };
    this.course.gradient(s.x, s.z, g);
    const normal = new Vector3(-g.x, 1, g.z).normalize();
    this.crouch += ((s.action ? 1 : 0) - this.crouch) * Math.min(1, dt * 12);
    this.perfectPulse = Math.max(0, this.perfectPulse - dt * 3);
    this.flash = Math.max(0, this.flash - dt * 4);
    this.punch = Math.max(0, this.punch - dt * 2.5);

    const beats = v.beats ?? NO_BEATS;
    const feel = v.feel ?? IDLE_FEEL;
    this.feel = feel;
    // A stomp's style beat comes before its land event's reaction: read the streak it carries first.
    this.stompN = 0;
    for (const b of beats) if (b.type === 'stomp') this.stompN = Math.max(this.stompN, b.streak);
    if (v.mode === 'run') for (const e of v.events) this.onEvent(e, s);
    // Named moments after the raw events: the camera, the ghost layer, then the world's own.
    this.cam.beats(beats, feel);
    this.ghosts.beats(beats, feel);
    if (v.mode === 'run') this.onBeats(beats, v);

    // Rider. Earned flow burns on it (uniforms only); 'In the flow' pulses its rim to full for 0.3 s
    // (under reduced motion a softer fade in and out instead of the flash).
    this.flowPulseT += dt;
    const pt = this.flowPulseT;
    const pulse = pt >= FLOW_PULSE_S ? 0 : feel.reduced ? 0.6 * Math.sin((Math.PI * pt) / FLOW_PULSE_S) : pt < 0.05 ? pt / 0.05 : 1 - smooth01((pt - 0.05) / (FLOW_PULSE_S - 0.05));
    // (Only while riding: the crash owns its own beat, and the title reel's hero has earned nothing.)
    const riding = v.mode === 'run' && !this.rider.crashing;
    this.rider.setFlow(riding ? feel.flow : 0, riding ? Math.max(feel.flowPulse, pulse) : 0);
    const showRider = v.playerVisible;
    this.rider.setVisible(showRider);
    if (showRider && !this.rider.crashing) {
      this.rider.update(
        {
          pos,
          heading: s.heading,
          airYaw: s.airYaw,
          airPitch: s.airPitch,
          normal,
          lean: s.lean,
          crouch: this.crouch,
          drifting: s.drifting,
          driftDir: s.driftDir,
          airborne: !s.grounded,
          speed: s.speed,
          wobble: s.wobble,
          vel,
          perfectPulse: this.perfectPulse,
        },
        dt,
        v.time,
      );
    }
    let focus = pos.clone();
    // Contract C4: in the results hero shot the wreck sits up and shows the lens its profile.
    this.rider.restView = this.cam.mode === 'hero' ? this.cam.heroAz : null;
    if (this.rider.crashing) {
      const p = this.rider.updateCrash(dt, this.course);
      if (p) focus = p.clone();
      this.rider.update({ pos, heading: 0, airYaw: 0, airPitch: 0, normal, lean: 0, crouch: 0, drifting: false, driftDir: 0, airborne: true, speed: 0, wobble: 0, vel, perfectPulse: 0 }, dt, v.time);
    }

    // Trail and spray.
    if (showRider && !s.crashed && v.mode !== 'results') {
      if (s.grounded) {
        const depth = Math.max(0.12, s.carve);
        // The groove widens with carve depth; a drift scrubs a wide fan.
        const width = s.drifting ? 1.0 + Math.abs(s.slip) * 1.3 : 0.42 + s.carve * 0.72;
        this.trail.add(s.x, s.z, width, depth, v.time);
        let sprayAmt = s.drifting ? 1 : Math.max(0, s.carve - 0.35) * 1.4 + (s.speed > 30 ? 0.15 : 0);
        let toward = s.drifting ? -s.driftDir : -Math.sign(s.steer || 1);
        if (v.mode === 'title' && s.speed > 8) {
          // The title reel's hero always throws a light plume off the runner nearer the lens, so the key
          // art carries spray catching the light (ART.md section 11) even on a straight glide.
          sprayAmt = Math.max(sprayAmt, 0.6);
          const c = this.cam.camera.position;
          toward = (c.x - pos.x) * Math.cos(s.heading) + (c.z - pos.z) * Math.sin(s.heading) >= 0 ? 1 : -1;
        }
        this.sprayAcc += sprayAmt * dt * 60 * 1.6;
        if (this.sprayAcc >= 1) {
          // Spray rides the slope: its carrier follows the ground under the sled (the title reel's
          // snapshot carries no vertical speed, and spray launched level floated off into the sky).
          // A held drift heats it from the first tier on, inside the player's vermillion (Feel's charge
          // and tier), and at tier 3 a fifth of its grains are hot motes.
          const tier = s.drifting && v.mode === 'run' ? Math.min(3, feel.driftTier) : 0;
          const heat = tier > 0 ? DRIFT_C[tier - 1] : null;
          this.particles.spray(pos, s.heading, toward, this.landV.set(s.vx, g.x * s.vx + g.z * s.vz, -s.vz), Math.min(2, this.sprayAcc), s.onIce, heat, feel.driftCharge, tier >= 3 ? 0.2 : 0);
          this.sprayAcc = 0;
        }
      } else if (this.wasGrounded) this.trail.lift();
      this.wasGrounded = s.grounded;
    }
    this.trail.flush();

    // Vents breathe steam.
    this.ventAcc += dt;
    if (this.ventAcc > 0.12) {
      this.ventAcc = 0;
      for (let k = ci; k <= ci + 2; k++) {
        if (k < 0) continue;
        for (const vt of this.course.zones(k).vents) {
          this.particles.steamAt(vt.x, this.course.ground(vt.x, vt.z), -vt.z, 0.6);
        }
      }
    }

    shared.uFocus.value.copy(focus).add(new Vector3(0, 0.9, 0));
    // Lantern ahead of the sled at night.
    const fwd = new Vector3(Math.sin(s.heading), 0, -Math.cos(s.heading));
    shared.uLanternPos.value.copy(focus).addScaledVector(fwd, 5).add(new Vector3(0, 1.8, 0));
    // The lantern's pool lies on the snow just under the sled's prow, shrinking and dimming as the sled
    // rises off it (materials.ts lanternPool), so it never floats detached under an airborne rider.
    if (shared.uLantern.value > 0) {
      const lx = focus.x + fwd.x * 0.55;
      const lz = focus.z + fwd.z * 0.55;
      const lg = this.course.ground(lx, -lz);
      const lift = Math.max(0, focus.y - this.course.ground(focus.x, -focus.z));
      const lk = Math.max(0, Math.min(1, (lift - 0.3) / 3.2));
      shared.uLanternLow.value.set(lx, lg, lz, 1 - lk * lk * (3 - 2 * lk));
    }

    // Camera.
    const dir = s.speed > 1 ? new Vector3(s.vx, 0, -s.vz).normalize() : fwd;
    // Contract C4: a wide landscape results screen settles into a hero shot of the wreck beside the
    // panel. Contract C6: on a portrait screen the card leaves the top ~28% (plus the safe-area
    // inset) open, and the hero shot centres the wreck in that band. Narrow landscape screens keep
    // the drift around it under a full-screen panel.
    const hero = v.mode === 'results' && ((this.width > 900 && this.width > this.height) || this.width < this.height);
    if (hero && this.width < this.height) this.cam.heroBand = Math.min(0.4, 0.28 + this.ghosts.safeTop / this.height);
    this.cam.mode = v.mode === 'title' ? 'orbit' : hero ? 'hero' : this.rider.crashing ? 'crash' : 'chase';
    let chaosShake = 0;
    this.chaos.detail = this.quality.tier;
    if (v.sim) chaosShake = this.chaos.update(v.sim, v.time, this.cam.camera.position);
    // Reduced motion: no rumbles (the chaos shake here, the avalanche's below).
    if (chaosShake > 0 && !feel.reduced) this.cam.shake(chaosShake * dt * 4);
    if (v.sim && v.sim.dyn.avalanche.phase === 2 && v.mode === 'run') {
      // The chase in the main view, so it reads without the mirror: from about 60 m powder and
      // debris from the wall blast forward past the lens, a trickle at first and thickening as it
      // gains, and from about 50 m the camera rumbles.
      const gap = v.sim.s.z - v.sim.dyn.avalanche.z;
      const close = Math.max(0, Math.min(1, 1 - (gap - 6) / 54));
      if (close > 0) this.particles.rush(this.cam.camera.position, dir, s.speed, Math.min(1.3, 0.12 + close * close * 1.2), g.x * dir.x - g.z * dir.z);
      // The rumble: short kicks on a 6 Hz clock that the camera's own decay turns into a light
      // jitter, gentle at first and harder as the gap closes (each kick decays before the next, so
      // it never builds up).
      if (!feel.reduced && gap < 50 && Math.floor(v.time * 6) !== Math.floor((v.time - dt) * 6)) this.cam.shake(0.08 + 0.28 * Math.pow(1 - Math.max(0, gap) / 50, 0.7));
    }
    const mate = v.mode === 'title' ? this.cam.pickMate(s, v.ghostPoses.values()) : null;
    // The ghost the rival pill names, which the chase eases into the frame when it is close.
    const rp = v.mode === 'run' && v.rival ? v.ghostPoses.get(v.rival.id) : null;
    const rival = rp && !rp.done ? this.rivalAt.set(rp.x, rp.y + 0.8, -rp.z) : null;
    // Through the crash, where you fell and the ghost riding past it (from CRASH_PACK_NEAR_M behind to
    // a few metres past), which the crash orbit frames with the wreck.
    const fallen = v.mode === 'run' && v.sim && this.rider.crashing ? v.sim.s : null;
    const pack = fallen ? crashPack(v.ghostPoses, fallen.x, fallen.z, this.packAt) : null;
    const fell = fallen ? this.fellAt.set(fallen.x, fallen.y, -fallen.z) : null;
    // The run-start reveal: the chase rides high and back for about 2 s, then pushes in.
    const runK = v.mode === 'run' && v.sim ? Math.max(0, Math.min(1, (v.sim.tick / 60 - 1.8) / 1.6)) : 1;
    const intro = 1 - runK * runK * (3 - 2 * runK);
    this.cam.sun = this.palette.diskDir;
    // A run's drift leans the horizon into it with its slip (the camera's roll, off under reduced
    // motion); the title reel's snapshot carries no drift direction or slip, so it rolls with steer.
    const drifting = v.mode === 'run' && s.drifting;
    this.cam.update({ pos: focus, dir, speed: s.speed, steer: s.steer, airborne: !s.grounded, boost: s.boostGlow, drifting, driftDir: s.driftDir, slip: s.slip, mate, rival, intro, pack, fell }, dt);

    // Ghosts, landing ring.
    this.ghosts.labels = v.labels !== false;
    this.ghosts.reel = v.mode === 'title';
    this.ghosts.update(v.ghostPoses, this.cam.camera, this.width, this.height, v.time, focus, (p, c) => this.particles.sparkle(p, c, 16, 2.2, 0.55, 0.2, null, 0.6), v.occluders, v.rival);
    this.landing.streak = v.mode === 'run' ? feel.streak : 0;
    this.landing.update(s, v.sim ? v.sim.gravity : 9.81, v.airTicks, dt, showRider && v.mode === 'run' && !this.rider.crashing);
    this.updateBands(v, feel, s, dt);
    // While the results frame the wreck, gifts within about 3 m of it clear away (the gift shader's
    // CLEAR_FOCUS path), shrinking over a moment rather than popping.
    this.resultsClear += ((v.mode === 'results' ? 1 : 0) - this.resultsClear) * Math.min(1, dt * 5);
    shared.uFocusClear.value = Math.max(shared.uFocusClear.value, this.resultsClear);
    // The same ease drives the results mode of the props: hazards dissolve further from the lens and
    // gifts cut by the frame edge shrink away (materials.ts).
    shared.uResults.value = this.resultsClear;
    // The title reel keeps hazards out of the band right behind its hero (materials.ts uTitleClear).
    shared.uTitleClear.value = v.mode === 'title' ? 1 : 0;
    this.particles.update(dt);
    this.life.update(s.x, s.z, v.time, dt, v.mode === 'run' ? beats : NO_BEATS, this.cam.camera.position, dir);

    // Sun and shadow follow the focus.
    this.sunTarget.position.copy(focus);
    // Shadows fall from their own, lower light across the slope (palette.ts shadowFrom), so they
    // rake across the run; the snow is still shaded by the lifted key light (uSunDir).
    this.sun.position.copy(focus).addScaledVector(this.palette.shadowDir, 90);
    this.sunTarget.updateMatrixWorld();
    this.sky.follow(this.cam.camera.position);
    this.weather.follow(this.cam.camera.position);

    // Rider screen position for UI callouts.
    const sp = this.screenProbe.copy(focus).setY(focus.y + 1.2).project(this.cam.camera);
    this.riderScreen.x = (sp.x * 0.5 + 0.5) * this.width;
    this.riderScreen.y = (-sp.y * 0.5 + 0.5) * this.height;

    const pp = this.post.params;
    // A phone's tall view looks down on a broad sheet of near snow, which the bloom and the radial
    // speed smear flattened to white (its shadow pattern gone), and the results hero shot is a calm,
    // close frame where bloom washed the face and scarf out: both run with less of either.
    const tall = this.width < this.height;
    // Reduced motion halves the speed streaks and the flash and drops the punch (FOV breathing stays).
    // A crash lets the speed go: the streaks die away on the scaled clock (the held frame keeps them a
    // moment, then they thin through the slow motion), so the pack shot after it is a still wreck.
    this.streakK += ((v.mode === 'run' && !this.rider.crashing && !s.crashed ? 1 : 0) - this.streakK) * Math.min(1, dt * 6);
    pp.speed = v.mode === 'run' ? Math.max(0, Math.min(1, (s.speed - 28) / 16)) * (tall ? 0.6 : 1) * (feel.reduced ? 0.5 : 1) * this.streakK : 0;
    pp.streakFoot = tall ? 0 : 0.12;
    pp.bloomScale = v.mode === 'results' ? 0.55 : tall ? 0.7 : 1;
    // The cool darkening at the foot of the frame holds the near snow's form there too (a bright,
    // smooth slope right under the results lens read as an overexposed smear).
    pp.footScale = v.mode === 'results' ? 1.8 : tall ? 1.3 : 1;
    pp.punch = feel.reduced ? 0 : this.punch;
    pp.flash = this.flash * (feel.reduced ? 0.5 : 1);
    pp.time = v.time;
    // The results hero shot is a calm frame: the danger grade lets go once the run is over. It
    // builds from about 60 m and eases in and out, so the wall arriving or a revive never pops it.
    const dangerTo = v.mode === 'run' && v.sim && v.sim.dyn.avalanche.phase === 2 ? Math.max(0, Math.min(1, 1 - (v.sim.s.z - v.sim.dyn.avalanche.z - 4) / 56)) : 0;
    this.danger += (dangerTo - this.danger) * Math.min(1, dt * 3);
    pp.danger = this.danger < 0.002 ? 0 : this.danger;
    // The powder cloud keeps clear of the rider (post.ts), in uv with the origin bottom left.
    pp.riderX = this.riderScreen.x / this.width;
    pp.riderY = 1 - this.riderScreen.y / this.height;
    if (pp.danger > 0) {
      // Its crest stops under the sled, and its powder streams toward the course's vanishing point.
      const fp = this.screenProbe.copy(focus).project(this.cam.camera);
      pp.feetY = fp.y * 0.5 + 0.5;
      const ax = focus.x + dir.x * 150;
      const az = focus.z + dir.z * 150;
      const vp = this.screenProbe.set(ax, this.course.ground(ax, -az), az).project(this.cam.camera);
      if (vp.z < 1) {
        pp.vpX = Math.max(-0.2, Math.min(1.2, vp.x * 0.5 + 0.5));
        pp.vpY = Math.max(0.5, Math.min(1.1, vp.y * 0.5 + 0.5));
      }
    }
    this.post.render(this.scene, this.cam.camera);
    this.renderMirror(v, focus, dir, dt);
  }

  /** Rear-view mirror while an avalanche is chasing you: the threat is behind the chase camera,
   *  so a framed inset sitting on the HUD's danger meter looks back up the slope at the wall.
   *  Medium and High only, for the whole chase: the HUD shows the unit's glass from the chase's first
   *  frame, and a clean rider holds the wall at 70 to 90 m (it speeds up past 70), so an inset kept to
   *  within 75 m left that glass empty for most of a good run (decision 33: never an empty frame). */
  private renderMirror(v: FrameView, focus: Vector3, dir: Vector3, dt: number): void {
    const sim = v.sim;
    const gap = sim ? sim.s.z - sim.dyn.avalanche.z : Infinity;
    const want = v.mode === 'run' && sim && sim.dyn.avalanche.phase === 2 && this.quality.tier !== 'low' ? 1 : 0;
    this.mirrorFade += (want - this.mirrorFade) * Math.min(1, dt * 6);
    if (this.mirrorFade < 0.05 || !sim) return;
    // Contract C2 with the HUD: the mirror and the meter are one unit, and the HUD lays it out (it
    // hangs top-centre in the sky above the rider) and hands over the mirror's rect, top-left origin.
    // It drops a few pixels into place as it fades in. Without a rect the old geometry stands: the
    // mirror resting on a bottom meter in landscape, under the race row in portrait.
    const w = this.width;
    const h = this.height;
    // The last rect the HUD handed over stands in for a frame without one (a resize drops it), so the
    // inset never jumps to the fallback spot mid-chase.
    const last = this.lastMirror;
    if (v.mirror) {
      last.x = v.mirror.x; last.y = v.mirror.y; last.w = v.mirror.w; last.h = v.mirror.h;
      last.w0 = w; last.h0 = h;
    }
    const rect = v.mirror ?? (last.w0 === w && last.h0 === h ? last : null);
    let mw: number;
    let mh: number;
    let x: number;
    let y: number;
    if (rect) {
      mw = Math.max(1, Math.round(rect.w));
      mh = Math.max(1, Math.round(rect.h));
      x = Math.round(rect.x);
      // WebGL viewports count from the bottom left.
      y = h - Math.round(rect.y) - mh + Math.round((1 - this.mirrorFade) * 8);
    } else {
      const portrait = w < h;
      mw = Math.round(portrait ? Math.min(0.36 * w, 170) : Math.min(0.22 * w, 290));
      mh = Math.round(mw * 0.4);
      x = Math.round((w - mw) / 2);
      y = (portrait ? h - Math.round(0.14 * h) - mh : 56) - Math.round((1 - this.mirrorFade) * 8);
    }
    // As the wall closes in, the mirror's eye backs off down the slope, rises and widens a little,
    // so the sunlit crest stays in the picture instead of a close-up of the churn at its foot.
    const near = Math.max(0, Math.min(1, 1 - gap / 40));
    this.mirrorCam.aspect = mw / mh;
    this.mirrorCam.fov = 36 + near * 12;
    this.mirrorCam.updateProjectionMatrix();
    const c = sim.course;
    const az = sim.dyn.avalanche.z;
    const ax = c.centerX(az);
    // The eye sits on the line from the wall through the rider, just past the rider, so the wall stays
    // in the picture (over the rider's shoulder) even while the sled is carving across the slope.
    const away = this.mirrorAway.set(focus.x - ax, 0, focus.z + az);
    if (away.lengthSq() > 1) away.normalize();
    else away.copy(dir);
    this.mirrorCam.position.copy(focus).addScaledVector(away, 1.5 + near * 5);
    this.mirrorCam.position.y += 2.4 + near * 2.5;
    // Aim low on the wall so its foot, its face and the crest of the cloud all fit (the wall stands
    // about 16 m tall, with dust plumes thrown higher still).
    this.mirrorCam.lookAt(this.mirrorAim.set(ax, c.ground(ax, az) + 7.5 + near * 2, -az));
    // The scene behind is re-rendered at 30 Hz (the inset reads the same and costs half); the framed
    // composite still draws every frame. Only the props in the chunks behind the player are drawn.
    this.mirrorTick = (this.mirrorTick + 1) % 2;
    const refresh = this.mirrorTick === 0;
    const r = this.renderer;
    const autoShadow = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    if (refresh) this.props.nearOnly(true);
    // (The ambient life stays out of the mirror: it costs draws and the inset is about the wall.)
    this.life.root.visible = false;
    this.post.renderInset(this.scene, this.mirrorCam, x, y, mw, mh, this.mirrorFade, Math.max(0, Math.min(1, 1 - gap / 50)), refresh);
    if (refresh) this.props.nearOnly(false);
    this.life.root.visible = true;
    r.shadowMap.autoUpdate = autoShadow;
  }

  /** The world's own reactions to named moments: motes in the two existing particle layers (budget
   *  scaled, so Low stays inside its caps), the post punch and the rider's rim pulse. The camera's
   *  kicks and jolts are the chase camera's (cam.beats). */
  private onBeats(beats: readonly Beat[], v: FrameView): void {
    if (beats.length === 0) return;
    const s = v.snap;
    for (const b of beats) {
      switch (b.type) {
        case 'nearMiss':
          this.nearMissFx(b, s);
          break;
        case 'driftRelease':
          this.releaseFx(b, s);
          break;
        case 'flow':
          this.flowFx(b.phase, s);
          break;
        case 'newGround':
          this.newGroundFx(b, s);
          break;
        case 'ghostTrick':
          if (b.quality === 'perfect') this.ghostStompFx(b, v);
          break;
        default:
          break;
      }
    }
  }

  /** The sled's velocity in three.js space, its vertical part following the slope under it: the
   *  carrier that keeps a burst riding along with the sled. */
  private carrier(s: Snap): Vector3 {
    this.course.gradient(s.x, s.z, this.landG);
    return this.fxV.set(s.vx, this.landG.x * s.vx + this.landG.z * s.vz, -s.vz);
  }

  /** A near miss shakes the hazard you shaved: snow drops off a tree's boughs, anything else kicks grit
   *  and powder off its foot. The sim resolves a near miss once the sled is a radius and 1.5 m past the
   *  hazard, so by then it stands beside or behind the chase lens (snow thrown at its own edge sat at
   *  the top of a desktop frame and off the side of a phone's): the burst is thrown at the rider's side
   *  on the side you shaved, a little ahead and inside the frame (brush.ts). Same powder layer (no
   *  draw call, no material), the count scaled by the tier's particle budget like every burst. A
   *  whisker throws the full amount, an ordinary near miss about two thirds. Shaved in the air, a
   *  tree's snow comes off at the rider's height up to its crown; grit stays on the snow; a rider
   *  well clear over either throws none (brush.ts). */
  private nearMissFx(b: BeatOf<'nearMiss'>, s: Snap): void {
    const bough = BOUGHS.has(b.obs);
    const k = b.grade === 'whisker' ? 1 : 0.68;
    if (brushPoint(s, b.x, b.z, this.groundAt, this.cam.camera, this.fxB, this.fxT, bough ? BRUSH_REACH_BOUGH : 0) === 0) return;
    this.particles.brush(this.fxB, this.fxT, this.carrier(s), bough, ICY.has(b.obs), (bough ? 22 : 18) * k);
  }

  /** The snow's height at a sim (x, z), for brush.ts. */
  private readonly groundAt = (x: number, z: number): number => this.course.ground(x, z);

  /** A drift released: the post punch by tier (0.6, 0.8, 1; none under reduced motion), and at the
   *  runners tier 2's coral motes, or tier 3's crack: a ring of vermillion motes (every third
   *  snow-white) skimming out flat and a blast of powder. The kick and the jolt are the camera's. */
  private releaseFx(b: BeatOf<'driftRelease'>, s: Snap): void {
    const tier = Math.max(1, Math.min(3, b.tier));
    // (The punch is dropped at the post pass under reduced motion.)
    this.punch = Math.max(this.punch, tier === 3 ? 1 : tier === 2 ? 0.8 : 0.6);
    if (tier < 2) return;
    const vel = this.carrier(s);
    const at = this.fxA.set(s.x, s.y, -s.z);
    if (tier === 2) {
      this.particles.sparkle(this.fxB.copy(at).add(LOW), DRIFT_C[1], 12, 2.6, 0.42, 0.19, vel);
      return;
    }
    this.particles.ring(this.fxB.copy(at).add(LOW), DRIFT_C[2], 22, 5.6, vel, 3, 1.45, 0.48, 0.21);
    // (burst() throws count x power x 1.6: about 30 grains and billows before the budget.)
    this.particles.burst(at, 1.3, 14.4, vel);
  }

  /** Flow: going in, vermillion embers stream off the scarf with the rim pulse; snuffed out by a bump,
   *  a cold periwinkle-grey puff comes off it (the glow itself drops with the director's cap). */
  private flowFx(phase: 'in' | 'snuff', s: Snap): void {
    if (this.rider.crashing) return;
    const a = this.rider.scarfPoint(0.12, this.fxA);
    const b = this.rider.scarfPoint(1, this.fxB);
    const vel = this.carrier(s);
    if (phase === 'in') {
      this.flowPulseT = 0;
      this.particles.scarf(a, b, FLOW_C, 12, vel, true);
    } else {
      this.flowPulseT = 9;
      this.particles.scarf(a, b, SNUFF_C, 10, vel, false);
    }
  }

  /** New ground: the best band flares (uBestK over 0.6 s) and a line of gold-white motes skims across
   *  the snow at the sled, riding along with it a moment, kept low (decision 67). */
  private newGroundFx(b: BeatOf<'newGround'>, s: Snap): void {
    this.flareT = 0;
    if (this.bestZ < 0) this.bestZ = b.z;
    const vel = this.carrier(s);
    const l = Math.hypot(vel.x, vel.z);
    // Across the line of travel, 4 m either side of the sled.
    const px = l > 0.5 ? -vel.z / l : 1;
    const pz = l > 0.5 ? vel.x / l : 0;
    const gy = this.course.ground(s.x, s.z);
    const a = this.fxA.set(s.x - px * 4, gy, -s.z - pz * 4);
    const c = this.fxB.set(s.x + px * 4, gy, -s.z + pz * 4);
    this.particles.line(a, c, GOLD_WHITE, 24, vel, 1.35);
  }

  /** A ghost's stomp (its own perfect landing): a small ring of motes in its kind colour skimming out
   *  round it, riding along with it (at most 4 on Low). */
  private ghostStompFx(b: BeatOf<'ghostTrick'>, v: FrameView): void {
    const pose = v.ghostPoses.get(b.ghost.id);
    let vel: Vector3 | null = null;
    if (pose && !pose.done) {
      this.course.gradient(pose.x, pose.z, this.landG);
      const vx = Math.sin(pose.heading) * pose.speed;
      const vz = Math.cos(pose.heading) * pose.speed;
      vel = this.fxV.set(vx, this.landG.x * vx + this.landG.z * vz, -vz);
    }
    const at = this.fxA.set(b.x, Math.max(b.y, this.course.ground(b.x, b.z)) + 0.1, -b.z);
    this.particles.ring(at, GHOST_C[b.ghost.kind] ?? GHOST_C.pool, 10, 3.6, vel, 0, 1.3, 0.4, 0.17, this.quality.tier === 'low' ? 4 : Infinity);
  }

  /** Your best and an unbeaten friend's distance, as bands the snow shader paints across the corridor
   *  (bands in materials.ts): placed from Feel each run frame. The best band brightens over the last
   *  80 m as you close in, and flares on New ground (a steady brighten under reduced motion). */
  private updateBands(v: FrameView, feel: Feel, s: Snap, dt: number): void {
    const run = v.mode !== 'title';
    const bl = run ? feel.bestLine : null;
    if (bl) this.bestZ = bl.z;
    let flare = 0;
    let ft = 0;
    if (this.flareT >= 0) {
      this.flareT += dt;
      const t = this.flareT;
      ft = t;
      if (feel.reduced) {
        flare = 0.6 * (t < FLARE_S ? smooth01(t / FLARE_S) : 1 - smooth01((t - FLARE_S - 0.4) / 1.2));
        if (t > FLARE_S + 1.6) this.flareT = -1;
      } else {
        flare = t < 0.06 ? t / 0.06 : 1 - smooth01((t - 0.06) / (FLARE_S - 0.06));
        if (t >= FLARE_S) this.flareT = -1;
      }
    }
    const c = this.course;
    if (run && this.bestZ >= 0 && (bl !== null || flare > 0)) {
      const z = this.bestZ;
      const ahead = z - s.z;
      const near = ahead > 0 && ahead < 80 ? smooth01(1 - ahead / 80) : 0;
      bands.uBestZ.value = -z;
      bands.uBestX.value = c.centerX(z);
      bands.uBestHW.value = c.halfWidth(z) + 2;
      bands.uBestK.value = Math.max(bl ? bl.k : 0, flare, 0.4 * near);
      // The flare's wave of light outruns the sled down the slope (none under reduced motion).
      bands.uBestWave.value = flare > 0 && !feel.reduced ? 2 + ft * 38 : 0;
    } else {
      bands.uBestHW.value = 0;
      bands.uBestWave.value = 0;
    }
    const fl = run ? feel.friendLine : null;
    if (fl) {
      bands.uFriendZ.value = -fl.z;
      bands.uFriendX.value = c.centerX(fl.z);
      bands.uFriendHW.value = c.halfWidth(fl.z) + 2;
    } else bands.uFriendHW.value = 0;
  }

  private onEvent(e: SimEvent, s: Snap): void {
    const pos = new Vector3(s.x, s.y, -s.z);
    // The camera's kicks and shakes for this event (ChaseCamera.onSimEvent).
    this.cam.onSimEvent(e);
    switch (e.type) {
      case 'land': {
        // Landing powder rides along the slope, not along the fall the sled has just ended: the snap's
        // vertical speed on the landing tick is still the drop, and a burst carrying it sank straight
        // into the snow before it could be seen.
        this.course.gradient(s.x, s.z, this.landG);
        const lv = this.landV.set(s.vx, this.landG.x * s.vx + this.landG.z * s.vz, -s.vz);
        if (e.quality === 'perfect') {
          // A stomp streak presses a wider crater (1, 1.15, 1.3, 1.45, then 1.6) and throws a bigger
          // burst (up to twice the motes, through the budget).
          const n = Math.max(1, this.stompN || this.feel.streak);
          this.perfectPulse = 1;
          this.flash = 0.3;
          this.rider.flash();
          this.landing.pulse(s.x, s.z, s.heading, 1 + 0.15 * Math.min(4, n - 1));
          this.punch = 1;
          this.particles.perfect(pos, lv, Math.min(2, 1 + 0.25 * (n - 1)));
        } else if (e.quality === 'clean') {
          this.particles.burst(pos, 0.9, 22, lv);
        } else if (e.quality === 'sketchy') {
          this.particles.burst(pos, 1.0, 26, lv);
        } else {
          this.particles.burst(pos, 0.5, 8, lv);
        }
        break;
      }
      case 'takeoff':
        this.particles.burst(pos, 0.5, 10, new Vector3(s.vx, s.vy, -s.vz));
        if (e.kind === 'geyser') this.particles.steam(pos, 4);
        break;
      case 'crash':
        // A rider lost in the forest is stopped by the treeline wall and slides along its front, where
        // the results shot can frame it from the bank with the forest behind. Thrown on through the
        // wall, every lens looked through a row of dissolving trunks and cones.
        if (e.cause === 'forest') this.rider.startCrash(new Vector3(Math.sign(this.course.centerX(s.z) - s.x) * 1.5, s.vy, -s.vz), 0.35);
        else this.rider.startCrash(new Vector3(s.vx, s.vy, -s.vz), 1);
        this.particles.burst(pos, 2, 60);
        break;
      case 'bump':
        this.particles.burst(pos, 0.8, 14);
        break;
      case 'smash':
        this.particles.burst(new Vector3(e.x, e.y + 0.6, -e.z), 1.6, 45);
        this.props.markDirty();
        break;
      case 'gift':
        // A brief, low burst at the gift that rides along with the sled for its moment and settles
        // on the snow: thrown up and left behind, it floated up the frame as a column of stars.
        this.course.gradient(s.x, s.z, this.landG);
        this.particles.sparkle(new Vector3(e.x, e.y - 0.15, -e.z), e.value > 1 ? GOLD_WHITE : MARIGOLD, e.value > 1 ? 16 : 9, 2.2, 0.4, 0.18, this.landV.set(s.vx, this.landG.x * s.vx + this.landG.z * s.vz, -s.vz));
        this.props.markDirty();
        break;
      case 'boost':
        this.punch = Math.max(this.punch, 0.6);
        this.particles.sparkle(pos.clone().add(LOW), BOOST_C, 8, 2.4, 0.35, 0.18, this.landV.set(s.vx, 0, -s.vz));
        break;
      case 'drift':
        // Sparks off the runners, low along the snow.
        if (e.phase === 'tier') this.particles.sparkle(pos.clone().add(LOW), DRIFT_C[Math.max(0, Math.min(2, e.tier - 1))], 10, 2.4, 0.4, 0.18, this.landV.set(s.vx, 0, -s.vz));
        break;
      case 'revive':
        this.rider.reset(pos);
        this.trail.lift();
        this.particles.sparkle(pos.clone().add(LOW), GOLD_WHITE, 20, 3, 0.6, 0.22, null, 0.7);
        break;
      default:
        break;
    }
  }
}
