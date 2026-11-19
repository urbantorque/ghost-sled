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
//   expert-dash (not in the default list) the expert's hands with round 6's habit of dashing the moment a
//               lantern lights: what knowing where a dash belongs is worth
// The rail pilot (not in the default list): rides the safe line and steers onto each rail's low end, so
// rails are proved on a real approach and not an injected one. A rail no seed mounted gets a second go
// with nothing else to do but that rail: every lead at every aim, then again holding the action, which
// sticks a sled to the snow over a lip. It prints a table of its own after the main one:
//   rails       npx tsx scripts/playtest/lab.ts --pilots rails --seeds 6
// Round 7: each seed rides its own roll, so the six seeds ride a spread of every set piece's variants (the same
// spread for every pilot); the tables at the end say set pieces won by pilot, by verb and by variant, and
// finishes and median times by pilot. To ride one variant or a legend everywhere:
//   --variant 1   every set piece's second variant     --legend 2   the mountain's second legend
//   --mountains 4 only the fifth mountain (a list: 0,2)
// Falls (round 7): every ride notes where and why its rider went down, and a table after the main one gives
// each pilot's finishes, falls and wrecks. With --falls it also prices every fall: the same pilot rides the
// same run again to the tick of the fall, and from there rides the next 300 m as a spirit that nothing can
// touch (no fall, no bump: more than any line that avoided the hit could have kept). The two rides are
// compared: how far behind the faller is as it gets up, and how many seconds later it passes the point 300 m
// on. The second number takes in whatever else either rider did on the way (a pilot is a closed loop: the
// two rides part at the fall and never meet the same snow again), so read its median; each fall that came
// out cheaper is printed with its cost at every 50 m and both riders' speeds, which says who lost the time.
// The third price takes the pilot out: both rides are finished by the same steady hand (steadyPilot: straight
// down the run where it is, no detour, no button, no mistake), so what is left between them is the fall and
// nothing else. That is the one to read for "is anyone ever faster for falling". A get-up run is long, so
// ride with --max 420 when a struggling pilot is in the plan.
//   falls       npx tsx scripts/playtest/lab.ts --pilots clumsy,novice,mid,expert,stunt --max 420 --falls
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { type Inp, type Kit, type Pilot, classic, clumsy, mulberry, scripted, spenderFor, steadyPilot, trickster } from './labpilots';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySim = any;

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
const PRICE = argv.includes('--falls');
/** A fall is priced over this many metres past where it began. */
const PRICE_M = 300;
const PILOTS = opt('pilots', 'hands-off,hold2s-r,hold2s-l,hold-r,zigzag,clumsy,novice,mid,expert,line,stunt').split(',');
const VARIANT = +opt('variant', '-1');
const LEGEND = +opt('legend', '0');
const ONLY = opt('mountains', '');
/** Round 8: --lane 0|1|2 rides every charm gate in that lane (the mid and expert pilots), --pool <mask> deals from
 *  that charm pool (default: every charm), --carry <id> holds that charm from the start, --gates 1|2|3. */
const LANE = +opt('lane', '-1');
const POOL = +opt('pool', String((1 << 24) - 1));
const CARRY = +opt('carry', '-1');
const GATES = +opt('gates', '3');

const load = async (p: string) => import(pathToFileURL(resolve(ROOT, p)).href);
const { Sim } = await load('src/sim/sim.ts');
const { MOUNTAINS } = await load('src/sim/mountains.ts');
const { CHUNK_LEN } = await load('src/sim/course.ts');
// What a round 7 sim's set pieces give the pilots (an older build has none of it, and its pilots need none).
const momentsMod = await load('src/sim/moments.ts').catch(() => ({}));
const KIT: Kit = { gateX: momentsMod.gateX, pathX: momentsMod.pathX, machineZ: momentsMod.machineZ };
const MOUNTAIN_LIST: number[] = ONLY ? ONLY.split(',').map(Number) : MOUNTAINS.map((_: unknown, i: number) => i);
/** The sim's length of a fall (66 before round 7, when a tumble was one piece). */
const TUMBLE_TICKS: number = (await load('src/sim/sim.ts')).TUMBLE_TICKS ?? 66;

