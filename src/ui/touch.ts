import type { TouchVisual } from '../game/input';
import { Flag, h } from './dom';

// Faint thumb rings for touch play: the steering origin, the current steering thumb with a line
// between them, and the action thumb. Positions update every frame, so writes are diffed.

export class TouchViz {
  readonly el: HTMLElement;
  private readonly origin: HTMLElement;
  private readonly thumb: HTMLElement;
  private readonly line: HTMLElement;
  private readonly action: HTMLElement;
  private readonly flags: Flag[];
  private last = ['', '', '', ''];

  constructor(parent: HTMLElement) {
    this.origin = h('div', 'gs-ring');
    this.thumb = h('div', 'gs-ring gs-ring-thumb');
    this.line = h('div', 'gs-ring-line');
    this.action = h('div', 'gs-ring gs-ring-act');
    this.el = h('div', 'gs-touch', this.line, this.origin, this.thumb, this.action);
    this.el.setAttribute('aria-hidden', 'true');
    this.flags = [new Flag(this.origin), new Flag(this.thumb), new Flag(this.line), new Flag(this.action)];
    parent.append(this.el);
  }

  set(v: TouchVisual, visible: boolean): void {
    const s = visible ? v.steer : null;
    const a = visible ? v.action : null;
    this.flags[0].set(s !== null);
    this.flags[1].set(s !== null);
    this.flags[2].set(s !== null && Math.abs(s.x - s.ox) > 2);
    this.flags[3].set(a !== null);
    if (s) {
      this.move(0, this.origin, `translate3d(${Math.round(s.ox)}px, ${Math.round(s.y)}px, 0)`);
      this.move(1, this.thumb, `translate3d(${Math.round(s.x)}px, ${Math.round(s.y)}px, 0)`);
      const x0 = Math.min(s.x, s.ox);
      const w = Math.max(1, Math.abs(s.x - s.ox));
      this.move(2, this.line, `translate3d(${Math.round(x0)}px, ${Math.round(s.y)}px, 0) scaleX(${Math.round(w)})`);
    }
    if (a) this.move(3, this.action, `translate3d(${Math.round(a.x)}px, ${Math.round(a.y)}px, 0)`);
  }

  private move(i: number, el: HTMLElement, t: string): void {
    if (this.last[i] === t) return;
    this.last[i] = t;
    el.style.transform = t;
  }
}
