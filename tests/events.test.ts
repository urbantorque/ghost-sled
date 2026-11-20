import { describe, expect, it } from 'vitest';
import { FLAG_DASHING, FLAG_DOWN, FLAG_GROUNDED, FLAG_UP, packTrick, unpackTrick } from '../src/game/ghostdata';
import { rumbleFor, rumbleLength } from '../src/game/rumble';
import { STOMP_HOLD_SCALE, TimeScale, stompHoldS } from '../src/game/timescale';
import { WAVE_R, WAVE_S } from '../src/render/landing';
import { finishScale } from '../src/render/moments';
import type { SimEvent } from '../src/sim/sim';
import { TRICK } from '../src/sim/tricks';

// Round 8, the events lane (V6, every action is an event): the held beat of a perfect landing, the finish scaled to
// the result, the ghosts' trick poses carried in their trajectories, and the pad's new effects. Presentation only:
// nothing here is read by the sim.

describe('a perfect landing holds the picture for a beat', () => {
  it('holds longer for a streak, from 50 ms to under a tenth of a second', () => {
    expect(stompHoldS(1)).toBeCloseTo(0.05, 6);
    for (let n = 2; n <= 5; n++) expect(stompHoldS(n)).toBeGreaterThan(stompHoldS(n - 1));
    expect(stompHoldS(9)).toBe(stompHoldS(5));
    expect(stompHoldS(5)).toBeLessThan(0.1);
    expect(stompHoldS(0)).toBe(stompHoldS(1));
  });

  it('holds the render clock near still and lets go; reduced motion holds nothing', () => {
    const ts = new TimeScale(() => false);
    ts.pulse(STOMP_HOLD_SCALE, stompHoldS(1), 'render');
    ts.step(1 / 60);
    expect(ts.render).toBeCloseTo(STOMP_HOLD_SCALE, 6);
    expect(ts.feed).toBe(1);
    for (let i = 0; i < 4; i++) ts.step(1 / 60);
    expect(ts.render).toBe(1);
    const calm = new TimeScale(() => true);
    calm.pulse(STOMP_HOLD_SCALE, stompHoldS(5), 'render');
    calm.step(1 / 60);
    expect(calm.render).toBe(1);
  });

  it('runs its shockwave out past anything a fall throws, inside the crater beat', () => {
    // (A wipeout's burst flies about 2 to 4 m; the snow lane's ring of powder about 6 to 8.)
    expect(WAVE_R).toBeGreaterThan(8);
    expect(WAVE_S).toBeGreaterThan(0.3);
    expect(WAVE_S).toBeLessThan(0.8);
  });
});

describe('the finish is scaled to the result', () => {
  const win = finishScale(1, false);
  const pb = finishScale(5, true);
  const podium = finishScale(3, false);
  const plain = finishScale(6, false);

  it('names each result', () => {
    expect([win.kind, pb.kind, podium.kind, plain.kind]).toEqual(['win', 'pb', 'podium', 'finish']);
    // A win that is also a best is a win (its festival lights the town too).
    expect(finishScale(1, true).kind).toBe('win');
  });

  it('a win is a festival: the most shells, cannons and ribbons, and the town lit', () => {
    for (const o of [pb, podium, plain]) {
      expect(win.shells).toBeGreaterThan(o.shells);
      expect(win.ribbons).toBeGreaterThan(o.ribbons);
      expect(win.cannons).toBeGreaterThan(o.cannons);
    }
    expect(win.town).toBe(true);
  });

  it('a best beaten lights the town and lets go the most lanterns', () => {
    expect(pb.town).toBe(true);
    for (const o of [win, podium, plain]) expect(pb.lanterns).toBeGreaterThanOrEqual(o.lanterns);
  });

  it('an ordinary finish is warm: lanterns and a few willows, no cannons, the town not lit', () => {
    expect(plain.cannons).toBe(0);
    expect(plain.town).toBe(false);
    expect(plain.lanterns).toBeGreaterThan(0);
    expect(plain.shells).toBeLessThanOrEqual(3);
    expect(podium.shells).toBeGreaterThan(plain.shells);
  });
});

describe('a ghost carries its trick pose', () => {
  const out = { move: -1, grab: -1, tier: -1 };

  it('packs the trick, the grab side and tier over the flags and reads them back', () => {
    for (const move of [TRICK.railGrab, TRICK.lanternReach, TRICK.paperWheel, TRICK.teacup]) {
      for (const grab of [-1, 0, 1]) {
        for (const tier of [0, 1, 2, 3]) {
          const f = FLAG_DASHING | packTrick(move, grab, tier);
          unpackTrick(f, out);
          expect(out).toEqual({ move, grab, tier });
          // The round 7 flags are untouched underneath.
          expect(f & 255).toBe(FLAG_DASHING);
          // A Float32 keeps every bit.
          expect(Math.fround(f)).toBe(f);
        }
      }
    }
  });

  it('a sample with none (on the snow, or an older trajectory) reads as no trick', () => {
    unpackTrick(FLAG_GROUNDED | FLAG_UP, out);
    expect(out).toEqual({ move: 0, grab: 0, tier: 0 });
    unpackTrick(FLAG_DOWN, out);
    expect(out.move).toBe(0);
  });
});

describe('the pad feels the events', () => {
  const ev = (e: unknown) => rumbleFor(e as SimEvent);

  it('a ward cracks and scatters, a dash ignites, a finish rolls, each inside 260 ms', () => {
    for (const e of [{ type: 'ward' }, { type: 'dash', phase: 'start', cells: 0 }, { type: 'finish', tick: 0, bonus: 0 }]) {
      const fx = ev(e);
      expect(fx).not.toBeNull();
      expect(fx!.pulses.length).toBe(2);
      expect(rumbleLength(fx!)).toBeLessThanOrEqual(260);
    }
    expect(ev({ type: 'dash', phase: 'end', cells: 0 })).toBeNull();
  });
});
