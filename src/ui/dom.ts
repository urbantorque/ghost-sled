import { icon, type IconName } from './icons';
import { fmt } from './fmt';
import { reduced } from './motion';

// Small DOM toolkit: element builder, button factory, and diffing slots that only touch the DOM
// when a value actually changed (the HUD calls update every frame).

export type Kid = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}

/** Visually hidden text for screen readers. */
export function sr(text: string): HTMLSpanElement {
  return h('span', 'gs-sr', text);
}

export function kbd(label: string, cls = ''): HTMLElement {
  return h('kbd', cls ? `gs-kbd ${cls}` : 'gs-kbd', label);
}

/** A keycap containing a glyph (arrow keys). */
export function kbdIcon(name: IconName, label: string): HTMLElement {
  const k = h('kbd', 'gs-kbd gs-kbd-ico', icon(name), sr(label));
  return k;
}

export type UiSound = 'tap' | 'confirm' | 'back';

/** What every screen module needs from the UI root. */
export interface Ctx {
  sound(kind: UiSound): void;
  /** True right after Space/Enter was pressed on a button whose action the game handles itself. */
  gameKeyJustPressed(): boolean;
}

export interface BtnOpts {
  cls?: string;
  label?: string;
  icon?: IconName;
  iconCls?: string;
  /** Required for icon-only buttons. */
  aria?: string;
  sound?: UiSound;
  /** Focus key: focus is restored to the element with the same key across re-renders. */
  fk?: string;
  /** The game also maps Space/Enter to this action, so keyboard activation is left to the game. */
  gameKey?: boolean;
  disabled?: boolean;
  onClick(): void;
}

export function btn(ctx: Ctx, o: BtnOpts, ...extra: Kid[]): HTMLButtonElement {
  const b = h('button', o.cls ? `gs-btn ${o.cls}` : 'gs-btn');
  b.type = 'button';
  if (o.icon) b.append(icon(o.icon, o.iconCls));
  if (o.label) b.append(h('span', 'gs-btn-label', o.label));
  for (const k of extra) if (k) b.append(k);
  if (o.aria) b.setAttribute('aria-label', o.aria);
  if (o.fk) b.dataset.fk = o.fk;
  if (o.gameKey) b.dataset.gamekey = '';
  if (o.disabled) b.disabled = true;
  b.addEventListener('click', (e) => {
    if (o.gameKey && e.detail === 0 && ctx.gameKeyJustPressed()) return;
    ctx.sound(o.sound ?? 'tap');
    o.onClick();
  });
  return b;
}

export function captureFocus(scope: HTMLElement): string | null {
  const a = document.activeElement;
  if (a instanceof HTMLElement && scope.contains(a)) return a.dataset.fk ?? null;
  return null;
}

export function restoreFocus(scope: HTMLElement, fk: string | null): boolean {
  if (!fk) return false;
  const el = scope.querySelector<HTMLElement>(`[data-fk="${CSS.escape(fk)}"]`);
  if (!el) return false;
  el.focus({ preventScroll: true });
  return true;
}

/** Restart a CSS animation class. */
export function replay(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/** Text slot that writes textContent only on change. */
export class Txt {
  private v: string | number | undefined;
  constructor(readonly el: HTMLElement) {}

  str(s: string): boolean {
    if (s === this.v) return false;
    this.v = s;
    this.el.textContent = s;
    return true;
  }

  /** Rounded, thousands-separated number with optional prefix/suffix. Returns true on change. */
  num(n: number, suffix = '', prefix = ''): boolean {
    const r = Math.round(n);
    if (r === this.v) return false;
    this.v = r;
    this.el.textContent = prefix + fmt(r) + suffix;
    return true;
  }
}

/** Class toggle that writes only on change. */
export class Flag {
  private v: boolean | undefined;
  constructor(
    readonly el: Element,
    readonly cls = 'is-on',
  ) {}

  set(on: boolean): boolean {
    if (on === this.v) return false;
    this.v = on;
    this.el.classList.toggle(this.cls, on);
    return true;
  }

  get on(): boolean {
    return this.v === true;
  }
}

/**
 * A show/hide surface. Adds `is-in` on open (entrance animation) and `is-out` on close, then sets
 * `hidden` once the exit has played so nothing invisible can catch pointer or focus.
 */
export class Layer {
  open = false;
  private timer = 0;

  constructor(
    readonly el: HTMLElement,
    private readonly outMs = 200,
  ) {
    el.hidden = true;
  }

  /** Returns true when the layer was not open before. */
  show(): boolean {
    window.clearTimeout(this.timer);
    const was = this.open;
    this.open = true;
    this.el.hidden = false;
    this.el.classList.remove('is-out');
    if (!was) replay(this.el, 'is-in');
    return !was;
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    // A control on a closing surface must not keep the keyboard: the game reads keys from window,
    // and a focused UI control would keep swallowing them until the exit animation ends.
    const a = document.activeElement;
    if (a instanceof HTMLElement && this.el.contains(a)) a.blur();
    this.el.classList.remove('is-in');
    this.el.classList.add('is-out');
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(
      () => {
        this.el.hidden = true;
        this.el.classList.remove('is-out');
      },
      reduced() ? 140 : this.outMs,
    );
  }
}
