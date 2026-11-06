// A CPU profile of a forced-tier run, summed by function, to find what a throttled frame spends its time on.
// Run against an unminified build so the names mean something:
//   npx vite build --minify false --outDir shots/r3/nomin-new
//   playwright-cli -s=prof eval "window.__profileCfg = { base, m: 0, tier: 'low', throttle: 6, seconds: 25, event: 1 }"
//   playwright-cli -s=prof run-code --filename=scripts/playtest/profile.js
async (page) => {
  const cfg = { m: 0, tier: 'low', throttle: 6, seconds: 25, warm: 8, top: 45, ...((await page.evaluate(() => window.__profileCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const q = `?platform=mock&debug&fps&autoride=1&m=${cfg.m}&tier=${cfg.tier}` + (cfg.event ? `&event=${cfg.event}` : '');
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.goto(cfg.base + q);
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
  // A chase is what this run is here for: start the clock when the wave is on the rider.
  if (cfg.event) await page.waitForFunction(() => window.__gs.run?.sim.dyn.avalanche.phase === 2, null, { timeout: 90000, polling: 100 });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await page.evaluate(() => {
    window.__frames = 0;
    window.__track = [];
    let last = performance.now();
    const tick = (t) => {
      window.__frames++;
      const a = window.__gs;
      if (a.run) window.__track.push([Math.round(a.run.sim.s.z), Math.round((t - last) * 10) / 10]);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(cfg.seconds * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const frames = await page.evaluate(() => window.__frames);
  const track = await page.evaluate(() => window.__track);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const zr = await page.evaluate(() => ({ z: window.__gs.run?.sim.s.z ?? 0, stats: window.__gs.frameStats?.() }));
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const deltas = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + (deltas[i] ?? 0));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const label = (n) => {
    const f = n.callFrame;
    const file = (f.url || '').split('/').pop();
    return `${f.functionName || '(anon)'} ${file}:${f.lineNumber + 1}`;
  };
  const selfBy = new Map();
  const totalBy = new Map();
  let all = 0;
  for (const [id, us] of self) {
    const n = byId.get(id);
    const l = label(n);
    all += us;
    selfBy.set(l, (selfBy.get(l) ?? 0) + us);
    // Inclusive time, once per function per stack.
    const seen = new Set();
    for (let at = id; at !== undefined; at = parent.get(at)) {
      const k = label(byId.get(at));
      if (seen.has(k)) continue;
      seen.add(k);
      totalBy.set(k, (totalBy.get(k) ?? 0) + us);
    }
  }
  const ms = (us) => Math.round(us / 100) / 10;
  // Who each top-level loop spends its time in, per frame.
  const within = (name) => {
    const out = new Map();
    const walk = (id, inside) => {
      const n = byId.get(id);
      const l = label(n);
      const here = inside || n.callFrame.functionName === name;
      let sum = self.get(id) ?? 0;
      for (const c of n.children ?? []) sum += walk(c, here);
      if (inside && !inside.done && byId.get(parent.get(id))?.callFrame.functionName === name) out.set(l, (out.get(l) ?? 0) + sum);
      return sum;
    };
    walk(profile.nodes[0].id, false);
    return [...out].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${(v / 1000 / frames).toFixed(2)} ms/frame ${k}`);
  };
  // Frame time by 100 m of course, to find whether a place is heavy or the whole run is.
  const zones = new Map();
  for (const [z, dt] of track) {
    const k = Math.floor(z / 100) * 100;
    const b = zones.get(k) ?? { n: 0, dt: 0, max: 0 };
    b.n++; b.dt += dt; b.max = Math.max(b.max, dt);
    zones.set(k, b);
  }
  const byZ = [...zones].sort((a, b) => a[0] - b[0]).map(([z, b]) => `${z}: ${(b.dt / b.n).toFixed(1)} max ${b.max.toFixed(0)}`);
  const rank = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, cfg.top).map(([k, v]) => `${ms(v)} ms ${(100 * v / all).toFixed(1)}% ${k}`);
  return JSON.stringify({ end: zr, frames, wallMs: ms(all), self: rank(selfBy), total: rank(totalBy), inFrame: within('frame'), inRun: within('frameRun'), byZ }, null, 1);
}
