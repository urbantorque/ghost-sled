import { prevDay } from './settle';
import type { FlameSave } from './spinesave';

// Keep the lantern lit (round 8, G7): the title's flame is the days in a row with a run of any kind. A seven-day
// calendar of growing rewards moves on by days ridden and never goes back; finishing a calendar week earns the one
// ember a rider can hold, and an ember covers one missed day when you come back. Nothing is locked until a time and
// nothing is lost by playing late: a day is any UTC day you ride.
//
// Pure: no DOM, render or audio imports.

/** XP the calendar's days pay, the first run of each day ridden: day 1 to day 7. */
export const CALENDAR_XP: readonly number[] = [20, 30, 40, 60, 80, 100, 150];
/** Gifts the calendar's seventh day pays, beside its XP and the ember. */
export const CALENDAR_GIFTS = 100;

export interface FlameLit {
  /** This run lit a new day. */
  lit: boolean;
  /** The ember covered yesterday on the way. */
  embered: boolean;
  /** Days in a row now. */
  streak: number;
  /** The calendar's day this run paid (1 to 7), 0 when the day was lit already. */
  calendar: number;
  xp: number;
  gifts: number;
  /** The run finished a calendar week and earned the ember. */
  emberEarned: boolean;
}

/** The day before the day before. */
const twoBack = (day: string): string => prevDay(prevDay(day));

/** Lights today, once a day. Pure in the record: settling twice on the same day changes nothing more. */
export function lightDay(f: FlameSave | undefined, day: string): { flame: FlameSave; lit: FlameLit } {
  const was: FlameSave = f ? { ...f } : { last: '', streak: 0, best: 0, ember: 0, days: 0 };
  const none: FlameLit = { lit: false, embered: false, streak: was.streak, calendar: 0, xp: 0, gifts: 0, emberEarned: false };
  if (!day || was.last === day) return { flame: was, lit: none };
  const out = { ...was };
  let embered = false;
  if (was.last && was.last === prevDay(day)) out.streak = was.streak + 1;
  else if (was.last && was.ember > 0 && was.last === twoBack(day)) {
    // One missed day: the ember covers it and is spent.
    out.streak = was.streak + 1;
    out.ember = 0;
    embered = true;
  } else out.streak = 1;
  out.best = Math.max(out.best, out.streak);
  out.last = day;
  out.days = was.days + 1;
  const calendar = ((out.days - 1) % 7) + 1;
  const emberEarned = calendar === 7 && out.ember === 0;
  if (calendar === 7) out.ember = 1;
  return { flame: out, lit: { lit: true, embered, streak: out.streak, calendar, xp: CALENDAR_XP[calendar - 1], gifts: calendar === 7 ? CALENDAR_GIFTS : 0, emberEarned } };
}

/** The flame as the title shows it today: alive (ridden today or yesterday, or the ember will cover a missed day),
 *  ridden today, the streak, the ember, and the calendar's next day. */
export function flameNow(f: FlameSave | undefined, today: string): { streak: number; litToday: boolean; alive: boolean; ember: boolean; best: number; nextDay: number; atRisk: boolean } {
  if (!f || !f.last) return { streak: 0, litToday: false, alive: false, ember: false, best: 0, nextDay: 1, atRisk: false };
  const litToday = f.last === today;
  const yesterday = f.last === prevDay(today);
  const covered = f.ember > 0 && f.last === twoBack(today);
  const alive = litToday || yesterday || covered;
  return { streak: alive ? f.streak : 0, litToday, alive, ember: f.ember > 0, best: f.best, nextDay: (f.days % 7) + 1, atRisk: !litToday && (yesterday || covered) };
}
