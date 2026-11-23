// Round 9, the garage lane (milestone 0): the economy table, today's garage and the proposed one, for the mid pilot
// and the novice at runs 1, 5, 20, 50 and 100.
//
// Two steps, so the slow one runs once:
//   npx tsx scripts/playtest/r9-garage-economy.ts --ride [--runs 100] [--root <checkout>]
//       rides each pilot's career on the real sim through the game layer (r8career.ts, the bars harness; take the
//       heavy slot) and keeps, run by run, what the proposed garage's rules read: lifetime gifts, the Almanac's pages,
//       the month's chapter, each mountain's mastery stars, the stage lines ridden, and what the harness's own
//       cheapest-first spender bought from today's shelves. Written to --out (default under the main checkout's
//       shots/r9/garage/economy, git-ignored).
//   npx tsx scripts/playtest/r9-garage-economy.ts [--json prototypes/r9/garage/economy.json]
//       reads that back and spends it: today's garage by the harness's rule (the cheapest piece, again while the
//       wallet holds), and the proposed garage (prototypes/r9/garage/catalogue.ts) by its own player's rule
//       (catalogue.ts spendProposed). Prints the tables and writes the page's copy.
//
// Gifts are never what a run is ridden with: the career always rides the Pine Flyer and its income does not depend
// on what is bought, so one ride serves every spender (a page 5 sled bought early pays nothing either way).
//
// What is approximate: the harness's own list (r8career.ts header): the pilots never get better, nobody revives or
// doubles, a pass pays its base gifts once. A chapter's experience is followed the way rank.ts settles it from the
// run's own XP (this month's, then the oldest unfinished).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const OUT = opt('out', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/garage/economy/careers.json');

/** One run as the proposed garage's rules read it. */
export interface EconRun {
  n: number;
  day: string;
  /** The save key and named mountain id ('' for a Daily or a Cup). */
  key: string;
  mountain: string;
  finished: boolean;
  /** Stage lines crossed (0 to 3). */
  stages: number;
  /** Gifts earned to date (the harness never spends lifetime). */
  life: number;
  /** The harness's own wallet after its cheapest-first spend, and the pieces it held then (today's garage). */
  wallet: number;
  bought: number;
  boughtNow: string[];
  wanted: { pieces: number; gifts: number };
  /** Almanac pages opened. */
  claimed: number;
  /** XP the run paid (for the month's chapter). */
  xp: number;
  /** Mastery stars held on each named mountain after the run, and each board's size. */
  stars: Record<string, number>;
  open: string[];
  twelve: number;
}

export interface EconCareer {
  pilot: string;
  runs: EconRun[];
  boards: Record<string, number>;
}

async function ride(): Promise<void> {
  const { career, loadMods } = await import('./r8career');
  const root = resolve(opt('root', '.'));
  const runs = +opt('runs', '100');
  const cache = opt('cache', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/spine/cache');
  const M = await loadMods(root);
  // Each mountain's board, as mastery.ts lays it (the same for everyone).
  const boards: Record<string, number> = {};
  for (const mt of M.mountains.MOUNTAINS) {
    const course = new M.sim.Sim({ seed: mt.seed, chaos: { mood: 0, event: 0, seed: 1 }, sled: 0 }).course;
    boards[mt.id] = M.mastery.masteryBoard(course, mt.id, M.mastery.emptyMastery(), 0).length;
  }
  const out: EconCareer[] = [];
  for (const pilot of opt('pilots', 'mid,novice').split(',')) {
    const t = performance.now();
    const rs = career(M, { pilot, runs, daily: true, cup: true, cacheDir: cache, perDay: pilot === 'mid' ? 4 : 3 });
    const econ: EconRun[] = rs.map((r) => {
      const stars: Record<string, number> = {};
      for (const mt of M.mountains.MOUNTAINS) {
        const rec = M.mastery.readMastery(r.after.mastery?.[mt.id]);
        stars[mt.id] = rec.gates.length + rec.moments.length + rec.riders.length + (rec.clean ? 1 : 0) + (r.after.climb?.[mt.id]?.medal ?? 0);
      }
      return {
        n: r.n,
        day: r.day,
        key: r.facts.key,
        mountain: r.facts.mi >= 0 ? r.facts.mountainId : '',
        finished: r.facts.finished,
        stages: r.facts.stageSeconds.length,
        life: r.after.lifetimeGifts,
        wallet: r.after.gifts,
        bought: r.after.bought,
        boughtNow: r.after.boughtNow,
        wanted: r.after.wanted,
        claimed: r.after.claimed,
        xp: r.xp,
        stars,
        open: r.after.open,
        twelve: r.after.twelve,
      };
    });
    out.push({ pilot, runs: econ, boards });
    console.log(`${pilot}: ${rs.length} runs in ${((performance.now() - t) / 1000).toFixed(1)} s, lifetime gifts ${econ[econ.length - 1]?.life}`);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`written ${OUT}`);
}

async function tables(): Promise<void> {
  const careers = JSON.parse(readFileSync(OUT, 'utf8')) as EconCareer[];
  const { economyReport } = await import('../../prototypes/r9/garage/economy');
  const rep = economyReport(careers);
  console.log(rep.text);
  const json = opt('json', '');
  if (json) {
    writeFileSync(resolve(json), JSON.stringify(rep.data, null, 1));
    console.log(`written ${json}`);
  }
}

if (argv.includes('--ride')) await ride();
else await tables();
