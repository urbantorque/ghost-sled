// Frame times during an avalanche chase (the rear-view mirror renders the scene a second time) on the
// High tier with the CPU throttled 4x. Steers the safe line with real key presses.
async (page) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('http://127.0.0.1:4173/?platform=mock&debug&fps&autoride=1&m=0&event=1&tier=high');
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 20000 });
  const held = new Set();
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 150000 && samples.length < 300) {
    const d = await page.evaluate(() => {
      const a = window.__gs; const r = a.run; if (!r || a.phase !== 'run') return { done: true };
      const s = r.sim.s, c = r.sim.course, av = r.sim.dyn.avalanche;
      const look = s.z + 8 + s.speed * 0.3;
      const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.05;
      return { keys: s.grounded ? (err > 0.05 ? ['ArrowRight'] : err < -0.05 ? ['ArrowLeft'] : []) : [], phase: av.phase, gap: s.z - av.z, stats: a.frameStats() };
    });
    if (d.done) break;
    const want = new Set(d.keys);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    if (d.phase === 2 && d.gap < 70) samples.push(d.stats);
    await page.waitForTimeout(30);
  }
  for (const k of held) await page.keyboard.up(k);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const f = samples.map((s) => s.fps).sort((a, b) => a - b);
  const p = samples.map((s) => s.p90).sort((a, b) => a - b);
  return JSON.stringify({ n: samples.length, fpsMin: f[0], fpsMed: f[f.length >> 1], p90Med: p[p.length >> 1], p90Max: p[p.length - 1], tier: samples.length ? samples[samples.length - 1].tier : null });
}
