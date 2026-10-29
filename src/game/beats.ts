// Named moments. The Director turns sim events, race events and sim state into Beats once per
// frame. The app hands the SAME list to ui.beats(list), audio.beats(list) (before audio.simEvent
// for that frame's raw events) and world.frame({ beats, feel }). The list array is reused next
// frame: consumers never keep it. Beats are discrete; continuous state travels in Feel, HudModel
// and AudioFrame. Beats never mutate economy: the app credits `gifts` fields (only on beats that
// say "credited") into passBonus; never sim.score.
import type { ChaosEvent } from '../sim/chaos';
import type { CrashCause } from '../sim/sim';
import type { ObstacleKind } from '../sim/course';
import type { StyleKind } from '../sim/scoring';
import type { BiomeId } from '../sim/mountains';
import type { GhostKind, StyleTone } from '../ui/contract';

// ---------- shared constants (single source for every consumer)
export const WHISKER_GAP = 0.45; // m, edge gap (about 19% of fast near misses in the pool replays grade Whisker)
export const WHISKER_SPEED = 18; // m/s
export const CRASH_FREEZE_S = 0.45; // chase lens holds (scaled render time)
export const CRASH_RESULTS_MS = 1150;
export const CRASH_RESULTS_REDUCED_MS = 950;
export const EXTRA_GIFTS_CAP = 30; // per run: chains, slung, duels, finales, graveyards
export const DRIFT_TIER_HEX = ['#FFC2A8', '#FF8A5C', '#FF4D2E'] as const;
export const FLOW_HEX = '#FF4D2E';
export const BEST_HEX = '#FFE08A';
export const FRIEND_HEX = '#8FF3E4';
/** Director-side deferral for mission and unlock pops (ms since the blocking beat). */
export const POP_DEFER = { stomp: 1600, pass: 1400, news: 1300, call: 2600, spacing: 3500, giveUp: 3000 } as const;

// ---------- small shared shapes
/** A callout line for the fx slot. Every number carries its label (decision 35). */
export interface Say { label: string; points: number; tone: StyleTone }
export interface StampPart { label: string; points: number }
export type GhostRole = 'opener' | 'pack' | 'pace';
export interface GhostRef {
  id: number; // GhostEntry id
  name: string;
  kind: GhostKind;
  role?: GhostRole;
  /** ghost.x - rider.x in sim metres (+ = rider's +x side); pan and camera nudge side. */
  dx: number;
}
export type BankTier = 0 | 1 | 2 | 3;
export type PassWord = 'jostle' | 'beat' | 'duelWon' | 'heldOff' | 'slung' | 'tookBack' | 'double' | 'triple' | 'streak' | 'yourBest' | 'passed';
export type RaceNews = 'wipeout' | 'wipeoutBehind' | 'pulledAway' | 'unlockTease';
export type FinaleOutcome = 'caught' | 'hopped' | 'dodged' | 'rode' | 'passed' | 'outran';

interface B {
  /** Sim tick of the source event (drained tick), or sim.tick for state beats. */
  tick: number;
  /** Optional callout; only the UI reads it. */
  say?: Say;
}

