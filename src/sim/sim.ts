import { ChaosEvent, ChaosRoll, Mood, MoodParams, eventAllowed, eventTriggerZ, moodInfo } from './chaos';
import { CHUNK_LEN, Course, Obstacle, ObstacleKind, Rail, SkyGate, courseFor } from './course';
import { PI, TAU, angleDiff, approach, clamp, datan2, dcos, dsin, wrapAngle } from './dmath';
import { MAX_RUN_TICKS, actionOf, draftOf, spiritOf, steerOf } from './input';
import { Rng } from './prng';
import { Combo, StyleKind } from './scoring';
import { SledDef, sledById } from './sleds';
import { CHARM, CHARM_COUNT, type CharmGate, PATH_ID0, PATH_STEP, STARTER_POOL, laneOf, offersFor, synergiesOf } from './charms';
import { SHOWDOWN_POINTS, SHOWDOWN_UNITS, STEAL_POINTS, STEAL_UNITS } from './rivals';
import { DOUBLE_GAP, GRAB_LATCH, GRAB_STEER, LATCH_TICKS, LET_GO_TICKS, SIGNATURE, SPECIAL_TICKS, SPECIAL_WINDOW, TAP_TICKS, TRICK, TRICKS, TWEAK_LATE, grabTier, nameFlight, sigFallTier, sigTier } from './tricks';
import { KINDLE_COLD, KINDLE_REACH, LEGEND_AHEAD, WAKE_MIN, pathOff, LEGEND_ID0, type LegendPlay, type MomentPlay, RIBBON_CAP, RIBBON_HW, RIBBON_RATE, coastSeconds, fallPace, fallZ, flamePace, gateX, legendFor, machineZ, momentPlays, pathX } from './moments';

// The deterministic run simulation. One call to step() advances exactly one 60 Hz tick.

/** Bump whenever simulation behaviour changes; bundled ghost pools record the version they were made with. */
export const SIM_VERSION = 10;
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
/** A fall, in ticks (round 7): the rider tumbles and slides to a stop on the safe line (falling), lies in the
 *  snow (down), then stands the sled up and pushes off (up): a second and a half. The run goes on; the time
 *  is lost. (2.1 s was tried first: a first-timer falls a dozen times a run, and spent half a minute of it
 *  lying in the snow.) */
export const FALL_TICKS = 42;
export const DOWN_TICKS = 18;
export const UP_TICKS = 30;
/** What a falling sled keeps of its speed each tick: from 30 m/s it has slid about 6 m and all but stopped. */
const FALL_BLEED = 0.93;
/** The whole fall, start to riding again (the picture's tumble reads its progress off this). */
export const TUMBLE_TICKS = FALL_TICKS + DOWN_TICKS + UP_TICKS;
/** The phases of a fall (SledState.fall): what the rider is doing, for whoever draws it. */
export const FALL_NONE = 0;
export const FALL_FALLING = 1;
export const FALL_DOWN = 2;
export const FALL_UP = 3;
/** Get-ups a rider carries. A fall past the free stretch spends one; with none left the next fall ends the run. */
export const GET_UPS = 3;
/** One comes back for every this many metres ridden, and all of them at a stage line. So what ends a run is
 *  falling four times in about a quarter of a mile, not falling often: the lab's clumsy first-timer falls nine
 *  or ten times a run and wrecks in about one run in twenty. (350 m, counted from the last fall, was tried
 *  first: it finished 19 runs of 48.) */
export const GET_UP_BACK_M = 200;
/** The speed a rider pushes off at, as a share of cruise, and the least of it (just over what the wedged
 *  sled's rescue counts as stuck). Above the least it is never more than the speed the sled had down the run
 *  as the fall began, so getting up is never a way to go faster. */
const GET_UP_SPEED = 0.5;
const GET_UP_MIN = 3;
/** Untouchable for this long after getting up: a fall cannot chain into the same tree, or a bad landing. */
const GET_UP_INVULN = 150;
/** How hard a sled must meet something head on to fall (m/s into it). Under this it bounces off, as a glancing
 *  blow always did. It was 9: a rider just back on the sled at 12 m/s fell again on the next rock, and a third
 *  of a first-timer's falls came under 16 m/s. A fast sled falls on less (HIT_FAST into it past HIT_FAST_SPEED),
 *  as before. */
const HIT_HARD = 12;
const HIT_FAST = 6;
const HIT_FAST_SPEED = 24;
/** (The old name for the count: the get-ups a rider starts with.) */
export const TUMBLES = GET_UPS;
/** Before this distance a fall is always free: nobody's first minute ends in a wreck. */
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
/** The landing set, in numbers (round 7): how hard a spin is stopped (rad/s^2: from full rate in 6 ticks, so
 *  the swing has 8 left and a spin alone can never wreck a landing), and how fast the rider comes out of a
 *  flip to the nearest whole turn, in the set and once the button is let go in the air (rad/s). */
const LAND_SET_SPIN = 90;
const LAND_SET_PITCH = 4;
const FLIP_RIGHT = 4.5;
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
/** Round 9, the Old Run: how hard its track damps a sled's swing across the channel (rad/s on the heading's difference
 *  from the channel's direction). About 0.7 of critical on its deepest wall, whose swing has a period of 2.5 s. */
export const TRACK_DAMP = 3.5;

/** Round 9, the Old Run: how fast a banked surface turns a carving sled, rad/s: the ground's rise toward the channel's
 *  right (the gradient across the channel's direction `phi`), times gravity, over the speed (8 m/s at least). A sled
 *  holds a height on a bend's outside wall where this turns it as fast as the channel turns: tan(theta) = v^2 / (g R).
 *  The bot predicts its heading with it (bot.ts), so the two never drift apart. */
export function wallYaw(grad: { x: number; z: number }, phi: number, speed: number, g: number): number {
  return (g * (grad.x * dcos(phi) - grad.z * dsin(phi))) / (speed > 8 ? speed : 8);
}
/** A near miss under this edge gap is a whisker (the director's WHISKER_GAP): it lights more. */
const WHISKER = 0.45;
/** Set pieces (moments.ts): the lantern a gate threaded and a ring flown light, how near the fall comes before
 *  it is close, and the speed a sled the fall catches keeps. */
const GATE_UNITS = 6;
const RING_UNITS = 12;
const COLLAPSE_CLOSE = 7;
const COLLAPSE_KEEP = 0.72;
/** What a bell rung lights, and a stone lamp kindled. */
const SHATTER_UNITS = 8;
const KINDLE_UNITS = 4;
/** A legend moment (moments.ts) is said this far up the run from where it plays, and a runner never falls below
 *  this pace. */
/** Spirit Flow (round 8): heat a whole level per this many base style points; it starts cooling after this many
 *  dull ticks, a level every FLOW_COOL; heat runs a little over the top level so one quiet beat does not drop it. */
const FLOW_HEAT_PER = 1000;
const FLOW_DULL = 180;
const FLOW_COOL = 60;
const FLOW_HEAT_MAX = 7;
const LEGEND_WARN = 220;
const LEGEND_PACE = 20;

export type CrashCause = 'tree' | 'rock' | 'forest' | 'landing' | 'yeti' | 'avalanche' | 'daylight';
export type TumbleCause = Exclude<CrashCause, 'avalanche' | 'daylight'>;
export type TakeoffKind = 'lip' | 'pop' | 'geyser';
export type LandQuality = 'perfect' | 'clean' | 'sketchy' | 'hop';

export type SimEvent =
  | { type: 'takeoff'; kind: TakeoffKind; vy: number }
  /** Every touchdown is said. `botched`: a landing that floors a racer (a fall, a ward or the wreck follows on the
   *  same tick, or nothing at all for a rider just up and still untouchable); it is said as sketchy, no points. */
  | { type: 'land'; quality: LandQuality; airtime: number; halfTurns: number; flips: number; impact: number; late: boolean; botched?: true }
  | { type: 'crash'; cause: CrashCause }
  /** A fall the run survives: 'start' as the rider goes down, 'end' riding again. `left`: get-ups left. */
  | { type: 'tumble'; phase: 'start' | 'end'; cause: TumbleCause; left: number }
  /** A fall's middle, for the picture: 'down' as the rider comes to rest, 'up' as it starts to stand. */
  | { type: 'fall'; phase: 'down' | 'up' }
  /** A get-up came back: one for GET_UP_BACK_M ridden without a fall, or all of them at a stage line. */
  | { type: 'getUp'; left: number; why: 'ridden' | 'stage' }
  /** Turned back by something solid at the corridor's edge. */
  | { type: 'scrape'; side: -1 | 1; speed: number }
  /** A stage line crossed: its index and the tick. */
  | { type: 'stage'; index: number; tick: number }
  /** The finish line crossed. */
  | { type: 'finish'; tick: number; bonus: number }
  | { type: 'grind'; phase: 'start' | 'end'; id: number }
  /** Near-miss styles may carry the edge gap (m), the side (+1 = obstacle on the sled's +x side), the
   *  nearest point on the obstacle (x, z), its kind and id. Optional and never hashed; filled later. */
  | { type: 'style'; kind: StyleKind; points: number; chain: number; mult: number; gap?: number; side?: -1 | 1; x?: number; z?: number; obs?: ObstacleKind; id?: number; trick?: number; halfTurns?: number; flips?: number; tier?: number; late?: boolean; fresh?: boolean }
  /** In the air (tricks.ts): a grab taken ('start', its side), a tier reached, a tweak begun, let go ('release'), let
   *  go by the rider itself as it sets for the landing ('auto'); a rail's, a wall's or the sled's own move begun
   *  ('move'). `trick` is the pose's trick id. */
  | { type: 'grab'; phase: 'start' | 'tier' | 'tweak' | 'release' | 'auto' | 'move'; side: number; tier: number; trick: number }
  | { type: 'comboBank'; points: number; mult: number }
  | { type: 'comboLost'; points: number }
  /** A spirit light taken: its id, value (1 or 3), the charge it gave and where it was. */
  | { type: 'light'; id: number; value: number; gain: number; x: number; y: number; z: number }
  /** A sky gate ridden through. */
  | { type: 'skyGate'; id: number; stage: number }
  /** A set piece's verb (moments.ts) as it plays: 'start' as the rider reaches it, 'step' as a gate is
   *  threaded, a ring flown or a step stomped (n of `of`), 'miss' as one is not (n back to 0 for gates and
   *  rings, the run of steps over), 'lead' and 'trail' as the rider passes the race's machine or it passes
   *  back (the carry: 'trail' as a fall or a ward gutters the flame, 'lead' as it catches again), 'close' as a
   *  collapse's fall comes within a few metres, and 'won' or 'lost' as it is decided. */
  | { type: 'moment'; index: number; phase: 'start' | 'step' | 'miss' | 'lead' | 'trail' | 'close' | 'won' | 'lost'; n: number; of: number }
  /** The run's legend moment (moments.ts LEGENDS): 'warn' as it comes up, 'start' as the rider reaches it, 'step'
   *  as a ribbon lights another quarter lantern (n quarters), 'end' as the rider leaves it. */
  | { type: 'legend'; phase: 'warn' | 'start' | 'step' | 'end'; slot: number; n: number }
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
  | { type: 'revive' }
  /** A charm gate crossed (charms.ts): the lane taken and the charm it gave (-1 for an empty arch). */
  | { type: 'charm'; gate: number; lane: number; id: number }
  /** A named pair of charms now held (charms.ts SYNERGIES). */
  | { type: 'synergy'; id: number }
  /** Spirit Flow's whole level changed (0 to 6). */
  | { type: 'flow'; level: number; from: number }
  /** A showdown won or a wisp stolen, as its log token is applied (rivals.ts). */
  | { type: 'rival'; kind: 'showdown' | 'steal'; gain: number };

