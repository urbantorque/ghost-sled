// What a throttled frame spends on the page itself: a trace of the renderer's main thread, summed by
// event (the frame's lifecycle: style, layout, pre-paint, paint, layerize, commit), with the DOM writes a
// frame beside it. The numbers to report on a shared machine are these, per frame, not frames a second.
// pagework.js counts the writes by element; this one says what they cost.
//   playwright-cli -s=pw eval "window.__lifeCfg = { base: 'http://127.0.0.1:4500/', m: 0, tier: 'low' }"
//   playwright-cli -s=pw --raw run-code --filename=scripts/playtest/lifecycle.js
// The sled steers the safe line (pagework.js's pilot). No `fps` switch: its counter is a write a frame.
// `prep` is a line of script run in the page once the run is on, to compare two states of one build:
//   prep: "window.__gs.ui.hud.update = () => {}"   (the HUD stands still: what its writes cost)
//   prep: "document.querySelector('.gs-hud').style.display = 'none'"   (no HUD: the page's floor)
async (page) => {
  const cfg = { m: 0, tier: 'low', throttle: 6, warm: 6, seconds: 20, query: '', prep: '', ...((await page.evaluate(() => window.__lifeCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // A very first run: nothing saved.
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
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
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
  await page.waitForTimeout((cfg.warm - 2) * 1000);
  if (cfg.prep) await page.evaluate(cfg.prep);
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const tally = new Map();
    let writes = 0;
    const name = (n) => {
      const e = n.nodeType === 1 ? n : n.parentElement;
      return e ? (typeof e.className === 'string' && e.className ? e.className.split(' ')[0] : e.tagName) : '?';
    };
    const seen = new MutationObserver((list) => {
      for (const m of list) {
        writes++;
        const k = `${m.type === 'attributes' ? m.attributeName : m.type}:${name(m.target)}`;
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
    });
    seen.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    let frames = 0;
    let wrote = 0;
    let last = 0;
    const count = () => {
      frames++;
      // (Records are delivered after the frame's callbacks: a frame whose count moved had a write in it.)
      const pending = seen.takeRecords();
      for (const m of pending) {
        writes++;
        const k = `${m.type === 'attributes' ? m.attributeName : m.type}:${name(m.target)}`;
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
      if (writes !== last) wrote++;
      last = writes;
      requestAnimationFrame(count);
    };
    requestAnimationFrame(count);
    window.__life = { tally, read: () => ({ frames, writes, wrote }) };
  });
  const browser = page.context().browser();
  await browser.startTracing(page, { categories: ['devtools.timeline', 'blink', 'cc', 'disabled-by-default-devtools.timeline'] });
  await page.waitForTimeout(cfg.seconds * 1000);
  const buf = await browser.stopTracing();
  const page2 = await page.evaluate(() => {
    const p = window.__life;
    const r = p.read();
    const rows = [...p.tally].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${(v / r.frames).toFixed(2)}/frame ${k}`);
    const gs = window.__gs;
    return { ...r, rows, z: Math.round(gs.run?.sim.s.z ?? 0), tags: document.querySelectorAll('.ghost-label').length };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const events = JSON.parse(buf.toString('utf8')).traceEvents || [];
  // The renderer's main thread is the one that fires animation frames.
  const threads = new Map();
  for (const e of events) if (e.name === 'FireAnimationFrame') threads.set(`${e.pid}:${e.tid}`, (threads.get(`${e.pid}:${e.tid}`) ?? 0) + 1);
  const main = [...threads].sort((a, b) => b[1] - a[1])[0]?.[0];
  const sum = new Map();
  for (const e of events) {
    if (e.ph !== 'X' || `${e.pid}:${e.tid}` !== main) continue;
    sum.set(e.name, (sum.get(e.name) ?? 0) + (e.dur ?? 0));
  }
  const f = Math.max(1, page2.frames);
  const ms = (n) => +((sum.get(n) ?? 0) / 1000 / f).toFixed(2);
  const life = [...sum].filter(([k]) => /Lifecycle/.test(k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${(v / 1000 / f).toFixed(2)} ms/frame ${k}`);
  const out = {
    tier: cfg.tier,
    m: cfg.m,
    z: page2.z,
    frames: page2.frames,
    domWritesPerFrame: +(page2.writes / f).toFixed(2),
    framesWithAWrite: +(page2.wrote / f).toFixed(2),
    msPerFrame: {
      lifecycle: life[0] ?? 'none traced',
      style: ms('UpdateLayoutTree'),
      layout: ms('Layout'),
      prePaint: ms('PrePaint'),
      paint: ms('Paint'),
      layerize: ms('Layerize'),
      commit: ms('Commit'),
      rafCallbacks: ms('FireAnimationFrame'),
    },
    lifecycleEvents: life.slice(0, 6),
    writes: page2.rows,
    labelNodes: page2.tags,
  };
  out.msPerFrame.pageWork = +(out.msPerFrame.style + out.msPerFrame.layout + out.msPerFrame.prePaint + out.msPerFrame.paint + out.msPerFrame.layerize + out.msPerFrame.commit).toFixed(2);
  return JSON.stringify(out, null, 1);
}
