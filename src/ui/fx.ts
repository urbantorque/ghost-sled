import type { BankTier, StampPart } from '../game/beats';
import { BANK_CHIP_MS, BANK_MS, BANK_PEAK, BANK_ROLL_MS, BANK_SPARKS, BANK_TICKS, rollValue } from '../game/stake';
import type { ScreenRect, StyleTone } from './contract';
import { h } from './dom';
import { fmt } from './fmt';
import { isNewsKey, pushBox, type Hud, type SideWord } from './hud';
import { bump, EASE_IN, EASE_OUT, play, reduced, SPRING } from './motion';

// Trick callouts, the perfect-landing stamp and the combo cash-in. Callouts live in one fixed slot
// directly under the combo meter (the second tier of the top-centre stack), and the slot holds one
// line: a newcomer that ranks at least as high rolls the old line up into the combo total as it takes
// its place (once the old line's exit has finished), except that a payoff line ('best' or 'big') only
// just landed holds for HOLD_MS against a lower-ranked, equal or 'lost' newcomer, which waits its turn.
// While a duel holds the rival pill, other ghosts' race words take this line too (Fx.side), each
// holding HOLD_MS against the next. Every number carries its label ("BACKFLIP +600"); "x" belongs to the combo multiplier
// alone, so a label that repeats merges into its line with summed points and a row of small pips for
// the count ("SLIPSTREAM ••• +28"), never "x3". A label that comes back within a moment (slipstream
// ticks around a gift) picks up its running total again. CSS lays the slot out, so a pop never reads
// layout.
//
// A perfect landing is not a line: it is one hero stamp beside the rider, off the sky where the low
// sun sits, and the tricks of that same landing fold into its sub-line, each number with its label
// ("PERFECT +490 · BACKFLIP +600"). It is at full strength from its first frames (an ink stroke, never
// a faint fade over a bright sky), punches in and snaps out. One message per beat: while the stamp is
// up, a pass waits and flashes in the race row once it has gone (a pass flash that started in the
// same beat steps back behind it). While a headline is up (the stamp, or a pass flashing in the race
// row) minor lines (a slipstream tick, a gift) stay out of the top-centre stack; their points still
// reach the combo total. Each number shows once: a line whose points are the whole combo total shows
// its label alone under that total ("+120" over "BOOSTED POP"), and slipstream ticks never get a line
// while the Slipstream pill at the bottom names them.
//
// A stomp streak grows the stamp's title ("DOUBLE STOMP") and its punch, never its points; its sub-line
// leads with "2 IN A ROW". A cash-in is graded by size (src/game/stake.ts): a plain "+80" flies into the
// score, while a big one shows its origin, slams the "x4" chip onto it and rolls up to the product
// before your eyes (the chip is absorbed, so the product is the one figure that lands), with off-white
// sparks and a header from tier 3. A lost combo cracks: the figure you were protecting greys, tilts and
// falls under the "COMBO LOST" line.

/** A cash-in on screen: its figure, where it is anchored, and what it schedules. */
interface BankFx {
  el: HTMLElement;
  /** Anchor of the figure (CSS px): the element is centred on it until it flies. */
  ax: number;
  ay: number;
  peak: number;
  /** Extra width the chip adds beside the figure while it shows. */
  chipW: number;
  flying: boolean;
  anim: Animation | null;
  raf: number;
  timers: number[];
  sparks: HTMLElement[];
}

interface CrackFx {
  el: HTMLElement;
  ax: number;
  ay: number;
  anim: Animation | null;
  timer: number;
}

/** A crack across the lost figure: one jagged ink stroke with an off-white lip. */
const CRACK_SVG =
  '<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M4 30 L22 18 L30 24 L46 9 L55 19 L70 6 L80 15 L96 4" fill="none" stroke="#121933" stroke-width="4.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="M4 30 L22 18 L30 24 L46 9 L55 19 L70 6 L80 15 L96 4" fill="none" stroke="#f5f3ff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" transform="translate(0 2)"/></svg>';

/** The cash-in figure's type size: the CSS clamp(30px, 2.4 x the HUD unit, 46px). */
function bankFont(u: number): number {
  return Math.max(30, Math.min(46, 2.4 * u));
}

const MAX_LINES = 1;
const LIFE_MS = 1150;
const OUT_MS = 220;
/** Once something newer lands, an older line stays at most this long. */
const OLDER_MS = 800;
const COLLAPSE_MS = 140;
/**
 * A line that waits out the old line's exit starts this much after it: the two animations start on
 * their own frames, and the old line's ease-in keeps most of its opacity till its last frames.
 */
const ENTRY_SLACK_MS = 24;
const STAMP_MS = 1500;
const STAMP_OUT_MS = 150;
/** Lines that arrived this soon before a perfect landing belong to it (a late stomp lands 5 ticks on). */
const LANDING_MS = 160;
/** A minor label back within this long resumes its running total and count. */
const RESUME_MS = 1500;
/** Count pips past this many would only add noise: the points carry the rest. */
const MAX_PIPS = 5;
/**
 * A payoff line ('best': New ground, New best; 'big': a trick, In the flow) keeps the slot this long
 * against a lower-ranked, 'lost' or equal newcomer: a Sketchy landing 0.2 s after New ground waits its
 * turn instead of erasing it ("N[SKETCHY]D"), so does a New best one frame after it, and so does a
 * graveyard's "SURVIVED WRECK HOLLOW" 0.35 s after IN THE FLOW. A race word on the side line holds
 * this long against the next race word too (Fx.side).
 */
export const HOLD_MS = 600;
/** A stamp a loss retires (a crash, a lost combo, a broken streak) fades this fast. */
export const RETIRE_MS = 120;
/**
 * A line that has waited this long behind payoff lines is dropped: its moment has passed. Long
 * enough to wait out two holds back to back (New ground, then a New best that waited for it).
 */
const QUEUE_STALE_MS = 2 * HOLD_MS + 250;
/** Lines born this close together came in one frame's beats (the next frame is 16 ms or more on). */
export const SAME_FRAME_MS = 8;
/** At most this many lines wait their turn. */
const QUEUE_MAX = 2;

const RANK: Record<StyleTone, number> = { lost: 0, normal: 1, big: 2, best: 2.5, perfect: 3 };

/**
 * Whether a newcomer may take the one-line slot now or must wait behind the line on it. A 'best' or
 * 'big' line younger than HOLD_MS holds against a 'lost', lower-ranked or equal-ranked newcomer (a
 * 'best' against a 'best', a 'big' against a 'big'); `force` (a crash's lost combo) always takes the
 * slot. Fx.line asks for 'lost', 'best' and race-word newcomers, and for a 'big' one over a 'big'
 * line; any other lower-ranked plain or trick line meets the rank gate and stays out.
 */
export function admit(top: { tone: StyleTone; born: number } | null | undefined, tone: StyleTone, now: number, force = false): 'show' | 'queue' {
  if (force || !top || tone === 'perfect') return 'show';
  // A trick line from this same frame (a sketchy landing's own spin, then its Streak broken; a
  // landing's two tricks) has had no moment yet: the later beat of the frame takes the slot, as the
  // director ordered them. A best line holds from its first frame (New ground and New best crossed in
  // one frame).
  const age = now - top.born;
  const held = age < HOLD_MS && (top.tone === 'best' || (top.tone === 'big' && age >= SAME_FRAME_MS));
  return held && (tone === 'lost' || RANK[tone] <= RANK[top.tone]) ? 'queue' : 'show';
}

