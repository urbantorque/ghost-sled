import type { InputMode } from '../game/input';
import { btn, h, kbd, padBtn, type UiSound } from './dom';
import './photo.css';

// Round 8, photo mode (the photo lane; V8 and G11's frame). From pause, or from the results while the scene still
// stands, the run is held and the lens is the player's: the HUD and every card leave, and what is left is the picture
// and a small bar at its foot. The bar holds the lens (its width as a focal length, and a tilt), the framing grid, the
// focus on the rider where the tier draws depth of field, the way back to the frame it opened on, and Save. Nothing on
// it is in the saved PNG: the game draws that from the canvas.
//
//   mouse    drag turns round the rider, a right or middle drag (or Shift with a drag) moves across, the wheel moves in
//   keys     arrows or WASD turn, with Shift they move across, + and - move in, [ and ] the lens, , and . the tilt,
//            G the grid, Enter saves, Escape (or P) goes back
//   pad      the left stick turns, the right stick moves, the triggers move in and out, the bumpers set the lens, the
//            d-pad tilts, A saves, Y the grid, X hides the bar, B goes back
//   touch    one finger turns, two move across and pinch in and out
//
// While the view is being moved the bar and the help fade back, so the picture is what is seen. Reduced motion drops
// the fades and the save's flash and keeps every beat.

/** What photo mode drives of the lens (render/camera.ts PhotoRig). */
export interface PhotoLens {
  orbit(across: number, up: number): void;
  dolly(k: number): void;
  move(right: number, up: number): void;
  setFov(deg: number): void;
  setRoll(rad: number): void;
  reset(): void;
  focus: boolean;
  fov: number;
  roll: number;
}

export interface PhotoHooks {
  /** Saves the frame (with the run's card when `card`): resolves to the file's name, or null when it could not. */
  save(card: boolean): Promise<string | null>;
  /** Back where photo mode was opened from, exactly as it stood. */
  leave(): void;
  sound(kind: UiSound): void;
}

export interface PhotoOpts {
  mode: InputMode;
  reduced: boolean;
  /** The tier draws depth of field (High and Ultra): the focus toggle shows. */
  canFocus: boolean;
  /** A second save, with the run's card in a corner (the mountain, the time, the place and the rider). */
  card: boolean;
  /** The page shows the canvas mirrored (a mirror mountain): a drag across turns the other way. */
  mirrored: boolean;
}

/** Turning speed: radians per pixel dragged, per second at full stick or key. */
const DRAG_RAD = 0.0062;
const KEY_RAD = 1.5;
/** Moving across: shares of the lens's distance per pixel dragged, per second at full stick or key. */
const DRAG_MOVE = 0.0016;
const KEY_MOVE = 0.55;
/** Moving in: a factor per wheel notch (100 px), per second at a full trigger or key. */
const WHEEL_K = 1.12;
const KEY_DOLLY = 2.2;
/** The lens as a focal length (mm, full frame, from the vertical angle) and the tilt's reach (degrees). */
const MM_LO = 12;
const MM_HI = 85;
const TILT_DEG = 20;
/** The bar fades back while the view moves, and returns this long after the last move (ms). */
const CALM_MS = 900;
/** A stick's rest. */
const DEAD = 0.18;

const mmOf = (fovDeg: number) => 12 / Math.tan((fovDeg * Math.PI) / 360);
const fovOf = (mm: number) => (Math.atan(12 / mm) * 360) / Math.PI;

const KEYS_TURN: Readonly<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
};

export class PhotoMode {
  readonly el: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly help: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly status: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly lensIn: HTMLInputElement;
  private readonly lensOut: HTMLOutputElement;
  private readonly tiltIn: HTMLInputElement;
  private readonly tiltOut: HTMLOutputElement;
  private readonly gridBtn: HTMLButtonElement;
  private readonly focusBtn: HTMLButtonElement | null;
  private readonly held = new Set<string>();
  private readonly pointers = new Map<number, { x: number; y: number; button: number }>();
  private pinch = 0;
  private mid = { x: 0, y: 0 };
  private calmAt = 0;
  private moving = false;
  private barHidden = false;
  private saving = false;
  private statusTimer = 0;
  private pad = { a: false, b: false, x: false, y: false };
  /** The pad's buttons as they stood when photo mode opened are not presses (the A that opened it may still be down). */
  private padPrimed = false;
  private disposed = false;
  private readonly off: Array<() => void> = [];

