import type { ResultsNextUnlock } from '../ui/contract';
import { ChaosEvent } from '../sim/chaos';
import { MOUNTAINS, biomeForSeed, type BiomeId } from '../sim/mountains';
import { SLEDS } from '../sim/sleds';
import { MissionCtx, MissionResult, MissionState, RunSummary, missionDef, missionProgressText, missionTier } from './missions';
import { isNemesis } from './settle';
import type { SaveData } from './save';
import { type Standing, aheadOf, figure, marginPhrase } from './standing';

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

/** What a run pays in gifts by itself: 5 a stage line crossed and 15 more for the finish. Gifts are the meta
 *  currency since the lantern round: the course's own pickups are spirit lights, which pay the lantern, not
 *  the wallet. Passes, duels, missions, medals, the ladder and mastery pay the rest. */
export function runPay(sim: { stageTicks: readonly number[]; finished: boolean }): number {
  return sim.stageTicks.length * 5 + (sim.finished ? 15 : 0);
}

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
    out.push({ id: def.id, text: t.text, progress: done ? t.target : Math.min(best, t.target), target: t.target, dp: def.unit === 's' ? 1 : 0, reward: t.reward, done, justCompleted: done });
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
  const where = key.startsWith('daily') ? 'the Daily Mountain' : key.startsWith('cup') ? 'the Weekly Cup' : mountainName;
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

/**
 * The Run Again button's label and accessible name. It always names who is about to ride: an unbeaten
 * friend, else the grudge, else `next`, the rider the app has promised the next field (a rematch when
 * it rode this run, a race when it is new to you). 'Run Again' only with nobody to name.
 */
export function runAgainLabel(friend: { name: string; beaten: boolean } | null, grudge: { name: string } | null, next?: { name: string; rode: boolean } | null): { text: string; aria: string } {
  const name = friend && !friend.beaten ? friend.name : grudge ? grudge.name : '';
  if (name) return { text: `Rematch ${ellipsize(name)}`, aria: `Rematch ${name}, run again` };
  if (!next) return { text: 'Run Again', aria: 'Run Again' };
  const word = next.rode ? 'Rematch' : 'Race';
  return { text: `${word} ${ellipsize(next.name)}`, aria: `${word} ${next.name}, run again` };
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
  /** A rung this run just missed ('1.6 s from SparkleCedar and Rank 18.', ladder.ts rungHook). */
  rung?: string | null;
  /** A stage gold this run almost had ('0.4 s from gold in Stage 2.', ladder.ts goldHook). */
  gold?: string | null;
  /** What decided it against your rival ('You lost 2.1 s to Mila in Stage 2.'), and who that is. */
  decided?: { text: string; grudge: boolean; friend: boolean } | null;
  /** The Daily, when today's is still to ride (dailyHook). */
  dailyOpen?: string | null;
}

/**
 * The one extra race line on the results card (C6 budget), which is also where the next-run hook lives:
 * a hook takes this slot or gives way, and never stacks. A grudge line exists after almost every run
 * (any ghost that went further is elected), so it ranks by what it says: friend, then the Daily or Cup
 * medal, then a settled grudge or a nemesis, then a rung just missed and a stage gold almost had (the
 * reasons to go again now), then the crash line (why the place on the card is not the one the HUD
 * showed), the event note, what decided it against your rival (which says more than the plain grudge
 * line it stands in for), any other grudge line, and last the Daily still open today.
 */
export function resultsRaceLine(l: RaceLines): { text: string; tone: 'friend' | 'grudge' | 'event' | 'crash' | 'rung' | 'medal' } | null {
  if (l.friend) return { text: l.friend, tone: 'friend' };
  if (l.daily) return { text: l.daily, tone: 'event' };
  if (l.grudge && l.grudge.strong) return { text: l.grudge.text, tone: 'grudge' };
  if (l.rung) return { text: l.rung, tone: 'rung' };
  if (l.gold) return { text: l.gold, tone: 'medal' };
  if (l.crash) return { text: l.crash, tone: 'crash' };
  if (l.event) return { text: l.event, tone: 'event' };
  if (l.decided) return { text: l.decided.text, tone: l.decided.grudge ? 'grudge' : l.decided.friend ? 'friend' : 'rung' };
  if (l.grudge) return { text: l.grudge.text, tone: 'grudge' };
  if (l.dailyOpen) return { text: l.dailyOpen, tone: 'event' };
  return null;
}

