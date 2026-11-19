import { ROSTER, type Rider, riderByKey } from '../bot/roster';
import { almanacOpens } from './almanac';
import { MOUNTAINS, type MountainDef } from '../sim/mountains';
import type { FieldPick } from './field';
import type { PoolGhostData } from './ghostdata';
import { type Standing, aheadOf, clock, marginPhrase } from './standing';
import ember from '../data/ghosts/ember.json';
import frostfang from '../data/ghosts/frostfang.json';
import lanternfall from '../data/ghosts/lanternfall.json';
import pinecrest from '../data/ghosts/pinecrest.json';
import sakura from '../data/ghosts/sakura.json';

// The Twelve: the campaign spine (round 7). Beat each signature rider on their home ground, one duel at a
// time, from the gentlest to The Hollow King. A duel is a normal run on that rider's home mountain in which
// their real pool record rides as your named rival; you beat them by reaching the line ahead of their
// time. The eleven others open Lanternfall, where the King waits, and after him one last race against all
// twelve at once.
//
// Nothing here touches the sim: a duel is a field with one promised record in it (field.ts `promised`), and
// the last race is a field of the twelve records Lanternfall's pool already holds. Progress is two optional
// fields in the save.
//
// Pure: no DOM, render or audio imports. Copy rules: names only, every number carries its label, no em
// dashes.

/** What the save keeps: the riders beaten (roster keys, in the order they fell) and the last race won. */
export interface TwelveSave {
  beaten: string[];
  crowned?: boolean;
}

/** A rider's real record in a mountain's pool, or null when the pool does not hold one. */
export function duelRecord(pool: readonly PoolGhostData[], rider: Rider): PoolGhostData | null {
  return pool.find((g) => g.name === rider.name && !!g.record) ?? null;
}

/** A pool ghost's finish as a standing (a run that did not finish stands by its distance). */
export function poolStanding(g: Pick<PoolGhostData, 'distance' | 'finishTick'>): Standing {
  return { time: typeof g.finishTick === 'number' && g.finishTick > 0 ? g.finishTick / 60 : null, distance: g.distance };
}

/** The bundled pools by mountain id: the records the duels are ridden against. */
const POOLS: Record<string, { ghosts: PoolGhostData[] }> = { pinecrest, frostfang, ember, sakura, lanternfall };

/** A signature rider's time on any bundled mountain (seconds), or null with no finished record there: what a rival
 *  sticker asks you to beat (album.ts). */
export function riderTimeOn(r: Rider, mountainId: string): number | null {
  const pool = POOLS[mountainId]?.ghosts;
  const g = pool ? duelRecord(pool, r) : null;
  return g ? poolStanding(g).time : null;
}

/** A rider's time on their own home ground in the bundled pools (seconds), or null with no finished record. */
export function homeTime(r: Rider): number | null {
  const pool = POOLS[MOUNTAINS[r.home]?.id ?? '']?.ghosts;
  const g = pool ? duelRecord(pool, r) : null;
  return g ? poolStanding(g).time : null;
}

/**
 * The ladder's order: the time to beat falls with every rung. Each rider stands by their real record on their
 * home ground, slowest first, so the next duel is never an easier time than the last (ordered by the
 * roster's skill, the third duel asked for a quicker time than the eleventh: the bot's variance is wider than
 * the gap between two riders). Whoever's home is the finale closes it whatever their time: the King is the
 * twelfth, on Lanternfall. Read from the records, so a re-ride of the pools re-orders the ladder by itself;
 * should any of the eleven have no finished record at home, the whole ladder falls back on the roster's skill.
 */
export function ladderOrder(riders: readonly Rider[], time: (r: Rider) => number | null = homeTime): Rider[] {
  const last = (r: Rider): number => (MOUNTAINS[r.home]?.finale ? 1 : 0);
  const bySkill = (a: Rider, b: Rider): number => last(a) - last(b) || a.skill - b.skill || (a.key < b.key ? -1 : 1);
  const times = new Map<Rider, number>();
  for (const r of riders) {
    const t = time(r);
    if (t !== null && Number.isFinite(t)) times.set(r, t);
    else if (!last(r)) return [...riders].sort(bySkill);
  }
  return [...riders].sort((a, b) => last(a) - last(b) || (last(a) ? 0 : times.get(b)! - times.get(a)!) || bySkill(a, b));
}

/** The ladder, gentlest first: the slowest home time is the first duel, The Hollow King (home Lanternfall)
 *  always the last. Progress is kept by rider (TwelveSave.beaten holds roster keys), never by rung, so a save
 *  made on another order keeps everyone it beat. */
export const TWELVE: readonly Rider[] = ladderOrder(ROSTER);

/** The rider whose duel closes the ladder. */
export const KING = TWELVE[TWELVE.length - 1];

/** How many must fall before Lanternfall opens: everyone but the King. */
export const TWELVE_GATE = TWELVE.length - 1;

