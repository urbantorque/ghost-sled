import { ChaosEvent, ChaosRoll } from '../sim/chaos';
import { CHUNK_LEN, Course, Obstacle, Ramp } from '../sim/course';
import { clamp, datan2, dcos, dsin, lerp, smoothstep, wrapAngle } from '../sim/dmath';
import { DRAFT_BIT, InputRecorder, LogEvent, packInput } from '../sim/input';
import { Rng, hash32, hashFloat } from '../sim/prng';
import { RunRecord, applyLogEvent } from '../sim/replay';
import { type RiderPoint, RivalWatch, draftsOn, riderPoint } from '../sim/rivals';
import { DT, LANTERN, Sim, TICK_RATE } from '../sim/sim';
import { Lines } from './lines';
import type { RideStyle } from './roster';
import { AirPlan, Flight, PlanResult, Rot, RotParams, actionAt, predictFlight, runPlan, solveFlip, solveSpin, steerAt } from './model';
import { CHARM, LANE_W, STARTER_POOL, charmFamily, synergiesOf } from '../sim/charms';
import { GRAB_LATCH } from '../sim/tricks';
import { type MomentPath, type MomentPlay, gateX, pathOff } from '../sim/moments';
import { Scene } from './scene';

// A ghost bot that plays the real Sim through the same one-byte-per-tick input a player produces.
// It perceives late, updates its inputs a few times per second, plans lines, kickers, drifts and
// tricks with an internal body model, and makes the mistakes people make. Everything random comes
// from one seeded Rng, so a profile always produces the same run.

export interface BotProfile {
  /** 0 (first run ever) to 1 (expert). */
  skill: number;
  /** Seeds personality and decision noise. */
  seed: number;
  sled: number;
  name: string;
  /** Forces a fork's route (left out, the bot's own nerve decides). */
  bold?: boolean;
  /** A signature rider's way of riding (roster.ts): it shapes the traits, so it shows in the record. */
  style?: RideStyle;
  /** The charms it may be offered (charms.ts; absent: STARTER_POOL). */
  charmPool?: number;
}

interface Traits {
  skill: number;
  /** Perception to action latency, ticks. */
  reaction: number;
  /** Ticks between input updates: people change their input a few times per second. */
  thinkMin: number;
  thinkMax: number;
  /** Look-ahead along the line, seconds. */
  lookTime: number;
  /** Time constant of heading corrections, seconds. */
  tau: number;
  /** How much of its own motion over the reaction delay the bot anticipates (0..1). */
  anticipate: number;
  steerNoise: number;
  /** How far ahead obstacles are seen, metres. */
  vision: number;
  /** Share of obstacles only noticed at the last moment. */
  lateRate: number;
  /** Clearance wanted from obstacles when choosing a line, metres. */
  margin: number;
  lapsePerMin: number;
  lapseTicks: number;
  /** Appetite for tricks, pops and kickers (0..1). */
  ambition: number;
  /** Appetite for gifts and snowmen off the line (0..1). */
  greed: number;
  /** Release timing error for spins and flips, ticks (one sigma). */
  timingSd: number;
  stompSd: number;
  /** Chance of trying to stomp a landing at all. */
  stompRate: number;
  /** Relative error when judging how long a flight will last. */
  airErr: number;
  /** Chance per trick of holding the rotation far too long. */
  blunder: number;
  /** How far the bot wanders either side of the line when free riding, metres. */
  wander: number;
  /** Free pops, drifts per second when conditions allow, and the chance to hop a low obstacle. */
  popRate: number;
  driftRate: number;
  hopRate: number;
  maxHalfTurns: number;
  maxFlips: number;
  /** Ticks of margin a rotation should be finished before touchdown. */
  slack: number;
  /** Combo value at which the bot rides calmly until it banks. */
  bankAt: number;
  /** Chance of popping again to keep a combo alive. */
  chain: number;
  /** Chance a detour decision ignores its safety margin (a greedy line). */
  squeeze: number;
  /** Favourite spin and drift direction. */
  favDir: number;
  /** Full lanterns kept back as wards before any is spent on a dash. */
  dashKeep: number;
  /** Dashes a second, roughly, when a lantern is spare and the line is open. */
  dashRate: number;
  /** Chance of dashing through a line that has closed ahead instead of swerving. */
  dashPhase: number;
  /** The racer's habit (round 7's simfix), 0 to 1: how readily the rider drops into a tuck on a straight and
   *  holds it, where a pop for the fun of it is held half a second. A tuck is worth 3 m/s at cruise, and no
   *  pool rider used one for more than that half second: it is most of what the quickest riders lacked. */
  tuck: number;
  /** Set to 1 for a rider who tries every set piece (left out, its key and its skill decide each). */
  setPieces?: number;
}

/** Roughly normal, unit variance, from four uniforms (no transcendental functions). */
function gauss(rng: Rng): number {
  return (rng.next() + rng.next() + rng.next() + rng.next() - 2) * 1.7320508075688772;
}

function traitsFor(skill: number, rng: Rng, style?: RideStyle): Traits {
  const t = baseTraits(skill, rng);
  if (style) styleTraits(t, style);
  return t;
}

/** A signature rider's style, laid over the traits its skill gives. */
function styleTraits(t: Traits, style: RideStyle): void {
  switch (style) {
    case 'master':
      t.lateRate *= 0.3;
      t.lapsePerMin *= 0.4;
      t.blunder *= 0.4;
      t.dashKeep = 0;
      t.dashRate = 0.45;
      t.dashPhase = 0.85;
      break;
    case 'racer':
      // Rides for the clock (the pools' fast end): tucked wherever the line runs straight, no detour that is
      // not fuel, every lantern a dash the moment the line is open, and every set piece tried, for the lantern
      // it lights.
      t.tuck = 1;
      t.lateRate *= 0.3;
      t.lapsePerMin *= 0.3;
      t.blunder *= 0.3;
      t.wander *= 0.3;
      t.dashKeep = 0;
      t.dashRate = 1.2;
      t.dashPhase = 0.9;
      t.setPieces = 1;
      break;
    case 'liner':
      // Never wastes a metre: no detours, few tricks, and a spare lantern goes on the next straight.
      t.ambition *= 0.45;
      t.greed *= 0.3;
      t.wander *= 0.35;
      t.popRate *= 0.4;
      t.driftRate *= 0.6;
      t.lateRate *= 0.5;
      t.dashKeep = 1;
      t.dashRate = 0.35;
      t.dashPhase = 0.1;
      break;
    case 'dasher':
      t.dashKeep = 0;
      t.dashRate = 0.6;
      t.dashPhase = 0.9;
      t.greed = Math.min(1, t.greed + 0.3);
      break;
    case 'stunt':
      t.ambition = Math.min(1, t.ambition + 0.35);
      t.popRate *= 1.6;
      t.maxHalfTurns = Math.min(5, t.maxHalfTurns + 1);
      t.maxFlips = Math.min(2, t.maxFlips + 1);
      t.dashKeep = 1;
      break;
    case 'hoarder':
      t.dashKeep = 3;
      t.dashRate = 0;
      t.dashPhase = 0;
      t.greed = Math.min(1, t.greed + 0.25);
      t.ambition *= 0.7;
      break;
    case 'collector':
      t.greed = 1;
      t.wander = Math.min(2.8, t.wander + 1);
      t.dashKeep = 0;
      t.dashRate = 0.25;
      break;
    case 'sky':
    case 'bold':
      t.ambition = Math.min(1, t.ambition + 0.4);
      t.popRate *= 1.3;
      t.greed = Math.min(1, t.greed + 0.2);
      t.squeeze *= 2;
      break;
    case 'grinder':
    case 'drafter':
      break;
    case 'wild':
      t.ambition = 1;
      t.lapsePerMin *= 1.8;
      t.blunder *= 3;
      t.margin *= 0.7;
      t.dashKeep = 0;
      t.dashRate = 0.5;
      t.dashPhase = 0.6;
      break;
  }
}

function baseTraits(skill: number, rng: Rng): Traits {
  const s = clamp(skill, 0, 1);
  const vary = (v: number, sd: number, lo: number, hi: number) => clamp(v + gauss(rng) * sd, lo, hi);
  const ambition = vary(lerp(0.3, 0.85, s), 0.18, 0.05, 1);
  const greed = vary(0.5, 0.22, 0, 1);
  return {
    skill: s,
    reaction: Math.round(vary(lerp(19, 7, s), 1.5, 6, 24)),
    thinkMin: Math.round(lerp(13, 8, s)),
    thinkMax: Math.round(lerp(24, 15, s)),
    lookTime: vary(lerp(1.05, 0.8, s), 0.06, 0.6, 1.3),
    // Slow hands on a long delay: beginners steer gently or they would oscillate wildly.
    tau: lerp(0.75, 0.45, s),
    anticipate: lerp(0.7, 0.95, s),
    steerNoise: lerp(0.12, 0.04, s),
    vision: lerp(32, 80, s),
    lateRate: lerp(0.12, 0.004, s),
    margin: lerp(0.45, 0.7, s),
    lapsePerMin: vary(lerp(1.6, 0.15, s), 0.3, 0.05, 3),
    lapseTicks: Math.round(lerp(36, 18, s)),
    ambition,
    greed,
    timingSd: lerp(4.5, 0.9, s),
    stompSd: lerp(6, 1.4, s),
    stompRate: lerp(0.3, 0.97, s),
    airErr: lerp(0.16, 0.025, s),
    blunder: lerp(0.1, 0.008, s),
    wander: vary(lerp(0.5, 1.8, s), 0.4, 0, 2.8),
    popRate: ambition * lerp(0.04, 0.5, s),
    driftRate: s > 0.3 ? ambition * lerp(0, 0.3, s) : 0,
    hopRate: ambition * lerp(0.05, 0.6, s),
    maxHalfTurns: s < 0.15 ? 1 : s < 0.4 ? 2 : s < 0.65 ? 3 : 4,
    maxFlips: s < 0.3 ? 0 : s < 0.72 ? 1 : 2,
    slack: Math.round(lerp(16, 7, s) - ambition * 4),
    bankAt: lerp(1500, 30000, s) * (1.6 - ambition),
    chain: ambition * s,
    squeeze: lerp(0.02, 0.0007, s) * (0.5 + greed),
    favDir: rng.chance(0.5) ? 1 : -1,
    // Beginners keep a lantern as a ward and barely know the button; the skilled spend theirs.
    dashKeep: s < 0.35 ? 1 : s < 0.7 ? (rng.chance(0.5) ? 1 : 0) : 0,
    dashRate: lerp(0.03, 0.3, s),
    dashPhase: lerp(0, 0.6, s),
    tuck: s > 0.7 ? vary(lerp(0, 0.9, (s - 0.7) / 0.3), 0.15, 0, 1) : 0,
  };
}

/** The bot's feel for how fast the sled yaws at a given speed (the sim's turn-rate rule). */
function turnRate(speed: number): number {
  const r = 2.5 / (1 + speed / 16);
  return r < 1.45 ? r : 1.45;
}

function level(steer: number): number {
  return clamp(Math.round(4 + steer * 4), 0, 8);
}

/** One input channel with changes scheduled at future ticks (kept sorted by tick). */
class Channel {
  value: number;
  private readonly ts: number[] = [];
  private readonly vs: number[] = [];

  constructor(v: number) {
    this.value = v;
  }

  /** The value the channel ends on once everything scheduled has applied. */
  get last(): number {
    const n = this.vs.length;
    return n ? this.vs[n - 1] : this.value;
  }

  /** Drop every change at or after tick t. */
  cut(t: number): void {
    let n = this.ts.length;
    while (n > 0 && this.ts[n - 1] >= t) n--;
    this.ts.length = n;
    this.vs.length = n;
  }

  /** Replace everything from tick t on with value v. */
  set(t: number, v: number): void {
    this.cut(t);
    this.ts.push(t);
    this.vs.push(v);
  }

  apply(now: number): void {
    while (this.ts.length && this.ts[0] <= now) {
      this.value = this.vs[0];
      this.ts.shift();
      this.vs.shift();
    }
  }
}

type Mode = 'ride' | 'crouch' | 'drift' | 'land' | 'air';
type Purpose = 'pop' | 'kicker' | 'hop' | 'drift';
type GoalKind = 'light' | 'kicker' | 'smash' | 'hop';

