// Round 9, the Old Run's lane: the lab's quick bench (notes/r9-oldrun.md section 1). Rides the course with a sled let
// go, a hand that holds a height exactly (the floor, its own settling height, the glaze), the lab's pilots (the mid
// pilot on its glaze line and on the floor's middle) and the bot, three seeds each, and prints one line a rider: time,
// mean speed, the bends' time, the share of it on the glaze and in the slush, scrapes, falls, pops, air, slip.
// `npx tsx scripts/r9/oldrun-tune.ts [--clumsy N] [--n seeds] [--seed hex] [--json] [--prof]` (seconds; no slot needed
// for one run, the heavy slot for a sweep of them).

import { Bot } from '../../src/bot/bot';
import { PLAIN } from '../../src/sim/chaos';
import { packInput } from '../../src/sim/input';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { OLDRUN_LAB_SEED } from '../../src/sim/mountains';
import { FLOOR, GLAZE, SLUSH, WALL } from '../../src/sim/oldrun';
import { DT, Sim, TRACK_BANK, TRACK_DAMP, wallYaw } from '../../src/sim/sim';
import { classic, clumsy } from '../playtest/labpilots';

const argN = (k: string, d: number): number => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};
const CLUMSY = argN('--clumsy', 6);
const SEED = argN('--seed', OLDRUN_LAB_SEED);
const JSON_OUT = process.argv.includes('--json');

/** The bend at z: its curvature (d2x/dz2 of the line) and its outside side. */
function bendOf(sim: Sim, z: number): { k: number; side: 1 | -1 } {
  const c = sim.course;
  const pp = (c.centerX(z + 2) - 2 * c.centerX(z) + c.centerX(z - 2)) / 4;
  return { k: Math.abs(pp), side: pp > 0 ? -1 : 1 };
}
const across0 = (u: number): number => FLOOR * Math.min(1, Math.max(0, u / 0.15)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, u / 0.15))) + u * WALL;

/** A hand that holds a height: steer so the sled's offset square to the channel goes to the target's, with the wall's
 *  yaw and the track's damping fed forward (as a rider who knows the wall leans into it). */
function holder(sim: Sim, target: (z: number, v: number) => number, tuck: boolean, gain = 1): () => number {
  const c = sim.course;
  const grad = { x: 0, z: 0 };
  return () => {
    const s = sim.s;
    const v = Math.max(8, s.speed);
    const z = s.z;
    const p = c.channelSlope(z);
    const q = Math.sqrt(1 + p * p);
    const phi = Math.atan(p);
    const d = (s.x - c.centerX(z)) / q;
    const look = z + v * 0.35;
    const dt = target(look, v);
    const dtNext = target(look + 1, v);
    const dRate = (dtNext - dt) * s.vz;
    const err = d - dt;
    const ddDes = Math.max(-7, Math.min(7, dRate - 1.6 * gain * err));
    const psiDes = Math.asin(Math.max(-0.5, Math.min(0.5, ddDes / v)));
    const pNext = c.channelSlope(z + 1);
    const phiRate = ((pNext - p) * s.vz) / (1 + p * p);
    c.gradient(s.x, s.z, grad);
    const yaw = wallYaw(grad, phi, s.speed, sim.gravity);
    const bank = TRACK_BANK;
    const grip = 6.5 * sim.sled.grip * sim.mood.grip * c.surface(s.x, s.z).grip * (tuck ? 1.15 : 1);
    // The rate the velocity itself should turn at, and the slip that gives it (the bank turns it by bank * yaw).
    const psiV = s.velHeading - phi;
    const velRate = phiRate + 5 * gain * (psiDes - psiV);
    const want = s.velHeading + (velRate + bank * yaw) / grip;
    const rate = velRate + 9 * gain * (want - s.heading);
    const tr = (2.5 / (1 + s.speed / 16) < 1.45 ? 2.5 / (1 + s.speed / 16) : 1.45) * sim.sled.turn * (tuck ? 1.12 : 1);
    const steer = (rate - TRACK_DAMP * Math.max(-1, Math.min(1, phi - s.heading)) + yaw) / tr;
    const lvl = tuck ? Math.max(3, Math.min(5, Math.round(4 + steer * 4))) : Math.max(0, Math.min(8, Math.round(4 + steer * 4)));
    return packInput(lvl, tuck, false);
  };
}

