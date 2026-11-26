// Round 9, the lab on the Old Run's wall (the ground lane's, notes/r9-ground.md section 15; the Old Run's lane's,
// notes/r9-oldrun.md section 1). The Old Run's course ridden by the lab's own pilots (scripts/playtest/labpilots.ts:
// the careful line, novice, mid and expert, which on a kit course ride its lineFor and on its track hold a height on
// the wall; the mid pilot again on the floor's middle, the floor line; the clumsy pilot) and the bot, with what the wall
// asks measured on each ride: the time, the speed on each surface, the time spent in the bends and the share of it on
// the glaze, lip scrapes, launches off a wall, falls and what they followed. And a sled let go into every bend: how
// high it rides against where it should settle. Then the brief's bar, line by line. A lab sweep: run it in the heavy
// slot. `npx tsx scripts/r9/oldrun-lab.ts [--quick] [--out <dir>] [--seed <hex>]`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Bot } from '../../src/bot/bot';
import { ChaosEvent, Mood, PLAIN, type ChaosRoll } from '../../src/sim/chaos';
import { CHUNK_LEN } from '../../src/sim/course';
import { packInput } from '../../src/sim/input';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { OLDRUN_LAB_SEED } from '../../src/sim/mountains';
import { FLOOR, GLAZE, LIP, SLUSH, WALL } from '../../src/sim/oldrun';
import { Sim, TRACK_BANK, TRACK_DAMP, wallYaw } from '../../src/sim/sim';
import { classic, clumsy } from '../playtest/labpilots';

const QUICK = process.argv.includes('--quick');
const outAt = process.argv.indexOf('--out');
const OUT = outAt >= 0 ? process.argv[outAt + 1] : 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/oldrun';
const seedAt = process.argv.indexOf('--seed');
const COURSE = seedAt >= 0 ? parseInt(process.argv[seedAt + 1], 16) >>> 0 : OLDRUN_LAB_SEED;
const SEEDS = Array.from({ length: QUICK ? 2 : 6 }, (_, i) => 1234 + 37 * i);
const CLUMSY = Array.from({ length: QUICK ? 6 : 30 }, (_, i) => 1234 + 37 * i);
const CAP = 900 * 60;

interface Facts {
  who: string;
  seed: number;
  finished: boolean;
  seconds: number;
  z: number;
  mean: number;
  glazeV: number;
  slushV: number;
  iceV: number;
  /** The seconds the run spends in the bends (curvature a third of the deepest or more, in the air too), and of the
   *  grounded ticks there the share on the glaze and in the slush. */
  bendT: number;
  bendGlaze: number;
  bendSlush: number;
  scrapes: number;
  /** Takeoffs off the ground the sled did not pop from, and of them those off a wall. */
  lips: number;
  wallLips: number;
  pops: number;
  air: number;
  falls: number;
  /** Falls that did not follow a pop's flight (the bar: nothing floors a rider but a badly landed trick). */
  plainFalls: number;
  wards: number;
  cause: string;
}

