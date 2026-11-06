// Contact sheets: writes a labelled grid of captured frames as an HTML file; open it in a browser to look
// at a whole tour at once, or pass a second folder to put two builds side by side.
//   node scripts/playtest/sheet.mjs <out.html> <cols> <dirA> [--vs <dirB>] [--match <regex>]
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
const a = process.argv.slice(2);
const out = resolve(a[0]);
const cols = +a[1];
const dirA = resolve(a[2]);
const vsAt = a.indexOf('--vs');
const dirB = vsAt >= 0 ? resolve(a[vsAt + 1]) : null;
const mAt = a.indexOf('--match');
const re = mAt >= 0 ? new RegExp(a[mAt + 1]) : /./;
const rel = (d, f) => relative(dirname(out), resolve(d, f)).split('\\').join('/');
const files = readdirSync(dirA).filter((f) => f.endsWith('.png') && re.test(f)).sort();
const tile = (src, label) => `<figure><figcaption>${label}</figcaption><img src="${src}"></figure>`;
let body = '';
for (const f of files) {
  body += tile(rel(dirA, f), f);
  if (dirB) body += tile(rel(dirB, f), 'after ' + f);
}
writeFileSync(out, `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#111;color:#eee;font:12px system-ui}main{display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;padding:4px}figure{margin:0}figcaption{padding:2px 4px}img{width:100%;display:block}</style><main>${body}</main>`);
console.log(`${files.length} frames -> ${out}`);
