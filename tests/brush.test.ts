import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { ChaseCamera } from '../src/render/camera';
import { BRUSH_CLEAR, BRUSH_LAT, BRUSH_LAT_MIN, BRUSH_LEAD, BRUSH_NDC, BRUSH_NDC_Y, BRUSH_REACH_BOUGH, brushPoint } from '../src/render/brush';

// A near miss's burst is set where the chase lens sees it: beside the rider on the side you shaved,
// a little ahead, and inside the frame on a desktop and on a phone in portrait. The beat lands with the
// hazard already a radius and 1.5 m behind the sled, where the burst used to go (out of the picture).

const SPEED = 25;

/** A chase lens settled behind a sled at sim (x, z) riding at `heading` (radians off straight downhill). */
function lens(aspect: number, x: number, z: number, heading: number): { cam: ChaseCamera; sled: { x: number; z: number; vx: number; vz: number } } {
  const cam = new ChaseCamera();
  cam.setAspect(aspect);
  cam.ground = () => 0;
  cam.mode = 'chase';
  const vx = SPEED * Math.sin(heading);
  const vz = SPEED * Math.cos(heading);
  const dir = new Vector3(vx, 0, -vz).normalize();
  // Ride in for two seconds so the eased follow settles at speed.
  for (let i = 0; i < 120; i++) {
    const t = (i - 119) / 60;
    cam.update({ pos: new Vector3(x + vx * t, 0, -(z + vz * t)), dir, speed: SPEED, steer: 0, airborne: false, boost: 0 }, 1 / 60);
  }
  cam.camera.updateMatrixWorld();
  return { cam, sled: { x, z, vx, vz } };
}

const flat = () => 0;

describe('near-miss burst placement', () => {
  for (const [name, aspect] of [
    ['desktop 16:9', 16 / 9],
    ['phone portrait', 390 / 844],
  ] as const) {
    for (const side of [-1, 1]) {
      for (const heading of [0, 0.35, -0.35]) {
        it(`${name}: hazard on the ${side > 0 ? 'right' : 'left'}, heading ${heading}: in frame, ahead, on its side`, () => {
          const { cam, sled } = lens(aspect, 3, 200, heading);
          // The hazard as the beat names it: 1.7 m out on that side, 2.4 m back along the travel.
          const fx = Math.sin(heading);
          const fz = Math.cos(heading);
          const hx = sled.x + side * 1.7 * fz - 2.4 * fx;
          const hz = sled.z - side * 1.7 * fx - 2.4 * fz;
          const at = new Vector3();
          const toward = new Vector3();
          const lat = brushPoint(sled, hx, hz, flat, cam.camera, at, toward);
          expect(lat).toBeGreaterThanOrEqual(BRUSH_LAT_MIN);
          expect(lat).toBeLessThanOrEqual(BRUSH_LAT);
          // Three.js space: forward (fx, -fz), right (fz, fx).
          const dx = at.x - sled.x;
          const dz = at.z + sled.z;
          expect(dx * fx + dz * -fz).toBeCloseTo(BRUSH_LEAD, 5);
          expect(Math.sign(dx * fz + dz * fx)).toBe(side);
          // `toward` points from the burst back to the rider's line, level and unit.
          expect(toward.y).toBe(0);
          expect(toward.length()).toBeCloseTo(1, 6);
          expect(toward.x * dx + toward.z * dz).toBeLessThan(0);
          // Its middle (a metre over the snow) is in front of the lens and inside the frame.
          const p = at.clone().setY(1).project(cam.camera);
          expect(p.z).toBeGreaterThan(-1);
          expect(p.z).toBeLessThan(1);
          if (lat > BRUSH_LAT_MIN) expect(Math.abs(p.x)).toBeLessThanOrEqual(BRUSH_NDC + 1e-6);
          expect(Math.abs(p.x)).toBeLessThan(0.95);
          expect(Math.abs(p.y)).toBeLessThan(0.9);
        });
      }
    }
  }

  it('the hazard itself is already out of the chase frame when the beat lands (why the burst moved)', () => {
    // A pine's near bough edge, 1.7 m out and 2.4 m back, at the 2.3 m the old burst started from.
    const d = lens(16 / 9, 0, 300, 0);
    const pd = new Vector3(1.7, 2.3, -297.6).project(d.cam.camera);
    expect(pd.y).toBeGreaterThan(0.85);
    const p = lens(390 / 844, 0, 300, 0);
    const pp = new Vector3(1.7, 2.3, -297.6).project(p.cam.camera);
    expect(Math.abs(pp.x)).toBeGreaterThan(1);
    // The burst's own middle sits well inside both frames.
    const at = new Vector3();
    const toward = new Vector3();
    expect(brushPoint(d.sled, 1.7, 297.6, flat, d.cam.camera, at, toward)).toBe(BRUSH_LAT);
    expect(Math.abs(at.clone().setY(1).project(d.cam.camera).x)).toBeLessThan(0.5);
    expect(brushPoint(p.sled, 1.7, 297.6, flat, p.cam.camera, at, toward)).toBe(BRUSH_LAT);
    expect(Math.abs(at.clone().setY(1).project(p.cam.camera).x)).toBeLessThan(0.6);
  });

  it('a narrow lens pulls the burst in toward the rider, never closer than the floor', () => {
    const eye = new PerspectiveCamera(28, 390 / 844, 0.1, 500);
    eye.position.set(0, 2.5, -296);
    eye.lookAt(0, 0.9, -300);
    eye.updateMatrixWorld();
    const at = new Vector3();
    const toward = new Vector3();
    const lat = brushPoint({ x: 0, z: 300, vx: 0, vz: SPEED }, 1.7, 297.6, flat, eye, at, toward);
    expect(lat).toBeLessThan(BRUSH_LAT);
    expect(lat).toBeGreaterThanOrEqual(BRUSH_LAT_MIN);
    const p = at.clone().setY(1).project(eye);
    if (lat > BRUSH_LAT_MIN) expect(Math.abs(p.x)).toBeLessThanOrEqual(BRUSH_NDC + 1e-6);
    expect(at.x).toBeCloseTo(lat, 6);
  });

  it('sits on the snow, and skips the frame test with no lens', () => {
    const at = new Vector3();
    const toward = new Vector3();
    const lat = brushPoint({ x: 0, z: 100, vx: 0, vz: 20 }, -2, 98, (x, z) => 0.1 * x - 0.5 * z, null, at, toward);
    expect(lat).toBe(BRUSH_LAT);
    expect(at.x).toBeCloseTo(-BRUSH_LAT, 6);
    expect(at.z).toBeCloseTo(-(100 + BRUSH_LEAD), 6);
    expect(at.y).toBeCloseTo(0.1 * at.x - 0.5 * -at.z, 6);
    expect(toward.x).toBeCloseTo(1, 6);
  });
});

