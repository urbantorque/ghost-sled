import type { Sim } from './sim';

// Rivals (round 8, G3's record part): the rules that decide a showdown, a spirit steal and a slipstream from two
// riders' places, tick by tick. The live game calls them with the ghosts' replays; the ghost generator calls them
// with earlier pool runs; both hand what they decide to the sim the same way, as a log token (input.ts LogEvent) or
// the draft bit, so a run replays exactly and a ghost can do anything a player can.
//
//   showdown  ride level with an eligible rival for two seconds and a showdown starts: a marker 300 m past the
//             further of you, and the first there takes a lantern cell and the points (LogEvent.Showdown). A fall
//             does not end it; the finish line before the marker is the marker. One at a time, ten seconds apart,
//             three a run at most and once a rival.
//   steal     pass a rival within 0.6 m (centre to centre, across the run), both riding and you clean: a wisp is
//             taken and feeds your lantern (LogEvent.Steal). Once a rival, twice a run at most.
//   draft     in a rival's slipstream: 1.5 to 14 m behind it and inside a cone around its line.
//
// Pure: no DOM, render or audio imports. Nothing here is state of a run: a watcher lives beside one.

/** A rider as the rules see it. `riding`: not in a fall, not wrecked, not over the line. `clean`: no bump, ward or
 *  rescue still shaking it. `finished`: over the line (it has reached any marker). */
export interface RiderPoint {
  x: number;
  y: number;
  z: number;
  riding: boolean;
  clean: boolean;
  finished: boolean;
}

export const SHOWDOWN_LEVEL_TICKS = 120;
export const SHOWDOWN_DZ = 3;
export const SHOWDOWN_DX = 8;
export const SHOWDOWN_RUN = 300;
export const SHOWDOWN_GAP_TICKS = 600;
export const SHOWDOWN_MAX = 3;
/** Round 8: within 0.6 m, at most STEAL_MAX a run. A metre and no cap gave the pool's ghosts five a run: riders who
 *  hold the same line pass within a metre all the time, and a steal should be a thing done on purpose. */
export const STEAL_DX = 0.6;
export const STEAL_MAX = 2;
/** What they give (sim.ts reads these): a showdown won lights a whole cell, a steal a third of one. */
export const SHOWDOWN_UNITS = 100;
export const STEAL_UNITS = 34;
export const SHOWDOWN_POINTS = 1000;
export const STEAL_POINTS = 300;

export type RivalEvent =
  | { type: 'showdown'; phase: 'start'; rival: number; markerZ: number }
  | { type: 'showdown'; phase: 'won' | 'lost'; rival: number; markerZ: number }
  | { type: 'steal'; rival: number };

/** A sim's rider as the rules see it. */
export function riderPoint(sim: Sim): RiderPoint {
  const s = sim.s;
  return { x: s.x, y: s.y, z: s.z, riding: !s.crashed && !s.finished && s.tumble === 0, clean: s.tumble === 0 && s.wobble === 0 && s.ghost === 0, finished: s.finished };
}

/** In `them`'s slipstream (the game's rule since round 2, now here so a pool ghost drafts the same way). */
export function draftsOn(me: { x: number; y: number; z: number }, them: { x: number; y: number; z: number }): boolean {
  const ahead = them.z - me.z;
  if (ahead < 1.5 || ahead > 14) return false;
  if (Math.abs(them.x - me.x) > 1.8 + ahead * 0.06) return false;
  return Math.abs(them.y - me.y) <= 3;
}

/** Watches one rider against a field, tick by tick. `duel(i)`: may rival i be met in a showdown (open choice 4:
 *  The Twelve's riders, your grudge, a friend's link, your own best); `steal(i)`: may a wisp be taken from it. */
export class RivalWatch {
  private level: number[];
  private prevDz: number[];
  private dueled: boolean[];
  private stolen: boolean[];
  private lastEnd = -100000;
  private count = 0;
  private steals = 0;
  /** The showdown under way: its rival and marker, or null. */
  active: { rival: number; markerZ: number; t0: number } | null = null;

  constructor(
    readonly size: number,
    private readonly duel: (i: number) => boolean,
    private readonly steal: (i: number) => boolean,
    private readonly finishZ: number,
  ) {
    this.level = new Array(size).fill(0);
    this.prevDz = new Array(size).fill(NaN);
    this.dueled = new Array(size).fill(false);
    this.stolen = new Array(size).fill(false);
  }

  /** Showdowns started this run. */
  get showdowns(): number {
    return this.count;
  }

  /** One tick: `me` and each rival where it is now (null for one not in the race this tick). */
  step(tick: number, me: RiderPoint, them: readonly (RiderPoint | null)[]): RivalEvent[] {
    const out: RivalEvent[] = [];
    const a = this.active;
    if (a) {
      const r = them[a.rival];
      const mine = me.finished || me.z >= a.markerZ;
      const theirs = !!r && (r.finished || r.z >= a.markerZ);
      if (mine || theirs) {
        // (Both there on one tick: the one further past it.)
        const won = mine && (!theirs || (r !== null && me.z > r.z));
        out.push({ type: 'showdown', phase: won ? 'won' : 'lost', rival: a.rival, markerZ: a.markerZ });
        this.active = null;
        this.lastEnd = tick;
      }
    }
    for (let i = 0; i < this.size; i++) {
      const r = them[i];
      if (!r) {
        this.level[i] = 0;
        this.prevDz[i] = NaN;
        continue;
      }
      const dz = me.z - r.z;
      const dx = Math.abs(me.x - r.x);
      const both = me.riding && r.riding;
      // A steal: you pass it, close across the run, both riding and you clean.
      const was = this.prevDz[i];
      if (!this.stolen[i] && this.steals < STEAL_MAX && was < 0 && dz >= 0 && dx <= STEAL_DX && both && me.clean && this.steal(i)) {
        this.stolen[i] = true;
        this.steals++;
        out.push({ type: 'steal', rival: i });
      }
      this.prevDz[i] = dz;
      // Level: the run of ticks side by side.
      if (both && !this.dueled[i] && Math.abs(dz) <= SHOWDOWN_DZ && dx <= SHOWDOWN_DX && this.duel(i)) this.level[i]++;
      else this.level[i] = 0;
      if (!this.active && this.level[i] >= SHOWDOWN_LEVEL_TICKS && this.count < SHOWDOWN_MAX && tick - this.lastEnd >= SHOWDOWN_GAP_TICKS) {
        const markerZ = Math.min(this.finishZ, Math.max(me.z, r.z) + SHOWDOWN_RUN);
        this.active = { rival: i, markerZ, t0: tick };
        this.dueled[i] = true;
        this.count++;
        this.level[i] = 0;
        out.push({ type: 'showdown', phase: 'start', rival: i, markerZ });
      }
    }
    return out;
  }
}
