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
const bank = { white: buf, pink: buf, brown: buf, hatNoise: buf, kickNoise: buf, clickNoise: buf, grain: buf, jingle: buf, impulse: buf, warmSaw: {} } as unknown as Bank;
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

describe('a voice that only adds to a moment asks the pool first', () => {
  it('room() is yes under the cap, or when the steal would take a quiet tail or a lighter voice', () => {
    const ctx = stubCtx();
    const pool = new VoicePool(ctx, bank, 2);
    expect(pool.room(PRIO.normal)).toBe(true);
    const a = voiceAt(pool, 0, 2, PRIO.payoff);
    const b = voiceAt(pool, 0, 2, PRIO.payoff);
    // Two fresh payoffs: a normal voice would cut one.
    ctx.currentTime = 0.1;
    expect(pool.room(PRIO.normal)).toBe(false);
    expect(pool.room(PRIO.payoff * 2)).toBe(true);
    // Near their ends they are quiet tails: a steal nobody hears.
    ctx.currentTime = 1.8;
    expect(pool.room(PRIO.normal)).toBe(true);
    expect(a.dead || b.dead).toBe(false);
    expect(pool.steals).toBe(0);
  });
});

/** A Beat list's flow moments, for the stub Sfx. */
const flowIn: Beat = { type: 'flow', tick: 0, phase: 'in', say: { label: 'In the flow', points: 0, tone: 'big' } };
const snuff: Beat = { type: 'flow', tick: 0, phase: 'snuff', say: { label: 'Flow broken', points: 0, tone: 'normal' } };
/** The snuff a broken streak or a lost combo brings (their line says it). */
const quietSnuff: Beat = { type: 'flow', tick: 0, phase: 'snuff' };
const broken: Beat = { type: 'streakBroken', tick: 0, was: 4, say: { label: 'Streak broken', points: 0, tone: 'lost' } };
const bumpBank: Beat[] = [
  { type: 'bump', tick: 0, side: 1, bank: true },
  { type: 'bank', tick: 0, points: 6000, mult: 4, origin: 1500, tier: 2, header: null, bump: true },
];
const lost: Beat = { type: 'comboLost', tick: 0, points: 500, stake: 2500, best: false, crack: true };
const crash: Beat = { type: 'crash', tick: 0, cause: 'tree', stake: 2500, orbitFrom: null };

/** Spies on the Sfx's chord and puff builds (when each was made, and for which time). */
function spyFlow(sfx: Sfx, ctx: { currentTime: number }): { chords: number[]; voices: Array<{ at: number; t: number; prio: number }> } {
  const o = sfx as unknown as { chord: (...a: unknown[]) => void; voice: (t: number, send: number, pan?: number, level?: number, prio?: number) => Voice };
  const chords: number[] = [];
  const voices: Array<{ at: number; t: number; prio: number }> = [];
  const ch = o.chord.bind(sfx);
  o.chord = (...a: unknown[]) => {
    chords.push(a[0] as number);
    ch(...a);
  };
  const vo = o.voice.bind(sfx);
  o.voice = (t, send, pan, level, prio) => {
    voices.push({ at: ctx.currentTime, t, prio: prio ?? PRIO.normal });
    return vo(t, send, pan, level, prio);
  };
  return { chords, voices };
}

/** The frame's beats in the engine's order: frame(list), then each beat. */
function beats(sfx: Sfx, list: Beat[], t: number): void {
  sfx.frame(list);
  for (const b of list) sfx.beat(b, t);
}

