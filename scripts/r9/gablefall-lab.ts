// Round 9, the lab on Gablefall's roofs (notes/r9-gablefall.md section 1). Its course ridden by the lab's own pilots
// (scripts/playtest/labpilots.ts: the careful line, novice, mid and expert, which on a kit course ride its lineFor and
// spring its lips; the mid pilot again on the street's middle, the street line; the clumsy pilot), a sled let go and the
// bot, with what the roofs ask measured on each ride: the time and speed, the share on the roofs (2 m or more over the
// street) of the run and of the rows, landings and perfect ones, drops into the street and climbs back up, falls and what
// they were, scrapes, the most a sled was ever lifted in a tick. Then the brief's bar, line by line. A lab sweep: run it
// in the heavy slot.
// `npx tsx scripts/r9/gablefall-lab.ts [--quick] [--out <dir>] [--seed <hex>]`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Bot } from '../../src/bot/bot';
import { ChaosEvent, Mood, PLAIN, type ChaosRoll } from '../../src/sim/chaos';
import { packInput } from '../../src/sim/input';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { GABLEFALL_LAB_SEED } from '../../src/sim/mountains';
import { UP, driftsOf, rowsOf } from '../../src/sim/gablefall';
import { Sim } from '../../src/sim/sim';
import { classic, clumsy } from '../playtest/labpilots';

const QUICK = process.argv.includes('--quick');
const outAt = process.argv.indexOf('--out');
const OUT = outAt >= 0 ? process.argv[outAt + 1] : 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gablefall';
const seedAt = process.argv.indexOf('--seed');
const COURSE = seedAt >= 0 ? parseInt(process.argv[seedAt + 1], 16) >>> 0 : GABLEFALL_LAB_SEED;
const SEEDS = Array.from({ length: QUICK ? 2 : 6 }, (_, i) => 1234 + 37 * i);
const CLUMSY = Array.from({ length: QUICK ? 6 : 30 }, (_, i) => 1234 + 37 * i);
const CAP = 900 * 60;

export interface Facts {
  who: string;
  seed: number;
  finished: boolean;
  seconds: number;
  mean: number;
  air: number;
  /** Ticks 2 m or more over the street, as a share of the run, and of the ticks inside the rows' spans. */
  roofs: number;
  roofsRows: number;
  /** Landings off a flight of 0.4 s or more, and the perfect ones. */
  landings: number;
  perfects: number;
  /** Drops from the roofs into the street (a tick on a roof, then one at the street's level inside the rows), climbs back
   *  up (the reverse), and the longest stretch of street ridden inside the rows between a drop and a climb. */
  drops: number;
  climbs: number;
  falls: number;
  /** Falls that were neither a chimney met head on nor a flight of 0.75 s or more landed wrong, and every fall's cause. */
  plainFalls: number;
  causes: string[];
  scrapes: number;
  bumps: number;
  /** The most the sled's y rose in one tick on the ground (a lift from below would show here). */
  maxLift: number;
  /** Where it was: z, and across from the street's middle. */
  liftAt: string;
  cause: string;
}

