import { Vector3, type PerspectiveCamera } from 'three';
import type { ShotCam } from '../game/reel';
import type { Course } from '../sim/course';
import { cine } from './cine';

// The highlight reel's four lenses (round 7). They run only while a reel plays (World.lens), never in a
// run, and they write the cine state the pipeline draws from: a full letterbox, depth of field on the
// rider, a little motion blur.
//
//   side   a tracking shot beside the rider, low, on a long lens, sliding back along the line of travel
//   low    a front three-quarter, near the snow, the rider coming at the lens and past its shoulder
//   wide   high and behind, the mountain the subject and the rider small in it
//   orbit  round the rider through a flight, closest at the apex, where the reel slows the frame
//
// Reduced motion keeps every shot and drops the travelling: each is a camera on a tripod that pans with
// the rider, set down again when the rider has gone too far (cuts, no orbits).

export interface LensShot {
  cam: ShotCam;
  /** The side of the rider the lens stands on (+1 the rider's right). */
  side: 1 | -1;
  /** Seconds into the shot, its length, and the second its moment falls on. */
  t: number;
  len: number;
  peak: number;
  /** The reel's time scale now (1, or under it in the slow frame at a leap's apex). */
  slow: number;
}

const UP = new Vector3(0, 1, 0);
const right = new Vector3();
const fwd = new Vector3();
const at = new Vector3();
const want = new Vector3();

const smooth = (x: number) => {
  const k = x < 0 ? 0 : x > 1 ? 1 : x;
  return k * k * (3 - 2 * k);
};

export class ReelCam {
  shot: LensShot | null = null;
  reduced = false;
  /** A phone held upright: the lenses stand further off so the rider and the ground both fit. */
  tall = false;
  private dir = new Vector3(0, 0, -1);
  private fresh = true;
  /** The tripod (reduced motion): where it stands. */
  private post = new Vector3();
  private posted = false;
  /** The lens's offset from the rider, eased. */
  private off = new Vector3();
  private fov = 40;

  constructor(private course: Course) {}

  setCourse(c: Course): void {
    this.course = c;
  }

  /** A cut: the next frame places the lens outright, with no easing from the last shot. */
  cut(): void {
    this.fresh = true;
    this.posted = false;
  }

  /** World.lens: called each frame after the chase camera, with the rider's place and line of travel. */
  frame = (camera: PerspectiveCamera, focus: Vector3, dir: Vector3, dt: number): void => {
    const s = this.shot;
    if (!s) return;
    // The line of travel, eased: a carve must not swing a lens that stands metres off.
    if (this.fresh) this.dir.copy(dir);
    else this.dir.lerp(dir, Math.min(1, dt * 2.2)).normalize();
    fwd.copy(this.dir).setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    right.crossVectors(fwd, UP).multiplyScalar(s.side);
    const u = s.len > 0 ? Math.max(0, Math.min(1, s.t / s.len)) : 0;
    const far = this.tall ? 1.35 : 1;
    let fov = 40;
    let dof = 0.5;
    at.copy(focus).addScaledVector(UP, 0.9);
    // Where the lens wants to stand, as an offset from the rider: the offset is eased, not the place, so
    // a lens beside a sled at 45 m/s rides with it and never trails metres behind.
    let pan = false;
    if (this.reduced) {
      // A tripod ahead of the rider and off the line; it pans, and is set down again once passed.
      if (!this.posted || this.post.distanceTo(focus) > 46) {
        this.post.copy(focus).addScaledVector(fwd, 20).addScaledVector(right, s.cam === 'wide' ? 12 : 6.5).addScaledVector(UP, s.cam === 'wide' ? 9 : s.cam === 'low' ? 1.1 : 2.2);
        this.posted = true;
      }
      pan = true;
      fov = s.cam === 'wide' ? 52 : 40;
      dof = 0.3;
    } else if (s.cam === 'side') {
      want.set(0, 0, 0).addScaledVector(right, 7.2 * far).addScaledVector(fwd, 3.2 - 4.4 * u).addScaledVector(UP, 1.25);
      fov = 36;
    } else if (s.cam === 'low') {
      want.set(0, 0, 0).addScaledVector(fwd, (9.5 - 3 * u) * far).addScaledVector(right, 3.4 * far).addScaledVector(UP, 0.75);
      fov = 44;
      dof = 0.6;
    } else if (s.cam === 'wide') {
      want.set(0, 0, 0).addScaledVector(fwd, -15 * far).addScaledVector(right, 8 * far).addScaledVector(UP, 8.5 + 2 * u);
      fov = 50;
      dof = 0.15;
      at.copy(focus).addScaledVector(fwd, 5).addScaledVector(UP, 0.6);
    } else {
      // The orbit: from behind and to one side, round to the front, nearest at the apex.
      const near = 1 - Math.min(1, Math.abs(s.t - s.peak) / 1.4);
      const ang = -2.2 + 2.9 * smooth(u);
      const r = (8.2 - 2.4 * smooth(near)) * far;
      want.set(0, 0, 0).addScaledVector(fwd, Math.cos(ang) * r).addScaledVector(right, Math.sin(ang) * -r).addScaledVector(UP, 1.3 + 1.6 * u);
      fov = 46 - 6 * smooth(near);
      dof = 0.4 + 0.6 * smooth(near);
    }
    if (pan) camera.position.copy(this.post);
    else {
      if (this.fresh) this.off.copy(want);
      else this.off.lerp(want, Math.min(1, dt * 5));
      camera.position.copy(focus).add(this.off);
    }
    // Never under the snow, nor in it.
    const floor = this.course.ground(camera.position.x, -camera.position.z) + 0.55;
    if (camera.position.y < floor) camera.position.y = floor;
    if (this.fresh) this.fov = fov;
    else this.fov += (fov - this.fov) * Math.min(1, dt * 4);
    this.fresh = false;
    camera.up.copy(UP);
    camera.lookAt(at);
    // (A phone held upright sees a narrow slice of a lens: it opens up to keep the rider's ground.)
    camera.fov = this.tall ? Math.min(78, this.fov * 1.5) : this.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    cine.letterbox = 1;
    cine.dof = dof;
    cine.focus = camera.position.distanceTo(at);
    cine.motionBlur = this.reduced ? 0 : 0.3;
    cine.slow = s.slow;
  };
}
