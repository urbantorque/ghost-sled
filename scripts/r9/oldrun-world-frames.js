// Round 9, the Old Run's world: chase-camera frames of the Old Run (?debug&seed=9b05688c rides it in the Daily's place),
// adapted from oldrun-frames.js. The sled is held on a line at a speed from 45 m before each spot (as descent.js holds
// it), so the camera has settled, and the frame is taken as it passes: on the floor's middle, or on the line a skilled
// rider rides there (the glaze through a bend: Course.lineFor at skill 0.9). Staged frames, not a ride. The HUD's DOM
// is hidden; the console is read throughout, and its errors and warnings come back with the list of frames.
//   playwright-cli -s=r9-oldrun-world eval "window.__oldrunCfg = { base: 'http://127.0.0.1:4980/', tier: 'high' }"
//   playwright-cli -s=r9-oldrun-world run-code --filename=scripts/r9/oldrun-world-frames.js
// Options in __oldrunCfg: base, out (a folder, absolute, ending in /), tier, tag (prefixed to each name), hour ('alt'
// lights the run at its other hour through palette.ts setHour, as the title's pick would once the mountain is
// registered), mirror (true turns the picture over, World.setMirrored), spots ([{ name, z, line, v }]), skip (seconds
// to wait at the first spot before shooting, for the world's on-demand module and the forest to settle).
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:4980/',
      out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/oldrun/world/',
      tier: 'high',
      tag: '',
      hour: 'day',
      mirror: false,
      skip: 4,
      spots: [
        { name: '1-opening', z: 60, line: 'floor', v: 22 },
        { name: '2-q1', z: 750, line: 'glaze', v: 33 },
        { name: '3-q2', z: 1500, line: 'glaze', v: 34 },
        { name: '4-q3', z: 2250, line: 'glaze', v: 35 },
        { name: '5-finish', z: 2940, line: 'floor', v: 26 },
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
  await page.waitForFunction(() => window.__gs && (window.__gs.phase === 'run' || window.__gs.dailyReady), null, { timeout: 300000 });
  await page.evaluate(() => window.__gs.phase === 'run' || window.__gs.ride());
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  if (c.hour === 'alt' || c.mirror) {
    await page.evaluate(
      async ({ hour, mirror }) => {
        const w = window.__gs.world;
        if (hour === 'alt') {
          const pal = await import('/src/render/palette.ts');
          pal.setHour('alt');
          w.relight();
        }
        if (mirror) w.setMirrored(true);
      },
      { hour: c.hour, mirror: c.mirror },
    );
  }
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  const shot = [];
  let first = true;
  for (const sp of c.spots) {
    await page.evaluate((spot) => {
      const run = window.__gs.run;
      const cc = run.sim.course;
      const at = (q) => (spot.line === 'glaze' ? cc.lineFor(q, { skill: 0.9, v: spot.v }) : spot.line === 'x' ? cc.centerX(q) + spot.x : cc.centerX(q));
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
      if (s.z < spot.z - 45 || s.z > spot.z) s.z = spot.z - 45;
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
    if (first && c.skip > 0) {
      // (The world's module loads on demand: hold the sled short of the first spot until it has, and the forest's
      // idle-time sets have been made.)
      await page.evaluate((spot) => {
        window.__holdZ = spot.z - 46;
        const hold = () => {
          const rr = window.__gs.run;
          if (window.__holdZ === null || !rr) return;
          if (rr.sim.s.z > window.__holdZ) rr.sim.s.z = window.__holdZ;
          requestAnimationFrame(hold);
        };
        requestAnimationFrame(hold);
      }, sp);
      await page.waitForTimeout(c.skip * 1000);
      await page.evaluate(() => {
        window.__holdZ = null;
      });
      first = false;
    }
    await page.waitForFunction((z) => window.__gs.run && window.__gs.run.sim.s.z >= z, sp.z, { timeout: 60000 }).catch(() => {});
    const z = await page.evaluate(() => window.__gs.run.sim.s.z);
    await page.screenshot({ path: `${c.out}${c.tag}${sp.name}-z${Math.round(z)}.png` });
    shot.push(`${sp.name} at ${Math.round(z)} m`);
  }
  await page.evaluate(() => window.__pinOff && window.__pinOff());
  return JSON.stringify({ shot, errors });
}
