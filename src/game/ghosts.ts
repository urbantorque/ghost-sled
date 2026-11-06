import { paceOf } from './slowriders';
import type { GhostKind } from '../ui/contract';
import type { GhostRole } from './beats';
import { AIR_RATE, PACE_AIM, PACE_EVERY, PACE_FROM, easeSpeed, ownOnMap, paceRate, playedOnMap, reading, slowMap, stringOffset } from './pacer';
import { FINISH_Z, type Standing } from './standing';
import {
  F_AIRPITCH,
  F_AIRYAW,
  F_CARVE,
  F_FLAGS,
  F_HEADING,
  F_LEAN,
  F_SPEED,
  F_X,
  F_Y,
  F_Z,
  FLAG_DRIFTING,
  FLAG_GROUNDED,
  FRAME_STRIDE,
  PoolGhostData,
  SAMPLE_EVERY,
  WorkerIn,
  WorkerOut,
} from './ghostdata';

// Ghost race management on the main thread: picks the field, asks the worker for trajectories,
// answers "where is ghost N at tick T", detects overtakes and slipstreams. Ghosts are never
// colliders; the only way they touch the sim is the logged draft bit.

export interface GhostEntry {
  id: number;
  name: string;
  kind: GhostKind;
  score: number;
  record: string;
  /** The field's role for this ghost (field.ts pickField); absent for an unplanned pick. */
  role?: GhostRole;
  /** A grudge promoted to nemesis (three wins in a row). */
  nemesis?: boolean;
  /** Your rival for the run (field.ts rivalOf). */
  rival?: boolean;
  /** It reads your pace as you ride (pacer.ts). */
  reads?: boolean;
}

/** A rider reading you: its clock from here on, in its own ticks. */
export interface Warp {
  from: number;
  at: number;
  rate: number;
}

/** What the worker read off a run, in the run's own ticks: a rider reading you moves on from these. */
interface OwnRun {
  ticks: number;
  crashTick: number;
  finishTick: number;
  stageTicks: number[];
  tricks: Int32Array;
}

export interface GhostTrack {
  entry: GhostEntry;
  ready: boolean;
  frames: Float32Array | null;
  /** The rate its run plays at: 1, or under it for a slow rider (slowriders.ts). */
  pace: number;
  /** How far ahead of its own pace a pack rider surges, in played ticks (negative: it fades first). */
  swing: number;
  /** The played tick its surges end on: its finish, or the end of its run. */
  swingEnd: number;
  /** A slow rider's race tick at each sample, flying near true speed (pacer.ts slowMap), else null. */
  map: Float32Array | null;
  /** Set once a rider reading you has been read: its clock from then on. */
  warp: Warp | null;
  /** The rate a rider reading you rides at, under the air's. */
  rate: number;
  own: OwnRun | null;
  samples: number;
  ticks: number;
  crashTick: number;
  /** The tick it crossed the finish line, -1 for a run that did not finish. */
  finishTick: number;
  /** The tick it crossed each stage line it reached. */
  stageTicks: number[];
  distance: number;
  tricks: Int32Array | null;
  /** +1 player ahead, -1 ghost ahead, 0 undecided. */
  status: number;
  passed: boolean;
  passedTimes: number;
  crashSeen: boolean;
}

export interface GhostPose {
  x: number;
  y: number;
  z: number;
  heading: number;
  airYaw: number;
  airPitch: number;
  lean: number;
  speed: number;
  carve: number;
  grounded: boolean;
  drifting: boolean;
  /** Past the end of its run: crashed (or stopped past the line) at the last sample. */
  done: boolean;
  /** Seconds since it crashed, for the fade-out. */
  sinceDone: number;
  /** Over the finish line at this tick: a run that ended well (no wreck to mark). */
  finished: boolean;
}

export type RaceEvent = { type: 'pass'; track: GhostTrack; first: boolean } | { type: 'passedBy'; track: GhostTrack } | { type: 'crashed'; track: GhostTrack };

