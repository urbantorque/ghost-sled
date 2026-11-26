import { describe, expect, it } from 'vitest';
import { ALMANAC, LANTERNFALL_PAGE, CHAPTERS, CHAPTER_EXTRAS, CHARM_IDS, GARAGE_EXTRAS, PAGES, STARTER_CHARMS, almanacGates, almanacPool, chapterKey, chapterRewards, mirrorOpen, pageAt, pageCost, shelfExtras, xpToPage } from '../src/game/almanac';
import { albumCatalogue, albumCompletion, awardStickers, stickersFor, type AlbumRun } from '../src/game/album';
import { drawContracts, drawForm, meets, settleContracts, type ContractRun } from '../src/game/contracts';
import { CALENDAR_XP, flameNow, lightDay } from '../src/game/flame';
import { isItem, isOrnament, scarfById, trailById } from '../src/game/garage';
import { nextGoals, primaryButton, type NextGoal } from '../src/game/goals';
import { DIVISIONS, LEAGUE_SIZE, leagueField, leagueNow, nextDivision, settleLeague } from '../src/game/league';
import { LANTERNS, lightLantern, litByTown, litIn, readLit } from '../src/game/lanterns';
import { lanternRow } from '../src/game/spineview';
import { SWAP_AFTER, applyRun, newMissionState, swapMission, swappable, type RunSummary } from '../src/game/missions';
import { LEGS, legChaos, legStep, mirrorSteer, settleLongNight } from '../src/game/modes';
import { OPENER_LEAD, OPENER_MIN, OPENER_STEADY, openerOf, openerRate } from '../src/game/pacer';
import { isPaint, paintById } from '../src/game/paints';
import { XP, nextPage, settleSpine, xpTicks, type SpineRun } from '../src/game/rank';
import { defaultSave, type SaveData } from '../src/game/save';
import { FINISH_Z } from '../src/game/standing';
import { FIRST_DUEL_RUN, KING, TWELVE, duelMountain, duelOn, mountainOpen, nextDuel } from '../src/game/twelve';
import { MOUNTAINS } from '../src/sim/mountains';
import type { RecentRun } from '../src/game/spinesave';
import { ChaosEvent, Mood } from '../src/sim/chaos';

// Round 8's spine (milestone 3): Rider Rank and the Almanac, the flame, contracts, leagues, the album, the next-run
// goals and the one button, the Long Night and mirrors, the Lantern Row, the first minute's opener, the mission swap
// and the duels that wait. Plain models, no screens.

const DAY = '2026-12-03';

function sum(over: Partial<RunSummary> = {}): RunSummary {
  return { mountain: 'pinecrest', biome: 'alpine', score: 9000, distance: FINISH_Z, gifts: 30, lights: 30, dashes: 3, phased: 0, skyGates: 0, wards: 0, perfects: 3, maxAirtime: 1.4, maxHalfTurns: 2, flips: 0, driftSeconds: 4, draftSeconds: 3, nearMisses: 4, bestCombo: 2000, maxSpeed: 34, smashes: 0, gates: 0, yetiHop: false, outranAvalanche: false, ghostsPassed: 4, grudgeBeaten: false, chaos: false, seconds: 130, finished: true, finishSeconds: 130, tumbles: 0, wallRides: 0, grinds: 0, ...over };
}

function spineRun(over: Partial<SpineRun> = {}): SpineRun {
  return { key: 'pinecrest', mi: 0, mountainId: 'pinecrest', mirror: false, day: DAY, week: '2026-W49', sum: sum(), time: 130, stageSeconds: [42, 44, 44], beaten: 3, passed: 4, tricks: [{ key: 'spin', fresh: true }], moments: [{ key: 'firstdrop', variant: 0, won: true }], showdownsWon: 0, charms: [], synergies: [], legend: 0, mood: 0, missions: [], rungs: 0, stageMedals: [], runMedal: 0, dayMedal: 0, stars: 0, duelWon: null, crowned: false, newBestTime: false, lostTo: null, board: null, open: ['pinecrest'], dailyReady: false, ...over };
}

function save(): SaveData {
  const d = defaultSave('Rider');
  d.runs = 1;
  return d;
}

