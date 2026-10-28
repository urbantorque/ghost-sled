import type { GhostKind } from '../ui/contract';
import { EXTRA_GIFTS_CAP, type GhostRef, type GhostRole, type PassWord } from './beats';

// Race words and duels: what each pass is called and pays, the duel tracker, which ghost the rival
// pill names, the start-line call and the pass ladder.
//
// Pure: no DOM, render or audio imports.

/** Before this sim tick the start-line bunch is still sorting itself out (jostles, no duels). */
export const START_TICKS = 360;
/** Live first passes this close together (ticks) chain into a Double, Triple or Pass streak. */
export const CHAIN_TICKS = 180;
/** A pass this soon (ticks) after a slingshot boost is 'Slung past'. */
export const SLING_TICKS = 90;
/** A 'you' wreck passed this soon (ticks) after New ground is muted: New ground owns that beat. */
export const NEW_GROUND_MUTE_TICKS = 60;
/** Extra gifts: a slung pass and each chained pass. */
export const SLUNG_GIFTS = 2;
export const CHAIN_GIFTS = 2;
/** A won (or held-off) duel pays this, doubled in Haunted Hollow. */
export const DUEL_GIFTS = 5;

export interface PassContext {
  tick: number;
  /** The first time this ghost is passed this run. */
  first: boolean;
  ghost: GhostRef;
  /** The ghost has already crashed (its wreck is passed). */
  wreck: boolean;
  /** The ghost has led you by 2 m or more at some point this run. */
  everLedBy2m: boolean;
  /** Sim tick of the latest slingshot boost (-1e9 for none). */
  lastSlingTick: number;
  /** Sim tick of the previous shown live first pass (-1e9 for none). */
  lastShownPassTick: number;
  /** This pass's place in a chain of live first passes (1 = alone, 2 = Double, ...). */
  chainN: number;
  /** The ghost passed you earlier this run. */
  passedYouBefore: boolean;
  /** A duel with this ghost resolved on this very pass. */
  duel: 'won' | 'heldOff' | null;
  haunted: boolean;
  /** Sim tick of New ground this run (-1e9 for none). */
  newGroundTick: number;
}

/**
 * What a pass is called, what it pays and whether it shows. gifts: the base pay (first passes only:
 * 5, or 10 for the grudge, doubled in Haunted Hollow), never capped. extra: the bonus for a slung or
 * chained pass, which the director caps per run (EXTRA_GIFTS_CAP). muted: no flash, no ping, no
 * camera move (the pass still counts for settlement and unlocks). First match wins.
 */
export function classifyPass(c: PassContext): { word: PassWord; text: string; gifts: number; extra: number; muted: boolean } {
  const base = c.first ? (c.haunted ? 2 : 1) * (c.ghost.kind === 'grudge' ? 10 : 5) : 0;
  // 1. The start-line bunch: edging past a ghost that never got clear of you is no overtake.
  if (c.tick < START_TICKS && !c.everLedBy2m) return { word: 'jostle', text: 'Passed', gifts: base, extra: 0, muted: true };
  // 2. A wreck: you rode past where it fell. Your best's wreck right on New ground is that beat's.
  if (c.wreck) {
    const muted = c.ghost.kind === 'you' && c.tick - c.newGroundTick >= 0 && c.tick - c.newGroundTick <= NEW_GROUND_MUTE_TICKS;
    return { word: 'beat', text: 'Beat', gifts: base, extra: 0, muted };
  }
  // 3. A duel decided on this pass.
  if (c.duel === 'won') return { word: 'duelWon', text: 'Duel won', gifts: base, extra: 0, muted: false };
  if (c.duel === 'heldOff') return { word: 'heldOff', text: 'Held off', gifts: base, extra: 0, muted: false };
  // 4. Out of a slipstream: the slingshot carried you past.
  if (c.first && c.tick - c.lastSlingTick >= 0 && c.tick - c.lastSlingTick <= SLING_TICKS) return { word: 'slung', text: 'Slung past', gifts: base, extra: SLUNG_GIFTS, muted: false };
  // 5. Winning a place back pays nothing more, but it is news.
  if (!c.first) return { word: 'tookBack', text: 'Took back', gifts: 0, extra: 0, muted: false };
  // 6. Live first passes in quick succession.
  if (c.chainN >= 2 && c.tick - c.lastShownPassTick <= CHAIN_TICKS) {
    const word: PassWord = c.chainN === 2 ? 'double' : c.chainN === 3 ? 'triple' : 'streak';
    const text = c.chainN === 2 ? 'Double pass' : c.chainN === 3 ? 'Triple pass' : `Pass streak ${c.chainN}`;
    return { word, text, gifts: base, extra: CHAIN_GIFTS, muted: false };
  }
  // 7. Your best, still riding (C7).
  if (c.ghost.kind === 'you') return { word: 'yourBest', text: 'Passed', gifts: base, extra: 0, muted: false };
  return { word: 'passed', text: 'Passed', gifts: base, extra: 0, muted: false };
}

