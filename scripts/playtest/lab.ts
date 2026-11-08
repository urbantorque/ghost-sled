// The pilot lab: rides scripted pilots on the real Sim in node, with no browser, across every mountain
// and several seeds, and prints what each one did. It loads the sim from `--root <checkout>`, so one
// plan rides two builds with exactly the same pilots: that is what makes a before and after fair.
//   npx tsx scripts/playtest/lab.ts [--root <checkout>] [--seeds 6] [--pilots clumsy,novice] [--json out.json]
//
// Pilots with no human model at all (the scripted ones) replay the exact input of a bad first run:
//   hands-off   no input
//   hold2s-r/l  rides 1 s, holds one key for 2 s, lets go
//   hold-r      holds one key for the whole run
//   zigzag      swaps keys every second
// Pilots with a human model:
//   clumsy      a first-timer on a keyboard: reacts late to the corridor rather than the safe line, holds
//               keys far too long, overcorrects, mashes the action, sometimes holds a key for 2 s for no
//               reason. Every pilot's randomness is seeded. Its input goes through the same key ramp and
//               quantiser as src/game/input.ts.
//   novice      telemetry.js's novice: wobbly on the safe line, slow hands, lapses, stray taps
//   mid         telemetry.js's mid, without ghosts: aims at near kickers, short drifts, stomps with noise
//   expert      the mid pilot with clean hands
//   stunt       telemetry.js's stunt pilot, read from its source
//   line        the fairness test's driver
// The rail pilot (not in the default list): rides the safe line and steers onto each rail's low end, so
// rails are proved on a real approach and not an injected one. A rail no seed mounted gets a second go
// with nothing else to do but that rail: every lead at every aim, then again holding the action, which
// sticks a sled to the snow over a lip. It prints a table of its own after the main one:
//   rails       npx tsx scripts/playtest/lab.ts --pilots rails --seeds 6
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const ROOT = resolve(opt('root', '.'));
const SEEDS = +opt('seeds', '6');
const MAX_SECONDS = +opt('max', '240');
const OUT = opt('json', '');
const MOOD = +opt('mood', '0');
const EVENT = +opt('event', '0');
const PILOTS = opt('pilots', 'hands-off,hold2s-r,hold2s-l,hold-r,zigzag,clumsy,novice,mid,expert,line,stunt').split(',');

const load = async (p: string) => import(pathToFileURL(resolve(ROOT, p)).href);
const { Sim } = await load('src/sim/sim.ts');
const { MOUNTAINS } = await load('src/sim/mountains.ts');
const { CHUNK_LEN } = await load('src/sim/course.ts');

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** src/game/input.ts's key ramp and quantiser. */
class Keys {
  private keySteer = 0;
  private level = 4;
  sample(target: number): number {
    if (target === 0) this.keySteer = 0;
    else if (this.keySteer * target <= 0) this.keySteer = target * 0.35;
    else this.keySteer = target * Math.min(1, Math.abs(this.keySteer) + 0.055);
    const raw = this.keySteer * 4;
    if (Math.abs(raw - (this.level - 4)) > 0.62) this.level = 4 + Math.round(raw);
    return this.level;
  }
}

type Inp = { steer: number; action: boolean };
/** `after` runs once a tick after the sim stepped (the rail pilot keeps its notes there). */
type Pilot = (() => Inp) & { after?: () => void };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySim = any;

function scripted(fn: (t: number) => number, action: (t: number) => boolean = () => false) {
  return (sim: AnySim): Pilot => {
    const k = new Keys();
    return () => ({ steer: k.sample(fn(sim.tick / 60)), action: action(sim.tick / 60) });
  };
}

function clumsy(sim: AnySim, seed: number): Pilot {
  const rnd = mulberry(seed * 7919 + 13);
  const k = new Keys();
  const c = sim.course;
  let key = 0;
  let keyUntil = 0;
  let nextThink = 0.4 + rnd() * 0.5;
  let act = false;
  let actUntil = 0;
  let nextAct = 1 + rnd() * 3;
  return () => {
    const s = sim.s;
    const T = sim.tick / 60;
    if (T >= keyUntil) key = 0;
    if (T >= nextThink && !s.crashed) {
      nextThink = T + 0.35 + rnd() * 0.45;
      // Aims down the middle of what it can see, not at the safe line, and it looks too near.
      const look = s.z + 9 + rnd() * 6;
      const cx = c.centerX(look) + (rnd() - 0.5) * 5;
      const off = cx - s.x;
      if (key === 0) {
        if (rnd() < 0.12) {
          // The hand freezes on a key for no reason.
          key = rnd() < 0.5 ? 1 : -1;
          keyUntil = T + 1.6 + rnd() * 0.8;
        } else if (Math.abs(off) > 2.2) {
          // A panic correction: far longer than the bend wants, and it overshoots.
          key = off > 0 ? 1 : -1;
          keyUntil = T + 0.5 + rnd() * 1.1;
        }
      }
    }
    if (T >= nextAct) {
      nextAct = T + 1.5 + rnd() * 4;
      act = true;
      actUntil = T + 0.2 + rnd() * 0.9;
    }
    if (T >= actUntil) act = false;
    return { steer: k.sample(key), action: act };
  };
}

