// Round 6's fireworks on demand: mid-run, pushes a synthetic beat to the world's lantern effects (a won gates
// set piece's street show, or a win's show with `win: true`) and shoots frames as the shells rise and burst.
//   playwright-cli -s=feel eval "window.__fwCfg = { base: 'http://127.0.0.1:4402/', m: 0, tier: 'high', out: 'shots/r6/feel/fw' }"
//   playwright-cli -s=feel run-code --filename=scripts/playtest/fireworks.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4402/', m: 0, demo: 0, tier: 'high', out: 'shots/r6/feel/fw', win: false, wait: 2500, frames: [700, 1100, 1500, 1900, 2400, 3000], reduced: false }, (await page.evaluate(() => window.__fwCfg).catch(() => null)) || {});
  const vp = page.viewportSize();
  const dev = vp.width < vp.height ? 'phone' : 'desk';
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  if (cfg.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${cfg.base}?platform=mock&debug&tier=${cfg.tier}&m=${cfg.m}&autoride=1&demo=${cfg.demo}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run', null, { timeout: 60000 });
  await page.waitForTimeout(cfg.wait);
  await page.evaluate((win) => {
    const sp = window.__gs.world.spirit;
    sp.beats([win ? { type: 'finish', tick: 0, bonus: 0, seconds: 100, rank: 1, of: 6 } : { type: 'moment', tick: 0, key: 'test', verb: 'gates', phase: 'won', n: 6, of: 6 }]);
  }, cfg.win);
  let last = 0;
  for (const ms of cfg.frames) {
    await page.waitForTimeout(ms - last);
    last = ms;
    await page.screenshot({ path: `${cfg.out}/${dev}-${cfg.tier}-m${cfg.m}-${cfg.win ? 'win' : 'street'}${cfg.reduced ? '-calm' : ''}-${ms}.png` });
  }
  return JSON.stringify({ errors });
}
