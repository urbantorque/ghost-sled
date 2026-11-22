// Where a run's charm gates and set pieces stand (sim z), for choosing stills: a fresh save, demo rider 0.
//   playwright-cli -s=r8-lowperf eval "window.__gtCfg = { base: 'http://127.0.0.1:4880/', ms: [0, 2] }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/gates.js
async (page) => {
  const cfg = { ms: [0, 2, 3], ...((await page.evaluate(() => window.__gtCfg).catch(() => null)) || {}) };
  const out = {};
  for (const m of cfg.ms) {
    await page.goto(cfg.base);
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.goto(`${cfg.base}?platform=mock&debug&tier=low&autoride=1&m=${m}&demo=0`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
    out[m] = await page.evaluate(() => {
      const sim = window.__gs.run.sim;
      const gates = (sim.charmGates ?? []).map((g) => Math.round(g.z));
      const sites = window.__gs.world.setPieces?.plan?.planned?.map((s) => `${s.kind ?? s.name ?? '?'}@${Math.round(s.z)}+${Math.round(s.len ?? 0)}`) ?? null;
      return { gates, sites, finish: Math.round(sim.course.finishZ) };
    });
  }
  return JSON.stringify(out, null, 1);
}
