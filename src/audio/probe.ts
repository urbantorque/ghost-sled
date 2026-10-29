import type { Beat } from '../game/beats';
import { intensity } from '../game/intensity';
import { ChaosEvent, Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import type { SimEvent } from '../sim/sim';
import { Core } from './core';
import type { AudioFrame } from './engine';

// Probe-only offline renders of scripted mixes through the same Core the game plays (loaded on
// demand by engine.debugRender, so it costs the game nothing). scripts/playtest/levels.js calls it to
// check the mix levels headless:
//   cruise    the whole mix at a novice cruise (20 m/s, x1, no tricks): about -27 dBFS RMS
//   ambience  the same with the music off: the wind and snow bed, near -33 dBFS RMS
//   music     the same with the effects bus off
//   stress    everything at once: full band, avalanche, boost, drift whine, shoulder hiss, fuse and
//             heartbeat, and a burst of rewards every quarter second (streak-5 stomps, tier-3 banks,
//             passes, whiskers, gifts). The peak after the limiter must stay under -3 dBFS, and the
//             voice-steal counters show the pools' headroom.
// Levels are in dBFS, measured after the first 2 s (the decks fade in over 1.2 s).

const SR = 48000;
/** Scheduler passes every 50 ms (the game's runs every 25 ms; the 0.12 s lookahead covers both). */
const STEP = 0.05;
const LOOKAHEAD = 0.12;

const db = (x: number): number => (x > 1e-9 ? 20 * Math.log10(x) : -180);

function baseFrame(t: number): AudioFrame {
  const speed = Math.min(20, 8 + t * 6);
  return {
    speed,
    grounded: true,
    carve: 0.25 + 0.2 * Math.sin(t * 1.3),
    drifting: false,
    slip: 0,
    onIce: false,
    boostGlow: 0,
    drafting: false,
    comboChain: 0,
    comboMult: 1,
    intensity: intensity({ speed, mult: 1, skillChain: 0, earnedFlow: 0, raceNear: false, danger: 0, eventRolled: false, lift: 0, runTime: t + 6, countIn: false }),
    danger: 0,
    crashed: false,
  };
}

function stressFrame(t: number): AudioFrame {
  return {
    speed: 42,
    grounded: true,
    carve: 1,
    drifting: true,
    slip: 0.7,
    onIce: false,
    boostGlow: 1,
    drafting: false,
    comboChain: 40,
    comboMult: 10,
    intensity: 1,
    danger: 0.9,
    crashed: false,
    flow: 1,
    driftCharge: 1,
    skillMult: 10,
    race: 1,
    duel: 1,
    // The shoulder hiss is off under danger; keep it in the mix for the second half instead.
    shoulder: t > 5 ? { amt: 1, pan: -0.6 } : null,
    fuse: 1,
    streak: 5,
  };
}

const ghost = (dx: number) => ({ id: 1, name: 'Probe', kind: 'pool' as const, dx });

/**
 * The busiest stretch a run can stack up, one moment every 0.25 s on top of gift pickups: a streak-5
 * stomp, a whisker, a double pass, a tier-3 drift crack, then a Massive bank (its roll, drop and
 * slam) landing under a nemesis settled, a streak-5 stomp and a whisker at once.
 */
function burst(core: Core, t: number, n: number): void {
  const beats: Beat[] = [];
  const events: SimEvent[] = [{ type: 'gift', id: n, value: 5, x: 0, y: 0, z: 0 }, { type: 'style', kind: 'gift', points: 50, chain: 12 + n, mult: 10 }];
  const stomp = (): void => {
    beats.push({ type: 'stomp', tick: 0, streak: 5, late: false, title: 'Stomp streak 5', lead: [], x: 0, z: 0, heading: 0, yetiHop: false });
    events.push({ type: 'style', kind: 'perfect', points: 400, chain: 10 + n, mult: 10 }, { type: 'land', quality: 'perfect', airtime: 1.4, halfTurns: 2, flips: 1, impact: 9, late: false });
  };
  const whisker = (): void => {
    beats.push({ type: 'nearMiss', tick: 0, grade: 'whisker', gap: 0.1, side: n % 2 ? 1 : -1, x: 0, z: 0, obs: 'pine', speed: 30 });
    events.push({ type: 'style', kind: 'nearMiss', points: 120, chain: 11 + n, mult: 10 });
  };
  switch (n % 8) {
    case 0:
      stomp();
      if (n > 0) {
        // On the last bank's slam: everything at once.
        whisker();
        beats.push({ type: 'grudgeSettled', tick: 0, ghost: ghost(1), nemesis: true, after: 3, paid: 20 });
      }
      break;
    case 1:
      whisker();
      break;
    case 2:
      beats.push({ type: 'pass', tick: 0, ghost: ghost(2), word: 'double', text: 'Double pass', first: true, chain: 2, ladder: 3 + n, octave: n > 6, gifts: 7, muted: false });
      break;
    case 3:
      events.push({ type: 'drift', phase: 'release', tier: 3 }, { type: 'boost', amount: 9, source: 'drift' }, { type: 'style', kind: 'drift', points: 700, chain: 13 + n, mult: 10 });
      core.ambience.whineRelease(t);
      break;
    case 4:
      beats.push({ type: 'bank', tick: 0, points: 24000, mult: 10, origin: 2400, tier: 3, header: 'Massive', bump: false });
      events.push({ type: 'comboBank', points: 24000, mult: 10 });
      break;
    case 5:
      beats.push({ type: 'pass', tick: 0, ghost: ghost(-2), word: 'slung', text: 'Slung past', first: true, chain: 0, ladder: 4 + n, octave: n > 6, gifts: 7, muted: false });
      break;
    default:
      break;
  }
  core.sfx.frame();
  for (const b of beats) core.sfx.beat(b, t);
  for (const e of events) core.sfx.event(e, t);
}

/** One moment on the cruise mix at MOMENT_T, for the envelope probes. */
const MOMENT_T = 3;

const SNUFF: Beat = { type: 'flow', tick: 0, phase: 'snuff', say: { label: 'Flow broken', points: 0, tone: 'normal' } };
/** The snuff a broken streak or a crash brings: no line of its own (theirs says it). */
const SNUFF_QUIET: Beat = { type: 'flow', tick: 0, phase: 'snuff' };
const SKETCHY_LAND: SimEvent = { type: 'land', quality: 'sketchy', airtime: 0.9, halfTurns: 1, flips: 0, impact: 8, late: false };

/**
 * 'Flow broken' where it now lands (the snuff also comes on a sketchy landing and on a lost combo, not
 * only on a bump), each against the same moment without it. `part` renders the snuff alone (no bed),
 * the rest alone, or both. The flow-then kinds put 'In the flow' first and the snuff 0.35 s (a sketchy
 * landing) or 0.4 s (a crash) later, inside the flow-in's 0.6 s swell.
 */
type SnuffPart = 'all' | 'snuff' | 'rest' | 'flowOnly' | 'noFlow';
const SNUFF_KINDS: Record<string, { snuffAt: number; crash: boolean; flowIn: boolean }> = {
  snuffSketchy: { snuffAt: 0, crash: false, flowIn: false },
  snuffBroken: { snuffAt: 0, crash: false, flowIn: false },
  snuffLost: { snuffAt: 0, crash: true, flowIn: false },
  snuffBump: { snuffAt: 0, crash: false, flowIn: false },
  flowSnuff: { snuffAt: 0.35, crash: false, flowIn: true },
  flowCrash: { snuffAt: 0.4, crash: true, flowIn: true },
};

/** The snuff moment's beats and raw events, as the director pushes them (the snuff follows what broke
 *  it; a sketchy landing that snuffs says 'Flow broken' instead of 'Sketchy', so its list is the
 *  snuff alone, and a broken streak or a crash keeps its own line and the snuff has none). */
function snuffMoment(kind: string): { beats: Beat[]; events: SimEvent[] } {
  if (kind === 'snuffSketchy' || kind === 'flowSnuff') return { beats: [SNUFF], events: [SKETCHY_LAND] };
  if (kind === 'snuffBroken') return { beats: [{ type: 'streakBroken', tick: 0, was: 4, say: { label: 'Streak broken', points: 0, tone: 'lost' } }, SNUFF_QUIET], events: [SKETCHY_LAND] };
  if (kind === 'snuffBump') return { beats: [{ type: 'bump', tick: 0, side: 1, bank: true }, { type: 'bank', tick: 0, points: 6000, mult: 4, origin: 1500, tier: 2, header: null, bump: true }, SNUFF], events: [{ type: 'bump', id: 1 }, { type: 'comboBank', points: 6000, mult: 4 }] };
  // A crash with 2,500 on the line and the flow it had earned.
  return { beats: [{ type: 'comboLost', tick: 0, points: 500, stake: 2500, best: false, crack: true }, SNUFF_QUIET, { type: 'crash', tick: 0, cause: 'tree', stake: 2500, orbitFrom: null }], events: [{ type: 'comboLost', points: 500 }, { type: 'crash', cause: 'tree' }] };
}

function fireSnuff(core: Core, kind: string, t: number, part: SnuffPart): void {
  if (part === 'flowOnly') return;
  const m = snuffMoment(kind);
  // The frame's context is always the whole moment's (the snuff plays what it would there). 'snuff' is
  // its pfft alone; 'rest' is everything else, the snuff's duck and the wind's bend included.
  core.sfx.frame(m.beats);
  core.sfx.snuffMute = part === 'rest';
  const beats = part === 'snuff' ? m.beats.filter((b) => b.type === 'flow') : m.beats;
  for (const b of beats) core.sfx.beat(b, t);
  if (part !== 'snuff') {
    for (const e of m.events) core.sfx.event(e, t);
    core.ambience.snuff(t);
  }
}

function moment(core: Core, kind: string, t: number): void {
  const beats: Beat[] = [];
  const events: SimEvent[] = [];
  if (kind === 'drop') {
    // A 9,000 bank (tier 2): roll, the band drops out, then slams back on the figure.
    beats.push({ type: 'bank', tick: 0, points: 9000, mult: 6, origin: 1500, tier: 2, header: null, bump: false });
    events.push({ type: 'comboBank', points: 9000, mult: 6 });
  } else if (kind === 'massive') {
    beats.push({ type: 'bank', tick: 0, points: 24000, mult: 10, origin: 2400, tier: 3, header: 'Massive', bump: false });
    events.push({ type: 'comboBank', points: 24000, mult: 10 });
  } else if (kind === 'lost') {
    // A crash with 2,500 on the line: the stumble, the sagging pad, the sub drop, the hard duck.
    beats.push({ type: 'comboLost', tick: 0, points: 500, stake: 2500, best: false, crack: true });
    events.push({ type: 'comboLost', points: 500 }, { type: 'crash', cause: 'tree' });
  } else if (kind === 'escape') {
    events.push({ type: 'chaos', phase: 'success', event: ChaosEvent.Avalanche }, { type: 'style', kind: 'avalanche', points: 2000, chain: 1, mult: 1 });
  } else if (kind === 'flowIn') {
    // 'In the flow' on a skilled stretch, the wind already singing.
    beats.push(FLOW_IN);
  } else if (kind === 'flowStomp') {
    // Half the flow-ins land just after a perfect landing (its +0.5 flow crosses the line).
    beats.push({ type: 'stomp', tick: 0, streak: 1, late: false, title: 'Stomp', lead: [], x: 0, z: 0, heading: 0, yetiHop: false });
    events.push({ type: 'style', kind: 'perfect', points: 400, chain: 9, mult: 4 }, { type: 'land', quality: 'perfect', airtime: 1.2, halfTurns: 2, flips: 0, impact: 8, late: false });
  } else if (kind === 'snuffBank' || kind === 'bumpBank') {
    // A bump knocks a 6,000 combo out of you (a bump bank: no drop, no slam); with the flow it had
    // earned it is also 'Flow broken': the pfft and the wind's bend.
    beats.push({ type: 'bump', tick: 0, side: 1, bank: true }, { type: 'bank', tick: 0, points: 6000, mult: 4, origin: 1500, tier: 2, header: null, bump: true });
    if (kind === 'snuffBank') {
      beats.push({ type: 'flow', tick: 0, phase: 'snuff', say: { label: 'Flow broken', points: 0, tone: 'normal' } });
      core.ambience.snuff(t);
    }
    events.push({ type: 'bump', id: 1 }, { type: 'comboBank', points: 6000, mult: 4 });
  }
  core.sfx.frame(beats);
  for (const b of beats) core.sfx.beat(b, t);
  for (const e of events) core.sfx.event(e, t);
  if (kind === 'flowStomp') core.sfx.beat(FLOW_IN, t + 0.2);
}

const FLOW_IN: Beat = { type: 'flow', tick: 0, phase: 'in', say: { label: 'In the flow', points: 0, tone: 'big' } };
const FLOW_KINDS = new Set(['flowIn', 'flowStomp', 'snuffBank', 'bumpBank']);

/** The flow moments' feel: a skilled stretch at 30 m/s (drive 0.55) with the wind singing (flow 1)
 *  up to the moment; a snuff takes the flow to 0 over 0.15 s (director SNUFF_S). */
function flowFrame(f: AudioFrame, kind: string, t: number): AudioFrame {
  f.speed = 30;
  f.intensity = 0.55;
  f.comboChain = 9;
  f.comboMult = 4;
  const sk = SNUFF_KINDS[kind];
  if (sk) {
    // The wind sings up to the snuff, then the snuff's display cap takes it to 0 over 0.15 s; a crash
    // deflates the band and the bed.
    const tS = MOMENT_T + sk.snuffAt;
    f.flow = t < tS ? 1 : Math.max(0, 1 - (t - tS) / 0.15);
    if (sk.crash && t >= tS) {
      f.crashed = true;
      f.intensity = 0;
      f.comboChain = 0;
      f.speed = 0;
      f.grounded = true;
    }
    return f;
  }
  if (kind === 'bumpBank') f.flow = 0;
  else if (kind === 'snuffBank') f.flow = t < MOMENT_T ? 1 : Math.max(0, 1 - (t - MOMENT_T) / 0.15);
  else f.flow = kind === 'flowStomp' && t < MOMENT_T ? 0.8 : 1;
  return f;
}

/** The wind tone's level by flow (ambience only, 30 m/s): flow 0, 0.5, 1 for 2 s each. */
const WIND_STEPS = [0, 0.5, 1] as const;

/** 20 ms RMS windows (dBFS) of a channel pair, optionally low-passed (one pole) first. */
function envelope(L: Float32Array, R: Float32Array, from: number, to: number, lowHz = 0): number[] {
  const win = Math.round(0.02 * SR);
  const a = lowHz > 0 ? 1 - Math.exp((-2 * Math.PI * lowHz) / SR) : 1;
  let yl = 0;
  let yr = 0;
  const out: number[] = [];
  let acc = 0;
  let k = 0;
  for (let i = Math.max(0, from - SR); i < Math.min(L.length, to); i++) {
    yl += a * (L[i] - yl);
    yr += a * (R[i] - yr);
    if (i < from) continue;
    acc += (yl * yl + yr * yr) / 2;
    if (++k === win) {
      out.push(Math.round(db(Math.sqrt(acc / win)) * 10) / 10);
      acc = 0;
      k = 0;
    }
  }
  return out;
}

/** Band edges (Hz) of the snuff probe's spectrogram: roughly octave bands over the snuff's range. */
const BANDS = [80, 200, 400, 800, 1600, 3200, 8000] as const;
const FFT_N = 1024;
const HOP = 480;

/** In-place radix-2 FFT (re, im of length FFT_N). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Band energies (linear power) per 10 ms frame from `from` to `to` (s), mono: frames x bands. */
function bandFrames(L: Float32Array, R: Float32Array, from: number, to: number): number[][] {
  const out: number[][] = [];
  const re = new Float64Array(FFT_N);
  const im = new Float64Array(FFT_N);
  const binHz = SR / FFT_N;
  for (let s = Math.floor(from * SR); s + FFT_N <= Math.min(L.length, Math.floor(to * SR) + FFT_N); s += HOP) {
    for (let i = 0; i < FFT_N; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1));
      re[i] = ((L[s + i] + R[s + i]) / 2) * w;
      im[i] = 0;
    }
    fft(re, im);
    const row: number[] = [];
    for (let b = 0; b < BANDS.length - 1; b++) {
      let e = 0;
      for (let k = Math.ceil(BANDS[b] / binHz); k < Math.min(FFT_N / 2, BANDS[b + 1] / binHz); k++) e += re[k] * re[k] + im[k] * im[k];
      row.push(e);
    }
    out.push(row);
  }
  return out;
}

