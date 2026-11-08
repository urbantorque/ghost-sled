import { describe, expect, it } from 'vitest';
import type { PoolGhostData } from '../src/game/ghostdata';
import { type Board, RUNG_GIFTS, RUN_GIFTS, STAGES, STAGE_GIFTS, TOP_GIFTS, bestStanding, boardOf, climbMoment, decidedLine, goldHook, laps, medalsHeld, nextLine, rankLine, rungHook, settleClimb, spotOn, stageMedal, stageSeconds, stageThresholds } from '../src/game/ladder';
import { type Climb, type SaveData, defaultSave } from '../src/game/save';
import { MOUNTAINS } from '../src/sim/mountains';
import { SIM_VERSION } from '../src/sim/sim';

// The ladder, the stage medals and what each pays. Rank comes from your best finish; a rider who has
// not finished sits below every finisher; everything pays once, however often a run settles.

const FINISH = 4500;

function ghost(name: string, seconds: number | null, distance = FINISH + 100, stageTicks?: number[]): PoolGhostData {
  return { name, score: 1000, distance, ticks: 9000, finishTick: seconds === null ? -1 : seconds * 60, sled: 0, mood: 0, event: 0, record: `rec-${name}`, ...(stageTicks ? { stageTicks } : {}) };
}

/** A pool of five finishers over two riders who crashed, in no order. */
const POOL = [ghost('Mila', 140), ghost('Tess', 120), ghost('Wreck', null, 3000), ghost('Rook', 130), ghost('Ansel', 150), ghost('Early', null, 1500), ghost('Nico', 110)];
const board = boardOf(POOL);
const finished = (time: number) => ({ time, distance: FINISH + 80 });
const fell = (distance: number) => ({ time: null, distance });

describe('the ladder', () => {
  it('ranks the pool in race order: finishers by time, then the rest by distance', () => {
    expect(board.riders.map((r) => r.name)).toEqual(['Nico', 'Tess', 'Rook', 'Mila', 'Ansel', 'Wreck', 'Early']);
  });

  it('ranks you from your best finish, among the riders and counting you', () => {
    const s = spotOn(board, finished(125));
    expect(s.rank).toBe(3);
    expect(s.of).toBe(8);
    expect(s.next?.name).toBe('Tess');
    expect(s.top).toBe(false);
    expect(rankLine(s)).toBe('Rank 3 of 8');
  });

  it('sits a rider who has not finished below every finisher, however far they went', () => {
    const s = spotOn(board, fell(4499));
    expect(s.rank).toBe(6);
    expect(s.next?.name).toBe('Ansel');
    expect(spotOn(board, fell(2000)).rank).toBe(7);
    expect(spotOn(board, fell(900)).rank).toBe(8);
  });

  it('gives a dead heat to no one: a tied rider is level, not ahead', () => {
    expect(spotOn(board, finished(130)).rank).toBe(3);
    expect(spotOn(board, finished(130)).next?.name).toBe('Tess');
  });

  it('has the top when nobody is ahead, and nobody to name', () => {
    const s = spotOn(board, finished(109));
    expect(s).toMatchObject({ rank: 1, top: true, next: null });
    expect(nextLine(s, finished(109))).toBeNull();
  });

  it('has no rank with no run, and names the bottom rung', () => {
    const s = spotOn(board, null);
    expect(s.rank).toBeNull();
    expect(rankLine(s)).toBeNull();
    expect(s.next?.name).toBe('Early');
    expect(nextLine(s, null)).toBe('Next: Early, 1,500 m');
  });

  it('says the next name, the time to beat and the gap, as the rows read them', () => {
    expect(nextLine(spotOn(board, finished(121.6)), finished(121.6))).toBe('Next: Tess, 2:00.0, 1.6 s up');
    expect(nextLine(spotOn(board, fell(1200)), fell(1200))).toBe('Next: Early, 1,500 m, 300 m up');
  });

  it('never prints a gap across units: a time and a distance share none', () => {
    expect(nextLine(spotOn(board, fell(4499)), fell(4499))).toBe('Next: Ansel, 2:30.0');
  });

  it('copes with an empty pool', () => {
    const s = spotOn(boardOf([]), finished(100));
    expect(s).toMatchObject({ rank: null, of: 1, next: null, top: false });
    expect(nextLine(s, finished(100))).toBeNull();
  });
});

