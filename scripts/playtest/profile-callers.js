// Who calls what, on a throttled run: a CPU profile like profile.js's, reported as the heaviest call chains (six
// frames up) through each function named in `fns`, in ms per frame. Run it on an unminified build.
//   playwright-cli -s=prof eval "window.__callersCfg = { base, m: 3, tier: 'low', throttle: 6, seconds: 25, fns: ['bareGround'] }"
//   playwright-cli -s=prof run-code --filename=scripts/playtest/profile-callers.js
async (page) => {
  const cfg = { m: 3, tier: 'low', throttle: 6, seconds: 25, warm: 8, depth: 6, top: 12, fns: [], ...((await page.evaluate(() => window.__callersCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}`);
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
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
  await page.waitForTimeout(cfg.warm * 1000);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await page.evaluate(() => {
    window.__frames = 0;
    const tick = () => {
      window.__frames++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(cfg.seconds * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const frames = await page.evaluate(() => window.__frames);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map();
  for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (profile.timeDeltas[i] ?? 0));
  const name = (id) => {
    const f = byId.get(id).callFrame;
    return `${f.functionName || '(anon)'}:${f.lineNumber + 1}`;
  };
  const out = {};
  for (const fn of cfg.fns) {
    const chains = new Map();
    for (const [id, us] of self) {
      // The nearest frame on the stack that is fn, then the chain above it.
      let at = id;
      while (at !== undefined && byId.get(at).callFrame.functionName !== fn) at = parent.get(at);
      if (at === undefined) continue;
      const chain = [];
      for (let up = at, k = 0; up !== undefined && k < cfg.depth; up = parent.get(up), k++) chain.push(name(up));
      const key = chain.join(' < ');
      chains.set(key, (chains.get(key) ?? 0) + us);
    }
    out[fn] = [...chains].sort((a, b) => b[1] - a[1]).slice(0, cfg.top).map(([k, us]) => `${(us / 1000 / frames).toFixed(3)} ms/frame ${k}`);
  }
  return JSON.stringify({ frames, out }, null, 1);
}
