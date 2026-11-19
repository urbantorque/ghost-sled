// A player's career, simulated for round 8's bars (prompts/round-8-beauty-and-the-hook.md section 2). The lab's
// pilots ride the real sim one run after another, and each run is settled into a real save through the game layer
// as the app settles it after a run (app.ts persistRun and showResults): the field the game would lay (field.ts on
// the bundled pools with their slow riders; a very first run's riders reading you, pacer.ts), the race against it
// (ghosts.ts, fed trajectories replayed exactly as the ghost worker replays them), the best, the grudge, missions,
// the mountain's ladder and medals, mastery, The Twelve's duels, unlocks, the Daily on its day and the Cup by its
// week. A fake clock moves the days between sessions.
//
// The sim and the game layer are both loaded from a checkout (loadMods), so one plan rides two builds. Newer
// systems plug in where they land, each read only if its build has it:
//   - the sim lane's events (named tricks, charms, showdowns, flow): every event type a run saw is counted in its
//     facts, a `trick` event's name is a named trick, and CHOICE_EVENTS lists the event types that are a choice;
//   - milestone 3's spine (src/game/rank.ts): `settleSpine(save, facts, now)` returns what the run gained and the
//     results' one primary goal, and the bars read those beside what the game layer gives today.
//
// What is approximate, and why it does not move a bar: the pilots never get better (a person would), gifts for a
// pass are the base pay once per rider passed (the director's extras and the grudge premium are left out), a
// grudge counts as beaten when you passed it or finished ahead of its real run (the director's own verdict also
// counts riding past where it ended), and nobody revives, doubles or rides home.
//
// Pure node: no browser. Imported by scripts/playtest/r8-bars.ts and tests/r8bars.test.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type Kit, type Pilot, classic, clumsy, mulberry, spenderFor } from './labpilots';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// ---------------------------------------------------------------- loading a build

/** Every module the career reads, loaded from one checkout. `rank` is milestone 3's, null on a build without it. */
export interface Mods {
  root: string;
  sim: Any;
  mountains: Any;
  chaos: Any;
  replay: Any;
  prng: Any;
  moments: Any;
  run: Any;
  ghosts: Any;
  field: Any;
  slow: Any;
  settle: Any;
  save: Any;
  missions: Any;
  ladder: Any;
  mastery: Any;
  twelve: Any;
  cup: Any;
  progress: Any;
  standing: Any;
  race: Any;
  pacer: Any;
  pool: Any;
  roster: Any;
  rank: Any | null;
  /** Each bundled mountain's pool as the app holds it: with its slow riders (app.ts poolFor). */
  pools: Record<string, Any[]>;
}

/** Loads a build. `imp` imports a path relative to the root (tsx needs a file URL; vitest takes a path). */
export async function loadMods(root: string, imp?: (p: string) => Promise<Any>): Promise<Mods> {
  const at = resolve(root);
  const load = imp ?? ((p: string) => import(pathToFileURL(resolve(at, p)).href));
  // The ghost manager starts a worker as it is made. Node has none, and the career feeds it trajectories itself.
  const g = globalThis as Any;
  if (typeof g.Worker === 'undefined') {
    g.Worker = class {
      onmessage: unknown = null;
      onerror: unknown = null;
      postMessage(): void {}
      terminate(): void {}
    };
  }
  const m: Mods = {
    root: at,
    sim: await load('src/sim/sim.ts'),
    mountains: await load('src/sim/mountains.ts'),
    chaos: await load('src/sim/chaos.ts'),
    replay: await load('src/sim/replay.ts'),
    prng: await load('src/sim/prng.ts'),
    moments: await load('src/sim/moments.ts').catch(() => ({})),
    run: await load('src/game/run.ts'),
    ghosts: await load('src/game/ghosts.ts'),
    field: await load('src/game/field.ts'),
    slow: await load('src/game/slowriders.ts'),
    settle: await load('src/game/settle.ts'),
    save: await load('src/game/save.ts'),
    missions: await load('src/game/missions.ts'),
    ladder: await load('src/game/ladder.ts'),
    mastery: await load('src/game/mastery.ts'),
    twelve: await load('src/game/twelve.ts'),
    cup: await load('src/game/cup.ts'),
    progress: await load('src/game/progress.ts'),
    standing: await load('src/game/standing.ts'),
    race: await load('src/game/race.ts'),
    pacer: await load('src/game/pacer.ts'),
    pool: await load('src/bot/pool.ts'),
    roster: await load('src/bot/roster.ts'),
    rank: existsSync(resolve(at, 'src/game/rank.ts')) ? await load('src/game/rank.ts') : null,
    pools: {},
  };
  for (const mt of m.mountains.MOUNTAINS) {
    const raw = JSON.parse(readFileSync(resolve(at, `src/data/ghosts/${mt.id}.json`), 'utf8')) as { ghosts: Any[] };
    m.pools[mt.id] = m.slow.withSlowRiders(raw.ghosts ?? [], mt.id);
  }
  return m;
}

// ---------------------------------------------------------------- ghost trajectories

const SAMPLE_EVERY = 2;
const FRAME_STRIDE = 10;

interface Traj {
  frames: Float32Array;
  samples: number;
  ticks: number;
  crashTick: number;
  finishTick: number;
  stageTicks: number[];
  score: number;
  distance: number;
  tricks: Int32Array;
}

const trajCache = new Map<string, Traj>();

/** A record replayed as src/workers/ghost.worker.ts replays it, kept by its run (a slow rider is its base's run
 *  under another name, and replays the same). */
function trajectory(M: Mods, record: string): Traj {
  const rec = M.replay.recordFromString(record);
  const key = `${rec.seed}|${JSON.stringify(rec.chaos)}|${rec.sled}|${rec.ticks}|${Buffer.from(rec.inputs).toString('base64')}`;
  const hit = trajCache.get(key);
  if (hit) return hit;
  const { FALL_DOWN, FALL_FALLING, FALL_UP } = M.sim;
  const cap = Math.ceil((rec.ticks + 4) / SAMPLE_EVERY) + 2;
  let frames = new Float32Array(cap * FRAME_STRIDE);
  let n = 0;
  const tricks: number[] = [];
  let crashTick = -1;
  const stageTicks: number[] = [];
  let finishTick = -1;
  const sim = M.replay.replayRecord(rec, (s: Any) => {
    for (const e of s.events) {
      if (e.type === 'stage') stageTicks.push(e.tick);
      if (e.type === 'finish') finishTick = e.tick;
      if (e.type === 'land' && (e.quality === 'perfect' || e.halfTurns > 0 || e.flips > 0)) tricks.push(s.tick, e.quality === 'perfect' ? 1 : e.quality === 'sketchy' ? 2 : 0, e.halfTurns, e.flips);
      if (e.type === 'crash' && crashTick < 0) crashTick = s.tick;
    }
    if (s.tick % SAMPLE_EVERY !== 0) return;
    if ((n + 1) * FRAME_STRIDE > frames.length) {
      const grown = new Float32Array(frames.length * 2);
      grown.set(frames);
      frames = grown;
    }
    const st = s.s;
    const o = n * FRAME_STRIDE;
    frames[o] = st.x;
    frames[o + 1] = st.y;
    frames[o + 2] = st.z;
    frames[o + 3] = st.heading;
    frames[o + 4] = st.airYaw;
    frames[o + 5] = st.airPitch;
    frames[o + 6] = st.lean;
    frames[o + 7] = st.speed;
    frames[o + 8] = (st.grounded ? 1 : 0) | (st.drifting ? 2 : 0) | (st.crashed ? 4 : 0) | (st.dash > 0 ? 8 : 0) | (st.ghost > 0 && st.dash === 0 ? 16 : 0) | (st.fall === FALL_FALLING ? 32 : st.fall === FALL_DOWN ? 64 : st.fall === FALL_UP ? 128 : 0);
    frames[o + 9] = st.carve;
    n++;
  });
  const t: Traj = { frames: frames.slice(0, n * FRAME_STRIDE), samples: n, ticks: sim.tick, crashTick: crashTick >= 0 ? crashTick : sim.s.crashed ? sim.s.crashTick : -1, finishTick, stageTicks, score: sim.score, distance: sim.distance, tricks: Int32Array.from(tricks) };
  trajCache.set(key, t);
  return t;
}

