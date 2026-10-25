// Sled shop on the title (returning player with some gifts) and one Medium-tier run frame, for the
// critique set. Run in the desktop session.
async (page) => {
  const BASE = 'http://127.0.0.1:4173/';
  await page.goto(BASE + '?platform=mock&tier=high&debug');
  await page.evaluate(() => { const k = 'ghostsled.save.v1'; const d = JSON.parse(localStorage.getItem(k) || 'null'); if (d) { d.gifts = Math.max(d.gifts, 420); localStorage.setItem(k, JSON.stringify(d)); } });
  await page.goto(BASE + '?platform=mock&tier=high&debug');
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /sleds/i }).first().click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shots/menu-sleds.png' });
  await page.keyboard.press('Escape');
  await page.goto(BASE + '?platform=mock&tier=medium&debug&fps&autoride=1&m=0');
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 15000 });
  // Hold the safe line with real keys for 7 s (a hands-off sled rides into the trees).
  const held = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 7000) {
    const keys = await page.evaluate(() => {
      const r = window.__gs.run; if (!r || window.__gs.phase !== 'run') return null;
      const s = r.sim.s, c = r.sim.course;
      const look = s.z + 8 + s.speed * 0.3;
      const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.05;
      return s.grounded ? (err > 0.05 ? ['ArrowRight'] : err < -0.05 ? ['ArrowLeft'] : []) : [];
    });
    if (!keys) break;
    const want = new Set(keys);
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    await page.waitForTimeout(16);
  }
  for (const k of held) await page.keyboard.up(k);
  await page.screenshot({ path: 'shots/r3-lead-medium-run.png' });
  return 'ok';
}
