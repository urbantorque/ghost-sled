import { Color, DirectionalLight, Object3D, PCFShadowMap, NoToneMapping, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer } from 'three';
import { ChaosEvent, Mood } from '../sim/chaos';
import { CHUNK_LEN, Course, courseFor } from '../sim/course';
import type { Snap } from '../game/run';
import type { GhostPose } from '../game/ghosts';
import { BEST_HEX, DRIFT_TIER_HEX, FLOW_HEX, IDLE_FEEL, type Beat, type BeatOf, type Feel, type GhostRole } from '../game/beats';
import type { Light, ObstacleKind } from '../sim/course';
import type { Sim, SimEvent } from '../sim/sim';
import { RESULTS_BAND, type GhostKind } from '../ui/contract';
import { reduced } from '../ui/motion';
import type { ListenSources } from '../audio/listen';
import { ChaseCamera, crashPack } from './camera';
import { liftLine } from './dressing';
import { ChaosVisuals } from './chaos';
import { FarShadow } from './farshadow';
import { GHOST_COLORS, GhostVisuals } from './ghosts';
import { standable, visualGround } from './ground';
import { placeGraves, type GravePlace } from './graves';
import { LandingAid, stompWindowS } from './landing';
import { LakeMirror } from './lakemirror';
import { Life } from './life';
import { applyPalette, bands, lake, setCloudShadows, shared } from './materials';
import { Midground } from './midground';
import { LIP_FROM, Overlooks } from './overlook';
import type { LookSet } from './compose';
import { beginLocalLights } from './lights';
import { Palette, getPalette, journeyDusk, journeyPalette, journeyStamp, overRoof } from './palette';
import { Particles, Weather, lensPx } from './particles';
import { BRUSH_REACH_BOUGH, brushPoint } from './brush';
import { PostFX } from './post';
import { POSTER_LAYER, PosterLayer } from './poster';
import { PASSES, allSwitches, detailOf, parseSwitches, sceneSamples, type Detail, type PassSettings, type PassSwitches, type Tier } from './postfx/tiers';
import { AFTER_LAYER } from './postfx/after';
import { BODIES } from './postfx/taa';
import { VIEWS, type PipeView } from './postfx/pipeline';
import { cine } from './cine';
import { beginShaftSources } from './postfx/shafts';
import { Props } from './props';
import { NearForest } from './nearforest';
import { SetPieces } from './landmarks';
import { Moments } from './moments';
import { Rails } from './rails';
import { Rider, type RiderPose } from './rider';
import { grabDanger } from './trickpose';
import { CharmGates } from './charmgates';
import { FAMILY_HEX } from './charmglyphs';
import { setLetteringMirror } from './lettering';
import { CHARM, PATH_STEP, charmFamily } from '../sim/charms';
import { draftsOn } from '../sim/rivals';
import { wispUp } from '../game/charmsignals';
import { Sky } from './sky';
import { Sloughs } from './sloughs';
import { chatterK, chatterPitch, edgeK, kickK, roosterK, streakK } from './speedfeel';
import { SpiritFlow } from './spiritflow';
import { groomedAt } from './snowsurf';
import { planShots } from '../game/shots';
import { SpeedPosts } from './speedposts';
import { SpiritFx } from './spirit';
import { MarqueeWorld } from './marqueeworld';
import { LanternWorld } from './lanternworld';
import type { OldRunWorld } from './oldrunworld';
import { isOldRun, oldrunClearings } from './oldrunplan';
import type { GullhavenWorld } from './gullhavenworld';
import { gullhavenClearings, isGullhaven, seaLevelOf } from './gullhavenplan';
import { LanternRow } from './lanternrow';
import type { Fireworks } from './fireworks';
import type { TrailDef } from '../game/garage';
import { Terrain, TerrainDetail } from './terrain';
import { Trail } from './trails';

// The scene orchestrator: owns the renderer and every visual system, and turns an interpolated
// sim snapshot plus this frame's sim events into a picture.

export type { Tier, Detail } from './postfx/tiers';
export { detailOf } from './postfx/tiers';

export interface QualitySettings {
  tier: Tier;
  /** The world's dressing: Ultra dresses as High (postfx/tiers.ts). */
  detail: Detail;
  /** The frame's passes this tier may run (postfx/tiers.ts). */
  passes: PassSettings;
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

export const QUALITY: Record<Tier, Omit<QualitySettings, 'pixelRatio' | 'detail' | 'passes'> & { maxPixelRatio: number }> = {
  low: { tier: 'low', maxPixelRatio: 1, shadows: false, shadowSize: 512, post: false, bloom: false, msaa: 0, particleBudget: 0.45, forestDensity: 0.45, viewChunks: 6, terrain: { inner: 1.6, row: 3, reach: 60 }, weather: 900 },
  medium: { tier: 'medium', maxPixelRatio: 1.5, shadows: true, shadowSize: 1024, post: true, bloom: true, msaa: 0, particleBudget: 0.75, forestDensity: 0.75, viewChunks: 8, terrain: { inner: 1.1, row: 2.2, reach: 90 }, weather: 1800 },
  high: { tier: 'high', maxPixelRatio: 2, shadows: true, shadowSize: 2048, post: true, bloom: true, msaa: 2, particleBudget: 1, forestDensity: 1, viewChunks: 10, terrain: { inner: 0.85, row: 2, reach: 110 }, weather: 3200 },
  // The showpiece, for a discrete GPU: High's world under four samples a pixel, a 4096 shadow map over a
  // wider reach, and every pass of postfx/tiers.ts at its full count. It may cost what such a GPU can pay.
  ultra: { tier: 'ultra', maxPixelRatio: 2, shadows: true, shadowSize: 4096, post: true, bloom: true, msaa: 4, particleBudget: 1, forestDensity: 1, viewChunks: 10, terrain: { inner: 0.85, row: 2, reach: 110 }, weather: 3200 },
};

export function qualityFor(tier: Tier): QualitySettings {
  const q = QUALITY[tier];
  const dpr = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);
  return { ...q, detail: detailOf(tier), passes: PASSES[tier], pixelRatio: tier === 'low' ? Math.max(0.75, Math.min(1, dpr)) : dpr };
}

/** Near props fade through MSAA coverage (a smooth dissolve) only where the scene is drawn multisampled:
 *  under the temporal reconstruction it is not (it replaces the MSAA), and they dither, which the
 *  reconstruction resolves into a fade of its own. */
function smoothFade(q: QualitySettings, sw: PassSwitches, r: WebGLRenderer): boolean {
  return q.post && r.capabilities.isWebGL2 && sceneSamples(q.msaa, q.passes, sw) > 0;
}

/** The temporal reconstruction's box round a ghost and its sled, in the sled's frame (metres). */
const GHOST_BOX: [Vector3, Vector3] = [new Vector3(0, 0.92, 0), new Vector3(0.8, 0.84, 1.4)];

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
  /** The rider is at the head of the field on this frame (absent reads as leading: a run with nobody to
   *  race, the reel). The climax sends its full volley over the line only for a rider who is winning. */
  lead?: boolean;
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
/** A whisker's glints: snow-white with a breath of ice. */
const WHISKER_C = new Color('#F2F8FF');
const GOLD_WHITE = new Color(BEST_HEX);
const BOOST_C = new Color('#FF8A5C');
const LIGHT_C = new Color('#FFD34D');
const LIGHT_GREAT_C = new Color('#FFF3C4');
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
/** A forest tree passed within this many metres of its trunk, at this speed or more, sheds its snow. */
const SHED_R = 2.5;
const SHED_SPEED = 18;
/** The best band's New ground flare and the 'In the flow' rim pulse, seconds. */
const FLARE_S = 0.6;
const FLOW_PULSE_S = 0.3;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Lamplit Path's first spark for this run (props.ts draws one every PATH_STEP metres from it), or -1 for a rider who
 *  does not hold it. The sim's first is ceil((z + 1) / PATH_STEP) for the z it was taken at, a tick past its gate's
 *  line at most: counted from that tick's furthest reach, a spark is never drawn that the sim did not lay (one by the
 *  gate may go undrawn). Carried into a run (the Long Night), it starts at the start. */
export function pathFromOf(sim: Pick<Sim, 'charms' | 'charmGates'>): number {
  if (!sim.charms.includes(CHARM.path)) return -1;
  const g = sim.charmGates.find((q) => q.pick === CHARM.path);
  return g ? Math.ceil((g.z + 1.8) / PATH_STEP) : 1;
}

/** Each charm family's colour (charmglyphs.ts), as three.js colours, and the charms' own signals' colours: snow, a
 *  paper cream, a pale leaf-white wisp (never mint: it is no ghost), a pale wind line. */
const FAMILY_C = { speed: new Color(FAMILY_HEX.speed), style: new Color(FAMILY_HEX.style), survival: new Color(FAMILY_HEX.survival) };
/** How long (s) the lens leans toward a showdown's rival as it starts. */
const SD_LOOK_S = 2.6;
const SNOW_C = new Color('#F2F6FF');
const PAPER_C = new Color('#FFF6E0');
const WISP_C = new Color('#E6FFD0');
const WIND_C = new Color('#E8EEFF');
const smooth01 = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};

/** The least time between two re-blends of the colour script on Low (ms). */
const JOURNEY_LOW_MS = 200;

/** A dash's after-images by the grade's flash dial (rider.ts echoK). Round 8's review loop: at night over lilac cloud
 *  they read as a milky second sled (Lanternfall, so at least 0.35 and no more than the flash); by day on bright
 *  snow too, as pale copies of the tray and rider trailing down the frame (Sakura), so never over 0.6. */
function echoOf(flash: number | undefined): number {
  return Math.max(0.35, Math.min(0.6, flash ?? 1));
}

