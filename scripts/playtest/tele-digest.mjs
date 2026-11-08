// Reads telemetry.js outputs (the playwright-cli text around its JSON) and prints one before and after
// table per pilot, so a comparison is arithmetic rather than eyeballing.
//   node scripts/playtest/tele-digest.mjs <before1.txt,before2.txt> <after1.txt,after2.txt>
import { readFileSync } from 'node:fs';
const read = (files) => {
  const runs = [];
  for (const f of files.split(',')) {
    const t = readFileSync(f, 'utf8');
    const i = t.indexOf('### Result');
    if (i < 0) throw new Error('no result in ' + f + ': ' + t.slice(0, 200));
    const line = t.slice(i).split('\n').find((l) => l.startsWith('"') || l.startsWith('{'));
    const json = JSON.parse(line.startsWith('"') ? JSON.parse(line) : line);
    runs.push(...json.runs);
  }
  return runs;
};
const med = (a) => {
  const s = a.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((x, y) => x - y);
  return s.length ? s[s.length >> 1] : NaN;
};
const mean = (a) => {
  const s = a.filter((v) => typeof v === 'number' && Number.isFinite(v));
  return s.length ? s.reduce((x, y) => x + y, 0) / s.length : NaN;
};
// A run that ended under the cap with no crash reached the finish (telemetry before it logged finishes).
const dist = (r) => r.distance ?? (r.cause === 'timeout' && r.seconds < 195 ? 4500 : null);
const row = (runs) => ({
  runs: runs.length,
  secs: med(runs.map((r) => r.seconds)),
  dist: med(runs.map(dist)),
  speed: mean(runs.map((r) => (dist(r) ? dist(r) / r.seconds : NaN))),
  passes: mean(runs.map((r) => r.passesPerMin)),
  named: mean(runs.map((r) => r.namedAllPerMin ?? r.namedPerMin)),
  live: mean(runs.map((r) => r.raceLiveFraction)),
  firstNamed: med(runs.map((r) => r.firstNamedAt)),
  firstPass: med(runs.map((r) => r.firstPassAt)),
  intensity: mean(runs.map((r) => r.intensity?.mean)),
  gifts: mean(runs.map((r) => r.gifts)),
  missions: mean(runs.map((r) => r.missionsMidRun)),
});
const [a, b] = process.argv.slice(2).map(read);
const pilots = ['clumsy', 'novice', 'mid', 'expert', 'stunt'];
const fmt = (v, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : 'n/a');
console.log('pilot   build runs secs   dist  m/s  passes/min named/min raceLive firstNamed firstPass intensity gifts missions');
for (const p of pilots) {
  for (const [tag, list] of [['before', a], ['after ', b]]) {
    const r = row(list.filter((x) => x.skill === p));
    console.log(p.padEnd(7), tag, String(r.runs).padStart(3), fmt(r.secs, 0).padStart(5), fmt(r.dist, 0).padStart(6), fmt(r.speed).padStart(5), fmt(r.passes).padStart(8), fmt(r.named).padStart(9), fmt(r.live, 2).padStart(8), fmt(r.firstNamed).padStart(9), fmt(r.firstPass).padStart(9), fmt(r.intensity, 2).padStart(9), fmt(r.gifts, 0).padStart(5), fmt(r.missions).padStart(7));
  }
}
