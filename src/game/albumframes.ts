import type { SimEvent } from '../sim/sim';

// Round 8, the photo lane (G8): a sticker is a frame from the run it happened in. The frame is kept from the live
// picture as the moment happens, the HUD out of it (World.onPicture runs before the riders' tags and the mirror are
// drawn): a set piece a beat after it starts and again on its last step, a legend as it comes into reach, a trick at
// its grab (or the flight's top, for a spin or a flip), a charm as the rider rides through its arch, and the finish
// once the lens has swung round to the rider. Only stickers the album does not hold yet are shot, so after the first
// runs a run keeps a frame or two. What the run earns is known only when it is settled; the frames wait for that, and
// a sticker earned at the line (a mood finished, a rider's record beaten, a mirror, a duel, a Long Night leg) takes one
// of the finish's frames (a few, as the lens creeps round the rider, dealt out in turn so a run that beats eight records
// does not fill a row with one picture).
//
// This file decides what to keep and when, and pairs frames with the stickers settled. Pure: the frame itself is a
// thumbnail the app grabs (the generic T), and where it is kept is framestore.ts's.

/** Seconds after a set piece starts that its frame is taken (the rider in the place, not at its threshold). */
export const PIECE_DELAY_S = 0.6;
/** Seconds after a legend's start: it is in reach and the lens has turned toward it. */
export const LEGEND_DELAY_S = 0.8;
/** Seconds after the line: the finish lens has swung round to the rider (camera.ts FINISH_SWING_S is 2.5 on the
 *  render clock, which runs slow over the line). */
export const FINISH_DELAY_S = 2.4;
/** The finish's frames: this many, this far apart (s). */
export const FINISH_FRAMES = 4;
export const FINISH_STEP_S = 0.8;
/** A flight is shot at its top only when it lasts at least this long in the air (s). */
export const APEX_MIN_AIR_S = 0.45;
/** The most frames one run keeps waiting for its settlement. */
export const MAX_PENDING = 24;

/** What the shots need to know of the run. */
export interface ShotCtx {
  /** The named mountain's id ('' for a Daily or a Cup: their place stickers are not the album's). */
  mountain: string;
  /** The album holds this sticker already (it is not shot again). */
  held(id: string): boolean;
  /** A set piece's key and the variant this run plays, by its index down the course. */
  play(index: number): { key: string; variant: number } | null;
  /** A trick's key by the sim's id (tricks.ts TRICKS), a charm's by its id (charms.ts CHARMS), a synergy's. */
  trick(id: number): string | null;
  charm(id: number): string | null;
  synergy(id: number): string | null;
}

/** A frame to take: the stickers it is for (or the flight's or the finish's slot), and how long to wait. */
export interface Aim {
  ids: string[];
  slot?: 'flight' | 'finish';
  delay: number;
  /** A frame already kept for these stickers is kept (a set piece's start is replaced by its last step). */
  keep?: boolean;
  /** The flight's frame from a grab (the pose at its fullest), which replaces one from the flight's top. */
  grab?: boolean;
}

/** The stickers that take the finish's frame: those earned at the line. */
export function atTheLine(id: string): boolean {
  return /^(m|rv|x|w|n):/.test(id);
}

/** What one sim event asks to be shot, or null. */
export function aimFor(e: SimEvent, c: ShotCtx): Aim | null {
  switch (e.type) {
    case 'moment': {
      if (!c.mountain || (e.phase !== 'start' && e.phase !== 'step' && e.phase !== 'won')) return null;
      const p = c.play(e.index);
      if (!p) return null;
      const id = `v:${c.mountain}:${p.key}:${p.variant}`;
      if (c.held(id)) return null;
      if (e.phase === 'start') return { ids: [id], delay: PIECE_DELAY_S };
      // The last step is the set piece at its height; a win with no frame yet takes the frame it is won on.
      if (e.phase === 'step') return e.of > 0 && e.n === e.of ? { ids: [id], delay: 0 } : null;
      return { ids: [id], delay: 0, keep: true };
    }
    case 'legend': {
      if (!c.mountain || e.phase !== 'start') return null;
      const id = `l:${c.mountain}:${e.slot}`;
      return c.held(id) ? null : { ids: [id], delay: LEGEND_DELAY_S };
    }
    case 'charm': {
      const k = e.id >= 0 ? c.charm(e.id) : null;
      if (!k) return null;
      const id = `c:${k}`;
      return c.held(id) ? null : { ids: [id], delay: 0 };
    }
    case 'synergy': {
      const k = c.synergy(e.id);
      if (!k) return null;
      const id = `s:${k}`;
      return c.held(id) ? null : { ids: [id], delay: 0 };
    }
    case 'grab': {
      if (e.phase !== 'tier' && e.phase !== 'move' && e.phase !== 'tweak') return null;
      const k = e.trick > 0 ? c.trick(e.trick) : null;
      if (!k || c.held(`t:${k}`)) return null;
      return { ids: [], slot: 'flight', delay: 0, grab: true };
    }
    case 'finish':
      return { ids: [], slot: 'finish', delay: FINISH_DELAY_S };
    default:
      return null;
  }
}

/** A frame kept this run, and the stickers it stands for. */
interface Kept<T> {
  frame: T;
  ids: Set<string>;
}

