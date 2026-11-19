import { decodeLog, type DecodedLog } from '../sim/input';
import { type RunRecord, applyLogEvent, simConfigOf } from '../sim/replay';
import { Sim, type SimEvent } from '../sim/sim';
import type { GhostKind } from '../ui/contract';
import { copySnap, emptySnap, lerpSnap } from './run';

// Your run, directed (round 7): a highlight reel cut from a run's own deterministic record. Nothing is
// filmed. The record (the seed, the roll, the sled and the input log) is simulated again, a scoring pass
// over what happened picks the windows worth watching, and the player rides the same sim through each of
// them while cinematic cameras look on (render/reelcam.ts). Because it is the record that plays, a reel
// can be sent as the challenge link the game already has, and it replays exactly.
//
// Pure: no DOM, render or audio. The app loads this file lazily, with the reel's cameras and its cards,
// the first time a player asks to watch a run.

const TICK = 60;
/** Passes count for the reel from here: the bunch off the start line trades places for nothing. */
const PASS_FROM = 6 * TICK;

/** A rider who shared the run (a ghost of its field), as the reel needs it: who, and where at a tick of
 *  the race as it was ridden. `at` returns false while it has no place (not ready, never on the course). */
export interface ReelRider {
  name: string;
  kind: GhostKind;
  at(tick: number, out: RiderAt): boolean;
}
export interface RiderAt {
  x: number;
  z: number;
  done: boolean;
}

export type ShotKind = 'leap' | 'pass' | 'piece' | 'legend' | 'speed' | 'finish' | 'wreck';
/** The reel's four lenses: a tracking side shot, a low front three-quarter, a high wide, and an orbit at
 *  the apex with a slow frame. */
export type ShotCam = 'side' | 'low' | 'wide' | 'orbit';

/** One window of the run, in the record's own ticks. `peak` is its moment (the apex, the pass, the win,
 *  the line), which the title card and a slow frame sit on. */
export interface ReelShot {
  kind: ShotKind;
  cam: ShotCam;
  t0: number;
  t1: number;
  peak: number;
  /** What the card says is built from these (ui/reelcopy.ts), in the UI's language. */
  seconds?: number;
  height?: number;
  name?: string;
  place?: string;
  /** A set piece: its index down the course, and the count it was won with. */
  index?: number;
  n?: number;
  of?: number;
  speed?: number;
  metres?: number;
  /** A leap that is not the best one (a short reel takes the next best too). */
  second?: boolean;
  rank?: number;
  /** The side of the rider the lens stands on (+1 the rider's +x side): away from a passed ghost, toward
   *  a legend. */
  side: 1 | -1;
}

interface Leap { t0: number; t1: number; apex: number; seconds: number; height: number }
interface Pass { tick: number; name: string; dx: number; side: 1 | -1; z: number }
interface Piece { index: number; t0: number; won: number; n: number; of: number }

/** What a record holds, read off one re-simulation of it. */
export interface ReelScan {
  /** The run's state hash at its end: the original run's, or the record did not replay. */
  hash: number;
  /** Ticks in the log, the finish line's tick (-1 for none) and the wreck's (-1 for none). */
  ticks: number;
  finishTick: number;
  crashTick: number;
  distance: number;
  score: number;
  leaps: Leap[];
  passes: Pass[];
  pieces: Piece[];
  legend: { t0: number; t1: number; side: 1 | -1 } | null;
  /** The fastest moment on the snow. */
  fastest: { tick: number; speed: number };
  /** Names for the cards: each set piece down the course, the legend, each stage. */
  pieceNames: string[];
  pieceZ: Array<[number, number]>;
  legendName: string;
  stages: Array<{ name: string; z0: number; z1: number }>;
}

/**
 * The scoring pass: one re-simulation of the record, noting every flight (its seconds and its height
 * over the snow), every rider passed (and how close), every set piece won, the legend if the run had
 * one, the fastest moment, the finish and the wreck. `riders` are the run's own ghosts; with none (a
 * friend's link) there are no passes to find. It runs a slice at a time (step), so a phone never holds a
 * frame for the whole run.
 */
