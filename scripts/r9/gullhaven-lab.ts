// Round 9, the lab on Gullhaven's wind (notes/r9-gullhaven.md section 1). Its course ridden by the lab's own pilots
// (scripts/playtest/labpilots.ts: the careful line, novice, mid and expert, which on a kit course ride its lineFor, spring
// its lips and hold its columns; the mid pilot again on the path's middle, the path line; the clumsy pilot), a sled let
// go and the bot, with what the wind asks measured on each ride: the time and speed, the gullies soared (a flight off a
// lip that met the column), each soared flight's seconds and where it came down, the time across each gully, the air in
// a column, falls and what they followed, how far under the path's level a sled ever was and how near the fence. Then
// the brief's bar, line by line. A lab sweep: run it in the heavy slot.
// `npx tsx scripts/r9/gullhaven-lab.ts [--quick] [--out <dir>] [--seed <hex>]`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Bot } from '../../src/bot/bot';
import { ChaosEvent, Mood, PLAIN, type ChaosRoll } from '../../src/sim/chaos';
import { packInput } from '../../src/sim/input';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { GULLHAVEN_LAB_SEED } from '../../src/sim/mountains';
import { DRIFT, FACE, gullySpan, gulliesOf } from '../../src/sim/gullhaven';
import { Sim } from '../../src/sim/sim';
import { classic, clumsy } from '../playtest/labpilots';

const QUICK = process.argv.includes('--quick');
const outAt = process.argv.indexOf('--out');
const OUT = outAt >= 0 ? process.argv[outAt + 1] : 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gullhaven';
const seedAt = process.argv.indexOf('--seed');
const COURSE = seedAt >= 0 ? parseInt(process.argv[seedAt + 1], 16) >>> 0 : GULLHAVEN_LAB_SEED;
const SEEDS = Array.from({ length: QUICK ? 2 : 6 }, (_, i) => 1234 + 37 * i);
const CLUMSY = Array.from({ length: QUICK ? 6 : 30 }, (_, i) => 1234 + 37 * i);
const CAP = 900 * 60;
/** The five's longest flight for the mid pilot (notes/r9-measure.md: Pinecrest's 5.78 s). */
const FIVE_LONGEST = 5.78;
/** How many gullies the course has. */
const N = gulliesOf(new Sim({ seed: COURSE, chaos: PLAIN, sled: 0 }).course).length;

export interface Facts {
  who: string;
  seed: number;
  finished: boolean;
  seconds: number;
  mean: number;
  air: number;
  /** Ticks in the air inside a column, as a share of the run (the mechanic's share). */
  lifted: number;
  /** Gullies soared (a flight off within 12 m of a lip that met its column). */
  soared: number;
  /** Each soared flight: seconds, and where it came down (face, shelf, drift) and the slope there. */
  flights: { s: number; on: string; slope: number }[];
  longest: number;
  /** The seconds across each gully's span. */
  gullyT: number[];
  falls: number;
  /** Falls that did not follow a flight of 0.75 s or more landed wrong, and every fall's cause. */
  plainFalls: number;
  causes: string[];
  scrapes: number;
  /** The least of the sled's height over the path's level, and the most it was ever past the corridor's seaward edge on
   *  the clifftop (the fence: the beacon's slope, the path, a gully). */
  minDy: number;
  maxEdge: number;
  /** Seaward of the path's middle at most, in a gully's span (the let-go's stays on the path). */
  maxDx: number;
  cause: string;
}

