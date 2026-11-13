// The highlight reel, shot by shot. Two ways in:
//   link: a record opened as a reel link (`?c=<record>&reel=1`): no ride needed, no ghosts in it.
//   run:  a whole run ridden first (the dev demo replays a pool run, `demo: N`), then "Watch your run"
//         from its results, with the run's own ghosts and its passes.
// A frame is shot each `every` ms while the reel plays, named by shot and second, with the reel's own
// account of where it is.
//   playwright-cli -s=pw eval "window.__reelCfg = { base: 'http://127.0.0.1:4500/game/', out: 'shots/r7/reel/link/', record: '<base64>' }"
//   playwright-cli -s=pw --raw run-code --filename=scripts/playtest/reel.js
async (page) => {
  const cfg = { m: 0, tier: 'high', every: 450, out: 'shots/reel/', record: '', demo: -1, query: '', reduced: false, max: 80, ...((await page.evaluate(() => window.__reelCfg).catch(() => null)) || {}) };
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  if (cfg.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  const t0 = Date.now();
  if (cfg.record) {
    await page.goto(`${cfg.base}?platform=mock&debug&tier=${cfg.tier}&c=${cfg.record}&reel=1${cfg.query}`);
  } else {
    await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}&demo=${Math.max(0, cfg.demo)}${cfg.query}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
    // The whole run, then its results.
    await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 300000, polling: 500 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${cfg.out}results.png` });
    const found = await page.evaluate(() => {
      const b = document.querySelector('.gs-res-reel');
      if (b) b.click();
      return !!b;
    });
    if (!found) return JSON.stringify({ error: 'no Watch Your Run button on the results', errors });
  }
  const up = await page.waitForFunction(() => window.__gs && window.__gs.phase === 'reel' && window.__gs.reel && window.__gs.reel.plan.length > 0, null, { timeout: 30000, polling: 50 }).then(() => true).catch(() => false);
  if (!up) return JSON.stringify({ error: 'the reel did not start', phase: await page.evaluate(() => window.__gs && window.__gs.phase), errors });
  const loadMs = Date.now() - t0;
  const plan = await page.evaluate(() => window.__gs.reel.plan.map((s) => ({ kind: s.kind, cam: s.cam, t0: s.t0, t1: s.t1, peak: s.peak, secs: +((s.t1 - s.t0) / 60).toFixed(2) })));
  const frames = [];
  for (let n = 0; n < cfg.max; n++) {
    const now = await page.evaluate(() => {
      const a = window.__gs;
      if (a.phase !== 'reel' || !a.reel) return null;
      const g = a.world.ghosts;
      return { ...a.reel.now, card: document.querySelector('.gs-film-line')?.textContent, cine: { ...a.world.cine }, tags: g.tagsNow ? g.tagsNow() : null };
    });
    if (!now) break;
    const file = `${cfg.out}s${now.shot}-${now.stage}-${String(n).padStart(2, '0')}.png`;
    await page.screenshot({ path: file });
    frames.push({ ...now, t: +now.t.toFixed(2), file: file.split('/').pop() });
    await page.waitForTimeout(cfg.every);
  }
  const after = await page.evaluate(() => ({ phase: window.__gs.phase, results: !!document.querySelector('.gs-res-card'), reelDom: !!document.querySelector('.gs-film') }));
  return JSON.stringify({ loadMs, plan, total: +plan.reduce((n, s) => n + s.secs, 0).toFixed(1), frames, after, errors }, null, 1);
}
