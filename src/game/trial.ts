import { ChaosEvent, type ChaosRoll, Mood, eventAllowed } from '../sim/chaos';
import { eventsFor } from '../sim/course';
import { ALL_CHARMS, CHARMS, type CharmFamily } from '../sim/charms';
import { MOUNTAINS } from '../sim/mountains';
import { hash32, hashString } from '../sim/prng';
import type { Sim, SimConfig } from '../sim/sim';
import { cupChaos } from './cup';
import { clock } from './standing';

// Trials (round 8, G9's stretch): a weekly rule twist with its own medal. One Trial a week, derived from the ISO week
// key the way the Cup is, the same for everyone, so a friend's link and a ghost from the same week race the same
// rules. Where the Cup is a generated course raced against the clock in the week's mood, a Trial is one of the five
// named mountains given a twist a player reads in a second: mirrored or not, a sky of its own (a mood, its other
// hour, or an event), the charm gates dealing one family only, and a measure that is not always the clock (style
// points, perfect landings, spirit lights, or the line without a get-up).
//
// Nothing here reaches the sim but what a run can already be given (SimConfig: the mountain's seed, a chaos roll,
// the charm pool; the gates stand as they always do, three). The mirror is the input layer's (modes.ts), the hour the
// palette's, and the measure is judged by the game layer from the sim's own results at the line (TrialTally).
//
// The medal's three targets are set from the week's own field: riders of every pace ridden by the bot on the Trial
// itself (trialfield.ts, in the worker), each judged by the same rule as the player, the targets read off their spread
// (trialTargets). Nothing is tuned by hand per week.
//
// Pure: no DOM, render or audio imports.

/** What a Trial measures at the line: the clock, the clock without a get-up, style points or perfect landings. (Spirit
 *  lights, distinct tricks and set pieces won were tried and left out: the lab's expert takes a third of the field's
 *  lights, and tricks and set pieces gave every skilled rider the top of the field, so no medal told them apart.) */
export type TrialMeasure = 'time' | 'clean' | 'score' | 'perfects';
export const MEASURES: readonly TrialMeasure[] = ['time', 'perfects', 'clean', 'score'];

/** The sky a Trial is ridden under: one twist at most, so its name stays a few words. */
export type TrialSky = 'plain' | 'mood' | 'hour' | 'event';

export interface Trial {
  /** The ISO week, '2026-W48'. */
  week: string;
  seed: number;
  /** A named mountain's id (sim/mountains.ts MOUNTAINS). */
  mountain: string;
  mirror: boolean;
  sky: TrialSky;
  /** Ridden at the mountain's other hour (render only: palette.ts setHour). */
  hour: boolean;
  chaos: ChaosRoll;
  /** The one family the gates deal, or null for every charm. */
  family: CharmFamily | null;
  /** The charm pool the run is started with (SimConfig.charmPool). */
  charmPool: number;
  measure: TrialMeasure;
  /** "Mirrored Ember Peak in a Blizzard". */
  name: string;
  /** "Most perfect landings, survival charms only". */
  rule: string;
}

export function trialSeed(week: string): number {
  return hashString('ghost-sled-trial/' + week);
}

/** Weeks since 1970's first ISO week (from a 'YYYY-Www' key; 0 when it is not one): consecutive weeks are consecutive
 *  numbers, so the mountain and the measure can turn over week by week. */
export function weekIndex(week: string): number {
  const p = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!p) return 0;
  const y = Number(p[1]);
  // The Monday of week 1 is the Monday on or before 4 January.
  const jan4 = Date.UTC(y, 0, 4);
  const dow = new Date(jan4).getUTCDay() || 7;
  const monday = jan4 - (dow - 1) * 86400000 + (Number(p[2]) - 1) * 7 * 86400000;
  return Math.floor((monday - Date.UTC(1969, 11, 29)) / (7 * 86400000));
}

/** The days a week's Trial has left at a moment (ms), today counted: "4 days left", "Last day" (7 at most, 1 at
 *  least). Information only: nothing waits on it. */
export function daysLeftWords(week: string, now: number): string {
  const end = Date.UTC(1969, 11, 29) + (weekIndex(week) + 1) * 7 * 86400000;
  const days = Math.max(1, Math.min(7, Math.ceil((end - now) / 86400000)));
  return days === 1 ? 'Last day' : `${days} days left`;
}

