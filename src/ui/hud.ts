import type { GhostKind, HudModel, MirrorRect, ScreenRect, StyleTone, UIHandlers } from './contract';
import { ChaosEvent, eventInfo, Mood, moodInfo } from '../sim/chaos';
import { btn, Flag, h, Layer, sr, Txt, type Ctx } from './dom';
import { kindCls, NBSP, ordinal } from './fmt';
import { icon, type IconName } from './icons';
import { bump, EASE_OUT, play, reduced, SPRING } from './motion';
import { EVENT_ICON } from './notices';

// In-run HUD. updateHud runs every frame: nodes are built once and each value is diffed, so a
// frame where nothing changed touches no DOM at all. The top-centre stack is two tiers at most: the
// race row (rank and next ghost, where passes flash), then the combo meter with the one trick callout
// slot under it. During an avalanche chase the mirror unit hangs right under the race row, high in the
// sky above the rider (the combo meter and callout slot move under it), so the horizon and the sun
// stay open. On a phone held upright the chase's meter takes the rival pill's place in the race row
// and the mirror hangs under it alone, so the stack stays short. The centre of the screen stays empty.
//
// The rival pill is also where the race talks: a pass flashes its word and the name ("DOUBLE PASS
// Mika", "SLUNG PAST Mika"), being passed is a quiet "Mika PASSED YOU", race news is a quieter line
// with the name in its kind colour ("Tess wiped out"), the start-line call names who to chase
// ("REMATCH Mila", 2.6 s, with a ring), and an open duel reads "DUEL Mika" over its gap. One flash at a
// time: the landing stamp and a banner over the row hold them all, a pass beats news and the call, and
// news is dropped first. A duel and then its result (for DUEL_HOLD_MS) keep the pill on the duel ghost:
// other ghosts' words take the callout line under the combo meter.
// Under the combo timer a small line names the one number at stake ("4,960 AT STAKE"); it turns
// gold-white on your best combo's pace and throbs like a fuse while a big stake drains (the figure keeps
// the fuse's amber on pace). The fuse is on the meter itself too: the timer's fill turns amber and the
// multiplier chip throbs on the stake's beat. In the flow, the multiplier chip wears a vermillion ring
// and a "Flow" tag until the combo ends. The score waits for a cash-in's figure to land before it
// counts the bank. Top left, "Best in 240 m" counts down to your best in gold-white, and a rolled event
// counts down in its own chip beside the mood chip ("Avalanche in 380 m"), coloured by its role.

const CHEVRONS = 5;
/**
 * The avalanche meter's scale: the wall's fill runs in proportion from the hazard disc (a gap this
 * large or more) to the rider badge (caught), so the bar reads without the number. It starts 45 m back.
 */
const DANGER_FAR = 64;
/** Under this gap the meter throbs and the mirror's rim pulses in a dark hazard tone. */
const DANGER_URGENT = 25;
/**
 * Urgency bands for the avalanche unit: the mirror's ring and the wall's icy front pulse faster and
 * glow brighter in each band down (style.css maps data-band to the beat), so 41 m and 15 m look
 * different without reading the digits. Bands, not a continuous rate: a CSS animation whose duration
 * changes every metre jumps phase every metre. From band 4 the rim turns dark, and in band 5 the
 * bottom edge of the screen darkens a little as well.
 */
const DANGER_BANDS = [60, 44, 32, DANGER_URGENT, 12];
const EDGE_BAND = 5;
/** Metres between the meter's tick marks. */
const TICK_M = 10;
/** The mirror's rect outlives the chase by the world's fade-out, and goes out with the telegraph. */
const MIRROR_HOLD_MS = 900;
const WARN_HOLD_MS = 4500;
/** How long a pass takes over the next-ghost pill. */
const FLASH_MS = 1300;
/** Being passed is quieter and shorter than a pass you make. */
const LOST_MS = 1000;
/**
 * A pass waiting its turn (behind a perfect-landing stamp, or "passed you" behind a pass of yours)
 * goes stale after this long: by then the standings have moved on.
 */
const PEND_MS = 2600;
/** A pass flash this young when a stamp lands steps back and plays after it (one message per beat). */
const REQUEUE_MS = 450;
/** How long a place change shows its arrow and count after the numeral. */
const DELTA_MS = 1300;
/** A rank change shows once it has held this long; rank ticks animate at most this often. */
export const RANK_SETTLE_MS = 180;
/**
 * The drift and slipstream pills fade out over 160 ms (style.css): their rects stay in the occluders
 * this long after they go, so a ghost's tag or the edge chip never slides onto a pill still drawn.
 */
export const PILL_FADE_MS = 180;
const TICK_GAP_MS = 500;
/** A gained place turns its numeral mint once the pill's flash thins, for this long (the colour snaps). */
const GAIN_DELAY_MS = 200;
const GAIN_MS = 800;
/** A chain, a sling or a duel result flashes a little longer than a plain pass. */
const STRONG_MS = 1500;
/** Race news is a quiet line for this long, and is stale (dropped) once it has waited this long. */
const NEWS_MS = 1300;
const NEWS_PEND_MS = 1300;
/** The start-line call holds the pill this long, its ring pulsing at the C11 marker's 1.2 Hz. */
const CALL_MS = 2600;
const RING_HZ_MS = 833;
/** The same duel result arriving twice (its pass and its duel beat) shows once within this window. */
const SAME_MS = 2000;
/** The lead beat's crown pulse waits this long at most for the place pill to show first place. */
const LEAD_WAIT_MS = 2000;
/** The score flashes gold-white this long on a mid-run New best. */
const BEST_FLASH_MS = 600;
/** A snuffed flow's ring and tag go grey, then fade out over this long. */
export const FLOW_SNUFF_MS = 150;
/**
 * A duel's result keeps the pill this long, as the director keeps out.rival, the C11 ring and the edge
 * chip on the duel ghost (RIVAL_HOLD_S): another ghost's word meanwhile goes to the callout line.
 */
export const DUEL_HOLD_MS = 1500;
/**
 * A duel's result that has not shown this long after the duel ended is stale and dropped. It waits out
 * a banner over the race row (it shows about 2.2 s on), or two back to back (GRUDGE SETTLED, then a
 * mountain unlocked: about 5 s on), never a longer chain ("Held off Brave Rhea" cut at 141 and 102 ms
 * by banner after banner, then played 6 s after the duel, far from its moment).
 */
export const RESULT_STALE_MS = 5500;
/** Slung passes this close together are one slingshot burst (the director counts slungN over 90 ticks). */
const SLUNG_BURST_MS = 1500;
/** The side line's key for a slingshot burst: a newer "Slung past 3" replaces "Slung past 2" in place. */
export const SLUNG_KEY = '\u0000slung';
/** News lines' side-line keys start with this (newsKey). */
const NEWS_KEY = 'news\u0000';
/**
 * The gap number changes only once the gap is a metre from the shown number, and each number holds at
 * least GAP_DWELL_MS (C12): the race maths' half-metre jitter never shimmers "13 m" and "14 m".
 */
export const GAP_HOLD_M = 1;
export const GAP_DWELL_MS = 250;
/**
 * At a run's start the tracks come ready one by one ("1st of 2", "of 4", "of 6" inside half a second):
 * the place pill shows once the field's count has held OF_STABLE_MS, or OF_WAIT_MS after it first
 * came, so its first numbers are the field's. On a busy machine the tracks come ready over most of a
 * second, so the wait is a little longer than one burst.
 */
export const OF_STABLE_MS = 350;
export const OF_WAIT_MS = 1000;

/** Short names for the countdown chip ("Yeti in 380 m", not "Yeti Crossing in 380 m"). */
const EVENT_SHORT: Record<ChaosEvent, string> = {
  [ChaosEvent.None]: '',
  [ChaosEvent.Avalanche]: 'Avalanche',
  [ChaosEvent.Yeti]: 'Yeti',
  [ChaosEvent.GiftStorm]: 'Gift Storm',
  [ChaosEvent.GhostTrain]: 'Spirit Train',
};

/**
 * The countdown chip's name on a phone held upright, one short word ("Storm in 20 m"): a glyph alone
 * left "in 20 m" saying nothing about what was coming, and on Powder Day the Gift Storm's glyph sat
 * beside the mood chip's gift glyph.
 */
export const EVENT_TINY: Record<ChaosEvent, string> = {
  [ChaosEvent.None]: '',
  [ChaosEvent.Avalanche]: 'Avalanche',
  [ChaosEvent.Yeti]: 'Yeti',
  [ChaosEvent.GiftStorm]: 'Storm',
  [ChaosEvent.GhostTrain]: 'Train',
};

/** Pass words that are worth a bigger punch: chains, slings, duel results. */
const STRONG_WORDS = new Set(['double', 'triple', 'streak', 'slung', 'duelWon', 'heldOff']);

/** First place wears a crown (same 24 px grid and fill style as the icon set). */
const CROWN_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3.2 7.6a1 1 0 0 1 1.6-.9l3.6 3 2.8-5a1 1 0 0 1 1.7 0l2.8 5 3.6-3a1 1 0 0 1 1.6.9l-1.5 9.2a1 1 0 0 1-1 .8H5.7a1 1 0 0 1-1-.8z"/><rect fill="currentColor" x="5" y="19" width="14" height="2.2" rx="1.1"/></svg>';

/** Your own best run is never named by your name (contract C7): it is "Your best", in gold-white. */
function shownName(name: string, kind: GhostKind): string {
  return kind === 'you' ? 'Your best' : name;
}

/**
 * The whole metres the rival pill shows for a gap of `a` m, given the number it shows now and how long
 * (ms) it has shown it (C12). The race maths jitter about half a metre frame to frame, so the number
 * moves only once the gap is GAP_HOLD_M from it, and never twice within GAP_DWELL_MS.
 */
export function gapShown(a: number, last: number, age = Number.POSITIVE_INFINITY): number {
  const r = Math.max(1, Math.round(a));
  if (!Number.isFinite(last) || last < 1) return r;
  if (age < GAP_DWELL_MS || Math.abs(a - last) < GAP_HOLD_M) return last;
  return r;
}

/**
 * Where a race-row message goes while a duel holds the pill (contracts C1/C11: the pill, the C11 ring
 * and the camera name the same ghost every frame of the duel and of its result's hold). `duel` is that
 * ghost's name, or null when no duel holds the pill. A pass or "passed you" about the duel ghost, and
 * anything with no duel holding, take the pill; the start-line call keeps it too. Another ghost's pass
 * or "passed you" goes to the callout line under the combo meter instead, and so does every news line,
 * the duel ghost's own included: the unlock tease keyed to the duel ghost ("1 more ghost opens Ember
 * Peak") flashed in the duel pill with no name while the ring named the duel's ghost. A lost duel's
 * "pulled away" is its result, not news (Hud.news takes it to the pill itself).
 */
export function duelRoute(duel: string | null, raw: string, type: 'pass' | 'lost' | 'news' | 'call'): 'pill' | 'line' {
  if (duel === null || type === 'call') return 'pill';
  return type !== 'news' && raw === duel ? 'pill' : 'line';
}

/**
 * Who holds the pill: the open duel's ghost; else the ghost the director's duel-result hold keeps
 * out.rival on (`dir`, from the model, when the game sends it); else a duel result's ghost while its
 * result waits its turn (`waiting`: under a banner or the landing stamp) and for DUEL_HOLD_MS from when
 * its flash first showed (`held.until`); else nobody.
 */
export function pillOwner(duel: string | null, held: { name: string; until: number }, now: number, dir: string | null = null, waiting = false): string | null {
  if (duel !== null) return duel;
  if (dir !== null) return dir;
  return held.name !== '' && (waiting || now < held.until) ? held.name : null;
}

/**
 * The ghost a slung pass names within its slingshot burst (passes SLUNG_BURST_MS apart or closer). Once
 * the burst passed your best it names your best (C7): "SLUNG PAST 4 Your best" in gold-white, never
 * folded into the next count under another ghost's name. The pill's owner (a duel's ghost) keeps its
 * own pass. `burst` is the running burst (its latest slung pass, and your best's name once passed).
 */
export function burstName(burst: { at: number; you: string }, name: string, kind: GhostKind, now: number, owner: string | null = null): { raw: string; kind: GhostKind } {
  if (now - burst.at >= SLUNG_BURST_MS) burst.you = '';
  burst.at = now;
  if (kind === 'you') burst.you = name;
  else if (burst.you !== '' && name !== owner) return { raw: burst.you, kind: 'you' };
  return { raw: name, kind };
}

/** Whether a duel's result that ended at `at` (and has not shown) has missed its moment (RESULT_STALE_MS). */
export function resultStale(at: number, now: number): boolean {
  return now - at > RESULT_STALE_MS;
}

/** A duel's result as a pass word: it keeps its place ahead of plain passes that wait with it. */
function isResult(w: Pick<Waiting, 'type' | 'word'>): boolean {
  return w.type === 'pass' && (w.word === 'duelWon' || w.word === 'heldOff');
}

/** Any duel's result, a lost one's "pulled away" news included. */
function isAnyResult(w: Pick<Waiting, 'type' | 'word' | 'result'>): boolean {
  return isResult(w) || (w.type === 'news' && w.result === true);
}

