import { ChaosEvent, ChaosRoll, Mood, MoodParams, eventTriggerZ, moodInfo } from './chaos';
import { CHUNK_LEN, Course, Obstacle, ObstacleKind, Rail, SkyGate, courseFor } from './course';
import { PI, TAU, angleDiff, approach, clamp, datan2, dcos, dsin, wrapAngle } from './dmath';
import { MAX_RUN_TICKS, actionOf, draftOf, spiritOf, steerOf } from './input';
import { Rng } from './prng';
import { Combo, StyleKind } from './scoring';
import { SledDef, sledById } from './sleds';
import { type MomentPlay, fallPace, fallZ, machineZ, momentPlays } from './moments';

// The deterministic run simulation. One call to step() advances exactly one 60 Hz tick.

/** Bump whenever simulation behaviour changes; bundled ghost pools record the version they were made with. */
export const SIM_VERSION = 8;
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const SLED_RADIUS = 0.55;
export const MAX_SPEED = 46;
/** No flip starts this close to touchdown (a full flip takes about 55 ticks, so none is lost). */
export const FLIP_GUARD_TICKS = 20;
const G = 9.81;
/** Air drag: cruise on the base slope is about 30 m/s, so a good run lives near 30 and peaks at the cap. */
const CD = 0.0027;
const MU = 0.03;
/** A rider starts moving: the start ramp is steep and a first-timer should be flying within seconds. */
const START_SPEED = 14;
/** A wipeout's tumble, in ticks: the rider bounces back to the line, the run goes on, the time is lost. */
export const TUMBLE_TICKS = 66;
/** Wipeouts a run forgives after the free stretch; the next one ends it. */
export const TUMBLES = 2;
/** Before this distance a wipeout is always free: nobody's first minute ends in a wreck. */
export const FREE_TUMBLE_Z = 700;
/** Past the corridor's edge by this much a sled counts as riding the wall. */
const WALL_RIDE_E = 1.2;
const WALL_RIDE_TICKS = 30;
/** The ground heading limit either side of the corridor's own direction, and where it starts to bite. */
const CARVE_LIMIT = 1.05;
const CARVE_SOFT = 0.82;
/** Ticks before touchdown the rider sets for the landing: steering stops adding spin and the sled swings
 *  to the nearest straight line. Stomp timing stays the skill, not surviving your own thumbs. */
export const LAND_SET_TICKS = 14;
/** Par for the time bonus: the finish reached at this speed earns nothing. */
const PAR_SPEED = 24;

// The lantern: what spirit lights and skill charge, and what a dash or a ward spends.
/** One lantern's worth of charge; three lanterns hang on the sled. */
export const LANTERN = 100;
export const LANTERN_MAX = 300;
/** What a spark and a great light are worth (a light's value 1 or 3). */
const SPARK = 6;
const GREAT = 25;
/** A dash: how long the sled runs as a spirit, what it adds to the speed, how much of the air's drag is
 *  left, and how far over the cap it may go while it lasts. */
export const DASH_TICKS = 84;
const DASH_BOOST = 7;
const DASH_DRAG = 0.55;
const DASH_CAP = 4;
/** A ward takes the hit: the sled keeps this much of its speed and is untouchable for a moment. */
const WARD_KEEP = 0.84;
const WARD_INVULN = 50;
const WARD_GHOST = 30;
/** A sled held under this speed this long is nudged back to its line (wedged against a rock in a hollow). */
const STUCK_SPEED = 2.5;
const STUCK_TICKS = 60;
/** Over the cap after a dash, speed eases back down at this rate (m/s per second), never in a step. */
const OVERCAP_EASE = 6;
/** A near miss under this edge gap is a whisker (the director's WHISKER_GAP): it lights more. */
const WHISKER = 0.45;
/** Set pieces (moments.ts): the lantern a gate threaded and a ring flown light, how near the fall comes before
 *  it is close, and the speed a sled the fall catches keeps. */
const GATE_UNITS = 6;
const RING_UNITS = 12;
const COLLAPSE_CLOSE = 7;
const COLLAPSE_KEEP = 0.72;

export type CrashCause = 'tree' | 'rock' | 'forest' | 'landing' | 'yeti' | 'avalanche' | 'daylight';
export type TumbleCause = Exclude<CrashCause, 'avalanche' | 'daylight'>;
export type TakeoffKind = 'lip' | 'pop' | 'geyser';
export type LandQuality = 'perfect' | 'clean' | 'sketchy' | 'hop';

export type SimEvent =
  | { type: 'takeoff'; kind: TakeoffKind; vy: number }
  | { type: 'land'; quality: LandQuality; airtime: number; halfTurns: number; flips: number; impact: number; late: boolean }
  | { type: 'crash'; cause: CrashCause }
  /** A wipeout the run survives: 'start' as the rider goes down, 'end' back on the line. */
  | { type: 'tumble'; phase: 'start' | 'end'; cause: TumbleCause; left: number }
  /** Turned back by something solid at the corridor's edge. */
  | { type: 'scrape'; side: -1 | 1; speed: number }
  /** A stage line crossed: its index and the tick. */
  | { type: 'stage'; index: number; tick: number }
  /** The finish line crossed. */
  | { type: 'finish'; tick: number; bonus: number }
  | { type: 'grind'; phase: 'start' | 'end'; id: number }
  /** Near-miss styles may carry the edge gap (m), the side (+1 = obstacle on the sled's +x side), the
   *  nearest point on the obstacle (x, z), its kind and id. Optional and never hashed; filled later. */
  | { type: 'style'; kind: StyleKind; points: number; chain: number; mult: number; gap?: number; side?: -1 | 1; x?: number; z?: number; obs?: ObstacleKind; id?: number }
  | { type: 'comboBank'; points: number; mult: number }
  | { type: 'comboLost'; points: number }
  /** A spirit light taken: its id, value (1 or 3), the charge it gave and where it was. */
  | { type: 'light'; id: number; value: number; gain: number; x: number; y: number; z: number }
  /** A sky gate ridden through. */
  | { type: 'skyGate'; id: number; stage: number }
  /** A set piece's verb (moments.ts) as it plays: 'start' as the rider reaches it, 'step' as a gate is
   *  threaded, a ring flown or a step stomped (n of `of`), 'miss' as one is not (n back to 0 for gates and
   *  rings, the run of steps over), 'lead' and 'trail' as the rider passes the race's machine or it passes
   *  back, 'close' as a collapse's fall comes within a few metres, and 'won' or 'lost' as it is decided. */
  | { type: 'moment'; index: number; phase: 'start' | 'step' | 'miss' | 'lead' | 'trail' | 'close' | 'won' | 'lost'; n: number; of: number }
  /** The lantern crossed a whole lantern: 'lit' as one fills, with the count of full ones now. */
  | { type: 'lantern'; phase: 'lit'; cells: number }
  /** A dash: 'start' as a lantern is spent, 'end' as the sled is solid again. */
  | { type: 'dash'; phase: 'start' | 'end'; cells: number }
  /** A full lantern took a hit that would have been a wipeout. */
  | { type: 'ward'; cause: TumbleCause; cells: number }
  | { type: 'bump'; id: number }
  | { type: 'smash'; id: number; x: number; y: number; z: number }
  | { type: 'drift'; phase: 'start' | 'tier' | 'release' | 'end'; tier: number }
  | { type: 'boost'; amount: number; source: 'drift' | 'perfect' | 'slingshot' | 'pop' }
  | { type: 'chaos'; phase: 'warn' | 'start' | 'end' | 'success'; event: ChaosEvent }
  | { type: 'revive' };

export interface SimConfig {
  seed: number;
  chaos: ChaosRoll;
  sled: number;
}

export interface SledState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Body yaw. 0 points downhill (+z), positive turns toward +x. */
  heading: number;
  /** Direction of horizontal velocity. */
  velHeading: number;
  speed: number;
  steer: number;
  lean: number;
  grounded: boolean;
  action: boolean;
  /** Ticks the action has been held while grounded (pop charge). */
  groundHold: number;
  airHold: number;
  pressStartedGrounded: boolean;
  drifting: boolean;
  driftDir: number;
  driftCharge: number;
  driftTier: number;
  slip: number;
  /** 0..1 groove depth for the trail. */
  carve: number;
  carveTicks: number;
  carveDir: number;
  boostPool: number;
  boostGlow: number;
  airTicks: number;
  airYaw: number;
  airPitch: number;
  spinRate: number;
  pitchRate: number;
  lastPressTick: number;
  lateStompTicks: number;
  wobble: number;
  draftTicks: number;
  draftCharge: number;
  drafting: boolean;
  flow: number;
  invuln: number;
  crashed: boolean;
  crashCause: CrashCause | null;
  crashTick: number;
  onIce: boolean;
  /** Ticks left in a wipeout's tumble (0 when riding). */
  tumble: number;
  /** Wipeouts spent from the run's allowance. */
  tumbles: number;
  /** Over the finish line (the sled coasts on, the run is decided). */
  finished: boolean;
  finishTick: number;
  /** Ticks in a row riding the wall. */
  wallTicks: number;
  /** On a rail. */
  grinding: boolean;
  /** The lantern's charge, 0 to LANTERN_MAX: a full LANTERN is one dash or one ward. */
  lantern: number;
  /** Ticks left of a dash (0 when solid). */
  dash: number;
  /** Ticks the sled passes through obstacles without a dash's speed: after a ward, or a rescue. */
  ghost: number;
}

export interface AvalancheState {
  phase: number;
  z: number;
  speed: number;
  ticks: number;
}

export interface YetiState {
  phase: number;
  x: number;
  z: number;
  dir: number;
  ticks: number;
  hopped: boolean;
}

export interface StormGift {
  id: number;
  x: number;
  z: number;
  y: number;
  value: number;
  spawnTick: number;
  collected: boolean;
}

export interface Spirit {
  x: number;
  y: number;
  z: number;
  offset: number;
}

export interface DynState {
  triggerZ: number;
  avalanche: AvalancheState;
  yeti: YetiState;
  storm: StormGift[];
  stormPhase: number;
  stormTicks: number;
  spirits: Spirit[];
  trainPhase: number;
  trainTicks: number;
  warnTicks: number;
}

export interface RunStats {
  perfects: number;
  cleans: number;
  sketchies: number;
  maxAirtime: number;
  maxHalfTurns: number;
  flips: number;
  driftTicks: number;
  draftTicks: number;
  nearMisses: number;
  gifts: number;
  smashes: number;
  gates: number;
  bestCombo: number;
  maxSpeed: number;
  yetiHop: boolean;
  outranAvalanche: boolean;
  revived: boolean;
  /** Spirit lights taken, and the charge they and skill gave the lantern. */
  lights: number;
  greatLights: number;
  lit: number;
  litBySkill: number;
  dashes: number;
  wards: number;
  /** Obstacles ridden through as a spirit. */
  phased: number;
  skyGates: number;
  /** Set pieces won (their verb beaten), and a bit per set piece by its index. */
  momentsWon: number;
  momentMask: number;
}

