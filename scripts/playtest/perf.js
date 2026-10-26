// Frame-time probes for the README's performance table. Each probe loads a run on a forced tier with
// an optional CPU throttle, mood and event, rides the safe line with an in-page pilot (the fairness
// test's driver, once per sim tick, so the run survives), and samples frame stats after a warm-up.
// Draw calls and triangles are read from the renderer once the run has settled.
// Run against a preview build: playwright-cli -s=gs run-code --filename=scripts/playtest/perf.js
// Set window.__perfCfg = { base, probes: [...] } on the current page first to change the plan.
async (page) => {
  const defaults = {
    probes: [
      { name: 'high-plain', tier: 'high', throttle: 1, seconds: 40 },
      { name: 'high-lantern', tier: 'high', throttle: 1, mood: 2, seconds: 30 },
      { name: 'high-glassice', tier: 'high', throttle: 1, mood: 3, seconds: 30 },
      { name: 'high-avalanche-4x', tier: 'high', throttle: 4, event: 1, seconds: 60, chaseOnly: true },
      { name: 'low-6x-a', tier: 'low', throttle: 6, seconds: 40 },
      { name: 'low-6x-b', tier: 'low', throttle: 6, seconds: 40 },
      { name: 'low-6x-c', tier: 'low', throttle: 6, seconds: 40 },
    ],
  };
  const cfg = { ...defaults, ...((await page.evaluate(() => window.__perfCfg).catch(() => null)) || {}) };
  const BASE = cfg.base || 'http://127.0.0.1:4173/';
  const cdp = await page.context().newCDPSession(page);
  const out = [];
  for (const p of cfg.probes) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const q = `?platform=mock&debug&fps&autoride=1&m=${p.m ?? 0}&tier=${p.tier}` + (p.mood ? `&mood=${p.mood}` : '') + (p.event ? `&event=${p.event}` : '');
    await page.goto(BASE + q);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
    await page.evaluate(() => {
      const app = window.__gs;
      // Draw calls and triangles summed over every render pass of a frame (renderer.info resets per
      // render call, so reading it once sees only the last pass).
      const r = app.world.renderer;
      const render = r.render.bind(r);
      let acc = { calls: 0, tris: 0 };
      window.__frameInfo = { calls: 0, tris: 0 };
      r.render = (scene, cam) => {
        render(scene, cam);
        acc.calls += r.info.render.calls;
        acc.tris += r.info.render.triangles;
      };
      const tick = () => {
        if (acc.calls > 0) window.__frameInfo = acc;
        acc = { calls: 0, tris: 0 };
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
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
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.throttle });
    // Warm-up: shaders, chunk builds and the tier controller settle.
    await page.waitForTimeout(5000);
    const samples = [];
    const t0 = Date.now();
    let info = null;
    while (Date.now() - t0 < p.seconds * 1000) {
      const d = await page.evaluate(() => {
        const a = window.__gs;
        if (!a.run || a.phase !== 'run') return { done: true };
        const av = a.run.sim.dyn.avalanche;
        const f = [...a.frameTimes];
        const over = f.filter((v) => v > 21).length / Math.max(1, f.length);
        const r = window.__frameInfo;
        return { stats: a.frameStats(), over, chase: av.phase === 2, calls: r.calls, tris: r.tris };
      });
      if (d.done) break;
      if (!info && Date.now() - t0 > 3000) info = { calls: d.calls, tris: d.tris };
      if (!p.chaseOnly || d.chase) samples.push(d);
      await page.waitForTimeout(1000);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const fps = samples.map((s) => s.stats.fps).sort((a, b) => a - b);
    const p90 = samples.map((s) => s.stats.p90).sort((a, b) => a - b);
    const over = samples.map((s) => s.over).sort((a, b) => a - b);
    out.push({
      name: p.name,
      n: samples.length,
      fpsMin: fps[0] ?? null,
      fpsMed: fps[fps.length >> 1] ?? null,
      p90Med: p90.length ? +p90[p90.length >> 1].toFixed(1) : null,
      p90Max: p90.length ? +p90[p90.length - 1].toFixed(1) : null,
      over21Med: over.length ? +(over[over.length >> 1] * 100).toFixed(1) : null,
      tier: samples.length ? samples[samples.length - 1].stats.tier : null,
      calls: info?.calls ?? null,
      tris: info?.tris ?? null,
    });
  }
  return JSON.stringify(out);
}