describe("'In the flow' and 'Flow broken' where the snuff now lands", () => {
  it('a snuff inside the flow-in swell stops it: its chord never lands and its voices fade', () => {
    const { sfx, ctx, flushTo } = rig();
    const spy = spyFlow(sfx, ctx);
    ctx.currentTime = 1;
    beats(sfx, [flowIn], 1.006);
    const flowVoices = spy.voices.length;
    expect(flowVoices).toBe(2);
    flushTo(1.35);
    // A sketchy landing's snuff: 'Flow broken' is its line (no 'Sketchy' call with it).
    beats(sfx, [snuff], 1.356);
    flushTo(3);
    expect(spy.chords).toHaveLength(0);
    // Without the snuff the chord lands 0.6 s after the flow-in.
    const r2 = rig();
    const s2 = spyFlow(r2.sfx, r2.ctx);
    r2.ctx.currentTime = 1;
    beats(r2.sfx, [flowIn], 1.006);
    r2.flushTo(3);
    expect(s2.chords.map((t) => Math.round(t * 1000))).toEqual([1606]);
  });

  it('a crash inside the swell stops it too, and a snuff with a crash or a lost combo adds no voice', () => {
    const { sfx, ctx, flushTo } = rig();
    const spy = spyFlow(sfx, ctx);
    ctx.currentTime = 1;
    beats(sfx, [flowIn], 1.006);
    flushTo(1.4);
    const before = spy.voices.length;
    // The director's order: the lost combo, the snuff it caused, the crash.
    beats(sfx, [lost, quietSnuff, crash], 1.406);
    flushTo(3);
    expect(spy.chords).toHaveLength(0);
    // The stumble's voice is the comboLost beat's; the snuff made none (the raw crash comes after).
    expect(spy.voices.length - before).toBe(1);
  });

  it('a crash long after the flow-in has nothing of it left to cut', () => {
    const { sfx, pool, ctx, flushTo } = rig();
    ctx.currentTime = 1;
    beats(sfx, [flowIn], 1.006);
    flushTo(1.7);
    const proto = Object.getPrototypeOf(voiceAt(pool, 1.7, 0.1, PRIO.low)) as { fadeOut: (now: number, tau: number) => void };
    const fade = proto.fadeOut;
    let fades = 0;
    proto.fadeOut = function (this: Voice, now: number, tau: number) {
      fades++;
      fade.call(this, now, tau);
    };
    try {
      // Inside the cue its swell, tone and chord fade; a minute later there is nothing to fade.
      const r2 = rig();
      r2.ctx.currentTime = 1;
      beats(r2.sfx, [flowIn], 1.006);
      r2.flushTo(1.7);
      beats(r2.sfx, [crash], 1.706);
      expect(fades).toBe(3);
      fades = 0;
      flushTo(60);
      beats(sfx, [crash], 60.006);
      expect(fades).toBe(0);
    } finally {
      proto.fadeOut = fade;
    }
  });

  it('on a sketchy landing the pfft waits for the scrape; after a bump it lands at once', () => {
    const { sfx, ctx, flushTo } = rig();
    const spy = spyFlow(sfx, ctx);
    ctx.currentTime = 2;
    // The landing's snuff comes alone (its raw sketchy landing follows the list).
    beats(sfx, [snuff], 2.006);
    flushTo(2.5);
    expect(spy.voices.map((v) => Math.round(v.t * 1000))).toEqual([2166]);
    // With 'Streak broken' (whose falling bell is its own voice) the snuff has no line and waits too.
    const r1 = rig();
    const s1 = spyFlow(r1.sfx, r1.ctx);
    r1.ctx.currentTime = 2;
    beats(r1.sfx, [broken, quietSnuff], 2.006);
    r1.flushTo(2.5);
    expect(s1.voices.map((v) => Math.round(v.t * 1000))).toEqual([2006, 2166]);
    const r2 = rig();
    const s2 = spyFlow(r2.sfx, r2.ctx);
    r2.ctx.currentTime = 2;
    beats(r2.sfx, [{ type: 'bump', tick: 0, side: 1, bank: true }, snuff], 2.006);
    expect(s2.voices.map((v) => Math.round(v.t * 1000))).toEqual([2006]);
  });

  it('over a sketchy landing the band dips under the pfft; after a bump or a crash it does not', () => {
    const ctx = stubCtx();
    const pool = new VoicePool(ctx, bank, 64);
    const ducks: number[][] = [];
    const music = { dry: node, wet: node, duck: (d: number, t: number) => void ducks.push([d, Math.round(t * 1000)]), duckSeq() {} } as unknown as Bus;
    const bus = { dry: node, wet: node, duck() {}, duckSeq() {} } as unknown as Bus;
    const sfx = new Sfx(ctx, pool, bus, () => styleFor(Mood.None), music);
    const run = (to: number): void => {
      for (let x = ctx.currentTime; x <= to; x += 0.025) {
        ctx.currentTime = x;
        sfx.flush(x);
      }
    };
    ctx.currentTime = 2;
    beats(sfx, [snuff], 2.006);
    run(2.4);
    expect(ducks).toEqual([[0.6, 2166]]);
    ducks.length = 0;
    // A bump bank (its bump beat and its bank) and a crash: no dip under the snuff.
    beats(sfx, [...bumpBank, snuff], 2.506);
    run(2.9);
    beats(sfx, [lost, quietSnuff, crash], 3.006);
    run(3.4);
    expect(ducks.filter((d) => d[0] === 0.6)).toEqual([]);
  });

  it('a crash before the waiting pfft lands drops it', () => {
    const { sfx, ctx, flushTo } = rig();
    const spy = spyFlow(sfx, ctx);
    ctx.currentTime = 2;
    beats(sfx, [snuff], 2.006);
    flushTo(2.08);
    beats(sfx, [crash], 2.086);
    const before = spy.voices.length;
    flushTo(2.6);
    expect(spy.voices.length).toBe(before);
  });

  it('never takes a voice a payoff needs: a pool full of fresh payoffs gets no pfft and no steal', () => {
    const { sfx, pool, ctx, flushTo } = rig(3);
    ctx.currentTime = 2;
    for (let i = 0; i < 3; i++) voiceAt(pool, 2, 2, PRIO.payoff);
    const spy = spyFlow(sfx, ctx);
    beats(sfx, [{ type: 'bump', tick: 0, side: 1, bank: true }, snuff], 2.006);
    flushTo(2.3);
    expect(spy.voices).toHaveLength(0);
    expect(pool.steals).toBe(0);
  });
});

describe("your best overtaken rings whatever the pass's word", () => {
  const golds = (s: Sfx): number[] => {
    const at: number[] = [];
    const o = s as unknown as { goldBell: (v: Voice, t: number, sp: boolean, amp?: number) => void };
    const orig = o.goldBell.bind(s);
    o.goldBell = (v, t, sp, amp) => {
      at.push(t);
      orig(v, t, sp, amp);
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
