import { describe, expect, it } from 'vitest';
import { FixedLoop } from '../src/game/loop';
import { Run } from '../src/game/run';
import { ChaosEvent, Mood, rollChaos } from '../src/sim/chaos';
import { InputRecorder, LogEvent, actionOf, decodeLog, draftOf, packInput } from '../src/sim/input';
import { MOUNTAINS } from '../src/sim/mountains';
import { Rng } from '../src/sim/prng';
import { RunRecord, recordFromString, recordToString, replayRecord } from '../src/sim/replay';
import { Sim } from '../src/sim/sim';

// A run is fully reproducible from seed + chaos + sled + input log, and the render frame rate
// never changes the outcome: the fixed-step loop is driven at 60 and 144 Hz (with jitter) and must
// produce bit-identical state, tick by tick.

/** A busy scripted rider: follows the line, carves, drifts, pops, spins, flips, stomps, drafts. */
function recordScriptedRun(seed: number, chaosSeed: number, sled: number, ticks: number): RunRecord {
  const chaos = rollChaos(chaosSeed, 3);
  const sim = new Sim({ seed, chaos, sled });
  const rec = new InputRecorder();
  const rng = new Rng(seed ^ chaosSeed);
  let steer = 4;
  let action = false;
  let hold = 0;
  let revived = false;
  for (let t = 0; t < ticks; t++) {
    if (sim.s.crashed) {
      if (revived) break;
      revived = true;
      rec.event(LogEvent.Revive);
      sim.revive();
    }
    const s = sim.s;
    if (hold-- <= 0) {
      hold = rng.int(5, 30);
      if (s.grounded) {
        const look = s.z + 6 + s.speed * 0.4;
        const want = Math.atan2(sim.course.safeX(look) - s.x, look - s.z) - s.velHeading;
        steer = Math.max(0, Math.min(8, Math.round(4 + want * 9 + rng.int(-2, 2))));
        action = rng.chance(0.35);
      } else {
        steer = rng.chance(0.4) ? (rng.chance(0.5) ? 0 : 8) : 4;
        action = rng.chance(0.3);
        hold = rng.int(3, 12);
      }
    }
    const byte = packInput(steer, action, rng.chance(0.01));
    rec.push(byte);
    sim.step(byte);
  }
  return { seed, chaos, sled, inputs: rec.encode(), ticks: rec.tickCount, score: sim.score, distance: sim.distance, name: 'Script' };
}

/** Replays a decoded log through the real Run + FixedLoop at a given render frame schedule. */
function replayThroughLoop(r: RunRecord, frameTimes: () => number): { hashes: number[]; score: number; distance: number; tick: number } {
  const log = decodeLog(r.inputs);
  let t = 0;
  const source = {
    sample() {
      const b = log.inputs[t];
      return { steer: b & 15, action: actionOf(b) };
    },
  };
  const run = new Run(r.seed, r.chaos, r.sled, source);
  run.draftProbe = () => draftOf(log.inputs[t]);
  const hashes: number[] = [];
  const loop = new FixedLoop(() => {
    if (t >= log.inputs.length) return false;
    if (log.events.get(t)?.includes(LogEvent.Revive)) {
      run.sim.revive();
    }
    if (run.sim.s.crashed) return false;
    run.tick();
    hashes.push(run.sim.hash());
    t++;
    return true;
  });
  let guard = 0;
  while (t < log.inputs.length && guard++ < 1_000_000) {
    loop.advance(frameTimes());
    // A crash pauses the live loop until the player revives; the replay resumes on the token.
    if (run.sim.s.crashed && log.events.get(t)?.includes(LogEvent.Revive)) {
      run.sim.revive();
    } else if (run.sim.s.crashed) break;
  }
  return { hashes, score: run.sim.score, distance: run.sim.distance, tick: run.sim.tick };
}

