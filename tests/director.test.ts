import { describe, expect, it } from 'vitest';
import { POP_DEFER, type Beat, type BeatOf } from '../src/game/beats';
import { Director, type DirectorFrame, type DirectorRun } from '../src/game/director';
import type { GhostPose, GhostTrack, RaceEvent } from '../src/game/ghosts';
import { emptyPose } from '../src/game/ghosts';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import type { StyleKind } from '../src/sim/scoring';
import type { Sim, SimEvent } from '../src/sim/sim';

// Synthetic batches through the director: the order rules (a 'perfect' style before its land, a bank
// before its bump, a lost combo before its crash), the once-per-run milestones, finales and pops.

interface FakeSim {
  tick: number;
  score: number;
  distance: number;
  s: {
    x: number; y: number; z: number; heading: number; speed: number; grounded: boolean; drifting: boolean; driftCharge: number; driftTier: number;
    driftDir: number; drafting: boolean; flow: number; crashed: boolean;
  };
  combo: { active: boolean; pending: number; multiplier: number; window: number; timer: number };
  dyn: {
    triggerZ: number;
    avalanche: { phase: number };
    yeti: { phase: number; hopped: boolean };
    storm: Array<{ z: number; collected: boolean }>;
    stormPhase: number;
    trainPhase: number;
  };
  stats: { yetiHop: boolean; draftTicks: number };
}

function fakeSim(): FakeSim {
  return {
    tick: 1000,
    score: 0,
    distance: 100,
    s: { x: 0, y: 0, z: 100, heading: 0, speed: 20, grounded: true, drifting: false, driftCharge: 0, driftTier: 0, driftDir: 0, drafting: false, flow: 0, crashed: false },
    combo: { active: false, pending: 0, multiplier: 1, window: 156, timer: 0 },
    dyn: { triggerZ: Infinity, avalanche: { phase: 0 }, yeti: { phase: 0, hopped: false }, storm: [], stormPhase: 0, trainPhase: 0 },
    stats: { yetiHop: false, draftTicks: 0 },
  };
}

function runOf(over: Partial<DirectorRun> = {}): DirectorRun {
  return {
    mood: Mood.None,
    event: ChaosEvent.None,
    triggerZ: Infinity,
    hasReveal: false,
    revealLeaveS: 0,
    bestDistAtStart: 0,
    bestScoreAtStart: 0,
    bestComboAtStart: 0,
    grudgeAtStart: null,
    friend: null,
    lifetimePassed: 0,
    unlockLadder: [],
    missionsCrossed: () => [],
    ...over,
  };
}

function track(id: number, kind: GhostTrack['entry']['kind'] = 'pool', name = `G${id}`): GhostTrack {
  return { entry: { id, name, kind, score: 0, record: '' }, ready: true, frames: null, samples: 1, ticks: 0, crashTick: -1, distance: 0, tricks: null, status: 0, passed: false, passedTimes: 0, crashSeen: false };
}

function pose(z: number, x = 0, done = false): GhostPose {
  const p = emptyPose();
  p.z = z;
  p.x = x;
  p.done = done;
  return p;
}

class Rig {
  readonly d = new Director(() => false);
  readonly sim = fakeSim();
  tracks: GhostTrack[] = [];
  poses = new Map<number, GhostPose | null>();
  passed = 0;
  rank = 1;
  of = 1;
  constructor(run: Partial<DirectorRun> = {}) {
    this.d.beginRun(runOf(run));
  }
  /** One frame: advance `ticks`, drain `events` (all at the frame's last tick unless given). */
  frame(events: Array<SimEvent | { tick: number; e: SimEvent }> = [], o: { ticks?: number; dt?: number; race?: RaceEvent[]; phase?: 'run' | 'crashed'; reduced?: boolean; timeToLand?: number; airTicks?: number } = {}): Beat[] {
    this.sim.tick += o.ticks ?? 1;
    const f: DirectorFrame = {
      phase: o.phase ?? 'run',
      dt: o.dt ?? 1 / 60,
      sim: this.sim as unknown as Sim,
      events: events.map((e) => ('e' in e ? e : { tick: this.sim.tick, e })),
      race: o.race ?? [],
      tracks: this.tracks,
      poses: this.poses,
      standings: { next: null, rank: this.rank, of: this.of },
      passedThisRun: this.passed,
      settledPassed: 0,
      timeToLand: o.timeToLand ?? Infinity,
      airTicks: o.airTicks ?? 0,
      reduced: o.reduced ?? false,
    };
    return [...this.d.step(f).beats];
  }
  /** Idle frames for `secs` seconds. */
  idle(secs: number): Beat[] {
    const out: Beat[] = [];
    for (let i = 0; i < Math.round(secs * 60); i++) out.push(...this.frame());
    return out;
  }
}

const of = <T extends Beat['type']>(beats: Beat[], t: T) => beats.filter((b): b is BeatOf<T> => b.type === t);
const style = (kind: Extract<SimEvent, { type: 'style' }>['kind'], points = 100, chain = 2, extra: Partial<Extract<SimEvent, { type: 'style' }>> = {}): SimEvent => ({ type: 'style', kind, points, chain, mult: 1, ...extra });
const land = (quality: 'perfect' | 'clean' | 'sketchy' | 'hop', late = false): SimEvent => ({ type: 'land', quality, airtime: 1, halfTurns: 0, flips: 0, impact: 5, late });

describe('stomps', () => {
  it('[style perfect, boost, land perfect] is one stomp beat with the streak', () => {
    const r = new Rig();
    const a = r.frame([style('perfect', 300), { type: 'boost', amount: 3, source: 'perfect' }, land('perfect')]);
    const s1 = of(a, 'stomp');
    expect(s1).toHaveLength(1);
    // 'PERFECT LANDING' over 'STOMP +300': never 'Perfect' twice on one stamp.
    expect(s1[0]).toMatchObject({ streak: 1, late: false, title: 'Perfect landing', lead: [{ label: 'Stomp', points: 300 }] });
    expect(of(a, 'callout')).toHaveLength(0);
    r.idle(1);
    const b = r.frame([style('perfect', 280), { type: 'boost', amount: 3, source: 'perfect' }, land('perfect')]);
    // 'DOUBLE STOMP' over 'PERFECT +280': the title counts the streak, the lead names the landing.
    expect(of(b, 'stomp')[0]).toMatchObject({ streak: 2, title: 'Double stomp', lead: [{ label: 'Perfect', points: 280 }] });
    for (let i = 0; i < 2; i++) {
      r.idle(1);
      r.frame([style('perfect', 250), land('perfect')]);
    }
    r.idle(1);
    const five = of(r.frame([style('perfect', 250), land('perfect')]), 'stomp')[0];
    expect(five).toMatchObject({ streak: 5, title: 'Stomp streak 5', lead: [{ label: 'Perfect', points: 250 }] });
  });

  it('a late stomp is a single stomp that counts once', () => {
    const r = new Rig();
    r.frame([style('perfect', 300), land('perfect')]);
    r.idle(1);
    const t0 = r.sim.tick + 1;
    const a = r.frame([style('clean', 80), { tick: t0, e: land('clean') }]);
    expect(of(a, 'stomp')).toHaveLength(0);
    const b = r.frame([style('perfect', 220), { type: 'boost', amount: 2, source: 'perfect' }, land('perfect', true)], { ticks: 3 });
    const st = of(b, 'stomp');
    expect(st).toHaveLength(1);
    expect(st[0]).toMatchObject({ streak: 2, late: true });
    r.idle(0.5);
    expect(r.d.bestStreak).toBe(2);
  });

  it('a sketchy landing after 3 says Streak broken instead of Sketchy', () => {
    const r = new Rig();
    for (let i = 0; i < 3; i++) {
      r.frame([style('perfect'), land('perfect')]);
      r.idle(0.5);
    }
    const a = r.frame([land('sketchy')]);
    expect(of(a, 'streakBroken')[0]).toMatchObject({ was: 3, say: { label: 'Streak broken', tone: 'lost' } });
    expect(of(a, 'callout')).toHaveLength(0);
    const b = r.frame([land('sketchy')]);
    expect(of(b, 'callout')[0].say.label).toBe('Sketchy');
  });

  it('the hit-stop grows with the streak and is skipped under reduced motion', () => {
    const r = new Rig();
    r.frame([style('perfect'), land('perfect')]);
    r.d.time.step(0.01);
    expect(r.d.time.feed).toBeCloseTo(0.35);
    const q = new Rig();
    q.frame([style('perfect'), land('perfect')], { reduced: true });
    q.d.time.step(0.01);
    expect(q.d.time.feed).toBe(1);
  });
});

describe('near misses', () => {
  it('grades a Whisker by gap and speed', () => {
    const r = new Rig();
    r.sim.s.speed = 20;
    const a = r.frame([style('nearMiss', 120, 2, { gap: 0.2, side: -1, x: 3, z: 104, obs: 'pine', id: 5 })]);
    expect(of(a, 'nearMiss')[0]).toMatchObject({ grade: 'whisker', side: -1, say: { label: 'Whisker', tone: 'big', points: 120 } });
    r.sim.s.speed = 15;
    const b = r.frame([style('nearMiss', 84, 3, { gap: 0.2, side: 1, x: 3, z: 104, obs: 'rock', id: 6 })]);
    expect(of(b, 'nearMiss')[0]).toMatchObject({ grade: 'near', say: { label: 'Near miss' } });
    r.sim.s.speed = 25;
    const c = r.frame([style('nearMiss', 60, 4, { gap: 0.6, side: 1, x: 3, z: 104, obs: 'rock', id: 7 })]);
    expect(of(c, 'nearMiss')[0].grade).toBe('near');
    expect(of([...a, ...b, ...c], 'callout')).toHaveLength(0);
  });
});