/** Extra gifts left this run (chains, slung, duels, finales, graveyards share one cap). */
export class ExtraGifts {
  private used = 0;

  constructor(readonly cap = EXTRA_GIFTS_CAP) {}

  /** Takes up to `n` from what is left and returns what was granted. */
  take(n: number): number {
    const g = Math.max(0, Math.min(Math.floor(n), this.cap - this.used));
    this.used += g;
    return g;
  }

  get left(): number {
    return this.cap - this.used;
  }

  reset(): void {
    this.used = 0;
  }
}

export type DuelEvent = { phase: 'open' | 'won' | 'heldOff' | 'lost' | 'closed'; id: number };

/** Ticks spent within DUEL_NEAR that open a duel. */
export const DUEL_OPEN_TICKS = 60;
export const DUEL_NEAR = 1.5;
export const DUEL_RESOLVE = 4;
export const DUEL_COOLDOWN_TICKS = 180;

/**
 * Neck-and-neck fights. Fed once per frame with whole sim-tick deltas (never frame counts) and every
 * ghost's signed gap (ghost minus you, + = ahead). A live ghost within 1.5 m for 60 accumulated ticks
 * opens a duel (from tick 360, one at a time, the closest wins). It resolves past 4 m: you ahead is
 * 'won', or 'heldOff' when the ghost spent most of it behind you; the ghost ahead is 'lost'; the ghost
 * crashing is 'won'. A ghost pays for one duel per run; a lost duel may reopen once; 3 s cooldown.
 */
export class DuelTracker {
  private openId: number | null = null;
  private amt = 0;
  private openTicks = 0;
  private behindTicks = 0;
  private readonly acc = new Map<number, number>();
  private readonly paid = new Set<number>();
  private readonly lost = new Map<number, number>();
  private readonly coolUntil = new Map<number, number>();

  /** The ghost id of the open duel, or null. */
  get open(): number | null {
    return this.openId;
  }

  /** 0..1 tension of the open duel (1 within 0.8 m, 0 at the 4 m resolve line). */
  get amount(): number {
    return this.amt;
  }

  /** Advance by whole sim ticks with each ghost's signed gap. canOpen false holds a new duel back for
   *  now (closeness still accrues; an open duel runs on as usual). */
  step(dTicks: number, tick: number, gaps: ReadonlyArray<{ id: number; gap: number; live: boolean }>, canOpen = true): DuelEvent[] {
    const out: DuelEvent[] = [];
    const d = Math.max(0, Math.floor(dTicks));
    if (this.openId !== null) {
      const id = this.openId;
      const g = gaps.find((x) => x.id === id);
      if (!g) {
        this.close(id, tick);
        out.push({ phase: 'closed', id });
      } else if (!g.live) {
        // It crashed while you fought it out: yours.
        this.close(id, tick);
        this.paid.add(id);
        out.push({ phase: 'won', id });
      } else {
        this.openTicks += d;
        if (g.gap < 0) this.behindTicks += d;
        const a = Math.abs(g.gap);
        this.amt = Math.max(0, Math.min(1, (DUEL_RESOLVE - a) / (DUEL_RESOLVE - 0.8)));
        if (a > DUEL_RESOLVE) {
          this.close(id, tick);
          if (g.gap < 0) {
            this.paid.add(id);
            out.push({ phase: this.behindTicks > 0.6 * this.openTicks ? 'heldOff' : 'won', id });
          } else {
            this.lost.set(id, (this.lost.get(id) ?? 0) + 1);
            out.push({ phase: 'lost', id });
          }
        }
      }
      return out;
    }
    if (tick < START_TICKS) return out;
    let pick: { id: number; gap: number } | null = null;
    for (const g of gaps) {
      if (!g.live) {
        this.acc.delete(g.id);
        continue;
      }
      const a = Math.abs(g.gap);
      if (a > DUEL_RESOLVE) this.acc.set(g.id, 0);
      else if (a < DUEL_NEAR) this.acc.set(g.id, (this.acc.get(g.id) ?? 0) + d);
      if (this.paid.has(g.id) || (this.lost.get(g.id) ?? 0) >= 2 || tick < (this.coolUntil.get(g.id) ?? -1)) continue;
      if ((this.acc.get(g.id) ?? 0) >= DUEL_OPEN_TICKS && a < DUEL_NEAR && (!pick || a < Math.abs(pick.gap))) pick = g;
    }
    if (pick && canOpen) {
      this.openId = pick.id;
      this.openTicks = 0;
      this.behindTicks = 0;
      this.amt = Math.max(0, Math.min(1, (DUEL_RESOLVE - Math.abs(pick.gap)) / (DUEL_RESOLVE - 0.8)));
      out.push({ phase: 'open', id: pick.id });
    }
    return out;
  }

