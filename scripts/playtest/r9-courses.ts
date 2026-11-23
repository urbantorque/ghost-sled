// Round 9's mountain bars (prompts/round-9-clear-screens-a-garage-worth-it.md section 2, "The three new mountains"),
// measured in node on the real sim with no browser: every mountain the game registers (src/sim/mountains.ts
// MOUNTAINS), its course read off course.ts's own functions, and the lab's pilots ridden on it exactly as lab.ts rides
// them (labpilots.ts; the same seeds, rolls, charm pool and input byte). The measures are defined in r9-courselib.ts.
//
// Written in milestone 0 to fail on today's build: there are no new mountains yet, so it prints the five's baseline
// and "no new mountains" and exits 0. It is a script, not a test (nothing in tests/ runs it), and nothing in the game
// imports it, so the game's boot does no more work for it. A lab sweep: run it in the heavy slot.
//   npx tsx scripts/playtest/r9-courses.ts [--seeds 6] [--clumsy-seeds 30] [--pilots mid,novice,expert,clumsy]
//        [--max 900] [--json <file>] [--no-rides] [--mountains pinecrest,ember]
// --max is a ride's cap in seconds. The game's own is an hour (daylight); at 420 s, five of the clumsy pilot's 150 runs
// were cut off between 4,134 and 4,493 m, still riding, so the cap is well past where any pilot finishes.
// The clumsy pilot rides more seeds than the rest (30 by default): its finish rate is a bar, and six runs a mountain
// can only say 0, 17, 33, 50, 67, 83 or 100%.
// --no-rides prints the course measures alone (a second, no slot needed). --json defaults to the main checkout's
// shots/r9/measure/r9-courses.json, which r9-profiles.ts reads for where the mid pilot flew.
//
// The bars, for each new mountain (an id MOUNTAINS registers that is not one of FIVE):
//   new rides     the mid pilot's six (finish time, mean speed, air share, turns per km of the safe line, mean width,
//                 hazards per km): outside the five's range (below the least or above the most) on at least two
//   apart         no two new mountains within 10% of each other on more than half of the six
//   fair          the clumsy pilot finishes it at least as often as the five's hardest for it
//   a mechanic    the share of the run's ticks its signature mechanic is in play (r9-courselib.ts MECHANICS; a
//                 mountain lane writes its function there; zero until then)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type CourseFacts, FIVE, MOUNTAINS, MECHANICS, type RideFacts, courseFacts, ride, seedOf } from './r9-courselib';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const SEEDS = +opt('seeds', '6');
const CLUMSY_SEEDS = +opt('clumsy-seeds', '30');
const seedsFor = (pilot: string): number => (pilot === 'clumsy' ? CLUMSY_SEEDS : SEEDS);
const PILOTS = opt('pilots', 'mid,novice,expert,clumsy').split(',');
const MAX = +opt('max', '900');
const OUT = opt('json', 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/r9-courses.json');
const RIDES = !argv.includes('--no-rides');
const ONLY = opt('mountains', '');
const LIST = MOUNTAINS.filter((m) => !ONLY || ONLY.split(',').includes(m.id));

const med = (a: readonly number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return NaN;
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
const mean = (a: readonly number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (v: number, d = 1, w = 7): string => (Number.isFinite(v) ? v.toFixed(d) : '-').padStart(w);

/** One pilot's rides on one mountain, summed up. */
interface Summary {
  runs: number;
  finished: number;
  /** Median seconds of the finishers. */
  seconds: number;
  meanSpeed: number;
  airShare: number;
  airSeconds: number;
  flights: number;
  longest: number;
  steerRev: number;
  riderBends: number;
  falls: number;
  wards: number;
  wrecks: number;
  won: number;
  met: number;
  mechanic: number;
}

function sum(rs: readonly RideFacts[]): Summary {
  const fin = rs.filter((r) => r.finished);
  return {
    runs: rs.length,
    finished: fin.length,
    seconds: med(fin.map((r) => r.seconds)),
    meanSpeed: med(rs.map((r) => r.meanSpeed)),
    airShare: mean(rs.map((r) => r.airShare)),
    airSeconds: med(rs.map((r) => r.airSeconds)),
    flights: med(rs.map((r) => r.flights)),
    longest: med(rs.map((r) => r.longest)),
    steerRev: med(rs.map((r) => r.steerRev)),
    riderBends: med(rs.map((r) => r.riderBends)),
    falls: mean(rs.map((r) => r.falls)),
    wards: mean(rs.map((r) => r.wards)),
    wrecks: rs.filter((r) => r.wreck).length,
    won: rs.reduce((a, r) => a + r.won, 0),
    met: rs.reduce((a, r) => a + r.met, 0),
    mechanic: mean(rs.map((r) => r.mechanic)),
  };
}

const t0 = performance.now();
const facts: CourseFacts[] = LIST.map((m) => courseFacts(m));
const rides: RideFacts[] = [];
if (RIDES) {
  for (const pilot of PILOTS) for (const m of LIST) for (let i = 0; i < seedsFor(pilot); i++) rides.push(ride(pilot, m, seedOf(i), MAX));
}
const summary = (id: string, pilot: string): Summary => sum(rides.filter((r) => r.id === id && r.pilot === pilot));
const isNew = (id: string): boolean => !FIVE.includes(id);
const fiveFacts = facts.filter((c) => !isNew(c.id));
const newFacts = facts.filter((c) => isNew(c.id));

console.log(`r9-courses  ${LIST.length} mountains (${fiveFacts.length} of the five, ${newFacts.length} new)  ${RIDES ? `${PILOTS.join(',')} x ${SEEDS} seeds (clumsy ${CLUMSY_SEEDS}), max ${MAX} s` : 'no rides'}`);

// ---------------------------------------------------------------- the courses

console.log('\nTHE COURSES (the sim\'s own course, every metre to the line)');
console.log('mountain       length  stages            drop  ledges  slope  sd    p10   p90   pitch  flat  stage slopes        params');
for (const c of facts) {
  console.log(
    c.id.padEnd(13),
    f(c.length, 0, 6),
    ' ' + c.stages.map((s) => s.len.toFixed(0)).join('/').padEnd(16),
    f(c.drop, 0, 5),
    f(c.ledgeDrop, 0, 6),
    f(c.slope, 3, 6),
    f(c.slopeSd, 3, 5),
    f(c.slopeP10, 2, 5),
    f(c.slopeP90, 2, 5),
    `${c.pitches.length}/${c.pitches.reduce((a, p) => a + p.z1 - p.z0, 0)}m`.padStart(7),
    `${c.flats.length}/${c.flats.reduce((a, p) => a + p.z1 - p.z0, 0)}m`.padStart(7),
    ' ' + c.stageSlope.map((v) => v.toFixed(3)).join('/').padEnd(18),
    f(c.paramsSlope, 2, 5),
  );
}
console.log('\nmountain       width  min   max   <12m  >30m  reach  bank  walled  bends/km  turn deg/km');
for (const c of facts) {
  console.log(c.id.padEnd(13), f(c.width, 1, 6), f(c.widthMin, 1, 5), f(c.widthMax, 1, 5), f(100 * c.under12, 1, 5) + '%', f(100 * c.over30, 0, 4) + '%', f(c.reach, 1, 5), f(c.bank, 1, 5), f(100 * c.walled, 0, 5) + '%', f(c.bends, 2, 9), f(c.turning, 0, 11));
}
console.log('\nmountain       hazards/km  solid  near   tall   low    log  pillar soft | kick on/off  drops  moguls  ice  vents  rails | glass m  ice m  sky gates');
for (const c of facts) {
  const h = c.hazards;
  const ft = c.features;
  console.log(c.id.padEnd(13), f(h.all, 1, 10), f(h.solid, 1, 6), f(h.near, 1, 5), f(h.tall, 1, 6), f(h.low, 1, 5), f(h.log, 1, 5), f(h.pillar, 1, 6), f(h.soft, 1, 4), ' |', `${ft.kickOn.toFixed(2)}/${ft.kickOff.toFixed(2)}`.padStart(11), f(ft.drops, 2, 6), f(ft.moguls, 2, 6), f(ft.ice, 2, 5), f(ft.vents, 2, 5), f(ft.rails, 2, 6), ' |', f(ft.glassM, 0, 7), f(ft.iceM, 0, 6), f(ft.skyGates, 0, 8));
}
console.log('\nmountain       leaps (lip z: cliff m)                    first leap  first kicker  steps  outlets  set pieces %  legends %  kinds');
for (const c of facts) {
  console.log(
    c.id.padEnd(13),
    c.leaps.map((l) => `${l.z.toFixed(0)}:${l.height.toFixed(1)}`).join('  ').padEnd(40),
    f(c.firstLeap, 0, 10),
    f(c.kickFirst, 0, 13),
    f(c.steps, 0, 6),
    f(c.outlets, 0, 8),
    f(100 * c.setPieceShare, 1, 13),
    f(100 * c.legendShare, 1, 10),
    ' ' + Object.keys(c.kinds).length,
  );
}
console.log('\nmountain       the descent, section by section (kind:metres; * a stage line\'s threshold)');
for (const c of facts) console.log(c.id.padEnd(13), c.sections.map((s) => `${s.kind}${s.gate ? '*' : ''}:${(s.z1 - s.z0).toFixed(0)}`).join(' '));
console.log('\nmountain       opening (to the first leap\'s end)                    square  half-width  grade  charm gates');
for (const c of facts) console.log(c.id.padEnd(13), c.opening.map((o) => `${o.kind}:${o.len.toFixed(0)}`).join(' ').padEnd(50), f(c.finish.square, 0, 6), f(c.finish.halfWidth, 1, 11), f(c.finish.grade, 3, 6), ' ' + c.charmGates.join(','));
const kindsOf = (cs: CourseFacts[]): Set<string> => new Set(cs.flatMap((c) => Object.keys(c.kinds)));
const all5 = fiveFacts.length ? [...kindsOf(fiveFacts)].filter((k) => fiveFacts.every((c) => k in c.kinds)) : [];
console.log(`\nsection kinds: the five use ${kindsOf(fiveFacts).size} (${[...kindsOf(fiveFacts)].sort().join(', ')}); all five hold ${all5.length} (${all5.sort().join(', ')})`);

// ---------------------------------------------------------------- the rides

if (RIDES) {
  for (const pilot of PILOTS) {
    console.log(`\nTHE RIDES: ${pilot} (${seedsFor(pilot)} seeds a mountain; seconds are the finishers' median)`);
    console.log('mountain       finished  secs   mean m/s  air %  air s  flights>0.5s  longest s  steer rev/km  rider bends/km  falls/run  wards/run  wrecks  set pieces won');
    for (const c of facts) {
      const s = summary(c.id, pilot);
      console.log(c.id.padEnd(13), `${s.finished}/${s.runs}`.padStart(8), f(s.seconds, 1, 6), f(s.meanSpeed, 1, 9), f(100 * s.airShare, 1, 6), f(s.airSeconds, 1, 6), f(s.flights, 1, 13), f(s.longest, 2, 10), f(s.steerRev, 1, 13), f(s.riderBends, 1, 15), f(s.falls, 2, 10), f(s.wards, 2, 10), f(s.wrecks, 0, 7), `${s.won}/${s.met}`.padStart(15));
    }
  }
}

// ---------------------------------------------------------------- the bars

/** The bar's six, for the mid pilot (section 2: "the finish time, mean speed, airtime, turns per kilometre, mean width
 *  and hazards per kilometre"). Turns are the course's own line's (its bends); the rider's are in the tables above. */
const BAR: { key: string; unit: string; of: (c: CourseFacts) => number }[] = [
  { key: 'finish time', unit: 's', of: (c) => summary(c.id, 'mid').seconds },
  { key: 'mean speed', unit: 'm/s', of: (c) => summary(c.id, 'mid').meanSpeed },
  { key: 'air share', unit: '%', of: (c) => 100 * summary(c.id, 'mid').airShare },
  { key: 'turns/km', unit: '', of: (c) => c.bends },
  { key: 'mean width', unit: 'm', of: (c) => c.width },
  { key: 'hazards/km', unit: '', of: (c) => c.hazards.all },
];
/** The rest of what the eight axes imply and the sim can say, for the spread. */
const MORE: { key: string; of: (c: CourseFacts) => number }[] = [
  { key: 'length m', of: (c) => c.length },
  { key: 'stages', of: (c) => c.stages.length },
  { key: 'slope', of: (c) => c.slope },
  { key: 'slope sd', of: (c) => c.slopeSd },
  { key: 'pitches', of: (c) => c.pitches.length },
  { key: 'flats', of: (c) => c.flats.length },
  { key: 'stage 1 slope', of: (c) => c.stageSlope[0] },
  { key: 'stage 3 slope', of: (c) => c.stageSlope[c.stageSlope.length - 1] },
  { key: 'width <12 m %', of: (c) => 100 * c.under12 },
  { key: 'width >30 m %', of: (c) => 100 * c.over30 },
  { key: 'reach m', of: (c) => c.reach },
  { key: 'bank m', of: (c) => c.bank },
  { key: 'walled %', of: (c) => 100 * c.walled },
  { key: 'turn deg/km', of: (c) => c.turning },
  { key: 'solid/km', of: (c) => c.hazards.solid },
  { key: 'near line/km', of: (c) => c.hazards.near },
  { key: 'first leap m', of: (c) => c.firstLeap },
  { key: 'leaps', of: (c) => c.leaps.length },
  { key: 'max cliff m', of: (c) => Math.max(...c.leaps.map((l) => l.height)) },
  { key: 'kickers on/km', of: (c) => c.features.kickOn },
  { key: 'sky gates', of: (c) => c.features.skyGates },
  { key: 'vents/km', of: (c) => c.features.vents },
  { key: 'ice m on line', of: (c) => c.features.iceM },
  { key: 'set pieces %', of: (c) => 100 * c.setPieceShare },
  { key: 'kinds', of: (c) => Object.keys(c.kinds).length },
  { key: 'square m', of: (c) => c.finish.square },
];
const RIDE_MORE: { key: string; pilot: string; of: (s: Summary) => number }[] = [
  { key: 'mid air s', pilot: 'mid', of: (s) => s.airSeconds },
  { key: 'mid flights>0.5s', pilot: 'mid', of: (s) => s.flights },
  { key: 'mid longest s', pilot: 'mid', of: (s) => s.longest },
  { key: 'mid steer rev/km', pilot: 'mid', of: (s) => s.steerRev },
  { key: 'mid rider bends/km', pilot: 'mid', of: (s) => s.riderBends },
  { key: 'novice secs', pilot: 'novice', of: (s) => s.seconds },
  { key: 'expert secs', pilot: 'expert', of: (s) => s.seconds },
  { key: 'clumsy finish %', pilot: 'clumsy', of: (s) => (100 * s.finished) / Math.max(1, s.runs) },
  { key: 'clumsy secs', pilot: 'clumsy', of: (s) => s.seconds },
  { key: 'clumsy falls/run', pilot: 'clumsy', of: (s) => s.falls },
];

const spread = (vals: { id: string; v: number }[]): { lo: number; hi: number; loId: string; hiId: string } => {
  const ok = vals.filter((q) => Number.isFinite(q.v));
  const lo = ok.reduce((a, q) => (q.v < a.v ? q : a), ok[0] ?? { id: '-', v: NaN });
  const hi = ok.reduce((a, q) => (q.v > a.v ? q : a), ok[0] ?? { id: '-', v: NaN });
  return { lo: lo.v, hi: hi.v, loId: lo.id, hiId: hi.id };
};

const json: Record<string, unknown> = { seeds: SEEDS, clumsySeeds: CLUMSY_SEEDS, pilots: PILOTS, max: MAX, rides: RIDES, five: FIVE };
const bar: Record<string, unknown> = {};
const usable = RIDES && PILOTS.includes('mid');
console.log('\nTHE FIVE\'S SPREAD (min and max across the five, and which)');
console.log('measure              ' + fiveFacts.map((c) => c.id.slice(0, 9).padStart(10)).join('') + '        min        max');
const rows: { key: string; vals: Record<string, number>; lo: number; hi: number }[] = [];
const row = (key: string, of: (c: CourseFacts) => number, d: number): void => {
  const vals = fiveFacts.map((c) => ({ id: c.id, v: of(c) }));
  const sp = spread(vals);
  rows.push({ key, vals: Object.fromEntries(vals.map((q) => [q.id, q.v])), lo: sp.lo, hi: sp.hi });
  console.log(key.padEnd(20), vals.map((q) => f(q.v, d, 10)).join(''), f(sp.lo, d, 10) + ` ${sp.loId.slice(0, 4)}`, f(sp.hi, d, 6) + ` ${sp.hiId.slice(0, 4)}`);
};
if (usable) for (const b of BAR) row(`${b.key}${b.unit ? ` ${b.unit}` : ''}`, b.of, 2);
else for (const b of BAR.slice(3)) row(b.key, b.of, 2);
console.log('---');
for (const m of MORE) row(m.key, m.of, 2);
if (RIDES) for (const m of RIDE_MORE) if (PILOTS.includes(m.pilot)) row(m.key, (c) => m.of(summary(c.id, m.pilot)), 2);
json.spread = rows;

console.log('\nTHE BARS (each new mountain against the five; section 2, "The three new mountains")');
if (!newFacts.length) {
  console.log('no new mountains: MOUNTAINS registers only the five. The five\'s baseline is above; every bar is unmet today.');
  bar.newMountains = [];
} else if (!usable) {
  console.log('the bars need the mid pilot\'s rides: run without --no-rides');
} else {
  const range = BAR.map((b) => {
    const vals = fiveFacts.map((c) => b.of(c));
    return { lo: Math.min(...vals), hi: Math.max(...vals) };
  });
  const out: Record<string, unknown>[] = [];
  for (const c of newFacts) {
    const vals = BAR.map((b) => b.of(c));
    const outside = BAR.filter((_, i) => vals[i] < range[i].lo || vals[i] > range[i].hi).map((b) => b.key);
    console.log(`${c.id}: outside the five on ${outside.length} of ${BAR.length} (${outside.join(', ') || 'none'}): ${outside.length >= 2 ? 'met' : 'NOT MET'}`);
    console.log('  ' + BAR.map((b, i) => `${b.key} ${vals[i].toFixed(2)} [${range[i].lo.toFixed(2)}, ${range[i].hi.toFixed(2)}]`).join('  '));
    out.push({ id: c.id, vals: Object.fromEntries(BAR.map((b, i) => [b.key, vals[i]])), outside });
  }
  // No two new mountains within 10% on more than half the six.
  for (let i = 0; i < newFacts.length; i++) {
    for (let j = i + 1; j < newFacts.length; j++) {
      const a = newFacts[i];
      const b = newFacts[j];
      const close = BAR.filter((m) => {
        const x = m.of(a);
        const y = m.of(b);
        return Math.abs(x - y) <= 0.1 * Math.max(Math.abs(x), Math.abs(y));
      }).map((m) => m.key);
      console.log(`${a.id} and ${b.id}: within 10% on ${close.length} of ${BAR.length} (${close.join(', ') || 'none'}): ${close.length > BAR.length / 2 ? 'TOO ALIKE' : 'apart'}`);
    }
  }
  // Fair: the clumsy pilot finishes at least as often as on the five's hardest.
  if (PILOTS.includes('clumsy')) {
    const rate = (id: string): number => {
      const s = summary(id, 'clumsy');
      return s.finished / Math.max(1, s.runs);
    };
    const hardest = fiveFacts.reduce((a, c) => (rate(c.id) < rate(a.id) ? c : a), fiveFacts[0]);
    for (const c of newFacts) console.log(`${c.id}: clumsy finishes ${(100 * rate(c.id)).toFixed(0)}% against the five's hardest, ${hardest.id}, ${(100 * rate(hardest.id)).toFixed(0)}%: ${rate(c.id) >= rate(hardest.id) ? 'met' : 'NOT MET'}`);
  }
  for (const c of newFacts) console.log(`${c.id}: its signature mechanic is in play for ${(100 * summary(c.id, 'mid').mechanic).toFixed(1)}% of the mid pilot's run${MECHANICS[c.id] ? '' : ' (no function in r9-courselib.ts MECHANICS yet)'}`);
  bar.newMountains = out;
}
json.bar = bar;

json.mountains = facts.map((c) => ({
  ...c,
  rides: Object.fromEntries(PILOTS.map((p) => [p, RIDES ? summary(c.id, p) : null])),
  midFlights: rides.filter((r) => r.id === c.id && r.pilot === 'mid').map((r) => ({ seed: r.seed, flights: r.flightList })),
}));
json.rideList = rides.map((r) => ({ ...r, flightList: undefined }));
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(json));
  console.log(`\nwrote ${OUT}`);
}
console.log(`(${((performance.now() - t0) / 1000).toFixed(1)} s)`);
