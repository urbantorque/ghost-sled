import { ChaosRoll } from '../sim/chaos';
import { InputRecorder, LogEvent, packInput } from '../sim/input';
import { RunRecord, applyLogEvent } from '../sim/replay';
import { type RiderPoint, type RivalEvent, riderPoint } from '../sim/rivals';
import { Sim, SimConfig, SimEvent, SledState } from '../sim/sim';

// One live run: owns the Sim, samples input once per tick, records the input log, and keeps the
// previous and current tick snapshots for render interpolation.

export interface Snap {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  heading: number;
  airYaw: number;
  airPitch: number;
  lean: number;
  speed: number;
  steer: number;
  carve: number;
  slip: number;
  boostGlow: number;
  wobble: number;
  flow: number;
  grounded: boolean;
  drifting: boolean;
  driftDir: number;
  driftTier: number;
  /** Drift charge (sim s.driftCharge: tier 1 at 0.6, 2 at 1.35, 3 at 2.4). Presentation only, never hashed. */
  driftCharge: number;
  action: boolean;
  drafting: boolean;
  onIce: boolean;
  crashed: boolean;
  /** Over the finish line, coasting. */
  finished: boolean;
}

export function emptySnap(): Snap {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    heading: 0,
    airYaw: 0,
    airPitch: 0,
    lean: 0,
    speed: 0,
    steer: 0,
    carve: 0,
    slip: 0,
    boostGlow: 0,
    wobble: 0,
    flow: 0,
    grounded: true,
    drifting: false,
    driftDir: 0,
    driftTier: 0,
    driftCharge: 0,
    action: false,
    drafting: false,
    onIce: false,
    crashed: false,
    finished: false,
  };
}

export function copySnap(s: SledState, o: Snap): void {
  o.x = s.x;
  o.y = s.y;
  o.z = s.z;
  o.vx = s.vx;
  o.vy = s.vy;
  o.vz = s.vz;
  o.heading = s.heading;
  o.airYaw = s.airYaw;
  o.airPitch = s.airPitch;
  o.lean = s.lean;
  o.speed = s.speed;
  o.steer = s.steer;
  o.carve = s.carve;
  o.slip = s.slip;
  o.boostGlow = s.boostGlow;
  o.wobble = s.wobble;
  o.flow = s.flow;
  o.grounded = s.grounded;
  o.drifting = s.drifting;
  o.driftDir = s.driftDir;
  o.driftTier = s.driftTier;
  o.driftCharge = s.driftCharge;
  o.action = s.action;
  o.drafting = s.drafting;
  o.onIce = s.onIce;
  o.crashed = s.crashed;
  o.finished = s.finished;
}

export function lerpSnap(a: Snap, b: Snap, t: number, o: Snap): void {
  const l = (x: number, y: number) => x + (y - x) * t;
  o.x = l(a.x, b.x);
  o.y = l(a.y, b.y);
  o.z = l(a.z, b.z);
  o.vx = l(a.vx, b.vx);
  o.vy = l(a.vy, b.vy);
  o.vz = l(a.vz, b.vz);
  o.heading = l(a.heading, b.heading);
  // Rotations reset on landing; never interpolate across that discontinuity.
  const same = a.grounded === b.grounded;
  o.airYaw = same ? l(a.airYaw, b.airYaw) : b.airYaw;
  o.airPitch = same ? l(a.airPitch, b.airPitch) : b.airPitch;
  o.lean = l(a.lean, b.lean);
  o.speed = l(a.speed, b.speed);
  o.steer = l(a.steer, b.steer);
  o.carve = l(a.carve, b.carve);
  o.slip = l(a.slip, b.slip);
  o.boostGlow = l(a.boostGlow, b.boostGlow);
  o.wobble = b.wobble;
  o.flow = b.flow;
  o.grounded = b.grounded;
  o.drifting = b.drifting;
  o.driftDir = b.driftDir;
  o.driftTier = b.driftTier;
  o.driftCharge = b.driftCharge;
  o.action = b.action;
  o.drafting = b.drafting;
  o.onIce = b.onIce;
  o.crashed = b.crashed;
  o.finished = b.finished;
}

export interface InputSource {
  /** draft: a recorded slipstream bit (a replayed run); when given, the live draftProbe is not asked. */
  sample(): { steer: number; action: boolean; draft?: boolean; spirit?: boolean };
}

