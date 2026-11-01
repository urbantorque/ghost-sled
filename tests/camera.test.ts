import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ChaseCamera, crashPack } from '../src/render/camera';
import { CRASH_FREEZE_S, IDLE_FEEL, type Beat, type Feel } from '../src/game/beats';
import { emptyPose, type GhostPose } from '../src/game/ghosts';

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

// The ghost that passes your wreck: the crash orbit frames it with the wreck, and where the wreck slid
// far down the slope from where you fell, the lens stands on a tripod beside that ghost's line.
describe('crash pack framing', () => {
  const H = 720;
  /** A crash at `fell`, the wreck at wreckAt(i) and the passer's chest at ghostAt(i) each frame after
   *  the crash beat: per frame the lens, its angle round the wreck, and where the wreck and the ghost
   *  land on screen (NDC) with the ghost's height in pixels of a 720 px frame. */
  function run(wreckAt: (i: number) => Vector3, ghostAt: (i: number) => Vector3 | null, frames: number, feel: Feel = IDLE_FEEL, aspect = 16 / 9, fell = WRECK) {
    const cam = new ChaseCamera();
    cam.setAspect(aspect);
    cam.ground = () => 0;
    cam.beats([], feel);
    cam.mode = 'chase';
    for (let i = 0; i < 40; i++) cam.update({ pos: fell, dir: DOWN, speed: 24, steer: 0, airborne: false, boost: 0 }, 1 / 60);
    cam.mode = 'crash';
    cam.beats([{ type: 'crash', tick: 0, cause: 'tree', stake: 0, orbitFrom: Math.PI }], feel);
    const shots: { lens: Vector3; fov: number; angle: number; orbit: number; wreck: Vector3; ghost: Vector3 | null; px: number }[] = [];
    for (let i = 0; i < frames; i++) {
      const w = wreckAt(i);
      const g = ghostAt(i);
      cam.update({ pos: w, dir: DOWN, speed: 0, steer: 0, airborne: true, boost: 0, pack: g, fell }, 1 / 60);
      cam.beats([], feel);
      cam.camera.updateMatrixWorld();
      const p = cam.camera.position;
      const ndc = (v: Vector3) => v.clone().project(cam.camera);
      const px = g ? ((ndc(g.clone().setY(g.y + 0.75)).y - ndc(g.clone().setY(g.y - 0.8)).y) * H) / 2 : 0;
      const orbit = (cam as unknown as { orbitAngle: number }).orbitAngle;
      shots.push({ lens: p.clone(), fov: cam.camera.fov, angle: Math.atan2(p.x - w.x, p.z - w.z), orbit, wreck: ndc(w), ghost: g ? ndc(g) : null, px });
    }
    return shots;
  }
  const hold = Math.ceil(CRASH_FREEZE_S * 60) + 2;
  // A ghost riding straight down at 20 m/s, 3 m to the side of the wreck, from 30 m uphill of it.
  const lane = (x: number, from: number) => (i: number) => new Vector3(x, 0.8, from - i / 3);
  const still = () => WRECK;
  const inFrame = (v: Vector3, share: number) => Math.abs(v.x) <= share && Math.abs(v.y) <= share && v.z < 1;

  it('crashPack takes the live ghost nearest where you fell, from 25 m behind to 6 m past', () => {
    const pose = (x: number, z: number, done = false): GhostPose => ({ ...emptyPose(), x, y: 2, z, done });
    const out = new Vector3();
    const poses = new Map<number, GhostPose | null>([
      [1, pose(0, 70)],
      [2, pose(4, 95)],
      [3, pose(0.5, 99, true)],
      [4, pose(-1, 108)],
      [5, null],
    ]);
    // (Sim z 100 is where you fell; 70 m is past the window, the crashed one never counts.)
    expect(crashPack(poses, 0, 100, out)).toBe(out);
    expect(out.toArray()).toEqual([4, 2.8, -95]);
    expect(crashPack(new Map([[1, pose(0, 70)], [4, pose(0, 107)]]), 0, 100, out)).toBeNull();
  });

  it('holds the orbit and turns the look so the passer stays in frame with the wreck', () => {
    const shots = run(still, lane(-3, -70), 100);
    const none = run(still, () => null, 100);
    // The ghost crosses the line you fell on (plus the director's 0.8 m) on this frame.
    const at = Math.ceil((100.8 - 70) * 3);
    const s = shots[at];
    expect(s.ghost && inFrame(s.ghost, 0.9)).toBe(true);
    expect(inFrame(s.wreck, 0.7)).toBe(true);
    // The orbit stands still while the ghost rides past (it drifts on without one).
    expect(Math.abs(wrap(s.angle - shots[hold + 5].angle))).toBeLessThan(1e-6);
    expect(Math.abs(wrap(none[at].angle - none[hold + 5].angle))).toBeGreaterThan(0.05);
    // The long lens only ever narrows the orbit's own.
    expect(s.fov).toBeLessThanOrEqual(none[at].fov + 1e-9);
  });

  it('winds the drift back up when the pack clears, rather than at full speed in one frame', () => {
    // The ghost rides past and clears the window on frame `gone`.
    const gone = 100;
    const lanePast = lane(-3, -70);
    const shots = run(still, (i) => (i < gone ? lanePast(i) : null), gone + 90);
    const none = run(still, () => null, gone + 90);
    const step = (s: typeof shots, i: number) => Math.abs(wrap(s[i].orbit - s[i - 1].orbit));
    // The orbit's full drift per frame, as it runs with no ghost at all.
    const full = step(none, gone + 60);
    expect(full).toBeGreaterThan(1e-3);
    // Held still up to the frame the pack clears.
    expect(step(shots, gone - 1)).toBeLessThan(1e-9);
    // Then it eases: a sliver of the drift on the first frame, rising every frame, near full after a second.
    expect(step(shots, gone)).toBeLessThan(0.1 * full);
    for (let i = gone + 1; i < gone + 60; i++) expect(step(shots, i)).toBeGreaterThan(step(shots, i - 1));
    expect(step(shots, gone + 60)).toBeGreaterThan(0.9 * full);
    expect(step(shots, gone + 60)).toBeLessThanOrEqual(full + 1e-9);
  });

  it('keeps the wreck framed when it slid far from where you fell (the pack tripod is off)', () => {
    // You fell at z -100; the wreck slid 15 m on down the slope. The ghost rides 6 m to one side.
    const slid = (i: number) => new Vector3(0, 0, -100 - Math.min(15, i * 0.4));
    for (const aspect of [16 / 9, 390 / 844]) {
      const shots = run(slid, lane(-6, -72), 110, IDLE_FEEL, aspect);
      const at = Math.ceil((100.8 - 72) * 3);
      const s = shots[at];
      // The orbit rides on with the wreck (no cut to a still lens far up its line), the wreck in the
      // middle 70% of the frame as the ghost crosses.
      expect(s.lens.distanceTo(shots[hold + 2].lens)).toBeGreaterThan(1e-3);
      expect(inFrame(s.wreck, 0.7)).toBe(true);
    }
  });

  it('under reduced motion the crash orbit ignores the pack: the same frames as with none', () => {
    const feel = { ...IDLE_FEEL, reduced: true };
    const slid = (i: number) => new Vector3(0, 0, -100 - Math.min(15, i * 0.4));
    const a = run(slid, lane(-6, -72), 100, feel);
    const b = run(slid, () => null, 100, feel);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].lens.distanceTo(b[i].lens)).toBeLessThan(1e-9);
      expect(a[i].fov).toBe(b[i].fov);
    }
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

  it("a max drift's release kicks the lens at least as hard as a single stomp", () => {
    expect(after([release(3, 1)]).fov).toBeGreaterThanOrEqual(after([stomp(1)]).fov - 1e-9);
    expect(after([release(3, 1)]).fov).toBeGreaterThan(after([release(2, 1)]).fov);
  });

  it("from a full drift lean, a max drift's release knocks the horizon past level the other way", () => {
    for (const dir of [1, -1]) {
      const cam = chase();
      // Hold a full drift: the horizon leans by -driftDir, to ROLL_MAX.
      for (let i = 0; i < 60; i++) {
        cam.update({ pos: WRECK, dir: DOWN, speed: 24, steer: dir, airborne: false, boost: 0, drifting: true, driftDir: dir, slip: 0.7 }, 1 / 60);
        cam.beats([], IDLE_FEEL);
      }
      const lean = cam.rollNow;
      expect(lean * dir).toBeLessThan(-0.06);
      cam.beats([release(3, dir)], IDLE_FEEL);
      let peak = lean;
      for (let i = 0; i < 30; i++) {
        cam.update({ pos: WRECK, dir: DOWN, speed: 24, steer: 0, airborne: false, boost: 0 }, 1 / 60);
        cam.beats([], IDLE_FEEL);
        if (cam.rollNow * dir > peak * dir) peak = cam.rollNow;
        expect(Math.abs(cam.rollNow)).toBeLessThanOrEqual(0.07 + 1e-9);
      }
      // Past level toward the drift's side, not just flattened, and a swing of more than 5 degrees.
      expect(peak * dir).toBeGreaterThan(0.025);
      expect((peak - lean) * dir).toBeGreaterThan(0.09);
    }
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

// The camera and motion round: the big-air vista, the section entrance's lift, the rumble at speed.
describe('big-air vista and section lift', () => {
  const SLOPE = 0.3;
  /** A plain downhill (three.js z falls as the course runs on), with the corridor's middle at x = 0. */
  function chase(feel: Feel = IDLE_FEEL): ChaseCamera {
    const cam = new ChaseCamera();
    cam.setAspect(16 / 9);
    cam.ground = (_x, z) => z * SLOPE;
    cam.corridor = () => ({ x: 0, hw: 12 });
    cam.beats([], feel);
    cam.mode = 'chase';
    return cam;
  }
  const at = (z: number, up = 0) => new Vector3(4, z * SLOPE + up, z);
  /** Rides 1 s on the snow, then a flight of `flight` seconds (a ballistic arc over the slope);
   *  returns the vista's weight and the lens's height over the rider each frame of the flight. */
  function fly(cam: ChaseCamera, flight: number, feel: Feel = IDLE_FEEL) {
    const v = 22;
    let z = -100;
    for (let i = 0; i < 60; i++) {
      z -= v / 60;
      cam.beats([], feel);
      cam.update({ pos: at(z), dir: DOWN, speed: v, steer: 0, airborne: false, boost: 0, airTime: 0, airLeft: Infinity }, 1 / 60);
    }
    const out: { vista: number; lift: number; left: number }[] = [];
    const n = Math.round(flight * 60);
    for (let i = 1; i < n; i++) {
      z -= v / 60;
      const t = i / 60;
      const h = 4.9 * t * (flight - t);
      const pos = at(z, h);
      cam.beats([], feel);
      cam.update({ pos, dir: DOWN, speed: v, steer: 0, airborne: true, boost: 0, airTime: t, airLeft: flight - t }, 1 / 60);
      out.push({ vista: cam.vistaNow, lift: cam.camera.position.y - pos.y, left: flight - t });
    }
    return out;
  }

  it('a long flight eases the lens out and up, and has it home again by touchdown', () => {
    const cam = chase();
    const f = fly(cam, 2.4);
    const peak = Math.max(...f.map((q) => q.vista));
    expect(peak).toBeGreaterThan(0.85);
    // Home for the stomp window: nearly all the way back with 0.15 s left.
    const late = f.filter((q) => q.left <= 0.15);
    for (const q of late) expect(q.vista).toBeLessThan(0.12);
    // Mid-flight the lens stands well over the rider (the chase rides about a metre over it).
    const mid = f[Math.floor(f.length / 2)];
    expect(mid.lift).toBeGreaterThan(2);
  });

  it('a short hop never opens the vista', () => {
    const f = fly(chase(), 0.8);
    expect(Math.max(...f.map((q) => q.vista))).toBeLessThan(0.02);
  });

  it('under reduced motion the vista and the section lift stay off', () => {
    const feel = { ...IDLE_FEEL, reduced: true };
    const cam = chase(feel);
    const f = fly(cam, 2.4, feel);
    expect(Math.max(...f.map((q) => q.vista))).toBe(0);
    let z0 = 0;
    cam.section = () => ({ z0, kind: 'chute' });
    for (let i = 0; i < 30; i++) {
      if (i === 10) z0 = 400;
      cam.beats([], feel);
      cam.update({ pos: at(-200 - i), dir: DOWN, speed: 22, steer: 0, airborne: false, boost: 0 }, 1 / 60);
      expect(cam.riseNow).toBe(0);
    }
  });

  it('a new section coming into reach lifts the lens briefly, a cruise does not', () => {
    for (const kind of ['bowl', 'cruise']) {
      const cam = chase();
      let z0 = 0;
      cam.section = () => ({ z0, kind });
      let peak = 0;
      for (let i = 0; i < 240; i++) {
        if (i === 30) z0 = 400;
        cam.beats([], IDLE_FEEL);
        cam.update({ pos: at(-200 - i * 0.4), dir: DOWN, speed: 24, steer: 0, airborne: false, boost: 0 }, 1 / 60);
        peak = Math.max(peak, cam.riseNow);
      }
      if (kind === 'cruise') expect(peak).toBe(0);
      else expect(peak).toBeGreaterThan(0.9);
      // ...and it has settled again by the end.
      expect(cam.riseNow).toBe(0);
    }
  });

  it("the rumble at top speed rides beside the shake: a stomp's shake keeps its size", () => {
    const cam = chase();
    for (let i = 0; i < 60; i++) {
      cam.beats([], IDLE_FEEL);
      cam.update({ pos: at(-100 - i * 0.6), dir: DOWN, speed: 36, steer: 0, airborne: false, boost: 0 }, 1 / 60);
    }
    expect(cam.shakeNow).toBe(0);
    cam.beats([{ type: 'stomp', tick: 0, streak: 1, late: false, title: '', lead: [], x: 0, z: 100, heading: 0, yetiHop: false }], IDLE_FEEL);
    expect(cam.shakeNow).toBeCloseTo(0.25, 5);
  });
});
