// What a Low frame asks of WebGL, counted call by call over a stretch of a held run (stills.js's virtual clock: a pool
// rider replayed as the player on exact 1/60 s steps from a fresh save), so two builds with the same sim and pools
// draw the same frames: the same ghosts in view, the same tick. glcount.js rides a live pilot, where the field's
// pacing follows the frame times and one ghost more or less in view moved a count by 30.
//   playwright-cli -s=r8-lowperf eval "window.__gvCfg = { base: 'http://127.0.0.1:4880/', m: 2, fromZ: 230, toZ: 1230 }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/glv.js
async (page) => {
  const c = { m: 0, tier: 'low', demo: 0, fromZ: 230, toZ: 1230, extra: '', ...((await page.evaluate(() => window.__gvCfg).catch(() => null)) || {}) };
  await page.addInitScript(() => {
    if (WebGL2RenderingContext.prototype.__gv) return;
    WebGL2RenderingContext.prototype.__gv = true;
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
    window.__gv = { start: () => { counts.clear(); floats = 0; on = true; }, stop: () => { on = false; return { counts: [...counts], floats }; } };
  });
  // (A phone's frame: width and height in CSS px.)
  if (c.width && c.height) await page.setViewportSize({ width: c.width, height: c.height });
  await page.goto(c.base);
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&demo=${c.demo}${c.extra}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  await page.evaluate(() => {
    const vc = { t: performance.now(), q: [], timers: [], id: 1 };
    performance.now = () => vc.t;
    window.requestAnimationFrame = (cb) => {
      vc.q.push(cb);
      return vc.id++;
    };
    window.cancelAnimationFrame = () => {};
    window.setTimeout = (fn, ms, ...a) => {
      const id = vc.id++;
      vc.timers.push({ id, at: vc.t + (Number(ms) || 0), fn: typeof fn === 'function' ? () => fn(...a) : () => {} });
      return id;
    };
    window.clearTimeout = (id) => {
      vc.timers = vc.timers.filter((x) => x.id !== id);
    };
    vc.step = (dt) => {
      vc.t += dt;
      const due = vc.timers.filter((x) => x.at <= vc.t);
      if (due.length) vc.timers = vc.timers.filter((x) => x.at > vc.t);
      for (const x of due) {
        try {
          x.fn();
        } catch (e) {
          console.error(e);
        }
      }
      const q = vc.q;
      vc.q = [];
      for (const cb of q) cb(vc.t);
    };
    const zNow = () => {
      const r = window.__gs.run;
      return r && window.__gs.phase === 'run' ? r.sim.s.z : -1;
    };
    window.__gvF = 0;
    window.__gvTo = (z, n) => {
      for (let i = 0; i < n; i++) {
        const now = zNow();
        if (now < 0 || now >= z) break;
        vc.step(1000 / 60);
        window.__gvF++;
      }
      return zNow();
    };
  });
  const to = async (z) => {
    let at;
    do at = await page.evaluate((zz) => window.__gvTo(zz, 300), z);
    while (at >= 0 && at < z);
    return at;
  };
  // (Idle work, the far bake and the set pieces, waits for idle time: under the virtual clock it comes when the page
  // gives it, between the driver's calls, as it would between frames.)
  const z0 = await to(c.fromZ);
  const f0 = await page.evaluate(() => {
    window.__gv.start();
    return window.__gvF;
  });
  const z1 = await to(c.toZ);
  const r = await page.evaluate(() => ({ ...window.__gv.stop(), f: window.__gvF, programs: window.__gs.world.renderer.info.programs?.length }));
  const f = Math.max(1, r.f - f0);
  const total = r.counts.reduce((a, [, v]) => a + v, 0);
  const uni = r.counts.filter(([k]) => /^uniform/.test(k)).reduce((a, [, v]) => a + v, 0);
  await page.goto('about:blank');
  if (c.width && c.height) await page.setViewportSize({ width: 1280, height: 720 });
  return JSON.stringify({
    cfg: { m: c.m, tier: c.tier, demo: c.demo, base: c.base, fromZ: c.fromZ, toZ: c.toZ },
    z: [Math.round(z0), Math.round(z1)],
    frames: f,
    programs: r.programs,
    callsPerFrame: +(total / f).toFixed(1),
    uniformCallsPerFrame: +(uni / f).toFixed(1),
    uniformFloatsPerFrame: +(r.floats / f).toFixed(1),
    byName: r.counts.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${(v / f).toFixed(1)} ${k}`),
  }, null, 1);
}
