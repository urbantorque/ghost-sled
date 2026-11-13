import { beforeAll, describe, expect, it } from 'vitest';
import { TierController, autoCeiling, gpuClass } from '../src/game/quality';

// The controller only reads document.hidden from the DOM.
beforeAll(() => {
  (globalThis as { document?: unknown }).document ??= { hidden: false };
});

function feed(c: TierController, ms: number[]): void {
  for (const x of ms) c.frame(x / 1000);
}

const smooth = (n: number) => Array.from({ length: n }, () => 16.7);

describe('the automatic ceiling', () => {
  it('gives Ultra to a discrete GPU by name and to nothing else', () => {
    const discrete = [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002503) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 6700 XT (0x000073DF) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Arc(TM) B580 Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    ];
    for (const n of discrete) {
      expect(gpuClass(n), n).toBe('discrete');
      expect(autoCeiling(n), n).toBe('ultra');
    }
    const integrated = [
      // The laptop this round is built on.
      'ANGLE (Intel, Intel(R) Arc(TM) 130V GPU (8GB) (0x000064A0) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Arc(TM) 140V GPU (16GB) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon(TM) 780M Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce MX150 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
      'Mali-G78',
      'Adreno (TM) 740',
    ];
    for (const n of integrated) {
      expect(gpuClass(n), n).toBe('integrated');
      expect(autoCeiling(n), n).toBe('high');
    }
    expect(gpuClass('')).toBe('unknown');
    expect(autoCeiling('')).toBe('high');
    expect(autoCeiling('Some Future Renderer')).toBe('high');
    expect(gpuClass('Google SwiftShader')).toBe('software');
  });
});

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

  it('never steps into Ultra by itself under the default ceiling, whatever the headroom', () => {
    const c = new TierController('high');
    for (let i = 0; i < 6000; i++) c.frame(1 / 60, 1);
    expect(c.tier).toBe('high');
    // From Medium it climbs to High and stops there.
    const m = new TierController('medium');
    for (let i = 0; i < 6000; i++) m.frame(1 / 60, 1);
    expect(m.tier).toBe('high');
  });

  it('steps into Ultra under an Ultra ceiling, after holding the headroom twice as long', () => {
    const c = new TierController('high', 'ultra');
    // Warm-up, the window, then just over the six seconds a step to High asks: not yet.
    for (let i = 0; i < 60 * 11; i++) c.frame(1 / 60, 3);
    expect(c.tier).toBe('high');
    for (let i = 0; i < 60 * 10; i++) c.frame(1 / 60, 3);
    expect(c.tier).toBe('ultra');
  });

  it('leaves Ultra for High when its frames run long, and never climbs back', () => {
    const c = new TierController('ultra', 'ultra');
    feed(c, smooth(120));
    for (let i = 0; i < 200 && c.tier === 'ultra'; i++) c.frame(0.024, 3);
    expect(c.tier).toBe('high');
    for (let i = 0; i < 3000; i++) c.frame(1 / 60, 3);
    expect(c.tier).toBe('high');
  });

  it('never steps down when locked to a tier', () => {
    const c = new TierController('high');
    c.locked = true;
    feed(c, Array.from({ length: 600 }, () => 33.3));
    expect(c.tier).toBe('high');
  });
});