function ride(who: string, seed: number, chaos: ChaosRoll, input: (sim: Sim) => number, after?: () => void): Facts {
  const sim = new Sim({ seed: COURSE, chaos, sled: 0 });
  const c = sim.course;
  const gs = gulliesOf(c);
  const f: Facts = { who, seed, finished: false, seconds: 0, mean: 0, air: 0, lifted: 0, soared: 0, flights: [], longest: 0, gullyT: gs.map(() => 0), falls: 0, plainFalls: 0, causes: [], scrapes: 0, minDy: 0, maxEdge: -99, maxDx: -99, cause: '' };
  let n = 0;
  let sum = 0;
  let air = 0;
  let lifted = 0;
  let fl: { gi: number; met: boolean } | null = null;
  const soared = new Set<number>();
  while (!sim.s.crashed && !sim.finished && sim.tick < CAP) {
    const s = sim.s;
    sim.step(input(sim));
    after?.();
    n++;
    sum += s.speed;
    if (!s.grounded) {
      air++;
      if (c.liftAt(s.x, s.y, s.z) > 0) {
        lifted++;
        if (fl) fl.met = true;
      }
    }
    if (!s.finished) {
      f.minDy = Math.min(f.minDy, s.y - c.baseY(s.z));
      const k = c.section(s.z).kind;
      if (k === 'cliffpath' || k === 'geo' || k === 'beacon') f.maxEdge = Math.max(f.maxEdge, s.x - c.centerX(s.z) - c.halfWidth(s.z));
    }
    for (let i = 0; i < gs.length; i++) {
      const sp = gullySpan(gs[i]);
      if (s.z >= sp.z0 && s.z < sp.z1 && !s.finished) {
        f.gullyT[i] += 1 / 60;
        f.maxDx = Math.max(f.maxDx, s.x - c.centerX(s.z));
      }
    }
    let landed: { airtime: number; botched: boolean } | null = null;
    for (const e of sim.events) {
      if (e.type === 'scrape') f.scrapes++;
      else if (e.type === 'takeoff') {
        const gi = gs.findIndex((g) => Math.abs(g.zL - s.z) < 12);
        fl = gi >= 0 ? { gi, met: false } : null;
      } else if (e.type === 'land' && !e.late) {
        landed = { airtime: e.airtime, botched: e.botched === true };
        f.longest = Math.max(f.longest, e.airtime);
        if (fl && fl.met && e.airtime > 1) {
          soared.add(fl.gi);
          const sf = c.surface(s.x, s.z);
          const gz = { x: 0, z: 0 };
          c.gradient(s.x, s.z, gz);
          f.flights.push({ s: e.airtime, on: sf === FACE ? 'face' : sf === DRIFT ? 'drift' : 'shelf', slope: -gz.z });
        }
        fl = null;
      } else if (e.type === 'tumble' && e.phase === 'start') {
        f.falls++;
        f.causes.push(e.cause);
        if (!landed || landed.airtime < 0.75 || !landed.botched) f.plainFalls++;
      }
    }
  }
  f.finished = sim.finished;
  f.seconds = sim.finished ? sim.s.finishTick / 60 : sim.tick / 60;
  f.mean = sum / Math.max(1, n);
  f.air = air / Math.max(1, n);
  f.lifted = lifted / Math.max(1, n);
  f.soared = soared.size;
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
for (const s of SEEDS) rows.push(pilotRide('mid', s, PLAIN, 'mid path', true));
for (const skill of [0.25, 0.55, 0.9]) for (const s of SEEDS.slice(0, QUICK ? 1 : 3)) rows.push(botRide(skill, s));
for (const s of SEEDS.slice(0, QUICK ? 1 : 3)) rows.push(botRide(0.9, s, 'racer'));
const moods = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];
for (const m of QUICK ? [] : moods) rows.push(pilotRide('mid', SEEDS[0], { mood: m, event: ChaosEvent.None, seed: 9 }, `mid mood ${m}`));
const clumsyRows = CLUMSY.map(clumsyRide);

