import { Color, Vector3 } from 'three';
import { BIG_DROP_S } from '../audio/cues';
import { DRIFT_TIER_HEX, type Beat, type BeatOf } from '../game/beats';
import type { Snap } from '../game/run';
import { CHUNK_LEN, type Course } from '../sim/course';
import { TUMBLE_TICKS, type Sim, type SimEvent } from '../sim/sim';
import type { ChaseCamera } from './camera';
import { crowdRoar } from './crowd';
import { runnersOnSnow, shakeCrowns } from './nearfield';
import type { Particles } from './particles';
import type { RiderAct } from './rider';
import { nearBank, type Sloughs } from './sloughs';

// The moments the sim hands the picture: a wipeout's tumble, a scrape off the edge, a rail, a wall
// ride, a big drop's touchdown, a stage line and the finish, and the world answering skill (banks
// shedding snow, crowds rising, the treeline shaking). Everything here reads public sim state and the
// beat list; nothing is ever written back. Colours keep their roles (ART.md section 1): sparks and heat
// are the player's vermillion ramp, the finish is the player's and the gifts' colours on cream, and a
// grudge settled lands in its rose.

export interface MomentView {
  mode: 'run' | 'title' | 'results';
  snap: Snap;
  dt: number;
  time: number;
  sim: Sim | null;
  feel?: { reduced: boolean };
}

/** What moments.ts needs of the world. */
export interface MomentWorld {
  readonly particles: Particles;
  readonly sloughs: Sloughs;
  readonly cam: ChaseCamera;
  readonly course: Course;
}

/** The finish's render-time ease: full speed over the line, down to FINISH_SLOW by a third of a second,
 *  held to 1.1 s, and back to full by 2.2 s (render seconds since the line). */
const FINISH_SLOW = 0.38;
export function finishRate(t: number): number {
  const s = (x: number) => {
    const k = x < 0 ? 0 : x > 1 ? 1 : x;
    return k * k * (3 - 2 * k);
  };
  return t < 1.1 ? 1 + (FINISH_SLOW - 1) * s(t / 0.35) : FINISH_SLOW + (1 - FINISH_SLOW) * s((t - 1.1) / 1.1);
}

/** Seconds the crowds' roar holds after the finish, and how fast a lift dies away (per second). */
const ROAR_HOLD = 6;
const ROAR_DECAY = 0.7;

const SPARK = new Color(DRIFT_TIER_HEX[1]);
const HOT = new Color(DRIFT_TIER_HEX[0]);
const CREAM = new Color('#FFF1D6');
const ROSE = new Color('#FF5A7A');
const VERMILLION = new Color('#FF4D2E');
const MARIGOLD = new Color('#FFD34D');
const PERIWINKLE = new Color('#AEB6EE');
/** The finish's sky: the player's and the gifts' colours on cream, with the snow's own periwinkle for
 *  depth. Warm is safe here: nothing that bursts over the square is a hazard, and no hazard is warm. */
const SHELLS: readonly (readonly [Color, Color])[] = [
  [VERMILLION, CREAM],
  [MARIGOLD, CREAM],
  [PERIWINKLE, CREAM],
  [VERMILLION, MARIGOLD],
];

/** One shell: render seconds past the line it bursts, where in the frame (NDC) and how far off. Placed
 *  from the lens as it goes up, so the sky over whatever the lens is looking at takes it, chase or
 *  swung, and it stays there. */
interface Shell {
  t: number;
  nx: number;
  ny: number;
  d: number;
  a: Color;
  b: Color;
  up: boolean;
  x: number;
  y: number;
  z: number;
}

/** Seconds a shell climbs before it bursts. */
const SHELL_RISE = 0.5;
/** The show: [burst time, ndc x, ndc y, metres off]. */
const SHOW: readonly (readonly [number, number, number, number])[] = [
  [0.55, -0.5, 0.62, 84],
  [0.75, 0.56, 0.74, 96],
  [1.05, 0.06, 0.84, 110],
  [1.75, -0.58, 0.68, 74],
  [2.15, 0.6, 0.6, 80],
  [2.55, -0.08, 0.8, 92],
  [3.05, 0.42, 0.72, 74],
  [3.55, -0.5, 0.56, 84],
  [4.15, 0.18, 0.84, 96],
  [4.85, -0.3, 0.66, 78],
  [5.7, 0.5, 0.72, 90],
];

const HIST = 720;