  constructor(
    root: HTMLElement,
    private readonly lens: PhotoLens,
    private readonly hooks: PhotoHooks,
    private readonly opts: PhotoOpts,
  ) {
    // The layer is a UI root of its own (the tokens live on .gs-ui), over the canvas and the hidden UI.
    this.el = h('div', `gs-ui gs-photo${opts.mode === 'touch' ? ' gs-touch-mode' : ''}${opts.mode === 'gamepad' ? ' gs-pad-mode' : ''}${opts.reduced ? ' is-still' : ''}`);
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Photo mode');

    // The surface the view is moved on: the whole picture.
    const surface = h('div', 'gs-ph-surface');
    surface.setAttribute('aria-hidden', 'true');
    this.grid = h('div', 'gs-ph-grid', h('span', 'gs-ph-gl gs-ph-v1'), h('span', 'gs-ph-gl gs-ph-v2'), h('span', 'gs-ph-gl gs-ph-h1'), h('span', 'gs-ph-gl gs-ph-h2'));
    this.grid.hidden = true;
    this.grid.setAttribute('aria-hidden', 'true');
    this.flash = h('div', 'gs-ph-flash');
    this.flash.setAttribute('aria-hidden', 'true');

    // The help: what moves the view, in the language of the input in use.
    this.help = h('div', 'gs-ph-help', h('h2', 'gs-ph-title', 'Photo'), this.helpLines(opts.mode));

    // The lens: a focal length, right is longer.
    this.lensIn = h('input', 'gs-range gs-ph-range');
    Object.assign(this.lensIn, { type: 'range', min: String(MM_LO), max: String(MM_HI), step: '1', id: 'gs-ph-lens' });
    this.lensOut = h('output', 'gs-ph-val gs-num');
    this.lensOut.htmlFor.add('gs-ph-lens');
    this.lensIn.addEventListener('input', () => {
      this.lens.setFov(fovOf(Number(this.lensIn.value)));
      this.syncLens();
    });
    const lensLab = h('label', 'gs-ph-lab', 'Lens');
    lensLab.htmlFor = 'gs-ph-lens';
    const lensBox = h('div', 'gs-ph-ctl', h('span', 'gs-ph-ctl-h', lensLab, this.lensOut), this.lensIn);

    // The tilt: the horizon, either way.
    this.tiltIn = h('input', 'gs-range gs-ph-range');
    Object.assign(this.tiltIn, { type: 'range', min: String(-TILT_DEG), max: String(TILT_DEG), step: '1', id: 'gs-ph-tilt' });
    this.tiltOut = h('output', 'gs-ph-val gs-num');
    this.tiltOut.htmlFor.add('gs-ph-tilt');
    this.tiltIn.addEventListener('input', () => {
      this.lens.setRoll((-Number(this.tiltIn.value) * Math.PI) / 180);
      this.syncTilt();
    });
    const tiltLab = h('label', 'gs-ph-lab', 'Tilt');
    tiltLab.htmlFor = 'gs-ph-tilt';
    const tiltBox = h('div', 'gs-ph-ctl', h('span', 'gs-ph-ctl-h', tiltLab, this.tiltOut), this.tiltIn);

    const ctx = { sound: (k: UiSound) => hooks.sound(k), gameKeyJustPressed: () => false };
    this.gridBtn = btn(ctx, { cls: 'gs-btn-soft gs-btn-round gs-ph-tog', icon: 'grid', aria: 'Framing grid', fk: 'ph-grid', onClick: () => this.toggleGrid() });
    this.gridBtn.setAttribute('aria-pressed', 'false');
    this.focusBtn = opts.canFocus ? btn(ctx, { cls: 'gs-btn-soft gs-btn-round gs-ph-tog', icon: 'focus', aria: 'Focus on the rider', fk: 'ph-focus', onClick: () => this.toggleFocus() }) : null;
    this.focusBtn?.setAttribute('aria-pressed', 'false');
    const reset = btn(ctx, { cls: 'gs-btn-soft gs-btn-round', icon: 'reset', aria: 'Back to the first frame', fk: 'ph-reset', sound: 'back', onClick: () => this.reset() });
    const back = btn(ctx, { cls: 'gs-btn-soft gs-ph-back', icon: 'back', label: 'Done', sound: 'back', fk: 'ph-back', onClick: () => this.leave() });
    back.setAttribute('aria-keyshortcuts', 'Escape');
    const save = btn(ctx, { cls: 'gs-btn-primary gs-ph-save', icon: 'camera', label: 'Save Photo', sound: 'confirm', fk: 'ph-save', onClick: () => void this.save(false) });
    save.setAttribute('aria-keyshortcuts', 'Enter');
    const card = opts.card ? btn(ctx, { cls: 'gs-btn-soft gs-ph-card', icon: 'flag', label: 'With Run Card', sound: 'confirm', fk: 'ph-card', onClick: () => void this.save(true) }) : null;
    card?.setAttribute('aria-label', 'Save the photo with the run card: the mountain, the time, the place and your name');
    this.status = h('p', 'gs-ph-status');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');

    this.bar = h(
      'div',
      'gs-ph-bar gs-panel',
      back,
      h('div', 'gs-ph-lens', lensBox, tiltBox),
      h('div', 'gs-ph-togs', this.gridBtn, this.focusBtn, reset),
      h('div', 'gs-ph-saves', card, save),
    );
    this.el.append(surface, this.grid, this.flash, this.help, this.bar, this.status);
    root.append(this.el);
    this.syncLens();
    this.syncTilt();

    // The view is moved on the surface; nothing here reaches the game's own listeners.
    const on = <K extends keyof HTMLElementEventMap>(t: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, o);
      this.off.push(() => t.removeEventListener(type, fn, o));
    };
    on(surface, 'pointerdown', (e) => this.down(e));
    on(surface, 'pointermove', (e) => this.drag(e));
    on(surface, 'pointerup', (e) => this.up(e));
    on(surface, 'pointercancel', (e) => this.up(e));
    on(surface, 'wheel', (e) => this.wheel(e), { passive: false });
    on(surface, 'contextmenu', (e) => e.preventDefault());
    on(this.el, 'pointerdown', (e) => e.stopPropagation());
    const key = (e: KeyboardEvent) => this.key(e);
    const keyUp = (e: KeyboardEvent) => this.keyUp(e);
    window.addEventListener('keydown', key, { capture: true });
    window.addEventListener('keyup', keyUp, { capture: true });
    this.off.push(() => window.removeEventListener('keydown', key, { capture: true }));
    this.off.push(() => window.removeEventListener('keyup', keyUp, { capture: true }));
    const blur = () => this.held.clear();
    window.addEventListener('blur', blur);
    this.off.push(() => window.removeEventListener('blur', blur));
    requestAnimationFrame(() => {
      if (!this.disposed) save.focus({ preventScroll: true });
    });
  }

  get open(): boolean {
    return !this.disposed;
  }

  private helpLines(mode: InputMode): HTMLElement {
    const row = (...kids: Array<Node | string>) => h('li', 'gs-ph-help-row', ...kids);
    const list = h('ul', 'gs-ph-help-list');
    if (mode === 'touch') list.append(row(h('b', '', 'One finger'), ' turns'), row(h('b', '', 'Two'), ' move and pinch'));
    else if (mode === 'gamepad') list.append(row(h('b', '', 'Left stick'), ' turns'), row(h('b', '', 'Right stick'), ' moves'), row(h('b', '', 'Triggers'), ' zoom'), row(padBtn('A'), ' saves'), row(padBtn('B'), ' done'));
    else list.append(row(h('b', '', 'Drag'), ' turns'), row(h('b', '', 'Right-drag'), ' moves'), row(h('b', '', 'Wheel'), ' zooms'), row(kbd('Enter'), ' saves'), row(kbd('Esc'), ' done'));
    return list;
  }

  private syncLens(): void {
    const mm = Math.round(Math.max(MM_LO, Math.min(MM_HI, mmOf(this.lens.fov))));
    if (this.lensIn.value !== String(mm)) this.lensIn.value = String(mm);
    this.lensOut.value = `${mm} mm`;
    this.lensIn.setAttribute('aria-valuetext', `${mm} millimetres`);
    this.lensIn.style.setProperty('--p', `${(((mm - MM_LO) / (MM_HI - MM_LO)) * 100).toFixed(1)}%`);
  }

  private syncTilt(): void {
    const deg = Math.round((-this.lens.roll * 180) / Math.PI);
    if (this.tiltIn.value !== String(deg)) this.tiltIn.value = String(deg);
    this.tiltOut.value = deg === 0 ? 'Level' : `${Math.abs(deg)}° ${deg < 0 ? 'left' : 'right'}`;
    this.tiltIn.setAttribute('aria-valuetext', this.tiltOut.value);
    this.tiltIn.style.setProperty('--p', `${(((deg + TILT_DEG) / (2 * TILT_DEG)) * 100).toFixed(1)}%`);
  }

  private toggleGrid(): void {
    this.grid.hidden = !this.grid.hidden;
    this.gridBtn.setAttribute('aria-pressed', String(!this.grid.hidden));
  }

  private toggleFocus(): void {
    if (!this.focusBtn) return;
    this.lens.focus = !this.lens.focus;
    this.focusBtn.setAttribute('aria-pressed', String(this.lens.focus));
  }

  private reset(): void {
    this.lens.reset();
    this.syncLens();
    this.syncTilt();
  }

  private toggleBar(): void {
    this.barHidden = !this.barHidden;
    this.el.classList.toggle('is-bare', this.barHidden);
  }

  /** The view moved: the bar and the help step back until it rests. */
  private stir(): void {
    this.calmAt = performance.now() + CALM_MS;
    if (!this.moving) {
      this.moving = true;
      this.el.classList.add('is-moving');
    }
  }

  private async save(card: boolean): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    let name: string | null = null;
    try {
      name = await this.hooks.save(card);
    } catch {
      name = null;
    }
    this.saving = false;
    if (this.disposed) return;
    if (name && !this.opts.reduced) {
      this.flash.classList.remove('is-on');
      void this.flash.offsetWidth;
      this.flash.classList.add('is-on');
    }
    this.say(name ? `Saved ${name}` : 'The photo could not be saved');
  }

  private say(text: string): void {
    window.clearTimeout(this.statusTimer);
    this.status.textContent = text;
    this.status.classList.add('is-on');
    this.statusTimer = window.setTimeout(() => this.status.classList.remove('is-on'), 2600);
  }

  private leave(): void {
    if (this.disposed) return;
    this.hooks.leave();
  }

  // ------------------------------------------------------------------ pointer

  private down(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    if (this.pointers.size === 2) this.twoStart();
    e.preventDefault();
  }

  private twoStart(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    this.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private drag(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (dx === 0 && dy === 0) return;
    const flip = this.opts.mirrored ? -1 : 1;
    this.stir();
    if (this.pointers.size >= 2) {
      // Two fingers: the midpoint moves across, the spread moves in.
      const [a, b] = [...this.pointers.values()];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.pinch > 0 && spread > 0) this.lens.dolly(this.pinch / spread);
      this.lens.move(-(mid.x - this.mid.x) * DRAG_MOVE * flip, (mid.y - this.mid.y) * DRAG_MOVE);
      this.pinch = spread;
      this.mid = mid;
      return;
    }
    if (p.button === 2 || p.button === 1 || e.shiftKey) this.lens.move(-dx * DRAG_MOVE * flip, dy * DRAG_MOVE);
    else this.lens.orbit(-dx * DRAG_RAD * flip, dy * DRAG_RAD);
  }

  private up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 2) this.twoStart();
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const notches = (e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY) / 100;
    this.lens.dolly(Math.pow(WHEEL_K, Math.max(-4, Math.min(4, notches))));
    this.stir();
  }

  // ------------------------------------------------------------------ keys

  private key(e: KeyboardEvent): void {
    if (this.disposed) return;
    const t = e.target;
    const onRange = t instanceof HTMLInputElement && t.type === 'range';
    const onButton = t instanceof HTMLButtonElement;
    // Nothing reaches the game while photo mode is open: it must not steer, ride, pause or run again.
    e.stopPropagation();
    const code = e.code;
    if (code === 'Escape' || code === 'KeyP' || code === 'Backspace') {
      e.preventDefault();
      if (!e.repeat) this.leave();
      return;
    }
    if (code === 'Tab') return;
    // A focused slider keeps its arrows, and a focused button its Space and Enter.
    if (onRange && (code.startsWith('Arrow') || code === 'Home' || code === 'End' || code === 'PageUp' || code === 'PageDown')) return;
    if (onButton && (code === 'Space' || code === 'Enter' || code === 'NumpadEnter')) return;
    if ((code === 'Enter' || code === 'NumpadEnter') && !e.repeat) {
      e.preventDefault();
      void this.save(false);
      return;
    }
    if (code === 'KeyG' && !e.repeat) {
      this.toggleGrid();
      return;
    }
    if (code === 'KeyH' && !e.repeat) {
      this.toggleBar();
      return;
    }
    if (KEYS_TURN[code] || code === 'Equal' || code === 'Minus' || code === 'NumpadAdd' || code === 'NumpadSubtract' || code === 'BracketLeft' || code === 'BracketRight' || code === 'Comma' || code === 'Period' || code === 'ShiftLeft' || code === 'ShiftRight') {
      e.preventDefault();
      this.held.add(code);
    }
  }

  private keyUp(e: KeyboardEvent): void {
    if (this.disposed) return;
    e.stopPropagation();
    this.held.delete(e.code);
  }

  // ------------------------------------------------------------------ the frame

  /** Once a frame (real seconds): held keys and the pad. */
  update(dt: number): void {
    if (this.disposed) return;
    const flip = this.opts.mirrored ? -1 : 1;
    const shift = this.held.has('ShiftLeft') || this.held.has('ShiftRight');
    let ax = 0;
    let ay = 0;
    for (const c of this.held) {
      const k = KEYS_TURN[c];
      if (k) {
        ax += k[0];
        ay += k[1];
      }
    }
    let moved = false;
    if (ax !== 0 || ay !== 0) {
      if (shift) this.lens.move(ax * KEY_MOVE * dt * flip, ay * KEY_MOVE * dt);
      else this.lens.orbit(-ax * KEY_RAD * dt * flip, ay * KEY_RAD * dt);
      moved = true;
    }
    const zin = (this.held.has('Equal') || this.held.has('NumpadAdd') ? 1 : 0) - (this.held.has('Minus') || this.held.has('NumpadSubtract') ? 1 : 0);
    if (zin !== 0) {
      this.lens.dolly(Math.exp(-zin * Math.log(KEY_DOLLY) * dt));
      moved = true;
    }
    const lensK = (this.held.has('BracketRight') ? 1 : 0) - (this.held.has('BracketLeft') ? 1 : 0);
    if (lensK !== 0) {
      this.lens.setFov(fovOf(Math.max(MM_LO, Math.min(MM_HI, mmOf(this.lens.fov) * Math.exp(lensK * 1.1 * dt)))));
      this.syncLens();
    }
    const tiltK = (this.held.has('Period') ? 1 : 0) - (this.held.has('Comma') ? 1 : 0);
    if (tiltK !== 0) {
      this.lens.setRoll(this.lens.roll - tiltK * 0.5 * dt);
      this.syncTilt();
    }
    if (this.readPad(dt)) moved = true;
    if (moved) this.stir();
    if (this.moving && performance.now() > this.calmAt && this.pointers.size === 0) {
      this.moving = false;
      this.el.classList.remove('is-moving');
    }
  }

  /** The pad, read here while photo mode is open (the game's own reading is off). True when it moved the view. */
  private readPad(dt: number): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return false;
    let pads: ReadonlyArray<Gamepad | null>;
    try {
      pads = navigator.getGamepads() ?? [];
    } catch {
      return false;
    }
    const p = pads.find((g) => g && g.connected);
    if (!p) return false;
    const ax = (i: number) => {
      const v = p.axes[i] ?? 0;
      return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD);
    };
    const bt = (i: number) => p.buttons[i]?.value ?? 0;
    const pressed = (i: number) => p.buttons[i]?.pressed === true;
    const flip = this.opts.mirrored ? -1 : 1;
    let moved = false;
    const lx = ax(0);
    const ly = ax(1);
    if (lx !== 0 || ly !== 0) {
      this.lens.orbit(-lx * KEY_RAD * dt * flip, ly * KEY_RAD * dt);
      moved = true;
    }
    const rx = ax(2);
    const ry = ax(3);
    if (rx !== 0 || ry !== 0) {
      this.lens.move(rx * KEY_MOVE * dt * flip, -ry * KEY_MOVE * dt);
      moved = true;
    }
    const z = bt(7) - bt(6);
    if (Math.abs(z) > 0.05) {
      this.lens.dolly(Math.exp(-z * Math.log(KEY_DOLLY) * dt));
      moved = true;
    }
    const lensK = (pressed(5) ? 1 : 0) - (pressed(4) ? 1 : 0);
    if (lensK !== 0) {
      this.lens.setFov(fovOf(Math.max(MM_LO, Math.min(MM_HI, mmOf(this.lens.fov) * Math.exp(lensK * 1.1 * dt)))));
      this.syncLens();
    }
    const tiltK = (pressed(15) ? 1 : 0) - (pressed(14) ? 1 : 0);
    if (tiltK !== 0) {
      this.lens.setRoll(this.lens.roll - tiltK * 0.5 * dt);
      this.syncTilt();
    }
    const was = this.pad;
    const now = { a: pressed(0), b: pressed(1), x: pressed(2), y: pressed(3) };
    this.pad = now;
    if (!this.padPrimed) {
      this.padPrimed = true;
      return moved;
    }
    if (now.a && !was.a) void this.save(false);
    if (now.y && !was.y) this.toggleGrid();
    if (now.x && !was.x) this.toggleBar();
    if (now.b && !was.b) this.leave();
    return moved;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.clearTimeout(this.statusTimer);
    for (const f of this.off) f();
    this.off.length = 0;
    this.el.remove();
  }
}

/** A saved photo's file name: the game, the mountain and the moment, so a folder of them sorts by when. */
export function photoName(mountain: string, at: Date, card = false): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const slug = mountain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'run';
  return `ghost-sled-${slug}-${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}${card ? '-card' : ''}.png`;
}

