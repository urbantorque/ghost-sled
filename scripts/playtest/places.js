// The places: rides each mountain on the safe line at a set speed and shoots a list of fixed distances,
// with the set pieces' cost at each shot. Settle per shot so the idle builds are done.
//   playwright-cli -s=lane-places eval "window.__placesCfg = { base: 'http://127.0.0.1:4371/', out: 'shots/places/', tier: 'high', jobs: [{ m: 1, mood: 0, at: [2380, 2400, 2420] }] }"
//   playwright-cli -s=lane-places run-code --filename=scripts/playtest/places.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4371/', out: 'shots/places/', tier: 'high', speed: 30, tag: '', jobs: [] }, (await page.evaluate(() => window.__placesCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  for (const job of c.jobs) {
    const tier = job.tier || c.tier;
    await page.goto(c.base + `?debug&tier=${tier}&autoride=1&m=${job.m}&mood=${job.mood}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate((speed) => {
      window.__pinSpeed = speed;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
          const q = rr.sim.s;
          const cc = rr.sim.course;
          const v = window.__pinSpeed;
          const off = window.__pinOff || 0;
          q.x = cc.safeX(q.z) + off;
          q.y = cc.ground(q.x, q.z);
          q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * v) / 2;
          q.vz = v;
          q.vy = 0;
          q.speed = v;
          q.grounded = true;
          q.heading = Math.atan2(q.vx, q.vz);
          q.velHeading = q.heading;
          q.invuln = 10;
        }
        requestAnimationFrame(pin);
      };
      pin();
    }, c.speed);
    // With `kinds`, every site of those kinds: its approach, inside and way out.
    if (job.kinds) {
      const sites = await page.evaluate(() => window.__gs.world.setPieces.planned.map((s) => ({ kind: s.kind, z: s.z, len: s.len })));
      job.at = [];
      for (const s of sites) {
        if (!job.kinds.includes(s.kind)) continue;
        const a = Math.round(s.z - s.len);
        job.at.push(...(s.len > 0 ? [a - 55, Math.round(Math.min(a + 45, s.z)), Math.round(s.z + s.len * 0.75)] : [a - 45]));
      }
    }
    const list = job.at.slice().sort((a, b) => a - b);
    let last = -1e9;
    for (const z of list) {
      // A long way on: jump there, and wait out the build.
      if (z - last > 160) {
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 60);
        const t0 = Date.now();
        await page.waitForFunction(() => window.__gs.run.sim.s.z > 0 && window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
        report.push({ m: job.m, z, settleMs: Date.now() - t0 });
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 60);
      }
      await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
      const name = `m${job.m}-mood${job.mood}-z${String(z).padStart(4, '0')}${c.tag}.png`;
      await page.screenshot({ path: c.out + name });
      const st = await page.evaluate(() => {
        const w = window.__gs.world;
        const sp = w.setPieces;
        const r = window.__gs.run;
        return { z: r ? Math.round(r.sim.s.z) : null, crowd: sp.crowd.count, slots: sp.slots.filter((m) => m.visible).length, fps: window.__gs.frameStats ? window.__gs.frameStats().fps : null };
      });
      report.push({ name, st });
      last = z;
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
