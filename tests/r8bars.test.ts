import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { barDecisions, barExpression, barFirstMinute, barNoDeadRuns, barOneRunAway, barStillNew, career, clumsyFinishes, firstRun, loadMods } from '../scripts/playtest/r8career';

// Round 8's bars (prompts/round-8-beauty-and-the-hook.md section 2), at a size the suite can ride: one career of
// the mid pilot (30 runs, the Daily from its second day and the Cup from its second week), first runs by the
// clumsy pilot and the novice, the clumsy pilot's thirty, and five expert runs. scripts/playtest/r8-bars.ts rides
// the full sizes (100-run careers for the mid pilot and the novice, the run 50 bar at run 50) and prints the
// numbers. Here "still new" is read at run 30, where less has been seen and fewer mountains may be open: the
// harness's figure at run 50 is the bar's.
//
// A bar today's build does not meet is `it.fails`, so the suite stays green and the bar is still asserted: when
// round 8's work makes it pass, `it.fails` turns red and must become `it`. Each says what it measured on the round
// 8 branch before any of the round's work (notes/r8-spine-design.md has the table).

const M = await loadMods('.', (p) => import(/* @vite-ignore */ `../${p}`));
// (The Daily's and the Cup's generated pools are kept in the temp folder, by course seed and sim version.)
const runs = career(M, { pilot: 'mid', runs: 30, perDay: 4, daily: true, cup: true, cacheDir: join(tmpdir(), 'ghostsled-r8bars') });
const first30 = runs;

describe('round 8 bars', () => {
  it('the career settles every run into the save as the app does', () => {
    expect(runs).toHaveLength(30);
    expect(runs.some((r) => r.facts.key.startsWith('daily:'))).toBe(true);
    expect(runs.some((r) => r.facts.key.startsWith('cup:'))).toBe(true);
    expect(runs[runs.length - 1].after.lifetimeGifts).toBeGreaterThan(0);
    for (const r of runs) expect(r.results.primary.length).toBeGreaterThan(0);
  });

  // Today: 5 of the mid pilot's first 30 runs gain nothing the save keeps (runs 14, 19, 22, 24 and 28: a pass
  // and a best at most). Early runs gain missions, stars, ranks and medals; by the third day they thin out.
  it.fails('no dead runs: every one of the first 30 gains something the save keeps', () => {
    const b = barNoDeadRuns(first30);
    expect(b.deadStrict).toEqual([]);
  });

  // Today: after most runs a goal was within reach, but the one button names a rider (Rematch, Race, Duel) and never
  // a mission, a medal or the Daily; it named a reachable goal after about half the runs.
  it.fails('always one run away: after every run the one button names a goal reachable next run', () => {
    const b = barOneRunAway(first30);
    expect(b.primaryNames).toBe(b.runs);
  });

  // Today: two kinds (a dash, and a fork's channel on the courses that have one); a mid run makes about a dozen
  // dashes, so the count passes and the kinds do not.
  it.fails('decisions: at least four kinds of choice, and four a run', () => {
    const b = barDecisions(runs.map((r) => r.facts));
    expect(b.kinds.length).toBeGreaterThanOrEqual(4);
    expect(b.median).toBeGreaterThanOrEqual(4);
  });

  // Today: three families (a spin, a flip, both), and the expert's best combo holds two.
  it.fails('expression: ten named air tricks, five of them in the expert best combo', () => {
    const facts = M.mountains.MOUNTAINS.map((_: unknown, m: number) => firstRun(M, 'expert', 4242, m));
    const b = barExpression(M, facts);
    expect(b.vocabulary.length).toBeGreaterThanOrEqual(10);
    expect(b.bestComboFamilies).toBeGreaterThanOrEqual(5);
  });

  // Today: the first shown pass comes at 24 to 45 s and the first dash at 27 to 66 s.
  it.fails('first minute: a pass by 20 s, a perfect by 45 s, a dash by 60 s, for the clumsy pilot and the novice', () => {
    for (const pilot of ['clumsy', 'novice']) for (const seed of [1234, 1271]) expect(barFirstMinute(firstRun(M, pilot, seed)).ok).toBe(true);
  });

  it('first minute: the clumsy pilot finishes at least 26 of 30', () => {
    const f = clumsyFinishes(M, 6);
    expect(f.of).toBe(30);
    expect(f.finished).toBeGreaterThanOrEqual(26);
  });

  // Today: Lanternfall is still locked at run 50 (The Twelve open it), so it has nothing to reach. (Read at run 30
  // here; the harness reads it at run 50.)
  it.fails('still new: something unseen and reachable next run on every mountain', () => {
    const b = barStillNew(M, runs, 30);
    for (const m of b) expect(m.reachable.length, m.mountain).toBeGreaterThan(0);
  });
});
