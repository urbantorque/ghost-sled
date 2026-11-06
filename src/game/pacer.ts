import { FLAG_GROUNDED, FRAME_STRIDE, F_FLAGS, SAMPLE_EVERY } from './ghostdata';

// A rider's clock when a steady pace is not enough. Two jobs, and neither touches the sim: where a ghost
// is at a tick was only ever presentation, and the one way a ghost reaches the sim is the logged draft
// bit, so a replay of your run never asks these riders anything.
//
// The first is a very first run on a bundled mountain. The field is picked before you ride, and with no
// history it can only guess who you are: a pack around 2:30 and two beginners behind it. Measured, that
// left a first run with fewer passes than a second one and a rider alone for over half of it. So those
// riders read you as you go: each aims at its place on a string strung through your position, inside the
// speeds a rider can plausibly ride, and the string opens as you go, so the riders ahead of you come back
// to be caught. Near the line they stop reading you and ride on at the pace they had, so the last stretch
// is a real race: nothing changes under you when it matters. Your best, a grudge and a friend never read
// you, and neither does anyone from the second run on, or on a Daily or a Cup, whose field is shared.
//
// The second is a slow rider in the air. A rider slowed to half speed flew at half speed, and a jump at
// half speed has a quarter of its gravity. So a slower rider's time is taken back on the ground: it flies
// near true speed (slowMap) and still reaches the line on its real time.
//
// Pure: no DOM, render or audio imports.

/** Ticks between readings of your pace. */
export const PACE_EVERY = 15;
/** No reading before this tick: the start-line bunch is still sorting itself out. */
export const PACE_FROM = 120;
/** How far ahead a rider aims, in ticks. Shorter chases every wobble, longer lets you get away. */
export const PACE_AIM = 240;
/** The rates a rider reading you may play its run at. The top end is what holds a rider to a strong
 *  first run for most of it; past that you really do ride away from it. */
export const PACE_MIN = 0.45;
export const PACE_MAX = 1.12;
/** Most a rate moves in one reading: from flat out to its slowest in about six seconds. */
export const PACE_SLEW = 0.03;
/** How fast a rider flies, however slowly it rides: gravity reads as the square of this. */
export const AIR_RATE = 0.85;
/** Metres before the line where the riders stop reading you. */
export const PACE_OPEN = 800;
/** Your speed is read through this share of each new reading. */
const SPEED_EASE = 0.15;
/** The string: its back and front in metres off your position, how far it opens over a run, how far a
 *  rider wanders from its place, and over how long. Riders near the middle cross you on the wander. */
const STRING_BACK = -60;
const STRING_FRONT = 62;
const STRING_OPENS = 46;
const WANDER = 16;
const WANDER_LEN = 700;
const WANDER_STEP = 120;
/** Over the first stretch the string is drawn tight: the whole field leaves the line together. */
const STRING_TIGHT = 200;
/** Samples either side a slow rider's change of rate is eased over: about a quarter of a second. */
const AIR_EASE = 8;

/** Where rider i of n (slowest first) aims, in metres off your position: + is ahead of you. */
export function stringOffset(i: number, n: number, z: number, finishZ: number): number {
  const at = n > 1 ? i / (n - 1) : 0.5;
  const place = STRING_BACK + (STRING_FRONT - STRING_BACK) * at;
  const wander = WANDER * Math.sin((2 * Math.PI * z) / (WANDER_LEN + WANDER_STEP * i) + 1.9 * i);
  const tight = Math.min(1, Math.max(0, z / STRING_TIGHT));
  return tight * (place + wander) - STRING_OPENS * Math.min(1, Math.max(0, z / finishZ));
}

/** The riders are still reading you at z. */
export function reading(z: number, finishZ: number): boolean {
  return z < finishZ - PACE_OPEN;
}

/** The next rate from the current one and the rate that would land a rider on its place. */
export function paceRate(cur: number, want: number): number {
  const step = Math.max(-PACE_SLEW, Math.min(PACE_SLEW, want - cur));
  return Math.max(PACE_MIN, Math.min(PACE_MAX, cur + step));
}

/** Your speed, read steadily (m/s). */
export function easeSpeed(cur: number, z: number, wasZ: number, ticks: number): number {
  return ticks > 0 ? cur + (((z - wasZ) * 60) / ticks - cur) * SPEED_EASE : cur;
}

/** How a slow rider spends its time: the race tick it reaches each sample, flying near true speed and
 *  making up for that on the ground, so it still reaches `end` (its finish, in its own ticks) at
 *  end / pace. Null when the run has no ground to take the time back on. Past `end` it keeps its pace. */
export function slowMap(frames: Float32Array, samples: number, pace: number, end: number): Float32Array | null {
  const last = Math.min(samples, Math.ceil(end / SAMPLE_EVERY));
  if (!(pace < 1) || last <= 0) return null;
  const flying = (i: number): boolean => (frames[i * FRAME_STRIDE + F_FLAGS] & FLAG_GROUNDED) === 0;
  const fly = Math.max(pace, AIR_RATE);
  let air = 0;
  for (let i = 0; i < last; i++) if (flying(i)) air++;
  const ground = last - air;
  if (ground <= 0 || air === 0) return null;
  const left = last / pace - air / fly;
  const rolled = ground / left;
  // Each sample's length, then eased so a rider does not snap between two speeds on the lip.
  const raw = new Float64Array(samples);
  for (let i = 0; i < samples; i++) raw[i] = i >= last ? 1 / pace : flying(i) ? 1 / fly : 1 / rolled;
  const sum = new Float64Array(samples + 1);
  for (let i = 0; i < samples; i++) sum[i + 1] = sum[i] + raw[i];
  const eased = new Float64Array(samples);
  let total = 0;
  for (let i = 0; i < samples; i++) {
    const a = Math.max(0, i - AIR_EASE);
    const b = Math.min(samples, i + AIR_EASE + 1);
    eased[i] = (sum[b] - sum[a]) / (b - a);
    if (i < last) total += eased[i];
  }
  const fit = last / pace / total;
  const map = new Float32Array(samples + 1);
  let t = 0;
  for (let i = 0; i < samples; i++) {
    t += eased[i] * (i < last ? fit : 1) * SAMPLE_EVERY;
    map[i + 1] = t;
  }
  return map;
}

/** Its own tick at a tick of the race, on a slowMap. */
export function ownOnMap(map: Float32Array, played: number, pace: number): number {
  const n = map.length - 1;
  if (played <= 0) return played * pace;
  if (played >= map[n]) return n * SAMPLE_EVERY + (played - map[n]) * pace;
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (map[m] <= played) lo = m;
    else hi = m;
  }
  return (lo + (played - map[lo]) / (map[hi] - map[lo])) * SAMPLE_EVERY;
}

/** The tick of the race it reaches one of its own ticks, on a slowMap. */
export function playedOnMap(map: Float32Array, own: number, pace: number): number {
  const n = map.length - 1;
  const k = own / SAMPLE_EVERY;
  if (k <= 0) return own / pace;
  if (k >= n) return map[n] + (own - n * SAMPLE_EVERY) / pace;
  const i = Math.floor(k);
  return map[i] + (k - i) * (map[i + 1] - map[i]);
}
