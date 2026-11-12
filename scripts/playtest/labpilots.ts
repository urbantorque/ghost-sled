// The lab's pilots with a human model (lab.ts rides them; tests/moments.test.ts rides the skilled ones to prove
// every variant of every set piece can be won). They import nothing from src: each takes the sim it is to ride,
// so one plan rides two builds (lab.ts --root), and what a newer sim adds reaches them through `kit`.
//
// Round 7: the skilled pilots (mid and expert) play every set piece as a person who knows it would, and spend
// their lanterns as that person would: a dash for a race, a surge or the carry, and none into a set piece that
// wants control (a slalom of gates, a ring line, a slide, a row of lamps). Round 6's expert dashed the moment a
// lantern lit, wherever it was, which is how it came to win fewer set pieces than mid: nobody who had ridden
// Old Town twice would dash into it. The novice tries what a careful beginner can (gates, rings, the guide
// light, the lamps); the careful line and the clumsy pilot try nothing, as before.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySim = any;

export type Inp = { steer: number; action: boolean };
/** `after` runs once a tick after the sim stepped (the rail pilot keeps its notes there). */
export type Pilot = (() => Inp) & { after?: () => void };

/** What a newer sim's moments.ts gives the pilots (absent on an older one). */
export interface Kit {
  gateX?: (g: AnySim, ticks: number) => number;
  pathX?: (course: AnySim, path: AnySim, z: number) => number;
  machineZ?: (p: AnySim, ticks: number, car?: number) => number;
}

const CHUNK_LEN = 64;

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** src/game/input.ts's key ramp and quantiser. */
export class Keys {
  private keySteer = 0;
  private level = 4;
  sample(target: number): number {
    if (target === 0) this.keySteer = 0;
    else if (this.keySteer * target <= 0) this.keySteer = target * 0.35;
    else this.keySteer = target * Math.min(1, Math.abs(this.keySteer) + 0.055);
    const raw = this.keySteer * 4;
    if (Math.abs(raw - (this.level - 4)) > 0.62) this.level = 4 + Math.round(raw);
    return this.level;
  }
}

export function scripted(fn: (t: number) => number, action: (t: number) => boolean = () => false) {
  return (sim: AnySim): Pilot => {
    const k = new Keys();
    return () => ({ steer: k.sample(fn(sim.tick / 60)), action: action(sim.tick / 60) });
  };
}

export function clumsy(sim: AnySim, seed: number): Pilot {
  const rnd = mulberry(seed * 7919 + 13);
  const k = new Keys();
  const c = sim.course;
  let key = 0;
  let keyUntil = 0;
  let nextThink = 0.4 + rnd() * 0.5;
  let act = false;
  let actUntil = 0;
  let nextAct = 1 + rnd() * 3;
  return () => {
    const s = sim.s;
    const T = sim.tick / 60;
    if (T >= keyUntil) key = 0;
    if (T >= nextThink && !s.crashed) {
      nextThink = T + 0.35 + rnd() * 0.45;
      // Aims down the middle of what it can see, not at the safe line, and it looks too near.
      const look = s.z + 9 + rnd() * 6;
      const cx = c.centerX(look) + (rnd() - 0.5) * 5;
      const off = cx - s.x;
      if (key === 0) {
        if (rnd() < 0.12) {
          // The hand freezes on a key for no reason.
          key = rnd() < 0.5 ? 1 : -1;
          keyUntil = T + 1.6 + rnd() * 0.8;
        } else if (Math.abs(off) > 2.2) {
          // A panic correction: far longer than the bend wants, and it overshoots.
          key = off > 0 ? 1 : -1;
          keyUntil = T + 0.5 + rnd() * 1.1;
        }
      }
    }
    if (T >= nextAct) {
      nextAct = T + 1.5 + rnd() * 4;
      act = true;
      actUntil = T + 0.2 + rnd() * 0.9;
    }
    if (T >= actUntil) act = false;
    return { steer: k.sample(key), action: act };
  };
}

export function timeToLand(sim: AnySim): { t: number; x: number; z: number } {
  const s = sim.s;
  const c = sim.course;
  let y = s.y;
  let vy = s.vy;
  let x = s.x;
  let z = s.z;
  let t = 0;
  while (t < 8) {
    vy -= sim.gravity / 60;
    y += vy / 60;
    x += s.vx / 60;
    z += s.vz / 60;
    t += 1 / 60;
    if (y <= c.ground(x, z)) break;
  }
  return { t, x, z };
}

