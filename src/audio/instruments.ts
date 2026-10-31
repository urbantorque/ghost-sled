import type { LeadKind } from './theory';
import { Voice, bandComp, blockRate, perc, swell } from './voices';

// Instrument recipes shared by the soundtrack and the sound effects. Each one adds nodes to a voice,
// starting at time t, and returns the time it falls silent. `amp` is roughly the peak it reaches.
// `dest` is where the part's envelope gain feeds (the voice's out by default); null puts the envelope
// on the voice's out itself (Voice.envelope), for a voice that holds this one part: the soundtrack's
// notes, one voice each, so a note costs a node less.

/** Two-operator FM bell. The modulation index decays faster than the tone, so the strike is
 *  bright and the tail mellow. Ratio 3.5 rings like a bell, 2 like a ding, 5 like a music box. */
export function fmBell(v: Voice, t: number, f: number, amp: number, tau: number, ratio = 3.5, index = 1.4, dest: AudioNode | null = v.out): number {
  const g = v.envelope(dest);
  const end = perc(g.gain, t, amp, 0.002, tau);
  const car = v.osc('sine', f, t, end, g);
  const mf = f * ratio;
  const mg = v.gain(0, car.frequency);
  mg.gain.setValueAtTime(index * mf, t);
  mg.gain.setTargetAtTime(index * mf * 0.1, t, tau * 0.3);
  v.osc('sine', mf, t, end, mg);
  return end;
}

/** Plain sine with a fast attack: shimmer grains and ticks. */
export function ping(v: Voice, t: number, f: number, amp: number, tau: number, dest: AudioNode = v.out): number {
  const g = v.gain(0, dest);
  const end = perc(g.gain, t, amp, 0.0015, tau);
  v.osc('sine', f, t, end, g);
  return end;
}

/** Synth pluck: warm saws through a lowpass that snaps shut. Effects use a detuned pair; the
 *  soundtrack passes `pair = false` for one oscillator, since it plucks every 16th. `bend` starts
 *  the pitch slightly sharp and falls into tune (koto-like). */