/** A detour: ride straight into (xIn, zIn), on to (xOut, zOut), then ease back onto the line. */
interface Goal {
  kind: GoalKind;
  zIn: number;
  xIn: number;
  zOut: number;
  xOut: number;
  ret: number;
  ramp: Ramp | null;
  /** Collider the path is allowed to cross (a hop target). */
  skip: number;
  pop: boolean;
  squeeze: boolean;
}

/** The trick plan for one flight, in absolute ticks. */
interface Air {
  planned: boolean;
  /** A short bump: no trick, steering left alone. */
  hop: boolean;
  bias: number;
  k: number;
  f: number;
  dir: number;
  cruise: number;
  S0: number;
  S1: number;
  s1Fixed: boolean;
  F0: number;
  F1: number;
  f1Fixed: boolean;
  stomp: boolean;
  ST: number;
  stFixed: boolean;
  /** A blunder is planned: the rotation will be held until far too late. */
  over: number;
  /** Estimated touchdown tick. */
  land: number;
  stompBias: number;
  /** Round 8: a grab (its side, 0 none), pressed at G0 and let go at G1 (late: into the landing, the stomp), and a
   *  tweak against it on [T0, T1). */
  gside: number;
  G0: number;
  G1: number;
  g1Fixed: boolean;
  gLate: boolean;
  T0: number;
  T1: number;
  /** The sled's own move is planned: tapped at G0 - 6, held from G0 to G1. */
  sig: boolean;
}

/** Set pieces a rider grabs nothing over: each wants its landings, its line or its flame. */
const NO_GRAB: ReadonlySet<string> = new Set(['shatter', 'steps', 'surge', 'flourish', 'carry', 'slide', 'gates']);

/** Ticks from deciding on a pre-planned move to the finger actually moving. */
const MOTOR = 2;
/** How far to the inside of a sitting gate's middle a rider threads it, as a share of its half-width. */
const GATE_CUT = 0.4;
/** Collider id the bot uses for the yeti. */
const YETI = -7;

export class Bot {
  private readonly course: Course;
  private readonly lines: Lines;
  private readonly scene: Scene;
  private readonly rng: Rng;
  private readonly t: Traits;
  private readonly key: number;
  private rotP: RotParams;
  private readonly style: RideStyle | '';
  private readonly steer = new Channel(4);
  private readonly act = new Channel(0);
  private readonly rotBuf: Rot = { steer: 0, spin: 0, yaw: 0, pr: 0, pitch: 0, hold: 0, armed: false, prev: false, kind: -1, len: 0, grab: 0 };
  private readonly planBuf: AirPlan = { dir: 0, mag: 1, s0: 0, s1: 0, cruise: 0, f0: 0, f1: 0, stomp: -1, gside: 0, g0: 0, g1: 0, t0: 0, t1: 0 };
  private readonly res: PlanResult = { yawA: 0, yawB: 0, pitchA: 0, pitchB: 0, lat: 0, vlat: 0 };
  private mode: Mode = 'ride';
  private nextThink = 0;
  private interval = 10;
  private lapseUntil = -1;
  private thinks = 0;
  private goal: Goal | null = null;
  private off = 0;
  private offTarget = 0;
  private offRetarget = 0;
  private px0 = 0;
  private pz0 = 0;
  private join = 16;
  private purpose: Purpose = 'pop';
  private pressAt = -1;
  private releaseAt = -1;
  private releasedAt = -1000;
  private centerAt = -1;
  private driftSide = 1;
  private driftTier = 1;
  private driftUntil = 0;
  private driftSeen = false;
  private driftWait = false;
  private driftWaitUntil = 0;
  private driftEntry = false;
  private driftSetup = 0;
  private driftSetupUntil = 0;
  private mogulTry = 0;
  private cooling = false;
  private air: Air | null = null;
  private armed = false;
  private lastTrick = -1;
  private groundLevel = 4;
  private reflex = false;
  /** Riding a set piece's gates (momentOff): no detours, a nearer look. */
  private inGates = false;

  constructor(
    private readonly sim: Sim,
    profile: BotProfile,
  ) {
    this.course = sim.course;
    this.scene = new Scene(sim.course);
    this.rng = new Rng(hash32(profile.seed, 0xb07));
    this.t = traitsFor(profile.skill, this.rng, profile.style);
    this.style = profile.style ?? '';
    // The ambitious take a fork's risk route, so ghosts show the player it exists.
    const bold = this.rng.chance(this.t.ambition * (0.2 + 0.8 * this.t.skill));
    this.lines = new Lines(sim.course, profile.bold ?? bold);
    this.key = hash32(profile.seed, 0x5ee);
    this.rotP = this.rotParams();
    this.nextThink = this.rng.int(2, 12);
  }

  /** The body's rates as the sim has them: the sled, the mood and the charms held (Whirlwind, Paper Kite). */
  private rotParams(): RotParams {
    const sim = this.sim;
    const whirl = sim.has(CHARM.whirl);
    return { spinMax: 9 * sim.sled.spin * sim.mood.spin * (whirl ? 1.2 : 1) * (sim.has(CHARM.paper) ? 0.85 : 1), flipRate: 6.8 * sim.sled.flip * sim.mood.spin * (whirl ? 0.8 : 1) };
  }

  /** The input byte for the tick about to be simulated. */
  input(): number {
    const now = this.sim.tick;
    if (now >= this.nextThink) this.think(now);
    this.steer.apply(now);
    const was = this.act.value;
    this.act.apply(now);
    if (this.act.value === 1 && was === 0 && !this.sim.s.grounded) this.armed = true;
    return packInput(this.steer.value, this.act.value === 1, false, now < this.spiritUntil);
  }

  private spiritUntil = -1;

  /** Spend a lantern on a dash, as a person would: only with one to spare over the wards this rider keeps,
   *  on the ground and out of a trick's set-up, either on an open straight (by temperament) or to ride as a
   *  spirit through a line that has closed ahead. */
  private maybeDash(now: number, blocked: boolean): void {
    const s = this.sim.s;
    const t = this.t;
    if (s.dash > 0 || now < this.spiritUntil + 40 || !s.grounded || this.mode !== 'ride' || s.tumble > 0) return;
    // (In a showdown every lantern is a dash, the moment the line is open.)
    if (Math.floor(s.lantern / LANTERN) <= (this.racing >= 0 ? 0 : t.dashKeep)) return;
    // A rider who tries a set piece that wants control does not dash into it, or in the three seconds before
    // it (nobody who has ridden Old Town twice does): a dash is 7 m/s the slalom has no room for.
    if (this.holdsDash()) return;
    if (blocked) {
      if (this.rng.chance(t.dashPhase)) this.spiritUntil = now + 3;
      return;
    }
    if (this.goal || !this.openAhead(s.z, s.speed, 1.6)) return;
    if (this.rng.chance((t.dashRate * this.interval) / TICK_RATE)) this.spiritUntil = now + 3;
  }

  /** Whether the set piece this rider is in, or about to be in, is one it tries and one a dash would spoil. */
  private holdsDash(): boolean {
    const sim = this.sim;
    const mo = sim.mo;
    if (!mo) return false;
    const p = mo.active >= 0 ? sim.plays[mo.active] : sim.plays[mo.next];
    if (!p || (mo.active < 0 && p.z0 - sim.s.z > sim.s.speed * 3)) return false;
    if (p.verb === 'race' || p.verb === 'carry' || p.verb === 'collapse' || p.verb === 'surge') return false;
    return this.tries(p);
  }

  /** Whether the next set piece is ridden on the snow from its first metre (a line, not a leap or a pop). */
  private wantsSnow(): boolean {
    const p = this.sim.plays[this.sim.mo.next];
    return !!p && (p.verb === 'gates' || p.verb === 'follow' || p.verb === 'kindle' || p.verb === 'slide');
  }

  /** Read what happened on the tick just simulated. */
  observe(): void {
    const sim = this.sim;
    const s = sim.s;
    const now = sim.tick;
    for (const e of sim.events) {
      if (e.type === 'takeoff') this.onTakeoff(now);
      else if (e.type === 'land' && !e.late) this.onLand(now, e.quality === 'hop');
    }
    this.wasGrinding = s.grinding;
    // A showdown under way ends at its marker, won or lost.
    if (this.racing >= 0 && (s.z >= this.racing || s.finished || s.crashed)) this.showdownOver();
    // A press that began on the snow (or has been held there a while) pops on release, so it has to
    // be handled as a crouch.
    if (s.grounded && this.act.value === 1 && (s.pressStartedGrounded || s.groundHold > 8) && (this.mode === 'land' || (this.mode === 'ride' && this.act.last === 1))) {
      this.mode = 'crouch';
      this.purpose = 'pop';
      this.pressAt = s.lastPressTick;
      this.releaseAt = now + this.rng.int(10, 28);
      this.act.cut(now);
    }
  }

  // ------------------------------------------------------------------ thinking

  private think(now: number): void {
    const s = this.sim.s;
    this.thinks++;
    if (this.mode === 'air' || !s.grounded) {
      this.interval = this.rng.int(6, 10);
      this.nextThink = now + this.interval;
      if (this.mode === 'air' && this.air) this.airThink(now);
      return;
    }
    // (Down a slalom the hands move with every gate: twice as often as on open snow.)
    this.interval = this.slalom ? this.rng.int(4, 7) : this.rng.int(this.t.thinkMin, this.t.thinkMax);
    this.nextThink = now + this.interval;
    if (now < this.lapseUntil) return;
    if (this.rng.chance((this.t.lapsePerMin * this.interval) / 3600)) {
      // Attention lapse: inputs stay exactly as they are for a moment.
      this.lapseUntil = now + Math.round(this.t.lapseTicks * (0.5 + this.rng.next()));
      return;
    }
    this.groundThink(now);
  }

  private readonly noticeAt = (o: Obstacle): number =>
    hashFloat(this.key, o.id) < this.t.lateRate ? 6 + 10 * hashFloat(this.key, o.id, 1) : this.t.vision;

  private perceive(): void {
    const sim = this.sim;
    const s = sim.s;
    this.scene.gather(s.z, 100, sim.destroyed, this.noticeAt);
    const y = sim.dyn.yeti;
    if (sim.config.chaos.event === ChaosEvent.Yeti && (y.phase === 1 || y.phase === 2) && y.z > s.z - 2) {
      // The yeti is impossible to miss; where it will be when we get there is the guess.
      const ta = (y.z - s.z) / Math.max(4, s.vz);
      const wait = y.phase === 1 ? (150 - y.ticks) / TICK_RATE : 0;
      const yx = y.x + y.dir * 4.8 * Math.max(0, ta - wait);
      this.scene.add({ id: YETI, x: yx, z: y.z, x2: yx, z2: y.z, r: 2.4, y: this.course.ground(yx, y.z), h: 2.4, soft: false });
      this.scene.sort();
    }
  }

  // ------------------------------------------------------------------ lines and paths

  private lineX(z: number): number {
    // (In the guide light's wake the line is the light's own, weave and all.)
    if (this.wake) return this.lines.safeX(z) + pathOff(this.wake, z);
    // (Down a slalom of sitting gates the line is the slalom itself, one smooth swing gate to gate.)
    return this.lines.safeX(z) + (this.slalom ? this.slalomOff(this.slalom, z) : this.off) + this.charmOff(z);
  }

  /** The lane this rider rides for at each charm gate, chosen once its offers are dealt (-1 not yet). */
  private readonly lanes: number[] = [-1, -1, -1];

  /** Round 8: metres off the line toward the charm this rider wants at the gate ahead: in over the 100 m above it,
   *  held through it, out again past it. The middle arch is the line itself. */
  private charmOff(z: number): number {
    const sim = this.sim;
    for (const g of sim.charmGates) {
      if (z < g.z - 110 || z > g.z + 25) continue;
      if (g.lane >= 0 && z > g.z) return 0;
      let lane = this.lanes[g.index];
      if (lane < 0 && g.offers[1] >= 0) lane = this.lanes[g.index] = this.pickLane(g.offers);
      if (lane < 0 || lane === 1) return 0;
      const u = z < g.z - 40 ? smoothstep(g.z - 110, g.z - 40, z) : z <= g.z + 5 ? 1 : 1 - smoothstep(g.z + 5, g.z + 25, z);
      // (Aim a metre inside the arch's middle, toward the line: the lane is 4.6 m wide.)
      return (lane - 1) * (LANE_W - 0.6) * u;
    }
    return 0;
  }

