import type { Bank } from './buffers';
import { NodeReserve, Voice } from './voices';

// Fixed sounds rendered once. A few one-shots play several times a second with every part fixed by
// a key the caller names (a gift pickup's bells and jingle at a ladder step in the playing key). So
// the first time a key plays, its parts are also built onto a voice of an OfflineAudioContext (the
// same instrument calls, rendered on the audio rendering's own thread, not the main thread), and
// from then on the voice plays that take through one buffer source into its out: a gift costs its
// out, its panner and one source instead of ten or sixteen nodes, with their links and automation.
// Until a take is ready (the first time, while its render is in flight, or where OfflineAudioContext
// is missing) the voice builds the parts live.
//
// A take plays only where it is the live sound to the sample, and that takes the parts on the same
// frames of the same render quantum. Web Audio renders in blocks of 128 frames from frame 0, and
// Chrome's oscillators read an a-rate frequency input (an FM bell's modulator) misaligned by where in
// its first block the oscillator starts: the same bell started 64 frames into a block and on a
// block's first frame differs by up to 5 dB block to block, and one frame later differs as well. So:
//   - a take is rendered with its parts where the live sound starts in its block (its phase, in
//     frames), and played from that block's first frame (which also keeps a source started between
//     two frames, read through interpolation, out of it). Effects start at currentTime plus a fixed
//     lead and currentTime moves in whole blocks, so every pickup has one phase (32 frames at 48 kHz,
//     8.6 at 44.1 kHz).
//   - an oscillator starts on the frame its start time rounds up to, and a start meant to sit on a
//     frame carries float noise either way (t + 0.055 at 48 kHz is 2640 frames on, give or take
//     1e-11), so the caller names the offsets its oscillators start at (a gift's bells) and a take
//     plays only where each lands on the frame it did in the render: about five pickups in six in
//     a session's first ten minutes at 48 kHz, two in three after that (float noise grows with the
//     context's clock), all of them at 44.1 kHz, where no start sits on a frame. The rest play live.
//     An automation event a hair before its frame lands a frame early too, which moves an envelope
//     by a sample: a take played there is 40 dB under the sound, every block within 0.1 dB.
//   - the parts go in the take's third block: a part starting between two frames renders differently
//     in a context's first block than in any later one, and 128 frames in seconds is not exact.

/** A fixed sound's parts, built onto voice `v` from time `t`: the calls a live voice makes. Its parts
 *  must be mono (oscillators and the bank's mono buffers), since a take is one channel into the
 *  voice's out, and built-in waves only: the bank's PeriodicWaves belong to the live context. */
export type Recipe = (v: Voice, t: number) => void;

/** Frames per render quantum (Web Audio renders in blocks of this many from frame 0). */
const QUANTUM = 128;
/** A phase is kept to 1/1024 of a frame (start times carry float noise; 0.02 us is nothing). */
const PHASE_STEPS = 1024;
/** Frames ahead of the parts' block in a take (two blocks); the voice skips them. */
const LEAD = 2 * QUANTUM;

/** Takes kept, in samples over all keys (about 8 MB of floats). A run's gift pickups reach a dozen
 *  or so keys in a key (a gift is 2.4 s, 3.4 s worth 5 or more: 114 k or 164 k samples at 48 kHz);
 *  past the cap the take played longest ago goes, and renders again if asked for. */
export const TAKE_SAMPLES = 2_000_000;
/** Renders in flight at once; the scheduler pass starts at most one, so the graphs they build (a
 *  dozen nodes each, on the offline context) never land on one frame together. */
const IN_FLIGHT = 2;

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

interface Job {
  key: number;
  phase: number;
  seconds: number;
  starts: readonly number[];
  recipe: Recipe;
}

interface Take {
  buf: AudioBuffer;
  /** Where in its render quantum the sound starts (frames). */
  phase: number;
  /** The offsets its parts start at (s), and the frame each started on, from the parts' block. */
  starts: readonly number[];
  frames: number[];
  /** When it last played (Prerender.clock): the least recent goes first past the cap. */
  used: number;
}

export class Prerender {
  /** Ready takes by key. */
  private readonly takes = new Map<number, Take>();
  /** Keys queued or rendering, and keys whose render failed (those keep playing live). */
  private readonly asked = new Set<number>();
  private readonly queue: Job[] = [];
  private inFlight = 0;
  private samples = 0;
  private clock = 0;
  private disposed = false;
  private Offline: OfflineCtor | null;
  /** Probe counters: plays from a take, plays built live (of those, plays whose take was ready but
   *  whose parts would land on other frames), renders done and failed. */
  hits = 0;
  misses = 0;
  offGrid = 0;
  renders = 0;
  failures = 0;