describe('banks, flow and lost combos', () => {
  /** A long, varied combo: sim flow and earned flow both high. */
  function flowUp(r: Rig): Beat[] {
    const out: Beat[] = [];
    const kinds = ['carve', 'air', 'spin', 'nearMiss', 'perfect', 'gate'] as const;
    r.sim.s.flow = 6;
    for (let i = 0; i < 26; i++) out.push(...r.frame([style(kinds[i % kinds.length], 100, i + 1, kinds[i % kinds.length] === 'nearMiss' ? { gap: 0.9, side: 1, x: 0, z: 0, obs: 'rock', id: i } : {})]));
    out.push(...r.idle(0.6));
    return out;
  }

  it("'In the flow' once, with 3 or more non-draft kinds", () => {
    const r = new Rig();
    const a = flowUp(r);
    const ins = of(a, 'flow').filter((b) => b.phase === 'in');
    expect(ins).toHaveLength(1);
    expect(ins[0].say).toMatchObject({ label: 'In the flow', tone: 'big' });
    expect(r.frame().length).toBe(0);
  });

  it("'In the flow' at an expert's 3.0: 13 varied moves with the sim's flow at 4 (not 11), the glow full at 3.5", () => {
    const run = (moves: number): { beats: Beat[]; fk: number } => {
      const r = new Rig();
      r.sim.s.flow = 4;
      const kinds = ['carve', 'air', 'spin', 'gate'] as const;
      const beats: Beat[] = [];
      for (let i = 0; i < moves; i++) beats.push(...r.frame([style(kinds[i % kinds.length], 100, i + 1)]));
      beats.push(...r.idle(1.5));
      const fk = (r.d as unknown as { out: { feel: { flow: number }; audio: { flow: number } } }).out;
      expect(fk.audio.flow).toBe(fk.feel.flow);
      return { beats, fk: fk.feel.flow };
    };
    const a = run(13);
    expect(of(a.beats, 'flow').filter((b) => b.phase === 'in')).toHaveLength(1);
    expect(a.fk).toBeGreaterThan(0.95);
    const b = run(11);
    expect(of(b.beats, 'flow')).toHaveLength(0);
    expect(run(14).fk).toBeCloseTo(1, 3);
  });

  it("'In the flow' on the 3.0 plateau: a chain of 12 with the sim's flow at 3 crosses 2.9", () => {
    const r = new Rig();
    r.sim.s.flow = 3;
    const kinds = ['carve', 'air', 'spin', 'gate'] as const;
    const beats: Beat[] = [];
    for (let i = 0; i < 12; i++) beats.push(...r.frame([style(kinds[i % kinds.length], 100, i + 1)]));
    beats.push(...r.idle(1.5));
    // The shown flow sits just under 3 (it approaches from below) and the line is 2.9.
    expect((r.d as unknown as { flowShown: number }).flowShown).toBeLessThan(3);
    expect(of(beats, 'flow').filter((b) => b.phase === 'in')).toHaveLength(1);
  });

  it("jumps and landings alone glow but never name 'In the flow': it wants a spin, a flip or a gate", () => {
    const ride = (kinds: readonly StyleKind[]): { ins: number; shown: number } => {
      const r = new Rig();
      r.sim.s.flow = 3;
      const beats: Beat[] = [];
      for (let i = 0; i < 12; i++) beats.push(...r.frame([style(kinds[i % kinds.length], 100, i + 1)]));
      beats.push(...r.idle(1.5));
      return { ins: of(beats, 'flow').filter((b) => b.phase === 'in').length, shown: (r.d as unknown as { flowShown: number }).flowShown };
    };
    // A novice in the bunch's held combo: air, clean and perfect landings, carves, near misses.
    const novice = ride(['air', 'clean', 'perfect', 'carve', 'nearMiss']);
    expect(novice.shown).toBeGreaterThan(2.9);
    expect(novice.ins).toBe(0);
    expect(ride(['air', 'perfect', 'spin']).ins).toBe(1);
    expect(ride(['air', 'perfect', 'flip']).ins).toBe(1);
    expect(ride(['gate', 'air', 'perfect']).ins).toBe(1);
  });

  it('a slingshot is the pack speed: no skill step and no kind', () => {
    const r = new Rig();
    r.sim.s.flow = 6;
    const beats: Beat[] = [];
    // Slingshots, a draft and two moves: never 3 kinds, and the earned cap counts the moves alone.
    const seq = ['slingshot', 'draft', 'slingshot', 'air', 'slingshot', 'clean', 'slingshot', 'slingshot', 'slingshot', 'slingshot', 'slingshot', 'slingshot', 'slingshot', 'slingshot'] as const;
    seq.forEach((k, i) => beats.push(...r.frame([style(k, 50, i + 1)])));
    beats.push(...r.idle(1.5));
    const d = r.d as unknown as { skillChain: number; earnCap: number; kinds: Set<string> };
    expect(d.skillChain).toBe(2);
    expect(d.earnCap).toBeCloseTo(0.5);
    expect([...d.kinds].sort()).toEqual(['air', 'clean']);
    expect(of(beats, 'flow')).toHaveLength(0);
  });

  it("a sketchy landing snuffs flow from 1.2: 'Flow broken' is its line, and the earning starts over", () => {
    const r = new Rig();
    r.sim.s.flow = 3;
    for (let i = 0; i < 8; i++) r.frame([style(i % 2 ? 'carve' : 'air', 100, i + 1)]);
    r.idle(1.5);
    const a = r.frame([style('air', 60, 9), land('sketchy')]);
    // A loss line, as the 'Sketchy' it stands in for (a plain line would stay out of the one slot).
    expect(of(a, 'flow')[0]).toMatchObject({ phase: 'snuff', say: { label: 'Flow broken', tone: 'lost' } });
    // One line for the landing: no 'Sketchy' under it (the air it caught keeps its own callout).
    expect(of(a, 'callout').map((c) => c.source)).toEqual(['air']);
    r.idle(0.3);
    const d = r.d as unknown as { out: { feel: { flow: number } }; earnCap: number; kinds: Set<string>; flowShown: number };
    expect(d.out.feel.flow).toBe(0);
    expect(d.earnCap).toBe(0);
    expect(d.kinds.size).toBe(0);
    // The combo rides on: the next move earns from nothing, not from the 9 before the snuff.
    r.frame([style('spin', 100, 10)]);
    r.idle(1);
    expect(d.earnCap).toBeCloseTo(0.25);
    expect(d.flowShown).toBeLessThan(0.3);
    // A sketchy landing under 1.2 shown is just Sketchy.
    const b = r.frame([land('sketchy')]);
    expect(of(b, 'flow')).toHaveLength(0);
    expect(of(b, 'callout')[0].say.label).toBe('Sketchy');
  });

  it('a sketchy landing that breaks a streak snuffs flow without a second line', () => {
    const r = new Rig();
    r.sim.s.flow = 3;
    for (let i = 0; i < 3; i++) {
      r.frame([style('perfect', 250, i * 2 + 1), land('perfect')]);
      r.frame([style('carve', 100, i * 2 + 2)]);
      r.idle(0.5);
    }
    const a = r.frame([land('sketchy')]);
    expect(of(a, 'streakBroken')).toHaveLength(1);
    const snuff = of(a, 'flow');
    expect(snuff).toHaveLength(1);
    expect(snuff[0].phase).toBe('snuff');
    expect(snuff[0].say).toBeUndefined();
  });

  it("a lost combo (the crash) snuffs the flow without words: no 'Flow broken' line over the crash", () => {
    const r = new Rig();
    flowUp(r);
    const t = r.sim.tick + 1;
    r.sim.s.crashed = true;
    const b = r.frame([
      { tick: t, e: { type: 'comboLost', points: 3000 } },
      { tick: t, e: { type: 'crash', cause: 'tree' } },
    ]);
    const snuff = of(b, 'flow');
    expect(snuff).toHaveLength(1);
    expect(snuff[0].phase).toBe('snuff');
    expect(snuff[0].say).toBeUndefined();
    expect(of(b, 'comboLost')[0].say?.label).toBe('Combo lost');
    r.idle(0.2);
    expect((r.d as unknown as { out: { feel: { flow: number } } }).out.feel.flow).toBe(0);
    // Under 1.2 shown, a crash snuffs nothing.
    const q = new Rig();
    const c = q.frame([{ type: 'comboLost', points: 300 }, { type: 'crash', cause: 'tree' }]);
    expect(of(c, 'flow')).toHaveLength(0);
  });

  it('a bump snuffs flow from 1.2', () => {
    const r = new Rig();
    r.sim.s.flow = 2;
    for (let i = 0; i < 6; i++) r.frame([style(i % 2 ? 'carve' : 'air', 100, i + 1)]);
    r.idle(1.5);
    const t = r.sim.tick + 1;
    const a = r.frame([
      { tick: t, e: { type: 'comboBank', points: 600, mult: 2 } },
      { tick: t, e: { type: 'bump', id: 77 } },
    ]);
    expect(of(a, 'flow')[0]).toMatchObject({ phase: 'snuff', say: { label: 'Flow broken' } });
  });

  it("a slingshot's boost and a slipstream say drafting to the drive; other boosts do not", () => {
    const r = new Rig();
    const s = r.sim.s as typeof r.sim.s & { boostPool: number };
    const drafting = () => (r.d as unknown as { out: { audio: { drafting: boolean } } }).out.audio.drafting;
    s.boostPool = 4;
    r.frame([{ type: 'boost', amount: 4, source: 'slingshot' }]);
    expect(drafting()).toBe(true);
    r.frame([{ type: 'boost', amount: 2, source: 'perfect' }]);
    expect(drafting()).toBe(false);
    r.frame([{ type: 'boost', amount: 4, source: 'slingshot' }]);
    s.boostPool = 0;
    r.frame();
    expect(drafting()).toBe(false);
    s.drafting = true;
    r.frame();
    expect(drafting()).toBe(true);
  });

  it('drafting alone earns no flow', () => {
    const r = new Rig();
    r.sim.s.flow = 6;
    const out: Beat[] = [];
    for (let i = 0; i < 40; i++) out.push(...r.frame([style('draft', 40, i + 1)]));
    out.push(...r.idle(1));
    expect(of(out, 'flow')).toHaveLength(0);
    r.sim.combo = { active: true, pending: 1000, multiplier: 10, window: 156, timer: 100 };
    const o = r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: [], poses: new Map(), standings: { next: null, rank: 1, of: 1 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false });
    expect(o.audio.earnedFlow).toBe(0);
    expect(o.audio.skillChain).toBe(0);
    expect(o.feel.flow).toBe(0);
  });

  it("comboBank and bump in one batch: a bump bank and a flow snuff; a lost combo's snuff says nothing", () => {
    const r = new Rig();
    flowUp(r);
    const t = r.sim.tick + 1;
    const a = r.frame([
      { tick: t, e: { type: 'comboBank', points: 2400, mult: 4 } },
      { tick: t, e: { type: 'bump', id: 77 } },
    ]);
    expect(of(a, 'bank')[0]).toMatchObject({ bump: true, points: 2400, origin: 600 });
    expect(of(a, 'bump')[0]).toMatchObject({ bank: true });
    expect(of(a, 'flow')[0]).toMatchObject({ phase: 'snuff', say: { label: 'Flow broken' } });
    r.idle(0.2);
    const o = r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: [], poses: new Map(), standings: { next: null, rank: 1, of: 1 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false });
    expect(o.feel.flow).toBe(0);

    const q = new Rig();
    flowUp(q);
    const t2 = q.sim.tick + 1;
    const b = q.frame([
      { tick: t2, e: { type: 'comboLost', points: 3000 } },
      { tick: t2, e: { type: 'crash', cause: 'tree' } },
    ]);
    expect(of(b, 'flow').map((x) => x.say)).toEqual([undefined]);
    expect(of(b, 'crash')[0]).toMatchObject({ cause: 'tree', stake: 3000 });
  });

  it('a timer bank (no bump) is not a snuff', () => {
    const r = new Rig();
    flowUp(r);
    const a = r.frame([{ type: 'comboBank', points: 2400, mult: 4 }]);
    expect(of(a, 'bank')[0].bump).toBe(false);
    expect(of(a, 'flow')).toHaveLength(0);
  });

  it('comboLost is staged against the start snapshot', () => {
    const r = new Rig({ bestComboAtStart: 2000 });
    const a = r.frame([{ type: 'comboLost', points: 2500 }, { type: 'crash', cause: 'rock' }]);
    expect(of(a, 'comboLost')[0]).toMatchObject({ best: true, crack: true, stake: 2500, say: { label: 'Best combo lost' } });
    const q = new Rig({ bestComboAtStart: 2000 });
    const b = q.frame([{ type: 'comboLost', points: 200 }]);
    expect(of(b, 'comboLost')[0]).toMatchObject({ best: false, crack: false, say: { label: 'Combo lost' } });
  });

  it('Best combo pace fires once, against the snapshot', () => {
    const r = new Rig({ bestComboAtStart: 2000 });
    r.sim.combo = { active: true, pending: 500, multiplier: 3, window: 156, timer: 100 };
    expect(of(r.frame(), 'bestComboPace')).toHaveLength(0);
    r.sim.combo.pending = 700;
    const a = r.frame();
    expect(of(a, 'bestComboPace')[0]).toMatchObject({ stake: 2100, say: { label: 'Best combo pace', tone: 'best' } });
    r.sim.combo.pending = 900;
    expect(of(r.frame(), 'bestComboPace')).toHaveLength(0);
  });

  it('drift releases carry the tier and relabel the drift callout', () => {
    const r = new Rig();
    const t = r.sim.tick + 1;
    const a = r.frame([
      { tick: t, e: { type: 'drift', phase: 'release', tier: 3 } },
      { tick: t, e: { type: 'boost', amount: 4, source: 'drift' } },
      { tick: t, e: style('drift', 700) },
    ]);
    expect(of(a, 'driftRelease')[0].tier).toBe(3);
    expect(of(a, 'callout')[0].say.label).toBe('Max drift');
    const b = r.frame([{ type: 'drift', phase: 'release', tier: 2 }, style('drift', 350)]);
    expect(of(b, 'callout')[0].say.label).toBe('Big drift');
  });
});

describe('milestones', () => {
  it('New ground once', () => {
    const r = new Rig({ bestDistAtStart: 400 });
    r.sim.distance = 399;
    expect(of(r.frame(), 'newGround')).toHaveLength(0);
    r.sim.distance = 401;
    expect(of(r.frame(), 'newGround')[0]).toMatchObject({ z: 400, say: { label: 'New ground', tone: 'best' } });
    r.sim.distance = 500;
    expect(of(r.idle(1), 'newGround')).toHaveLength(0);
  });

  it('New best once, deferred behind a bank, never after a revive', () => {
    const r = new Rig({ bestScoreAtStart: 5000 });
    r.sim.score = 4000;
    r.frame();
    r.sim.score = 6000;
    const a = r.frame([{ type: 'comboBank', points: 2000, mult: 4 }]);
    expect(of(a, 'newBest')).toHaveLength(0);
    const later = r.idle(1.3);
    expect(of(later, 'newBest')).toHaveLength(1);
    // The score's best, said so: never read as the distance's ('Best in 60 m').
    expect(of(later, 'newBest')[0].say?.label).toBe('New best score');
    // A crash, a revive, and the score keeps climbing: no second New best.
    r.frame([{ type: 'crash', cause: 'tree' }]);
    r.d.revive();
    r.sim.score = 9000;
    expect(of(r.idle(2), 'newBest')).toHaveLength(0);

    const q = new Rig({ bestScoreAtStart: 5000 });
    q.sim.score = 5200;
    expect(of(q.frame(), 'newBest')).toHaveLength(1);
  });

  it("New best after a 'New best combo' bank waits out the bank's whole cash-in (its tier's BANK_MS)", () => {
    const r = new Rig({ bestScoreAtStart: 5000, bestComboAtStart: 3000 });
    r.sim.score = 4000;
    // A skilled combo (3 moves), banked at 3,790 over a 3,000 best: tier 3, 'New best combo', 1.9 s.
    for (let i = 0; i < 3; i++) r.frame([style('air', 100, i + 1)]);
    r.sim.score = 7790;
    const a = r.frame([{ type: 'comboBank', points: 3790, mult: 4 }]);
    expect(of(a, 'bank')[0]).toMatchObject({ tier: 3, header: 'New best combo' });
    expect(of(r.idle(1.85), 'newBest')).toHaveLength(0);
    expect(of(r.idle(0.1), 'newBest')).toHaveLength(1);
    // A cash-in that lands while New best is still due holds it too.
    const q = new Rig({ bestScoreAtStart: 5000, bestDistAtStart: 330 });
    q.sim.distance = 331;
    q.sim.score = 5100;
    q.frame();
    q.idle(1);
    q.frame([{ type: 'comboBank', points: 600, mult: 2 }]);
    expect(of(q.idle(0.9), 'newBest')).toHaveLength(0);
    expect(of(q.idle(0.2), 'newBest')).toHaveLength(1);
  });

  it('New best crossed with New ground waits 1.25 s after it: each gets its own moment', () => {
    const r = new Rig({ bestDistAtStart: 330, bestScoreAtStart: 5000 });
    r.sim.distance = 329;
    r.sim.score = 4900;
    r.frame();
    r.sim.distance = 331;
    r.sim.score = 5100;
    const a = r.frame();
    expect(of(a, 'newGround')).toHaveLength(1);
    expect(of(a, 'newBest')).toHaveLength(0);
    const soon = r.idle(1.15);
    expect(of(soon, 'newBest')).toHaveLength(0);
    const later = r.idle(0.2);
    expect(of(later, 'newBest')).toHaveLength(1);
    // New best crossed just before New ground (0.4 s away at 20 m/s): it waits, and New ground goes first.
    const p = new Rig({ bestDistAtStart: 330, bestScoreAtStart: 5000 });
    p.sim.s.speed = 20;
    p.sim.distance = 322;
    p.sim.score = 5100;
    expect(of(p.frame(), 'newBest')).toHaveLength(0);
    expect(of(p.idle(0.3), 'newBest')).toHaveLength(0);
    p.sim.distance = 331;
    const g2 = p.frame();
    expect(of(g2, 'newGround')).toHaveLength(1);
    const after = p.idle(1.4);
    expect(of(after, 'newBest')).toHaveLength(1);
    expect((of(after, 'newBest')[0].tick - g2[0].tick) / 60).toBeGreaterThanOrEqual(1.2);
    // Far apart, New best is not held.
    const q = new Rig({ bestDistAtStart: 330, bestScoreAtStart: 5000 });
    q.sim.distance = 331;
    q.frame();
    q.idle(2);
    q.sim.score = 5100;
    expect(of(q.frame(), 'newBest')).toHaveLength(1);
  });

  it("a friend's distance, kilometres", () => {
    const r = new Rig({ friend: { name: 'Mila', distance: 900 } });
    r.sim.distance = 950;
    const a = r.frame();
    // (The callout is meta's copy, progress.friendBeatenText, with its typographic apostrophe.)
    expect(of(a, 'friendBeaten')[0]).toMatchObject({ name: 'Mila', say: { label: 'Beat Mila’s 900 m' } });
    r.sim.distance = 1001;
    expect(of(r.frame(), 'km')[0]).toMatchObject({ km: 1, say: { label: '1 km' } });
    expect(of(r.frame(), 'km')).toHaveLength(0);
  });

  it('the best line and the countdown to it', () => {
    const r = new Rig({ bestDistAtStart: 1240 });
    r.sim.distance = 1000;
    const o = r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: [], poses: new Map(), standings: { next: null, rank: 1, of: 1 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false });
    expect(o.feel.bestLine).toMatchObject({ z: 1240, distance: 1240 });
    expect(o.hud.bestIn).toBe(240);
  });
});

