import { Mood } from '../sim/chaos';
import type { SectionName } from './form';
import type { Bus } from './graph';
import { Formants, Sung, fadeSung, formants, pluck, sigh, sing } from './instruments';
import type { Build, Drive, LandKind, Scene } from './music';
import { type Cmd, GATES_OFF, type Gates, type StemPiece, type StemRole, StemForm, gatesFor, layerGain } from './stemform';
import type { StemStore } from './stemstore';
import { type Key, MAJOR_PENTA, MINOR_PENTA, fit, mtof } from './theory';
import type { VoicePool } from './voices';

// A deck of the produced score (round 7): one piece's stems played by the arrangement in stemform.ts. It
// stands where a live deck stands in music.ts and answers the same questions (the key, the grid, the
// chord, a landing), so the cues the live engine pitches into the music sit in the produced score as they
// sat in the live band. What it costs the main thread is a few buffer sources a section and a gain
// change a bar: no notes are scheduled.

/** How far ahead of the clock section starts are scheduled (s). */
const AHEAD_S = 0.25;
/** The produced score's level on the music bus, after the glue (it is already mastered). Measured on replayed
 *  runs with the sliders at their defaults (scripts/playtest/loudness.js): at 1.15 the mix read -15.2 to -14.7
 *  LUFS and the music alone 1 to 2 LU over the effects alone; 1.5 dB down puts the mix at about -16 and the
 *  music level with the effects. */
export const PRODUCED_GAIN = 0.97;
/** A little of the stems goes to the game's own reverb, so a vista or a tunnel opens the music too. */
const SPACE_SEND = 0.06;
const CHOIR_MIX = 0.2;
const TENSION_MIX = 0.16;

/** What a mood does to a mountain's music: the stems a semitone or two up or down (pitch and pace
 *  together), a lowpass or a highpass, more room. The mountain's own style stays. */
interface Treat {
  semis: number;
  lp: number;
  hp: number;
  wet: number;
}

const PLAIN: Treat = { semis: 0, lp: 0, hp: 0, wet: 0 };
const TREAT: Partial<Record<Mood, Treat>> = {
  [Mood.Blizzard]: { semis: -1, lp: 5200, hp: 0, wet: 0.22 },
  [Mood.Lantern]: { semis: 0, lp: 7000, hp: 0, wet: 0.14 },
  [Mood.GlassIce]: { semis: 1, lp: 0, hp: 130, wet: 0.18 },
  [Mood.Comet]: { semis: 0, lp: 0, hp: 0, wet: 0.28 },
  [Mood.Haunted]: { semis: -2, lp: 3400, hp: 0, wet: 0.3 },
  [Mood.Powder]: { semis: 1, lp: 0, hp: 0, wet: 0 },
};

const ROLE_SECTION: Record<StemRole, SectionName> = { intro: 'intro', low: 'verse', mid: 'verse', climb: 'verse', high: 'chorus', climax: 'chorus', break: 'bridge', finale: 'finale', results: 'chorus', title: 'chorus' };

let DECKS = 0;

interface Live {
  srcs: AudioBufferSourceNode[];
  gains: GainNode[];
  end: number;
}

