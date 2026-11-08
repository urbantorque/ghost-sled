// The player review's screens: a fresh title, a first run's results, the second run's start and its
// results, the returning title, the sled shop, the Daily and the Cup, on the session's viewport. Rides
// hands-off (autoride), so the results are a real wreck or finish of a rider who never steers.
//   playwright-cli -s=rev eval "window.__revCfg = { base: 'http://127.0.0.1:4310/', out: 'shots/r5/base/review' }"
//   playwright-cli -s=rev run-code --filename=scripts/playtest/review.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4173/', out: 'shots/r5/x/review', m: 0, tier: 'high' }, (await page.evaluate(() => window.__revCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const tag = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const shot = (n) => page.screenshot({ path: `${cfg.out}/${tag}-${n}.png` });
  const notes = [];
  const q = `?platform=mock&debug&tier=${cfg.tier}`;
  await page.goto(cfg.base + q);
  await page.evaluate(() => localStorage.clear());
  await page.goto(cfg.base + q);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot('01-title-fresh');
  // A first run, hands-off, to its results.
  await page.goto(cfg.base + q + `&autoride=1&m=${cfg.m}`);
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('02-run1-start');
  await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 240000, polling: 250 });
  await page.waitForTimeout(3600);
  await shot('03-run1-results');
  notes.push(await page.evaluate(() => document.querySelector('.gs-results, [class*="results"]')?.innerText?.slice(0, 600) ?? ''));
  // Run again: the second run's start.
  await page.evaluate(() => window.__gs.runAgain());
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await shot('04-run2-start');
  await page.waitForFunction(() => { const r = window.__gs.run; return !r || window.__gs.phase !== 'run' || r.sim.s.z > 900; }, null, { timeout: 120000, polling: 100 });
  await shot('05-run2-900m');
  await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 240000, polling: 250 });
  await page.waitForTimeout(3600);
  await shot('06-run2-results');
  // The returning title.
  await page.goto(cfg.base + q);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await shot('07-title-returning');
  notes.push(await page.evaluate(() => document.body.innerText.slice(0, 900)));
  // The sled shop with gifts to spend.
  await page.evaluate(() => { const k = 'ghostsled.save.v1'; const d = JSON.parse(localStorage.getItem(k) || 'null'); if (d) { d.gifts = Math.max(d.gifts, 420); localStorage.setItem(k, JSON.stringify(d)); } });
  await page.goto(cfg.base + q);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const sleds = page.getByRole('button', { name: /sleds|garage/i }).first();
  if (await sleds.count()) {
    await sleds.click();
    await page.waitForTimeout(900);
    await shot('08-shop');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else notes.push('no sled button');
  const daily = page.getByRole('button', { name: /daily/i }).first();
  if (await daily.count()) {
    await daily.click();
    await page.waitForTimeout(3500);
    await shot('09-daily-picked');
  }
  const cup = page.getByRole('button', { name: /cup/i }).first();
  if (await cup.count()) {
    await cup.click();
    await page.waitForTimeout(3500);
    await shot('10-cup-picked');
  }
  return JSON.stringify({ errors, notes }, null, 1);
}