/** The roll a seed rides: plain (or --mood, --event), with its own seed, which picks the set pieces' variants. */
function rollFor(m: number, seed: number): AnySim {
  let roll: AnySim = { mood: MOOD, event: EVENT, seed: (0x1234 + seed * 2654435761) >>> 0 };
  if (LEGEND > 0) roll.legend = LEGEND;
  if (VARIANT >= 0 && momentsMod.rollForVariant) roll = momentsMod.rollForVariant(new Sim({ seed: MOUNTAINS[m].seed, chaos: roll, sled: 0 }).course, roll, VARIANT);
  return roll;
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
    case 'expert-dash':
    case 'expert-classic':
      return classic('expert', sim, seed, KIT);
    case 'mid-classic':
      return classic('mid', sim, seed, KIT);
    // Round 8: the mid and expert pilots ride the air map and the charm gates (labpilots.ts trickster).
    case 'mid':
    case 'expert':
      return trickster(name, sim, seed, LANE >= 0 ? { ...KIT, lane: LANE } : KIT);
    default:
      return classic(name as 'novice', sim, seed, KIT);
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
  grinds: number;
  grindSeconds: number;
  rails: RailPass[];
  /** Where the last hit came, sim z. */
  lastHit: number;
  /** Every time the rider went down: the tick and place, why, and what it was (a fall got up from, a ward that
   *  took it, or the wreck that ended the run), the speed going in, and with --falls its price. */
  falls: Fall[];
  /** The tick the ride reached each whole 10 m (the price of a fall is read off two of these). */
  marks: number[];
  /** The lantern (SIM_VERSION 7; zero on older sims). */
  lights: number;
  lit: number;
  dashes: number;
  wards: number;
  gates: number;
  phased: number;
  /** Set pieces (SIM_VERSION 8; none on older sims): each one met, its verb, outcome and count, the speed coming
   *  in and the seconds it took. */
  moments: { index: number; key: string; verb: string; variant: string; won: boolean; n: number; of: number; v0: number; secs: number }[];
  /** The legend moment the run met (its key, '' for none) and what it lit (round 7). */
  legend: string;
  legendLit: number;
  /** Round 8: the most different named tricks one combo held, the named tricks landed and their kinds, the charms
   *  taken (ids), Spirit Flow's best level, and the choices that changed the rest of the run (charms taken, and
   *  dashes and wards: a lantern spent either way). */
  comboTricks?: number;
  tricks?: number;
  trickKinds?: number;
  charms?: number[];
  bestFlow?: number;
  choices?: number;
}

interface Fall {
  tick: number;
  z: number;
  cause: string;
  kind: 'fall' | 'ward' | 'wreck';
  v: number;
  /** As it went down: its speed down the run, how far off the safe line, and how far past the corridor's edge. */
  vz: number;
  off: number;
  edge: number;
  /** Metres behind the untouched ride as the faller rides again, and seconds behind PRICE_M on (null when
   *  either ride did not get that far). */
  behind?: number | null;
  cost?: number | null;
  /** The cost at every 50 m of the way, with the faller's and the untouched ride's speed over each. */
  profile?: string;
  /** The cost with the same steady hand riding both from the fall on: the fall's own price, with what the
   *  pilot did next taken out. */
  sure?: number | null;
}

/** `spare`: the tick of a fall this ride is carried through untouched (the priced ride); it stops PRICE_M past it.
 *  `steady`: from this tick on a steady hand rides (steadyPilot; nobody spends a lantern), and the ride stops
 *  PRICE_M on: two rides that differ only by the fall are then ridden the same way after it. */
