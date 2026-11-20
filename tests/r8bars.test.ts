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
  // (The merge: once the career rides the game's own SimConfig, the Almanac's pool and gates and the first run, and
  // the field's rival probe, as app.ts does, runs 27 and 28, the third and fourth of day 7 on Ember after a duel
  // won, gain only passes; notes/r8-int.md.) Phase 3: the day's board refills (a contract met is replaced by one on that
  // mountain, three times a day): none dead in 30, 1 in 100.
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
  // passes and the kinds do not. With the sim lane's batch merged and the career riding the field's rival probe as the
  // app does: four kinds (dash, fork, charm, showdown), a median of 17 a run.
  it('decisions: at least four kinds of choice, and four a run', () => {
    const b = barDecisions(runs.map((r) => r.facts));
    expect(b.kinds.length).toBeGreaterThanOrEqual(4);
    expect(b.median).toBeGreaterThanOrEqual(4);
  });

  // On SIM_VERSION 9: three families (a spin, a flip, both), and the expert's best combo holds two. On the batch the
  // classic expert still said 3; the lab's expert on the air map (labpilots.ts trickster) is the bar's pilot: 18 named
  // tricks, its best combo 7 distinct, 5 at the median ride (r8-bars.ts).
  it('expression: ten named air tricks, five of them in the expert best combo', () => {
    const facts = M.mountains.MOUNTAINS.map((_: unknown, m: number) => firstRun(M, 'trickster-expert', 4242, m));
    const b = barExpression(M, facts);
    expect(b.vocabulary.length).toBeGreaterThanOrEqual(10);
    expect(b.bestComboFamilies).toBeGreaterThanOrEqual(5);
  });

  // Judged on the prompted first-timers (labpilots.ts prompted: they follow the stomp ring and the lantern's prompt
  // with the same slow hands); the blind pilots are the harness's floor. With the spine's opener the prompted novice
  // met all three on 5 of 6 seeds and the prompted clumsy pilot on 2 of 6 (SIM_VERSION 9). With the sim lane's batch
  // merged (a first run's wider stomp window, SimConfig.firstRun) both meet all three on these two seeds.
  it('first minute: a pass by 20 s, a perfect by 45 s, a dash by 60 s, for the prompted clumsy pilot and novice', () => {
    for (const pilot of ['clumsy-prompted', 'novice-prompted']) for (const seed of [1234, 1271]) expect(barFirstMinute(firstRun(M, pilot, seed)).ok, `${pilot} ${seed}`).toBe(true);
  });

  // The opener (pacer.ts) left the line a moment before you and is back behind you about 11 s in: the prompted
  // novice's first shown pass comes by 20 s (before it, 24 to 54 s).
  it('first minute: the opener gives the prompted novice a pass by 20 s', () => {
    for (const seed of [1234, 1271]) expect(barFirstMinute(firstRun(M, 'novice-prompted', seed)).pass ?? 99).toBeLessThanOrEqual(20);
  });

  // The race has a floor (phase 3): a first run's field is laid round what a run that only steers rides there
  // (field.ts FIRST_RUN_PACE), and the riders ride their own pace over the last stage. Before: a hands-off run reached
  // the podium on 9 of 10 first runs, a steer-only one on 8 of 10.
  it('the race has a floor: a run that does nothing or only steers is off the podium on every first run', () => {
    for (const pilot of ['hands-off', 'line']) for (let m = 0; m < M.mountains.MOUNTAINS.length; m++) {
      const f = firstRun(M, pilot, 1234, m);
      const you = { time: f.time, distance: f.distance };
      const ahead = f.field.filter((q) => q.kind !== 'you' && M.standing.aheadOf({ time: q.time, distance: q.distance }, you)).length;
      expect(ahead + 1, `${pilot} on ${M.mountains.MOUNTAINS[m].id}`).toBeGreaterThan(3);
    }
  });

  it('the race has a floor: the steady time a first run is laid round is what a steering-only run rides', () => {
    for (let m = 0; m < M.mountains.MOUNTAINS.length; m++) {
      const id = M.mountains.MOUNTAINS[m].id;
      const f = firstRun(M, 'line', 1234, m);
      expect(Math.abs((f.time ?? 0) / M.field.FIRST_RUN_PACE[id] - 1), id).toBeLessThan(0.06);
    }
  });

  // The Hollow King rode as an ordinary ghost on Pinecrest's second run (DECISIONS 367): he is met first in his duel.
  it('The Hollow King rides in no field before his duel', () => {
    let beaten = 0;
    for (const r of runs) {
      if (beaten < 11) expect(r.facts.field.some((q) => q.name === 'The Hollow King'), `run ${r.n}`).toBe(false);
      beaten = r.after.twelve;
    }
  });

  it('first minute: the clumsy pilot finishes at least 26 of 30', () => {
    const f = clumsyFinishes(M, 6);
    expect(f.of).toBe(30);
    expect(f.finished).toBeGreaterThanOrEqual(26);
  });

  // Before the spine Lanternfall had nothing left at run 50 but two legends. With it every mountain has something
  // unseen in reach: a variant, a rival's record, a star or its mirror, and Lanternfall opens to ride on Almanac page
  // 21 (the mid pilot's about run 40) even before the eleventh duel.
  it('still new: something unseen and reachable next run on every mountain', () => {
    const b = barStillNew(M, runs, 50);
    for (const m of b) expect(m.reachable.length, m.mountain).toBeGreaterThan(0);
  });
});
