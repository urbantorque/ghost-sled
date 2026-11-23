// Round 9, the ground lane: every place the code reads something the five share and a new mountain may not (the
// course's length, its opening, its finish, the mountain list, the tables keyed by biome or kind). Read-only: it lists
// file:line and the line, grouped, so the groundwork can be checked off read site by read site and run again after
// each step to see what is left. `node scripts/r9/ground-readsites.mjs [group]`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIRS = ['src', 'scripts', 'tests'];
const SKIP = /(^|[\\/])(node_modules|data|music)([\\/]|$)|prototypes|\.d\.ts$/;

/** What is looked for, by group: a name and the patterns that find its reads. */
const GROUPS = {
  length: ['FINISH_Z', 'STAGE_LENGTHS', '\\bRUN_OUT\\b', 'FINISH_SQUARE', '\\bDESCENT\\b', 'PACE_OPEN', 'FINISH = 4500', 'rampDistance'],
  opening: ['START_CLEAR_Z', 'PICKETS_FROM', 'LIGHT_RUN_', 'FREE_TUMBLE_Z', 'START_GATE_Z', 'GATE_PAST_LINE', 'opening\\(', 'z <= 312', 'z0 < 800', 'Math\\.max\\(800', 'z0 >= 300'],
  thresholds: ['THRESHOLD_[A-Z_]+', 'NOT_BEFORE_GATE'],
  list: ['MOUNTAINS\\[', 'MOUNTAINS\\.length', 'MOUNTAINS\\.indexOf', 'MOUNTAINS\\.findIndex', '% 5\\b', '\\bLEGS\\b', 'GRAVE_NAMES', '\\bBIOMES\\b', '\\bVERBS\\b', 'unlockGhosts'],
  tables: ['Record<BiomeId', 'Record<CourseBiome', 'Record<SectionKind', 'Record<ObstacleKind', 'Record<MountainId', 'Record<MomentVerb', 'LEGEND_LOOK'],
  leaps: ['\\.leaps\\b', 'climaxOf'],
};

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(join(ROOT, d), []));
const only = process.argv[2];
for (const [group, pats] of Object.entries(GROUPS)) {
  if (only && only !== group) continue;
  const re = new RegExp(pats.join('|'));
  const hits = [];
  const byArea = new Map();
  for (const f of files) {
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    const parts = rel.split('/');
    const area = parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!re.test(line)) return;
      hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 150)}`);
      byArea.set(area, (byArea.get(area) ?? 0) + 1);
    });
  }
  console.log(`\n== ${group}: ${hits.length} reads (${[...byArea].map(([a, n]) => `${a} ${n}`).join(', ')})`);
  for (const h of hits) console.log(h);
}
