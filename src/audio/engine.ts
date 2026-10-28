import { ChaosEvent, Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import type { SimEvent } from '../sim/sim';
import type { Beat } from '../game/beats';
import { START_TICKS } from '../game/race';
import { Core } from './core';
import { type ResultsCue, type ResultsShow, type RevealCue, choirSize, grooveLift, resultsCues, revealCues } from './cues';
import type { Scene } from './music';
import { bankLandDelay } from './sfx';

export type { ResultsCue, ResultsShow, RevealCue } from './cues';

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
 *                                               -> DynamicsCompressor (fast limiter for stacked peaks)
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
 *   deck and crossfades over 1.5 s. The drive fades layers in: the pad always, the bass from 0.26
 *   (the run floor of 0.30 holds it from 2.5 s), hats from 0.30 (cruising sits at 0.36), the arp
 *   from 0.48 and the kick from 0.54, clap and sparkle from 0.72, the lead from 0.82. Danger adds a
 *   pulsing low root. The music pool (32) steals the oldest non-pad voice, so the pad bed is never
 *   cut mid-chord; skipped steps (a stalled timer, music volume at zero) rebuild the missing pad.
 * - The drive: the engine takes the game's intensity (src/game/intensity.ts), adds the groove (a
 *   stomp streak holds it up: +0.06 at 2 in a row up to +0.18 at 5), smooths it (rise 0.7 s, fall
 *   2.2 s), holds it at 0.25 under a chaos reveal and snaps the band in as the card collapses, and
 *   adds short accents on top (a big callout, a stomp that grows with the streak, a tier-3 drift
 *   crack, a big bank on its landing, a kilometre) that fade within 1.5 s. Drafting earns none of
 *   it: a draft boost with the pack peaks under the arp.
 * - Beats (src/game/beats.ts) arrive before the frame's raw sim events: sfx.ts voices every named
 *   moment (pass words, chimes, stings, the bank roll and drop) and keeps the context the raw
 *   sounds read (the stomp streak, a near miss's side and grade). Grid pulses (the fuse on a big
 *   draining stake, the duel heartbeat, the km bell) are quantised to the playing deck's 16ths.
 * - Harmony (theory.ts): every reward note comes from the playing deck's pentatonic ladder, and the
 *   reward chord is a major add9 made of those same tones, so rewards never clash with the music.
 *   On Clear Skies each mountain has its own song, A A B B in one 16-bar deck loop (no crossfade).
 * - The ghost choir (music.ts): each ghost you pass joins the band as a sung voice on the chord
 *   (up to three, in the music pool, kept like the pad) while it stays riding within 150 m behind
 *   you (AudioFrame.choir, the director's count; without it a 30 s time to live stands in); a retake
 *   sighs the top voice down a fourth, a wipeout or the crash ends it. The stress mix sings all
 *   three: the music pool peaks at 29 of 32 with no steals.
 * - Timelines the picture keeps (cues.ts, pure): a bank's roll ticks on the HUD's count steps
 *   (src/game/stake.ts), the results card on RESULTS_TIMING and the reveal reel on REVEAL_TIMING.
 *   The same UI sound asked for twice at one moment plays once.
 * - Filters automate at k-rate (once per 128 samples); a-rate biquad automation recomputes
 *   coefficients per sample and costs several times more.
 * - Levels (offline renders, sliders at 1; scripts/playtest/levels.js): a novice cruise about -25
 *   dBFS RMS (peaks near -12), its ambience alone -33, full arrangement about -21, style notes
 *   peak near -22, and the stress mix (everything at once, a reward burst every 0.25 s) peaks near
 *   -5 dBFS after the limiter.
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
  // Feel inputs, filled by the director (all optional; absent reads as none).
  flow?: number; // 0..1 earned flow, display-capped
  driftCharge?: number; // 0..1 drift charge while drifting
  skillMult?: number; // 1..10 skill multiplier of the live combo
  race?: number; // 0..1 race closeness
  duel?: number; // 0..1 an open duel's tension, 0 when none
  shoulder?: { amt: number; pan: number } | null; // a ghost at your shoulder: level and pan
  fuse?: number; // 0..1 fuse on a big draining stake
  streak?: number; // current stomp streak
  countIn?: boolean; // the run-start reveal is up (chaos runs): intensity is held low
  choir?: number; // 0..3 ghosts you passed still riding within 150 m behind (absent: the TTL proxy)
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
  | 'coin'
  | 'results-tick'
  | 'results-mallet';

type MuteReason = 'sdk' | 'ad' | 'hidden' | 'user';

const TICK_MS = 25;
const LOOKAHEAD = 0.12;
const SUSPEND_AFTER_MS = 1000;
/** A tiny lead so attacks are never scheduled in the past. */
const START_LEAD = 0.006;
/** The count-in: the drive is held to this while a chaos reveal is up (matches intensity.ts). */
const COUNT_IN_MAX = 0.25;
/** As the reveal card collapses the band snaps in at cruise level (bass and hats) and holds there
 *  for a few seconds while the run picks up speed. */
const COUNT_IN_RELEASE = 0.36;
const COUNT_IN_HOLD_S = 3;
/** Accents: added on top of the smoothed drive and fading with this time constant (gone in 1.5 s). */
const ACCENT_TAU = 0.5;
const ACCENT_MAX = 0.2;
/** The ghost choir without the director's count (AudioFrame.choir absent): a ghost you passed
 *  sings for this long, standing in for 'still live within 150 m behind' (a retake, a wipeout or
 *  the crash ends it sooner). */
const CHOIR_TTL_S = 30;
/** A retake's sigh waits this long (s) for the director's count to drop; past it (a full choir,
 *  more ghosts behind than voices) the top voice sighs and refills anyway. */
const RETAKE_WAIT_S = 0.25;
/** The shoulder hiss waits out the start-line jostle (race.ts START_TICKS: the pack sits right
 *  behind you and passes say nothing), then fades in over a second. */
const SHOULDER_FROM_S = START_TICKS / 60;

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
  /** The smoothed drive, the frame's target, and the accent on top (probes read all three). */
  private intensity = 0;
  private target = 0;
  private accent = 0;
  private readonly accents: Array<{ at: number; amt: number }> = [];
  /** The count-in seen last frame, and until when its release holds the band in. */
  private countIn = false;
  private releaseUntil = 0;
  private avalanche = false;
  /** The ghost choir: ghosts you passed that have not passed you back (id to the time of the pass);
   *  without the director's count (AudioFrame.choir) it is also the count, with a time to live. */
  private readonly passed = new Map<number, number>();
  /** The choir size last applied, whether the frame carries the director's count, and when a
   *  passed ghost last retook you (-1: none waiting for its sigh). */
  private choirN = 0;
  private choirFromFrame = false;
  private retakeAt = -1;
  /** The groove lift in this frame's target (probe). */
  private groove = 0;
  /** Seconds of run (real time, crashes excluded) since the run scene began. */
  private runT = 0;

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
      this.target = 0;
      this.accent = 0;
      this.accents.length = 0;
      this.countIn = false;
      this.releaseUntil = 0;
      this.avalanche = false;
      this.groove = 0;
      this.runT = 0;
    }
    this.passed.clear();
    this.choirN = 0;
    this.retakeAt = -1;
    const c = this.core;
    const ctx = this.ctx;
    if (!c || !ctx) return;
    try {
      if (scene === 'run') c.sfx.reset();
      c.music.setChoir(0, ctx.currentTime);
      c.pulse.fuse = 0;
      c.pulse.duel = 0;
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
      const crashed = frame.crashed === true;
      const countIn = frame.countIn === true && !crashed;
      // A crash lets the band deflate to the pad; the results deck takes over soon after.
      let target = crashed ? 0 : clamp01(frame.intensity);
      if (countIn) target = Math.min(target, COUNT_IN_MAX);
      let snap = false;
      if (this.countIn && !countIn && !crashed) {
        // The reveal card collapses: the band arrives on it, past the 0.7 s rise.
        this.releaseUntil = now + COUNT_IN_HOLD_S;
        this.intensity = Math.max(target, COUNT_IN_RELEASE);
        snap = true;
      }
      this.countIn = countIn;
      if (now < this.releaseUntil && !crashed) target = Math.max(target, COUNT_IN_RELEASE);
      // The groove: a stomp streak (earned, never by drafting) holds the band up a layer at a time
      // for as long as it lives, and lets it down slowly when it breaks.
      this.groove = crashed || countIn ? 0 : grooveLift(frame.streak);
      target = clamp01(target + this.groove);
      this.target = target;
      // Rise quickly with the action, fall back slowly so the arrangement does not flap.
      const tau = target > this.intensity ? 0.7 : crashed ? 1 : 2.2;
      this.intensity += (target - this.intensity) * (1 - Math.exp(-d / tau));
      // Accents ride on top of the smoothed drive and fade within 1.5 s.
      this.accent *= Math.exp(-d / ACCENT_TAU);
      for (let i = this.accents.length - 1; i >= 0; i--) {
        const a = this.accents[i];
        if (a.at > now) continue;
        this.accents.splice(i, 1);
        this.accent = Math.min(ACCENT_MAX, this.accent + a.amt);
      }
      if (crashed) this.accent = 0;
      c.music.setDrive(clamp01(this.intensity + this.accent), clamp01(frame.danger), frame.comboMult || 1, snap);
      if (!crashed) this.runT += d;
      c.ambience.update(frame, now, this.avalanche, c.music.key(), clamp01(this.runT - SHOULDER_FROM_S));
      this.choir(frame, now, crashed, c);
      c.pulse.fuse = crashed ? 0 : clamp01(frame.fuse ?? 0);
      c.pulse.duel = crashed ? 0 : clamp01(frame.duel ?? 0);
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
      // Sounds and the music ducks under them (sfx.ts).
      c.sfx.event(e, now + START_LEAD);
      if (e.type === 'drift' && e.phase === 'release') c.ambience.whineRelease(now);
    } catch (err) {
      this.warn(err);
    }
  }

  /**
   * The run's named moments for this frame (src/game/beats.ts), called BEFORE that frame's
   * simEvent(e) calls so their data is known when the raw sounds play. Never keeps the list.
   */
  beats(list: readonly Beat[]): void {
    const ctx = this.ctx;
    const c = this.core;
    try {
      c?.sfx.frame();
      const now = ctx ? ctx.currentTime : 0;
      for (const b of list) this.accentFor(b, now);
      if (list.length > 0) this.choirFor(list, now);
      if (!ctx || !c || !this.live(ctx) || list.length === 0) return;
      const t = now + START_LEAD;
      for (const b of list) {
        if (b.type === 'km') {
          // The milestone bell lands on the band's next beat.
          const g = c.music.grid();
          const tq = g ? g.t0 + Math.ceil((t - g.t0) / (g.dur * 4)) * g.dur * 4 : t;
          c.sfx.schedule(tq, (tt) => c.sfx.km(tt));
        } else c.sfx.beat(b, t);
        if (b.type === 'unlockPop') c.graph.music.duck(0.6, now, 0.9, 0.5);
        // A bump snuffed the flow: the singing wind bends down a fourth and opens back to noise.
        else if (b.type === 'flow' && b.phase === 'snuff') c.ambience.snuff(now);
      }
    } catch (err) {
      this.warn(err);
    }
  }

  /** detail: the ladder step for ticks, an index for stamps and chimes. delay: seconds from now
   *  (sync with the UI); a sound scheduled ahead can still be dropped by cancelPending(). */
  ui(name: UiSound, detail?: number, delay = 0): void {
    const ctx = this.ctx;
    const c = this.core;
    if (!ctx || !c || !this.live(ctx)) return;
    try {
      const now = ctx.currentTime;
      const d = Number.isFinite(delay) ? Math.max(0, delay) : 0;
      const duck = name === 'new-best' || name === 'unlock' ? (t: number) => c.graph.music.duck(0.6, Math.max(t - START_LEAD, ctx.currentTime), 0.9, 0.5) : undefined;
      c.sfx.ui(name, detail ?? 0, now + START_LEAD + d, duck);
    } catch (err) {
      this.warn(err);
    }
  }

  /** Drops UI sounds scheduled ahead (results and reveal sync), including any already built that
   *  have not started: Run Again or a new reveal mid-sequence leaves no strays. */
  cancelPending(): void {
    try {
      const c = this.core;
      if (!c) return;
      c.sfx.clearPending();
      c.sfxPool.killFuture(c.ctx.currentTime);
    } catch (err) {
      this.warn(err);
    }
  }

  /**
   * The reveal's sounds on its timeline (call as the card starts; cancelPending() first): a tick on
   * each reel name change climbing ladder steps 3 to 9, and the slam as the name lands (T_STAMP, or
   * 200 ms under reduced motion, which skips the reel). `names` is the reel's length (12).
   */
  cueReveal(t: RevealCue, reduced: boolean, names = 12): void {
    for (const q of revealCues(t, reduced, names)) this.ui(q.name, q.detail, q.at);
  }

  /**
   * The results card's sounds on its timeline (call as the card opens): ten ticks up the ladder
   * along the score's ease-out count, the stamp with your place, the new-best chord on its stamp, a
   * soft mallet per Beat stamp, a chime per mission Done stamp and a coin as each reward lands in the
   * wallet. missions and coins take a count or the rows (each mission's index in
   * ResultsModel.missions, which places its stamp and its fly-in). Reduced motion collapses it all to
   * the opening moment with a single tick. A sound the app also asks for at the same moment
   * (ui('coin', 0, sameDelay)) plays once.
   */
  cueResults(r: ResultsShow, t: ResultsCue, reduced: boolean): void {
    for (const q of resultsCues(r, t, reduced)) this.ui(q.name, q.detail, q.at);
  }

  /** Probe-only readout of the mix: the drive (smoothed intensity, its target and the accent), each
   *  music layer's presence, the music duck and both voice pools. */
  debugLevels(): Record<string, number> {
    const out: Record<string, number> = { intensity: this.intensity, target: this.target, accent: this.accent, groove: this.groove, drive: clamp01(this.intensity + this.accent), choirFromFrame: this.choirFromFrame ? 1 : 0 };
    const c = this.core;
    const ctx = this.ctx;
    out.running = ctx && ctx.state === 'running' ? 1 : 0;
    if (!c) return out;
    const layers = c.music.layerLevels();
    if (layers) for (const k of Object.keys(layers)) out[k] = layers[k];
    const pos = c.music.position();
    if (pos) {
      // The song form: bar of the loop (A A B B on Clear Skies, 4 bars each) and decks started.
      out.bar = pos.bar;
      out.cycleBars = pos.cycle;
    }
    out.decksStarted = c.music.decksStarted;
    out.choir = c.music.choirVoices();
    out.duck = c.graph.music.ducked;
    out.sfxVoices = c.sfxPool.active;
    out.musicVoices = c.musicPool.active;
    out.sfxPeak = c.sfxPool.peak;
    out.musicPeak = c.musicPool.peak;
    out.sfxSteals = c.sfxPool.steals;
    out.musicSteals = c.musicPool.steals;
    out.padSteals = c.musicPool.keptSteals;
    return out;
  }

  /** Probe-only: the context and the master's last node before the speakers, for a capture tap. */
  debugTap(): { ctx: AudioContext; out: AudioNode } | null {
    return this.ctx && this.core ? { ctx: this.ctx, out: this.core.graph.ceiling } : null;
  }

  /** Probe-only: an offline render of a scripted mix through the same Core (probe.ts, loaded on
   *  demand): 'cruise', 'ambience', 'stress' or 'groove'. Levels in dBFS. */
  async debugRender(kind: string, seconds?: number, opts?: import('./probe').RenderOpts): Promise<Record<string, number | number[]>> {
    const m = await import('./probe');
    return m.renderMix(kind, seconds, opts);
  }

  /**
   * The ghost choir, from the beats: each ghost you pass joins the band as a voice (up to three)
   * while it stays behind you; one that passes you back leaves with a sigh, and a wipeout or the
   * crash ends it. The beats keep the set of passed ghosts (for the retake's sigh); the size sung
   * comes from choir() each frame.
   */
  private choirFor(list: readonly Beat[], now: number): void {
    for (const b of list) {
      if (b.type === 'pass') {
        if (!b.muted && b.word !== 'jostle' && b.word !== 'beat') this.passed.set(b.ghost.id, now);
      } else if (b.type === 'passedBy') {
        if (this.passed.delete(b.ghost.id)) this.retakeAt = now;
      } else if (b.type === 'raceNews') {
        if (b.news === 'wipeout' || b.news === 'wipeoutBehind') this.passed.delete(b.ghost.id);
      } else if (b.type === 'crash') this.passed.clear();
    }
  }

  /**
   * The choir's size each frame: the director's AudioFrame.choir (passed ghosts still riding within
   * 150 m behind) when the frame carries it, else the passed set with a 30 s time to live. A retake
   * sighs as the count drops, or after RETAKE_WAIT_S when it does not (a full choir with more ghosts
   * behind than voices: the top voice sighs and another takes its place).
   */
  private choir(frame: AudioFrame, now: number, crashed: boolean, c: Core): void {
    this.choirFromFrame = typeof frame.choir === 'number' && Number.isFinite(frame.choir);
    if (crashed && this.passed.size > 0) this.passed.clear();
    if (!this.choirFromFrame) for (const [id, at] of this.passed) if (now - at > CHOIR_TTL_S) this.passed.delete(id);
    const n = crashed ? 0 : choirSize(frame.choir, this.passed.size);
    let retaken = false;
    if (this.retakeAt >= 0 && (n < this.choirN || now - this.retakeAt >= RETAKE_WAIT_S || crashed)) {
      retaken = !crashed;
      this.retakeAt = -1;
    }
    c.music.setChoir(n, now, retaken);
    this.choirN = n;
  }

  /** Accents: internal lifts on the drive for the beats that should swell the band for a moment. */
  private accentFor(b: Beat, now: number): void {
    let amt = 0;
    let at = now;
    switch (b.type) {
      case 'callout':
        if (b.say.tone === 'big') amt = 0.06;
        break;
      case 'stomp':
        amt = Math.min(0.12, 0.06 + 0.02 * Math.max(0, b.streak - 1));
        break;
      case 'driftRelease':
        if (b.tier >= 3) amt = 0.06;
        break;
      case 'bank':
        if (b.points >= 1500) {
          amt = 0.08;
          // On the figure's landing (the slam), not as the roll starts.
          at = now + bankLandDelay(b);
        }
        break;
      case 'km':
        amt = 0.06;
        break;
      default:
        break;
    }
    if (amt <= 0) return;
    if (at <= now) this.accent = Math.min(ACCENT_MAX, this.accent + amt);
    else this.accents.push({ at, amt });
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
