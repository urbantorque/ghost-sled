// Round 9, the look lane: a probe for tracing a fault to its cause. The sled is held still at one spot of a registered
// mountain (its z pinned, its speed kept, so the lens settles and stays), then each variant's page code is run, the
// frame shot and the variant's undo run: a system turned off, a uniform zeroed, a mesh hidden. Staged frames, not a ride.
//   playwright-cli -s=r9-look run-code --filename=<a wrapper setting window.__probeCfg, as look-shoot.mjs does>
// __probeCfg: base, out (absolute, ending in /), m, tier, hour ('alt'), save, query, settle (ms after a variant before
// the shot), spot ({ z, line: 'mid' | 'glaze' | 'x' | 'roof', v, x, s, h }), variants ([{ name, on, off }], page code as
// strings; the first is usually { name: 'base' }).
async (page) => {
  const c = Object.assign(
    { base: 'http://127.0.0.1:5044/', out: 'C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/look/probe/', m: 5, tier: 'high', hour: 'day', settle: 600, query: '', variants: [{ name: 'base' }] },
    (await page.evaluate(() => window.__probeCfg).catch(() => null)) || {},
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
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/render/palette.ts')) ?? '/src/render/palette.ts';
      const pal = await import(url);
      pal.setHour('alt');
      window.__gs.world.relight();
    });
  }
  if (c.prep) await page.evaluate(c.prep);
  await page.addStyleTag({ content: 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.evaluate(async ({ spot, pass }) => {
    const run = window.__gs.run;
    const cc = run.sim.course;
    const mod = async (name) => {
      const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes(`/src/sim/${name}.ts`)) ?? `/src/sim/${name}.ts`;
      return import(url);
    };
    const rk = spot.line === 'roof' ? await mod('gablefall') : null;
    const gk = spot.line === 'air' ? await mod('gullhaven') : null;
    const gullyAt = (q) => (gk ? gk.gulliesOf(cc).find((g) => q >= gk.gullySpan(g).z0 && q <= gk.gullySpan(g).z1) || null : null);
    const at = (q) => {
      const cx = cc.centerX(q);
      if (spot.line === 'glaze') return cc.lineFor(q, { skill: 0.9, v: spot.v });
      if (spot.line === 'roof') return cx + (spot.s ?? 1) * rk.RIDGE;
      if (spot.line === 'x') return cx + (spot.x ?? 0);
      if (spot.line === 'air') {
        const g = gullyAt(q);
        return g ? gk.boldX(cc, g, q) : cx;
      }
      return cx;
    };
    // Ride in from 45 m back, then hold at the spot (or, with pass, ride on through it: each variant rides in again).
    let z = spot.z - 45;
    window.__probeRestart = () => {
      window.__gs.run.sim.s.z = spot.z - (spot.runIn ?? 45);
    };
    const place = (q) => {
      if (pass) z = q.z;
      else if (z < spot.z) z = Math.min(spot.z, z + spot.v / 60);
      q.z = z;
      q.x = at(z);
      const g = spot.line === 'air' ? gullyAt(z) : null;
      q.y = g ? gk.rimY(cc, g, z) + (spot.h ?? 15) : cc.ground(q.x, z) + (spot.h ?? 0);
      q.vy = 0;
      q.grounded = !spot.h;
      q.vx = ((at(z + 1) - at(z - 1)) / 2) * spot.v;
      q.vz = spot.v;
      q.speed = Math.hypot(q.vx, q.vz);
      q.heading = Math.atan2(q.vx, q.vz);
      q.velHeading = q.heading;
      q.invuln = 30;
    };
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
  }, { spot: c.spot, pass: !!c.pass });
  await page.waitForTimeout(c.wait ?? 7000);
  const shot = [];
  const data = {};
  for (const v of c.variants) {
    if (v.on) await page.evaluate(v.on).catch((e) => errors.push('variant ' + v.name + ': ' + String(e).slice(0, 200)));
    await page.waitForTimeout(v.settle ?? c.settle);
    if (c.pass) {
      await page.evaluate(() => window.__probeRestart());
      await page.waitForFunction((zz) => window.__gs.run && window.__gs.run.sim.s.z >= zz, c.spot.z, { timeout: 60000 }).catch(() => {});
    }
    if (v.get) data[v.name] = await page.evaluate(v.get).catch((e) => 'get failed: ' + String(e).slice(0, 200));
    if (!v.noShot) await page.screenshot({ path: `${c.out}${c.tag ?? ''}${v.name}.png` });
    shot.push(v.name);
    if (v.off) await page.evaluate(v.off).catch((e) => errors.push('undo ' + v.name + ': ' + String(e).slice(0, 200)));
  }
  await page.evaluate(() => window.__pinOff && window.__pinOff());
  return JSON.stringify({ shot, data, errors });
}
