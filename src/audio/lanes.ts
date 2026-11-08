import type { Bank } from './buffers';
import type { LeadKind } from './theory';
import { blockRate } from './voices';

// Persistent note lanes (round 6). A lane is a small graph built once per deck whose parameters every note
// retunes and re-envelopes by automation, so a bass note, a melody note or an arp note makes no node at all
// (DECISIONS 89: on a throttled CPU a node is the dear part of a sound). Monophonic parts (the bass, the
// melody and its octave) are one lane each; the arp rotates over three or four lanes, each a pluck or an FM
// bell; a drum hit is one buffer source into its lane (drums.ts). Envelopes are pairs of setTargetAtTime
// (an attack toward the peak, a fall toward zero), which always start from the value the parameter holds,
// so a note retriggered over the last one's tail never clicks and needs no cancel.

const now0 = (ctx: BaseAudioContext): number => ctx.currentTime;

abstract class Lane {
  protected readonly nodes: AudioNode[] = [];
  protected readonly srcs: AudioScheduledSourceNode[] = [];
  constructor(protected readonly ctx: BaseAudioContext) {}

  protected gain(v: number, dest: AudioNode | AudioParam | null): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) (g.connect as (d: AudioNode | AudioParam) => void)(dest);
    this.nodes.push(g);
    return g;
  }

  protected osc(type: OscillatorType | PeriodicWave, f: number, dest: AudioNode | AudioParam): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (typeof type === 'string') o.type = type as OscillatorType;
    else o.setPeriodicWave(type);
    o.frequency.value = f;
    (o.connect as (d: AudioNode | AudioParam) => void)(dest);
    o.start(now0(this.ctx));
    this.srcs.push(o);
    this.nodes.push(o);
    return o;
  }

  protected filter(type: BiquadFilterType, f: number, q: number, dest: AudioNode): BiquadFilterNode {
    const n = blockRate(this.ctx.createBiquadFilter());
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    n.connect(dest);
    this.nodes.push(n);
    return n;
  }

  protected pan(p: number, dest: AudioNode): AudioNode {
    if (p === 0 || typeof this.ctx.createStereoPanner !== 'function') return dest;
    const s = this.ctx.createStereoPanner();
    s.pan.value = p;
    s.connect(dest);
    this.nodes.push(s);
    return s;
  }

  dispose(): void {
    for (const s of this.srcs) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
    }
    for (const n of this.nodes) n.disconnect();
    this.nodes.length = 0;
    this.srcs.length = 0;
  }
}

/** The bass: a pure sine sub at the note (mono, the weight) under a saw an octave up through a lowpass that
 *  snaps shut (the harmonics that keep the line audible on a phone speaker). */
export class BassLane extends Lane {
  private readonly env: GainNode;
  private readonly sub: OscillatorNode;
  private readonly saw: OscillatorNode;
  private readonly lp: BiquadFilterNode;

  constructor(ctx: BaseAudioContext, bank: Bank, dest: AudioNode, private readonly bright = 1) {
    super(ctx);
    this.env = this.gain(0, dest);
    this.sub = this.osc('sine', 55, this.gain(0.7, this.env));
    this.lp = this.filter('lowpass', 400, 1.1, this.gain(0.55, this.env));
    this.saw = this.osc(bank.warmSaw, 110, this.lp);
  }

  /** A note of `dur` seconds; `amp` its peak, `tail` how much of it the decay keeps (0 a pluck, 1 held). */
  note(t: number, f: number, dur: number, amp: number, tail = 0.55): void {
    this.sub.frequency.setValueAtTime(f, t);
    this.saw.frequency.setValueAtTime(f, t);
    const open = Math.min(f * 9 * this.bright, 3200);
    const shut = Math.max(f * 2.2, 180);
    const q = this.lp.frequency;
    q.setTargetAtTime(open, t, 0.002);
    q.setTargetAtTime(shut, t + 0.012, 0.09);
    const p = this.env.gain;
    p.setTargetAtTime(amp, t, 0.003);
    p.setTargetAtTime(amp * tail, t + 0.02, 0.18);
    p.setTargetAtTime(0, t + Math.max(0.04, dur), 0.035);
  }

  silence(t: number): void {
    this.env.gain.setTargetAtTime(0, t, 0.05);
  }
}

/** The melody: one voice of the style's lead (a hollow square, a breathy flute or a theremin's sine) with a
 *  vibrato that blooms in after the attack. Optional second lane an octave up doubles it when the band opens. */
export class LeadLane extends Lane {
  private readonly env: GainNode;
  private readonly oscs: OscillatorNode[] = [];
  private readonly vib: GainNode;
  private readonly breath: GainNode | null = null;
  private readonly breathBP: BiquadFilterNode | null = null;
  private readonly att: number;
  private readonly rel: number;
  private readonly depth: number;
  private last = -1;