describe('the race', () => {
  function raceRig(): { r: Rig; g: GhostTrack } {
    const r = new Rig();
    const g = track(1001);
    r.tracks = [g];
    r.poses.set(1001, pose(110));
    return { r, g };
  }

  it('shownPasses excludes muted passes (a start-line jostle pays but stays quiet)', () => {
    const r = new Rig();
    const g = track(1001);
    r.tracks = [g];
    r.sim.tick = 100;
    r.poses.set(1001, pose(100.5));
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(a, 'pass')[0]).toMatchObject({ word: 'jostle', muted: true, gifts: 5 });
    expect(r.d.shownPasses.size).toBe(0);
    const log = r.d.log.find((e) => e.type === 'pass');
    expect(log?.named).toBe(false);
  });

  it('a shown pass, then a chain, with the ladder climbing', () => {
    const { r, g } = raceRig();
    const h = track(1002);
    r.tracks.push(h);
    r.poses.set(1002, pose(112));
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(a, 'pass')[0]).toMatchObject({ word: 'passed', ladder: 1, muted: false, gifts: 5 });
    expect(r.d.shownPasses.has(1001)).toBe(true);
    r.idle(1);
    const b = r.frame([], { race: [{ type: 'pass', track: h, first: true }] });
    expect(of(b, 'pass')[0]).toMatchObject({ word: 'double', ladder: 2, chain: 2, gifts: 7 });
  });

  it('a slingshot in the same batch makes it Slung past', () => {
    const { r, g } = raceRig();
    const a = r.frame([{ type: 'boost', amount: 3, source: 'slingshot' }], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(a, 'pass')[0]).toMatchObject({ word: 'slung', gifts: 7 });
  });

  it('wipeout news for a ghost ahead, never for one far away', () => {
    const { r, g } = raceRig();
    r.poses.set(1001, pose(250, 4, true));
    const a = r.frame([], { race: [{ type: 'crashed', track: g }] });
    expect(of(a, 'raceNews')[0]).toMatchObject({ news: 'wipeout', text: 'G1001 wiped out' });
    expect(of(a, 'raceNews')[0].gain).toBeCloseTo(0.5);
    r.poses.set(1001, pose(400, 4, true));
    expect(of(r.frame([], { race: [{ type: 'crashed', track: g }] }), 'raceNews')).toHaveLength(0);
  });

  it('a duel opens, mutes its passes, names the rival and pays once when won', () => {
    const { r, g } = raceRig();
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.8));
    const opened: Beat[] = [];
    for (let i = 0; i < 61; i++) opened.push(...r.frame());
    expect(of(opened, 'duel').map((b) => b.phase)).toEqual(['open']);
    const out = r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: r.tracks, poses: r.poses, standings: { next: null, rank: 1, of: 2 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false });
    expect(out.rival?.id).toBe(1001);
    expect(out.hud.duel).toBe(true);
    expect(out.feel.duelId).toBe(1001);
    r.poses.set(1001, pose(r.sim.s.z - 1));
    const p = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(p, 'pass')[0].muted).toBe(true);
    r.poses.set(1001, pose(r.sim.s.z - 4.5));
    const w = r.frame();
    expect(of(w, 'duel')[0]).toMatchObject({ phase: 'won', gifts: 5 });
  });

  it("a ghost that crashes out of its duel: the duel's result, then no 'Beat' and no wipeout for it", () => {
    const { r, g } = raceRig();
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.8));
    for (let i = 0; i < 61; i++) r.frame();
    expect(r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: r.tracks, poses: r.poses, standings: { next: null, rank: 1, of: 2 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false }).hud.duel).toBe(true);
    r.poses.set(1001, pose(r.sim.s.z + 1, 0, true));
    g.crashSeen = true;
    const w = r.frame();
    expect(of(w, 'duel')[0]).toMatchObject({ phase: 'won' });
    const later = [...r.frame([], { ticks: 10, race: [{ type: 'crashed', track: g }] }), ...r.frame([], { ticks: 10, race: [{ type: 'pass', track: g, first: false }] })];
    expect(of(later, 'raceNews')).toHaveLength(0);
    expect(of(later, 'pass')[0].muted).toBe(true);
  });

  it('the pill holds the ghost it names through a bunched pack', () => {
    const r = new Rig();
    const a = track(1);
    const b = track(2);
    r.tracks = [a, b];
    const step = (next: GhostTrack, gap: number) =>
      r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: r.tracks, poses: r.poses, standings: { next: { track: next, gap }, rank: 3, of: 3 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false }).rival?.id;
    r.poses.set(1, pose(r.sim.s.z + 5));
    r.poses.set(2, pose(r.sim.s.z + 5.3));
    expect(step(a, 5)).toBe(1);
    // The two swap by a hand's width: the pill keeps naming the first.
    r.poses.set(2, pose(r.sim.s.z + 4.9));
    expect(step(b, 4.9)).toBe(1);
    // A clear metre, but the name has stood only a moment: it holds its 0.6 s dwell, then gives way.
    r.poses.set(2, pose(r.sim.s.z + 3.6));
    expect(step(b, 3.6)).toBe(1);
    r.idle(0.6);
    expect(step(b, 3.6)).toBe(2);
  });

  it('the pill never names a wreck or a ghost more than 150 m back; with none to name, no pill', () => {
    const r = new Rig();
    const a = track(1);
    const b = track(2);
    r.tracks = [a, b];
    const rival = () => r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: r.tracks, poses: r.poses, standings: { next: { track: a, gap: -1974 }, rank: 1, of: 3 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false }).rival;
    // A wreck 1,974 m back and a rider 160 m back: nothing to race.
    r.poses.set(1, pose(r.sim.s.z - 1974, 0, true));
    r.poses.set(2, pose(r.sim.s.z - 160));
    expect(rival()).toBeNull();
    // A wreck just ahead is skipped too; the rider within 150 m behind is named.
    r.poses.set(1, pose(r.sim.s.z + 30, 0, true));
    r.poses.set(2, pose(r.sim.s.z - 120));
    expect(rival()).toEqual({ id: 2, gap: -120, raw: -120 });
  });

  it("a duel's result keeps the rival on its ghost for 1.5 s, and no duel opens under it", () => {
    const r = new Rig();
    const a = track(1001);
    const b = track(1002);
    r.tracks = [a, b];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.5));
    r.poses.set(1002, pose(r.sim.s.z + 1.0));
    r.idle(1.5);
    const rival = () => (r.d as unknown as { out: { rival: { id: number } | null } }).out.rival?.id;
    const held = () => (r.d as unknown as { out: { hud: { hold: boolean } } }).out.hud.hold;
    expect(held()).toBe(false);
    r.poses.set(1001, pose(r.sim.s.z - 5));
    const won = r.frame();
    expect(of(won, 'duel').map((d) => d.phase)).toEqual(['won']);
    // The other ghost is right there (and nearer), but the result flash holds the ring and pill, and
    // the HUD hears of the hold on the director's own clock.
    expect(rival()).toBe(1001);
    expect(held()).toBe(true);
    const hold = r.idle(1.4);
    expect(of(hold, 'duel')).toHaveLength(0);
    expect(rival()).toBe(1001);
    expect(held()).toBe(true);
    const after = r.idle(0.3);
    expect(of(after, 'duel').map((d) => `${d.phase}:${d.ghost.id}`)).toEqual(['open:1002']);
    expect(rival()).toBe(1002);
    expect(held()).toBe(false);
  });

  it("a duel's result under a landing stamp holds from the stamp's end, when its flash can first show", () => {
    const r = new Rig();
    const a = track(1001);
    const b = track(1002);
    r.tracks = [a, b];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.5));
    r.poses.set(1002, pose(r.sim.s.z + 30));
    r.idle(1.5);
    const out = () => (r.d as unknown as { out: { rival: { id: number } | null; hud: { hold: boolean } } }).out;
    // A perfect landing's stamp goes up; half a second later the duel is won under it.
    expect(of(r.frame([style('perfect', 250, 2), land('perfect')]), 'stomp')).toHaveLength(1);
    r.idle(0.5);
    r.poses.set(1001, pose(r.sim.s.z - 5));
    expect(of(r.frame(), 'duel').map((d) => d.phase)).toEqual(['won']);
    // The stamp holds the 'Duel won' flash for another second: the hold runs 1.5 s from there.
    r.idle(2.4);
    expect(out().hud.hold).toBe(true);
    expect(out().rival?.id).toBe(1001);
    r.idle(0.2);
    expect(out().hud.hold).toBe(false);
    // A stamp 0.3 s into a result's flash steps it back to play after the stamp: the hold starts over.
    const q = new Rig();
    q.tracks = [track(1001), track(1002)];
    q.sim.tick = 2000;
    q.poses.set(1001, pose(q.sim.s.z + 0.5));
    q.poses.set(1002, pose(q.sim.s.z + 30));
    q.idle(1.5);
    q.poses.set(1001, pose(q.sim.s.z - 5));
    expect(of(q.frame(), 'duel').map((d) => d.phase)).toEqual(['won']);
    q.idle(0.3);
    q.frame([style('perfect', 250, 2), land('perfect')]);
    const qo = () => (q.d as unknown as { out: { hud: { hold: boolean } } }).out.hud;
    q.idle(2.9);
    expect(qo().hold).toBe(true);
    q.idle(0.2);
    expect(qo().hold).toBe(false);
    // An older flash has had its moment: a stamp then leaves the hold as it was.
    const s = new Rig();
    s.tracks = [track(1001), track(1002)];
    s.sim.tick = 2000;
    s.poses.set(1001, pose(s.sim.s.z + 0.5));
    s.poses.set(1002, pose(s.sim.s.z + 30));
    s.idle(1.5);
    s.poses.set(1001, pose(s.sim.s.z - 5));
    s.frame();
    s.idle(0.8);
    s.frame([style('perfect', 250, 2), land('perfect')]);
    const so = () => (s.d as unknown as { out: { hud: { hold: boolean } } }).out.hud;
    s.idle(0.6);
    expect(so().hold).toBe(true);
    s.idle(0.2);
    expect(so().hold).toBe(false);
  });

  it('a duel about to open keeps the pill on its ghost: no third name for the quarter second before it', () => {
    const r = new Rig();
    const a = track(1, 'pool', 'SparkleCedar');
    const y = track(2, 'you', 'Rider');
    r.tracks = [a, y];
    r.sim.tick = 2000;
    const z = r.sim.s.z;
    const rival = () => (r.d as unknown as { out: { rival: { id: number } | null } }).out.rival?.id;
    // SparkleCedar a metre ahead (the nearest), your best 3 m ahead.
    r.poses.set(1, pose(z + 1));
    r.poses.set(2, pose(z + 3));
    const seen: number[] = [];
    const beats: Beat[] = [];
    for (let i = 0; i < 42; i++) {
      beats.push(...r.frame());
      seen.push(rival()!);
    }
    // You edge past it: your best is now the nearest ahead, but its duel is a quarter second off.
    r.poses.set(1, pose(z - 1));
    for (let i = 0; i < 30; i++) {
      beats.push(...r.frame());
      seen.push(rival()!);
    }
    expect(of(beats, 'duel').map((d) => `${d.phase}:${d.ghost.id}`)).toEqual(['open:1']);
    expect(seen.every((id) => id === 1)).toBe(true);
    // With no duel coming, the nearest ahead takes the pill as before.
    const q = new Rig();
    q.tracks = [track(1), track(2)];
    q.poses.set(1, pose(q.sim.s.z + 1));
    q.poses.set(2, pose(q.sim.s.z + 3));
    q.sim.tick = 100;
    q.idle(0.7);
    q.poses.set(1, pose(q.sim.s.z - 1));
    q.frame();
    expect((q.d as unknown as { out: { rival: { id: number } | null } }).out.rival?.id).toBe(2);
  });

  it("a duel with your best won, clear behind you: 'Passed Your best' after the result's flash; a duel is resolved after 8 s", () => {
    const r = new Rig();
    const you = track(1001, 'you', 'Rider');
    r.tracks = [you];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.8));
    expect(of(r.idle(1.1), 'duel').map((d) => d.phase)).toEqual(['open']);
    // Two metres behind your line for the whole 8 s (inside the 4 m resolve line): it resolves by who leads.
    you.status = 1;
    r.poses.set(1001, pose(r.sim.s.z - 2));
    const out = r.idle(10);
    const duel = of(out, 'duel');
    expect(duel.map((d) => d.phase)).toEqual(['heldOff']);
    const pass = of(out, 'pass');
    expect(pass).toHaveLength(1);
    expect(pass[0]).toMatchObject({ word: 'yourBest', text: 'Passed', muted: false, ghost: { kind: 'you' } });
    // 'Held off Your best' has the pill for its 1.5 s hold first (pushed with it, the pass took the
    // pill in the same frame and the result never showed).
    expect(pass[0].tick - duel[0].tick).toBeGreaterThanOrEqual(89);
    expect(pass[0].tick - duel[0].tick).toBeLessThanOrEqual(92);
    expect(r.d.shownPasses.has(1001)).toBe(true);
  });

  it("a duel with your best capped neck and neck claims no pass: the real crossing is the one 'Passed Your best'", () => {
    const r = new Rig();
    const you = track(1001, 'you', 'Rider');
    r.tracks = [you];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.8));
    r.idle(1.1);
    // A hand behind your line for the whole 8 s, never 0.8 m clear (the race saw no crossing yet).
    r.poses.set(1001, pose(r.sim.s.z - 0.6));
    const capped = r.idle(8);
    expect(of(capped, 'duel').map((d) => d.phase)).toEqual(['heldOff']);
    expect(of(capped, 'pass')).toHaveLength(0);
    // The real overtake 3 s later: the race's first pass is the moment, with the base.
    r.idle(3);
    r.poses.set(1001, pose(r.sim.s.z - 1.6));
    const real = of(r.frame([], { race: [{ type: 'pass', track: you, first: true }] }), 'pass');
    expect(real).toHaveLength(1);
    expect(real[0]).toMatchObject({ word: 'yourBest', text: 'Passed', muted: false, gifts: 5 });
  });

  it("your best passed in view before its duel: the duel's result is the moment, never a second 'Passed Your best'", () => {
    const r = new Rig();
    const you = track(1001, 'you', 'Rider');
    r.tracks = [you];
    r.sim.tick = 2000;
    you.status = 1;
    r.poses.set(1001, pose(r.sim.s.z - 1.6));
    const first = of(r.frame([], { race: [{ type: 'pass', track: you, first: true }] }), 'pass');
    expect(first[0]).toMatchObject({ word: 'yourBest', text: 'Passed', muted: false, gifts: 5 });
    // It sticks with you: a duel, held off with it two metres back at the cap.
    r.poses.set(1001, pose(r.sim.s.z - 1));
    const out = r.idle(12);
    expect(of(out, 'duel').map((d) => d.phase)).toEqual(['open', 'heldOff']);
    expect(of(out, 'pass')).toHaveLength(0);
    r.poses.set(1001, pose(r.sim.s.z - 2.5));
    expect(of(r.idle(3), 'pass')).toHaveLength(0);
  });

  it("neck and neck with the crossing behind you: 'Passed Your best' waits for it to fall clear and the result's hold", () => {
    const r = new Rig();
    const you = track(1001, 'you', 'Rider');
    r.tracks = [you];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.8));
    // Frames up to the duel's result (the rig's first frame opens it).
    const toResult = (q: Rig): Beat[] => {
      const out: Beat[] = [];
      for (let i = 0; i < 600; i++) {
        const b = q.frame();
        out.push(...b);
        if (of(b, 'duel').some((d) => d.phase !== 'open')) break;
      }
      return out;
    };
    expect(of(r.frame(), 'duel').map((d) => d.phase)).toEqual(['open']);
    // A metre behind (the race's crossing came inside the duel, muted): level by C12 at the cap.
    you.status = 1;
    r.poses.set(1001, pose(r.sim.s.z - 1));
    const capped = toResult(r);
    expect(of(capped, 'duel').map((d) => d.phase)).toEqual(['heldOff']);
    expect(of(capped, 'pass')).toHaveLength(0);
    // Clear 0.5 s later, but the result's flash holds for 1.5 s: the pass waits for it.
    r.idle(0.5);
    r.poses.set(1001, pose(r.sim.s.z - 2.2));
    expect(of(r.idle(0.9), 'pass')).toHaveLength(0);
    const after = of(r.idle(0.2), 'pass');
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ word: 'yourBest', text: 'Passed', muted: false, ghost: { kind: 'you' } });
    expect(of(r.idle(2), 'pass')).toHaveLength(0);
    // Still level YOU_CLEAR_S after the result's hold: let go, nothing claimed.
    const q = new Rig();
    const y2 = track(1001, 'you', 'Rider');
    q.tracks = [y2];
    q.sim.tick = 2000;
    q.poses.set(1001, pose(q.sim.s.z + 0.8));
    q.frame();
    y2.status = 1;
    q.poses.set(1001, pose(q.sim.s.z - 1));
    toResult(q);
    expect(of(q.idle(7.7), 'pass')).toHaveLength(0);
    q.poses.set(1001, pose(q.sim.s.z - 2.2));
    expect(of(q.idle(1), 'pass')).toHaveLength(0);
  });

  it('gaps are measured against the rendered rider (riderZ), on the poses\' own render tick', () => {
    const r = new Rig();
    const a = track(1);
    r.tracks = [a];
    const step = (poseZ: number, riderZ?: number) => {
      r.poses.set(1, pose(poseZ));
      return r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: r.tracks, poses: r.poses, riderZ, standings: { next: null, rank: 1, of: 2 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false }).rival;
    };
    // The rider renders 0.4 m short of its integer-tick z (alpha 0.6 at 25 m/s): the pose is taken
    // at the same render tick, so the gap is the rendered one, not 0.4 m short.
    const z = r.sim.s.z;
    expect(step(z + 13.1, z - 0.4)?.raw).toBeCloseTo(13.5);
    // Without riderZ it falls back to the sim's own z.
    expect(step(z + 13.1)?.raw).toBeCloseTo(13.1);
    // A steady 13.5 m chase across ticks: pose and rider move together, so the gap never jumps.
    const gaps: number[] = [];
    for (let i = 0; i < 30; i++) {
      const alpha = (i % 3) / 3;
      const rider = z + (i + alpha) * 0.4;
      gaps.push(step(rider + 13.5, rider)!.raw);
    }
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(1e-9);
  });

  it('the pill and the edge chip read one held gap (C12): whole metres, a metre to move, 250 ms to dwell', () => {
    const r = new Rig();
    const a = track(1);
    const b = track(2);
    r.tracks = [a, b];
    const z = r.sim.s.z;
    const rival = () => (r.d as unknown as { out: { rival: { id: number; gap: number; raw: number } | null } }).out.rival;
    // Behind you, 9.6 m: the readout says 10; the race maths jitter across 9.5 and it holds.
    r.poses.set(1, pose(z - 9.6));
    r.poses.set(2, pose(z - 60));
    r.frame();
    expect(rival()).toMatchObject({ id: 1, gap: -10 });
    for (const g of [9.4, 9.55, 9.3, 9.45, 9.2]) {
      r.poses.set(1, pose(z - g));
      r.frame();
      expect(rival()!.gap).toBe(-10);
      expect(rival()!.raw).toBeCloseTo(-g);
    }
    r.idle(0.3);
    expect(rival()!.gap).toBe(-10);
    // A metre from it: it moves, then dwells 250 ms however fast the gap runs.
    r.poses.set(1, pose(z - 8.9));
    r.frame();
    expect(rival()!.gap).toBe(-9);
    r.poses.set(1, pose(z - 7.6));
    r.idle(0.2);
    expect(rival()!.gap).toBe(-9);
    r.idle(0.06);
    expect(rival()!.gap).toBe(-8);
    // Neck and neck (under 1.5 m, out again at 1.9 m) reads 1 m: the pill's level, the chip's '1 m'.
    r.poses.set(1, pose(z - 1.2));
    r.frame();
    expect(rival()!.gap).toBe(-1);
    r.poses.set(1, pose(z + 1.7));
    r.frame();
    expect(rival()!.gap).toBe(1);
    r.poses.set(1, pose(z + 2.1));
    r.frame();
    expect(rival()!.gap).toBe(2);
  });

  it('the start-line call holds the rival a quarter second under the HUD call flash', () => {
    const r = new Rig();
    const pace = track(1, 'pool', 'Pacey');
    pace.entry.role = 'pace';
    const near = track(2, 'pool', 'Nearby');
    r.tracks = [pace, near];
    r.sim.tick = 10;
    r.poses.set(1, pose(r.sim.s.z + 40));
    r.poses.set(2, pose(r.sim.s.z + 3));
    const rival = () => (r.d as unknown as { out: { rival: { id: number } | null } }).out.rival?.id;
    const beats = r.idle(0.62);
    expect(of(beats, 'raceCall')).toHaveLength(1);
    expect(rival()).toBe(1);
    // POP_DEFER.call (the HUD's CALL_MS) is 2.6 s; the hold ends at 2.35 s.
    r.idle(2.3);
    expect(rival()).toBe(1);
    r.idle(0.1);
    expect(rival()).toBe(2);
  });

  it("your best jostled at the start keeps its first pass: the later overtake is 'Passed Your best' with the base", () => {
    const r = new Rig();
    const you = track(1001, 'you', 'Rider');
    r.tracks = [you];
    r.sim.tick = 120;
    r.poses.set(1001, pose(r.sim.s.z - 0.5));
    const jostle = of(r.frame([], { race: [{ type: 'pass', track: you, first: true }] }), 'pass');
    expect(jostle[0]).toMatchObject({ word: 'jostle', muted: true, gifts: 0 });
    // It rides your own line: it slips back past you in the bunch, then you overtake it for real.
    r.poses.set(1001, pose(r.sim.s.z + 3));
    r.frame([], { race: [{ type: 'passedBy', track: you }] });
    // (Just outside duel range, so no duel opens on the jump in ticks.)
    r.sim.tick = 560;
    r.poses.set(1001, pose(r.sim.s.z - 1.6));
    const real = of(r.frame([], { race: [{ type: 'pass', track: you, first: false }] }), 'pass');
    expect(real[0]).toMatchObject({ word: 'yourBest', text: 'Passed', muted: false, gifts: 5, first: false });
    expect(r.d.shownPasses.has(1001)).toBe(true);
    // Its first pass is spent now: the next one is a retake that pays nothing more.
    r.idle(1);
    const again = of(r.frame([], { race: [{ type: 'pass', track: you, first: false }] }), 'pass');
    expect(again[0]).toMatchObject({ word: 'tookBack', gifts: 0 });
    // Another ghost's start-line jostle still uses up its first pass (it paid its base then).
    const q = new Rig();
    const g = track(7);
    q.tracks = [g];
    q.sim.tick = 120;
    q.poses.set(7, pose(q.sim.s.z - 0.5));
    expect(of(q.frame([], { race: [{ type: 'pass', track: g, first: true }] }), 'pass')[0]).toMatchObject({ word: 'jostle', gifts: 5 });
    q.sim.tick = 560;
    q.poses.set(7, pose(q.sim.s.z - 1.6));
    expect(of(q.frame([], { race: [{ type: 'pass', track: g, first: false }] }), 'pass')[0]).toMatchObject({ word: 'tookBack', gifts: 0 });
  });

  it("your best jostled at the start, then beaten in a duel: one 'Passed Your best' with the base, and a re-pass is a retake", () => {
    const r = new Rig();
    const you = track(1001, 'you', 'Rider');
    r.tracks = [you];
    r.sim.tick = 120;
    r.poses.set(1001, pose(r.sim.s.z - 0.5));
    expect(of(r.frame([], { race: [{ type: 'pass', track: you, first: true }] }), 'pass')[0]).toMatchObject({ word: 'jostle', gifts: 0 });
    // A duel with it, held off with you two metres ahead the whole way (no pass inside it).
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.8));
    expect(of(r.idle(1.1), 'duel').map((d) => d.phase)).toEqual(['open']);
    you.status = 1;
    r.poses.set(1001, pose(r.sim.s.z - 2));
    const out = r.idle(10);
    expect(of(out, 'duel').map((d) => d.phase)).toEqual(['heldOff']);
    const pass = of(out, 'pass');
    expect(pass).toHaveLength(1);
    expect(pass[0]).toMatchObject({ word: 'yourBest', text: 'Passed', muted: false, gifts: 5 });
    // It slips past you and you take it back: its first pass was the duel's 'Passed Your best'.
    r.idle(3);
    you.status = -1;
    r.poses.set(1001, pose(r.sim.s.z + 3));
    r.frame([], { race: [{ type: 'passedBy', track: you }] });
    r.poses.set(1001, pose(r.sim.s.z - 1.6));
    const again = of(r.frame([], { race: [{ type: 'pass', track: you, first: false }] }), 'pass');
    expect(again[0]).toMatchObject({ word: 'tookBack', text: 'Took back', gifts: 0 });
    // Capped neck and neck instead: no pass claimed then; the later real overtake is the one
    // 'Passed Your best', with the base the jostle kept, and the next re-pass is a retake.
    const q = new Rig();
    const y2 = track(1001, 'you', 'Rider');
    q.tracks = [y2];
    q.sim.tick = 120;
    q.poses.set(1001, pose(q.sim.s.z - 0.5));
    q.frame([], { race: [{ type: 'pass', track: y2, first: true }] });
    q.sim.tick = 2000;
    q.poses.set(1001, pose(q.sim.s.z + 0.8));
    q.idle(1.1);
    q.poses.set(1001, pose(q.sim.s.z - 0.6));
    const capped = q.idle(8);
    expect(of(capped, 'duel').map((d) => d.phase)).toEqual(['heldOff']);
    expect(of(capped, 'pass')).toHaveLength(0);
    q.idle(3);
    q.poses.set(1001, pose(q.sim.s.z - 1.6));
    const real = of(q.frame([], { race: [{ type: 'pass', track: y2, first: false }] }), 'pass');
    expect(real[0]).toMatchObject({ word: 'yourBest', text: 'Passed', muted: false, gifts: 5 });
    q.idle(1);
    q.poses.set(1001, pose(q.sim.s.z - 1.6));
    expect(of(q.frame([], { race: [{ type: 'pass', track: y2, first: false }] }), 'pass')[0]).toMatchObject({ word: 'tookBack', gifts: 0 });
  });

  it('a pass muted inside its own duel pays its base and no extras', () => {
    const r = new Rig();
    const a = track(1001);
    const b = track(1002);
    r.tracks = [a, b];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.8));
    r.poses.set(1002, pose(r.sim.s.z + 30));
    r.idle(1.1);
    expect((r.d as unknown as { out: { hud: { duel: boolean } } }).out.hud.duel).toBe(true);
    // A shown pass of another ghost, then the duel ghost passed muted inside the chain window: a
    // 'double' would take +2 extra, but nothing of it is seen.
    r.poses.set(1002, pose(r.sim.s.z - 1));
    expect(of(r.frame([], { race: [{ type: 'pass', track: b, first: true }] }), 'pass')[0]).toMatchObject({ muted: false, gifts: 5 });
    r.poses.set(1001, pose(r.sim.s.z - 0.5));
    const m = of(r.frame([{ type: 'boost', amount: 3, source: 'slingshot' }], { race: [{ type: 'pass', track: a, first: true }] }), 'pass');
    expect(m[0]).toMatchObject({ muted: true, gifts: 5 });
  });

  it('a slingshot through the pack is one growing moment: Slung past, Slung past 2, 3', () => {
    const r = new Rig();
    const gs = [track(1), track(2), track(3)];
    r.tracks = gs;
    for (const g of gs) r.poses.set(g.entry.id, pose(r.sim.s.z - 3));
    const sling = r.frame([{ type: 'boost', amount: 5, source: 'slingshot' }], { race: [{ type: 'pass', track: gs[0], first: true }] });
    const b = r.frame([], { ticks: 10, race: [{ type: 'pass', track: gs[1], first: true }] });
    const c = r.frame([], { ticks: 10, race: [{ type: 'pass', track: gs[2], first: true }] });
    expect([...sling, ...b, ...c].filter((x) => x.type === 'pass').map((x) => (x as BeatOf<'pass'>).text)).toEqual(['Slung past', 'Slung past 2', 'Slung past 3']);
    expect(of(c, 'pass')[0].gifts).toBe(7);
  });

  it('the lead beat once, from 10 s, with 3 or more ghosts and one riding', () => {
    const r = new Rig();
    r.tracks = [track(1), track(2), track(3)];
    for (const t of r.tracks) r.poses.set(t.entry.id, pose(50));
    r.of = 4;
    r.sim.tick = 700;
    expect(of(r.frame(), 'lead')).toHaveLength(1);
    expect(of(r.idle(1), 'lead')).toHaveLength(0);
  });
});

