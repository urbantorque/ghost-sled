import { Color, Object3D, type PerspectiveCamera, Vector3 } from 'three';
import type { Beat } from '../game/beats';
import type { GhostPose } from '../game/ghosts';
import type { MarqueeLight } from '../game/marquee';
import type { Snap } from '../game/run';
import { CHUNK_LEN, type Course, type Obstacle } from '../sim/course';
import type { Sim, SimEvent } from '../sim/sim';
import { fallZ } from '../sim/moments';
import { Breaks } from './breaks';
import { FW_PAIRS, Fireworks, type ShellKind } from './fireworks';
import type { Particles } from './particles';
import { fx } from './fxhub';
import { pushLocalLight } from './lights';
import { SkyGates } from './skygates';
import { TreeLife } from './treelife';
import { WardFx } from './wardfx';

// The lantern in the world (round 5, felt in round 6): the sky gates hung over their kickers as rings of
// light (skygates.ts), the trail a dash leaves, the lantern a ward cracks open round the rider (wardfx.ts),
// and the same for ghosts, read off their records (GhostPose.dashing, .warded), so a ghost that surged shows
// why; fireworks over the square for a win and over the street for a won gates set piece (fireworks.ts).
// Everything reads public sim state, events and beats; nothing is written back. Colours: the lantern is
// marigold (ART.md section 1, the course's fuel); a dash burns toward white-gold; a ghost's dash keeps its
// spectral mint, a step paler.

const LIGHT = new Color('#FFD34D');
const WHITE_GOLD = new Color('#FFF3C4');
const GHOST_DASH = new Color('#D9FFF8');
/** Round 8: what a hazard turns to as a dashing rider goes through or past it, pale spirit glass (a white-gold
 *  breath, never the hazard's own colour, never mint: that is the ghosts'). */
const PHASED = new Color('#FFF6DC');
/** A set piece's air: embers off Ember's caldera, petals over Sakura, lantern light down a festival street. */
const EMBER = new Color('#FF9A4A');
const PETAL = new Color('#FFC9DA');
const LANTERN_GLOW = new Color('#FFE29A');

/** A win over the square: when each shell bursts (seconds after the line), where in the frame (NDC), how far. */
const WIN_SHOW: readonly (readonly [number, number, number, number])[] = [
  [0.35, 0.0, 0.7, 120],
  [0.7, -0.62, 0.58, 104],
  [0.95, 0.64, 0.66, 112],
  [1.5, -0.25, 0.86, 130],
  [1.85, 0.34, 0.8, 118],
  [2.4, -0.7, 0.72, 100],
  [2.7, 0.72, 0.6, 106],
  [3.3, 0.08, 0.9, 126],
];
/** A won gates set piece: shells over the street ahead of the rider, placed as the win's are (when each
 *  bursts, where in the frame, how far), lower in the frame and further down the street the lens looks along:
 *  a sled at 30 m/s closes 40 m in a shell's climb and its burst, so a nearer one is over the lens by then.
 *  Kept near the middle of the frame, where the speed streaks smear least. */
const STREET_SHOW: readonly (readonly [number, number, number, number])[] = [
  [0.95, -0.24, 0.3, 96],
  [1.25, 0.28, 0.36, 104],
  [1.6, 0.0, 0.42, 112],
  [2.0, -0.3, 0.34, 100],
  [2.35, 0.32, 0.28, 94],
  [2.8, -0.06, 0.44, 118],
];

interface Scheduled {
  at: number;
  /** Over the square (a win) or the street (a won gates set piece). */
  sky: boolean;
  a: number;
  b: number;
  c: number;
  pair: number;
  kind: ShellKind;
}

/** A win's finale (round 7), after the show: a volley across the whole sky in a second and a half, low
 *  willows under high peonies, then one great ring and a crackling heart dead centre as the last word. */
