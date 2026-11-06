import { describe, expect, it } from 'vitest';
import { F_Z, FRAME_STRIDE, type WorkerOut } from '../src/game/ghostdata';
import { GhostManager, emptyPose, trackStanding } from '../src/game/ghosts';
import { Run, emptySnap } from '../src/game/run';
import { FINISH_Z, placeAtFinish, recordStanding } from '../src/game/standing';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { MOUNTAINS } from '../src/sim/mountains';
import { recordFromString, recordToString, replayRecord } from '../src/sim/replay';

// A finish is not a crash: the sled coasts on, and a ghost that got there first stays ahead.

interface Inbox {
  onMessage(m: WorkerOut): void;
}

/** A field of `n` tracks, each replying with its run's z every 2 ticks. */
function field(tracks: Array<{ zs: number[]; finishTick?: number; crashTick?: number; stageTicks?: number[]; distance?: number }>): GhostManager {
  const gm = new GhostManager();
  gm.setField(tracks.map((_, i) => ({ name: `G${i}`, kind: 'pool' as const, score: 100, record: '' })));
  tracks.forEach((t, i) => {
    const frames = new Float32Array(t.zs.length * FRAME_STRIDE);
    t.zs.forEach((z, k) => (frames[k * FRAME_STRIDE + F_Z] = z));
    (gm as unknown as Inbox).onMessage({ type: 'trajectory', id: gm.tracks[i].entry.id, frames, samples: t.zs.length, ticks: t.zs.length * 2, crashTick: t.crashTick ?? -1, finishTick: t.finishTick ?? -1, stageTicks: t.stageTicks ?? [], score: 0, distance: t.distance ?? t.zs[t.zs.length - 1], tricks: new Int32Array(0) });
  });
  return gm;
}

/** Rides down a straight line: z at a steady 20 m per sample. */
const ride = (from: number, n: number): number[] => Array.from({ length: n }, (_, i) => from + i * 20);

describe('a ghost over the line', () => {
  it('is never passed: rolling by where it stopped pays nothing and counts nothing', () => {
    // It crossed at tick 20 and stopped at z 4520.
    const gm = field([{ zs: [...ride(4300, 10), 4520, 4520, 4520], finishTick: 20 }]);
    const t = gm.tracks[0];
    gm.race(10, 4200);
    expect(t.status).toBe(-1);
    // Past it, on the coast, and well past it.
    expect(gm.race(40, 4525)).toEqual([]);
    expect(gm.race(60, 4700)).toEqual([]);
    expect(t.passed).toBe(false);
    expect(t.passedTimes).toBe(0);
  });

  it('even one you sat ahead of until it finished stays ahead from then on', () => {
    const gm = field([{ zs: ride(4400, 12), finishTick: 20 }]);
    const t = gm.tracks[0];
    gm.race(4, 4500);
    expect(t.status).toBe(1);
    gm.race(22, 4520);
    expect(t.status).toBe(-1);
  });

  it('a ghost still riding is passed as ever', () => {
    const gm = field([{ zs: ride(100, 200) }]);
    gm.race(100, 1000);
    const out = gm.race(102, 1200);
    expect(out.map((e) => e.type)).toEqual(['pass']);
    expect(gm.tracks[0].passed).toBe(true);
  });

  it('opens no crash door: only a real wreck is a wreck', () => {
    const gm = field([
      { zs: ride(4400, 5), finishTick: 6 },
      { zs: ride(100, 5), crashTick: 9 },
      // Crashed, revived and finished: it never wrecked for good.
      { zs: ride(4400, 5), crashTick: 3, finishTick: 8 },
    ]);
    const out = gm.race(200, 50);
    expect(out.filter((e) => e.type === 'crashed').map((e) => e.track.entry.name)).toEqual(['G1']);
    expect(gm.tracks[0].crashSeen).toBe(false);
  });

  it('tells the world it ended well', () => {
    const gm = field([{ zs: ride(4400, 10), finishTick: 12 }]);
    const p = emptyPose();
    gm.pose(gm.tracks[0], 8, p);
    expect(p.finished).toBe(false);
    gm.pose(gm.tracks[0], 14, p);
    expect(p.finished).toBe(true);
    expect(p.done).toBe(false);
  });
});