export type DraftProbe = (tick: number, x: number, y: number, z: number) => boolean;

/** Round 8: the field's rules for showdowns and the spirit steal (rivals.ts), asked once a tick with the rider as it
 *  now is; what it decides that gives something goes into the log as a token. */
export type RivalProbe = (tick: number, me: RiderPoint) => readonly RivalEvent[];

/** What the save decides for a run's SimConfig beyond the mountain, the roll and the sled (round 8). */
export type RunExtra = Pick<SimConfig, 'charmPool' | 'charmGates' | 'carry' | 'firstRun'>;

export class Run {
  readonly sim: Sim;
  readonly recorder = new InputRecorder();
  readonly prev = emptySnap();
  readonly cur = emptySnap();
  /** Events produced since the presentation layer last drained them. */
  readonly pending: Array<{ tick: number; e: SimEvent }> = [];
  draftProbe: DraftProbe | null = null;
  rivalProbe: RivalProbe | null = null;
  /** What the rival rules decided, for the director (drainRivals). */
  readonly rivalPending: Array<{ tick: number; e: RivalEvent }> = [];
  paused = false;
  /** Called after every sim step with the sim as it stands (round 8, the trials lane: a Trial's tally, trial.ts). */
  onStep: ((sim: Sim) => void) | null = null;
  /** Log tokens to apply at the start of the next tick (a revive, a showdown won, a wisp stolen). */
  private readonly tokens: LogEvent[] = [];

  constructor(
    readonly seed: number,
    readonly chaos: ChaosRoll,
    readonly sled: number,
    private input: InputSource,
    readonly extra: RunExtra = {},
  ) {
    this.sim = new Sim({ seed, chaos, sled, ...extra });
    copySnap(this.sim.s, this.prev);
    copySnap(this.sim.s, this.cur);
  }

  get crashed(): boolean {
    return this.sim.s.crashed;
  }

  /** Over the finish line. The run is decided, and it keeps ticking: the sled coasts on. */
  get finished(): boolean {
    return this.sim.finished;
  }

  /** One fixed tick. Returns false when the run should stop advancing (crashed or paused). A finished
   *  run keeps advancing through its coast. */
  tick(): boolean {
    if (this.paused) return false;
    for (const t of this.tokens) {
      this.recorder.event(t);
      applyLogEvent(this.sim, t);
      for (const e of this.sim.events) this.pending.push({ tick: this.sim.tick, e });
    }
    this.tokens.length = 0;
    if (this.sim.s.crashed) return false;
    const s = this.sim.s;
    const inp = this.input.sample();
    const draft = inp.draft ?? (this.draftProbe ? this.draftProbe(this.sim.tick, s.x, s.y, s.z) : false);
    const byte = packInput(inp.steer, inp.action, draft, inp.spirit === true);
    this.recorder.push(byte);
    copySnap(s, this.prev);
    this.sim.step(byte);
    copySnap(s, this.cur);
    for (const e of this.sim.events) this.pending.push({ tick: this.sim.tick, e });
    this.onStep?.(this.sim);
    if (this.rivalProbe && !s.crashed) {
      for (const e of this.rivalProbe(this.sim.tick - 1, riderPoint(this.sim))) {
        this.rivalPending.push({ tick: this.sim.tick, e });
        if (e.type === 'showdown' && e.phase === 'won') this.tokens.push(LogEvent.Showdown);
        else if (e.type === 'steal') this.tokens.push(LogEvent.Steal);
      }
    }
    return !s.crashed;
  }

  revive(): void {
    if (this.sim.s.crashed && !this.tokens.includes(LogEvent.Revive)) this.tokens.push(LogEvent.Revive);
  }

  drainRivals(): Array<{ tick: number; e: RivalEvent }> {
    const out = this.rivalPending.slice();
    this.rivalPending.length = 0;
    return out;
  }

  drain(): Array<{ tick: number; e: SimEvent }> {
    const out = this.pending.slice();
    this.pending.length = 0;
    return out;
  }

  toRecord(name: string): RunRecord {
    return {
      seed: this.seed,
      chaos: this.chaos,
      sled: this.sled,
      ...this.extra,
      inputs: this.recorder.encode(),
      // (A finished run's header carries its finish; the log runs on through the coast.)
      ticks: this.sim.finished ? this.sim.s.finishTick : this.recorder.tickCount,
      score: this.sim.score,
      distance: this.sim.distance,
      name,
    };
  }
}
