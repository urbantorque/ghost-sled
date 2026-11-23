// Round 9, the truth lane: save fixtures, the mid and novice pilots' saves at runs 1, 5, 20, 50 and 100, written by
// the game layer as it really plays (r8career.ts: the real sim, every run settled into a real save through the game
// layer, a fake clock moving the days), and `fresh`, a first visit. The dev server loads one with
// `?debug&save=<name>` (src/game/devsave.ts, vite.config.ts), its days moved to today.
//   npx tsx scripts/playtest/r9-fixtures.ts [--runs 100] [--pilots mid,novice] [--out scripts/playtest/fixtures]
// Heavy: two careers of 100 runs on the real sim (take the heavy slot). The Daily's and the Cup's pools are read from
// the main checkout's shots/r8/spine/cache when r8-bars.ts has made them, else generated and kept there.
//
// What the harness settles: gifts, bests, grudges, missions, the ladder and medals, mastery, The Twelve's duels,
// unlocks, the Daily on its day, the Cup by its week, the spine (Rider Rank and the Almanac's pages, chapters,
// stickers, the flame on the fake clock's days, contracts, the league) and the garage (the cheapest piece first, as
// the gifts allow). What it does not, and what this fills (each fixture's meta says so):
//   - the hints: the coach is not stepped on a career run, so a save would have every lesson still to come. Filled
//     from what the runs did (a stomp for each perfect landing, a spin, a flip, a drift, a slipstream, a dash), and
//     the button's lessons (crouch, pop, boosted pop) as taken from run 3, which the lab pilots use;
//   - what is worn: the harness buys and never wears. The last piece bought on each shelf is worn (the sled stays the
//     one the pilot rode, sled 0, since another would change the rides the save was settled on);
//   - the mountain the title opens on: the last named mountain ridden;
//   - the name: a ghost name, as a fresh save is given one.
// Not filled (none of it is in these saves): the album's frames (pictures kept in the browser's IndexedDB, not the
// save: the album shows its painted cards), Trials (never ridden: `trials` is empty), the Long Night (`longNight`
// empty), the hours (`hours` empty: no other hour picked), mirrors ridden, a title worn, photos and clips (not saved).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CareerRun, career, loadMods } from './r8career';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const RUNS = +opt('runs', '100');
const PILOTS = opt('pilots', 'mid,novice').split(',');
const OUT = resolve(opt('out', 'scripts/playtest/fixtures'));
const CACHE = opt('cache', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/spine/cache');
const AT = [1, 5, 20, 50, 100].filter((n) => n <= RUNS);

const M = await loadMods('.');
const names = await import('../../src/bot/names');
const prng = await import('../../src/sim/prng');
const almanac = await import('../../src/game/almanac');
mkdirSync(OUT, { recursive: true });

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** The lessons a save would hold after these runs (the app's markHint and the coach's learned steps). */
function hintsFrom(hist: CareerRun[]): Record<string, number> {
  const h: Record<string, number> = {};
  const set = (k: string, n: number): void => {
    if (n > 0) h[k] = n;
  };
  const s = hist.map((r) => r.facts.sum);
  set('steer', hist.length);
  set('stomp', sum(s.map((x) => x.perfects ?? 0)));
  set('drift', s.filter((x) => (x.driftSeconds ?? 0) > 0).length);
  set('draft', s.filter((x) => (x.draftSeconds ?? 0) > 0).length);
  set('dash', sum(s.map((x) => x.dashes ?? 0)));
  set('spin', s.filter((x) => (x.maxHalfTurns ?? 0) >= 2).length);
  set('flip', s.filter((x) => (x.flips ?? 0) > 0).length);
  set('flipSpin', h.flip ?? 0);
  const button = Math.max(0, hist.length - 2);
  for (const k of ['crouch', 'pop', 'boostPop']) set(k, button);
  return h;
}

/** What the save holds, for the notes' table. */
function summary(d: Any, r: CareerRun): Record<string, unknown> {
  const opened: Any[] = almanac.rewardsOpened(d);
  const open = M.mountains.MOUNTAINS.filter((m: Any) => M.twelve.mountainOpen(d, m)).map((m: Any) => m.id);
  const features = opened.filter((x) => x.kind === 'feature').map((x) => x.feature);
  return {
    runs: d.runs,
    page: almanac.pageAt(d.rank?.xp ?? 0).page,
    pagesOpened: d.rank?.claimed ?? 0,
    xp: d.rank?.xp ?? 0,
    gifts: d.gifts,
    lifetimeGifts: d.lifetimeGifts,
    ghostsPassed: d.ghostsPassed,
    open,
    twelveBeaten: d.twelve?.beaten?.length ?? 0,
    crowned: d.twelve?.crowned === true,
    features,
    mirrors: opened.filter((x) => x.kind === 'mirror').map((x) => x.mountain),
    hours: opened.filter((x) => x.kind === 'hour').map((x) => x.mountain),
    legs: almanac.legsOpen(d),
    stickers: Object.keys(d.album?.got ?? {}).length,
    missionsDone: d.missions?.completed ?? 0,
    flame: d.flame ? { streak: d.flame.streak, best: d.flame.best, days: d.flame.days } : null,
    bests: Object.keys(d.best ?? {}).length,
    bought: r.after.bought,
    wanted: r.after.wanted,
    chapterPages: r.after.chapterPages,
    lit: (d.lit ?? []).length,
  };
}

const index: Record<string, unknown>[] = [];
writeFileSync(resolve(OUT, 'fresh.json'), JSON.stringify({ meta: { name: 'fresh', note: 'A first visit: no save at all. The switch keeps the real save untouched.' }, save: null }, null, 1) + '\n');
index.push({ name: 'fresh' });

for (const pilot of PILOTS) {
  const t0 = performance.now();
  const hist: CareerRun[] = [];
  const bought: string[] = [];
  career(M, {
    pilot,
    runs: RUNS,
    daily: true,
    cup: true,
    cacheDir: CACHE,
    perDay: pilot === 'mid' ? 4 : 3,
    onSave: (r, live) => {
      hist.push(r);
      bought.push(...r.after.boughtNow);
      if (!AT.includes(r.n)) return;
      const d = JSON.parse(JSON.stringify(live));
      d.name = names.ghostName(new prng.Rng(prng.hashString(`r9-fixture-${pilot}`)));
      d.hints = hintsFrom(hist);
      // Wear the last piece bought on each shelf.
      const wear: Record<string, string> = { hat: 'hat', scarf: 'scarf', trail: 'trail', sound: 'sound', paint: 'paint' };
      for (const id of bought) {
        const [shelf, item] = id.split(':');
        if (wear[shelf]) d[wear[shelf]] = item;
      }
      const lastNamed = [...hist].reverse().find((x) => x.facts.mi >= 0);
      if (lastNamed) d.mountain = lastNamed.facts.mountainId;
      const name = `${pilot}-${r.n}`;
      const meta = {
        name,
        pilot,
        run: r.n,
        day: r.day,
        made: 'scripts/playtest/r9-fixtures.ts on scripts/playtest/r8career.ts',
        perDay: pilot === 'mid' ? 4 : 3,
        filled: ['hints (from the runs)', 'worn (the last piece bought on each shelf)', 'mountain (the last ridden)', 'name'],
        notSettled: ['album frames (IndexedDB)', 'trials', 'longNight', 'hours picked', 'mirrors ridden', 'title worn', 'photos and clips'],
        summary: summary(d, r),
      };
      writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify({ meta, save: d }) + '\n');
      index.push(meta);
      console.log(`  ${name}  day ${r.day}  ${JSON.stringify(meta.summary)}`);
    },
  });
  console.log(`${pilot}: ${hist.length} runs in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
writeFileSync(resolve(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