function ride(who: string, seed: number, chaos: ChaosRoll, input: (sim: Sim) => number, after?: () => void): Facts {
  const sim = new Sim({ seed: COURSE, chaos, sled: 0 });
  const c = sim.course;
  const rows = rowsOf(c);
  const inRows = (z: number): boolean => rows.some((r) => z >= r.z0 && z < r.z1);
  const f: Facts = { who, seed, finished: false, seconds: 0, mean: 0, air: 0, roofs: 0, roofsRows: 0, landings: 0, perfects: 0, drops: 0, climbs: 0, falls: 0, plainFalls: 0, causes: [], scrapes: 0, bumps: 0, maxLift: 0, liftAt: '', cause: '' };
  let n = 0;
  let sum = 0;
  let air = 0;
  let up = 0;
  let rowTicks = 0;
  let rowUp = 0;
  let wasUp = false;
  let lastLand: { airtime: number; botched: boolean; tick: number } | null = null;
  while (!sim.s.crashed && !sim.finished && sim.tick < CAP) {
    const s = sim.s;
    const y0 = s.y;
    const g0 = s.grounded;
    sim.step(input(sim));
    after?.();
    n++;
    sum += s.speed;
    if (!s.grounded) air++;
    if (g0 && s.grounded && s.tumble === 0 && s.y - y0 > f.maxLift) {
      f.maxLift = s.y - y0;
      f.liftAt = `z ${s.z.toFixed(1)} x ${(s.x - c.centerX(s.z)).toFixed(1)} v ${s.speed.toFixed(1)}`;
    }
    // On the roofs: over ground UP or more over the street's level (a roof, an alley's floor, a drift's top), and on it or
    // in the air over it (a pop in the street is not on the roofs).
    const gy = c.ground(s.x, s.z);
    const isUp = gy - c.baseY(s.z) >= UP - 0.5 && s.y >= gy - 0.05;
    if (isUp) up++;
    if (inRows(s.z) && !s.finished) {
      rowTicks++;
      if (isUp) rowUp++;
      if (s.grounded && s.tumble === 0) {
        if (wasUp && !isUp) f.drops++;
        if (!wasUp && isUp) f.climbs++;
        wasUp = isUp;
      }
    }
    for (const e of sim.events) {
      if (e.type === 'scrape') f.scrapes++;
      else if (e.type === 'bump') f.bumps++;
      else if (e.type === 'land' && !e.late) {
        lastLand = { airtime: e.airtime, botched: e.botched === true, tick: sim.tick };
        if (e.airtime >= 0.4) f.landings++;
        if (e.quality === 'perfect') f.perfects++;
      } else if (e.type === 'land' && e.late && e.quality === 'perfect') f.perfects++;
      else if (e.type === 'tumble' && e.phase === 'start') {
        f.falls++;
        f.causes.push(e.cause);
        const landed = lastLand && sim.tick - lastLand.tick <= 1 && lastLand.airtime >= 0.75 && lastLand.botched;
        if (e.cause !== 'chimney' && !landed) f.plainFalls++;
      }
    }
  }
  f.finished = sim.finished;
  f.seconds = sim.finished ? sim.s.finishTick / 60 : sim.tick / 60;
  f.mean = sum / Math.max(1, n);
  f.air = air / Math.max(1, n);
  f.roofs = up / Math.max(1, n);
  f.roofsRows = rowUp / Math.max(1, rowTicks);
  f.cause = sim.s.crashed ? String(sim.s.crashCause) : sim.finished ? '' : 'timeout';
  return f;
}

const kit = { gateX, pathX, machineZ };
const pilotRide = (name: 'line' | 'novice' | 'mid' | 'expert', seed: number, chaos: ChaosRoll = PLAIN, label: string = name, floor = false): Facts => {
  let pilot: ReturnType<typeof classic> | null = null;
  return ride(label, seed, chaos, (sim) => {
    if (!pilot) pilot = classic(name, sim, seed, { ...kit, floor });
    const o = pilot();
    return (o.steer | 0) | (o.action ? 16 : 0);
  }, () => pilot?.after?.());
};
const clumsyRide = (seed: number): Facts => {
  let pilot: ReturnType<typeof clumsy> | null = null;
  return ride('clumsy', seed, PLAIN, (sim) => {
    if (!pilot) pilot = clumsy(sim, seed);
    const o = pilot();
    return (o.steer | 0) | (o.action ? 16 : 0);
  });
};
const botRide = (skill: number, seed: number, style?: 'racer'): Facts => {
  let bot: Bot | null = null;
  return ride(`bot ${skill}${style ? ` ${style}` : ''}`, seed, PLAIN, (sim) => {
    if (!bot) bot = new Bot(sim, { skill, seed, sled: 0, name: 'Lab', style });
    return bot.input();
  }, () => bot?.observe());
};
const letGo = (): Facts => ride('let go', 1, PLAIN, () => packInput(4, false, false));

