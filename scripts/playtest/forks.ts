// Does a fork's risk route pay on the real sim? Bots of one skill ride each route from the same seeds,
// and this prints the median time through the fork, hits and share on the ice.
//   npx tsx scripts/playtest/forks.ts [runs=14]
import { runBot } from '../../src/bot/bot';
import { PLAIN } from '../../src/sim/chaos';
import { MOUNTAINS, dailySeed } from '../../src/sim/mountains';
import { replayRecord } from '../../src/sim/replay';
const RUNS = +(process.argv[2] ?? 14);
const run = (seed: number, bold: boolean, skill: number, s0: number) => {
  const { record } = runBot(seed, PLAIN, { skill, seed: s0, sled: 0, name: 'x', bold }, 60 * 60 * 5);
  let t0 = -1, t1 = -1, hits = 0, ice = 0, n = 0;
  const sim = replayRecord(record, (k) => {
    const s = k.s;
    const sec = k.course.section(s.z);
    const inFork = sec.kind === 'fork' && s.z >= sec.z0 + sec.blend;
    if (inFork && t0 < 0) t0 = k.tick;
    if (t0 >= 0 && t1 < 0) {
      if (!inFork) t1 = k.tick;
      else {
        n++;
        if (s.onIce) ice++;
        for (const e of k.events) if (e.type === 'tumble' && e.phase === 'start') hits++;
      }
    }
  });
  return { t: t1 > 0 ? (t1 - t0) / 60 : NaN, hits, ice: ice / Math.max(1, n), end: sim.finished ? sim.s.finishTick / 60 : NaN };
};
const med = (a: number[]): string => {
  const s = a.filter((x) => !Number.isNaN(x)).sort((x, y) => x - y);
  return s.length ? s[s.length >> 1].toFixed(2) : '-';
};
for (const [id, seed] of [...MOUNTAINS.map((m) => [m.id, m.seed] as const), ['daily', dailySeed('2026-11-06')] as const]) {
  for (const skill of [0.6, 0.95]) {
    const a = [];
    const b = [];
    for (let i = 0; i < RUNS; i++) {
      a.push(run(seed, false, skill, 500 + i * 3));
      b.push(run(seed, true, skill, 500 + i * 3));
    }
    const hits = (x: typeof a) => x.reduce((p, q) => p + q.hits, 0);
    const ice = (x: typeof a) => (100 * x.reduce((p, q) => p + q.ice, 0)) / RUNS;
    console.log(String(id).padEnd(10), 'skill', skill, `safe fork ${med(a.map((r) => r.t))} s, hits ${hits(a)}, finish ${med(a.map((r) => r.end))} | bold fork ${med(b.map((r) => r.t))} s, hits ${hits(b)}, on ice ${ice(b).toFixed(0)}%, finish ${med(b.map((r) => r.end))}`);
  }
}
