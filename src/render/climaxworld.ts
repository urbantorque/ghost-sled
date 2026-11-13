import { Object3D } from 'three';
import type { Course } from '../sim/course';
import type { MomentKit, StageCtx } from './momentkit';

// Round 7 (the momentsworld lane): the last stage's picture, built to peak at the line (filled in below).
export class ClimaxWorld {
  readonly root = new Object3D();
  constructor(private readonly kit: MomentKit) {
    void this.kit;
  }
  setCourse(c: Course): void {
    void c;
  }
  reset(): void {}
  update(ctx: StageCtx): void {
    void ctx;
  }
}
