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
type Pilot = () => Inp;
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

function loadStunt(): (sim: AnySim, o: { seed: number }) => { sample(): Inp } {
  const src = readFileSync(resolve(ROOT, 'scripts/playtest/telemetry.js'), 'utf8');
  const m = /\/\* STUNT:BEGIN \*\/([\s\S]*?)\/\* STUNT:END \*\//.exec(src);
  if (!m) throw new Error('no stunt pilot');
  return new Function(`${m[1]}\nreturn makeStuntPilot;`)();
}
const stuntMake = PILOTS.includes('stunt') ? loadStunt() : null;

function pilotFor(name: string, sim: AnySim, seed: number): Pilot {
  switch (name) {
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
      return clumsy(sim, seed);
    case 'stunt': {
      const p = stuntMake!(sim, { seed });
      return () => p.sample();
    }
    default:
      return classic(name as 'novice', sim, seed);
  }
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
}

function ride(pilotName: string, m: number, seed: number): Ride {
  const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: MOOD, event: EVENT, seed: 0x1234 }, sled: 0 });
  const pilot = pilotFor(pilotName, sim, seed);
  const speeds: number[] = [];
  const r: Ride = { pilot: pilotName, m, seed, seconds: 0, distance: 0, cause: null, meanSpeed: 0, p50: 0, p90: 0, peak: 0, first15Mean: 0, speed60: 0, rescues: 0, takeoffs: 0, airSeconds: 0, landings: {}, stomps: 0, bumps: 0, bankShare: 0, score: 0, gifts: 0, sections: {}, finished: false, stages: 0 };
  let bankTicks = 0;
  let airTicks = 0;
  while (!sim.s.crashed && !sim.finished && sim.tick < MAX_SECONDS * 60) {
    const o = pilot();
    sim.step((o.steer | 0) | (o.action ? 16 : 0));
    const s = sim.s;
    speeds.push(s.speed);
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
      else if (e.type === 'tumble' && e.phase === 'start') r.rescues++;
      else if (e.type === 'stage') r.stages++;
    }
  }
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
  r.gifts = sim.gifts;
  return r;
}

const med = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const fmt = (v: number, d = 1): string => v.toFixed(d).padStart(7);

const all: Ride[] = [];
console.log(`root ${ROOT}  seeds ${SEEDS}  mood ${MOOD} event ${EVENT}`);
console.log('pilot      mtn    runs   secs(med)  dist(med)  mean m/s   p90 m/s   peak   first15   air/min  stomps/min  bank%  causes');
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
      ' ' + Object.entries(causes).map(([k, v]) => `${k}:${v}`).join(' '),
    );
  }
}
if (OUT) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(OUT, JSON.stringify(all));
}