function timeToLand(sim: AnySim): { t: number; x: number; z: number } {
  const s = sim.s;
  const c = sim.course;
  let y = s.y;
  let vy = s.vy;
  let x = s.x;
  let z = s.z;
  let t = 0;
  while (t < 4) {
    vy -= sim.gravity / 60;
    y += vy / 60;
    x += s.vx / 60;
    z += s.vz / 60;
    t += 1 / 60;
    if (y <= c.ground(x, z)) break;
  }
  return { t, x, z };
}

/** telemetry.js's frozen novice, mid, expert and line pilots, without the ghost targeting. */
function classic(skill: 'novice' | 'mid' | 'expert' | 'line', sim: AnySim, seed: number): Pilot {
  const rnd = mulberry(seed);
  const c = sim.course;
  const P = { flight: 0, spin: 0, stompTry: false, stompBias: 0, away: 0, tap: 0, drift: 0, wob: rnd() * 6.28, lvl: 4, nextThink: 0, wasAir: false };
  const steerTo = (s: AnySim, target: (z: number) => number, gain: number, lat: number): number => {
    const look = s.z + 4 + s.speed * 0.35;
    const desired = Math.atan2(target(look) - s.x, look - s.z);
    const err = desired - s.velHeading + (c.safeX(s.z) - s.x) * lat;
    return Math.max(0, Math.min(8, Math.round(4 + err * gain)));
  };
  const nextRamp = (s: AnySim) => {
    for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 2; k++) {
      for (const rr of c.zones(k).ramps) {
        if (rr.z + rr.len > s.z + 1 && rr.z - s.z < 70) {
          if (Math.abs(rr.x - c.centerX(rr.z)) > c.halfWidth(rr.z) - 4 || Math.abs(rr.x - c.safeX(rr.z + rr.len)) > 2.5) return null;
          return rr;
        }
      }
    }
    return null;
  };
  return () => {
    const s = sim.s;
    const T = sim.tick / 60;
    if (s.crashed) return { steer: 4, action: false };
    if (!s.grounded) {
      if (!P.wasAir) {
        P.wasAir = true;
        const land = timeToLand(sim);
        P.flight = land.t;
        const room = c.halfWidth(land.z) - Math.abs(land.x - c.centerX(land.z));
        const off = land.x - c.safeX(land.z);
        P.spin = skill !== 'novice' && land.t > 1.45 && room > 4 && Math.abs(off) < 1.5 && rnd() < (skill === 'expert' ? 0.95 : 0.7) ? (off > 0 ? -1 : 1) : 0;
        P.stompTry = skill === 'mid' || skill === 'expert' ? true : skill === 'novice' && rnd() < 0.4;
        P.stompBias = (rnd() - 0.5) * (skill === 'expert' ? 0.05 : skill === 'mid' ? 0.16 : 0.3);
      }
      const land = timeToLand(sim);
      let steer = 4;
      let goal = (skill === 'expert' && P.flight > 2.4 ? 4 : 2) * Math.PI;
      if (goal > 2 * Math.PI && land.t < (goal - Math.abs(s.airYaw)) / 9 + 0.3) goal = 2 * Math.PI;
      const coast = (s.spinRate * s.spinRate) / (2 * 22);
      if (P.spin && Math.abs(s.airYaw) + coast < goal - 0.12 && land.t > 0.2) steer = P.spin > 0 ? 8 : 0;
      else if (skill === 'mid' || skill === 'expert') {
        const off = land.x - c.safeX(land.z);
        if (Math.abs(off) > 0.8) steer = off > 0 ? 2 : 6;
      }
      const w = land.t - P.stompBias;
      return { steer, action: P.stompTry && w < 0.11 && w > 0.01 };
    }
    P.wasAir = false;
    if (skill === 'line') return { steer: steerTo(s, (z) => c.safeX(z), 14, 0.08), action: false };
    if (skill === 'novice') {
      if (P.away > T) return { steer: 4, action: false };
      if (rnd() < 1 / (60 * 30)) {
        P.away = T + 0.5 + rnd() * 0.6;
        return { steer: 4, action: false };
      }
      if (T >= P.nextThink) {
        P.nextThink = T + 0.08 + rnd() * 0.08;
        const wob = 0.45 * Math.sin(T * 0.7 + P.wob) + 0.25 * Math.sin(T * 1.9 + P.wob * 2);
        P.lvl = steerTo(s, (z) => c.safeX(z) + wob, 10, 0.06);
      }
      if (P.tap <= T && rnd() < 1 / (60 * 8)) P.tap = T + 0.3 + rnd() * 0.4;
      return { steer: P.lvl, action: P.tap > T };
    }
    if (P.away > T) return { steer: 4, action: false };
    if (skill === 'mid' && rnd() < 1 / (60 * 70)) {
      P.away = T + 0.4 + rnd() * 0.4;
      return { steer: 4, action: false };
    }
    const ramp = nextRamp(s);
    let target = (z: number) => c.safeX(z);
    if (ramp) target = () => ramp.x;
    const bend = c.safeX(s.z + 24) - c.safeX(s.z + 4);
    const room = c.halfWidth(s.z) - Math.abs(s.x - c.centerX(s.z));
    if (!ramp && P.drift === 0 && Math.abs(bend) > 4.5 && room > 6 && Math.abs(s.x - c.safeX(s.z)) < 0.8 && rnd() < 0.02) P.drift = T + 0.3 + rnd() * 0.25;
    if (P.drift > T && (room < 4 || Math.abs(s.x - c.safeX(s.z)) > 0.8)) P.drift = T;
    if (P.drift > T) return { steer: bend > 0 ? 8 : 0, action: true };
    if (P.drift > 0 && P.drift <= T) P.drift = -(T + 3);
    if (P.drift < 0 && T > -P.drift) P.drift = 0;
    const lvl = steerTo(s, target, 14, ramp ? 0 : 0.08);
    let action = false;
    if (ramp) {
      const u = (s.z - ramp.z) / ramp.len;
      action = u > -0.7 && u < 0.85;
    }
    return { steer: lvl, action };
  };
}