const t0 = performance.now();
const rows: Facts[] = [letGo()];
for (const name of ['line', 'novice', 'mid', 'expert'] as const) for (const s of SEEDS) rows.push(pilotRide(name, s));
for (const s of SEEDS) rows.push(pilotRide('mid', s, PLAIN, 'mid street', true));
for (const skill of [0.25, 0.55, 0.9]) for (const s of SEEDS.slice(0, QUICK ? 1 : 3)) rows.push(botRide(skill, s));
for (const s of SEEDS.slice(0, QUICK ? 1 : 3)) rows.push(botRide(0.9, s, 'racer'));
const moods = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];
for (const m of QUICK ? [] : moods) rows.push(pilotRide('mid', SEEDS[0], { mood: m, event: ChaosEvent.None, seed: 9 }, `mid mood ${m}`));
const clumsyRows = CLUMSY.map(clumsyRide);

const f1 = (v: number): string => v.toFixed(1);
const f2 = (v: number): string => v.toFixed(2);
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const med = (xs: number[]): number => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const course = new Sim({ seed: COURSE, chaos: PLAIN, sled: 0 }).course;
const lines: string[] = [];
lines.push(`Gablefall (seed 0x${COURSE.toString(16)}), ${new Date().toISOString()}, ${QUICK ? 'quick' : 'full'}; ${((performance.now() - t0) / 1000).toFixed(0)} s`);
lines.push('who             seed  done    time   mean   air  roofs (rows)  landings perfect  drops climbs  falls(plain)  scrapes bumps  maxLift  cause');
for (const r of rows) {
  lines.push(`${r.who.padEnd(15)} ${String(r.seed).padStart(5)}  ${r.finished ? 'yes ' : 'NO  '}  ${f1(r.seconds).padStart(6)}  ${f1(r.mean).padStart(5)}  ${pct(r.air).padStart(4)}  ${pct(r.roofs).padStart(5)} (${pct(r.roofsRows).padStart(4)})  ${String(r.landings).padStart(8)} ${String(r.perfects).padStart(7)}  ${String(r.drops).padStart(5)} ${String(r.climbs).padStart(6)}  ${String(r.falls).padStart(5)}(${r.plainFalls})  ${String(r.scrapes).padStart(7)} ${String(r.bumps).padStart(5)}  ${f2(r.maxLift).padStart(7)} ${r.liftAt.padEnd(26)}  ${r.cause}`);
}
lines.push('');
lines.push('medians by pilot (finishers): time, mean speed, on the roofs (of the run; of the rows), landings, perfect');
const by = (who: string): Facts[] => rows.filter((r) => r.who === who);
const medOf = (who: string, k: (r: Facts) => number): number => med(by(who).filter((r) => r.finished).map(k));
for (const who of ['let go', 'line', 'novice', 'mid', 'mid street', 'expert', 'bot 0.25', 'bot 0.55', 'bot 0.9', 'bot 0.9 racer']) {
  const rs = by(who).filter((r) => r.finished);
  if (!rs.length) continue;
  lines.push(`  ${who.padEnd(13)} ${rs.length}/${by(who).length}  ${f1(medOf(who, (r) => r.seconds))} s  ${f1(medOf(who, (r) => r.mean))} m/s  roofs ${pct(medOf(who, (r) => r.roofs))} (${pct(medOf(who, (r) => r.roofsRows))})  landings ${medOf(who, (r) => r.landings)}  perfect ${medOf(who, (r) => r.perfects)}  drops ${medOf(who, (r) => r.drops)}  climbs ${medOf(who, (r) => r.climbs)}`);
}
const cf = clumsyRows.filter((r) => r.finished);
lines.push(`  clumsy        ${cf.length}/${clumsyRows.length} finished  ${f1(med(cf.map((r) => r.seconds)))} s  falls a run ${f1(clumsyRows.reduce((a, r) => a + r.falls, 0) / clumsyRows.length)}  scrapes a run ${f1(clumsyRows.reduce((a, r) => a + r.scrapes, 0) / clumsyRows.length)}  roofs ${pct(med(clumsyRows.map((r) => r.roofs)))}  causes: ${clumsyRows.filter((r) => !r.finished).map((r) => r.cause).join(', ') || 'none'}`);

