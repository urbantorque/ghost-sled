import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/engine';
import { fmBell } from '../src/audio/instruments';
import type { Voice } from '../src/audio/voices';
import type { Beat } from '../src/game/beats';
import { cutHold } from '../src/game/reelshow';
import { RESULTS_TIMING } from '../src/ui/results';

// The engine on a stub AudioContext that keeps only the clock and the state (the graph's nodes are
// inert): what a rewarded ad's mute, the parked context and its resume do to the UI sounds asked for
// around them, and where a Done chime asked for at its stamp lands.

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
  cancelAndHoldAtTime(): this {
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
  offset = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  type = '';
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
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
  readonly numberOfChannels: number;
  readonly duration: number;
  private readonly data: Float32Array[];
  constructor(ch: number, readonly length: number, readonly sampleRate: number) {
    this.numberOfChannels = ch;
    this.duration = length / sampleRate;
    this.data = Array.from({ length: ch }, () => new Float32Array(length));
  }
  getChannelData(i: number): Float32Array {
    return this.data[i];
  }
}

/** The context: 'running' once created (a gesture made it), resume() and suspend() recorded and only
 *  applied when the test says the context has got there (a resume takes 50 to 90 ms in Chrome). */
class StubCtx {
  static last: StubCtx | null = null;
  static startState: 'running' | 'suspended' = 'running';
  state: 'running' | 'suspended' | 'closed' = StubCtx.startState;
  currentTime = 0;
  readonly sampleRate = 48000;
  readonly destination = new Node();
  resumes = 0;
  private readonly listeners: Array<() => void> = [];
  constructor() {
    StubCtx.last = this;
  }
  addEventListener(type: string, fn: () => void): void {
    if (type === 'statechange') this.listeners.push(fn);
  }
  /** The context gets there: it runs again and says so. */
  running(): void {
    this.state = 'running';
    for (const fn of this.listeners) fn();
  }
  createGain = (): Node => new Node();
  createBiquadFilter = (): Node => new Node();
  createBufferSource = (): Node => new Node();
  createConvolver = (): Node => new Node();
  createDynamicsCompressor = (): Node => new Node();
  createOscillator = (): Node => new Node();
  createStereoPanner = (): Node => new Node();
  createPeriodicWave = (): object => ({});
  createBuffer = (ch: number, len: number, sr: number): StubBuffer => new StubBuffer(ch, len, sr);
  resume(): Promise<void> {
    this.resumes++;
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

let nowMs = 0;
let engine: AudioEngine | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  nowMs = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  StubCtx.startState = 'running';
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = StubCtx;
});

afterEach(() => {
  engine?.dispose();
  engine = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
});

interface Built {
  name: string;
  d: number;
  t: number;
}

/** An unlocked engine and the UI sounds it builds (sfx.uiNow: the moment a sound is made). */
function rig(): { eng: AudioEngine; ctx: StubCtx; built: Built[] } {
  const eng = new AudioEngine();
  engine = eng;
  eng.unlock();
  const ctx = StubCtx.last!;
  const sfx = (eng as unknown as { core: { sfx: { uiNow: (n: string, d: number, t: number) => void } } }).core.sfx;
  const built: Built[] = [];
  const orig = sfx.uiNow.bind(sfx);
  sfx.uiNow = (n, d, t) => {
    built.push({ name: n, d, t });
    orig(n, d, t);
  };
  return { eng, ctx, built };
}

/** Real time passing with the context running: its clock, the scheduler's 25 ms passes, the timers. */
function run(ctx: StubCtx, ms: number): void {
  for (let k = 0; k < ms; k += 5) {
    if (ctx.state === 'running') ctx.currentTime += 0.005;
    nowMs += 5;
    vi.advanceTimersByTime(5);
  }
}

/** Real time passing while the context is parked: its clock stands still. */
function wait(ms: number): void {
  nowMs += ms;
  vi.advanceTimersByTime(ms);
}

const cardShow = { count: true, newBest: true, beats: 2, missions: [0, 1], coins: [] as number[] };