// ---------- the Beat union
export type Beat =
  | (B & { type: 'callout'; source: StyleKind | 'sketchy' | 'note'; say: Say })
  | (B & { type: 'stomp'; streak: number; late: boolean; title: string; lead: StampPart[]; x: number; z: number; heading: number; yetiHop: boolean })
  | (B & { type: 'streakBroken'; was: number })
  | (B & { type: 'bump'; side: -1 | 1; bank: boolean })
  | (B & { type: 'nearMiss'; grade: 'whisker' | 'near'; gap: number; side: -1 | 1; x: number; z: number; obs: ObstacleKind; speed: number })
  | (B & { type: 'driftRelease'; tier: 1 | 2 | 3; x: number; z: number; heading: number; driftDir: number })
  | (B & { type: 'flow'; phase: 'in' | 'snuff' })
  | (B & { type: 'bank'; points: number; mult: number; origin: number; tier: BankTier; header: 'New best combo' | 'Massive' | null; bump: boolean })
  | (B & { type: 'comboLost'; points: number; stake: number; best: boolean; crack: boolean })
  | (B & { type: 'bestComboPace'; stake: number })
  /** gifts: credited by the app. muted: no flash, no ping, no camera. */
  | (B & { type: 'pass'; ghost: GhostRef; word: PassWord; text: string; first: boolean; chain: number; ladder: number; octave: boolean; gifts: number; muted: boolean })
  | (B & { type: 'passedBy'; ghost: GhostRef; muted: boolean })
  | (B & { type: 'lead'; of: number })
  | (B & { type: 'raceNews'; ghost: GhostRef; news: RaceNews; text: string; pan: number; gain: number })
  /** gifts: credited by the app (won / heldOff only). */
  | (B & { type: 'duel'; phase: 'open' | 'won' | 'heldOff' | 'lost' | 'closed'; ghost: GhostRef; gifts: number })
  | (B & { type: 'raceCall'; ghost: GhostRef; word: 'Racing' | 'Nemesis' | 'Rematch' | 'Chase'; sr: string })
  /** paid: display only (the same gifts ride on the grudge's pass beat). App calls happytime here. */
  | (B & { type: 'grudgeSettled'; ghost: GhostRef; nemesis: boolean; after: number; paid: number })
  | (B & { type: 'newGround'; z: number })
  | (B & { type: 'newBest'; score: number })
  | (B & { type: 'friendBeaten'; name: string; distance: number })
  /** gifts: credited by the app. banner: notices 'finale' tone; else a callout. stamp: fx.stamp. */
  | (B & { type: 'finale'; event: ChaosEvent; outcome: FinaleOutcome; text: string; sub: string | null; gifts: number; grade: number; banner: boolean; stamp: boolean })
  | (B & { type: 'missionPop'; id: string; text: string; reward: number })
  | (B & { type: 'unlockPop'; id: string; name: string; biome: BiomeId })
  | (B & { type: 'crash'; cause: CrashCause; stake: number; orbitFrom: number | null })
  | (B & { type: 'km'; km: number })
  | (B & { type: 'ghostTrick'; ghost: GhostRef; quality: 'clean' | 'perfect' | 'sketchy'; word: string | null; x: number; y: number; z: number })
  | (B & { type: 'stompTick'; step: number; open: boolean })
  /** gifts: credited by the app (stretch). */
  | (B & { type: 'graveyard'; name: string; fell: number; gifts: number });

export type BeatType = Beat['type'];
export type BeatOf<T extends BeatType> = Extract<Beat, { type: T }>;

/** Beat types that count as a named moment in telemetry (pass/passedBy only when !muted). */
export const NAMED: ReadonlySet<BeatType> = new Set<BeatType>(['stomp', 'nearMiss', 'driftRelease', 'flow', 'bank', 'comboLost', 'bestComboPace', 'pass', 'lead', 'raceNews', 'duel', 'raceCall', 'grudgeSettled', 'newGround', 'newBest', 'friendBeaten', 'finale', 'missionPop', 'unlockPop', 'crash', 'km', 'graveyard']);

// ---------- continuous state, computed before any consumer runs this frame
export interface Feel {
  /** prefers-reduced-motion, read once per frame (motion.ts reduced()). */
  reduced: boolean;
  /** Earned flow, smoothed, display-capped, fk curve applied: 0..1. */
  flow: number;
  /** 0..1 rim pulse ('In the flow'). */
  flowPulse: number;
  /** clamp(sim.s.driftCharge / 2.4, 0, 1) while drifting, else 0. */
  driftCharge: number;
  driftTier: number;
  /** Current stomp streak (0 = none). */
  streak: number;
  /** TimeScale outputs: feed (sim feed), render (render dt), shake = min(feed, render). */
  timeFeed: number;
  timeRender: number;
  shakeScale: number;
  /** Best-distance band (sim z) and flare 0..1; null under 150 m or no best. */
  bestLine: { z: number; k: number; distance: number } | null;
  friendLine: { z: number; name: string; distance: number } | null;
  /** Ghost with an open duel (C11 ring pulse), or null. */
  duelId: number | null;
  /** Scaled seconds since the crash beat; -1 when not crashed. */
  crashT: number;
}
export const IDLE_FEEL: Feel = { reduced: false, flow: 0, flowPulse: 0, driftCharge: 0, driftTier: 0, streak: 0, timeFeed: 1, timeRender: 1, shakeScale: 1, bestLine: null, friendLine: null, duelId: null, crashT: -1 };

/** Telemetry ring (window.__gs.director.log), cleared on beginRun. */
export interface BeatLogEntry { t: number; type: BeatType; named: boolean; label?: string; word?: PassWord; tier?: number; grade?: string; gifts?: number }