/** A saved value read safely: unknown keys and repeats are dropped, an old save reads as nobody beaten. */
export function readTwelve(v: unknown): TwelveSave {
  const out: TwelveSave = { beaten: [] };
  if (!v || typeof v !== 'object') return out;
  const p = v as { beaten?: unknown; crowned?: unknown };
  if (Array.isArray(p.beaten)) for (const k of p.beaten) if (typeof k === 'string' && riderByKey(k) && !out.beaten.includes(k)) out.beaten.push(k);
  // The last race is ridden after the King: a save cannot hold the crown without him.
  if (p.crowned === true && out.beaten.length >= TWELVE.length) out.crowned = true;
  return out;
}

export function hasBeaten(t: TwelveSave | undefined, key: string): boolean {
  return !!t && t.beaten.includes(key);
}

/** The riders beaten, of the eleven who guard Lanternfall. */
export function gateCount(t: TwelveSave | undefined): number {
  return TWELVE.filter((r) => r !== KING && hasBeaten(t, r.key)).length;
}

/** Lanternfall is open: the eleven others have fallen. */
export function lanternfallOpen(t: TwelveSave | undefined): boolean {
  return gateCount(t) >= TWELVE_GATE;
}

/** Whether a named mountain is open to ride: the finale by The Twelve or by its Almanac page (round 8, almanac.ts
 *  LANTERNFALL_PAGE: a rider stuck on the eleventh duel still sees the finale's world), the others by ghosts passed.
 *  Riding it is not the King's duel: that still waits for eleven of The Twelve (nextDuel). */
export function mountainOpen(d: { ghostsPassed: number; twelve?: TwelveSave; rank?: { xp: number; claimed: number } }, m: Pick<MountainDef, 'unlockGhosts' | 'finale'>): boolean {
  return m.finale ? lanternfallOpen(d.twelve) || almanacOpens(d, 'lanternfall') : d.ghostsPassed >= m.unlockGhosts;
}

/** What a locked mountain's card says ("to unlock" is the card's own word for the lock). */
export function lockText(d: { ghostsPassed: number; twelve?: TwelveSave }, m: Pick<MountainDef, 'unlockGhosts' | 'finale'>): string {
  if (mountainOpen(d, m)) return '';
  if (m.finale) {
    const left = TWELVE_GATE - gateCount(d.twelve);
    return `Beat ${left} more of The Twelve to unlock`;
  }
  const left = m.unlockGhosts - d.ghostsPassed;
  return `Pass ${left} more ${left === 1 ? 'ghost' : 'ghosts'} to unlock`;
}

/** What rides next in the campaign. */
export type Duel = { kind: 'duel'; rider: Rider } | { kind: 'final' };

/**
 * The next duel: the gentlest unbeaten rider whose home mountain is open (`open`, by mountain index). The
 * ladder reads gentlest first, and a rider whose home is still locked waits without blocking the ones you
 * can reach: a new player starts on Pinecrest's riders and meets Sakura's once Sakura opens. After the
 * King, the last race; after that, nothing.
 */
export function nextDuel(t: TwelveSave | undefined, open: (mountain: number) => boolean): Duel | null {
  // (The King waits for the eleven whatever opened his mountain.)
  for (const r of TWELVE) if (!hasBeaten(t, r.key) && open(r.home) && (r !== KING || lanternfallOpen(t))) return { kind: 'duel', rider: r };
  if (TWELVE.every((r) => hasBeaten(t, r.key))) return t?.crowned ? null : { kind: 'final' };
  return null;
}

/** The gentlest unbeaten rider whose home is still locked, when nobody can be duelled yet (the card says
 *  what opens them). */
export function waitingRider(t: TwelveSave | undefined, open: (mountain: number) => boolean): Rider | null {
  if (nextDuel(t, open)) return null;
  return TWELVE.find((r) => !hasBeaten(t, r.key) && !open(r.home)) ?? null;
}

/** The mountain (its index) the next duel or the last race is ridden on. */
export function duelMountain(d: Duel): number {
  return d.kind === 'final' ? KING.home : d.rider.home;
}

/** Runs a save rides before its first duel (round 8, G10): a first run teaches one idea at a time, so the duels wait
 *  for the third run. */
export const FIRST_DUEL_RUN = 2;

/** The duel a run on this mountain is, or null: only the next duel's own home ground, and none in a save's first
 *  FIRST_DUEL_RUN runs (`runs`: runs ridden before this one; omitted, as before round 8, nothing waits). */
export function duelOn(t: TwelveSave | undefined, mountain: number, open: (mountain: number) => boolean, runs?: number): Duel | null {
  if (runs !== undefined && runs < FIRST_DUEL_RUN && !t?.beaten.length) return null;
  const d = nextDuel(t, open);
  return d && duelMountain(d) === mountain ? d : null;
}

/** The last race's field: all twelve, each on their real Lanternfall record, quickest first. The King is the
 *  rival. Your own best joins it in the app, as it does any field. */
