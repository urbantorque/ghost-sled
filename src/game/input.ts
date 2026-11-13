import { STEER_CENTER } from '../sim/input';
import { type PadLike, type PadMenu, type PadRead, type TriggerHold, idlePad, mergePad, newTriggerHold, padBusy, readPad } from './pad';

// Keyboard, mouse, touch and a gamepad, merged into one steer level (0..8) and one action button.
//
// Keyboard: A/D or arrows steer; Space, Shift, S, W, Up or Down is the action; E, Q or Enter is the spirit
//           button (a dash, when a lantern is lit). Physical key codes are used, so AZERTY and other layouts
//           get the same positions.
// Mouse:    horizontal position relative to the screen centre steers, the left (or middle) button is the
//           action, the right button the spirit button.
// Touch:    drag anywhere on the left 60% (a relative stick that re-centres), hold the right 40%; the HUD's
//           lantern button is the spirit button (spiritTap).
// Gamepad:  either stick's X or the d-pad steers (the d-pad on the keys' ramp); A or the right trigger is the
//           action; X, B, a bumper or the left trigger is the spirit button; Start pauses. Read by polling
//           (pad.ts), at every sample and once a frame for the menus.

export type InputMode = 'keyboard' | 'mouse' | 'touch' | 'gamepad';

/** Where the pads are read from: navigator.getGamepads in a browser, a script in the tests. */
export type PadSource = () => ReadonlyArray<PadLike | null>;

/** With no pad seen, the pads are looked for this often (in polls, about half a second of frames). */
const PAD_SEEK = 30;

const browserPads: PadSource = () => {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
  return navigator.getGamepads() ?? [];
};

const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const ACTION = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyS', 'ArrowDown', 'KeyW', 'ArrowUp']);
/** The action keys that also start a run from the title or the results (the app handles Enter): the
 *  others stay action keys in a run only. Shift fires on keydown, so Shift+Tab, moving focus back,
 *  started a run from either screen. */
const MENU_START = new Set(['Space']);
/** The spirit button: spends a lit lantern on a dash. Only its press matters to the sim. */
const SPIRIT = new Set(['KeyE', 'KeyQ', 'Enter', 'NumpadEnter']);

/** A steer key starts at this much lock and builds to full lock at KEY_RAMP per tick (about 0.2 s),
 *  so a tap is a correction and a hold is a turn. Reversing starts over from KEY_START. */
const KEY_START = 0.35;
const KEY_RAMP = 0.055;

/** Touch and mouse steering: fine near the centre, full lock at the end of the travel. */
const steerCurve = (d: number): number => d * (0.45 + 0.55 * Math.abs(d));

/** Whether a fresh press may start a run from the title or the results: any click or tap, only Space
 *  among the keys (never Shift, S, W or the arrows), and A or Start on a pad (never the trigger, which
 *  rests under a finger). A pad's press carries 'A', 'RT' or 'Start' as its code. */
export function startsFromMenu(source: InputMode, code?: string): boolean {
  if (source === 'gamepad') return code === 'A' || code === 'Start';
  return source !== 'keyboard' || (code !== undefined && MENU_START.has(code));
}

export interface TouchVisual {
  steer: { x: number; y: number; ox: number } | null;
  action: { x: number; y: number } | null;
}

export class InputController {
  mode: InputMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
  enabled = true;
  private keysL = false;
  private keysR = false;
  /** The keys' steer, built up per sample (KEY_RAMP). */
  private keySteer = 0;
  private keyAction = 0;
  private mouseX = 0.5;
  private mouseActive = false;
  private mouseDown = false;
  private mouseSpirit = false;
  private keySpirit = 0;
  /** A tap of the touch button, held for a few samples so a tick always sees it. */
  private spiritTaps = 0;
  private spiritCbs: Array<() => void> = [];
  private steerTouch: { id: number; ox: number; x: number; y: number } | null = null;
  private actionTouches = new Map<number, { x: number; y: number }>();
  private level = STEER_CENTER;
  private listeners: Array<() => void> = [];
  private pressCbs: Array<(source: InputMode, code?: string) => void> = [];
  readonly visual: TouchVisual = { steer: null, action: null };
  /** The pads as last read, merged, and each pad's trigger state between reads. */
  private pad: PadRead = idlePad();
  private padHolds: TriggerHold[] = [];
  /** The pad last used (its slot in the source's list), for the rumble. */
  private padIndex = -1;
  /** A pad has been seen: read every poll. Without one the source is asked only now and then. */
  private padLive = false;
  private padSeek = 0;
  /** A fresh action or spirit press, held until one sample has seen it: a tap between two ticks counts. */
  private padActionTap = false;
  private padSpiritTap = false;
  /** Presses fresh since the last poll, for the menus and the press callbacks. */
  private padFresh = { a: false, rt: false, b: false, start: false };
  private padMenuCb: ((p: PadMenu) => boolean) | null = null;
  private modeCbs: Array<(mode: InputMode) => void> = [];
  private modeTold: InputMode = this.mode;

