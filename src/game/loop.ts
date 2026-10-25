import { DT } from '../sim/sim';

/**
 * Fixed-timestep driver. Render frames feed real elapsed time; the simulation always advances in
 * whole 1/60 s ticks. Returns the interpolation factor between the previous and current tick.
 */
export class FixedLoop {
  private acc = 0;
  /** Cap so a long stall (tab switch, debugger) never fast-forwards more than this. */
  maxFrame = 0.25;

  constructor(private readonly tick: () => boolean) {}

  /** Advance by a render frame of `dt` seconds. The tick callback returns false to stop early. */
  advance(dt: number): number {
    this.acc += Math.min(Math.max(dt, 0), this.maxFrame);
    while (this.acc >= DT) {
      this.acc -= DT;
      if (!this.tick()) {
        this.acc = 0;
        break;
      }
    }
    return this.acc / DT;
  }

  reset(): void {
    this.acc = 0;
  }
}
