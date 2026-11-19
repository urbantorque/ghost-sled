import { describe, expect, it } from 'vitest';
import { classic } from '../scripts/playtest/labpilots';
import { PLAIN, type ChaosRoll } from '../src/sim/chaos';
import { CHUNK_LEN, courseFor } from '../src/sim/course';
import { packInput } from '../src/sim/input';
import { CARRY_GUTTER_TICKS, flamePace, momentPlays, rollForVariant } from '../src/sim/moments';
import { MOUNTAINS } from '../src/sim/mountains';
import { GET_UPS, LANTERN, Sim, TUMBLE_TICKS, type SimEvent } from '../src/sim/sim';

// Where round 7's two sim lanes met (notes/r7-simfix.md): a fall across a line, a botched landing under the
// grace after a get-up, and the flame of Lanternfall's carry when its rider falls. All under SIM_VERSION 9.

const idOf = (id: string): number => MOUNTAINS.findIndex((m) => m.id === id);

/** Sets the sled on the safe line at z, riding straight down it at v. */
function place(sim: Sim, z: number, v: number): void {
  const c = sim.course;
  const s = sim.s;
  s.z = z;
  s.x = c.safeX(z);
  s.y = c.ground(s.x, z);
  s.vx = 0;
  s.vz = v;
  s.speed = v;
  s.heading = 0;
  s.velHeading = 0;
  s.vy = (v * (c.ground(s.x, z + 0.5) - s.y)) / 0.5;
  s.grounded = true;
  s.invuln = 0;
  s.ghost = 0;
}

/** The next tick's collision is a hard hit, whatever stands there (the sim's own wipeout, inside its own step,
 *  so everything that reads the tick's events reads this one). */
function hitNext(sim: Sim): void {
  const any = sim as unknown as { collide: (z: number) => void; wipeout: (cause: string) => void };
  const real = any.collide;
  any.collide = () => {
    any.collide = real;
    any.wipeout('rock');
  };
}

/** A rider who holds the safe line in a tuck: the plainest way to ride at pace. */
function tuck(sim: Sim): number {
  const s = sim.s;
  const c = sim.course;
  if (!s.grounded || s.tumble > 0) return packInput(4, false, false);
  const look = s.z + 4 + s.speed * 0.35;
  const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.08;
  return packInput(Math.max(3, Math.min(5, Math.round(4 + err * 14))), true, false);
}

type Said = { tick: number; e: SimEvent; z: number; tumble: number };

/** Steps `sim` with `input` until `stop` says so (or `max` ticks), keeping every event with the sled at it. */
function run(sim: Sim, input: (sim: Sim) => number, stop: (sim: Sim, said: Said[]) => boolean, max = 60 * 60): Said[] {
  const said: Said[] = [];
  for (let i = 0; i < max && !sim.s.crashed; i++) {
    sim.step(input(sim));
    for (const e of sim.events) said.push({ tick: sim.tick, e, z: sim.s.z, tumble: sim.s.tumble });
    if (stop(sim, said)) break;
  }
  return said;
}

const hands = (): number => packInput(4, false, false);

