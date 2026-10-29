import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { ChaseCamera } from '../src/render/camera';
import { BRUSH_LAT, BRUSH_LAT_MIN, BRUSH_LEAD, BRUSH_NDC, brushPoint } from '../src/render/brush';

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