describe('the Almanac', () => {
  it('has fifty pages, a reward on every one, and the first ten each change how a run plays', () => {
    expect(ALMANAC).toHaveLength(PAGES);
    for (const p of ALMANAC) expect(p.rewards.length).toBeGreaterThan(0);
    const plays = new Set(['charm', 'gate', 'feature', 'sled', 'mirror', 'legs']);
    for (const p of ALMANAC.slice(0, 10)) if (p.n !== 3) expect(p.rewards.some((r) => plays.has(r.kind)), `page ${p.n}`).toBe(true);
  });

  it('opens every charm into the pool by page 43, from the six starters', () => {
    const d = save();
    expect(almanacPool(d)).toBe(STARTER_CHARMS.reduce((m, k) => m | (1 << CHARM_IDS[k]), 0));
    d.rank = { xp: xpToPage(43), claimed: 43 };
    expect(almanacPool(d)).toBe((1 << 24) - 1);
  });

  it('stands one charm gate, a second from page 1 and a third from page 4', () => {
    const d = save();
    expect(almanacGates(d)).toBe(1);
    d.rank = { xp: xpToPage(1), claimed: 1 };
    expect(almanacGates(d)).toBe(2);
    d.rank = { xp: xpToPage(4), claimed: 4 };
    expect(almanacGates(d)).toBe(3);
  });

  it('costs more a page as it goes, and pageAt inverts it', () => {
    for (let n = 2; n <= PAGES; n++) expect(pageCost(n)).toBeGreaterThanOrEqual(pageCost(n - 1));
    for (const n of [1, 10, 25, 50]) expect(pageAt(xpToPage(n)).page).toBe(n);
    expect(pageAt(xpToPage(10) - 1).page).toBe(9);
  });

  it('opens Lanternfall to ride on its page, and keeps the King and the last race for the eleven', () => {
    const d = save();
    const lf = MOUNTAINS.find((m) => m.finale)!;
    const all = (): boolean => true;
    expect(mountainOpen(d, lf)).toBe(false);
    d.rank = { xp: xpToPage(LANTERNFALL_PAGE), claimed: LANTERNFALL_PAGE };
    expect(mountainOpen(d, lf)).toBe(true);
    // Ten of the eleven down: the next duel is the eleventh rider, never the King.
    const ten = TWELVE.filter((r) => r !== KING).slice(0, 10).map((r) => r.key);
    expect(nextDuel({ beaten: ten }, all)).toMatchObject({ kind: 'duel', rider: TWELVE.filter((r) => r !== KING)[10] });
    expect(nextDuel({ beaten: TWELVE.filter((r) => r !== KING).map((r) => r.key) }, all)).toMatchObject({ kind: 'duel', rider: KING });
  });

  it('opens a mirror on its page, or once its home riders have all fallen in duels', () => {
    const d = save();
    expect(mirrorOpen(d, 'lanternfall')).toBe(false);
    d.twelve = { beaten: ['crown'] };
    expect(mirrorOpen(d, 'lanternfall')).toBe(true);
  });

  it('has a chapter a month, its set on the shelf from its month on and kept by the garage', () => {
    expect(CHAPTERS).toHaveLength(12);
    expect(chapterKey('2027-02-14')).toBe('2027-02');
    expect(shelfExtras('2026-11-30')).toHaveLength(0);
    expect(shelfExtras('2026-12-01').map((e) => e.chapter)).toEqual([12, 12]);
    expect(shelfExtras('2027-02-01').length).toBe(6);
    expect(chapterRewards(12, 10)[0].kind).toBe('title');
    for (const e of [...CHAPTER_EXTRAS, ...GARAGE_EXTRAS]) {
      if (e.shelf === 'paint') expect(isPaint(e.id) && paintById(e.id).id === e.id).toBe(true);
      else if (e.shelf === 'ornament') expect(isOrnament(e.id)).toBe(true);
      else expect(isItem(e.shelf, e.id)).toBe(true);
    }
    expect(scarfById('ch12scarf').id).toBe('ch12scarf');
    expect(trailById('almanackeeper').id).toBe('almanackeeper');
  });
});

