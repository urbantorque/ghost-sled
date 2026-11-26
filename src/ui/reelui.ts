import './reel.css';
import { h } from './dom';
import { icon, type IconName } from './icons';

// The highlight reel's page: a title card at the frame's foot, a hairline a shot along its head, and the
// controls (pause, watch again, share, skip). Built when a reel starts and removed when it ends. The
// card is a polite live region, so a reader hears each shot named as it comes; the picture itself is
// decoration over those words.

export interface ReelUiHandlers {
  onPause(): void;
  onReplay(): void;
  onSkip(): void;
  /** Absent: no Share button (a friend's reel, or nowhere to send a link). */
  onShare?: () => void;
  sound(kind: 'tap' | 'back'): void;
  /** Round 8, G11: the reel plays to be saved as a clip. Its controls are what it is doing and Cancel (Skip's place
   *  and Escape): a clip has no pause and no watch-again of its own. */
  recording?: boolean;
}

export class ReelUi {
  readonly el: HTMLElement;
  private readonly card: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly line: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly recEl: HTMLElement | null;
  private fills: HTMLElement[] = [];
  private filled: number[] = [];
  private readonly onKey: (e: KeyboardEvent) => void;

  constructor(parent: HTMLElement, hd: ReelUiHandlers) {
    const b = (name: IconName, label: string, text: string | null, sound: 'tap' | 'back', run: () => void): HTMLButtonElement => {
      const el = h('button', text ? 'gs-btn gs-btn-soft' : 'gs-btn gs-btn-soft gs-btn-round', icon(name), text ? h('span', 'gs-btn-label', text) : null);
      el.type = 'button';
      if (!text) el.setAttribute('aria-label', label);
      el.addEventListener('click', () => {
        hd.sound(sound);
        run();
      });
      return el;
    };
    this.kicker = h('div', 'gs-film-kicker');
    this.line = h('div', 'gs-film-line');
    this.card = h('div', 'gs-film-card', this.kicker, this.line);
    this.card.setAttribute('aria-live', 'polite');
    this.pauseBtn = b('pause', 'Pause', null, 'tap', hd.onPause);
    const rec = !!hd.recording;
    const skip = b('close', rec ? 'Cancel' : 'Skip', rec ? 'Cancel' : 'Skip', 'back', hd.onSkip);
    // (A clip: a quiet chip says what it is doing, the dot vermillion once it records; Cancel drops it.)
    this.recEl = rec ? h('span', 'gs-film-rec', h('i', 'gs-film-rec-dot'), h('span', 'gs-film-rec-t', 'Getting Ready…')) : null;
    this.recEl?.setAttribute('role', 'status');
    this.recEl?.firstElementChild?.setAttribute('aria-hidden', 'true');
    const ctl = rec
      ? h('div', 'gs-film-ctl', this.recEl, skip)
      : h('div', 'gs-film-ctl', this.pauseBtn, b('back', 'Watch again', null, 'tap', hd.onReplay), hd.onShare ? b('link', 'Share', 'Share', 'tap', hd.onShare) : null, skip);
    this.bar = h('div', 'gs-film-bar');
    this.bar.setAttribute('aria-hidden', 'true');
    this.el = h('section', 'gs-film', h('div', 'gs-film-dip'), this.bar, h('div', 'gs-film-foot', this.card, ctl));
    this.el.setAttribute('aria-label', 'Your run, directed');
    parent.append(this.el);
    // Skippable at any moment: Escape (and Backspace, round 9's other way back), as well as the button. Space and K
    // pause. (Round 9, U4: taken at capture and marked taken, so ui.ts back(), which runs on the window's bubbling
    // phase and skips a key already taken, never also closes what the reel was opened over: one press, one thing.)
    this.onKey = (e) => {
      if ((e.key === 'Escape' || e.key === 'Backspace') && !e.repeat) {
        e.preventDefault();
        hd.onSkip();
      } else if (!rec && (e.key === ' ' || e.key === 'k') && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        hd.onPause();
      }
    };
    window.addEventListener('keydown', this.onKey, { capture: true });
    skip.focus({ preventScroll: true });
  }

  /** One hairline a shot, each as wide as its share of the reel. */
  setShots(lengths: readonly number[]): void {
    this.fills = [];
    this.filled = [];
    this.bar.replaceChildren(
      ...lengths.map((n) => {
        const fill = h('i');
        this.fills.push(fill);
        this.filled.push(-1);
        const seg = h('span', 'gs-film-seg', fill);
        seg.style.flex = `${Math.max(1, Math.round(n))} 1 0`;
        return seg;
      }),
    );
  }

  /** The card for a shot (or for the reel's opening). */
  say(kicker: string, line: string): void {
    this.kicker.textContent = kicker;
    this.line.textContent = line;
    this.card.classList.remove('is-new');
    void this.card.offsetWidth;
    this.card.classList.add('is-new');
  }

  /** Shot `i` is `k` (0 to 1) played: written in fiftieths, so a frame rarely writes at all. */
  progress(i: number, k: number): void {
    for (let j = 0; j < this.fills.length; j++) {
      const v = j < i ? 50 : j > i ? 0 : Math.round(Math.max(0, Math.min(1, k)) * 50);
      if (v === this.filled[j]) continue;
      this.filled[j] = v;
      this.fills[j].style.transform = `scaleX(${v / 50})`;
    }
  }

  /** A clip's chip: recording from the first cut. */
  recording(state: 'on'): void {
    const el = this.recEl;
    if (!el) return;
    el.classList.toggle('is-on', state === 'on');
    const t = el.querySelector('.gs-film-rec-t');
    if (t) t.textContent = 'Recording';
  }

  cut(on: boolean): void {
    this.el.classList.toggle('is-cut', on);
  }

  paused(on: boolean): void {
    this.el.classList.toggle('is-paused', on);
    this.pauseBtn.replaceChildren(icon(on ? 'play' : 'pause'));
    this.pauseBtn.setAttribute('aria-label', on ? 'Play' : 'Pause');
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey, { capture: true });
    this.el.remove();
  }
}