function ride(who: string, seed: number, chaos: ChaosRoll, input: (sim: Sim) => number, after?: () => void, make?: (sim: Sim) => void): Facts {
  const sim = new Sim({ seed: COURSE, chaos, sled: 0 });
  make?.(sim);
  const c = sim.course;
  const f: Facts = { who, seed, finished: false, seconds: 0, z: 0, mean: 0, glazeV: 0, slushV: 0, iceV: 0, bendT: 0, bendGlaze: 0, bendSlush: 0, scrapes: 0, lips: 0, wallLips: 0, pops: 0, air: 0, falls: 0, plainFalls: 0, wards: 0, cause: '' };
  let lastTakeoff = '';
  let downFor = 0;
  let bendTicks = 0;
  let n = 0;
  let sum = 0;
  const on = { glaze: [0, 0], slush: [0, 0], ice: [0, 0] };
  let bend = 0;
  let bendG = 0;
  let bendS = 0;
  let air = 0;
  while (!sim.s.crashed && !sim.finished && sim.tick < CAP) {
    const s = sim.s;
    const wasX = s.x;
    const wasZ = s.z;
    sim.step(input(sim));
    after?.();
    n++;
    sum += s.speed;
    if (!s.grounded) air++;
    // (A pop's flight is over once the sled has been on the snow a few ticks: a fall after that is not its landing.)
    downFor = s.grounded ? downFor + 1 : 0;
    if (downFor > 4) lastTakeoff = '';
    for (const e of sim.events) {
      if (e.type === 'scrape') f.scrapes++;
      else if (e.type === 'takeoff' && e.kind === 'pop') {
        f.pops++;
        lastTakeoff = 'pop';
      }
      else if (e.type === 'takeoff' && e.kind === 'lip') {
        f.lips++;
        const p = c.channelSlope(wasZ);
        if (Math.abs(wasX - c.centerX(wasZ)) / Math.sqrt(1 + p * p) > FLOOR + 0.3) f.wallLips++;
        lastTakeoff = 'lip';
      } else if (e.type === 'tumble' && e.phase === 'start') {
        f.falls++;
        if (lastTakeoff !== 'pop') f.plainFalls++;
      }
      else if (e.type === 'ward') f.wards++;
    }
    if (!s.finished && Math.abs(c.centerX(s.z + 2) - 2 * c.centerX(s.z) + c.centerX(s.z - 2)) / 4 >= 1 / 180) bendTicks++;
    if (s.grounded && !s.finished) {
      const sf = c.surface(s.x, s.z);
      const k = sf.drag === GLAZE.drag ? on.glaze : sf.drag === SLUSH.drag ? on.slush : on.ice;
      k[0]++;
      k[1] += s.speed;
      const pp = Math.abs(c.centerX(s.z + 2) - 2 * c.centerX(s.z) + c.centerX(s.z - 2)) / 4;
      if (pp >= 1 / 180) {
        bend++;
        if (sf.drag === GLAZE.drag) bendG++;
        else if (sf.drag === SLUSH.drag) bendS++;
      }
    }
  }
  f.finished = sim.finished;
  f.seconds = sim.finished ? sim.s.finishTick / 60 : sim.tick / 60;
  f.z = sim.s.z;
  f.mean = sum / Math.max(1, n);
  f.glazeV = on.glaze[1] / Math.max(1, on.glaze[0]);
  f.slushV = on.slush[1] / Math.max(1, on.slush[0]);
  f.iceV = on.ice[1] / Math.max(1, on.ice[0]);
  f.bendT = bendTicks / 60;
  f.bendGlaze = bendG / Math.max(1, bend);
  f.bendSlush = bendS / Math.max(1, bend);
  f.air = air / Math.max(1, n);
  f.cause = sim.s.crashed ? String(sim.s.crashCause) : sim.finished ? '' : 'timeout';
  return f;
}

const kit = { gateX, pathX, machineZ, track: { wallYaw, damp: TRACK_DAMP, bank: TRACK_BANK } };
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
  }, () => pilot?.after?.());
};
const botRide = (skill: number, seed: number, style?: 'racer'): Facts => {
  let bot: Bot | null = null;
  return ride(`bot ${skill}${style ? ` ${style}` : ''}`, seed, PLAIN, (sim) => {
    if (!bot) bot = new Bot(sim, { skill, seed, sled: 0, name: 'Lab', style });
    return bot.input();
  }, () => bot?.observe());
};
/** A sled let go: no hands at all, from the gate to the line. */
const letGo = (): Facts => ride('let go', 1, PLAIN, () => packInput(4, false, false));

const rows: Facts[] = [];
const t0 = performance.now();
rows.push(letGo());
for (const name of ['line', 'novice', 'mid', 'expert'] as const) for (const s of SEEDS) rows.push(pilotRide(name, s));
for (const s of SEEDS) rows.push(pilotRide('mid', s, PLAIN, 'mid floor', true));
for (const skill of [0.25, 0.55, 0.9]) for (const s of SEEDS.slice(0, QUICK ? 1 : 3)) rows.push(botRide(skill, s));
for (const s of SEEDS.slice(0, QUICK ? 1 : 3)) rows.push(botRide(0.9, s, 'racer'));
const moods = [Mood.Blizzard, Mood.Lantern, Mood.GlassIce, Mood.Comet, Mood.Haunted, Mood.Powder];
for (const m of QUICK ? [] : moods) rows.push(pilotRide('mid', SEEDS[0], { mood: m, event: ChaosEvent.None, seed: 9 }, `mid mood ${m}`));
const clumsyRows = CLUMSY.map(clumsyRide);

