import { describe, expect, it, vi } from 'vitest';
import { Mood } from '../src/sim/chaos';
import type { Bank } from '../src/audio/buffers';
import type { Bus } from '../src/audio/graph';
import { Prerender, TAKE_SAMPLES } from '../src/audio/prerender';
import { GIFT_BIG_S, GIFT_S, Sfx, giftKey } from '../src/audio/sfx';
import { ladder, styleFor } from '../src/audio/theory';
import { NodeReserve, Voice, VoicePool } from '../src/audio/voices';

// Fixed one-shots rendered once (src/audio/prerender.ts) on stub contexts that count the nodes made:
// a key renders once however often it is asked for, a voice plays its take as one source from its
// render quantum's first frame, only where each part lands on the frame it did in the render, a take
// that would cut its sound short is never used, the takes held stay under their cap and a key let go
// past it plays live (never rendered again), nothing renders above 48 kHz, a take's oscillators come
// from one shared sine wave until a render finds it refused, and a gift pickup costs its out, its
// panner and one source once its take is ready, ending when the live parts would, and makes its
// recipe only when a render will be queued.

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
  buffer: { duration: number } | null = null;
  loop = false;
  startAt = -1;
  startOffset = 0;
  connect(): void {}
  disconnect(): void {}
  start(t: number, offset = 0): void {
    this.startAt = t;
    this.startOffset = offset;
  }
  stop(): void {}
  setPeriodicWave(): void {}
}

// voices.ts links with `dest instanceof AudioNode`.
(globalThis as unknown as { AudioNode: unknown }).AudioNode ??= Node;

type Counted = BaseAudioContext & { currentTime: number; made: number; sources: Node[] };

function stubCtx(sampleRate = 48000): Counted {
  const ctx = { currentTime: 0, sampleRate, made: 0, sources: [] as Node[] };
  const make = () => {
    ctx.made++;
    return new Node();
  };
  const source = () => {
    const n = make();
    ctx.sources.push(n);
    return n;
  };
  return Object.assign(ctx, {
    destination: new Node(),
    createGain: make,
    createStereoPanner: make,
    createOscillator: make,
    createBufferSource: source,
    createBiquadFilter: make,
  }) as unknown as Counted;
}

/** A rendered take as the stub offline context returns it. */
function takeOf(channels: number, length: number, sampleRate: number): AudioBuffer {
  return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate } as unknown as AudioBuffer;
}

type OfflineCtor = new (ch: number, len: number, sr: number) => OfflineAudioContext;
interface Made {
  length: number;
  nodes: number;
  finish: () => Promise<void>;
  fail: () => Promise<void>;
}

/** OfflineAudioContext stubs: each records its length and the nodes built on it, and finishes (or
 *  fails) when the test says. */
function offlineStub(channels = 1): { Ctor: OfflineCtor; made: Made[] } {
  const made: Made[] = [];
  class Offline {
    readonly destination = new Node();
    oncomplete: unknown = null;
    private settle: { ok: (b: AudioBuffer) => void; no: (e: Error) => void } | null = null;
    private readonly entry: Made;
    constructor(
      _ch: number,
      readonly length: number,
      readonly sampleRate: number,
    ) {
      this.entry = {
        length,
        nodes: 0,
        finish: async () => {
          this.settle?.ok(takeOf(channels, length, sampleRate));
          await Promise.resolve();
        },
        fail: async () => {
          this.settle?.no(new Error('render failed'));
          await Promise.resolve();
        },
      };
      made.push(this.entry);
    }
    private node(): Node {
      this.entry.nodes++;
      return new Node();
    }
    createGain(): Node {
      return this.node();
    }
    createOscillator(): Node {
      return this.node();
    }
    createBufferSource(): Node {
      return this.node();
    }
    createBiquadFilter(): Node {
      return this.node();
    }
    createStereoPanner(): Node {
      return this.node();
    }
    startRendering(): Promise<AudioBuffer> {
      return new Promise((ok, no) => {
        this.settle = { ok, no };
      });
    }
  }
  return { Ctor: Offline as unknown as OfflineCtor, made };
}

const buf = { duration: 1 } as AudioBuffer;
const bank = { white: buf, pink: buf, brown: buf, hatNoise: buf, kickNoise: buf, clickNoise: buf, grains: buf, jingle: buf, impulse: buf, warmSaw: {}, hollow: {} } as unknown as Bank;

