import { describe, expect, it } from 'vitest';
import { ChaosEvent } from '../src/sim/chaos';
import { duelRoute, EVENT_TINY, gapShown } from '../src/ui/hud';
import { landAt, MORE_MIN_PX, moreCue, RESULTS_TIMING, type MoreBlock } from '../src/ui/results';

// The overlay's small decisions, away from the DOM: who may take the rival pill during a duel, the
// phone countdown chip's words, and where the results card's More cue goes.

describe('duelRoute', () => {
  it('gives every message the pill while no duel is open', () => {
    for (const t of ['pass', 'lost', 'news', 'call'] as const) expect(duelRoute(null, 'Mika', t)).toBe('pill');
  });

  it('keeps the pill on the duel ghost and sends other ghosts to the callout line', () => {
    expect(duelRoute('Mika', 'Mika', 'pass')).toBe('pill');
    expect(duelRoute('Mika', 'Mika', 'news')).toBe('pill');
    expect(duelRoute('Mika', 'Tess', 'pass')).toBe('line');
    expect(duelRoute('Mika', 'Tess', 'lost')).toBe('line');
    expect(duelRoute('Mika', 'Tess', 'news')).toBe('line');
    // The start-line call keeps its turn.
    expect(duelRoute('Mika', 'Tess', 'call')).toBe('pill');
  });
});

describe('gapShown', () => {
  it('rounds to whole metres, and holds the shown number around a half metre', () => {
    expect(gapShown(5.4, Number.NaN)).toBe(5);
    expect(gapShown(5.52, 5)).toBe(5);
    expect(gapShown(5.48, 6)).toBe(6);
    expect(gapShown(5.7, 5)).toBe(6);
    expect(gapShown(4.3, 5)).toBe(4);
    expect(gapShown(12, 5)).toBe(12);
  });
});

describe('EVENT_TINY', () => {
  it('names every event in one short word for the phone chip', () => {
    for (const e of [ChaosEvent.Avalanche, ChaosEvent.Yeti, ChaosEvent.GiftStorm, ChaosEvent.GhostTrain]) {
      expect(EVENT_TINY[e]).toMatch(/^[A-Z][a-z]+$/);
      expect(EVENT_TINY[e].length).toBeLessThanOrEqual(9);
    }
    expect(EVENT_TINY[ChaosEvent.GiftStorm]).toBe('Storm');
  });
});

describe('moreCue', () => {
  const view = { top: 17, bottom: 554, right: 1240 };
  const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });
  const mis: MoreBlock = { key: 'mis', r: box(562, 287, 864, 400) };
  const race: MoreBlock = { key: 'race', r: box(898, 287, 1239, 498) };
  const tipCut: MoreBlock = { key: 'tip', r: box(562, 516, 1238, 571) };
  const head = box(562, 287, 864, 330);

  it('stays out for a sliver (the desktop revive card cut by 17 px)', () => {
    expect(moreCue(17, view, [mis, race, tipCut], head, 89)).toBeNull();
    expect(moreCue(MORE_MIN_PX - 1, view, [mis, race, tipCut], head, 89)).toBeNull();
  });

  it('sits at the right end of the tip row when only the tip is cut, and says More', () => {
    const cue = moreCue(60, view, [mis, race, tipCut], head, 89);
    expect(cue).toEqual({ x: 1240 - 89 / 2, label: 'more' });
  });

  it('names the missions and sits on their column while their header is below the fold', () => {
    const low: MoreBlock = { key: 'mis', r: box(562, 560, 864, 700) };
    const cue = moreCue(200, view, [low, race, tipCut], box(562, 560, 864, 600), 89);
    expect(cue).toEqual({ x: 713, label: 'missions' });
  });

  it('says More over the column cut deepest once the missions header is in view', () => {
    const open: MoreBlock = { key: 'mis', r: box(562, 287, 864, 640) };
    const cue = moreCue(120, view, [open, race, tipCut], head, 89);
    expect(cue).toEqual({ x: 713, label: 'more' });
    const long: MoreBlock = { key: 'race', r: box(898, 287, 1239, 760) };
    expect(moreCue(220, view, [open, long, tipCut], head, 89)).toEqual({ x: 1068.5, label: 'more' });
  });
});

describe('landAt', () => {
  it('matches the card timeline the sound cues read (a reward leaves at FLY_MS, 140 ms a row)', () => {
    expect(landAt(0)).toBe(RESULTS_TIMING.FLY_MS);
    expect(landAt(2) - landAt(0)).toBe(2 * RESULTS_TIMING.FLY_STEP);
  });
});