// The brief's bar (notes/r9-briefs/gablefall.md section 1), line by line.
const all = rows.concat(clumsyRows);
const ok = (b: boolean): string => (b ? 'MET  ' : 'SHORT');
const gain = (medOf('mid street', (r) => r.seconds) - medOf('mid', (r) => r.seconds)) / medOf('mid street', (r) => r.seconds);
lines.push('');
lines.push('THE BAR');
lines.push(`  ${ok(gain >= 0.1)} the mid pilot on the roofs beats its own hands in the street by ${pct(gain)} of the run's time (10% or more): ${f1(medOf('mid', (r) => r.seconds))} s against ${f1(medOf('mid street', (r) => r.seconds))} s`);
const ex = medOf('expert', (r) => r.roofs);
const exRows = medOf('expert', (r) => r.roofsRows);
const nv = medOf('novice', (r) => r.roofs);
lines.push(`  ${ok(ex >= 0.85)} the expert on the roofs ${pct(ex)} of the run (85% or more; ${pct(exRows)} of the rows, which are ${pct(rowsOf(course).filter((r) => r.side > 0).reduce((a, r) => a + r.z1 - r.z0, 0) / course.finishZ)} of the run's length)`);
lines.push(`  ${ok(nv < 0.3)} the novice on the roofs ${pct(nv)} of the run (under 30%)`);
const b9 = by('bot 0.9');
lines.push(`  ${ok(b9.every((r) => r.roofsRows >= 0.5 && r.perfects >= r.landings * 0.5))} the bot at 0.9 rides the roofs most of the way and lands most hops perfectly: on the roofs ${b9.map((r) => pct(r.roofsRows)).join(' ')} of the rows, perfect ${b9.map((r) => `${r.perfects}/${r.landings}`).join(' ')}`);
const drifts = driftsOf(course);
let gap = 0;
for (let i = 1; i < drifts.length; i++) {
  const g = drifts[i].z0 - drifts[i - 1].z0;
  const sameRun = rowsOf(course).some((r) => drifts[i].z0 > r.z0 && drifts[i - 1].z0 >= r.z0 && drifts[i].z0 < r.z1);
  if (sameRun && g > gap) gap = g;
}
lines.push(`  ${ok(by('novice').every((r) => r.finished) && gap <= 250)} the novice finishes ${by('novice').filter((r) => r.finished).length}/${by('novice').length} in the street; a drift back up at most ${f1(gap)} m on from the last (250 or less)`);
const lift = Math.max(...all.map((r) => r.maxLift));
const plain = all.reduce((a, r) => a + r.plainFalls, 0);
const causes = all.flatMap((r) => r.causes);
const tally = [...new Set(causes)].map((k) => `${k} ${causes.filter((q) => q === k).length}`).join(', ');
lines.push(`  ${ok(lift <= 0.5)} nobody is lifted onto a roof from below: the most a sled's y rose in a tick on the ground ${f2(lift)} m (0.5 or less)`);
lines.push(`  ${ok(plain === 0)} nothing floors a rider but a chimney met head on or a flight of 0.75 s or more landed wrong: ${plain} other falls (of ${all.reduce((a, r) => a + r.falls, 0)} in every ride: ${tally || 'none'}); scrapes ${all.reduce((a, r) => a + r.scrapes, 0)}`);
lines.push(`  ${ok(cf.length === clumsyRows.length)} the clumsy pilot finishes ${cf.length}/${clumsyRows.length} (at least the five's hardest, 27 of 30)`);
const mt = medOf('mid', (r) => r.seconds);
const mv = medOf('mid', (r) => r.mean);
const moodRows = rows.filter((r) => r.who.startsWith('mid mood'));
lines.push(`  ${ok(mt >= 90 && mt <= 112 && mv >= 25 && mv <= 31)} the mid pilot finishes in ${f1(mt)} s at ${f1(mv)} m/s (about 100 s, about 28 m/s); each mood: ${moodRows.map((r) => `${r.who.slice(9)} ${r.finished ? f1(r.seconds) : 'NO'}`).join(', ')}`);
const text = lines.join('\n');
console.log(text);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, QUICK ? 'gablefall-lab-quick.txt' : 'gablefall-lab.txt'), text + '\n');
writeFileSync(join(OUT, QUICK ? 'gablefall-lab-quick.json' : 'gablefall-lab.json'), JSON.stringify({ rows, clumsy: clumsyRows }, null, 1));
