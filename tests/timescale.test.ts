import { describe, expect, it } from 'vitest';
import { CRASH_CURVE, sampleCurve, TimeScale } from '../src/game/timescale';

const F = 1 / 60;

/** The curve's scale `t` seconds after it starts, read through the class (step latches, then spends). */
function curveAt(t: number): number {
  const ts = new TimeScale(() => false);
  ts.curve(CRASH_CURVE, 'render');
  ts.step(t);
  ts.step(0);
  return ts.render;
}

describe('TimeScale', () => {
  it('starts at full speed', () => {
    const ts = new TimeScale(() => false);
    ts.step(F);
    expect(ts.feed).toBe(1);
    expect(ts.render).toBe(1);
    expect(ts.shake).toBe(1);
  });

  it('keeps the strongest pulse per channel: 0.35 then 0.6 keeps 0.35', () => {
    const ts = new TimeScale(() => false);
    ts.pulse(0.35, 0.13, 'feed');
    ts.pulse(0.6, 0.13, 'feed');
    ts.step(F);
    expect(ts.feed).toBe(0.35);
    // ...and the other order too.
    const b = new TimeScale(() => false);
    b.pulse(0.6, 0.13, 'feed');
    b.pulse(0.35, 0.13, 'feed');
    b.step(F);
    expect(b.feed).toBe(0.35);
  });

  it('lets a longer, weaker pulse run on once the strong one has spent', () => {
    const ts = new TimeScale(() => false);
    ts.pulse(0.35, 0.05, 'feed');
    ts.pulse(0.6, 0.5, 'feed');
    ts.step(F);
    expect(ts.feed).toBe(0.35);
    for (let i = 0; i < 4; i++) ts.step(F);
    expect(ts.feed).toBe(0.6);
  });

  it('expires pulses: the perfect hit-stop scales 8 frames at 60 Hz, as the old one did', () => {
    const ts = new TimeScale(() => false);
    ts.pulse(0.35, 0.13, 'feed');
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      ts.step(F);
      seen.push(ts.feed);
    }
    expect(seen.filter((s) => s === 0.35).length).toBe(8);
    expect(seen[8]).toBe(1);
    expect(seen[9]).toBe(1);
  });

  it('keeps channels apart; both hits both; shake is min(feed, render)', () => {
    const ts = new TimeScale(() => false);
    ts.pulse(0.5, 0.2, 'render');
    ts.step(F);
    expect(ts.feed).toBe(1);
    expect(ts.render).toBe(0.5);
    expect(ts.shake).toBe(0.5);
    ts.pulse(0.3, 0.2, 'feed');
    ts.step(F);
    expect(ts.feed).toBe(0.3);
    expect(ts.shake).toBe(0.3);
    const b = new TimeScale(() => false);
    b.pulse(0.4, 0.1, 'both');
    b.step(F);
    expect(b.feed).toBe(0.4);
    expect(b.render).toBe(0.4);
  });

  it('reset clears pulses and curves', () => {
    const ts = new TimeScale(() => false);
    ts.pulse(0.35, 1, 'both');
    ts.curve(CRASH_CURVE, 'render');
    ts.step(F);
    expect(ts.render).toBe(0);
    ts.reset();
    expect(ts.feed).toBe(1);
    expect(ts.render).toBe(1);
    ts.step(F);
    expect(ts.feed).toBe(1);
    expect(ts.render).toBe(1);
    expect(ts.active).toBe(false);
  });

  it('cancels a curve (the results arrive mid-beat)', () => {
    const ts = new TimeScale(() => false);
    ts.curve(CRASH_CURVE, 'render');
    ts.step(0.2);
    ts.cancelCurve('render');
    ts.step(F);
    expect(ts.render).toBe(1);
    const b = new TimeScale(() => false);
    b.curve(CRASH_CURVE, 'render');
    b.step(0.2);
    b.curve([], 'render');
    b.step(F);
    expect(b.render).toBe(1);
  });

  it('makes pulse and curve no-ops under the injected reduced motion', () => {
    let reduced = true;
    const ts = new TimeScale(() => reduced);
    ts.pulse(0.35, 0.13, 'feed');
    ts.pulse(0.2, 0.5, 'both');
    ts.curve(CRASH_CURVE, 'render');
    ts.step(F);
    expect(ts.feed).toBe(1);
    expect(ts.render).toBe(1);
    expect(ts.shake).toBe(1);
    // Turned on mid-pulse: whatever is alive is dropped at the next step.
    reduced = false;
    ts.pulse(0.35, 0.5, 'feed');
    ts.step(F);
    expect(ts.feed).toBe(0.35);
    reduced = true;
    ts.step(F);
    expect(ts.feed).toBe(1);
  });

  it('samples the crash curve: 0 at 30 ms, 0.3 at 200 ms, 1 at 650 ms', () => {
    expect(curveAt(0.03)).toBe(0);
    expect(curveAt(0.2)).toBeCloseTo(0.3, 6);
    expect(curveAt(0.65)).toBe(1);
    expect(sampleCurve(CRASH_CURVE, 0.03)).toBe(0);
    expect(sampleCurve(CRASH_CURVE, 0.2)).toBeCloseTo(0.3, 6);
    expect(sampleCurve(CRASH_CURVE, 0.65)).toBe(1);
  });

  it('eases the crash curve back up monotonically between 380 and 600 ms', () => {
    let last = 0.3;
    for (let t = 0.38; t <= 0.6001; t += 0.01) {
      const s = sampleCurve(CRASH_CURVE, t);
      expect(s).toBeGreaterThanOrEqual(last - 1e-9);
      last = s;
    }
    expect(last).toBeCloseTo(1, 6);
  });

  it('holds a frame on the crash: render time barely moves in the first 70 ms', () => {
    const ts = new TimeScale(() => false);
    ts.curve(CRASH_CURVE, 'render');
    let rendered = 0;
    let real = 0;
    while (real < 0.07 - 1e-9) {
      ts.step(F);
      rendered += F * ts.render;
      real += F;
    }
    expect(rendered).toBeLessThan(0.006);
    // About 0.45 s of scaled time has passed by roughly 0.8 s of real time.
    while (rendered < 0.45) {
      ts.step(F);
      rendered += F * ts.render;
      real += F;
    }
    expect(real).toBeGreaterThan(0.7);
    expect(real).toBeLessThan(0.9);
  });

  it('is frame-rate independent at 37 and 144 Hz', () => {
    for (const hz of [37, 144]) {
      const ts = new TimeScale(() => false);
      ts.pulse(0.35, 0.13, 'feed');
      let scaled = 0;
      for (let i = 0; i < hz; i++) {
        ts.step(1 / hz);
        scaled += ts.feed / hz;
      }
      // One second of real time, 0.13 s of it at 0.35 (within one frame's rounding).
      expect(Math.abs(scaled - (1 - 0.13 * 0.65))).toBeLessThan(0.65 / hz + 1e-6);
    }
  });
});