export function emptyPose(): GhostPose {
  return { x: 0, y: 0, z: 0, heading: 0, airYaw: 0, airPitch: 0, lean: 0, speed: 0, carve: 0, grounded: true, drifting: false, done: false, sinceDone: 0, finished: false };
}

/** A track's place in the race order. */
export function trackStanding(t: Pick<GhostTrack, 'finishTick' | 'distance'>): Standing {
  return { time: t.finishTick >= 0 ? t.finishTick / 60 : null, distance: t.distance };
}

let nextReq = 1;

/** A pack rider's surge, as a share of its run: over three swings that is about 17% either side of its
 *  own speed, or 2.5 s at a two-minute pace. A field spaced by finish time only ever drifts apart, so the
 *  riders around you trade places instead. They still finish on their real time, and your best, your
 *  grudge and a friend are never touched: those are promises. */
const PACK_SWING = 0.018;
const SWINGS = 3;

type Clocked = Pick<GhostTrack, 'pace' | 'swing' | 'swingEnd'> & Partial<Pick<GhostTrack, 'map' | 'warp'>>;

/** A track's place in its own run at a tick of this race. */
export function clock(t: Clocked, tick: number): number {
  if (t.warp) return t.warp.at + (tick - t.warp.from) * t.warp.rate;
  const played = t.swing !== 0 && tick > 0 && tick < t.swingEnd ? tick + t.swing * Math.sin((Math.PI * SWINGS * tick) / t.swingEnd) : tick;
  return t.map ? ownOnMap(t.map, played, t.pace) : played * t.pace;
}

/** The tick of this race a track reaches a place in its own run: the inverse of clock. */
export function unclock(t: Clocked, at: number): number {
  if (t.warp) return Math.round(t.warp.from + (at - t.warp.at) / t.warp.rate);
  const flat = t.map ? playedOnMap(t.map, at, t.pace) : at / t.pace;
  if (t.swing === 0) return Math.round(flat);
  const reach = Math.abs(t.swing) + 2;
  let lo = flat - reach;
  let hi = flat + reach;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (clock(t, m) < at) lo = m;
    else hi = m;
  }
  return Math.round((lo + hi) / 2);
}

export class GhostManager {
  tracks: GhostTrack[] = [];
  private worker: Worker | null = null;
  private poolWaiters = new Map<number, (g: PoolGhostData[]) => void>();
  private generation = 0;
  /** Reading your pace (pacer.ts): the next reading's tick, your place and speed at the last one. */
  private paceAt = PACE_FROM;
  private paceZ = 0;
  private paceTick = 0;
  private paceV = 0;
  private readers = 0;
  onReady: (() => void) | null = null;

