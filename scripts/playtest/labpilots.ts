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
  const M = { index: -1, st: 0, dir: 0, at: -1, bias: 0, tap: 0, wait: 0, side: 0, flipped: false, pressed: false, airHold: 0, pressT: 0 };
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
        // (No slide is started that the ice left has no room for.)
        if (M.st >= 9 || (M.st !== 2 && left < 24 + v * ((p.both ? p.each : p.need) / 60))) return { noDrift: true };
        const onIce = c.surface(s.x, s.z).ice;
        // Slide toward where the lake's middle will be: the side with the most ice to cross.
        if (M.dir === 0) M.dir = s.x < c.centerX(s.z + 60) ? 1 : -1;
        if (M.st === 0) {
          // Run straight onto the ice, where the sled is, and start the slide from a straight line once the
          // sheet has opened out. (It used to swing wide first: on glass a swing is kept, the slide began
          // already crossing at 15 m/s, and half the rides ran off the far shore inside a second.)
          const off = Math.max(-6, Math.min(6, s.x - c.safeX(s.z)));
          const across = Math.abs(s.vx - s.vz * ((c.safeX(s.z + 8) - c.safeX(s.z)) / 8));
          if (onIce && s.z > p.z0 + 78 + mr() * 6 * sloppy && across < 2.5) {
            M.dir = s.x < c.centerX(s.z + 60) ? 1 : -1;
            M.st = 1;
          } else return { x: (z: number) => c.safeX(z) + off, noDrift: true };
        }
        if (M.st === 1) {
          if (s.drifting) M.st = 2;
          // (The key first, the crouch once the sled leans that way: a crouch on the old lean drifts the old way.)
          else return { steer: M.dir > 0 ? 8 : 0, action: s.steer * M.dir > 0.5 };
        }
        if (M.st === 2) {
          if (!s.drifting || s.driftDir !== M.dir) {
            M.st = s.drifting ? 3 : 1;
            M.wait = 4;
            return { noDrift: true };
          }
          const done = p.both ? (mo.mask & (M.dir > 0 ? 1 : 2)) !== 0 : false;
          if (done) {
            // One way done: let go (which pops the sled), then the other way as it comes down.
            M.dir = -M.dir;
            M.st = 3;
            M.wait = 4;
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
        // A bell: crouch, and spring so the sled is at the bell's height as it passes under (earlier for one
        // hung high), on the bell's side of the street where it hangs along a wall.
        const rel = v * (0.5 + 0.1 * t.h + M.bias);
        const hold = rel + v * 0.5;
        // (Along a wall: the line that far off the safe one, ridden straight, so the flight stays under them.)
        const off = t.x - c.safeX(t.z);
        const x = t.hw < 4 ? (z: number): number => c.safeX(z) + off : undefined;
        // (Down late from the last flight: crouch at once, and spring as soon as the crouch is a pop.)
        const late = d <= rel && d > v * 0.3;
        if (d < hold && (d > rel || (M.tap < 12 && (M.tap > 0 || late)))) {
          M.tap++;
          return { x, action: true, calm: true, noDrift: true };
        }
        return { x, calm: d < hold + 12, noDrift: true };
      }
      case 'steps': {
        // Down a street the landings are the rider's own: pop wherever a flight has room to come down inside
        // the set piece, and stomp it (the air's own habit).
        if (!skilled || p.style !== 'hops') return null;
        if (M.wait > 0) M.wait--;
        if (p.z1 - s.z < v * 2.6 || M.wait > 0) return { noDrift: true };
        if (M.tap === 0) M.tap = 16 + Math.floor(mr() * 6 * sloppy);
        if (--M.tap === 0) {
          M.wait = 20;
          return { action: false, calm: true, noDrift: true };
        }
        return { action: true, calm: true, noDrift: true };
      }
      case 'surge': {
        if (!skilled) return null;
        // Tuck all the way to the lip (and a beat into the air, so letting go is no pop).
        M.airHold = 12;
        return { action: true, calm: true, noDrift: true };
      }
      case 'flourish': {
        if (!skilled) return null;
        // (No pop off the lip, even for two flips: over a cliff a pop is three more seconds of air, and the sled
        // comes down past the landing. Two flips want speed onto the lip, which is the trade the variant poses.)
        // The last second to the lip is ridden square to it, where the sled is: a rider still coming back to
        // the line there leaves the lip crossing it (the expert did, at 9 m/s sideways, and flew into the bank).
        const d = lipOf(p) - s.z;
        if (d > 0 && d < v * 1.1) {
          if (M.at < 0) {
            M.at = 0;
            M.bias = Math.max(-5, Math.min(5, s.x - c.safeX(s.z)));
          }
          const off = M.bias;
          return { x: (z: number) => c.safeX(z) + off, noDrift: true };
        }
        return { noDrift: true };
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
        // (Across only for lamps that are there: with one row dark the other has none, and a rider who crossed
        // for them every other tick, as this one did, wandered back to the line two lamps short.)
        if ((litHere >= half && litThere < Math.max(p.each, p.need - litHere) && aheadOn(-M.side) >= 0) || aheadOn(M.side) < 0) M.side = -M.side;
        const i = aheadOn(M.side);
        if (i < 0) return { noDrift: true };
        const l = lamps[i];
        // (Coming across the road it aims a little wide of the lamp first: a crossing overshoots.)
        const inside = skilled ? 2.2 : 2.4;
        const pass = l.x - l.side * (Math.abs(s.x - (l.x - l.side * inside)) > 2.5 ? inside + 0.8 : inside);
        if (l.z - s.z > 60) return { noDrift: true };
        return { x: () => pass, noDrift: true };
      }
      case 'carry': {
        // A low flame is fed at the brazier beside the line. It stands a little past the last leap's landing, so
        // a rider who knows it takes the lip on the brazier's side (as far over as the lip's own lamps allow) and
        // comes down already in line with it: landed on the safe line at 45 m/s there is half a second to cross
        // five metres, and no rider does.
        const r = p.relight;
        if (!r || mo.mask & 1 || r.z <= s.z + 2) return { noDrift: true };
        const lip = c.leaps.filter((l: AnySim) => l.z > p.z0 && l.z < r.z).pop();
        // (The novice sees the brazier too, and steers for it once it is down: the lip's side is the skilled rider's.)
        if (skilled && lip && s.z < lip.z && lip.z - s.z < 160) {
          const off = r.x - c.safeX(r.z);
          return { x: (z: number) => c.safeX(z) + Math.sign(off) * Math.min(3, Math.abs(off)), noDrift: true };
        }
        if (r.z - s.z < v * 2.2) return { x: () => r.x, noDrift: true };
        return { noDrift: true };
      }
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
      // Commit at takeoff, if the flight is long enough for it. (Not on a skip over the brow, nor on the lip's
      // first tick, when the snow still under the runners reads as a landing: the expert, a little faster off
      // the lip, read it so, took the flight for a hop, and spun where two flips were asked.)
      if (land.t < 0.5) return null;
      M.flipped = true;
      M.pressT = 0;
      const need = Math.max(wantYaw / 9 + 0.5, wantPitch > 0 ? wantPitch / 6.8 + 0.6 : 0);
      M.st = land.t > need + 0.1 ? 1 : 0;
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
    else if (flipping) {
      action = true;
      // (Round 8: a press with the steer to a side is a grab, so a spin on a flip waits for the flip's latch: the
      // press goes in centred and the steer follows it.)
      M.pressT++;
      if (M.pressT <= 5) steer = 4;
    } else {
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
        // (The careful line spins nothing. It used to: it took the mid pilot's habit with its hands, each spin's
        // held key pushed it two to four metres off the line in the air, and it skipped down the landing face
        // unable to steer back, into the trees ten metres out. That was the pilot, not the landing.)
        P.spin = skill !== 'novice' && skill !== 'line' && land.t > 1.45 && room > 4 && Math.abs(off) < 1.5 && rnd() < (skill === 'expert' ? 0.95 : 0.7) ? (off > 0 ? -1 : 1) : 0;
        P.stompTry = skill === 'mid' || skill === 'expert' ? true : skill === 'novice' && rnd() < 0.4;
        P.stompBias = (rnd() - 0.5) * (skill === 'expert' ? 0.05 : skill === 'mid' ? 0.16 : 0.3);
        // A rider carrying the flame, or hopping under bells, spins nothing.
        // (Nor does one stomping steps: a spin over a 60 m step is how round 6's expert lost them.)
        if (piece && skill !== 'line' && (piece.verb === 'carry' || piece.verb === 'shatter' || piece.verb === 'surge' || piece.verb === 'steps')) P.spin = 0;
        // Nor does a rider who knows the hill spin a flight that comes down on a set piece's doorstep: a spin
        // pushes a sled wide, and the set piece wants it on its line.
        const ahead = pieceAhead(sim);
        if (ahead && skill !== 'line' && skill !== 'novice' && ahead.z0 - land.z < 150) P.spin = 0;
      }
      const land = timeToLand(sim);
      if (piece && piece.verb === 'flourish') {
        const f = flourish(s, piece, land);
        if (f) return f;
      }
      let steer = 4;
      // (Round 7: the expert keeps its double spin for a landing with room after it. A spin pushes a sled wide,
      // and round 6's expert carried that into the slot below a leap: no rider who knows the hill does.)
      const slot = c.halfWidth(land.z + 110) < 9.5;
      // Coming up on a set piece (or in one) a rider who knows it lands set up for it: one spin at most, and
      // a nudge toward the line that stays inside the air's dead zone, so it moves the sled without turning it.
      const next = pieceAhead(sim);
      const setUp = skill !== 'novice' && (!!piece || (!!next && next.z0 - land.z < 400));
      let goal = (skill === 'expert' && P.flight > 2.4 && !slot && !setUp ? 4 : 2) * Math.PI;
      if (goal > 2 * Math.PI && land.t < (goal - Math.abs(s.airYaw)) / 9 + 0.3) goal = 2 * Math.PI;
      const coast = (s.spinRate * s.spinRate) / (2 * 22);
      if (P.spin && Math.abs(s.airYaw) + coast < goal - 0.12 && land.t > 0.2) steer = P.spin > 0 ? 8 : 0;
      else if ((skill === 'mid' || skill === 'expert') && piece && piece.verb === 'carry' && piece.relight && !(sim.mo.mask & 1) && piece.relight.z > s.z) {
        // (Over the last leap with a low flame: a nudge inside the air's dead zone toward the brazier's side.)
        const off = land.x - piece.relight.x;
        if (Math.abs(off) > 0.8) steer = off > 0 ? 3 : 5;
      } else if ((skill === 'mid' || skill === 'expert') && !(piece && (piece.verb === 'steps' || piece.verb === 'carry'))) {
        // (Not over a set piece that is decided by its landings: this nudge is past the air's dead zone, so it
        // turns the sled as well as moving it, and a landing half way round is a sketchy one.)
        const off = land.x - c.safeX(land.z);
        // (Gently, unless the landing is well off the line: then the line matters more than a square landing.)
        const soft = setUp && Math.abs(off) < 2;
        if (Math.abs(off) > 0.8) steer = off > 0 ? (soft ? 3 : 2) : soft ? 5 : 6;
      }
      // (A tuck held through a surge's lip is let go a beat into the air, where it is no pop.)
      if (M.airHold > 0) {
        M.airHold--;
        return { steer, action: true };
      }
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
    let ramp = !act ? nextRamp(s) : null;
    let target = (z: number) => c.safeX(z);
    // A kicker whose flight comes down on glass that is to be slid across is ridden round: a popped flight off
    // the one above Mirror Lake lands 110 m into its 270 m, and what is left is too short for a slide each way.
    const ahead = pieceAhead(sim);
    let round = 0;
    if (ramp && ahead && ahead.verb === 'slide' && ramp.z + ramp.len + 150 > ahead.z0) {
      round = ramp.x + (s.x >= ramp.x ? 1 : -1) * (ramp.w * 0.5 + 1.4);
      ramp = null;
    }
    if (ramp) target = () => ramp.x;
    else if (round) target = () => round;
    else if (aim) target = aim;
    const bend = c.safeX(s.z + 24) - c.safeX(s.z + 4);
    const room = c.halfWidth(s.z) - Math.abs(s.x - c.centerX(s.z));
    const mayDrift = !act || !act.noDrift;
    if (mayDrift && !ramp && P.drift === 0 && Math.abs(bend) > 4.5 && room > 6 && Math.abs(s.x - c.safeX(s.z)) < 0.8 && rnd() < 0.02) P.drift = T + 0.3 + rnd() * 0.25;
    if (P.drift > T && (room < 4 || Math.abs(s.x - c.safeX(s.z)) > 0.8 || !mayDrift)) P.drift = T;
    if (P.drift > T) return { steer: bend > 0 ? 8 : 0, action: true };
    if (P.drift > 0 && P.drift <= T) P.drift = -(T + 3);
    if (P.drift < 0 && T > -P.drift) P.drift = 0;
    let lvl = steerTo(s, target, 14, ramp || aim || round ? 0 : 0.08);
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

/** A steady hand: it rides straight down the run where it is, as far off the safe line as it was when it took
 *  over (kept 3 m inside the corridor), with the line pilot's own steering and no button. A rider who has
 *  fallen is put on the safe line by the fall, so after one this pilot rides the line. It makes no detour
 *  and no mistake, so what is left between two rides it finishes is the fall and nothing else. */
export function steadyPilot(sim: AnySim): Pilot {
  const c = sim.course;
  let off = sim.s.x - c.safeX(sim.s.z);
  return () => {
    const s = sim.s;
    if (s.tumble > 0) off = s.x - c.safeX(s.z);
    if (!s.grounded || s.tumble > 0) return { steer: 4, action: false };
    const look = s.z + 4 + s.speed * 0.35;
    const room = Math.max(0, c.halfWidth(look) - 3);
    const tx = Math.max(c.centerX(look) - room, Math.min(c.centerX(look) + room, c.safeX(look) + off));
    const err = Math.atan2(tx - s.x, look - s.z) - s.velHeading;
    return { steer: Math.max(0, Math.min(8, Math.round(4 + err * 14))), action: false };
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
        if (k === 'go') return lit() >= 1 && s.grounded && Math.abs(s.x - sim.course.safeX(s.z)) < 5 ? press() : false;
        if (k === 'hold') return false;
        const keep = (s.z > 2000 ? 1 : 0) + (k === 'save' ? 1 : 0);
        return lit() > Math.min(keep, 1) && s.grounded && !kickerNear() && rnd() < 0.6 / 60 ? press() : false;
      }
      case 'expert-dash':
        // Round 6's expert, kept to measure what knowing the set pieces is worth: a dash the moment a lantern
        // lights, wherever it is (lab.ts --pilots expert-dash).
        if (lit() < 1 || !s.grounded || kickerNear()) return false;
        return closing() || rnd() < 0.9 / 60 ? press() : false;
      case 'expert': {
        const k = knows();
        // (On the line: a dash from out on the bank goes into whatever the bank holds.)
        if (k === 'go') return lit() >= 1 && s.grounded && Math.abs(s.x - sim.course.safeX(s.z)) < 5 ? press() : false;
        if (k === 'hold') return false;
        if (lit() < (k === 'save' ? 2 : 1) || !s.grounded || kickerNear()) return false;
        return closing() || rnd() < 0.9 / 60 ? press() : false;
      }
      default:
        return false;
    }
  };
}
