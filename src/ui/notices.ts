import type { MountainCard, ToastTone } from './contract';
import { ChaosEvent, eventInfo } from '../sim/chaos';
import { h, type Kid } from './dom';
import { fmt } from './fmt';
import { icon, type IconName } from './icons';
import { EASE_OUT, play, reduced, SPRING } from './motion';

// The notice band: one banner at a time, docked over the race row at the top of the screen (the row
// fades out under it, and the combo and callout slot step down only by the extra height), so the
// top-centre stack never grows past two tiers. Under it, the chaos reveal slot. Ghost passes no
// longer take a banner: they flash inside the race row. Banners are the bigger moments (event
// telegraphs, event finales, grudge settled, missions, unlocks) and wait in a small priority queue: an
// event telegraph beats a finale, a finale beats a celebration, a celebration beats plain info. While
// something waits, the banner on stage is cut short (it still gets MIN_MS). Nothing here takes pointer
// events.
//
// A finale is the round an event ends on ("Outran the avalanche +2,000 style", "Caught 31 of 48"): a
// card in the event's own role colour with the payoff beside it, ranked above missions and unlocks, so
// a mission pop waits for it and can never push it out of the queue.

const TOAST_MS = 2200;
const GRUDGE_MS = 2000;
const NEMESIS_MS = 2600;
const FINALE_MS = 2600;
const WARN_MS = 2600;
/** Shortest time a banner stays up once shown, even with others waiting. */
const MIN_MS = 900;
/** The grudge toast and the grudge pass arrive in the same tick: within this window they merge. */
const MERGE_MS = 400;
const MAX_QUEUE = 3;

// Priorities, highest first. They index MAX_WAIT, so they stay consecutive integers.
const P_ALERT = 4; // chaos event telegraph
const P_FINALE = 3; // an event's finale
const P_CELEBRATE = 2; // grudge, mission, unlock, gift
const P_CAUTION = 1; // warn-tone toast
const P_INFO = 0; // info and ghost-tone toasts

/** How long each priority may sit in the queue before it is stale and dropped. */
const MAX_WAIT = [2500, 2500, 6000, 6000, 1500];

const TOAST_ICON: Record<ToastTone, IconName | null> = {
  ghost: 'ghost',
  grudge: 'ghost',
  mission: 'flag',
  gift: 'gift',
  warn: 'alert',
  info: null,
  finale: 'flag',
  unlock: 'snowflake',
};

