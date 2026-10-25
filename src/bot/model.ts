import { Course } from '../sim/course';
import { PI, TAU, approach } from '../sim/dmath';
import { DT } from '../sim/sim';
import { Scene } from './scene';

// The bot's internal model of its own body: a ballistic flight predictor and a copy of the air
// rotation rules. It is what a practised rider "feels", so its predictions are exact until the bot
// adds its own perception and timing error on top.

export interface Flight {
  /** Steps until touchdown: the landing happens on the step `ticks - 1` steps from now. */
  ticks: number;
  x: number;
  z: number;
  /** Smallest gap to a perceived collider the sled would not pass over (capped at FAR). */
  clearance: number;
}

/**
 * Integrates the sim's air step without steering until the sled meets the ground. A flight whose
 * clearance drops below `giveUp` is abandoned early, since the caller will reject it anyway.
 */
export function predictFlight(
  course: Course,
  scene: Scene | null,
  gravity: number,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  vz: number,
  giveUp = -Infinity,
  maxTicks = 480,
): Flight {
  let clearance = Infinity;
  let gy = course.ground(x, z);
  let skip = 0;
  const drag = 1 - 0.015 * DT;
  for (let t = 1; t <= maxTicks; t++) {
    vy -= gravity * DT;
    vx *= drag;
    vz *= drag;
    x += vx * DT;
    z += vz * DT;
    y += vy * DT;
    // High above the snow the ground cannot come up within a tick or two, so it is sampled less.
    let landed = false;
    if (skip > 0) skip--;
    else {
      gy = course.ground(x, z);
      const h = y - gy;
      skip = h > 4 ? 2 : h > 1.6 ? 1 : 0;
      landed = y <= gy;
    }
    // Every other tick is plenty for colliders a metre or more across.
    if (scene && ((t & 1) === 0 || landed)) {
      const c = scene.clearance(x, z, y);
      if (c < clearance) {
        clearance = c;
        if (c < giveUp) return { ticks: t, x, z, clearance };
      }
    }
    if (landed) return { ticks: t, x, z, clearance };
  }
  return { ticks: maxTicks, x, z, clearance };
}

/** Rotation state, mirroring the sim's air fields. `armed` is a fresh press since takeoff. */
export interface Rot {
  steer: number;
  spin: number;
  yaw: number;
  pr: number;
  pitch: number;
  hold: number;
  armed: boolean;
  prev: boolean;
}

export interface RotParams {
  spinMax: number;
  flipRate: number;
}

export function copyRot(from: Rot, to: Rot): Rot {
  to.steer = from.steer;
  to.spin = from.spin;
  to.yaw = from.yaw;
  to.pr = from.pr;
  to.pitch = from.pitch;
  to.hold = from.hold;
  to.armed = from.armed;
  to.prev = from.prev;
  return to;
}

/** One air tick of the sim's steering smoothing, spin and flip rules. */
export function rotStep(r: Rot, steerTarget: number, action: boolean, p: RotParams): void {
  const rate = Math.abs(steerTarget) < Math.abs(r.steer) || steerTarget * r.steer < 0 ? 10 : 8;
  r.steer = approach(r.steer, steerTarget, rate * DT);
  const pressed = action && !r.prev;
  r.prev = action;
  if (pressed) r.armed = true;
  r.hold = action && r.armed ? r.hold + 1 : 0;
  if (Math.abs(r.steer) > 0.3) {
    r.spin = approach(r.spin, r.steer * p.spinMax, 34 * DT);
  } else {
    r.spin = approach(r.spin, 0, 22 * DT);
    r.yaw = approach(r.yaw, PI * Math.round(r.yaw / PI), 2.6 * DT);
  }
  r.yaw += r.spin * DT;
  if (action && r.hold >= 7) {
    r.pr = approach(r.pr, -p.flipRate, 20 * DT);
  } else {
    r.pr = approach(r.pr, 0, 26 * DT);
    if (Math.abs(r.pr) < 1.5) r.pitch = approach(r.pitch, TAU * Math.round(r.pitch / TAU), 2.4 * DT);
  }
  r.pitch += r.pr * DT;
}

/**
 * An air plan in steps from now. Steer is dir * mag on [s0, s1) and `cruise` otherwise; the action
 * is held on [f0, f1) for a flip and again from `stomp` on (stomp < 0: no stomp).
 */