/**
 * What a race word for the side line does with the line on it (Fx.side). Over a race word younger than
 * HOLD_MS it replaces that line in place when it tells the same story (the same ghost, or one
 * slingshot burst: "SLUNG PAST 3" over "SLUNG PAST 2"), and otherwise waits its turn, so a burst never
 * wipes a word unread ("Took back fjord348" lasted 130 ms). Anything else: it goes through the line slot.
 */
export function sideAction(top: { race?: string; born: number } | null | undefined, key: string, now: number): 'show' | 'replace' | 'queue' {
  if (!top || top.race === undefined || now - top.born >= HOLD_MS) return 'show';
  return top.race === key ? 'replace' : 'queue';
}

/** Whether the line on the slot is a race word still inside its HOLD_MS (a minor line stays out). */
export function raceHolds(top: { race?: string; born: number } | null | undefined, now: number): boolean {
  return top !== null && top !== undefined && top.race !== undefined && now - top.born < HOLD_MS;
}

/**
 * A trick of yours lands on the line: the race word on it steps back into the queue if it has not had
 * its moment (younger than HOLD_MS) and has not stepped back before. Returns its stale clock (when it
 * first arrived), or null when it is retired instead (a second trick on it, or not a young race word).
 */
export function stepBackAt(prev: { race?: string; born: number; arrived: number; stepped: boolean } | null | undefined, now: number): number | null {
  if (!prev || prev.race === undefined || prev.stepped || now - prev.born >= HOLD_MS) return null;
  return Math.min(prev.arrived, now);
}

/** Whether a waiting line (or race word) that first arrived at `at` still has its moment. */
export function queueFresh(at: number, now: number): boolean {
  return now - at <= QUEUE_STALE_MS;
}

/** Display names for the sim's style labels. "Draft" and "Drift" are one letter apart. */
const SLIPSTREAM = 'Slipstream';
const DISPLAY: Record<string, string> = { Draft: SLIPSTREAM };

interface Callout {
  wrap: HTMLElement;
  inner: HTMLElement;
  label: string;
  tone: StyleTone;
  count: number;
  points: number;
  countEl: HTMLElement;
  ptsEl: HTMLElement;
  tEl: HTMLElement;
  /** A race word on the side line (Fx.side): what it is about (SideWord.key), and the name it shows. */
  race?: string;
  who?: string;
  /** Its points are the whole combo total printed just above it: the line shows its label alone. */
  same: boolean;
  born: number;
  /**
   * A race word: when it first arrived (its stale clock, kept however often it waits again), and
   * whether a trick of yours already stepped it back off the line once (a second one retires it).
   */
  arrived: number;
  stepped: boolean;
  /** performance.now() at which the callout is due to leave. */
  due: number;
  anim: Animation | null;
  timer: number;
}

const BURST_SVG = (() => {
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r1 = i % 2 ? 30 : 26;
    const r2 = i % 2 ? 40 : 46;
    const f = (n: number) => (Math.round(n * 10) / 10).toString();
    rays += `M${f(50 + Math.cos(a) * r1)} ${f(50 + Math.sin(a) * r1)}L${f(50 + Math.cos(a) * r2)} ${f(50 + Math.sin(a) * r2)}`;
  }
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="${rays}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
})();

export class Fx {
  readonly el: HTMLElement;
  private readonly slot: HTMLElement;
  /** Live callouts, oldest first. Leaving ones are removed from this list when they start to go. */
  private items: Callout[] = [];
  /** Running totals of minor labels by text, so one interrupted by another can pick up again. */
  private readonly recent = new Map<string, { points: number; count: number; at: number }>();
  /**
   * Big lines of the last moment (spins, flips), kept even after a newer one took the slot: a landing
   * fires its tricks in one frame and the slot shows one line, but the stamp names them all.
   */
  private tricks: Array<{ label: string; points: number; at: number }> = [];
  /** The live perfect-landing stamp (null once it starts to leave). */
  private heroEl: HTMLElement | null = null;
  private stampTimer = 0;
  /** The rider's projected position, updated every frame by the game. */
  private rx = Number.NaN;
  private ry = Number.NaN;
  /** Cash-ins on screen (one at a time in practice), and the lost combo's falling figure. */
  private banks: BankFx[] = [];
  private crack: CrackFx | null = null;
  /** Lines waiting behind a young payoff line (admit), oldest first, and the timer for the first. */
  private readonly queued: Array<{ label: string; points: number; tone: StyleTone; at: number; race?: string; who?: string; stepped?: boolean }> = [];
  private queueTimer = 0;
  /** When the line leaving the slot finishes its exit: the next one fades in only then. */
  private exitUntil = 0;
  /** Called when a line or the stamp comes or goes (the occluder cache). */
  onLayout: () => void = () => undefined;

  constructor(
    parent: HTMLElement,
    private readonly hud: Hud,
  ) {
    this.el = h('div', 'gs-fx');
    this.el.setAttribute('aria-hidden', 'true');
    parent.append(this.el);
    this.slot = hud.calloutSlot;
    hud.stampUp = () => this.heroEl !== null;
  }

  /** The rider's projected position: the perfect-landing stamp is placed beside it when it lands. */
  setRider(x: number, y: number): void {
    this.rx = x;
    this.ry = y;
  }

  /** The live stamp, for the occluder cache. */
  get stampEl(): HTMLElement | null {
    return this.heroEl;
  }

  /** A style callout. The multiplier is not repeated per line: the combo meter carries it. */
  pop(label: string, points: number, tone: StyleTone, who?: string): void {
    this.line(label, points, tone, { who });
  }

  /**
   * Another ghost's race word while a duel or its result holds the rival pill (Hud.onSideLine): it
   * takes the callout line. It holds HOLD_MS against the next race word, which replaces it in place
   * when it tells the same story (sideAction) and otherwise waits its turn. It is about the race, not
   * your tricks: it is never folded into a landing stamp, and the headline gates for minor lines (a
   * pass flashing in the pill, which here is the duel ghost's) do not hold it out. `back` is when it
   * first arrived and `stepped` whether a trick already stepped it back once, for a word coming back
   * from the queue: it goes stale QUEUE_STALE_MS after it first arrived, however often it waited.
   */
  side(w: SideWord, back?: number, stepped = false): void {
    const text = w.text.trim();
    if (text === '') return;
    const now = performance.now();
    const top = this.items[this.items.length - 1];
    const act = sideAction(top, w.key, now);
    if (top && act === 'replace') this.relabel(top, text, w.tone, now, w.name, back ?? now);
    else if (top && act === 'queue') this.queue(text, 0, w.tone, top.born + HOLD_MS - now, w.key, back, w.name, stepped);
    else this.line(text, 0, w.tone, { race: w.key, back, who: w.name, stepped });
  }

  /**
   * Retires the live hero stamp in a fast fade (RETIRE_MS): a crash, a lost combo or a broken streak
   * owns its beat, so a gold PERFECT LANDING or QUAD STOMP never shares the screen with it.
   */
  retireStamp(): void {
    if (!this.heroEl) return;
    this.dropStamp(this.heroEl, 'retire');
    // The loss line that follows ("SKETCHY", "COMBO LOST") fades in once the stamp has gone.
    this.exitUntil = Math.max(this.exitUntil, performance.now() + RETIRE_MS);
  }

