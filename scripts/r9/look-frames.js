// Round 9, the look lane (milestone 4's feel pass on the three new worlds): chase-camera frames of the Old Run, Gullhaven
// and Gablefall on their registered courses (?debug&m=5, 6, 7), one script for all three so every pass is shot the same
// way. Merged from oldrun-world-frames.js, gullhaven-world-frames.js and gablefall-world-frames.js: the sled is held on a
// line at a speed from 45 m before each spot (the lens has settled), and the frame is taken as it passes. Staged frames,
// not a ride. The HUD's DOM is hidden; the console is read throughout, and its errors and warnings come back with the
// list of frames.
//   playwright-cli -s=r9-look eval "window.__lookCfg = { m: 7, tier: 'high', out: '.../', spots: [...] }"
//   playwright-cli -s=r9-look run-code --filename=scripts/r9/look-frames.js
// Options in __lookCfg: base, out (a folder, absolute, ending in /), m (the mountain's index), tier, tag (prefixed to each
// name), hour ('alt' lights the run at its other hour through palette.ts setHour), save (a fixture, 'fresh' by default),
// query (more of the page's query), skip (seconds held short of the first spot while the world's module loads), prep
// (page code run once the ride is on), shot (page code run just before each screenshot).
// A spot: { name, z, line, v, s, x, h, vy }. Lines: 'mid' (the course's middle), 'glaze' (the Old Run's line at skill 0.9,
// Course.lineFor), 'bold' (Gullhaven's soaring line through a gully, gullhaven.ts boldX), 'air' (held h metres over a
// gully's rim on the bold line, falling at vy), 'roof' (Gablefall's ridge on side s, gablefall.ts RIDGE), 'x' (x metres
// off the middle; with h, held that high).
async (page) => {
  const c = Object.assign(
    {
      base: 'http://127.0.0.1:5044/',
      out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/dev/',
      m: 5,
      tier: 'high',
      tag: '',
      query: '',
      hour: 'day',
      skip: 5,
      spots: [{ name: 'a-opening', z: 60, line: 'mid', v: 20 }],
    },
    (await page.evaluate(() => window.__lookCfg).catch(() => null)) || {},
  );
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  await page.goto(c.base, { timeout: 240000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}
  });
  await page.goto(`${c.base}?platform=mock&debug&save=${c.save ?? 'fresh'}&tier=${c.tier}&autoride=1&m=${c.m}${c.query}`, { timeout: 240000 });
  await page.waitForFunction(() => window.__gs && (window.__gs.phase === 'run' || window.__gs.dailyReady), null, { timeout: 300000 });
  await page.evaluate(() => window.__gs.phase === 'run' || window.__gs.ride());
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 120000 });
  if (c.hour === 'alt') {
    await page.evaluate(async () => {
      // (The module the app itself loaded: after the dev server's hot updates its URL carries a ?t= stamp, and a bare
      // import would load a second copy whose hour the world never reads.)
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/render/palette.ts')) ?? '/src/render/palette.ts';
      const pal = await import(url);
      pal.setHour('alt');
      window.__gs.world.relight();
    });
  }
  if (c.prep) await page.evaluate(c.prep);
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  const shot = [];
  let first = true;
  for (const sp of c.spots) {
    await page.evaluate(async (spot) => {
      const run = window.__gs.run;
      const cc = run.sim.course;
      const mod = async (name) => {
        const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(`/src/sim/${name}.ts`)) ?? `/src/sim/${name}.ts`;
        return import(url);
      };
      const gk = spot.line === 'bold' || spot.line === 'air' ? await mod('gullhaven') : null;
      const rk = spot.line === 'roof' ? await mod('gablefall') : null;
      const gullyAt = (q) => (gk ? gk.gulliesOf(cc).find((g) => q >= gk.gullySpan(g).z0 && q <= gk.gullySpan(g).z1) || null : null);
      const at = (q) => {
        const cx = cc.centerX(q);
        if (spot.line === 'glaze') return cc.lineFor(q, { skill: 0.9, v: spot.v });
        if (spot.line === 'bold' || spot.line === 'air') {
          const g = gullyAt(q);
          return g ? gk.boldX(cc, g, q) : cx;
        }
        if (spot.line === 'roof') return cx + (spot.s ?? 1) * rk.RIDGE;
        if (spot.line === 'x') return cx + (spot.x ?? 0);
        return cx;
      };
      const place = (q) => {
        q.x = at(q.z);
        const g = spot.line === 'air' ? gullyAt(q.z) : null;
        if (g) {
          q.y = gk.rimY(cc, g, q.z) + (spot.h ?? 15);
          q.vy = spot.vy ?? 0;
          q.grounded = false;
        } else {
          q.y = cc.ground(q.x, q.z) + (spot.line === 'air' ? 0 : spot.h ?? 0);
          q.vy = spot.vy ?? 0;
          q.grounded = !spot.h || spot.line === 'air';
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
    if (c.shot) await page.evaluate(c.shot);
    const z = await page.evaluate(() => window.__gs.run.sim.s.z);
    // (No z in the name, so a pass's frames pair with the last pass's by name, blind-pairs.mjs.)
    await page.screenshot({ path: `${c.out}${c.tag}${sp.name}.png` });
    shot.push(`${sp.name} at ${Math.round(z)} m`);
  }
  await page.evaluate(() => window.__pinOff && window.__pinOff());
  return JSON.stringify({ shot, errors });
}
