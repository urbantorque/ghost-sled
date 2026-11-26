import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALMANAC, CHAPTER_EXTRAS, GARAGE_EXTRAS, chapterRewards, shelfExtras } from '../src/game/almanac';
import { HATS, ORNAMENTS, SCARVES, SETS, SHELVES, TRAILS, chapterPieces, isOrnament, ornamentById, setPiecesFor } from '../src/game/garage';
import { KEPT_PAINTS, PAINTS, isPaint, paintById } from '../src/game/paints';
import { XP, settleSpine, type SpineRun } from '../src/game/rank';
import { SAVE_KEY, SaveStore, defaultSave, ornamentState, type SaveData } from '../src/game/save';
import { FINISH_Z } from '../src/game/standing';
import { SLED_SHOP, TRACK_LINES, creditLines, fitTier, giveTiers, linesToGo, readTracks, tierState, trackOf, trackPrice } from '../src/game/tracks';
import type { RunSummary } from '../src/game/missions';

// Round 9, the shop lane: the garage's model (notes/r9-shop.md). Each sled's track opened by riding and fitted for
// gifts; the found pieces (the Almanac's, the mountains' sets, the months' chapters) never the shop's; no Almanac page
// ever silent; an old save loads whole.

const DAY = '2026-12-03';

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

function sum(over: Partial<RunSummary> = {}): RunSummary {
  return { mountain: 'pinecrest', biome: 'alpine', score: 9000, distance: FINISH_Z, gifts: 30, lights: 30, dashes: 3, phased: 0, skyGates: 0, wards: 0, perfects: 3, maxAirtime: 1.4, maxHalfTurns: 2, flips: 0, driftSeconds: 4, draftSeconds: 3, nearMisses: 4, bestCombo: 2000, maxSpeed: 34, smashes: 0, gates: 0, yetiHop: false, outranAvalanche: false, ghostsPassed: 4, grudgeBeaten: false, chaos: false, seconds: 130, finished: true, finishSeconds: 130, tumbles: 0, wallRides: 0, grinds: 0, ...over };
}

function spineRun(over: Partial<SpineRun> = {}): SpineRun {
  return { key: 'pinecrest', mi: 0, mountainId: 'pinecrest', mirror: false, day: DAY, week: '2026-W49', sum: sum(), time: 130, stageSeconds: [42, 44, 44], beaten: 3, passed: 4, tricks: [{ key: 'spin', fresh: true }], moments: [{ key: 'firstdrop', variant: 0, won: true }], showdownsWon: 0, charms: [], synergies: [], legend: 0, mood: 0, missions: [], rungs: 0, stageMedals: [], runMedal: 0, dayMedal: 0, stars: 0, duelWon: null, crowned: false, newBestTime: false, lostTo: null, board: null, open: ['pinecrest'], dailyReady: false, ...over };
}

/** A save whose next run turns page `n` (the pages before it claimed). */
function atPage(n: number): SaveData {
  const d = defaultSave('Rider');
  d.runs = 5;
  let xp = 0;
  for (let i = 1; i < n; i++) xp += i <= 10 ? 240 + 60 * i : i <= 30 ? 1000 + 80 * (i - 10) : 2800;
  d.rank = { xp: xp + (n <= 10 ? 240 + 60 * n : 2800) - 10, claimed: n - 1 };
  return d;
}

describe('a sled\'s track', () => {
  it('opens each tier by riding that sled, then fits it for gifts', () => {
    const d = defaultSave('Rider');
    expect(tierState(d, 0, 0)).toBe('ride');
    expect(linesToGo(d, 0, 0)).toBe(TRACK_LINES[0]);
    creditLines(d, 0, 2);
    expect(tierState(d, 0, 0)).toBe('ride');
    expect(fitTier(d, 0)).toBe(-1);
    creditLines(d, 0, 3);
    expect(tierState(d, 0, 0)).toBe('open');
    expect(tierState(d, 0, 1)).toBe('later');
    // Not without the gifts.
    expect(fitTier(d, 0)).toBe(-1);
    d.gifts = 500;
    expect(fitTier(d, 0)).toBe(0);
    expect(d.gifts).toBe(500 - trackPrice(0, 0));
    expect(trackOf(d, 0)).toEqual({ lines: 5, fitted: 1 });
    expect(tierState(d, 0, 0)).toBe('fitted');
    expect(tierState(d, 0, 1)).toBe('ride');
  });

  it('credits a run\'s lines only to a sled the save owns, three at most', () => {
    const d = defaultSave('Rider');
    creditLines(d, 3, 3);
    expect(d.tracks).toBeUndefined();
    creditLines(d, 0, 9);
    expect(trackOf(d, 0).lines).toBe(3);
  });

  it('prices each sled\'s tiers by its factor: 9,930 gifts for all six tracks', () => {
    expect([0, 1, 2, 3, 4].map((t) => trackPrice(0, t))).toEqual([80, 150, 240, 360, 520]);
    expect(trackPrice(5, 4)).toBe(830);
    let all = 0;
    for (const s of SLED_SHOP) for (let t = 0; t < 5; t++) all += trackPrice(s.index, t);
    expect(all).toBe(9930);
  });

  it('reads a strange tracks field as nothing and keeps what it can', () => {
    expect(readTracks(null)).toBeNull();
    expect(readTracks({ flyer: { lines: -4, fitted: 9 }, nope: { lines: 3 } })).toEqual({ flyer: { lines: 0, fitted: 5 } });
    expect(readTracks({ flyer: { lines: 0, fitted: 0 } })).toBeNull();
  });

  it('never touches the sim: tracks.ts and garage.ts read nothing of it', () => {
    for (const f of ['src/game/tracks.ts', 'src/game/garage.ts', 'src/game/paints.ts', 'src/render/trailforms.ts']) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from '\.\.\/sim/);
  });
});

