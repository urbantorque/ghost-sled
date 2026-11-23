// Round 9, the garage lane: the garage as a place (prototypes/r9/garage.html), shot as each shelf frames it, with what
// it cost to open. The page is loaded once to warm the origin (a fresh headless browser's first loads stall), then once a
// shot, each with its own URL switches; the console is read on every load.
//   playwright-cli -s=r9-garage eval "window.__sceneCfg = { base: 'http://127.0.0.1:4940/', out: '.../scene/desk-', shots: [...] }"
//   playwright-cli -s=r9-garage run-code --filename=scripts/playtest/r9-garage-scene.js
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:4940/',
      out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/garage/scene/desk-',
      wait: 1800,
      shots: [{ name: 'home', q: '' }],
    },
    (await page.evaluate(() => window.__sceneCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  const url = (q) => `${c.base}prototypes/r9/garage.html${q ? `?${q}` : ''}`;
  // Warm the origin and the module graph.
  await page.goto(url('ui=0'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__garage, null, { timeout: 120000 });
  const out = [];
  for (const s of c.shots) {
    const t0 = Date.now();
    await page.goto(url(s.q), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__garage, null, { timeout: 60000 });
    const ready = Date.now() - t0;
    await page.waitForTimeout(s.wait ?? c.wait);
    await page.screenshot({ path: `${c.out}${s.name}.png` });
    const cost = await page.evaluate(() => {
      const g = window.__garage;
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
      return { ...g.cost, info: g.scene.info(), heapMB: mem, tier: g.tier, dpr: devicePixelRatio, w: innerWidth, h: innerHeight };
    });
    out.push({ name: s.name, q: s.q, readyMs: ready, cost });
  }
  await page.goto('about:blank');
  return JSON.stringify({ shots: out, errors });
}
