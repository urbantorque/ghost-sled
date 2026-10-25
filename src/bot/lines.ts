import { Course } from '../sim/course';
import { datan2 } from '../sim/dmath';

// The corridor as the bot sees it: the course's centre, width and safe line sampled once per metre
// and interpolated. The bot asks for these hundreds of times per decision, and the noise behind
// them is the most expensive thing in the course, so a small ring cache pays for itself.

const SIZE = 1024;
const MASK = SIZE - 1;

export class Lines {
  private readonly key = new Int32Array(SIZE).fill(-0x40000000);
  private readonly sx = new Float64Array(SIZE);
  private readonly cx = new Float64Array(SIZE);
  private readonly hw = new Float64Array(SIZE);

  constructor(private readonly course: Course) {}

  private slot(i: number): number {
    const k = i & MASK;
    if (this.key[k] !== i) {
      const c = this.course;
      this.key[k] = i;
      this.sx[k] = c.safeX(i);
      this.cx[k] = c.centerX(i);
      this.hw[k] = c.halfWidth(i);
    }
    return k;
  }

  safeX(z: number): number {
    const i = Math.floor(z);
    const a = this.slot(i);
    const b = this.slot(i + 1);
    return this.sx[a] + (this.sx[b] - this.sx[a]) * (z - i);
  }

  /** Distance past the corridor edge (negative inside), like Course.edgeExcess. */
  edgeExcess(x: number, z: number): number {
    const i = Math.floor(z);
    const a = this.slot(i);
    const b = this.slot(i + 1);
    const t = z - i;
    const cx = this.cx[a] + (this.cx[b] - this.cx[a]) * t;
    const hw = this.hw[a] + (this.hw[b] - this.hw[a]) * t;
    const d = x - cx;
    return (d < 0 ? -d : d) - hw;
  }

  /** Direction of the safe line at z (0 is straight down the fall line). */
  dir(z: number): number {
    return datan2(this.safeX(z + 6) - this.safeX(z - 6), 12);
  }
}
