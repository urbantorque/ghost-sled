import { Color, DynamicDrawUsage, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { Course } from '../sim/course';
import { softPart } from './flora';
import { makeToonMaterial, shared } from './materials';
import type { Particles } from './particles';
import type { Tier } from './world';

// The banks answer skill: a stomp or a big landing near one sends a small slough of snow sliding down
// it, a tongue of soft lumps that starts high on the bank ahead, slides down the fall of it with
// powder coming off the front, and breaks up on the corridor's edge. It never reaches the line and
// never looks like a hazard: lit snow, round and soft, gone before the edge. Instanced and capped, one
// draw only while one is sliding, Medium and High only (Low answers in the particles it already has).

/** Lumps in all and in one slough (four at once; a fifth takes the oldest's lumps). */
const LUMPS = 56;
const PER = 14;
/** Where a slough starts (metres past the edge) and where its lumps have broken up. */
const FROM_E = [5.5, 8.5] as const;
const DONE_E = 0.4;
/** A bank must stand at least this high over the edge to shed anything (metres), and it must be a
 *  bank: a ravine, a bridge or a street's wall has none. */
const MIN_RISE = 1.6;
/** Metres past the corridor's edge a rider is "near" it (inside the corridor), and how far past. */
export const NEAR_BANK = 7;

export interface BankSide {
  side: -1 | 1;
  /** Metres from the rider to the corridor's edge (negative: already past it). */
  gap: number;
}

/** Which bank a rider at (x, z) is near, or null (the middle of a wide corridor). */
export function nearBank(c: Pick<Course, 'centerX' | 'edgeExcess'>, x: number, z: number): BankSide | null {
  const e = c.edgeExcess(x, z);
  if (e < -NEAR_BANK) return null;
  return { side: x >= c.centerX(z) ? 1 : -1, gap: -e };
}

/** How far past the edge a slough can start at sim z on one side, or null where there is no bank to
 *  shed one: the ground has to climb, and nothing solid may stand on the way (edgeLimit). */
export function sloughStart(c: Pick<Course, 'centerX' | 'halfWidth' | 'edgeLimit' | 'ground'>, z: number, side: -1 | 1, e0: number): number | null {
  const e = Math.min(e0, c.edgeLimit(z) - 0.6);
  if (e < 3.5) return null;
  const cx = c.centerX(z);
  const hw = c.halfWidth(z);
  const rise = c.ground(cx + side * (hw + e), z) - c.ground(cx + side * hw, z);
  return rise >= MIN_RISE ? e : null;
}

const q = new Quaternion();
const eul = new Euler();
const m4 = new Matrix4();
const pos = new Vector3();
const scl = new Vector3();
const ZERO = new Vector3();

export class Sloughs {
  readonly mesh: InstancedMesh;
  private tierOn = false;
  private active = 0;
  private next = 0;
  private z = new Float32Array(LUMPS);
  private e = new Float32Array(LUMPS);
  private side = new Float32Array(LUMPS);
  private vE = new Float32Array(LUMPS);
  private vZ = new Float32Array(LUMPS);
  private t = new Float32Array(LUMPS);
  private r = new Float32Array(LUMPS);
  private spin = new Float32Array(LUMPS);
  private live = new Uint8Array(LUMPS);
  private color: InstancedBufferAttribute;
  private course: Course;
  private puffAcc = 0;
  /** Lumps are out: an idle frame costs nothing. */
  private armed = false;

  constructor(course: Course, tier: Tier, private particles: Particles) {
    this.course = course;
    const g = softPart(new SphereGeometry(1, 8, 6), '#FFFFFF');
    this.mesh = new InstancedMesh(g, makeToonMaterial({ coolShade: 0.55, rim: 0.18, emissive: new Color('#B4BEEA'), emissiveStrength: 0.42 }), LUMPS);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.color = new InstancedBufferAttribute(new Float32Array(LUMPS * 3).fill(1), 3).setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = this.color;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.visible = false;
    this.setTier(tier);
  }

  setCourse(c: Course): void {
    this.course = c;
    this.clear();
  }

  setTier(tier: Tier): void {
    this.tierOn = tier !== 'low';
    if (!this.tierOn) this.clear();
  }

  clear(): void {
    this.live.fill(0);
    this.armed = false;
    this.active = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  /** How many sloughs' worth of lumps are sliding, for probes. */
  get sliding(): number {
    return this.active;
  }

  /** Sends one down the bank on `side` at sim z (a little size `k`, 0.6 to 1.2). False if there is no
   *  bank there or the tier has none. */
  start(z: number, side: -1 | 1, k = 1): boolean {
    if (!this.tierOn) return false;
    const e0 = sloughStart(this.course, z, side, FROM_E[0] + Math.random() * (FROM_E[1] - FROM_E[0]));
    if (e0 === null) return false;
    this.armed = true;
    const c = new Color().copy(shared.uSnowLit.value as Color);
    for (let i = 0; i < PER; i++) {
      const j = this.next;
      this.next = (this.next + 1) % LUMPS;
      this.live[j] = 1;
      this.z[j] = z + (Math.random() - 0.5) * (2 + 3.5 * (1 - i / PER));
      // A tongue: the front lumps lower and bigger, the rest strung out behind them up the bank.
      this.e[j] = e0 + (i / PER) * 3 + Math.random() * 0.4;
      this.side[j] = side;
      this.vE[j] = -(2.2 + Math.random() * 1.6);
      this.vZ[j] = 1.5 + Math.random() * 2;
      this.t[j] = -i * 0.03;
      this.r[j] = (0.42 + Math.random() * 0.4) * k * (1 - 0.35 * (i / PER));
      this.spin[j] = Math.random() * 6.28;
      const v = 0.96 + Math.random() * 0.1;
      this.color.setXYZ(j, c.r * v, c.g * v, c.b * v);
    }
    this.color.needsUpdate = true;
    return true;
  }

  update(dt: number): void {
    if (!this.tierOn || !this.armed) return;
    const c = this.course;
    let any = 0;
    let lead = -1;
    this.mesh.count = LUMPS;
    for (let i = 0; i < LUMPS; i++) {
      if (!this.live[i]) {
        this.mesh.setMatrixAt(i, m4.compose(ZERO, q.identity(), scl.setScalar(0)));
        continue;
      }
      this.t[i] += dt;
      if (this.t[i] < 0) {
        this.mesh.setMatrixAt(i, m4.compose(ZERO, q.identity(), scl.setScalar(0)));
        any++;
        continue;
      }
      // Gathers pace down the bank.
      this.vE[i] -= 6.5 * dt;
      this.e[i] += this.vE[i] * dt;
      this.z[i] += this.vZ[i] * dt;
      this.spin[i] += dt * (-this.vE[i] * 1.6);
      const e = this.e[i];
      if (e < DONE_E) {
        this.live[i] = 0;
        this.mesh.setMatrixAt(i, m4.compose(ZERO, q.identity(), scl.setScalar(0)));
        continue;
      }
      any++;
      if (lead < 0 || e < this.e[lead]) lead = i;
      const z = this.z[i];
      const x = c.centerX(z) + this.side[i] * (c.halfWidth(z) + e);
      const y = c.ground(x, z);
      // Swells as it breaks loose, and thins out over the last 2 m to the edge.
      const grow = Math.min(1, this.t[i] / 0.14);
      const fade = Math.min(1, (e - DONE_E) / 2);
      const r = this.r[i] * grow * (0.35 + 0.65 * fade);
      pos.set(x, y + r * 0.72, -z);
      eul.set(this.spin[i] * 0.7, this.spin[i], 0);
      // (Stood up off the bank: pressed flat they read as pebbles, not as snow on the move.)
      scl.set(r * 1.2, r, r * 1.1);
      this.mesh.setMatrixAt(i, m4.compose(pos, q.setFromEuler(eul), scl));
    }
    this.armed = any > 0;
    this.active = any > 0 ? Math.ceil(any / PER) : 0;
    this.mesh.visible = any > 0;
    if (any > 0) this.mesh.instanceMatrix.needsUpdate = true;
    else this.mesh.count = 0;
    // Powder comes off the front of it (the existing layer, budget scaled).
    this.puffAcc += dt;
    if (lead >= 0 && this.puffAcc > 0.035) {
      this.puffAcc = 0;
      const z = this.z[lead];
      const x = c.centerX(z) + this.side[lead] * (c.halfWidth(z) + this.e[lead]);
      this.particles.sloughPuff(pos.set(x, c.ground(x, z) + 0.2, -z), this.side[lead] * this.vE[lead], this.vZ[lead]);
    }
  }
}

