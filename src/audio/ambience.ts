import type { Bank } from './buffers';
import type { AudioFrame } from './engine';
import type { Bus } from './graph';
import type { Scene } from './music';
import { type Key, fit, ladderAt, mtof } from './theory';
import type { SledSoundId } from './sledsounds';
import { bandComp, blockRate, clamp, smoothstep } from './voices';

// Continuous layers: wind and snow surface, plus three voices that read the run's feel: the wind
// turning into a tone in the song's key as earned flow builds, the drift whine climbing the key's
// pentatonic ladder with the drift charge, and the shoulder hiss of a rival closing behind you. The
// whole graph is built once and only its parameters move, so update() never creates a node. Three
// looping noise sources (white, pink, brown) feed every filter branch; two grain-train sources chop
// the crunch and scrape into granules.

/** A fourth down: the flow tone bends this far when a bump snuffs it. */
const FOURTH_DOWN = 0.7491535384383408;
/** The shoulder hiss at full presence (a ghost on your heel and gaining). */
const SHOULDER_GAIN = 0.8;
/** The shoulder's level rising this fast (per second) is a ghost closing at full tilt: about 2 m/s
 *  faster than you within the last 2 m. */
const SHOULDER_CLOSING = 0.6;

export type Link = readonly [AudioNode, AudioNode | AudioParam];

export function connect([a, b]: Link): void {
  if (b instanceof AudioNode) a.connect(b);
  else a.connect(b);
}

export function disconnect([a, b]: Link): void {
  if (b instanceof AudioNode) a.disconnect(b);
  else a.disconnect(b);
}

/** A branch filtering live noise costs CPU even at zero gain. Once its gain target reaches zero
 *  and the fade has died away (at least 2 s, or 8 time constants: -70 dB, so slow fades such as
 *  the post-crash rumble are not cut short) the branch input is unplugged, and it is plugged back
 *  in as soon as the target rises again. */
export class Gate {
  private on = true;
  private wanted = false;
  private offAt = 2;

  constructor(private readonly links: readonly Link[]) {}

  want(v: number, now: number, tau: number): void {
    const w = v > 1e-4;
    if (w && !this.on) {
      for (const l of this.links) connect(l);
      this.on = true;
    }
    if (!w && this.wanted) this.offAt = now + Math.max(2, tau * 8);
    this.wanted = w;
  }

  tick(now: number): void {
    if (this.on && !this.wanted && now > this.offAt) {
      for (const l of this.links) disconnect(l);
      this.on = false;
    }
  }
}

/** setTargetAtTime only when the value moved enough to matter, so the automation timeline does
 *  not grow by a dozen events every frame. */
export class Smooth {
  private last = NaN;

  constructor(
    private readonly p: AudioParam,
    private readonly eps: number,
    private readonly rel = false,
    private readonly gate: Gate | null = null,
  ) {}

  to(v: number, now: number, tau: number): void {
    this.gate?.want(v, now, tau);
    const tol = this.rel ? this.eps * Math.abs(this.last) : this.eps;
    if (Math.abs(v - this.last) <= tol) return;
    this.last = v;
    this.p.setTargetAtTime(v, now, tau);
  }

  /** The parameter was moved directly: the next to() always applies. */
  reset(): void {
    this.last = Number.NaN;
  }
}

const CALM: AudioFrame = {
  speed: 13,
  grounded: true,
  carve: 0,
  drifting: false,
  slip: 0,
  onIce: false,
  boostGlow: 0,
  drafting: false,
  comboChain: 0,
  comboMult: 1,
  intensity: 0,
  danger: 0,
  crashed: false,
};

export class Ambience {
  private readonly out: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly srcs: AudioScheduledSourceNode[] = [];
  private readonly hum1: OscillatorNode;
  private readonly hum2: OscillatorNode;
  private humNote = -1;
  private scene: Scene = 'title';
  private lastFrame = -1;
  private calmed = false;
  private readonly gates: Gate[] = [];
  /** The bed's three looping noise sources, shared with the soundscape (scape.ts) so it adds none. */
  readonly noise: { white: AudioBufferSourceNode; pink: AudioBufferSourceNode; brown: AudioBufferSourceNode };
  /** How exposed the rider is (0..1, set by the soundscape: open banks, height, an overlook): the
   *  wind blows up to half again as hard, and a little higher. */
  exposure = 0;
  /** The pocket wide open; kept under Nyquist, which Chrome would clamp with a warning. */
  private readonly open: number;

