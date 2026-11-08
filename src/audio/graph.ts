// The fixed part of the signal graph: two buses, a shared convolution reverb and the master chain.
// See the diagram at the top of engine.ts.
import { loadMaster } from './master';

const MASTER_TRIM = 0.9;
/** The fallback limiter's trim (a DynamicsCompressor adds makeup gain inside; this cancels it). */
const CEILING_FALLBACK = 0.65;
/**
 * The true-peak limiter's ceiling, linear: -1.2 dBTP, under the -1 dBTP target with room for a decoder's
 * overshoot. And the gain after it that keeps the mix where the loudness target puts it (round 6: about -16
 * LUFS integrated over a run at the default sliders, against -18.2 before): the old chain netted +2 dB under
 * its threshold (its makeup over the 0.65 trim), and the new one lifts the whole mix 2 dB more on top of
 * that, which the limiter's ceiling now has room for.
 */
const TP_CEILING = 0.871;
const TP_GAIN = 1.26;
/** The music bus's glue compressor adds its own makeup gain (Chrome, Firefox and Safari share the
 *  algorithm: (1 / full-range gain)^0.6); this cancels it, so the glue only shapes. */
const GLUE_TRIM = 0.52;
/** The music brought up to sit with the effects, not under them (2.8 LU under them in round 5). */
const MUSIC_GAIN = 1.35;
/** The sidechain: how far the music gives way under the one-shot effects (dB at most), and where. */
const DUCK = { threshold: -34, ratio: 2.5, range: 5, attack: 0.005, release: 0.22 } as const;

/** Perceptual slider curve: half way on a slider sounds roughly half as loud. */
const curve = (v: number): number => {
  const x = v < 0 ? 0 : v > 1 ? 1 : v;
  return x * x;
};

export interface BusOpts {
  /** The music bus: a glue compressor and side gains (driven by the sidechain) on both paths. */
  music?: boolean;
  /** The effects bus: a separate input for the one-shots, which also keys the sidechain. */
  shots?: boolean;
}

export class Bus {
  /** Voices connect their dry output here. */
  readonly dry: GainNode;
  /** And their reverb send here. */
  readonly wet: GainNode;
  /** The effects bus's one-shots (into dry, and the sidechain's key), or null. */
  readonly shots: GainNode | null = null;
  /** The key the sidechain listens to: the one-shots at the user's level. */
  readonly key: GainNode | null = null;
  /** The music bus's side gains (the sidechain drives them), or null. */
  readonly sideDry: GainNode | null = null;
  readonly sideWet: GainNode | null = null;
  readonly glue: DynamicsCompressorNode | null = null;
  private readonly duckDry: GainNode;
  private readonly duckWet: GainNode;
  private readonly levelDry: GainNode;
  private readonly levelWet: GainNode;
  private readonly extra: AudioNode[] = [];
  /** The reverb send's room: 1 as mixed; the soundscape opens it for a vista, an overlook or a
   *  tunnel (setSpace). */
  private readonly space: GainNode;
  private spaceNow = 1;
  private duckDepth = 1;
  private duckUntil = 0;

