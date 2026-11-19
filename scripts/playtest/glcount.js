// What a frame asks of WebGL, counted exactly: every call on the context by name, a frame's average over a
// window of a ride, and the floats its uniform calls send. Counts do not drift with the machine's speed the way
// frames a second do, so two builds compare call for call (run unthrottled: the counts are the same).
//   playwright-cli -s=gc eval "window.__glCfg = { base: 'http://127.0.0.1:4711/', m: 0, tier: 'low' }"
//   playwright-cli -s=gc --raw run-code --filename=scripts/playtest/glcount.js
async (page) => {
  const cfg = { m: 0, tier: 'low', warm: 8, seconds: 10, query: '', ...((await page.evaluate(() => window.__glCfg).catch(() => null)) || {}) };
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.addInitScript(() => {
    // (Once a document, however many times this probe has run in the session.)
    if (WebGL2RenderingContext.prototype.__counted) return;
    WebGL2RenderingContext.prototype.__counted = true;
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
    window.__gl = { start: () => { counts.clear(); floats = 0; on = true; }, stop: () => { on = false; return { counts: [...counts], floats }; } };
  });
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
    window.__glf = 0;
    const tick = () => {
      window.__glf++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(cfg.warm * 1000);
  const z0 = await page.evaluate(() => { window.__glf0 = window.__glf; window.__gl.start(); return Math.round(window.__gs.run.sim.s.z); });
  await page.waitForTimeout(cfg.seconds * 1000);
  const r = await page.evaluate(() => ({ ...window.__gl.stop(), frames: window.__glf - window.__glf0, z: Math.round(window.__gs.run?.sim.s.z ?? 0), info: window.__gs.world.renderer.info.programs?.length }));
  const f = Math.max(1, r.frames);
  const total = r.counts.reduce((a, [, v]) => a + v, 0);
  const uni = r.counts.filter(([k]) => /^uniform/.test(k)).reduce((a, [, v]) => a + v, 0);
  return JSON.stringify({
    cfg: { m: cfg.m, tier: cfg.tier, query: cfg.query, base: cfg.base },
    z: [z0, r.z],
    frames: r.frames,
    programs: r.info,
    callsPerFrame: +(total / f).toFixed(1),
    uniformCallsPerFrame: +(uni / f).toFixed(1),
    uniformFloatsPerFrame: +(r.floats / f).toFixed(1),
    byName: r.counts.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${(v / f).toFixed(1)} ${k}`),
  }, null, 1);
}
