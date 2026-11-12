import { describe, expect, it } from 'vitest';
import { fallsOf } from '../src/bot/pool';
import { Run } from '../src/game/run';
import { PLAIN } from '../src/sim/chaos';
import { CHUNK_LEN, type Obstacle } from '../src/sim/course';
import { packInput } from '../src/sim/input';
import { MOUNTAINS, dailySeed } from '../src/sim/mountains';
import { replayRecord } from '../src/sim/replay';
import { DOWN_TICKS, FALL_DOWN, FALL_FALLING, FALL_NONE, FALL_TICKS, FALL_UP, FREE_TUMBLE_Z, GET_UPS, GET_UP_BACK_M, LANTERN, SLED_RADIUS, Sim, TUMBLE_TICKS, UP_TICKS, type SimEvent } from '../src/sim/sim';

// Falls and get-ups (round 7). A wreck no longer ends a run by itself: the rider falls, slides to a stop on
// the safe line, lies there, gets up and rides on. It is the sim's rule for every rider, so a ghost's record
// carries its own falls, a fall replays exactly, it never sets a rider forward or inside anything, and what
// ends a run is a fall with no get-up left.

const SEEDS = [...MOUNTAINS.map((m) => m.seed), dailySeed('2026-11-12'), dailySeed('2027-02-03')];

/** A rider who picks something solid well ahead, lines up on it and rides straight in: the surest way to
 *  fall often (a sled that only swerves at the last moment is slow by then, and bounces off). */
function hunter(sim: () => Sim): { sample(): { steer: number; action: boolean } } {
  let mark: Obstacle | null = null;
  return {
    sample() {
      const s = sim().s;
      const c = sim().course;
      if (mark && mark.z < s.z + 1) mark = null;
      if (!mark) {
        const k = Math.floor(s.z / CHUNK_LEN);
        for (let i = k; i <= k + 2 && !mark; i++) {
          for (const o of c.chunk(i).obstacles) {
            if (o.soft || o.z < s.z + 30 || o.z > s.z + 110 || c.edgeExcess(o.x, o.z) > -1) continue;
            if (!mark || o.z < mark.z) mark = o;
          }
        }
      }
      if (!mark || !s.grounded) return { steer: 4, action: false };
      const want = Math.atan2(mark.x - s.x, mark.z - s.z) - s.velHeading;
      return { steer: Math.max(0, Math.min(8, Math.round(4 + want * 14))), action: false };
    },
  };
}

interface Seen {
  tick: number;
  e: SimEvent;
  x: number;
  z: number;
  speed: number;
}

/** A hunter's run of up to `secs`, with every fall event and the sled at it. */
function hunt(seed: number, secs: number): { run: Run; seen: Seen[] } {
  const run: Run = new Run(seed, PLAIN, 0, hunter(() => run.sim));
  const seen: Seen[] = [];
  for (let t = 0; t < secs * 60 && !run.crashed && !run.finished; t++) {
    run.tick();
    const s = run.sim.s;
    for (const e of run.sim.events) if (e.type === 'tumble' || e.type === 'fall' || e.type === 'getUp' || e.type === 'crash' || e.type === 'ward') seen.push({ tick: run.sim.tick, e, x: s.x, z: s.z, speed: s.speed });
  }
  return { run, seen };
}

/** Sets the sled just uphill of a hard obstacle past `from`, riding straight into it at `v`. */
function ram(sim: Sim, from: number, v = 30): Obstacle {
  const c = sim.course;
  for (let k = Math.floor(from / CHUNK_LEN); k < 80; k++) {
    for (const o of c.chunk(k).obstacles) {
      // A lone round one inside the corridor, on ground a sled rides (not under a flight).
      if (o.soft || o.z < from || o.x2 !== o.x || o.z2 !== o.z || c.edgeExcess(o.x, o.z) > -2) continue;
      const s = sim.s;
      s.x = o.x;
      s.z = o.z - o.r - SLED_RADIUS - 1.2;
      s.y = c.ground(s.x, s.z);
      s.vx = 0;
      s.vz = v;
      s.speed = v;
      s.heading = 0;
      s.velHeading = 0;
      s.vy = (v * (c.ground(s.x, s.z + 0.5) - s.y)) / 0.5;
      s.grounded = true;
      s.invuln = 0;
      s.ghost = 0;
      return o;
    }
  }
  throw new Error('no obstacle to ram');
}

