// World-scale critique set: the title, then a replayed best ghost (?demo=0) ridden as the player
// down each mountain, shot at fixed distances so builds compare frame for frame, with the
// console's errors and frame stats.
// Run against the preview build (port 4173) or dev (5173): set BASE and OUT below, then
//   playwright-cli -s=gs run-code --filename=scripts/playtest/vista.js
async (page) => {
  const BASE = 'http://127.0.0.1:4173/';
  const OUT = 'shots/vista/';
  const MOUNTAINS = [0, 1, 2, 3];
  const AT = [300, 1500, 2600, 3900];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text()); });
  const report = [];

  await page.goto(BASE + '?debug&tier=high');
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + 'title.png' });

  for (const m of MOUNTAINS) {
    await page.goto(BASE + `?debug&tier=high&autoride=1&demo=0&m=${m}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
    for (const at of AT) {
      const ok = await page
        .waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.crashed || r.sim.distance >= d; }, at, { timeout: 240000, polling: 50 })
        .then(() => true, () => false);
      const st = await page.evaluate(() => {
        const r = window.__gs.run;
        return { dist: r ? Math.round(r.sim.distance) : null, crashed: r ? r.sim.s.crashed : null, stats: window.__gs.frameStats ? window.__gs.frameStats() : null };
      });
      if (!ok || st.crashed || st.dist == null) { report.push({ m, at, skipped: true, st }); break; }
      await page.screenshot({ path: OUT + `m${m}-${at}.png` });
      report.push({ m, at, st });
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors }, null, 1);
}
