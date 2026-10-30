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

// The held crash lens keeps out of the snow: a shelf behind the wreck stands 1.2 m over it, so the
// chase lens rides at the shelf's floor and the crash's shake would dip it into the shelf.
describe('crash hold snow floor', () => {
  const SHELF = 1.2;
  const shelf = (_x: number, z: number): number => (z > -99 ? SHELF : 0);
  const at = (cam: ChaseCamera) => (cam as unknown as { pos: Vector3; look: Vector3 });

  function held(shake: boolean, ground = shelf) {
    const cam = new ChaseCamera();
    cam.setAspect(16 / 9);
    cam.ground = ground;
    cam.beats([], IDLE_FEEL);
    cam.mode = 'chase';
    for (let i = 0; i < 40; i++) cam.update({ pos: WRECK, dir: DOWN, speed: 24, steer: 0, airborne: false, boost: 0 }, 1 / 60);
    cam.mode = 'crash';
    if (shake) cam.onSimEvent({ type: 'crash', cause: 'tree' });
    cam.beats([{ type: 'crash', tick: 0, cause: 'tree', stake: 0, orbitFrom: null }], IDLE_FEEL);
    const lens: Vector3[] = [];
    const base: Vector3[] = [];
    let worst = Infinity;
    let corner = Infinity;
    while (cam.holdNow > 0 || lens.length === 0) {
      // The wreck tumbles away from the held lens.
      const w = WRECK.clone().add(new Vector3(0.3, 0.4, -2).multiplyScalar(lens.length / 10));
      cam.update({ pos: w, dir: DOWN, speed: 0, steer: 0, airborne: true, boost: 0 }, 1 / 60);
      const p = cam.camera.position;
      const look = at(cam).look;
      const floor = Math.max(ground(p.x, p.z) + 0.2, ground((p.x + look.x) / 2, (p.z + look.z) / 2) + 0.3);
      worst = Math.min(worst, p.y - floor);
      // The near plane's lower corners, as the camera draws them.
      cam.camera.updateMatrixWorld();
      for (const sx of [-1, 1]) {
        const c = new Vector3(sx, -1, -1).unproject(cam.camera);
        corner = Math.min(corner, c.y - ground(c.x, c.z));
      }
      lens.push(p.clone());
      base.push(at(cam).pos.clone());
    }
    const moved = (list: Vector3[]) => Math.max(...list.map((v) => v.distanceTo(list[0])));
    return { worst, corner, lens: moved(lens), base: moved(base), frames: lens.length };
  }

  it("keeps the held frame's lower corners out of a bank rising beside the wreck", () => {
    // The shelf, with a bank rising to the right of the lens at 1 in 1.5.
    const banked = (x: number, z: number) => shelf(x, z) + Math.max(0, x - 0.1) / 1.5;
    const h = held(true, banked);
    expect(h.corner).toBeGreaterThan(0);
    expect(h.worst).toBeGreaterThanOrEqual(-1e-9);
    expect(h.base).toBeLessThan(0.01);
  });

  it('keeps the shaken held lens over the snow and halfway to its look point', () => {
    const h = held(true);
    expect(h.frames).toBeGreaterThan(20);
    expect(h.worst).toBeGreaterThanOrEqual(-1e-9);
    // The held lens itself never moves (only the shake does).
    expect(h.base).toBeLessThan(0.01);
  });

  it('holds the lens still while freezeLeft lasts, with the floor on', () => {
    const h = held(false);
    expect(h.worst).toBeGreaterThanOrEqual(-1e-9);
    expect(h.lens).toBeLessThan(0.01);
  });
});

