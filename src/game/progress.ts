import type { ResultsNextUnlock } from '../ui/contract';
import { ChaosEvent } from '../sim/chaos';
import { MOUNTAINS, biomeForSeed, type BiomeId } from '../sim/mountains';
import { SLEDS } from '../sim/sleds';
import { MissionCtx, MissionResult, MissionState, RunSummary, missionDef, missionProgressText, missionTier } from './missions';
import { isNemesis } from './settle';
import type { SaveData } from './save';

// Progress lines: mid-run mission pops and the pause card's live missions, the next unlock, the title
// greeting, the Run Again label, the results race line, the crash line, the friend line, the reveal's
// goal line and the challenge share title.
//
// Pure: no DOM, render or audio imports. Copy rules: names only (handles carry no pronouns), every
// number carries its label, no em dashes.

export type { MissionCtx };

const NF = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num = (v: number): string => NF.format(Math.round(v));
const m = (v: number): string => `${num(v)} m`;

/**
 * Missions newly met mid-run that have not popped yet, judged on the run so far against the mission
 * state the run started with (after a revive, the settlement's missionsBefore, never the refilled
 * list). Biome missions count only on their biome. Display only: settleRun credits the gifts.
 * The director passes a summary whose ghostsPassed is min(passedThisRun, shownPasses).
 */
export function missionsCrossed(s: MissionState, sum: RunSummary, popped: ReadonlySet<string>, ctx: MissionCtx): Array<{ id: string; text: string; reward: number }> {
  const out: Array<{ id: string; text: string; reward: number }> = [];
  for (const a of s.active) {
    if (popped.has(a.id)) continue;
    const def = missionDef(a.id);
    if (!def) continue;
    if (def.biome && (def.biome !== sum.biome || !ctx.unlockedBiomes.has(def.biome))) continue;
    const t = missionTier(def, a.tier);
    if (def.metric(sum) >= t.target) out.push({ id: a.id, text: t.text, reward: t.reward });
  }
  return out;
}

/**
 * The active missions as the run stands now (the pause card), in missionViews order, judged as
 * missionsCrossed judges them: each one's progress is the better of its stored best and this run so
 * far (a biome mission counts only on its biome), and it is done once it reaches its target or has
 * popped this run. Display only: settleRun credits the gifts.
 */
export function liveMissionViews(s: MissionState, sum: RunSummary, ctx: MissionCtx, popped: ReadonlySet<string>): MissionResult[] {
  const out: MissionResult[] = [];
  for (const a of s.active) {
    const def = missionDef(a.id);
    if (!def) continue;
    const t = missionTier(def, a.tier);
    const applies = !def.biome || (def.biome === sum.biome && ctx.unlockedBiomes.has(def.biome));
    const best = Math.max(a.best, applies ? def.metric(sum) : 0);
    const done = best >= t.target || popped.has(a.id);
    out.push({ id: def.id, text: t.text, progress: done ? t.target : Math.min(best, t.target), target: t.target, reward: t.reward, done, justCompleted: done });
  }
  return out;
}

/** The next unlock to work toward: the next mountain by lifetime ghosts passed, then the cheapest
 *  sled you do not own (gifts to go, 0 once affordable), then null. */
export function nextUnlock(d: SaveData): ResultsNextUnlock | null {
  const mtn = [...MOUNTAINS].sort((a, b) => a.unlockGhosts - b.unlockGhosts).find((x) => x.unlockGhosts > d.ghostsPassed);
  if (mtn) return { kind: 'mountain', name: mtn.name, biome: biomeForSeed(mtn.seed), have: Math.max(0, d.ghostsPassed), need: mtn.unlockGhosts };
  const sled = SLEDS.filter((s) => !d.ownedSleds.includes(s.id) && s.price > 0).sort((a, b) => a.price - b.price)[0];
  if (sled) return { kind: 'sled', name: sled.name, gifts: Math.max(0, sled.price - d.gifts) };
  return null;
}

/**
 * Ghosts passed counting this run as it goes (for the mid-run unlock pop): the lifetime count plus
 * this run's passes that no settlement has credited yet (a revive's first settle already did). Jostle
 * and wreck passes count, as they do when the run settles.
 */
export function livePassed(lifetime: number, passedThisRun: number, settledPassed: number): number {
  return lifetime + Math.max(0, passedThisRun - settledPassed);
}

