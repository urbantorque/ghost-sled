import { CUT_PENALTY_S } from './form';

// The produced score's arrangement (round 7), pure, so the tests and the offline analysis run it in node.
// A piece ships as sections (so many bars, each a few layers of audio with its tail) and one-shots (the
// build into a drop, the hit on it, the stingers). StemForm decides what plays when: sections follow one
// another on bar lines in the order the course's stage gives; a set piece, a stage line or the finish
// lands a drop on the beat nearest the moment the rider gets there (the old section is cut there, under a
// build that ends on it and a hit); a wipeout or a set piece ridden out breaks down at the next four-bar
// line; the music can hold its breath (cut to its own tail) and crash back in on a landing, on a new
// downbeat; the finish lands the finale. It emits commands; stemdeck.ts plays them.

export type StemLayer = 'bed' | 'drive' | 'lead' | 'peak';
export const STEM_LAYERS: readonly StemLayer[] = ['bed', 'drive', 'lead', 'peak'];
export type StemRole = 'intro' | 'low' | 'high' | 'mid' | 'break' | 'climax' | 'climb' | 'finale' | 'results' | 'title';

export interface StemSection {
  role: StemRole;
  bars: number;
  /** The tonic's pitch class and the mode's scale (semitones), for the cues the live engine pitches in. */
  tonic: number;
  scale: readonly number[];
  layers: readonly StemLayer[];
  /** The harmony: [step it starts on, root pitch class, tones over the root]. */
  chords: ReadonlyArray<readonly [number, number, readonly number[]]>;
}

export interface StemPiece {
  name: string;
  bpm: number;
  /** Beats in a bar and grid steps in a beat. */
  beats: number;
  div: number;
  /** A trim that puts every course's reference run at the same loudness, dB. */
  gainDb: number;
  /** The hook's first bar: [semitones over the tonic, beat it starts on, beats long]. */
  head: ReadonlyArray<readonly [number, number, number]>;
  sections: Record<string, StemSection>;
  form: { open: string; stages: readonly (readonly string[])[]; breakdown: string; finale: string; results: string };
  /** One-shots: seconds of written content (a build ends there) and of audio in all. */
  shots: Record<string, { len: number; total: number }>;
}

export interface StemManifest {
  version: string;
  rate: number;
  /** The probe files: a click at this sample of so many. */
  probe: { click: number; frames: number };
  pieces: Record<string, StemPiece>;
  /** Bytes of every pack, by piece then by 'tier.format'. */
  bytes: Record<string, Record<string, number>>;
}

export type FormScene = 'run' | 'title' | 'results';
export type LandKind = 'drop' | 'lift' | 'finish';
const LAND_RANK: Record<LandKind, number> = { drop: 0, lift: 1, finish: 2 };

export type Cmd =
  /** Start a section's layers at t, `offset` seconds into it. */
  | { op: 'play'; id: string; t: number; offset: number; token: number }
  /** Fade a playing section out, ending at t. */
  | { op: 'cut'; token: number; t: number; fade: number }
  /** Start a one-shot at t, `offset` seconds into it; `key` names it for stopShot. */
  | { op: 'shot'; id: string; t: number; offset: number; key: string }
  | { op: 'stopShot'; key: string; t: number; fade: number }
  /** The drive layer steps out from t until `until` (the kick out before a drop). */
  | { op: 'gate'; t: number; until: number };

/** A landing is fixed this long before it sounds (s): later than this the build cannot be moved cleanly. */
export const LOCK_S = 0.5;
/** A landing is planned at least this far ahead (s). */
export const LAND_LEAD_S = 0.25;
/** A landing is not followed by another within this long (s), the finish apart. */
export const RELAND_S = 2;
/** Fades: a section cut by a drop, by a breakdown, and by the breath before a leap (s). */
export const CUT_FADE_S = 0.05;
export const BREAK_FADE_S = 0.09;
export const BREATH_FADE_S = 0.14;
/** The breath's silence lasts at most this long (s): past it the breakdown plays until the landing. */
export const BREATH_MAX_S = 4.2;
/** After a breath that ran out, the landing's crash back in is waited for this long (s). */
export const AWAIT_MAX_S = 6;

const isHigh = (r: StemRole): boolean => r === 'high' || r === 'climax';

interface Playing {
  id: string;
  t0: number;
  /** Bars into the section its audio started. */
  from: number;
  token: number;
}

