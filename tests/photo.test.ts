import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { PHOTO_REACH, PhotoRig } from '../src/render/camera';
import { cine } from '../src/render/cine';
import { APEX_MIN_AIR_S, FINISH_DELAY_S, FINISH_FRAMES, FINISH_STEP_S, PIECE_DELAY_S, StickerShots, aimFor, atTheLine, type ShotCtx } from '../src/game/albumframes';
import { cropAround } from '../src/game/photoshoot';
import { photoName } from '../src/ui/photo';
import type { SimEvent } from '../src/sim/sim';

// Round 8, the photo lane. Photo mode's lens turns round the rider, never stands in the snow, a rock or a tree, and
// opens on the frame the run was held on; the album keeps a frame of each sticker from the run it happened in, taken
// as the moment happens and matched to what the run earned once it is settled.

/** A slope falling toward -z (three.js), a rock wall at x > 8 and a tree at (-4, -10). */
const ground = (_x: number, z: number) => z * 0.3;
const world = {
  ground,
  surface: (x: number, z: number) => (x > 8 ? ground(x, z) + 6 : ground(x, z)),
  blocked: (x: number, z: number, r: number) => Math.hypot(x + 4, z + 10) < r,
};

function rigAt(cam: Vector3, feet = new Vector3(0, ground(0, 0), 0)): { rig: PhotoRig; camera: PerspectiveCamera; feet: Vector3 } {
  const rig = new PhotoRig(world);
  const camera = new PerspectiveCamera(60, 16 / 9, 0.3, 5000);
  camera.position.copy(cam);
  camera.lookAt(feet.x, feet.y + 0.9, feet.z);
  rig.begin(camera, feet);
  rig.reduced = true;
  return { rig, camera, feet };
}

describe('photo mode: the lens', () => {
  it('opens on the frame the run was held on', () => {
    const start = new Vector3(0.5, 2.6, 6);
    const { rig, camera, feet } = rigAt(start);
    rig.frame(camera, feet);
    expect(camera.position.distanceTo(start)).toBeLessThan(1e-6);
    expect(camera.fov).toBeCloseTo(60, 6);
  });

  it('turns round the rider at the distance set, and back to the first frame on reset', () => {
    const start = new Vector3(0, 2.6, 6);
    const { rig, camera, feet } = rigAt(start);
    rig.orbit(Math.PI / 2, 0);
    rig.frame(camera, feet);
    const pivot = feet.clone().add(new Vector3(0, 0.9, 0));
    expect(camera.position.distanceTo(pivot)).toBeCloseTo(start.distanceTo(pivot), 4);
    expect(camera.position.x).toBeGreaterThan(5);
    rig.reset();
    rig.frame(camera, feet);
    expect(camera.position.distanceTo(start)).toBeLessThan(1e-4);
  });

  it('keeps its reach: near and far, the pivot within its leash, the lens within its width and tilt', () => {
    const { rig, camera, feet } = rigAt(new Vector3(0, 2, 6));
    rig.dolly(100);
    expect(rig.dist).toBe(PHOTO_REACH.far);
    rig.dolly(0.0001);
    expect(rig.dist).toBe(PHOTO_REACH.near);
    for (let i = 0; i < 50; i++) rig.move(1, 0);
    expect(rig.pan.length()).toBeLessThanOrEqual(PHOTO_REACH.pan + 1e-6);
    rig.setFov(5);
    expect(rig.fov).toBe(PHOTO_REACH.fovLo);
    rig.setRoll(2);
    expect(rig.roll).toBe(PHOTO_REACH.roll);
    rig.orbit(0, 10);
    expect(rig.pitch).toBe(PHOTO_REACH.pitchHi);
    rig.orbit(Number.NaN, 1);
    rig.dolly(Number.NaN);
    rig.frame(camera, feet);
    expect(Number.isFinite(camera.position.x + camera.position.y + camera.position.z)).toBe(true);
  });

  it('never stands in the snow: looking up from under the rider, the lens rides over the slope', () => {
    const { rig, camera, feet } = rigAt(new Vector3(0, 2, 6));
    rig.orbit(0, -10);
    rig.dolly(100);
    for (let a = 0; a < 16; a++) {
      rig.orbit((Math.PI * 2) / 16, 0);
      rig.frame(camera, feet);
      expect(camera.position.y).toBeGreaterThanOrEqual(ground(camera.position.x, camera.position.z) + 0.44);
    }
  });

  it('stops short of rock and of a tree, never through either', () => {
    // Toward the wall (+x): the arm ends before x = 8.
    const { rig, camera, feet } = rigAt(new Vector3(6, 1.2, 0));
    rig.dolly(100);
    rig.frame(camera, feet);
    expect(camera.position.x).toBeLessThan(8);
    expect(rig.arm).toBeLessThan(PHOTO_REACH.far);
    // Toward the tree at (-4, -10): the lens stops on the near side of the trunk.
    const t = rigAt(new Vector3(-2, 1.4, -5));
    t.rig.dolly(100);
    t.rig.frame(t.camera, t.feet);
    expect(Math.hypot(t.camera.position.x + 4, t.camera.position.z + 10)).toBeGreaterThan(0.6);
    expect(t.camera.position.distanceTo(t.feet)).toBeLessThan(Math.hypot(4, 10));
  });

  it('a pivot carried into rock does not go', () => {
    const { rig } = rigAt(new Vector3(0, 2, 6));
    for (let i = 0; i < 40; i++) rig.move(0.2, 0);
    // The pan's x keeps the pivot short of the wall at x = 8.
    expect(rig.pan.x).toBeLessThan(8);
  });

  it('draws a still camera: no letterbox, no motion blur, depth of field only when asked', () => {
    const { rig, camera, feet } = rigAt(new Vector3(0, 2, 6));
    cine.letterbox = 1;
    cine.motionBlur = 0.5;
    rig.frame(camera, feet);
    expect(cine.letterbox).toBe(0);
    expect(cine.motionBlur).toBe(0);
    expect(cine.dof).toBe(0);
    rig.focus = true;
    rig.frame(camera, feet);
    expect(cine.dof).toBeGreaterThan(0);
    expect(cine.focus).toBeCloseTo(camera.position.distanceTo(feet.clone().setY(feet.y + 0.9)), 4);
  });
});

