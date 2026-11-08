// Round 5's telemetry table: per pilot, finishes, time, place, passes and race-live, the lantern (lights,
// lanterns lit, dashes, wards, sky gates) and the set pieces met and swept, one build beside another.
//   node scripts/playtest/tele-r5.mjs <before.txt> <after.txt>
import { readFileSync } from 'node:fs';

const read = (f) => {
  const t = readFileSync(f, 'utf8');
  const i = t.indexOf('### Result');
  if (i < 0) throw new Error('no result in ' + f + ': ' + t.slice(-300));
  const line = t.slice(i).split('\n').find((l) => l.startsWith('"') || l.startsWith('{'));
  return JSON.parse(line.startsWith('"') ? JSON.parse(line) : line).runs;
};
const med = (a) => {
  const s = a.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : NaN;
};
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '-');
const finished = (r) => (r.lantern && r.lantern.finishTick != null) || (r.distance ?? 0) >= 4495;
const sum = (runs) => {
  const fin = runs.filter(finished);
  const placeOf = (r) => (Array.isArray(r.place) ? r.place[0] : r.lantern && r.lantern.place ? r.lantern.place[0] : NaN);
  const mq = runs.flatMap((r) => (r.lantern && r.lantern.marquee) || []);
  return {
    n: runs.length,
    fin: fin.length,
    time: med(fin.map((r) => r.seconds)),
    dist: med(runs.map((r) => r.distance)),
    place: med(runs.map(placeOf)),
    passes: med(runs.map((r) => r.passesPerMin)),
    live: med(runs.map((r) => r.raceLiveFraction)),
    named: med(runs.map((r) => r.namedAllPerMin ?? r.namedPerMin)),
    lights: med(runs.map((r) => (r.lantern ? r.lantern.lights : NaN))),
    lit: med(runs.map((r) => (r.lantern ? r.lantern.lit / 100 : NaN))),
    dashes: med(runs.map((r) => (r.lantern ? r.lantern.dashes : NaN))),
    wards: med(runs.map((r) => (r.lantern ? r.lantern.wards : NaN))),
    gates: runs.reduce((s, r) => s + (r.lantern ? r.lantern.gates ?? 0 : 0), 0),
    mqMet: mq.length,
    mqClean: mq.filter((m) => m[3]).length,
    mqSwept: mq.filter((m) => m[3] && m[2] > 0 && m[1] >= m[2]).length,
    mqPerMin: mq.length / Math.max(1e-9, runs.reduce((s, r) => s + r.seconds / 60, 0)),
  };
};
const [bf, af] = process.argv.slice(2);
const before = read(bf);
const after = read(af);
const skills = [...new Set([...before, ...after].map((r) => r.skill))];
console.log('pilot   | runs | finished b/a | finish s b/a | place b/a | passes/min b/a | race live b/a | named/min b/a | lights | lanterns | dashes | wards | gates | set pieces met (a minute) / clean / swept');
for (const k of skills) {
  const b = sum(before.filter((r) => r.skill === k));
  const a = sum(after.filter((r) => r.skill === k));
  console.log(
    `${k.padEnd(7)} | ${a.n} | ${b.fin} -> ${a.fin} | ${f1(b.time)} -> ${f1(a.time)} | ${f1(b.place)} -> ${f1(a.place)} | ${f1(b.passes)} -> ${f1(a.passes)} | ${b.live.toFixed(2)} -> ${a.live.toFixed(2)} | ${f1(b.named)} -> ${f1(a.named)} | ${f1(a.lights)} | ${f1(a.lit)} | ${f1(a.dashes)} | ${f1(a.wards)} | ${a.gates} | ${a.mqMet} (${a.mqPerMin.toFixed(2)}) / ${a.mqClean} / ${a.mqSwept}`,
  );
}
