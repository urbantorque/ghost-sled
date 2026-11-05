import { afterEach, describe, expect, it, vi } from 'vitest';
import { Listener, type ListenSources, PLACES, newView } from '../src/audio/listen';
import { TAKE_NAMES, TAKE_RATE, synthesize } from '../src/audio/takes';
import { Mood } from '../src/sim/chaos';
import type { Section } from '../src/sim/course';

// The soundscape (src/audio/scape.ts): its takes are sound, its reading of the world puts each place
// where it stands, and a cruise past everything it voices costs under a node or two a second.

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
  delayTime = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  type = '';
  buffer: unknown = null;
  loop = false;
  channelCount = 2;
  channelCountMode = 'max';
  onended: unknown = null;
  connect<T>(d: T): T {
    return d;
  }
  disconnect(): void {}
  start(): void {}
  stop(): void {}
  setPeriodicWave(): void {}
}
(globalThis as unknown as { AudioNode: unknown }).AudioNode ??= Node;

class StubBuffer {
  readonly duration: number;
  private readonly data: Float32Array[];
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.duration = length / sampleRate;
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(i: number): Float32Array {
    return this.data[i];
  }
}

/** A context that counts the nodes made, by kind. */
class CountingCtx {
  currentTime = 0;
  readonly sampleRate = 48000;
  readonly destination = new Node();
  made: Record<string, number> = {};
  private make(kind: string): Node {
    this.made[kind] = (this.made[kind] ?? 0) + 1;
    return new Node();
  }
  total(): number {
    return Object.values(this.made).reduce((a, b) => a + b, 0);
  }
  createGain = () => this.make('gain');
  createBiquadFilter = () => this.make('biquad');
  createBufferSource = () => this.make('source');
  createConvolver = () => this.make('convolver');
  createDynamicsCompressor = () => this.make('compressor');
  createOscillator = () => this.make('osc');
  createStereoPanner = () => this.make('panner');
  createDelay = () => this.make('delay');
  createPeriodicWave = (): object => ({});
  createBuffer = (ch: number, len: number, sr: number): StubBuffer => new StubBuffer(ch, len, sr);
}

describe('the takes', () => {
  it('every take is finite, audible, under its peak and ends without a click', () => {
    for (const name of TAKE_NAMES) {
      const d = synthesize(name);
      let peak = 0;
      let sum = 0;
      let bad = 0;
      for (const x of d) {
        if (!Number.isFinite(x)) bad++;
        peak = Math.max(peak, Math.abs(x));
        sum += x * x;
      }
      expect(bad, name).toBe(0);
      expect(peak, name).toBeLessThanOrEqual(0.9001);
      expect(peak, name).toBeGreaterThan(0.5);
      expect(Math.sqrt(sum / d.length), name).toBeGreaterThan(0.005);
      expect(Math.abs(d[d.length - 1]), name).toBeLessThan(0.01);
      expect(d.length / TAKE_RATE, name).toBeLessThanOrEqual(6.01);
    }
  });

  it('a take is the same every time it is made (seeded)', () => {
    const a = synthesize('cheer');
    const b = synthesize('cheer');
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 997) expect(a[i]).toBe(b[i]);
  });
});

function course(kind: Section['kind'] = 'cruise'): ListenSources['course'] {
  return { centerX: () => 0, halfWidth: () => 9, section: () => ({ kind }) as Section, params: { halfWidthStart: 9 } } as unknown as ListenSources['course'];
}

function sources(over: Partial<ListenSources> = {}): ListenSources {
  return {
    course: course(),
    biome: 'alpine',
    mood: Mood.None,
    tier: 'high',
    sites: [],
    crowds: true,
    flocks: [],
    birds: 'crow',
    lifts: true,
    lift: () => null,
    chimneys: [],
    chimneyCount: 0,
    vista: 0,
    dusk: 0,
    night: false,
    ...over,
  };
}

