import { beforeAll, describe, expect, it } from 'vitest';
import { TierController } from '../src/game/quality';

// The controller only reads document.hidden from the DOM.
beforeAll(() => {
  (globalThis as { document?: unknown }).document ??= { hidden: false };
});

function feed(c: TierController, ms: number[]): void {
  for (const x of ms) c.frame(x / 1000);
}

const smooth = (n: number) => Array.from({ length: n }, () => 16.7);

describe('TierController', () => {
  it('holds a tier that renders every frame on time', () => {
    const c = new TierController('high');
    feed(c, smooth(1200));
    expect(c.tier).toBe('high');
  });

  it('steps down when frames run long on average', () => {
    const c = new TierController('high');
    feed(c, [...smooth(120), ...Array.from({ length: 200 }, () => 24)]);
    expect(c.tier).toBe('medium');
  });

  it('steps down on judder: a quarter of frames missing vsync while the median stays on time', () => {
    const c = new TierController('high');
    const judder = Array.from({ length: 400 }, (_, i) => (i % 4 === 0 ? 33.3 : 16.7));
    feed(c, [...smooth(120), ...judder]);
    expect(c.tier).toBe('medium');
  });

  it('rides out a short burst of hitches (chunk builds, shader warm-up)', () => {
    const c = new TierController('high');
    const burst = Array.from({ length: 20 }, () => 40);
    feed(c, [...smooth(300), ...burst, ...smooth(600)]);
    expect(c.tier).toBe('high');
  });

  it('never steps down when locked to a tier', () => {
    const c = new TierController('high');
    c.locked = true;
    feed(c, Array.from({ length: 600 }, () => 33.3));
    expect(c.tier).toBe('high');
  });
});