/**
 * The whole metres the rival pill shows for a signed `gap` (C12). The game holds the gap it sends at
 * the source in whole metres (the edge chip rounds the same number), and the pill shows that number
 * unchanged, so the two always read alike; a gap with a fraction is the race maths' own, and the pill
 * holds it itself (gapShown).
 */
export function pillGap(gap: number, last: number, age = Number.POSITIVE_INFINITY): number {
  const a = Math.abs(gap);
  return Number.isInteger(gap) ? Math.max(1, a) : gapShown(a, last, age);
}

/**
 * The score the HUD shows: the sim's, less the cash-in points whose figure is still on its way to it
 * (Hud.holdScore), never below 0.
 */
export function shownScore(score: number, held: number): number {
  return Math.max(0, score - held);
}

/**
 * Cash-in points the score does not show yet, by the cash-in's id: the sim counts a bank at once, its
 * figure takes about a second to land in the score. `held` is their sum.
 */
export class ScoreHold {
  private readonly by = new Map<number, number>();
  held = 0;

  hold(id: number, points: number): void {
    this.by.set(id, Math.max(0, points));
    this.sum();
  }

  /** Lets one cash-in's points through (no id: all of them); false when nothing was held for it. */
  release(id?: number): boolean {
    if (this.by.size === 0) return false;
    if (id === undefined) this.by.clear();
    else if (!this.by.delete(id)) return false;
    this.sum();
    return true;
  }

  private sum(): void {
    let n = 0;
    for (const p of this.by.values()) n += p;
    this.held = n;
  }
}

/** Whether the field's count has settled at a run's start (OF_STABLE_MS), or waited long enough. */
export function placeSettled(firstAt: number, changedAt: number, now: number): boolean {
  return now - changedAt >= OF_STABLE_MS || now - firstAt >= OF_WAIT_MS;
}

/**
 * Whether a wanted place shows now: the first place shown, one that has held RANK_SETTLE_MS (a bunched
 * pack swaps places every frame), or any on a wreck pass's frame (`wreck`, Hud.rankNow), so the chip
 * steps with the "passed you" pill.
 */
export function rankSettled(lastRank: number, wantAt: number, now: number, wreck: boolean): boolean {
  return lastRank < 0 || wreck || now - wantAt >= RANK_SETTLE_MS;
}

/** Whether a drift or slipstream pill that went at `goneAt` is still fading out (PILL_FADE_MS). */
export function pillHeld(goneAt: number, now: number): boolean {
  return now - goneAt < PILL_FADE_MS;
}

/** A race word for the callout line: its text, its tone, and what it is about (a ghost, or a sling burst). */
export interface SideWord {
  text: string;
  tone: StyleTone;
  /** The ghost's model name, or SLUNG_KEY for a slingshot burst: a newer word with the same key replaces it. */
  key: string;
  /** The name as shown ("Your best"): it keeps its own case in the line, as it does in the pill. */
  name?: string;
}

/**
 * A news line's side-line key: news about a ghost replaces only older news about it, never a pass
 * word ("1 more ghost opens Frostfang Glacier" in the same frame as "Took back fjord348" waits its turn).
 */
export function newsKey(name: string, text: string): string {
  return `${NEWS_KEY}${name || text}`;
}

/** Whether a side-line key is a news line's (it is the first dropped when the line's queue is full). */
export function isNewsKey(key: string | undefined): boolean {
  return key !== undefined && key.startsWith(NEWS_KEY);
}

/** A flash waiting its turn, as enqueueFlash sees it. */
export interface Waiting {
  type: 'pass' | 'lost' | 'news' | 'call';
  name: string;
  word?: string;
  /** The ghost's kind: a pass of your best ('you') is the one a banner's queue keeps (C7). */
  kind?: GhostKind;
  at: number;
  /** It waited under a banner: its stale clock starts again once the band lets the race row back. */
  band?: boolean;
  /** A lost duel's "pulled away": the duel's result, though it is worded as news. */
  result?: boolean;
}

/**
 * A flash waits its turn. A newer slung pass is the same slingshot burst as a waiting one and takes its
 * place, so only the latest "Slung past N" plays (not 2, 3, 4 and 5 one after another behind a landing
 * stamp). Otherwise a newer flash about the same ghost replaces its older one; `max` wait at most, and
 * when one more arrives news goes first (the newcomer too: the unlock tease arriving behind a slingshot
 * burst under GRUDGE SETTLED pushed the burst's "Slung past 5 Your best" out), then the oldest that is
 * neither a duel's result nor a pass of your best.
 */
export function enqueueFlash<T extends Waiting>(pend: T[], f: T, max = 2): void {
  if (f.type === 'pass' && f.word === 'slung') {
    const s = pend.findIndex((q) => q.type === 'pass' && q.word === 'slung' && f.at - q.at < SLUNG_BURST_MS);
    if (s >= 0) {
      pend[s] = f;
      return;
    }
  }
  const i = f.name === '' ? -1 : pend.findIndex((q) => q.name === f.name && (q.type === 'news') === (f.type === 'news'));
  if (i >= 0) pend.splice(i, 1);
  pend.push(f);
  while (pend.length > max) {
    const n = pend.findIndex((q) => q.type === 'news' && !isAnyResult(q));
    const o = pend.findIndex((q, k) => k < pend.length - 1 && !isAnyResult(q) && q.kind !== 'you');
    pend.splice(n >= 0 ? n : o >= 0 ? o : 0, 1);
  }
}

/**
 * The banner over the race row has gone: the flashes that waited under it start their stale clocks
 * now. A duel's result that waited under it plays first, a lost one's "pulled away" too ("Held off
 * RidgeUlla" lost its turn to a later "Slung past SparkleCedar"), then one pass: the newest, or your best's if it was passed meanwhile (C7:
 * the gold "Passed Your best" is the moment, not the plain pass after it). The newest pass is the news:
 * a "Slung past 4" stepped back under an unlock toast no longer goes before the "Pass streak 5" after
 * it. With a pass to play, news that waited under the banner is dropped (the unlock tease played after
 * the banner while the pass it came with went stale).
 */
export function releaseBand(pend: Waiting[], now: number): void {
  let res = -1;
  let last = -1;
  let you = -1;
  for (let i = 0; i < pend.length; i++) {
    const p = pend[i];
    if (!p.band) continue;
    if (isAnyResult(p)) res = i;
    else if (p.type === 'pass') {
      last = i;
      if (p.kind === 'you') you = i;
    }
  }
  const pick = you >= 0 ? you : last;
  const kept = res >= 0 ? pend[res] : null;
  for (let i = pend.length - 1; i >= 0; i--) {
    const p = pend[i];
    if (!p.band) continue;
    if (i === res) continue;
    if ((p.type === 'pass' && i !== pick) || (p.type === 'news' && (res >= 0 || pick >= 0))) pend.splice(i, 1);
  }
  if (kept) {
    pend.splice(pend.indexOf(kept), 1);
    pend.unshift(kept);
  }
  for (const p of pend) {
    if (!p.band) continue;
    p.at = now;
    p.band = false;
  }
}

/**
 * Each mood's gameplay modifier as an icon and one short line: the reveal card and the HUD chip.
 * `key` is the part of the line the reveal sets in the mood's accent (the number that changes play).
 */
export const MOOD_MOD: Record<Mood, { icon: IconName; text: string; key: string }> = {
  [Mood.None]: { icon: 'snowflake', text: 'A clean run', key: '' },
  [Mood.Blizzard]: { icon: 'slip', text: 'Drafting 60% stronger', key: '60%' },
  [Mood.Lantern]: { icon: 'timer', text: 'Combos last 50% longer', key: '50%' },
  [Mood.GlassIce]: { icon: 'bolt', text: 'Drifts charge 60% faster', key: '60%' },
  [Mood.Comet]: { icon: 'feather', text: 'Low gravity, huge air', key: 'huge air' },
  [Mood.Haunted]: { icon: 'ghostPlus', text: '4 extra ghosts, passes pay double', key: 'double' },
  [Mood.Powder]: { icon: 'gift', text: 'Gifts worth double', key: 'double' },
};

/** Moods with a dark sky: navy pills there get a moon-blue hairline so their edges hold (style.css). */
const NIGHT = new Set<Mood>([Mood.Lantern, Mood.Comet, Mood.Haunted]);

/**
 * One message in the rival pill. pass: a pass of yours ("PASSED Mika"); lost: a ghost passed you
 * ("Mika PASSED YOU"); news: a quiet race line ("Tess wiped out"); call: the start-line call
 * ("REMATCH Mila").
 */
interface Flash extends Waiting {
  type: 'pass' | 'lost' | 'news' | 'call';
  /** The name as shown ("Your best" for your own run), or '' for a line with no ghost. */
  name: string;
  /** A pass's word ('slung', 'double', ...): a slingshot burst waits as one flash. */
  word?: string;
  /** The ghost's own name (as the model names it), so a flash about the duel ghost can be told apart. */
  raw: string;
  kind: GhostKind;
  /** The word before the name ("Passed", "Double pass", "Rematch"), or ''. */
  k: string;
  /** The words after the name ("passed you", "wiped out"), or ''. */
  tail: string;
  ms: number;
  /** A chain, a sling, a duel result: a bigger punch and a longer hold. */
  strong: boolean;
  /** When it arrived (it goes stale waiting its turn). */
  at: number;
  /** How long it may wait its turn before it is stale (ms). */
  stale: number;
  /** A news line's whole text, so it can be taken back (retract). */
  line?: string;
  /** A lost duel's "pulled away": the duel's result, which keeps the pill though it is worded as news. */
  result?: boolean;
}

/** A waiting flash as a race word for the callout line, worded as the pill would have said it. */
export function sideWord(f: Pick<Flash, 'type' | 'name' | 'raw' | 'k' | 'tail' | 'strong' | 'word' | 'line'>): SideWord {
  if (f.type === 'pass') return { text: `${f.k} ${f.name}`, tone: f.strong ? 'big' : 'normal', key: f.word === 'slung' ? SLUNG_KEY : f.raw, name: f.name };
  if (f.type === 'lost') return { text: `${f.name} passed you`, tone: 'normal', key: f.raw, name: f.name };
  const text = f.line ?? `${f.name} ${f.tail}`.trim();
  return { text, tone: 'normal', key: newsKey(f.raw, text), name: f.name || undefined };
}

export class Hud {
  readonly layer: Layer;
  readonly el: HTMLElement;
  readonly scoreEl: HTMLElement;
  readonly moodEl: HTMLElement;
  readonly comboEl: HTMLElement;
  /** Fixed slot under the combo meter where Fx lays out trick callouts. */
  readonly calloutSlot: HTMLElement;
  /** Called whenever something visible changed size or came and went (the occluder cache). */
  onLayout: () => void = () => undefined;
  /** True while the perfect-landing stamp is up (Fx): a pass flash waits behind it. */
  stampUp: () => boolean = () => false;
  /**
   * True while the stamp sits under the rider (Fx, a phone held upright) in the band the bottom-centre
   * pills share: a drift or slipstream pill waits until it has gone (one headline, never overprinted).
   */
  stampLow: () => boolean = () => false;
  /** The ghost the banner over the race row names (a settled grudge), or null (Notices.currentName). */
  bannerName: () => string | null = () => null;
  /** A pass of yours starts flashing (now or after waiting its turn): minor callout lines step out. */
  onPassFlash: () => void = () => undefined;
  /**
   * A race message that may not take the pill (another ghost's pass or news while a duel or its result
   * holds it) goes to the callout line under the combo meter instead (the UI wires this to Fx.side).
   */
  onSideLine: (w: SideWord) => void = () => undefined;

