import { MissionState, newMissionState } from './missions';

// Persistent progress. Stored as one JSON blob through the platform storage (the CrazyGames data
// module when available, localStorage otherwise). Writes are debounced.

export const SAVE_KEY = 'ghostsled.save.v1';

export interface BestRun {
  score: number;
  distance: number;
  record: string;
}

export interface Grudge {
  name: string;
  score: number;
  record: string;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  quality: 'auto' | 'low' | 'medium' | 'high';
  hints: boolean;
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
  daily: { key: string; best: number };
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
    missions: newMissionState(),
    settings: { master: 0.9, music: 0.7, sfx: 0.9, quality: 'auto', hints: true },
    stats: { bestScore: 0, bestCombo: 0, longestAir: 0, perfects: 0, topSpeed: 0, yetiHops: 0, avalanches: 0 },
    hints: {},
    daily: { key: '', best: 0 },
  };
}

export interface Storage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export class SaveStore {
  data: SaveData;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private storage: Storage,
    fallbackName: string,
  ) {
    this.data = defaultSave(fallbackName);
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        if (parsed && parsed.v === 1) this.data = merge(defaultSave(fallbackName), parsed);
      }
    } catch (err) {
      console.warn('[save] could not read save, starting fresh', err);
    }
  }

  /** Swap the backing store (SDK became ready) and reload if it has data. */
  rebind(storage: Storage): void {
    this.storage = storage;
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        if (parsed && parsed.v === 1) this.data = merge(defaultSave(this.data.name), parsed);
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

function merge(base: SaveData, p: Partial<SaveData>): SaveData {
  return {
    ...base,
    ...p,
    settings: { ...base.settings, ...(p.settings ?? {}) },
    stats: { ...base.stats, ...(p.stats ?? {}) },
    missions: p.missions && Array.isArray(p.missions.active) ? p.missions : base.missions,
    best: p.best ?? {},
    grudge: p.grudge ?? {},
    hints: p.hints ?? {},
    daily: { ...base.daily, ...(p.daily ?? {}) },
    ownedSleds: Array.isArray(p.ownedSleds) && p.ownedSleds.length ? p.ownedSleds : [0],
  };
}
