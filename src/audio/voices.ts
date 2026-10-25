import type { Bank } from './buffers';

// One-shot voices and the pool that caps them. A voice is the unit of polyphony: a small node graph
// with a known end time. When the pool is full the oldest voice is faded out in a few milliseconds
// (inaudible next to a fresh attack) and every finished voice is disconnected by sweep().

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
  private readonly nodes: AudioNode[] = [];
  private readonly srcs: AudioScheduledSourceNode[] = [];

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
    return s;
  }

  /** Sine LFO added onto a parameter. */
  lfo(rate: number, depth: number, dest: AudioParam, t0: number, t1: number, type: OscillatorType = 'sine'): GainNode {
    const g = this.gain(depth, dest);
    this.osc(type, rate, t0, t1, g);
    return g;
  }

  /** Keeps the voice allocated until at least t (parts of it will be added later). */
  hold(t: number): void {
    if (t > this.end) this.end = t;
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

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly bank: Bank,
    readonly max: number,
  ) {}

  voice(t0: number, level: number, dry: AudioNode, wet: AudioNode | null, send: number, pan = 0): Voice {
    const now = this.ctx.currentTime;
    this.sweep(now);
    let live = 0;
    let oldest: Voice | null = null;
    let oldestKept: Voice | null = null;
    for (const v of this.list) {
      if (v.dead || v.end <= now) continue;
      live++;
      if (v.keep) oldestKept ??= v;
      else oldest ??= v;
    }
    const victim = oldest ?? oldestKept;
    if (live >= this.max && victim) victim.kill(now);
    const v = new Voice(this.ctx, this.bank, t0, level, dry, wet, send, pan);
    this.list.push(v);
    return v;
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
