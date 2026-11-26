// Round 9, the u4 lane: the other screens counted, from r9-truth.js's captures (its `sheets` and `titles` parts) as
// r9-screenbars.ts counts the title and results: for each surface shot, the words a reader reads on its first view,
// the controls on it and its tab stops, lone icons, primaries, bare figures and messages said twice. It prints a table
// a form factor and writes `<dir>/u4-counts.json`; it always exits 0.
//   npx tsx scripts/playtest/r9-u4-count.ts --dir C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/u4/before
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Shot, bareFigures, knownNames, readable, repeats, words } from './r9-screenbars';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const arg = (k: string): string | undefined => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const dir = arg('--dir') ?? 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/u4/before';
const raw = resolve(dir, 'raw');
const names = knownNames();

/** The surfaces this lane owns, by the shot's screen name. */
const MINE = /room-events|room-progress|league|twelve|medals|board|almanac|album|settings|pause|photo|title-trial|night/;

const rows: Any[] = [];
for (const f of existsSync(raw) ? readdirSync(raw).filter((x) => x.endsWith('.json')) : []) {
  let j: Any;
  try {
    j = JSON.parse(readFileSync(resolve(raw, f), 'utf8'));
    if (typeof j === 'string') j = JSON.parse(j);
  } catch {
    continue;
  }
  const form = f.startsWith('phone') ? 'phone' : 'desk';
  for (const [name, s] of Object.entries(j.shots ?? {}) as Array<[string, Any]>) {
    if (!MINE.test(name)) continue;
    const shot = s as Shot & Any;
    const ch = readable(shot);
    // (A sheet's controls are its own; on the title and results, everything not inert.)
    const sheet = shot.top && !['title', 'results', 'none'].includes(shot.top);
    const ctl = (shot.controls ?? []).filter((c: Any) => (sheet ? c.top : !c.inert));
    rows.push({
      form,
      shot: name,
      top: shot.top,
      words: words(ch),
      controls: ctl.length,
      tabStops: ctl.filter((c: Any) => c.tabbable).length,
      loneIcons: ctl.filter((c: Any) => c.iconOnly).map((c: Any) => c.name),
      primaries: ctl.filter((c: Any) => c.primary).length,
      bare: bareFigures(ch).map((x) => `${x.kind}: ${x.text}`),
      repeats: repeats(ch, names).map((x) => `${x.kind}: ${x.what} (${x.n})`),
      errors: (j.errors ?? []).length,
    });
  }
}
rows.sort((a, b) => a.form.localeCompare(b.form) || a.shot.localeCompare(b.shot));
for (const form of ['desk', 'phone']) {
  console.log(`\n${form}`);
  console.log('shot | words | controls | tab stops | lone icons | primaries | bare figures | said twice');
  for (const r of rows.filter((x) => x.form === form)) console.log(`${r.shot} | ${r.words} | ${r.controls} | ${r.tabStops} | ${r.loneIcons.length ? r.loneIcons.join(', ') : 0} | ${r.primaries} | ${r.bare.length ? r.bare.join('; ') : 0} | ${r.repeats.length ? r.repeats.join('; ') : 0}`);
}
writeFileSync(resolve(dir, 'u4-counts.json'), JSON.stringify(rows, null, 1));
