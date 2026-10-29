import type { Bank } from './buffers';

// One-shot voices and the pool that caps them. A voice is the unit of polyphony: a small node graph
// with a known end time. When the pool is full the quietest voice is faded out in a few milliseconds
// (inaudible next to a fresh attack) and every finished voice is disconnected by sweep(). Quietest
// is an estimate: a voice's priority (PRIO) times how far it has decayed toward its end, so a steal
// takes a gift tick's tail or a shimmer before a payoff the player just earned.

/** Steal priority classes (the weight a voice keeps at its attack). */
export const PRIO = {
  /** Repeated ticks and pickups whose tails nobody misses: gift bells, metronome and fuse ticks,
   *  ghost whispers, draft notes, distant news. */
  low: 0.5,
  /** Decoration on a reward: the shimmer's grains. */
  sparkle: 0.7,
  normal: 1,
  /** The payoff a player just earned: chords, brass, a bank's landing, the named stings. */
  payoff: 2,
} as const;

/** A voice built from exponential decays reaches its end at about 5.5 time constants (-48 dB), so
 *  its level at a fraction p of the way there is near exp(-5.5 p). */
const DECAY_SPAN = 5.5;
/** A tail estimated under -20 dB of its attack: a steal nobody hears under the fresh attack that
 *  takes its slot. (Tuned on the stress mix: -26 dB left more audible steals, -14 dB stole payoffs.) */
const QUIET = 0.1;
/** Probe: a stolen voice estimated above this (-20 dB) counts as a steal you might hear. */
const LOUD = 0.1;

/** NaN maps to lo: a stray NaN in a frame must never reach an AudioParam, which would throw. */
export const clamp = (v: number, lo: number, hi: number): number => (v > lo ? (v < hi ? v : hi) : lo);
export const rand = (a: number, b: number): number => a + Math.random() * (b - a);
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Gain that keeps band-passed noise at a similar loudness wherever the band sits: noise power
 *  scales with bandwidth, so a narrow band needs more gain. */
export function bandComp(centre: number, q: number, sampleRate: number): number {
  return clamp(Math.sqrt((sampleRate * 0.5 * q) / Math.max(centre, 20)), 1, 9);
}

/** Linear attack to peak, then exponential decay. Returns the time it is effectively silent. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, tau: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0, t + attack, tau);
  return t + attack + tau * 5.5;
}

/** Linear attack, hold, exponential release. */
export function swell(p: AudioParam, t: number, peak: number, attack: number, hold: number, tau: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setValueAtTime(peak, t + attack + hold);
  p.setTargetAtTime(0, t + attack + hold, tau);
  return t + attack + hold + tau * 5.5;
}

function link(src: AudioNode, dest: AudioNode | AudioParam): void {
  if (dest instanceof AudioNode) src.connect(dest);
  else src.connect(dest);
}

/** While a biquad parameter is automated, Chrome recomputes its coefficients (with trig) for every
 *  sample. Once per 128-sample block is plenty for sweeps and envelopes, and several times
 *  cheaper. Browsers without automationRate simply ignore the assignment. */
export function blockRate(f: BiquadFilterNode): BiquadFilterNode {
  try {
    f.frequency.automationRate = 'k-rate';
    f.Q.automationRate = 'k-rate';
  } catch {
    // Not supported: stays a-rate.
  }
  return f;
}

export class Voice {
  readonly out: GainNode;
  /** Stereo position, automatable; null where StereoPannerNode is missing (old Safari). */
  readonly pan: AudioParam | null = null;
  end: number;
  dead = false;
  /** Stolen only when every live voice is kept: a pad is the bed, and losing it mid-chord is
   *  far more audible than losing a decaying pluck. */
  keep = false;
  /** Steal priority (PRIO): the weight this voice keeps at its attack. */
  prio: number = PRIO.normal;
  private readonly nodes: AudioNode[] = [];
  private readonly srcs: AudioScheduledSourceNode[] = [];

  /** The latest attack built into this voice (an arpeggio or a roll keeps adding them). */
  private lastOn: number;

