// What each world system's per-frame call costs on a throttled run, timed exactly (performance.now round each
// call, not sampled): ms per frame by system, plus the renderer's draw and the frame callback as a whole. Works on
// any build (a system a build lacks is skipped), so two builds compare system by system.
//   playwright-cli -s=st eval "window.__stCfg = { base, m: 3, tier: 'low', throttle: 6, warm: 8, seconds: 30 }"
//   playwright-cli -s=st run-code --filename=scripts/playtest/systime.js
async (page) => {
  const cfg = { m: 3, tier: 'low', throttle: 6, warm: 8, seconds: 30, ...((await page.evaluate(() => window.__stCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.goto(cfg.base + '?platform=mock');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
  await page.evaluate(() => {
    const app = window.__gs;
    const w = app.world;
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
    const acc = new Map();
    const wrap = (label, o, k) => {
      if (!o || typeof o[k] !== 'function') return;
      const f = o[k];
      o[k] = function (...a) {
        const t0 = performance.now();
        try {
          return f.apply(this, a);
        } finally {
          acc.set(label, (acc.get(label) ?? 0) + performance.now() - t0);
        }
      };
    };
    const names = ['terrain', 'midground', 'far', 'props', 'setPieces', 'overlooks', 'spirit', 'marquee', 'lantern', 'rails', 'sky', 'rider', 'particles', 'weather', 'trail', 'ghosts', 'chaos', 'landing', 'life', 'speedPosts', 'sloughs', 'moments', 'lakeMirror', 'cam', 'treeLife', 'verbs', 'legends', 'climax', 'stages', 'breaks', 'poster'];
    for (const n of names) wrap(n, w[n], 'update');
    wrap('journey', w, 'journey');
    wrap('updateChunks', w, 'updateChunks');
    wrap('labels', w.ghosts, 'drawLabels');
    wrap('post.render', w.post, 'render');
    wrap('renderer.render', w.renderer, 'render');
    wrap('world.frame', w, 'frame');
    wrap('app.frameRun', app, 'frameRun');
    wrap('hud', app.ui, 'updateHud');
    wrap('advance', app.loop ?? app.run, 'advance');
    let frames = 0;
    let cb = 0;
    const raf = window.requestAnimationFrame.bind(window);
    const tick = () => {
      frames++;
      raf(tick);
    };
    raf(tick);
    window.__st = { acc, read: () => ({ frames, acc: [...acc] }), reset: () => { acc.clear(); frames = 0; } };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
  await page.waitForTimeout(cfg.warm * 1000);
  await page.evaluate(() => window.__st.reset());
  const z0 = await page.evaluate(() => Math.round(window.__gs.run.sim.s.z));
  await page.waitForTimeout(cfg.seconds * 1000);
  const r = await page.evaluate(() => window.__st.read());
  const z1 = await page.evaluate(() => Math.round(window.__gs.run?.sim.s.z ?? 0));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const rows = r.acc.sort((a, b) => b[1] - a[1]).map(([k, ms]) => `${(ms / r.frames).toFixed(2).padStart(6)} ${k}`);
  return JSON.stringify({ fps: +(r.frames / cfg.seconds).toFixed(1), z0, z1, rows });
}
