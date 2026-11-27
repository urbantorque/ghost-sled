import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADDED_HOURS, ALMANAC, homeRiders, hourOpen, mirrorOpen, owedRewards, xpToPage } from '../src/game/almanac';
import { albumCatalogue, albumCompletion, stickersFor, type AlbumRun } from '../src/game/album';
import { FLIGHT_DELAY_S, FLIGHT_PIECES, PIECE_DELAY_S, aimFor, type ShotCtx } from '../src/game/albumframes';
import { REEL_FIELD, TITLE_SHOTS, reelField } from '../src/game/keyart';
import { MISSIONS, unlockedBiomes, type RunSummary } from '../src/game/missions';
import { settleSpine, type SpineRun } from '../src/game/rank';
import { defaultSave, type SaveData } from '../src/game/save';
import { readAlbum, readRank } from '../src/game/spinesave';
import { FINISH_Z } from '../src/game/standing';
import { KING, TWELVE, duelMountain, nextDuel } from '../src/game/twelve';
import { cupSeed } from '../src/game/cup';
import { HOME_RIDERS, ROSTER } from '../src/bot/roster';
import { MOUNTAINS, biomeForSeed, courseBiomeForSeed, dailySeed } from '../src/sim/mountains';
import { recordFromString, replayRecord } from '../src/sim/replay';
import { withSlowRiders } from '../src/game/slowriders';
import type { SimEvent } from '../src/sim/sim';

// Round 9, the wiring lane (milestone 3's M3): the three new mountains wired where the five are. Each new mountain's
// other hour on an Almanac page that held only a charm or gifts, never given silently to a save already past it; its
// mirror opened by its three home riders beaten to the line, told on the run that does it; its album page with The
// Twelve's and its own riders' records; its title reel drawn from riders who ride its shot's line; and nothing of The
// Twelve, the Daily, the Cup or the missions reaching a new mountain where it should not.

const DAY = '2026-12-03';
const NEW = ['oldrun', 'gullhaven', 'gablefall'];

function sum(over: Partial<RunSummary> = {}): RunSummary {
  return { mountain: 'pinecrest', biome: 'alpine', score: 9000, distance: FINISH_Z, gifts: 30, lights: 30, dashes: 3, phased: 0, skyGates: 0, wards: 0, perfects: 3, maxAirtime: 1.4, maxHalfTurns: 2, flips: 0, driftSeconds: 4, draftSeconds: 3, nearMisses: 4, bestCombo: 2000, maxSpeed: 34, smashes: 0, gates: 0, yetiHop: false, outranAvalanche: false, ghostsPassed: 4, grudgeBeaten: false, chaos: false, seconds: 130, finished: true, finishSeconds: 130, tumbles: 0, wallRides: 0, grinds: 0, ...over };
}

function spineRun(over: Partial<SpineRun> = {}): SpineRun {
  return { key: 'pinecrest', mi: 0, mountainId: 'pinecrest', mirror: false, day: DAY, week: '2026-W49', sum: sum(), time: 130, stageSeconds: [42, 44, 44], beaten: 3, passed: 4, tricks: [], moments: [], showdownsWon: 0, charms: [], synergies: [], legend: 0, mood: 0, missions: [], rungs: 0, stageMedals: [], runMedal: 0, dayMedal: 0, stars: 0, duelWon: null, crowned: false, newBestTime: false, lostTo: null, board: null, open: ['pinecrest'], dailyReady: false, ...over };
}

/** A save at page `n`, every page claimed, past the xp that turns it by a little. */
function saveAt(n: number): SaveData {
  const d = defaultSave('Rider');
  d.runs = 40;
  d.rank = { xp: xpToPage(n) + 10, claimed: n };
  return d;
}

const hourOf = (o: { reward: { kind: string; mountain?: string } }): string | null => (o.reward.kind === 'hour' ? (o.reward.mountain ?? null) : null);