/** How far ahead of a lip the rider loads for it, in seconds at its speed. */
const LOAD_AHEAD = 0.55;

export class Moments {
  /** The rider's acting this frame (rider.ts). */
  readonly act: RiderAct = { tumble: 0, grind: false, wall: 0, finish: false, finT: 0, rank: 0, load: 0, cue: null, cueN: 0, cueSide: 0 };
  /** True from the finish line until the next run: the lens and the rider belong to the finish. */
  finishing = false;
  private sim: Sim | null = null;
  private roar = 0;
  private roarHold = 0;
  private puffAcc = 0;
  private wallAcc = 0;
  private sparkAcc = 0;
  /** Scheduled finish bursts, by render seconds since the line, and the next to go. */
  private shells: Shell[] = [];
  private shellNext = 0;
  private confettiAcc = 0;
  private finT = 0;
  /** The coast as the sim ran it (x, y, z, vx, vz, heading, speed, t), and the eased clock reading it. */
  private hist = new Float32Array(HIST * 8);
  private histN = 0;
  private real = 0;
  private shown = 0;
  private lag = 0;
  private eased: Snap | null = null;
  private a = new Vector3();
  private b = new Vector3();
  private v = new Vector3();
  private pt = new Vector3();

  constructor(private world: MomentWorld) {}

  /** A new run: nothing carries over. */
  reset(): void {
    this.act.tumble = 0;
    this.act.grind = false;
    this.act.wall = 0;
    this.act.finish = false;
    this.act.finT = 0;
    this.act.rank = 0;
    this.act.load = 0;
    this.act.cue = null;
    this.finishing = false;
    this.roar = this.roarHold = 0;
    crowdRoar.value = 0;
    this.shells.length = 0;
    this.shellNext = 0;
    this.finT = 0;
    this.histN = 0;
    this.real = this.shown = this.lag = 0;
    this.confettiAcc = 0;
  }

  get tumbling(): boolean {
    return this.act.tumble > 0;
  }

  /** The finish eases render time, never the sim: past the line the picture plays the sled's coast back
   *  through a clock that dips to FINISH_SLOW and returns, from the frames the sim has already run. It
   *  ends up on the same spot, later. Rewrites this frame's view (its snapshot, dt and clock) in place. */
  ease(v: MomentView): void {
    const st = v.sim?.s;
    if (!st || !st.finished || v.feel?.reduced) return;
    const s = v.snap;
    const i = this.histN;
    if (i < HIST && (i === 0 || st.speed > 0.01)) {
      const o = i * 8;
      const h = this.hist;
      h[o] = s.x;
      h[o + 1] = s.y;
      h[o + 2] = s.z;
      h[o + 3] = s.vx;
      h[o + 4] = s.vz;
      h[o + 5] = s.heading;
      h[o + 6] = s.speed;
      h[o + 7] = this.real;
      this.histN = i + 1;
    }
    this.real += v.dt;
    const rate = finishRate(this.shown);
    const dt = v.dt * rate;
    this.shown = Math.min(this.real, this.shown + dt);
    this.lag += v.dt - dt;
    // Where the eased clock falls in the coast.
    let k = this.histN - 1;
    const h = this.hist;
    while (k > 0 && h[k * 8 + 7] > this.shown) k--;
    const o = k * 8;
    const n = Math.min(this.histN - 1, k + 1);
    const p = n * 8;
    const span = h[p + 7] - h[o + 7];
    const u = span > 1e-5 ? Math.max(0, Math.min(1, (this.shown - h[o + 7]) / span)) : 0;
    const out = (this.eased ??= { ...s });
    Object.assign(out, s);
    out.x = h[o] + (h[p] - h[o]) * u;
    out.y = h[o + 1] + (h[p + 1] - h[o + 1]) * u;
    out.z = h[o + 2] + (h[p + 2] - h[o + 2]) * u;
    out.vx = h[o + 3] + (h[p + 3] - h[o + 3]) * u;
    out.vz = h[o + 4] + (h[p + 4] - h[o + 4]) * u;
    out.heading = h[o + 5] + (h[p + 5] - h[o + 5]) * u;
    out.speed = h[o + 6] + (h[p + 6] - h[o + 6]) * u;
    v.snap = out;
    v.dt = dt;
    v.time -= this.lag;
  }

