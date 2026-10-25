import { CHUNK_LEN, Course, Obstacle } from '../sim/course';
import { SLED_RADIUS } from '../sim/sim';

// What the bot believes is around it. Obstacles enter the scene only once the bot has noticed them,
// so a distracted or inexperienced bot reacts late to things a skilled one saw long before.

/** Any collider the bot plans around. Obstacles satisfy it directly; the yeti is added as one. */
export interface Collider {
  id: number;
  x: number;
  z: number;
  x2: number;
  z2: number;
  r: number;
  /** Ground height at the collider and its height above that. */
  y: number;
  h: number;
  soft: boolean;
}

/** Clearance values are capped here: beyond this nothing is close enough to matter. */
export const FAR = 5;
/** Largest centre-to-surface reach of any collider along z (long logs, big seracs). */
const REACH = 3.2;

function zc(o: Collider): number {
  return (o.z + o.z2) * 0.5;
}

export class Scene {
  readonly items: Collider[] = [];

  constructor(private readonly course: Course) {}

  /** Rebuild around the rider at z. `noticeAt` gives how far ahead each obstacle becomes visible. */
  gather(z: number, ahead: number, destroyed: Set<number>, noticeAt: (o: Obstacle) => number): void {
    const items = this.items;
    items.length = 0;
    const lo = z - 8;
    const hi = z + ahead;
    const k0 = Math.max(0, Math.floor(lo / CHUNK_LEN));
    const k1 = Math.floor(hi / CHUNK_LEN);
    for (let k = k0; k <= k1; k++) {
      for (const o of this.course.chunk(k).obstacles) {
        const c = zc(o);
        if (c < lo || c > hi || destroyed.has(o.id)) continue;
        if (c - z > noticeAt(o)) continue;
        items.push(o);
      }
    }
    this.sort();
  }

  /** Add a dynamic collider; call sort() after the last one. */
  add(c: Collider): void {
    this.items.push(c);
  }

  sort(): void {
    // Insertion sort: the list is short and nearly sorted already, and the order is deterministic.
    const a = this.items;
    for (let i = 1; i < a.length; i++) {
      const v = a[i];
      const key = zc(v);
      let j = i - 1;
      while (j >= 0 && zc(a[j]) > key) {
        a[j + 1] = a[j];
        j--;
      }
      a[j + 1] = v;
    }
  }

  private first(z: number): number {
    const a = this.items;
    let lo = 0;
    let hi = a.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (zc(a[mid]) < z) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Gap between the sled's edge and the nearest collider at (x, z), for a sled whose bottom is at
   * height y (pass -Infinity on the ground). Colliders the sled is above, soft ones and `skip` are
   * ignored. Capped at FAR.
   */
  clearance(x: number, z: number, y: number, skip = -1): number {
    const a = this.items;
    let best = FAR;
    const zMax = z + FAR + REACH;
    for (let i = this.first(z - FAR - REACH); i < a.length; i++) {
      const o = a[i];
      if (zc(o) > zMax) break;
      if (o.soft || o.id === skip || y > o.y + o.h + 0.25) continue;
      let px = o.x;
      let pz = o.z;
      if (o.x2 !== o.x || o.z2 !== o.z) {
        const ex = o.x2 - o.x;
        const ez = o.z2 - o.z;
        let t = ((x - o.x) * ex + (z - o.z) * ez) / (ex * ex + ez * ez);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        px = o.x + ex * t;
        pz = o.z + ez * t;
      }
      const dx = x - px;
      const dz = z - pz;
      if (dx > FAR + o.r + 1 || dx < -FAR - o.r - 1) continue;
      const c = Math.sqrt(dx * dx + dz * dz) - o.r - SLED_RADIUS;
      if (c < best) best = c;
    }
    return best;
  }
}