const TOAST_PRI: Record<ToastTone, number> = {
  grudge: P_CELEBRATE,
  mission: P_CELEBRATE,
  gift: P_CELEBRATE,
  finale: P_FINALE,
  unlock: P_CELEBRATE,
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
  | { type: 'toast'; text: string; tone: ToastTone; sub?: string; name?: string; note?: string; why?: string; biome?: MountainCard['biome']; nemesis?: boolean; said?: string }
  | { type: 'warn'; text: string; event: ChaosEvent }
  | { type: 'finale'; text: string; sub: string | null; event: ChaosEvent };

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
  /** Bumped whenever the band is claimed or released, so a stale exit's release is ignored. */
  private bandToken = 0;
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
    // The write and onLayout wait for the next frame: inside this observer pass they resized what the
    // observers watch (the stage's own column, the occluder probe re-observed by onLayout), and the
    // browser reported "ResizeObserver loop completed with undelivered notifications".
    if (typeof ResizeObserver === 'function') {
      let raf = 0;
      new ResizeObserver((entries) => {
        const e = entries[entries.length - 1];
        const hgt = Math.round(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height);
        if (hgt === this.bandH) return;
        this.bandH = hgt;
        if (raf !== 0) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          this.parent.style.setProperty('--band-h', `${this.bandH}px`);
          this.onLayout();
        });
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
    if (!b || b.spec.type !== 'toast' || b.spec.name === name) return;
    b.spec.name = name;
    b.spec.said = undefined;
    if (b.el) {
      const fresh = render(b.spec);
      b.el.replaceWith(fresh);
      b.el = fresh;
      enter(fresh, b.spec);
    }
  }

  /**
   * The grudge settled (the director's grudgeSettled beat, which names its ghost): the rose banner,
   * "GRUDGE SETTLED" over the name with the paid gifts beside it. A nemesis is "NEMESIS DOWN" over
   * "Beat Mila after 3 runs", the gifts beside it ("Beat Mila after 3 runs · +20 gifts" read as one
   * line), with a longer hold. `why` names the moment that settled it when the director merged one
   * in (the beat's say, "Wiped out behind you"): a quiet line under the name.
   */
  grudgeSettled(name: string, nemesis: boolean, after: number, paid: number, why?: string): void {
    const c = grudgeCopy(name, nemesis, after, paid, why);
    const text = c.text;
    this.push({
      spec: { type: 'toast', text, tone: 'grudge', sub: c.sub, name, note: c.note, why: c.why, nemesis, said: c.said },
      pri: P_CELEBRATE,
      key: `t:grudge:${text}`,
      ms: nemesis ? NEMESIS_MS : GRUDGE_MS,
      at: performance.now(),
      el: null,
      shown: 0,
      end: 0,
    });
  }

  /**
   * An event's finale as a banner: the line in the event's role colour (the hazards ice blue, the Gift
   * Storm marigold, the Spirit Train mint) and its payoff beside it ("+2,000 style", "+10 gifts").
   * Ranked above every celebration, below only an event telegraph.
   */
  finale(text: string, sub: string | null, event: ChaosEvent): void {
    const t = text.trim();
    if (t === '') return;
    this.push({ spec: { type: 'finale', text: t, sub: sub?.trim() || null, event }, pri: P_FINALE, key: `f:${event}:${t}`, ms: FINALE_MS, at: performance.now(), el: null, shown: 0, end: 0 });
  }

  /** A mountain unlocked mid-run: its name, with a swatch of its own sky behind the snowflake. */
  unlock(name: string, biome: MountainCard['biome']): void {
    const text = `${name} unlocked`;
    this.push({ spec: { type: 'toast', text, tone: 'unlock', name, sub: 'Ride it from the title', biome }, pri: P_CELEBRATE, key: `t:unlock:${text}`, ms: TOAST_MS + 400, at: performance.now(), el: null, shown: 0, end: 0 });
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
    this.bandToken++;
    this.setBand(false);
  }

  /**
   * The crash beat owns the race row: a mission or unlock toast over it (or waiting for it) gives the
   * band back at once, so the place chip and the pack riding past the wreck are seen. The results card
   * shows the same missions; race banners (a grudge settled, a finale, a warning) keep their turn.
   */
  yieldToCrash(): void {
    const quiet = (b: Banner): boolean => b.spec.type === 'toast' && (b.spec.tone === 'mission' || b.spec.tone === 'unlock');
    this.queue = this.queue.filter((b) => !quiet(b));
    const cur = this.cur;
    if (!cur || !quiet(cur)) {
      // A race banner that hurried for a toast now dropped keeps its full time again.
      if (cur && cur.pri < P_ALERT && this.queue.length === 0) this.arm(cur, Math.max(cur.end, cur.shown + cur.ms));
      return;
    }
    window.clearTimeout(this.timer);
    this.cur = null;
    const out = cur.el ? this.exit(cur.el, cur.spec.type, true) : null;
    cur.el = null;
    this.next(out);
  }

  /** The banner on stage, for the occluder cache. */
  get current(): HTMLElement | null {
    return this.cur?.el ?? null;
  }

  /**
   * The ghost the banner on stage names ("GRUDGE SETTLED Mila"), or null: that banner is its pass's
   * picture, so the pass flash waiting under it does not play again after it (Hud.bannerName).
   */
  get currentName(): string | null {
    const s = this.cur?.spec;
    return s && s.type === 'toast' && s.tone === 'grudge' && s.name ? s.name : null;
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
    const out = cur?.el ? this.exit(cur.el, cur.spec.type, false) : null;
    if (cur) cur.el = null;
    this.next(out);
  }

  /**
   * Puts the next banner up, or gives the band back to the race row. `out` is the exit of the banner
   * that just left: the row fades back in only once that exit has finished, so the leaving banner and
   * the row never print over each other ("GRUDGE SETTLED chill49" over "1st of 7").
   */
  private next(out: Animation | null = null): void {
    if (this.cur) return;
    const now = performance.now();
    this.prune(now);
    const b = this.queue[0];
    if (!b || this.gated(b)) {
      if (out && out.playState !== 'finished') {
        const token = ++this.bandToken;
        const off = () => {
          // A banner that went up meanwhile keeps the band.
          if (token === this.bandToken && !this.cur) this.setBand(false);
        };
        out.addEventListener('finish', off, { once: true });
        out.addEventListener('cancel', off, { once: true });
      } else this.setBand(false);
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
    this.bandToken++;
    this.setBand(true);
  }

  /**
   * Banner leaves. Exits overlap the next entrance in the same grid cell, so nothing jumps. Returns the
   * exit animation (null when there is none and the banner went at once).
   */
  private exit(el: HTMLElement, type: Spec['type'], fast: boolean): Animation | null {
    el.classList.add('is-leaving');
    const frames: Keyframe[] =
      type === 'warn'
        ? [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px) scale(0.97)' }]
        : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px) scale(0.96)' }];
    const a = play(el, frames, { duration: fast ? 120 : type === 'warn' ? 240 : 200, easing: 'ease-in', fill: 'forwards' });
    const rm = () => el.remove();
    if (a) a.onfinish = rm;
    else rm();
    return a;
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

/**
 * The settled-grudge banner's copy: the kicker, the run count under the name, the reward, and the one
 * line a screen reader hears. A nemesis: "Nemesis down" over "Beat Mila after 3 runs", "+20 gifts"
 * beside it, read as "Nemesis down. Beat Mila after 3 runs · +20 gifts". Otherwise "Grudge settled"
 * over the name ("after 2 runs" under it once it took more than one). Names only, never a pronoun.
 */
export function grudgeCopy(name: string, nemesis: boolean, after: number, paid: number, why?: string): { text: string; note?: string; why?: string; sub?: string; said: string } {
  const text = nemesis ? 'Nemesis down' : 'Grudge settled';
  const runs = Math.max(1, Math.round(after));
  const note = nemesis ? `after ${fmt(runs)} ${runs === 1 ? 'run' : 'runs'}` : runs >= 2 ? `after ${fmt(runs)} runs` : undefined;
  const sub = paid > 0 ? `+${fmt(paid)} gifts` : undefined;
  const w = why?.trim() || undefined;
  const line = `${nemesis ? 'Beat ' : ''}${name}${note ? ` ${note}` : ''}${w ? `. ${w}` : ''}`;
  return { text, note, why: w, sub, said: `${text}. ${line}${sub ? ` · ${sub}` : ''}` };
}

function render(s: Spec): HTMLElement {
  if (s.type === 'warn') {
    const key = eventInfo(s.event).key;
    const el = h('div', `gs-warn gs-panel e-${key}`, h('span', 'gs-warn-ico', icon(EVENT_ICON[s.event] ?? 'alert')), h('span', 'gs-warn-txt', s.text));
    // Announced through the assertive sibling region instead of the polite stage.
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  if (s.type === 'finale') {
    // The event's finale: a card in its role colour, the line as the headline and the payoff beside it.
    const key = eventInfo(s.event).key;
    const ico = h('span', 'gs-fin-ico', icon(EVENT_ICON[s.event] ?? 'flag'));
    const pay = s.sub ? payoff(s.sub) : null;
    const t = h('span', 'gs-fin-t', s.text);
    // Screen readers hear one line ("Caught 48 of 48. Clean sweep: +10 gifts"); the hairline before the
    // payoff is only a visible separator.
    const said = s.sub ? `${s.text}. ${s.sub}` : null;
    if (said) for (const part of [ico, t, pay]) part?.setAttribute('aria-hidden', 'true');
    return h('div', `gs-fin gs-panel e-${key}`, ico, t, pay, said ? h('span', 'gs-sr', said) : null);
  }
  if (s.tone === 'grudge' && s.name) {
    // Grudge settled: the rose celebration, with the ghost's name as the headline and the reward
    // beside it at the same size. A nemesis reads "Beat Mila after 3 runs" under its kicker, the name
    // still the headline (the run count wraps under it when a phone has no room beside it).
    const ico = h('span', 'gs-pass-ico', icon('ghost'), icon('ghost', 'gs-pass-trail'));
    const name = h('span', 'gs-pass-name', s.name);
    name.translate = false;
    const kicker = h('span', 'gs-pass-k', s.text);
    const line = s.nemesis ? h('span', 'gs-pass-line', h('span', 'gs-pass-pre', 'Beat'), name, s.note ? h('span', 'gs-pass-note', s.note) : null) : null;
    // The moment that settled it ("Wiped out behind you") shares the quiet line under the name with a
    // plain grudge's run count, so the banner never grows a fourth row.
    const quiet = line ? s.why : [s.why, s.note].filter(Boolean).join(' · ');
    const under = quiet ? h('span', 'gs-pass-note', quiet) : null;
    const txt = line ? h('span', 'gs-pass-txt', kicker, line, under) : h('span', 'gs-pass-txt', kicker, name, under);
    const pay = s.sub ? reward(s.sub) : null;
    // Screen readers hear it as one line ("Nemesis down. Beat Mila after 3 runs · +20 gifts"); the
    // hairline before the reward is its visible separator.
    if (s.said) for (const part of [ico, txt, pay]) part?.setAttribute('aria-hidden', 'true');
    return h('div', `gs-pass gs-panel k-grudge${s.nemesis ? ' is-nemesis' : ''}`, ico, txt, pay, s.said ? srWithName(s.said, s.name) : null);
  }
  const ic = TOAST_ICON[s.tone];
  // An unlocked mountain's snowflake sits on a swatch of that mountain's own sky.
  const glyph = ic ? (s.biome ? h('span', `gs-toast-sky b-${s.biome}`, icon(ic)) : icon(ic)) : null;
  // A mountain's name is never machine-translated, as on the title.
  let body: Kid[] = [s.text];
  if (s.tone === 'unlock' && s.name && s.text.startsWith(s.name)) {
    const nm = h('span', '', s.name);
    nm.translate = false;
    body = [nm, s.text.slice(s.name.length)];
  }
  // The sub follows a spoken stop ("Ember Peak unlocked. Ride it from the title").
  return h('div', `gs-toast gs-panel gs-pill t-${s.tone}`, glyph, h('span', 'gs-toast-txt', ...body), s.sub ? h('span', 'gs-sr', '. ') : null, s.sub ? h('span', 'gs-toast-sub', s.sub) : null);
}

/** A screen-reader line with the ghost's handle in it kept out of machine translation, like the
 *  visible name it stands for. */
function srWithName(said: string, name: string): HTMLElement {
  const i = said.indexOf(name);
  if (i < 0) return h('span', 'gs-sr', said);
  const nm = h('span', '', name);
  nm.translate = false;
  return h('span', 'gs-sr', said.slice(0, i), nm, said.slice(i + name.length));
}

/**
 * A finale's payoff, past a hairline: a gift reward ("+10 gifts") in marigold with the gift glyph, a
 * style reward ("+2,000 style") in off-white, any words before it ("Clean sweep:") a step smaller.
 */
function payoff(sub: string): HTMLElement {
  const m = /^(.*?)\s*([+][\d,]+)\s+(gifts?|style)$/i.exec(sub);
  if (!m) return h('span', 'gs-fin-pay', h('span', 'gs-fin-pay-w', sub));
  const gift = m[3].toLowerCase().startsWith('gift');
  return h(
    'span',
    `gs-fin-pay${gift ? ' is-gift' : ''}`,
    m[1] ? h('span', 'gs-fin-pay-pre', m[1]) : null,
    gift ? icon('gift') : null,
    h('span', 'gs-fin-pay-n gs-num', m[2]),
    h('span', 'gs-fin-pay-w', m[3]),
  );
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
  if (s.type === 'finale') {
    // Won the round: slammed down onto the band, then one ring flash in the event's colour.
    play(
      el,
      [
        { opacity: 0, transform: 'scale(1.3)' },
        { opacity: 1, transform: 'scale(0.95)', offset: 0.55, easing: SPRING },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 380, easing: 'ease-in' },
    );
    if (!reduced()) {
      const ring = h('span', 'gs-fin-ring');
      el.append(ring);
      play(ring, [{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.08, 1.4)' }], { duration: 700, delay: 180, easing: EASE_OUT, fill: 'both' });
    }
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