// ---------------------------------------------------------------- the Daily's and the Cup's pools

/** The Daily's and the Cup's rivals, generated as the app's worker generates them (10 riders, 16 bot runs, a
 *  3.5 minute cap), cached on disk by course seed and sim version: a day's pool is the same for everyone. */
function generatedPool(M: Mods, seed: number, salt: number, tagline: string, cacheDir: string | null): Any[] {
  const file = cacheDir ? resolve(cacheDir, `pool-${seed >>> 0}-${salt >>> 0}-v${M.sim.SIM_VERSION}.json`) : '';
  let ghosts: Any[] | null = null;
  if (file && existsSync(file)) ghosts = JSON.parse(readFileSync(file, 'utf8'));
  if (!ghosts) {
    let runs: Any[] = [];
    const made = M.pool.generatePool(seed, 10, salt, { budgetRuns: 16, maxTicks: 60 * 60 * 3.5, riders: 3, fast: 2, fastTries: 3, report: (r: Any[]) => (runs = r) });
    const finish = new Map(runs.filter((r) => r.sim.finished).map((r) => [r.record.name, r.sim.s.finishTick]));
    ghosts = made.map((g: Any) => ({ ...g, ...(finish.has(g.name) ? { finishTick: finish.get(g.name) } : {}) }));
    if (file) {
      mkdirSync(cacheDir!, { recursive: true });
      writeFileSync(file, JSON.stringify(ghosts));
    }
  }
  return M.slow.withSlowRiders(ghosts!, tagline);
}

// ---------------------------------------------------------------- one run

/** What a run did, as the bars read it. */
export interface RunFacts {
  pilot: string;
  /** The save key: a mountain id, `daily:<day>` or `cup:<week>`. */
  key: string;
  mountainId: string;
  /** Mountain index for a named mountain, -1 for a Daily or a Cup. */
  mi: number;
  chaos: Any;
  sum: Any;
  finished: boolean;
  time: number | null;
  distance: number;
  seconds: number;
  stageSeconds: number[];
  /** Every pass the race counted (ghosts.ts race), with its tick and whether the director mutes it (a start-line
   *  jostle). */
  passes: { tick: number; name: string; kind: string; muted: boolean }[];
  firstPass: number | null;
  firstPerfect: number | null;
  firstDash: number | null;
  /** Choices the run made that change how the rest of it plays (CHOICE_EVENTS, a dash, a fork's channel). */
  choices: { tick: number; kind: string; detail?: string }[];
  /** Named tricks landed, by the combo they were in. */
  tricks: { tick: number; name: string; family: string; combo: number }[];
  /** Set pieces met: key, variant index and whether won. */
  moments: { key: string; index: number; variant: number; won: boolean }[];
  /** The legend slot the run met (0 none). */
  legend: number;
  gates: number[];
  tumbles: number;
  wards: number;
  events: Record<string, number>;
  /** The field as it rode, and where each ghost finished in this race. */
  field: { name: string; kind: string; reads: boolean; time: number | null; distance: number; passed: boolean }[];
  ticks: number;
}

/** Event types the sim lane's batch may add that are a choice by themselves (a charm gate ridden through, a
 *  showdown taken up). A dash and a fork's channel are read from today's sim. */
export const CHOICE_EVENTS: Readonly<Record<string, (e: Any) => boolean>> = {
  dash: (e) => e.type === 'dash' && e.phase === 'start',
  charm: (e) => e.type === 'charm' && (e.phase === undefined || e.phase === 'pick'),
  showdown: (e) => e.type === 'showdown' && (e.phase === undefined || e.phase === 'start'),
};

/** A trick's name as today's director calls it (director.ts trickWord), and its family. */
function trickOf(halfTurns: number, flips: number): { name: string; family: string } | null {
  const FLIPS = ['Backflip', 'Double Backflip', 'Triple Backflip'];
  if (flips > 0) return { name: FLIPS[flips - 1] ?? `${flips} Backflips`, family: halfTurns > 0 ? 'spin+flip' : 'flip' };
  if (halfTurns > 0) return { name: `Spin ${halfTurns * 180}`, family: 'spin' };
  return null;
}

interface PlannedRun {
  pilot: string;
  pilotSeed: number;
  key: string;
  mountain: Any;
  mi: number;
  chaos: Any;
  sled: number;
  entries: Any[];
  maxSeconds: number;
}

interface RodeRun {
  facts: RunFacts;
  run: Any;
  gm: Any;
  sim: Any;
  gapAtEnd: Map<number, number>;
}

function makePilot(M: Mods, name: string, sim: Any, seed: number): Pilot {
  const kit: Kit = { gateX: M.moments.gateX, pathX: M.moments.pathX, machineZ: M.moments.machineZ };
  return name === 'clumsy' ? clumsy(sim, seed) : classic(name as 'mid', sim, seed, kit);
}

