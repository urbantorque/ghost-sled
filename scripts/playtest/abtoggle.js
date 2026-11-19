// toggles.js for any switch: a line of script that turns a thing off and one that turns it back on, run inside
// one throttled ride, `secs` seconds a state for `cycles` rounds (off-on, then on-off, so a slow stretch of course
// falls on both), counting frames and the frame callback's own time. The machine's drift hits both states alike,
// so a cost of 1 or 2% is seen where passes a build apart cannot see 5%.
//   playwright-cli -s=ab eval "window.__abCfg = { base, m: 0, toggles: [{ name: 'bake', off: 'window.__gs.world.far.idleOpen = false', on: '...' }] }"
//   playwright-cli -s=ab --raw run-code --filename=scripts/playtest/abtoggle.js
// `query` is added to the run's address (a dev switch); `prep` runs once the ride is on, before the clock.
async (page) => {
  const cfg = { m: 0, tier: 'low', throttle: 6, warm: 8, secs: 3, cycles: 6, query: '', prep: '', toggles: [], ...((await page.evaluate(() => window.__abCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  const out = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  for (const t of cfg.toggles) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
    await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${t.query ?? cfg.query}`);
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
      // Frames, and the frame callback's time (the app's own rAF callback, wrapped).
      window.__ab = { frames: 0, cb: 0 };
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (f) => raf((ts) => {
        const t0 = performance.now();
        try {
          f(ts);
        } finally {
          window.__ab.cb += performance.now() - t0;
        }
      });
      const tick = () => {
        window.__ab.frames++;
        raf(tick);
      };
      raf(tick);
    });
    if (t.prep ?? cfg.prep) await page.evaluate(t.prep ?? cfg.prep);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
    await page.waitForTimeout(cfg.warm * 1000);
    const acc = { off: { n: 0, cb: 0, s: 0 }, on: { n: 0, cb: 0, s: 0 } };
    const pairs = [];
    for (let k = 0; k < cfg.cycles; k++) {
      const got = {};
      for (const state of k % 2 ? ['on', 'off'] : ['off', 'on']) {
        await page.evaluate(state === 'off' ? t.off : t.on);
        // (A beat to settle after the switch, then count.)
        await page.waitForTimeout(400);
        const a = await page.evaluate(() => ({ ...window.__ab, t: performance.now() }));
        await page.waitForTimeout(cfg.secs * 1000);
        const b = await page.evaluate(() => ({ ...window.__ab, t: performance.now(), done: window.__gs.phase !== 'run' }));
        if (b.done) break;
        const s = (b.t - a.t) / 1000;
        acc[state].n += b.frames - a.frames;
        acc[state].cb += b.cb - a.cb;
        acc[state].s += s;
        got[state] = (b.frames - a.frames) / s;
      }
      if (got.on && got.off) pairs.push(+((got.off / got.on - 1) * 100).toFixed(1));
    }
    await page.evaluate(t.on).catch(() => {});
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const fps = (x) => +(x.n / Math.max(1e-3, x.s)).toFixed(2);
    const cb = (x) => +(x.cb / Math.max(1, x.n)).toFixed(2);
    const sorted = [...pairs].sort((a, b) => a - b);
    out.push({
      name: t.name,
      fpsOff: fps(acc.off),
      fpsOn: fps(acc.on),
      gainPct: +((fps(acc.off) / fps(acc.on) - 1) * 100).toFixed(1),
      pairsPct: pairs,
      medPairPct: sorted.length ? sorted[sorted.length >> 1] : null,
      cbMsOff: cb(acc.off),
      cbMsOn: cb(acc.on),
    });
  }
  return JSON.stringify({ m: cfg.m, tier: cfg.tier, throttle: cfg.throttle, out, errors: errors.slice(0, 5) }, null, 1);
}
