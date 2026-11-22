// workcal.js with a switch per build: a base ending "#hidefar" draws no far ghost on Low (the ones Low already draws
// without their depth pass), the most any merging of their glass into one draw could save. The lowperf lane's bound.
//   playwright-cli -s=r8-lowperf eval "window.__wcCfg = { builds: ['http://127.0.0.1:4880/', 'http://127.0.0.1:4880/#hidefar'], ms: [2], rounds: 2 }"
async (page) => {
  const cfg = { builds: [], ms: [0], rounds: 2, tier: 'low', throttle: 6, warm: 6, seconds: 30, ...((await page.evaluate(() => window.__wcCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await page.addInitScript(() => {
    // (Once a document, however many times this probe has run in the session.)
    if (window.__wc) return;
    const w = { on: false, frames: 0, raf: 0, idle: 0, idleN: 0, cal: [], t0: 0 };
    window.__wc = w;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => raf((ts) => {
      const t = performance.now();
      try {
        f(ts);
      } finally {
        if (w.on) w.raf += performance.now() - t;
      }
    });
    const ric = window.requestIdleCallback?.bind(window);
    if (ric) {
      window.requestIdleCallback = (f, o) => ric((d) => {
        const t = performance.now();
        try {
          f(d);
        } finally {
          if (w.on) {
            w.idle += performance.now() - t;
            w.idleN++;
          }
        }
      }, o);
    }
    const count = () => {
      if (w.on) w.frames++;
      raf(count);
    };
    raf(count);
    // The ruler: the same arithmetic every time, long enough to time at the clock's 0.1 ms grain.
    setInterval(() => {
      if (!w.on) return;
      const t = performance.now();
      let s = 0;
      for (let i = 0; i < 60000; i++) s += Math.sin(i * 0.001) * Math.sqrt(i);
      w.cal.push(performance.now() - t);
      w.sink = s;
    }, 250);
  });
  const one = async (build, m) => {
    const hide = build.endsWith('#hidefar');
    const base = build.replace('#hidefar', '');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.goto(base + '?platform=mock');
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.goto(`${base}?platform=mock&debug&autoride=1&m=${m}&tier=${cfg.tier}`);
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
    });
    if (hide) {
      await page.evaluate(() => {
        const g = window.__gs.world.ghosts;
        const up = g.update.bind(g);
        g.update = (...a) => {
          up(...a);
          for (const it of g.items) if (it.mesh.visible && it.depth && it.depth.visible === false) it.mesh.visible = false;
        };
      });
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
    await page.waitForTimeout(cfg.warm * 1000);
    await page.evaluate(() => {
      const w = window.__wc;
      Object.assign(w, { on: true, frames: 0, raf: 0, idle: 0, idleN: 0, cal: [], t0: performance.now() });
    });
    await page.waitForTimeout(cfg.seconds * 1000);
    const r = await page.evaluate(() => {
      const w = window.__wc;
      w.on = false;
      const cal = [...w.cal].sort((a, b) => a - b);
      return { frames: w.frames, s: (performance.now() - w.t0) / 1000, raf: w.raf, idle: w.idle, idleN: w.idleN, cal: cal[cal.length >> 1], calMean: cal.reduce((a, b) => a + b, 0) / cal.length, z: Math.round(window.__gs.run?.sim.s.z ?? -1) };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return {
      fps: +(r.frames / r.s).toFixed(1),
      rafMs: +(r.raf / r.frames).toFixed(2),
      idleMsPerS: +(r.idle / r.s).toFixed(1),
      calMs: +r.calMean.toFixed(2),
      // Work in rulers: a frame's callback, and a frame's share of the idle callbacks.
      rafCal: +(r.raf / r.frames / r.calMean).toFixed(3),
      idleCal: +(r.idle / r.frames / r.calMean).toFixed(3),
      z: r.z,
    };
  };
  const rows = [];
  for (const m of cfg.ms) {
    for (let k = 0; k < cfg.rounds; k++) {
      const order = k % 2 ? [...cfg.builds].reverse() : cfg.builds;
      for (const b of order) rows.push({ m, round: k, base: b, ...(await one(b, m)) });
    }
  }
  const sum = {};
  for (const r of rows) {
    const k = `${r.base} m${r.m}`;
    const s = (sum[k] ??= { n: 0, rafCal: 0, idleCal: 0, fps: 0 });
    s.n++;
    s.rafCal += r.rafCal;
    s.idleCal += r.idleCal;
    s.fps += r.fps;
  }
  for (const s of Object.values(sum)) {
    s.rafCal = +(s.rafCal / s.n).toFixed(3);
    s.idleCal = +(s.idleCal / s.n).toFixed(3);
    s.workCal = +(s.rafCal + s.idleCal).toFixed(3);
    s.fps = +(s.fps / s.n).toFixed(1);
  }
  return JSON.stringify({ tier: cfg.tier, throttle: cfg.throttle, seconds: cfg.seconds, rows, mean: sum }, null, 1);
}
