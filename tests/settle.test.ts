import { describe, expect, it } from 'vitest';
import { RunSummary, unlockedBiomes } from '../src/game/missions';
import { missionsCrossed } from '../src/game/progress';
import { Grudge, defaultSave } from '../src/game/save';
import { GrudgeOutcome, dailyLine, dailyMedalNow, grudgeLine, dailyStreakNow, medalFor, medalThresholds, prevDay, rowMargin, settleGrudge, settleRun } from '../src/game/settle';
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
    expect(down.line).toBe('Grudge settled with Mila after 3 runs.');
  });

  it('a pass settles it and elects the Next row fresh, named on the settled line with the tally', () => {
    const r = settleGrudge({ ...mila, them: 2, streak: 2 }, { youDistance: 500, rode: { distance: 620, passed: true }, next: next('Tess', 560) });
    expect(r.settled).toBe(true);
    expect(r.nemesisDown).toBe(false);
    expect(r.grudge).toMatchObject({ name: 'Tess', them: 1, streak: 1, by: 60, distance: 560 });
    // The successor is introduced where the Rematch button will name it, as the new grudge: never as
    // 'next' (the race list's NEXT tag can sit on another row), and the tally stays.
    expect(r.line).toBe('Grudge settled with Mila after 2 runs. New grudge: Tess.');
    expect(settleGrudge(mila, { youDistance: 500, rode: { distance: 620, passed: true }, next: next('Tess', 560) }).line).toBe('Grudge settled with Mila. New grudge: Tess.');
  });

  it('a settled grudge never elects itself again, even when its whole run went further', () => {
    // You passed Mila live and crashed at 783 m; Mila's run went 846 m, so it is still the Next row.
    const milaRow = { ...next('Mila', 846), record: 'rec-Mila' };
    const tess = next('Tess', 900);
    const r = settleGrudge(mila, { youDistance: 783, rode: { distance: 846, passed: true }, next: milaRow, ahead: [milaRow, tess] });
    expect(r.settled).toBe(true);
    expect(r.line).toBe('Grudge settled with Mila. New grudge: Tess.');
    expect(r.grudge).toMatchObject({ name: 'Tess', them: 1, streak: 1, by: 117 });
    // Nobody else went further: no grudge rather than the one you just settled.
    expect(settleGrudge(mila, { youDistance: 783, rode: { distance: 846, passed: true }, next: milaRow, ahead: [milaRow] }).grudge).toBeNull();
    // An unsettled repeat winner stays, as before.
    expect(settleGrudge(mila, { youDistance: 783, rode: { distance: 846, passed: false }, next: milaRow, ahead: [milaRow, tess] }).grudge).toMatchObject({ name: 'Mila', them: 2 });
  });

  it('a margin under 1 m says so (the race rows read the same distance)', () => {
    const r = settleGrudge(null, { youDistance: 489.3, rode: null, next: next('MarmotMateo', 489.4) });
    expect(r.line).toBe('MarmotMateo beat you by less than 1 m. MarmotMateo will be waiting.');
    expect(grudgeLine('Tess', 1, 1.4)).toBe('Tess beat you by 1 m. Tess will be waiting.');
    expect(grudgeLine('Tess', 1, 0.2)).toBe('Tess beat you by less than 1 m. Tess will be waiting.');
  });

  it('the margin is the rows as shown, whole metres each', () => {
    // Rows of 490 m and 489 m: 1 m, though the raw gap is 0.2 m.
    expect(settleGrudge(null, { youDistance: 489.3, rode: null, next: next('MarmotMateo', 489.5) }).line).toBe('MarmotMateo beat you by 1 m. MarmotMateo will be waiting.');
    // Rows of 760 m and 753 m: 7 m, though the raw gap rounds to 8 m. The stored margin stays the raw one.
    const r = settleGrudge(null, { youDistance: 752.5, rode: null, next: next('fjord348', 759.6) });
    expect(r.line).toBe('fjord348 beat you by 7 m. fjord348 will be waiting.');
    expect(r.grudge).toMatchObject({ by: 7, distance: 759.6 });
    expect(rowMargin(759.6, 752.5)).toBe(7);
  });

  it('out-distancing it settles it too', () => {
    const r = settleGrudge(mila, { youDistance: 700, rode: { distance: 458, passed: false }, next: null });
    expect(r.settled).toBe(true);
    expect(r.line).toBe('Grudge settled with Mila.');
  });

  it('elects the rival you were racing when you fell, ahead or behind, but never the pace rider', () => {
    const pace = { ...next('SparkleCedar', 1898), role: 'pace' as const, gapAtCrash: 13 };
    const pack = { ...next('RidgeUlla', 820), role: 'pack' as const, gapAtCrash: -60 };
    // SparkleCedar was 13 m ahead as you fell, but it is the pace rider (its whole run went 1,145 m
    // further, and it pulled away all of a novice's next run): the pack ghost within reach is elected.
    const a = settleGrudge(null, { youDistance: 753, rode: null, next: pack, ahead: [pack, pace] });
    expect(a.grudge).toMatchObject({ name: 'RidgeUlla', by: 67, distance: 820 });
    expect(a.line).toBe('RidgeUlla beat you by 67 m. RidgeUlla will be waiting.');
    // The nearest at the crash wins, either side; one behind rode past your wreck. The pace rider
    // nearer still is passed over.
    const fox = { ...next('fox84', 3584), role: 'pace' as const, gapAtCrash: -3 };
    const mid = { ...next('Brave Rhea', 2700), role: 'pack' as const, gapAtCrash: 20 };
    const tess = { ...next('Tess', 2650), role: 'pack' as const, gapAtCrash: -8 };
    const b = settleGrudge(null, { youDistance: 2562, rode: null, next: mid, ahead: [mid, fox, tess] });
    expect(b.grudge?.name).toBe('Tess');
    expect(b.line).toBe('Tess rode past your wreck.');
    const ahead = settleGrudge(null, { youDistance: 2562, rode: null, next: mid, ahead: [mid, fox] });
    expect(ahead.grudge?.name).toBe('Brave Rhea');
    expect(ahead.line).toBe('Brave Rhea was 20 m ahead when you fell.');
    // More than 50 m away at the crash is no longer the rival you were racing.
    const c = settleGrudge(null, { youDistance: 753, rode: null, next: pack, ahead: [{ ...mid, distance: 800, gapAtCrash: 51 }, { ...pack, gapAtCrash: -55 }] });
    expect(c.grudge?.name).toBe('Brave Rhea');
    expect(c.line).toBe('Brave Rhea beat you by 47 m. Brave Rhea will be waiting.');
    // A settled grudge's successor is picked the same way.
    const d = settleGrudge(mila, { youDistance: 753, rode: { distance: 600, passed: true }, next: pack, ahead: [pack, pace] });
    expect(d.line).toBe('Grudge settled with Mila. New grudge: RidgeUlla.');
    // Never stored: the save's grudge keeps exactly its fields.
    expect(Object.keys(a.grudge!).sort()).toEqual(['by', 'distance', 'name', 'record', 'score', 'streak', 'them']);
  });

  it('else the nearest within reach that is not the pace rider, and with none within reach no one', () => {
    const pace = { ...next('SparkleCedar', 900), role: 'pace' as const };
    const far = { ...next('Kai_on_Tour', 1300), role: 'pack' as const };
    const within = { ...next('RidgeUlla', 1000), role: 'pack' as const };
    // Reach at 700 m: max(300, 0.6 x 700) = 420 m. A pack ghost within it goes before a nearer pace rider.
    expect(settleGrudge(null, { youDistance: 700, rode: null, next: pace, ahead: [far, within, pace] }).grudge?.name).toBe('RidgeUlla');
    // Reach grows with a long run: 0.6 x 2,000 m = 1,200 m.
    const long = { ...next('Mila', 3100), role: 'pack' as const };
    const longPace = { ...next('fox84', 2500), role: 'pace' as const };
    expect(settleGrudge(null, { youDistance: 2000, rode: null, next: longPace, ahead: [longPace, long] }).grudge?.name).toBe('Mila');
    // Reach at 600 m is 360 m: Kai_on_Tour is beyond it and SparkleCedar is the pace rider, so no
    // grudge is elected: no line, and no name for the Rematch button.
    const none = settleGrudge(null, { youDistance: 600, rode: null, next: pace, ahead: [far, pace] });
    expect(none).toEqual({ grudge: null, settled: false, nemesisDown: false, line: null });
    // A grudge that did not ride keeps waiting rather than give way to one out of reach.
    expect(settleGrudge(mila, { youDistance: 600, rode: null, next: pace, ahead: [far, pace] }).grudge).toBe(mila);
    // A ghost with no role (an unplanned pick) counts as within reach like a pack ghost.
    expect(settleGrudge(null, { youDistance: 600, rode: null, next: pace, ahead: [far, pace, next('Tess', 950)] }).grudge?.name).toBe('Tess');
  });

  it('a settled grudge with nobody within reach to follow it leaves none, and keeps its tally', () => {
    // r2-fresh-08: SparkleCedar settled at 1,397 m; RidgeUlla's 2,299 m run is 902 m past it, beyond
    // the 838 m reach. The button then reads Run Again.
    const sparkle: Grudge = { name: 'SparkleCedar', score: 900, record: 'rec-SparkleCedar', them: 2, streak: 1, by: 40, distance: 1898 };
    const ridge = { ...next('RidgeUlla', 2299), role: 'pack' as const, gapAtCrash: 337 };
    const r = settleGrudge(sparkle, { youDistance: 1397, rode: { distance: 1898, passed: true }, next: { ...next('SparkleCedar', 1898), record: 'rec-SparkleCedar' }, ahead: [{ ...next('SparkleCedar', 1898), record: 'rec-SparkleCedar' }, ridge] });
    expect(r).toMatchObject({ grudge: null, settled: true, line: 'Grudge settled with SparkleCedar after 2 runs.' });
    // Within reach, the line names it as the new grudge.
    const near = settleGrudge(sparkle, { youDistance: 1397, rode: { distance: 1898, passed: true }, next: null, ahead: [{ ...ridge, distance: 1700 }] });
    expect(near.line).toBe('Grudge settled with SparkleCedar after 2 runs. New grudge: RidgeUlla.');
    expect(near.grudge).toMatchObject({ name: 'RidgeUlla', them: 1, streak: 1, by: 303 });
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
    expect(s.line).toBe('Grudge settled with Mila.');
  });

  it('a grudge that could not ride keeps waiting when nothing finished ahead', () => {
    const r = settleGrudge(mila, { youDistance: 900, rode: null, next: null });
    expect(r.grudge).toBe(mila);
    expect(r.line).toBeNull();
  });
});