const pdb = (p: number): number => (p > 1e-20 ? 10 * Math.log10(p) : -200);
const r1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * The snuff against what it lands with: the snuff's pfft alone (S) and the rest of the moment as it
 * plays with the snuff (M: its duck and the wind's bend included), as 10 ms octave-band spectrograms
 * over the snuff's 0.6 s, each cell the mean of several renders. glimpse: the share of the pfft's
 * energy in cells where it is at least as loud as the rest (a cue under it everywhere is masked);
 * smrMaxDb: its best cell over the rest; liftMaxDb: how much it raises the mix in its best cell.
 * Pile-up: what it adds to the moment's peak and voices; steals: payoffs the full moment stole. The
 * flow-then kinds instead read whether the flow-in's chord (due 0.6 s after it) still lands after the
 * snuff: what of the flow-in sounds from the snuff + 0.2 s to + 1 s against the flow-in alone (all sfx
 * only), chordLeftDb.
 */
async function renderSnuff(kind: string, opts: RenderOpts): Promise<Record<string, number | number[]>> {
  const k = SNUFF_KINDS[kind];
  const tS = MOMENT_T + 0.006 + k.snuffAt;
  if (k.flowIn) {
    const span = (r: Record<string, number | number[]>): number => r.spanDb as number;
    const all = await renderMix(kind, 5, { ...opts, part: 'all', sfxOnly: true });
    const without = await renderMix(kind, 5, { ...opts, part: 'noFlow', sfxOnly: true });
    const alone = await renderMix(kind, 5, { ...opts, part: 'flowOnly', sfxOnly: true });
    const pw = (d: number): number => Math.pow(10, d / 10);
    return {
      withFlowInDb: r1(span(all)),
      withoutFlowInDb: r1(span(without)),
      flowInAloneDb: r1(span(alone)),
      // What of the flow-in still sounds there, against the flow-in alone: about 0 dB when its chord
      // lands after the snuff, far under it when it is cut.
      chordLeftDb: r1(pdb(Math.max(1e-12, pw(span(all)) - pw(span(without))) / pw(span(alone)))),
      sfxPayoffSteals: all.sfxPayoffSteals,
    };
  }
  // The rest of the moment rides a random bed (the arp's notes, the noise): its cells are the mean of
  // `reps` renders, the snuff's of two, so the reading is the expected masking, not one draw's.
  const reps = Math.max(1, Math.min(12, opts.reps ?? 8));
  const mean = async (part: SnuffPart, n: number): Promise<number[]> => {
    let acc: number[] | null = null;
    for (let i = 0; i < n; i++) {
      const b = (await renderMix(kind, 5, { ...opts, part })).bands as number[];
      if (!acc) acc = b.slice();
      else for (let j = 0; j < acc.length; j++) acc[j] += b[j];
    }
    return (acc ?? []).map((x) => x / n);
  };
  const sb = await mean('snuff', 2);
  const mb = await mean('rest', reps);
  const M = await renderMix(kind, 5, { ...opts, part: 'rest' });
  const A = await renderMix(kind, 5, { ...opts, part: 'all' });
  const nb = BANDS.length - 1;
  let sMax = 0;
  for (const x of sb) sMax = Math.max(sMax, x);
  let tot = 0;
  let glimpsed = 0;
  let smrMax = -200;
  let lift = 0;
  let liftBand = -1;
  for (let i = 0; i < sb.length; i++) {
    if (sb[i] < sMax * 1e-3) continue;
    tot += sb[i];
    if (sb[i] >= mb[i]) glimpsed += sb[i];
    smrMax = Math.max(smrMax, pdb(sb[i]) - pdb(mb[i]));
    const l = pdb(sb[i] + mb[i]) - pdb(mb[i]);
    if (l > lift) {
      lift = l;
      liftBand = i % nb;
    }
  }
  return {
    snuffDb: r1(pdb(sMax)),
    glimpse: tot > 0 ? Math.round((glimpsed / tot) * 100) / 100 : 0,
    smrMaxDb: tot > 0 ? r1(smrMax) : -200,
    liftMaxDb: r1(lift),
    liftBandHz: liftBand >= 0 ? BANDS[liftBand] : 0,
    peakAddDb: r1((A.peakDb as number) - (M.peakDb as number)),
    voicesAdded: (A.sfxPeak as number) - (M.sfxPeak as number),
    sfxPayoffSteals: A.sfxPayoffSteals,
    snuffAt: tS,
  };
}

/** Probe-only knobs: limiter and ceiling overrides, to tune the master chain against the stress mix. */
export interface RenderOpts {
  /** The snuff probes: which part of the moment to render (default all). */
  part?: SnuffPart;
  /** The effects bus alone: no band, no bed. */
  sfxOnly?: boolean;
  /** The snuff's delay (s), level and music duck, overriding the shipped ones (Sfx.snuffTweak). */
  snuff?: { delay: number; amp: number; duck: number; f0?: number; f1?: number; tau?: number };
  /** The snuff probes: renders of the rest of the moment averaged (default 8). */
  reps?: number;
  limiter?: { threshold?: number; knee?: number; ratio?: number; attack?: number; release?: number };
  ceiling?: number;
  /** The mountain whose song plays (default alpine). */
  biome?: BiomeId;
  /** The sfx pool steals its oldest voice (the old rule), to compare the steal counters against. */
  stealOldest?: boolean;
  /** The sfx pool's quiet-tail level (voices.ts QUIET), to tune the steal rule. */
  quiet?: number;
}

/** The shoulder probe's timeline (s): the bed alone, a ghost 2 m to the left closing from 5.5 m to
 *  0.5 m behind, then one sitting 2 m behind without closing. */
const SHOULDER = { offFrom: 2, closeFrom: 4, closeTo: 7, sitTo: 10 } as const;

function shoulderAt(t: number): { amt: number; pan: number } | null {
  if (t < SHOULDER.closeFrom) return null;
  const pan = -2 / 3;
  if (t < SHOULDER.closeTo) {
    const gap = 5.5 - (5 * (t - SHOULDER.closeFrom)) / (SHOULDER.closeTo - SHOULDER.closeFrom);
    return { amt: (1 - gap / 6) ** 2, pan };
  }
  return { amt: (1 - 2 / 6) ** 2, pan };
}

/** Drives the 'layers' probe solos each layer at: a novice cruise, a skilled stretch (a skill chain
 *  on a stomp streak with the pack close) and the stress drive (everything). */
const LAYER_DRIVES = { cruise: 0.36, skilled: 0.6, stress: 1 } as const;
const LAYER_NAMES = ['pad', 'bass', 'hat', 'arp', 'kick', 'clap', 'sparkle', 'lead', 'tension'] as const;

/** Each music layer alone (dBFS RMS, after the limiter, music bus only) at each drive. */
async function renderLayers(): Promise<Record<string, number | number[]>> {
  const out: Record<string, number | number[]> = {};
  for (const [label, drive] of Object.entries(LAYER_DRIVES)) {
    for (const layer of LAYER_NAMES) {
      const secs = 6;
      const ctx = new OfflineAudioContext(2, SR * secs, SR);
      const core = new Core(ctx);
      core.graph.setMaster(1, 0);
      core.graph.sfx.setLevel(0, 0);
      core.music.setTarget('run', Mood.None, 'alpine');
      core.music.solo = layer;
      const danger = label === 'stress' ? 0.9 : 0;
      core.music.setDrive(drive, danger, label === 'stress' ? 10 : 1, true);
      core.tick(0, LOOKAHEAD);
      for (let k = 1; k * STEP < secs - 0.05; k++) {
        const t = k * STEP;
        ctx.suspend(t).then(
          () => {
            core.music.setDrive(drive, danger, label === 'stress' ? 10 : 1);
            core.tick(ctx.currentTime, LOOKAHEAD);
            void ctx.resume();
          },
          () => undefined,
        );
      }
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0);
      const R = buf.getChannelData(1);
      let acc = 0;
      const from = 2 * SR;
      for (let i = from; i < L.length; i++) acc += (L[i] * L[i] + R[i] * R[i]) / 2;
      out[`${label}.${layer}`] = Math.round(db(Math.sqrt(acc / Math.max(1, L.length - from))) * 10) / 10;
      core.dispose();
    }
  }
  return out;
}