/** A set piece being played: which, from which tick, its count so far and how it stands. */
export interface MomentState {
  /** Index of the set piece being played, -1 between them. */
  active: number;
  /** The next set piece down the course. */
  next: number;
  t0: number;
  n: number;
  of: number;
  /** Race: the rider is ahead of the machine. Collapse: the fall has come close. */
  ahead: boolean;
  close: boolean;
  /** Gates and rings: the next one down the run. Steps: whether every landing so far was perfect. */
  at: number;
  ok: boolean;
  /** Collapse: the fall's pace, from the rider's speed onto the span (moments.ts fallPace). */
  pace: number;
}

const vec = { x: 0, z: 0 };
/** The drift's release pays more speed at the new cruise, by tier. */
const DRIFT_BOOST = [0, 4.5, 7.5, 11];

export class Sim {
  readonly config: SimConfig;
  readonly course: Course;
  readonly sled: SledDef;
  readonly mood: MoodParams;
  readonly s: SledState;
  readonly combo: Combo;
  readonly dyn: DynState;
  readonly stats: RunStats;
  readonly events: SimEvent[] = [];
  readonly collected = new Set<number>();
  readonly destroyed = new Set<number>();
  tick = 0;
  maxZ = 0;
  private prevAction = false;
  private prevSpirit = false;
  /** The sky gates not yet passed, in order down the course. */
  private gates: readonly SkyGate[];
  private gateAt = 0;
  private nearMiss = new Map<number, number>();
  private resolvedObstacles = new Set<number>();
  private ventCooldown = 0;
  private chaosRng: Rng;

  constructor(config: SimConfig) {
    this.config = config;
    this.course = courseFor(config.seed);
    this.sled = sledById(config.sled);
    this.mood = moodInfo(config.chaos.mood).params;
    this.combo = new Combo(this.sled.comboWindow * this.mood.comboWindow);
    this.chaosRng = new Rng(config.chaos.seed ^ 0x51ed);
    const z0 = 2;
    const x0 = this.course.safeX(z0);
    const v0 = START_SPEED;
    this.s = {
      x: x0,
      y: this.course.ground(x0, z0),
      z: z0,
      vx: 0,
      vy: 0,
      vz: v0,
      heading: 0,
      velHeading: 0,
      speed: v0,
      steer: 0,
      lean: 0,
      grounded: true,
      action: false,
      groundHold: 0,
      airHold: 0,
      pressStartedGrounded: false,
      drifting: false,
      driftDir: 0,
      driftCharge: 0,
      driftTier: 0,
      slip: 0,
      carve: 0,
      carveTicks: 0,
      carveDir: 0,
      boostPool: 0,
      boostGlow: 0,
      airTicks: 0,
      airYaw: 0,
      airPitch: 0,
      spinRate: 0,
      pitchRate: 0,
      lastPressTick: -1000,
      lateStompTicks: 0,
      wobble: 0,
      draftTicks: 0,
      draftCharge: 0,
      drafting: false,
      flow: 0,
      invuln: 0,
      crashed: false,
      crashCause: null,
      crashTick: -1,
      onIce: false,
      tumble: 0,
      tumbles: 0,
      finished: false,
      finishTick: -1,
      wallTicks: 0,
      grinding: false,
      lantern: 0,
      dash: 0,
      ghost: 0,
    };
    this.gates = this.course.skyGates;
    this.course.gradient(x0, z0, vec);
    this.s.vy = vec.z * this.s.vz;
    this.dyn = {
      triggerZ: eventTriggerZ(config.chaos),
      avalanche: { phase: 0, z: 0, speed: 0, ticks: 0 },
      yeti: { phase: 0, x: 0, z: 0, dir: 1, ticks: 0, hopped: false },
      storm: [],
      stormPhase: 0,
      stormTicks: 0,
      spirits: [],
      trainPhase: 0,
      trainTicks: 0,
      warnTicks: 0,
    };
    this.stats = {
      perfects: 0,
      cleans: 0,
      sketchies: 0,
      maxAirtime: 0,
      maxHalfTurns: 0,
      flips: 0,
      driftTicks: 0,
      draftTicks: 0,
      nearMisses: 0,
      gifts: 0,
      smashes: 0,
      gates: 0,
      bestCombo: 0,
      maxSpeed: 0,
      yetiHop: false,
      outranAvalanche: false,
      revived: false,
      lights: 0,
      greatLights: 0,
      lit: 0,
      litBySkill: 0,
      dashes: 0,
      wards: 0,
      phased: 0,
      skyGates: 0,
      momentsWon: 0,
      momentMask: 0,
    };
    this.plays = momentPlays(this.course);
  }

  /** The course's set pieces and what their verbs hold (moments.ts). */
  readonly plays: readonly MomentPlay[];
  /** The set piece being played (public: the renderer reads the race's machine and the collapse's fall). */
  readonly mo: MomentState = { active: -1, next: 0, t0: 0, n: 0, of: 0, ahead: false, close: false, at: 0, ok: true, pace: 0 };

  /** Small direct score from spirit lights (they are the lantern's fuel, not combo fuel). */
  lightScore = 0;
  /** The finish's bonus: flat, plus what the run beat par by. */
  finishBonus = 0;
  /** The tick each stage line was crossed. */
  readonly stageTicks: number[] = [];

  get score(): number {
    return Math.floor(this.maxZ) + this.combo.banked + this.lightScore + this.finishBonus;
  }

  get finished(): boolean {
    return this.s.finished;
  }

  get distance(): number {
    return this.maxZ;
  }

  get gravity(): number {
    return G * this.mood.gravity;
  }

  /** Riding home as a spirit: a sim of its own, started where a run was wrecked, after the race is over. It is
   *  never recorded and never replayed, so nothing here can touch a run: it passes through everything, cannot
   *  wipe out, lights nothing, meets no event and drafts nobody, and coasts into the town at the line. */
  homeward = false;

  static homewardFrom(run: Sim): Sim {
    const sim = new Sim(run.config);
    sim.homeward = true;
    const s = sim.s;
    const z = run.s.z + 3;
    s.z = z;
    s.x = sim.course.safeX(z);
    s.y = sim.course.ground(s.x, z);
    s.speed = Math.max(14, 0.6 * sim.cruiseSpeed());
    s.vx = 0;
    s.vz = s.speed;
    sim.course.gradient(s.x, z, vec);
    s.vy = vec.z * s.vz;
    s.ghost = 1 << 30;
    sim.tick = run.tick;
    sim.maxZ = z;
    return sim;
  }

  /** Bring a crashed sled back onto the safe line (rewarded revive). */
  revive(): void {
    const s = this.s;
    if (!s.crashed) return;
    // Only the revive itself is news; the crash tick's events were already delivered.
    this.events.length = 0;
    const z = s.z + 3;
    s.z = z;
    s.x = this.course.safeX(z);
    s.y = this.course.ground(s.x, z);
    s.vx = 0;
    s.vz = 12;
    s.speed = 12;
    // Follow the slope so the first tick does not read as a launch off a lip.
    this.course.gradient(s.x, z, vec);
    s.vy = vec.x * s.vx + vec.z * s.vz;
    this.prevAction = false;
    s.action = false;
    s.groundHold = 0;
    s.airHold = 0;
    s.pressStartedGrounded = false;
    s.lateStompTicks = 0;
    s.carveTicks = 0;
    s.draftTicks = 0;
    s.draftCharge = 0;
    this.coyote = 0;
    this.airPressed = false;
    s.heading = 0;
    s.velHeading = 0;
    s.grounded = true;
    s.airTicks = 0;
    s.airYaw = 0;
    s.airPitch = 0;
    s.spinRate = 0;
    s.pitchRate = 0;
    s.drifting = false;
    s.driftCharge = 0;
    s.driftTier = 0;
    s.boostPool = 0;
    s.wobble = 0;
    s.invuln = 150;
    s.crashed = false;
    s.crashCause = null;
    s.flow = 0;
    s.tumble = 0;
    s.tumbles = Math.max(0, TUMBLES - 1);
    s.wallTicks = 0;
    s.dash = 0;
    this.endGrind();
    this.stats.revived = true;
    const d = this.dyn;
    if (d.avalanche.phase === 1 || d.avalanche.phase === 2) {
      d.avalanche.phase = 3;
      this.events.push({ type: 'chaos', phase: 'end', event: ChaosEvent.Avalanche });
    }
    if (d.yeti.phase === 1 || d.yeti.phase === 2) {
      d.yeti.phase = 3;
      this.events.push({ type: 'chaos', phase: 'end', event: ChaosEvent.Yeti });
    }
    this.nearMiss.clear();
    this.events.push({ type: 'revive' });
  }

  /** Advance one tick with a packed input byte. */
  step(input: number): void {
    this.events.length = 0;
    const s = this.s;
    if (s.crashed) {
      this.tick++;
      return;
    }
    const steerTarget = steerOf(input);
    const action = actionOf(input);
    const pressed = action && !this.prevAction;
    const released = !action && this.prevAction;
    this.prevAction = action;
    const spirit = spiritOf(input);
    const spiritPressed = spirit && !this.prevSpirit;
    this.prevSpirit = spirit;
    if (spiritPressed && !s.finished && s.tumble === 0 && !this.homeward) this.startDash();
    if (s.dash > 0) {
      s.dash--;
      if (s.dash === 0) this.events.push({ type: 'dash', phase: 'end', cells: this.cells });
    }
    s.action = action;
    if (pressed) {
      s.lastPressTick = this.tick;
      s.pressStartedGrounded = s.grounded;
    }

    const rate = Math.abs(steerTarget) < Math.abs(s.steer) || steerTarget * s.steer < 0 ? 10 : 8;
    s.steer = approach(s.steer, steerTarget, rate * DT);

    const prevZ = s.z;
    this.prevX = s.x;
    if (s.finished) this.coast();
    else if (s.tumble > 0) this.tumbleStep();
    else if (s.grinding) this.grindStep(action, released);
    else if (s.grounded) this.groundStep(action, pressed, released);
    else this.airStep(action, pressed, released);

    const riding = !s.finished && s.tumble === 0;
    const race = !this.homeward;
    if (riding && !s.crashed && !s.grinding && race) this.collide(prevZ);
    if (riding && !s.crashed && race) this.pickups(prevZ);
    if (riding && !s.crashed) this.edge();
    if (riding && !s.crashed) this.lines();
    // A set piece plays on through a wipeout: the race's machine does not wait, nor does the fall.
    if (!s.crashed && !s.finished && race) this.momentStep(prevZ);
    if (!s.crashed && !s.finished && this.tick >= MAX_RUN_TICKS - 1 && race) this.crash('daylight');
    if (!s.finished && race) this.chaos();
    if (!s.finished && race) this.draft(draftOf(input));

    const hold = !s.grounded || s.drifting || s.drafting || s.grinding || s.wallTicks > 0;
    const bankedNow = this.combo.tick(hold);
    if (bankedNow > 0) this.events.push({ type: 'comboBank', points: bankedNow, mult: this.combo.lastMult });

    const flowTarget = this.combo.active ? Math.min(6, Math.floor(this.combo.chain / 4)) : 0;
    s.flow = approach(s.flow, flowTarget, 1.5 * DT);
    s.boostGlow = approach(s.boostGlow, s.boostPool > 0.2 ? 1 : 0, 4 * DT);
    if (s.invuln > 0) s.invuln--;
    if (s.ghost > 0) s.ghost--;
    // Wedged: something has held the sled near a standstill for a second. The mountain sets it back on its
    // way along the line, and lets it slip past what held it.
    if (riding && !s.crashed && !s.finished && s.grounded && s.speed < STUCK_SPEED && this.tick > 120) {
      if (++this.stuck >= STUCK_TICKS) {
        this.stuck = 0;
        const line = this.lineHeading();
        s.heading = line;
        s.velHeading = line;
        s.speed = 8;
        s.vx = s.speed * dsin(line);
        s.vz = s.speed * dcos(line);
        s.ghost = WARD_GHOST;
      }
    } else this.stuck = 0;
    if (s.wobble > 0) s.wobble--;
    if (s.lateStompTicks > 0) s.lateStompTicks--;
    if (this.ventCooldown > 0) this.ventCooldown--;
    if (s.z > this.maxZ) this.maxZ = s.z;
    if (s.speed > this.stats.maxSpeed) this.stats.maxSpeed = s.speed;
    if (this.combo.best > this.stats.bestCombo) this.stats.bestCombo = this.combo.best;
    this.tick++;
  }