describe('every bundled pool', () => {
  const pools = import.meta.glob('../src/data/ghosts/*.json', { eager: true, import: 'default' }) as Record<string, { mountain: string; ghosts: PoolGhostData[] }>;

  for (const m of MOUNTAINS) {
    const pool = Object.entries(pools).find(([p]) => p.endsWith(`/${m.id}.json`))![1].ghosts;

    it(`${m.id} carries stage splits that agree with its finishes`, () => {
      for (const g of pool) {
        expect(g.stageTicks, g.name).toBeDefined();
        const t = g.stageTicks!;
        for (let i = 1; i < t.length; i++) expect(t[i], g.name).toBeGreaterThan(t[i - 1]);
        if (g.finishTick !== undefined && g.finishTick > 0) {
          expect(t.length, g.name).toBe(STAGES);
          expect(t[STAGES - 1], g.name).toBe(g.finishTick);
        } else expect(t.length, g.name).toBeLessThan(STAGES);
      }
    });

    it(`${m.id} has three reachable medals on every stage, gold under the whole run's pace`, () => {
      const b = boardOf(pool);
      expect(b.riders.length).toBe(pool.length);
      expect(b.stages.length).toBe(STAGES);
      for (const t of b.stages) {
        expect(t).not.toBeNull();
        const [bronze, silver, gold] = t!;
        expect(bronze).toBeGreaterThan(silver);
        expect(silver).toBeGreaterThan(gold);
        // Gold is a time real riders set: the quickest in the pool beat it.
        expect(gold).toBeGreaterThan(30);
      }
      // A stage gold comes before a whole-run bronze: three of them add up slower than its time.
      const golds = b.stages.reduce((s, t) => s + t![2], 0);
      expect(golds).toBeLessThan(b.run![0] + 10);
    });
  }
});

describe('stage medals', () => {
  it('reads each stage in its own time', () => {
    expect(stageSeconds([600, 1320, 1980])).toEqual([10, 12, 11]);
    expect(laps([54.2, 111.6])).toEqual([54.2, 111.6 - 54.2]);
    expect(stageSeconds([])).toEqual([]);
  });

  it('sets bronze off the slowest rider, silver and gold off the pool', () => {
    expect(stageThresholds([40, 42, 44, 46, 50])).toEqual([62.5, 47.6, 44]);
  });

  it('keeps medals a second apart in a pool of ties, and has none with no times', () => {
    const t = stageThresholds([44, 44, 44])!;
    expect(t[0] - t[1]).toBeGreaterThanOrEqual(1);
    expect(t[1] - t[2]).toBeGreaterThanOrEqual(1);
    expect(stageThresholds([])).toBeNull();
    expect(stageThresholds([Number.NaN, -1])).toBeNull();
  });

  it('grades a time as its clock reads, so a line and a card agree', () => {
    const t: [number, number, number] = [55, 50, 46.1];
    expect(stageMedal(46.14, t)).toBe(3);
    expect(stageMedal(46.2, t)).toBe(2);
    expect(stageMedal(50, t)).toBe(2);
    expect(stageMedal(54.9, t)).toBe(1);
    expect(stageMedal(55.2, t)).toBe(0);
    expect(stageMedal(40, null)).toBe(0);
  });

  it('leaves a pool with no splits with no stage medals, and its whole-run medal', () => {
    expect(board.stages).toEqual([null, null, null]);
    expect(board.run).not.toBeNull();
  });
});

const STAGE_T: [number, number, number] = [60, 50, 40];
/** A board with medal times on every stage, and the whole run. */
const medalBoard: Board = { riders: board.riders, stages: [STAGE_T, STAGE_T, STAGE_T], run: [160, 130, 115] };

/** Ticks at the lines for stages of these lengths in seconds. */
function ticks(...stages: number[]): number[] {
  let t = 0;
  return stages.map((s) => (t += s * 60));
}

function save(): SaveData {
  return defaultSave('Nico');
}

/** One run, its best taken from a finish time or a wreck, against the board. */
function settle(d: SaveData, atStart: Climb | null, standing: { time: number | null; distance: number }, line: number[], best = standing, bestBefore: { time: number | null; distance: number } | null = null) {
  return settleClimb(d, 'pinecrest', medalBoard, SIM_VERSION, atStart, { standing, best, bestBefore, ticks: line });
}