export class World {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly cam = new ChaseCamera();
  /** The highlight reel's lens (render/reelcam.ts), set while a reel plays: it takes the camera after the
   *  chase has had its frame, and writes the cine state. Null in play, always. */
  lens: ((camera: PerspectiveCamera, focus: Vector3, dir: Vector3, dt: number) => void) | null = null;
  /** Round 8, photo mode (the photo lane): the run held and the lens free. What belongs to the chase lens and the
   *  HUD leaves the picture (the speed streaks, the punch and flash, the corners closing at speed, the riders' tags
   *  and Low's running figures); the grade, the light and the moment stay. */
  photo = false;
  /** Round 8 (the photo lane): called once a frame with the canvas the moment the picture is drawn, before the tags
   *  and the avalanche mirror go over it, so a saved photo or an album sticker's frame never carries them. Null
   *  almost always: a ride costs nothing for it. */
  onPicture: ((canvas: HTMLCanvasElement) => void) | null = null;
  course: Course;
  palette: Palette;
  quality: QualitySettings;
  readonly terrain: Terrain;
  readonly midground: Midground;
  readonly props: Props;
  /** The course's set pieces and their crowds (landmarks.ts). */
  readonly setPieces: SetPieces;
  /** Where one bank opens over the valley (overlook.ts); the terrain, mid-ground and forest read it. */
  readonly overlooks: Overlooks;
  /** The visual lift's far shadows (farshadow.ts): the terrain's, the forest's and the set pieces' shadows past
   *  the shadow map's reach and on Low, baked on idle time for each stretch's own sun. */
  readonly far: FarShadow;
  /** The far shadows' light is the title's (the start of the run) while the title plays. */
  private farTitle = false;
  private farAt: number | null = null;
  /** Dev: the far shadows drawn at no strength (`far=0`). */
  farOff = false;
  /** Dev: the ghosts left out of the picture (`ghosts=0`, hideGhosts). */
  ghostsOff = false;
  private farPal = {} as Palette;
  /** The lantern in the world: sky gates, a dash's trail, a ward's light, ghosts' dashes. */
  private readonly spirit: SpiritFx;
  /** The set pieces' own world: race machines, lantern gates, a falling span (round 6). */
  private readonly marquee: MarqueeWorld;
  /** Lanternfall's own world: the cloud sea, the valley of lanterns, its lamps and set pieces (round 7, the
   *  lanternworld lane). Empty on every other mountain. */
  private readonly lantern: LanternWorld;
  /** Round 9: the Old Run's own world (oldrunworld.ts: the hotel and start house, the parapet and its iron lamps, the
   *  timing house, the lake), loaded on demand the first time its course is drawn, into its own root. Null until then
   *  and on every other mountain. */
  private oldrun: OldRunWorld | null = null;
  private oldrunLoading = false;
  private readonly oldrunRoot = new Object3D();
  /** Round 9: Gullhaven's own world (gullhavenworld.ts: the beacon, the fence and the moor's walls, the sea cliff's clefts
   *  and the wind in them, the sea and its stacks, the lighthouse, the sheds and the harbour), loaded on demand the
   *  first time its course is drawn, into its own root. Null until then and on every other mountain. */
  private gullhaven: GullhavenWorld | null = null;
  private gullhavenLoading = false;
  private readonly gullhavenRoot = new Object3D();
  /** Round 8, the light lane: the Lantern Row's lit lanterns over the finish town and the title shot. */
  private readonly row = new LanternRow();
  /** The rails and the marks of the leaps and forks (rails.ts): one draw, on every tier. */
  readonly rails: Rails;
  /** Round 8: the charm gates' arches and a showdown's marker (charmgates.ts): one draw, on every tier, built on
   *  idle time after the first frame. */
  readonly charmGates = new CharmGates();
  readonly sky: Sky;
  readonly rider = new Rider();
  readonly particles: Particles;
  readonly weather: Weather;
  readonly trail: Trail;
  readonly ghosts: GhostVisuals;
  readonly chaos: ChaosVisuals;
  readonly landing: LandingAid;
  readonly life: Life;
  /** Markers strobing past along the corridor's edges, a slough of snow off a bank, and the moments the
   *  sim hands the picture (speedposts.ts, sloughs.ts, moments.ts). */
  readonly speedPosts: SpeedPosts;
  /** Round 8 (speed): Spirit Flow's picture (spiritflow.ts): the scarf's trail, the wind lines and the sparks. */
  readonly spiritFlow: SpiritFlow;
  /** The ghosts' glow the palette asks for, before the flow lifts it, and the lift last sent. */
  private ghostGlowBase = 1;
  private ghostGlowFlow = 0;
  /** Dev (render only): the flow's picture held at this level (`?flowlook=0..6`), or -1 to read the sim's. */
  private devFlow = -1;
  private flowKnot = new Vector3();
  private flowTip = new Vector3();
  /** Any point along the scarf, for the flame (rider.scarfPoint). */
  private scarfAt = (u: number, out: Vector3): Vector3 => this.rider.scarfPoint(u, out);
  readonly sloughs: Sloughs;
  readonly moments: Moments;
  readonly post: PostFX;
  /** Low's poster (the visual lift): painted shafts and the frame's foot, one draw on Low only (poster.ts). */
  readonly poster = new PosterLayer();
  /** Round 8: the trees nearest the lens, drawn from their near build (nearforest.ts; forestLod). */
  readonly nearForest = new NearForest();
  /** What a frozen lake mirrors (lakemirror.ts): baked only when one is near. */
  private lakeMirror: LakeMirror;
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
  /** The dash's spirit shimmer on the rider, eased (0 to 1). */
  private dashK = 0;
  /** The garage's trail (garage.ts): the spray's warm tint and the motes the runners throw. */
  private trailTint: Color | null = null;
  private trailTintK = 0;
  private trailMote: Color | null = null;
  private trailRate = 0;
  private trailStyle: TrailDef['moteStyle'] = 'flick';
  private trailAcc = 0;
  private wasGrounded = true;
  private width = 1;
  private height = 1;
  private ventAcc = 0;
  /** Seconds since the last glint on a gift ahead. */
  private glintAcc = 0;
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
  /** The lens's placement at a composed place (compose.ts), written each frame. */
  private placeAt: LookSet = { up: 0, back: 0, aside: 0, yaw: 0, horizon: 0, row: 0 };
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
  /** When the palette was last re-blended (performance.now, ms): Low re-blends at most every JOURNEY_LOW_MS. */
  private journeyAt0 = -Infinity;
  /** The weather's density last set by the journey, in steps. */
  private journeyFall = -1;
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
    this.midground = new Midground(this.course, this.palette, quality.detail, quality.terrain.reach);
    this.props = new Props(this.course, this.palette, quality.forestDensity, quality.shadows, smoothFade(quality, allSwitches(true), this.renderer), quality.detail !== 'low');
    this.setPieces = new SetPieces(this.course, this.palette, Mood.None, quality.detail, quality.shadows);
    this.overlooks = new Overlooks(this.course, this.palette, quality.detail);
    this.terrain.overlooks = this.midground.overlooks = this.overlooks;
    // Each stretch's own shadow light, what stands there and the ground it falls on (farshadow.ts FarWorld).
    const world = this;
    this.far = new FarShadow({
      get course() {
        return world.course;
      },
      sunAt: (z, out) => out.copy(this.mood === Mood.None ? journeyPalette(this.course.biome, this.journeyAt ?? (this.farTitle ? 0 : Math.max(0, z)), this.farPal, this.course).shadowDir : this.palette.shadowDir),
      keyAt: (z, out) => out.copy(this.mood === Mood.None ? journeyPalette(this.course.biome, this.journeyAt ?? (this.farTitle ? 0 : Math.max(0, z)), this.farPal, this.course).sunDir : this.palette.sunDir),
      ground: (x, z) => {
        const c = this.course;
        const off = x - c.centerX(z);
        const e = Math.abs(off) - c.halfWidth(z);
        const y = visualGround(c, x, z);
        return e > LIP_FROM ? y - this.overlooks.drop(z, off < 0 ? -1 : 1, e) : y;
      },
      shoulders: (z, x0, dx, n, out, at) => this.midground.shoulders(z, x0, dx, n, out, at),
      casters: (i, out) => this.props.farCasters(i, out),
      sites: (z0, z1, cb) => this.setPieces.farSites(z0, z1, cb),
    });
    this.rails = new Rails(this.course, this.palette, quality.shadows, smoothFade(quality, allSwitches(true), this.renderer));
    this.props.siteKeep = (z0, z1, out) => {
      this.setPieces.clearings(z0, z1, out);
      // (A composed place's steep faces: compose.ts.)
      this.overlooks.keeps(z0, z1, out);
    };
    this.props.siteClearings = (z0, z1, out) => this.overlooks.clearings(z0, z1, out);
    this.sky = new Sky(seed);
    this.sky.setDetail(quality.detail);
    setCloudShadows(quality.detail !== 'low');
    this.sky.setPalette(this.palette);
    this.particles = new Particles(1800);
    this.weather = new Weather(3200);
    this.trail = new Trail(this.course, 900, 'groove');
    this.ghosts = new GhostVisuals(this.course, container);
    this.ghosts.pixelRatio = quality.pixelRatio;
    this.ghosts.lowPage = quality.detail === 'low';
    this.ghosts.glass = quality.detail === 'low' ? 0 : quality.detail === 'medium' ? 1 : 2;
    this.rider.setDetail(quality.detail === 'low' ? 'lite' : 'full');
    this.chaos = new ChaosVisuals(this.course);
    this.landing = new LandingAid(this.course);
    this.life = new Life(this.course, this.palette, quality.detail, quality.forestDensity);
    // Skiers and the snowcat ride the far flanks, and the settlements' chimneys smoke.
    this.life.farGround = (x, z) => this.midground.ground(x, z);
    this.life.farChimneys = (out) => this.midground.chimneys(out);
    this.life.townChimneys = (out, z0, z1) => this.setPieces.chimneys(out, z0, z1);
    this.life.townKey = () => this.setPieces.chimneyKey;
    // (A cabin the dressing would not stand on a wall or a ledge smokes no chimney either.)
    this.life.kept = (x, z) => this.setPieces.keeps(x, z) || !standable(this.course, z, this.course.edgeExcess(x, z));
    this.life.dropAt = (z, side, e) => this.overlooks.drop(z, side, e);
    this.speedPosts = new SpeedPosts(this.course, quality.detail);
    this.spiritFlow = new SpiritFlow(quality.detail);
    this.speedPosts.kept = (x, z) => this.setPieces.keeps(x, z);
    this.sloughs = new Sloughs(this.course, quality.detail, this.particles);
    this.moments = new Moments(this);
    this.cam.ground = (x, z) => this.course.ground(x, -z);
    this.cam.surface = (x, z) => visualGround(this.course, x, -z);
    const cor = { x: 0, hw: 0 };
    this.cam.corridor = (z) => {
      cor.x = this.course.centerX(-z);
      cor.hw = this.course.halfWidth(-z);
      return cor;
    };
    this.cam.section = (z) => this.course.section(-z);
    this.cam.shots = this.overlooks.compose.sideShots(planShots(this.course));
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
    this.landing.painted = !quality.shadows;
    // A wreck under the trees slides out to a clearing as it settles, where the hero shot can see it.
    this.rider.blocked = this.cam.blocked;

    this.spirit = new SpiritFx(this.particles, this.cam.camera);
    this.spirit.setCourse(this.course);
    this.marquee = new MarqueeWorld(this.particles);
    this.marquee.setCourse(this.course);
    // (Round 7, the lanternworld lane.)
    this.lantern = new LanternWorld(this.particles);
    this.lantern.kept = (x, z) => this.setPieces.keeps(x, z);
    this.lantern.setDetail(quality.detail);
    this.lantern.setCourse(this.course);
    this.row.setDetail(quality.detail);
    this.row.setCourse(this.course);
    this.props.siteClearings = (z0, z1, out) => {
      this.overlooks.clearings(z0, z1, out);
      this.lantern.clearings(z0, z1, out);
      // (The Old Run's hotel and timing house, known before its world has loaded: oldrunplan.ts.)
      oldrunClearings(this.course, z0, z1, out);
      // (Gullhaven's sea cliff and moor, its world's alone: gullhavenplan.ts.)
      gullhavenClearings(this.course, z0, z1, out);
    };
    this.spirit.setQuality(quality.particleBudget, quality.bloom);
    this.charmGates.setCourse(this.course);
    this.charmGates.setLow(quality.detail === 'low');
    this.charmGates.host = { renderer: this.renderer, scene: this.scene, camera: this.cam.camera };
    this.scene.add(
      this.spirit.root,
      this.marquee.root,
      this.lantern.root,
      this.oldrunRoot,
      this.gullhavenRoot,
      this.row.root,
      this.sky.root,
      this.terrain.root,
      this.midground.root,
      this.overlooks.root,
      this.rails.root,
      this.props.root,
      this.setPieces.root,
      this.trail.mesh,
      this.landing.root,
      this.ghosts.root,
      this.chaos.root,
      this.life.root,
      this.speedPosts.mesh,
      this.spiritFlow.root,
      this.sloughs.mesh,
      ...this.rider.objects,
      ...this.particles.objects,
      this.weather.points,
    );
    // (The poster joins the scene on idle time after Low's first frame: poster.ts. Only the chase lens draws it.)
    this.poster.host = { renderer: this.renderer, scene: this.scene };
    this.poster.setTier(quality.detail === 'low');
    this.cam.camera.layers.enable(POSTER_LAYER);
    this.sun.castShadow = quality.shadows;
    this.configureShadow();
    this.scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;