  /** A reaction for the rider to play once (rider.ts): `side` is where it happened, +1 on three.js +x. */
  private cue(cue: NonNullable<RiderAct['cue']>, side: number): void {
    const a = this.act;
    a.cue = cue;
    a.cueSide = side;
    a.cueN = (a.cueN ?? 0) + 1;
  }

  /** The frame's beats (run only). */
  beats(list: readonly Beat[], s: Snap): void {
    const w = this.world;
    for (const b of list) {
      switch (b.type) {
        case 'tumble':
          this.tumbleFx(b, s);
          // Back on the sled: a shake of the head and the snow brushed off.
          if (b.phase === 'end') this.cue('dust', 0);
          break;
        case 'passedBy':
          // A ghost going by: a look at it over the shoulder (not at the start-line jostle, nor at a wreck).
          if (!b.muted && !b.wreck) this.cue('look', b.ghost.dx >= 0 ? 1 : -1);
          break;
        case 'scrape': {
          const at = this.at(s);
          const vel = this.carrier(s);
          w.particles.spray(at, s.heading, b.side, vel, 1.8);
          w.particles.burst(this.a.copy(at).setX(at.x + b.side * 0.8), 0.6, 8, vel);
          break;
        }
        case 'grind':
          w.particles.sparkle(this.b.copy(this.at(s)).setY(s.y + 0.1), b.phase === 'start' ? HOT : SPARK, 12, 3.4, 0.3, 0.14, this.carrier(s));
          break;
        case 'stomp':
          this.shed(b.x, b.z, s, 1 + 0.08 * Math.min(4, b.streak - 1));
          break;
        case 'pass':
          if (!b.muted) {
            this.lift(0.6);
            // Going by one: a fist pump; a double, a duel won or a lead taken back: both arms.
            const big = b.word === 'double' || b.word === 'triple' || b.word === 'streak' || b.word === 'duelWon' || b.word === 'tookBack' || b.word === 'slung';
            this.cue(big ? 'cheer' : 'pump', b.ghost.dx >= 0 ? 1 : -1);
          }
          break;
        case 'driftRelease':
          if (b.tier >= 3) this.lift(0.75);
          break;
        case 'flow':
          if (b.phase === 'in') this.lift(0.6);
          break;
        case 'stage':
          if (!b.last) this.stageFx(s);
          break;
        case 'finish':
          this.act.rank = b.rank;
          this.startFinish(s);
          break;
        case 'grudgeSettled':
          this.answer(s, 0, ROSE, 1.2);
          break;
        case 'duel':
          if (b.phase === 'won' || b.phase === 'heldOff') this.answer(s, b.ghost.dx > 0 ? 1 : -1, CREAM, b.phase === 'won' ? 1 : 0.8);
          break;
        default:
          break;
      }
    }
  }

  /** Raw landings: a big drop's touchdown throws a powder wave, and near a bank it sheds one. */
  landed(e: Extract<SimEvent, { type: 'land' }>, s: Snap): void {
    if (e.airtime < BIG_DROP_S) return;
    const k = Math.min(1.5, e.airtime / 2.2 + Math.max(0, e.impact - 8) * 0.04);
    this.world.particles.wave(this.at(s), this.carrier(s), k);
    this.shed(s.x, s.z, s, k);
  }

  /** How loaded the rider is for a lip ahead (0 to 1): holding the action into a kicker on its line
   *  or a leap's brow, it sinks and draws its arms back over the last half-second, and the release at
   *  the lip springs it up. Nothing without the action held. */
  private loadFor(s: Snap): number {
    if (!s.action || !s.grounded || s.speed < 6) return 0;
    const c = this.world.course;
    const ahead = s.speed * LOAD_AHEAD;
    let best = Infinity;
    const ci = Math.max(0, Math.floor(s.z / CHUNK_LEN));
    for (let k = ci; k <= ci + 1; k++) {
      for (const r of c.zones(k).ramps) {
        const d = r.z + r.len - s.z;
        if (d > -0.3 && d < best && Math.abs(s.x - r.x) < r.w * 0.5 + 0.5) best = d;
      }
    }
    for (const l of c.ledges) {
      const d = l.z - s.z;
      if (l.kind === 'leap' && d > -0.3 && d < best) best = d;
    }
    if (best > ahead) return 0;
    const k = Math.max(0, Math.min(1, (ahead - best) / (ahead * 0.6)));
    return k * k * (3 - 2 * k);
  }

  private at(s: Snap): Vector3 {
    return this.a.set(s.x, s.y, -s.z);
  }

