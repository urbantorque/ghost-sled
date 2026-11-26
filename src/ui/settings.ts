import type { SettingsModel, UIHandlers } from './contract';
import { h, type Ctx } from './dom';
import { percent } from './fmt';

// The settings, in the round's language (round 9, U4): the settings sheet's body (menus.ts), opened from the title's
// Settings door or the pause card's Settings. Built once, then kept in sync with set(); every change is reported live
// through onSettings. Three blocks, each its heading and its controls: Sound (three sliders, each its figure as a
// percentage), Quality (five pills, one pressed, and a line saying what Auto is doing), and the two switches (control
// hints; the pad's rumble once a pad has been used).

type Vol = 'master' | 'music' | 'sfx';
type Quality = SettingsModel['quality'];

const QUALITIES: Array<{ q: Quality; label: string }> = [
  { q: 'auto', label: 'Auto' },
  { q: 'low', label: 'Low' },
  { q: 'medium', label: 'Medium' },
  { q: 'high', label: 'High' },
  { q: 'ultra', label: 'Ultra' },
];

const TIER: Record<SettingsModel['currentTier'], string> = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };

let uid = 0;

export class SettingsPanel {
  readonly el: HTMLElement;
  private m: SettingsModel = { master: 1, music: 0.8, sfx: 1, quality: 'auto', currentTier: 'high', hints: true, rumble: true };
  private readonly ranges = new Map<Vol, { input: HTMLInputElement; out: HTMLElement }>();
  private readonly segs = new Map<Quality, HTMLButtonElement>();
  private readonly cap: HTMLElement;
  private readonly hintsBtn: HTMLButtonElement;
  private readonly rumbleBtn: HTMLButtonElement;

  constructor(
    private readonly ctx: Ctx,
    private readonly hd: UIHandlers,
  ) {
    const id = `set9-${++uid}`;
    this.el = h('div', 'gs9-set');

    const sh = h('h3', 'gs9-cap', 'Sound');
    sh.id = `${id}-snd`;
    const sound = h('div', 'gs9-set-g', sh, this.slider(id, 'master', 'Master'), this.slider(id, 'music', 'Music'), this.slider(id, 'sfx', 'Effects'));
    sound.setAttribute('role', 'group');
    sound.setAttribute('aria-labelledby', sh.id);

    const qh = h('h3', 'gs9-cap', 'Quality');
    qh.id = `${id}-q`;
    const seg = h('div', 'gs9-seg gs9-set-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-labelledby', qh.id);
    for (const { q, label } of QUALITIES) {
      const b = h('button', 'gs9-b', h('span', 'gs9-b-t', label));
      b.type = 'button';
      b.dataset.fk = `q-${q}`;
      b.addEventListener('click', () => {
        if (this.m.quality === q) return;
        this.ctx.sound('tap');
        this.m = { ...this.m, quality: q };
        this.paintQuality();
        this.hd.onSettings({ quality: q });
      });
      this.segs.set(q, b);
      seg.append(b);
    }
    this.cap = h('p', 'gs9-block-p');
    this.cap.setAttribute('aria-live', 'polite');
    const qual = h('div', 'gs9-set-g', qh, seg, this.cap);

    this.hintsBtn = this.switchRow('hints', 'Control Hints', null, () => {
      this.m = { ...this.m, hints: !this.m.hints };
      this.paintSwitches();
      this.hd.onSettings({ hints: this.m.hints });
    });
    // The pad's rumble. The row shows once a gamepad has been used (.gs-has-pad on the UI root).
    this.rumbleBtn = this.switchRow('rumble', 'Controller Rumble', null, () => {
      this.m = { ...this.m, rumble: !this.m.rumble };
      this.paintSwitches();
      this.hd.onSettings({ rumble: this.m.rumble });
    });
    this.rumbleBtn.classList.add('gs9-set-rumble');

    this.el.append(sound, h('div', 'gs9-sep'), qual, h('div', 'gs9-sep'), this.hintsBtn, this.rumbleBtn);
    this.set(this.m);
  }

  private slider(id: string, key: Vol, label: string): HTMLElement {
    const inputId = `${id}-${key}`;
    const lab = h('label', 'gs9-set-l', label);
    lab.htmlFor = inputId;
    const input = h('input', 'gs9-range');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.id = inputId;
    input.dataset.fk = `v-${key}`;
    const out = h('span', 'gs9-set-v gs9-num');
    out.setAttribute('aria-hidden', 'true');
    input.addEventListener('input', () => {
      const patch: Partial<SettingsModel> = {};
      patch[key] = Number(input.value) / 100;
      this.m = { ...this.m, ...patch };
      paintRange(input);
      out.textContent = percent(Number(input.value));
      this.hd.onSettings(patch);
    });
    input.addEventListener('change', () => this.ctx.sound('tap'));
    this.ranges.set(key, { input, out });
    return h('div', 'gs9-set-row', lab, input, out);
  }

  /** A switch with its words: the name, and (when it needs one) what it changes. */
  private switchRow(fk: string, label: string, line: string | null, flip: () => void): HTMLButtonElement {
    const b = h('button', 'gs9-switch-row', h('span', 'gs9-set-st', h('span', 'gs9-set-l', label), line ? h('span', 'gs9-set-sub', line) : null), h('span', 'gs9-switch-v'), h('span', 'gs9-switch'));
    b.querySelector('.gs9-switch-v')?.setAttribute('aria-hidden', 'true');
    b.type = 'button';
    b.dataset.fk = fk;
    b.setAttribute('role', 'switch');
    b.addEventListener('click', () => {
      this.ctx.sound('tap');
      flip();
    });
    return b;
  }

  set(m: SettingsModel): void {
    this.m = { ...m };
    for (const [key, r] of this.ranges) {
      const v = String(Math.round(Math.max(0, Math.min(1, m[key])) * 100));
      if (r.input.value !== v) r.input.value = v;
      r.out.textContent = percent(Number(v));
      paintRange(r.input);
    }
    this.paintQuality();
    this.paintSwitches();
  }

  private paintQuality(): void {
    for (const [q, b] of this.segs) b.setAttribute('aria-pressed', String(q === this.m.quality));
    // Ultra is offered where a dedicated graphics card might be (never on a touch device), and stays
    // in the row for a save that already chose it.
    const ultra = this.segs.get('ultra');
    if (ultra) ultra.hidden = this.m.ultra === false && this.m.quality !== 'ultra';
    this.cap.textContent = this.m.quality === 'auto' ? `Auto is running at ${TIER[this.m.currentTier]}.` : this.m.quality === 'ultra' ? 'Ultra is built for a dedicated graphics card.' : `Fixed at ${TIER[this.m.quality]}.`;
  }

  private paintSwitches(): void {
    this.hintsBtn.setAttribute('aria-checked', String(this.m.hints));
    this.rumbleBtn.setAttribute('aria-checked', String(this.m.rumble));
    // (Its state in words beside the pill: a pill alone read as a form's control with no state.)
    for (const [b, on] of [[this.hintsBtn, this.m.hints], [this.rumbleBtn, this.m.rumble]] as const) {
      const v = b.querySelector('.gs9-switch-v');
      if (v) v.textContent = on ? 'On' : 'Off';
    }
  }
}

function paintRange(input: HTMLInputElement): void {
  input.style.setProperty('--p', `${input.value}%`);
}
