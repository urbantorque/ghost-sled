import { weekOfDay } from './cup';
import { MissionState, missionDef, newMissionState, topUp, unlockedBiomes } from './missions';
import { type MasteryRecord, readMastery } from './mastery';
import { PAINTS } from './paints';
import { dailyKey } from '../sim/mountains';
import { hashString } from '../sim/prng';
import { recordFromString } from '../sim/replay';
import { SIM_VERSION } from '../sim/sim';

// Persistent progress. Stored as one JSON blob through the platform storage (the CrazyGames data
// module when available, localStorage otherwise). Writes are debounced.
//
// Schema v1 forever: every field added since is optional or defaulted here at load (merge), so an old
// save keeps working. Load never throws on a strange save: a part it cannot read falls back to its
// default and the rest is kept, and Daily Mountain entries other than today's are pruned so they stop
// piling up.
//
// A new course is a clean break that erases nothing. A best or grudge whose replay no longer rides
// moves, exactly as it was, into `archive` (never pruned, never rewritten): the best's slot then
// clears so a new one can be set, and the mountain card shows the old figures as 'Old best' until it
// is; a grudge keeps its name and tally and stops claiming a rematch. A mountain's Climb (rung, medals)
// was earned against one pool, so it names the sim version and moves to the archive the same way.

export const SAVE_KEY = 'ghostsled.save.v1';

/** Predicted finish times kept per mountain key (field.ts anchorFor reads the median). */
export const RUN_TIMES_KEEP = 5;

/** Your best run on a mountain, in race order: its ghost, and what it did. */
export interface BestRun {
  score: number;
  distance: number;
  record: string;
  /** Finish time in seconds; absent for a best that did not finish. */
  time?: number;
  /** The clock at each stage line, seconds. */
  splits?: number[];
  /** Your highest style score here, whichever run set it (`score` is the best run's own). */
  topScore?: number;
}

export interface Grudge {
  name: string;
  score: number;
  /** The replay; empty when it no longer rides (the tally is kept, and `archive` holds the record). */
  record: string;
  /** Head-to-head tally: runs this ghost has beaten you in (old saves read as 1). */
  them?: number;
  /** Wins in a row by this ghost (3 or more makes it a nemesis; old saves read as 1). */
  streak?: number;
  /** Metres it beat you by in its latest win. */
  by?: number;
  /** How far its whole run went, in metres. */
  distance?: number;
  /** Its finish time in seconds, when it finished. */
  time?: number;
}

/** What you have earned on a mountain's ladder and lines (ladder.ts). Each part pays gifts once, so it
 *  only ever rises. Absent until it holds something. */
export interface Climb {
  /** The sim version of the pool this was earned against. */
  v: number;
  /** The best rank paid for (1 is the top). */
  rung?: number;
  /** You have beaten the top of this ladder. */
  top?: boolean;
  /** Your best medal on each stage, 0 none, 1 bronze, 2 silver, 3 gold. */
  stages?: number[];
  /** Your best whole-run medal here. */
  medal?: number;
}