export class ReelScanner {
  private readonly log: DecodedLog;
  private readonly sim: Sim;
  private t = 0;
  private readonly leaps: Leap[] = [];
  private readonly passes: Pass[] = [];
  private readonly pieces: Piece[] = [];
  private legend: ReelScan['legend'] = null;
  private readonly fastest = { tick: 0, speed: 0 };
  private crashTick = -1;
  private off = -1;
  private high = 0;
  private apex = 0;
  private readonly started: number[] = [];
  // Who leads, as the race itself calls it (ghosts.ts race): 0.8 m of hysteresis, nothing in the first
  // second and a half.
  private readonly status: number[];
  private readonly at: RiderAt = { x: 0, z: 0, done: false };

  constructor(
    rec: RunRecord,
    private readonly riders: readonly ReelRider[] = [],
  ) {
    this.log = decodeLog(rec.inputs);
    this.sim = new Sim(simConfigOf(rec));
    this.status = riders.map(() => 0);
  }

  /** How far through the record the scan is, 0 to 1. */
  get progress(): number {
    return this.log.inputs.length ? this.t / this.log.inputs.length : 1;
  }

  /** Scans up to `budget` more ticks. True once the whole record is read. */
  step(budget = Infinity): boolean {
    const log = this.log;
    const s = this.sim;
    const riders = this.riders;
    const at = this.at;
    for (let n = 0; this.t < log.inputs.length && n < budget; n++, this.t++) {
      const t = this.t;
      const ev = log.events.get(t);
      if (ev) for (const e of ev) applyLogEvent(s, e);
      s.step(log.inputs[t]);
      const p = s.s;
      for (const e of s.events) {
        if (e.type === 'takeoff') {
          this.off = t;
          this.high = 0;
          this.apex = t;
        } else if (e.type === 'land') {
          if (this.off >= 0 && e.airtime >= 0.6) this.leaps.push({ t0: this.off, t1: t, apex: this.apex, seconds: e.airtime, height: this.high });
          this.off = -1;
        } else if (e.type === 'crash') {
          this.crashTick = t;
          this.off = -1;
        } else if (e.type === 'revive') this.crashTick = -1;
        else if (e.type === 'tumble' && e.phase === 'start') this.off = -1;
        else if (e.type === 'moment') {
          if (e.phase === 'start') this.started[e.index] = t;
          else if (e.phase === 'won') this.pieces.push({ index: e.index, t0: this.started[e.index] ?? Math.max(0, t - 4 * TICK), won: t, n: e.n, of: e.of });
        } else if (e.type === 'legend') {
          const lg = s.legend;
          if (e.phase === 'start') this.legend = { t0: t, t1: t + 5 * TICK, side: lg ? lg.side : 1 };
          else if (e.phase === 'end' && this.legend) this.legend.t1 = t;
        }
      }
      if (this.off >= 0 && !p.grounded) {
        const h = p.y - s.course.ground(p.x, p.z);
        if (h > this.high) {
          this.high = h;
          this.apex = t;
        }
      }
      if (p.grounded && !p.crashed && p.speed > this.fastest.speed) {
        this.fastest.speed = p.speed;
        this.fastest.tick = t;
      }
      for (let i = 0; i < riders.length; i++) {
        if (!riders[i].at(t, at) || at.done) continue;
        const d = p.z - at.z;
        if (d > 0.8 && this.status[i] !== 1) {
          // (The start line's jostle is no pass worth a shot: the reel looks from six seconds in.)
          if ((this.status[i] === -1 || (this.status[i] === 0 && t > 90)) && t > PASS_FROM) this.passes.push({ tick: t, name: riders[i].name, dx: Math.abs(at.x - p.x), side: at.x >= p.x ? 1 : -1, z: p.z });
          this.status[i] = 1;
        } else if (d < -0.8 && this.status[i] !== -1) this.status[i] = -1;
      }
    }
    return this.t >= log.inputs.length;
  }