describe('the new mountains’ other hours on the Almanac', () => {
  it('sit on pages that held only a charm or gifts, each kept, between the five’s hours as each mountain opens between theirs', () => {
    expect(ADDED_HOURS).toEqual({ gablefall: 16, oldrun: 23, gullhaven: 29 });
    for (const [m, page] of Object.entries(ADDED_HOURS)) {
      const p = ALMANAC[page - 1];
      expect(p.rewards[0], m).toEqual({ kind: 'hour', mountain: m });
      // (Never an emptied page: the charm or the gifts it held are still on it, and nothing else.)
      expect(p.rewards.slice(1).map((r) => r.kind), m).toEqual([page === 23 ? 'gifts' : 'charm']);
    }
    // The five's as they were.
    const five = ALMANAC.flatMap((p) => p.rewards.filter((r) => r.kind === 'hour' && !NEW.includes(r.mountain)).map((r) => `${(r as { mountain: string }).mountain}@${p.n}`));
    expect(five).toEqual(['pinecrest@8', 'frostfang@12', 'ember@18', 'sakura@24', 'lanternfall@32']);
    // Each new mountain opens between two of the five (by ghosts passed), and its hour's page lies between theirs.
    const opens = (id: string): number => MOUNTAINS.find((m) => m.id === id)!.unlockGhosts;
    expect(opens('frostfang') < opens('gablefall') && opens('gablefall') < opens('ember')).toBe(true);
    expect(opens('ember') < opens('oldrun') && opens('oldrun') < opens('sakura')).toBe(true);
    expect(opens('sakura') < opens('gullhaven')).toBe(true);
    expect(12 < ADDED_HOURS.gablefall && ADDED_HOURS.gablefall < 18 && 18 < ADDED_HOURS.oldrun && ADDED_HOURS.oldrun < 24 && 24 < ADDED_HOURS.gullhaven && ADDED_HOURS.gullhaven < 32).toBe(true);
  });

  it('a save that turns the page gets the hour on that page’s card, open at once, and is never told it again', () => {
    const d = saveAt(15);
    d.rank!.xp = xpToPage(16) + 10;
    expect(hourOpen(d, 'gablefall')).toBe(false);
    const o = settleSpine(d, spineRun());
    expect(o.opened.filter((x) => hourOf(x) === 'gablefall')).toEqual([{ page: 16, reward: { kind: 'hour', mountain: 'gablefall' }, name: 'Gablefall at Evensong' }]);
    expect(hourOpen(d, 'gablefall')).toBe(true);
    expect(settleSpine(d, spineRun()).opened.some((x) => hourOf(x) === 'gablefall')).toBe(false);
  });

  it('a save already past the page is not given the hour silently: it is told once, on its next results, one a run', () => {
    // (mid-50 as the fixture holds it: 25 pages, so Gablefall's and the Old Run's are owed; mid-100's 35, all three.)
    const d = saveAt(25);
    expect(hourOpen(d, 'gablefall')).toBe(false);
    expect(hourOpen(d, 'oldrun')).toBe(false);
    const first = settleSpine(d, spineRun());
    expect(first.opened.filter((x) => x.reward.kind === 'hour')).toEqual([{ page: 16, from: 'New on Rider Rank 16', reward: { kind: 'hour', mountain: 'gablefall' }, name: 'Gablefall at Evensong' }]);
    expect(hourOpen(d, 'gablefall')).toBe(true);
    expect(hourOpen(d, 'oldrun')).toBe(false);
    const second = settleSpine(d, spineRun());
    expect(second.opened.filter((x) => x.reward.kind === 'hour').map((x) => [x.page, x.from, x.name])).toEqual([[23, 'New on Rider Rank 23', 'The Old Run by Lamplight']]);
    expect(hourOpen(d, 'oldrun')).toBe(true);
    // Gullhaven's page is not turned yet; nothing more is owed.
    expect(hourOpen(d, 'gullhaven')).toBe(false);
    expect(settleSpine(d, spineRun()).opened.some((x) => x.reward.kind === 'hour' && x.from)).toBe(false);
  });

  it('the five’s hours open with their pages, as before: a save past them owes nothing', () => {
    const d = saveAt(12);
    expect(hourOpen(d, 'pinecrest')).toBe(true);
    expect(hourOpen(d, 'frostfang')).toBe(true);
    expect(owedRewards(d)).toEqual([]);
  });

  it('a revive’s second settle tells it once, not twice', () => {
    const d = saveAt(25);
    const first = settleSpine(d, spineRun());
    const again = settleSpine(d, spineRun(), first.settlement);
    expect(again.opened.filter((x) => x.reward.kind === 'hour').map((x) => hourOf(x))).toEqual(['gablefall']);
    expect(d.rank?.told).toEqual(['hour:gablefall']);
  });

  it('what was told is kept through a save’s reader, and what is not a told reward is dropped', () => {
    expect(readRank({ xp: 40000, claimed: 25, told: ['hour:gablefall', 'hour:gablefall', 'mirror:oldrun', 'gift:5', 7, 'hour:Bad'] })).toEqual({ xp: 40000, claimed: 25, told: ['hour:gablefall', 'mirror:oldrun'] });
    expect(readRank({ xp: 40000, claimed: 25 })).toEqual({ xp: 40000, claimed: 25 });
  });
});