const FINALE: readonly (readonly [number, number, number, number, ShellKind])[] = [
  [4.3, -0.78, 0.5, 112, 'willow'],
  [4.45, 0.76, 0.52, 112, 'willow'],
  [4.6, -0.42, 0.74, 126, 'peony'],
  [4.75, 0.44, 0.76, 126, 'peony'],
  [4.9, 0.0, 0.6, 104, 'chrysanthemum'],
  [5.1, -0.6, 0.86, 134, 'crackle'],
  [5.25, 0.6, 0.88, 134, 'crackle'],
  [5.5, -0.2, 0.66, 110, 'willow'],
  [5.6, 0.2, 0.66, 110, 'willow'],
  [6.3, 0.0, 0.84, 122, 'ring'],
  [6.45, 0.0, 0.84, 124, 'crackle'],
];

interface Pulse {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  radius: number;
  power: number;
  life: number;
  max: number;
  ride: boolean;
}

/** Seconds a shell climbs before it bursts. */
const RISE = 0.9;
/** A light that rides with the rider (a dash, a ward, a lantern's moment): metres ahead of it down the run, and
 *  its strength against what it was pushed at. */
const RIDE_AHEAD = 3;
const RIDE_K = 0.65;

export class SpiritFx {
  readonly root = new Object3D();
  readonly gates: SkyGates;
  readonly ward: WardFx;
  readonly fireworks: Fireworks;
  /** The forest's life: trees shaken by the riders that pass them, and what falls (treelife.ts). */
  readonly trees: TreeLife;
  /** What breaks: snowmen, barriers, ice, cornices, icicles (breaks.ts). */
  readonly breaks: Breaks;
  private fallAcc = 0;
  /** Spirit moments that light the snow and the rider for a beat (pooled; lights.ts). */
  private readonly pulses: Pulse[] = Array.from({ length: 8 }, () => ({ x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, radius: 1, power: 0, life: 0, max: 1, ride: false }));
  private pulseNext = 0;
  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly carry = new Vector3();
  private readonly dir = new Vector3();
  private trailAcc = 0;
  private ghostAcc = 0;
  private air: MarqueeLight = null;
  private airAcc = 0;
  private show: Scheduled[] = [];
  private showT = 0;
  private flashOut = 0;
  private reduced = false;
  private course: Course | null = null;
  /** The rider as last drawn (three.js space) and its velocity, for beats that arrive without a snapshot. */
  private readonly at = new Vector3();
  private readonly vel = new Vector3();

  constructor(
    private readonly particles: Particles,
    private readonly cam: PerspectiveCamera | null = null,
  ) {
    this.gates = new SkyGates();
    this.ward = new WardFx();
    this.fireworks = new Fireworks();
    this.trees = new TreeLife(particles);
    this.breaks = new Breaks(particles);
    this.root.add(this.gates.mesh, this.ward.mesh, this.fireworks.mesh, this.breaks.mesh);
  }

  /** A light beat's flash for the post pass (taken once): a burst of morning light out of a tube. */
  takeFlash(): number {
    const f = this.flashOut;
    this.flashOut = 0;
    return f;
  }

  /** The viewport in device pixels: the gates' pixel floor and the fireworks' streak widths. */
  setViewport(wPx: number, hPx: number): void {
    this.gates.setViewport(hPx);
    this.fireworks.setViewport(hPx, wPx / Math.max(1, hPx));
  }

  /** The tier: Low has no bloom, so the gates' halo and the fireworks' own halo carry the glow there. */
  setQuality(budget: number, bloom: boolean): void {
    this.gates.setBloom(bloom);
    this.fireworks.setQuality(budget, bloom);
  }

  setReduced(on: boolean): void {
    this.reduced = on;
    // (Every effect of the lane reads the frame's reduced-motion state here: fxhub.ts.)
    fx.reduced = on;
    this.fireworks.setReduced(on);
  }