/** Steps hands-off until an event of `type` comes (or `max` ticks pass), returning it. */
function until<T extends SimEvent['type']>(sim: Sim, type: T, phase: string | null, max = 600): Extract<SimEvent, { type: T }> | null {
  for (let i = 0; i < max; i++) {
    sim.step(packInput(4, false, false));
    for (const e of sim.events) if (e.type === type && (phase === null || (e as { phase?: string }).phase === phase)) return e as Extract<SimEvent, { type: T }>;
  }
  return null;
}

describe('a fall', () => {
  it('replays exactly, and the record carries its own falls', () => {
    let back = 0;
    for (const seed of SEEDS.slice(0, 4)) {
      const { run, seen } = hunt(seed, 200);
      const falls = seen.filter((q) => q.e.type === 'tumble' && q.e.phase === 'start');
      expect(falls.length, seed.toString(16)).toBeGreaterThanOrEqual(3);
      if (seen.some((q) => q.e.type === 'getUp')) back++;
      const rec = run.toRecord('Hunter');
      const again: Seen[] = [];
      const replay = replayRecord(rec, (sim) => {
        for (const e of sim.events) if (e.type === 'tumble' || e.type === 'fall' || e.type === 'getUp' || e.type === 'crash' || e.type === 'ward') again.push({ tick: sim.tick, e, x: sim.s.x, z: sim.s.z, speed: sim.s.speed });
      });
      expect(replay.hash()).toBe(run.sim.hash());
      expect(again).toEqual(seen);
      // What the pool writes down for the graveyards is the same list.
      expect(fallsOf(rec)).toEqual(seen.filter((q) => (q.e.type === 'tumble' && q.e.phase === 'start') || q.e.type === 'ward' || q.e.type === 'crash').map((q) => Math.round(q.z)));
    }
    // (Get-ups spent and come back are in those runs too, so their count replays with the rest.)
    expect(back).toBeGreaterThan(0);
  });

  it("is the rider's own: a ghost falls where its record says, whoever rides beside it", () => {
    const seed = MOUNTAINS[1].seed;
    const { run, seen } = hunt(seed, 80);
    const rec = run.toRecord('Ghost');
    // The ghost's replay, stepped tick for tick beside three other riders on the same mountain.
    const others = [0, 4, 8].map((steer) => ({ sim: new Sim({ seed, chaos: PLAIN, sled: 0 }), steer }));
    const again: Seen[] = [];
    const replay = replayRecord(rec, (sim) => {
      for (const o of others) o.sim.step(packInput(o.steer, sim.tick % 90 < 30, false, sim.tick % 400 === 0));
      for (const e of sim.events) if (e.type === 'tumble' || e.type === 'fall' || e.type === 'getUp' || e.type === 'crash' || e.type === 'ward') again.push({ tick: sim.tick, e, x: sim.s.x, z: sim.s.z, speed: sim.s.speed });
    });
    expect(again).toEqual(seen);
    expect(replay.hash()).toBe(run.sim.hash());
  });

  it('is three phases of the sim\'s own length, and says which it is in', () => {
    const sim = new Sim({ seed: MOUNTAINS[0].seed, chaos: PLAIN, sled: 0 });
    ram(sim, 900);
    const start = until(sim, 'tumble', 'start');
    expect(start).not.toBeNull();
    const t0 = sim.tick;
    expect(sim.s.fall).toBe(FALL_FALLING);
    expect(sim.s.fallStart).toBe(t0 - 1);
    expect(sim.s.tumble).toBe(TUMBLE_TICKS);
    expect(until(sim, 'fall', 'down')).not.toBeNull();
    expect(sim.tick - t0).toBe(FALL_TICKS);
    expect(sim.s.fall).toBe(FALL_DOWN);
    expect(sim.s.fallTick).toBe(sim.tick - 1);
    expect(sim.s.speed).toBeLessThan(2.5);
    expect(until(sim, 'fall', 'up')).not.toBeNull();
    expect(sim.tick - t0).toBe(FALL_TICKS + DOWN_TICKS);
    expect(sim.s.fall).toBe(FALL_UP);
    expect(sim.s.speed).toBe(0);
    expect(until(sim, 'tumble', 'end')).not.toBeNull();
    expect(sim.tick - t0).toBe(FALL_TICKS + DOWN_TICKS + UP_TICKS);
    expect(TUMBLE_TICKS).toBe(FALL_TICKS + DOWN_TICKS + UP_TICKS);
    expect(sim.s.fall).toBe(FALL_NONE);
    expect(sim.s.fallTick).toBe(-1);
    expect(sim.s.fallStart).toBe(-1);
    expect(sim.s.tumble).toBe(0);
    expect(sim.s.grounded).toBe(true);
    expect(sim.s.falls).toBe(1);
  });

  it('never puts a rider inside a collider or off the corridor, on any mountain', () => {
    const bad: string[] = [];
    let falls = 0;
    for (const seed of SEEDS) {
      const run: Run = new Run(seed, PLAIN, 0, hunter(() => run.sim));
      const c = run.sim.course;
      for (let t = 0; t < 60 * 110 && !run.crashed && !run.finished; t++) {
        run.tick();
        const s = run.sim.s;
        const tag = `${seed.toString(16)} z=${s.z.toFixed(0)}`;
        const resting = s.fall === FALL_DOWN || s.fall === FALL_UP;
        const up = run.sim.events.some((e) => e.type === 'tumble' && e.phase === 'end');
        if (up) falls++;
        if (!resting && !up) continue;
        // At rest, standing up and riding again: on the safe line, inside the corridor, on the ground.
        if (Math.abs(s.x - c.safeX(s.z)) > 1e-6) bad.push(`${tag}: ${(s.x - c.safeX(s.z)).toFixed(2)} m off the safe line`);
        if (c.edgeExcess(s.x, s.z) > -2) bad.push(`${tag}: at the corridor's edge`);
        if (s.y < c.ground(s.x, s.z) - 1e-6) bad.push(`${tag}: under the snow`);
        for (let k = Math.max(0, Math.floor(s.z / CHUNK_LEN) - 1); k <= Math.floor(s.z / CHUNK_LEN) + 1; k++) {
          for (const o of c.chunk(k).obstacles) {
            if (o.soft) continue;
            const ex = o.x2 - o.x;
            const ez = o.z2 - o.z;
            const u = ex || ez ? Math.max(0, Math.min(1, ((s.x - o.x) * ex + (s.z - o.z) * ez) / (ex * ex + ez * ez))) : 0;
            const d = Math.hypot(s.x - o.x - ex * u, s.z - o.z - ez * u) - o.r - SLED_RADIUS;
            if (d < 0.5) bad.push(`${tag}: ${d.toFixed(2)} m from ${o.kind} ${o.id}`);
          }
        }
      }
    }
    expect(falls).toBeGreaterThan(20);
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('never sets a rider forward, and never sends one off faster than it came', () => {
    const bad: string[] = [];
    let falls = 0;
    for (const seed of SEEDS) {
      const run: Run = new Run(seed, PLAIN, 0, hunter(() => run.sim));
      let from: { z: number; vz: number; tick: number } | null = null;
      let lastZ = 0;
      for (let t = 0; t < 60 * 110 && !run.crashed && !run.finished; t++) {
        const before = { z: run.sim.s.z, vz: run.sim.s.vz, tick: run.sim.tick };
        run.tick();
        const s = run.sim.s;
        for (const e of run.sim.events) {
          if (e.type === 'tumble' && e.phase === 'start') {
            from = before;
            lastZ = before.z;
          } else if (e.type === 'tumble' && e.phase === 'end' && from) {
            falls++;
            const secs = (run.sim.tick - from.tick) / 60;
            const tag = `${seed.toString(16)} z=${from.z.toFixed(0)} at ${from.vz.toFixed(1)} m/s`;
            const had = Math.max(from.vz, 0);
            // Slower over the ground than it was going for the whole of the fall (or all but stopped).
            if (s.z - from.z > Math.max(had * secs * 0.5, 2)) bad.push(`${tag}: ${(s.z - from.z).toFixed(1)} m in the fall`);
            // (Half a metre a second of slack: the speed is read a tick before the hit.)
            if (s.speed > Math.max(had, 3) + 0.5) bad.push(`${tag}: up at ${s.speed.toFixed(1)} m/s`);
            if (s.speed > 0.5 * run.sim.cruiseSpeed() + 1e-9) bad.push(`${tag}: up faster than the push-off`);
            from = null;
          }
        }
        if (from) {
          if (s.z < lastZ - 1e-9) bad.push(`${seed.toString(16)}: slid back uphill at z=${s.z.toFixed(1)}`);
          lastZ = s.z;
        }
      }
    }
    expect(falls).toBeGreaterThan(20);
    expect(bad.slice(0, 8)).toEqual([]);
  });

  it('cannot chain: the rider just up is untouchable, and nothing fells it for two and a half seconds', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const { seen } = hunt(seed, 100);
      let up = -1e9;
      for (const q of seen) {
        if (q.e.type === 'tumble' && q.e.phase === 'end') up = q.tick;
        if ((q.e.type === 'tumble' && q.e.phase === 'start') || q.e.type === 'crash' || q.e.type === 'ward') expect(q.tick - up, `${seed.toString(16)} tick ${q.tick}`).toBeGreaterThan(150);
      }
    }
  });
});