describe('Double Gifts: the coin asked for as the rewarded ad closes', () => {
  it('plays once the moment the parked context runs again; nothing the ad cut plays after it', () => {
    const { eng, ctx, built } = rig();
    run(ctx, 200);
    // The card opens; Double Gifts is pressed 300 ms in and the ad mutes for 2.2 s.
    eng.cueResults(cardShow, RESULTS_TIMING, false);
    run(ctx, 300);
    eng.setMuted('ad', true);
    run(ctx, 1000);
    expect(ctx.state).toBe('suspended');
    wait(1200);
    const before = built.length;
    const resumes = ctx.resumes;
    // The ad closes: the unmute asks the context to resume, then the re-render lands both rewards and
    // the doubled reward asks for its coin 17 ms later, all before the context runs again.
    eng.setMuted('ad', false);
    expect(ctx.resumes).toBe(resumes + 1);
    eng.ui('coin', 0);
    eng.ui('coin', 1);
    wait(17);
    eng.ui('coin');
    // Nothing is built into the parked context.
    expect(built.length).toBe(before);
    // It runs 55 ms after the unmute: one coin, 6 ms ahead on its clock (its first block).
    wait(38);
    ctx.running();
    const coins = built.slice(before);
    expect(coins.map((b) => b.name)).toEqual(['coin']);
    expect(coins[0].t).toBeCloseTo(ctx.currentTime + 0.006, 6);
    // Two seconds on, nothing of the cut card has played.
    run(ctx, 2500);
    expect(built.slice(before)).toEqual(coins);
  });

  it('a resume that comes too late drops the coin instead of playing it out of its moment', () => {
    const { eng, ctx, built } = rig();
    run(ctx, 100);
    eng.setMuted('ad', true);
    run(ctx, 1100);
    eng.setMuted('ad', false);
    eng.ui('coin');
    // A loaded phone takes 1.4 s to resume.
    wait(1400);
    const before = built.length;
    ctx.running();
    run(ctx, 500);
    expect(built.length).toBe(before);
  });

  it('a timeline asked for while it resumes keeps what is still ahead on time; the overdue part is one sound', () => {
    const { eng, ctx, built } = rig();
    run(ctx, 100);
    eng.setMuted('ad', true);
    run(ctx, 1100);
    eng.setMuted('ad', false);
    // Run Again's ad closes into a reveal: its reel ticks and slam are asked for at once.
    eng.cueReveal({ T_REEL: 80, REEL_MS: 660, T_STAMP: 740 }, false);
    wait(600);
    const before = built.length;
    ctx.running();
    const now = ctx.currentTime;
    const got = built.slice(before);
    // The ticks due before the resume land as one tick now; the slam keeps its 740 ms.
    expect(got.filter((b) => b.name === 'reveal-tick' && Math.abs(b.t - (now + 0.006)) < 0.002)).toHaveLength(1);
    run(ctx, 400);
    const slam = built.slice(before).filter((b) => b.name === 'reveal-land');
    expect(slam).toHaveLength(1);
    expect(slam[0].t - now).toBeCloseTo(0.14 + 0.006, 2);
  });

  it('past the resume grace a context still parked drops the sound', () => {
    const { eng, ctx, built } = rig();
    run(ctx, 100);
    eng.setMuted('ad', true);
    run(ctx, 1100);
    expect(ctx.state).toBe('suspended');
    eng.setMuted('ad', false);
    wait(700);
    const before = built.length;
    eng.ui('coin');
    ctx.running();
    expect(built.length).toBe(before);
  });

  it("the Revive ad's revive plays as the context runs again; the frames around it stay dropped", () => {
    const { eng, ctx } = rig();
    run(ctx, 100);
    eng.setMuted('ad', true);
    run(ctx, 1100);
    eng.setMuted('ad', false);
    const sfx = (eng as unknown as { core: { sfx: { event: (e: { type: string }, t: number) => void } } }).core.sfx;
    const events: string[] = [];
    sfx.event = (e) => void events.push(e.type);
    wait(16);
    eng.simEvent({ type: 'revive' });
    wait(16);
    eng.simEvent({ type: 'light', id: 1, value: 1, gain: 6, x: 0, y: 0, z: 0 });
    expect(events).toEqual([]);
    wait(30);
    ctx.running();
    expect(events).toEqual(['revive']);
    // Too late a resume drops it.
    eng.setMuted('ad', true);
    run(ctx, 1100);
    eng.setMuted('ad', false);
    eng.simEvent({ type: 'revive' });
    wait(1200);
    ctx.running();
    expect(events).toEqual(['revive']);
  });

  it('run sounds are not stacked into the parked context while it resumes', () => {
    const { eng, ctx } = rig();
    run(ctx, 100);
    eng.setMuted('ad', true);
    run(ctx, 1100);
    eng.setMuted('ad', false);
    const sfx = (eng as unknown as { core: { sfx: { event: (e: unknown, t: number) => void } } }).core.sfx;
    const events: number[] = [];
    sfx.event = (_e, t) => void events.push(t);
    for (let k = 0; k < 4; k++) {
      eng.simEvent({ type: 'light', id: k, value: 1, gain: 6, x: 0, y: 0, z: 0 });
      wait(16);
    }
    expect(events).toEqual([]);
    ctx.running();
    eng.simEvent({ type: 'light', id: 9, value: 1, gain: 6, x: 0, y: 0, z: 0 });
    expect(events).toHaveLength(1);
  });

  it('muted, nothing is built; a mute inside the grace closes it at once', () => {
    const { eng, ctx, built } = rig();
    run(ctx, 100);
    eng.setMuted('ad', true);
    run(ctx, 1100);
    eng.setMuted('ad', false);
    eng.setMuted('hidden', true);
    const before = built.length;
    eng.ui('coin');
    eng.ui('mission', 0);
    expect(built.length).toBe(before);
  });

  it('an unmute outside a gesture on a context that never ran keeps nothing for a later tap', () => {
    StubCtx.startState = 'suspended';
    const eng = new AudioEngine();
    engine = eng;
    eng.setMuted('sdk', true);
    // The first tap: the context is created and asked to start, but the browser keeps it parked.
    eng.unlock();
    const ctx = StubCtx.last!;
    const sfx = (eng as unknown as { core: { sfx: { uiNow: (n: string, d: number, t: number) => void } } }).core.sfx;
    const built: string[] = [];
    sfx.uiNow = (n) => void built.push(n);
    wait(1500);
    expect(ctx.state).toBe('suspended');
    // The SDK unmutes with no gesture: nothing is scheduled into a context that cannot start.
    eng.setMuted('sdk', false);
    eng.ui('coin');
    eng.ui('confirm');
    expect(built).toEqual([]);
  });
});