  /** The director's beats: a set piece's air comes and goes with it, a win lights the square, and a won
   *  gates set piece lights the street ahead. */
  beats(list: readonly Beat[]): void {
    for (const b of list) {
      if (b.type === 'marquee') {
        this.air = b.phase === 'enter' ? b.light : null;
        if (b.phase === 'exit' && b.light === 'dawn') this.flashOut = 0.45;
      } else if (b.type === 'finish' && b.rank === 1) {
        this.schedule(true);
      } else if (b.type === 'moment' && b.verb === 'gates' && b.phase === 'won') {
        this.schedule(false);
      } else if (b.type === 'moment' && b.verb === 'gates' && b.phase === 'step') {
        // A lantern gate threaded: its lanterns slip their strings (marqueeworld.ts) in a burst of their
        // own glow round the rider, rising, and their light washes over the snow as it goes by.
        this.particles.sparkle(this.v.copy(this.at).setY(this.at.y + 2.2), LANTERN_GLOW, 22, 3.4, 0.9, 0.24, this.carry.copy(this.vel).setY(0), 0.9);
        this.pulse(this.at.x, this.at.y + 1.5, this.at.z, LANTERN_GLOW, 14, 1.9, 0.6, true);
      } else if (b.type === 'nearMiss' && (b.obs === 'pine' || b.obs === 'blossom' || b.obs === 'charpine')) {
        this.trees.nearMiss(b.x, b.z, b.grade === 'whisker');
      } else if (b.type === 'nearMiss' && (b.obs === 'spire' || b.obs === 'serac' || b.obs === 'iceblock') && this.course) {
        // Ice shaved by a runner throws shards, away from the rider's line.
        this.breaks.shatter('ice', b.x, this.course.ground(b.x, b.z), -b.z, this.carry.copy(this.vel).setY(0), b.grade === 'whisker' ? 1 : 0.6, b.side);
      }
    }
  }

  /** Queues a show: over the square (`sky`, placed from the lens) or over the street ahead of the rider. */
  private schedule(sky: boolean): void {
    const list = sky ? WIN_SHOW : STREET_SHOW;
    const base = this.showT;
    const kinds: readonly ShellKind[] = sky ? ['peony', 'chrysanthemum', 'crackle', 'ring', 'willow', 'peony', 'crackle', 'chrysanthemum'] : ['crackle', 'peony', 'ring', 'chrysanthemum', 'willow', 'crackle'];
    list.forEach(([t, a, b, c], i) => this.show.push({ at: base + Math.max(0, t - RISE), sky, a, b, c, pair: i % FW_PAIRS.length, kind: kinds[i % kinds.length] }));
    // A win ends on its finale (Low sends up every other shell of it, the last two always).
    if (sky) FINALE.forEach(([t, a, b, c, kind], i) => {
      if (fx.tier === 0 && i % 2 === 1 && i < FINALE.length - 2) return;
      this.show.push({ at: base + t - RISE, sky, a, b, c, pair: (i + 1) % FW_PAIRS.length, kind });
    });
    this.show.sort((x, y) => x.at - y.at);
  }

  /** How much the world cools while a dash burns (post.ts uCool), from the rider's eased spirit shimmer (world.ts
   *  dashK): it comes in with the dash's ignition and lets go with it. Low draws no post pass and has none: its
   *  dash is the rider's rim, bands and light. */
  coolK(dashK: number): number {
    const k = Math.max(0, Math.min(1, dashK));
    return k * k * (3 - 2 * k);
  }

  /** Round 8 (the events lane): hazards a dash goes through or past this dash, so each ghosts once. */
  private readonly phased = new Set<number>();
  private dashWas = false;

