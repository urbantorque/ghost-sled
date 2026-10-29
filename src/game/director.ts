import { type ChaosEvent, Mood } from '../sim/chaos';
import type { BiomeId } from '../sim/mountains';
import { STYLE_LABEL, type StyleKind } from '../sim/scoring';
import type { Sim, SimEvent } from '../sim/sim';
import type { StyleTone } from '../ui/contract';
import { IDLE_FEEL, NAMED, POP_DEFER, WHISKER_GAP, WHISKER_SPEED, type Beat, type BeatLogEntry, type BeatOf, type Feel, type GhostRef } from './beats';
import { FinaleTracker } from './finales';
import type { GhostPose, GhostTrack, RaceEvent } from './ghosts';
import { GRAVE_GIFTS, GRAVE_PAST, type Graveyard } from './graveyards';
import { FLOW_FULL, skillMult } from './intensity';
import { friendBeatenText } from './progress';
import { CHAIN_TICKS, DUEL_GIFTS, DuelTracker, ExtraGifts, SLING_TICKS, START_TICKS, callPick, classifyPass, ladderIndex, rivalPick, steadyNext } from './race';
import { BANK_MS, bankHeader, bankTier, fuseLevel } from './stake';
import { StompStreak, stompTitle, streakLine } from './streak';
import { CRASH_CURVE, TimeScale } from './timescale';

// The director: turns this frame's sim events, race events and sim state into Beats (named moments)
// and continuous Feel, once per frame, before any consumer runs. The app hands the same beat list to
// ui.beats, audio.beats (before that frame's audio.simEvent calls) and world.frame. Beats never touch
// the economy: the app credits their `gifts` into passBonus, never sim.score.
//
// Pure: no DOM, render or audio imports (types only).
//
// Each frame, in order: the batch is pre-scanned (a landing's 'perfect' style comes before its land
// event, a bank before its bump, a lost combo before its crash, a slingshot before the pass it
// carries); New ground (so the 'you' wreck right on it is muted); duels; the race (passes, wipeouts,
// the lead); the sim events in order (stomps, near misses, drift releases, banks, finales, the
// crash); then the state beats (New best, Best combo pace, a friend beaten, kilometres, the stomp
// metronome, ghosts' tricks, the start-line call, mission and unlock pops); then Feel, the HUD and
// audio fields.

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
  /** The mountain's graveyards (graveyards.ts, the cairns the world placed): ridden 20 m past alive,
   *  each is a graveyard beat once per run. */
  graveyards?: ReadonlyArray<Graveyard>;
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
  /** Ghost poses at the frame's render tick (sim.tick - 1 + alpha in a run). */
  poses: ReadonlyMap<number, GhostPose | null>;
  /** The rider's z as the app renders it this frame (lerpSnap's view.z, at the same render tick as
   *  the poses), so every gap the director measures (the rival pill's, the duels', the choir's) is on
   *  one time base. Omitted: sim.s.z, for poses at the integer tick. Against the integer tick the
   *  pill's gap was biased 0.41 m and jumped by more than 0.3 m on 83% of frames ('13 m' / '14 m'). */
  riderZ?: number;
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
  /** choir: AudioFrame.choir, 0..3 ghosts you passed this run still riding within 150 m behind.
   *  drafting: in a slipstream or riding a slingshot's boost (intensity holds its boost term at 0). */
  audio: { flow: number; driftCharge: number; skillMult: number; skillChain: number; earnedFlow: number; race: number; duel: number; shoulder: { amt: number; pan: number } | null; fuse: number; streak: number; countIn: boolean; lift: number; choir: number; drafting: boolean };
}

/** Telemetry keeps the most recent entries of a run. */
const LOG_MAX = 4096;
const FLIPS = ['Backflip', 'Double Backflip', 'Triple Backflip'];
/** Stomp hit-stop by streak (1, 2, 3, 4, 5+), seconds on the sim feed at 0.35. */
const STOMP_STOP = [0.13, 0.15, 0.17, 0.19, 0.19];
const HITSTOP_SCALE = 0.35;
/** A perfect landing this soon (ticks) after a yeti hop keeps the 'Yeti hop' title. */
const YETI_TITLE_TICKS = 90;
/** Wipeout news: a ghost ahead within this many metres, or behind within WIPE_BEHIND (no duel). */
const WIPE_AHEAD = 200;
const WIPE_BEHIND = 25;
/** A duel's result names that ghost's moment: its wreck passed or its wipeout this soon after (ticks)
 *  says nothing more. */
const DUEL_AFTER_TICKS = 120;
/** The lead beat: from this tick, with this many ghosts in the race; re-armed after losing it this long. */
const LEAD_TICKS = 600;
const LEAD_GHOSTS = 3;
const LEAD_REARM_TICKS = 300;
/** The start-line call: the rival (pill, C11 ring, chip) stays on its ghost this long (s), a quarter
 *  second under the HUD's call flash (CALL_MS, POP_DEFER.call), which starts a frame or more after the
 *  beat: held for the whole flash, the pill showed the call's ghost for 130 to 220 ms after the flash
 *  ended before it named the nearest rider. Given up when its ghost is not ready this long after its
 *  moment, or after the first track of the field got ready, whichever is later (a slow cold load had
 *  no track ready for 11 s, and the run never got its call). With no track ready at all it waits at
 *  most CALL_LATE_S. */
const CALL_HOLD_S = POP_DEFER.call / 1000 - 0.25;
const CALL_GIVE_UP_S = 6;
const CALL_LATE_S = 30;
/** A finale banner holds the queue this long (s). */
const FINALE_HOLD_S = 3;
/** A new mountain is a run's biggest news, and usually lands on a pass in a busy pack (often mid
 *  duel): it waits this long (s) for a clear moment, where a mission gives up after POP_DEFER.giveUp. */
const UNLOCK_GIVE_UP_S = 12;
/** A mission pop waits this long (s) for a clear moment, counted only while it is at the head of the
 *  queue (a mission met with the unlock waits its turn behind it without losing time: 'Pass a ghost'
 *  popped in only half of fresh first runs while its clock ran from the pass). */
const MISSION_GIVE_UP_S = 8;
/** Whatever waits, a pop more than this long (s) after its moment is dropped: late news is worse
 *  than none. */
const POP_LATE_S = 15;
/** After an unlock pop the next pop goes up as the unlock's banner leaves: it is on screen for
 *  UNLOCK_BANNER_S (notices TOAST_MS + 400), and the next arrives AFTER_UNLOCK_S later, inside its
 *  200 ms exit, so the band hands straight over and one banner shows at a time. With the usual
 *  POP_DEFER.spacing, 'Pass a ghost' (met on the same pass as the unlock) came 6 s after its pass
 *  and missed 4 of 30 short first runs. */
const UNLOCK_BANNER_S = 2.6;
const AFTER_UNLOCK_S = 0.1;
/** An open duel holds a waiting pop only this long (s) after it opened: the duel lives in the rival
 *  pill, the pop in the notice slot (opening duels ran 6 to 13 s and starved the first mission). */
const DUEL_POP_BLOCK_S = 2.5;
/** A duel's result keeps the rival (pill, C11 ring, chip) on its ghost this long (s), the pill's result
 *  flash, and no new duel opens meanwhile: the next one opens only once it can be named. */
const RIVAL_HOLD_S = 1.5;
/** The rival pill never names a wreck or a ghost further back than this (m). */
const RIVAL_BEHIND_M = 150;
/** New best this soon (s) after New ground waits that long after it: each gets its own moment. */
const NEW_GROUND_GAP_S = 1.2;
/** While a pop waits, a new duel opens no sooner than this (s) after the last one resolved: in a
 *  bunched pack one duel opened 0.02 s after another for 22 s straight, and the run's unlock (and a
 *  mission) never found the 1.4 s of quiet they wait for. */
const DUEL_POP_GAP_S = 2.2;
/** ...and no duel opens under a pop's banner (notices TOAST_MS 2,200 plus its exit): the banner band
 *  covers the race row, so an opening duel there would never be seen. */
const POP_BANNER_S = 2.5;
/** New best this soon after New ground waits until this long (s) after it. New best crossed by a bank
 *  (or due while one is on screen) waits for the bank's whole cash-in, its tier's BANK_MS (stake.ts):
 *  under a 1,900 ms 'NEW BEST COMBO' bank a 1.25 s wait printed 'new best' twice. */
