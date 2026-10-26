import type { ChaosEvent, Mood } from '../sim/chaos';
import type { GhostKind } from '../ui/contract';
import type { GhostRole } from './beats';
import type { PoolGhostData } from './ghostdata';

// The race field: which ghosts ride a run. The app gathers the inputs (the bundled or Daily pool, the
// run's chaos, your best, the grudge and a friend's challenge) and maps the picks to GhostEntry.
//
// Pure: no DOM, render or audio imports.
//
// Scaffold: pickField is the field as it was picked before the fun pass, moved verbatim from
// App.pickField: the next few pool ghosts just above your best score (spread so they are not all the
// same pace), else the strongest; then your best, the grudge (replacing a same-named pool pick) and
// the friend's challenge. anchor, seed, mood and event are carried for the distance-built field.

export interface FieldInput {
  pool: readonly PoolGhostData[];
  kind: 'pool' | 'daily';
  mood: Mood;
  event: ChaosEvent;
  /** Pool ghosts to pick: 5 plus the mood's extra ghosts. */
  count: number;
  /** Where this player usually crashes, in metres (anchorFor). */
  anchor: number;
  /** chaos.seed, for reproducible tie-breaks. */
  seed: number;
  /** Your best score on this mountain key (0 for none). */
  bestScore: number;
  you: { name: string; score: number; distance: number; record: string } | null;
  grudge: { name: string; score: number; record: string; distance?: number; nemesis?: boolean } | null;
  friend: { name: string; score: number; record: string } | null;
}

export interface FieldPick {
  name: string;
  kind: GhostKind;
  score: number;
  record: string;
  role?: GhostRole;
  /** How far its whole run went, in metres, when known. */
  distance?: number;
  /** Its role window was widened to find it. */
  widened?: boolean;
  nemesis?: boolean;
}

/** The distance a field is built around for this mountain key. Scaffold: a fixed 420 m. */
export function anchorFor(_runDists: Readonly<Record<string, number[]>>, _key: string): number {
  return 420;
}

export function pickField(i: FieldInput): FieldPick[] {
  const best = i.bestScore;
  const pool = i.pool;
  const count = i.count;
  const above = pool.filter((g) => g.score > best);
  let picks: PoolGhostData[];
  if (above.length >= count) {
    // The next few just above your best, spread so they are not all the same pace.
    const span = above.slice(0, Math.max(count, Math.min(above.length, count * 2)));
    picks = [];
    for (let k = 0; k < count; k++) picks.push(span[Math.floor((k * span.length) / count)]);
  } else picks = pool.slice(Math.max(0, pool.length - count));
  const kind: GhostKind = i.kind === 'daily' ? 'daily' : 'pool';
  const out: FieldPick[] = picks.map((g) => ({ name: g.name, kind, score: g.score, record: g.record }));
  const own = i.you;
  if (own?.record) out.push({ name: own.name, kind: 'you', score: own.score, record: own.record });
  const grudge = i.grudge;
  if (grudge?.record && !out.some((o) => o.record === grudge.record)) {
    const k = out.findIndex((o) => o.name === grudge.name);
    if (k >= 0) out.splice(k, 1);
    out.push({ name: grudge.name, kind: 'grudge', score: grudge.score, record: grudge.record });
  }
  if (i.friend) out.push({ name: i.friend.name, kind: 'friend', score: i.friend.score, record: i.friend.record });
  return out;
}
