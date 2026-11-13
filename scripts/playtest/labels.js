// The riders' labels at fixed moments of one deterministic ride, to set a build's labels beside another's
// (the DOM pills of round 6 against the canvas ones of round 7). The sled steers the safe line, the run is
// held at each tick named, and the frame is shot.
//   playwright-cli -s=pw eval "window.__labelsCfg = { base: 'http://127.0.0.1:4500/', out: 'shots/r7/reel/labels/after-high/', tier: 'high', m: 0 }"
//   playwright-cli -s=pw --raw run-code --filename=scripts/playtest/labels.js
async (page) => {
  const cfg = { m: 0, tier: 'high', ticks: [150, 300, 540, 900, 1500, 2400, 3300], query: '&riders=0', out: 'shots/labels/', ...((await page.evaluate(() => window.__labelsCfg).catch(() => null)) || {}) };
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${cfg.query}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
  await page.evaluate(() => {
    const app = window.__gs;
    const sim = app.run.sim;
    const c = sim.course;
    app.run.input = {
      sample: () => {
        const s = sim.s;
        if (!s.grounded) return { steer: 4, action: false };
        const look = s.z + 4 + s.speed * 0.35;
        const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.08;
        return { steer: Math.max(0, Math.min(8, Math.round(4 + err * 14))), action: false };
      },
    };
  });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const shots = [];
  for (const tick of cfg.ticks) {
    const ok = await page.waitForFunction((t) => !window.__gs.run || window.__gs.run.sim.tick >= t || window.__gs.phase !== 'run', tick, { timeout: 120000, polling: 'raf' }).then(() => true).catch(() => false);
    if (!ok) break;
    const live = await page.evaluate(() => {
      const app = window.__gs;
      if (!app.run || app.phase !== 'run') return null;
      app.run.paused = true;
      return { tick: app.run.sim.tick, z: Math.round(app.run.sim.s.z) };
    });
    if (!live) break;
    // Two frames on, so the held tick is the one drawn.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(0)))));
    const tags = await page.evaluate(() => {
      const g = window.__gs.world.ghosts;
      if (g.tagsNow) return { ...g.tagsNow(), quads: g.batch.drawn, rasters: g.batch.rasters, uploads: g.batch.uploads, dom: document.querySelectorAll('.ghost-label').length };
      const out = { dom: document.querySelectorAll('.ghost-label').length };
      for (const el of document.querySelectorAll('.ghost-layer .ghost-label')) if (el.style.opacity === '1') out.shown = (out.shown || 0) + 1;
      return out;
    });
    const file = `${cfg.out}m${cfg.m}-${cfg.tier}-t${String(tick).padStart(4, '0')}.png`;
    await page.screenshot({ path: file });
    shots.push({ ...live, file, tags });
    await page.evaluate(() => { window.__gs.run.paused = false; });
  }
  return JSON.stringify({ shots, errors }, null, 1);
}