// How high a sled let go rides in each bend, against where it should settle at the speed it carries there.
const settle: string[] = [];
{
  const sim = new Sim({ seed: COURSE, chaos: PLAIN, sled: 0 });
  const c = sim.course;
  let peak = 0;
  let want = 0;
  let inBend = false;
  let bz = 0;
  while (!sim.finished && sim.tick < CAP) {
    sim.step(packInput(4, false, false));
    const s = sim.s;
    const pp = (c.centerX(s.z + 2) - 2 * c.centerX(s.z) + c.centerX(s.z - 2)) / 4;
    const p = c.channelSlope(s.z);
    const q = Math.sqrt(1 + p * p);
    const bendNow = Math.abs(pp) >= 1 / 180;
    const d = Math.abs(s.x - c.centerX(s.z)) / q;
    const u = d > FLOOR ? (d - FLOOR) / WALL : 0;
    if (bendNow) {
      if (!inBend) {
        inBend = true;
        bz = s.z;
        peak = 0;
        want = 0;
      }
      peak = Math.max(peak, u);
      const raceU = (Math.abs(c.raceX(s.z, s.speed) - c.centerX(s.z)) / q - FLOOR) / WALL;
      want = Math.max(want, raceU);
    } else if (inBend) {
      inBend = false;
      settle.push(`  bend at ${bz.toFixed(0)} m: rode up to u ${peak.toFixed(2)}, settles at most at ${Math.max(0, want).toFixed(2)} for its speed${peak >= (LIP - FLOOR) / WALL - 0.02 ? ' (THE LIP)' : ''}`);
    }
  }
}

