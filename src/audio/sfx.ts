import { ChaosEvent } from '../sim/chaos';
import type { StyleKind } from '../sim/scoring';
import type { CrashCause, LandQuality, SimEvent, TakeoffKind } from '../sim/sim';
import type { UiSound } from './engine';
import type { Bus } from './graph';
import { crumble, fmBell, mallet, ping, pluck, puff, thump, whoosh } from './instruments';
import { BRIGHT_ARP, BRIGHT_VOICING, Key, brightRoot, fit, ladder, mtof } from './theory';
import { Voice, VoicePool, bandComp, clamp, perc, rand, swell } from './voices';

// One-shot sound effects for sim events and UI. Every tonal reward is drawn from the current key's
// pentatonic ladder (see theory.ts), so rewards harmonise with whatever the soundtrack plays.

/** Style notes are spaced this far apart when several land on one tick, so they arpeggiate. */
const STYLE_GAP = 0.06;
/** Parts of a sound starting further ahead than this are built by a later scheduler pass, so a
 *  big reward spreads its node creation over several frames instead of hitching one. */
const DEFER = 0.08;

interface Job {
  t: number;
  v: Voice | null;
  fn: (t: number) => void;
}

export class Sfx {
  private styleNext = 0;
  private giftStreak = 0;
  private lastGift = -10;
  private readonly jobs: Job[] = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly pool: VoicePool,
    private readonly bus: Bus,
    private readonly key: () => Key,
  ) {}

  reset(): void {
    this.styleNext = 0;
    this.giftStreak = 0;
    this.lastGift = -10;
  }

  /** Drops deferred parts, so a reward cut off by a mute (an ad) does not finish after it. */
  clearPending(): void {
    this.jobs.length = 0;
  }

  /** Scheduler pass: build deferred parts that are now close. */
  flush(now: number): void {
    for (let i = 0; i < this.jobs.length; ) {
      const j = this.jobs[i];
      if (j.t - now < DEFER) {
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
        this.style(e.kind, e.chain, e.mult, t);
        break;
      case 'comboBank':
        this.bank(e.points, t);
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
  }

  ui(name: UiSound, detail: number, t: number): void {
    const d = Number.isFinite(detail) ? Math.max(0, Math.floor(detail)) : 0;
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
        const v = this.voice(t, 0.08);
        ping(v, t, this.note(9 + (d % 3)), 0.07, 0.025);
        this.click(v, t, 0.025);
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
  private later(t: number, fn: (t: number) => void): void {
    if (t - this.ctx.currentTime < DEFER) fn(t);
    else this.jobs.push({ t, v: null, fn });
  }

  /** Like later(), for a part added to an existing voice; the voice is kept alive meanwhile. */
  private at(v: Voice, t: number, fn: (t: number) => void): void {
    if (t - this.ctx.currentTime < DEFER) fn(t);
    else {
      v.hold(t + 0.1);
      this.jobs.push({ t, v, fn });
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

  /** Bright major add9 bell chord, strummed upward. */
  private chord(t: number, amp: number, tau: number, count: number): void {
    const r = brightRoot(this.key(), 52);
    this.later(t, (tc) => {
      const v = this.voice(tc, 0.55);
      for (let i = 0; i < Math.min(count, BRIGHT_VOICING.length); i++) {
        const ti = tc + i * 0.02;
        const f = mtof(r + BRIGHT_VOICING[i]);
        if (i < 2) fmBell(v, ti, f, amp * 1.15, tau * 1.2, 2, 1);
        else fmBell(v, ti, f, amp, tau, 3.5, 1.5);
      }
    });
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
    if (!late) {
      const v = this.voice(t, 0.06);
      thump(v, t, 72, 36, 0.48, 0.11);
      puff(v, t, 0.16, 3200, 800, 0.1);
      this.click(v, t, 0.1);
    }
    // The payoff: a major add9 bell chord over a soft bloom, then a rising shimmer.
    this.chord(t + 0.012, 0.085, 0.85, 5);
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

  private style(kind: StyleKind, chain: number, mult: number, t0: number): void {
    let t = Math.max(t0, this.styleNext);
    if (t > t0 + 0.35) t = t0 + 0.35;
    this.styleNext = t + STYLE_GAP;
    // The chain climbs the pentatonic ladder; past the top it keeps circling the top octave.
    let i = Math.max(0, chain - 1);
    if (i > 12) i = 8 + ((i - 8) % 5);
    const f = this.note(i);
    const vel = 0.8 + Math.min(mult, 10) * 0.02;
    const v = this.voice(t, 0.3, rand(-0.25, 0.25), 1.6);
    switch (kind) {
      case 'nearMiss':
        whoosh(v, t, 0.2, 900, 3400, 0.1, 1.4);
        ping(v, t + 0.03, f, 0.12 * vel, 0.04);
        ping(v, t + 0.03, f * 2, 0.05, 0.015);
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
      case 'yetiHop':
      case 'avalanche': {
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
    const v = this.voice(t, 0.05, rand(-0.2, 0.2));
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
      whoosh(this.voice(t, 0.15), t, 0.5, 600, 3800, 0.14 + tier * 0.025, 1);
    }
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
      this.fanfare(t);
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
}