  /** `extra`: optional presentation fields spread into the event (never hashed, never scored). */
  private style(kind: StyleKind, base: number, extra?: { gap: number; side: -1 | 1; x: number; z: number; obs: ObstacleKind; id: number }): void {
    this.charge(skillCharge(kind, base, extra ? extra.gap : -1), true);
    const r = this.combo.add(kind, base);
    if (extra) this.events.push({ type: 'style', kind, points: r.points, chain: r.chain, mult: r.mult, ...extra });
    else this.events.push({ type: 'style', kind, points: r.points, chain: r.chain, mult: r.mult });
  }

  private turnRate(speed: number): number {
    const r = 2.5 / (1 + speed / 16);
    return r < 1.45 ? r : 1.45;
  }

  /** The way the corridor runs here, as a heading: what a sled eases back to when it is let go. */
  private lineHeading(): number {
    const s = this.s;
    const c = this.course;
    const look = 9 + s.speed * 0.45;
    // (In a fork, the channel the sled is in, never toward the ridge between them.)
    return datan2(c.backX(s.z + look, s.x) - c.backX(s.z, s.x), look);
  }

  private groundStep(action: boolean, pressed: boolean, released: boolean): void {
    const s = this.s;
    const c = this.course;
    const g = this.gravity;
    const surf = c.surface(s.x, s.z);
    s.onIce = surf.ice;
    c.gradient(s.x, s.z, vec);
    const n2 = 1 + vec.x * vec.x + vec.z * vec.z;
    s.vx += ((-g * vec.x) / n2) * DT;
    s.vz += ((-g * vec.z) / n2) * DT;
    s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
    if (s.speed > 0.01) s.velHeading = datan2(s.vx, s.vz);

    const prevHold = s.groundHold;
    if (action) s.groundHold++;
    else s.groundHold = 0;

    // Drift entry and exit.
    if (!s.drifting && action && Math.abs(s.steer) >= 0.5 && s.speed >= 9 && s.wobble === 0 && s.groundHold > 2) {
      s.drifting = true;
      s.driftDir = s.steer > 0 ? 1 : -1;
      this.events.push({ type: 'drift', phase: 'start', tier: 0 });
    }
    if (s.drifting && (!action || s.speed < 6)) {
      s.drifting = false;
      if (action) this.events.push({ type: 'drift', phase: 'end', tier: s.driftTier });
    }

    // Yaw.
    let turn = this.turnRate(s.speed) * this.sled.turn;
    if (action && !s.drifting) turn *= 1.12;
    if (s.drifting) turn *= 1.5;
    if (s.wobble > 0) turn *= 0.55;
    // While drifting the direction is locked; steering only tightens or widens the arc.
    const yawInput = s.drifting ? s.driftDir * (0.2 + 0.8 * (s.steer * s.driftDir + 1) * 0.5) : s.steer;
    const line = this.lineHeading();
    const relNow = s.heading - line;
    let authority = 1;
    if (!s.drifting && relNow * yawInput > 0) {
      // A turn runs out of bite as it gets across the slope, so a held key carves hard, not sideways.
      const over = (Math.abs(relNow) - CARVE_SOFT) / (CARVE_LIMIT - CARVE_SOFT);
      if (over > 0) authority = over >= 1 ? 0 : 1 - over;
    }
    s.heading += yawInput * turn * authority * DT;
    if (s.wobble > 0) s.heading += dsin(s.wobble * 0.7) * 0.012;

    const cx = c.centerX(s.z);
    const hw = c.halfWidth(s.z);
    const home = c.backX(s.z, s.x);
    const span = hw - Math.abs(home - cx);
    const off = span > 1 ? (s.x - home) / span : 0;
    const e = Math.abs(s.x - cx) - hw;
    // Let go and the sled runs out of its turn: the nose eases back to the corridor's direction, and
    // leans toward the middle once it is well off it. Never a pull while the player is steering.
    if (!s.drifting) {
      const free = 1 - Math.abs(s.steer) / 0.3;
      if (free > 0) {
        const near = clamp((Math.abs(off) - 0.68) / 0.32, 0, 1) * 0.36;
        const target = line - (off > 0 ? near : -near);
        s.heading += clamp(target - s.heading, -1, 1) * 1.6 * free * DT;
      }
    }
    // The banks really are berms: past the edge the wall turns the sled back, harder the higher it goes,
    // and whatever the hands are doing by about 6 m up.
    if (e > 0) {
      const k = e >= 6 ? 1 : e / 6;
      s.heading += (off > 0 ? -1 : 1) * k * (1.5 + s.speed / 18) * DT;
    }
    // Wall rides: up the berm at speed and back down, on purpose.
    if (e > WALL_RIDE_E && s.speed > 15 && !s.drifting) {
      s.wallTicks++;
      if (s.wallTicks === WALL_RIDE_TICKS) this.style('wallRide', 220);
      else if (s.wallTicks > WALL_RIDE_TICKS && (s.wallTicks - WALL_RIDE_TICKS) % 36 === 0) this.style('wallRide', 90);
    } else s.wallTicks = 0;

    // Low speed: swing the nose back toward the fall line so the sled can never get stuck.
    if (s.speed < 3) {
      const fall = datan2(-vec.x, -vec.z);
      s.heading += clamp(angleDiff(s.heading, fall), -1, 1) * 1.2 * DT;
    }

    const maxSlip = s.drifting ? 0.9 : 0.5;
    let slip = wrapAngle(s.heading - s.velHeading);
    if (slip > maxSlip) s.heading = s.velHeading + maxSlip;
    else if (slip < -maxSlip) s.heading = s.velHeading - maxSlip;
    const limit = s.drifting ? CARVE_LIMIT + 0.25 : CARVE_LIMIT;
    s.heading = clamp(s.heading, line - limit, line + limit);
    slip = wrapAngle(s.heading - s.velHeading);

    // Grip turns velocity toward the heading.
    let grip = (s.drifting ? 1.7 : 6.5) * this.sled.grip * this.mood.grip * surf.grip;
    if (action && !s.drifting) grip *= 1.15;
    const k = grip * DT > 1 ? 1 : grip * DT;
    s.velHeading += slip * k;
    s.slip = wrapAngle(s.heading - s.velHeading);
    const absSlip = Math.abs(s.slip);
    s.speed -= s.speed * absSlip * (s.drifting ? 0.18 : 0.25) * DT;

    // Carving: grooves and style.
    const carveTarget = !s.drifting ? clamp(Math.abs(s.steer) * (s.speed / 20) * (action ? 1.25 : 0.85), 0, 1) : clamp(absSlip, 0, 1);
    s.carve = approach(s.carve, carveTarget, 4 * DT);
    // A deep carve is a long, hard, grippy turn at speed (no drift).
    if (!s.drifting && Math.abs(s.steer) > 0.6 && s.speed > 16 && s.steer * (s.carveDir || s.steer) > 0) {
      s.carveDir = s.steer > 0 ? 1 : -1;
      s.carveTicks++;
      if (s.carveTicks === 66) this.style('carve', 120);
    } else {
      s.carveTicks = 0;
      s.carveDir = 0;
    }

    // Drift charge.
    if (s.drifting) {
      this.stats.driftTicks++;
      if (absSlip > 0.18) s.driftCharge += DT * (0.55 + absSlip) * this.sled.driftCharge * this.mood.driftCharge;
      const tier = s.driftCharge >= 2.4 ? 3 : s.driftCharge >= 1.35 ? 2 : s.driftCharge >= 0.6 ? 1 : 0;
      if (tier > s.driftTier) {
        s.driftTier = tier;
        this.events.push({ type: 'drift', phase: 'tier', tier });
      }
    }

    // Drag and boosts.
    const flowDrag = 1 / (1 + 0.055 * s.flow);
    let cd = CD * this.sled.drag * this.mood.drag * surf.drag * flowDrag;
    // The tuck: the crouch on a straight line is worth about 3 m/s at cruise.
    if (action && Math.abs(s.steer) < 0.3 && !s.drifting) cd *= 0.82;
    // A dash cuts through the air: most of the drag is gone while it lasts.
    if (s.dash > 0) cd *= DASH_DRAG;
    s.speed -= (cd * s.speed * s.speed + MU * g) * DT;
    if (s.speed < 0) s.speed = 0;
    this.applyBoost();
    this.capSpeed();

    s.vx = s.speed * dsin(s.velHeading);
    s.vz = s.speed * dcos(s.velHeading);
    s.lean = approach(s.lean, s.drifting ? s.driftDir * 0.9 : s.steer * clamp(s.speed / 18, 0.3, 1), 5 * DT);

    // Integrate along the ground and detect natural launches.
    const nx = s.x + s.vx * DT;
    const nz = s.z + s.vz * DT;
    const ny = c.ground(nx, nz);
    const vyFollow = (ny - s.y) / DT;
    const stick = action ? 1.7 : 1;
    const launch = vyFollow < s.vy - g * stick * DT * 1.5;
    s.x = nx;
    s.z = nz;
    if (launch) {
      s.vy -= g * DT;
      s.y += s.vy * DT;
      if (s.y < ny) s.y = ny;
      const rampLaunch = this.onRampTop();
      this.takeoff('lip');
      this.coyoteRamp = rampLaunch;
      const charged = s.pressStartedGrounded || prevHold > 10;
      if (released && charged) {
        // Released on the exact launch tick: perfect timing, pay it now.
        this.latePop();
      } else {
        // Coyote time: a release just after rolling off a lip still counts as a pop.
        this.coyote = action && (s.pressStartedGrounded || s.groundHold > 10) ? 6 : 0;
      }
    } else {
      s.y = ny;
      s.vy = vyFollow;
    }

    // Steam vents launch you.
    if (s.grounded && this.ventCooldown === 0) {
      const ci = Math.floor(s.z / CHUNK_LEN);
      for (let kk = ci - 1; kk <= ci; kk++) {
        if (kk < 0) continue;
        for (const v of c.zones(kk).vents) {
          const dx = s.x - v.x;
          const dz = s.z - v.z;
          if (dx * dx + dz * dz < v.r * v.r) {
            s.vy = Math.max(s.vy, 0) + v.power * (this.mood.gravity < 1 ? 0.8 : 1);
            this.ventCooldown = 60;
            this.takeoff('geyser');
            this.style('geyser', 200);
          }
        }
      }
    }

    // Release: pay out drift charge, then pop.
    if (released && s.grounded) {
      if (s.driftTier > 0) {
        const boost = DRIFT_BOOST[s.driftTier];
        s.boostPool += boost;
        this.events.push({ type: 'drift', phase: 'release', tier: s.driftTier });
        this.events.push({ type: 'boost', amount: boost, source: 'drift' });
        this.style('drift', [0, 150, 350, 700][s.driftTier]);
      }
      s.drifting = false;
      s.driftCharge = 0;
      s.driftTier = 0;
      if (s.pressStartedGrounded || prevHold > 10) this.pop();
    }
    if (pressed && s.lateStompTicks > 0) this.lateStomp();
    if (!action) {
      s.driftCharge = 0;
      s.driftTier = 0;
    }
    if (s.grounded) this.tryRail();
  }