describe('Rider Rank', () => {
  it('pays every source of the table', () => {
    const t = xpTicks(spineRun({ missions: [1, 2], rungs: 3, stageMedals: [3], runMedal: 1, stars: 2, duelWon: 'bram', newBestTime: true, showdownsWon: 1 }), { variants: 1, charms: 1 });
    const by = Object.fromEntries(t.map((k) => [k.source, k.xp]));
    expect(by.ride).toBe(XP.ride + 3 * XP.stage + XP.finish);
    expect(by.place).toBe(24);
    expect(by.mission).toBe(100);
    expect(by.medal).toBe(40 + 30);
    expect(by.duel).toBe(XP.duel);
    expect(by.charm).toBe(XP.charmNew);
    expect(by.setPiece).toBe(XP.setPiece + XP.variantNew);
  });

  it('settles a run once: a second settle of the same run (a revive) changes nothing more', () => {
    const d = save();
    const a = settleSpine(d, spineRun());
    const once = JSON.stringify({ ...d });
    const b = settleSpine(d, spineRun(), a.settlement);
    expect(JSON.stringify({ ...d })).toBe(once);
    expect(b.xp).toBe(a.xp);
  });

  it('turns pages, opens their rewards and lights the day', () => {
    const d = save();
    const o = settleSpine(d, spineRun({ missions: [1, 1, 1], stars: 6 }));
    expect(o.pageAfter).toBeGreaterThanOrEqual(1);
    expect(o.gains.some((g) => g.kind === 'page')).toBe(true);
    expect(o.gains.some((g) => g.kind === 'streak')).toBe(true);
    expect(o.opened.some((r) => r.reward.kind === 'gate')).toBe(true);
    expect(nextPage(d)?.page).toBe(o.pageAfter + 1);
  });

  it('opens a seeded backlog one page more a run', () => {
    const d = save();
    d.rank = { xp: xpToPage(12), claimed: 0 };
    const o = settleSpine(d, spineRun({ sum: sum({ finished: false, distance: 100, finishSeconds: 0 }), time: null, stageSeconds: [], beaten: 0, passed: 0, tricks: [], moments: [] }));
    expect(d.rank.claimed).toBe(1 + (o.pageAfter - 12));
  });
});

describe('keep the lantern lit', () => {
  it('counts days in a row with any run, and pays the calendar once a day', () => {
    let f = lightDay(undefined, '2026-12-30');
    expect(f.lit).toMatchObject({ lit: true, streak: 1, calendar: 1, xp: CALENDAR_XP[0] });
    expect(lightDay(f.flame, '2026-12-30').lit.lit).toBe(false);
    f = lightDay(f.flame, '2026-12-31');
    f = lightDay(f.flame, '2027-01-01');
    expect(f.lit.streak).toBe(3);
  });

  it('earns an ember on the seventh day, spends it on one missed day, and never sets the calendar back', () => {
    let f = lightDay(undefined, '2026-12-01').flame;
    for (const day of ['2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07']) f = lightDay(f, day).flame;
    expect(f.ember).toBe(1);
    const saved = lightDay(f, '2026-12-09');
    expect(saved.lit).toMatchObject({ embered: true, streak: 8 });
    expect(saved.flame.ember).toBe(0);
    const out = lightDay(saved.flame, '2026-12-12');
    expect(out.lit.streak).toBe(1);
    expect(out.flame.days).toBe(9);
    expect(flameNow(out.flame, '2026-12-13').atRisk).toBe(true);
  });
});

