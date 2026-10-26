import { type ChaosEvent, Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import { STYLE_LABEL } from '../sim/scoring';
import type { Sim, SimEvent } from '../sim/sim';
import type { StyleTone } from '../ui/contract';
import { IDLE_FEEL, NAMED, type Beat, type BeatLogEntry, type Feel, type GhostRef } from './beats';
import { FinaleTracker } from './finales';
import type { GhostPose, GhostTrack, RaceEvent } from './ghosts';
import { classifyPass, DuelTracker, rivalPick } from './race';
import { bankTier, fuseLevel } from './stake';
import { StompStreak, stompTitle } from './streak';
import { TimeScale } from './timescale';

// The director: turns this frame's sim events, race events and sim state into Beats (named moments)
// and continuous Feel, once per frame, before any consumer runs. The app hands the same beat list to
// ui.beats, audio.beats (before that frame's audio.simEvent calls) and world.frame. Beats never touch
// the economy: the app credits their `gifts` into passBonus, never sim.score.
//
// Pure: no DOM, render or audio imports (types only).
//
// Scaffold: today's decisions, moved out of the app unchanged. Race beats come first, then the sim
// events in order (the order the game always made its calls in): each style event is a callout with
// its label and tone (a perfect landing's is the stomp stamp), a sketchy landing a 'Sketchy' line,
// a bank a tier-0 cash-in, a lost combo its line, each pass a 'Passed' flash (the grudge's first pass
// settles it first), and the avalanche escape its banner. A perfect landing is a 0.35 hit-stop on the
// sim feed for 0.13 s.

export interface DirectorRun {
  mood: Mood;
  event: ChaosEvent;
  triggerZ: number;
  hasReveal: boolean;
  /** Seconds of run time until the reveal card leaves. */
  revealLeaveS: number;
  bestDistAtStart: number;
  bestScoreAtStart: number;
  bestComboAtStart: number;
  grudgeAtStart: { name: string; record: string; them: number; streak: number } | null;
  friend: { name: string; distance: number } | null;
  lifetimePassed: number;
  unlockLadder: Array<{ id: string; name: string; biome: BiomeId; need: number }>;
  /** Called at 2 Hz; returns missions newly met (progress.missionsCrossed). */
  missionsCrossed: () => Array<{ id: string; text: string; reward: number }>;
}

export interface DirectorFrame {
  phase: 'run' | 'crashed';
  /** Real seconds this frame (0 while frozen). */
  dt: number;
  sim: Sim;
  /** This frame's drained sim events, with the tick each came from. */
  events: ReadonlyArray<{ tick: number; e: SimEvent }>;
  /** This frame's race events (empty outside the run phase). */
  race: ReadonlyArray<RaceEvent>;
  tracks: ReadonlyArray<GhostTrack>;
  poses: ReadonlyMap<number, GhostPose | null>;
  standings: { next: { track: GhostTrack; gap: number } | null; rank: number; of: number };
  /** passedThisRun.size after this frame's race bookkeeping. */
  passedThisRun: number;
  settledPassed: number;
  timeToLand: number;
  airTicks: number;
  reduced: boolean;
}

export interface DirectorOutput {
  /** Reused array: consumers never keep it. */
  beats: Beat[];
  feel: Feel;
  /** HUD pill and FrameView.rival (C1/C11). */
  rival: { id: number; gap: number } | null;
  hud: { stake: number; fuse: number; pace: boolean; duel: boolean; bestIn: number | null; countdown: { event: ChaosEvent; metres: number } | null };
  audio: { flow: number; driftCharge: number; skillMult: number; skillChain: number; earnedFlow: number; race: number; duel: number; shoulder: { amt: number; pan: number } | null; fuse: number; streak: number; countIn: boolean; lift: number };
}

/** Telemetry keeps the most recent entries of a run. */
const LOG_MAX = 4096;
const FLIPS = ['Backflip', 'Double Backflip', 'Triple Backflip'];

function styleTone(kind: string, points: number): StyleTone {
  if (kind === 'perfect') return 'perfect';
  if (points >= 300 || kind === 'flip' || kind === 'spin' || kind === 'yetiHop' || kind === 'avalanche') return 'big';
  return 'normal';
}

export class Director {
  readonly time: TimeScale;
  /** Telemetry ring (window.__gs.director.log), cleared on beginRun. */
  readonly log: BeatLogEntry[] = [];
  private readonly shown = new Set<number>();
  private readonly beats: Beat[] = [];
  private readonly feel: Feel = { ...IDLE_FEEL };
  private readonly out: DirectorOutput;
  private readonly simEvents: SimEvent[] = [];
  private readonly streak = new StompStreak();
  private readonly duels = new DuelTracker();
  private readonly finales = new FinaleTracker();
  private run: DirectorRun | null = null;
  /** The latest landing's tricks, for the spin and flip labels (kept across runs, as it always was). */
  private lastLand: { halfTurns: number; flips: number } | null = null;
  private grudgeDone = false;

  /** reduced: prefers-reduced-motion, handed to the time scale (the app also reads it into each frame). */
  constructor(reduced: () => boolean) {
    this.time = new TimeScale(reduced);
    this.out = {
      beats: this.beats,
      feel: this.feel,
      rival: null,
      hud: { stake: 0, fuse: 0, pace: false, duel: false, bestIn: null, countdown: null },
      audio: { flow: 0, driftCharge: 0, skillMult: 1, skillChain: 0, earnedFlow: 0, race: 0, duel: 0, shoulder: null, fuse: 0, streak: 0, countIn: false, lift: 0 },
    };
  }

  /** Ghost ids passed with a shown (non-muted) pass this run. */
  get shownPasses(): ReadonlySet<number> {
    return this.shown;
  }

  beginRun(r: DirectorRun): void {
    this.run = r;
    this.log.length = 0;
    this.shown.clear();
    this.grudgeDone = false;
    this.streak.reset();
    this.duels.reset();
    this.finales.begin(r.event, r.triggerZ);
  }

  /** Resets the streak and the time scale; keeps the run's snapshots, passes and the grudge. */
  revive(): void {
    this.streak.revive();
    this.duels.crash();
    this.finales.revive();
    this.time.reset();
  }

  step(f: DirectorFrame): DirectorOutput {
    const beats = this.beats;
    beats.length = 0;
    const sim = f.sim;
    const run = this.run;

    // Race first. The ladder is the count of first passes so far, as each pass happens.
    let ladder = f.passedThisRun;
    for (const ev of f.race) if (ev.type === 'pass' && ev.first) ladder--;
    for (const ev of f.race) {
      if (ev.type === 'pass') {
        if (ev.first) ladder++;
        const ghost = this.ref(ev.track, f, sim);
        const c = classifyPass({
          tick: sim.tick,
          first: ev.first,
          ghost,
          wreck: false,
          everLedBy2m: false,
          lastSlingTick: -1e9,
          lastShownPassTick: -1e9,
          chainN: 0,
          passedYouBefore: false,
          duel: null,
          haunted: run !== null && run.mood === Mood.Haunted,
          newGroundTick: -1e9,
        });
        if (ev.first && ghost.kind === 'grudge' && !this.grudgeDone) {
          // Settled before its pass flash: the banner the pass then names.
          this.grudgeDone = true;
          this.push({ type: 'grudgeSettled', tick: sim.tick, ghost, nemesis: false, after: 0, paid: c.gifts }, sim);
        }
        this.push({ type: 'pass', tick: sim.tick, ghost, word: c.word, text: c.text, first: ev.first, chain: 0, ladder, octave: false, gifts: c.gifts + c.extra, muted: c.muted }, sim);
        if (!c.muted) this.shown.add(ghost.id);
      } else if (ev.type === 'passedBy') {
        this.push({ type: 'passedBy', tick: sim.tick, ghost: this.ref(ev.track, f, sim), muted: false }, sim);
      }
    }

    // Then the sim events. The sim emits a landing's trick styles before the land event itself, so
    // the batch is read for its land first: spin and flip callouts name this landing.
    const evs = this.simEvents;
    evs.length = 0;
    let land: Extract<SimEvent, { type: 'land' }> | null = null;
    for (const p of f.events) {
      evs.push(p.e);
      if (p.e.type === 'land') {
        land = p.e;
        this.lastLand = { halfTurns: p.e.halfTurns, flips: p.e.flips };
      }
    }
    // Finales are read from the whole batch, then placed at their chaos event (where the banner always
    // came in the frame's order); any left over follow the batch.
    const finales = this.finales.step(sim, evs, f.dt);
    let fi = 0;
    for (const p of f.events) {
      const e = p.e;
      switch (e.type) {
        case 'chaos':
          if (e.phase === 'success') while (fi < finales.length && finales[fi].event === e.event) this.push(finales[fi++], sim);
          break;
        case 'style': {
          if (e.kind === 'perfect') {
            const late = land?.late ?? false;
            const n = this.streak.land('perfect', late, p.tick).n;
            this.push({ type: 'stomp', tick: p.tick, streak: n, late, title: stompTitle(n), lead: [{ label: 'Perfect', points: e.points }], x: sim.s.x, z: sim.s.z, heading: sim.s.heading, yetiHop: false }, sim);
            break;
          }
          let label = STYLE_LABEL[e.kind];
          // Every number on a callout carries its label, and "x" is the combo multiplier's alone.
          if (e.kind === 'spin' && this.lastLand && this.lastLand.halfTurns > 0) label = `Spin ${this.lastLand.halfTurns * 180}`;
          if (e.kind === 'flip' && this.lastLand) label = FLIPS[Math.max(1, this.lastLand.flips) - 1] ?? `${this.lastLand.flips} Backflips`;
          this.push({ type: 'callout', tick: p.tick, source: e.kind, say: { label, points: e.points, tone: styleTone(e.kind, e.points) } }, sim);
          break;
        }
        case 'land':
          this.lastLand = { halfTurns: e.halfTurns, flips: e.flips };
          if (e.quality === 'sketchy') this.push({ type: 'callout', tick: p.tick, source: 'sketchy', say: { label: 'Sketchy', points: 0, tone: 'lost' } }, sim);
          // Hit-stop: time briefly thickens on a perfect landing (the stomp itself was its style event).
          if (e.quality === 'perfect') this.time.pulse(0.35, 0.13, 'feed');
          else this.streak.land(e.quality, e.late, p.tick);
          break;
        case 'comboBank':
          this.push({ type: 'bank', tick: p.tick, points: e.points, mult: e.mult, origin: Math.round(e.points / Math.max(1, e.mult)), tier: bankTier(e.points, 0, run?.bestComboAtStart ?? 0), header: null, bump: false }, sim);
          break;
        case 'comboLost':
          this.push({ type: 'comboLost', tick: p.tick, points: e.points, stake: e.points, best: false, crack: false }, sim);
          break;
        case 'crash':
          this.streak.crash();
          this.duels.crash();
          break;
        default:
          break;
      }
    }
    this.streak.tick(sim.tick);
    while (fi < finales.length) this.push(finales[fi++], sim);

    // Continuous state for this frame.
    const feel = this.feel;
    feel.reduced = f.reduced;
    feel.timeFeed = this.time.feed;
    feel.timeRender = this.time.render;
    feel.shakeScale = this.time.shake;

    const out = this.out;
    const next = f.standings.next;
    out.rival = rivalPick(next ? { id: next.track.entry.id, gap: next.gap } : null, null, null);
    const c = sim.combo;
    const stake = c.active ? Math.round(c.pending * c.multiplier) : 0;
    out.hud.stake = stake;
    out.hud.fuse = fuseLevel(stake, c.window > 0 ? c.timer / c.window : 0, c.active);
    out.hud.pace = false;
    out.hud.duel = this.duels.open !== null;
    out.hud.bestIn = null;
    out.hud.countdown = this.finales.countdown(sim);
    out.audio.fuse = out.hud.fuse;
    out.audio.streak = this.streak.n;
    return out;
  }

  /** A ghost as beats name it. dx: ghost x minus rider x in sim metres (0 without a pose). */
  private ref(t: GhostTrack, f: DirectorFrame, sim: Sim): GhostRef {
    const p = f.poses.get(t.entry.id);
    const ref: GhostRef = { id: t.entry.id, name: t.entry.name, kind: t.entry.kind, dx: p ? p.x - sim.s.x : 0 };
    if (t.entry.role) ref.role = t.entry.role;
    return ref;
  }

  private push(b: Beat, sim: Sim): void {
    this.beats.push(b);
    const muted = (b.type === 'pass' || b.type === 'passedBy') && b.muted;
    const entry: BeatLogEntry = { t: sim.tick / 60, type: b.type, named: NAMED.has(b.type) && !muted };
    if (b.type === 'callout') entry.label = b.say.label;
    else if (b.type === 'stomp') entry.label = b.title;
    else if (b.type === 'pass') {
      entry.label = b.ghost.name;
      entry.word = b.word;
      entry.gifts = b.gifts;
    } else if (b.type === 'passedBy' || b.type === 'grudgeSettled') entry.label = b.ghost.name;
    else if (b.type === 'bank') entry.tier = b.tier;
    else if (b.type === 'finale') {
      entry.label = b.text;
      entry.gifts = b.gifts;
    }
    if (this.log.length >= LOG_MAX) this.log.shift();
    this.log.push(entry);
  }
}
