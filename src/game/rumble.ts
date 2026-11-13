import type { SimEvent } from '../sim/sim';

// The pad's rumble: what the sled just did, felt in the hands. A pure table from the sim's events to one
// or two short pulses, and a small player that sends them to the pad last used. It reads the sim's events
// and never writes anything back, so a run with rumble and a run without are the same run.
//
// The two motors of a dual-rumble pad: `weak` is the small fast one (a buzz, a tick), `strong` the large
// slow one (a thud). Crisp things lean on weak, heavy things on strong.

/** One pulse: when it starts after the effect begins (ms), how long it lasts (ms), and each motor in 0..1. */
export interface RumblePulse {
  delay: number;
  duration: number;
  weak: number;
  strong: number;
}

/** An effect: one or two pulses, and how much it matters (a heavier effect is not cut short by a lighter). */
export interface RumbleEffect {
  weight: number;
  pulses: RumblePulse[];
}

const one = (weight: number, duration: number, weak: number, strong: number): RumbleEffect => ({ weight, pulses: [{ delay: 0, duration, weak, strong }] });

/** A landing's impact (m/s of fall the ground took) that reads as the hardest. */
const IMPACT_FULL = 16;

/** A drift's release by tier: a longer, brighter buzz the more it was charged. */
const DRIFT: ReadonlyArray<readonly [number, number, number]> = [
  [60, 0.35, 0],
  [90, 0.55, 0.15],
  [120, 0.8, 0.35],
];

/** The effect an event plays, or null for the many that play none. Every effect ends within 260 ms. */
export function rumbleFor(e: SimEvent): RumbleEffect | null {
  switch (e.type) {
    case 'land': {
      if (e.quality === 'hop') return null;
      // A stomp: a crisp double tick.
      if (e.quality === 'perfect') {
        return {
          weight: 2,
          pulses: [
            { delay: 0, duration: 40, weak: 0.9, strong: 0.25 },
            { delay: 85, duration: 45, weak: 1, strong: 0.45 },
          ],
        };
      }
      // Any other landing: a thud as deep and as long as the fall was hard.
      const k = Math.max(0, Math.min(1, e.impact / IMPACT_FULL));
      return one(2, Math.round(70 + 90 * k), 0.15 + 0.25 * k + (e.quality === 'sketchy' ? 0.2 : 0), 0.2 + 0.6 * k);
    }
    case 'drift': {
      if (e.phase !== 'release' || e.tier < 1) return null;
      const [duration, weak, strong] = DRIFT[Math.min(3, Math.floor(e.tier)) - 1];
      return one(1, duration, weak, strong);
    }
    case 'bump':
      return one(3, 50, 0.7, 0.5);
    case 'tumble':
      return e.phase === 'start' ? one(4, 200, 0.5, 0.9) : null;
    case 'crash':
      return one(5, 260, 0.8, 1);
    case 'ward':
      return one(3, 110, 1, 0.3);
    case 'dash':
      return e.phase === 'start' ? one(2, 140, 0.6, 0.55) : null;
    case 'moment':
      // A set piece won: a rising pair.
      if (e.phase !== 'won') return null;
      return {
        weight: 2,
        pulses: [
          { delay: 0, duration: 70, weak: 0.35, strong: 0.2 },
          { delay: 110, duration: 110, weak: 0.75, strong: 0.55 },
        ],
      };
    default:
      return null;
  }
}

/** How long an effect takes from its first pulse to the end of its last, ms. */
export function rumbleLength(fx: RumbleEffect): number {
  let end = 0;
  for (const p of fx.pulses) end = Math.max(end, p.delay + p.duration);
  return end;
}

/** What this file needs of a pad: the Gamepad API's vibration actuator, where the browser has one. */
interface RumblePad {
  readonly vibrationActuator?: {
    playEffect?: (type: 'dual-rumble', params: { startDelay?: number; duration: number; weakMagnitude: number; strongMagnitude: number }) => Promise<unknown> | void;
  } | null;
}

export interface RumbleOpts {
  /** The pad to shake: the one last used, or null. */
  pad(): unknown;
  /** Whether to rumble at all right now: the pad is the last input used, the setting is on, and the player
   *  has not asked for reduced motion. Asked at every effect. */
  on(): boolean;
  /** A clock in ms (tests); performance.now otherwise. */
  now?(): number;
}

export class Rumble {
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  /** The effect playing: its weight and when it ends. */
  private weight = 0;
  private until = 0;

  constructor(private readonly o: RumbleOpts) {}

  /** One line beside the audio's: the sim event's effect, if it has one. */
  simEvent(e: SimEvent): void {
    const fx = rumbleFor(e);
    if (fx) this.play(fx);
  }

  play(fx: RumbleEffect): void {
    if (!this.o.on()) return;
    const now = this.o.now ? this.o.now() : performance.now();
    // A bump inside a crash's rumble does not cut the crash short.
    if (now < this.until && fx.weight < this.weight) return;
    this.cancel();
    this.weight = fx.weight;
    this.until = now + rumbleLength(fx);
    for (const p of fx.pulses) {
      if (p.delay <= 0) this.pulse(p);
      else this.timers.push(setTimeout(() => this.pulse(p), p.delay));
    }
  }

  /** Drops the pulses still to come (a new effect, a pause). */
  cancel(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    this.until = 0;
  }

  /** Sends one pulse. A pad without an actuator, a browser without the effect, a pad pulled out mid-effect
   *  and a rejected promise all come to the same thing: no rumble, and nothing thrown or logged. */
  private pulse(p: RumblePulse): void {
    if (!this.o.on()) return;
    try {
      const act = (this.o.pad() as RumblePad | null)?.vibrationActuator;
      if (!act || typeof act.playEffect !== 'function') return;
      const done = act.playEffect('dual-rumble', { startDelay: 0, duration: p.duration, weakMagnitude: Math.max(0, Math.min(1, p.weak)), strongMagnitude: Math.max(0, Math.min(1, p.strong)) });
      if (done && typeof done.catch === 'function') done.catch(() => undefined);
    } catch {
      // No rumble.
    }
  }
}