/** A one-oscillator sound `len` s long. */
const tone = (len: number) => (v: Voice, t: number) => void v.osc('sine', 440, t, t + len, v.out);

/** Plays `key` at t as a caller does: from its take on a fresh voice (true), or the live parts and a
 *  want() (false); `starts` are the offsets its parts start at. */
function ask(r: Prerender, ctx: Counted, key: number, len: number, made = len, t = 0.006, starts: readonly number[] = [0]): boolean {
  const v = new VoicePool(ctx, bank, 64).voice(t, 1, ctx.destination as AudioNode, null, 0);
  if (r.play(v, key, t, t)) return true;
  r.want(key, t, len, starts, tone(made));
  return false;
}

/** The buffer the last source made on `ctx` played. */
const lastBuffer = (ctx: Counted): { duration: number; length?: number } | null => ctx.sources[ctx.sources.length - 1]?.buffer ?? null;

describe('a fixed sound renders once and then plays as one source', () => {
  it('the first ask plays live and queues one render; asks before it is ready add none', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    for (let i = 0; i < 3; i++) expect(ask(r, ctx, 1, 1)).toBe(false);
    r.pump();
    r.pump();
    expect(off.made).toHaveLength(1);
    // 0.006 s is 288 frames at 48 kHz, 32 into its render quantum: the take holds two blocks and
    // those 32 frames of silence ahead of the sound.
    expect(off.made[0].length).toBe(256 + 32 + 48000 + 1);
    // The recipe ran on the offline context: the voice's out and the oscillator.
    expect(off.made[0].nodes).toBe(2);
    expect(ask(r, ctx, 1, 1)).toBe(false);
    await off.made[0].finish();
    expect(ask(r, ctx, 1, 1)).toBe(true);
    expect(lastBuffer(ctx)?.length).toBe(48289);
    expect(r.hits).toBe(1);
    expect(r.misses).toBe(4);
    expect(r.renders).toBe(1);
    expect(r.held).toBe(48289);
  });

  it('starts one render per scheduler pass and keeps two in flight at most', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    for (const k of [1, 2, 3]) ask(r, ctx, k, 0.5);
    r.pump();
    expect(off.made).toHaveLength(1);
    r.pump();
    r.pump();
    expect(off.made).toHaveLength(2);
    await off.made[0].finish();
    r.pump();
    expect(off.made).toHaveLength(3);
  });

  it("a take plays from its render quantum's first frame, only at the phase it was rendered at", async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    // 1 s plus 32.4 frames: frame 48032.4, 96.4 frames into quantum 375 (frame 48000).
    const t = (48000 + 32.4) / 48000;
    expect(r.phaseOf(t)).toBeCloseTo(32.4, 3);
    expect(r.phaseOf(0.006)).toBe(32);
    expect(r.phaseOf(127.9999999 / 48000)).toBe(0);
    ask(r, ctx, 1, 1, 1, t);
    r.pump();
    expect(off.made[0].length).toBe(Math.ceil(256 + 32.4 + 48000) + 1);
    await off.made[0].finish();
    const pool = new VoicePool(ctx, bank, 4);
    const v = pool.voice(t, 0.3, ctx.destination as AudioNode, null, 0, 0.2);
    const made = ctx.made;
    expect(r.play(v, 1, t, t + 0.1)).toBe(true);
    // One source, on frame 48000, from the take's third block.
    expect(ctx.made - made).toBe(1);
    expect(ctx.sources[ctx.sources.length - 1].startAt * 48000).toBeCloseTo(48000, 6);
    expect(ctx.sources[ctx.sources.length - 1].startOffset * 48000).toBeCloseTo(256, 6);
    expect(v.end).toBeCloseTo(1 + 48034 / 48000, 9);
    // The latest attack is 0.1 s in: until then the voice reads as at its attack.
    ctx.currentTime = t + 0.05;
    expect(v.level(t + 0.05)).toBe(1);
    expect(v.level(t + 0.5)).toBeLessThan(1);
    // Another phase, or a quantum already rendering: built live, and no second render.
    ctx.currentTime = 2;
    expect(ask(r, ctx, 1, 1, 1, 2 + 1 / 48000)).toBe(false);
    expect(r.offGrid).toBe(1);
    expect(ask(r, ctx, 1, 1, 1, 2 + 32.4 / 48000)).toBe(true);
    ctx.currentTime = 2 + 128 / 48000 + 32.4 / 48000 - 1e-4;
    expect(ask(r, ctx, 1, 1, 1, 2 + 128 / 48000 + 32.4 / 48000)).toBe(false);
    r.pump();
    expect(off.made).toHaveLength(1);
  });

  it('a take plays only where each part lands on the frame it did in the render', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    // Parts at 0 and 55 ms. In the render (frame 256 + 32) the second starts on frame 2928 exactly.
    const starts = [0, 0.055];
    ask(r, ctx, 1, 1, 1, 0.006, starts);
    r.pump();
    await off.made[0].finish();
    // Quantum 42 plus 32 frames: 55 ms on is frame 8304 exactly, as in the render: the take plays.
    const clean = (42 * 128) / 48000 + 0.006;
    expect(((clean + 0.055) * 48000) % 1).toBe(0);
    expect(ask(r, ctx, 1, 1, 1, clean, starts)).toBe(true);
    // Quantum 74: 55 ms on is 12400.000000000002 frames, so that part starts on frame 12401: live.
    const noisy = (74 * 128) / 48000 + 0.006;
    expect((noisy + 0.055) * 48000).toBeGreaterThan(12400);
    expect(ask(r, ctx, 1, 1, 1, noisy, starts)).toBe(false);
    expect(r.offGrid).toBe(1);
    // Without the part at 55 ms the same start plays the take.
    const r2 = new Prerender(ctx, bank, off.Ctor);
    ask(r2, ctx, 1, 1, 1, 0.006, [0]);
    r2.pump();
    await off.made[1].finish();
    expect(ask(r2, ctx, 1, 1, 1, noisy, [0])).toBe(true);
  });

  it('past the cap the take played longest ago goes, and its key plays live from then on', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    // Three takes of 40% of the cap each: the third pushes out the one played longest ago.
    const s = (TAKE_SAMPLES * 0.4) / 48000;
    for (const k of [1, 2]) {
      ask(r, ctx, k, s);
      r.pump();
      await off.made[off.made.length - 1].finish();
    }
    // 1 was made first but played since: 2 is the one played longest ago.
    expect(ask(r, ctx, 1, s)).toBe(true);
    ask(r, ctx, 3, s);
    r.pump();
    await off.made[off.made.length - 1].finish();
    expect(ask(r, ctx, 2, s)).toBe(false);
    expect(ask(r, ctx, 1, s)).toBe(true);
    expect(ask(r, ctx, 3, s)).toBe(true);
    expect(r.held).toBeLessThanOrEqual(TAKE_SAMPLES);
    // 2 is not rendered again, however often it is asked for.
    r.pump();
    expect(off.made).toHaveLength(3);
    expect(r.wants(2)).toBe(false);
    expect(ask(r, ctx, 2, s)).toBe(false);
    r.pump();
    expect(off.made).toHaveLength(3);
    expect(r.renders).toBe(3);
  });

  it('a cycle of twelve keys through a cap that holds eight renders each key once', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    // Eight takes fit under the cap and a ninth does not. Rendering a key again once its take was let
    // go would push out the next key asked for, and every pickup of the cycle would render.
    const s = (TAKE_SAMPLES / 8 - 400) / 48000;
    let hits = 0;
    for (let round = 0; round < 5; round++) {
      for (let k = 1; k <= 12; k++) {
        if (ask(r, ctx, k, s)) hits++;
        const n = off.made.length;
        r.pump();
        if (off.made.length > n) await off.made[n].finish();
      }
    }
    expect(off.made).toHaveLength(12);
    expect(r.renders).toBe(12);
    expect(r.held).toBe(8 * off.made[0].length);
    expect(r.held).toBeLessThanOrEqual(TAKE_SAMPLES);
    // Keys 1 to 4 went to make room for 9 to 12 and play live; the other eight play their takes in
    // each of the four later rounds.
    expect(hits).toBe(4 * 8);
    for (let k = 1; k <= 12; k++) expect(r.wants(k)).toBe(false);
  });

  it('above 48 kHz nothing renders and every pickup plays live', () => {
    for (const rate of [88200, 96000, 192000]) {
      const ctx = stubCtx(rate);
      const off = offlineStub();
      const r = new Prerender(ctx, bank, off.Ctor);
      expect(r.wants(1)).toBe(false);
      expect(ask(r, ctx, 1, 1)).toBe(false);
      r.pump();
      expect(off.made).toHaveLength(0);
      expect(ask(r, ctx, 1, 1)).toBe(false);
      expect(r.misses).toBe(2);
      expect(r.renders).toBe(0);
    }
    // At 48 kHz and under, takes render.
    for (const rate of [44100, 48000]) {
      const ctx = stubCtx(rate);
      const off = offlineStub();
      const r = new Prerender(ctx, bank, off.Ctor);
      expect(r.wants(1)).toBe(true);
      ask(r, ctx, 1, 1);
      r.pump();
      expect(off.made).toHaveLength(1);
    }
  });

  it('wants() is true only while asking would queue a render', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    expect(r.wants(1)).toBe(true);
    ask(r, ctx, 1, 1);
    // Queued, rendering, then ready.
    expect(r.wants(1)).toBe(false);
    r.pump();
    expect(r.wants(1)).toBe(false);
    await off.made[0].finish();
    expect(r.wants(1)).toBe(false);
    // A render that failed.
    expect(r.wants(2)).toBe(true);
    ask(r, ctx, 2, 1);
    r.pump();
    await off.made[1].fail();
    expect(r.wants(2)).toBe(false);
    // No offline rendering at all.
    expect(new Prerender(ctx, bank, null).wants(1)).toBe(false);
  });

  it('a take shorter than its sound is never made (it plays live for good), nor a stereo one', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    ask(r, ctx, 1, 0.5, 0.8);
    r.pump();
    expect(r.failures).toBe(1);
    expect(ask(r, ctx, 1, 0.5, 0.8)).toBe(false);
    r.pump();
    expect(off.made).toHaveLength(1);
    const st = offlineStub(2);
    const r2 = new Prerender(ctx, bank, st.Ctor);
    ask(r2, ctx, 1, 0.5);
    r2.pump();
    await st.made[0].finish();
    expect(ask(r2, ctx, 1, 0.5)).toBe(false);
    expect(r2.failures).toBe(1);
  });

  it('a render that fails frees its slot and its key plays live', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    for (const k of [1, 2, 3]) ask(r, ctx, k, 0.5);
    r.pump();
    r.pump();
    await off.made[0].fail();
    expect(r.failures).toBe(1);
    r.pump();
    expect(off.made).toHaveLength(3);
    ask(r, ctx, 1, 0.5);
    r.pump();
    expect(off.made).toHaveLength(3);
    expect(ask(r, ctx, 1, 0.5)).toBe(false);
  });

  it('without OfflineAudioContext, or where one cannot be made, nothing renders and every play is live', () => {
    const ctx = stubCtx();
    const r = new Prerender(ctx, bank, null);
    expect(ask(r, ctx, 1, 1)).toBe(false);
    r.pump();
    expect(r.misses).toBe(1);
    expect(r.renders).toBe(0);
    const Throws = function () {
      throw new Error('no offline rendering at this rate');
    } as unknown as OfflineCtor;
    const r2 = new Prerender(ctx, bank, Throws);
    ask(r2, ctx, 1, 1);
    ask(r2, ctx, 2, 1);
    r2.pump();
    expect(r2.failures).toBe(1);
    // The queue is dropped and later asks queue nothing.
    r2.pump();
    ask(r2, ctx, 3, 1);
    r2.pump();
    expect(r2.failures).toBe(1);
    expect(ask(r2, ctx, 3, 1)).toBe(false);
  });

  it('a take that lands after dispose is dropped', async () => {
    const ctx = stubCtx();
    const off = offlineStub();
    const r = new Prerender(ctx, bank, off.Ctor);
    ask(r, ctx, 1, 1);
    r.pump();
    r.dispose();
    await off.made[0].finish();
    expect(r.held).toBe(0);
    expect(ask(r, ctx, 1, 1)).toBe(false);
  });
});