  /** What the record held (call once step() has returned true). */
  result(): ReelScan {
    const sim = this.sim;
    const plays = sim.plays;
    return {
      hash: sim.hash(),
      ticks: this.log.inputs.length,
      finishTick: sim.finished ? sim.s.finishTick : -1,
      crashTick: sim.s.crashed ? this.crashTick : -1,
      distance: sim.distance,
      score: sim.score,
      leaps: this.leaps,
      passes: this.passes,
      pieces: this.pieces,
      legend: this.legend,
      fastest: this.fastest,
      pieceNames: plays.map((p) => p.name),
      pieceZ: plays.map((p) => [p.z0, p.z1] as [number, number]),
      legendName: sim.legend ? sim.legend.name : '',
      stages: sim.course.stages.map((s) => ({ name: s.name, z0: s.z0, z1: s.z1 })),
    };
  }
}

/** The whole scan at once (tests, and anything off the frame). */
export function scanRecord(rec: RunRecord, riders: readonly ReelRider[] = []): ReelScan {
  const s = new ReelScanner(rec, riders);
  s.step();
  return s.result();
}

/** The reel's length: twenty to thirty seconds of the run. */
export const REEL_MIN_TICKS = 20 * TICK;
export const REEL_MAX_TICKS = 30 * TICK;
/** A shot never runs shorter than this, and two never touch: a cut needs air. */
const SHOT_MIN = Math.round(2.6 * TICK);
const GAP = 20;

/** Where a metre of the course is, as a card names it: the set piece it lies in or just before, else its
 *  stage. */
export function placeAt(scan: Pick<ReelScan, 'pieceNames' | 'pieceZ' | 'stages'>, z: number): string {
  for (let i = 0; i < scan.pieceZ.length; i++) if (z >= scan.pieceZ[i][0] - 60 && z <= scan.pieceZ[i][1] + 30) return scan.pieceNames[i];
  for (const s of scan.stages) if (z >= s.z0 && z < s.z1) return s.name;
  return '';
}

/**
 * The cut. In this order of claim: the finish (or the wreck that ended the run), the legend, every set
 * piece won, the best leap, the closest pass, and the fastest stretch if the reel is still short. A
 * later claim never overlaps an earlier one: it takes its next best candidate, or goes without. The
 * shots then play in the run's own order. Deterministic: the same scan gives the same reel.
 */
