// What a throttled frame spends outside the scene: DOM writes by element, and the frame callback against the
// frame interval. Run it twice to compare two states of the same build, for example noread true and false.
//   playwright-cli -s=pw eval "window.__pageCfg = { base: 'http://127.0.0.1:4332/', m: 3, noread: false }"
//   playwright-cli -s=pw run-code --filename=scripts/playtest/pagework.js
async (page) => {
  const cfg = { m: 3, tier: 'low', throttle: 6, warm: 6, seconds: 25, noread: false, ...((await page.evaluate(() => window.__pageCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.goto(`${cfg.base}?platform=mock&debug&fps&autoride=1&m=${cfg.m}&tier=${cfg.tier}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 30000 });
  await page.evaluate((noread) => {
    const app = window.__gs;
    if (noread) { const g = app.ghosts; for (const t of g.tracks) t.entry.reads = false; g.readers = 0; }
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
  }, cfg.noread);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
  await page.waitForTimeout(cfg.warm * 1000);
  await page.evaluate(() => {
    const tally = new Map();
    const name = (n) => {
      const e = n.nodeType === 1 ? n : n.parentElement;
      return e ? (typeof e.className === 'string' && e.className ? e.className.split(' ')[0] : e.tagName) : '?';
    };
    const seen = new MutationObserver((list) => {
      for (const m of list) {
        const k = `${m.type === 'attributes' ? m.attributeName : m.type}:${name(m.target)}`;
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
    });
    seen.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    let frames = 0;
    let busy = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => raf((t) => { const a = performance.now(); f(t); busy += performance.now() - a; });
    const count = () => { frames++; raf(count); };
    raf(count);
    window.__page = { tally, read: () => ({ frames, busy }) };
  });
  await page.waitForTimeout(cfg.seconds * 1000);
  const out = await page.evaluate((secs) => {
    const p = window.__page;
    const { frames, busy } = p.read();
    const rows = [...p.tally].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${(v / secs).toFixed(0).padStart(5)}/s ${k}`);
    return { fps: +(frames / secs).toFixed(1), busyMsPerFrame: +(busy / Math.max(1, frames)).toFixed(1), z: Math.round(window.__gs.run?.sim.s.z ?? 0), rows, tags: document.querySelectorAll('[class*="tag"]').length };
  }, cfg.seconds);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return JSON.stringify(out);
}