describe("a take's oscillators are made from one shared sine wave", () => {
  /** OscillatorNode constructor stubs: the options each was made (or, with `refuse`, tried) with;
   *  `refuse` throws instead of making one. */
  function withOscCtor<T>(refuse: boolean, fn: (made: Array<{ periodicWave?: unknown }>) => T): T {
    const g = globalThis as unknown as { OscillatorNode?: unknown };
    const prev = g.OscillatorNode;
    const made: Array<{ periodicWave?: unknown }> = [];
    g.OscillatorNode = function (_ctx: unknown, opts: { periodicWave?: unknown }) {
      made.push(opts);
      if (refuse) throw new Error('wave from another context');
      const n = new Node();
      n.type = 'custom';
      return n;
    };
    try {
      return fn(made);
    } finally {
      g.OscillatorNode = prev;
    }
  }
  const wave = {} as PeriodicWave;

  it("with a wave, a voice's sines keep it (no 'sine' type set) and other shapes still set theirs", () => {
    withOscCtor(false, (made) => {
      const ctx = stubCtx();
      const reserve = new NodeReserve(ctx, wave);
      expect(reserve.sine).toBe(true);
      const v = new Voice(ctx, bank, reserve, 0, 1, ctx.destination as AudioNode, null, 0);
      const sine = v.osc('sine', 440, 0, 1, v.out) as unknown as Node;
      const tri = v.osc('triangle', 440, 0, 1, v.out) as unknown as Node;
      expect(made).toHaveLength(2);
      expect(made[0].periodicWave).toBe(wave);
      expect(sine.type).toBe('custom');
      expect(tri.type).toBe('triangle');
      // The live reserve makes plain oscillators and sets every type.
      const live = new Voice(ctx, bank, new NodeReserve(ctx), 0, 1, ctx.destination as AudioNode, null, 0);
      expect((live.osc('sine', 440, 0, 1, live.out) as unknown as Node).type).toBe('sine');
      expect(made).toHaveLength(2);
    });
  });

  it('where the wave is refused it falls back to plain oscillators for good', () => {
    withOscCtor(true, () => {
      const ctx = stubCtx();
      const reserve = new NodeReserve(ctx, wave);
      const made = ctx.made;
      reserve.osc();
      expect(ctx.made - made).toBe(1);
      expect(reserve.sine).toBe(false);
      const v = new Voice(ctx, bank, reserve, 0, 1, ctx.destination as AudioNode, null, 0);
      expect((v.osc('sine', 440, 0, 1, v.out) as unknown as Node).type).toBe('sine');
    });
  });

  it('once a render finds the wave refused, later renders make plain oscillators without trying it', () => {
    for (const refuse of [true, false]) {
      withOscCtor(refuse, (tried) => {
        const ctx = Object.assign(stubCtx(), { createPeriodicWave: () => wave });
        const off = offlineStub();
        const r = new Prerender(ctx, bank, off.Ctor);
        ask(r, ctx, 1, 1);
        ask(r, ctx, 2, 1);
        r.pump();
        expect(tried).toHaveLength(1);
        expect(tried[0].periodicWave).toBe(wave);
        r.pump();
        // Refused: the second render never tries the wave. Taken: every render's oscillator has it.
        expect(tried).toHaveLength(refuse ? 1 : 2);
        expect(off.made).toHaveLength(2);
        expect(r.failures).toBe(0);
        // A refused render's oscillator came from the offline context, as did the second render's.
        expect(off.made[0].nodes).toBe(refuse ? 2 : 1);
        expect(off.made[1].nodes).toBe(refuse ? 2 : 1);
      });
    }
  });
});

