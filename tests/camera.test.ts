import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ChaseCamera } from '../src/render/camera';
import { CRASH_FREEZE_S, IDLE_FEEL, type Beat, type Feel } from '../src/game/beats';

// The crash beat's pack shot: after the held frame the lens cuts to face the pack from low downhill
// of the wreck, and keeps clear of the trees at its spot and across its line to the wreck.

const WRECK = new Vector3(0, 0, -100); // three.js (sim z 100)
const DOWN = new Vector3(0, 0, -1);

function crash(blocked: ((x: number, z: number, r: number) => boolean) | null, orbitFrom: number | null, feel: Feel = IDLE_FEEL): ChaseCamera {
  const cam = new ChaseCamera();
  cam.setAspect(16 / 9);
  cam.ground = () => 0;
  cam.blocked = blocked;
  cam.beats([], feel);
  // Ride in behind the wreck's spot, then crash there.
  cam.mode = 'chase';
  for (let i = 0; i < 40; i++) cam.update({ pos: WRECK, dir: DOWN, speed: 24, steer: 0, airborne: false, boost: 0 }, 1 / 60);
  cam.mode = 'crash';
  const beat: Beat = { type: 'crash', tick: 0, cause: 'tree', stake: 0, orbitFrom };
  cam.beats([beat], feel);
  // The hold (CRASH_FREEZE_S of scaled time at full speed here), then a few frames of the orbit.
  const frames = Math.ceil(CRASH_FREEZE_S * 60) + 12;
  for (let i = 0; i < frames; i++) cam.update({ pos: WRECK, dir: DOWN, speed: 0, steer: 0, airborne: true, boost: 0 }, 1 / 60);
  return cam;
}

/** The lens's compass angle round the wreck in the orbit's convention (0: uphill of it, PI: downhill). */
const angleOf = (cam: ChaseCamera) => Math.atan2(cam.camera.position.x - WRECK.x, cam.camera.position.z - WRECK.z);
const wrap = (a: number) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;

describe('crash pack shot', () => {
  it('cuts to low and downhill of the wreck, facing a ghost straight up the slope', () => {
    // (A ghost straight behind: its sim bearing atan2(dx, dz) with dz < 0 is PI.)
    const cam = crash(null, Math.PI);
    expect(Math.abs(wrap(angleOf(cam) - Math.PI))).toBeLessThan(0.15);
    const p = cam.camera.position;
    expect(Math.hypot(p.x - WRECK.x, p.z - WRECK.z)).toBeGreaterThan(6.5);
    // Low: about head height over the wreck, not the orbit's usual 3.2 m.
    expect(p.y - WRECK.y).toBeLessThan(2.2);
    expect(p.y - WRECK.y).toBeGreaterThan(0.9);
  });

  it('turns off the set facing when a tree stands where the lens would', () => {
    const tree = { x: 0, z: -107.5 };
    const blocked = (x: number, z: number, r: number) => Math.hypot(x - tree.x, z - tree.z) < r;
    const cam = crash(blocked, Math.PI);
    const p = cam.camera.position;
    expect(Math.hypot(p.x - tree.x, p.z - tree.z)).toBeGreaterThan(2);
    // Still facing up the slope from downhill, within the search's turns.
    expect(Math.abs(wrap(angleOf(cam) - Math.PI))).toBeLessThan(1.05);
    expect(Math.abs(wrap(angleOf(cam) - Math.PI))).toBeGreaterThan(0.15);
  });

  it('keeps the line to the wreck clear of a trunk', () => {
    // A trunk halfway along the set line (3.75 m downhill of the wreck).
    const trunk = { x: 0, z: -103.75 };
    const blocked = (x: number, z: number, r: number) => Math.hypot(x - trunk.x, z - trunk.z) < r;
    const cam = crash(blocked, Math.PI);
    const p = cam.camera.position;
    // The trunk's distance from the lens-to-wreck line, in the ground plane.
    const lx = p.x - WRECK.x;
    const lz = p.z - WRECK.z;
    const l = Math.hypot(lx, lz);
    const tx = trunk.x - WRECK.x;
    const tz = trunk.z - WRECK.z;
    expect(Math.abs(lx * tz - lz * tx) / l).toBeGreaterThan(1);
  });

  it('watches from the open side, not deeper in the trees, and skips the shot when walled in', () => {
    // The forest stands on the far side from the ghost (a wreck at the treeline, the pack on the
    // course): every spot with x > 1 is a tree.
    const forest = (x: number, _z: number, r: number) => x + r > 1;
    const side = crash(forest, -Math.PI / 2 - 0.3);
    expect(side.camera.position.x).toBeLessThan(1);
    // Walled in on every side: no cut, the orbit drifts on from the held lens behind the wreck.
    const walled = crash(() => true, Math.PI);
    expect(Math.abs(wrap(angleOf(walled)))).toBeLessThan(0.8);
  });

  it('never cuts under reduced motion: no hold, the orbit drifts on from the lens', () => {
    const cam = crash(null, Math.PI, { ...IDLE_FEEL, reduced: true });
    expect(cam.holdNow).toBe(0);
    // The chase lens stood uphill of the wreck (behind it), and the orbit carries on from there.
    expect(Math.abs(wrap(angleOf(cam)))).toBeLessThan(0.8);
    expect(cam.rollNow).toBe(0);
  });

  it('with no ghost to face, drifts on from the held lens', () => {
    const cam = crash(null, null);
    expect(Math.abs(wrap(angleOf(cam)))).toBeLessThan(0.8);
  });
});
