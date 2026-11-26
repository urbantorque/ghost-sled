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
  /** Round 9, the Old Run: its track's own turn (sim.ts wallYaw, TRACK_DAMP, TRACK_BANK), so the skilled pilots hold
   *  a height on its walls as a rider who knows them does. Absent, they steer to a heading as everywhere. */
  track?: { wallYaw: (grad: { x: number; z: number }, phi: number, speed: number, g: number) => number; damp: number; bank: number };
  /** Ride the floor's middle on a kit's course, not the kit's line for this skill (the lab's floor line). */
  floor?: boolean;
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
  // (Round 9: on a new mountain the line a rider of this skill rides there and then, kit.ts lineFor: up the Old Run's
  // walls for the skilled. The five have no kit, and ride the safe line as they always did.)
  const rider = { x: 0, y: 0, z: 0, v: 0, skill: skill === 'expert' ? 0.9 : skill === 'mid' ? 0.55 : skill === 'novice' ? 0.25 : 0, nerve: skill === 'expert' ? 0.7 : 0.3 };
  const lineAt: (z: number) => number = c.kit && c.kit.lineFor && !kit.floor ? (z: number) => c.lineFor(z, rider) : (z: number) => c.safeX(z);
  const steerTo = (s: AnySim, target: (z: number) => number, gain: number, lat: number): number => {
    if (c.kit) Object.assign(rider, { x: s.x, y: s.y, z: s.z, v: s.speed });
    const look = s.z + 4 + s.speed * 0.35;
    const desired = Math.atan2(target(look) - s.x, look - s.z);
    const err = desired - s.velHeading + (lineAt(s.z) - s.x) * lat;
    return Math.max(0, Math.min(8, Math.round(4 + err * gain)));
  };
  // (Round 9, the Old Run: on its track the skilled pilots hold a height on the wall, not a heading. The offset square
  // to the channel is steered toward the line's, with the channel's turn, the wall's own turn and the track's damping
  // fed forward. The five have no kit, and never come here.)
  const track = c.kit && kit.track ? kit.track : null;
  const grad = { x: 0, z: 0 };
  const across = (z: number, x: number): number => {
    const p = c.channelSlope(z);
    return (x - c.centerX(z)) / Math.sqrt(1 + p * p);
  };
  const holdTo = (s: AnySim, target: (z: number) => number, gain: number): number => {
    if (!track) return 4;
    Object.assign(rider, { x: s.x, y: s.y, z: s.z, v: s.speed });
    const v = Math.max(8, s.speed);
    const p = c.channelSlope(s.z);
    const phi = Math.atan(p);
    const look = s.z + v * 0.35;
    const want = across(look, target(look));
    const wantRate = (across(look + 1, target(look + 1)) - want) * s.vz;
    const lateral = Math.max(-7, Math.min(7, wantRate - 1.6 * gain * (across(s.z, s.x) - want)));
    const psi = Math.asin(Math.max(-0.5, Math.min(0.5, lateral / v)));
    const phiRate = ((c.channelSlope(s.z + 1) - p) * s.vz) / (1 + p * p);
    c.gradient(s.x, s.z, grad);
    const yaw = track.wallYaw(grad, phi, s.speed, sim.gravity);
    const grip = 6.5 * sim.sled.grip * sim.mood.grip * c.surface(s.x, s.z).grip;
    const velRate = phiRate + 5 * gain * (psi - (s.velHeading - phi));
    const head = s.velHeading + (velRate + track.bank * yaw) / grip;
    const rate = velRate + 9 * gain * (head - s.heading);
    const tr = Math.min(1.45, 2.5 / (1 + s.speed / 16)) * sim.sled.turn;
    const steer = (rate - track.damp * Math.max(-1, Math.min(1, phi - s.heading)) + yaw) / tr;
    return Math.max(0, Math.min(8, Math.round(4 + steer * 4)));
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
    // (The floor line rides the floor's middle and nothing else: the lab's bar compares it with the glaze line.)
    if (skill === 'line' || kit.floor) return null;
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
      case 'peal': {
        // (Round 9, the Old Run.) Under the next bend bell, from a second and a half out.
        if (!skilled) return null;
        const t = p.targets.find((q: AnySim) => q.z > s.z + 1);
        if (!t || t.z - s.z > Math.max(45, s.speed * 1.6)) return null;
        // (Held at the bell's own height on its wall: its offset square to the channel, wherever the channel runs.)
        const d = across(t.z, t.x);
        return { x: (z: number) => c.centerX(z) + d * Math.sqrt(1 + c.channelSlope(z) ** 2), noDrift: true };
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
    let target = lineAt;
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
    // (Not on the Old Run's track: a drift there is a skid across a wall, not a turn.)
    const mayDrift = (!act || !act.noDrift) && !track;
    if (mayDrift && !ramp && P.drift === 0 && Math.abs(bend) > 4.5 && room > 6 && Math.abs(s.x - c.safeX(s.z)) < 0.8 && rnd() < 0.02) P.drift = T + 0.3 + rnd() * 0.25;
    if (P.drift > T && (room < 4 || Math.abs(s.x - c.safeX(s.z)) > 0.8 || !mayDrift)) P.drift = T;
    if (P.drift > T) return { steer: bend > 0 ? 8 : 0, action: true };
    if (P.drift > 0 && P.drift <= T) P.drift = -(T + 3);
    if (P.drift < 0 && T > -P.drift) P.drift = 0;
    // (On the Old Run's track, a height held on the wall: the mid pilot's hands a little slower and its line a little
    // loose, the expert's exact.)
    const wob = skill === 'mid' ? 0.35 * Math.sin(T * 0.9 + P.wob) : 0;
    let lvl = track && !ramp && !round ? holdTo(s, (z) => target(z) + wob, skill === 'expert' ? 1 : 0.8) : steerTo(s, target, 14, ramp || aim || round ? 0 : 0.08);
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
  const SPEED = new Set(['race', 'surge', 'carry', 'collapse', 'split']);
  /** What the set pieces ask of the lantern now: 'go' (dash), 'hold' (do not), 'save' (keep one), or nothing. */
  const knows = (): 'go' | 'hold' | 'save' | '' => {
    const s = sim.s;
    const p = pieceNow(sim);
    if (p) {
      const ticks = sim.tick - sim.mo.t0;
      if (p.verb === 'race') return ticks < 50 ? 'go' : '';
      if (p.verb === 'carry') return ticks < 50 ? 'go' : '';
      // (Round 9: into the Labyrinth's split as it starts, as into a race.)
      if (p.verb === 'split') return ticks < 50 ? 'go' : '';
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

/** No obstacle within 2.5 m of the safe line between z0 and z1 (a pop's flight and its landing). */
function clearAhead(sim: AnySim, z0: number, z1: number): boolean {
  const c = sim.course;
  for (let k = Math.floor(z0 / CHUNK_LEN); k <= Math.floor(z1 / CHUNK_LEN); k++) {
    for (const o of c.chunk(k).obstacles) {
      if (o.z < z0 || o.z > z1 || o.soft) continue;
      if (Math.abs(o.x - c.safeX(o.z)) - o.r < 2.5) return false;
    }
  }
  return true;
}

/** Round 8: what each air plan of the trickster is. */
type AirKind = 'grab' | 'reach' | 'stretch' | 'paper' | 'cross' | 'flip' | 'crane' | 'ember' | 'knot' | 'sig' | 'lamp';

/** Set pieces whose air the classic pilots know how to ride (a flourish's trick, bells, stomped steps, a surge's
 *  landing, the flame): over these and on their doorstep the trickster leaves the air to them. */
const PIECE_AIR = new Set(['flourish', 'shatter', 'steps', 'surge', 'carry', 'rings', 'slide', 'gates', 'kindle', 'follow']);

/**
 * Round 8 (G1, G2): the mid and expert pilots with the air map in their hands and a charm in mind. On the snow and
 * over the set pieces they are the classic pilots; in the air elsewhere they pick the trick a flight has room for,
 * one new to the run first and then one new to the combo (a person who knows the map and is trying it all), and the
 * expert chains pops to keep a combo alive. At a charm gate the mid pilot rides for a lane at random, the expert for
 * the family it likes best (speed). kit.lane, if given, forces the lane (the charm fairness rides).
 */
export function trickster(skill: 'mid' | 'expert', sim: AnySim, seed: number, kit: Kit & { lane?: number } = {}): Pilot {
  const ground = classic(skill, sim, seed, kit);
  const rnd = mulberry(seed * 31 + 7);
  const k = new Keys();
  const sloppy = skill === 'expert' ? 0.25 : 1;
  const used = new Set<AirKind>();
  const seen = new Set<AirKind>();
  let plan: { kind: AirKind; side: number; t: number; phase: number; dir: number; bias: number; T: number } | null = null;
  let wasAir = false;
  let wasRail = false;
  let railOff = -1000;
  let crouch = 0;
  const lanes: number[] = [];
  const charms = sim.charmGates as AnySim[] | undefined;
  /** The lane wanted at gate g (once its offers are dealt). */
  const laneFor = (g: AnySim): number => {
    if (kit.lane !== undefined) return kit.lane;
    if (lanes[g.index] !== undefined) return lanes[g.index];
    let lane = 1;
    if (skill === 'mid') lane = Math.floor(rnd() * 3);
    else {
      let best = -1;
      for (let l = 0; l < 3; l++) {
        const id = g.offers[l];
        if (id < 0) continue;
        const fam = id < 8 ? 3 : id < 16 ? 2 : 1;
        const score = fam + rnd();
        if (score > best) {
          best = score;
          lane = l;
        }
      }
    }
    lanes[g.index] = lane;
    return lane;
  };
  const pilot: Pilot = () => {
    const s = sim.s;
    if (s.crashed) return { steer: 4, action: false };
    if (!sim.combo.active) used.clear();
    if (s.grinding) wasRail = true;
    const piece = pieceNow(sim);
    const ahead = pieceAhead(sim);
    if (s.grounded || s.tumble > 0) {
      wasAir = false;
      plan = null;
      if (!s.grinding) wasRail = false;
      let g = ground();
      // A charm gate ahead: ride for the lane wanted (round 8).
      const gate = charms ? charms.find((q) => q.lane < 0 && q.z - s.z < 110 && q.z - s.z > -2) : undefined;
      if (gate && s.tumble === 0) {
        const lane = laneFor(gate);
        if (lane !== 1) {
          const c = sim.course;
          const look = s.z + 12 + s.speed * 0.3;
          const target = gate.x + (lane - 1) * 4.2 + (c.safeX(look) - c.safeX(gate.z));
          const off = target - s.x - s.vx * 0.35;
          g = { steer: k.sample(Math.max(-1, Math.min(1, off * 0.6))), action: false };
        }
      }
      // The expert keeps a combo alive with pops down a straight, line underfoot (none into a set piece).
      if (skill === 'expert' && s.grounded && s.tumble === 0 && !s.grinding && !piece && !(ahead && ahead.z0 - s.z < 400)) {
        const c = sim.course;
        const straight = Math.abs(c.safeX(s.z + 30) - c.safeX(s.z)) < 2 && Math.abs(s.x - c.safeX(s.z)) < 1.5 && clearAhead(sim, s.z, s.z + 12 + s.speed * 1.4);
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
    // Over a set piece's air, or coming down on one's doorstep, the classic pilot's hands.
    if ((piece && PIECE_AIR.has(piece.verb)) || (ahead && ahead.z0 - s.z < 400)) {
      plan = null;
      wasAir = true;
      return ground();
    }
    const land = timeToLand(sim);
    if (!wasAir) {
      wasAir = true;
      if (wasRail) railOff = sim.tick;
      wasRail = false;
      const T = land.t;
      let menu: AirKind[] = [];
      if (sim.tick - railOff < 3) menu = ['lamp'];
      else if (T >= 2.2) menu = ['knot', 'cross', 'crane', 'stretch', 'paper', 'ember', 'sig', 'reach'];
      else if (T >= 1.5) menu = ['cross', 'paper', 'reach', 'ember', 'flip', 'sig', 'grab'];
      else if (T >= 0.9) menu = ['paper', 'grab', 'flip', 'sig'];
      else if (T >= 0.6) menu = ['grab'];
      const unseen = menu.filter((m) => !seen.has(m) && !used.has(m));
      const fresh = menu.filter((m) => !used.has(m));
      const from = unseen.length ? unseen : fresh.length ? fresh : menu;
      const pick = from.length ? from[Math.floor(rnd() * from.length)] : null;
      plan = pick ? { kind: pick, side: rnd() < 0.5 ? 1 : -1, t: 0, phase: 0, dir: rnd() < 0.5 ? 1 : -1, bias: (rnd() - 0.5) * 0.1 * sloppy, T } : null;
      if (plan) {
        used.add(plan.kind);
        seen.add(plan.kind);
      }
    }
    const L = land.t + (plan ? plan.bias : 0);
    // (A nudge inside the air's dead zone toward the line, as the classic pilots do.)
    const off = land.x - sim.course.safeX(land.z);
    let cruise = Math.abs(off) > 0.8 ? (off > 0 ? 3 : 5) : 4;
    // (Once the trick is in, a rider well off the line steers for it outright, as the classic pilots do: the landing
    // set squares the sled, and a landing among the trees ends a combo as surely as a fall.)
    if (plan && plan.phase >= 2 && Math.abs(off) > 1.2 && land.t > 0.3) cruise = off > 0 ? 2 : 6;
    if (!plan) return { steer: cruise, action: L < 0.11 && L > 0.01 };
    const p = plan;
    p.t++;
    const side = (d: number) => (d > 0 ? 8 : 0);
    const yaw = Math.abs(s.airYaw) + (s.spinRate * s.spinRate) / (2 * 22);
    const pitch = Math.abs(s.airPitch) + (s.pitchRate * s.pitchRate) / (2 * 26);
    const stomp = L < 0.11 && L > 0.01;
    // (The expert shoves every grab out late on a flight with room: a Crosswind, a second named trick.)
    const long = skill === 'expert' && p.T >= 1.4;
    const grab = (minTicks: number, spin = 0, tweakAsked = false): Inp => {
      const tweak = tweakAsked || long;
      if (p.phase === 0) {
        p.phase = 1;
        return { steer: side(p.side), action: true };
      }
      if (p.phase === 1) {
        let steer = cruise;
        if (spin && yaw < spin * Math.PI - 0.12) steer = side(p.side);
        if (tweak && L < 0.5 && L > 0.16) steer = side(-p.side);
        if ((L > 0.12 || s.grabTicks < minTicks - 2) && L > 0.02) return { steer, action: true };
        p.phase = 2;
      }
      return { steer: cruise, action: false };
    };
    if (p.kind === 'grab') return grab(15);
    if (p.kind === 'reach') return grab(40);
    if (p.kind === 'stretch') return grab(75);
    if (p.kind === 'paper') return grab(15, 2);
    if (p.kind === 'cross') return grab(15, 0, true);
    if (p.kind === 'lamp') {
      if (p.t < 6) return { steer: side(p.dir), action: true };
      return { steer: cruise, action: stomp };
    }
    if (p.kind === 'flip' || p.kind === 'ember') {
      if (p.phase === 0) {
        if (p.t < 2) return { steer: 4, action: false };
        if (pitch < 2 * Math.PI - 0.2 && L > 0.45) return { steer: p.kind === 'ember' && p.t > 9 && yaw < 2 * Math.PI - 0.12 ? side(p.dir) : 4, action: true };
        p.phase = 1;
      }
      let steer = cruise;
      if (p.kind === 'ember' && yaw < 2 * Math.PI - 0.12 && L > 0.25) steer = side(p.dir);
      return { steer, action: stomp };
    }
    if (p.kind === 'crane' || p.kind === 'knot') {
      if (p.phase === 0) {
        if (p.t < 2) return { steer: 4, action: false };
        if (Math.abs(s.airPitch) < Math.PI + 0.6 && L > 0.6) return { steer: p.kind === 'knot' && p.t > 9 ? side(p.side) : 4, action: true };
        p.phase = 1;
        p.t = 0;
        return { steer: cruise, action: false };
      }
      if (p.phase === 1) {
        if (p.t < 3) return { steer: p.kind === 'knot' ? side(p.side) : cruise, action: false };
        plan = { ...p, kind: p.kind === 'knot' ? 'paper' : 'grab', phase: 1 };
        return { steer: side(p.side), action: L > 0.4 };
      }
      return { steer: cruise, action: false };
    }
    // The sled's own move: two quick taps, steer centred, then hold; let go before the landing and stomp it.
    if (p.t <= 3) return { steer: 4, action: true };
    if (p.t <= 6) return { steer: 4, action: false };
    if (L > 0.3) return { steer: 4, action: true };
    return { steer: cruise, action: stomp };
  };
  pilot.after = ground.after;
  return pilot;
}

/**
 * A first-timer who follows the hints (round 8): the same hands as the clumsy pilot or the novice, reacting to what
 * the screen shows a first run. The stomp cue (hints.ts: under 1.2 s to touchdown on a real flight, until three
 * perfects are learned) shows the landing ring closing in, and it flashes gold inside the stomp window (the last
 * nine ticks, sim.ts): the rider aims a tap at the flash, a few ticks early or late (the novice's spread four ticks,
 * the clumsy pilot's six) and lets a cue go by now and then (one in seven, one in three). The lantern's prompt (a
 * lantern lit, on the snow, out of a drift, until two dashes are learned) is taken after a slow reaction (0.5 to 0.9
 * s, 0.8 to 1.5 s) most times it shows. Otherwise the pilot is its blind self: it rides, steers and mashes as before.
 * The first-minute bar is judged on these; the blind ones stay in the table as a floor.
 */
export function prompted(base: Pilot, baseSpend: () => boolean, sim: AnySim, seed: number, hands: 'clumsy' | 'novice'): { pilot: Pilot; spend: () => boolean } {
  const rnd = mulberry(seed * 31 + 0x9e1);
  const spread = hands === 'clumsy' ? 6 : 4;
  const missCue = hands === 'clumsy' ? 0.33 : 0.15;
  const react = hands === 'clumsy' ? [0.8, 1.5] : [0.5, 0.9];
  let air = 0;
  let cue: { at: number } | null = null;
  let cueDone = false;
  let pressFor = 0;
  let wasAction = false;
  let dashAt = -1;
  let dashFor = 0;
  let nextDashLook = 0;
  const pilot: Pilot = () => {
    const s = sim.s;
    const o = base();
    if (s.grounded || s.tumble > 0) {
      air = 0;
      cue = null;
      cueDone = false;
    } else air++;
    if (!s.grounded && s.tumble === 0 && !cueDone && (sim.stats.perfects ?? 0) < 3) {
      const ttl = timeToLand(sim).t;
      const real = air > 6 || ttl >= 0.3;
      if (!cue && real && ttl < 1.2) {
        cue = rnd() < missCue ? null : { at: (4 + (rnd() * 2 - 1) * spread) / 60 };
        if (!cue) cueDone = true;
      }
      if (cue && ttl <= Math.max(0, cue.at)) {
        cue = null;
        cueDone = true;
        pressFor = 3;
      }
    }
    let action = o.action;
    if (pressFor > 0) {
      // A fresh tap: let go first if the hand was already down, then press.
      action = !(wasAction && pressFor === 3);
      pressFor--;
    }
    wasAction = action;
    return { steer: o.steer, action };
  };
  const spend = (): boolean => {
    const s = sim.s;
    const T = sim.tick / 60;
    const own = baseSpend();
    if (dashFor > 0) {
      dashFor--;
      return true;
    }
    const lit = Math.floor((s.lantern ?? 0) / 100) >= 1;
    const shows = lit && s.grounded && !s.drifting && (sim.stats.dashes ?? 0) < 2 && s.dash === 0 && s.tumble === 0;
    if (!shows) {
      dashAt = -1;
      return own;
    }
    if (dashAt < 0 && T >= nextDashLook) {
      if (rnd() < 0.85) dashAt = T + react[0] + rnd() * (react[1] - react[0]);
      else nextDashLook = T + 5;
    }
    if (dashAt >= 0 && T >= dashAt) {
      dashAt = -1;
      dashFor = 2;
      return true;
    }
    return own;
  };
  return { pilot, spend };
}