export class StemDeck {
  readonly produced = true;
  key: Key;
  retireAt = Infinity;
  cutShort = false;
  landings = 0;
  /** Debug-only fields the live deck has; unused here. */
  solo: string | null = null;
  /** Debug-only (the jukebox): a stage held, and a section of the piece by its own name. */
  force: { stage?: number; id?: string } | null = null;
  /** This deck's name in the store's claims. */
  private readonly owner = `deck${++DECKS}`;
  private readonly form: StemForm;
  private readonly rate: number;
  private readonly semis: number;
  private readonly out: GainNode;
  private readonly xf: GainNode;
  private readonly send: GainNode;
  private readonly liveOut: GainNode;
  private readonly liveSend: GainNode;
  private readonly chain: AudioNode[] = [];
  private readonly bus: Record<string, GainNode> = {};
  private readonly playing = new Map<number, Live>();
  private readonly shots = new Map<string, { src: AudioBufferSourceNode; g: GainNode }>();
  private gates: Gates = GATES_OFF;
  private applied: Gates | null = null;
  private gateUntil = -Infinity;
  private drive: Drive = { intensity: 0, danger: 0, mult: 1 };
  private build: Build = { stage: 0, climax: 0, open: 0 };
  private stopAt = Infinity;
  private muffled = false;
  private wasEnabled = true;
  private claimAt = 0;
  private liveOn = false;
  private readonly lp: BiquadFilterNode;
  private readonly lpOpen: number;
  /** The ghost choir (as on a live deck): the voices sung, their chord, their vowels. */
  private choirN = 0;
  private sung: Sung[] = [];
  private choirBar = -1;
  private readonly vowels: Formants[] = [];
  private tensionStep = -1;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly pool: VoicePool,
    bus: Bus,
    private readonly store: StemStore,
    readonly id: string,
    readonly pieceId: string,
    private readonly piece: StemPiece,
    readonly scene: Scene,
    mood: Mood,
    start: number,
  ) {
    const tr = scene === 'run' ? (TREAT[mood] ?? PLAIN) : PLAIN;
    this.semis = tr.semis;
    this.rate = Math.pow(2, tr.semis / 12);
    this.form = new StemForm(piece, scene, start, this.rate);
    this.xf = ctx.createGain();
    this.xf.gain.value = 0;
    this.xf.connect(bus.direct ?? bus.dry);
    this.send = ctx.createGain();
    this.send.gain.value = SPACE_SEND + tr.wet;
    this.xf.connect(this.send);
    this.send.connect(bus.wet);
    this.out = ctx.createGain();
    this.out.gain.value = PRODUCED_GAIN * Math.pow(10, piece.gainDb / 20);
    // One lowpass on the way out: wide open, closed by a mood, shut further by a wipeout.
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lpOpen = tr.lp > 0 ? tr.lp : 20000;
    this.lp.frequency.value = this.lpOpen;
    this.lp.Q.value = 0.5;
    let tail: AudioNode = this.lp;
    if (tr.hp > 0) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = tr.hp;
      this.lp.connect(hp);
      this.chain.push(hp);
      tail = hp;
    }
    this.out.connect(this.lp);
    tail.connect(this.xf);
    for (const l of ['bed', 'drive', 'lead', 'peak', 'base', 'top', 'shot']) {
      const g = ctx.createGain();
      g.gain.value = l === 'bed' || l === 'base' || l === 'shot' ? 1 : 0;
      g.connect(this.out);
      this.bus[l] = g;
    }
    // The live voices that ride on a produced deck (the ghost choir, the danger pulse) go the band's own way.
    this.liveOut = ctx.createGain();
    this.liveOut.gain.value = 0;
    this.liveOut.connect(bus.dry);
    this.liveSend = ctx.createGain();
    this.liveSend.gain.value = 0.6;
    this.liveOut.connect(this.liveSend);
    this.liveSend.connect(bus.wet);
    this.key = this.keyAt(start);
  }

  private keyAt(t: number): Key {
    const h = this.form.harmony(t);
    const minor = h.scale[2] === 3;
    return { tonic: 48 + ((h.tonic + this.semis + 120) % 12), penta: minor ? MINOR_PENTA : MAJOR_PENTA, bright: minor ? 3 : 0, bpm: Math.round(this.piece.bpm * this.rate) };
  }

  fadeIn(now: number, dur: number): void {
    for (const g of [this.xf, this.liveOut]) {
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + dur);
    }
  }

  fadeOut(now: number, dur: number): void {
    for (const g of [this.xf, this.liveOut]) {
      const p = g.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(0, now + dur);
    }
    this.stopAt = Math.min(this.stopAt, now + dur);
    this.retireAt = Math.min(this.retireAt, now + dur + 0.5);
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

  /** The live deck's key lift: the produced score's lift is written into its last stage, so there is none. */
  get lift(): number {
    return 0;
  }

  liftKey(n: number): void {
    void n;
  }

  /** Seconds the finale's written bars last (the results' reprise comes in as it ends). */
  get finaleS(): number {
    return this.form.finaleS;
  }

  /** The first beat of the piece at or after t. */
  nextBeat(t: number): number {
    const g = this.form.grid();
    const beat = g.dur * 4;
    return g.t0 + Math.ceil((t - g.t0) / beat - 1e-6) * beat;
  }

  plan(target: number, kind: LandKind, now: number): number | null {
    if (now >= this.stopAt) return null;
    return this.form.plan(target, kind, now);
  }

  get landing(): { t: number; kind: LandKind } | null {
    return this.form.landing;
  }

  get landedAt(): number {
    return this.form.landedAt;
  }

  breakdown(): void {
    this.form.breakdown(this.ctx.currentTime);
  }

  /** The breath before the mountain's biggest leap, and the crash back in on its landing. */
  breath(now: number): void {
    this.exec(this.form.breath(now), now);
  }

  crashIn(now: number, hit = true): void {
    const cmds = this.form.crashIn(now, hit);
    if (cmds.length === 0) return;
    this.gates = gatesFor(this.gates, 'high', this.scene, this.race());
    this.applyGates(now, 0.005);
    this.exec(cmds, now);
  }

  get holding(): boolean {
    return this.form.holding;
  }

  /** A wipeout: the music goes under water until the rider is up (and breaks down at the next phrase). */
  muffle(on: boolean, now: number): void {
    if (on === this.muffled) return;
    this.muffled = on;
    this.lp.frequency.setTargetAtTime(on ? 480 : this.lpOpen, now, on ? 0.06 : 0.35);
  }

  /** Asks for one-shots to be decoded ahead of their moment (a set piece's stingers as its card comes up). */
  prime(ids: readonly string[]): void {
    this.primed = ids.filter((id) => this.piece.shots[id]);
  }

  private primed: string[] = [];

  /** A set piece's stinger (`race`, `gates`, ..., `won`, `lost`) at t. False when it is not decoded: the
   *  live cue plays instead. A verb the score has no gesture for plays 'any'. */
  stinger(verb: string, t: number): boolean {
    const id = this.piece.shots[`st.${verb}`] ? `st.${verb}` : verb === 'won' || verb === 'lost' ? '' : 'st.any';
    if (!id || t >= this.stopAt) return false;
    return this.shot(id, t, 0, `st.${verb}`);
  }

  private shot(id: string, t: number, offset: number, key: string): boolean {
    const buf = this.store.buffer(this.pieceId, id);
    if (!buf) return false;
    const old = this.shots.get(key);
    if (old) this.fadeShot(old, Math.max(t, this.ctx.currentTime), 0.03);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = this.rate;
    const g = this.ctx.createGain();
    src.connect(g);
    g.connect(this.bus.shot);
    const a = this.store.align;
    src.start(t + Math.max(0, -a), Math.max(0, offset + Math.max(0, a)));
    const entry = { src, g };
    this.shots.set(key, entry);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
      if (this.shots.get(key) === entry) this.shots.delete(key);
    };
    return true;
  }

  private fadeShot(s: { src: AudioBufferSourceNode; g: GainNode }, t: number, fade: number): void {
    const p = s.g.gain;
    p.setValueAtTime(1, t);
    p.linearRampToValueAtTime(0, t + fade);
    try {
      s.src.stop(t + fade + 0.02);
    } catch {
      // Already stopped.
    }
  }

  private race(): { drive: number; stage: number; open: number; climax: number } {
    return { drive: this.drive.intensity, stage: this.force?.stage ?? this.build.stage, open: this.build.open, climax: this.build.climax };
  }

  private exec(cmds: readonly Cmd[], now: number): void {
    for (const c of cmds) {
      switch (c.op) {
        case 'play': {
          const live: Live = { srcs: [], gains: [], end: Infinity };
          const a = this.store.align;
          for (const l of this.store.layersOf(this.pieceId, c.id)) {
            const buf = this.store.buffer(this.pieceId, `${c.id}.${l}`);
            const dest = this.bus[l];
            if (!buf || !dest) continue;
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            src.playbackRate.value = this.rate;
            const g = this.ctx.createGain();
            src.connect(g);
            g.connect(dest);
            const t = Math.max(c.t, now);
            // (Late by a stalled timer: start inside the buffer, on the grid.)
            src.start(t + Math.max(0, -a), Math.max(0, c.offset * this.rate + (t - c.t) * this.rate + Math.max(0, a)));
            live.srcs.push(src);
            live.gains.push(g);
            src.onended = () => {
              src.disconnect();
              g.disconnect();
            };
          }
          this.playing.set(c.token, live);
          // Finished sections leave the map (their sources unplug themselves).
          for (const k of [...this.playing.keys()]) if (k < c.token - 3) this.playing.delete(k);
          this.key = this.keyAt(c.t + 0.01);
          break;
        }
        case 'cut': {
          const live = this.playing.get(c.token);
          if (!live) break;
          const t = Math.max(c.t, now + 0.005);
          for (const g of live.gains) {
            g.gain.setValueAtTime(1, Math.max(now, t - c.fade));
            g.gain.linearRampToValueAtTime(0, t);
          }
          for (const s of live.srcs) {
            try {
              s.stop(t + 0.02);
            } catch {
              // Already stopped.
            }
          }
          break;
        }
        case 'shot':
          this.shot(c.id, Math.max(c.t, now), c.offset * this.rate, c.key);
          break;
        case 'stopShot': {
          const s = this.shots.get(c.key);
          if (s) this.fadeShot(s, Math.max(c.t, now), c.fade);
          break;
        }
        case 'gate': {
          // The drums and bass out for the last two beats before a drop; back on it.
          this.gateUntil = c.until;
          for (const l of ['drive']) {
            const p = this.bus[l].gain;
            p.cancelScheduledValues(Math.max(now, c.t));
            p.setTargetAtTime(0, Math.max(now, c.t), 0.02);
            p.setTargetAtTime(1, c.until, 0.004);
          }
          break;
        }
      }
    }
  }

  private applyGates(at: number, tau: number): void {
    const g = this.gates;
    const prev = this.applied;
    this.applied = g;
    for (const l of ['drive', 'lead', 'peak', 'top']) {
      const v = layerGain(l, g);
      if (prev && layerGain(l, prev) === v) continue;
      if (l === 'drive' && at < this.gateUntil) continue;
      this.bus[l].gain.setTargetAtTime(v, at, tau);
    }
  }

  schedule(until: number, now: number, enabled: boolean): void {
    void until;
    if (now >= this.stopAt) return;
    const form = this.form;
    form.stage = this.force?.stage ?? this.build.stage;
    if (this.scene === 'run') form.jump(this.force?.id ?? null, now);
    // What to have decoded changes a few times a run: asked of the store four times a second, not every pass.
    if (now >= this.claimAt) {
      this.claimAt = now + 0.25;
      this.store.claim(this.owner, this.pieceId, form.upcoming(), this.scene === 'run' ? ['hit', 'build', ...this.primed] : []);
    }
    const cmds = form.advance(now + AHEAD_S, (id) => this.store.sectionReady(this.pieceId, id));
    this.landings = form.landings;
    // The layers: worked out every pass, changed on the next bar line (at once on a snap or a new section).
    const pos = form.position(now + AHEAD_S);
    if (pos) {
      const next = gatesFor(this.gates, pos.role, this.scene, this.race());
      const changed = next.drive !== this.gates.drive || next.lead !== this.gates.lead || next.peak !== this.gates.peak;
      const started = cmds.some((c) => c.op === 'play');
      if (changed || started || !this.applied) {
        this.gates = next;
        const g = form.grid();
        const bar = form.barS;
        const at = this.drive.snap || started || !this.applied ? (started ? (cmds.find((c) => c.op === 'play') as { t: number }).t : now) : g.t0 + Math.ceil((now - g.t0) / bar) * bar;
        this.applyGates(Math.max(now, at), this.drive.snap || started ? 0.01 : 0.04);
      }
    }
    if (enabled) {
      // The slider back up from zero: the section that has been going on unheard starts where it is.
      const cur = form.sounding;
      if (!this.wasEnabled && cur && !cmds.some((c) => c.op === 'play' && c.token === cur.token)) this.exec([{ op: 'play', id: cur.id, t: cur.t0, offset: cur.from * form.barS, token: cur.token }], now);
      this.exec(cmds, now);
    }
    this.wasEnabled = enabled;
    if (this.scene === 'run' && enabled) this.riders(now);
  }

  // ---------------------------------------------------------------- what the live engine asks a deck

  grid(): { t0: number; dur: number } {
    return this.form.grid();
  }

  chordNow(): { root: number; tones: readonly number[] } {
    const h = this.form.harmony(this.ctx.currentTime);
    return { root: this.key.tonic + ((h.root + this.semis - (this.key.tonic % 12) + 120) % 12), tones: h.tones };
  }

  position(): { bar: number; cycle: number; section: SectionName } {
    const p = this.form.position(this.ctx.currentTime);
    return p ? { bar: p.bar, cycle: p.bars, section: ROLE_SECTION[p.role] } : { bar: 0, cycle: 1, section: 'intro' };
  }

  /** The section playing, by its own name (the jukebox and the probes). */
  sectionId(): string {
    return this.form.position(this.ctx.currentTime)?.id ?? '';
  }

  /** The hook's first bar in the key playing, `lift` semitones up: [pitch, seconds in, seconds long]. */
  headPitches(lift: number): { m: number; at: number; dur: number }[] {
    const base = fit(this.key.tonic, 60) + lift;
    return this.piece.head.map(([p, at, len]) => ({ m: base + p, at: at * this.form.beatS, dur: len * this.form.beatS }));
  }

  layerLevels(): Readonly<Record<string, number>> {
    const g = this.gates;
    return { pad: 1, bass: g.drive ? 1 : 0, kick: g.drive ? 1 : 0, hat: g.drive ? 1 : 0, lead: g.lead ? 1 : 0, sparkle: g.peak ? 1 : 0, choir: this.choirN > 0 ? 1 : 0, tension: this.drive.danger > 0.05 ? 1 : 0 };
  }

  // ---------------------------------------------------------------- the live voices on a produced deck

  setChoir(n: number, now: number, retaken: boolean): void {
    const want = this.scene === 'run' ? Math.max(0, Math.min(3, Math.round(n))) : 0;
    if (retaken && want >= this.choirN && this.sung.length > 0) {
      const s = this.sung.pop();
      if (s) sigh(s, now);
      this.choirN = this.sung.length;
    }
    if (want < this.choirN) {
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

  /** The ghost choir and the danger pulse, sung and plucked on the produced score's chords and grid. */
  private riders(now: number): void {
    const pos = this.form.position(now + 0.1);
    if (!pos || this.form.holding) return;
    if (this.choirN === 0 && this.drive.danger <= 0.05 && !this.liveOn) return;
    const g = this.form.grid();
    const bar = this.form.barS;
    const k = Math.floor((now + 0.1 - g.t0) / bar);
    const want = this.choirN > 0 || this.drive.danger > 0.05;
    if (want !== this.liveOn) {
      this.liveOn = want;
      this.liveOut.gain.setTargetAtTime(want ? 1 : 0, now, 0.3);
    }
    if (this.choirN > 0 && (k !== this.choirBar || this.sung.length < this.choirN)) {
      const fresh = k !== this.choirBar;
      this.choirBar = k;
      const t = fresh ? Math.max(now + 0.02, g.t0 + k * bar) : now + 0.05;
      const end = g.t0 + (k + 1) * bar;
      const h = this.form.harmony(t + 0.01);
      const root = this.key.tonic + ((h.root + this.semis - (this.key.tonic % 12) + 120) % 12);
      if (fresh) this.sung = [];
      for (let v = this.sung.length; v < this.choirN; v++) {
        const pick = v === 0 ? h.tones[1] : v === 1 ? (h.tones[2] ?? 7) : h.tones.length > 3 ? h.tones[h.tones.length - 1] : 12;
        const m = fit(root + (pick ?? 0), v === 0 ? 64 : v === 1 ? 67 : 71);
        const bright = 0.2 + 0.3 * v;
        const vowel = (this.vowels[v] ??= formants(this.ctx, bright, this.liveOut));
        const voice = this.pool.voice(t, 1, vowel.input, null, 0);
        voice.keep = true;
        this.sung.push(sing(voice, t, mtof(m), Math.max(0.3, end - t), CHOIR_MIX * 0.2, 0.35, bright));
      }
    }
    // Danger: a low root plucked on the eighths, as the live band's tension layer.
    if (this.drive.danger > 0.05) {
      const step = Math.floor((now + 0.1 - g.t0) / (g.dur * 2));
      if (step !== this.tensionStep) {
        this.tensionStep = step;
        const t = Math.max(now + 0.01, g.t0 + step * g.dur * 2);
        const h = this.form.harmony(t);
        const m = fit(48 + ((h.root + this.semis + 120) % 12), 38) + (step & 1 ? 12 : 0);
        const v = this.pool.voice(t, 1, this.liveOut, null, 0);
        pluck(v, t, mtof(m), TENSION_MIX * (step & 1 ? 0.55 : 0.8) * Math.min(1, this.drive.danger * 2), 0.09, 1.4 + this.drive.danger * 2.2, null, 0, false);
      }
    }
  }

  dispose(): void {
    this.store.release(this.owner);
    for (const live of this.playing.values()) {
      for (const s of live.srcs) {
        try {
          s.stop();
        } catch {
          // Not started, or already stopped.
        }
        s.disconnect();
      }
      for (const g of live.gains) g.disconnect();
    }
    this.playing.clear();
    for (const s of this.shots.values()) {
      try {
        s.src.stop();
      } catch {
        // Already stopped.
      }
      s.src.disconnect();
      s.g.disconnect();
    }
    this.shots.clear();
    for (const f of this.vowels) for (const n of f.nodes) n.disconnect();
    for (const g of Object.values(this.bus)) g.disconnect();
    for (const n of this.chain) n.disconnect();
    this.out.disconnect();
    this.lp.disconnect();
    this.send.disconnect();
    this.xf.disconnect();
    this.liveSend.disconnect();
    this.liveOut.disconnect();
  }
}
