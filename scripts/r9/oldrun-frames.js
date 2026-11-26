// Round 9, the ground lane: chase-camera frames of the Old Run's lab course (?debug&seed=9b05688c rides it in the
// Daily's place, in its borrowed look). The sled is held on a line at a speed (as descent.js holds it on the safe line)
// from 45 m before each spot, so the camera has settled, and the frame is taken as it passes: on the floor's middle, or
// high on a bend's outside wall where the glaze is. The HUD's DOM is hidden; the console is read throughout.
//   playwright-cli -s=r9-ground eval "window.__oldrunCfg = { base: 'http://127.0.0.1:4970/', tier: 'high' }"
//   playwright-cli -s=r9-ground run-code --filename=scripts/r9/oldrun-frames.js
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:4970/',
      out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/ground/frames/',
      tier: 'high',
      spots: [
        { name: '01-start-house-straight', z: 70, line: 'floor', v: 18 },
        { name: '02-hotel-bend-glaze', z: 232, line: 'glaze', v: 30 },
        { name: '03-hotel-bend-floor', z: 380, line: 'floor', v: 26 },
        { name: '04-threshold-charm-gate', z: 1040, line: 'floor', v: 28 },
        { name: '05-labyrinth-glaze', z: 1278, line: 'glaze', v: 30 },
        { name: '06-labyrinth-slush', z: 1346, line: 'floor', v: 22 },
        { name: '07-labyrinth-glaze-2', z: 1504, line: 'glaze', v: 30 },
        { name: '08-horseshoe-glaze', z: 2618, line: 'glaze', v: 32 },
        { name: '09-horseshoe-hold', z: 2720, line: 'floor', v: 30 },
        { name: '10-horseshoe-out-glaze', z: 2822, line: 'glaze', v: 30 },
        { name: '11-outrun', z: 2960, line: 'floor', v: 24 },
      ],
    },
    (await page.evaluate(() => window.__oldrunCfg).catch(() => null)) || {},
  );
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
  await page.goto(`${c.base}?platform=mock&debug&save=fresh&tier=${c.tier}&autoride=1&seed=9b05688c`);
  // (The Daily's rivals are ridden on the lab course in the worker first; autoride fires before they are, so the ride
  // starts once they are ready.)
  await page.waitForFunction(() => window.__gs && (window.__gs.phase === 'run' || window.__gs.dailyReady), null, { timeout: 300000 });
  await page.evaluate(() => window.__gs.phase === 'run' || window.__gs.ride());
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  const shot = [];
  for (const sp of c.spots) {
    await page.evaluate((spot) => {
      const run = window.__gs.run;
      const cc = run.sim.course;
      // The line to hold: the floor's middle, or two thirds up the outside wall of the bend there (the glaze).
      const at = (q) => {
        if (spot.line !== 'glaze') return cc.centerX(q);
        const p = cc.channelSlope(q);
        const pp = cc.centerX(q + 2) - 2 * cc.centerX(q) + cc.centerX(q - 2);
        return cc.centerX(q) + (pp > 0 ? -1 : 1) * (2.6 + 0.67 * 4.9) * Math.sqrt(1 + p * p);
      };
      const place = (q) => {
        q.x = at(q.z);
        q.y = cc.ground(q.x, q.z);
        q.vx = ((at(q.z + 1) - at(q.z - 1)) / 2) * spot.v;
        q.vz = spot.v;
        q.vy = 0;
        q.speed = Math.hypot(q.vx, q.vz);
        q.grounded = true;
        q.heading = Math.atan2(q.vx, q.vz);
        q.velHeading = q.heading;
        q.invuln = 30;
      };
      const s = run.sim.s;
      if (s.z < spot.z - 45) s.z = spot.z - 45;
      place(s);
      if (window.__pinOff) window.__pinOff();
      let live = true;
      const pin = () => {
        if (!live) return;
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && !rr.sim.s.finished) place(rr.sim.s);
        requestAnimationFrame(pin);
      };
      window.__pinOff = () => {
        live = false;
      };
      requestAnimationFrame(pin);
    }, sp);
    await page.waitForFunction((z) => window.__gs.run && window.__gs.run.sim.s.z >= z, sp.z, { timeout: 60000 }).catch(() => {});
    const z = await page.evaluate(() => window.__gs.run.sim.s.z);
    await page.screenshot({ path: `${c.out}${sp.name}-z${Math.round(z)}.png` });
    shot.push(`${sp.name} at ${Math.round(z)} m`);
  }
  await page.evaluate(() => window.__pinOff && window.__pinOff());
  return JSON.stringify({ shot, errors });
}
