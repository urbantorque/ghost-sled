import type { ResultsNextUnlock } from '../ui/contract';
import { ChaosEvent } from '../sim/chaos';
import { MOUNTAINS, biomeForSeed } from '../sim/mountains';
import { SLEDS } from '../sim/sleds';
import { MissionCtx, MissionState, RunSummary, missionDef, missionProgressText, missionTier } from './missions';
import { isNemesis } from './settle';
import type { SaveData } from './save';

// Progress lines: mid-run mission pops, the next unlock, the title greeting, the Run Again label,
// the results race line, the friend line, the reveal's goal line and the challenge share title.
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

/** The one extra race line on the results card (C6 budget): friend, then grudge, then event note. */
export function resultsRaceLine(friendLine: string | null, grudgeLine: string | null, eventNote: string | null): { text: string; tone: 'friend' | 'grudge' | 'event' } | null {
  if (friendLine) return { text: friendLine, tone: 'friend' };
  if (grudgeLine) return { text: grudgeLine, tone: 'grudge' };
  if (eventNote) return { text: eventNote, tone: 'event' };
  return null;
}

/** The friend line on the results: "You beat Mila by 120 m." or "Mila is 340 m ahead." */
export function friendLine(name: string, friendDistance: number, youDistance: number): string {
  const gap = Math.round(youDistance - friendDistance);
  if (gap > 0) return `You beat ${name} by ${m(gap)}.`;
  return `${name} is ${m(Math.max(1, -gap))} ahead.`;
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
      return 'Outrun it: +2,000';
    case ChaosEvent.Yeti:
      return 'Hop it: +1,500';
    case ChaosEvent.GiftStorm:
      return 'Catch all 48';
    case ChaosEvent.GhostTrain:
      return 'Ride its slipstream';
    default:
      return null;
  }
}
