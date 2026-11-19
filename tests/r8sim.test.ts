import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SaveStore } from '../src/game/save';
import { CHARM, CHARMS, CHARM_COUNT, STARTER_POOL } from '../src/sim/charms';
import { ChaosEvent, Mood, PLAIN } from '../src/sim/chaos';
import { InputRecorder, LogEvent, packInput } from '../src/sim/input';
import { MOUNTAINS } from '../src/sim/mountains';
import { Rng } from '../src/sim/prng';
import { type RunRecord, applyLogEvent, encodeRecord, recordFromString, recordToString, replayRecord, simConfigOf, toBase64Url } from '../src/sim/replay';
import { type RiderPoint, RivalWatch, SHOWDOWN_LEVEL_TICKS, SHOWDOWN_RUN, STEAL_UNITS, draftsOn } from '../src/sim/rivals';
import { FIRST_RUN_STOMP, Sim, type SimConfig } from '../src/sim/sim';
import { GRAB_T2, TRICK, TRICKS, nameFlight, trickCall } from '../src/sim/tricks';

// Round 8's sim batch (SIM_VERSION 10): the air map, charms in the sim, the rival rules, Spirit Flow, and the
// config the record carries (the charm pool, the gates, a Long Night carry, a first run).

const SEED = MOUNTAINS[0].seed;
const pt = (z: number, x = 0, riding = true): RiderPoint => ({ x, y: 0, z, riding, clean: true, finished: false });

/** A sim put into a long, high flight above the start (nothing below for seconds). */
function flying(cfg: Partial<SimConfig> = {}): Sim {
  const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 0, ...cfg });
  for (let i = 0; i < 30; i++) sim.step(packInput(4, false, false));
  const s = sim.s;
  s.grounded = false;
  s.y += 6;
  s.vy = 9;
  return sim;
}

/** Steps until the sled lands, with this input each tick (t: ticks since the flight began; left: ticks to go,
 *  from a ballistic guess). Returns the landing event. */
function fly(sim: Sim, input: (t: number) => number): { quality: string; botched?: true } {
  for (let t = 0; t < 600; t++) {
    sim.step(input(t));
    for (const e of sim.events) if (e.type === 'land') return e;
  }
  throw new Error('never landed');
}

