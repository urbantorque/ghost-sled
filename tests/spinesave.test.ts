import { describe, expect, it } from 'vitest';
import { xpToPage } from '../src/game/almanac';
import { settleSpine, type SpineRun } from '../src/game/rank';
import { SAVE_KEY, SaveStore, defaultSave } from '../src/game/save';
import { SEED_PAGE_CAP } from '../src/game/spinesave';
import { albumModel, almanacModel, resultsSpine, titleSpine } from '../src/game/spineview';
import { FINISH_Z } from '../src/game/standing';
import { SIM_VERSION } from '../src/sim/sim';

// The spine's save fields (round 8): optional, written only when they hold something, read safely, and a save from
// before the spine seeded once with what it has earned. And the screens' models, built from plain saves.

const TODAY = '2026-12-03';

class MemStorage {
  map = new Map<string, string>();
  constructor(raw?: unknown) {
    if (raw !== undefined) this.map.set(SAVE_KEY, JSON.stringify(raw));
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

const load = (raw: unknown): SaveStore => new SaveStore(new MemStorage(raw), 'Rider', TODAY);

/** A round 7 save: gifts, sleds, paints, mastery, The Twelve and a Climb, and no spine. */
function r7Save(): Record<string, unknown> {
  const d = defaultSave('Nico') as unknown as Record<string, unknown>;
  return {
    ...d,
    gifts: 412,
    lifetimeGifts: 5980,
    runs: 88,
    ghostsPassed: 140,
    ownedSleds: [0, 1, 2],
    paints: ['pine'],
    missions: { ...(d.missions as object), completed: 21 },
    mastery: { pinecrest: { gates: [1, 2], moments: ['firstdrop:won'], riders: ['bram'], clean: true } },
    twelve: { beaten: ['bram', 'juno'] },
    climb: { pinecrest: { v: SIM_VERSION, rung: 9, stages: [3, 2, 1], medal: 2 } },
  };
}

describe('a save from before the spine', () => {
  it('is seeded once, the same on every load, below page 25, with nothing opened yet', () => {
    const a = load(r7Save()).data;
    expect(a.rank?.xp).toBeGreaterThan(0);
    expect(a.rank?.xp).toBeLessThanOrEqual(xpToPage(SEED_PAGE_CAP));
    expect(a.rank?.claimed).toBe(0);
    expect(load(r7Save()).data.rank).toEqual(a.rank);
    // Written back and loaded again it keeps that rank, not a second seed.
    const s = load(r7Save());
    s.flush();
    const again = new SaveStore(s['storage' as never], 'Rider', TODAY).data;
    expect(again.rank).toEqual(a.rank);
  });

  it('keeps its shape: a save that never rode writes no spine field', () => {
    const s = load(defaultSave('New'));
    s.flush();
    const raw = JSON.parse((s['storage' as never] as MemStorage).getItem(SAVE_KEY)!);
    for (const k of ['rank', 'chapters', 'album', 'flame', 'contracts', 'league', 'longNight', 'recent', 'lit', 'title']) expect(raw[k], k).toBeUndefined();
  });

  it('keeps the spine whole across a clean break that archives the Climb', () => {
    const raw = { ...r7Save(), rank: { xp: 9000, claimed: 6 }, flame: { last: '2026-12-02', streak: 4, best: 4, ember: 1, days: 9 }, album: { got: { 'x:pinecrest': 3 } }, league: { week: '2026-W49', div: 3 }, climb: { pinecrest: { v: SIM_VERSION - 1, rung: 4 } } };
    const d = load(raw).data;
    expect(d.climb).toBeUndefined();
    expect(d.archive?.climb?.pinecrest).toBeDefined();
    expect(d.rank).toEqual({ xp: 9000, claimed: 6 });
    expect(d.flame?.streak).toBe(4);
    expect(d.album?.got['x:pinecrest']).toBe(3);
    expect(d.league?.div).toBe(3);
  });
});

describe('the spine round-trips and reads mangled values safely', () => {
  it('round-trips every field exactly', () => {
    const d = defaultSave('Rider');
    d.runs = 3;
    d.rank = { xp: 1200, claimed: 2 };
    d.title = 'Rider';
    d.chapters = { '2026-12': { xp: 1600, claimed: 1 } };
    d.album = { got: { 'm:pinecrest:1': 2, 't:spin': 1 }, runs: { '2': 'rec' } };
    d.flame = { last: '2026-12-02', streak: 2, best: 2, ember: 0, days: 2 };
    d.contracts = { day: TODAY, list: [{ id: 'a', on: 'daily', metric: 'finish', target: 1 }], done: 1, form: { id: 'form:0', on: 'any', metric: 'passes', target: 3 }, drawn: 1 };
    d.league = { week: '2026-W49', div: 4, best: 140.2, place: 7 };
    d.longNight = { legs: 2, z: 812 };
    d.recent = [{ k: 'pinecrest', t: 131.2, ss: [40, 45, 46], s: { ghostsPassed: 3, finished: true }, won: 1, tricks: 2, xp: 400 }];
    d.lit = ['pinecrest:0'];
    const s = new SaveStore(new MemStorage(d), 'Rider', TODAY);
    for (const k of ['rank', 'title', 'chapters', 'album', 'flame', 'contracts', 'league', 'longNight', 'recent', 'lit'] as const) expect(s.data[k], k).toEqual(d[k]);
  });

  it('drops or clamps what it cannot read and keeps the rest', () => {
    const raw = {
      ...(defaultSave('Rider') as object),
      runs: 2,
      rank: { xp: -50, claimed: 99 },
      chapters: { '2026-13': { xp: 5 }, '2026-12': { xp: 3000, claimed: 2 } },
      album: { got: { 'zz:nope': 1, 't:spin': 4 } },
      flame: { last: '2027-06-01', streak: 3, ember: 7, days: 3 },
      contracts: { day: TODAY, list: [{ id: 'x', on: 'daily', metric: 'fly', target: 1 }], done: 99 },
      league: { week: '2026-W49', div: 9 },
      longNight: { legs: 'a' },
      recent: [{ k: 3 }, { k: 'pinecrest', s: {}, t: 'fast' }],
      lit: ['pinecrest:1'],
    };
    const d = load(raw).data;
    expect(d.rank).toBeUndefined();
    expect(Object.keys(d.chapters ?? {})).toEqual(['2026-12']);
    expect(d.album?.got).toEqual({ 't:spin': 4 });
    expect(d.flame?.last).toBe(TODAY);
    expect(d.flame?.ember).toBe(1);
    expect(d.contracts?.list).toEqual([]);
    expect(d.contracts?.done).toBe(7);
    expect(d.league?.div).toBe(5);
    expect(d.longNight).toBeUndefined();
    expect(d.recent).toHaveLength(1);
    expect(d.lit).toBeUndefined();
  });
});

describe('the screens get plain models', () => {
  const run: SpineRun = {
    key: 'pinecrest', mi: 0, mountainId: 'pinecrest', mirror: false, day: TODAY, week: '2026-W49',
    sum: { mountain: 'pinecrest', biome: 'alpine', score: 9000, distance: FINISH_Z, gifts: 30, lights: 30, dashes: 3, phased: 0, skyGates: 0, wards: 0, perfects: 3, maxAirtime: 1.4, maxHalfTurns: 2, flips: 0, driftSeconds: 4, draftSeconds: 3, nearMisses: 4, bestCombo: 2000, maxSpeed: 34, smashes: 0, gates: 0, yetiHop: false, outranAvalanche: false, ghostsPassed: 4, grudgeBeaten: false, chaos: false, seconds: 130, finished: true, finishSeconds: 130, tumbles: 0, wallRides: 0, grinds: 0 },
    time: 130, stageSeconds: [42, 44, 44], beaten: 3, passed: 4, tricks: [{ key: 'spin', fresh: true }], moments: [], showdownsWon: 0, charms: [], synergies: [], legend: 0, mood: 1, missions: [1, 1], rungs: 2, stageMedals: [], runMedal: 0, dayMedal: 0, stars: 4, duelWon: null, crowned: false, newBestTime: false, lostTo: { name: 'Old Wren', kind: 'rival', seconds: 0.4, metres: null }, board: null, open: ['pinecrest'], dailyReady: true, record: 'rec',
  };

  it('fills the results: the bar before and after, what opened, stickers with their frame, the one button', () => {
    const d = defaultSave('Rider');
    d.runs = 1;
    const o = settleSpine(d, run);
    const m = resultsSpine(o, d, TODAY);
    expect(m.after.xp).toBe(m.before.xp + o.xp);
    expect(m.opened.length).toBeGreaterThan(0);
    expect(m.stickers.every((s) => s.frame)).toBe(true);
    expect(m.primary).toMatchObject({ kind: 'rematch', text: 'Rematch Old Wren' });
    expect(m.ticks.reduce((a, t) => a + t.xp, 0)).toBe(o.xp);
  });

  it('fills the title, the Almanac and the album from a plain save', () => {
    const d = defaultSave('Rider');
    d.runs = 1;
    settleSpine(d, run);
    const t = titleSpine(d, TODAY, { week: '2026-W49', open: (m) => m === 'pinecrest' });
    expect(t.bar.page).toBeGreaterThan(0);
    expect(t.flame).toMatchObject({ litToday: true, streak: 1 });
    expect(t.chapter?.name).toBe('Lantern Night');
    expect(t.lanterns).toHaveLength(1);
    const a = almanacModel(d, TODAY);
    expect(a.pages).toHaveLength(50);
    expect(a.pages[0].state).toBe('opened');
    const al = albumModel(d);
    expect(al.sections.find((s) => s.id === 'pinecrest')?.got).toBeGreaterThan(0);
    expect(al.got).toBeLessThan(al.of);
  });
});
