import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REEL_MAX_TICKS, ReelPlayer, cutOnBars, placeAt, planReel, scanRecord, type ReelRider, type RiderAt } from '../src/game/reel';
import { InputRecorder, packInput } from '../src/sim/input';
import { recordFromString, replayRecord, type RunRecord } from '../src/sim/replay';
import { Sim } from '../src/sim/sim';
import { reelCard } from '../src/ui/reelcopy';

// Your run, directed: the reel is cut from a record and from nothing else. The selection is the same
// every time for a record, the re-simulation it plays is the run that was ridden (its state hash), its
// windows never overlap and stay inside the run, and a run that ended in a wreck still has a reel.

interface PoolEntry { name: string; record: string }
const pool = (file: string): PoolEntry[] => JSON.parse(readFileSync(`src/data/ghosts/${file}.json`, 'utf8')).ghosts ?? JSON.parse(readFileSync(`src/data/ghosts/${file}.json`, 'utf8'));

/** A pool run as a rider of the field: where it was at each tick of its own run. */
function rider(e: PoolEntry): ReelRider {
  const xs: number[] = [];
  const zs: number[] = [];
  replayRecord(recordFromString(e.record), (s) => {
    xs.push(s.s.x);
    zs.push(s.s.z);
  });
  return {
    name: e.name,
    kind: 'pool',
    at(tick: number, out: RiderAt): boolean {
      const i = Math.min(xs.length - 1, Math.max(0, tick));
      out.x = xs[i];
      out.z = zs[i];
      out.done = tick >= xs.length;
      return true;
    },
  };
}

/** A run that ends in a wreck: hands off the line with the sled held hard over, until the sim says so. */
function wreckedRun(seed: number): RunRecord {
  const sim = new Sim({ seed, chaos: { mood: 0, event: 0, seed: 7 }, sled: 0 });
  const rec = new InputRecorder();
  for (let t = 0; t < 60 * 240 && !sim.s.crashed; t++) {
    // Straight for a few seconds to gather speed, then held over into whatever stands at the edge.
    const steer = t < 240 ? 4 : (Math.floor(t / 420) % 2 ? 8 : 0);
    const byte = packInput(steer, false, false, false);
    rec.push(byte);
    sim.step(byte);
  }
  return { seed, chaos: { mood: 0, event: 0, seed: 7 }, sled: 0, inputs: rec.encode(), ticks: rec.tickCount, score: sim.score, distance: sim.distance, name: 'Wreck' };
}

const noOverlap = (shots: ReturnType<typeof planReel>, ticks: number) => {
  for (let i = 0; i < shots.length; i++) {
    expect(shots[i].t0).toBeGreaterThanOrEqual(0);
    expect(shots[i].t1).toBeLessThan(ticks);
    expect(shots[i].t1).toBeGreaterThan(shots[i].t0);
    expect(shots[i].peak).toBeGreaterThanOrEqual(shots[i].t0);
    expect(shots[i].peak).toBeLessThanOrEqual(shots[i].t1);
    if (i > 0) expect(shots[i].t0).toBeGreaterThan(shots[i - 1].t1);
  }
};

describe('the highlight reel', () => {
  const entries = pool('pinecrest');
  const best = entries[entries.length - 1];
  const rec = recordFromString(best.record);
  const field = entries.slice(0, 5).map(rider);

  it('re-simulates the record to the run that was ridden', () => {
    const scan = scanRecord(rec, field);
    expect(scan.hash).toBe(replayRecord(rec).hash());
    // The player the lens rides with is the same sim again, however it is sliced.
    const p = new ReelPlayer(rec);
    while (!p.seek(p.ticks, 700)) { /* a slice at a time */ }
    expect(p.sim.hash()).toBe(scan.hash);
    // Going back starts again from the top and reaches the same state.
    p.seek(600);
    for (let i = 0; i < 400; i++) p.advance(1 / 144);
    p.seek(p.ticks);
    expect(p.sim.hash()).toBe(scan.hash);
  });

  it('picks the same shots for a record every time', () => {
    const a = planReel(scanRecord(rec, field));
    const b = planReel(scanRecord(rec, field));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
  });

  it('cuts windows that never overlap, inside the run, twenty to thirty seconds in all', () => {
    for (const file of ['pinecrest', 'frostfang', 'ember', 'sakura', 'lanternfall']) {
      const es = pool(file);
      for (const e of [es[0], es[Math.floor(es.length / 2)], es[es.length - 1]]) {
        const r = recordFromString(e.record);
        const scan = scanRecord(r, es.slice(0, 4).filter((o) => o !== e).map(rider));
        const shots = planReel(scan);
        noOverlap(shots, scan.ticks);
        const total = shots.reduce((n, s) => n + s.t1 - s.t0, 0);
        expect(total, `${file} ${e.name}`).toBeLessThanOrEqual(REEL_MAX_TICKS);
        expect(total, `${file} ${e.name}`).toBeGreaterThanOrEqual(12 * 60);
        // The reel ends on how the run ended.
        expect(['finish', 'wreck']).toContain(shots[shots.length - 1].kind);
        // On the bar lines it is still a clean cut.
        noOverlap(cutOnBars(shots.map((s) => ({ ...s })), 120), scan.ticks);
        // Every shot has a card, in words.
        for (const s of shots) expect(reelCard(s).length).toBeGreaterThan(3);
      }
    }
  });

  it('shows the best leap and the closest pass it found', () => {
    const scan = scanRecord(rec, field);
    const shots = planReel(scan);
    const leap = shots.find((s) => s.kind === 'leap');
    if (scan.leaps.length) {
      expect(leap).toBeDefined();
      expect(reelCard(leap!)).toMatch(/^Best leap, \d+\.\d s$/);
    }
    const pass = shots.find((s) => s.kind === 'pass');
    if (pass) {
      expect(scan.passes.some((p) => p.tick === pass.peak)).toBe(true);
      expect(reelCard(pass)).toMatch(/^Passed /);
    }
  });

  it('names a place for any metre of the course', () => {
    const scan = scanRecord(rec);
    expect(placeAt(scan, scan.pieceZ[0][0] + 5)).toBe(scan.pieceNames[0]);
    expect(placeAt(scan, 10).length).toBeGreaterThan(0);
  });

  it('cuts a reel of a wrecked run', () => {
    const w = wreckedRun(recordFromString(entries[0].record).seed);
    const scan = scanRecord(w);
    expect(scan.finishTick).toBe(-1);
    const shots = planReel(scan);
    expect(shots.length).toBeGreaterThanOrEqual(1);
    noOverlap(shots, scan.ticks);
    const last = shots[shots.length - 1];
    expect(last.kind).toBe('wreck');
    expect(reelCard(last)).toMatch(/m$/);
    // It plays to its end: the player rides the wreck's window and stops with the log.
    const p = new ReelPlayer(w);
    p.seek(last.t0);
    let frames = 0;
    while (p.advance(1 / 60) && frames < 100000) frames++;
    expect(p.sim.hash()).toBe(scan.hash);
  });
});
