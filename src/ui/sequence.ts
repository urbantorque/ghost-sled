import type { GhostKind, RankBarView, ResultsModel, RewardCard, RiderFace, UnlockedMountain } from './contract';
import type { InputMode } from '../game/input';
import { type Standing, aheadOf, byStanding, clock, margin, timeGap, gapSeconds } from '../game/standing';
import { SLEDS } from '../sim/sleds';
import { biomeArt, riderBust } from './art';
import { h, kbd, padBtn, sr, type Ctx } from './dom';
import { fmt, metres, NBSP, ordinal } from './fmt';
import { b9, ico9, medalDisc } from './kit9';
import { barShare, rewardGlyph } from './almanac';
import { EASE_OUT, reduced } from './motion';
import { curly, nb, prize, SAYS } from './words';

// Round 9 (U2): the results in three beats over the live scene, about 2.5 s (round 8's directed sequence was about
// five). One, how you did: the place, the word and the time, then one fact in words. Two, the one reward that matters
// most, turned over, with Rider Rank's bar filling at its foot and the gifts in words. Three, the one button, its
// reason under its words, then Home, Photo and Details. A tap or a key lands it whole; reduced motion shows the end;
// every beat keeps its sound through onResultsBeat. Everything else (every point of XP, the splits, the race, the
// missions, the stickers, the contracts met, the league, Watch Your Run and Save Clip) is Details, one level down.

/** When each beat lands (ms after the results open), and the bar's fill between. */
export const STORY_TIMING = {
  /** Beat one: the figure, then its word and time, then the fact. */
  FIGURE_MS: 0,
  WORD_MS: 260,
  FACT_MS: 520,
  /** Beat two: the card turns over; its bar fills FILL_MS from FILL_AT. */
  CARD_MS: 900,
  FILL_AT: 1250,
  FILL_MS: 760,
  /** Beat three: the button comes forward, then the foot. */
  BUTTON_MS: 2050,
  FOOT_MS: 2200,
  /** Everything has landed. */
  END_MS: 2600,
} as const;

/** The step each element waits for, by its data-beat (0 the figure ... 5 the foot). */
const BEAT_AT = [STORY_TIMING.FIGURE_MS, STORY_TIMING.WORD_MS, STORY_TIMING.FACT_MS, STORY_TIMING.CARD_MS, STORY_TIMING.BUTTON_MS, STORY_TIMING.FOOT_MS] as const;

/** One stretch of the bar's fill: on page `page`, from one share of the way to the next page to another. A run that
 *  turns a page fills to the top, turns, and fills on. */
export interface BarSegment {
  page: number;
  from: number;
  to: number;
}

/** The bar's segments from where the run started to where it ended. Whole pages between are shown at most twice
 *  (a returning save can open several at once). Empty when nothing moved. */
export function barSegments(before: RankBarView, after: RankBarView): BarSegment[] {
  const f0 = barShare(before);
  const f1 = barShare(after);
  if (after.page < before.page || (after.page === before.page && f1 <= f0)) return [];
  if (after.page === before.page) return [{ page: before.page, from: f0, to: f1 }];
  const out: BarSegment[] = [{ page: before.page, from: f0, to: 1 }];
  const whole = Math.min(2, after.page - before.page - 1);
  for (let i = 0; i < whole; i++) out.push({ page: after.page - whole + i, from: 0, to: 1 });
  if (f1 > 0) out.push({ page: after.page, from: 0, to: f1 });
  return out;
}

/** Each segment's start and length inside the fill's one stretch (FILL_AT to FILL_AT + FILL_MS), by its length. */
export function fillPlan(segs: readonly BarSegment[]): Array<{ at: number; ms: number }> {
  const T = STORY_TIMING;
  const total = segs.reduce((s, g) => s + (g.to - g.from), 0);
  let t: number = T.FILL_AT;
  return segs.map((g) => {
    const ms = total > 0 ? Math.max(120, Math.round((T.FILL_MS * (g.to - g.from)) / total)) : 0;
    const at = t;
    t += ms;
    return { at, ms };
  });
}

// ---------------------------------------------------------------- beat one: how you did

/** What kind of ending a run was: each gets its own colour and its own words. */
export type MomentKind = 'win' | 'podium' | 'finish' | 'wreck';

