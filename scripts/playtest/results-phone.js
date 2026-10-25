// Results on the session's viewport: rides with no input until the first crash, then shoots the
// results screen. Run in the `mob` session for the phone portrait version.
async (page) => {
  await page.goto('http://127.0.0.1:4173/?platform=mock&debug&autoride=1&m=0');
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 15000 });
  await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 90000, polling: 250 });
  // The card's staged reveal (head, race, stats, buttons) takes about 3 s.
  await page.waitForTimeout(3400);
  const vp = page.viewportSize();
  const path = `shots/r3-lead-results-${vp.width < vp.height ? 'phone' : vp.width + 'x' + vp.height}.png`;
  await page.screenshot({ path });
  return path;
}