describe('a fall across a line', () => {
  it('credits a stage line on the tick the falling sled slides over it, and gives the get-ups back there', () => {
    for (let m = 0; m < MOUNTAINS.length; m++) {
      const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: PLAIN, sled: 0 });
      const line = sim.course.stages[0].z1;
      place(sim, line - 3, 30);
      sim.s.getUps = 1;
      sim.s.getUpZ = sim.s.z;
      hitNext(sim);
      const said = run(sim, hands, (s) => s.s.tumble === 0 && s.s.falls > 0, 400);
      const fell = said.find((q) => q.e.type === 'tumble' && q.e.phase === 'start')!;
      const stage = said.find((q) => q.e.type === 'stage')!;
      expect(fell, MOUNTAINS[m].id).toBeDefined();
      expect(stage, `${MOUNTAINS[m].id}: the line is credited`).toBeDefined();
      // Falling, and within a tick's slide of the line: not when the rider is up again a second and a half on.
      expect(stage.tumble, MOUNTAINS[m].id).toBeGreaterThan(0);
      expect(stage.tick - fell.tick).toBeLessThan(30);
      expect(stage.z - line).toBeGreaterThanOrEqual(0);
      expect(stage.z - line).toBeLessThan(0.6);
      expect(sim.stageTicks[0]).toBe(stage.tick - 1);
      // The fall spent the last get-up short of the line; the line gives all three back, down in the snow or not.
      expect(said.some((q) => q.e.type === 'getUp' && q.e.why === 'stage' && q.tick === stage.tick)).toBe(true);
      expect(sim.s.getUps).toBe(GET_UPS);
    }
  });

  it('finishes the run on the tick a falling sled slides over the finish, and the fall plays to its end in the square', () => {
    for (let m = 0; m < MOUNTAINS.length; m++) {
      const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: PLAIN, sled: 0 });
      const c = sim.course;
      // (The earlier lines first: the sim counts them in order.)
      for (const st of c.stages.slice(0, -1)) {
        place(sim, st.z1 - 1, 30);
        run(sim, hands, (s) => s.stageTicks.length > c.stages.indexOf(st), 60);
      }
      place(sim, c.finishZ - 3, 30);
      // (Set pieces skipped past count as won and light the lantern: no ward here.)
      sim.s.lantern = 0;
      hitNext(sim);
      const said = run(sim, hands, (s, q) => s.finished && q.some((k) => k.e.type === 'tumble' && k.e.phase === 'end'), 400);
      const fell = said.find((q) => q.e.type === 'tumble' && q.e.phase === 'start')!;
      const fin = said.find((q) => q.e.type === 'finish')!;
      const up = said.find((q) => q.e.type === 'tumble' && q.e.phase === 'end')!;
      expect(fin, `${MOUNTAINS[m].id}: the finish is credited`).toBeDefined();
      expect(fin.tumble, MOUNTAINS[m].id).toBeGreaterThan(0);
      expect(fin.tick - fell.tick).toBeLessThan(30);
      expect(sim.s.finishTick).toBe(fin.tick - 1);
      // The rider is not stood up by the line: the fall is its whole length, and then the sled coasts.
      expect(up.tick - fell.tick).toBe(TUMBLE_TICKS);
      expect(up.tick).toBeGreaterThan(fin.tick);
      const z = sim.s.z;
      run(sim, hands, () => false, 120);
      expect(sim.s.z).toBeGreaterThan(z);
      expect(sim.s.tumble).toBe(0);
      expect(sim.s.crashed).toBe(false);
    }
  });

  it('a sled that comes to rest short of a line is credited when it rides over it', () => {
    const sim = new Sim({ seed: MOUNTAINS[0].seed, chaos: PLAIN, sled: 0 });
    const line = sim.course.stages[0].z1;
    place(sim, line - 40, 30);
    hitNext(sim);
    const said = run(sim, hands, (s) => s.stageTicks.length > 0, 600);
    const stage = said.find((q) => q.e.type === 'stage')!;
    expect(stage.tumble).toBe(0);
    expect(stage.z - line).toBeLessThan(1);
  });
});