  private pop(): void {
    const s = this.s;
    const hold = this.lastHold;
    const charge = clamp(hold / 36, 0, 1);
    let v = (3.0 + 2.6 * charge) * this.sled.pop * this.mood.pop;
    // Popping off the top of a kicker face adds height.
    if (this.onRampTop()) {
      v *= 1.3;
      this.style('boostPop', 120);
    }
    s.vy = Math.max(s.vy, 0) + v;
    this.takeoff('pop');
  }

  /** Pop granted during coyote time: pays the drift and adds the pop to the launch. */
  private latePop(): void {
    const s = this.s;
    if (s.driftTier > 0) {
      const boost = DRIFT_BOOST[s.driftTier];
      s.boostPool += boost;
      this.events.push({ type: 'drift', phase: 'release', tier: s.driftTier });
      this.events.push({ type: 'boost', amount: boost, source: 'drift' });
      this.style('drift', [0, 150, 350, 700][s.driftTier]);
    }
    s.driftCharge = 0;
    s.driftTier = 0;
    const charge = clamp(this.lastHold / 36, 0, 1);
    const v = (3.0 + 2.6 * charge) * this.sled.pop * this.mood.pop;
    s.vy = Math.max(s.vy, 0) + v * (this.coyoteRamp ? 1.2 : 1);
    if (this.coyoteRamp) this.style('boostPop', 120);
    this.events.push({ type: 'takeoff', kind: 'pop', vy: s.vy });
  }

  /** Ticks the action was held before the release that is being processed. */
  private get lastHold(): number {
    return Math.max(1, this.tick - this.s.lastPressTick);
  }

  private onRampTop(): boolean {
    const s = this.s;
    const ci = Math.floor(s.z / CHUNK_LEN);
    for (let k = ci - 1; k <= ci; k++) {
      if (k < 0) continue;
      for (const r of this.course.zones(k).ramps) {
        const u = (s.z - r.z) / r.len;
        if (u > 0.6 && u <= 1.05 && Math.abs(s.x - r.x) < r.w * 0.5 + 0.5) return true;
      }
    }
    return false;
  }

  private airPressed = false;
  private coyote = 0;
  private coyoteRamp = false;

  private takeoff(kind: TakeoffKind): void {
    const s = this.s;
    this.airPressed = false;
    this.coyote = 0;
    s.grounded = false;
    s.airTicks = 0;
    s.airHold = 0;
    s.airYaw = 0;
    s.airPitch = 0;
    s.spinRate = 0;
    s.pitchRate = 0;
    s.drifting = false;
    s.carveTicks = 0;
    this.events.push({ type: 'takeoff', kind, vy: s.vy });
  }

  private airStep(action: boolean, pressed: boolean, released: boolean): void {
    const s = this.s;
    const c = this.course;
    s.airTicks++;
    if (this.coyote > 0) {
      this.coyote--;
      if (released) {
        this.coyote = 0;
        this.latePop();
      }
    }
    // Flips need a fresh press in the air, so holding the crouch through a takeoff never flips you.
    if (pressed) {
      s.lastPressTick = this.tick;
      this.airPressed = true;
    }
    if (action && this.airPressed) s.airHold++;
    else s.airHold = 0;
    s.vy -= this.gravity * DT;

    // Air control: a gentle lateral nudge.
    const lat = s.steer * 3.0 * DT;
    s.vx += lat * dcos(s.velHeading);
    s.vz -= lat * dsin(s.velHeading);
    s.vx *= 1 - 0.015 * DT;
    s.vz *= 1 - 0.015 * DT;
    s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
    if (s.speed > 0.01) s.velHeading = datan2(s.vx, s.vz);

    // Spins from steering (with a dead zone), flips from holding the action.
    const spinMax = 9 * this.sled.spin * this.mood.spin;
    if (s.airTicks > 8 && this.landingWithin(LAND_SET_TICKS)) {
      s.spinRate = approach(s.spinRate, 0, 40 * DT);
      s.airYaw = approach(s.airYaw, PI * Math.round(s.airYaw / PI), 4 * DT);
    } else if (Math.abs(s.steer) > 0.3) {
      s.spinRate = approach(s.spinRate, s.steer * spinMax, 34 * DT);
    } else {
      s.spinRate = approach(s.spinRate, 0, 22 * DT);
      const nearest = PI * Math.round(s.airYaw / PI);
      s.airYaw = approach(s.airYaw, nearest, 2.6 * DT);
    }
    s.airYaw += s.spinRate * DT;
    // A flip never starts in the last FLIP_GUARD_TICKS before touchdown: a stomp held a little too
    // long used to tip the rider into the snow. One already under way carries on.
    if (action && s.airHold >= 7 && (s.pitchRate < -1 || !this.landingWithin(FLIP_GUARD_TICKS))) {
      s.pitchRate = approach(s.pitchRate, -6.8 * this.sled.flip * this.mood.spin, 20 * DT);
    } else {
      s.pitchRate = approach(s.pitchRate, 0, 26 * DT);
      if (Math.abs(s.pitchRate) < 1.5) {
        const nearest = TAU * Math.round(s.airPitch / TAU);
        s.airPitch = approach(s.airPitch, nearest, 2.4 * DT);
      }
    }
    s.airPitch += s.pitchRate * DT;
    s.lean = approach(s.lean, 0, 3 * DT);
    s.carve = approach(s.carve, 0, 6 * DT);

    s.x += s.vx * DT;
    s.z += s.vz * DT;
    s.y += s.vy * DT;
    const gy = c.ground(s.x, s.z);
    if (s.y <= gy) {
      s.y = gy;
      this.land(gy);
    }
  }

  /** Whether a ballistic flight from here touches down within `ticks`, the ground sampled every 4
   *  ticks along the way (one sample at the end misses a mogul crest in between). */
  private landingWithin(ticks: number): boolean {
    const s = this.s;
    for (let k = 4; k <= ticks; k += 4) {
      const t = k * DT;
      const y = s.y + s.vy * t - 0.5 * this.gravity * t * t;
      if (y <= this.course.ground(s.x + s.vx * t, s.z + s.vz * t)) return true;
    }
    return false;
  }

  private land(gy: number): void {
    const s = this.s;
    const c = this.course;
    c.gradient(s.x, s.z, vec);
    const vyFollow = vec.x * s.vx + vec.z * s.vz;
    const impact = vyFollow - s.vy;
    const airtime = s.airTicks / TICK_RATE;
    const vyAtTouch = s.vy;
    const tol = this.sled.landTol + this.mood.landTol;
    const yawErr = Math.abs(wrapAngle(s.airYaw - PI * Math.round(s.airYaw / PI)));
    const pitchErr = Math.abs(wrapAngle(s.airPitch));
    const halfTurns = Math.round(Math.abs(s.airYaw) / PI);
    const flips = Math.round(Math.abs(s.airPitch) / TAU);
    s.grounded = true;
    s.y = gy;
    s.vy = vyFollow;
    if (this.airPressed) {
      s.groundHold = s.action ? 1 : 0;
      s.pressStartedGrounded = false;
    }

    if (airtime < 0.3 && halfTurns === 0 && flips === 0) {
      s.airYaw = 0;
      s.airPitch = 0;
      this.events.push({ type: 'land', quality: 'hop', airtime, halfTurns, flips, impact, late: false });
      return;
    }

    // A short flight never wrecks: nobody meant that. Commit to a real one and land it wrong, and you go.
    const committed = airtime >= 0.75;
    if (committed && (pitchErr > 1.35 + tol || yawErr > 1.2 + tol)) {
      s.airYaw = 0;
      s.airPitch = 0;
      this.wipeout('landing');
      return;
    }

    const sketchy = pitchErr > 0.72 + tol || yawErr > 0.62 + tol;
    const stomp = this.tick - s.lastPressTick <= 9 && airtime >= 0.4;
    const scale = sketchy ? 0.5 : 1;
    const spinPts = halfTurns > 0 ? 150 * halfTurns * (1 + 0.25 * (halfTurns - 1)) * scale : 0;
    const flipPts = flips > 0 ? 600 * flips * scale : 0;
    const trickPts = spinPts + flipPts;

    if (airtime >= 0.5) this.style('air', Math.round(60 * airtime));
    if (spinPts > 0) this.style('spin', Math.round(spinPts));
    if (flipPts > 0) this.style('flip', Math.round(flipPts));
    this.stats.maxAirtime = Math.max(this.stats.maxAirtime, airtime);
    this.stats.maxHalfTurns = Math.max(this.stats.maxHalfTurns, halfTurns);
    this.stats.flips += flips;

    // Odd half-turns land backwards; the sled whips around (a revert).
    s.heading = s.velHeading;
    s.airYaw = 0;
    s.airPitch = 0;
    s.spinRate = 0;
    s.pitchRate = 0;

    let quality: LandQuality;
    if (sketchy) {
      quality = 'sketchy';
      this.stats.sketchies++;
      s.speed *= committed ? 0.8 : 0.97;
      s.wobble = committed ? 32 : 8;
    } else if (stomp) {
      quality = 'perfect';
      this.perfectLanding(halfTurns, flips, trickPts);
    } else {
      quality = 'clean';
      this.stats.cleans++;
      const cleanPts = airtime >= 0.5 || trickPts > 0 ? 80 : 0;
      if (cleanPts) this.style('clean', cleanPts);
      const cleanBoost = Math.min(4, (halfTurns * 0.5 + flips) * 1.2);
      s.boostPool += cleanBoost;
      // A press just after touchdown still upgrades to a perfect (airtime permitting).
      s.lateStompTicks = airtime >= 0.4 ? 5 : 0;
      this.lateTricks = { halfTurns, flips, trickPts, cleanPts, cleanBoost };
    }
    if (quality !== 'perfect' && impact > 12) s.speed *= 0.93;
    // Touching down on a falling slope turns the drop into speed: a cliff landed well pays.
    if (quality !== 'sketchy' && s.speed > 1) {
      const m = vyFollow / s.speed;
      const along = (s.speed + vyAtTouch * m) / (1 + m * m);
      if (along > s.speed) s.speed += Math.min(8, (along - s.speed) * 1.5);
      this.capSpeed();
    }
    s.vx = s.speed * dsin(s.velHeading);
    s.vz = s.speed * dcos(s.velHeading);
    this.events.push({ type: 'land', quality, airtime, halfTurns, flips, impact, late: false });
  }