  /** Which arch a rider of this kind rides for: the family its style wants (a racer speed, a stunt rider style, a
   *  careful one survival: the middle, no steering at all), a named pair with what it holds above all for the
   *  master and the wild; the crowd by its nerve, a novice mostly keeping to its line. */
  private pickLane(offers: readonly number[]): number {
    const t = this.t;
    const rng = this.rng;
    const held = this.sim.charmMask;
    const want: Record<string, number> =
      this.style === 'racer' || this.style === 'dasher' || this.style === 'drafter'
        ? { speed: 3, style: 0.5, survival: 1 }
        : this.style === 'stunt' || this.style === 'sky' || this.style === 'grinder'
          ? { speed: 0.5, style: 3, survival: 1 }
          : this.style === 'liner' || this.style === 'hoarder' || this.style === 'collector'
            ? { speed: 0.5, style: 0.5, survival: 3 }
            : { speed: 1 + t.tuck + t.dashRate, style: 0.5 + 2 * t.ambition, survival: 1.5 - t.skill };
    // A first-timer mostly rides the line it is on: the middle.
    if (!this.style && rng.chance(0.75 * (1 - t.skill))) return 1;
    let best = 1;
    let bestScore = -1;
    for (let lane = 0; lane < 3; lane++) {
      const id = offers[lane];
      if (id < 0) continue;
      let score = want[charmFamily(id)] * (0.6 + 0.8 * rng.next());
      if ((this.style === 'master' || this.style === 'wild' || t.skill > 0.8) && synergiesOf(held | (1 << id)).length > synergiesOf(held).length) score += 4;
      if (score > bestScore) {
        bestScore = score;
        best = lane;
      }
    }
    return best;
  }

  /** The sitting gates this rider is threading (round 7's simfix), or null. */
  private slalom: MomentPlay | null = null;

  /** A slalom's line, metres off the safe line at z: through each gate well to its inside (GATE_CUT of its
   *  half-width from its middle, so the swing is as small as the gates allow), eased gate to gate. Round 7's
   *  riders aimed at one gate at a time and turned for the next only once it was passed: at 40 m/s that is
   *  0.8 s a gate, less than their hands take, and they threaded none in any pool. */
  private slalomOff(p: MomentPlay, z: number): number {
    const gs = p.gates;
    const at = (i: number): number => {
      const off = gs[i].x - this.lines.safeX(gs[i].z);
      return off - (off > 0 ? 1 : -1) * gs[i].hw * GATE_CUT;
    };
    if (gs.length === 0) return 0;
    const ease = (u: number): number => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    if (z <= gs[0].z) return at(0) * ease((z - (gs[0].z - 36)) / 36);
    for (let i = 1; i < gs.length; i++) {
      if (z > gs[i].z) continue;
      const a = at(i - 1);
      return a + (at(i) - a) * ease((z - gs[i - 1].z) / (gs[i].z - gs[i - 1].z));
    }
    return at(gs.length - 1) * (1 - ease((z - gs[gs.length - 1].z) / 30));
  }

  /** The guide light's line while this rider follows it (round 7's follow), or null. */
  private wake: MomentPath | null = null;

  /** The planned line: a straight run from the start point into the goal, then back to the line. */
  private pathX(z: number): number {
    const g = this.goal;
    const x0 = this.px0;
    const z0 = this.pz0;
    if (g) {
      if (z <= g.zIn) return lerp(x0, g.xIn, clamp((z - z0) / Math.max(1, g.zIn - z0), 0, 1));
      if (z <= g.zOut) return lerp(g.xIn, g.xOut, (z - g.zIn) / Math.max(0.5, g.zOut - g.zIn));
      const zr = g.zOut + g.ret;
      if (z <= zr) return lerp(g.xOut, this.lineX(zr), (z - g.zOut) / g.ret);
      return this.lineX(z);
    }
    const zj = z0 + this.join;
    if (z <= zj) return lerp(x0, this.lineX(zj), clamp((z - z0) / this.join, 0, 1));
    return this.lineX(z);
  }

  /** Worst clearance along a candidate path (goal or free line), -1 if it is too sharp to ride. */
  private pathClear(goal: Goal | null, zEnd: number): number {
    const keep = this.goal;
    this.goal = goal;
    const L = this.lines;
    const skip = goal ? goal.skip : -1;
    let worst = Infinity;
    let prevRel = this.pathX(this.pz0) - L.safeX(this.pz0);
    for (let z = this.pz0 + 2; z <= zEnd; z += 2) {
      const x = this.pathX(z);
      const rel = x - L.safeX(z);
      // Steeper than about 17 degrees off the line is not a line anyone rides.
      if (rel - prevRel > 0.6 || rel - prevRel < -0.6) {
        worst = -1;
        break;
      }
      prevRel = rel;
      let cl = this.scene.clearance(x, z, -Infinity, skip);
      const edge = -L.edgeExcess(x, z) - 1.5;
      if (edge < cl) cl = edge;
      if (cl < worst) worst = cl;
      if (worst < -0.5) break;
    }
    this.goal = keep;
    return worst;
  }

  /** Heading toward the look-ahead point on the planned path, never far across the fall line. */
  private desired(xp: number, zp: number, look = 0): number {
    // Down a slalom of gates the rider looks nearer, so it swings in time for the next one.
    const L = Math.max(this.sim.s.speed * (this.slalom ? Math.min(this.t.lookTime, 0.22) : this.inGates ? Math.min(this.t.lookTime, 0.32) : this.t.lookTime) + 3, look);
    const dir = this.lines.dir(zp);
    return dir + clamp(wrapAngle(datan2(this.pathX(zp + L) - xp, L) - dir), -0.45, 0.45);
  }

  /**
   * A set piece played as a person who tries it plays it (round 6): through each lantern gate on its inside
   * half, onto a ring line's lip in line with the rings. Whether this rider tries a given set piece is its own,
   * from its key (likelier the more skilled), so a pool shows some riders who play it and some who do not.
   * The line it asks for still has to clear the path check (planPath), or the rider rides its own.
   */
  private momentOff(): number | null {
    const sim = this.sim;
    const mo = sim.mo;
    if (!mo || mo.active < 0) return null;
    const p = sim.plays[mo.active];
    if (!this.tries(p)) return null;
    const z = sim.s.z;
    if (p.verb === 'gates') {
      // (Sitting gates are one line from the set piece's first metre to its last gate: a rider who left it
      // between gates popped there, and flew the next three.)
      if (p.style === 'sit') return p.gates.length && z < p.gates[p.gates.length - 1].z + 1 ? this.slalomOff(p, z) : null;
      const g = p.gates.find((q) => q.z > z + 1);
      if (!g || g.z - z > 50) return null;
      // (A gate that swings: where its sway will have it when the sled gets there.)
      if (g.amp > 0) return gateX(g, sim.tick - mo.t0 + ((g.z - z) / Math.max(10, sim.s.vz)) * TICK_RATE) - this.lines.safeX(g.z);
      return this.slalomOff(p, z);
    }
    if (p.verb === 'rings' && p.rings.length > 0 && z < p.rings[0].z - 14) return p.rings[0].x - this.lines.safeX(p.rings[0].z);
    // Round 7's verbs that are a line to ride: the guide light's wake, the dark lamps' row (close beside the
    // next one, between it and the line), the wall the bells hang along, the brazier that feeds a low flame.
    if (p.verb === 'follow' && p.path) return pathOff(p.path, z);
    if (p.verb === 'kindle') {
      const l = p.lamps.find((q, i) => q.dark && !(mo.mask & (1 << i)) && q.z > z + 4);
      if (!l || l.z - z > 70) return null;
      return l.x - l.side * 2.3 - this.lines.safeX(l.z);
    }
    if (p.verb === 'shatter') {
      const t = p.targets[mo.at];
      return t && t.hw < 4 ? t.x - this.lines.safeX(t.z) : null;
    }
    if (p.verb === 'carry' && p.relight && !(mo.mask & 1) && p.relight.z > z + 2) {
      // A low flame: the brazier stands just past the last leap's landing, so the lip is taken on its side (as
      // far over as the lip's own lamps allow) and the sled comes down in line with it.
      const off = p.relight.x - this.lines.safeX(p.relight.z);
      const lip = this.course.leaps.filter((l) => l.z > p.z0 && l.z < p.relight!.z).pop();
      if (lip && z < lip.z && lip.z - z < 160) return (off > 0 ? 1 : -1) * Math.min(3, Math.abs(off));
      if (p.relight.z - z < sim.s.speed * 2.5) return off;
    }
    return null;
  }

  /** Whether this rider tries the set piece it is in (its own, from its key: momentOff's rule). */
  private triesMoment(): MomentPlay | null {
    const mo = this.sim.mo;
    if (!mo || mo.active < 0) return null;
    const p = this.sim.plays[mo.active];
    return this.tries(p) ? p : null;
  }

  /** The next set piece, when this rider tries it and it is a second or two away. */
  private triesNext(): MomentPlay | null {
    const sim = this.sim;
    const mo = sim.mo;
    if (!mo || mo.active >= 0) return null;
    const p = sim.plays[mo.next];
    if (!p || p.z0 - sim.s.z > sim.s.speed * 2) return null;
    return this.tries(p) ? p : null;
  }

  /** A pop a set piece asks for, decided whole: crouch at `P`, spring at `R`. Nothing else is tried meanwhile
   *  (ride() waits for the release), and the steering is left where it is, as for any pop. */
  private commitPop(P: number, R: number): void {
    this.act.set(P, 1);
    this.act.set(R, 0);
    this.pressAt = P;
    this.releasedAt = R;
    this.centerAt = R;
    this.mode = 'ride';
    this.purpose = 'pop';
  }

  /** The brazier a low flame is being carried to (the air's nudge aims the landing in line with it), or null. */
  private feed: { x: number; z: number } | null = null;

  /** Whether this rider tries a set piece: its own, from its key, likelier the more skilled (a racer tries all). */
  private tries(p: MomentPlay): boolean {
    return this.t.setPieces === 1 || hashFloat(this.key, 0x5e7 + p.index) <= 0.3 + 0.6 * this.t.skill;
  }

  private momentTry = -1;
  private onLine = false;
  private momentLine = false;

  /** Round 7's verbs that are the action button's or the lantern's, tried as a person who knows them would:
   *  a pop timed under each bell, pops of its own down Old Town, a pop off the lip for the high rings, one
   *  long drift on the lake, and a dash into a race, a surge or the carry. True when it pressed something. */
  private momentRide(now: number, apply: number, zp: number): boolean {
    const p = this.triesMoment() ?? this.triesNext();
    if (!p) return false;
    const sim = this.sim;
    const s = sim.s;
    const mo = sim.mo;
    const v = Math.max(10, s.vz);
    // (A set piece about to begin: its first bell hangs 50 m in, and the spring for it starts before the street.)
    const at = mo.active === p.index ? mo.at : 0;
    if (mo.active !== p.index && p.verb !== 'shatter') return false;
    const once = this.momentTry !== p.index * 16 + at;
    switch (p.verb) {
      case 'shatter': {
        const t = p.targets[at];
        if (!t || !once) return false;
        // Spring so the sled is up at the bell's height as it passes under; down late from the last flight,
        // crouch at once and spring as soon as the crouch is a pop. The spring is committed as the crouch
        // begins (a bell does not wait for a second look, and one flight often carries under two).
        const rel = t.z - v * (0.5 + 0.1 * t.h);
        if (zp < rel - v * 0.7 || s.z > t.z - v * 0.42) return false;
        this.momentTry = p.index * 16 + at;
        this.commitPop(apply, Math.max(apply + 12, this.tickAtZ(now, rel) + Math.round(gauss(this.rng) * this.t.timingSd * 0.5)));
        return true;
      }
      case 'steps': {
        if (p.style !== 'hops' || p.z1 - zp < v * 2.4 || now < this.momentWait) return false;
        // Pop as soon as the sled is down and the street ahead is open to land on: three flights of a hundred
        // metres have to fit in the street, so the first leaves at its top and none waits for a perfect one.
        const R = apply + this.rng.int(13, 17);
        const f = this.popFlight(now, R, apply);
        if (f.clearance < 0.3 || this.lines.edgeExcess(f.x, f.z) > -1.2 || f.z > p.z1 - 4) {
          this.momentWait = now + 8;
          return false;
        }
        this.momentWait = now + 30;
        this.commitPop(apply, R);
        return true;
      }
      case 'rings': {
        if (p.variantKey !== 'high' || !p.rings.length || !once) return false;
        const lip = p.rings[0].z - 13.6;
        if (zp < lip - v * 0.7 || zp > lip - 4) return false;
        this.momentTry = p.index * 16 + mo.at;
        this.press(apply, 'crouch', 'kicker');
        this.releaseAt = this.tickAtZ(now, lip - 1);
        return true;
      }
      case 'slide': {
        if (!once || !s.onIce || p.z1 - zp < v * 3 || s.speed < 14) return false;
        this.momentTry = p.index * 16 + mo.at;
        // Toward where the lake's middle will be: the side with the most ice to cross.
        const dir = s.x < this.course.centerX(s.z + 60) ? 1 : -1;
        const cmd = this.startDrift(now, apply, dir, true);
        this.driftTier = 3;
        this.driftUntil = apply + (p.both ? p.each : p.need) + 12;
        this.slideUntil = this.driftUntil;
        this.steer.set(apply, level(cmd));
        return true;
      }
      case 'race':
      case 'carry':
        if (now - mo.t0 < 50) this.momentDash(now);
        return false;
      case 'surge':
        if (p.lip - s.z < s.speed * 1.2 && p.lip - s.z > s.speed * 0.35) this.momentDash(now);
        return false;
      default:
        return false;
    }
  }