export class StemForm {
  /** The stage the rider is in (the deck sets it each frame). */
  stage = 0;
  landings = 0;
  landedAt = -Infinity;
  /** The finale has started: nothing follows it. */
  done = false;
  /** Seconds of AudioContext time a bar and a beat last (the mood's rate folded in). */
  readonly barS: number;
  readonly beatS: number;
  private cur: Playing | null = null;
  private token = 0;
  private fi = 0;
  private flowStage = 0;
  private lifted = false;
  private land: { t: number; kind: LandKind } | null = null;
  private buildFor = Number.NaN;
  private breakAt = Number.NaN;
  private silentSince = Number.NaN;
  /** The breath ran out with the sled still in the air: the landing is still owed its crash. */
  private awaitSince = Number.NaN;
  private pending: Cmd[] = [];
  private hold: string | null = null;
  private jumpAt = Number.NaN;

  constructor(
    readonly piece: StemPiece,
    readonly scene: FormScene,
    private readonly start: number,
    private readonly rate = 1,
  ) {
    this.beatS = 60 / piece.bpm / rate;
    this.barS = this.beatS * piece.beats;
  }

  private sec(id: string): StemSection {
    return this.piece.sections[id];
  }

  private get lastStage(): number {
    return this.piece.form.stages.length - 1;
  }

  private flow(stage: number): readonly string[] {
    const st = this.piece.form.stages;
    return st[Math.max(0, Math.min(st.length - 1, stage))];
  }

  /** The section a drop lands in a stage: the first chorus of its flow. */
  dropTarget(stage: number): string {
    const f = this.flow(stage);
    return f.find((id) => isHigh(this.sec(id).role)) ?? f[0];
  }

  private endOf(p: Playing): number {
    return p.t0 + (this.sec(p.id).bars - p.from) * this.barS;
  }

  private begin(id: string, t: number, from: number, out: Cmd[]): void {
    this.cur = { id, t0: t, from, token: ++this.token };
    out.push({ op: 'play', id, t, offset: from * this.barS, token: this.token });
    if (this.sec(id).role === 'finale') this.done = true;
  }

  /** Seconds the finale's written bars last. */
  get finaleS(): number {
    return this.sec(this.piece.form.finale).bars * this.barS;
  }

  /** The jukebox: hold a section (it follows itself), starting it at the next bar line; null lets the
   *  form go on. */
  jump(id: string | null, now: number): void {
    const to = id && this.piece.sections[id] ? id : null;
    if (to === this.hold) return;
    this.hold = to;
    if (!to || !this.cur) return;
    const t0 = this.cur.t0 - this.cur.from * this.barS;
    this.jumpAt = t0 + Math.ceil((now + 0.1 - t0) / this.barS) * this.barS;
    this.done = false;
  }

  /** What follows the section playing when nothing claims its end. */
  private follow(): string {
    const f = this.piece.form;
    if (this.hold) return this.hold;
    if (this.scene === 'results') return f.results;
    if (this.scene === 'title') {
      const flow = this.flow(0);
      return flow[this.fi++ % flow.length];
    }
    if (this.stage !== this.flowStage) {
      this.flowStage = this.stage;
      this.fi = 0;
      if (this.stage >= this.lastStage) this.lifted = true;
    }
    const flow = this.flow(this.flowStage);
    return flow[this.fi++ % flow.length];
  }

  /**
   * Everything that starts before `until`: section changes on bar lines, a landing on its beat, a breakdown
   * on its four-bar line. `ready(id)`: the section's audio is decoded; one that is not is passed over for
   * the section playing (again), so the music never waits on a decode.
   */
  advance(until: number, ready: (id: string) => boolean = () => true): Cmd[] {
    const out = this.pending;
    this.pending = [];
    if (!this.cur) {
      const f = this.piece.form;
      const open = this.scene === 'results' ? f.results : f.open;
      if (this.start >= until) return out;
      this.begin(open, this.start, 0, out);
    }
    if (!Number.isNaN(this.silentSince)) {
      // Holding its breath: nothing plays until crashIn, or until the breath has gone on too long.
      if (until - this.silentSince < BREATH_MAX_S) return out;
      // A flight longer than a breath (Frostfang's tallest drop is over six seconds in the air): the
      // breakdown comes in under the rest of it, and the landing still crashes back in.
      const bd = this.piece.form.breakdown;
      if (ready(bd)) {
        this.silentSince = Number.NaN;
        this.awaitSince = until;
        this.begin(bd, until, 0, out);
      } else this.resume(until, false, out);
    }
    if (until - this.awaitSince > AWAIT_MAX_S) this.awaitSince = Number.NaN;
    for (let guard = 0; guard < 64; guard++) {
      const cur = this.cur as Playing;
      const end = this.endOf(cur);
      const landT = this.land ? this.land.t : Infinity;
      const brT = Number.isNaN(this.breakAt) ? Infinity : this.breakAt;
      const jT = Number.isNaN(this.jumpAt) ? Infinity : this.jumpAt;
      const next = Math.min(landT, brT, jT, this.done ? Infinity : end);
      if (!(next < until)) break;
      // (A landing, a jump or a breakdown that falls on the section's own end takes it: never both.)
      if (landT - next < 1e-6 && this.land) this.doLand(this.land.t, this.land.kind, ready, out);
      else if (jT - next < 1e-6) {
        this.jumpAt = Number.NaN;
        if (this.hold && ready(this.hold)) {
          out.push({ op: 'cut', token: cur.token, t: next, fade: CUT_FADE_S });
          this.begin(this.hold, next, 0, out);
        }
      } else if (brT - next < 1e-6) {
        this.breakAt = Number.NaN;
        const bd = this.piece.form.breakdown;
        if (ready(bd) && this.sec(cur.id).role !== 'break') {
          out.push({ op: 'cut', token: cur.token, t: brT, fade: BREAK_FADE_S });
          this.begin(bd, brT, 0, out);
        }
      } else {
        let id = this.follow();
        if (!ready(id)) id = cur.id;
        this.begin(id, end, 0, out);
      }
    }
    return out;
  }