  constructor(ctx: BaseAudioContext, master: AudioNode, reverb: AudioNode, opts: BusOpts = {}) {
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.duckDry = ctx.createGain();
    this.duckWet = ctx.createGain();
    this.levelDry = ctx.createGain();
    this.levelWet = ctx.createGain();
    this.space = ctx.createGain();
    let dryIn: AudioNode = this.dry;
    let wetIn: AudioNode = this.wet;
    if (opts.music) {
      // Glue: a gentle bus compressor on the band's dry path (2.2:1 from -22 dBFS, soft knee, 15 ms in,
      // 220 ms out), so the layers move as one; its makeup is trimmed away.
      const glue = ctx.createDynamicsCompressor();
      glue.threshold.value = -22;
      glue.knee.value = 12;
      glue.ratio.value = 2.2;
      glue.attack.value = 0.015;
      glue.release.value = 0.22;
      const trim = ctx.createGain();
      trim.gain.value = GLUE_TRIM * MUSIC_GAIN;
      const wetTrim = ctx.createGain();
      wetTrim.gain.value = MUSIC_GAIN;
      this.glue = glue;
      this.sideDry = ctx.createGain();
      this.sideWet = ctx.createGain();
      this.dry.connect(glue).connect(trim).connect(this.sideDry);
      this.wet.connect(wetTrim).connect(this.sideWet);
      this.extra.push(glue, trim, wetTrim, this.sideDry, this.sideWet);
      dryIn = this.sideDry;
      wetIn = this.sideWet;
    }
    if (opts.shots) {
      this.shots = ctx.createGain();
      this.key = ctx.createGain();
      this.shots.connect(this.dry);
      this.shots.connect(this.key);
      this.extra.push(this.shots, this.key);
    }
    dryIn.connect(this.duckDry).connect(this.levelDry).connect(master);
    wetIn.connect(this.duckWet).connect(this.levelWet).connect(this.space).connect(reverb);
  }

  /** The bus after its duck and the user's level (the dry side), for a send such as the echo. */
  get post(): AudioNode {
    return this.levelDry;
  }

  setSpace(v: number, now: number, tau = 0.4): void {
    if (Math.abs(v - this.spaceNow) < 0.02) return;
    this.spaceNow = v;
    this.space.gain.setTargetAtTime(v, now, tau);
  }

  setLevel(v: number, now: number): void {
    const g = curve(v);
    this.levelDry.gain.setTargetAtTime(g, now, 0.05);
    this.levelWet.gain.setTargetAtTime(g, now, 0.05);
    // The key follows the user's level: effects turned down duck the music less, turned off not at all.
    this.key?.gain.setTargetAtTime(g, now, 0.05);
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
    for (const n of [this.dry, this.wet, this.duckDry, this.duckWet, this.levelDry, this.levelWet, this.space, ...this.extra]) n.disconnect();
  }
}

export class Graph {
  readonly master: GainNode;
  readonly mute: GainNode;
  /** The fallback limiter (a fast DynamicsCompressor), in the chain until the true-peak limiter loads. */
  readonly limiter: DynamicsCompressorNode;
  readonly ceiling: GainNode;
  readonly reverb: ConvolverNode;
  readonly music: Bus;
  readonly sfx: Bus;
  /** Resolves once the master chain is final: true with the true-peak limiter and the sidechain, false on
   *  the fallback (no AudioWorklet). Offline renders wait for it. */
  readonly ready: Promise<boolean>;
  /** The true-peak limiter and the sidechain, once loaded. */
  tp: AudioWorkletNode | null = null;
  side: AudioWorkletNode | null = null;
  private readonly lowcut: BiquadFilterNode | null = null;
  private readonly verbHP: BiquadFilterNode;
  private readonly verbLP: BiquadFilterNode;
  private readonly verbOut: GainNode;
  private readonly echoIn: GainNode | null = null;
  private readonly echoNodes: AudioNode[] = [];
  private echoOn = false;
  private echoWanted = false;
  private echoOffAt = 0;
  private echoNow = 0;
  private disposed = false;

