// Phone portrait with real touch input (run with .playwright/mobile.config.json): a new player taps
// Ride, then steers with a thumb drag in the left zone while the onboarding hints play out.
async (page) => {
  const BASE = 'http://127.0.0.1:4173/';
  await page.goto(BASE + '?platform=mock&debug&m=0');
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/mobile-title.png' });
  await page.getByRole('button', { name: /ride/i }).first().tap();
  await page.waitForFunction(() => window.__gs.phase === 'run', null, { timeout: 15000 });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const read = () => page.evaluate(() => {
    const a = window.__gs; const r = a.run; if (!r || a.phase !== 'run') return null;
    const s = r.sim.s, c = r.sim.course;
    const look = s.z + 8 + s.speed * 0.3;
    const err = Math.atan2(c.safeX(look) - s.x, look - s.z) - s.velHeading + (c.safeX(s.z) - s.x) * 0.05;
    return { t: r.sim.tick / 60, err, grounded: s.grounded };
  });
  const x0 = 110, y0 = 720;
  let down = false;
  const shots = [[1.4, 'mobile-run'], [7.5, 'mobile-run2'], [14, 'mobile-run3']];
  const t0 = Date.now();
  while (Date.now() - t0 < 40000 && shots.length) {
    const d = await read();
    if (!d) break;
    if (d.t > 2.2) {
      // Relative stick: the finger's offset from where it landed sets the steer.
      const dx = d.grounded ? Math.max(-70, Math.min(70, d.err * 420)) : 0;
      if (!down) { await touch('touchStart', x0, y0); down = true; }
      await touch('touchMove', x0 + dx, y0);
    }
    if (d.t >= shots[0][0]) {
      const [, name] = shots.shift();
      await page.screenshot({ path: `shots/${name}.png` });
    }
    await page.waitForTimeout(16);
  }
  if (down) await touch('touchEnd', 0, 0);
  const why = await page.evaluate(() => { const r = window.__gs.run; return r ? { t: r.sim.tick / 60, cause: r.sim.s.crashCause, phase: window.__gs.phase } : null; });
  return shots.length ? 'missed ' + shots.map((s) => s[1]).join(',') + ' ' + JSON.stringify(why) : 'ok';
}
