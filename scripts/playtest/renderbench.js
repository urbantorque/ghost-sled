// What the renderer's draw of one Low frame costs on the main thread, with nothing else moving: the ride stops at a
// distance (the game's frame callbacks held), and the same frame is drawn `n` times, each draw's script timed and the
// GPU process brought level after it (getError) so no queue builds up and the GPU's own time is not counted. The
// scene, the lens and the far shadows' tiles are the same on every pass, so two builds compare draw for draw, and
// short passes interleaved (A B B A) see little of the machine's drift.
//   playwright-cli -s=rb eval "window.__rbCfg = { builds: ['http://127.0.0.1:4710/', 'http://127.0.0.1:4714/'], m: 0, z: 900, rounds: 4 }"
//   playwright-cli -s=rb --raw run-code --filename=scripts/playtest/renderbench.js
async (page) => {
  const cfg = { builds: [], m: 0, z: 900, tier: 'low', n: 800, rounds: 4, throttle: 1, ...((await page.evaluate(() => window.__rbCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  const one = async (base) => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
    await page.goto(`${base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
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
      // The hold: once the ride reaches the distance, the game's frame callbacks wait.
      const raf0 = window.requestAnimationFrame.bind(window);
      window.__rb = { held: false, at: Infinity };
      window.requestAnimationFrame = (cb) => raf0((t) => {
        if (window.__rb.held || (window.__gs.run && window.__gs.run.sim.s.z >= window.__rb.at)) {
          window.__rb.held = true;
          window.__rb.cb = cb;
          return;
        }
        cb(t);
      });
    });
    await page.evaluate((z) => { window.__rb.at = z; }, cfg.z);
    await page.waitForFunction(() => window.__rb.held, null, { timeout: 120000, polling: 100 });
    // (Idle work finishes: the far shadows' tiles, the poster's program.)
    await page.waitForTimeout(2500);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
    const r = await page.evaluate((n) => {
      const w = window.__gs.world;
      const gl = w.renderer.getContext();
      const times = [];
      const info = { calls: 0 };
      for (let i = 0; i < n + 20; i++) {
        const t0 = performance.now();
        w.post.render(w.scene, w.cam.camera);
        const t1 = performance.now();
        gl.getError();
        if (i >= 20) times.push(t1 - t0);
      }
      info.calls = w.renderer.info.render.calls;
      times.sort((a, b) => a - b);
      return { med: times[times.length >> 1], p25: times[times.length >> 2], mean: times.reduce((a, b) => a + b, 0) / times.length, z: Math.round(window.__gs.run.sim.s.z), calls: info.calls };
    }, cfg.n);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return r;
  };
  const rows = [];
  for (let k = 0; k < cfg.rounds; k++) {
    const order = k % 2 ? [...cfg.builds].reverse() : cfg.builds;
    for (const b of order) rows.push({ round: k, base: b, ...(await one(b)) });
  }
  const by = {};
  for (const r of rows) (by[r.base] ??= []).push(r);
  const summary = Object.fromEntries(Object.entries(by).map(([b, rs]) => {
    // (performance.now is coarsened to 0.1 ms here: the mean over hundreds of draws, not the median, sees a 2% step.)
    const m = rs.map((r) => r.mean).sort((a, c) => a - c);
    return [b, { medOfMeans: +m[m.length >> 1].toFixed(4), means: rs.map((r) => +r.mean.toFixed(4)), z: rs.map((r) => r.z), lastPassCalls: rs[0].calls }];
  }));
  return JSON.stringify({ m: cfg.m, z: cfg.z, tier: cfg.tier, n: cfg.n, throttle: cfg.throttle, summary }, null, 1);
}