/** The settling height's share up the wall for a speed at z (the kit's raceX). */
function settleD(sim: Sim, z: number, v: number): number {
  const c = sim.course;
  const p = c.channelSlope(z);
  return (c.raceX(z, v) - c.centerX(z)) / Math.sqrt(1 + p * p);
}
const glazeAt = (sim: Sim, z: number, side: 1 | -1, u: number): boolean => {
  const c = sim.course;
  const p = c.channelSlope(z);
  const x = c.centerX(z) + side * across0(u) * Math.sqrt(1 + p * p);
  return c.surface(x, z).drag === GLAZE.drag;
};
const LINES = {
  floor: () => (_z: number, _v: number) => 0,
  natural: (sim: Sim) => (z: number, v: number) => settleD(sim, z, v),
  glaze: (sim: Sim) => (z: number, v: number) => {
    const b = bendOf(sim, z);
    const nat = settleD(sim, z, v);
    if (glazeAt(sim, z, b.side, 0.67)) return b.side * across0(Math.max(0.6, Math.min(0.78, Math.abs((Math.abs(nat) - FLOOR) / WALL))));
    return nat;
  },
};

interface Row {
  who: string;
  done: boolean;
  t: number;
  mean: number;
  bendT: number;
  bendGlaze: number;
  bendSlush: number;
  glazeV: number;
  scrapes: number;
  lips: number;
  falls: number;
  maxU: number;
  pops: number;
  air: number;
  drift: number;
  slip: number;
}

const PROF = process.argv.includes("--prof");
function ride(who: string, input: (sim: Sim) => () => number, after?: () => void, seed = SEED): Row {
  let nextZ = 0;
  const prof: string[] = [];
  const sim = new Sim({ seed, chaos: PLAIN, sled: 0 });
  const c = sim.course;
  const go = input(sim);
  let n = 0;
  let sum = 0;
  let bend = 0;
  let bg = 0;
  let bs = 0;
  let gv = 0;
  let gn = 0;
  let scrapes = 0;
  let lips = 0;
  let falls = 0;
  let maxU = 0;
  let pops = 0;
  let air = 0;
  let drift = 0;
  let slip = 0;
  while (!sim.s.crashed && !sim.finished && sim.tick < 400 * 60) {
    sim.step(go());
    after?.();
    const s = sim.s;
    if (PROF && s.z >= nextZ) {
      const b = bendOf(sim, s.z);
      const pq = c.channelSlope(s.z);
      const uu = ((s.x - c.centerX(s.z)) / Math.sqrt(1 + pq * pq));
      prof.push(`${nextZ}:${s.speed.toFixed(0)}${b.k >= 1 / 180 ? (b.side * uu > 0 ? "^" : "v") + Math.abs(uu).toFixed(1) + "R" + (1 / b.k).toFixed(0) : ""}`);
      nextZ += 50;
    }
    n++;
    sum += s.speed;
    for (const e of sim.events) {
      if (e.type === 'scrape') scrapes++;
      else if (e.type === 'takeoff' && e.kind === 'lip') lips++;
      else if (e.type === 'tumble' && e.phase === 'start') falls++;
      else if (e.type === 'takeoff' && e.kind === 'pop') pops++;
    }
    if (!s.grounded) air++;
    if (s.drifting) drift++;
    slip += Math.abs(s.slip) * s.speed;
    if (s.grounded && !s.finished) {
      const sf = c.surface(s.x, s.z);
      if (sf.drag === GLAZE.drag) {
        gv += s.speed;
        gn++;
      }
      const p = c.channelSlope(s.z);
      const u = (Math.abs(s.x - c.centerX(s.z)) / Math.sqrt(1 + p * p) - FLOOR) / WALL;
      if (u > maxU) maxU = u;
      if (bendOf(sim, s.z).k >= 1 / 180) {
        if (sf.drag === GLAZE.drag) bg++;
        else if (sf.drag === SLUSH.drag) bs++;
      }
    }
    if (!s.finished && bendOf(sim, s.z).k >= 1 / 180) bend++;
  }
  if (PROF) console.error(who, prof.join(" "));
  return { who, done: sim.finished, t: sim.finished ? sim.s.finishTick / 60 : sim.tick / 60, mean: sum / Math.max(1, n), bendT: bend * DT, bendGlaze: bg / Math.max(1, bend), bendSlush: bs / Math.max(1, bend), glazeV: gv / Math.max(1, gn), scrapes, lips, falls, maxU, pops, air: air / Math.max(1, n), drift: drift / Math.max(1, n), slip: (slip / Math.max(1, n)) * 0.25 };
}

