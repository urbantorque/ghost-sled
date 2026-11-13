// Ghosts in the frame (round 7 hero lane): starts a run and shoots the chase lens every `every` seconds
// from `from` seconds in, while the pack is still close off the start line, clipped to the middle of the
// frame where the pack rides, on any mountain and tier.
//   playwright-cli -s=r7-hero eval "window.__ghostCfg = { base: 'http://127.0.0.1:4430/', out: 'C:/.../shots/r7/hero/ghosts/', m: 3, tier: 'high' }"
//   playwright-cli -s=r7-hero run-code --filename=scripts/playtest/ghostlook.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4430/', out: 'shots/r7/hero/ghosts/', m: 0, tier: 'high', mood: 0, from: 2.2, every: 0.7, n: 6, riders: 0, tag: '', clip: null, demo: null }, (await page.evaluate(() => window.__ghostCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 200)); });
  await page.goto(c.base + `?debug&tier=${c.tier}&${c.demo === null ? 'autoride=1' : 'demo=' + c.demo}&m=${c.m}&mood=${c.mood}&riders=${c.riders}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  await page.waitForTimeout(c.from * 1000);
  const vp = page.viewportSize();
  const clip = c.clip || { x: Math.round(vp.width * 0.2), y: Math.round(vp.height * 0.2), width: Math.round(vp.width * 0.6), height: Math.round(vp.height * 0.6) };
  const shots = [];
  for (let i = 0; i < c.n; i++) {
    const file = `${c.out}m${c.m}-${c.tier}${c.tag ? '-' + c.tag : ''}-${i}.png`;
    await page.screenshot({ path: file, clip });
    shots.push(file);
    await page.waitForTimeout(c.every * 1000);
  }
  await page.goto('about:blank');
  return JSON.stringify({ shots, errors });
}
