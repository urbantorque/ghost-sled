// What each set piece holds on every named mountain and a few dailies (src/sim/moments.ts), without a browser:
// every variant of every set piece, each mountain's legends, and the climax's distances and times.
//   npx tsx scripts/playtest/moments-plan.ts            the plan
//   npx tsx scripts/playtest/moments-plan.ts --rolls 4000   how often each variant and legend comes up, over rolled runs
import { ChaosEvent, type ChaosRoll, Mood, rollChaos } from '../../src/sim/chaos';
import { Course } from '../../src/sim/course';
import { type MomentPlay, climaxOf, coastSeconds, legendFor, momentPlays, planLegends, planMoments, rollForVariant } from '../../src/sim/moments';
import { MOUNTAINS, dailySeed } from '../../src/sim/mountains';
import { hash32 } from '../../src/sim/prng';

const PLAIN: ChaosRoll = { mood: Mood.None, event: ChaosEvent.None, seed: 0x1234 };

function holds(c: Course, p: MomentPlay): string {
  switch (p.verb) {
    case 'race':
      return p.style === 'chase' ? p.cars.map((q) => `car ${q.lead} m ahead at ${q.pace.toFixed(1)} m/s`).join(', ') + `, span ${Math.round(p.z1 - p.z0)} m` : `pace ${p.pace.toFixed(1)} m/s (leaves at ${(p.v0 * p.pace).toFixed(1)}), lead ${p.lead} m, span ${Math.round(p.z1 - p.z0)} m`;
    case 'collapse':
      return p.from === 1 ? `from the far end, keystone at ${Math.round(p.keystone)}` : `from ${p.lead} m behind, least ${p.pace} m/s${p.surge ? `, surging ${p.surge} m/s` : ''}`;
    case 'gates':
      return `${p.gates.length} gates: ` + p.gates.map((g) => `${Math.round(g.z)}@${(g.x - c.safeX(g.z)).toFixed(1)}${g.amp ? `~${g.amp.toFixed(1)}/${(g.period / 60).toFixed(1)}s` : ''}`).join(' ');
    case 'rings':
      return p.rings.map((r) => `z${Math.round(r.z)} x${(r.x - c.safeX(r.z)).toFixed(1)} h${(r.y - c.ground(r.x, r.z)).toFixed(1)}`).join(' | ');
    case 'steps':
      return `${p.steps.length ? `${p.steps.length} steps at ${p.steps.map((z) => Math.round(z)).join(' ')}` : 'the rider\'s own pops'}; ${p.need} stomps${p.row ? ' in a row' : ''}`;
    case 'slide':
      return p.both ? `a drift of ${(p.each / 60).toFixed(1)} s each way` : `one drift of ${(p.need / 60).toFixed(1)} s`;
    case 'shatter':
      return `${p.targets.length} bells: ` + p.targets.map((t) => `${Math.round(t.z)}^${t.h.toFixed(1)}${t.top < 50 ? `-${t.top.toFixed(1)}` : ''}`).join(' ');
    case 'surge':
      return `lip ${Math.round(p.lip)}, set for ${p.speed} m/s, far line ${Math.round(p.far)} (${Math.round(p.far - p.lip)} m out)`;
    case 'flourish':
      return `lip ${Math.round(p.lip)}: ${p.half} half turns and ${p.flips} flips`;
    case 'follow': {
      const off = p.path ? p.path.off : [];
      return `path ${Math.round(p.path?.z0 ?? 0)}-${Math.round(p.path?.z1 ?? 0)}, widest ${Math.max(...off.map(Math.abs)).toFixed(1)} m, ${off.filter((o) => Math.abs(o) < 0.05).length}/${off.length} samples on the line, need ${p.need} m in a wake ${p.hw} m either side`;
    }
    case 'kindle':
      return `${p.lamps.length} lamps (${p.lamps.filter((l) => l.dark).length} dark: ${p.lamps.map((l) => (l.dark ? (l.side > 0 ? 'R' : 'L') : '.')).join('')}), need ${p.need}, ${p.each} a side`;
    case 'carry':
      return `flame ${(p.flameTicks / 60).toFixed(1)} s from full, starts ${p.flame0}, a hit takes ${p.hit}${p.relight ? `, brazier at ${Math.round(p.relight.z)} (${(p.relight.x - c.safeX(p.relight.z)).toFixed(1)} off)` : ''}; ${Math.round(p.z1 - p.z0)} m`;
  }
}