  private lateTricks = { halfTurns: 0, flips: 0, trickPts: 0, cleanPts: 0, cleanBoost: 0 };

  private perfectLanding(halfTurns: number, flips: number, trickPts: number, alreadyPts = 0, alreadyBoost = 0): void {
    const s = this.s;
    this.stats.perfects++;
    this.style('perfect', Math.max(0, Math.round(250 + trickPts * 0.4) - alreadyPts));
    const boost = Math.max(0, Math.min(10, 2.5 + 1.5 * (halfTurns * 0.5 + flips)) - alreadyBoost);
    s.boostPool += boost;
    s.flow = Math.min(6, s.flow + 0.5);
    this.events.push({ type: 'boost', amount: boost, source: 'perfect' });
  }

  /** A press just after a clean landing still counts as a stomp. */
  private lateStomp(): void {
    const s = this.s;
    s.lateStompTicks = 0;
    this.stats.cleans--;
    const t = this.lateTricks;
    // Pay only the difference over the clean landing already credited.
    this.perfectLanding(t.halfTurns, t.flips, t.trickPts, t.cleanPts, t.cleanBoost);
    this.events.push({ type: 'land', quality: 'perfect', airtime: 0, halfTurns: t.halfTurns, flips: t.flips, impact: 0, late: true });
  }

  /** The speed cap, raised while a dash lasts; what a dash carried over it eases off, never in a step. */
  private capSpeed(): void {
    const s = this.s;
    if (s.dash > 0) this.overcap = DASH_CAP;
    // The allowance only ever falls once the dash is over: with the ease, or with the speed, if that drops first.
    else if (this.overcap > 0) this.overcap = Math.max(0, Math.min(this.overcap - OVERCAP_EASE * DT, s.speed - MAX_SPEED));
    const cap = MAX_SPEED + this.overcap;
    if (s.speed > cap) s.speed = cap;
  }

  private overcap = 0;
  private stuck = 0;
  /** The sled's x as this tick began (where a gate was crossed lies between it and now). */
  private prevX = 0;

  /** Full lanterns. */
  get cells(): number {
    return Math.floor(this.s.lantern / LANTERN);
  }

  /** Charge the lantern; a whole lantern lit says so. Skill is counted apart from lights, for the results. */
  private charge(units: number, skill: boolean): void {
    if (units <= 0) return;
    const s = this.s;
    const before = this.cells;
    const add = units * (skill ? this.sled.skillGain : this.sled.lightGain);
    const room = LANTERN_MAX - s.lantern;
    const got = add < room ? add : room;
    if (got <= 0) return;
    s.lantern += got;
    this.stats.lit += got;
    if (skill) this.stats.litBySkill += got;
    const after = this.cells;
    if (after > before) this.events.push({ type: 'lantern', phase: 'lit', cells: after });
  }

  /** Spend a full lantern on a dash: a burst of speed, the air's drag mostly gone, and for its length the
   *  sled rides as a spirit, through anything that would stop it (never through the mountain's walls). */
  private startDash(): void {
    const s = this.s;
    if (s.crashed || s.dash > 0 || s.lantern < LANTERN) return;
    s.lantern -= LANTERN;
    s.dash = Math.round(DASH_TICKS * this.sled.dashLen);
    s.boostPool += DASH_BOOST;
    this.stats.dashes++;
    this.events.push({ type: 'dash', phase: 'start', cells: this.cells });
  }

  private applyBoost(): void {
    const s = this.s;
    if (s.boostPool <= 0) return;
    const add = Math.min(s.boostPool, 16 * DT);
    s.speed += add;
    s.boostPool -= add;
  }

  /** A hard hit. The run forgives a couple of these (every one in the first stretch) as a tumble back
   *  to the line, which costs the combo and a few seconds; the one after that is the wreck. */
  private wipeout(cause: TumbleCause): void {
    const s = this.s;
    if (s.tumble > 0 || s.crashed) return;
    if (this.homeward) {
      // Riding home nothing can go wrong: a landing that would have floored a racer just lands.
      s.heading = s.velHeading;
      s.airYaw = 0;
      s.airPitch = 0;
      s.spinRate = 0;
      s.pitchRate = 0;
      return;
    }
    // A full lantern takes the hit: the rider rides on, slower, the combo banked rather than lost.
    if (s.lantern >= LANTERN) {
      s.lantern -= LANTERN;
      this.stats.wards++;
      s.speed *= WARD_KEEP * this.sled.wardKeep;
      s.heading = s.velHeading;
      s.airYaw = 0;
      s.airPitch = 0;
      s.spinRate = 0;
      s.pitchRate = 0;
      s.drifting = false;
      s.driftCharge = 0;
      s.driftTier = 0;
      s.vx = s.speed * dsin(s.velHeading);
      s.vz = s.speed * dcos(s.velHeading);
      s.invuln = WARD_INVULN;
      // The spirits carry it through what it hit: never left inside a rock, never bounced off it.
      s.ghost = WARD_GHOST;
      s.wobble = 10;
      const banked = this.combo.bank();
      if (banked > 0) this.events.push({ type: 'comboBank', points: banked, mult: this.combo.lastMult });
      this.events.push({ type: 'ward', cause, cells: this.cells });
      return;
    }
    const free = s.z < FREE_TUMBLE_Z;
    if (!free && s.tumbles >= TUMBLES) {
      this.crash(cause);
      return;
    }
    if (!free) s.tumbles++;
    s.tumble = TUMBLE_TICKS;
    this.tumbleCause = cause;
    s.drifting = false;
    s.driftCharge = 0;
    s.driftTier = 0;
    s.boostPool = 0;
    s.carveTicks = 0;
    s.wallTicks = 0;
    s.flow = 0;
    s.draftTicks = 0;
    s.draftCharge = 0;
    s.airYaw = 0;
    s.airPitch = 0;
    s.spinRate = 0;
    s.pitchRate = 0;
    this.endGrind();
    const lost = this.combo.lose();
    if (lost > 0) this.events.push({ type: 'comboLost', points: lost });
    this.events.push({ type: 'tumble', phase: 'start', cause, left: Math.max(0, TUMBLES - s.tumbles) });
  }

  private tumbleCause: TumbleCause = 'landing';

  /** Rolling back to the line: momentum bleeds off, and the snow carries the rider home. */
  private tumbleStep(): void {
    const s = this.s;
    const c = this.course;
    s.tumble--;
    s.speed *= 0.982;
    const u = 1 - s.tumble / TUMBLE_TICKS;
    const pull = u * u * 0.09;
    s.vx = 0;
    s.vz = s.speed;
    s.z += s.vz * DT;
    s.x += (c.safeX(s.z) - s.x) * pull;
    const gy = c.ground(s.x, s.z);
    s.vy -= this.gravity * DT;
    s.y += s.vy * DT;
    if (s.y <= gy) {
      s.y = gy;
      s.vy = 0;
      s.grounded = true;
    } else s.grounded = false;
    if (s.tumble > 0) return;
    const line = this.lineHeading();
    s.x = c.safeX(s.z);
    s.y = c.ground(s.x, s.z);
    const floor = 0.55 * this.cruiseSpeed();
    if (s.speed < floor) s.speed = floor;
    s.heading = line;
    s.velHeading = line;
    s.vx = s.speed * dsin(line);
    s.vz = s.speed * dcos(line);
    c.gradient(s.x, s.z, vec);
    s.vy = vec.x * s.vx + vec.z * s.vz;
    s.grounded = true;
    s.invuln = 110;
    s.wobble = 0;
    s.steer = 0;
    this.prevAction = s.action;
    s.groundHold = 0;
    s.pressStartedGrounded = false;
    this.coyote = 0;
    this.airPressed = false;
    this.nearMiss.clear();
    this.events.push({ type: 'tumble', phase: 'end', cause: this.tumbleCause, left: Math.max(0, TUMBLES - s.tumbles) });
  }

  /** Something solid at the corridor's edge turns a sled back: it costs speed and the combo, never the run. */
  private edge(): void {
    const s = this.s;
    const c = this.course;
    const limit = c.edgeLimit(s.z);
    const e = c.edgeExcess(s.x, s.z);
    if (e <= limit) return;
    const side: -1 | 1 = s.x > c.centerX(s.z) ? 1 : -1;
    s.x -= side * (e - limit + 0.02);
    const out = s.vx * side;
    if (out > 0) s.vx -= side * out * 1.5;
    const sp = Math.sqrt(s.vx * s.vx + s.vz * s.vz) * (out > 3 ? 0.93 : 0.985);
    s.velHeading = datan2(s.vx, s.vz);
    s.heading = s.velHeading;
    s.speed = sp;
    s.vx = sp * dsin(s.velHeading);
    s.vz = sp * dcos(s.velHeading);
    if (out > 3) {
      s.wobble = 14;
      const banked = this.combo.bank();
      if (banked > 0) this.events.push({ type: 'comboBank', points: banked, mult: this.combo.lastMult });
      this.events.push({ type: 'scrape', side, speed: sp });
    }
  }

