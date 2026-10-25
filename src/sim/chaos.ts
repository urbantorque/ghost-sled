import { Rng } from './prng';

// Chaos: at most one run-wide mood and at most one mid-run event per run. The roll is part of the
// run record, so replays reproduce it exactly. Chaos never touches static course geometry.

export enum Mood {
  None = 0,
  Blizzard = 1,
  Lantern = 2,
  GlassIce = 3,
  Comet = 4,
  Haunted = 5,
  Powder = 6,
}

export enum ChaosEvent {
  None = 0,
  Avalanche = 1,
  Yeti = 2,
  GiftStorm = 3,
  GhostTrain = 4,
}

export interface ChaosRoll {
  mood: Mood;
  event: ChaosEvent;
  /** Seeds event placement and dynamic spawns. */
  seed: number;
}

export const PLAIN: ChaosRoll = { mood: Mood.None, event: ChaosEvent.None, seed: 0 };

/** Sim-facing multipliers for a mood. Visual treatment lives in render/moods.ts. */
export interface MoodParams {
  gravity: number;
  grip: number;
  driftCharge: number;
  comboWindow: number;
  draft: number;
  drag: number;
  spin: number;
  landTol: number;
  pop: number;
  giftValue: number;
  /** Extra ghosts the game layer adds to the race. */
  extraGhosts: number;
}

const NEUTRAL: MoodParams = {
  gravity: 1,
  grip: 1,
  driftCharge: 1,
  comboWindow: 1,
  draft: 1,
  drag: 1,
  spin: 1,
  landTol: 0,
  pop: 1,
  giftValue: 1,
  extraGhosts: 0,
};

export interface MoodInfo {
  id: Mood;
  key: string;
  name: string;
  /** One line shown on the reveal card, describing how the run plays differently. */
  rule: string;
  params: MoodParams;
}

export const MOODS: readonly MoodInfo[] = [
  { id: Mood.None, key: 'plain', name: 'Clear Skies', rule: 'A clean run', params: NEUTRAL },
  {
    id: Mood.Blizzard,
    key: 'blizzard',
    name: 'Blizzard',
    rule: 'Low visibility. Ghosts glow to guide you, drafting is 60% stronger',
    params: { ...NEUTRAL, draft: 1.6, grip: 0.95 },
  },
  {
    id: Mood.Lantern,
    key: 'lantern',
    name: 'Lantern Night',
    rule: 'Ride by lantern light. Gifts glow and combos last 50% longer',
    params: { ...NEUTRAL, comboWindow: 1.5 },
  },
  {
    id: Mood.GlassIce,
    key: 'glassice',
    name: 'Glass Ice',
    rule: 'Slick and fast. Less grip, drifts charge 60% faster',
    params: { ...NEUTRAL, grip: 0.62, driftCharge: 1.6, drag: 0.9 },
  },
  {
    id: Mood.Comet,
    key: 'comet',
    name: 'Comet Night',
    rule: 'Low gravity. Huge air, faster spins, softer landings',
    params: { ...NEUTRAL, gravity: 0.62, spin: 1.15, landTol: 0.12, pop: 0.9 },
  },
  {
    id: Mood.Haunted,
    key: 'haunted',
    name: 'Haunted Hollow',
    rule: 'Four extra ghosts. Every pass pays double gifts',
    params: { ...NEUTRAL, extraGhosts: 4, draft: 1.25 },
  },
  {
    id: Mood.Powder,
    key: 'powder',
    name: 'Powder Day',
    rule: 'Deep fresh snow. Slower cruise, bigger pops, gifts worth double',
    params: { ...NEUTRAL, drag: 1.12, pop: 1.18, giftValue: 2, grip: 1.08 },
  },
];

export interface EventInfo {
  id: ChaosEvent;
  key: string;
  name: string;
  warn: string;
}

export const EVENTS: readonly EventInfo[] = [
  { id: ChaosEvent.None, key: 'none', name: 'None', warn: '' },
  { id: ChaosEvent.Avalanche, key: 'avalanche', name: 'Avalanche', warn: 'Avalanche! Outrun it' },
  { id: ChaosEvent.Yeti, key: 'yeti', name: 'Yeti Crossing', warn: 'Yeti crossing ahead' },
  { id: ChaosEvent.GiftStorm, key: 'giftstorm', name: 'Gift Storm', warn: 'Gift storm incoming' },
  { id: ChaosEvent.GhostTrain, key: 'ghosttrain', name: 'Spirit Train', warn: 'Spirit train! Draft them' },
];

export function moodInfo(m: Mood): MoodInfo {
  return MOODS[m] ?? MOODS[0];
}

export function eventInfo(e: ChaosEvent): EventInfo {
  return EVENTS[e] ?? EVENTS[0];
}

/**
 * Roll chaos for a run. `runIndex` is the run's position in the session (0 = first run, always
 * plain). Roughly 34% plain, 33% mood only, 16% event only, 17% both. Avoids repeating the
 * previous mood back to back.
 */
export function rollChaos(seed: number, runIndex: number, lastMood: Mood = Mood.None): ChaosRoll {
  if (runIndex <= 0) return { mood: Mood.None, event: ChaosEvent.None, seed: seed >>> 0 };
  const rng = new Rng(seed);
  const r = rng.next();
  let wantMood = false;
  let wantEvent = false;
  if (r < 0.34) {
    // plain
  } else if (r < 0.67) wantMood = true;
  else if (r < 0.83) wantEvent = true;
  else {
    wantMood = true;
    wantEvent = true;
  }
  let mood = Mood.None;
  if (wantMood) {
    const options: Mood[] = [];
    for (let m = 1; m < MOODS.length; m++) if (m !== lastMood) options.push(m as Mood);
    mood = rng.pick(options);
  }
  let event = ChaosEvent.None;
  if (wantEvent) event = (1 + rng.int(0, EVENTS.length - 2)) as ChaosEvent;
  return { mood, event, seed: seed >>> 0 };
}

/** Distance at which the mid-run event starts its warning. */
export function eventTriggerZ(roll: ChaosRoll): number {
  if (roll.event === ChaosEvent.None) return Infinity;
  const rng = new Rng(roll.seed ^ 0x7e57);
  return 520 + rng.next() * 620;
}