describe('photo mode: the file', () => {
  it("names a photo for the game, the mountain and the moment, so a folder sorts by when", () => {
    const at = new Date(2026, 10, 22, 9, 5, 7);
    expect(photoName('Pinecrest', at)).toBe('ghost-sled-pinecrest-20261122-090507.png');
    expect(photoName("Ember Peak's Daily", at, true)).toBe('ghost-sled-ember-peak-s-daily-20261122-090507-card.png');
  });

  it("crops a sticker's frame round the rider, at the sticker's shape, inside the picture", () => {
    const a = cropAround(1280, 720, 640, 500);
    expect(a.w / a.h).toBeCloseTo(1.6, 6);
    expect(a.y + a.h).toBeLessThanOrEqual(720);
    const tall = cropAround(780, 1688, 390, 1100);
    expect(tall.w).toBe(780);
    expect(tall.y).toBeGreaterThan(0);
    expect(tall.y + tall.h).toBeGreaterThanOrEqual(1100);
    const edge = cropAround(1280, 720, 1270, 10);
    expect(edge.x + edge.w).toBeLessThanOrEqual(1280 + 1e-9);
    expect(edge.x).toBeGreaterThanOrEqual(0);
    // Closer on the rider, and never into a letterbox's bars (12% of the height each).
    const bars = 720 * 0.12;
    const lb = cropAround(1280, 720, 640, 700, 1.6, 0.62, bars, 720 - bars);
    expect(lb.y).toBeGreaterThanOrEqual(bars);
    expect(lb.y + lb.h).toBeLessThanOrEqual(720 - bars + 1e-9);
    expect(lb.h).toBeCloseTo((720 - 2 * bars) * 0.62, 6);
  });
});

const ctx = (held: string[] = []): ShotCtx => ({
  mountain: 'pinecrest',
  held: (id) => held.includes(id),
  play: (i) => (i === 2 ? { key: 'firstDrop', variant: 1 } : null),
  trick: (id) => (id === 3 ? 'railGrab' : id === 1 ? 'spin' : null),
  charm: (id) => (id === 5 ? 'tailwind' : null),
  synergy: (id) => (id === 0 ? 'ghostRider' : null),
});