/** The set piece a pilot is in, or about to be in. */
function pieceNow(sim: AnySim): AnySim | null {
  const mo = sim.mo;
  if (!mo || !sim.plays) return null;
  return mo.active >= 0 ? sim.plays[mo.active] : null;
}

/** The next set piece down the run that has not begun. */
function pieceAhead(sim: AnySim): AnySim | null {
  const mo = sim.mo;
  if (!mo || !sim.plays || mo.active >= 0) return null;
  return sim.plays[mo.next] ?? null;
}

/** A leap's lip inside a set piece (the ring line's rings hang 0.4 s past it at 34 m/s). */
function lipOf(p: AnySim): number {
  if (p.lip) return p.lip;
  return p.rings && p.rings.length ? p.rings[0].z - 13.6 : p.z0 + 40;
}

/** What a set piece asks of the hands on the snow this tick. */
interface Act {
  /** Where to aim: an x, or a line down the course. */
  x?: number | ((z: number) => number);
  action?: boolean;
  /** A steering level that overrides the aim (a drift's hard key). */
  steer?: number;
  /** Hold the steering inside the crouch's dead zone (a crouch that steers hard starts a drift). */
  calm?: boolean;
  /** No drift of the pilot's own here. */
  noDrift?: boolean;
}

/** telemetry.js's frozen novice, mid, expert and line pilots, without the ghost targeting; mid and expert know
 *  every set piece (above). */