  private readonly tl: HTMLElement;
  private readonly tr: HTMLElement;
  private readonly score: Txt;
  private readonly dist: Txt;
  private readonly moodIco: HTMLElement;
  private readonly moodTxt: Txt;
  private readonly moodOn: Flag;
  private readonly giftsEl: HTMLElement;
  private readonly gifts: Txt;
  private readonly race: HTMLElement;
  private readonly placeEl: HTMLElement;
  private readonly placeOn: Flag;
  private readonly placeFlash: HTMLElement;
  private readonly placeFirst: Flag;
  /**
   * A place change: a small arrow and the count after the numeral for a moment, in the "of 7" slot
   * (same width). Mint and pointing up on a gain, dim and pointing down on a loss.
   */
  private readonly placeUp: Flag;
  private readonly placeDown: Flag;
  private readonly placeDelta: Txt;
  private readonly placeDeltaEl: HTMLElement;
  private deltaTimer = 0;
  /** Places gained (positive) or lost (negative) while the arrow is up: a second change adds to it. */
  private deltaSum = 0;
  private readonly rankEl: HTMLElement;
  private gainTimer = 0;
  private readonly rankNum: Txt;
  private readonly rankSuf: Txt;
  private readonly of: Txt;
  private readonly nextEl: HTMLElement;
  private readonly nextOn: Flag;
  private readonly nextRing: HTMLElement;
  private readonly nextTrail: HTMLElement;
  private readonly nextK: Txt;
  private readonly nextName: Txt;
  private readonly nextGap: Txt;
  private readonly nextWord: Txt;
  private readonly nextAhead: Flag;
  private readonly nextBehind: Flag;
  private readonly nextEven: Flag;
  private readonly nextFlash: Flag;
  private readonly nextLost: Flag;
  private readonly nextNews: Flag;
  private readonly nextCall: Flag;
  private readonly nextStrong: Flag;
  /** An open duel with the named ghost: "DUEL" before its name, the ring pulsing. */
  private readonly nextDuel: Flag;
  /** The pill names the friend whose challenge this is: a small mint "vs" badge after the name. */
  private readonly nextFriend: Flag;
  private readonly nextTail: Txt;
  /** When the flash on the pill started, the one showing, and those waiting their turn (oldest first). */
  private flashAt = 0;
  private cur: Flash | null = null;
  private readonly pend: Flash[] = [];
  /** The last strong word shown or queued, so a duel result arriving twice shows once. */
  private lastStrong = { key: '', at: -1e9 };
  /** The crown on the place pill, its gold-white ring, and when the lead beat asked for its pulse. */
  private readonly crown: HTMLElement;
  private readonly placeRing: HTMLElement;
  private leadAt = -1e9;
  private leadDone = true;
  /** Under the combo timer: the number at stake, gold-white on your best combo's pace, a fuse when it drains. */
  private readonly stakeEl: HTMLElement;
  private readonly stakeOn: Flag;
  private readonly stakePace: Flag;
  private readonly stakeNum: Txt;
  private lastStakeLen = 0;
  private lastFuse = -1;
  /** The combo as it last showed while up: a lost combo's figure cracks from it. */
  readonly lastCombo = { pending: 0, mult: 1, stake: 0 };
  /** "Best in 240 m" under the distance, and the event countdown chip beside the mood chip. */
  private readonly bestInEl: HTMLElement;
  private readonly bestInOn: Flag;
  private readonly bestInNum: Txt;
  private readonly cdEl: HTMLElement;
  private readonly cdOn: Flag;
  private readonly cdNear: Flag;
  private readonly cdIco: HTMLElement;
  private readonly cdName: Txt;
  private readonly cdTiny: Txt;
  private readonly cdNum: Txt;
  private lastCd: ChaosEvent = ChaosEvent.None;
  private readonly moodGone: Flag;
  private bestTimer = 0;
  private readonly comboOn: Flag;
  /** The total shows whenever the combo is up: a timer bar with no number over it read as empty. */
  private readonly comboTotal: Flag;
  private readonly comboRow: HTMLElement;
  private readonly comboLow: Flag;
  private readonly comboPts: Txt;
  private readonly multEl: HTMLElement;
  private readonly mult: Txt;
  /** At x1 the multiplier chip stays out: it would only say "nothing multiplied yet". */
  private readonly multX1: Flag;
  /** A banked total is holding over the combo meter: the new total waits under it. */
  private readonly banking: Flag;
  /** A lost combo's crack took the meter's place: the meter went at once, with no fade. */
  private readonly snapped: Flag;
  private bankTimer = 0;
  /**
   * In the flow: the multiplier chip's vermillion ring and the "Flow" tag beside it (flowState). A
   * snuff greys them (is-snuff) before they go; the flare rings out once as the flow comes in.
   */
  private readonly flowOnF: Flag;
  private readonly flowSnuff: Flag;
  private readonly flowTag: HTMLElement;
  private readonly flowFlare: HTMLElement;
  private flowTimer = 0;
  /** Cash-in points the score does not show yet (holdScore), and the model's last score. */
  private readonly scoreHold = new ScoreHold();
  private lastScore = 0;
  /** The drift and slipstream pills want to show (a low stamp may hold them back: stampLow). */
  private draftWant = false;
  private readonly comboBar: HTMLElement;
  private readonly driftEl: HTMLElement;
  private readonly driftOn: Flag;
  private readonly draftEl: HTMLElement;
  private readonly draftOn: Flag;
  private readonly draftFull: Flag;
  private readonly chevs: Flag[] = [];
  private readonly dangerEl: HTMLElement;
  private readonly dangerOn: Flag;
  private readonly dangerUrgent: Flag;
  private readonly dangerGap: Txt;
  private readonly dangerGapEl: HTMLElement;
  private readonly wall: HTMLElement;
  private readonly chased: Flag;
  /** The last few metres: the bottom edge of the screen darkens a little (opacity only). */
  private readonly edgeOn: Flag;
  /**
   * The avalanche unit: the mirror box (the world draws the inset into its rect) with its label tab
   * on the top edge, and the meter set into its bottom edge (in portrait the meter rides in the race
   * row instead).
   */
  private readonly avEl: HTMLElement;
  private readonly mirrorBox: HTMLElement;
  private readonly avDodge: Flag;
  private lastBand = -1;
  private readonly live: HTMLElement;
  /** Lines said in this task, written to the live region together (say). */
  private readonly sayQ: string[] = [];

  private lastMood = -1;
  private lastGifts = -1;
  private lastMult = 0;
  private lastRank = -1;
  private lastOf = -1;
  private wantRank = -1;
  private wantAt = 0;
  private tickAt = 0;
  private wantName = '';
  private wantNameAt = 0;
  /** Show the target's name at once (after a pass flash hands the pill back). */
  private nameNow = false;
  /** A ghost rode past your wreck this frame (rankNow): the wanted place shows at once. */
  private rankNowF = false;
  /** When the drift and slipstream pills last went (PILL_FADE_MS), and whether one still fades. */
  private driftGoneAt = -1e9;
  private draftGoneAt = -1e9;
  private pillFading = false;
  /**
   * The model name whose name the pill shows right now ('' while a flash holds it): the gap shown
   * beside a name is always that same ghost's gap, never the next one's while the name settles.
   */
  private nameShown = '';
  /** The open duel's ghost (its model name), or null: the pill stays on it (duelRoute). */
  private duelName: string | null = null;
  /**
   * A resolved duel's ghost and the end of its hold (holdDuel): the pill stays on it till then. `wait`:
   * its result has not shown yet (it waits under a banner or the stamp), and its hold starts once it does.
   */
  private readonly held = { name: '', until: -1e9, wait: false, at: -1e9 };
  /**
   * The ghost the director's duel-result hold keeps out.rival on, when the model says so (its
   * nextGhost.hold), else null: other ghosts' words keep off the pill for exactly that hold.
   */
  private dirHold: string | null = null;
  /** The slingshot burst: its latest slung pass, and your best's name once the burst passed it (C7). */
  private readonly burst = { at: -1e9, you: '' };
  /** The banner held the race row last frame: a flash waits under it and plays once it goes. */
  private bandWas = false;
  /** Ghosts the banners named while they held the row: their own flashes were said by the banner. */
  private readonly bandNamed = new Set<string>();
  /** At a run's start, the place pill waits for the field's count to settle (placeSettled). */
  private placeReady = false;
  private ofFirstAt = -1;
  private ofChangedAt = 0;
  private ofN = 0;
  private lastGap = Number.NaN;
  /** When the gap number last changed (GAP_DWELL_MS). */
  private gapAt = -1e9;
  /** 1 the ghost is ahead, -1 behind, 0 neck and neck. */
  private lastSide = 2;
  private lastKind: GhostKind | null = null;
  private lastTimer = -1;
  private lastTier = -1;
  private lastChev = -1;
  private lastDanger = -1;
  private lastScoreLen = 0;
  private lastGapLen = 0;
  private revealing = false;
  private moodWanted = false;
  private flashUntil = 0;
  /** Phone held upright: the chase's meter rides in the race row (set on resize). */
  private portrait = false;
  /** Avalanche meter width (contract C2 with the rear-view mirror), set on resize. */
  private meterW = 0;
  /** The wall's front edge travels between these (px from the meter's left): the hazard disc's edge and the rider badge's. */
  private wallMin = 30;
  private wallMax = 200;
  /** The rider badge's left edge. */
  private badgeL = 200;
  /** The gap number's size: its width is estimated from it and the digit count, never read from layout. */
  private gapF = 22;
  private wallX = Number.NaN;
  private gapX = Number.NaN;
  private dangerOffAt = -1e9;
  private warnedAt = -1e9;
  private scoreAt: { x: number; y: number } | null = null;
  private comboAt: { x: number; y: number } | null = null;
  private rowAt: { x: number; y: number } | null = null;
  /**
   * Layout read in measure() (after the browser's own layout pass, never forced): the mirror's rect
   * for the world, the unit's box for the rider check, and the room the perfect-landing stamp has.
   */
  private readonly mirror: MirrorRect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly avBox: ScreenRect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  /** bcTop: the top of the bottom-centre pill row (the drift and slipstream pills). */
  private readonly room = { left: 0, right: 0, slotTop: 0, bcTop: 0, measured: false };
  private readonly bc: HTMLElement;