export function pluck(v: Voice, t: number, f: number, amp: number, tau: number, bright = 3, dest: AudioNode | null = v.out, bend = 0, pair = true): number {
  const g = v.envelope(dest);
  const end = perc(g.gain, t, amp * (pair ? 0.55 : 0.78), 0.003, tau);
  // Capped: high combo notes would pass Nyquist, which Chrome clamps with a console warning.
  const open = Math.min(f * bright * 4, 12000);
  const lp = v.filter('lowpass', open, 0.9, g);
  lp.frequency.setValueAtTime(open, t);
  lp.frequency.setTargetAtTime(Math.max(f * 1.2, 150), t + 0.004, tau * 0.35);
  const oscs = [v.osc(v.bank.warmSaw, f, t, end, lp, pair ? -6 : 0)];
  if (pair) oscs.push(v.osc(v.bank.warmSaw, f, t, end, lp, 6));
  if (bend) {
    for (const o of oscs) {
      o.frequency.setValueAtTime(f * (1 + bend), t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    }
  }
  return end;
}

/** Marimba-like mallet: fundamental plus the quickly fading 3.93x overtone. */
export function mallet(v: Voice, t: number, f: number, amp: number, tau: number, dest: AudioNode = v.out): number {
  const g1 = v.gain(0, dest);
  const end = perc(g1.gain, t, amp, 0.002, tau);
  v.osc('sine', f, t, end, g1);
  const g2 = v.gain(0, dest);
  const e2 = perc(g2.gain, t, amp * 0.35, 0.001, tau * 0.16);
  v.osc('sine', f * 3.93, t, e2, g2);
  return end;
}

/** Sustained melodic voice with delayed vibrato. */
export function lead(v: Voice, t: number, f: number, dur: number, amp: number, kind: LeadKind, dest: AudioNode | null = v.out): number {
  const g = v.envelope(dest);
  const att = kind === 'square' ? 0.02 : kind === 'flute' ? 0.05 : 0.09;
  const rel = kind === 'theremin' ? 0.16 : 0.08;
  const end = swell(g.gain, t, amp, att, Math.max(0.02, dur - att), rel);
  const lp = v.filter('lowpass', kind === 'square' ? 2300 : 3400, 0.5, g);
  const wave: OscillatorType | PeriodicWave = kind === 'square' ? v.bank.hollow : kind === 'flute' ? 'triangle' : 'sine';
  const o = v.osc(wave, f, t, end, lp);
  const vg = v.gain(0, o.frequency);
  const depth = f * (kind === 'theremin' ? 0.014 : 0.0045);
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(depth, t + Math.min(0.3, dur * 0.6));
  v.osc('sine', kind === 'theremin' ? 5.1 : 5.6, t, end, vg);
  if (kind === 'flute') {
    // Breath: a whisper of band-passed noise at the note.
    const bg = v.gain(0, g);
    swell(bg.gain, t, 0.5 * bandComp(f * 2, 3, v.ctx.sampleRate), att, Math.max(0.02, dur - att), rel);
    const bp = v.filter('bandpass', f * 2, 3, bg);
    v.buffer(v.bank.white, t, end, bp);
  }
  return end;
}

/** One sung note of the ghost choir. */
export interface Sung {
  g: GainNode;
  oscs: OscillatorNode[];
  f: number;
  end: number;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** A choir voice's vowel: three fixed formant band-passes at their levels, from `input` into a dest. */
export interface Formants {
  readonly input: GainNode;
  readonly nodes: readonly AudioNode[];
}

/**
 * The vowel of a ghost choir voice: three formant band-passes ('oo' toward 'ah' as `bright` goes 0
 * to 1) summed into `dest`. The filters never move, so one chain serves every note that voice
 * sings, built once per deck: a note's swell feeds it (the formants ring out within 4 ms; a swell
 * moves over a third of a second and more, so shaping the note before the formants instead of
 * after them is the same sound), and a note costs its oscillators and its envelope only.
 */
export function formants(ctx: BaseAudioContext, bright: number, dest: AudioNode): Formants {
  const b = clamp01(bright);
  const input = ctx.createGain();
  const nodes: AudioNode[] = [input];
  for (const [fc, q, lvl] of [
    [320 + 480 * b, 5, 1],
    [800 + 400 * b, 7, 0.55],
    [2700, 10, 0.15],
  ] as const) {
    const bp = blockRate(ctx.createBiquadFilter());
    bp.type = 'bandpass';
    bp.frequency.value = fc;
    bp.Q.value = q;
    input.connect(bp);
    nodes.push(bp);
    if (lvl === 1) bp.connect(dest);
    else {
      const g = ctx.createGain();
      g.gain.value = lvl;
      bp.connect(g);
      g.connect(dest);
      nodes.push(g);
    }
  }
  return { input, nodes };
}

/**
 * A sung vowel for the ghost choir: two detuned warm saws and a triangle with a slow swell and a
 * vibrato that blooms in after the attack, on a voice whose out feeds that voice's vowel
 * (formants(), the same `bright`: 0..1 from 'oo' toward 'ah'). The swell is the voice's out.
 * `sigh()` bends a note down and lets it go.
 */
export function sing(v: Voice, t: number, f: number, dur: number, amp: number, attack: number, bright: number): Sung {
  const g = v.envelope(null);
  const end = swell(g.gain, t, amp, attack, Math.max(0, dur - attack), 0.35);
  const b = clamp01(bright);
  const vib = v.gain(0, null);
  vib.gain.setValueAtTime(0, t);
  vib.gain.linearRampToValueAtTime(14, t + attack + 0.6);
  v.osc('sine', 4.6 + 0.8 * b, t, end, vib);
  const oscs = [v.osc(v.bank.warmSaw, f, t, end, g, -6), v.osc(v.bank.warmSaw, f, t, end, g, 6), v.osc('triangle', f * 2, t, end, v.gain(0.3, g))];
  for (const o of oscs) vib.connect(o.detune);
  return { g, oscs, f, end };
}

/** A choir note retaken: it slides down a fourth over 0.6 s as it fades (a sigh). */
export function sigh(s: Sung, now: number): void {
  const t = Math.max(now, 0);
  for (const o of s.oscs) {
    const f0 = o.frequency.value;
    o.frequency.cancelScheduledValues(t);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.749, t + 0.6);
  }
  const p = s.g.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.setTargetAtTime(0, t + 0.12, 0.22);
}

/** A choir note leaving quietly (its ghost fell out of range or wiped out). */
export function fadeSung(s: Sung, now: number): void {
  const p = s.g.gain;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.setTargetAtTime(0, now, 0.3);
}

/** Warm pad chord through a slowly opening lowpass: one warm saw per note, detuned alternately
 *  sharp and flat for width, plus a triangle under the root (freqs[0]) for body. The oscillators'
 *  mix level (0.75 over the note count) rides on the swell: a constant gain before the lowpass is
 *  the same as one after it, and saves a node. */
export function pad(v: Voice, t: number, freqs: readonly number[], dur: number, amp: number, cutoff: number, attack: number, detune: number, wobble: number, dest: AudioNode | null = v.out): number {
  const g = v.envelope(dest);
  const end = swell(g.gain, t, amp * (0.75 / Math.max(1, freqs.length)), attack, Math.max(0, dur - attack), 0.45);
  const lp = v.filter('lowpass', cutoff * 0.55, 0.6, g);
  lp.frequency.setValueAtTime(cutoff * 0.55, t);
  lp.frequency.linearRampToValueAtTime(cutoff, t + attack + dur * 0.5);
  lp.frequency.linearRampToValueAtTime(cutoff * 0.7, end);
  let wob: GainNode | null = null;
  if (wobble > 0) {
    // One slow LFO (in cents) bends every oscillator together: a seasick, haunted pad.
    wob = v.gain(wobble, null);
    v.osc('sine', 0.9, t, end, wob);
  }
  const oscs = freqs.map((f, i) => v.osc(v.bank.warmSaw, f, t, end, lp, i % 2 === 0 ? -detune : detune));
  if (freqs.length > 0) oscs.push(v.osc('triangle', freqs[0], t, end, lp, detune * 0.5));
  if (wob) for (const o of oscs) wob.connect(o.detune);
  return end;
}

/** A sine kick with a click of noise high-passed at 2 kHz (the bank's kickNoise, filtered once). */
export function kick(v: Voice, t: number, amp: number, low = 46, dest: AudioNode = v.out): number {
  const g = v.gain(0, dest);
  const end = perc(g.gain, t, amp, 0.002, 0.085);
  const o = v.osc('sine', 150, t, end, g);
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(low, t + 0.07);
  const cg = v.gain(0, dest);
  const ce = perc(cg.gain, t, amp * 0.22, 0.0008, 0.004);
  v.buffer(v.bank.kickNoise, t, ce, cg);
  return end;
}

/** A hi-hat: noise high-passed at 7.2 kHz (the bank's hatNoise, filtered once, not per hit). */
export function hat(v: Voice, t: number, amp: number, open: boolean, dest: AudioNode | null = v.out): number {
  const g = v.envelope(dest);
  const end = perc(g.gain, t, amp * 2.2, 0.001, open ? 0.06 : 0.016);
  v.buffer(v.bank.hatNoise, t, end, g);
  return end;
}

/** Soft clap: three quick noise bursts and a short tail. */
export function clap(v: Voice, t: number, amp: number, dest: AudioNode | null = v.out): number {
  const g = v.envelope(dest);
  const p = g.gain;
  const a = amp * bandComp(1400, 1.1, v.ctx.sampleRate) * 0.9;
  p.setValueAtTime(0, t);
  for (let k = 0; k < 3; k++) {
    const tk = t + k * 0.011;
    p.setValueAtTime(a * (1 - k * 0.15), tk);
    p.setTargetAtTime(0, tk + 0.001, 0.0035);
  }
  p.setValueAtTime(a * 0.75, t + 0.033);
  p.setTargetAtTime(0, t + 0.034, 0.055);
  const end = t + 0.034 + 0.055 * 5.5;
  const bp = v.filter('bandpass', 1400, 1.1, g);
  v.buffer(v.bank.white, t, end, bp);
  return end;
}

/** Band-passed noise sweep from f0 to f1. */
export function whoosh(v: Voice, t: number, dur: number, f0: number, f1: number, amp: number, q = 1, buf: AudioBuffer = v.bank.white, dest: AudioNode = v.out): number {
  const g = v.gain(0, dest);
  const a = amp * bandComp(Math.sqrt(f0 * f1), q, v.ctx.sampleRate);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(a, t + dur * 0.45);
  g.gain.setTargetAtTime(0, t + dur * 0.45, dur * 0.18);
  const end = t + dur * 0.45 + dur * 0.18 * 5.5;
  const bp = v.filter('bandpass', f0, q, g);
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  v.buffer(buf, t, end, bp);
  return end;
}

/** Sine with a pitch drop: landings, impacts, stamps. */
export function thump(v: Voice, t: number, f0: number, f1: number, amp: number, tau: number, dest: AudioNode = v.out): number {
  const g = v.gain(0, dest);
  const end = perc(g.gain, t, amp, 0.003, tau);
  const o = v.osc('sine', f0, t, end, g);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + tau * 2.5);
  return end;
}

