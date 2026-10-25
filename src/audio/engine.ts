import { ChaosEvent, Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import type { SimEvent } from '../sim/sim';
import { Core } from './core';
import type { Scene } from './music';

/*
 * Ghost Sled audio: fully procedural WebAudio. No files, no fetches; every sound is synthesized.
 *
 * Signal graph
 *
 *   one-shot voices (sfx pool, 24) ---dry---> sfx.dry ----> duck -> level ---------+
 *                                  \--send-> sfx.wet ----> duck -> level --+      |
 *   ambience (wind, snow, hum, rumble) -----> sfx.dry / sfx.wet            |      |
 *                                                                          v      |
 *   music decks (music pool, 32)                                    ConvolverNode |
 *     layer faders: pad bass arp kick hat clap sparkle lead tension     (noise IR,|
 *       -> deck crossfade ----> music.dry -> duck -> level ---------+   1.9 s RT) |
 *       -> layer sends -> xf -> music.wet -> duck -> level -> conv  |      |      |
 *                                                                   |   HP 220 Hz |
 *                                                                   |   LP 7.5 kHz|
 *                                                                   v      v      v
 *                                          master gain (volume) <-----------------+
 *                                               -> mute gain (stackable reasons, 12 ms ramp)
 *                                               -> DynamicsCompressor (gentle limiter)
 *                                               -> ceiling trim (absorbs the compressor's makeup gain)
 *                                               -> destination
 *
 * - Buses: "level" is the user's volume (squared slider curve), "duck" dips music under crashes,
 *   stingers and big rewards. Both buses feed one shared reverb.
 * - Buffers (white/pink/brown stereo noise, grain train, sleigh bell, impulse) are generated once
 *   per context in buffers.ts. Events never allocate large buffers.
 * - Ambience (ambience.ts) is a fixed graph built once; update() only retargets parameters with
 *   setTargetAtTime, and only when they moved enough to matter. A branch whose gain has sat at
 *   zero for 2 s (or 8 fade time constants, if longer) is unplugged from its noise source so it
 *   stops costing DSP.
 * - One-shots (sfx.ts) are voices in a capped pool: past 24 the oldest fades in 5 ms, and finished
 *   voices are disconnected by the scheduler sweep. Parts of a sound starting more than 80 ms
 *   ahead (shimmers, arpeggio tails) are built by a later scheduler pass, so big rewards spread
 *   their node creation over several frames.
 * - Music (music.ts): a lookahead scheduler (25 ms timer, 0.12 s ahead on AudioContext time)
 *   steps 16th notes. A deck is one arrangement (scene + mood + biome); any change starts a new
 *   deck and crossfades over 1.5 s. Intensity fades layers in: 0 pad, 0.4 bass + hats, 0.7 arp +
 *   kick, 0.9 everything + lead. Danger adds a pulsing low root. The music pool (32) steals the
 *   oldest non-pad voice, so the pad bed is never cut mid-chord; skipped steps (a stalled timer,
 *   music volume at zero) rebuild the missing pad.
 * - Harmony (theory.ts): every reward note comes from the playing deck's pentatonic ladder, and the
 *   reward chord is a major add9 made of those same tones, so rewards never clash with the music.
 * - Filters automate at k-rate (once per 128 samples); a-rate biquad automation recomputes
 *   coefficients per sample and costs several times more.
 * - Levels (offline renders, sliders at 1): pad alone about -27 dBFS RMS, full arrangement about
 *   -21, cruising ambience -33, full speed -25, style notes peak near -22, the busiest stress mix
 *   peaks at -3 dBFS after the limiter.
 * - Muting: any reason muted silences output; after 1 s fully muted the context is suspended to
 *   save CPU and resumed on unmute. All calls are no-ops before unlock() or without WebAudio.
 */

export interface AudioFrame {
  speed: number; // horizontal m/s: cruise ~22, boosted up to ~46, 0 when stopped
  grounded: boolean;
  carve: number; // 0..1 groove depth (hard carving)
  drifting: boolean;
  slip: number; // radians, |slip| up to ~0.9 while drifting
  onIce: boolean;
  boostGlow: number; // 0..1 while a boost is being applied
  drafting: boolean; // in a ghost's slipstream
  comboChain: number; // current combo chain length, 0 = no combo
  comboMult: number; // 1..10
  intensity: number; // 0..1 musical intensity computed by the game (speed, combo, danger)
  danger: number; // 0..1 tension (avalanche closing in, yeti near)
  crashed: boolean;
}

export type UiSound =
  | 'tap'
  | 'confirm'
  | 'back'
  | 'reveal-tick'
  | 'reveal-land'
  | 'warn'
  | 'ghost-pass'
  | 'ghost-passed-you'
  | 'new-best'
  | 'mission'
  | 'unlock'
  | 'go'
  | 'results-stamp'
  | 'coin';

type MuteReason = 'sdk' | 'ad' | 'hidden' | 'user';

const TICK_MS = 25;
const LOOKAHEAD = 0.12;
const SUSPEND_AFTER_MS = 1000;
/** A tiny lead so attacks are never scheduled in the past. */
const START_LEAD = 0.006;

const clamp01 = (v: number): number => (v > 0 ? (v < 1 ? v : 1) : 0);
/** Old webkit contexts return undefined from resume/suspend/close; newer ones may reject. */
const quiet = (p: Promise<unknown> | undefined): void => {
  if (p) p.catch(() => undefined);
};
const clockMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

type AudioContextCtor = new (options?: AudioContextOptions) => AudioContext;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private core: Core | null = null;
  private disposed = false;
  private unavailable = false;
  private primed = false;
  /** The context has been seen running at least once. */
  private started = false;
  private warned = false;
  private readonly mutes = new Set<MuteReason>();
  private volumes = { master: 1, music: 1, sfx: 1 };
  private scene: Scene = 'title';
  private mood: Mood = Mood.None;
  private biome: BiomeId = 'alpine';
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  /** Until this clock time a just-requested resume still accepts sounds (they play on resume). */
  private resumeUntil = 0;
  private intensity = 0;
  private avalanche = false;

  get ready(): boolean {
    return !this.disposed && this.core !== null && this.ctx !== null && this.ctx.state === 'running';
  }

  /** Call inside a user gesture (pointerdown / keydown / touchend). Creates or resumes the AudioContext. Safe to call repeatedly (also re-resumes after iOS interruptions). */
  unlock(): void {
    if (this.disposed || this.unavailable) return;
    try {
      if (!this.ctx && !this.create()) return;
      const ctx = this.ctx;
      if (!ctx) return;
      if (ctx.state === 'running') this.started = true;
      // iOS only lets a context start inside a gesture, so a context that has never run is
      // started here even while muted (the mute gain keeps it silent and the suspend timer
      // parks it again); otherwise a later unmute, which comes without a gesture, could not
      // start it.
      let resumed = false;
      if (ctx.state !== 'running' && (this.mutes.size === 0 || !this.started)) {
        this.resumeUntil = clockMs() + 600;
        quiet(ctx.resume());
        resumed = true;
        if (this.mutes.size > 0) this.armSuspend();
      }
      // Only when resuming: on a context left suspended (muted) a primer never plays, so one per
      // tap would pile up for the whole muted run.
      if (!this.primed || resumed) this.prime(ctx);
    } catch (err) {
      this.warn(err);
    }
  }

  setVolumes(v: { master: number; music: number; sfx: number }): void {
    this.volumes = { master: clamp01(v.master), music: clamp01(v.music), sfx: clamp01(v.sfx) };
    this.applyVolumes(false);
  }

  /** Stackable hard mute. Any reason muted => output silent (fast ramp). Reasons: 'sdk' (CrazyGames muteAudio), 'ad', 'hidden' (tab hidden), 'user'. When fully muted for more than 1 s, suspend the context to save CPU; resume on unmute. */
  setMuted(reason: MuteReason, muted: boolean): void {
    const before = this.mutes.size > 0;
    if (muted) this.mutes.add(reason);
    else this.mutes.delete(reason);
    if (before !== this.mutes.size > 0) this.applyMute();
  }

  setScene(scene: Scene): void {
    this.scene = scene;
    if (scene === 'run') {
      this.intensity = 0;
      this.avalanche = false;
    }
    const c = this.core;
    const ctx = this.ctx;
    if (!c || !ctx) return;
    try {
      if (scene === 'run') c.sfx.reset();
      c.music.setTarget(this.scene, this.mood, this.biome);
      c.music.setDrive(this.intensity, 0, 1);
      c.ambience.setScene(scene, ctx.currentTime);
    } catch (err) {
      this.warn(err);
    }
  }

  setMood(mood: Mood, biome: BiomeId): void {
    this.mood = mood;
    this.biome = biome;
    this.core?.music.setTarget(this.scene, this.mood, this.biome);
  }

  /** Called every render frame during a run. */
  update(frame: AudioFrame, dt: number): void {
    const ctx = this.ctx;
    const c = this.core;
    if (!ctx || !c || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const d = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.25) : 0;
      // Rise quickly with the action, fall back slowly so the arrangement does not flap.
      const target = clamp01(frame.intensity);
      const tau = target > this.intensity ? 0.7 : 2.2;
      this.intensity += (target - this.intensity) * (1 - Math.exp(-d / tau));
      c.music.setDrive(this.intensity, clamp01(frame.danger), frame.comboMult || 1);
      c.ambience.update(frame, now, this.avalanche, c.music.key().tonic);
    } catch (err) {
      this.warn(err);
    }
  }

  /** Called for every sim event during a run. */
  simEvent(e: SimEvent): void {
    // Chaos bookkeeping happens even while muted, so the avalanche rumble is right on unmute.
    if (e.type === 'chaos' && e.event === ChaosEvent.Avalanche) {
      if (e.phase === 'start') this.avalanche = true;
      else if (e.phase === 'success' || e.phase === 'end') this.avalanche = false;
    } else if (e.type === 'revive' || e.type === 'crash') this.avalanche = false;
    const ctx = this.ctx;
    const c = this.core;
    if (!ctx || !c || !this.live(ctx)) return;
    try {
      const now = ctx.currentTime;
      c.sfx.event(e, now + START_LEAD);
      const duck = c.graph.music;
      switch (e.type) {
        case 'crash':
          duck.duck(0.3, now, 0.7, 0.9);
          break;
        case 'land':
          if (e.quality === 'perfect') duck.duck(0.62, now, 0.18, 0.25);
          break;
        case 'chaos':
          if (e.phase === 'warn') duck.duck(0.55, now, e.event === ChaosEvent.Avalanche ? 2.8 : 1.4, 0.6);
          else if (e.phase === 'success') duck.duck(0.5, now, 1, 0.6);
          break;
        case 'comboBank':
          if (e.points >= 2000) duck.duck(0.75, now, 0.3, 0.3);
          break;
        case 'revive':
          duck.duck(0.6, now, 0.8, 0.5);
          break;
        default:
          break;
      }
    } catch (err) {
      this.warn(err);
    }
  }

  /** detail: e.g. ghost-pass count this run, mission index. */
  ui(name: UiSound, detail?: number): void {
    const ctx = this.ctx;
    const c = this.core;
    if (!ctx || !c || !this.live(ctx)) return;
    try {
      const now = ctx.currentTime;
      c.sfx.ui(name, detail ?? 0, now + START_LEAD);
      if (name === 'new-best' || name === 'unlock') c.graph.music.duck(0.6, now, 0.9, 0.5);
    } catch (err) {
      this.warn(err);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer !== null) clearInterval(this.timer);
    if (this.suspendTimer !== null) clearTimeout(this.suspendTimer);
    this.timer = null;
    this.suspendTimer = null;
    try {
      this.core?.dispose();
    } catch {
      // Tearing down: nothing useful to do.
    }
    if (this.ctx) quiet(this.ctx.close());
    this.core = null;
    this.ctx = null;
  }

  // ---------------------------------------------------------------- internals

  private create(): boolean {
    const g = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) {
      this.unavailable = true;
      return false;
    }
    let ctx: AudioContext;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      try {
        ctx = new Ctor();
      } catch {
        this.unavailable = true;
        return false;
      }
    }
    let core: Core;
    try {
      core = new Core(ctx);
    } catch (err) {
      this.warn(err);
      quiet(ctx.close());
      this.unavailable = true;
      return false;
    }
    this.ctx = ctx;
    this.core = core;
    this.applyVolumes(true);
    core.graph.mute.gain.value = this.mutes.size > 0 ? 0 : 1;
    core.music.setTarget(this.scene, this.mood, this.biome);
    core.ambience.setScene(this.scene, ctx.currentTime);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    if (this.mutes.size > 0) this.applyMute();
    return true;
  }

  private tick(): void {
    const ctx = this.ctx;
    const c = this.core;
    if (!ctx || !c || ctx.state !== 'running') return;
    this.started = true;
    try {
      c.tick(ctx.currentTime, LOOKAHEAD);
    } catch (err) {
      this.warn(err);
    }
  }

  /** iOS only routes WebAudio to the speaker after a buffer starts inside a gesture. */
  private prime(ctx: AudioContext): void {
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.onended = () => s.disconnect();
    s.start(0);
    this.primed = true;
  }

  /** One-shots are skipped while muted (silent anyway, and they would pile up in a suspended
   *  context). Right after unlock() asks to resume, they are kept: they play as it starts. */
  private live(ctx: AudioContext): boolean {
    if (this.mutes.size > 0) return false;
    return ctx.state === 'running' || clockMs() < this.resumeUntil;
  }

  private applyVolumes(immediate: boolean): void {
    const c = this.core;
    const ctx = this.ctx;
    if (!c || !ctx) return;
    // Start from the settled values on creation, ramp afterwards.
    const now = immediate ? 0 : ctx.currentTime;
    c.graph.setMaster(this.volumes.master, now);
    c.graph.music.setLevel(this.volumes.music, now);
    c.graph.sfx.setLevel(this.volumes.sfx, now);
    c.music.enabled = this.volumes.music > 0.001;
  }

  private applyMute(): void {
    const ctx = this.ctx;
    const c = this.core;
    if (!ctx || !c) return;
    const muted = this.mutes.size > 0;
    try {
      c.graph.setMuted(muted, ctx.currentTime);
      if (muted) {
        c.sfx.clearPending();
        this.armSuspend();
      } else {
        this.clearSuspend();
        // Unconditional: a suspend() requested a moment ago can still report 'running' until it
        // settles, and resume() queued after it wins. On a running context it is a no-op.
        quiet(ctx.resume());
      }
    } catch (err) {
      this.warn(err);
    }
  }

  private clearSuspend(): void {
    if (this.suspendTimer === null) return;
    clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
  }

  /** Suspends the context after it has stayed muted for SUSPEND_AFTER_MS. */
  private armSuspend(): void {
    this.clearSuspend();
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      if (this.ctx && this.mutes.size > 0 && this.ctx.state === 'running') quiet(this.ctx.suspend());
    }, SUSPEND_AFTER_MS);
  }

  private warn(err: unknown): void {
    if (this.warned) return;
    this.warned = true;
    console.warn('[audio] disabled part of the sound after an error', err);
  }
}
