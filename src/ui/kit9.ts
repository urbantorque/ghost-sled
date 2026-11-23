import { btn, h, type Ctx, type Kid, type UiSound } from './dom';
import { icon, type IconName } from './icons';
import './kit9.css';

// Round 9 (U3): the pieces the title, its rooms and the results are built from, on tokens.css's one system. A
// button in one of three ranks, always with its words (an icon only ever beside them): primary (vermillion, the run,
// one a screen), secondary (an ink pill: a door, a choice, Details), quiet (Home, Back, Close). And a sheet (a door's
// room, the results' Details) that opens from the side its screen is built on, takes focus, keeps Tab inside, makes
// the screen under it inert, and gives focus back to the control that opened it. Escape, Backspace and the pad's B
// close the top one (ui.ts); its own Back or Close does too.

export type Rank = 'primary' | 'secondary' | 'quiet';

export interface B9 {
  icon?: IconName;
  /** Focus key (dom.ts): focus comes back to it across re-renders, and the pad's B finds `close-*`. */
  fk?: string;
  aria?: string;
  cls?: string;
  sound?: UiSound;
  /** The game maps Space and Enter to this action too (Ride, Run Again). */
  gameKey?: boolean;
  onClick(): void;
}

/** A button of one of the three ranks, with its words. The primary also wears gs-btn-primary: the pad's first press
 *  lands on it (padnav.ts) and the screen bars count it by that class. */
export function b9(ctx: Ctx, rank: Rank, label: Kid | Kid[], o: B9): HTMLButtonElement {
  const kids = Array.isArray(label) ? label : [label];
  const b = btn(ctx, { cls: `gs9-b gs9-b-${rank}${rank === 'primary' ? ' gs-btn-primary' : ''}${o.cls ? ` ${o.cls}` : ''}`, icon: o.icon, iconCls: 'gs9-i', aria: o.aria, fk: o.fk, sound: o.sound, gameKey: o.gameKey, onClick: o.onClick }, ...kids.map((k) => (typeof k === 'string' ? h('span', 'gs9-b-t', k) : k)));
  return b;
}

/** A glyph from the game's family (icons.ts), sized to the words beside it. */
export const ico9 = (name: IconName, cls = ''): HTMLSpanElement => icon(name, cls ? `gs9-i ${cls}` : 'gs9-i');

/** A medal's disc in its metal (1 bronze, 2 silver, 3 gold). */
export function medalDisc(medal: number): HTMLElement {
  const d = h('span', `gs9-medal m-${Math.max(0, Math.min(3, Math.floor(medal)))}`);
  d.setAttribute('aria-hidden', 'true');
  return d;
}

/** "1st", "2nd", "11th". */
export function ordinal9(n: number): string {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
}

// ---------------------------------------------------------------- sheets

interface Open {
  el: HTMLElement;
  from: HTMLElement | null;
  behind: HTMLElement[];
  close: () => void;
}

const stack: Open[] = [];

/** Whether a round-9 sheet is up (a room, Details, or a view pushed in one). */
export const sheetOpen = (): boolean => stack.length > 0;

/** The sheet on top, or null. */
export const topSheet = (): HTMLElement | null => stack[stack.length - 1]?.el ?? null;

/** Closes the sheet on top (Escape, Backspace, the pad's B). False with none open. */
export function closeTopSheet(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

/** Closes every sheet (the screen under them is leaving). */
export function closeAllSheets(): void {
  while (stack.length > 0) stack[stack.length - 1].close();
}

/**
 * Opens a sheet: it takes focus (its `[data-first]`, else its heading, else its first control), keeps Tab inside it,
 * makes `behind` inert (the screen under it, and a sheet under this one), and on close gives focus back to `from`.
 * Returns its close, which runs `onClose` once.
 */
export function openSheet(el: HTMLElement, from: HTMLElement | null, behind: HTMLElement[], onClose: () => void): () => void {
  const prev = stack[stack.length - 1];
  const under = prev ? [...behind, prev.el] : behind;
  for (const b of under) b.inert = true;
  el.inert = false;
  let shut = false;
  const close = (): void => {
    if (shut) return;
    shut = true;
    const i = stack.findIndex((s) => s.el === el);
    if (i >= 0) stack.splice(i, 1);
    // (A sheet still open under this one keeps its own screen inert; it comes back to life itself.)
    for (const b of under) if (!stack.some((s) => s.behind.includes(b))) b.inert = false;
    onClose();
    if (from?.isConnected) from.focus({ preventScroll: true });
  };
  stack.push({ el, from, behind: under, close });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const all = Array.from(el.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.closest('[inert], [hidden]') && x.getClientRects().length > 0);
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
  });
  requestAnimationFrame(() => {
    if (shut) return;
    const t = el.querySelector<HTMLElement>('[data-first]') ?? el.querySelector<HTMLElement>('.gs9-sheet-h[tabindex]') ?? el.querySelector<HTMLElement>('button, a[href]');
    (t ?? el).focus({ preventScroll: true });
  });
  return close;
}

/** A sheet's frame: its heading (focusable, so focus lands on words, not on Close) and its close button. */
export function sheetFrame(ctx: Ctx, o: { cls: string; title: string; close: string; closeIcon: IconName; fk: string; onClose(): void }): { el: HTMLElement; body: HTMLElement; head: HTMLElement } {
  const el = h('section', `gs9-sheet ${o.cls}`);
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', o.title);
  const heading = h('h2', 'gs9-sheet-h', o.title);
  heading.tabIndex = -1;
  const x = b9(ctx, 'quiet', o.close, { icon: o.closeIcon, fk: o.fk, sound: 'back', onClick: () => o.onClose() });
  const head = h('header', 'gs9-sheet-head', heading, x);
  const body = h('div', 'gs9-sheet-body');
  el.append(head, body);
  return { el, body, head };
}
