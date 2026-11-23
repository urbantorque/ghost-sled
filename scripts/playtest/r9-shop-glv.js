// Round 9, the shop lane: round 8's held-run GL count (lowperf/glv.js) with a garage look put on before the count
// (window.__gvCfg.look: { scarf, hat, finish, tiers, ornament, trail }), so a stock rider and a dressed one are counted
// over the same frames. With no look the rider wears what a fresh save wears.
//   playwright-cli -s=r9-shop eval "window.__gvCfg = { base: 'http://127.0.0.1:4960/', look: { scarf: 'double' } }"
//   playwright-cli -s=r9-shop --raw run-code --filename=scripts/playtest/r9-shop-glv.js
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
  await to(Math.max(0, c.fromZ - 60));
  if (c.look) {
    await page.evaluate(async (look) => {
      const G = await import('/src/game/garage.ts');
      const P = await import('/src/game/paints.ts');
      const w = window.__gs.world;
      const r = w.rider;
      if (look.hat) r.setHat(look.hat);
      if (look.scarf) r.setScarf(G.scarfById(look.scarf));
      if (look.finish) r.setFinish(P.paintById(look.finish));
      if (look.tiers !== undefined) r.setTracks({ 0: look.tiers }, look.ornament ?? 'lamp');
      if (look.trail) w.setTrail(G.trailById(look.trail));
    }, c.look);
  }
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
    cfg: { m: c.m, tier: c.tier, demo: c.demo, base: c.base, fromZ: c.fromZ, toZ: c.toZ, look: c.look ?? null },
    z: [Math.round(z0), Math.round(z1)],
    frames: f,
    programs: r.programs,
    callsPerFrame: +(total / f).toFixed(1),
    uniformCallsPerFrame: +(uni / f).toFixed(1),
    uniformFloatsPerFrame: +(r.floats / f).toFixed(1),
    byName: r.counts.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${(v / f).toFixed(1)} ${k}`),
  }, null, 1);
}