  /**
   * The line slot's one entry point. `force` (a crash's lost combo) never waits behind a payoff line;
   * `race` marks another ghost's race word (Fx.side); `again` is a line coming back from the queue,
   * and `back` when a race word first arrived (it keeps its place and stale clock if it waits again);
   * `stepped`: a trick already stepped that race word back off the line once.
   */
  private line(label: string, points: number, tone: StyleTone, o: { force?: boolean; race?: string; again?: boolean; back?: number; who?: string; stepped?: boolean } = {}): void {
    const raw = label.trim();
    if (raw === '' || raw === '0') return;
    const text = DISPLAY[raw] ?? raw;
    if (tone === 'perfect') {
      // The stamp is the headline of its beat; a pass in the same beat waits behind it (Hud).
      this.perfect(text, points);
      return;
    }
    const max = MAX_LINES;
    const now = performance.now();
    const race = o.race;
    if (tone === 'big' && race === undefined && !o.again) this.noteTrick(text, points, now);
    // A headline (the landing stamp, or a pass flashing in the race row) owns the moment: a minor line
    // stays out of the stack. Its points still reach the combo total, and its running total is kept.
    // So does a slipstream tick while the Slipstream pill shows: "SLIPSTREAM +40" under it said the
    // same word twice in one glance. A race word is no minor line: the pill it stands in for is busy.
    // A race word on the line is that pill's word, so for its HOLD_MS a minor line stays out under it
    // too ("CLEAN LANDING +80" no longer cuts "TobogganTeo wiped out" after 234 ms).
    const top = this.items[this.items.length - 1];
    if (tone === 'normal' && race === undefined && (this.heroEl !== null || this.hud.passing || raceHolds(top, now) || (text === SLIPSTREAM && this.hud.drafting))) {
      this.remember(text, points, 1, now);
      return;
    }

    // A repeat of the newest label folds into it: one line with summed points and a count pip more.
    const fold = top !== undefined && top.label === text && (top.tone === 'lost') === (tone === 'lost');
    // A loss line (Sketchy, Streak broken), a second best (New best right after New ground), a race
    // word, or a payoff over a payoff (a graveyard line just after IN THE FLOW) waits behind a payoff
    // line that has only just landed rather than erasing it, and takes the slot once that line has had
    // its moment. Other lower-ranked plain and trick lines meet the rank gate below and stay out.
    const waits = tone === 'lost' || tone === 'best' || race !== undefined || (tone === 'big' && top?.tone === 'big' && top.race === undefined);
    if (!fold && waits && top && admit(top, tone, now, o.force) === 'queue') {
      this.queue(text, points, tone, top.born + HOLD_MS - now, race, o.back, o.who, o.stepped);
      return;
    }
    if (top && fold) {
      top.count += 1;
      top.points += points;
      if (RANK[tone] > RANK[top.tone]) {
        top.inner.classList.replace(`is-${top.tone}`, `is-${tone}`);
        top.tone = tone;
      }
      if (top.tone === 'normal') this.remember(text, points, 1, now);
      this.fill(top);
      top.anim?.cancel();
      top.anim = play(top.inner, refreshFrames(top.tone), { duration: LIFE_MS, easing: 'linear', fill: 'forwards' }, true);
      this.arm(top, LIFE_MS);
      this.onLayout();
      return;
    }

    // The slot is full and every line on it outranks this one (a slipstream tick under BACKFLIP): it
    // is not shown, so the bigger line keeps the moment. Its points still reach the combo meter. A
    // race word has waited out the hold instead, and takes the slot.
    if (tone !== 'lost' && race === undefined && this.items.length >= max && this.items.every((c) => RANK[c.tone] > RANK[tone])) {
      if (tone === 'normal') this.remember(text, points, 1, now);
      return;
    }

    // A minor label back within a moment (slipstream around a gift) picks up its running total.
    let count = 1;
    let pts = points;
    if (tone === 'normal') {
      const r = this.recent.get(text);
      if (r && now - r.at < RESUME_MS) {
        count += r.count;
        pts += r.points;
      }
      this.remember(text, points, 1, now);
    }

    const inner = h('div', `gs-call is-${tone}`);
    // A race word, or any long line ("Beat SparkleCedar's 1,240 m"), shrinks to fit a phone's width
    // (style.css .is-fit, --len its letter count).
    if (race !== undefined) inner.classList.add('is-race');
    if (fits(text, race)) {
      inner.classList.add('is-fit');
      inner.style.setProperty('--len', String(text.length));
    }
    const countEl = h('span', 'gs-call-count');
    const tEl = h('span', 'gs-call-t');
    setLabel(tEl, text, o.who);
    inner.append(h('span', 'gs-call-label', tEl, countEl));
    const ptsEl = h('span', 'gs-call-pts');
    inner.append(ptsEl);

    const wrap = h('div', 'gs-call-wrap', inner);
    this.slot.append(wrap);
    const item: Callout = { wrap, inner, label: text, tone, count, points: pts, countEl, ptsEl, tEl, race, who: o.who, same: false, born: now, arrived: o.back ?? now, stepped: o.stepped === true, due: 0, anim: null, timer: 0 };
    this.fill(item);

    // Beyond the line limit, the lowest-ranked (then the oldest) collapses. The previous newest becomes
    // the older line and leaves early, unless it outranks the newcomer. A race word that has not had
    // its moment yet (a trick of yours landed on it: "Took back fjord348" lasted 80 ms under
    // "SLINGSHOT +200") steps back into the queue and comes back once the trick has held. It keeps the
    // stale clock of its first arrival, and steps back once: a second trick on it retires it, so one
    // race word never prints three or four times ("TOOK BACK SparkleCedar" read as three take-backs).
    const prev = this.items[this.items.length - 1];
    const story = prev?.race;
    const back = race === undefined ? stepBackAt(prev, now) : null;
    if (prev && story !== undefined && back !== null && !this.queued.some((q) => q.race === story)) this.queue(prev.label, 0, prev.tone, HOLD_MS, story, back, prev.who, true);
    this.items.push(item);
    this.cap(max);
    if (prev && this.items.includes(prev) && RANK[prev.tone] <= RANK[tone]) this.arm(prev, Math.min(OLDER_MS, this.remaining(prev)));

    // The line it replaces finishes its exit first ("BEST COMBO PACE" drew over a still-fading
    // "SLINGSHOT +240"): the newcomer holds at nothing till then, and its hold counts from there.
    const left = this.exitUntil - performance.now();
    const delay = left > 0 ? Math.round(left + ENTRY_SLACK_MS) : 0;
    item.born = now + delay;
    item.anim = play(inner, holdFrames(tone), { duration: LIFE_MS, delay, easing: 'linear', fill: 'both' }, true);
    this.arm(item, LIFE_MS + delay);
    this.onLayout();
  }

