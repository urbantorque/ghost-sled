// Round 8's bars (prompts/round-8-beauty-and-the-hook.md section 2), measured in node with no browser: careers of
// the lab's pilots on the real sim, each run settled into a real save through the game layer (r8career.ts), and
// the bars read off them, one function each. It loads the build from `--root <checkout>`, so one plan rides two
// builds. tests/r8bars.test.ts holds the same bars at a small size.
//   npx tsx scripts/playtest/r8-bars.ts [--root <checkout>] [--runs 100] [--small] [--json out.json]
//       [--no-daily] [--no-cup] [--cache <dir>] [--only nodead,oneaway,decisions,expression,first,new] [--pilots mid,novice]
// --small rides a few runs of each (about a minute); the full size is 100 runs for the mid pilot and the novice,
// 30 for the clumsy pilot's finishes, six first runs each for the clumsy pilot and the novice, and ten expert runs.
// Generated Daily and Cup pools are kept in --cache (default: the main checkout's shots/r8/spine/cache), so a
// second sitting does not ride the bots again.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type CareerRun, type RunFacts, barDecisions, barExpression, barFirstMinute, barNoDeadRuns, barOneRunAway, barStillNew, career, clumsyFinishes, firstRun, loadMods } from './r8career';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const SMALL = argv.includes('--small');
const ROOT = resolve(opt('root', '.'));
const RUNS = +opt('runs', SMALL ? '8' : '100');
const SEEDS = +opt('seeds', SMALL ? '2' : '6');
const CACHE = opt('cache', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/spine/cache');
const OUT = opt('json', '');
const ONLY = new Set(opt('only', 'nodead,oneaway,decisions,expression,first,new').split(','));
const DAILY = !argv.includes('--no-daily');
const CUP = !argv.includes('--no-cup');

const M = await loadMods(ROOT);
const t0 = performance.now();
const secs = (t: number): string => `${((performance.now() - t) / 1000).toFixed(1)} s`;
const pct = (a: number, b: number): string => `${a}/${b} (${b ? Math.round((100 * a) / b) : 0}%)`;
const json: Record<string, unknown> = { root: ROOT, runs: RUNS, seeds: SEEDS, small: SMALL };
console.log(`root ${ROOT}  sim v${M.sim.SIM_VERSION}  careers of ${RUNS} runs  ${SEEDS} seeds${M.rank ? '  (rank.ts found)' : ''}`);

const careers: Record<string, CareerRun[]> = {};
const ride = (pilot: string): CareerRun[] => {
  if (careers[pilot]) return careers[pilot];
  const t = performance.now();
  const runs = career(M, { pilot, runs: RUNS, daily: DAILY, cup: CUP, cacheDir: CACHE, perDay: pilot === 'mid' ? 4 : 3 });
  console.log(`  (${pilot}: ${runs.length} runs in ${secs(t)}, ${runs[runs.length - 1]?.day ?? ''})`);
  return (careers[pilot] = runs);
};

if (ONLY.has('nodead')) {
  const t = performance.now();
  const runs = ride('mid').slice(0, 30);
  const b = barNoDeadRuns(runs);
  console.log(`\nNO DEAD RUNS (mid, first ${runs.length} runs; bar: none dead)`);
  console.log(`  dead, counting only what the save keeps (rank, unlock, sticker, duel, medal or star, streak day, mission): ${b.deadStrict.length}  runs ${b.deadStrict.join(' ') || '-'}`);
  console.log(`  dead, counting a pass and a best too: ${b.deadLoose.length}  runs ${b.deadLoose.join(' ') || '-'}`);
  console.log(`  what the strictly dead runs had instead: ${Object.entries(b.lacked).map(([k, v]) => `${k}:${v}`).join(' ') || '-'}`);
  console.log(`  gains by kind over the ${runs.length}: ${Object.entries(b.byKind).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  // Past the bar's thirty, as the boards fill: dead runs by blocks of ten.
  const all = ride('mid');
  const blocks: string[] = [];
  for (let i = 0; i < all.length; i += 10) blocks.push(`${i + 1}-${Math.min(all.length, i + 10)}:${barNoDeadRuns(all.slice(i, i + 10)).deadStrict.length}`);
  console.log(`  dead (strict) by ten runs over all ${all.length}: ${blocks.join(' ')}`);
  console.log(`  (${secs(t)})`);
  json.noDead = b;
}

if (ONLY.has('oneaway')) {
  const t = performance.now();
  console.log(`\nALWAYS ONE RUN AWAY (first ${RUNS} runs; bar: every run has a goal reachable next run, and the one button names it)`);
  const out: Record<string, unknown> = {};
  for (const pilot of opt('pilots', 'mid,novice').split(',')) {
    const b = barOneRunAway(ride(pilot).slice(0, 100));
    console.log(`  ${pilot.padEnd(7)} a near goal existed ${pct(b.withNear, b.runs)}   the button named one ${pct(b.primaryNames, b.runs)}   any line of the card named one ${pct(b.anywhere, b.runs)}`);
    console.log(`          near goals by kind: ${Object.entries(b.kinds).map(([k, v]) => `${k}:${v}`).join(' ')}   runs with none: ${b.none.slice(0, 20).join(' ')}${b.none.length > 20 ? ' ...' : ''}`);
    const buttons: Record<string, number> = {};
    for (const r of ride(pilot)) {
      const w = r.results.primary.split(' ')[0];
      buttons[w] = (buttons[w] ?? 0) + 1;
    }
    console.log(`          the button today: ${Object.entries(buttons).map(([k, v]) => `${k}:${v}`).join(' ')}`);
    out[pilot] = b;
  }
  console.log(`  (${secs(t)})`);
  json.oneAway = out;
}

if (ONLY.has('decisions')) {
  const facts: RunFacts[] = ride('mid').map((r) => r.facts);
  const b = barDecisions(facts);
  console.log(`\nDECISIONS (mid, ${facts.length} runs; bar: at least four choices a run that change how the rest plays)`);
  console.log(`  kinds: ${b.kinds.join(', ') || '-'}   by kind: ${Object.entries(b.byKind).map(([k, v]) => `${k}:${v}`).join(' ')}`);
  console.log(`  per run: median ${b.median}, min ${Math.min(...b.perRun)}, max ${Math.max(...b.perRun)}   (today a dash is the one kind, and a fork's channel where a course has one)`);
  json.decisions = { ...b, perRun: undefined };
}

if (ONLY.has('expression')) {
  const t = performance.now();
  const facts: RunFacts[] = [];
  for (let i = 0; i < Math.max(1, Math.round(SEEDS / 3)); i++) for (let m = 0; m < M.mountains.MOUNTAINS.length; m++) facts.push(firstRun(M, 'expert', 4242 + i * 97, m));
  const b = barExpression(M, facts);
  console.log(`\nEXPRESSION (expert, ${facts.length} runs; bar: at least ten named air tricks, and five of them in the expert's best combo)`);
  console.log(`  the vocabulary: ${b.vocabulary.length} (${b.vocabulary.join(', ')})`);
  console.log(`  names said: ${b.seen.join(', ')}`);
  console.log(`  best combo: ${b.bestComboFamilies} distinct (${b.bestCombo.join(', ')})   (${secs(t)})`);
  json.expression = b;
}

if (ONLY.has('first')) {
  const t = performance.now();
  console.log(`\nFIRST MINUTE (run 1 on Pinecrest, a fresh save, the field a first run lays; bar: a pass by 20 s, a perfect by 45 s, a dash by 60 s; the clumsy pilot finishes 26 of 30)`);
  const out: Record<string, unknown[]> = {};
  for (const pilot of ['clumsy', 'novice']) {
    const rows = [];
    for (let i = 0; i < SEEDS; i++) {
      const f = firstRun(M, pilot, 1234 + i * 37);
      const b = barFirstMinute(f);
      rows.push(b);
      const s = (v: number | null): string => (v === null ? '  -  ' : v.toFixed(1).padStart(5));
      console.log(`  ${pilot.padEnd(7)} seed ${i}  pass ${s(b.pass)}  perfect ${s(b.perfect)}  dash ${s(b.dash)}  ${f.finished ? `finished ${f.time?.toFixed(1)} s` : `fell at ${f.distance.toFixed(0)} m`}  ${b.ok ? 'MET' : 'short'}`);
    }
    out[pilot] = rows;
  }
  const cf = clumsyFinishes(M, SMALL ? 2 : 6);
  console.log(`  clumsy finishes ${cf.finished} of ${cf.of}   (${secs(t)})`);
  json.first = { ...out, clumsy30: cf };
}

if (ONLY.has('new')) {
  const runs = ride('mid');
  const at = Math.min(50, runs.length);
  const b = barStillNew(M, runs, at);
  console.log(`\nSTILL NEW AT RUN ${at} (mid; bar: something unseen and reachable next run on every mountain)`);
  for (const r of b) console.log(`  ${r.mountain.padEnd(12)} ${r.open ? 'open  ' : 'locked'}  seen ${String(r.seen).padStart(3)}  unseen ${String(r.unseen).padStart(3)}  reachable ${String(r.reachable.length).padStart(3)}  ${r.reachable.slice(0, 4).join('; ')}`);
  json.stillNew = b;
}

/** The economy as the careers left it: what a player has at runs 1, 5, 20, 50 and 100. */
for (const [pilot, runs] of Object.entries(careers)) {
  console.log(`\nECONOMY (${pilot}): run  day         gifts  lifetime  passed  open  twelve  stars+medals  missions  streak`);
  for (const k of [1, 5, 20, 50, 100]) {
    const r = runs[k - 1];
    if (!r) continue;
    const a = r.after;
    console.log(`  ${String(k).padStart(5)}  ${r.day}  ${String(a.gifts).padStart(6)}  ${String(a.lifetimeGifts).padStart(8)}  ${String(a.ghostsPassed).padStart(6)}  ${String(a.open.length).padStart(4)}  ${String(a.twelve).padStart(6)}  ${String(a.stars).padStart(12)}  ${String(a.missions).padStart(8)}  ${String(a.streak).padStart(6)}`);
  }
}

console.log(`\ntotal ${secs(t0)}`);
if (OUT) writeFileSync(OUT, JSON.stringify({ ...json, careers: Object.fromEntries(Object.entries(careers).map(([k, v]) => [k, v.map((r) => ({ n: r.n, day: r.day, key: r.facts.key, finished: r.facts.finished, time: r.facts.time, gains: r.gains, results: r.results, goals: r.goals, after: { ...r.after, climb: undefined, mastery: undefined } }))])) }));

