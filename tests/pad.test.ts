import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputController, startsFromMenu, type InputMode } from '../src/game/input';
import { STICK_INNER, STICK_OUTER, TRIGGER_OFF, TRIGGER_ON, newTriggerHold, readPad, stickCurve, type PadLike, type PadMenu } from '../src/game/pad';
import { Rumble, rumbleFor, rumbleLength, type RumbleEffect } from '../src/game/rumble';
import { defaultSave, merge } from '../src/game/save';
import { STEER_CENTER } from '../src/sim/input';
import type { SimEvent } from '../src/sim/sim';

// The gamepad: the stick's curve, the mapping, the controller's last-input mode and hot-plug, and the rumble.

/** A pad as a plain object, in the standard mapping unless told otherwise. */
interface FakePad {
  connected: boolean;
  mapping: string;
  axes: number[];
  buttons: Array<{ pressed: boolean; value: number }>;
}

function fakePad(mapping = 'standard'): FakePad {
  return { connected: true, mapping, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
}

const press = (p: FakePad, i: number, on = true): void => {
  p.buttons[i] = { pressed: on, value: on ? 1 : 0 };
};

/** A trigger at some travel: analogue, so `pressed` is whatever the browser's own threshold says. */
const squeeze = (p: FakePad, i: number, v: number): void => {
  p.buttons[i] = { pressed: v > 0.5, value: v };
};

const A = 0;
const B = 1;
const X = 2;
const LB = 4;
const RB = 5;
const LT = 6;
const RT = 7;
const START = 9;
const DPAD_UP = 12;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

describe('the stick curve', () => {
  it('is rest inside the inner dead zone', () => {
    for (const x of [0, 0.05, -0.1, STICK_INNER, -STICK_INNER]) expect(stickCurve(x)).toBe(0);
    expect(stickCurve(STICK_INNER + 0.02)).toBeGreaterThan(0);
    expect(stickCurve(-STICK_INNER - 0.02)).toBeLessThan(0);
    expect(stickCurve(Number.NaN)).toBe(0);
  });

  it('never turns back on itself, and is the same both ways', () => {
    let last = -1;
    for (let i = -100; i <= 100; i++) {
      const v = stickCurve(i / 100);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeCloseTo(-stickCurve(-i / 100), 12);
      last = v;
    }
  });

  it('reaches full lock at the outer dead zone, short of the end of the travel', () => {
    expect(stickCurve(STICK_OUTER)).toBeCloseTo(1, 12);
    expect(stickCurve(1)).toBe(1);
    expect(stickCurve(-1)).toBe(-1);
    expect(stickCurve(STICK_OUTER - 0.05)).toBeLessThan(1);
  });

  it('is fine near the centre: the first third of the live travel gives under a quarter lock', () => {
    const third = STICK_INNER + (STICK_OUTER - STICK_INNER) / 3;
    expect(stickCurve(third)).toBeLessThan(0.25);
    expect(stickCurve(third)).toBeGreaterThan(0.1);
  });
});

describe('the mapping', () => {
  it('steers on whichever stick is further over, and on axis 0 alone when the pad is not standard', () => {
    const p = fakePad();
    p.axes[0] = 0.5;
    p.axes[2] = -0.9;
    expect(readPad(p, newTriggerHold()).steer).toBe(stickCurve(-0.9));
    p.axes[2] = 0.2;
    expect(readPad(p, newTriggerHold()).steer).toBe(stickCurve(0.5));
    // An unmapped pad's axis 2 is often a trigger resting at -1: it must not steer.
    const odd = fakePad('');
    odd.axes[0] = 0.5;
    odd.axes[2] = -1;
    expect(readPad(odd, newTriggerHold()).steer).toBe(stickCurve(0.5));
  });

  it('A and the right trigger are the action', () => {
    const p = fakePad();
    expect(readPad(p, newTriggerHold()).action).toBe(false);
    press(p, A);
    const r = readPad(p, newTriggerHold());
    expect(r.action).toBe(true);
    expect(r.a).toBe(true);
    expect(r.spirit).toBe(false);
    press(p, A, false);
    squeeze(p, RT, 0.6);
    const t = readPad(p, newTriggerHold());
    expect(t.action).toBe(true);
    expect(t.a).toBe(false);
    expect(t.rt).toBe(true);
  });

  it('X, B, either bumper and the left trigger are the spirit button, and none of them the action', () => {
    for (const i of [X, B, LB, RB, LT]) {
      const p = fakePad();
      press(p, i);
      const r = readPad(p, newTriggerHold());
      expect(r.spirit, `button ${i}`).toBe(true);
      expect(r.action, `button ${i}`).toBe(false);
    }
  });

  it('Start is Start, and the d-pad steers and moves a menu', () => {
    const p = fakePad();
    press(p, START);
    press(p, DPAD_LEFT);
    press(p, DPAD_UP);
    const r = readPad(p, newTriggerHold());
    expect(r.start).toBe(true);
    expect(r.left).toBe(true);
    expect(r.right).toBe(false);
    expect(r.navX).toBe(-1);
    expect(r.navY).toBe(-1);
    expect(r.action || r.spirit).toBe(false);
  });

  it('the left stick moves a menu on its stronger axis', () => {
    const p = fakePad();
    p.axes[0] = 0.3;
    p.axes[1] = 0.8;
    const r = readPad(p, newTriggerHold());
    expect(r.navX).toBe(0);
    expect(r.navY).toBe(1);
  });

  it('reads a short, sparse or empty pad as nothing held', () => {
    const r = readPad({ axes: [], buttons: [] }, newTriggerHold());
    expect(r.steer).toBe(0);
    expect(r.action || r.spirit || r.start).toBe(false);
    const holes: PadLike = { mapping: 'standard', axes: [Number.NaN], buttons: [null, undefined] };
    expect(readPad(holes, newTriggerHold()).action).toBe(false);
  });

  it('a trigger is held past its on point and let go under its off point', () => {
    const p = fakePad();
    const hold = newTriggerHold();
    const at = (v: number): boolean => {
      squeeze(p, RT, v);
      return readPad(p, hold).action;
    };
    expect(at(0.2)).toBe(false);
    expect(at(TRIGGER_ON)).toBe(false);
    expect(at(TRIGGER_ON + 0.02)).toBe(true);
    // Easing off to between the two points keeps it held.
    expect(at(0.3)).toBe(true);
    expect(at(TRIGGER_OFF)).toBe(true);
    expect(at(TRIGGER_OFF - 0.02)).toBe(false);
    // And coming back up to the same place does not press it again.
    expect(at(0.3)).toBe(false);
    // A digital trigger reports pressed with no travel.
    p.buttons[RT] = { pressed: true, value: 0 };
    expect(readPad(p, hold).action).toBe(true);
  });
});

/** An InputController in node, as tests/input.test.ts makes one, reading the pads handed to it. */
function setup(pads: Array<FakePad | null>): InputController {
  const win = Object.assign(new EventTarget(), { innerWidth: 1280, innerHeight: 720 });
  (globalThis as { window?: unknown }).window = win;
  return new InputController(new EventTarget() as unknown as HTMLElement, () => pads);
}

const key = (type: string, code: string): Event => Object.assign(new Event(type), { code, repeat: false, preventDefault() {} });

describe('the pad through the controller', () => {
  it('every one of the nine steer levels can be reached with the stick and held', () => {
    const p = fakePad();
    const input = setup([p]);
    input.poll();
    for (const dir of [1, -1]) {
      const at = new Map<number, number>();
      for (let i = 0; i <= 200; i++) {
        p.axes[0] = (dir * i) / 200;
        const level = input.sample().steer - STEER_CENTER;
        if (!at.has(level)) at.set(level, p.axes[0]);
      }
      expect([...at.keys()].map((k) => Math.abs(k))).toEqual([0, 1, 2, 3, 4]);
      expect([...at.keys()].every((k) => k * dir >= 0)).toBe(true);
      // Full lock comes by the outer dead zone, not at the very end of the travel.
      expect(Math.abs(at.get(4 * dir) ?? 9)).toBeLessThanOrEqual(STICK_OUTER);
      // Each level holds: a little past where it was reached, the level does not move for a second.
      for (const [level, x] of at) {
        p.axes[0] = 0;
        input.sample();
        p.axes[0] = Math.max(-1, Math.min(1, x + dir * 0.02 * Math.sign(Math.abs(level))));
        for (let i = 0; i < 60; i++) expect(input.sample().steer - STEER_CENTER).toBe(level);
      }
      p.axes[0] = 0;
      expect(input.sample().steer).toBe(STEER_CENTER);
    }
    expect(input.steering).toBe(false);
    p.axes[0] = 0.8;
    input.sample();
    expect(input.steering).toBe(true);
    input.dispose();
  });

  it('the d-pad steers on the keys ramp: a tap is a correction, a hold a turn', () => {
    const p = fakePad();
    const input = setup([p]);
    input.poll();
    press(p, DPAD_RIGHT);
    const levels: number[] = [];
    for (let i = 0; i < 16; i++) levels.push(input.sample().steer - STEER_CENTER);
    expect(levels[0]).toBe(1);
    expect(levels.indexOf(4)).toBeGreaterThanOrEqual(10);
    expect(levels.indexOf(4)).toBeLessThanOrEqual(14);
    press(p, DPAD_RIGHT, false);
    expect(input.sample().steer).toBe(STEER_CENTER);
    press(p, DPAD_LEFT);
    expect(input.sample().steer - STEER_CENTER).toBe(-1);
    input.dispose();
  });

  it('holds the action and the spirit button while they are down', () => {
    const p = fakePad();
    const input = setup([p]);
    input.poll();
    expect(input.sample()).toEqual({ steer: STEER_CENTER, action: false, spirit: false });
    squeeze(p, RT, 0.9);
    press(p, X);
    for (let i = 0; i < 5; i++) expect(input.sample()).toEqual({ steer: STEER_CENTER, action: true, spirit: true });
    squeeze(p, RT, 0);
    press(p, X, false);
    expect(input.sample()).toEqual({ steer: STEER_CENTER, action: false, spirit: false });
    input.dispose();
  });

  it('a tap that comes and goes between two ticks is still seen by one', () => {
    const p = fakePad();
    const input = setup([p]);
    input.poll();
    press(p, A);
    press(p, X);
    input.poll();
    press(p, A, false);
    press(p, X, false);
    expect(input.sample()).toEqual({ steer: STEER_CENTER, action: true, spirit: true });
    expect(input.sample()).toEqual({ steer: STEER_CENTER, action: false, spirit: false });
    input.dispose();
  });

  it('becomes the last input used on a press or a stick past the dead zone, and gives way to the keys', () => {
    const p = fakePad();
    const input = setup([p]);
    const modes: InputMode[] = [];
    input.onMode((m) => modes.push(m));
    input.poll();
    expect(input.mode).toBe('keyboard');
    // A stick inside the dead zone is not use.
    p.axes[0] = 0.1;
    input.poll();
    expect(input.mode).toBe('keyboard');
    p.axes[0] = 0.5;
    input.poll();
    expect(input.mode).toBe('gamepad');
    // A key takes it back, though the stick is still over (and the stick still steers).
    window.dispatchEvent(key('keydown', 'Space'));
    window.dispatchEvent(key('keyup', 'Space'));
    input.poll();
    expect(input.mode).toBe('keyboard');
    expect(input.sample().steer).toBeGreaterThan(STEER_CENTER);
    p.axes[0] = 0;
    input.poll();
    expect(input.mode).toBe('keyboard');
    press(p, A);
    input.poll();
    expect(input.mode).toBe('gamepad');
    expect(modes).toEqual(['gamepad', 'keyboard', 'gamepad']);
    input.dispose();
  });

  it('fires the press and spirit callbacks once a press, with the pad as the source', () => {
    const p = fakePad();
    const input = setup([p]);
    const presses: string[] = [];
    let spirits = 0;
    input.onPress((source, code) => presses.push(`${source}:${code}`));
    input.onSpirit(() => spirits++);
    input.poll();
    press(p, A);
    input.poll();
    input.poll();
    input.sample();
    input.poll();
    expect(presses).toEqual(['gamepad:A']);
    press(p, A, false);
    squeeze(p, RT, 1);
    input.poll();
    press(p, START);
    input.poll();
    expect(presses).toEqual(['gamepad:A', 'gamepad:RT', 'gamepad:Start']);
    press(p, B);
    input.poll();
    input.poll();
    expect(spirits).toBe(1);
    // A press first seen by a tick's sample still reaches the callbacks at the next poll.
    press(p, START, false);
    input.poll();
    press(p, START);
    input.sample();
    input.poll();
    expect(presses[presses.length - 1]).toBe('gamepad:Start');
    expect(presses).toHaveLength(4);
    input.dispose();
  });

  it('A and Start start a run from a menu; the trigger does not', () => {
    expect(startsFromMenu('gamepad', 'A')).toBe(true);
    expect(startsFromMenu('gamepad', 'Start')).toBe(true);
    expect(startsFromMenu('gamepad', 'RT')).toBe(false);
    expect(startsFromMenu('gamepad')).toBe(false);
  });

  it('gives the menus first turn at A and Start, and a press a menu took fires nothing else', () => {
    const p = fakePad();
    const input = setup([p]);
    const presses: string[] = [];
    const seen: PadMenu[] = [];
    let take = true;
    input.onPress((source, code) => presses.push(`${source}:${code}`));
    input.onPadMenu((m) => {
      seen.push({ ...m });
      return take;
    });
    input.poll();
    press(p, A);
    press(p, DPAD_LEFT);
    input.poll();
    expect(seen[seen.length - 1]).toEqual({ x: -1, y: 0, a: true, b: false, start: false });
    expect(presses).toEqual([]);
    // Held, it is not fresh again.
    input.poll();
    expect(seen[seen.length - 1]).toEqual({ x: -1, y: 0, a: false, b: false, start: false });
    press(p, A, false);
    input.poll();
    take = false;
    press(p, A);
    input.poll();
    expect(presses).toEqual(['gamepad:A']);
    input.dispose();
  });

  it('a pad pulled out mid-run lets go of everything it held', () => {
    const p = fakePad();
    const pads: Array<FakePad | null> = [p];
    const input = setup(pads);
    window.dispatchEvent(new Event('gamepadconnected'));
    p.axes[0] = 1;
    squeeze(p, RT, 1);
    press(p, LB);
    for (let i = 0; i < 4; i++) input.sample();
    expect(input.sample()).toEqual({ steer: STEER_CENTER + 4, action: true, spirit: true });
    pads[0] = null;
    window.dispatchEvent(new Event('gamepaddisconnected'));
    expect(input.sample()).toEqual({ steer: STEER_CENTER, action: false, spirit: false });
    expect(input.activePad()).toBeNull();
    // Plugged back in with the trigger at rest: nothing is held over from before.
    const q = fakePad();
    squeeze(q, RT, 0.3);
    pads[0] = q;
    window.dispatchEvent(new Event('gamepadconnected'));
    expect(input.sample()).toEqual({ steer: STEER_CENTER, action: false, spirit: false });
    input.dispose();
  });

  it('a pad that only says it is disconnected reads the same as one that is gone', () => {
    const p = fakePad();
    const input = setup([p]);
    input.poll();
    p.axes[0] = -1;
    press(p, A);
    input.sample();
    expect(input.sample().action).toBe(true);
    p.connected = false;
    input.poll();
    expect(input.sample()).toEqual({ steer: STEER_CENTER, action: false, spirit: false });
    input.dispose();
  });

  it('tolerates a source that throws, and a browser with no pads at all', () => {
    const win = Object.assign(new EventTarget(), { innerWidth: 1280, innerHeight: 720 });
    (globalThis as { window?: unknown }).window = win;
    const broken = new InputController(new EventTarget() as unknown as HTMLElement, () => {
      throw new Error('no pads here');
    });
    expect(() => broken.poll()).not.toThrow();
    expect(broken.sample()).toEqual({ steer: STEER_CENTER, action: false, spirit: false });
    broken.dispose();
    const plain = new InputController(new EventTarget() as unknown as HTMLElement);
    for (let i = 0; i < 40; i++) plain.poll();
    expect(plain.sample()).toEqual({ steer: STEER_CENTER, action: false, spirit: false });
    expect(plain.mode).toBe('keyboard');
    plain.dispose();
  });
});

// ---------------------------------------------------------------------------------------------- rumble

const land = (quality: 'perfect' | 'clean' | 'sketchy' | 'hop', impact: number): SimEvent => ({ type: 'land', quality, airtime: 1, halfTurns: 0, flips: 0, impact, late: false });

/** A pad whose actuator writes down what it was asked to play. */
function rumblePad(): { pad: unknown; played: Array<{ duration: number; weak: number; strong: number }> } {
  const played: Array<{ duration: number; weak: number; strong: number }> = [];
  const pad = {
    vibrationActuator: {
      playEffect(_type: string, o: { duration: number; weakMagnitude: number; strongMagnitude: number }): Promise<string> {
        played.push({ duration: o.duration, weak: o.weakMagnitude, strong: o.strongMagnitude });
        return Promise.resolve('complete');
      },
    },
  };
  return { pad, played };
}

describe('rumble', () => {
  afterEach(() => vi.useRealTimers());

  const fx = (e: SimEvent): RumbleEffect => {
    const r = rumbleFor(e);
    if (!r) throw new Error(`no rumble for ${e.type}`);
    return r;
  };
  const peak = (r: RumbleEffect): number => Math.max(...r.pulses.map((p) => Math.max(p.weak, p.strong)));

  it('the table: each event that is felt, and the many that are not', () => {
    expect(fx({ type: 'bump', id: 1 })).toEqual({ weight: 3, pulses: [{ delay: 0, duration: 50, weak: 0.7, strong: 0.5 }] });
    expect(fx({ type: 'tumble', phase: 'start', cause: 'obstacle' as never, left: 1 })).toEqual({ weight: 4, pulses: [{ delay: 0, duration: 200, weak: 0.5, strong: 0.9 }] });
    expect(fx({ type: 'crash', cause: 'avalanche' as never })).toEqual({ weight: 5, pulses: [{ delay: 0, duration: 260, weak: 0.8, strong: 1 }] });
    // (Round 8, the events lane: a ward's shards scatter after its crack, a dash's hum settles after its ignition.)
    expect(fx({ type: 'ward', cause: 'obstacle' as never, cells: 0 })).toEqual({ weight: 3, pulses: [{ delay: 0, duration: 110, weak: 1, strong: 0.3 }, { delay: 150, duration: 60, weak: 0.5, strong: 0 }] });
    expect(fx({ type: 'dash', phase: 'start', cells: 0 })).toEqual({ weight: 2, pulses: [{ delay: 0, duration: 140, weak: 0.6, strong: 0.55 }, { delay: 150, duration: 100, weak: 0.25, strong: 0 }] });
    expect(fx({ type: 'drift', phase: 'release', tier: 1 }).pulses).toEqual([{ delay: 0, duration: 60, weak: 0.35, strong: 0 }]);
    expect(fx({ type: 'drift', phase: 'release', tier: 2 }).pulses).toEqual([{ delay: 0, duration: 90, weak: 0.55, strong: 0.15 }]);
    expect(fx({ type: 'drift', phase: 'release', tier: 3 }).pulses).toEqual([{ delay: 0, duration: 120, weak: 0.8, strong: 0.35 }]);
    // A stomp is a crisp double tick, a set piece won a rising pair.
    const stomp = fx(land('perfect', 9));
    expect(stomp.pulses).toHaveLength(2);
    expect(stomp.pulses[1].delay).toBeGreaterThan(stomp.pulses[0].duration);
    expect(stomp.pulses.every((p) => p.duration <= 45 && p.weak > p.strong)).toBe(true);
    const won = fx({ type: 'moment', index: 0, phase: 'won', n: 3, of: 3 });
    expect(won.pulses).toHaveLength(2);
    expect(won.pulses[1].strong).toBeGreaterThan(won.pulses[0].strong);
    expect(won.pulses[1].weak).toBeGreaterThan(won.pulses[0].weak);

    const silent: SimEvent[] = [
      land('hop', 12),
      { type: 'drift', phase: 'start', tier: 0 },
      { type: 'drift', phase: 'tier', tier: 2 },
      { type: 'drift', phase: 'end', tier: 2 },
      { type: 'drift', phase: 'release', tier: 0 },
      { type: 'tumble', phase: 'end', cause: 'obstacle' as never, left: 1 },
      { type: 'dash', phase: 'end', cells: 0 },
      { type: 'moment', index: 0, phase: 'step', n: 1, of: 3 },
      { type: 'moment', index: 0, phase: 'lost', n: 1, of: 3 },
      { type: 'takeoff', kind: 'pop' as never, vy: 4 },
      { type: 'comboBank', points: 100, mult: 2 },
      { type: 'revive' },
    ];
    for (const e of silent) expect(rumbleFor(e), JSON.stringify(e)).toBeNull();
  });

  it('a landing is as deep and as long as the fall was hard', () => {
    const soft = fx(land('clean', 2));
    const hard = fx(land('clean', 14));
    const most = fx(land('clean', 40));
    expect(hard.pulses[0].strong).toBeGreaterThan(soft.pulses[0].strong);
    expect(hard.pulses[0].duration).toBeGreaterThan(soft.pulses[0].duration);
    expect(most.pulses[0]).toEqual({ delay: 0, duration: 160, weak: 0.4, strong: 0.8 });
    // A sketchy one rattles more than a clean one of the same fall.
    expect(fx(land('sketchy', 14)).pulses[0].weak).toBeGreaterThan(hard.pulses[0].weak);
  });

  it('every effect is short, in range, and the hits rank bump, tumble, crash', () => {
    const all: SimEvent[] = [
      land('perfect', 9),
      land('clean', 0),
      land('sketchy', 99),
      { type: 'drift', phase: 'release', tier: 1 },
      { type: 'drift', phase: 'release', tier: 3 },
      { type: 'drift', phase: 'release', tier: 7 },
      { type: 'bump', id: 1 },
      { type: 'tumble', phase: 'start', cause: 'obstacle' as never, left: 0 },
      { type: 'crash', cause: 'avalanche' as never },
      { type: 'ward', cause: 'obstacle' as never, cells: 1 },
      { type: 'dash', phase: 'start', cells: 1 },
      { type: 'moment', index: 2, phase: 'won', n: 1, of: 1 },
    ];
    for (const e of all) {
      const r = fx(e);
      expect(rumbleLength(r), e.type).toBeGreaterThanOrEqual(40);
      expect(rumbleLength(r), e.type).toBeLessThanOrEqual(260);
      for (const p of r.pulses) {
        expect(p.weak).toBeGreaterThanOrEqual(0);
        expect(p.weak).toBeLessThanOrEqual(1);
        expect(p.strong).toBeGreaterThanOrEqual(0);
        expect(p.strong).toBeLessThanOrEqual(1);
        expect(Math.max(p.weak, p.strong)).toBeGreaterThan(0);
      }
    }
    const bump = fx({ type: 'bump', id: 1 });
    const tumble = fx({ type: 'tumble', phase: 'start', cause: 'obstacle' as never, left: 0 });
    const crash = fx({ type: 'crash', cause: 'avalanche' as never });
    expect(rumbleLength(bump)).toBeLessThan(rumbleLength(tumble));
    expect(rumbleLength(tumble)).toBeLessThan(rumbleLength(crash));
    expect(tumble.pulses[0].strong).toBeGreaterThan(bump.pulses[0].strong);
    expect(peak(crash)).toBe(1);
    expect(crash.weight).toBeGreaterThan(tumble.weight);
    expect(tumble.weight).toBeGreaterThan(bump.weight);
  });

  it('plays on the pad when the pad is in use, and is silent under reduced motion, with the setting off, and on other inputs', () => {
    const { pad, played } = rumblePad();
    const state = { mode: 'gamepad' as InputMode, setting: true, reduced: false };
    const rumble = new Rumble({ pad: () => pad, on: () => state.mode === 'gamepad' && state.setting && !state.reduced, now: () => 0 });
    rumble.simEvent({ type: 'bump', id: 1 });
    expect(played).toEqual([{ duration: 50, weak: 0.7, strong: 0.5 }]);
    played.length = 0;
    state.reduced = true;
    rumble.simEvent({ type: 'crash', cause: 'avalanche' as never });
    state.reduced = false;
    state.setting = false;
    rumble.simEvent({ type: 'crash', cause: 'avalanche' as never });
    state.setting = true;
    for (const mode of ['keyboard', 'mouse', 'touch'] as InputMode[]) {
      state.mode = mode;
      rumble.simEvent({ type: 'crash', cause: 'avalanche' as never });
    }
    expect(played).toEqual([]);
    state.mode = 'gamepad';
    rumble.simEvent({ type: 'crash', cause: 'avalanche' as never });
    expect(played).toHaveLength(1);
  });

  it('plays a double tick as two pulses, and drops the second when rumble goes off in between', () => {
    vi.useFakeTimers();
    const { pad, played } = rumblePad();
    let on = true;
    const rumble = new Rumble({ pad: () => pad, on: () => on, now: () => Date.now() });
    rumble.simEvent(land('perfect', 9));
    expect(played).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(played).toHaveLength(2);
    expect(played[1].duration).toBe(45);
    played.length = 0;
    rumble.simEvent(land('perfect', 9));
    on = false;
    vi.advanceTimersByTime(200);
    expect(played).toHaveLength(1);
  });

  it('a lighter effect does not cut a heavier one short, and a heavier one takes over', () => {
    const { pad, played } = rumblePad();
    let t = 0;
    const rumble = new Rumble({ pad: () => pad, on: () => true, now: () => t });
    rumble.simEvent({ type: 'crash', cause: 'avalanche' as never });
    t = 100;
    rumble.simEvent({ type: 'bump', id: 1 });
    expect(played).toHaveLength(1);
    // Once the crash has played out, the bump is felt.
    t = 300;
    rumble.simEvent({ type: 'bump', id: 1 });
    expect(played).toHaveLength(2);
    t = 310;
    rumble.simEvent({ type: 'tumble', phase: 'start', cause: 'obstacle' as never, left: 0 });
    expect(played).toHaveLength(3);
  });

  it('never throws: no pad, no actuator, an actuator that throws, a promise that rejects', async () => {
    const rejected: unknown[] = [];
    const onReject = (e: unknown): void => void rejected.push(e);
    process.on('unhandledRejection', onReject);
    const crash: SimEvent = { type: 'crash', cause: 'avalanche' as never };
    const pads: unknown[] = [
      null,
      {},
      { vibrationActuator: null },
      { vibrationActuator: {} },
      {
        vibrationActuator: {
          playEffect(): never {
            throw new Error('not allowed');
          },
        },
      },
      { vibrationActuator: { playEffect: () => Promise.reject(new Error('pad went away')) } },
      { vibrationActuator: { playEffect: () => undefined } },
    ];
    for (const pad of pads) {
      const rumble = new Rumble({ pad: () => pad, on: () => true, now: () => 0 });
      expect(() => rumble.simEvent(crash)).not.toThrow();
    }
    const thrower = new Rumble({
      pad: () => {
        throw new Error('no pads');
      },
      on: () => true,
      now: () => 0,
    });
    expect(() => thrower.simEvent(crash)).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', onReject);
    expect(rejected).toEqual([]);
  });
});

describe('the rumble setting', () => {
  it('is on by default, and a save from before it loads with it on', () => {
    expect(defaultSave('Ada').settings.rumble).toBe(true);
    const old = { v: 1 as const, name: 'Ada', settings: { master: 0.5, music: 0.6, sfx: 0.7, quality: 'low' as const, hints: false } };
    const d = merge(defaultSave('Ada'), old as never, '2026-01-01');
    expect(d.settings).toEqual({ master: 0.5, music: 0.6, sfx: 0.7, quality: 'low', hints: false, rumble: true });
    const off = merge(defaultSave('Ada'), { ...old, settings: { ...old.settings, rumble: false } } as never, '2026-01-01');
    expect(off.settings.rumble).toBe(false);
  });
});
