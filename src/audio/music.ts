import { Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import { type Kit, createKit } from './drums';
import { type Sec, type SectionName, LAND_MIN_STEPS, cutTo, landingStep, nextSec, sec } from './form';
import type { Bus } from './graph';
import { Formants, Sung, fadeSung, fmBell, formants, pad, pluck, sigh, sing } from './instruments';
import { type ArpTone, ArpLanes, BassLane, DrumLane, LeadLane, RiserLane } from './lanes';
import { type ChordSpec, MODES, type Note, type Song, THEME, headOf, lengthAt, notePitch, notesAt, realize, songFor } from './score';
import { type Accent, type Chord, type DeckScene, type Key, MAJOR_PENTA, type Style, accentFor, deckStyle, fit, ladder, mtof } from './theory';
import { type Voice, VoicePool, rand, smoothstep, swell } from './voices';

// The soundtrack (round 6: written, arranged and produced, where it was a generative loop). A deck is one
// arrangement (scene + mood + biome) with its own faders and step clock; changing any of the three starts
// a new deck and crossfades. Each mountain plays its own song (score.ts) in its own key, tempo and groove
// (theory.ts CLEAR), or in a mood's; the run is arranged in sections (form.ts) against what happens in it:
// set pieces, stage lines and the finish land drops on the beat nearest the moment the rider gets there,
// the last stage lifts a whole tone, a set piece ridden out breaks the band down. The title plays the main
// theme, the results its reprise in the key the run finished in.
//
// Cost: the bass, the melody, the arp and the drums are persistent lanes (lanes.ts) retuned by automation,
// so a note makes no node; a drum hit is one buffer source. Only pads (one voice a bar), the choir, the
// sparkle and the danger pulse are voices. Lanes are built lazily, one a scheduler pass, so a new deck never
// makes its graph in one go.

export type Scene = DeckScene;

type Layer = 'pad' | 'bass' | 'arp' | 'kick' | 'hat' | 'clap' | 'sparkle' | 'lead' | 'tension' | 'choir' | 'bell' | 'fx';
const LAYERS: readonly Layer[] = ['pad', 'bass', 'arp', 'kick', 'hat', 'clap', 'sparkle', 'lead', 'tension', 'choir', 'bell', 'fx'];
/** The ghost choir: at most this many voices (one per live passed ghost behind you). */
export const CHOIR_MAX = 3;

/** Fader level of each layer at full presence (balanced from solo renders, probe 'layers'). */
const MIX: Record<Layer, number> = {
  pad: 0.2,
  bass: 0.085,
  arp: 0.2,
  kick: 0.2,
  hat: 0.5,
  clap: 0.3,
  sparkle: 0.26,
  lead: 0.085,
  tension: 0.16,
  choir: 0.2,
  bell: 0.3,
  fx: 0.3,
};

/** Reverb send per layer, scaled by the style's verb. */
const SEND: Record<Layer, number> = {
  pad: 0.45,
  bass: 0.04,
  arp: 0.38,
  kick: 0.03,
  hat: 0.1,
  clap: 0.28,
  sparkle: 0.65,
  lead: 0.32,
  tension: 0.1,
  choir: 0.7,
  bell: 0.6,
  fx: 0.4,
};

const XFADE = 1.5;
/** Each section's level on the run (the arrangement's dynamics: a chorus over a verse, a bridge a breath under
 *  both), so the run's loudness moves with its form. */
const SECTION_GAIN: Record<SectionName, number> = { intro: 0.85, verse: 0.89, chorus: 1, bridge: 0.72, finale: 1.06 };
const AUDIBLE = 0.02;
const BOX = [0, 2, 4, 3, 4, 2, 1, 2];

export interface Drive {
  intensity: number;
  danger: number;
  mult: number;
  /** Move the faders fast this pass (the count-in's release). */
  snap?: boolean;
}

/** Where the run stands in the descent and how far the band has opened (cues.ts). */
export interface Build {
  /** Stage, 0 to 2. */
  stage: number;
  /** The last stage's climb to the line, 0 to 1. */
  climax: number;
  /** A stomp streak or 'In the flow' opening the band up, 0 to 1. */
  open: number;
}

/** What a landing starts: a chorus ('drop'), a chorus a whole tone up ('lift', into the last stage) or the
 *  finale (the finish line). */
export type LandKind = 'drop' | 'lift' | 'finish';
const LAND_RANK: Record<LandKind, number> = { drop: 0, lift: 1, finish: 2 };

interface Landing {
  step: number;
  t: number;
  kind: LandKind;
  /** When the build began (the riser's start). */
  from: number;
  /** The bar that leans on the build chord before it (-1: none, its pad was already built). */
  buildBar: number;
}

/** The jukebox's override (debug only): hold a section, a stage and a drive. */
export interface Force {
  section?: SectionName;
  stage?: number;
}

const NO_BUILD: Build = { stage: 0, climax: 0, open: 0 };
/** The finale (the finish line's drop) quotes the main theme's opening bar. */
const FINALE_QUOTE: readonly Note[] = THEME.answer.filter((n) => n.s < 16);
/** The arp's floor per stage: a plain cruise reaches the arp's door only in the last stage. */
const STAGE_ARP = [0, 0.4, 0.7] as const;
/** The band's tempo per stage: a touch quicker each time, changed on a bar line. */
const STAGE_TEMPO = [1, 1.025, 1.05] as const;
/** The last stage is lifted a whole tone, landing on the drop at its line. */
const LAST_STAGE_LIFT = 2;

function deckId(scene: Scene, mood: Mood, biome: BiomeId): string {
  return scene === 'title' ? 'title' : `${scene}|${mood}|${biome}`;
}

class Deck {
  readonly id: string;
  key: Key;
  retireAt = Infinity;
  cutShort = false;
  private readonly style: Style;
  private readonly accent: Accent;
  private readonly song: Song;
  private readonly mode: readonly number[];
  private stepDur: number;
  private readonly bpm: number;
  /** Semitones the key stands over its own (the last stage's lift). */
  private keyLift = 0;
  private build: Build = NO_BUILD;
  private readonly fader = {} as Record<Layer, GainNode>;
  /** The kick's pump on the pad and the bass (a sidechain by automation: a dip at each kick). */
  private readonly pump: GainNode;
  /** The section's level (SECTION_GAIN), between the faders and the crossfade. */
  private readonly sectG: GainNode;
  private readonly sends: GainNode[] = [];
  private readonly xf: GainNode;
  private readonly xfWet: GainNode;
  private readonly level = {} as Record<Layer, number>;
  private readonly applied = {} as Record<Layer, number>;
  private step = 0;
  private base: number;
  private stopAt = Infinity;
  private wasEnabled = true;
  private arpCount = 0;
  private arpLast = -1;
  /** The arrangement: the section playing, the chord this bar, a landing planned, a breakdown asked for. */
  private sec: Sec;
  private chord: Chord;
  private land: Landing | null = null;
  private breakdownDue = false;
  /** Landings done (probe), and when the last one hit. */
  landings = 0;
  landedAt = -Infinity;
  /** The pad: when the last built one stops, its voice, and the chord start it was built for. */
  private padEnd = -Infinity;
  private padVoice: Voice | null = null;
  private padFor = -1;
  /** The ghost choir: how many sing, the notes of the chord now sounding, and that chord. */
  private choirN = 0;
  private sung: Sung[] = [];
  private choirChord: { chord: Chord; root: number; end: number } | null = null;
  private readonly vowels: Formants[] = [];
  private arpChord: Chord | null = null;
  private arpRoot = -1;
  private arpNotes: number[] = [];
  private drive: Drive = { intensity: 0, danger: 0, mult: 1 };
  /** Lanes, made on first need, one a scheduler pass. */
  private readonly lanes = new Map<string, { dispose(): void }>();
  private budget = 1;
  /** Probe-only (probe.ts 'layers'): one layer heard alone, the rest held at zero. */
  solo: string | null = null;
  /** Debug-only (the jukebox): a section and a stage held. */
  force: Force | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly pool: VoicePool,
    private readonly kit: Kit,
    bus: Bus,
    readonly scene: Scene,
    mood: Mood,
    biome: BiomeId,
    start: number,
    private readonly lite: boolean,
  ) {
    this.id = deckId(scene, mood, biome);
    this.style = deckStyle(scene, mood, biome);
    this.accent = accentFor(biome);
    const s = this.style;
    if (scene === 'results') {
      // The reprise: the main theme, slower, in the major key the run ends in (a minor key's relative major).
      this.key = { tonic: s.tonic + s.bright, penta: MAJOR_PENTA, bright: 0, bpm: Math.round(s.bpm * 0.85) };
      this.mode = MODES.major;
      this.song = THEME;
      this.sec = sec('chorus', -1);
    } else {
      this.key = { tonic: s.tonic, penta: s.penta, bright: s.bright, bpm: s.bpm };
      this.mode = MODES[s.mode];
      this.song = scene === 'title' ? THEME : songFor(biome);
      this.sec = sec('intro', -1);
    }
    this.chord = realize(this.mode, this.song.intro[0]);
    this.bpm = this.key.bpm;
    this.stepDur = 60 / this.key.bpm / 4;
    this.base = start;

    this.xf = ctx.createGain();
    this.xf.gain.value = 0;
    this.xf.connect(bus.dry);
    this.xfWet = ctx.createGain();
    this.xfWet.gain.value = 0;
    this.xfWet.connect(bus.wet);
    this.sectG = ctx.createGain();
    this.sectG.gain.value = scene === 'run' ? SECTION_GAIN.intro : 1;
    this.sectG.connect(this.xf);
    this.pump = ctx.createGain();
    this.pump.connect(this.sectG);
    for (const l of LAYERS) {
      const f = ctx.createGain();
      f.gain.value = 0;
      f.connect(l === 'pad' || l === 'bass' ? this.pump : this.sectG);
      const snd = ctx.createGain();
      snd.gain.value = SEND[l] * s.verb;
      f.connect(snd);
      snd.connect(this.xfWet);
      this.fader[l] = f;
      this.sends.push(snd);
      this.level[l] = 0;
      this.applied[l] = -1;
    }
  }

  fadeIn(now: number, dur: number): void {
    for (const g of [this.xf, this.xfWet]) {
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + dur);
    }
  }

  fadeOut(now: number, dur: number): void {
    for (const g of [this.xf, this.xfWet]) {
      const p = g.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(0, now + dur);
    }
    this.stopAt = Math.min(this.stopAt, now + dur);
    this.retireAt = Math.min(this.retireAt, now + dur + 3);
  }

  cut(now: number): void {
    this.fadeOut(now, 0.04);
    this.retireAt = now + 0.1;
    this.cutShort = true;
  }

  setDrive(d: Drive): void {
    this.drive = d;
  }

  setBuild(b: Build): void {
    if (this.scene === 'run') this.build = b;
  }

  get lift(): number {
    return this.keyLift;
  }

  liftKey(n: number): void {
    if (n === this.keyLift) return;
    this.key = { ...this.key, tonic: this.key.tonic + n - this.keyLift };
    this.keyLift = n;
  }

  /**
   * Plans a landing near `target` (AudioContext time): the beat nearest it at least LAND_MIN_STEPS past
   * what is scheduled (form.ts landingStep). A landing already planned is kept when it is locked (its pad is
   * built) or near the new target; a bigger kind (the finish over a drop) takes it over. Returns the landing
   * time, or null on a deck that does not land (the title, the results, the finale).
   */
  plan(target: number, kind: LandKind, now: number): number | null {
    if (this.scene !== 'run' || this.sec.name === 'finale' || now >= this.stopAt) return null;
    const cur = this.land;
    const locked = cur !== null && cur.step < this.step + LAND_MIN_STEPS;
    if (cur && (locked || Math.abs(cur.t - target) < 0.3)) {
      if (LAND_RANK[kind] > LAND_RANK[cur.kind]) cur.kind = kind;
      return cur.t;
    }
    const pick = landingStep(this.step, this.base, this.stepDur, target);
    if (pick.step < 0) return null;
    const k = cur && LAND_RANK[cur.kind] > LAND_RANK[kind] ? cur.kind : kind;
    const from = cur ? cur.from : Math.max(now, pick.t - Math.min(4.2, 32 * this.stepDur));
    const before = (pick.step & 15) === 0 ? pick.step - 16 : pick.step & ~15;
    const buildBar = cur && cur.buildBar >= 0 && cur.buildBar - 8 < this.step ? cur.buildBar : before - 8 >= this.step ? before : -1;
    this.land = { step: pick.step, t: pick.t, kind: k, from, buildBar };
    (this.lanes.get('riser') as RiserLane | undefined)?.rise(from, pick.t, k === 'finish' ? 0.5 : 0.36);
    return pick.t;
  }

  /** The landing planned, if any (its time and kind). */
  get landing(): { t: number; kind: LandKind } | null {
    return this.land ? { t: this.land.t, kind: this.land.kind } : null;
  }

  /** A set piece ridden out or a wipeout: the band breaks down at the next bar (unless a drop is near). */
  breakdown(): void {
    if (this.scene !== 'run' || this.sec.name === 'finale') return;
    if (this.land && this.land.step - this.step < 24) return;
    this.breakdownDue = true;
  }

  get section(): Sec {
    return this.sec;
  }

  /** A line's notes as MIDI pitches in the key playing (plus `lift`), with their offsets and lengths in
   *  seconds at the band's tempo: the stingers quote the hook's head and the finish the theme's. */
  pitches(notes: readonly Note[], lift: number): { m: number; at: number; dur: number }[] {
    const base = fit(this.key.tonic, 60) + lift;
    return notes.map((n) => ({ m: notePitch(this.mode, base, n), at: n.s * this.stepDur, dur: n.l * this.stepDur }));
  }

  get head(): readonly Note[] {
    return headOf(this.song);
  }

  /** The chord sounding (absolute root MIDI pitch class and tones), for cues that pick chord tones. */
  chordNow(): { root: number; tones: readonly number[] } {
    return { root: this.key.tonic + this.chord.root, tones: this.chord.tones };
  }

  schedule(until: number, now: number, enabled: boolean): void {
    this.budget = 1;
    if (this.scene === 'run') this.lane('riser');
    this.levels();
    this.applyLevels(now, this.drive.snap ? 0.06 : 0.45);
    let gap = enabled && !this.wasEnabled;
    this.wasEnabled = enabled;
    if (this.base < now - 0.25) {
      // The timer stalled (background tab, resume): rejoin the grid instead of bursting old notes.
      const skip = Math.ceil((now - this.base) / this.stepDur);
      this.base += skip * this.stepDur;
      this.step += skip;
      if (this.land && this.land.step < this.step + 1) this.land = null;
      gap = true;
    }
    if (gap && enabled && this.base < this.stopAt) this.repad(now);
    while (this.base < until && this.base < this.stopAt) {
      // A landing on beat 3 or 4 cuts its bar: that beat is the next bar's downbeat.
      const land = this.land;
      if (land && this.step === land.step) {
        const to = cutTo(this.step);
        if (this.padFor === land.step) this.padFor = to;
        this.step = to;
        land.step = to;
      }
      if (this.scene === 'run' && (this.step & 15) === 0) this.stepDur = 60 / (this.bpm * STAGE_TEMPO[Math.min(2, this.stageNow())]) / 4;
      const t = this.base + (this.step & 1 ? this.style.swing * this.stepDur : 0);
      if (enabled) this.play(this.step, Math.max(t, now));
      else if ((this.step & 15) === 0) this.advance(this.step);
      this.base += this.stepDur;
      this.step++;
    }
  }

  dispose(): void {
    for (const l of LAYERS) this.fader[l].disconnect();
    for (const s of this.sends) s.disconnect();
    for (const f of this.vowels) for (const n of f.nodes) n.disconnect();
    for (const ln of this.lanes.values()) ln.dispose();
    this.lanes.clear();
    this.pump.disconnect();
    this.sectG.disconnect();
    this.xf.disconnect();
    this.xfWet.disconnect();
  }

  private stageNow(): number {
    return this.force?.stage ?? this.build.stage;
  }

  /** A lane, made on first need: at most one a scheduler pass (null until its pass comes). */
  private lane(name: 'bass'): BassLane | null;
  private lane(name: 'lead' | 'leadHi'): LeadLane | null;
  private lane(name: 'arp'): ArpLanes | null;
  private lane(name: 'kick' | 'snare' | 'hatL' | 'hatR' | 'open' | 'fx' | 'boom'): DrumLane | null;
  private lane(name: 'riser'): RiserLane | null;
  private lane(name: string): BassLane | LeadLane | ArpLanes | DrumLane | RiserLane | null {
    const have = this.lanes.get(name) as BassLane | LeadLane | ArpLanes | DrumLane | RiserLane | undefined;
    if (have) return have;
    if (this.budget <= 0) return null;
    this.budget--;
    const ctx = this.ctx;
    const bank = this.pool.bank;
    const s = this.style;
    let made: BassLane | LeadLane | ArpLanes | DrumLane | RiserLane;
    switch (name) {
      case 'bass':
        made = new BassLane(ctx, bank, this.fader.bass, s.kit.kick === 'deep' ? 1.3 : 1);
        break;
      case 'lead':
        made = new LeadLane(ctx, bank, this.fader.lead, s.lead, 0);
        break;
      case 'leadHi':
        made = new LeadLane(ctx, bank, this.fader.lead, s.lead, 0.35);
        break;
      case 'arp': {
        const tone: ArpTone = s.arp.timbre === 'pluck' || s.arp.timbre === 'koto' ? 'pluck' : 'fm';
        made = new ArpLanes(ctx, bank, this.fader.arp, tone, this.lite ? 2 : s.arp.rate === 1 ? 4 : 3);
        break;
      }
      case 'kick':
        made = new DrumLane(ctx, this.fader.kick);
        break;
      case 'snare':
        made = new DrumLane(ctx, this.fader.clap, -0.05);
        break;
      case 'hatL':
        made = new DrumLane(ctx, this.fader.hat, -0.3);
        break;
      case 'hatR':
        made = new DrumLane(ctx, this.fader.hat, 0.3);
        break;
      case 'open':
        made = new DrumLane(ctx, this.fader.hat, 0.2);
        break;
      case 'fx':
      case 'boom':
        made = new DrumLane(ctx, this.fader.fx);
        break;
      case 'riser':
        made = new RiserLane(ctx, bank, this.fader.fx);
        break;
      default:
        return null;
    }
    this.lanes.set(name, made);
    return made;
  }

  private levels(): void {
    const L = this.level;
    for (const l of LAYERS) L[l] = 0;
    L.pad = 1;
    const name = this.sec.name;
    if (this.scene === 'title') {
      L.arp = 0.6;
      L.sparkle = 0.4;
      L.lead = name === 'intro' ? 0 : 1;
      L.bass = 0.5;
      L.bell = 0.7;
      L.hat = name === 'chorus' ? 0.6 : 0;
      L.kick = name === 'chorus' ? 0.45 : 0;
      L.clap = name === 'chorus' ? 0.5 : 0;
    } else if (this.scene === 'results') {
      L.bass = 0.45;
      L.arp = 0.5;
      L.sparkle = 0.5;
      L.hat = 0.3;
      L.lead = 0.7;
      L.bell = 0.6;
    } else {
      // The drive builds the arrangement (src/game/intensity.ts plus the engine's groove, accents and the
      // descent): the pad always; the bass from 0.26 (the run floor of 0.30 has it); hats from 0.28; the arp
      // from 0.48 and the kick from 0.54; clap and sparkle from 0.72. The sections shape it on top: a chorus
      // brings the kick, the hats, the arp and the hook in at a cruise (`on`: the band is past the run
      // floor), a verse carries the answering line once the descent or the skill lifts it, a bridge strips
      // to the pad, the bells and a shaker.
      const i = this.drive.intensity;
      const on = smoothstep(0.24, 0.31, i);
      const { open, climax } = this.build;
      const stage = this.stageNow();
      L.bass = smoothstep(0.26, 0.4, i);
      L.hat = smoothstep(0.28, 0.42, i);
      L.arp = Math.max(smoothstep(0.48, 0.6, i), 0.85 * open, STAGE_ARP[Math.min(2, stage)] * on);
      L.kick = smoothstep(0.54, 0.66, i);
      L.clap = Math.max(smoothstep(0.72, 0.84, i), 0.7 * smoothstep(0.55, 1, climax));
      L.sparkle = Math.max(smoothstep(0.74, 0.86, i), 0.75 * open);
      L.tension = smoothstep(0.05, 0.6, this.drive.danger);
      L.choir = this.choirN > 0 ? 1 : 0;
      L.fx = 1;
      switch (name) {
        case 'intro':
          L.kick = 0;
          L.clap = 0;
          L.sparkle = 0;
          L.arp = Math.min(L.arp, 0.5);
          L.bell = 1;
          break;
        case 'verse':
          L.lead = Math.max(smoothstep(0.42, 0.52, i), 0.8 * open, stage >= 1 ? 0.7 * on : 0);
          break;
        case 'chorus':
          L.lead = on;
          L.kick = Math.max(L.kick, 0.9 * on);
          L.hat = Math.max(L.hat, on);
          L.bass = Math.max(L.bass, on);
          L.arp = Math.max(L.arp, 0.6 * on);
          L.clap = Math.max(L.clap, 0.6 * smoothstep(0.4, 0.5, i), stage >= 2 ? 0.6 * on : 0);
          break;
        case 'bridge':
          L.kick = 0;
          L.clap = 0;
          L.hat = Math.min(L.hat, 0.45);
          L.bass = Math.min(L.bass, 0.6);
          L.arp = Math.min(L.arp, 0.6);
          L.sparkle = Math.min(L.sparkle, 0.5);
          L.bell = Math.max(0.5, on);
          break;
        case 'finale':
          L.kick = 1;
          L.lead = 1;
          L.bass = 1;
          L.hat = 0;
          L.clap = 0;
          L.arp = 0.4;
          break;
      }
      // A landing coming: the snare roll and the riser build on the fx and clap faders.
      if (this.land) L.clap = Math.max(L.clap, 0.85 * on);
    }
    if (this.solo) for (const l of LAYERS) if (l !== this.solo) L[l] = 0;
  }

  private applyLevels(at: number, tau: number): void {
    for (const l of LAYERS) {
      const target = MIX[l] * this.level[l];
      if (Math.abs(target - this.applied[l]) < 0.004) continue;
      this.applied[l] = target;
      this.fader[l].gain.setTargetAtTime(target, at, tau);
    }
  }

  layerLevels(): Readonly<Record<Layer, number>> {
    return this.level;
  }

  setChoir(n: number, now: number, retaken: boolean): void {
    const want = this.scene === 'run' ? Math.max(0, Math.min(this.lite ? 2 : CHOIR_MAX, Math.round(n))) : 0;
    let delay = 0.02;
    if (retaken && want >= this.choirN && this.sung.length > 0) {
      const s = this.sung.pop();
      if (s) sigh(s, now);
      this.choirN = this.sung.length;
      delay = 0.5;
    }
    if (want === this.choirN) return;
    const cc = this.choirChord;
    if (want > this.choirN && cc && cc.end - now > delay + 0.5 && now < this.stopAt && this.wasEnabled) {
      for (let k = this.choirN; k < want; k++) this.singNote(k, cc.chord, cc.root, now + delay, cc.end - now - delay, 0.6);
    } else if (want < this.choirN) {
      while (this.sung.length > want) {
        const s = this.sung.pop();
        if (s) (retaken ? sigh : fadeSung)(s, now);
      }
    }
    this.choirN = want;
  }

  get choirVoices(): number {
    return this.choirN;
  }

  private singNote(k: number, chord: Chord, root: number, t: number, dur: number, attack: number): void {
    const tones = chord.tones;
    const pick = k === 0 ? tones[1] : k === 1 ? tones[2] : tones.length > 3 ? tones[tones.length - 1] : 12;
    const m = fit(root + (pick ?? 0), k === 0 ? 64 : k === 1 ? 67 : 71);
    const bright = 0.2 + 0.3 * k;
    const vowel = (this.vowels[k] ??= formants(this.ctx, bright, this.fader.choir));
    const v = this.pool.voice(t, 1, vowel.input, null, 0);
    v.keep = true;
    const s = sing(v, t, mtof(m), dur, 0.2, attack, bright);
    this.sung.push(s);
  }

  position(): { bar: number; cycle: number; section: SectionName } {
    return { bar: Math.max(0, this.sec.bar), cycle: this.sec.len, section: this.sec.name };
  }

  grid(): { t0: number; dur: number } {
    return { t0: this.base - this.step * this.stepDur, dur: this.stepDur };
  }

  // ------------------------------------------------------------ the arrangement

  /** The chord a section's bar plays. */
  private chordOf(s: Sec): Chord {
    const list = s.name === 'finale' ? null : this.song[s.name === 'intro' ? 'intro' : s.name];
    // The finale resolves onto a bright tonic, major whatever the mode (a picardy third in a minor key).
    const spec: ChordSpec = list ? list[((s.bar % list.length) + list.length) % list.length] : { d: 0, q: 'M', x: 'add9' };
    return realize(this.mode, spec);
  }

  /** The section and chord of the bar starting at `at` (the next bar line, or a cut landing's beat), as
   *  barStart will play it: the landing's section, the build chord before a landing, or the form's next. */
  private peek(at: number): { sec: Sec; chord: Chord; lift: number } {
    const land = this.land;
    if (land && at === land.step) {
      // A drop into a chorus still in its first phrase jumps to the second (the hook's answer, over the
      // borrowed chords), so a set piece just past a stage line lifts the chorus instead of restarting it.
      const cur = this.sec;
      const early = cur.name === 'chorus' && cur.bar >= 0 && cur.bar < 4;
      const s = land.kind === 'finish' ? sec('finale') : sec('chorus', early ? 4 : 0);
      return { sec: s, chord: this.chordOf(s), lift: land.kind === 'lift' ? LAST_STAGE_LIFT : this.keyLift };
    }
    // A breakdown waits for the end of the chorus's phrase: the hook is never cut off mid-line.
    const cur = this.sec;
    const phraseEnd = cur.name !== 'chorus' || ((cur.bar + 1) & 3) === 0;
    const s = this.force?.section ? this.forced(this.sec) : nextSec(this.sec, this.breakdownDue && phraseEnd);
    if (land && at === land.buildBar) return { sec: s, chord: realize(this.mode, this.song.build), lift: this.keyLift };
    return { sec: s, chord: this.chordOf(s), lift: this.keyLift };
  }

  private forced(s: Sec): Sec {
    const name = this.force?.section ?? s.name;
    return name === s.name ? { ...s, bar: (s.bar + 1) % s.len } : sec(name);
  }

  /** A new bar: the landing it starts, or the form's next bar; the chord, the choir, the levels. */
  private advance(step: number): boolean {
    const land = this.land;
    const p = this.peek(step);
    let landed = false;
    if (land && step === land.step) {
      this.land = null;
      this.landings++;
      landed = true;
      this.breakdownDue = false;
      if (p.lift !== this.keyLift) this.liftKey(p.lift);
    } else if (p.sec.name === 'bridge') this.breakdownDue = false;
    this.sec = p.sec;
    this.chord = p.chord;
    return landed;
  }

  private barStart(step: number, t: number): void {
    // No landing came for the last stage (nothing to read the course from): it lifts at the next bar.
    if (this.scene === 'run' && this.stageNow() >= 2 && this.keyLift === 0 && !this.land && this.sec.name !== 'finale') this.plan(t + this.barDur(), 'lift', t);
    const before = this.sec.name;
    const landed = this.advance(step);
    const root = this.key.tonic + this.chord.root;
    this.arpCount = 0;
    if (this.padFor !== step && !(this.sec.name === 'finale' && this.padEnd > t + 0.3)) this.padChord(this.chord, root, t, this.barDur(), step);
    const dur = this.barDur() * (this.sec.name === 'finale' && this.sec.bar === 0 ? 2 : 1);
    this.choirChord = { chord: this.chord, root, end: t + dur };
    this.sung = [];
    for (let k = 0; k < this.choirN; k++) this.singNote(k, this.chord, root, t, dur, 0.35);
    if (landed || before !== this.sec.name) {
      // The section's own levels arrive on its downbeat, not on the faders' slow drift.
      this.levels();
      this.applyLevels(t, 0.03);
      if (this.scene === 'run') this.sectG.gain.setTargetAtTime(SECTION_GAIN[this.sec.name], t, landed ? 0.01 : 0.12);
    }
    if (landed) {
      this.landedAt = t;
      // The drop: a crash, a boom under it, and the kick on the one.
      this.budget = Math.max(this.budget, 2);
      this.lane('fx')?.hit(this.kit.crash, t, 0.75);
      this.lane('boom')?.hit(this.kit.boom, t, 0.9);
    }
  }

  private barDur(): number {
    return 16 * this.stepDur;
  }

  private play(step: number, t: number): void {
    const s16 = step & 15;
    if (s16 === 0) this.barStart(step, t);
    // The next chord's pad, built half a bar before it starts (a cut landing's beat or the next bar line).
    const land = this.land;
    const barEnd = (step | 15) + 1;
    const next = land && land.step > step && land.step < barEnd ? land.step : barEnd;
    if (next - step <= 8 && this.padFor !== next) {
      const p = this.peek(next);
      const tp = t + (next - step) * this.stepDur;
      // (The finale's tonic rings two bars on one pad.)
      if (tp < this.stopAt && !(p.sec.name === 'finale' && this.padEnd > tp + 0.3)) this.padChord(p.chord, this.key.tonic + (p.lift - this.keyLift) + p.chord.root, tp, this.barDur() * (p.sec.name === 'finale' ? 2 : 1), next);
    }

    const name = this.sec.name;
    const st = this.style;
    const L = this.level;
    const sd = this.stepDur;
    const root = this.key.tonic + this.chord.root;
    const run = this.scene === 'run';
    const last = run && this.stageNow() >= 2;
    const left = land ? land.step - step : 99;
    const building = left > 0 && left <= 16;
    const gapNow = building && left <= 8;

    // ---- bass
    if (L.bass > AUDIBLE && !(building && left <= 2)) {
      const bass = this.lane('bass');
      if (bass) {
        if (name === 'bridge' || this.scene !== 'run' || name === 'finale') {
          // Long roots (and a fifth half way through on the title and the results).
          if (s16 === 0) bass.note(t, mtof(fit(root, 36)), (this.scene === 'run' ? 16 : 8) * sd * 0.95, 0.85, 0.8);
          else if (s16 === 8 && this.scene !== 'run') bass.note(t, mtof(fit(root, 36) + 7), 8 * sd * 0.95, 0.7, 0.8);
        } else {
          let off = st.bass[s16];
          // The last stage pumps: the empty 8ths take the octave.
          if ((off === null || off === undefined) && last && (s16 & 1) === 0) off = 12;
          if (off !== null && off !== undefined) {
            let gap = 1;
            while (gap < 8 && (st.bass[(s16 + gap) & 15] ?? null) === null && !(last && ((s16 + gap) & 1) === 0)) gap++;
            const vel = (s16 & 7) === 0 ? 0.95 : 0.8;
            bass.note(t, mtof(fit(root, 36) + off), gap * sd * 0.9, vel, 0.6);
          }
        }
      }
    }

    // ---- arp
    const rate = this.scene === 'title' ? st.arp.rate * 2 : this.scene === 'results' ? Math.max(2, st.arp.rate) : name === 'bridge' ? st.arp.rate * 2 : st.arp.rate;
    if (L.arp > AUDIBLE && name !== 'finale' && step % rate === 0) {
      const arp = this.lane('arp');
      const n = this.arpCount++;
      if (arp && Math.random() <= st.arp.prob) {
        const notes = this.notesFor(this.chord, root);
        const m = notes[this.arpIndex(n, notes.length)];
        const vel = (n % 4 === 0 ? 1 : 0.78) * rand(0.9, 1);
        this.arpNote(arp, t, m, vel);
        if (this.build.open > 0.5 && n % 2 === 0 && !this.lite) this.arpNote(arp, t, m + 12, vel * 0.42 * this.build.open);
      }
    }

    // ---- drums
    const kit = this.kit;
    const kv = st.kick[s16];
    const kickOk = name !== 'intro' && name !== 'bridge' && !gapNow && (name !== 'finale' || (this.sec.bar === 0 && s16 === 0));
    if (L.kick > AUDIBLE && kickOk && (kv > 0 || (name === 'finale' && s16 === 0))) {
      this.lane('kick')?.hit(kit.kick[st.kit.kick], t, Math.max(kv, name === 'finale' ? 1 : 0));
      // The kick pumps the pad and the bass: a dip to (1 - pump) and back in a tenth of a second.
      const depth = st.kit.pump * (kv >= 0.75 ? 1 : 0.5);
      if (depth > 0.01) {
        const p = this.pump.gain;
        p.setTargetAtTime(1 - depth, t, 0.004);
        p.setTargetAtTime(1, t + 0.035, 0.09);
      }
    }
    if (L.hat > AUDIBLE && name !== 'finale') {
      const hv0 = this.scene === 'results' ? ((s16 & 3) === 2 ? 0.5 : 0) : st.hat[s16];
      let hv = last && hv0 === 0 && name === 'chorus' ? 0.22 : hv0;
      let buf = kit.hat;
      if (name === 'bridge') {
        // The bridge keeps time on a shaker, off the beat.
        hv = (s16 & 3) === 2 ? 0.55 : 0;
        buf = kit.shaker;
      }
      if (building) hv = Math.max(hv, 0.25 + 0.4 * (1 - left / 16));
      if (hv > 0) {
        const open = hv >= 0.75 && name !== 'bridge';
        const lane = open ? this.lane('open') : (s16 & 2) === 0 ? this.lane('hatL') : this.lane('hatR');
        lane?.hit(open ? kit.open : buf, t, hv * rand(0.85, 1));
      }
    }
    if (L.clap > AUDIBLE && name !== 'finale') {
      let cv = name === 'intro' || name === 'bridge' ? 0 : st.clap[s16];
      if (building) {
        // The roll into a drop: 8ths, then 16ths for the last half bar, rising.
        cv = 0;
        if (left <= 8 || (s16 & 1) === 0) cv = 0.25 + 0.7 * (1 - left / 16);
      } else if (run && name === 'verse' && this.sec.bar === this.sec.len - 1 && s16 >= 12 && (s16 & 1) === 0) {
        // A fill into the chorus.
        cv = 0.4 + 0.1 * (s16 - 12);
      }
      if (cv > 0) this.lane('snare')?.hit(kit.snare[st.kit.snare], t, cv);
    }

    // ---- melody: the hook in a chorus, the answer in a verse, the theme on the title and the results
    if (L.lead > AUDIBLE && !(building && left <= 4)) this.melody(step, t);
    // ---- bells: the hook's head opens the run; the bridge recalls it high and soft
    if (L.bell > AUDIBLE) this.bells(step, t);

    if (L.sparkle > AUDIBLE && !this.lite && Math.random() < st.sparkle.prob * this.accent.sparkleMul) {
      const idx = 10 + Math.floor(Math.random() * 5);
      const v = this.pool.voice(t, 1, this.fader.sparkle, null, 0, rand(-0.8, 0.8));
      const f = mtof(ladder(this.key, idx));
      if (st.sparkle.timbre === 'glass') fmBell(v, t, f, 0.42 * rand(0.5, 1), 0.24, 2.76, 0.9, null);
      else if (st.sparkle.timbre === 'box') fmBell(v, t, f, 0.48 * rand(0.5, 1), 0.2, 5, 0.7, null);
      else fmBell(v, t, f, 0.5 * rand(0.5, 1), 0.24, 3.5, 1.1, null);
    }

    if (L.tension > AUDIBLE && (s16 & 1) === 0) {
      const m = fit(root, 38) + ((s16 & 2) === 2 ? 12 : 0);
      const v = this.pool.voice(t, 1, this.fader.tension, null, 0);
      pluck(v, t, mtof(m), (s16 & 3) === 0 ? 0.8 : 0.55, 0.09, 1.4 + this.drive.danger * 2.2, null, 0, false);
    }
  }

  /** The line a section sings, and how loud. */
  private lineFor(): { notes: readonly Note[]; amp: number } | null {
    const name = this.sec.name;
    if (this.scene === 'title') return name === 'verse' ? { notes: this.song.answer, amp: 0.85 } : name === 'chorus' ? { notes: this.song.hook, amp: 0.85 } : null;
    if (this.scene === 'results') return name === 'verse' ? { notes: this.song.answer, amp: 0.7 } : { notes: this.song.hook, amp: 0.7 };
    if (name === 'chorus') return { notes: this.song.hook, amp: 0.9 };
    if (name === 'verse') return { notes: this.song.answer, amp: 0.7 };
    if (name === 'finale') return this.sec.bar === 0 ? { notes: FINALE_QUOTE, amp: 1 } : null;
    return null;
  }

  private melody(step: number, t: number): void {
    const line = this.lineFor();
    if (!line) return;
    const at = (Math.max(0, this.sec.bar) % 8) * 16 + (step & 15);
    const notes = notesAt(line.notes, at);
    if (notes.length === 0) return;
    const lead = this.lane('lead');
    if (!lead) return;
    const base = fit(this.key.tonic, 60);
    const n = notes[0];
    const m = notePitch(this.mode, base, n);
    const dur = lengthAt(line.notes, n) * this.stepDur * 0.94;
    lead.note(t, mtof(m), dur, line.amp);
    // Doubled an octave up when the band opens, the climb nears the line, or in the last stage's choruses.
    const run = this.scene === 'run';
    const dbl = run && !this.lite && this.sec.name === 'chorus' ? Math.max(0.6 * smoothstep(0.55, 1, this.build.open), 0.5 * this.build.climax, this.stageNow() >= 2 ? 0.45 : 0, 0.5 * smoothstep(0.8, 0.92, this.drive.intensity)) : 0;
    if (dbl > 0.05) this.lane('leadHi')?.note(t, mtof(m + 12), dur, line.amp * 0.45 * dbl);
  }

  private bells(step: number, t: number): void {
    const name = this.sec.name;
    const s16 = step & 15;
    let notes: Note[] | null = null;
    let at = 0;
    if (name === 'intro') {
      // The run opens on the hook's head, rung on bells, in both intro bars.
      notes = headOf(this.song);
      at = s16;
    } else if (name === 'bridge' && (this.sec.bar & 1) === 0) {
      notes = this.song.hook.filter((n) => n.s < 32);
      at = (this.sec.bar & 2 ? 16 : 0) + s16;
    }
    if (!notes) return;
    const base = fit(this.key.tonic, 60) + 12;
    for (const n of notes) {
      if (n.s !== at) continue;
      const v = this.pool.voice(t, 1, this.fader.bell, null, 0, (n.s & 4) === 0 ? -0.35 : 0.35);
      fmBell(v, t, mtof(notePitch(this.mode, base, n)), 0.45, 0.5, 3.5, 1.1, null);
    }
  }

  private arpNote(arp: ArpLanes, t: number, m: number, vel: number): void {
    const tm = this.style.arp.timbre;
    const f = mtof(m);
    const b = 1 + Math.min(this.drive.mult - 1, 9) * 0.06;
    if (arp.tone === 'pluck') {
      const koto = tm === 'koto' || this.accent.koto;
      arp.note(t, f, 0.62 * vel, koto ? 0.26 : 0.2, (koto ? 4.2 : 3 * this.accent.pluckBright) * b, 2, 1, koto ? 0.03 : 0);
    } else {
      const ratio = tm === 'glass' ? 2.76 : tm === 'box' ? 5 : tm === 'mallet' ? 3.93 : 3.5;
      arp.note(t, f, 0.45 * vel, tm === 'box' ? 0.25 : 0.3, 1, ratio, (tm === 'box' ? 0.7 : 1) * b);
    }
  }

  /** Rebuilds the pad the skipped steps should have built (a stall, or music muted by the slider). */
  private repad(now: number): void {
    const barStep = this.step & ~15;
    const left = (barStep + 16 - this.step) * this.stepDur;
    if (this.padEnd <= now + 0.1 && left >= 4 * this.stepDur) this.padChord(this.chord, this.key.tonic + this.chord.root, now + 0.02, left, -2);
  }

  /** The pad for the chord starting at `forStep`: a fuller spread (root low, the rest above, alternate notes
   *  out to either side) through a lowpass that opens; one voice. A chord cut short by a landing releases
   *  the pad under it as the new one starts. */
  private padChord(chord: Chord, root: number, t: number, dur: number, forStep: number): void {
    this.padFor = forStep;
    const prev = this.padVoice;
    if (prev && !prev.dead && this.padEnd > t + 0.15) {
      const p = prev.out.gain;
      p.cancelScheduledValues(t);
      p.setTargetAtTime(0, t, 0.25);
    }
    this.padEnd = t + dur;
    const notes: number[] = [fit(root, 43)];
    for (const x of chord.tones) {
      if (x === 0) continue;
      const m = fit(root + x, x >= 12 ? 62 : 55);
      if (!notes.includes(m)) notes.push(m);
    }
    const cut = this.style.pad.cutoff * this.accent.padCut * (this.scene === 'title' ? 0.85 : 1) * (1 - 0.25 * this.drive.danger) * (1 + 0.9 * this.build.open) * (this.sec.name === 'bridge' ? 1.25 : 1);
    const v = this.pool.voice(t, 1, this.fader.pad, null, 0);
    v.keep = true;
    this.padVoice = v;
    const p = this.style.pad;
    if (this.lite) {
      pad(v, t, notes.slice(0, 4).map(mtof), dur + 0.1, 0.9, cut, p.attack, p.detune, p.wobble, null);
      return;
    }
    // A fifth over the root an octave up fills the middle (the old pad's hole between 50 and 62).
    const fifth = fit(root + 7, 50);
    if (!notes.includes(fifth)) notes.splice(1, 0, fifth);
    const fs = notes.slice(0, 6).map(mtof);
    const g = v.envelope(null);
    const end = swell(g.gain, t, 0.95 * (0.75 / Math.max(1, fs.length)) * 1.15, p.attack, Math.max(0, dur + 0.1 - p.attack), 0.45);
    const sides = [v.panner(-0.5, g), v.panner(0.5, g)];
    const lps = sides.map((s) => {
      const lp = v.filter('lowpass', cut * 0.55, 0.6, s);
      lp.frequency.setValueAtTime(cut * 0.55, t);
      lp.frequency.linearRampToValueAtTime(cut, t + p.attack + dur * 0.5);
      lp.frequency.linearRampToValueAtTime(cut * 0.7, end);
      return lp;
    });
    let wob: GainNode | null = null;
    if (p.wobble > 0) {
      wob = v.gain(p.wobble, null);
      v.osc('sine', 0.9, t, end, wob);
    }
    const oscs = fs.map((f, i) => v.osc(v.bank.warmSaw, f, t, end, lps[i % 2], i % 2 === 0 ? -p.detune : p.detune));
    oscs.push(v.osc('triangle', fs[0], t, end, lps[0], p.detune * 0.5));
    oscs.push(v.osc('triangle', fs[0], t, end, lps[1], -p.detune * 0.5));
    if (wob) for (const o of oscs) wob.connect(o.detune);
  }

  private notesFor(chord: Chord, root: number): number[] {
    if (this.arpChord === chord && this.arpRoot === root) return this.arpNotes;
    const lo = this.style.arp.oct > 0 ? 67 : 60;
    const pcs = new Set(chord.tones.map((x) => (root + x) % 12));
    const notes: number[] = [];
    for (let m = lo; m < lo + 19; m++) if (pcs.has(((m % 12) + 12) % 12)) notes.push(m);
    this.arpChord = chord;
    this.arpRoot = root;
    this.arpNotes = notes;
    return notes;
  }

  private arpIndex(n: number, len: number): number {
    switch (this.style.arp.kind) {
      case 'up':
        return n % len;
      case 'updown': {
        const period = Math.max(1, 2 * len - 2);
        const p = n % period;
        return p < len ? p : period - p;
      }
      case 'box':
        return BOX[n % BOX.length] % len;
      case 'random': {
        let i = Math.floor(Math.random() * len);
        if (i === this.arpLast && len > 1) i = (i + 1) % len;
        this.arpLast = i;
        return i;
      }
    }
  }
}

