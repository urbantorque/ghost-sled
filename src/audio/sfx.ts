import type { Beat, BeatOf } from '../game/beats';
import { ChaosEvent } from '../sim/chaos';
import type { StyleKind } from '../sim/scoring';
import type { CrashCause, LandQuality, SimEvent, TakeoffKind } from '../sim/sim';
import type { UiSound } from './engine';
import type { Bus } from './graph';
import { crumble, fmBell, mallet, ping, pluck, puff, thump, whoosh } from './instruments';
import { BRIGHT_ARP, BRIGHT_VOICING, Key, brightRoot, fit, ladder, ladderIndexOf, mtof } from './theory';
import { Voice, VoicePool, bandComp, clamp, perc, rand, swell } from './voices';

// One-shot sound effects for sim events, the run's named moments (beats) and UI. Every tonal reward
// is drawn from the current key's pentatonic ladder (see theory.ts), so rewards harmonise with
// whatever the soundtrack plays.
//
// Beats and raw sim events meet here. The engine hands over a frame's beats BEFORE its raw events,
// so the beats leave context for the raw sounds (the stomp streak for the perfect-landing chord, a
// near miss's side and grade, which banks the beat already voiced); sounds only a beat can name
// (pass words, chimes, stings) play straight from the beat.

/** Style notes are spaced this far apart when several land on one tick, so they arpeggiate. */
const STYLE_GAP = 0.06;
/** Parts of a sound starting further ahead than this are built by a later scheduler pass, so a
 *  big reward spreads its node creation over several frames instead of hitching one. */
const DEFER = 0.08;
/** Sounds on a timeline the picture keeps (the reveal, the results card, a big bank's drop and
 *  slam) are built this far ahead instead: the scheduler runs on a 25 ms main-thread timer, and a
 *  busy frame can stall it for 150 ms or more, which would play a part built at DEFER late. */
const TIMELINE_LEAD = 0.25;
/** A bank's roll (tiers 1 to 3), in step with the HUD (cash-in): the 'xN' chip slams on for CHIP_S,
 *  then the figure rolls for `dur` with `n` ticks climbing ladder steps lo..hi. */
const CHIP_S = 0.12;
const ROLL: readonly { dur: number; n: number; lo: number; hi: number }[] = [
  { dur: 0, n: 0, lo: 0, hi: 0 },
  { dur: 0.35, n: 6, lo: 4, hi: 9 },
  { dur: 0.6, n: 10, lo: 3, hi: 12 },
  { dur: 0.9, n: 14, lo: 2, hi: 15 },
];
/** The drop: the band cuts out this long before a big bank's slam. */
export const DROP_S = 0.22;
/** The avalanche escape: the band drops out this long, then the fanfare and the slam land. */
export const ESCAPE_DROP_S = 0.45;

/** Seconds from a bank beat to the moment its figure lands (the slam on tiers 2 and 3). */
export function bankLandDelay(tier: number): number {
  const r = ROLL[tier < 0 ? 0 : tier > 3 ? 3 : Math.round(tier)];
  return r.n > 0 ? CHIP_S + r.dur : 0;
}

interface Job {
  t: number;
  v: Voice | null;
  fn: (t: number) => void;
  lead: number;
}

const panOf = (dx: number, span: number, fallback: number): number => (dx !== 0 && Number.isFinite(dx) ? clamp(dx / span, -0.8, 0.8) : fallback);

