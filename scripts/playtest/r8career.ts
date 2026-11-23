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
import { type Kit, type Pilot, classic, clumsy, mulberry, prompted, scripted, spenderFor, timeToLand, trickster } from './labpilots';

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
  /** SIM_VERSION 10's tricks and charms, null on an older build. */
  tricks: Any | null;
  charms: Any | null;
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
  garage: Any;
  paints: Any;
  sleds: Any;
  rank: Any | null;
  contracts: Any | null;
  lanterns: Any | null;
  hints: Any;
  almanac: Any | null;
  album: Any | null;
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
    tricks: existsSync(resolve(at, 'src/sim/tricks.ts')) ? await load('src/sim/tricks.ts') : null,
    charms: existsSync(resolve(at, 'src/sim/charms.ts')) ? await load('src/sim/charms.ts') : null,
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
    garage: await load('src/game/garage.ts'),
    paints: await load('src/game/paints.ts'),
    sleds: await load('src/sim/sleds.ts'),
    rank: existsSync(resolve(at, 'src/game/rank.ts')) ? await load('src/game/rank.ts') : null,
    contracts: existsSync(resolve(at, 'src/game/contracts.ts')) ? await load('src/game/contracts.ts') : null,
    lanterns: existsSync(resolve(at, 'src/game/lanterns.ts')) ? await load('src/game/lanterns.ts') : null,
    hints: await load('src/game/hints.ts'),
    almanac: existsSync(resolve(at, 'src/game/almanac.ts')) ? await load('src/game/almanac.ts') : null,
    album: existsSync(resolve(at, 'src/game/album.ts')) ? await load('src/game/album.ts') : null,
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
  tricks: { tick: number; name: string; family: string; key: string; combo: number }[];
  /** Charms ridden through (ids) and synergies found (ids), on a SIM_VERSION 10 build. */
  charms: number[];
  synergies: number[];
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
  /** The first 30 s, a second at a time: [s, your metres, each rider's gap to you in field order]. */
  trace: number[][];
  /** On a coached run (a save's first): how often each hint went up, as hints.ts's coach steps it in the app. */
  hintShows: Record<string, number>;
}

/** Event types the sim lane's batch may add that are a choice by themselves (a charm gate ridden through, a
 *  showdown taken up). A dash and a fork's channel are read from today's sim. */
export const CHOICE_EVENTS: Readonly<Record<string, (e: Any) => boolean>> = {
  dash: (e) => e.type === 'dash' && e.phase === 'start',
  // SIM_VERSION 10 (r8-sim's stable interfaces): a charm gate ridden through, and a showdown won (the sim raises
  // 'rival' as the record's token is applied).
  charm: (e) => e.type === 'charm',
  // (Round 8, the merge: a showdown started is the choice, read off the run's rival probe as the app reads it; the
  // sim's 'rival' token is only the win, counted apart as showdownsWon.)
  showdown: (e) => e.type === 'showdown' && (e.phase === undefined || e.phase === 'start'),
};

/** A trick's name as today's director calls it (director.ts trickWord), and its family. */
function trickOf(halfTurns: number, flips: number): { name: string; family: string; key: string } | null {
  const FLIPS = ['Backflip', 'Double Backflip', 'Triple Backflip'];
  if (flips > 0) return { name: FLIPS[flips - 1] ?? `${flips} Backflips`, family: halfTurns > 0 ? 'spin+flip' : 'flip', key: 'backflip' };
  if (halfTurns > 0) return { name: `Spin ${halfTurns * 180}`, family: 'spin', key: 'spin' };
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
  /** Step the hint coach as the app does (a fresh save's counts), and count what it shows. */
  coach?: boolean;
  /** What the save decides for the run's SimConfig, as the app's runExtra does (charmpool.ts): the Almanac's charm
   *  pool and gates, and a save's very first run. Absent on a build without the Almanac. */
  extra?: Any;
}

interface RodeRun {
  facts: RunFacts;
  run: Any;
  gm: Any;
  sim: Any;
  gapAtEnd: Map<number, number>;
}

/** A pilot and how it spends its lantern. '<pilot>-prompted' is the clumsy pilot or the novice following the hints
 *  (labpilots.ts prompted); 'trickster-<skill>' the lab's mid or expert on the air map and the charm gates (lab.ts
 *  rides them as 'mid' and 'expert'); 'hands-off' no input at all. */