  constructor(
    readonly ctx: BaseAudioContext,
    readonly bank: Bank,
    readonly t0: number,
    level: number,
    dry: AudioNode,
    wet: AudioNode | null,
    send: number,
    pan: number,
  ) {
    this.end = t0;
    this.lastOn = t0;
    this.out = ctx.createGain();
    this.out.gain.value = level;
    let tail: AudioNode = this.out;
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      this.out.connect(p);
      this.nodes.push(p);
      this.pan = p.pan;
      tail = p;
    }
    tail.connect(dry);
    if (wet && send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      tail.connect(s);
      s.connect(wet);
      this.nodes.push(s);
    }
  }

  /** `dest` may be null when the caller fans the gain out to several params itself. */
  gain(value: number, dest: AudioNode | AudioParam | null): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    if (dest) link(g, dest);
    this.nodes.push(g);
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode {
    const f = blockRate(this.ctx.createBiquadFilter());
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    this.nodes.push(f);
    return f;
  }

  osc(wave: OscillatorType | PeriodicWave, freq: number, t0: number, t1: number, dest: AudioNode | AudioParam, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    // PeriodicWave is an empty interface in the DOM typings, so typeof cannot narrow it.
    if (typeof wave === 'string') o.type = wave as OscillatorType;
    else o.setPeriodicWave(wave);
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    link(o, dest);
    o.start(t0);
    o.stop(t1);
    this.srcs.push(o);
    if (t1 > this.end) this.end = t1;
    if (t0 > this.lastOn) this.lastOn = t0;
    return o;
  }

  /** Plays a buffer from t0 to t1. Looped noise starts at a random offset so no two hits match. */
  buffer(buf: AudioBuffer, t0: number, t1: number, dest: AudioNode | AudioParam, rate = 1, loop = true): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    s.playbackRate.value = rate;
    link(s, dest);
    s.start(t0, loop ? Math.random() * buf.duration * 0.9 : 0);
    s.stop(t1);
    this.srcs.push(s);
    if (t1 > this.end) this.end = t1;
    if (t0 > this.lastOn) this.lastOn = t0;
    return s;
  }

  /** Sine LFO added onto a parameter. */
  lfo(rate: number, depth: number, dest: AudioParam, t0: number, t1: number, type: OscillatorType = 'sine'): GainNode {
    const g = this.gain(depth, dest);
    this.osc(type, rate, t0, t1, g);
    return g;
  }

  /** A stereo branch inside the voice (a shimmer's left and right grains on one voice): a panner
   *  into `dest`, or a plain gain where StereoPannerNode is missing. */
  panner(pan: number, dest: AudioNode): AudioNode {
    if (typeof this.ctx.createStereoPanner !== 'function') return this.gain(1, dest);
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    p.connect(dest);
    this.nodes.push(p);
    return p;
  }

  /** Keeps the voice allocated until at least t (parts of it will be added later). */
  hold(t: number): void {
    if (t > this.end) this.end = t;
  }

  /** Its estimated level at `now` (0..1 of its attack): the decay since its latest attack toward its
   *  end; a voice with an attack still ahead is at full level. */
  level(now: number): number {
    if (now <= this.lastOn) return 1;
    const span = this.end - this.lastOn;
    const p = span > 1e-3 ? clamp((now - this.lastOn) / span, 0, 1) : 1;
    return Math.exp(-DECAY_SPAN * p);
  }

  /** How much stealing this voice would cost at `now`: its priority times its estimated level. */
  weight(now: number): number {
    return this.prio * this.level(now);
  }

  kill(now: number): void {
    if (this.dead) return;
    this.dead = true;
    const p = this.out.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.setTargetAtTime(0, now, 0.005);
    for (const s of this.srcs) {
      try {
        s.stop(now + 0.04);
      } catch {
        // Already stopped.
      }
    }
    this.end = now + 0.05;
  }

  release(): void {
    // Deferred parts still queued for this voice must not build onto disconnected nodes.
    this.dead = true;
    for (const n of this.srcs) n.disconnect();
    for (const n of this.nodes) n.disconnect();
    this.out.disconnect();
    this.srcs.length = 0;
    this.nodes.length = 0;
  }
}

export class VoicePool {
  private readonly list: Voice[] = [];
  /** Probe counters: voices stolen at the cap, how many of them were kept (pad) voices, and how many
   *  were still audible (estimated above -20 dB: a steal you might hear) and of those, payoffs. */
  steals = 0;
  keptSteals = 0;
  loudSteals = 0;
  payoffSteals = 0;
  /** Probe: the most voices alive at once. */
  peak = 0;
  /** Probe-only: steal the oldest voice instead (the old rule), to compare against. */
  stealOldest = false;
  /** Probe-only: the level under which a tail is stolen first (QUIET). */
  quiet = QUIET;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly bank: Bank,
    readonly max: number,
  ) {}

  /**
   * A new voice from t0. Past the cap one voice goes: a tail already under QUIET (inaudible under a
   * fresh attack) if there is one, the one with the most time left (it frees its slot for longest, so
   * the pool stays under its cap); else the lowest weight() (priority times level: a gift tick or a
   * shimmer before a payoff), the oldest on a tie. Kept voices (the pad) only when every live voice
   * is kept.
   */
  voice(t0: number, level: number, dry: AudioNode, wet: AudioNode | null, send: number, pan = 0, prio: number = PRIO.normal): Voice {
    const now = this.ctx.currentTime;
    this.sweep(now);
    let live = 0;
    let quietest: Voice | null = null;
    let quietestW = Infinity;
    let tail: Voice | null = null;
    let tailLeft = -1;
    let oldestKept: Voice | null = null;
    for (const v of this.list) {
      if (v.dead || v.end <= now) continue;
      live++;
      if (v.keep) oldestKept ??= v;
      else if (this.stealOldest) quietest ??= v;
      else {
        const w = v.weight(now);
        if (w < quietestW) {
          quietestW = w;
          quietest = v;
        }
        if (v.level(now) < this.quiet && v.end - now > tailLeft) {
          tailLeft = v.end - now;
          tail = v;
        }
      }
    }
    const victim = tail ?? quietest ?? oldestKept;
    if (live >= this.max && victim) {
      const loud = victim.level(now) > LOUD;
      victim.kill(now);
      this.steals++;
      if (victim.keep) this.keptSteals++;
      if (loud) this.loudSteals++;
      if (loud && victim.prio >= PRIO.payoff) this.payoffSteals++;
      live--;
    }
    const v = new Voice(this.ctx, this.bank, t0, level, dry, wet, send, pan);
    v.prio = prio;
    this.list.push(v);
    if (live + 1 > this.peak) this.peak = live + 1;
    return v;
  }

  /** Silences voices that have not started yet (sounds scheduled ahead for a screen that has gone). */
  killFuture(now: number): void {
    for (const v of this.list) if (!v.dead && v.t0 > now + 0.002) v.kill(now);
  }

  get active(): number {
    const now = this.ctx.currentTime;
    let n = 0;
    for (const v of this.list) if (!v.dead && v.end > now) n++;
    return n;
  }

  /** Disconnects voices that finished a moment ago. */
  sweep(now: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i];
      if (v.end + 0.1 < now) {
        v.release();
        this.list.splice(i, 1);
      }
    }
  }

  killAll(now: number): void {
    for (const v of this.list) v.kill(now);
  }

  releaseAll(): void {
    for (const v of this.list) v.release();
    this.list.length = 0;
  }
}