    const canHalf = this.renderer.capabilities.isWebGL2 && (this.renderer.extensions.has('EXT_color_buffer_float') || this.renderer.extensions.has('EXT_color_buffer_half_float'));
    this.post = new PostFX(this.renderer, 2, 2, canHalf ? quality.msaa : 0, quality.detail === 'high' ? 5 : 4);
    this.post.enabled = quality.post && canHalf;
    this.post.bloomEnabled = quality.bloom;
    this.post.configure(quality.passes);
    // What the temporal reconstruction draws after itself sits on a layer of its own (postfx/after.ts): every
    // lens that draws this scene sees it. The sky and the far ranges always stay in the scene's own pass (the
    // lake's mirror draws the sky with a lens of its own).
    this.cam.camera.layers.enable(AFTER_LAYER);
    this.mirrorCam.layers.enable(AFTER_LAYER);
    this.post.pipe.after.kept.push(this.sky.root, this.midground.root, this.overlooks.root);
    // (As setCourse: a run on the mountain the world was built for never passes through it.)
    this.post.fringeK = this.course.biome === 'blossom' ? 0 : 1;
    // (Round 8's review: the lens's speed blur at the frame's sides smeared Sakura's near snow into "claw marks" and
    // "crawling lavender streaks" in a dozen frames and two strips. The calm mountain keeps half of it.)
    this.cam.blurCalm = this.course.biome === 'blossom' ? 0.5 : 1;
    this.post.setGrade({ ...this.palette.grade, bloom: this.palette.bloom });
    this.spirit.fireworks.lightK = this.palette.grade.flash ?? 1;
    this.spirit.lightK = Math.max(0.5, this.palette.grade.flash ?? 1);
    this.rider.echoK = echoOf(this.palette.grade.flash);
    this.rider.setHeroRim(this.palette.heroRim);
    this.lakeMirror = new LakeMirror(this.renderer);
    this.syncOldRun();
    this.syncGullhaven();
    this.applyWeather();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.prewarm();
  }

  /**
   * The pipeline's dev switches, from the page's query (app.ts hands them over behind `?debug`):
   * `post=` turns passes off or keeps only some (postfx/tiers.ts parseSwitches: `none`, `-ao,-blur`,
   * `ao,shafts`), `postview=` shows what a pass made instead of the picture (depth, ao, contact, shafts,
   * coc, motion), `gpu` times each pass on the GPU (read `world.post.pipe.timer.ms`), and `cine=`
   * holds the camera's cine state at given values so a beat's passes can be shot without the beat
   * (`cine=dof:1,focus:9,blur:1,box:1`).
   */
  devPipe(q: URLSearchParams): void {
    const pipe = this.post.pipe;
    // Round 8 (speed): Spirit Flow's picture held at a level (`flowlook=6`), render only: the sim's flow and its
    // payouts are untouched, the picture shows that level and its breaths are held.
    if (q.has('flowlook')) this.devFlow = Math.max(0, Math.min(6, Number(q.get('flowlook')) || 0));
    if (q.has('post')) {
      pipe.switches = parseSwitches(q.get('post'));
      this.post.configure(this.quality.passes);
      this.refade();
    }
    const view = q.get('postview') as PipeView | null;
    if (view && VIEWS.includes(view)) pipe.view = view;
    if (q.has('gpu')) pipe.timer.on = true;
    // The far shadows off (`far=0`), to shoot a frame with and without them.
    if (q.get('far') === '0') this.farOff = true;
    // The ghosts out of the picture (`ghosts=0`), so a still is judged on the snow alone (hideGhosts).
    if (q.get('ghosts') === '0') this.ghostsOff = true;
    // The temporal reconstruction on any tier with a post stack (`?taa`, Medium's trial), its share of the
    // frame (`?tscale=0.75`), its sharpen (`?tsharp=0.3`) and its MSAA (`?tmsaa=0`).
    const ts = Number(q.get('tscale'));
    const tk = Number(q.get('tsharp'));
    const tm = Number(q.get('tmsaa'));
    if (q.has('taa') || ts > 0 || (q.has('tsharp') && tk >= 0) || (q.has('tmsaa') && tm >= 0)) {
      const p = { ...this.quality.passes };
      if (q.has('taa')) p.taa = true;
      if (q.has('tmsaa') && tm >= 0) p.taaMsaa = Math.round(tm);
      if (ts > 0) p.scale = Math.min(1, ts);
      if (q.has('tsharp') && tk >= 0) p.sharpen = Math.min(1, tk);
      this.quality = { ...this.quality, passes: p };
      this.post.configure(this.quality.passes);
      this.refade();
      this.resize();
    }
    // Round 8 (image): the scene's MSAA samples (`?msaa=4`), for the spatial path's trial against the rebuild.
    const ms = Number(q.get('msaa'));
    if (q.has('msaa') && ms >= 0 && this.post.enabled) {
      this.quality = { ...this.quality, msaa: Math.round(ms) };
      this.post.setMsaa(Math.round(ms));
      this.refade();
    }
    const c = q.get('cine');
    if (c) {
      const hold: { dof?: number; focus?: number; motionBlur?: number; letterbox?: number } = {};
      for (const part of c.split(',')) {
        const [k, v] = part.split(':');
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        if (k === 'dof') hold.dof = n;
        else if (k === 'focus') hold.focus = n;
        else if (k === 'blur') hold.motionBlur = n;
        else if (k === 'box') hold.letterbox = n;
      }
      this.cineHold = hold;
    }
  }

  /** After a dev switch: near props fade the way the scene is now drawn (smoothFade). */
  refade(): void {
    const q = this.quality;
    const fade = smoothFade(q, this.post.pipe.switches, this.renderer);
    this.rails.setQuality(q.shadows, fade);
    this.props.setQuality(q.forestDensity, q.shadows, fade, q.detail !== 'low');
  }

  /** The camera's cine state (cine.ts), for play-tests. */
  readonly cine = cine;
  /** Dev: cine values held over whatever the camera wrote (devPipe). */
  cineHold: { dof?: number; focus?: number; motionBlur?: number; letterbox?: number } | null = null;

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
    const r = this.quality.passes.shadowReach;
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
    this.spirit.setViewport(w * pr, px);
    this.lantern.setViewport(px);
    // (The charm gates hold their medallions to a size the eye sees: CSS pixels, whatever the tier renders at.)
    this.charmGates.setViewport(h);
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
    this.landing.painted = !q.shadows;
    if (shadowsChanged) this.configureShadow();
    this.terrain.setDetail(q.terrain, q.shadows);
    this.midground.setTier(q.detail, q.terrain.reach);
    this.overlooks.setTier(q.detail);
    this.ghosts.pixelRatio = q.pixelRatio;
    this.ghosts.lowPage = q.detail === 'low';
    this.ghosts.glass = q.detail === 'low' ? 0 : q.detail === 'medium' ? 1 : 2;
    this.rider.setDetail(q.detail === 'low' ? 'lite' : 'full');
    const fade = smoothFade(q, this.post.pipe.switches, this.renderer);
    this.rails.setQuality(q.shadows, fade);
    this.props.setQuality(q.forestDensity, q.shadows, fade, q.detail !== 'low');
    this.setPieces.setQuality(q.detail, q.shadows);
    const canHalf = this.renderer.capabilities.isWebGL2;
    this.post.enabled = q.post && canHalf;
    this.post.bloomEnabled = q.bloom;
    this.post.setMsaa(q.msaa);
    this.post.configure(q.passes);
    this.spirit.setQuality(q.particleBudget, q.bloom);
    this.post.shaftTaps = q.detail === 'high' ? 14 : 8;
    this.sky.setDetail(q.detail);
    this.poster.setTier(q.detail === 'low');
    this.lantern.setDetail(q.detail);
    this.oldrun?.setDetail(q.detail);
    this.gullhaven?.setDetail(q.detail);
    this.row.setDetail(q.detail);
    this.charmGates.setLow(q.detail === 'low');
    this.life.setQuality(q.detail, q.forestDensity);
    this.speedPosts.setTier(q.detail);
    this.spiritFlow.setTier(q.detail);
    this.sloughs.setTier(q.detail);
    setCloudShadows(q.detail !== 'low');
    this.applyWeather();
    this.lastChunkRange = '';
    // (What casts differs by tier: the forest's density, the dressing, the terrain's reach.)
    this.far.invalidate();
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
    this.midground.setCourse(c, this.palette);
    this.overlooks.setCourse(c, this.palette);
    // (After the overlooks: the place shots take their sides from the new course's composed places.)
    this.cam.shots = this.overlooks.compose.sideShots(planShots(c));
    this.rails.setCourse(c, this.palette);
    this.props.setCourse(c, this.palette);
    this.spirit.setCourse(c);
    this.charmGates.setCourse(c);
    this.marquee.setCourse(c);
    // The eruption rises from the cone where the massif stands it (only Ember's erupts; 0 would be "the
    // massif's own default bearing", which the eruption cannot know, so it keeps its own then).
    if (this.palette.massif.heroAz) this.marquee.setConeBearing(this.palette.massif.heroAz);
    this.setPieces.setCourse(c, this.palette, this.mood);
    this.lantern.setCourse(c);
    this.syncOldRun();
    this.syncGullhaven();
    this.row.setCourse(c);
    this.sky.setPalette(this.palette);
    this.setGhostGlow(this.palette.ghostGlow);
    this.trail.setCourse(c);
    this.ghosts.setCourse(c);
    this.chaos.setCourse(c);
    this.landing.setCourse(c);
    this.speedPosts.setCourse(c);
    this.sloughs.setCourse(c);
    this.life.setCourse(c, this.palette, this.mood);
    // Sakura is the calm mountain (ART.md 15): its lens shows no colour fringe at speed (a third of the
    // others' still split the blossom's trunks green and the crowd to noise at the frame's edge).
    this.post.fringeK = c.biome === 'blossom' ? 0 : 1;
    this.cam.blurCalm = c.biome === 'blossom' ? 0.5 : 1;
    this.post.setGrade({ ...this.palette.grade, bloom: this.palette.bloom });
    this.spirit.fireworks.lightK = this.palette.grade.flash ?? 1;
    this.spirit.lightK = Math.max(0.5, this.palette.grade.flash ?? 1);
    this.rider.echoK = echoOf(this.palette.grade.flash);
    this.rider.setHeroRim(this.palette.heroRim);
    this.applyWeather();
    this.lastChunkRange = '';
    this.journeyKey = -1;
    this.journeyAt0 = -Infinity;
    this.far.invalidate();
  }

  /** A mirror mountain (the modes lane, modes.ts): the picture flipped left for right, the sim untouched. The canvas
   *  is shown turned over (a CSS transform: no pass, no draw, the same frame on every tier), so everything in it is
   *  mirrored with it, the ghosts too, and what must read the right way round is drawn turned over to meet it: the
   *  boards' built letters (lettering.ts, the pieces remade), the medallions' glyphs (charmgates.ts) and the labels
   *  (labels.ts, laid out as the player sees the screen). The DOM over the canvas is never flipped: what it reads
   *  from the frame (the rider's place on screen, the rear-view mirror's box) is turned over here. */
  get mirrored(): boolean {
    return this.isMirrored;
  }

  setMirrored(on: boolean): void {
    if (on === this.isMirrored) return;
    this.isMirrored = on;
    this.renderer.domElement.style.transform = on ? 'scaleX(-1)' : '';
    this.ghosts.batch.setFlip(on);
    this.ghosts.mirrored = on;
    this.charmGates.setMirrored(on);
    // (The boards are baked into their pieces: those made the other way are made again, as a new mood remakes them.)
    if (setLetteringMirror(on)) this.setPieces.setCourse(this.course, this.palette, this.mood);
  }

  private isMirrored = false;

  /** On a mirrored run, turns the lens's projection over left for right (its x row; called again to turn it back),
   *  so what the ghosts' labels measure on screen (a tag over its ghost, the rider's box) is measured as the player
   *  sees it; the edge chip, which measures in view space, is told by the ghost layer's own flag. Only the ghosts'
   *  update runs between the two calls, and the frame is drawn with the lens as it is. (The view matrix would not do:
   *  three.js makes it again whenever the lens's direction is read.) */
  private mirrorView(): void {
    if (!this.isMirrored) return;
    const e = this.cam.camera.projectionMatrix.elements;
    e[0] = -e[0];
    e[4] = -e[4];
    e[8] = -e[8];
    e[12] = -e[12];
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
    if (!same) this.rails.setCourse(this.course, this.palette);
    if (!same) this.setPieces.setCourse(this.course, this.palette, mood);
    this.midground.setPalette(this.palette);
    this.overlooks.setPalette(this.palette);
    this.sky.setPalette(this.palette);
    this.life.setPalette(this.palette, mood);
    this.setGhostGlow(this.palette.ghostGlow);
    this.post.setGrade({ ...this.palette.grade, bloom: this.palette.bloom });
    this.spirit.fireworks.lightK = this.palette.grade.flash ?? 1;
    this.spirit.lightK = Math.max(0.5, this.palette.grade.flash ?? 1);
    this.rider.echoK = echoOf(this.palette.grade.flash);
    this.rider.setHeroRim(this.palette.heroRim);
    this.lakeMirror.invalidate();
    this.applyWeather();
    this.lastChunkRange = '';
    this.journeyKey = -1;
    this.journeyAt0 = -Infinity;
    // (Another mood is another sun, or none.)
    if (!same) this.far.invalidate();
  }

  /** Round 8, the hours lane: the hour changed (palette.ts setHour) with the world already on its course, as when the
   *  title's pick turns from the day to the mountain's other hour. Its light is built again as another mood's is: the
   *  props' baked colours, the sky, the grade and the far shadows' sun. */
  relight(): void {
    const mood = this.mood;
    this.mood = -1 as Mood;
    this.setMood(mood);
  }

  /** Round 9: the Old Run's world, loaded the first time its course is drawn (nothing of it is in the first
   *  download), and handed every course after (it empties itself on any other mountain). */
  private syncOldRun(): void {
    if (this.oldrun) {
      this.oldrun.setCourse(this.course);
      return;
    }
    if (this.oldrunLoading || !isOldRun(this.course)) return;
    this.oldrunLoading = true;
    void import('./oldrunworld').then((m) => {
      const w = new m.OldRunWorld(this.particles);
      w.setDetail(this.quality.detail);
      w.setCourse(this.course);
      this.oldrunRoot.add(w.root);
      this.oldrun = w;
    });
  }

  /** Round 9: Gullhaven's world, loaded the first time its course is drawn (nothing of it is in the first download),
   *  and handed every course after (it empties itself on any other mountain). Its sea stands at its own level in the
   *  sky's dome from the first frame (sky.ts setSeaLevel), before the module has loaded. */
  private syncGullhaven(): void {
    this.sky.setSeaLevel(isGullhaven(this.course) ? seaLevelOf(this.course) : null);
    if (this.gullhaven) {
      this.gullhaven.setCourse(this.course);
      return;
    }
    if (this.gullhavenLoading || !isGullhaven(this.course)) return;
    this.gullhavenLoading = true;
    void import('./gullhavenworld').then((m) => {
      const w = new m.GullhavenWorld(this.particles, this.sky.seaUniforms);
      w.setDetail(this.quality.detail);
      w.setCourse(this.course);
      this.gullhavenRoot.add(w.root);
      this.gullhaven = w;
    });
  }

  /** The ghosts' glow for the palette (Ghosts.setGlow), with Spirit Flow's lift on it (round 8, speed). */
  private setGhostGlow(g: number): void {
    this.ghostGlowBase = g;
    this.ghosts.setGlow(g + this.ghostGlowFlow);
  }

  /** Each mountain's journey over a Clear Skies run (palette.ts JOURNEY, keyed off the distance ridden;
   *  the title reel stays at the start). It is re-blended into the live palette only while the light
   *  moves, a few times a second at most; the props keep their baked colours and take the light through
   *  the shared uniforms. Chaos moods keep their own palette. */
  private journey(metres: number, over = 0): void {
    if (this.mood !== Mood.None) return;
    const biome = this.course.biome;
    // (Round 7, the light lane: the course's places grade the hour's light, palette.ts PLACES.)
    const key = journeyStamp(biome, metres, this.course, over);
    if (key === this.journeyKey) return;
    // (On Low a re-blend repaints every material's baked colours, and on a course thick with places, Sakura's
    // first kilometre, the stamp moved every couple of frames: Low takes the light at most five times a second,
    // still smooth over metres, and saves a few tenths of a millisecond a frame at 6x.)
    const now = performance.now();
    if (this.quality.detail === 'low' && now - this.journeyAt0 < JOURNEY_LOW_MS) return;
    this.journeyAt0 = now;
    this.journeyKey = key;
    const p = journeyPalette(biome, metres, this.palette, this.course, over);
    applyPalette(p);
    this.sky.setPalette(p);
    this.setGhostGlow(p.ghostGlow);
    this.post.setGrade({ ...p.grade, bloom: p.bloom });
    this.spirit.fireworks.lightK = p.grade.flash ?? 1;
    this.spirit.fireworks.noRed = this.course.biome === 'lantern';
    this.spirit.lightK = Math.max(0.5, p.grade.flash ?? 1);
    this.rider.echoK = echoOf(p.grade.flash);
    this.rider.setHeroRim(p.heroRim);
    // The falling weather thickens in coarse steps (configuring it is not free).
    const fall = Math.round((p.embers + p.petals + p.snowfall) * 20);
    if (fall !== this.journeyFall) {
      this.journeyFall = fall;
      this.applyWeather();
    }
  }

  /**
   * What the soundscape hears of the world near sim z (audio/listen.ts), refreshed in place: the
   * set-piece plan, the bird flocks, the lift lines, the villages' chimneys, the vista, the dusk.
   * Read-only; it allocates nothing after the first call.
   */
  listenSources(z: number): ListenSources {
    // (The flocks and the bird kind are life's own private state, read as they are.)
    const life = this.life as unknown as { flocks: ListenSources['flocks']; birdKind: ListenSources['birds']; plan: { rich: boolean }; birdMesh: { visible: boolean } };
    const src = (this.listenSrc ??= {
      course: this.course,
      biome: this.course.biome,
      mood: this.mood,
      tier: this.quality.detail,
      sites: this.setPieces.planned,
      crowds: false,
      flocks: life.flocks,
      birds: null,
      lifts: false,
      lift: liftLine,
      chimneys: this.listenChimneys,
      chimneyCount: 0,
      vista: 0,
      dusk: 0,
      night: false,
    });
    const night = this.mood === Mood.Lantern || this.mood === Mood.Comet || this.mood === Mood.Haunted;
    src.course = this.course;
    src.biome = this.course.biome;
    src.mood = this.mood;
    src.tier = this.quality.detail;
    src.sites = this.setPieces.planned;
    src.crowds = this.quality.detail !== 'low';
    src.flocks = life.flocks;
    src.birds = life.birdMesh.visible ? life.birdKind : null;
    src.lifts = life.plan.rich;
    src.chimneyCount = this.midground.chimneys(this.listenChimneys);
    src.vista = this.cam.vistaNow;
    src.dusk = night ? 1 : this.mood === Mood.None ? journeyDusk(this.course.biome, z) : 0;
    src.night = night;
    return src;
  }

  private listenSrc: ListenSources | null = null;
  private listenChimneys = Array.from({ length: 6 }, () => new Vector3());

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
  sledPortrait(id: number, seated: boolean, look?: import('./portrait').PortraitLook): Promise<string | null> {
    return import('./portrait').then((m) => m.sledPortrait(this.renderer, id, seated, look));
  }

  private applyWeather(): void {
    const p = this.palette;
    const cap = this.quality.weather / 3200;
    if (p.windStreaks > 0) {
      // A hard crosswind: streaks race sideways across the frame rather than falling.
      this.weather.configure({ density: cap, kind: 0, color: new Color('#FFFFFF'), streak: 0.8, size: 0.09, alpha: 0.85, fall: new Vector3(16, -3, 2), additive: false });
    } else if (p.petals > 0) {
      this.weather.configure({ density: cap * 0.5 * p.petals, kind: 1, color: new Color('#FFB3CC'), streak: 0, size: 0.1, alpha: 0.82, fall: new Vector3(1.4, -1.2, 0.6), additive: false });
    } else if (p.embers > 0) {
      this.weather.configure({ density: (cap * 0.22 * p.embers) / 0.6, kind: 2, color: new Color('#FF8A40'), streak: 0, size: 0.08, alpha: 0.9, fall: new Vector3(0.6, 1.1, 0.4), additive: true });
    } else if (p.wisps > 0) {
      this.weather.configure({ density: cap * 0.12, kind: 3, color: p.ghost, streak: 0, size: 0.18, alpha: 0.7, fall: new Vector3(0.4, 0.3, 0.2), additive: true });
    } else {
      this.weather.configure({ density: cap * p.snowfall, kind: 0, color: new Color('#FFFFFF'), streak: 0, size: 0.08, alpha: 0.85, fall: new Vector3(0.5, -1.6, 0.4), additive: false });
    }
  }

  /** The garage's trail (garage.ts): what the sled leaves, a look only. */
  setTrail(t: TrailDef): void {
    this.trailTint = t.tint ? new Color(t.tint) : null;
    this.trailTintK = t.tint ? t.tintK : 0;
    this.trailMote = t.mote ? new Color(t.mote) : null;
    this.trailRate = t.motes;
    this.trailStyle = t.moteStyle;
    this.trailAcc = 0;
  }

  /** The shells over the square and the street (spirit.ts owns them; moments.ts sends the finish's up). */
  get fireworks(): Fireworks {
    return this.spirit.fireworks;
  }

  /** Reset per-run visuals at the start of a run. */
  beginRun(snap: Snap, event: ChaosEvent, sled = 0): void {
    this.rider.setSled(sled);
    this.trail.clear();
    this.particles.clear();
    this.sloughs.clear();
    this.moments.reset();
    this.spirit.reset();
    this.marquee.reset();
    this.lantern.reset();
    this.oldrun?.reset();
    this.gullhaven?.reset();
    this.charmGates.reset();
    this.sdLook = null;
    this.dashK = 0;
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

  /** A cut in the highlight reel: the picture jumps down the course, so the groove, the spray and the
   *  ground are made fresh there and the chase lens is put behind the sled. */
  reelCut(snap: Snap): void {
    this.trail.clear();
    this.particles.clear();
    this.wasGrounded = true;
    this.updateChunks(snap.z, true);
    this.snapCamera(snap);
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
    this.overlooks.update(z);
    if (prime) this.terrain.prime(from, Math.min(to, cur + 4));
    this.terrain.update(from, to);
    this.midground.update(z, prime);
    this.rails.update(Math.max(0, from), to);
    const key = `${from}:${to}`;
    if (key !== this.lastChunkRange) {
      this.lastChunkRange = key;
      this.props.markDirty();
    }
  }

  frame(v: FrameView): void {
    // (Over the finish line the picture runs on its own eased clock: moments.ts.)
    this.moments.ease(v);
    const s = v.snap;
    const dt = v.dt;
    shared.uTime.value = v.time;
    beginShaftSources();
    // (Round 7, the light lane: the frame's local lights start here, focused on the rider. lights.ts.)
    beginLocalLights(s.x, s.y, -s.z);
    lake.uGroundTime.value = reduced() ? 0 : v.time;
    // (How far over any roof the sled flies: a tunnel's light is for a sled under it. palette.ts overRoof.)
    const over = this.journeyAt === null && v.mode !== 'title' && this.mood === Mood.None ? Math.round(overRoof(s.y - this.course.ground(s.x, s.z)) * 8) / 8 : 0;
    this.journey(this.journeyAt ?? (v.mode === 'title' ? 0 : Math.max(0, s.z)), over);
    this.sky.setStill(this.mood === Mood.None && reduced());
    this.updateChunks(s.z);
    const ci = Math.floor(s.z / CHUNK_LEN);
    this.props.update(ci <= 0 ? -2 : ci - 1, ci + this.quality.viewChunks, v.collected, v.destroyed, ci);
    this.speedPosts.update(s.z);

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
    if (v.mode === 'run') for (const e of v.events) {
      this.onEvent(e, s);
      this.spirit.onEvent(e, s);
      if (v.sim && v.sim.charms.length > 0) this.charmEvent(e, s, v.sim);
    }
    if (v.mode === 'run' && v.sim && v.sim.charms.length > 0 && !this.rider.crashing) this.charmSignals(v, dt);
    this.spirit.setReduced(feel.reduced || reduced());
    this.spirit.update(dt, v.mode, s, v.sim, v.ghostPoses, this.quality.detail === 'low');
    // Round 8: the charm gates and a showdown's marker; Lamplit Path's sparks for the rider who holds it.
    const runSim = v.mode === 'run' ? v.sim : null;
    this.charmGates.update(dt, runSim ? runSim.charmGates : null, s.z, feel.reduced || reduced());
    this.props.pathFrom = runSim ? pathFromOf(runSim) : -1;
    // Round 7, the momentsworld lane: the set pieces' stages take the tier, reduced motion and the effects.
    this.marquee.stage(this.quality.detail === 'low' ? 0 : this.quality.detail === 'medium' ? 1 : this.quality.detail === 'high' ? 2 : 3, feel.reduced || reduced(), this.spirit.fireworks, this.spirit.breaks);
    this.marquee.leading = v.lead !== false;
    this.marquee.update(dt, v.time, v.mode, s, v.sim, this.quality.detail === 'low');
    this.lantern.update(dt, v.time, v.mode, s, v.sim, this.cam.camera, this.palette);
    this.oldrun?.update(dt, v.time, v.mode, s, v.sim, this.cam.camera);
    this.gullhaven?.update(dt, v.time, v.mode, s, v.sim, this.cam.camera, this.palette);
    this.row.update(s.z, v.mode, this.palette);
    // Named moments after the raw events: the camera, the ghost layer, then the world's own.
    this.cam.beats(beats, feel);
    this.ghosts.beats(beats, feel);
    if (v.mode === 'run') this.onBeats(beats, v);
    if (v.mode === 'run') this.moments.beats(beats, s);
    this.spirit.beats(beats);
    if (v.mode === 'run') this.marquee.beats(beats, s);
    if (v.mode === 'run') this.lantern.beats(beats, s);
    if (v.mode === 'run') this.oldrun?.beats(beats, s);
    if (v.mode === 'run') this.gullhaven?.beats(beats, s);
    this.flash = Math.max(this.flash, this.spirit.takeFlash());
    this.moments.update(v, dt);
    this.setPieces.update(s.z, this.quality.viewChunks * CHUNK_LEN, tmpV.set(s.x, s.y, -s.z), v.time, v.mode === 'run' ? beats : NO_BEATS);

    // Rider. Earned flow burns on it (uniforms only); 'In the flow' pulses its rim to full for 0.3 s
    // (under reduced motion a softer fade in and out instead of the flash).
    this.flowPulseT += dt;
    const pt = this.flowPulseT;
    const pulse = pt >= FLOW_PULSE_S ? 0 : feel.reduced ? 0.6 * Math.sin((Math.PI * pt) / FLOW_PULSE_S) : pt < 0.05 ? pt / 0.05 : 1 - smooth01((pt - 0.05) / (FLOW_PULSE_S - 0.05));
    // (Only while riding: the crash owns its own beat, and the title reel's hero has earned nothing.)
    const riding = v.mode === 'run' && !this.rider.crashing;
    // (Round 8, the flow pass: Spirit Flow's flame lights the rim and the scarf too, so the scarf reads as the flame's root:
    // the director's earned flow, or most of the flame's own weight where that is more; all of it read as a stippled outline.)
    this.rider.setFlow(riding ? Math.max(feel.flow, 0.6 * this.spiritFlow.look.trail) : 0, riding ? Math.max(feel.flowPulse, pulse) : 0);
    // (And the scarf's tail burns with it: the flame's root.)
    this.rider.setBurn(riding ? this.spiritFlow.look.trail : 0);
    // A dash puts the spirit shimmer on the rider (round 6): in over about 0.1 s, out over about 0.3 s, with
    // after-images on Medium and High.
    const dashing = riding && v.sim !== null && v.sim.s.dash > 0;
    this.dashK += ((dashing ? 1 : 0) - this.dashK) * Math.min(1, dt * (dashing ? 22 : 9));
    if (!riding) this.dashK = 0;
    this.rider.setSpirit(this.dashK < 0.004 ? 0 : this.dashK, this.quality.detail !== 'low', feel.reduced);
    // Round 8 (speed): how hard the snow under the runners is (ice 1, a groomed lane about 0.65, powder 0.15), for
    // the sled's and the lens's chatter.
    const hard = v.mode === 'run' ? (s.onIce ? 1 : 0.15 + 0.5 * groomedAt(this.course, s.z)) : 0;
    this.rider.setChatter(riding && !feel.reduced ? chatterK(s.speed, hard) : 0, chatterPitch(hard));
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
          act: this.moments.act,
          driftCharge: v.mode === 'run' ? feel.driftCharge : 0,
          trick: this.trickOf(v),
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
      // (A tumbling rider cuts no groove and throws no spray: its bursts are moments.ts's.)
      if (this.moments.tumbling) this.trail.lift();
      else if (s.grounded) {
        const depth = Math.max(0.12, s.carve);
        // The groove widens with carve depth; a drift scrubs a wide fan.
        const width = s.drifting ? 1.0 + Math.abs(s.slip) * 1.3 : 0.42 + s.carve * 0.72;
        this.trail.add(s.x, s.z, width, depth, v.time, s.speed);
        let sprayAmt = s.drifting ? 1 : Math.max(0, s.carve - 0.35) * 1.4 + (s.speed > 30 ? 0.15 + 0.25 * roosterK(s.speed) : 0);
        let toward = s.drifting ? -s.driftDir : -Math.sign(s.steer || 1);
        if (v.mode === 'title' && s.speed > 8) {
          // The title reel's hero always throws a light plume off the runner nearer the lens, so the key
          // art carries spray catching the light (ART.md section 11) even on a straight glide.
          sprayAmt = Math.max(sprayAmt, 0.6);
          const c = this.cam.camera.position;
          toward = (c.x - pos.x) * Math.cos(s.heading) + (c.z - pos.z) * Math.sin(s.heading) >= 0 ? 1 : -1;
        }
        // From about 16 m/s the runners kick fine snow up off their tails, and it goes on building to the cap.
        const kick = kickK(s.speed);
        if (kick > 0) this.particles.kick(pos, s.heading, this.landV.set(s.vx, g.x * s.vx + g.z * s.vz, -s.vz), kick * Math.min(2, dt * 60), s.onIce);
        this.sprayAcc += sprayAmt * dt * 60 * 1.6;
        if (this.sprayAcc >= 1) {
          // Spray rides the slope: its carrier follows the ground under the sled (the title reel's
          // snapshot carries no vertical speed, and spray launched level floated off into the sky).
          // A held drift heats it from the first tier on, inside the player's vermillion (Feel's charge
          // and tier), and from tier 2 its grains include hot motes skittering off the runner (a tenth,
          // then a quarter at tier 3): drift sparks in the charge's own ramp.
          const tier = s.drifting && v.mode === 'run' ? Math.min(3, feel.driftTier) : 0;
          const heat = tier > 0 ? DRIFT_C[tier - 1] : null;
          this.particles.spray(pos, s.heading, toward, this.landV.set(s.vx, g.x * s.vx + g.z * s.vz, -s.vz), Math.min(2, this.sprayAcc), s.onIce, heat, feel.driftCharge, tier >= 3 ? 0.26 : tier === 2 ? 0.1 : 0, this.trailTint, this.trailTintK);
          this.sprayAcc = 0;
        }
        // The garage's trail: motes off the runners, more with speed (none on the title reel's hero).
        if (this.trailMote && v.mode === 'run' && s.speed > 6) {
          this.trailAcc += this.trailRate * dt * Math.min(1.4, s.speed / 30);
          const n = Math.floor(this.trailAcc);
          if (n > 0) {
            this.trailAcc -= n;
            this.particles.trailMotes(pos, this.landV.set(s.vx, g.x * s.vx + g.z * s.vz, -s.vz), this.trailMote, n, this.trailStyle);
          }
        }
      } else if (this.wasGrounded) this.trail.lift();
      this.wasGrounded = s.grounded;
    }
    this.trail.flush();

    // Gifts ahead twinkle: every few frames a marigold glint flashes on one of the gifts 5 to 45 m down
    // the line, so a line of gifts reads as a trail of lights to follow (Medium and High).
    this.glintAcc += dt;
    if (v.mode === 'run' && this.quality.detail !== 'low' && this.glintAcc > 0.06) {
      this.glintAcc = 0;
      let pick: Light | null = null;
      let seen = 0;
      for (let k = Math.max(0, ci); k <= ci + 1; k++) {
        for (const gf of this.course.chunk(k).lights) {
          const ahead = gf.z - s.z;
          if (ahead < 5 || ahead > 45 || v.collected.has(gf.id)) continue;
          if (Math.random() * ++seen < 1) pick = gf;
        }
      }
      if (pick) {
        const gy = this.course.ground(pick.x, pick.z) + pick.hover;
        this.particles.glint(this.fxA.set(pick.x + (Math.random() - 0.5) * 0.5, gy + Math.random() * 0.45, -pick.z + (Math.random() - 0.5) * 0.5), pick.value > 1);
      }
    }

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
    // (Round 8, the snow lane: the wind lifts spindrift off the banks' crests ahead. particles.ts.)
    this.particles.spindrift(this.course, s.z, dt);

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
    // panel. Contract C6: on a portrait screen the card leaves the top RESULTS_BAND (plus the safe-area
    // inset) open, and the hero shot centres the wreck in that band. Narrow landscape screens keep
    // the drift around it under a full-screen panel.
    const hero = v.mode === 'results' && !this.moments.finishing && ((this.width > 900 && this.width > this.height) || this.width < this.height);
    if ((hero || this.moments.finishing) && this.width < this.height) this.cam.heroBand = Math.min(0.56, RESULTS_BAND + this.ghosts.safeTop / this.height);
    // (Reduced motion never swings: the chase follows the rider to a stop.)
    this.cam.mode = v.mode === 'title' ? 'orbit' : this.moments.finishing && !feel.reduced ? 'finish' : hero ? 'hero' : this.rider.crashing ? 'crash' : 'chase';
    let chaosShake = 0;
    this.chaos.detail = this.quality.detail;
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
    // The legend in reach (the four mountains' from the marquee's world, Lanternfall's from its own): the
    // chase looks a little toward it.
    const legend = v.mode === 'run' ? (this.marquee.legendShot() ?? this.lantern.legendShot() ?? this.showdownLook(v, dt)) : null;
    // Round 8 (speed): Spirit Flow (spiritflow.ts) off the sim's eased flow and its level events, with the rider's
    // scarf as it now stands; its breath goes to the lens, its colour to the composite, its lift to the ghosts.
    const flowing = v.mode === 'run' && riding && showRider;
    if (flowing && this.devFlow < 0) for (const e of v.events) if (e.type === 'flow') this.spiritFlow.onLevel(e.level, e.from);
    this.spiritFlow.setScale(lensPx());
    this.spiritFlow.update({
      dt,
      time: v.time,
      flow: flowing ? (this.devFlow >= 0 ? this.devFlow : s.flow) : 0,
      vel,
      knot: this.rider.scarfPoint(0, this.flowKnot),
      tip: this.rider.scarfPoint(1, this.flowTip),
      scarfAt: this.scarfAt,
      dir,
      cam: this.cam.camera.position,
      ground: (x, z) => this.course.ground(x, -z),
      reduced: feel.reduced || reduced(),
      // (How far a flip has turned the rider over: the scarf hides behind the sled's underside.)
      flip: s.grounded ? 0 : Math.max(0, Math.min(1, (0.3 - Math.cos(s.airPitch)) / 0.9)),
    });
    const fl = this.spiritFlow.look;
    const fb = this.spiritFlow.takeBreath();
    if (fb !== 0) this.cam.flowBreath(fb);
    const glowLift = Math.round(fl.ghost * 0.8 * 50) / 50;
    if (glowLift !== this.ghostGlowFlow) {
      this.ghostGlowFlow = glowLift;
      this.ghosts.setGlow(this.ghostGlowBase + glowLift);
    }
    const dashOn = v.mode === 'run' && v.sim !== null && v.sim.s.dash > 0 && !this.rider.crashing;
    const chase = () => this.cam.update({ dash: dashOn, hard, flow: fl.fov, pos: focus, dir, speed: s.speed, steer: s.steer, airborne: !s.grounded && !this.moments.tumbling, boost: s.boostGlow, drifting, driftDir: s.driftDir, slip: s.slip, mate, rival, intro, pack, fell, legend, airTime: v.mode === 'run' ? v.airTicks / 60 : 0, airLeft: v.mode === 'run' ? this.landing.timeToLand : Infinity, open: v.mode === 'run' ? this.overlooks.lean(s.z + 25) : 0, place: v.mode === 'run' ? this.overlooks.compose.place(s.z + 20, this.placeAt) : null, tumble: this.moments.tumbling ? 1 : 0, wall: this.moments.act.wall, results: v.mode === 'results' }, dt);
    chase();
    if (this.lens) this.lens(this.cam.camera, focus, dir, dt);
    this.forestLod();

    // Ghosts, landing ring.
    this.ghosts.labels = v.labels !== false;
    this.ghosts.reel = v.mode === 'title';
    this.ghosts.drafting = v.mode === 'run' && s.drafting && !s.crashed;
    // (A mirrored run's labels are laid out on the screen as the player sees it: modes lane.)
    this.mirrorView();
    this.hideGhosts();
    this.ghosts.update(v.ghostPoses, this.cam.camera, this.width, this.height, v.time, focus, (p, c) => this.particles.sparkle(p, c, 16, 2.2, 0.55, 0.2, null, 0.6), v.occluders, v.rival);
    this.mirrorView();
    // The slipstream you ride in: motes of the drafted ghost's colour stream back past the runners.
    if (this.ghosts.wakeK > 0.05 && s.grounded && !this.ghostsOff) this.particles.wake(pos, vel, this.ghosts.wakeCol, this.ghosts.wakeK * Math.min(2, dt * 60));
    this.landing.streak = v.mode === 'run' ? feel.streak : 0;
    // (Round 8: the gold flash keeps to the sim's own window, wider on a save's first run.)
    this.landing.stompS = stompWindowS(v.sim?.config.firstRun === true);
    if (v.mode !== 'run') this.landing.deepGrab = false;
    this.landing.update(s, v.sim ? v.sim.gravity : 9.81, v.airTicks, dt, showRider && v.mode === 'run' && !this.rider.crashing && !this.moments.tumbling);
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
    if (v.mode === 'run') this.shedSnow(s, v.time);
    this.sloughs.update(dt);
    this.particles.update(dt);
    this.life.update(s.x, s.z, v.time, dt, v.mode === 'run' ? beats : NO_BEATS, this.cam.camera.position, dir);

    // Sun and shadow follow the focus.
    this.sunTarget.position.copy(focus);
    if (this.post.pipe.switches.fit && this.quality.shadows) this.fitShadow(focus);
    // Shadows fall from their own, lower light across the slope (palette.ts shadowFrom), so they
    // rake across the run; the snow is still shaded by the lifted key light (uSunDir).
    this.sun.position.copy(this.sunTarget.position).addScaledVector(this.palette.shadowDir, 90);
    this.sunTarget.updateMatrixWorld();
    this.updateFar(v, s.z, dt);
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
    // (Sakura, the calm mountain, keeps half the streaks: at full strength the bottom of its pale frames was
    // a radial smear, and its ripples and shade lost their shape. ART.md 15: a lens that stays out of the way.)
    // (Round 8's review: at 0.55 the near snow still read as a radial smear converging on the rider in eleven of
    // thirty-six frames. A third of the streaks: the calm mountain's speed is in its petals, posts and lens.)
    const calm = this.course.biome === 'blossom' ? 0.35 : 1;
    pp.speed = v.mode === 'run' ? streakK(s.speed) * (tall ? 0.6 : 1) * (feel.reduced ? 0.5 : 1) * this.streakK * calm : 0;
    pp.streakFoot = tall ? 0 : 0.12;
    // Round 8 (speed): Spirit Flow's colour (kept under reduced motion) and its breath (dropped under it).
    pp.flow = fl.colour;
    pp.flowTop = fl.top;
    pp.flowPulse = feel.reduced || reduced() ? 0 : this.spiritFlow.pulse;
    pp.bloomScale = v.mode === 'results' ? 0.55 : tall ? 0.7 : 1;
    // The cool darkening at the foot of the frame holds the near snow's form there too (a bright,
    // smooth slope right under the results lens read as an overexposed smear).
    pp.footScale = v.mode === 'results' ? 1.8 : tall ? 1.3 : 1;
    pp.reduced = feel.reduced || reduced();
    this.post.pipe.lightDir.copy(this.palette.shadowDir);
    pp.punch = feel.reduced ? 0 : this.punch;
    pp.flash = this.flash * (feel.reduced ? 0.5 : 1);
    // (Round 8, the events lane: a dash cools the world round the burning rider, post.ts uCool.)
    pp.cool = v.mode === 'run' ? this.spirit.coolK(this.dashK) : 0;
    // An enclosed run (landmarks.ts): its dark at the frame's edges, the strobe and the way out's flash.
    const encl = this.setPieces.light;
    pp.flash = Math.max(pp.flash, encl.flash * (feel.reduced ? 0.4 : 1));
    // (On the edge of control the frame's corners close in a little.)
    pp.vignette = 1 + encl.shade * 1.5 + (v.mode === 'run' ? 0.3 * edgeK(s.speed) * this.streakK : 0);
    pp.time = v.time;
    // (Photo mode: the lens is free, so what the chase lens does at speed leaves the picture.)
    if (this.photo) {
      pp.speed = 0;
      pp.punch = 0;
      pp.flash = 0;
      pp.flowPulse = 0;
      pp.vignette = 1 + encl.shade * 1.5;
    }
    // The results hero shot is a calm frame: the danger grade lets go once the run is over. It
    // builds from about 60 m and eases in and out, so the wall arriving or a revive never pops it.
    const dangerTo = v.mode === 'run' && v.sim && v.sim.dyn.avalanche.phase === 2 ? Math.max(0, Math.min(1, 1 - (v.sim.s.z - v.sim.dyn.avalanche.z - 4) / 56)) : 0;
    this.danger += (dangerTo - this.danger) * Math.min(1, dt * 3);
    pp.danger = this.danger < 0.002 ? 0 : this.danger;
    // The powder cloud keeps clear of the rider (post.ts), in uv with the origin bottom left.
    pp.riderX = this.riderScreen.x / this.width;
    pp.riderY = 1 - this.riderScreen.y / this.height;
    // (The passes read the frame as drawn; the HUD's callouts read it as shown: a mirrored run's is turned over.)
    if (this.isMirrored) this.riderScreen.x = this.width - this.riderScreen.x;
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
    this.lakeMirror.everywhere = this.post.enabled && this.quality.passes.mirror !== 'sky' && this.post.pipe.switches.mirror;
    this.lakeMirror.update(this.renderer, this.sky.root, this.course, s.z, v.time);
    if (this.cineHold) Object.assign(cine, this.cineHold);
    // (Low's poster, after every system has offered its bright place and the lens has moved.)
    this.poster.update(this.cam.camera, this.width / this.height, feel.reduced || reduced(), this.setPieces.light.shade);
    this.feedBodies();
    this.post.render(this.scene, this.cam.camera);
    if (this.onPicture) this.onPicture(this.renderer.domElement);
    this.renderMirror(v, focus, dir, dt);
    // The riders' labels, over the finished frame (labels.ts: one draw, nothing in the DOM). Photo mode draws none.
    if (!this.photo) this.ghosts.drawLabels(this.renderer);
  }

  /** Round 8, the forest's level of detail by the lens: once the lens has moved, the trees within about 26 m of it are
   *  handed from the far forest to their near build (nearforest.ts), on Medium and up; Low keeps its own trees. */
  private forestLod(): void {
    if (!this.nearForest.root.parent) this.scene.add(this.nearForest.root);
    // (A phone held upright sees a frame a third as wide at the same distance, where Medium's leaner facets were a seventh
    // of it: it draws High's near build.)
    this.nearForest.update(this.cam.camera.position, this.props, this.quality.detail === 'high' || this.width < this.height);
  }

  /** The bodies that move on their own, for the temporal reconstruction's reprojection (postfx/taa.ts): the
   *  rider (or its wreck's two parts) and the ghosts nearest the lens. */
  private feedBodies(): void {
    const taa = this.post.pipe.taa;
    taa.clearBodies();
    if (!this.post.enabled || !this.quality.passes.taa || !this.post.pipe.switches.taa) return;
    // Round 8 (image): the rider's parts are drawn again over the rebuilt frame (a part added since, a hat from the
    // garage, is found here on its first frame).
    // What moves on its own is drawn only after the rebuild (adopted once, for good).
    if (this.post.pipe.switches.hero) {
      const after = this.post.pipe.after;
      this.rider.heroRoots((o, on) => after.hero(o, on));
      for (const o of this.life.movers) after.adopt(o);
      for (const o of this.setPieces.movers) after.adopt(o);
    }
    let n = 0;
    this.rider.motionParts((id, frame, c, h) => {
      frame.updateWorldMatrix(true, false);
      taa.body(-1 - id, frame.matrixWorld, c, h);
      n++;
    });
    this.ghosts.nearestPoses(this.cam.camera.position, BODIES - n, (id, p, q) => taa.bodyAt(id, p, q, GHOST_BOX[0], GHOST_BOX[1]));
  }

  /**
   * Round 7: the shadow map is fitted to what the lens sees and held still on its own texels. Round 6's
   * box sat square on the rider, so half of it lay behind the lens; this one is pushed down the lens's
   * heading (the rider stays a quarter of the way in, with the lens behind it still covered), which puts
   * shadows on the trees and towers the frame is looking at. Its middle then moves only in whole texels
   * of the map, measured along the light's own axes: a shadow's edge no longer crawls as the sled moves
   * under it, which was a shimmer in every frame at speed.
   */
  private fitShadow(focus: Vector3): void {
    const r = this.quality.passes.shadowReach;
    const e = this.cam.camera.matrixWorld.elements;
    const fx = -e[8];
    const fz = -e[10];
    const fl = Math.hypot(fx, fz);
    const t = this.sunTarget.position;
    if (fl > 0.2) t.set(focus.x + (fx / fl) * r * 0.5, focus.y, focus.z + (fz / fl) * r * 0.5);
    // The light's axes, as its shadow camera builds them (looking along -dir, y up).
    const d = this.palette.shadowDir;
    const ax = this.fitX.set(d.z, 0, -d.x);
    if (ax.lengthSq() < 1e-6) return;
    ax.normalize();
    const ay = this.fitY.crossVectors(d, ax).normalize();
    const texel = (2 * r) / this.quality.shadowSize;
    const px = t.dot(ax);
    const py = t.dot(ay);
    t.addScaledVector(ax, Math.round(px / texel) * texel - px).addScaledVector(ay, Math.round(py / texel) * texel - py);
    this.sunTarget.updateMatrixWorld();
  }

  private fitX = new Vector3();
  private fitY = new Vector3();

  /** The far shadows (farshadow.ts) follow the run's window and the light: the near map's box is where they
   *  hand over to it, and the palette says how strong and how soft the light is (a flat grey day casts little,
   *  and softly). The title's light is the run's start, as the colour script's is. */
  private updateFar(v: FrameView, z: number, dt: number): void {
    // (The light the field is baked for is the colour script's: the title's own time, a play-test's.)
    const title = v.mode === 'title';
    if (title !== this.farTitle || this.journeyAt !== this.farAt) {
      this.farTitle = title;
      this.farAt = this.journeyAt;
      this.far.invalidate();
    }
    const q = this.quality;
    const t = this.sunTarget.position;
    this.far.setNearBox(t.x, t.y, t.z, q.shadows ? q.passes.shadowReach : 0, this.palette.shadowDir);
    const p = this.palette;
    // (Where the aurora is the night's key light, a low moon's long shadows give way to it: at full strength they lay
    // the whole Crevasse Fields in one blue and put out the curtains' green, which the snow takes only in the open.)
    const strength = this.farOff ? 0 : p.shadowK * (1 - 0.45 * p.sunSoft) * (1 - 0.8 * Math.min(1, p.key2.k));
    const soften = 1 + 1.5 * p.sunSoft + 1.5 * (1 - p.shadowK);
    const ci = Math.max(0, Math.floor(z / CHUNK_LEN));
    const ahead = q.detail === 'low' ? 900 : q.detail === 'medium' ? 1200 : 1300;
    this.far.update(this.renderer, z, ci === 0 ? -2 : ci - 1, ci + q.viewChunks, ahead, strength, soften, dt);
  }

  /** Rear-view mirror while an avalanche is chasing you: the threat is behind the chase camera,
   *  so a framed inset sitting on the HUD's danger meter looks back up the slope at the wall.
   *  Medium and High only, for the whole chase: the HUD shows the unit's glass from the chase's first
   *  frame, and a clean rider holds the wall at 70 to 90 m (it speeds up past 70), so an inset kept to
   *  within 75 m left that glass empty for most of a good run (decision 33: never an empty frame). */
  private renderMirror(v: FrameView, focus: Vector3, dir: Vector3, dt: number): void {
    const sim = v.sim;
    const gap = sim ? sim.s.z - sim.dyn.avalanche.z : Infinity;
    // (Never in the highlight reel: its lens is the picture, and the HUD the mirror hangs from is away.)
    const want = v.mode === 'run' && sim && sim.dyn.avalanche.phase === 2 && this.quality.detail !== 'low' && !this.lens ? 1 : 0;
    this.mirrorFade += (want - this.mirrorFade) * Math.min(1, dt * 6);
    if (this.mirrorFade < 0.05 || !sim || this.photo) return;
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
      // (The HUD's box is where it shows; a mirrored run's canvas is shown turned over, so the inset is drawn at the
      // box's mirror image, and its picture, mirrored with the rest, looks back up the same mirrored slope.)
      x = this.isMirrored ? w - Math.round(rect.x) - mw : Math.round(rect.x);
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
    // (The ambient life, the mid-ground and the set pieces stay out of the mirror: they cost draws
    // and CPU on the chase's busiest frames, and the inset is about the wall.)
    this.life.root.visible = false;
    this.midground.root.visible = false;
    this.setPieces.root.visible = false;
    this.speedPosts.mesh.visible = false;
    this.rails.root.visible = false;
    this.post.renderInset(this.scene, this.mirrorCam, x, y, mw, mh, this.mirrorFade, Math.max(0, Math.min(1, 1 - gap / 50)), refresh);
    if (refresh) this.props.nearOnly(false);
    this.life.root.visible = true;
    this.midground.root.visible = true;
    this.setPieces.root.visible = true;
    this.speedPosts.mesh.visible = this.quality.detail !== 'low';
    this.rails.root.visible = true;
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
          if (b.quality === 'perfect' && !this.ghostsOff) this.ghostStompFx(b, v);
          break;
        case 'pass':
          this.passFx(b, v);
          break;
        case 'charmGate':
          if (b.phase === 'take') this.charmFx(b, v);
          break;
        case 'synergy':
          // A named pair: a ring of white-gold light round the rider, low over the snow.
          this.particles.ring(this.fxA.set(s.x, s.y + 0.4, -s.z), GOLD_WHITE, this.quality.detail === 'low' ? 14 : 30, 4.2, this.riderCarrier(s), 3, 1.5, 0.6, 0.2);
          break;
        case 'showdown':
          this.showdownFx(b, v);
          break;
        case 'steal':
          this.stealFx(b, v);
          break;
        default:
          break;
      }
    }
  }

  /** Round 8: a charm taken. Its arch answers with light (charmgates.ts) and throws a ring of its family's colour off
   *  its crown; the motes of it ride with the rider for a moment. */
  private charmFx(b: BeatOf<'charmGate'>, v: FrameView): void {
    const g = v.sim?.charmGates[b.gate];
    if (!g || b.lane < 0) return;
    const col = FAMILY_C[charmFamily(b.id)];
    const low = this.quality.detail === 'low';
    const top = this.charmGates.crown(g, b.lane, this.fxA);
    this.particles.ring(top, col, low ? 12 : 26, 3.4, null, 4, 1.6, 0.55, 0.22);
    this.particles.sparkle(this.fxB.set(v.snap.x, v.snap.y + 0.9, -v.snap.z), col, low ? 8 : 16, 2.2, 0.5, 0.2, this.riderCarrier(v.snap), 0.6);
  }

  /** Round 8: a showdown. Its marker stands 300 m on with a band of the rival's colour; decided, it bursts in the
   *  winner's (a won showdown lights a lantern cell: marigold motes run into the rider). */
  private showdownFx(b: BeatOf<'showdown'>, v: FrameView): void {
    const rival = GHOST_C[b.ghost.kind] ?? GHOST_C.pool;
    if (b.phase === 'start') {
      this.sdLook = { id: b.ghost.id, t: 0 };
      this.charmGates.showdown(b.markerZ, rival);
      return;
    }
    const won = b.phase === 'won';
    this.charmGates.showdownEnd(won ? LIGHT_C : rival, won);
    const z = b.markerZ;
    const x = this.course.safeX(z);
    const at = this.fxA.set(x, this.course.ground(x, z) + 8, -z);
    this.particles.burst(at, 2.4, this.quality.detail === 'low' ? 20 : 44, undefined, won ? LIGHT_C : rival);
    if (won) this.particles.sparkle(this.fxB.set(v.snap.x, v.snap.y + 0.9, -v.snap.z), LIGHT_C, this.quality.detail === 'low' ? 10 : 22, 2.4, 0.55, 0.22, this.riderCarrier(v.snap), 0.6);
  }

  /** Round 8: as a showdown starts the lens leans toward its rival for a moment, as it does toward a legend (the
   *  camera's own legend look: at most about 8 degrees, never the steering, giving way in the air and in a tumble,
   *  none under reduced motion), so the player sees who they race. It looks a little past the rival, down its side
   *  of the run: a rival level with the rider is beside the lens, where no chase camera can look. */
  private sdLook: { id: number; t: number } | null = null;
  private readonly sdAt = { x: 0, y: 0, z: 0, peak: 0 };
  private showdownLook(v: FrameView, dt: number): { x: number; y: number; z: number; peak: number } | null {
    const l = this.sdLook;
    if (!l) return null;
    l.t += dt;
    const p = v.ghostPoses.get(l.id);
    if (l.t > SD_LOOK_S || !p || p.done) {
      this.sdLook = null;
      return null;
    }
    const at = this.sdAt;
    const z = p.z + 14;
    at.x = p.x;
    at.y = this.course.ground(p.x, z) + 1;
    at.z = -z;
    // (Whole for most of it, then letting go over its last 0.8 s; the camera eases both ways itself.)
    at.peak = l.t < SD_LOOK_S - 0.8 ? 1 : (SD_LOOK_S - l.t) / 0.8;
    return at;
  }

  /** Round 8: a wisp stolen. A thread of the ghost's own light is pulled from it into the rider, where it turns to
   *  the lantern's marigold. */
  private stealFx(b: BeatOf<'steal'>, v: FrameView): void {
    const pose = v.ghostPoses.get(b.ghost.id);
    const s = v.snap;
    const car = this.riderCarrier(s);
    const me = this.fxB.set(s.x, s.y + 0.9, -s.z);
    const low = this.quality.detail === 'low';
    if (pose && !pose.done) {
      const from = this.fxA.set(pose.x, this.course.ground(pose.x, pose.z) + 1.0, -pose.z);
      this.particles.line(from, me, GHOST_C[b.ghost.kind] ?? GHOST_C.pool, low ? 8 : 18, car, 1.4);
    }
    this.particles.sparkle(me, LIGHT_C, low ? 6 : 12, 1.6, 0.5, 0.2, car, 0.5);
  }

  /** Round 8: the held charms' signals in the world (charms.ts CHARMS[id].signal), each the one thing on screen that
   *  says its charm is working: blue sparks off the runners on ice (Frost Runners), a streak off a big landing
   *  (Falling Star), a ring of snow off a spin (Whirlwind), paper ribbons at each grab tier (Paper Kite), snow shed
   *  instead of a stagger (Bark Skin), the rider springing up (Quick Feet), the drift ring beating its tiers (Drift
   *  Drum). Low throws fewer of each. */
  private charmEvent(e: SimEvent, s: Snap, sim: Sim): void {
    const low = this.quality.detail === 'low';
    const at = this.fxA.set(s.x, s.y + 0.25, -s.z);
    switch (e.type) {
      case 'land':
        if (sim.has(CHARM.star) && e.airtime >= 1 && e.quality !== 'sketchy') {
          const car = this.riderCarrier(s);
          const back = this.fxB.copy(at).addScaledVector(car, -0.12);
          this.particles.line(back, at, FAMILY_C.speed, low ? 6 : 14, car, 1.6);
        }
        if (sim.has(CHARM.whirl) && e.halfTurns >= 2) this.particles.ring(at, SNOW_C, low ? 10 : 22, 3.6, this.riderCarrier(s), 0, 1.1, 0.5, 0.24);
        break;
      case 'grab':
        if (e.phase === 'tier' && sim.has(CHARM.paper)) {
          this.particles.sparkle(this.fxB.set(s.x, s.y + 1.0, -s.z), FAMILY_C.style, low ? 5 : 10, 2.2, 0.5, 0.2, this.riderCarrier(s), 0.4);
          this.particles.sparkle(this.fxB.set(s.x, s.y + 1.0, -s.z), PAPER_C, low ? 3 : 6, 2.0, 0.55, 0.22, this.riderCarrier(s), 0.4);
        }
        break;
      case 'bump':
        if (sim.has(CHARM.bark)) this.particles.shedAt(s.x, s.y + 1.2, -s.z, low ? 6 : 14);
        break;
      case 'tumble':
        if (e.phase === 'end' && sim.has(CHARM.quick)) this.particles.ring(at, FAMILY_C.survival, low ? 8 : 16, 3, this.riderCarrier(s), 0, 1.3, 0.4, 0.18);
        break;
      case 'drift':
        if (e.phase === 'tier' && sim.has(CHARM.drum)) this.particles.ring(at, FAMILY_C.speed, low ? 6 : 12 + 4 * e.tier, 2.4 + 0.6 * e.tier, this.riderCarrier(s), 0, 1.3, 0.35, 0.16);
        break;
      default:
        break;
    }
  }

  /** Round 8: the held charms' standing signals, every frame (charmEvent has the momentary ones): Guardian Wisp's
   *  wisp circling the rider until it is spent, Kite String's taut thread to the ghost drafted, Frost Runners' sparks
   *  on ice, Long Stride's wind line off the helmet in a tuck. Reduced motion keeps the wisp still at the shoulder. */
  private charmSignals(v: FrameView, dt: number): void {
    const sim = v.sim!;
    const s = v.snap;
    const low = this.quality.detail === 'low';
    this.charmT += dt;
    const every = low ? 0.12 : 0.06;
    if (this.charmT < every) return;
    this.charmT = 0;
    const calm = reduced();
    const car = this.riderCarrier(s);
    if (wispUp(sim)) {
      const a = calm ? 0.8 : v.time * 3.2;
      this.particles.sparkle(this.fxA.set(s.x + Math.cos(a) * 0.95, s.y + 1.25, -s.z + Math.sin(a) * 0.95), WISP_C, 1, 0.15, 0.5, 0.2, car, 0.05);
    }
    if (sim.has(CHARM.frost) && s.onIce && s.grounded && s.speed > 8) this.particles.sparkle(this.fxA.set(s.x, s.y + 0.08, -s.z), FAMILY_C.speed, low ? 2 : 4, 1.8, 0.3, 0.12, car, 0.1);
    if (sim.has(CHARM.stride) && s.grounded && s.action && !s.drifting && s.speed > 18) {
      const head = this.fxA.set(s.x, s.y + 1.35, -s.z);
      this.particles.line(head, this.fxB.copy(head).addScaledVector(car, -0.05), WIND_C, low ? 2 : 3, car, 0.9);
    }
    if (sim.has(CHARM.kite) && s.drafting) {
      // The ghost being drafted: the nearest ahead in the slipstream's cone.
      let best: GhostPose | null = null;
      for (const p of v.ghostPoses.values()) {
        if (!p || p.done || p.finished) continue;
        if (draftsOn(s, p) && (!best || p.z < best.z)) best = p;
      }
      if (best) this.particles.line(this.fxA.set(s.x, s.y + 0.8, -s.z), this.fxB.set(best.x, best.y + 0.8, -best.z), FAMILY_C.speed, low ? 4 : 8, car, 1.5);
    }
  }

  private charmT = 0;

  /** The sled's velocity in three.js space, for effects that ride with it. */
  private riderCarrier(s: Snap): Vector3 {
    this.course.gradient(s.x, s.z, this.landG);
    return this.landV.set(s.vx, this.landG.x * s.vx + this.landG.z * s.vz, -s.vz);
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
    // A whisker also strikes a quick ring of white glints off the snow where you shaved it.
    if (b.grade === 'whisker') this.particles.ring(this.fxB, WHISKER_C, 9, 3.4, this.carrier(s), 0, 1.3, 0.3, 0.13);
  }

  /** Trees near the corridor's edge shed snow as a rider passes close at speed: a forest tree in the near
   *  rows (a tree run's wall, the treeline, an orchard's first rows) passed within SHED_R of its trunk at
   *  SHED_SPEED or more lets a sift fall off its boughs, the near miss's own (the same burst, placed by
   *  brush.ts on the side you passed it, about two thirds of an ordinary near miss's count), once a tree.
   *  Every tier: it reads the chunks' packed forest (no draw, nothing made), the particle budget scales
   *  it as it does every burst, and on Low, whose budget is 0.45, a shed is six or seven grains. */
  private shedSnow(s: Snap, time: number): void {
    if (s.crashed || s.speed < SHED_SPEED) return;
    // A new run (or a revive far off) forgets which trees have shed.
    if (!(Math.abs(s.z - this.shedZ) < 120) || time < this.shedT) {
      this.shedKeys.clear();
      this.shedT = -1;
    }
    this.shedZ = s.z;
    const n = this.props.treesNear(s.x, s.z, SHED_R, 1.5, this.shedBuf);
    for (let k = 0; k < n; k++) {
      const key = this.shedBuf[k * 3];
      // (Scraping along a tree run's wall, a sift every 0.15 s at most: discrete falls, not a stream.)
      if (this.shedKeys.has(key) || time - this.shedT < 0.15) continue;
      this.shedKeys.add(key);
      if (this.shedKeys.size > 256) this.shedKeys.delete(this.shedKeys.values().next().value as number);
      if (brushPoint(s, this.shedBuf[k * 3 + 1], this.shedBuf[k * 3 + 2], this.groundAt, this.cam.camera, this.fxB, this.fxT, BRUSH_REACH_BOUGH) === 0) continue;
      this.particles.brush(this.fxB, this.fxT, this.carrier(s), true, false, 15);
      this.shedT = time;
    }
  }

  private shedKeys = new Set<number>();
  private shedBuf: number[] = new Array(24).fill(0);
  private shedZ = Number.NaN;
  private shedT = -1;

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

  /** Dev only (`?debug&ghosts=0`, the snow2 lane): the ghosts, their light, ruts and labels left out of the picture,
   *  so a still pair is judged on the snow alone (a pick turned on which ghost sat ahead). Render only: the race,
   *  its beats and every pose run as ever, and nothing here reaches the sim. */
  private hideGhosts(): void {
    if (!this.ghostsOff) return;
    this.ghosts.labels = false;
    this.ghosts.root.visible = false;
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
    this.particles.ring(at, GHOST_C[b.ghost.kind] ?? GHOST_C.pool, 10, 3.6, vel, 0, 1.3, 0.4, 0.17, this.quality.detail === 'low' ? 4 : Infinity);
  }

  /** You passed a ghost: its glass shatters into petals of its kind colour with a flare at its heart,
   *  riding at its pace so they fall back behind you (ghosts.ts drops its name pill back). Low throws
   *  a few. */
  private passFx(b: BeatOf<'pass'>, v: FrameView): void {
    if (this.ghostsOff) return;
    const pose = v.ghostPoses.get(b.ghost.id);
    if (!pose || pose.done) return;
    this.course.gradient(pose.x, pose.z, this.landG);
    const vx = Math.sin(pose.heading) * pose.speed;
    const vz = Math.cos(pose.heading) * pose.speed;
    const vel = this.fxV.set(vx, this.landG.x * vx + this.landG.z * vz, -vz);
    // The race's pass rule fires with the ghost 0.8 m behind you, between the rider and the lens: the
    // burst goes off at its side of the run level with the rider and a little ahead, low, so it plays
    // out beside the hero and falls back past it (thrown where the ghost was, it filled the lens).
    const z = Math.max(pose.z, v.snap.z + 0.9);
    const at = this.fxA.set(pose.x, this.course.ground(pose.x, z) + 0.6, -z);
    this.particles.shatter(at, GHOST_C[b.ghost.kind] ?? GHOST_C.pool, vel, this.quality.detail === 'low' ? 10 : 28);
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

  /** Round 8: what the sim says the rider is doing in the air, for its pose (rider.ts, trickpose.ts); a deep grab
   *  still held as the snow comes up strains it (the landing ring warns too: landing.ts). */
  private readonly trickIn = { move: 0, grab: 0, tier: 0, tweak: 0, danger: 0 };
  private trickOf(v: FrameView): RiderPose['trick'] {
    const sim = v.sim;
    if (v.mode !== 'run' || !sim) return undefined;
    const s = sim.s;
    const t = this.trickIn;
    t.move = s.move;
    t.grab = s.grab;
    t.tier = s.grabTier;
    t.tweak = s.tweak;
    t.danger = grabDanger(s.grab !== 0 && s.grabTier >= 2, this.landing.timeToLand);
    this.landing.deepGrab = s.grab !== 0 && s.grabTier >= 2;
    return t;
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
        this.moments.landed(e, s);
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
      case 'light':
        // The light goes into the lantern: a soft flare of marigold motes that rides along with the sled
        // for its moment (no confetti: a light is not a present, and red is the rider's alone).
        this.course.gradient(s.x, s.z, this.landG);
        this.particles.sparkle(this.fxA.set(e.x, e.y + 0.3, -e.z), e.value > 1 ? LIGHT_GREAT_C : LIGHT_C, e.value > 1 ? 22 : 9, e.value > 1 ? 2.6 : 1.6, 0.42, e.value > 1 ? 0.24 : 0.18, this.landV.set(s.vx, this.landG.x * s.vx + this.landG.z * s.vz, -s.vz), 0.5);
        this.props.markDirty();
        break;
      case 'dash':
        // The lens punches out as the air opens.
        if (e.phase === 'start') this.punch = 1;
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