const NAMES: Readonly<Record<string, string>> = { pinecrest: 'Pinecrest', frostfang: 'Frostfang', ember: 'Ember Peak', sakura: 'Sakura Ridge', lanternfall: 'Lanternfall' };
/** Each mountain's other hour after its name (almanac.ts HOUR_PHRASES). */
const HOURS: Readonly<Record<string, string>> = { pinecrest: 'at Dusk', frostfang: 'at Noon', ember: 'at Night', sakura: 'in the Evening', lanternfall: 'at First Light' };
const MOOD_WORDS: Readonly<Record<number, string>> = {
  [Mood.Blizzard]: 'in a Blizzard',
  [Mood.Lantern]: 'on a Lantern Night',
  [Mood.GlassIce]: 'on Glass Ice',
  [Mood.Comet]: 'under a Comet',
  [Mood.Powder]: 'on a Powder Day',
};
const EVENT_WORDS: Readonly<Record<number, string>> = {
  [ChaosEvent.Avalanche]: 'with an Avalanche',
  [ChaosEvent.Yeti]: 'with a Yeti Crossing',
  [ChaosEvent.GiftStorm]: 'in a Light Storm',
  [ChaosEvent.GhostTrain]: 'with the Spirit Train',
};
const MEASURE_WORDS: Readonly<Record<TrialMeasure, string>> = {
  time: 'Fastest to the line',
  clean: 'Fastest without a get-up',
  score: 'Most style points',
  perfects: 'Most perfect landings',
};
const FAMILIES: readonly CharmFamily[] = ['speed', 'style', 'survival'];
/** The mountains a Trial turns over: the five (round 8), and from EIGHT_FROM all eight, the three new ones after them (round
 *  9). Written out, not read off MOUNTAINS, so what a build registers never moves a week. */
export const FIVE_TURN: readonly string[] = ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall'];
export const EIGHT_TURN: readonly string[] = [...FIVE_TURN, 'gablefall', 'oldrun', 'gullhaven'];
/** The ISO week from which the Trial turns over all eight. Null until the commit that registers the last of the three
 *  new mountains sets it to a week after that build ships (the main lane's, at release): every week before it keeps the
 *  five's turn, so no Trial already ridden changes. */
export const EIGHT_FROM: string | null = null;
/** Where the eight's turn starts, chosen with EIGHT_FROM so its first week is not the last five week's mountain. */
export const EIGHT_START = 0;

/** The week's mountain, by its week index: the five's turn (2 a week, never the same twice running), then the eight's
 *  (3 a week, the same). */
export function trialMountainId(i: number): string {
  const from = EIGHT_FROM === null ? Infinity : weekIndex(EIGHT_FROM);
  return i >= from ? EIGHT_TURN[((((i - from) * 3 + EIGHT_START) % 8) + 8) % 8] : FIVE_TURN[(((i * 2) % 5) + 5) % 5];
}
const MOODS: readonly Mood[] = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];
const EVENTS: readonly ChaosEvent[] = [ChaosEvent.Avalanche, ChaosEvent.Yeti, ChaosEvent.GiftStorm, ChaosEvent.GhostTrain];

/** The Trial's start, said once in the HUD's one-line card: the measure ("Trial: Most perfect landings"), and the family
 *  dealt, or with every charm the twist's name. The mirror and the sky need no words there: the picture and the reveal
 *  card already say them. */
export function startWords(t: Trial): { text: string; sub: string } {
  return { text: `Trial: ${MEASURE_WORDS[t.measure]}`, sub: t.family ? `${t.family[0].toUpperCase()}${t.family.slice(1)} charms only` : t.name };
}

/** The charm pool of one family (the sim's 24-bit mask). */
export function familyPool(f: CharmFamily): number {
  let m = 0;
  for (const c of CHARMS) if (c.family === f) m |= 1 << c.id;
  return m >>> 0;
}

/**
 * The week's Trial: fixed, whoever rides and however often. The mountain turns over every week (never the same two
 * weeks running) and so does the measure, every four weeks the same order, out of step with the mountain; the mirror, the sky and the family are the week's
 * own draws. A Trial is never a second Cup: its mood is never the Cup's, and a week raced on the clock always has a
 * twist of its own as well (the mirror, a sky or one family).
 */
