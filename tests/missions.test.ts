import { describe, expect, it } from 'vitest';
import { MISSIONS, RunSummary, applyRun, newMissionState } from '../src/game/missions';

function summary(p: Partial<RunSummary> = {}): RunSummary {
  return {
    mountain: 'pinecrest',
    biome: 'alpine',
    score: 0,
    distance: 0,
    gifts: 0,
    perfects: 0,
    maxAirtime: 0,
    maxHalfTurns: 0,
    flips: 0,
    driftSeconds: 0,
    draftSeconds: 0,
    nearMisses: 0,
    bestCombo: 0,
    maxSpeed: 0,
    smashes: 0,
    gates: 0,
    yetiHop: false,
    outranAvalanche: false,
    ghostsPassed: 0,
    grudgeBeaten: false,
    chaos: false,
    ...p,
  };
}

describe('missions', () => {
  it('always keeps three distinct missions active', () => {
    const s = newMissionState();
    expect(s.active).toHaveLength(3);
    expect(new Set(s.active.map((a) => a.id)).size).toBe(3);
  });

  it('completing a mission pays its reward and rotates in a new one', () => {
    const s = newMissionState();
    const first = s.active[0].id;
    const def = MISSIONS.find((m) => m.id === first)!;
    const r = applyRun(s, summary({ distance: 99999, perfects: 99, ghostsPassed: 9 }));
    expect(r.reward).toBeGreaterThanOrEqual(def.reward);
    expect(s.active).toHaveLength(3);
    expect(s.active.map((a) => a.id)).not.toContain(first);
    expect(r.views.find((v) => v.id === first)?.justCompleted).toBe(true);
  });

  it('progress is the best single run, not a running total', () => {
    const s = newMissionState();
    s.active = [{ id: 'gifts20', best: 0 }];
    applyRun(s, summary({ gifts: 12 }));
    expect(s.active.find((a) => a.id === 'gifts20')?.best).toBe(12);
    applyRun(s, summary({ gifts: 9 }));
    expect(s.active.find((a) => a.id === 'gifts20')?.best).toBe(12);
  });

  it('biome missions only count on their biome', () => {
    const s = newMissionState();
    s.active = [{ id: 'gates3', best: 0 }];
    const r = applyRun(s, summary({ gates: 5, biome: 'alpine' }));
    expect(r.reward).toBe(0);
    const r2 = applyRun(s, summary({ gates: 5, biome: 'blossom' }));
    expect(r2.reward).toBeGreaterThan(0);
  });
});
