import { Color, InstancedMesh, Matrix4, Object3D, Quaternion, TorusGeometry, Vector3 } from 'three';
import type { GhostPose } from '../game/ghosts';
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
