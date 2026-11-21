import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { breathFov, chatterK, chatterPitch, dashFov, surgeFov } from '../src/render/speedfeel';
import { SPARK_RATE, SpiritFlow, TRAIL_N, WIND_MAX, flowBreathOf, flowLook, trailLife } from '../src/render/spiritflow';

// Spirit Flow's picture and the lens's breath (round 8, the speed lane): every part of the look climbs with the level
// and none goes back down, full flow is everything at once, a level gained breathes in and one lost guts out, Low
// draws the trail alone, and the chatter lives on hard snow and dies in powder.

const PARTS = ['colour', 'trail', 'wind', 'ghost', 'fov', 'top'] as const;

describe('the flow look', () => {
  it('is nothing at level 0 and everything at 6', () => {
    const none = flowLook(0);
    const full = flowLook(6);
    for (const k of PARTS) {
      expect(none[k], k).toBeCloseTo(0, 6);
      expect(full[k], k).toBeCloseTo(1, 6);
    }
  });

  it('climbs with the level and never dips, holding still past either end', () => {
    for (const k of PARTS) {
      let last = -Infinity;
      for (let f = 0; f <= 6; f += 0.05) {
        const y = flowLook(f)[k];
        expect(y, `${k} at ${f}`).toBeGreaterThanOrEqual(last - 1e-9);
        last = y;
      }
      expect(flowLook(9)[k]).toBeCloseTo(flowLook(6)[k], 9);
      expect(flowLook(-2)[k]).toBeCloseTo(flowLook(0)[k], 9);
    }
  });

  it('comes in a part at a time: colour first, then the trail, then the wind, the sparks last', () => {
    const at1 = flowLook(1);
    expect(at1.colour).toBeGreaterThan(0);
    expect(at1.trail).toBe(0);
    const at2 = flowLook(2);
    expect(at2.trail).toBeGreaterThan(0);
    expect(at2.wind).toBe(0);
    expect(flowLook(3).wind).toBeGreaterThan(0);
    expect(flowLook(4).top).toBe(0);
    expect(flowLook(5.5).top).toBeGreaterThan(0.5);
  });

  it('a longer, brighter trail the higher the flow', () => {
    expect(trailLife(flowLook(6))).toBeGreaterThan(trailLife(flowLook(3)));
    expect(trailLife(flowLook(3))).toBeGreaterThan(trailLife(flowLook(0)));
  });

  it('Low draws the trail alone: no wind and no sparks; the phone and Medium about half of High', () => {
    expect(WIND_MAX.low).toBe(0);
    expect(SPARK_RATE.low).toBe(0);
    expect(TRAIL_N.low).toBeGreaterThan(2);
    expect(WIND_MAX.medium).toBeLessThan(WIND_MAX.high);
    expect(SPARK_RATE.medium).toBeLessThan(SPARK_RATE.high);
  });
});