describe('finales', () => {
  it('the Gift Storm counts what you caught once the last gifts are behind you', () => {
    const r = new Rig({ event: ChaosEvent.GiftStorm, triggerZ: 500 });
    const storm = r.sim.dyn.storm;
    for (let k = 0; k < 48; k++) storm.push({ z: 200 + k, collected: k < 40 });
    r.sim.s.z = 200;
    const a = r.frame([{ type: 'chaos', phase: 'end', event: ChaosEvent.GiftStorm }]);
    expect(of(a, 'finale')).toHaveLength(0);
    r.sim.s.z = 260;
    const b = r.frame();
    const f = of(b, 'finale')[0];
    expect(f).toMatchObject({ text: 'Caught 40 of 48', sub: 'Big haul', banner: true, gifts: 0 });
    expect(of(r.idle(3), 'finale')).toHaveLength(0);
  });

  it('a clean sweep pays 10, even when the last gift is caught 4 s after the end; never later than 6 s', () => {
    // The 48th gift drops 62 to 84 m ahead on the tick of 'end': it is still coming at 2.5 s.
    const late = new Rig({ event: ChaosEvent.GiftStorm, triggerZ: 500 });
    for (let k = 0; k < 48; k++) late.sim.dyn.storm.push({ z: k < 47 ? 0 : 180, collected: k < 47 });
    late.sim.s.z = 100;
    late.frame([{ type: 'chaos', phase: 'end', event: ChaosEvent.GiftStorm }]);
    expect(of(late.idle(4), 'finale')).toHaveLength(0);
    late.sim.dyn.storm[47].collected = true;
    expect(of(late.frame(), 'finale')[0]).toMatchObject({ text: 'Caught 48 of 48', sub: 'Clean sweep: +10 gifts', gifts: 10 });
    const r = new Rig({ event: ChaosEvent.GiftStorm, triggerZ: 500 });
    for (let k = 0; k < 48; k++) r.sim.dyn.storm.push({ z: 1000, collected: k < 47 });
    r.frame([{ type: 'chaos', phase: 'end', event: ChaosEvent.GiftStorm }]);
    expect(of(r.idle(5.9), 'finale')).toHaveLength(0);
    const out = r.idle(0.2);
    expect(of(out, 'finale')[0]).toMatchObject({ text: 'Caught 47 of 48' });
    const q = new Rig({ event: ChaosEvent.GiftStorm, triggerZ: 500 });
    for (let k = 0; k < 48; k++) q.sim.dyn.storm.push({ z: 0, collected: true });
    const s = q.frame([{ type: 'chaos', phase: 'end', event: ChaosEvent.GiftStorm }]);
    expect(of(s, 'finale')[0]).toMatchObject({ sub: 'Clean sweep: +10 gifts', gifts: 10 });
  });

  it('no Yeti dodged after a revive; dodged otherwise; the hop is a stamp', () => {
    const r = new Rig({ event: ChaosEvent.Yeti, triggerZ: 500 });
    r.frame([{ type: 'chaos', phase: 'warn', event: ChaosEvent.Yeti }]);
    const a = r.frame([{ type: 'chaos', phase: 'end', event: ChaosEvent.Yeti }]);
    expect(of(a, 'finale')[0]).toMatchObject({ outcome: 'dodged', gifts: 5, banner: false, say: { label: 'Yeti dodged' } });

    const q = new Rig({ event: ChaosEvent.Yeti, triggerZ: 500 });
    q.frame([{ type: 'chaos', phase: 'warn', event: ChaosEvent.Yeti }]);
    q.frame([{ type: 'crash', cause: 'yeti' }]);
    q.d.revive();
    expect(of(q.frame([{ type: 'chaos', phase: 'end', event: ChaosEvent.Yeti }, { type: 'revive' }]), 'finale')).toHaveLength(0);

    const h = new Rig({ event: ChaosEvent.Yeti, triggerZ: 500 });
    const hop = h.frame([style('yetiHop', 1500)]);
    expect(of(hop, 'finale')[0]).toMatchObject({ outcome: 'hopped', stamp: true, text: 'Yeti hop' });
    expect(of(hop, 'callout')).toHaveLength(0);
    h.idle(0.5);
    const st = h.frame([style('perfect', 300), land('perfect')]);
    // The hop's 1,500 is its finale stamp's: the stomp keeps the title but never shows 1,500 again.
    expect(of(st, 'stomp')[0]).toMatchObject({ title: 'Yeti hop', yetiHop: true, lead: [{ label: 'Stomp', points: 300 }] });
    expect(of(st, 'stomp')[0].lead.some((p) => p.points === 1500)).toBe(false);
  });

  it('the Spirit Train always ends on a finale', () => {
    const r = new Rig({ event: ChaosEvent.GhostTrain, triggerZ: 500 });
    r.frame([{ type: 'chaos', phase: 'start', event: ChaosEvent.GhostTrain }]);
    r.sim.stats.draftTicks += 372;
    const a = r.frame([{ type: 'chaos', phase: 'end', event: ChaosEvent.GhostTrain }]);
    expect(of(a, 'finale')[0]).toMatchObject({ outcome: 'rode', text: 'Rode the Spirit Train 6.2 s', sub: '+6 gifts', gifts: 6 });
    const q = new Rig({ event: ChaosEvent.GhostTrain, triggerZ: 500 });
    q.frame([{ type: 'chaos', phase: 'start', event: ChaosEvent.GhostTrain }]);
    q.sim.stats.draftTicks += 20;
    const b = q.frame([{ type: 'chaos', phase: 'end', event: ChaosEvent.GhostTrain }]);
    expect(of(b, 'finale')[0]).toMatchObject({ outcome: 'passed', text: 'The Spirit Train passed', gifts: 0 });
  });

  it('the avalanche escape is the banner, and its +2,000 style callout is not shown twice', () => {
    const r = new Rig({ event: ChaosEvent.Avalanche, triggerZ: 500 });
    const a = r.frame([{ type: 'chaos', phase: 'success', event: ChaosEvent.Avalanche }, style('avalanche', 2000)]);
    expect(of(a, 'finale')[0]).toMatchObject({ text: 'Outran the avalanche', sub: '+2,000 style', banner: true });
    expect(of(a, 'callout')).toHaveLength(0);
  });

  it('the countdown steps in 10 m from 400 m, and the note when the event never came', () => {
    const r = new Rig({ event: ChaosEvent.Yeti, triggerZ: 900 });
    r.sim.dyn.triggerZ = 900;
    r.sim.s.z = 450;
    const step = () => r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: [], poses: new Map(), standings: { next: null, rank: 1, of: 1 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false });
    expect(step().hud.countdown).toBeNull();
    r.sim.s.z = 501;
    expect(step().hud.countdown).toEqual({ event: ChaosEvent.Yeti, metres: 400 });
    r.sim.s.z = 685;
    expect(step().hud.countdown).toEqual({ event: ChaosEvent.Yeti, metres: 220 });
    r.sim.s.crashed = true;
    expect(r.d.eventNote(r.sim as unknown as Sim)).toBe('The yeti was 220 m away.');
    r.sim.dyn.yeti.phase = 1;
    expect(r.d.eventNote(r.sim as unknown as Sim)).toBeNull();
  });
});

