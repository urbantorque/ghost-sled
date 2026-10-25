import { describe, expect, it } from 'vitest';
import { ChaosEvent, MOODS, Mood, eventTriggerZ, rollChaos } from '../src/sim/chaos';
import { hash32 } from '../src/sim/prng';

describe('chaos budget', () => {
  it('first run of a session is always plain', () => {
    for (let i = 0; i < 500; i++) {
      const r = rollChaos(hash32(i, 7), 0);
      expect(r.mood).toBe(Mood.None);
      expect(r.event).toBe(ChaosEvent.None);
    }
  });

  it('about a third of later runs are plain, at most one mood and one event each', () => {
    let plain = 0;
    let moods = 0;
    let events = 0;
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const r = rollChaos(hash32(i, 99), 1 + (i % 9));
      if (r.mood === Mood.None && r.event === ChaosEvent.None) plain++;
      if (r.mood !== Mood.None) moods++;
      if (r.event !== ChaosEvent.None) events++;
      expect(r.mood).toBeGreaterThanOrEqual(0);
      expect(r.mood).toBeLessThan(MOODS.length);
      expect(r.event).toBeGreaterThanOrEqual(0);
      expect(r.event).toBeLessThanOrEqual(4);
    }
    expect(plain / N).toBeGreaterThan(0.29);
    expect(plain / N).toBeLessThan(0.39);
    expect(moods / N).toBeGreaterThan(0.4);
    expect(events / N).toBeGreaterThan(0.25);
  });

  it('never repeats the previous mood back to back', () => {
    for (let i = 0; i < 2000; i++) {
      const r = rollChaos(hash32(i, 3), 2, Mood.Blizzard);
      expect(r.mood).not.toBe(Mood.Blizzard);
    }
  });

  it('is a pure function of its inputs', () => {
    for (let i = 0; i < 200; i++) {
      expect(rollChaos(hash32(i), 3)).toEqual(rollChaos(hash32(i), 3));
    }
  });

  it('events trigger mid-run, after the warm-up', () => {
    for (let i = 0; i < 500; i++) {
      const r = { mood: Mood.None, event: ChaosEvent.Yeti, seed: hash32(i, 11) };
      const z = eventTriggerZ(r);
      expect(z).toBeGreaterThanOrEqual(500);
      expect(z).toBeLessThan(1200);
    }
    expect(eventTriggerZ({ mood: Mood.Comet, event: ChaosEvent.None, seed: 1 })).toBe(Infinity);
  });
});
