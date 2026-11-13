// UI harness states (round 7 screens), on the dev server (ui-harness.html is not in the build).
//   window.__cfg = { base, out, prefix, mode: 'keyboard' | 'touch', shots: ['title-twelve', 'results-win', ...] }
async (page) => {
  const cfg = await page.evaluate(() => window.__cfg);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  for (const s of cfg.shots) {
    const [name, wait, bg] = Array.isArray(s) ? s : [s, 0, ''];
    await page.goto(`${cfg.base}ui-harness.html?bare=1&mode=${cfg.mode || 'keyboard'}&s=${name}${bg ? '&bg=' + bg : ''}`);
    await page.waitForTimeout(wait || cfg.wait || 2600);
    await page.screenshot({ path: `${cfg.out}/${cfg.prefix || 'h'}-${name}${wait ? '-' + wait : ''}.png` });
  }
  return JSON.stringify({ n: cfg.shots.length, errors });
}