/** The mountain a live pass count just opened (its unlockGhosts in (before, now]), or null. */
export function unlockCrossed(before: number, now: number): { id: string; name: string; biome: BiomeId } | null {
  if (now <= before) return null;
  const mtn = [...MOUNTAINS].sort((a, b) => a.unlockGhosts - b.unlockGhosts).find((x) => x.unlockGhosts > before && x.unlockGhosts <= now);
  return mtn ? { id: mtn.id, name: mtn.name, biome: biomeForSeed(mtn.seed) } : null;
}

/** The raceNews 'unlockTease' line once a pass leaves one ghost to go, else null. */
export function unlockTease(live: number): string | null {
  const mtn = [...MOUNTAINS].sort((a, b) => a.unlockGhosts - b.unlockGhosts).find((x) => x.unlockGhosts > live);
  return mtn && mtn.unlockGhosts - live === 1 ? `1 more ghost opens ${mtn.name}` : null;
}

/**
 * The results event note for a rolled event the run never reached (it ended at phase 0): "The yeti
 * was 220 m away." Feeds resultsRaceLine at event priority. Null for no event or no distance left.
 */
export function eventNote(event: ChaosEvent, metresAway: number): string | null {
  const what =
    event === ChaosEvent.Avalanche ? 'The avalanche' : event === ChaosEvent.Yeti ? 'The yeti' : event === ChaosEvent.GiftStorm ? 'The gift storm' : event === ChaosEvent.GhostTrain ? 'The Spirit Train' : null;
  const away = Math.round(metresAway);
  return what && away >= 1 ? `${what} was ${m(away)} away.` : null;
}

/**
 * A one-line title greeting for a returning player, or null. First match wins: a grudge waiting on
 * this mountain (a nemesis says so), the next mountain when 2 ghosts or fewer open it, then the
 * closest open mission with how far along it is. `key` is the mountain's save key (a Daily Mountain
 * is `daily:<day>`).
 */
export function titleGreeting(d: SaveData, key: string, mountainName: string): string | null {
  if (d.runs <= 0) return null;
  const where = key.startsWith('daily') ? 'the Daily Mountain' : mountainName;
  const g = d.grudge[key];
  if (g && g.name && g.record) return isNemesis(g) ? `Your nemesis ${g.name} is waiting on ${where}` : `${g.name} is waiting on ${where}`;
  const u = nextUnlock(d);
  if (u && u.kind === 'mountain' && u.need - u.have <= 2) {
    const left = u.need - u.have;
    return `${left} more ${left === 1 ? 'ghost opens' : 'ghosts open'} ${u.name}`;
  }
  let best: { text: string; frac: number } | null = null;
  for (const a of d.missions.active) {
    const def = missionDef(a.id);
    if (!def) continue;
    const t = missionTier(def, a.tier);
    const frac = t.target > 0 ? Math.min(1, a.best / t.target) : 0;
    if (frac >= 1) continue;
    if (!best || frac > best.frac) best = { text: frac > 0 ? `${t.text}: ${missionProgressText(def, a.best, t.target)}` : t.text, frac };
  }
  return best ? best.text : null;
}

/** Names longer than this are ellipsized on the button (the accessible name keeps the whole name). */
const LABEL_NAME_MAX = 12;

export function ellipsize(name: string, max = LABEL_NAME_MAX): string {
  const chars = [...name];
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : name;
}

/** The Run Again button's label and accessible name: an unbeaten friend, else the grudge, by name. */
export function runAgainLabel(friend: { name: string; beaten: boolean } | null, grudge: { name: string } | null): { text: string; aria: string } {
  const name = friend && !friend.beaten ? friend.name : grudge ? grudge.name : '';
  if (!name) return { text: 'Run Again', aria: 'Run Again' };
  return { text: `Rematch ${ellipsize(name)}`, aria: `Rematch ${name}, run again` };
}

/** What may fill the results card's one race line. */
export interface RaceLines {
  /** 'You beat Mila by 120 m.' (a friend's challenge on this mountain). */
  friend: string | null;
  /** The Daily medal line, on a Daily run only ('Daily: Bronze. Silver at 2,916 m.'). */
  daily?: string | null;
  /** The grudge settlement's line; strong when it settled ('Grudge settled with Mila.') or names a
   *  nemesis ('... 3 runs running. Nemesis.'). */
  grudge: { text: string; strong: boolean } | null;
  /** Where you stood at the crash and who rode on past your wreck (crashLine). */
  crash?: string | null;
  /** An event the run never reached ('The yeti was 130 m away.'). */
  event: string | null;
}

