import { ChaosEvent, ChaosRoll, Mood, MoodParams, eventTriggerZ, moodInfo } from './chaos';
import { CHUNK_LEN, Course, FOREST_LIMIT, Obstacle, courseFor } from './course';
import { PI, TAU, angleDiff, approach, clamp, datan2, dcos, dsin, wrapAngle } from './dmath';
import { MAX_RUN_TICKS, actionOf, draftOf, steerOf } from './input';
import { Rng } from './prng';
import { Combo, StyleKind } from './scoring';
import { SledDef, sledById } from './sleds';

// The deterministic run simulation. One call to step() advances exactly one 60 Hz tick.

/** Bump whenever simulation behaviour changes; bundled ghost pools record the version they were made with. */
export const SIM_VERSION = 4;
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const SLED_RADIUS = 0.55;
export const MAX_SPEED = 46;
const G = 9.81;
const CD = 0.0047;
const MU = 0.035;

export type CrashCause = 'tree' | 'rock' | 'forest' | 'landing' | 'yeti' | 'avalanche' | 'daylight';
export type TakeoffKind = 'lip' | 'pop' | 'geyser';
export type LandQuality = 'perfect' | 'clean' | 'sketchy' | 'hop';

export type SimEvent =
  | { type: 'takeoff'; kind: TakeoffKind; vy: number }
  | { type: 'land'; quality: LandQuality; airtime: number; halfTurns: number; flips: number; impact: number; late: boolean }
  | { type: 'crash'; cause: CrashCause }
  | { type: 'style'; kind: StyleKind; points: number; chain: number; mult: number }
  | { type: 'comboBank'; points: number; mult: number }
  | { type: 'comboLost'; points: number }
  | { type: 'gift'; id: number; value: number; x: number; y: number; z: number }
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
}

