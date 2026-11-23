// Round 9, the screens lane: what today's UI style sheets define, and which of it no source names.
// Counts per sheet: lines, rules, selectors, custom properties set, keyframes, and the spread of the values a design
// system would hold as tokens (font sizes, radii, colours, durations, easings, shadows). A class is "dead" when no
// .ts or .html under src (or the root html files) names it, literally or through a template prefix (`is-${x}` keeps
// every is-*). A rule is dead when every selector in it names a dead class. A first pass for milestone 1's U3, not a
// proof: a class built from a string the regex cannot see would be reported dead, so check before deleting.
//   node scripts/playtest/r9-css-audit.mjs [--json out.json]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const files = walk(join(root, 'src'));
const sheets = files.filter((f) => f.endsWith('.css'));
const code = files.filter((f) => /\.(ts|tsx|js|html)$/.test(f)).concat(['index.html', 'ui-harness.html'].map((f) => join(root, f)));
const src = code.map((f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } }).join('\n');

// Prefixes a template literal builds classes from: `foo-${x}` keeps every foo-*.
const dynPrefixes = new Set();
for (const m of src.matchAll(/([a-z][a-z0-9-]*-)\$\{/g)) dynPrefixes.add(m[1]);
// Classes built by joining a known prefix with a string (e.g. 'is-' + x).
for (const m of src.matchAll(/'([a-z][a-z0-9-]*-)'\s*\+/g)) dynPrefixes.add(m[1]);
// (A bare 'gs-' prefix would keep every class: only prefixes past the namespace count.)
dynPrefixes.delete('gs-');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const named = (cls) => {
  if (new RegExp(`(^|[^a-zA-Z0-9_-])${esc(cls)}($|[^a-zA-Z0-9_-])`).test(src)) return true;
  for (const p of dynPrefixes) if (cls.startsWith(p)) return true;
  return false;
};
if (process.argv.includes('--prefixes')) console.log('template prefixes', [...dynPrefixes].sort().join(' '));

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
const report = [];
const all = { fontSizes: new Map(), radii: new Map(), colours: new Map(), durations: new Map(), easings: new Map(), shadows: 0, weights: new Map() };
const bump = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
// Which screen a rule dresses, by the first class it names: the lines each screen's CSS takes.
const areas = new Map();
const AREA = (c) => {
  if (c === '(keyframes)') return 'keyframes';
  if (/^gs-(t-|title|logo|tagline|mtn|mtns|daily|cup|t12|wall|challenge|ride|pop|flame|missions|mis|stat)/.test(c)) return 'title and its popovers';
  if (/^gs-(res|results|again|lad|fin|st-|standings|mo-|mo$|ul|nu|x2|stamp|medal|mdot|mdots)/.test(c)) return 'results card (Details) and medals';
  if (/^gs-(sq|story)/.test(c)) return 'results sequence';
  if (/^gs-(hud|next|race|combo|lantern|stage|speed|clock|score|place|danger|mirror|chip|call|pop-|stomp|bank|fuse|stake|rival|cd|count|warn|banner|hint|touch|zone|ring|tz|av|drift|draft|mq|lens|flow|get|wipe|best|edge|kc|key)/.test(c)) return 'HUD, callouts and hints';
  if (/^gs-(sheet|garage|shelf|tile|sled|paint|look|gtab|btab|pv|preview|shop|buy|set|settings|pause|menu|lrow|lt-|range|tog|sel)/.test(c)) return 'sheets: garage, settings, pause';
  if (/^gs-(bk|book|alm|album|stk|page|ch-)/.test(c)) return 'books: Almanac and album';
  if (/^gs-(photo|ph-|reel|clip|rec)/.test(c)) return 'photo, reel and clip';
  if (/^gs-(toast|notice|note|reveal|rv-|mood|night|nightbeat|nb-|load|veil|legend|lg-)/.test(c)) return 'toasts, reveal, legends, loading';
  if (/^gs-(btn|panel|pill|kbd|pad|i$|i-|num|sr|tag|h2|scrim|ui)/.test(c)) return 'shared primitives';
  return 'other';
};
let deadClassesAll = new Set();
for (const f of sheets) {
  const raw = readFileSync(f, 'utf8');
  const css = strip(raw);
  const lines = raw.split('\n').length;
  // Rules: selector { body } at any depth (media blocks hold rules too).
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@') || /^(from|to|\d+%)/.test(sel)) continue;
    const startLine = css.slice(0, m.index).split('\n').length;
    const endLine = css.slice(0, re.lastIndex).split('\n').length;
    rules.push({ sel, body: m[2], lines: endLine - startLine + 1 });
  }
  const props = new Set();
  for (const p of css.matchAll(/(--[a-z0-9-]+)\s*:/gi)) props.add(p[1]);
  const keyframes = [...css.matchAll(/@keyframes\s+([a-z0-9-]+)/gi)].map((k) => k[1]);
  const deadKf = keyframes.filter((k) => !css.includes(`${k} `) && !css.includes(`${k};`) && !src.includes(k)).filter((k) => {
    // used anywhere in any sheet's animation shorthand?
    return !sheets.some((s) => new RegExp(`animation[^;]*\\b${k}\\b`).test(readFileSync(s, 'utf8')));
  });
  const classes = new Set();
  for (const r of rules) for (const c of r.sel.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)) classes.add(c[1]);
  const dead = [...classes].filter((c) => !named(c));
  for (const c of dead) deadClassesAll.add(c);
  const deadSet = new Set(dead);
  let deadRules = 0;
  let deadLines = 0;
  for (const r of rules) {
    // (A mode scope, .gs-ui or .gs-touch-mode, names the screen in the class after it.)
    const named1 = [...r.sel.matchAll(/\.(gs-[a-z0-9]+(?:-[a-z0-9]+)?)/g)].map((x) => x[1]).filter((x) => !/^gs-(ui|touch-mode|pad-mode|has-pad)$/.test(x));
    const first = named1[0] ?? (/^(from|to|\d)/.test(r.sel) ? '(keyframes)' : '(other)');
    bump(areas, AREA(first), r.lines);
    const parts = r.sel.split(',').map((s) => s.trim());
    const allDead = parts.every((p) => {
      const cs = [...p.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((x) => x[1]);
      return cs.length > 0 && cs.some((c) => deadSet.has(c));
    });
    if (allDead) {
      deadRules++;
      deadLines += r.lines;
    }
    for (const d of r.body.split(';')) {
      const [k, ...v] = d.split(':');
      if (!k || !v.length) continue;
      const key = k.trim();
      const val = v.join(':').trim();
      if (key === 'font-size') bump(all.fontSizes, val);
      else if (key === 'border-radius') bump(all.radii, val);
      else if (key === 'font-weight') bump(all.weights, val);
      else if (key === 'box-shadow' || key === 'text-shadow') all.shadows++;
      if (/transition|animation/.test(key)) {
        for (const t of val.matchAll(/(\d+(?:\.\d+)?m?s)\b/g)) bump(all.durations, t[1]);
        for (const e of val.matchAll(/cubic-bezier\([^)]*\)|ease-in-out|ease-out|ease-in|linear|var\(--[a-z-]+\)/g)) bump(all.easings, e[0]);
      }
      for (const c of val.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) bump(all.colours, c[0].toLowerCase().replace(/\s+/g, ''));
    }
  }
  report.push({ sheet: relative(root, f).replace(/\\/g, '/'), lines, rules: rules.length, classes: classes.size, props: props.size, keyframes: keyframes.length, deadClasses: dead.length, deadRules, deadLines, deadKeyframes: deadKf, deadSample: dead.slice(0, 12) });
}
const tot = report.reduce((s, r) => ({ lines: s.lines + r.lines, rules: s.rules + r.rules, classes: s.classes + r.classes, props: s.props + r.props, keyframes: s.keyframes + r.keyframes, deadRules: s.deadRules + r.deadRules, deadLines: s.deadLines + r.deadLines }), { lines: 0, rules: 0, classes: 0, props: 0, keyframes: 0, deadRules: 0, deadLines: 0 });
const top = (m, n = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
console.log('sheet'.padEnd(22), 'lines', 'rules', 'classes', 'props', 'kf', 'deadCls', 'deadRules', 'deadLines');
for (const r of report.sort((a, b) => b.lines - a.lines)) console.log(r.sheet.replace('src/ui/', '').padEnd(22), String(r.lines).padStart(5), String(r.rules).padStart(5), String(r.classes).padStart(7), String(r.props).padStart(5), String(r.keyframes).padStart(3), String(r.deadClasses).padStart(7), String(r.deadRules).padStart(9), String(r.deadLines).padStart(9));
console.log('total'.padEnd(22), tot);
console.log('distinct font-size values', all.fontSizes.size, top(all.fontSizes, 15));
console.log('distinct border-radius values', all.radii.size, top(all.radii, 15));
console.log('distinct font-weight values', all.weights.size, top(all.weights));
console.log('distinct colours', all.colours.size, 'shadows', all.shadows);
console.log('distinct durations', all.durations.size, top(all.durations, 15));
console.log('distinct easings', all.easings.size, top(all.easings, 10));
console.log('dead classes (all sheets)', deadClassesAll.size, [...deadClassesAll].join(' '));
console.log('lines by screen (rule bodies, by the first class a selector names):', top(areas, 20));
const i = process.argv.indexOf('--json');
if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify({ report, totals: tot, fontSizes: top(all.fontSizes, 200), radii: top(all.radii, 200), weights: top(all.weights), durations: top(all.durations, 100), easings: top(all.easings, 50), colours: all.colours.size, shadows: all.shadows, dead: [...deadClassesAll].sort() }, null, 1));