describe('mission and unlock pops', () => {
  function popRig(): { r: Rig; calls: number[] } {
    const calls: number[] = [];
    let n = 0;
    const r = new Rig({
      missionsCrossed: () => {
        calls.push(++n);
        return n === 2 ? [{ id: 'pass1', text: 'Pass a ghost', reward: 25 }] : [];
      },
    });
    r.sim.tick = 1000;
    return { r, calls };
  }

  it('pops once the moment is clear, polled at 2 Hz', () => {
    const { r, calls } = popRig();
    const out = r.idle(2);
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls.length).toBeLessThanOrEqual(5);
    expect(of(out, 'missionPop')).toHaveLength(1);
  });

  it('defers behind a stomp, and gives up after 8 s', () => {
    const { r } = popRig();
    r.idle(0.45);
    // Keep stomping: the pop waits for 1.6 s of quiet that never comes, then gives up.
    const out: Beat[] = [];
    for (let i = 0; i < 13; i++) {
      out.push(...r.frame([style('perfect'), land('perfect')]));
      out.push(...r.idle(0.7));
    }
    expect(of(out, 'missionPop')).toHaveLength(0);
    expect(of(r.idle(3), 'missionPop')).toHaveLength(0);
  });

  it('a mission met as an unlock pops as the unlock banner leaves (a fresh save)', () => {
    let n = 0;
    const r = new Rig({
      lifetimePassed: 3,
      unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }],
      missionsCrossed: () => (++n === 1 ? [{ id: 'pass1', text: 'Pass a ghost', reward: 25 }] : []),
    });
    const g = track(1001);
    r.tracks = [g];
    r.poses.set(1001, pose(r.sim.s.z - 3));
    r.sim.tick = 1000;
    r.passed = 1;
    const out = [...r.frame([], { race: [{ type: 'pass', track: g, first: true }] }), ...r.idle(8)];
    const pops = out.filter((b) => b.type === 'unlockPop' || b.type === 'missionPop');
    expect(pops.map((b) => b.type)).toEqual(['unlockPop', 'missionPop']);
    // Past the unlock's 2.6 s on screen (one banner at a time), inside its 200 ms exit, and well under
    // the 3.5 s spacing that put 'Pass a ghost' after the crash of short first runs.
    const gap = (pops[1].tick - pops[0].tick) / 60;
    expect(gap).toBeGreaterThanOrEqual(2.6);
    expect(gap).toBeLessThan(2.8);
  });

  it('a ghost close enough to duel waits for the mission queued behind the unlock', () => {
    let n = 0;
    const r = new Rig({
      lifetimePassed: 3,
      unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }],
      missionsCrossed: () => (++n === 1 ? [{ id: 'pass1', text: 'Pass a ghost', reward: 25 }] : []),
    });
    const g = track(1001);
    const near = track(1002);
    r.tracks = [g, near];
    r.poses.set(1001, pose(r.sim.s.z - 3));
    r.poses.set(1002, pose(r.sim.s.z + 30));
    r.sim.tick = 1000;
    r.passed = 1;
    const out = [...r.frame([], { race: [{ type: 'pass', track: g, first: true }] })];
    out.push(...r.idle(1.5));
    const unlock = of(out, 'unlockPop');
    expect(unlock).toHaveLength(1);
    // A ghost rides up alongside while the unlock shows: it has its 60 ticks within 1.5 m well before
    // the unlock's banner leaves, and it is still there when the mission is due.
    r.poses.set(1002, pose(r.sim.s.z + 0.8));
    out.push(...r.idle(4));
    const mission = of(out, 'missionPop');
    const open = of(out, 'duel').filter((d) => d.phase === 'open');
    expect(mission).toHaveLength(1);
    expect((mission[0].tick - unlock[0].tick) / 60).toBeLessThan(2.8);
    // The duel opens under no banner: after the mission's has had POP_BANNER_S (2.5 s).
    expect(open).toHaveLength(0);
    out.push(...r.idle(1.5));
    const later = of(out, 'duel').filter((d) => d.phase === 'open');
    expect(later).toHaveLength(1);
    expect((later[0].tick - mission[0].tick) / 60).toBeGreaterThanOrEqual(2.5);
  });

  it('two missions keep the usual spacing', () => {
    let n = 0;
    const r = new Rig({
      missionsCrossed: () => (++n === 1 ? [{ id: 'pass1', text: 'Pass a ghost', reward: 25 }, { id: 'air', text: 'Catch air', reward: 25 }] : []),
    });
    r.sim.tick = 1000;
    const pops = of(r.idle(8), 'missionPop');
    expect(pops).toHaveLength(2);
    expect((pops[1].tick - pops[0].tick) / 60).toBeGreaterThanOrEqual(POP_DEFER.spacing / 1000 - 0.02);
  });

  it("a mission's give-up clock runs only at the head of the queue (behind a slow unlock it loses no time)", () => {
    let n = 0;
    const r = new Rig({
      lifetimePassed: 3,
      unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }],
      missionsCrossed: () => (++n === 1 ? [{ id: 'pass1', text: 'Pass a ghost', reward: 25 }] : []),
    });
    const g = track(1001);
    r.tracks = [g];
    r.poses.set(1001, pose(r.sim.s.z - 3));
    r.sim.tick = 1000;
    r.passed = 1;
    const out = [...r.frame([], { race: [{ type: 'pass', track: g, first: true }] })];
    // Stomps keep the moment busy for 6 s: the unlock waits at the head; the mission behind it.
    for (let i = 0; i < 6; i++) {
      out.push(...r.frame([style('perfect'), land('perfect')]));
      out.push(...r.idle(0.98));
    }
    out.push(...r.idle(8));
    const pops = out.filter((b) => b.type === 'unlockPop' || b.type === 'missionPop');
    expect(pops.map((b) => b.type)).toEqual(['unlockPop', 'missionPop']);
    // The mission popped about 9 s after it was met: more than its 8 s give-up, all of it spent waiting
    // behind the unlock, and still inside the 15 s hard cap.
    expect((pops[1].tick - 1001) / 60).toBeGreaterThan(8);
    expect((pops[1].tick - 1001) / 60).toBeLessThan(15);
  });

  it('a pop more than 15 s after its moment is dropped, however little it waited at the head', () => {
    let n = 0;
    const r = new Rig({
      lifetimePassed: 3,
      unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }],
      missionsCrossed: () => (++n === 1 ? [{ id: 'pass1', text: 'Pass a ghost', reward: 25 }] : []),
    });
    const g = track(1001);
    r.tracks = [g];
    r.poses.set(1001, pose(r.sim.s.z - 3));
    r.passed = 1;
    const out = [...r.frame([], { race: [{ type: 'pass', track: g, first: true }] })];
    // Stomps for 16 s: the unlock gives up at the head after 12 s; the mission then waits only 3 s at
    // the head, but it is 15 s past its moment and goes.
    for (let i = 0; i < 16; i++) {
      out.push(...r.frame([style('perfect'), land('perfect')]));
      out.push(...r.idle(0.98));
    }
    out.push(...r.idle(4));
    expect(out.filter((b) => b.type === 'unlockPop' || b.type === 'missionPop')).toHaveLength(0);
  });

  it('waits for the start-line call while its ghost gets ready, then for the call to clear', () => {
    const { r } = popRig();
    const g = track(1001, 'grudge');
    g.ready = false;
    r.tracks = [g];
    r.poses.set(1001, pose(110));
    // The mission is met at about 1 s; the grudge's ghost is ready only at 2.5 s.
    const early = r.idle(2.5);
    expect(of(early, 'missionPop')).toHaveLength(0);
    g.ready = true;
    const call = r.idle(0.1);
    expect(of(call, 'raceCall')).toHaveLength(1);
    // The call shows for POP_DEFER.call; the pop follows once it has cleared.
    expect(of(r.idle(POP_DEFER.call / 1000 - 0.3), 'missionPop')).toHaveLength(0);
    expect(of(r.idle(1), 'missionPop')).toHaveLength(1);
  });

  it('a slow cold load: no track ready for 11 s, the call still comes once one is; pops do not wait all that time', () => {
    let n = 0;
    const r = new Rig({ missionsCrossed: () => (++n === 2 ? [{ id: 'm', text: 'Ride 200 m', reward: 25 }] : []) });
    r.sim.tick = 400;
    const g = track(1001, 'grudge', 'Mila');
    const h = track(1002);
    g.ready = false;
    h.ready = false;
    r.tracks = [g, h];
    r.poses.set(1001, pose(130));
    r.poses.set(1002, pose(120));
    const early = r.idle(11);
    expect(of(early, 'raceCall')).toHaveLength(0);
    // The mission (met at 0.5 s) pops once the call's usual wait (6 s) is over, not after 11 s.
    const pop = of(early, 'missionPop')[0];
    expect(pop).toBeDefined();
    expect((pop.tick - 400) / 60).toBeLessThan(8);
    // The tracks arrive: the call comes late rather than never.
    g.ready = true;
    h.ready = true;
    const late = r.idle(0.2);
    expect(of(late, 'raceCall')[0]).toMatchObject({ word: 'Rematch', ghost: { name: 'Mila' } });
  });

  it('defers behind a shown pass, then shows', () => {
    const { r } = popRig();
    const g = track(1001);
    r.tracks = [g];
    r.poses.set(1001, pose(110));
    r.idle(0.45);
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    const soon = r.idle(1.2);
    expect(of([...a, ...soon], 'missionPop')).toHaveLength(0);
    expect(of(r.idle(1), 'missionPop')).toHaveLength(1);
  });

  it('waits while a duel is fresh, then shows while it runs on (the duel is in the pill)', () => {
    let n = 0;
    const r = new Rig({ missionsCrossed: () => (++n === 4 ? [{ id: 'pass1', text: 'Pass a ghost', reward: 25 }] : []) });
    const g = track(1001);
    r.tracks = [g];
    r.sim.tick = 2000;
    // (One frame clear first: the rig's first frame steps the director from tick 0.)
    r.poses.set(1001, pose(r.sim.s.z + 10));
    r.frame();
    r.poses.set(1001, pose(r.sim.s.z + 0.5));
    // The duel opens at about 1 s, the mission is met at about 1.5 s.
    const out = r.idle(3.4);
    const open = of(out, 'duel')[0];
    expect(open?.phase).toBe('open');
    expect(of(out, 'missionPop')).toHaveLength(0);
    const later = r.idle(0.3);
    const pop = of(later, 'missionPop')[0];
    expect(pop).toBeDefined();
    expect((pop.tick - open.tick) / 60).toBeGreaterThanOrEqual(2.45);
    expect(r.d.step({ phase: 'run', dt: 1 / 60, sim: r.sim as unknown as Sim, events: [], race: [], tracks: r.tracks, poses: r.poses, standings: { next: null, rank: 1, of: 2 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: 0, reduced: false }).hud.duel).toBe(true);
  });

  it('waits for the start-line call', () => {
    const calls: number[] = [];
    // The mission is met about 1 s in, after the call at 0.6 s.
    const r = new Rig({ missionsCrossed: () => (calls.push(1) === 3 ? [{ id: 'm', text: 'x', reward: 1 }] : []) });
    r.sim.tick = 400;
    const g = track(1001, 'friend', 'Mila');
    r.tracks = [g];
    r.poses.set(1001, pose(105));
    const a = r.idle(2.5);
    expect(of(a, 'raceCall')[0]).toMatchObject({ word: 'Racing' });
    expect(of(a, 'missionPop')).toHaveLength(0);
    expect(of(r.idle(1), 'missionPop')).toHaveLength(1);
  });

  it('an unlock pops on the live count, once, from the first shown pass', () => {
    const r = new Rig({ lifetimePassed: 3, unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }] });
    const g = track(1001);
    r.tracks = [g];
    r.poses.set(1001, pose(r.sim.s.z - 3));
    r.sim.tick = 1000;
    r.idle(0.2);
    r.passed = 1;
    const out = [...r.frame([], { race: [{ type: 'pass', track: g, first: true }] }), ...r.idle(2)];
    expect(of(out, 'unlockPop')[0]).toMatchObject({ id: 'frostfang', name: 'Frostfang Glacier' });
    expect(of(r.idle(8), 'unlockPop')).toHaveLength(0);
  });

  it('start-line jostles count toward an unlock but never pop it before a shown pass', () => {
    const r = new Rig({ lifetimePassed: 1, unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }] });
    const gs = [track(1), track(2), track(3), track(4)];
    r.tracks = gs;
    for (const g of gs) r.poses.set(g.entry.id, pose(r.sim.s.z - 0.5));
    r.sim.tick = 100;
    // Three jostles in the start bunch: 4 lifetime passes, but nothing you saw.
    const jostles = r.frame([], { race: gs.slice(0, 3).map((g) => ({ type: 'pass' as const, track: g, first: true })) });
    expect(of(jostles, 'pass').every((p) => p.muted)).toBe(true);
    r.passed = 3;
    expect(of(r.idle(8), 'unlockPop')).toHaveLength(0);
    // The first overtake you saw: now the mountain is news.
    const shown = r.frame([], { race: [{ type: 'pass', track: gs[3], first: true }] });
    r.passed = 4;
    expect(of(shown, 'pass')[0].muted).toBe(false);
    expect(of(r.idle(2), 'unlockPop')).toHaveLength(1);
  });

  it('an unlock crossed mid duel waits out its fresh start, then pops (the duel runs on in the pill)', () => {
    let n = 0;
    const r = new Rig({
      lifetimePassed: 3,
      unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }],
      missionsCrossed: () => (++n === 1 ? [{ id: 'm', text: 'Pass a ghost', reward: 25 }] : []),
    });
    const g = track(1001);
    const h = track(1002);
    r.tracks = [g, h];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 10));
    r.poses.set(1002, pose(r.sim.s.z - 30));
    // A shown pass of the other ghost, the 4th of a lifetime: the unlock and a mission are met.
    r.passed = 1;
    const a = r.frame([], { race: [{ type: 'pass', track: h, first: true }] });
    r.poses.set(1001, pose(r.sim.s.z + 0.5));
    expect(of(a, 'pass')[0].muted).toBe(false);
    const fresh = r.idle(1.1);
    expect(of(fresh, 'duel')[0]?.phase).toBe('open');
    const open = of(fresh, 'duel')[0];
    const during = r.idle(6.5);
    const pops = during.filter((b) => b.type === 'unlockPop' || b.type === 'missionPop');
    // The unlock first, once the duel is 2.5 s old; then the mission after the spacing.
    expect(pops.map((b) => b.type)).toEqual(['unlockPop', 'missionPop']);
    expect((pops[0].tick - open.tick) / 60).toBeGreaterThanOrEqual(2.45);
  });

  it("a duel resolved under a pop's banner keeps its result's hold for after the banner", () => {
    // ver-3: 'Ember Peak unlocked' went up mid duel, the result landed under it, and the next banner
    // took the race row as it left, so the duel's ending never showed.
    let n = 0;
    const r = new Rig({
      lifetimePassed: 3,
      unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }],
      missionsCrossed: () => (++n === 1 ? [{ id: 'm', text: 'Pass a ghost', reward: 25 }] : []),
    });
    const g = track(1001);
    const h = track(1002);
    r.tracks = [g, h];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 10));
    r.poses.set(1002, pose(r.sim.s.z - 30));
    r.passed = 1;
    r.frame([], { race: [{ type: 'pass', track: h, first: true }] });
    r.poses.set(1001, pose(r.sim.s.z + 0.5));
    expect(of(r.idle(1.1), 'duel')[0]?.phase).toBe('open');
    const mid = r.idle(2.6);
    const unlock = of(mid, 'unlockPop')[0];
    expect(unlock).toBeDefined();
    // The duel ends right under the unlock's banner.
    r.poses.set(1001, pose(r.sim.s.z - 5));
    const after = r.idle(6);
    expect(of(after, 'duel')[0]?.phase).toBe('won');
    const mission = of(after, 'missionPop')[0];
    expect(mission).toBeDefined();
    // The result flashes for its 1.5 s once the banner (2.6 s) has gone; only then the mission.
    expect((mission.tick - unlock.tick) / 60).toBeGreaterThanOrEqual(2.6 + 1.5 - 0.05);
  });

  it('back-to-back duels leave a waiting unlock its moment between them', () => {
    const r = new Rig({ lifetimePassed: 3, unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }] });
    const a = track(1001);
    const b = track(1002);
    r.tracks = [a, b];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.5));
    r.poses.set(1002, pose(r.sim.s.z + 1.0));
    expect(of(r.idle(1.5), 'duel').map((d) => [d.phase, d.ghost.id])).toEqual([['open', 1001]]);
    r.passed = 1;
    expect(of(r.idle(3), 'unlockPop')).toHaveLength(0);
    // The first duel is won; the second ghost was right there all along.
    r.poses.set(1001, pose(r.sim.s.z - 5));
    const after = r.idle(5);
    const order = after.filter((x) => x.type === 'unlockPop' || x.type === 'duel').map((x) => (x.type === 'duel' ? `${x.phase}:${x.ghost.id}` : x.type));
    expect(order).toEqual(['won:1001', 'unlockPop', 'open:1002']);
    const won = after.find((x) => x.type === 'duel')!;
    const pop = after.find((x) => x.type === 'unlockPop')!;
    const open = after.filter((x) => x.type === 'duel')[1];
    expect((pop.tick - won.tick) / 60).toBeGreaterThanOrEqual(1.35);
    // The next duel waits out the pop's banner (it covers the race row; an unlock's is up 2.6 s), then
    // opens.
    expect((open.tick - pop.tick) / 60).toBeGreaterThanOrEqual(2.6);
    expect((open.tick - pop.tick) / 60).toBeLessThanOrEqual(2.85);
  });

  it("with nothing waiting, the next duel opens as soon as the last result's flash is over", () => {
    const r = new Rig();
    const a = track(1001);
    const b = track(1002);
    r.tracks = [a, b];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 0.5));
    r.poses.set(1002, pose(r.sim.s.z + 1.0));
    r.idle(1.5);
    r.poses.set(1001, pose(r.sim.s.z - 5));
    const after = r.idle(1.6);
    const duels = of(after, 'duel');
    expect(duels.map((d) => `${d.phase}:${d.ghost.id}`)).toEqual(['won:1001', 'open:1002']);
    expect((duels[1].tick - duels[0].tick) / 60).toBeCloseTo(1.5, 1);
  });

  it('the pass that leaves one to go teases the unlock once', () => {
    const r = new Rig({ lifetimePassed: 2, unlockLadder: [{ id: 'frostfang', name: 'Frostfang Glacier', biome: 'glacier', need: 4 }] });
    const g = track(1001);
    r.tracks = [g];
    r.poses.set(1001, pose(110));
    r.passed = 1;
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    // News about the field, keyed to no ghost: a duel ghost's pill never takes it for its own news.
    expect(of(a, 'raceNews')[0]).toMatchObject({ news: 'unlockTease', text: '1 more ghost opens Frostfang Glacier', ghost: { id: -1, name: '' } });
  });
});