export function trialFor(week: string): Trial {
  const seed = trialSeed(week);
  const i = weekIndex(week);
  const mountain = trialMountainId(i);
  let measure = MEASURES[((i % 4) + 4) % 4];
  // (Round 9: the Old Run has no landings to stomp, so its perfect-landing week is a style week.)
  if (measure === 'perfects' && mountain === 'oldrun') measure = 'score';
  const mirror = (hash32(seed, 0x7e01) & 1) === 1;
  const s = hash32(seed, 0x7e02) % 20;
  let sky: TrialSky = s < 9 ? 'mood' : s < 13 ? 'event' : s < 17 ? 'hour' : 'plain';
  const f = hash32(seed, 0x7e03) % 6;
  let family: CharmFamily | null = f < 3 ? FAMILIES[f] : null;
  const clock = measure === 'time' || measure === 'clean';
  // (The clock alone on a plain mountain with every charm would be a Cup on a named course.)
  if (clock && !mirror && sky === 'plain' && !family) family = FAMILIES[hash32(seed, 0x7e04) % 3];
  // (A week without a get-up is a survival week: the speed family's Comet's Tail never wards, and with it the lab's mid
  // pilot finished clean in no ride of six.)
  if (measure === 'clean' && family === 'speed') family = 'survival';
  // A mood is never the Cup's, and the clock is never raced on Glass Ice: a third of the grip makes a clock week a draw
  // of who falls least (the lab's expert, who flies everything, beat a fifth of the field there and most of it
  // elsewhere). Glass Ice stays for the style weeks, where its drifts charge faster.
  const cup = cupChaos(week).mood;
  const moods = MOODS.filter((m) => m !== cup && !(clock && m === Mood.GlassIce));
  const mood = sky === 'mood' ? moods[hash32(seed, 0x7e05) % moods.length] : Mood.None;
  let event = sky === 'event' ? EVENTS[hash32(seed, 0x7e06) % EVENTS.length] : ChaosEvent.None;
  // (Round 9: an event the week's mountain cannot meet makes it a plain week.)
  const def = MOUNTAINS.find((m) => m.id === mountain);
  if (def && !eventAllowed(event, eventsFor(def.seed))) event = ChaosEvent.None;
  if (sky === 'event' && event === ChaosEvent.None) sky = 'plain';
  const chaos: ChaosRoll = { mood, event, seed: hash32(seed, 0x7e07) };
  const hour = sky === 'hour';
  // (Haunted Hollow is said before the name, "Mirrored Haunted Pinecrest"; every other sky after it.)
  const where = `${mirror ? 'Mirrored ' : ''}${mood === Mood.Haunted ? 'Haunted ' : ''}${NAMES[mountain]}`;
  const skyWords = sky === 'mood' ? (MOOD_WORDS[mood] ?? '') : sky === 'event' ? EVENT_WORDS[event] : sky === 'hour' ? HOURS[mountain] : '';
  const name = skyWords ? `${where} ${skyWords}` : where;
  const rule = `${MEASURE_WORDS[measure]}${family ? `, ${family} charms only` : ''}`;
  return { week, seed, mountain, mirror, sky, hour, chaos, family, charmPool: family ? familyPool(family) : ALL_CHARMS, measure, name, rule };
}

/** The mountain a Trial rides (sim/mountains.ts). */
export function trialMountain(t: Trial): (typeof MOUNTAINS)[number] {
  return MOUNTAINS.find((m) => m.id === t.mountain) ?? MOUNTAINS[0];
}

/** Everything a Trial's run hands the sim: the mountain's seed, the week's chaos, the sled ridden and the week's
 *  charm pool. The gates stand as on any run (three), and a Trial is never a first run or a leg of a night. */
export function trialConfig(t: Trial, sled: number): SimConfig {
  return { seed: trialMountain(t).seed, chaos: t.chaos, sled, charmPool: t.charmPool };
}

/** A Trial's run keeps its best under its own key, so its twist never stands on the mountain's ladder. */
export function trialKey(week: string): string {
  return `trial:${week}`;
}

export function isTrialKey(key: string): boolean {
  return key.startsWith('trial:');
}

// ---------------------------------------------------------------- judging a run

/** What a run did, as a Trial judges it: get-ups used (falls got up from) over the whole run, and at the line its
 *  time, its style points and its perfect landings (null until the line is crossed). */
export interface TrialTally {
  tumbles: number;
  line: { seconds: number; score: number; perfects: number } | null;
}

export function newTally(): TrialTally {
  return { tumbles: 0, line: null };
}

/** Called after every tick of a run (the live Run's onStep, a replay's callback): the same count either way. */
export function tallyStep(t: TrialTally, sim: Sim): void {
  for (const e of sim.events) if (e.type === 'tumble' && e.phase === 'start') t.tumbles++;
  if (!t.line && sim.finished) t.line = { seconds: sim.s.finishTick / 60, score: sim.score, perfects: sim.stats.perfects };
}