function ride(pilotName: string, m: number, seed: number, alone: Alone | null = null, spare = -1, steady = -1): Ride {
  const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: rollFor(m, seed), sled: 0, charmPool: POOL, ...(GATES === 1 || GATES === 2 ? { charmGates: GATES } : {}), ...(CARRY >= 0 ? { carry: { lantern: 0, getUps: 3, charms: [CARRY] } } : {}) });
  const passes: RailPass[] = [];
  let pilot = pilotFor(pilotName, sim, seed, passes, alone);
  // (The classic pilots spend as their namesakes do.)
  let spend = spenderFor(pilotName.replace(/-classic$/, ''), sim, seed);
  let steadyZ = Infinity;
  const speeds: number[] = [];
  const falls: Fall[] = [];
  const marks: number[] = [];
  let spareZ = Infinity;
  const r: Ride = { pilot: pilotName, m, seed, seconds: 0, distance: 0, cause: null, meanSpeed: 0, p50: 0, p90: 0, peak: 0, first15Mean: 0, speed60: 0, rescues: 0, takeoffs: 0, airSeconds: 0, landings: {}, stomps: 0, bumps: 0, bankShare: 0, score: 0, gifts: 0, sections: {}, finished: false, stages: 0, grinds: 0, grindSeconds: 0, rails: passes, lastHit: -1e9, falls, marks, lights: 0, lit: 0, dashes: 0, wards: 0, gates: 0, phased: 0, moments: [], legend: '', legendLit: 0 };
  const mStart = new Map<number, { tick: number; v: number }>();
  // (Round 8: the named tricks in the combo under way, and the most a combo held.)
  let combo = new Set<number>();
  let bestCombo = 0;
  let tricksLanded = 0;
  const trickKinds = new Set<number>();
  let bankTicks = 0;
  let airTicks = 0;
  let grindTicks = 0;
  while (!sim.s.crashed && !sim.finished && sim.tick < MAX_SECONDS * 60) {
    if (steady >= 0 && sim.tick === steady) {
      pilot = steadyPilot(sim);
      spend = () => false;
      steadyZ = sim.s.z;
    }
    const o = pilot();
    const vIn = sim.s.speed;
    const was = { vz: sim.s.vz, off: sim.s.x - sim.course.safeX(sim.s.z), edge: sim.course.edgeExcess(sim.s.x, sim.s.z) };
    if (spare >= 0 && sim.tick >= spare) {
      // From the fall on nothing touches this ride: a spirit through whatever stands there, and no landing
      // can floor it.
      sim.s.ghost = Math.max(sim.s.ghost, 2);
      sim.s.invuln = Math.max(sim.s.invuln, 2);
      if (sim.tick === spare) spareZ = sim.s.z;
    }
    sim.step((o.steer | 0) | (o.action ? 16 : 0) | (spend() ? 64 : 0));
    pilot.after?.();
    const s = sim.s;
    speeds.push(s.speed);
    while (marks.length * 10 <= s.z) marks.push(sim.tick);
    if (spare >= 0 && s.z > spareZ + PRICE_M + 10) break;
    if (steady >= 0 && s.z > steadyZ + PRICE_M + 20) break;
    for (const e of sim.events) {
      if (e.type === 'tumble' && e.phase === 'start') falls.push({ tick: sim.tick - 1, z: s.z, cause: e.cause, kind: 'fall', v: vIn, ...was });
      else if (e.type === 'ward') falls.push({ tick: sim.tick - 1, z: s.z, cause: e.cause, kind: 'ward', v: vIn, ...was });
      else if (e.type === 'crash') falls.push({ tick: sim.tick - 1, z: s.z, cause: e.cause, kind: 'wreck', v: vIn, ...was });
    }
    if (s.grinding) grindTicks++;
    if (!s.grounded) airTicks++;
    if (sim.course.edgeExcess(s.x, s.z) > 0) bankTicks++;
    const sec = sim.course.section(s.z).kind;
    r.sections[sec] = (r.sections[sec] || 0) + 1;
    for (const e of sim.events) {
      if (e.type === 'style' && e.trick) {
        combo.add(e.trick);
        trickKinds.add(e.trick);
        tricksLanded++;
        if (combo.size > bestCombo) bestCombo = combo.size;
      } else if (e.type === 'comboBank' || e.type === 'comboLost') combo = new Set();
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
      else if (e.type === 'moment' && e.phase === 'start') mStart.set(e.index, { tick: sim.tick, v: s.speed });
      else if (e.type === 'moment' && (e.phase === 'won' || e.phase === 'lost')) {
        const st0 = mStart.get(e.index);
        const pl = sim.plays[e.index];
        r.moments.push({ index: e.index, key: pl.key, verb: pl.style ? `${pl.verb}:${pl.style}` : pl.verb, variant: pl.variantKey ?? '', won: e.phase === 'won', n: e.n, of: e.of, v0: st0?.v ?? 0, secs: st0 ? (sim.tick - st0.tick) / 60 : 0 });
      }
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
  r.legend = st.legend ? (sim.legend?.key ?? '') : '';
  r.legendLit = st.legendLit ?? 0;
  r.comboTricks = bestCombo;
  r.tricks = tricksLanded;
  r.trickKinds = trickKinds.size;
  r.charms = [...(sim.charms ?? [])];
  r.bestFlow = st.bestFlow ?? 0;
  r.choices = r.charms.length + (st.dashes > 0 || st.wards > 0 ? 1 : 0);
  return r;
}

/** The z a ride had reached at a tick, from its 10 m marks (-1 past its end). */
function zAt(marks: number[], tick: number): number {
  if (!marks.length || tick > marks[marks.length - 1]) return -1;
  let lo = 0;
  let hi = marks.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (marks[mid] <= tick) lo = mid;
    else hi = mid;
  }
  const span = marks[hi] - marks[lo];
  return lo * 10 + (span > 0 ? (10 * (tick - marks[lo])) / span : 0);
}