describe('the grudge settled', () => {
  const grudgeAtStart = { name: 'Mila', record: 'r', them: 3, streak: 3 };
  function nemesisRig(): { r: Rig; g: GhostTrack } {
    const r = new Rig({ grudgeAtStart });
    const g = track(1001, 'grudge', 'Mila');
    g.entry.nemesis = true;
    g.distance = 365;
    r.tracks = [g];
    return { r, g };
  }

  it('a start-line jostle settles nothing and pays only the base; a wreck ridden past settles, once', () => {
    const { r, g } = nemesisRig();
    r.sim.tick = 100;
    r.poses.set(1001, pose(100.5));
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(a, 'pass')[0]).toMatchObject({ word: 'jostle', muted: true, gifts: 5 });
    expect(of(a, 'grudgeSettled')).toHaveLength(0);
    expect(r.d.grudgeSettled).toBe(false);
    // It overtakes you back and crashes ahead at 365 m.
    r.poses.set(1001, pose(365, 0, true));
    r.sim.distance = 360;
    expect(of(r.idle(1), 'grudgeSettled')).toHaveLength(0);
    r.sim.distance = 366;
    const b = of(r.frame(), 'grudgeSettled');
    expect(b).toHaveLength(1);
    // The nemesis is worth 20 in all: the jostle paid its 5, the settle pays the rest.
    expect(b[0]).toMatchObject({ nemesis: true, after: 3, paid: 15, ghost: { name: 'Mila' } });
    expect(b[0].say).toBeUndefined();
    expect(r.d.grudgeSettled).toBe(true);
    r.sim.distance = 400;
    expect(of(r.idle(1), 'grudgeSettled')).toHaveLength(0);
  });

  it('still riding behind you past where it ended: the settle waits for its wipeout and takes it in', () => {
    const { r, g } = nemesisRig();
    r.sim.tick = 100;
    r.poses.set(1001, pose(100.5));
    r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    // You cross its end distance with it still riding, off screen behind you: nothing yet.
    r.sim.tick = 1200;
    r.sim.s.z = 370;
    r.sim.distance = 370;
    r.poses.set(1001, pose(350));
    expect(of(r.idle(1), 'grudgeSettled')).toHaveLength(0);
    // Its wipeout behind you is the moment: one banner with the wipeout on its sub-line, no news line.
    r.poses.set(1001, pose(358, 0, true));
    g.crashSeen = true;
    const w = r.frame([], { race: [{ type: 'crashed', track: g }] });
    const s = of(w, 'grudgeSettled');
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ nemesis: true, paid: 15, say: { label: 'Wiped out behind you' } });
    expect(of(w, 'raceNews')).toHaveLength(0);
  });

  it('a shown pass pays the whole premium through the settle, never twice', () => {
    const r = new Rig({ grudgeAtStart: { name: 'Tess', record: 'r', them: 1, streak: 1 } });
    const g = track(1001, 'grudge', 'Tess');
    g.distance = 900;
    r.tracks = [g];
    r.poses.set(1001, pose(r.sim.s.z - 3));
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(a, 'grudgeSettled')[0]).toMatchObject({ paid: 10 });
    expect(of(a, 'pass')[0]).toMatchObject({ muted: false, gifts: 0 });
  });

  it('a shown pass settles it before its flash; a duel beaten settles it before its result', () => {
    const { r, g } = nemesisRig();
    r.poses.set(1001, pose(110));
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(a.map((b) => b.type).filter((t) => t === 'grudgeSettled' || t === 'pass')).toEqual(['grudgeSettled', 'pass']);

    const q = nemesisRig();
    q.r.sim.tick = 2000;
    q.r.poses.set(1001, pose(q.r.sim.s.z + 0.8));
    for (let i = 0; i < 61; i++) q.r.frame();
    q.r.poses.set(1001, pose(q.r.sim.s.z - 1));
    const p = q.r.frame([], { race: [{ type: 'pass', track: q.g, first: true }] });
    expect(of(p, 'grudgeSettled')).toHaveLength(0);
    q.r.poses.set(1001, pose(q.r.sim.s.z - 4.5));
    const w = q.r.frame();
    expect(w.map((b) => b.type).filter((t) => t === 'grudgeSettled' || t === 'duel')).toEqual(['grudgeSettled', 'duel']);
    // One moment, not a banner stacked on a result: the banner carries the duel's word.
    expect(of(w, 'grudgeSettled')[0].say?.label).toBe('Duel won');
    expect(q.r.d.grudgeSettled).toBe(true);
  });

  /** A second run's start bunch: the grudge, the opening duel's ghost and your best. */
  function bunchRig(): { r: Rig; g: GhostTrack; d: GhostTrack; y: GhostTrack } {
    const r = new Rig({ grudgeAtStart: { name: 'Tess', record: 'r', them: 1, streak: 1 } });
    const g = track(1001, 'grudge', 'Tess');
    g.distance = 900;
    const d = track(1002, 'pool', 'MarmotMateo');
    const y = track(1003, 'you', 'Rider');
    r.tracks = [g, d, y];
    r.sim.tick = 2000;
    r.poses.set(1001, pose(r.sim.s.z + 6));
    r.poses.set(1002, pose(r.sim.s.z + 0.8));
    r.poses.set(1003, pose(r.sim.s.z + 30));
    return { r, g, d, y };
  }

  it("passed while another ghost's duel runs: the banner waits out the duel and its result's flash, then no duel opens under it", () => {
    const { r, g, d, y } = bunchRig();
    expect(of(r.idle(1.1), 'duel').map((b) => b.phase)).toEqual(['open']);
    // You pass the grudge mid duel: its pass (the callout line's) is paid, its banner waits.
    r.poses.set(1001, pose(r.sim.s.z - 3));
    const p = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(p, 'pass')[0]).toMatchObject({ muted: false, gifts: 0 });
    expect(of(p, 'grudgeSettled')).toHaveLength(0);
    expect(r.d.grudgeSettled).toBe(false);
    expect(of(r.idle(2), 'grudgeSettled')).toHaveLength(0);
    // The duel resolves: 'Held off' (or 'Duel won') owns the pill for its 1.5 s hold, then the banner.
    r.poses.set(1002, pose(r.sim.s.z - 5));
    const res = r.frame();
    expect(of(res, 'duel').map((b) => b.phase)).toEqual(['won']);
    expect(of(res, 'grudgeSettled')).toHaveLength(0);
    // Your best rides up beside you meanwhile: close enough to duel, but the banner goes first.
    r.poses.set(1003, pose(r.sim.s.z + 0.5));
    expect(of(r.idle(1.45), 'grudgeSettled')).toHaveLength(0);
    const up = r.idle(0.1);
    const s = of(up, 'grudgeSettled');
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ paid: 10, ghost: { name: 'Tess' } });
    expect(s[0].say).toBeUndefined();
    expect(r.d.grudgeSettled).toBe(true);
    // No duel opens under the rose banner (2.5 s): then your best's does.
    expect(of(r.idle(2.3), 'duel')).toHaveLength(0);
    expect(of(r.idle(0.3), 'duel').map((b) => `${b.phase}:${b.ghost.id}`)).toEqual([`open:${y.entry.id}`]);
    expect(of(r.idle(5), 'grudgeSettled')).toHaveLength(0);
    void d;
  });

  it("a duel with your best won while the grudge waits: 'Passed Your best' flashes first, then the banner", () => {
    // ver-3: both waited for the result's hold and went up on one tick, so the gold pass played 2.3 s
    // late under the rose banner.
    const { r, g, d, y } = bunchRig();
    r.poses.set(1002, pose(r.sim.s.z + 30));
    r.poses.set(1003, pose(r.sim.s.z + 0.8));
    expect(of(r.idle(1.1), 'duel').map((b) => `${b.phase}:${b.ghost.id}`)).toEqual([`open:${y.entry.id}`]);
    r.poses.set(1001, pose(r.sim.s.z - 3));
    expect(of(r.frame([], { race: [{ type: 'pass', track: g, first: true }] }), 'grudgeSettled')).toHaveLength(0);
    // Your best drops clear behind you with the crossing behind: the duel is won.
    y.status = 1;
    r.poses.set(1003, pose(r.sim.s.z - 5));
    const out = r.idle(6);
    const res = of(out, 'duel')[0];
    const pass = of(out, 'pass').find((b) => b.word === 'yourBest');
    const settle = of(out, 'grudgeSettled')[0];
    expect(res?.phase).toBe('won');
    expect(pass).toBeDefined();
    expect(settle).toBeDefined();
    expect(pass!.tick - res.tick).toBeGreaterThanOrEqual(89);
    expect(settle.tick - pass!.tick).toBeGreaterThanOrEqual(89);
    void d;
  });

  it("a slingshot burst through the bunch: the banner waits while it still counts, so 'Slung past Your best' shows", () => {
    const { r, g, y } = bunchRig();
    r.poses.set(1002, pose(r.sim.s.z + 30));
    r.poses.set(1001, pose(r.sim.s.z - 2));
    r.poses.set(1003, pose(r.sim.s.z - 2));
    const a = r.frame([{ type: 'boost', amount: 5, source: 'slingshot' }], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(a, 'pass')[0]).toMatchObject({ word: 'slung' });
    expect(of(a, 'grudgeSettled')).toHaveLength(0);
    const b = r.frame([], { ticks: 20, race: [{ type: 'pass', track: y, first: true }] });
    expect(of(b, 'pass')[0]).toMatchObject({ word: 'slung', text: 'Slung past 2', ghost: { kind: 'you' } });
    expect(of(b, 'grudgeSettled')).toHaveLength(0);
    // The burst stops counting 90 ticks after its last pass: then the banner.
    expect(of(r.frame([], { ticks: 89 }), 'grudgeSettled')).toHaveLength(0);
    expect(of(r.frame([], { ticks: 2 }), 'grudgeSettled')).toHaveLength(1);
  });

  it('a banner held by a burst goes before a mission met meanwhile, and a pass streak holds it 3 s at most', () => {
    let met = false;
    const r = new Rig({ grudgeAtStart: { name: 'Tess', record: 'r', them: 1, streak: 1 }, missionsCrossed: () => (met ? ((met = false), [{ id: 'm', text: 'Collect 20 gifts in one run', reward: 25 }]) : []) });
    const g = track(1001, 'grudge', 'Tess');
    g.distance = 900;
    const pack = [1, 2, 3, 4, 5, 6, 7].map((i) => track(i));
    r.tracks = [g, ...pack];
    r.sim.tick = 2000;
    for (const t of r.tracks) r.poses.set(t.entry.id, pose(r.sim.s.z + 20 + t.entry.id / 100));
    // (Past the start-line call.)
    r.idle(3.5);
    // A pass streak through the pack, one every 0.8 s: the grudge third.
    const order = [pack[0], pack[1], g, pack[2], pack[3], pack[4], pack[5], pack[6]];
    const beats: Array<{ at: number; b: Beat }> = [];
    let at = 0;
    for (const t of order) {
      r.poses.set(t.entry.id, pose(r.sim.s.z - 2));
      if (t === pack[2]) met = true;
      for (const b of r.frame([], { race: [{ type: 'pass', track: t, first: true }] })) beats.push({ at, b });
      for (let i = 0; i < 47; i++) for (const b of r.frame()) beats.push({ at: at + (i + 1) / 60, b });
      at += 0.8;
    }
    for (let i = 0; i < 300; i++) for (const b of r.frame()) beats.push({ at: at + i / 60, b });
    const settle = beats.find((x) => x.b.type === 'grudgeSettled');
    const pop = beats.find((x) => x.b.type === 'missionPop');
    expect(settle).toBeDefined();
    expect(pop).toBeDefined();
    // The grudge was passed at 1.6 s: the streak holds its banner 3 s, no more, and the mission waits for it.
    expect(settle!.at - 1.6).toBeGreaterThan(2.9);
    expect(settle!.at - 1.6).toBeLessThan(3.1);
    expect(pop!.at).toBeGreaterThan(settle!.at + 2.49);
  });

  it('a plain pass of the grudge with nothing else on: the banner at once, as its picture', () => {
    const { r, g } = bunchRig();
    r.poses.set(1002, pose(r.sim.s.z + 30));
    r.poses.set(1001, pose(r.sim.s.z - 2));
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(a.map((b) => b.type).filter((t) => t === 'grudgeSettled' || t === 'pass')).toEqual(['grudgeSettled', 'pass']);
  });

  it('a banner still waiting when the run ends goes up on the crash frame, with its gifts', () => {
    const { r, g } = bunchRig();
    r.idle(1.1);
    r.poses.set(1001, pose(r.sim.s.z - 3));
    expect(of(r.frame([], { race: [{ type: 'pass', track: g, first: true }] }), 'grudgeSettled')).toHaveLength(0);
    r.sim.s.crashed = true;
    const c = r.frame([{ type: 'crash', cause: 'tree' } as SimEvent]);
    expect(of(c, 'grudgeSettled')).toHaveLength(1);
    expect(of(c, 'grudgeSettled')[0].paid).toBe(10);
    expect(r.d.grudgeSettled).toBe(true);
  });

  it("pops wait out the grudge's banner", () => {
    let met = false;
    const r = new Rig({ grudgeAtStart: { name: 'Tess', record: 'r', them: 1, streak: 1 }, missionsCrossed: () => (met ? ((met = false), [{ id: 'm', text: 'Pass a ghost', reward: 0 }]) : []) });
    const g = track(1001, 'grudge', 'Tess');
    g.distance = 900;
    r.tracks = [g];
    r.sim.tick = 2000;
    // (The start-line call, 'Rematch Tess', has its 2.6 s first.)
    r.poses.set(1001, pose(r.sim.s.z + 20));
    r.idle(3.5);
    r.poses.set(1001, pose(r.sim.s.z - 2));
    met = true;
    const a = r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect(of(a, 'grudgeSettled')).toHaveLength(1);
    const wait = r.idle(2.4);
    expect(of(wait, 'missionPop')).toHaveLength(0);
    expect(of(r.idle(0.7), 'missionPop')).toHaveLength(1);
  });

  it('crashed past it settles nothing (the crash owns the moment)', () => {
    const { r } = nemesisRig();
    r.sim.s.crashed = true;
    r.sim.distance = 400;
    expect(of(r.frame([], { phase: 'crashed' }), 'grudgeSettled')).toHaveLength(0);
  });
});