  private carrier(s: Snap): Vector3 {
    const g = this.world.course;
    g.gradient(s.x, s.z, this.grad);
    return this.v.set(s.vx, this.grad.x * s.vx + this.grad.z * s.vz, -s.vz);
  }

  private grad = { x: 0, z: 0 };

  /** A slough off the bank near (x, z): started ahead of the sled, where the lens will see it come down
   *  (at 30 m/s it reaches the edge as the rider draws level). */
  private shed(x: number, z: number, s: Snap, k: number): void {
    const near = nearBank(this.world.course, x, z);
    if (!near) return;
    const ahead = Math.max(10, Math.min(34, s.speed * 0.95));
    this.world.sloughs.start(z + ahead, near.side, Math.min(1.2, 0.8 * k));
    if (k > 1) this.world.sloughs.start(z + ahead * 1.5, near.side, 0.8);
  }

  /** The crowd's roar lifts for a moment (a cheer's worth comes through landmarks.ts on its own). */
  private lift(k: number): void {
    this.roar = Math.max(this.roar, k);
  }

  private tumbleFx(b: BeatOf<'tumble'>, s: Snap): void {
    const w = this.world;
    const vel = this.carrier(s);
    const at = this.at(s);
    if (b.phase === 'start') {
      w.particles.burst(at, 2, 34, vel);
      w.particles.wave(at, vel, 1.2, 0.82);
      w.particles.tumblePuff(at, vel, 3);
    } else {
      w.particles.burst(at, 0.9, 18, vel);
      w.particles.ring(this.b.copy(at).setY(at.y + 0.15), CREAM, 12, 3.2, vel, 2, 1.1, 0.34, 0.14);
    }
  }

  private stageFx(s: Snap): void {
    const w = this.world;
    const vel = this.carrier(s);
    const c = w.course;
    const gy = c.ground(s.x, s.z);
    const hw = c.halfWidth(s.z);
    const cx = c.centerX(s.z);
    w.particles.line(this.a.set(cx - hw, gy, -s.z), this.b.set(cx + hw, gy, -s.z), CREAM, 30, vel, 1.2);
    this.lift(0.7);
    shakeCrowns(0.5);
  }

  /** The world answering a rival beaten: powder shaken off the treeline, snow off the banks (side 0:
   *  both), the crowd up, and on any tier a ring in the moment's colour. */
  private answer(s: Snap, side: -1 | 0 | 1, color: Color, k: number): void {
    const w = this.world;
    const vel = this.carrier(s);
    shakeCrowns(k);
    this.lift(Math.min(1, 0.8 * k));
    const ahead = Math.max(12, Math.min(36, s.speed));
    if (side >= 0) w.sloughs.start(s.z + ahead, 1, k);
    if (side <= 0) w.sloughs.start(s.z + ahead * 1.15, -1, k);
    if (side === 0) {
      w.sloughs.start(s.z + ahead * 1.6, 1, 0.8);
      w.sloughs.start(s.z + ahead * 1.75, -1, 0.8);
    }
    w.particles.ring(this.b.copy(this.at(s)).setY(s.y + 0.2), color, Math.round(18 * k), 6, vel, 3, 1.3, 0.5, 0.18);
    w.cam.kick(0.3 * k);
  }

  /** Over the line: the burst from the square, a shell at a time over the next seconds, the first ahead
   *  of the chase lens and the rest round the line behind the rider, where the swung lens looks. */
  private startFinish(s: Snap): void {
    this.finishing = true;
    this.finT = 0;
    this.roarHold = ROAR_HOLD;
    this.roar = 1;
    this.shells.length = 0;
    this.shellNext = 0;
    SHOW.forEach(([t, nx, ny, d], i) => {
      const [a, b] = SHELLS[i % SHELLS.length];
      this.shells.push({ t, nx, ny, d, a, b, up: false, x: 0, y: 0, z: 0 });
    });
    // The cannons at the line: either side of the rider and a little ahead, firing in over it.
    const p = this.world.particles;
    const c = this.world.course;
    const vel = this.carrier(s);
    const z = s.z + Math.max(10, s.speed * 0.55);
    const hw = Math.min(11, c.halfWidth(z));
    for (const side of [-1, 1]) {
      const x = s.x + side * hw;
      p.confetti(this.a.set(x, c.ground(x, z) + 0.6, -z), this.b.set(-side * 7, 12, 0), 60, vel);
    }
  }