/** Every rail on a course, low end first. */
function railsOn(c: AnySim): AnySim[] {
  const out: AnySim[] = [];
  for (let k = 0; k <= Math.ceil(c.finishZ / CHUNK_LEN); k++) out.push(...c.zones(k).rails);
  return out.sort((a, b) => a.z0 - b.z0);
}

/** One rail with nothing else to do: a set lead (seconds) and aim (metres off the bar), the action held
 *  or not. */
interface Alone {
  id: number;
  lead: number;
  aim: number;
  hold: boolean;
}

/** On or just past a kicker. */
function onKicker(c: AnySim, x: number, z: number): boolean {
  const k = Math.floor(z / CHUNK_LEN);
  for (let i = Math.max(0, k - 1); i <= k; i++) {
    for (const r of c.zones(i).ramps) if (z > r.z - 1 && z < r.z + r.len + 3 && Math.abs(x - r.x) < r.w * 0.5 + 1) return true;
  }
  return false;
}

/** How a rail's low end went by. The window is the sim's own (Sim.tryRail): a sled on the snow, within
 *  0.7 m of the bar in the first 1.4 m of it, at 9 m/s or more, its heading within 0.6 rad of straight
 *  down the z axis. */
interface RailPass {
  id: number;
  entered: boolean;
  /** The rider came to it riding: not crashed before it. */
  reached: boolean;
  /** It saw a clear way onto it, and back to the line, and went for it. */
  tried: boolean;
  /** Why it did not mount: what kept the sled out of the window for most of it. In the air, what put
   *  it there: `air:kicker` (a kicker the line goes over) or `air:lip` (the ground fell away).
   *  `blocked`: every lead's way there or back has something in it, so a rider would leave it. */
  why: string;
}

/** Seconds out that the rider may start for a rail's low end, shortest first: a late move, or early
 *  enough to be beside a kicker rather than on it, or settled before a flight it cannot steer in. */
const LEADS = [1, 1.4, 1.9, 2.5, 3.2, 4];
/** Metres off the bar a rider aims when a rail is tried alone: the steering's lag has a side. */
const AIMS = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2];
/** Holding the action from this far before a low end sticks the sled to the snow over a lip. */
const HOLD_M = 60;
/** A hit this close before a low end is the approach's fault. */
const APPROACH_M = 150;
/** The rail's line is reached this far through the lead, then held. */
const SETTLED = 0.6;
/** Seconds to ease back onto the safe line from a rail's high end. */
const BACK_S = 1.6;
/** Metres a planned path keeps from an obstacle's edge: the steering's lag, and a sled's width. */
const CLEAR_M = 0.9;
/** A flight off a kicker reaches about this far: one closer than this to a low end flies over it. */
const FLIGHT_M = 70;
/** A rider reads the course this far ahead for the shortest clear way onto the next rail. */
const SPEED_GUESS = 34;