/** Low-passed noise burst whose cutoff closes: powder, snow, dust. */
export function puff(v: Voice, t: number, amp: number, f0: number, f1: number, tau: number, buf: AudioBuffer = v.bank.pink, dest: AudioNode = v.out): number {
  const g = v.gain(0, dest);
  const end = perc(g.gain, t, amp * 1.6, 0.004, tau);
  const lp = v.filter('lowpass', f0, 0.7, g);
  lp.frequency.setValueAtTime(f0, t);
  lp.frequency.setTargetAtTime(f1, t + 0.004, tau * 0.8);
  v.buffer(buf, t, end, lp);
  return end;
}

/** Granular noise: band-passed noise chopped by the grain train. `rate` sets grain density. */
export function crumble(v: Voice, t: number, amp: number, centre: number, q: number, rate: number, tau: number, buf: AudioBuffer = v.bank.pink, dest: AudioNode = v.out): number {
  const g = v.gain(0, dest);
  const end = perc(g.gain, t, amp * bandComp(centre, q, v.ctx.sampleRate) * 1.8, 0.004, tau);
  const am = v.gain(0, g);
  v.buffer(v.bank.grains, t, end, am.gain, rate);
  const bp = v.filter('bandpass', centre, q, am);
  v.buffer(buf, t, end, bp);
  return end;
}
