// Round 8, the modes lane: a Long Night ridden in node through the game layer, as the app rides one (app.ts
// rideNight, startRun, crossedLine, nightBetween, settleNight). Each leg is a Run (src/game/run.ts) on the leg's
// mountain with the leg's chaos (modes.ts nightLeg) and the carry the last leg ended with at its line (nightOn); a
// leg's record is replayed alone from its own string, and must come back to the same state, holding the same carry
// out; the night's depth is settled into a save as the results settle it (settleLongNight).
//
// Pure node: no browser. Imported by scripts/playtest/r8-night.ts and tests/modes.test.ts.
import { almanacPool } from '../../src/game/almanac';
import { CARRIED_CHARMS, type LongNightCarry, type Night, legStep, nightDepth, nightLeg, nightOn, settleLongNight, startNight } from '../../src/game/modes';
import { Run } from '../../src/game/run';
import type { LongNightSave } from '../../src/game/spinesave';
import { moodInfo, eventInfo, Mood, ChaosEvent } from '../../src/sim/chaos';
import { CHARMS } from '../../src/sim/charms';
import { MOUNTAINS } from '../../src/sim/mountains';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { recordFromString, recordToString, replayRecord } from '../../src/sim/replay';
import { classic, spenderFor } from './labpilots';

export interface LegReport {
  n: number;
  mountain: string;
  mirror: boolean;
  /** The chaos step (legStep), its mood and event by name. */
  step: number;
  mood: string;
  event: string;
  carriedIn: LongNightCarry | null;
  /** What the sim held on its first tick: the carry as the sim took it. */
  startHeld: { lantern: number; getUps: number; charms: number[] };
  finished: boolean;
  seconds: number;
  metres: number;
  /** What it held at the line (or at the fall). */
  heldOut: { lantern: number; getUps: number; charms: number[] };
  charmNames: string[];
  /** The live sim's hash where the record ends, and the record replayed alone from its string. */
  hash: number;
  replayHash: number;
  replayHeld: { lantern: number; getUps: number; charms: number[] };
  /** The carry as the leg's record holds it (decoded from its string): the lantern in whole points, as the sim takes it. */
  recordCarry: { lantern: number; getUps: number; charms: number[] } | null;
  recordBytes: number;
}

export interface NightReport {
  seed: number;
  pilotSeed: number;
  legs: LegReport[];
  depth: LongNightSave;
  best: { before: LongNightSave | undefined; after: LongNightSave | undefined; newBest: boolean };
  ok: { carries: boolean; replays: boolean; chaosRises: boolean };
}

const held = (sim: Run['sim']): { lantern: number; getUps: number; charms: number[] } => ({ lantern: sim.s.lantern, getUps: sim.s.getUps, charms: [...sim.charms] });
const same = (a: { lantern: number; getUps: number; charms: number[] }, b: { lantern: number; getUps: number; charms: number[] }): boolean =>
  a.lantern === b.lantern && a.getUps === b.getUps && a.charms.length === b.charms.length && a.charms.every((c, i) => c === b.charms[i]);

/** Rides one night of `legs` legs with the lab's mid pilot (or `pilot`), from a save on Almanac page `page`. */
export function rideNight(o: { seed: number; pilotSeed: number; legs: number; page?: number; pilot?: 'mid' | 'novice' | 'expert'; best?: LongNightSave; maxSeconds?: number }): NightReport {
  let night: Night | null = startNight(o.seed, o.legs);
  if (!night) throw new Error('no legs open');
  const pool = almanacPool({ rank: { claimed: o.page ?? 10, xp: 0 } } as never);
  const kit = { gateX, pathX, machineZ };
  const legs: LegReport[] = [];
  let depth: LongNightSave = { legs: 0, z: 0 };
  while (night) {
    const leg = nightLeg(night);
    const m = MOUNTAINS.find((x) => x.id === leg.mountain)!;
    const src: { pilot: (() => { steer: number; action: boolean }) | null; spend: (() => boolean) | null; sample(): { steer: number; action: boolean; spirit: boolean } } = {
      pilot: null,
      spend: null,
      sample() {
        const p = this.pilot!();
        // (A mirrored leg's steer is read the other way by the input layer; the pilot rides the sim's course as it
        // is, so it hands the sim the steer it means: the record is the same either way.)
        return { steer: p.steer, action: p.action, spirit: this.spend!() };
      },
    };
    const extra = { charmPool: pool, ...(leg.carry ? { carry: leg.carry } : {}) };
    const run = new Run(m.seed, leg.chaos, 0, src, extra);
    const sim = run.sim;
    const ps = (o.pilotSeed + legs.length * 7919) >>> 0;
    src.pilot = classic(o.pilot ?? 'mid', sim, ps, kit);
    src.spend = spenderFor(o.pilot ?? 'mid', sim, ps);
    const startHeld = held(sim);
    const max = (o.maxSeconds ?? 600) * 60;
    while (!sim.s.crashed && !sim.finished && sim.tick < max) run.tick();
    const out = held(sim);
    const rec = run.toRecord('modes-night');
    const str = recordToString(rec);
    const decoded = recordFromString(str);
    const back = replayRecord(decoded);
    legs.push({
      n: leg.n,
      mountain: leg.mountain,
      mirror: leg.mirror,
      step: legStep(night.leg),
      mood: leg.chaos.mood !== Mood.None ? moodInfo(leg.chaos.mood).name : '',
      event: leg.chaos.event !== ChaosEvent.None ? eventInfo(leg.chaos.event).name : '',
      carriedIn: night.carry,
      startHeld,
      finished: sim.finished,
      seconds: sim.tick / 60,
      metres: sim.distance,
      heldOut: out,
      charmNames: out.charms.map((id) => CHARMS[id]?.name ?? String(id)),
      hash: sim.hash(),
      replayHash: back.hash(),
      replayHeld: held(back),
      recordCarry: decoded.carry ? { lantern: decoded.carry.lantern, getUps: decoded.carry.getUps, charms: [...decoded.carry.charms] } : null,
      recordBytes: str.length,
    });
    depth = nightDepth(night, sim.finished, sim.distance);
    night = sim.finished ? nightOn(night, out) : null;
  }
  const settled = settleLongNight(o.best, depth.legs, depth.z);
  // (Each leg's record holds exactly what the last leg held at its line: the lantern in whole points, as the sim and the
  // record both take it.)
  const carries = legs.every((l, i) => {
    if (i === 0) return l.recordCarry === null;
    const h = legs[i - 1].heldOut;
    return l.recordCarry !== null && same(l.recordCarry, { lantern: Math.max(0, Math.min(300, Math.round(h.lantern))), getUps: Math.max(0, Math.min(3, h.getUps)), charms: h.charms.slice(-CARRIED_CHARMS) });
  });
  const replays = legs.every((l) => l.hash === l.replayHash && same(l.heldOut, l.replayHeld));
  const chaosRises = legs.every((l, i) => i === 0 || l.step >= legs[i - 1].step);
  return { seed: o.seed, pilotSeed: o.pilotSeed, legs, depth, best: { before: o.best, after: settled.save, newBest: settled.newBest }, ok: { carries, replays, chaosRises } };
}
