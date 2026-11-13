import { Object3D } from 'three';
import type { Beat } from '../game/beats';
import type { Course } from '../sim/course';
import type { MomentPlay } from '../sim/moments';
import type { MomentKit, StageCtx } from './momentkit';

// Round 7 (the momentsworld lane): each verb's own world on the four older mountains (filled in below).
export class VerbWorld {
  readonly root = new Object3D();
  constructor(private readonly kit: MomentKit) {
    void this.kit;
  }
  /** Whether this file draws this set piece's verb (the fifth mountain's are the lanternworld lane's). */
  owns(p: MomentPlay): boolean {
    return p.verb !== 'follow' && p.verb !== 'kindle' && p.verb !== 'carry';
  }
  build(c: Course, plays: readonly MomentPlay[]): void {
    void c;
    void plays;
  }
  reset(): void {}
  beats(list: readonly Beat[], ctx: StageCtx): void {
    void list;
    void ctx;
  }
  update(ctx: StageCtx): void {
    void ctx;
  }
}
