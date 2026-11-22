// glcount.js counted over a fixed stretch of the ride (sim z fromZ to toZ), so two builds are counted over the same
// ground whatever their load time took; otherwise as glcount.js (every call by name, a frame's average, exact).
//   playwright-cli -s=r8-lowperf eval "window.__gzCfg = { base: 'http://127.0.0.1:4880/', m: 2, fromZ: 230, toZ: 550 }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/glz.js
async (page) => {
  const cfg = { m: 0, tier: 'low', fromZ: 230, toZ: 550, query: '', ...((await page.evaluate(() => window.__gzCfg).catch(() => null)) || {}) };
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.addInitScript(() => {
    if (WebGL2RenderingContext.prototype.__gz) return;
    WebGL2RenderingContext.prototype.__gz = true;
    const counts = new Map();
    let floats = 0;
    let on = false;
    for (const C of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const P = C.prototype;
      for (const k of Object.getOwnPropertyNames(P)) {
        const d = Object.getOwnPropertyDescriptor(P, k);
        if (!d || typeof d.value !== 'function' || k === 'constructor') continue;
        const f = d.value;
        const isU = /^uniform/.test(k);
        P[k] = function (...a) {
          if (on) {
            counts.set(k, (counts.get(k) ?? 0) + 1);
            if (isU) for (const x of a) if (x && typeof x.length === 'number' && typeof x !== 'string') floats += x.length;
          }
          return f.apply(this, a);
        };
      }
    }
    window.__gz = { start: () => { counts.clear(); floats = 0; on = true; }, stop: () => { on = false; return { counts: [...counts], floats }; } };
  });
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${cfg.query}`);
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
    window.__gzf = 0;
    window.__gzz = [NaN, NaN];
    const tick = () => {
      window.__gzf++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // The window opens and closes on the frame the rider crosses its ends (checked every frame).
  await page.evaluate(({ a, b }) => new Promise((done) => {
    const w = () => {
      const z = window.__gs.run?.sim.s.z ?? Infinity;
      if (Number.isNaN(window.__gzz[0])) {
        if (z >= a) {
          window.__gzz[0] = z;
          window.__gzf0 = window.__gzf;
          window.__gz.start();
        }
      } else if (z >= b) {
        window.__gzz[1] = z;
        window.__gzr = window.__gz.stop();
        window.__gzf1 = window.__gzf;
        done();
        return;
      }
      requestAnimationFrame(w);
    };
    requestAnimationFrame(w);
  }), { a: cfg.fromZ, b: cfg.toZ });
  const r = await page.evaluate(() => ({ ...window.__gzr, frames: window.__gzf1 - window.__gzf0, z: window.__gzz.map(Math.round), programs: window.__gs.world.renderer.info.programs?.length }));
  const f = Math.max(1, r.frames);
  const total = r.counts.reduce((a, [, v]) => a + v, 0);
  const uni = r.counts.filter(([k]) => /^uniform/.test(k)).reduce((a, [, v]) => a + v, 0);
  return JSON.stringify({
    cfg: { m: cfg.m, tier: cfg.tier, query: cfg.query, base: cfg.base, fromZ: cfg.fromZ, toZ: cfg.toZ },
    z: r.z,
    frames: r.frames,
    programs: r.programs,
    callsPerFrame: +(total / f).toFixed(1),
    uniformCallsPerFrame: +(uni / f).toFixed(1),
    uniformFloatsPerFrame: +(r.floats / f).toFixed(1),
    byName: r.counts.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${(v / f).toFixed(1)} ${k}`),
  }, null, 1);
}
