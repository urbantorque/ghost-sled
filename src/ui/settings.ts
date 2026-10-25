import type { SettingsModel, UIHandlers } from './contract';
import { h, type Ctx } from './dom';
import { icon } from './icons';

// The settings controls, shared by the pause overlay and the settings sheet. Built once, then
// kept in sync with set(). Changes are reported live through onSettings.

type Vol = 'master' | 'music' | 'sfx';
type Quality = SettingsModel['quality'];

const QUALITIES: Array<{ q: Quality; label: string }> = [
  { q: 'auto', label: 'Auto' },
  { q: 'low', label: 'Low' },
  { q: 'medium', label: 'Medium' },
  { q: 'high', label: 'High' },
];

const TIER: Record<SettingsModel['currentTier'], string> = { low: 'Low', medium: 'Medium', high: 'High' };

let uid = 0;

export class SettingsPanel {
  readonly el: HTMLElement;
  private m: SettingsModel = { master: 1, music: 0.8, sfx: 1, quality: 'auto', currentTier: 'high', hints: true };
  private readonly ranges = new Map<Vol, { input: HTMLInputElement; out: HTMLElement }>();
  private readonly segs = new Map<Quality, HTMLButtonElement>();
  private readonly cap: HTMLElement;
  private readonly hintsBtn: HTMLButtonElement;

  constructor(
    private readonly ctx: Ctx,
    private readonly hd: UIHandlers,
  ) {
    const id = `gs-set-${++uid}`;
    this.el = h('div', 'gs-set');

    const sound = h('div', 'gs-set-group');
    sound.setAttribute('role', 'group');
    sound.setAttribute('aria-labelledby', `${id}-snd`);
    const sh = h('h3', 'gs-h2 gs-set-h', icon('speaker'), 'Sound');
    sh.id = `${id}-snd`;
    sound.append(sh, this.slider(id, 'master', 'Master'), this.slider(id, 'music', 'Music'), this.slider(id, 'sfx', 'Effects'));

    const qual = h('div', 'gs-set-group');
    const qh = h('h3', 'gs-h2 gs-set-h', icon('gear'), 'Quality');
    qh.id = `${id}-q`;
    const seg = h('div', 'gs-seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-labelledby', `${id}-q`);
    for (const { q, label } of QUALITIES) {
      const b = h('button', 'gs-seg-btn', label);
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
    this.cap = h('p', 'gs-set-cap');
    qual.append(qh, seg, this.cap);

    this.hintsBtn = h('button', 'gs-switch-row', h('span', 'gs-set-label', 'Control Hints'), h('span', 'gs-switch'));
    this.hintsBtn.type = 'button';
    this.hintsBtn.dataset.fk = 'hints';
    this.hintsBtn.setAttribute('role', 'switch');
    this.hintsBtn.addEventListener('click', () => {
      this.ctx.sound('tap');
      this.m = { ...this.m, hints: !this.m.hints };
      this.paintHints();
      this.hd.onSettings({ hints: this.m.hints });
    });

    this.el.append(sound, qual, this.hintsBtn);
    this.set(this.m);
  }

  private slider(id: string, key: Vol, label: string): HTMLElement {
    const inputId = `${id}-${key}`;
    const lab = h('label', 'gs-set-label', label);
    lab.htmlFor = inputId;
    const input = h('input', 'gs-range');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    input.id = inputId;
    input.dataset.fk = `v-${key}`;
    const out = h('span', 'gs-set-val gs-num');
    out.setAttribute('aria-hidden', 'true');
    input.addEventListener('input', () => {
      const patch: Partial<SettingsModel> = {};
      patch[key] = Number(input.value) / 100;
      this.m = { ...this.m, ...patch };
      paintRange(input);
      out.textContent = input.value;
      this.hd.onSettings(patch);
    });
    input.addEventListener('change', () => this.ctx.sound('tap'));
    this.ranges.set(key, { input, out });
    return h('div', 'gs-set-row', lab, input, out);
  }

  set(m: SettingsModel): void {
    this.m = { ...m };
    for (const [key, r] of this.ranges) {
      const v = String(Math.round(Math.max(0, Math.min(1, m[key])) * 100));
      if (r.input.value !== v) r.input.value = v;
      r.out.textContent = v;
      paintRange(r.input);
    }
    this.paintQuality();
    this.paintHints();
  }

  private paintQuality(): void {
    for (const [q, b] of this.segs) b.setAttribute('aria-pressed', String(q === this.m.quality));
    this.cap.textContent = this.m.quality === 'auto' ? `Auto is running at ${TIER[this.m.currentTier]}` : 'Fixed quality';
  }

  private paintHints(): void {
    this.hintsBtn.setAttribute('aria-checked', String(this.m.hints));
  }
}

function paintRange(input: HTMLInputElement): void {
  input.style.setProperty('--p', `${input.value}%`);
}