/**
 * One run's sticker frames. The app feeds it the sim's events and the frame's clock, grabs a frame when it says so
 * (`due`), and tells it what the run earned once it is settled (`settle`); `ready` hands over each sticker's frame as
 * soon as both are known, once.
 */
export class StickerShots<T> {
  private readonly waits: Array<{ aim: Aim; left: number }> = [];
  private readonly kept: Array<Kept<T>> = [];
  private flight: T | null = null;
  private readonly finishes: T[] = [];
  private airS = 0;
  private lastVy = 0;
  private settled = new Set<string>();
  private readonly handed = new Set<string>();
  /** A frame is wanted on this frame (the app grabs it after the picture is drawn, then calls `took`). */
  private want: Aim[] = [];

  constructor(private readonly ctx: ShotCtx) {}

  /** The run's events of this frame. */
  events(list: readonly SimEvent[]): void {
    let landed = false;
    for (const e of list) {
      const a = aimFor(e, this.ctx);
      if (a) this.waits.push({ aim: a, left: a.delay });
      if (a && a.slot === 'finish') for (let k = 1; k < FINISH_FRAMES; k++) this.waits.push({ aim: a, left: a.delay + k * FINISH_STEP_S });
      // A trick landed: the flight's frame is its sticker's (the touchdown and its tricks come on one tick, in
      // either order, so the flight is let go after the tick's events).
      if (e.type === 'style' && typeof e.trick === 'number' && e.trick > 0) {
        const k = this.ctx.trick(e.trick);
        if (k && this.flight !== null && !this.ctx.held(`t:${k}`)) this.keep(this.flight, [`t:${k}`], true);
      }
      if (e.type === 'land') landed = true;
    }
    if (landed) {
      this.flight = null;
      this.airS = 0;
    }
  }

  /** Once a frame, with the seconds the picture moved (0 while it is held) and the rider in the air or not: the
   *  waits count down, and a flight's top is found. True when a frame is due on this frame. */
  step(dt: number, air: { airborne: boolean; vy: number; trickMissing: boolean } | null): boolean {
    for (let i = this.waits.length - 1; i >= 0; i--) {
      const w = this.waits[i];
      w.left -= dt;
      if (w.left <= 1e-6) {
        this.want.push(w.aim);
        this.waits.splice(i, 1);
      }
    }
    if (air && air.airborne) {
      this.airS += dt;
      // The flight's top: falling now, rising a frame ago, long enough in the air to be a flight.
      if (air.vy <= 0 && this.lastVy > 0 && this.airS >= APEX_MIN_AIR_S * 0.5 && this.flight === null && air.trickMissing) this.want.push({ ids: [], slot: 'flight', delay: 0 });
      this.lastVy = air.vy;
    } else if (air) {
      this.airS = 0;
      this.lastVy = 0;
    }
    if (this.kept.length >= MAX_PENDING) this.want = [];
    return this.want.length > 0;
  }

  /** The frame grabbed for what was due. */
  took(frame: T): void {
    const due = this.want;
    this.want = [];
    for (const a of due) {
      if (a.slot === 'flight') {
        // A grab's frame replaces the flight's top; a top never replaces anything.
        if (a.grab) {
          this.flight = frame;
        } else if (this.flight === null) this.flight = frame;
        continue;
      }
      if (a.slot === 'finish') {
        if (this.finishes.length < FINISH_FRAMES) this.finishes.push(frame);
        continue;
      }
      this.keep(frame, a.ids, !a.keep);
    }
  }

  private keep(frame: T, ids: readonly string[], replace: boolean): void {
    for (const id of ids) {
      const had = this.kept.find((k) => k.ids.has(id));
      if (had) {
        if (!replace) continue;
        had.ids.delete(id);
      }
      const same = this.kept.find((k) => k.frame === frame);
      if (same) same.ids.add(id);
      else this.kept.push({ frame, ids: new Set([id]) });
    }
    for (let i = this.kept.length - 1; i >= 0; i--) if (this.kept[i].ids.size === 0) this.kept.splice(i, 1);
  }

  /** What the run earned (the settlement's sticker ids). A settlement made again replaces the last. */
  settle(ids: readonly string[]): void {
    this.settled = new Set(ids);
  }

  /** Each settled sticker with a frame, not handed over before. The line's stickers wait for all the finish's frames
   *  (or for `final`: the run is over, Run Again or Home came first) and are dealt them in turn. */
  ready(final = false): Array<{ id: string; frame: T }> {
    const out: Array<{ id: string; frame: T }> = [];
    const dealt = final ? this.finishes.length > 0 : this.finishes.length >= FINISH_FRAMES;
    let n = 0;
    for (const id of this.settled) {
      const line = atTheLine(id);
      const turn = line ? n++ : 0;
      if (this.handed.has(id)) continue;
      const k = this.kept.find((x) => x.ids.has(id));
      const frame = k ? k.frame : line && dealt ? this.finishes[turn % this.finishes.length] : null;
      if (frame === null) continue;
      this.handed.add(id);
      out.push({ id, frame });
    }
    return out;
  }

  /** Frames held now (the app frees what is left at the run's end). */
  get holding(): number {
    return this.kept.length + (this.flight !== null ? 1 : 0) + this.finishes.length;
  }
}