export interface SimConfig {
  seed: number;
  chaos: ChaosRoll;
  sled: number;
  /** The charms this rider may be offered (charms.ts, a 24-bit mask). Absent: STARTER_POOL. */
  charmPool?: number;
  /** How many charm gates stand, in order (1: only the start's). Absent: 3. */
  charmGates?: 1 | 2 | 3;
  /** A Long Night leg: what it starts with from the leg before. Absent: a fresh start. */
  carry?: Carry;
  /** A fresh save's very first run: a wider stomp window. */
  firstRun?: boolean;
}

/** What a Long Night leg carries in (and its record holds exactly): the lantern (0 to LANTERN_MAX), the get-ups (0 to
 *  GET_UPS) and up to three charms held, which this leg's gates then never offer. (The chaos that rises leg by leg
 *  is the leg's own ChaosRoll, which every record already holds: nothing more is needed here.) */
export interface Carry {
  lantern: number;
  getUps: number;
  charms: number[];
}

/** Ember Step: a dash this many ticks after a perfect landing costs 0.7 of a lantern. */
export const EMBER_STEP_TICKS = 24;

/** A first run's stomp: a press this many ticks before touchdown (9 otherwise), or this many after it (5). */
export const FIRST_RUN_STOMP = 15;
export const FIRST_RUN_LATE = 8;

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
  /** Spirit Flow as the picture reads it, eased (0 to 6); `flowLevel` is the whole level that pays. */
  flow: number;
  flowLevel: number;
  invuln: number;
  crashed: boolean;
  crashCause: CrashCause | null;
  crashTick: number;
  onIce: boolean;
  /** Ticks left of a fall, all three phases (0 when riding). */
  tumble: number;
  /** What a fallen rider is doing: FALL_NONE riding, FALL_FALLING tumbling to a stop, FALL_DOWN lying in the
   *  snow, FALL_UP standing the sled up and pushing off. */
  fall: number;
  /** The tick the fall's present phase began, and the tick the fall itself began (-1 when riding). */
  fallTick: number;
  fallStart: number;
  /** Get-ups left (GET_UPS at the start). */
  getUps: number;
  /** Where the count toward the next get-up began, metres down the run (it follows the sled while all are held). */
  getUpZ: number;
  /** Falls this run, the free ones too (a ward is not a fall). */
  falls: number;
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
  /** A grab held (tricks.ts): its side (-1, 1; 0 none), ticks held and tier; ticks a tweak has been held. */
  grab: number;
  grabTicks: number;
  grabTier: number;
  tweak: number;
  /** The trick the rider is posed in now (tricks.ts TRICK; 0 none): a grab's tier, a move, the sled's own. */
  move: number;
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
  /** Metres up it starts its fall from (a storm's light: 16). A legend's lights are laid on the snow: 0. */
  drop?: number;
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
  /** The legend moment the run met (its slot, 0 for none), and the charge its lights and its ribbon gave. */
  legend: number;
  legendLit: number;
  /** The named tricks landed this run, a bit each by id (tricks.ts). */
  trickMask: number;
  /** Spirit Flow: the highest level held a second or more, and the ticks ridden at each level (0 to 6). */
  bestFlow: number;
  flowTicks: number[];
  /** Showdowns won and wisps stolen (rivals.ts). */
  showdowns: number;
  steals: number;
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
  /** Gates and rings: the next one down the run. Steps: whether every landing so far was perfect. Carry: the
   *  ticks a guttering flame has left to be ridden back up to its pace (0 while it burns, the play's `gutter`
   *  at most; the count runs only while the rider is riding, so through a fall it stands at the full count). */
  at: number;
  ok: boolean;
  /** Collapse: the fall's pace, from the rider's speed onto the span (moments.ts fallPace). Follow: metres
   *  ridden in the wake. Surge: the speed off the lip. Carry: the flame, 1 full to 0 out (while it gutters,
   *  the level it holds). */
  pace: number;
  /** What is done of what the verb holds, a bit each: a chase's cars passed, a slide's ways, bells rung,
   *  lamps lit, the carry's brazier taken. */
  mask: number;
  /** The verb's own small number. Steps in a row: the run before a clean landing. Slide: the way of the drift.
   *  Surge: off the lip. Kindle: lamps lit on the left. Carry: while the flame gutters, the seconds it had in
   *  hand over a clean coast to the line. */
  aux: number;
}

/** A legend moment as the run meets it: 0 waiting, 1 said, 2 playing, 3 over; the tick it began; a ribbon's
 *  charge given; a runner's head, metres down the course. */