const ev = (e: SimEvent) => e;

describe('the album: a frame from the run it happened in', () => {
  it('aims at a set piece a beat after it starts, again at its last step, and at its win only when unshot', () => {
    const c = ctx();
    expect(aimFor(ev({ type: 'moment', index: 2, phase: 'start', n: 0, of: 3 }), c)).toEqual({ ids: ['v:pinecrest:firstDrop:1'], delay: PIECE_DELAY_S });
    expect(aimFor(ev({ type: 'moment', index: 2, phase: 'step', n: 1, of: 3 }), c)).toBeNull();
    expect(aimFor(ev({ type: 'moment', index: 2, phase: 'step', n: 3, of: 3 }), c)?.delay).toBe(0);
    expect(aimFor(ev({ type: 'moment', index: 2, phase: 'won', n: 3, of: 3 }), c)?.keep).toBe(true);
    // Held already, or a Daily's (no mountain): nothing.
    expect(aimFor(ev({ type: 'moment', index: 2, phase: 'start', n: 0, of: 3 }), ctx(['v:pinecrest:firstDrop:1']))).toBeNull();
    expect(aimFor(ev({ type: 'moment', index: 2, phase: 'start', n: 0, of: 3 }), { ...c, mountain: '' })).toBeNull();
  });

  it('a sticker earned at the line takes the finish', () => {
    for (const id of ['m:pinecrest:3', 'rv:ember:wren', 'x:sakura', 'w:wren', 'n:2']) expect(atTheLine(id)).toBe(true);
    for (const id of ['v:pinecrest:a:0', 'l:pinecrest:1', 't:spin', 'c:tailwind', 's:ghostRider']) expect(atTheLine(id)).toBe(false);
    expect(aimFor(ev({ type: 'finish', tick: 9000, bonus: 0 }), ctx())).toEqual({ ids: [], slot: 'finish', delay: FINISH_DELAY_S });
  });

  it('keeps each frame for the stickers settled, hands each over once, and none for what was not earned', () => {
    const s = new StickerShots<string>(ctx());
    const frame = (dt: number, name: string, air: { airborne: boolean; vy: number; trickMissing: boolean } | null = null) => {
      if (s.step(dt, air)) s.took(name);
    };
    // A set piece: the start's frame, then its last step's.
    s.events([ev({ type: 'moment', index: 2, phase: 'start', n: 0, of: 3 })]);
    frame(0.3, 'early');
    frame(0.4, 'piece-start');
    s.events([ev({ type: 'moment', index: 2, phase: 'step', n: 3, of: 3 })]);
    frame(1 / 60, 'piece-last');
    s.events([ev({ type: 'moment', index: 2, phase: 'won', n: 3, of: 3 })]);
    frame(1 / 60, 'piece-won');
    // A charm and the pair it makes, on one frame.
    s.events([ev({ type: 'charm', gate: 0, lane: 1, id: 5 }), ev({ type: 'synergy', id: 0 })]);
    frame(1 / 60, 'gate');
    // A flight: its top, then a grab (which replaces it), then the landing with its trick.
    s.events([ev({ type: 'takeoff', kind: 'lip', vy: 6 })]);
    frame(0.2, 'rise', { airborne: true, vy: 3, trickMissing: true });
    frame(0.2, 'apex', { airborne: true, vy: -0.1, trickMissing: true });
    s.events([ev({ type: 'grab', phase: 'tier', side: 1, tier: 1, trick: 3 })]);
    frame(1 / 60, 'grab', { airborne: true, vy: -2, trickMissing: true });
    s.events([ev({ type: 'land', quality: 'clean', airtime: 1, halfTurns: 0, flips: 0, impact: 1, late: false }), ev({ type: 'style', kind: 'trick' as never, points: 100, chain: 1, mult: 1, trick: 3 })]);
    frame(1 / 60, 'landed', { airborne: false, vy: 0, trickMissing: true });
    // The line.
    s.events([ev({ type: 'finish', tick: 9000, bonus: 0 })]);
    frame(1, 'coast');
    // Settled before the finish's frame: the line's sticker waits for it.
    s.settle(['v:pinecrest:firstDrop:1', 'c:tailwind', 's:ghostRider', 't:railGrab', 'm:pinecrest:2']);
    const first = new Map(s.ready().map((r) => [r.id, r.frame]));
    expect(first.get('v:pinecrest:firstDrop:1')).toBe('piece-last');
    expect(first.get('c:tailwind')).toBe('gate');
    expect(first.get('s:ghostRider')).toBe('gate');
    expect(first.get('t:railGrab')).toBe('grab');
    expect(first.has('m:pinecrest:2')).toBe(false);
    frame(FINISH_DELAY_S, 'finish-0');
    // (The line's stickers wait for the rest of the finish's frames.)
    expect(s.ready()).toEqual([]);
    for (let k = 1; k < FINISH_FRAMES; k++) frame(FINISH_STEP_S, `finish-${k}`);
    expect(s.ready()).toEqual([{ id: 'm:pinecrest:2', frame: 'finish-0' }]);
    // Settled again (a revive): nothing handed twice; a sticker not earned is never handed.
    s.settle(['v:pinecrest:firstDrop:1', 'm:pinecrest:2']);
    expect(s.ready()).toEqual([]);
  });

  it("deals the finish's frames in turn to the line's stickers, and hands over what there is when the run ends early", () => {
    const s = new StickerShots<string>(ctx());
    s.events([ev({ type: 'finish', tick: 9000, bonus: 0 })]);
    const ids = ['rv:pinecrest:a', 'rv:pinecrest:b', 'rv:pinecrest:c', 'rv:pinecrest:d', 'rv:pinecrest:e', 'm:pinecrest:4'];
    s.settle(ids);
    for (let k = 0; k < FINISH_FRAMES; k++) if (s.step(k === 0 ? FINISH_DELAY_S : FINISH_STEP_S, null)) s.took(`f${k}`);
    const got = s.ready();
    expect(got.map((g) => g.frame)).toEqual(ids.map((_, i) => `f${i % FINISH_FRAMES}`));
    // Run Again a second after the line: the one frame there is.
    const e = new StickerShots<string>(ctx());
    e.events([ev({ type: 'finish', tick: 9000, bonus: 0 })]);
    e.settle(['m:pinecrest:4', 'w:wren']);
    if (e.step(FINISH_DELAY_S, null)) e.took('only');
    expect(e.ready()).toEqual([]);
    expect(e.ready(true).map((g) => g.frame)).toEqual(['only', 'only']);
  });

  it('shoots a spin at its flight top, and nothing for a flight too short or a trick held', () => {
    const s = new StickerShots<string>(ctx(['t:railGrab']));
    const frame = (dt: number, name: string, air: { airborne: boolean; vy: number; trickMissing: boolean }) => {
      if (s.step(dt, air)) s.took(name);
    };
    frame(APEX_MIN_AIR_S, 'up', { airborne: true, vy: 2, trickMissing: true });
    frame(1 / 60, 'top', { airborne: true, vy: -0.2, trickMissing: true });
    // A grab of a trick held already does not replace the top.
    s.events([ev({ type: 'grab', phase: 'tier', side: 1, tier: 1, trick: 3 })]);
    frame(1 / 60, 'grab', { airborne: true, vy: -1, trickMissing: true });
    s.events([ev({ type: 'land', quality: 'clean', airtime: 1, halfTurns: 2, flips: 0, impact: 1, late: false }), ev({ type: 'style', kind: 'trick' as never, points: 50, chain: 1, mult: 1, trick: 1 })]);
    s.settle(['t:spin']);
    expect(s.ready()).toEqual([{ id: 't:spin', frame: 'top' }]);
    // A hop: down again before it is a flight.
    const h = new StickerShots<string>(ctx());
    let took = 0;
    if (h.step(0.05, { airborne: true, vy: 1, trickMissing: true })) took++;
    if (h.step(0.05, { airborne: true, vy: -1, trickMissing: true })) took++;
    expect(took).toBe(0);
  });
});
