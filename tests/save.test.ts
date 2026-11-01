import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../src/game/missions';
import { SAVE_KEY, SaveStore, defaultSave } from '../src/game/save';
import { settleGrudge } from '../src/game/settle';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { hashString } from '../src/sim/prng';
import { RunRecord, encodeRecord, recordToString, toBase64Url } from '../src/sim/replay';

class MemStorage {
  map = new Map<string, string>();
  constructor(raw?: unknown) {
    if (raw !== undefined) this.map.set(SAVE_KEY, typeof raw === 'string' ? raw : JSON.stringify(raw));
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

const TODAY = '2026-10-26';

function record(name: string, score: number, distance: number): RunRecord {
  return { seed: 0x51ed270b, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 7 }, sled: 0, inputs: new Uint8Array([4, 4, 4, 4]), ticks: 4, score, distance, name };
}

/** A record string as an older build (sim version 3) wrote it. */
function staleRecord(name: string): string {
  const bytes = encodeRecord(record(name, 100, 50));
  bytes[3] = 3;
  return toBase64Url(bytes);
}

/** A save as a v1 build before this round wrote it: no runDists, no tally, no mission seed or tiers. */
function oldSave(): Record<string, unknown> {
  return {
    v: 1,
    name: 'Mila',
    gifts: 140,
    lifetimeGifts: 600,
    ghostsPassed: 6,
    runs: 9,
    sled: 1,
    ownedSleds: [0, 1],
    mountain: 'frostfang',
    best: { pinecrest: { score: 5400, distance: 1240, record: recordToString(record('Mila', 5400, 1240)) } },
    grudge: { pinecrest: { name: 'KestrelHailstone', score: 3000, record: recordToString(record('KestrelHailstone', 3000, 900)) } },
    missions: { active: [{ id: 'pass1', best: 0 }, { id: 'a-mission-from-the-future', best: 2 }, { id: 'dist800', best: 640 }], cursor: 7, completed: 4 },
    settings: { master: 0.5, music: 0.7, sfx: 0.9, quality: 'auto', hints: true },
    stats: { bestScore: 5400, bestCombo: 2100, longestAir: 1.4, perfects: 12, topSpeed: 31, yetiHops: 0, avalanches: 1 },
    hints: { steer: 1, drift: 2 },
    daily: { key: '2026-10-25', best: 800 },
  };
}

describe('save migration (schema v1 forever)', () => {
  it('an old v1 save loads with defaults for every new field and never throws', () => {
    const store = new SaveStore(new MemStorage(oldSave()), 'Fallback', TODAY);
    const d = store.data;
    expect(d.name).toBe('Mila');
    expect(d.gifts).toBe(140);
    expect(d.runDists).toEqual({});
    // The untouched old slider pair (music 0.7, effects 0.9) moves to the new defaults; master stays.
    expect(d.settings).toMatchObject({ master: 0.5, music: 0.8, sfx: 0.8 });
    // The grudge keeps its record; the tally reads as 1 where it is used.
    const g = d.grudge.pinecrest;
    expect(g.name).toBe('KestrelHailstone');
    expect(g.record.length).toBeGreaterThan(10);
    expect(g.them).toBeUndefined();
    expect(settleGrudge(g, { youDistance: 400, rode: { distance: 900, passed: false }, next: null }).grudge).toMatchObject({ them: 2, streak: 2 });
    // The unknown mission is dropped and the slot refilled; the shuffle seed is captured from the name.
    const ids = d.missions.active.map((a) => a.id);
    expect(ids).toHaveLength(3);
    expect(ids).toContain('pass1');
    expect(ids).toContain('dist800');
    expect(ids).not.toContain('a-mission-from-the-future');
    for (const id of ids) expect(MISSIONS.some((m) => m.id === id)).toBe(true);
    expect(d.missions.seed).toBe(hashString('Mila'));
    expect(d.missions.active.find((a) => a.id === 'dist800')?.best).toBe(640);
    // Daily gains its new fields with defaults and keeps what it had.
    expect(d.daily).toMatchObject({ key: '2026-10-25', best: 800, medal: 0, streak: 0, last: '' });
  });

  it('round-trips: what it writes reads back the same', () => {
    const storage = new MemStorage(oldSave());
    const a = new SaveStore(storage, 'Fallback', TODAY);
    a.flush();
    const b = new SaveStore(storage, 'Other', TODAY);
    expect(b.data).toEqual(a.data);
    b.flush();
    expect(storage.getItem(SAVE_KEY)).toBe(JSON.stringify(a.data));
  });

  it('never throws on a mangled save, and keeps what it can read', () => {
    const cases: unknown[] = [
      'not json',
      '{"v":1,',
      { v: 2, name: 'Future' },
      { v: 1, best: 5, grudge: [], missions: { active: 'x' }, daily: null, hints: 3, runDists: { pinecrest: 'far', ember: [1, 'x', null, -4, 300] } },
      { v: 1, missions: { active: [null, 4, { id: 7 }, { id: 'pass1', best: 'lots', tier: 9 }], cursor: -3, seed: 'abc' }, grudge: { pinecrest: { score: 3 }, ember: { name: 'Ok', score: 'x', them: 'two', streak: -1 } } },
    ];
    for (const raw of cases) {
      let store: SaveStore | null = null;
      expect(() => (store = new SaveStore(new MemStorage(raw), 'Fallback', TODAY))).not.toThrow();
      const d = store!.data;
      expect(d.missions.active).toHaveLength(3);
      expect(Array.isArray(d.ownedSleds)).toBe(true);
      expect(typeof d.daily.best).toBe('number');
    }
    const odd = new SaveStore(new MemStorage(cases[3]), 'Fallback', TODAY).data;
    expect(odd.best).toEqual({});
    expect(odd.grudge).toEqual({});
    expect(odd.runDists).toEqual({ ember: [1, 300] });
    const odder = new SaveStore(new MemStorage(cases[4]), 'Fallback', TODAY).data;
    expect(odder.missions.active[0]).toEqual({ id: 'pass1', best: 0 });
    expect(odder.missions.cursor).toBeGreaterThanOrEqual(0);
    expect(odder.grudge).toEqual({ ember: { name: 'Ok', score: 0, record: '' } });
  });
});

describe('old records and save hygiene', () => {
  it('a best or grudge recorded on another sim version keeps its score, distance and tally', () => {
    const raw = oldSave();
    raw.best = { pinecrest: { score: 5400, distance: 1240, record: staleRecord('Mila') }, ember: { score: 10, distance: 20, record: 'garbage!' } };
    raw.grudge = { pinecrest: { name: 'Tess', score: 3000, record: staleRecord('Tess'), them: 3, streak: 3, by: 42, distance: 1300 } };
    const d = new SaveStore(new MemStorage(raw), 'Fallback', TODAY).data;
    expect(d.best.pinecrest).toEqual({ score: 5400, distance: 1240, record: '' });
    expect(d.best.ember).toEqual({ score: 10, distance: 20, record: '' });
    expect(d.grudge.pinecrest).toEqual({ name: 'Tess', score: 3000, record: '', them: 3, streak: 3, by: 42, distance: 1300 });
  });

  it('prunes Daily Mountain entries other than today', () => {
    const raw = oldSave();
    const rec = recordToString(record('Mila', 10, 10));
    raw.best = { pinecrest: { score: 1, distance: 1, record: rec }, 'daily:2026-10-20': { score: 9, distance: 9, record: rec }, [`daily:${TODAY}`]: { score: 8, distance: 8, record: rec } };
    raw.grudge = { 'daily:2026-10-21': { name: 'Gone', score: 1, record: rec } };
    raw.runDists = { 'daily:2026-10-22': [100], [`daily:${TODAY}`]: [200], pinecrest: [300] };
    const d = new SaveStore(new MemStorage(raw), 'Fallback', TODAY).data;
    expect(Object.keys(d.best).sort()).toEqual([`daily:${TODAY}`, 'pinecrest']);
    expect(d.grudge).toEqual({});
    expect(d.runDists).toEqual({ [`daily:${TODAY}`]: [200], pinecrest: [300] });
  });

  it('daily keeps unknown fields across a load', () => {
    const raw = oldSave();
    raw.daily = { key: TODAY, best: 900, medal: 2, streak: 4, last: TODAY, future: 'kept' };
    const d = new SaveStore(new MemStorage(raw), 'Fallback', TODAY).data;
    expect(d.daily).toEqual({ key: TODAY, best: 900, medal: 2, streak: 4, last: TODAY, future: 'kept' });
  });

  it('a fresh save carries the new defaults', () => {
    const d = defaultSave('New');
    expect(d.runDists).toEqual({});
    expect(d.missions.seed).toBe(hashString('New'));
    expect(d.daily).toEqual({ key: '', best: 0, medal: 0, streak: 0, last: '' });
  });
});
