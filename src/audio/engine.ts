import { ChaosEvent, Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import type { SimEvent } from '../sim/sim';
import type { Beat } from '../game/beats';
import { RUN_FLOOR } from '../game/intensity';
import { START_TICKS } from '../game/race';
import { Core } from './core';
import { ChoirTracker, type ResultsCue, type ResultsShow, type RevealCue, floorDrive, grooveLift, resultsCues, revealCues } from './cues';
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
 * - Buffers (white/pink/brown stereo noise, grain train, sleigh bell, impulse, and the white noise
 *   high-passed once for the hats, the kick's click and the effects' click) are generated once per
 *   context in buffers.ts. Events never allocate large buffers.
 * - Main-thread cost is mostly node creation (at a 6x CPU throttle a node costs about 0.3 ms), so
 *   sounds make few: voices share one reverb send per send level, a voice holding one part shapes
 *   its envelope on its own out, a finished voice is unplugged at its tail only, and each choir
 *   voice keeps one vowel chain per deck. A node made inside a frame (an effect from beats() or
 *   simEvent()) lengthens that frame, and on the Low tier frames sit near the two-vsync line, so
 *   voices take their nodes from a reserve the scheduler pass tops up between frames (voices.ts
 *   NodeReserve).
 * - Ambience (ambience.ts) is a fixed graph built once; update() only retargets parameters with
 *   setTargetAtTime, and only when they moved enough to matter. A branch whose gain has sat at
 *   zero for 2 s (or 8 fade time constants, if longer) is unplugged from its noise source so it
 *   stops costing DSP.
 * - One-shots (sfx.ts) are voices in a capped pool: past 24 one fades in 5 ms, and finished voices
 *   are disconnected by the scheduler sweep. The one that goes is a tail already 20 dB down if
 *   there is one, else the lowest priority times estimated level (voices.ts PRIO: gift bells, ticks
 *   and ghost whispers first, then shimmers, then passes, payoffs last), so a fresh payoff is not
 *   cut for an old tail. A shimmer is one voice (both sides), and a perfect landing's bloom rides on
 *   its chord. Parts of a sound starting more than 80 ms ahead (shimmers, arpeggio tails) are built
 *   by a later scheduler pass, so big rewards spread their node creation over several frames.
 * - Music (music.ts): a lookahead scheduler (25 ms timer, 0.12 s ahead on AudioContext time)
 *   steps 16th notes. A deck is one arrangement (scene + mood + biome); any change starts a new
 *   deck and crossfades over 1.5 s. The drive fades layers in: the pad always, the bass from 0.26
 *   (the run floor of 0.30 holds it from 2.5 s), hats from 0.28 (cruising sits at 0.36), the arp
 *   from 0.48 and the kick from 0.54, clap and sparkle from 0.72, the lead from 0.82. Danger adds a
 *   pulsing low root. The music pool (32) steals by the same rule and never a pad voice while it
 *   has another, so the pad bed is never cut mid-chord; skipped steps (a stalled timer, music
 *   volume at zero) rebuild the missing pad.
 * - The drive: the engine takes the game's intensity (src/game/intensity.ts), adds the groove (a
 *   stomp streak holds it up: +0.06 at 2 in a row up to +0.18 at 5), smooths it (rise 0.7 s, fall
 *   2.2 s), holds it at 0.25 under a chaos reveal and snaps the band in as the card collapses, and
 *   adds short accents on top (a big callout, a stomp that grows with the streak, a tier-3 drift
 *   crack, a big bank on its landing, a kilometre) that fade within 1.5 s. The first time a run's
 *   target reaches the run floor (0.30, from 2.5 s) the drive jumps to it instead of rising from
 *   about 0.12 over the 0.7 s rise, so the bass is in a breath after Ride on plain runs too (2.55 s;
 *   it was 4.6 to 4.9 s). Drafting earns none of it: a draft boost with the pack peaks under the
 *   arp.
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
 *   sighs the top voice down a fourth, a wipeout or the crash ends it. The count drops as a ghost
 *   draws level, a few frames before its passedBy, so a drop is held 0.5 s for the retake to land
 *   in (cues.ts ChoirTracker). The stress mix sings all three: the music pool peaks at 29 of 32
 *   with no steals.
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
 *   save CPU and resumed on unmute. A UI sound asked for while it resumes (50 to 90 ms on a desktop,
 *   about 200 on a phone: the doubled gifts' coin as the rewarded ad closes), and the Revive ad's
 *   revive, play the moment it runs, once, at full level, or not at all past 1 s; nothing the mute
 *   cut plays after it. All calls are no-ops before unlock() or without WebAudio.
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
/** After a resume is asked for, sounds are kept for this long instead of dropped: after unlock() (a
 *  gesture) they are scheduled into the starting context; after an unmute of a parked context the UI
 *  sounds wait for it to run (resumeQueue). */
const RESUME_GRACE_MS = 600;
/** The mute gain's time constant (s) when an unmute finds the context parked (12 ms otherwise). */
const UNMUTE_PARKED_TAU = 0.004;
/** A UI sound asked for while an unmuted context resumes plays when it runs, unless that is more than
 *  this late (ms): then it no longer belongs to the picture that asked for it. A desktop resumes in 50
 *  to 90 ms; a heavily loaded headless phone took 0.2 to 1.4 s, and a doubled reward's coin a second
 *  late still lands on its static x2 (silence was the bug). Overdue timeline sounds of one name all
 *  land at once and the one-sound guard plays them as one. At most RESUME_QUEUE_MAX wait. */
const RESUME_LATE_MS = 1000;
const RESUME_QUEUE_MAX = 16;
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
  /** Until this clock time an unmute's resume of a parked context is under way: UI sounds asked for
   *  meanwhile wait in resumeQueue and play as it runs again (if that is soon enough). */
  private unmuteUntil = 0;
  private readonly resumeQueue: Array<{ name: UiSound; detail: number | undefined; delay: number; at: number }> = [];
  /** When the Revive ad's revive event came in while the context resumed (-1: none waiting). */
  private reviveWaiting = -1;
  /** The smoothed drive, the frame's target, and the accent on top (probes read all three). */
  private intensity = 0;
  private target = 0;
  private accent = 0;
  private readonly accents: Array<{ at: number; amt: number }> = [];
  /** The count-in seen last frame, and until when its release holds the band in. */
  private countIn = false;
  private releaseUntil = 0;
  /** The drive has reached the run floor this run (it snaps there the first time). */
  private floored = false;
  private avalanche = false;
  /** The ghost choir's bookkeeping (cues.ts), and whether the frame carries the director's count. */
  private readonly choirs = new ChoirTracker();
  private choirFromFrame = false;
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
        this.resumeUntil = clockMs() + RESUME_GRACE_MS;
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
      this.floored = false;
      this.avalanche = false;
      this.groove = 0;
      this.runT = 0;
    }
    this.choirs.reset();
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
      this.intensity = floorDrive(this.intensity, target, this.floored, crashed || countIn);
      if (this.intensity >= RUN_FLOOR) this.floored = true;
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
    if (!ctx || !c) return;
    if (e.type === 'revive' && this.resuming(ctx)) {
      // The Revive ad's payoff comes in the first frame after the ad, while the context it parked is
      // still resuming: it plays the moment it runs (like the doubled gifts' coin).
      this.reviveWaiting = clockMs();
      return;
    }
    if (!this.live(ctx)) return;
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
      c?.sfx.frame(list);
      const now = ctx ? ctx.currentTime : 0;
      for (const b of list) this.accentFor(b, now);
      if (list.length > 0) this.choirs.beats(list, now);
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
        // The flow was snuffed (a bump, a botched landing or the crash): the singing wind bends down a
        // fourth and opens back to noise.
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
    if (!ctx || !c) return;
    if (this.resuming(ctx)) {
      // The context the mute parked is resuming: the sound plays as it runs again.
      if (this.resumeQueue.length < RESUME_QUEUE_MAX) this.resumeQueue.push({ name, detail, delay, at: clockMs() });
      return;
    }
    if (!this.live(ctx)) return;
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
    this.resumeQueue.length = 0;
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
   * (ui('coin', 0, sameDelay)) plays once. When the app plays each coin as its reward lands
   * (UIHandlers.onRewardLanded: ui('coin', row) at the landing) it passes coins: [] here, and a
   * second ask at that landing (the doubled reward's coin) is the same sound, played once. The same
   * for the Done chimes: played from UIHandlers.onMissionStamp (ui('mission', k) as each stamp starts:
   * it sounds on the next audio block), with missions: [] here. A coin or a chime asked for again
   * within UI_SAME_CHIME_S (60 ms: a frame or two) is one sound.
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
    // Nodes a voice had to make itself because the reserve was dry (inside a frame, for an effect).
    out.reserveMisses = c.reserve.misses;
    // Fixed one-shots played from a rendered take, built live (of those, with a take ready whose
    // parts would land on other frames), renders done and failed, and the samples the takes hold
    // (prerender.ts).
    out.takes = c.renders.hits;
    out.takeMisses = c.renders.misses;
    out.takeOffGrid = c.renders.offGrid;
    out.takeRenders = c.renders.renders;
    out.takeFailures = c.renders.failures;
    out.takeSamples = c.renders.held;
    out.sfxPeak = c.sfxPool.peak;
    out.musicPeak = c.musicPool.peak;
    out.sfxSteals = c.sfxPool.steals;
    out.sfxLoudSteals = c.sfxPool.loudSteals;
    out.sfxPayoffSteals = c.sfxPool.payoffSteals;
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
   * The ghost choir each frame (cues.ts ChoirTracker): each ghost you pass joins the band as a voice
   * (up to three) while the director counts it riding within 150 m behind you (AudioFrame.choir;
   * without it a 30 s time to live). One that passes you back leaves with a sigh: a drop in the count
   * is held for CHOIR_HOLD_S so the retake's passedBy, a few frames behind it, still finds the voice.
   * A wipeout or the crash ends it.
   */
  private choir(frame: AudioFrame, now: number, crashed: boolean, c: Core): void {
    this.choirFromFrame = typeof frame.choir === 'number' && Number.isFinite(frame.choir);
    const r = this.choirs.frame(frame.choir, now, crashed);
    c.music.setChoir(r.n, now, r.retaken);
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
    // The moment a parked context runs again, the UI sounds asked for while it resumed play (the
    // scheduler tick does the same, for a browser without the event).
    if (typeof ctx.addEventListener === 'function') ctx.addEventListener('statechange', () => this.flushResumed());
    this.timer = setInterval(() => this.tick(), TICK_MS);
    if (this.mutes.size > 0) this.applyMute();
    return true;
  }

  private tick(): void {
    const ctx = this.ctx;
    const c = this.core;
    if (!ctx || !c || ctx.state !== 'running') return;
    this.started = true;
    this.flushResumed();
    try {
      c.tick(ctx.currentTime, LOOKAHEAD);
    } catch (err) {
      this.warn(err);
    }
  }

  /** The context runs again after an unmute: the UI sounds asked for while it resumed play now, each
   *  as late as it waited (a timeline sound keeps its time); one asked for more than RESUME_LATE_MS
   *  ago is dropped, a coin that late no longer belongs to its picture. */
  private flushResumed(): void {
    const ctx = this.ctx;
    const c = this.core;
    if (!ctx || !c || ctx.state !== 'running') return;
    const now = clockMs();
    if (this.reviveWaiting >= 0) {
      const waited = now - this.reviveWaiting;
      this.reviveWaiting = -1;
      if (waited <= RESUME_LATE_MS && this.mutes.size === 0) {
        try {
          c.sfx.event({ type: 'revive' }, ctx.currentTime + START_LEAD);
        } catch (err) {
          this.warn(err);
        }
      }
    }
    if (this.resumeQueue.length === 0) return;
    const asks = this.resumeQueue.splice(0);
    for (const a of asks) {
      const waited = now - a.at;
      if (waited - a.delay * 1000 > RESUME_LATE_MS) continue;
      this.ui(a.name, a.detail, Math.max(0, a.delay - waited / 1000));
    }
  }

  /** An unmute's resume of the context it parked is under way (and nothing mutes it again). */
  private resuming(ctx: AudioContext): boolean {
    return this.mutes.size === 0 && ctx.state !== 'running' && clockMs() < this.unmuteUntil;
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
    const parked = ctx.state !== 'running';
    try {
      // A parked context opens in about 10 ms instead of 30 (it rendered nothing meanwhile, so there
      // is nothing to click against): a coin asked for as it resumes starts 6 ms in and keeps its ting.
      c.graph.setMuted(muted, ctx.currentTime, !muted && parked ? UNMUTE_PARKED_TAU : undefined);
      if (muted) {
        c.sfx.clearPending();
        this.resumeUntil = 0;
        this.unmuteUntil = 0;
        this.resumeQueue.length = 0;
        this.reviveWaiting = -1;
        this.armSuspend();
      } else {
        this.clearSuspend();
        // A context the mute parked takes a moment to run again (50 to 90 ms on a desktop, 200 on a
        // phone, more under load), and the UI sounds asked for meanwhile are the point of the unmute:
        // the doubled gifts' coin as the rewarded ad closes. They wait (resumeQueue) and play the
        // moment it runs, or not at all if that comes more than RESUME_LATE_MS after the ask; built
        // into the parked context instead, every one would fire at once however late it resumed. Only
        // on a context that has run: one that never started waits for a gesture (unlock()), so
        // nothing piles up for a later tap. (Run sounds stay dropped until it runs: frames keep
        // coming, and a parked clock would stack them all on its first block.)
        if (parked && this.started) this.unmuteUntil = clockMs() + RESUME_GRACE_MS;
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
