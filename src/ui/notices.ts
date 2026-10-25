import type { ToastTone } from './contract';
import { ChaosEvent, eventInfo } from '../sim/chaos';
import { h } from './dom';
import { icon, type IconName } from './icons';
import { EASE_OUT, play, SPRING } from './motion';

// The notice band: one banner at a time, docked over the race row at the top of the screen (the row
// fades out under it, and the combo and callout slot step down only by the extra height), so the
// top-centre stack never grows past two tiers. Under it, the chaos reveal slot. Ghost passes no
// longer take a banner: they flash inside the race row. Banners are the bigger moments (event
// telegraphs, grudge settled, missions, unlocks) and wait in a small priority queue: an event
// telegraph beats a celebration, a celebration beats plain info. While something waits, the banner
// on stage is cut short (it still gets MIN_MS). Nothing here takes pointer events.

const TOAST_MS = 2200;
const GRUDGE_MS = 2000;
const WARN_MS = 2600;
/** Shortest time a banner stays up once shown, even with others waiting. */
const MIN_MS = 900;
/** The grudge toast and the grudge pass arrive in the same tick: within this window they merge. */
const MERGE_MS = 400;
const MAX_QUEUE = 3;

// Priorities, highest first.
const P_ALERT = 3; // chaos event telegraph
const P_CELEBRATE = 2; // grudge, mission, gift
const P_CAUTION = 1; // warn-tone toast
const P_INFO = 0; // info and ghost-tone toasts

/** How long each priority may sit in the queue before it is stale and dropped. */
const MAX_WAIT = [2500, 2500, 6000, 1500];

const TOAST_ICON: Record<ToastTone, IconName | null> = {
  ghost: 'ghost',
  grudge: 'ghost',
  mission: 'flag',
  gift: 'gift',
  warn: 'alert',
  info: null,
};

const TOAST_PRI: Record<ToastTone, number> = {
  grudge: P_CELEBRATE,
  mission: P_CELEBRATE,
  gift: P_CELEBRATE,
  warn: P_CAUTION,
  ghost: P_INFO,
  info: P_INFO,
};

export const EVENT_ICON: Record<ChaosEvent, IconName> = {
  [ChaosEvent.None]: 'alert',
  [ChaosEvent.Avalanche]: 'avalanche',
  [ChaosEvent.Yeti]: 'yeti',
  [ChaosEvent.GiftStorm]: 'giftstorm',
  [ChaosEvent.GhostTrain]: 'ghosttrain',
};

type Spec =
  | { type: 'toast'; text: string; tone: ToastTone; sub?: string; name?: string }
  | { type: 'warn'; text: string; event: ChaosEvent };

interface Banner {
  spec: Spec;
  pri: number;
  /** Same key = same banner: a repeat refreshes it instead of queueing a copy. */
  key: string;
  ms: number;
  /** Arrival time. */
  at: number;
  el: HTMLElement | null;
  /** Time it went on stage, 0 while queued. */
  shown: number;
  /** Planned exit time while on stage. */
  end: number;
}

export class Notices {
  readonly el: HTMLElement;
  readonly revealSlot: HTMLElement;
  private readonly stage: HTMLElement;
  /** Event telegraphs are announced here, a sibling of the polite stage (never nested in it). */
  private readonly alertEl: HTMLElement;
  private cur: Banner | null = null;
  private queue: Banner[] = [];
  private timer = 0;
  private bandOn = false;
  private bandH = -1;
  /** Called when a banner or the reveal card comes or goes (the occluder cache). */
  onLayout: () => void = () => undefined;