describe('get-ups', () => {
  const fresh = (m = 0): Sim => new Sim({ seed: MOUNTAINS[m].seed, chaos: PLAIN, sled: 0 });

  it('a rider carries three, and the first stretch costs none', () => {
    const sim = fresh();
    expect(sim.s.getUps).toBe(GET_UPS);
    expect(GET_UPS).toBe(3);
    ram(sim, 300);
    expect(sim.s.z).toBeLessThan(FREE_TUMBLE_Z);
    const e = until(sim, 'tumble', 'start');
    expect(e?.left).toBe(GET_UPS);
    expect(sim.s.getUps).toBe(GET_UPS);
    expect(sim.s.falls).toBe(1);
  });

  it('a fall past the first stretch spends one, and it comes back with the riding', () => {
    const sim = fresh();
    ram(sim, 900);
    const e = until(sim, 'tumble', 'start');
    expect(e?.left).toBe(GET_UPS - 1);
    const fellAt = sim.s.z;
    until(sim, 'tumble', 'end');
    expect(sim.s.getUps).toBe(GET_UPS - 1);
    // Hands off down the line: the mountain rides it, and the get-up is back within the promised metres.
    const back = until(sim, 'getUp', null, 60 * 40);
    expect(back).toEqual({ type: 'getUp', left: GET_UPS, why: 'ridden' });
    expect(sim.s.z - fellAt).toBeGreaterThanOrEqual(GET_UP_BACK_M - 1);
    expect(sim.s.z - fellAt).toBeLessThan(GET_UP_BACK_M + 2);
  });

  it('a stage line gives them all back', () => {
    const sim = fresh();
    const line = sim.course.stages[0].z1;
    const s = sim.s;
    s.z = line - 30;
    s.x = sim.course.safeX(s.z);
    s.y = sim.course.ground(s.x, s.z);
    s.getUps = 0;
    s.getUpZ = s.z;
    const e = until(sim, 'getUp', null, 300);
    expect(e).toEqual({ type: 'getUp', left: GET_UPS, why: 'stage' });
    expect(sim.stageTicks.length).toBe(1);
  });

  it('with none left the next fall is the wreck, with its cause, and a revive rides on with one', () => {
    const sim = fresh();
    sim.s.getUps = 0;
    ram(sim, 900);
    sim.s.getUpZ = sim.s.z;
    const e = until(sim, 'crash', null);
    expect(e?.cause === 'tree' || e?.cause === 'rock').toBe(true);
    expect(sim.s.crashed).toBe(true);
    expect(sim.s.fall).toBe(FALL_NONE);
    sim.revive();
    expect(sim.s.crashed).toBe(false);
    expect(sim.s.getUps).toBe(1);
  });

  it('a lit lantern takes the fall: a ward, and no get-up spent', () => {
    const sim = fresh();
    ram(sim, 900);
    sim.s.lantern = LANTERN;
    const e = until(sim, 'ward', null);
    expect(e).not.toBeNull();
    expect(sim.s.getUps).toBe(GET_UPS);
    expect(sim.s.falls).toBe(0);
    expect(sim.s.tumble).toBe(0);
  });

  it('a slow sled bounces off what a fast one falls on', () => {
    const slow = fresh();
    ram(slow, 900, 11);
    expect(until(slow, 'bump', null, 60)).not.toBeNull();
    expect(slow.s.falls).toBe(0);
    const fast = fresh();
    ram(fast, 900, 14);
    expect(until(fast, 'tumble', 'start', 60)).not.toBeNull();
  });
});