describe('your place at the finish', () => {
  it('counts only the ghosts already over the line', () => {
    const gm = field([
      { zs: ride(0, 3), finishTick: 900 },
      { zs: ride(0, 3), finishTick: 1100 },
      { zs: ride(0, 3) },
    ]);
    expect(placeAtFinish(gm.tracks, 1000)).toEqual({ rank: 2, of: 4 });
    expect(placeAtFinish(gm.tracks, 800)).toEqual({ rank: 1, of: 4 });
    expect(placeAtFinish(gm.tracks, 1200)).toEqual({ rank: 3, of: 4 });
  });

  it('gives a dead heat to you', () => {
    const gm = field([{ zs: ride(0, 3), finishTick: 900 }]);
    expect(placeAtFinish(gm.tracks, 900)).toEqual({ rank: 1, of: 2 });
  });

  it('counts a track only once it is ready', () => {
    const gm = new GhostManager();
    gm.setField([{ name: 'G', kind: 'pool', score: 1, record: '' }]);
    expect(placeAtFinish(gm.tracks, 900)).toEqual({ rank: 1, of: 1 });
  });

  it('reads a track as the race order does', () => {
    const gm = field([{ zs: ride(0, 3), finishTick: 9000, distance: 4620 }, { zs: ride(0, 3), distance: 3210 }]);
    expect(trackStanding(gm.tracks[0])).toEqual({ time: 150, distance: 4620 });
    expect(trackStanding(gm.tracks[1])).toEqual({ time: null, distance: 3210 });
  });
});

describe('the coast', () => {
  const chaos = { mood: Mood.None, event: ChaosEvent.None, seed: 1 };
  /** A run set down right by the line: it crosses every stage line on its first ticks. */
  function atTheLine(): Run {
    const run = new Run(MOUNTAINS[0].seed, chaos, 0, { sample: () => ({ steer: 4, action: false }) });
    run.sim.s.z = FINISH_Z - 0.1;
    return run;
  }

  it('keeps advancing past the line, and is never a crash', () => {
    const run = atTheLine();
    let ticks = 0;
    while (!run.finished && ticks++ < 20) expect(run.tick()).toBe(true);
    expect(run.finished).toBe(true);
    const events = run.drain().map((p) => p.e.type);
    expect(events).toContain('finish');
    expect(events).not.toContain('crash');
    const z = run.sim.s.z;
    const tick = run.sim.tick;
    for (let i = 0; i < 120; i++) expect(run.tick()).toBe(true);
    expect(run.crashed).toBe(false);
    expect(run.sim.tick).toBe(tick + 120);
    expect(run.sim.s.z).toBeGreaterThan(z);
    expect(run.cur.finished).toBe(true);
    expect(emptySnap().finished).toBe(false);
  });

  it('stops on the run-out, and still never crashes', () => {
    const run = atTheLine();
    run.sim.s.speed = 30;
    for (let i = 0; i < 60 * 40; i++) run.tick();
    expect(run.crashed).toBe(false);
    expect(run.sim.s.speed).toBe(0);
  });

  it('records the finish in the header, and the coast in the log', () => {
    const run = atTheLine();
    while (!run.finished) run.tick();
    for (let i = 0; i < 90; i++) run.tick();
    const rec = run.toRecord('Mila');
    expect(rec.ticks).toBe(run.sim.s.finishTick);
    expect(rec.ticks).toBeLessThan(run.recorder.tickCount);
    const back = recordFromString(recordToString(rec));
    expect(recordStanding(back).time).toBeCloseTo(run.sim.s.finishTick / 60, 6);
  });

  it("a live run's record replays tick for tick", () => {
    // Before the line ticks is the log's own length, as it always was.
    const run = new Run(MOUNTAINS[0].seed, chaos, 0, { sample: () => ({ steer: 4, action: false }) });
    for (let i = 0; i < 600; i++) run.tick();
    const rec = run.toRecord('Mila');
    expect(rec.ticks).toBe(run.recorder.tickCount);
    expect(replayRecord(rec).tick).toBe(run.sim.tick);
  });
});