  /**
   * A newer race word of the same story takes the line in place ("SLUNG PAST 3 Mika" over "SLUNG PAST 2
   * Tess", or "Tess passed you" over "Passed Tess"): a bump, and its hold starts again. `arrived` is
   * when the newer word first arrived (its stale clock, should a trick step it back).
   */
  private relabel(c: Callout, text: string, tone: StyleTone, now: number, who: string | undefined, arrived: number): void {
    c.label = text;
    c.who = who;
    c.arrived = arrived;
    c.stepped = false;
    setLabel(c.tEl, text, who);
    c.inner.classList.toggle('is-fit', fits(text, c.race));
    c.inner.style.setProperty('--len', String(text.length));
    if (tone !== c.tone) {
      c.inner.classList.replace(`is-${c.tone}`, `is-${tone}`);
      c.tone = tone;
    }
    // A line still waiting out the old line's exit simply enters with the newer words.
    if (c.born <= now) {
      c.born = now;
      c.anim?.cancel();
      c.anim = play(c.inner, refreshFrames(c.tone), { duration: LIFE_MS, easing: 'linear', fill: 'forwards' }, true);
      this.arm(c, LIFE_MS);
    }
    this.onLayout();
  }

  /**
   * A loss line, a second best, a payoff over a payoff or a race word waits its turn behind a payoff
   * line (or a race word behind a race word): it goes up once that line has held HOLD_MS. Two wait at
   * most, in order. A repeat of a waiting label refreshes it in place, and so does a newer race word
   * of the same story (the newer slung count). A crash's lost combo (force) or the HUD going away
   * drops them. `back` is when it first arrived (its stale clock), for one coming back from the
   * head of the queue, which keeps its place in line; `stepped`: a race word a trick already stepped
   * back off the line once.
   */
  private queue(label: string, points: number, tone: StyleTone, ms: number, race?: string, back?: number, who?: string, stepped = false): void {
    const at = back ?? performance.now();
    const same = this.queued.find((q) => (race !== undefined ? q.race === race : q.race === undefined && q.label === label));
    if (same) {
      same.label = label;
      same.who = who;
      same.points = points;
      same.tone = tone;
      same.at = Math.max(same.at, at);
      same.stepped = stepped;
    } else {
      // One back from the head of the queue (or stepping back off the line) keeps its place in line.
      if (back !== undefined) this.queued.unshift({ label, points, tone, at, race, who, stepped });
      else this.queued.push({ label, points, tone, at, race, who, stepped });
      // Over the limit, a news line goes first, then the oldest.
      while (this.queued.length > QUEUE_MAX) {
        const n = this.queued.findIndex((q) => isNewsKey(q.race));
        this.queued.splice(n >= 0 ? n : 0, 1);
      }
    }
    this.armQueue(ms);
  }

  private armQueue(ms: number): void {
    window.clearTimeout(this.queueTimer);
    this.queueTimer = window.setTimeout(() => this.flushQueue(), Math.max(0, ms));
  }

  /** The oldest waiting line takes the slot (it may wait again behind a newer payoff line). */
  private flushQueue(): void {
    const q = this.queued.shift();
    // Stale once it has waited about a second: by then the moment it named has passed.
    if (q && queueFresh(q.at, performance.now())) {
      if (q.race !== undefined) this.side({ text: q.label, tone: q.tone, key: q.race, name: q.who }, q.at, q.stepped === true);
      else this.line(q.label, q.points, q.tone, { again: true });
    }
    if (this.queued.length > 0) {
      const top = this.items[this.items.length - 1];
      this.armQueue(top ? top.born + HOLD_MS - performance.now() : 0);
    }
  }

  private dropQueued(): void {
    this.queued.length = 0;
    window.clearTimeout(this.queueTimer);
  }

  /** Keeps at most `n` lines: the weakest (then the oldest) rolls up into the total. */
  private cap(n: number): void {
    while (this.items.length > n) this.leave(this.weakest(this.items[this.items.length - 1]), true);
  }

  /** Notes a big line for the next landing stamp (same label sums), dropping stale ones. */
  private noteTrick(label: string, points: number, now: number): void {
    this.tricks = this.tricks.filter((t) => now - t.at <= LANDING_MS);
    const t = this.tricks.find((x) => x.label === label);
    if (t) t.points += points;
    else this.tricks.push({ label, points, at: now });
  }

  /** Adds to a minor label's running total (it restarts once the label has been away too long). */
  private remember(text: string, points: number, n: number, now: number): void {
    const r = this.recent.get(text);
    if (!r) {
      this.recent.set(text, { points, count: n, at: now });
      return;
    }
    const live = now - r.at < RESUME_MS;
    r.points = live ? r.points + points : points;
    r.count = live ? r.count + n : n;
    r.at = now;
  }

  /**
   * The HUD is going away (results): the stamp, any cash-in, the cracked figure and the callout line
   * go with it.
   */
  clear(): void {
    if (this.heroEl) this.dropStamp(this.heroEl, true);
    this.dropQueued();
    this.exitUntil = 0;
    this.recent.clear();
    this.tricks.length = 0;
    for (const b of this.banks.slice()) this.dropBank(b);
    this.dropCrack();
    for (const c of this.items.splice(0)) {
      window.clearTimeout(c.timer);
      c.anim?.cancel();
      c.wrap.remove();
    }
    this.onLayout();
  }

  /**
   * Pushes the cash-in figure and the cracked figure (while they hold, before a cash-in flies) into
   * the occluder pool, from index n; returns the new count. Sizes are layout sizes (transforms aside)
   * scaled to the punch's peak, read inside the occluder pass, so nothing forces a layout.
   */
  measure(out: ScreenRect[], n: number): number {
    for (const b of this.banks) {
      if (b.flying) continue;
      const w = b.el.offsetWidth * b.peak + b.chipW;
      const hh = b.el.offsetHeight * b.peak;
      n = pushBox(out, n, b.ax - w / 2, b.ay - hh / 2, b.ax + w / 2, b.ay + hh / 2);
    }
    const c = this.crack;
    if (c) {
      const w = c.el.offsetWidth;
      const hh = c.el.offsetHeight;
      // It falls 24 px and tilts: the box covers the whole fall.
      n = pushBox(out, n, c.ax - w / 2 - 4, c.ay - hh / 2, c.ax + w / 2 + 4, c.ay + hh / 2 + 26);
    }
    return n;
  }

  /**
   * A pass of yours starts flashing in the race row (the Hud calls this once the stamp, if any, has
   * gone): it is the headline, so minor lines roll up into the total.
   */
  yieldToPass(): void {
    // Another ghost's race word stays: the pill is the duel ghost's, and this line speaks for the rest.
    for (const c of this.items.slice()) if (c.tone === 'normal' && c.race === undefined) this.leave(c, true);
  }

  /**
   * Once per frame, after the HUD update: a line whose points equal the combo total printed right
   * above it shows its label alone, so the number appears once ("+120" over "BOOSTED POP"). Once the
   * combo banks or drops, the line keeps what it showed; while a banked total still holds the row,
   * the line keeps its number. Touches the DOM only on a change.
   */
  syncTotal(active: boolean, pending: number): void {
    const c = this.items[this.items.length - 1];
    if (!c || c.tone === 'lost' || !active) return;
    const same = this.hud.totalShown && c.points === Math.round(pending);
    if (same === c.same) return;
    c.same = same;
    c.ptsEl.hidden = c.points === 0 || same;
    this.onLayout();
  }