export interface LegendState {
  phase: number;
  t0: number;
  n: number;
  head: number;
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
    // (Round 9: the Old Run's track. Read once here, so the five's paths test a constant false and nothing else.)
    this.trackOn = this.course.layout.grammar === 'oldrun';
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
      flowLevel: 0,
      invuln: 0,
      crashed: false,
      crashCause: null,
      crashTick: -1,
      onIce: false,
      tumble: 0,
      fall: FALL_NONE,
      fallTick: -1,
      fallStart: -1,
      getUps: GET_UPS,
      getUpZ: 0,
      falls: 0,
      finished: false,
      finishTick: -1,
      wallTicks: 0,
      grinding: false,
      lantern: 0,
      dash: 0,
      ghost: 0,
      grab: 0,
      grabTicks: 0,
      grabTier: 0,
      tweak: 0,
      move: 0,
    };
    this.plays = momentPlays(this.course, config.chaos);
    this.legend = legendFor(this.course, config.chaos);
    this.skyGates = [...this.course.stageGates, ...this.plays.flatMap((p) => p.rings)].sort((a, b) => a.z - b.z);
    this.gates = this.skyGates;
    this.course.gradient(x0, z0, vec);
    this.s.vy = vec.z * this.s.vz;
    this.dyn = {
      // (Round 9: an event this course cannot meet never plays, whatever a record says: chaos.ts rollChaos's mask.)
      triggerZ: eventAllowed(config.chaos.event, this.course.layout.events) ? eventTriggerZ(config.chaos) : Infinity,
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
      legend: 0,
      legendLit: 0,
      trickMask: 0,
      bestFlow: 0,
      flowTicks: [0, 0, 0, 0, 0, 0, 0],
      showdowns: 0,
      steals: 0,
    };
    this.pool = (config.charmPool ?? STARTER_POOL) >>> 0;
    // (How many gates stand: the Almanac opens the second and third. Absent, all three.)
    const gates = config.charmGates === 1 || config.charmGates === 2 ? config.charmGates : 3;
    this.charmGates = this.course.charmGateZs.slice(0, gates).map((z, index): CharmGate => ({ index, z, x: this.course.safeX(z), offers: [-1, -1, -1], lane: -1, pick: -1 }));
    // A leg of the Long Night starts with what the leg before ended with (its gates then never offer a charm held).
    const carry = config.carry;
    if (carry) {
      this.s.lantern = clamp(Math.round(carry.lantern), 0, LANTERN_MAX);
      this.s.getUps = clamp(carry.getUps | 0, 0, GET_UPS);
      for (const id of carry.charms.slice(0, 3)) {
        if (id < 0 || id >= CHARM_COUNT || this.has(id)) continue;
        this.charms.push(id);
        this.charmMask |= 1 << id;
        this.takeCharm(id);
      }
      for (const p of synergiesOf(this.charmMask)) this.synergyMask |= 1 << p.id;
    }
    this.stompTicks = config.firstRun ? FIRST_RUN_STOMP : 9;
    if (this.charmGates.length) this.charmGates[0].offers = offersFor(config.chaos.seed, 0, this.pool, this.charms);
  }

  /** The run's set pieces and what their verbs hold: the variants its roll picked (moments.ts). */
  readonly plays: readonly MomentPlay[];
  /** Every ring of light this run can fly, in order: the stages' sky gates and the set pieces' ring lines as this
   *  run's variants hang them (the renderer draws this list; Course.skyGates is a plain day's). */
  readonly skyGates: readonly SkyGate[];
  /** The set piece being played (public: the renderer reads the race's machine and the collapse's fall). */
  readonly mo: MomentState = { active: -1, next: 0, t0: 0, n: 0, of: 0, ahead: false, close: false, at: 0, ok: true, pace: 0, mask: 0, aux: 0 };
  /** The run's legend moment, if its roll has one, and how it stands (public: the renderer stages it). */
  readonly legend: LegendPlay | null;
  readonly lg: LegendState = { phase: 0, t0: 0, n: 0, head: 0 };

  /** Small direct score from spirit lights (they are the lantern's fuel, not combo fuel). */
  lightScore = 0;
  /** The finish's bonus: flat, plus what the run beat par by. */
  finishBonus = 0;
  /** The tick each stage line was crossed. */
  readonly stageTicks: number[] = [];
  /** The charm pool this run deals from, the run's charm gates (where, what each lane offers, what was taken),
   *  the charms held in the order taken, and the same as a mask; the named pairs held, a bit each. */
  readonly pool: number;
  readonly charmGates: CharmGate[];
  /** How close to touchdown a press (or a grab let go) still stomps: wider on a save's very first run. */
  private readonly stompTicks: number;
  /** The Old Run's track: gravity along the runners, the bank's yaw, the damped swing, the launch off a wall's plane and
   *  the turn-back square to the channel (round 9). False on every other course. */
  private readonly trackOn: boolean;
  readonly charms: number[] = [];
  charmMask = 0;
  synergyMask = 0;
  /** Spirit Flow's heat (style adds it, a dull stretch and a hit take it), and ticks since the last style. */
  private heat = 0;
  private dull = 0;
  private flowHeld = 0;
  private gateNext = 0;

  /** Holds a charm (charms.ts CHARM). */
  has(id: number): boolean {
    return (this.charmMask & (1 << id)) !== 0;
  }

  /** Holds a named pair (charms.ts SYNERGIES id). */
  hasPair(id: number): boolean {
    return (this.synergyMask & (1 << id)) !== 0;
  }

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
    this.clearGrab();
    this.ft.hold = -1;
    s.drifting = false;
    s.driftCharge = 0;
    s.driftTier = 0;
    s.boostPool = 0;
    s.wobble = 0;
    s.invuln = 150;
    s.crashed = false;
    s.crashCause = null;
    s.flow = 0;
    this.coolFlow(7);
    s.tumble = 0;
    s.fall = FALL_NONE;
    s.fallTick = -1;
    s.fallStart = -1;
    // A revive rides on with one get-up, as it always rode on with one wipeout to spare.
    s.getUps = 1;
    s.getUpZ = z;
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
    // (A fall that slides over the finish line plays to its end there: the rider gets up in the square.)
    if (s.tumble > 0) this.tumbleStep();
    else if (s.finished) this.coast();
    else if (s.grinding) this.grindStep(action, released);
    else if (s.grounded) this.groundStep(action, pressed, released);
    else this.airStep(action, pressed, released, steerTarget);

    const riding = !s.finished && s.tumble === 0;
    const race = !this.homeward;
    if (riding && !s.crashed && !s.grinding && race) this.collide(prevZ);
    if (riding && !s.crashed && race) this.pickups(prevZ);
    if (riding && !s.crashed) this.edge();
    // A line is crossed on the tick the sled crosses it, falling or not: a fallen sled slides, and a rider who
    // went down just short of a line was credited up to a second and a half late.
    if (!s.finished && !s.crashed) this.lines();
    if (riding && !s.crashed && race) this.getUpsBack();
    // A set piece plays on through a wipeout: the race's machine does not wait, nor does the fall.
    if (!s.crashed && !s.finished && race) this.momentStep(prevZ);
    if (!s.crashed && !s.finished && race && this.legend) this.legendStep();
    if (!s.crashed && !s.finished && this.tick >= MAX_RUN_TICKS - 1 && race) this.crash('daylight');
    if (!s.finished && race) this.chaos();
    if (!s.finished && race) this.draft(draftOf(input));

    const hold = !s.grounded || s.drifting || s.drafting || s.grinding || s.wallTicks > 0;
    const bankedNow = this.combo.tick(hold);
    if (bankedNow > 0) this.events.push({ type: 'comboBank', points: bankedNow, mult: this.combo.lastMult });

    if (!s.crashed && !s.finished && !this.homeward) this.crossGates(prevZ);
    this.flowStep();
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

  /** A charm gate crossed this tick: the lane the sled was in as it crossed the gate's line is its charm (a fall
   *  eases the rider to the safe line, so a faller takes the middle). The next gate's offers are dealt now. */
  private crossGates(prevZ: number): void {
    const s = this.s;
    const g = this.charmGates[this.gateNext];
    if (!g || prevZ >= g.z || s.z < g.z) return;
    this.gateNext++;
    const u = s.z > prevZ ? (g.z - prevZ) / (s.z - prevZ) : 1;
    const x = this.prevX + (s.x - this.prevX) * u;
    g.lane = laneOf(g.x, x);
    g.pick = g.offers[g.lane];
    if (g.pick >= 0) {
      this.charms.push(g.pick);
      this.charmMask |= 1 << g.pick;
      this.takeCharm(g.pick);
    }
    this.events.push({ type: 'charm', gate: g.index, lane: g.lane, id: g.pick });
    for (const p of synergiesOf(this.charmMask)) {
      if (this.synergyMask & (1 << p.id)) continue;
      this.synergyMask |= 1 << p.id;
      this.events.push({ type: 'synergy', id: p.id });
    }
    const next = this.charmGates[this.gateNext];
    if (next) next.offers = offersFor(this.config.chaos.seed, next.index, this.pool, this.charms);
  }

  /** What a charm changes the moment it is taken (most are read where they act, through `has`). */
  private takeCharm(id: number): void {
    if (id === CHARM.festival) this.combo.stepLinks = 2;
    else if (id === CHARM.memory) this.combo.repeatKeep = 0.5;
    else if (id === CHARM.path) this.pathNext = Math.ceil((this.s.z + 1) / PATH_STEP);
  }

  /** Charm state: the tick of the last perfect landing (Ember Step), a dash's cost owed back (Hearthstone), the
   *  stage each once-a-stage spare was spent in (Featherfall, Last Lamp, Guardian Wisp), the next path spark. */
  private lastPerfect = -1000;

  /** Read-only views of the charm state above, for drawing only (the play lane's charmsignals.ts): the tick of the
   *  last perfect landing (Ember Step's price is open for EMBER_STEP_TICKS after it), the lantern a Hearthstone owes
   *  back, and the stage each once-a-stage spare was spent in (-1 never: Featherfall, Last Lamp, Guardian Wisp). */
  get perfectTick(): number {
    return this.lastPerfect;
  }

  get hearthOwing(): number {
    return this.hearthOwed;
  }

  get featherSpentStage(): number {
    return this.featherStage;
  }

  get lampSpentStage(): number {
    return this.lampStage;
  }

  get wispSpentStage(): number {
    return this.wispStage;
  }

  private hearthOwed = 0;
  private featherStage = -1;
  private lampStage = -1;
  private wispStage = -1;
  private pathNext = 0;

  /** A drift's charge rate as the charms have it: Drift Drum +35%; Frost Runners 20% slower on snow; Black Ice
   *  double on ice. */
  private driftCharm(ice: boolean): number {
    return (this.has(CHARM.drum) ? 1.35 : 1) * (!ice && this.has(CHARM.frost) ? 0.8 : 1) * (ice && this.hasPair(6) ? 2 : 1);
  }

  /** A drift's release, by tier (Drift Drum: 3 m/s more at the third). */
  private driftBoost(): number {
    const s = this.s;
    return DRIFT_BOOST[s.driftTier] + (s.driftTier === 3 && this.has(CHARM.drum) ? 3 : 0);
  }

  /** A grab's clock as its tiers read it (Paper Kite: 30% sooner). */
  private grabClock(ticks: number): number {
    return this.has(CHARM.paper) ? Math.floor((ticks * 10) / 7) : ticks;
  }

  /** Featherfall: once a stage a landing that would floor the rider is only sketchy. True if it was spent now. */
  private featherSpare(): boolean {
    const stage = this.stageTicks.length;
    if (!this.has(CHARM.feather) || this.featherStage === stage || this.homeward) return false;
    this.featherStage = stage;
    return true;
  }

  /** A bump or a scrape and the combo: banked (as ever), lost under a Festival Drum, run on with Bark Skin on a
   *  glancing blow. */
  private bumpCombo(glancing: boolean): void {
    if (glancing && this.has(CHARM.bark)) return;
    if (this.has(CHARM.festival)) {
      const lost = this.combo.lose();
      if (lost > 0) this.events.push({ type: 'comboLost', points: lost });
      return;
    }
    const banked = this.combo.bank();
    if (banked > 0) this.events.push({ type: 'comboBank', points: banked, mult: this.combo.lastMult });
  }

  /** Lamplit Path's sparks: one on the safe line every PATH_STEP metres from where it was taken to the line, taken
   *  by riding over it (a spark, as a course's; ids from PATH_ID0). */
  private pathSparks(): void {
    const s = this.s;
    const c = this.course;
    while (this.pathNext * PATH_STEP <= s.z) {
      const z = this.pathNext * PATH_STEP;
      const k = this.pathNext++;
      if (z >= c.finishZ) {
        this.pathNext = -1;
        return;
      }
      const x = c.safeX(z);
      const y = c.ground(x, z) + 0.8;
      const dx = x - s.x;
      const dy = y - (s.y + 0.5);
      const reach = 1.55 * this.sled.magnet + 0.25;
      if (dx * dx + dy * dy < reach * reach) this.collectLight(PATH_ID0 + k, 1, x, y, z);
    }
  }

  /** Spirit Flow (round 8, G6): style heats it, a dull five seconds cools it a level every 1.5 s, a hit costs it.
   *  The whole level pays (charge and points) and the eased value is what the picture and the drag read. */
  private flowStep(): void {
    const s = this.s;
    if (!s.crashed && !s.finished && s.tumble === 0) {
      if (++this.dull >= FLOW_DULL && (this.dull - FLOW_DULL) % FLOW_COOL === 0 && this.heat > 0) this.heat = this.heat > 1 ? this.heat - 1 : 0;
      this.stats.flowTicks[s.flowLevel]++;
    }
    this.setFlow();
    s.flow = approach(s.flow, s.flowLevel, 1.5 * DT);
    if (s.flowLevel > this.stats.bestFlow && ++this.flowHeld >= TICK_RATE) this.stats.bestFlow = s.flowLevel;
  }

  /** The whole level from the heat, said when it changes. */
  private setFlow(): void {
    const s = this.s;
    if (this.heat > FLOW_HEAT_MAX) this.heat = FLOW_HEAT_MAX;
    const level = Math.min(6, Math.floor(this.heat));
    if (level === s.flowLevel) return;
    this.events.push({ type: 'flow', level, from: s.flowLevel });
    s.flowLevel = level;
    this.flowHeld = 0;
  }

  /** Style heats Spirit Flow (its base points / FLOW_HEAT_PER; twice that under Spirit Drum) and resets the dull
   *  clock. */
  private heatUp(base: number): void {
    this.heat += (base / FLOW_HEAT_PER) * (this.has(CHARM.spirit) ? 1.5 : 1);
    this.dull = 0;
    this.setFlow();
  }

  /** A hit cools it by whole levels (a fall: all of it). */
  private coolFlow(levels: number): void {
    this.heat = levels >= 7 ? 0 : Math.max(0, this.heat - levels);
    this.setFlow();
  }

  /** Points as Spirit Flow pays them: +10% a level. */
  private flowPoints(base: number): number {
    return Math.round(base * (1 + 0.1 * this.s.flowLevel));
  }

  /** A showdown won (LogEvent.Showdown, at the start of the tick after the game layer or the generator decided it):
   *  a whole cell and the points. */
  showdownWon(): void {
    if (this.s.crashed) return;
    this.events.length = 0;
    const before = this.s.lantern;
    this.lightRaw(SHOWDOWN_UNITS);
    this.stats.showdowns++;
    this.style('showdown', SHOWDOWN_POINTS);
    this.events.push({ type: 'rival', kind: 'showdown', gain: this.s.lantern - before });
  }

  /** A wisp stolen from a rival passed close (LogEvent.Steal): a third of a cell and the points. */
  stealWisp(): void {
    if (this.s.crashed) return;
    this.events.length = 0;
    const before = this.s.lantern;
    this.lightRaw(STEAL_UNITS);
    this.stats.steals++;
    this.style('steal', STEAL_POINTS);
    this.events.push({ type: 'rival', kind: 'steal', gain: this.s.lantern - before });
  }

  /** Light the lantern by exactly this much (no sled or flow scaling): what a rival gives is the same for all. */
  private lightRaw(units: number): void {
    const s = this.s;
    const before = this.cells;
    const got = Math.min(units, LANTERN_MAX - s.lantern);
    if (got <= 0) return;
    s.lantern += got;
    this.stats.lit += got;
    if (this.cells > before) this.events.push({ type: 'lantern', phase: 'lit', cells: this.cells });
  }

  /** `extra`: optional presentation fields spread into the event (never hashed, never scored). */
  /** A named air trick, paid: its own lantern charge, the repeat cut keyed by its id, its id in the event. */
  private trickStyle(id: number, points: number, units: number, call: { halfTurns: number; flips: number; tier: number; late: boolean }): void {
    const fresh = (this.stats.trickMask & (1 << id)) === 0;
    this.stats.trickMask |= 1 << id;
    // A trick new to the run pays half again (Crane's Memory: two and a half times): the 200th run should still be
    // finding things. (Crane's Memory 2.5x, from 3x: 66% of the expert's charm races.)
    let pts = points * (fresh ? (this.has(CHARM.memory) ? 2.5 : 1.5) : 1);
    const fam = TRICKS[id]?.family;
    if (this.has(CHARM.paper) && (fam === 'grab' || id === TRICK.paperWheel || id === TRICK.craneFold || id === TRICK.spiritKnot)) pts *= 1.5;
    if (this.has(CHARM.whirl) && call.halfTurns > 1 && (id === TRICK.spin || id === TRICK.paperWheel || id === TRICK.emberTwist || id === TRICK.spiritKnot)) pts *= 1 + 0.25 * (call.halfTurns - 1);
    if (this.hasPair(3) && id === TRICK.paperWheel) pts *= 1.5;
    if (this.has(CHARM.feather)) pts *= 0.75;
    this.heatUp(pts);
    const base = this.flowPoints(pts);
    this.charge(units, true);
    const kind: StyleKind = id === TRICK.spin ? 'spin' : id === TRICK.backflip ? 'flip' : 'trick';
    const r = this.combo.add(kind, base, `t${id}`);
    this.events.push({ type: 'style', kind, points: r.points, chain: r.chain, mult: r.mult, trick: id, halfTurns: call.halfTurns, flips: call.flips, tier: call.tier, late: call.late, fresh });
  }

  private style(kind: StyleKind, base: number, extra?: { gap: number; side: -1 | 1; x: number; z: number; obs: ObstacleKind; id: number }): void {
    this.charge(skillCharge(kind, base, extra ? extra.gap : -1), true);
    this.heatUp(base);
    const r = this.combo.add(kind, this.flowPoints(base));
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
    // (Round 9, the Old Run: on its track gravity acts along the sled's own path, as on runners, so a rider holding a
    // height on a wall keeps the channel's whole grade. The five's step below moves the sled by the slope's gradient,
    // which on a steep wall leaves it a fifth of the drive: notes/r9-ground.md section 3, A1.)
    const v0 = this.trackOn ? Math.sqrt(s.vx * s.vx + s.vz * s.vz) : 0;
    if (v0 > 0.5) {
      const sv = (vec.x * s.vx + vec.z * s.vz) / v0;
      const k = Math.max(0, v0 - ((g * sv) / (1 + sv * sv)) * DT) / v0;
      s.vx *= k;
      s.vz *= k;
    } else {
      const n2 = 1 + vec.x * vec.x + vec.z * vec.z;
      s.vx += ((-g * vec.x) / n2) * DT;
      s.vz += ((-g * vec.z) / n2) * DT;
    }
    s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
    if (s.speed > 0.01) s.velHeading = datan2(s.vx, s.vz);

    const prevHold = s.groundHold;
    if (action) s.groundHold++;
    else s.groundHold = 0;

    // Drift entry and exit.
    if (!s.drifting && action && Math.abs(s.steer) >= 0.5 && s.speed >= (this.has(CHARM.drum) ? 22 : 9) && s.wobble === 0 && s.groundHold > 2) {
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
    // (Long Stride: hardly a steer while the button is held.)
    if (action && !s.drifting && this.has(CHARM.stride)) turn *= 0.6;
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
    // (Round 9, the Old Run: the channel's own direction at the sled, not the look-ahead's, which leads a bend.)
    const phi = this.trackOn ? datan2(c.channelSlope(s.z), 1) : 0;
    if (this.trackOn) {
      // The walls turn the sled (below); this damps its swing across the channel, always, so a sled let go into a bend
      // settles at its height there rather than rocking up to the lip (notes/r9-ground.md section 3, A3).
      if (!s.drifting) s.heading += clamp(phi - s.heading, -1, 1) * TRACK_DAMP * DT;
    }
    // Let go and the sled runs out of its turn: the nose eases back to the corridor's direction, and
    // leans toward the middle once it is well off it. Never a pull while the player is steering.
    else if (!s.drifting) {
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
    // (Round 9, the Old Run: the bank turns a carving sled, as a banked track's wall does: notes/r9-ground.md, A2.)
    if (this.trackOn) s.heading -= wallYaw(vec, phi, s.speed, g) * DT;
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
    if (surf.ice && this.has(CHARM.frost)) grip *= 2.2;
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
      if (absSlip > 0.18) s.driftCharge += DT * (0.55 + absSlip) * this.sled.driftCharge * this.mood.driftCharge * this.driftCharm(surf.ice);
      const tier = s.driftCharge >= 2.4 ? 3 : s.driftCharge >= 1.35 ? 2 : s.driftCharge >= 0.6 ? 1 : 0;
      if (tier > s.driftTier) {
        s.driftTier = tier;
        this.events.push({ type: 'drift', phase: 'tier', tier });
      }
    }

    // Drag and boosts.
    // (Round 8: 3.5% a level, from 5.5%: Spirit Flow pays in the lantern and the score, and its speed made every style
    // charm a speed charm in the charm races.)
    const flowDrag = 1 / (1 + 0.035 * s.flow);
    let cd = CD * this.sled.drag * this.mood.drag * surf.drag * flowDrag;
    if (surf.ice && this.has(CHARM.frost)) cd *= 0.8;
    // The tuck: the crouch on a straight line is worth about 3 m/s at cruise.
    if (action && Math.abs(s.steer) < 0.3 && !s.drifting) cd *= this.has(CHARM.stride) ? 0.72 : 0.82;
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
    // (Round 9, the Old Run: on a tilted wall a turn moves the follow height by the slope times the sideways change, which
    // is not the ground falling away; what launches there is the ground below the plane the sled is on: A4.)
    const launch = this.trackOn ? ny < s.y + (vec.x * s.vx + vec.z * s.vz) * DT - g * stick * DT * DT * 1.5 : vyFollow < s.vy - g * stick * DT * 1.5;
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
        const boost = this.driftBoost();
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
      const boost = this.driftBoost();
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

  /** What the present flight holds (tricks.ts), read at touchdown and cleared at takeoff. `hold`: what the press
   *  now held is, -1 none (the button up, or held over from the snow), 0 a fresh press not yet decided, 1 a flip,
   *  2 a grab, 3 the sled's own move, 4 a rail's or a wall's move, 5 spent (a stomp's press, a grab let go for the
   *  rider). `last*`: the press before it, for a double tap. `letGo`: the tick a grab was let go, and whether the
   *  rider did it by itself. `fromRail`: off a rail's end; `fromWall`: off a wall ride, the wall's side. */
  private readonly ft = {
    hold: -1,
    holdLen: 0,
    lastRelease: -1000,
    lastLen: 0,
    lastHold: -1,
    grabMax: 0,
    tweakTicks: 0,
    tweakLate: false,
    special: 0,
    specialTicks: 0,
    specialDir: 0,
    sig: 0,
    sigTicks: 0,
    sigDir: 1,
    sigLetGo: -1000,
    letGo: -1000,
    auto: false,
    fromRail: false,
    fromWall: 0,
  };
  /** What the press now held in the air is (the ft.hold codes above) and its ticks: the bot's model reads them. */
  get airHoldKind(): number {
    return this.ft.hold;
  }

  get airHoldLen(): number {
    return this.ft.holdLen;
  }

  /** Set by a grind's end for the takeoff it makes. */
  private railOff = false;

  private clearGrab(): void {
    const s = this.s;
    s.grab = 0;
    s.grabTicks = 0;
    s.grabTier = 0;
    s.tweak = 0;
    s.move = 0;
  }

  private takeoff(kind: TakeoffKind): void {
    const s = this.s;
    const ft = this.ft;
    ft.hold = -1;
    ft.holdLen = 0;
    ft.lastRelease = -1000;
    ft.lastHold = -1;
    ft.grabMax = 0;
    ft.tweakTicks = 0;
    ft.tweakLate = false;
    ft.special = 0;
    ft.specialTicks = 0;
    ft.sig = 0;
    ft.sigTicks = 0;
    ft.sigLetGo = -1000;
    ft.letGo = -1000;
    ft.auto = false;
    ft.fromRail = this.railOff;
    this.railOff = false;
    ft.fromWall = s.wallTicks >= WALL_RIDE_TICKS ? (s.x > this.course.centerX(s.z) ? 1 : -1) : 0;
    this.clearGrab();
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

  /** The button and the steer in the air, read as tricks (tricks.ts): a fresh press decides in its first
   *  LATCH_TICKS, to a side a grab and centred a flip; two quick taps are the sled's own move; a press just off
   *  a rail or a wall ride is its move. Nothing starts in the last FLIP_GUARD_TICKS: a press there is a stomp. */
  private airTricks(action: boolean, pressed: boolean, released: boolean, steerTarget: number): void {
    const s = this.s;
    const ft = this.ft;
    const side = steerTarget >= GRAB_STEER ? 1 : steerTarget <= -GRAB_STEER ? -1 : 0;
    if (released && ft.hold >= 0) {
      if (ft.hold === 2) this.letGo(false);
      else if (ft.hold === 3) {
        s.move = 0;
        ft.sigLetGo = this.tick;
      }
      ft.lastRelease = this.tick;
      ft.lastLen = ft.holdLen;
      ft.lastHold = ft.hold;
      ft.hold = -1;
      ft.holdLen = 0;
    }
    if (pressed) {
      ft.holdLen = 0;
      ft.hold = 0;
      if (this.landingWithin(FLIP_GUARD_TICKS)) ft.hold = 5;
      else if (ft.special === 0 && (ft.fromRail || ft.fromWall !== 0) && s.airTicks <= SPECIAL_WINDOW) {
        ft.hold = 4;
        ft.special = ft.fromRail ? TRICK.lamppost : TRICK.snowHare;
        ft.specialTicks = SPECIAL_TICKS;
        ft.specialDir = side !== 0 ? side : s.spinRate < 0 ? -1 : 1;
        s.move = ft.special;
        if (ft.special === TRICK.snowHare) {
          // A bound off the wall, back into the run.
          s.vx -= ft.fromWall * 3;
          s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
          s.velHeading = datan2(s.vx, s.vz);
        }
        this.events.push({ type: 'grab', phase: 'move', side: ft.specialDir, tier: 0, trick: ft.special });
      } else if (ft.lastHold === 0 && ft.lastLen <= TAP_TICKS && this.tick - ft.lastRelease <= DOUBLE_GAP && side === 0) {
        ft.hold = 3;
        ft.sig = SIGNATURE[this.sled.id] ?? TRICK.pineBow;
        // (A Spinning Top or a Teacup turns the way the sled was turning, or the way it was last steered.)
        ft.sigDir = s.spinRate < -0.5 ? -1 : s.spinRate > 0.5 ? 1 : s.steer < -0.1 ? -1 : 1;
        s.move = ft.sig;
        this.events.push({ type: 'grab', phase: 'move', side: 0, tier: 0, trick: ft.sig });
      }
    }
    if (action && ft.hold >= 0) {
      ft.holdLen++;
      if (ft.hold === 0) {
        if (side !== 0 && ft.holdLen <= GRAB_LATCH && !this.landingWithin(FLIP_GUARD_TICKS)) {
          ft.hold = 2;
          s.grab = side;
          s.grabTicks = 0;
          s.grabTier = 0;
          this.events.push({ type: 'grab', phase: 'start', side, tier: 0, trick: TRICK.railGrab });
        } else if (ft.holdLen >= LATCH_TICKS) ft.hold = 1;
      }
      if (ft.hold === 2 && s.grab !== 0) {
        s.grabTicks++;
        if (s.grabTicks > ft.grabMax) ft.grabMax = s.grabTicks;
        const tier = grabTier(this.grabClock(s.grabTicks));
        if (tier > s.grabTier) {
          s.grabTier = tier;
          s.move = tier === 3 ? TRICK.spiritStretch : tier === 2 ? TRICK.lanternReach : TRICK.railGrab;
          this.events.push({ type: 'grab', phase: 'tier', side: s.grab, tier, trick: s.move });
        }
        // Steer against the grab and the sled is shoved out the other way: a tweak, worth most late.
        if (side === -s.grab && s.grabTier >= 1) {
          if (s.tweak === 0) this.events.push({ type: 'grab', phase: 'tweak', side: s.grab, tier: s.grabTier, trick: TRICK.crosswind });
          s.tweak++;
          ft.tweakTicks++;
          if (!ft.tweakLate && this.landingWithin(TWEAK_LATE)) ft.tweakLate = true;
        } else s.tweak = 0;
      } else if (ft.hold === 3) ft.sigTicks++;
    }
    if (ft.specialTicks > 0 && --ft.specialTicks === 0) {
      if (s.move === ft.special) s.move = 0;
      if (ft.special === TRICK.lamppost) s.spinRate = 0;
    }
  }

  /** A grab let go: by the player (a stomp, if close enough to touchdown), or by the rider as it sets. */
  private letGo(auto: boolean): void {
    const s = this.s;
    if (s.grab === 0) return;
    this.events.push({ type: 'grab', phase: auto ? 'auto' : 'release', side: s.grab, tier: s.grabTier, trick: s.move });
    this.ft.letGo = this.tick;
    this.ft.auto = auto;
    if (auto) this.ft.hold = 5;
    this.clearGrab();
  }

  private airStep(action: boolean, pressed: boolean, released: boolean, steerTarget: number): void {
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
    this.airTricks(action, pressed, released, steerTarget);
    s.vy -= this.gravity * DT;

    // Air control: a gentle lateral nudge.
    // (Will-o'-Wisp: both hands off, no air control while it is held.)
    const lat = this.ft.hold === 3 && this.ft.sig === TRICK.willowisp ? 0 : s.steer * 3.0 * DT;
    s.vx += lat * dcos(s.velHeading);
    s.vz -= lat * dsin(s.velHeading);
    s.vx *= 1 - 0.015 * DT;
    s.vz *= 1 - 0.015 * DT;
    s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
    if (s.speed > 0.01) s.velHeading = datan2(s.vx, s.vz);

    // Spins from steering (with a dead zone), flips from holding the action.
    const spinMax = 9 * this.sled.spin * this.mood.spin * (this.has(CHARM.whirl) ? 1.1 : 1) * (this.has(CHARM.paper) ? 0.85 : 1);
    // The landing set (round 7 made it hold): a key held through a flight spins at full rate, and the old set
    // could not stop that in time, so a first-timer who only steered in the air came down sideways one flight
    // in four. Now the spin is stopped hard and the swing has time left: a spin alone lands sketchy at worst.
    const setting = s.airTicks > 8 && this.landingWithin(LAND_SET_TICKS);
    // While grabbing, only steering with the grab's side spins (a little slower); against it is a tweak.
    const ft = this.ft;
    const sig = ft.hold === 3 ? ft.sig : 0;
    const spinIn = sig === TRICK.willowisp ? 0 : s.grab !== 0 ? (s.steer * s.grab > 0.3 ? s.steer : 0) : s.steer;
    const spinMul = s.grab !== 0 ? 0.8 : 1;
    if (sig === TRICK.spinningTop) {
      // The saucer spins under a still rider while it is held, and nothing stops it but letting go.
      s.spinRate = approach(s.spinRate, ft.sigDir * spinMax, 34 * DT);
    } else if (setting) {
      s.spinRate = approach(s.spinRate, 0, LAND_SET_SPIN * DT);
      s.airYaw = approach(s.airYaw, PI * Math.round(s.airYaw / PI), 4 * DT);
    } else if (ft.special === TRICK.lamppost && ft.specialTicks > 0) {
      // Swung round the rail's end: a half turn in the move's length.
      s.spinRate = (ft.specialDir * PI) / (SPECIAL_TICKS * DT);
    } else if (sig === TRICK.teacup) {
      s.spinRate = approach(s.spinRate, ft.sigDir * spinMax * 0.5, 34 * DT);
    } else if (Math.abs(spinIn) > 0.3) {
      s.spinRate = approach(s.spinRate, spinIn * spinMax * spinMul, 34 * DT);
    } else {
      s.spinRate = approach(s.spinRate, 0, 22 * DT);
      const nearest = PI * Math.round(s.airYaw / PI);
      s.airYaw = approach(s.airYaw, nearest, 2.6 * DT);
    }
    s.airYaw += s.spinRate * DT;
    // A flip never starts in the last FLIP_GUARD_TICKS before touchdown: a stomp held a little too
    // long used to tip the rider into the snow. One already under way carries on.
    const flipping = action && s.airHold >= 7 && ft.hold === 1;
    const whole = TAU * Math.round(s.airPitch / TAU);
    // (A flip turns toward lower pitch, so past its half the nearest whole turn lies ahead of it.)
    const finishing = flipping && s.pitchRate < -1 && whole < s.airPitch;
    if (setting && !finishing) {
      // The rider sets for the landing in pitch as well (round 7): out of the flip to the nearest whole turn,
      // button held or not. A flip past its half still carries on at its own rate, so a late one that would
      // have come round still does; one short of its half is unwound, where it used to land on its head.
      s.pitchRate = approach(s.pitchRate, 0, 60 * DT);
      s.airPitch = approach(s.airPitch, whole, LAND_SET_PITCH * DT);
    } else if (flipping && (s.pitchRate < -1 || !this.landingWithin(FLIP_GUARD_TICKS))) {
      s.pitchRate = approach(s.pitchRate, -6.8 * this.sled.flip * this.mood.spin * (this.has(CHARM.whirl) ? 0.75 : 1), 20 * DT);
    } else {
      s.pitchRate = approach(s.pitchRate, 0, 26 * DT);
      // Let go of a flip and the rider comes out of it (twice as fast as before round 7: a hold begun in the
      // air by a thumb that meant to crouch was a wreck most times it happened).
      if (Math.abs(s.pitchRate) < 1.5) s.airPitch = approach(s.airPitch, whole, FLIP_RIGHT * DT);
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

    // Still holding at touchdown: a grab (or the sled's own move) held deep, tier 2 and on, is a fall on a
    // committed flight and sketchy on a short one. A short grab the rider lets go of as it lands: clean at best,
    // never a stomp. (A first-timer's thumb on the button through a landing is a short grab almost always.)
    const ft = this.ft;
    const holding = s.grab !== 0 || ft.hold === 3;
    // (The sled's own move, held: each sled has its own say in what that costs: tricks.ts sigFallTier.)
    const sigHeld = ft.hold === 3 ? sigTier(ft.sig, ft.sigTicks) : 0;
    const deep = holding && (s.grabTier >= 2 || (ft.hold === 3 && sigHeld >= sigFallTier(ft.sig)));
    const soft = ft.hold === 3 && ft.sig === TRICK.fireside && sigHeld >= 1;
    const flight = { halfTurns, flips, grabTicks: this.grabClock(ft.grabMax), tweakTicks: ft.tweakTicks, tweakLate: ft.tweakLate, special: ft.special, sigTicks: ft.sigTicks, sig: ft.sig };
    const window = Math.max(LET_GO_TICKS, this.stompTicks);
    const letGo =
      (ft.letGo >= 0 && !ft.auto && this.tick - ft.letGo <= window && grabTier(this.grabClock(ft.grabMax)) >= 1) ||
      (ft.sig !== TRICK.pineBow && this.tick - ft.sigLetGo <= window && sigTier(ft.sig, ft.sigTicks) >= 1);
    this.clearGrab();
    ft.hold = -1;

    if (airtime < 0.3 && halfTurns === 0 && flips === 0) {
      s.airYaw = 0;
      s.airPitch = 0;
      this.events.push({ type: 'land', quality: 'hop', airtime, halfTurns, flips, impact, late: false });
      return;
    }

    // A short flight never wrecks: nobody meant that. Commit to a real one and land it wrong, and you go.
    const committed = airtime >= 0.75;
    if (committed && (pitchErr > 1.35 + tol || yawErr > 1.2 + tol || deep) && !this.featherSpare()) {
      s.airYaw = 0;
      s.airPitch = 0;
      // The landing is always said, whatever becomes of it: under a ward or the grace after a get-up it used to
      // pass without a word, and a set piece decided by its landing (the surge, the flourish) waited for one
      // that never came and ran on to its end as lost. (A rider reads it too: a bot was left thinking it flew.)
      this.events.push({ type: 'land', quality: 'sketchy', airtime, halfTurns, flips, impact, late: false, botched: true });
      this.wipeout('landing');
      return;
    }

    const sketchy = pitchErr > 0.72 + tol || yawErr > 0.62 + tol || deep || soft;
    // A stomp: a press in the last 9 ticks, or a grab let go there.
    const stomp = (this.tick - s.lastPressTick <= this.stompTicks || letGo) && airtime >= 0.4 && !holding;
    const scale = sketchy ? 0.5 : 1;
    let trickPts = 0;

    if (airtime >= 0.5) this.style('air', Math.round(60 * airtime));
    for (const t of nameFlight(flight)) {
      const pts = t.points * scale;
      trickPts += pts;
      this.trickStyle(t.id, pts, t.units, t);
    }
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
      s.speed *= committed ? (this.has(CHARM.star) ? 0.7 : 0.8) : 0.97;
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
      s.lateStompTicks = airtime >= 0.4 ? (this.stompTicks > 9 ? FIRST_RUN_LATE : 5) : 0;
      this.lateTricks = { halfTurns, flips, trickPts, cleanPts, cleanBoost };
    }
    if (quality !== 'perfect' && impact > 12) s.speed *= 0.93;
    // Touching down on a falling slope turns the drop into speed: a cliff landed well pays.
    if (quality !== 'sketchy' && s.speed > 1) {
      const m = vyFollow / s.speed;
      const along = (s.speed + vyAtTouch * m) / (1 + m * m);
      const star = this.has(CHARM.star);
      // (Falling Star: 2.2x and to 11 m/s, from 3x and 14: it won 69% of the mid pilot's charm races.)
      if (along > s.speed) s.speed += Math.min(star ? 11 : 8, (along - s.speed) * (star ? 2.2 : 1.5));
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
    this.events.push({ type: 'boost', amount: boost, source: 'perfect' });
    this.lastPerfect = this.tick;
    // Hearthstone: the dash's lantern back, once a dash. Comet Chain: two thirds of a second more of a dash under way.
    if (this.hearthOwed > 0) {
      // (A quarter of it: round 8's charm races had the whole lantern back winning 70% of them, a third 66%.)
      this.lightRaw(this.hearthOwed / 4);
      this.hearthOwed = 0;
    }
    // (Two thirds of a second, from one: 64% of the pair races.)
    if (s.dash > 0 && this.hasPair(1)) s.dash += 40;
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
    if (s.dash > 0) this.overcap = DASH_CAP + (this.has(CHARM.comet) ? 2 : 0);
    // The allowance only ever falls once the dash is over: with the ease, or with the speed, if that drops first.
    else if (this.overcap > 0) this.overcap = Math.max(0, Math.min(this.overcap - OVERCAP_EASE * DT, s.speed - MAX_SPEED));
    const cap = MAX_SPEED - (this.has(CHARM.bark) ? 1 : 0) + this.overcap;
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
    // Spirit Flow pays: +8% a level, on what skill and lights both give. (Guardian Wisp: lights 25% slower.)
    let add = units * (skill ? this.sled.skillGain : this.sled.lightGain) * (1 + 0.08 * s.flowLevel);
    if (!skill && this.has(CHARM.wisp)) add *= 0.75;
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
    // What it costs: a lantern; a lantern and a half on a Stone Lantern; half of one straight after a perfect landing
    // on an Ember Step.
    const cost = this.has(CHARM.stone) ? LANTERN * 1.5 : this.has(CHARM.step) && this.tick - this.lastPerfect <= EMBER_STEP_TICKS ? LANTERN * 0.7 : LANTERN;
    if (s.crashed || s.dash > 0 || s.lantern < cost) return;
    s.lantern -= cost;
    // (Hearthstone: the next perfect landing gives it back.)
    this.hearthOwed = this.has(CHARM.hearth) ? cost : 0;
    s.dash = Math.round(DASH_TICKS * this.sled.dashLen * (this.has(CHARM.comet) ? 1.3 : 1));
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

  /** A hard hit: a fall (round 7). The rider goes down, slides to a stop on the safe line, lies there, gets up
   *  and rides on, for every rider, so a ghost's record carries its own falls. It costs the combo, the speed
   *  and about four seconds, and a get-up: three are carried, one comes back for every GET_UP_BACK_M ridden
   *  clean and all of them at a stage line, and every fall in the first stretch is free. A fall with none left
   *  is the wreck that ends the run, as the third wipeout used to. */
  private wipeout(cause: TumbleCause): void {
    const s = this.s;
    if (s.tumble > 0 || s.crashed) return;
    // (Whatever was held in the air goes with the hit; the flight is never named.)
    this.clearGrab();
    this.ft.hold = -1;
    if (this.homeward || s.invuln > 0) {
      // Riding home nothing can go wrong: a landing that would have floored a racer just lands. The same for a
      // rider who has only just got up (or been warded): the first lip after a fall is never a second fall.
      s.heading = s.velHeading;
      s.airYaw = 0;
      s.airPitch = 0;
      s.spinRate = 0;
      s.pitchRate = 0;
      return;
    }
    const stage = this.stageTicks.length;
    const free = s.z < FREE_TUMBLE_Z;
    // A full lantern takes the hit: the rider rides on, slower, the combo banked rather than lost. (Never on a Comet's
    // Tail; half a lantern on a Stone Lantern; free once a stage with a Guardian Wisp, and once a stage with a Last
    // Lamp for a rider with no get-up left.)
    const wardCost = this.has(CHARM.stone) ? LANTERN / 2 : LANTERN;
    let cost = -1;
    if (this.has(CHARM.wisp) && this.wispStage !== stage) {
      this.wispStage = stage;
      cost = 0;
    } else if (!this.has(CHARM.comet) && s.lantern >= wardCost) cost = wardCost;
    else if (this.has(CHARM.lamp) && !free && s.getUps <= 0 && this.lampStage !== stage) {
      this.lampStage = stage;
      cost = 0;
    }
    if (cost >= 0) {
      s.lantern -= cost;
      this.stats.wards++;
      this.coolFlow(2);
      s.speed *= this.has(CHARM.stone) ? 0.95 : WARD_KEEP * this.sled.wardKeep;
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
      // (Shrine Keeper: a ward lights a third of a cell back.)
      if (this.hasPair(5)) this.lightRaw(LANTERN / 3);
      return;
    }
    if (!free && s.getUps <= 0) {
      this.crash(cause);
      return;
    }
    // Second Wind: no get-up spent, but the lantern goes out. Quick Feet: the part-lit cell goes.
    if (!free && !this.has(CHARM.second)) s.getUps--;
    if (this.has(CHARM.second)) s.lantern = 0;
    else if (this.has(CHARM.quick)) s.lantern = LANTERN * Math.floor(s.lantern / LANTERN);
    s.falls++;
    s.tumble = TUMBLE_TICKS;
    s.fall = FALL_FALLING;
    s.fallTick = this.tick;
    s.fallStart = this.tick;
    this.tumbleCause = cause;
    this.fallOff = s.x - this.course.safeX(s.z);
    // Only the speed the sled had down the run goes into the slide and the get-up: a sled crossing the slope
    // at 15 m/s was making 5 m/s of ground, and a fall must not turn the rest into distance.
    this.fallSpeed = s.vz > 0 ? (s.vz < s.speed ? s.vz : s.speed) : 0;
    s.speed = this.fallSpeed;
    s.drifting = false;
    s.driftCharge = 0;
    s.driftTier = 0;
    s.boostPool = 0;
    s.carveTicks = 0;
    s.wallTicks = 0;
    this.coolFlow(7);
    s.draftTicks = 0;
    s.draftCharge = 0;
    s.airYaw = 0;
    s.airPitch = 0;
    s.spinRate = 0;
    s.pitchRate = 0;
    this.endGrind();
    const lost = this.combo.lose();
    if (lost > 0) this.events.push({ type: 'comboLost', points: lost });
    this.events.push({ type: 'tumble', phase: 'start', cause, left: s.getUps });
  }

  private tumbleCause: TumbleCause = 'landing';
  /** How far off the safe line the fall began, and how fast. */
  private fallOff = 0;
  private fallSpeed = 0;

  /** The speed a rider gets up at: a share of cruise, and above the least of it never more than the speed
   *  the fall began at. */
  private getUpSpeed(): number {
    const push = (this.has(CHARM.quick) ? 0.65 : GET_UP_SPEED) * this.cruiseSpeed();
    const had = this.fallSpeed > GET_UP_MIN ? this.fallSpeed : GET_UP_MIN;
    return had < push ? had : push;
  }

  /** A fall, tick by tick. Falling: the rider slides on down the run, the speed bleeding away, eased across
   *  to the safe line (where nothing stands, by the course's own promise) so it comes to rest there. Down: at
   *  rest. Up: the sled is stood up and pushed off along the line, from nothing to the get-up speed. The
   *  rider is never set forward: every metre of a fall is ridden slower than the speed it began at. */
  private tumbleStep(): void {
    const s = this.s;
    const c = this.course;
    s.tumble--;
    const into = TUMBLE_TICKS - s.tumble;
    if (into <= FALL_TICKS) {
      const u = into / FALL_TICKS;
      s.speed *= FALL_BLEED;
      s.z += s.speed * DT;
      const e = u * u * (3 - 2 * u);
      s.x = c.safeX(s.z) + this.fallOff * (1 - e);
      if (into === FALL_TICKS) {
        s.fall = FALL_DOWN;
        s.fallTick = this.tick;
        this.events.push({ type: 'fall', phase: 'down' });
        // (Quick Feet: no lying in the snow, straight up.)
        if (this.has(CHARM.quick)) {
          s.tumble -= DOWN_TICKS;
          s.fall = FALL_UP;
          this.events.push({ type: 'fall', phase: 'up' });
        }
      }
    } else if (into <= FALL_TICKS + DOWN_TICKS) {
      s.speed = 0;
      if (into === FALL_TICKS + DOWN_TICKS) {
        s.fall = FALL_UP;
        s.fallTick = this.tick;
        this.events.push({ type: 'fall', phase: 'up' });
      }
    } else {
      const u = (into - FALL_TICKS - DOWN_TICKS) / UP_TICKS;
      s.speed = this.getUpSpeed() * u * u;
      s.z += s.speed * DT;
      s.x = c.safeX(s.z);
    }
    s.vx = 0;
    s.vz = s.speed;
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
    s.fall = FALL_NONE;
    s.fallTick = -1;
    s.fallStart = -1;
    s.x = c.safeX(s.z);
    s.y = c.ground(s.x, s.z);
    s.speed = this.getUpSpeed();
    s.heading = line;
    s.velHeading = line;
    s.vx = s.speed * dsin(line);
    s.vz = s.speed * dcos(line);
    c.gradient(s.x, s.z, vec);
    s.vy = vec.x * s.vx + vec.z * s.vz;
    s.grounded = true;
    // (On the safe line nothing stands within a metre, so the rider needs no moment as a spirit to get clear.)
    s.invuln = GET_UP_INVULN;
    s.wobble = 0;
    s.steer = 0;
    this.prevAction = s.action;
    s.groundHold = 0;
    s.pressStartedGrounded = false;
    this.coyote = 0;
    this.airPressed = false;
    this.nearMiss.clear();
    this.events.push({ type: 'tumble', phase: 'end', cause: this.tumbleCause, left: s.getUps });
    // (Phoenix: up from a fall into a short dash, no lantern spent.)
    if (this.hasPair(2) && !this.homeward) {
      s.dash = DASH_TICKS / 2;
      s.boostPool += DASH_BOOST / 2;
      this.events.push({ type: 'dash', phase: 'start', cells: this.cells });
    }
  }

  /** Get-ups come back with the riding: one for every GET_UP_BACK_M since the first of them was spent. */
  private getUpsBack(): void {
    const s = this.s;
    if (s.getUps >= GET_UPS) {
      s.getUpZ = s.z;
      return;
    }
    if (s.z - s.getUpZ < GET_UP_BACK_M) return;
    s.getUps++;
    s.getUpZ = s.z;
    this.events.push({ type: 'getUp', left: s.getUps, why: 'ridden' });
  }

  /** Something solid at the corridor's edge turns a sled back: it costs speed and the combo, never the run. */
  private edge(): void {
    if (this.trackOn) {
      this.trackEdge();
      return;
    }
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
      this.coolFlow(this.has(CHARM.spirit) ? 2 : 1);
      this.bumpCombo(false);
      this.events.push({ type: 'scrape', side, speed: sp });
    }
  }

  /** Round 9, the Old Run: the parapet turns a sled back as the five's edge does (the same scrape, never a fall),
   *  measured square to the channel, which runs at up to 35 degrees off the fall line: the excess across it, and the
   *  velocity's part along its outward normal (the five's reflection would read a sled running beside a slanted wall as
   *  heading into it). A sled on the ground is set back on the wall it was turned back onto: notes/r9-ground.md, B. */
  private trackEdge(): void {
    const s = this.s;
    const c = this.course;
    const p = c.channelSlope(s.z);
    const q = Math.sqrt(1 + p * p);
    const limit = c.edgeLimit(s.z);
    const e = c.edgeExcess(s.x, s.z) / q;
    if (e <= limit) return;
    const side: -1 | 1 = s.x > c.centerX(s.z) ? 1 : -1;
    s.x -= side * (e - limit + 0.02) * q;
    const nx = side / q;
    const nz = (-side * p) / q;
    const out = s.vx * nx + s.vz * nz;
    if (out > 0) {
      s.vx -= nx * out * 1.5;
      s.vz -= nz * out * 1.5;
    }
    const sp = Math.sqrt(s.vx * s.vx + s.vz * s.vz) * (out > 3 ? 0.93 : 0.985);
    s.velHeading = datan2(s.vx, s.vz);
    s.heading = s.velHeading;
    s.speed = sp;
    s.vx = sp * dsin(s.velHeading);
    s.vz = sp * dcos(s.velHeading);
    if (s.grounded) {
      s.y = c.ground(s.x, s.z);
      c.gradient(s.x, s.z, vec);
      s.vy = vec.x * s.vx + vec.z * s.vz;
    }
    if (out > 3) {
      s.wobble = 14;
      this.coolFlow(this.has(CHARM.spirit) ? 2 : 1);
      this.bumpCombo(false);
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
    if (i < st.length - 1) {
      // A stage line gives every get-up back: each stage is ridden with all three.
      if (s.getUps < GET_UPS) {
        s.getUps = GET_UPS;
        this.events.push({ type: 'getUp', left: s.getUps, why: 'stage' });
      }
      s.getUpZ = s.z;
      return;
    }
    // A set piece that runs to the line (the carry) is decided on it.
    if (this.mo.active >= 0 && !this.homeward) {
      const p = this.plays[this.mo.active];
      // (Burning as it arrives: a flame still guttering at the line lights nothing.)
      this.momentEnd(p, p.verb === 'carry' && this.mo.pace > 0 && this.mo.at === 0);
    }
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
      mo.mask = 0;
      mo.aux = 0;
      mo.pace = p.verb === 'collapse' ? fallPace(p, s.speed) : p.verb === 'carry' ? p.flame0 : p.verb === 'follow' || p.verb === 'surge' ? 0 : p.pace;
      mo.of = momentCount(p);
      if (p.verb === 'carry') mo.n = Math.ceil(10 * p.flame0);
      this.events.push({ type: 'moment', index: p.index, phase: 'start', n: mo.n, of: mo.of });
    }
    const p = this.plays[mo.active];
    const ticks = this.tick - mo.t0;
    const say = (phase: 'step' | 'miss' | 'lead' | 'trail' | 'close', n: number): void => {
      this.events.push({ type: 'moment', index: p.index, phase, n, of: mo.of });
    };
    switch (p.verb) {
      case 'race': {
        if (p.style === 'chase') {
          // The machine left before the rider: pass every car before one reaches the far station.
          let home = false;
          for (let c = 0; c < p.cars.length; c++) {
            if (mo.mask & (1 << c)) continue;
            const cz = machineZ(p, ticks, c);
            if (cz >= p.z1) home = true;
            else if (s.z > cz) {
              mo.mask |= 1 << c;
              mo.n++;
              say('step', mo.n);
            }
          }
          if (mo.n >= p.cars.length) this.momentEnd(p, true);
          else if (home || s.z >= p.z1) this.momentEnd(p, false);
          break;
        }
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
        if (p.from === 1) {
          // The span falls from its far end toward the rider: past the keystone first, and the rest holds.
          const gap = fallZ(p, ticks, mo.pace) - s.z;
          if (!mo.close && gap < 4 * COLLAPSE_CLOSE) {
            mo.close = true;
            say('close', 0);
          }
          if (s.z >= p.keystone) this.momentEnd(p, true);
          else if (gap < 0.6) {
            s.speed *= COLLAPSE_KEEP;
            s.vx = s.speed * dsin(s.velHeading);
            s.vz = s.speed * dcos(s.velHeading);
            s.wobble = 18;
            this.momentEnd(p, false);
          }
          break;
        }
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
          // (A gate that swings is where its sway has it on this tick.)
          const gx = gateX(g, ticks);
          if (x >= gx - g.hw && x <= gx + g.hw) {
            mo.n++;
            this.charge(GATE_UNITS, true);
            const r = this.combo.add('lanternGate', 150);
            this.events.push({ type: 'style', kind: 'lanternGate', points: r.points, chain: r.chain, mult: r.mult });
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
        // Stomp the landings (round 7). Round 6 asked for every step landed clean, which the careful line won
        // by doing nothing and a fast rider lost by flying two steps at once. Now a stomp is what counts,
        // three of them (in a row, in that variant: a clean landing between starts the count again), a step
        // flown over costs only its chance, and a sketchy landing ends it. Down a street ('hops') there are
        // no steps: the landings are the ones the rider's own pops make.
        for (const e of this.events) {
          if (e.type !== 'land') continue;
          if (e.late) {
            // A press just after a clean landing made it a stomp: it counts, and gives a row back.
            if (e.quality === 'perfect') {
              mo.n = (p.row ? mo.aux : mo.n) + 1;
              say('step', mo.n);
            }
            continue;
          }
          if (e.airtime < 0.2 || e.quality === 'hop') continue;
          if (e.quality === 'perfect') {
            mo.n++;
            say('step', mo.n);
          } else if (e.quality === 'clean') {
            if (p.row) {
              mo.aux = mo.n;
              if (mo.n > 0) say('miss', 0);
              mo.n = 0;
            }
          } else if (mo.ok) {
            mo.ok = false;
            say('miss', mo.n);
          }
          // (pushed while iterating: a 'moment' event is never a landing, so the loop passes over it.)
        }
        if (!mo.ok || mo.n >= mo.of || s.z >= p.z1) this.momentEnd(p, mo.ok && mo.n >= mo.of && mo.of > 0);
        break;
      }
      case 'slide': {
        // One drift held on the glass: mo.n counts its ticks, and it is over the tick the runners bite.
        const surf = this.course.surface(s.x, s.z);
        if (s.grounded && s.drifting && surf.ice && surf.drag < 0.5) {
          mo.n++;
          mo.aux = s.driftDir;
          if (p.both) {
            const bit = s.driftDir > 0 ? 1 : 2;
            if (mo.n === p.each && !(mo.mask & bit)) {
              mo.mask |= bit;
              mo.at++;
              say('step', mo.at);
            }
          } else {
            const q = Math.floor((4 * mo.n) / p.need);
            if (q > mo.at && q < 4) {
              mo.at = q;
              say('step', q);
            }
          }
        } else if (mo.n > 0) {
          if (mo.n >= 18 && !(p.both && mo.n >= p.each)) say('miss', p.both ? mo.at : 0);
          mo.n = 0;
          if (!p.both) mo.at = 0;
        }
        const won = p.both ? mo.mask === 3 : mo.n >= p.need;
        if (won || s.z >= p.z1) {
          mo.n = won ? mo.of : mo.at;
          this.momentEnd(p, won);
        }
        break;
      }
      case 'shatter': {
        // In the air under each bell, as high as it hangs (and on its side of the street, where it hangs there).
        while (mo.at < p.targets.length && p.targets[mo.at].z <= s.z) {
          const t = p.targets[mo.at++];
          const up = s.y - this.course.ground(s.x, s.z);
          const dx = s.x - t.x;
          const hit = !s.grounded && s.tumble === 0 && up >= t.h && dx <= t.hw && dx >= -t.hw;
          if (hit) {
            mo.n++;
            mo.mask |= 1 << (mo.at - 1);
            this.charge(SHATTER_UNITS, true);
            say('step', mo.n);
          } else {
            mo.ok = false;
            say('miss', mo.n);
          }
        }
        if (mo.at >= p.targets.length || s.z >= p.z1) this.momentEnd(p, mo.n >= p.need && p.targets.length > 0);
        break;
      }
      case 'surge': {
        // Off the lip at the speed or better (said as it goes), and down past the far line on its feet.
        if (mo.aux === 0) {
          if (!s.grounded && s.z >= p.lip - 4) {
            mo.aux = 1;
            mo.pace = s.speed;
            mo.n = Math.floor(s.speed);
            say('step', mo.n);
          }
        } else if (s.z > p.lip + 6) {
          let down = s.tumble > 0;
          let botched = false;
          for (const e of this.events) {
            if (e.type !== 'land' || e.late) continue;
            down = true;
            if (e.botched) botched = true;
          }
          if (down) {
            // (On its feet: a landing a ward or a get-up's grace had to save is not one.)
            this.momentEnd(p, s.tumble === 0 && !botched && s.z >= p.far && mo.pace >= p.speed);
            break;
          }
        }
        if (s.z >= p.z1) this.momentEnd(p, false);
        break;
      }
      case 'flourish': {
        // The leap's own landing, clean, with the trick in it.
        if (s.z > p.lip + 6) {
          if (s.tumble > 0) {
            this.momentEnd(p, false);
            break;
          }
          for (const e of this.events) {
            if (e.type !== 'land' || e.late || e.airtime < 0.8) continue;
            const ok = (e.quality === 'clean' || e.quality === 'perfect') && e.halfTurns >= p.half && e.flips >= p.flips;
            mo.n = ok ? 1 : 0;
            this.momentEnd(p, ok);
            break;
          }
        }
        if (mo.active === p.index && s.z >= p.z1) this.momentEnd(p, false);
        break;
      }
      case 'follow': {
        // Metres ridden inside the guide light's wake; enough of them wins on the spot.
        const path = p.path;
        if (path && s.z >= path.z0 && s.z <= path.z1) {
          const off = pathOff(path, s.z);
          const dx = s.x - this.course.safeX(s.z) - off;
          const inWake = dx <= p.hw && dx >= -p.hw && s.tumble === 0;
          // (Where the light rides the safe line itself, over a kicker and its flight, there is no wake to be in.)
          if (inWake && (off >= WAKE_MIN || off <= -WAKE_MIN)) mo.pace += s.z - prevZ;
          if (inWake !== mo.ahead) {
            mo.ahead = inWake;
            say(inWake ? 'lead' : 'trail', mo.n);
          }
          const q = Math.floor((8 * mo.pace) / p.need);
          if (q > mo.n && q < 8) {
            mo.n = q;
            say('step', q);
          }
        }
        if (mo.pace >= p.need) {
          mo.n = 8;
          this.momentEnd(p, true);
        } else if (s.z >= p.z1) this.momentEnd(p, false);
        break;
      }
      case 'kindle': {
        // Each unlit lamp the sled passes close beside is lit: enough of them, on both sides of the road. Close,
        // and clean: a sled that hits anything (a lamp above all) lights nothing for half a second, so a rider
        // who ploughs down a row lights none of it. (mo.at counts that half second down.)
        for (const e of this.events) {
          if (e.type !== 'bump' && e.type !== 'ward' && e.type !== 'scrape' && !(e.type === 'tumble' && e.phase === 'start')) continue;
          if (mo.at === 0) say('miss', mo.n);
          mo.at = KINDLE_COLD;
        }
        if (mo.at > 0) mo.at--;
        for (let i = 0; i < p.lamps.length; i++) {
          const l = p.lamps[i];
          if (!l.dark || mo.mask & (1 << i)) continue;
          // (As the sled passes the lamp: a hit on it has landed by then.)
          if (l.z > s.z || l.z <= prevZ || s.tumble > 0 || mo.at > 0) continue;
          const dx = l.x - s.x;
          if (dx > KINDLE_REACH || dx < -KINDLE_REACH) continue;
          mo.mask |= 1 << i;
          mo.n++;
          if (l.side < 0) mo.aux++;
          this.charge(KINDLE_UNITS, true);
          say('step', mo.n);
        }
        if (mo.n >= p.need && mo.aux >= p.each && mo.n - mo.aux >= p.each) this.momentEnd(p, true);
        else if (s.z >= p.z1) this.momentEnd(p, false);
        break;
      }
      case 'carry': {
        // The flame burns down by the clock and a hit takes some of it. A fall or a ward gutters it (it used to
        // put it out, so the rider who gets up never lit the lantern): mo.at counts the ticks left to be back at
        // the flame's pace, from riding again, and the clock waits meanwhile. Back at pace it catches with the
        // seconds in hand it had when it guttered (mo.aux: what the flame had left to burn over what a clean
        // coast to the line from there, at that speed, would take), less what the guttering took. So a fall
        // costs the flame a bite and the rider whatever it does next, never the pace it had made; and a rider
        // who was behind the flame is no nearer for falling. A second fall while it gutters puts it out, and
        // so does the time. The line decides it (lines()): this only ever loses it.
        let f = mo.pace;
        let hits = 0;
        let down = false;
        let warded = false;
        let botched = false;
        for (const e of this.events) {
          if (e.type === 'bump') hits += p.hit;
          else if (e.type === 'scrape') hits += p.hit * 0.5;
          else if (e.type === 'land' && e.quality === 'sketchy') {
            if (e.botched) botched = true;
            else hits += p.hit;
          } else if (e.type === 'ward') down = warded = true;
          else if (e.type === 'tumble' && e.phase === 'start') down = true;
        }
        // (A landing on the rider's head that the grace after a get-up let pass is a hit to the flame.)
        if (botched && !down) hits += p.hit;
        f -= hits;
        if (mo.at === 0) f -= 1 / p.flameTicks;
        if (down && f > 0) {
          if (mo.at > 0) f = 0;
          else {
            f -= p.fall;
            if (f > 0) {
              mo.at = p.gutter;
              // (At the speed it had going in: what a ward keeps of it is the ward's price, not the flame's.)
              const v = warded ? s.speed / (WARD_KEEP * this.sled.wardKeep) : s.speed;
              mo.aux = (f * p.flameTicks) / TICK_RATE - coastSeconds(this.course, s.z, p.z1, v, true);
              say('trail', Math.ceil(f * 10));
            }
          }
        } else if (mo.at > 0 && f > 0) {
          mo.aux -= (hits * p.flameTicks) / TICK_RATE;
          if (s.tumble === 0) {
            if (s.speed >= flamePace(p, s.z)) {
              f = ((coastSeconds(this.course, s.z, p.z1, s.speed, true) + mo.aux) * TICK_RATE) / p.flameTicks;
              if (f > 1) f = 1;
              mo.at = 0;
              mo.aux = 0;
              if (f > 0) say('lead', Math.ceil(f * 10));
            } else if (--mo.at === 0) f = 0;
          }
        }
        const r = p.relight;
        if (r && f > 0 && !(mo.mask & 1)) {
          const dx = r.x - s.x;
          const dz = r.z - s.z;
          if (dx * dx + dz * dz < r.r * r.r) {
            mo.mask |= 1;
            const fed = f + r.gain > 1 ? 1 : f + r.gain;
            if (mo.at > 0) mo.aux += ((fed - f) * p.flameTicks) / TICK_RATE;
            f = fed;
            say('close', mo.n);
          }
        }
        mo.pace = f > 0 ? f : 0;
        const tenths = Math.ceil(mo.pace * 10);
        if (tenths !== mo.n) {
          mo.n = tenths;
          if (tenths > 0) say('step', tenths);
        }
        if (mo.pace <= 0) this.momentEnd(p, false);
        break;
      }
    }
  }

  /** The run's legend moment (moments.ts): said as it comes up, begun as the rider reaches it. A runner keeps
   *  ahead of the rider and its lights lie on the snow from the start (they are the storm's kind, so everything
   *  that takes and draws a storm's light takes and draws these). A ribbon lights the lantern while the sled is
   *  in it. Nothing here can hurt a run: no collider, no slowing, nothing on the safe line. */
  private legendStep(): void {
    const lg = this.legend;
    if (!lg) return;
    const st = this.lg;
    const s = this.s;
    if (st.phase === 0) {
      if (s.z < lg.z0 - LEGEND_WARN) return;
      st.phase = 1;
      this.events.push({ type: 'legend', phase: 'warn', slot: lg.slot, n: 0 });
    }
    if (st.phase === 1) {
      if (s.z < lg.z0) return;
      st.phase = 2;
      st.t0 = this.tick;
      st.head = lg.z0 + LEGEND_AHEAD;
      this.stats.legend = lg.slot;
      lg.lights.forEach((l, k) => this.dyn.storm.push({ id: LEGEND_ID0 + k, x: l.x, z: l.z, y: 0, value: l.value, spawnTick: this.tick, collected: false, drop: 0 }));
      this.events.push({ type: 'legend', phase: 'start', slot: lg.slot, n: 0 });
    }
    if (st.phase !== 2) return;
    if (lg.kind === 'runner') {
      const on = st.head + LEGEND_PACE * DT;
      const lead = s.z + LEGEND_AHEAD;
      st.head = on > lead ? on : lead;
      if (st.head > lg.z1) st.head = lg.z1;
    } else if (lg.kind === 'ribbon' && lg.path && st.n < RIBBON_CAP && s.tumble === 0 && s.z >= lg.path.z0 && s.z <= lg.path.z1) {
      const dx = s.x - pathX(this.course, lg.path, s.z);
      if (dx <= RIBBON_HW && dx >= -RIBBON_HW) {
        const before = this.s.lantern;
        this.charge(RIBBON_RATE, true);
        this.stats.legendLit += this.s.lantern - before;
        const q = Math.floor((st.n + RIBBON_RATE) / 25);
        if (q > Math.floor(st.n / 25)) this.events.push({ type: 'legend', phase: 'step', slot: lg.slot, n: q });
        st.n += RIBBON_RATE;
      }
    }
    if (s.z >= lg.z1) {
      st.phase = 3;
      this.events.push({ type: 'legend', phase: 'end', slot: lg.slot, n: Math.floor(st.n / 25) });
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
        const bell = this.has(CHARM.bell);
        if (Math.abs(s.x - rx) > (bell ? 1.3 : 0.7) || s.speed < (bell ? 7 : 9) || s.velHeading < -0.6 || s.velHeading > 0.6) continue;
        this.rail = r;
        this.railU = d / len;
        this.railTicks = 0;
        s.grinding = true;
        s.drifting = false;
        s.wallTicks = 0;
        this.events.push({ type: 'grind', phase: 'start', id: r.id });
        this.style('grind', this.has(CHARM.bell) ? 360 : 180);
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
    if (this.railTicks % 24 === 0) this.style('grind', this.has(CHARM.bell) ? 120 : 60);
    const off = Math.abs(s.steer) > 0.7 && this.railTicks > 12;
    if (u < 1 && !off && !released) return;
    const popped = released;
    this.endGrind();
    this.railOff = true;
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
          if (s.invuln === 0 && (vn > (this.has(CHARM.bark) ? 15 : HIT_HARD) || (vn > HIT_FAST && s.speed > HIT_FAST_SPEED))) {
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
          s.wobble = this.has(CHARM.bark) ? 11 : 22;
          this.coolFlow(this.has(CHARM.spirit) ? 2 : 1);
          this.bumpCombo(true);
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
    // Owl's Breath: the combo's timer refilled and a second more, up to three. Night Chorus: two links.
    if (this.has(CHARM.owl)) this.combo.refill(TICK_RATE, 3 * TICK_RATE);
    if (this.hasPair(4)) this.combo.link();
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
    // Lamplit Path: a spark on the safe line every PATH_STEP metres, for this rider only.
    if (this.pathNext > 0) this.pathSparks();
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
    const fall = (g.drop ?? 16) - 9 * t * t;
    return base + (fall > 0 ? fall : 0);
  }

  private collectLight(id: number, value: number, x: number, y: number, z: number): void {
    this.collected.add(id);
    const great = value > 1;
    const before = this.s.lantern;
    // (Lamplit Path: its own sparks light half a spark; the course's great lights 40% less.)
    const path = id >= PATH_ID0 && id < PATH_ID0 + 1000;
    this.charge((great ? GREAT : SPARK) * this.mood.lightValue * (path ? 0.5 : great && this.has(CHARM.path) ? 0.6 : 1), false);
    this.stats.lights++;
    if (great) this.stats.greatLights++;
    if (id >= LEGEND_ID0 && !path) this.stats.legendLit += this.s.lantern - before;
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
      // (Slipstream Lantern: a draft lights the lantern.)
      if (this.has(CHARM.slip)) this.charge(0.6, true);
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
      const kite = this.has(CHARM.kite);
      if (s.draftTicks >= (kite ? 18 : 36)) {
        const boost = (2.5 + 3.5 * s.draftCharge) * this.mood.draft * (kite ? 1.5 : 1);
        s.boostPool += boost;
        this.events.push({ type: 'boost', amount: boost, source: 'slingshot' });
        this.style('slingshot', 200);
        if (kite) this.charge(12, true);
        // (Ghost Rider: a whole cell a slingshot.)
        if (this.hasPair(0)) this.lightRaw(LANTERN);
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
    mixF(s.fall);
    mixF(s.getUps);
    mixF(s.getUpZ);
    mixF(s.falls);
    mixF(s.finished ? 1 : 0);
    mixF(s.grinding ? this.railU : -1);
    mixF(s.lantern);
    mixF(s.grab);
    mixF(s.grabTicks);
    mixF(s.dash);
    mixF(s.ghost);
    mixF(this.overcap);
    mixF(this.mo.active);
    mixF(this.mo.n);
    mixF(this.mo.at);
    mixF(this.mo.pace);
    mixF(this.mo.mask);
    mixF(this.mo.aux);
    mixF(this.stats.momentMask);
    mixF(this.lg.phase);
    mixF(this.lg.n);
    mixF(this.lg.head);
    mixF(this.charmMask);
    mixF(this.heat);
    mixF(s.flowLevel);
    mixF(this.stats.showdowns);
    mixF(this.stats.steals);
    return h >>> 0;
  }
}

/** What a set piece counts to (the chip's "n of"): gates, rings, targets and cars are themselves; a slide counts
 *  quarters (or its two ways), follow eighths, the carry's flame tenths, a surge the speed its far line wants. */
function momentCount(p: MomentPlay): number {
  switch (p.verb) {
    case 'gates':
      return p.gates.length;
    case 'rings':
      return p.rings.length;
    case 'steps':
      return p.need;
    case 'race':
      return p.style === 'chase' ? p.cars.length : 1;
    case 'slide':
      return p.both ? 2 : 4;
    case 'shatter':
      return p.targets.length;
    case 'surge':
      return Math.round(p.speed);
    case 'follow':
      return 8;
    case 'kindle':
      return p.need;
    case 'carry':
      return 10;
    default:
      return 1;
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