function ride(M: Mods, p: PlannedRun): RodeRun {
  const src: { pilot: Pilot | null; spend: (() => boolean) | null; sample(): { steer: number; action: boolean; spirit: boolean } } = {
    pilot: null,
    spend: null,
    sample() {
      const o = this.pilot!();
      return { steer: o.steer, action: o.action, spirit: this.spend!() };
    },
  };
  const run = new M.run.Run(p.mountain.seed, p.chaos, p.sled, src);
  const sim = run.sim;
  src.pilot = makePilot(M, p.pilot, sim, p.pilotSeed);
  src.spend = spenderFor(p.pilot, sim, p.pilotSeed);
  const gm = new M.ghosts.GhostManager();
  gm.setField(p.entries);
  for (const t of gm.tracks) {
    let tr: Traj;
    try {
      tr = trajectory(M, t.entry.record);
    } catch {
      continue;
    }
    gm.onMessage({ type: 'trajectory', id: t.entry.id, frames: tr.frames, samples: tr.samples, ticks: tr.ticks, crashTick: tr.crashTick, finishTick: tr.finishTick, stageTicks: tr.stageTicks.slice(), score: tr.score, distance: tr.distance, tricks: tr.tricks.slice() });
  }
  gm.tracks = gm.tracks.filter((t: Any) => t.ready);
  run.draftProbe = gm.draftProbe;
  const START_TICKS: number = M.race.START_TICKS ?? 360;
  const facts: RunFacts = { pilot: p.pilot, key: p.key, mountainId: p.mountain.id, mi: p.mi, chaos: p.chaos, sum: null, finished: false, time: null, distance: 0, seconds: 0, stageSeconds: [], passes: [], firstPass: null, firstPerfect: null, firstDash: null, choices: [], tricks: [], moments: [], legend: 0, gates: [], tumbles: 0, wards: 0, events: {}, field: [], ticks: 0 };
  let combo = 0;
  let inCombo = false;
  let wallRides = 0;
  let lastWall = -1e9;
  let grinds = 0;
  let forkAt = -1;
  const met = new Map<number, number>();
  const specs: Any[] = M.moments.planMoments ? M.moments.planMoments(sim.course) : [];
  const variantOf = (index: number): number => {
    const s = specs.find((q) => q.index === index);
    return s && M.moments.variantOf ? M.moments.variantOf(p.chaos, index, s.variants) : 0;
  };
  while (!sim.s.crashed && !sim.finished && sim.tick < p.maxSeconds * 60) {
    run.tick();
    const s = sim.s;
    gm.pace(sim.tick, s.z, !sim.finished && !s.crashed);
    for (const ev of gm.race(sim.tick, s.z)) {
      if (ev.type !== 'pass') continue;
      const muted = sim.tick < START_TICKS;
      facts.passes.push({ tick: sim.tick, name: ev.track.entry.name, kind: ev.track.entry.kind, muted });
      if (!muted && facts.firstPass === null) facts.firstPass = sim.tick;
    }
    // A fork's channel: chosen where its ridge stands, once a fork.
    const sec = sim.course.section(s.z);
    if (sec.kind === 'fork' && forkAt !== sec.z0 && s.z > (sec.z0 + sec.z1) / 2) {
      forkAt = sec.z0;
      const alt = sim.course.altX(s.z);
      if (alt !== null) facts.choices.push({ tick: sim.tick, kind: 'fork', detail: Math.abs(s.x - alt) < Math.abs(s.x - sim.course.safeX(s.z)) ? 'risk' : 'safe' });
    }
    for (const { tick, e } of run.drain()) {
      facts.events[e.type] = (facts.events[e.type] ?? 0) + 1;
      for (const [kind, is] of Object.entries(CHOICE_EVENTS)) if (is(e)) facts.choices.push({ tick, kind });
      if (e.type === 'dash' && e.phase === 'start' && facts.firstDash === null) facts.firstDash = tick;
      if (e.type === 'land' && !e.botched) {
        if (e.quality === 'perfect' && facts.firstPerfect === null) facts.firstPerfect = tick;
        const t = trickOf(e.halfTurns, e.flips);
        if (t) {
          if (!inCombo) {
            combo++;
            inCombo = true;
          }
          facts.tricks.push({ tick, ...t, combo });
        }
      }
      // The sim lane's named tricks, when its batch lands: one entry each.
      if (e.type === 'trick' && typeof e.name === 'string') {
        if (!inCombo) {
          combo++;
          inCombo = true;
        }
        facts.tricks.push({ tick, name: e.name, family: e.name, combo });
      }
      if (e.type === 'comboBank' || e.type === 'comboLost' || e.type === 'crash' || (e.type === 'tumble' && e.phase === 'start')) inCombo = false;
      if (e.type === 'tumble' && e.phase === 'start') facts.tumbles++;
      if (e.type === 'ward') facts.wards++;
      if (e.type === 'skyGate') facts.gates.push(e.id);
      if (e.type === 'grind' && e.phase === 'start') grinds++;
      if (e.type === 'style' && e.kind === 'wallRide') {
        if (tick - lastWall > 40) wallRides++;
        lastWall = tick;
      }
      if (e.type === 'moment' && e.phase === 'start') met.set(e.index, tick);
      if (e.type === 'moment' && (e.phase === 'won' || e.phase === 'lost')) {
        const pl = sim.plays?.[e.index];
        facts.moments.push({ key: pl?.key ?? String(e.index), index: e.index, variant: variantOf(e.index), won: e.phase === 'won' });
      }
      if (e.type === 'legend' && e.phase === 'start') facts.legend = p.chaos.legend ?? 1;
    }
  }
  // Where each ghost stood to you as the run ended (app.ts noteGaps, at the crash).
  const gapAtEnd = new Map<number, number>();
  for (const t of gm.tracks) gapAtEnd.set(t.entry.id, gm.zAt(t, sim.tick) - sim.s.z);
  const st = sim.stats;
  facts.finished = !!sim.finished;
  facts.time = sim.finished ? sim.s.finishTick / 60 : null;
  facts.distance = sim.distance;
  facts.seconds = sim.tick / 60;
  facts.ticks = sim.tick;
  facts.stageSeconds = M.ladder.stageSeconds(sim.stageTicks);
  const passedIds = new Set<number>();
  for (const t of gm.tracks) if (t.passed) passedIds.add(t.entry.id);
  facts.field = gm.tracks.map((t: Any) => {
    const sd = M.ghosts.trackStanding(t);
    return { name: t.entry.name, kind: t.entry.kind, reads: !!t.entry.reads, time: sd.time, distance: t.distance, passed: t.passed };
  });
  facts.sum = {
    mountain: p.mountain.id,
    biome: M.mountains.biomeForSeed(p.mountain.seed),
    score: sim.score,
    distance: sim.distance,
    gifts: M.progress.runPay(sim),
    lights: st.lights,
    dashes: st.dashes,
    phased: st.phased,
    skyGates: st.skyGates,
    wards: st.wards,
    perfects: st.perfects,
    maxAirtime: st.maxAirtime,
    maxHalfTurns: st.maxHalfTurns,
    flips: st.flips,
    driftSeconds: st.driftTicks / 60,
    draftSeconds: st.draftTicks / 60,
    nearMisses: st.nearMisses,
    bestCombo: st.bestCombo,
    maxSpeed: st.maxSpeed,
    smashes: st.smashes,
    gates: st.gates,
    yetiHop: st.yetiHop,
    outranAvalanche: st.outranAvalanche,
    ghostsPassed: passedIds.size,
    grudgeBeaten: false,
    chaos: p.chaos.mood !== 0 || p.chaos.event !== 0,
    seconds: sim.tick / 60,
    finished: !!sim.finished,
    finishSeconds: sim.finished ? sim.s.finishTick / 60 : 0,
    tumbles: facts.tumbles,
    wallRides,
    grinds,
  };
  return { facts, run, gm, sim, gapAtEnd };
}

// ---------------------------------------------------------------- what results would show

/** One thing a run gained that results shows. `durable`: the save keeps it (a pass and a best are the run's own). */
export interface Gain {
  kind: 'rank' | 'unlock' | 'sticker' | 'duel' | 'medal' | 'star' | 'streak' | 'mission' | 'pass' | 'best' | 'page' | 'contract' | string;
  text: string;
  durable: boolean;
}

/** A goal results could name for the next run. */
export interface Goal {
  kind: 'mission' | 'duel' | 'rung' | 'gold' | 'medal' | 'unlock' | 'grudge' | 'daily' | 'cup' | 'page' | string;
  text: string;
  /** Reachable in the very next run, judged from what the pilot did in its last REACH_RUNS runs. */
  reachable: boolean;
  /** How near, in the goal's own unit (s, m, ghosts, a share of the target). */
  gap: number;
  /** Names that would say it on the card (a rider, a mission's text). */
  names: string[];
}

/** What the results card says today: its one button, its race line, the next unlock and the mission rows. */
export interface ResultsView {
  primary: string;
  raceLine: string | null;
  nextUnlock: string | null;
  missions: string[];
  /** Milestone 3's chosen goal for the one button, when its build has one. */
  spinePrimary?: { kind: string; label: string } | null;
}

export interface CareerRun {
  n: number;
  day: string;
  facts: RunFacts;
  gains: Gain[];
  results: ResultsView;
  goals: Goal[];
  /** The save's figures after this run (for the economy table). */
  after: { gifts: number; lifetimeGifts: number; ghostsPassed: number; open: string[]; twelve: number; beaten: string[]; stars: number; missions: number; streak: number; climb: Record<string, Any>; mastery: Record<string, Any> };
}

