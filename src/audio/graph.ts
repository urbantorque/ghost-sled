// The fixed part of the signal graph: two buses, a shared convolution reverb and the master chain.
// See the diagram at the top of engine.ts.

const MASTER_TRIM = 0.9;

/** Perceptual slider curve: half way on a slider sounds roughly half as loud. */
const curve = (v: number): number => {
  const x = v < 0 ? 0 : v > 1 ? 1 : v;
  return x * x;
};

export class Bus {
  /** Voices connect their dry output here. */
  readonly dry: GainNode;
  /** And their reverb send here. */
  readonly wet: GainNode;
  private readonly duckDry: GainNode;
  private readonly duckWet: GainNode;
  private readonly levelDry: GainNode;
  private readonly levelWet: GainNode;
  /** The reverb send's room: 1 as mixed; the soundscape opens it for a vista, an overlook or a
   *  tunnel (setSpace). */
  private readonly space: GainNode;
  private spaceNow = 1;
  private duckDepth = 1;
  private duckUntil = 0;

  constructor(ctx: BaseAudioContext, master: AudioNode, reverb: AudioNode) {
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.duckDry = ctx.createGain();
    this.duckWet = ctx.createGain();
    this.levelDry = ctx.createGain();
    this.levelWet = ctx.createGain();
    this.space = ctx.createGain();
    this.dry.connect(this.duckDry).connect(this.levelDry).connect(master);
    this.wet.connect(this.duckWet).connect(this.levelWet).connect(this.space).connect(reverb);
  }

  /** The bus after its duck and the user's level (the dry side), for a send such as the echo. */
  get post(): AudioNode {
    return this.levelDry;
  }

  /** Scales the reverb send (1 as mixed), easing with time constant tau; only when it moved. */
  setSpace(v: number, now: number, tau = 0.4): void {
    if (Math.abs(v - this.spaceNow) < 0.02) return;
    this.spaceNow = v;
    this.space.gain.setTargetAtTime(v, now, tau);
  }

  setLevel(v: number, now: number): void {
    const g = curve(v);
    this.levelDry.gain.setTargetAtTime(g, now, 0.05);
    this.levelWet.gain.setTargetAtTime(g, now, 0.05);
  }

  /** Dip to `depth`, hold, then recover with time constant `release`. A shallower duck never
   *  cuts short a deeper one that is still holding. `attack` is the dip's time constant: a drop
   *  (the band cutting out under a big bank) uses a fast one so the gap reads as a gap. */
  duck(depth: number, now: number, hold: number, release: number, attack = 0.025): void {
    if (now < this.duckUntil && depth > this.duckDepth) return;
    this.duckDepth = depth;
    this.duckUntil = now + hold;
    for (const g of [this.duckDry, this.duckWet]) {
      const p = g.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.setTargetAtTime(depth, now, attack);
      p.setTargetAtTime(1, now + hold, release);
    }
  }

  /** Two stages in one schedule: dip hard to `d1` for `h1`, settle to `d2` for `h2`, then recover.
   *  (Two duck() calls cannot do this: the second, shallower one is ignored while the first holds.) */
  duckSeq(now: number, d1: number, h1: number, d2: number, h2: number, release: number): void {
    if (now < this.duckUntil && Math.min(d1, d2) > this.duckDepth) return;
    this.duckDepth = Math.max(d1, d2);
    this.duckUntil = now + h1 + h2;
    for (const g of [this.duckDry, this.duckWet]) {
      const p = g.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.setTargetAtTime(d1, now, 0.012);
      p.setTargetAtTime(d2, now + h1, 0.04);
      p.setTargetAtTime(1, now + h1 + h2, release);
    }
  }

  /** Probe: the duck gain right now (1 = open). */
  get ducked(): number {
    return this.duckDry.gain.value;
  }

  disconnect(): void {
    for (const n of [this.dry, this.wet, this.duckDry, this.duckWet, this.levelDry, this.levelWet, this.space]) n.disconnect();
  }
}

export class Graph {
  readonly master: GainNode;
  readonly mute: GainNode;
  readonly limiter: DynamicsCompressorNode;
  readonly ceiling: GainNode;
  readonly reverb: ConvolverNode;
  readonly music: Bus;
  readonly sfx: Bus;
  private readonly verbHP: BiquadFilterNode;
  private readonly verbLP: BiquadFilterNode;
  private readonly verbOut: GainNode;
  /** The enclosure echo (a gallery or a tunnel): both buses' dry output, after the user's levels,
   *  into a short feedback delay darkened each time round, back into the master. Its taps are plugged
   *  in only while it is wanted (setEnclosed), so in the open it costs nothing. Null without
   *  DelayNode. */
  private readonly echoIn: GainNode | null = null;
  private readonly echoNodes: AudioNode[] = [];
  private echoOn = false;
  private echoWanted = false;
  private echoOffAt = 0;
  private echoNow = 0;