describe('the landing set', () => {
  /** Flies every leap of a mountain at `v` with the given thumbs, returning how each landing went. */
  function flights(m: number, v: number, input: (airTicks: number) => number): string[] {
    const out: string[] = [];
    const c = new Sim({ seed: MOUNTAINS[m].seed, chaos: PLAIN, sled: 0 }).course;
    for (const l of c.leaps) {
      const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: PLAIN, sled: 0 });
      const s = sim.s;
      s.z = l.z - 8;
      s.x = c.safeX(s.z);
      s.y = c.ground(s.x, s.z);
      s.vx = 0;
      s.vz = v;
      s.speed = v;
      s.heading = 0;
      s.velHeading = 0;
      s.vy = (v * (c.ground(s.x, s.z + 0.5) - s.y)) / 0.5;
      // (Past the free stretch in spirit: every get-up is there to be spent.)
      let flown = false;
      for (let t = 0; t < 600; t++) {
        sim.step(s.grounded ? packInput(4, false, false) : input(s.airTicks));
        if (!s.grounded) flown = true;
        const land = sim.events.find((e) => e.type === 'land' && e.airtime >= 0.75);
        const fell = sim.events.find((e) => (e.type === 'tumble' && e.phase === 'start') || e.type === 'crash');
        if (fell) {
          out.push('fall');
          break;
        }
        if (land && land.type === 'land') {
          out.push(land.quality);
          break;
        }
        if (flown && s.grounded && s.tumble === 0 && t > 300) break;
      }
    }
    return out;
  }

  it('a key held through a whole flight spins the sled and never wrecks the landing', () => {
    let n = 0;
    for (let m = 0; m < MOUNTAINS.length; m++) {
      for (const v of [22, 28, 34, 40]) {
        for (const steer of [0, 8]) {
          const got = flights(m, v, () => packInput(steer, false, false));
          n += got.length;
          expect(got, `${MOUNTAINS[m].id} at ${v} m/s`).not.toContain('fall');
        }
      }
    }
    expect(n).toBeGreaterThan(40);
  });

  it('a flip let go of is righted, and one short of its half is unwound in the set', () => {
    // A hold begun in the air for a third of a second (what a thumb that meant to crouch does), then nothing.
    let falls = 0;
    let n = 0;
    for (let m = 0; m < MOUNTAINS.length; m++) {
      for (const from of [10, 25, 40]) {
        const got = flights(m, 30, (a) => packInput(4, a >= from && a < from + 20, false));
        n += got.length;
        falls += got.filter((q) => q === 'fall').length;
      }
    }
    expect(n).toBeGreaterThan(20);
    expect(falls).toBe(0);
  });

  it('still wrecks a flip that comes down on its head', () => {
    // Held from the lip to the snow: wherever a flight ends mid-turn, the rider lands on its head.
    let falls = 0;
    for (let m = 0; m < MOUNTAINS.length; m++) for (const v of [24, 28, 32, 36]) falls += flights(m, v, (a) => packInput(4, a >= 2, false)).filter((q) => q === 'fall').length;
    expect(falls).toBeGreaterThan(0);
  });
});