export function classic(skill: 'novice' | 'mid' | 'expert' | 'line', sim: AnySim, seed: number, kit: Kit = {}): Pilot {
  const rnd = mulberry(seed);
  const c = sim.course;
  const P = { flight: 0, spin: 0, stompTry: false, stompBias: 0, away: 0, tap: 0, drift: 0, wob: rnd() * 6.28, lvl: 4, nextThink: 0, wasAir: false };
  // A set piece's own notes (its own stream of chance, so the rest of the ride is what it always was).
  const mr = mulberry(seed ^ 0x51ce);
  const sloppy = skill === 'expert' ? 0.25 : 1;
  const M = { index: -1, st: 0, dir: 0, at: -1, bias: 0, tap: 0, wait: 0, side: 0, flipped: false, pressed: false, airHold: 0 };
  const steerTo = (s: AnySim, target: (z: number) => number, gain: number, lat: number): number => {
    const look = s.z + 4 + s.speed * 0.35;
    const desired = Math.atan2(target(look) - s.x, look - s.z);
    const err = desired - s.velHeading + (c.safeX(s.z) - s.x) * lat;
    return Math.max(0, Math.min(8, Math.round(4 + err * gain)));
  };
  const nextRamp = (s: AnySim) => {
    for (let k = Math.floor(s.z / 64); k <= Math.floor(s.z / 64) + 2; k++) {
      for (const rr of c.zones(k).ramps) {
        if (rr.z + rr.len > s.z + 1 && rr.z - s.z < 70) {
          if (Math.abs(rr.x - c.centerX(rr.z)) > c.halfWidth(rr.z) - 4 || Math.abs(rr.x - c.safeX(rr.z + rr.len)) > 2.5) return null;
          return rr;
        }
      }
    }
    return null;
  };

  /** The set piece being played, as a rider who knows it rides it. Null between set pieces, for the careful
   *  line, and for a verb this pilot leaves alone. */
  const play = (s: AnySim): Act | null => {
    if (skill === 'line') return null;
    const p = pieceNow(sim);
    if (!p) return null;
    const mo = sim.mo;
    if (M.index !== p.index) {
      M.index = p.index;
      M.st = 0;
      M.dir = 0;
      M.at = -1;
      M.tap = 0;
      M.wait = 0;
      M.side = 0;
      M.flipped = false;
      M.pressed = false;
    }
    const v = Math.max(10, s.vz);
    const skilled = skill !== 'novice';
    switch (p.verb) {
      case 'gates': {
        const g = p.gates.find((q: AnySim) => q.z > s.z + 1);
        if (!g || g.z - s.z >= 45) return null;
        // A gate that swings: where its sway will have it when the sled gets there.
        if (g.amp > 0 && kit.gateX) return { x: kit.gateX(g, sim.tick - mo.t0 + ((g.z - s.z) / v) * 60), noDrift: true };
        // Cut the inside of each gate, as a rider who knows the line does: half its opening toward the line.
        return { x: g.x - Math.sign(g.x - c.safeX(g.z)) * g.hw * 0.5, noDrift: true };
      }
      case 'rings': {
        if (!p.rings.length || s.z >= p.rings[0].z - 14) return null;
        const lip = lipOf(p);
        // The high line: crouch into the lip and let go as the sled leaves it.
        const high = skilled && p.variantKey === 'high' && lip - s.z < 30;
        return { x: p.rings[0].x, action: high, calm: high, noDrift: true };
      }
      case 'slide': {
        if (!skilled) return null;
        const left = p.z1 - s.z;
        if (M.st >= 9 || left < 70) return { noDrift: true };
        const cx = c.centerX(s.z);
        const onIce = c.surface(s.x, s.z).ice;
        if (M.dir === 0) M.dir = s.x < cx ? 1 : -1;
        if (M.st === 0) {
          // Set up wide on one side while the ice comes in, to slide back across the whole sheet.
          const out = cx - M.dir * c.halfWidth(s.z + 30) * 0.42;
          if (onIce && s.z > p.z0 + 96 + mr() * 6 * sloppy) M.st = 1;
          else return { x: () => out, noDrift: true };
        }
        if (M.st === 1) {
          if (s.drifting) M.st = 2;
          else return { steer: M.dir > 0 ? 8 : 0, action: true };
        }
        if (M.st === 2) {
          if (!s.drifting) {
            M.st = 1;
            return { noDrift: true };
          }
          const done = p.both ? (mo.mask & (M.dir > 0 ? 1 : 2)) !== 0 : false;
          if (done) {
            // One way done: let go, then the other way.
            M.dir = -M.dir;
            M.st = 3;
            M.wait = 14;
            return { noDrift: true };
          }
          // The widest arc the drift allows: full counter-steer, which holds the slide longest.
          return { steer: M.dir > 0 ? 0 : 8, action: true };
        }
        if (M.st === 3) {
          if (--M.wait <= 0) M.st = 1;
          return { noDrift: true };
        }
        return { noDrift: true };
      }
      case 'shatter': {
        if (!skilled) return null;
        const t = p.targets[mo.at];
        if (!t) return { noDrift: true };
        if (M.at !== mo.at) {
          M.at = mo.at;
          M.bias = (mr() - 0.5) * 0.2 * sloppy;
          M.tap = 0;
          M.pressed = false;
        }
        const d = t.z - s.z;
        if (p.own) {
          // A bell: one quick hop, so the sled is in the air under it.
          if (!M.pressed && d < v * (0.33 + M.bias * 0.5) && d > v * 0.1) {
            M.pressed = true;
            M.tap = 2;
          }
          if (M.tap > 0) {
            M.tap--;
            return { action: true, calm: true, noDrift: true };
          }
          return { calm: d < v * 0.6, noDrift: true };
        }
        // A garland: crouch for a full charge, and spring so its top is under the garland (a pair: early, so
        // the one pop is still up for the second).
        const next = p.targets[mo.at + 1];
        const pair = next && next.z - t.z < 20;
        const rel = v * ((pair ? 0.26 : 0.46) + M.bias);
        const hold = rel + v * 0.68;
        if (d < hold && d > rel) return { action: true, calm: true, noDrift: true };
        return { calm: d < hold + 12, noDrift: true };
      }
      case 'surge': {
        if (!skilled) return null;
        // Tuck all the way to the lip (and a beat into the air, so letting go is no pop).
        M.airHold = 12;
        return { action: true, calm: true, noDrift: true };
      }
      case 'flourish': {
        if (!skilled) return null;
        const lip = lipOf(p);
        // Two flips want more air than the leap gives: pop off the lip for them.
        const pop = p.flips >= 2 && lip - s.z < 30 && lip - s.z > 0;
        return { action: pop, calm: pop, noDrift: true };
      }
      case 'follow': {
        if (!p.path || !kit.pathX) return null;
        const px = kit.pathX;
        return { x: (z: number) => px(c, p.path, z), noDrift: true };
      }
      case 'kindle': {
        // Ride close along one row, then cross for the other: the next unlit lamp on the side being ridden,
        // passed between it and the line.
        const lamps: AnySim[] = p.lamps;
        const isLit = (i: number): boolean => (mo.mask & (1 << i)) !== 0;
        const leftLit = mo.aux;
        const rightLit = mo.n - mo.aux;
        const half = Math.max(p.each, Math.ceil(p.need / 2));
        const aheadOn = (side: number): number => lamps.findIndex((l, i) => l.dark && !isLit(i) && l.side === side && l.z > s.z + 5);
        if (M.side === 0) {
          const first = lamps.find((l) => l.dark && l.z > s.z + 5);
          M.side = first ? first.side : 1;
        }
        const litHere = M.side < 0 ? leftLit : rightLit;
        const litThere = M.side < 0 ? rightLit : leftLit;
        if ((litHere >= half && litThere < Math.max(p.each, p.need - litHere)) || aheadOn(M.side) < 0) M.side = -M.side;
        const i = aheadOn(M.side);
        if (i < 0) return { noDrift: true };
        const l = lamps[i];
        const pass = l.x - l.side * (skilled ? 2.0 : 2.25);
        if (l.z - s.z > 60) return { noDrift: true };
        return { x: () => pass, noDrift: true };
      }
      case 'carry':
        return { noDrift: true };
      default:
        return null;
    }
  };

  /** In the air over a flourish's leap: the trick it asks for, then set for the landing. */
  const flourish = (s: AnySim, p: AnySim, land: { t: number }): Inp | null => {
    if (skill === 'novice' || skill === 'line' || s.z < lipOf(p) - 6) return null;
    const wantYaw = p.half * Math.PI;
    const wantPitch = p.flips * 2 * Math.PI;
    if (!M.flipped) {
      // Commit at takeoff, if the flight is long enough for it.
      M.flipped = true;
      const need = Math.max(wantYaw / 9 + 0.5, wantPitch > 0 ? wantPitch / 6.8 + 0.6 : 0);
      M.st = land.t > need + 0.25 ? 1 : 0;
      M.dir = mr() < 0.5 ? 1 : -1;
      M.bias = (mr() - 0.5) * 0.24 * sloppy;
      M.wait = 2;
    }
    if (M.st !== 1) return null;
    let steer = 4;
    const coastYaw = (s.spinRate * s.spinRate) / (2 * 22);
    if (Math.abs(s.airYaw) + coastYaw < wantYaw - 0.12 + M.bias && land.t > 0.3) steer = M.dir > 0 ? 8 : 0;
    let action = false;
    const coastPitch = (s.pitchRate * s.pitchRate) / (2 * 26);
    const flipping = wantPitch > 0 && Math.abs(s.airPitch) + coastPitch < wantPitch - 0.2 + M.bias && land.t > 0.45;
    if (M.wait > 0) M.wait--; // (a beat with the key up, so the flip's press is a fresh one)
    else if (flipping) action = true;
    else {
      // The trick is in: stomp the landing.
      const w = land.t - P.stompBias;
      action = Math.abs(s.pitchRate) < 1 && w < 0.11 && w > 0.01;
    }
    return { steer, action };
  };

  return () => {
    const s = sim.s;
    const T = sim.tick / 60;
    if (s.crashed) return { steer: 4, action: false };
    const piece = pieceNow(sim);
    if (!s.grounded) {
      if (!P.wasAir) {
        P.wasAir = true;
        const land = timeToLand(sim);
        P.flight = land.t;
        const room = c.halfWidth(land.z) - Math.abs(land.x - c.centerX(land.z));
        const off = land.x - c.safeX(land.z);
        P.spin = skill !== 'novice' && land.t > 1.45 && room > 4 && Math.abs(off) < 1.5 && rnd() < (skill === 'expert' ? 0.95 : 0.7) ? (off > 0 ? -1 : 1) : 0;
        P.stompTry = skill === 'mid' || skill === 'expert' ? true : skill === 'novice' && rnd() < 0.4;
        P.stompBias = (rnd() - 0.5) * (skill === 'expert' ? 0.05 : skill === 'mid' ? 0.16 : 0.3);
        // A rider carrying the flame, or hopping under bells, spins nothing.
        if (piece && skill !== 'line' && (piece.verb === 'carry' || piece.verb === 'shatter' || piece.verb === 'surge')) P.spin = 0;
      }
      const land = timeToLand(sim);
      if (piece && piece.verb === 'flourish') {
        const f = flourish(s, piece, land);
        if (f) return f;
      }
      let steer = 4;
      let goal = (skill === 'expert' && P.flight > 2.4 ? 4 : 2) * Math.PI;
      if (goal > 2 * Math.PI && land.t < (goal - Math.abs(s.airYaw)) / 9 + 0.3) goal = 2 * Math.PI;
      const coast = (s.spinRate * s.spinRate) / (2 * 22);
      if (P.spin && Math.abs(s.airYaw) + coast < goal - 0.12 && land.t > 0.2) steer = P.spin > 0 ? 8 : 0;
      else if (skill === 'mid' || skill === 'expert') {
        const off = land.x - c.safeX(land.z);
        if (Math.abs(off) > 0.8) steer = off > 0 ? 2 : 6;
      }
      // (A tuck held through a surge's lip is let go a beat into the air, where it is no pop.)
      if (M.airHold > 0) {
        M.airHold--;
        return { steer, action: true };
      }
      // Under the bells a hop is a hop: no stomp, so the next press is a clean one.
      if (piece && piece.verb === 'shatter' && piece.own && skill !== 'novice' && skill !== 'line') return { steer, action: false };
      const w = land.t - P.stompBias;
      return { steer, action: P.stompTry && w < 0.11 && w > 0.01 };
    }
    P.wasAir = false;
    if (skill === 'line') return { steer: steerTo(s, (z) => c.safeX(z), 14, 0.08), action: false };
    const act = play(s);
    if (!act || act.action !== true) M.airHold = 0;
    const aim = act && act.x !== undefined ? (typeof act.x === 'number' ? ((x: number) => () => x)(act.x) : act.x) : null;
    if (skill === 'novice') {
      if (P.away > T) return { steer: 4, action: false };
      if (rnd() < 1 / (60 * 30)) {
        P.away = T + 0.5 + rnd() * 0.6;
        return { steer: 4, action: false };
      }
      if (T >= P.nextThink) {
        P.nextThink = T + 0.08 + rnd() * 0.08;
        const wob = 0.45 * Math.sin(T * 0.7 + P.wob) + 0.25 * Math.sin(T * 1.9 + P.wob * 2);
        P.lvl = aim ? steerTo(s, (z) => aim(z) + wob, 10, 0) : steerTo(s, (z) => c.safeX(z) + wob, 10, 0.06);
      }
      if (P.tap <= T && rnd() < 1 / (60 * 8)) P.tap = T + 0.3 + rnd() * 0.4;
      return { steer: P.lvl, action: P.tap > T };
    }
    if (P.away > T) return { steer: 4, action: false };
    if (skill === 'mid' && rnd() < 1 / (60 * 70)) {
      P.away = T + 0.4 + rnd() * 0.4;
      return { steer: 4, action: false };
    }
    const ramp = !act ? nextRamp(s) : null;
    let target = (z: number) => c.safeX(z);
    if (ramp) target = () => ramp.x;
    else if (aim) target = aim;
    const bend = c.safeX(s.z + 24) - c.safeX(s.z + 4);
    const room = c.halfWidth(s.z) - Math.abs(s.x - c.centerX(s.z));
    const mayDrift = !act || !act.noDrift;
    if (mayDrift && !ramp && P.drift === 0 && Math.abs(bend) > 4.5 && room > 6 && Math.abs(s.x - c.safeX(s.z)) < 0.8 && rnd() < 0.02) P.drift = T + 0.3 + rnd() * 0.25;
    if (P.drift > T && (room < 4 || Math.abs(s.x - c.safeX(s.z)) > 0.8 || !mayDrift)) P.drift = T;
    if (P.drift > T) return { steer: bend > 0 ? 8 : 0, action: true };
    if (P.drift > 0 && P.drift <= T) P.drift = -(T + 3);
    if (P.drift < 0 && T > -P.drift) P.drift = 0;
    let lvl = steerTo(s, target, 14, ramp || aim ? 0 : 0.08);
    let action = false;
    if (ramp) {
      const u = (s.z - ramp.z) / ramp.len;
      action = u > -0.7 && u < 0.85;
    }
    if (act) {
      if (act.action !== undefined) action = act.action;
      if (act.calm) lvl = Math.max(3, Math.min(5, lvl));
      if (act.steer !== undefined) lvl = act.steer;
    }
    return { steer: lvl, action };
  };
}