  private doLand(t: number, kind: LandKind, ready: (id: string) => boolean, out: Cmd[]): void {
    const cur = this.cur as Playing;
    const f = this.piece.form;
    let id = kind === 'finish' ? f.finale : kind === 'lift' ? this.dropTarget(this.lastStage) : this.dropTarget(this.stage >= this.lastStage && this.lifted ? this.lastStage : this.stage);
    if (kind === 'lift') {
      this.lifted = true;
      this.flowStage = this.lastStage;
    }
    this.land = null;
    this.buildFor = Number.NaN;
    this.breakAt = Number.NaN;
    this.landings++;
    this.landedAt = t;
    if (!ready(id)) {
      // Not decoded in time: the hit lands on what is playing.
      if (kind !== 'finish') out.push({ op: 'shot', id: 'hit', t, offset: 0, key: 'hit' });
      return;
    }
    // A drop into the chorus still in its first phrase goes on to its second instead of starting it again.
    const sec = this.sec(id);
    const bar = cur.from + (t - cur.t0) / this.barS;
    const second = kind === 'drop' && cur.id === id && bar < 4 && sec.bars >= 8;
    out.push({ op: 'cut', token: cur.token, t, fade: CUT_FADE_S });
    this.begin(id, t, second ? 4 : 0, out);
    if (kind !== 'finish') out.push({ op: 'shot', id: 'hit', t, offset: 0, key: 'hit' });
    // The flow goes on from the section after the one the drop landed in.
    if (kind !== 'finish') {
      const flow = this.flow(this.flowStage);
      const ix = flow.indexOf(id);
      this.fi = ix >= 0 ? ix + 1 : 0;
    }
  }

  /**
   * Plans a landing near `target`: the beat nearest it (a bar line wins a near tie), at least LAND_LEAD_S
   * ahead. A landing already planned is kept once it is LOCK_S away or when the new target is no nearer
   * another beat; a bigger kind takes it over. The build is started (or moved) to end on it, and the drive
   * layer steps out for its last two beats. Returns the landing's time, or null where nothing lands.
   */
  plan(target: number, kind: LandKind, now: number): number | null {
    if (this.scene !== 'run' || this.done || !this.cur || !Number.isNaN(this.silentSince)) return null;
    // One landmark is one landing: a rider who reaches the line a moment after its beat does not land it twice.
    if (kind !== 'finish' && target - this.landedAt < RELAND_S) return null;
    const cur = this.land;
    if (cur && cur.t - now < LOCK_S) {
      if (LAND_RANK[kind] > LAND_RANK[cur.kind]) cur.kind = kind;
      return cur.t;
    }
    const t0 = this.cur.t0 - this.cur.from * this.barS;
    const from = now + LAND_LEAD_S;
    let best = Number.NaN;
    let bestCost = Infinity;
    const k0 = Math.ceil((from - t0) / this.beatS - 1e-9);
    for (let k = k0; k < k0 + 64; k++) {
      const t = t0 + k * this.beatS;
      if (t > target + 2.5) break;
      const onBar = ((k % this.piece.beats) + this.piece.beats) % this.piece.beats === 0;
      const cost = Math.abs(t - target) + (onBar ? 0 : CUT_PENALTY_S);
      if (cost < bestCost) {
        bestCost = cost;
        best = t;
      }
    }
    if (Number.isNaN(best)) return cur ? cur.t : null;
    const k = cur && LAND_RANK[cur.kind] > LAND_RANK[kind] ? cur.kind : kind;
    this.land = { t: best, kind: k };
    if (!(Math.abs(best - this.buildFor) < 1e-4)) {
      const b = this.piece.shots.build;
      if (b) {
        if (!Number.isNaN(this.buildFor)) this.pending.push({ op: 'stopShot', key: 'build', t: now, fade: 0.04 });
        // (Offsets are in the clock's seconds: a mood that plays the stems faster shortens the build.)
        const len = b.len / this.rate;
        const at = Math.max(now + 0.01, best - len);
        this.pending.push({ op: 'shot', id: 'build', t: at, offset: Math.max(0, len - (best - at)), key: 'build' });
      }
      this.pending.push({ op: 'gate', t: Math.max(now, best - 2 * this.beatS), until: best });
      this.buildFor = best;
    }
    return best;
  }