export function finalField(pool: readonly PoolGhostData[]): FieldPick[] {
  const out: FieldPick[] = [];
  for (const r of TWELVE) {
    const g = duelRecord(pool, r);
    if (!g) continue;
    const s = poolStanding(g);
    const p: FieldPick = { name: g.name, kind: 'pool', score: g.score, record: g.record, role: 'pack', distance: g.distance };
    if (s.time !== null) p.time = s.time;
    if (r === KING) p.rival = true;
    out.push(p);
  }
  return out.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
}

/** A duel is won by reaching the line ahead of the rider's time. A wreck never wins one, however far the
 *  rider's own run went. */
export function duelWon(you: Standing, them: Standing): boolean {
  return you.time !== null && aheadOf(you, them);
}

/** What a run did to the campaign. */
export interface TwelveOutcome {
  /** The duel this run was (null: not one). */
  duel: Duel | null;
  /** The rider who fell, or null. */
  fell: Rider | null;
  /** The last race was won this run. */
  crowned: boolean;
  /** This run's win opened Lanternfall. */
  opened: boolean;
  /** How many of the twelve have fallen now. */
  beaten: number;
  /** The margin against the rider duelled ("by 1.2 s"), win or loss; null when it was the last race. */
  by: string | null;
  /** The rider duelled finished ahead of you. */
  lost: boolean;
}

/**
 * Settle a run against the campaign and write the save's record. `standings` are the field's riders as
 * they finished (by name). Idempotent: a revive and a second finish settle the same run again and a
 * rider already beaten stays beaten, so nothing pays or announces twice (`fell` is set only on the
 * settle that first beat them; the caller keeps the first outcome for its card).
 */
export function settleTwelve(t: TwelveSave, duel: Duel | null, you: Standing, standings: ReadonlyMap<string, Standing>): TwelveOutcome {
  const out: TwelveOutcome = { duel, fell: null, crowned: false, opened: false, beaten: t.beaten.length, by: null, lost: false };
  if (!duel) return out;
  if (duel.kind === 'final') {
    const all = TWELVE.map((r) => standings.get(r.name));
    if (!t.crowned && all.every((s) => s !== undefined && duelWon(you, s))) {
      t.crowned = true;
      out.crowned = true;
    }
    return out;
  }
  const them = standings.get(duel.rider.name);
  if (!them) return out;
  if (duelWon(you, them)) {
    out.by = marginPhrase(you, them);
    if (!hasBeaten(t, duel.rider.key)) {
      const was = lanternfallOpen(t);
      t.beaten.push(duel.rider.key);
      out.fell = duel.rider;
      out.opened = !was && lanternfallOpen(t);
    }
  } else {
    out.lost = true;
    out.by = aheadOf(them, you) ? marginPhrase(them, you) : null;
  }
  out.beaten = t.beaten.length;
  return out;
}

/** Gifts a rider pays when they fall, and the crown's. */
export const DUEL_GIFTS = 40;
export const CROWN_GIFTS = 200;

const mountainName = (i: number): string => MOUNTAINS[i]?.name ?? '';

/** The line as a duel starts: who, and the time to beat. */
export function duelStartLine(duel: Duel, them: Standing | null): { text: string; sub: string } {
  if (duel.kind === 'final') return { text: 'The last race', sub: 'All twelve ride. Finish ahead of every one.' };
  const goal = them && them.time !== null ? `Finish ahead of ${clock(them.time)}` : 'Finish ahead';
  return { text: `Duel: ${duel.rider.name}`, sub: `${goal} on ${mountainName(duel.rider.home)}` };
}

/** How the ladder stands, in a sentence: "3 of 12 beaten", "The Twelve are beaten". */
export function tallyLine(t: TwelveSave | undefined): string {
  const n = t?.beaten.length ?? 0;
  if (t?.crowned) return 'You hold the crown';
  return n >= TWELVE.length ? 'The Twelve are beaten' : `${n} of ${TWELVE.length} beaten`;
}

/** What is left before the King, for the card's hook ("3 more and the King rides"). */
export function gateLine(t: TwelveSave | undefined): string | null {
  const left = TWELVE_GATE - gateCount(t);
  if (left <= 0) return hasBeaten(t, KING.key) ? null : `${KING.name} waits on ${mountainName(KING.home)}`;
  return `${left} more ${left === 1 ? 'opens' : 'open'} ${mountainName(KING.home)}`;
}

/** The results' line for a duel: who fell and what that leaves, or how close it was. */
export function outcomeLine(o: TwelveOutcome): string | null {
  if (o.crowned) return 'All twelve beaten in one race. The crown is yours.';
  if (!o.duel) return null;
  if (o.duel.kind === 'final') return 'The last race stands. Finish ahead of all twelve.';
  const name = o.duel.rider.name;
  if (o.fell) {
    if (o.opened) return `${name} falls. ${mountainName(KING.home)} is open.`;
    if (o.fell === KING) return `${name} falls. One race is left: all twelve at once.`;
    return `${name} falls. ${o.beaten} of ${TWELVE.length} beaten.`;
  }
  if (o.lost) return o.by ? `${name} held you off ${o.by}.` : `${name} held you off.`;
  return null;
}