describe('the listener puts each place where it stands', () => {
  it("a span's crowd is heard from the middle; a bank piece's pans to its bank as you draw level", () => {
    const l = new Listener();
    const v = newView();
    const gate = sources({ sites: [{ n: 0, kind: 'gate', span: true, side: 1, z: 100, x: 0 }] });
    l.hear(gate, 0, 0, 0, v);
    expect(v.crowd).toBeGreaterThan(0.2);
    expect(v.crowdPan).toBe(0);
    expect(v.crowdWide).toBe(true);
    const hut = sources({ sites: [{ n: 0, kind: 'hut', span: false, side: 1, z: 100, x: 0 }] });
    l.hear(hut, 0, 0, 0, v);
    const far = v.crowdPan;
    l.hear(hut, 0, 100, 0, v);
    expect(v.crowd).toBeCloseTo(PLACES.hut.crowd ?? 0, 5);
    expect(v.crowdPan).toBeGreaterThan(0.9);
    expect(far).toBeLessThan(v.crowdPan);
    expect(far).toBeGreaterThan(0);
    // Behind you it darkens, then fades.
    l.hear(hut, 0, 150, 0, v);
    expect(v.crowdBehind).toBeGreaterThan(0.5);
    l.hear(hut, 0, 400, 0, v);
    expect(v.crowd).toBe(0);
  });

  it('crowds are only heard where they are drawn, and an unknown kind is silent', () => {
    const l = new Listener();
    const v = newView();
    l.hear(sources({ crowds: false, sites: [{ n: 0, kind: 'gate', span: true, side: 1, z: 20, x: 0 }] }), 0, 0, 0, v);
    expect(v.crowd).toBe(0);
    l.hear(sources({ sites: [{ n: 0, kind: 'sculpture', span: false, side: 1, z: 20, x: 0 }] }), 0, 0, 0, v);
    expect(v.crowd + v.bustle + v.enclosed).toBe(0);
  });

  it('a gallery encloses you between its mouths and shelters you from the wind; a site gives its own half length', () => {
    const l = new Listener();
    const v = newView();
    // Lane B's long sites: centred on z, covering z - len to z + len.
    const s = sources({ course: course('bowl'), sites: [{ n: 0, kind: 'gallery', span: false, side: 1, z: 200, x: 0, len: 30 }] });
    l.hear(s, 0, 150, 0, v);
    expect(v.enclosed).toBe(0);
    expect(v.exposure).toBeGreaterThan(0.5);
    l.hear(s, 0, 200, 0, v);
    expect(v.enclosed).toBe(1);
    expect(v.exposure).toBe(0);
    l.hear(s, 0, 225, 0, v);
    expect(v.enclosed).toBe(1);
    l.hear(s, 0, 240, 0, v);
    expect(v.enclosed).toBe(0);
    // Without its own length the kind's default; a corridor of torii rings less.
    l.hear(sources({ sites: [{ n: 0, kind: 'icetunnel', span: false, side: 1, z: 200, x: 0 }] }), 0, 235, 0, v);
    expect(v.enclosed).toBe(1);
    l.hear(sources({ sites: [{ n: 0, kind: 'toriirow', span: false, side: 1, z: 200, x: 0, len: 50 }] }), 0, 200, 0, v);
    expect(v.enclosed).toBeCloseTo(PLACES.toriirow.roof ?? 0, 5);
  });

  it("a village street bustles and its crowd lines both sides; its bell rings once as you come, again next run", () => {
    const l = new Listener();
    const v = newView();
    const s = sources({ sites: [{ n: 4, kind: 'village', span: false, side: 1, z: 300, x: 0, len: 60 }] });
    l.hear(s, 0, 100, 0, v);
    expect(v.bell).toBe(null);
    l.hear(s, 0, 170, 0, v);
    expect(v.bell).toBe('church');
    expect(v.bustle).toBeGreaterThan(0);
    l.hear(s, 0, 175, 0, v);
    expect(v.bell).toBe(null);
    l.hear(s, 0, 300, 0, v);
    expect(v.bustle).toBe(1);
    expect(v.crowdWide).toBe(true);
    expect(v.crowd).toBeCloseTo(PLACES.village.crowd ?? 0, 5);
    l.reset();
    l.hear(s, 0, 180, 0, v);
    expect(v.bell).toBe('church');
    // At Sakura the street's bell is the temple's.
    l.reset();
    l.hear({ ...s, biome: 'blossom' }, 0, 180, 0, v);
    expect(v.bell).toBe('temple');
  });

  it('birds, a lift line and a village are heard on their side; exposure follows the banks and the air', () => {
    const l = new Listener();
    const v = newView();
    const s = sources({
      flocks: [
        { z: 300, side: 1, n: 6, cross: false },
        { z: 60, side: -1, n: 6, cross: false },
      ],
      lift: () => ({ side: 1, e: 14, z0: 0, z1: 200 }),
      chimneys: [{ x: -400, z: -100 }],
      chimneyCount: 1,
    });
    l.hear(s, 0, 50, 0, v);
    expect(v.flock).toBeGreaterThan(0.5);
    expect(v.flockPan).toBeLessThan(-0.5);
    expect(v.lift).toBeGreaterThan(0.5);
    expect(v.liftPan).toBeGreaterThan(0.5);
    expect(v.village).toBeGreaterThan(0.5);
    expect(v.villagePan).toBeLessThan(0);
    const flat = v.exposure;
    l.hear(s, 0, 50, 12, v);
    expect(v.exposure).toBeGreaterThan(flat);
    expect(v.exposure).toBe(1);
    l.hear(sources({ course: course('gully') }), 0, 50, 0, v);
    expect(v.exposure).toBeLessThan(flat);
    l.hear(sources({ birds: null, flocks: [{ z: 60, side: -1, n: 6, cross: false }], lifts: false, lift: () => ({ side: 1, e: 14, z0: 0, z1: 200 }) }), 0, 50, 0, v);
    expect(v.flock + v.lift).toBe(0);
  });
});

