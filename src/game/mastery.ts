import { ROSTER } from '../bot/roster';
import { MOUNTAINS } from '../sim/mountains';
import type { Course } from '../sim/course';
import { planMarquee } from './marquee';

// Mountain mastery (round 5): a board of goals on each named mountain that teaches its places, worth a
// star each, and each star pays once. Medals (bronze, silver, gold for the whole run), each of its sky
// gates flown, each of its set pieces swept (every light in it, and clean), each signature rider who calls
// it home beaten to the line, and one clean finish (no wipeout, no ward). The board is the course's, so it
// is the same for everyone; what you hold is in the save (SaveData.mastery), and never goes backwards.
//
// Pure: no DOM, render or audio imports.

/** Gifts a star pays, once. */
export const STAR_GIFTS = 10;

/** What a save holds of one mountain's board. */
export interface MasteryRecord {
  /** Sky gate ids flown. */
  gates: number[];
  /** Set pieces: a key is one swept clean (round 5), a key with ":won" one whose verb was beaten (round 6), a
   *  key with its verb (":slide") one beaten since round 7 changed what some of them ask. */
  moments: string[];
  /** Signature rider keys beaten to the line. */
  riders: string[];
  clean: boolean;
}

export interface Star {
  key: string;
  label: string;
  group: 'medal' | 'gate' | 'moment' | 'rider' | 'clean';
  done: boolean;
}

export function emptyMastery(): MasteryRecord {
  return { gates: [], moments: [], riders: [], clean: false };
}

/** A save's record, sanitised (an older save has none). */
export function readMastery(p: unknown): MasteryRecord {
  const o = (p && typeof p === 'object' ? p : {}) as Partial<Record<keyof MasteryRecord, unknown>>;
  const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : []);
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 32) : []);
  return { gates: nums(o.gates), moments: strs(o.moments), riders: strs(o.riders), clean: o.clean === true };
}

/** Set pieces that ask in round 7 what they asked in round 6: a star won then still stands. The rest changed
 *  their verb or its rule (decision 246's pattern: the save keeps what it held, and it claims nothing new). */
const SAME_AS_R6: ReadonlySet<string> = new Set(['firstdrop', 'seracgate', 'cavern', 'cindergate']);

/** Whether a record holds a set piece's star. */
function momentDone(rec: MasteryRecord, key: string, verb: string): boolean {
  return rec.moments.includes(`${key}:${verb}`) || (SAME_AS_R6.has(key) && rec.moments.includes(`${key}:won`));
}

const MEDAL = ['Bronze', 'Silver', 'Gold'];
const STAGE_WORD = ['first', 'second', 'third'];

/** A mountain's board and what you hold of it. `runMedal`: your best whole-run medal there (0 to 3). */
export function masteryBoard(course: Course, mountainId: string, rec: MasteryRecord, runMedal: number): Star[] {
  const m = MOUNTAINS.findIndex((q) => q.id === mountainId);
  const stars: Star[] = MEDAL.map((name, i) => ({ key: `medal${i + 1}`, label: `${name} medal`, group: 'medal' as const, done: runMedal >= i + 1 }));
  for (const g of course.stageGates) stars.push({ key: `gate${g.id}`, label: `Fly the ${STAGE_WORD[g.stage] ?? ''} stage's sky gate`.replace('  ', ' '), group: 'gate', done: rec.gates.includes(g.id) });
  // Each set piece's verb beaten, in any of its variants (the board's line is its goal). A round 5 sweep, and a
  // round 6 win of a set piece that has changed since, are still in the save and claim nothing.
  for (const mq of planMarquee(course, mountainId)) stars.push({ key: `mq:${mq.key}`, label: `${mq.name}: ${mq.goal}`, group: 'moment', done: momentDone(rec, mq.key, mq.verb) });
  for (const r of ROSTER) if (r.home === m) stars.push({ key: `rider:${r.key}`, label: `Beat ${r.name} to the line`, group: 'rider', done: rec.riders.includes(r.key) });
  stars.push({ key: 'clean', label: 'Finish with no wipeout and no ward', group: 'clean', done: rec.clean });
  return stars;
}

/** What one run adds to a record. Returns the stars it earned now (their labels), in board order. */
/** Round 8, the rewards paced: a mountain's board opens a row a ride (its medals on the first ride, its sky gates on
 *  the second, its set pieces on the third, its home riders on the fourth, a clean finish on the fifth), so a first
 *  ride pays a star or two and the next four each open something new to take. A star counts only once its row is
 *  open; what a run did in a row still shut is not banked. `rides` (this ride included; the app reads it off the
 *  save's run times, which keep five) left out opens every row, as before round 8. */
export const MASTERY_ROWS: readonly Star['group'][] = ['medal', 'gate', 'moment', 'rider', 'clean'];

export function rowOpen(group: Star['group'], rides: number): boolean {
  return MASTERY_ROWS.indexOf(group) < Math.max(1, rides);
}

export function settleMastery(
  course: Course,
  mountainId: string,
  rec: MasteryRecord,
  run: {
    gates: readonly number[];
    moments: ReadonlyArray<{ key: string; took: number; total: number; clean: boolean; won?: boolean }>;
    /** Your finish time, seconds, or null for a run that did not finish. */
    time: number | null;
    /** Each home rider's time on the bundled pool (null: it did not finish). */
    riderTimes: ReadonlyMap<string, number | null>;
    clean: boolean;
  },
  medalBefore: number,
  medalNow: number,
  rides: number = MASTERY_ROWS.length,
): string[] {
  const before = new Set(masteryBoard(course, mountainId, rec, medalBefore).filter((s) => s.done).map((s) => s.key));
  if (rowOpen('gate', rides)) for (const g of run.gates) if (!rec.gates.includes(g)) rec.gates.push(g);
  const verbs = new Map(planMarquee(course, mountainId).map((mq) => [mq.key, mq.verb]));
  for (const mq of rowOpen('moment', rides) ? run.moments : []) {
    const token = `${mq.key}:${verbs.get(mq.key) ?? 'won'}`;
    if (mq.won && !rec.moments.includes(token)) rec.moments.push(token);
  }
  if (run.time !== null) {
    if (rowOpen('rider', rides)) for (const [key, t] of run.riderTimes) if ((t === null || run.time < t) && !rec.riders.includes(key)) rec.riders.push(key);
    if (run.clean && rowOpen('clean', rides)) rec.clean = true;
  }
  return masteryBoard(course, mountainId, rec, medalNow)
    .filter((s) => s.done && !before.has(s.key))
    .map((s) => s.label);
}