  constructor(private readonly parent: HTMLElement) {
    this.el = h('div', 'gs-notices');
    this.revealSlot = h('div', 'gs-slot');
    this.stage = h('div', 'gs-stage');
    this.stage.setAttribute('role', 'status');
    this.stage.setAttribute('aria-live', 'polite');
    this.alertEl = h('div', 'gs-sr');
    this.alertEl.setAttribute('aria-live', 'assertive');
    this.alertEl.setAttribute('aria-atomic', 'true');
    this.el.append(this.stage, this.revealSlot, this.alertEl);
    parent.append(this.el);
    // The reveal card holds the band at run start; whatever queued behind it goes up once it leaves.
    // While it is up, the combo meter and callout slot under it wait (gs-reveal-on).
    new MutationObserver(() => {
      this.onLayout();
      this.parent.classList.toggle('gs-reveal-on', this.revealSlot.childElementCount > 0);
      if (!this.cur && this.revealSlot.childElementCount === 0) this.next();
    }).observe(this.revealSlot, { childList: true });
    // The band height drives how far the combo meter steps down: observed, never read after a write.
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver((entries) => {
        const e = entries[entries.length - 1];
        const hgt = Math.round(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height);
        if (hgt === this.bandH) return;
        this.bandH = hgt;
        this.parent.style.setProperty('--band-h', `${hgt}px`);
        this.onLayout();
      }).observe(this.stage);
    }
  }

  toast(text: string, tone: ToastTone, sub?: string): void {
    this.push({ spec: { type: 'toast', text, tone, sub }, pri: TOAST_PRI[tone], key: `t:${tone}:${text}`, ms: tone === 'grudge' ? GRUDGE_MS : TOAST_MS, at: performance.now(), el: null, shown: 0, end: 0 });
  }

  /**
   * The grudge ghost was just passed. The game sends "Grudge settled" in the same tick: that banner
   * takes the ghost's name and becomes the big rose celebration.
   */
  grudge(name: string): void {
    const now = performance.now();
    const b = this.find((x) => x.spec.type === 'toast' && x.spec.tone === 'grudge' && now - x.at <= MERGE_MS);
    if (!b || b.spec.type !== 'toast') return;
    b.spec.name = name;
    if (b.el) {
      const fresh = render(b.spec);
      b.el.replaceWith(fresh);
      b.el = fresh;
      enter(fresh, b.spec);
    }
  }

  /** Mid-run event telegraph: big banner with a pulsing border for about 2.6 s. */
  warn(text: string, event: ChaosEvent): void {
    this.alertEl.textContent = text;
    this.push({ spec: { type: 'warn', text, event }, pri: P_ALERT, key: `w:${event}`, ms: WARN_MS, at: performance.now(), el: null, shown: 0, end: 0 });
  }

  clear(): void {
    window.clearTimeout(this.timer);
    this.cur = null;
    this.queue = [];
    this.stage.replaceChildren();
    this.setBand(false);
  }

  /** The banner on stage, for the occluder cache. */
  get current(): HTMLElement | null {
    return this.cur?.el ?? null;
  }

  private find(test: (b: Banner) => boolean): Banner | null {
    if (this.cur && test(this.cur)) return this.cur;
    return this.queue.find(test) ?? null;
  }

  private push(b: Banner): void {
    const now = b.at;
    this.prune(now);
    const cur = this.cur;
    if (cur && cur.key === b.key) {
      this.arm(cur, Math.max(cur.end, now + Math.min(b.ms, MIN_MS + 400)));
      return;
    }
    this.queue = this.queue.filter((q) => q.key !== b.key);
    if (!cur) {
      if (this.gated(b)) this.enqueue(b);
      else this.show(b);
      return;
    }
    if (b.pri > cur.pri) {
      // Outranked: the banner on stage collapses. A celebration only yields to an event telegraph and
      // comes back after it; anything lower is stale by then and is dropped.
      window.clearTimeout(this.timer);
      this.cur = null;
      if (cur.el) this.exit(cur.el, cur.spec.type, true);
      cur.el = null;
      if (cur.pri >= P_CELEBRATE) {
        cur.ms = Math.max(MIN_MS, cur.end - now);
        cur.at = now;
        cur.shown = 0;
        this.enqueue(cur, true);
      }
      this.show(b);
      return;
    }
    this.enqueue(b);
    this.hurry(now);
  }

  /** Priority order, first come first served within a priority; `front` jumps its own priority class. */
  private enqueue(b: Banner, front = false): void {
    let i = this.queue.findIndex((q) => (front ? q.pri <= b.pri : q.pri < b.pri));
    if (i < 0) i = this.queue.length;
    this.queue.splice(i, 0, b);
    if (this.queue.length > MAX_QUEUE) this.queue.length = MAX_QUEUE;
  }

  private prune(now: number): void {
    this.queue = this.queue.filter((q) => now - q.at <= MAX_WAIT[q.pri]);
  }

  /** The reveal card owns the band while it is up; only an event telegraph may join it. */
  private gated(b: Banner): boolean {
    return b.pri < P_ALERT && this.revealSlot.childElementCount > 0;
  }

  /**
   * With banners waiting, the one on stage leaves as soon as it has had its minimum time. An event
   * telegraph is the exception: it is a warning, so it always runs its full length.
   */
  private hurry(now: number): void {
    const cur = this.cur;
    if (!cur || cur.pri >= P_ALERT || this.queue.length === 0) return;
    const end = Math.max(now, cur.shown + MIN_MS);
    if (end < cur.end) this.arm(cur, end);
  }

  private arm(b: Banner, end: number): void {
    window.clearTimeout(this.timer);
    b.end = end;
    this.timer = window.setTimeout(() => this.advance(), Math.max(0, end - performance.now()));
  }

  private advance(): void {
    const cur = this.cur;
    this.cur = null;
    if (cur?.el) this.exit(cur.el, cur.spec.type, false);
    if (cur) cur.el = null;
    this.next();
  }

  private next(): void {
    if (this.cur) return;
    const now = performance.now();
    this.prune(now);
    const b = this.queue[0];
    if (!b || this.gated(b)) {
      this.setBand(false);
      return;
    }
    this.queue.shift();
    this.show(b);
  }

  private show(b: Banner): void {
    const now = performance.now();
    const el = render(b.spec);
    this.stage.append(el);
    enter(el, b.spec);
    b.el = el;
    b.shown = now;
    this.cur = b;
    this.arm(b, now + b.ms);
    this.hurry(now);
    this.setBand(true);
  }

  /** Banner leaves. Exits overlap the next entrance in the same grid cell, so nothing jumps. */
  private exit(el: HTMLElement, type: Spec['type'], fast: boolean): void {
    el.classList.add('is-leaving');
    const frames: Keyframe[] =
      type === 'warn'
        ? [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px) scale(0.97)' }]
        : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px) scale(0.96)' }];
    const a = play(el, frames, { duration: fast ? 120 : type === 'warn' ? 240 : 200, easing: 'ease-in', fill: 'forwards' });
    const rm = () => el.remove();
    if (a) a.onfinish = rm;
    else rm();
  }

  /**
   * Tells the rest of the overlay a banner holds the band: the race row fades out under it and the
   * combo meter and callout slot step down by the extra height (--band-h, set by the observer).
   */
  private setBand(on: boolean): void {
    if (on === this.bandOn) return;
    this.bandOn = on;
    this.parent.classList.toggle('gs-band-on', on);
    this.onLayout();
  }
}