/** Runs read back for "reachable next run": the pilot's last this many. */
export const REACH_RUNS = 5;
/** A mission is within reach when a recent run came this close to its target (a share of it). */
export const REACH_MISSION = 0.85;
/** A duel is within reach when a recent finish came this close to the rider's time, seconds. */
export const REACH_DUEL_S = 0.4;

// ---------------------------------------------------------------- the career

export interface CareerOptions {
  pilot: string;
  runs: number;
  /** Runs a day: the clock moves a day after this many. */
  perDay?: number;
  /** The first day, 'YYYY-MM-DD'. */
  start?: string;
  /** Ride today's Daily as the first run of each session from the second day on. */
  daily?: boolean;
  /** Ride this week's Cup once a week, from the second week on. */
  cup?: boolean;
  seed?: number;
  /** Where generated Daily and Cup pools are kept between sittings (null: not kept). */
  cacheDir?: string | null;
  maxSeconds?: number;
  /** Called after each run (progress). */
  onRun?: (r: CareerRun) => void;
}

const hash = (...xs: number[]): number => {
  let h = 0x811c9dc5;
  for (const x of xs) {
    h ^= x >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= h >>> 15;
  }
  return h >>> 0;
};

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Rides a career and returns every run with what results would have said. */
export function career(M: Mods, o: CareerOptions): CareerRun[] {
  const MOUNTAINS: Any[] = M.mountains.MOUNTAINS;
  const perDay = o.perDay ?? 4;
  const start = o.start ?? '2026-12-01';
  const seed = o.seed ?? 0x5e1ed;
  const d: Any = M.save.defaultSave('Rider');
  const out: CareerRun[] = [];
  const rnd = mulberry(seed);
  let current = MOUNTAINS[0];
  let promised: Any = null;
  let lastMood = 0;
  let sessionRuns = 0;
  let dayIndex = 0;
  let today = start;
  let dailyDone = '';
  let cupDone = '';
  let sameStreak = 0;
  for (let n = 0; n < o.runs; n++) {
    // The clock: a new day after perDay runs, and a new session with it (its first run is plain).
    const di = Math.floor(n / perDay);
    if (di !== dayIndex) {
      dayIndex = di;
      today = addDays(start, di);
      sessionRuns = 0;
    }
    const week = M.cup.weekOfDay(today);
    const open = (i: number): boolean => M.twelve.mountainOpen(d, MOUNTAINS[i]);
    // Where this run goes: the Daily first in a session, the week's Cup once, else the mountain results led to.
    let mountain: Any = current;
    let key = current.id;
    let pool: Any[] = M.pools[current.id];
    let chaos: Any;
    let kind: 'pool' | 'daily' | 'cup' = 'pool';
    const chaosSeed = hash(seed, n, 0xc4a05);
    if (o.daily && dayIndex >= 1 && dailyDone !== today && sessionRuns === 0) {
      mountain = M.mountains.dailyMountain(today);
      key = `daily:${today}`;
      pool = generatedPool(M, mountain.seed, M.prng.hashString(today), today, o.cacheDir ?? null);
      kind = 'daily';
      dailyDone = today;
    } else if (o.cup && dayIndex >= 7 && cupDone !== week && sessionRuns === 1) {
      mountain = M.cup.cupMountain(week);
      key = `cup:${week}`;
      pool = generatedPool(M, mountain.seed, M.prng.hashString(week), week, o.cacheDir ?? null);
      kind = 'cup';
      cupDone = week;
    }
    chaos = kind === 'cup' ? M.cup.cupChaos(week) : M.chaos.rollChaos(chaosSeed, sessionRuns, lastMood);
    if (chaos.mood !== 0) lastMood = chaos.mood;
    sessionRuns++;
    const mi = MOUNTAINS.indexOf(mountain);
    // The duel on this mountain (app.ts duelHere), and the field (app.ts pickField).
    const duel = mi >= 0 ? M.twelve.duelOn(d.twelve, mi, open) : null;
    const entries = fieldFor(M, d, { key, pool, chaos, kind, duel, promised: promised?.key === key ? promised : null });
    promised = null;
    const bestAtStart = d.best[key] ? { ...d.best[key] } : null;
    const climbAtStart = d.climb?.[key] ? JSON.parse(JSON.stringify(d.climb[key])) : null;
    const grudgeAtStart = d.grudge[key] ? JSON.parse(JSON.stringify(d.grudge[key])) : null;
    const passedAtStart = d.ghostsPassed;
    const streakBefore = M.settle.dailyStreakNow(d.daily, today);
    const dailyMedalBefore = M.settle.dailyMedalNow(d.daily, today);
    const cupMedalBefore = M.settle.cupMedalNow(d.cup, week);
    const pilotSeed = hash(seed, n, 0x9170);
    const rode = ride(M, { pilot: o.pilot, pilotSeed, key, mountain, mi, chaos, sled: d.sled, entries, maxSeconds: o.maxSeconds ?? 600 });
    const f = rode.facts;
    const sim = rode.sim;
    const you = { time: f.time, distance: f.distance };
    const gains: Gain[] = [];

    // persistRun: gifts, the best, the stats, the grudge.
    const passGifts = (M.race.PASS_GIFTS ?? 5) * f.sum.ghostsPassed;
    d.gifts += f.sum.gifts + passGifts;
    d.lifetimeGifts += f.sum.gifts + passGifts;
    const best = M.settle.settleBest(d, key, bestAtStart, { score: sim.score, distance: sim.distance, time: f.time, splits: sim.stageTicks.map((t: number) => t / 60), record: () => M.replay.recordToString(rode.run.toRecord(d.name)) });
    if (kind === 'daily') d.daily = { ...d.daily, key: today, best: Math.max(d.daily.key === today ? d.daily.best : 0, sim.score) };
    d.stats.bestScore = Math.max(d.stats.bestScore, sim.score);
    d.stats.bestCombo = Math.max(d.stats.bestCombo, sim.stats.bestCombo);
    d.stats.longestAir = Math.max(d.stats.longestAir, sim.stats.maxAirtime);
    d.stats.topSpeed = Math.max(d.stats.topSpeed, sim.stats.maxSpeed);
    const g = grudgeOutcome(M, rode, grudgeAtStart, you);
    const settledG = M.settle.settleGrudge(grudgeAtStart, g);
    if (settledG.retired) M.save.retireGrudge(d, key, settledG.retired);
    if (settledG.grudge) d.grudge[key] = settledG.grudge;
    else delete d.grudge[key];
    f.sum.grudgeBeaten = settledG.settled;

    // showResults: missions, the Daily and the Cup, the ladder, mastery, unlocks, The Twelve.
    const medals = M.settle.medalThresholds(pool.map(M.field.poolTime));
    const settled = M.settle.settleRun(d, f.sum, null, key, medals);
    for (const mv of settled.missions) if (mv.justCompleted) gains.push({ kind: 'mission', text: mv.text, durable: true });
    if (settled.daily) {
      if (settled.daily.streak > streakBefore) gains.push({ kind: 'streak', text: `Day streak ${settled.daily.streak}`, durable: true });
      if (settled.daily.best > dailyMedalBefore) gains.push({ kind: 'medal', text: `Daily ${M.settle.MEDAL_NAMES[settled.daily.best]}`, durable: true });
    }
    if (settled.cup && settled.cup.best > cupMedalBefore) gains.push({ kind: 'medal', text: `Cup ${M.settle.MEDAL_NAMES[settled.cup.best]}`, durable: true });
    let climb: Any = null;
    let board: Any = null;
    if (mi >= 0) {
      board = M.ladder.boardOf(M.pools[mountain.id]);
      climb = M.ladder.settleClimb(d, key, board, M.sim.SIM_VERSION, climbAtStart, { standing: you, best: M.ladder.bestStanding(d.best[key]), bestBefore: M.ladder.bestStanding(bestAtStart), ticks: sim.stageTicks });
      if (climb.spot.rank !== null && climb.rankWas !== null && climb.spot.rank < climb.rankWas) gains.push({ kind: 'rank', text: `Rank ${climb.spot.rank} of ${climb.spot.of}`, durable: true });
      else if (climb.spot.rank !== null && climb.rankWas === null && !bestAtStart) gains.push({ kind: 'rank', text: `On the ladder: rank ${climb.spot.rank}`, durable: true });
      for (const at of climb.fresh) gains.push({ kind: 'medal', text: at >= 3 ? 'Run medal' : `Stage ${at + 1} medal`, durable: true });
      // Mastery.
      d.mastery ??= {};
      const rec = M.mastery.readMastery(d.mastery[key]);
      const riderTimes = new Map(
        M.roster.ROSTER.filter((r: Any) => r.home === mi).map((r: Any) => {
          const pg = M.pools[mountain.id].find((q: Any) => q.name === r.name);
          return [r.key, pg && (pg.finishTick ?? -1) > 0 ? pg.finishTick / 60 : null];
        }),
      );
      const fresh: string[] = M.mastery.settleMastery(sim.course, key, rec, { gates: f.gates, moments: f.moments.map((q) => ({ key: q.key, took: 0, total: 0, clean: false, won: q.won })), time: f.time, riderTimes, clean: f.tumbles === 0 && f.wards === 0 }, climbAtStart?.medal ?? 0, d.climb?.[key]?.medal ?? 0);
      d.mastery[key] = rec;
      if (fresh.length) {
        d.gifts += M.mastery.STAR_GIFTS * fresh.length;
        d.lifetimeGifts += M.mastery.STAR_GIFTS * fresh.length;
      }
      for (const s of fresh) gains.push({ kind: 'star', text: s, durable: true });
    }
    for (const mt of MOUNTAINS) if (!mt.finale && passedAtStart < mt.unlockGhosts && d.ghostsPassed >= mt.unlockGhosts) gains.push({ kind: 'unlock', text: mt.name, durable: true });
    if (duel) {
      const t = (d.twelve = M.twelve.readTwelve(d.twelve));
      const standings = new Map<string, Any>();
      for (const tr of rode.gm.tracks) if (tr.entry.kind !== 'you') standings.set(tr.entry.name, M.ghosts.trackStanding(tr));
      const oc = M.twelve.settleTwelve(t, duel, you, standings);
      if (!t.beaten.length) delete d.twelve;
      const pay = oc.fell ? M.twelve.DUEL_GIFTS : oc.crowned ? M.twelve.CROWN_GIFTS : 0;
      d.gifts += pay;
      d.lifetimeGifts += pay;
      if (oc.fell || oc.crowned) gains.push({ kind: 'duel', text: oc.crowned ? 'The last race' : `Beat ${duel.rider.name}`, durable: true });
      if (oc.opened) gains.push({ kind: 'unlock', text: MOUNTAINS[M.twelve.KING.home].name, durable: true });
    }
    if (f.sum.ghostsPassed > 0) gains.push({ kind: 'pass', text: `${f.sum.ghostsPassed} passed`, durable: false });
    if (best.newTop || best.newTime) gains.push({ kind: 'best', text: best.newTime ? 'New best time' : 'New best', durable: false });

    // Milestone 3's spine, on a build that has it.
    let spinePrimary: ResultsView['spinePrimary'] = null;
    if (M.rank?.settleSpine) {
      const sp = M.rank.settleSpine(d, f, { day: today, week });
      for (const gn of sp?.gains ?? []) gains.push(gn);
      spinePrimary = sp?.primary ?? null;
    }

    // What the card says today (app.ts showResults).
    const grudgeNext = M.save.rideableGrudge(d, key);
    const duelNext = mi >= 0 ? M.twelve.duelOn(d.twelve, mi, open) : null;
    let primary: string;
    if (duelNext) primary = duelNext.kind === 'final' ? 'The Last Race' : `${duel?.kind === 'duel' && duel.rider === duelNext.rider ? 'Rematch' : 'Duel'} ${duelNext.rider.name}`;
    else {
      const next = grudgeNext ? null : promiseNext(M, rode, d, key, you, climb?.spot ?? null);
      if (next?.rider) promised = { key, ...next.rider };
      primary = M.progress.runAgainLabel(null, grudgeNext, next ? { name: next.name, rode: next.rode } : null).aria.replace(/, run again$/, '');
    }
    const held = M.ladder.medalsHeld(d.climb?.[key]);
    const raceLine = M.progress.resultsRaceLine({
      friend: null,
      daily: settled.daily?.line ?? settled.cup?.line ?? null,
      grudge: settledG.line ? { text: settledG.line, strong: settledG.settled || M.settle.isNemesis(settledG.grudge) } : null,
      crash: null,
      event: null,
      rung: climb ? M.ladder.rungHook(climb.spot, you) : null,
      gold: board ? M.ladder.goldHook(sim.stageTicks, board, held.stages) : null,
      decided: null,
      dailyOpen: kind !== 'daily' && o.daily && dayIndex >= 1 ? M.progress.dailyHook(M.settle.dailyStreakNow(d.daily, today), d.daily.last === today) : null,
    });
    const unlockedNow = gains.some((x) => x.kind === 'unlock');
    const nu = unlockedNow ? null : M.progress.nextUnlock(d);
    const results: ResultsView = {
      primary,
      raceLine: raceLine?.text ?? null,
      nextUnlock: nu ? (nu.kind === 'mountain' ? `Pass ${nu.need - nu.have} more ghosts to open ${nu.name}` : `${nu.gifts} gifts to ${nu.name}`) : null,
      missions: settled.missions.filter((v: Any) => !v.done).map((v: Any) => v.text),
      spinePrimary,
    };

    const cr: CareerRun = {
      n: n + 1,
      day: today,
      facts: f,
      gains,
      results,
      goals: [],
      after: {
        gifts: d.gifts,
        lifetimeGifts: d.lifetimeGifts,
        ghostsPassed: d.ghostsPassed,
        open: MOUNTAINS.filter((_: Any, i: number) => open(i)).map((x: Any) => x.id),
        twelve: d.twelve?.beaten.length ?? 0,
        beaten: [...(d.twelve?.beaten ?? [])],
        stars: Object.values(d.mastery ?? {}).reduce((a: number, r: Any) => a + r.gates.length + r.moments.length + r.riders.length + (r.clean ? 1 : 0), 0) + Object.values(d.climb ?? {}).reduce((a: number, c: Any) => a + (c.medal ?? 0), 0),
        missions: d.missions.completed,
        streak: M.settle.dailyStreakNow(d.daily, today),
        climb: JSON.parse(JSON.stringify(d.climb ?? {})),
        mastery: JSON.parse(JSON.stringify(d.mastery ?? {})),
      },
    };
    out.push(cr);
    cr.goals = nearGoals(M, d, out, { today, week, key, mi, daily: !!o.daily && dayIndex >= 0, cup: !!o.cup });
    o.onRun?.(cr);

    // Where the next run goes: a mountain this run opened, else the next duel's home after a few runs here,
    // else somewhere fresher when this mountain has given nothing durable for five runs.
    if (kind !== 'pool') continue;
    const opened = MOUNTAINS.find((x: Any) => gains.some((gn) => gn.kind === 'unlock' && gn.text === x.name));
    sameStreak++;
    if (opened) {
      current = opened;
      sameStreak = 0;
      continue;
    }
    const nd = M.twelve.nextDuel(d.twelve, open);
    const ndHome = nd ? MOUNTAINS[M.twelve.duelMountain(nd)] : null;
    if (ndHome && ndHome !== current && open(MOUNTAINS.indexOf(ndHome)) && sameStreak >= 3) {
      current = ndHome;
      sameStreak = 0;
      continue;
    }
    const here = out.filter((r) => r.facts.key === current.id).slice(-5);
    if (here.length >= 5 && here.every((r) => !r.gains.some((gn) => gn.durable))) {
      const choices = MOUNTAINS.filter((_: Any, i: number) => open(i) && MOUNTAINS[i] !== current);
      if (choices.length) {
        const count = (id: string): number => out.filter((r) => r.facts.key === id).length;
        choices.sort((a: Any, b: Any) => count(a.id) - count(b.id) || rnd() - 0.5);
        current = choices[0];
        sameStreak = 0;
      }
    }
  }
  return out;
}

