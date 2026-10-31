import { MissionState, missionDef, newMissionState, topUp, unlockedBiomes } from './missions';
import { dailyKey } from '../sim/mountains';
import { hashString } from '../sim/prng';
import { recordFromString } from '../sim/replay';

// Persistent progress. Stored as one JSON blob through the platform storage (the CrazyGames data
// module when available, localStorage otherwise). Writes are debounced.
//
// Schema v1 forever: every field added since is optional or defaulted here at load (merge), so an old
// save keeps working. Load never throws on a strange save: a part it cannot read falls back to its
// default and the rest is kept. A best or grudge whose replay was recorded on another sim version
// loses only its record (its score, distance and tally stay), and Daily Mountain entries other than
// today's are pruned so they stop piling up.

export const SAVE_KEY = 'ghostsled.save.v1';

/** Run-end distances kept per mountain key (field.ts anchorFor reads the median). */
export const RUN_DISTS_KEEP = 5;

export interface BestRun {
  score: number;
  distance: number;
  /** The replay; empty when it was recorded on another sim version (it can no longer ride). */
  record: string;
}

export interface Grudge {
  name: string;
  score: number;
  /** The replay; empty when it was recorded on another sim version (the tally is kept). */
  record: string;
  /** Head-to-head tally: runs this ghost has beaten you in (old saves read as 1). */
  them?: number;
  /** Wins in a row by this ghost (3 or more makes it a nemesis; old saves read as 1). */
  streak?: number;
  /** Metres it beat you by in its latest win. */
  by?: number;
  /** How far its whole run went, in metres. */
  distance?: number;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  quality: 'auto' | 'low' | 'medium' | 'high';
  hints: boolean;
}

/** The Daily Mountain's record. medal (0 none, 1 bronze, 2 silver, 3 gold), streak and last (the UTC
 *  day of the last daily run) are optional for old saves; unknown fields are kept. */
export interface DailyRecord {
  key: string;
  best: number;
  medal?: number;
  streak?: number;
  last?: string;
}

export interface SaveData {
  v: 1;
  name: string;
  gifts: number;
  lifetimeGifts: number;
  ghostsPassed: number;
  runs: number;
  sled: number;
  ownedSleds: number[];
  mountain: string;
  best: Record<string, BestRun>;
  grudge: Record<string, Grudge>;
  missions: MissionState;
  settings: Settings;
  stats: { bestScore: number; bestCombo: number; longestAir: number; perfects: number; topSpeed: number; yetiHops: number; avalanches: number };
  hints: Record<string, number>;
  daily: DailyRecord;
  /** The last few run-end distances per mountain key (field.ts anchorFor). */
  runDists?: Record<string, number[]>;
}

export function defaultSave(name: string): SaveData {
  return {
    v: 1,
    name,
    gifts: 0,
    lifetimeGifts: 0,
    ghostsPassed: 0,
    runs: 0,
    sled: 0,
    ownedSleds: [0],
    mountain: 'pinecrest',
    best: {},
    grudge: {},
    missions: newMissionState(hashString(name), { unlockedBiomes: unlockedBiomes(0) }),
    settings: { master: 0.9, music: 0.7, sfx: 0.9, quality: 'auto', hints: true },
    stats: { bestScore: 0, bestCombo: 0, longestAir: 0, perfects: 0, topSpeed: 0, yetiHops: 0, avalanches: 0 },
    hints: {},
    daily: { key: '', best: 0, medal: 0, streak: 0, last: '' },
    runDists: {},
  };
}

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export class SaveStore {
  data: SaveData;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** `today` (a UTC day key) is for tests; the store reads the clock otherwise. */
  constructor(
    private storage: Storage,
    fallbackName: string,
    private readonly today?: string,
  ) {
    this.data = defaultSave(fallbackName);
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        if (parsed && parsed.v === 1) this.data = merge(defaultSave(fallbackName), parsed, this.todayKey());
      }
    } catch (err) {
      console.warn('[save] could not read save, starting fresh', err);
    }
  }

  private todayKey(): string {
    return this.today ?? dailyKey(new Date());
  }

  /** Swap the backing store (SDK became ready) and reload if it has data. */
  rebind(storage: Storage): void {
    this.storage = storage;
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        if (parsed && parsed.v === 1) this.data = merge(defaultSave(this.data.name), parsed, this.todayKey());
      } else this.flush();
    } catch (err) {
      console.warn('[save] rebind failed', err);
    }
  }

  save(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[save] write failed', err);
    }
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A replay that still decodes on this sim version. */
export function recordOk(r: unknown): r is string {
  if (typeof r !== 'string' || r.length === 0) return false;
  try {
    recordFromString(r);
    return true;
  } catch {
    return false;
  }
}