const show = (label: string, c: Course): void => {
  console.log(`== ${label} (${c.trueBiome})`);
  for (const m of planMoments(c)) {
    console.log(`  ${m.index} ${m.key} ${m.verb}${m.style ? ':' + m.style : ''} ${Math.round(m.z0)}-${Math.round(m.z1)} stage ${m.stage}: "${m.line}"`);
    for (let v = 0; v < m.variants; v++) {
      const p = momentPlays(c, rollForVariant(c, PLAIN, v))[m.index];
      console.log(`      ${p.variantKey.padEnd(9)} "${p.say}": ${holds(c, p)}`);
    }
  }
  planLegends(c).forEach((lg, i) => {
    if (!lg) console.log(`  legend ${i + 1}: none here`);
    else console.log(`  legend ${lg.slot} ${lg.key} ${lg.kind} ${Math.round(lg.z0)}-${Math.round(lg.z1)} "${lg.name}": ${lg.lights.length} lights${lg.path ? `, line widest ${Math.max(...lg.path.off.map(Math.abs)).toFixed(1)} m` : ''}`);
  });
  const k = climaxOf(c);
  const t = (z: number): string => coastSeconds(c, z, k.lineZ, 36).toFixed(1);
  console.log(`  climax: last set piece ${Math.round(k.pieceZ0)}-${Math.round(k.pieceZ1)} (${t(k.pieceZ1)} s from the line at a coast), peak ${Math.round(k.peakZ)} (${t(k.peakZ)} s), lands ${Math.round(k.landZ)} (${t(k.landZ)} s), town ${Math.round(k.townZ)} (${t(k.townZ)} s), line ${k.lineZ}`);
};

const rollsAt = process.argv.indexOf('--rolls');
if (rollsAt >= 0) {
  // Rolled runs as the game rolls them: a session's first run, then its later ones.
  const N = Number(process.argv[rollsAt + 1] ?? 2000);
  for (const m of MOUNTAINS) {
    const c = new Course(m.seed);
    const specs = planMoments(c);
    const counts = specs.map((s) => new Array<number>(s.variants).fill(0));
    const legends = new Map<string, number>();
    let first = 0;
    for (let i = 0; i < N; i++) {
      const runIndex = i % 6;
      const roll = rollChaos(hash32(m.seed, 0x7011, i), runIndex);
      momentPlays(c, roll).forEach((p) => counts[p.index][p.variant]++);
      const lg = legendFor(c, roll);
      if (lg) {
        legends.set(lg.key, (legends.get(lg.key) ?? 0) + 1);
        if (runIndex === 0) first++;
      }
    }
    const names = specs.map((s, i) => `${s.key} ${counts[i].map((n, v) => `${momentPlays(c, rollForVariant(c, PLAIN, v))[i].variantKey} ${((100 * n) / N).toFixed(0)}%`).join(' ')}`);
    const later = N - Math.ceil(N / 6);
    const all = [...legends.values()].reduce((a, b) => a + b, 0);
    console.log(`${m.id}: ${N} rolled runs (one in six a session's first)\n  variants: ${names.join(' | ')}\n  legends: ${[...legends].map(([k2, n]) => `${k2} ${n} (1 in ${(later / n).toFixed(0)} later runs)`).join(', ')}; any legend 1 in ${(later / Math.max(1, all)).toFixed(1)} later runs; on a first run: ${first}`);
  }
} else {
  for (const m of MOUNTAINS) show(m.id, new Course(m.seed));
  for (const key of ['2026-11-08', '2026-11-10', '2026-12-01']) show(key, new Course(dailySeed(key)));
}
