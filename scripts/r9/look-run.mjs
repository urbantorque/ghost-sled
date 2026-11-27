// Round 9, the look lane: runs one of the lane's page scripts (look-probe.js, look-frames.js, look-glcount.js) in the
// lane's open browser session with a config from a JSON file (or a .mjs exporting it as default), so page code can
// travel as strings without the shell's quoting.
//   node scripts/r9/look-run.mjs --script look-probe.js --var __probeCfg --cfg <file.json|file.mjs> [--session r9-look]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const here = path.dirname(fileURLToPath(import.meta.url));
const script = fs.readFileSync(path.join(here, opt('script', 'look-probe.js')), 'utf8');
const cfgFile = opt('cfg');
const cfg = cfgFile.endsWith('.mjs') ? (await import(pathToFileURL(path.resolve(cfgFile)).href)).default : JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
if (cfg.out) fs.mkdirSync(cfg.out, { recursive: true });
const v = opt('var', '__probeCfg');
const file = path.join(here, `.look-run-${process.pid}.js`);
fs.writeFileSync(file, `async (page) => {\n  await page.evaluate((cfg) => { window.${v} = cfg; }, ${JSON.stringify(cfg)});\n  return (${script.replace(/^\/\/.*$/gm, '').trim()})(page);\n}\n`);
const r = spawnSync('playwright-cli', [`-s=${opt('session', 'r9-look')}`, 'run-code', `--filename="${file}"`], { encoding: 'utf8', shell: true, maxBuffer: 1 << 24 });
fs.rmSync(file, { force: true });
console.log(((r.stdout || '') + (r.stderr || '')).slice(0, 6000));
