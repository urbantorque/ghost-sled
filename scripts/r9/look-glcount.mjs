// Round 9, the look lane (the brief's section 4): Low's GL calls and draws on a held run, each new mountain against
// Pinecrest on the same stretches, the stretches chosen to hold each mountain's set pieces live. Runs
// gablefall-world-glcount.js (glcount.js's counter: every WebGL call of a frame, counted; never frames a second) in the
// lane's open browser session, one stretch at a time, and writes every reading to shots/r9/look/gl/<tag>.json.
//   node scripts/r9/look-glcount.mjs [--tag now] [--only oldrun,pinecrest] [--save mid-100]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const tag = opt('tag', 'now');
const only = (opt('only', '') || '').split(',').filter(Boolean);
const save = opt('save', 'mid-100');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/gl/';
fs.mkdirSync(out, { recursive: true });
// Each new mountain's set pieces (the world notes': the Old Run's Bend Bells, the Labyrinth's split, the Horseshoe's hold;
// Gullhaven's Lighthouse, the Great Geo, the Sea Stacks; Gablefall's Roof Run, Market Day, the Washing Lines), and Pinecrest
// on the same 300 m from the same z0.
const RUNS = [
  { name: 'oldrun', m: 5, line: 'mid', z0s: [150, 1250, 2550] },
  { name: 'gullhaven', m: 6, line: 'mid', z0s: [540, 2100, 3950] },
  { name: 'gablefall', m: 7, line: 'street', z0s: [250, 1100, 2080] },
  { name: 'pinecrest', m: 0, line: 'safe', z0s: [150, 250, 540, 1100, 1250, 2080, 2100, 2550, 3950] },
];
const script = fs.readFileSync(path.join(here, 'gablefall-world-glcount.js'), 'utf8');
const results = [];
for (const r of RUNS) {
  if (only.length && !only.includes(r.name)) continue;
  for (const z0 of r.z0s) {
    const cfg = { base: 'http://127.0.0.1:5044/', tier: 'low', m: r.m, z0, v: 30, warm: 8, seconds: 10, save, kit: r.line !== 'safe', line: r.line === 'street' ? 'street' : 'mid' };
    const file = path.join(here, `.look-gl-${process.pid}.js`);
    fs.writeFileSync(file, `async (page) => {\n  await page.evaluate((cfg) => { window.__glCfg = cfg; }, ${JSON.stringify(cfg)});\n  return (${script.replace(/^\/\/.*$/gm, '').trim()})(page);\n}\n`);
    const res = spawnSync('playwright-cli', ['-s=r9-look', 'run-code', `--filename="${file}"`], { encoding: 'utf8', shell: true, maxBuffer: 1 << 24 });
    fs.rmSync(file, { force: true });
    const text = (res.stdout || '') + (res.stderr || '');
    const m = text.match(/"\{[\s\S]*?\}"\s*$/m) || text.match(/\{\\n[\s\S]*\}/);
    let parsed = null;
    try {
      const raw = text.slice(text.indexOf('"{'), text.lastIndexOf('}"') + 2);
      parsed = JSON.parse(JSON.parse(raw));
    } catch {
      parsed = { error: text.slice(0, 600), m: !!m };
    }
    const row = { mountain: r.name, z0, ...parsed };
    results.push(row);
    console.log(`${r.name} z0 ${z0}: ${parsed.callsPerFrame ?? '?'} calls, ${parsed.drawsPerFrame ?? '?'} draws, ${parsed.trianglesPerFrame ?? '?'} tris, ${parsed.frames ?? '?'} frames, z ${JSON.stringify(parsed.z ?? null)}`);
  }
}
fs.writeFileSync(`${out}${tag}.json`, JSON.stringify(results, null, 1));
