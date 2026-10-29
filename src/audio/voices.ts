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

/**
 * Fresh nodes made ahead, between frames. Making a node is the dearest call a sound makes on the
 * main thread, and the effects make theirs inside a frame (beats() and simEvent() run in the app's
 * frame), where a burst of them can push the frame past a vsync. The scheduler pass, which runs
 * between frames, tops this reserve up a few nodes at a time; a voice takes its nodes from it and
 * makes one itself only when it has run dry. A node made a moment early is the same node: nothing
 * about it is set until the voice takes it, and a source does nothing until it is started.
 */
export class NodeReserve {
  private readonly gains: GainNode[] = [];
  private readonly oscs: OscillatorNode[] = [];
  private readonly filters: BiquadFilterNode[] = [];
  private readonly sources: AudioBufferSourceNode[] = [];
  private readonly panners: StereoPannerNode[] = [];
  /** Probe: nodes a voice had to make itself (the reserve was dry). */
  misses = 0;

  constructor(private readonly ctx: BaseAudioContext) {}

  gain(): GainNode {
    return this.gains.pop() ?? (this.misses++, this.ctx.createGain());
  }

  osc(): OscillatorNode {
    return this.oscs.pop() ?? (this.misses++, this.ctx.createOscillator());
  }

  filter(): BiquadFilterNode {
    return this.filters.pop() ?? (this.misses++, blockRate(this.ctx.createBiquadFilter()));
  }

  source(): AudioBufferSourceNode {
    return this.sources.pop() ?? (this.misses++, this.ctx.createBufferSource());
  }

  /** Null where StereoPannerNode is missing (old Safari). */
  panner(): StereoPannerNode | null {
    if (typeof this.ctx.createStereoPanner !== 'function') return null;
    return this.panners.pop() ?? (this.misses++, this.ctx.createStereoPanner());
  }

  /**
   * Scheduler pass: makes up to `budget` nodes toward the reserve's size, the kind furthest below
   * its size first. Sized for the busiest frames of a run (a perfect landing's payoff, a pass word
   * over a pickup) at a few dozen nodes; a run uses ten to twenty a second.
   */
  refill(budget = 8): void {
    const ctx = this.ctx;
    const want: Array<[unknown[], number, () => unknown]> = [
      [this.gains, 28, () => ctx.createGain()],
      [this.oscs, 18, () => ctx.createOscillator()],
      [this.filters, 6, () => blockRate(ctx.createBiquadFilter())],
      [this.sources, 6, () => ctx.createBufferSource()],
    ];
    if (typeof ctx.createStereoPanner === 'function') want.push([this.panners, 4, () => ctx.createStereoPanner()]);
    for (let made = 0; made < budget; made++) {
      let best: [unknown[], number, () => unknown] | null = null;
      let gap = 0;
      for (const w of want) {
        const g = (w[1] - w[0].length) / w[1];
        if (g > gap) {
          gap = g;
          best = w;
        }
      }
      if (!best) return;
      best[0].push(best[2]());
    }
  }
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
  /** The one node wired into the shared graph (the panner, else `out`): release() unplugs only it.
   *  Everything else in the voice only feeds it, so once it is unplugged nothing pulls the rest,
   *  and the garbage collector takes the voice's nodes with their links. */
  private readonly tail: AudioNode;
  private readonly srcs: AudioScheduledSourceNode[] = [];

  /** The latest attack built into this voice (an arpeggio or a roll keeps adding them). */
  private lastOn: number;

  /**
   * `send`: the shared reverb send for this voice's send level (VoicePool.sendFor), or null. A send
   * is a plain gain into the wet bus, so one per level serves every voice at that level: the bus
   * hears the same sum as with a gain per voice, and a voice costs one node less.
   */
  constructor(
    readonly ctx: BaseAudioContext,
    readonly bank: Bank,
    private readonly make: NodeReserve,
    readonly t0: number,
    level: number,
    dry: AudioNode,
    send: AudioNode | null,
    pan: number,
  ) {
    this.end = t0;
    this.lastOn = t0;
    this.out = make.gain();
    // 1 is the gain's default: setting it would only add an automation event.
    if (level !== 1) this.out.gain.value = level;
    let tail: AudioNode = this.out;
    const p = pan !== 0 ? make.panner() : null;
    if (p) {
      p.pan.value = clamp(pan, -1, 1);
      this.out.connect(p);
      this.pan = p.pan;
      tail = p;
    }
    tail.connect(dry);
    if (send) tail.connect(send);
    this.tail = tail;
  }

  /** `dest` may be null when the caller fans the gain out to several params itself. */
  gain(value: number, dest: AudioNode | AudioParam | null): GainNode {
    const g = this.make.gain();
    g.gain.value = value;
    if (dest) link(g, dest);
    return g;
  }