  private momentWait = 0;
  private slideUntil = -1;

  /** A dash a set piece asks for: any full lantern, from the line. */
  private momentDash(now: number): void {
    const s = this.sim.s;
    if (s.dash > 0 || now < this.spiritUntil + 40 || !s.grounded || s.tumble > 0 || s.lantern < LANTERN) return;
    if (Math.abs(s.x - this.lines.safeX(s.z)) < 5) this.spiritUntil = now + 3;
  }

  private updateWander(now: number): void {
    const mOff = this.momentOff();
    const verb = mOff !== null ? this.sim.plays[this.sim.mo.active]?.verb : undefined;
    this.inGates = verb === 'gates';
    const piece = this.inGates ? this.sim.plays[this.sim.mo.active] : null;
    this.slalom = piece && piece.style === 'sit' ? piece : null;
    this.wake = verb === 'follow' ? this.sim.plays[this.sim.mo.active].path : null;
    // (A line to ride wants the runners on the snow: no pops for the fun of it meanwhile.)
    // (And a low flame not yet fed is carried on the snow to its brazier: no pop flies past it.)
    const feeding = verb === 'carry' && !(this.sim.mo.mask & 1);
    this.onLine = verb === 'gates' || verb === 'follow' || verb === 'kindle' || feeding;
    this.feed = feeding ? (this.sim.plays[this.sim.mo.active].relight ?? null) : null;
    this.momentLine = mOff !== null;
    if (mOff !== null) {
      // A gate a beat away needs the line moved now, not a third of a metre a thought, and no detour after a
      // light takes the rider off the gates' line.
      if (this.inGates) this.goal = null;
      this.offTarget = mOff;
      const d = mOff - this.off;
      this.off += d > 1.4 ? 1.4 : d < -1.4 ? -1.4 : d;
      this.offRetarget = now + 30;
      return;
    }
    if (now >= this.offRetarget) {
      this.offTarget = this.rng.signed() * this.t.wander * clamp(22 / Math.max(1, this.sim.s.speed), 0.4, 1);
      this.offRetarget = now + this.rng.int(120, 300);
    }
    const d = this.offTarget - this.off;
    this.off += d > 0.35 ? 0.35 : d < -0.35 ? -0.35 : d;
  }

  private planPath(now: number, xp: number, zp: number, speed: number): void {
    const t = this.t;
    this.px0 = xp;
    this.pz0 = zp;
    // (A slalom is joined at once: eased onto over a second, the line aimed at is a gate out of step.)
    this.join = this.slalom ? 4 : Math.max(10, speed * 0.9);
    const zEnd = zp + speed * 2.2 + 10;
    const g = this.goal;
    if (g) {
      const passed = zp > g.zOut + 1;
      if (passed || this.pathClear(g, zEnd) < t.margin * 0.5 - (g.squeeze ? 1.2 : 0)) this.goal = null;
    }
    // Faster means less time to correct, so everything wants a little more room.
    const margin = t.margin + Math.max(0, speed - 22) * 0.04;
    // (A set piece's own line is laid to be ridden close: beside a lamp, through a gate by a tube's wall. Round
    // 6's riders asked it for a wanderer's room, never got it, and threaded no gate in any pool.)
    if (!this.goal && this.pathClear(null, zEnd) < (this.momentLine ? 0.25 : margin + (this.off !== 0 ? 0.5 : 0))) {
      // The wandering line is blocked: fall back to the safe line, or dodge around whatever is there.
      let best = -Infinity;
      let bestOff = 0;
      for (const o of [0, this.off * 0.5, -2.2, 2.2, -4.4, 4.4]) {
        this.off = o;
        const c = this.pathClear(null, zEnd) - (o < 0 ? -o : o) * 0.04;
        if (c > best) {
          best = c;
          bestOff = o;
        }
        if (o === 0 && c >= margin) break;
      }
      this.off = bestOff;
      this.offTarget = bestOff;
      this.offRetarget = now + 90;
    }
    if (!this.goal && !this.cooling && !this.inGates && !this.onLine && this.thinks % 2 === 0) this.lookForGoals(zp, speed, zEnd);
  }

  private lookForGoals(zp: number, speed: number, zEnd: number): void {
    const sim = this.sim;
    const c = this.course;
    const t = this.t;
    const zMin = zp + Math.max(8, speed * 0.8);
    const zMax = zp + Math.min(t.vision, 62);
    let best: Goal | null = null;
    let bestU = 0.12;
    let found = 0;
    const squeeze = this.rng.chance(t.squeeze);
    // Detours leave the guaranteed lane, so they want more room than the line itself.
    const need = squeeze ? t.margin - 1.2 : t.margin + 0.4;
    const consider = (u: number, kind: GoalKind, zIn: number, xIn: number, zOut: number, xOut: number, ret: number, ramp: Ramp | null, skip: number, pop: boolean) => {
      if (u <= bestU) return;
      const g: Goal = { kind, zIn, xIn, zOut, xOut, ret, ramp, skip, pop, squeeze };
      if (this.pathClear(g, Math.max(zEnd, zOut + 8)) < need) return;
      best = g;
      bestU = u;
      found++;
    };
    const k0 = Math.floor(zMin / CHUNK_LEN);
    const k1 = Math.floor((zp + Math.min(t.vision, 95)) / CHUNK_LEN);
    for (let k = k0; k <= k1; k++) {
      for (const gf of c.chunk(k).lights) {
        if (gf.z < zMin || gf.z > zMax || gf.hover > 2 || sim.collected.has(gf.id)) continue;
        const dev = Math.abs(gf.x - this.lineX(gf.z));
        if (dev < 1 || dev > 9) continue;
        // Lights are the lantern's fuel: a great one is worth a detour, a spark a small one.
        consider(t.greed * (gf.value > 1 ? 2.8 : 0.7) - dev * 0.05, 'light', gf.z, gf.x, gf.z, gf.x, speed * 1.1, null, -1, false);
      }
      for (const r of c.zones(k).ramps) {
        if (r.z < zp + speed * 1.1 || r.z > zp + Math.min(t.vision, 95)) continue;
        const u = t.ambition * 2.2 - Math.abs(r.x - this.lineX(r.z)) * 0.04;
        if (u <= bestU || !this.lipClear(r, speed)) continue;
        const pop = this.rng.chance(0.25 + 0.75 * t.ambition * t.skill);
        // Line up early enough to come in straight; the last stretch before a kicker is kept clear.
        for (const lead of [Math.max(6, speed * 0.55), 14, 24]) {
          if (r.z - lead < zp + 6) continue;
          const before = found;
          consider(u, 'kicker', r.z - lead, r.x, r.z + r.len, r.x, 30, r, -1, pop);
          if (found > before) break;
        }
      }
    }
    for (const o of this.scene.items) {
      const oz = (o.z + o.z2) * 0.5;
      if (oz < zMin || oz > zMax) continue;
      const ox = (o.x + o.x2) * 0.5;
      const dev = Math.abs(ox - this.lineX(oz));
      if (dev > (o.id === YETI ? 10 : 6)) continue;
      if (o.soft) {
        consider(t.greed * 0.9 * (1.25 - t.skill) - dev * 0.05, 'smash', oz, ox, oz, ox, speed, null, -1, false);
      } else if (o.h <= 1.5 && o.id >= 0 && hashFloat(this.key, o.id, 2) < t.hopRate) {
        // Pop over a low rock or log, if the landing beyond it is clean.
        const u = t.ambition * 1.4 - dev * 0.08;
        if (u <= bestU) continue;
        const dir = this.lines.dir(oz);
        if (!this.flightClear(this.popFrom(ox, oz - speed * 0.3, speed * dsin(dir), speed * dcos(dir), 30, t.margin))) continue;
        consider(u, 'hop', oz - speed * 0.7, ox, oz + 2, ox, speed, null, o.id, true);
      } else if (o.id === YETI && t.skill > 0.5) {
        // Hop the yeti: meet it where it will be and be in the air as it passes underneath.
        const u = t.ambition * t.skill * 3 - dev * 0.05;
        if (u <= bestU) continue;
        const dir = this.lines.dir(oz);
        if (!this.flightClear(this.popFrom(ox, oz - speed * 0.3, speed * dsin(dir), speed * dcos(dir), 30, t.margin), 6)) continue;
        consider(u, 'hop', oz - speed * 0.7, ox, oz + 2, ox, speed, null, YETI, true);
      }
    }
    if (best) this.goal = best;
  }

  /** Whether riding straight off this kicker's lip lands somewhere open. */
  private lipClear(r: Ramp, speed: number): boolean {
    const c = this.course;
    const lz = r.z + r.len - 0.05;
    const y = c.ground(r.x, lz);
    const vy = (y - c.ground(r.x, lz - speed * DT)) / DT;
    const f = predictFlight(c, this.scene, this.sim.gravity, r.x, y, lz, 0, vy, speed);
    return f.clearance >= this.t.margin && this.lines.edgeExcess(f.x, f.z) < -2.5;
  }

  // ------------------------------------------------------------------ ground