describe('the shelves', () => {
  it('sells the Whirl Saucer nowhere: it is the Almanac\'s page 5', () => {
    expect(SLED_SHOP[1]).toMatchObject({ key: 'whirl', from: 'almanac', page: 5, price: 0 });
    expect(ALMANAC[4].rewards.some((r) => r.kind === 'sled' && r.sled === 1)).toBe(true);
  });

  it('has ten hats (the Crest Knit and the Flop Peak cut), every one of them sold or free, and none of The Twelve\'s', () => {
    expect(HATS).toHaveLength(10);
    expect(new Set(HATS.map((h) => h.id)).size).toBe(10);
    for (const h of HATS) expect(h.name).not.toMatch(/crown|antler|horn|fox|stovepipe|topknot/i);
  });

  it('lists found pieces on their shelves, never for sale: the Almanac\'s and the sets\'', () => {
    for (const list of [SCARVES, TRAILS]) for (const p of list) if (p.source.kind === 'almanac' || p.source.kind === 'set') expect(p.price).toBe(0);
    for (const p of PAINTS) if (p.source.kind === 'almanac') expect(p.price).toBe(0);
    expect(GARAGE_EXTRAS.map((g) => g.page)).toEqual([17, 28, 38, 42, 46, 50]);
  });

  it('gives each mountain a set of three on its own motif, and each month a scarf, a trail and an ornament', () => {
    for (const [m, ids] of Object.entries(SETS)) {
      expect(SHELVES.scarf.some((s) => s.id === ids[0]), m).toBe(true);
      expect(SHELVES.trail.some((s) => s.id === ids[1]), m).toBe(true);
      expect(isOrnament(ids[2]), m).toBe(true);
    }
    for (let m = 1; m <= 12; m++) {
      const p = chapterPieces(m);
      expect([p.scarf.id, p.trail.id, p.ornament.id]).toEqual([`ch${m}scarf`, `ch${m}trail`, `ch${m}orn`]);
    }
    expect(chapterRewards(4, 8)).toEqual([{ kind: 'garage', shelf: 'ornament', id: 'ch4orn' }]);
    expect(shelfExtras('2026-12-01').map((e) => e.shelf)).toEqual(['scarf', 'trail', 'ornament']);
  });

  it('opens a set\'s pieces at a third, two thirds and all of its board', () => {
    expect([0, 3, 4, 7, 8, 11, 12].map((k) => setPiecesFor(k, 12))).toEqual([0, 0, 1, 1, 2, 2, 3]);
    expect(setPiecesFor(5, 0)).toBe(0);
  });

  it('keeps today\'s paints as finishes, a round 8 chapter paint as a kept finish, and no navy ground', () => {
    for (const id of ['natural', 'pine', 'glacier', 'midnight', 'plum', 'cocoa', 'snow', 'ash', 'almanacdusk']) expect(isPaint(id), id).toBe(true);
    expect(isPaint('ch7paint')).toBe(true);
    expect(paintById('ch7paint').hex).toBe(KEPT_PAINTS[6].hex);
    // No ground in the coat's ink navy: blue dominant and dark.
    for (const p of PAINTS) {
      if (!p.hex) continue;
      const r = parseInt(p.hex.slice(1, 3), 16);
      const g = parseInt(p.hex.slice(3, 5), 16);
      const b = parseInt(p.hex.slice(5, 7), 16);
      expect(b > r + 20 && b > g && r + g + b < 3 * 110, p.id).toBe(false);
    }
  });

  it('leaves every trail\'s shapes in warm roles only', () => {
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
      const f = t.form;
      const cols = !f ? [] : f.kind === 'flakes' ? [f.body, f.edge] : f.kind === 'ribbons' ? [f.head, f.tail] : f.kind === 'kites' ? [f.body, f.alt] : [f.body];
      for (const c of [t.tint, t.mote, ...cols]) {
        if (!c) continue;
        const { h, s } = hue(c);
        expect(s < 0.12 || (h >= 30 && h <= 60), `${t.id} ${c}`).toBe(true);
      }
    }
  });
});