  constructor(
    el: HTMLElement,
    private readonly padSource: PadSource = browserPads,
  ) {
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.listeners.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, 'keydown', (e) => {
      if (e.repeat) {
        if (ACTION.has(e.code) || LEFT.has(e.code) || RIGHT.has(e.code) || SPIRIT.has(e.code)) e.preventDefault();
        return;
      }
      if (SPIRIT.has(e.code)) {
        // (Enter in a menu is the app's; here it only counts while a run samples it.)
        this.keySpirit++;
        this.spirit();
        return;
      }
      if (LEFT.has(e.code)) this.keysL = true;
      else if (RIGHT.has(e.code)) this.keysR = true;
      else if (ACTION.has(e.code)) {
        this.keyAction++;
        this.press('keyboard', e.code);
      } else return;
      this.mode = 'keyboard';
      this.mouseActive = false;
      e.preventDefault();
    });
    on(window, 'keyup', (e) => {
      if (LEFT.has(e.code)) this.keysL = false;
      else if (RIGHT.has(e.code)) this.keysR = false;
      else if (ACTION.has(e.code)) this.keyAction = Math.max(0, this.keyAction - 1);
      else if (SPIRIT.has(e.code)) this.keySpirit = Math.max(0, this.keySpirit - 1);
    });
    on(window, 'blur', () => this.releaseAll());
    on(el, 'pointerdown', (e) => this.pointerDown(e as PointerEvent));
    on(window, 'pointermove', (e) => this.pointerMove(e as PointerEvent));
    on(window, 'pointerup', (e) => this.pointerUp(e as PointerEvent));
    on(window, 'pointercancel', (e) => this.pointerUp(e as PointerEvent));
    on(el, 'contextmenu', (e) => e.preventDefault());
    // Hot-plug. A pad plugged in is read from the next poll; one pulled out lets go of everything it held.
    on(window, 'gamepadconnected' as keyof WindowEventMap, () => {
      this.padLive = true;
    });
    on(window, 'gamepaddisconnected' as keyof WindowEventMap, () => {
      this.padActionTap = this.padSpiritTap = false;
      this.readPads();
    });
  }

  /** The menus' turn at the pad, once a frame (poll): true when a menu took the A or Start press. */
  onPadMenu(cb: (p: PadMenu) => boolean): void {
    this.padMenuCb = cb;
  }

  /** Called from poll when the last input used changes kind (the glyphs on screen follow it). */
  onMode(cb: (mode: InputMode) => void): void {
    this.modeCbs.push(cb);
  }

  /** The pad last used, as the source lists it now, or null: where a rumble goes. */
  activePad(): PadLike | null {
    if (this.padIndex < 0) return null;
    let list: ReadonlyArray<PadLike | null>;
    try {
      list = this.padSource();
    } catch {
      return null;
    }
    const p = list[this.padIndex];
    return p && p.connected !== false ? p : null;
  }

  /**
   * Reads every pad afresh (a browser hands out snapshots, so the list is asked for each time) and notes
   * what is newly pressed. A pad that is gone reads as nothing held.
   */
  private readPads(): void {
    let list: ReadonlyArray<PadLike | null>;
    try {
      list = this.padSource();
    } catch {
      list = [];
    }
    const was = this.pad;
    const now = idlePad();
    let seen = false;
    let used = -1;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p || p.connected === false) {
        if (this.padHolds[i]) this.padHolds[i] = newTriggerHold();
        continue;
      }
      seen = true;
      const r = readPad(p, (this.padHolds[i] ??= newTriggerHold()));
      if (used < 0 && padBusy(r)) used = i;
      mergePad(now, r);
    }
    this.padLive = seen;
    this.pad = now;
    if (!this.enabled) return;
    const a = now.a && !was.a;
    const rt = now.rt && !was.rt;
    const b = now.b && !was.b;
    const start = now.start && !was.start;
    const spirit = now.spirit && !was.spirit;
    const moved = (now.steer !== 0 && was.steer === 0) || (now.navX !== 0 && was.navX === 0) || (now.navY !== 0 && was.navY === 0);
    if (a || rt) this.padActionTap = true;
    if (spirit) {
      this.padSpiritTap = true;
      this.spirit();
    }
    this.padFresh.a ||= a;
    this.padFresh.rt ||= rt;
    this.padFresh.b ||= b;
    this.padFresh.start ||= start;
    if (a || rt || b || start || spirit || moved) {
      this.mode = 'gamepad';
      this.mouseActive = false;
      if (used >= 0) this.padIndex = used;
    }
  }

  /**
   * Once a frame, whatever is on screen: reads the pads, gives the menus their turn (a direction, A, B,
   * Start), fires the press callbacks for an A, trigger or Start press no menu took, and says when the
   * last input used has changed kind.
   */
  poll(): void {
    if (this.padLive || this.padSeek-- <= 0) {
      this.padSeek = PAD_SEEK;
      this.readPads();
    }
    const f = this.padFresh;
    if (this.padLive || f.a || f.rt || f.b || f.start) {
      const taken = this.padMenuCb ? this.padMenuCb({ x: this.pad.navX, y: this.pad.navY, a: f.a, b: f.b, start: f.start }) : false;
      if (!taken) {
        if (f.a || f.rt) this.press('gamepad', f.a ? 'A' : 'RT');
        if (f.start) this.press('gamepad', 'Start');
      }
      f.a = f.rt = f.b = f.start = false;
    }
    if (this.mode !== this.modeTold) {
      this.modeTold = this.mode;
      for (const cb of this.modeCbs) cb(this.mode);
    }
  }

  /** Called on any fresh action press, with the key's code for a key (menus: startsFromMenu). */
  onPress(cb: (source: InputMode, code?: string) => void): void {
    this.pressCbs.push(cb);
  }

  private press(source: InputMode, code?: string): void {
    for (const cb of this.pressCbs) cb(source, code);
  }

  /** Called on any fresh spirit press (the HUD flashes its lantern). */
  onSpirit(cb: () => void): void {
    this.spiritCbs.push(cb);
  }

  private spirit(): void {
    for (const cb of this.spiritCbs) cb();
  }

  /** The touch lantern button (or any on-screen spirit control). */
  spiritTap(): void {
    if (!this.enabled) return;
    this.spiritTaps = 3;
    this.mode = 'touch';
    this.spirit();
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
      if (e.button === 2) {
        this.mouseSpirit = true;
        this.spirit();
      } else {
        this.mouseDown = true;
        this.press('mouse');
      }
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
    } else if (e.button === 2) {
      this.mouseSpirit = false;
    } else {
      this.mouseDown = false;
    }
    this.syncVisual();
  }

  private touchRange(): number {
    return Math.max(64, Math.min(window.innerWidth, window.innerHeight) * 0.24);
  }

  private syncVisual(): void {
    const st = this.steerTouch;
    this.visual.steer = st ? { x: st.x, y: st.y, ox: st.ox } : null;
    const first = this.actionTouches.values().next().value;
    this.visual.action = first ? { x: first.x, y: first.y } : null;
  }

  releaseAll(): void {
    this.keysL = this.keysR = false;
    this.keySteer = 0;
    this.keyAction = 0;
    this.keySpirit = 0;
    this.spiritTaps = 0;
    this.padActionTap = this.padSpiritTap = false;
    this.mouseSpirit = false;
    this.mouseDown = false;
    this.steerTouch = null;
    this.actionTouches.clear();
    this.syncVisual();
  }

  /** Continuous steer value in -1..1 before quantisation. */
  private rawSteer(): number {
    if (this.keysL || this.keysR || this.pad.left || this.pad.right) return this.keySteer;
    if (this.steerTouch) {
      const d = (this.steerTouch.x - this.steerTouch.ox) / this.touchRange();
      return steerCurve(Math.max(-1, Math.min(1, d)));
    }
    // A stick held over steers whatever was used last (pad.ts has curved it already).
    if (this.pad.steer !== 0) return this.pad.steer;
    if (this.mouseActive && this.mode === 'mouse') {
      const d = (this.mouseX - 0.5) / 0.36;
      const dead = 0.06;
      const m = Math.abs(d) < dead ? 0 : (Math.abs(d) - dead) / (1 - dead);
      return steerCurve(Math.max(-1, Math.min(1, Math.sign(d) * m)));
    }
    return 0;
  }

  /** Builds the keys' steer once per sample: from KEY_START toward full lock, from 0 on release. The
   *  d-pad is two more steer keys. */
  private rampKeys(): void {
    const target = (this.keysR || this.pad.right ? 1 : 0) - (this.keysL || this.pad.left ? 1 : 0);
    if (target === 0) this.keySteer = 0;
    else if (this.keySteer * target <= 0) this.keySteer = target * KEY_START;
    else this.keySteer = target * Math.min(1, Math.abs(this.keySteer) + KEY_RAMP);
  }

  /** True while the player is actively steering (onboarding). */
  get steering(): boolean {
    return Math.abs(this.rawSteer()) > 0.3;
  }

  /** Sample once per sim tick. Quantised with hysteresis so the input log stays compact. */
  sample(): { steer: number; action: boolean; spirit: boolean } {
    if (!this.enabled) return { steer: STEER_CENTER, action: false, spirit: false };
    if (this.padLive) this.readPads();
    this.rampKeys();
    const raw = this.rawSteer() * 4;
    const cur = this.level - STEER_CENTER;
    if (Math.abs(raw - cur) > 0.62) this.level = STEER_CENTER + Math.round(raw);
    const action = this.keyAction > 0 || this.mouseDown || this.actionTouches.size > 0 || this.pad.action || this.padActionTap;
    const spirit = this.keySpirit > 0 || this.mouseSpirit || this.spiritTaps > 0 || this.pad.spirit || this.padSpiritTap;
    if (this.spiritTaps > 0) this.spiritTaps--;
    this.padActionTap = this.padSpiritTap = false;
    return { steer: this.level, action, spirit };
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners = [];
  }
}
