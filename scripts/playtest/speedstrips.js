// Round 8 (speed): strips that hold the run still, for blind pairs in motion. Speed is felt in motion, so a pair is
// a strip of frames at speed, not one frame: a pool rider replayed as the player (?demo=N, its own inputs, dashes and
// wards) on a virtual clock in exact 1/60 s steps from the start line, as stills.js does, and from each strip's metre
// `n` frames every `every` steps. Two builds with the same sim and pools show the same ticks; ghosts and tags replay in
// a worker on real time and may differ a little, and so may effects that roll Math.random. The HUD's DOM is hidden.
// Each strip's frames are `<out>m<m>-z<z>-f<k>.png`; scripts/playtest/speedstrips-tile.mjs tiles them.
//   playwright-cli -s=r8-speed eval "window.__stripsCfg = { base: 'http://127.0.0.1:4750/', out: 'C:/.../after/', tier: 'high', m: 0, demo: 0, zs: [300, 1400] }"
//   playwright-cli -s=r8-speed run-code --filename=scripts/playtest/speedstrips.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4750/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/speed/strips-default/', tier: 'high', m: 0, demo: 0, zs: [300], n: 8, every: 4, extra: '', scan: 0 },
    (await page.evaluate(() => window.__stripsCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  if (c.width && c.height) await page.setViewportSize({ width: c.width, height: c.height });
  // A fresh save every load (a save left by the last load lays a different field).
  await page.goto(c.base);
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&demo=${c.demo}${c.extra}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
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
    window.__spTo = (z, n) => {
      for (let i = 0; i < n; i++) {
        const now = zNow();
        if (now < 0 || now >= z) break;
        vc.step(1000 / 60);
      }
      const r = window.__gs.run;
      return { z: zNow(), tick: r ? r.sim.tick : -1 };
    };
    // Frame cost, summed over every pass of the last frame stepped (as frames.js counts it).
    const gl = window.__gs.world && window.__gs.world.renderer;
    if (gl && gl.info) gl.info.autoReset = false;
    window.__spStep = (n) => {
      for (let i = 0; i < n; i++) {
        if (i === n - 1 && gl && gl.info) gl.info.reset();
        vc.step(1000 / 60);
      }
      const info = gl && gl.info ? { calls: gl.info.render.calls, tris: gl.info.render.triangles } : null;
      const r = window.__gs.run;
      const s = r && window.__gs.phase === 'run' ? r.sim.s : null;
      return { z: zNow(), tick: r ? r.sim.tick : -1, speed: s ? Math.round(s.speed * 10) / 10 : -1, flow: s ? Math.round(s.flow * 100) / 100 : -1, level: s ? s.flowLevel : -1, dash: s ? s.dash > 0 : false, fov: Math.round(window.__gs.world.cam.camera.fov * 10) / 10, info };
    };
  });
  // cfg.scan: no frames, only the ride as the replay plays it in the page (speed, flow, level, dash every scan
  // metres to the line), to pick the strips' metres from (a replay in node can differ: the page's demo decides nothing).
  if (c.scan) {
    const rows = [];
    for (let z = c.scan; ; z += c.scan) {
      let st;
      do st = await page.evaluate((zz) => window.__spTo(zz, 600), z);
      while (st.z >= 0 && st.z < z);
      if (st.z < 0) break;
      const p = await page.evaluate(() => window.__spStep(1));
      rows.push([Math.round(p.z), p.speed, p.level, p.dash ? 1 : 0]);
    }
    await page.goto('about:blank');
    return JSON.stringify({ m: c.m, demo: c.demo, rows, errors });
  }
  const strips = [];
  for (const z of [...c.zs].sort((a, b) => a - b)) {
    let st;
    do st = await page.evaluate((zz) => window.__spTo(zz, 300), z);
    while (st.z >= 0 && st.z < z);
    if (st.z < 0) break;
    const frames = [];
    for (let k = 0; k < c.n; k++) {
      await page.screenshot({ path: `${c.out}m${c.m}-z${String(z).padStart(4, '0')}-f${k}.png` });
      const p = await page.evaluate((e) => window.__spStep(e), c.every);
      frames.push(p);
      if (p.z < 0) break;
    }
    strips.push({ z, tick: st.tick, frames });
  }
  await page.goto('about:blank');
  return JSON.stringify({ m: c.m, tier: c.tier, demo: c.demo, strips, errors });
}