export async function renderMix(kind: string, seconds = 8, opts: RenderOpts = {}): Promise<Record<string, number | number[]>> {
  if (kind === 'layers') return renderLayers();
  const snuffK = SNUFF_KINDS[kind];
  if (snuffK && opts.part === undefined) return renderSnuff(kind, opts);
  const part: SnuffPart = opts.part ?? 'all';
  const bare = opts.sfxOnly === true || part === 'snuff';
  const flow = FLOW_KINDS.has(kind) || !!snuffK;
  const isMoment = kind === 'drop' || kind === 'massive' || kind === 'lost' || kind === 'escape' || flow;
  const shoulder = kind === 'shoulder';
  const wind = kind === 'wind';
  const secs = snuffK ? MOMENT_T + snuffK.snuffAt + 1.2 : isMoment ? 5 : shoulder ? SHOULDER.sitTo : wind ? 2 + 2 * WIND_STEPS.length : Math.max(3, Math.min(30, Number.isFinite(seconds) ? seconds : 8));
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
  const core = new Core(ctx);
  // 'stress-music' and 'stress-sfx' render the stress mix with the other bus muted (diagnosis).
  const stress = kind.startsWith('stress');
  const lim = core.graph.limiter;
  const o = opts.limiter ?? {};
  if (o.threshold !== undefined) lim.threshold.value = o.threshold;
  if (o.knee !== undefined) lim.knee.value = o.knee;
  if (o.ratio !== undefined) lim.ratio.value = o.ratio;
  if (o.attack !== undefined) lim.attack.value = o.attack;
  if (o.release !== undefined) lim.release.value = o.release;
  if (opts.ceiling !== undefined) core.graph.ceiling.gain.value = opts.ceiling;
  core.sfxPool.stealOldest = opts.stealOldest === true;
  if (opts.quiet !== undefined) core.sfxPool.quiet = opts.quiet;
  if (opts.snuff) core.sfx.snuffTweak = opts.snuff;
  core.graph.setMaster(1, 0);
  const noMusic = kind === 'ambience' || kind === 'stress-sfx' || kind === 'stress-amb' || shoulder || wind || bare;
  // 'song': the band alone at a cruise, to read a mountain's A A B B form (bars and decks).
  const song = kind === 'song';
  const choir = kind === 'choir';
  core.graph.music.setLevel(noMusic ? 0 : 1, 0);
  core.graph.sfx.setLevel(kind === 'music' || kind === 'stress-music' || song ? 0 : 1, 0);
  core.music.enabled = !noMusic;
  core.music.setTarget('run', Mood.None, opts.biome ?? 'alpine');
  core.ambience.setScene('run', 0);
  // The effects alone: the bed (on the effects bus) silenced at its two outputs.
  if (bare) {
    const amb = core.ambience as unknown as { out: GainNode; tone: GainNode };
    for (const g of [amb.out.gain, amb.tone.gain]) {
      g.cancelScheduledValues(0);
      g.setValueAtTime(0, 0);
    }
  }

  let drive = 0;
  let n = 0;
  let nextBurst = 2;
  const step = (t: number): void => {
    const f = stress ? stressFrame(t) : baseFrame(t);
    if (shoulder) f.shoulder = shoulderAt(t);
    if (flow) flowFrame(f, kind, t);
    if (wind) {
      f.speed = 30;
      f.flow = WIND_STEPS[Math.max(0, Math.min(WIND_STEPS.length - 1, Math.floor((t - 2) / 2)))];
    }
    const target = Math.max(0, Math.min(1, f.intensity));
    drive += (target - drive) * (1 - Math.exp(-STEP / (target > drive ? 0.7 : 2.2)));
    core.music.setDrive(drive, f.danger, f.comboMult);
    core.ambience.update(f, t, stress, core.music.key());
    core.pulse.fuse = f.fuse ?? 0;
    core.pulse.duel = f.duel ?? 0;
    // The stress mix sings a full ghost choir; 'choir' walks it up one voice at a time and then
    // has one ghost retake you (the sigh).
    if (stress && t >= 2) core.music.setChoir(3, t);
    if (choir) {
      const n = t < 3 ? 0 : t < 4.5 ? 1 : t < 6 ? 2 : t < 8 ? 3 : 2;
      core.music.setChoir(n, t, t >= 8);
    }
    if (stress && kind !== 'stress-amb' && t >= nextBurst) {
      burst(core, t + 0.006, n++);
      nextBurst += 0.25;
    }
    if (snuffK) {
      // 'In the flow' first (the flow-then kinds), then the snuff with what broke it.
      if (t >= MOMENT_T && n === 0) {
        n = 1;
        if (snuffK.flowIn && part !== 'noFlow') {
          core.sfx.frame([FLOW_IN]);
          core.sfx.beat(FLOW_IN, MOMENT_T + 0.006);
        }
      }
      if (t >= MOMENT_T + snuffK.snuffAt - 1e-6 && n === 1) {
        n = 2;
        fireSnuff(core, kind, MOMENT_T + snuffK.snuffAt + 0.006, part);
      }
    } else if (isMoment && t >= MOMENT_T && n === 0) {
      n = 1;
      moment(core, kind, MOMENT_T + 0.006);
    }
    core.tick(t, LOOKAHEAD);
  };
  core.tick(0, LOOKAHEAD);
  let errors = 0;
  let firstError = '';
  for (let k = 1; k * STEP < secs - 0.05; k++) {
    const t = k * STEP;
    ctx.suspend(t).then(
      () => {
        try {
          step(ctx.currentTime);
        } catch (err) {
          if (errors++ === 0) firstError = String(err);
        } finally {
          void ctx.resume();
        }
      },
      () => undefined,
    );
  }
  const buf = await ctx.startRendering();
  if (firstError) console.warn('[probe] render step failed', errors, firstError);
  const from = Math.floor(2 * SR);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  let sl = 0;
  let sr = 0;
  let peak = 0;
  for (let i = from; i < L.length; i++) {
    const a = L[i];
    const b = R[i];
    sl += a * a;
    sr += b * b;
    const m = Math.max(Math.abs(a), Math.abs(b));
    if (m > peak) peak = m;
  }
  const len = Math.max(1, L.length - from);
  const out: Record<string, number | number[]> = {
    rmsDb: db(Math.sqrt((sl + sr) / (2 * len))),
    rmsLDb: db(Math.sqrt(sl / len)),
    rmsRDb: db(Math.sqrt(sr / len)),
    peakDb: db(peak),
    seconds: secs,
    sfxSteals: core.sfxPool.steals,
    sfxLoudSteals: core.sfxPool.loudSteals,
    sfxPayoffSteals: core.sfxPool.payoffSteals,
    musicSteals: core.musicPool.steals,
    padSteals: core.musicPool.keptSteals,
    sfxPeak: core.sfxPool.peak,
    musicPeak: core.musicPool.peak,
    errors,
  };
  if (shoulder) {
    // L and R RMS (dBFS) of the bed alone, the last second of the closing (the ghost 2.2 to 0.5 m
    // behind on the left) and a ghost sitting 2 m behind without closing.
    const lr = (a: number, b: number): number[] => {
      let l = 0;
      let r = 0;
      const i0 = Math.floor(a * SR);
      const i1 = Math.min(L.length, Math.floor(b * SR));
      for (let i = i0; i < i1; i++) {
        l += L[i] * L[i];
        r += R[i] * R[i];
      }
      const n = Math.max(1, i1 - i0);
      return [Math.round(db(Math.sqrt(l / n)) * 10) / 10, Math.round(db(Math.sqrt(r / n)) * 10) / 10];
    };
    out.offLR = lr(SHOULDER.offFrom + 0.3, SHOULDER.closeFrom);
    out.closingLR = lr(SHOULDER.closeTo - 1, SHOULDER.closeTo);
    out.sittingLR = lr(SHOULDER.closeTo + 1, SHOULDER.sitTo);
  }
  if (choir) {
    // Mean level per stretch: none, one, two, three voices, then the retake.
    const win = (a: number, b: number): number => {
      let acc = 0;
      const i0 = Math.floor(a * SR);
      const i1 = Math.min(L.length, Math.floor(b * SR));
      for (let i = i0; i < i1; i++) acc += (L[i] * L[i] + R[i] * R[i]) / 2;
      return Math.round(db(Math.sqrt(acc / Math.max(1, i1 - i0))) * 10) / 10;
    };
    out.choirStepsDb = [win(2.2, 3), win(3.6, 4.5), win(5.1, 6), win(6.6, 8), win(8.6, 9.6)];
    out.musicPeakVoices = core.musicPool.peak;
  }
  if (wind) {
    // The ambience bed at 30 m/s per flow step (WIND_STEPS), each after its 0.4 s glide.
    const win = (a: number, b: number): number => {
      let acc = 0;
      const i0 = Math.floor(a * SR);
      const i1 = Math.min(L.length, Math.floor(b * SR));
      for (let i = i0; i < i1; i++) acc += (L[i] * L[i] + R[i] * R[i]) / 2;
      return Math.round(db(Math.sqrt(acc / Math.max(1, i1 - i0))) * 10) / 10;
    };
    out.windStepsDb = WIND_STEPS.map((_, k) => win(2.4 + 2 * k, 4 + 2 * k));
  }
  if (song) {
    // The bass under the pad follows each chord's root: per bar, the zero-crossing rate of the
    // low band (two one-pole low-passes at 220 Hz) reads as that bar's root. A song shows its A
    // section's four roots twice, then the B section's.
    const g = core.music.grid();
    const barS = g ? g.dur * 16 : 60 / 112 * 4;
    const a = 1 - Math.exp((-2 * Math.PI * 220) / SR);
    let y1 = 0;
    let y2 = 0;
    let prev = 0;
    const bars: number[] = [];
    for (let b0 = 0; (b0 + 1) * barS <= secs; b0++) {
      const i0 = Math.floor(b0 * barS * SR);
      const i1 = Math.floor((b0 + 1) * barS * SR);
      let zc = 0;
      for (let i = i0; i < i1; i++) {
        y1 += a * ((L[i] + R[i]) * 0.5 - y1);
        y2 += a * (y1 - y2);
        if ((y2 >= 0) !== (prev >= 0)) zc++;
        prev = y2;
      }
      bars.push(Math.round(zc / 2 / barS));
    }
    out.barLowHz = bars;
    out.decksStarted = core.music.decksStarted;
    out.cycleBars = core.music.position()?.cycle ?? 0;
  }
  if (snuffK) {
    const tS = MOMENT_T + snuffK.snuffAt + 0.006;
    out.bands = bandFrames(L, R, tS - 0.02, tS + 0.6).flat();
    // What still sounds from the snuff + 0.2 s to + 1 s (where the flow-in's chord would land).
    let acc = 0;
    const i0 = Math.floor((tS + 0.2) * SR);
    const i1 = Math.min(L.length, Math.floor((tS + 1) * SR));
    for (let i = i0; i < i1; i++) acc += ((L[i] + R[i]) / 2) ** 2;
    out.spanDb = db(Math.sqrt(acc / Math.max(1, i1 - i0)));
  }
  if (isMoment) {
    // From 0.4 s before the moment to 1.6 s after: the full mix and its sub band (under 100 Hz).
    const a = Math.floor((MOMENT_T - 0.4) * SR);
    const b = Math.floor((MOMENT_T + 1.6) * SR);
    out.envFrom = MOMENT_T - 0.4;
    out.env = envelope(L, R, a, b);
    out.subEnv = envelope(L, R, a, b, 100);
  }
  core.dispose();
  return out;
}
