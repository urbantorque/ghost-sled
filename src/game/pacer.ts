import { STAGE_LENGTHS } from '../sim/course';
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
// What such a rider did in your race stands in your results, but a grudge or a rematch rides its real run,
// so those are decided on that (ghosts.ts realStanding). The rider beside you at the crash may be a 2:30
// rider who was only waiting for you, and it would come back 1.7 km up the road.
//
// The second is a slow rider in the air. A rider slowed to half speed flew at half speed, and a jump at
// half speed has a quarter of its gravity. So a slower rider's time is taken back on the ground: it flies
// near true speed (slowMap) and still reaches the line on its real time.
//
// Pure: no DOM, render or audio imports.

/** Ticks between readings of your pace. */
export const PACE_EVERY = 15;
/** The first reading. Soon: a rider who has already left you can only come back at the difference in
 *  speed, and a first-timer who tumbles early never saw the pack again. */
export const PACE_FROM = 30;
/** How far ahead a rider aims, in ticks. Shorter chases every wobble, longer lets you get away. */
export const PACE_AIM = 240;
/** The rates a rider reading you may play its run at. The top end is what holds a rider to a strong
 *  first run for most of it; past that you really do ride away from it. */
export const PACE_MIN = 0.35;
export const PACE_MAX = 1.12;
/** Most a rate moves in one reading. Up gently, so nobody rockets past; down twice as fast, because a
 *  rider easing off ahead of you is what lets you back into the race after a tumble. */
export const PACE_SLEW = 0.03;
export const PACE_EASE = 0.06;
/** How fast a rider flies, however slowly it rides: gravity reads as the square of this. */
export const AIR_RATE = 0.85;
/** Metres before the line where the riders stop reading you: the whole last stage (round 8, the race's floor; it was
 *  800). From its line each rider eases back to its own record's pace (ghosts.ts pace), so the last stage is raced on
 *  what each rider really rides and a first run's place is earned there. */
export const PACE_OPEN = STAGE_LENGTHS[STAGE_LENGTHS.length - 1];
/** A rider who read you can be promised next only if its real time is this share of yours or slower:
 *  beyond that the rematch is a rider you never see again. */
const REACH = 0.88;
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

/** The first pass (round 8, G10): on a first run one rider, the front of the string (the quickest record), set off a
 *  moment before you (OPENER_HEAD ticks of its own run) and for the first OPENER_END_T seconds rides like a rider
 *  looking over its shoulder: while it is ahead it keeps about OPENER_LEAD metres on you, easing off as far as
 *  OPENER_MIN of its own pace when you slow or fall (it waits for you; for a rider riding steadily it keeps at least
 *  OPENER_STEADY of it), and never riding faster than its own record;
 *  once you are past it rides its own record's pace and does not chase. So a first-timer who rides (a dash, a perfect
 *  landing's boost, a quick line) goes past a real rider early, and one who only sits on the sled at a steady speed does
 *  not: the opener is as quick as that. Then it takes its place on the string. */
export const OPENER_HEAD = 100;
export const OPENER_LEAD = 6;
export const OPENER_END_T = 20;
export const OPENER_MIN = 0.15;
/** How fast the opener eases off (a reading's step down), quicker than a string rider's: it sees you fall. */
export const OPENER_EASE = 0.25;
/** In the air the opener may ride as slowly as this (the rest of the field never under AIR_RATE): a rider waiting
 *  for you over a jump floats a little, where at AIR_RATE it would leave a fallen first-timer behind every time. */
export const OPENER_AIR = 0.45;

/** The lead the opener keeps: OPENER_LEAD while you ride, and when you slow below OPENER_SLOW of your quickest so far
 *  (read steadily: a fall, a stop against the bank) it drops back to OPENER_WAIT, level with you or a step behind, as a rider waiting
 *  for a friend would; you still have to ride past it. */
export const OPENER_SLOW = 0.7;
export const OPENER_WAIT = -3;
export function openerLead(speed: number, peak: number): number {
  return peak > 0 && speed < OPENER_SLOW * peak ? OPENER_WAIT : OPENER_LEAD;
}

/** The rider of n who is the opener, or -1 with too few to spare one. */
export function openerOf(n: number): number {
  return n >= 3 ? n - 1 : -1;
}

/** The opener's next rate: toward the rate that keeps its lead while it is ahead (`want`), never past its own record's
 *  pace (`pace`) and down to OPENER_MIN of it to wait; once you are past, toward its own pace. */
export function openerRate(cur: number, want: number, ahead: boolean, pace: number, waiting = false): number {
  const target = ahead ? want : pace;
  const step = Math.max(-(waiting ? OPENER_EASE : PACE_EASE), Math.min(PACE_SLEW, target - cur));
  return Math.max((waiting ? OPENER_MIN : OPENER_STEADY) * pace, Math.min(pace, cur + step));
}

/** While you ride steadily the opener never eases below this share of its own pace: it does not hang back for a
 *  rider who is not in trouble (it waits, down to OPENER_MIN, only for one who slowed or fell). */
export const OPENER_STEADY = 0.6;

/** Where rider i of n (slowest first) aims, in metres off your position: + is ahead of you. */
export function stringOffset(i: number, n: number, z: number, finishZ: number): number {
  return onString(i, n, z, finishZ);
}

/** A rider's place on the string, wandering, as it opens. */
function onString(i: number, n: number, z: number, finishZ: number): number {
  const at = n > 1 ? i / (n - 1) : 0.5;
  const place = STRING_BACK + (STRING_FRONT - STRING_BACK) * at;
  const wander = WANDER * Math.sin((2 * Math.PI * z) / (WANDER_LEN + WANDER_STEP * i) + 1.9 * i);
  const tight = Math.min(1, Math.max(0, z / STRING_TIGHT));
  return tight * (place + wander) - STRING_OPENS * Math.min(1, Math.max(0, z / finishZ));
}

/** A real time (seconds) a rider who read you can be raced on, against your time or your pace to the line. */
export function inReach(real: number | null, yours: number): boolean {
  return real !== null && real >= yours * REACH;
}

/** The riders are still reading you at z. */
export function reading(z: number, finishZ: number): boolean {
  return z < finishZ - PACE_OPEN;
}

/** The next rate from the current one and the rate that would land a rider on its place. */
export function paceRate(cur: number, want: number): number {
  const step = Math.max(-PACE_EASE, Math.min(PACE_SLEW, want - cur));
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