/** The run's figure on the week's measure, or null for a run that earns none (it did not finish, or a get-up was
 *  used on a Trial ridden without one). */
export function trialValue(m: TrialMeasure, t: TrialTally): number | null {
  const l = t.line;
  if (!l) return null;
  switch (m) {
    case 'time':
      return clockTenths(l.seconds);
    case 'clean':
      return t.tumbles === 0 ? clockTenths(l.seconds) : null;
    case 'score':
      return l.score;
    case 'perfects':
      return l.perfects;
  }
}

/** A time in the clock's own tenths (standing.ts clock: cut, not rounded), so the figure a Trial judges is the one the
 *  results show. */
function clockTenths(s: number): number {
  return Math.floor(s * 10 + 1e-6) / 10;
}

/** Lower is better on the clock. */
export function lowerBetter(m: TrialMeasure): boolean {
  return m === 'time' || m === 'clean';
}

/** a is at least as good as b on the measure. */
export function atLeast(m: TrialMeasure, a: number, b: number): boolean {
  return lowerBetter(m) ? a <= b : a >= b;
}

// ---------------------------------------------------------------- the medal

/** Bronze, silver and gold, in the measure's own units (seconds or a count), easiest first. */
export type TrialTargets = readonly [number, number, number];

/** Where each measure's targets sit in the week's field: bronze, silver and gold are each the figure that beats this
 *  share of the field's runs that earn one. One rule a measure, set once from the lab (the mid and expert pilots
 *  ridden over twenty weeks, scripts/playtest/r8-trials-calib.ts), never by the week: the bot races the clock
 *  harder than a person and lands fewer perfects, so a share of the field means a different thing on each. */
export const TRIAL_PCT: Readonly<Record<TrialMeasure, readonly [number, number, number]>> = {
  time: [0.3, 0.5, 0.7],
  clean: [0.2, 0.4, 0.6],
  score: [0.22, 0.5, 0.8],
  perfects: [0.45, 0.7, 0.9],
};
/** The least step between two medals: a second on the clock, a tenth of the bronze's points, one of a count. */
const GAP_S = 1;

