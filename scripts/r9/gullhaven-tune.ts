// Round 9, Gullhaven's lane: the lab's quick bench (notes/r9-gullhaven.md section 1). Rides the lab course with a sled let
// go, a steady hand on the path (round every gully's head) and a steady hand on the bold line (straight on along the
// shelf, a full pop at each lip, the column held in the air, every landing stomped),
// and prints the run and each gully: the time across it on each line and the soaring line's gain, the flight
// (seconds, metres, how high over the ground, where it came down, how), and what the path and the let-go did there.
// `npx tsx scripts/r9/gullhaven-tune.ts [--seed hex] [--json] [--mood n]` (seconds; no slot needed for one run).

import { PLAIN, type ChaosRoll } from '../../src/sim/chaos';
import { packInput } from '../../src/sim/input';
import { GULLHAVEN_LAB_SEED } from '../../src/sim/mountains';
import { type Gully, DRIFT, FACE, boldX, gullySpan, gulliesOf } from '../../src/sim/gullhaven';
import { DT, Sim } from '../../src/sim/sim';

const argN = (k: string, d: number): number => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? (k === '--seed' ? parseInt(process.argv[i + 1], 16) : Number(process.argv[i + 1])) : d;
};
const SEED = argN('--seed', GULLHAVEN_LAB_SEED) >>> 0;
const MOOD = argN('--mood', 0);
const CHAOS: ChaosRoll = MOOD ? { mood: MOOD, event: 0, seed: 9 } : PLAIN;

/** Where a flight from now comes down, stepped as the sim steps it (lift and all). */
export function landing(sim: Sim): { t: number; x: number; z: number } {
  const s = sim.s;
  const c = sim.course;
  let { x, y, z, vy } = s;
  const drag = 1 - 0.015 * DT;
  let vx = s.vx;
  let vz = s.vz;
  for (let k = 1; k < 900; k++) {
    vy -= sim.gravity * DT;
    const a = c.liftAt(x, y, z);
    if (a > 0) vy += a * sim.mood.gravity * DT;
    vx *= drag;
    vz *= drag;
    x += vx * DT;
    z += vz * DT;
    y += vy * DT;
    if (y <= c.ground(x, z)) return { t: k * DT, x, z };
  }
  return { t: 15, x, z };
}

/** A steady hand: on the snow it steers to a line (and tucks while it runs straight); on the bold line it crouches into
 *  each lip and springs at it; in the air it holds the column (a nudge inside the dead zone) and stomps the landing. */
function hand(sim: Sim, bold: boolean): () => number {
  const c = sim.course;
  const gs = gulliesOf(c);
  let crouch = false;
  return () => {
    const s = sim.s;
    if (!s.grounded) {
      const l = landing(sim);
      const lx = c.liftX(s.z);
      const want = lx ?? (bold ? boldX(c, gs.find((g) => l.z < gullySpan(g).z1 + 40 && l.z > g.zL) ?? gs[0], l.z) : c.safeX(l.z));
      const off = (lx !== null ? s.x : l.x) - want;
      const steer = Math.abs(off) > 0.4 ? (off > 0 ? 3 : 5) : 4;
      return packInput(steer, l.t < 0.1 && l.t > 0.01, false);
    }
    const g = bold ? gs.find((q) => q.zL > s.z - 2 && q.zL - s.z < 200) : undefined;
    const line = (z: number): number => (g && bold ? boldX(c, g, z) : c.safeX(z));
    const look = s.z + 4 + s.speed * 0.35;
    const err = Math.atan2(line(look) - s.x, look - s.z) - s.velHeading + (line(s.z) - s.x) * 0.08;
    let lvl = Math.max(0, Math.min(8, Math.round(4 + err * 14)));
    let action = false;
    if (g && bold) {
      const d = g.zL - s.z;
      if (d < s.speed * 0.9 && d > s.speed * DT * 1.5) crouch = true;
      else if (d <= s.speed * DT * 1.5) crouch = false;
      if (crouch) {
        action = true;
        lvl = Math.max(3, Math.min(5, lvl));
      }
    }
    return packInput(lvl, action, false);
  };
}

interface GullyRow {
  i: number;
  zL: number;
  great: boolean;
  t: number;
  vIn: number;
  vOut: number;
  flight: number;
  dist: number;
  peak: number;
  landRel: number;
  landOn: string;
  quality: string;
  maxDx: number;
  minDy: number;
}