describe('graveyards', () => {
  it('riding 20 m past one alive is its beat, once, with 3 gifts inside the extras cap', () => {
    const r = new Rig({ graveyards: [{ z: 395, name: "Widow's Bend", fell: 4 }, { z: 600, name: 'Grim Gully', fell: 3 }] });
    r.sim.distance = 414;
    expect(of(r.frame(), 'graveyard')).toHaveLength(0);
    r.sim.distance = 415.5;
    const a = of(r.frame(), 'graveyard');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ name: "Widow's Bend", fell: 4, gifts: 3, say: { label: "Survived Widow's Bend", tone: 'big' } });
    expect(of(r.idle(1), 'graveyard')).toHaveLength(0);
    // Crashed past the next one: nothing; a revive keeps what was survived and still pays the rest.
    r.sim.s.crashed = true;
    r.sim.distance = 640;
    expect(of(r.frame([], { phase: 'crashed' }), 'graveyard')).toHaveLength(0);
    r.d.revive();
    r.sim.s.crashed = false;
    const b = of(r.frame(), 'graveyard');
    expect(b.map((g) => g.name)).toEqual(['Grim Gully']);
  });

  it('pays only what the run has left of its extras', () => {
    const r = new Rig({ graveyards: [{ z: 300, name: 'Grim Gully', fell: 3 }] });
    // Spend the cap on finales and duels: take() is shared.
    (r.d as unknown as { extras: { take(n: number): number } }).extras.take(29);
    r.sim.distance = 330;
    expect(of(r.frame(), 'graveyard')[0].gifts).toBe(1);
  });
});

