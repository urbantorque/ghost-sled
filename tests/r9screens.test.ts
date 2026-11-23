import { describe, expect, it } from 'vitest';
import { type Chunk, bareFigures, knownNames, loadingShown, repeats, vermillionFill, words } from '../scripts/playtest/r9-screenbars';
import { ALMANAC, rewardName } from '../src/game/almanac';
import { nextGoals } from '../src/game/goals';
import { MISSIONS } from '../src/game/missions';
import { defaultSave } from '../src/game/save';
import { rewardsLine } from '../src/ui/fmt';

// Round 9, the truth lane: the screen bars (prompts/round-9-clear-screens-a-garage-worth-it.md section 2) that can be
// held without a browser. The detectors r9-screenbars.ts runs over the captures are held to known cases here (these
// pass), and the bars the game's own copy can be read for without a page are written as they will have to pass,
// marked `it.fails` because they fail on today's build (milestone 0 records the baseline; U2's copy pass turns them
// over). Each prints today's figure. The browser bars (words, one primary, said once, nothing lost, Run Again) are
// scripts/playtest/r9-screenbars.ts over r9-truth.js's captures.

const at = (texts: string[][]): Chunk[] => texts.flatMap((box, b) => box.map((t) => ({ t, box: b })));

describe('the detectors', () => {
  it('count a word as any token with a letter or a digit', () => {
    expect(words(at([['GHOST', 'SLED'], ['+1 · 496 to go'], ['14', '/212']]))).toBe(8);
  });

  it('find the review figures without words, and pass a figure with its word', () => {
    const found = bareFigures(at([['Rider Rank 4'], ['Page 5', 'A new sled +1', '496 to go'], ['14', '/212'], ['1'], ['670', 'gifts'], ['Rank 1 of 87'], ['+68', 'gifts']]));
    expect(found.map((f) => f.kind).sort()).toEqual(['bare', 'bare', 'delta', 'fraction', 'page', 'rank', 'togo']);
    expect(found.some((f) => f.text === '670')).toBe(false);
    expect(found.some((f) => f.text === '+68')).toBe(false);
  });

  it('find a message said twice: a name, a figure, three words in a row', () => {
    const names = knownNames();
    expect(names).toContain('Old Wren');
    expect(names).toContain('Ember Peak');
    const r = repeats(at([['1 more ghost opens Ember Peak'], ['DUEL', 'Old Wren'], ['Best', '0:20.9'], ['Pinecrest', '0:20.9', 'best'], ['Ember Peak', 'Pass 1 more ghost'], ['NEXT OF THE TWELVE', 'Old Wren']]), names);
    expect(r.map((x) => `${x.kind}:${x.what}`).sort()).toEqual(['figure:0:20.9', 'name:Ember Peak', 'name:Old Wren', 'words:1 more ghost']);
  });

  it('find loading shown as content', () => {
    expect(loadingShown(at([['Daily Mountain', 'Nov 23', 'Finding rivals…'], ['Garage']]))).toEqual(['Finding rivals…']);
  });

  it("know the primary's vermillion from a quiet fill", () => {
    expect(vermillionFill('rgb(232, 72, 46)')).toBe(true);
    expect(vermillionFill('rgba(255, 255, 255, 0.12)')).toBe(false);
    expect(vermillionFill('rgb(42, 52, 98)')).toBe(false);
  });
});

describe('the bars on the game copy (fail today)', () => {
  // The title's Rider Rank card and the results' reward cards name a page's rewards with fmt.ts rewardsLine:
  // "A new sled +1". The bar: no figure without a word.
  it.fails('plain figures: no Almanac page is named with a bare "+N"', () => {
    const lines = ALMANAC.map((p) => rewardsLine(p.rewards.map(rewardName)));
    const bad = lines.filter((l) => bareFigures([{ t: l, box: 0 }]).length > 0);
    console.log(`  today: ${bad.length} of ${lines.length} pages are named with a bare "+N" (e.g. "${bad[0]}")`);
    expect(bad).toEqual([]);
  });

  // The results' one button names a mission's progress with goals.ts's short line; a mission met before reads "done
  // before, so again" (the review's run 1). The bar: every label is something a player says.
  it.fails('copy: no goal is said as "done before, so again"', () => {
    const odd: string[] = [];
    for (const m of MISSIONS) {
      const d = defaultSave('Rider');
      d.missions.active = [{ id: m.id, best: m.target }];
      for (const g of nextGoals(d, { key: 'pinecrest', mi: 0, day: '2026-11-23', board: null, lostTo: null, duelWon: false, dailyReady: false })) if (/so again/.test(g.short)) odd.push(`${g.text}: ${g.short}`);
    }
    console.log(`  today: ${odd.length} of ${MISSIONS.length} missions, once met, are offered as "done before, so again"`);
    expect(odd).toEqual([]);
  });
});