const f1 = (v: number): string => v.toFixed(1);
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const lines: string[] = [];
lines.push(`The Old Run (seed 0x${COURSE.toString(16)}), ${new Date().toISOString()}, ${QUICK ? 'quick' : 'full'}; ${((performance.now() - t0) / 1000).toFixed(0)} s`);
lines.push('who            seed  done    time   mean  glaze  slush    ice  bends s  bend:glaze slush  scrapes  lips(wall)  pops   air  falls  wards  cause');
for (const r of rows) lines.push(`${r.who.padEnd(14)} ${String(r.seed).padStart(5)}  ${r.finished ? 'yes ' : 'NO  '}  ${f1(r.seconds).padStart(6)}  ${f1(r.mean).padStart(5)}  ${f1(r.glazeV).padStart(5)}  ${f1(r.slushV).padStart(5)}  ${f1(r.iceV).padStart(5)}  ${f1(r.bendT).padStart(7)}  ${pct(r.bendGlaze).padStart(9)} ${pct(r.bendSlush).padStart(5)}  ${String(r.scrapes).padStart(7)}  ${String(r.lips).padStart(4)}(${r.wallLips})  ${String(r.pops).padStart(5)}  ${pct(r.air).padStart(4)}  ${String(r.falls).padStart(5)}  ${String(r.wards).padStart(5)}  ${r.cause}`);
const med = (xs: number[]): number => {
  const s = xs.slice().sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
lines.push('');
lines.push('medians by pilot (finishers): time, mean speed, glaze speed, slush speed, bends seconds, share of bends on the glaze, scrapes, falls');
for (const who of ['line', 'novice', 'mid', 'mid floor', 'expert', 'bot 0.25', 'bot 0.55', 'bot 0.9', 'bot 0.9 racer']) {
  const rs = rows.filter((r) => r.who === who && r.finished);
  if (!rs.length) continue;
  lines.push(`  ${who.padEnd(13)} ${rs.length}/${rows.filter((r) => r.who === who).length} finished  ${f1(med(rs.map((r) => r.seconds)))} s  ${f1(med(rs.map((r) => r.mean)))} m/s  glaze ${f1(med(rs.map((r) => r.glazeV)))}  slush ${f1(med(rs.map((r) => r.slushV)))}  bends ${f1(med(rs.map((r) => r.bendT)))} s  on the glaze ${pct(med(rs.map((r) => r.bendGlaze)))}  scrapes ${f1(med(rs.map((r) => r.scrapes)))}  falls ${f1(med(rs.map((r) => r.falls)))}`);
}
const cf = clumsyRows.filter((r) => r.finished);
lines.push(`  clumsy        ${cf.length}/${clumsyRows.length} finished  ${f1(med(cf.map((r) => r.seconds)))} s  falls a run ${f1(clumsyRows.reduce((a, r) => a + r.falls, 0) / clumsyRows.length)}  scrapes a run ${f1(clumsyRows.reduce((a, r) => a + r.scrapes, 0) / clumsyRows.length)}  launches off a wall ${clumsyRows.reduce((a, r) => a + r.wallLips, 0)}  causes: ${clumsyRows.filter((r) => !r.finished).map((r) => r.cause).join(', ') || 'none'}`);
lines.push('');
lines.push('a sled let go into each bend (no hands from the gate):');
lines.push(...settle);
// The brief's bar (notes/r9-briefs/oldrun.md section 1), line by line.
const by = (who: string): Facts[] => rows.filter((r) => r.who === who);
const medOf = (who: string, k: (r: Facts) => number): number => med(by(who).filter((r) => r.finished).map(k));
const gain = (medOf('mid floor', (r) => r.bendT) - medOf('mid', (r) => r.bendT)) / medOf('mid floor', (r) => r.bendT);
const gainLine = (medOf('line', (r) => r.bendT) - medOf('mid', (r) => r.bendT)) / medOf('line', (r) => r.bendT);
const allDone = (who: string): boolean => by(who).every((r) => r.finished);
const plain = rows.concat(clumsyRows).reduce((a, r) => a + r.plainFalls, 0);
const ok = (b: boolean): string => (b ? 'MET ' : 'SHORT');
lines.push('');
lines.push('THE BAR');
lines.push(`  ${ok(gain >= 0.1 && gain <= 0.2)} the mid pilot's glaze line beats its own floor line by ${pct(gain)} of the bends' time (10 to 20%); against the careful line's ${pct(gainLine)}`);
lines.push(`  ${ok(medOf('expert', (r) => r.bendGlaze) > 0.5 && medOf('bot 0.9', (r) => r.bendGlaze) > 0.5)} the expert spends ${pct(medOf('expert', (r) => r.bendGlaze))} and the bot at 0.9 ${pct(medOf('bot 0.9', (r) => r.bendGlaze))} of its bend time on the glaze (most)`);
lines.push(`  ${ok(allDone('novice') && rows[0].finished && by('novice').every((r) => r.falls === 0) && rows[0].falls === 0)} the novice finishes ${by('novice').filter((r) => r.finished).length}/${by('novice').length} (falls ${by('novice').reduce((a, r) => a + r.falls, 0)}), a sled let go ${rows[0].finished ? 'finishes' : 'does not finish'} (falls ${rows[0].falls}), both on the floor's slow line (slush ${pct(medOf('novice', (r) => r.bendSlush))} and ${pct(rows[0].bendSlush)} of their bends)`);
lines.push(`  ${ok(cf.length === clumsyRows.length)} the clumsy pilot finishes ${cf.length}/${clumsyRows.length} (at least the five's hardest, 27 of 30)`);
lines.push(`  ${ok(plain === 0)} falls that were not a pop's flight landed badly: ${plain} (of ${rows.concat(clumsyRows).reduce((a, r) => a + r.falls, 0)} falls in every ride)`);
const mt = medOf('mid', (r) => r.seconds);
const mv = medOf('mid', (r) => r.mean);
lines.push(`  ${ok(mt >= 85 && mt <= 95 && mv >= 32 && mv <= 36)} the mid pilot finishes in ${f1(mt)} s at ${f1(mv)} m/s (about 85 to 95 s, 32 to 36 m/s)`);
const text = lines.join('\n');
console.log(text);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, QUICK ? 'oldrun-lab-quick.txt' : 'oldrun-lab.txt'), text + '\n');
writeFileSync(join(OUT, QUICK ? 'oldrun-lab-quick.json' : 'oldrun-lab.json'), JSON.stringify({ rows, clumsy: clumsyRows }, null, 1));
void CHUNK_LEN;
void OLDRUN_LAB_SEED;
