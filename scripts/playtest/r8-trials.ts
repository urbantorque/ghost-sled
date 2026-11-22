// Round 8, the trials lane: four weeks' Trials ridden in node (r8trial.ts) by the lab's mid and expert pilots. Prints
// each week's Trial (its name, rule, field and targets) and what medal each pilot's rides take.
//   npx tsx scripts/playtest/r8-trials.ts [--weeks 2026-W48,2026-W49,...] [--seeds 4] [--out <abs json>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { clock } from '../../src/game/standing';
import { type PilotRide, rideTrial, weekField } from './r8trial';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const weeks = opt('weeks', '2026-W48,2026-W49,2026-W50,2026-W51').split(',');
const seeds = Number(opt('seeds', '4'));
const out = opt('out', '');
const MEDAL = ['none', 'bronze', 'silver', 'gold'];
const t0 = performance.now();
const all: unknown[] = [];
for (const week of weeks) {
  const tf = performance.now();
  const w = weekField(week);
  const ms = performance.now() - tf;
  const t = w.trial;
  const fmtV = (v: number | null): string => (v === null ? '-' : t.measure === 'time' || t.measure === 'clean' ? clock(v) : String(v));
  console.log(`\n${week}: ${t.name}. ${t.rule}. (${t.measure}; chaos ${t.chaos.mood}/${t.chaos.event}; pool ${t.charmPool.toString(16)}; hour ${t.hour})`);
  console.log(`  field (${w.field.length} riders, ${(ms / 1000).toFixed(1)} s): ${w.field.map((r, i) => `${r.skill.toFixed(2)}:${fmtV(w.values[i])}${r.tally.tumbles ? `/${r.tally.tumbles}f` : ''}`).join(' ')}`);
  console.log(`  targets: bronze ${fmtV(w.targets?.[0] ?? null)}, silver ${fmtV(w.targets?.[1] ?? null)}, gold ${fmtV(w.targets?.[2] ?? null)}`);
  const rides: PilotRide[] = [];
  for (const pilot of ['mid', 'expert'] as const) {
    const row: PilotRide[] = [];
    for (let s = 0; s < seeds; s++) row.push(rideTrial(w, pilot, 1000 + s * 7919));
    rides.push(...row);
    console.log(`  ${pilot.padEnd(6)} ${row.map((r) => `${MEDAL[r.medal]} (${fmtV(r.value)}${r.tumbles ? `, ${r.tumbles} falls` : ''}${r.finished ? '' : `, fell at ${Math.round(r.metres)} m`})`).join(', ')}  (field ${row[0].field}, drafted ${row.map((r) => r.drafted).join('/')})${row.every((r) => r.replays) ? '' : '  REPLAY DIFFERS'}`);
  }
  all.push({ week, trial: t, targets: w.targets, field: w.field.map((r, i) => ({ name: r.ghost.name, skill: r.skill, value: w.values[i], tumbles: r.tally.tumbles })), rides: rides.map(({ config: _c, tally: _t, ...r }) => r) });
}
console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)} s)`);
if (out) mkdirSync(dirname(out), { recursive: true });
if (out) writeFileSync(out, JSON.stringify(all, null, 1));
