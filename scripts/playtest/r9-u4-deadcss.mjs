// Round 9, the u4 lane: the style rules the code can no longer draw. A selector is dead when one of its classes appears
// nowhere in the sources (src/**/*.ts and .js, index.html, ui-harness.html) as a whole word, a class built from a prefix
// in a template (`is-${...}`, `b-${...}`) aside; a rule is dead when every one of its selectors is. Prints each, and
// the selectors of a rule that are dead while others in it live ("PART"). Exits 0.
//   node scripts/playtest/r9-u4-deadcss.mjs [--write] . src/ui/a.css src/ui/b.css
// With --write it takes them out of the files named: a dead rule whole, a dead selector from a rule that lives, a
// comment that headed only rules taken out, and an @media left empty. Everything else is left byte for byte.
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const args = process.argv.slice(2);
const write = args[0] === '--write';
if (write) args.shift();
const root = args[0] ?? '.';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const srcs = walk(path.join(root, 'src'))
  .filter((f) => /\.(ts|js)$/.test(f))
  .concat(['index.html', 'ui-harness.html'].map((f) => path.join(root, f)).filter((f) => fs.existsSync(f)));
const text = srcs.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const known = new Map();
const alive = (cls) => {
  if (known.has(cls)) return known.get(cls);
  let ok = new RegExp(`(^|[^A-Za-z0-9_-])${esc(cls)}($|[^A-Za-z0-9_-])`).test(text);
  if (!ok) {
    const parts = cls.split('-');
    for (let i = parts.length - 1; i > 0 && !ok; i--) if (text.includes(`${parts.slice(0, i).join('-')}-\${`)) ok = true;
  }
  known.set(cls, ok);
  return ok;
};
const deadSel = (s) => (s.match(/\.[A-Za-z0-9_-]+/g) || []).some((c) => !alive(c.slice(1)));

let total = 0;
for (const f of args.slice(1)) {
  const src = fs.readFileSync(f, 'utf8');
  const ast = postcss.parse(src);
  const out = [];
  const gone = new Set();
  ast.walkRules((r) => {
    if (r.parent && r.parent.type === 'atrule' && /keyframes/.test(r.parent.name)) return;
    const sels = r.selectors;
    const dead = sels.filter(deadSel);
    if (dead.length === sels.length) {
      out.push(`${r.source.start.line}: ${r.selector.replace(/\s+/g, ' ').slice(0, 120)}`);
      gone.add(r);
    } else if (dead.length) {
      out.push(`${r.source.start.line}: PART ${dead.join(', ').slice(0, 120)}`);
      if (write) {
        // (The selector list keeps its own line breaks: each live selector on its line, as written.)
        const nl = r.raws.selector?.raw ?? r.selector;
        const sep = /,\r?\n/.test(nl) ? `,${nl.includes('\r\n') ? '\r\n' : '\n'}` : ', ';
        r.selector = sels.filter((s) => !dead.includes(s)).join(sep);
      }
    }
  });
  total += out.length;
  if (out.length) console.log(`\n${path.basename(f)} (${out.length})\n${out.join('\n')}`);
  if (!write || gone.size === 0) continue;
  // A comment goes with the rules under it when every node up to the next comment is going.
  const comments = new Set();
  ast.walk((n) => {
    if (n.type !== 'comment') return;
    const sib = n.parent.nodes;
    const i = sib.indexOf(n);
    const after = [];
    for (let j = i + 1; j < sib.length && sib[j].type !== 'comment'; j++) after.push(sib[j]);
    if (after.length > 0 && after.every((x) => gone.has(x))) comments.add(n);
  });
  for (const n of [...gone, ...comments]) n.remove();
  ast.walkAtRules((a) => {
    if (a.nodes && a.nodes.length === 0) a.remove();
  });
  fs.writeFileSync(f, ast.toString());
}
console.log(`\n${total} rules or parts`);
