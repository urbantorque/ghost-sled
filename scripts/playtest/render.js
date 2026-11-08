// One offline render of the shipped audio Core (engine.debugRender -> src/audio/probe.ts) on a build, for
// quick A/B between builds: window.__renCfg = { base, kind, seconds, opts }. Returns the probe's numbers.
//   playwright-cli -s=music eval "window.__renCfg = { base: 'http://127.0.0.1:4401/', kind: 'layers' }"
//   playwright-cli -s=music run-code --filename=scripts/playtest/render.js
async (page) => {
  const cfg = Object.assign({ base: 'http://127.0.0.1:4173/', kind: 'cruise', seconds: 12, opts: {} }, (await page.evaluate(() => window.__renCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  await page.goto(cfg.base + '?platform=mock&debug');
  await page.waitForFunction(() => window.__gs && window.__gs.audio, null, { timeout: 60000 });
  const res = await page.evaluate(async ([kind, seconds, opts]) => window.__gs.audio.debugRender(kind, seconds, opts), [cfg.kind, cfg.seconds, cfg.opts]);
  await page.goto('about:blank');
  return JSON.stringify({ errors, res }, null, 0);
}
