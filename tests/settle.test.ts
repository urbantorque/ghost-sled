import { describe, expect, it } from 'vitest';
import { RunSummary, unlockedBiomes } from '../src/game/missions';
import { missionsCrossed } from '../src/game/progress';
import { Grudge, defaultSave } from '../src/game/save';
import { GrudgeOutcome, settleGrudge, settleRun } from '../src/game/settle';
import type { GhostKind } from '../src/ui/contract';

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

describe('settling a run (revive guard)', () => {
  it('a revive and a second crash count the run, its passes and its stats once', () => {
    const d = defaultSave('Test');
    d.missions.active = [{ id: 'pass3', best: 0 }, { id: 'dist2000', best: 0 }, { id: 'perfect5', best: 0 }];
    const first = settleRun(d, summary({ distance: 900, ghostsPassed: 2, perfects: 1, yetiHop: true }), null);
    expect(d.runs).toBe(1);
    expect(d.ghostsPassed).toBe(2);
    expect(first.passedBefore).toBe(0);
    // Revived, rode on and crashed again: the summary covers the whole run.
    const second = settleRun(d, summary({ distance: 2100, ghostsPassed: 3, perfects: 2, yetiHop: true }), first.settlement);
    expect(d.runs).toBe(1);
    expect(d.ghostsPassed).toBe(3);
    expect(second.passedBefore).toBe(2);
    expect(d.stats.perfects).toBe(2);
    expect(d.stats.yetiHops).toBe(1);
  });

  it('missions are judged once on the final summary, never twice by the same run', () => {
    const d = defaultSave('Test');
    d.missions.active = [{ id: 'dist800', best: 0 }, { id: 'pass1', best: 0 }, { id: 'perfect2', best: 0 }];
    const gifts0 = d.gifts;
    const first = settleRun(d, summary({ distance: 900 }), null);
    expect(first.missionReward).toBe(25);
    expect(d.gifts - gifts0).toBe(25);
    // The same run settles again with one more pass: dist800 is not paid twice, pass1 pays once.
    const second = settleRun(d, summary({ distance: 1000, ghostsPassed: 1 }), first.settlement);
    expect(second.missionReward).toBe(25);
    expect(d.gifts - gifts0).toBe(50);
    expect(second.missions.filter((m) => m.justCompleted).map((m) => m.id).sort()).toEqual(['dist800', 'pass1']);
    // Missions that rotated in after the first settlement are not completed by the same run.
    const third = settleRun(d, summary({ distance: 1000, ghostsPassed: 1 }), second.settlement);
    expect(third.missionReward).toBe(0);
    expect(d.gifts - gifts0).toBe(50);
    expect(d.missions.active).toHaveLength(3);
  });

  it('a mission that popped mid-run is credited exactly once, by settleRun', () => {
    const d = defaultSave('Test');
    d.missions.active = [{ id: 'pass1', best: 0 }, { id: 'dist2000', best: 0 }, { id: 'perfect5', best: 0 }];
    const gifts0 = d.gifts;
    const ctx = { unlockedBiomes: unlockedBiomes(0) };
    const popped = new Set<string>();
    for (const m of missionsCrossed(d.missions, summary({ ghostsPassed: 1 }), popped, ctx)) popped.add(m.id);
    expect([...popped]).toEqual(['pass1']);
    // The pop is display only: nothing is credited until the results.
    expect(d.gifts).toBe(gifts0);
    const first = settleRun(d, summary({ ghostsPassed: 1, distance: 600 }), null);
    expect(d.gifts - gifts0).toBe(25);
    // Revived: the run's starting missions (missionsBefore) still say pass1 popped, and nothing pops twice.
    expect(missionsCrossed(first.settlement.missionsBefore, summary({ ghostsPassed: 2 }), popped, ctx)).toEqual([]);
    settleRun(d, summary({ ghostsPassed: 2, distance: 900 }), first.settlement);
    expect(d.gifts - gifts0).toBe(25);
  });
});

describe('run-end distances (runDists)', () => {
  it('pushes on the first settle, replaces on a re-settle, keeps the last 5', () => {
    const d = defaultSave('Test');
    delete d.runDists;
    let s = settleRun(d, summary({ distance: 400 }), null, 'pinecrest');
    expect(d.runDists).toEqual({ pinecrest: [400] });
    s = settleRun(d, summary({ distance: 650.25 }), s.settlement, 'pinecrest');
    expect(d.runDists!.pinecrest).toEqual([650.3]);
    for (const dist of [100, 200, 300, 500, 600]) settleRun(d, summary({ distance: dist }), null, 'pinecrest');
    expect(d.runDists!.pinecrest).toEqual([100, 200, 300, 500, 600]);
    const last = settleRun(d, summary({ distance: 700 }), null, 'pinecrest');
    expect(d.runDists!.pinecrest).toEqual([200, 300, 500, 600, 700]);
    settleRun(d, summary({ distance: 720 }), last.settlement, 'pinecrest');
    expect(d.runDists!.pinecrest).toEqual([200, 300, 500, 600, 720]);
  });

  it('keys a daily run by its day and prunes the other days', () => {
    const d = defaultSave('Test');
    d.runDists = { 'daily:2026-10-20': [300], pinecrest: [500] };
    d.best['daily:2026-10-20'] = { score: 10, distance: 300, record: '' };
    d.grudge['daily:2026-10-20'] = { name: 'Old', score: 1, record: '' };
    settleRun(d, summary({ mountain: 'daily', distance: 800 }), null, 'daily:2026-10-26');
    expect(d.runDists).toEqual({ pinecrest: [500], 'daily:2026-10-26': [800] });
    expect(d.best['daily:2026-10-20']).toBeUndefined();
    expect(d.grudge['daily:2026-10-20']).toBeUndefined();
  });

  it('falls back to the summary mountain with no key', () => {
    const d = defaultSave('Test');
    settleRun(d, summary({ mountain: 'frostfang', distance: 321 }), null);
    expect(d.runDists!.frostfang).toEqual([321]);
  });
});