// The sim grades a near miss on the level gap alone, so one lands in the air too (the stunt pilot
// shaved a pine 13.6 m and 3.5 m up on Pinecrest): left on the snow, the burst's middle projected at
// ndc y -2.4 and -0.84, under the frame or at its very foot while the lens rode up with the rider.

const G = 9.81;

/** A chase lens that rode in on the snow, then followed a sled launched straight down the fall line
 *  until the top of its arc, `h` m over flat snow (airborne the whole way up). */
function airLens(aspect: number, h: number): { cam: ChaseCamera; sled: { x: number; y: number; z: number; vx: number; vz: number } } {
  const cam = new ChaseCamera();
  cam.setAspect(aspect);
  cam.ground = () => 0;
  cam.mode = 'chase';
  const dir = new Vector3(0, 0, -1);
  let z = 200;
  for (let i = 0; i < 90; i++) {
    z += SPEED / 60;
    cam.update({ pos: new Vector3(0, 0, -z), dir, speed: SPEED, steer: 0, airborne: false, boost: 0 }, 1 / 60);
  }
  const vy0 = Math.sqrt(2 * G * h);
  const n = Math.round((vy0 / G) * 60);
  let y = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / 60;
    y = Math.min(h, vy0 * t - 0.5 * G * t * t);
    z += SPEED / 60;
    cam.update({ pos: new Vector3(0, y, -z), dir, speed: SPEED, steer: 0, airborne: true, boost: 0 }, 1 / 60);
  }
  cam.camera.updateMatrixWorld();
  return { cam, sled: { x: 0, y, z, vx: 0, vz: SPEED } };
}

