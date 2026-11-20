import { describe, expect, it } from 'vitest';
import { xpToPage } from '../src/game/almanac';
import { CONTRACT_REFILLS, type ContractRun, settleContracts } from '../src/game/contracts';
import { FIRST_RUN_PACE, pickField, poolTime } from '../src/game/field';
import { HINT_RUN_SHOWS, HintCoach, STOMP_RUN_SHOWS, type HintFrame } from '../src/game/hints';
import { boardOf, settleClimb } from '../src/game/ladder';
import { emptyMastery, settleMastery } from '../src/game/mastery';
import { XP, settleSpine, xpTicks, type SpineRun } from '../src/game/rank';
import { defaultSave } from '../src/game/save';
import { settleRun } from '../src/game/settle';
import { FINISH_Z } from '../src/game/standing';
import { KING, withheldRiders } from '../src/game/twelve';
import type { RunSummary } from '../src/game/missions';
import type { PoolGhostData } from '../src/game/ghostdata';
import { courseFor } from '../src/sim/course';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { MOUNTAINS } from '../src/sim/mountains';
import { SIM_VERSION } from '../src/sim/sim';
import pinecrest from '../src/data/ghosts/pinecrest.json';

// Round 8, phase 3: the first hour's shape. The rewards paced (the ladder places you on a first ride and pays for
// climbing, stage medals and the mastery board open a step a ride, one Almanac page a run), the day's contracts
// refill, a duel won worth clearly more than one lost, the Daily's best time kept for its medal, The Hollow King
// held back for his duel, a first run's field laid round its steady time, and the hints capped a run.

const POOL = (pinecrest as { ghosts: PoolGhostData[] }).ghosts;
const DAY = '2026-12-03';

function sum(p: Partial<RunSummary> = {}): RunSummary {
  return { mountain: 'pinecrest', biome: 'alpine', score: 9000, distance: FINISH_Z, gifts: 30, lights: 30, dashes: 3, phased: 0, skyGates: 0, wards: 0, perfects: 3, maxAirtime: 1.4, maxHalfTurns: 2, flips: 0, driftSeconds: 4, draftSeconds: 3, nearMisses: 4, bestCombo: 2000, maxSpeed: 34, smashes: 0, gates: 0, yetiHop: false, outranAvalanche: false, ghostsPassed: 4, grudgeBeaten: false, chaos: false, seconds: 130, finished: true, finishSeconds: 130, tumbles: 0, wallRides: 0, grinds: 0, ...p };
}

describe('the rewards paced', () => {
  const board = boardOf(POOL);
  const quick = { time: 115, distance: FINISH_Z };
  const ticks = [38, 77, 115].map((s) => s * 60);

  it('places you on the ladder on a first ride without paying the rungs, and opens the stage medals on the second', () => {
    const d = defaultSave('Rider');
    const first = settleClimb(d, 'pinecrest', board, SIM_VERSION, null, { standing: quick, best: quick, bestBefore: null, ticks, rides: 1 });
    expect(first.beaten).toEqual([]);
    expect(first.stageMedals).toEqual([0, 0, 0]);
    expect(first.rankWas).toBe(first.spot.rank);
    const second = settleClimb(d, 'pinecrest', board, SIM_VERSION, d.climb?.pinecrest ?? null, { standing: quick, best: quick, bestBefore: quick, ticks, rides: 2 });
    expect(second.stageMedals.some((m) => m > 0)).toBe(true);
    // Before round 8 (no `rides`), the first ride paid every rung from the bottom.
    const old = settleClimb(defaultSave('Old'), 'pinecrest', board, SIM_VERSION, null, { standing: quick, best: quick, bestBefore: null, ticks });
    expect(old.credit).toBeGreaterThan(first.credit);
  });

  it('opens the mastery board a row a ride: sky gates from the second', () => {
    const course = courseFor(MOUNTAINS[0].seed);
    const gate = course.stageGates[0].id;
    const run = { gates: [gate], moments: [], time: null, riderTimes: new Map(), clean: false };
    const rec = emptyMastery();
    expect(settleMastery(course, 'pinecrest', rec, run, 0, 0, 1)).toEqual([]);
    expect(settleMastery(course, 'pinecrest', rec, run, 0, 0, 2)).toHaveLength(1);
  });

  it('opens one Almanac page a run, however many a big run turns', () => {
    const d = defaultSave('Rider');
    d.runs = 1;
    d.rank = { xp: xpToPage(4), claimed: 0 };
    const o = settleSpine(d, spine({ missions: [1, 1, 1], stars: 6 }));
    expect(o.pageAfter).toBeGreaterThanOrEqual(4);
    expect(d.rank.claimed).toBe(1);
  });
});

function spine(p: Partial<SpineRun> = {}): SpineRun {
  return { key: 'pinecrest', mi: 0, mountainId: 'pinecrest', mirror: false, day: DAY, week: '2026-W49', sum: sum(), time: 130, stageSeconds: [42, 44, 44], beaten: 3, passed: 4, tricks: [], moments: [], showdownsWon: 0, charms: [], synergies: [], legend: 0, mood: 0, missions: [], rungs: 0, stageMedals: [], runMedal: 0, dayMedal: 0, stars: 0, duelWon: null, crowned: false, newBestTime: false, lostTo: null, board: null, open: ['pinecrest'], dailyReady: false, ...p };
}