/** The last hook: today's Daily, still open, and the streak riding on it. Null once you have ridden it. */
export function dailyHook(streak: number, riddenToday: boolean): string | null {
  if (riddenToday) return null;
  return streak >= 2 ? `Ride today's Daily to keep your ${streak} day streak.` : "Today's Daily is still open.";
}

/** "1st", "2nd", "23rd". */
function ordinal(n: number): string {
  const t = n % 100;
  const o = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th'}`;
}

/**
 * The crash line: your place as you fell and the ghosts that were behind you then but went further
 * ('You led at the crash. SparkleCedar and 2 more ghosts rode on past.'). Only a pass the HUD showed
 * is named: `past` lists the first `shown` of them in the order their 'passed you' played, then the
 * rest (the card opened before they reached the wreck, or reduced motion never waited), which are
 * counted. Two names at most; your own best reads 'Your best' (the caller names it so). Null when
 * nobody rode past: the place held.
 */
export function crashLine(rankAtCrash: number, past: readonly string[], shown: number): string | null {
  if (past.length === 0 || !(rankAtCrash >= 1)) return null;
  const where = rankAtCrash === 1 ? 'You led at the crash.' : `${ordinal(Math.floor(rankAtCrash))} at the crash.`;
  const named = past.slice(0, Math.max(0, Math.min(2, Math.floor(shown), past.length)));
  const rest = past.length - named.length;
  const ghosts = (n: number, more: boolean): string => `${n} ${more ? 'more ' : ''}${n === 1 ? 'ghost' : 'ghosts'}`;
  const who = named.length === 0 ? ghosts(rest, false) : rest === 0 ? named.join(' and ') : `${named.join(', ')} and ${ghosts(rest, true)}`;
  return `${where} ${who} rode on past.`;
}

/** The friend line on the results, in the race's terms: "You beat Mila by 1.2 s.", "Mila beat you by
 *  340 m.", "You beat Mila to the finish." The margin is the difference of the two rows as the race
 *  shows them, so the line and the rows agree; under a tenth or a metre it says so. */
export function friendLine(name: string, friend: Standing, you: Standing): string {
  if (aheadOf(you, friend)) return `You beat ${name} ${marginPhrase(you, friend)}.`;
  if (aheadOf(friend, you)) return `${name} beat you ${marginPhrase(friend, you)}.`;
  return `Dead level with ${name}.`;
}

/** The friend's run beaten: the callout on the friendBeaten beat ("Beat Mila's 2,340 m"). */
export function friendBeatenText(name: string, friend: Standing): string {
  return `Beat ${name}\u2019s ${figure(friend)}`;
}

/** Where a challenge was ridden, for copy: a Daily Mountain reads "the Daily Mountain". */
function placeName(mountain: string): string {
  return /^daily/i.test(mountain) ? 'the Daily Mountain' : mountain;
}

/**
 * The share sheet's title for a challenge link. With `by` (you beat a friend's challenge, marginPhrase's
 * words): addressed back to them, "Mila, I beat your 2:31.4 on Pinecrest by 1.2 s. Your move." `name`
 * is the friend and `run` theirs. Without: an open challenge for your own run, "Beat my 2:31.4 on
 * Pinecrest in Ghost Sled" (`name` unused, `run` yours).
 */
export function challengeShareTitle(name: string, run: Standing, mountain: string, by: string | null): string {
  const where = placeName(mountain);
  if (by !== null && name) return `${name}, I beat your ${figure(run)} on ${where} ${by}. Your move.`;
  if (run.time !== null || run.distance > 0) return `Beat my ${figure(run)} on ${where} in Ghost Sled`;
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