describe('the grudge (settleGrudge)', () => {
  const next = (name: string, distance: number, kind: GhostKind = 'pool') => ({ name, score: 900, record: `rec-${name}`, distance, kind });
  const mila: Grudge = { name: 'Mila', score: 1200, record: 'rec-Mila', them: 1, streak: 1, by: 38, distance: 458 };

  it('elects the Next row when there is no grudge, with the results line', () => {
    const r = settleGrudge(null, { youDistance: 420, rode: null, next: next('Mila', 458) });
    expect(r.grudge).toEqual({ name: 'Mila', score: 900, record: 'rec-Mila', them: 1, streak: 1, by: 38, distance: 458 });
    expect(r.settled).toBe(false);
    expect(r.line).toBe('Mila beat you by 38 m. Mila will be waiting.');
  });

  it('is idempotent from one snapshot (a revive settles the same run again)', () => {
    const snap: Grudge = { ...mila };
    const o: GrudgeOutcome = { youDistance: 400, rode: { distance: 470, passed: false }, next: next('Other', 430) };
    const a = settleGrudge(snap, o);
    const b = settleGrudge(snap, o);
    expect(b).toEqual(a);
    expect(snap).toEqual(mila);
  });

  it('a repeat winner stays, with its tally and streak up', () => {
    const r = settleGrudge(mila, { youDistance: 400, rode: { distance: 470, passed: false }, next: next('Other', 430) });
    expect(r.grudge).toMatchObject({ name: 'Mila', record: 'rec-Mila', them: 2, streak: 2, by: 70, distance: 470 });
    expect(r.settled).toBe(false);
    expect(r.line).toBe('Mila beat you 2 runs running.');
  });

  it('a streak of 3 makes a nemesis, and beating it is nemesis down', () => {
    const two: Grudge = { ...mila, them: 2, streak: 2 };
    const r = settleGrudge(two, { youDistance: 400, rode: { distance: 470, passed: false }, next: null });
    expect(r.grudge).toMatchObject({ them: 3, streak: 3 });
    expect(r.line).toBe('Mila beat you 3 runs running. Nemesis.');
    const down = settleGrudge(r.grudge, { youDistance: 900, rode: { distance: 470, passed: true }, next: null });
    expect(down.settled).toBe(true);
    expect(down.nemesisDown).toBe(true);
    expect(down.grudge).toBeNull();
    expect(down.line).toBe('You settled it with Mila after 3 runs.');
  });

  it('a pass settles it and elects the Next row fresh', () => {
    const r = settleGrudge({ ...mila, them: 2, streak: 2 }, { youDistance: 500, rode: { distance: 620, passed: true }, next: next('Tess', 560) });
    expect(r.settled).toBe(true);
    expect(r.nemesisDown).toBe(false);
    expect(r.grudge).toMatchObject({ name: 'Tess', them: 1, streak: 1, by: 60, distance: 560 });
    expect(r.line).toBe('You settled it with Mila after 2 runs.');
  });

  it('out-distancing it settles it too', () => {
    const r = settleGrudge(mila, { youDistance: 700, rode: { distance: 458, passed: false }, next: null });
    expect(r.settled).toBe(true);
    expect(r.line).toBe('You settled it with Mila.');
  });

  it('a friend or your own best is never elected', () => {
    expect(settleGrudge(null, { youDistance: 400, rode: null, next: next('Pal', 500, 'friend') }).grudge).toBeNull();
    expect(settleGrudge(null, { youDistance: 400, rode: null, next: next('Me', 500, 'you') }).grudge).toBeNull();
  });

  it('old saves without tally fields read as 1', () => {
    const old: Grudge = { name: 'Mila', score: 1200, record: 'rec-Mila' };
    const r = settleGrudge(old, { youDistance: 400, rode: { distance: 450, passed: false }, next: null });
    expect(r.grudge).toMatchObject({ them: 2, streak: 2, by: 50 });
    const s = settleGrudge(old, { youDistance: 500, rode: { distance: 450, passed: true }, next: null });
    expect(s.nemesisDown).toBe(false);
    expect(s.line).toBe('You settled it with Mila.');
  });

  it('a grudge that could not ride keeps waiting when nothing finished ahead', () => {
    const r = settleGrudge(mila, { youDistance: 900, rode: null, next: null });
    expect(r.grudge).toBe(mila);
    expect(r.line).toBeNull();
  });
});