/** The one fact under the headline, its name kept apart so it can wear its colour ("0.4 s behind" + name). */
export interface MomentFact {
  before: string;
  name: string | null;
  after: string;
  tone: 'twelve' | 'best' | 'plain';
  /** The name's colour: a rider of The Twelve (their accent), a ghost (mint), the grudge (rose), your best (gold-white). */
  who: 'rider' | 'ghost' | 'grudge' | 'you' | null;
  rider: RiderFace | null;
}

/** The results' moment: the one thing the run was, said large. */
export interface Moment {
  kind: MomentKind;
  /** The place ("2nd"), how far a wreck got ("2,340 m"), a Trial's figure, or the time a Daily's medal was won on. */
  figure: string;
  /** "of 7" beside a place, a Trial's unit; empty otherwise. */
  of: string;
  /** The words under it, in the kind's own voice ("On the podium", "Silver on today's Daily"). */
  word: string;
  /** The finish time beside the word (null on a wreck, or when the time is the figure). */
  time: string | null;
  /** A medal's disc before the word: a Trial's, or a Daily's or a Cup's when the medal leads. */
  medal: number;
  fact: MomentFact | null;
}

/** The fact as one line of words (the screen reader's, and the tests'). */
export const factText = (f: MomentFact): string => `${f.before}${f.name ?? ''}${f.after}`;

const youAt = (m: ResultsModel): Standing => ({ time: m.finish?.seconds ?? null, distance: m.distance });
const ghostAt = (g: ResultsModel['ghosts'][number]): Standing => ({ time: g.time ?? null, distance: g.distance ?? 0 });
const MEDAL = ['', 'Bronze', 'Silver', 'Gold'] as const;

/** Where you finished: one more than the ghosts ahead of you in the race's order (standing.ts). */
export function placeOf(m: ResultsModel): { rank: number; of: number } | null {
  if (m.ghosts.length === 0) return null;
  const me = youAt(m);
  return { rank: 1 + m.ghosts.filter((g) => aheadOf(ghostAt(g), me)).length, of: m.ghosts.length + 1 };
}

/** The nearest rider: who was just ahead and by how much, or for a winner how far clear of the next. Margins are the
 *  rows' own ("0.4 s" between finishers, "85 m" between the rest); short: you stopped short of a finisher above. */
export interface NearLine {
  side: 'behind' | 'clear' | 'short';
  gap: string;
  name: string | null;
  kind: GhostKind | null;
}

export function nearLine(m: ResultsModel): NearLine | null {
  const me = youAt(m);
  const order = [...m.ghosts].sort((a, b) => byStanding(ghostAt(a), ghostAt(b)));
  const ahead = order.filter((g) => aheadOf(ghostAt(g), me));
  if (ahead.length > 0) {
    const above = ahead[ahead.length - 1];
    const gap = margin(ghostAt(above), me);
    if (gap === null) {
      const short = Math.max(1, Math.round((m.finishZ ?? above.distance ?? m.distance) - m.distance));
      return { side: 'short', gap: metres(short), name: null, kind: null };
    }
    return { side: 'behind', gap: nb(gap), name: above.name, kind: above.kind };
  }
  const below = order.find((g) => !aheadOf(ghostAt(g), me));
  if (!below) return null;
  const gap = margin(me, ghostAt(below));
  if (gap === null) return m.finish ? { side: 'clear', gap: 'the only finisher', name: null, kind: null } : null;
  return { side: 'clear', gap: nb(gap), name: below.name, kind: below.kind };
}

/** The Daily's or the Cup's medal this run, read from its race line ("Daily: Silver. Gold at 2:31.4."), and the next
 *  medal's mark; null on any other run. */
export function eventMedal(m: ResultsModel): { event: 'Daily' | 'Cup'; medal: number; next: string | null } | null {
  const l = m.raceLine?.text ?? '';
  const got = /^(Daily|Cup): (Bronze|Silver|Gold)\.(?: ((?:Silver|Gold) at [\d:.]+)\.)?$/.exec(l);
  if (got) return { event: got[1] as 'Daily' | 'Cup', medal: MEDAL.indexOf(got[2] as (typeof MEDAL)[number]), next: got[3] ?? null };
  const none = /^(Daily|Cup): (Bronze at [\d:.]+)\.$/.exec(l);
  return none ? { event: none[1] as 'Daily' | 'Cup', medal: 0, next: none[2] } : null;
}