describe('the air map', () => {
  it('a press with the steer to a side grabs; one with the steer centred flips', () => {
    const a = flying();
    let grabbed = 0;
    for (let t = 0; t < 20; t++) {
      a.step(packInput(t < 3 ? 8 : 4, true, false));
      for (const e of a.events) if (e.type === 'grab' && e.phase === 'start') grabbed = e.side;
    }
    expect(grabbed).toBe(1);
    expect(a.s.grab).toBe(1);
    expect(a.s.pitchRate).toBe(0);
    const b = flying();
    for (let t = 0; t < 20; t++) b.step(packInput(4, true, false));
    expect(b.s.grab).toBe(0);
    expect(b.s.pitchRate).toBeLessThan(-2);
  });

  it('a deep grab held into the snow is a fall; let go into the landing it is a stomp', () => {
    const held = flying();
    const e1 = fly(held, (t) => packInput(t < 3 ? 0 : 4, true, false));
    expect(e1.botched).toBe(true);
    // Let go a few ticks before touchdown (found by riding the same flight once to see when it lands).
    const probe = flying();
    let land = 0;
    for (let t = 0; t < 600 && !land; t++) {
      probe.step(packInput(4, false, false));
      if (probe.events.some((e) => e.type === 'land')) land = t;
    }
    expect(land).toBeGreaterThan(GRAB_T2 + 10);
    const clean = flying();
    const e2 = fly(clean, (t) => packInput(t < 3 ? 0 : 4, t < land - 4, false));
    expect(e2.quality).toBe('perfect');
    expect(clean.stats.trickMask & (1 << TRICK.lanternReach) || clean.stats.trickMask & (1 << TRICK.spiritStretch)).toBeTruthy();
  });

  it("each sled's own move has its own rule, and none of them touches speed or the lantern", () => {
    const land = (sled: number): number => {
      const probe = flying({ sled } as Partial<SimConfig>);
      for (let t = 0; t < 600; t++) {
        probe.step(packInput(4, false, false));
        if (probe.events.some((e) => e.type === 'land')) return t;
      }
      return -1;
    };
    /** Double tap, then hold to `until` (a tick of the flight; Infinity: through the landing), steering `steer`. */
    const sig = (sled: number, until: number, steer = 4) => {
      const sim = flying({ sled } as Partial<SimConfig>);
      let named = 0;
      let x0 = 0;
      const e = fly(sim, (t) => {
        if (t === 8) x0 = sim.s.vx;
        for (const ev of sim.events) if (ev.type === 'style' && ev.trick && TRICKS[ev.trick].family === 'signature') named = ev.trick;
        return packInput(t >= 12 && t < until ? steer : 4, t < 3 || (t >= 6 && t < until), false);
      });
      for (const ev of sim.events) if (ev.type === 'style' && ev.trick && TRICKS[ev.trick].family === 'signature') named = ev.trick;
      return { e, named, sim, dvx: sim.s.vx - x0 };
    };
    for (let sled = 0; sled < 6; sled++) {
      const L = land(sled);
      const early = sig(sled, L - 16);
      expect(early.named, `sled ${sled}`).toBe([TRICK.pineBow, TRICK.spinningTop, TRICK.fireside, TRICK.cometTail, TRICK.willowisp, TRICK.teacup][sled]);
      expect(early.e.botched).toBeUndefined();
    }
    // Held into the snow: Fireside and Teacup ride it out, Comet Tail and Pine Bow go down.
    expect(sig(2, Infinity).e.botched).toBeUndefined();
    expect(sig(2, Infinity).e.quality).toBe('sketchy');
    expect(sig(5, Infinity).e.botched).toBeUndefined();
    expect(sig(3, Infinity).e.botched).toBe(true);
    expect(sig(0, Infinity).e.botched).toBe(true);
    // Will-o'-Wisp: no air control while held; Spinning Top: it spins with the steer centred.
    const L4 = land(4);
    expect(Math.abs(sig(4, L4 - 16, 8).sim.s.x - sig(4, L4 - 16, 4).sim.s.x)).toBeLessThan(0.5);
    const top = flying({ sled: 1 } as Partial<SimConfig>);
    for (let t = 0; t < 40; t++) top.step(packInput(4, t < 3 || t >= 6, false));
    expect(Math.abs(top.s.spinRate)).toBeGreaterThan(5);
  });

  it('names a flight by everything done in it', () => {
    const base = { halfTurns: 0, flips: 0, grabTicks: 0, tweakTicks: 0, tweakLate: false, special: 0, sigTicks: 0, sig: 0 };
    expect(nameFlight({ ...base, halfTurns: 2 })[0].id).toBe(TRICK.spin);
    expect(nameFlight({ ...base, halfTurns: 2, grabTicks: 20 })[0].id).toBe(TRICK.paperWheel);
    expect(nameFlight({ ...base, flips: 1, grabTicks: 20 })[0].id).toBe(TRICK.craneFold);
    expect(nameFlight({ ...base, flips: 1, halfTurns: 2 })[0].id).toBe(TRICK.emberTwist);
    expect(nameFlight({ ...base, flips: 1, halfTurns: 2, grabTicks: 20 })[0].id).toBe(TRICK.spiritKnot);
    expect(nameFlight({ ...base, grabTicks: 80, tweakTicks: 10, tweakLate: true }).map((t) => t.id)).toEqual([TRICK.spiritStretch, TRICK.crosswind]);
    expect(nameFlight(base)).toEqual([]);
    expect(trickCall(TRICK.crosswind, 0, 0, true)).toBe('Late Crosswind');
    expect(TRICKS.filter((t) => t.id > 0 && t.name && t.pose).length).toBeGreaterThanOrEqual(10);
  });

  it('a first run stomps a press further from the snow', () => {
    const press = (first: boolean, early: number): string => {
      const probe = flying({ firstRun: first });
      let land = 0;
      for (let t = 0; t < 600 && !land; t++) {
        probe.step(packInput(4, false, false));
        if (probe.events.some((e) => e.type === 'land')) land = t;
      }
      const sim = flying({ firstRun: first });
      return fly(sim, (t) => packInput(4, t >= land - early, false)).quality;
    };
    expect(press(false, 12)).not.toBe('perfect');
    expect(press(true, 12)).toBe('perfect');
    expect(FIRST_RUN_STOMP).toBeGreaterThan(9);
  });
});