/** The value a share p of a sorted list sits at, between its neighbours. */
function pctAt(xs: readonly number[], p: number): number {
  const i = p * (xs.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(xs.length - 1, lo + 1);
  return xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
}

/** The medal's targets from the field's figures (null where a run earned none), or null with fewer than three to read.
 *  Ordered and apart: gold is always over silver and silver over bronze, by at least a step. */
export function trialTargets(m: TrialMeasure, values: readonly (number | null)[]): TrialTargets | null {
  const xs = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (xs.length < 3) return null;
  if (lowerBetter(m)) {
    // Slowest first: a share p of the field is beaten by the time at 1 - p of the way from the fastest.
    const s = [...xs].sort((a, b) => a - b);
    const at = (p: number): number => Math.round(pctAt(s, 1 - p) * 10) / 10;
    const [pb, ps, pg] = TRIAL_PCT[m];
    const b = at(pb);
    const sv = Math.min(b - GAP_S, at(ps));
    const g = Math.min(sv - GAP_S, at(pg));
    return [b, sv, g];
  }
  const s = [...xs].sort((a, b) => a - b);
  const round = m === 'score' ? (v: number): number => Math.round(v / 10) * 10 : (v: number): number => Math.ceil(v);
  const [pb, ps, pg] = TRIAL_PCT[m];
  const b = Math.max(1, round(pctAt(s, pb)));
  const step = m === 'score' ? Math.max(10, round(b * 0.1)) : 1;
  const sv = Math.max(b + step, round(pctAt(s, ps)));
  const g = Math.max(sv + step, round(pctAt(s, pg)));
  return [b, sv, g];
}

/** The medal a figure earns (0 none, 1 bronze, 2 silver, 3 gold). */
export function trialMedal(m: TrialMeasure, value: number | null, t: TrialTargets): number {
  if (value === null) return 0;
  let medal = 0;
  for (let i = 0; i < 3; i++) if (atLeast(m, value, t[i])) medal = i + 1;
  return medal;
}

// ---------------------------------------------------------------- words

const MEDAL_NAMES = ['', 'Bronze', 'Silver', 'Gold'] as const;

/** A figure in its measure's words: "2:03.5", "182,410 points", "16 perfects". */
export function figureText(m: TrialMeasure, v: number): string {
  if (lowerBetter(m)) return clock(v);
  if (m === 'score') return `${Math.round(v).toLocaleString('en-US')} points`;
  return `${Math.round(v)} ${Math.round(v) === 1 ? 'perfect' : 'perfects'}`;
}

/** A figure bare, where the rule beside it names the measure: "2:03.5", "182,410", "16". */
export function figureShort(m: TrialMeasure, v: number): string {
  return lowerBetter(m) ? clock(v) : Math.round(v).toLocaleString('en-US');
}

/** How far a figure is from a target, in a few words ("1.3 s faster", "2 more", "3,400 more"); '' once it is met. */
export function shortOf(m: TrialMeasure, v: number, target: number): string {
  if (atLeast(m, v, target)) return '';
  // (Read to the hundredth first, so 123.4 against 120 is 3.4, not the float's 3.4000001 rounded up.)
  if (lowerBetter(m)) return `${(Math.ceil(Math.round((v - target) * 100) / 10) / 10).toFixed(1)} s faster`;
  const d = Math.round(target - v);
  return `${d.toLocaleString('en-US')} more`;
}

/** The run's own figure as a line says it after a medal: "in 2:01.0", "with 16 perfects", "with 132,223 points". */
function withFigure(m: TrialMeasure, v: number): string {
  return `${lowerBetter(m) ? 'in' : 'with'} ${figureText(m, v)}`;
}

/**
 * The results' line for a Trial's run (Details and the race line), which medal with the run's own figure, then the next
 * and how far: "Trial: Silver with 16 perfects. Gold at 18 perfects, 2 more.", "Trial: Gold in 1:57.0.", "Trial: 4
 * perfects. Bronze at 13 perfects, 9 more." With no figure the run did not finish, or a get-up was used on a week
 * ridden without one.
 */
export function trialLine(t: Trial, medal: number, targets: TrialTargets, value: number | null, tumbles = 0): string {
  if (medal >= 3) return value === null ? 'Trial: Gold.' : `Trial: Gold ${withFigure(t.measure, value)}.`;
  const next = targets[medal];
  const at = `${MEDAL_NAMES[medal + 1]} at ${figureText(t.measure, next)}`;
  if (value === null) return `Trial: ${at}. ${t.measure === 'clean' && tumbles > 0 ? 'Ride it without a get-up.' : 'Finish to take a medal.'}`;
  const head = medal > 0 ? `Trial: ${MEDAL_NAMES[medal]} ${withFigure(t.measure, value)}. ${at}` : `Trial: ${figureText(t.measure, value)}. ${at}`;
  const short = shortOf(t.measure, value, next);
  return short ? `${head}, ${short}.` : `${head}.`;
}

/** What a Trial's results lead with: the run's own figure (bare, "132,223", "1:57.0", "16") and its unit ("points",
 *  "perfects", none on the clock), the words under it ("Silver in the Trial", null with no medal), and the fact under
 *  those, how far from the next medal ("56,727 short of gold", "2.0 s off gold", "1.9 s inside gold") or why there is
 *  none; null where there is nothing more to say (gold on a count). */
export interface TrialMomentView {
  figure: string | null;
  unit: string;
  word: string | null;
  fact: string | null;
}

/**
 * The results' moment for a Trial's run: the Trial is the headline, so the figure is the run's figure on the week's
 * measure, not its place (the race still stands in the place line and Details), said short enough for a phone.
 */
export function trialMoment(t: Trial, medal: number, targets: TrialTargets, value: number | null, tumbles = 0): TrialMomentView {
  const word = medal > 0 ? `${MEDAL_NAMES[medal]} in the Trial` : null;
  const unit = t.measure === 'score' ? 'points' : t.measure === 'perfects' ? (value === 1 ? 'perfect' : 'perfects') : '';
  if (value === null) return { figure: null, unit: '', word, fact: t.measure === 'clean' && tumbles > 0 ? 'A get-up used: no medal' : 'Finish to take a medal' };
  const figure = figureShort(t.measure, value);
  const tenths = (s: number): string => (Math.round(s * 10) / 10).toFixed(1);
  if (medal >= 3) return { figure, unit, word, fact: lowerBetter(t.measure) ? `${tenths(targets[2] - value)} s inside gold` : null };
  const next = targets[medal];
  const name = MEDAL_NAMES[medal + 1].toLowerCase();
  if (lowerBetter(t.measure)) return { figure, unit, word, fact: `${(Math.ceil(Math.round((value - next) * 100) / 10) / 10).toFixed(1)} s off ${name}` };
  return { figure, unit, word, fact: `${Math.round(next - value).toLocaleString('en-US')} short of ${name}` };
}

/** The HUD's stage line in a Trial: the next medal this run can still take ("Gold under 2:03.5", "9 of 13 perfects for
 *  Bronze", "Silver at 122,110"), or what the run has taken ("Gold taken"). A get-up on a week without one: "Used a
 *  get-up: no medal". */
export function stageWords(t: Trial, targets: TrialTargets, now: { seconds: number; score: number; perfects: number; tumbles: number }): string {
  const m = t.measure;
  if (m === 'clean' && now.tumbles > 0) return 'A get-up used: no medal';
  if (lowerBetter(m)) {
    // The best medal the clock still allows.
    for (let i = 2; i >= 0; i--) if (now.seconds <= targets[i]) return `${MEDAL_NAMES[i + 1]} under ${clock(targets[i])}`;
    return 'Past the bronze time';
  }
  const v = m === 'score' ? now.score : now.perfects;
  let got = 0;
  for (let i = 0; i < 3; i++) if (v >= targets[i]) got = i + 1;
  if (got >= 3) return 'Gold reached';
  const next = targets[got];
  return m === 'perfects' ? `${Math.round(v)} of ${next} perfects for ${MEDAL_NAMES[got + 1]}` : `${MEDAL_NAMES[got + 1]} at ${Math.round(next).toLocaleString('en-US')}`;
}

// ---------------------------------------------------------------- the save

/** One week's Trial as the save keeps it: the medal held (never lowered) and the best figure on its measure. */
export interface TrialSave {
  medal: number;
  best?: number;
}

/** Weeks of Trials a save keeps (a year): a medal is the week's, kept after the week has gone. */
export const TRIAL_WEEKS = 53;

/** The save's Trials, read safely: week keys only, a medal 0 to 3, a finite best; the latest TRIAL_WEEKS kept; null
 *  when nothing is held (the field is written only once a Trial has been ridden). */
export function readTrials(v: unknown): Record<string, TrialSave> | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const out: Record<string, TrialSave> = {};
  const keys = Object.keys(v).filter((k) => /^\d{4}-W\d{2}$/.test(k)).sort().slice(-TRIAL_WEEKS);
  for (const k of keys) {
    const r = (v as Record<string, unknown>)[k];
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    const medal = typeof o.medal === 'number' && Number.isFinite(o.medal) ? Math.max(0, Math.min(3, Math.floor(o.medal))) : 0;
    const s: TrialSave = { medal };
    if (typeof o.best === 'number' && Number.isFinite(o.best) && o.best > 0) s.best = o.best;
    if (s.medal > 0 || s.best !== undefined) out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

/** This week's Trial medal held (0 none). */
export function trialMedalNow(trials: Record<string, TrialSave> | undefined, week: string): number {
  return trials?.[week]?.medal ?? 0;
}

export interface TrialOutcome {
  /** This run's medal, and the week's best medal before and after it. */
  medal: number;
  was: number;
  best: number;
  value: number | null;
  line: string;
  /** The results' moment (trialMoment). */
  moment: TrialMomentView;
}

/**
 * Credits a Trial's run to its week: the medal never goes down and the best figure only improves. Pure in the save's
 * Trials and the medal held before the run, so a revive's second settle of the same run gives the same answer.
 */
export function settleTrial(d: { trials?: Record<string, TrialSave> }, t: Trial, tally: TrialTally, targets: TrialTargets, was: number): TrialOutcome {
  const value = trialValue(t.measure, tally);
  const medal = trialMedal(t.measure, value, targets);
  const prior = d.trials?.[t.week];
  const rec: TrialSave = { medal: Math.max(prior?.medal ?? 0, was, medal) };
  const best = prior?.best;
  if (value !== null && (best === undefined || atLeast(t.measure, value, best))) rec.best = value;
  else if (best !== undefined) rec.best = best;
  if (rec.medal > 0 || rec.best !== undefined) {
    const all = { ...(d.trials ?? {}), [t.week]: rec };
    d.trials = readTrials(all) ?? undefined;
    if (!d.trials) delete d.trials;
  }
  return { medal, was, best: rec.medal, value, line: trialLine(t, medal, targets, value, tally.tumbles), moment: trialMoment(t, medal, targets, value, tally.tumbles) };
}