describe('near-miss burst in the air', () => {
  for (const [name, aspect] of [
    ['desktop 16:9', 16 / 9],
    ['phone portrait', 390 / 844],
  ] as const) {
    for (const h of [1, 1.9, 3.5, 5]) {
      it(`${name}: a tree shaved ${h} m up throws its snow at the rider's height (up to the crown), in frame`, () => {
        const { cam, sled } = airLens(aspect, h);
        const at = new Vector3();
        const toward = new Vector3();
        const lat = brushPoint(sled, 1.7, sled.z - 2.4, flat, cam.camera, at, toward, BRUSH_REACH_BOUGH);
        expect(lat).toBeGreaterThanOrEqual(BRUSH_LAT_MIN);
        expect(at.y).toBeCloseTo(Math.min(sled.y, BRUSH_REACH_BOUGH), 6);
        const p = at.clone().setY(at.y + 1).project(cam.camera);
        expect(p.z).toBeLessThan(1);
        expect(p.y).toBeGreaterThanOrEqual(BRUSH_NDC_Y);
        expect(p.y).toBeLessThan(0.9);
        expect(Math.abs(p.x)).toBeLessThan(0.95);
      });
    }

    it(`${name}: high over a tree's top (13.6 m), no burst; on the snow it would be under the frame`, () => {
      const { cam, sled } = airLens(aspect, 13.6);
      const at = new Vector3();
      const toward = new Vector3();
      expect(BRUSH_REACH_BOUGH + BRUSH_CLEAR).toBeLessThan(13.6);
      expect(brushPoint(sled, 1.7, sled.z - 2.4, flat, cam.camera, at, toward, BRUSH_REACH_BOUGH)).toBe(0);
      // Where it used to go: the snow beside the sled, its middle at the frame's very foot or under it.
      brushPoint({ x: sled.x, z: sled.z, vx: sled.vx, vz: sled.vz }, 1.7, sled.z - 2.4, flat, cam.camera, at, toward);
      expect(at.y).toBe(0);
      expect(at.clone().setY(1).project(cam.camera).y).toBeLessThan(BRUSH_NDC_Y);
    });

    it(`${name}: grit stays on the snow from 1.5 m up, and none from more than ${BRUSH_CLEAR} m up`, () => {
      const low = airLens(aspect, 1.5);
      const at = new Vector3();
      const toward = new Vector3();
      expect(brushPoint(low.sled, 1.7, low.sled.z - 2.4, flat, low.cam.camera, at, toward, 0)).toBeGreaterThanOrEqual(BRUSH_LAT_MIN);
      expect(at.y).toBe(0);
      expect(at.clone().setY(1).project(low.cam.camera).y).toBeGreaterThanOrEqual(BRUSH_NDC_Y);
      const high = airLens(aspect, BRUSH_CLEAR + 0.5);
      expect(brushPoint(high.sled, 1.7, high.sled.z - 2.4, flat, high.cam.camera, at, toward, 0)).toBe(0);
    });
  }

  it('on the snow a height changes nothing (y at the snow, or left out)', () => {
    const { cam, sled } = lens(16 / 9, 3, 200, 0.35);
    const slope = (x: number, z: number) => 0.1 * x - 0.5 * z;
    const a = new Vector3();
    const b = new Vector3();
    const ta = new Vector3();
    const tb = new Vector3();
    const la = brushPoint(sled, 4.6, 198, slope, cam.camera, a, ta, BRUSH_REACH_BOUGH);
    const lb = brushPoint({ ...sled, y: slope(sled.x, sled.z) }, 4.6, 198, slope, cam.camera, b, tb, BRUSH_REACH_BOUGH);
    expect(lb).toBe(la);
    expect(b.distanceTo(a)).toBeLessThan(1e-9);
    expect(tb.distanceTo(ta)).toBeLessThan(1e-9);
  });

  it('a lifted burst whose middle would still sit under the frame is skipped', () => {
    // A lens pitched up at the sky (a kicker's lip): the snow 1 m under the rider is below its foot.
    const eye = new PerspectiveCamera(50, 16 / 9, 0.1, 500);
    eye.position.set(0, 3, -296);
    eye.lookAt(0, 8, -310);
    eye.updateMatrixWorld();
    const at = new Vector3();
    const toward = new Vector3();
    expect(brushPoint({ x: 0, y: 1, z: 300, vx: 0, vz: SPEED }, 1.7, 297.6, flat, eye, at, toward, BRUSH_REACH_BOUGH)).toBe(0);
    // With no lens there is no frame to test: the burst is thrown.
    expect(brushPoint({ x: 0, y: 1, z: 300, vx: 0, vz: SPEED }, 1.7, 297.6, flat, null, at, toward, BRUSH_REACH_BOUGH)).toBe(BRUSH_LAT);
    expect(at.y).toBeCloseTo(1, 6);
  });
});