  constructor(ctx: BaseAudioContext, impulse: AudioBuffer) {
    this.master = ctx.createGain();
    this.master.gain.value = MASTER_TRIM;
    this.mute = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    // The mix is levelled by design (a cruise peaks near -12 dBFS); this is a fast, hard limiter
    // for stacked rewards only. Tuned against the stress probe (probe.ts): threshold -10, ratio 20
    // and a 1 ms attack hold that mix's peak near -5 dBFS (the old gentle -9, 6:1, 4 ms let it
    // reach -1), while a cruise does not move.
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.22;
    // Browsers add makeup gain inside the compressor (more with a harder ratio); this trim cancels
    // it, so the cruise mix sits where it did (about -25 dBFS RMS, the ambience alone -33).
    this.ceiling = ctx.createGain();
    this.ceiling.gain.value = 0.65;
    this.master.connect(this.mute).connect(this.limiter).connect(this.ceiling).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse;
    // Keep lows out of the tail (rumbles and kicks turn to mud) and soften the top.
    this.verbHP = ctx.createBiquadFilter();
    this.verbHP.type = 'highpass';
    this.verbHP.frequency.value = 220;
    this.verbLP = ctx.createBiquadFilter();
    this.verbLP.type = 'lowpass';
    this.verbLP.frequency.value = 7500;
    this.verbOut = ctx.createGain();
    this.verbOut.gain.value = 0.9;
    this.reverb.connect(this.verbHP).connect(this.verbLP).connect(this.verbOut).connect(this.master);

    this.music = new Bus(ctx, this.master, this.reverb);
    this.sfx = new Bus(ctx, this.master, this.reverb);

    if (typeof ctx.createDelay === 'function') {
      const echoIn = ctx.createGain();
      echoIn.gain.value = 0;
      const delay = ctx.createDelay(0.5);
      // About the slap of rock walls 18 m apart, darkening as it goes round and gone in about 0.6 s.
      delay.delayTime.value = 0.105;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400;
      const fb = ctx.createGain();
      fb.gain.value = 0.42;
      const out = ctx.createGain();
      out.gain.value = 0.7;
      echoIn.connect(delay).connect(lp).connect(fb).connect(delay);
      lp.connect(out).connect(this.master);
      this.echoIn = echoIn;
      this.echoNodes.push(echoIn, delay, lp, fb, out);
    }
  }

  /**
   * How enclosed the rider is (0 open .. 1 inside a gallery or a tunnel): the echo's send. Once it
   * has sat at zero for 2 s its taps are unplugged.
   */
  setEnclosed(k: number, now: number): void {
    const e = this.echoIn;
    if (!e) return;
    const v = k > 0.001 ? Math.min(1, k) * 0.55 : 0;
    const w = v > 0;
    if (w && !this.echoOn) {
      this.music.post.connect(e);
      this.sfx.post.connect(e);
      this.echoOn = true;
    }
    if (!w && this.echoWanted) this.echoOffAt = now + 2;
    this.echoWanted = w;
    if (this.echoOn && !w && now > this.echoOffAt) {
      this.music.post.disconnect(e);
      this.sfx.post.disconnect(e);
      this.echoOn = false;
    }
    if (Math.abs(v - this.echoNow) < 0.01) return;
    this.echoNow = v;
    e.gain.setTargetAtTime(v, now, 0.12);
  }

  /** Probe: the echo's taps are plugged in. */
  get echoing(): boolean {
    return this.echoOn;
  }

  setMaster(v: number, now: number): void {
    this.master.gain.setTargetAtTime(MASTER_TRIM * curve(v), now, 0.05);
  }

  /** `tau`: the ramp's time constant. A context the mute parked opens faster (it rendered nothing
   *  meanwhile), so a sound asked for as it resumes keeps its attack. */
  setMuted(muted: boolean, now: number, tau = 0.012): void {
    this.mute.gain.setTargetAtTime(muted ? 0 : 1, now, tau);
  }

  disconnect(): void {
    this.music.disconnect();
    this.sfx.disconnect();
    for (const n of [this.reverb, this.verbHP, this.verbLP, this.verbOut, this.master, this.mute, this.limiter, this.ceiling, ...this.echoNodes]) n.disconnect();
  }
}