const hill = (k: number): number => {
  const t = Math.max(0, Math.min(1, k));
  return t * t * (3 - 2 * t);
};

/** Rides the safe line, and steers onto the next rail's low end, stays with the bar to its end, and
 *  eases back. It reads the course as a rider does: it takes the shortest lead whose way there and back
 *  stays off the obstacles and off a kicker, and leaves a rail with no such way alone. Seeded: each
 *  rail gets its own small aiming error, and a few rails their next lead along, so the seeds are
 *  different approaches. `alone`: one rail, every other left alone, at a set lead and aim. */
function railPilot(sim: AnySim, seed: number, passes: RailPass[], alone: Alone | null = null): Pilot {
  const c = sim.course;
  const rnd = mulberry(seed * 104729 + 7);
  const rails = railsOn(c).filter((r) => alone === null || r.id === alone.id);
  const hold = alone?.hold ?? false;
  const blockers = (z0: number, z1: number): AnySim[] => {
    const out: AnySim[] = [];
    for (let i = Math.max(0, Math.floor(z0 / CHUNK_LEN) - 1); i <= Math.floor(z1 / CHUNK_LEN) + 1; i++) out.push(...c.chunk(i).obstacles);
    return out;
  };
  const gap = (o: AnySim, x: number, z: number): number => {
    let px = o.x;
    let pz = o.z;
    if (o.x2 !== o.x || o.z2 !== o.z) {
      const ex = o.x2 - o.x;
      const ez = o.z2 - o.z;
      const t = Math.max(0, Math.min(1, ((x - o.x) * ex + (z - o.z) * ez) / (ex * ex + ez * ez)));
      px = o.x + ex * t;
      pz = o.z + ez * t;
    }
    return Math.hypot(x - px, z - pz) - o.r;
  };
  /** The sled's planned x at z, for a rail taken with this lead: `from` metres out to its low end, along
   *  it, and back to the line. */
  const planned = (r: AnySim, from: number, end: number, bias: number, z: number): number => {
    const over = r.x0 + bias - c.safeX(r.z0);
    if (z < r.z0) return c.safeX(z) + over * hill((z - from) / ((r.z0 - from) * SETTLED));
    if (z <= r.z1) return r.x0 + bias * Math.max(0, 1 - (z - r.z0) / 10) + ((r.x1 - r.x0) * (z - r.z0)) / (r.z1 - r.z0);
    return c.safeX(z) + (r.x1 - c.safeX(r.z1)) * (1 - hill((z - r.z1) / (end - r.z1)));
  };
  const clearWay = (r: AnySim, from: number, end: number, bias: number): boolean => {
    const obs = blockers(from, end);
    for (let z = from; z <= end; z += 1) {
      const x = planned(r, from, end, bias, z);
      // (Along the bar a grinding sled collides with nothing: only the ways on and off count.)
      if (z >= r.z0 + 1 && z <= r.z1) continue;
      for (const o of obs) if (Math.abs(((o.z + o.z2) / 2) - z) < 12 && gap(o, x, z) < CLEAR_M) return false;
      if (z < r.z0 && r.z0 - z < FLIGHT_M && onKicker(c, x, z)) return false;
    }
    return true;
  };
  /** The shortest clear lead for a rail, or null. */
  const leadFor = (r: AnySim, bias: number, extra: number): number | null => {
    const end = r.z1 + SPEED_GUESS * BACK_S;
    if (alone) return alone.lead;
    const open = LEADS.filter((l) => clearWay(r, r.z0 - SPEED_GUESS * l, end, bias));
    return open.length ? open[Math.min(extra, open.length - 1)] : null;
  };
  let next = 0;
  let bias = alone ? alone.aim : (rnd() - 0.5) * 0.5;
  let lead = rails.length ? leadFor(rails[0], bias, rnd() < 0.3 ? 1 : 0) : null;
  let back: { r: AnySim; end: number } | null = null;
  let flew = { kicker: false };
  // The window as it goes by: what kept the sled out of it, tick by tick.
  let seen = { ticks: 0, air: 0, wide: 0, turned: 0, slow: 0, down: 0, busy: 0 };
  const steerAt = (s: AnySim, target: (z: number) => number, lat: number): number => {
    const look = s.z + 4 + s.speed * 0.35;
    const err = Math.atan2(target(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * lat;
    return Math.max(0, Math.min(8, Math.round(4 + err * 14)));
  };
  const pilot: Pilot = () => {
    const s = sim.s;
    const r = rails[next];
    const action = hold && !!r && s.z > r.z0 - HOLD_M;
    if (s.crashed || s.grinding || !s.grounded || s.tumble > 0) return { steer: 4, action };
    if (back && s.z > back.end) back = null;
    const from = r && lead !== null ? r.z0 - SPEED_GUESS * lead : Infinity;
    if (r && lead !== null && s.z >= from) return { steer: steerAt(s, (z) => planned(r, from, r.z1 + SPEED_GUESS * BACK_S, bias, z), 0), action };
    if (back) {
      const b = back;
      return { steer: steerAt(s, (z) => planned(b.r, b.r.z0 - 1, b.end, 0, Math.max(z, b.r.z1)), 0), action: false };
    }
    return { steer: steerAt(s, (z) => c.safeX(z), 0.08), action: false };
  };
  pilot.after = () => {
    const s = sim.s;
    const r = rails[next];
    if (!r) return;
    // (A kicker's launch is a takeoff on its top; the rest of the lips are the ground falling away.)
    if (sim.events.some((e: AnySim) => e.type === 'takeoff')) flew = { kicker: onKicker(c, s.x, s.z) };
    const d = s.z - r.z0;
    if (d >= 0 && d <= 1.4) {
      seen.ticks++;
      const rx = r.x0 + ((r.x1 - r.x0) * d) / (r.z1 - r.z0);
      const here = sim.events.some((e: AnySim) => e.type === 'grind' && e.id === r.id);
      if (s.grinding && !here) seen.busy++;
      else if (s.tumble > 0) seen.down++;
      else if (!s.grounded) seen.air++;
      else if (Math.abs(s.x - rx) > 0.7) seen.wide++;
      else if (s.velHeading < -0.6 || s.velHeading > 0.6) seen.turned++;
      else if (s.speed < 9) seen.slow++;
    }
    const entered = sim.events.some((e: AnySim) => e.type === 'grind' && e.phase === 'start' && e.id === r.id);
    if (!entered && d <= 1.4 && !s.crashed) return;
    const best = (Object.keys(seen) as (keyof typeof seen)[]).filter((k) => k !== 'ticks').sort((a, b) => seen[b] - seen[a])[0];
    const reached = entered || !s.crashed || seen.ticks > 0;
    const air = flew.kicker ? 'air:kicker' : 'air:lip';
    const why = lead === null ? 'blocked' : seen.ticks === 0 ? 'crashed' : seen[best] === 0 ? 'unknown' : best === 'air' ? air : best;
    passes.push({ id: r.id, entered, reached, tried: reached && lead !== null, why: entered ? '' : why });
    if (entered) back = { r, end: r.z1 + s.speed * BACK_S };
    next++;
    bias = (rnd() - 0.5) * 0.5;
    if (rails[next]) lead = leadFor(rails[next], bias, rnd() < 0.3 ? 1 : 0);
    seen = { ticks: 0, air: 0, wide: 0, turned: 0, slow: 0, down: 0, busy: 0 };
  };
  return pilot;
}

function loadStunt(): (sim: AnySim, o: { seed: number }) => { sample(): Inp } {
  const src = readFileSync(resolve(ROOT, 'scripts/playtest/telemetry.js'), 'utf8');
  const m = /\/\* STUNT:BEGIN \*\/([\s\S]*?)\/\* STUNT:END \*\//.exec(src);
  if (!m) throw new Error('no stunt pilot');
  return new Function(`${m[1]}\nreturn makeStuntPilot;`)();
}
const stuntMake = PILOTS.includes('stunt') ? loadStunt() : null;

function pilotFor(name: string, sim: AnySim, seed: number, passes: RailPass[], alone: Alone | null): Pilot {
  switch (name) {
    case 'rails':
      return railPilot(sim, seed, passes, alone);
    case 'hands-off':
      return scripted(() => 0)(sim);
    case 'hold2s-r':
      return scripted((t) => (t > 1 && t < 3 ? 1 : 0))(sim);
    case 'hold2s-l':
      return scripted((t) => (t > 1 && t < 3 ? -1 : 0))(sim);
    case 'hold-r':
      return scripted(() => 1)(sim);
    case 'zigzag':
      return scripted((t) => (Math.floor(t) % 2 === 0 ? 1 : -1))(sim);
    case 'clumsy':
    case 'clumsy-keep':
      return clumsy(sim, seed);
    case 'stunt': {
      const p = stuntMake!(sim, { seed });
      return () => p.sample();
    }
    default:
      return classic(name as 'novice', sim, seed);
  }
}

/** How each pilot spends its lantern (SIM_VERSION 7): the button is bit 6, a dash on its press. A build
 *  without a lantern never sees the bit (old sims mask it off), so one plan still rides two builds.
 *    hands-off, hold*, zigzag, line: never press it (line is the careful rider who keeps every ward)
 *    clumsy: mashes it now and then, whatever is ahead, like a first-timer finding a new key
 *    novice: keeps one lantern as a ward, spends a second on the snow a beat after it lights
 *    mid, stunt: spend any full lantern on the snow with no kicker close ahead, keeping one past 2 km
 *    expert: spends at once, and best of all into a line that closes ahead (a spirit rides through)
 */
function spenderFor(name: string, sim: AnySim, seed: number): () => boolean {
  const rnd = mulberry(seed ^ 0x5a17);
  let hold = 0;
  let wait = 0;
  const lit = (): number => Math.floor((sim.s.lantern ?? 0) / 100);
  const kickerNear = (): boolean => {
    const s = sim.s;
    const k0 = Math.floor(s.z / CHUNK_LEN);
    for (let k = k0; k <= k0 + 1; k++) for (const r of sim.course.zones(k).ramps) if (r.z > s.z - 2 && r.z < s.z + 30 && Math.abs(r.x - s.x) < 5) return true;
    return false;
  };
  const closing = (): boolean => {
    const s = sim.s;
    const k0 = Math.floor(s.z / CHUNK_LEN);
    for (let k = k0; k <= k0 + 1; k++)
      for (const o of sim.course.chunk(k).obstacles) {
        if (o.soft || o.z < s.z + 4 || o.z > s.z + 18) continue;
        const ahead = s.x + (s.vx / Math.max(1, s.vz)) * (o.z - s.z);
        if (Math.abs(o.x - ahead) < o.r + 1) return true;
      }
    return false;
  };
  const press = (): boolean => {
    hold = 3;
    return true;
  };
  return () => {
    if (hold > 0) {
      hold--;
      return true;
    }
    const s = sim.s;
    if (s.lantern === undefined || s.dash > 0 || s.tumble > 0 || s.finished) return false;
    switch (name) {
      case 'clumsy':
        return rnd() < 0.15 / 60 ? press() : false;
      case 'clumsy-keep':
        return false;
      case 'novice':
        if (lit() >= 2 && s.grounded) {
          if (++wait > 50) {
            wait = 0;
            return press();
          }
        } else wait = 0;
        return false;
      case 'mid':
      case 'stunt': {
        const keep = s.z > 2000 ? 1 : 0;
        return lit() > keep && s.grounded && !kickerNear() && rnd() < 0.6 / 60 ? press() : false;
      }
      case 'expert':
        if (lit() < 1 || !s.grounded || kickerNear()) return false;
        return closing() || rnd() < 0.9 / 60 ? press() : false;
      default:
        return false;
    }
  };
}

interface Ride {
  pilot: string;
  m: number;
  seed: number;
  seconds: number;
  distance: number;
  cause: string | null;
  meanSpeed: number;
  p50: number;
  p90: number;
  peak: number;
  first15Mean: number;
  speed60: number;
  rescues: number;
  takeoffs: number;
  airSeconds: number;
  landings: Record<string, number>;
  stomps: number;
  bumps: number;
  bankShare: number;
  score: number;
  gifts: number;
  sections: Record<string, number>;
  finished: boolean;
  stages: number;
  grinds: number;
  grindSeconds: number;
  rails: RailPass[];
  /** Where the last hit came, sim z. */
  lastHit: number;
  /** The lantern (SIM_VERSION 7; zero on older sims). */
  lights: number;
  lit: number;
  dashes: number;
  wards: number;
  gates: number;
  phased: number;
}

function ride(pilotName: string, m: number, seed: number, alone: Alone | null = null): Ride {
  const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: MOOD, event: EVENT, seed: 0x1234 }, sled: 0 });
  const passes: RailPass[] = [];
  const pilot = pilotFor(pilotName, sim, seed, passes, alone);
  const spend = spenderFor(pilotName, sim, seed);
  const speeds: number[] = [];
  const r: Ride = { pilot: pilotName, m, seed, seconds: 0, distance: 0, cause: null, meanSpeed: 0, p50: 0, p90: 0, peak: 0, first15Mean: 0, speed60: 0, rescues: 0, takeoffs: 0, airSeconds: 0, landings: {}, stomps: 0, bumps: 0, bankShare: 0, score: 0, gifts: 0, sections: {}, finished: false, stages: 0, grinds: 0, grindSeconds: 0, rails: passes, lastHit: -1e9, lights: 0, lit: 0, dashes: 0, wards: 0, gates: 0, phased: 0 };
  let bankTicks = 0;
  let airTicks = 0;
  let grindTicks = 0;
  while (!sim.s.crashed && !sim.finished && sim.tick < MAX_SECONDS * 60) {
    const o = pilot();
    sim.step((o.steer | 0) | (o.action ? 16 : 0) | (spend() ? 64 : 0));
    pilot.after?.();
    const s = sim.s;
    speeds.push(s.speed);
    if (s.grinding) grindTicks++;
    if (!s.grounded) airTicks++;
    if (sim.course.edgeExcess(s.x, s.z) > 0) bankTicks++;
    const sec = sim.course.section(s.z).kind;
    r.sections[sec] = (r.sections[sec] || 0) + 1;
    for (const e of sim.events) {
      if (e.type === 'takeoff') r.takeoffs++;
      else if (e.type === 'land') {
        r.landings[e.quality] = (r.landings[e.quality] || 0) + 1;
        if (e.quality === 'perfect') r.stomps++;
      } else if (e.type === 'bump') r.bumps++;
      else if (e.type === 'tumble' && e.phase === 'start') {
        r.rescues++;
        r.lastHit = s.z;
      }
      else if (e.type === 'stage') r.stages++;
      else if (e.type === 'grind' && e.phase === 'start') r.grinds++;
    }
    // (A rail tried alone is over once its low end has gone by.)
    if (alone && passes.length) break;
  }
  r.grindSeconds = grindTicks / 60;
  const n = speeds.length;
  const sorted = [...speeds].sort((a, b) => a - b);
  r.seconds = n / 60;
  r.distance = sim.distance;
  r.cause = sim.s.crashCause;
  r.finished = !!sim.finished;
  r.meanSpeed = speeds.reduce((a, b) => a + b, 0) / Math.max(1, n);
  r.p50 = sorted[Math.floor(n * 0.5)] ?? 0;
  r.p90 = sorted[Math.floor(n * 0.9)] ?? 0;
  r.peak = sorted[n - 1] ?? 0;
  const f15 = speeds.slice(0, 900);
  r.first15Mean = f15.reduce((a, b) => a + b, 0) / Math.max(1, f15.length);
  r.speed60 = n > 3600 ? speeds[3600] : 0;
  r.airSeconds = airTicks / 60;
  r.bankShare = bankTicks / Math.max(1, n);
  r.score = sim.score;
  r.gifts = sim.gifts ?? 0;
  const st = sim.stats;
  r.lights = st.lights ?? 0;
  r.lit = st.lit ?? 0;
  r.dashes = st.dashes ?? 0;
  r.wards = st.wards ?? 0;
  r.gates = st.skyGates ?? 0;
  r.phased = st.phased ?? 0;
  return r;
}