const vec = { x: 0, z: 0 };

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
  gifts = 0;
  private prevAction = false;
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
    this.s = {
      x: x0,
      y: this.course.ground(x0, z0),
      z: z0,
      vx: 0,
      vy: 0,
      vz: 7,
      heading: 0,
      velHeading: 0,
      speed: 7,
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
    };
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
    };
  }

  /** Small direct score from gifts (gifts are mainly currency, not combo fuel). */
  giftScore = 0;

  get score(): number {
    return Math.floor(this.maxZ) + this.combo.banked + this.giftScore;
  }

  get distance(): number {
    return this.maxZ;
  }

  get gravity(): number {
    return G * this.mood.gravity;
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
    s.action = action;
    if (pressed) {
      s.lastPressTick = this.tick;
      s.pressStartedGrounded = s.grounded;
    }

    const rate = Math.abs(steerTarget) < Math.abs(s.steer) || steerTarget * s.steer < 0 ? 10 : 8;
    s.steer = approach(s.steer, steerTarget, rate * DT);

    const prevZ = s.z;
    if (s.grounded) this.groundStep(action, pressed, released);
    else this.airStep(action, pressed, released);

    if (!s.crashed) this.collide(prevZ);
    if (!s.crashed) this.pickups(prevZ);
    if (!s.crashed && this.course.edgeExcess(s.x, s.z) > FOREST_LIMIT) this.crash('forest');
    if (!s.crashed && this.tick >= MAX_RUN_TICKS - 1) this.crash('daylight');
    this.chaos();
    this.draft(draftOf(input));

    const hold = !s.grounded || s.drifting || s.drafting;
    const bankedNow = this.combo.tick(hold);
    if (bankedNow > 0) this.events.push({ type: 'comboBank', points: bankedNow, mult: this.combo.lastMult });

    const flowTarget = this.combo.active ? Math.min(6, Math.floor(this.combo.chain / 4)) : 0;
    s.flow = approach(s.flow, flowTarget, 1.5 * DT);
    s.boostGlow = approach(s.boostGlow, s.boostPool > 0.2 ? 1 : 0, 4 * DT);
    if (s.invuln > 0) s.invuln--;
    if (s.wobble > 0) s.wobble--;
    if (s.lateStompTicks > 0) s.lateStompTicks--;
    if (this.ventCooldown > 0) this.ventCooldown--;
    if (s.z > this.maxZ) this.maxZ = s.z;
    if (s.speed > this.stats.maxSpeed) this.stats.maxSpeed = s.speed;
    if (this.combo.best > this.stats.bestCombo) this.stats.bestCombo = this.combo.best;
    this.tick++;
  }

  private style(kind: StyleKind, base: number): void {
    const r = this.combo.add(kind, base);
    this.events.push({ type: 'style', kind, points: r.points, chain: r.chain, mult: r.mult });
  }

  private turnRate(speed: number): number {
    return 2.5 / (1 + speed / 16);
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
    s.heading += yawInput * turn * DT;
    if (s.wobble > 0) s.heading += dsin(s.wobble * 0.7) * 0.012;

    // Low speed: swing the nose back toward the fall line so the sled can never get stuck.
    if (s.speed < 3) {
      const fall = datan2(-vec.x, -vec.z);
      s.heading += clamp(angleDiff(s.heading, fall), -1, 1) * 1.2 * DT;
    }

    const maxSlip = s.drifting ? 0.9 : 0.5;
    let slip = wrapAngle(s.heading - s.velHeading);
    if (slip > maxSlip) s.heading = s.velHeading + maxSlip;
    else if (slip < -maxSlip) s.heading = s.velHeading - maxSlip;
    s.heading = clamp(s.heading, -1.35, 1.35);
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
    if (action && Math.abs(s.steer) < 0.3 && !s.drifting) cd *= 0.9;
    s.speed -= (cd * s.speed * s.speed + MU * g) * DT;
    if (s.speed < 0) s.speed = 0;
    this.applyBoost();
    if (s.speed > MAX_SPEED) s.speed = MAX_SPEED;

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
        const boost = [0, 3.5, 6, 9][s.driftTier];
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
      const boost = [0, 3.5, 6, 9][s.driftTier];
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
    const lat = s.steer * 2.0 * DT;
    s.vx += lat * dcos(s.velHeading);
    s.vz -= lat * dsin(s.velHeading);
    s.vx *= 1 - 0.015 * DT;
    s.vz *= 1 - 0.015 * DT;
    s.speed = Math.sqrt(s.vx * s.vx + s.vz * s.vz);
    if (s.speed > 0.01) s.velHeading = datan2(s.vx, s.vz);

    // Spins from steering (with a dead zone), flips from holding the action.
    const spinMax = 9 * this.sled.spin * this.mood.spin;
    if (Math.abs(s.steer) > 0.3) {
      s.spinRate = approach(s.spinRate, s.steer * spinMax, 34 * DT);
    } else {
      s.spinRate = approach(s.spinRate, 0, 22 * DT);
      const nearest = PI * Math.round(s.airYaw / PI);
      s.airYaw = approach(s.airYaw, nearest, 2.6 * DT);
    }
    s.airYaw += s.spinRate * DT;
    if (action && s.airHold >= 7) {
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

  private land(gy: number): void {
    const s = this.s;
    const c = this.course;
    c.gradient(s.x, s.z, vec);
    const vyFollow = vec.x * s.vx + vec.z * s.vz;
    const impact = vyFollow - s.vy;
    const airtime = s.airTicks / TICK_RATE;
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

    if (pitchErr > 1.35 + tol || yawErr > 1.2 + tol) {
      s.airYaw = 0;
      s.airPitch = 0;
      this.crash('landing');
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
      s.speed *= 0.78;
      s.wobble = 32;
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
    if (quality !== 'perfect' && impact > 9) s.speed *= 0.93;
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

  private applyBoost(): void {
    const s = this.s;
    if (s.boostPool <= 0) return;
    const add = Math.min(s.boostPool, 14 * DT);
    s.speed += add;
    s.boostPool -= add;
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
          if (s.invuln === 0 && (vn > 8 || (vn > 4.5 && s.speed > 18))) {
            this.crash(o.kind === 'pine' || o.kind === 'blossom' || o.kind === 'charpine' ? 'tree' : 'rock');
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
    if (!this.nearMiss.has(o.id)) return;
    this.nearMiss.delete(o.id);
    if (this.resolvedObstacles.has(o.id)) return;
    this.resolvedObstacles.add(o.id);
    this.stats.nearMisses++;
    this.style('nearMiss', 120);
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
      for (const gft of chunk.gifts) {
        if (this.collected.has(gft.id)) continue;
        const dz = gft.z - s.z;
        if (dz > 3 || dz < -3) continue;
        const dx = gft.x - s.x;
        const gy = c.ground(gft.x, gft.z) + gft.hover;
        const dy = gy - (s.y + 0.5);
        if (dx * dx + dz * dz + dy * dy < r2) this.collectGift(gft.id, gft.value, gft.x, gy, gft.z);
      }
      for (const gate of chunk.gates) {
        if (prevZ < gate.z && s.z >= gate.z && s.x > gate.x1 + 0.45 && s.x < gate.x2 - 0.45) {
          this.stats.gates++;
          this.style('gate', 250);
        }
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
        this.collectGift(g.id, g.value, g.x, gy, g.z);
      }
    }
  }

  stormGiftY(g: StormGift): number {
    const t = (this.tick - g.spawnTick) / TICK_RATE;
    const base = this.course.ground(g.x, g.z) + 0.9;
    const fall = 16 - 9 * t * t;
    return base + (fall > 0 ? fall : 0);
  }

  private collectGift(id: number, value: number, x: number, y: number, z: number): void {
    this.collected.add(id);
    const v = value * this.mood.giftValue;
    this.gifts += v;
    this.stats.gifts += v;
    this.events.push({ type: 'gift', id, value: v, x, y, z });
    this.giftScore += value > 1 ? 50 : 10;
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
    if (!active && this.dyn.trainPhase === 2) active = this.trainDraft();
    s.drafting = active && !s.crashed;
    if (s.drafting) {
      s.draftTicks++;
      this.stats.draftTicks++;
      s.draftCharge = Math.min(1, s.draftTicks / 90);
      if (s.speed < MAX_SPEED - 2) {
        s.speed += 2.6 * this.sled.draft * this.mood.draft * DT;
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
          this.crash('yeti');
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
        const sway = dsin(k * 0.55) * Math.max(0, c.halfWidth(z) - 3.5) * 0.8;
        const cx = c.centerX(z);
        const hw = c.halfWidth(z);
        let x = clamp(c.safeX(z) + sway, cx - hw + 1.2, cx + hw - 1.2);
        // Never drop a gift into a trunk: fall back to the guaranteed lane.
        if (this.nearHard(x, z, 1.9)) x = c.safeX(z);
        d.storm.push({ id: 10_000_000 + k, x, z, y: 0, value: k % 8 === 7 ? 5 : 1, spawnTick: this.tick, collected: false });
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
    mixF(this.gifts);
    mixF(s.crashed ? 1 : 0);
    return h >>> 0;
  }
}

export function isMood(roll: ChaosRoll, m: Mood): boolean {
  return roll.mood === m;
}