  constructor() {
    try {
      this.worker = new Worker(new URL('../workers/ghost.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerOut>) => this.onMessage(e.data);
      this.worker.onerror = (e) => console.warn('[ghosts] worker error', e.message);
    } catch (err) {
      console.warn('[ghosts] worker unavailable', err);
    }
  }

  private onMessage(m: WorkerOut): void {
    if (m.type === 'trajectory') {
      const gen = Math.floor(m.id / 1000);
      if (gen !== this.generation) return;
      const t = this.tracks.find((k) => k.entry.id === m.id);
      if (!t) return;
      // A ghost's run plays at its own clock, so every time the worker read off it moves with that.
      t.frames = m.frames;
      t.samples = m.samples;
      const end = m.finishTick >= 0 ? m.finishTick : m.ticks;
      t.map = slowMap(m.frames, m.samples, t.pace, end);
      t.swingEnd = Math.round(end / t.pace);
      if (t.entry.kind === 'pool' && t.entry.role) t.swing = PACK_SWING * t.swingEnd * (t.entry.id % 2 === 0 ? 1 : -1);
      const at = (tick: number): number => (tick < 0 ? tick : unclock(t, tick));
      t.ticks = at(m.ticks);
      t.crashTick = at(m.crashTick);
      t.finishTick = at(m.finishTick);
      t.stageTicks = m.stageTicks.map(at);
      t.distance = m.distance;
      t.tricks = t.pace === 1 && t.swing === 0 ? m.tricks : m.tricks.map((v, i) => (i % 4 === 0 ? at(v) : v));
      if (t.entry.reads) t.own = { ticks: m.ticks, crashTick: m.crashTick, finishTick: m.finishTick, stageTicks: m.stageTicks, tricks: m.tricks };
      t.ready = m.samples > 0;
      if (this.tracks.every((k) => k.ready)) this.onReady?.();
    } else if (m.type === 'pool') {
      this.poolWaiters.get(m.reqId)?.(m.ghosts);
      this.poolWaiters.delete(m.reqId);
    } else if (m.type === 'error') {
      if (m.id < 0) {
        this.poolWaiters.get(-m.id)?.([]);
        this.poolWaiters.delete(-m.id);
      } else {
        const t = this.tracks.find((k) => k.entry.id === m.id);
        if (t) this.tracks.splice(this.tracks.indexOf(t), 1);
        console.warn('[ghosts] replay failed', m.message);
      }
    }
  }

  /** Start a new race field. Ids are namespaced per generation so stale replies are ignored. */
  setField(entries: Omit<GhostEntry, 'id'>[]): void {
    this.generation++;
    this.tracks = entries.map((e, i) => ({
      entry: { ...e, id: this.generation * 1000 + i },
      pace: paceOf(e.record),
      swing: 0,
      swingEnd: 0,
      map: null,
      warp: null,
      rate: paceOf(e.record),
      own: null,
      ready: false,
      frames: null,
      samples: 0,
      ticks: 0,
      crashTick: -1,
      finishTick: -1,
      stageTicks: [],
      distance: 0,
      tricks: null,
      status: 0,
      passed: false,
      passedTimes: 0,
      crashSeen: false,
    }));
    this.paceAt = PACE_FROM;
    this.paceZ = 0;
    this.paceTick = 0;
    this.paceV = 0;
    this.readers = this.tracks.filter((t) => t.entry.reads).length;
    const msg: WorkerIn = { type: 'replay', jobs: this.tracks.map((t) => ({ id: t.entry.id, record: t.entry.record })) };
    if (this.worker && this.tracks.length) this.worker.postMessage(msg);
  }

  /** Reset race status for a fresh run with the same field (Run Again on the same ghosts). */
  resetRace(): void {
    for (const t of this.tracks) {
      t.status = 0;
      t.passed = false;
      t.passedTimes = 0;
      t.crashSeen = false;
    }
  }

  get allReady(): boolean {
    return this.tracks.every((t) => t.ready);
  }

  /** The race field with you in it: every ghost ready or still loading (a replay that failed or came
   *  back empty is out), plus you. standings() counts only the ready ones. */
  get fieldSize(): number {
    let n = 1;
    for (const t of this.tracks) if (t.ready || t.frames === null) n++;
    return n;
  }

  /** Runs the bot in its own short-lived worker so race replays are never queued behind it. */
  generatePool(seed: number, count: number, salt: number, budgetRuns?: number, maxTicks?: number): Promise<PoolGhostData[]> {
    return new Promise((resolve) => {
      let w: Worker;
      try {
        w = new Worker(new URL('../workers/ghost.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        return resolve([]);
      }
      const reqId = nextReq++;
      const done = (g: PoolGhostData[]) => {
        w.terminate();
        resolve(g);
      };
      w.onmessage = (e: MessageEvent<WorkerOut>) => {
        const m = e.data;
        if (m.type === 'pool' && m.reqId === reqId) done(m.ghosts);
        else if (m.type === 'error' && m.id === -reqId) done([]);
      };
      w.onerror = () => done([]);
      const msg: WorkerIn = { type: 'pool', reqId, seed, count, salt, budgetRuns, maxTicks };
      w.postMessage(msg);
    });
  }

  /** Interpolated pose of a ghost at a (fractional) sim tick. */
  pose(t: GhostTrack, tick: number, out: GhostPose): boolean {
    if (!t.ready || !t.frames || t.samples === 0) return false;
    const f = t.frames;
    const pos = clock(t, tick) / SAMPLE_EVERY - 1;
    const last = t.samples - 1;
    let i0 = Math.floor(pos);
    let a = pos - i0;
    if (i0 < 0) {
      i0 = 0;
      a = 0;
    }
    out.done = false;
    out.sinceDone = 0;
    out.finished = t.finishTick >= 0 && tick >= t.finishTick;
    if (i0 >= last) {
      i0 = last;
      a = 0;
      out.done = true;
      out.sinceDone = (tick - unclock(t, (last + 1) * SAMPLE_EVERY)) / 60;
    }
    const i1 = Math.min(last, i0 + 1);
    const o0 = i0 * FRAME_STRIDE;
    const o1 = i1 * FRAME_STRIDE;
    const l = (k: number) => f[o0 + k] + (f[o1 + k] - f[o0 + k]) * a;
    out.x = l(F_X);
    out.y = l(F_Y);
    out.z = l(F_Z);
    out.heading = l(F_HEADING);
    const flags0 = f[o0 + F_FLAGS];
    const flags1 = f[o1 + F_FLAGS];
    const sameAir = (flags0 & FLAG_GROUNDED) === (flags1 & FLAG_GROUNDED);
    out.airYaw = sameAir ? l(F_AIRYAW) : f[o1 + F_AIRYAW];
    out.airPitch = sameAir ? l(F_AIRPITCH) : f[o1 + F_AIRPITCH];
    out.lean = l(F_LEAN);
    out.speed = l(F_SPEED) * (t.warp ? t.warp.rate : t.map ? SAMPLE_EVERY / (t.map[i1 + 1] - t.map[i1]) : t.pace);
    out.carve = l(F_CARVE);
    out.grounded = (flags1 & FLAG_GROUNDED) !== 0;
    out.drifting = (flags1 & FLAG_DRIFTING) !== 0;
    return true;
  }

  /** Course progress (z) of a ghost at a tick: where it stopped once it is done. */
  zAt(t: GhostTrack, tick: number): number {
    if (!t.ready || !t.frames) return 0;
    let i = Math.round(clock(t, tick) / SAMPLE_EVERY - 1);
    if (i < 0) i = 0;
    if (i >= t.samples) i = t.samples - 1;
    return t.frames[i * FRAME_STRIDE + F_Z];
  }

  /** A first run's riders read you (pacer.ts). Cheap and rare: once a quarter of a second, and never
   *  with no rider reading. riding is false once your run is over: they ride on at the rate they had. */
  pace(tick: number, z: number, riding: boolean): void {
    if (this.readers === 0 || tick < this.paceAt) return;
    this.paceAt = tick + PACE_EVERY;
    this.paceV = easeSpeed(this.paceV, z, this.paceZ, tick - this.paceTick);
    this.paceZ = z;
    this.paceTick = tick;
    const reads = riding && reading(z, FINISH_Z);
    const aim = z + (this.paceV * PACE_AIM) / 60;
    let i = 0;
    for (const t of this.tracks) {
      if (!t.entry.reads) continue;
      const k = i++;
      if (!t.ready || !t.frames || !t.own) continue;
      const own = clock(t, tick);
      const end = t.own.finishTick >= 0 ? t.own.finishTick : t.own.ticks;
      if (own >= end) continue;
      const s = Math.max(0, Math.min(t.samples - 1, Math.round(own / SAMPLE_EVERY - 1)));
      if (reads) t.rate = paceRate(t.rate, (this.ownAt(t, aim + stringOffset(k, this.readers, aim, FINISH_Z), s) - own) / PACE_AIM);
      const flying = (t.frames[s * FRAME_STRIDE + F_FLAGS] & FLAG_GROUNDED) === 0;
      t.warp = { from: tick, at: own, rate: flying ? Math.max(t.rate, AIR_RATE) : t.rate };
      t.swing = 0;
      this.retime(t, t.own, t.warp);
    }
  }

  /** The tick of its own run a rider reaches z, looking on from sample s. */
  private ownAt(t: GhostTrack, z: number, s: number): number {
    const f = t.frames!;
    let lo = s;
    let hi = t.samples - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (f[m * FRAME_STRIDE + F_Z] < z) lo = m;
      else hi = m;
    }
    return (hi + 1) * SAMPLE_EVERY;
  }

  /** What still lies ahead of a rider reading you moves with its clock. What it has done stands. */
  private retime(t: GhostTrack, o: OwnRun, w: Warp): void {
    const ahead = (v: number): number => Math.round(w.from + (v - w.at) / w.rate);
    if (o.ticks > w.at) t.ticks = ahead(o.ticks);
    if (o.crashTick > w.at) t.crashTick = ahead(o.crashTick);
    if (o.finishTick > w.at) t.finishTick = ahead(o.finishTick);
    for (let i = 0; i < o.stageTicks.length; i++) if (o.stageTicks[i] > w.at) t.stageTicks[i] = ahead(o.stageTicks[i]);
    const tr = t.tricks;
    if (tr) for (let i = 0; i < o.tricks.length; i += 4) if (o.tricks[i] > w.at) tr[i] = ahead(o.tricks[i]);
  }

  private poseTmp = emptyPose();

  /** Is the player in a live ghost's slipstream at this tick? */
  draftProbe = (tick: number, x: number, y: number, z: number): boolean => {
    for (const t of this.tracks) {
      if (!this.pose(t, tick, this.poseTmp) || this.poseTmp.done || this.poseTmp.finished) continue;
      const p = this.poseTmp;
      const ahead = p.z - z;
      if (ahead < 1.5 || ahead > 14) continue;
      if (Math.abs(p.x - x) > 1.8 + ahead * 0.06) continue;
      if (Math.abs(p.y - y) > 3) continue;
      return true;
    }
    return false;
  };

  /** Update overtakes for the player's progress at a tick. */
  race(tick: number, playerZ: number): RaceEvent[] {
    const out: RaceEvent[] = [];
    for (const t of this.tracks) {
      if (!t.ready) continue;
      const gz = this.zAt(t, tick);
      const done = clock(t, tick) >= (t.samples + 1) * SAMPLE_EVERY - 1;
      // (A ghost that crashed, was revived and finished never wrecked for good.)
      if (done && !t.crashSeen && t.crashTick >= 0 && t.finishTick < 0) {
        t.crashSeen = true;
        out.push({ type: 'crashed', track: t });
      }
      // Over the line it has beaten you to it: it stays ahead wherever it stopped, and rolling past
      // where it stands is no pass (no gifts, no unlock credit).
      if (t.finishTick >= 0 && tick >= t.finishTick) {
        t.status = -1;
        continue;
      }
      const d = playerZ - gz;
      // Hysteresis so jostling side by side does not spam events.
      if (d > 0.8 && t.status !== 1) {
        if (t.status === -1 || (t.status === 0 && tick > 90)) {
          const first = !t.passed;
          t.passed = true;
          t.passedTimes++;
          out.push({ type: 'pass', track: t, first });
        }
        t.status = 1;
      } else if (d < -0.8 && t.status !== -1) {
        if (t.status === 1 && !done) out.push({ type: 'passedBy', track: t });
        t.status = -1;
      }
    }
    return out;
  }

  /** Nearest ghost ahead (or nearest behind when leading), and race place. */
  standings(tick: number, playerZ: number): { next: { track: GhostTrack; gap: number } | null; rank: number; of: number } {
    let best: { track: GhostTrack; gap: number } | null = null;
    let behindBest: { track: GhostTrack; gap: number } | null = null;
    let ahead = 0;
    let n = 0;
    for (const t of this.tracks) {
      if (!t.ready) continue;
      n++;
      const gap = this.zAt(t, tick) - playerZ;
      if (gap > 0) {
        ahead++;
        if (!best || gap < best.gap) best = { track: t, gap };
      } else if (!behindBest || gap > behindBest.gap) behindBest = { track: t, gap };
    }
    return { next: best ?? behindBest, rank: ahead + 1, of: n + 1 };
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