const EVENT_WHERE = { Daily: 'on today’s Daily', Cup: 'in this week’s Cup' } as const;

/**
 * The moment a results screen leads with. A wreck says how far it got and where it ended. A Trial leads with its own
 * figure lit by its medal. A Daily or a Cup with a medal leads with the time the medal was won on, the medal in words,
 * and the place in the race as the fact, so the two can never read as disagreeing ("3rd" over "a silver time").
 * Any other finish leads with the place, and the fact is the best thing the run did: a rider of The Twelve beaten or
 * holding you off, a new best, else the nearest rider.
 */
export function resultsMoment(m: ResultsModel): Moment {
  const fin = m.finish ?? null;
  if (!fin) {
    const short = typeof m.finishZ === 'number' ? Math.round(m.finishZ - m.distance) : 0;
    const where = short > 0 ? `${metres(short)} from the line` : '';
    const before = [m.crashCause, where].filter(Boolean).join(', ');
    return { kind: 'wreck', figure: metres(m.distance), of: '', word: 'Wiped out', time: null, medal: 0, fact: before ? { before, name: null, after: '', tone: 'plain', who: null, rider: null } : null };
  }
  if (m.trial?.figure) {
    const md = Math.max(0, Math.min(3, Math.floor(m.trial.medal)));
    return { kind: md >= 3 ? 'win' : md > 0 ? 'podium' : 'finish', figure: m.trial.figure, of: m.trial.unit, word: m.trial.word ?? 'Across the line', time: null, medal: md, fact: null };
  }
  const place = placeOf(m);
  const em = eventMedal(m);
  if (em && em.medal > 0) {
    const fact: MomentFact | null = place ? { before: `${ordinal(place.rank)} of ${place.of} in the race`, name: null, after: '', tone: 'plain', who: null, rider: null } : null;
    return { kind: em.medal >= 3 ? 'win' : 'podium', figure: clock(fin.seconds), of: '', word: `${MEDAL[em.medal]} ${EVENT_WHERE[em.event]}`, time: null, medal: em.medal, fact };
  }
  const fact = momentFact(m);
  if (!place) return { kind: 'finish', figure: clock(fin.seconds), of: '', word: 'Across the line', time: null, medal: 0, fact };
  const kind: MomentKind = place.rank === 1 ? 'win' : place.rank <= 3 && place.of >= 4 ? 'podium' : 'finish';
  const word = kind === 'win' ? 'First down the mountain' : kind === 'podium' ? 'On the podium' : 'Across the line';
  return { kind, figure: ordinal(place.rank), of: `of ${place.of}`, word, time: clock(fin.seconds), medal: 0, fact };
}

/** The best thing a finish did, by rank: The Twelve, a new best, the nearest rider. */
function momentFact(m: ResultsModel): MomentFact | null {
  const fin = m.finish ?? null;
  const tw = m.twelve ?? null;
  const near = nearLine(m);
  if (tw?.rider && tw.tone === 'fell') return { before: '', name: tw.rider.name, after: ` beaten. ${tw.beaten} of ${tw.of} down.`, tone: 'twelve', who: 'rider', rider: tw.rider };
  if (tw?.tone === 'crowned') return { before: 'All twelve beaten. The crown is yours.', name: null, after: '', tone: 'twelve', who: null, rider: tw.rider };
  if (tw?.rider && tw.tone === 'held') return { before: '', name: tw.rider.name, after: ` held you off${near?.side === 'behind' ? ` by ${near.gap}` : ''}`, tone: 'twelve', who: 'rider', rider: tw.rider };
  if (tw?.tone === 'final') return { before: curly(tw.line.replace(/\.$/, '')), name: null, after: '', tone: 'twelve', who: null, rider: tw.rider };
  if (fin?.newBest) {
    if (fin.bestTime === null) return { before: 'Your first finish here', name: null, after: '', tone: 'best', who: null, rider: null };
    const gap = timeGap(fin.seconds, fin.bestTime);
    return { before: gap >= 1 ? `A new best, ${nb(gapSeconds(gap))} quicker` : 'A new best', name: null, after: '', tone: 'best', who: null, rider: null };
  }
  if (near && near.name) {
    const who = near.kind === 'grudge' ? 'grudge' : near.kind === 'you' ? 'you' : 'ghost';
    const name = near.kind === 'you' ? 'your best' : near.name;
    return near.side === 'behind' ? { before: `${near.gap} behind `, name, after: '', tone: 'plain', who, rider: null } : { before: `${near.gap} ahead of `, name, after: '', tone: 'plain', who, rider: null };
  }
  return null;
}

