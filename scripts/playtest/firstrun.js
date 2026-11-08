// A very first run seen from the rider's seat: a fresh save, the built-in pilot, a frame at set distances
// and who is near you at each. Riders reading you are presentation, so a number alone proves nothing: read
// the frames. Run against a build and a headless session:
//   playwright-cli -s=first eval "window.__firstCfg = { base: 'http://127.0.0.1:4332/', m: 0, dir: 'shots/r4/first' }"
//   playwright-cli -s=first run-code --filename=scripts/playtest/firstrun.js
async (page) => {
  const cfg = { m: 0, tier: 'high', at: [300, 900, 1800, 2700, 3600, 4300], dir: 'shots/r4/first', ...((await page.evaluate(() => window.__firstCfg).catch(() => null)) || {}) };
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(cfg.base);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
  const out = [];
  for (const z of cfg.at) {
    await page.waitForFunction((zz) => { const a = window.__gs; return !a.run || a.phase !== 'run' || a.run.sim.s.z >= zz; }, z, { timeout: 200000, polling: 50 });
    const row = await page.evaluate(() => {
      const a = window.__gs;
      if (!a.run || a.phase !== 'run') return null;
      const r = a.run.sim;
      return {
        z: Math.round(r.s.z),
        speed: +r.s.speed.toFixed(1),
        place: a.frameStandings ? `${a.frameStandings.rank}/${a.frameStandings.of}` : null,
        riders: a.ghosts.tracks.map((t) => ({ name: t.entry.name, reads: !!t.entry.reads, gap: Math.round(a.ghosts.zAt(t, r.tick) - r.s.z), rate: +(t.warp ? t.warp.rate : t.pace).toFixed(2) })),
      };
    });
    if (!row) break;
    await page.screenshot({ path: `${cfg.dir}/m${cfg.m}-z${z}.png` });
    out.push(row);
  }
  return JSON.stringify({ errors, out }, null, 0);
}
