import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BufferGeometry, InstancedMesh } from 'three';
import { Mood } from '../src/sim/chaos';
import { CHUNK_LEN, courseFor } from '../src/sim/course';
import { MOUNTAINS } from '../src/sim/mountains';
import { getPalette } from '../src/render/palette';
import { CAIRN_CAP, Props, kmInChunk } from '../src/render/props';

// The landmark meshes (km arches, cairns) are made off the frame: none at startup, then on idle
// time a little after the first frame, the next mark's arch ahead of it, and only a landmark close
// to the player is ever made on the frame that needs it.

const course = courseFor(MOUNTAINS[0].seed);
const palette = getPalette(course.biome, Mood.None);
/** The chunk holding the 1,000 m line. */
const KM1 = Math.floor(1000 / CHUNK_LEN);
const KM2 = Math.floor(2000 / CHUNK_LEN);
const NONE = new Set<number>();

type Inside = { landmarks: Map<string, BufferGeometry>; queued: Map<string, unknown> };
const inside = (p: Props) => p as unknown as Inside;
const arch = (p: Props) => p.root.children.find((o) => o.userData.noBlock) as InstancedMesh;
const archKeys = (p: Props) => [...inside(p).landmarks.keys()].filter((k) => k.startsWith('arch:'));
/** The window a frame asks for with the player in chunk `near` (World.frame's from and to). */
const view = (p: Props, near: number) => p.update(near - 1, near + 8, NONE, NONE, near);

describe('km arch and cairn meshes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('finds the km marks', () => {
    expect(kmInChunk(KM1)).toBe(1);
    expect(kmInChunk(KM2)).toBe(2);
    expect(kmInChunk(KM1 - 1)).toBe(0);
  });

  it('makes no landmark mesh at startup, and none on the first frames', () => {
    const p = new Props(course, palette, 0.3, false, false, true);
    expect(arch(p).geometry.getAttribute('position')).toBeUndefined();
    expect(inside(p).landmarks.size).toBe(0);
    // The first frame queues the first mark's arch and this palette's cairn, nothing more.
    view(p, 0);
    expect(inside(p).landmarks.size).toBe(0);
    expect(inside(p).queued.size).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(inside(p).landmarks.size).toBe(0);
  });

  it('makes them on idle time after startup, then shows the arch as its mark comes into range', () => {
    const p = new Props(course, palette, 0.3, false, false, true);
    view(p, 0);
    vi.advanceTimersByTime(4000);
    expect(archKeys(p)).toHaveLength(1);
    expect([...inside(p).landmarks.keys()].some((k) => k.startsWith('cairn:'))).toBe(true);
    const built = inside(p).landmarks.get(archKeys(p)[0]);
    // Into range far down the slope: the made mesh goes in as it is, and the next mark's is queued.
    view(p, KM1 - 8);
    expect(arch(p).count).toBe(1);
    expect(arch(p).geometry).toBe(built);
    expect(inside(p).queued.size).toBe(1);
    vi.advanceTimersByTime(4000);
    expect(archKeys(p)).toHaveLength(2);
    const next = inside(p).landmarks.get(archKeys(p)[1]);
    // The second mark's arch is in place before it comes into range: nothing is made on that frame.
    view(p, KM2 - 8);
    expect(arch(p).count).toBe(1);
    expect(arch(p).geometry).toBe(next);
    expect(arch(p).geometry).not.toBe(built);
  });

  it('keeps a far mark whose mesh is not made yet unseen, and makes a near one on the frame', () => {
    const p = new Props(course, palette, 0.3, false, false, true);
    view(p, KM1 - 8);
    expect(arch(p).count).toBe(0);
    expect(arch(p).geometry.getAttribute('position')).toBeUndefined();
    // Within three chunks of the player it cannot wait.
    view(p, KM1 - 2);
    expect(arch(p).count).toBe(1);
    expect(arch(p).geometry.getAttribute('position').count).toBeGreaterThan(1000);
  });

  it('makes nothing on Low (no landmark batches)', () => {
    const p = new Props(course, palette, 0.3, false, false, false);
    view(p, KM1 - 2);
    expect(arch(p)).toBeUndefined();
    vi.advanceTimersByTime(4000);
    expect(inside(p).landmarks.size).toBe(0);
  });

  const cairn = (p: Props) => p.root.children.find((o) => (o as InstancedMesh).isInstancedMesh && (o as InstancedMesh).instanceMatrix.count === CAIRN_CAP) as InstancedMesh;
  const bank = (z: number) => ({ x: course.centerX(z) + course.halfWidth(z) + 1.4, z });

  it('shows a cairn near the start on the first frame', () => {
    const p = new Props(course, palette, 0.3, false, false, true);
    p.setGraveyards([bank(100)]);
    view(p, 0);
    expect(cairn(p).count).toBe(1);
    expect(cairn(p).geometry.getAttribute('position').count).toBeGreaterThan(100);
  });

  it('keeps a far cairn unseen until its mesh is made on idle time', () => {
    const p = new Props(course, palette, 0.3, false, false, true);
    p.setGraveyards([bank(500)]);
    view(p, 0);
    expect(cairn(p).count).toBe(0);
    vi.advanceTimersByTime(4000);
    view(p, 0);
    expect(cairn(p).count).toBe(1);
  });
});