describe('a gift pickup from its take', () => {
  /** An Sfx on a counting stub with a Prerender on an offline stub. */
  function rig(): { sfx: Sfx; ctx: Counted; pool: VoicePool; off: ReturnType<typeof offlineStub>; renders: Prerender } {
    const ctx = stubCtx();
    const pool = new VoicePool(ctx, bank, 24);
    const node = new Node() as unknown as AudioNode;
    const bus = { dry: node, wet: node, duck() {}, duckSeq() {} } as unknown as Bus;
    const sfx = new Sfx(ctx, pool, bus, () => styleFor(Mood.None), null);
    const off = offlineStub();
    const renders = new Prerender(ctx, bank, off.Ctor);
    sfx.renders = renders;
    return { sfx, ctx, pool, off, renders };
  }
  const gift = (value: number) => ({ type: 'gift' as const, id: 1, value, x: 0, y: 0, z: 0 });
  /** The live voice's end once every deferred part is built. */
  function liveEnd(value: number): { end: number; nodes: number } {
    const { sfx, ctx, pool } = rig();
    sfx.renders = null;
    const made = ctx.made;
    sfx.event(gift(value), 0.006);
    for (let x = 0; x <= 0.3; x += 0.025) {
      ctx.currentTime = x;
      sfx.flush(x);
    }
    const v = (pool as unknown as { list: Voice[] }).list[0];
    return { end: v.end, nodes: ctx.made - made };
  }

  for (const value of [1, 5]) {
    it(`worth ${value}: its take covers the live sound, and a pickup then costs three nodes`, async () => {
      const live = liveEnd(value);
      // Live: ten nodes, sixteen worth 5 or more (and the pool's shared reverb send, made on first use).
      expect(live.nodes).toBe((value >= 5 ? 16 : 10) + 1);
      const { sfx, ctx, pool, off, renders } = rig();
      sfx.event(gift(value), 0.006);
      renders.pump();
      expect(renders.failures).toBe(0);
      // Two blocks, the pickup's 32 frames into its render quantum, then the sound.
      expect(off.made[0].length).toBe(Math.ceil(256 + 32 + (value >= 5 ? GIFT_BIG_S : GIFT_S) * 48000) + 1);
      await off.made[0].finish();
      // Two seconds on (the streak starts again, so the same step plays).
      ctx.currentTime = 2;
      const made = ctx.made;
      sfx.event(gift(value), 2.006);
      expect(ctx.made - made).toBe(3);
      expect(renders.hits).toBe(1);
      const list = (pool as unknown as { list: Voice[] }).list;
      const v = list[list.length - 1];
      // It starts on its quantum's first frame, 32 frames early, and ends where the live parts end,
      // give or take two samples of the take's rounding.
      const src = ctx.sources[ctx.sources.length - 1];
      expect(src.startAt * 48000).toBeCloseTo(2.006 * 48000 - 32, 6);
      expect(v.end - 2.006).toBeGreaterThanOrEqual(live.end - 0.006 - 1e-9);
      expect(v.end - 2.006).toBeLessThan(live.end - 0.006 + 3 / 48000);
      expect(src.startAt + (src.buffer?.duration ?? 0) - src.startOffset).toBeCloseTo(v.end, 9);
    });
  }

  it('each ladder step and kind has its own take; the next step up plays live until its take is ready', async () => {
    const { sfx, ctx, off, renders } = rig();
    sfx.event(gift(1), 0.006);
    // 0.3 s later the streak climbs a step: a new key, built live and queued.
    ctx.currentTime = 0.3;
    sfx.event(gift(1), 0.306);
    renders.pump();
    renders.pump();
    expect(off.made).toHaveLength(2);
    expect(renders.misses).toBe(2);
    await off.made[0].finish();
    await off.made[1].finish();
    // A worth-5 pickup on the first step after the streak lapses: another key.
    ctx.currentTime = 2;
    sfx.event(gift(5), 2.006);
    expect(renders.hits).toBe(0);
    ctx.currentTime = 4;
    sfx.event(gift(1), 4.006);
    expect(renders.hits).toBe(1);
  });

  it('a live pickup makes its recipe only when a render will be queued', async () => {
    const { sfx, ctx, off, renders } = rig();
    const want = vi.spyOn(renders, 'want');
    // Pickups 2 s apart, so the streak starts again and each plays the first step.
    const made = ctx.made;
    sfx.event(gift(1), 0.006);
    // Built live as before (ten nodes and the pool's reverb send), and asked for once.
    expect(ctx.made - made).toBe(11);
    expect(want).toHaveBeenCalledTimes(1);
    // While its render waits, and once it is ready but the pickup lands off its frames: built live,
    // nothing asked.
    ctx.currentTime = 2;
    sfx.event(gift(1), 2.006);
    renders.pump();
    await off.made[0].finish();
    ctx.currentTime = 4;
    sfx.event(gift(1), 4.006 + 1 / 48000);
    expect(renders.offGrid).toBe(1);
    expect(want).toHaveBeenCalledTimes(1);
    // A worth-5 pickup is another key: asked for once, and not again after its render failed.
    ctx.currentTime = 6;
    sfx.event(gift(5), 6.006);
    expect(want).toHaveBeenCalledTimes(2);
    renders.pump();
    await off.made[1].fail();
    ctx.currentTime = 8;
    sfx.event(gift(5), 8.006);
    expect(renders.failures).toBe(1);
    expect(want).toHaveBeenCalledTimes(2);
    expect(renders.hits).toBe(0);
    expect(off.made).toHaveLength(2);
  });

  it('keys tell every note set apart', () => {
    const k = styleFor(Mood.None);
    const seen = new Set<number>();
    for (let i = 6; i <= 15; i++) {
      seen.add(giftKey(ladder(k, i), ladder(k, i + 2), 0));
      seen.add(giftKey(ladder(k, i), ladder(k, i + 2), ladder(k, i + 4)));
    }
    expect(seen.size).toBe(20);
    expect(giftKey(127, 127, 127)).not.toBe(giftKey(127, 127, 126));
    expect(giftKey(1, 0, 0)).not.toBe(giftKey(0, 127, 127));
  });
});