const NEW_BEST_DEFER_S = 1.25;
/** Ghost tricks: whispered within this window (m, ahead/behind), at most one per WHISPER_S. */
const TRICK_AHEAD = 60;
const TRICK_BEHIND = 20;
const WHISPER_S = 1.5;
/** Flow display (the sim's flow is untouched). Earned from skill moves only: a draft or a slingshot is
 *  the pack's speed (a novice drafting and slinging through the start bunch reached the beat at 13.5 s
 *  of a first run). 'In the flow' at 2.9 with 3 kinds: the shown flow approaches the sim's whole-number
 *  targets from below, so a chain of 12 to 15 sat on 2.99999 under a 3.0 line and live skilled play
 *  never fired it. The glow is full at FLOW_FULL (3.5). From FLOW_SNUFF_MIN shown, a bump, a sketchy
 *  landing or a lost combo snuffs it (the flow it earned goes out; earning starts over). */
const FLOW_SMOOTH_S = 0.2;
const FLOW_IN_AT = 2.9;
const FLOW_IN_KINDS = 3;
const FLOW_SNUFF_MIN = 1.2;
const SNUFF_S = 0.15;
const FLOW_PULSE_S = 0.3;
/** Audio lifts: New ground for the rest of the run, an avalanche escape decaying over 8 s. */
const LIFT_NEW_GROUND = 0.08;
const LIFT_AVALANCHE = 0.2;
const LIFT_AVALANCHE_S = 8;
/** The stomp metronome: downward crossings of timeToLand (s) and their ladder steps. */
const TICK_AT = [0.6, 0.45, 0.3, 0.15];
const TICK_STEP = [2, 3, 4, 5];
/** The ghost choir: passed ghosts still riding this close behind you (m) sing, at most CHOIR_MAX. */
const CHOIR_BEHIND = 150;
const CHOIR_MAX = 3;