  /**
   * Writes the count and points of a callout. The count is a row of small pips (CSS draws --n of
   * them), never "x3": "x" is the combo multiplier's alone.
   */
  private fill(c: Callout): void {
    const n = Math.min(MAX_PIPS, c.count);
    c.countEl.hidden = n < 2;
    if (n >= 2) c.countEl.style.setProperty('--n', String(n));
    c.ptsEl.textContent = c.points !== 0 ? (c.tone === 'lost' ? '-' : '+') + fmt(Math.abs(c.points)) : '';
    c.ptsEl.hidden = c.points === 0 || c.same;
  }

  /** The live line to drop for a newcomer: the lowest rank, the oldest among equals. */
  private weakest(except: Callout): Callout {
    let w: Callout | null = null;
    for (const c of this.items) if (c !== except && (!w || RANK[c.tone] < RANK[w.tone])) w = c;
    return w ?? this.items[0];
  }

  private remaining(c: Callout): number {
    return Math.max(0, c.due - performance.now());
  }

  private arm(c: Callout, ms: number): void {
    window.clearTimeout(c.timer);
    c.due = performance.now() + ms;
    c.timer = window.setTimeout(() => this.leave(c, false), ms);
  }

  /**
   * Takes a callout out of the slot. The line rises into the combo total above as it fades, and its
   * row collapses (a CSS grid row easing to zero), so the line below slides up into its place. `fast`
   * is the collapse for a bumped line.
   */
  private leave(c: Callout, fast: boolean): void {
    const i = this.items.indexOf(c);
    if (i < 0) return;
    this.items.splice(i, 1);
    window.clearTimeout(c.timer);
    c.anim?.cancel();
    c.anim = null;
    this.onLayout();
    // Bumped in the same frame it was made (several style events on one landing): never seen, so
    // there is nothing to animate.
    if (fast && performance.now() - c.born < 50) {
      c.wrap.remove();
      return;
    }
    c.wrap.classList.add('is-gone', fast ? 'is-fast' : 'is-slow');
    this.exitUntil = Math.max(this.exitUntil, performance.now() + (fast ? COLLAPSE_MS : OUT_MS));
    const a = fast
      ? play(c.inner, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-8px) scale(0.7)' }], { duration: COLLAPSE_MS, easing: EASE_IN, fill: 'forwards' })
      : play(c.inner, leaveFrames(c.tone), { duration: OUT_MS, easing: EASE_IN, fill: 'forwards' });
    const rm = () => {
      c.wrap.remove();
      this.onLayout();
    };
    if (a) a.onfinish = rm;
    else rm();
  }

  /**
   * The perfect-landing stamp: "PERFECT LANDING" in white-gold, and on one small sub-line its points
   * and the landing's tricks (lines this landing already put in the slot, taken back out), each number
   * with its label: "PERFECT +490 · BACKFLIP +600". Any older line in the slot rolls up into the
   * total, so the stamp is the one headline. Placed once, beside the rider; it never follows the
   * camera's shake.
   */
  private perfect(text: string, points: number): void {
    const now = performance.now();
    const parts: Array<[string, number]> = [];
    if (points > 0) parts.push(['Perfect', points]);
    // Spins and flips of this landing are named (even one a newer trick already bumped from the
    // slot); air and clean-landing ticks only fold into the combo total, and so does any older line.
    for (const t of this.tricks) if (now - t.at <= LANDING_MS) parts.push([t.label, t.points]);
    this.tricks.length = 0;
    // Three or more parts break after the landing's own points: "PERFECT +490" over the tricks.
    this.showStamp(text, parts, parts.length >= 3 && points > 0, 1);
  }

  /**
   * A stomp (the director's stomp beat): the stamp's title grows with the streak ("DOUBLE STOMP",
   * "STOMP STREAK 5"), its sub-line leads with the beat's own parts ("2 IN A ROW", or "PERFECT +250"
   * on a first one), then the tricks this same landing named. Its punch lands harder with the streak.
   */
  stomp(title: string, lead: ReadonlyArray<StampPart>, streak: number): void {
    const now = performance.now();
    const parts: Array<[string, number]> = lead.filter((p) => p.label.trim() !== '').map((p) => [p.label, p.points]);
    for (const t of this.tricks) if (now - t.at <= LANDING_MS && !parts.some((p) => p[0] === t.label)) parts.push([t.label, t.points]);
    this.tricks.length = 0;
    // Three or more parts break after the lead: "2 IN A ROW" (or "PERFECT +490") over the tricks.
    this.showStamp(title.trim() || 'Perfect landing', parts, parts.length >= 3, streak);
  }

  /**
   * A hero stamp with a given title and parts, each number with its label ("YETI HOP +1,500"). The
   * same builder and placement as the perfect-landing stamp, so it is the one headline of its beat;
   * nothing is folded in from the slot. Three or more parts break after the first.
   */
  stamp(title: string, parts: ReadonlyArray<StampPart>): void {
    const raw = title.trim();
    if (raw === '') return;
    const list: Array<[string, number]> = parts.map((p) => [p.label, p.points]);
    this.tricks.length = 0;
    this.showStamp(raw, list, list.length >= 3 && list[0][1] > 0, 1);
  }

  /**
   * Builds, places and plays a stamp: any older line rolls up into the total, an older stamp snaps out.
   * `streak` (1 for a plain stamp) deepens the slam: a streak of 5 lands from about 1.9x.
   */
  private showStamp(text: string, parts: ReadonlyArray<[string, number]>, split: boolean, streak: number): void {
    for (const c of this.items.slice()) if (c.tone !== 'lost') this.leave(c, true);
    // A trick line still waiting its turn is this stamp's to name (or past): it never prints after it.
    for (let i = this.queued.length - 1; i >= 0; i--) if (this.queued[i].tone === 'big' && this.queued[i].race === undefined) this.queued.splice(i, 1);
    if (this.heroEl) this.dropStamp(this.heroEl, true);
    const sub = h('span', 'gs-hero-sub');
    parts.forEach(([label, pts], i) => {
      if (i > 0) sub.append(split && i === 1 ? h('span', 'gs-hero-br') : h('span', 'gs-hero-sep', '·'));
      sub.append(h('span', 'gs-hero-part', h('span', 'gs-hero-lbl', label), pts > 0 ? h('span', 'gs-hero-pts gs-num', '+' + fmt(pts)) : null));
    });

    const inner = h('div', 'gs-hero-in');
    if (!reduced()) {
      const burst = h('span', 'gs-burst');
      burst.innerHTML = BURST_SVG;
      inner.append(burst);
    }
    // The title sits in its own span: CSS paints a white-gold gradient over it (data-t).
    const t = h('span', 'gs-hero-t', text);
    t.dataset.t = text;
    inner.append(t, sub);
    const el = h('div', 'gs-hero', inner);
    const n = Math.max(1, Math.min(5, Math.round(streak)));
    if (n > 1) el.dataset.streak = String(n);
    this.place(el, parts.length === 0 ? 0 : split ? 2 : 1);
    this.el.append(el);
    this.heroEl = el;
    // A pass flash from this same beat steps back and plays once the stamp has gone.
    this.hud.yieldToStamp();
    // A scale punch at full strength: opaque within two frames, slammed down from 1.6x (deeper with each
    // stomp in a streak), a small overshoot, then held. Never a slow fade, which read as cream on a
    // pink sky.
    const from = 1.6 + 0.07 * (n - 1);
    const under = 0.92 - 0.012 * (n - 1);
    const a = play(
      inner,
      [
        { opacity: 0, transform: `scale(${from.toFixed(2)})`, offset: 0 },
        { opacity: 1, transform: `scale(${(from - 0.1).toFixed(2)})`, offset: 0.02, easing: EASE_IN },
        { opacity: 1, transform: `scale(${under.toFixed(3)})`, offset: 0.1, easing: SPRING },
        { opacity: 1, transform: 'scale(1)', offset: 0.2 },
        { opacity: 1, transform: 'scale(1)', offset: 1 },
      ],
      { duration: STAMP_MS, fill: 'forwards' },
      true,
    );
    // The stamp's life is its animation, not a wall-clock timer: a landing often lands on a long
    // frame (hit-stop, first-use effects), and the animation only starts once frames resume.
    window.clearTimeout(this.stampTimer);
    if (a) a.onfinish = () => this.dropStamp(el, false);
    else this.stampTimer = window.setTimeout(() => this.dropStamp(el, false), STAMP_MS);
    this.onLayout();
  }