  get landing(): { t: number; kind: LandKind } | null {
    return this.land;
  }

  /** A set piece ridden out or a wipeout: the breakdown, at the next four-bar line of the section playing
   *  (unless a drop is about to land, or the section is the finale or a breakdown already). */
  breakdown(now: number): void {
    const cur = this.cur;
    if (this.scene !== 'run' || this.done || !cur || !Number.isNaN(this.silentSince)) return;
    if (this.sec(cur.id).role === 'break') return;
    if (this.land && this.land.t - now < 6 * this.barS) return;
    const phrase = 4 * this.barS;
    const t0 = cur.t0 - cur.from * this.barS;
    this.breakAt = t0 + Math.ceil((now + 0.1 - t0) / phrase) * phrase;
  }

  /** The music holds its breath (the lip of the mountain's biggest leap): everything cut to its own tail. */
  breath(now: number): Cmd[] {
    const cur = this.cur;
    if (this.scene !== 'run' || this.done || !cur || !Number.isNaN(this.silentSince)) return [];
    const out: Cmd[] = [{ op: 'cut', token: cur.token, t: now + BREATH_FADE_S, fade: BREATH_FADE_S }];
    if (!Number.isNaN(this.buildFor)) out.push({ op: 'stopShot', key: 'build', t: now, fade: 0.05 });
    this.land = null;
    this.buildFor = Number.NaN;
    this.breakAt = Number.NaN;
    this.silentSince = now;
    return out;
  }

  get holding(): boolean {
    return !Number.isNaN(this.silentSince) || !Number.isNaN(this.awaitSince);
  }

  /** The section sounding, for a deck that has to start it part way through (the music slider back up
   *  from zero): its id, when its bar `from` started, and its token. */
  get sounding(): { id: string; t0: number; from: number; token: number } | null {
    return this.cur && Number.isNaN(this.silentSince) ? this.cur : null;
  }

  /** The landing: the stage's chorus from its top, on a new downbeat that is this instant, under the hit. */
  crashIn(now: number, hit = true): Cmd[] {
    const out: Cmd[] = [];
    if (Number.isNaN(this.silentSince)) {
      if (Number.isNaN(this.awaitSince) || !this.cur || this.done) return [];
      this.awaitSince = Number.NaN;
      if (!hit) return [];
      out.push({ op: 'cut', token: this.cur.token, t: now, fade: CUT_FADE_S });
    }
    this.resume(now, hit, out);
    return out;
  }

  private resume(t: number, hit: boolean, out: Cmd[]): void {
    this.silentSince = Number.NaN;
    if (this.stage >= this.lastStage) {
      this.lifted = true;
      this.flowStage = this.lastStage;
    } else this.flowStage = this.stage;
    const id = this.dropTarget(this.flowStage);
    this.begin(id, t, 0, out);
    const flow = this.flow(this.flowStage);
    this.fi = flow.indexOf(id) + 1;
    if (hit) {
      out.push({ op: 'shot', id: 'hit', t, offset: 0, key: 'hit' });
      this.landings++;
      this.landedAt = t;
    }
  }

  /** The section playing at t and the bar within it. */
  position(t: number): { id: string; bar: number; bars: number; role: StemRole } | null {
    const cur = this.cur;
    if (!cur) return null;
    const s = this.sec(cur.id);
    return { id: cur.id, bar: Math.max(0, Math.min(s.bars - 1, Math.floor(cur.from + (t - cur.t0) / this.barS + 1e-6))), bars: s.bars, role: s.role };
  }

  /** The grid the live cues sit on: a beat is four of its steps, in any metre. */
  grid(): { t0: number; dur: number } {
    const cur = this.cur;
    return { t0: cur ? cur.t0 : this.start, dur: this.beatS / 4 };
  }

