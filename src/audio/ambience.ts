import type { Bank } from './buffers';
import type { AudioFrame } from './engine';
import type { Bus } from './graph';
import type { Scene } from './music';
import { fit, mtof } from './theory';
import { bandComp, blockRate, clamp, smoothstep } from './voices';

// Continuous layers: wind and snow surface. The whole graph is built once and only its parameters
// move, so update() never creates a node. Three looping noise sources (white, pink, brown) feed
// every filter branch; two grain-train sources chop the crunch and scrape into granules.

type Link = readonly [AudioNode, AudioNode | AudioParam];

function connect([a, b]: Link): void {
  if (b instanceof AudioNode) a.connect(b);
  else a.connect(b);
}

function disconnect([a, b]: Link): void {
  if (b instanceof AudioNode) a.disconnect(b);
  else a.disconnect(b);
}

/** A branch filtering live noise costs CPU even at zero gain. Once its gain target reaches zero
 *  and the fade has died away (at least 2 s, or 8 time constants: -70 dB, so slow fades such as
 *  the post-crash rumble are not cut short) the branch input is unplugged, and it is plugged back
 *  in as soon as the target rises again. */
class Gate {
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
class Smooth {
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

    const hissG = gain(0, surf);
    const hissBP = filter('bandpass', 3000, 0.6, hissG);
    this.hissF = P(hissBP.frequency, 0.015, true);
    this.hissG = G(hissG.gain, [[white, hissBP]]);

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
  }

  setScene(scene: Scene, now: number): void {
    this.scene = scene;
    // Run level keeps cruising wind and snow near -33 dBFS RMS and full speed near -25, under
    // the music; menus get a faint wind bed.
    this.out.gain.setTargetAtTime(scene === 'run' ? 0.4 : scene === 'title' ? 0.35 : 0.25, now, 0.6);
    if (scene !== 'run') this.calm(now);
  }

  /** Called from the scheduler: if frames stop arriving mid-run (paused), settle to a calm bed. */
  watch(now: number): void {
    if (this.scene === 'run' && !this.calmed && now - this.lastFrame > 0.35) this.calm(now);
    for (const g of this.gates) g.tick(now);
  }

  private calm(now: number): void {
    this.calmed = true;
    this.apply(CALM, now, false, 0, false);
  }

  update(f: AudioFrame, now: number, avalanche: boolean, tonic: number): void {
    this.lastFrame = now;
    this.calmed = false;
    this.apply(f, now, avalanche, tonic, true);
  }

  private apply(f: AudioFrame, now: number, avalanche: boolean, tonic: number, surface: boolean): void {
    const sr = this.ctx.sampleRate;
    const sp = clamp(f.speed || 0, 0, 60);
    const s01 = clamp(sp / 46, 0, 1);
    const air = !f.grounded;
    const live = f.crashed ? 0 : 1;
    const ground = surface && f.grounded && !f.crashed ? 1 : 0;
    const slow = surface ? 1 : 4;

    // Wind: quiet below 8 m/s, roaring past 35. Airborne opens it up and thins it out.
    const w = smoothstep(6, 40, sp);
    const wf = (260 + sp * 26) * (air ? 1.3 : 1);
    const wq = air ? 0.45 : 0.7;
    this.windF.to(wf, now, 0.12 * slow);
    this.windQ.to(wq, now, 0.2);
    const wind = (0.03 + 0.55 * Math.pow(w, 1.5)) * (f.crashed ? 0.35 : 1) * (f.drafting ? 0.7 : 1);
    this.windG.to(wind * bandComp(wf, wq, sr) * 0.5, now, 0.15 * slow);
    this.roarG.to(0.42 * smoothstep(24, 44, sp) * (f.crashed ? 0.2 : 1), now, 0.25 * slow);
    const whf = 1500 + sp * 38 + (air ? 900 : 0);
    this.whistleF.to(whf, now, 0.25);
    this.whistleG.to((air && surface ? 0.15 : 0.03) * smoothstep(8, 40, sp) * live * bandComp(whf, 7, sr) * 0.5, now, air ? 0.12 : 0.3);
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
    this.hissG.to(ground * 0.26 * smoothstep(2, 30, sp) * (f.onIce ? 0.5 : 1) * bandComp(hf, 0.6, sr) * 0.5, now, st);
    const carve = clamp(f.carve, 0, 1);
    this.crunchRate.to(0.55 + carve * 1.6 + sp / 30, now, 0.1);
    const cf = 900 + carve * 900 + sp * 15;
    this.crunchF.to(cf, now, 0.12);
    const crunch = 0.07 * smoothstep(3, 25, sp) + 0.45 * carve * smoothstep(5, 30, sp);
    this.crunchG.to(ground * crunch * (f.onIce ? 0.2 : 1) * (f.drifting ? 0.6 : 1) * bandComp(cf, 0.9, sr) * 0.5, now, st);

    const slip = Math.min(Math.abs(f.slip || 0), 0.9);
    const drift = f.drifting ? 1 : 0;
    this.sprayG.to(ground * drift * (0.1 + 0.26 * Math.min(1, slip / 0.7)) * (0.5 + 0.5 * s01), now, 0.06);
    const scf = (700 - slip * 250) * (f.onIce ? 2.2 : 1);
    this.scrapeF.to(scf, now, 0.08);
    this.scrapeRate.to(2 + slip * 2.2, now, 0.1);
    this.scrapeG.to(ground * drift * 0.3 * Math.min(1, slip / 0.6 + 0.2) * bandComp(scf, 2.2, sr) * 0.5, now, 0.06);
    const ice = f.onIce ? 1 : 0;
    this.iceG.to(ground * ice * (0.1 + 0.24 * s01 + drift * 0.12), now, 0.08);
    this.ringG.to(ground * ice * (0.025 + 0.04 * s01) * bandComp(3300, 16, sr) * 0.5, now, 0.1);

    // Rumble only while the avalanche is chasing; it fades slowly after a crash.
    const d = avalanche ? clamp(f.danger, 0, 1) : 0;
    this.rumbleF.to(80 + d * 220, now, 0.3);
    this.rumbleG.to(0.55 * Math.pow(d, 1.3) * live, now, f.crashed ? 1 : 0.3);
  }

  dispose(): void {
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
  }
}