  /**
   * Where the stamp goes: above the rider's head and off to its right, which keeps it off the corridor
   * ahead and off the low sun (ahead-left of the camera, ART.md). It stays inside the safe area and
   * under the top-centre HUD (and the avalanche unit during a chase); with no room above the head it
   * moves beside the rider instead. Sizes come from the type scale, so placing it reads no layout.
   */
  private place(el: HTMLElement, subRows: number): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const room = this.hud.stampRoom() ?? { left: 16, right: vw - 16, top: vh * 0.26 };
    const span = room.right - room.left;
    const u = this.hud.unitPx();
    // "PERFECT LANDING" is about 12 em wide with its tracking: the type shrinks to fit a narrow phone.
    // About 2.1 units tall: at 2.5 it sat on the ridge line and the head of a ghost beside you.
    const f = Math.min(Math.max(24, 2.12 * u), 38, span / 12.4);
    const w = 12.4 * f;
    const hgt = (1.1 + 0.75 * subRows) * f;
    const rx = Number.isFinite(this.rx) ? this.rx : vw / 2;
    const ry = Number.isFinite(this.ry) ? this.ry : vh * 0.6;
    const clampX = (x: number) => Math.max(room.left + w / 2, Math.min(room.right - w / 2, x));
    let cx = clampX(rx + 0.19 * vw);
    let top = Math.max(room.top, ry - 0.13 * vh - hgt);
    if (top + hgt > ry - 22) {
      // No room above the head: beside the rider, at head height, if the right side has the width.
      const left = rx + 0.05 * vw;
      if (left + w <= room.right) {
        cx = left + w / 2;
        top = Math.max(room.top, ry - hgt * 0.8);
      }
    }
    const s = el.style;
    s.left = `${Math.round(cx)}px`;
    s.top = `${Math.round(top)}px`;
    s.width = `${Math.round(w)}px`;
    s.setProperty('--hero-f', `${f.toFixed(1)}px`);
  }

  /**
   * Takes a stamp off screen. Its own exit (and a fast one when a newer stamp replaces it) stays solid
   * for the first part, then snaps up and away; a loss retires it in a plain fast fade that sinks a
   * little (RETIRE_MS), no celebratory snap.
   */
  private dropStamp(el: HTMLElement, fast: boolean | 'retire'): void {
    if (this.heroEl === el) {
      this.heroEl = null;
      window.clearTimeout(this.stampTimer);
      this.onLayout();
    }
    const inner = el.firstElementChild;
    for (const a of inner?.getAnimations() ?? []) a.cancel();
    const frames: Keyframe[] =
      fast === 'retire'
        ? [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'translateY(6px) scale(0.94)' },
          ]
        : [
            { opacity: 1, transform: 'none' },
            { opacity: 1, transform: 'translateY(-3px) scale(1.04)', offset: 0.35 },
            { opacity: 0, transform: 'translateY(-14px) scale(0.86)' },
          ];
    const a = inner ? play(inner, frames, { duration: fast === 'retire' ? RETIRE_MS : fast ? 110 : STAMP_OUT_MS, easing: EASE_IN, fill: 'forwards' }) : null;
    if (a) a.onfinish = () => el.remove();
    else el.remove();
  }

  /** Combo cash-in at tier 0 (the game's direct comboBank call): "+total" flies into the score. */
  bank(points: number, mult: number): void {
    this.cashIn({ points, mult, origin: Math.round(points / Math.max(1, mult)), tier: 0, header: null, bump: false });
  }

  /**
   * Combo cash-in, graded by tier (src/game/stake.ts). Tier 0: "+80" pops where the combo meter was and
   * flies into the score, the total alone (never beside an "x4" chip, which read as a figure still to
   * be multiplied). Tiers 1 to 3 with a real multiplier: the origin pops in ("+1,240"), the "x4" chip
   * slams onto it, and the figure rolls up to the product in equal ticks ("+4,960") while the chip is
   * absorbed into it; the product punches to its peak, then flies. Tier 2 throws 12 off-white sparks,
   * tier 3 16 and a header over the figure ("NEW BEST COMBO" in gold-white, else "MASSIVE"). A bump
   * bank (the combo ended on an obstacle) rolls the same but stays small and throws no sparks: the bump
   * owns that beat. Reduced motion: it counts up in place with no scaling, chip slam or sparks.
   */
  cashIn(b: { points: number; mult: number; origin: number; tier: BankTier; header: 'New best combo' | 'Massive' | null; bump: boolean }): void {
    // An older cash-in still on screen gives way at once.
    for (const o of this.banks.slice()) this.dropBank(o);
    const tier = b.tier;
    const red = reduced();
    const multiply = tier > 0 && b.mult >= 2 && b.origin > 0 && b.origin < b.points;
    const f = bankFont(this.hud.hudPx());
    const header = tier === 3 ? b.header : null;
    const peak = b.bump ? Math.min(1.12, BANK_PEAK[tier]) : BANK_PEAK[tier];
    const C = multiply ? BANK_CHIP_MS : 0;
    const R = multiply ? BANK_ROLL_MS[tier] : 0;
    const ticks = multiply ? BANK_TICKS[tier] : 0;
    const T = BANK_MS[tier];
    const land = C + R;
    const fly = tier === 0 ? Math.round(T * 0.56) : T - 380;

    // Anchored on the combo row; a big figure sits a little lower so its punch (and its header) stay
    // clear of the race row above.
    const row = this.hud.bankAnchor() ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.12 };
    const numOffset = Math.round(f * 0.5 * (peak - 1)) + (header ? Math.round(0.28 * f) : 0);
    const ax = Math.round(row.x);
    const ay = Math.round(row.y + numOffset - (header ? 0.27 * f : 0));
    const to = this.hud.centreOf(this.hud.scoreEl) ?? { x: 80, y: 40 };

    const num = h('span', 'gs-bank-num gs-num', '+' + fmt(multiply ? b.origin : b.points));
    const tickWrap = h('span', 'gs-bank-tick', num);
    const fig = h('span', 'gs-bank-fig', tickWrap);
    const chip = multiply ? h('span', 'gs-bank-x gs-num', 'x' + b.mult) : null;
    if (chip) fig.append(chip);
    const head = header ? h('span', `gs-bank-head${header === 'New best combo' ? ' is-best' : ''}`, header) : null;
    const el = h('div', `gs-bank t-${tier}`, head, fig);
    el.style.left = `${ax}px`;
    el.style.top = `${ay}px`;
    this.el.append(el);
    const item: BankFx = { el, ax, ay, peak, chipW: chip ? Math.round(f * 1.9) : 0, flying: false, anim: null, raf: 0, timers: [], sparks: [] };
    this.banks.push(item);
    // It holds over the combo meter until it flies: a new combo's total waits under it till then.
    this.hud.holdComboRow(fly);

    const dx = Math.round(to.x - ax);
    const dy = Math.round(to.y - ay);
    const base = 'translate(-50%, -50%)';
    const o = (ms: number) => Math.max(0, Math.min(1, ms / T));
    let a: Animation | null;
    if (tier === 0) {
      a = play(
        el,
        [
          { transform: `${base} scale(0.6)`, opacity: 0, offset: 0, easing: SPRING },
          { transform: `${base} scale(1.16)`, opacity: 1, offset: 0.18 },
          { transform: `${base} scale(1)`, opacity: 1, offset: 0.3 },
          { transform: `${base} scale(1)`, opacity: 1, offset: 0.56, easing: EASE_IN },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3)`, opacity: 0.25, offset: 1 },
        ],
        { duration: T, fill: 'forwards' },
        true,
      );
    } else {
      // The whole cash-in: in, held where the combo was, then a fast flight into the score.
      a = play(
        el,
        [
          { transform: base, opacity: 0, offset: 0 },
          { transform: base, opacity: 1, offset: o(50) },
          { transform: base, opacity: 1, offset: o(fly), easing: EASE_IN },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3)`, opacity: 0.25, offset: 1 },
        ],
        { duration: T, fill: 'forwards' },
        true,
      );
      // The figure: popped in, steady while it counts, then the landing punch to its peak. With no
      // multiplier to show it punches at once.
      play(
        num,
        multiply
          ? [
              { transform: 'scale(0.6)', offset: 0, easing: SPRING },
              { transform: 'scale(1.1)', offset: o(C * 0.6) },
              { transform: 'scale(1)', offset: o(C) },
              { transform: 'scale(1)', offset: o(land) },
              { transform: `scale(${peak})`, offset: o(land + 90), easing: SPRING },
              { transform: 'scale(1)', offset: o(land + 230) },
              { transform: 'scale(1)', offset: 1 },
            ]
          : [
              { transform: 'scale(0.6)', offset: 0, easing: SPRING },
              { transform: `scale(${peak})`, offset: o(110) },
              { transform: 'scale(1)', offset: o(260) },
              { transform: 'scale(1)', offset: 1 },
            ],
        { duration: T, fill: 'forwards' },
      );
      if (chip) {
        // The chip slams onto the origin, holds through the count, then is absorbed into the figure.
        play(
          chip,
          [
            { opacity: 0, transform: 'translateX(0) scale(2.4) rotate(-12deg)', offset: 0 },
            { opacity: 1, transform: 'translateX(0) scale(0.88) rotate(0deg)', offset: o(C * 0.75), easing: SPRING },
            { opacity: 1, transform: 'translateX(0) scale(1) rotate(0deg)', offset: o(C) },
            { opacity: 1, transform: 'translateX(0) scale(1) rotate(0deg)', offset: o(land - 20), easing: EASE_IN },
            { opacity: 0, transform: 'translateX(-1.6em) scale(0.25) rotate(0deg)', offset: o(land + 100) },
            { opacity: 0, transform: 'translateX(-1.6em) scale(0.25) rotate(0deg)', offset: 1 },
          ],
          { duration: T, fill: 'forwards' },
          true,
        );
      }
      if (head) {
        play(
          head,
          [
            { opacity: 0, transform: 'scale(1.5)', offset: 0 },
            { opacity: 0, transform: 'scale(1.5)', offset: o(land) },
            { opacity: 1, transform: 'scale(0.94)', offset: o(land + 110), easing: SPRING },
            { opacity: 1, transform: 'scale(1)', offset: o(land + 220) },
            { opacity: 1, transform: 'scale(1)', offset: 1 },
          ],
          { duration: T, fill: 'forwards' },
          true,
        );
      }
      const sparks = b.bump || red ? 0 : BANK_SPARKS[tier];
      if (sparks > 0) this.sparks(item, sparks, f, land);
    }
    item.anim = a;

    // The count: equal ticks in time, read off the cash-in's own clock so the number never runs ahead
    // of the motion (a cash-in can land on a long frame).
    if (ticks > 0) {
      let shown = 0;
      const step = () => {
        const ct = Number(a?.currentTime ?? T);
        const i = ct < C ? 0 : Math.min(ticks, Math.floor(((ct - C) * ticks) / Math.max(1, R)) + 1);
        if (i !== shown) {
          shown = i;
          num.textContent = '+' + fmt(rollValue(b.origin, b.points, i, ticks));
          if (i < ticks) bump(tickWrap, 1.07, 110);
        }
        item.raf = i < ticks ? requestAnimationFrame(step) : 0;
      };
      if (a) item.raf = requestAnimationFrame(step);
      else num.textContent = '+' + fmt(b.points);
    }

    this.onLayout();
    // From the moment it flies it no longer occludes (contract C8: on screen until it starts to leave).
    item.timers.push(
      window.setTimeout(() => {
        item.flying = true;
        this.onLayout();
      }, fly),
    );
    const done = () => {
      this.dropBank(item);
      if (this.hud.layer.open) this.hud.bumpScore();
    };
    if (a) a.onfinish = done;
    else item.timers.push(window.setTimeout(done, T));
  }

  /**
   * Off-white sparks burst from the figure as the roll lands (never marigold: score is not
   * currency). Soft round motes that arc out and fall a little, in the overlay's own layer.
   */
  private sparks(item: BankFx, count: number, f: number, delay: number): void {
    for (let i = 0; i < count; i++) {
      const s = h('span', 'gs-spark');
      s.style.left = `${item.ax}px`;
      s.style.top = `${item.ay}px`;
      const size = 4 + Math.round(Math.random() * 4);
      s.style.width = s.style.height = `${size}px`;
      // Behind the figure, so a spark never crosses its digits.
      this.el.insertBefore(s, item.el);
      item.sparks.push(s);
      // A low fan: out to the sides and down, never up over the race row (sparks stay low, ART.md 10).
      const ang = -0.3 + (i / Math.max(1, count - 1)) * (Math.PI + 0.6) + (Math.random() - 0.5) * 0.3;
      const r = f * (1.1 + Math.random() * 1.3);
      const x = Math.cos(ang) * r * 1.4;
      const y = Math.sin(ang) * r * 0.55;
      const s1 = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const s2 = `translate(-50%, -50%) translate(${(x * 1.15).toFixed(1)}px, ${(y + f * 0.9).toFixed(1)}px) scale(0.5)`;
      // Hidden until its delay is up (the CSS holds it at opacity 0), then it bursts.
      s.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
          { transform: s1, opacity: 1, offset: 0.42, easing: EASE_IN },
          { transform: s2, opacity: 0 },
        ],
        { duration: 620 + Math.round(Math.random() * 260), delay, easing: EASE_OUT, fill: 'forwards' },
      );
    }
  }

  /** Takes a cash-in off screen (it landed, a newer one replaced it, or the HUD is going). */
  private dropBank(b: BankFx): void {
    const i = this.banks.indexOf(b);
    if (i < 0) return;
    this.banks.splice(i, 1);
    cancelAnimationFrame(b.raf);
    for (const t of b.timers) window.clearTimeout(t);
    for (const s of b.sparks) s.remove();
    b.sparks.length = 0;
    b.el.remove();
    this.onLayout();
  }

  /**
   * A combo lost to a crash (the director's comboLost beat). With crack (a stake of 300 or more), the
   * figure you were protecting cracks where the combo meter was: it greys, a crack runs through it, and
   * it tilts 8 degrees and falls 24 px over 600 ms, while the callout under it reads "COMBO LOST" (or
   * "BEST COMBO LOST"), the number shown once, on the figure. Without crack, the line alone carries the
   * points. Reduced motion: the figure greys and fades where it is.
   */
  lost(points: number, stake: number, best: boolean, crack: boolean): void {
    const label = best ? 'Best combo lost' : 'Combo lost';
    // The crash owns this beat: a stamp still up retires, and a loss line still waiting is superseded.
    this.retireStamp();
    this.dropQueued();
    const row = crack ? this.hud.bankAnchor() : null;
    if (!crack || !row || stake <= 0) {
      this.line(label, points, 'lost', { force: true });
      return;
    }
    this.dropCrack();
    const last = this.hud.lastCombo;
    // The figure the meter was showing: the stake once multiplied ("4,960"), else the total ("+120").
    const text = last.mult >= 2 ? fmt(stake) : '+' + fmt(stake);
    const grey = h('span', 'gs-crack-g gs-num', text);
    const line = h('span', 'gs-crack-line');
    line.innerHTML = CRACK_SVG;
    const el = h('div', 'gs-crack', h('span', 'gs-crack-n gs-num', text), grey, line);
    el.setAttribute('aria-hidden', 'true');
    el.style.left = `${Math.round(row.x)}px`;
    el.style.top = `${Math.round(row.y)}px`;
    this.el.append(el);
    const base = 'translate(-50%, -50%)';
    const a = play(
      el,
      [
        { transform: `${base} translateX(0)`, opacity: 1, offset: 0 },
        { transform: `${base} translateX(-4px)`, opacity: 1, offset: 0.05 },
        { transform: `${base} translateX(3px)`, opacity: 1, offset: 0.1 },
        { transform: `${base} translateX(0) translateY(0) rotate(0deg)`, opacity: 1, offset: 0.15, easing: EASE_IN },
        { transform: `${base} translateY(10px) rotate(3.5deg)`, opacity: 1, offset: 0.55, easing: EASE_IN },
        { transform: `${base} translateY(24px) rotate(8deg)`, opacity: 0, offset: 1 },
      ],
      { duration: 600, fill: 'forwards' },
      true,
    );
    // The grey and the crack snap in together a beat after the hit (opacity only, so the colour snaps).
    for (const part of [grey, line]) {
      play(
        part,
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.1 },
          { opacity: 1, offset: 0.14 },
          { opacity: 1, offset: 1 },
        ],
        { duration: 600, fill: 'forwards' },
        true,
      );
    }
    const c: CrackFx = { el, ax: Math.round(row.x), ay: Math.round(row.y), anim: a, timer: 0 };
    this.crack = c;
    const done = () => {
      if (this.crack === c) this.dropCrack();
    };
    if (a) a.onfinish = done;
    else c.timer = window.setTimeout(done, 600);
    this.line(label, 0, 'lost', { force: true });
    this.onLayout();
  }

  private dropCrack(): void {
    const c = this.crack;
    if (!c) return;
    this.crack = null;
    window.clearTimeout(c.timer);
    c.anim?.cancel();
    c.el.remove();
    this.onLayout();
  }
}

