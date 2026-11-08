// The first rendered frame (performance mark 'gs-first-frame', from navigation start) at a CPU throttle, on
// a returning save (one finished run: the title builds the medal wall's boards) and on a fresh one, for each
// build in turn, interleaved. Warm: each build is loaded once before it is measured.
//   playwright-cli -s=ff eval "window.__ffCfg = { builds: ['http://127.0.0.1:4310/', 'http://127.0.0.1:4174/'], rounds: 3, throttle: 6 }"
//   playwright-cli -s=ff run-code --filename=scripts/playtest/firstframe.js
async (page) => {
  const cfg = Object.assign({ builds: [], rounds: 3, throttle: 6 }, (await page.evaluate(() => window.__ffCfg).catch(() => null)) || {});
  const cdp = await page.context().newCDPSession(page);
  const one = async (base) => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
    if (cfg.fresh) { await page.goto(base + '?platform=mock'); await page.evaluate(() => localStorage.clear()); }
    await page.goto(base + '?platform=mock', { timeout: 120000 });
    const t = await page.waitForFunction(() => { const e = performance.getEntriesByName('gs-first-frame')[0]; return e ? e.startTime : null; }, null, { timeout: 120000, polling: 100 }).then((h) => h.jsonValue());
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return Math.round(t);
  };
  const out = {};
  for (const b of cfg.builds) {
    await page.goto(b + '?platform=mock');
    await page.waitForTimeout(1500);
    out[b] = [];
  }
  for (let r = 0; r < cfg.rounds; r++) {
    const order = r % 2 === 0 ? cfg.builds : [...cfg.builds].reverse();
    for (const b of order) out[b].push(await one(b));
  }
  return JSON.stringify(out);
}
