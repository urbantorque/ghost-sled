import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Fixture, fixtureStorage, shiftSave } from '../src/game/devsave';
import { SAVE_KEY, SaveStore } from '../src/game/save';
import { weekOfDay } from '../src/game/cup';
import { chapterKey } from '../src/game/almanac';

// Round 9, the truth lane: the save fixtures (scripts/playtest/fixtures, r9-fixtures.ts) and the dev switch that loads
// one (`?debug&save=<name>`, src/game/devsave.ts): each loads through the real store with its days moved to today,
// the real save is never written, and the switch is compiled out of the release.

class MemStorage {
  map = new Map<string, string>();
  writes: string[] = [];
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.writes.push(k);
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

const DIR = resolve(__dirname, '../scripts/playtest/fixtures');
const fixtures: Fixture[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => JSON.parse(readFileSync(resolve(DIR, f), 'utf8')) as Fixture);
const TODAY = '2026-11-23';

describe('save fixtures', () => {
  it('there are eleven: fresh, and the mid and novice pilots at runs 1, 5, 20, 50 and 100', () => {
    const names = fixtures.map((f) => f.meta.name).sort();
    expect(names).toEqual(['fresh', ...['mid', 'novice'].flatMap((p) => [1, 5, 20, 50, 100].map((n) => `${p}-${n}`))].sort());
  });

  for (const fx of fixtures) {
    it(`${fx.meta.name} loads through the store as a save of its run, its days today`, () => {
      const real = new MemStorage();
      fixtureStorage(real, fx, TODAY);
      const d = new SaveStore(real, 'Fallback', TODAY).data;
      if (!fx.save) {
        expect(d.runs).toBe(0);
        expect(d.name).toBe('Fallback');
        return;
      }
      expect(d.runs).toBe(fx.meta.run);
      expect(d.name).toBe(fx.save.name);
      const day = fx.meta.day as string;
      const src = fx.save as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      // The flame was lit on the fixture's last day: it is lit today, its streak whole.
      if (src.flame) {
        expect(d.flame?.last).toBe(TODAY);
        expect(d.flame?.streak).toBe(src.flame.streak);
      }
      if (src.daily?.key === day) expect(d.daily.key).toBe(TODAY);
      if (src.contracts?.day === day) expect(d.contracts?.day).toBe(TODAY);
      if (src.cup?.key === weekOfDay(day)) expect(d.cup?.key).toBe(weekOfDay(TODAY));
      if (src.league?.week === weekOfDay(day)) expect(d.league?.week).toBe(weekOfDay(TODAY));
      if (src.chapters?.[chapterKey(day)]) expect(d.chapters?.[chapterKey(TODAY)]).toEqual(src.chapters[chapterKey(day)]);
      // No Daily, Cup or Trial record of another day's course rides as today's.
      for (const k of Object.keys(d.best)) expect(/^(daily|cup|trial):/.test(k)).toBe(false);
      expect(Object.keys(d.best).length).toBeGreaterThan(0);
    });
  }

  it('the real save is never read or written while a fixture is in place', () => {
    const real = new MemStorage();
    real.map.set(SAVE_KEY, JSON.stringify({ v: 1, name: 'Mine', runs: 7 }));
    real.map.set('other', 'kept');
    const fx = fixtures.find((f) => f.meta.name === 'mid-50')!;
    fixtureStorage(real, fx, TODAY);
    const store = new SaveStore(real, 'Fallback', TODAY);
    expect(store.data.runs).toBe(50);
    store.data.runs = 51;
    store.flush();
    expect(JSON.parse(real.map.get(SAVE_KEY)!).name).toBe('Mine');
    expect(real.writes).toEqual([]);
    expect(real.getItem('other')).toBe('kept');
    // The session's own writes are read back (a run ridden on a fixture counts until the page is left).
    expect(new SaveStore(real, 'Fallback', TODAY).data.runs).toBe(51);
  });

  it('shiftSave moves days, ISO weeks and months across a year', () => {
    const s = shiftSave(
      {
        daily: { key: '2027-01-03', last: '2027-01-03' },
        cup: { key: '2026-W53' },
        flame: { last: '2027-01-03' },
        contracts: { day: '2027-01-03' },
        league: { week: '2026-W53', last: { week: '2026-W52' } },
        trials: { '2026-W52': { medal: 2 } },
        chapters: { '2026-12': { xp: 1, claimed: 0 }, '2027-01': { xp: 2, claimed: 1 } },
        best: { 'daily:2027-01-03': { score: 1 }, pinecrest: { score: 2 } },
        recent: [{ k: 'daily:2027-01-02' }, { k: 'cup:2026-W53' }],
      },
      '2027-01-03',
      TODAY,
    ) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(s.daily).toEqual({ key: TODAY, last: TODAY });
    expect(weekOfDay(TODAY)).toBe('2026-W48');
    expect(s.cup.key).toBe('2026-W48');
    expect(s.flame.last).toBe(TODAY);
    expect(s.league).toEqual({ week: '2026-W48', last: { week: '2026-W47' } });
    expect(Object.keys(s.trials)).toEqual(['2026-W47']);
    expect(s.chapters).toEqual({ '2026-10': { xp: 1, claimed: 0 }, '2026-11': { xp: 2, claimed: 1 } });
    expect(Object.keys(s.best)).toEqual(['pinecrest']);
    expect(s.recent.map((r: { k: string }) => r.k)).toEqual(['daily:2026-11-22', 'cup:2026-W48']);
  });

  it('the switch is dev only: app.ts reaches it behind import.meta.env.DEV, and the plugin only serves', () => {
    const app = readFileSync(resolve(__dirname, '../src/game/app.ts'), 'utf8');
    const uses = app.split('\n').filter((l) => l.includes('useFixture('));
    expect(uses.length).toBe(1);
    expect(uses[0]).toMatch(/if \(import\.meta\.env\.DEV && DEV\.has\('save'\)\) useFixture\(/);
    const vite = readFileSync(resolve(__dirname, '../vite.config.ts'), 'utf8');
    expect(vite).toMatch(/apply: 'serve'/);
  });
});