describe('a botched landing', () => {
  /** A sled about to come down on its head off a real flight, a metre over the snow. */
  function headFirst(sim: Sim, z: number, v = 30): void {
    place(sim, z, v);
    const s = sim.s;
    s.grounded = false;
    s.y += 0.4;
    s.vy -= 6;
    s.airTicks = 60;
    s.airPitch = Math.PI;
    s.pitchRate = 0;
  }
  const landing = (said: Said[]): Extract<SimEvent, { type: 'land' }> | undefined => said.map((q) => q.e).find((e): e is Extract<SimEvent, { type: 'land' }> => e.type === 'land');

  it('is always said: as a fall, as a ward, and in the grace after a get-up, where it used to pass without a word', () => {
    for (const how of ['fall', 'ward', 'grace'] as const) {
      const sim = new Sim({ seed: MOUNTAINS[0].seed, chaos: PLAIN, sled: 0 });
      headFirst(sim, 900);
      if (how === 'ward') sim.s.lantern = LANTERN;
      if (how === 'grace') sim.s.invuln = 100;
      const said = run(sim, hands, (s) => s.s.grounded, 60);
      const land = landing(said);
      expect(land, how).toBeDefined();
      expect(land!.quality, how).toBe('sketchy');
      expect(land!.botched, how).toBe(true);
      expect(land!.late).toBe(false);
      expect(said.some((q) => q.e.type === 'tumble'), how).toBe(how === 'fall');
      expect(said.some((q) => q.e.type === 'ward'), how).toBe(how === 'ward');
      // Nothing is scored for it, whatever became of it.
      expect(said.some((q) => q.e.type === 'style' && (q.e.kind === 'air' || q.e.kind === 'flip' || q.e.kind === 'clean')), how).toBe(false);
      expect(sim.stats.sketchies).toBe(0);
    }
  });

  /** A set piece decided by its landing, met in the grace after a get-up (or with a lantern lit) by a rider who
   *  comes down on its head: it is lost on that tick, not at the set piece's far end. */
  function decided(mountain: string, verb: string, how: 'grace' | 'ward'): { lost: Said | undefined; land: Said | undefined; z1: number } {
    const m = idOf(mountain);
    const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: PLAIN, sled: 0 });
    const p = sim.plays.find((q) => q.verb === verb)!;
    // Meet the set pieces above it first, then ride into this one and off its lip.
    for (const q of sim.plays) {
      if (q.index >= p.index) break;
      place(sim, q.z1 - 1, 30);
      run(sim, hands, (s) => s.mo.next > q.index && s.mo.active < 0, 600);
    }
    place(sim, p.z0 - 2, 44);
    run(sim, hands, (s) => s.mo.active === p.index, 30);
    expect(sim.mo.active, `${mountain}: the set piece began`).toBe(p.index);
    place(sim, p.lip - 6, 46);
    run(sim, hands, (s) => !s.s.grounded && s.s.z > p.lip + 8, 120);
    expect(sim.mo.active, `${mountain}: still playing in the air`).toBe(p.index);
    // Upside down from here to the snow, and untouchable or warded when it gets there.
    const said = run(
      sim,
      (s) => {
        s.s.airPitch = Math.PI;
        s.s.pitchRate = 0;
        if (how === 'grace') s.s.invuln = 100;
        else s.s.lantern = LANTERN;
        return hands();
      },
      (s) => s.s.grounded,
      600,
    );
    return { lost: said.find((q) => q.e.type === 'moment' && q.e.phase === 'lost'), land: said.find((q) => q.e.type === 'land'), z1: p.z1 };
  }

  it('decides the surge and the flourish as it lands, under the grace or a ward', () => {
    for (const [mountain, verb] of [['ember', 'surge'], ['sakura', 'flourish']] as const) {
      for (const how of ['grace', 'ward'] as const) {
        const { lost, land, z1 } = decided(mountain, verb, how);
        expect(land, `${verb} ${how}: the landing is said`).toBeDefined();
        expect(lost, `${verb} ${how}: decided`).toBeDefined();
        expect(lost!.tick, `${verb} ${how}: on the tick it landed`).toBe(land!.tick);
        expect(lost!.z).toBeLessThan(z1 - 1);
      }
    }
  });
});

