import { Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import type { Bus } from './graph';
import { Sung, clap, fadeSung, fmBell, hat, kick, lead, mallet, pad, ping, pluck, sigh, sing } from './instruments';
import { Accent, Chord, Key, LeadKind, MAJOR_PENTA, RESOLVED, Style, Timbre, accentFor, fit, ladder, mtof, progFor, styleFor } from './theory';
import { VoicePool, rand, smoothstep } from './voices';

// Generative soundtrack. A deck is one arrangement (scene + mood + biome) with its own faders and
// step clock; changing any of the three starts a new deck and crossfades. Notes are created only
// inside the scheduler's lookahead window and only for layers that are audible.

export type Scene = 'title' | 'run' | 'results';

type Layer = 'pad' | 'bass' | 'arp' | 'kick' | 'hat' | 'clap' | 'sparkle' | 'lead' | 'tension' | 'choir';
const LAYERS: readonly Layer[] = ['pad', 'bass', 'arp', 'kick', 'hat', 'clap', 'sparkle', 'lead', 'tension', 'choir'];
/** The ghost choir: at most this many voices (one per live passed ghost behind you). */
export const CHOIR_MAX = 3;

/** Fader level of each layer at full presence. Balanced from solo renders: pad alone sits near
 *  -27 dBFS RMS and the full arrangement near -20, leaving headroom for effects on top. */
const MIX: Record<Layer, number> = {
  pad: 0.19,
  bass: 0.13,
  arp: 0.2,
  kick: 0.29,
  hat: 0.34,
  clap: 0.32,
  sparkle: 0.26,
  lead: 0.07,
  tension: 0.16,
  choir: 0.2,
};

/** Reverb send per layer, scaled by the style's verb. */
const SEND: Record<Layer, number> = {
  pad: 0.45,
  bass: 0.05,
  arp: 0.38,
  kick: 0.03,
  hat: 0.1,
  clap: 0.32,
  sparkle: 0.65,
  lead: 0.4,
  tension: 0.1,
  choir: 0.7,
};

const XFADE = 1.5;
const AUDIBLE = 0.02;

/** Lead rhythms over two bars: [step, length in steps]. */
const LEAD_RHYTHM: Record<LeadKind, readonly (readonly [number, number])[]> = {
  square: [[0, 3], [4, 2], [6, 2], [8, 6], [16, 3], [20, 2], [22, 2], [24, 7]],
  flute: [[0, 6], [8, 4], [12, 4], [16, 10], [28, 4]],
  theremin: [[0, 7], [8, 7], [16, 11], [28, 4]],
};
const LEAD_LO = 3;
const LEAD_HI = 9;
const BOX = [0, 2, 4, 3, 4, 2, 1, 2];

interface Placed {
  chord: Chord;
  start: number;
}

interface LeadNote {
  step: number;
  len: number;
  idx: number;
}

export interface Drive {
  intensity: number;
  danger: number;
  mult: number;
  /** Move the faders fast this pass (the count-in's release). */
  snap?: boolean;
}

function deckId(scene: Scene, mood: Mood, biome: BiomeId): string {
  return `${scene}|${mood}|${biome}`;
}

const clampLead = (i: number): number => (i < LEAD_LO ? LEAD_LO : i > LEAD_HI ? LEAD_HI : i);

class Deck {
  readonly id: string;
  readonly key: Key;
  retireAt = Infinity;
  cutShort = false;
  private readonly style: Style;
  private readonly accent: Accent;
  private readonly placed: Placed[] = [];
  private readonly cycle: number;
  private readonly stepDur: number;
  private readonly fader = {} as Record<Layer, GainNode>;
  private readonly sends: GainNode[] = [];
  private readonly xf: GainNode;
  private readonly xfWet: GainNode;
  private readonly level = {} as Record<Layer, number>;
  private readonly applied = {} as Record<Layer, number>;
  private step = 0;
  private base: number;
  private stopAt = Infinity;
  /** When the most recently built pad stops sustaining. */
  private padEnd = -Infinity;
  private wasEnabled = true;
  private arpCount = 0;
  private arpLast = -1;
  /** The ghost choir: how many sing, the notes of the chord now sounding, and that chord. */
  private choirN = 0;
  private sung: Sung[] = [];
  private choirChord: { chord: Chord; root: number; end: number } | null = null;
  private arpChord: Chord | null = null;
  private arpNotes: number[] = [];
  private phrase: LeadNote[] = [];
  private walk = 5;
  private drive: Drive = { intensity: 0, danger: 0, mult: 1 };

  constructor(
    ctx: BaseAudioContext,
    private readonly pool: VoicePool,
    bus: Bus,
    readonly scene: Scene,
    mood: Mood,
    biome: BiomeId,
    start: number,
  ) {
    this.id = deckId(scene, mood, biome);
    this.style = styleFor(mood);
    this.accent = accentFor(biome);
    const s = this.style;
    // Clear Skies plays the mountain's song (A A B B, theory.ts); moods keep their own loop.
    let prog = progFor(mood, biome);
    if (scene === 'results') {
      this.key = { tonic: s.tonic + s.bright, penta: MAJOR_PENTA, bright: 0, bpm: Math.round(s.bpm * 0.85) };
      prog = RESOLVED;
    } else this.key = { tonic: s.tonic, penta: s.penta, bright: s.bright, bpm: s.bpm };
    let bar = 0;
    for (const chord of prog) {
      this.placed.push({ chord, start: bar });
      bar += chord.bars;
    }
    this.cycle = bar;
    this.stepDur = 60 / this.key.bpm / 4;
    this.base = start;

    this.xf = ctx.createGain();
    this.xf.gain.value = 0;
    this.xf.connect(bus.dry);
    this.xfWet = ctx.createGain();
    this.xfWet.gain.value = 0;
    this.xfWet.connect(bus.wet);
    for (const l of LAYERS) {
      const f = ctx.createGain();
      f.gain.value = 0;
      f.connect(this.xf);
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
    // Leave room for pad releases and the reverb tail before disconnecting.
    this.retireAt = Math.min(this.retireAt, now + dur + 3);
  }

  /** Too many decks at once (rapid changes): fade this one out fast instead of cutting it. */
  cut(now: number): void {
    this.fadeOut(now, 0.04);
    this.retireAt = now + 0.1;
    this.cutShort = true;
  }

  setDrive(d: Drive): void {
    this.drive = d;
  }

  schedule(until: number, now: number, enabled: boolean): void {
    this.levels();
    this.applyLevels(now);
    let gap = enabled && !this.wasEnabled;
    this.wasEnabled = enabled;
    if (this.base < now - 0.25) {
      // The timer stalled (background tab, resume): rejoin the grid instead of bursting old notes.
      const skip = Math.ceil((now - this.base) / this.stepDur);
      this.base += skip * this.stepDur;
      this.step += skip;
      gap = true;
    }
    // Pads are built half a bar ahead, so skipped steps (a stall, or music muted by the volume
    // slider) can leave the current chord without its bed until the next chord.
    if (gap && enabled && this.base < this.stopAt) this.repad(now);
    while (this.base < until && this.base < this.stopAt) {
      const t = this.base + (this.step & 1 ? this.style.swing * this.stepDur : 0);
      if (enabled) this.play(this.step, Math.max(t, now));
      this.base += this.stepDur;
      this.step++;
    }
  }

  dispose(): void {
    for (const l of LAYERS) this.fader[l].disconnect();
    for (const s of this.sends) s.disconnect();
    this.xf.disconnect();
    this.xfWet.disconnect();
  }

  private levels(): void {
    const L = this.level;
    for (const l of LAYERS) L[l] = 0;
    L.pad = 1;
    if (this.scene === 'title') {
      L.arp = 0.7;
      L.sparkle = 0.45;
    } else if (this.scene === 'results') {
      L.bass = 0.45;
      L.arp = 0.55;
      L.sparkle = 0.5;
      L.hat = 0.25;
    } else {
      // Intensity builds the arrangement (src/game/intensity.ts): the pad always; the bass from 0.26
      // (the run floor of 0.30 already has it under the pad; full at 0.40); hats from 0.30 (cruising
      // at 0.36 has them at a third); the arp from 0.58 and the kick from 0.60; clap and sparkle from
      // 0.80; the lead counter-melody from 0.85.
      const i = this.drive.intensity;
      L.bass = smoothstep(0.26, 0.4, i);
      L.hat = smoothstep(0.3, 0.45, i);
      L.arp = smoothstep(0.58, 0.72, i);
      L.kick = smoothstep(0.6, 0.74, i);
      L.clap = smoothstep(0.8, 0.9, i);
      L.sparkle = smoothstep(0.8, 0.92, i);
      L.lead = smoothstep(0.85, 0.95, i);
      L.tension = smoothstep(0.05, 0.6, this.drive.danger);
      L.choir = this.choirN > 0 ? 1 : 0;
    }
  }

  private applyLevels(now: number): void {
    // A snap (the band arriving on the reveal card's collapse) moves the faders in about 0.2 s.
    const tau = this.drive.snap ? 0.06 : 0.45;
    for (const l of LAYERS) {
      const target = MIX[l] * this.level[l];
      if (Math.abs(target - this.applied[l]) < 0.004) continue;
      this.applied[l] = target;
      this.fader[l].gain.setTargetAtTime(target, now, tau);
    }
  }

  /** Probe: each layer's presence (0..1) as last computed. */
  layerLevels(): Readonly<Record<Layer, number>> {
    return this.level;
  }

  /**
   * The ghost choir (run scene): n voices from now. A voice joining comes in on the chord already
   * sounding; a retake (a ghost passed you back) sighs the top voice down a fourth, and when the
   * choir is still full (more ghosts behind than voices) another voice takes its place.
   */
  setChoir(n: number, now: number, retaken: boolean): void {
    const want = this.scene === 'run' ? Math.max(0, Math.min(CHOIR_MAX, Math.round(n))) : 0;
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

  /** Probe: voices singing in the choir now. */
  get choirVoices(): number {
    return this.choirN;
  }

  /** Choir voice k on a chord: the 3rd low, the 5th above it, then the top extension. */
  private singNote(k: number, chord: Chord, root: number, t: number, dur: number, attack: number): void {
    const tones = chord.tones;
    // A triad has no extension: the third voice doubles the root an octave up instead.
    const pick = k === 0 ? tones[1] : k === 1 ? tones[2] : tones.length > 3 ? tones[tones.length - 1] : 12;
    const m = fit(root + (pick ?? 0), k === 0 ? 64 : k === 1 ? 67 : 71);
    const v = this.pool.voice(t, 1, this.fader.choir, null, 0);
    v.keep = true;
    const s = sing(v, t, mtof(m), dur, 0.2, attack, 0.2 + 0.3 * k);
    this.sung.push(s);
  }

  /** Probe: the bar of the deck's loop being scheduled, and the loop's length in bars. */
  position(): { bar: number; cycle: number } {
    return { bar: (this.step >> 4) % this.cycle, cycle: this.cycle };
  }

  /** The deck's 16th-note grid: step s sounds at t0 + s * dur (before swing). */
  grid(): { t0: number; dur: number } {
    return { t0: this.base - this.step * this.stepDur, dur: this.stepDur };
  }

  private chordAt(bar: number): Placed {
    const b = bar % this.cycle;
    let p = this.placed[0];
    for (const x of this.placed) if (x.start <= b) p = x;
    return p;
  }

  private play(step: number, t: number): void {
    const s16 = step & 15;
    const bar = step >> 4;
    const placed = this.chordAt(bar);
    const chord = placed.chord;
    const root = this.key.tonic + chord.root;
    const st = this.style;
    const L = this.level;
    const sd = this.stepDur;

    if (s16 === 0 && bar % this.cycle === placed.start) {
      this.arpCount = 0;
      if (step === 0) this.padChord(chord, root, t, chord.bars * 16 * sd);
      const dur = chord.bars * 16 * sd;
      this.choirChord = { chord, root, end: t + dur };
      this.sung = [];
      for (let k = 0; k < this.choirN; k++) this.singNote(k, chord, root, t, dur, 0.35);
    }
    if (s16 === 8) {
      // Build the next chord's pad half a bar early, so its oscillators do not pile onto the
      // downbeat with everything else.
      const next = this.chordAt(bar + 1);
      const tp = t + 8 * sd;
      if ((bar + 1) % this.cycle === next.start && tp < this.stopAt) {
        this.padChord(next.chord, this.key.tonic + next.chord.root, tp, next.chord.bars * 16 * sd);
      }
    }

    if (L.bass > AUDIBLE) {
      const off = this.scene === 'results' ? (s16 === 0 ? 0 : s16 === 8 ? 7 : null) : st.bass[s16];
      if (off !== null && off !== undefined) this.bassNote(fit(root, 36) + off, t);
    }

    const rate = this.scene === 'title' ? st.arp.rate * 2 : this.scene === 'results' ? Math.max(2, st.arp.rate) : st.arp.rate;
    if (L.arp > AUDIBLE && step % rate === 0) {
      const n = this.arpCount++;
      if (Math.random() <= st.arp.prob) {
        const notes = this.notesFor(chord, root);
        const m = notes[this.arpIndex(n, notes.length)];
        const vel = (n % 4 === 0 ? 1 : 0.78) * rand(0.9, 1);
        this.tone('arp', this.arpTimbre(), t, m, vel, rand(-0.35, 0.35));
        if (this.accent.shimmer && n % 4 === 0) this.tone('arp', 'glass', t, m + 12, vel * 0.3, rand(-0.6, 0.6), 0.7);
      }
    }

    const kv = st.kick[s16];
    if (L.kick > AUDIBLE && kv > 0) kick(this.pool.voice(t, 1, this.fader.kick, null, 0), t, kv, this.accent.sub ? 40 : 46);

    const hv = this.scene === 'results' ? ((s16 & 3) === 2 ? 0.5 : 0) : st.hat[s16];
    if (L.hat > AUDIBLE && hv > 0) hat(this.pool.voice(t, 1, this.fader.hat, null, 0), t, hv * rand(0.85, 1), hv >= 0.75);

    const cv = st.clap[s16];
    if (L.clap > AUDIBLE && cv > 0) clap(this.pool.voice(t, 1, this.fader.clap, null, 0, -0.1), t, cv);

    if (L.sparkle > AUDIBLE && Math.random() < st.sparkle.prob * this.accent.sparkleMul) {
      const idx = 10 + Math.floor(Math.random() * 5);
      this.tone('sparkle', st.sparkle.timbre, t, ladder(this.key, idx), rand(0.5, 1), rand(-0.8, 0.8), 0.8);
    }

    if (L.lead > AUDIBLE) {
      const s32 = step & 31;
      if (s32 === 0) this.makePhrase(step >> 5);
      for (const n of this.phrase) if (n.step === s32) this.leadNote(n, chord, root, t);
    }

    if (L.tension > AUDIBLE && (s16 & 1) === 0) {
      // Danger: a pulsing low root that opens up as the threat closes in.
      const m = fit(root, 38) + ((s16 & 2) === 2 ? 12 : 0);
      const v = this.pool.voice(t, 1, this.fader.tension, null, 0);
      pluck(v, t, mtof(m), (s16 & 3) === 0 ? 0.8 : 0.55, 0.09, 1.4 + this.drive.danger * 2.2, v.out, 0, false);
    }
  }

  /** Rebuilds pads the skipped steps should have built: the rest of the current chord (unless
   *  under a beat is left) and the next chord, if its build point half a bar early has passed. */
  private repad(now: number): void {
    const bar = this.step >> 4;
    const placed = this.chordAt(bar);
    const startStep = (bar - ((bar % this.cycle) - placed.start)) * 16;
    const endStep = startStep + placed.chord.bars * 16;
    const left = (endStep - this.step) * this.stepDur;
    if (this.padEnd <= now + 0.1 && left >= 4 * this.stepDur) {
      this.padChord(placed.chord, this.key.tonic + placed.chord.root, now + 0.02, left);
    }
    if (endStep - this.step < 8) {
      const tNext = this.base + left;
      if (this.padEnd < tNext + 0.1 && tNext < this.stopAt) {
        const next = this.chordAt(endStep >> 4);
        this.padChord(next.chord, this.key.tonic + next.chord.root, tNext, next.chord.bars * 16 * this.stepDur);
      }
    }
  }

  private padChord(chord: Chord, root: number, t: number, dur: number): void {
    this.padEnd = Math.max(this.padEnd, t + dur);
    const notes: number[] = [fit(root, 43)];
    for (const x of chord.tones) {
      if (x === 0) continue;
      // Extensions sit higher so the 9th never crowds the root.
      const m = fit(root + x, x >= 12 ? 62 : 55);
      if (!notes.includes(m)) notes.push(m);
    }
    const cut = this.style.pad.cutoff * this.accent.padCut * (this.scene === 'title' ? 0.85 : 1) * (1 - 0.25 * this.drive.danger);
    const v = this.pool.voice(t, 1, this.fader.pad, null, 0);
    v.keep = true;
    const p = this.style.pad;
    pad(v, t, notes.slice(0, 5).map(mtof), dur + 0.1, 0.9, cut, p.attack, p.detune, p.wobble);
  }

  private bassNote(m: number, t: number): void {
    const v = this.pool.voice(t, 1, this.fader.bass, null, 0);
    const f = mtof(m);
    pluck(v, t, f, 0.9, this.scene === 'results' ? 0.42 : 0.2, 2.2, v.out, 0, false);
    if (this.accent.sub) ping(v, t, f, 0.32, 0.22);
  }

  private notesFor(chord: Chord, root: number): number[] {
    if (this.arpChord === chord) return this.arpNotes;
    const lo = this.style.arp.oct > 0 ? 67 : 60;
    const pcs = new Set(chord.tones.map((x) => (root + x) % 12));
    const notes: number[] = [];
    for (let m = lo; m < lo + 19; m++) if (pcs.has(m % 12)) notes.push(m);
    this.arpChord = chord;
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

  private arpTimbre(): Timbre {
    const t = this.style.arp.timbre;
    return t === 'pluck' && this.accent.koto ? 'koto' : t;
  }

  private tone(layer: Layer, timbre: Timbre, t: number, m: number, vel: number, pan: number, len = 1): void {
    const v = this.pool.voice(t, 1, this.fader[layer], null, 0, pan);
    const f = mtof(m);
    // A long combo brightens the arp a little.
    const b = 1 + Math.min(this.drive.mult - 1, 9) * 0.06;
    switch (timbre) {
      case 'pluck':
        pluck(v, t, f, 0.8 * vel, 0.2 * len, 3 * this.accent.pluckBright * b, v.out, 0, false);
        break;
      case 'koto':
        pluck(v, t, f, 0.8 * vel, 0.26 * len, 4.2 * b, v.out, 0.03, false);
        break;
      case 'bell':
        fmBell(v, t, f, 0.5 * vel, 0.3 * len, 3.5, 1.1 * b);
        break;
      case 'box':
        fmBell(v, t, f, 0.48 * vel, 0.25 * len, 5, 0.7);
        break;
      case 'glass':
        fmBell(v, t, f, 0.42 * vel, 0.3 * len, 2.76, 0.9 * b);
        break;
      case 'mallet':
        mallet(v, t, f, 0.6 * vel, 0.25 * len);
        break;
    }
  }

  private makePhrase(block: number): void {
    if (block % 2 === 1 && this.phrase.length > 0) {
      // The answer keeps the rhythm and moves the ending, so the line sounds composed.
      const n = this.phrase.length;
      this.phrase = this.phrase.map((p, i) =>
        i >= n - 2 ? { ...p, idx: clampLead(p.idx + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))) } : p,
      );
      return;
    }
    const steps = [-2, -1, -1, 0, 1, 1, 2];
    const out: LeadNote[] = [];
    for (const [step, len] of LEAD_RHYTHM[this.style.lead]) {
      if (out.length > 0 && Math.random() < 0.15) continue;
      this.walk = clampLead(this.walk + steps[Math.floor(Math.random() * steps.length)]);
      out.push({ step, len, idx: this.walk });
    }
    this.phrase = out;
  }

  private leadNote(n: LeadNote, chord: Chord, root: number, t: number): void {
    let idx = n.idx;
    if (n.step % 8 === 0) {
      // Strong beats land on a chord tone.
      const pcs = new Set(chord.tones.map((x) => (root + x) % 12));
      for (const d of [0, 1, -1, 2, -2]) {
        if (pcs.has(ladder(this.key, n.idx + d) % 12)) {
          idx = n.idx + d;
          break;
        }
      }
    }
    const v = this.pool.voice(t, 1, this.fader.lead, null, 0, 0.1);
    lead(v, t, mtof(ladder(this.key, idx)), n.len * this.stepDur * 0.92, 0.8, this.style.lead);
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
  /** Probe: decks started (each after the first is a crossfade). */
  decksStarted = 0;
  private choir = 0;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly pool: VoicePool,
    private readonly bus: Bus,
  ) {}

  setTarget(scene: Scene, mood: Mood, biome: BiomeId): void {
    this.scene = scene;
    this.mood = mood;
    this.biome = biome;
  }

  /** snap: move the layer faders fast on the next scheduler pass (kept until that pass runs). */
  setDrive(intensity: number, danger: number, mult: number, snap = false): void {
    this.drive = { intensity, danger, mult, snap: snap || this.drive.snap === true };
  }

  /** Key of the arrangement that is playing (or about to): every reward sound uses it. */
  key(): Key {
    const top = this.decks[this.decks.length - 1];
    if (top) return top.key;
    const s = styleFor(this.mood);
    return { tonic: s.tonic, penta: s.penta, bright: s.bright, bpm: s.bpm };
  }

  /** The playing arrangement's 16th-note grid, so pulses (fuse ticks, the duel heartbeat, the km
   *  bell) land in time with the band. Null before the first deck exists. */
  grid(): { t0: number; dur: number } | null {
    const top = this.decks[this.decks.length - 1];
    return top ? top.grid() : null;
  }

  /** Probe: the playing deck's layer presence (0..1 each). */
  layerLevels(): Readonly<Record<string, number>> | null {
    const top = this.decks[this.decks.length - 1];
    return top ? top.layerLevels() : null;
  }

  /** The ghost choir's size (0..3): the top deck sings it; a retake sighs. */
  setChoir(n: number, now: number, retaken = false): void {
    this.choir = n;
    const top = this.decks[this.decks.length - 1];
    top?.setChoir(n, now, retaken);
  }

  /** Probe: voices singing in the choir. */
  choirVoices(): number {
    const top = this.decks[this.decks.length - 1];
    return top ? top.choirVoices : 0;
  }

  /** Probe: the playing deck's place in its loop. */
  position(): { bar: number; cycle: number } | null {
    const top = this.decks[this.decks.length - 1];
    return top ? top.position() : null;
  }

  tick(now: number, until: number): void {
    // Applied here rather than in setTarget, so a setScene + setMood pair in one frame makes a
    // single crossfade.
    const id = deckId(this.scene, this.mood, this.biome);
    const top = this.decks[this.decks.length - 1];
    if (!top || top.id !== id) {
      if (top) top.fadeOut(now, XFADE);
      const d = new Deck(this.ctx, this.pool, this.bus, this.scene, this.mood, this.biome, now + 0.05);
      d.fadeIn(now, top ? XFADE : 1.2);
      d.setChoir(this.choir, now, false);
      this.decks.push(d);
      this.decksStarted++;
      // Flipping mountains on the title screen can stack decks faster than they fade; keep three
      // and fade older ones out in 40 ms (disposing a deck mid-fade would click).
      let kept = 0;
      for (let i = this.decks.length - 1; i >= 0; i--) {
        const x = this.decks[i];
        if (!x.cutShort && ++kept > 3) x.cut(now);
      }
    }
    for (const d of this.decks) {
      d.setDrive(this.drive);
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