/**
 * Writes a callout's label. A ghost's name in it keeps its own case, as in the rival pill ("TOOK BACK
 * Kai_on_Tour", "Your best PASSED YOU"): it is a handle, and the label is set in caps.
 */
function setLabel(el: HTMLElement, text: string, who?: string): void {
  const i = who ? text.lastIndexOf(who) : -1;
  if (!who || i < 0) {
    el.textContent = text;
    return;
  }
  // A handle is never machine-translated (as in the rival pill and the pass banner).
  const whoEl = h('span', 'gs-call-who', who);
  whoEl.translate = false;
  el.replaceChildren(text.slice(0, i), whoEl, text.slice(i + who.length));
}

/** Letters past which any callout line shrinks to fit a phone's width. Shorter lines keep their tone's
 *  size ("BEST COMBO LOST" stays at the loss size). */
const FIT_LEN = 18;

/** Whether a line gets the phone-width fit: every race word, and any long line. */
function fits(text: string, race: string | undefined): boolean {
  return race !== undefined || text.length > FIT_LEN;
}

/**
 * Enter and hold: pop in, settle, hold. The exit is a separate animation. Every line is opaque within
 * a few frames (the motion is the scale), so a callout never reads as faded or disabled.
 */
function holdFrames(tone: StyleTone): Keyframe[] {
  if (tone === 'lost') {
    // Slammed down on its ink pill, then a short shake.
    return [
      { opacity: 0, transform: 'scale(1.3)', offset: 0 },
      { opacity: 1, transform: 'scale(1.24)', offset: 0.03 },
      { opacity: 1, transform: 'scale(1)', offset: 0.12 },
      { opacity: 1, transform: 'translateX(-4px)', offset: 0.19 },
      { opacity: 1, transform: 'translateX(3px)', offset: 0.26 },
      { opacity: 1, transform: 'translateX(0)', offset: 0.32 },
      { opacity: 1, transform: 'translateX(0)', offset: 1 },
    ];
  }
  const peak = tone === 'big' || tone === 'best' ? 1.12 : 1.07;
  return [
    { opacity: 0, transform: 'translateY(-8px) scale(0.72)', offset: 0 },
    { opacity: 1, transform: 'translateY(-6px) scale(0.78)', offset: 0.03, easing: SPRING },
    { opacity: 1, transform: `translateY(0) scale(${peak})`, offset: 0.15 },
    { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.28 },
    { opacity: 1, transform: 'translateY(0) scale(1)', offset: 1 },
  ];
}

/** A merged repeat: a quick bump from wherever the callout is, then hold again. */
function refreshFrames(tone: StyleTone): Keyframe[] {
  const peak = tone === 'lost' ? 1.06 : 1.12;
  return [
    { opacity: 1, transform: `scale(${peak})`, offset: 0 },
    { opacity: 1, transform: 'scale(1)', offset: 0.18 },
    { opacity: 1, transform: 'scale(1)', offset: 1 },
  ];
}

/** A line leaves by rising into the combo total above it; a lost combo drops away instead. */
function leaveFrames(tone: StyleTone): Keyframe[] {
  if (tone === 'lost') {
    return [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(14px) rotate(3deg)' },
    ];
  }
  return [
    { opacity: 1, transform: 'none' },
    { opacity: 0, transform: 'translateY(-14px) scale(0.72)' },
  ];
}