  /**
   * The gain an instrument shapes its envelope on: a new one into `dest`, or with `dest` null the
   * voice's own out (a voice holding a single part needs no gain of its own: the out is the part's
   * envelope, and a steal's fade on it starts from the envelope's level). Either starts at 0, as the
   * part's own gain did, so a fade or a sigh before the attack stays silent. Only for a voice made
   * at level 1 (the soundtrack's): the envelope replaces the out's level.
   */
  envelope(dest: AudioNode | AudioParam | null): GainNode {
    if (dest) return this.gain(0, dest);
    this.out.gain.value = 0;
    return this.out;
  }

  filter(type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode {
    const f = this.make.filter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(dest);
    return f;
  }

  osc(wave: OscillatorType | PeriodicWave, freq: number, t0: number, t1: number, dest: AudioNode | AudioParam, detune = 0): OscillatorNode {
    const o = this.make.osc();
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
    const s = this.make.source();
    s.buffer = buf;
    s.loop = loop;
    if (rate !== 1) s.playbackRate.value = rate;
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
    const p = this.make.panner();
    if (!p) return this.gain(1, dest);
    p.pan.value = clamp(pan, -1, 1);
    p.connect(dest);
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
    this.fadeOut(now, 0.005);
  }

  /** Fades the whole voice out from `now` with time constant `tau` and stops it; parts still queued
   *  for it are dropped (it is dead). */
  fadeOut(now: number, tau: number): void {
    if (this.dead) return;
    this.dead = true;
    const p = this.out.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.setTargetAtTime(0, now, tau);
    const stop = now + Math.max(0.04, tau * 8);
    for (const s of this.srcs) {
      try {
        s.stop(stop);
      } catch {
        // Already stopped.
      }
    }
    this.end = stop + 0.01;
  }

  /** Unplugs a finished voice from the shared graph. Its sources have all stopped; the nodes behind
   *  the tail are only linked to each other, so they need no disconnect calls of their own (each is
   *  a trip through the audio graph's lock). */
  release(): void {
    // Deferred parts still queued for this voice must not build onto disconnected nodes.
    this.dead = true;
    this.tail.disconnect();
    this.srcs.length = 0;
  }
}

export class VoicePool {
  private readonly list: Voice[] = [];
  /** Reverb sends shared by every voice at one send level, per wet bus (built on first use; the
   *  effects use about twenty levels). */
  private readonly sends = new Map<AudioNode, Map<number, GainNode>>();
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

  /** `reserve`: where its voices take their nodes (Core shares one between both pools). */
  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly bank: Bank,
    readonly max: number,
    readonly reserve: NodeReserve = new NodeReserve(ctx),
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
    const pick = this.pick(now);
    let live = pick.live;
    const victim = pick.victim;
    if (live >= this.max && victim) {
      const loud = victim.level(now) > LOUD;
      victim.kill(now);
      this.steals++;
      if (victim.keep) this.keptSteals++;
      if (loud) this.loudSteals++;
      if (loud && victim.prio >= PRIO.payoff) this.payoffSteals++;
      live--;
    }
    const v = new Voice(this.ctx, this.bank, this.reserve, t0, level, dry, wet && send > 0 ? this.sendFor(wet, send) : null, pan);
    v.prio = prio;
    this.list.push(v);
    if (live + 1 > this.peak) this.peak = live + 1;
    return v;
  }

  /** The shared send into `wet` at level `send` (a gain made once, then reused). */
  private sendFor(wet: AudioNode, send: number): GainNode {
    let byLevel = this.sends.get(wet);
    if (!byLevel) {
      byLevel = new Map();
      this.sends.set(wet, byLevel);
    }
    let s = byLevel.get(send);
    if (!s) {
      s = this.ctx.createGain();
      s.gain.value = send;
      s.connect(wet);
      byLevel.set(send, s);
    }
    return s;
  }

  /**
   * Whether a voice of priority `prio` can start now without cutting an audible voice that matters
   * more: the pool is under its cap, or the voice a steal would take is a quiet tail or weighs less
   * than `prio` would at its attack. A cue that only adds to a moment ('Flow broken' over a sketchy
   * landing) asks first, so it never costs a payoff its voice.
   */
  room(prio: number): boolean {
    const now = this.ctx.currentTime;
    const { live, victim, tail } = this.pick(now);
    if (live < this.max || !victim) return true;
    return tail || (!victim.keep && victim.weight(now) < prio);
  }

  /** Live voices and the one a steal would take: a tail already under QUIET (the one with the most
   *  time left), else the lowest weight(), the oldest on a tie; kept voices only when all are kept. */
  private pick(now: number): { live: number; victim: Voice | null; tail: boolean } {
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
    return { live, victim: tail ?? quietest ?? oldestKept, tail: tail !== null };
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
    for (const byLevel of this.sends.values()) for (const s of byLevel.values()) s.disconnect();
    this.sends.clear();
  }
}