/** The field the app would lay (app.ts pickField). */
function fieldFor(M: Mods, d: Any, o: { key: string; pool: Any[]; chaos: Any; kind: 'pool' | 'daily' | 'cup'; duel: Any; promised: Any }): Any[] {
  const ownRec = d.best[o.key];
  const own = ownRec && M.save.recordOk(ownRec.record) ? ownRec : undefined;
  const grudge = M.save.rideableGrudge(d, o.key);
  const cup = o.kind === 'cup';
  const mine = own ? { name: d.name, score: own.score, distance: own.distance, record: own.record } : null;
  if (o.duel?.kind === 'final') {
    const all = M.twelve.finalField(o.pool).map((g: Any) => ({ name: g.name, kind: g.kind, score: g.score, record: g.record, role: g.role, ...(g.rival ? { rival: true } : {}) }));
    if (mine) all.push({ name: mine.name, kind: 'you', score: mine.score, record: mine.record });
    return all;
  }
  const duelRec = o.duel ? M.twelve.duelRecord(o.pool, o.duel.rider) : null;
  const promised = duelRec ? { key: o.key, name: duelRec.name, score: duelRec.score, record: duelRec.record } : o.promised;
  const recent = cup ? [] : M.field.recentFor(d.runTimes ?? {}, o.key);
  const picks = M.field.pickField({
    pool: o.pool,
    kind: o.kind === 'pool' ? 'pool' : 'daily',
    mood: o.chaos.mood,
    event: o.chaos.event,
    count: M.field.fieldCount(M.chaos.moodInfo(o.chaos.mood).params.extraGhosts, recent),
    anchor: cup ? 0 : M.field.anchorFor(d.runTimes ?? {}, o.key),
    recent,
    seed: o.chaos.seed,
    bestScore: ownRec?.score ?? 0,
    you: cup ? null : mine,
    grudge: grudge?.record ? { name: grudge.name, score: grudge.score, record: grudge.record, distance: grudge.distance, nemesis: M.settle.isNemesis(grudge) } : null,
    friend: null,
    promised,
  });
  if (cup && mine) picks.push({ name: mine.name, kind: 'you', score: mine.score, record: mine.record, distance: mine.distance });
  return picks.map((g: Any) => {
    const e: Any = { name: g.name, kind: g.kind, score: g.score, record: g.record };
    if (g.role) e.role = g.role;
    if (g.nemesis) e.nemesis = true;
    if (g.rival) e.rival = true;
    if (g.reads) e.reads = true;
    return e;
  });
}