/**
 * The one extra race line on the results card (C6 budget). A grudge line exists after almost every
 * run (any ghost that went further is elected), so it ranks by what it says: friend, then the Daily
 * medal, then a settled grudge or a nemesis, then the crash line (why the place on the card is not
 * the one the HUD showed), then the event note, then any other grudge line.
 */
export function resultsRaceLine(l: RaceLines): { text: string; tone: 'friend' | 'grudge' | 'event' | 'crash' } | null {
  if (l.friend) return { text: l.friend, tone: 'friend' };
  if (l.daily) return { text: l.daily, tone: 'event' };
  if (l.grudge && l.grudge.strong) return { text: l.grudge.text, tone: 'grudge' };
  if (l.crash) return { text: l.crash, tone: 'crash' };
  if (l.event) return { text: l.event, tone: 'event' };
  if (l.grudge) return { text: l.grudge.text, tone: 'grudge' };
  return null;
}

/** "1st", "2nd", "23rd". */
function ordinal(n: number): string {
  const t = n % 100;
  const o = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th'}`;
}

/**
 * The crash line: your place as you fell and the ghosts that were behind you then but went further
 * ('You led at the crash. SparkleCedar and RidgeUlla rode on past.', '2nd at the crash. 3 ghosts
 * rode on past.'). Two names at most, in the order they reached the wreck, then a count; your own
 * best reads 'Your best' (the caller names it so). Null when nobody rode past: the place held.
 */
export function crashLine(rankAtCrash: number, past: readonly string[]): string | null {
  if (past.length === 0 || !(rankAtCrash >= 1)) return null;
  const where = rankAtCrash === 1 ? 'You led at the crash.' : `${ordinal(Math.floor(rankAtCrash))} at the crash.`;
  const who = past.length === 1 ? past[0] : past.length === 2 ? `${past[0]} and ${past[1]}` : `${past.length} ghosts`;
  return `${where} ${who} rode on past.`;
}

/** The friend line on the results: "You beat Mila by 120 m." or "Mila beat you by 340 m." The margin
 *  is the difference of the two rows as the race shows them (whole metres each), so the line and the
 *  rows agree; under 1 m it says so. */
export function friendLine(name: string, friendDistance: number, youDistance: number): string {
  const gap = Math.round(youDistance) - Math.round(friendDistance);
  const by = (v: number): string => (v >= 1 ? m(v) : 'less than 1 m');
  if (youDistance > friendDistance) return `You beat ${name} by ${by(gap)}.`;
  return `${name} beat you by ${by(-gap)}.`;
}

/** The friend's run, crossed alive: the callout on the friendBeaten beat. */
export function friendBeatenText(name: string, distance: number): string {
  return `Beat ${name}\u2019s ${m(distance)}`;
}

/** Where a challenge was ridden, for copy: a Daily Mountain reads "the Daily Mountain". */
function placeName(mountain: string): string {
  return /^daily/i.test(mountain) ? 'the Daily Mountain' : mountain;
}

/**
 * The share sheet's title for a challenge link. With `by` (you beat a friend's challenge): addressed
 * back to them, "Mila, I beat your 2,340 m on Pinecrest by 120 m. Your move." `name` is the friend and
 * `distance` their run. Without: an open challenge for your own run, "Beat my 2,340 m on Pinecrest
 * in Ghost Sled" (`name` unused, `distance` yours).
 */
export function challengeShareTitle(name: string, distance: number, mountain: string, by: number | null): string {
  const where = placeName(mountain);
  if (by !== null && name) return `${name}, I beat your ${m(distance)} on ${where} by ${m(Math.max(1, by))}. Your move.`;
  if (distance > 0) return `Beat my ${m(distance)} on ${where} in Ghost Sled`;
  return 'Beat my Ghost Sled run';
}

/** The reveal card's goal line for the rolled event: what it pays and how. */
export function revealGoal(event: ChaosEvent): string | null {
  switch (event) {
    case ChaosEvent.Avalanche:
      return 'Outrun it: +2,000 style';
    case ChaosEvent.Yeti:
      return 'Hop it: +1,500 style';
    case ChaosEvent.GiftStorm:
      return 'Catch all 48 gifts';
    case ChaosEvent.GhostTrain:
      return 'Ride its slipstream';
    default:
      return null;
  }
}