describe('the soundscape costs under a node or two a second', () => {
  async function cruise(tier: 'low' | 'high', seconds: number): Promise<{ perSecond: number; inFrames: number; built: number }> {
    const { Core } = await import('../src/audio/core');
    const { Soundscape } = await import('../src/audio/scape');
    const ctx = new CountingCtx();
    const core = new Core(ctx as unknown as BaseAudioContext);
    // What the soundscape builds once, its takes made (the diesel loop starts then).
    const n0 = ctx.total();
    const scape = new Soundscape(ctx as unknown as BaseAudioContext, core.bank, core.graph, core.ambience);
    scape.prepare();
    const built = ctx.total() - n0;
    scape.dispose();
    core.scape.prepare();
    core.scape.setTier(tier);
    core.scape.setMood(Mood.Lantern, 'alpine');
    core.scape.setScene('run', 0);
    const l = new Listener();
    const v = newView();
    const s = sources({
      tier,
      crowds: tier !== 'low',
      lifts: tier !== 'low',
      night: true,
      dusk: 1,
      sites: [
        { n: 0, kind: 'gate', span: true, side: 1, z: 200, x: 0 },
        { n: 1, kind: 'hut', span: false, side: 1, z: 500, x: 0 },
        { n: 2, kind: 'village', span: false, side: 1, z: 800, x: 0, len: 60 },
      ],
      flocks: [{ z: 100, side: 1, n: 6, cross: false }],
      lift: () => ({ side: 1, e: 14, z0: 300, z1: 700 }),
      chimneys: [{ x: -400, z: -600 }],
      chimneyCount: tier !== 'low' ? 1 : 0,
    });
    const frame = { speed: 22, crashed: false, grounded: true };
    let inFrames = 0;
    const before = ctx.total();
    // 60 frames a second, a scheduler pass every 25 ms.
    for (let k = 0; k < seconds * 60; k++) {
      const t = k / 60;
      ctx.currentTime = t;
      const n0 = ctx.total();
      l.hear(s, 0, 22 * t, 0, v);
      core.scape.update(v, frame, t, 1 / 60);
      // A stomp every 5 s.
      if (k % 300 === 150) core.scape.beats([{ type: 'stomp', streak: 1, x: 0, z: 22 * t } as never], t);
      inFrames += ctx.total() - n0;
      if (k % 3 === 0) core.scape.tick(t);
    }
    return { perSecond: (ctx.total() - before) / seconds, inFrames, built };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The mean of several seeded cruises: the ambient calls are random, so one 40 s sample can land
   *  over a budget that holds on average (it failed about one full run in five). */
  async function mean(tier: 'low' | 'high'): Promise<{ perSecond: number; inFrames: number; built: number }> {
    const out = { perSecond: 0, inFrames: 0, built: 0 };
    const seeds = 6;
    for (let k = 0; k < seeds; k++) {
      let x = (k + 1) * 0x9e3779b9;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        x = (x + 0x6d2b79f5) | 0;
        let t = Math.imul(x ^ (x >>> 15), x | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      });
      const r = await cruise(tier, 40);
      out.perSecond += r.perSecond / seeds;
      out.inFrames += r.inFrames / seeds;
      out.built = r.built;
    }
    return out;
  }

  it('a night cruise past a gate, a lift, a hut and a town', async () => {
    const high = await mean('high');
    const low = await mean('low');
    // Built once: about sixty nodes, the diesel loop's four among them.
    expect(high.built).toBeLessThan(70);
    expect(high.perSecond).toBeLessThan(2);
    expect(low.perSecond).toBeLessThan(high.perSecond);
    expect(low.perSecond).toBeLessThan(0.6);
    // Inside frames only the crowd's cheers and a bell (one source each): the beds make none.
    expect(high.inFrames / 40).toBeLessThan(0.5);
  });
});