function render(s: Spec): HTMLElement {
  if (s.type === 'warn') {
    const key = eventInfo(s.event).key;
    const el = h('div', `gs-warn gs-panel e-${key}`, h('span', 'gs-warn-ico', icon(EVENT_ICON[s.event] ?? 'alert')), h('span', 'gs-warn-txt', s.text));
    // Announced through the assertive sibling region instead of the polite stage.
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  if (s.tone === 'grudge' && s.name) {
    // Grudge settled: the rose celebration, with the ghost's name as the headline and the reward
    // beside it at the same size.
    const ico = h('span', 'gs-pass-ico', icon('ghost'), icon('ghost', 'gs-pass-trail'));
    const name = h('span', 'gs-pass-name', s.name);
    name.translate = false;
    const txt = h('span', 'gs-pass-txt', h('span', 'gs-pass-k', s.text), name);
    return h('div', 'gs-pass gs-panel k-grudge', ico, txt, s.sub ? reward(s.sub) : null);
  }
  const ic = TOAST_ICON[s.tone];
  return h('div', `gs-toast gs-panel gs-pill t-${s.tone}`, ic ? icon(ic) : null, h('span', 'gs-toast-txt', s.text), s.sub ? h('span', 'gs-toast-sub', s.sub) : null);
}

/** A reward line ("+10 gifts"): the gift glyph, the number at the name's size, the word a step smaller. */
function reward(sub: string): HTMLElement {
  const m = /^([+]?[\d,]+)\s+(.+)$/.exec(sub);
  const parts = m ? [h('span', 'gs-pass-gift-n gs-num', m[1]), h('span', 'gs-pass-gift-w', m[2])] : [h('span', 'gs-pass-gift-n', sub)];
  return h('span', 'gs-pass-gift', icon('gift'), ...parts);
}

function enter(el: HTMLElement, s: Spec): void {
  if (s.type === 'warn') {
    play(el, [{ opacity: 0, transform: 'translateY(-12px) scale(0.9)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: SPRING });
    return;
  }
  if (s.tone === 'grudge' && s.name) {
    play(el, [{ opacity: 0, transform: 'scale(0.82)' }, { opacity: 1, transform: 'scale(1.05)', offset: 0.6 }, { opacity: 1, transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
    // The ghost you settled with falls behind: it slips out of its badge to the left (clipped there).
    const trail = el.querySelector('.gs-pass-trail');
    if (trail) play(trail, [{ opacity: 0.9, transform: 'translateX(0) scale(1)' }, { opacity: 0, transform: 'translateX(-26px) scale(0.7)' }], { duration: 760, delay: 120, easing: EASE_OUT, fill: 'both' });
    return;
  }
  play(el, [{ opacity: 0, transform: 'translateY(-10px) scale(0.94)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: SPRING });
}