describe('settling a climb', () => {
  it('pays each rung climbed, names who was beaten, and records the rung', () => {
    const d = save();
    const o = settle(d, null, finished(125), ticks(45, 45, 35));
    expect(o.spot.rank).toBe(3);
    expect(o.beaten).toEqual(['Rook', 'Mila', 'Ansel', 'Wreck', 'Early']);
    expect(d.climb!.pinecrest.rung).toBe(3);
    expect(d.climb!.pinecrest.v).toBe(SIM_VERSION);
  });

  it('pays a medal and the tiers under it once, on stage and whole run', () => {
    const d = save();
    const o = settle(d, null, finished(125), ticks(45, 45, 35));
    const rungs = 5 * RUNG_GIFTS;
    const stage = (m: number): number => (STAGE_GIFTS as readonly number[]).slice(0, m + 1).reduce((a, b) => a + b, 0);
    expect(o.stageMedals).toEqual([2, 2, 3]);
    expect(o.runMedal).toBe(2);
    expect(o.credit).toBe(rungs + stage(2) + stage(2) + stage(3) + RUN_GIFTS[1] + RUN_GIFTS[2]);
    expect(d.gifts).toBe(o.credit);
    expect(d.lifetimeGifts).toBe(o.credit);
    expect(o.fresh).toEqual([0, 1, 2, 3]);
  });

  it('credits nothing the second time: the coast, or a revive that gets no further', () => {
    const d = save();
    const first = settle(d, null, finished(125), ticks(45, 45, 35));
    const again = settle(d, null, finished(125), ticks(45, 45, 35));
    expect(again.credit).toBe(0);
    expect(d.gifts).toBe(first.credit);
    // The card still says what the run earned.
    expect(again.gifts).toBe(first.gifts);
    expect(again.beaten).toEqual(first.beaten);
  });

  it('pays only the difference when a revive goes further', () => {
    const d = save();
    const first = settle(d, null, fell(2000), ticks(45), fell(2000));
    expect(first.spot.rank).toBe(7);
    expect(first.stageMedals).toEqual([2]);
    const second = settle(d, null, finished(125), ticks(45, 45, 35));
    expect(second.credit).toBeGreaterThan(0);
    expect(d.gifts).toBe(first.credit + second.credit);
    expect(second.gifts).toBe(d.gifts);
  });

  it('never takes a medal back for a worse run, and a worse run pays nothing', () => {
    const d = save();
    settle(d, null, finished(125), ticks(45, 45, 35));
    const held = JSON.stringify(d.climb!.pinecrest);
    const at = JSON.parse(held) as Climb;
    const o = settle(d, at, finished(170), ticks(70, 70, 30), finished(125), finished(125));
    expect(o.credit).toBe(0);
    expect(o.fresh).toEqual([]);
    expect(o.beaten).toEqual([]);
    expect(JSON.stringify(d.climb!.pinecrest)).toBe(held);
  });

  it('counts a wreck: a stage gold on a run that never finished', () => {
    const d = save();
    const o = settle(d, null, fell(1800), ticks(39), fell(1800));
    expect(o.stageMedals).toEqual([3]);
    expect(o.runMedal).toBe(0);
    expect(medalsHeld(d.climb!.pinecrest)).toEqual({ stages: [3, 0, 0], run: 0 });
    expect(climbMoment(o, 'Pinecrest', medalsHeld(d.climb!.pinecrest))).toBe('Beat Early. Gold on Stage 1.');
  });

  it('pays the top of the ladder once, and says so', () => {
    const d = save();
    const o = settle(d, null, finished(105), ticks(38, 38, 29));
    expect(o.topNow).toBe(true);
    expect(d.climb!.pinecrest.top).toBe(true);
    expect(o.credit).toBeGreaterThanOrEqual(TOP_GIFTS + 7 * RUNG_GIFTS);
    expect(climbMoment(o, 'Pinecrest', medalsHeld(d.climb!.pinecrest))).toBe('Top of the Pinecrest ladder. All 7 riders beaten.');
    const held = JSON.parse(JSON.stringify(d.climb!.pinecrest)) as Climb;
    const later = settle(d, held, finished(104), ticks(38, 38, 28));
    expect(later.topNow).toBe(false);
    expect(later.credit).toBe(0);
    expect(climbMoment(later, 'Pinecrest', medalsHeld(d.climb!.pinecrest))).toBeNull();
  });

  it('claims nothing an old save already held: no rung paid, nobody "beaten"', () => {
    // A save from before ladders: a best, and no Climb. This run is slower and beats nobody.
    const d = save();
    const o = settle(d, null, finished(170), [], finished(125), finished(125));
    expect(o.spot.rank).toBe(3);
    expect(o.beaten).toEqual([]);
    expect(o.credit).toBe(0);
    expect(climbMoment(o, 'Pinecrest', medalsHeld(null))).toBeNull();
  });

  it('claims no top an old save already held', () => {
    const d = save();
    const o = settle(d, null, finished(170), [], finished(105), finished(105));
    expect(o.topNow).toBe(false);
    expect(o.credit).toBe(0);
  });

  it('leaves the save untouched by a run that earned nothing', () => {
    const d = save();
    settle(d, null, fell(50), [], fell(50), fell(60));
    expect(d.climb).toBeUndefined();
    expect(d.gifts).toBe(0);
  });
});