describe('the new mountains’ mirrors', () => {
  const riders = (id: string): string[] => HOME_RIDERS.filter((r) => r.home === MOUNTAINS.findIndex((m) => m.id === id)).map((r) => r.key);

  it('each has three home riders, none of them one of The Twelve, and the five have none', () => {
    for (const id of NEW) expect(riders(id), id).toHaveLength(3);
    for (const m of MOUNTAINS.slice(0, 5)) expect(homeRiders(defaultSave('R'), m.id)).toBeNull();
    // (By name: Gablefall's Wren Slater has the key of The Twelve's Old Wren, 'wren'. Keys are kept per mountain, as a
    // board keeps its riders, and the album marks a home rider's sticker as one: rv:gablefall:wren.home.)
    for (const r of HOME_RIDERS) expect(ROSTER.some((t) => t.name === r.name)).toBe(false);
  });

  it('opens once all three home riders are beaten to the line, told on the run that does it, once', () => {
    for (const id of NEW) {
      const d = saveAt(5);
      const [a, b, c] = riders(id);
      d.mastery = { [id]: { gates: [], moments: [], riders: [a, b], clean: false } };
      expect(homeRiders(d, id)).toEqual({ beaten: 2, of: 3 });
      expect(mirrorOpen(d, id)).toBe(false);
      expect(settleSpine(d, spineRun()).opened.some((x) => x.reward.kind === 'mirror')).toBe(false);
      d.mastery[id].riders.push(c);
      const o = settleSpine(d, spineRun());
      const name = MOUNTAINS.find((m) => m.id === id)!.name;
      expect(o.opened.filter((x) => x.reward.kind === 'mirror'), id).toEqual([{ page: 0, from: `${name}'s riders beaten`, reward: { kind: 'mirror', mountain: id }, name: `Mirror ${name}` }]);
      expect(mirrorOpen(d, id)).toBe(true);
      expect(settleSpine(d, spineRun()).opened.some((x) => x.reward.kind === 'mirror')).toBe(false);
    }
  });

  it('the five’s mirrors open as before: on their pages, or with every one of The Twelve at home beaten in a duel', () => {
    const d = saveAt(8);
    expect(mirrorOpen(d, 'pinecrest')).toBe(false);
    d.rank = { xp: xpToPage(9) + 10, claimed: 9 };
    expect(mirrorOpen(d, 'pinecrest')).toBe(true);
    const e = saveAt(1);
    const home = ROSTER.filter((r) => r.home === 1).map((r) => r.key);
    e.twelve = { beaten: home };
    expect(mirrorOpen(e, 'frostfang')).toBe(true);
    // A told mirror never opens one of the five's: nothing writes one, and a save's reader keeps only the shape.
    for (const id of NEW) expect(mirrorOpen(e, id)).toBe(false);
  });
});

