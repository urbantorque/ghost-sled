import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLED_SOUNDS } from '../src/audio/sledsounds';
import { HATS, SCARVES, SHELVES, SOUNDS, TRAILS, type ShelfId, freeItem } from '../src/game/garage';
import { SAVE_KEY, SHELF_KEYS, SaveStore, defaultSave, shelfState } from '../src/game/save';
import { sampleCurve, TimeScale, WARD_CURVE } from '../src/game/timescale';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { type RunRecord, recordToString } from '../src/sim/replay';

// The garage, finished (round 6): scarves, hats, trails and sled sounds, bought with gifts, all cosmetic.
// A save from before it loads with the free items and loses nothing; strange garage fields are dropped.

const TODAY = '2026-11-08';
const SHELF_IDS: readonly ShelfId[] = ['scarf', 'hat', 'trail', 'sound'];

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

function record(name: string): string {
  const r: RunRecord = { seed: 0x51ed270b, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 7 }, sled: 0, inputs: new Uint8Array([4, 4, 4, 4]), ticks: 4, score: 900, distance: 1200, name };
  return recordToString(r);
}

/** A save exactly as the round 5 build wrote it: gifts, sleds, paints and a mastery board, no garage. */
function round5Save(): Record<string, unknown> {
  return {
    v: 1,
    name: 'Ilse',
    gifts: 735,
    lifetimeGifts: 2210,
    ghostsPassed: 31,
    runs: 64,
    sled: 3,
    ownedSleds: [0, 1, 3],
    mountain: 'ember',
    best: { pinecrest: { score: 900, distance: 1200, record: record('Ilse'), time: 131.2 } },
    grudge: {},
    missions: { active: [{ id: 'pass3', best: 2 }, { id: 'lights20', best: 9 }, { id: 'near4', best: 1 }], cursor: 12, completed: 8, seed: 99 },
    settings: { master: 0.7, music: 0.6, sfx: 0.8, quality: 'medium', hints: true },
    stats: { bestScore: 9100, bestCombo: 2400, longestAir: 2.6, perfects: 51, topSpeed: 41.3, yetiHops: 1, avalanches: 2 },
    hints: { steer: 1 },
    daily: { key: '2026-11-07', best: 700, medal: 1, streak: 2, last: '2026-11-07' },
    runDists: {},
    runTimes: { pinecrest: [131.2] },
    mastery: { pinecrest: { medals: 2, gates: [0, 2], pieces: ['firstdrop'], riders: [], clean: true, paid: 6 } },
    paints: ['pine', 'plum'],
    paint: 'plum',
  };
}

const load = (raw: unknown): SaveStore => new SaveStore(new MemStorage(raw), 'Fallback', TODAY);

describe('the garage on an old save', () => {
  it('loads a round 5 save with the free items on every shelf and nothing lost', () => {
    const d = load(round5Save()).data;
    for (const s of SHELF_IDS) {
      expect(shelfState(d, s)).toEqual({ owned: [freeItem(s)], on: freeItem(s) });
      expect(SHELF_KEYS[s].owned in d).toBe(false);
      expect(SHELF_KEYS[s].on in d).toBe(false);
    }
    expect(d).toMatchObject({ gifts: 735, lifetimeGifts: 2210, ghostsPassed: 31, runs: 64, sled: 3, ownedSleds: [0, 1, 3], paints: ['pine', 'plum'], paint: 'plum' });
    expect(d.mastery?.pinecrest).toBeDefined();
    expect(d.best.pinecrest.time).toBe(131.2);
    expect(d.stats.topSpeed).toBe(41.3);
  });

  it('keeps its shape: no empty garage field is written back', () => {
    const s = new MemStorage(round5Save());
    new SaveStore(s, 'Fallback', TODAY).flush();
    const once = JSON.parse(s.getItem(SAVE_KEY)!) as Record<string, unknown>;
    for (const k of ['scarves', 'scarf', 'hats', 'hat', 'trails', 'trail', 'sounds', 'sound']) expect(k in once).toBe(false);
  });

  it('round-trips what was bought and worn exactly', () => {
    const raw = { ...round5Save(), scarves: ['tassel', 'streamer'], scarf: 'streamer', hats: ['trapper'], hat: 'trapper', trails: ['comet'], trail: 'comet', sounds: ['bells', 'glass'], sound: 'glass' };
    const s = new MemStorage(raw);
    const a = new SaveStore(s, 'Fallback', TODAY);
    a.flush();
    const b = new SaveStore(s, 'Other', TODAY);
    expect(b.data).toEqual(a.data);
    expect(shelfState(b.data, 'scarf')).toEqual({ owned: ['classic', 'tassel', 'streamer'], on: 'streamer' });
    expect(shelfState(b.data, 'hat').on).toBe('trapper');
    expect(shelfState(b.data, 'trail').on).toBe('comet');
    expect(shelfState(b.data, 'sound')).toEqual({ owned: ['runners', 'bells', 'glass'], on: 'glass' });
  });

  it('drops what it cannot read and keeps the rest of the save', () => {
    const raw = {
      ...round5Save(),
      // Unknown ids, a duplicate, the free item, a number and a nested list.
      scarves: ['streamer', 'from-the-future', 'streamer', 'classic', 7, ['tassel']],
      // Worn but never bought.
      scarf: 'tassel',
      hats: 'trapper',
      hat: 'trapper',
      trails: [null, 'glints'],
      trail: { id: 'glints' },
      sounds: ['bells'],
      // The free one is never stored.
      sound: 'runners',
    };
    let store: SaveStore | null = null;
    expect(() => (store = load(raw))).not.toThrow();
    const d = store!.data;
    expect(d.scarves).toEqual(['streamer']);
    expect('scarf' in d).toBe(false);
    expect('hats' in d).toBe(false);
    expect('hat' in d).toBe(false);
    expect(d.trails).toEqual(['glints']);
    expect('trail' in d).toBe(false);
    expect(d.sounds).toEqual(['bells']);
    expect('sound' in d).toBe(false);
    expect(shelfState(d, 'scarf').on).toBe('classic');
    expect(d).toMatchObject({ gifts: 735, ownedSleds: [0, 1, 3], paints: ['pine', 'plum'], paint: 'plum' });
  });

  it('never throws on a mangled save', () => {
    for (const raw of ['nope', { v: 1, scarves: 4, hats: { a: 1 }, trails: 'x', sounds: [{}] }, { v: 1, scarf: 3, hat: null, trail: [], sound: true }]) {
      let store: SaveStore | null = null;
      expect(() => (store = load(raw))).not.toThrow();
      for (const s of SHELF_IDS) expect(shelfState(store!.data, s).on).toBe(freeItem(s));
    }
  });

  it('a fresh save holds nothing on any shelf but the free items', () => {
    const d = defaultSave('New');
    for (const s of SHELF_IDS) expect(shelfState(d, s)).toEqual({ owned: [freeItem(s)], on: freeItem(s) });
  });
});

