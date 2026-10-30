import { describe, expect, it } from 'vitest';
import { GhostVisuals, tagPrio, wearsRing } from '../src/render/ghosts';
import { IDLE_FEEL, type Beat, type GhostRef } from '../src/game/beats';

// The ghost that passes your wreck wears its tag ringed in its kind colour while the HUD names it, and
// a settled grudge drops its 'grudge' word for the rest of the run, so the one riding past the wreck
// never contradicts the card.

const ref = (id: number, kind: GhostRef['kind'] = 'pool'): GhostRef => ({ id, name: `G${id}`, kind, dx: 0 });

/** The tag state beats() reads and writes, without the DOM the constructor builds. */
function visuals(ids: number[]) {
  const removed: number[] = [];
  const items = ids.map((id) => ({
    id,
    callT: 0,
    wreckT: 0,
    stompT: 0,
    trickT: 0,
    kw: { remove: () => removed.push(id) },
    kwOff: false,
    tag: {
      w: 64,
      held: 0,
      want: false,
      a: 0,
      dot: false,
      wantDot: false,
      x: 100,
      y: 100,
      tx: -1e9,
      ty: -1e9,
      ts: -1e9,
      scale: 1,
      op: '0',
      el: { classList: { contains: () => false, toggle: () => false }, style: {} as Record<string, string> },
    },
  }));
  const gv = Object.create(GhostVisuals.prototype) as GhostVisuals;
  Object.assign(gv, { items, rivalNow: -1, sinceStamp: Infinity, sinceTrick: Infinity });
  return { gv, items, removed };
}

type MockTag = ReturnType<typeof visuals>['items'][number]['tag'];
/** One frame of a tag's show-or-hide (contract C8), placed (`want`) or not by this frame's declutter. */
function animate(gv: GhostVisuals, tag: MockTag, want: boolean): void {
  tag.want = want;
  (gv as unknown as { animate(t: MockTag, dt: number): void }).animate(tag, 1 / 60);
}

const wreckPass = (id: number): Beat => ({ type: 'passedBy', tick: 0, ghost: ref(id), muted: false, wreck: true });

describe('wearsRing', () => {
  it("rings the ghost the rival pill names, and one riding past your wreck while its call runs", () => {
    expect(wearsRing(4, 4, 0, true, false)).toBe(true);
    expect(wearsRing(4, -1, 1.2, true, false)).toBe(true);
    expect(wearsRing(4, 7, 0, true, false)).toBe(false);
    // Not once the call has run out, nor on the title reel (named false), nor for a ghost that crashed.
    expect(wearsRing(4, -1, 0, true, false)).toBe(false);
    expect(wearsRing(4, -1, 1.2, false, false)).toBe(false);
    expect(wearsRing(4, 4, 1.2, true, true)).toBe(false);
  });
});

describe('tagPrio', () => {
  it('places the ghost riding past your wreck before the rival, then every tag by its own', () => {
    expect(tagPrio(true, 1.2, 1)).toBe(-2);
    expect(tagPrio(true, 0, 1)).toBe(-1);
    expect(tagPrio(false, 0, 0)).toBe(0);
    expect(tagPrio(false, 0, 1)).toBe(1);
    // Not ringed (labels off, or it crashed): its own priority, whatever its call.
    expect(tagPrio(false, 1.2, 1)).toBe(1);
    const order = [tagPrio(false, 0, 1), tagPrio(true, 0, 1), tagPrio(false, 0, 0), tagPrio(true, 2, 1)].sort((a, b) => a - b);
    expect(order).toEqual([-2, -1, 0, 1]);
  });
});

describe('ghost tag beats', () => {
  it('a wreck pass pings the passer and holds its ring; a race pass by does not', () => {
    const { gv, items } = visuals([1, 2]);
    const wreck: Beat = { type: 'passedBy', tick: 0, ghost: ref(1), muted: false, wreck: true };
    const race: Beat = { type: 'passedBy', tick: 0, ghost: ref(2), muted: false };
    gv.beats([wreck, race], IDLE_FEEL);
    expect(items[0].wreckT).toBeGreaterThan(2);
    expect(items[0].callT).toBe(items[0].wreckT);
    expect(items[1].wreckT).toBe(0);
    expect(items[1].callT).toBe(0);
  });

  it('a new wreck pass takes the ring from the ghost that rode past before it', () => {
    // A pack of three rides past the wreck: the HUD's pill names only the latest.
    const { gv, items } = visuals([1, 2, 3]);
    gv.beats([wreckPass(1), { type: 'raceCall', tick: 0, ghost: ref(3), word: 'Racing', sr: 'Racing G3.' }], IDLE_FEEL);
    items[0].wreckT -= 0.2;
    items[0].callT -= 0.2;
    gv.beats([wreckPass(2)], IDLE_FEEL);
    // Ring and ping both go from the earlier passer; a start-line call's ping on another runs on.
    expect(items[0].wreckT).toBe(0);
    expect(items[0].callT).toBe(0);
    expect(items[1].wreckT).toBeGreaterThan(2);
    expect(items[2].wreckT).toBe(0);
    expect(items[2].callT).toBeGreaterThan(2);
    // Two in one frame: the later beat is the one the pill shows.
    gv.beats([wreckPass(3), wreckPass(1)], IDLE_FEEL);
    expect(items[0].wreckT).toBeGreaterThan(2);
    expect(items[1].wreckT).toBe(0);
    expect(items[2].wreckT).toBe(0);
    // A race pass by leaves the wreck passer its ring.
    gv.beats([{ type: 'passedBy', tick: 0, ghost: ref(2), muted: false }], IDLE_FEEL);
    expect(items[0].wreckT).toBeGreaterThan(2);
  });

  it("the passer's tag shows on the pill's own frame when placed, and stays hidden when not", () => {
    const { gv, items } = visuals([1, 2, 3]);
    gv.beats([wreckPass(1), { type: 'passedBy', tick: 0, ghost: ref(2), muted: false }], IDLE_FEEL);
    // Placed this frame: the named passer shows at once; any other new tag waits out its settle.
    animate(gv, items[0].tag, true);
    animate(gv, items[1].tag, true);
    expect(items[0].tag.a).toBe(1);
    expect(items[0].tag.op).toBe('1');
    expect(items[1].tag.a).toBe(0);
    // Not placed (cut by the edge, on the HUD): hidden, never half shown, and its next placement
    // settles as ever.
    gv.beats([wreckPass(3)], IDLE_FEEL);
    animate(gv, items[2].tag, false);
    expect(items[2].tag.a).toBe(0);
    expect(items[2].tag.held).toBe(0);
    animate(gv, items[2].tag, true);
    expect(items[2].tag.a).toBe(0);
    // A tag already settled keeps its time.
    items[1].tag.held = 0.5;
    gv.beats([wreckPass(2)], IDLE_FEEL);
    expect(items[1].tag.held).toBe(0.5);
  });

  it("a settled grudge drops its tag's word once, and only its own", () => {
    const { gv, items, removed } = visuals([3, 5]);
    const settled: Beat = { type: 'grudgeSettled', tick: 0, ghost: ref(3, 'grudge'), nemesis: false, after: 2, paid: 5 };
    gv.beats([settled], IDLE_FEEL);
    expect(removed).toEqual([3]);
    expect(items[0].kwOff).toBe(true);
    // Measured again on its next placement.
    expect(items[0].tag.w).toBe(0);
    expect(items[1].kwOff).toBe(false);
    gv.beats([settled], IDLE_FEEL);
    expect(removed).toEqual([3]);
  });
});
