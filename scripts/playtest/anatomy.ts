// Course anatomy on a build: what the rider's corridor really is, section by section.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const ROOT = resolve(process.argv[2] ?? '.');
const load = async (p: string) => import(pathToFileURL(resolve(ROOT, p)).href);
const { Course, CHUNK_LEN } = await load('src/sim/course.ts');
const { MOUNTAINS } = await load('src/sim/mountains.ts');
const LEN = 6000;
for (const m of MOUNTAINS) {
  const c = new Course(m.seed);
  const stats: Record<string, { n: number; w: number[]; sl: number[]; bendAbs: number[] }> = {};
  let z = 0;
  let prevY = c.baseY(0);
  let drops = 0, ramps = 0, mog = 0, ice = 0, vents = 0, gates = 0, obs = 0;
  const seq: string[] = [];
  let last = '';
  const widths: number[] = [];
  const slopes: number[] = [];
  while (z < LEN) {
    const sec = c.section(z);
    if (sec.kind !== last) { seq.push(`${sec.kind}@${Math.round(sec.z0)}`); last = sec.kind; }
    const hw = c.halfWidth(z);
    const y = c.baseY(z + 10);
    const sl = (prevY - y) / 10;
    prevY = y;
    const st = (stats[sec.kind] ??= { n: 0, w: [], sl: [], bendAbs: [] });
    st.n++;
    st.w.push(hw * 2);
    st.sl.push(sl);
    st.bendAbs.push(Math.abs(c.safeX(z + 10) - c.safeX(z)) / 10);
    widths.push(hw * 2);
    slopes.push(sl);
    z += 10;
  }
  for (let i = 0; i * CHUNK_LEN < LEN; i++) {
    const ch = c.chunk(i);
    drops += ch.zones.drops.length; ramps += ch.zones.ramps.length; mog += ch.zones.moguls.length; ice += ch.zones.ice.length; vents += ch.zones.vents.length; gates += ch.gates.length; obs += ch.obstacles.length;
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const min = (a: number[]) => Math.min(...a);
  const max = (a: number[]) => Math.max(...a);
  console.log(`\n== ${m.id}: width ${min(widths).toFixed(0)}..${max(widths).toFixed(0)} (mean ${mean(widths).toFixed(1)}), slope ${min(slopes).toFixed(2)}..${max(slopes).toFixed(2)}; in ${LEN} m: drops ${drops}, kickers ${ramps}, moguls ${mog}, ice ${ice}, vents ${vents}, gates ${gates}, obstacles ${obs}`);
  console.log('   ' + seq.slice(0, 22).join(' '));
  for (const [k, st] of Object.entries(stats)) console.log(`   ${k.padEnd(12)} ${String(st.n * 10).padStart(5)} m  width ${mean(st.w).toFixed(1)}  slope ${mean(st.sl).toFixed(3)}  lateral ${mean(st.bendAbs).toFixed(3)}`);
  // Biggest single drop on the safe line.
  let bigDrop = 0, at = 0;
  for (let i = 0; i * CHUNK_LEN < LEN; i++) for (const d of c.zones(i).drops) if (d.depth > bigDrop) { bigDrop = d.depth; at = d.z; }
  console.log(`   biggest drop ${bigDrop.toFixed(1)} m at ${at.toFixed(0)} (over ${'7-10'} m)`);
}