  /** The key and the chord at t: the tonic's pitch class, the scale, the chord's root (a pitch class) and tones. */
  harmony(t: number): { tonic: number; scale: readonly number[]; root: number; tones: readonly number[] } {
    const cur = this.cur;
    const id = cur ? cur.id : this.scene === 'results' ? this.piece.form.results : this.piece.form.open;
    const s = this.sec(id);
    const step = cur ? (cur.from + (t - cur.t0) / this.barS) * this.piece.beats * this.piece.div : 0;
    let c = s.chords[0];
    for (const x of s.chords) if (x[0] <= step + 1e-6) c = x;
    return { tonic: s.tonic, scale: s.scale, root: c ? c[1] : s.tonic, tones: c ? c[2] : [0, 7] };
  }

  /** The sections worth having decoded: the one playing, the next in the flow, where a drop would land, the
   *  breakdown, and from the stage before the last, the climax and the finale. */
  upcoming(): string[] {
    const f = this.piece.form;
    const out = new Set<string>();
    if (this.cur) out.add(this.cur.id);
    if (this.scene === 'results') out.add(f.results);
    else if (this.scene === 'title') {
      out.add(f.open);
      const flow = this.flow(0);
      out.add(flow[this.fi % flow.length]);
    } else {
      const st = this.stage !== this.flowStage ? this.stage : this.flowStage;
      const flow = this.flow(st);
      out.add(flow[(this.stage !== this.flowStage ? 0 : this.fi) % flow.length]);
      out.add(this.dropTarget(st));
      out.add(f.breakdown);
      if (this.stage >= this.lastStage - 1) out.add(this.dropTarget(this.lastStage));
      if (this.stage >= this.lastStage) out.add(f.finale);
      if (!this.cur) out.add(f.open);
      if (this.hold) out.add(this.hold);
    }
    return [...out];
  }
}

/** Which layers the race has brought in. */
export interface Gates {
  drive: boolean;
  lead: boolean;
  peak: boolean;
}

export const GATES_OFF: Gates = { drive: false, lead: false, peak: false };

/** What the engine knows of the race that the layers follow. */
export interface RaceState {
  /** The drive, 0..1 (the game's intensity with the engine's groove, accents and the descent's lift). */
  drive: number;
  stage: number;
  /** A stomp streak or 'In the flow' opening the band up, 0..1. */
  open: number;
  /** The last stage's climb to the line, 0..1. */
  climax: number;
}

/**
 * The layers for the next bar, with hysteresis so none flaps: the bed always; the drive layer (drums and
 * bass) once the run is under way; the lead in every chorus, and in the verses from the second stage or
 * when the rider is riding well; the peak layer when a stomp streak or the flow opens the band up, at a
 * high drive, and on the climb to the line. On the title and the results everything plays.
 */
export function gatesFor(prev: Gates, role: StemRole, scene: FormScene, r: RaceState): Gates {
  if (scene !== 'run') return { drive: true, lead: true, peak: true };
  const d = r.drive;
  const drive = role === 'finale' || isHigh(role) || role === 'climb' ? d >= 0.1 : prev.drive ? d >= 0.22 : d >= 0.28;
  const always = isHigh(role) || role === 'finale' || role === 'break' || role === 'intro';
  const lead = always || r.stage >= 1 || r.open >= 0.4 || (prev.lead ? d >= 0.4 : d >= 0.45);
  const top = role === 'climax' || role === 'climb';
  const peak = role === 'finale' || (prev.peak ? r.open >= 0.35 || d >= 0.64 : r.open >= 0.5 || d >= 0.72) || (top && (r.climax >= 0.3 || d >= 0.58));
  return { drive, lead, peak };
}

/** A layer's gain from the gates (the lighter tiers ship 'base', the bed and drive mixed, and 'top', the
 *  lead and peak mixed). */
export function layerGain(layer: string, g: Gates): number {
  switch (layer) {
    case 'bed':
    case 'base':
      return 1;
    case 'drive':
      return g.drive ? 1 : 0;
    case 'lead':
    case 'top':
      return g.lead ? 1 : 0;
    case 'peak':
      return g.peak ? 1 : 0;
    default:
      return 1;
  }
}

/** The piece a mountain plays. A biome this file does not know (a mountain added later) plays none, and
 *  the live band plays as before. */
const PIECE_OF: Record<string, string> = { alpine: 'pinecrest', glacier: 'frostfang', volcanic: 'ember', blossom: 'sakura', lantern: 'lanternfall', lanternfall: 'lanternfall', summit: 'lanternfall' };

export function pieceFor(biome: string): string | null {
  return PIECE_OF[biome] ?? null;
}