describe('the daily medal and streak (stretch)', () => {
  const day = 'daily:2026-10-26';
  // Ten pool runs from 100 m to 1,000 m: bronze at the 40th percentile, silver the 70th, gold the 90th.
  const pool = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
  const t = medalThresholds(pool)!;

  it('thresholds sit at the 40th, 70th and 90th percentile of the pool distances', () => {
    expect(t).toEqual([460, 730, 910]);
    expect(medalThresholds([])).toBeNull();
    // A flat pool still gives three rising thresholds.
    const flat = medalThresholds([500, 500, 500])!;
    expect(flat[0]).toBeLessThan(flat[1]);
    expect(flat[1]).toBeLessThan(flat[2]);
    expect(medalFor(459, t)).toBe(0);
    expect(medalFor(460, t)).toBe(1);
    expect(medalFor(800, t)).toBe(2);
    expect(medalFor(2000, t)).toBe(3);
  });

  it('reads as one results line with the next medal to ride for', () => {
    expect(dailyLine(2, [460, 2410, 2900])).toBe('Daily: Silver. Gold at 2,900 m.');
    expect(dailyLine(1, [460, 2410, 2900])).toBe('Daily: Bronze. Silver at 2,410 m.');
    expect(dailyLine(0, [1180, 2410, 2900])).toBe('Daily: Bronze at 1,180 m.');
    expect(dailyLine(3, t)).toBe('Daily: Gold.');
  });

  it('is credited once across a revive', () => {
    const d = defaultSave('Test');
    const first = settleRun(d, summary({ mountain: 'daily', distance: 500 }), null, day, t);
    expect(first.daily).toEqual({ medal: 1, best: 1, streak: 1, line: 'Daily: Bronze. Silver at 730 m.' });
    const again = settleRun(d, summary({ mountain: 'daily', distance: 800 }), first.settlement, day, t);
    expect(again.daily).toMatchObject({ medal: 2, best: 2, streak: 1 });
    expect(again.settlement.medal).toBe(2);
    expect(d.daily).toMatchObject({ medal: 2, streak: 1, last: '2026-10-26' });
    // A second run the same day keeps the streak and the better medal.
    settleRun(d, summary({ mountain: 'daily', distance: 200 }), null, day, t);
    expect(d.daily).toMatchObject({ medal: 2, streak: 1 });
  });

  it('the streak grows day to day and resets after a missed day', () => {
    const d = defaultSave('Test');
    settleRun(d, summary({ mountain: 'daily', distance: 950 }), null, 'daily:2026-10-24', t);
    settleRun(d, summary({ mountain: 'daily', distance: 100 }), null, 'daily:2026-10-25', t);
    expect(d.daily).toMatchObject({ streak: 2, medal: 0, last: '2026-10-25' });
    expect(dailyStreakNow(d.daily, '2026-10-26')).toBe(2);
    expect(dailyMedalNow(d.daily, '2026-10-26')).toBe(0);
    // 26 skipped: the 27th starts over.
    expect(dailyStreakNow(d.daily, '2026-10-27')).toBe(0);
    settleRun(d, summary({ mountain: 'daily', distance: 950 }), null, 'daily:2026-10-27', t);
    expect(d.daily).toMatchObject({ streak: 1, medal: 3 });
    expect(dailyMedalNow(d.daily, '2026-10-27')).toBe(3);
  });

  it('counts the streak without a pool, and never touches plain runs', () => {
    const d = defaultSave('Test');
    const r = settleRun(d, summary({ mountain: 'daily', distance: 950 }), null, day);
    expect(r.daily).toEqual({ medal: 0, best: 0, streak: 1, line: null });
    expect(settleRun(d, summary({ distance: 950 }), null, 'pinecrest', t).daily).toBeUndefined();
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    expect(prevDay('2027-01-01')).toBe('2026-12-31');
    expect(prevDay('nope')).toBe('');
  });
});
