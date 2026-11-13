import type { PadMenu } from '../game/pad';

// The gamepad in the menus. Focus is the cursor: a direction moves it to the nearest control that way,
// A presses the control it is on, B goes back. It only ever moves focus and clicks, so every screen keeps
// its own keyboard order and its own handlers, and a screen built later needs nothing added here.

/** A held direction moves once, waits this long, then repeats at REPEAT_MS. */
const REPEAT_DELAY_MS = 380;
const REPEAT_MS = 130;
/** A slider moves this much of its range for each step of the d-pad or stick. */
const RANGE_STEP = 5;
/** The ring on the control the pad is on, where the browser does not draw :focus-visible for a focus
 *  that no key moved. */
const MARK = 'gs-pad-focus';

const CONTROLS = 'button, input, select, a[href]';

function usable(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-hidden') === 'true') return false;
  // A roving tab stop (the garage's tabs) is out of the Tab order and still a place the pad can go.
  if (el.tabIndex < 0 && el.getAttribute('role') !== 'tab') return false;
  if (el.closest('[hidden], [inert]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * The nearest control from `from` in a direction: how far along the direction its centre lies, plus a
 * heavier charge for how far it sits off to the side, none while the two overlap on that side axis (a
 * wide button under a narrow one is straight below it).
 */
function nearest(from: HTMLElement, all: HTMLElement[], dx: number, dy: number): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of all) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const along = dx !== 0 ? (bx - ax) * dx : (by - ay) * dy;
    if (along < 4) continue;
    const overlap = dx !== 0 ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) : Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const across = overlap > 0 ? 0 : dx !== 0 ? Math.abs(by - ay) : Math.abs(bx - ax);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

export class PadNav {
  private heldX = 0;
  private heldY = 0;
  private nextAt = 0;
  private marked: HTMLElement | null = null;

  /** Nothing for the pad to steer (a run is being ridden, or the pad is not the input in use). */
  idle(): void {
    this.heldX = this.heldY = 0;
    this.mark(null);
  }

  /**
   * One frame of the pad on `scope`, the surface on top. `modal`: it is a sheet or the pause card, so B
   * goes back. Returns true when A pressed a control.
   */
  step(p: PadMenu, scope: HTMLElement, modal: boolean, now: number): boolean {
    const current = this.focused(scope);
    this.mark(current);
    if (p.x !== this.heldX || p.y !== this.heldY) {
      this.heldX = p.x;
      this.heldY = p.y;
      this.nextAt = now + REPEAT_DELAY_MS;
      if (p.x !== 0 || p.y !== 0) this.move(scope, current, p.x, p.y);
    } else if ((p.x !== 0 || p.y !== 0) && now >= this.nextAt) {
      this.nextAt = now + REPEAT_MS;
      this.move(scope, current, p.x, p.y);
    }
    if (p.b && modal) {
      // Back: a sheet's close button, or Resume on the pause card.
      const back = scope.querySelector<HTMLElement>('[data-fk^="close-"]') ?? scope.querySelector<HTMLElement>('[data-fk="resume"]');
      back?.click();
    }
    if (p.a && current) {
      current.click();
      return true;
    }
    return false;
  }

  /** The control in `scope` that has focus, if it is one the pad could have reached. */
  private focused(scope: HTMLElement): HTMLElement | null {
    const a = document.activeElement;
    return a instanceof HTMLElement && scope.contains(a) && a.matches(CONTROLS) && usable(a) ? a : null;
  }

  private move(scope: HTMLElement, current: HTMLElement | null, dx: number, dy: number): void {
    // Up and down win over a diagonal: lists run that way.
    if (dy !== 0) dx = 0;
    if (!current) {
      // Nothing focused: the first press lands on the screen's primary action.
      const primary = scope.querySelector<HTMLElement>('.gs-btn-primary');
      const first = primary && usable(primary) ? primary : Array.from(scope.querySelectorAll<HTMLElement>(CONTROLS)).find(usable);
      if (first) this.focus(first);
      return;
    }
    // On a slider, left and right move its value; up and down leave it.
    if (dx !== 0 && current instanceof HTMLInputElement && current.type === 'range') {
      const lo = Number(current.min || 0);
      const hi = Number(current.max || 100);
      const v = Math.max(lo, Math.min(hi, Number(current.value) + dx * RANGE_STEP));
      if (v !== Number(current.value)) {
        current.value = String(v);
        current.dispatchEvent(new Event('input', { bubbles: true }));
        current.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    const all = Array.from(scope.querySelectorAll<HTMLElement>(CONTROLS)).filter(usable);
    const to = nearest(current, all, dx, dy);
    if (to) this.focus(to);
  }

  private focus(el: HTMLElement): void {
    // focusVisible asks for the ring where the browser knows the option; the mark covers where it does not.
    el.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.mark(el);
  }

  private mark(el: HTMLElement | null): void {
    if (el === this.marked) return;
    this.marked?.classList.remove(MARK);
    this.marked = el;
    el?.classList.add(MARK);
  }
}
