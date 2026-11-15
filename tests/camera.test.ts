import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ChaseCamera, crashPack } from '../src/render/camera';
import { visualGround } from '../src/render/ground';
import { courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { CRASH_FREEZE_S, IDLE_FEEL, type Beat, type Feel } from '../src/game/beats';
import { emptyPose, type GhostPose } from '../src/game/ghosts';
import { Director, HERO_IN_MIN, flightSeconds } from '../src/game/director';
import { REVEALS, WHIP_BEFORE_LIP, planShots, type Shot } from '../src/game/shots';
import { APEX_CURVE, APEX_S, sampleCurve } from '../src/game/timescale';
import { cine } from '../src/render/cine';
import { fallCuts } from '../src/render/moments';
import { TOP_SPEED, blurK } from '../src/render/speedfeel';
import { ChaosEvent, Mood } from '../src/sim/chaos';
import { Sim } from '../src/sim/sim';

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

// A wall's rock is drawn past where the sim's ground stops, so `ground` cannot see it. A crash lens must
// not stand in it, or behind it with the wreck on the far side.
describe('crash lenses and a wall of rock', () => {
  const R = 5; // The rock stands past x = R, drawn, where the ground stays flat.
  const STILL = { dir: DOWN, speed: 0, steer: 0, airborne: true, boost: 0 };

  function lens(aspect: number, surface: ChaseCamera['surface'], wreck: Vector3, orbitFrom: number | null, ground: ChaseCamera['ground'] = () => 0, corridor?: ChaseCamera['corridor']) {
    const cam = new ChaseCamera();
    cam.setAspect(aspect);
    cam.ground = ground;
    cam.surface = surface;
    if (corridor) cam.corridor = corridor;
    cam.beats([], IDLE_FEEL);
    cam.mode = 'chase';
    for (let i = 0; i < 40; i++) cam.update({ pos: wreck, dir: DOWN, speed: 24, steer: 0, airborne: false, boost: 0 }, 1 / 60);
    cam.mode = 'crash';
    cam.beats([{ type: 'crash', tick: 0, cause: 'landing', stake: 0, orbitFrom }], IDLE_FEEL);
    const orbit: Vector3[] = [];
    const frames = Math.ceil(CRASH_FREEZE_S * 60) + 400;
    for (let i = 0; i < frames; i++) {
      cam.update({ pos: wreck, ...STILL }, 1 / 60);
      orbit.push(cam.camera.position.clone());
    }
    cam.mode = 'hero';
    for (let i = 0; i < 300; i++) cam.update({ pos: wreck, ...STILL }, 1 / 60);
    return { orbit, hero: cam.camera.position.clone() };
  }

  const WRECK_AT_WALL = new Vector3(3.5, 0.3, -100);
  const wall = (x: number) => (x > R ? 16 : 0);

  it('the orbit turns back at the wall, whichever way it was drifting', () => {
    for (const from of [null, Math.PI, 2.2, -2.2]) {
      const { orbit } = lens(16 / 9, (x) => wall(x), WRECK_AT_WALL, from);
      for (const p of orbit) expect(p.x).toBeLessThan(R);
    }
  });

  it('the orbit still moves: a wall bounds its drift, it does not freeze it', () => {
    const { orbit } = lens(16 / 9, (x) => wall(x), WRECK_AT_WALL, null);
    const tail = orbit.slice(-300);
    const span = Math.max(...tail.map((p) => p.x)) - Math.min(...tail.map((p) => p.x));
    expect(span).toBeGreaterThan(1);
  });

  it('the hero shot stands clear of the rock, wide and tall', () => {
    for (const aspect of [16 / 9, 9 / 19]) {
      const { hero } = lens(aspect, (x) => wall(x), WRECK_AT_WALL, null);
      expect(hero.x).toBeLessThan(R);
    }
  });

  it('with rock on both sides both lenses keep to the gap between them', () => {
    // A slot 8 m wide, the wreck against one side.
    const slot = (x: number) => (Math.abs(x) > 4 ? 16 : 0);
    const { hero, orbit } = lens(16 / 9, slot, new Vector3(2.8, 0.3, -100), Math.PI);
    expect(Math.abs(hero.x)).toBeLessThan(4);
    for (const p of orbit) expect(Math.abs(p.x)).toBeLessThan(4);
  });

  it('walled in on every side the hero shot looks down from above the rock, never from inside it', () => {
    const well = (x: number, z: number) => (Math.hypot(x, z + 100) > 1.5 ? 12 : 0);
    const { hero } = lens(16 / 9, well, new Vector3(0, 0.3, -100), null);
    expect(hero.y).toBeGreaterThan(well(hero.x, hero.z));
  });

  it('with no rock the crash lenses stand exactly where they always did', () => {
    const plain = lens(16 / 9, null, WRECK_AT_WALL, Math.PI);
    const same = lens(16 / 9, () => 0, WRECK_AT_WALL, Math.PI);
    expect(same.hero.distanceTo(plain.hero)).toBeLessThan(1e-6);
    expect(same.orbit[same.orbit.length - 1].distanceTo(plain.orbit[plain.orbit.length - 1])).toBeLessThan(1e-6);
  });

  it('holds on a real ravine, against the surface the player sees', () => {
    const c = courseFor(MOUNTAINS[1].seed);
    let z0 = 0;
    for (let z = 0; z < c.finishZ && !z0; z += 10) if (c.section(z).kind === 'ravine' && c.shapeAt(z).wall >= 12) z0 = z;
    expect(z0).toBeGreaterThan(0);
    const cor = { x: 0, hw: 0 };
    const corridor = (z: number) => {
      cor.x = c.centerX(-z);
      cor.hw = c.halfWidth(-z);
      return cor;
    };
    for (let z = z0 + 10; z < z0 + 110; z += 25) {
      for (const side of [-1, 1]) {
        const x = c.centerX(z) + side * (c.halfWidth(z) + 3);
        const w = new Vector3(x, c.ground(x, z) + 0.3, -z);
        const shot = lens(16 / 9, (px, pz) => visualGround(c, px, -pz), w, Math.PI, (px, pz) => c.ground(px, -pz), corridor);
        const clear = (p: Vector3) => p.y > visualGround(c, p.x, -p.z);
        expect(clear(shot.hero)).toBe(true);
        for (const p of shot.orbit) expect(clear(p)).toBe(true);
      }
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

describe('overlook lean', () => {
  const SLOPE = 0.3;
  function chase(feel: Feel = IDLE_FEEL): ChaseCamera {
    const cam = new ChaseCamera();
    cam.setAspect(16 / 9);
    cam.ground = (_x, z) => z * SLOPE;
    cam.corridor = () => ({ x: 0, hw: 12 });
    cam.beats([], feel);
    cam.mode = 'chase';
    return cam;
  }
  /** Rides `secs` seconds down a plain slope with the overlook signal `open` from `from` seconds on;
   *  returns the look's heading (+ toward +x), the roll and the reveal each frame. */
  function ride(cam: ChaseCamera, open: number, secs: number, feel: Feel = IDLE_FEEL, from = 0.5) {
    const v = 22;
    let z = -100;
    const out: { yaw: number; roll: number; reveal: number; open: number }[] = [];
    const dir = new Vector3();
    for (let i = 0; i < secs * 60; i++) {
      z -= v / 60;
      cam.beats([], feel);
      cam.update({ pos: new Vector3(0, z * SLOPE, z), dir: DOWN, speed: v, steer: 0, airborne: false, boost: 0, open: i / 60 >= from ? open : 0 }, 1 / 60);
      cam.camera.getWorldDirection(dir);
      out.push({ yaw: Math.atan2(dir.x, -dir.z), roll: cam.rollNow, reveal: cam.revealNow, open: cam.openNow });
    }
    return out;
  }

  it('turns the look and leans the horizon toward the open side, keeping the run ahead in frame', () => {
    const right = ride(chase(), 1, 6);
    const left = ride(chase(), -1, 6);
    const none = ride(chase(), 0, 6);
    const end = right.length - 1;
    expect(right[end].yaw - none[end].yaw).toBeGreaterThan(0.08);
    expect(right[end].yaw - none[end].yaw).toBeLessThan(0.2);
    expect(left[end].yaw - none[end].yaw).toBeLessThan(-0.08);
    // The horizon dips toward the drop (as a carve toward it would), within the roll's limit.
    expect(right[end].roll).toBeLessThan(-0.015);
    expect(left[end].roll).toBeGreaterThan(0.015);
    for (const q of right) expect(Math.abs(q.roll)).toBeLessThanOrEqual(0.07 + 1e-9);
  });

  it('opens with a reveal once, then settles to the lean', () => {
    const f = ride(chase(), 1, 6);
    const peak = Math.max(...f.map((q) => q.reveal));
    expect(peak).toBeGreaterThan(0.9);
    expect(f[f.length - 1].reveal).toBe(0);
    // Still open, no second reveal.
    expect(f.slice(Math.round(4.5 * 60)).every((q) => q.reveal === 0)).toBe(true);
  });

  it('under reduced motion nothing turns, leans or reveals', () => {
    const feel = { ...IDLE_FEEL, reduced: true };
    const open = ride(chase(feel), 1, 4, feel);
    const none = ride(chase(feel), 0, 4, feel);
    for (let i = 0; i < open.length; i++) {
      expect(open[i].yaw).toBeCloseTo(none[i].yaw, 9);
      expect(open[i].roll).toBe(0);
      expect(open[i].reveal).toBe(0);
    }
  });
});

// Round 7's directed shots: where they are (game/shots.ts), what the lens does for each, what it writes
// for the pipeline (cine.ts), and that none of it reaches the sim or survives reduced motion as motion.

describe('directed shots: the plan', () => {
  it('gives every mountain a held wide on its tallest leap, a street to track down and a whip onto its reveal', () => {
    for (const m of MOUNTAINS) {
      const c = courseFor(m.seed);
      const shots = planShots(c);
      const wide = shots.find((s) => s.kind === 'wide')!;
      const track = shots.find((s) => s.kind === 'track')!;
      const whip = shots.find((s) => s.kind === 'whip')!;
      expect(wide && track && whip, m.id).toBeTruthy();
      const tallest = Math.max(...c.leaps.map((l) => l.height));
      expect(c.leaps.find((l) => l.z === wide.at)!.height, m.id).toBe(tallest);
      expect(c.section(track.z0).kind, m.id).toBe('street');
      expect(c.section(track.z1).kind, m.id).toBe('street');
      // The reveal is the place ART.md 15 names: a leap's lip coming up, or (Frostfang) the cavern's far mouth.
      const sec = c.section(whip.at);
      expect(sec.kind, m.id).toBe(m.id === 'frostfang' ? 'tunnel' : 'leap');
      if (sec.kind === 'leap') {
        const lip = c.leaps.find((l) => l.z >= sec.z0 && l.z < sec.z1)!;
        expect(lip.z - whip.at, m.id).toBeCloseTo(WHIP_BEFORE_LIP, 6);
      }
      for (const s of shots) expect(s.z1, `${m.id} ${s.kind}`).toBeGreaterThan(s.z0);
    }
  });

  it('names a reveal for each of the five mountains, and a Daily still gets one', () => {
    expect(Object.keys(REVEALS).sort()).toEqual(['ember', 'frostfang', 'lanternfall', 'pinecrest', 'sakura']);
    const daily = planShots(courseFor(0x1234567));
    expect(daily.filter((s) => s.kind === 'whip').length).toBeLessThanOrEqual(1);
    expect(daily.filter((s) => s.kind === 'wide').length).toBe(1);
  });

  it('is a pure function of the course', () => {
    const seed = MOUNTAINS[2].seed;
    expect(planShots(courseFor(seed))).toEqual(planShots(courseFor(seed)));
  });
});

describe('directed shots: the lens', () => {
  const SLOPE = 0.3;
  const WIDE: Shot = { kind: 'wide', key: 'bigleap', name: '', z0: 150, z1: 400, at: 180 };
  const TRACK: Shot = { kind: 'track', key: 'street', name: '', z0: 150, z1: 270, at: 150 };
  const WHIP: Shot = { kind: 'whip', key: 'reveal', name: '', z0: 110, z1: 225, at: 180 };
  function chase(shots: Shot[], feel: Feel = IDLE_FEEL, aspect = 16 / 9): ChaseCamera {
    const cam = new ChaseCamera();
    cam.setAspect(aspect);
    cam.ground = (_x, z) => z * SLOPE;
    cam.corridor = () => ({ x: 0, hw: 12 });
    cam.shots = shots;
    cam.resetFeel();
    cam.beats([], feel);
    cam.mode = 'chase';
    return cam;
  }
  const at = (z: number, up = 0) => new Vector3(4, z * SLOPE + up, z);
  const yawOf = (cam: ChaseCamera) => {
    const d = new Vector3();
    cam.camera.getWorldDirection(d);
    return Math.atan2(d.x, -d.z);
  };
  /** Rides the snow from sim z 100 to the lip at 180, then flies `flight` seconds. `apexAt`: the
   *  second of the flight the director's hero frame starts (none when negative). */
  function leap(cam: ChaseCamera, flight: number, feel: Feel = IDLE_FEEL, apexAt = -1) {
    const v = 30;
    let z = -100;
    while (z > -180) {
      z -= v / 60;
      cam.beats([], feel);
      cam.update({ pos: at(z), dir: DOWN, speed: v, steer: 0, airborne: false, boost: 0, airTime: 0, airLeft: Infinity }, 1 / 60);
    }
    const out: { t: number; left: number; wide: number; hero: number; back: number; fov: number; box: number; dof: number; slow: number; focus: number; rider: Vector3; lens: Vector3; ndc: Vector3 }[] = [];
    const n = Math.round(flight * 60);
    let slowLeft = 0;
    for (let i = 1; i < n; i++) {
      z -= v / 60;
      const t = i / 60;
      const pos = at(z, 4.9 * t * (flight - t));
      const beats: Beat[] = [];
      if (apexAt >= 0 && i === Math.round(apexAt * 60)) {
        beats.push({ type: 'heroFrame', tick: 0, phase: 'apex', key: 'bigleap', inS: 0, secs: APEX_S });
        slowLeft = APEX_S;
      }
      // The render clock slows through the frame (never under reduced motion); real time does not.
      const scale = slowLeft > 0 && !feel.reduced ? sampleCurve(APEX_CURVE, APEX_S - slowLeft) : 1;
      slowLeft = Math.max(0, slowLeft - 1 / 60);
      const f = { ...feel, timeRender: scale };
      cam.beats(beats, f);
      cam.update({ pos, dir: DOWN, speed: v, steer: 0, airborne: true, boost: 0, airTime: t, airLeft: flight - t }, scale / 60);
      cam.camera.updateMatrixWorld();
      out.push({ t, left: flight - t, ndc: pos.clone().project(cam.camera), wide: cam.wideNow, hero: cam.heroNow, back: Math.hypot(cam.camera.position.x - pos.x, cam.camera.position.z - pos.z), fov: cam.camera.fov, box: cine.letterbox, dof: cine.dof, slow: cine.slow, focus: cine.focus, rider: pos.clone(), lens: cam.camera.position.clone() });
    }
    return out;
  }

  it('holds wider than the vista over the biggest leap, under a letterbox, and is home by touchdown', () => {
    const plain = leap(chase([]), 2.6);
    const wide = leap(chase([WIDE]), 2.6);
    const mid = Math.round(1.1 * 60);
    expect(wide[mid].wide).toBeGreaterThan(0.85);
    // (The review loop brought the wide in from 3 m to 0.9 m past the vista, so the rider is not a twelfth
    // of the frame at the apex: it still stands well back of the vista, under its letterbox.)
    expect(wide[mid].back - plain[mid].back).toBeGreaterThan(1.2);
    expect(wide[mid].lens.y - plain[mid].lens.y).toBeGreaterThan(1);
    expect(wide[mid].box).toBeGreaterThan(0.6);
    expect(plain[mid].box).toBe(0);
    // Deep focus: a wide blurs nothing.
    expect(wide[mid].dof).toBe(0);
    for (const q of wide.filter((p) => p.left <= 0.15)) expect(q.wide).toBeLessThan(0.12);
  });

  it('keeps the rider in the frame all through the wide and the hero frame', () => {
    const f = leap(chase([WIDE]), 2.6, IDLE_FEEL, 1.05);
    for (const q of f) {
      expect(Math.abs(q.ndc.x)).toBeLessThan(0.7);
      expect(q.ndc.y).toBeGreaterThan(-0.85);
      expect(q.ndc.y).toBeLessThan(0.6);
    }
  });

  it('pushes in on a longer lens for the slow hero frame, with depth of field on the rider, and lets go', () => {
    const wide = leap(chase([WIDE]), 2.6);
    const hero = leap(chase([WIDE]), 2.6, IDLE_FEEL, 1.05);
    const peak = Math.round(1.5 * 60);
    expect(hero[peak].hero).toBeGreaterThan(0.9);
    // Closer and on a longer lens: the rider at least half as big again as in the wide.
    const size = (q: { back: number; fov: number; lens: Vector3; rider: Vector3 }) => 1 / (q.lens.distanceTo(q.rider) * Math.tan((q.fov * Math.PI) / 360));
    expect(size(hero[peak]) / size(wide[peak])).toBeGreaterThan(1.5);
    expect(hero[peak].dof).toBeGreaterThan(0.9);
    expect(hero[peak].box).toBeGreaterThan(0.9);
    expect(hero[peak].slow).toBeLessThan(0.4);
    // The focus rides the rider as the lens closes (within a pace of it mid-push).
    expect(Math.abs(hero[peak].focus - hero[peak].lens.distanceTo(hero[peak].rider))).toBeLessThan(0.8);
    // The follow runs on real time: the slowed render clock never leaves the lens behind the sled.
    expect(hero[peak].lens.distanceTo(hero[peak].rider)).toBeLessThan(wide[peak].lens.distanceTo(wide[peak].rider));
    // Over well before touchdown: the landing is judged from the usual frame, at full speed.
    for (const q of hero.filter((p) => p.left <= 0.3)) {
      expect(q.hero).toBeLessThan(0.05);
      expect(q.slow).toBe(1);
      expect(q.dof).toBeLessThan(0.15);
    }
  });

  it('a hero frame is the air only: touching down ends it at once', () => {
    const cam = chase([WIDE]);
    leap(cam, 1.4, IDLE_FEEL, 1.0);
    for (let i = 0; i < 20; i++) {
      cam.beats([], IDLE_FEEL);
      cam.update({ pos: at(-300 - i * 0.5), dir: DOWN, speed: 30, steer: 0, airborne: false, boost: 0 }, 1 / 60);
    }
    expect(cam.heroNow).toBeLessThan(0.01);
    expect(cine.slow).toBe(1);
  });

  it('under reduced motion the lens never moves for the wide or the hero frame, nothing slows, and the beat still shows', () => {
    const feel = { ...IDLE_FEEL, reduced: true };
    const plain = leap(chase([], feel), 2.6, feel);
    const shot = leap(chase([WIDE], feel), 2.6, feel, 1.05);
    for (let i = 0; i < plain.length; i++) {
      expect(shot[i].lens.distanceTo(plain[i].lens)).toBeLessThan(1e-9);
      expect(shot[i].fov).toBeCloseTo(plain[i].fov, 9);
      expect(shot[i].wide).toBe(0);
      expect(shot[i].slow).toBe(1);
    }
    const peak = Math.round(1.5 * 60);
    expect(shot[peak].box).toBeGreaterThan(0.9);
    expect(shot[peak].dof).toBeGreaterThan(0.9);
    expect(plain[peak].box).toBe(0);
  });

  /** Rides the snow from sim z 100 for `metres` at `v`; returns the look's heading and the cine state each frame. */
  function ride(cam: ChaseCamera, metres: number, feel: Feel = IDLE_FEEL, v = 30) {
    let z = -100;
    const out: { z: number; yaw: number; track: number; whip: number; blur: number; box: number; dof: number; up: number; side: number; fov: number }[] = [];
    while (z > -100 - metres) {
      z -= v / 60;
      const pos = at(z);
      cam.beats([], feel);
      cam.update({ pos, dir: DOWN, speed: v, steer: 0, airborne: false, boost: 0 }, 1 / 60);
      out.push({ z: -z, yaw: yawOf(cam), track: cam.trackNow, whip: cam.whipNow, blur: cine.motionBlur, box: cine.letterbox, dof: cine.dof, up: cam.camera.position.y - pos.y, side: cam.camera.position.x - pos.x, fov: cam.camera.fov });
    }
    return out;
  }

  it('drops low and steps toward the middle of a street, then lets go past it', () => {
    const plain = ride(chase([]), 260);
    const shot = ride(chase([TRACK]), 260);
    const i = shot.findIndex((q) => q.z >= 255);
    expect(shot[i].track).toBeGreaterThan(0.9);
    expect(plain[i].up - shot[i].up).toBeGreaterThan(0.25);
    // The rider is at x = 4 and the street's middle at 0: the lens steps toward -x.
    expect(shot[i].side - plain[i].side).toBeLessThan(-0.8);
    expect(shot[i].fov).toBeLessThan(plain[i].fov - 2);
    expect(shot[i].box).toBeGreaterThan(0.3);
    expect(shot[i].dof).toBeGreaterThan(0.2);
    expect(shot[i].dof).toBeLessThan(0.4);
    // Never under the floor the chase keeps over the sled.
    for (const q of shot) expect(q.up).toBeGreaterThan(0.79);
    const end = shot[shot.length - 1];
    expect(end.track).toBeLessThan(0.1);
    expect(end.box).toBeLessThan(0.1);
  });

  it('whips onto the reveal once: a drift off the road, a snap back across it, a settle', () => {
    const plain = ride(chase([]), 200);
    const shot = ride(chase([WHIP]), 200);
    const off = shot.map((q, i) => q.yaw - plain[i].yaw);
    const before = shot.findIndex((q) => q.z >= 179);
    // The rider is right of the middle, so the pan travels left (-) and the drift before it goes right.
    expect(off[before]).toBeGreaterThan(0.15);
    expect(Math.max(...off.map(Math.abs))).toBeLessThan(0.25);
    const after = shot.findIndex((q) => q.z >= 180 + 30 * 0.3);
    expect(off[after]).toBeLessThan(-0.02);
    // The snap is quick and smears the frame; it is the only time the blur stands at full.
    const fastest = Math.max(...off.slice(1).map((y, i) => Math.abs(y - off[i]) * 60));
    expect(fastest).toBeGreaterThan(1.2);
    expect(Math.max(...shot.map((q) => q.blur))).toBeGreaterThan(0.95);
    expect(Math.max(...plain.map((q) => q.blur))).toBeLessThan(0.6);
    const end = shot.length - 1;
    expect(Math.abs(off[end])).toBeLessThan(0.005);
    expect(shot[end].whip).toBe(0);
    expect(shot[end].blur).toBeCloseTo(plain[end].blur, 3);
    // The road stays on the screen: the look never leaves it by more than the lens sees to one side.
    const halfW = Math.atan(Math.tan((62 * Math.PI) / 360) * (16 / 9));
    for (const y of off) expect(Math.abs(y)).toBeLessThan(halfW * 0.5);
  });

  it('a phone whips half as far', () => {
    const plain = ride(chase([], IDLE_FEEL, 390 / 844), 200);
    const shot = ride(chase([WHIP], IDLE_FEEL, 390 / 844), 200);
    const peak = Math.max(...shot.map((q, i) => Math.abs(q.yaw - plain[i].yaw)));
    expect(peak).toBeGreaterThan(0.06);
    expect(peak).toBeLessThan(0.125);
  });

  it('under reduced motion nothing whips or tracks: the same lens as with no shots, and the street keeps its letterbox', () => {
    const feel = { ...IDLE_FEEL, reduced: true };
    const plain = ride(chase([], feel), 200, feel);
    const shot = ride(chase([WHIP, TRACK], feel), 200, feel);
    for (let i = 0; i < plain.length; i++) {
      expect(shot[i].yaw).toBeCloseTo(plain[i].yaw, 9);
      expect(shot[i].up).toBeCloseTo(plain[i].up, 9);
      expect(shot[i].side).toBeCloseTo(plain[i].side, 9);
      expect(shot[i].whip).toBe(0);
    }
    expect(Math.max(...shot.map((q) => q.box))).toBeGreaterThan(0.3);
    // Speed's blur is halved, as the streaks are, and nothing spikes it.
    expect(Math.max(...shot.map((q) => q.blur))).toBeLessThan(0.3);
  });

  it('writes motion blur from the speed curve: none at a crawl, a third at 28 m/s, all of it only at the cap', () => {
    expect(blurK(15)).toBe(0);
    expect(blurK(28)).toBeGreaterThan(0.3);
    expect(blurK(28)).toBeLessThan(0.4);
    expect(blurK(TOP_SPEED)).toBeCloseTo(1, 6);
    expect(blurK(60)).toBeCloseTo(1, 6);
    let last = -1;
    for (let v = 0; v <= TOP_SPEED; v += 0.5) {
      expect(blurK(v)).toBeGreaterThanOrEqual(last);
      last = blurK(v);
    }
    expect(blurK(46) - blurK(44)).toBeGreaterThan(0);
    for (const v of [12, 28, 46]) {
      const f = ride(chase([]), 150, IDLE_FEEL, v);
      expect(f[f.length - 1].blur).toBeCloseTo(blurK(v), 2);
    }
    // Off the chase it goes: a results frame is a still.
    const cam = chase([]);
    ride(cam, 60, IDLE_FEEL, 40);
    cam.mode = 'hero';
    for (let i = 0; i < 90; i++) cam.update({ pos: at(-170), dir: DOWN, speed: 0, steer: 0, airborne: false, boost: 0 }, 1 / 60);
    expect(cine.motionBlur).toBe(0);
    expect(cine.dof).toBeGreaterThan(0.5);
  });
});

describe("the fall's phases", () => {
  it("cuts the picture's fall where the sim's phases change, and keeps its own cuts without them", () => {
    // The feel lane's fall: 42 ticks falling, 18 down, 30 up.
    const cuts = fallCuts({ FALL_TICKS: 42, DOWN_TICKS: 18, TUMBLE_TICKS: 90 })!;
    expect(cuts[0]).toBeCloseTo(42 / 90, 9);
    expect(cuts[1]).toBeCloseTo(60 / 90, 9);
    expect(fallCuts({ TUMBLE_TICKS: 66 })).toBeUndefined();
    expect(fallCuts({ FALL_TICKS: 60, DOWN_TICKS: 30, TUMBLE_TICKS: 90 })).toBeUndefined();
  });
});

describe('the slow hero frame: the director', () => {
  /** Rides the safe line down a mountain with the director watching; every heroFrame beat with its tick,
   *  the least render scale seen, and whether the sim's feed was ever scaled inside the frame. */
  function watch(seed: number, reduced: boolean) {
    const sim = new Sim({ seed, chaos: { mood: 0, event: 0, seed: 0x1234 }, sled: 0 });
    const d = new Director(() => reduced);
    d.beginRun({ mood: Mood.None, event: ChaosEvent.None, triggerZ: Infinity, hasReveal: false, revealLeaveS: 0, bestDistAtStart: 0, bestScoreAtStart: 0, bestComboAtStart: 0, grudgeAtStart: null, friend: null, lifetimePassed: 0, unlockLadder: [], missionsCrossed: () => [] });
    const c = sim.course;
    const beats: { tick: number; phase: string; inS: number; secs: number; z: number; grounded: boolean }[] = [];
    let slowest = 1;
    let feedInFrame = 1;
    let inFrame = false;
    while (!sim.finished && !sim.s.crashed && sim.tick < 300 * 60) {
      const s = sim.s;
      const look = s.z + 4 + s.speed * 0.35;
      const err = Math.atan2(c.safeX(s.z + 20) - s.x, look - s.z) - s.velHeading;
      sim.step(Math.max(0, Math.min(8, Math.round(4 + err * 14))));
      d.time.step(1 / 60);
      const out = d.step({ phase: 'run', dt: 1 / 60, sim, events: sim.events.map((e) => ({ tick: sim.tick, e })), race: [], tracks: [], poses: new Map(), standings: { next: null, rank: 1, of: 1 }, passedThisRun: 0, settledPassed: 0, timeToLand: Infinity, airTicks: sim.s.airTicks, reduced });
      sim.events.length = 0;
      for (const b of out.beats) {
        if (b.type !== 'heroFrame') continue;
        beats.push({ tick: b.tick, phase: b.phase, inS: b.inS, secs: b.secs, z: sim.s.z, grounded: sim.s.grounded });
        inFrame = b.phase === 'apex';
      }
      if (inFrame) {
        slowest = Math.min(slowest, out.feel.timeRender);
        feedInFrame = Math.min(feedInFrame, out.feel.timeFeed);
      }
    }
    return { beats, slowest, feedInFrame, sim };
  }

  it('names the frame off the biggest lip, starts it when it said it would, and only ever slows the picture', () => {
    for (const m of [MOUNTAINS[0], MOUNTAINS[3]]) {
      const wide = planShots(courseFor(m.seed)).find((s) => s.kind === 'wide')!;
      const r = watch(m.seed, false);
      expect(r.beats.map((b) => b.phase), m.id).toEqual(['lip', 'apex', 'out']);
      const [lip, apex, out] = r.beats;
      expect(lip.z, m.id).toBeGreaterThan(wide.at - 2);
      expect(lip.z, m.id).toBeLessThan(wide.at + 14);
      expect(lip.inS, m.id).toBeGreaterThanOrEqual(HERO_IN_MIN);
      expect(lip.secs).toBe(APEX_S);
      // Music can count on it: the frame starts inS seconds of sim time after the lip beat.
      expect(apex.tick - lip.tick, m.id).toBe(Math.round(lip.inS * 60));
      expect(apex.grounded, m.id).toBe(false);
      expect(out.tick - apex.tick, m.id).toBe(Math.round(APEX_S * 60));
      // Still in the air when it lets go: the landing is flown at full speed.
      expect(out.grounded, m.id).toBe(false);
      expect(r.slowest, m.id).toBeLessThan(0.35);
      expect(r.feedInFrame, m.id).toBe(1);
    }
  }, 120_000);

  it('under reduced motion the same beats go out on the same ticks and nothing slows', () => {
    const seed = MOUNTAINS[3].seed;
    const a = watch(seed, false);
    const b = watch(seed, true);
    expect(b.beats).toEqual(a.beats);
    expect(b.slowest).toBe(1);
    // The sim never knew: the same run either way.
    expect(b.sim.tick).toBe(a.sim.tick);
    expect(b.sim.s.z).toBe(a.sim.s.z);
    expect(b.sim.score).toBe(a.sim.score);
  }, 120_000);

  it('marches a flight over the real ground, as the landing ring does', () => {
    const sim = new Sim({ seed: MOUNTAINS[0].seed, chaos: { mood: 0, event: 0, seed: 0x1234 }, sled: 0 });
    expect(flightSeconds(sim)).toBe(0);
    const c = sim.course;
    let predicted = -1;
    let took = 0;
    while (sim.tick < 120 * 60 && !sim.s.crashed) {
      const s = sim.s;
      const look = s.z + 4 + s.speed * 0.35;
      const err = Math.atan2(c.safeX(s.z + 20) - s.x, look - s.z) - s.velHeading;
      const was = s.grounded;
      sim.step(Math.max(0, Math.min(8, Math.round(4 + err * 14))));
      if (predicted < 0 && was && !sim.s.grounded && sim.s.z > c.leaps[0].z - 2) predicted = flightSeconds(sim);
      else if (predicted >= 0 && !sim.s.grounded) took++;
      else if (predicted >= 0) break;
    }
    expect(predicted).toBeGreaterThan(1.5);
    expect(Math.abs(predicted - (took + 1) / 60)).toBeLessThan(0.25);
  });
});
