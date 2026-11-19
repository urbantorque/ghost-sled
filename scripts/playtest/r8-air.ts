// Round 8, the sim lane's phase 1 prototype: does the air map (src/sim/tricks.ts) play with the lab's pilots?
// It rides the expert's ground pilot with a trickster's hands in the air (a person who knows the map and picks
// the trick a flight has room for, a new one for the combo where it can), and prints every flight's tricks, the
// run's falls and the best combo's named tricks. One process, a seed or two.
//   npx tsx scripts/playtest/r8-air.ts [--mountains 0,2] [--seeds 1] [--sloppy 0.25] [--quiet]
import { MOUNTAINS } from '../../src/sim/mountains';
import { gateX, machineZ, pathX } from '../../src/sim/moments';
import { Sim } from '../../src/sim/sim';
import { TRICKS } from '../../src/sim/tricks';
import { type Inp, classic, mulberry, spenderFor, timeToLand } from './labpilots';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const MTNS = opt('mountains', '0').split(',').map(Number);
const SEEDS = +opt('seeds', '1');
const SLOPPY = +opt('sloppy', '0.25');
const QUIET = argv.includes('--quiet');
const CHAIN = argv.includes('--chain');

type Kind = 'grab' | 'reach' | 'stretch' | 'paper' | 'cross' | 'flip' | 'crane' | 'ember' | 'knot' | 'sig' | 'lamp';

/** A trickster's hands in the air, over the expert's on the snow. */
function trickster(sim: Sim, seed: number): () => Inp {
  const ground = classic('expert', sim, seed, { gateX, pathX, machineZ });
  const rnd = mulberry(seed * 31 + 7);
  const used = new Set<Kind>();
  const seen = new Set<Kind>();
  let plan: { kind: Kind; side: number; t: number; phase: number; dir: number; bias: number } | null = null;
  let wasAir = false;
  let wasRail = false;
  let railOff = -1;
  let crouch = 0;
  return () => {
    const s = sim.s;
    if (!sim.combo.active) used.clear();
    if (s.grinding) wasRail = true;
    if (s.grounded || s.tumble > 0) {
      wasAir = false;
      plan = null;
      if (!s.grinding) wasRail = false;
      const g = ground();
      // (--chain: with a combo running out, crouch and pop to keep it alive, where the run ahead is straight.)
      if (CHAIN && s.grounded && s.tumble === 0 && !s.grinding) {
        const c = sim.course;
        const straight = Math.abs(c.safeX(s.z + 30) - c.safeX(s.z)) < 2 && Math.abs(s.x - c.safeX(s.z)) < 1.5;
        if (crouch === 0 && sim.combo.active && sim.combo.timer < 90 && s.speed > 16 && straight && !g.action) crouch = 1;
        if (crouch > 0) {
          crouch++;
          if (crouch > 22) {
            crouch = 0;
            return { steer: g.steer, action: false };
          }
          return { steer: Math.max(3, Math.min(5, g.steer)), action: true };
        }
      }
      return g;
    }
    crouch = 0;
    const land = timeToLand(sim);
    let L = land.t + (plan ? plan.bias : 0);
    if (!wasAir) {
      wasAir = true;
      if (wasRail) railOff = sim.tick;
      wasRail = false;
      const T = land.t;
      const menu: Kind[] =
        sim.tick - railOff < 3 ? ['lamp'] : T >= 2.2 ? ['knot', 'cross', 'crane', 'stretch', 'paper', 'ember', 'sig', 'reach'] : T >= 1.5 ? ['cross', 'paper', 'reach', 'ember', 'flip', 'sig', 'grab'] : T >= 0.9 ? ['paper', 'grab', 'flip', 'sig'] : T >= 0.6 ? ['grab'] : [];
      // A trick new to the run first, then one new to the combo, then any.
      const unseen = menu.filter((k) => !seen.has(k) && !used.has(k));
      const fresh = menu.filter((k) => !used.has(k));
      const from = unseen.length ? unseen : fresh.length ? fresh : menu;
      const pick = from.length ? from[Math.floor(rnd() * from.length)] : null;
      plan = pick ? { kind: pick, side: rnd() < 0.5 ? 1 : -1, t: 0, phase: 0, dir: rnd() < 0.5 ? 1 : -1, bias: (rnd() - 0.5) * 0.1 * SLOPPY } : null;
      if (plan) {
        used.add(plan.kind);
        seen.add(plan.kind);
      }
      L = land.t + (plan ? plan.bias : 0);
    }
    if (!plan) return { steer: 4, action: land.t < 0.11 && land.t > 0.01 };
    const p = plan;
    p.t++;
    const side = (d: number) => (d > 0 ? 8 : 0);
    const yaw = Math.abs(s.airYaw) + (s.spinRate * s.spinRate) / (2 * 22);
    const pitch = Math.abs(s.airPitch) + (s.pitchRate * s.pitchRate) / (2 * 26);
    const stomp = L < 0.11 && L > 0.01;
    // A grab: pressed with the steer to a side, the steer back to the middle, let go into the landing.
    const grab = (minTicks: number, spin = 0, tweak = false): Inp => {
      if (p.phase === 0) {
        p.phase = 1;
        return { steer: side(p.side), action: true };
      }
      if (p.phase === 1) {
        let steer = 4;
        if (spin && yaw < spin * Math.PI - 0.12) steer = side(p.side);
        if (tweak && L < 0.5 && L > 0.16) steer = side(-p.side);
        const keep = L > 0.12 || s.grabTicks < minTicks - 2;
        if (keep && L > 0.02) return { steer, action: true };
        p.phase = 2;
      }
      return { steer: 4, action: false };
    };
    switch (p.kind) {
      case 'grab':
        return grab(15);
      case 'reach':
        return grab(40);
      case 'stretch':
        return grab(75);
      case 'paper':
        return grab(15, 2);
      case 'cross':
        return grab(15, 0, true);
      case 'lamp':
        if (p.t < 6) return { steer: side(p.dir), action: true };
        return { steer: 4, action: stomp };
      case 'flip':
      case 'ember': {
        if (p.phase === 0) {
          // (A beat with the button up, then the press, steer centred: the flip's latch.)
          if (p.t < 2) return { steer: 4, action: false };
          if (pitch < 2 * Math.PI - 0.2 && L > 0.45) return { steer: p.kind === 'ember' && p.t > 9 && yaw < 2 * Math.PI - 0.12 ? side(p.dir) : 4, action: true };
          p.phase = 1;
        }
        let steer = 4;
        if (p.kind === 'ember' && yaw < 2 * Math.PI - 0.12 && L > 0.25) steer = side(p.dir);
        return { steer, action: stomp };
      }
      case 'crane':
      case 'knot': {
        // Flip past its half, let go (it comes round by itself), then grab and let go into the landing.
        if (p.phase === 0) {
          if (p.t < 2) return { steer: 4, action: false };
          if (Math.abs(s.airPitch) < Math.PI + 0.6) return { steer: p.kind === 'knot' && p.t > 9 ? side(p.side) : 4, action: true };
          p.phase = 1;
          p.t = 0;
          return { steer: 4, action: false };
        }
        if (p.phase === 1) {
          if (p.t < 3) return { steer: p.kind === 'knot' ? side(p.side) : 4, action: false };
          p.phase = 0;
          plan = { ...p, kind: p.kind === 'knot' ? 'paper' : 'grab', phase: 0 };
          return grab(15);
        }
        return { steer: 4, action: false };
      }
      case 'sig': {
        // Two quick taps, steer centred, then hold; let go before the landing and stomp it.
        if (p.t <= 3) return { steer: 4, action: true };
        if (p.t <= 6) return { steer: 4, action: false };
        if (L > 0.3) return { steer: 4, action: true };
        return { steer: 4, action: stomp };
      }
    }
    return { steer: 4, action: false };
  };
}