// ---------------------------------------------------------------- beat two: the one reward

/** What opened leads by what changes play most: a mountain, a sled, a feature, a mirror ... gifts last. */
const RANK_ORDER: readonly RewardCard['kind'][] = ['open', 'sled', 'feature', 'mirror', 'legs', 'hour', 'gate', 'garage', 'charm', 'flourish', 'title', 'gifts'];

/** The one reward the second beat turns over, or null for a run that opened nothing (the bar turns over alone). */
export type StoryReward =
  | { kind: 'mountain'; mountain: UnlockedMountain }
  | { kind: 'prize'; reward: RewardCard; kicker: string; name: string; line: string | null }
  | { kind: 'sled'; name: string };

export function storyReward(m: ResultsModel): StoryReward | null {
  const mt = m.unlockedMountains?.[0];
  if (mt) return { kind: 'mountain', mountain: mt };
  const sp = m.spine;
  const opened = [...(sp?.opened ?? [])].sort((a, b) => RANK_ORDER.indexOf(a.kind) - RANK_ORDER.indexOf(b.kind));
  const r = opened[0];
  if (r) {
    // (The kicker names the rank the bar reached, whichever page gave the prize: "Rider Rank 5" over a part-filled
    // bar at page 6 read as not reached. A chapter's page is the month's chapter, not Rider Rank.)
    const kicker = r.chapter ? 'This month’s chapter' : `Reached Rider Rank ${Math.max(r.page, sp?.after.page ?? r.page)}`;
    return { kind: 'prize', reward: r, kicker, name: prize(r), line: SAYS[r.name] ?? null };
  }
  // A sled this run's gifts made affordable: named, and it waits in the garage (Details has the way in).
  const u = m.nextUnlock;
  if (u?.kind === 'sled' && u.gifts <= 0) {
    const price = SLEDS.find((s) => s.name === u.name)?.price ?? 0;
    if (price > 0 && m.wallet - m.giftsEarned < price) return { kind: 'sled', name: u.name };
  }
  return null;
}

// ---------------------------------------------------------------- beat three: the one button

/** The one button's words: what it rides, and why. */
export interface StoryButton {
  label: string;
  why: string | null;
  aria: string;
}

export function storyButton(m: ResultsModel): StoryButton {
  const b = buttonWords(m);
  // Said once: the rider the moment's fact names is not named again on the button ("Pip Thistle held you off" over
  // "Rematch"), and the mountain the card turns over is "it" ("New mountain / Sakura Ridge" over "Ride It"). A reader
  // hears the whole name in the button's own.
  const fact = resultsMoment(m).fact;
  const named = /^(Rematch|Next Duel:) (.+)$/.exec(b.label);
  if (named && fact?.name && named[2] === fact.name) return { ...b, label: named[1] === 'Rematch' ? 'Rematch' : 'Next Duel' };
  const mt = m.unlockedMountains?.[0];
  if (mt && b.label === `Ride ${mt.name}`) return { ...b, label: 'Ride It' };
  return b;
}

function buttonWords(m: ResultsModel): StoryButton {
  const p = m.spine?.primary ?? null;
  const label = m.runAgainLabel?.text ?? p?.text ?? 'Run Again';
  // The spine's line, when the label is the spine's (a friend's challenge names its own label and has no line).
  const raw = p && p.text === label ? p.sub : null;
  // A mountain this run opened becomes the button when the spine's choice is a plain run again (app.ts sends Run Again
  // there, by the button or Space); otherwise it is named on the card and waits on the title's picker.
  const mt = m.unlockedMountains?.[0];
  if (mt && (!p || p.kind === 'again') && label === 'Run Again') return { label: `Ride ${mt.name}`, why: curly(mt.tagline), aria: `Ride ${mt.name}, just opened` };
  // A rematch's reason is the rival's own time this run: beat one already says how far behind you were.
  if (p?.kind === 'rematch' && p.text === label) {
    const name = label.replace(/^Rematch /, '');
    const rival = m.ghosts.find((g) => g.name === name);
    if (rival && typeof rival.time === 'number') return { label, why: `${clock(rival.time)} to beat`, aria: p.aria };
  }
  // The Daily's or the Cup's next medal is what another run there is for: its mark and how far off it was.
  const em = eventMedal(m);
  if (em?.next && (!p || p.kind === 'again') && m.finish) {
    const mark = /^(Bronze|Silver|Gold) at (\d+):(\d+\.\d)$/.exec(em.next);
    const gap = mark ? m.finish.seconds - (Number(mark[2]) * 60 + Number(mark[3])) : 0;
    return { label, why: nb(gap >= 0.05 ? `${em.next}, ${gap.toFixed(1)} s to find` : em.next), aria: `${label}. ${em.next}` };
  }
  return { label, why: raw ? nb(curly(raw)) : null, aria: m.runAgainLabel?.aria ?? p?.aria ?? label };
}

