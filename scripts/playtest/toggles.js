// What a system costs on a throttled run, measured inside one run so the machine's drift hits both states alike:
// for each toggle, a fresh run on the safe line, then `cycles` rounds of `secs` seconds with the system off (its
// per-frame update stubbed and its root hidden) and `secs` with it on, counting frames in each. Reports frames a
// second off and on, and the share the system costs.
//   playwright-cli -s=tg eval "window.__tgCfg = { base, m: 3, tier: 'low', throttle: 6, toggles: ['props', 'setPieces'] }"
//   playwright-cli -s=tg run-code --filename=scripts/playtest/toggles.js
async (page) => {
  const cfg = { m: 3, tier: 'low', throttle: 6, warm: 8, secs: 3, cycles: 6, toggles: [], ...((await page.evaluate(() => window.__tgCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  const out = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  for (const name of cfg.toggles) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.goto(cfg.base + '?platform=mock');
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
    const ok = await page.evaluate((name) => {
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
      // A toggle: the objects whose update is stubbed (and whose root, if any, is hidden) while it is off.
      const pick = {
        journey: [[w, 'journey']],
        labels: [[w.ghosts, 'drawLabels']],
        ghosts: [[w.ghosts, 'update'], [w.ghosts, 'drawLabels']],
        chase: [[w.cam, 'update']],
      };
      const targets = pick[name] ?? [[w[name], 'update']];
      if (!targets.every(([o]) => o)) return false;
      const saved = targets.map(([o, k]) => [o, k, o[k]]);
      const roots = targets.map(([o]) => o.root ?? o.group ?? o.mesh ?? null).filter((r) => r && r.isObject3D && r !== w.scene);
      window.__tg = {
        off: () => {
          for (const [o, k] of saved) o[k] = () => {};
          for (const r of roots) r.visible = false;
        },
        on: () => {
          for (const [o, k, f] of saved) o[k] = f;
          for (const r of roots) r.visible = true;
        },
      };
      window.__frames = 0;
      const tick = () => {
        window.__frames++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return true;
    }, name);
    if (!ok) {
      out.push({ name, error: 'no such system' });
      continue;
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
    await page.waitForTimeout(cfg.warm * 1000);
    let off = 0;
    let on = 0;
    for (let k = 0; k < cfg.cycles; k++) {
      for (const state of k % 2 ? ['on', 'off'] : ['off', 'on']) {
        await page.evaluate((s) => window.__tg[s](), state);
        // (A beat to settle after the switch, then count.)
        await page.waitForTimeout(400);
        const f0 = await page.evaluate(() => window.__frames);
        await page.waitForTimeout(cfg.secs * 1000);
        const n = (await page.evaluate(() => window.__frames)) - f0;
        if (state === 'off') off += n;
        else on += n;
      }
    }
    await page.evaluate(() => window.__tg.on());
    const z = await page.evaluate(() => Math.round(window.__gs.run?.sim.s.z ?? 0));
    const secs = cfg.cycles * cfg.secs;
    out.push({ name, fpsOff: +(off / secs).toFixed(1), fpsOn: +(on / secs).toFixed(1), cost: +((1 - on / Math.max(1, off)) * 100).toFixed(1) + '%', z });
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return JSON.stringify({ out, errors });
}