function makePilot(M: Mods, name: string, sim: Any, seed: number): { pilot: Pilot; spend: () => boolean } {
  const kit: Kit = { gateX: M.moments.gateX, pathX: M.moments.pathX, machineZ: M.moments.machineZ };
  if (name === 'hands-off') return { pilot: scripted(() => 0)(sim), spend: () => false };
  if (name.startsWith('trickster-')) {
    const skill = name.slice(10) as 'mid' | 'expert';
    return { pilot: trickster(skill, sim, seed, kit), spend: spenderFor(skill, sim, seed) };
  }
  const base = name.replace(/-prompted$/, '');
  const pilot = base === 'clumsy' ? clumsy(sim, seed) : classic(base as 'mid', sim, seed, kit);
  const spend = spenderFor(base, sim, seed);
  return name.endsWith('-prompted') ? prompted(pilot, spend, sim, seed, base === 'clumsy' ? 'clumsy' : 'novice') : { pilot, spend };
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
  const run = new M.run.Run(p.mountain.seed, p.chaos, p.sled, src, p.extra ?? {});
  const sim = run.sim;
  const made = makePilot(M, p.pilot, sim, p.pilotSeed);
  src.pilot = made.pilot;
  src.spend = made.spend;
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
  // (SIM_VERSION 10: the field's showdowns and spirit steals, decided as the app decides them, app.ts startRun.)
  if (gm.rivalProbe) run.rivalProbe = gm.rivalProbe(sim.course.finishZ);
  const START_TICKS: number = M.race.START_TICKS ?? 360;
  const facts: RunFacts = { pilot: p.pilot, key: p.key, mountainId: p.mountain.id, mi: p.mi, chaos: p.chaos, sum: null, finished: false, time: null, distance: 0, seconds: 0, stageSeconds: [], passes: [], firstPass: null, firstPerfect: null, firstDash: null, choices: [], tricks: [], charms: [], synergies: [], moments: [], legend: 0, gates: [], tumbles: 0, wards: 0, events: {}, field: [], ticks: 0, trace: [], hintShows: {} };
  let combo = 0;
  let inCombo = false;
  let wallRides = 0;
  let lastWall = -1e9;
  let grinds = 0;
  let forkAt = -1;
  const met = new Map<number, number>();
  // The hint coach (app.ts updateHints and markHint), on a coached run.
  const coach = p.coach ? new M.hints.HintCoach() : null;
  const learnt: Record<string, number> = {};
  const seenRuns: Record<string, number> = {};
  let airTicks = 0;
  let steered = false;
  const kickerAhead = (s: Any): boolean => {
    const reach = Math.max(40, s.speed * 2.2);
    const ci = Math.floor(s.z / 64);
    for (let k = ci; k <= ci + 2; k++) for (const r of sim.course.zones(k).ramps) {
      const lip = r.z + r.len - s.z;
      if (lip > 0 && lip <= reach && Math.abs(s.x - r.x) < r.w / 2 + 3) return true;
    }
    return false;
  };
  const mark = (k: string): void => {
    learnt[k] = (learnt[k] ?? 0) + 1;
    if (coach && coach.shown === k) coach.drop();
  };
  const coachStep = (sm: Any): void => {
    const s = sm.s;
    airTicks = s.grounded ? 0 : airTicks + 1;
    if (Math.abs(s.steer) > 0.2) steered = true;
    const ttl = s.grounded ? Infinity : timeToLand(sm).t;
    const step = coach!.step({ dt: 1 / 60, timer: sm.tick / 60, steered, grounded: s.grounded, drifting: s.drifting, action: s.action, drafting: s.drafting, airTicks, ttl, runs: 0, z: s.z, kickerAhead: s.grounded && (learnt.boostPop ?? 0) < 1 && kickerAhead(s), heldLip: false, draftTarget: false, chased: false, tumbling: s.tumble > 0, lit: s.lantern >= 100, dashed: sm.stats.dashes > 0, astray: s.grounded && sm.course.edgeExcess(s.x, s.z) > 0, grabbing: (s.grab ?? 0) !== 0 }, learnt, seenRuns);
    if (step.seen) seenRuns[step.seen] = (seenRuns[step.seen] ?? 0) + 1;
    for (const k of step.learned) learnt[k] = Math.max(1, learnt[k] ?? 0);
    if (step.show) facts.hintShows[step.show] = (facts.hintShows[step.show] ?? 0) + 1;
  };
  const named = !!M.tricks?.TRICKS;
  const specs: Any[] = M.moments.planMoments ? M.moments.planMoments(sim.course) : [];
  const variantOf = (index: number): number => {
    const s = specs.find((q) => q.index === index);
    return s && M.moments.variantOf ? M.moments.variantOf(p.chaos, index, s.variants) : 0;
  };
  while (!sim.s.crashed && !sim.finished && sim.tick < p.maxSeconds * 60) {
    run.tick();
    const s = sim.s;
    gm.pace(sim.tick, s.z, !sim.finished && !s.crashed);
    if (coach) coachStep(sim);
    // The first 30 s, a second at a time: your metres and each rider's gap to you (for reading a first run's race).
    if (sim.tick % 60 === 0 && sim.tick <= 1800) facts.trace.push([sim.tick / 60, Math.round(s.z), ...gm.tracks.map((t: Any) => Math.round(gm.zAt(t, sim.tick) - s.z))]);
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
    for (const { tick, e } of run.drainRivals?.() ?? []) for (const [kind, is] of Object.entries(CHOICE_EVENTS)) if (is(e)) facts.choices.push({ tick, kind });
    for (const { tick, e } of run.drain()) {
      facts.events[e.type] = (facts.events[e.type] ?? 0) + 1;
      if (e.type === 'rival' && e.kind === 'showdown') facts.events.showdownWon = (facts.events.showdownWon ?? 0) + 1;
      for (const [kind, is] of Object.entries(CHOICE_EVENTS)) if (is(e)) facts.choices.push({ tick, kind });
      if (e.type === 'dash' && e.phase === 'start' && facts.firstDash === null) facts.firstDash = tick;
      if (coach) {
        if (e.type === 'land' && e.quality === 'perfect') mark('stomp');
        if (e.type === 'land' && e.quality !== 'sketchy' && e.halfTurns >= 2) mark('spin');
        if (e.type === 'land' && e.quality !== 'sketchy' && e.flips >= 1) mark('flip');
        if (e.type === 'drift' && e.phase === 'release') mark('drift');
        if (e.type === 'style' && e.kind === 'pop') mark('pop');
        if (e.type === 'style' && e.kind === 'boostPop') mark('boostPop');
      }
      if (e.type === 'land' && !e.botched) {
        if (e.quality === 'perfect' && facts.firstPerfect === null) facts.firstPerfect = tick;
        const t = named ? null : trickOf(e.halfTurns, e.flips);
        if (t) {
          if (!inCombo) {
            combo++;
            inCombo = true;
          }
          facts.tricks.push({ tick, ...t, combo });
        }
      }
      // SIM_VERSION 10's named tricks: every one is a style event carrying its id (tricks.ts TRICKS).
      if (named && e.type === 'style' && typeof e.trick === 'number' && e.trick > 0) {
        const def = M.tricks.TRICKS[e.trick];
        if (!inCombo) {
          combo++;
          inCombo = true;
        }
        facts.tricks.push({ tick, name: def?.name ?? String(e.trick), family: def?.name ?? String(e.trick), key: def?.key ?? String(e.trick), combo });
      }
      if (e.type === 'charm' && typeof e.id === 'number' && e.id >= 0) facts.charms.push(e.id);
      if (e.type === 'synergy' && typeof e.id === 'number') facts.synergies.push(e.id);
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
  spinePrimary?: { kind: string; label: string; names: string[] } | null;
}

export interface CareerRun {
  n: number;
  day: string;
  facts: RunFacts;
  gains: Gain[];
  results: ResultsView;
  goals: Goal[];
  /** The save's figures after this run (for the economy table). */
  after: {
    gifts: number;
    lifetimeGifts: number;
    ghostsPassed: number;
    open: string[];
    twelve: number;
    beaten: string[];
    stars: number;
    missions: number;
    streak: number;
    climb: Record<string, Any>;
    mastery: Record<string, Any>;
    /** The spine: Almanac pages turned, charms in the pool, stickers held, chapter pages opened. */
    page: number;
    charms: number;
    stickers: number;
    chapterPages: number;
    /** The garage: pieces bought so far and this run, and what is still on the shelf to want (pieces, gifts). */
    bought: number;
    boughtNow: string[];
    wanted: { pieces: number; gifts: number };
    /** The Almanac's pages opened, and the stickers held (for the run 50 bar). */
    claimed: number;
    albumGot: string[];
  };
  /** XP the run paid, and the rival it lost to (for the rematch goal). */
  xp: number;
  lostTo: LostTo | null;
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
  /** Where the player goes after a run: 'roam' (the default: a mountain just opened, the next duel's home, somewhere
   *  fresher after five runs that kept nothing), 'stay' (the first mountain, always), or 'button' (where the results'
   *  one button goes, as app.ts againTo: today's Daily, a duel rider's home, else the same mountain again). */
  follow?: 'roam' | 'stay' | 'button';
  /** Called after each run (progress). */
  onRun?: (r: CareerRun) => void;
  /** Called after each run with the save itself as the run left it (round 9: r9-fixtures.ts copies it at chosen
   *  runs). The save is live: copy it before keeping it. */
  onSave?: (r: CareerRun, save: Any) => void;
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
  let wantDaily = false;
  const shop = { bought: [] as string[] };
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
    if (o.daily && dailyDone !== today && (wantDaily || (o.follow !== 'button' && dayIndex >= 1 && sessionRuns === 0))) {
      wantDaily = false;
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
    // (Round 8: the duels wait for a save's third run, duelOn's `runs`; an older build ignores it.)
    const duel = mi >= 0 ? M.twelve.duelOn(d.twelve, mi, open, d.runs) : null;
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
    const extra = M.almanac ? { charmPool: M.almanac.almanacPool(d), charmGates: M.almanac.almanacGates(d), firstRun: d.runs === 0 } : undefined;
    const rode = ride(M, { pilot: o.pilot, pilotSeed, key, mountain, mi, chaos, sled: d.sled, entries, maxSeconds: o.maxSeconds ?? 600, extra });
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
    let fresh: string[] = [];
    let oc: Any = null;
    if (mi >= 0) {
      board = M.ladder.boardOf(M.pools[mountain.id]);
      const rides = Math.max(1, d.runTimes?.[key]?.length ?? 1);
      climb = M.ladder.settleClimb(d, key, board, M.sim.SIM_VERSION, climbAtStart, { standing: you, best: M.ladder.bestStanding(d.best[key]), bestBefore: M.ladder.bestStanding(bestAtStart), ticks: sim.stageTicks, rides });
      if (climb.spot.rank !== null && climb.rankWas !== null && climb.spot.rank < climb.rankWas) gains.push({ kind: 'rung', text: `Rank ${climb.spot.rank} of ${climb.spot.of}`, durable: true });
      else if (climb.spot.rank !== null && climb.rankWas === null && !bestAtStart) gains.push({ kind: 'rung', text: `On the ladder: rank ${climb.spot.rank}`, durable: true });
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
      fresh = M.mastery.settleMastery(sim.course, key, rec, { gates: f.gates, moments: f.moments.map((q) => ({ key: q.key, took: 0, total: 0, clean: false, won: q.won })), time: f.time, riderTimes, clean: f.tumbles === 0 && f.wards === 0 }, climbAtStart?.medal ?? 0, d.climb?.[key]?.medal ?? 0, rides);
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
      oc = M.twelve.settleTwelve(t, duel, you, standings);
      if (!t.beaten.length) delete d.twelve;
      const pay = oc.fell ? M.twelve.DUEL_GIFTS : oc.crowned ? M.twelve.CROWN_GIFTS : 0;
      d.gifts += pay;
      d.lifetimeGifts += pay;
      if (oc.fell || oc.crowned) gains.push({ kind: 'duel', text: oc.crowned ? 'The last race' : `Beat ${duel.rider.name}`, durable: true });
      if (oc.opened) gains.push({ kind: 'unlock', text: MOUNTAINS[M.twelve.KING.home].name, durable: true });
    }
    if (f.sum.ghostsPassed > 0) gains.push({ kind: 'pass', text: `${f.sum.ghostsPassed} passed`, durable: false });
    if (best.newTop || best.newTime) gains.push({ kind: 'best', text: best.newTime ? 'New best time' : 'New best', durable: false });

    // The rival the run lost to, nearest first: the duel's rider, the grudge, else the rider just ahead.
    const lostTo = lostToOf(M, rode, you, duel, oc, grudgeAtStart);
    // Milestone 3's spine, on a build that has it (rank.ts settleSpine, as the app calls it on the results).
    let spinePrimary: ResultsView['spinePrimary'] = null;
    let xp = 0;
    let page = 0;
    if (M.rank?.settleSpine) {
      const held0 = M.ladder.medalsHeld(d.climb?.[key]);
      const firstSeen = new Set<string>();
      const tierOf = (text: string): number => (text.endsWith(' (III)') ? 3 : text.endsWith(' (II)') ? 2 : 1);
      const sp = M.rank.settleSpine(d, {
        key,
        mi,
        mountainId: mi >= 0 ? mountain.id : kind,
        mirror: false,
        day: today,
        week,
        sum: f.sum,
        time: f.time,
        stageSeconds: f.stageSeconds,
        beaten: f.field.filter((q) => q.kind !== 'you' && !M.standing.aheadOf({ time: q.time, distance: q.distance }, you)).length,
        passed: f.sum.ghostsPassed,
        tricks: f.tricks.map((t) => {
          const isNew = !firstSeen.has(t.key);
          firstSeen.add(t.key);
          return { key: t.key, fresh: isNew };
        }),
        moments: f.moments,
        showdownsWon: f.events.showdownWon ?? 0,
        charms: f.charms.map((id) => Object.keys(M.almanac?.CHARM_IDS ?? {}).find((k) => M.almanac.CHARM_IDS[k] === id) ?? String(id)),
        synergies: f.synergies.map((id) => M.album?.SYNERGY_KEYS?.[id] ?? String(id)),
        legend: f.legend,
        mood: chaos.mood,
        missions: settled.missions.filter((v: Any) => v.justCompleted).map((v: Any) => tierOf(v.text)),
        rungs: climb && climb.rankWas !== null && climb.spot.rank !== null ? Math.max(0, climb.rankWas - climb.spot.rank) : 0,
        stageMedals: climb ? climb.fresh.filter((i: number) => i < 3).map((i: number) => held0.stages[i]) : [],
        runMedal: climb && climb.fresh.includes(3) ? held0.run : 0,
        dayMedal: settled.daily && settled.daily.best > dailyMedalBefore ? settled.daily.best : settled.cup && settled.cup.best > cupMedalBefore ? settled.cup.best : 0,
        stars: fresh.length,
        duelWon: oc?.fell && duel?.kind === 'duel' ? duel.rider.key : null,
        duelLost: duel?.kind === 'duel' && !oc?.fell,
        crowned: !!oc?.crowned,
        newBestTime: best.newTime && bestAtStart?.time !== undefined,
        lostTo,
        board,
        open: MOUNTAINS.filter((_: Any, i: number) => open(i)).map((x: Any) => x.id),
        dailyReady: !!o.daily,
        cupPool: kind === 'cup' ? pool : undefined,
        record: M.replay.recordToString(rode.run.toRecord(d.name)),
      });
      for (const gn of sp.gains) gains.push({ kind: gn.kind, text: gn.text, durable: true });
      spinePrimary = { kind: sp.primary.goal?.kind ?? 'none', label: sp.primary.sub ? `${sp.primary.text}: ${sp.primary.sub}` : sp.primary.text, names: sp.primary.goal?.names ?? [] };
      xp = sp.xp;
      page = sp.pageAfter;
      // The player takes the swap a mission held too long offers (one a day).
      const sw = M.missions.swappable?.(d.missions, today);
      const pushed = sp.primary.kind === 'mission' && sw && (sp.primary.goal?.names ?? []).includes(missionText(M, d, sw));
      if (sw && !pushed) M.missions.swapMission(d.missions, sw, today, { unlockedBiomes: M.missions.unlockedBiomes(d.ghostsPassed) });
    }
    const bought = spendGifts(M, d, today, shop);

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
      xp,
      lostTo,
      after: {
        gifts: d.gifts,
        lifetimeGifts: d.lifetimeGifts,
        ghostsPassed: d.ghostsPassed,
        open: MOUNTAINS.filter((_: Any, i: number) => open(i)).map((x: Any) => x.id),
        twelve: d.twelve?.beaten.length ?? 0,
        beaten: [...(d.twelve?.beaten ?? [])],
        stars: Object.values(d.mastery ?? {}).reduce((a: number, r: Any) => a + r.gates.length + r.moments.length + r.riders.length + (r.clean ? 1 : 0), 0) + Object.values(d.climb ?? {}).reduce((a: number, c: Any) => a + (c.medal ?? 0), 0),
        missions: d.missions.completed,
        streak: d.flame ? d.flame.streak : M.settle.dailyStreakNow(d.daily, today),
        climb: JSON.parse(JSON.stringify(d.climb ?? {})),
        mastery: JSON.parse(JSON.stringify(d.mastery ?? {})),
        page,
        charms: M.almanac ? popcount(M.almanac.almanacPool(d)) : 0,
        stickers: Object.keys(d.album?.got ?? {}).length,
        chapterPages: Object.values(d.chapters ?? {}).reduce((a: number, c: Any) => a + c.claimed, 0),
        bought: shop.bought.length,
        boughtNow: bought,
        wanted: wantedLeft(M, d, today),
        claimed: d.rank?.claimed ?? 0,
        albumGot: Object.keys(d.album?.got ?? {}),
      },
    };
    out.push(cr);
    cr.goals = nearGoals(M, d, out, { today, week, key, mi, daily: !!o.daily && dayIndex >= 0, cup: !!o.cup });
    o.onRun?.(cr);
    o.onSave?.(cr, d);

    // Where the next run goes: a mountain this run opened, else the next duel's home after a few runs here,
    // else somewhere fresher when this mountain has given nothing durable for five runs.
    if (o.follow === 'stay') continue;
    if (o.follow === 'button') {
      const goal = results.spinePrimary?.kind;
      if (goal === 'daily') wantDaily = true;
      else if (goal === 'duel') {
        const nd = M.twelve.nextDuel(d.twelve, open);
        if (nd) current = MOUNTAINS[M.twelve.duelMountain(nd)];
      }
      continue;
    }
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
    key: o.key,
    withheld: M.twelve.withheldRiders?.(d.twelve) ?? [],
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
  // Milestone 3's rank page, on a build that has it: in reach when the XP still to go is no more than the median run
  // of the last few paid.
  if (M.rank?.nextPage) {
    const np = M.rank.nextPage(d);
    if (np) {
      const xs = recent.map((r) => r.xp).sort((a, b) => a - b);
      const per = xs.length ? xs[(xs.length - 1) >> 1] : 0;
      out.push({ kind: 'page', text: np.label, reachable: per > 0 && np.need <= per, gap: np.need, names: [np.label] });
    }
  }
  // Contracts (today's not met, and the form contract): in reach when one of the last runs met the measure.
  const c = d.contracts;
  if (c && M.contracts) {
    const value = (r: CareerRun, metric: string): number => {
      const sm = r.facts.sum;
      const m: Record<string, number> = { finish: sm.finished ? 1 : 0, passes: sm.ghostsPassed, perfects: sm.perfects, setPieces: r.facts.moments.filter((q) => q.won).length, tricks: new Set(r.facts.tricks.map((t) => t.key)).size, lights: sm.lights, nearMisses: sm.nearMisses, dashes: sm.dashes, stageGold: 0 };
      return metric === 'time' ? (r.facts.time ?? Infinity) : (m[metric] ?? 0);
    };
    const inReach = (k: Any): boolean => recent.some((r) => (k.metric === 'time' ? r.facts.key === k.on && value(r, 'time') <= k.target : value(r, k.metric) >= k.target));
    if (c.day === at.today) c.list.forEach((k: Any, i: number) => {
      if (c.done & (1 << i)) return;
      const text = M.contracts!.contractText(k);
      out.push({ kind: 'contract', text, reachable: inReach(k), gap: 0, names: [text] });
    });
    if (c.form) {
      const text = M.contracts.contractText(c.form);
      out.push({ kind: 'form', text, reachable: inReach(c.form), gap: 0, names: [text] });
    }
  }
  // A rematch with the rival this run lost to: in reach within 3 s of a duel's rider, 2 s or 50 m of anyone else.
  const last = hist[hist.length - 1];
  const l = last?.lostTo;
  if (l) {
    const near = l.seconds !== null ? l.seconds <= (l.kind === 'duel' ? 3 : 2) : l.metres !== null && l.metres <= 50;
    out.push({ kind: 'rematch', text: `Rematch ${l.name}`, reachable: near, gap: l.seconds ?? (l.metres ?? 999) / 25, names: [l.name] });
  }
  return out;
}

/** The rival a run lost to, for a rematch: the duel's rider if the duel was lost, else the grudge if it rode and
 *  beat you, else the rider who finished just ahead of you. Seconds when both finished, else metres. */
export interface LostTo {
  name: string;
  kind: 'duel' | 'grudge' | 'rival';
  seconds: number | null;
  metres: number | null;
}

function lostToOf(M: Mods, rode: RodeRun, you: Any, duel: Any, oc: Any, grudge: Any): LostTo | null {
  const A = M.standing.aheadOf;
  const gapTo = (st: Any): { seconds: number | null; metres: number | null } => (st.time !== null && you.time !== null ? { seconds: Math.max(0, you.time - st.time), metres: null } : { seconds: null, metres: Math.max(0, st.distance - you.distance) });
  const rows = rode.gm.tracks.filter((t: Any) => t.entry.kind !== 'you' && t.entry.kind !== 'friend').map((t: Any) => ({ t, st: M.ghosts.realStanding(t) })).filter((x: Any) => A(x.st, you));
  if (duel?.kind === 'duel' && !oc?.fell) {
    const row = rows.find((x: Any) => x.t.entry.name === duel.rider.name);
    if (row) return { name: duel.rider.name, kind: 'duel', ...gapTo(row.st) };
  }
  if (grudge) {
    const row = rows.find((x: Any) => x.t.entry.record === grudge.record);
    if (row) return { name: grudge.name, kind: 'grudge', ...gapTo(row.st) };
  }
  let best: Any = null;
  for (const x of rows) if (!best || A(best.st, x.st)) best = x;
  return best ? { name: best.t.entry.name, kind: 'rival', ...gapTo(best.st) } : null;
}

/** An active mission's text at its tier. */
function missionText(M: Mods, d: Any, id: string): string {
  const def = M.missions.missionDef(id);
  const a = d.missions.active.find((x: Any) => x.id === id);
  return def && a ? M.missions.missionTier(def, a.tier).text : '';
}

function popcount(m: number): number {
  let n = 0;
  for (let x = m >>> 0; x; x &= x - 1) n++;
  return n;
}

/** What is on the garage's shelves today that the save does not own: sleds, the four shelves, paints, and the
 *  chapters' sets from their months on (almanac.ts shelfExtras, on a build that has it). */
function shelfToday(M: Mods, d: Any, day: string): { id: string; price: number; buy: () => void }[] {
  const out: { id: string; price: number; buy: () => void }[] = [];
  for (const s of M.sleds.SLEDS) if (s.price > 0 && !d.ownedSleds.includes(s.id)) out.push({ id: `sled:${s.id}`, price: s.price, buy: () => (d.ownedSleds = [...d.ownedSleds, s.id]) });
  const lists: Record<string, string> = { scarf: 'scarves', hat: 'hats', trail: 'trails', sound: 'sounds' };
  for (const [shelf, items] of Object.entries(M.garage.SHELVES as Record<string, Any[]>)) {
    const list = lists[shelf];
    for (const it of items) if (it.price > 0 && !(d[list] ?? []).includes(it.id)) out.push({ id: `${shelf}:${it.id}`, price: it.price, buy: () => (d[list] = [...(d[list] ?? []), it.id]) });
  }
  for (const it of M.paints.PAINTS) if (it.price > 0 && !(d.paints ?? []).includes(it.id)) out.push({ id: `paint:${it.id}`, price: it.price, buy: () => (d.paints = [...(d.paints ?? []), it.id]) });
  for (const e of M.almanac?.shelfExtras?.(day) ?? []) {
    const list = e.shelf === 'scarf' ? 'scarves' : e.shelf === 'trail' ? 'trails' : 'paints';
    if (!(d[list] ?? []).includes(e.id)) out.push({ id: `${e.shelf}:${e.id}`, price: e.price, buy: () => (d[list] = [...(d[list] ?? []), e.id]) });
  }
  // The Lantern Row (lanterns.ts), on a build that has it: each open town's next lantern.
  const open = (id: string): boolean => M.twelve.mountainOpen(d, M.mountains.MOUNTAINS.find((m: Any) => m.id === id));
  for (const l of M.lanterns?.lanternShelf(d, open) ?? []) out.push({ id: `lantern:${l.id}`, price: l.price, buy: () => (d.lit = [...(d.lit ?? []), l.id]) });
  return out.sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : 1));
}

