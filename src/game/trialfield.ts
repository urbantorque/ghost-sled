import { type Field, type Track, runBot } from '../bot/bot';
import { uniqueGhostName } from '../bot/names';
import { ROSTER, riderSkill } from '../bot/roster';
import { clamp } from '../sim/dmath';
import { MOUNTAINS } from '../sim/mountains';
import { Rng, hash32 } from '../sim/prng';
import { type RunRecord, recordToString, replayRecord } from '../sim/replay';
import type { PoolGhostData } from './ghostdata';
import { type Trial, type TrialTally, newTally, tallyStep, trialConfig } from './trial';

// A Trial's field (round 8, the trials lane): the week's riders, every one ridden by the bot on the Trial itself (its
// mountain, its chaos, its charm pool), so the race is run under the week's rules and the medal's targets come out of
// what riders of every pace did with them (trial.ts trialTargets). Made in the worker as the Cup's field is (the same
// for everyone: the bot and the sim are deterministic), and in node by the tests and the lab.
//
// Kept apart from trial.ts so the main bundle, which only reads a Trial, never carries the bot.

/** The crowd, stratified over the whole skill range; the racers at the fast end; three signature riders. */
export const CROWD = 20;
export const RACERS = 2;
export const SIGNED = 3;
/** A pool rider drafts the riders made before it nearest its skill, as the pools' do (bot/pool.ts). */
const FIELD = 7;

export interface TrialRun {
  ghost: PoolGhostData;
  tally: TrialTally;
  skill: number;
}

function fieldFor(made: readonly { skill: number; track: Track; signature: boolean }[], skill: number): Field {
  const near = made
    .map((r, i) => ({ r, i, d: Math.abs(r.skill - skill) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .slice(0, FIELD)
    .sort((a, b) => a.i - b.i);
  return { tracks: near.map((n) => n.r.track), duel: near.map((n) => n.r.signature) };
}

/** The week's field, weakest first by race order. maxTicks caps a run (the Cup's worker uses 3.5 minutes). */
export function trialField(t: Trial, maxTicks = 60 * 60 * 3.5): TrialRun[] {
  const cfg = trialConfig(t, 0);
  const mi = MOUNTAINS.findIndex((m) => m.seed === cfg.seed);
  const seed = t.seed;
  const made: { skill: number; track: Track; signature: boolean }[] = [];
  const runs: Array<{ record: RunRecord; skill: number }> = [];
  const ride = (skill: number, sled: number, name: string, botSeed: number, signature: boolean, style?: (typeof ROSTER)[number]['style']): void => {
    const { record, track } = runBot(cfg.seed, cfg.chaos, { skill, seed: botSeed, sled, name, charmPool: cfg.charmPool, ...(style ? { style } : {}) }, maxTicks, fieldFor(made, skill));
    made.push({ skill, track, signature });
    runs.push({ record, skill });
  };
  // The signature riders first, so the crowd can meet them in a showdown, as a player does.
  const pick = new Rng(hash32(seed, 0x51d3));
  // (The Hollow King waits for his duel: he rides in no field before it, twelve.ts withheldRiders.)
  const cast = ROSTER.filter((r) => r.key !== 'crown');
  for (let i = cast.length - 1; i > 0; i--) {
    const j = pick.int(0, i);
    [cast[i], cast[j]] = [cast[j], cast[i]];
  }
  for (const rd of cast.slice(0, SIGNED)) ride(riderSkill(rd, mi), rd.sled, rd.name, hash32(seed, 0x51d0, ROSTER.indexOf(rd)), true, rd.style);
  const rng = new Rng(hash32(seed, 0x9057));
  for (let i = 0; i < CROWD; i++) {
    const u = (i + rng.next()) / CROWD;
    ride(clamp(u * (1.25 - 0.25 * u), 0, 1), rng.chance(0.65) ? 0 : rng.int(1, 5), '', hash32(seed, i, 0xb075), false);
  }
  for (let i = 0; i < RACERS; i++) ride(1, i % 6, '', hash32(seed, 0xfa58, i), false, 'racer');

  const names = new Rng(hash32(seed, 0x4a3e));
  const taken = new Set(runs.map((r) => r.record.name).filter((n) => n));
  const out: TrialRun[] = runs.map(({ record: r, skill }) => {
    const record = { ...r, name: r.name || uniqueGhostName(names, taken) };
    // One replay of the record gives both its tally (judged as the player's run is) and where it went down.
    const tally = newTally();
    const falls: number[] = [];
    const sim = replayRecord(record, (s) => {
      tallyStep(tally, s);
      for (const e of s.events) if (e.type === 'crash' || e.type === 'ward' || (e.type === 'tumble' && e.phase === 'start')) falls.push(Math.round(s.s.z));
    });
    const ghost: PoolGhostData = {
      name: record.name,
      score: record.score,
      distance: Math.round(record.distance * 10) / 10,
      ticks: record.ticks,
      sled: record.sled,
      mood: record.chaos.mood,
      event: record.chaos.event,
      falls,
      record: recordToString(record),
      ...(sim.finished ? { finishTick: sim.s.finishTick } : {}),
    };
    return { ghost, tally, skill };
  });
  const key = (r: TrialRun): number => (r.tally.line ? 1e7 - r.tally.line.seconds * 60 : r.ghost.distance);
  return out.sort((a, b) => key(a) - key(b));
}