describe('the garage keeps the colour roles and stays a look', () => {
  it('has one free item a shelf, unique ids, and a price on everything else', () => {
    for (const s of SHELF_IDS) {
      const list = SHELVES[s];
      expect(list.filter((i) => i.price === 0)).toHaveLength(1);
      expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
      for (const i of list) {
        expect(i.price === 0 || i.price >= 50).toBe(true);
        expect(i.name).not.toMatch(/[–—]/);
        expect(i.blurb).not.toMatch(/[–—]/);
      }
    }
  });

  it('sells the audio lane\'s sled sounds at its prices', () => {
    expect(SOUNDS.map((s) => [s.id, s.price])).toEqual(SLED_SOUNDS.map((s) => [s.id, s.price]));
  });

  it('keeps a scarf vermillion: its accent is at most cream or ink', () => {
    for (const s of SCARVES) expect(['none', 'cream', 'ink']).toContain(s.accent);
    expect(SCARVES[0]).toMatchObject({ id: 'classic', price: 0, length: 1, width: 1, accent: 'none' });
    expect(HATS[0]).toMatchObject({ id: 'beanie', price: 0 });
  });

  it('leaves a trail in warm roles only: never mint, rose, vermillion or the drift\'s coral', () => {
    const hue = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      if (mx === mn) return { h: 0, s: 0 };
      const d = mx - mn;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return { h: (h * 60 + 360) % 360, s: d / mx };
    };
    for (const t of TRAILS) {
      for (const c of [t.tint, t.mote]) {
        if (!c) continue;
        const { h, s } = hue(c);
        // Warm cream to marigold: hue 30 to 60 degrees (coral and vermillion sit under 25, rose over 330,
        // mint near 170), or barely tinted at all.
        expect(s < 0.12 || (h >= 30 && h <= 60), `${t.id} ${c}`).toBe(true);
      }
    }
  });

  it('never reaches the sim, the bot or a sled\'s handling', () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : n.endsWith('.ts') ? [join(dir, n)] : []));
    for (const f of [...files('src/sim'), ...files('src/bot')]) expect(readFileSync(f, 'utf8'), f).not.toMatch(/garage|sledsounds/);
    const g = readFileSync('src/game/garage.ts', 'utf8');
    expect(g).not.toMatch(/from '\.\.\/sim/);
  });
});

describe("a ward's beat of slow motion", () => {
  it('eases to 0.3 within 50 ms, holds to 0.3 s and is back to full by 0.52 s', () => {
    expect(sampleCurve(WARD_CURVE, 0)).toBe(1);
    expect(sampleCurve(WARD_CURVE, 0.05)).toBeCloseTo(0.3, 5);
    expect(sampleCurve(WARD_CURVE, 0.2)).toBeCloseTo(0.3, 5);
    expect(sampleCurve(WARD_CURVE, 0.3)).toBeCloseTo(0.3, 5);
    expect(sampleCurve(WARD_CURVE, 0.52)).toBe(1);
    for (let t = 0; t < 0.6; t += 0.01) {
      const s = sampleCurve(WARD_CURVE, t);
      expect(s).toBeGreaterThanOrEqual(0.3 - 1e-9);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('slows the feed and the render together, and plays none of it under reduced motion', () => {
    const ts = new TimeScale(() => false);
    ts.curve(WARD_CURVE, 'both');
    ts.step(0.1);
    ts.step(0);
    expect(ts.feed).toBeCloseTo(0.3, 5);
    expect(ts.render).toBeCloseTo(0.3, 5);
    const calm = new TimeScale(() => true);
    calm.curve(WARD_CURVE, 'both');
    calm.step(0.1);
    expect(calm.feed).toBe(1);
    expect(calm.render).toBe(1);
  });
});
