import { Object3D } from 'three';
import type { Course } from '../sim/course';
import type { MomentKit, StageCtx } from './momentkit';

// Round 7 (the momentsworld lane): the legend moments of the four older mountains, staged. Each is drawn
// from the sim's own account (sim.legend: where, which side, its line and lights; sim.lg: its phase, a
// runner's head, a ribbon's charge) and is spectacle only: no collider, nothing written back.

/** What the reel, the camera and the HUD may ask of the legend on screen. */
export interface LegendShot {
  key: string;
  name: string;
  /** 0 waiting, 1 said, 2 playing, 3 over (the sim's own phase). */
  phase: number;
  /** How far through its staging it is, 0 to 1, and how near its peak (0 to 1, 1 at the peak). */
  k: number;
  peak: number;
  /** Where to look, in three.js space, and which side of the run it keeps to. */
  x: number;
  y: number;
  z: number;
  side: 1 | -1;
}

/** The legends this file stages (the fifth mountain's are the lanternworld lane's). */
const OWN: ReadonlySet<string> = new Set(['stag', 'fleet', 'aurora', 'herd', 'eruption', 'wyrm', 'dragon', 'cranes']);

export class LegendWorld {
  readonly root = new Object3D();
  private readonly look: LegendShot = { key: '', name: '', phase: 0, k: 0, peak: 0, x: 0, y: 0, z: 0, side: 1 };
  private live = false;

  constructor(private readonly kit: MomentKit) {
    void this.kit;
  }

  /** Whether this file draws the legend with this key. */
  owns(key: string): boolean {
    return OWN.has(key);
  }

  setCourse(c: Course): void {
    void c;
    this.reset();
  }

  reset(): void {
    this.live = false;
  }

  update(ctx: StageCtx): void {
    void ctx;
    this.live = false;
  }

  /** The legend on screen this frame, or null. */
  shot(): LegendShot | null {
    return this.live ? this.look : null;
  }
}