  constructor(ctx: BaseAudioContext, bank: Bank, dest: AudioNode, readonly kind: LeadKind, pan = 0) {
    super(ctx);
    const out = this.pan(pan, dest);
    this.env = this.gain(0, out);
    this.att = kind === 'square' ? 0.012 : kind === 'flute' ? 0.03 : 0.06;
    this.rel = kind === 'theremin' ? 0.09 : 0.05;
    const lp = this.filter('lowpass', kind === 'square' ? 2600 : 3600, 0.5, this.env);
    this.vib = this.gain(0, null);
    this.osc('sine', kind === 'theremin' ? 5.1 : 5.4, this.vib);
    if (kind === 'square') {
      this.oscs.push(this.osc(bank.hollow, 440, lp));
      this.oscs.push(this.osc(bank.warmSaw, 440, this.gain(0.28, lp)));
      this.oscs[1].detune.value = 7;
    } else if (kind === 'flute') {
      this.oscs.push(this.osc('triangle', 440, lp));
      this.oscs.push(this.osc('sine', 880, this.gain(0.18, lp)));
      // Breath: white noise in a band at twice the note, under the tone.
      this.breath = this.gain(0, this.env);
      this.breathBP = this.filter('bandpass', 880, 3, this.breath);
      const src = ctx.createBufferSource();
      src.buffer = bank.white;
      src.loop = true;
      src.connect(this.breathBP);
      src.start(now0(ctx), Math.random() * bank.white.duration * 0.9);
      this.srcs.push(src);
      this.nodes.push(src);
    } else {
      this.oscs.push(this.osc('sine', 440, lp));
      this.oscs.push(this.osc('triangle', 440, this.gain(0.2, lp)));
    }
    this.depth = kind === 'theremin' ? 26 : kind === 'flute' ? 9 : 7;
    for (const o of this.oscs) this.vib.connect(o.detune);
  }

  note(t: number, f: number, dur: number, amp: number): void {
    // Theremin glides into each note; the others land on it.
    const glide = this.kind === 'theremin' && this.last > 0 ? 0.035 : 0;
    this.oscs.forEach((o, i) => {
      const m = this.kind === 'flute' && i === 1 ? 2 : 1;
      if (glide > 0) o.frequency.setTargetAtTime(f * m, t, glide);
      else o.frequency.setValueAtTime(f * m, t);
    });
    this.last = f;
    const p = this.env.gain;
    p.setTargetAtTime(amp, t, this.att / 3);
    p.setTargetAtTime(amp * 0.82, t + this.att * 2, 0.25);
    p.setTargetAtTime(0, t + Math.max(this.att * 2, dur), this.rel / 3);
    const v = this.vib.gain;
    v.setTargetAtTime(0, t, 0.01);
    if (dur > 0.22) v.setTargetAtTime(this.depth, t + Math.min(0.28, dur * 0.45), 0.12);
    if (this.breath && this.breathBP) {
      this.breathBP.frequency.setValueAtTime(f * 2, t);
      const b = this.breath.gain;
      b.setTargetAtTime(amp * 0.9, t, 0.01);
      b.setTargetAtTime(amp * 0.25, t + 0.06, 0.08);
      b.setTargetAtTime(0, t + Math.max(0.06, dur), 0.03);
    }
  }

  silence(t: number): void {
    this.env.gain.setTargetAtTime(0, t, 0.04);
    if (this.breath) this.breath.gain.setTargetAtTime(0, t, 0.04);
  }
}

export type ArpTone = 'pluck' | 'koto' | 'fm';

/** One arp lane: a saw pluck through a lowpass that snaps shut, or a two-operator FM bell. */
class ArpLane extends Lane {
  private readonly env: GainNode;
  private readonly car: OscillatorNode;
  private readonly mod: OscillatorNode | null = null;
  private readonly modG: GainNode | null = null;
  private readonly lp: BiquadFilterNode | null = null;

  constructor(ctx: BaseAudioContext, bank: Bank, dest: AudioNode, readonly tone: ArpTone, pan: number) {
    super(ctx);
    this.env = this.gain(0, this.pan(pan, dest));
    if (tone === 'fm') {
      this.car = this.osc('sine', 440, this.env);
      this.modG = this.gain(0, this.car.frequency);
      this.mod = this.osc('sine', 880, this.modG);
    } else {
      this.lp = this.filter('lowpass', 2000, 0.9, this.env);
      this.car = this.osc(bank.warmSaw, 440, this.lp);
    }
  }