function loadBest(p: unknown): Record<string, BestRun> {
  const out: Record<string, BestRun> = {};
  if (!isObj(p)) return out;
  for (const [k, v] of Object.entries(p)) {
    if (!isObj(v)) continue;
    out[k] = { ...(v as object), score: isNum(v.score) ? v.score : 0, distance: isNum(v.distance) ? v.distance : 0, record: recordOk(v.record) ? v.record : '' };
  }
  return out;
}

function loadGrudges(p: unknown): Record<string, Grudge> {
  const out: Record<string, Grudge> = {};
  if (!isObj(p)) return out;
  for (const [k, v] of Object.entries(p)) {
    if (!isObj(v) || typeof v.name !== 'string' || !v.name) continue;
    const g: Grudge = { name: v.name, score: isNum(v.score) ? v.score : 0, record: recordOk(v.record) ? v.record : '' };
    // The tally survives a stale record: the history is the point.
    if (isNum(v.them) && v.them >= 1) g.them = Math.floor(v.them);
    if (isNum(v.streak) && v.streak >= 1) g.streak = Math.floor(v.streak);
    if (isNum(v.by) && v.by >= 0) g.by = v.by;
    if (isNum(v.distance) && v.distance >= 0) g.distance = v.distance;
    out[k] = g;
  }
  return out;
}

function loadRunDists(p: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!isObj(p)) return out;
  for (const [k, v] of Object.entries(p)) {
    if (!Array.isArray(v)) continue;
    const list = v.filter((x): x is number => isNum(x) && x >= 0).slice(-RUN_DISTS_KEEP);
    if (list.length) out[k] = list;
  }
  return out;
}

/** Missions: unknown ids (retired missions) and duplicates dropped, bad tiers read as I, the shuffle
 *  seed captured now if the save predates it (from the save's name, once), and free slots refilled. */
function loadMissions(p: unknown, fallback: MissionState, name: string, ghostsPassed: number): MissionState {
  if (!isObj(p) || !Array.isArray(p.active)) return fallback;
  const seen = new Set<string>();
  const active: MissionState['active'] = [];
  for (const a of p.active) {
    if (!isObj(a) || typeof a.id !== 'string' || seen.has(a.id) || !missionDef(a.id)) continue;
    seen.add(a.id);
    const e: MissionState['active'][number] = { id: a.id, best: isNum(a.best) && a.best > 0 ? a.best : 0 };
    if (a.tier === 2 || a.tier === 3) e.tier = a.tier;
    active.push(e);
  }
  const s: MissionState = {
    active: active.slice(0, 3),
    cursor: isNum(p.cursor) && p.cursor >= 0 ? Math.floor(p.cursor) : 0,
    completed: isNum(p.completed) && p.completed >= 0 ? Math.floor(p.completed) : 0,
    seed: isNum(p.seed) ? p.seed >>> 0 : hashString(name),
  };
  if (s.active.length < 3) topUp(s, { unlockedBiomes: unlockedBiomes(ghostsPassed) });
  return s;
}

/** Drops Daily Mountain entries ('daily:<day>') other than today's from best, grudge and runDists. */
export function pruneDaily(d: SaveData, today: string): void {
  const keep = `daily:${today}`;
  const prune = (rec: Record<string, unknown> | undefined): void => {
    if (!rec) return;
    for (const k of Object.keys(rec)) if (k.startsWith('daily:') && k !== keep) delete rec[k];
  };
  prune(d.best);
  prune(d.grudge);
  prune(d.runDists);
}

export function merge(base: SaveData, p: Partial<SaveData>, today: string): SaveData {
  const name = typeof p.name === 'string' && p.name ? p.name : base.name;
  const ghostsPassed = isNum(p.ghostsPassed) ? p.ghostsPassed : base.ghostsPassed;
  const d: SaveData = {
    ...base,
    ...p,
    v: 1,
    name,
    ghostsPassed,
    settings: { ...base.settings, ...(isObj(p.settings) ? p.settings : {}) },
    stats: { ...base.stats, ...(isObj(p.stats) ? p.stats : {}) },
    missions: loadMissions(p.missions, base.missions, name, ghostsPassed),
    best: loadBest(p.best),
    grudge: loadGrudges(p.grudge),
    hints: isObj(p.hints) ? (p.hints as Record<string, number>) : {},
    // Shallow merge: new daily fields get their defaults and unknown ones are kept.
    daily: { ...base.daily, ...(isObj(p.daily) ? p.daily : {}) },
    ownedSleds: Array.isArray(p.ownedSleds) && p.ownedSleds.length ? p.ownedSleds : [0],
    runDists: loadRunDists(p.runDists),
  };
  pruneDaily(d, today);
  return d;
}