describe('contracts', () => {
  const recent: RecentRun[] = [1, 2, 3].map((i) => ({ k: 'pinecrest', t: 130 + i, ss: [], s: { ghostsPassed: 4, perfects: 3, lights: 25, nearMisses: 4, dashes: 3, finished: true }, won: 1, tricks: 2, xp: 300 }));
  const run: ContractRun = { key: 'pinecrest', finished: true, time: 129, passes: 5, perfects: 3, setPieces: 1, tricks: 2, lights: 30, nearMisses: 4, dashes: 3, stageGolds: 0 };

  it('draws the same three for a day and a seed, one on the Daily and each within your form', () => {
    const a = drawContracts(DAY, 7, ['pinecrest', 'frostfang'], recent);
    expect(a).toEqual(drawContracts(DAY, 7, ['pinecrest', 'frostfang'], recent));
    expect(a).toHaveLength(3);
    expect(a[0].on).toBe('daily');
    // A run at about the recent median meets each of them.
    for (const c of a.slice(1)) expect(meets({ ...c, on: 'any' }, run), c.metric).toBe(true);
  });

  it('meets a form contract a recent run already met, and draws the next', () => {
    const form = drawForm(0, recent);
    expect(meets(form, run)).toBe(true);
    const o = settleContracts({ day: '', list: [], done: 0, form }, DAY, run, { seed: 1, open: ['pinecrest'], recent, daily: false });
    expect(o.formMet).not.toBeNull();
    expect(o.save.drawn).toBe(1);
    expect(o.save.form?.id).toBe('form:1');
  });
});

describe('the Cup league', () => {
  const pool = Array.from({ length: 40 }, (_, i) => ({ name: `R${i}`, score: 1, distance: FINISH_Z, ticks: 9000, finishTick: (110 + i * 4) * 60, sled: 0, mood: 0, event: 0, record: '' }));

  it('lays nineteen records a division, quickest at division 1', () => {
    expect(leagueField(pool, 1)).toHaveLength(LEAGUE_SIZE - 1);
    expect(leagueField(pool, 1)[0].time).toBeLessThan(leagueField(pool, DIVISIONS)[0].time);
  });

  it('promotes the top four, relegates the bottom four, and holds a week not ridden', () => {
    expect(nextDivision(3, 2)).toEqual({ div: 2, moved: -1 });
    expect(nextDivision(3, 18)).toEqual({ div: 4, moved: 1 });
    expect(nextDivision(3, null)).toEqual({ div: 3, moved: 0 });
    const s = settleLeague(undefined, '2026-W49', 100, pool).save;
    expect(s.place).toBe(1);
    expect(leagueNow(s, '2026-W50').div).toBe(4);
  });
});

describe('the Spirit Album', () => {
  const run: AlbumRun = { mountain: 'pinecrest', mirror: false, finished: true, time: 100, mood: Mood.Blizzard, legend: 1, moments: [], tricks: ['spin'], duelWon: null, charms: ['owl'], synergies: [], nightLegs: 2 };

  it('has one id a sticker, every one a mountain or a group', () => {
    const ids = albumCatalogue().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(albumCompletion(undefined).byMountain.lanternfall.of).toBeGreaterThan(10);
  });

  it('awards a sticker once', () => {
    const got = stickersFor(undefined, run);
    expect(got).toContain('m:pinecrest:1');
    expect(got).toContain('n:2');
    const a = awardStickers(undefined, got, 5, 'rec');
    expect(stickersFor(a, run)).toEqual([]);
    expect(a?.runs?.['5']).toBe('rec');
  });
});

describe('the next run', () => {
  const g = (kind: NextGoal['kind'], reachable: boolean, gap = 0.1): NextGoal => ({ kind, text: kind, short: '', reachable, gap, names: [kind] });

  it('picks one button: rematch, then a mission, a duel, the Daily, then Run Again with the nearest goal', () => {
    expect(primaryButton([g('page', true), g('rematch', true), g('mission', true)]).kind).toBe('rematch');
    expect(primaryButton([g('page', true), g('mission', true)]).kind).toBe('mission');
    expect(primaryButton([g('mission', true, 0.5), g('duel', true)]).kind).toBe('duel');
    expect(primaryButton([g('daily', true), g('page', true)]).kind).toBe('daily');
    const again = primaryButton([g('page', false), g('form', true)]);
    expect(again.kind).toBe('again');
    expect(again.goal?.kind).toBe('form');
  });

  it('always has a goal in reach once a run has set the form contract', () => {
    const d = save();
    settleSpine(d, spineRun());
    const goals = nextGoals(d, { key: 'pinecrest', mi: 0, day: DAY, board: null, lostTo: null, duelWon: false, dailyReady: false });
    expect(goals.some((x) => x.reachable)).toBe(true);
  });
});