/** The tick a ride reached z, or -1 if it never did. */
function tickAt(marks: number[], z: number): number {
  const k = Math.ceil(z / 10);
  return k < marks.length ? marks[k] : -1;
}

/** Prices every fall a ride got up from: the same pilot, the same run, carried through that one hit. */
function price(r: Ride): void {
  for (const f of r.falls) {
    if (f.kind !== 'fall') continue;
    const clean = ride(r.pilot, r.m, r.seed, null, f.tick);
    // As the faller rides again (the sim's own length of a fall), how far ahead the untouched ride is.
    const up = f.tick + 1 + TUMBLE_TICKS;
    const za = zAt(r.marks, up);
    const zb = zAt(clean.marks, up);
    f.behind = za >= 0 && zb >= 0 ? zb - za : null;
    const a = tickAt(r.marks, f.z + PRICE_M);
    const b = tickAt(clean.marks, f.z + PRICE_M);
    f.cost = a >= 0 && b >= 0 ? (a - b) / 60 : null;
    // The same cost at every 50 m of the way, with the untouched ride's speed over each: where a fall came
    // out cheaper, this says whether the faller gained or the other ride lost.
    const steps: string[] = [];
    for (let d = 50; d <= PRICE_M; d += 50) {
      const ta = tickAt(r.marks, f.z + d);
      const tb = tickAt(clean.marks, f.z + d);
      const ta0 = tickAt(r.marks, f.z + d - 50);
      const tb0 = tickAt(clean.marks, f.z + d - 50);
      const v = (t0: number, t1: number): string => (t0 >= 0 && t1 > t0 ? (3000 / (t1 - t0)).toFixed(0) : '?');
      steps.push(ta >= 0 && tb >= 0 ? `${d}m ${((ta - tb) / 60).toFixed(2)}s (${v(ta0, ta)} vs ${v(tb0, tb)} m/s)` : `${d}m ?`);
    }
    f.profile = steps.join('  ');
    const fell = ride(r.pilot, r.m, r.seed, null, -1, f.tick + 1);
    const rode = ride(r.pilot, r.m, r.seed, null, f.tick, f.tick + 1);
    const sa = tickAt(fell.marks, f.z + PRICE_M);
    const sb = tickAt(rode.marks, f.z + PRICE_M);
    f.sure = sa >= 0 && sb >= 0 ? (sa - sb) / 60 : null;
    if (f.cost !== null && f.cost <= 0) console.log(`  cheaper: ${r.pilot} m${r.m} seed ${r.seed} tick ${f.tick} z ${f.z.toFixed(0)} ${f.cause} at ${f.v.toFixed(1)} m/s: ${f.profile}`);
  }
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
  for (const m of MOUNTAIN_LIST) {
    const rides: Ride[] = [];
    for (let i = 0; i < seedsFor; i++) rides.push(ride(p, m, 1234 + i * 37));
    if (PRICE) for (const r of rides) price(r);
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
fallTable(all.filter((r) => r.pilot !== 'rails'));
momentTable(all.filter((r) => r.pilot !== 'rails'));

/** Falls (round 7): per pilot over every mountain, how its runs ended, how often it went down and why, and
 *  with --falls what a fall cost it against the same ride carried through the hit. */
function fallTable(rides: Ride[]): void {
  console.log(`\nfalls      runs  finish  wreck  time  secs(med)  falls/run  wards/run  by cause${PRICE ? `                       priced  behind m (min/med)  cost s at ${PRICE_M} m (min/p10/med)  cheaper   steady hand after (min/p10/med)  cheaper` : ''}`);
  for (const p of PILOTS) {
    const rs = rides.filter((r) => r.pilot === p);
    if (!rs.length) continue;
    const fl = rs.flatMap((r) => r.falls);
    const got = fl.filter((f) => f.kind === 'fall');
    const by: Record<string, number> = {};
    for (const f of fl) if (f.kind !== 'ward') by[f.cause] = (by[f.cause] || 0) + 1;
    const q = (a: number[], k: number): number => {
      const s = [...a].sort((x, y) => x - y);
      return s.length ? s[Math.min(s.length - 1, Math.floor(k * s.length))] : NaN;
    };
    const behind = got.map((f) => f.behind).filter((v): v is number => typeof v === 'number');
    const cost = got.map((f) => f.cost).filter((v): v is number => typeof v === 'number');
    const sure = got.map((f) => f.sure).filter((v): v is number => typeof v === 'number');
    const fin = rs.filter((r) => r.finished);
    console.log(
      p.padEnd(10),
      String(rs.length).padStart(4),
      String(fin.length).padStart(7),
      String(rs.filter((r) => !r.finished && r.cause).length).padStart(6),
      String(rs.filter((r) => !r.finished && !r.cause).length).padStart(5),
      fmt(med(fin.map((r) => r.seconds))).padStart(10),
      fmt(got.length / rs.length).padStart(10),
      fmt(fl.filter((f) => f.kind === 'ward').length / rs.length).padStart(10),
      ' ' + Object.entries(by).map(([k, v]) => `${k}:${v}`).join(' ').padEnd(30),
      PRICE ? `${String(cost.length).padStart(5)}  ${fmt(q(behind, 0))} ${fmt(q(behind, 0.5))}      ${fmt(q(cost, 0), 2)} ${fmt(q(cost, 0.1), 2)} ${fmt(q(cost, 0.5), 2)}        ${cost.filter((c) => c <= 0).length}/${cost.length}  ${fmt(q(sure, 0), 2)} ${fmt(q(sure, 0.1), 2)} ${fmt(q(sure, 0.5), 2)}        ${sure.filter((c) => c <= 0).length}/${sure.length}` : '',
    );
  }
}

/** The set pieces: per mountain and set piece, each pilot's wins of the runs that met it (and by variant, where the
 *  sim has them), the median count, the speed coming in and the seconds it took. Then the round's sums: set pieces
 *  won by pilot and by verb, finishes and median times by pilot, and what a legend gave. */
function momentTable(rides: Ride[]): void {
  if (!rides.some((r) => r.moments && r.moments.length)) return;
  console.log('\nset piece                       pilot      met  won   n/of(med)  in m/s  secs(med)  by variant');
  for (const m of MOUNTAIN_LIST) {
    const plays = (new Sim({ seed: MOUNTAINS[m].seed, chaos: { mood: MOOD, event: EVENT, seed: 0x1234 }, sled: 0 }) as AnySim).plays ?? [];
    for (const p of plays) {
      for (const pilot of PILOTS) {
        const met = rides.filter((r) => r.m === m && r.pilot === pilot).flatMap((r) => r.moments.filter((q) => q.index === p.index));
        if (!met.length) continue;
        const won = met.filter((q) => q.won).length;
        const kinds = [...new Set(met.map((q) => q.variant))].filter((k) => k).sort();
        console.log(
          `${MOUNTAINS[m].id.slice(0, 6)} ${p.key} ${met[0].verb}`.padEnd(31),
          pilot.padEnd(10),
          String(met.length).padStart(3),
          String(won).padStart(4),
          `${med(met.map((q) => q.n))}/${met[0].of}`.padStart(10),
          fmt(med(met.map((q) => q.v0))),
          fmt(med(met.map((q) => q.secs))),
          '  ' + kinds.map((k) => `${k} ${met.filter((q) => q.variant === k && q.won).length}/${met.filter((q) => q.variant === k).length}`).join('  '),
        );
      }
    }
  }
  const human = PILOTS.filter((p) => rides.some((r) => r.pilot === p && r.moments.length));
  const verbs = [...new Set(rides.flatMap((r) => r.moments.map((q) => q.verb)))].sort();
  console.log('\nset pieces won of those met, by verb\n' + 'verb'.padEnd(16) + human.map((p) => p.padStart(10)).join(''));
  for (const v of [...verbs, 'ALL']) {
    const cell = (pilot: string): string => {
      const met = rides.filter((r) => r.pilot === pilot).flatMap((r) => r.moments.filter((q) => v === 'ALL' || q.verb === v));
      return `${met.filter((q) => q.won).length}/${met.length}`.padStart(10);
    };
    console.log(v.padEnd(16) + human.map(cell).join(''));
  }
  console.log('\npilot       finished   median s (finishers)   set pieces won   lanterns lit (med)   best combo tricks (med/max)   trick kinds (med)   choices (med)   best flow (med)');
  for (const pilot of PILOTS) {
    const rs = rides.filter((r) => r.pilot === pilot);
    if (!rs.length) continue;
    const fin = rs.filter((r) => r.finished);
    const met = rs.flatMap((r) => r.moments);
    console.log(pilot.padEnd(11), `${fin.length}/${rs.length}`.padStart(8), fmt(med(fin.map((r) => r.seconds))).padStart(14), `${met.filter((q) => q.won).length}/${met.length}`.padStart(22), fmt(med(rs.map((r) => r.lit / 100))).padStart(14), `${med(rs.map((r) => r.comboTricks ?? 0))}/${Math.max(...rs.map((r) => r.comboTricks ?? 0))}`.padStart(22), String(med(rs.map((r) => r.trickKinds ?? 0))).padStart(18), String(med(rs.map((r) => r.choices ?? 0))).padStart(14), String(med(rs.map((r) => r.bestFlow ?? 0))).padStart(14));
  }
  const withLegend = rides.filter((r) => r.legend);
  if (withLegend.length) {
    console.log('\nlegend       pilot      runs   lanterns it lit (med)');
    for (const key of [...new Set(withLegend.map((r) => r.legend))]) for (const pilot of PILOTS) {
      const rs = withLegend.filter((r) => r.legend === key && r.pilot === pilot);
      if (rs.length) console.log(key.padEnd(12), pilot.padEnd(10), String(rs.length).padStart(4), fmt(med(rs.map((r) => r.legendLit / 100)), 2));
    }
  }
}

/** What the rail pilot proved: per mountain, then every rail no seed mounted, retried on its own. */
function railTable(rides: Ride[]): void {
  console.log('\nrails       runs  on course  reached    tried  entered  of tried  grind s/run  finished  never mounted');
  const never: { m: number; id: number; why: Record<string, number> }[] = [];
  for (const m of MOUNTAIN_LIST) {
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
