import type { StampPart } from '../game/beats';
import type { StyleTone } from './contract';
import { h } from './dom';
import { fmt } from './fmt';
import type { Hud } from './hud';
import { EASE_IN, play, reduced, SPRING } from './motion';

// Trick callouts, the perfect-landing stamp and the combo cash-in. Callouts live in one fixed slot
// directly under the combo meter (the second tier of the top-centre stack), and the slot holds one
// line: a newcomer that ranks at least as high rolls the old line up into the combo total as it takes
// its place. Every number carries its label ("BACKFLIP +600"); "x" belongs to the combo multiplier
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

const MAX_LINES = 1;
const LIFE_MS = 1150;
const OUT_MS = 220;
/** Once something newer lands, an older line stays at most this long. */
const OLDER_MS = 800;
const COLLAPSE_MS = 140;
const STAMP_MS = 1500;
const STAMP_OUT_MS = 150;
/** Lines that arrived this soon before a perfect landing belong to it (a late stomp lands 5 ticks on). */
const LANDING_MS = 160;
/** A minor label back within this long resumes its running total and count. */
const RESUME_MS = 1500;
/** Count pips past this many would only add noise: the points carry the rest. */
const MAX_PIPS = 5;

const RANK: Record<StyleTone, number> = { lost: 0, normal: 1, big: 2, best: 2.5, perfect: 3 };

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
  /** Its points are the whole combo total printed just above it: the line shows its label alone. */
  same: boolean;
  born: number;
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
  pop(label: string, points: number, tone: StyleTone): void {
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
    if (tone === 'big') this.noteTrick(text, points, now);
    // A headline (the landing stamp, or a pass flashing in the race row) owns the moment: a minor line
    // stays out of the stack. Its points still reach the combo total, and its running total is kept.
    // So does a slipstream tick while the Slipstream pill shows: "SLIPSTREAM +40" under it said the
    // same word twice in one glance.
    if (tone === 'normal' && (this.heroEl !== null || this.hud.passing || (text === SLIPSTREAM && this.hud.drafting))) {
      this.remember(text, points, 1, now);
      return;
    }

    // A repeat of the newest label folds into it: one line with summed points and a count pip more.
    const top = this.items[this.items.length - 1];
    if (top && top.label === text && (top.tone === 'lost') === (tone === 'lost')) {
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
    // is not shown, so the bigger line keeps the moment. Its points still reach the combo meter.
    if (tone !== 'lost' && this.items.length >= max && this.items.every((c) => RANK[c.tone] > RANK[tone])) {
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
    const countEl = h('span', 'gs-call-count');
    inner.append(h('span', 'gs-call-label', h('span', 'gs-call-t', text), countEl));
    const ptsEl = h('span', 'gs-call-pts');
    inner.append(ptsEl);

    const wrap = h('div', 'gs-call-wrap', inner);
    this.slot.append(wrap);
    const item: Callout = { wrap, inner, label: text, tone, count, points: pts, countEl, ptsEl, same: false, born: now, due: 0, anim: null, timer: 0 };
    this.fill(item);

    // Beyond the line limit, the lowest-ranked (then the oldest) collapses. The previous newest becomes
    // the older line and leaves early, unless it outranks the newcomer.
    const prev = this.items[this.items.length - 1];
    this.items.push(item);
    this.cap(max);
    if (prev && this.items.includes(prev) && RANK[prev.tone] <= RANK[tone]) this.arm(prev, Math.min(OLDER_MS, this.remaining(prev)));

    item.anim = play(inner, holdFrames(tone), { duration: LIFE_MS, easing: 'linear', fill: 'forwards' }, true);
    this.arm(item, LIFE_MS);
    this.onLayout();
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

  /** The HUD is going away (results): the stamp goes with it. */
  clear(): void {
    if (this.heroEl) this.dropStamp(this.heroEl, true);
    this.recent.clear();
  }

  /**
   * A pass of yours starts flashing in the race row (the Hud calls this once the stamp, if any, has
   * gone): it is the headline, so minor lines roll up into the total.
   */
  yieldToPass(): void {
    for (const c of this.items.slice()) if (c.tone === 'normal') this.leave(c, true);
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
    this.showStamp(text, parts, parts.length >= 3 && points > 0);
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
    this.showStamp(raw, list, list.length >= 3 && list[0][1] > 0);
  }

  /** Builds, places and plays a stamp: any older line rolls up into the total, an older stamp snaps out. */
  private showStamp(text: string, parts: ReadonlyArray<[string, number]>, split: boolean): void {
    for (const c of this.items.slice()) if (c.tone !== 'lost') this.leave(c, true);
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
    this.place(el, parts.length === 0 ? 0 : split ? 2 : 1);
    this.el.append(el);
    this.heroEl = el;
    // A pass flash from this same beat steps back and plays once the stamp has gone.
    this.hud.yieldToStamp();
    // A scale punch at full strength: opaque within two frames, slammed down from 1.6x, a small
    // overshoot, then held. Never a slow fade, which read as cream on a pink sky.
    const a = play(
      inner,
      [
        { opacity: 0, transform: 'scale(1.6)', offset: 0 },
        { opacity: 1, transform: 'scale(1.5)', offset: 0.02, easing: EASE_IN },
        { opacity: 1, transform: 'scale(0.92)', offset: 0.1, easing: SPRING },
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

  private dropStamp(el: HTMLElement, fast: boolean): void {
    if (this.heroEl === el) {
      this.heroEl = null;
      window.clearTimeout(this.stampTimer);
      this.onLayout();
    }
    const inner = el.firstElementChild;
    for (const a of inner?.getAnimations() ?? []) a.cancel();
    // A fast exit: it stays solid for the first part, then snaps up and away.
    const a = inner
      ? play(
          inner,
          [
            { opacity: 1, transform: 'none' },
            { opacity: 1, transform: 'translateY(-3px) scale(1.04)', offset: 0.35 },
            { opacity: 0, transform: 'translateY(-14px) scale(0.86)' },
          ],
          { duration: fast ? 110 : STAMP_OUT_MS, easing: EASE_IN, fill: 'forwards' },
        )
      : null;
    if (a) a.onfinish = () => el.remove();
    else el.remove();
  }

  /** Combo cash-in: the total pops where the combo meter was, then flies into the score. */
  bank(points: number, mult: number): void {
    const from = this.hud.centreOf(this.hud.comboEl) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.12 };
    const to = this.hud.centreOf(this.hud.scoreEl) ?? { x: 80, y: 40 };
    const el = h('div', 'gs-bank', h('span', 'gs-bank-num gs-num', '+' + fmt(points)));
    if (mult > 1) el.append(h('span', 'gs-combo-mult gs-num', 'x' + mult));
    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    this.el.append(el);
    // It holds over the combo meter for its first 56%: a new combo's total waits under it till then.
    this.hud.holdComboRow(560);
    const dx = Math.round(to.x - from.x);
    const dy = Math.round(to.y - from.y);
    const base = 'translate(-50%, -50%)';
    const a = play(
      el,
      [
        { transform: `${base} scale(0.6)`, opacity: 0, offset: 0, easing: SPRING },
        { transform: `${base} scale(1.16)`, opacity: 1, offset: 0.18 },
        { transform: `${base} scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `${base} scale(1)`, opacity: 1, offset: 0.56, easing: EASE_IN },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.3)`, opacity: 0.25, offset: 1 },
      ],
      { duration: 1000, fill: 'forwards' },
      true,
    );
    const done = () => {
      el.remove();
      if (this.hud.layer.open) this.hud.bumpScore();
    };
    if (a) a.onfinish = done;
    else window.setTimeout(done, 1000);
  }
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
  const peak = tone === 'big' ? 1.12 : 1.07;
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