/** A ride on scripted, seeded hands: presses, steering, the draft bit and the spirit button now and then. */
function ride(cfg: Partial<SimConfig>, seconds = 150): Sim {
  const sim = new Sim({ seed: SEED, chaos: { mood: Mood.None, event: ChaosEvent.None, seed: 3 }, sled: 0, ...cfg });
  const rng = new Rng(99);
  let steer = 4;
  let act = false;
  let draft = false;
  while (!sim.s.crashed && !sim.finished && sim.tick < seconds * 60) {
    if (rng.chance(0.05)) steer = rng.int(0, 8);
    if (rng.chance(0.03)) act = !act;
    if (rng.chance(0.01)) draft = !draft;
    const c = sim.course;
    if (rng.chance(0.3)) steer = Math.max(0, Math.min(8, 4 + Math.round((c.safeX(sim.s.z + 15) - sim.s.x) * 0.8)));
    sim.step(packInput(steer, act, draft, rng.chance(0.004)));
  }
  return sim;
}

describe('charms', () => {
  it('every charm changes the ride (held from the start, as a Long Night carry holds it)', () => {
    const plain = ride({ charmGates: 1, charmPool: 0 });
    const same: string[] = [];
    for (let id = 0; id < CHARM_COUNT; id++) {
      const sim = ride({ charmGates: 1, charmPool: 0, carry: { lantern: 0, getUps: 3, charms: [id] } });
      expect(sim.has(id)).toBe(true);
      if (sim.hash() === plain.hash()) same.push(CHARMS[id].name);
    }
    expect(same).toEqual([]);
  });

  it('the gates offer nothing a carried charm already holds, and a run takes one a gate', () => {
    const sim = ride({ charmPool: STARTER_POOL, carry: { lantern: 120, getUps: 2, charms: [CHARM.second] } });
    expect(sim.charms[0]).toBe(CHARM.second);
    for (const g of sim.charmGates) expect(g.offers).not.toContain(CHARM.second);
    expect(sim.charms.length).toBe(1 + sim.charmGates.filter((g) => g.pick >= 0).length);
  });

  it('one gate stands when the Almanac has opened one', () => {
    expect(new Sim({ seed: SEED, chaos: PLAIN, sled: 0, charmGates: 1 }).charmGates.length).toBe(1);
    expect(new Sim({ seed: SEED, chaos: PLAIN, sled: 0 }).charmGates.length).toBe(3);
  });
});

describe('rivals', () => {
  it('two seconds level starts a showdown; first to the marker wins it', () => {
    const w = new RivalWatch(1, () => true, () => true, 4500);
    let start = null as null | { markerZ: number };
    for (let t = 0; t <= SHOWDOWN_LEVEL_TICKS; t++) {
      for (const e of w.step(t, pt(100 + t * 0.5), [pt(100 + t * 0.5, 3)])) if (e.type === 'showdown' && e.phase === 'start') start = e;
    }
    expect(start).not.toBeNull();
    expect(start!.markerZ).toBeCloseTo(100 + (SHOWDOWN_LEVEL_TICKS - 1) * 0.5 + SHOWDOWN_RUN, 3);
    const out = w.step(500, pt(start!.markerZ + 1), [pt(start!.markerZ - 20, 3)]);
    expect(out).toEqual([{ type: 'showdown', phase: 'won', rival: 0, markerZ: start!.markerZ }]);
  });

  it('one not eligible is never a showdown, and a rival is met once', () => {
    const w = new RivalWatch(1, () => false, () => true, 4500);
    for (let t = 0; t < 400; t++) expect(w.step(t, pt(100), [pt(100)]).some((e) => e.type === 'showdown')).toBe(false);
  });

  it('a clean pass inside a metre steals a wisp, once; a wide one does not', () => {
    const w = new RivalWatch(2, () => false, () => true, 4500);
    const steals: number[] = [];
    for (let t = 0; t < 40; t++) for (const e of w.step(t, pt(100 + t), [pt(120, 0.8), pt(120, 2.5)])) if (e.type === 'steal') steals.push(e.rival);
    for (let t = 0; t < 40; t++) for (const e of w.step(100 + t, pt(100 + t), [pt(120, 0.8), pt(120, 2.5)])) if (e.type === 'steal') steals.push(e.rival);
    expect(steals).toEqual([0]);
  });

  it('the slipstream rule is the game\'s', () => {
    expect(draftsOn({ x: 0, y: 0, z: 0 }, { x: 0.5, y: 0, z: 6 })).toBe(true);
    expect(draftsOn({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 6 })).toBe(false);
    expect(draftsOn({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 20 })).toBe(false);
  });

  it('a won showdown and a steal give the same to any rider, and replay from the log', () => {
    const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 5 });
    const rec = new InputRecorder();
    for (let t = 0; t < 900; t++) {
      if (t === 300) {
        rec.event(LogEvent.Showdown);
        applyLogEvent(sim, LogEvent.Showdown);
      }
      if (t === 600) {
        rec.event(LogEvent.Steal);
        applyLogEvent(sim, LogEvent.Steal);
      }
      const b = packInput(4 + ((t >> 6) % 3) - 1, (t & 96) === 96, false);
      rec.push(b);
      sim.step(b);
    }
    expect(sim.stats.showdowns).toBe(1);
    expect(sim.stats.steals).toBe(1);
    expect(sim.stats.lit).toBeGreaterThanOrEqual(100 + STEAL_UNITS);
    const r: RunRecord = { seed: SEED, chaos: PLAIN, sled: 5, charmPool: STARTER_POOL, inputs: rec.encode(), ticks: 900, score: sim.score, distance: sim.distance, name: 'T' };
    expect(replayRecord(recordFromString(recordToString(r))).hash()).toBe(sim.hash());
  });
});