  /** A hazard turns to spirit as the dashing rider goes through it (`through`) or past it: a column of pale glass
   *  motes over its footprint up its height, drifting up and apart, and a breath of light at its foot. The hazard
   *  itself stands (the sim's collider never moves); the motes say the rider went through it as a spirit. */
  private ghostHazard(o: Obstacle, through: boolean, low: boolean): void {
    const c = this.course;
    if (!c) return;
    const gy = c.ground(o.x, o.z);
    const h = Math.max(0.8, Math.min(9, o.h * (o.scale || 1)));
    const r = Math.max(0.35, Math.min(2.2, o.r));
    const n = Math.round((through ? 26 : 12) * (low ? 0.5 : 1) * Math.min(1.6, 0.6 + h / 5));
    const keep = this.carry.set(this.vel.x * 0.15, 0, this.vel.z * 0.15);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = gy + Math.pow(Math.random(), 0.8) * h;
      // Narrower up a tree's cone, round a rock's shoulders.
      const rr = r * (o.kind === 'pine' || o.kind === 'charpine' || o.kind === 'spire' ? 1.1 - 0.75 * ((y - gy) / h) : 1);
      this.particles.sparkle(this.w.set(o.x + Math.cos(a) * rr, y, -o.z + Math.sin(a) * rr), i % 3 === 0 ? WHITE_GOLD : PHASED, 1, 0.9, through ? 0.75 : 0.55, through ? 0.2 : 0.16, keep, 0.9);
    }
    if (through) {
      this.particles.ring(this.w.set(o.x, gy + 0.1, -o.z), PHASED, low ? 8 : 16, 3.2, keep, 3, 1.2, 0.45, 0.16);
      this.pulse(o.x, gy + 1.2, -o.z, WHITE_GOLD, 7, 0.9, 0.35);
    }
  }

  /** While a dash burns: every hazard the rider draws level with inside 4 m ghosts once, the one it rides through
   *  (the sim's 'phase') fully. */
  private dashPass(s: Snap, dashing: boolean, low: boolean): void {
    if (!dashing) {
      if (this.dashWas) this.phased.clear();
      this.dashWas = false;
      return;
    }
    this.dashWas = true;
    const c = this.course;
    if (!c) return;
    const k0 = Math.max(0, Math.floor(s.z / CHUNK_LEN));
    for (let k = k0; k <= k0 + 1; k++) {
      for (const o of c.chunk(k).obstacles) {
        if (this.phased.has(o.id) || o.soft) continue;
        const dz = o.z - s.z;
        if (dz < -1 || dz > 2.5) continue;
        const d = Math.abs(o.x - s.x) - o.r;
        if (d > 4) continue;
        this.phased.add(o.id);
        this.ghostHazard(o, d < 0.7, low);
      }
    }
  }

  /** A beat of light at three.js (x, y, z): `radius` metres, gone in `life` seconds; `ride` keeps it on
   *  the rider. */
  private pulse(x: number, y: number, z: number, c: Color, radius: number, power: number, life: number, ride = false): void {
    const p = this.pulses[this.pulseNext];
    this.pulseNext = (this.pulseNext + 1) % this.pulses.length;
    p.x = x;
    p.y = y;
    p.z = z;
    p.r = c.r;
    p.g = c.g;
    p.b = c.b;
    p.radius = radius;
    p.power = power * (this.reduced ? 0.6 : 1);
    p.max = p.life = life;
    p.ride = ride;
  }

  /** Lights pushed by the spirit effects this frame (tests and the cost report). */
  lit = 0;
  /** How strongly the pulses and a dash light the world and the rider (world.ts, from the grade's flash; 1
   *  by day). A night frame takes less: at full a dash's white-gold light washed the rider to peach. */
  lightK = 1;

  /** Offers the frame's spirit lights: each pulse as it fades, a dash's own light on the rider for as long
   *  as it lasts, and the sky gates ahead (a ring of light lights the snow under it). */
  private light(dt: number, s: Snap, dashing: boolean): void {
    this.lit = 0;
    // Round 7 (the shared lane): a light that rides with the rider stands a few metres ahead of it, down the run,
    // and a step dimmer. On the rider at full strength the dash's and the ward's light washed the rider and the
    // snow round it to one cream sheet that bloomed over it (the review's worst frames in motion); ahead, the snow
    // the rider rides into takes the light, the rider stands against it, and its colour and timing are as they were.
    const sp = Math.hypot(s.vx, s.vz) || 1;
    const ax = s.x + (s.vx / sp) * RIDE_AHEAD;
    const az = -(s.z + (s.vz / sp) * RIDE_AHEAD);
    for (const p of this.pulses) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      const k = p.life / p.max;
      if (p.ride) pushLocalLight(ax, s.y + 0.9, az, p.r, p.g, p.b, p.radius, p.power * k * k * RIDE_K * this.lightK);
      else pushLocalLight(p.x, p.y, p.z, p.r, p.g, p.b, p.radius, p.power * k * k * this.lightK);
      this.lit++;
    }
    if (dashing) {
      pushLocalLight(ax, s.y + 0.8, az, WHITE_GOLD.r, WHITE_GOLD.g, WHITE_GOLD.b, 10, 1.3 * RIDE_K * this.lightK);
      this.lit++;
    }
    const c = this.course;
    if (!c) return;
    for (const g of c.skyGates) {
      const dz = g.z - s.z;
      // (A gate flown is behind the rider a blink later: no need to ask which have burst.)
      if (dz < 2 || dz > 110) continue;
      pushLocalLight(g.x, g.y, -g.z, LIGHT.r, LIGHT.g, LIGHT.b, 4 + g.r * 3, 0.7);
      this.lit++;
    }
  }

  setCourse(c: Course): void {
    this.course = c;
    this.gates.setGates(c.skyGates);
    this.trees.setCourse(c);
    this.breaks.setCourse(c);
    this.gateKey = '';
  }

  /** r7 (moments lane): the rings a run's set pieces hang are its variant's (Sim.skyGates), so a run whose
   *  roll picked the far side or the high line draws those, not the plain day's. */
  private gateKey = '';

  /** A new run: every gate hangs again, and nothing from the last run is still in the air. */
  reset(): void {
    this.air = null;
    this.show.length = 0;
    this.gates.reset();
    this.ward.stop();
    this.fireworks.clear();
    this.trees.reset();
    this.breaks.clear();
  }

  onEvent(e: SimEvent, s: Snap): void {
    const pos = this.v.set(s.x, s.y + 0.6, -s.z);
    const carrier = this.carry.set(s.vx, 0, -s.vz);
    switch (e.type) {
      case 'skyGate': {
        this.gates.fly(e.id);
        const g = this.gates.get(e.id);
        if (g) {
          // Flown through: the ring bursts into white-gold, a ring of motes thrown out round it.
          const at = this.w.set(g.x, g.y, -g.z);
          this.particles.sparkle(at, WHITE_GOLD, 44, 4.8, 0.85, 0.26, carrier, 0.2);
          this.particles.sparkle(at, LIGHT, 20, 7.5, 0.6, 0.22, carrier, 0.1);
          // (Round 7: the burst lights the snow under it and the rider going through it, and a second,
          // slower ring of marigold hangs where the gate was.)
          this.particles.sparkle(at, LIGHT, 16, 2.2, 1.1, 0.3, null, 0.1);
          this.pulse(at.x, at.y, at.z, WHITE_GOLD, 18, 2.4, 0.55);
        }
        break;
      }
      case 'dash':
        if (e.phase === 'start') {
          this.particles.sparkle(pos, WHITE_GOLD, 26, 3.2, 0.5, 0.22, carrier, 0.25);
          // Round 7, the burst: a ring of white-gold thrown out flat over the snow as the air opens, a
          // second in marigold behind it, and a hard beat of light on the snow and the rider.
          this.w.set(s.x, s.y + 0.15, -s.z);
          this.particles.ring(this.w, WHITE_GOLD, 26, 7.5, carrier, 4, 1.6, 0.42, 0.2);
          this.particles.ring(this.w, LIGHT, 14, 4.2, carrier, 0, 1.4, 0.6, 0.18);
          this.pulse(s.x, s.y + 0.9, -s.z, WHITE_GOLD, 16, 2.6, 0.4, true);
        } else {
          // ...and as the sled is solid again, the light lets go: a last soft ring, falling behind.
          this.w.set(s.x, s.y + 0.15, -s.z);
          this.particles.ring(this.w, LIGHT, 12, 3, carrier, 3, 1.3, 0.5, 0.17);
        }
        break;
      case 'light':
        // A light taken lights the snow where it hung for a blink (a great light a wider one).
        this.pulse(e.x, e.y + 0.4, -e.z, LIGHT, e.value > 1 ? 9 : 5.5, e.value > 1 ? 1.5 : 0.9, 0.28, true);
        break;
      case 'ward':
        // The lantern cracks open round the rider: its shell, shards and ring (wardfx.ts), with the
        // light it breaks into and a puff of white where the hit was.
        this.ward.start(this.w.set(s.x, s.y, -s.z), this.carry.set(s.vx, s.vy, -s.vz), this.reduced);
        this.particles.sparkle(pos, LIGHT, 30, 4, 0.6, 0.24, this.carry.set(s.vx, 0, -s.vz), 0.4);
        this.particles.burst(pos, 0.9, 16, this.carry, WHITE_GOLD);
        // (Round 7: the crack is a flash of the lantern's light on everything round the rider.)
        this.pulse(s.x, s.y + 0.9, -s.z, LIGHT, 15, 2.8, 0.7, true);
        break;
      case 'lantern':
        this.particles.sparkle(this.v.set(s.x, s.y + 1.2, -s.z), LIGHT, 10, 1.4, 0.45, 0.18, carrier, 0.6);
        // A lantern fills: its light swells on the rider and the snow for half a second.
        this.pulse(s.x, s.y + 0.9, -s.z, LIGHT, 9, 1.3, 0.55, true);
        break;
      case 'smash':
        // A snowman bursts: lumps of snow, its carrot, its coals and its scarf, riding on with the sled.
        this.breaks.shatter('snowman', e.x, e.y, -e.z, carrier, 1);
        break;
      case 'scrape': {
        // Turned back at the edge: a street's or a bridge's barrier splinters, a glacier's wall throws ice,
        // anywhere else the bank's snow breaks off in blocks. Thrown back toward the run, off the rider.
        const kind = this.course ? this.course.section(s.z).kind : 'cruise';
        const built = kind === 'street' || kind === 'bridge' || kind === 'finish';
        const what = built ? 'wood' : this.course && this.course.biome === 'glacier' ? 'ice' : 'snow';
        this.breaks.shatter(what, s.x + e.side * 0.9, s.y, -s.z, carrier, Math.min(1.4, 0.5 + e.speed / 40), -e.side);
        break;
      }
    }
  }

  /** Per frame: the gates shimmer, a dash trails light behind the rider, the ward's lantern plays out,
   *  fireworks climb and burst, and a dashing ghost trails its own light. */
  update(dt: number, mode: 'run' | 'title' | 'results', s: Snap, sim: Sim | null, poses: ReadonlyMap<number, GhostPose | null>, low: boolean): void {
    if (sim && sim.course === this.course) {
      const key = sim.plays.map((p) => p.variant).join('.');
      if (key !== this.gateKey) {
        this.gateKey = key;
        this.gates.setGates(sim.skyGates);
      }
    }
    this.at.set(s.x, s.y, -s.z);
    this.vel.set(s.vx, s.vy, -s.vz);
    this.gates.update(dt);
    this.ward.update(dt, this.at, this.vel);
    this.trees.update(dt, mode, s, poses);
    this.breaks.update(dt, s.z, s.speed, mode === 'run');
    // The collapse set piece's fall (moments.ts fallZ): where the span's edges give way, blocks of its
    // snow break off both sides and tumble into the gap with ice in them, on top of marqueeworld's own.
    if (mode === 'run' && sim && sim.mo.active >= 0) {
      const p = sim.plays[sim.mo.active];
      if (p && p.verb === 'collapse') {
        const c = sim.course;
        const fz = fallZ(p, sim.tick - sim.mo.t0, sim.mo.pace);
        this.fallAcc += dt;
        if (fz > p.z0 - 2 && fz < p.z1 && this.fallAcc > (low ? 0.3 : 0.14)) {
          this.fallAcc = 0;
          const side = Math.random() < 0.5 ? -1 : 1;
          const x = c.centerX(fz) + side * (c.halfWidth(fz) + 0.6);
          this.breaks.shatter(Math.random() < 0.35 ? 'ice' : 'snow', x, c.ground(x, fz) + 0.4, -fz, null, 1.2, side);
        }
      }
    }
    this.trailAcc += dt;
    const dashing = mode === 'run' && !!sim && sim.s.dash > 0;
    this.dashPass(s, dashing, low);
    // Round 8: the spirit streams off the rider's shoulders and hat while it burns, rising as it falls behind.
    if (dashing && !low && this.trailAcc === 0) this.particles.sparkle(this.v.set(s.x + (Math.random() - 0.5) * 0.5, s.y + 1.25, -s.z + 0.3), WHITE_GOLD, 2, 0.7, 0.7, 0.15, this.carry.set(s.vx * 0.82, 0, -s.vz * 0.82), 1.2);
    if (dashing && this.trailAcc > (low ? 0.07 : 0.035)) {
      this.trailAcc = 0;
      this.particles.sparkle(this.v.set(s.x, s.y + 0.5, -s.z + 0.8), WHITE_GOLD, low ? 2 : 3, 0.9, 0.55, 0.2, this.carry.set(s.vx * 0.6, 0, -s.vz * 0.6), 0.15);
      // Round 7, the wake and the tail: two lines of light laid on the snow off the runners, a sled's
      // width apart, that hold for most of a second behind the rider (they keep a third of its pace), and
      // a stream of marigold off the scarf's height that falls back slower, so the dash draws a comet.
      const hs = Math.hypot(s.vx, s.vz) || 1;
      const rx = s.vz / hs;
      const rz = s.vx / hs;
      const wake = this.carry.set(s.vx * 0.34, 0, -s.vz * 0.34);
      for (const side of [-1, 1]) this.particles.line(this.v.set(s.x + rx * side * 0.34, s.y + 0.02, -s.z + rz * side * 0.34), this.w.set(s.x + rx * side * 0.4 - (s.vx / hs) * 0.9, s.y + 0.02, -s.z + rz * side * 0.4 + (s.vz / hs) * 0.9), WHITE_GOLD, low ? 1 : 2, wake, 1.5);
      if (!low) this.particles.sparkle(this.v.set(s.x, s.y + 1.0, -s.z + 0.5), LIGHT, 2, 1.4, 0.9, 0.17, this.carry.set(s.vx * 0.8, 0, -s.vz * 0.8), 0.3);
    }
    this.light(dt, s, dashing);
    // A set piece's air drifts past the lens while it lasts.
    this.airAcc += dt;
    if (mode === 'run' && this.air && this.air !== 'dawn' && this.air !== 'aurora' && this.airAcc > (low ? 0.16 : 0.08)) {
      this.airAcc = 0;
      const c = this.air === 'embers' ? EMBER : this.air === 'petals' ? PETAL : LANTERN_GLOW;
      const ahead = 10 + Math.random() * 18;
      this.particles.sparkle(this.v.set(s.x + (Math.random() - 0.5) * 14, s.y + 1.5 + Math.random() * 4, -s.z - ahead), c, low ? 2 : 4, 0.8, 1.1, 0.22, null, -0.4);
    }
    this.stepShow(dt);
    this.fireworks.update(dt);
    this.ghostAcc += dt;
    if (this.ghostAcc > (low ? 0.12 : 0.06)) {
      this.ghostAcc = 0;
      for (const p of poses.values()) {
        if (!p || p.done || !(p.dashing || p.warded)) continue;
        const dz = p.z - s.z;
        if (dz < -30 || dz > 160) continue;
        this.particles.sparkle(this.v.set(p.x, p.y + 0.6, -p.z + 0.6), p.warded ? LIGHT : GHOST_DASH, p.warded ? 6 : 2, 1, 0.5, 0.22, null, 0.2);
      }
    }
  }

  /** Sends up each queued shell when its time comes: a win's from the snow under the sky the lens is looking
   *  at, a street's from the run's edges ahead of the rider. */
  private stepShow(dt: number): void {
    if (this.show.length === 0) {
      this.showT = 0;
      return;
    }
    this.showT += dt;
    const c = this.course;
    while (this.show.length && this.show[0].at <= this.showT) {
      const sh = this.show.shift()!;
      const [a, b] = FW_PAIRS[sh.pair];
      const to = this.w;
      if (!this.cam || !c) continue;
      // Placed along the lens's own view as it goes up, from where the lens will be as it bursts (it rides
      // with the rider), so the sky over whatever the lens is looking at takes it.
      const cam = this.cam;
      const dir = this.dir.set(sh.a, sh.b, 0.5).unproject(cam).sub(cam.position).normalize();
      to.copy(cam.position).addScaledVector(this.vel, RISE + 0.3).addScaledVector(dir, sh.c);
      to.y = Math.max(to.y, c.ground(to.x, -to.z) + (sh.sky ? 18 : 10));
      const from = this.v.set(to.x + (Math.random() - 0.5) * 6, c.ground(to.x, -to.z) + 1, to.z + (Math.random() - 0.5) * 6);
      this.fireworks.shell(from, to, RISE, a, b, sh.kind);
    }
  }
}