export class Sfx {
  private styleNext = 0;
  private giftStreak = 0;
  private lastGift = -10;
  private readonly jobs: Job[] = [];
  // Frame context from the beats, read by this frame's raw events.
  /** The stomp streak the perfect-landing chord climbs by. */
  private streak = 1;
  private readonly nearQueue: Array<{ whisker: boolean; side: number }> = [];
  private readonly bumpSides: number[] = [];
  /** Banks a beat already voiced this frame (the raw comboBank then plays nothing). */
  private bankBeats = 0;
  // Grid pulses: the last time each was scheduled.
  private fuseLast = -1;
  private heartLast = -1;
  /** The ambience bed's drop (Core wires it to ambience.dip): a gap only reads as a gap when the
   *  wind goes with the band. */
  bed: ((t: number, hold: number, depth: number) => void) | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly pool: VoicePool,
    private readonly bus: Bus,
    private readonly key: () => Key,
    private readonly music: Bus | null = null,
  ) {}

  reset(): void {
    this.styleNext = 0;
    this.giftStreak = 0;
    this.lastGift = -10;
    this.streak = 1;
    this.fuseLast = -1;
    this.heartLast = -1;
    this.frame();
  }

  /** Start of a frame's beats: clears the context the previous frame's beats left. */
  frame(): void {
    this.nearQueue.length = 0;
    this.bumpSides.length = 0;
    this.bankBeats = 0;
  }

  /** Drops deferred parts, so a reward cut off by a mute (an ad) does not finish after it. */
  clearPending(): void {
    this.jobs.length = 0;
  }

  /** Runs fn(t) at t: now if t is close, else from a later scheduler pass (cancelled by clearPending). */
  schedule(t: number, fn: (t: number) => void): void {
    this.later(t, fn);
  }

  /** Scheduler pass: build deferred parts that are now close. */
  flush(now: number): void {
    for (let i = 0; i < this.jobs.length; ) {
      const j = this.jobs[i];
      if (j.t - now < j.lead) {
        this.jobs.splice(i, 1);
        if (!j.v || !j.v.dead) j.fn(Math.max(j.t, now + 0.005));
      } else i++;
    }
  }

  event(e: SimEvent, t: number): void {
    switch (e.type) {
      case 'takeoff':
        this.takeoff(e.kind, e.vy, t);
        break;
      case 'land':
        this.land(e.quality, e.impact, e.halfTurns + e.flips * 2, e.late, t);
        break;
      case 'crash':
        this.crash(e.cause, t);
        break;
      case 'style':
        this.style(e.kind, e.chain, e.mult, t, e.side);
        break;
      case 'comboBank':
        // Voiced by its bank beat (the roll and the drop); the arpeggio is the fallback.
        if (this.bankBeats > 0) this.bankBeats--;
        else {
          this.bank(e.points, t);
          if (e.points >= 1500 && this.music) this.music.duck(0.75, t, 0.3, 0.3);
        }
        break;
      case 'comboLost':
        this.lost(e.points, t);
        break;
      case 'gift':
        this.gift(e.value, t);
        break;
      case 'bump':
        this.bump(t);
        break;
      case 'smash':
        this.smash(t);
        break;
      case 'drift':
        this.drift(e.phase, e.tier, t);
        break;
      case 'boost':
        this.boost(e.amount, e.source, t);
        break;
      case 'chaos':
        this.chaos(e.phase, e.event, t);
        break;
      case 'revive':
        this.revive(t);
        break;
    }
    if (this.music) this.duckFor(e, this.music, t);
  }

  /** The music bus dips under the moments that need the room. */
  private duckFor(e: SimEvent, duck: Bus, t: number): void {
    switch (e.type) {
      case 'crash':
        // The crash beat: a hard duck for a quarter second, then the crash's own dip and recovery.
        duck.duckSeq(t, 0.12, 0.25, 0.3, 0.7, 0.9);
        break;
      case 'land':
        if (e.quality === 'perfect') duck.duck(0.62, t, 0.18, 0.25);
        break;
      case 'chaos':
        if (e.phase === 'warn') duck.duck(0.55, t, e.event === ChaosEvent.Avalanche ? 2.8 : 1.4, 0.6);
        else if (e.phase === 'success') {
          // Outran the avalanche: the band drops out (wind and the fading rumble left), then slams
          // back with the fanfare.
          if (e.event === ChaosEvent.Avalanche) {
            duck.duck(0.02, t, ESCAPE_DROP_S, 0.04, 0.008);
            this.bed?.(t, ESCAPE_DROP_S, 0.3);
          }
          else duck.duck(0.5, t, 1, 0.6);
        }
        break;
      case 'revive':
        duck.duck(0.6, t, 0.8, 0.5);
        break;
      default:
        break;
    }
  }

  /**
   * A UI sound at time t. One far enough ahead (the reveal and results timelines) waits in the job
   * list until its moment, so clearPending() can still drop it; `onStart` runs as it is built (the
   * engine's music duck for the big chimes, so a cancelled sound leaves no duck behind).
   */
  ui(name: UiSound, detail: number, t: number, onStart?: (t: number) => void): void {
    const d = Number.isFinite(detail) ? Math.max(0, Math.floor(detail)) : 0;
    this.later(
      t,
      (tt) => {
        onStart?.(tt);
        this.uiNow(name, d, tt);
      },
      TIMELINE_LEAD,
    );
  }

  private uiNow(name: UiSound, d: number, t: number): void {
    switch (name) {
      case 'tap': {
        const v = this.voice(t, 0.05);
        mallet(v, t, this.note(7), 0.07, 0.06);
        this.click(v, t, 0.025);
        break;
      }
      case 'confirm': {
        const v = this.voice(t, 0.12);
        mallet(v, t, this.note(5), 0.085, 0.09);
        mallet(v, t + 0.055, this.note(7), 0.1, 0.15);
        break;
      }
      case 'back': {
        const v = this.voice(t, 0.1);
        mallet(v, t, this.note(7), 0.07, 0.07);
        mallet(v, t + 0.05, this.note(4), 0.07, 0.12);
        break;
      }
      case 'reveal-tick': {
        // detail: the ladder step (the reel climbs 3 to 9 as it slows).
        const v = this.voice(t, 0.08);
        ping(v, t, this.note(Math.min(d, 14)), 0.07, 0.025);
        this.click(v, t, 0.025);
        break;
      }
      case 'results-tick': {
        // The score counting up: detail is the ladder step (0 to 9 along the count).
        const v = this.voice(t, 0.06);
        const i = Math.min(d, 14);
        ping(v, t, this.note(i), 0.05, 0.035);
        ping(v, t, this.note(i + 5), 0.014, 0.02);
        this.click(v, t, 0.018);
        break;
      }
      case 'results-mallet': {
        // A soft mallet per Beat stamp on a ghost you passed: detail is its index.
        const v = this.voice(t, 0.2, 0.15);
        mallet(v, t, this.note(5 + Math.min(d, 7)), 0.075, 0.2);
        break;
      }
      case 'reveal-land': {
        const v = this.voice(t, 0.15);
        thump(v, t, 90, 45, 0.26, 0.07);
        whoosh(v, t, 0.3, 2600, 700, 0.05, 0.9);
        this.chord(t + 0.01, 0.07, 0.6, 4);
        this.shimmer(t + 0.06, 8, 9, 0.03);
        break;
      }
      case 'warn': {
        const v = this.voice(t, 0.1);
        for (const dt of [0, 0.17]) {
          mallet(v, t + dt, this.note(-5), 0.13, 0.12);
          ping(v, t + dt, this.note(-10), 0.08, 0.1);
        }
        break;
      }
      case 'ghost-pass': {
        // You overtook a ghost: it rushes past you to the left, and a mint ping climbs per pass.
        const v = this.voice(t, 0.3, 0.6);
        if (v.pan) {
          v.pan.setValueAtTime(0.6, t);
          v.pan.linearRampToValueAtTime(-0.6, t + 0.35);
        }
        whoosh(v, t, 0.35, 700, 2400, 0.1, 1.1);
        const i = 5 + ((Math.max(1, d) - 1) % 8);
        fmBell(v, t + 0.06, this.note(i), 0.1, 0.4, 2, 1.1);
        ping(v, t + 0.06, this.note(i + 5), 0.03, 0.15);
        break;
      }
      case 'ghost-passed-you': {
        const v = this.voice(t, 0.4, -0.6);
        if (v.pan) {
          v.pan.setValueAtTime(-0.6, t);
          v.pan.linearRampToValueAtTime(0.6, t + 0.4);
        }
        whoosh(v, t, 0.4, 1800, 600, 0.08, 1);
        fmBell(v, t + 0.05, this.note(2), 0.06, 0.25, 2.4, 1);
        fmBell(v, t + 0.17, this.note(0), 0.06, 0.45, 2.4, 1);
        break;
      }
      case 'new-best': {
        this.arpeggio(t, 6, 0.07, 0.09);
        this.chord(t + 0.42, 0.085, 1.0, 5);
        this.shimmer(t + 0.45, 14, 9, 0.04);
        this.later(t + 0.42, (tj) => {
          const v = this.voice(tj, 0.3);
          v.buffer(v.bank.jingle, tj, tj + 0.48, v.gain(0.16, v.out), 1.05, false);
        });
        break;
      }
      case 'mission': {
        const k = d % 3;
        const v = this.voice(t, 0.35);
        [5, 7, 10].forEach((n, j) => {
          const f = this.note(n + k);
          this.at(v, t + j * 0.08, (tn) => fmBell(v, tn, f, 0.09, 0.4, 3.5, 1.2));
        });
        this.shimmer(t + 0.2, 6, 10, 0.03);
        break;
      }
      case 'unlock': {
        const v = this.voice(t, 0.4);
        const g = v.gain(0, v.out);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.15, t + 0.45);
        g.gain.setTargetAtTime(0, t + 0.46, 0.06);
        v.buffer(v.bank.white, t, t + 0.9, v.filter('highpass', 3000, 0.7, g));
        this.at(v, t + 0.45, (tt) => thump(v, tt, 70, 38, 0.32, 0.12));
        this.chord(t + 0.45, 0.09, 1.1, 5);
        this.shimmer(t + 0.5, 16, 9, 0.045);
        break;
      }
      case 'go': {
        const v = this.voice(t, 0.2);
        whoosh(v, t, 0.35, 400, 3000, 0.12, 1);
        thump(v, t, 110, 50, 0.26, 0.06);
        const r = brightRoot(this.key(), 52);
        for (let j = 0; j < 4; j++) pluck(v, t + j * 0.012, mtof(r + BRIGHT_VOICING[j]), 0.09, 0.32, 4);
        break;
      }
      case 'results-stamp': {
        const v = this.voice(t, 0.12);
        thump(v, t, 80, 40, 0.3, 0.07);
        const g = v.gain(0, v.out);
        const e = perc(g.gain, t, 0.2 * bandComp(1500, 1, this.ctx.sampleRate), 0.001, 0.025);
        v.buffer(v.bank.white, t, e, v.filter('bandpass', 1500, 1, g));
        fmBell(v, t + 0.01, this.note(0), 0.06, 0.5, 2, 1);
        break;
      }
      case 'coin': {
        const v = this.voice(t, 0.25, 0, 1.4);
        fmBell(v, t, this.note(10), 0.08, 0.1, 2, 1);
        fmBell(v, t + 0.07, this.note(12), 0.09, 0.38, 2, 1);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- helpers

  /** `level` trims a whole sound: rewards sit a few dB hotter so they cut through the music. */
  private voice(t: number, send: number, pan = 0, level = 1): Voice {
    return this.pool.voice(t, level, this.bus.dry, this.bus.wet, send, pan);
  }

  /** Run `fn(t)` now, or from a later scheduler pass if t is far enough ahead. */
  private later(t: number, fn: (t: number) => void, lead = DEFER): void {
    if (t - this.ctx.currentTime < lead) fn(t);
    else this.jobs.push({ t, v: null, fn, lead });
  }

  /** Like later(), for a part added to an existing voice; the voice is kept alive meanwhile. */
  private at(v: Voice, t: number, fn: (t: number) => void): void {
    if (t - this.ctx.currentTime < DEFER) fn(t);
    else {
      v.hold(t + 0.1);
      this.jobs.push({ t, v, fn, lead: DEFER });
    }
  }

  /** Frequency of pentatonic ladder step i in the current key. */
  private note(i: number): number {
    return mtof(ladder(this.key(), i));
  }

  private click(v: Voice, t: number, amp: number): void {
    const g = v.gain(0, v.out);
    const e = perc(g.gain, t, amp, 0.0005, 0.003);
    v.buffer(v.bank.white, t, e, v.filter('highpass', 4000, 0.7, g));
  }

  /** Bright major add9 bell chord, strummed upward. `shift` moves every voice that many steps up the
   *  key's pentatonic ladder (all its tones are pentatonic), so a climbing chord stays in key. */
  private chord(t: number, amp: number, tau: number, count: number, shift = 0): void {
    const k = this.key();
    const r = brightRoot(k, 52);
    this.later(t, (tc) => {
      const v = this.voice(tc, 0.55);
      for (let i = 0; i < Math.min(count, BRIGHT_VOICING.length); i++) {
        const ti = tc + i * 0.02;
        const m = r + BRIGHT_VOICING[i];
        const f = mtof(shift ? ladder(k, ladderIndexOf(k, m) + shift) : m);
        if (i < 2) fmBell(v, ti, f, amp * 1.15, tau * 1.2, 2, 1);
        else fmBell(v, ti, f, amp, tau, 3.5, 1.5);
      }
    });
  }

  /** A noise swell rising into a moment (a reverse cymbal): exponential crescendo through a
   *  highpass that opens downward, cut as it peaks. */
  private swellUp(t: number, dur: number, amp: number, pan = 0, dry = false): void {
    // Into a drop it is dry and cut hard, so no reverb tail fills the gap.
    const v = this.voice(t, dry ? 0 : 0.5, pan);
    const g = v.gain(0, v.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + dur);
    g.gain.setTargetAtTime(0, t + dur, dry ? 0.006 : 0.025);
    const hp = v.filter('highpass', 7000, 0.7, g);
    hp.frequency.setValueAtTime(7000, t);
    hp.frequency.exponentialRampToValueAtTime(2600, t + dur);
    v.buffer(v.bank.white, t, t + dur + 0.16, hp);
  }

  /** The band slamming back after a drop: a deep kick, a noise crash and a body thud. */
  private slam(t: number, big: boolean): void {
    const v = this.voice(t, 0.3, 0, 1.2);
    thump(v, t, 70, 38, big ? 0.62 : 0.52, 0.14);
    const g = v.gain(0, v.out);
    const e = perc(g.gain, t, big ? 0.22 : 0.17, 0.002, 0.075);
    v.buffer(v.bank.white, t, e, v.filter('highpass', 3200, 0.7, g));
    puff(v, t, 0.12, 2400, 500, 0.07);
  }

  /** A rising spray of tiny sine grains, alternating between a left and a right voice. Each side
   *  reuses three oscillators round-robin instead of one per grain: a slot's previous grain has
   *  decayed by 20 dB when it is retuned, and it is faded out over a few ms first. */
  private shimmer(t: number, count: number, from: number, amp: number): void {
    this.later(t, (ts) => {
      const end = ts + count * 0.038 + 0.7;
      for (const side of [-1, 1]) {
        const v = this.voice(ts, 0.65, side * 0.6);
        const slots: { g: GainNode; o: OscillatorNode }[] = [];
        for (let s = 0; s < 3; s++) {
          const g = v.gain(0, v.out);
          slots.push({ g, o: v.osc('sine', 1000, ts, end, g) });
        }
        let n = 0;
        for (let i = side < 0 ? 0 : 1; i < count; i += 2, n++) {
          const ti = ts + i * 0.038 + rand(0.006, 0.02);
          const idx = Math.min(from + Math.floor(i / 2) + (Math.random() < 0.3 ? 1 : 0), from + 6);
          const { g, o } = slots[n % 3];
          g.gain.setTargetAtTime(0, ti - 0.006, 0.0015);
          o.frequency.setValueAtTime(this.note(idx), ti);
          g.gain.setValueAtTime(0, ti);
          g.gain.linearRampToValueAtTime(amp * (1 - (i / count) * 0.6), ti + 0.0015);
          g.gain.setTargetAtTime(0, ti + 0.0015, 0.1);
        }
      }
    });
  }

  /** Ascending bell arpeggio over the bright chord ladder. */
  private arpeggio(t: number, n: number, gap: number, amp: number): number {
    let r = brightRoot(this.key(), 60);
    if (n > 6) r -= 12;
    const v = this.voice(t, 0.35, -0.4);
    if (v.pan) {
      v.pan.setValueAtTime(-0.4, t);
      v.pan.linearRampToValueAtTime(0.4, t + n * gap);
    }
    for (let i = 0; i < n; i++) {
      const f = mtof(r + BRIGHT_ARP[i]);
      const a = amp * (0.75 + (0.35 * i) / n);
      this.at(v, t + i * gap, (ti) => fmBell(v, ti, f, a, 0.22, 2, 1.1));
    }
    return r + BRIGHT_ARP[n - 1];
  }

  /** Brass-like stab: detuned saws behind a lowpass that blats open. */
  private brass(v: Voice, t: number, notes: readonly number[], dur: number, amp: number): void {
    for (const m of notes) {
      const f = mtof(m);
      const g = v.gain(0, v.out);
      const end = swell(g.gain, t, amp, 0.025, dur, 0.18);
      const lp = v.filter('lowpass', 500, 1.2, g);
      lp.frequency.setValueAtTime(500, t);
      lp.frequency.linearRampToValueAtTime(Math.min(f * 6, 5000), t + 0.05);
      lp.frequency.setTargetAtTime(Math.min(f * 3, 3000), t + 0.05, 0.2);
      v.osc(v.bank.warmSaw, f, t, end, lp, -7);
      v.osc(v.bank.warmSaw, f, t, end, lp, 7);
    }
  }

  private knock(v: Voice, t: number, f: number, amp: number): void {
    const g = v.gain(0, v.out);
    const e = perc(g.gain, t, amp * bandComp(f, 6, this.ctx.sampleRate), 0.001, 0.03);
    v.buffer(v.bank.white, t, e, v.filter('bandpass', f, 6, g));
    thump(v, t, f * 0.55, f * 0.35, amp * 0.5, 0.03);
  }

  // ---------------------------------------------------------------- sim events

  private takeoff(kind: TakeoffKind, vy: number, t: number): void {
    const amt = clamp(0.6 + vy / 16, 0.6, 1.1);
    if (kind === 'geyser') {
      // Steam: a hissing burst that blooms and thins, over a low fwoomp.
      const v = this.voice(t, 0.25, rand(-0.2, 0.2));
      const g = v.gain(0, v.out);
      const end = swell(g.gain, t, 0.42 * bandComp(4000, 0.7, this.ctx.sampleRate), 0.03, 0.25, 0.35);
      const hp = v.filter('highpass', 1600, 0.7, g);
      const bp = v.filter('bandpass', 2600, 0.7, hp);
      bp.frequency.setValueAtTime(2600, t);
      bp.frequency.exponentialRampToValueAtTime(5500, t + 1.2);
      v.buffer(v.bank.white, t, end, bp);
      puff(v, t, 0.3, 380, 140, 0.12, v.bank.brown);
      whoosh(v, t, 0.5, 500, 2400, 0.1);
      return;
    }
    const v = this.voice(t, 0.12);
    if (kind === 'pop') {
      thump(v, t, 230, 120, 0.2, 0.03);
      puff(v, t, 0.09, 2000, 600, 0.05);
    }
    whoosh(v, t + (kind === 'pop' ? 0.01 : 0), 0.4, 380, 1900, 0.2 * amt, 1.1);
  }

  private land(q: LandQuality, impact: number, tricks: number, late: boolean, t: number): void {
    const imp = clamp(0.55 + impact / 14, 0.5, 1.2);
    if (q === 'hop') {
      const v = this.voice(t, 0.05);
      puff(v, t, 0.14 * imp, 1300, 500, 0.04);
      return;
    }
    if (q === 'perfect') {
      this.perfect(tricks, late, t);
      return;
    }
    const v = this.voice(t, 0.08);
    if (q === 'clean') {
      thump(v, t, 120, 52, 0.32 * imp, 0.06);
      puff(v, t, 0.18 * imp, 2600, 700, 0.09);
      crumble(v, t, 0.09 * imp, 1500, 0.9, 2, 0.06);
      return;
    }
    // Sketchy: a thud, a scrape that judders, and a tone that wobbles and sags.
    thump(v, t, 105, 50, 0.24 * imp, 0.05);
    const sg = v.gain(0, v.out);
    const end = perc(sg.gain, t, 0.15 * bandComp(850, 2.5, this.ctx.sampleRate), 0.01, 0.14);
    const am = v.gain(0.5, sg);
    v.lfo(12, 0.5, am.gain, t, end, 'square');
    v.buffer(v.bank.pink, t, end, v.filter('bandpass', 850, 2.5, am));
    const f = this.note(0);
    const wg = v.gain(0, v.out);
    const we = perc(wg.gain, t + 0.02, 0.07, 0.01, 0.13);
    const o = v.osc('triangle', f, t, we, v.filter('lowpass', 1400, 0.7, wg));
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.45);
    v.lfo(7, f * 0.03, o.frequency, t, we);
  }

  private perfect(tricks: number, late: boolean, t: number): void {
    // The stomp streak (its beat came first this frame): the chord climbs 2 pentatonic steps per
    // level (up to 8), brass joins from a Triple stomp, a second high shimmer from a streak of 5.
    const n = Math.max(1, this.streak);
    const shift = Math.min(8, 2 * (n - 1));
    if (!late) {
      const v = this.voice(t, 0.06);
      thump(v, t, 72, 36, 0.48 + 0.03 * Math.min(n - 1, 4), 0.11);
      puff(v, t, 0.16, 3200, 800, 0.1);
      this.click(v, t, 0.1);
    }
    // The payoff: a major add9 bell chord over a soft bloom, then a rising shimmer.
    this.chord(t + 0.012, 0.085, 0.85, 5, shift);
    if (n >= 3) {
      const k = this.key();
      const rb = brightRoot(k, 55);
      const notes = [0, 7, 12].map((x) => ladder(k, ladderIndexOf(k, rb + x) + shift));
      this.later(t + 0.02, (tb) => this.brass(this.voice(tb, 0.3, 0, 1.1), tb, notes, 0.24, 0.032));
    }
    if (n >= 5) this.shimmer(t + 0.16, 14, 12, 0.035);
    const r = brightRoot(this.key(), 52);
    // The bloom swells in slowly, so it can be built on the next scheduler pass.
    this.later(t + 0.09, (tb) => {
      const bv = this.voice(tb, 0.5);
      const bg = bv.gain(0, bv.out);
      const be = swell(bg.gain, tb, 0.06, 0.05, 0.12, 0.45);
      const blp = bv.filter('lowpass', 2200, 0.5, bg);
      for (const x of [0, 7, 16]) bv.osc('triangle', mtof(r + x), tb, be, blp);
      const sg = bv.gain(0, bv.out);
      const se = swell(sg.gain, tb, 0.22, 0.1, 0.05, 0.22);
      bv.buffer(bv.bank.white, tb, se, bv.filter('highpass', 6500, 0.7, sg));
    });
    this.shimmer(t + 0.1, 12 + 3 * Math.min(tricks, 4), 9, 0.045);
  }

  private crash(cause: CrashCause, t: number): void {
    const v = this.voice(t, 0.15);
    thump(v, t, 85, 32, 0.38, 0.12);
    puff(v, t, 0.2, 1400, 300, 0.09);
    // Tumble: irregular thuds of snow as the rider rolls.
    crumble(v, t + 0.05, 0.22, 600, 0.9, 0.9, 0.35);
    // A descending tone: the run deflates.
    const f0 = this.note(5);
    const f1 = this.note(-5);
    const g = v.gain(0, v.out);
    const end = perc(g.gain, t + 0.04, 0.07, 0.02, 0.35);
    const lp = v.filter('lowpass', 1600, 1, g);
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 1.1);
    for (const [wave, mul] of [
      [v.bank.warmSaw, 1],
      ['triangle', 0.5],
    ] as const) {
      const o = v.osc(wave, f0 * mul, t + 0.04, end, lp);
      o.frequency.setValueAtTime(f0 * mul, t + 0.04);
      o.frequency.exponentialRampToValueAtTime(f1 * mul, t + 1.1);
    }
    switch (cause) {
      case 'tree':
      case 'forest': {
        const n = cause === 'forest' ? 3 : 1;
        for (let i = 0; i < n; i++) this.knock(v, t + i * 0.085, 340 + 80 * i, 0.15);
        // Snow shaken off the branches.
        puff(v, t + 0.14, 0.12, 2200, 600, 0.25);
        break;
      }
      case 'rock':
        this.knock(v, t, 2200, 0.16);
        thump(v, t, 620, 300, 0.09, 0.02);
        break;
      case 'landing':
        puff(v, t, 0.26, 3000, 600, 0.18);
        break;
      case 'yeti':
        this.roar(t, 0.8, 0.6);
        break;
      case 'avalanche':
        whoosh(v, t, 1.4, 200, 1200, 0.25, 0.6, v.bank.brown);
        puff(v, t, 0.3, 900, 200, 0.5, v.bank.brown);
        break;
    }
  }

  private style(kind: StyleKind, chain: number, mult: number, t0: number, side?: number): void {
    if (kind === 'avalanche') {
      // The escape's brass stab waits out the drop-out and lands on the slam.
      this.later(t0 + ESCAPE_DROP_S, (ts) => this.style('yetiHop', chain, mult, ts), TIMELINE_LEAD);
      return;
    }
    let t = Math.max(t0, this.styleNext);
    if (t > t0 + 0.35) t = t0 + 0.35;
    this.styleNext = t + STYLE_GAP;
    // The chain climbs the pentatonic ladder; past the top it keeps circling the top octave.
    let i = Math.max(0, chain - 1);
    if (i > 12) i = 8 + ((i - 8) % 5);
    const f = this.note(i);
    const vel = 0.8 + Math.min(mult, 10) * 0.02;
    // A near miss sounds on the obstacle's side: its beat names side and grade; without one, the
    // event's own side (if the sim filled it).
    const near = kind === 'nearMiss' ? this.nearQueue.shift() ?? (side === 1 || side === -1 ? { whisker: false, side } : null) : null;
    const pan = near ? near.side * (near.whisker ? 0.7 : 0.5) : rand(-0.25, 0.25);
    const v = this.voice(t, 0.3, pan, 1.6);
    switch (kind) {
      case 'nearMiss':
        if (near?.whisker) {
          // A Whisker: a hand's width at speed. A hard, bright rush past that ear and a glassy tink.
          const g = v.gain(1.6, v.out);
          whoosh(v, t, 0.18, 1400, 5200, 0.1, 1.3, v.bank.white, v.filter('highpass', 2500, 0.7, g));
          ping(v, t + 0.02, f, 0.12 * vel, 0.04);
          fmBell(v, t + 0.035, this.note(10), 0.06, 0.12, 5, 0.7);
          ping(v, t + 0.035, this.note(15), 0.02, 0.05);
        } else {
          whoosh(v, t, 0.2, 900, 3400, 0.1, 1.4);
          ping(v, t + 0.03, f, 0.12 * vel, 0.04);
          ping(v, t + 0.03, f * 2, 0.05, 0.015);
        }
        break;
      case 'gift':
      case 'geyser':
        fmBell(v, t, f, 0.12 * vel, 0.45, 2, 1.2);
        ping(v, t, f * 2, 0.035, 0.12);
        break;
      case 'cleared':
      case 'boostPop':
      case 'carve':
        pluck(v, t, f, 0.16 * vel, 0.22, 3.5);
        break;
      case 'drift':
        pluck(v, t, f, 0.16 * vel, 0.3, 4, v.out, 0.03);
        break;
      case 'slingshot':
        pluck(v, t, f, 0.13 * vel, 0.18, 3.5);
        pluck(v, t + 0.06, this.note(i + 2), 0.14 * vel, 0.25, 3.5);
        break;
      case 'air':
      case 'clean':
      case 'smash':
        mallet(v, t, f, 0.14 * vel, 0.28);
        break;
      case 'spin':
      case 'flip':
        fmBell(v, t, this.note(i - 1), 0.06 * vel, 0.15, 3.5, 1.2);
        fmBell(v, t + 0.04, f, 0.11 * vel, 0.4, 3.5, kind === 'flip' ? 1.8 : 1.3);
        break;
      case 'perfect':
        fmBell(v, t, f, 0.09 * vel, 0.55, 2, 1);
        break;
      case 'draft': {
        // Quiet and breathy: it repeats twice a second while drafting.
        const g = v.gain(0, v.out);
        const e = swell(g.gain, t, 0.045 * vel, 0.03, 0.03, 0.12);
        v.osc('sine', f, t, e, g);
        v.osc('triangle', f * 2, t, e, v.gain(0.2, g));
        break;
      }
      case 'gate':
        fmBell(v, t, this.note(i - 5), 0.09 * vel, 0.9, 3.5, 1.1);
        fmBell(v, t + 0.02, f, 0.09 * vel, 0.5, 2, 1);
        break;
      case 'yetiHop': {
        const r = brightRoot(this.key(), 55);
        this.brass(v, t, [r, r + 7, r + 12, r + 16], 0.5, 0.045);
        fmBell(v, t, mtof(r + 24), 0.08, 0.7, 3.5, 1.3);
        break;
      }
    }
    if (chain > 13) ping(v, t, f * 2, 0.03, 0.1);
  }

  /** Cash-in: an arpeggio whose length grows with the points, ending in a bell and a shake. */
  private bank(points: number, t: number): void {
    const n = clamp(Math.round(2 + Math.log2(Math.max(points, 1) / 120)), 3, 10);
    const gap = n > 6 ? 0.045 : 0.06;
    const top = this.arpeggio(t, n, gap, 0.15);
    const tf = t + n * gap;
    this.later(tf, (tc) => {
      const v = this.voice(tc, 0.45, 0.3, 1.5);
      fmBell(v, tc, mtof(top), 0.12, 0.7, 3.5, 1.4);
      fmBell(v, tc, mtof(fit(top, 60)), 0.07, 0.6, 2, 1);
      v.buffer(v.bank.jingle, tc, tc + 0.45, v.gain(0.14 + 0.06 * (n / 10), v.out), 1.05, false);
    });
    if (points >= 4000) this.shimmer(tf, 10, 9, 0.04);
  }

  /** Combo lost: a deflating downward glide with a closing wah. */
  private lost(points: number, t: number): void {
    const dur = 0.55 + Math.min(0.35, points / 20000);
    const v = this.voice(t, 0.2);
    const f0 = this.note(4);
    const g = v.gain(0, v.out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const end = t + dur + 0.02;
    const lp = v.filter('lowpass', 2200, 4, g);
    lp.frequency.setValueAtTime(2200, t);
    lp.frequency.exponentialRampToValueAtTime(280, t + dur);
    for (const [wave, mul] of [
      [v.bank.warmSaw, 1],
      ['triangle', 0.5],
    ] as const) {
      const o = v.osc(wave, f0 * mul, t, end, lp);
      o.frequency.setValueAtTime(f0 * mul, t);
      o.frequency.exponentialRampToValueAtTime(f0 * mul * 0.5, t + dur);
    }
    whoosh(v, t, dur, 1600, 500, 0.04, 0.8, v.bank.pink);
  }

  private gift(value: number, t: number): void {
    // Quick pickups in a row climb like a coin run.
    this.giftStreak = t - this.lastGift < 1.2 ? this.giftStreak + 1 : 0;
    this.lastGift = t;
    const i = 6 + Math.min(this.giftStreak, 9);
    const v = this.voice(t, 0.3, rand(-0.3, 0.3), 1.6);
    fmBell(v, t, this.note(i), 0.09, 0.22, 2, 1);
    fmBell(v, t + 0.055, this.note(i + 2), 0.1, 0.42, 2, 1);
    if (value >= 5) {
      const f = this.note(i + 4);
      this.at(v, t + 0.11, (tn) => fmBell(v, tn, f, 0.09, 0.6, 3.5, 1.3));
      v.buffer(v.bank.jingle, t + 0.05, t + 0.5, v.gain(0.14, v.out), 1.1, false);
    }
  }

  private bump(t: number): void {
    // The obstacle's side when the bump beat named it.
    const side = this.bumpSides.shift();
    const v = this.voice(t, 0.05, side === 1 || side === -1 ? side * 0.45 : rand(-0.2, 0.2));
    thump(v, t, 95, 48, 0.3, 0.05);
    puff(v, t, 0.11, 800, 300, 0.03);
  }

  private smash(t: number): void {
    const v = this.voice(t, 0.15, rand(-0.3, 0.3));
    puff(v, t, 0.24, 1700, 500, 0.12);
    crumble(v, t, 0.18, 2400, 0.8, 3.2, 0.13, v.bank.white);
    thump(v, t, 80, 45, 0.17, 0.05);
  }

  private drift(phase: 'start' | 'tier' | 'release' | 'end', tier: number, t: number): void {
    if (phase === 'start') {
      whoosh(this.voice(t, 0.05), t, 0.18, 1400, 2600, 0.08, 0.8);
    } else if (phase === 'tier') {
      // Each tier is a short run up to a higher chime.
      const k = clamp(tier, 1, 3);
      const target = 4 + k * 2;
      const v = this.voice(t, 0.4, 0, 1.4);
      for (let j = 0; j <= k; j++) {
        const last = j === k;
        const f = this.note(target - k + j);
        this.at(v, t + j * 0.045, (tn) => fmBell(v, tn, f, last ? 0.11 : 0.055, last ? 0.45 : 0.12, 3.5, 1.3));
      }
      if (k >= 3) this.shimmer(t + 0.15, 8, 10, 0.03);
    } else if (phase === 'release') {
      const v = this.voice(t, 0.15);
      whoosh(v, t, 0.5, 600, 3800, 0.14 + tier * 0.025, 1);
      if (tier === 2) {
        // A soft snap.
        this.snap(v, t, 900, 280, 0.07, 0.03);
        this.click(v, t, 0.05);
      } else if (tier >= 3) {
        // The crack: a click, a snap gliding down and a 60 Hz thump, like a slingshot letting go.
        const cg = v.gain(0, v.out);
        const ce = perc(cg.gain, t, 0.16, 0.0005, 0.0022);
        v.buffer(v.bank.white, t, ce, v.filter('highpass', 3000, 0.7, cg));
        this.snap(v, t + 0.002, 1200, 300, 0.13, 0.04);
        thump(v, t + 0.004, 60, 42, 0.42, 0.05);
      }
    }
  }

  /** A short triangle snap gliding f0 to f1 over `dur`. */
  private snap(v: Voice, t: number, f0: number, f1: number, amp: number, dur: number): void {
    const g = v.gain(0, v.out);
    const end = perc(g.gain, t, amp, 0.001, dur * 0.35);
    const o = v.osc('triangle', f0, t, end, g);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  }

  private boost(amount: number, source: 'drift' | 'perfect' | 'slingshot' | 'pop', t: number): void {
    const a = clamp(amount / 8, 0.45, 1.2);
    const v = this.voice(t, 0.2, 0, 1.5);
    if (source === 'perfect') {
      whoosh(v, t + 0.05, 0.45, 900, 4200, 0.06 * a, 1);
      return;
    }
    whoosh(v, t, 0.55, 700, 4200, 0.19 * a, 1);
    // The rush rises: an octave lift through a lowpass.
    const f0 = this.note(0);
    const f1 = this.note(5);
    const g = v.gain(0, v.out);
    const end = perc(g.gain, t, 0.065 * a, 0.08, 0.18);
    const lp = v.filter('lowpass', 2800, 0.7, g);
    const o1 = v.osc('triangle', f0, t, end, lp);
    const o2 = v.osc(v.bank.warmSaw, f0, t, end, v.gain(0.4, lp), 8);
    for (const o of [o1, o2]) {
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + 0.4);
    }
  }

  private chaos(phase: 'warn' | 'start' | 'end' | 'success', ev: ChaosEvent, t: number): void {
    if (phase === 'success') {
      if (ev === ChaosEvent.Avalanche) {
        // Outran it: the band drops out (the engine's duck), then the fanfare slams back in.
        this.later(
          t + ESCAPE_DROP_S,
          (ts) => {
            this.slam(ts, true);
            this.fanfare(ts);
          },
          TIMELINE_LEAD,
        );
      } else this.fanfare(t);
      return;
    }
    if (phase === 'end') return;
    const warn = phase === 'warn';
    switch (ev) {
      case ChaosEvent.Avalanche:
        if (warn) this.rumble(t);
        else this.boom(t);
        break;
      case ChaosEvent.Yeti:
        if (warn) this.roar(t, 1.7, 1);
        else this.stomps(t);
        break;
      case ChaosEvent.GiftStorm:
        if (warn) this.sleigh(t, 2);
        else this.flourish(t);
        break;
      case ChaosEvent.GhostTrain:
        if (warn) this.spirits(t);
        else this.trainPass(t);
        break;
      case ChaosEvent.None:
        break;
    }
  }

  /** Avalanche warning: a deep rumble that builds over the 3 s warning, with distant cracks. */
  private rumble(t: number): void {
    const sr = this.ctx.sampleRate;
    const dur = 3;
    const v = this.voice(t, 0.3);
    const g = v.gain(0, v.out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + dur - 0.1);
    g.gain.setTargetAtTime(0, t + dur, 0.35);
    const end = t + dur + 0.35 * 5.5;
    const lp = v.filter('lowpass', 70, 0.8, g);
    lp.frequency.setValueAtTime(70, t);
    lp.frequency.exponentialRampToValueAtTime(520, t + dur);
    v.buffer(v.bank.brown, t, end, lp);
    const sg = v.gain(0, v.out);
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.22, t + dur);
    sg.gain.setTargetAtTime(0, t + dur, 0.3);
    const am = v.gain(0.5, sg);
    v.lfo(4.5, 0.5, am.gain, t, end);
    v.osc('sine', 44, t, end, am);
    for (const ct of [0.5, 1.25, 1.9, 2.5]) {
      const tc = t + ct + rand(-0.1, 0.1);
      const fc = rand(500, 1100);
      const amp = rand(0.06, 0.12) * (ct / 2.5 + 0.4) * bandComp(fc, 2, sr);
      this.at(v, tc, (tn) => {
        const cg = v.gain(0, v.out);
        const ce = perc(cg.gain, tn, amp, 0.002, 0.05);
        v.buffer(v.bank.pink, tn, ce, v.filter('bandpass', fc, 2, cg));
      });
    }
  }

  private boom(t: number): void {
    const v = this.voice(t, 0.3);
    thump(v, t, 58, 30, 0.46, 0.35);
    puff(v, t, 0.34, 600, 150, 0.45, v.bank.brown);
    whoosh(v, t, 1, 300, 1500, 0.1, 0.7, v.bank.pink);
  }

  /** Yeti: a low saw with jittery pitch and a growl flutter, shaped by three formant band-passes
   *  that open from "oo" to "aah". */
  private roar(t: number, dur: number, amp: number): void {
    const sr = this.ctx.sampleRate;
    const v = this.voice(t, 0.35, rand(-0.3, 0.3));
    const g = v.gain(0, v.out);
    const end = swell(g.gain, t, amp, dur * 0.2, dur * 0.45, dur * 0.12);
    const cords = v.gain(0.6, null);
    v.lfo(27, 0.4, cords.gain, t, end, 'triangle');
    const o = v.osc('sawtooth', 70, t, end, cords);
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(108, t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(62, end);
    v.lfo(6.3, 5, o.frequency, t, end);
    const breath = v.gain(0.5, null);
    v.buffer(v.bank.pink, t, end, breath);
    const formants: readonly (readonly [number, number, number, number])[] = [
      [300, 720, 7, 1],
      [850, 1150, 8, 0.6],
      [2300, 2500, 10, 0.25],
    ];
    for (const [a, b, q, lvl] of formants) {
      const fg = v.gain(lvl * bandComp(b, q, sr) * 0.2, g);
      const bp = v.filter('bandpass', a, q, fg);
      bp.frequency.setValueAtTime(a, t);
      bp.frequency.linearRampToValueAtTime(b, t + dur * 0.4);
      bp.frequency.linearRampToValueAtTime(a * 1.1, end);
      cords.connect(bp);
      breath.connect(bp);
    }
    // Chest: the cords low-passed for body.
    cords.connect(v.filter('lowpass', 260, 0.7, v.gain(0.2, g)));
  }

  private stomps(t: number): void {
    const v = this.voice(t, 0.2, rand(-0.3, 0.3));
    for (let i = 0; i < 3; i++) {
      this.at(v, t + i * 0.38, (ti) => {
        thump(v, ti, 60, 35, 0.26, 0.08);
        puff(v, ti, 0.08, 700, 250, 0.06, v.bank.brown);
      });
    }
    this.later(t + 0.2, (tr) => this.roar(tr, 0.8, 0.5));
  }

  /** Gift storm warning: sleigh bells shaken in eighths of the current tempo, then a glissando. */
  private sleigh(t: number, dur: number): void {
    const beat = 60 / this.key().bpm / 2;
    for (const side of [-1, 1]) {
      const v = this.voice(t, 0.3, side * 0.35);
      let i = side < 0 ? 0 : 1;
      for (let tt = t + (side < 0 ? 0 : beat); tt < t + dur; tt += beat * 2, i += 2) {
        const amp = (i % 4 === 0 ? 0.45 : 0.29) * rand(0.85, 1) * Math.min(1, 0.4 + (tt - t) / dur);
        const rate = rand(0.94, 1.08);
        this.at(v, tt + rand(0, 0.012), (ts) => v.buffer(v.bank.jingle, ts, ts + 0.45, v.gain(amp, v.out), rate, false));
      }
    }
    this.later(t + dur - 0.7, (tg) => {
      const gv = this.voice(tg, 0.45, 0.2);
      for (let j = 0; j < 8; j++) {
        const f = this.note(3 + j);
        this.at(gv, tg + j * 0.06, (tn) => fmBell(gv, tn, f, 0.05 + j * 0.005, 0.3, 2, 1));
      }
    });
  }

  private flourish(t: number): void {
    const v = this.voice(t, 0.4, 0.2);
    for (let j = 0; j < 5; j++) {
      const f = this.note(12 - j);
      this.at(v, t + j * 0.05, (tn) => fmBell(v, tn, f, 0.07, 0.3, 2, 1));
    }
    v.buffer(v.bank.jingle, t, t + 0.45, v.gain(0.14, v.out), 1, false);
  }

  /** Spirit train warning: an eerie minor-major-seventh chime chord and a ghostly whistle. */
  private spirits(t: number): void {
    const sr = this.ctx.sampleRate;
    const r = fit(this.key().tonic, 60);
    const v = this.voice(t, 0.7);
    [0, 3, 7, 11].forEach((x, i) => this.at(v, t + i * 0.09, (ti) => {
      const f = mtof(r + x);
      const g = v.gain(0, v.out);
      const end = perc(g.gain, ti, 0.07, 0.003, 1.3);
      const car = v.osc('sine', f, ti, end, g);
      const mg = v.gain(0, car.frequency);
      mg.gain.setValueAtTime(f * 2.4 * 1.2, ti);
      mg.gain.setTargetAtTime(f * 2.4 * 0.1, ti, 0.4);
      v.osc('sine', f * 2.4, ti, end, mg);
      v.lfo(5.5, f * 0.006, car.frequency, ti, end);
    }));
    this.at(v, t + 0.35, (wt) => this.whistle(v, wt, r, sr));
  }

  /** The ghost whistle: two breathy sines a minor third apart that sigh up and back down. */
  private whistle(v: Voice, wt: number, r: number, sr: number): void {
    for (const x of [12, 15]) {
      const f = mtof(r + x);
      const g = v.gain(0, v.out);
      const end = swell(g.gain, wt, 0.04, 0.25, 0.7, 0.25);
      const o = v.osc('sine', f, wt, end, g);
      o.frequency.setValueAtTime(f * 0.94, wt);
      o.frequency.linearRampToValueAtTime(f, wt + 0.3);
      o.frequency.setValueAtTime(f, wt + 0.95);
      o.frequency.linearRampToValueAtTime(f * 0.9, end);
      v.lfo(5.2, f * 0.008, o.frequency, wt, end);
    }
    const bf = mtof(r + 12);
    const bg = v.gain(0, v.out);
    const be = swell(bg.gain, wt, 0.035 * bandComp(bf, 6, sr), 0.25, 0.7, 0.25);
    v.buffer(v.bank.white, wt, be, v.filter('bandpass', bf, 6, bg));
  }

  private trainPass(t: number): void {
    const v = this.voice(t, 0.5, -0.9);
    if (v.pan) {
      v.pan.setValueAtTime(-0.9, t);
      v.pan.linearRampToValueAtTime(0.9, t + 1.2);
    }
    whoosh(v, t, 1.2, 300, 1400, 0.13, 0.8, v.bank.pink);
    const r = fit(this.key().tonic, 60);
    this.at(v, t + 0.3, (tn) => fmBell(v, tn, mtof(r + 7), 0.06, 0.6, 2.4, 1));
    this.at(v, t + 0.45, (tn) => fmBell(v, tn, mtof(r + 12), 0.06, 0.8, 2.4, 1));
  }

  private fanfare(t: number): void {
    const r = brightRoot(this.key(), 55);
    const v = this.voice(t, 0.4);
    [0, 4, 7].forEach((x, i) => this.at(v, t + i * 0.09, (tn) => this.brass(v, tn, [r + x], 0.07, 0.05)));
    this.at(v, t + 0.27, (tc) => {
      this.brass(v, tc, [r, r + 7, r + 12, r + 16], 1, 0.042);
      // Timpani.
      thump(v, tc, 98, 70, 0.28, 0.25);
      fmBell(v, tc, mtof(r + 24), 0.08, 0.9, 3.5, 1.3);
    });
    this.shimmer(t + 0.3, 14, 9, 0.04);
  }

  private revive(t: number): void {
    const v = this.voice(t, 0.5);
    const g = v.gain(0, v.out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.7);
    g.gain.setTargetAtTime(0, t + 0.72, 0.08);
    v.buffer(v.bank.white, t, t + 1.3, v.filter('highpass', 2500, 0.7, g));
    for (let i = 0; i < 10; i++) {
      const f = this.note(i);
      this.at(v, t + i * 0.07, (tn) => ping(v, tn, f, 0.03 + i * 0.006, 0.2));
    }
    this.chord(t + 0.75, 0.08, 0.9, 5);
    this.shimmer(t + 0.8, 10, 9, 0.04);
  }

  // ---------------------------------------------------------------- beats (named moments)

  /** One beat's sound at t. Beats that only leave context (stomp, near miss, bump, bank count) are
   *  read back by this frame's raw events; callouts, crashes and drift releases sound from the raw
   *  events themselves. km is placed on the grid by the engine (km()). */
  beat(b: Beat, t: number): void {
    switch (b.type) {
      case 'stomp':
        this.streak = Math.max(1, b.streak);
        break;
      case 'streakBroken':
        this.streakBroken(t);
        break;
      case 'bump':
        this.bumpSides.push(b.side);
        break;
      case 'nearMiss':
        this.nearQueue.push({ whisker: b.grade === 'whisker', side: b.side });
        break;
      case 'flow':
        if (b.phase === 'in') this.flowIn(t);
        else this.flowSnuff(t);
        break;
      case 'bank':
        this.bankBeat(b, t);
        break;
      case 'comboLost':
        this.comboLost(b.stake, t);
        break;
      case 'bestComboPace':
        this.paceChime(t);
        break;
      case 'pass':
        this.passBeat(b, t);
        break;
      case 'passedBy':
        this.passedByBeat(b, t);
        break;
      case 'lead':
        this.leadStab(t);
        break;
      case 'raceNews':
        this.raceNews(b, t);
        break;
      case 'duel':
        this.duel(b, t);
        break;
      case 'raceCall':
        this.raceCall(b.word, t);
        break;
      case 'grudgeSettled':
        this.grudge(b.nemesis, t);
        break;
      case 'newGround':
        this.newGround(t);
        break;
      case 'newBest':
        this.bestChime(t);
        break;
      case 'friendBeaten':
        this.friendChime(t);
        break;
      case 'finale':
        this.finale(b, t);
        break;
      case 'missionPop':
        this.uiNow('mission', 0, t);
        break;
      case 'unlockPop':
        this.uiNow('unlock', 0, t);
        break;
      case 'ghostTrick':
        this.ghostTrick(b, t);
        break;
      case 'stompTick':
        this.stompTick(b.step, b.open, t);
        break;
      case 'graveyard':
        this.graveyard(t);
        break;
      default:
        break;
    }
  }

  /** A stomp streak of 3 or more broken: a falling two-note bell that sags. */
  private streakBroken(t: number): void {
    const v = this.voice(t, 0.3, 0, 1.3);
    fmBell(v, t, this.note(7), 0.07, 0.22, 3.5, 1.1);
    const f = this.note(4);
    this.at(v, t + 0.13, (tn) => {
      const g = v.gain(0, v.out);
      const end = perc(g.gain, tn, 0.075, 0.003, 0.22);
      const o = v.osc('triangle', f, tn, end, v.filter('lowpass', 1800, 0.7, g));
      o.frequency.setValueAtTime(f, tn);
      o.frequency.exponentialRampToValueAtTime(f * 0.94, tn + 0.5);
      fmBell(v, tn, f, 0.05, 0.3, 2, 0.8);
    });
  }

  /** 'In the flow': a 0.6 s reverse-cymbal swell under a tone in the key, landing on a soft chord. */
  private flowIn(t: number): void {
    this.swellUp(t, 0.6, 0.085);
    const k = this.key();
    const v = this.voice(t, 0.55, 0, 1.2);
    fmBell(v, t, mtof(fit(k.tonic, 79)), 0.055, 0.7, 2, 0.9);
    this.chord(t + 0.6, 0.05, 1, 5, 2);
  }

  /** Flow snuffed by a bump: a short pfft of pink noise, low-passed. (The wind bends in ambience.) */
  private flowSnuff(t: number): void {
    const v = this.voice(t, 0.08);
    puff(v, t, 0.2, 900, 300, 0.03, v.bank.pink);
  }

  /**
   * A cash-in. Tier 0 keeps the arpeggio; tiers 1 to 3 roll instead, in step with the HUD: the
   * origin's tock, the 'xN' chip slamming on, ticks climbing the ladder as the figure rolls (eased
   * out like the count), then the product landing on a bell. Tiers 2 and 3 (not a bump bank) drop
   * the band DROP_S before the landing and slam it back on the figure; tier 3 swells a cymbal into
   * the gap.
   */
  private bankBeat(b: BeatOf<'bank'>, t: number): void {
    this.bankBeats++;
    const tier = Math.max(0, Math.min(3, Math.round(b.tier)));
    if (tier === 0) {
      this.bank(b.points, t);
      if (b.points >= 1500 && this.music) this.music.duck(0.75, t, 0.3, 0.3);
      return;
    }
    const r = ROLL[tier];
    const land = t + CHIP_S + r.dur;
    // A drop (tiers 2 and 3, not a bump bank): the climb tops out as the gap opens, so the last
    // DROP_S before the landing is a breath, not more ticks. Dry-ish, so the ticks leave no tail.
    const drop = tier >= 2 && !b.bump;
    const span = drop ? r.dur - DROP_S : r.dur;
    const v = this.voice(t, drop ? 0.1 : 0.25, 0, 1.4);
    mallet(v, t, this.note(r.lo), 0.07, 0.08);
    this.at(v, t + CHIP_S - 0.02, (tc) => {
      this.knock(v, tc, 1800, 0.11);
      thump(v, tc, 170, 90, 0.14, 0.03);
    });
    for (let i = 1; i <= r.n; i++) {
      const e = i / r.n;
      const ti = t + CHIP_S + span * (1 - Math.sqrt(1 - e));
      const f = this.note(r.lo + Math.round(((r.hi - r.lo) * (i - 1)) / (r.n - 1)));
      const amp = 0.04 + 0.03 * e;
      this.at(v, ti, (tn) => {
        ping(v, tn, f, amp, 0.035);
        this.click(v, tn, 0.016);
      });
    }
    const top = ladder(this.key(), r.hi);
    this.later(land, (tc) => {
      const fv = this.voice(tc, 0.45, 0.2, 1.5);
      fmBell(fv, tc, mtof(top), 0.12, 0.7 + 0.15 * tier, 3.5, 1.4);
      fmBell(fv, tc, mtof(fit(top, 60)), 0.07, 0.6, 2, 1);
      fv.buffer(fv.bank.jingle, tc, tc + 0.45, fv.gain(0.15 + 0.03 * tier, fv.out), 1.05, false);
    });
    const music = this.music;
    if (tier === 1) {
      if (music) this.later(t, (td) => music.duck(0.75, td, 0.3, 0.3));
      return;
    }
    this.chord(land, 0.08, 1 + 0.2 * tier, 5);
    if (tier === 3) this.shimmer(land + 0.05, 16, 9, 0.045);
    if (!drop) return;
    if (tier === 3) this.later(land - DROP_S - 0.5, (ts) => this.swellUp(ts, 0.5, 0.1, 0, true));
    this.later(
      land - DROP_S,
      (td) => {
        music?.duck(0.12, td, DROP_S, 0.05, 0.006);
        this.bed?.(td, DROP_S, 0.25);
      },
      TIMELINE_LEAD,
    );
    this.later(land, (ts) => this.slam(ts, tier === 3), TIMELINE_LEAD);
  }

  /** A lost combo: the song trips (two stumbling kicks off the grid), a pad note sags a semitone
   *  from 500 at stake, and a sub drop on the tonic from 2,000. (The deflating glide is the raw
   *  comboLost's; the hard duck is the crash's.) */
  private comboLost(stake: number, t: number): void {
    const k = this.key();
    const v = this.voice(t, 0.1, 0, 1.2);
    thump(v, t, 120, 52, 0.26, 0.045);
    this.at(v, t + 0.085, (tn) => thump(v, tn, 100, 44, 0.2, 0.05));
    this.at(v, t + 0.23, (tn) => {
      thump(v, tn, 82, 36, 0.16, 0.07);
      puff(v, tn, 0.08, 900, 250, 0.06, v.bank.brown);
    });
    if (stake >= 500) {
      const r = fit(k.tonic + k.bright, 55);
      const g = v.gain(0, v.out);
      const end = swell(g.gain, t, 0.05, 0.03, 0.35, 0.18);
      const lp = v.filter('lowpass', 1500, 0.6, g);
      lp.frequency.setValueAtTime(1500, t);
      lp.frequency.exponentialRampToValueAtTime(500, t + 0.6);
      for (const [x, d] of [
        [0, -6],
        [7, 6],
      ] as const) {
        const f = mtof(r + x);
        const o = v.osc(v.bank.warmSaw, f, t, end, lp, d);
        o.frequency.setValueAtTime(f, t + 0.02);
        o.frequency.exponentialRampToValueAtTime(f * 0.9439, t + 0.42);
      }
    }
    if (stake >= 2000) {
      // The floor gives way: a sub on the tonic sliding down an octave.
      const f0 = mtof(fit(k.tonic, 33));
      const g = v.gain(0, v.out);
      const end = perc(g.gain, t, 0.42, 0.012, 0.3);
      const o = v.osc('sine', f0, t, end, g);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + 1.1);
      const hg = v.gain(0.12, g);
      const o2 = v.osc('triangle', f0 * 2, t, end, hg);
      o2.frequency.setValueAtTime(f0 * 2, t);
      o2.frequency.exponentialRampToValueAtTime(f0, t + 1.1);
    }
  }

  /** 'Best combo pace': a light gold-white chime, contour A (rising 1-3-5), glassy and quick. */
  private paceChime(t: number): void {
    const r = brightRoot(this.key(), 67);
    const v = this.voice(t, 0.45, 0.15, 1.3);
    [0, 4, 7].forEach((x, i) =>
      this.at(v, t + i * 0.085, (tn) => {
        fmBell(v, tn, mtof(r + x), 0.08, i === 2 ? 0.55 : 0.3, 3.5, 1.2);
        ping(v, tn, mtof(r + x + 12), 0.022, 0.1);
      }),
    );
  }

  /** New ground: a cymbal swell under contour B (5-3-1, then the leap to the 5 above) in round,
   *  low bells, and the bright chord as the swell peaks. */
  private newGround(t: number): void {
    this.swellUp(t, 0.6, 0.08);
    const r = brightRoot(this.key(), 60);
    const v = this.voice(t, 0.5, -0.1, 1.3);
    for (const [x, dt] of [
      [7, 0],
      [4, 0.11],
      [0, 0.22],
      [19, 0.36],
    ] as const) {
      this.at(v, t + dt, (tn) => fmBell(v, tn, mtof(r + x), x === 19 ? 0.1 : 0.075, x === 19 ? 0.9 : 0.3, 2, 1.1));
    }
    this.chord(t + 0.6, 0.07, 1.1, 5);
  }

  /** New best (mid-run): contour C, a two-note fanfare from the root to its octave, brass and bell. */
  private bestChime(t: number): void {
    const r = brightRoot(this.key(), 55);
    const v = this.voice(t, 0.4, 0, 1.3);
    this.brass(v, t, [r, r + 7], 0.14, 0.038);
    fmBell(v, t, mtof(r + 12), 0.08, 0.3, 3.5, 1.3);
    this.at(v, t + 0.17, (tn) => {
      this.brass(v, tn, [r + 12, r + 19, r + 24], 0.5, 0.04);
      fmBell(v, tn, mtof(r + 24), 0.11, 0.85, 3.5, 1.4);
    });
    this.shimmer(t + 0.22, 10, 10, 0.035);
  }

  /** A pass, voiced by its word. The ladder note climbs per shown pass (step 5 + n - 1) and holds at
   *  the top from the 8th, adding an octave instead of wrapping. Muted passes are silent. */
  private passBeat(b: BeatOf<'pass'>, t: number): void {
    if (b.muted || b.word === 'jostle') return;
    const n = Math.max(1, Math.round(b.ladder) || 1);
    const i = 5 + Math.min(n - 1, 7);
    const octave = b.octave || n > 8;
    const p = panOf(b.ghost.dx, 3, 0.6);
    if (b.word === 'beat') {
      // A wreck passed: the lantern chime, no rush of air.
      const v = this.voice(t, 0.55, p * 0.6);
      fmBell(v, t, this.note(9), 0.09, 0.25, 3.5, 1.1);
      fmBell(v, t + 0.06, this.note(11), 0.035, 0.45, 2.4, 0.8);
      return;
    }
    const v = this.voice(t, 0.3, p);
    if (v.pan) {
      v.pan.setValueAtTime(p, t);
      v.pan.linearRampToValueAtTime(p * 0.4, t + 0.35);
    }
    if (b.word === 'slung') whoosh(v, t, 0.3, 1200, 4200, 0.12, 1.2);
    else if (b.word === 'tookBack') {
      whoosh(v, t, 0.16, 2600, 900, 0.05, 1.2);
      whoosh(v, t + 0.1, 0.3, 700, 2400, 0.09, 1.1);
    } else whoosh(v, t, 0.35, 700, 2400, 0.1, 1.1);
    const tb = t + 0.06;
    if (b.word === 'yourBest') {
      // Your best overtaken: a gold-white bell pair and a shimmer.
      const r = brightRoot(this.key(), 67);
      fmBell(v, tb, mtof(r), 0.1, 0.5, 3.5, 1.2);
      fmBell(v, tb + 0.09, mtof(r + 12), 0.1, 0.8, 3.5, 1.3);
      this.shimmer(tb + 0.12, 6, 10, 0.035);
      return;
    }
    fmBell(v, tb, this.note(i), 0.1, 0.4, 2, 1.1);
    ping(v, tb, this.note(i + 5), 0.03, 0.15);
    if (octave) ping(v, tb + 0.03, this.note(i + 10), 0.028, 0.25);
    switch (b.word) {
      case 'slung':
        for (let j = 0; j < 3; j++) {
          const f = this.note(i - 2 + 2 * j);
          this.at(v, tb + 0.05 + j * 0.045, (tn) => pluck(v, tn, f, 0.09, 0.14, 3.5));
        }
        break;
      case 'double':
      case 'triple':
      case 'streak': {
        // Chains: the bell gains a third, then a fifth.
        const add = b.word === 'double' ? [2] : [2, 3];
        add.forEach((x, j) => {
          const f = this.note(i + x);
          this.at(v, tb + 0.05 * (j + 1), (tn) => fmBell(v, tn, f, 0.075, 0.4, 2, 1.1));
        });
        if (b.word === 'streak') this.shimmer(tb + 0.12, 6, 10, 0.03);
        break;
      }
      case 'duelWon':
      case 'heldOff': {
        const r = brightRoot(this.key(), 43);
        this.at(v, tb + 0.02, (tn) => this.brass(v, tn, [r, r + 7, r + 12], b.word === 'duelWon' ? 0.3 : 0.22, 0.045));
        if (b.word === 'heldOff') thump(v, tb, 90, 55, 0.18, 0.06);
        break;
      }
      default:
        break;
    }
  }

  /** A ghost overtakes you, on its side: the rush, then a falling pair. */
  private passedByBeat(b: BeatOf<'passedBy'>, t: number): void {
    if (b.muted) return;
    const p = panOf(b.ghost.dx, 3, -0.6);
    const v = this.voice(t, 0.4, p * 0.4);
    if (v.pan) {
      v.pan.setValueAtTime(p * 0.4, t);
      v.pan.linearRampToValueAtTime(p, t + 0.4);
    }
    whoosh(v, t, 0.4, 1800, 600, 0.08, 1);
    fmBell(v, t + 0.05, this.note(2), 0.06, 0.25, 2.4, 1);
    fmBell(v, t + 0.17, this.note(0), 0.06, 0.45, 2.4, 1);
  }

  /** Into the lead: a brass 1-3-5 stab, a timpani and a high bell. */
  private leadStab(t: number): void {
    const r = brightRoot(this.key(), 55);
    const v = this.voice(t, 0.4, 0, 1.2);
    this.brass(v, t, [r, r + 4, r + 7], 0.32, 0.04);
    thump(v, t, 98, 70, 0.2, 0.15);
    fmBell(v, t + 0.02, mtof(r + 24), 0.07, 0.7, 3.5, 1.3);
  }

  /** Race news: a distant thump and a mint sigh, panned to the ghost and fading with distance. */
  private raceNews(b: BeatOf<'raceNews'>, t: number): void {
    const g = clamp(Number.isFinite(b.gain) ? b.gain : 1, 0.15, 1);
    const pan = clamp(Number.isFinite(b.pan) ? b.pan : 0, -0.8, 0.8);
    const v = this.voice(t, 0.6, pan);
    if (b.news === 'unlockTease') {
      fmBell(v, t, this.note(5), 0.04, 0.3, 3.5, 1);
      fmBell(v, t + 0.12, this.note(7), 0.045, 0.6, 3.5, 1.1);
      return;
    }
    const wipe = b.news === 'wipeout' || b.news === 'wipeoutBehind';
    if (wipe) {
      thump(v, t, 70, 40, 0.14 * g, 0.09);
      puff(v, t, 0.06 * g, 700, 200, 0.12, v.bank.brown);
    }
    const s = wipe ? 0.05 : 0.04;
    fmBell(v, t + 0.08, this.note(4), s * g, 0.3, 2.4, 0.8);
    fmBell(v, t + 0.22, this.note(2), s * g, 0.55, 2.4, 0.8);
  }

  /** Duels: a low, tense call as one opens; brass when you win it; a sigh when it pulls away. */
  private duel(b: BeatOf<'duel'>, t: number): void {
    const p = panOf(b.ghost.dx, 3, 0) * 0.6;
    const v = this.voice(t, 0.35, p, 1.2);
    const r = brightRoot(this.key(), 43);
    switch (b.phase) {
      case 'open':
        fmBell(v, t, this.note(0), 0.06, 0.25, 2.4, 1);
        fmBell(v, t + 0.14, this.note(-1), 0.06, 0.45, 2.4, 1);
        thump(v, t, 64, 44, 0.2, 0.08);
        break;
      case 'won':
      case 'heldOff':
        fmBell(v, t, this.note(b.phase === 'won' ? 10 : 8), 0.09, 0.5, 3.5, 1.2);
        this.brass(v, t + 0.02, [r, r + 7, r + 12], 0.3, 0.045);
        this.shimmer(t + 0.1, 6, 10, 0.03);
        break;
      case 'lost':
        fmBell(v, t, this.note(3), 0.045, 0.3, 2.4, 0.8);
        fmBell(v, t + 0.16, this.note(1), 0.04, 0.5, 2.4, 0.8);
        break;
      default:
        break;
    }
  }

  /** The start-line call: a two-note 'vs' motif, coloured by who is waiting. */
  private raceCall(word: BeatOf<'raceCall'>['word'], t: number): void {
    const v = this.voice(t, 0.4, 0, 1.2);
    const second = word === 'Nemesis' ? -1 : word === 'Racing' ? 5 : 7;
    fmBell(v, t, this.note(0), 0.06, 0.3, 2, 1);
    fmBell(v, t + 0.12, this.note(second), 0.06, 0.55, 2, 1);
    if (word === 'Nemesis' || word === 'Rematch') thump(v, t + 0.12, 70, 42, word === 'Nemesis' ? 0.24 : 0.16, 0.1);
    if (word === 'Nemesis') this.brass(v, t + 0.12, [brightRoot(this.key(), 43)], 0.35, 0.035);
    if (word === 'Racing') this.shimmer(t + 0.16, 6, 10, 0.025);
  }

  /** Grudge settled: the chord turns from minor to major 0.22 s later, on a timpani. A nemesis
   *  down adds brass and a shimmer. */
  private grudge(nemesis: boolean, t: number): void {
    const r = brightRoot(this.key(), 55);
    const v = this.voice(t, 0.5, 0, 1.3);
    [0, 3, 7].forEach((x, i) => fmBell(v, t + i * 0.018, mtof(r + x), 0.065, 0.3, 2, 1));
    this.at(v, t + 0.22, (tn) => {
      [0, 4, 7, 12].forEach((x, i) => fmBell(v, tn + i * 0.018, mtof(r + x), 0.08, 0.9, 2, 1.1));
      thump(v, tn, 98, 70, 0.3, 0.22);
      if (nemesis) this.brass(v, tn, [r, r + 7, r + 12, r + 16], 0.7, 0.045);
    });
    if (nemesis) this.shimmer(t + 0.3, 14, 9, 0.04);
  }

  /** A friend's distance beaten: a mint chime (the ghosts' rounder bell) with sleigh bells. */
  private friendChime(t: number): void {
    const v = this.voice(t, 0.5, 0.1, 1.3);
    [5, 8, 10].forEach((s, i) => {
      const f = this.note(s);
      this.at(v, t + i * 0.07, (tn) => fmBell(v, tn, f, 0.085, i === 2 ? 0.8 : 0.35, 2.4, 1.1));
    });
    v.buffer(v.bank.jingle, t + 0.14, t + 0.6, v.gain(0.14, v.out), 1.1, false);
    this.shimmer(t + 0.2, 10, 10, 0.03);
  }

  /** Event finales. The avalanche escape is the raw success event's (drop-out, then slam and
   *  fanfare); the yeti hop's brass is its style event's. */
  private finale(b: BeatOf<'finale'>, t: number): void {
    const g = b.grade > 1 ? clamp(b.grade / 3, 0, 1) : clamp(b.grade, 0, 1);
    const r = brightRoot(this.key(), 55);
    switch (b.outcome) {
      case 'caught': {
        // Gift Storm: a cascade whose length follows the share caught.
        const v = this.voice(t, 0.4, 0.2, 1.2);
        const count = 3 + Math.round(6 * g);
        for (let j = 0; j < count; j++) {
          const f = this.note(4 + j);
          this.at(v, t + j * 0.055, (tn) => fmBell(v, tn, f, 0.06 + 0.004 * j, 0.3, 2, 1));
        }
        v.buffer(v.bank.jingle, t, t + 0.45, v.gain(0.16, v.out), 1, false);
        if (g >= 0.75) this.chord(t + count * 0.055, 0.075, 1, 5);
        break;
      }
      case 'hopped': {
        const v = this.voice(t, 0.3, 0, 1.2);
        thump(v, t, 98, 66, 0.3, 0.22);
        this.shimmer(t + 0.08, 12, 9, 0.04);
        break;
      }
      case 'dodged': {
        // A low brass 'ha'.
        const v = this.voice(t, 0.3, 0, 1.2);
        this.brass(v, t, [r - 12, r - 5], 0.16, 0.05);
        fmBell(v, t + 0.02, mtof(r + 12), 0.06, 0.35, 3.5, 1.1);
        break;
      }
      case 'rode': {
        const v = this.voice(t, 0.6, -0.2, 1.2);
        this.whistle(v, t, fit(this.key().tonic, 60), this.ctx.sampleRate);
        fmBell(v, t, mtof(r + 12), 0.07, 0.8, 2.4, 1);
        fmBell(v, t + 0.12, mtof(r + 19), 0.07, 0.9, 2.4, 1);
        break;
      }
      case 'passed': {
        const v = this.voice(t, 0.6, 0.3);
        fmBell(v, t, this.note(2), 0.04, 0.4, 2.4, 0.8);
        fmBell(v, t + 0.18, this.note(0), 0.04, 0.7, 2.4, 0.8);
        break;
      }
      default:
        break;
    }
  }

  /** A kilometre arch: a milestone bell, placed on the next beat by the engine. */
  km(t: number): void {
    const r = brightRoot(this.key(), 55);
    const v = this.voice(t, 0.6, 0, 1.2);
    fmBell(v, t, mtof(r + 24), 0.085, 1.1, 3.5, 1.3);
    fmBell(v, t, mtof(r + 12), 0.06, 1.4, 2, 1);
    v.buffer(v.bank.jingle, t, t + 0.4, v.gain(0.08, v.out), 0.9, false);
  }

  /** A ghost's trick nearby: a soft ping on its side (a stomp), or a whisper of one (a spin or flip). */
  private ghostTrick(b: BeatOf<'ghostTrick'>, t: number): void {
    if (b.quality === 'sketchy') return;
    const p = panOf(b.ghost.dx, 8, 0);
    const v = this.voice(t, 0.5, p);
    if (b.quality === 'perfect') fmBell(v, t, this.note(10), 0.03, 0.35, 2, 1);
    else if (b.word) fmBell(v, t, this.note(8), 0.02, 0.25, 2.4, 0.8);
  }

  /** The stomp metronome as the landing ring closes: soft ticks (steps 3, 4), then the open note
   *  (step 5) as the stomp window opens. Dry and centred, well under the style chimes. */
  private stompTick(step: number, open: boolean, t: number): void {
    const s = Number.isFinite(step) ? Math.max(0, Math.min(10, Math.round(step))) : 3;
    if (open) {
      const v = this.voice(t, 0.12);
      fmBell(v, t, this.note(s), 0.045, 0.22, 2, 1);
      return;
    }
    const v = this.voice(t, 0.02);
    ping(v, t, this.note(s), 0.03, 0.03);
    this.click(v, t, 0.015);
  }

  /** Through a graveyard alive: a low bell and a gift chime. */
  private graveyard(t: number): void {
    const v = this.voice(t, 0.6, 0, 1.2);
    fmBell(v, t, this.note(-3), 0.06, 0.8, 2.4, 1);
    fmBell(v, t + 0.15, this.note(5), 0.07, 0.5, 2, 1);
    fmBell(v, t + 0.21, this.note(7), 0.08, 0.6, 2, 1);
  }

  // ---------------------------------------------------------------- grid pulses

  /**
   * Pulses quantised to the band's 16th-note grid, scheduled inside the lookahead: the fuse ticks
   * on a big draining stake (8ths, then 16ths past half, climbing ladder steps 6 to 10) and the duel
   * heartbeat (a lub on every quarter note, the dub a 16th later). At most one tick per 16th (about
   * 7.5 Hz at 112 bpm).
   */
  pulses(now: number, until: number, grid: { t0: number; dur: number } | null, fuse: number, duel: number): void {
    if (!grid || !(grid.dur > 0)) return;
    const { t0, dur } = grid;
    if (fuse > 0.001) {
      const div = fuse < 0.5 ? 2 : 1;
      let s = Math.ceil((Math.max(now + 0.005, this.fuseLast + dur * 0.5) - t0) / dur);
      s = Math.ceil(s / div) * div;
      for (let tt = t0 + s * dur; tt < until; s += div, tt = t0 + s * dur) {
        this.fuseTick(tt, fuse);
        this.fuseLast = tt;
      }
    }
    if (duel > 0.001) {
      let s = Math.ceil((Math.max(now + 0.005, this.heartLast + dur * 2) - t0) / dur);
      s = Math.ceil(s / 4) * 4;
      for (let tt = t0 + s * dur; tt < until; s += 4, tt = t0 + s * dur) {
        this.heartbeat(tt, dur, duel);
        this.heartLast = tt;
      }
    }
  }

  private fuseTick(t: number, fuse: number): void {
    const v = this.voice(t, 0.04);
    ping(v, t, this.note(6 + Math.round(4 * clamp(fuse, 0, 1))), 0.026 + 0.02 * fuse, 0.022);
    this.click(v, t, 0.012 + 0.008 * fuse);
  }

  private heartbeat(t: number, dur: number, duel: number): void {
    const a = 0.07 * (0.6 + 0.6 * clamp(duel, 0, 1));
    const v = this.voice(t, 0.04);
    thump(v, t, 58, 44, a, 0.05);
    puff(v, t, a * 0.35, 320, 120, 0.035, v.bank.brown);
    const td = t + dur;
    this.at(v, td, (tn) => {
      thump(v, tn, 52, 40, a * 0.8, 0.06);
      puff(v, tn, a * 0.28, 280, 110, 0.04, v.bank.brown);
    });
  }
}
