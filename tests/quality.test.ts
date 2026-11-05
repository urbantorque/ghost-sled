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
    feed(c, smooth(120));
    for (let i = 0; i < 200 && c.tier === 'high'; i++) c.frame(0.024);
    expect(c.tier).toBe('medium');
  });

  it('steps down on judder: a quarter of frames missing vsync while the median stays on time', () => {
    const c = new TierController('high');
    const judder = Array.from({ length: 400 }, (_, i) => (i % 4 === 0 ? 33.3 : 16.7));
    feed(c, smooth(120));
    for (const ms of judder) if (c.tier === 'high') c.frame(ms / 1000);
    expect(c.tier).toBe('medium');
  });

  it('rides out a short burst of hitches (chunk builds, shader warm-up)', () => {
    const c = new TierController('high');
    const burst = Array.from({ length: 20 }, () => 40);
    feed(c, [...smooth(300), ...burst, ...smooth(600)]);
    expect(c.tier).toBe('high');
  });

  it('steps down within about three seconds of the world turning heavy, at 30 fps', () => {
    const c = new TierController('high');
    feed(c, smooth(200));
    let frames = 0;
    while (c.tier === 'high' && frames < 400) {
      c.frame(0.0333);
      frames++;
    }
    expect(c.tier).toBe('medium');
    expect(frames * 0.0333).toBeLessThan(3);
  });

  it('keeps stepping down to Low when Medium is still too heavy', () => {
    const c = new TierController('high');
    feed(c, Array.from({ length: 600 }, () => 33.3));
    expect(c.tier).toBe('low');
  });

  it('steps up when the frame work leaves headroom, and only after holding it', () => {
    const c = new TierController('medium');
    for (let i = 0; i < 300; i++) c.frame(1 / 60, 3);
    expect(c.tier).toBe('medium');
    for (let i = 0; i < 600; i++) c.frame(1 / 60, 3);
    expect(c.tier).toBe('high');
  });

  it('does not step up when the work fills the frame, or when it is unmeasured', () => {
    const c = new TierController('medium');
    for (let i = 0; i < 1200; i++) c.frame(1 / 60, 11);
    expect(c.tier).toBe('medium');
    feed(c, smooth(1200));
    expect(c.tier).toBe('medium');
  });

  it('never steps back up to a tier it left for running long (no see-saw)', () => {
    const c = new TierController('high');
    for (let i = 0; i < 200; i++) c.frame(0.025, 3);
    expect(c.tier).toBe('medium');
    for (let i = 0; i < 2000; i++) c.frame(1 / 60, 3);
    expect(c.tier).toBe('medium');
  });

  it('never steps down when locked to a tier', () => {
    const c = new TierController('high');
    c.locked = true;
    feed(c, Array.from({ length: 600 }, () => 33.3));
    expect(c.tier).toBe('high');
  });
});
