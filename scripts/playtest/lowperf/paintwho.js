// Which layers the page repaints during a Low ride at 6x, and the elements that own them: CDP's LayerTree domain
// (layerPainted per layer) and DOM.describeNode on each layer's backend node.
//   playwright-cli -s=r8-lowperf eval "window.__pwCfg = { base: 'http://127.0.0.1:4880/', m: 2 }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/paintwho.js
async (page) => {
  const cfg = { m: 2, tier: 'low', throttle: 6, warm: 8, seconds: 10, query: '', ...((await page.evaluate(() => window.__pwCfg).catch(() => null)) || {}) };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} }).catch(() => {});
  await page.goto(`${cfg.base}?platform=mock&debug&autoride=1&m=${cfg.m}&tier=${cfg.tier}${cfg.query}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
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
    window.__pwf = 0;
    const tick = () => {
      window.__pwf++;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
  await page.waitForTimeout(cfg.warm * 1000);
  await cdp.send('DOM.enable');
  await cdp.send('DOM.getDocument', { depth: -1 });
  const layers = new Map();
  const painted = new Map();
  cdp.on('LayerTree.layerTreeDidChange', (e) => {
    for (const l of e.layers ?? []) layers.set(l.layerId, l);
  });
  cdp.on('LayerTree.layerPainted', (e) => painted.set(e.layerId, (painted.get(e.layerId) ?? 0) + 1));
  await cdp.send('LayerTree.enable');
  const f0 = await page.evaluate(() => window.__pwf);
  await page.waitForTimeout(cfg.seconds * 1000);
  const f1 = await page.evaluate(() => window.__pwf);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const frames = Math.max(1, f1 - f0);
  const rows = [];
  for (const [id, n] of [...painted].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    const l = layers.get(id);
    let who = '?';
    if (l?.backendNodeId) {
      try {
        const d = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId });
        const nd = d.node;
        const attrs = nd.attributes ?? [];
        const cls = attrs[attrs.indexOf('class') + 1];
        who = `${nd.nodeName.toLowerCase()}${attrs.includes('class') ? '.' + cls.split(/\s+/).join('.') : ''}`;
      } catch (e) {
        who = 'describe failed';
      }
    }
    rows.push(`${(n / frames).toFixed(2)}/frame ${l ? `${Math.round(l.width)}x${Math.round(l.height)} draws=${l.drawsContent}` : ''} ${who}`);
  }
  // Every layer the page holds at the end, with the element that owns it and why it is composited.
  const all = [];
  for (const l of layers.values()) {
    let who = '(no node)';
    if (l.backendNodeId) {
      try {
        const d = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId });
        const nd = d.node;
        const attrs = nd.attributes ?? [];
        const ci = attrs.indexOf('class');
        who = `${nd.nodeName.toLowerCase()}${ci >= 0 ? '.' + attrs[ci + 1].split(/\s+/).join('.') : ''}`;
      } catch {
        who = '(describe failed)';
      }
    }
    let why = '';
    try {
      const r = await cdp.send('LayerTree.compositingReasons', { layerId: l.layerId });
      why = (r.compositingReasonIds ?? r.compositingReasons ?? []).slice(0, 3).join(',');
    } catch {}
    all.push(`${Math.round(l.width)}x${Math.round(l.height)} draws=${l.drawsContent ? 1 : 0} ${who} [${why}]`);
  }
  return JSON.stringify({ cfg: { base: cfg.base, m: cfg.m }, frames, layers: layers.size, rows, all }, null, 1);
}