describe('Done chimes played from the stamp (UIHandlers.onMissionStamp)', () => {
  it('with missions: [] the card leaves none on its timeline; each stamp sounds at once', () => {
    const { eng, ctx, built } = rig();
    run(ctx, 200);
    eng.cueResults({ ...cardShow, missions: [] }, RESULTS_TIMING, false);
    // Through the whole card nothing chimes on the cue timeline.
    run(ctx, RESULTS_TIMING.DONE_MS - 10);
    expect(built.some((b) => b.name === 'mission')).toBe(false);
    // The stamp of row 0 starts: its chime is made in that call, 6 ms ahead (the next audio block).
    const at = ctx.currentTime;
    eng.ui('mission', 0);
    const chime = built.filter((b) => b.name === 'mission');
    expect(chime).toHaveLength(1);
    expect(chime[0].t).toBeCloseTo(at + 0.006, 6);
    // Row 1's stamp, DONE_STEP later, is its own chime.
    run(ctx, RESULTS_TIMING.DONE_STEP);
    eng.ui('mission', 1);
    expect(built.filter((b) => b.name === 'mission')).toHaveLength(2);
    // And the rest of the card still has no chime of its own.
    run(ctx, 2000);
    expect(built.filter((b) => b.name === 'mission')).toHaveLength(2);
  });

  it('two asks for the same moment a frame or two apart are one chime (and one coin)', () => {
    const { eng, ctx, built } = rig();
    run(ctx, 200);
    // A reduced-motion card plays its one chime from the timeline at 0 while a stamp asks two frames on.
    eng.cueResults({ count: false, newBest: false, beats: 0, missions: [0, 1], coins: [] }, RESULTS_TIMING, true);
    run(ctx, 33);
    eng.ui('mission', 0);
    eng.ui('mission', 1);
    expect(built.filter((b) => b.name === 'mission')).toHaveLength(1);
    // The re-render's landing coin and the doubled reward's 17 ms later: one coin.
    eng.ui('coin', 0);
    run(ctx, 17);
    eng.ui('coin');
    expect(built.filter((b) => b.name === 'coin')).toHaveLength(1);
  });
});