  /** `offline`: the OfflineAudioContext constructor (tests pass a stub; null renders nothing). */
  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly bank: Bank,
    offline?: OfflineCtor | null,
  ) {
    const g = globalThis as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
    this.Offline = offline !== undefined ? offline : (g.OfflineAudioContext ?? g.webkitOfflineAudioContext ?? null);
  }

  /** Samples held by ready takes (probe). */
  get held(): number {
    return this.samples;
  }

  /** Where a sound starting at t sits in its render quantum (frames, to 1/PHASE_STEPS). */
  phaseOf(t: number): number {
    const f = t * this.ctx.sampleRate;
    const p = Math.round((f - Math.floor(f / QUANTUM) * QUANTUM) * PHASE_STEPS) / PHASE_STEPS;
    return p < QUANTUM ? p : 0;
  }

  /**
   * Plays the take of `key` on voice `v` for a sound starting at t, if it is ready and its parts
   * would start on the frames they did in it: from the first frame of t's render quantum, `on` the
   * latest attack inside it (Voice.play). False when the caller must build the parts live (and ask
   * with want()). Allocates nothing, so it is cheap inside a frame.
   */
  play(v: Voice, key: number, t: number, on: number): boolean {
    const e = this.takes.get(key);
    if (!e) {
      this.misses++;
      return false;
    }
    const sr = this.ctx.sampleRate;
    const phase = this.phaseOf(t);
    const block = Math.round(t * sr - phase);
    if (phase !== e.phase || !lands(e.starts, e.frames, t, block, sr)) {
      this.misses++;
      this.offGrid++;
      return false;
    }
    // A block already rendering: the take would start late (a source started in the past plays
    // from its start), so this one is live.
    if (block / sr < this.ctx.currentTime) {
      this.misses++;
      return false;
    }
    e.used = ++this.clock;
    this.hits++;
    v.play(e.buf, block / sr, LEAD / sr, on);
    return true;
  }

  /** Asks for the take of `key`, a sound `seconds` long from t whose parts `recipe` builds, starting
   *  at the offsets `starts` (s): rendered at t's phase, queued once (asks while it waits, renders
   *  or after it failed add nothing); the scheduler pass starts it. */
  want(key: number, t: number, seconds: number, starts: readonly number[], recipe: Recipe): void {
    if (!this.Offline || this.asked.has(key)) return;
    this.asked.add(key);
    this.queue.push({ key, phase: this.phaseOf(t), seconds, starts, recipe });
  }

  /** Scheduler pass (between frames): starts the next queued render if there is room. */
  pump(): void {
    if (this.inFlight >= IN_FLIGHT) return;
    const job = this.queue.shift();
    if (job) this.render(job);
  }

  dispose(): void {
    this.disposed = true;
    this.takes.clear();
    this.queue.length = 0;
    this.samples = 0;
  }

  private render(job: Job): void {
    const Offline = this.Offline;
    if (!Offline || this.disposed) return;
    const { key, phase, seconds, starts, recipe } = job;
    const sr = this.ctx.sampleRate;
    let octx: OfflineAudioContext;
    try {
      octx = new Offline(1, Math.ceil(LEAD + phase + seconds * sr) + 1, sr);
    } catch {
      // No offline rendering here (or not at this rate): everything plays live, as before.
      this.Offline = null;
      this.queue.length = 0;
      this.failures++;
      return;
    }
    let rendering: Promise<AudioBuffer> | undefined;
    try {
      // The live bank's buffers (an AudioBuffer serves any context). A voice at level 1 straight into
      // the destination: the take is the parts' sum, before the live voice's level and pan. The parts
      // start at the phase in the third block, which renders them as the live block would.
      const t0 = (LEAD + phase) / sr;
      const v = new Voice(octx, this.bank, new NodeReserve(octx), t0, 1, octx.destination, null, 0);
      recipe(v, t0);
      // A part running past the take would be cut: the caller's length is wrong, so play it live.
      if (v.end > t0 + seconds + 1 / sr) throw new Error(`take ${key} is ${v.end - t0} s, not ${seconds}`);
      const frames = starts.map((s) => Math.ceil((t0 + s) * sr) - LEAD);
      const done = (buf: AudioBuffer | null | undefined): void => {
        this.inFlight--;
        if (buf && buf.numberOfChannels === 1) this.keep(key, { buf, phase, starts, frames, used: 0 });
        else this.failures++;
      };
      // Old webkit returns nothing and fires oncomplete; newer engines return a promise.
      octx.oncomplete = (e: OfflineAudioCompletionEvent) => {
        if (!rendering) done(e.renderedBuffer);
      };
      rendering = octx.startRendering() as Promise<AudioBuffer> | undefined;
      this.inFlight++;
      if (rendering) rendering.then(done, () => done(null));
    } catch {
      this.failures++;
    }
  }

  private keep(key: number, take: Take): void {
    this.renders++;
    if (this.disposed) return;
    take.used = ++this.clock;
    this.takes.set(key, take);
    this.samples += take.buf.length;
    // Past the cap: the take played longest ago goes (never the one just made).
    while (this.samples > TAKE_SAMPLES) {
      let old: number | null = null;
      let oldest = Infinity;
      for (const [k, e] of this.takes) {
        if (k !== key && e.used < oldest) {
          oldest = e.used;
          old = k;
        }
      }
      const e = old === null ? undefined : this.takes.get(old);
      if (old === null || !e) break;
      this.takes.delete(old);
      this.asked.delete(old);
      this.samples -= e.buf.length;
    }
  }
}

/** Whether parts starting at `starts` (s) from t land on `frames` counted from t's block (the
 *  frame a start rounds up to, as the context places it). */
function lands(starts: readonly number[], frames: readonly number[], t: number, block: number, sr: number): boolean {
  for (let i = 0; i < starts.length; i++) if (Math.ceil((t + starts[i]) * sr) - block !== frames[i]) return false;
  return true;
}