describe('determinism', () => {
  const cases = [
    { seed: MOUNTAINS[0].seed, chaos: 11, sled: 0 },
    { seed: MOUNTAINS[1].seed, chaos: 2024, sled: 1 },
    { seed: MOUNTAINS[2].seed, chaos: 77, sled: 3 },
    { seed: MOUNTAINS[3].seed, chaos: 5150, sled: 5 },
  ];

  for (const c of cases) {
    it(`seed ${c.seed.toString(16)}: identical outcome at 60 Hz and 144 Hz render rates`, () => {
      const rec = recordScriptedRun(c.seed, c.chaos, c.sled, 60 * 90);
      const direct = replayRecord(rec);
      expect(direct.score).toBe(rec.score);
      expect(direct.distance).toBe(rec.distance);

      const jitter = new Rng(c.chaos);
      const at60 = replayThroughLoop(rec, () => 1 / 60);
      const at144 = replayThroughLoop(rec, () => 1 / 144 + (jitter.next() - 0.5) * 0.002);
      const at37 = replayThroughLoop(rec, () => 1 / 37 + (jitter.next() - 0.5) * 0.01);
      expect(at60.hashes.length).toBeGreaterThan(240);
      expect(at144.hashes).toEqual(at60.hashes);
      expect(at37.hashes).toEqual(at60.hashes);
      expect(at144.score).toBe(rec.score);
      expect(at60.score).toBe(rec.score);
      expect(at144.distance).toBe(rec.distance);
    });
  }

  it('a record survives the challenge-link round trip and replays identically', () => {
    const rec = recordScriptedRun(MOUNTAINS[0].seed, 99, 2, 60 * 60);
    const back = recordFromString(recordToString(rec));
    const a = replayRecord(rec);
    const b = replayRecord(back);
    expect(b.hash()).toBe(a.hash());
    expect(b.score).toBe(rec.score);
  });

  it('a live revive through Run delivers no stale crash event and records a replayable log', () => {
    let t = 0;
    const steerRight = { sample: () => ({ steer: 8, action: false }) };
    const run = new Run(MOUNTAINS[0].seed, { mood: Mood.None, event: ChaosEvent.None, seed: 1 }, 0, steerRight);
    const loop = new FixedLoop(() => run.tick());
    const kinds: string[] = [];
    while (!run.crashed && t++ < 60 * 120) loop.advance(1 / 60);
    for (const p of run.drain()) kinds.push(p.e.type);
    expect(run.crashed).toBe(true);
    expect(kinds.filter((k) => k === 'crash')).toHaveLength(1);
    run.revive();
    for (let i = 0; i < 30; i++) loop.advance(1 / 60);
    const after = run.drain().map((p) => p.e.type);
    expect(after).toContain('revive');
    expect(after).not.toContain('crash');
    // The first ticks after a revive follow the slope instead of launching.
    expect(after).not.toContain('takeoff');
    const rec = run.toRecord('Reviver');
    const replay = replayRecord(rec);
    expect(replay.hash()).toBe(run.sim.hash());
  });

  it('chaos never moves static geometry', () => {
    const seed = MOUNTAINS[0].seed;
    const plain = new Sim({ seed, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 1 }, sled: 0 });
    const wild = new Sim({ seed, chaos: { mood: Mood.Comet, event: ChaosEvent.Avalanche, seed: 9 }, sled: 0 });
    for (let i = 0; i < 40; i++) {
      expect(JSON.stringify(wild.course.chunk(i))).toBe(JSON.stringify(plain.course.chunk(i)));
    }
    for (let z = 0; z < 2000; z += 7.3) expect(wild.course.ground(3, z)).toBe(plain.course.ground(3, z));
  });

  it('a 3-minute scripted run log stays under 2 KB', () => {
    const rec = recordScriptedRun(MOUNTAINS[1].seed, 5, 0, 60 * 180);
    expect(rec.inputs.length).toBeLessThan(2048);
  });
});
