import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../src/audio/engine';
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
    eng.simEvent({ type: 'gift', id: 1, value: 1, x: 0, y: 0, z: 0 });
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
      eng.simEvent({ type: 'gift', id: k, value: 1, x: 0, y: 0, z: 0 });
      wait(16);
    }
    expect(events).toEqual([]);
    ctx.running();
    eng.simEvent({ type: 'gift', id: 9, value: 1, x: 0, y: 0, z: 0 });
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