/** How each pilot spends its lantern (SIM_VERSION 7): the button is bit 6, a dash on its press. A build
 *  without a lantern never sees the bit (old sims mask it off), so one plan still rides two builds.
 *    hands-off, hold*, zigzag, line: never press it (line is the careful rider who keeps every ward)
 *    clumsy: mashes it now and then, whatever is ahead, like a first-timer finding a new key
 *    novice: keeps one lantern as a ward, spends a second on the snow a beat after it lights
 *    stunt: spends any full lantern on the snow with no kicker close ahead, keeping one past 2 km
 *    mid: as the stunt pilot, and expert: spends at once, best of all into a line that closes ahead (a spirit
 *      rides through). Both know the set pieces (round 7): a dash goes on a race as it starts, on the run to a
 *      surge's lip and on the first metres of the carry; one lantern is kept for those when one is close ahead;
 *      and none is spent into a set piece that wants control, or in the three seconds before one.
 */
export function spenderFor(name: string, sim: AnySim, seed: number): () => boolean {
  const rnd = mulberry(seed ^ 0x5a17);
  let hold = 0;
  let wait = 0;
  const lit = (): number => Math.floor((sim.s.lantern ?? 0) / 100);
  const kickerNear = (): boolean => {
    const s = sim.s;
    const k0 = Math.floor(s.z / CHUNK_LEN);
    for (let k = k0; k <= k0 + 1; k++) for (const r of sim.course.zones(k).ramps) if (r.z > s.z - 2 && r.z < s.z + 30 && Math.abs(r.x - s.x) < 5) return true;
    return false;
  };
  const closing = (): boolean => {
    const s = sim.s;
    const k0 = Math.floor(s.z / CHUNK_LEN);
    for (let k = k0; k <= k0 + 1; k++)
      for (const o of sim.course.chunk(k).obstacles) {
        if (o.soft || o.z < s.z + 4 || o.z > s.z + 18) continue;
        const ahead = s.x + (s.vx / Math.max(1, s.vz)) * (o.z - s.z);
        if (Math.abs(o.x - ahead) < o.r + 1) return true;
      }
    return false;
  };
  const press = (): boolean => {
    hold = 3;
    return true;
  };
  const SPEED = new Set(['race', 'surge', 'carry', 'collapse']);
  /** What the set pieces ask of the lantern now: 'go' (dash), 'hold' (do not), 'save' (keep one), or nothing. */
  const knows = (): 'go' | 'hold' | 'save' | '' => {
    const s = sim.s;
    const p = pieceNow(sim);
    if (p) {
      const ticks = sim.tick - sim.mo.t0;
      if (p.verb === 'race') return ticks < 50 ? 'go' : '';
      if (p.verb === 'carry') return ticks < 50 ? 'go' : '';
      if (p.verb === 'collapse') return '';
      if (p.verb === 'surge') {
        const d = lipOf(p) - s.z;
        return d < s.speed * 1.2 && d > s.speed * 0.35 ? 'go' : d > 0 ? 'hold' : '';
      }
      return 'hold';
    }
    const q = pieceAhead(sim);
    if (!q) return '';
    const d = q.z0 - s.z;
    if (SPEED.has(q.verb)) {
      // A surge's lip is 40 m into it: its dash goes in on the way there.
      if (q.verb === 'surge' && d + 40 < s.speed * 1.2) return 'go';
      return d < 450 && q.verb !== 'collapse' ? 'save' : '';
    }
    return d < s.speed * 3 ? 'hold' : '';
  };
  return () => {
    if (hold > 0) {
      hold--;
      return true;
    }
    const s = sim.s;
    if (s.lantern === undefined || s.dash > 0 || s.tumble > 0 || s.finished) return false;
    switch (name) {
      case 'clumsy':
        return rnd() < 0.15 / 60 ? press() : false;
      case 'clumsy-keep':
        return false;
      case 'novice':
        if (lit() >= 2 && s.grounded) {
          if (++wait > 50) {
            wait = 0;
            return press();
          }
        } else wait = 0;
        return false;
      case 'stunt': {
        const keep = s.z > 2000 ? 1 : 0;
        return lit() > keep && s.grounded && !kickerNear() && rnd() < 0.6 / 60 ? press() : false;
      }
      case 'mid': {
        const k = knows();
        if (k === 'go') return lit() >= 1 && s.grounded ? press() : false;
        if (k === 'hold') return false;
        const keep = (s.z > 2000 ? 1 : 0) + (k === 'save' ? 1 : 0);
        return lit() > Math.min(keep, 1) && s.grounded && !kickerNear() && rnd() < 0.6 / 60 ? press() : false;
      }
      case 'expert': {
        const k = knows();
        if (k === 'go') return lit() >= 1 && s.grounded ? press() : false;
        if (k === 'hold') return false;
        if (lit() < (k === 'save' ? 2 : 1) || !s.grounded || kickerNear()) return false;
        return closing() || rnd() < 0.9 / 60 ? press() : false;
      }
      default:
        return false;
    }
  };
}