const kit = { gateX, pathX, machineZ, track: { wallYaw, damp: TRACK_DAMP, bank: TRACK_BANK } };
const NS = argN('--n', 3);
const SEEDS = Array.from({ length: NS }, (_, i) => 1234 + 37 * i);
const med = (xs: number[]): number => { const a = xs.slice().sort((x, y) => x - y); return a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
const medRow = (rs: Row[]): Row => ({ ...rs[0], done: rs.every((r) => r.done), t: med(rs.map((r) => r.t)), mean: med(rs.map((r) => r.mean)), bendT: med(rs.map((r) => r.bendT)), bendGlaze: med(rs.map((r) => r.bendGlaze)), bendSlush: med(rs.map((r) => r.bendSlush)), glazeV: med(rs.map((r) => r.glazeV)), scrapes: med(rs.map((r) => r.scrapes)), lips: rs.reduce((a, r) => a + r.lips, 0), falls: rs.reduce((a, r) => a + r.falls, 0), maxU: Math.max(...rs.map((r) => r.maxU)), pops: med(rs.map((r) => r.pops)), air: med(rs.map((r) => r.air)), drift: med(rs.map((r) => r.drift)), slip: med(rs.map((r) => r.slip)) });
const rows: Row[] = [];
rows.push(ride('let go', () => () => packInput(4, false, false)));
rows.push(ride('let go tuck', () => () => packInput(4, true, false)));
for (const [name, line] of Object.entries(LINES)) {
  rows.push(ride(`hold ${name}`, (sim) => holder(sim, line(sim), false)));
  if (name !== "natural") rows.push(ride(`tuck ${name}`, (sim) => holder(sim, line(sim), true)));
}
for (const [name, label, extra] of [['line', 'line', {}], ['novice', 'novice', {}], ['mid', 'mid', {}], ['mid', 'mid floor', { floor: true }], ['expert', 'expert', {}]] as const) {
  rows.push(
    medRow(
      SEEDS.map((seed) => {
        let pilot: ReturnType<typeof classic> | null = null;
        return ride(
          label,
          (sim) => () => {
            if (!pilot) pilot = classic(name, sim, seed, { ...kit, ...extra });
            const o = pilot();
            return (o.steer | 0) | (o.action ? 16 : 0);
          },
          () => pilot?.after?.(),
        );
      }),
    ),
  );
}
for (const skill of [0.25, 0.55, 0.9]) {
  rows.push(
    medRow(
      SEEDS.map((seed) => {
        let bot: Bot | null = null;
        return ride(
          `bot ${skill}`,
          (sim) => () => {
            if (!bot) bot = new Bot(sim, { skill, seed, sled: 0, name: 'Lab' });
            return bot.input();
          },
          () => bot?.observe(),
        );
      }),
    ),
  );
}
const cl: Row[] = [];
for (let i = 0; i < CLUMSY; i++) {
  const seed = 1234 + 37 * i;
  let pilot: ReturnType<typeof clumsy> | null = null;
  cl.push(
    ride(
      'clumsy',
      (sim) => () => {
        if (!pilot) pilot = clumsy(sim, seed);
        const o = pilot();
        return (o.steer | 0) | (o.action ? 16 : 0);
      },
      () => pilot?.after?.(),
    ),
  );
}
const f = (v: number, d = 1): string => v.toFixed(d);
const pct = (v: number): string => `${Math.round(v * 100)}%`;
if (JSON_OUT) console.log(JSON.stringify({ rows, clumsy: cl }));
else {
  for (const r of rows) console.log(`${r.who.padEnd(14)} ${r.done ? '' : 'DNF '}${f(r.t).padStart(6)} s ${f(r.mean).padStart(5)} m/s  bends ${f(r.bendT).padStart(5)} s glaze ${pct(r.bendGlaze).padStart(4)} slush ${pct(r.bendSlush).padStart(4)}  at ${f(r.glazeV)}  scr ${r.scrapes} lips ${r.lips} falls ${r.falls} maxU ${f(r.maxU, 2)} pops ${r.pops} air ${pct(r.air)} drift ${pct(r.drift)} slipcost ${f(r.slip, 2)}`);
  const done = cl.filter((r) => r.done).length;
  console.log(`clumsy ${done}/${cl.length}  mean ${f(cl.reduce((a, r) => a + r.t, 0) / Math.max(1, cl.length))} s  falls ${cl.reduce((a, r) => a + r.falls, 0)}  scrapes/run ${f(cl.reduce((a, r) => a + r.scrapes, 0) / Math.max(1, cl.length))}  lips ${cl.reduce((a, r) => a + r.lips, 0)}`);
}