const f1 = (v: number): string => v.toFixed(1);
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const med = (xs: number[]): number => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const lines: string[] = [];
lines.push(`Gullhaven (seed 0x${COURSE.toString(16)}), ${new Date().toISOString()}, ${QUICK ? 'quick' : 'full'}; ${((performance.now() - t0) / 1000).toFixed(0)} s`);
lines.push('who             seed  done    time   mean   air  lifted  soared  flights (median s, face/shelf/drift)  longest  gullies s  falls(plain)  scrapes  minDy  edge  cause');
for (const r of rows) {
  const fs = r.flights;
  const on = (k: string): number => fs.filter((q) => q.on === k).length;
  lines.push(`${r.who.padEnd(15)} ${String(r.seed).padStart(5)}  ${r.finished ? 'yes ' : 'NO  '}  ${f1(r.seconds).padStart(6)}  ${f1(r.mean).padStart(5)}  ${pct(r.air).padStart(4)}  ${pct(r.lifted).padStart(6)}  ${String(r.soared).padStart(4)}/${N}  ${fs.length ? f1(med(fs.map((q) => q.s))) : '-'} s, ${on('face')}/${on('shelf')}/${on('drift')}`.padEnd(118) + `  ${f1(r.longest).padStart(5)}  ${f1(r.gullyT.reduce((a, b) => a + b, 0)).padStart(8)}  ${String(r.falls).padStart(4)}(${r.plainFalls})  ${String(r.scrapes).padStart(7)}  ${f1(r.minDy).padStart(5)}  ${f1(r.maxEdge).padStart(4)}  ${r.cause}`);
}
lines.push('');
lines.push('medians by pilot (finishers): time, mean speed, gullies soared, soared flights, longest, the gullies\' time, the air in a column');
const by = (who: string): Facts[] => rows.filter((r) => r.who === who);
const medOf = (who: string, k: (r: Facts) => number): number => med(by(who).filter((r) => r.finished).map(k));
for (const who of ['let go', 'line', 'novice', 'mid', 'mid path', 'expert', 'bot 0.25', 'bot 0.55', 'bot 0.9', 'bot 0.9 racer']) {
  const rs = by(who).filter((r) => r.finished);
  if (!rs.length) continue;
  const fl = rs.flatMap((r) => r.flights.map((q) => q.s));
  lines.push(`  ${who.padEnd(13)} ${rs.length}/${by(who).length}  ${f1(medOf(who, (r) => r.seconds))} s  ${f1(medOf(who, (r) => r.mean))} m/s  soared ${f1(medOf(who, (r) => r.soared))}/${N}  flights ${fl.length ? `${f1(Math.min(...fl))} to ${f1(Math.max(...fl))}, median ${f1(med(fl))}` : '-'}  longest ${f1(medOf(who, (r) => r.longest))}  gullies ${f1(medOf(who, (r) => r.gullyT.reduce((a, b) => a + b, 0)))} s  lifted ${pct(medOf(who, (r) => r.lifted))}`);
}
const cf = clumsyRows.filter((r) => r.finished);
lines.push(`  clumsy        ${cf.length}/${clumsyRows.length} finished  ${f1(med(cf.map((r) => r.seconds)))} s  falls a run ${f1(clumsyRows.reduce((a, r) => a + r.falls, 0) / clumsyRows.length)}  scrapes a run ${f1(clumsyRows.reduce((a, r) => a + r.scrapes, 0) / clumsyRows.length)}  causes: ${clumsyRows.filter((r) => !r.finished).map((r) => r.cause).join(', ') || 'none'}`);

