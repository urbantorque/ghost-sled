// The ride home (round 5): wreck a run by holding one steer key, open the results, press "Ride home as a
// spirit", shoot the ride and the town, and check the card comes back unchanged.
//   playwright-cli -s=home eval "window.__homeCfg = { base: 'http://127.0.0.1:4174/', out: 'shots/r5/home' }"
//   playwright-cli -s=home run-code --filename=scripts/playtest/homeward.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4173/', out: 'shots/r5/home', m: 0 }, (await page.evaluate(() => window.__homeCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  await page.goto(cfg.base + '?platform=mock');
  await page.evaluate(() => localStorage.clear());
  await page.goto(cfg.base + `?platform=mock&debug&tier=high&autoride=1&m=${cfg.m}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__gs.phase !== 'run', null, { timeout: 300000, polling: 200 });
  await page.keyboard.up('ArrowRight');
  const wreck = await page.evaluate(() => ({ phase: window.__gs.phase, z: Math.round(window.__gs.run.sim.distance), cause: window.__gs.run.sim.s.crashCause }));
  await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 30000, polling: 200 });
  await page.waitForTimeout(3600);
  await page.screenshot({ path: `${cfg.out}/${dev}-1-results.png` });
  const btn = page.getByRole('button', { name: /ride home/i });
  const has = await btn.count();
  if (!has) return JSON.stringify({ errors, wreck, note: 'no ride home button' });
  await btn.first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${cfg.out}/${dev}-2-riding.png` });
  const mid = await page.evaluate(() => ({ phase: window.__gs.phase }));
  await page.waitForTimeout(20000);
  await page.screenshot({ path: `${cfg.out}/${dev}-3-riding-20s.png` });
  const t0 = Date.now();
  let shotTown = false;
  while (Date.now() - t0 < 200000) {
    const st = await page.evaluate(() => ({ phase: window.__gs.phase }));
    if (st.phase !== 'home') break;
    const z = await page.evaluate(() => { const h = window.__gs.homeRide; return h ? h.sim.s.z : 0; });
    if (!shotTown && z > 4380) {
      shotTown = true;
      await page.screenshot({ path: `${cfg.out}/${dev}-4-town.png` });
    }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3600);
  await page.screenshot({ path: `${cfg.out}/${dev}-5-card-again.png` });
  const after = await page.evaluate(() => ({ phase: window.__gs.phase, z: Math.round(window.__gs.run.sim.distance), crashed: window.__gs.run.sim.s.crashed, finished: window.__gs.run.sim.finished }));
  return JSON.stringify({ errors, wreck, mid, after, secs: Math.round((Date.now() - t0) / 1000) });
}
