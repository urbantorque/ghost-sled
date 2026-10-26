import type { Beat } from '../game/beats';
import { intensity } from '../game/intensity';
import { ChaosEvent, Mood } from '../sim/chaos';
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

export async function renderMix(kind: string, seconds = 8): Promise<Record<string, number | number[]>> {
  const isMoment = kind === 'drop' || kind === 'massive' || kind === 'lost' || kind === 'escape';
  const secs = isMoment ? 5 : Math.max(3, Math.min(30, Number.isFinite(seconds) ? seconds : 8));
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * secs), SR);
  const core = new Core(ctx);
  const stress = kind === 'stress';
  core.graph.setMaster(1, 0);
  core.graph.music.setLevel(kind === 'ambience' ? 0 : 1, 0);
  core.graph.sfx.setLevel(kind === 'music' ? 0 : 1, 0);
  core.music.enabled = kind !== 'ambience';
  core.music.setTarget('run', Mood.None, 'alpine');
  core.ambience.setScene('run', 0);

  let drive = 0;
  let n = 0;
  let nextBurst = 2;
  const step = (t: number): void => {
    const f = stress ? stressFrame(t) : baseFrame(t);
    const target = Math.max(0, Math.min(1, f.intensity));
    drive += (target - drive) * (1 - Math.exp(-STEP / (target > drive ? 0.7 : 2.2)));
    core.music.setDrive(drive, f.danger, f.comboMult);
    core.ambience.update(f, t, stress, core.music.key());
    core.pulse.fuse = f.fuse ?? 0;
    core.pulse.duel = f.duel ?? 0;
    if (stress && t >= nextBurst) {
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
    musicSteals: core.musicPool.steals,
    padSteals: core.musicPool.keptSteals,
    sfxPeak: core.sfxPool.peak,
    musicPeak: core.musicPool.peak,
    errors,
  };
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