// Weight on the moments the panel found too light: a whisker's flinch and roll, a max drift's
// release, and the stomp streak's growing shake and horizon knock.
describe('feel kicks', () => {
  const ride = (cam: ChaseCamera, frames: number, steer = 0) => {
    for (let i = 0; i < frames; i++) cam.update({ pos: WRECK, dir: DOWN, speed: 24, steer, airborne: false, boost: 0 }, 1 / 60);
  };
  function chase(feel: Feel = IDLE_FEEL): ChaseCamera {
    const cam = new ChaseCamera();
    cam.setAspect(16 / 9);
    cam.ground = () => 0;
    cam.beats([], feel);
    cam.mode = 'chase';
    ride(cam, 60);
    cam.beats([], feel);
    return cam;
  }
  /** Peaks over the next half second after `list`: the jolt's sideways offset, the roll, the shake. */
  function after(list: Beat[], feel: Feel = IDLE_FEEL) {
    const cam = chase(feel);
    const fov0 = cam.camera.fov;
    cam.beats(list, feel);
    const shake = cam.shakeNow;
    let right = 0;
    let roll = 0;
    let fov = 0;
    for (let i = 0; i < 30; i++) {
      ride(cam, 1);
      cam.beats([], feel);
      if (Math.abs(cam.joltNow.right) > Math.abs(right)) right = cam.joltNow.right;
      if (Math.abs(cam.rollNow) > Math.abs(roll)) roll = cam.rollNow;
      fov = Math.max(fov, cam.camera.fov - fov0);
    }
    return { right, roll, shake, fov, hold: cam.holdNow };
  }
  const whisker = (side: -1 | 1): Beat => ({ type: 'nearMiss', tick: 0, grade: 'whisker', gap: 0.1, side, x: 0, z: 100, obs: 'pine', speed: 24 });
  const stomp = (streak: number): Beat => ({ type: 'stomp', tick: 0, streak, late: false, title: '', lead: [], x: 0, z: 100, heading: 0, yetiHop: false });
  const release = (tier: 1 | 2 | 3, driftDir: number): Beat => ({ type: 'driftRelease', tick: 0, tier, x: 0, z: 100, heading: 0, driftDir });

  it('a whisker flinches the lens at least 12 cm away from the obstacle and rolls it away too', () => {
    // An obstacle on the +x side (screen right): the lens goes left and the horizon tips that way,
    // the sign a bump knocked left takes.
    const w = after([whisker(1)]);
    expect(w.right).toBeLessThanOrEqual(-0.12);
    expect(w.roll).toBeLessThan(-0.015);
    const bump = after([{ type: 'bump', tick: 0, side: -1, bank: false }]);
    expect(Math.sign(bump.roll)).toBe(Math.sign(w.roll));
    expect(Math.sign(bump.right)).toBe(Math.sign(w.right));
    const o = after([whisker(-1)]);
    expect(o.right).toBeGreaterThanOrEqual(0.12);
    expect(o.roll).toBeGreaterThan(0.015);
  });

  it("a max drift's release rolls the horizon harder than any stomp, toward the drift's side", () => {
    const r = after([release(3, 1)]);
    const one = after([stomp(1)]);
    const five = after([stomp(5)]);
    expect(Math.abs(r.roll)).toBeGreaterThan(Math.abs(one.roll));
    expect(Math.abs(r.roll)).toBeGreaterThan(Math.abs(five.roll));
    expect(r.roll).toBeGreaterThan(0.02);
    expect(after([release(3, -1)]).roll).toBeLessThan(-0.02);
    expect(r.shake).toBeGreaterThan(0.15);
    // Tier 1 and 2 releases keep only their kick.
    expect(after([release(2, 1)]).roll).toBe(0);
  });

  it("a stomp streak's shake grows with it, and from the third the horizon knocks, side to side", () => {
    expect(after([stomp(1)]).shake).toBeCloseTo(0.25, 5);
    expect(after([stomp(5)]).shake).toBeGreaterThan(after([stomp(1)]).shake);
    expect(after([stomp(9)]).shake).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(after([stomp(1)]).roll).toBe(0);
    expect(after([stomp(2)]).roll).toBe(0);
    const s3 = after([stomp(3)]).roll;
    const s4 = after([stomp(4)]).roll;
    const s5 = after([stomp(5)]).roll;
    expect(Math.sign(s3)).toBe(-Math.sign(s4));
    expect(Math.abs(s5)).toBeGreaterThan(Math.abs(s3));
    expect(Math.abs(s5)).toBeLessThanOrEqual(0.07);
  });

  it('under reduced motion nothing kicks, rolls, shakes or holds', () => {
    const feel = { ...IDLE_FEEL, reduced: true };
    // (The speed's FOV breathing stays: the same frames with no beat are the measure.)
    const calm = after([], feel);
    for (const list of [[whisker(1)], [release(3, 1)], [stomp(5)], [{ type: 'crash', tick: 0, cause: 'tree', stake: 0, orbitFrom: null } as Beat]]) {
      const r = after(list, feel);
      expect(r.right).toBe(0);
      expect(r.roll).toBe(0);
      expect(r.shake).toBe(0);
      expect(r.fov).toBeCloseTo(calm.fov, 9);
      expect(r.hold).toBe(0);
    }
  });
});