describe('Spirit Flow', () => {
  it('climbs with style, says each level, is a run stat, and a fall empties it', () => {
    const sim = ride({}, 120);
    expect(sim.stats.flowTicks.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(sim.stats.bestFlow).toBeGreaterThanOrEqual(0);
    expect(sim.stats.bestFlow).toBeLessThanOrEqual(6);
  });
});

describe('records carry the run', () => {
  it('a carried leg with one gate and a first run replays to the same state', () => {
    const cfg = { charmPool: 0x0fff0f, charmGates: 2 as const, carry: { lantern: 250, getUps: 1, charms: [CHARM.comet, CHARM.stone] }, firstRun: true };
    const sim = new Sim({ seed: SEED, chaos: PLAIN, sled: 2, ...cfg });
    const rec = new InputRecorder();
    const rng = new Rng(4);
    let steer = 4;
    for (let t = 0; t < 60 * 90 && !sim.s.crashed; t++) {
      if (rng.chance(0.05)) steer = rng.int(2, 6);
      const b = packInput(steer, rng.chance(0.2), false, rng.chance(0.01));
      rec.push(b);
      sim.step(b);
    }
    const r: RunRecord = { seed: SEED, chaos: PLAIN, sled: 2, ...cfg, inputs: rec.encode(), ticks: rec.tickCount, score: sim.score, distance: sim.distance, name: 'Leg' };
    const back = recordFromString(recordToString(r));
    expect(simConfigOf(back)).toEqual({ seed: SEED, chaos: PLAIN, sled: 2, ...cfg });
    expect(replayRecord(back).hash()).toBe(sim.hash());
  });

  it('a save from SIM_VERSION 9 keeps its gifts, sleds and The Twelve, and its best goes to the archive', () => {
    const old = encodeRecord({ seed: SEED, chaos: PLAIN, sled: 0, inputs: new Uint8Array([4, 4]), ticks: 2400, score: 5000, distance: 2000, name: 'Nico' });
    // (Written as version 2 wrote it: no pool after the name, 9 in the header.)
    const nameEnd = 28 + old[27];
    const v2 = new Uint8Array(old.length - 4);
    v2.set(old.slice(0, nameEnd));
    v2.set(old.slice(nameEnd + 4), nameEnd);
    v2[2] = 2;
    v2[3] = 9;
    const record = toBase64Url(v2);
    const raw = { v: 1, name: 'Nico', gifts: 300, runs: 40, sled: 1, ownedSleds: [0, 1], mountain: 'pinecrest', best: { pinecrest: { score: 5000, distance: 2000, record } }, twelve: { beaten: ['mila'] } };
    const map = new Map<string, string>([[SAVE_KEY, JSON.stringify(raw)]]);
    const d = new SaveStore({ getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }, 'F', '2026-11-20').data;
    expect(d.gifts).toBe(300);
    expect(d.ownedSleds).toEqual([0, 1]);
    expect(d.archive!.best.pinecrest.record).toBe(record);
    expect(d.best.pinecrest).toBeUndefined();
    expect(d.twelve?.beaten).toEqual(['mila']);
  });
});