  private groundThink(now: number): void {
    const sim = this.sim;
    const s = sim.s;
    const t = this.t;
    // Just after touchdown the rider was already watching the line, so the first correction is quick.
    const delay = this.reflex ? Math.max(MOTOR, Math.round(t.reaction * 0.4)) : t.reaction;
    this.reflex = false;
    const apply = now + delay;
    const lead = (delay * t.anticipate) / TICK_RATE;
    const xp = s.x + s.vx * lead;
    const zp = s.z + s.vz * lead;
    const tr = turnRate(s.speed) * sim.sled.turn * (s.drifting ? 1.5 : s.action ? 1.12 : 1);
    const hp = s.heading + s.steer * tr * lead;

    if (s.drifting && this.mode !== 'drift') {
      // The sim started a drift (hard steering while crouched): ride it out as one.
      this.mode = 'drift';
      this.purpose = 'drift';
      this.driftSide = s.driftDir;
      this.driftSeen = true;
      this.driftWait = false;
      this.driftTier = 1;
      this.driftUntil = now + 40;
      this.pressAt = s.lastPressTick;
    }
    this.perceive();
    const combo = sim.combo;
    if (!combo.active) this.cooling = false;
    else if (combo.pending * combo.multiplier > t.bankAt) this.cooling = true;
    this.updateWander(now);
    this.planPath(now, xp, zp, s.speed);

    // While a pop release is on its way the steering stays put, so the takeoff is not a spin.
    const releasing = this.releasedAt >= now;
    // Lining up a pop: aim at where the line will be at touchdown, since the flight is straight.
    // Rolling off a drop is a flight too, so line it up the same way.
    const flying = (this.mode === 'crouch' && this.purpose !== 'kicker') || this.dropAhead(s.z, s.speed * 1.3);
    // Moguls keep the runners off the snow, so steering has to be done before them: aim through
    // the whole field at the line where it comes out.
    const aim = Math.max(flying ? s.speed * 2 : 0, this.mogulExit(s.z, s.speed) - zp);
    let cmd = this.mode === 'drift' ? this.driftSteer(xp, zp) : this.followSteer(xp, zp, hp, tr, aim);
    const goal = this.goal;
    cmd = this.groundActions(now, apply, zp, cmd);
    if (goal && !this.goal) {
      // Gave up on a goal (say a hop with nowhere to land): find a way round right now.
      this.planPath(now, xp, zp, s.speed);
      cmd = this.followSteer(xp, zp, hp, tr, 0);
    }
    let pulse = false;
    if (this.mode !== 'drift') {
      const dodge = this.swerve();
      this.maybeDash(now, dodge !== 0);
      if (dodge !== 0 && now < this.spiritUntil) {
        // Riding through it as a spirit: hold the line.
      } else if (dodge !== 0) {
        pulse = true;
        cmd = dodge * lerp(0.6, 1, t.skill);
        if (this.mode === 'crouch' && now >= this.pressAt) {
          // Steering hard while crouched would start a drift: jump it if that lands clean,
          // otherwise dodge as hard as the crouch allows.
          cmd = dodge * 0.25;
          if (this.popsAt(now, apply) && this.flightClear(this.popFlight(now, apply, this.pressAt, t.margin))) this.release(apply);
        }
      }
    }
    if (releasing) return;
    this.setSteer(apply, cmd, this.mode === 'drift' || pulse || this.slalom !== null);
    // A swerve is a short jab, not a held turn.
    if (pulse) this.steer.set(apply + 12, 4);
    // Entering a drift takes a hard steer; once it catches, open the arc right out.
    if (this.mode === 'drift' && !this.driftSeen && this.driftEntry) {
      this.driftEntry = false;
      this.steer.set(apply + 6, level(-this.driftSide));
    }
    if (this.centerAt >= apply) this.steer.set(this.centerAt, 4);
    this.centerAt = -1;
  }

  /**
   * The reflex everyone has: if the sled's current momentum runs into something within the next
   * moment, steer hard toward whichever side is open (preferring the line), and replan from there.
   */
  private swerve(): number {
    const s = this.sim.s;
    const sc = this.scene;
    const L = this.lines;
    let hit = -1;
    for (let k = 2; k <= 6; k++) {
      const tt = k * 0.1;
      if (sc.clearance(s.x + s.vx * tt, s.z + s.vz * tt, -Infinity) < 0.25) {
        hit = tt;
        break;
      }
    }
    if (hit < 0) return 0;
    const x = s.x + s.vx * hit;
    const z = s.z + s.vz * hit;
    const toPath = this.pathX(z) - x;
    const room = (d: number) => {
      const xx = x + d * 1.8;
      return Math.min(sc.clearance(xx, z, -Infinity), -L.edgeExcess(xx, z) - 1) + (d * toPath > 0 ? 1 : 0);
    };
    this.goal = null;
    return room(1) > room(-1) ? 1 : -1;
  }

  private followSteer(xp: number, zp: number, hp: number, tr: number, aim: number): number {
    const e = wrapAngle(this.desired(xp, zp, aim) - hp);
    // (Threading a slalom the hands are quick: a rider who tries it has ridden it before.)
    const tau = this.slalom ? Math.min(this.t.tau, 0.22) : this.t.tau;
    return clamp(e / (tr * tau) + gauss(this.rng) * this.t.steerNoise, -1, 1);
  }

  /**
   * While drifting the sim locks the turn direction; steering only sets how tight the arc is, from
   * 0.2 (full counter-steer) to 1 (full steer into the drift).
   */
  private driftSteer(xp: number, zp: number): number {
    const s = this.sim.s;
    const d = this.driftSide;
    if (!s.drifting) return d * 0.75;
    // Waiting for somewhere to land the pop: keep the arc as wide as it goes.
    if (this.driftWait) return -d;
    // Hold just enough slip to keep charging (the sim only charges above about 0.18): a wide arc
    // charges for longest. Tighten it only when the line turns away sharply.
    const slip = s.slip < 0 ? -s.slip : s.slip;
    const e = d * wrapAngle(this.desired(xp, zp) - s.heading);
    const u = clamp(0.3 + 1.5 * (0.26 - slip) + 1.5 * Math.max(0, e - 0.35), 0.2, 1);
    return clamp(d * ((u - 0.2) / 0.4 - 1), -1, 1);
  }

  /** Body yaw rate while drifting, mirroring the sim's locked-direction rule. */
  private driftYawRate(steer: number): number {
    const s = this.sim.s;
    const d = s.driftDir;
    return d * (0.2 + 0.8 * (steer * d + 1) * 0.5) * turnRate(s.speed) * this.sim.sled.turn * 1.5;
  }

  /** Quantize to a steer level, keeping the current one unless the change is worth a keypress. */
  private setSteer(at: number, cmd: number, exact: boolean): void {
    const cur = this.steer.last;
    const f = 4 + clamp(cmd, -1, 1) * 4;
    if (!exact && Math.abs(f - cur) < 0.75) return;
    const lv = level(cmd);
    if (lv !== cur) this.steer.set(at, lv);
  }

  /** Is the snow ahead open enough to weave through for `secs` seconds? */
  private openAhead(zp: number, speed: number, secs: number): boolean {
    for (let z = zp + 3; z < zp + speed * secs; z += 3) {
      const x = this.pathX(z);
      if (this.lines.edgeExcess(x, z) > -5) return false;
      for (let dx = -2.5; dx <= 2.5; dx += 2.5) if (this.scene.clearance(x + dx, z, -Infinity) < 0.6) return false;
    }
    return true;
  }

  /** Is the lip of a drop within `dist` metres ahead? */
  private dropAhead(z: number, dist: number): boolean {
    const k0 = Math.max(0, Math.floor(z / CHUNK_LEN) - 1);
    const k1 = Math.floor((z + dist) / CHUNK_LEN);
    for (let k = k0; k <= k1; k++) {
      for (const d of this.course.zones(k).drops) if (d.z > z && d.z < z + dist) return true;
    }
    return false;
  }

  /** End of the mogul field the sled is in or about to enter (within a second), or 0. */
  private mogulExit(z: number, speed: number): number {
    const k0 = Math.max(0, Math.floor(z / CHUNK_LEN) - 1);
    const k1 = Math.floor((z + speed) / CHUNK_LEN);
    for (let k = k0; k <= k1; k++) {
      for (const m of this.course.zones(k).moguls) if (m.z1 > z && m.z0 < z + speed) return m.z1 + 5;
    }
    return 0;
  }

  /** Start of a mogul field between `from` and `to` metres ahead, or 0. */
  private mogulsAhead(z: number, from: number, to: number): number {
    const k0 = Math.max(0, Math.floor((z + from) / CHUNK_LEN) - 1);
    const k1 = Math.floor((z + to) / CHUNK_LEN);
    for (let k = k0; k <= k1; k++) {
      for (const m of this.course.zones(k).moguls) if (m.z0 > z + from && m.z0 < z + to) return m.z0;
    }
    return 0;
  }

  /** Whether letting go at tick R pops: a press from the snow, or one held there a while. */
  private popsAt(now: number, R: number): boolean {
    const s = this.sim.s;
    return s.pressStartedGrounded || s.groundHold + (R - now) > 10;
  }

  private tickAtZ(now: number, z: number): number {
    const s = this.sim.s;
    return now + Math.round(((z - s.z) / Math.max(1, s.vz)) * TICK_RATE);
  }

  private press(at: number, mode: Mode, purpose: Purpose): void {
    this.act.set(at, 1);
    this.pressAt = at;
    this.mode = mode;
    this.purpose = purpose;
  }

  private release(at: number): void {
    this.act.set(at, 0);
    this.releasedAt = at;
    this.centerAt = at;
    this.mode = 'ride';
  }

  private groundActions(now: number, apply: number, zp: number, cmd: number): number {
    switch (this.mode) {
      case 'land':
        return this.onGroundAfterLanding(now, apply, zp, cmd);
      case 'ride':
        return this.ride(now, apply, zp, cmd);
      case 'crouch':
        return this.crouch(now, apply, cmd);
      case 'drift':
        return this.drift(now, apply, zp, cmd);
      default:
        return cmd;
    }
  }

  private get avalanche(): boolean {
    const sim = this.sim;
    return sim.config.chaos.event === ChaosEvent.Avalanche && sim.dyn.avalanche.phase === 2;
  }

  /** Just landed, still holding the stomp. Letting go quickly does not pop; holding on (into a
   *  drift, or for too long) turns it into a crouch that pops when released. */
  private onGroundAfterLanding(now: number, apply: number, zp: number, cmd: number): number {
    const s = this.sim.s;
    const t = this.t;
    this.mode = 'ride';
    if (this.act.last !== 1) return cmd;
    const piece = this.triesMoment();
    if (piece && this.act.value === 1 && (piece.verb === 'shatter' || (piece.verb === 'steps' && piece.style === 'hops'))) {
      // Down from a flight with the stomp still held, and the set piece wants another pop: the hold becomes the
      // crouch (it is a pop once it has been held eleven ticks on the snow), sprung under the next bell, or
      // as soon as it can be down Old Town.
      const v = Math.max(10, s.vz);
      const bell = piece.verb === 'shatter' ? piece.targets[this.sim.mo.at] : undefined;
      const R0 = now + 12 - Math.min(11, s.groundHold);
      if (bell && s.z < bell.z - v * 0.42) {
        this.momentTry = piece.index * 16 + this.sim.mo.at;
        this.commitPop(s.lastPressTick, Math.max(R0, this.tickAtZ(now, bell.z - v * (0.5 + 0.1 * bell.h))));
        return cmd;
      }
      if (!bell && piece.verb === 'steps' && piece.z1 - zp > v * 2.4) {
        const f = this.popFlight(now, R0 + 2, s.lastPressTick);
        if (f.clearance >= 0.3 && this.lines.edgeExcess(f.x, f.z) <= -1.2 && f.z <= piece.z1 - 4) {
          this.momentWait = now + 30;
          this.commitPop(s.lastPressTick, R0 + 2);
          return cmd;
        }
      }
    }
    if (this.act.value === 1 && !this.cooling && !this.avalanche && !this.goal && s.speed >= 12 && this.rng.chance(t.driftRate * 3)) {
      // Drift straight out of the landing when the line needs a turn anyway.
      const e = wrapAngle(this.desired(this.px0, zp) - s.velHeading);
      const ae = e < 0 ? -e : e;
      if (ae > 0.12 && ae < 0.3 && this.openAhead(zp, s.speed, 2) && this.driftEndClear(zp)) return this.startDrift(now, apply, e > 0 ? 1 : -1, false);
    }
    // Let go before the hold turns into a pop.
    if (!this.popsAt(now, now + MOTOR)) this.act.set(now + MOTOR, 0);
    else {
      this.mode = 'crouch';
      this.purpose = 'pop';
      this.pressAt = s.lastPressTick;
      this.releaseAt = apply;
    }
    return cmd;
  }

