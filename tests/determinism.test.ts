import { describe, expect, it } from 'vitest';
import { FixedLoop } from '../src/game/loop';
import { Run } from '../src/game/run';
import { ChaosEvent, Mood, rollChaos } from '../src/sim/chaos';
import { InputRecorder, LogEvent, actionOf, decodeLog, draftOf, packInput } from '../src/sim/input';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { Rng, hash32 } from '../src/sim/prng';
import { CHUNK_LEN, Course, type Obstacle, courseFor } from '../src/sim/course';
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
    // A rider who aims at whatever stands ahead: nothing short of that ends a run this early, since the
    // corridor's edge turns a sled back and two wipeouts are forgiven past the free stretch.
    const hunter = {
      sample: (): { steer: number; action: boolean } => {
        const s = run.sim.s;
        const k = Math.floor(s.z / CHUNK_LEN);
        let best: Obstacle | null = null;
        for (let i = k; i <= k + 1; i++) {
          for (const o of run.sim.course.chunk(i).obstacles) {
            if (o.soft || o.z < s.z + 2 || o.z > s.z + 45) continue;
            if (!best || o.z < best.z) best = o;
          }
        }
        const d = best ? best.x - s.x : 0;
        return { steer: d > 0.4 ? 8 : d < -0.4 ? 0 : 4, action: false };
      },
    };
    const run: Run = new Run(MOUNTAINS[0].seed, { mood: Mood.None, event: ChaosEvent.None, seed: 1 }, 0, hunter);
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

  it('a 3-minute scripted run log stays under 2.2 KB', () => {
    // This run's input changes every 5 to 30 ticks, far busier than a person (a real 3-minute run is about
    // 1 KB). Its rate is unchanged at about 700 bytes a minute: since the lantern's wards it rides the whole
    // 3 minutes, where it used to wreck at 2:42 with 1,941 bytes.
    const rec = recordScriptedRun(MOUNTAINS[1].seed, 5, 0, 60 * 180);
    expect(rec.inputs.length).toBeLessThan(2250);
  });

  it('a run replays the same however the course is read between ticks', () => {
    for (const m of MOUNTAINS) {
      const rec = recordScriptedRun(m.seed, 7, 0, 60 * 60);
      const clean = replayRecord(rec).hash();
      const rng = new Rng(m.seed);
      const course = courseFor(m.seed);
      const noisy = replayRecord(rec, (sim) => {
        // What the renderer, the ghosts and the bot ask for between steps, at places far from the rider.
        for (let i = 0; i < 6; i++) {
          const z = rng.next() * (course.finishZ + 200) - 20;
          const x = course.centerX(z) + (rng.next() - 0.5) * 60;
          course.ground(x, z);
          course.safeX(z);
          course.altX(z);
          course.backX(z, x);
          course.edgeLimit(z);
          course.shapeAt(z);
          course.section(z);
          course.surface(x, z);
          course.edgeExcess(x, z);
          course.chunk(Math.floor(Math.max(0, z) / CHUNK_LEN));
        }
        void sim;
      });
      expect(noisy.hash(), m.id).toBe(clean);
    }
  });

  it('a course is the same whatever order its chunks are read in', () => {
    for (const m of MOUNTAINS) {
      const a = new Course(m.seed);
      const b = new Course(m.seed);
      const n = Math.ceil(a.finishZ / CHUNK_LEN) + 4;
      const list = (c: Course, i: number): string => {
        const ch = c.chunk(i);
        return JSON.stringify([ch.obstacles.map((o) => [o.id, o.x, o.z, o.r]), ch.lights.map((g) => [g.id, g.x, g.z, g.hover, g.value]), ch.zones.ramps, ch.zones.rails, ch.zones.drops]);
      };
      const forward: string[] = [];
      for (let i = 0; i < n; i++) forward.push(list(a, i));
      for (let i = n - 1; i >= 0; i--) expect(list(b, i), `${m.id} chunk ${i}`).toBe(forward[i]);
    }
  });

  it('every seed builds a descent, named the same whichever is read first', () => {
    // A Daily Mountain that cannot build is a mountain that cannot load.
    const day0 = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 700; i++) {
      const seed = i % 2 ? dailySeed(new Date(day0 + i * 86400000).toISOString().slice(0, 10)) : hash32(i, 91);
      const a = new Course(seed);
      const names = a.stages.map((s) => s.name);
      const b = new Course(seed);
      expect(b.section(4000).kind.length).toBeGreaterThan(0);
      expect(b.stages.map((s) => s.name)).toEqual(names);
      expect(b.finishZ).toBe(a.finishZ);
    }
  });
});
