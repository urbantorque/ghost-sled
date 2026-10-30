import { describe, expect, it } from 'vitest';
import { GhostVisuals, wearsRing } from '../src/render/ghosts';
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
    tag: { w: 64, el: { classList: { contains: () => false } } },
  }));
  const gv = Object.create(GhostVisuals.prototype) as GhostVisuals;
  Object.assign(gv, { items, rivalNow: -1, sinceStamp: Infinity, sinceTrick: Infinity });
  return { gv, items, removed };
}

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
