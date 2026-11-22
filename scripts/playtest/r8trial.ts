// Round 8, the trials lane: a week's Trial ridden in node through the game layer, as the app rides one (app.ts
// startRun with the week's Trial: its mountain, chaos and charm pool through trial.ts trialConfig, its field picked
// from the week's riders by field.ts pickField as the Cup's is, the run drafting and meeting that field by the sim's
// own rules (rivals.ts draftsOn and RivalWatch, as ghosts.ts draftProbe and rivalProbe do), the run's tally through
// Run.onStep, and the medal through trialValue and trialMedal against the targets the week's field sets).
//
// The week's riders are the worker's (src/game/trialfield.ts), made here in node. The pilots are the lab's
// (labpilots.ts trickster, the round 8 mid and expert who ride the air map and the charm gates, and their spenders).
//
// Pure node: no browser. Imported by scripts/playtest/r8-trials.ts and tests/trials.test.ts.
import { riderByName } from '../../src/bot/roster';
import { fieldCount, pickField } from '../../src/game/field';
import type { PoolGhostData } from '../../src/game/ghostdata';
import { Run } from '../../src/game/run';
import { paceOf, withSlowRiders } from '../../src/game/slowriders';
import { type Trial, type TrialTally, type TrialTargets, newTally, tallyStep, trialConfig, trialFor, trialMedal, trialTargets, trialValue } from '../../src/game/trial';
import { type TrialRun, trialField } from '../../src/game/trialfield';
import { moodInfo } from '../../src/sim/chaos';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { recordFromString, recordToString, replayRecord } from '../../src/sim/replay';
import { type RiderPoint, RivalWatch, draftsOn } from '../../src/sim/rivals';
import { spenderFor, trickster } from './labpilots';

export interface WeekField {
  trial: Trial;
  field: TrialRun[];
  values: (number | null)[];
  targets: TrialTargets | null;
  /** The race's pool, as the app makes it from the field (with its slow riders). */
  pool: PoolGhostData[];
}

/** A week's Trial and its field, with the field's figures and the targets they set. */
export function weekField(week: string): WeekField {
  const trial = trialFor(week);
  const field = trialField(trial);
  const values = field.map((r) => trialValue(trial.measure, r.tally));
  return { trial, field, values, targets: trialTargets(trial.measure, values), pool: withSlowRiders(field.map((r) => r.ghost), `trial/${week}`) };
}

export interface PilotRide {
  pilot: 'mid' | 'expert';
  seed: number;
  finished: boolean;
  seconds: number;
  metres: number;
  tumbles: number;
  /** What the run did as a Trial judges it. */
  tally: TrialTally;
  value: number | null;
  medal: number;
  /** Riders in the race with you, and how many drafted ticks the run had. */
  field: number;
  drafted: number;
  /** The run's SimConfig as the sim took it (asserted by the tests). */
  config: Run['sim']['config'];
  /** The record replays alone to the same figure. */
  replays: boolean;
}

/** A field rider's run, tick by tick, as the rules see it (played at its pace, as slow riders are). */
interface Ride {
  pts: RiderPoint[];
  pace: number;
}

function rideOf(record: string): Ride {
  const pts: RiderPoint[] = [];
  replayRecord(recordFromString(record), (s) => {
    const st = s.s;
    pts.push({ x: st.x, y: st.y, z: st.z, riding: !st.crashed && !st.finished && st.tumble === 0, clean: st.tumble === 0 && st.wobble === 0 && st.ghost === 0, finished: st.finished });
  });
  return { pts, pace: paceOf(record) };
}

function pointAt(r: Ride, tick: number): RiderPoint | null {
  const i = Math.floor(tick * r.pace);
  if (i < 0 || r.pts.length === 0) return null;
  const p = r.pts[Math.min(i, r.pts.length - 1)];
  // A run that ended without finishing is gone from the race once it ends.
  return i >= r.pts.length && !p.finished ? null : p;
}

/** One ride of the week's Trial by a lab pilot, raced against the field the app picks and judged as the app judges. */
export function rideTrial(w: WeekField, pilot: 'mid' | 'expert', seed: number, maxSeconds = 360): PilotRide {
  const t = w.trial;
  const cfg = trialConfig(t, 0);
  const picks = pickField({ pool: w.pool, kind: 'daily', mood: t.chaos.mood, event: t.chaos.event, count: fieldCount(moodInfo(t.chaos.mood).params.extraGhosts, []), anchor: 0, recent: [], seed: t.chaos.seed, bestScore: 0, you: null, grudge: null, friend: null, withheld: ['The Hollow King'] });
  const rides = picks.map((p) => rideOf(p.record));
  const src: { pilot: (() => { steer: number; action: boolean }) | null; spend: (() => boolean) | null; sample(): { steer: number; action: boolean; spirit: boolean } } = {
    pilot: null,
    spend: null,
    sample() {
      // (A mirrored Trial's steer is read the other way by the input layer; the pilot rides the sim's course as it is,
      // so it hands the sim the steer it means: the record is the same either way.)
      const p = this.pilot!();
      return { steer: p.steer, action: p.action, spirit: this.spend!() };
    },
  };
  const run = new Run(cfg.seed, cfg.chaos, cfg.sled, src, { charmPool: cfg.charmPool });
  const sim = run.sim;
  let drafted = 0;
  run.draftProbe = (tick, x, y, z) => {
    const me = { x, y, z };
    for (const r of rides) {
      // (As the bot drafts its field: the rider where it stood a tick before.)
      const p = pointAt(r, tick - 1);
      if (p && !p.finished && draftsOn(me, p)) {
        drafted++;
        return true;
      }
    }
    return false;
  };
  const watch = new RivalWatch(rides.length, (i) => riderByName(picks[i].name) !== null, () => true, sim.course.finishZ);
  const them: (RiderPoint | null)[] = rides.map(() => null);
  run.rivalProbe = (tick, me) => {
    for (let i = 0; i < rides.length; i++) them[i] = pointAt(rides[i], tick);
    return watch.step(tick, me, them);
  };
  const tally = newTally();
  run.onStep = (s) => tallyStep(tally, s);
  src.pilot = trickster(pilot, sim, seed, { gateX, pathX, machineZ });
  src.spend = spenderFor(pilot, sim, seed);
  while (!sim.s.crashed && !sim.finished && sim.tick < maxSeconds * 60) run.tick();
  const value = trialValue(t.measure, tally);
  const rec = recordFromString(recordToString(run.toRecord('trials-lab')));
  const again = newTally();
  replayRecord(rec, (s) => tallyStep(again, s));
  return {
    pilot,
    seed,
    finished: sim.finished,
    seconds: sim.tick / 60,
    metres: sim.distance,
    tumbles: tally.tumbles,
    tally,
    value,
    medal: w.targets ? trialMedal(t.measure, value, w.targets) : 0,
    field: picks.length,
    drafted,
    config: sim.config,
    replays: trialValue(t.measure, again) === value,
  };
}