  /** Sends a shell up from the snow toward where the frame's sky will show it. */
  private launch(sh: Shell): void {
    const w = this.world;
    const cam = w.cam.camera;
    const p = this.pt.set(sh.nx, sh.ny, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(sh.d).add(cam.position);
    const g = w.course.ground(p.x, -p.z);
    sh.x = p.x;
    sh.y = Math.max(p.y, g + 12);
    sh.z = p.z;
    sh.up = true;
    w.particles.riser(this.a.set(p.x, g + 1, p.z), this.b.set(sh.x, sh.y, sh.z), SHELL_RISE, sh.a);
  }

  /** Per frame (after the rider's update): the acting, the running effects and the finish's sky. */
  update(v: MomentView, dt: number): void {
    const sim = v.sim;
    if (sim !== this.sim) {
      this.sim = sim;
      this.reset();
    }
    const st = sim ? sim.s : null;
    const act = this.act;
    const w = this.world;
    const s = v.snap;
    runnersOnSnow(s.grounded && act.tumble === 0);
    if (!st || v.mode === 'title') {
      act.tumble = 0;
      act.grind = false;
      act.wall = 0;
      act.finish = false;
      act.load = 0;
    } else {
      act.tumble = st.tumble > 0 ? 1 - st.tumble / TUMBLE_TICKS : 0;
      act.grind = st.grinding;
      act.wall = st.wallTicks > 0 && !st.finished ? (s.x > w.course.centerX(s.z) ? 1 : -1) : 0;
      act.finish = st.finished;
      if (st.finished && !this.finishing) this.startFinish(s);
      act.load = v.mode === 'run' && !st.finished && !st.crashed && act.tumble === 0 ? this.loadFor(s) : 0;
    }
    if (v.mode === 'run' && st && !st.crashed) {
      if (act.tumble > 0) {
        // Powder bursts as the roll beats on the snow.
        this.puffAcc += dt;
        if (this.puffAcc > 0.07) {
          this.puffAcc = 0;
          w.particles.tumblePuff(this.at(s).setY(w.course.ground(s.x, s.z)), this.carrier(s), 1 - 0.5 * act.tumble);
        }
      }
      if (act.grind) {
        this.sparkAcc += dt * 60;
        if (this.sparkAcc >= 1) {
          w.particles.railSparks(this.b.set(s.x, s.y + 0.04, -s.z), this.carrier(s), SPARK, HOT, Math.min(2, this.sparkAcc));
          this.sparkAcc = 0;
        }
      }
      if (act.wall !== 0) {
        this.wallAcc += dt * 60;
        if (this.wallAcc >= 1) {
          w.particles.wallSpray(this.at(s), act.wall, this.carrier(s), Math.min(2, this.wallAcc));
          this.wallAcc = 0;
        }
      }
    }
    if (this.finishing) this.stepFinish(s, dt);
    // The celebration keeps real seconds: the eased clock would spend the whole coast before the
    // results on its first half-second (under reduced motion there is no ease, and the two agree).
    act.finT = this.finishing ? Math.max(this.real, this.finT) : 0;
    // The roar: held after the finish, a moment's lift otherwise.
    if (this.roarHold > 0) this.roarHold -= dt;
    else this.roar = Math.max(0, this.roar - dt * ROAR_DECAY);
    crowdRoar.value = this.roar;
  }

  private stepFinish(s: Snap, dt: number): void {
    const p = this.world.particles;
    this.finT += dt;
    for (let i = this.shellNext; i < this.shells.length; i++) {
      const sh = this.shells[i];
      if (!sh.up && sh.t - SHELL_RISE <= this.finT) this.launch(sh);
    }
    while (this.shellNext < this.shells.length && this.shells[this.shellNext].t <= this.finT) {
      const sh = this.shells[this.shellNext++];
      if (sh.up) p.firework(this.a.set(sh.x, sh.y, sh.z), sh.a, sh.b);
    }
    // Ribbons drift down over the rider while it coasts and for a little after.
    if (this.finT < 5.5) {
      this.confettiAcc += dt * 30;
      const n = Math.floor(this.confettiAcc);
      if (n > 0) {
        this.confettiAcc -= n;
        const r = 8;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * r;
          p.confettiFall(this.a.set(s.x + Math.cos(a) * d, s.y + 1.5 + Math.random() * 6, -s.z + Math.sin(a) * d));
        }
      }
    }
  }
}
