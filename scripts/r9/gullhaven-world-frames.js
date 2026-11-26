// Round 9, Gullhaven's world: chase-camera frames of Gullhaven (?debug&seed=1f83d9ab rides it in the Daily's place, or
// ?debug&m=<i> once it is registered), adapted from oldrun-world-frames.js. The sled is held on a line at a speed from
// 45 m before each spot, so the camera has settled, and the frame is taken as it passes: on the path's middle, on the
// bold line a soaring rider rides there (Course.lineFor at skill 0.9), or in the air over a gully's mouth (line 'air':
// held `h` metres over the rim on the bold line, falling at `vy`, as a soaring rider is). Staged frames, not a ride. The
// HUD's DOM is hidden; the console is read throughout, and its errors and warnings come back with the list of frames.
//   playwright-cli -s=r9-gullhaven-world eval "window.__gullCfg = { base: 'http://127.0.0.1:4990/', tier: 'high' }"
//   playwright-cli -s=r9-gullhaven-world run-code --filename=scripts/r9/gullhaven-world-frames.js
// Options in __gullCfg: base, out (a folder, absolute, ending in /), tier, tag (prefixed to each name), hour ('alt'
// lights the run at its other hour through palette.ts setHour), mirror (true turns the picture over,
// World.setMirrored), spots ([{ name, z, line, v, h, vy, x }]), skip (seconds to wait at the first spot before shooting,
// for the world's on-demand module to load), query (more of the page's query), m (ride the registered mountain by its
// index instead of the seed switch), save (a save fixture, 'fresh' by default), prep (page code run once the ride is on).
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:4990/',
      out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/gullhaven/world/',
      tier: 'high',
      tag: '',
      query: '',
      hour: 'day',
      mirror: false,
      skip: 5,
      spots: [
        { name: '1-opening', z: 60, line: 'path', v: 20 },
        { name: '2-lip', z: 1336, line: 'bold', v: 32 },
        { name: '3-air', z: 2262, line: 'air', v: 31, h: 18, vy: -1 },
        { name: '4-shelf', z: 3240, line: 'path', v: 30 },
        { name: '5-finish', z: 4760, line: 'path', v: 24 },
      ],
    },
    (await page.evaluate(() => window.__gullCfg).catch(() => null)) || {},
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
  await page.goto(`${c.base}?platform=mock&debug&save=${c.save ?? 'fresh'}&tier=${c.tier}&autoride=1${c.m !== undefined ? '&m=' + c.m : '&seed=1f83d9ab'}${c.query}`);
  await page.waitForFunction(() => window.__gs && (window.__gs.phase === 'run' || window.__gs.dailyReady), null, { timeout: 300000 });
  await page.evaluate(() => window.__gs.phase === 'run' || window.__gs.ride());
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  if (c.hour === 'alt' || c.mirror) {
    await page.evaluate(
      async ({ hour, mirror }) => {
        const w = window.__gs.world;
        if (hour === 'alt') {
          // (The module the app itself loaded: after the dev server's hot updates its URL carries a ?t= stamp, and a bare
          // import would load a second copy whose hour the world never reads.)
          const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/render/palette.ts')) ?? '/src/render/palette.ts';
          const pal = await import(url);
          pal.setHour('alt');
          w.relight();
        }
        if (mirror) w.setMirrored(true);
      },
      { hour: c.hour, mirror: c.mirror },
    );
  }
  if (c.prep) await page.evaluate(c.prep);
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  const shot = [];
  let first = true;
  for (const sp of c.spots) {
    await page.evaluate(async (spot) => {
      const run = window.__gs.run;
      const cc = run.sim.course;
      const gk = await import('/src/sim/gullhaven.ts');
      const gullyAt = (q) => gk.gulliesOf(cc).find((g) => q >= gk.gullySpan(g).z0 && q <= gk.gullySpan(g).z1) || null;
      // (The bold line through a gully as the kit lays it, gullhaven.ts boldX: lineFor's choice holds by where a rider is.)
      const at = (q) => {
        const g = gullyAt(q);
        if ((spot.line === 'bold' || spot.line === 'air') && g) return gk.boldX(cc, g, q);
        return spot.line === 'x' ? cc.centerX(q) + spot.x : cc.centerX(q);
      };
      const place = (q) => {
        q.x = at(q.z);
        const g = gullyAt(q.z);
        if (spot.line === 'air' && g) {
          q.y = gk.rimY(cc, g, q.z) + (spot.h ?? 15);
          q.vy = spot.vy ?? 0;
          q.grounded = false;
        } else {
          q.y = cc.ground(q.x, q.z);
          q.vy = 0;
          q.grounded = true;
        }
        q.vx = ((at(q.z + 1) - at(q.z - 1)) / 2) * spot.v;
        q.vz = spot.v;
        q.speed = Math.hypot(q.vx, q.vz);
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
