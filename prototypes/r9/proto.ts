// Round 9, the screens lane: what the title and results prototypes share. The game's own glyphs (ui/icons.ts) and
// the pad's own cursor (ui/padnav.ts, so the prototypes move focus exactly as the game's menus do); a door or a sheet
// that opens from the side it is built on, traps focus, and closes with Escape, Backspace, the pad's B or its Close;
// and the counter that reads a screen's visible words and controls the way a player meets them.
import { iconSvg, type IconName } from '../../src/ui/icons';
import { PadNav } from '../../src/ui/padnav';

export type Kid = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const k of kids) if (k !== null && k !== undefined && k !== false) el.append(k);
  return el;
}

export function ico(name: IconName, cls = ''): HTMLSpanElement {
  const s = h('span', `gs9-i${cls ? ' ' + cls : ''}`);
  s.innerHTML = iconSvg(name);
  s.setAttribute('aria-hidden', 'true');
  return s;
}

export function sr(text: string): HTMLSpanElement {
  return h('span', 'gs9-sr', text);
}

export const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A button of one of the three ranks, with its words (an icon only ever beside them). */
export function button(rank: 'primary' | 'secondary' | 'quiet', label: Kid | Kid[], o: { icon?: IconName; fk?: string; onClick?: () => void; aria?: string; cls?: string } = {}): HTMLButtonElement {
  const b = h('button', `gs9-b gs9-b-${rank}${rank === 'primary' ? ' gs-btn-primary' : ''}${o.cls ? ' ' + o.cls : ''}`);
  b.type = 'button';
  if (o.icon) b.append(ico(o.icon));
  for (const k of Array.isArray(label) ? label : [label]) if (k) b.append(k);
  if (o.fk) b.dataset.fk = o.fk;
  if (o.aria) b.setAttribute('aria-label', o.aria);
  if (o.onClick) b.addEventListener('click', o.onClick);
  return b;
}

// ---------------------------------------------------------------- sheets (a door's room, Details)

interface Open {
  el: HTMLElement;
  from: HTMLElement | null;
  close: () => void;
}
const stack: Open[] = [];

/**
 * Opens a sheet: it takes focus (its first control, or its heading), keeps Tab inside it, and gives focus back to the
 * control that opened it when it closes. Escape, Backspace and the pad's B close the top one.
 */
export function openSheet(el: HTMLElement, from: HTMLElement | null, onClose: () => void): () => void {
  const prev = stack[stack.length - 1];
  prev?.el.setAttribute('inert', '');
  for (const s of document.querySelectorAll<HTMLElement>('[data-screen]')) s.setAttribute('inert', '');
  el.removeAttribute('inert');
  const close = (): void => {
    const i = stack.findIndex((s) => s.el === el);
    if (i < 0) return;
    stack.splice(i, 1);
    onClose();
    const top = stack[stack.length - 1];
    if (top) top.el.removeAttribute('inert');
    else for (const s of document.querySelectorAll<HTMLElement>('[data-screen]')) s.removeAttribute('inert');
    from?.focus({ preventScroll: true });
  };
  stack.push({ el, from, close });
  requestAnimationFrame(() => (el.querySelector<HTMLElement>('[data-first]') ?? el.querySelector<HTMLElement>('button, a[href]') ?? el).focus({ preventScroll: true }));
  return close;
}

export function closeTop(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.key === 'Escape' || e.key === 'Backspace') && stack.length > 0) {
    e.preventDefault();
    closeTop();
    return;
  }
  // Tab stays inside the open sheet.
  const top = stack[stack.length - 1];
  if (e.key === 'Tab' && top) {
    const all = Array.from(top.el.querySelectorAll<HTMLElement>('button, a[href], input')).filter((x) => x.offsetParent !== null);
    if (all.length === 0) return;
    const first = all[0];
    const last = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

// ---------------------------------------------------------------- the pad, and the arrows as a pad

const nav = new PadNav();
const scope = (): HTMLElement => stack[stack.length - 1]?.el ?? document.querySelector<HTMLElement>('[data-screen]') ?? document.body;

/** Arrow keys move focus the way the pad's d-pad does (to the nearest control that way); Enter and Space press. */
window.addEventListener('keydown', (e: KeyboardEvent) => {
  const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const v = d[e.key];
  if (!v) return;
  const t = e.target as HTMLElement | null;
  if (t && t.tagName === 'INPUT') return;
  e.preventDefault();
  const now = performance.now();
  nav.step({ x: v[0], y: v[1], a: false, b: false, start: false }, scope(), stack.length > 0, now);
  nav.step({ x: 0, y: 0, a: false, b: false, start: false }, scope(), stack.length > 0, now);
});

let padWas = { a: false, b: false };
function pollPad(): void {
  const pad = Array.from(navigator.getGamepads?.() ?? []).find((p) => p && p.connected);
  if (pad) {
    const bt = (i: number) => !!pad.buttons[i]?.pressed;
    const x = bt(14) || pad.axes[0] < -0.5 ? -1 : bt(15) || pad.axes[0] > 0.5 ? 1 : 0;
    const y = bt(12) || pad.axes[1] < -0.5 ? -1 : bt(13) || pad.axes[1] > 0.5 ? 1 : 0;
    const a = bt(0);
    const b = bt(1);
    const m = { x, y, a: a && !padWas.a, b: b && !padWas.b, start: false };
    padWas = { a, b };
    document.documentElement.classList.add('is-pad');
    if (m.b && stack.length > 0) closeTop();
    else nav.step(m, scope(), stack.length > 0, performance.now());
  }
  requestAnimationFrame(pollPad);
}
requestAnimationFrame(pollPad);
window.addEventListener('pointerdown', () => document.documentElement.classList.remove('is-pad'));

export { countScreen, device, type Count } from './count';