describe('the lines', () => {
  it('reads a climb as a name, and only names one', () => {
    const d = save();
    const o = settle(d, null, finished(141), []);
    expect(o.beaten.length).toBeGreaterThan(1);
    expect(climbMoment(o, 'Pinecrest', medalsHeld(d.climb!.pinecrest))).toBe('Beat Ansel and 2 more. Bronze on the whole run.');
  });

  it('counts several new medals', () => {
    const o = settle(save(), { v: SIM_VERSION, rung: 3 }, finished(125), ticks(45, 45, 35), finished(125), finished(125));
    expect(climbMoment(o, 'Pinecrest', { stages: [2, 2, 3], run: 2 })).toBe('4 new medals.');
  });

  it('hooks a rung missed by under 2 s, and only then', () => {
    const s = spotOn(board, finished(121.6));
    expect(rungHook(s, finished(121.6))).toBe('1.6 s from Tess and Rank 2.');
    expect(rungHook(spotOn(board, finished(122)), finished(122))).toBeNull();
    expect(rungHook(spotOn(board, finished(109)), finished(109))).toBeNull();
    // This run was slower than your best: it still missed by what it missed by.
    expect(rungHook(spotOn(board, finished(125)), finished(131))).toBeNull();
    expect(rungHook(spotOn(board, fell(4000)), fell(4000))).toBeNull();
  });

  it('hooks the stage gold you came closest to, within a second, on a stage you lack it', () => {
    const b = { stages: [STAGE_T, STAGE_T, STAGE_T] };
    expect(goldHook(ticks(40.4, 40.8, 45), b, [0, 0, 0])).toBe('0.4 s from gold in Stage 1.');
    expect(goldHook(ticks(40.4, 40.8, 45), b, [3, 0, 0])).toBe('0.8 s from gold in Stage 2.');
    expect(goldHook(ticks(39, 42, 45), b, [0, 0, 0])).toBeNull();
    expect(goldHook(ticks(39), { stages: [null, null, null] }, [0, 0, 0])).toBeNull();
  });

  it('says what decided it, in the stage that did', () => {
    expect(decidedLine('Mila', [40, 52.1, 41], [41, 50, 40.5], false)).toBe('You lost 2.1 s to Mila in Stage 2.');
    expect(decidedLine('Mila', [40, 49, 41], [41, 51.3, 40.5], true)).toBe('You took 2.3 s from Mila in Stage 2.');
  });

  it('says nothing no stage supports', () => {
    expect(decidedLine('Mila', [40], [41], false)).toBeNull();
    expect(decidedLine('Mila', [40, 41], [40.04, 41.04], true)).toBeNull();
    expect(decidedLine('Mila', [], [40, 41], false)).toBeNull();
    expect(decidedLine('Mila', [40], [], false)).toBeNull();
  });

  it('reads your best as the ladder does', () => {
    expect(bestStanding({ time: 120, distance: 4600 })).toEqual({ time: 120, distance: 4600 });
    expect(bestStanding({ distance: 900 })).toEqual({ time: null, distance: 900 });
    expect(bestStanding(null)).toBeNull();
  });
});
