import { Color, Object3D, type PerspectiveCamera, Vector3 } from 'three';
import type { Beat } from '../game/beats';
import type { GhostPose } from '../game/ghosts';
import type { MarqueeLight } from '../game/marquee';
import type { Snap } from '../game/run';
import type { Course } from '../sim/course';
import type { Sim, SimEvent } from '../sim/sim';
import { FW_PAIRS, Fireworks, type ShellKind } from './fireworks';
import type { Particles } from './particles';
import { SkyGates } from './skygates';
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

/** Seconds a shell climbs before it bursts. */
const RISE = 0.9;

export class SpiritFx {
  readonly root = new Object3D();
  readonly gates: SkyGates;
  readonly ward: WardFx;
  readonly fireworks: Fireworks;
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
    this.root.add(this.gates.mesh, this.ward.mesh, this.fireworks.mesh);
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
      }
    }
  }

  /** Queues a show: over the square (`sky`, placed from the lens) or over the street ahead of the rider. */
  private schedule(sky: boolean): void {
    const list = sky ? WIN_SHOW : STREET_SHOW;
    const base = this.showT;
    const kinds: readonly ShellKind[] = sky ? ['peony', 'chrysanthemum', 'crackle', 'ring', 'willow', 'peony', 'crackle', 'chrysanthemum'] : ['crackle', 'peony', 'ring', 'chrysanthemum', 'willow', 'crackle'];
    list.forEach(([t, a, b, c], i) => this.show.push({ at: base + Math.max(0, t - RISE), sky, a, b, c, pair: i % FW_PAIRS.length, kind: kinds[i % kinds.length] }));
    this.show.sort((x, y) => x.at - y.at);
  }

  setCourse(c: Course): void {
    this.course = c;
    this.gates.setGates(c.skyGates);
  }

  /** A new run: every gate hangs again, and nothing from the last run is still in the air. */
  reset(): void {
    this.air = null;
    this.show.length = 0;
    this.gates.reset();
    this.ward.stop();
    this.fireworks.clear();
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
        }
        break;
      }
      case 'dash':
        if (e.phase === 'start') this.particles.sparkle(pos, WHITE_GOLD, 26, 3.2, 0.5, 0.22, carrier, 0.25);
        break;
      case 'ward':
        // The lantern cracks open round the rider: its shell, shards and ring (wardfx.ts), with the
        // light it breaks into and a puff of white where the hit was.
        this.ward.start(this.w.set(s.x, s.y, -s.z), this.carry.set(s.vx, s.vy, -s.vz), this.reduced);
        this.particles.sparkle(pos, LIGHT, 30, 4, 0.6, 0.24, this.carry.set(s.vx, 0, -s.vz), 0.4);
        this.particles.burst(pos, 0.9, 16, this.carry, WHITE_GOLD);
        break;
      case 'lantern':
        this.particles.sparkle(this.v.set(s.x, s.y + 1.2, -s.z), LIGHT, 10, 1.4, 0.45, 0.18, carrier, 0.6);
        break;
    }
  }

  /** Per frame: the gates shimmer, a dash trails light behind the rider, the ward's lantern plays out,
   *  fireworks climb and burst, and a dashing ghost trails its own light. */
  update(dt: number, mode: 'run' | 'title' | 'results', s: Snap, sim: Sim | null, poses: ReadonlyMap<number, GhostPose | null>, low: boolean): void {
    this.at.set(s.x, s.y, -s.z);
    this.vel.set(s.vx, s.vy, -s.vz);
    this.gates.update(dt);
    this.ward.update(dt, this.at, this.vel);
    this.trailAcc += dt;
    if (mode === 'run' && sim && sim.s.dash > 0 && this.trailAcc > (low ? 0.07 : 0.035)) {
      this.trailAcc = 0;
      this.particles.sparkle(this.v.set(s.x, s.y + 0.5, -s.z + 0.8), WHITE_GOLD, low ? 2 : 3, 0.9, 0.55, 0.2, this.carry.set(s.vx * 0.6, 0, -s.vz * 0.6), 0.15);
    }
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