/** How the run ended against its grudge (app.ts grudgeOutcome). */
function grudgeOutcome(M: Mods, rode: RodeRun, g: Any, you: Any): Any {
  let rodeG: Any = null;
  let next: Any = null;
  const ahead: Any[] = [];
  const A = M.standing.aheadOf;
  for (const t of rode.gm.tracks) {
    const st = M.ghosts.trackStanding(t);
    const real = M.ghosts.realStanding(t);
    if (g && t.entry.kind === 'grudge' && t.entry.record === g.record) rodeG = { distance: t.distance, time: st.time, passed: t.passed || A(you, real) };
    if (t.entry.kind === 'you' || t.entry.kind === 'friend') continue;
    if (!A(real, you)) continue;
    const row: Any = { name: t.entry.name, score: t.entry.score, record: t.entry.record, distance: t.distance, time: real.time, kind: t.entry.kind };
    if (t.entry.role) row.role = t.entry.role;
    const gap = rode.gapAtEnd.get(t.entry.id);
    if (gap !== undefined && !t.entry.reads && you.time === null) row.gapAtCrash = gap;
    ahead.push(row);
    if (!next || A({ time: next.time ?? null, distance: next.distance }, real)) next = row;
  }
  return { youDistance: you.distance, youTime: you.time, rode: rodeG, next, ahead };
}

/** Who Run Again names (app.ts promiseNext). */
function promiseNext(M: Mods, rode: RodeRun, d: Any, key: string, you: Any, spot: Any): { name: string; rode: boolean; rider: Any } | null {
  let ahead: Any = null;
  const pace = you.time ?? M.standing.predictedTime(you.distance, rode.sim.tick / 60);
  for (const t of rode.gm.tracks) {
    if (t.entry.kind === 'you' || t.entry.kind === 'friend') continue;
    const real = M.ghosts.realStanding(t);
    if (!M.standing.aheadOf(real, you) || (t.entry.reads && !M.pacer.inReach(real.time, pace))) continue;
    if (!ahead || M.standing.aheadOf(M.ghosts.realStanding(ahead), real)) ahead = t;
  }
  const rider = ahead ? { name: ahead.entry.name, score: ahead.entry.score, record: ahead.entry.record } : spot?.next ? { name: spot.next.name, score: spot.next.score, record: spot.next.record } : null;
  if (rider) return { name: rider.name, rode: ahead !== null || rode.gm.tracks.some((t: Any) => t.entry.record === rider.record), rider };
  return d.best[key] ? { name: 'your best', rode: true, rider: null } : null;
}

// ---------------------------------------------------------------- what is one run away

