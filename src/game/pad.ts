// The gamepad, read into the same few facts the keys and the touch zones give: a steer in -1..1, the
// action button, the spirit button, and what a menu needs (a direction, A, B, Start). Pure: a pad is any
// object shaped like the Gamepad API's, so the tests drive this with plain objects.
//
// The standard mapping (W3C): axes 0 and 2 are the sticks' X, button 0 is the bottom face button (A here),
// 1 the right (B), 2 the left (X), 4 and 5 the bumpers, 6 and 7 the triggers, 9 Start, 12 to 15 the d-pad
// (up, down, left, right). A pad the browser could not map keeps the same button numbers where it has
// them and steers on axis 0 alone: its axis 2 is often a trigger that rests at -1.

/** What this file reads of a Gamepad. */
export interface PadLike {
  readonly connected?: boolean;
  readonly mapping?: string;
  readonly axes: ReadonlyArray<number>;
  readonly buttons: ReadonlyArray<{ readonly pressed: boolean; readonly value: number } | null | undefined>;
}

/** Stick travel under this is rest: a worn stick that sits a little off centre does not creep. */
export const STICK_INNER = 0.14;
/** Full lock is reached here, short of the end of the travel: not every pad's stick reaches 1.0. */
export const STICK_OUTER = 0.94;
/** A trigger is held past TRIGGER_ON and let go under TRIGGER_OFF, so a finger resting at the edge does
 *  not chatter between the two. */
export const TRIGGER_ON = 0.35;
export const TRIGGER_OFF = 0.25;
/** A stick is a menu direction past this much travel. */
const NAV_ON = 0.55;

/**
 * A stick's X as a steer in -1..1: nothing inside the inner dead zone, the rest of the travel rescaled so
 * full lock lands at the outer dead zone, then the touch stick's curve (m * (0.45 + 0.55 m)), which is fine
 * near the centre for small corrections and never turns back on itself.
 */
export function stickCurve(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const a = Math.abs(x);
  if (a <= STICK_INNER) return 0;
  const m = Math.min(1, (a - STICK_INNER) / (STICK_OUTER - STICK_INNER));
  return Math.sign(x) * m * (0.45 + 0.55 * m);
}

/** The triggers' held state, kept between reads of one pad (their hysteresis). */
export interface TriggerHold {
  rt: boolean;
  lt: boolean;
}

export const newTriggerHold = (): TriggerHold => ({ rt: false, lt: false });

/** One read of a pad (or of every pad, merged). */
export interface PadRead {
  /** The sticks' steer in -1..1, already curved: whichever stick is further over. */
  steer: number;
  /** The d-pad. Left and right steer on the keys' ramp; all four move a menu's focus. */
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  /** A menu direction from the d-pad or the left stick: -1, 0 or 1 on each axis. */
  navX: number;
  navY: number;
  /** The game's one button: A or the right trigger. */
  action: boolean;
  /** The spirit button: X, B, a bumper or the left trigger. */
  spirit: boolean;
  start: boolean;
  a: boolean;
  b: boolean;
  /** The right trigger alone (the action that is not A). */
  rt: boolean;
}

export function idlePad(): PadRead {
  return { steer: 0, left: false, right: false, up: false, down: false, navX: 0, navY: 0, action: false, spirit: false, start: false, a: false, b: false, rt: false };
}

const axis = (p: PadLike, i: number): number => {
  const v = p.axes ? p.axes[i] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
};

const down = (p: PadLike, i: number): boolean => {
  const b = p.buttons ? p.buttons[i] : undefined;
  return !!b && (b.pressed === true || b.value > 0.5);
};

/** A trigger's travel in 0..1. One that only reports pressed (a digital trigger) reads as all the way. */
const travel = (p: PadLike, i: number): number => {
  const b = p.buttons ? p.buttons[i] : undefined;
  if (!b) return 0;
  const v = typeof b.value === 'number' && Number.isFinite(b.value) ? b.value : 0;
  return b.pressed && v <= 0 ? 1 : v;
};

const hysteresis = (was: boolean, v: number): boolean => (was ? v >= TRIGGER_OFF : v > TRIGGER_ON);

/** Reads one pad. `hold` is that pad's trigger state from its last read, and is updated. */
export function readPad(p: PadLike, hold: TriggerHold): PadRead {
  const standard = p.mapping === 'standard';
  const lx = stickCurve(axis(p, 0));
  const rx = standard ? stickCurve(axis(p, 2)) : 0;
  hold.rt = hysteresis(hold.rt, travel(p, 7));
  hold.lt = hysteresis(hold.lt, travel(p, 6));
  const left = down(p, 14);
  const right = down(p, 15);
  const up = down(p, 12);
  const dn = down(p, 13);
  const a = down(p, 0);
  const b = down(p, 1);
  const sx = axis(p, 0);
  const sy = axis(p, 1);
  return {
    steer: Math.abs(rx) > Math.abs(lx) ? rx : lx,
    left,
    right,
    up,
    down: dn,
    navX: (right ? 1 : 0) - (left ? 1 : 0) || (Math.abs(sx) > NAV_ON && Math.abs(sx) >= Math.abs(sy) ? Math.sign(sx) : 0),
    navY: (dn ? 1 : 0) - (up ? 1 : 0) || (Math.abs(sy) > NAV_ON && Math.abs(sy) > Math.abs(sx) ? Math.sign(sy) : 0),
    action: a || hold.rt,
    spirit: down(p, 2) || b || down(p, 4) || down(p, 5) || hold.lt,
    start: down(p, 9),
    a,
    b,
    rt: hold.rt,
  };
}

/** True when a read holds anything at all: a button down or a stick past its dead zone. */
export function padBusy(r: PadRead): boolean {
  return r.steer !== 0 || r.navX !== 0 || r.navY !== 0 || r.action || r.spirit || r.start || r.b;
}

/** Folds a second pad's read into the first: any pad's button counts, the stick further over steers. */
export function mergePad(into: PadRead, r: PadRead): void {
  if (Math.abs(r.steer) > Math.abs(into.steer)) into.steer = r.steer;
  into.left ||= r.left;
  into.right ||= r.right;
  into.up ||= r.up;
  into.down ||= r.down;
  if (into.navX === 0) into.navX = r.navX;
  if (into.navY === 0) into.navY = r.navY;
  into.action ||= r.action;
  into.spirit ||= r.spirit;
  into.start ||= r.start;
  into.a ||= r.a;
  into.b ||= r.b;
  into.rt ||= r.rt;
}

/** What a menu is told of the pad once a frame: the direction held, and the presses fresh since the last. */
export interface PadMenu {
  x: number;
  y: number;
  a: boolean;
  b: boolean;
  start: boolean;
}