export function planReel(scan: ReelScan): ReelShot[] {
  const shots: ReelShot[] = [];
  const end = scan.ticks - 1;
  const free = (t0: number, t1: number) => shots.every((s) => t1 + GAP <= s.t0 || t0 >= s.t1 + GAP);
  const clamp = (t: number) => Math.max(0, Math.min(end, Math.round(t)));
  const add = (s: ReelShot): boolean => {
    s.t0 = clamp(s.t0);
    s.t1 = clamp(s.t1);
    s.peak = Math.max(s.t0, Math.min(s.t1, s.peak));
    if (s.t1 - s.t0 < SHOT_MIN || !free(s.t0, s.t1)) return false;
    shots.push(s);
    return true;
  };

  // The last shot: the line, or where it ended.
  if (scan.finishTick >= 0) add({ kind: 'finish', cam: 'low', t0: scan.finishTick - 3.4 * TICK, t1: scan.finishTick + 2.6 * TICK, peak: scan.finishTick, seconds: scan.finishTick / TICK, side: 1 });
  else if (scan.crashTick >= 0) add({ kind: 'wreck', cam: 'side', t0: scan.crashTick - 3.6 * TICK, t1: scan.crashTick + 1.4 * TICK, peak: scan.crashTick, metres: scan.distance, side: 1 });
  else add({ kind: 'wreck', cam: 'side', t0: end - 5 * TICK, t1: end, peak: end, metres: scan.distance, side: 1 });

  if (scan.legend) add({ kind: 'legend', cam: 'wide', t0: scan.legend.t0 - 1.2 * TICK, t1: Math.min(scan.legend.t1, scan.legend.t0 + 4 * TICK), peak: scan.legend.t0 + TICK, name: scan.legendName, side: scan.legend.side });

  // Each set piece won: the run into its deciding moment, and a breath after it.
  for (const p of scan.pieces) add({ kind: 'piece', cam: 'low', t0: Math.max(p.t0 - 0.5 * TICK, p.won - 3.6 * TICK), t1: p.won + 1.2 * TICK, peak: p.won, name: scan.pieceNames[p.index] ?? '', index: p.index, n: p.n, of: p.of, side: p.index % 2 ? -1 : 1 });

  // The best leap: the longest flight, a high one counting for more (a second for every 8 m).
  const leaps = scan.leaps.slice().sort((a, b) => b.seconds + b.height / 8 - (a.seconds + a.height / 8) || a.t0 - b.t0);
  for (const l of leaps) if (add({ kind: 'leap', cam: 'orbit', t0: l.t0 - 1.3 * TICK, t1: l.t1 + 0.9 * TICK, peak: l.apex, seconds: l.seconds, height: l.height, side: l.t0 % 2 ? -1 : 1 })) break;

  // The closest pass: the smallest gap side to side as you went by.
  const passes = scan.passes.slice().sort((a, b) => a.dx - b.dx || a.tick - b.tick);
  for (const p of passes) if (add({ kind: 'pass', cam: 'side', t0: p.tick - 2.3 * TICK, t1: p.tick + 1.7 * TICK, peak: p.tick, name: p.name, place: placeAt(scan, p.z), side: p.side === 1 ? -1 : 1 })) break;

  const total = () => shots.reduce((n, s) => n + s.t1 - s.t0, 0);
  // Still short: the fastest stretch, then the next best leaps, until there are twenty seconds.
  if (total() < REEL_MIN_TICKS && scan.fastest.speed > 0) add({ kind: 'speed', cam: 'side', t0: scan.fastest.tick - 2.2 * TICK, t1: scan.fastest.tick + 1.8 * TICK, peak: scan.fastest.tick, speed: scan.fastest.speed, side: -1 });
  for (const l of leaps) {
    if (total() >= REEL_MIN_TICKS) break;
    add({ kind: 'leap', cam: 'wide', t0: l.t0 - 1.3 * TICK, t1: l.t1 + 0.9 * TICK, peak: l.apex, seconds: l.seconds, height: l.height, second: true, side: l.t0 % 2 ? -1 : 1 });
  }
  shots.sort((a, b) => a.t0 - b.t0);
  // Still short (a run with little in it): each shot opens earlier, into the room before it.
  for (let i = 0; i < shots.length && total() < REEL_MIN_TICKS; i++) {
    const floor = i > 0 ? shots[i - 1].t1 + GAP : 0;
    const want = Math.min(shots[i].t0 - floor, 3 * TICK, REEL_MIN_TICKS - total());
    if (want > 0) shots[i].t0 -= Math.round(want);
  }
  // Too long (three set pieces, a legend and the rest): the longest shots open later, never under 3.2 s.
  for (let guard = 0; guard < 400 && total() > REEL_MAX_TICKS; guard++) {
    let k = -1;
    for (let i = 0; i < shots.length; i++) if (shots[i].t1 - shots[i].t0 > 3.2 * TICK && (k < 0 || shots[i].t1 - shots[i].t0 > shots[k].t1 - shots[k].t0)) k = i;
    if (k < 0) break;
    const cut = Math.min(12, total() - REEL_MAX_TICKS, shots[k].peak - shots[k].t0 - 60);
    if (cut <= 0) {
      // (Its moment is right at its start: it closes sooner instead.)
      shots[k].t1 -= Math.min(12, total() - REEL_MAX_TICKS);
      continue;
    }
    shots[k].t0 += cut;
  }
  // The lenses: never the same one twice running.
  const turn: ShotCam[] = ['side', 'low', 'wide'];
  for (let i = 1; i < shots.length; i++) {
    if (shots[i].cam !== shots[i - 1].cam || shots[i].kind === 'leap') continue;
    shots[i].cam = turn[(turn.indexOf(shots[i].cam) + 1) % turn.length];
  }
  return shots;
}

