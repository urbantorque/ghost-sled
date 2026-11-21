// Round 8, the modes lane: where the modes are found. A save on Almanac page `page` (the mirrors of the pages opened,
// the Long Night), the title with the picked mountain's mirror toggle off and on (the title's scene turns over with
// it), the Almanac at the Long Night's page and at a mirror's page with their Ride, and the console.
//   playwright-cli -s=r8-modes eval "window.__uiCfg = { base: 'http://127.0.0.1:4810/', out: 'C:/.../shots/r8/modes/ui/', tier: 'high', page: 30 }"
//   playwright-cli -s=r8-modes run-code --filename=scripts/playtest/modes-ui.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4810/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/modes/ui/', tier: 'high', page: 30, tag: 'desk' }, (await page.evaluate(() => window.__uiCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.goto(c.base);
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${c.base}?platform=mock&debug&tier=${c.tier}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title' && document.querySelector('.gs-ride'), null, { timeout: 120000 });
  await page.evaluate((p) => {
    const gs = window.__gs;
    const d = gs.save.data;
    d.runs = 60;
    d.ghostsPassed = 400;
    d.rank = { xp: 400000, claimed: p };
    d.longNight = { legs: 2, z: 640 };
    gs.save.flush();
    gs.refreshTitle();
  }, c.page);
  await page.waitForTimeout(2500);
  const out = { toggle: null, rides: [], subline: null };
  await page.screenshot({ path: `${c.out}${c.tag}-title-plain.png` });
  out.toggle = await page.evaluate(() => {
    const t = document.querySelector('.gs-t-mirror');
    return t ? { pressed: t.getAttribute('aria-pressed'), label: t.getAttribute('aria-label') } : null;
  });
  await page.click('.gs-t-mirror');
  await page.waitForTimeout(2500);
  out.subline = await page.evaluate(() => ({ ride: document.querySelector('.gs-ride')?.getAttribute('aria-label'), pressed: document.querySelector('.gs-t-mirror')?.getAttribute('aria-pressed'), canvas: getComputedStyle(window.__gs.world.renderer.domElement).transform }));
  await page.screenshot({ path: `${c.out}${c.tag}-title-mirror.png` });
  // The Almanac, as the rank card opens it.
  await page.evaluate(() => window.__gs.ui.showAlmanac(window.__gs.almanacWithModes()));
  await page.waitForTimeout(800);
  out.rides = await page.evaluate(() => [...document.querySelectorAll('.gs-bk-ride')].map((b) => b.getAttribute('aria-label')));
  for (const fk of ['ride-night', 'ride-mirror-pinecrest', 'ride-mirror-sakura']) {
    const there = await page.evaluate((k) => {
      const b = document.querySelector(`[data-fk="${k}"]`);
      if (!b) return false;
      b.scrollIntoView({ block: 'center' });
      return true;
    }, fk);
    if (!there) continue;
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${c.out}${c.tag}-almanac-${fk}.png` });
  }
  // Ride the Long Night from its page: the run starts on its first leg.
  await page.evaluate(() => document.querySelector('[data-fk="ride-night"]')?.click());
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 60000 }).catch(() => null);
  out.night = await page.evaluate(() => ({ phase: window.__gs.phase, night: window.__gs.night, mountain: window.__gs.mountain.id, key: window.__gs.mountainKey() }));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${c.out}${c.tag}-night-leg1.png` });
  await page.goto('about:blank');
  return JSON.stringify({ ...out, errors });
}