describe('the carry and a fall', () => {
  const M = idOf('lanternfall');
  const course = courseFor(MOUNTAINS[M].seed);
  const rollOf = (variant: number): ChaosRoll => rollForVariant(course, PLAIN, variant);

  /** A sim with the carry just begun: the sled at the shrine on the safe line at `v`. */
  function atShrine(variant: number, v = 36): { sim: Sim; index: number } {
    const sim = new Sim({ seed: MOUNTAINS[M].seed, chaos: rollOf(variant), sled: 0 });
    const p = sim.plays.find((q) => q.verb === 'carry')!;
    for (const st of sim.course.stages.slice(0, -1)) {
      place(sim, st.z1 - 1, 30);
      run(sim, hands, (s) => s.stageTicks.length > sim.course.stages.indexOf(st), 60);
    }
    for (const q of sim.plays) {
      if (q.index >= p.index) break;
      place(sim, q.z1 - 1, 30);
      run(sim, hands, (s) => s.mo.next > q.index && s.mo.active < 0, 600);
    }
    place(sim, p.z0 - 1, v);
    run(sim, tuck, (s) => s.mo.active === p.index, 30);
    expect(sim.mo.active).toBe(p.index);
    return { sim, index: p.index };
  }
  const phases = (said: Said[]): string[] => said.filter((q) => q.e.type === 'moment' && q.e.phase !== 'step').map((q) => (q.e as Extract<SimEvent, { type: 'moment' }>).phase);
  const won = (sim: Sim, index: number): boolean => ((sim.stats.momentMask >> index) & 1) === 1;
  /** Rides the carry in a tuck, with a hard hit at each of `at` (metres down the course). */
  function carry(variant: number, at: number[], opts: { lantern?: boolean; v?: number; input?: (sim: Sim) => number } = {}): { sim: Sim; index: number; said: Said[] } {
    const { sim, index } = atShrine(variant, opts.v);
    const left = [...at];
    const said = run(
      sim,
      (s) => {
        if (left.length && s.s.z >= left[0] && s.s.grounded && s.s.tumble === 0 && s.mo.active === index) {
          left.shift();
          s.s.invuln = 0;
          s.s.lantern = opts.lantern ? LANTERN : 0;
          hitNext(s);
        }
        return (opts.input ?? tuck)(s);
      },
      (s) => s.finished || s.mo.active !== index,
      60 * 90,
    );
    return { sim, index, said };
  }

  it('holds what a guttering flame needs in every variant', () => {
    for (let v = 0; v < 3; v++) {
      const p = momentPlays(course, rollOf(v)).find((q) => q.verb === 'carry')!;
      expect(p.gutter).toBe(CARRY_GUTTER_TICKS);
      expect(p.gutter / 60).toBeCloseTo(4, 0);
      expect(p.fall).toBeGreaterThan(0);
      expect(p.fall).toBeLessThan(p.hit);
      expect(p.kindle.length).toBeGreaterThan(p.z1 - p.z0 - 1);
      // The pace is one a rider just up can ride back to: on the steep chute a few seconds of clean riding from
      // half of cruise, and in the flat square, where nothing can be gained, less than a get-up's own push.
      const cruise = new Sim({ seed: MOUNTAINS[M].seed, chaos: PLAIN, sled: 0 }).cruiseSpeed();
      for (let z = p.z0; z < p.z1; z += 5) {
        expect(flamePace(p, z), `z ${z}`).toBeGreaterThan(5);
        expect(flamePace(p, z), `z ${z}`).toBeLessThan(0.85 * cruise);
        if (course.section(z).kind === 'finish' && z > p.z1 - 180) expect(flamePace(p, z)).toBeLessThan(0.5 * cruise);
      }
    }
  });

  it('a rider at pace lights the great lantern, and still does after a fall or a ward on the way', () => {
    for (let v = 0; v < 2; v++) {
      const clean = carry(v, []);
      expect(won(clean.sim, clean.index), `variant ${v}: clean`).toBe(true);
      const p = clean.sim.plays[clean.index];
      let fallsWon = 0;
      // (Round 8: the shrine's chute is 50 m shorter since the stage lines' thresholds and a drop 110 m down it flies a
      // sled to the last leap's run-in, so the falls on it are at +20 and +40, on the chute's snow above the drop: one
      // nearer it gets up on the drop's lip and comes down too slow to catch, as round 7's fall just above the last lip.)
      for (const z of [p.z0 + 20, p.z0 + 40, p.z0 + 520, p.z1 - 220, p.z1 - 90]) {
        for (const lantern of [false, true]) {
          const r = carry(v, [z], { lantern });
          const tag = `variant ${v}, a ${lantern ? 'ward' : 'fall'} at ${Math.round(z)}`;
          // It gutters and it catches, wherever it was. A rider who only tucks (a second and a bit in hand at
          // the line) still lights the lantern after any ward, and after most falls.
          expect(phases(r.said).slice(0, 2), tag).toEqual(['trail', 'lead']);
          if (lantern) expect(won(r.sim, r.index), tag).toBe(true);
          else if (won(r.sim, r.index)) fallsWon++;
          expect(r.said.some((q) => q.e.type === (lantern ? 'ward' : 'tumble')), tag).toBe(true);
        }
      }
      // (A fall just above the last lip leaves no speed for its flight, and in the wind the flame is half a
      // second shorter: those are made up by more than a tuck, a dash say, or not at all.)
      expect(fallsWon, `variant ${v}`).toBeGreaterThanOrEqual(v === 0 ? 4 : 2);
    }
  });

  it('gutters on the tick of the fall, waits while it gutters, and catches within four seconds of riding again', () => {
    const { sim, index } = atShrine(0);
    const p = sim.plays[index];
    run(sim, tuck, (s) => s.s.z > p.z0 + 30 && s.s.grounded, 600);
    const before = sim.mo.pace;
    hitNext(sim);
    const said = run(sim, tuck, (s) => s.mo.at === 0, 60 * 10);
    const fell = said.find((q) => q.e.type === 'tumble' && q.e.phase === 'start')!;
    const up = said.find((q) => q.e.type === 'tumble' && q.e.phase === 'end')!;
    const trail = said.find((q) => q.e.type === 'moment' && q.e.phase === 'trail')!;
    const lead = said.find((q) => q.e.type === 'moment' && q.e.phase === 'lead')!;
    expect(trail.tick).toBe(fell.tick);
    expect(lead.tick).toBeGreaterThan(up.tick);
    expect(lead.tick - up.tick).toBeLessThanOrEqual(CARRY_GUTTER_TICKS);
    expect(sim.s.speed).toBeGreaterThanOrEqual(flamePace(p, sim.s.z));
    // Guttering took a bite and no more: the flame is back near what it was, never above a full one.
    expect(sim.mo.pace).toBeGreaterThan(before - p.fall - 0.25);
    expect(sim.mo.pace).toBeLessThanOrEqual(1);
    expect(sim.mo.active).toBe(index);
  });

  it('holds its level while it gutters: the clock waits for a rider in the snow', () => {
    const { sim, index } = atShrine(0);
    const p = sim.plays[index];
    run(sim, tuck, (s) => s.s.z > p.z0 + 30 && s.s.grounded, 600);
    hitNext(sim);
    run(sim, tuck, (s) => s.mo.at > 0, 5);
    expect(sim.mo.at).toBe(p.gutter);
    const level = sim.mo.pace;
    // The whole fall: the count does not run until the rider is riding again, and the flame does not burn.
    run(sim, tuck, (s) => s.s.tumble === 1, 200);
    expect(sim.mo.at).toBe(p.gutter);
    expect(sim.mo.pace).toBe(level);
  });

  it('a second fall while it gutters puts it out', () => {
    const { sim, index } = atShrine(0);
    const p = sim.plays[index];
    run(sim, tuck, (s) => s.s.z > p.z0 + 30 && s.s.grounded, 600);
    hitNext(sim);
    // Up again, held under the pace, and down again.
    run(sim, tuck, (s) => s.mo.at > 0 && s.s.tumble === 0, 300);
    expect(sim.mo.at).toBeGreaterThan(0);
    sim.s.invuln = 0;
    hitNext(sim);
    const said = run(sim, hands, (s) => s.mo.active !== index, 5);
    expect(phases(said)).toEqual(['lost']);
    expect(sim.mo.pace).toBe(0);
    expect(won(sim, index)).toBe(false);
  });

  it('a rider who does not get back to pace in time loses it', () => {
    // Snaking down the chute with the brake of a held turn: never near the pace.
    let t = 0;
    const slow = (s: Sim): number => (s.s.tumble > 0 || !s.s.grounded ? hands() : packInput(Math.floor(t++ / 40) % 2 ? 8 : 0, false, false));
    const { sim, index } = atShrine(0);
    const p = sim.plays[index];
    run(sim, tuck, (s) => s.s.z > p.z0 + 60 && s.s.grounded, 600);
    hitNext(sim);
    const said = run(sim, slow, (s) => s.mo.active !== index, 60 * 20);
    const up = said.find((q) => q.e.type === 'tumble' && q.e.phase === 'end')!;
    const lost = said.find((q) => q.e.type === 'moment' && q.e.phase === 'lost')!;
    expect(phases(said)).toEqual(['trail', 'lost']);
    // (Four seconds of riding, the tick it got up the first of them.)
    expect(lost.tick - up.tick + 1).toBe(CARRY_GUTTER_TICKS);
  });

  it('a flame still guttering at the line lights nothing', () => {
    const { sim, index } = atShrine(0);
    const p = sim.plays[index];
    const { sim: late, index: i, said } = carry(0, [p.z1 - 4]);
    expect(sim.mo.active).toBe(index);
    expect(late.finished).toBe(true);
    expect(phases(said)).toEqual(['trail', 'lost']);
    expect(won(late, i)).toBe(false);
  });

  it('never leaves a rider better off: with a fall the flame reaches the line lower, and a rider behind the flame stays behind', () => {
    for (let v = 0; v < 2; v++) {
      const clean = carry(v, []);
      const p = clean.sim.plays[clean.index];
      const flameAtLine = (r: { said: Said[] }): number => {
        const end = r.said.find((q) => q.e.type === 'moment' && (q.e.phase === 'won' || q.e.phase === 'lost'))!;
        return (end.e as Extract<SimEvent, { type: 'moment' }>).n;
      };
      for (const z of [p.z0 + 40, p.z0 + 300, p.z0 + 520, p.z1 - 150]) {
        for (const lantern of [false, true]) {
          const r = carry(v, [z], { lantern });
          expect(flameAtLine(r), `variant ${v} at ${Math.round(z)}`).toBeLessThanOrEqual(flameAtLine(clean));
          expect(r.sim.tick, 'and the run is slower for it').toBeGreaterThan(clean.sim.tick);
        }
      }
      // Hands off from a slow start: the flame burns out short of the line, and no fall on the way changes that.
      const coast = carry(v, [], { v: 20, input: hands });
      expect(won(coast.sim, coast.index), `variant ${v}: a slow coast`).toBe(false);
      for (const z of [p.z0 + 60, p.z0 + 300, p.z1 - 300]) {
        const r = carry(v, [z], { v: 20, input: hands });
        expect(won(r.sim, r.index), `variant ${v}: a slow coast with a fall at ${Math.round(z)}`).toBe(false);
      }
    }
  });

  it('replays: a run with a guttered flame hashes the same from its record', () => {
    const a = carry(1, [course.finishZ - 500]);
    const b = carry(1, [course.finishZ - 500]);
    expect(b.sim.hash()).toBe(a.sim.hash());
    expect(b.sim.tick).toBe(a.sim.tick);
  });
});