const names = (ids: Iterable<number>) => [...ids].map((i) => TRICKS[i]?.name ?? `#${i}`).join(', ');

for (const m of MTNS) {
  for (let seed = 0; seed < SEEDS; seed++) {
    const roll = { mood: 0, event: 0, seed: (0x1234 + seed * 2654435761) >>> 0 };
    const sim = new Sim({ seed: MOUNTAINS[m].seed, chaos: roll, sled: 0 });
    const pilot = trickster(sim, seed + 1);
    const spend = spenderFor('expert', sim, seed);
    const count = new Map<number, number>();
    const flights: string[] = [];
    let combo = new Set<number>();
    let best = { n: 0, ids: [] as number[], points: 0 };
    let lastLand = '';
    const falls: string[] = [];
    let named = 0;
    let sketchy = 0;
    let perfect = 0;
    while (!sim.s.crashed && !sim.finished && sim.tick < 420 * 60) {
      const o = pilot();
      sim.step((o.steer | 0) | (o.action ? 16 : 0) | (spend() ? 64 : 0));
      const flight: string[] = [];
      for (const e of sim.events) {
        if (e.type === 'style' && e.trick) {
          combo.add(e.trick);
          count.set(e.trick, (count.get(e.trick) ?? 0) + 1);
          flight.push(`${TRICKS[e.trick].name}${e.trick === 1 ? ' ' + (e.halfTurns ?? 0) * 180 : ''}${e.tier ? ' t' + e.tier : ''}${e.late ? ' late' : ''} ${e.points}${e.fresh ? ' new' : ''}`);
          named++;
        } else if (e.type === 'land' && e.quality !== 'hop') {
          lastLand = e.quality + (e.botched ? ' (botched)' : '') + ` ${e.airtime.toFixed(2)}s`;
          if (e.quality === 'sketchy') sketchy++;
          if (e.quality === 'perfect') perfect++;
        } else if (e.type === 'comboBank' || e.type === 'comboLost') {
          if (combo.size > best.n || (combo.size === best.n && e.points > best.points)) best = { n: combo.size, ids: [...combo], points: e.points };
          combo = new Set();
        } else if (e.type === 'tumble' && e.phase === 'start') falls.push(`${e.cause}@${Math.round(sim.s.z)}`);
        else if (e.type === 'ward') falls.push(`ward:${e.cause}@${Math.round(sim.s.z)}`);
      }
      if (flight.length) flights.push(`  ${Math.round(sim.s.z)} m  ${lastLand}: ${flight.join(' + ')}`);
    }
    console.log(`\n${MOUNTAINS[m].name}, seed ${seed}: ${sim.finished ? 'finished' : 'not finished'} in ${(sim.tick / 60).toFixed(1)} s, score ${sim.score}, ${named} named tricks (${count.size} kinds), perfect ${perfect}, sketchy ${sketchy}`);
    console.log(`  falls: ${falls.length ? falls.join(' ') : 'none'}`);
    console.log(`  best combo: ${best.n} named tricks (${names(best.ids)}), ${best.points} banked`);
    console.log(`  landed: ${[...count.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${TRICKS[k].name} ${v}`).join(', ')}`);
    if (!QUIET) console.log(flights.join('\n'));
  }
}