// Round 7, the wire lane: the beats nobody listened to (the legend, the slow hero frame), the new verbs'
// steps, the forge gate's roar and a bell's swing, and the clock the reel cuts on.
describe('round 7 cues: every beat a set piece or a legend sends is heard', () => {
  const B = { tick: 0 };
  const moment = (verb: string, phase: string, n: number, of: number): Beat => ({ ...B, type: 'moment', key: 'k', verb, phase, n, of }) as unknown as Beat;
  const legend = (phase: 'warn' | 'start' | 'step' | 'end', n = 0): Beat => ({ ...B, type: 'legend', phase, key: 'stag', name: 'The White Stag', line: 'l', kind: 'runner', side: 1, n });
  const hero = (phase: 'lip' | 'apex' | 'out'): Beat => ({ ...B, type: 'heroFrame', phase, key: 'leap', inS: 0.8, secs: 0.9 });
  const riding = (): { eng: AudioEngine; ctx: StubCtx } => {
    const { eng, ctx } = rig();
    eng.setScene('run');
    run(ctx, 300);
    return { eng, ctx };
  };

  it('a legend has a cue as it is said, as it starts, on a ribbon’s quarters and as it is left', () => {
    const { eng, ctx } = riding();
    eng.beats([legend('warn')]);
    run(ctx, 100);
    eng.beats([legend('start')]);
    eng.beats([legend('step', 1), legend('step', 2)]);
    eng.beats([legend('end', 2)]);
    expect(eng.debugCues()).toMatchObject({ 'legend.warn': 1, 'legend.start': 1, 'legend.step': 2, 'legend.end': 1 });
  });

  it('the slow hero frame takes a breath off the lip and holds it at the apex; its end is the landing’s', () => {
    const { eng, ctx } = riding();
    eng.beats([hero('lip')]);
    run(ctx, 800);
    eng.beats([hero('apex')]);
    run(ctx, 900);
    eng.beats([hero('out')]);
    const c = eng.debugCues();
    expect(c['heroFrame.lip']).toBe(1);
    expect(c['heroFrame.apex']).toBe(1);
    expect(c['heroFrame.out']).toBeUndefined();
  });

  it('each new verb’s steps sound: a bell rung, a lamp lit, the wake, the glass, the low flame', () => {
    const { eng, ctx } = riding();
    eng.beats([moment('shatter', 'step', 1, 3)]);
    run(ctx, 50);
    eng.beats([moment('shatter', 'step', 2, 3), moment('kindle', 'step', 1, 6), moment('follow', 'step', 3, 8), moment('slide', 'step', 2, 4)]);
    // The flame says nothing as it burns down, until it is low.
    for (const n of [9, 8, 4]) eng.beats([moment('carry', 'step', n, 10)]);
    expect(eng.debugCues()['carry.low']).toBeUndefined();
    for (const n of [3, 2, 1]) eng.beats([moment('carry', 'step', n, 10)]);
    eng.beats([moment('carry', 'trail', 4, 10), moment('carry', 'lead', 4, 10), moment('carry', 'close', 6, 10), moment('follow', 'lead', 2, 8)]);
    expect(eng.debugCues()).toMatchObject({ 'shatter.step': 2, 'kindle.step': 1, 'follow.step': 1, 'slide.step': 1, 'carry.low': 3, 'carry.trail': 1, 'carry.lead': 1, 'carry.close': 1, 'follow.lead': 1 });
  });

  it('the forge gate roars for a sled off the lip at the speed asked, and gutters for a slower one', () => {
    const { eng } = riding();
    // The surge's step carries the speed off the lip (whole m/s) against the speed its far line wants.
    eng.beats([moment('surge', 'step', 43, 44)]);
    expect(eng.debugCues()).toMatchObject({ 'surge.gutter': 1 });
    eng.beats([moment('surge', 'step', 44, 44)]);
    eng.beats([moment('surge', 'step', 51, 47)]);
    expect(eng.debugCues()).toMatchObject({ 'surge.gutter': 1, 'surge.roar': 2 });
  });

  it('a set piece’s card calls its verb (the produced stinger when the score is playing, the live call here)', () => {
    const { eng } = riding();
    for (const verb of ['race', 'gates', 'rings', 'collapse', 'steps', 'slide', 'shatter', 'surge', 'flourish', 'follow', 'kindle', 'carry']) {
      eng.beats([{ ...B, type: 'marquee', phase: 'enter', key: verb, name: verb, verb, line: '', cam: 'wide', light: 'none', side: 1, took: 0, total: 0, clean: true, won: false } as unknown as Beat]);
      const c = eng.debugCues();
      expect((c[`call.${verb}`] ?? 0) + (c[`stinger.${verb}`] ?? 0), verb).toBe(1);
    }
  });
});