describe('the album’s new pages', () => {
  it('holds 311 stickers (212 for the five and the rest, 266 as the three registered): each new page 33, as a page of the five is laid', () => {
    const all = albumCatalogue();
    expect(all).toHaveLength(311);
    expect(all.filter((s) => !NEW.includes(s.mountain))).toHaveLength(212);
    const c = albumCompletion(undefined).byMountain;
    for (const id of NEW) {
      expect(c[id].of, id).toBe(33);
      const page = all.filter((s) => s.mountain === id);
      expect(page.filter((s) => s.group === 'variant')).toHaveLength(9);
      expect(page.filter((s) => s.group === 'legend')).toHaveLength(2);
      expect(page.filter((s) => s.group === 'mood')).toHaveLength(6);
      // The Twelve's records there, then its own three riders'.
      expect(page.filter((s) => s.group === 'rival').map((s) => s.id.split(':')[2])).toEqual([...ROSTER.map((r) => r.key), ...riders(id).map((k) => `${k}.home`)]);
      expect(page.find((s) => s.group === 'mirror')?.hint).toMatch(/beating its 3 riders to the line opens it/);
    }
    for (const m of MOUNTAINS.slice(0, 5)) expect(all.find((s) => s.id === `x:${m.id}`)?.hint).toMatch(/an Almanac page opens it/);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
  });

  const riders = (id: string): string[] => HOME_RIDERS.filter((r) => r.home === MOUNTAINS.findIndex((m) => m.id === id)).map((r) => r.key);

  it('a run that beats a home rider’s record there earns their sticker, and a save keeps every sticker it holds', () => {
    const run: AlbumRun = { mountain: 'gablefall', mirror: false, finished: true, time: 60, mood: 0, legend: 0, moments: [], tricks: [], duelWon: null, charms: [], synergies: [] };
    const got = stickersFor(undefined, run);
    for (const k of riders('gablefall')) expect(got).toContain(`rv:gablefall:${k}.home`);
    expect(got.filter((id) => id.startsWith('rv:oldrun'))).toEqual([]);
    // (An id the catalogue does not list is kept as it was: the reader knows shapes, not the catalogue.)
    const kept = readAlbum({ got: { 'rv:gablefall:wren.home': 3, 'v:pinecrest:firstdrop:0': 1, 'rv:pinecrest:old': 2 } }, (id) => /^(v|l|m|t|rv|c|s|x|n|w):[A-Za-z0-9:._-]+$/.test(id));
    expect(Object.keys(kept?.got ?? {}).sort()).toEqual(['rv:gablefall:wren.home', 'rv:pinecrest:old', 'v:pinecrest:firstdrop:0']);
  });

  it('the Great Geo’s frame is taken out in its flight, not on the shelf before its lip; every other piece as before', () => {
    expect(FLIGHT_PIECES).toEqual(new Set(['greatgeo']));
    const ctx = (key: string): ShotCtx => ({ mountain: 'gullhaven', held: () => false, play: () => ({ key, variant: 1 }), trick: () => null, charm: () => null, synergy: () => null });
    const ev = (phase: string, n: number, of: number): SimEvent => ({ type: 'moment', index: 0, phase, n, of }) as unknown as SimEvent;
    expect(aimFor(ev('start', 0, 1), ctx('greatgeo'))).toEqual({ ids: ['v:gullhaven:greatgeo:1'], delay: PIECE_DELAY_S });
    expect(aimFor(ev('step', 0, 1), ctx('greatgeo'))).toEqual({ ids: ['v:gullhaven:greatgeo:1'], delay: FLIGHT_DELAY_S });
    expect(aimFor(ev('step', 1, 1), ctx('greatgeo'))).toBeNull();
    expect(aimFor(ev('step', 3, 3), ctx('lighthouse'))).toEqual({ ids: ['v:gullhaven:lighthouse:1'], delay: 0 });
    expect(aimFor(ev('step', 0, 3), ctx('lighthouse'))).toBeNull();
  });
});

