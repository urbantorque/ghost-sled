// Rotating missions: three active at a time, each a one-run goal. Completing one pays gifts and
// the slot rolls to the next mission in a shuffled rotation.

export interface RunSummary {
  mountain: string;
  biome: string;
  score: number;
  distance: number;
  gifts: number;
  perfects: number;
  maxAirtime: number;
  maxHalfTurns: number;
  flips: number;
  driftSeconds: number;
  draftSeconds: number;
  nearMisses: number;
  bestCombo: number;
  maxSpeed: number;
  smashes: number;
  gates: number;
  yetiHop: boolean;
  outranAvalanche: boolean;
  ghostsPassed: number;
  grudgeBeaten: boolean;
  chaos: boolean;
}

export interface MissionDef {
  id: string;
  text: string;
  target: number;
  reward: number;
  metric: (r: RunSummary) => number;
  /** Only offered on this biome. */
  biome?: string;
}

export const MISSIONS: readonly MissionDef[] = [
  { id: 'dist800', text: 'Ride 800 m in one run', target: 800, reward: 25, metric: (r) => r.distance },
  { id: 'perfect2', text: 'Land 2 perfect landings', target: 2, reward: 30, metric: (r) => r.perfects },
  { id: 'pass1', text: 'Pass a ghost', target: 1, reward: 25, metric: (r) => r.ghostsPassed },
  { id: 'gifts20', text: 'Collect 20 gifts in one run', target: 20, reward: 25, metric: (r) => r.gifts },
  { id: 'drift5', text: 'Drift for 5 seconds in one run', target: 5, reward: 30, metric: (r) => r.driftSeconds },
  { id: 'air15', text: 'Get 1.5 seconds of air', target: 1.5, reward: 25, metric: (r) => r.maxAirtime },
  { id: 'near4', text: 'Get 4 near misses in one run', target: 4, reward: 35, metric: (r) => r.nearMisses },
  { id: 'spin360', text: 'Land a 360 spin', target: 2, reward: 35, metric: (r) => r.maxHalfTurns },
  { id: 'draft4', text: 'Draft ghosts for 4 seconds', target: 4, reward: 35, metric: (r) => r.draftSeconds },
  { id: 'combo3k', text: 'Bank a 3,000 point combo', target: 3000, reward: 40, metric: (r) => r.bestCombo },
  { id: 'dist2000', text: 'Ride 2,000 m in one run', target: 2000, reward: 45, metric: (r) => r.distance },
  { id: 'flip1', text: 'Land a backflip', target: 1, reward: 50, metric: (r) => r.flips },
  { id: 'pass3', text: 'Pass 3 ghosts in one run', target: 3, reward: 50, metric: (r) => r.ghostsPassed },
  { id: 'speed36', text: 'Hit 36 m/s', target: 36, reward: 40, metric: (r) => r.maxSpeed },
  { id: 'perfect5', text: 'Land 5 perfect landings', target: 5, reward: 55, metric: (r) => r.perfects },
  { id: 'smash3', text: 'Smash 3 snowmen', target: 3, reward: 35, metric: (r) => r.smashes, biome: 'alpine' },
  { id: 'gates3', text: 'Ride through 3 spirit gates', target: 3, reward: 40, metric: (r) => r.gates, biome: 'blossom' },
  { id: 'score12k', text: 'Score 12,000 in one run', target: 12000, reward: 60, metric: (r) => r.score },
  { id: 'spin720', text: 'Land a 720', target: 4, reward: 70, metric: (r) => r.maxHalfTurns },
  { id: 'grudge', text: 'Beat your grudge ghost', target: 1, reward: 60, metric: (r) => (r.grudgeBeaten ? 1 : 0) },
  { id: 'combo10k', text: 'Bank a 10,000 point combo', target: 10000, reward: 80, metric: (r) => r.bestCombo },
  { id: 'dist4000', text: 'Ride 4,000 m in one run', target: 4000, reward: 90, metric: (r) => r.distance },
  { id: 'score40k', text: 'Score 40,000 in one run', target: 40000, reward: 120, metric: (r) => r.score },
];

export interface MissionState {
  /** tier: 1 to 3 from the second cycle on (read as a.tier ?? 1). */
  active: Array<{ id: string; best: number; tier?: number }>;
  /** Next index into the rotation. */
  cursor: number;
  completed: number;
  /** The rotation's shuffle seed, captured once so a later name change never reshuffles it. */
  seed?: number;
}

export function newMissionState(): MissionState {
  const s: MissionState = { active: [], cursor: 0, completed: 0 };
  fill(s);
  return s;
}

function fill(s: MissionState): void {
  const ids = new Set(s.active.map((a) => a.id));
  let guard = 0;
  while (s.active.length < 3 && guard++ < MISSIONS.length * 2) {
    const def = MISSIONS[s.cursor % MISSIONS.length];
    s.cursor++;
    if (ids.has(def.id)) continue;
    ids.add(def.id);
    s.active.push({ id: def.id, best: 0 });
  }
}

export function missionDef(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export interface MissionResult {
  id: string;
  text: string;
  progress: number;
  target: number;
  reward: number;
  done: boolean;
  justCompleted: boolean;
}

/** Apply a finished run. Returns the views for the results screen and the gifts earned. */
export function applyRun(s: MissionState, r: RunSummary): { views: MissionResult[]; reward: number } {
  const views: MissionResult[] = [];
  let reward = 0;
  const keep: MissionState['active'] = [];
  for (const a of s.active) {
    const def = missionDef(a.id);
    if (!def) continue;
    const applicable = !def.biome || def.biome === r.biome;
    const value = applicable ? def.metric(r) : 0;
    a.best = Math.max(a.best, value);
    const done = a.best >= def.target;
    views.push({ id: def.id, text: def.text, progress: Math.min(a.best, def.target), target: def.target, reward: def.reward, done, justCompleted: done });
    if (done) {
      reward += def.reward;
      s.completed++;
    } else keep.push(a);
  }
  s.active = keep;
  fill(s);
  return { views, reward };
}

/** Live view of current missions (title screen). */
export function missionViews(s: MissionState): MissionResult[] {
  return s.active.map((a) => {
    const def = missionDef(a.id)!;
    return { id: def.id, text: def.text, progress: Math.min(a.best, def.target), target: def.target, reward: def.reward, done: false, justCompleted: false };
  });
}