describe('the day refills, a duel won counts, the Daily keeps its time', () => {
  const run: ContractRun = { key: 'pinecrest', finished: true, time: 120, passes: 9, perfects: 9, setPieces: 3, tricks: 5, lights: 60, nearMisses: 9, dashes: 9, stageGolds: 0 };

  it('refills a contract met with a new one on that mountain, three times a day, and pays the bonus for three', () => {
    let s = settleContracts(undefined, DAY, run, { seed: 4, open: ['pinecrest', 'frostfang'], recent: [], daily: true }).save;
    const metFirst = s.met ?? 0;
    expect(metFirst).toBeGreaterThan(0);
    expect(s.refills).toBe(Math.min(CONTRACT_REFILLS, metFirst));
    for (const c of s.list.filter((_, i) => !(s.done & (1 << i)))) if (c.id.includes(':r')) expect(c.on).toBe('pinecrest');
    for (let k = 0; k < 4; k++) s = settleContracts(s, DAY, run, { seed: 4, open: ['pinecrest', 'frostfang'], recent: [], daily: true }).save;
    expect(s.refills).toBe(CONTRACT_REFILLS);
    expect(s.bonus).toBe(true);
  });

  it('pays a duel won clearly more than a duel lost, and the loss something', () => {
    const won = xpTicks(spine({ duelWon: 'bram' }), { variants: 0, charms: 0 }).find((t) => t.source === 'duel')!.xp;
    const lost = xpTicks(spine({ duelLost: true }), { variants: 0, charms: 0 }).find((t) => t.source === 'duel')!.xp;
    expect(won).toBe(XP.duel);
    expect(lost).toBe(XP.duelLost);
    expect(won).toBeGreaterThanOrEqual(5 * lost);
  });

  it("keeps the Daily's best time of the day, what its medal is won on", () => {
    const d = defaultSave('Rider');
    const t: [number, number, number] = [160, 150, 140];
    settleRun(d, sum({ finishSeconds: 155 }), null, `daily:${DAY}`, t);
    settleRun(d, sum({ finishSeconds: 145 }), null, `daily:${DAY}`, t);
    settleRun(d, sum({ finishSeconds: 150 }), null, `daily:${DAY}`, t);
    expect(d.daily.time).toBe(145);
    expect(d.daily.medal).toBe(2);
  });
});

describe('the race has a floor', () => {
  it('holds The Hollow King back from every field until his duel', () => {
    expect(withheldRiders(undefined)).toEqual([KING.name]);
    const base = { pool: POOL, kind: 'pool' as const, mood: Mood.None, event: ChaosEvent.None, count: 9, anchor: 120, seed: 3, bestScore: 0, you: null, grudge: null, friend: null };
    for (let seed = 0; seed < 20; seed++) expect(pickField({ ...base, seed, withheld: [KING.name] }).some((p) => p.name === KING.name)).toBe(false);
  });

  it("lays a first run's field round the mountain's steady time: three quicker, two slower", () => {
    const steady = FIRST_RUN_PACE.pinecrest;
    const picks = pickField({ pool: POOL, kind: 'pool', mood: Mood.None, event: ChaosEvent.None, count: 5, anchor: 0, seed: 7, bestScore: 0, you: null, grudge: null, friend: null, key: 'pinecrest' });
    const times = picks.map((p) => p.time ?? poolTime(POOL.find((g) => g.record === p.record)!));
    expect(times.filter((t) => t < steady).length).toBe(3);
    expect(times.filter((t) => t > steady).length).toBe(2);
    expect(picks.every((p) => p.reads)).toBe(true);
  });
});

describe('a quiet first run', () => {
  it('shows each lesson a few times a run at most: the stomp cue six, the rest three', () => {
    const coach = new HintCoach();
    const shows: Record<string, number> = {};
    const frame = (air: boolean, t: number): HintFrame => ({ dt: 1 / 60, timer: t, steered: true, grounded: !air, drifting: false, action: !air, drafting: false, airTicks: air ? 30 : 0, ttl: air ? 0.8 : Infinity, runs: 0, z: 1000 + t * 30, kickerAhead: false, heldLip: false, draftTarget: false, chased: false, lit: false, dashed: false });
    // A hundred flights with no perfect landing, the button held between them (the pop lesson), all ignored.
    let t = 0;
    for (let k = 0; k < 100; k++) {
      for (let i = 0; i < 60; i++, t += 1 / 60) {
        const s = coach.step(frame(i < 40, t), { steer: 1 }, {});
        if (s.show) shows[s.show] = (shows[s.show] ?? 0) + 1;
      }
    }
    expect(shows.stomp).toBeLessThanOrEqual(STOMP_RUN_SHOWS);
    for (const [k, n] of Object.entries(shows)) if (k !== 'stomp') expect(n, k).toBeLessThanOrEqual(HINT_RUN_SHOWS);
  });
});