describe('the title reel on the new mountains', () => {
  // (The pool as the app holds it, app.ts poolFor: the bundled riders and the slow riders made to fill its slow end.)
  const pool = (id: string): Array<{ name: string; record: string }> => withSlowRiders(JSON.parse(readFileSync(join(process.cwd(), 'src', 'data', 'ghosts', `${id}.json`), 'utf8')).ghosts, id);

  it('draws the five’s riders from mid-pool as before, and never The Hollow King before his duel', () => {
    for (const m of MOUNTAINS) {
      const names = pool(m.id).map((g) => g.name);
      const field = reelField(names, m.id, [KING.name]);
      expect(field.map((i) => names[i]), m.id).not.toContain(KING.name);
      // (No field meets him in today's pools: every reel is the same with the rule or without it.)
      expect(reelField(names, m.id), m.id).toEqual(field);
      if (!NEW.includes(m.id)) expect(field, m.id).toEqual(REEL_FIELD.map((f) => Math.floor(names.length * f)));
    }
    // Where he stands on a pick, the next rider up the pool rides in his place.
    const names = Array.from({ length: 50 }, (_, i) => (i === 30 ? KING.name : `rider ${i}`));
    expect(reelField(names, 'pinecrest', [KING.name])).toEqual([31, 36, 42]);
    expect(reelField(names, 'pinecrest')).toEqual([30, 36, 42]);
    expect(reelField([], 'pinecrest')).toEqual([0, 0, 0]);
  });

  it('on Gablefall rides the roofs through the shot it is composed for: each rider on them 90% of the stretch or more', () => {
    const shot = TITLE_SHOTS.gablefall;
    const ghosts = pool('gablefall');
    const field = reelField(ghosts.map((x) => x.name), 'gablefall', [KING.name]);
    expect(new Set(field).size).toBe(3);
    for (const i of field) {
      let n = 0;
      let roof = 0;
      replayRecord(recordFromString(ghosts[i].record)!, (sim) => {
        const s = sim.s;
        if (s.z < shot.from || s.z > shot.to || s.finished) return;
        n++;
        const c = sim.course;
        const gy = c.ground(s.x, s.z);
        if (c.streetAt(s.z) !== null && s.tumble === 0 && gy - c.baseY(s.z) >= 1.5 && s.y >= gy - 0.05) roof++;
      });
      expect(roof / n, ghosts[i].name).toBeGreaterThanOrEqual(0.9);
    }
  });
});

describe('nothing reaches a new mountain where it should not', () => {
  it('The Twelve stay twelve, every one at home on the five, so no duel is ever ridden on a new mountain', () => {
    expect(TWELVE).toHaveLength(12);
    for (const r of TWELVE) expect(r.home, r.name).toBeLessThan(5);
    // With every mountain open, the ladder walks the five's ground only.
    const seen = new Set<string>();
    const t = { beaten: [] as string[] };
    for (let k = 0; k < 12; k++) {
      const next = nextDuel(t, () => true);
      if (!next) break;
      seen.add(MOUNTAINS[duelMountain(next)].id);
      if (next.kind !== 'duel') break;
      t.beaten.push(next.rider.key);
    }
    for (const id of NEW) expect(seen.has(id)).toBe(false);
  });

  it('no Daily and no Cup to 2040 is built as a new mountain: they stay the four', () => {
    const four = new Set(['alpine', 'glacier', 'volcanic', 'blossom']);
    for (let yr = 2026; yr <= 2040; yr++) {
      for (let day = 0; day < 365; day += 3) {
        const key = new Date(Date.UTC(yr, 0, 1 + day)).toISOString().slice(0, 10);
        expect(four.has(courseBiomeForSeed(dailySeed(key))), key).toBe(true);
      }
      for (let w = 1; w <= 52; w += 3) expect(four.has(courseBiomeForSeed(cupSeed(`${yr}-W${String(w).padStart(2, '0')}`)))).toBe(true);
    }
  });

  it('no mission names a new mountain or its look, and a new mountain’s look counts for one only once it is open', () => {
    const looks = new Set<string>(NEW.map((id) => biomeForSeed(MOUNTAINS.find((m) => m.id === id)!.seed)));
    for (const m of MISSIONS) {
      if (m.biome) expect(looks.has(m.biome), m.id).toBe(false);
      for (const id of NEW) expect(m.text.includes(MOUNTAINS.find((x) => x.id === id)!.name), m.id).toBe(false);
    }
    const gable = biomeForSeed(MOUNTAINS.find((m) => m.id === 'gablefall')!.seed);
    expect(unlockedBiomes(7).has(gable)).toBe(false);
    expect(unlockedBiomes(8).has(gable)).toBe(true);
  });
});
