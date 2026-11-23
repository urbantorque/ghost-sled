// Round 9, the screens lane: when each system first reaches a player, on the lab's mid and novice careers (r8career.ts:
// the real sim, every run settled into a real save through the game layer), and what the title and the results would
// carry at runs 1, 5, 20 and 50. The information plan introduces each system once, in one line, on the run it arrives:
// this says which run that is. A career is heavy work: run it in the heavy slot.
//   npx tsx scripts/playtest/r9-firsts.ts [--runs 100] [--json out.json] [--cache <dir>]
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CareerRun, career, loadMods } from './r8career';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const RUNS = +opt('runs', '100');
const CACHE = opt('cache', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/spine/cache');
const OUT = opt('json', '');
const M = await loadMods(resolve('.'));

/** The Almanac pages that open a system (game/almanac.ts ALMANAC). */
const PAGE_OPENS: Array<[number, string]> = [
  [1, 'second charm gate'],
  [2, 'daily contracts'],
  [3, 'Spirit Album'],
  [4, 'third charm gate'],
  [5, 'Whirl Saucer (a sled)'],
  [6, 'call your rival'],
  [8, 'Pinecrest at Dusk (an hour)'],
  [9, 'mirror Pinecrest'],
  [10, 'the Long Night'],
  [15, 'mirror Frostfang'],
  [21, 'Lanternfall to ride'],
  [35, 'Trials'],
];

interface Firsts {
  pilot: string;
  runs: number;
  firsts: Record<string, { run: number; day: string } | null>;
  at: Record<number, Record<string, unknown>>;
  primaries: Record<string, number>;
}

function study(pilot: string): Firsts {
  const runs: CareerRun[] = career(M, { pilot, runs: RUNS, daily: true, cup: true, cacheDir: CACHE, perDay: pilot === 'mid' ? 4 : 3 });
  const firsts: Firsts['firsts'] = {};
  const mark = (k: string, r: CareerRun): void => {
    if (!firsts[k]) firsts[k] = { run: r.n, day: r.day };
  };
  const primaries: Record<string, number> = {};
  const at: Firsts['at'] = {};
  for (const r of runs) {
    const a = r.after;
    for (const [p, what] of PAGE_OPENS) if (a.page >= p) mark(`page ${p}: ${what}`, r);
    for (const m of a.open) mark(`mountain open: ${m}`, r);
    if (a.twelve >= 1) mark('a duel of The Twelve won', r);
    if (r.facts.key.startsWith('daily:')) mark('a Daily ridden', r);
    if (r.facts.key.startsWith('cup:')) mark('a Cup ridden (the league starts)', r);
    if (a.streak >= 2) mark('the flame at 2 days', r);
    if (a.streak >= 7) mark('the flame at 7 days', r);
    if (a.missions >= 1) mark('a mission finished', r);
    if (a.stickers >= 1) mark('a sticker held', r);
    if (a.chapterPages >= 1) mark('a chapter page', r);
    if (a.bought >= 1) mark('a garage piece bought (the harness buys)', r);
    if (a.stars >= 1) mark('a mastery star', r);
    for (const g of r.gains) if (g.kind === 'medal') mark('a medal', r);
    const p = r.results.spinePrimary?.kind ?? r.results.primary;
    primaries[p] = (primaries[p] ?? 0) + 1;
    if ([1, 5, 20, 50, 100].includes(r.n)) {
      at[r.n] = {
        day: r.day,
        key: r.facts.key,
        page: a.page,
        open: a.open,
        twelve: a.twelve,
        streak: a.streak,
        gifts: a.gifts,
        lifetimeGifts: a.lifetimeGifts,
        stickers: a.stickers,
        missions: a.missions,
        stars: a.stars,
        primary: r.results.spinePrimary ?? r.results.primary,
        raceLine: r.results.raceLine,
        nextUnlock: r.results.nextUnlock,
      };
    }
  }
  for (const [p, what] of PAGE_OPENS) firsts[`page ${p}: ${what}`] ??= null;
  return { pilot, runs: runs.length, firsts, at, primaries };
}

const out = ['mid', 'novice'].map(study);
for (const f of out) {
  console.log(`\n${f.pilot}: ${f.runs} runs`);
  const rows = Object.entries(f.firsts).sort((a, b) => (a[1]?.run ?? 1e9) - (b[1]?.run ?? 1e9));
  for (const [k, v] of rows) console.log(`  ${(v ? `run ${v.run}` : 'not by ' + f.runs).padEnd(14)} ${k}`);
  for (const [n, s] of Object.entries(f.at)) console.log(`  at run ${n}: ${JSON.stringify(s)}`);
  console.log(`  the one button's kinds over the career: ${JSON.stringify(f.primaries)}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 1));