  constructor(parent: HTMLElement, ctx: Ctx, hd: UIHandlers) {
    this.el = h('div', 'gs-hud');
    this.layer = new Layer(this.el, 200);

    // Top left: score, then distance and the mood chip (side by side on phones in portrait).
    this.scoreEl = h('div', 'gs-score gs-num');
    this.score = new Txt(this.scoreEl);
    const distEl = h('div', 'gs-dist gs-num');
    this.dist = new Txt(distEl);
    this.moodIco = h('span', 'gs-mood-ico');
    const moodName = h('span', 'gs-mood-name');
    this.moodTxt = new Txt(moodName);
    this.moodEl = h('div', 'gs-mood gs-pill', this.moodIco, moodName);
    this.moodOn = new Flag(this.moodEl);
    this.moodGone = new Flag(this.moodEl, 'is-gone');
    // Your best within 250 m: "Best in 240 m" in gold-white (your best's colour) under the distance.
    const biN = h('span', 'gs-num');
    this.bestInNum = new Txt(biN);
    this.bestInEl = h('div', 'gs-best-in', 'Best in ', biN, NBSP + 'm');
    this.bestInOn = new Flag(this.bestInEl);
    // A rolled event on its way, in its own chip beside the mood chip (never in its place), coloured by
    // its role: the hazards ice blue, the Gift Storm marigold, the Spirit Train mint. On a phone held
    // upright the event's name steps out (screen readers keep it) and the glyph names it: "in 380 m".
    this.cdIco = h('span', 'gs-cd-ico');
    const cdNameEl = h('span', 'gs-cd-name');
    this.cdName = new Txt(cdNameEl);
    // The phone's one-word name ("Storm"), seen only there; readers keep the full name above.
    const cdTinyEl = h('span', 'gs-cd-tiny');
    cdTinyEl.setAttribute('aria-hidden', 'true');
    this.cdTiny = new Txt(cdTinyEl);
    const cdNumEl = h('span', 'gs-num');
    this.cdNum = new Txt(cdNumEl);
    this.cdEl = h('div', 'gs-cd gs-pill', this.cdIco, h('span', 'gs-cd-t', cdNameEl, cdTinyEl, h('span', 'gs-cd-in', 'in '), cdNumEl, NBSP + 'm'));
    this.cdOn = new Flag(this.cdEl);
    this.cdNear = new Flag(this.cdEl, 'is-near');
    this.tl = h(
      'div',
      'gs-hud-tl',
      sr('Score'),
      this.scoreEl,
      h('div', 'gs-hud-sub', h('div', 'gs-hud-dist', distEl, this.bestInEl), h('div', 'gs-hud-chips', this.moodEl, this.cdEl)),
    );

    // Top right: gifts, pause.
    const giftNum = h('span', 'gs-num');
    this.gifts = new Txt(giftNum);
    this.giftsEl = h('div', 'gs-gifts gs-panel gs-pill', icon('gift'), giftNum, sr(' gifts'));
    // The pause button never keeps focus, even after a keyboard press: on resume, focus must not come
    // back to it, or Space (the action key) would press it again instead of reaching the game.
    const pause: HTMLButtonElement = btn(ctx, {
      cls: 'gs-btn-soft gs-btn-round gs-pausebtn',
      icon: 'pause',
      aria: 'Pause',
      onClick: () => {
        pause.blur();
        hd.onPause(true);
      },
    });
    this.tr = h('div', 'gs-hud-tr', this.giftsEl, pause);

    // Tier one: race position and the next ghost. A pass flashes here (mint pulse, rank flip, the
    // passed ghost's name for a moment) instead of taking a banner of its own. The place is a numeral
    // the size of the score with a small suffix ("5th"): in a ghost race your place is the first number
    // the eye should read. First place wears a crown.
    const numEl = h('span', 'gs-place-num');
    const sufEl = h('span', 'gs-place-suf');
    this.rankEl = h('span', 'gs-place-n gs-num', numEl, sufEl);
    const ofEl = h('span', 'gs-place-of gs-num');
    this.rankNum = new Txt(numEl);
    this.rankSuf = new Txt(sufEl);
    this.of = new Txt(ofEl);
    this.placeFlash = h('span', 'gs-place-flash');
    const crown = h('span', 'gs-i gs-place-crown');
    crown.innerHTML = CROWN_SVG;
    this.crown = crown;
    // Taking the lead: a gold-white ring rings the pill once as the crown pulses.
    this.placeRing = h('span', 'gs-place-ring');
    // A place change reads as a small arrow and the count right after the numeral for a moment: a mint
    // up-arrow on a gain ("5th ▲2"), a dim down-arrow on a loss. It shares one grid cell with "of 7",
    // which steps out for it, so the race row never changes width. Never a sign: "5th −2" read as
    // losing places in the middle of a pass, and a badge on the pill's corner read as a dropdown.
    const deltaN = h('span', 'gs-place-dn');
    this.placeDelta = new Txt(deltaN);
    this.placeDeltaEl = h('span', 'gs-place-delta gs-num', icon('tri', 'gs-place-dir'), deltaN);
    this.placeDeltaEl.setAttribute('aria-hidden', 'true');
    this.placeEl = h('div', 'gs-place gs-panel gs-pill', this.placeFlash, this.placeRing, crown, h('span', 'gs-place-nwrap', this.rankEl), h('span', 'gs-place-tail', ofEl, this.placeDeltaEl));
    this.placeOn = new Flag(this.placeEl);
    this.placeFirst = new Flag(this.placeEl, 'is-first');
    this.placeUp = new Flag(this.placeEl, 'is-up');
    this.placeDown = new Flag(this.placeEl, 'is-down');

    // The gap reads as a positive number of metres with a word (contract C12): "6 m ahead" for a ghost
    // in front of you, on a solid chip in its kind colour (a target), and "6 m behind" for one you lead,
    // the same colour as an outline. The word is a step smaller than the number. Never a bare sign, a
    // lone triangle or a chevron: "▲ 4 m" and "^ +7 m" told direction in two different ways.
    const kEl = h('span', 'gs-next-k');
    const nameEl = h('span', 'gs-next-name');
    nameEl.translate = false;
    const gapNum = h('span', 'gs-next-n gs-num');
    const gapWord = h('span', 'gs-next-w');
    const gapEl = h('span', 'gs-next-gap', gapNum, h('span', 'gs-next-u', NBSP + 'm '), gapWord);
    this.nextK = new Txt(kEl);
    this.nextName = new Txt(nameEl);
    this.nextGap = new Txt(gapNum);
    this.nextWord = new Txt(gapWord);
    this.nextTrail = icon('ghost', 'gs-next-trail');
    this.nextRing = h('span', 'gs-ring-pulse');
    // Being passed reads as a quiet sentence: "<name> passed you" ("Your best passed you" for your own
    // run), the name in off-white (rose for the grudge, gold-white for your best), smaller than a pass
    // you make, with no glow, and only for about a second.
    // Race news is quieter still: the name in its kind colour, then the news in off-white, sentence case.
    const tailEl = h('span', 'gs-next-tail', 'passed you');
    this.nextTail = new Txt(tailEl);
    // A friend's challenge ghost wears the same small mint "vs" badge as its row on the results card.
    const vsEl = h('span', 'gs-next-vs', 'vs');
    vsEl.setAttribute('aria-hidden', 'true');
    this.nextEl = h('div', 'gs-next gs-pill k-ghost', this.nextRing, h('span', 'gs-next-ico', icon('ghost'), this.nextTrail), kEl, nameEl, vsEl, tailEl, gapEl);
    this.nextOn = new Flag(this.nextEl);
    this.nextAhead = new Flag(this.nextEl, 'is-ahead');
    this.nextBehind = new Flag(this.nextEl, 'is-behind');
    this.nextEven = new Flag(this.nextEl, 'is-even');
    this.nextFlash = new Flag(this.nextEl, 'is-flash');
    this.nextLost = new Flag(this.nextEl, 'is-lost');
    this.nextNews = new Flag(this.nextEl, 'is-news');
    this.nextCall = new Flag(this.nextEl, 'is-call');
    this.nextStrong = new Flag(this.nextEl, 'is-strong');
    this.nextDuel = new Flag(this.nextEl, 'is-duel');
    this.nextFriend = new Flag(this.nextEl, 'is-friend');
    this.race = h('div', 'gs-race', this.placeEl, this.nextEl);

    // Tier two: the combo meter, with the trick callout slot directly under it.
    const ptsEl = h('span', 'gs-combo-pts gs-num');
    this.comboPts = new Txt(ptsEl);
    // In the flow the chip wears a vermillion ring (flowState), and the flare rings out once as it comes.
    const multN = h('span', 'gs-combo-mult-n');
    this.flowFlare = h('span', 'gs-combo-flare');
    this.multEl = h('span', 'gs-combo-mult gs-num', h('span', 'gs-combo-ring'), this.flowFlare, multN);
    this.mult = new Txt(multN);
    this.multX1 = new Flag(this.multEl, 'is-x1');
    // The timer drains left to right over a dark track, so what is left reads at a glance.
    this.comboBar = h('div', 'gs-combo-bar');
    // The "Flow" tag hangs off the chip's right (out of the row's flow, so the total never shifts). A
    // word, not a number, and a picture only, as the callout line is.
    this.flowTag = h('span', 'gs-combo-flow', 'Flow');
    this.flowTag.setAttribute('aria-hidden', 'true');
    this.comboRow = h('div', 'gs-combo-row', ptsEl, this.multEl, this.flowTag);
    // The one number at stake (the total times the multiplier), from x2: "4,960 AT STAKE". Its row is
    // always reserved, so the callout line under it never moves when it comes and goes.
    const stakeN = h('span', 'gs-stake-n gs-num');
    this.stakeNum = new Txt(stakeN);
    this.stakeEl = h('div', 'gs-stake', stakeN, h('span', 'gs-stake-w', 'at stake'));
    this.stakeOn = new Flag(this.stakeEl);
    this.stakePace = new Flag(this.stakeEl, 'is-pace');
    this.comboEl = h('div', 'gs-combo', this.comboRow, h('div', 'gs-combo-track', this.comboBar), this.stakeEl);
    // The fuse's band, on the stake line and the meter alike (unlit until a big stake drains).
    this.stakeEl.dataset.fuse = '0';
    this.comboEl.dataset.fuse = '0';
    this.comboOn = new Flag(this.comboEl);
    this.comboTotal = new Flag(this.comboEl, 'has-total');
    this.comboLow = new Flag(this.comboEl, 'is-low');
    this.banking = new Flag(this.comboEl, 'is-banking');
    this.snapped = new Flag(this.comboEl, 'is-snap');
    this.flowOnF = new Flag(this.comboEl, 'is-flow');
    this.flowSnuff = new Flag(this.comboEl, 'is-snuff');
    this.calloutSlot = h('div', 'gs-callouts');
    this.calloutSlot.setAttribute('aria-hidden', 'true');

    // Avalanche unit (contract C2 with the WebGL rear-view mirror): it hangs top-centre right under
    // the race row in both orientations, in the open sky above the rider, with the combo meter and the
    // callout line moving under it for the chase. One compact block: an AVALANCHE tab on the mirror's
    // top edge (the rival name's size), and the meter set into its bottom edge. The mirror box is empty:
    // the world draws the inset into its rect (mirrorRect()). The meter is a proportional bar: from the
    // hazard (an ink disc at the left end) the wall, a dark fill with an icy front, advances over a
    // lighter ticked track toward the rider badge at the right end, so a full bar plainly means caught.
    // The gap in metres, the combo total's size, rides in the open track between the wall and the
    // rider, or on the wall just behind its front once the track is too short for it. On a phone held
    // upright the meter takes the rival pill's place in the race row (fit()). Screen readers get the
    // appearance and the urgent moment through the live region, not a stream of distances.
    const gapN = h('span', 'gs-danger-n');
    this.dangerGapEl = h('span', 'gs-danger-gap gs-num', gapN, h('span', 'gs-danger-m', 'm'));
    this.dangerGap = new Txt(gapN);
    this.wall = h('div', 'gs-danger-wall');
    this.dangerEl = h('div', 'gs-danger', h('div', 'gs-danger-clip', this.wall), icon('avalanche', 'gs-danger-ico'), this.dangerGapEl, h('span', 'gs-danger-you', icon('rider')));
    // Hidden on the meter itself, not only through the unit: in portrait fit() moves it into the race
    // row, outside the unit, where it would read out a bare "34 m" that changes every metre.
    this.dangerEl.setAttribute('aria-hidden', 'true');
    this.dangerOn = new Flag(this.dangerEl);
    this.dangerUrgent = new Flag(this.dangerEl, 'is-urgent');
    const avLabel = h('div', 'gs-av-label', icon('avalanche'), h('span', 'gs-av-label-t', 'Avalanche'));
    this.mirrorBox = h('div', 'gs-av-mirror', avLabel);
    this.avEl = h('div', 'gs-av', this.mirrorBox, this.dangerEl);
    this.avEl.setAttribute('aria-hidden', 'true');
    this.avDodge = new Flag(this.avEl, 'is-dodge');
    const tc = h('div', 'gs-hud-tc', this.race, this.comboEl, this.calloutSlot, this.avEl);
    const edge = h('div', 'gs-av-edge');
    this.edgeOn = new Flag(edge);

    // Bottom centre: drift tier pips and slipstream chevrons share one stable row.
    const pips = h('span', 'gs-pips', h('i', 'gs-pip'), h('i', 'gs-pip'), h('i', 'gs-pip'));
    this.driftEl = h('div', 'gs-drift gs-panel gs-pill', h('span', 'gs-drift-l', 'Drift'), pips);
    this.driftOn = new Flag(this.driftEl);
    const chevRow = h('span', 'gs-chevs');
    for (let i = 0; i < CHEVRONS; i++) {
      const c = icon('chevR', 'gs-chev');
      chevRow.append(c);
      this.chevs.push(new Flag(c));
    }
    this.draftEl = h('div', 'gs-draft gs-panel gs-pill', chevRow, h('span', 'gs-draft-l', 'Slipstream'));
    this.draftOn = new Flag(this.draftEl);
    this.draftFull = new Flag(this.draftEl, 'is-full');
    this.bc = h('div', 'gs-hud-bc', this.driftEl, this.draftEl);

    this.chased = new Flag(this.el, 'is-chased');

    this.live = h('div', 'gs-sr');
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');

    this.el.append(edge, this.tl, this.tr, tc, this.bc, this.live);
    parent.append(this.el);
    window.addEventListener('resize', () => this.fit());
    this.fit();
  }

  show(): void {
    if (this.layer.show()) {
      this.lastGifts = -1;
      this.lastMult = 0;
      this.lastRank = -1;
      this.wantRank = -1;
      this.lastMood = -1;
      this.flashUntil = 0;
      this.pend.length = 0;
      this.cur = null;
      this.nextFlash.set(false);
      this.nextDuel.set(false);
      this.nextFriend.set(false);
      this.duelName = null;
      this.held.until = -1e9;
      this.held.wait = false;
      this.dirHold = null;
      this.burst.at = -1e9;
      this.bandWas = false;
      this.placeReady = false;
      this.ofFirstAt = -1;
      this.nameShown = '';
      this.leadDone = true;
      this.lastFuse = -1;
      this.rankNowF = false;
      this.driftGoneAt = -1e9;
      this.draftGoneAt = -1e9;
      this.pillFading = false;
      this.flowState('off');
      this.scoreHold.release();
      this.fit();
    }
  }

  hide(): void {
    this.layer.hide();
    this.revealing = false;
    this.flowState('off');
    this.releaseScore();
    this.draftWant = false;
    window.clearTimeout(this.deltaTimer);
    window.clearTimeout(this.bestTimer);
    this.scoreEl.classList.remove('is-best');
    this.deltaSum = 0;
    this.placeUp.set(false);
    this.placeDown.set(false);
    this.pend.length = 0;
    this.cur = null;
    this.lastStrong.at = -1e9;
    this.held.until = -1e9;
    this.held.wait = false;
    this.dirHold = null;
    this.el.parentElement?.classList.remove('gs-night', 'gs-chase-p');
    this.onLayout();
  }

  /**
   * True while a pass you made (or the start-line call) flashes in the race row: minor callout lines
   * stay out of the stack. Being passed and race news are quiet, and leave the stack alone.
   */
  get passing(): boolean {
    const t = this.cur?.type;
    return this.nextFlash.on && (t === 'pass' || t === 'call') && this.flashUntil > performance.now();
  }

  /**
   * True while the Slipstream pill is up (or waits under a low stamp): it names the slipstream, so no
   * callout repeats it.
   */
  get drafting(): boolean {
    return this.draftOn.on || this.draftWant;
  }

  /** True from 'In the flow' until the flow goes out (flowState): a flow line still waiting may play. */
  get flowOn(): boolean {
    return this.flowOnF.on && !this.flowSnuff.on;
  }