describe('the choir', () => {
  it('counts passed ghosts still riding within 150 m behind, at most 3; never a jostle', () => {
    const r = new Rig();
    r.sim.tick = 2000;
    const gs = [track(1), track(2), track(3), track(4), track(5)];
    r.tracks = gs;
    for (const g of gs) r.poses.set(g.entry.id, pose(r.sim.s.z + 30));
    const frameAudio = (race: RaceEvent[] = []) => {
      r.frame([], { race });
      return (r.d as unknown as { out: { audio: { choir: number } } }).out.audio.choir;
    };
    expect(frameAudio()).toBe(0);
    // Passed 1 and 2 (shown passes): they sit behind you now.
    r.poses.set(1, pose(r.sim.s.z - 5));
    r.poses.set(2, pose(r.sim.s.z - 40));
    expect(frameAudio([{ type: 'pass', track: gs[0], first: true }, { type: 'pass', track: gs[1], first: true }])).toBe(2);
    // One falls 160 m back, one crashes: neither sings.
    r.poses.set(2, pose(r.sim.s.z - 160));
    expect(frameAudio()).toBe(1);
    r.poses.set(1, pose(r.sim.s.z - 5, 0, true));
    expect(frameAudio()).toBe(0);
    // Four more passes: the choir tops out at 3.
    for (const id of [2, 3, 4, 5]) r.poses.set(id, pose(r.sim.s.z - 10));
    r.idle(2);
    expect(frameAudio([2, 3, 4].map((i) => ({ type: 'pass' as const, track: gs[i], first: true })))).toBe(3);
    // A ghost that passes you back is ahead again: out of the choir until passed.
    r.poses.set(3, pose(r.sim.s.z + 4));
    r.poses.set(4, pose(r.sim.s.z + 4));
    expect(frameAudio()).toBe(2);
  });

  it('a start-line jostle never joins it', () => {
    const r = new Rig();
    r.sim.tick = 100;
    const g = track(7);
    r.tracks = [g];
    r.poses.set(7, pose(r.sim.s.z - 2));
    r.frame([], { race: [{ type: 'pass', track: g, first: true }] });
    expect((r.d as unknown as { out: { audio: { choir: number } } }).out.audio.choir).toBe(0);
  });
});

describe('bests within a run', () => {
  it("a second bank under this run's best is no new best; a lost combo under it is no best combo lost", () => {
    const r = new Rig({ bestComboAtStart: 2000 });
    const chain = () => {
      for (const k of ['spin', 'flip', 'nearMiss'] as const) r.frame([style(k, 100, 2)]);
    };
    chain();
    const a = of(r.frame([{ type: 'comboBank', points: 3000, mult: 3 }]), 'bank')[0];
    expect(a).toMatchObject({ tier: 3, header: 'New best combo', origin: 1000 });
    chain();
    const b = of(r.frame([{ type: 'comboBank', points: 2500, mult: 5 }]), 'bank')[0];
    expect(b).toMatchObject({ tier: 1, header: null, origin: 500 });
    const c = of(r.frame([{ type: 'comboLost', points: 2600 }]), 'comboLost')[0];
    expect(c).toMatchObject({ best: false, crack: true, say: { label: 'Combo lost' } });
  });
});

describe('a first record is no news', () => {
  it('a save with no best combo grades banks by size alone, and never says best combo lost', () => {
    const r = new Rig({ bestComboAtStart: 0 });
    const chain = () => {
      for (const k of ['spin', 'flip', 'nearMiss'] as const) r.frame([style(k, 100, 2)]);
    };
    chain();
    expect(of(r.frame([{ type: 'comboBank', points: 1200, mult: 3 }]), 'bank')[0]).toMatchObject({ header: null });
    chain();
    const b = of(r.frame([{ type: 'comboBank', points: 1875, mult: 3 }]), 'bank')[0];
    expect(b.header).toBeNull();
    expect(b.tier).toBeLessThan(3);
    const c = of(r.frame([{ type: 'comboLost', points: 2600 }]), 'comboLost')[0];
    expect(c).toMatchObject({ best: false, say: { label: 'Combo lost' } });
  });
});

describe('the crash beat', () => {
  it('starts the render curve and counts scaled time; reduced motion has no curve', () => {
    const r = new Rig();
    const a = r.frame([{ type: 'crash', cause: 'rock' }]);
    expect(of(a, 'crash')).toHaveLength(1);
    r.d.time.step(0.016);
    expect(r.d.time.render).toBe(0);
    const q = new Rig();
    q.frame([{ type: 'crash', cause: 'rock' }], { reduced: true });
    q.d.time.step(0.016);
    expect(q.d.time.render).toBe(1);
  });
});

describe('the pack past your wreck', () => {
  /** A rig with the rider at z 100 and these ghosts at their gaps (+ = ahead), then the crash frame. */
  const crashed = (gaps: Array<number | 'done'>) => {
    const r = new Rig();
    gaps.forEach((g, i) => {
      r.tracks.push(track(i + 1));
      r.poses.set(i + 1, g === 'done' ? pose(90, 0, true) : pose(100 + g));
    });
    r.sim.s.crashed = true;
    r.frame([{ type: 'crash', cause: 'tree' }]);
    return r;
  };
  const move = (r: Rig, id: number, gap: number) => r.poses.set(id, pose(100 + gap));
  const wrecks = (beats: Beat[]) => of(beats, 'passedBy').filter((b) => b.wreck);

  it('each ghost behind you at the crash says it passed you once, as it leads the wreck by 0.8 m', () => {
    // G1 and G2 ride behind, G3 is ahead, G4 crashed behind: only G1 and G2 can ride past.
    const r = crashed([-5, -30, 5, 'done']);
    // The first crashed frame records who is behind.
    expect(wrecks(r.frame([], { phase: 'crashed' }))).toHaveLength(0);
    move(r, 1, 0.5);
    expect(wrecks(r.frame([], { phase: 'crashed' }))).toHaveLength(0);
    move(r, 1, 0.9);
    const a = r.frame([], { phase: 'crashed' });
    expect(wrecks(a)).toHaveLength(1);
    expect(wrecks(a)[0]).toMatchObject({ type: 'passedBy', muted: false, wreck: true, ghost: { id: 1, name: 'G1' } });
    // Said, never paid: no pass beat, nothing to credit.
    expect(of(a, 'pass')).toHaveLength(0);
    move(r, 1, 6);
    expect(wrecks(r.frame([], { phase: 'crashed' }))).toHaveLength(0);
    move(r, 3, 12);
    move(r, 2, 1);
    expect(wrecks(r.frame([], { phase: 'crashed' })).map((b) => b.ghost.id)).toEqual([2]);
    expect(r.d.wreckPassed).toBe(2);
    // Telemetry can tell them from live passes.
    expect(r.d.log.filter((e) => e.type === 'passedBy' && e.grade === 'wreck')).toHaveLength(2);
  });

  it('a ghost that stops riding behind the wreck is dropped unsaid', () => {
    const r = crashed([-8]);
    r.frame([], { phase: 'crashed' });
    r.poses.set(1, pose(96, 0, true));
    r.frame([], { phase: 'crashed' });
    r.poses.set(1, pose(110, 0, false));
    expect(wrecks(r.frame([], { phase: 'crashed' }))).toHaveLength(0);
    expect(r.d.wreckPassed).toBe(0);
  });

  it('holds the results while a recorded ghost still rides within 25 m behind the wreck', () => {
    const r = crashed([-30, -12]);
    r.frame([], { phase: 'crashed' });
    // G2 at 12 m back holds; G1 at 30 m does not.
    expect(r.d.wreckPending()).toBe(true);
    move(r, 2, 1);
    r.frame([], { phase: 'crashed' });
    expect(r.d.wreckPending(25)).toBe(false);
    move(r, 1, -24);
    r.frame([], { phase: 'crashed' });
    expect(r.d.wreckPending(25)).toBe(true);
    expect(r.d.wreckPending(20)).toBe(false);
    // Gone by: the hold ends.
    move(r, 1, 2);
    r.frame([], { phase: 'crashed' });
    expect(r.d.wreckPending()).toBe(false);
  });

  it('says nothing in the run, once the results are up, or after a revive', () => {
    const live = new Rig();
    live.tracks.push(track(1));
    live.poses.set(1, pose(95));
    live.frame();
    live.poses.set(1, pose(101));
    expect(wrecks(live.frame())).toHaveLength(0);

    const r = crashed([-6, -9]);
    r.frame([], { phase: 'crashed' });
    move(r, 1, 1);
    expect(wrecks(r.frame([], { phase: 'crashed' }))).toHaveLength(1);
    // The results open: the rest of the pack rides by without a word, and nothing holds them.
    r.d.endCrash();
    expect(r.d.wreckPending()).toBe(false);
    move(r, 2, 1);
    expect(wrecks(r.frame([], { phase: 'crashed' }))).toHaveLength(0);

    // A revive rides on from where the ghosts were: no crossings replayed, the count starts over.
    const q = crashed([-6]);
    q.frame([], { phase: 'crashed' });
    q.d.revive();
    q.sim.s.crashed = false;
    expect(q.d.wreckPending()).toBe(false);
    expect(q.d.wreckPassed).toBe(0);
    move(q, 1, 3);
    expect(wrecks(q.frame())).toHaveLength(0);
    // The next crash records afresh.
    move(q, 1, -4);
    q.sim.s.crashed = true;
    q.frame([{ type: 'crash', cause: 'rock' }]);
    q.frame([], { phase: 'crashed' });
    move(q, 1, 1);
    expect(wrecks(q.frame([], { phase: 'crashed' }))).toHaveLength(1);
  });
});

describe('the stomp metronome', () => {
  it('ticks on the way down and opens on the stomp window, never repeating', () => {
    const r = new Rig();
    r.sim.s.grounded = false;
    const out: Beat[] = [];
    const seq = [1.0, 0.8, 0.62, 0.55, 0.44, 0.5, 0.4, 0.29, 0.2, 0.14, 0.05];
    for (const t of seq) out.push(...r.frame([], { timeToLand: t, airTicks: 40 }));
    expect(of(out, 'stompTick').map((b) => [b.step, b.open])).toEqual([
      [2, false],
      [3, false],
      [4, false],
      [5, true],
    ]);
  });
});