  private close(id: number, tick: number): void {
    this.openId = null;
    this.amt = 0;
    this.acc.set(id, 0);
    this.coolUntil.set(id, tick + DUEL_COOLDOWN_TICKS);
  }

  /** Your crash closes an open duel silently (no result, no pay). */
  crash(): void {
    if (this.openId !== null) this.acc.set(this.openId, 0);
    this.openId = null;
    this.amt = 0;
  }

  reset(): void {
    this.openId = null;
    this.amt = 0;
    this.openTicks = 0;
    this.behindTicks = 0;
    this.acc.clear();
    this.paid.clear();
    this.lost.clear();
    this.coolUntil.clear();
  }
}

/**
 * The ghost the rival pill and the C1/C11 marker name, so the HUD, the ring and the camera agree: an
 * open duel, else the start-line call while it is up, else the nearest ghost ahead (standings).
 */
export function rivalPick(next: { id: number; gap: number } | null, duel: { id: number; gap: number } | null, call: { id: number; gap: number } | null): { id: number; gap: number } | null {
  return duel ?? call ?? next;
}

/** The rival pill keeps the ghost it names while that one stays on the same side of you and within
 *  this many metres of the nearest: a bunched pack never flickers the name from frame to frame. */
export const RIVAL_HOLD_M = 1;

/**
 * The nearest ghost (standings.next) with a little hold: `held` is the ghost named last frame, with
 * its gap now. It stays named while it is on the same side of you as the nearest and no more than
 * RIVAL_HOLD_M further; otherwise the nearest takes over.
 */
export function steadyNext(held: { id: number; gap: number } | null, next: { id: number; gap: number } | null): { id: number; gap: number } | null {
  if (!next || !held || held.id === next.id) return next;
  if (held.gap > 0 === next.gap > 0 && Math.abs(held.gap - next.gap) < RIVAL_HOLD_M) return held;
  return next;
}

/**
 * The start-line call: friend 'Racing', nemesis 'Nemesis', grudge 'Rematch', your best (150 m or
 * more) 'Chase', otherwise the pace ghost 'Chase'. The best candidate in the field is chosen whether
 * or not its track is ready; until it is, there is no call yet (null), so a later frame calls it
 * rather than settling for a lesser one.
 */
export function callPick(c: ReadonlyArray<{ id: number; kind: GhostKind; role?: GhostRole; ready: boolean; nemesis?: boolean }>, bestDist: number): { id: number; word: 'Racing' | 'Nemesis' | 'Rematch' | 'Chase' } | null {
  const rank = (g: (typeof c)[number]): number => {
    if (g.kind === 'friend') return 5;
    if (g.kind === 'grudge') return g.nemesis ? 4 : 3;
    if (g.kind === 'you' && bestDist >= 150) return 2;
    if (g.role === 'pace' && g.kind !== 'you') return 1;
    return 0;
  };
  let best: (typeof c)[number] | null = null;
  let br = 0;
  for (const g of c) {
    const r = rank(g);
    if (r > br) {
      br = r;
      best = g;
    }
  }
  if (!best || !best.ready) return null;
  const word = br === 5 ? 'Racing' : br === 4 ? 'Nemesis' : br === 3 ? 'Rematch' : 'Chase';
  return { id: best.id, word };
}

/** The pass ping's ladder step for the n-th shown pass: it climbs to the top note and holds there,
 *  adding an octave ping from the 8th, instead of wrapping back down. */
export function ladderIndex(n: number): { step: number; octave: boolean } {
  const k = Math.max(1, Math.floor(n));
  return { step: 5 + Math.min(k - 1, 7), octave: k >= 8 };
}