/** Records a rule change retired, each exactly as it was saved. Never pruned, never rewritten. */
export interface Archive {
  best: Record<string, Record<string, unknown>>;
  grudge: Record<string, Record<string, unknown>>;
  climb?: Record<string, Record<string, unknown>>;
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
  /** Run-end distances from before runs had a finish. Kept, and read by nothing: see runTimes. */
  runDists?: Record<string, number[]>;
  /** Your last predicted finish times per mountain key, seconds (field.ts anchorFor). */
  runTimes?: Record<string, number[]>;
  archive?: Archive;
  /** Your Climb on each named mountain, by its id. */
  climb?: Record<string, Climb>;
  /** This week's Cup, in the Daily's shape: best is a finish time in seconds, medal the week's best. */
  cup?: DailyRecord;
  /** Each named mountain's mastery board, what you hold of it (mastery.ts). Kept across a clean break:
   *  the gates, set pieces and riders are each mountain's own. */
  mastery?: Record<string, MasteryRecord>;
  /** Sled paints owned (game/paints.ts ids) and the one on the sled. */
  paints?: string[];
  paint?: string;
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
    settings: { master: 0.9, music: DEFAULT_MUSIC, sfx: DEFAULT_SFX, quality: 'auto', hints: true },
    stats: { bestScore: 0, bestCombo: 0, longestAir: 0, perfects: 0, topSpeed: 0, yetiHops: 0, avalanches: 0 },
    hints: {},
    daily: { key: '', best: 0, medal: 0, streak: 0, last: '' },
    runDists: {},
    runTimes: {},
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

/**
 * Adds an entry to one side of the archive, never touching what is there: an entry already held is
 * left alone (so this is idempotent across loads), and a different one under a taken key gets the
 * next free 'key#2'. A blanked entry naming the same rider is the archived one after it lost its
 * record: nothing new.
 */
function archiveEntry(side: Record<string, Record<string, unknown>>, key: string, v: Record<string, unknown>): void {
  const text = JSON.stringify(v);
  for (let i = 1; ; i++) {
    const k = i === 1 ? key : `${key}#${i}`;
    const held = side[k];
    if (held === undefined) {
      side[k] = v;
      return;
    }
    if (JSON.stringify(held) === text || (!v.record && held.name !== undefined && held.name === v.name)) return;
  }
}

function loadArchive(p: unknown): Archive {
  const side = (v: unknown): Record<string, Record<string, unknown>> => {
    const out: Record<string, Record<string, unknown>> = {};
    if (isObj(v)) for (const [k, e] of Object.entries(v)) if (isObj(e)) out[k] = e;
    return out;
  };
  const out: Archive = { ...(isObj(p) ? p : {}), best: side(isObj(p) ? p.best : null), grudge: side(isObj(p) ? p.grudge : null) };
  if (isObj(p) && isObj(p.climb)) out.climb = side(p.climb);
  return out;
}

/** A record's worth keeping: it has a replay or a score to its name. */
const worthKeeping = (v: Record<string, unknown>): boolean => (typeof v.record === 'string' && v.record !== '') || (isNum(v.score) && v.score > 0);

function loadBest(p: unknown, archive: Archive): Record<string, BestRun> {
  const out: Record<string, BestRun> = {};
  if (!isObj(p)) return out;
  for (const [k, v] of Object.entries(p)) {
    if (!isObj(v)) continue;
    // A best that can no longer ride moves to the archive whole, and its slot clears.
    if (!recordOk(v.record)) {
      if (worthKeeping(v)) archiveEntry(archive.best, k, v);
      continue;
    }
    const b: BestRun = { ...(v as object), score: isNum(v.score) ? v.score : 0, distance: isNum(v.distance) ? v.distance : 0, record: v.record };
    if (!isNum(v.time) || v.time <= 0) delete b.time;
    if (!Array.isArray(v.splits) || !v.splits.every(isNum)) delete b.splits;
    if (!isNum(v.topScore)) delete b.topScore;
    out[k] = b;
  }
  return out;
}

function loadGrudges(p: unknown, archive: Archive): Record<string, Grudge> {
  const out: Record<string, Grudge> = {};
  if (!isObj(p)) return out;
  for (const [k, v] of Object.entries(p)) {
    if (!isObj(v) || typeof v.name !== 'string' || !v.name) continue;
    const ok = recordOk(v.record);
    if (!ok) archiveEntry(archive.grudge, k, v);
    const g: Grudge = { name: v.name, score: isNum(v.score) ? v.score : 0, record: ok ? (v.record as string) : '' };
    // The tally survives a stale record: the history is the point.
    if (isNum(v.them) && v.them >= 1) g.them = Math.floor(v.them);
    if (isNum(v.streak) && v.streak >= 1) g.streak = Math.floor(v.streak);
    if (isNum(v.by) && v.by >= 0) g.by = v.by;
    if (isNum(v.distance) && v.distance >= 0) g.distance = v.distance;
    if (isNum(v.time) && v.time > 0) g.time = v.time;
    out[k] = g;
  }
  return out;
}

/** A grudge replaced before it was settled: its tally goes to the archive with its replay. One that
 *  no longer rides is there already, moved at load. */
export function retireGrudge(d: SaveData, key: string, g: Grudge): void {
  if (!recordOk(g.record)) return;
  const a = (d.archive ??= { best: {}, grudge: {} });
  archiveEntry(a.grudge, key, { ...g });
}

/** The grudge on a mountain if its ghost will ride: one whose record is stale keeps its name and tally,
 *  and claims no rematch. */
export function rideableGrudge(d: SaveData, key: string): Grudge | null {
  const g = d.grudge[key];
  return g && recordOk(g.record) ? g : null;
}

/** The old figures a mountain's card shows until a new best exists, else null. */
export function oldBest(d: SaveData, key: string): { score: number; distance: number } | null {
  if (d.best[key]) return null;
  const a = d.archive?.best[key];
  if (!a) return null;
  return { score: isNum(a.score) ? a.score : 0, distance: isNum(a.distance) ? a.distance : 0 };
}

/** A medal as it may stand in a save: 0 to 3 whatever is there. */
const medalNum = (v: unknown): number => (isNum(v) ? Math.max(0, Math.min(3, Math.floor(v))) : 0);

/** Each mountain's Climb. One earned on another sim version was earned against a pool that is gone: it
 *  moves to the archive whole, and that mountain starts clean. Unknown fields are kept. */
function loadClimb(p: unknown, archive: Archive): Record<string, Climb> {
  const out: Record<string, Climb> = {};
  if (!isObj(p)) return out;
  for (const [k, v] of Object.entries(p)) {
    if (!isObj(v)) continue;
    if (v.v !== SIM_VERSION) {
      archiveEntry((archive.climb ??= {}), k, v);
      continue;
    }
    const c: Climb = { ...(v as object), v: SIM_VERSION };
    if (isNum(v.rung) && v.rung >= 1) c.rung = Math.floor(v.rung);
    else delete c.rung;
    if (v.top !== true) delete c.top;
    if (Array.isArray(v.stages)) c.stages = v.stages.map(medalNum);
    else delete c.stages;
    if (medalNum(v.medal) > 0) c.medal = medalNum(v.medal);
    else delete c.medal;
    out[k] = c;
  }
  return out;
}

/** This week's Cup record, or nothing: last week's goes the way the Daily's old entries go. */
function loadCup(p: unknown, week: string): DailyRecord | null {
  if (!isObj(p) || p.key !== week) return null;
  return { ...(p as object), key: week, best: isNum(p.best) && p.best > 0 ? p.best : 0, medal: medalNum(p.medal) };
}

function loadRunList(p: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (!isObj(p)) return out;
  for (const [k, v] of Object.entries(p)) {
    if (!Array.isArray(v)) continue;
    const list = v.filter((x): x is number => isNum(x) && x >= 0).slice(-RUN_TIMES_KEEP);
    if (list.length) out[k] = list;
  }
  return out;
}

/** A retired mission's successor: its slot and tier carry over, its best starts again (gifts taken and spirit
 *  lights taken are not the same count). */
const RENAMED: Readonly<Record<string, string>> = { gifts20: 'lights20' };

/** Missions: unknown ids (retired missions) and duplicates dropped, a renamed one carried to its successor,
 *  bad tiers read as I, the shuffle seed captured now if the save predates it (from the save's name, once),
 *  and free slots refilled. */
function loadMissions(p: unknown, fallback: MissionState, name: string, ghostsPassed: number): MissionState {
  if (!isObj(p) || !Array.isArray(p.active)) return fallback;
  const seen = new Set<string>();
  const active: MissionState['active'] = [];
  for (const a of p.active) {
    if (!isObj(a) || typeof a.id !== 'string') continue;
    const renamed = RENAMED[a.id];
    const id = renamed ?? a.id;
    if (seen.has(id) || !missionDef(id)) continue;
    seen.add(id);
    const e: MissionState['active'][number] = { id, best: !renamed && isNum(a.best) && a.best > 0 ? a.best : 0 };
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

/** Drops Daily Mountain entries ('daily:<day>') other than today's, and Cup entries ('cup:<week>')
 *  other than this week's, from best, grudge and the run lists. The archive is never pruned. */
export function pruneDaily(d: SaveData, today: string): void {
  const keep = `daily:${today}`;
  const week = `cup:${weekOfDay(today)}`;
  const prune = (rec: Record<string, unknown> | undefined): void => {
    if (!rec) return;
    for (const k of Object.keys(rec)) if ((k.startsWith('daily:') && k !== keep) || (k.startsWith('cup:') && k !== week)) delete rec[k];
  };
  prune(d.best);
  prune(d.grudge);
  prune(d.runDists);
  prune(d.runTimes);
}

/** The music and effects sliders' defaults. They were 0.7 and 0.9, which set the effects about 4 dB
 *  over the band; a save still holding exactly that pair never moved them, so it takes the new pair. */
export const DEFAULT_MUSIC = 0.8;
export const DEFAULT_SFX = 0.8;

function loadSettings(base: Settings, p: unknown): Settings {
  const s: Settings = { ...base, ...(isObj(p) ? (p as Partial<Settings>) : {}) };
  if (s.music === 0.7 && s.sfx === 0.9) {
    s.music = DEFAULT_MUSIC;
    s.sfx = DEFAULT_SFX;
  }
  return s;
}

export function merge(base: SaveData, p: Partial<SaveData>, today: string): SaveData {
  const name = typeof p.name === 'string' && p.name ? p.name : base.name;
  const ghostsPassed = isNum(p.ghostsPassed) ? p.ghostsPassed : base.ghostsPassed;
  const archive = loadArchive(p.archive);
  const d: SaveData = {
    ...base,
    ...p,
    v: 1,
    name,
    ghostsPassed,
    settings: loadSettings(base.settings, p.settings),
    stats: { ...base.stats, ...(isObj(p.stats) ? p.stats : {}) },
    missions: loadMissions(p.missions, base.missions, name, ghostsPassed),
    best: loadBest(p.best, archive),
    grudge: loadGrudges(p.grudge, archive),
    hints: isObj(p.hints) ? (p.hints as Record<string, number>) : {},
    // Shallow merge: new daily fields get their defaults and unknown ones are kept.
    daily: { ...base.daily, ...(isObj(p.daily) ? p.daily : {}) },
    ownedSleds: Array.isArray(p.ownedSleds) && p.ownedSleds.length ? p.ownedSleds : [0],
    runDists: loadRunList(p.runDists),
    runTimes: loadRunList(p.runTimes),
  };
  // (Written only when it holds something: a save with nothing retired keeps its shape.)
  const climb = loadClimb(p.climb, archive);
  if (Object.keys(archive.best).length > 0 || Object.keys(archive.grudge).length > 0 || Object.keys(archive.climb ?? {}).length > 0) d.archive = archive;
  else delete d.archive;
  if (Object.keys(climb).length > 0) d.climb = climb;
  else delete d.climb;
  const cup = loadCup(p.cup, weekOfDay(today));
  if (cup) d.cup = cup;
  else delete d.cup;
  // Paints: known ids only.
  const owned = Array.isArray(p.paints) ? (p.paints as unknown[]).filter((x): x is string => typeof x === 'string' && PAINTS.some((q) => q.id === x)) : [];
  if (owned.length) d.paints = owned;
  else delete d.paints;
  if (typeof p.paint === 'string' && owned.includes(p.paint)) d.paint = p.paint;
  else delete d.paint;
  // Mastery, a record per named mountain (only those): sanitised, and written only when it holds some.
  if (p.mastery && typeof p.mastery === 'object') {
    const ms: Record<string, MasteryRecord> = {};
    for (const [k, v] of Object.entries(p.mastery as Record<string, unknown>)) if (/^[a-z]+$/.test(k)) ms[k] = readMastery(v);
    if (Object.keys(ms).length) d.mastery = ms;
    else delete d.mastery;
  } else delete d.mastery;
  pruneDaily(d, today);
  return d;
}