export class Music {
  /** False while the music volume is zero: the clock keeps running but no notes are made. */
  enabled = true;
  private readonly decks: Deck[] = [];
  private scene: Scene = 'title';
  private mood = Mood.None;
  private biome: BiomeId = 'alpine';
  private drive: Drive = { intensity: 0, danger: 0, mult: 1 };
  private build: Build = NO_BUILD;
  private readonly kit: Kit;
  /** Over the line: the results deck takes over at this time (the finale's hit rings first). */
  private resultsAt = Infinity;
  /** Probe: decks started (each after the first is a crossfade). */
  decksStarted = 0;
  private choir = 0;
  /** Low: a lighter arrangement (two arp lanes, no octave double or sparkle, a four-note mono pad, two
   *  choir voices). */
  lite = false;
  /** Probe-only: solo one layer on every deck (null: the whole band). */
  solo: string | null = null;
  /** Debug-only (the jukebox). */
  force: Force | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly pool: VoicePool,
    private readonly bus: Bus,
  ) {
    this.kit = createKit(ctx);
  }

  /** The drum kit, shared with the effects (the set pieces' drums). */
  get drums(): Kit {
    return this.kit;
  }

  setTarget(scene: Scene, mood: Mood, biome: BiomeId): void {
    this.scene = scene;
    this.mood = mood;
    this.biome = biome;
    if (scene !== 'run') this.resultsAt = Infinity;
  }

  setDrive(intensity: number, danger: number, mult: number, snap = false): void {
    this.drive = { intensity, danger, mult, snap: snap || this.drive.snap === true };
  }

  setBuild(stage: number, climax: number, open: number): void {
    const b = this.build === NO_BUILD ? (this.build = { ...NO_BUILD }) : this.build;
    b.stage = stage;
    b.climax = climax;
    b.open = open;
  }

  private get top(): Deck | undefined {
    return this.decks[this.decks.length - 1];
  }

  key(): Key {
    const top = this.top;
    if (top) return top.key;
    const s = deckStyle(this.scene, this.mood, this.biome);
    return { tonic: s.tonic, penta: s.penta, bright: s.bright, bpm: s.bpm };
  }

  grid(): { t0: number; dur: number } | null {
    const top = this.top;
    return top ? top.grid() : null;
  }

  /** The chord sounding now on the playing deck (absolute root, tones), or null. */
  chord(): { root: number; tones: readonly number[] } | null {
    const top = this.top;
    return top ? top.chordNow() : null;
  }

  layerLevels(): Readonly<Record<string, number>> | null {
    const top = this.top;
    return top ? top.layerLevels() : null;
  }

  setChoir(n: number, now: number, retaken = false): void {
    this.choir = n;
    this.top?.setChoir(n, now, retaken);
  }

  choirVoices(): number {
    const top = this.top;
    return top ? top.choirVoices : 0;
  }

  position(): { bar: number; cycle: number; section: SectionName } | null {
    const top = this.top;
    return top ? top.position() : null;
  }

  /** Plans a landing near `target` on the run deck (see Deck.plan). Returns its time, or null. */
  land(target: number, kind: LandKind, now: number): number | null {
    const top = this.top;
    if (!top || top.id !== deckId(this.scene, this.mood, this.biome)) return null;
    return top.plan(target, kind, now);
  }

  /** The landing planned on the playing deck, if any. */
  landing(): { t: number; kind: LandKind } | null {
    return this.top?.landing ?? null;
  }

  /** When the playing deck last landed a drop. */
  get landedAt(): number {
    return this.top?.landedAt ?? -Infinity;
  }

  /** The hook's head in the key playing, `lift` semitones up (the set pieces' call and their won stinger). */
  head(lift: number): { m: number; at: number; dur: number }[] {
    const top = this.top;
    return top ? top.pitches(top.head, lift) : [];
  }

  /** The main theme's opening bar in the key playing (the finish's fanfare, in unison with the finale). */
  theme(): { m: number; at: number; dur: number }[] {
    const top = this.top;
    return top ? top.pitches(FINALE_QUOTE, 0) : [];
  }

  /** Landings the playing deck has made (probe). */
  get landings(): number {
    return this.top?.landings ?? 0;
  }

  breakdown(): void {
    this.top?.breakdown();
  }

  /** Over the line at `now`: the results deck comes in after the finale's hit has rung (a bar and a half
   *  after the landing, or after now when none was planned). */
  finish(now: number): void {
    const l = this.landing();
    const g = this.grid();
    const bar = g ? g.dur * 16 : 2;
    const at = l && l.kind === 'finish' && l.t > now - 0.5 ? l.t : now;
    this.resultsAt = at + bar * 1.5;
  }

  tick(now: number, until: number): void {
    if (this.scene === 'run' && now >= this.resultsAt) {
      this.scene = 'results';
      this.resultsAt = Infinity;
    }
    const id = deckId(this.scene, this.mood, this.biome);
    const top = this.top;
    if (!top || top.id !== id) {
      if (top) top.fadeOut(now, XFADE);
      const d = new Deck(this.ctx, this.pool, this.kit, this.bus, this.scene, this.mood, this.biome, now + 0.05, this.lite);
      if (top && this.scene === 'results') d.liftKey(top.lift);
      d.fadeIn(now, top ? XFADE : 1.2);
      d.setChoir(this.choir, now, false);
      this.decks.push(d);
      this.decksStarted++;
      let kept = 0;
      for (let i = this.decks.length - 1; i >= 0; i--) {
        const x = this.decks[i];
        if (!x.cutShort && ++kept > 3) x.cut(now);
      }
    }
    for (const d of this.decks) {
      d.setDrive(this.drive);
      d.setBuild(this.build);
      d.solo = this.solo;
      d.force = this.force;
      d.schedule(until, now, this.enabled);
    }
    if (this.drive.snap) this.drive = { ...this.drive, snap: false };
    for (let i = this.decks.length - 1; i >= 0; i--) {
      if (now >= this.decks[i].retireAt) {
        this.decks[i].dispose();
        this.decks.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const d of this.decks) d.dispose();
    this.decks.length = 0;
  }
}
