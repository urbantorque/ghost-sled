import type { Beat } from '../game/beats';
import { Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import { Ambience, Gate, type Link, Smooth, connect } from './ambience';
import type { Bank } from './buffers';
import type { Graph } from './graph';
import { type ScapeView, newView } from './listen';
import type { Scene } from './music';
import { LOW_TAKES, TakeBank, type TakeName } from './takes';
import { bandComp, blockRate, clamp, rand } from './voices';

// The soundscape: the world the run passes through, heard. Crowds at the set pieces roar as you come
// and pan past you, cheer the moments you make near them (with whistles and cowbells in the Alps and
// taiko at Sakura); crows wheel and call over the treeline and burst up from a stomp; chairlifts clack
// through their towers over a humming cable; valley villages ring their bells at dusk; a snowcat's
// diesel works the far slopes at night; the wind blows harder and airier where the run opens out, at
// height and on an overlook; galleries and tunnels close in with an echo on the runners and the band;
// and each mood has its own bed (a howling blizzard, groaning ice, owls at night, embers and
// rumbles on Ember Peak, temple chimes on Sakura, powder sloughing off the boughs).
//
// Cost: everything continuous is a fixed graph built once (about forty nodes), fed by the ambience's
// own noise sources and moved only by parameter automation, each branch unplugged while silent
// (ambience.ts Gate). Every one-shot is a take synthesized once (takes.ts) and played as one buffer
// source into one of six long-lived lanes (level, distance lowpass, pan), and the timed ones are made
// in the scheduler pass, between frames. At a cruise that is under one node a second; the Low tier
// (no crowds, lifts or villages drawn) hears the birds, the wind and the mood's bed only.

/** Long-lived lanes the one-shots play through. A shot finding none free is dropped (they are all
 *  decoration). */
const LANES = 8;
/** The levels each part sits at (gain into the effects bus; tuned with the probe's 'scape' render so
 *  the soundscape sits under the band and the effects: a crowd at full presence near -31 dBFS RMS,
 *  a cheer peaking near -17, the ambient one-shots between -20 and -28). */
const LEVEL = {
  crowd: 0.3,
  howl: 0.07,
  air: 0.22,
  gust: 0.13,
  /** A whoosh's peak gain at full strength (pink noise in a constant-Q band holds its level wherever
   *  the band sits, so no band compensation). */
  whoosh: 0.45,
  hum: 0.025,
  diesel: 0.07,
  ember: 0.06,
  cheer: 0.6,
  shot: 0.2,
} as const;
/** Cheers a moment near a crowd sets off (landmarks.ts SetPieces.cheer, the same moments). */
function cheerOf(b: Beat): number {
  switch (b.type) {
    case 'stomp':
    case 'grudgeSettled':
    case 'finale':
    case 'finish':
      return 1;
    case 'pass':
      return b.muted ? 0 : 1;
    case 'duel':
      return b.phase === 'won' || b.phase === 'heldOff' ? 1 : 0;
    case 'stage':
      return 0.8;
    case 'bank':
      return 0.45 + 0.18 * b.tier;
    case 'nearMiss':
      return b.grade === 'whisker' ? 0.7 : 0;
    case 'driftRelease':
      return b.tier >= 3 ? 1 : b.tier === 2 ? 0.5 : 0;
    case 'flow':
      return b.phase === 'in' ? 0.75 : 0;
    case 'newGround':
    case 'km':
      return 0.7;
    default:
      return 0;
  }
}

interface Lane {
  g: GainNode;
  lp: BiquadFilterNode;
  pan: StereoPannerNode | null;
  until: number;
}

/** What drives the beds each frame, beside the listener's view. */
export interface ScapeFrame {
  speed: number;
  crashed: boolean;
  grounded: boolean;
}

export class Soundscape {
  readonly takes: TakeBank;
  /** The last view heard (probes read it). */
  readonly view: ScapeView = newView();
  private readonly out: GainNode;
  private readonly nodes: AudioNode[] = [];
  private readonly srcs: AudioScheduledSourceNode[] = [];
  private readonly gates: Gate[] = [];
  private readonly lanes: Lane[] = [];
  private scene: Scene = 'title';
  private tier: 'low' | 'medium' | 'high' = 'high';
  private mood: Mood = Mood.None;
  private biome: BiomeId = 'alpine';
  private lastFrame = -1;
  private hushed = true;
  /** The overlook hook (scape.openness, 0..1), eased. */
  private open = 0;
  private openWant = 0;
  private openArmed = true;
  private vistaArmed = true;
  private enclosedWas = 0;
  private crowdWas = 0;
  private lastCheer = -9;
  private lastScatter = -9;
  /** When each kind of ambient one-shot may next play (scheduler pass). */
  private readonly next = { birds: 0, owl: 0, lift: 0, bell: 0, mood: 0, mood2: 0, cowbell: 0, whistle: 0, taiko: 0 };
  /** Probe: one-shots played, dropped for want of a lane, each take's plays, and the whooshes. */
  readonly stats = { shots: 0, dropped: 0, whooshes: 0, gusts: 0 };
  readonly played: Partial<Record<TakeName, number>> = {};

  private readonly crowdG: Smooth;
  private readonly crowdSwell: GainNode;
  private readonly crowdF: Smooth;
  private readonly crowdLP: Smooth;
  private readonly crowdPan: Smooth | null;
  private readonly howlG: Smooth;
  private readonly airG: Smooth;
  private readonly gust: GainNode;
  private readonly gustGate: Gate;
  private readonly whooshF: AudioParam;
  private readonly whoosh: GainNode;
  private readonly whooshGate: Gate;
  private readonly humG: Smooth;
  private readonly humPan: Smooth | null;
  private readonly emberG: Smooth;
  /** The diesel loop starts once its take is made. */
  private diesel: { g: Smooth; pan: Smooth | null } | null = null;
  private dieselTail: AudioNode | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    bank: Bank,
    private readonly graph: Graph,
    private readonly ambience: Ambience,
  ) {
    this.takes = new TakeBank(ctx);
    const bus = graph.sfx;
    const gain = (v: number, dest: AudioNode | AudioParam | null): GainNode => {
      const g = ctx.createGain();
      g.gain.value = v;
      if (dest) connect([g, dest]);
      this.nodes.push(g);
      return g;
    };
    const filter = (type: BiquadFilterType, f: number, q: number, dest: AudioNode): BiquadFilterNode => {
      const n = blockRate(ctx.createBiquadFilter());
      n.type = type;
      n.frequency.value = f;
      n.Q.value = q;
      n.connect(dest);
      this.nodes.push(n);
      return n;
    };
    const panner = (dest: AudioNode): StereoPannerNode | null => {
      if (typeof ctx.createStereoPanner !== 'function') return null;
      const p = ctx.createStereoPanner();
      // Mono in, so it pans equal-power rather than half (ambience.ts, the shoulder).
      p.channelCount = 1;
      p.channelCountMode = 'explicit';
      p.connect(dest);
      this.nodes.push(p);
      return p;
    };
    const osc = (f: number, dest: AudioNode | AudioParam | null): OscillatorNode => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      if (dest) connect([o, dest]);
      o.start(ctx.currentTime);
      this.srcs.push(o);
      return o;
    };
    const G = (p: AudioParam, links: Link[]): Smooth => {
      for (const l of links) connect(l);
      const gate = new Gate(links);
      this.gates.push(gate);
      return new Smooth(p, 0.002, false, gate);
    };
    const P = (p: AudioParam, eps: number, rel = false): Smooth => new Smooth(p, eps, rel);

    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(bus.dry);
    this.out.connect(gain(0.14, bus.wet));
    const { white, pink, brown } = ambience.noise;

    // The crowd: voices in a band of noise, chopped into chatter by a grain train, a brighter band for
    // the cheers on top; a swell stage for those, a lowpass that darkens it once it is behind you,
    // and its pan.
    const cPan = panner(this.out);
    const cLP = filter('lowpass', 6500, 0.6, cPan ?? this.out);
    this.crowdSwell = gain(1, cLP);
    const cG = gain(0, this.crowdSwell);
    const cAM = gain(0.45, cG);
    const cDepth = gain(0.55, cAM.gain);
    const grains = ctx.createBufferSource();
    grains.buffer = bank.grains;
    grains.loop = true;
    grains.playbackRate.value = 1.6;
    grains.start(ctx.currentTime, Math.random() * 1.5);
    this.srcs.push(grains);
    const cBP = filter('bandpass', 750, 0.8, cAM);
    const cHi = gain(0.35, cAM);
    const cBP2 = filter('bandpass', 2300, 1.3, cHi);
    this.crowdG = G(cG.gain, [
      [pink, cBP],
      [pink, cBP2],
      [grains, cDepth],
    ]);
    this.crowdF = P(cBP.frequency, 0.03, true);
    this.crowdLP = P(cLP.frequency, 0.05, true);
    this.crowdPan = cPan ? P(cPan.pan, 0.03) : null;

    // The blizzard's howl: two narrow bands of noise, each swept slowly by its own LFO, so the wind
    // moans in two voices that never line up.
    const hG = gain(0, this.out);
    const h1 = filter('bandpass', 430, 10, hG);
    const h2 = filter('bandpass', 690, 12, hG);
    osc(0.09, gain(80, h1.frequency));
    osc(0.131, gain(120, h2.frequency));
    this.howlG = G(hG.gain, [
      [pink, h1],
      [pink, h2],
    ]);

    // Exposure: high, airy wind over the bed's own (which the ambience lifts too), and a broad, low
    // gust for an overlook opening.
    const aG = gain(0, this.out);
    const aLP = filter('lowpass', 9000, 0.5, aG);
    const aHP = filter('highpass', 2200, 0.5, aLP);
    this.airG = G(aG.gain, [[white, aHP]]);
    this.gust = gain(0, this.out);
    const gLP = filter('lowpass', 1100, 0.5, this.gust);
    this.gustGate = new Gate([[pink, gLP]]);
    connect([pink, gLP]);
    this.gates.push(this.gustGate);

    // The whoosh: one band of noise swept by automation (a tunnel's mouth, a long air).
    this.whoosh = gain(0, this.out);
    const wBP = filter('bandpass', 600, 1.4, this.whoosh);
    this.whooshF = wBP.frequency;
    this.whooshGate = new Gate([[pink, wBP]]);
    connect([pink, wBP]);
    this.gates.push(this.whooshGate);

    // A lift's cable: a low hum and its octave a hair sharp, so it beats slowly, at the line's side.
    const huPan = panner(this.out);
    const huG = gain(0, huPan ?? this.out);
    const hu2 = gain(0.45, huG);
    const o1 = osc(98, null);
    const o2 = osc(196.8, null);
    this.humG = G(huG.gain, [
      [o1, huG],
      [o2, hu2],
    ]);
    this.humPan = huPan ? P(huPan.pan, 0.03) : null;

    // Ember Peak: the mountain's deep rumble under everything.
    const eG = gain(0, this.out);
    const eLP = filter('lowpass', 75, 0.7, eG);
    this.emberG = G(eG.gain, [[brown, eLP]]);

    // The lanes.
    for (let i = 0; i < LANES; i++) {
      const pan = panner(this.out);
      const lp = filter('lowpass', 8000, 0.6, pan ?? this.out);
      const g = gain(0, lp);
      this.lanes.push({ g, lp, pan, until: 0 });
    }
  }

  setScene(scene: Scene, now: number): void {
    this.scene = scene;
    this.out.gain.setTargetAtTime(scene === 'run' ? 1 : 0, now, scene === 'run' ? 0.3 : 0.4);
    if (scene === 'run') {
      this.open = this.openWant = 0;
      this.openArmed = this.vistaArmed = true;
      this.enclosedWas = 0;
      this.crowdWas = 0;
      const n = this.next;
      // The first birds and the mood's first sound come a few seconds in, not on the start line.
      n.birds = now + 4;
      n.owl = now + 6;
      n.mood = now + 5;
      n.mood2 = now + 12;
      n.bell = now + 8;
      n.lift = n.cowbell = n.whistle = n.taiko = now;
    } else this.hush(now);
  }

  setMood(mood: Mood, biome: BiomeId): void {
    this.mood = mood;
    this.biome = biome;
  }

  setTier(tier: 'low' | 'medium' | 'high'): void {
    this.tier = tier;
  }

  /** How far the band has opened up (0..1): its reverb room widens with it (engine.ts). */
  bandOpen = 0;

  /** The overlook hook (0..1): one bank opens to a view. A broad gust as it opens, the airy wind and
   *  the band's lift while it lasts (the engine reads `openness`). */
  setOpenness(k: number): void {
    this.openWant = clamp(k, 0, 1);
  }

  get openness(): number {
    return this.open;
  }

  /** Per run frame: the view of the world near the rider and the rider's speed. */
  update(v: ScapeView, f: ScapeFrame, now: number, dt: number): void {
    this.lastFrame = now;
    this.hushed = false;
    const sr = this.ctx.sampleRate;
    Object.assign(this.view, v);
    const sp = clamp(f.speed, 0, 60);
    const s01 = clamp(sp / 46, 0, 1);
    this.open += (this.openWant - this.open) * (1 - Math.exp(-Math.max(0, dt) / 0.6));

    // The crowd, and a ride-through village's bustle in the same voices, lower and calmer.
    const crowd = Math.max(v.crowd, v.bustle * 0.6);
    this.crowdG.to(LEVEL.crowd * crowd * bandComp(750, 0.8, sr) * 0.25, now, 0.25);
    this.crowdF.to(v.bustle > v.crowd ? 520 : 760, now, 0.5);
    this.crowdLP.to(6500 - 5000 * v.crowdBehind, now, 0.3);
    this.crowdPan?.to(v.crowdWide ? 0 : v.crowdPan, now, 0.15);
    // The crowd that sees you coming cheers you past (once, as it comes up to full).
    if (v.crowd > 0.7 && this.crowdWas <= 0.7 && !f.crashed) this.cheer(0.55, now + 0.006);
    this.crowdWas = v.crowd;

    // The blizzard howls harder with speed and where it is open.
    const blizzard = this.mood === Mood.Blizzard;
    this.howlG.to(blizzard ? LEVEL.howl * (0.35 + 0.65 * s01) * (0.6 + 0.4 * v.exposure) * bandComp(430, 10, sr) : 0, now, 0.8);

    // Exposure: the airy wind, with the overlook and the vista on top.
    const ex = clamp(Math.max(v.exposure, this.open), 0, 1);
    this.ambience.exposure = ex;
    const air = LEVEL.air * (Math.pow(ex, 1.5) * (0.25 + 0.75 * s01) + 0.6 * v.vista + 0.5 * this.open) * (f.crashed ? 0.3 : 1);
    this.airG.to(air * bandComp(4000, 0.5, sr) * 0.25, now, 0.4);
    if (this.open > 0.4 && this.openArmed) {
      this.openArmed = false;
      this.gustAt(now + 0.006, 0.6 + 0.4 * s01);
    } else if (this.open < 0.15) this.openArmed = true;

    // A long air: a deep whoosh as the lens opens out.
    if (v.vista > 0.3 && this.vistaArmed && !f.grounded) {
      this.vistaArmed = false;
      this.sweep(now + 0.006, 170, 520, 1.4, 0.6 + 0.4 * s01);
    } else if (v.vista < 0.08) this.vistaArmed = true;

    // A gallery or a tunnel: the echo, and a whoosh through each mouth.
    this.graph.setEnclosed(v.enclosed, now);
    if (v.enclosed >= 0.5 && this.enclosedWas < 0.5) this.sweep(now + 0.006, 2600, 520, 0.45, 0.5 + 0.5 * s01);
    else if (v.enclosed < 0.5 && this.enclosedWas >= 0.5) this.sweep(now + 0.006, 480, 2400, 0.5, 0.45 + 0.45 * s01);
    this.enclosedWas = v.enclosed;
    // The room opens for the vista and the overlook, and closes in, ringing, under a roof.
    const space = Math.max(v.vista, 0.7 * this.open);
    this.graph.music.setSpace(1 + 1.2 * space + 0.8 * v.enclosed + 0.9 * this.bandOpen, now);
    this.graph.sfx.setSpace(1 + 0.4 * space + 1.2 * v.enclosed, now);

    // A lift's cable, a snowcat at night, Ember Peak's rumble.
    this.humG.to(LEVEL.hum * v.lift, now, 0.4);
    this.humPan?.to(v.liftPan, now, 0.2);
    this.ensureDiesel();
    if (this.diesel) {
      const on = v.night && this.tier !== 'low' ? 0.5 + 0.5 * Math.sin(now * 0.045) : 0;
      this.diesel.g.to(LEVEL.diesel * on * on, now, 1.5);
      this.diesel.pan?.to(0.7 * Math.sin(now * 0.031 + 1), now, 1);
    }
    this.emberG.to(this.biome === 'volcanic' ? LEVEL.ember * (0.7 + 0.3 * Math.sin(now * 0.07)) : 0, now, 1.2);

    // A place's bell, rung once as you come.
    if (v.bell) this.play(v.bell, now + 0.006, v.bell === 'church' ? 0.55 : 0.45, v.bellPan, v.bell === 'church' ? 3500 : 5000, rand(0.97, 1.03));
  }

  /** The run's named moments: the crowd cheers those made near it, a stomp or a crash scatters the
   *  birds near it. */
  beats(list: readonly Beat[], now: number): void {
    if (this.scene !== 'run' || this.hushed) return;
    const v = this.view;
    let k = 0;
    let scatter = false;
    for (const b of list) {
      k = Math.max(k, cheerOf(b));
      if (b.type === 'stomp' || b.type === 'crash') scatter = true;
    }
    if (k > 0 && v.crowd > 0.1) this.cheer(k, now + 0.006);
    if (scatter && v.flock > 0.12 && v.flockD < 120 && now - this.lastScatter > 6) {
      this.lastScatter = now;
      const t = now + 0.006;
      this.play('flaps', t, 0.55 * v.flock, v.flockPan, 5000, rand(0.9, 1.1));
      const call = this.call();
      if (call) this.play(call, t + rand(0.25, 0.5), 0.5 * v.flock, v.flockPan, 6000, rand(0.95, 1.08));
      this.next.birds = now + rand(4, 7);
    }
  }

  /** Scheduler pass (between frames): the ambient one-shots, takes made a slice at a time, idle
   *  branches unplugged, and the beds hushed if the frames stopped (paused). */
  tick(now: number): void {
    // The takes are made on the title (about 0.2 s of work on a desktop, in 1.5 ms slices); a run
    // started before they are done carries on in thinner slices. Low makes only what it hears, and
    // never during a run: on a weak CPU the slices cost more than the sound is worth, and a bird
    // that is not made yet just does not call.
    if (this.tier === 'low') this.takes.pump(this.scene === 'run' ? 0 : 1.5, LOW_TAKES);
    else this.takes.pump(this.scene === 'run' ? 0.4 : 1.5);
    for (const g of this.gates) g.tick(now);
    if (this.scene !== 'run') return;
    if (!this.hushed && now - this.lastFrame > 0.35) this.hush(now);
    if (this.hushed) return;
    const v = this.view;
    const n = this.next;
    const low = this.tier === 'low';
    // Low plays the ambient sounds at about half the rate.
    const sparse = low ? 1.7 : 1;
    const t = now + 0.05;
    // Birds over the treeline.
    const call = this.call();
    if (call && call !== 'owl' && now >= n.birds) {
      n.birds = now + rand(5, 11) * sparse;
      if (v.flock > 0.3) this.play(call, t, 0.45 * v.flock, v.flockPan, 3000 + 4000 * v.flock, rand(0.92, 1.08));
    }
    // Owls at night (and the lone owl flying).
    if (v.night && now >= n.owl) {
      n.owl = now + rand(9, 17) * sparse;
      this.play('owl', t, 0.3, rand(-0.8, 0.8), 2600, rand(0.94, 1.04));
    }
    // A lift's towers.
    if (v.lift > 0.2 && now >= n.lift) {
      n.lift = now + rand(2.4, 4.6);
      this.play('clack', t, 0.5 * v.lift, v.liftPan, 4000 + 3000 * v.lift, rand(0.95, 1.05));
    }
    // A valley village's bell at dusk: three tolls.
    if (v.village > 0.05 && v.dusk > 0.35 && now >= n.bell) {
      n.bell = now + rand(28, 50);
      const lvl = 0.42 * v.village * v.dusk;
      const r = rand(0.85, 1.1);
      for (let i = 0; i < 3; i++) this.play('church', t + i * 2.3, lvl, v.villagePan, 1800, r);
    }
    // The mood's and the mountain's bed.
    if (now >= n.mood) this.moodShot(t, sparse);
    if (now >= n.mood2) {
      n.mood2 = now + rand(12, 24) * sparse;
      if (this.biome === 'volcanic') this.play('rumble', t, 0.55, rand(-0.5, 0.5), 600, rand(0.85, 1.1));
      else if (this.mood === Mood.Haunted) this.play('church', t, 0.22, rand(-0.6, 0.6), 900, 0.6);
    }
    // A crowd's own noise: cowbells and whistles in the Alps and on the glacier, taiko at Sakura.
    if (v.crowd > 0.3) {
      const alps = this.biome === 'alpine' || this.biome === 'glacier';
      if (alps && now >= n.cowbell) {
        n.cowbell = now + rand(1.6, 3.4);
        this.play('cowbell', t, 0.38 * v.crowd, v.crowdPan + rand(-0.2, 0.2), 7000, rand(0.94, 1.06));
      }
      if (this.biome !== 'blossom' && now >= n.whistle) {
        n.whistle = now + rand(4, 8);
        this.play('whistle', t, 0.3 * v.crowd, v.crowdPan + rand(-0.2, 0.2), 8000, rand(0.95, 1.08));
      }
      if (this.biome === 'blossom' && now >= n.taiko) {
        n.taiko = now + rand(2.8, 4.5);
        this.play('taiko', t, 0.55 * v.crowd, v.crowdPan, 5000, rand(0.97, 1.03));
      }
    }
  }

  /** Every take made now (offline renders, tests). */
  prepare(): void {
    this.takes.finishAll();
    this.ensureDiesel();
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
    this.dieselTail?.disconnect();
    this.out.disconnect();
  }

  // ---------------------------------------------------------------- internals

  /** The birds' call, by kind: crows and choughs, cranes over Sakura, the owl at night. */
  private call(): TakeName | null {
    if (this.view.night) return 'owl';
    return this.biome === 'blossom' ? 'crane' : 'caw';
  }

  private moodShot(t: number, sparse: number): void {
    const n = this.next;
    const now = t - 0.05;
    if (this.mood === Mood.GlassIce) {
      n.mood = now + rand(4.5, 10) * sparse;
      this.play('creak', t, 0.5, rand(-0.8, 0.8), rand(2500, 7000), rand(0.8, 1.2));
    } else if (this.biome === 'volcanic') {
      n.mood = now + rand(2.2, 5) * sparse;
      this.play('crackle', t, 0.32, rand(-0.6, 0.6), 7000, rand(0.85, 1.15));
    } else if (this.biome === 'blossom') {
      n.mood = now + rand(6, 12) * sparse;
      this.play('chimes', t, 0.3, rand(-0.6, 0.6), 7000, rand(0.98, 1.02));
    } else if (this.mood === Mood.Powder) {
      n.mood = now + rand(6, 12) * sparse;
      this.play('slough', t, 0.45, rand(-0.8, 0.8), 3000, rand(0.85, 1.15));
    } else if (this.biome === 'glacier') {
      n.mood = now + rand(14, 26) * sparse;
      this.play('creak', t, 0.3, rand(-0.8, 0.8), rand(2000, 5000), rand(0.8, 1.1));
    } else n.mood = now + 8;
  }

  /** The crowd cheers (k 0..1): its bed swells and brightens, a cheer take plays on its side, and a
   *  whistle or a drum follows. At most one every 0.4 s. */
  private cheer(k: number, t: number): void {
    const v = this.view;
    if (t - this.lastCheer < 0.4 || !(v.crowd > 0.1)) return;
    this.lastCheer = t;
    const p = this.crowdSwell.gain;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(1 + 1.6 * k, t, 0.07);
    p.setTargetAtTime(1, t + 0.7, 0.8);
    const lvl = LEVEL.cheer * k * Math.sqrt(v.crowd);
    this.play('cheer', t, lvl, v.crowdWide ? rand(-0.3, 0.3) : v.crowdPan, 7000 - 4500 * v.crowdBehind, rand(0.94, 1.06));
    if (this.biome === 'blossom') this.play('taiko', t + 0.05, 0.5 * lvl / LEVEL.cheer, v.crowdPan, 5000, 1);
    else if (Math.random() < 0.6) this.play('whistle', t + rand(0.1, 0.3), 0.3 * k * v.crowd, v.crowdPan + rand(-0.25, 0.25), 8000, rand(0.95, 1.08));
  }

  /** A broad gust (an overlook opening): the low band swells and falls over about 2.5 s. */
  private gustAt(t: number, k: number): void {
    const p = this.gust.gain;
    this.stats.gusts++;
    this.gustGate.want(1, t, 0);
    this.gustGate.want(0, t, 1.2);
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.setTargetAtTime(LEVEL.gust * k, t, 0.35);
    p.setTargetAtTime(0, t + 1.1, 0.7);
  }

  /** A whoosh: a band of noise swept from f0 to f1 over `dur` seconds, swelling to its middle. */
  private sweep(t: number, f0: number, f1: number, dur: number, k: number): void {
    const g = this.whoosh.gain;
    const f = this.whooshF;
    this.stats.whooshes++;
    this.whooshGate.want(1, t, 0);
    this.whooshGate.want(0, t, dur);
    f.cancelScheduledValues(t);
    f.setValueAtTime(f0, t);
    f.exponentialRampToValueAtTime(f1, t + dur);
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(LEVEL.whoosh * clamp(k, 0, 1), t + dur * 0.45);
    g.setTargetAtTime(0, t + dur * 0.5, dur * 0.22);
  }

  /**
   * Plays a take at t on a free lane: its level (before the lane's trim), pan, a lowpass for distance
   * and a playback rate for variety. One buffer source, unplugged when it ends.
   */
  private play(name: TakeName, t: number, level: number, pan: number, bright: number, rate: number): boolean {
    const buf = this.takes.get(name);
    if (!buf || !(level > 0.002)) return false;
    let lane: Lane | null = null;
    for (const l of this.lanes) {
      if (l.until <= t) {
        lane = l;
        break;
      }
    }
    if (!lane) {
      this.stats.dropped++;
      return false;
    }
    const r = clamp(rate, 0.5, 2);
    lane.until = t + buf.duration / r + 0.05;
    lane.g.gain.setValueAtTime(clamp(level, 0, 1) * LEVEL.shot, t);
    lane.lp.frequency.setValueAtTime(clamp(bright, 300, 16000), t);
    lane.pan?.pan.setValueAtTime(clamp(pan, -0.95, 0.95), t);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = r;
    s.connect(lane.g);
    s.onended = () => s.disconnect();
    s.start(t);
    this.stats.shots++;
    this.played[name] = (this.played[name] ?? 0) + 1;
    return true;
  }

  /** The snowcat's diesel loop, started (once) when its take is made. */
  private ensureDiesel(): void {
    if (this.diesel) return;
    const buf = this.takes.get('diesel');
    if (!buf) return;
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = blockRate(ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    s.connect(lp).connect(g);
    if (pan) g.connect(pan).connect(this.out);
    else g.connect(this.out);
    this.nodes.push(lp, g);
    if (pan) this.nodes.push(pan);
    s.start(ctx.currentTime);
    this.srcs.push(s);
    const gate = new Gate([[s, lp]]);
    this.gates.push(gate);
    this.diesel = { g: new Smooth(g.gain, 0.002, false, gate), pan: pan ? new Smooth(pan.pan, 0.03) : null };
  }

  /** Frames stopped (paused) or the run ended: the beds settle to silence. */
  private hush(now: number): void {
    this.hushed = true;
    for (const s of [this.crowdG, this.howlG, this.airG, this.humG, this.emberG]) s.to(0, now, 0.5);
    this.diesel?.g.to(0, now, 0.5);
    this.graph.setEnclosed(0, now);
    this.graph.music.setSpace(1, now);
    this.graph.sfx.setSpace(1, now);
    this.ambience.exposure = 0;
  }
}