// ---------------------------------------------------------------- the story

export interface StoryHooks {
  again(): void;
  home(): void;
  details(): void;
  /** A beat landed, for its sound: the bar's stretches, a page turned, the card turned, the button. */
  beat(kind: 'fill' | 'page' | 'card' | 'button', i: number): void;
  /** The bar's fill starts: the run's finished missions are paid now (their chimes and coins). */
  paid(): void;
  /** Photo mode over the scene as it stands (absent: no button). */
  photo?: () => void;
  /** You beat a friend's challenge: send yours back (absent: no button). */
  sendBack?: () => void;
}

/**
 * The story, built once per results and played or landed whole. Its element is the results' first view; Details
 * opens one level down (results.ts).
 */
export class Story {
  readonly el: HTMLElement;
  readonly again: HTMLButtonElement;
  private timers: number[] = [];
  private anims: Animation[] = [];
  private done = false;
  private isPaid = false;
  private readonly segs: BarSegment[];
  private readonly fillEl: HTMLElement | null = null;
  private readonly pageEl: HTMLElement | null = null;

  constructor(
    private readonly m: ResultsModel,
    ctx: Ctx,
    private readonly mode: InputMode,
    private readonly hooks: StoryHooks,
    offers: HTMLElement[],
  ) {
    const mo = resultsMoment(m);
    const phone = typeof window !== 'undefined' && window.matchMedia?.('(max-aspect-ratio: 1/1)').matches === true;
    this.el = h('section', `gs9-story ${reduced() ? 'is-done' : 'is-playing'}`);

    // Beat one: how you did, at the top of the logo's side, over the scene.
    const moEl = h('div', `gs9-mo is-${mo.kind}`);
    moEl.setAttribute('aria-hidden', 'true');
    const fig = h('div', 'gs9-mo-figrow', h('span', 'gs9-mo-fig gs9-num', mo.figure), mo.of ? h('span', 'gs9-mo-of', mo.of) : null);
    fig.dataset.beat = '0';
    const rule = h('span', 'gs9-mo-rule');
    rule.dataset.beat = '0';
    const word = h('div', 'gs9-mo-word', mo.medal > 0 ? medalDisc(mo.medal) : null, h('span', '', mo.word), mo.time ? h('span', 'gs9-mo-time gs9-num', mo.time) : null);
    word.dataset.beat = '1';
    moEl.append(fig, rule, word);
    let factEl: HTMLElement | null = null;
    if (mo.fact) {
      const f = mo.fact;
      factEl = h('p', `gs9-mo-fact is-${f.tone}`);
      if (f.rider) {
        const bust = h('span', 'gs9-mo-bust');
        bust.innerHTML = riderBust(f.rider.hat, f.rider.accent);
        factEl.style.setProperty('--rider', f.rider.accent);
        factEl.append(bust);
      }
      const who = f.name ? h('span', `gs9-who is-${f.who ?? 'ghost'}`, f.name) : null;
      who?.setAttribute('translate', 'no');
      factEl.append(h('span', 'gs9-mo-fact-t', f.before, who, f.after));
      factEl.dataset.beat = '2';
      factEl.setAttribute('aria-hidden', 'true');
      // (On a phone the fact leads the column at the bottom: the top keeps to the figure and its word, clear of the
      // rider's head. On a desk it stays inside the headline's rule, clear of the rider.)
      if (!phone) moEl.append(factEl);
    }
    // What a reader hears for beat one: the same words, once.
    const said = sr(`${mo.figure}${mo.of ? ` ${mo.of}` : ''}. ${mo.word}${mo.time ? `, ${mo.time}` : ''}.${mo.fact ? ` ${factText(mo.fact)}.` : ''}`);

    // Beat two: the one reward, turned over, with Rider Rank's bar and the gifts at its foot.
    const col = h('div', 'gs9-col');
    const reward = storyReward(m);
    const got = h('div', `gs9-card gs9-got${reward ? '' : ' is-bar'}`);
    got.dataset.beat = '3';
    let rankInKicker = false;
    if (reward?.kind === 'mountain') {
      const sky = h('span', 'gs-mtn-sky');
      sky.innerHTML = biomeArt(reward.mountain.biome);
      const art = h('span', `gs9-got-art b-${reward.mountain.biome}`, sky);
      const n = h('span', 'gs9-got-n', reward.mountain.name);
      n.setAttribute('translate', 'no');
      got.append(art, h('span', 'gs9-got-k', 'New mountain'), n);
    } else if (reward?.kind === 'prize') {
      rankInKicker = !reward.reward.chapter;
      const n = h('span', 'gs9-got-n', reward.name);
      n.setAttribute('translate', 'no');
      got.append(h('span', 'gs9-got-art is-gift', ico9(rewardGlyph(reward.reward.kind))), h('span', 'gs9-got-k', reward.kicker), n);
      if (reward.line) got.append(h('span', 'gs9-got-l', reward.line));
    } else if (reward?.kind === 'sled') {
      const n = h('span', 'gs9-got-n', reward.name);
      n.setAttribute('translate', 'no');
      got.append(h('span', 'gs9-got-art is-gift', ico9('sledBold')), h('span', 'gs9-got-k', 'Ready in the garage'), n);
    }
    const sp = m.spine ?? null;
    this.segs = sp ? barSegments(sp.before, sp.after) : [];
    if (sp) {
      const a = sp.after;
      this.fillEl = h('span', 'gs9-bar-fill');
      const bar = h('span', 'gs9-bar', this.fillEl);
      bar.setAttribute('aria-hidden', 'true');
      this.fillEl.style.transform = `scaleX(${(reduced() ? barShare(a) : this.segs.length > 0 ? this.segs[0].from : barShare(a)).toFixed(4)})`;
      this.pageEl = h('span', 'gs9-num', String(reduced() || this.segs.length === 0 ? a.page : this.segs[0].page));
      const label = rankInKicker ? null : h('span', 'gs9-rank-l', 'Rider Rank ', this.pageEl);
      const gifts = m.giftsEarned > 0 ? h('span', 'gs9-gifts', ico9('gift'), h('span', 'gs9-num', `+${fmt(m.giftsEarned)}`), `${NBSP}gifts`) : null;
      const xp = sp.ticks.reduce((s, t) => s + t.xp, 0);
      got.append(h('div', `gs9-rank${label ? '' : ' is-bare'}`, label, bar, gifts), sr(`Rider Rank ${a.page}, ${fmt(xp)} XP this run.${m.giftsEarned > 0 ? ` ${fmt(m.giftsEarned)} gifts.` : ''}`));
    } else if (m.giftsEarned > 0) got.append(h('div', 'gs9-rank is-bare', h('span', 'gs9-gifts', ico9('gift'), h('span', 'gs9-num', `+${fmt(m.giftsEarned)}`), `${NBSP}gifts`)));
    const showCard = got.childElementCount > 0;

    // Beat three: the one button with its reason, then Home, Photo and Details.
    const bw = storyButton(m);
    const key = mode === 'touch' ? null : mode === 'gamepad' ? padBtn('A') : kbd('Space');
    key?.setAttribute('aria-hidden', 'true');
    const t = h('span', 'gs9-go-t', h('span', 'gs9-go-v', bw.label), bw.why ? h('span', 'gs9-go-why', bw.why) : null);
    t.querySelector('.gs9-go-v')?.setAttribute('translate', 'no');
    this.again = b9(ctx, 'primary', [t, key], { icon: 'play', fk: 'again', sound: 'confirm', gameKey: true, aria: bw.aria, cls: `gs9-go${[...bw.label].length > 18 ? ' is-long' : ''}`, onClick: () => this.hooks.again() });
    if (key) this.again.setAttribute('aria-keyshortcuts', 'Space');
    const go = h('div', 'gs9-go-row', this.again);
    go.dataset.beat = '4';
    const photo = this.hooks.photo;
    const send = this.hooks.sendBack;
    const foot = h(
      'div',
      'gs9-foot',
      b9(ctx, 'quiet', 'Home', { icon: 'back', fk: 'home', sound: 'back', onClick: () => this.hooks.home() }),
      photo ? b9(ctx, 'quiet', 'Photo', { icon: 'camera', fk: 'photo', onClick: () => photo() }) : null,
      send ? b9(ctx, 'secondary', 'Send It Back', { icon: 'link', fk: 'send', aria: 'Send your run back to your friend', onClick: () => send() }) : null,
      ...offers,
      b9(ctx, 'secondary', 'Details', { icon: 'chevR', fk: 'details', aria: 'Details: the race, your run and what it paid', onClick: () => this.hooks.details() }),
    );
    foot.dataset.beat = '5';
    if (phone && factEl) col.append(factEl);
    if (showCard) col.append(got);
    col.append(go, foot);
    this.el.append(moEl, said, col);
  }