  private ride(now: number, apply: number, zp: number, cmd: number): number {
    const sim = this.sim;
    const s = sim.s;
    const t = this.t;
    const rng = this.rng;
    if (this.act.last === 1 || now < this.releasedAt + 4) return cmd;
    // (A set piece is played whatever the combo holds: riding calm to bank it is for open snow.)
    if (this.momentRide(now, apply, zp)) return cmd;
    if (this.cooling) return cmd;
    // (Nor a pop for the fun of it on the way into a set piece that wants the runners on the snow.)
    if (this.onLine || (this.sim.mo.active < 0 && this.holdsDash() && this.wantsSnow())) return cmd;
    const g = this.goal;
    if (g && g.kind === 'kicker' && g.ramp) {
      // Crouch in and pop off the top of the face.
      const r = g.ramp;
      if (g.pop && zp > r.z - s.speed * 0.75) {
        this.press(apply, 'crouch', 'kicker');
        this.releaseAt = this.tickAtZ(now, r.z + r.len * 0.82) + Math.round(gauss(rng) * t.timingSd * 1.5);
      }
      return cmd;
    }
    if (g && g.kind === 'hop') {
      if (zp > g.zIn - s.speed * 0.3) {
        this.press(apply, 'crouch', 'hop');
        this.releaseAt = this.tickAtZ(now, g.zOut - 2 - s.speed * 0.3) + Math.round(gauss(rng) * t.timingSd);
      }
      return cmd;
    }
    if (s.speed < 11 || s.wobble > 0) return cmd;
    // A mogul field bucks the sled about; good riders pop and fly over the start of it.
    const mz = this.mogulsAhead(s.z, s.speed * 0.45, s.speed * 1.3);
    if (mz > 0 && this.mogulTry !== mz) {
      this.mogulTry = mz;
      if (rng.chance(t.skill * 0.9) && this.flightClear(this.popFlight(now, this.tickAtZ(now, mz - 1), apply, t.margin))) {
        this.press(apply, 'crouch', 'pop');
        this.releaseAt = Math.max(apply + 12, this.tickAtZ(now, mz - 1));
        return cmd;
      }
    }
    const avalanche = this.avalanche;
    // Keep a combo alive by popping again before it banks, or just pop for the fun of it.
    const combo = sim.combo;
    const chainNow = combo.active && combo.timer < 70 && rng.chance(t.chain);
    const popRate = avalanche ? t.popRate * 1.5 + 0.1 : t.popRate;
    // A racer tucks whenever the line runs straight, and holds it: the pop it ends in comes when the line bends.
    const tucking = !chainNow && Math.abs(cmd) < 0.2 && rng.chance((t.tuck * 2.5 * this.interval) / TICK_RATE);
    if (tucking || chainNow || rng.chance((popRate * this.interval) / TICK_RATE)) {
      // Only crouch for a pop that will land clean: once crouched, letting go means popping.
      const R = apply + (tucking ? rng.int(90, 210) : rng.int(14, 36));
      // (A tuck is judged by the pop it could end in half a second on: where it will really end is looked at then.)
      if (this.flightClear(this.popFlight(now, tucking ? apply + 30 : R, apply, t.margin))) {
        this.press(apply, 'crouch', 'pop');
        this.releaseAt = R;
      }
      return cmd;
    }
    if (!avalanche && !g && s.speed >= 14) {
      const e = wrapAngle(this.desired(this.px0, zp) - s.velHeading);
      if (this.driftSetup !== 0 && now < this.driftSetupUntil) {
        // Swinging out for a drift: once out wide and heading back, drift back across.
        const side = this.driftSetup;
        if (this.off * side < -3.1) {
          this.offTarget = side * 0.6;
          this.offRetarget = now + 120;
        }
        if (e * side > 0.12 && e * side < 0.34 && this.openAhead(zp, s.speed, 2.2) && this.driftEndClear(zp)) {
          this.driftSetup = 0;
          return this.startDrift(now, apply, side, true);
        }
      } else if (rng.chance((t.driftRate * 0.3 * this.interval) / TICK_RATE) && this.openAhead(zp, s.speed, 3)) {
        const ae = e < 0 ? -e : e;
        if (ae > 0.15 && ae < 0.32 && this.driftEndClear(zp)) return this.startDrift(now, apply, e > 0 ? 1 : -1, true);
        this.driftSetup = t.favDir;
        this.driftSetupUntil = now + 180;
        this.offTarget = -t.favDir * 3.5;
        this.offRetarget = now + 180;
      }
    }
    return cmd;
  }

  private crouch(now: number, apply: number, cmd: number): number {
    // Crouched steering stays under the drift threshold (and tucks for speed when straight).
    const tuck = clamp(cmd, -0.25, 0.25);
    if (now < this.pressAt) return tuck;
    const needTurn = cmd > 0.4 || cmd < -0.4;
    if (this.releaseAt > apply + this.interval * 0.5 && !needTurn) return tuck;
    const R = needTurn ? apply : Math.max(apply, this.releaseAt);
    if (!this.popsAt(now, R)) {
      this.release(R);
      return needTurn ? cmd : tuck;
    }
    const f = this.popFlight(now, R, this.pressAt, this.purpose === 'kicker' ? 0.2 : this.t.margin);
    if (this.flightClear(f) || (this.purpose === 'kicker' && f.clearance > 0.2)) {
      this.release(R);
      return 0;
    }
    // Nowhere clean to land: stay tucked and look again in a moment, but a crouch that has gone
    // on too long (it limits the steering) is let go as soon as the landing is at least open.
    if (now > this.pressAt + 75 && this.survivable(f)) {
      this.release(R);
      return 0;
    }
    this.releaseAt = Math.max(this.releaseAt, apply + 6);
    if (this.purpose === 'hop') this.goal = null;
    return tuck;
  }

  private drift(now: number, apply: number, zp: number, cmd: number): number {
    const s = this.sim.s;
    const t = this.t;
    if (now < this.pressAt + 3) return cmd;
    if (s.drifting) this.driftSeen = true;
    const pops = this.popsAt(now, apply);
    if (!this.driftSeen && now > this.pressAt + 30) {
      // The drift never caught: carry on as an ordinary crouch.
      this.mode = 'crouch';
      this.purpose = 'pop';
      this.releaseAt = apply;
      return clamp(cmd, -0.25, 0.25);
    }
    if (!this.driftSeen) return cmd;
    // (A slide a set piece asks for is held, the arc opened right out, for as long as it asks and the ice lasts.)
    if (now < this.slideUntil && s.drifting && s.onIce) return -this.driftSide;
    // Where the drift will have swung to by the time a release decided now (or at the next look)
    // takes effect: the current steer acts until this decision lands, then the commanded one.
    // Without a pop the velocity soon follows the nose, so the nose is what counts; a pop flies
    // off along the velocity, which lags behind the nose.
    const lead = (t.reaction + this.interval * 0.5) / TICK_RATE;
    const yaw = (this.driftYawRate(s.steer) * t.reaction + this.driftYawRate(cmd) * this.interval * 0.5) / TICK_RATE;
    const aim = pops ? s.velHeading + 1.7 * s.slip * lead : s.heading + yaw;
    const over = this.driftSide * wrapAngle(aim - this.desired(this.px0, zp));
    const charged = s.driftTier >= this.driftTier || (s.driftTier > 0 && apply >= this.driftUntil);
    const across = wrapAngle(aim - this.lines.dir(s.z));
    const astray = !s.drifting || over > 0.2 || across > 0.4 || across < -0.4 || Math.abs(this.pathX(s.z) - s.x) > 5 || !this.openAhead(zp, s.speed, 1);
    const done = over > -0.05 && (s.driftTier > 0 || over > 0.12);
    if (astray || done || charged) {
      if (!pops) {
        this.release(apply);
        return 0;
      }
      // A committed drift has to be let go eventually, even when the pop lands somewhere poor.
      const f = this.popFlight(now, apply, this.pressAt);
      const forced = astray && (this.survivable(f) || now >= this.driftWaitUntil);
      // A drift ends off to one side of the line, so its pop may land a little wider than usual.
      if (this.flightClear(f, 4.5) || forced) {
        this.driftWait = false;
        this.release(apply);
        return 0;
      }
      if (!this.driftWait) this.driftWaitUntil = now + 12;
      this.driftWait = true;
      return -this.driftSide;
    }
    return cmd;
  }

  /** The pop a drift will end in: from about half a second ahead, flying along the planned line. */
  private driftEndClear(zp: number): boolean {
    const s = this.sim.s;
    const z = zp + s.speed * 0.6;
    const x = this.pathX(z);
    const dir = this.lines.dir(z);
    return this.flightClear(this.popFrom(x, z, s.speed * dsin(dir), s.speed * dcos(dir), 40, this.t.margin), 4.5);
  }

  private startDrift(now: number, apply: number, dir: number, press: boolean): number {
    const t = this.t;
    if (press) this.press(apply, 'drift', 'drift');
    else {
      this.mode = 'drift';
      this.purpose = 'drift';
      this.pressAt = now;
    }
    this.driftSide = dir;
    this.driftEntry = true;
    this.driftWait = false;
    this.driftTier = t.ambition * t.skill > 0.5 && this.rng.chance(0.4) ? 2 : 1;
    this.driftUntil = apply + Math.round(TICK_RATE * (0.9 + this.driftTier));
    this.driftSeen = false;
    return dir * 0.75;
  }

  // ------------------------------------------------------------------ pops

  /** The flight a pop released at tick R would take, from the state extrapolated to then. */
  private popFlight(now: number, R: number, pressTick: number, giveUp = -Infinity): Flight {
    const s = this.sim.s;
    const dt = (R - now + 1) * DT;
    return this.popFrom(s.x + s.vx * dt, s.z + s.vz * dt, s.vx, s.vz, R - pressTick, giveUp);
  }

  /** The flight of a pop from (x, z) at velocity (vx, vz) after holding the action for `hold` ticks. */
  private popFrom(x: number, z: number, vx: number, vz: number, hold: number, giveUp = -Infinity): Flight {
    const sim = this.sim;
    const c = this.course;
    const y = c.ground(x, z);
    const vyG = (c.ground(x + vx * DT, z + vz * DT) - y) / DT;
    // The bot's feel for the pop, mirroring the sim's charge rule.
    let v = (3.0 + 2.6 * clamp(hold / 36, 0, 1)) * sim.sled.pop * sim.mood.pop;
    if (this.rampTop(x, z)) v *= 1.3;
    return predictFlight(c, this.scene, sim.gravity, x, y, z, vx, Math.max(vyG, 0) + v, vz, giveUp);
  }

  private rampTop(x: number, z: number): boolean {
    const ci = Math.floor(z / CHUNK_LEN);
    for (let k = ci - 1; k <= ci; k++) {
      if (k < 0) continue;
      for (const r of this.course.zones(k).ramps) {
        const u = (z - r.z) / r.len;
        if (u > 0.6 && u <= 1.05 && Math.abs(x - r.x) < r.w * 0.5 + 0.5) return true;
      }
    }
    return false;
  }

  /** A flight is worth taking if it clears everything and lands close to the line, moving along
   *  it, with open snow either side of the touchdown for tricks that push the landing about. */
  private flightClear(f: Flight, wide = 2.6): boolean {
    const t = this.t;
    const L = this.lines;
    if (f.clearance < t.margin || L.edgeExcess(f.x, f.z) > -3) return false;
    const s = this.sim.s;
    const off = f.x - L.safeX(f.z);
    const drift = off + (s.vx - s.vz * L.dir(f.z)) * 0.6;
    if (off > wide || off < -wide || drift > wide || drift < -wide) return false;
    for (let k = 0; k <= 3; k++) {
      const tt = k * 0.25;
      const x = f.x + s.vx * tt;
      const z = f.z + s.vz * tt;
      if (this.scene.clearance(x, z, -Infinity) < t.margin * 0.7) return false;
      if (this.scene.clearance(x - 2, z, -Infinity) < 0.2 || this.scene.clearance(x + 2, z, -Infinity) < 0.2) return false;
    }
    return true;
  }

  /** A forced release is only taken if it at least lands in open snow inside the corridor. */
  private survivable(f: Flight): boolean {
    const L = this.lines;
    const off = f.x - L.safeX(f.z);
    return f.clearance > 0.15 && off < 6 && off > -6 && L.edgeExcess(f.x, f.z) < -2 && this.scene.clearance(f.x, f.z, -Infinity) > 0.5;
  }

  // ------------------------------------------------------------------ air

