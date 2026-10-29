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
  }
  core.sfx.frame();
  for (const b of beats) core.sfx.beat(b, t);
  for (const e of events) core.sfx.event(e, t);
}

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

/** Probe-only knobs: limiter and ceiling overrides, to tune the master chain against the stress mix. */
export interface RenderOpts {
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
  const isMoment = kind === 'drop' || kind === 'massive' || kind === 'lost' || kind === 'escape';
  const shoulder = kind === 'shoulder';
  const secs = isMoment ? 5 : shoulder ? SHOULDER.sitTo : Math.max(3, Math.min(30, Number.isFinite(seconds) ? seconds : 8));
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
  core.graph.setMaster(1, 0);
  const noMusic = kind === 'ambience' || kind === 'stress-sfx' || kind === 'stress-amb' || shoulder;
  // 'song': the band alone at a cruise, to read a mountain's A A B B form (bars and decks).
  const song = kind === 'song';
  const choir = kind === 'choir';
  core.graph.music.setLevel(noMusic ? 0 : 1, 0);
  core.graph.sfx.setLevel(kind === 'music' || kind === 'stress-music' || song ? 0 : 1, 0);
  core.music.enabled = !noMusic;
  core.music.setTarget('run', Mood.None, opts.biome ?? 'alpine');
  core.ambience.setScene('run', 0);

  let drive = 0;
  let n = 0;
  let nextBurst = 2;
  const step = (t: number): void => {
    const f = stress ? stressFrame(t) : baseFrame(t);
    if (shoulder) f.shoulder = shoulderAt(t);
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
    if (isMoment && t >= MOMENT_T && n === 0) {
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
