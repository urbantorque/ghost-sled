import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/game/beats';
import { Mood } from '../src/sim/chaos';
import type { Bank } from '../src/audio/buffers';
import type { Bus } from '../src/audio/graph';
import { Sfx } from '../src/audio/sfx';
import { styleFor } from '../src/audio/theory';
import { PRIO, type Voice, VoicePool } from '../src/audio/voices';

// The sfx pool under pressure (src/audio/voices.ts, sfx.ts), on a stub AudioContext that only keeps
// the clock: a full pool steals the quietest, least important voice (a gift's tail before a fresh
// payoff), a shimmer costs one voice instead of two, a perfect landing's bloom rides on its chord,
// and overtaking your best rings the gold-white pair whatever the pass's word.

class Param {
  value = 0;
  automationRate = 'a-rate';
  setValueAtTime(): this {
    return this;
  }
  linearRampToValueAtTime(): this {
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
  setTargetAtTime(): this {
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class Node {
  gain = new Param();
  pan = new Param();
  frequency = new Param();
  detune = new Param();
  Q = new Param();
  playbackRate = new Param();
  type = '';
  buffer: unknown = null;
  loop = false;
  connect(): void {}
  disconnect(): void {}
  start(): void {}
  stop(): void {}
  setPeriodicWave(): void {}
}

// voices.ts links with `dest instanceof AudioNode`.
(globalThis as unknown as { AudioNode: unknown }).AudioNode ??= Node;

function stubCtx(): BaseAudioContext & { currentTime: number } {
  const make = () => new Node();
  return {
    currentTime: 0,
    sampleRate: 48000,
    createGain: make,
    createStereoPanner: make,
    createOscillator: make,
    createBufferSource: make,
    createBiquadFilter: make,
  } as unknown as BaseAudioContext & { currentTime: number };
}

const buf = { duration: 1 } as AudioBuffer;
const bank = { white: buf, pink: buf, brown: buf, grain: buf, jingle: buf, impulse: buf, warmSaw: {} } as unknown as Bank;
const node = new Node() as unknown as AudioNode;

/** A voice in `pool` from t0 whose sound lasts `len` s (one oscillator). */
function voiceAt(pool: VoicePool, t0: number, len: number, prio: number): Voice {
  const v = pool.voice(t0, 1, node, null, 0, 0, prio);
  v.osc('sine', 440, t0, t0 + len, v.out);
  return v;
}

describe('a full sfx pool steals the quietest, least important voice', () => {
  it("a gift's decaying tail goes before an older payoff and before a fresh shimmer", () => {
    const ctx = stubCtx();
    const pool = new VoicePool(ctx, bank, 3);
    const payoff = voiceAt(pool, 0, 2.5, PRIO.payoff);
    const gift = voiceAt(pool, 0.4, 2.4, PRIO.low);
    const sparkle = voiceAt(pool, 0.9, 1.2, PRIO.sparkle);
    ctx.currentTime = 1;
    voiceAt(pool, 1, 1, PRIO.normal);
    expect(gift.dead).toBe(true);
    expect(payoff.dead).toBe(false);
    expect(sparkle.dead).toBe(false);
    expect(pool.steals).toBe(1);
  });

  it('a payoff almost at its end goes before a fresh tick (its level, not its age, decides)', () => {
    const ctx = stubCtx();
    const pool = new VoicePool(ctx, bank, 2);
    const old = voiceAt(pool, 0, 1, PRIO.payoff);
    const tick = voiceAt(pool, 0.9, 0.2, PRIO.low);
    ctx.currentTime = 0.92;
    voiceAt(pool, 0.92, 1, PRIO.payoff);
    expect(old.dead).toBe(true);
    expect(tick.dead).toBe(false);
  });

  it('a roll that keeps adding attacks keeps its weight; a voice not started yet is safest', () => {
    const ctx = stubCtx();
    const pool = new VoicePool(ctx, bank, 3);
    const roll = voiceAt(pool, 0, 0.2, PRIO.payoff);
    for (let k = 1; k <= 9; k++) roll.osc('sine', 440, k * 0.1, k * 0.1 + 0.2, roll.out);
    const ahead = voiceAt(pool, 1.5, 0.5, PRIO.normal);
    const pass = voiceAt(pool, 0.5, 2, PRIO.normal);
    ctx.currentTime = 0.85;
    voiceAt(pool, 0.85, 1, PRIO.normal);
    expect(pass.dead).toBe(true);
    expect(roll.dead).toBe(false);
    expect(ahead.dead).toBe(false);
  });

  it('kept voices (the pad) go only when every live voice is kept', () => {
    const ctx = stubCtx();
    const pool = new VoicePool(ctx, bank, 2);
    const pad = voiceAt(pool, 0, 4, PRIO.normal);
    pad.keep = true;
    const tail = voiceAt(pool, 0, 4, PRIO.payoff);
    ctx.currentTime = 0.1;
    voiceAt(pool, 0.1, 1, PRIO.low);
    expect(tail.dead).toBe(true);
    expect(pad.dead).toBe(false);
    expect(pool.keptSteals).toBe(0);
  });
});

/** An Sfx on the stub context; `flushTo` builds every deferred part up to a time. */
function rig(max = 64): { sfx: Sfx; pool: VoicePool; ctx: BaseAudioContext & { currentTime: number }; flushTo: (t: number) => void } {
  const ctx = stubCtx();
  const pool = new VoicePool(ctx, bank, max);
  const bus = { dry: node, wet: node, duck() {}, duckSeq() {} } as unknown as Bus;
  const sfx = new Sfx(ctx, pool, bus, () => styleFor(Mood.None), null);
  const flushTo = (t: number): void => {
    for (let x = ctx.currentTime; x <= t; x += 0.025) {
      ctx.currentTime = x;
      sfx.flush(x);
    }
  };
  return { sfx, pool, ctx, flushTo };
}

const ghost = (kind: 'you' | 'pool', id = 1) => ({ id, name: kind === 'you' ? 'Your best' : 'Mila', kind, dx: 1 });
const pass = (kind: 'you' | 'pool', word: Extract<Beat, { type: 'pass' }>['word'], muted = false, id = 1): Beat => ({ type: 'pass', tick: 900, ghost: ghost(kind, id), word, text: 'Passed', first: true, chain: 1, ladder: 3, octave: false, gifts: 5, muted });

describe('voices per reward', () => {
  it('a shimmer is one voice; a Pass streak costs two voices, not three', () => {
    const { sfx, pool, flushTo } = rig();
    sfx.frame();
    sfx.beat(pass('pool', 'streak'), 0.01);
    flushTo(1);
    expect(pool.peak).toBe(2);
  });

  it('a Stomp streak 5 landing costs five voices (thump, chord with its bloom, brass, two shimmers)', () => {
    const { sfx, pool, flushTo } = rig();
    sfx.frame();
    sfx.beat({ type: 'stomp', tick: 0, streak: 5, late: false, title: 'Stomp streak 5', lead: [], x: 0, z: 0, heading: 0, yetiHop: false }, 0.01);
    sfx.event({ type: 'land', quality: 'perfect', airtime: 1.4, halfTurns: 2, flips: 1, impact: 9, late: false }, 0.01);
    flushTo(1.5);
    expect(pool.peak).toBe(5);
  });
});

describe("your best overtaken rings whatever the pass's word", () => {
  const golds = (s: Sfx): number[] => {
    const at: number[] = [];
    const o = s as unknown as { goldBell: (v: Voice, t: number, sp: boolean) => void };
    const orig = o.goldBell.bind(s);
    o.goldBell = (v, t, sp) => {
      at.push(t);
      orig(v, t, sp);
    };
    return at;
  };

  it('a slingshot, a chain, a retake and its own word all ring the pair over the word', () => {
    for (const word of ['slung', 'streak', 'tookBack', 'double', 'yourBest', 'duelWon'] as const) {
      const { sfx } = rig();
      const at = golds(sfx);
      sfx.frame();
      sfx.beat(pass('you', word), 1);
      expect(at.length, word).toBe(1);
      // Over another word it lands after the word's figure; on its own word it is the sound.
      if (word === 'yourBest') expect(at[0]).toBeCloseTo(1.06, 6);
      else expect(at[0]).toBeGreaterThan(1.06 + 0.1);
    }
  });

  it('not for a pool ghost, a muted pass, a jostle or a wreck; once per gap in a back-and-forth', () => {
    const { sfx } = rig();
    const at = golds(sfx);
    sfx.frame();
    sfx.beat(pass('pool', 'slung'), 1);
    sfx.beat(pass('you', 'slung', true), 1);
    sfx.beat(pass('you', 'jostle', true), 1);
    sfx.beat(pass('you', 'beat'), 1);
    expect(at).toHaveLength(0);
    sfx.beat(pass('you', 'passed'), 2);
    sfx.beat(pass('you', 'tookBack'), 3);
    sfx.beat(pass('you', 'tookBack'), 6.5);
    expect(at.map((t) => Math.round(t * 100) / 100)).toEqual([2.18, 6.68]);
  });

  it("a 'yourBest' pass inside the gap still plays its ladder bell", () => {
    const { sfx, pool } = rig();
    golds(sfx);
    sfx.frame();
    sfx.beat(pass('you', 'yourBest'), 1);
    const o = sfx as unknown as { note: (i: number) => number };
    const notes: number[] = [];
    const orig = o.note.bind(sfx);
    o.note = (i) => {
      notes.push(i);
      return orig(i);
    };
    sfx.beat(pass('you', 'yourBest'), 2);
    expect(notes.length).toBeGreaterThan(0);
    expect(pool.peak).toBeGreaterThanOrEqual(2);
  });
});