/**
 * Lays the cuts on the music's bar lines: each shot's length becomes a whole number of bars, where the
 * room before it allows (a shot opens earlier, or later, never past its moment). `barTicks` is a bar in
 * ticks at the score's tempo. Without a tempo the cut stands as planned.
 */
export function cutOnBars(shots: ReelShot[], barTicks: number): ReelShot[] {
  if (!(barTicks >= 30)) return shots;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const len = s.t1 - s.t0;
    const bars = Math.max(1, Math.round(len / barTicks));
    let t0 = s.t1 - bars * barTicks;
    const floor = i > 0 ? shots[i - 1].t1 + GAP : 0;
    if (t0 < floor || s.peak - t0 < 45) t0 = s.t1 - Math.max(1, bars - 1) * barTicks;
    if (t0 < floor || s.t1 - t0 < SHOT_MIN || s.peak - t0 < 30) continue;
    s.t0 = Math.round(t0);
  }
  return shots;
}

/**
 * The record, ridden again for the lens: a sim stepped through the log, with the two snapshots a frame is
 * drawn between and the tick's events. seek() runs ahead to a window without drawing (a slice at a time,
 * so a cut on a slow phone never holds a frame for long); advance() plays it. Going back starts the sim
 * again from the top: a record only runs forward.
 */
export class ReelPlayer {
  sim: Sim;
  readonly prev = emptySnap();
  readonly cur = emptySnap();
  readonly view = emptySnap();
  /** This frame's sim events (the picture's and the sound's), and the ticks in the air. */
  readonly events: SimEvent[] = [];
  airTicks = 0;
  private readonly log: DecodedLog;
  private at = 0;
  private acc = 0;

  constructor(private readonly rec: RunRecord) {
    this.log = decodeLog(rec.inputs);
    this.sim = this.fresh();
  }

  private fresh(): Sim {
    this.at = 0;
    this.acc = 0;
    this.airTicks = 0;
    const sim = new Sim(simConfigOf(this.rec));
    copySnap(sim.s, this.prev);
    copySnap(sim.s, this.cur);
    copySnap(sim.s, this.view);
    return sim;
  }

  /** Ticks in the record. */
  get ticks(): number {
    return this.log.inputs.length;
  }

  /** The next tick to be stepped (the sim has run this many). */
  get tick(): number {
    return this.at;
  }

  /** The tick being drawn, between two steps. */
  get drawn(): number {
    return this.at - 1 + this.acc;
  }

  private step(keep: boolean): void {
    const ev = this.log.events.get(this.at);
    if (ev) for (const e of ev) applyLogEvent(this.sim, e);
    copySnap(this.sim.s, this.prev);
    this.sim.step(this.log.inputs[this.at]);
    copySnap(this.sim.s, this.cur);
    this.at++;
    if (!this.sim.s.grounded) this.airTicks++;
    else this.airTicks = 0;
    if (keep) for (const e of this.sim.events) this.events.push(e);
  }

  /** Runs on toward `tick` without drawing, at most `budget` ticks this call. True once there. */
  seek(tick: number, budget = Infinity): boolean {
    const to = Math.max(0, Math.min(this.ticks, Math.round(tick)));
    if (to < this.at) this.sim = this.fresh();
    let n = 0;
    while (this.at < to && n < budget) {
      this.step(false);
      n++;
    }
    if (this.at >= to) {
      this.acc = 0;
      copySnap(this.sim.s, this.prev);
      copySnap(this.sim.s, this.view);
      return true;
    }
    return false;
  }

  /** Plays `seconds` of the run on (already scaled by a slow frame). Returns false at the log's end. */
  advance(seconds: number): boolean {
    this.events.length = 0;
    this.acc += seconds * TICK;
    let more = true;
    while (this.acc >= 1) {
      if (this.at >= this.ticks) {
        this.acc = 1;
        more = false;
        break;
      }
      this.acc -= 1;
      this.step(true);
    }
    lerpSnap(this.prev, this.cur, Math.max(0, Math.min(1, this.acc)), this.view);
    return more;
  }
}
