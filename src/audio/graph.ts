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
  private duckDepth = 1;
  private duckUntil = 0;

  constructor(ctx: BaseAudioContext, master: AudioNode, reverb: AudioNode) {
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.duckDry = ctx.createGain();
    this.duckWet = ctx.createGain();
    this.levelDry = ctx.createGain();
    this.levelWet = ctx.createGain();
    this.dry.connect(this.duckDry).connect(this.levelDry).connect(master);
    this.wet.connect(this.duckWet).connect(this.levelWet).connect(reverb);
  }

  setLevel(v: number, now: number): void {
    const g = curve(v);
    this.levelDry.gain.setTargetAtTime(g, now, 0.05);
    this.levelWet.gain.setTargetAtTime(g, now, 0.05);
  }

  /** Dip to `depth`, hold, then recover with time constant `release`. A shallower duck never
   *  cuts short a deeper one that is still holding. */
  duck(depth: number, now: number, hold: number, release: number): void {
    if (now < this.duckUntil && depth > this.duckDepth) return;
    this.duckDepth = depth;
    this.duckUntil = now + hold;
    for (const g of [this.duckDry, this.duckWet]) {
      const p = g.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.setTargetAtTime(depth, now, 0.025);
      p.setTargetAtTime(1, now + hold, release);
    }
  }

  disconnect(): void {
    for (const n of [this.dry, this.wet, this.duckDry, this.duckWet, this.levelDry, this.levelWet]) n.disconnect();
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

  constructor(ctx: BaseAudioContext, impulse: AudioBuffer) {
    this.master = ctx.createGain();
    this.master.gain.value = MASTER_TRIM;
    this.mute = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    // Gentle: the mix is levelled by design; this only catches stacked peaks.
    this.limiter.threshold.value = -9;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 6;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.22;
    // Browsers add makeup gain inside the compressor; this trim keeps the busiest moments of a
    // run peaking below -1.5 dBFS.
    this.ceiling = ctx.createGain();
    this.ceiling.gain.value = 0.84;
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
  }

  setMaster(v: number, now: number): void {
    this.master.gain.setTargetAtTime(MASTER_TRIM * curve(v), now, 0.05);
  }

  setMuted(muted: boolean, now: number): void {
    this.mute.gain.setTargetAtTime(muted ? 0 : 1, now, 0.012);
  }

  disconnect(): void {
    this.music.disconnect();
    this.sfx.disconnect();
    for (const n of [this.reverb, this.verbHP, this.verbLP, this.verbOut, this.master, this.mute, this.limiter, this.ceiling]) n.disconnect();
  }
}
