// The duel heartbeat's and the fuse tick's rendered takes against the same beats built live (engine.debugRender
// 'pulseTakes', src/audio/probe.ts): an offline render of each, the worst block and residual difference, the largest
// sample difference and the RMS difference.
//   playwright-cli -s=r8-lowperf eval "window.__puCfg = { base: 'http://127.0.0.1:4880/' }"
//   playwright-cli -s=r8-lowperf --raw run-code --filename=scripts/playtest/lowperf/pulse.js
async (page) => {
  const cfg = { ...((await page.evaluate(() => window.__puCfg).catch(() => null)) || {}) };
  await page.goto(`${cfg.base}?platform=mock&debug`);
  await page.waitForFunction(() => window.__gs && window.__gs.audio && typeof window.__gs.audio.debugRender === 'function', null, { timeout: 60000 });
  const r = await page.evaluate(() => window.__gs.audio.debugRender('pulseTakes'));
  return JSON.stringify(r, null, 1);
}
