// Round 8: what the stage-line thresholds moved. Every named mountain's places (sections) and set pieces, this
// checkout against --root (round 8's base), in metres: the look lanes key to sections, the main lane wants the list.
//   npx tsx scripts/playtest/r8-moved.ts --root <checkout>
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const i = process.argv.indexOf('--root');
const OLD = resolve(i >= 0 ? process.argv[i + 1] : '.');
const load = async (root: string, p: string) => import(pathToFileURL(resolve(root, p)).href);
const nc = await load('.', 'src/sim/course.ts');
const oc = await load(OLD, 'src/sim/course.ts');
const nm = await load('.', 'src/sim/moments.ts');
const om = await load(OLD, 'src/sim/moments.ts');
const { MOUNTAINS } = await load('.', 'src/sim/mountains.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const secs = (c: any) => {
  const out: { kind: string; z0: number; z1: number }[] = [];
  for (let z = 0; z < c.finishZ; ) {
    const s = c.section(z);
    out.push({ kind: s.kind + (s.gate ? '*' : ''), z0: s.z0, z1: s.z1 });
    z = s.z1;
  }
  return out;
};
for (const m of MOUNTAINS) {
  const a = new oc.Course(m.seed);
  const b = new nc.Course(m.seed);
  const sa = secs(a);
  const sb = secs(b).filter((s) => !s.kind.endsWith('*'));
  console.log(`\n${m.name}: ${sa.length} sections before, ${sb.length} after (and 2 thresholds)`);
  const rows: string[] = [];
  for (let k = 0, j = 0; k < sa.length || j < sb.length; ) {
    const x = sa[k];
    const y = sb[j];
    if (x && y && x.kind === y.kind) {
      const d0 = y.z0 - x.z0;
      const d1 = y.z1 - x.z1;
      if (Math.abs(d0) > 0.5 || Math.abs(d1) > 0.5) rows.push(`  ${x.kind.padEnd(12)} ${x.z0.toFixed(0).padStart(5)}-${x.z1.toFixed(0).padEnd(5)} -> ${y.z0.toFixed(0).padStart(5)}-${y.z1.toFixed(0).padEnd(5)} (${d0 >= 0 ? '+' : ''}${d0.toFixed(0)} m, length ${(y.z1 - y.z0 - (x.z1 - x.z0)).toFixed(0)})`);
      k++;
      j++;
    } else if (x && (!y || sb.slice(j).every((s) => s.kind !== x.kind))) {
      rows.push(`  ${x.kind.padEnd(12)} ${x.z0.toFixed(0)}-${x.z1.toFixed(0)} gone`);
      k++;
    } else {
      rows.push(`  ${y.kind.padEnd(12)} new at ${y.z0.toFixed(0)}-${y.z1.toFixed(0)}`);
      j++;
    }
  }
  console.log(rows.length ? rows.join('\n') : '  (no section moved)');
  const pa = om.momentPlays(a);
  const pb = nm.momentPlays(b);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of pb as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (pa as any[]).find((r) => r.key === p.key);
    console.log(`  set piece ${p.name}: ${q ? `${q.z0.toFixed(0)}-${q.z1.toFixed(0)} -> ` : 'new '}${p.z0.toFixed(0)}-${p.z1.toFixed(0)}${q ? ` (${p.z0 - q.z0 >= 0 ? '+' : ''}${(p.z0 - q.z0).toFixed(0)} m)` : ''}`);
  }
}
