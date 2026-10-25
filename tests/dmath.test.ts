import { describe, expect, it } from 'vitest';
import { datan2, dcos, dexp, dsin, wrapAngle } from '../src/sim/dmath';

describe('deterministic math', () => {
  it('matches native trig closely', () => {
    for (let i = -2000; i <= 2000; i++) {
      const x = i * 0.0173;
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-9);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-9);
    }
  });

  it('matches native atan2 in every quadrant', () => {
    for (let i = 0; i < 400; i++) {
      const a = (i / 400) * Math.PI * 2 - Math.PI;
      for (const r of [0.001, 1, 37]) {
        const y = r * Math.sin(a);
        const x = r * Math.cos(a);
        expect(Math.abs(datan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-9);
      }
    }
    expect(datan2(0, 0)).toBe(0);
    expect(datan2(1, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(datan2(-1, 0)).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('matches native exp', () => {
    for (let i = -300; i <= 300; i++) {
      const x = i * 0.05;
      const rel = Math.abs(dexp(x) - Math.exp(x)) / Math.exp(x);
      expect(rel).toBeLessThan(1e-12);
    }
  });

  it('wraps angles to [-pi, pi]', () => {
    for (let i = -50; i <= 50; i++) {
      const w = wrapAngle(i * 1.3);
      expect(w).toBeGreaterThanOrEqual(-Math.PI);
      expect(w).toBeLessThanOrEqual(Math.PI);
      expect(Math.abs(Math.sin(w) - Math.sin(i * 1.3))).toBeLessThan(1e-9);
    }
  });
});
