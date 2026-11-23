import { weekOfDay } from './cup';
import { SAVE_KEY } from './save';
import { dailyKey } from '../sim/mountains';

// Round 9, the truth lane: save fixtures for the dev server. `?debug&save=<name>` loads one of
// scripts/playtest/fixtures/<name>.json (r9-fixtures.ts writes them from the career harness) as the save before the
// title opens, so the title, the results and every sheet can be seen at runs 1, 5, 20, 50 and 100 without riding
// there. vite.config.ts's dev-only plugin puts the asked fixture in the page as a JSON script element; app.ts calls
// useFixture behind `import.meta.env.DEV`, so the release carries none of this, and no fixture is ever in `dist`.
//
// The fixture's days are moved to today first (shiftSave): it was settled on the harness's fake clock, and its flame,
// Daily, contracts, the Cup's week and the month's chapter would otherwise read as long ago. The save then lives in a
// store of its own: the real save is never read, and nothing the session does is written over it.
//
// Pure apart from useFixture: no render or audio imports.

/** A fixture as r9-fixtures.ts writes it: what it is, and the save (null for `fresh`, a first visit). */
export interface Fixture {
  meta: { name: string; pilot?: string; run?: number; day?: string; [k: string]: unknown };
  save: Record<string, unknown> | null;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK = /^(\d{4})-W(\d{2})$/;
const MONTH = /^(\d{4})-(\d{2})$/;

const dayNum = (k: string): number => {
  const p = DAY.exec(k)!;
  return Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3])) / 86400000;
};
const fromNum = (n: number): string => dailyKey(new Date(n * 86400000));

/** The Monday of an ISO week key, as a day number. */
function mondayNum(week: string): number {
  const p = WEEK.exec(week)!;
  const jan4 = Date.UTC(Number(p[1]), 0, 4) / 86400000;
  const dow = (new Date(jan4 * 86400000).getUTCDay() + 6) % 7;
  return jan4 - dow + 7 * (Number(p[2]) - 1);
}

/** Moves every date a save holds from the day it was last played (`from`) to `to`: days by the days between them,
 *  ISO weeks by the weeks between their weeks, and chapter months by the months between. The Daily's, the Cup's and a
 *  Trial's bests and grudges ('daily:<day>', 'cup:<week>', 'trial:<week>') are dropped, since their records ride
 *  the old day's course; the day's medal, streak and best figure (save.daily, save.cup, save.league) are kept. */
export function shiftSave(save: Record<string, unknown>, from: string, to: string): Record<string, unknown> {
  if (!DAY.test(from) || !DAY.test(to)) return save;
  const s = JSON.parse(JSON.stringify(save)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const dd = dayNum(to) - dayNum(from);
  const dw = Math.round((mondayNum(weekOfDay(to)) - mondayNum(weekOfDay(from))) / 7);
  const ym = (k: string): number => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)) - 1;
  const dm = ym(to) - ym(from);
  const day = (k: unknown): unknown => (typeof k === 'string' && DAY.test(k) ? fromNum(dayNum(k) + dd) : k);
  const week = (k: unknown): unknown => (typeof k === 'string' && WEEK.test(k) ? weekOfDay(fromNum(mondayNum(k) + 7 * dw)) : k);
  const month = (k: string): string => {
    if (!MONTH.test(k)) return k;
    const n = ym(k) + dm;
    return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
  };
  const rekey = <T>(o: unknown, f: (k: string) => string | null): Record<string, T> | undefined => {
    if (!o || typeof o !== 'object') return undefined;
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(o as Record<string, T>)) {
      const nk = f(k);
      if (nk !== null) out[nk] = v;
    }
    return out;
  };
  const dated = (k: string): boolean => k.startsWith('daily:') || k.startsWith('cup:') || k.startsWith('trial:');
  for (const f of ['best', 'grudge', 'runTimes', 'runDists']) if (s[f]) s[f] = rekey(s[f], (k) => (dated(k) ? null : k));
  if (s.daily) {
    s.daily.key = day(s.daily.key);
    s.daily.last = day(s.daily.last);
  }
  if (s.cup) s.cup.key = week(s.cup.key);
  if (s.flame) s.flame.last = day(s.flame.last);
  if (s.contracts) s.contracts.day = day(s.contracts.day);
  if (s.missions?.swapDay) s.missions.swapDay = day(s.missions.swapDay);
  if (s.league) {
    s.league.week = week(s.league.week);
    if (s.league.last) s.league.last.week = week(s.league.last.week);
  }
  if (s.trials) s.trials = rekey(s.trials, (k) => week(k) as string);
  if (s.chapters) s.chapters = rekey(s.chapters, month);
  if (Array.isArray(s.recent))
    for (const r of s.recent) {
      if (typeof r?.k !== 'string') continue;
      if (r.k.startsWith('daily:')) r.k = `daily:${day(r.k.slice(6))}`;
      else if (r.k.startsWith('cup:') || r.k.startsWith('trial:')) r.k = r.k.replace(/:(.*)$/, (_: string, w: string) => `:${week(w)}`);
    }
  return s;
}

/** The fixture's save as it loads today, as the JSON the store reads (null for a first visit). */
export function fixtureSaveJson(fx: Fixture, today: string): string | null {
  if (!fx.save) return null;
  const from = typeof fx.meta.day === 'string' ? fx.meta.day : today;
  return JSON.stringify(shiftSave(fx.save, from, today));
}

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
}

/** Puts a fixture in place of the save on `storage`, in memory: the save's key reads the fixture (moved to today)
 *  and writes to it stay in this page; every other key goes through untouched. Returns what it loaded, or null when
 *  the page holds no such fixture (the real save is then left alone, and the switch does nothing). */
export function fixtureStorage(storage: Store, fx: Fixture, today: string): string | null {
  let held = fixtureSaveJson(fx, today);
  const get = storage.getItem.bind(storage);
  const set = storage.setItem.bind(storage);
  const remove = storage.removeItem?.bind(storage);
  storage.getItem = (k) => (k === SAVE_KEY ? held : get(k));
  storage.setItem = (k, v) => (k === SAVE_KEY ? void (held = v) : set(k, v));
  if (remove) storage.removeItem = (k) => (k === SAVE_KEY ? void (held = null) : remove(k));
  return fx.meta.name;
}

/** The dev switch: reads the fixture the dev server put in the page (vite.config.ts) and swaps it in. */
export function useFixture(storage: Store, name: string): string | null {
  const el = typeof document !== 'undefined' ? document.getElementById('gs-fixture') : null;
  let fx: Fixture | null = null;
  try {
    fx = el?.textContent ? (JSON.parse(el.textContent) as Fixture) : null;
  } catch {
    fx = null;
  }
  if (!fx || fx.meta?.name !== name) {
    console.info(`[save] no fixture "${name}" on this page (scripts/playtest/fixtures, dev server only): the real save is used`);
    return null;
  }
  return fixtureStorage(storage, fx, dailyKey(new Date()));
}
