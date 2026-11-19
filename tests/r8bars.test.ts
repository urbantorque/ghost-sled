import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { barDecisions, barExpression, barFirstMinute, barNoDeadRuns, barOneRunAway, barStillNew, career, clumsyFinishes, firstRun, loadMods } from '../scripts/playtest/r8career';

// Round 8's bars (prompts/round-8-beauty-and-the-hook.md section 2), at a size the suite can ride: one career of
// the mid pilot (50 runs, the Daily from its second day and the Cup from its second week), first runs by the
// prompted clumsy pilot and novice, the clumsy pilot's thirty, and five expert runs. scripts/playtest/r8-bars.ts
// rides the full sizes (100-run careers for the mid pilot and the novice, the run 50 bar at run 50) and prints the
// numbers.
//
// A bar the build does not meet is `it.fails`, so the suite stays green and the bar is still asserted: when the
// round's work makes it pass, `it.fails` turns red and must become `it`. Each says what it measured before the
// round's work and with milestone 3's spine on the SIM_VERSION 9 sim (notes/r8-spine.md has the tables).

const M = await loadMods('.', (p) => import(/* @vite-ignore */ `../${p}`));
// (The Daily's and the Cup's generated pools are kept in the temp folder, by course seed and sim version.)
const runs = career(M, { pilot: 'mid', runs: 50, perDay: 4, daily: true, cup: true, cacheDir: join(tmpdir(), 'ghostsled-r8bars') });
const first30 = runs.slice(0, 30);

describe('round 8 bars', () => {
  it('the career settles every run into the save as the app does', () => {
    expect(runs).toHaveLength(50);
    expect(runs.some((r) => r.facts.key.startsWith('daily:'))).toBe(true);
    expect(runs.some((r) => r.facts.key.startsWith('cup:'))).toBe(true);
    expect(runs[runs.length - 1].after.lifetimeGifts).toBeGreaterThan(0);
    expect(runs[runs.length - 1].after.page).toBeGreaterThan(0);
    for (const r of runs) expect(r.results.primary.length).toBeGreaterThan(0);
  });

  // Before the spine: 5 of the mid pilot's first 30 runs were dead. With it: none (a page, a sticker, the day's
  // flame, a contract or a mission on every one), and 5 in its first 100. Counted as the main lane ruled: a ladder
  // rung, a star that is not a medal, a pass and a best do not count (DEAD_RUN_COUNTS).
  it('no dead runs: every one of the first 30 gains something the save keeps', () => {
    const b = barNoDeadRuns(first30);
    expect(b.deadStrict).toEqual([]);
  });

  // Before the spine the button named a reachable goal after 38 of the mid pilot's 100 runs; with the spine's rule
  // (game/goals.ts) and its form contract, after all 100, and all 100 of the novice's.
  it('always one run away: after every run the one button names a goal reachable next run', () => {
    const b = barOneRunAway(first30);
    expect(b.primaryNames).toBe(b.runs);
  });

  // On SIM_VERSION 9: two kinds (a dash, and a fork's channel); a mid run makes about a dozen dashes, so the count
  // passes and the kinds do not. The sim lane's charm gates and showdowns are what make four (its batch).
  it.fails('decisions: at least four kinds of choice, and four a run', () => {
    const b = barDecisions(runs.map((r) => r.facts));
    expect(b.kinds.length).toBeGreaterThanOrEqual(4);
    expect(b.median).toBeGreaterThanOrEqual(4);
  });

  // On SIM_VERSION 9: three families (a spin, a flip, both), and the expert's best combo holds two. The sim lane's
  // eighteen named tricks are its batch's.
  it.fails('expression: ten named air tricks, five of them in the expert best combo', () => {
    const facts = M.mountains.MOUNTAINS.map((_: unknown, m: number) => firstRun(M, 'expert', 4242, m));
    const b = barExpression(M, facts);
    expect(b.vocabulary.length).toBeGreaterThanOrEqual(10);
    expect(b.bestComboFamilies).toBeGreaterThanOrEqual(5);
  });

  // Judged on the prompted first-timers (labpilots.ts prompted: they follow the stomp ring and the lantern's prompt
  // with the same slow hands); the blind pilots are the harness's floor. With the spine's opener the prompted novice
  // meets all three on 5 of 6 seeds and the prompted clumsy pilot on 2 of 6: its first pass and first dash come late
  // after an early fall, which the sim lane's first-run stomp window and a person at the keys are left to settle.
  it.fails('first minute: a pass by 20 s, a perfect by 45 s, a dash by 60 s, for the prompted clumsy pilot and novice', () => {
    for (const pilot of ['clumsy-prompted', 'novice-prompted']) for (const seed of [1234, 1271]) expect(barFirstMinute(firstRun(M, pilot, seed)).ok, `${pilot} ${seed}`).toBe(true);
  });

  // The opener (pacer.ts) puts a rider ahead off the line and behind you by 250 m: the prompted novice's first shown
  // pass comes by 20 s (before it, 24 to 54 s).
  it('first minute: the opener gives the prompted novice a pass by 20 s', () => {
    for (const seed of [1234, 1271]) expect(barFirstMinute(firstRun(M, 'novice-prompted', seed)).pass ?? 99).toBeLessThanOrEqual(20);
  });

  it('first minute: the clumsy pilot finishes at least 26 of 30', () => {
    const f = clumsyFinishes(M, 6);
    expect(f.of).toBe(30);
    expect(f.finished).toBeGreaterThanOrEqual(26);
  });

  // Before the spine Lanternfall had nothing left at run 50 but two legends. With it every open mountain has its
  // mirror, rivals' records or stars in reach, and Lanternfall is still locked at run 50 for the mid pilot (ten of The
  // Twelve down, the next duel 0.7 s out of reach). At run 30 it held: the next duel was in reach then.
  it.fails('still new: something unseen and reachable next run on every mountain', () => {
    const b = barStillNew(M, runs, 50);
    for (const m of b) expect(m.reachable.length, m.mountain).toBeGreaterThan(0);
  });
});