export interface AirPlan {
  dir: number;
  mag: number;
  s0: number;
  s1: number;
  cruise: number;
  f0: number;
  f1: number;
  stomp: number;
}

export function steerAt(p: AirPlan, i: number): number {
  return p.dir !== 0 && i >= p.s0 && i < p.s1 ? p.dir * p.mag : p.cruise;
}

export function actionAt(p: AirPlan, i: number): boolean {
  return (i >= p.f0 && i < p.f1) || (p.stomp >= 0 && i >= p.stomp);
}

const AIR_LATERAL = 2.0;

const tmp: Rot = { steer: 0, spin: 0, yaw: 0, pr: 0, pitch: 0, hold: 0, armed: false, prev: false };

/** Yaw and pitch after nA and nB steps (nA <= nB) of a plan. */
export interface PlanResult {
  yawA: number;
  yawB: number;
  pitchA: number;
  pitchB: number;
  /** Sideways drift of the landing point caused by the plan's steering (air control), metres. */
  lat: number;
  /** Sideways velocity the plan's steering adds by touchdown, m/s. */
  vlat: number;
}

export function runPlan(r0: Rot, plan: AirPlan, nA: number, nB: number, p: RotParams, out: PlanResult): PlanResult {
  const r = copyRot(r0, tmp);
  out.yawA = r.yaw;
  out.pitchA = r.pitch;
  let vLat = 0;
  let lat = 0;
  for (let i = 0; i < nB; i++) {
    rotStep(r, steerAt(plan, i), actionAt(plan, i), p);
    // The sim nudges velocity sideways by steer * 2 m/s^2 in the air.
    vLat += r.steer * AIR_LATERAL * DT;
    lat += vLat * DT;
    if (i === nA - 1) {
      out.yawA = r.yaw;
      out.pitchA = r.pitch;
    }
  }
  out.yawB = r.yaw;
  out.pitchB = r.pitch;
  out.lat = lat;
  out.vlat = vLat;
  return out;
}

const res: PlanResult = { yawA: 0, yawB: 0, pitchA: 0, pitchB: 0, lat: 0, vlat: 0 };

/** Landing error of an angle against a target multiple, as the sim measures it. */
function err(a: number, target: number): number {
  const e = a - target;
  return e < 0 ? -e : e;
}

/**
 * Finds the spin release step that brings yaw to dir * halfTurns * PI, settled from step nA through
 * landing at nB. Writes plan.s1 and returns the worse of the two errors.
 */
export function solveSpin(r0: Rot, plan: AirPlan, halfTurns: number, nA: number, nB: number, p: RotParams): number {
  const target = plan.dir * halfTurns * PI;
  const lo0 = plan.s0 < 0 ? 0 : plan.s0;
  let lo = lo0;
  let hi = nB;
  // Smallest release whose settled yaw reaches the target (yaw grows monotonically with hold).
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    plan.s1 = mid;
    runPlan(r0, plan, nA, nB, p, res);
    if (plan.dir * res.yawA >= halfTurns * PI) hi = mid;
    else lo = mid + 1;
  }
  let best = Infinity;
  let bestS = lo;
  for (let s = lo - 1; s <= lo; s++) {
    if (s < lo0) continue;
    plan.s1 = s;
    runPlan(r0, plan, nA, nB, p, res);
    const e = Math.max(err(res.yawA, target), err(res.yawB, target));
    if (e < best) {
      best = e;
      bestS = s;
    }
  }
  plan.s1 = bestS;
  return best;
}

/** Same for the flip release: pitch to -flips * TAU. Writes plan.f1. */
export function solveFlip(r0: Rot, plan: AirPlan, flips: number, nA: number, nB: number, p: RotParams): number {
  const target = -flips * TAU;
  const lo0 = plan.f0 < 0 ? 0 : plan.f0;
  let lo = lo0;
  let hi = nB;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    plan.f1 = mid;
    runPlan(r0, plan, nA, nB, p, res);
    if (-res.pitchA >= flips * TAU) hi = mid;
    else lo = mid + 1;
  }
  let best = Infinity;
  let bestF = lo;
  for (let f = lo - 1; f <= lo; f++) {
    if (f < lo0) continue;
    plan.f1 = f;
    runPlan(r0, plan, nA, nB, p, res);
    const e = Math.max(err(res.pitchA, target), err(res.pitchB, target));
    if (e < best) {
      best = e;
      bestF = f;
    }
  }
  plan.f1 = bestF;
  return best;
}
