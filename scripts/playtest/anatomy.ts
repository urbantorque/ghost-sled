// Course anatomy on a build: what the rider's descent really is, section by section.
//   npx tsx scripts/playtest/anatomy.ts [root] [--daily 2026-10-24,2026-12-25]
// For each mountain: its stages, its section sequence, the longest plain stretch, the width and slope
// ranges, its cliffs (with the flight off each at 18, 28 and 44 m/s), its features, and a per-section table.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = argv.indexOf('--daily');
const dailies = flag >= 0 ? argv[flag + 1].split(',') : [];
const ROOT = resolve(argv[0] && !argv[0].startsWith('--') ? argv[0] : '.');
const load = async (p: string) => import(pathToFileURL(resolve(ROOT, p)).href);
const { Course, CHUNK_LEN, RUN_OUT } = await load('src/sim/course.ts');
const { MOUNTAINS, dailySeed } = await load('src/sim/mountains.ts');

const G = 9.81;
/** The sim's air drag and friction, for the risk route's sums. */
const CD = 0.0027;
const MU = 0.03;
/** The kinds that are plain ground: a stretch of only these is the thing the script keeps short. */
const PLAIN = new Set(['cruise']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCourse = any;

const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const f1 = (v: number): string => v.toFixed(1);
const f2 = (v: number): string => v.toFixed(2);

/** A sled leaving the lip at speed v on the safe line, flown to touchdown. */
function fly(c: AnyCourse, lip: number, v: number): { t: number; d: number; slope: number; impact: number } {
  const dt = 1 / 120;
  const y0 = c.ground(c.safeX(lip), lip);
  let y = y0;
  let vy = (v * (y0 - c.ground(c.safeX(lip - 0.5), lip - 0.5))) / 0.5;
  let z = lip;
  for (let t = dt; t < 12; t += dt) {
    vy -= G * dt;
    y += vy * dt;
    z += v * dt;
    const x = c.safeX(z);
    if (y <= c.ground(x, z)) {
      const slope = (c.ground(x, z - 0.2) - c.ground(x, z + 0.2)) / 0.4;
      return { t, d: z - lip, slope, impact: -slope * v - vy };
    }
  }
  return { t: 12, d: z - lip, slope: 0, impact: 0 };
}

function anatomy(c: AnyCourse, name: string): void {
  const end = c.finishZ;
  const secs: AnyCourse[] = [];
  for (let z = 0; z < end; ) {
    const s = c.section(z);
    secs.push(s);
    z = s.z1;
  }
  const inFace = (z: number): boolean => c.ledges.some((l: AnyCourse) => z + 5 >= l.z - 1 && z - 5 <= l.foot + 1);
  const widths: number[] = [];
  const slopes: number[] = [];
  for (let z = 0; z < end; z += 5) {
    widths.push(c.halfWidth(z) * 2);
    if (!inFace(z)) slopes.push((c.baseY(z - 5) - c.baseY(z + 5)) / 10);
  }

  // Features and obstacles, per chunk and so per section.
  const feats = { ramps: 0, online: 0, drops: 0, moguls: 0, ice: 0, vents: 0, rails: 0, gates: 0, obstacles: 0, gifts: 0 };
  const perSec = new Map<AnyCourse, { obs: number; ramps: number; online: number; rails: number; vents: number }>();
  for (const s of secs) perSec.set(s, { obs: 0, ramps: 0, online: 0, rails: 0, vents: 0 });
  const of = (z: number) => perSec.get(c.section(z));
  for (let i = 0; i * CHUNK_LEN < end + RUN_OUT; i++) {
    const ch = c.chunk(i);
    const zn = ch.zones;
    feats.ramps += zn.ramps.length;
    feats.drops += zn.drops.filter((d: AnyCourse) => d.depth > 0).length;
    feats.moguls += zn.moguls.length;
    feats.ice += zn.ice.length;
    feats.vents += zn.vents.length;
    feats.rails += zn.rails.length;
    feats.gates += ch.gates.length;
    feats.obstacles += ch.obstacles.length;
    feats.gifts += ch.gifts.length;
    for (const r of zn.ramps) {
      if (r.online) feats.online++;
      const q = of(r.z);
      if (q) {
        q.ramps++;
        if (r.online) q.online++;
      }
    }
    for (const r of zn.rails) {
      const q = of(r.z0);
      if (q) q.rails++;
    }
    for (const v of zn.vents) {
      const q = of(v.z);
      if (q) q.vents++;
    }
    for (const o of ch.obstacles) {
      const q = of(o.z);
      if (q) q.obs++;
    }
  }

  // Longest plain stretch, and the longest the shape holds still (a blend, a lip or a step ends one).
  let plain = 0;
  let plainRun = 0;
  let still = 0;
  for (const s of secs) {
    if (PLAIN.has(s.kind)) plainRun += s.z1 - s.z0;
    else plainRun = 0;
    plain = Math.max(plain, plainRun);
    const stops = [s.z0 + s.blend, ...s.ledges.map((l: AnyCourse) => l.z), s.z1];
    if (s.kind !== 'finish') for (let i = 1; i < stops.length; i++) still = Math.max(still, stops[i] - stops[i - 1]);
  }

  console.log(`\n== ${name}: ${c.biome}, seed ${(c.seed >>> 0).toString(16)}`);
  console.log(`   stages: ${c.stages.map((s: AnyCourse) => `${s.name} (${s.z0}-${s.z1})`).join(', ')}; finish ${end}, run-out ${RUN_OUT}`);
  console.log(`   ${secs.map((s) => `${s.kind}@${Math.round(s.z0)}`).join(' ')}`);
  console.log(`   width ${Math.min(...widths).toFixed(0)}..${Math.max(...widths).toFixed(0)} (mean ${f1(mean(widths))}), slope ${f2(Math.min(...slopes))}..${f2(Math.max(...slopes))} (faces apart), longest plain stretch ${plain.toFixed(0)} m, longest unchanged ${still.toFixed(0)} m`);
  console.log(`   ${feats.ramps} kickers (${feats.online} on the line), ${feats.rails} rails, ${feats.drops} drops, ${feats.moguls} moguls, ${feats.ice} ice, ${feats.vents} vents, ${feats.gates} gates, ${feats.obstacles} obstacles, ${feats.gifts} gifts`);
  const drop = c.baseY(0) - c.baseY(end);
  console.log(`   descent ${drop.toFixed(0)} m; ledges fall ${c.ledges.reduce((a: number, l: AnyCourse) => a + l.total, 0).toFixed(0)} m of it`);
  for (const l of c.ledges) {
    if (l.kind !== 'leap') continue;
    const f = [18, 28, 30, 44].map((v) => {
      const r = fly(c, l.z, v);
      return `${v}: ${f1(r.t)} s, ${r.d.toFixed(0)} m, slope ${f2(r.slope)}, impact ${f1(r.impact)}`;
    });
    console.log(`   cliff ${f1(l.height)} m at ${l.z.toFixed(0)}, ${f1(l.total)} m down for good. ${f.join(' | ')}`);
  }
  for (const s of secs) {
    if (s.kind !== 'fork') continue;
    // The risk route, from the same 30 m/s: what the strip of ice is worth over the fork's length.
    const time = (line: (z: number) => number): number => {
      let v = 30;
      let t = 0;
      for (let z = s.z0; z < s.z1; z += 1) {
        const sl = (c.baseY(z - 5) - c.baseY(z + 5)) / 10;
        const drag = c.surface(line(z), z).drag;
        v = Math.min(46, Math.sqrt(Math.max(1, v * v + 2 * ((G * sl) / (1 + sl * sl) - MU * G - CD * drag * v * v))));
        t += 1 / v;
      }
      return t;
    };
    const ridge = c.ground(c.centerX(s.z1 - 40), s.z1 - 40) - c.ground(c.safeX(s.z1 - 40), s.z1 - 40);
    console.log(`   fork at ${s.z0.toFixed(0)}: ridge ${f1(ridge)} m, risk route saves ${f2(time((z) => c.safeX(z)) - time((z) => c.altX(z) ?? c.safeX(z)))} s`);
  }
  const steps = c.ledges.filter((l: AnyCourse) => l.kind === 'step');
  if (steps.length) console.log(`   steps ${steps.map((l: AnyCourse) => `${f1(l.height)}@${l.z.toFixed(0)}`).join(' ')}`);
  const outlets = c.ledges.filter((l: AnyCourse) => l.kind === 'outlet');
  if (outlets.length) console.log(`   outlets ${outlets.map((l: AnyCourse) => `${f1(l.height)}@${l.z.toFixed(0)}, ${f1(fly(c, l.z, 30).t)} s at 30 m/s`).join(' ')}`);

  console.log('   kind         from     len  blend   width      slope  bend/m    limit  obst kick (line) rail vent');
  for (const s of secs) {
    const body = s.z0 + s.blend;
    const to = Math.min(s.z1, end + RUN_OUT);
    const w: number[] = [];
    const sl: number[] = [];
    const bend: number[] = [];
    for (let z = body; z < to; z += 5) {
      w.push(c.halfWidth(z) * 2);
      if (!inFace(z)) sl.push((c.baseY(z - 5) - c.baseY(z + 5)) / 10);
      bend.push(Math.abs(c.safeX(z + 5) - c.safeX(z)) / 5);
    }
    const q = perSec.get(s)!;
    console.log(
      '   ' +
        s.kind.padEnd(11),
        String(Math.round(s.z0)).padStart(5),
        String(Math.round(s.z1 - s.z0)).padStart(6),
        String(Math.round(s.blend)).padStart(5),
        `${Math.min(...w).toFixed(0)}-${Math.max(...w).toFixed(0)}`.padStart(8),
        f2(mean(sl)).padStart(8),
        mean(bend).toFixed(3).padStart(7),
        f1(c.edgeLimit(Math.min(body + 1, to - 1))).padStart(7),
        String(q.obs).padStart(5),
        String(q.ramps).padStart(4),
        `(${q.online})`.padStart(6),
        String(q.rails).padStart(4),
        String(q.vents).padStart(4),
    );
  }
}

for (const m of MOUNTAINS) anatomy(new Course(m.seed), m.id);
for (const key of dailies) anatomy(new Course(dailySeed(key)), `daily ${key}`);