  /** Stage lines and the finish. */
  private lines(): void {
    const s = this.s;
    const st = this.course.stages;
    const i = this.stageTicks.length;
    if (i >= st.length || s.z < st[i].z1) return;
    this.stageTicks.push(this.tick);
    this.events.push({ type: 'stage', index: i, tick: this.tick });
    if (i < st.length - 1) return;
    s.finished = true;
    s.finishTick = this.tick;
    s.drifting = false;
    s.drafting = false;
    s.boostPool = 0;
    s.wallTicks = 0;
    this.endGrind();
    const banked = this.combo.bank();
    if (banked > 0) this.events.push({ type: 'comboBank', points: banked, mult: this.combo.lastMult });
    const par = (this.course.finishZ / PAR_SPEED) * TICK_RATE;
    const under = (par - this.tick) / TICK_RATE;
    this.finishBonus = 1000 + (under > 0 ? Math.round(under * 300) : 0);
    this.events.push({ type: 'finish', tick: this.tick, bonus: this.finishBonus });
  }

  // ---------------------------------------------------------------- set pieces (moments.ts)

  /** A set piece as the rider plays it: it starts as the sled reaches its z0 and is decided by its verb.
   *  Everything here reads the sled and the course; the machine and the fall are functions of the tick the
   *  rider arrived, so a replay meets exactly the same moment. */
  private momentStep(prevZ: number): void {
    const s = this.s;
    const mo = this.mo;
    if (mo.active < 0) {
      const p = this.plays[mo.next];
      if (!p || s.z < p.z0) return;
      mo.active = mo.next++;
      mo.t0 = this.tick;
      mo.n = 0;
      mo.ahead = false;
      mo.close = false;
      mo.at = 0;
      mo.ok = true;
      mo.pace = p.verb === 'collapse' ? fallPace(p, s.speed) : p.pace;
      mo.of = p.verb === 'gates' ? p.gates.length : p.verb === 'rings' ? p.rings.length : p.verb === 'steps' ? p.steps.length : 1;
      this.events.push({ type: 'moment', index: p.index, phase: 'start', n: 0, of: mo.of });
    }
    const p = this.plays[mo.active];
    const ticks = this.tick - mo.t0;
    switch (p.verb) {
      case 'race': {
        const mz = machineZ(p, ticks);
        const ahead = s.z > mz;
        if (ahead !== mo.ahead) {
          mo.ahead = ahead;
          this.events.push({ type: 'moment', index: p.index, phase: ahead ? 'lead' : 'trail', n: 0, of: 1 });
        }
        if (s.z >= p.z1) this.momentEnd(p, mz < p.z1);
        else if (mz >= p.z1) this.momentEnd(p, false);
        break;
      }
      case 'collapse': {
        const gap = s.z - fallZ(p, ticks, mo.pace);
        if (!mo.close && gap < COLLAPSE_CLOSE) {
          mo.close = true;
          this.events.push({ type: 'moment', index: p.index, phase: 'close', n: 0, of: 1 });
        }
        if (gap < 0.6) {
          // The snow gives under the sled: it drops onto the span's ice and loses its way.
          s.speed *= COLLAPSE_KEEP;
          s.vx = s.speed * dsin(s.velHeading);
          s.vz = s.speed * dcos(s.velHeading);
          s.wobble = 18;
          this.momentEnd(p, false);
        } else if (s.z >= p.z1) this.momentEnd(p, true);
        break;
      }
      case 'gates': {
        while (mo.at < p.gates.length && p.gates[mo.at].z <= s.z) {
          const g = p.gates[mo.at++];
          // Where the sled crossed the gate's line, between last tick and this one.
          const u = s.z > prevZ ? (g.z - prevZ) / (s.z - prevZ) : 1;
          const x = this.prevX + (s.x - this.prevX) * (u < 0 ? 0 : u > 1 ? 1 : u);
          if (x >= g.x - g.hw && x <= g.x + g.hw) {
            mo.n++;
            this.charge(GATE_UNITS, true);
            const r = this.combo.add('gate', 150);
            this.events.push({ type: 'style', kind: 'gate', points: r.points, chain: r.chain, mult: r.mult });
            this.events.push({ type: 'moment', index: p.index, phase: 'step', n: mo.n, of: mo.of });
          } else {
            mo.ok = false;
            mo.n = 0;
            this.events.push({ type: 'moment', index: p.index, phase: 'miss', n: 0, of: mo.of });
          }
        }
        if (mo.at >= p.gates.length || s.z >= p.z1) this.momentEnd(p, mo.ok && mo.n === p.gates.length && p.gates.length > 0);
        break;
      }
      case 'rings':
        // The rings themselves are flown in pickups() (momentRing), with the stage gates.
        if (mo.at >= p.rings.length || s.z >= p.z1) this.momentEnd(p, mo.ok && mo.n === p.rings.length && p.rings.length > 0);
        break;
      case 'steps': {
        for (const e of this.events) {
          if (e.type !== 'land' || e.airtime < 0.2) continue;
          if (e.quality === 'perfect') {
            mo.n++;
            this.events.push({ type: 'moment', index: p.index, phase: 'step', n: mo.n, of: mo.of });
          } else if (mo.ok) {
            mo.ok = false;
            this.events.push({ type: 'moment', index: p.index, phase: 'miss', n: mo.n, of: mo.of });
          }
          // (pushed while iterating: a 'moment' event is never a landing, so the loop passes over it.)
        }
        if (mo.n >= mo.of || s.z >= p.z1) this.momentEnd(p, mo.ok && mo.n >= mo.of && mo.of > 0);
        break;
      }
    }
  }

  /** A ring of a set piece's line, crossed: through it, or past it. */
  private momentRing(index: number, through: boolean): void {
    const mo = this.mo;
    if (mo.active !== index) return;
    const p = this.plays[index];
    mo.at++;
    if (through) {
      mo.n++;
      this.charge(RING_UNITS, true);
      this.events.push({ type: 'moment', index, phase: 'step', n: mo.n, of: mo.of });
    } else {
      mo.ok = false;
      this.events.push({ type: 'moment', index, phase: 'miss', n: mo.n, of: mo.of });
    }
    if (mo.at >= p.rings.length) this.momentEnd(p, mo.ok && mo.n === p.rings.length);
  }

  /** A set piece decided. Beating its verb lights a whole lantern. */
  private momentEnd(p: MomentPlay, won: boolean): void {
    const mo = this.mo;
    if (mo.active !== p.index) return;
    mo.active = -1;
    if (won) {
      this.stats.momentsWon++;
      this.stats.momentMask |= 1 << p.index;
      this.charge(LANTERN, true);
    }
    this.events.push({ type: 'moment', index: p.index, phase: won ? 'won' : 'lost', n: mo.n, of: mo.of });
  }

  /** Over the line the sled runs on through the square and stops: no hands, nothing to hit. */
  private coast(): void {
    const s = this.s;
    const c = this.course;
    // A long, easy stop: the square is the climax, so the sled runs on through most of it.
    s.speed = approach(s.speed, 0, (2.4 + s.speed * 0.055) * DT);
    const look = s.z + 6 + s.speed * 0.4;
    const want = datan2(c.safeX(look) - s.x, look - s.z);
    s.heading = approach(s.heading, want, 1.2 * DT);
    s.velHeading = s.heading;
    s.vx = s.speed * dsin(s.heading);
    s.vz = s.speed * dcos(s.heading);
    s.x += s.vx * DT;
    s.z += s.vz * DT;
    s.y = c.ground(s.x, s.z);
    s.vy = 0;
    s.grounded = true;
    s.steer = 0;
    s.lean = approach(s.lean, 0, 2 * DT);
    s.carve = approach(s.carve, 0, 3 * DT);
  }

  // ---------------------------------------------------------------- rails

  private rail: Rail | null = null;
  private railU = 0;
  private railTicks = 0;

  /** A sled meeting a rail's low end, running with it, rides up it. */
  private tryRail(): void {
    const s = this.s;
    const ci = Math.floor(s.z / CHUNK_LEN);
    for (let k = ci - 1; k <= ci; k++) {
      if (k < 0) continue;
      for (const r of this.course.zones(k).rails) {
        const d = s.z - r.z0;
        if (d < 0 || d > 1.4) continue;
        const len = r.z1 - r.z0;
        if (len <= 0) continue;
        const rx = r.x0 + ((r.x1 - r.x0) * d) / len;
        if (Math.abs(s.x - rx) > 0.7 || s.speed < 9 || s.velHeading < -0.6 || s.velHeading > 0.6) continue;
        this.rail = r;
        this.railU = d / len;
        this.railTicks = 0;
        s.grinding = true;
        s.drifting = false;
        s.wallTicks = 0;
        this.events.push({ type: 'grind', phase: 'start', id: r.id });
        this.style('grind', 180);
        return;
      }
    }
  }

  private endGrind(): void {
    const s = this.s;
    if (!s.grinding) return;
    s.grinding = false;
    if (this.rail) this.events.push({ type: 'grind', phase: 'end', id: this.rail.id });
    this.rail = null;
  }

  private grindStep(action: boolean, released: boolean): void {
    const s = this.s;
    const r = this.rail;
    if (!r) {
      s.grinding = false;
      return;
    }
    const c = this.course;
    const len = r.z1 - r.z0;
    const dir = datan2(r.x1 - r.x0, len);
    s.speed -= (0.6 * s.speed * s.speed * CD + 0.2 * MU * this.gravity) * DT;
    s.speed += 0.6 * DT;
    this.capSpeed();
    this.railU += (s.speed * dcos(dir) * DT) / len;
    const u = this.railU;
    const x = r.x0 + (r.x1 - r.x0) * u;
    const z = r.z0 + len * u;
    const y = c.ground(x, z) + r.h * clamp(u * 3, 0, 1);
    s.vy = (y - s.y) / DT;
    s.x = x;
    s.z = z;
    s.y = y;
    s.heading = dir;
    s.velHeading = dir;
    s.vx = s.speed * dsin(dir);
    s.vz = s.speed * dcos(dir);
    s.groundHold = action ? s.groundHold + 1 : 0;
    s.lean = approach(s.lean, 0, 5 * DT);
    this.railTicks++;
    if (this.railTicks % 24 === 0) this.style('grind', 60);
    const off = Math.abs(s.steer) > 0.7 && this.railTicks > 12;
    if (u < 1 && !off && !released) return;
    const popped = released;
    this.endGrind();
    if (off) {
      s.vx += s.steer * 4;
      s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
      s.velHeading = datan2(s.vx, s.vz);
      s.heading = s.velHeading;
    }
    s.vy = popped ? Math.max(s.vy, 0) + (3 + 2.6 * clamp(this.lastHold / 36, 0, 1)) * this.sled.pop * this.mood.pop : Math.max(s.vy, 0) + 1.5;
    this.takeoff(popped ? 'pop' : 'lip');
  }