  private readonly windF: Smooth;
  private readonly windQ: Smooth;
  private readonly windG: Smooth;
  private readonly roarG: Smooth;
  private readonly whistleF: Smooth;
  private readonly whistleG: Smooth;
  private readonly pocketF: Smooth;
  private readonly humG: Smooth;
  private readonly boostF: Smooth;
  private readonly boostG: Smooth;
  private readonly hissF: Smooth;
  private readonly hissG: Smooth;
  /** A rail under the runners: a high band of metal hiss, plugged in only while grinding. */
  private readonly railG: Smooth;
  private railOn = false;
  private readonly crunchRate: Smooth;
  private readonly crunchF: Smooth;
  private readonly crunchG: Smooth;
  private readonly sprayG: Smooth;
  private readonly scrapeF: Smooth;
  private readonly scrapeRate: Smooth;
  private readonly scrapeG: Smooth;
  private readonly iceG: Smooth;
  private readonly ringG: Smooth;
  private readonly rumbleF: Smooth;
  private readonly rumbleG: Smooth;

  /** In-key voices and the shoulder hiss: straight onto the effects bus at their own levels (the
   *  bed's run trim would bury a sine), silent outside a run. */
  private readonly tone: GainNode;
  private readonly whine1: OscillatorNode;
  private readonly whine2: OscillatorNode;
  private readonly whineG: Smooth;
  private whineGain: AudioParam;
  private whineNote = -1;
  /** Until this time a release whip owns the whine (pitch up an octave, gain away). */
  private whipUntil = 0;
  private readonly shoulderF: Smooth;
  private readonly shoulderG: Smooth;
  private readonly shoulderPan: Smooth | null;
  private readonly shoulderRate: Smooth;
  /** The shoulder's last level and time, and how fast it is closing (0..1, smoothed). */
  private shPrev = 0;
  private shAt = -1;
  private shClose = 0;
  /** The wind's last centre and Q, and the snuff's bend (a fourth down, Q held) while it lasts. */
  private windNow = 500;
  private windQNow = 0.7;
  private snuffUntil = 0;
  private snuffF = 500;
  private snuffQ = 0.7;
  private readonly windParam: AudioParam;
  /** The garage's sled sound (sledsounds.ts): a small fixed graph under your own runners, built when it is
   *  chosen (in the garage, never in a run frame) and moved by automation only, like the rest of the bed. */
  private sledId: SledSoundId = 'runners';
  private sledG: Smooth | null = null;
  private sledF: Smooth | null = null;
  private sledRate: Smooth | null = null;
  private sledOscs: OscillatorNode[] = [];
  private sledNodes: AudioNode[] = [];
  private sledNote = -1;
  /** A link into the shared noise the timber's creak takes (undone when the sound changes). */
  private sledLink: [AudioNode, AudioNode] | null = null;
  private cells = 0;
  private readonly bankRef: Bank;
  private readonly surfOut: GainNode;