function ride(who: string, input: (sim: Sim) => () => number): { who: string; done: boolean; t: number; mean: number; air: number; falls: number; scrapes: number; rows: GullyRow[] } {
  const sim = new Sim({ seed: SEED, chaos: CHAOS, sled: 0 });
  const c = sim.course;
  const gs = gulliesOf(c);
  const go = input(sim);
  const rows: GullyRow[] = gs.map((g) => ({ i: g.index, zL: g.zL, great: g.great, t: 0, vIn: 0, vOut: 0, flight: 0, dist: 0, peak: 0, landRel: 0, landOn: '', quality: '', maxDx: -99, minDy: 0 }));
  let n = 0;
  let sum = 0;
  let air = 0;
  let falls = 0;
  let scrapes = 0;
  let fl: { g: Gully; t0: number; z0: number; peak: number } | null = null;
  while (!sim.finished && !sim.s.crashed && sim.tick < 60 * 600) {
    const s = sim.s;
    const prevZ = s.z;
    sim.step(go());
    n++;
    sum += s.speed;
    if (!s.grounded) air++;
    for (const g of gs) {
      const sp = gullySpan(g);
      const r = rows[g.index];
      if (prevZ < sp.z0 && s.z >= sp.z0) r.vIn = s.speed;
      if (s.z >= sp.z0 && s.z < sp.z1) {
        r.t += DT;
        r.maxDx = Math.max(r.maxDx, s.x - c.centerX(s.z));
        // How far under the path's own level the sled ever is here (the fence never lets it fall).
        r.minDy = Math.min(r.minDy, s.y - c.baseY(s.z));
      }
      if (prevZ < sp.z1 && s.z >= sp.z1) r.vOut = s.speed;
      if (!s.grounded && fl && fl.g === g) fl.peak = Math.max(fl.peak, s.y - c.ground(s.x, s.z));
    }
    for (const e of sim.events) {
      if (e.type === 'takeoff') {
        const g = gs.find((q) => Math.abs(q.zL - s.z) < 12);
        fl = g ? { g, t0: sim.tick, z0: s.z, peak: 0 } : null;
      } else if (e.type === 'land' && fl) {
        const r = rows[fl.g.index];
        if (e.airtime > r.flight) {
          r.flight = e.airtime;
          r.dist = s.z - fl.z0;
          r.peak = fl.peak;
          r.landRel = s.z - fl.g.zL;
          const sf = c.surface(s.x, s.z);
          r.landOn = sf === FACE ? 'face' : sf === DRIFT ? 'drift' : 'shelf';
          r.quality = e.quality;
        }
        fl = null;
      } else if (e.type === 'tumble' && e.phase === 'start') falls++;
      else if (e.type === 'scrape') scrapes++;
    }
  }
  return { who, done: sim.finished, t: sim.finished ? sim.s.finishTick / 60 : sim.tick / 60, mean: sum / Math.max(1, n), air: air / Math.max(1, n), falls, scrapes, rows };
}

const letGo = ride('let go', () => () => packInput(4, false, false));
const path = ride('path', (sim) => hand(sim, false));
const bold = ride('bold', (sim) => hand(sim, true));
const f1 = (v: number): string => v.toFixed(1);
const out: string[] = [];
const c0 = new Sim({ seed: SEED, chaos: CHAOS, sled: 0 }).course;
out.push(`Gullhaven lab (seed 0x${SEED.toString(16)}, mood ${MOOD}): sections ${c0.finishZ} m`);
for (const r of [letGo, path, bold]) out.push(`  ${r.who.padEnd(7)} ${r.done ? 'done' : 'NOT '} ${f1(r.t)} s  mean ${f1(r.mean)} m/s  air ${Math.round(r.air * 100)}%  falls ${r.falls}  scrapes ${r.scrapes}`);
out.push('gully   zL  great | path: t  in>out  maxDx | bold: t  in>out  flight  dist  peak  lands  on     how     | gain   | let-go: maxDx minDy');
let tp = 0;
let tb = 0;
for (let i = 0; i < path.rows.length; i++) {
  const p = path.rows[i];
  const b = bold.rows[i];
  const l = letGo.rows[i];
  tp += p.t;
  tb += b.t;
  out.push(`  ${String(i).padStart(2)} ${f1(p.zL).padStart(6)} ${p.great ? 'G' : ' '}    | ${f1(p.t).padStart(5)} ${f1(p.vIn)}>${f1(p.vOut)} ${f1(p.maxDx).padStart(5)} | ${f1(b.t).padStart(5)} ${f1(b.vIn)}>${f1(b.vOut)} ${f1(b.flight).padStart(5)} s ${f1(b.dist).padStart(5)} ${f1(b.peak).padStart(5)} ${f1(b.landRel).padStart(6)} ${b.landOn.padEnd(5)} ${b.quality.padEnd(7)} | ${Math.round(((p.t - b.t) / p.t) * 100)}%    | ${f1(l.maxDx)} ${f1(l.minDy)}`);
}
out.push(`  all gullies: path ${f1(tp)} s, bold ${f1(tb)} s, gain ${Math.round(((tp - tb) / tp) * 100)}%`);
console.log(out.join('\n'));
if (process.argv.includes('--json')) console.log(JSON.stringify({ letGo, path, bold }));
