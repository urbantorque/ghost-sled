// Round 9, the concepts lane: the five's course geometry as the sim lays it, so a concept can say how far it
// leaves them on the axes the ground alone decides (length, profile, width and frame, the opening, the air,
// the hazards). The measure lane's mid-pilot figures (time, speed, airtime) are the ride's; these are the
// ground's. Reads the sim; writes nothing. `npx tsx scripts/r9/concepts-five.ts`.

import { Course, CHUNK_LEN, FOREST_LIMIT } from '../../src/sim/course';
import { MOUNTAINS } from '../../src/sim/mountains';

const r1 = (n: number): string => n.toFixed(1);
const r2 = (n: number): string => n.toFixed(2);

for (const m of MOUNTAINS) {
  const c = new Course(m.seed);
  const fin = c.finishZ;
  const drop = c.baseY(0) - c.baseY(fin);
  // The slope's profile, a quarter of the run at a time (the ground's own grade along the line).
  const quarters: string[] = [];
  for (let q = 0; q < 4; q++) {
    const a = (fin * q) / 4;
    const b = (fin * (q + 1)) / 4;
    quarters.push(r2((c.baseY(a) - c.baseY(b)) / (b - a)));
  }
  // Width and frame along the run: the corridor's width, and how far past its edge something solid stands.
  let wSum = 0;
  let wMin = Infinity;
  let wMax = 0;
  let limSum = 0;
  let n = 0;
  let walled = 0;
  for (let z = 0; z < fin; z += 5) {
    const w = 2 * c.halfWidth(z);
    wSum += w;
    wMin = Math.min(wMin, w);
    wMax = Math.max(wMax, w);
    const lim = c.edgeLimit(z);
    limSum += lim;
    if (lim < FOREST_LIMIT - 0.5) walled++;
    n++;
  }
  // Bends: the safe line's swings of 2 m or more, a turn each, per kilometre.
  let turns = 0;
  let dir = 0;
  let ext = c.safeX(0);
  for (let z = 0; z < fin; z += 2) {
    const x = c.safeX(z);
    if (dir >= 0 && x < ext - 2) {
      if (dir > 0) turns++;
      dir = -1;
      ext = x;
    } else if (dir <= 0 && x > ext + 2) {
      if (dir < 0) turns++;
      dir = 1;
      ext = x;
    } else if ((dir > 0 && x > ext) || (dir < 0 && x < ext)) ext = x;
  }
  // Hazards: hard obstacles inside the corridor, and those within 6 m of the line.
  let hard = 0;
  let near = 0;
  for (let i = 0; i * CHUNK_LEN < fin; i++) {
    for (const o of c.chunk(i).obstacles) {
      if (o.soft || o.z > fin) continue;
      if (c.edgeExcess(o.x, o.z) < 0) hard++;
      if (Math.abs(o.x - c.safeX(o.z)) < 6) near++;
    }
  }
  // The air the ground gives: ledges by kind and their heights, and the line's own kickers.
  const leaps = c.leaps.map((l) => `${r1(l.z)}m:${r1(l.height)}`);
  const steps = c.ledges.filter((l) => l.kind === 'step').length;
  const outlets = c.ledges.filter((l) => l.kind === 'outlet').length;
  let kicks = 0;
  for (let i = 0; i * CHUNK_LEN < fin; i++) kicks += c.zones(i).ramps.filter((r) => r.online).length;
  // What the descent is made of, by length.
  const kinds = new Map<string, number>();
  for (let z = 0; z < fin; ) {
    const s = c.section(z);
    kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + Math.min(s.z1, fin) - s.z0);
    z = s.z1;
  }
  const mix = [...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((100 * v) / fin)}%`);
  console.log(`\n${m.name} (seed ${m.seed.toString(16)})`);
  console.log(`  length ${fin} m, drop ${r1(drop)} m, mean grade ${r2(drop / fin)}, by quarter ${quarters.join(' / ')}`);
  console.log(`  width mean ${r1(wSum / n)} m (min ${r1(wMin)}, max ${r1(wMax)}), edge limit mean ${r1(limSum / n)} m, walled ${Math.round((100 * walled) / n)}% of the run`);
  console.log(`  bends of 2 m+ per km ${r1((turns / fin) * 1000)}, hard obstacles in the corridor per km ${r1((hard / fin) * 1000)}, within 6 m of the line per km ${r1((near / fin) * 1000)}`);
  console.log(`  leaps ${leaps.length} [${leaps.join(', ')}], terrace steps ${steps}, outlets ${outlets}, kickers on the line ${kicks}`);
  console.log(`  stages ${c.stages.map((s) => `${s.name} ${s.z1 - s.z0}`).join(' | ')}`);
  console.log(`  made of ${mix.join(', ')}`);
}