function styleTone(kind: string, points: number): StyleTone {
  if (kind === 'perfect') return 'perfect';
  if (points >= 300 || kind === 'flip' || kind === 'spin' || kind === 'yetiHop' || kind === 'avalanche') return 'big';
  return 'normal';
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function trickWord(halfTurns: number, flips: number): string | null {
  if (flips > 0) return FLIPS[flips - 1] ?? `${flips} Backflips`;
  if (halfTurns > 0) return `Spin ${halfTurns * 180}`;
  return null;
}

interface Pop {
  beat: BeatOf<'missionPop'> | BeatOf<'unlockPop'>;
  /** Run clock when it was met (the hard cap counts from here). */
  since: number;
  /** Seconds it has waited at the head of the queue (the give-up clock). */
  waited: number;
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
  private readonly extras = new ExtraGifts();
  private run: DirectorRun | null = null;
  /** Real seconds of this run (frozen frames excluded). */
  private clock = 0;
  private lastTick = 0;
  /** The latest landing's tricks, for the spin and flip labels. */
  private lastLand: { halfTurns: number; flips: number } | null = null;
  private lastReleaseTier = 0;
  private yetiHopTick = -1e9;
  private grudgeDone = false;

  // Race.
  private readonly ledBy2m = new Set<number>();
  private readonly passedYou = new Set<number>();
  private lastSlingTick = -1e9;
  /** The latest boost was a slingshot (cleared once its pool runs dry or another boost comes). */
  private slingBoost = false;
  private lastShownPassTick = -1e9;
  private chainN = 0;
  private ladderN = 0;
  private leadArmed = true;
  private leadLost = 0;
  private leading = false;
  private call: { id: number; at: number } | null = null;
  private callDone = false;
  /** A field is lined up for the start-line call but its ghost is not ready yet (pops wait for it). */
  private callWaiting = false;
  /** Run clock when the first track of the field was ready (-1 until then). */
  private fieldReadyAt = -1;
  /** The nearest ghost the pill named last frame (held through a bunched pack), and since when. */
  private heldNext: number | null = null;
  private heldSince = -1e9;
  /** The duel just resolved: the rival stays on its ghost until `until` (run clock). */
  private rivalHold: { id: number; until: number } | null = null;
  /** Run clock when the open duel opened. */
  private duelOpenAt = -1e9;
  /** Sim tick each ghost's duel last resolved won or held off. */
  private readonly duelEnd = new Map<number, number>();
  /** Slung passes in the current burst (one slingshot through the pack is one growing moment). */
  private slungN = 0;
  private lastSlungPassTick = -1e9;
  /** Gifts the grudge's passes and settle have credited this run (its premium is paid once). */
  private grudgePaid = 0;
  /** Your best's ghosts edged past in a muted start-line jostle: rides your own line, so the jostle at
   *  2 s used up its first pass and the real overtake later read 'Took back Your best' for 0 gifts. Its
   *  next pass is still its first (pays the base, reads 'Passed Your best'). */
  private readonly youJostled = new Set<number>();
  /** The rider's z on the poses' time base this frame (DirectorFrame.riderZ, else sim.s.z). */
  private rz = 0;

  // Milestones.
  private newGroundTick = -1e9;
  private newGroundAt = -1;
  private newBestDone = false;
  private newBestAt = -1;
  private paceDone = false;
  private friendDone = false;
  private kmDone = 0;
  private avalancheAt = -1;
  private bestBank = 0;
  /** Run clock until which a bank's cash-in is on screen (New best waits for it). */
  private bankUntil = -1;

  // Flow and skill.
  private skillChain = 0;
  /** The skill moves earning the shown flow: the combo's skill chain since its start or the last snuff. */
  private flowChain = 0;
  private perfects = 0;
  private readonly kinds = new Set<StyleKind>();
  private earnCap = 0;
  private flowShown = 0;
  private flowInDone = false;
  private snuffAt = -1;
  private snuffFrom = 0;
  private pulseAt = -1;

  // Crash.
  private crashT = -1;

  // Pops.
  private readonly pops: Pop[] = [];
  private readonly unlockDone = new Set<string>();
  private teased = false;
  private pollAt = 0;
  private lastPopAt = -1e9;
  /** The last pop was an unlock: the next follows as its banner leaves (UNLOCK_BANNER_S). */
  private lastPopUnlock = false;
  private lastStompAt = -1e9;
  private lastPassAt = -1e9;
  private lastNewsAt = -1e9;
  private lastFinaleAt = -1e9;
  private lastDuelEndAt = -1e9;

  // Ghost tricks and the stomp metronome.
  private readonly cursors = new Map<number, number>();
  private lastWhisperAt = -1e9;
  private readonly ticked = [false, false, false, false];
  private prevTtl = NaN;

  // Graveyards survived this run (index into run.graveyards) and the choir: ghosts you passed with a
  // shown, live pass or beat in a duel (the jostle and the wreck pass never sing).
  private readonly gravesDone = new Set<number>();
  private readonly choirIds = new Set<number>();

  /** reduced: prefers-reduced-motion, handed to the time scale (the app also reads it into each frame). */
  constructor(reduced: () => boolean) {
    this.time = new TimeScale(reduced);
    this.out = {
      beats: this.beats,
      feel: this.feel,
      rival: null,
      hud: { stake: 0, fuse: 0, pace: false, duel: false, bestIn: null, countdown: null },
      audio: { flow: 0, driftCharge: 0, skillMult: 1, skillChain: 0, earnedFlow: 0, race: 0, duel: 0, shoulder: null, fuse: 0, streak: 0, countIn: false, lift: 0, choir: 0, drafting: false },
    };
  }

  /** Ghost ids passed with a shown (non-muted) pass this run. */
  get shownPasses(): ReadonlySet<number> {
    return this.shown;
  }

  /** The run's best stomp streak. */
  get bestStreak(): number {
    return this.streak.best;
  }

  /** The grudge was settled this run (its grudgeSettled beat fired): a shown pass of it, a duel with
   *  it won or held off, or riding past where its whole run ended. The save's settlement reads this
   *  as 'passed', so the results never settle a grudge the run did not show settled (a start-line
   *  jostle past it is no overtake). */
  get grudgeSettled(): boolean {
    return this.grudgeDone;
  }

  /** A results line for an event the run never reached ('The yeti was 220 m away.'), else null. */
  eventNote(sim: Sim): string | null {
    return this.finales.eventNote(sim);
  }

  beginRun(r: DirectorRun): void {
    this.run = r;
    this.log.length = 0;
    this.shown.clear();
    this.clock = 0;
    this.lastTick = 0;
    this.lastLand = null;
    this.lastReleaseTier = 0;
    this.yetiHopTick = -1e9;
    this.grudgeDone = false;
    this.streak.reset();
    this.duels.reset();
    this.finales.begin(r.event, r.triggerZ);
    this.extras.reset();
    this.ledBy2m.clear();
    this.passedYou.clear();
    this.lastSlingTick = -1e9;
    this.slingBoost = false;
    this.lastShownPassTick = -1e9;
    this.chainN = 0;
    this.ladderN = 0;
    this.leadArmed = true;
    this.leadLost = 0;
    this.leading = false;
    this.call = null;
    this.callDone = false;
    this.callWaiting = false;
    this.fieldReadyAt = -1;
    this.heldNext = null;
    this.heldSince = -1e9;
    this.rivalHold = null;
    this.duelOpenAt = -1e9;
    this.duelEnd.clear();
    this.slungN = 0;
    this.lastSlungPassTick = -1e9;
    this.grudgePaid = 0;
    this.youJostled.clear();
    this.newGroundTick = -1e9;
    this.newGroundAt = -1;
    this.newBestDone = false;
    this.newBestAt = -1;
    this.paceDone = false;
    this.friendDone = false;
    this.kmDone = 0;
    this.avalancheAt = -1;
    this.bestBank = 0;
    this.bankUntil = -1;
    this.resetSkill();
    this.flowShown = 0;
    this.pulseAt = -1;
    this.crashT = -1;
    this.pops.length = 0;
    this.unlockDone.clear();
    this.teased = false;
    this.pollAt = 0;
    this.lastPopUnlock = false;
    this.lastPopAt = this.lastStompAt = this.lastPassAt = this.lastNewsAt = this.lastFinaleAt = this.lastDuelEndAt = -1e9;
    this.cursors.clear();
    this.lastWhisperAt = -1e9;
    this.ticked.fill(false);
    this.prevTtl = NaN;
    this.gravesDone.clear();
    this.choirIds.clear();
    Object.assign(this.feel, IDLE_FEEL);
  }

  /** Resets the streak, the flow cap, the skill chain and the time scale (the crash curve); keeps the
   *  run's snapshots, passes, milestones and the popped set. */
  revive(): void {
    this.streak.revive();
    this.duels.crash();
    this.finales.revive();
    this.time.reset();
    this.resetSkill();
    this.flowShown = 0;
    this.crashT = -1;
    this.newBestAt = -1;
    this.rivalHold = null;
    this.ticked.fill(false);
    this.prevTtl = NaN;
  }

  private resetSkill(): void {
    this.skillChain = 0;
    this.flowChain = 0;
    this.perfects = 0;
    this.kinds.clear();
    this.earnCap = 0;
    this.flowInDone = false;
    this.snuffAt = -1;
  }

  step(f: DirectorFrame): DirectorOutput {
    const beats = this.beats;
    beats.length = 0;
    const sim = f.sim;
    const s = sim.s;
    const run = this.run;
    const dt = Math.max(0, f.dt);
    this.clock += dt;
    const now = this.clock;
    const dTicks = Math.max(0, sim.tick - this.lastTick);
    this.lastTick = sim.tick;
    const live = f.phase === 'run' && !s.crashed;
    const haunted = run !== null && run.mood === Mood.Haunted;
    const motion = !f.reduced;
    // Every gap to a ghost pose is taken against the rider on the poses' own time base.
    const rz = f.riderZ !== undefined && Number.isFinite(f.riderZ) ? f.riderZ : s.z;
    this.rz = rz;

    // ---- Pre-scan the batch.
    const evs = this.simEvents;
    evs.length = 0;
    let lostStake = 0;
    const bumpTicks: number[] = [];
    const bankTicks: number[] = [];
    for (const p of f.events) {
      evs.push(p.e);
      const e = p.e;
      if (e.type === 'boost') {
        if (e.source === 'slingshot') this.lastSlingTick = Math.max(this.lastSlingTick, p.tick);
        this.slingBoost = e.source === 'slingshot';
      } else if (e.type === 'comboBank') bankTicks.push(p.tick);
      else if (e.type === 'bump') bumpTicks.push(p.tick);
      else if (e.type === 'comboLost') lostStake = e.points;
    }

    // Who has ever led you by 2 m (a start-line jostle is an edge past one that never did).
    if (live) {
      for (const t of f.tracks) {
        const p = f.poses.get(t.entry.id);
        if (p && !p.done && p.z - rz >= 2) this.ledBy2m.add(t.entry.id);
      }
    }

    // ---- New ground first: the 'you' wreck that sits right on it is then muted (it owns the beat).
    if (live && run && this.newGroundAt < 0 && run.bestDistAtStart >= 150 && sim.distance > run.bestDistAtStart) {
      this.newGroundAt = now;
      this.newGroundTick = sim.tick;
      this.push({ type: 'newGround', tick: sim.tick, z: run.bestDistAtStart, say: { label: 'New ground', points: 0, tone: 'best' } }, sim);
    }

    // ---- Duels, stepped with whole sim ticks.
    const resolved = new Map<number, 'won' | 'heldOff'>();
    if (live) {
      const gaps: Array<{ id: number; gap: number; live: boolean }> = [];
      for (const t of f.tracks) {
        if (!t.ready) continue;
        const p = f.poses.get(t.entry.id);
        if (!p) continue;
        gaps.push({ id: t.entry.id, gap: p.z - rz, live: !p.done });
      }
      // A duel's result holds the rival on its ghost (the pill's flash): the next opens once it can be named.
      const holding = this.rivalHold !== null && now < this.rivalHold.until;
      const canOpen = !holding && (this.pops.length === 0 || now - this.lastDuelEndAt >= DUEL_POP_GAP_S) && now - this.lastPopAt >= POP_BANNER_S;
      for (const d of this.duels.step(dTicks, sim.tick, gaps, canOpen)) {
        const t = f.tracks.find((k) => k.entry.id === d.id);
        if (!t) continue;
        const ghost = this.ref(t, f, sim);
        if (d.phase === 'open') this.duelOpenAt = now;
        else this.lastDuelEndAt = now;
        if (d.phase === 'won' || d.phase === 'heldOff' || d.phase === 'lost') this.rivalHold = { id: d.id, until: now + RIVAL_HOLD_S };
        if (d.phase === 'won' || d.phase === 'heldOff') {
          resolved.set(d.id, d.phase);
          this.duelEnd.set(d.id, sim.tick);
          this.choirIds.add(d.id);
          // You beat it where it could be seen: a shown pass (missions count it).
          this.shown.add(d.id);
          // Beating the grudge in a duel settles it (its passes were muted while the duel ran).
          if (t.entry.kind === 'grudge') this.settle(t, ghost, sim, haunted);
          const gifts = this.extras.take(DUEL_GIFTS * (haunted ? 2 : 1));
          this.push({ type: 'duel', tick: sim.tick, phase: d.phase, ghost, gifts }, sim);
          this.lastPassAt = now;
          // Your best, beaten in a duel and behind you now: 'Passed Your best' (C7) gets its moment
          // (the pass itself was muted inside the duel, and a duel with your own line runs long).
          const p = f.poses.get(d.id);
          if (t.entry.kind === 'you' && p && p.z < rz) {
            const ladder = ++this.ladderN;
            this.push({ type: 'pass', tick: sim.tick, ghost, word: 'yourBest', text: 'Passed', first: false, chain: 0, ladder, octave: ladderIndex(ladder).octave, gifts: 0, muted: false }, sim);
          }
        } else {
          this.push({ type: 'duel', tick: sim.tick, phase: d.phase, ghost, gifts: 0 }, sim);
          if (d.phase === 'lost') {
            this.push({ type: 'raceNews', tick: sim.tick, ghost, news: 'pulledAway', text: `${ghost.kind === 'you' ? 'Your best' : ghost.name} pulled away`, pan: Math.max(-0.7, Math.min(0.7, ghost.dx / 10)), gain: 0.6 }, sim);
            this.lastNewsAt = now;
          }
        }
      }
    }

    // ---- The race.
    let passedNow: GhostRef | null = null;
    for (const ev of f.race) {
      const t = ev.track;
      const id = t.entry.id;
      if (ev.type === 'crashed') {
        // A duel ghost going down is the duel's result (won), not news.
        if (this.duels.open === id || resolved.has(id) || this.afterDuel(id, sim.tick)) continue;
        const p = f.poses.get(id);
        if (!p) continue;
        const gap = p.z - rz;
        const ghost = this.ref(t, f, sim);
        const behind = gap < 0;
        // The grudge wiping out behind you settles it, and the wipeout is the banner's sub-line: one
        // moment, not a banner over nothing followed by a quiet line.
        if (live && behind && t.entry.kind === 'grudge' && !this.grudgeDone) {
          this.settle(t, ghost, sim, haunted, 'Wiped out behind you');
          this.lastNewsAt = now;
          continue;
        }
        if (behind ? -gap > WIPE_BEHIND || this.duels.open !== null : gap > WIPE_AHEAD) continue;
        const text = behind
          ? `${t.entry.kind === 'you' ? 'Your best' : t.entry.name} wiped out behind you`
          : t.entry.kind === 'you'
            ? 'Your best wiped out'
            : t.entry.kind === 'grudge'
              ? `${t.entry.name} wiped out. Pass the lantern`
              : `${t.entry.name} wiped out`;
        this.push({ type: 'raceNews', tick: sim.tick, ghost, news: behind ? 'wipeoutBehind' : 'wipeout', text, pan: Math.max(-0.7, Math.min(0.7, ghost.dx / 10)), gain: Math.max(0, Math.min(1, 1 - Math.abs(gap) / 300)) }, sim);
        this.lastNewsAt = now;
      } else if (ev.type === 'pass') {
        const ghost = this.ref(t, f, sim);
        const wreck = t.crashSeen;
        // Your best edged past in the start bunch still has its first pass to give.
        const first = ev.first || this.youJostled.has(id);
        const liveFirst = first && !wreck;
        const chainN = liveFirst && sim.tick - this.lastShownPassTick <= CHAIN_TICKS ? this.chainN + 1 : 1;
        const slungN = sim.tick - this.lastSlungPassTick <= SLING_TICKS ? this.slungN + 1 : 1;
        const c = classifyPass({
          tick: sim.tick,
          first,
          ghost,
          wreck,
          everLedBy2m: this.ledBy2m.has(id),
          lastSlingTick: this.lastSlingTick,
          lastShownPassTick: this.lastShownPassTick,
          chainN,
          slungN,
          passedYouBefore: this.passedYou.has(id),
          duel: resolved.get(id) ?? null,
          haunted,
          newGroundTick: this.newGroundTick,
        });
        // Passes with the duel ghost still pay a first pass but say nothing: the duel's result will (or
        // just did: the wreck of a ghost that crashed out of its duel is that result's, not a 'Beat').
        const muted = c.muted || (this.duels.open === id && !resolved.has(id)) || (wreck && this.afterDuel(id, sim.tick));
        if (c.word === 'slung' && !muted) {
          this.slungN = slungN;
          this.lastSlungPassTick = sim.tick;
        }
        // Settled before its pass flash: the banner the pass then names (and pays: the grudge's premium
        // is paid once, by the settle, never by a start-line jostle).
        if (!muted && t.entry.kind === 'grudge') this.settle(t, ghost, sim, haunted);
        let base = c.gifts;
        if (t.entry.kind === 'grudge') {
          base = Math.min(base, Math.max(0, this.grudgeTotal(t, haunted) - this.grudgePaid));
          this.grudgePaid += base;
        }
        // A muted start-line jostle of your best pays nothing yet and keeps its first pass for later.
        if (t.entry.kind === 'you' && c.word === 'jostle') {
          base = 0;
          this.youJostled.add(id);
        } else this.youJostled.delete(id);
        // Extras (slung, chained) are a shown moment's: a pass muted inside its own duel pays only its base.
        const gifts = base + (muted ? 0 : this.extras.take(c.extra));
        let ladder = this.ladderN;
        if (!muted && !wreck) ladder = ++this.ladderN;
        const li = ladderIndex(Math.max(1, ladder));
        this.push({ type: 'pass', tick: sim.tick, ghost, word: c.word, text: c.text, first: ev.first, chain: liveFirst && !muted ? chainN : 0, ladder: Math.max(1, ladder), octave: li.octave, gifts, muted }, sim);
        if (!muted) {
          this.shown.add(id);
          if (!wreck) this.choirIds.add(id);
          this.lastPassAt = now;
          if (liveFirst) {
            this.chainN = chainN;
            this.lastShownPassTick = sim.tick;
          }
          passedNow = ghost;
        }
      } else if (ev.type === 'passedBy') {
        this.passedYou.add(id);
        const muted = this.duels.open === id || (sim.tick < START_TICKS && !this.ledBy2m.has(id));
        this.push({ type: 'passedBy', tick: sim.tick, ghost: this.ref(t, f, sim), muted }, sim);
      }
    }

    // A grudge you only edged past (a muted jostle, a pass inside its duel) is settled for sure once
    // you ride past where its whole run ended: it can never come back. While it still rides behind you
    // (off screen), the settle waits for its wipeout (above), so the banner lands on something.
    if (live && !this.grudgeDone) {
      for (const t of f.tracks) {
        if (t.entry.kind !== 'grudge' || !t.ready || t.distance <= 0 || sim.distance <= t.distance) continue;
        const p = f.poses.get(t.entry.id);
        if (p && !p.done) continue;
        this.settle(t, this.ref(t, f, sim), sim, haunted);
      }
    }

    // Taking the lead: rank 1 after 10 s with 3 or more ghosts, one still riding. Once, or again after
    // losing it for 5 s.
    if (live) {
      const lead = f.standings.rank === 1 && f.standings.of - 1 >= LEAD_GHOSTS && sim.tick >= LEAD_TICKS && this.anyLive(f);
      if (lead) {
        this.leadLost = 0;
        if (!this.leading && this.leadArmed) {
          this.leadArmed = false;
          this.push({ type: 'lead', tick: sim.tick, of: f.standings.of }, sim);
        }
      } else if (f.standings.rank !== 1) {
        this.leadLost += dTicks;
        if (this.leadLost >= LEAD_REARM_TICKS) this.leadArmed = true;
      }
      this.leading = lead;
    }

    // ---- The sim events, in order. Finales go where the event they answer sits.
    const finales = this.finales.step(sim, evs, dt);
    const placed = new Array<boolean>(finales.length).fill(false);
    const placeFinales = (src: SimEvent) => {
      for (let i = 0; i < finales.length; i++) {
        if (!placed[i] && this.finales.sources[i] === src) {
          placed[i] = true;
          this.pushFinale(finales[i], sim, now, motion);
        }
      }
    };
    for (const p of f.events) {
      const e = p.e;
      switch (e.type) {
        case 'chaos':
          placeFinales(e);
          break;
        case 'style': {
          this.skill(e.kind, e.chain);
          if (e.kind === 'yetiHop') {
            this.yetiHopTick = p.tick;
            placeFinales(e);
            break;
          }
          // The avalanche's 2,000 is shown once, by its finale banner.
          if (e.kind === 'avalanche') break;
          if (e.kind === 'perfect') {
            this.stomp(p.tick, e.points, f, sim, motion);
            break;
          }
          if (e.kind === 'nearMiss') {
            const whisker = (e.gap ?? Infinity) < WHISKER_GAP && s.speed >= WHISKER_SPEED;
            if (whisker && motion) this.time.pulse(HITSTOP_SCALE, 0.05, 'feed');
            this.push(
              {
                type: 'nearMiss',
                tick: p.tick,
                grade: whisker ? 'whisker' : 'near',
                gap: e.gap ?? 1,
                side: e.side ?? 1,
                x: e.x ?? s.x,
                z: e.z ?? s.z,
                obs: e.obs ?? 'pine',
                speed: s.speed,
                say: whisker ? { label: 'Whisker', points: e.points, tone: 'big' } : { label: 'Near miss', points: e.points, tone: 'normal' },
              },
              sim,
            );
            break;
          }
          let label = STYLE_LABEL[e.kind];
          // Every number on a callout carries its label, and "x" is the combo multiplier's alone.
          if (e.kind === 'spin' && this.lastLand && this.lastLand.halfTurns > 0) label = `Spin ${this.lastLand.halfTurns * 180}`;
          if (e.kind === 'flip' && this.lastLand) label = FLIPS[Math.max(1, this.lastLand.flips) - 1] ?? `${this.lastLand.flips} Backflips`;
          if (e.kind === 'drift') label = this.lastReleaseTier >= 3 ? 'Max drift' : this.lastReleaseTier === 2 ? 'Big drift' : label;
          this.push({ type: 'callout', tick: p.tick, source: e.kind, say: { label, points: e.points, tone: styleTone(e.kind, e.points) } }, sim);
          break;
        }
        case 'land':
          this.lastLand = { halfTurns: e.halfTurns, flips: e.flips };
          if (e.quality === 'perfect') break; // (its stomp came with the 'perfect' style event)
          if (e.quality === 'sketchy') {
            const r = this.streak.land('sketchy', false, p.tick);
            // A botched landing puts out the flow it had earned: 'Flow broken' is then its line (a broken
            // streak keeps its own, and the snuff goes without words).
            const snuff = this.canSnuff();
            if (r.broke >= 3) this.push({ type: 'streakBroken', tick: p.tick, was: r.broke, say: { label: 'Streak broken', points: 0, tone: 'lost' } }, sim);
            else if (!snuff) this.push({ type: 'callout', tick: p.tick, source: 'sketchy', say: { label: 'Sketchy', points: 0, tone: 'lost' } }, sim);
            if (snuff) this.snuff(p.tick, sim, now, r.broke < 3);
          } else this.streak.land(e.quality, e.late, p.tick);
          break;
        case 'drift':
          if (e.phase === 'release') {
            this.lastReleaseTier = e.tier;
            if (e.tier >= 1) {
              const tier = Math.min(3, e.tier) as 1 | 2 | 3;
              if (tier === 3 && motion) this.time.pulse(HITSTOP_SCALE, 0.07, 'feed');
              this.push({ type: 'driftRelease', tick: p.tick, tier, x: s.x, z: s.z, heading: s.heading, driftDir: s.driftDir }, sim);
            }
          } else if (e.phase === 'start') this.lastReleaseTier = 0;
          break;
        case 'comboBank': {
          const bump = bumpTicks.includes(p.tick);
          // Graded against your best combo at the start, or this run's best bank once one beat it (a
          // second bank under the first is no new best). A save with no best combo yet grades by size
          // alone: a first record is no news, or every bigger bank of a first run would slam tier 3.
          const best = this.comboBest(run?.bestComboAtStart ?? 0);
          const tier = bankTier(e.points, this.skillChain, best);
          const header = bankHeader(e.points, tier, best);
          if (!bump && motion) {
            if (tier === 2) this.time.pulse(HITSTOP_SCALE, 0.06, 'feed');
            else if (tier === 3) this.time.pulse(HITSTOP_SCALE, 0.08, 'feed');
          }
          this.push({ type: 'bank', tick: p.tick, points: e.points, mult: e.mult, origin: Math.round(e.points / Math.max(1, e.mult)), tier, header, bump }, sim);
          this.bestBank = Math.max(this.bestBank, e.points);
          this.bankUntil = Math.max(this.bankUntil, now + BANK_MS[tier] / 1000);
          // A bump knocked the combo out of you: the flow it earned goes out with it.
          if (bump && this.canSnuff()) this.snuff(p.tick, sim, now, true);
          if (bump) this.earnCap = 0;
          this.skillChain = 0;
          this.flowChain = 0;
          this.perfects = 0;
          break;
        }
        case 'bump': {
          const side = this.bumpSide(sim, e.id);
          this.push({ type: 'bump', tick: p.tick, side, bank: bankTicks.includes(p.tick) }, sim);
          break;
        }
        case 'comboLost': {
          // The same measure as the banks: a combo under one this run already banked is no best.
          const best = this.comboBest(run?.bestComboAtStart ?? 0);
          const isBest = best > 0 && e.points > best;
          this.push({ type: 'comboLost', tick: p.tick, points: e.points, stake: e.points, best: isBest, crack: e.points >= 300, say: { label: isBest ? 'Best combo lost' : 'Combo lost', points: e.points, tone: 'lost' } }, sim);
          // The crash took the combo, and its flow goes out with it: the glow is snuffed, but the crash
          // and 'Combo lost' own the moment, so no 'Flow broken' beat.
          if (this.canSnuff()) this.snuffDisplay(now);
          this.skillChain = 0;
          this.flowChain = 0;
          this.perfects = 0;
          break;
        }
        case 'crash':
          this.streak.crash();
          this.duels.crash();
          this.newBestAt = -1;
          if (motion) this.time.curve(CRASH_CURVE, 'render');
          this.crashT = 0;
          this.push({ type: 'crash', tick: p.tick, cause: e.cause, stake: lostStake, orbitFrom: this.orbitFrom(f, sim) }, sim);
          break;
        default:
          break;
      }
    }
    this.streak.tick(sim.tick);
    for (let i = 0; i < finales.length; i++) if (!placed[i]) this.pushFinale(finales[i], sim, now, motion);

    // ---- State beats.
    const c = sim.combo;
    const stake = c.active ? Math.round(c.pending * c.multiplier) : 0;
    if (live && run) {
      // New best: the first time the score passes the best this mountain had at the start (once per
      // run, never again after a revive). A bank that crossed it (or any cash-in still on screen)
      // lands first: New best waits out its tier's whole BANK_MS, so 'new best' never reads twice.
      if (!this.newBestDone && run.bestScoreAtStart > 0 && sim.score > run.bestScoreAtStart) {
        this.newBestDone = true;
        this.newBestAt = now;
      }
      if (this.newBestAt >= 0 && this.newBestAt < this.bankUntil) this.newBestAt = this.bankUntil;
      // New ground just had its moment (an early save often crosses both together): New best waits.
      // New ground less than NEW_GROUND_GAP_S of riding away holds it too, then goes first.
      if (this.newBestAt >= 0 && this.newGroundAt >= 0 && this.newBestAt - this.newGroundAt < NEW_GROUND_GAP_S) this.newBestAt = this.newGroundAt + NEW_BEST_DEFER_S;
      else if (this.newBestAt >= 0 && now >= this.newBestAt && this.newGroundAt < 0 && run.bestDistAtStart >= 150) {
        const left = run.bestDistAtStart - sim.distance;
        if (left > 0 && left < Math.max(0, s.speed) * NEW_GROUND_GAP_S) this.newBestAt = now + 0.05;
      }
      if (this.newBestAt >= 0 && now >= this.newBestAt) {
        this.newBestAt = -1;
        this.push({ type: 'newBest', tick: sim.tick, score: sim.score, say: { label: 'New best', points: 0, tone: 'best' } }, sim);
      }
      if (!this.paceDone && run.bestComboAtStart >= 1000 && stake > run.bestComboAtStart) {
        this.paceDone = true;
        this.push({ type: 'bestComboPace', tick: sim.tick, stake, say: { label: 'Best combo pace', points: 0, tone: 'best' } }, sim);
      }
      const fr = run.friend;
      if (fr && !this.friendDone && fr.distance > 0 && sim.distance > fr.distance) {
        this.friendDone = true;
        this.push({ type: 'friendBeaten', tick: sim.tick, name: fr.name, distance: fr.distance, say: { label: friendBeatenText(fr.name, fr.distance), points: 0, tone: 'big' } }, sim);
      }
      const km = Math.floor(sim.distance / 1000);
      if (km > this.kmDone) {
        this.kmDone = km;
        this.push({ type: 'km', tick: sim.tick, km, say: { label: `${km} km`, points: 0, tone: 'big' } }, sim);
      }
      // A graveyard ridden 20 m past alive: survived, once per run (a revive keeps what was survived).
      const graves = run.graveyards;
      if (graves) {
        for (let i = 0; i < graves.length; i++) {
          const g = graves[i];
          if (this.gravesDone.has(i) || sim.distance < g.z + GRAVE_PAST) continue;
          this.gravesDone.add(i);
          const gifts = this.extras.take(GRAVE_GIFTS);
          this.push({ type: 'graveyard', tick: sim.tick, name: g.name, fell: g.fell, gifts, say: { label: `Survived ${g.name}`, points: 0, tone: 'big' } }, sim);
        }
      }
      this.metronome(f, sim);
      this.tricks(f, sim, now);
      this.raceCall(f, sim, now);
      this.queuePops(f, sim, now, dt, passedNow);
    }
    if (!live) this.pops.length = 0;

    // ---- Continuous state for this frame.
    const feel = this.feel;
    const earned = Math.min(s.flow, this.earnCap);
    if (dt > 0) this.flowShown += (earned - this.flowShown) * (1 - Math.exp(-dt / FLOW_SMOOTH_S));
    // The snuff's display cap takes the glow to 0 over 0.15 s; then the shown flow starts again from
    // nothing (so the next move never flashes the old glow back).
    if (this.snuffAt >= 0 && now - this.snuffAt >= SNUFF_S) {
      this.snuffAt = -1;
      this.flowShown = Math.min(this.flowShown, earned);
    }
    let shown = this.flowShown;
    if (this.snuffAt >= 0) shown = Math.min(shown, Math.max(0, this.snuffFrom * (1 - (now - this.snuffAt) / SNUFF_S)));
    if (live && !this.flowInDone && shown >= FLOW_IN_AT && this.kinds.size >= FLOW_IN_KINDS) {
      this.flowInDone = true;
      this.pulseAt = now;
      this.push({ type: 'flow', tick: sim.tick, phase: 'in', say: { label: 'In the flow', points: 0, tone: 'big' } }, sim);
    }
    const fk = Math.pow(smoothstep(0.5, FLOW_FULL, shown), 0.8);
    if (this.crashT >= 0) this.crashT += dt * this.time.render;

    feel.reduced = f.reduced;
    feel.flow = fk;
    feel.flowPulse = this.pulseAt >= 0 ? Math.max(0, 1 - (now - this.pulseAt) / FLOW_PULSE_S) : 0;
    feel.driftCharge = s.drifting ? Math.max(0, Math.min(1, s.driftCharge / 2.4)) : 0;
    feel.driftTier = s.drifting ? s.driftTier : 0;
    feel.streak = this.streak.n;
    feel.timeFeed = this.time.feed;
    feel.timeRender = this.time.render;
    feel.shakeScale = this.time.shake;
    feel.crashT = this.crashT;
    feel.duelId = this.duels.open;
    if (run && run.bestDistAtStart >= 150) {
      const k = this.newGroundAt >= 0 ? Math.max(0, 1 - (now - this.newGroundAt) / 0.6) : 0;
      const bl = feel.bestLine;
      if (bl && bl.distance === run.bestDistAtStart) {
        bl.z = run.bestDistAtStart;
        bl.k = k;
      } else feel.bestLine = { z: run.bestDistAtStart, k, distance: run.bestDistAtStart };
    } else feel.bestLine = null;
    const fr = run?.friend;
    if (fr && fr.distance > 0 && !this.friendDone) {
      if (!feel.friendLine || feel.friendLine.name !== fr.name || feel.friendLine.distance !== fr.distance) feel.friendLine = { z: fr.distance, name: fr.name, distance: fr.distance };
    } else feel.friendLine = null;

    const out = this.out;
    // One rival for the pill, the C11 ring and the camera: an open duel, a duel's result while it
    // flashes, the start-line call, else the nearest riding ghost ahead (or behind within 150 m).
    const duelId = this.duels.open;
    const callUp = this.call && now - this.call.at < CALL_HOLD_S ? this.call.id : null;
    if (this.rivalHold && now >= this.rivalHold.until) this.rivalHold = null;
    const steady = steadyNext(this.riderGap(this.heldNext, f), this.nearestRider(f), now - this.heldSince);
    const sid = steady ? steady.id : null;
    if (sid !== this.heldNext) {
      this.heldNext = sid;
      this.heldSince = now;
    }
    out.rival = rivalPick(steady, this.gapOf(duelId, f), this.gapOf(callUp, f), this.gapOf(this.rivalHold ? this.rivalHold.id : null, f));

    const timerFrac = c.window > 0 ? c.timer / c.window : 0;
    const draining = c.active && s.grounded && !s.drifting && !s.drafting;
    out.hud.stake = stake;
    out.hud.fuse = fuseLevel(stake, timerFrac, draining);
    out.hud.pace = this.paceDone && c.active && run !== null && run.bestComboAtStart >= 1000 && stake > run.bestComboAtStart;
    out.hud.duel = duelId !== null;
    out.hud.bestIn = null;
    if (run && run.bestDistAtStart >= 150 && this.newGroundAt < 0 && !s.crashed) {
      const d = run.bestDistAtStart - sim.distance;
      if (d > 0 && d <= 250) out.hud.bestIn = Math.max(10, Math.ceil(d / 10) * 10);
    }
    out.hud.countdown = this.finales.countdown(sim);

    const a = out.audio;
    a.flow = fk;
    a.driftCharge = feel.driftCharge;
    a.skillChain = this.skillChain;
    a.skillMult = skillMult(this.skillChain);
    a.earnedFlow = earned;
    a.race = live && (duelId !== null || this.anyNear(f, 8)) ? 0.06 : 0;
    a.duel = duelId !== null ? this.duels.amount : 0;
    a.shoulder = live && !s.drafting ? this.shoulder(f, sim) : null;
    a.fuse = out.hud.fuse;
    a.streak = this.streak.n;
    a.countIn = run !== null && run.hasReveal && now < run.revealLeaveS;
    a.lift = (this.newGroundAt >= 0 ? LIFT_NEW_GROUND : 0) + (this.avalancheAt >= 0 ? LIFT_AVALANCHE * Math.max(0, 1 - (now - this.avalancheAt) / LIFT_AVALANCHE_S) : 0);
    a.choir = live ? this.choir(f) : 0;
    // The latest boost was a slingshot and its pool still pushes: the pack's speed, not skill.
    if (this.slingBoost && !((s.boostPool ?? 0) > 0.2)) this.slingBoost = false;
    a.drafting = s.drafting || this.slingBoost;
    return out;
  }

  /** The ghost choir: ghosts you passed this run (shown, live, or beaten in a duel) that are still
   *  riding, behind you and within CHOIR_BEHIND metres; 0..CHOIR_MAX. */
  private choir(f: DirectorFrame): number {
    let n = 0;
    for (const id of this.choirIds) {
      const p = f.poses.get(id);
      if (!p || p.done) continue;
      const back = this.rz - p.z;
      if (back > 0 && back <= CHOIR_BEHIND && ++n >= CHOIR_MAX) break;
    }
    return n;
  }

  // ------------------------------------------------------------------ pieces

  /** A style event's part in the live combo's skill: drafting and slingshots (the pack's speed, not a
   *  move) never count, as a step or as a kind. A new combo starts over. */
  private skill(kind: StyleKind, chain: number): void {
    if (chain <= 1) {
      this.skillChain = 0;
      this.flowChain = 0;
      this.perfects = 0;
      this.kinds.clear();
      this.flowInDone = false;
    }
    if (kind === 'draft' || kind === 'slingshot') return;
    this.skillChain++;
    this.flowChain++;
    this.kinds.add(kind);
    if (kind === 'perfect') this.perfects++;
    this.earnCap = this.flowChain / 4 + 0.5 * this.perfects;
  }

  /** The shown flow is high enough to be put out, and no snuff is already taking it down. */
  private canSnuff(): boolean {
    return this.flowShown >= FLOW_SNUFF_MIN && this.snuffAt < 0;
  }

  /** The glow goes to 0 over SNUFF_S and the flow's earning starts over: the moves before it no longer
   *  count toward the cap, the kinds or 'In the flow'. */
  private snuffDisplay(now: number): void {
    this.snuffAt = now;
    this.snuffFrom = this.flowShown;
    this.earnCap = 0;
    this.flowChain = 0;
    this.perfects = 0;
    this.kinds.clear();
    this.flowInDone = false;
  }

  /** 'Flow broken': the snuff's beat (the scarf's puff and the wind's bend), with its line when `say`. */
  private snuff(tick: number, sim: Sim, now: number, say: boolean): void {
    this.snuffDisplay(now);
    const b: BeatOf<'flow'> = { type: 'flow', tick, phase: 'snuff' };
    if (say) b.say = { label: 'Flow broken', points: 0, tone: 'normal' };
    this.push(b, sim);
  }

  /** What beating the grudge is worth in all: 10, or 20 for a nemesis; x2 in Haunted Hollow. */
  private grudgeTotal(t: GhostTrack, haunted: boolean): number {
    return (t.entry.nemesis ? 20 : 10) * (haunted ? 2 : 1);
  }

  /** The grudge settled, once per run: the banner ('Grudge settled' or 'Nemesis down'). paid is what
   *  the app credits here: the whole of grudgeTotal less what its passes already paid (a start-line
   *  jostle pays only a pass's base), so the premium is paid once. `sub` names a merged moment (its
   *  wipeout behind you) on the beat's say, for the banner's sub-line. */
  private settle(t: GhostTrack, ghost: GhostRef, sim: Sim, haunted: boolean, sub?: string): void {
    if (this.grudgeDone) return;
    this.grudgeDone = true;
    const g = this.run?.grudgeAtStart;
    const nemesis = !!t.entry.nemesis;
    const total = this.grudgeTotal(t, haunted);
    const paid = Math.max(0, total - this.grudgePaid);
    this.grudgePaid = Math.max(this.grudgePaid, total);
    const b: BeatOf<'grudgeSettled'> = { type: 'grudgeSettled', tick: sim.tick, ghost, nemesis, after: g ? (nemesis ? Math.max(g.streak, g.them) : g.them) : 1, paid };
    if (sub) b.say = { label: sub, points: 0, tone: 'normal' };
    this.push(b, sim);
  }

  /** A perfect landing's stamp: its streak, title and lead parts, and the hit-stop that grows. */
  private stomp(tick: number, points: number, f: DirectorFrame, sim: Sim, motion: boolean): void {
    let late = false;
    for (const p of f.events) if (p.tick === tick && p.e.type === 'land' && p.e.quality === 'perfect') late = p.e.late;
    const n = this.streak.land('perfect', late, tick).n;
    const line = streakLine(n);
    // 'PERFECT LANDING' over 'STOMP +250': the word is never said twice on one stamp.
    const lead: Array<{ label: string; points: number }> = [line ? { label: line, points: 0 } : { label: 'Stomp', points }];
    // A yeti hop keeps its title; its 1,500 is the hop's own finale stamp ('+1,500 style'), shown once.
    const yeti = tick - this.yetiHopTick >= 0 && tick - this.yetiHopTick <= YETI_TITLE_TICKS;
    if (motion) this.time.pulse(HITSTOP_SCALE, STOMP_STOP[Math.min(n, STOMP_STOP.length) - 1] ?? 0.13, 'feed');
    this.lastStompAt = this.clock;
    const s = sim.s;
    this.push({ type: 'stomp', tick, streak: n, late, title: yeti ? 'Yeti hop' : stompTitle(n), lead, x: s.x, z: s.z, heading: s.heading, yetiHop: yeti }, sim);
  }

  private pushFinale(b: BeatOf<'finale'>, sim: Sim, now: number, motion: boolean): void {
    const g = b.gifts > 0 ? this.extras.take(b.gifts) : 0;
    if (g !== b.gifts) {
      // The run's extras ran out: the line says only what was credited.
      b.gifts = g;
      if (b.outcome === 'caught' && b.sub) b.sub = g > 0 ? `Clean sweep: +${g} gifts` : 'Clean sweep';
      else if (b.outcome === 'rode') b.sub = g > 0 ? `+${g} gifts` : null;
    }
    if (b.stamp && motion) this.time.pulse(HITSTOP_SCALE, 0.1, 'feed');
    if (b.outcome === 'outran') this.avalancheAt = now;
    if (b.banner) this.lastFinaleAt = now;
    this.push(b, sim);
  }

  /** Which way a bump knocked you: away from the obstacle (its nearest point; a log is a segment). */
  private bumpSide(sim: Sim, id: number): -1 | 1 {
    const s = sim.s;
    const course = (sim as Partial<Sim>).course;
    if (!course) return 1;
    const k = Math.floor(id / 256);
    for (const ci of [k, k - 1, k + 1]) {
      if (ci < 0) continue;
      const o = course.chunk(ci).obstacles.find((ob) => ob.id === id);
      if (!o) continue;
      let px = o.x;
      if (o.x2 !== o.x || o.z2 !== o.z) {
        const ex = o.x2 - o.x;
        const ez = o.z2 - o.z;
        const t = Math.max(0, Math.min(1, ((s.x - o.x) * ex + (s.z - o.z) * ez) / (ex * ex + ez * ez)));
        px = o.x + ex * t;
      }
      return px > s.x ? -1 : 1;
    }
    return 1;
  }

  /** The bearing (sim heading convention) of the nearest live ghost within 60 m behind or abreast. */
  private orbitFrom(f: DirectorFrame, sim: Sim): number | null {
    const s = sim.s;
    let best = Infinity;
    let out: number | null = null;
    for (const t of f.tracks) {
      const p = f.poses.get(t.entry.id);
      if (!p || p.done) continue;
      const dz = p.z - this.rz;
      if (dz > 3 || dz < -60) continue;
      const dx = p.x - s.x;
      const d = dx * dx + dz * dz;
      if (d < best) {
        best = d;
        out = Math.atan2(dx, dz);
      }
    }
    return out;
  }

  /** The stomp metronome: ticks as the landing ring closes, the open note on the stomp window. */
  private metronome(f: DirectorFrame, sim: Sim): void {
    if (sim.s.grounded || f.airTicks <= 14 || !Number.isFinite(f.timeToLand)) {
      if (sim.s.grounded) {
        this.ticked.fill(false);
        this.prevTtl = NaN;
      }
      return;
    }
    const ttl = f.timeToLand;
    const flight = f.airTicks / 60 + ttl;
    if (Number.isNaN(this.prevTtl)) {
      // The first look at this flight: crossings already behind it stay silent.
      for (let i = 0; i < TICK_AT.length; i++) if (ttl <= TICK_AT[i]) this.ticked[i] = true;
      this.prevTtl = ttl;
      return;
    }
    for (let i = 0; i < TICK_AT.length; i++) {
      if (this.ticked[i]) continue;
      if (i === 0 && flight <= 0.8) continue;
      if (this.prevTtl > TICK_AT[i] && ttl <= TICK_AT[i]) {
        // (Latched for the flight: a re-prediction that jumps back up never repeats a tick.)
        for (let j = 0; j <= i; j++) this.ticked[j] = true;
        this.push({ type: 'stompTick', tick: sim.tick, step: TICK_STEP[i], open: i === TICK_AT.length - 1 }, sim);
        break;
      }
    }
    this.prevTtl = ttl;
  }

  /** Ghosts show off: a rival near you landing a trick is whispered, at most once per 1.5 s. */
  private tricks(f: DirectorFrame, sim: Sim, now: number): void {
    const tick = sim.tick;
    let fired = now - this.lastWhisperAt < WHISPER_S;
    for (const t of f.tracks) {
      const tr = t.tricks;
      if (!t.ready || !tr || tr.length < 4) continue;
      const id = t.entry.id;
      const n = tr.length >> 2;
      let i = this.cursors.get(id);
      if (i === undefined) {
        // First seen (the worker's reply may land mid-run): tricks already behind it stay quiet.
        i = 0;
        while (i < n && tr[i * 4] <= tick) i++;
        this.cursors.set(id, i);
        continue;
      }
      while (i < n && tr[i * 4] <= tick) {
        const q = tr[i * 4 + 1];
        const word = trickWord(tr[i * 4 + 2], tr[i * 4 + 3]);
        i++;
        if (fired) continue;
        const p = f.poses.get(id);
        if (!p || p.done) continue;
        const gap = p.z - this.rz;
        if (gap > TRICK_AHEAD || gap < -TRICK_BEHIND) continue;
        fired = true;
        this.lastWhisperAt = now;
        this.push({ type: 'ghostTrick', tick, ghost: this.ref(t, f, sim), quality: q === 1 ? 'perfect' : q === 2 ? 'sketchy' : 'clean', word, x: p.x, y: p.y, z: p.z }, sim);
      }
      this.cursors.set(id, i);
    }
  }

  /** The best combo a bank must beat to be news: your best at the start, raised by this run's banks;
   *  none (0) on a save with no best combo yet. */
  private comboBest(atStart: number): number {
    return atStart > 0 ? Math.max(atStart, this.bestBank) : 0;
  }

  /** The start-line call, on the first frame its ghost is ready (after the reveal card, if any). */
  private raceCall(f: DirectorFrame, sim: Sim, now: number): void {
    const run = this.run;
    if (this.callDone || !run) return;
    const at = run.hasReveal ? run.revealLeaveS + 0.3 : 0.6;
    const field = f.tracks.map((t) => ({ id: t.entry.id, kind: t.entry.kind, role: t.entry.role, ready: t.ready, nemesis: t.entry.nemesis }));
    if (this.fieldReadyAt < 0 && field.some((g) => g.ready)) this.fieldReadyAt = now;
    // Some ghost in the field will get the call once it is ready: pops wait for it, though not past the
    // usual give-up while no track has loaded at all (the call itself may still come late).
    this.callWaiting = callPick(field.map((g) => ({ ...g, ready: true })), run.bestDistAtStart) !== null && (this.fieldReadyAt >= 0 || now <= at + CALL_GIVE_UP_S);
    if (now < at) return;
    const pick = callPick(field, run.bestDistAtStart);
    if (!pick) {
      const giveUp = this.fieldReadyAt >= 0 ? Math.max(at, this.fieldReadyAt) + CALL_GIVE_UP_S : at + CALL_LATE_S;
      if (now > giveUp) {
        this.callDone = true;
        this.callWaiting = false;
      }
      return;
    }
    const t = f.tracks.find((k) => k.entry.id === pick.id);
    if (!t) return;
    this.callDone = true;
    this.callWaiting = false;
    this.call = { id: pick.id, at: now };
    const ghost = this.ref(t, f, sim);
    const name = t.entry.kind === 'you' ? 'Your best' : t.entry.name;
    let sr = `${pick.word} ${name}.`;
    const g = run.grudgeAtStart;
    if (t.entry.kind === 'friend' && run.friend) sr += ` ${name} rode ${fmtInt(run.friend.distance)} m.`;
    else if (t.entry.kind === 'grudge' && g) sr += g.streak >= 2 ? ` ${name} beat you ${g.streak} runs running.` : ` ${name} beat you last time.`;
    else if (t.entry.kind === 'you') sr += ` ${fmtInt(run.bestDistAtStart)} m.`;
    this.push({ type: 'raceCall', tick: sim.tick, ghost, word: pick.word, sr }, sim);
  }

  /** Mission and unlock pops: polled at 2 Hz, then held until nothing else owns the moment. */
  private queuePops(f: DirectorFrame, sim: Sim, now: number, dt: number, passed: GhostRef | null): void {
    const run = this.run;
    if (!run) return;
    if (sim.tick >= START_TICKS && now >= this.pollAt) {
      this.pollAt = now + 0.5;
      for (const m of run.missionsCrossed()) this.pops.push({ beat: { type: 'missionPop', tick: sim.tick, id: m.id, text: m.text, reward: m.reward }, since: now, waited: 0 });
    }
    // Unlocks live: jostle and wreck passes count, as they do when the run settles. But the new
    // mountain is news only once you have overtaken someone you saw: start-line jostles alone never
    // pop it (they still count toward it, and the results still show it).
    const have = run.lifetimePassed + f.passedThisRun;
    let tease: { name: string } | null = null;
    for (const u of run.unlockLadder) {
      if (this.unlockDone.has(u.id)) continue;
      if (have >= u.need) {
        if (this.shown.size === 0) continue;
        this.unlockDone.add(u.id);
        this.pops.push({ beat: { type: 'unlockPop', tick: sim.tick, id: u.id, name: u.name, biome: u.biome }, since: now, waited: 0 });
      } else if (!tease && u.need - have === 1) tease = u;
    }
    if (passed && tease && !this.teased) {
      this.teased = true;
      this.push({ type: 'raceNews', tick: sim.tick, ghost: passed, news: 'unlockTease', text: `1 more ghost opens ${tease.name}`, pan: 0, gain: 0 }, sim);
      this.lastNewsAt = now;
    }
    // Only the head of the queue (a waiting unlock, else the oldest mission) runs its give-up clock;
    // anything more than POP_LATE_S after its moment goes regardless.
    const head = this.pops.findIndex((q) => q.beat.type === 'unlockPop');
    if (this.pops.length) this.pops[Math.max(0, head)].waited += dt;
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      if (p.waited > (p.beat.type === 'unlockPop' ? UNLOCK_GIVE_UP_S : MISSION_GIVE_UP_S) || now - p.since > POP_LATE_S) this.pops.splice(i, 1);
    }
    if (!this.pops.length) return;
    const clear =
      now - this.lastStompAt >= POP_DEFER.stomp / 1000 &&
      now - this.lastPassAt >= POP_DEFER.pass / 1000 &&
      now - this.lastNewsAt >= POP_DEFER.news / 1000 &&
      // An open duel holds a pop only while it is fresh (it lives in the pill; the pop in the notice slot).
      (this.duels.open === null || now - this.duelOpenAt >= DUEL_POP_BLOCK_S) &&
      // The start-line call goes first: a pop waits while its ghost gets ready, then while it shows.
      !(this.callWaiting && !this.callDone) &&
      !(this.call && now - this.call.at < POP_DEFER.call / 1000) &&
      now - this.lastFinaleAt >= FINALE_HOLD_S &&
      !this.finales.pending &&
      now - this.lastPopAt >= (this.lastPopUnlock ? UNLOCK_BANNER_S + AFTER_UNLOCK_S : POP_DEFER.spacing / 1000);
    if (!clear) return;
    // A waiting unlock goes before any mission.
    const p = this.pops.splice(Math.max(0, this.pops.findIndex((q) => q.beat.type === 'unlockPop')), 1)[0];
    p.beat.tick = sim.tick;
    this.lastPopAt = now;
    this.lastPopUnlock = p.beat.type === 'unlockPop';
    this.push(p.beat, sim);
  }

  /** Shoulder wind: the nearest live ghost closing on you from behind, within 6 m and 4 m aside. */
  private shoulder(f: DirectorFrame, sim: Sim): { amt: number; pan: number } | null {
    const s = sim.s;
    let best: GhostPose | null = null;
    let bg = Infinity;
    for (const t of f.tracks) {
      const p = f.poses.get(t.entry.id);
      if (!p || p.done) continue;
      const back = this.rz - p.z;
      if (back <= 0 || back >= 6 || Math.abs(p.x - s.x) >= 4) continue;
      if (back < bg) {
        bg = back;
        best = p;
      }
    }
    if (!best) return null;
    const k = 1 - bg / 6;
    return { amt: k * k, pan: Math.max(-0.85, Math.min(0.85, (best.x - s.x) / 3)) };
  }

  /** A duel with this ghost resolved won or held off within DUEL_AFTER_TICKS. */
  private afterDuel(id: number, tick: number): boolean {
    const t = this.duelEnd.get(id);
    return t !== undefined && tick - t <= DUEL_AFTER_TICKS;
  }

  private anyNear(f: DirectorFrame, m: number): boolean {
    for (const t of f.tracks) {
      const p = f.poses.get(t.entry.id);
      if (p && !p.done && Math.abs(p.z - this.rz) < m) return true;
    }
    return false;
  }

  private anyLive(f: DirectorFrame): boolean {
    for (const t of f.tracks) {
      const p = f.poses.get(t.entry.id);
      if (p && !p.done) return true;
    }
    return false;
  }

  /** A ghost's gap (ghost minus rider, + = ahead), pose and rider on the same render tick. */
  private gapOf(id: number | null, f: DirectorFrame): { id: number; gap: number } | null {
    if (id === null) return null;
    const p = f.poses.get(id);
    return p ? { id, gap: p.z - this.rz } : null;
  }

  /** A ghost the rival pill may name: still riding, and ahead or no more than RIVAL_BEHIND_M behind. */
  private riderGap(id: number | null, f: DirectorFrame): { id: number; gap: number } | null {
    if (id === null) return null;
    const p = f.poses.get(id);
    if (!p || p.done) return null;
    const gap = p.z - this.rz;
    return gap >= -RIVAL_BEHIND_M ? { id, gap } : null;
  }

  /** The nearest riding ghost ahead, else the nearest riding ghost behind within RIVAL_BEHIND_M, else
   *  none: a wreck, or a ghost a kilometre back, is no race ('fjord348 1974 m behind'). */
  private nearestRider(f: DirectorFrame): { id: number; gap: number } | null {
    let ahead: { id: number; gap: number } | null = null;
    let behind: { id: number; gap: number } | null = null;
    for (const t of f.tracks) {
      if (!t.ready) continue;
      const g = this.riderGap(t.entry.id, f);
      if (!g) continue;
      if (g.gap > 0) {
        if (!ahead || g.gap < ahead.gap) ahead = g;
      } else if (!behind || g.gap > behind.gap) behind = g;
    }
    return ahead ?? behind;
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
    if (b.say) entry.label = b.say.label;
    switch (b.type) {
      case 'stomp':
        entry.label = b.title;
        entry.tier = b.streak;
        break;
      case 'pass':
        entry.label = b.ghost.name;
        entry.word = b.word;
        entry.gifts = b.gifts;
        break;
      case 'passedBy':
      case 'grudgeSettled':
      case 'raceCall':
        entry.label = b.ghost.name;
        break;
      case 'raceNews':
        entry.label = b.text;
        break;
      case 'duel':
        entry.label = b.ghost.name;
        entry.grade = b.phase;
        entry.gifts = b.gifts;
        break;
      case 'bank':
        entry.tier = b.tier;
        break;
      case 'driftRelease':
        entry.tier = b.tier;
        break;
      case 'nearMiss':
        entry.grade = b.grade;
        break;
      case 'flow':
        entry.grade = b.phase;
        break;
      case 'finale':
        entry.label = b.text;
        entry.gifts = b.gifts;
        entry.grade = String(b.grade);
        break;
      case 'missionPop':
        entry.label = b.text;
        break;
      case 'unlockPop':
        entry.label = b.name;
        break;
      case 'graveyard':
        entry.gifts = b.gifts;
        break;
      default:
        break;
    }
    if (this.log.length >= LOG_MAX) this.log.shift();
    this.log.push(entry);
  }
}
