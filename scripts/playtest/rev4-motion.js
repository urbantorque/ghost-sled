// Round 8, review lane m4 (Lanternfall): strips in motion at the hero vistas and set pieces, then the finish through
// the results, in one load. As speedstrips.js: a pool rider replayed as the player (?demo=N) on a virtual clock in
// exact 1/60 s steps from the line, the DOM HUD hidden, so two builds show the same ticks. Each strip is `n` frames
// `every` steps apart (`<out>m<m>-z<z>-f<k>.png`, tiled by speedstrips-tile.mjs). Past the line it keeps stepping and
// shoots `<out>m<m>-fin-<ms>.png` at each of `fin` milliseconds after the crossing (the swing, the great lantern lit,
// the results scene with its card hidden), with the frame's cost.
//   playwright-cli -s=r8-rev4 eval "window.__revCfg = { base: 'http://127.0.0.1:4874/', out: 'C:/.../motion/', tier: 'high', m: 4, zs: [450, 1540], fin: [300, 1500] }"
//   playwright-cli -s=r8-rev4 run-code --filename=scripts/playtest/rev4-motion.js
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:4874/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/review/m4/motion-default/', tier: 'high', m: 4, demo: 0, zs: [450], n: 8, every: 4, fin: [], extra: '' },
    (await page.evaluate(() => window.__revCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
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
    const gl = window.__gs.world && window.__gs.world.renderer;
    if (gl && gl.info) gl.info.autoReset = false;
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
      if (gl && gl.info) gl.info.reset();
      for (const cb of q) cb(vc.t);
    };
    const zNow = () => {
      const r = window.__gs.run;
      return r && window.__gs.phase === 'run' ? r.sim.s.z : -1;
    };
    const info = () => (gl && gl.info ? { calls: gl.info.render.calls, tris: gl.info.render.triangles } : null);
    window.__rvTo = (z, n) => {
      for (let i = 0; i < n; i++) {
        const now = zNow();
        if (now < 0 || now >= z) break;
        vc.step(1000 / 60);
      }
      const r = window.__gs.run;
      return { z: zNow(), tick: r ? r.sim.tick : -1, phase: window.__gs.phase };
    };
    window.__rvStep = (n) => {
      for (let i = 0; i < n; i++) vc.step(1000 / 60);
      const r = window.__gs.run;
      const s = r ? r.sim.s : null;
      return { z: s ? Math.round(s.z * 10) / 10 : -1, tick: r ? r.sim.tick : -1, phase: window.__gs.phase, speed: s ? Math.round(s.speed * 10) / 10 : -1, info: info() };
    };
    // Steps until the run leaves 'run' (the line or a wreck), at most n steps; then the virtual time it left.
    window.__rvOut = (n) => {
      for (let i = 0; i < n && window.__gs.phase === 'run'; i++) vc.step(1000 / 60);
      return { phase: window.__gs.phase, t: vc.t };
    };
    window.__rvNow = () => vc.t;
    // Where the great lantern stands on screen, and where it would at other metres past the line and heights (its paper's
    // middle), on the side it was walked to: for placing it in the results frame (as finishprobe.js does).
    window.__rvProbe = () => {
      const w = window.__gs.world;
      const cam = w.cam.camera;
      const V = cam.position.constructor;
      const r = window.__gs.run;
      const out = {};
      const g = w.lantern && w.lantern.greatPaper;
      if (g) { const v = new V(); g.getWorldPosition(v); out.great = [v.x, v.y, -v.z].map((x) => Math.round(x * 10) / 10); const d = v.distanceTo(cam.position); v.project(cam); out.ndc = [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(d)]; }
      if (r && g) {
        const cc = r.sim.course; const gx = new V(); g.getWorldPosition(gx);
        out.rider = Math.round(r.sim.s.z - cc.finishZ);
        out.grid = [];
        for (const dz of [0, 10, 20, 35]) for (const up of [-4, -2, 0]) {
          const z = cc.finishZ + dz; const v = new V(gx.x, gx.y + up + (cc.ground(gx.x, z) - cc.ground(gx.x, -gx.z)), -z);
          v.project(cam); out.grid.push([dz, up, Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100]);
        }
      }
      return out;
    };
  });
  const strips = [];
  for (const z of [...c.zs].sort((a, b) => a - b)) {
    let st;
    do st = await page.evaluate((zz) => window.__rvTo(zz, 300), z);
    while (st.z >= 0 && st.z < z);
    if (st.z < 0) break;
    const frames = [];
    for (let k = 0; k < c.n; k++) {
      await page.screenshot({ path: `${c.out}m${c.m}-z${String(z).padStart(4, '0')}-f${k}.png` });
      const p = await page.evaluate((e) => window.__rvStep(e), c.every);
      frames.push(p);
      if (p.phase !== 'run') break;
    }
    strips.push({ z, tick: st.tick, frames });
  }
  const fin = [];
  if (c.fin.length) {
    let out;
    do out = await page.evaluate(() => window.__rvOut(600));
    while (out.phase === 'run');
    const t0 = out.t;
    for (const ms of [...c.fin].sort((a, b) => a - b)) {
      let now = await page.evaluate(() => window.__rvNow());
      const steps = Math.max(0, Math.round((t0 + ms - now) / (1000 / 60)));
      let p = null;
      for (let left = steps; left > 0; left -= 120) p = await page.evaluate((k) => window.__rvStep(k), Math.min(120, left));
      if (!p) p = await page.evaluate(() => window.__rvStep(1));
      await page.screenshot({ path: `${c.out}m${c.m}-fin-${String(ms).padStart(5, '0')}.png` });
      const probe = await page.evaluate(() => window.__rvProbe());
      fin.push({ ms, from: out.phase, ...p, probe });
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ m: c.m, tier: c.tier, demo: c.demo, extra: c.extra, strips, fin, errors });
}