describe('the score’s clock (the reel cuts on it)', () => {
  it('is null before there is a context, then says a bar, a beat and how far off the next of each is', () => {
    const cold = new AudioEngine();
    expect(cold.clock()).toBeNull();
    cold.dispose();
    const { eng, ctx } = rig();
    eng.setScene('run');
    run(ctx, 400);
    const c = eng.clock();
    expect(c).not.toBeNull();
    expect(c!.barS).toBeGreaterThan(1);
    expect(c!.barS).toBeLessThan(6);
    expect(c!.barS / c!.beatS).toBeCloseTo(4, 6);
    expect(c!.toBar).toBeGreaterThan(0);
    expect(c!.toBar).toBeLessThanOrEqual(c!.barS + 1e-9);
    expect(c!.toBeat).toBeLessThanOrEqual(c!.beatS + 1e-9);
    // The line comes nearer as the clock runs, by exactly the time that passed.
    run(ctx, 100);
    const d = eng.clock()!;
    const gone = (c!.toBeat - d.toBeat + c!.beatS) % c!.beatS;
    expect(gone).toBeCloseTo(0.1 % c!.beatS, 3);
  });

  it('a cut waits for the bar line when one is near, else for the beat, and never without a clock', () => {
    expect(cutHold(null)).toBe(0);
    expect(cutHold({ toBar: 0.4, toBeat: 0.4 })).toBe(0.4);
    expect(cutHold({ toBar: 1.6, toBeat: 0.1 })).toBe(0.1);
    expect(cutHold({ toBar: 1.9, toBeat: 0.45 })).toBe(0.45);
    // A beat too slow to wait for (a very slow piece): the cut falls as its card ends.
    expect(cutHold({ toBar: 3, toBeat: 1.2 })).toBe(0);
  });
});

describe('an FM bell too high for its modulator', () => {
  /** A voice that only counts what is asked of it. */
  const voice = (sampleRate: number): { v: Voice; freqs: number[] } => {
    const freqs: number[] = [];
    const node = (): Node => new Node();
    const v = { ctx: { sampleRate }, out: node(), envelope: node, gain: node, osc: (_w: string, f: number) => (freqs.push(f), node()) } as unknown as Voice;
    return { v, freqs };
  };

  it('never asks an oscillator for a frequency past Nyquist (the browser clamps it, with a console warning)', () => {
    // The warning seen in round 7: a gate's bell an octave up, 7,685 Hz at ratio 3.5, is a 26.9 kHz modulator.
    for (const sr of [44100, 48000]) {
      for (const f of [440, 3842.5, 5200, 7685, 9000]) {
        const { v, freqs } = voice(sr);
        fmBell(v, 0, f, 0.05, 0.5, 3.5, 1.1);
        expect(freqs[0]).toBe(f);
        for (const q of freqs) expect(q, `${f} Hz at ${sr}`).toBeLessThan(sr / 2);
      }
    }
    // An ordinary bell keeps its modulator.
    const { v, freqs } = voice(48000);
    fmBell(v, 0, 880, 0.05, 0.5, 3.5, 1.1);
    expect(freqs).toEqual([880, 3080]);
  });
});
