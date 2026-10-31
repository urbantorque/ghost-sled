import { ChaosRoll } from '../sim/chaos';
import { InputRecorder, LogEvent, packInput } from '../sim/input';
import { RunRecord } from '../sim/replay';
import { Sim, SimEvent, SledState } from '../sim/sim';

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
}

export interface InputSource {
  /** draft: a recorded slipstream bit (a replayed run); when given, the live draftProbe is not asked. */
  sample(): { steer: number; action: boolean; draft?: boolean };
}

export type DraftProbe = (tick: number, x: number, y: number, z: number) => boolean;

export class Run {
  readonly sim: Sim;
  readonly recorder = new InputRecorder();
  readonly prev = emptySnap();
  readonly cur = emptySnap();
  /** Events produced since the presentation layer last drained them. */
  readonly pending: Array<{ tick: number; e: SimEvent }> = [];
  draftProbe: DraftProbe | null = null;
  paused = false;
  private pendingRevive = false;

  constructor(
    readonly seed: number,
    readonly chaos: ChaosRoll,
    readonly sled: number,
    private input: InputSource,
  ) {
    this.sim = new Sim({ seed, chaos, sled });
    copySnap(this.sim.s, this.prev);
    copySnap(this.sim.s, this.cur);
  }

  get crashed(): boolean {
    return this.sim.s.crashed;
  }

  /** One fixed tick. Returns false when the run should stop advancing (crashed or paused). */
  tick(): boolean {
    if (this.paused) return false;
    if (this.pendingRevive) {
      this.pendingRevive = false;
      this.recorder.event(LogEvent.Revive);
      this.sim.revive();
      for (const e of this.sim.events) this.pending.push({ tick: this.sim.tick, e });
    }
    if (this.sim.s.crashed) return false;
    const s = this.sim.s;
    const inp = this.input.sample();
    const draft = inp.draft ?? (this.draftProbe ? this.draftProbe(this.sim.tick, s.x, s.y, s.z) : false);
    const byte = packInput(inp.steer, inp.action, draft);
    this.recorder.push(byte);
    copySnap(s, this.prev);
    this.sim.step(byte);
    copySnap(s, this.cur);
    for (const e of this.sim.events) this.pending.push({ tick: this.sim.tick, e });
    return !s.crashed;
  }

  revive(): void {
    if (this.sim.s.crashed) this.pendingRevive = true;
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
      inputs: this.recorder.encode(),
      ticks: this.recorder.tickCount,
      score: this.sim.score,
      distance: this.sim.distance,
      name,
    };
  }
}
