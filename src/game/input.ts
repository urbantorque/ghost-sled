import { STEER_CENTER } from '../sim/input';

// Keyboard, mouse and touch, merged into one steer level (0..8) and one action button.
//
// Keyboard: A/D or arrows steer; Space, Shift, S, W, Up or Down is the action. Physical key codes
//           are used, so AZERTY and other layouts get the same positions.
// Mouse:    horizontal position relative to the screen centre steers, any button is the action.
// Touch:    drag anywhere on the left 60% (a relative stick that re-centres), hold the right 40%.

export type InputMode = 'keyboard' | 'mouse' | 'touch';

const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const ACTION = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyS', 'ArrowDown', 'KeyW', 'ArrowUp']);

export interface TouchVisual {
  steer: { x: number; y: number; ox: number } | null;
  action: { x: number; y: number } | null;
}

export class InputController {
  mode: InputMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
  enabled = true;
  private keysL = false;
  private keysR = false;
  private keyAction = 0;
  private mouseX = 0.5;
  private mouseActive = false;
  private mouseDown = false;
  private steerTouch: { id: number; ox: number; x: number; y: number } | null = null;
  private actionTouches = new Map<number, { x: number; y: number }>();
  private level = STEER_CENTER;
  private listeners: Array<() => void> = [];
  private pressCbs: Array<(source: InputMode) => void> = [];
  readonly visual: TouchVisual = { steer: null, action: null };

  constructor(el: HTMLElement) {
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.listeners.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', (e) => {
      if (e.repeat) {
        if (ACTION.has(e.code) || LEFT.has(e.code) || RIGHT.has(e.code)) e.preventDefault();
        return;
      }
      if (LEFT.has(e.code)) this.keysL = true;
      else if (RIGHT.has(e.code)) this.keysR = true;
      else if (ACTION.has(e.code)) {
        this.keyAction++;
        this.press('keyboard');
      } else return;
      this.mode = 'keyboard';
      this.mouseActive = false;
      e.preventDefault();
    });
    on(window, 'keyup', (e) => {
      if (LEFT.has(e.code)) this.keysL = false;
      else if (RIGHT.has(e.code)) this.keysR = false;
      else if (ACTION.has(e.code)) this.keyAction = Math.max(0, this.keyAction - 1);
    });
    on(window, 'blur', () => this.releaseAll());
    on(el, 'pointerdown', (e) => this.pointerDown(e as PointerEvent));
    on(window, 'pointermove', (e) => this.pointerMove(e as PointerEvent));
    on(window, 'pointerup', (e) => this.pointerUp(e as PointerEvent));
    on(window, 'pointercancel', (e) => this.pointerUp(e as PointerEvent));
    on(el, 'contextmenu', (e) => e.preventDefault());
  }

  /** Called on any fresh action press (for menus: "press anything to ride"). */
  onPress(cb: (source: InputMode) => void): void {
    this.pressCbs.push(cb);
  }

  private press(source: InputMode): void {
    for (const cb of this.pressCbs) cb(source);
  }

  private pointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      this.mode = 'touch';
      const w = window.innerWidth;
      if (e.clientX < w * 0.6 && !this.steerTouch) {
        this.steerTouch = { id: e.pointerId, ox: e.clientX, x: e.clientX, y: e.clientY };
      } else {
        this.actionTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.press('touch');
      }
    } else {
      this.mode = 'mouse';
      this.mouseActive = true;
      this.mouseX = e.clientX / window.innerWidth;
      this.mouseDown = true;
      this.press('mouse');
    }
    this.syncVisual();
  }

  private pointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      const st = this.steerTouch;
      if (st && st.id === e.pointerId) {
        st.x = e.clientX;
        st.y = e.clientY;
        const range = this.touchRange();
        // Re-centre so reversing direction is instant even after over-dragging.
        if (st.x - st.ox > range) st.ox = st.x - range;
        if (st.ox - st.x > range) st.ox = st.x + range;
      }
      const at = this.actionTouches.get(e.pointerId);
      if (at) {
        at.x = e.clientX;
        at.y = e.clientY;
      }
      this.syncVisual();
    } else {
      this.mouseX = e.clientX / window.innerWidth;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) {
        this.mouseActive = true;
        if (this.mode !== 'touch') this.mode = 'mouse';
      }
    }
  }

  private pointerUp(e: PointerEvent): void {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      if (this.steerTouch && this.steerTouch.id === e.pointerId) this.steerTouch = null;
      this.actionTouches.delete(e.pointerId);
    } else {
      this.mouseDown = false;
    }
    this.syncVisual();
  }

  private touchRange(): number {
    return Math.max(48, Math.min(window.innerWidth, window.innerHeight) * 0.16);
  }

  private syncVisual(): void {
    const st = this.steerTouch;
    this.visual.steer = st ? { x: st.x, y: st.y, ox: st.ox } : null;
    const first = this.actionTouches.values().next().value;
    this.visual.action = first ? { x: first.x, y: first.y } : null;
  }

  releaseAll(): void {
    this.keysL = this.keysR = false;
    this.keyAction = 0;
    this.mouseDown = false;
    this.steerTouch = null;
    this.actionTouches.clear();
    this.syncVisual();
  }

  /** Continuous steer value in -1..1 before quantisation. */
  private rawSteer(): number {
    if (this.keysL || this.keysR) return (this.keysR ? 1 : 0) - (this.keysL ? 1 : 0);
    if (this.steerTouch) {
      const d = (this.steerTouch.x - this.steerTouch.ox) / this.touchRange();
      return Math.max(-1, Math.min(1, d));
    }
    if (this.mouseActive && this.mode === 'mouse') {
      const d = (this.mouseX - 0.5) / 0.3;
      const dead = 0.06;
      const m = Math.abs(d) < dead ? 0 : (Math.abs(d) - dead) / (1 - dead);
      return Math.max(-1, Math.min(1, Math.sign(d) * m));
    }
    return 0;
  }

  /** True while the player is actively steering (onboarding). */
  get steering(): boolean {
    return Math.abs(this.rawSteer()) > 0.3;
  }

  /** Sample once per sim tick. Quantised with hysteresis so the input log stays compact. */
  sample(): { steer: number; action: boolean } {
    if (!this.enabled) return { steer: STEER_CENTER, action: false };
    const raw = this.rawSteer() * 4;
    const cur = this.level - STEER_CENTER;
    if (Math.abs(raw - cur) > 0.62) this.level = STEER_CENTER + Math.round(raw);
    const action = this.keyAction > 0 || this.mouseDown || this.actionTouches.size > 0;
    return { steer: this.level, action };
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}
