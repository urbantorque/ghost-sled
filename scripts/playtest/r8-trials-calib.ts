// Round 8, the trials lane: where the lab's pilots stand in a Trial's field on every measure, over many weeks. For
// each week its field is made and each pilot rides it; every ride is judged on every measure against that week's
// field (the share of the field's figures it is at least as good as). Prints, per measure, the shares' quartiles for
// the mid and the expert pilot: what TRIAL_PCT should be read against.
//   npx tsx scripts/playtest/r8-trials-calib.ts [--weeks 16] [--seeds 3] [--out <abs json>]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type TrialMeasure, atLeast, trialValue } from '../../src/game/trial';
import { rideTrial, weekField } from './r8trial';

const argv = process.argv.slice(2);
const opt = (k: string, d: string): string => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const nWeeks = Number(opt('weeks', '16'));
const seeds = Number(opt('seeds', '3'));
const out = opt('out', '');
const ALL: TrialMeasure[] = ['time', 'clean', 'score', 'perfects'];
const weeks: string[] = [];
for (let i = 0; i < nWeeks; i++) {
  const d = new Date(Date.UTC(2026, 10, 23 + 7 * i));
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 3));
  const y = t.getUTCFullYear();
  const wk = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  weeks.push(`${y}-W${String(wk).padStart(2, '0')}`);
}
const shares: Record<string, Record<string, number[]>> = { mid: {}, expert: {} };
const rows: unknown[] = [];
for (const week of weeks) {
  const w = weekField(week);
  for (const pilot of ['mid', 'expert'] as const) {
    for (let s = 0; s < seeds; s++) {
      const r = rideTrial(w, pilot, 1000 + s * 7919);
      for (const m of ALL) {
        const field = w.field.map((f) => trialValue(m, f.tally)).filter((v): v is number => v !== null);
        const mine = trialValue(m, r.tally);
        const share = mine === null || !field.length ? 0 : field.filter((v) => atLeast(m, mine, v) && mine !== v).length / field.length + field.filter((v) => v === mine).length / field.length / 2;
        (shares[pilot][m] ??= []).push(share);
        rows.push({ week, pilot, seed: s, measure: m, mine, share });
      }
    }
  }
  console.log(`${week} ${w.trial.mountain}${w.trial.mirror ? ' mirrored' : ''} done`);
}
const q = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
for (const m of ALL) {
  const f = (xs: number[]): string => [0.25, 0.5, 0.75, 0.9].map((p) => q(xs, p).toFixed(2)).join(' ');
  console.log(`${m.padEnd(9)} mid ${f(shares.mid[m])}   expert ${f(shares.expert[m])}`);
}
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(rows));
}