  constructor(private readonly ctx: BaseAudioContext, impulse: AudioBuffer) {
    this.master = ctx.createGain();
    this.master.gain.value = MASTER_TRIM;
    this.mute = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    // The fallback: a fast, hard limiter for stacked rewards (threshold -10, ratio 20, 1 ms attack).
    this.limiter.threshold.value = -10;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.22;
    this.ceiling = ctx.createGain();
    this.ceiling.gain.value = CEILING_FALLBACK;
    // Below 25 Hz there is nothing to hear and only headroom to lose (the kick's and the boom's tails).
    let pre: AudioNode = this.mute;
    if (typeof ctx.createBiquadFilter === 'function') {
      const lc = ctx.createBiquadFilter();
      lc.type = 'highpass';
      lc.frequency.value = 25;
      lc.Q.value = 0.6;
      this.mute.connect(lc);
      this.lowcut = lc;
      pre = lc;
    }
    this.master.connect(this.mute);
    pre.connect(this.limiter).connect(this.ceiling).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse;
    this.verbHP = ctx.createBiquadFilter();
    this.verbHP.type = 'highpass';
    this.verbHP.frequency.value = 220;
    this.verbLP = ctx.createBiquadFilter();
    this.verbLP.type = 'lowpass';
    this.verbLP.frequency.value = 7500;
    this.verbOut = ctx.createGain();
    this.verbOut.gain.value = 0.9;
    this.reverb.connect(this.verbHP).connect(this.verbLP).connect(this.verbOut).connect(this.master);

    this.music = new Bus(ctx, this.master, this.reverb, { music: true });
    this.sfx = new Bus(ctx, this.master, this.reverb, { shots: true });

    if (typeof ctx.createDelay === 'function') {
      const echoIn = ctx.createGain();
      echoIn.gain.value = 0;
      const delay = ctx.createDelay(0.5);
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
    this.ready = loadMaster(ctx).then((ok) => (ok ? this.finalize() : false), () => false);
  }

  /** The worklets loaded: the true-peak limiter takes the fallback's place, the sidechain drives the music
   *  bus's side gains. */
  private finalize(): boolean {
    if (this.disposed) return false;
    const ctx = this.ctx;
    try {
      const tp = new AudioWorkletNode(ctx, 'gs-limiter', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      (tp.parameters.get('ceiling') as AudioParam).value = TP_CEILING;
      const side = new AudioWorkletNode(ctx, 'gs-duck', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      const P = (k: keyof typeof DUCK): AudioParam => side.parameters.get(k) as AudioParam;
      for (const k of Object.keys(DUCK) as (keyof typeof DUCK)[]) P(k).value = DUCK[k];
      const pre = this.lowcut ?? this.mute;
      pre.disconnect(this.limiter);
      this.limiter.disconnect();
      pre.connect(tp).connect(this.ceiling);
      this.ceiling.gain.value = TP_GAIN;
      const key = this.sfx.key;
      const sd = this.music.sideDry;
      const sw = this.music.sideWet;
      if (key && sd && sw) {
        key.connect(side);
        sd.gain.value = 0;
        sw.gain.value = 0;
        side.connect(sd.gain);
        side.connect(sw.gain);
      }
      this.tp = tp;
      this.side = side;
      return true;
    } catch {
      return false;
    }
  }

  /** Probe: the limiter's and the sidechain's deepest gain since the last ask (null on the fallback). */
  async debugGain(): Promise<{ limiter: number; side: number } | null> {
    const ask = (n: AudioWorkletNode | null): Promise<number> =>
      new Promise((res) => {
        if (!n) return res(1);
        const t = setTimeout(() => res(1), 300);
        n.port.onmessage = (e: MessageEvent) => {
          clearTimeout(t);
          res((e.data as { minGain: number }).minGain);
        };
        n.port.postMessage(0);
      });
    if (!this.tp) return null;
    const [limiter, side] = await Promise.all([ask(this.tp), ask(this.side)]);
    return { limiter, side };
  }

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

  get echoing(): boolean {
    return this.echoOn;
  }

  setMaster(v: number, now: number): void {
    this.master.gain.setTargetAtTime(MASTER_TRIM * curve(v), now, 0.05);
  }

  setMuted(muted: boolean, now: number, tau = 0.012): void {
    this.mute.gain.setTargetAtTime(muted ? 0 : 1, now, tau);
  }

  disconnect(): void {
    this.disposed = true;
    this.music.disconnect();
    this.sfx.disconnect();
    for (const n of [this.reverb, this.verbHP, this.verbLP, this.verbOut, this.master, this.mute, this.limiter, this.ceiling, ...this.echoNodes]) n.disconnect();
    this.lowcut?.disconnect();
    this.tp?.disconnect();
    this.side?.disconnect();
  }
}
