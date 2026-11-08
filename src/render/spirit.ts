import { Color, InstancedMesh, Matrix4, Object3D, Quaternion, TorusGeometry, Vector3 } from 'three';
import type { Beat } from '../game/beats';
import type { GhostPose } from '../game/ghosts';
import type { MarqueeLight } from '../game/marquee';
import type { Snap } from '../game/run';
import type { Course, SkyGate } from '../sim/course';
import type { Sim, SimEvent } from '../sim/sim';
import { makeToonMaterial } from './materials';
import type { Particles } from './particles';

// The lantern in the world (round 5): the sky gates hung over their kickers, the trail a dash leaves, the
// light a ward breaks into, and the same for ghosts, read off their records (GhostPose.dashing, .warded), so
// a ghost that surged shows why. Everything reads public sim state and events; nothing is written back.
// Colours: the lantern is marigold (ART.md section 1, the course's fuel); a dash burns toward white; a
// ghost's dash keeps its spectral mint, a step paler.

const LIGHT = new Color('#FFD34D');
const WHITE_GOLD = new Color('#FFF3C4');
const GHOST_DASH = new Color('#D9FFF8');
const MAX_GATES = 4;
/** A set piece's air: embers off Ember's caldera, petals over Sakura, lantern light down a festival street. */
const EMBER = new Color('#FF9A4A');
const PETAL = new Color('#FFC9DA');
const LANTERN_GLOW = new Color('#FFE29A');
/** Fireworks over the square for a win: the rider's own warm colours and the lantern's, never mint. */
const FIREWORK = [new Color('#FF4D2E'), new Color('#FFD34D'), new Color('#FFF3C4'), new Color('#FF8A5C')];

export class SpiritFx {
  readonly root = new Object3D();
  private readonly rings: InstancedMesh;
  private gates: readonly SkyGate[] = [];
  private readonly passed = new Set<number>();
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly v = new Vector3();
  private readonly s = new Vector3();
  private readonly carry = new Vector3();
  private trailAcc = 0;
  private ghostAcc = 0;
  private spin = 0;
  private air: MarqueeLight = null;
  private airAcc = 0;
  private fireworks = 0;
  private fireAcc = 0;
  private fireN = 0;
  private flashOut = 0;

  /** A light beat's flash for the post pass (taken once): a burst of morning light out of a tube. */
  takeFlash(): number {
    const f = this.flashOut;
    this.flashOut = 0;
    return f;
  }

  /** The director's beats: a set piece's air comes and goes with it, and a win lights the square. */
  beats(list: readonly Beat[]): void {
    for (const b of list) {
      if (b.type === 'marquee') {
        this.air = b.phase === 'enter' ? b.light : null;
        if (b.phase === 'exit' && b.light === 'dawn') this.flashOut = 0.45;
      } else if (b.type === 'finish' && b.rank === 1) {
        this.fireworks = 3.4;
        this.fireN = 0;
      }
    }
  }

  constructor(private readonly particles: Particles) {
    // One draw for every gate on the course, on every tier: a sky gate is a line to fly, so Low keeps it.
    const mat = makeToonMaterial({ coolShade: 0.05, emissive: LIGHT, emissiveStrength: 0.85 });
    this.rings = new InstancedMesh(new TorusGeometry(1, 0.06, 6, 40), mat, MAX_GATES);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.root.add(this.rings);
  }

  setCourse(c: Course): void {
    this.gates = c.skyGates.slice(0, MAX_GATES);
    this.passed.clear();
    this.layout(0);
  }

  /** A new run on the same course: every gate hangs again. */
  reset(): void {
    this.air = null;
    this.fireworks = 0;
    this.passed.clear();
    this.layout(0);
  }

  private layout(time: number): void {
    let n = 0;
    for (const g of this.gates) {
      if (this.passed.has(g.id)) continue;
      // The ring breathes a little and turns slowly about its own axis, so it reads as light, not a hoop.
      const k = 1 + 0.04 * Math.sin(time * 2.1 + g.id);
      this.q.setFromAxisAngle(this.v.set(0, 0, 1), this.spin + g.id);
      this.s.setScalar(g.r * k);
      this.m.compose(this.v.set(g.x, g.y, -g.z), this.q, this.s);
      this.rings.setMatrixAt(n++, this.m);
    }
    this.rings.count = n;
    this.rings.instanceMatrix.needsUpdate = true;
  }

  onEvent(e: SimEvent, s: Snap): void {
    const pos = this.v.set(s.x, s.y + 0.6, -s.z);
    const carrier = this.carry.set(s.vx, 0, -s.vz);
    switch (e.type) {
      case 'skyGate': {
        this.passed.add(e.id);
        const g = this.gates.find((q) => q.id === e.id);
        if (g) this.particles.sparkle(this.v.set(g.x, g.y, -g.z), WHITE_GOLD, 40, 4.5, 0.8, 0.26, carrier, 0.2);
        break;
      }
      case 'dash':
        if (e.phase === 'start') this.particles.sparkle(pos, WHITE_GOLD, 26, 3.2, 0.5, 0.22, carrier, 0.25);
        break;
      case 'ward':
        // The lantern breaks into light where the hit was.
        this.particles.sparkle(pos, LIGHT, 34, 4, 0.6, 0.24, carrier, 0.4);
        this.particles.burst(pos, 0.9, 18, carrier, WHITE_GOLD);
        break;
      case 'lantern':
        this.particles.sparkle(this.v.set(s.x, s.y + 1.2, -s.z), LIGHT, 10, 1.4, 0.45, 0.18, carrier, 0.6);
        break;
    }
  }

  /** Per frame: the gates turn, a dash trails light behind the rider, and a dashing ghost trails its own. */
  update(dt: number, time: number, mode: 'run' | 'title' | 'results', s: Snap, sim: Sim | null, poses: ReadonlyMap<number, GhostPose | null>, low: boolean): void {
    this.spin += dt * 0.35;
    if (this.rings.count > 0) this.layout(time);
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
    // A win: fireworks burst over the square, a few at a time, then fewer.
    if (this.fireworks > 0) {
      this.fireworks -= dt;
      this.fireAcc += dt;
      if (this.fireAcc > 0.32) {
        this.fireAcc = 0;
        const n = this.fireN++;
        const c = FIREWORK[n % FIREWORK.length];
        const side = n % 2 === 0 ? 1 : -1;
        this.particles.sparkle(this.v.set(s.x + side * (6 + (n % 3) * 5), s.y + 16 + (n % 4) * 3, -s.z - 34 - (n % 5) * 6), c, low ? 24 : 46, 7, 1.1, 0.34, null, -0.6);
      }
    }
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
}