  /**
   * The flow state on the multiplier chip, from the flow beats (the beat router). 'on' ('In the flow'):
   * a vermillion ring round the chip and a "Flow" tag beside it, the ring's flare ringing out once.
   * 'snuff' ('Flow broken', or a wordless snuff): both snap grey and fade out over FLOW_SNUFF_MS.
   * 'off' (the combo banked or was lost, the crash, the HUD going): both go at once. Flow-in is per
   * combo, so the next combo starts without it. They sit on the combo row, so a banner over the race
   * row never hides them. Reduced motion: the ring and the tag, with no flare.
   */
  flowState(s: 'on' | 'snuff' | 'off'): void {
    window.clearTimeout(this.flowTimer);
    if (s === 'on') {
      const was = this.flowOn;
      this.flowSnuff.set(false);
      this.flowOnF.set(true);
      if (!was && !reduced()) play(this.flowFlare, [{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.5, 1.9)' }], { duration: 620, easing: EASE_OUT });
      this.onLayout();
      return;
    }
    if (!this.flowOnF.on) return;
    if (s === 'snuff') {
      this.flowSnuff.set(true);
      this.flowTimer = window.setTimeout(() => this.flowState('off'), FLOW_SNUFF_MS);
      return;
    }
    this.flowOnF.set(false);
    this.flowSnuff.set(false);
    this.onLayout();
  }

  /** True while the combo total is printed over the timer (not waiting under a banked total). */
  get totalShown(): boolean {
    return this.comboOn.on && this.comboTotal.on && !this.banking.on;
  }

  /** True while an avalanche chases you: the callout slot keeps to one line above the mirror. */
  get isChased(): boolean {
    return this.chased.on;
  }

  /**
   * The mirror's rect in CSS px, top-left origin, while an avalanche chases you; null otherwise
   * (contract C2). Read from the last layout, so it costs nothing per frame. The object is reused.
   * The mirror sits in its slot from the chase's first frame, its nameplate and meter with it
   * (contract C9): there is no opening enlargement.
   */
  mirrorRect(): MirrorRect | null {
    // The rect is out from the avalanche's telegraph (the world may start fading the inset in on the
    // chase's first frame, before this frame's HUD update) until the world's fade-out after the chase,
    // so the inset never flashes at the renderer's fallback spot. The unit never moves in between.
    const now = performance.now();
    const live = this.dangerOn.on || now - this.dangerOffAt < MIRROR_HOLD_MS || now - this.warnedAt < WARN_HOLD_MS;
    if (!live || !this.layer.open || this.mirror.w <= 0) return null;
    return this.mirror;
  }

  /** Low tier draws no mirror picture: the avalanche unit drops the empty glass and keeps chip and meter. */
  setMirror(on: boolean): void {
    if (this.el.classList.contains('gs-no-mirror') !== on) return;
    this.el.classList.toggle('gs-no-mirror', !on);
    this.onLayout();
  }

  /** The avalanche was telegraphed: the chase (and the mirror) starts in about three seconds. */
  expectChase(): void {
    this.warnedAt = performance.now();
  }

  /**
   * The rider's projected position (about head height). The unit sits well above the rider by
   * layout; if a big air ever lifts the rider up under it anyway, the meter and its tag step back.
   */
  setRider(x: number, y: number): void {
    const b = this.avBox;
    this.avDodge.set(this.dangerOn.on && y - 34 < b.y1 + 6 && x > b.x0 - 28 && x < b.x1 + 28);
  }

  /**
   * Room for the perfect-landing stamp: the safe-area edges, and the lowest top-centre HUD edge it
   * must stay under (one callout line under the combo meter, or the avalanche unit and its tag
   * during a chase). Null before the first layout read.
   */
  stampRoom(): { left: number; right: number; top: number } | null {
    const r = this.room;
    if (!r.measured) return null;
    const line = 1.68 * this.hudPx() + 2;
    // In a chase the unit hangs right under the race row, and the combo and callout line under it.
    const top = this.chased.on ? Math.max(this.avBox.y1 + 10, r.slotTop + line + 8) : r.slotTop + 2 * line + 8;
    return { left: r.left, right: r.right, top };
  }

  /**
   * The top of the bottom-centre pill row while its drift or slipstream pill shows, for a stamp placed
   * under the rider on a phone held upright (Fx stampSpot), or null: an empty row covers nothing, and
   * a pill that would come while the stamp sits there waits for it (stampLow).
   */
  bottomRoom(): number | null {
    const r = this.room;
    return r.measured && r.bcTop > 0 && (this.driftOn.on || this.draftOn.on) ? r.bcTop : null;
  }

  /** The overlay's base type size (--u on .gs-ui in style.css): the stamp and the menus use it. */
  unitPx(): number {
    return Math.max(14, Math.min(18, 8 + 0.009 * Math.min(window.innerWidth, window.innerHeight)));
  }

  /**
   * The HUD's own type size (--u on .gs-hud and .gs-notices in style.css). On wide screens it grows
   * with the height: at 1280 x 720 the base size set "PASSED" and the mood chip at 10 to 11 px.
   */
  hudPx(): number {
    const w = window.innerWidth;
    const hh = window.innerHeight;
    return w >= hh ? Math.max(14, Math.min(22, 7.5 + 0.0125 * hh)) : this.unitPx();
  }

  /** While the reveal card is up, the mood chip waits so the card can collapse into it. */
  setRevealing(on: boolean): void {
    this.revealing = on;
    if (this.moodOn.set(this.moodWanted && !on)) this.onLayout();
    if (!on && this.moodWanted) play(this.moodEl, [{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 320, easing: 'ease-out' });
  }

  get moodVisibleSoon(): boolean {
    return this.moodWanted && this.layer.open;
  }

  bumpScore(): void {
    bump(this.scoreEl, 1.14, 300);
  }

  /**
   * A cash-in's figure is on its way to the score (Fx.cashIn): the sim already counts its points, so the
   * score holds them back (shownScore) until the figure lands, and the figure flies into a number that
   * then takes it. Display only: sim.score is untouched.
   */
  holdScore(id: number, points: number): void {
    this.scoreHold.hold(id, points);
  }

  /**
   * The figure landed (or gave way to a newer cash-in, or the HUD is going): the score shows its points
   * from this frame on, at once (the landing's bumpScore punches it). No id releases every hold.
   */
  releaseScore(id?: number): void {
    if (this.scoreHold.release(id) && this.layer.open) this.score.num(shownScore(this.lastScore, this.scoreHold.held));
  }

  /**
   * A mid-run New best: the score flashes gold-white (your best's colour) for 0.6 s with a punch. The
   * colour snaps; reduced motion keeps the colour and drops the punch.
   */
  flashBest(): void {
    this.scoreEl.classList.add('is-best');
    bump(this.scoreEl, 1.2, 380);
    window.clearTimeout(this.bestTimer);
    this.bestTimer = window.setTimeout(() => this.scoreEl.classList.remove('is-best'), BEST_FLASH_MS);
  }

  /** Best combo pace: the stake line (gold-white from here, through the model's pace flag) punches once. */
  paceHit(): void {
    this.stakePace.set(this.stakeOn.on);
    bump(this.stakeEl, 1.3, 420);
  }

  /** Where a cash-in or a cracked figure sits: the combo total's row (last measured), or null. */
  bankAnchor(): { x: number; y: number } | null {
    return this.rowAt ?? this.comboAt;
  }

  /**
   * Taking the lead: screen readers hear "Into the lead", and the crown on the place pill pulses with a
   * gold-white ring as soon as the pill shows first place (the rank settles a moment after the beat).
   */
  lead(): void {
    this.say('Into the lead');
    this.leadAt = performance.now();
    this.leadDone = false;
    if (this.placeFirst.on) this.playLead();
  }

  /**
   * A ghost rode past your wreck (a wreck passedBy beat; the beat router calls this before its flash).
   * The standings cross at 0 m, before the director's wreck pass, so the new place is already wanted:
   * it shows in this frame's update with no RANK_SETTLE_MS, and the chip steps on the pill's frame
   * ("2nd" beside "SparkleCedar PASSED YOU", never "1st" for a beat). One shot: the next update spends it.
   */
  rankNow(): void {
    this.rankNowF = true;
  }

  private playLead(): void {
    this.leadDone = true;
    play(
      this.crown,
      [
        { transform: 'translateY(0.3em) scale(0.4)', opacity: 0.3 },
        { transform: 'translateY(-0.12em) scale(1.5)', opacity: 1, offset: 0.45 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 560, easing: SPRING },
    );
    if (!reduced()) play(this.placeRing, [{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.22, 1.6)' }], { duration: 760, easing: EASE_OUT });
  }

  /**
   * A banked combo's number holds where the combo meter is for `ms` before it flies to the score: a
   * new combo's total waits under it for that long, so the two numbers never print over each other.
   * `snap` (a lost combo's crack): the whole meter goes in this same frame, with no fade, so no "x5"
   * chip or stake line shows beside the cracked figure.
   */
  holdComboRow(ms: number, snap = false): void {
    this.banking.set(true);
    this.snapped.set(snap);
    window.clearTimeout(this.bankTimer);
    this.bankTimer = window.setTimeout(() => {
      this.banking.set(false);
      this.snapped.set(false);
    }, ms);
  }

  /**
   * Polite screen-reader announcement. A live region only speaks when its text changes, so the same
   * words twice in a row (a second "Avalanche close behind") get a trailing no-break space.
   */
  say(text: string): void {
    // One frame's beats can say several things in one task ("Passed Mika", then "Into the lead"), and a
    // live region reads only its last text, so a task's lines are written once, together.
    if (this.sayQ.push(text) > 1) return;
    queueMicrotask(() => {
      const t = this.sayQ.join('. ');
      this.sayQ.length = 0;
      this.live.textContent = this.live.textContent === t ? t + NBSP : t;
    });
  }

  /**
   * A ghost overtake, flashed inside the race row: the next-ghost pill shows "Passed <name>" with a
   * mint pulse, or, quieter and shorter, "<name> passed you" (the name in off-white or its kind
   * colour, no glow), and then hands back to the next target. The rank pill ticks on its own when the
   * standings change. Your own best run is "Your best" here too (contract C7): "Passed Your best",
   * "Your best passed you". One message per beat: a pass waits while the perfect-landing stamp is up,
   * and "passed you" also waits while a pass of yours flashes; each then plays in turn (a pass that
   * waited too long is stale and dropped). Screen readers hear it at once.
   */
  flashPass(name: string, kind: GhostKind, passed: boolean, text = 'Passed', word = 'passed'): void {
    const shown = shownName(name, kind);
    const spoken = kind === 'you' ? 'your best' : name;
    if (!passed) {
      this.say(`${shown} passed you`);
      // While a duel (or its result) holds the pill, another ghost's news goes to the line.
      if (duelRoute(this.owner(), name, 'lost') === 'line') this.onSideLine({ text: `${shown} passed you`, tone: 'normal', key: name, name: shown });
      else this.flash({ type: 'lost', name: shown, raw: name, kind, k: '', tail: 'passed you', ms: LOST_MS, strong: false, at: 0, stale: PEND_MS });
      return;
    }
    const k = text.trim() || 'Passed';
    const strong = STRONG_WORDS.has(word);
    // A duel result can arrive twice (its pass and its duel beat): it shows once.
    if (strong) {
      const key = `${k}|${shown}`;
      const now = performance.now();
      if (key === this.lastStrong.key && now - this.lastStrong.at < SAME_MS) return;
      this.lastStrong.key = key;
      this.lastStrong.at = now;
    }
    this.say(`${k} ${spoken}`);
    const owner = this.owner();
    const { raw, kind: as } = word === 'slung' ? burstName(this.burst, name, kind, performance.now(), owner) : { raw: name, kind };
    const nm = shownName(raw, as);
    if (duelRoute(owner, raw, 'pass') === 'line') {
      this.onSideLine({ text: `${k} ${nm}`, tone: strong ? 'big' : 'normal', key: word === 'slung' ? SLUNG_KEY : raw, name: nm });
      return;
    }
    this.flash({ type: 'pass', name: nm, raw, kind: as, k, tail: '', ms: strong ? STRONG_MS : FLASH_MS, strong, at: 0, stale: PEND_MS, word });
  }

  /**
   * A duel just resolved (won, held off or lost; the beat router calls this before its flash). The
   * pill stays on that ghost, as the director keeps out.rival, the C11 ring and the edge chip there:
   * while its result waits its turn (under a banner or the landing stamp), then for DUEL_HOLD_MS from
   * when the result first shows, so it keeps the pill for its whole flash. Meanwhile another ghost's
   * pass, "passed you" or news goes to the callout line, as during the duel; nothing about another
   * ghost waits. A result already up (its pass beat came first) counts from when it showed.
   */
  holdDuel(name: string): void {
    const now = performance.now();
    this.held.name = name;
    this.held.at = now;
    const up = this.cur !== null && this.cur.raw === name && isResult(this.cur) && this.flashUntil > now;
    this.held.until = (up ? this.flashAt : now) + DUEL_HOLD_MS;
    this.held.wait = !up;
    this.sendAside(name);
  }

  /**
   * A duel (or its result) takes the pill: the flashes still waiting about other ghosts, and news,
   * go to the callout line while they are fresh, rather than being lost ("Passed RidgeUlla" waited
   * behind a landing stamp, then the duel opened and it never showed).
   */
  private sendAside(owner: string): void {
    const now = performance.now();
    for (let i = 0; i < this.pend.length; ) {
      const p = this.pend[i];
      if (p.result || duelRoute(owner, p.raw, p.type) !== 'line') {
        i++;
        continue;
      }
      this.pend.splice(i, 1);
      if (now - p.at <= p.stale) this.onSideLine(sideWord(p));
    }
  }

  /** The ghost a duel or its result holds the pill for, or null (pillOwner). */
  private owner(): string | null {
    // The result still waits its turn: its hold has not begun.
    const waiting = this.held.wait && this.pend.some((p) => this.heldResult(p));
    return pillOwner(this.duelName, this.held, performance.now(), this.dirHold, waiting);
  }

  /** Whether a flash is the held duel's result ("Held off Mila", "Duel won Mila", "Mila pulled away"). */
  private heldResult(f: Flash): boolean {
    return this.held.name !== '' && f.raw === this.held.name && (isResult(f) || f.result === true);
  }

  /**
   * Race news in the pass-flash slot: a quiet line, the ghost's name (when the text leads with it) in
   * its kind colour and the rest in off-white ("Tess wiped out", "Your best wiped out", "1 more ghost
   * opens Frostfang Glacier"). It never cuts a pass, waits behind one, and is the first thing dropped.
   * `wait` is how long it may wait its turn: a line that only ever comes with a pass (the unlock
   * tease) waits as long as a pass does, or it would always go stale behind its own pass. While a duel
   * or its result holds the pill every news line takes the callout line, except `result`: a lost
   * duel's "pulled away", which is that duel's result.
   */
  news(name: string, kind: GhostKind, text: string, wait = NEWS_PEND_MS, result = false): void {
    const t = text.trim();
    if (t === '') return;
    this.say(t);
    if (!result && duelRoute(this.owner(), name, 'news') === 'line') {
      this.onSideLine({ text: t, tone: 'normal', key: newsKey(name, t), name: shownName(name, kind) });
      return;
    }
    const shown = shownName(name, kind);
    let lead = '';
    let tail = t;
    for (const n of [shown, name]) {
      if (n !== '' && t.startsWith(n) && (t.length === n.length || t[n.length] === ' ' || t[n.length] === "'")) {
        lead = n;
        tail = t.slice(n.length).trim();
        break;
      }
    }
    this.flash({ type: 'news', name: lead, raw: name, kind, k: '', tail, ms: NEWS_MS, strong: false, at: 0, stale: wait, line: t, result });
  }

  /**
   * Takes a news line back once it is no longer true ("1 more ghost opens Frostfang Glacier" after the
   * pass that opened it): dropped while it waits its turn, or ended at once if it is up.
   */
  retract(text: string): void {
    const t = text.trim();
    for (let i = this.pend.length - 1; i >= 0; i--) if (this.pend[i].line === t) this.pend.splice(i, 1);
    const now = performance.now();
    if (this.cur && this.cur.line === t && this.flashUntil > now) this.flashUntil = now;
  }

  /**
   * The start-line call, in the pill's flash state for 2.6 s with its ring pulsing at the C11 marker's
   * 1.2 Hz: the word and the name ("REMATCH Mila", "CHASE Your best"), no gap number (C12 holds).
   * Screen readers hear the margin too (sr). Reduced motion: no slide and no ring pulse.
   */
  call(word: string, name: string, kind: GhostKind, srText: string): void {
    const shown = shownName(name, kind);
    this.say(srText.trim() || `${word} ${kind === 'you' ? 'your best' : name}`);
    // A call that only comes once a duel holds the pill (the field loaded late) would name one ghost
    // while the C11 ring and the edge chip stay on the duel's: the duel is the race now.
    const owner = this.owner();
    if (owner !== null && owner !== name) return;
    this.flash({ type: 'call', name: shown, raw: name, kind, k: word, tail: '', ms: CALL_MS, strong: false, at: 0, stale: PEND_MS });
  }

  /**
   * One message at a time in the pill. The landing stamp holds them all, and so does a banner over the
   * race row (a pass under a mission toast played in the hidden pill): they wait and play once it has
   * gone. A pass of yours takes the pill at once (the newest pass is the news); the call yields only to
   * a pass; "passed you" and news wait behind a pass or the call, and news also waits behind "passed you".
   */
  private flash(f: Flash): void {
    const now = performance.now();
    f.at = now;
    const cur = this.flashUntil > now && this.nextFlash.on ? this.cur : null;
    const band = this.bandHides();
    let wait = this.stampUp() || band;
    if (!wait && cur) {
      if (f.type === 'call') wait = cur.type === 'pass';
      else if (f.type === 'lost') wait = cur.type === 'pass' || cur.type === 'call';
      else if (f.type === 'news') wait = cur.type !== 'news';
    }
    // Something already waits its turn (the banner or the stamp let go this very frame): the call,
    // "passed you" and news queue behind it. A pass of yours is the news and still goes up at once.
    if (!wait && f.type !== 'pass' && this.pend.length > 0) wait = true;
    if (!wait) {
      this.showFlash(f, now);
      return;
    }
    f.band = band;
    enqueueFlash(this.pend, f);
  }

  /**
   * The perfect-landing stamp just landed and takes the moment: a pass flash that only just started
   * (the same beat) steps back and plays after the stamp; an older one has had its moment and ends.
   */
  yieldToStamp(): void {
    this.stepBack(false);
  }

  /**
   * The flash up now ends for something that takes the moment (the landing stamp, or a banner over the
   * race row); one that only just started (REQUEUE_MS) steps back to the head of the queue.
   */
  private stepBack(band: boolean): void {
    const now = performance.now();
    if (!this.nextFlash.on || this.flashUntil <= now) return;
    const c = this.cur;
    if (c && now - this.flashAt < REQUEUE_MS) {
      c.at = now;
      c.band = band;
      this.pend.unshift(c);
      if (this.pend.length > 2) this.pend.length = 2;
      // A duel's result stepping back keeps its ghost on the pill, and its hold starts again when it plays.
      if (this.heldResult(c)) this.held.wait = true;
    }
    this.flashUntil = now;
  }

  private showFlash(f: Flash, now: number): void {
    // A duel's result: the pill stays its ghost's for DUEL_HOLD_MS from now (holdDuel).
    if (this.held.wait && this.heldResult(f)) {
      this.held.wait = false;
      this.held.until = now + DUEL_HOLD_MS;
    }
    this.cur = f;
    this.flashAt = now;
    this.flashUntil = now + f.ms;
    this.nextFlash.set(true);
    this.nextLost.set(f.type === 'lost');
    this.nextNews.set(f.type === 'news');
    this.nextCall.set(f.type === 'call');
    this.nextStrong.set(f.strong);
    this.nextDuel.set(false);
    this.nextK.str(f.k);
    this.nextName.str(f.name);
    this.nameShown = '';
    this.nextTail.str(f.tail);
    this.setKind(f.kind);
    this.nextFriend.set(f.kind === 'friend' && f.name !== '');
    this.nextOn.set(true);
    if (f.type === 'pass') {
      const peak = f.strong ? 1.13 : 1.08;
      play(this.nextEl, [{ transform: 'scale(0.84)' }, { transform: `scale(${peak})`, offset: 0.5 }, { transform: 'scale(1)' }], { duration: f.strong ? 380 : 340, easing: 'ease-out' });
      play(this.nextRing, [{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: f.strong ? 'scale(1.26, 1.8)' : 'scale(1.18, 1.5)' }], { duration: f.strong ? 720 : 620, easing: EASE_OUT });
      // The ghost you passed falls behind: it slips out of its icon to the left (clipped there, so
      // it never floats loose beside the pill).
      play(this.nextTrail, [{ opacity: 0.9, transform: 'translateX(0) scale(1)' }, { opacity: 0, transform: 'translateX(-18px) scale(0.7)' }], { duration: 700, delay: 80, easing: EASE_OUT, fill: 'both' });
      this.onPassFlash();
    } else if (f.type === 'call') {
      // The call slides in from above and its ring pulses three times at the marker's beat.
      play(this.nextEl, [{ opacity: 0, transform: 'translateY(-10px) scale(0.92)' }, { opacity: 1, transform: 'scale(1.05)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'ease-out' });
      if (!reduced()) play(this.nextRing, [{ opacity: 0.9, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.14, 1.45)' }], { duration: RING_HZ_MS, iterations: 3, easing: EASE_OUT });
      this.onPassFlash();
    } else {
      // A small settle, no punch, shake or ring: losing a place, or a ghost's wipeout, is news, not a
      // celebration.
      play(this.nextEl, [{ opacity: 0.75, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: 'ease-out' });
    }
    this.onLayout();
  }

  private setKind(kind: GhostKind): void {
    if (kind === this.lastKind) return;
    this.nextEl.classList.remove('k-ghost', 'k-grudge', 'k-you');
    this.nextEl.classList.add(kindCls(kind));
    this.lastKind = kind;
  }

  /**
   * Avalanche unit size (contract C2, shared with the mirror in src/render/world.ts). Landscape: W
   * wide (about 19% of the screen, 196 to 246 px, so the horizon and the sun stay open), the mirror
   * W x 0.4 W, and the meter, inset 8 px from each side, set into its bottom edge. Portrait: the
   * mirror about 25% smaller (33% of the width, up to 143 px, a little wider than tall at 0.36 W) hangs
   * 6 px under the race row alone, and the meter rides in the race row in the rival pill's place, the
   * race row's height, so the top HUD keeps to about a fifth of a phone's height (it took 27%). The gap numeral is the combo total's size (22 px on a
   * phone). CSS stacks the unit in the top-centre column; measure() reads where it landed.
   */
  private fit(): void {
    const w = window.innerWidth;
    const portrait = w < window.innerHeight;
    const u = this.hudPx();
    // At least 196 px in landscape: on a phone held sideways 19% left the meter's track about 80 px long.
    const W = Math.round(portrait ? Math.min(0.33 * w, 143) : Math.min(Math.max(0.187 * w, 196), 246));
    // In portrait the meter is the race row's height (--race-h in style.css: 2.5 units, at least 36 px).
    const bar = portrait ? Math.round(Math.max(36, 2.5 * u)) : 34;
    const meter = portrait ? Math.round(Math.min(0.56 * w, 236)) : W - 16;
    const f = portrait ? 22 : Math.max(22, Math.min(34, 1.75 * u));
    this.meterW = meter;
    this.gapF = f;
    // The hazard disc and the rider badge (bar - 6 across, 3 px in from each end) bound the track.
    this.wallMin = bar - 3;
    this.badgeL = meter - 3 - (bar - 6);
    this.wallMax = this.badgeL;
    this.wallX = Number.NaN;
    this.gapX = Number.NaN;
    this.lastDanger = -1;
    if (portrait !== this.portrait || !this.dangerEl.parentElement) {
      this.portrait = portrait;
      this.el.classList.toggle('is-portrait', portrait);
      (portrait ? this.race : this.avEl).append(this.dangerEl);
    }
    this.el.parentElement?.classList.toggle('gs-chase-p', portrait && this.chased.on);
    this.el.style.setProperty('--av-w', `${W}px`);
    this.el.style.setProperty('--av-mh', `${Math.round(W * (portrait ? 0.36 : 0.4))}px`);
    this.el.style.setProperty('--av-bar', `${bar}px`);
    this.el.style.setProperty('--avm-w', `${meter}px`);
    this.el.style.setProperty('--av-num', `${Math.round(f)}px`);
    this.el.style.setProperty('--av-tab', `${Math.round(1.75 * Math.min(u, 17.5))}px`);
    // One tick every 10 m, counted back from the rider badge.
    this.el.style.setProperty('--av-tick', `${(((this.wallMax - this.wallMin) * TICK_M) / DANGER_FAR).toFixed(2)}px`);
    this.onLayout();
  }

  /**
   * Pushes the viewport rects of every visible HUD element into `out` from index `n` and returns the
   * new count. Called by the UI once per layout change, after the frame's DOM writes.
   */
  measure(out: ScreenRect[], n: number): number {
    if (!this.layer.open) return n;
    // The score and combo positions are kept even while the combo is hidden: the cash-in flies
    // between them without reading layout.
    this.scoreAt = centre(this.scoreEl, this.scoreAt);
    this.comboAt = centre(this.comboEl, this.comboAt);
    // The total's row, from its layout box: the meter's hidden state is scaled and nudged up, which a
    // transformed rect would carry into the cash-in's anchor.
    this.rowAt = layoutCentre(this.comboRow, this.rowAt);
    this.readLayout();
    // The top-left block carries the distance, "Best in 240 m", the mood chip and the countdown chip.
    n = pushRect(out, n, this.tl);
    if (this.cdOn.on) n = pushRect(out, n, this.cdEl);
    if (this.bestInOn.on) n = pushRect(out, n, this.bestInEl);
    n = pushRect(out, n, this.tr);
    if (this.placeOn.on && !this.bandHides()) n = pushRect(out, n, this.placeEl);
    if (this.nextOn.on && !this.bandHides()) n = pushRect(out, n, this.nextEl);
    if (this.comboOn.on) n = pushRect(out, n, this.comboEl);
    // The "Flow" tag hangs outside the meter's box.
    if (this.comboOn.on && this.flowOnF.on) n = pushRect(out, n, this.flowTag);
    if (this.stakeOn.on) n = pushRect(out, n, this.stakeEl);
    for (const c of Array.from(this.calloutSlot.children)) if (!c.classList.contains('is-gone')) n = pushRect(out, n, c);
    // A drift or slipstream pill fading out is still drawn: it keeps its rect through the fade.
    const now = performance.now();
    if (this.driftOn.on || pillHeld(this.driftGoneAt, now)) n = pushRect(out, n, this.driftEl);
    if (this.draftOn.on || pillHeld(this.draftGoneAt, now)) n = pushRect(out, n, this.draftEl);
    if (this.dangerOn.on) {
      n = pushRect(out, n, this.mirrorBox);
      n = pushRect(out, n, this.dangerEl);
    }
    return n;
  }

  /**
   * Caches the mirror's rect, the unit's box and the stamp's room (the bottom-centre row's top with
   * it). The unit and the row are laid out even while hidden, so their rects are ready the frame they
   * are needed.
   */
  private readLayout(): void {
    const m = this.mirrorBox.getBoundingClientRect();
    if (m.width > 0 && m.height > 0) {
      this.mirror.x = Math.round(m.left);
      this.mirror.y = Math.round(m.top);
      this.mirror.w = Math.round(m.width);
      this.mirror.h = Math.round(m.height);
    }
    const u = this.avEl.getBoundingClientRect();
    if (u.width > 0) {
      this.avBox.x0 = u.left;
      this.avBox.y0 = u.top;
      this.avBox.x1 = u.right;
      this.avBox.y1 = u.bottom;
    }
    const l = this.tl.getBoundingClientRect();
    const r = this.tr.getBoundingClientRect();
    if (r.width > 0) {
      this.room.left = l.left;
      this.room.right = r.right;
      this.room.slotTop = this.calloutSlot.getBoundingClientRect().top;
      this.room.bcTop = this.bc.getBoundingClientRect().top;
      this.room.measured = true;
    }
  }

  /** Last measured centre of the score or the combo meter, or null before the first measure. */
  centreOf(el: HTMLElement): { x: number; y: number } | null {
    return el === this.scoreEl ? this.scoreAt : el === this.comboEl ? this.comboAt : null;
  }

  /**
   * A banner docks over the race row while it shows (the row fades out under it). In a portrait
   * chase the row carries the avalanche meter, so the banner docks under it instead.
   */
  private bandHides(): boolean {
    const c = this.el.parentElement?.classList;
    return c !== undefined && c.contains('gs-band-on') && !c.contains('gs-chase-p');
  }

  update(m: HudModel): void {
    let moved = false;
    // A cash-in still on its way holds its points back (holdScore): the figure lands in the score.
    this.lastScore = m.score;
    this.score.num(shownScore(m.score, this.scoreHold.held));
    const sLen = this.scoreEl.textContent?.length ?? 0;
    if (sLen !== this.lastScoreLen) {
      this.lastScoreLen = sLen;
      moved = true;
    }
    this.dist.num(m.distance, NBSP + 'm');

    if (m.mood !== this.lastMood) {
      this.lastMood = m.mood;
      const info = moodInfo(m.mood);
      this.moodTxt.str(info.name);
      this.moodEl.dataset.mood = info.key;
      // Bright moods (white sky and ice) seat the score block on a soft ink plate (style.css).
      this.el.dataset.mood = info.key;
      // Night moods give every navy pill (the HUD's and the banners') a moon-blue hairline.
      this.el.parentElement?.classList.toggle('gs-night', NIGHT.has(m.mood));
      this.moodIco.replaceChildren(icon(MOOD_MOD[m.mood].icon));
      moved = true;
    }
    this.moodWanted = m.mood !== Mood.None;
    if (this.moodOn.set(this.moodWanted && !this.revealing)) moved = true;
    // A plain run has no mood chip at all, so a countdown chip takes the row's start (the chip holds its
    // place only while a reveal is about to collapse into it).
    if (this.moodGone.set(!this.moodWanted)) moved = true;

    if (this.gifts.num(m.gifts)) {
      if (this.lastGifts >= 0 && m.gifts > this.lastGifts) bump(this.giftsEl, 1.1, 240);
      this.lastGifts = m.gifts;
    }

    // Race position. A new rank must hold for a moment before it shows (ghosts bunched at the start
    // swap places every frame), then it ticks: a gain rolls the new place up in mint, a loss drops it in.
    const now = performance.now();
    // At a run's start the pill waits for the field's count to settle, so its first numbers are the
    // field's ("6th of 6"), never "1st of 2", "of 4", "of 5", "of 6" as each track comes ready.
    const field = m.place.of > 1;
    if (field && !this.placeReady) {
      if (this.ofFirstAt < 0 || m.place.of !== this.ofN) {
        if (this.ofFirstAt < 0) this.ofFirstAt = now;
        this.ofN = m.place.of;
        this.ofChangedAt = now;
      }
      this.placeReady = placeSettled(this.ofFirstAt, this.ofChangedAt, now);
    }
    const showPlace = field && this.placeReady;
    if (this.placeOn.set(showPlace)) moved = true;
    if (showPlace) {
      const r = m.place.rank;
      if (r !== this.wantRank) {
        this.wantRank = r;
        this.wantAt = now;
      }
      const settled = rankSettled(this.lastRank, this.wantAt, now, this.rankNowF);
      if (settled && (r !== this.lastRank || m.place.of !== this.lastOf)) {
        const prev = this.lastRank;
        this.lastRank = r;
        this.lastOf = m.place.of;
        const num = String(r);
        this.rankNum.str(num);
        this.rankSuf.str(ordinal(r).slice(num.length));
        this.placeFirst.set(r === 1);
        this.of.str(`of ${m.place.of}`);
        moved = true;
        if (prev > 0 && r !== prev) {
          const animate = now - this.tickAt > TICK_GAP_MS;
          if (animate) this.tickAt = now;
          this.tick(prev - r, animate);
        }
      } else if (m.place.of !== this.lastOf && m.place.of >= this.lastRank) {
        // The field's size is not a bunched rank: 'of N' follows each track that comes ready at once,
        // so a count read before the field loaded never lingers while the start bunch swaps places.
        this.lastOf = m.place.of;
        this.of.str(`of ${m.place.of}`);
        moved = true;
      }
    }
    this.rankNowF = false;
    // The lead beat's crown pulse plays once the pill shows first place (or gives up after a moment).
    if (!this.leadDone) {
      if (now - this.leadAt > LEAD_WAIT_MS) this.leadDone = true;
      else if (this.placeFirst.on) this.playLead();
    }

    // Next ghost. While a pass flashes in the pill, it holds; the target comes back after, unless a
    // pass that waited its turn (behind a landing stamp or a pass of yours) goes up next.
    const g = m.nextGhost;
    // The director's duel-result hold, when the game sends it (nextGhost.hold): out.rival, the C11 ring
    // and the edge chip stay on that ghost for exactly that long, and so do the pill's words.
    this.dirHold = g !== null && (g as { hold?: boolean }).hold === true ? g.name : null;
    // A duel's result still waiting RESULT_STALE_MS after the duel ended has missed its moment.
    if (this.held.wait && resultStale(this.held.at, now)) {
      this.held.wait = false;
      for (let i = this.pend.length - 1; i >= 0; i--) if (this.heldResult(this.pend[i])) this.pend.splice(i, 1);
    }
    // An open duel owns the pill (C1/C11): the moment one opens, a flash about another ghost (or news)
    // ends and the waiting ones go to the callout line (the start-line call keeps its turn); from then
    // on another ghost's pass and any news go to the callout line (duelRoute).
    const duelName = g !== null && g.duel === true ? g.name : null;
    if (duelName !== this.duelName) {
      this.duelName = duelName;
      if (duelName !== null) {
        const c = this.cur;
        if (c && this.flashUntil > now && duelRoute(duelName, c.raw, c.type) === 'line') this.flashUntil = now;
        this.sendAside(duelName);
      }
    }
    // A banner over the race row: a flash that only just started steps back and plays once it has gone;
    // once it goes, whatever waited under it starts its stale clock (releaseBand).
    const band = this.bandHides();
    if (band) {
      const named = this.bannerName();
      if (named) this.bandNamed.add(named);
    }
    if (band !== this.bandWas) {
      this.bandWas = band;
      if (band) {
        for (const p of this.pend) p.band = true;
        this.stepBack(true);
      } else {
        // "GRUDGE SETTLED Mila" was the picture of its pass ("Held off Mila"): that flash is spent.
        for (let i = this.pend.length - 1; i >= 0; i--) if (this.bandNamed.has(this.pend[i].raw)) this.pend.splice(i, 1);
        this.bandNamed.clear();
        releaseBand(this.pend, now);
      }
    }
    let flashing = this.flashUntil > now;
    if (!flashing && this.pend.length > 0 && !this.stampUp() && !band) {
      while (this.pend.length > 0 && now - this.pend[0].at > this.pend[0].stale) this.pend.shift();
      // A duel's result still holds the pill: a word about another ghost that waited behind it (after a
      // banner) takes the callout line instead.
      const owner = this.owner();
      if (owner !== null) this.sendAside(owner);
      const p = this.pend.shift();
      if (p) {
        this.showFlash(p, now);
        flashing = true;
      }
    }
    if (!flashing && this.nextFlash.on) {
      this.nextFlash.set(false);
      this.nextLost.set(false);
      this.nextNews.set(false);
      this.nextCall.set(false);
      this.nextStrong.set(false);
      this.cur = null;
      this.lastSide = 2;
      this.lastGap = Number.NaN;
      this.nameNow = true;
      moved = true;
    }
    if (!flashing) {
      if (this.nextOn.set(g !== null)) moved = true;
      // An open duel names its ghost "DUEL Mika" over the gap, its ring beating with the C11 marker's.
      const duel = duelName !== null;
      if (this.nextK.str(duel ? 'Duel' : '')) moved = true;
      if (this.nextDuel.set(duel) && duel) {
        play(this.nextEl, [{ transform: 'scale(0.9)' }, { transform: 'scale(1.06)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
        moved = true;
      }
      if (g) {
        // A new target name also has to hold for a moment (a bunched pack swaps the nearest ghost),
        // except a duel's ghost, which shows at once.
        if (g.name !== this.wantName) {
          this.wantName = g.name;
          this.wantNameAt = now;
        }
        if (duel || this.nameNow || now - this.wantNameAt >= RANK_SETTLE_MS || this.nextName.el.textContent === '') {
          this.nameNow = false;
          if (g.name !== this.nameShown) {
            // A new name brings its own gap in the same frame.
            this.nameShown = g.name;
            this.lastSide = 2;
            this.lastGap = Number.NaN;
          }
          if (this.nextName.str(shownName(g.name, g.kind))) moved = true;
          this.setKind(g.kind);
          if (this.nextFriend.set(g.kind === 'friend')) moved = true;
        }
      }
      // The gap beside a name is that ghost's own: while a new name settles, the shown one keeps its
      // last gap rather than taking the newcomer's.
      if (g && g.name === this.nameShown) {
        // Level under 1.5 m, with a little hysteresis so the readout does not flicker at the edge.
        const a = Math.abs(g.gap);
        const side = a < (this.lastSide === 0 ? 1.9 : 1.5) ? 0 : g.gap > 0 ? 1 : -1;
        if (side !== this.lastSide) {
          this.lastSide = side;
          this.lastGap = Number.NaN;
          this.nextAhead.set(side > 0);
          this.nextBehind.set(side < 0);
          this.nextEven.set(side === 0);
          moved = true;
        }
        // On a phone held upright an open duel says "level" for neck and neck: "DUEL", the name and
        // "neck and neck" left the name about 7 letters at 390 px ("DUEL MarmotM...").
        if (this.nextWord.str(side === 0 ? (duel && this.portrait ? 'level' : 'neck and neck') : side > 0 ? 'ahead' : 'behind')) moved = true;
        // The game's held gap as it is (the edge chip's number), or the HUD's own hold on a raw gap.
        const r = side === 0 ? -1 : pillGap(g.gap, this.lastGap, now - this.gapAt);
        if (r !== this.lastGap) {
          this.lastGap = r;
          this.gapAt = now;
          const s = side === 0 ? '' : String(r);
          this.nextGap.str(s);
          if (s.length !== this.lastGapLen) {
            this.lastGapLen = s.length;
            moved = true;
          }
        }
      }
    }

    // Combo.
    const c = m.combo;
    if (this.comboOn.set(c.active)) moved = true;
    // The total is up whenever the combo is: a timer bar with nothing over it read as an empty slot.
    // At x1 the multiplier chip stays out ("x1" would only say nothing is multiplied yet), so "x"
    // only ever appears once there is a real multiplier.
    const total = c.active;
    if (this.comboTotal.set(total) && total && this.comboOn.on) bump(this.comboRow, 1.16, 260);
    if (c.active) {
      if (this.comboPts.num(c.pending, '', '+')) moved = true;
      if (this.multX1.set(c.mult < 2)) moved = true;
      if (this.mult.str('x' + c.mult)) {
        if (c.mult > this.lastMult && this.lastMult > 0) bump(this.multEl, 1.25, 280);
        this.lastMult = c.mult;
      }
      const t = Math.max(0, Math.min(1, c.timer));
      if (Math.abs(t - this.lastTimer) > 0.004) {
        this.lastTimer = t;
        this.comboBar.style.transform = `scaleX(${t.toFixed(3)})`;
      }
      this.comboLow.set(t < 0.25);
      this.lastCombo.pending = c.pending;
      this.lastCombo.mult = c.mult;
      this.lastCombo.stake = Math.round(c.stake ?? c.pending * c.mult);
    } else {
      this.lastMult = 0;
      this.comboLow.set(false);
      // Flow is per combo: with no combo up there is no chip to ring, and the next combo starts clean.
      if (this.flowOnF.on) this.flowState('off');
    }

    // The number at stake, from x2 (at x1 the total above already is it). Gold-white once it passes
    // your best combo; a fuse while a big stake drains, its throb quickening in bands as the timer runs
    // out (bands, not a rate per frame, so the CSS loop never jumps phase every frame). The meter wears
    // the same band, where the eye is: the timer's fill turns amber and the multiplier chip throbs on
    // the stake's beat (the multiplier cashes in unless a move is added).
    const stake = Math.round(c.stake ?? 0);
    const showStake = c.active && c.mult >= 2 && stake > 0;
    if (this.stakeOn.set(showStake)) moved = true;
    if (showStake && this.stakeNum.num(stake)) {
      const len = this.stakeNum.el.textContent?.length ?? 0;
      if (len !== this.lastStakeLen) {
        this.lastStakeLen = len;
        moved = true;
      }
    }
    this.stakePace.set(showStake && c.pace === true);
    const fuse = showStake ? (c.fuse ?? 0) : 0;
    const fb = fuse <= 0 ? 0 : fuse < 0.5 ? 1 : fuse < 0.8 ? 2 : 3;
    if (fb !== this.lastFuse) {
      this.lastFuse = fb;
      this.stakeEl.dataset.fuse = String(fb);
      this.comboEl.dataset.fuse = String(fb);
    }

    // Your best within 250 m, under the distance.
    const bi = m.bestIn ?? null;
    const showBi = bi !== null && bi > 0;
    if (this.bestInOn.set(showBi)) moved = true;
    if (showBi) this.bestInNum.num(bi);

    // The rolled event's countdown chip (it goes at the warn, before any chase opens).
    const cd = m.countdown ?? null;
    const showCd = cd !== null && cd.event !== ChaosEvent.None && EVENT_SHORT[cd.event] !== '';
    if (showCd && cd.event !== this.lastCd) {
      this.lastCd = cd.event;
      const key = eventInfo(cd.event).key;
      this.cdEl.classList.remove('e-avalanche', 'e-yeti', 'e-giftstorm', 'e-ghosttrain');
      this.cdEl.classList.add(`e-${key}`);
      this.cdIco.replaceChildren(icon(EVENT_ICON[cd.event]));
      this.cdName.str(EVENT_SHORT[cd.event] + ' ');
      this.cdTiny.str(EVENT_TINY[cd.event] + ' ');
    }
    if (this.cdOn.set(showCd)) {
      moved = true;
      if (showCd) {
        this.say(`${EVENT_SHORT[cd.event]} in ${Math.round(cd.metres)} metres`);
        play(this.cdEl, [{ opacity: 0, transform: 'translateY(-4px) scale(0.86)' }, { opacity: 1, transform: 'scale(1.06)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
      }
    }
    if (showCd) {
      if (this.cdNum.num(cd.metres) && (this.cdNum.el.textContent?.length ?? 0) < 3) moved = true;
      this.cdNear.set(cd.metres <= 100);
    }

    // Drift tier. On a phone held upright a stamp sitting under the rider holds this row's pills back
    // until it goes (stampLow): it was placed while they were out, in the band they share.
    const low = this.stampLow();
    const tier = Math.max(0, Math.min(3, Math.round(m.driftTier)));
    if (this.driftOn.set(tier > 0 && !low)) {
      moved = true;
      if (!this.driftOn.on) this.driftGoneAt = now;
    }
    if (tier > 0 && tier !== this.lastTier) {
      if (tier > this.lastTier && this.lastTier > 0) bump(this.driftEl, 1.12, 240);
      this.driftEl.dataset.tier = String(tier);
    }
    this.lastTier = tier;

    // Slipstream.
    const lit = m.draft > 0 ? Math.max(1, Math.min(CHEVRONS, Math.ceil(m.draft * CHEVRONS))) : 0;
    this.draftWant = lit > 0;
    if (this.draftOn.set(lit > 0 && !low)) {
      moved = true;
      if (!this.draftOn.on) this.draftGoneAt = now;
    }
    this.draftFull.set(m.draft >= 0.999);
    if (lit !== this.lastChev) {
      this.lastChev = lit;
      for (let i = 0; i < CHEVRONS; i++) this.chevs[i].set(i < lit);
    }
    // A pill that just went is still drawn while it fades, so its rect stays in the occluders (measure)
    // until the fade has ended: the release frame took it out at once, and the edge chip landed on
    // DRIFT. Once the last fade ends, the occluders are measured again without it.
    const fading = (!this.driftOn.on && pillHeld(this.driftGoneAt, now)) || (!this.draftOn.on && pillHeld(this.draftGoneAt, now));
    if (fading !== this.pillFading) {
      this.pillFading = fading;
      if (!fading) moved = true;
    }

    // Avalanche: the wall advances over the track in proportion to the gap, and the gap number rides in
    // the open track between the wall's front and the rider badge (transform only).
    const d = m.danger;
    const wasChased = this.dangerOn.on;
    if (this.dangerOn.set(d !== null)) {
      moved = true;
      if (d) this.say(`Avalanche chasing, ${Math.round(d.gap)} metres behind`);
      else if (wasChased) this.dangerOffAt = performance.now();
    }
    if (this.chased.set(d !== null)) this.el.parentElement?.classList.toggle('gs-chase-p', this.portrait && d !== null);
    if (d) {
      const gap = Math.max(0, Math.round(d.gap));
      if (gap !== this.lastDanger) {
        this.lastDanger = gap;
        const num = String(gap);
        if (this.dangerGap.str(num)) moved = true;
        let band = 0;
        while (band < DANGER_BANDS.length && gap < DANGER_BANDS[band]) band++;
        if (band !== this.lastBand) {
          this.lastBand = band;
          this.avEl.dataset.band = String(band);
          this.edgeOn.set(band >= EDGE_BAND);
        }
        this.placeWall(gap, num.length);
      }
      if (this.dangerUrgent.set(gap < DANGER_URGENT) && gap < DANGER_URGENT) this.say('Avalanche close behind');
    } else {
      this.dangerUrgent.set(false);
      this.edgeOn.set(false);
      this.lastBand = -1;
      this.lastDanger = -1;
    }

    if (moved) this.onLayout();
  }

  /**
   * The wall's front sits in proportion between the hazard disc (DANGER_FAR or more) and the rider
   * badge (caught). The gap number rides centred in the open track while it fits there; closer in
   * it rides on the wall, just behind the front, so the front itself is never covered. Its width is
   * estimated from its font size (tabular digits), so nothing reads layout.
   */
  private placeWall(gap: number, digits: number): void {
    const near = 1 - Math.min(1, gap / DANGER_FAR);
    const front = Math.round(this.wallMin + near * (this.wallMax - this.wallMin));
    const cw = 6 + this.gapF * (0.58 * digits + 0.42);
    const open = this.badgeL - front;
    const cx = Math.round(open >= cw + 10 ? (front + this.badgeL) / 2 : Math.max(this.wallMin + cw / 2 + 2, front - 6 - cw / 2));
    if (front !== this.wallX) {
      this.wallX = front;
      this.wall.style.transform = `translate3d(${front - this.meterW}px, 0, 0)`;
    }
    if (cx !== this.gapX) {
      this.gapX = cx;
      this.dangerGapEl.style.transform = `translate3d(${cx}px, 0, 0) translateX(-50%)`;
    }
  }

  /**
   * A place change of `delta` places (positive: gained). The arrow and the count stand after the
   * numeral for a moment, where "of 7" was (a second change while they show adds to the count). A
   * gained place is the race's big beat: the numeral flips over to the new place, the pill punches up
   * and flashes mint, and the numeral holds mint for a moment before it snaps back (white, or
   * gold-white in first). The pass itself owns the glow ring, in the rival pill: two glowing pills at
   * once read as no event at all. A lost place ticks down: the new numeral drops in from above with a
   * little bounce and the pill dips. Transform and opacity only: the colour snaps, it is never animated.
   */
  private tick(delta: number, animate: boolean): void {
    const gain = delta > 0;
    const live = this.placeUp.on || this.placeDown.on;
    this.deltaSum = live && (this.deltaSum > 0) === gain ? this.deltaSum + delta : delta;
    this.placeDelta.str(String(Math.abs(this.deltaSum)));
    this.placeUp.set(gain);
    this.placeDown.set(!gain);
    window.clearTimeout(this.deltaTimer);
    this.deltaTimer = window.setTimeout(() => {
      this.deltaSum = 0;
      this.placeUp.set(false);
      this.placeDown.set(false);
    }, DELTA_MS);
    if (!animate) return;
    play(this.placeDeltaEl, [{ opacity: 0, transform: `translateY(${gain ? 0.4 : -0.4}em)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
    if (!gain) {
      play(
        this.rankEl,
        [
          { transform: 'translateY(-0.8em)', opacity: 0.5 },
          { transform: 'translateY(0.12em)', opacity: 1, offset: 0.6 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 340, easing: 'ease-out' },
      );
      play(this.placeEl, [{ transform: 'none' }, { transform: 'translateY(3px) scale(0.97)', offset: 0.35 }, { transform: 'none' }], { duration: 340, easing: SPRING });
      return;
    }
    // It never starts fully transparent or edge-on: in a bunched field the place can change every few
    // frames, and a restart from zero (or from past 90 degrees, its back to the lens) left the pill
    // reading " of 6" for as long as the field stayed bunched. From 60 degrees the new numeral is
    // already half height, so every frame of the flip still reads as a number.
    play(
      this.rankEl,
      [
        { transform: 'perspective(90px) rotateX(-60deg)', opacity: 0.7 },
        { transform: 'perspective(90px) rotateX(12deg)', opacity: 1, offset: 0.55 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 320, easing: 'ease-out' },
    );
    play(this.placeEl, [{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 460, easing: SPRING });
    // The flash peaks at about half strength, so the white numeral over it keeps its contrast.
    play(this.placeFlash, [{ opacity: 0.55 }, { opacity: 0 }], { duration: 440, easing: EASE_OUT });
    // The numeral stays white over the bright flash, then snaps to mint once the flash has thinned.
    const el = this.rankEl;
    el.classList.remove('is-gain');
    window.clearTimeout(this.gainTimer);
    this.gainTimer = window.setTimeout(() => {
      el.classList.add('is-gain');
      this.gainTimer = window.setTimeout(() => el.classList.remove('is-gain'), GAIN_MS);
    }, GAIN_DELAY_MS);
  }
}

function centre(el: HTMLElement, prev: { x: number; y: number } | null): { x: number; y: number } | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return prev;
  const p = prev ?? { x: 0, y: 0 };
  p.x = r.left + r.width / 2;
  p.y = r.top + r.height / 2;
  return p;
}

/**
 * An element's centre from its layout box inside its positioned parent (whose own rect carries the
 * column's centring), so transforms between them (a hidden meter's nudge and scale) never move it.
 */
function layoutCentre(el: HTMLElement, prev: { x: number; y: number } | null): { x: number; y: number } | null {
  const parent = el.offsetParent;
  if (!(parent instanceof HTMLElement) || el.offsetWidth === 0) return prev;
  const r = parent.getBoundingClientRect();
  const p = prev ?? { x: 0, y: 0 };
  p.x = r.left + parent.clientLeft + el.offsetLeft + el.offsetWidth / 2;
  p.y = r.top + parent.clientTop + el.offsetTop + el.offsetHeight / 2;
  return p;
}

/** Writes a padded box (CSS px) into the reused slot `out[n]`; returns the new count. */
export function pushBox(out: ScreenRect[], n: number, x0: number, y0: number, x1: number, y1: number): number {
  if (!(x1 > x0 && y1 > y0)) return n;
  let o = out[n];
  if (!o) {
    o = { x0: 0, y0: 0, x1: 0, y1: 0 };
    out[n] = o;
  }
  o.x0 = x0 - 4;
  o.y0 = y0 - 4;
  o.x1 = x1 + 4;
  o.y1 = y1 + 4;
  return n + 1;
}

/** Writes an element's padded viewport rect into the reused slot `out[n]`; returns the new count. */
export function pushRect(out: ScreenRect[], n: number, el: Element): number {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return n;
  let o = out[n];
  if (!o) {
    o = { x0: 0, y0: 0, x1: 0, y1: 0 };
    out[n] = o;
  }
  // A little padding: a tag that only grazes a pill still reads as clutter.
  o.x0 = r.left - 4;
  o.y0 = r.top - 4;
  o.x1 = r.right + 4;
  o.y1 = r.bottom + 4;
  return n + 1;
}