/** Every goal results could name after this run, and whether the pilot's recent form puts it in reach. */
function nearGoals(M: Mods, d: Any, hist: CareerRun[], at: { today: string; week: string; key: string; mi: number; daily: boolean; cup: boolean }): Goal[] {
  const MOUNTAINS: Any[] = M.mountains.MOUNTAINS;
  const out: Goal[] = [];
  const recent = hist.slice(-REACH_RUNS);
  const on = (key: string): CareerRun[] => hist.filter((r) => r.facts.key === key).slice(-REACH_RUNS);
  const quickest = (key: string): number | null => {
    const ts = on(key).map((r) => r.facts.time).filter((t): t is number => t !== null);
    return ts.length ? Math.min(...ts) : null;
  };
  const open = (i: number): boolean => M.twelve.mountainOpen(d, MOUNTAINS[i]);
  // Missions: a recent run on the mission's biome came within REACH_MISSION of its target (or one short of a
  // small count).
  for (const a of d.missions.active) {
    const def = M.missions.missionDef(a.id);
    if (!def) continue;
    const t = M.missions.missionTier(def, a.tier);
    const vals = recent.filter((r) => !def.biome || r.facts.sum.biome === def.biome).map((r) => def.metric(r.facts.sum));
    const top = vals.length ? Math.max(...vals) : 0;
    const reachable = top >= t.target * REACH_MISSION || (def.unit === 'n' && t.target >= 2 && top >= t.target - 1);
    out.push({ kind: 'mission', text: `${t.text} (${M.missions.missionProgressText(def, Math.max(a.best, top), t.target)})`, reachable, gap: t.target > 0 ? 1 - Math.min(1, top / t.target) : 0, names: [t.text] });
  }
  // The next duel: a recent finish on its home within REACH_DUEL_S of the rider's time.
  const nd = M.twelve.nextDuel(d.twelve, open);
  if (nd?.kind === 'duel') {
    const home = MOUNTAINS[nd.rider.home];
    const rt = M.twelve.homeTime(nd.rider);
    const q = quickest(home.id);
    const gap = rt !== null && q !== null ? q - rt : Infinity;
    out.push({ kind: 'duel', text: `Duel ${nd.rider.name} (${rt?.toFixed(1)} s)`, reachable: gap <= REACH_DUEL_S, gap, names: [nd.rider.name] });
  }
  // The ladder and the medals on the mountain just ridden.
  if (at.mi >= 0) {
    const key = at.key;
    const board = M.ladder.boardOf(M.pools[key]);
    const spot = M.ladder.spotOn(board, M.ladder.bestStanding(d.best[key]));
    const q = quickest(key);
    if (spot.next && spot.next.standing.time !== null && q !== null) {
      const gap = q - spot.next.standing.time;
      out.push({ kind: 'rung', text: `${spot.next.name} and rank ${(spot.rank ?? spot.of) - 1}`, reachable: gap <= M.ladder.NEAR_RUNG_S, gap, names: [spot.next.name] });
    }
    const held = M.ladder.medalsHeld(d.climb?.[key]);
    for (let i = 0; i < 3; i++) {
      const gold = board.stages[i]?.[2];
      if (gold === undefined || held.stages[i] >= 3) continue;
      const ss = on(key).map((r) => r.facts.stageSeconds[i]).filter((s) => s !== undefined);
      if (!ss.length) continue;
      const gap = Math.min(...ss) - gold;
      out.push({ kind: 'gold', text: `Gold in Stage ${i + 1}`, reachable: gap <= M.ladder.NEAR_GOLD_S, gap, names: [`Stage ${i + 1}`] });
    }
    if (board.run && held.run < 3 && q !== null) {
      const want = board.run[held.run];
      out.push({ kind: 'medal', text: `${M.settle.MEDAL_NAMES[held.run + 1]} on ${MOUNTAINS[at.mi].name}`, reachable: q - want <= 1, gap: q - want, names: [M.settle.MEDAL_NAMES[held.run + 1]] });
    }
    // The grudge.
    const g = M.save.rideableGrudge(d, key);
    if (g) {
      const gap = g.time !== undefined && q !== null ? q - g.time : (g.by ?? Infinity) / 25;
      out.push({ kind: 'grudge', text: `Rematch ${g.name}`, reachable: gap <= 2, gap, names: [g.name] });
    }
  }
  // The next mountain by passes.
  const nu = M.progress.nextUnlock(d);
  if (nu?.kind === 'mountain') {
    const need = nu.need - nu.have;
    const most = Math.max(0, ...recent.map((r) => r.facts.sum.ghostsPassed));
    out.push({ kind: 'unlock', text: `${need} more ghosts open ${nu.name}`, reachable: need <= most, gap: need, names: [nu.name] });
  }
  // Today's Daily, not yet ridden: a streak day is one run away.
  if (at.daily && d.daily.last !== at.today) out.push({ kind: 'daily', text: "Today's Daily", reachable: true, gap: 0, names: ['Daily'] });
  // Milestone 3's rank page, on a build that has it.
  if (M.rank?.nextPage) {
    const np = M.rank.nextPage(d);
    if (np) {
      const xs = recent.map((r) => (r.gains.find((gn) => gn.kind === 'xp') as Any)?.amount ?? 0);
      const per = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
      out.push({ kind: 'page', text: np.label, reachable: np.need <= per, gap: np.need, names: [np.label] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the bars, one function each

/** No dead runs: every run gained something results shows. `strict` counts only what the save keeps (the brief's
 *  own list: a rank, an unlock, a sticker, a duel, a medal, a streak day, a mission); the loose list adds a pass and
 *  a best, which the lane brief names too. */
export function barNoDeadRuns(runs: readonly CareerRun[]): { runs: number; deadStrict: number[]; deadLoose: number[]; lacked: Record<string, number>; byKind: Record<string, number> } {
  const deadStrict: number[] = [];
  const deadLoose: number[] = [];
  const byKind: Record<string, number> = {};
  const lacked: Record<string, number> = {};
  for (const r of runs) {
    for (const gn of r.gains) byKind[gn.kind] = (byKind[gn.kind] ?? 0) + 1;
    if (!r.gains.some((gn) => gn.durable)) {
      deadStrict.push(r.n);
      // What it had instead (so we know what a fix has to beat).
      const had = r.gains.map((gn) => gn.kind).join('+') || 'nothing';
      lacked[had] = (lacked[had] ?? 0) + 1;
    }
    if (r.gains.length === 0) deadLoose.push(r.n);
  }
  return { runs: runs.length, deadStrict, deadLoose, lacked, byKind };
}

/** Always one run away: after every run, a goal reachable next run exists, and the card's one button names it.
 *  `named` reads the button only; `anywhere` any line of the card (the race line, the next unlock, mission rows). */
export function barOneRunAway(runs: readonly CareerRun[]): { runs: number; withNear: number; primaryNames: number; anywhere: number; kinds: Record<string, number>; none: number[] } {
  let withNear = 0;
  let primaryNames = 0;
  let anywhere = 0;
  const kinds: Record<string, number> = {};
  const none: number[] = [];
  for (const r of runs) {
    const near = r.goals.filter((g) => g.reachable);
    if (!near.length) {
      none.push(r.n);
      continue;
    }
    withNear++;
    for (const g of near) kinds[g.kind] = (kinds[g.kind] ?? 0) + 1;
    const says = (text: string | null | undefined, g: Goal): boolean => !!text && g.names.some((nm) => text.includes(nm));
    const sp = r.results.spinePrimary;
    if (near.some((g) => says(r.results.primary, g) || (sp && sp.kind === g.kind))) primaryNames++;
    const lines = [r.results.primary, r.results.raceLine, r.results.nextUnlock, ...r.results.missions];
    if (near.some((g) => lines.some((l) => says(l, g)))) anywhere++;
  }
  return { runs: runs.length, withNear, primaryNames, anywhere, kinds, none };
}

/** Decisions: the kinds of choice a run holds and how many it makes. */
export function barDecisions(runs: readonly RunFacts[]): { kinds: string[]; perRun: number[]; median: number; byKind: Record<string, number> } {
  const byKind: Record<string, number> = {};
  const perRun = runs.map((f) => {
    for (const c of f.choices) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
    return f.choices.length;
  });
  const s = [...perRun].sort((a, b) => a - b);
  return { kinds: Object.keys(byKind).sort(), perRun, median: s.length ? s[s.length >> 1] : 0, byKind };
}

/** Expression: the named air tricks there are, and the most distinct ones in one combo of the expert's. Today a
 *  spin's size is not a new trick: the families (spin, flip, spin+flip) are the vocabulary; once the sim lane's
 *  `trick` events land, their names are. */
export function barExpression(M: Mods, runs: readonly RunFacts[]): { vocabulary: string[]; seen: string[]; bestCombo: string[]; bestComboFamilies: number } {
  const named = runs.some((f) => f.tricks.some((t) => t.family === t.name));
  const vocabulary: string[] = M.sim.TRICKS ? M.sim.TRICKS.map((t: Any) => t.name ?? t) : named ? [...new Set(runs.flatMap((f) => f.tricks.map((t) => t.name)))] : ['spin', 'flip', 'spin+flip'];
  const seen = [...new Set(runs.flatMap((f) => f.tricks.map((t) => t.name)))].sort();
  let bestCombo: string[] = [];
  let bestFam = 0;
  for (const f of runs) {
    const by = new Map<number, typeof f.tricks>();
    for (const t of f.tricks) by.set(t.combo, [...(by.get(t.combo) ?? []), t]);
    for (const ts of by.values()) {
      const fam = new Set(ts.map((t) => t.family)).size;
      if (fam > bestFam || (fam === bestFam && ts.length > bestCombo.length)) {
        bestFam = fam;
        bestCombo = ts.map((t) => t.name);
      }
    }
  }
  return { vocabulary, seen, bestCombo, bestComboFamilies: bestFam };
}

/** First minute: a first-time player's run 1 on Pinecrest with the field the game lays on a first run. */
export function firstRun(M: Mods, pilot: string, seed: number, mi = 0): RunFacts {
  const d: Any = M.save.defaultSave('Rider');
  const mountain = M.mountains.MOUNTAINS[mi];
  const chaos = M.chaos.rollChaos(seed, 0, 0);
  // (A mountain past Pinecrest is ridden as if it were open, with no duel: the expression bar's rides.)
  const duel = mi === 0 ? M.twelve.duelOn(undefined, 0, (i: number) => M.twelve.mountainOpen(d, M.mountains.MOUNTAINS[i])) : null;
  const entries = fieldFor(M, d, { key: mountain.id, pool: M.pools[mountain.id], chaos, kind: 'pool', duel, promised: null });
  return ride(M, { pilot, pilotSeed: seed, key: mountain.id, mountain, mi, chaos, sled: 0, entries, maxSeconds: 600 }).facts;
}

export function barFirstMinute(f: RunFacts): { pass: number | null; perfect: number | null; dash: number | null; ok: boolean } {
  const s = (t: number | null): number | null => (t === null ? null : t / 60);
  const pass = s(f.firstPass);
  const perfect = s(f.firstPerfect);
  const dash = s(f.firstDash);
  return { pass, perfect, dash, ok: pass !== null && pass <= 20 && perfect !== null && perfect <= 45 && dash !== null && dash <= 60 };
}

/** The clumsy pilot's finishes over the lab's thirty: six seeds on each of the five mountains (lab.ts's plan and
 *  rolls), each with the field a first run there would lay. */
export function clumsyFinishes(M: Mods, seeds = 6): { finished: number; of: number } {
  let finished = 0;
  let of = 0;
  const d: Any = M.save.defaultSave('Rider');
  M.mountains.MOUNTAINS.forEach((mountain: Any, mi: number) => {
    for (let i = 0; i < seeds; i++) {
      const seed = 1234 + i * 37;
      const chaos = { mood: 0, event: 0, seed: (0x1234 + seed * 2654435761) >>> 0 };
      const entries = fieldFor(M, d, { key: mountain.id, pool: M.pools[mountain.id], chaos, kind: 'pool', duel: null, promised: null });
      const f = ride(M, { pilot: 'clumsy', pilotSeed: seed, key: mountain.id, mountain, mi, chaos, sled: 0, entries, maxSeconds: 600 }).facts;
      of++;
      if (f.finished) finished++;
    }
  });
  return { finished, of };
}

/** Still new at run 50: on every mountain, something the player has not seen that it can go for next run. What
 *  there is to see on a mountain today: each set piece's variants and the two legends (rolled: a variant meets one
 *  run in two or three there, a legend one in ten), every mastery star (medals, sky gates, set pieces, home riders,
 *  a clean finish), and milestone 3's stickers on a build that has them. Reachable next run: the mountain is open
 *  and either the item rolls at least one run in three (a variant), or the pilot's recent form says it can be had
 *  (a medal within 1 s, a home rider within 2 s, a sky gate when it has flown one, a set piece it has won, a clean
 *  finish in its last five). */
export function barStillNew(M: Mods, runs: readonly CareerRun[], at = 50): { mountain: string; open: boolean; seen: number; unseen: number; reachable: string[] }[] {
  const upto = runs.filter((r) => r.n <= at);
  const last = upto[upto.length - 1];
  const MOUNTAINS: Any[] = M.mountains.MOUNTAINS;
  const openIds = new Set(last?.after.open ?? []);
  const recent = upto.slice(-REACH_RUNS);
  const cleanLately = recent.some((r) => r.facts.finished && r.facts.tumbles === 0 && r.facts.wards === 0);
  const wonKeys = new Set(upto.flatMap((r) => r.facts.moments.filter((q) => q.won).map((q) => q.key)));
  const flown = upto.some((r) => r.facts.gates.length > 0);
  return MOUNTAINS.map((mt: Any) => {
    const course = new M.sim.Sim({ seed: mt.seed, chaos: { mood: 0, event: 0, seed: 1 }, sled: 0 }).course;
    const specs: Any[] = M.moments.planMoments ? M.moments.planMoments(course) : [];
    const here = upto.filter((r) => r.facts.key === mt.id);
    const seenVar = new Set(here.flatMap((r) => r.facts.moments.map((q) => `${q.index}:${q.variant}`)));
    const seenLegend = new Set(here.map((r) => r.facts.legend).filter((x) => x > 0));
    const open = openIds.has(mt.id);
    const reachable: string[] = [];
    let unseen = 0;
    let seen = 0;
    for (const sp of specs) {
      for (let v = 0; v < sp.variants; v++) {
        if (seenVar.has(`${sp.index}:${v}`)) {
          seen++;
          continue;
        }
        unseen++;
        if (open) reachable.push(`${sp.name}, variant ${v + 1}`);
      }
    }
    for (const slot of [1, 2]) {
      if (seenLegend.has(slot)) seen++;
      else unseen++;
    }
    const rec = M.mastery.readMastery(last?.after.mastery?.[mt.id]);
    const medal = last?.after.climb?.[mt.id]?.medal ?? 0;
    const q = here.slice(-REACH_RUNS).map((r) => r.facts.time).filter((t): t is number => t !== null);
    const quick = q.length ? Math.min(...q) : null;
    const board = M.ladder.boardOf(M.pools[mt.id]);
    for (const star of M.mastery.masteryBoard(course, mt.id, rec, medal)) {
      if (star.done) {
        seen++;
        continue;
      }
      unseen++;
      if (!open) continue;
      let can = false;
      if (star.group === 'medal') {
        const want = board.run?.[Number(star.key.slice(5)) - 1];
        can = quick !== null && want !== undefined && quick - want <= 1;
      } else if (star.group === 'gate') can = flown;
      else if (star.group === 'moment') can = wonKeys.has(star.key.slice(3));
      else if (star.group === 'rider') {
        const r = M.roster.ROSTER.find((x: Any) => `rider:${x.key}` === star.key);
        const t = r ? M.twelve.homeTime(r) : null;
        can = quick !== null && t !== null && quick - t <= 2;
      } else if (star.group === 'clean') can = cleanLately;
      if (can) reachable.push(star.label);
    }
    return { mountain: mt.id, open, seen, unseen, reachable };
  });
}