describe('no Almanac page is ever silent', () => {
  it('gives a save that bought the Whirl Saucer its first two tiers, said on the card', () => {
    const d = atPage(5);
    d.ownedSleds = [0, 1];
    const o = settleSpine(d, spineRun());
    const card = o.opened.find((x) => x.reward.kind === 'sled');
    expect(card?.name).toMatch(/Whirl Saucer: its runners and deck fitted/);
    expect(trackOf(d, 1).fitted).toBe(2);
    // A revive's second settle takes it back first, then gives it once.
    const again = settleSpine(d, spineRun(), o.settlement);
    expect(trackOf(d, 1).fitted).toBe(2);
    expect(again.opened.find((x) => x.reward.kind === 'sled')?.name).toMatch(/fitted/);
  });

  it('gives a save that had not the Saucer the Saucer itself', () => {
    const d = atPage(5);
    const o = settleSpine(d, spineRun());
    expect(d.ownedSleds).toContain(1);
    expect(o.opened.find((x) => x.reward.kind === 'sled')?.name).toBe('The Whirl Saucer');
  });

  it('pays a chapter piece bought before its page its price back, and says so', () => {
    const d = atPage(2);
    d.runs = 3;
    d.chapters = { '2026-12': { xp: 1500 * 3 - 5, claimed: 2 } };
    d.scarves = ['ch12scarf'];
    const before = d.gifts;
    const o = settleSpine(d, spineRun({ day: '2026-12-03' }));
    const card = o.opened.find((x) => x.chapter === '2026-12' && x.page === 3);
    expect(card?.name).toBe('You had the Star Knit: 260 gifts back');
    expect(d.gifts - before).toBeGreaterThanOrEqual(260);
  });

  it('puts a chapter\'s ornament in the ornaments held', () => {
    const d = atPage(2);
    d.runs = 3;
    d.chapters = { '2026-12': { xp: 1500 * 8 - 5, claimed: 7 } };
    settleSpine(d, spineRun({ day: '2026-12-03' }));
    expect(d.ornaments).toContain('ch12orn');
    expect(ornamentState(d)).toEqual({ owned: ['lamp', 'ch12orn'], on: 'lamp' });
    expect(XP.finish).toBeGreaterThan(0);
  });
});

describe('the garage on an old save', () => {
  it('loads a round 8 save whole: its paints as finishes, its chapter pieces kept, nothing invented', () => {
    const raw = { v: 1, name: 'Ilse', gifts: 300, lifetimeGifts: 900, ghostsPassed: 12, runs: 30, sled: 1, ownedSleds: [0, 1], mountain: 'pinecrest', best: {}, grudge: {}, missions: { active: [], cursor: 0, completed: 0 }, settings: {}, stats: {}, hints: {}, daily: {}, paints: ['midnight', 'ch7paint'], paint: 'ch7paint', scarves: ['ch12scarf', 'creambar'], scarf: 'ch12scarf', trails: ['stardust', 'almanacmoth'], trail: 'stardust', hats: ['bobbles'], hat: 'bobbles' };
    const s = new SaveStore(new MemStorage(raw), 'x');
    const d = s.data;
    expect(d.paints).toEqual(['midnight', 'ch7paint']);
    expect(d.paint).toBe('ch7paint');
    expect(d.scarves).toEqual(['ch12scarf', 'creambar']);
    expect(d.trails).toEqual(['stardust', 'almanacmoth']);
    expect(d.hat).toBe('bobbles');
    expect(d.ownedSleds).toEqual([0, 1]);
    for (const k of ['tracks', 'ornaments', 'ornament', 'sets'] as const) expect(d[k]).toBeUndefined();
  });

  it('round-trips the tracks, the ornaments and the sets, and drops what it cannot read', () => {
    const raw = { ...defaultSave('A'), tracks: { flyer: { lines: 12, fitted: 2 }, comet: 'x' }, ornaments: ['cowbell', 'lamp', 'nope', 'cowbell'], ornament: 'cowbell', sets: { pinecrest: 2, frostfang: 9, BAD: 1, ember: -1 } };
    const d = new SaveStore(new MemStorage(raw), 'x').data;
    expect(d.tracks).toEqual({ flyer: { lines: 12, fitted: 2 } });
    expect(d.ornaments).toEqual(['cowbell']);
    expect(d.ornament).toBe('cowbell');
    expect(d.sets).toEqual({ pinecrest: 2, frostfang: 3 });
    const d2 = new SaveStore(new MemStorage({ ...defaultSave('A'), ornaments: [], ornament: 'icefang' }), 'x').data;
    expect(d2.ornament).toBeUndefined();
    expect(ornamentById('nope').id).toBe('lamp');
  });

  it('knows every Almanac and chapter piece it may hold', () => {
    for (const e of [...GARAGE_EXTRAS, ...CHAPTER_EXTRAS]) {
      if (e.shelf === 'paint') expect(isPaint(e.id), e.id).toBe(true);
      else if (e.shelf === 'ornament') expect(isOrnament(e.id), e.id).toBe(true);
      else expect(SHELVES[e.shelf].some((s) => s.id === e.id), e.id).toBe(true);
    }
    expect(ORNAMENTS[0].id).toBe('lamp');
    expect(giveTiers(defaultSave('A'), 9, 2)).toBeGreaterThanOrEqual(0);
  });
});
