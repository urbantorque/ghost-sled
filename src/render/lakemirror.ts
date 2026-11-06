import { HalfFloatType, LinearFilter, Object3D, PerspectiveCamera, RGBAFormat, UnsignedByteType, Vector3, WebGLRenderTarget, WebGLRenderer } from 'three';
import type { Course } from '../sim/course';
import { lake } from './materials';

// What a frozen lake mirrors. A sky and a range of peaks that follow the lens are as good as at infinity,
// so one picture of them, looking down the fall line, holds for every lens on the lake: the snow shader
// looks its reflected ray up in it. A real mirror pass would redraw the sky each frame for the sake of one
// section; this redraws it into a small target when a lake comes up and every few seconds while one is
// near (the sun's journey moves, the clouds drift), and costs nothing anywhere else. The bake is the upper
// half of a very wide view: the horizon along its foot, about 75 degrees either side of the fall line.

const W = 768;
const H = 200;
/** The tangents of the view's half-width and of its height over the horizon. */
const TAN_X = 3.7;
const TAN_Y = 1.25;
/** How far ahead a lake is baked for, and how often it is baked again, seconds. */
const AHEAD = 480;
const EVERY = 3.5;

export class LakeMirror {
  private target: WebGLRenderTarget;
  private cam = new PerspectiveCamera((2 * Math.atan(TAN_Y) * 180) / Math.PI, TAN_X / TAN_Y, 10, 5200);
  private fwd = new Vector3();
  private last = -1e9;
  private course: Course | null = null;

  constructor(renderer: WebGLRenderer) {
    const half = renderer.capabilities.isWebGL2;
    this.target = new WebGLRenderTarget(W, H, { format: RGBAFormat, type: half ? HalfFloatType : UnsignedByteType, minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false, depthBuffer: true, stencilBuffer: false });
    this.target.texture.name = 'lake-sky';
    lake.uLakeSky.value = this.target.texture;
    lake.uLakeMap.value.set(TAN_X, TAN_Y, 0);
    this.cam.setViewOffset(W, H * 2, 0, 0, W, H);
  }

  /** The next bake happens at once (a new mood or course repaints what the lake mirrors). */
  invalidate(): void {
    this.last = -1e9;
  }

  /** Whether a lake lies within reach of sim z. */
  private near(c: Course, z: number): boolean {
    for (let d = -40; d <= AHEAD; d += 80) if (c.section(Math.max(0, z + d)).kind === 'lake') return true;
    return false;
  }

  update(renderer: WebGLRenderer, sky: Object3D, c: Course, z: number, time: number): void {
    if (c !== this.course) {
      this.course = c;
      this.last = -1e9;
    }
    if (time - this.last < EVERY || !this.near(c, z)) return;
    this.last = time;
    const prev = renderer.getRenderTarget();
    this.cam.position.copy(sky.position);
    this.cam.lookAt(this.fwd.copy(sky.position).setZ(sky.position.z - 100));
    renderer.setRenderTarget(this.target);
    renderer.render(sky, this.cam);
    renderer.setRenderTarget(prev);
    lake.uLakeMap.value.z = 1;
  }
}
