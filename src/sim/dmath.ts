// Deterministic math for the simulation.
//
// ECMAScript leaves Math.sin, Math.cos, Math.atan2, Math.exp and friends "implementation-approximated",
// so V8, SpiderMonkey and JavaScriptCore may differ in the last bits. Ghost runs are recorded in one
// engine and replayed in another, so the sim uses these replacements built only from + - * / and
// Math.sqrt (correctly rounded on every engine we target). A test bans the native versions in src/sim.

export const PI = 3.141592653589793;
export const TAU = 6.283185307179586;
export const HALF_PI = 1.5707963267948966;
const LN2 = 0.6931471805599453;
const INV_LN2 = 1.4426950408889634;

/** sin on [-pi/2, pi/2] via Taylor series to x^15 (error < 1e-11). */
function sinCore(x: number): number {
  const x2 = x * x;
  return (
    x *
    (1 +
      x2 *
        (-1 / 6 +
          x2 *
            (1 / 120 +
              x2 *
                (-1 / 5040 +
                  x2 *
                    (1 / 362880 +
                      x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000))))))))
  );
}

/** Wrap an angle to [-pi, pi]. */
export function wrapAngle(a: number): number {
  if (a >= -PI && a <= PI) return a;
  return a - TAU * Math.floor((a + PI) / TAU);
}

export function dsin(x: number): number {
  let a = wrapAngle(x);
  if (a > HALF_PI) a = PI - a;
  else if (a < -HALF_PI) a = -PI - a;
  return sinCore(a);
}

export function dcos(x: number): number {
  return dsin(x + HALF_PI);
}

/** atan for t >= 0 using two half-angle reductions then a short series. */
function atanPos(t: number): number {
  let invert = false;
  if (t > 1) {
    t = 1 / t;
    invert = true;
  }
  // atan(t) = 2 atan(t / (1 + sqrt(1 + t^2)))
  let u = t / (1 + Math.sqrt(1 + t * t));
  u = u / (1 + Math.sqrt(1 + u * u));
  const u2 = u * u;
  let term = u;
  let sum = u;
  for (let n = 3; n <= 23; n += 2) {
    term = -term * u2;
    sum += term / n;
  }
  const r = 4 * sum;
  return invert ? HALF_PI - r : r;
}

export function datan(t: number): number {
  return t < 0 ? -atanPos(-t) : atanPos(t);
}

export function datan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  if (x === 0) return y > 0 ? HALF_PI : -HALF_PI;
  const a = atanPos(Math.abs(y / x));
  if (x > 0) return y < 0 ? -a : a;
  return y < 0 ? a - PI : PI - a;
}

export function dexp(x: number): number {
  if (x > 700) return Infinity;
  if (x < -700) return 0;
  const k = Math.floor(x * INV_LN2 + 0.5);
  const r = x - k * LN2;
  // Taylor to r^13 on |r| <= ln2/2.
  let term = 1;
  let sum = 1;
  for (let n = 1; n <= 13; n++) {
    term = (term * r) / n;
    sum += term;
  }
  // Multiply by 2^k exactly.
  let p = 1;
  const base = k < 0 ? 0.5 : 2;
  for (let i = Math.abs(k); i > 0; i--) p *= base;
  return sum * p;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Move `v` toward `target` by at most `step`. */
export function approach(v: number, target: number, step: number): number {
  if (v < target) return v + step > target ? target : v + step;
  return v - step < target ? target : v - step;
}

/** Shortest signed difference b - a between two angles. */
export function angleDiff(a: number, b: number): number {
  return wrapAngle(b - a);
}

export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}