  private crash(cause: CrashCause): void {
    const s = this.s;
    if (s.crashed) return;
    s.crashed = true;
    s.crashCause = cause;
    s.crashTick = this.tick;
    s.drifting = false;
    const lost = this.combo.lose();
    if (lost > 0) this.events.push({ type: 'comboLost', points: lost });
    this.events.push({ type: 'crash', cause });
  }

  private obstacleHit(o: Obstacle): { d: number; nx: number; nz: number } {
    const s = this.s;
    let px = o.x;
    let pz = o.z;
    if (o.x2 !== o.x || o.z2 !== o.z) {
      const ex = o.x2 - o.x;
      const ez = o.z2 - o.z;
      const t = clamp(((s.x - o.x) * ex + (s.z - o.z) * ez) / (ex * ex + ez * ez), 0, 1);
      px = o.x + ex * t;
      pz = o.z + ez * t;
    }
    const dx = s.x - px;
    const dz = s.z - pz;
    const d = Math.sqrt(dx * dx + dz * dz);
    return d > 1e-6 ? { d, nx: dx / d, nz: dz / d } : { d, nx: 0, nz: -1 };
  }

  private collide(prevZ: number): void {
    const s = this.s;
    const c = this.course;
    const ci = Math.floor(s.z / CHUNK_LEN);
    for (let k = ci - 1; k <= ci + 1; k++) {
      if (k < 0) continue;
      const chunk = c.chunk(k);
      for (const o of chunk.obstacles) {
        if (this.destroyed.has(o.id)) continue;
        const reachZ = Math.abs(o.z2 - o.z) + o.r + 3;
        if (Math.abs(((o.z + o.z2) / 2) - s.z) > reachZ) {
          this.resolveNearMiss(o);
          continue;
        }
        const hit = this.obstacleHit(o);
        const touch = o.r + SLED_RADIUS;
        if (hit.d < touch) {
          const top = o.y + o.h;
          if (s.y > top - 0.05) {
            if (!s.grounded && !this.resolvedObstacles.has(o.id)) {
              this.resolvedObstacles.add(o.id);
              this.style('cleared', 150);
            }
            continue;
          }
          // A spirit rides through what would stop a sled: counted once, never a bump. (A ward's moment of
          // spirit passes through too, but only a dash calls it style.)
          if ((s.dash > 0 || s.ghost > 0) && !o.soft) {
            if (!this.resolvedObstacles.has(o.id)) {
              this.resolvedObstacles.add(o.id);
              this.nearMiss.delete(o.id);
              if (s.dash > 0) {
                this.stats.phased++;
                this.style('phase', 60);
              }
            }
            continue;
          }
          this.resolvedObstacles.add(o.id);
          this.nearMiss.delete(o.id);
          if (o.soft) {
            this.destroyed.add(o.id);
            s.vx *= 0.88;
            s.vz *= 0.88;
            s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
            this.stats.smashes++;
            this.events.push({ type: 'smash', id: o.id, x: o.x, y: o.y, z: o.z });
            this.style('smash', 150);
            continue;
          }
          const vn = -(s.vx * hit.nx + s.vz * hit.nz);
          if (s.invuln === 0 && (vn > 9 || (vn > 6 && s.speed > 24))) {
            this.wipeout(o.kind === 'pine' || o.kind === 'blossom' || o.kind === 'charpine' ? 'tree' : 'rock');
            return;
          }
          // Glancing blow: push out, deflect, wobble, bank the combo.
          s.x += hit.nx * (touch - hit.d + 0.02);
          s.z += hit.nz * (touch - hit.d + 0.02);
          if (vn > 0) {
            s.vx += hit.nx * vn * 1.3;
            s.vz += hit.nz * vn * 1.3;
          }
          s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz) * 0.86;
          s.velHeading = datan2(s.vx, s.vz);
          s.heading = s.velHeading;
          s.vx = s.speed * dsin(s.velHeading);
          s.vz = s.speed * dcos(s.velHeading);
          s.wobble = 22;
          const banked = this.combo.bank();
          if (banked > 0) this.events.push({ type: 'comboBank', points: banked, mult: this.combo.lastMult });
          this.events.push({ type: 'bump', id: o.id });
        } else if (!o.soft && hit.d < touch + 1.15 && s.speed > 12 && !this.resolvedObstacles.has(o.id)) {
          const prev = this.nearMiss.get(o.id);
          if (prev === undefined || hit.d < prev) this.nearMiss.set(o.id, hit.d);
        }
        if (s.z > Math.max(o.z, o.z2) + o.r + 1.5 && prevZ <= Math.max(o.z, o.z2) + o.r + 1.5) this.resolveNearMiss(o);
      }
    }
  }

  private resolveNearMiss(o: Obstacle): void {
    // The closest approach, read before the entry goes: the event carries the edge gap, the side and
    // the nearest point on the obstacle (a log is a segment) for the presentation. Points and call
    // order are unchanged, and nothing here is state.
    const d = this.nearMiss.get(o.id);
    if (d === undefined) return;
    this.nearMiss.delete(o.id);
    if (this.resolvedObstacles.has(o.id)) return;
    this.resolvedObstacles.add(o.id);
    this.stats.nearMisses++;
    const s = this.s;
    let px = o.x;
    let pz = o.z;
    if (o.x2 !== o.x || o.z2 !== o.z) {
      const ex = o.x2 - o.x;
      const ez = o.z2 - o.z;
      const t = clamp(((s.x - o.x) * ex + (s.z - o.z) * ez) / (ex * ex + ez * ez), 0, 1);
      px = o.x + ex * t;
      pz = o.z + ez * t;
    }
    this.style('nearMiss', 120, { gap: Math.max(0, d - o.r - SLED_RADIUS), side: px > s.x ? 1 : -1, x: px, z: pz, obs: o.kind, id: o.id });
  }

  private pickups(prevZ: number): void {
    const s = this.s;
    const c = this.course;
    const ci = Math.floor(s.z / CHUNK_LEN);
    const reach = 1.55 * this.sled.magnet + 0.25;
    const r2 = reach * reach;
    for (let k = ci - 1; k <= ci + 1; k++) {
      if (k < 0) continue;
      const chunk = c.chunk(k);
      for (const lt of chunk.lights) {
        if (this.collected.has(lt.id)) continue;
        const dz = lt.z - s.z;
        if (dz > 3 || dz < -3) continue;
        const dx = lt.x - s.x;
        const gy = c.ground(lt.x, lt.z) + lt.hover;
        const dy = gy - (s.y + 0.5);
        if (dx * dx + dz * dz + dy * dy < r2) this.collectLight(lt.id, lt.value, lt.x, gy, lt.z);
      }
      for (const gate of chunk.gates) {
        if (prevZ < gate.z && s.z >= gate.z && s.x > gate.x1 + 0.45 && s.x < gate.x2 - 0.45) {
          this.stats.gates++;
          this.style('gate', 250);
        }
      }
    }
    // A sky gate: through its ring as the sled crosses its plane.
    while (this.gateAt < this.gates.length && this.gates[this.gateAt].z < prevZ - 1) this.gateAt++;
    const gate = this.gateAt < this.gates.length ? this.gates[this.gateAt] : null;
    if (gate && prevZ < gate.z && s.z >= gate.z) {
      this.gateAt++;
      const dx = s.x - gate.x;
      const dy = s.y + 0.5 - gate.y;
      const through = dx * dx + dy * dy < gate.r * gate.r;
      if (gate.moment !== undefined) this.momentRing(gate.moment, through);
      else if (through) {
        this.stats.skyGates++;
        this.events.push({ type: 'skyGate', id: gate.id, stage: gate.stage });
        this.style('skyGate', 400);
      }
    }
    for (const g of this.dyn.storm) {
      if (g.collected || this.tick < g.spawnTick) continue;
      const dx = g.x - s.x;
      const dz = g.z - s.z;
      if (dz > 3 || dz < -3) continue;
      const gy = this.stormGiftY(g);
      const dy = gy - (s.y + 0.5);
      if (dx * dx + dz * dz + dy * dy < r2 * 1.2) {
        g.collected = true;
        this.collectLight(g.id, g.value, g.x, gy, g.z);
      }
    }
  }

  stormGiftY(g: StormGift): number {
    const t = (this.tick - g.spawnTick) / TICK_RATE;
    const base = this.course.ground(g.x, g.z) + 0.9;
    const fall = 16 - 9 * t * t;
    return base + (fall > 0 ? fall : 0);
  }

  private collectLight(id: number, value: number, x: number, y: number, z: number): void {
    this.collected.add(id);
    const great = value > 1;
    const before = this.s.lantern;
    this.charge((great ? GREAT : SPARK) * this.mood.lightValue, false);
    this.stats.lights++;
    if (great) this.stats.greatLights++;
    this.events.push({ type: 'light', id, value, gain: this.s.lantern - before, x, y, z });
    this.lightScore += great ? 50 : 10;
  }

  private draft(bit: boolean): void {
    const s = this.s;
    if (s.crashed) {
      s.drafting = false;
      s.draftTicks = 0;
      s.draftCharge = 0;
      return;
    }
    let active = bit;
    if (this.dyn.trainPhase === 2 && this.trainDraft()) {
      active = true;
      // Riding in the spirits' wake lights the lantern fast: the train is fuel for whoever chases it.
      this.charge(1, true);
    }
    s.drafting = active && !s.crashed;
    if (s.drafting) {
      s.draftTicks++;
      this.stats.draftTicks++;
      s.draftCharge = Math.min(1, s.draftTicks / 90);
      if (s.speed < MAX_SPEED - 2) {
        s.speed += 1.5 * this.sled.draft * this.mood.draft * DT;
        s.vx = s.speed * dsin(s.velHeading);
        s.vz = s.speed * dcos(s.velHeading);
      }
      if (s.draftTicks % 30 === 0) this.style('draft', 40);
    } else {
      if (s.draftTicks >= 36) {
        const boost = (2.5 + 3.5 * s.draftCharge) * this.mood.draft;
        s.boostPool += boost;
        this.events.push({ type: 'boost', amount: boost, source: 'slingshot' });
        this.style('slingshot', 200);
      }
      s.draftTicks = 0;
      s.draftCharge = 0;
    }
  }

  private trainDraft(): boolean {
    const s = this.s;
    for (const sp of this.dyn.spirits) {
      const ahead = sp.z - s.z;
      if (ahead < 1.5 || ahead > 14) continue;
      if (Math.abs(sp.x - s.x) < 1.9 + ahead * 0.06) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- chaos events

  private chaos(): void {
    const ev = this.config.chaos.event;
    if (ev === ChaosEvent.None) return;
    const s = this.s;
    const d = this.dyn;
    switch (ev) {
      case ChaosEvent.Avalanche:
        this.avalanche(s, d);
        break;
      case ChaosEvent.Yeti:
        this.yeti(s, d);
        break;
      case ChaosEvent.GiftStorm:
        this.giftStorm(s, d);
        break;
      case ChaosEvent.GhostTrain:
        this.ghostTrain(s, d);
        break;
    }
  }

  private avalanche(s: SledState, d: DynState): void {
    const a = d.avalanche;
    if (a.phase === 0 && s.z >= d.triggerZ && !s.crashed) {
      a.phase = 1;
      a.ticks = 0;
      this.events.push({ type: 'chaos', phase: 'warn', event: ChaosEvent.Avalanche });
    }
    if (a.phase === 1) {
      a.ticks++;
      if (a.ticks >= 180) {
        a.phase = 2;
        a.ticks = 0;
        a.z = s.z - 45;
        this.events.push({ type: 'chaos', phase: 'start', event: ChaosEvent.Avalanche });
      }
    } else if (a.phase === 2) {
      a.ticks++;
      const gap = s.z - a.z;
      // Paced off this mountain's and mood's cruise speed. It rumbles forward in surges (the tension),
      // but a clean rider holding the line keeps clear; bumps and crashes are what it punishes.
      const surge = a.ticks % 300 < 90 ? 3.5 : 0;
      const pace = 0.87 - (1 - this.mood.grip) * 0.2;
      a.speed = pace * this.cruiseSpeed() + surge + Math.max(0, gap - 70) * 0.3;
      a.z += a.speed * DT;
      if (!s.crashed && a.z >= s.z - 0.5) {
        this.crash('avalanche');
        a.phase = 3;
        return;
      }
      if (a.ticks >= 1320) {
        a.phase = 3;
        this.stats.outranAvalanche = true;
        this.events.push({ type: 'chaos', phase: 'success', event: ChaosEvent.Avalanche });
        this.style('avalanche', 2000);
      }
    }
  }

  /** Is any hard obstacle within (radius + pad) of a point? */
  private nearHard(x: number, z: number, pad: number): boolean {
    const ci = Math.floor(z / CHUNK_LEN);
    for (let k = ci - 1; k <= ci + 1; k++) {
      if (k < 0) continue;
      for (const o of this.course.chunk(k).obstacles) {
        if (o.soft) continue;
        const r = o.r + pad;
        const dx = x - (o.x + o.x2) * 0.5;
        const dz = z - (o.z + o.z2) * 0.5;
        const ext = (o.x2 !== o.x || o.z2 !== o.z) ? 3 : 0;
        if (dx * dx + dz * dz < (r + ext) * (r + ext)) return true;
      }
    }
    return false;
  }

  /** Terminal cruise speed on the base slope for this mood (no skill boosts). */
  cruiseSpeed(): number {
    const g = this.gravity;
    const sl = this.course.params.slope;
    const drive = (g * sl) / (1 + sl * sl) - MU * g;
    const cd = CD * this.mood.drag * this.sled.drag;
    return drive > 0 ? Math.sqrt(drive / cd) : 0;
  }

  private yeti(s: SledState, d: DynState): void {
    const y = d.yeti;
    const c = this.course;
    if (y.phase === 0 && s.z >= d.triggerZ && !s.crashed) {
      y.phase = 1;
      y.ticks = 0;
      y.z = s.z + 150 + this.chaosRng.next() * 20;
      y.dir = this.chaosRng.chance(0.5) ? 1 : -1;
      y.x = c.centerX(y.z) - y.dir * (c.halfWidth(y.z) + 6);
      this.events.push({ type: 'chaos', phase: 'warn', event: ChaosEvent.Yeti });
    }
    if (y.phase === 1) {
      y.ticks++;
      if (y.ticks >= 150) {
        y.phase = 2;
        y.ticks = 0;
        this.events.push({ type: 'chaos', phase: 'start', event: ChaosEvent.Yeti });
      }
    } else if (y.phase === 2) {
      y.ticks++;
      y.x += y.dir * 4.8 * DT;
      const off = (y.x - c.centerX(y.z)) * y.dir;
      if (off > c.halfWidth(y.z) + 7 || s.z > y.z + 25) {
        y.phase = 3;
        this.events.push({ type: 'chaos', phase: 'end', event: ChaosEvent.Yeti });
        return;
      }
      if (s.crashed) return;
      const dx = s.x - y.x;
      const dz = s.z - y.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const top = c.ground(y.x, y.z) + 2.7;
      if (dist < 1.45 + SLED_RADIUS) {
        if (s.y > top) {
          if (!y.hopped) {
            y.hopped = true;
            this.stats.yetiHop = true;
            this.style('yetiHop', 1500);
          }
        } else if (s.invuln === 0) {
          this.wipeout('yeti');
        }
      }
    }
  }

  private giftStorm(s: SledState, d: DynState): void {
    const c = this.course;
    if (d.stormPhase === 0 && s.z >= d.triggerZ && !s.crashed) {
      d.stormPhase = 1;
      d.stormTicks = 0;
      this.events.push({ type: 'chaos', phase: 'warn', event: ChaosEvent.GiftStorm });
    }
    if (d.stormPhase === 1) {
      d.stormTicks++;
      if (d.stormTicks >= 120) {
        d.stormPhase = 2;
        d.stormTicks = 0;
        this.events.push({ type: 'chaos', phase: 'start', event: ChaosEvent.GiftStorm });
      }
    } else if (d.stormPhase === 2) {
      d.stormTicks++;
      if (d.stormTicks % 15 === 0 && d.storm.length < 48) {
        const k = d.storm.length;
        const z = s.z + 62 + this.chaosRng.next() * 22;
        // The storm spreads wide across the corridor: chasing it is a choice, and the safe line gets little.
        const sway = dsin(k * 0.55) * Math.max(0, c.halfWidth(z) - 2.5) * 0.95;
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        let x = clamp(c.safeX(z) + sway, cx - hw + 1.2, cx + hw - 1.2);
        // Never drop a gift into a trunk: fall back to the guaranteed lane.
        if (this.nearHard(x, z, 1.9)) x = c.safeX(z);
        d.storm.push({ id: 10_000_000 + k, x, z, y: 0, value: k % 4 === 3 ? 3 : 1, spawnTick: this.tick, collected: false });
      }
      if (d.stormTicks >= 720) {
        d.stormPhase = 3;
        this.events.push({ type: 'chaos', phase: 'end', event: ChaosEvent.GiftStorm });
      }
    }
  }

  private ghostTrain(s: SledState, d: DynState): void {
    const c = this.course;
    if (d.trainPhase === 0 && s.z >= d.triggerZ && !s.crashed) {
      d.trainPhase = 1;
      d.trainTicks = 0;
      this.events.push({ type: 'chaos', phase: 'warn', event: ChaosEvent.GhostTrain });
    }
    if (d.trainPhase === 1) {
      d.trainTicks++;
      if (d.trainTicks >= 120) {
        d.trainPhase = 2;
        d.trainTicks = 0;
        for (let k = 0; k < 8; k++) {
          const z = s.z - 22 - k * 6.5;
          const offset = (k % 2 === 0 ? -1 : 1) * (0.6 + (k % 3) * 0.5);
          d.spirits.push({ x: c.safeX(z) + offset, y: c.ground(c.safeX(z), z), z, offset });
        }
        this.events.push({ type: 'chaos', phase: 'start', event: ChaosEvent.GhostTrain });
      }
    } else if (d.trainPhase === 2) {
      d.trainTicks++;
      const v = Math.max(s.speed, 20) + 6.5;
      let minAhead = Infinity;
      for (const sp of d.spirits) {
        sp.z += v * DT;
        sp.x = c.safeX(sp.z) + sp.offset;
        sp.y = c.ground(sp.x, sp.z);
        minAhead = Math.min(minAhead, sp.z - s.z);
      }
      if (minAhead > 120 || d.trainTicks > 1500) {
        d.trainPhase = 3;
        this.events.push({ type: 'chaos', phase: 'end', event: ChaosEvent.GhostTrain });
      }
    }
  }

  /** Order-sensitive hash of the full dynamic state, for determinism tests. */
  hash(): number {
    const s = this.s;
    const buf = new DataView(new ArrayBuffer(8));
    let h = 0x811c9dc5;
    const mixF = (v: number) => {
      buf.setFloat64(0, v);
      h = Math.imul(h ^ buf.getUint32(0), 0x01000193) >>> 0;
      h = Math.imul(h ^ buf.getUint32(4), 0x01000193) >>> 0;
    };
    mixF(s.x);
    mixF(s.y);
    mixF(s.z);
    mixF(s.vx);
    mixF(s.vy);
    mixF(s.vz);
    mixF(s.heading);
    mixF(s.velHeading);
    mixF(s.airYaw);
    mixF(s.airPitch);
    mixF(s.boostPool);
    mixF(s.flow);
    mixF(this.combo.pending);
    mixF(this.combo.banked);
    mixF(this.tick);
    mixF(this.stats.lights);
    mixF(s.crashed ? 1 : 0);
    mixF(s.tumble);
    mixF(s.tumbles);
    mixF(s.finished ? 1 : 0);
    mixF(s.grinding ? this.railU : -1);
    mixF(s.lantern);
    mixF(s.dash);
    mixF(s.ghost);
    mixF(this.overcap);
    mixF(this.mo.active);
    mixF(this.mo.n);
    mixF(this.mo.at);
    mixF(this.mo.pace);
    mixF(this.stats.momentMask);
    return h >>> 0;
  }
}

export function isMood(roll: ChaosRoll, m: Mood): boolean {
  return roll.mood === m;
}

/** What a piece of skill lights in the lantern (charge units; LANTERN is one lantern). A stomp, a whisker, a
 *  slingshot or a grind is worth a few sparks; a sky gate, a yeti hopped and an avalanche outrun are worth a
 *  whole lantern. `gap` is a near miss's edge gap, or -1. */
export function skillCharge(kind: StyleKind, base: number, gap: number): number {
  switch (kind) {
    case 'perfect':
      return 16;
    case 'clean':
      return 5;
    case 'spin':
      return 4;
    case 'flip':
      return 8;
    case 'nearMiss':
      return gap >= 0 && gap < WHISKER ? 12 : 5;
    case 'cleared':
      return 6;
    case 'slingshot':
      return 18;
    case 'draft':
      return 2;
    case 'drift':
      return base >= 700 ? 14 : base >= 350 ? 8 : 4;
    case 'smash':
      return 3;
    case 'gate':
      return 15;
    case 'geyser':
      return 6;
    case 'boostPop':
      return 6;
    case 'wallRide':
      return base >= 200 ? 10 : 4;
    case 'grind':
      return base >= 150 ? 6 : 3;
    case 'carve':
      return 5;
    case 'skyGate':
    case 'yetiHop':
    case 'avalanche':
      return LANTERN;
    default:
      return 0;
  }
}