describe('the long night and the mirrors', () => {
  it('rides ten whole mountains, chaos rising each leg', () => {
    expect(LEGS).toHaveLength(10);
    expect(legStep(0)).toBe(0);
    expect(legChaos(5, 0)).toMatchObject({ mood: Mood.None, event: ChaosEvent.None });
    expect(legChaos(5, 1).mood).not.toBe(Mood.None);
    expect(legChaos(5, 4).event).not.toBe(ChaosEvent.None);
    expect(settleLongNight({ legs: 2, z: 100 }, 2, 50).newBest).toBe(false);
    expect(settleLongNight({ legs: 2, z: 100 }, 3, 0).newBest).toBe(true);
    expect(mirrorSteer(1)).toBe(7);
  });
});

describe('the Lantern Row', () => {
  it('lights a row in order, for gifts, on an open mountain', () => {
    const d = save();
    d.gifts = 1000;
    const open = (m: string): boolean => m === 'pinecrest';
    expect(lightLantern(d, 'pinecrest:1', open)).toBe(false);
    expect(lightLantern(d, 'pinecrest:0', open)).toBe(true);
    expect(lightLantern(d, 'ember:0', open)).toBe(false);
    expect(litIn(d, 'pinecrest')).toBe(1);
    expect(d.gifts).toBe(850);
    expect(readLit(['pinecrest:0', 'pinecrest:2', 'nope'])).toEqual(['pinecrest:0']);
    expect(LANTERNS.reduce((a, l) => a + l.price, 0)).toBeGreaterThan(15000);
    expect(litByTown(d)).toMatchObject({ pinecrest: 1, ember: 0 });
    const row = lanternRow(d, open);
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({ town: 'Old Town', lit: 1, of: 8, next: { id: 'pinecrest:1', price: 225, affordable: true } });
    expect(row[0].lanterns.filter((l) => l.lit).map((l) => l.index)).toEqual([0]);
  });
});

describe('the first minute and the missions', () => {
  it('a first run\'s opener waits for a rider who slows, and never outrides its own record', () => {
    const k = openerOf(7);
    expect(k).toBe(6);
    // Ahead of you it eases off to wait (down to OPENER_MIN of its pace), and never rides past its own pace.
    let r = 1;
    for (let i = 0; i < 40; i++) r = openerRate(r, 0, true, 1, true);
    expect(r).toBeCloseTo(OPENER_MIN);
    // For a rider who is not in trouble it does not hang back.
    for (let i = 0; i < 40; i++) r = openerRate(r, 0, true, 1, false);
    expect(r).toBeCloseTo(OPENER_STEADY);
    for (let i = 0; i < 40; i++) r = openerRate(r, 3, true, 1);
    expect(r).toBe(1);
    // Once you are past it rides its own record's pace, a slow rider's included, and does not chase.
    for (let i = 0; i < 40; i++) r = openerRate(r, 3, false, 0.8);
    expect(r).toBe(0.8);
    expect(OPENER_LEAD).toBeGreaterThan(0);
  });

  it('waits for the third run before the first duel', () => {
    const open = (): boolean => true;
    const m = duelMountain(nextDuel(undefined, open)!);
    expect(duelOn(undefined, m, open, 0)).toBeNull();
    expect(duelOn(undefined, m, open, FIRST_DUEL_RUN)).not.toBeNull();
    expect(duelOn(undefined, m, open)).not.toBeNull();
  });

  it('offers a stuck mission as a swap after five runs without progress, once a day', () => {
    const s = newMissionState(3);
    const id = s.active[0].id;
    const nothing = sum({ distance: 0, perfects: 0, ghostsPassed: 0, lights: 0, finished: false, finishSeconds: 0, dashes: 0, nearMisses: 0, maxAirtime: 0, maxHalfTurns: 0, driftSeconds: 0, draftSeconds: 0, bestCombo: 0, score: 0, maxSpeed: 0 });
    for (let i = 0; i < SWAP_AFTER; i++) applyRun(s, nothing);
    expect(swappable(s, DAY)).toBe(id);
    expect(swapMission(s, id, DAY)).toBe(true);
    expect(s.active.some((a) => a.id === id)).toBe(false);
    expect(s.active).toHaveLength(3);
    expect(swappable(s, DAY)).toBeNull();
  });
});
