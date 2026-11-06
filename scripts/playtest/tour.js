// The comparison tour: the same frames on any build, so a before and after is one folder beside another.
// It plays a clumsy first run with real keys, rides a replayed best run down every mountain at 1x, and
// rides every mood, shooting fixed distances plus a burst of frames for motion, and logs the console.
//   playwright-cli -s=tour open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=tour goto http://127.0.0.1:4310/
//   playwright-cli -s=tour eval "window.__tourCfg = { base: 'http://127.0.0.1:4310/', out: 'shots/r3/base/', parts: ['clumsy','mountains','moods'] }"
//   playwright-cli -s=tour run-code --filename=scripts/playtest/tour.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4173/', out: 'shots/r3/x/', parts: ['clumsy', 'mountains', 'moods'], tier: 'high' }, (await page.evaluate(() => window.__tourCfg).catch(() => null)) || {});
  const { base: BASE, out: OUT, tier: TIER } = cfg;
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  const probe = () => page.evaluate(() => {
    const g = window.__gs;
    const r = g.run;
    if (!r) return { phase: g.phase };
    const s = r.sim.s;
    return { phase: g.phase, t: +(r.sim.tick / 60).toFixed(1), z: Math.round(r.sim.distance), x: +s.x.toFixed(1), v: +s.speed.toFixed(1), air: !s.grounded, crashed: s.crashed, cause: s.crashCause, edge: +r.sim.course.edgeExcess(s.x, s.z).toFixed(1), sec: r.sim.course.section(s.z).kind, stats: g.frameStats ? g.frameStats() : null };
  });
  const waitDist = (d, ms) => page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.crashed || r.sim.distance >= d || window.__gs.phase !== 'run'; }, d, { timeout: ms || 240000, polling: 50 }).then(() => true, () => false);

  // ---- 1. A clumsy first run: a fresh save, the real title, real keys.
  if (cfg.parts.includes('clumsy')) {
    for (const key of ['ArrowRight', 'ArrowLeft']) {
      await page.goto(BASE + '?debug&tier=' + TIER);
      await page.evaluate(() => localStorage.clear());
      await page.goto(BASE + '?debug&tier=' + TIER);
      await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: OUT + 'first-0-title.png' });
      await page.keyboard.press('Space');
      await page.waitForFunction(() => window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 30000 });
      await page.waitForTimeout(1000);
      const log = [];
      await page.keyboard.down(key);
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(250);
        if (i % 2 === 1) await page.screenshot({ path: OUT + `first-${key}-hold-${i}.png` });
        log.push(await probe());
      }
      await page.keyboard.up(key);
      for (let i = 0; i < 16; i++) {
        await page.waitForTimeout(500);
        const p = await probe();
        log.push(p);
        if (i % 3 === 0) await page.screenshot({ path: OUT + `first-${key}-after-${i}.png` });
        if (p.phase !== 'run' || p.crashed) break;
      }
      await page.waitForTimeout(3500);
      await page.screenshot({ path: OUT + `first-${key}-end.png` });
      report.push({ part: 'clumsy', key, log: log.map(({ stats, ...o }) => o) });
    }
  }

  // ---- 2. A skilled run down every mountain: the best bundled replay, at 1x.
  if (cfg.parts.includes('mountains')) {
    for (const m of [0, 1, 2, 3]) {
      await page.goto(BASE + `?debug&tier=${TIER}&autoride=1&demo=0&m=${m}`);
      await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
      for (const at of cfg.at || [60, 300, 900, 1600, 2400, 3400]) {
        const ok = await waitDist(at);
        const st = await probe();
        if (!ok || st.crashed || st.z == null) { report.push({ part: 'mountain', m, at, skipped: true, st }); break; }
        await page.screenshot({ path: OUT + `m${m}-${String(at).padStart(4, '0')}.png` });
        report.push({ part: 'mountain', m, at, st });
      }
    }
  }

  // ---- 3. Every mood, on a different mountain each.
  if (cfg.parts.includes('moods')) {
    for (const mood of cfg.moods || [1, 2, 3, 4, 5, 6]) {
      const m = mood % 4;
      await page.goto(BASE + `?debug&tier=${TIER}&autoride=1&demo=1&m=${m}&mood=${mood}`);
      await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
      for (const at of [200, 800]) {
        const ok = await waitDist(at);
        const st = await probe();
        if (!ok || st.crashed || st.z == null) { report.push({ part: 'mood', mood, m, at, skipped: true, st }); break; }
        await page.screenshot({ path: OUT + `mood${mood}-m${m}-${at}.png` });
        report.push({ part: 'mood', mood, m, at, st });
      }
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors }, null, 0);
}