  private onTakeoff(now: number): void {
    const t = this.t;
    this.rotP = this.rotParams();
    const planned = now - this.releasedAt <= 3;
    this.mode = 'air';
    this.armed = false;
    this.groundLevel = this.steer.last;
    this.air = {
      planned: false,
      hop: false,
      bias: gauss(this.rng) * t.airErr,
      k: 0,
      f: 0,
      dir: 0,
      cruise: 0,
      S0: 0,
      S1: 0,
      s1Fixed: false,
      F0: 0,
      F1: 0,
      f1Fixed: false,
      stomp: false,
      ST: 0,
      stFixed: false,
      over: 0,
      land: 0,
      stompBias: 0,
      gside: 0,
      G0: 0,
      G1: 0,
      g1Fixed: false,
      gLate: false,
      T0: 0,
      T1: 0,
      sig: false,
    };
    this.nextThink = now + (planned ? Math.max(2, Math.round(t.reaction * 0.35)) : t.reaction);
    // Round 8: off a rail's end or a wall ride, a rider who knows it presses at once for the place's own move (a
    // Lamppost Swing, a Snow Hare), and plans the rest of the flight once the move is done.
    const s = this.sim.s;
    if ((this.wasGrinding || s.wallTicks >= 30) && t.skill >= 0.45 && this.rng.chance(0.3 + 0.5 * t.ambition)) {
      const side = this.rng.chance(0.5) ? 1 : -1;
      this.act.cut(now);
      this.steer.cut(now);
      this.act.set(now + MOTOR, 1);
      this.act.set(now + MOTOR + 4, 0);
      this.steer.set(now + MOTOR, level(side));
      this.steer.set(now + MOTOR + 4, this.groundLevel);
      this.nextThink = now + MOTOR + 26;
    }
  }

  private onLand(now: number, hop: boolean): void {
    const a = this.air;
    this.air = null;
    this.mode = this.act.value === 1 || this.act.last === 1 ? 'land' : 'ride';
    // Uncommitted stomp presses are dropped; committed ones still fire (late stomps happen).
    if (a && a.stomp && !a.stFixed) this.act.cut(now);
    if (hop) {
      // A bump: carry on steering as before, and correct quickly while the runners bite.
      if (a && a.planned) this.steer.set(now + 1, this.groundLevel);
      this.reflex = true;
      this.nextThink = Math.min(this.nextThink, now + 1);
      return;
    }
    this.reflex = true;
    this.nextThink = now + 1;
    if (!this.sim.combo.active) this.lastTrick = -1;
  }

  private rot(): Rot {
    const s = this.sim.s;
    const r = this.rotBuf;
    r.steer = s.steer;
    r.spin = s.spinRate;
    r.yaw = s.airYaw;
    r.pr = s.pitchRate;
    r.pitch = s.airPitch;
    r.hold = s.airHold;
    r.armed = this.armed;
    r.prev = this.act.value === 1;
    const k = this.sim.airHoldKind;
    r.kind = k === 3 || k === 4 ? 5 : k;
    r.len = this.sim.airHoldLen;
    r.grab = s.grab;
    return r;
  }

  private airThink(now: number): void {
    const sim = this.sim;
    const s = sim.s;
    const a = this.air;
    if (!a || a.hop) return;
    const first = !a.planned;
    if (first && this.act.value === 1 && !this.armed && s.airTicks < 7) {
      this.nextThink = now + 7 - s.airTicks;
      return;
    }
    if (first) this.perceive();
    const f = predictFlight(this.course, first ? this.scene : null, sim.gravity, s.x, s.y, s.z, s.vx, s.vy, s.vz);
    const nEst = Math.max(1, Math.round(f.ticks * (1 + a.bias)));
    if (first && s.airTicks + f.ticks <= 16) {
      // Just a bump: keep the line's steering, but out of the spin zone so it lands straight.
      a.planned = true;
      a.hop = true;
      const lim = s.airTicks + f.ticks <= 13 ? 2 : 1;
      this.steer.set(now, clamp(this.groundLevel, 4 - lim, 4 + lim));
      return;
    }
    if (first) {
      this.goal = null;
      this.planTrick(now, nEst, s.airTicks + nEst, f);
      a.planned = true;
    } else this.refineTrick(now, nEst);
    // Air control: steer gently (inside the spin dead zone) so the touchdown lands on the line and
    // runs along it, allowing for the sideways push the rest of the trick will add.
    const r0 = this.rot();
    let best = a.cruise;
    let bestC = this.landingCost(f, this.planNow(now, a.cruise), r0, f.ticks) - 0.3;
    for (let cr = -0.25; cr <= 0.25; cr += 0.25) {
      if (cr === a.cruise) continue;
      const c = this.landingCost(f, this.planNow(now, cr), r0, f.ticks);
      if (c < bestC) {
        bestC = c;
        best = cr;
      }
    }
    a.cruise = best;
    this.writeAirPlan(now);
  }

  /** The current air plan in steps from now (written into a shared buffer). */
  private planNow(now: number, cruise: number): AirPlan {
    const a = this.air;
    const p = this.planBuf;
    p.mag = 1;
    p.cruise = cruise;
    if (!a) {
      p.dir = 0;
      p.s0 = p.s1 = p.f0 = p.f1 = 0;
      p.stomp = -1;
      p.gside = 0;
      return p;
    }
    p.gside = a.gside;
    p.g0 = a.G0 - now;
    p.g1 = a.G1 - now;
    p.t0 = a.T0 - now;
    p.t1 = a.T1 - now;
    p.dir = a.dir;
    p.s0 = a.S0 - now;
    p.s1 = a.dir !== 0 ? a.S1 - now : p.s0;
    p.f0 = a.F0 - now;
    p.f1 = a.f > 0 ? a.F1 - now : p.f0;
    // (A stomp pressed and not landed on within 10 ticks is let go: held on, it would be a flip.)
    p.stomp = a.stomp && now - a.ST <= 10 ? a.ST - now : -1;
    return p;
  }

  /**
   * How badly a plan leaves the touchdown: the sideways miss from the line at landing plus where the
   * sled will be half a second later given its sideways velocity relative to the line.
   */
  private landingCost(f: Flight, plan: AirPlan, r0: Rot, n: number): number {
    const s = this.sim.s;
    const L = this.lines;
    const d = runPlan(r0, plan, n, n, this.rotP, this.res);
    const aim = this.feed && this.feed.z > f.z ? this.feed.x - L.safeX(this.feed.z) : 0;
    const off = f.x + d.lat - L.safeX(f.z) - aim;
    const ahead = off + (s.vx + d.vlat - s.vz * L.dir(f.z)) * 0.5;
    let cost = (off < 0 ? -off : off) + (ahead < 0 ? -ahead : ahead);
    if (this.scene.clearance(f.x + d.lat, f.z, -Infinity) < this.t.margin) cost += 4;
    return cost;
  }

  private planTrick(now: number, nEst: number, total: number, f: Flight): void {
    const a = this.air;
    if (!a) return;
    const t = this.t;
    const rng = this.rng;
    const r0 = this.rot();
    a.stomp = total >= 27 && !this.cooling && rng.chance(t.stompRate);
    a.stompBias = Math.round(gauss(rng) * t.stompSd * 0.6);
    const nB = nEst;
    const nA = nEst - t.slack;
    const stompOff = nEst - 3;
    let maxK = this.cooling ? 0 : t.maxHalfTurns;
    let maxF = this.cooling ? 0 : t.maxFlips;
    if (!rng.chance(0.35 + t.ambition * 0.65)) {
      maxK = Math.min(maxK, rng.int(0, 1));
      maxF = 0;
    }
    // A rider hopping under bells or stomping down Old Town spins nothing, and means every stomp.
    const piece = this.triesMoment() ?? this.triesNext();
    if (piece && (piece.verb === 'shatter' || piece.verb === 'steps')) {
      maxK = 0;
      maxF = 0;
      if (piece.verb === 'steps' && total >= 27) a.stomp = true;
    }
    // Spinning pushes the sled sideways, so the direction is picked by where it leaves the landing.
    const spinning = r0.spin > 1.5 ? 1 : r0.spin < -1.5 ? -1 : 0;
    const f0 = MOTOR + (this.act.value === 1 ? 2 : 0);
    const plan = this.planBuf;
    plan.gside = 0;
    plan.dir = 0;
    plan.mag = 1;
    plan.s0 = MOTOR;
    plan.s1 = MOTOR;
    plan.cruise = 0;
    plan.f0 = f0;
    plan.f1 = f0;
    plan.stomp = -1;
    const baseCost = this.landingCost(f, plan, r0, nB);
    let bestK = 0;
    let dir = spinning !== 0 ? spinning : t.favDir;
    if (nA > MOTOR + 6) {
      for (let k = maxK; k >= 1 && bestK === 0; k--) {
        // Yaw is symmetric, so one solve serves both directions.
        plan.dir = dir;
        if (solveSpin(r0, plan, k, nA, nB, this.rotP) >= 0.12) continue;
        // The favourite direction wins unless the other one lands clearly better.
        let pick = dir;
        let pickCost = this.landingCost(f, plan, r0, nB) - 0.6;
        if (spinning === 0) {
          plan.dir = -dir;
          const other = this.landingCost(f, plan, r0, nB);
          if (other < pickCost) {
            pickCost = other;
            pick = -dir;
          }
        }
        if (pickCost < Math.max(2.5, baseCost + 0.8)) {
          bestK = k;
          dir = pick;
        }
      }
    }
    plan.dir = 0;
    plan.s1 = plan.s0;
    let bestF = 0;
    if (nA > f0 + 30) {
      for (let ff = maxF; ff >= 1; ff--) {
        const e = solveFlip(r0, plan, ff, nA, nB, this.rotP);
        if (e < 0.15 && (!a.stomp || plan.f1 <= stompOff - 2)) {
          bestF = ff;
          break;
        }
      }
    }
    // Pick a trick: big riders combine, everyone avoids repeating the last trick in a combo.
    let k = bestK;
    let fl = bestF;
    if (k > 0 && fl > 0 && !rng.chance(t.ambition * t.skill)) {
      if (this.lastTrick >= 10 || (this.lastTrick < 0 && rng.chance(0.5))) fl = 0;
      else k = 0;
    }
    if (k > 1 && fl === 0 && this.lastTrick === k && rng.chance(0.6)) k--;
    if (k > 1 && rng.chance(1 - t.ambition)) k--;
    // Round 8: the sled's own move, from skill 0.6, in place of a rotation now and then (a stunt or sky rider most).
    const sigOk = (!piece || !NO_GRAB.has(piece.verb)) && !this.cooling && t.skill >= 0.6 && nEst >= 60 && !this.lastSig && rng.chance(t.ambition * (this.style === 'stunt' || this.style === 'sky' ? 0.45 : 0.25));
    this.lastSig = sigOk;
    if (sigOk) {
      k = 0;
      fl = 0;
    }
    a.k = k;
    a.f = fl;
    this.lastTrick = fl > 0 ? 10 + fl : k;
    a.dir = k > 0 ? dir : 0;
    // (Round 8: a press with the steer to a side is a grab, so a spin on a flip starts once the flip's press has
    // latched, steer centred.)
    const s0 = k > 0 && fl > 0 ? f0 + GRAB_LATCH + 1 : MOTOR;
    a.S0 = now + s0;
    a.F0 = now + f0;
    plan.s0 = s0;
    plan.f1 = f0;
    // Round 8: a grab, by appetite. Alone or on a spin (its side the spin's: a Paper Wheel), set before the spin is
    // solved, since a grab spins slower; after a flip's release (a Crane Fold), once the flip is solved. Let go into
    // the landing (the stomp, and the risk: a deep grab still held at touchdown is a fall) or well before it.
    const free = !piece || !NO_GRAB.has(piece.verb);
    const gWant = free && !sigOk && !this.cooling && nB >= 50 && rng.chance(t.ambition * (0.25 + 0.55 * t.skill) * (this.lastGrab ? 0.45 : 1));
    a.gside = 0;
    a.gLate = rng.chance(t.stompRate * 0.85);
    const gOff = a.gLate ? 4 : 15;
    if (gWant && fl === 0 && nEst - gOff - MOTOR >= 20) {
      a.gside = k > 0 ? dir : rng.chance(0.5) ? 1 : -1;
      a.G0 = now + MOTOR;
      a.G1 = now + nEst - gOff;
      this.grabPlan(plan, now);
    }
    if (a.dir !== 0) {
      plan.dir = a.dir;
      solveSpin(r0, plan, k, nA, nB, this.rotP);
      a.S1 = now + plan.s1;
    }
    if (a.f > 0) {
      solveFlip(r0, plan, a.f, nA, nB, this.rotP);
      a.F1 = now + plan.f1;
      const g0 = plan.f1 + 3;
      if (gWant && nEst - gOff - g0 >= 20 && g0 < nEst - 24) {
        a.gside = rng.chance(0.5) ? 1 : -1;
        a.G0 = now + g0;
        a.G1 = now + nEst - gOff;
      }
    }
    a.T0 = a.T1 = 0;
    if (a.gside !== 0) {
      // (Let go into the landing, the press is not needed: that let-go is the stomp.)
      if (a.gLate) a.stomp = false;
      // A skilled rider shoves it out late: a Crosswind.
      if (t.skill > 0.55 && rng.chance(t.ambition * 0.5) && a.G1 - a.G0 >= 40) {
        a.T0 = a.G1 - 22;
        a.T1 = a.G1 - 10;
      }
      this.grabPlan(plan, now);
    }
    this.lastGrab = a.gside !== 0;
    // Round 8: the sled's own move, from skill 0.6, in place of a rotation on a flight with room (a stunt or sky rider
    // most): two quick taps and a hold, let go where its rule wants (a Spinning Top early enough for the set to stop
    // it; a Pine Bow before a stomp's press, since letting it go is no stomp).
    a.sig = false;
    if (sigOk) {
      a.sig = true;
      a.G0 = now + MOTOR + 6;
      a.G1 = now + nEst - this.sigMargin();
      a.stomp = this.sim.sled.id === 0 && a.stomp;
    }
    // Human error: now and then a rotation is held far too long.
    if ((a.k > 0 || a.f > 0) && rng.chance(t.blunder)) a.over = 1;
    a.land = now + nEst;
    a.ST = now + stompOff;
    this.commit(now);
  }

