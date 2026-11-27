// Round 9, the look lane: a mountain's title as a player opens it (its key art behind the title's own screens), on a save
// fixture, a few frames over its first seconds; with `bare` the DOM hidden so the key art alone is seen. The console's
// errors and warnings come back.
//   (through look-run.mjs, --var __titleCfg: { base, out, m, save, tier, times: [s, ...], bare, tag })
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:5044/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/title/', m: 6, save: 'mid-100', tier: 'high', times: [3, 6, 9], bare: false, tag: '' }, (await page.evaluate(() => window.__titleCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.goto(c.base, { timeout: 240000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${c.base}?platform=mock&debug&save=${c.save}&tier=${c.tier}&m=${c.m}`, { timeout: 240000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 300000 }).catch(() => {});
  if (c.bare) await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  const t0 = Date.now();
  const shot = [];
  for (const t of c.times) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: `${c.out}${c.tag}m${c.m}-${c.bare ? 'bare' : 'title'}-${t}s.png` });
    shot.push(`${t}s`);
  }
  return JSON.stringify({ shot, phase: await page.evaluate(() => window.__gs?.phase), errors });
}
