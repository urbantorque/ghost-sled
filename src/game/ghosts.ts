import type { GhostKind } from '../ui/contract';
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
}

export interface GhostTrack {
  entry: GhostEntry;
  ready: boolean;
  frames: Float32Array | null;
  samples: number;
  ticks: number;
  crashTick: number;
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
  /** Past the end of its run: crashed (or finished) at the last sample. */
  done: boolean;
  /** Seconds since it crashed, for the fade-out. */
  sinceDone: number;
}

export type RaceEvent = { type: 'pass'; track: GhostTrack; first: boolean } | { type: 'passedBy'; track: GhostTrack } | { type: 'crashed'; track: GhostTrack };

export function emptyPose(): GhostPose {
  return { x: 0, y: 0, z: 0, heading: 0, airYaw: 0, airPitch: 0, lean: 0, speed: 0, carve: 0, grounded: true, drifting: false, done: false, sinceDone: 0 };
}

let nextReq = 1;

export class GhostManager {
  tracks: GhostTrack[] = [];
  private worker: Worker | null = null;
  private poolWaiters = new Map<number, (g: PoolGhostData[]) => void>();
  private generation = 0;
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
      t.frames = m.frames;
      t.samples = m.samples;
      t.ticks = m.ticks;
      t.crashTick = m.crashTick;
      t.distance = m.distance;
      t.tricks = m.tricks;
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
      ready: false,
      frames: null,
      samples: 0,
      ticks: 0,
      crashTick: -1,
      distance: 0,
      tricks: null,
      status: 0,
      passed: false,
      passedTimes: 0,
      crashSeen: false,
    }));
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
    const pos = tick / SAMPLE_EVERY - 1;
    const last = t.samples - 1;
    let i0 = Math.floor(pos);
    let a = pos - i0;
    if (i0 < 0) {
      i0 = 0;
      a = 0;
    }
    out.done = false;
    out.sinceDone = 0;
    if (i0 >= last) {
      i0 = last;
      a = 0;
      out.done = true;
      out.sinceDone = (tick - (last + 1) * SAMPLE_EVERY) / 60;
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
    out.speed = l(F_SPEED);
    out.carve = l(F_CARVE);
    out.grounded = (flags1 & FLAG_GROUNDED) !== 0;
    out.drifting = (flags1 & FLAG_DRIFTING) !== 0;
    return true;
  }

  /** Course progress (z) of a ghost at a tick: its crash spot once it is done. */
  zAt(t: GhostTrack, tick: number): number {
    if (!t.ready || !t.frames) return 0;
    let i = Math.round(tick / SAMPLE_EVERY - 1);
    if (i < 0) i = 0;
    if (i >= t.samples) i = t.samples - 1;
    return t.frames[i * FRAME_STRIDE + F_Z];
  }

  private poseTmp = emptyPose();

  /** Is the player in a live ghost's slipstream at this tick? */
  draftProbe = (tick: number, x: number, y: number, z: number): boolean => {
    for (const t of this.tracks) {
      if (!this.pose(t, tick, this.poseTmp) || this.poseTmp.done) continue;
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
      const done = tick >= (t.samples + 1) * SAMPLE_EVERY - 1;
      if (done && !t.crashSeen && t.crashTick >= 0) {
        t.crashSeen = true;
        out.push({ type: 'crashed', track: t });
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