  constructor(
    private readonly ctx: BaseAudioContext,
    bank: Bank,
    bus: Bus,
  ) {
    const gain = (v: number, dest: AudioNode | AudioParam): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      if (dest instanceof AudioNode) g.connect(dest);
      else g.connect(dest);
      this.nodes.push(g);
      return g;
    };
    const filter = (type: BiquadFilterType, f: number, q: number, dest: AudioNode, db = 0): BiquadFilterNode => {
      const n = blockRate(ctx.createBiquadFilter());
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      n.gain.value = db;
      n.connect(dest);
      this.nodes.push(n);
      return n;
    };
    const loop = (buf: AudioBuffer, rate = 1): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start(ctx.currentTime, Math.random() * buf.duration * 0.9);
      this.srcs.push(s);
      return s;
    };
    const osc = (type: OscillatorType, f: number, dest: AudioNode | AudioParam | null): OscillatorNode => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      if (dest) connect([o, dest]);
      o.start(ctx.currentTime);
      this.srcs.push(o);
      return o;
    };
    const P = (p: AudioParam, eps: number, rel = false): Smooth => new Smooth(p, eps, rel);
    /** A gain smoother whose branch is unplugged while silent. */
    const G = (p: AudioParam, links: Link[]): Smooth => {
      for (const l of links) connect(l);
      const gate = new Gate(links);
      this.gates.push(gate);
      return new Smooth(p, 0.002, false, gate);
    };

    this.open = Math.min(16000, ctx.sampleRate * 0.45);
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(bus.dry);
    this.out.connect(gain(0.1, bus.wet));

    const white = loop(bank.white);
    const pink = loop(bank.pink);
    const brown = loop(bank.brown);
    this.noise = { white, pink, brown };

    // Wind: everything here passes the drafting pocket, a lowpass that closes in a slipstream.
    const pocket = filter('lowpass', this.open, 0.5, this.out);
    this.pocketF = P(pocket.frequency, 0.02, true);

    const windG = gain(0, pocket);
    const gust = gain(1, windG);
    // Two slow incommensurate LFOs give gusts that never audibly repeat.
    osc('sine', 0.11, gain(0.16, gust.gain));
    osc('sine', 0.037, gain(0.12, gust.gain));
    const windBP = filter('bandpass', 500, 0.7, gust);
    pink.connect(windBP);
    this.windParam = windBP.frequency;
    this.windF = P(windBP.frequency, 0.015, true);
    this.windQ = P(windBP.Q, 0.02);
    this.windG = P(windG.gain, 0.002);

    const roarG = gain(0, pocket);
    const roarBP = filter('bandpass', 170, 0.5, roarG);
    this.roarG = G(roarG.gain, [[brown, roarBP]]);

    const whistleG = gain(0, pocket);
    const whistleBP = filter('bandpass', 2200, 7, whistleG);
    osc('sine', 0.19, gain(240, whistleBP.frequency));
    this.whistleF = P(whistleBP.frequency, 0.015, true);
    this.whistleG = G(whistleG.gain, [[white, whistleBP]]);

    const boostG = gain(0, this.out);
    const boostBP = filter('bandpass', 1000, 1.3, boostG);
    this.boostF = P(boostBP.frequency, 0.015, true);
    this.boostG = G(boostG.gain, [[white, boostBP]]);

    // The slipstream hum, tuned to the soundtrack's tonic.
    const humG = gain(0, this.out);
    const hum2G = gain(0.5, humG);
    this.hum1 = osc('sine', 55, null);
    this.hum2 = osc('sine', 82.5, null);
    this.humG = G(humG.gain, [[this.hum1, humG], [this.hum2, hum2G]]);

    // Surface.
    const surf = gain(1, this.out);
    this.surfOut = surf;
    this.bankRef = bank;

    const hissG = gain(0, surf);
    const hissBP = filter('bandpass', 3000, 0.6, hissG);
    this.hissF = P(hissBP.frequency, 0.015, true);
    this.hissG = G(hissG.gain, [[white, hissBP]]);

    const railG = gain(0, surf);
    const railBP = filter('bandpass', 4700, 2.4, railG);
    this.railG = G(railG.gain, [[white, railBP]]);

    const crunchG = gain(0, surf);
    const crunchAM = gain(0, crunchG);
    const crunchGrains = loop(bank.grains);
    const crunchBP = filter('bandpass', 1200, 0.9, crunchAM);
    this.crunchRate = P(crunchGrains.playbackRate, 0.02, true);
    this.crunchF = P(crunchBP.frequency, 0.015, true);
    this.crunchG = G(crunchG.gain, [[pink, crunchBP], [crunchGrains, crunchAM.gain]]);

    const sprayG = gain(0, surf);
    const sprayHP = filter('highpass', 500, 0.6, sprayG);
    const sprayLP = filter('lowpass', 6500, 0.6, sprayHP);
    this.sprayG = G(sprayG.gain, [[white, sprayLP]]);

    const scrapeG = gain(0, surf);
    // A floor under the grains keeps the scrape continuous; the grains add the grit.
    const scrapeAM = gain(0.2, scrapeG);
    const scrapeGrains = loop(bank.grains, 2);
    const scrapeBP = filter('bandpass', 650, 2.2, scrapeAM);
    this.scrapeF = P(scrapeBP.frequency, 0.015, true);
    this.scrapeRate = P(scrapeGrains.playbackRate, 0.02, true);
    this.scrapeG = G(scrapeG.gain, [[pink, scrapeBP], [scrapeGrains, scrapeAM.gain]]);

    const iceG = gain(0, surf);
    const icePk = filter('peaking', 8000, 2.5, iceG, 7);
    const iceHP = filter('highpass', 4500, 0.7, icePk);
    this.iceG = G(iceG.gain, [[white, iceHP]]);
    // A faint resonance makes ice sing like glass under the runners.
    const ringG = gain(0, surf);
    const ringBP = filter('bandpass', 3300, 16, ringG);
    this.ringG = G(ringG.gain, [[white, ringBP]]);

    // The avalanche at your back.
    const rumbleG = gain(0, this.out);
    const rumbleLP = filter('lowpass', 110, 0.7, rumbleG);
    this.rumbleF = P(rumbleLP.frequency, 0.02, true);
    this.rumbleG = G(rumbleG.gain, [[brown, rumbleLP]]);

    this.tone = ctx.createGain();
    this.tone.gain.value = 0;
    this.tone.connect(bus.dry);
    this.tone.connect(gain(0.12, bus.wet));

    // Drift whine: a sine and a quiet triangle an octave up, on the key's pentatonic ladder.
    const whineG = gain(0, this.tone);
    const whine2G = gain(0.25, whineG);
    this.whine1 = osc('sine', 587, null);
    this.whine2 = osc('triangle', 1174, null);
    this.whineGain = whineG.gain;
    this.whineG = G(whineG.gain, [[this.whine1, whineG], [this.whine2, whine2G]]);

    // Shoulder: a rival's runners over the shoulder it is closing on. A band of hiss above the wind's,
    // chopped by a grain train so it reads as runners, not weather. Summed to mono before the panner:
    // a stereo source only half pans (the far channel keeps its own side), mono pans equal-power.
    let shTail: AudioNode = this.tone;
    let pan: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      pan = ctx.createStereoPanner();
      pan.channelCount = 1;
      pan.channelCountMode = 'explicit';
      pan.connect(this.tone);
      this.nodes.push(pan);
      shTail = pan;
    }
    const shG = gain(0, shTail);
    // A floor under the grains keeps it continuous; the grains (at half depth, so they never spike
    // over the bed's peaks) add the runners' chatter.
    const shAM = gain(0.45, shG);
    const shDepth = gain(0.55, shAM.gain);
    const shGrains = loop(bank.grains, 1.3);
    const shBP = filter('bandpass', 1500, 2.5, shAM);
    this.shoulderF = P(shBP.frequency, 0.02, true);
    this.shoulderRate = P(shGrains.playbackRate, 0.03, true);
    this.shoulderG = G(shG.gain, [[white, shBP], [shGrains, shDepth]]);
    this.shoulderPan = pan ? P(pan.pan, 0.03) : null;
  }

  /** Full lanterns (0 to 3): the Lantern Song brightens as they fill. */
  setCells(n: number): void {
    this.cells = clamp(n, 0, 3);
  }

  /**
   * The sled sound under your runners. Steel Runners is the bed as it was; the others add one small voice:
   * Sleigh Bells a string of bells shaken harder the harder you carve, Old Timber a creak of boards in the
   * crunch, Glass Chime a rubbed glass singing the key's tonic and its fifth, Lantern Song a warm hum on the
   * tonic whose lowpass opens a step for each full lantern. Only your own runners: no cue, no ghost.
   */
  setSled(id: SledSoundId): void {
    if (id === this.sledId) return;
    for (const o of this.sledOscs) {
      try {
        o.stop();
      } catch {
        // Already stopped.
      }
    }
    for (const n of this.sledNodes) n.disconnect();
    if (this.sledLink) {
      try {
        this.sledLink[0].disconnect(this.sledLink[1]);
      } catch {
        // Already gone.
      }
      this.sledLink = null;
    }
    this.sledOscs = [];
    this.sledNodes = [];
    this.sledG = this.sledF = this.sledRate = null;
    this.sledNote = -1;
    this.sledId = id;
    if (id === 'runners') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const node = <T extends AudioNode>(n: T): T => {
      this.sledNodes.push(n);
      return n;
    };
    const g = node(ctx.createGain());
    g.gain.value = 0;
    g.connect(this.surfOut);
    this.sledG = new Smooth(g.gain, 0.002);
    if (id === 'bells') {
      const src = node(ctx.createBufferSource());
      src.buffer = this.bankRef.jingle;
      src.loop = true;
      const hp = node(blockRate(ctx.createBiquadFilter()));
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      src.connect(hp).connect(g);
      src.start(t, Math.random() * this.bankRef.jingle.duration * 0.9);
      this.sledOscs.push(src as unknown as OscillatorNode);
      this.sledRate = new Smooth(src.playbackRate, 0.02, true);
    } else if (id === 'timber') {
      const bp = node(blockRate(ctx.createBiquadFilter()));
      bp.type = 'bandpass';
      bp.frequency.value = 240;
      bp.Q.value = 7;
      const am = node(ctx.createGain());
      am.gain.value = 0;
      const grains = node(ctx.createBufferSource());
      grains.buffer = this.bankRef.grains;
      grains.loop = true;
      grains.playbackRate.value = 0.6;
      grains.connect(am.gain);
      grains.start(t);
      this.sledOscs.push(grains as unknown as OscillatorNode);
      this.noise.brown.connect(am);
      this.sledLink = [this.noise.brown, am];
      am.connect(bp).connect(g);
      this.sledNodes.push(am);
      this.sledF = new Smooth(bp.frequency, 0.02, true);
      this.sledRate = new Smooth(grains.playbackRate, 0.03, true);
    } else {
      const lp = node(blockRate(ctx.createBiquadFilter()));
      lp.type = 'lowpass';
      lp.frequency.value = id === 'glass' ? 6000 : 700;
      lp.Q.value = 0.7;
      lp.connect(g);
      for (const [type, lvl] of id === 'glass' ? ([['sine', 1], ['sine', 0.5]] as const) : ([['sine', 1], ['triangle', 0.4]] as const)) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = 220;
        const og = node(ctx.createGain());
        og.gain.value = lvl;
        o.connect(og).connect(lp);
        o.start(t);
        this.sledOscs.push(o);
        this.sledNodes.push(o);
      }
      if (id === 'lantern') this.sledF = new Smooth(lp.frequency, 0.02, true);
    }
  }

  /** The sled sound's voice each frame: its level with your speed and carve, its pitch on the key's tonic. */
  private sledFrame(f: AudioFrame, now: number, ground: number, key: Key | null): void {
    const g = this.sledG;
    if (!g) return;
    const sp = clamp(f.speed || 0, 0, 60);
    const s01 = smoothstep(2, 30, sp);
    const carve = clamp(f.carve, 0, 1);
    const live = f.crashed ? 0 : 1;
    switch (this.sledId) {
      case 'bells':
        g.to(ground * live * (0.05 + 0.4 * carve) * s01 * 0.55, now, 0.05);
        this.sledRate?.to(0.85 + 0.35 * s01 + 0.2 * carve, now, 0.1);
        break;
      case 'timber':
        g.to(ground * live * (0.12 + 0.5 * carve) * s01 * bandComp(240, 7, this.ctx.sampleRate) * 0.25, now, 0.05);
        this.sledF?.to(200 + 110 * carve + sp * 1.5, now, 0.1);
        this.sledRate?.to(0.45 + 0.9 * carve + sp / 60, now, 0.1);
        break;
      case 'glass':
      case 'lantern': {
        if (key) {
          const m = this.sledId === 'glass' ? fit(key.tonic, 76) : fit(key.tonic, 45);
          if (m !== this.sledNote) {
            this.sledNote = m;
            const [o1, o2] = this.sledOscs;
            o1?.frequency.setTargetAtTime(mtof(m), now, 0.2);
            // A hair off the fifth (glass) or the octave (the hum), so it beats slowly as a rubbed rim does.
            o2?.frequency.setTargetAtTime(this.sledId === 'glass' ? mtof(m + 7) * 1.003 : mtof(m + 12) * 1.002, now, 0.2);
          }
        }
        const lvl = this.sledId === 'glass' ? (0.012 + 0.03 * s01) * (f.onIce ? 1.6 : 1) : 0.018 + 0.022 * s01;
        g.to(ground * live * lvl, now, 0.12);
        if (this.sledId === 'lantern') this.sledF?.to(600 + 650 * this.cells, now, 0.3);
        break;
      }
      default:
        break;
    }
  }

  /** A drift released: the whine whips up an octave in 0.08 s as it falls away. */
  whineRelease(now: number): void {
    if (this.whineNote < 0) return;
    const f = mtof(this.whineNote);
    this.whipUntil = now + 0.16;
    for (const [o, mul] of [
      [this.whine1, 1],
      [this.whine2, 2],
    ] as const) {
      o.frequency.cancelScheduledValues(now);
      o.frequency.setValueAtTime(f * mul, now);
      o.frequency.setTargetAtTime(f * mul * 2, now, 0.027);
    }
    this.whineGain.cancelScheduledValues(now);
    this.whineGain.setValueAtTime(this.whineGain.value, now);
    this.whineGain.setTargetAtTime(0, now + 0.02, 0.035);
    this.whineG.reset();
    this.whineNote = -1;
  }

  /** On a rail or off it: the metal hiss under the runners. */
  setRail(on: boolean): void {
    this.railOn = on;
  }

  /** Flow snuffed by a bump: the wind tone bends down a fourth over 0.25 s, then opens back to noise. */
  snuff(now: number): void {
    this.snuffUntil = now + 0.3;
    this.snuffF = this.windNow * FOURTH_DOWN;
    this.snuffQ = Math.max(this.windQNow, 2.5);
    this.windParam.cancelScheduledValues(now);
    this.windParam.setValueAtTime(this.windNow, now);
    this.windParam.setTargetAtTime(this.snuffF, now, 0.08);
    this.windF.reset();
  }

  setScene(scene: Scene, now: number): void {
    this.scene = scene;
    // Run level keeps cruising wind and snow near -33 dBFS RMS and full speed near -25, under
    // the music; menus get a faint wind bed.
    this.out.gain.setTargetAtTime(this.bedLevel(), now, 0.6);
    this.tone.gain.setTargetAtTime(scene === 'run' ? 1 : 0, now, 0.05);
    if (scene !== 'run') this.calm(now);
  }

  /**
   * A drop: the whole bed (wind, snow, rumble) and the in-key voices fall to `depth` at t for
   * `hold` seconds, then come back with the slam. With the band ducked at the same moment the gap
   * reads as a gap (a big bank's drop, the avalanche escape's drop-out). Run scene only.
   */
  dip(t: number, hold: number, depth: number): void {
    if (this.scene !== 'run' || !(hold > 0)) return;
    const lvl = this.bedLevel();
    const d = clamp(depth, 0, 1);
    for (const [p, full] of [
      [this.out.gain, lvl],
      [this.tone.gain, 1],
    ] as const) {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(full * d, t, 0.008);
      p.setTargetAtTime(full, t + hold, 0.03);
    }
  }

  private bedLevel(): number {
    return this.scene === 'run' ? 0.4 : this.scene === 'title' ? 0.35 : 0.25;
  }

  /** Called from the scheduler: if frames stop arriving mid-run (paused), settle to a calm bed. */
  watch(now: number): void {
    if (this.scene === 'run' && !this.calmed && now - this.lastFrame > 0.35) this.calm(now);
    for (const g of this.gates) g.tick(now);
  }

  private calm(now: number): void {
    this.calmed = true;
    this.apply(CALM, now, false, null, false);
  }

  /** shoulder: 0..1 scale on the shoulder hiss (the engine hushes it through the start-line jostle). */
  update(f: AudioFrame, now: number, avalanche: boolean, key: Key, shoulder = 1): void {
    this.lastFrame = now;
    this.calmed = false;
    this.apply(f, now, avalanche, key, true, shoulder);
  }

  private apply(f: AudioFrame, now: number, avalanche: boolean, key: Key | null, surface: boolean, shoulderScale = 1): void {
    const sr = this.ctx.sampleRate;
    const sp = clamp(f.speed || 0, 0, 60);
    const s01 = clamp(sp / 46, 0, 1);
    const air = !f.grounded;
    const live = f.crashed ? 0 : 1;
    const ground = surface && f.grounded && !f.crashed ? 1 : 0;
    const slow = surface ? 1 : 4;
    const tonic = key ? key.tonic : 0;

    // Wind: quiet below 8 m/s, roaring past 35. Airborne opens it up and thins it out. Earned flow
    // narrows the band and pulls it onto a note in the song's key, so the wind sings.
    const fk = surface && key ? clamp(f.flow ?? 0, 0, 1) * live : 0;
    // (All of it climbs to the cap: the wind ran out at 40 m/s and the roar at 44.)
    const w = smoothstep(6, 46, sp);
    const ex = surface ? clamp(this.exposure, 0, 1) : 0;
    const wNoise = (260 + sp * 26) * (air ? 1.3 : 1) * (1 + 0.25 * ex);
    const wq0 = air ? 0.45 : 0.7;
    let wf = fk > 0 ? Math.exp(Math.log(wNoise) * (1 - fk) + Math.log(mtof(fit(tonic, 79))) * fk) : wNoise;
    let wq = wq0 + (7 - wq0) * fk;
    if (now < this.snuffUntil) {
      // Snuffed: hold the bent note a moment before it opens back into noise.
      wf = this.snuffF;
      wq = this.snuffQ;
    } else {
      this.windF.to(wf, now, (fk > 0.05 ? 0.06 : 0.12) * slow);
    }
    this.windNow = wf;
    this.windQNow = wq;
    this.windQ.to(wq, now, now < this.snuffUntil ? 0.05 : 0.2);
    const wind = (0.03 + 0.55 * Math.pow(w, 1.5)) * (f.crashed ? 0.35 : 1) * (f.drafting ? 0.7 : 1) * (1 + 0.5 * fk) * (1 + 0.5 * ex);
    this.windG.to(wind * bandComp(wf, wq, sr) * 0.5, now, 0.15 * slow);
    this.roarG.to(0.48 * smoothstep(22, 46, sp) * (f.crashed ? 0.2 : 1), now, 0.25 * slow);
    const whf = 1500 + sp * 38 + (air ? 900 : 0);
    this.whistleF.to(whf, now, 0.25);
    this.whistleG.to((air && surface ? 0.15 : 0.03) * smoothstep(8, 46, sp) * live * bandComp(whf, 7, sr) * 0.5, now, air ? 0.12 : 0.3);
    this.pocketF.to(f.drafting && live ? 700 : this.open, now, f.drafting ? 0.12 : 0.25);

    if (surface) {
      const note = fit(tonic, 33);
      if (note !== this.humNote) {
        this.humNote = note;
        this.hum1.frequency.setTargetAtTime(mtof(note), now, 0.3);
        // A hair off the fifth so the hum beats slowly, like air in a tunnel.
        this.hum2.frequency.setTargetAtTime(mtof(note + 7) * 1.004, now, 0.3);
      }
    }
    this.humG.to(f.drafting && live ? 0.07 : 0, now, 0.2);

    const bf = 700 + clamp(f.boostGlow, 0, 1) * 3200;
    this.boostF.to(bf, now, 0.2);
    this.boostG.to(0.16 * clamp(f.boostGlow, 0, 1) * (0.5 + 0.5 * s01) * live * bandComp(bf, 1.3, sr) * 0.5, now, 0.12);

    // Surface: fast time constants so touchdown and takeoff are crisp.
    const st = ground ? 0.03 : 0.05;
    const hf = Math.min(1800 + sp * 90, 7500);
    this.hissF.to(hf, now, 0.15);
    // The runners' hiss is there from the start and goes on rising to the cap.
    this.hissG.to(ground * (0.2 * smoothstep(2, 26, sp) + 0.13 * smoothstep(22, 46, sp)) * (f.onIce ? 0.5 : 1) * bandComp(hf, 0.6, sr) * 0.5, now, st);
    this.railG.to(this.railOn && surface && !f.crashed ? 0.34 * (0.6 + 0.4 * s01) * bandComp(4700, 2.4, sr) * 0.5 : 0, now, 0.02);
    const carve = clamp(f.carve, 0, 1);
    this.crunchRate.to(0.55 + carve * 1.6 + sp / 30, now, 0.1);
    const cf = 900 + carve * 900 + sp * 15;
    this.crunchF.to(cf, now, 0.12);
    const crunch = 0.07 * smoothstep(3, 34, sp) + 0.45 * carve * smoothstep(5, 40, sp);
    this.crunchG.to(ground * crunch * (f.onIce ? 0.2 : 1) * (f.drifting ? 0.6 : 1) * bandComp(cf, 0.9, sr) * 0.5, now, st);

    const slip = Math.min(Math.abs(f.slip || 0), 0.9);
    const drift = f.drifting ? 1 : 0;
    this.sprayG.to(ground * drift * (0.1 + 0.26 * Math.min(1, slip / 0.7)) * (0.5 + 0.5 * s01), now, 0.06);
    const scf = (700 - slip * 250) * (f.onIce ? 2.2 : 1);
    this.scrapeF.to(scf, now, 0.08);
    this.scrapeRate.to(2 + slip * 2.2, now, 0.1);
    this.scrapeG.to(ground * drift * 0.3 * Math.min(1, slip / 0.6 + 0.2) * bandComp(scf, 2.2, sr) * 0.5, now, 0.06);
    this.sledFrame(f, now, ground, key);
    const ice = f.onIce ? 1 : 0;
    this.iceG.to(ground * ice * (0.1 + 0.24 * s01 + drift * 0.12), now, 0.08);
    this.ringG.to(ground * ice * (0.025 + 0.04 * s01) * bandComp(3300, 16, sr) * 0.5, now, 0.1);

    // Rumble only while the avalanche is chasing; it fades slowly after a crash.
    const d = avalanche ? clamp(f.danger, 0, 1) : 0;
    this.rumbleF.to(80 + d * 220, now, 0.3);
    this.rumbleG.to(0.55 * Math.pow(d, 1.3) * live, now, f.crashed ? 1 : 0.3);

    // Drift whine: the charge climbs the key's pentatonic ladder, steps 2 to 10 above the tonic
    // between A4 and G#5, gliding 0.05 s between steps so it always sings in key.
    if (now >= this.whipUntil) {
      const k = surface && key && f.drifting && !f.crashed ? clamp(f.driftCharge ?? 0, 0, 1) : 0;
      if (k > 0 && key) {
        const note = ladderAt(key, fit(key.tonic, 69), Math.round(2 + 8 * k));
        if (note !== this.whineNote) {
          const glide = this.whineNote < 0 ? 0.004 : 0.017;
          this.whineNote = note;
          this.whine1.frequency.setTargetAtTime(mtof(note), now, glide);
          this.whine2.frequency.setTargetAtTime(mtof(note) * 2, now, glide);
        }
        this.whineG.to(0.012 + 0.035 * k, now, 0.06);
      } else {
        this.whineG.to(0, now, 0.05);
        if (!f.drifting) this.whineNote = -1;
      }
    }

    // Shoulder: a rival closing behind you, panned hard to its side. Silent while drafting (the hum
    // owns that), in a crash and under any danger (it must never mask the avalanche). It is a cue of
    // closing: full while the ghost gains on you (its level rising), a whisper when one only sits
    // behind you, and it rides with your speed as the wind bed does.
    const sh = surface && shoulderScale > 0 && f.shoulder && !f.drafting && !f.crashed && !(f.danger > 0) ? f.shoulder : null;
    const amt = sh ? clamp(sh.amt, 0, 1) : 0;
    const dts = this.shAt >= 0 ? clamp(now - this.shAt, 0, 0.25) : 0;
    if (amt === 0) this.shClose = 0;
    else if (dts > 0) {
      const rise = clamp((amt - this.shPrev) / dts / SHOULDER_CLOSING, 0, 1);
      this.shClose += (rise - this.shClose) * (1 - Math.exp(-dts / 0.3));
    }
    this.shPrev = amt;
    this.shAt = now;
    const shf = 1500 + 1500 * amt;
    if (amt > 0) {
      this.shoulderF.to(shf, now, 0.04);
      this.shoulderRate.to(1.1 + 0.9 * amt, now, 0.1);
    }
    if (sh && this.shoulderPan) {
      const p = clamp(sh.pan, -0.85, 0.85);
      this.shoulderPan.to(Math.sign(p) * Math.min(0.95, Math.pow(Math.abs(p), 0.7)), now, 0.04);
    }
    const shSpeed = 0.35 + 0.65 * smoothstep(8, 24, sp);
    this.shoulderG.to(SHOULDER_GAIN * amt * (0.15 + 0.85 * this.shClose) * shSpeed * clamp(shoulderScale, 0, 1) * bandComp(shf, 2.5, sr), now, 0.04);
  }

  dispose(): void {
    this.setSled('runners');
    for (const s of this.srcs) {
      try {
        s.stop();
      } catch {
        // Already stopped.
      }
      s.disconnect();
    }
    for (const n of this.nodes) n.disconnect();
    this.out.disconnect();
    this.tone.disconnect();
  }
}