const med = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const fmt = (v: number, d = 1): string => v.toFixed(d).padStart(7);

const all: Ride[] = [];
console.log(`root ${ROOT}  seeds ${SEEDS}  mood ${MOOD} event ${EVENT}`);
console.log('pilot      mtn    runs   secs(med)  dist(med)  mean m/s   p90 m/s   peak   first15   air/min  stomps/min  bank%  lights  lanterns  dashes  wards  gates  causes');
for (const p of PILOTS) {
  const seedsFor = p.startsWith('hold') || p === 'hands-off' || p === 'zigzag' ? 1 : SEEDS;
  for (let m = 0; m < MOUNTAINS.length; m++) {
    const rides: Ride[] = [];
    for (let i = 0; i < seedsFor; i++) rides.push(ride(p, m, 1234 + i * 37));
    all.push(...rides);
    const causes: Record<string, number> = {};
    for (const r of rides) {
      const k = r.finished ? 'FINISH' : r.cause ?? 'timeout';
      causes[k] = (causes[k] || 0) + 1;
    }
    const mins = rides.reduce((a, r) => a + r.seconds / 60, 0);
    console.log(
      p.padEnd(10),
      MOUNTAINS[m].id.slice(0, 6).padEnd(6),
      String(rides.length).padStart(4),
      fmt(med(rides.map((r) => r.seconds))),
      fmt(med(rides.map((r) => r.distance)), 0),
      fmt(med(rides.map((r) => r.meanSpeed))),
      fmt(med(rides.map((r) => r.p90))),
      fmt(Math.max(...rides.map((r) => r.peak))),
      fmt(med(rides.map((r) => r.first15Mean))),
      fmt(rides.reduce((a, r) => a + r.airSeconds, 0) / mins),
      fmt(rides.reduce((a, r) => a + r.stomps, 0) / mins),
      fmt(100 * med(rides.map((r) => r.bankShare)), 0),
      fmt(med(rides.map((r) => r.lights)), 0),
      fmt(med(rides.map((r) => r.lit / 100)), 1),
      fmt(med(rides.map((r) => r.dashes)), 0),
      fmt(med(rides.map((r) => r.wards)), 0),
      fmt(rides.reduce((a, r) => a + r.gates, 0), 0),
      ' ' + Object.entries(causes).map(([k, v]) => `${k}:${v}`).join(' '),
    );
  }
}
if (PILOTS.includes('rails')) railTable(all.filter((r) => r.pilot === 'rails'));

