import type { PoolGhostData } from './ghostdata';
import { poolTime } from './field';
import type { LeagueSave } from './spinesave';

// The Cup's leagues (round 8, G7). Five divisions. Each week's league is you and nineteen records: the week's Cup
// riders as the Cup's pool already holds them (generated runs of the week's course, and the slow riders made from
// them, every one a real run replayed as ridden), taken at your division's band of pace: division 5 around the slow
// end, division 1 the quickest. They are shown as what they are, the week's records with their generated names and
// real times, never as players online. You stand by your week's best finish; when the week turns, the top four go
// up a division and the bottom four down, and a week you do not ride holds your division.
//
// Pure: no DOM, render or audio imports.

export const DIVISIONS = 5;
export const LEAGUE_SIZE = 20;
/** Places that go up, and down, when the week turns. */
export const LEAGUE_MOVE = 4;
/** Where a new rider starts. */
export const START_DIVISION = 5;
/** XP for a week's place, paid once a place is improved on (rank.ts): first, top four, top ten. */
export const LEAGUE_XP = { first: 120, top: 60, half: 30 } as const;

export interface LeagueRow {
  name: string;
  time: number;
}

/** The nineteen records of a division this week: a window of nineteen finishers from the week's pool in race order,
 *  quickest at division 1 and slowest at 5. A short pool gives what it has. */
export function leagueField(pool: readonly PoolGhostData[], div: number): LeagueRow[] {
  const rows = pool
    .filter((g) => typeof g.finishTick === 'number' && g.finishTick > 0)
    .map((g) => ({ name: g.name, time: Math.round(poolTime(g) * 10) / 10 }))
    .sort((a, b) => a.time - b.time);
  const n = LEAGUE_SIZE - 1;
  if (rows.length <= n) return rows;
  const d = Math.max(1, Math.min(DIVISIONS, Math.round(div)));
  const start = Math.round(((rows.length - n) * (d - 1)) / (DIVISIONS - 1));
  return rows.slice(start, start + n);
}

/** Your place among them (1 to 20) for a best time, or null with none. */
export function leaguePlace(field: readonly LeagueRow[], best: number | null | undefined): number | null {
  if (!best || !(best > 0)) return null;
  return 1 + field.filter((r) => r.time < best).length;
}

/** The division after a week ended in a place (null: not ridden, which holds it). */
export function nextDivision(div: number, place: number | null, size = LEAGUE_SIZE): { div: number; moved: number } {
  if (place === null) return { div, moved: 0 };
  if (place <= LEAGUE_MOVE && div > 1) return { div: div - 1, moved: -1 };
  if (place > size - LEAGUE_MOVE && div < DIVISIONS) return { div: div + 1, moved: 1 };
  return { div, moved: 0 };
}

/** The league as of this week: last week's turned over if the week has changed. */
export function leagueNow(l: LeagueSave | undefined, week: string): LeagueSave {
  if (!l) return { week, div: START_DIVISION };
  if (l.week === week) return { ...l };
  const { div, moved } = nextDivision(l.div, l.place ?? null);
  return { week, div, last: { week: l.week, div: l.div, place: l.place ?? null, moved } };
}

/** A Cup run settled into the league: the week's best and its place. Returns the place before and after. */
export function settleLeague(l: LeagueSave | undefined, week: string, time: number | null, pool: readonly PoolGhostData[]): { save: LeagueSave; was: number | null; place: number | null; field: LeagueRow[] } {
  const s = leagueNow(l, week);
  const field = leagueField(pool, s.div);
  const was = s.place ?? null;
  if (time !== null && time > 0 && (!s.best || time < s.best)) s.best = time;
  const place = leaguePlace(field, s.best);
  if (place !== null) s.place = place;
  return { save: s, was, place, field };
}

/** XP a better place pays: the band it reached, if it is a better band than before. */
export function leagueXp(was: number | null, place: number | null): number {
  const band = (p: number | null): number => (p === null ? 0 : p === 1 ? 3 : p <= LEAGUE_MOVE ? 2 : p <= 10 ? 1 : 0);
  const b = band(place);
  if (b <= band(was)) return 0;
  return b === 3 ? LEAGUE_XP.first : b === 2 ? LEAGUE_XP.top : LEAGUE_XP.half;
}