describe('room beside the line where a sled cannot hold it', () => {
  const SEEDS = [...MOUNTAINS.map((m) => m.seed), 0x2026b10c, 0x7e57ab1e, 0x0ddba11];
  /** The least gap between any hard obstacle's edge and the safe line, over the obstacles standing from z0 to z1. */
  function room(seed: number, z0: number, z1: number): number {
    const c = courseFor(seed);
    let least = Infinity;
    for (let k = Math.max(0, Math.floor(z0 / CHUNK_LEN) - 1); k <= Math.floor(z1 / CHUNK_LEN) + 1; k++) {
      for (const o of c.chunk(k).obstacles) {
        if (o.soft) continue;
        for (const [x, z] of [[o.x, o.z], [o.x2, o.z2]] as const) {
          if (z + o.r <= z0 || z - o.r >= z1) continue;
          const gap = Math.abs(x - c.safeX(z)) - o.r;
          if (gap < least) least = gap;
        }
      }
    }
    return least;
  }

  it("keeps five and a half metres either side of the line for 80 m above every leap's lip", () => {
    let n = 0;
    for (const seed of SEEDS) {
      for (const l of courseFor(seed).leaps) {
        n++;
        expect(room(seed, l.z - 80, l.z - 2), `seed ${seed.toString(16)} leap at ${Math.round(l.z)}`).toBeGreaterThanOrEqual(5.5);
      }
    }
    expect(n).toBeGreaterThanOrEqual(3 * SEEDS.length);
  });

  it('keeps the same room through every mogul field and for 30 m past it', () => {
    let n = 0;
    for (const seed of SEEDS) {
      const c = courseFor(seed);
      for (let k = 0; k <= Math.ceil(c.finishZ / CHUNK_LEN); k++) {
        for (const m of c.zones(k).moguls) {
          n++;
          expect(room(seed, m.z0 - 4, m.z1 + 30), `seed ${seed.toString(16)} field at ${Math.round(m.z0)}`).toBeGreaterThanOrEqual(5.5);
        }
      }
    }
    // (Round 8: the thresholds took plain ground, and mogul fields with it: at least one a seed.)
    expect(n).toBeGreaterThanOrEqual(SEEDS.length - 2);
  });

  it("the careful line rides every mountain's plain day without a fall or a ward", () => {
    // (The lab's line pilot, which is the fairness test's driver with the lab's air: it used to spin, and came
    // down ten metres wide. On the line and in the air with its hands still, nothing touches it.)
    for (let m = 0; m < MOUNTAINS.length; m++) {
      const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: PLAIN, sled: 0 });
      const pilot = classic('line', sim, 1234, {});
      let hits = 0;
      while (!sim.finished && !sim.s.crashed && sim.tick < 240 * 60) {
        const o = pilot();
        sim.step(packInput(o.steer, o.action, false));
        for (const e of sim.events) if (e.type === 'ward' || e.type === 'crash' || (e.type === 'tumble' && e.phase === 'start')) hits++;
      }
      expect(sim.finished, MOUNTAINS[m].id).toBe(true);
      expect(hits, MOUNTAINS[m].id).toBe(0);
    }
  });
});