  /** How long before touchdown this sled's own move is let go (tricks.ts): a Spinning Top in time for the set, a Pine
   *  Bow before the stomp's press, the rest into the landing (the let-go is the stomp). */
  private sigMargin(): number {
    const id = this.sim.sled.id;
    return id === 1 ? 18 : id === 0 ? 14 : 4;
  }

  /** A showdown has started against this rider (rivals.ts, in the pool generator): ride for the marker as a racer. */
  showdown(markerZ: number): void {
    if (this.racing < 0) {
      this.baseTuck = this.t.tuck;
      this.baseGreed = this.t.greed;
    }
    this.racing = markerZ;
    this.t.tuck = 1;
    this.t.greed = 0;
  }

  showdownOver(): void {
    if (this.racing < 0) return;
    this.racing = -1;
    this.t.tuck = this.baseTuck;
    this.t.greed = this.baseGreed;
  }

  private wasGrinding = false;
  private lastSig = false;
  private racing = -1;
  private baseTuck = 0;
  private baseGreed = 0;

  /** The grab's part of the shared plan buffer, in steps from now. */
  private grabPlan(plan: AirPlan, now: number): void {
    const a = this.air;
    if (!a) return;
    plan.gside = a.gside;
    plan.g0 = a.G0 - now;
    plan.g1 = a.G1 - now;
    plan.t0 = a.T0 - now;
    plan.t1 = a.T1 - now;
  }

  private lastGrab = false;

  /** Re-solve the releases with a fresher (more accurate) estimate of the touchdown. */
  private refineTrick(now: number, nEst: number): void {
    const a = this.air;
    if (!a) return;
    const r0 = this.rot();
    const plan = this.planNow(now, a.cruise);
    plan.stomp = -1;
    const nA = Math.max(1, nEst - this.t.slack);
    if (a.dir !== 0 && !a.s1Fixed) {
      solveSpin(r0, plan, a.k, nA, nEst, this.rotP);
      a.S1 = now + plan.s1;
    }
    if (a.f > 0 && !a.f1Fixed) {
      plan.dir = 0;
      solveFlip(r0, plan, a.f, nA, nEst, this.rotP);
      a.F1 = now + plan.f1;
    }
    if (!a.stFixed) a.ST = now + nEst - 3;
    if (a.sig && !a.g1Fixed) a.G1 = Math.max(a.G0 + 16, now + nEst - this.sigMargin());
    if (a.gside !== 0 && !a.g1Fixed) {
      const was = a.G1;
      a.G1 = Math.max(a.G0 + 16, now + nEst - (a.gLate ? 4 : 15));
      if (a.T1 > 0) {
        a.T0 += a.G1 - was;
        a.T1 += a.G1 - was;
      }
    }
    a.land = now + nEst;
    this.commit(now);
  }

  /** Releases and the stomp that fall before the next look are executed, with motor noise. */
  private commit(now: number): void {
    const a = this.air;
    if (!a) return;
    const t = this.t;
    const rng = this.rng;
    const due = now + this.interval + 1;
    if (a.dir !== 0 && !a.s1Fixed && a.S1 <= due) {
      a.S1 = Math.max(now + 1, a.S1 + Math.round(gauss(rng) * t.timingSd));
      // A blunder: greed for one more half turn, and the spin is still going at touchdown.
      if (a.over > 0 && a.f === 0) a.S1 = Math.max(a.S1, a.land - rng.int(0, 7));
      a.s1Fixed = true;
    }
    if (a.f > 0 && !a.f1Fixed && a.F1 <= due) {
      a.F1 = Math.max(now + 1, a.F1 + Math.round(gauss(rng) * t.timingSd));
      if (a.over > 0) a.F1 = Math.max(a.F1, a.land - rng.int(0, 10));
      a.f1Fixed = true;
    }
    if ((a.gside !== 0 || a.sig) && !a.g1Fixed && a.G1 <= due) {
      // The let-go, with the hands' own error: late enough, and a deep grab meets the snow still held.
      a.G1 = Math.max(now + 1, a.G1 + Math.round(gauss(rng) * t.timingSd));
      if (a.over > 0) a.G1 = Math.max(a.G1, a.land - rng.int(0, 3));
      a.g1Fixed = true;
    }
    if (a.stomp && !a.stFixed && a.ST <= due) {
      a.ST = a.ST + Math.round(gauss(rng) * t.stompSd * 0.8) + a.stompBias;
      a.ST = Math.max(a.ST, now + 1, a.f > 0 ? a.F1 + 2 : 0);
      a.stFixed = true;
    }
  }

  /** Rebuild both input channels from the air plan (absolute ticks), sampled through the model's own steerAt and
   *  actionAt so the hands do exactly what the plan was solved for (round 8: a grab, a tweak and a flip's press
   *  steer centred need the two channels in step). */
  private writeAirPlan(now: number): void {
    const a = this.air;
    if (!a) return;
    if (a.sig) {
      // The sled's own move: tap, gap, press and hold to G1, then a stomp's press if one is planned.
      this.steer.cut(now);
      this.steer.set(now, level(a.cruise));
      this.act.cut(now);
      const marks: [number, number][] = [[a.G0 - 6, 1], [a.G0 - 3, 0], [a.G0, 1], [a.G1, 0]];
      if (a.stomp) marks.push([Math.max(a.ST, a.G1 + 2), 1]);
      let v = this.act.value;
      for (const [t, x] of marks) if (t <= now) v = x;
      this.act.set(now, v);
      for (const [t, x] of marks) if (t > now) this.act.set(t, x);
      return;
    }
    const p = this.planNow(now, a.cruise);
    this.steer.cut(now);
    this.act.cut(now);
    const end = Math.max(2, a.land - now + 12);
    let ls = -1;
    let la = -1;
    for (let i = 0; i <= end; i++) {
      const sv = level(steerAt(p, i));
      const av = actionAt(p, i) ? 1 : 0;
      if (sv !== ls) {
        this.steer.set(now + i, sv);
        ls = sv;
      }
      if (av !== la) {
        this.act.set(now + i, av);
        la = av;
      }
    }
  }
}

/** Ticks a run keeps recording past the finish line: the coast through the square. */
const COAST_TICKS = 480;

/** A run as the field sees it, tick by tick (round 8): where it was and how it rode, a bit each: riding, clean,
 *  over the line. What a later pool run drafts, duels and steals from. */
export interface Track {
  n: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  flags: Uint8Array;
}

const T_RIDING = 1;
const T_CLEAN = 2;
const T_FINISHED = 4;

/** The earlier runs a pool run races (round 8): their tracks, and which may be met in a showdown (the kinds a
 *  player may meet: signature riders). A wisp may be stolen from any of them, as from any ghost in a live field. */
export interface Field {
  tracks: readonly Track[];
  duel: readonly boolean[];
}

/** Where a track's rider is at tick t, as the rules see it: null once a run that never finished has ended. */
function pointAt(tr: Track, t: number): RiderPoint | null {
  const i = t < tr.n ? t : tr.n - 1;
  if (i < 0) return null;
  const f = tr.flags[i];
  if (t >= tr.n && !(f & T_FINISHED)) return null;
  return { x: tr.x[i], y: tr.y[i], z: tr.z[i], riding: (f & T_RIDING) !== 0 && t < tr.n, clean: (f & T_CLEAN) !== 0, finished: (f & T_FINISHED) !== 0 };
}

/** Plays one bot run on the real Sim and also returns the finished Sim (for stats) and its track. With a field
 *  (round 8) the run drafts the field's riders (the draft bit, by the game's own rule), and the showdowns it wins and
 *  the wisps it steals go into its log as the live game's do. */
export function runBot(seed: number, chaos: ChaosRoll, profile: BotProfile, maxTicks = 60 * 60 * 6, field?: Field): { record: RunRecord; sim: Sim; track: Track } {
  const charmPool = profile.charmPool ?? STARTER_POOL;
  const sim = new Sim({ seed, chaos, sled: profile.sled, charmPool });
  const bot = new Bot(sim, profile);
  const rec = new InputRecorder();
  const cap = maxTicks + 2;
  const track: Track = { n: 0, x: new Float32Array(cap), y: new Float32Array(cap), z: new Float32Array(cap), flags: new Uint8Array(cap) };
  const tracks = field ? field.tracks : [];
  const watch = field ? new RivalWatch(tracks.length, (i) => field.duel[i], () => true, sim.course.finishZ) : null;
  const them: (RiderPoint | null)[] = tracks.map(() => null);
  const tokens: LogEvent[] = [];
  while (sim.tick < maxTicks && !sim.s.crashed && !(sim.finished && sim.tick >= sim.s.finishTick + COAST_TICKS)) {
    for (const e of tokens) {
      rec.event(e);
      applyLogEvent(sim, e);
    }
    tokens.length = 0;
    let input = bot.input();
    if (tracks.length && !sim.finished && sim.s.tumble === 0) {
      const s = sim.s;
      for (const tr of tracks) {
        const p = pointAt(tr, sim.tick - 1);
        if (p && !p.finished && draftsOn(s, p)) {
          input |= DRAFT_BIT;
          break;
        }
      }
    }
    rec.push(input);
    sim.step(input);
    bot.observe();
    const s = sim.s;
    const k = track.n++;
    track.x[k] = s.x;
    track.y[k] = s.y;
    track.z[k] = s.z;
    track.flags[k] = (!s.crashed && !s.finished && s.tumble === 0 ? T_RIDING : 0) | (s.tumble === 0 && s.wobble === 0 && s.ghost === 0 ? T_CLEAN : 0) | (s.finished ? T_FINISHED : 0);
    if (watch) {
      for (let i = 0; i < tracks.length; i++) them[i] = pointAt(tracks[i], sim.tick - 1);
      for (const e of watch.step(sim.tick - 1, riderPoint(sim), them)) {
        if (e.type === 'showdown' && e.phase === 'start') bot.showdown(e.markerZ);
        else if (e.type === 'showdown') bot.showdownOver();
        if (e.type === 'showdown' && e.phase === 'won') tokens.push(LogEvent.Showdown);
        else if (e.type === 'steal') tokens.push(LogEvent.Steal);
      }
    }
  }
  track.x = track.x.slice(0, track.n);
  track.y = track.y.slice(0, track.n);
  track.z = track.z.slice(0, track.n);
  track.flags = track.flags.slice(0, track.n);
  const record: RunRecord = {
    seed,
    chaos,
    sled: profile.sled,
    charmPool,
    inputs: rec.encode(),
    ticks: rec.tickCount,
    score: sim.score,
    distance: sim.distance,
    name: profile.name,
  };
  return { record, sim, track };
}

/** Plays one bot run. The record replays exactly through replayRecord. */
export function playBot(seed: number, chaos: ChaosRoll, profile: BotProfile, maxTicks = 60 * 60 * 6): RunRecord {
  return runBot(seed, chaos, profile, maxTicks).record;
}