describe('a level moving', () => {
  it('a level gained breathes in, one lost guts out, the same level is nothing', () => {
    expect(flowBreathOf(3, 2)).toBeGreaterThan(0);
    expect(flowBreathOf(2, 3)).toBeLessThan(0);
    expect(flowBreathOf(4, 4)).toBe(0);
    // Bigger steps and higher levels breathe deeper; nothing past 1 either way.
    expect(flowBreathOf(6, 5)).toBeGreaterThan(flowBreathOf(2, 1));
    expect(flowBreathOf(5, 2)).toBeGreaterThan(flowBreathOf(3, 2));
    expect(flowBreathOf(0, 6)).toBeLessThan(flowBreathOf(5, 6));
    for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6; b++) expect(Math.abs(flowBreathOf(a, b))).toBeLessThanOrEqual(1);
  });

  it('the lens draws in, then opens out past where it was, and settles; a gutter only sags', () => {
    expect(breathFov(0.07, 1)).toBeLessThan(0);
    let peak = 0;
    for (let t = 0.2; t < 1.2; t += 0.01) peak = Math.max(peak, breathFov(t, 1));
    expect(peak).toBeGreaterThan(1.5);
    expect(Math.abs(breathFov(1.6, 1))).toBeLessThan(0.6);
    for (let t = 0; t < 2; t += 0.02) expect(breathFov(t, -1)).toBeLessThanOrEqual(1e-9);
    expect(breathFov(0.5, -1)).toBeLessThan(-1);
    expect(Math.abs(breathFov(2, -1))).toBeLessThan(0.1);
    expect(breathFov(-1, 1)).toBe(0);
    expect(breathFov(0.3, 0)).toBe(0);
  });

  it('several levels in one frame are one breath, and the camera takes it once', () => {
    const f = new SpiritFlow('high');
    const o = { dt: 1 / 60, time: 10, flow: 3, vel: new Vector3(0, 0, -30), knot: new Vector3(0, 1.2, 0), tip: new Vector3(0.3, 1.1, 0.8), dir: new Vector3(0, 0, -1), cam: new Vector3(0, 2.6, 4.5), ground: () => 0, reduced: false };
    f.onLevel(1, 0);
    f.onLevel(2, 1);
    f.onLevel(3, 2);
    f.update(o);
    const b = f.takeBreath();
    expect(b).toBeGreaterThan(0);
    expect(f.takeBreath()).toBe(0);
    expect(f.pulse).toBeGreaterThan(0);
    // A level lost a moment later guts out.
    f.onLevel(2, 3);
    f.update({ ...o, time: 10.5, flow: 2.6 });
    expect(f.takeBreath()).toBeLessThan(0);
    expect(f.pulse).toBeLessThan(0);
  });

  it('builds a trail off the scarf at flow, and none at rest; no wind under reduced motion', () => {
    const f = new SpiritFlow('high');
    const o = { dt: 1 / 60, time: 0, flow: 6, vel: new Vector3(0, 0, -30), knot: new Vector3(0, 1.2, 0), tip: new Vector3(0.3, 1.1, 0.8), dir: new Vector3(0, 0, -1), cam: new Vector3(0, 2.6, 4.5), ground: () => 0, reduced: true };
    for (let i = 0; i < 60; i++) {
      o.time = i / 60;
      o.knot.z -= 0.5;
      o.tip.z -= 0.5;
      o.cam.z -= 0.5;
      f.update(o);
    }
    const [trail, wind] = f.root.children;
    expect(trail.visible).toBe(true);
    expect(wind.visible).toBe(false);
    const rest = new SpiritFlow('high');
    rest.update({ ...o, flow: 0 });
    expect(rest.root.children.some((c) => c.visible)).toBe(false);
  });
});

describe('the lens breathing with speed', () => {
  it('a surge opens it, a slowing draws it in, both capped', () => {
    expect(surgeFov(0)).toBeCloseTo(0, 9);
    expect(surgeFov(6)).toBeGreaterThan(0.5);
    expect(surgeFov(400)).toBeLessThanOrEqual(3.5);
    expect(surgeFov(-6)).toBeLessThan(0);
    expect(surgeFov(-400)).toBeGreaterThanOrEqual(-1.5);
  });

  it("a dash punches out and holds while it runs, then lets go", () => {
    expect(dashFov(-1, true)).toBe(0);
    expect(dashFov(0.1, true)).toBeCloseTo(6.5, 6);
    expect(dashFov(1.5, true)).toBeCloseTo(3, 6);
    expect(dashFov(2.5, false)).toBeLessThan(0.1);
  });

  it('chatters on hard snow, hardly in powder, and more with speed', () => {
    expect(chatterK(12, 1)).toBe(0);
    expect(chatterK(30, 1)).toBeGreaterThan(chatterK(30, 0.6));
    expect(chatterK(30, 0.6)).toBeGreaterThan(chatterK(30, 0));
    expect(chatterK(46, 1)).toBeCloseTo(1, 6);
    expect(chatterK(46, 0)).toBeLessThan(0.35);
    let last = -1;
    for (let v = 0; v <= 46; v += 1) {
      expect(chatterK(v, 0.6)).toBeGreaterThanOrEqual(last);
      last = chatterK(v, 0.6);
    }
    // About 11 Hz at 30 m/s on groomed snow: a washboard's beat, under the frame rate's half.
    expect(30 * chatterPitch(0.6)).toBeGreaterThan(9);
    expect(30 * chatterPitch(1)).toBeLessThan(15);
  });
});