/** The player spends its gifts as it can: the cheapest piece it does not own, again while the wallet holds. */
function spendGifts(M: Mods, d: Any, day: string, shop: { bought: string[] }): string[] {
  const got: string[] = [];
  for (;;) {
    const next = shelfToday(M, d, day)[0];
    if (!next || next.price > d.gifts) break;
    d.gifts -= next.price;
    next.buy();
    shop.bought.push(next.id);
    got.push(next.id);
  }
  return got;
}

function wantedLeft(M: Mods, d: Any, day: string): { pieces: number; gifts: number } {
  const left = shelfToday(M, d, day);
  return { pieces: left.length, gifts: left.reduce((a, x) => a + x.price, 0) };
}

// ---------------------------------------------------------------- the bars, one function each

/** What keeps a run from being dead (the main lane's ruling, round 8): a rank page turned (the Almanac's or a
 *  chapter's), an unlock, a sticker, a duel won, a medal, a streak day, a mission or a contract done. A ladder rung,
 *  a mastery star that is not a medal, XP that turns no page, a pass and a best do not count. */
export const DEAD_RUN_COUNTS: ReadonlySet<string> = new Set(['page', 'chapter', 'unlock', 'sticker', 'duel', 'medal', 'streak', 'mission', 'contract']);

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
    if (!r.gains.some((gn) => DEAD_RUN_COUNTS.has(gn.kind))) {
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
    const spNames = (g: Goal): boolean => !!sp && sp.kind === g.kind && g.names.some((nm) => sp.names.includes(nm));
    if (sp ? near.some(spNames) : near.some((g) => says(r.results.primary, g))) primaryNames++;
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
export function barExpression(M: Mods, runs: readonly RunFacts[]): { vocabulary: string[]; seen: string[]; bestCombo: string[]; bestComboFamilies: number; perRide: number[]; medianRide: number } {
  const named = runs.some((f) => f.tricks.some((t) => t.family === t.name));
  const vocabulary: string[] = M.tricks?.TRICKS ? M.tricks.TRICKS.filter((t: Any) => t.id > 0).map((t: Any) => t.name) : named ? [...new Set(runs.flatMap((f) => f.tricks.map((t) => t.name)))] : ['spin', 'flip', 'spin+flip'];
  const seen = [...new Set(runs.flatMap((f) => f.tricks.map((t) => t.name)))].sort();
  let bestCombo: string[] = [];
  let bestFam = 0;
  // Each ride's best combo (distinct tricks in it), for the median over the rides.
  const perRide: number[] = [];
  for (const f of runs) {
    const by = new Map<number, typeof f.tricks>();
    for (const t of f.tricks) by.set(t.combo, [...(by.get(t.combo) ?? []), t]);
    let rideBest = 0;
    for (const ts of by.values()) {
      const fam = new Set(ts.map((t) => t.family)).size;
      rideBest = Math.max(rideBest, fam);
      if (fam > bestFam || (fam === bestFam && ts.length > bestCombo.length)) {
        bestFam = fam;
        bestCombo = ts.map((t) => t.name);
      }
    }
    perRide.push(rideBest);
  }
  const sorted = [...perRide].sort((a, b) => a - b);
  return { vocabulary, seen, bestCombo, bestComboFamilies: bestFam, perRide, medianRide: sorted.length ? sorted[(sorted.length - 1) >> 1] : 0 };
}

/** First minute: a first-time player's run 1 on Pinecrest with the field the game lays on a first run. */
export function firstRun(M: Mods, pilot: string, seed: number, mi = 0): RunFacts {
  const d: Any = M.save.defaultSave('Rider');
  const mountain = M.mountains.MOUNTAINS[mi];
  const chaos = M.chaos.rollChaos(seed, 0, 0);
  // (A mountain past Pinecrest is ridden as if it were open, with no duel: the expression bar's rides.)
  const duel = mi === 0 ? M.twelve.duelOn(undefined, 0, (i: number) => M.twelve.mountainOpen(d, M.mountains.MOUNTAINS[i]), 0) : null;
  const entries = fieldFor(M, d, { key: mountain.id, pool: M.pools[mountain.id], chaos, kind: 'pool', duel, promised: null });
  const extra = M.almanac ? { charmPool: M.almanac.almanacPool(d), charmGates: M.almanac.almanacGates(d), firstRun: true } : undefined;
  return ride(M, { pilot, pilotSeed: seed, key: mountain.id, mountain, mi, chaos, sled: 0, entries, maxSeconds: 600, extra, coach: true }).facts;
}

/** The race's floor (round 8, phase 3): each pilot's place on run 1 of every mountain, a fresh save's field, as the
 *  results count it (by time, then distance, against every rider as it rode this race). */
export function firstRunPlaces(M: Mods, pilots: readonly string[], seeds: readonly number[]): Record<string, { mountain: string; seed: number; place: number; of: number; time: number | null }[]> {
  const out: Record<string, { mountain: string; seed: number; place: number; of: number; time: number | null }[]> = {};
  for (const pilot of pilots) {
    out[pilot] = [];
    for (let mi = 0; mi < M.mountains.MOUNTAINS.length; mi++) for (const seed of seeds) {
      const f = firstRun(M, pilot, seed, mi);
      const you = { time: f.time, distance: f.distance };
      const ahead = f.field.filter((q) => q.kind !== 'you' && M.standing.aheadOf({ time: q.time, distance: q.distance }, you)).length;
      out[pilot].push({ mountain: M.mountains.MOUNTAINS[mi].id, seed, place: ahead + 1, of: f.field.filter((q) => q.kind !== 'you').length + 1, time: f.time });
    }
  }
  return out;
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
    // Milestone 3's album, on a build that has it: a signature rider's record on this mountain not yet beaten (in
    // reach within 2 s of your quickest recent run here), and its mirror (open by its page or by its home riders
    // falling in duels, and in reach for a pilot that finishes here). The album's other stickers here (variants,
    // legends, moods) are rolled, counted above or not counted.
    if (M.album && last) {
      const got = new Set(last.after.albumGot);
      const save = { rank: { xp: 0, claimed: last.after.claimed }, twelve: { beaten: last.after.beaten } };
      const finishesHere = here.slice(-REACH_RUNS).some((r) => r.facts.finished);
      for (const st of M.album.albumCatalogue().filter((x: Any) => x.mountain === mt.id && (x.group === 'rival' || x.group === 'mirror'))) {
        if (got.has(st.id)) {
          seen++;
          continue;
        }
        unseen++;
        if (!open) continue;
        if (st.group === 'mirror' ? M.almanac.mirrorOpen(save, mt.id) && finishesHere : (() => {
          const r = M.roster.ROSTER.find((x: Any) => st.id === `rv:${mt.id}:${x.key}`);
          const t = r ? M.twelve.riderTimeOn(r, mt.id) : null;
          return quick !== null && t !== null && quick - t <= 2;
        })()) reachable.push(st.name);
      }
    }
    // A mountain still locked has all of it unseen: it counts when the way to open it is one run away (the next duel
    // for Lanternfall, the passes for the others, as the harness judges the run's goals).
    if (!open && last) {
      const way = last.goals.find((g) => g.reachable && (mt.finale ? g.kind === 'duel' : g.kind === 'unlock' && g.names.includes(mt.name)));
      if (way) reachable.push(`The way in: ${way.text}`);
    }
    return { mountain: mt.id, open, seen, unseen, reachable };
  });
}