// The brief's bar (notes/r9-briefs/gullhaven.md section 1), line by line.
const all = rows.concat(clumsyRows);
const ok = (b: boolean): string => (b ? 'MET  ' : 'SHORT');
const gain = (medOf('mid path', (r) => r.gullyT.reduce((a, b) => a + b, 0)) - medOf('mid', (r) => r.gullyT.reduce((a, b) => a + b, 0))) / medOf('mid path', (r) => r.gullyT.reduce((a, b) => a + b, 0));
const midFl = by('mid').flatMap((r) => r.flights.map((q) => q.s));
const longestHere = Math.max(...rows.map((r) => r.longest));
lines.push('');
lines.push('THE BAR');
lines.push(`  ${ok(gain >= 0.1 && gain <= 0.2)} the mid pilot soaring beats its own hands on the path by ${pct(gain)} of the gullies' time (10 to 20%)`);
lines.push(`  ${ok(med(midFl) >= 3 && med(midFl) <= 5 && longestHere > FIVE_LONGEST)} the mid pilot's soared flights last ${midFl.length ? `${f1(Math.min(...midFl))} to ${f1(Math.max(...midFl))} s, median ${f1(med(midFl))}` : 'none'} (about 3 to 5); the longest here ${f1(longestHere)} s against the five's longest ${FIVE_LONGEST} s`);
const soarOK = (who: string): boolean => by(who).every((r) => r.soared >= Math.ceil(0.7 * N) && r.flights.every((q) => q.on !== 'drift' && q.slope <= 0.8));
lines.push(`  ${ok(soarOK('mid') && soarOK('expert') && soarOK('bot 0.9'))} soared (of ${N}, at least 7 of 10's share) and came down on the face or far shelf, no steeper than 0.8: mid ${by('mid').map((r) => r.soared).join(' ')}, expert ${by('expert').map((r) => r.soared).join(' ')}, bot 0.9 ${by('bot 0.9').map((r) => r.soared).join(' ')}; landings in the drift ${all.reduce((a, r) => a + r.flights.filter((q) => q.on === 'drift').length, 0)}, steepest ${f1(Math.max(0, ...all.flatMap((r) => r.flights.map((q) => q.slope))))}`);
lines.push(`  ${ok(by('novice').every((r) => r.finished) && medOf('novice', (r) => r.soared) <= 3)} the novice finishes ${by('novice').filter((r) => r.finished).length}/${by('novice').length} and soars ${by('novice').map((r) => r.soared).join(' ')} (few); the bot at 0.25 soars ${by('bot 0.25').map((r) => r.soared).join(' ')}`);
lines.push(`  ${ok(rows[0].finished && rows[0].soared === 0 && rows[0].maxDx < 5)} a sled let go stays on the path: it finishes, soars none, at most ${f1(rows[0].maxDx)} m seaward of the path's middle in a gully`);
const minDy = Math.min(...all.map((r) => r.minDy));
lines.push(`  ${ok(minDy > -30 && all.every((r) => r.maxEdge < 1))} nobody passes the fence: the lowest any sled came under the path's level ${f1(minDy)} m (no lower than 30), the furthest past the clifftop's seaward edge ${f1(Math.max(...all.map((r) => r.maxEdge)))} m`);
const plain = all.reduce((a, r) => a + r.plainFalls, 0);
const causes = all.flatMap((r) => r.causes);
const tally = [...new Set(causes)].map((k) => `${k} ${causes.filter((q) => q === k).length}`).join(', ');
lines.push(`  ${ok(plain === 0)} falls that were not a flight of 0.75 s or more landed wrong: ${plain} (of ${all.reduce((a, r) => a + r.falls, 0)} falls in every ride: ${tally || 'none'}; the clumsy pilot's ${clumsyRows.reduce((a, r) => a + r.plainFalls, 0)} of them)`);
lines.push(`  ${ok(cf.length === clumsyRows.length)} the clumsy pilot finishes ${cf.length}/${clumsyRows.length} (at least the five's hardest, 27 of 30)`);
const mt = medOf('mid', (r) => r.seconds);
const mv = medOf('mid', (r) => r.mean);
const moodRows = rows.filter((r) => r.who.startsWith('mid mood'));
lines.push(`  ${ok(mt >= 150 && mt <= 172 && mv >= 27.5 && mv <= 32.5)} the mid pilot finishes in ${f1(mt)} s at ${f1(mv)} m/s (about 160 s, about 30 m/s); each mood: ${moodRows.map((r) => `${r.who.slice(9)} ${r.finished ? f1(r.seconds) : 'NO'}`).join(', ')}`);
const text = lines.join('\n');
console.log(text);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, QUICK ? 'gullhaven-lab-quick.txt' : 'gullhaven-lab.txt'), text + '\n');
writeFileSync(join(OUT, QUICK ? 'gullhaven-lab-quick.json' : 'gullhaven-lab.json'), JSON.stringify({ rows, clumsy: clumsyRows }, null, 1));
