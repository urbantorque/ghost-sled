// Round 9, the look lane: shoots one pass's frames of the three new mountains with look-frames.js, every pass at the
// same spots, so a pass pairs with the last by name (blind-pairs.mjs --frames oldrun/a-opening,...). Each group (a
// mountain at a tier and an hour) is one run of look-frames.js in the lane's own browser session, which must be open
// (playwright-cli -s=r9-look open --config=.playwright/cli-headless.config.json) and the browser slot held.
//   node scripts/r9/look-shoot.mjs --set p1 [--only oldrun,gablefall] [--groups day,alt,low] [--port 5044]
// Frames go to shots/r9/look/sets/<set>/<mountain>/<spot>.png; the console's errors and warnings and each frame's z to
// shots/r9/look/sets/<set>/log.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const set = opt('set');
if (!set) {
  console.error('needs --set <name>');
  process.exit(1);
}
const only = (opt('only', '') || '').split(',').filter(Boolean);
const groupsWanted = (opt('groups', '') || '').split(',').filter(Boolean);
const port = opt('port', '5044');
const session = opt('session', 'r9-look');
const root = 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/sets/';
const here = path.dirname(fileURLToPath(import.meta.url));
const frames = fs.readFileSync(path.join(here, 'look-frames.js'), 'utf8');

// The spots: the opening, three places and the finish, each set piece, the other hour and Low, as the world notes shot
// them (notes/r9-oldrun-world.md, r9-gullhaven-world.md, r9-gablefall-world.md).
export const SETS = {
  oldrun: {
    m: 5,
    groups: {
      day: {
        tier: 'high',
        spots: [
          { name: 'a-opening', z: 60, line: 'mid', v: 22 },
          { name: 'b-bell', z: 228, line: 'glaze', v: 32 },
          { name: 'c-q1', z: 750, line: 'glaze', v: 33 },
          { name: 'd-q2', z: 1500, line: 'glaze', v: 34 },
          { name: 'e-split', z: 1830, line: 'glaze', v: 33 },
          { name: 'f-q3', z: 2250, line: 'glaze', v: 35 },
          { name: 'g-hook', z: 2719, line: 'glaze', v: 33 },
          { name: 'h-finish', z: 2940, line: 'mid', v: 26 },
        ],
      },
      alt: {
        tier: 'high',
        hour: 'alt',
        spots: [
          { name: 'i-alt-opening', z: 60, line: 'mid', v: 22 },
          { name: 'j-alt-q2', z: 1500, line: 'glaze', v: 34 },
        ],
      },
      low: {
        tier: 'low',
        spots: [
          { name: 'k-low-opening', z: 60, line: 'mid', v: 22 },
          { name: 'l-low-q2', z: 1500, line: 'glaze', v: 34 },
        ],
      },
    },
  },
  gullhaven: {
    m: 6,
    groups: {
      day: {
        tier: 'high',
        spots: [
          { name: 'a-opening', z: 60, line: 'mid', v: 20 },
          { name: 'b-lighthouse', z: 690, line: 'mid', v: 28 },
          { name: 'c-lip', z: 1338, line: 'bold', v: 32 },
          { name: 'd-air', z: 2262, line: 'air', v: 31, h: 18, vy: -1 },
          { name: 'e-shelf', z: 3240, line: 'mid', v: 30 },
          { name: 'f-shore', z: 4140, line: 'mid', v: 28 },
          { name: 'g-finish', z: 4740, line: 'mid', v: 24 },
        ],
      },
      alt: {
        tier: 'high',
        hour: 'alt',
        spots: [
          { name: 'h-alt-light', z: 1530, line: 'mid', v: 28 },
          { name: 'i-alt-finish', z: 4740, line: 'mid', v: 24 },
        ],
      },
      low: {
        tier: 'low',
        spots: [
          { name: 'j-low-opening', z: 60, line: 'mid', v: 20 },
          { name: 'k-low-air', z: 2262, line: 'air', v: 31, h: 18, vy: -1 },
        ],
      },
    },
  },
  gablefall: {
    m: 7,
    groups: {
      day: {
        tier: 'high',
        spots: [
          { name: 'a-opening', z: 26, line: 'mid', v: 18 },
          { name: 'b-roofrun', z: 330, line: 'roof', s: 1, v: 26 },
          { name: 'c-roof', z: 700, line: 'roof', s: 1, v: 28 },
          { name: 'd-market', z: 1300, line: 'mid', v: 24 },
          { name: 'e-street', z: 1400, line: 'mid', v: 22 },
          { name: 'f-washing', z: 2150, line: 'roof', s: 1, v: 27 },
          { name: 'g-finish', z: 2758, line: 'mid', v: 22 },
        ],
      },
      alt: {
        tier: 'high',
        hour: 'alt',
        spots: [
          { name: 'h-alt-street', z: 600, line: 'mid', v: 22 },
          { name: 'i-alt-finish', z: 2758, line: 'mid', v: 22 },
        ],
      },
      low: {
        tier: 'low',
        spots: [
          { name: 'j-low-roof', z: 700, line: 'roof', s: 1, v: 28 },
          { name: 'k-low-street', z: 1400, line: 'mid', v: 22 },
        ],
      },
    },
  },
};

const pw = (...args) => {
  const r = spawnSync('playwright-cli', [`-s=${session}`, ...args], { encoding: 'utf8', shell: true, maxBuffer: 1 << 24 });
  return (r.stdout || '') + (r.stderr || '');
};

const log = { set, groups: [] };
fs.mkdirSync(root + set, { recursive: true });
for (const [mtn, def] of Object.entries(SETS)) {
  if (only.length && !only.includes(mtn)) continue;
  const out = `${root}${set}/${mtn}/`;
  fs.mkdirSync(out, { recursive: true });
  for (const [g, grp] of Object.entries(def.groups)) {
    if (groupsWanted.length && !groupsWanted.includes(g)) continue;
    const cfg = { base: `http://127.0.0.1:${port}/`, out, m: def.m, tier: grp.tier, hour: grp.hour ?? 'day', spots: grp.spots };
    const file = path.join(here, `.look-run-${process.pid}.js`);
    fs.writeFileSync(file, `async (page) => {\n  await page.evaluate((cfg) => { window.__lookCfg = cfg; }, ${JSON.stringify(cfg)});\n  return (${frames.replace(/^\/\/.*$/gm, '').trim()})(page);\n}\n`);
    const t0 = Date.now();
    const res = pw('run-code', `--filename="${file}"`);
    fs.rmSync(file, { force: true });
    console.log(`${mtn} ${g}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    // (The page script's answer only: the frames and the console's errors and warnings.)
    const ans = res.split('\n').find((l) => l.includes('\\"shot\\"'));
    console.log(ans ? ans.slice(0, 1200) : res.slice(0, 400));
    log.groups.push({ mtn, g, res: res.slice(0, 4000) });
  }
}
fs.writeFileSync(`${root}${set}/log.json`, JSON.stringify(log, null, 2));