  note(t: number, f: number, amp: number, tau: number, bright: number, ratio: number, index: number, bend: number): void {
    // The last note's tail (already 13 dB or more down) is faded in 6 ms before the retune, so its pitch
    // never jumps audibly.
    const p = this.env.gain;
    p.setTargetAtTime(0, t - 0.007, 0.0015);
    this.car.frequency.setValueAtTime(bend ? f * (1 + bend) : f, t);
    if (bend) this.car.frequency.setTargetAtTime(f, t + 0.002, 0.025);
    if (this.mod && this.modG) {
      this.mod.frequency.setValueAtTime(f * ratio, t);
      const mg = this.modG.gain;
      mg.setValueAtTime(index * f * ratio, t);
      mg.setTargetAtTime(index * f * ratio * 0.1, t + 0.001, tau * 0.3);
    }
    if (this.lp) {
      const open = Math.min(f * bright * 4, 12000);
      this.lp.frequency.setValueAtTime(open, t);
      this.lp.frequency.setTargetAtTime(Math.max(f * 1.2, 150), t + 0.004, tau * 0.35);
    }
    p.setTargetAtTime(amp, t, 0.001);
    p.setTargetAtTime(0, t + 0.004, tau);
  }
}

/** The arp's lanes: notes rotate over them, each lane at its own place across the stereo field (the arp's
 *  width, which folds to mono with no comb: plain panning). */
export class ArpLanes {
  private readonly lanes: ArpLane[];
  private k = 0;

  constructor(ctx: BaseAudioContext, bank: Bank, dest: AudioNode, readonly tone: ArpTone, n: number) {
    const pans = n >= 4 ? [-0.45, 0.15, 0.45, -0.15] : [-0.4, 0.4, 0];
    this.lanes = Array.from({ length: n }, (_, i) => new ArpLane(ctx, bank, dest, tone, pans[i % pans.length]));
  }

  note(t: number, f: number, amp: number, tau: number, bright: number, ratio = 2, index = 1, bend = 0): void {
    const lane = this.lanes[this.k++ % this.lanes.length];
    lane.note(t, f, amp, tau, bright, ratio, index, bend);
  }

  dispose(): void {
    for (const l of this.lanes) l.dispose();
  }
}

/** A drum lane: each hit is one buffer source into the lane's gain, whose level is set to the hit's velocity
 *  at the hit (hits on one lane hardly overlap, and a new transient masks the step in the old tail). */
export class DrumLane extends Lane {
  readonly out: GainNode;

  constructor(ctx: BaseAudioContext, dest: AudioNode, pan = 0, private readonly take?: () => AudioBufferSourceNode) {
    super(ctx);
    this.out = this.gain(0, this.pan(pan, dest));
  }

  hit(buf: AudioBuffer, t: number, vel: number, rate = 1): void {
    const s = this.take ? this.take() : this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = false;
    if (rate !== 1) s.playbackRate.value = rate;
    s.connect(this.out);
    this.out.gain.setValueAtTime(vel, t);
    s.start(t);
    s.stop(t + buf.duration / rate + 0.01);
  }
}

/** The build's riser: noise through a band that climbs, swelling to the drop and cut on it. Re-planned
 *  freely: a new rise cancels the last. */
export class RiserLane extends Lane {
  private readonly env: GainNode;
  private readonly bp: BiquadFilterNode;
  private readonly src: AudioBufferSourceNode;
  private on = false;

  constructor(ctx: BaseAudioContext, bank: Bank, dest: AudioNode) {
    super(ctx);
    this.env = this.gain(0, dest);
    this.bp = this.filter('bandpass', 500, 1.4, this.env);
    this.src = ctx.createBufferSource();
    this.src.buffer = bank.white;
    this.src.loop = true;
    this.src.start(now0(ctx), Math.random() * bank.white.duration * 0.9);
    this.srcs.push(this.src);
    this.nodes.push(this.src);
  }

  rise(t0: number, t1: number, amp: number): void {
    if (!this.on) {
      this.src.connect(this.bp);
      this.on = true;
    }
    const now = Math.max(now0(this.ctx), 0);
    const a = Math.max(now, t0);
    const g = this.env.gain;
    const f = this.bp.frequency;
    g.cancelScheduledValues(now);
    f.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    f.setValueAtTime(f.value, now);
    g.setValueAtTime(Math.max(0.0001, g.value), a);
    g.exponentialRampToValueAtTime(amp, Math.max(a + 0.05, t1 - 0.01));
    g.setTargetAtTime(0, Math.max(a + 0.05, t1 - 0.01), 0.008);
    f.setValueAtTime(400, a);
    f.exponentialRampToValueAtTime(6500, Math.max(a + 0.05, t1));
  }

  /** Drops a planned rise (the landing was called off). */
  stop(t: number): void {
    const g = this.env.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0, t, 0.05);
  }
}