/** What the rail pilot proved: per mountain, then every rail no seed mounted, retried on its own. */
function railTable(rides: Ride[]): void {
  console.log('\nrails       runs  on course  reached    tried  entered  of tried  grind s/run  finished  never mounted');
  const never: { m: number; id: number; why: Record<string, number> }[] = [];
  for (let m = 0; m < MOUNTAINS.length; m++) {
    const rs = rides.filter((r) => r.m === m);
    if (!rs.length) continue;
    const list = railsOn(new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: MOOD, event: EVENT, seed: 0x1234 }, sled: 0 }).course);
    const reached = rs.reduce((a, r) => a + r.rails.filter((p) => p.reached).length, 0);
    const entered = rs.reduce((a, r) => a + r.rails.filter((p) => p.entered).length, 0);
    const tried = rs.reduce((a, r) => a + r.rails.filter((p) => p.tried).length, 0);
    const cold = list.filter((rail) => !rs.some((r) => r.rails.some((p) => p.id === rail.id && p.entered)));
    for (const rail of cold) {
      const why: Record<string, number> = {};
      for (const r of rs) for (const p of r.rails) if (p.id === rail.id) why[p.why] = (why[p.why] || 0) + 1;
      never.push({ m, id: rail.id, why });
    }
    console.log(
      MOUNTAINS[m].id.slice(0, 10).padEnd(10),
      String(rs.length).padStart(5),
      String(list.length).padStart(10),
      fmt(reached / rs.length),
      fmt(tried / rs.length),
      fmt(entered / rs.length),
      `${fmt((100 * entered) / Math.max(1, tried), 0)}%`.padStart(9),
      fmt(rs.reduce((a, r) => a + r.grindSeconds, 0) / rs.length).padStart(12),
      `${rs.filter((r) => r.finished).length}/${rs.length}`.padStart(9),
      String(cold.length).padStart(14),
    );
  }
  if (!never.length) return;
  console.log(`\nnever mounted in a full ride: each tried alone, ${LEADS.length} leads at ${AIMS.length} aims (clean: no hit on the last ${APPROACH_M} m in)`);
  console.log('mountain   rail      z  section       off line  why in the full ride        clean/tries  held  kicker before it        why alone');
  for (const n of never) {
    const c = new Sim({ seed: MOUNTAINS[n.m].seed, chaos: { mood: MOOD, event: EVENT, seed: 0x1234 }, sled: 0 }).course;
    const rail = railsOn(c).find((r) => r.id === n.id);
    const tries = (hold: boolean) => LEADS.flatMap((lead) => AIMS.map((aim) => ride('rails', n.m, 1234, { id: n.id, lead, aim, hold })));
    const count = (rs: Ride[]) => rs.filter((r) => r.lastHit < rail.z0 - APPROACH_M && r.rails.some((p) => p.entered)).length;
    const free = tries(false);
    const held = tries(true);
    const why: Record<string, number> = {};
    for (const r of free) for (const p of r.rails) if (!p.entered) why[p.why] = (why[p.why] || 0) + 1;
    let kick = '';
    for (let k = Math.floor((rail.z0 - 90) / CHUNK_LEN); k <= Math.floor(rail.z0 / CHUNK_LEN); k++) {
      for (const r of c.zones(Math.max(0, k)).ramps) {
        const gap = rail.z0 - (r.z + r.len);
        if (gap >= 0 && gap < 80) kick = `${gap.toFixed(0)} m back, ${r.w.toFixed(1)} wide`;
      }
    }
    console.log(
      MOUNTAINS[n.m].id.slice(0, 10).padEnd(10),
      String(n.id).padStart(4),
      fmt(rail.z0, 0),
      c.section(rail.z0).kind.padEnd(13),
      fmt(Math.abs(rail.x0 - c.safeX(rail.z0)), 1),
      '',
      Object.entries(n.why).map(([k, v]) => `${k}:${v}`).join(' ').padEnd(26),
      `${count(free)}/${free.length}`.padStart(9),
      String(count(held)).padStart(5),
      '',
      kick.padEnd(22),
      Object.entries(why).map(([k, v]) => `${k}:${v}`).join(' '),
    );
  }
}

if (OUT) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(OUT, JSON.stringify(all));
}