  get playing(): boolean {
    return !this.done;
  }

  /** Plays the story from the start (the results just opened). Reduced motion lands it whole. */
  play(): void {
    if (reduced()) {
      this.finish();
      return;
    }
    const at = (ms: number, f: () => void) => this.timers.push(window.setTimeout(f, ms));
    for (const el of Array.from(this.el.querySelectorAll<HTMLElement>('[data-beat]'))) at(BEAT_AT[Number(el.dataset.beat)] ?? 0, () => el.classList.add('is-on'));
    at(STORY_TIMING.CARD_MS, () => this.hooks.beat('card', 0));
    at(STORY_TIMING.BUTTON_MS, () => this.hooks.beat('button', 0));
    at(STORY_TIMING.FILL_AT, () => this.pay());
    this.fill();
    at(STORY_TIMING.END_MS, () => this.finish());
  }

  /** The bar fills stretch by stretch; at the top of a page the page turns (its stamp) and it fills on. */
  private fill(): void {
    const fillEl = this.fillEl;
    if (!fillEl || this.segs.length === 0) return;
    const plan = fillPlan(this.segs);
    this.segs.forEach((g, i) => {
      const f = plan[i];
      this.timers.push(
        window.setTimeout(() => {
          if (this.pageEl) this.pageEl.textContent = String(g.page);
          if (typeof fillEl.animate === 'function') this.anims.push(fillEl.animate([{ transform: `scaleX(${g.from})` }, { transform: `scaleX(${g.to})` }], { duration: f.ms, easing: i === this.segs.length - 1 ? EASE_OUT : 'linear', fill: 'forwards' }));
          this.hooks.beat('fill', i);
          if (g.to >= 1)
            this.timers.push(
              window.setTimeout(() => {
                if (this.pageEl) this.pageEl.textContent = String(g.page + 1);
                this.hooks.beat('page', i);
              }, f.ms),
            );
        }, f.at),
      );
    });
  }

  /** Lands everything at once: a tap or a key, the end of the timeline, or reduced motion. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    for (const a of this.anims) a.cancel();
    this.anims.length = 0;
    const sp = this.m.spine;
    if (sp && this.fillEl) this.fillEl.style.transform = `scaleX(${barShare(sp.after).toFixed(4)})`;
    if (sp && this.pageEl) this.pageEl.textContent = String(sp.after.page);
    for (const s of Array.from(this.el.querySelectorAll<HTMLElement>('[data-beat]'))) s.classList.add('is-on');
    this.el.classList.remove('is-playing');
    this.el.classList.add('is-done');
    // A keyboard player waiting on the story lands on the button as it arrives.
    if (this.mode === 'keyboard' && document.activeElement === this.el) this.again.focus({ preventScroll: true });
    this.pay();
  }

  /** The run's finished missions are paid once, as the fill starts or as the story lands whole. */
  private pay(): void {
    if (this.isPaid) return;
    this.isPaid = true;
    this.hooks.paid();
  }

  dispose(): void {
    this.done = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    for (const a of this.anims) a.cancel();
    this.anims.length = 0;
  }
}
