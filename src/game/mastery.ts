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
  /** Set pieces: a key is one swept clean (round 5), a key with ":won" one whose verb was beaten (round 6). */
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

const MEDAL = ['Bronze', 'Silver', 'Gold'];
const STAGE_WORD = ['first', 'second', 'third'];

/** A mountain's board and what you hold of it. `runMedal`: your best whole-run medal there (0 to 3). */
export function masteryBoard(course: Course, mountainId: string, rec: MasteryRecord, runMedal: number): Star[] {
  const m = MOUNTAINS.findIndex((q) => q.id === mountainId);
  const stars: Star[] = MEDAL.map((name, i) => ({ key: `medal${i + 1}`, label: `${name} medal`, group: 'medal' as const, done: runMedal >= i + 1 }));
  for (const g of course.stageGates) stars.push({ key: `gate${g.id}`, label: `Fly the ${STAGE_WORD[g.stage] ?? ''} stage's sky gate`.replace('  ', ' '), group: 'gate', done: rec.gates.includes(g.id) });
  // Each set piece's verb beaten (its line on the card is the goal). A round 5 sweep is still in the save.
  for (const mq of planMarquee(course, mountainId)) stars.push({ key: `mq:${mq.key}`, label: `${mq.name}: ${mq.line}`, group: 'moment', done: rec.moments.includes(`${mq.key}:won`) });
  for (const r of ROSTER) if (r.home === m) stars.push({ key: `rider:${r.key}`, label: `Beat ${r.name} to the line`, group: 'rider', done: rec.riders.includes(r.key) });
  stars.push({ key: 'clean', label: 'Finish with no wipeout and no ward', group: 'clean', done: rec.clean });
  return stars;
}

/** What one run adds to a record. Returns the stars it earned now (their labels), in board order. */
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
): string[] {
  const before = new Set(masteryBoard(course, mountainId, rec, medalBefore).filter((s) => s.done).map((s) => s.key));
  for (const g of run.gates) if (!rec.gates.includes(g)) rec.gates.push(g);
  for (const mq of run.moments) if (mq.won && !rec.moments.includes(`${mq.key}:won`)) rec.moments.push(`${mq.key}:won`);
  if (run.time !== null) {
    for (const [key, t] of run.riderTimes) if ((t === null || run.time < t) && !rec.riders.includes(key)) rec.riders.push(key);
    if (run.clean) rec.clean = true;
  }
  return masteryBoard(course, mountainId, rec, medalNow)
    .filter((s) => s.done && !before.has(s.key))
    .map((s) => s.label);
}
