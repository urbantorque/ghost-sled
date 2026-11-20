// Round 8, the light lane: where the great lantern (and the Lantern Row) stand in the finish shot. Rides finish.js's
// way to the line, then at the stop and in the results reports the rider, the lens and each probe's place on screen.
//   playwright-cli -s=x eval "window.__fpCfg = { base, m: 4, tier: 'high', out }" ; run-code --filename=scripts/playtest/finishprobe.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4760/', m: 4, tier: 'high', from: 3850, out: '', extra: '' }, (await page.evaluate(() => window.__fpCfg).catch(() => null)) || {});
  await page.goto(c.base + `?debug&tier=${c.tier}&autoride=1&m=${c.m}${c.extra}`, { timeout: 120000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(([from, lat]) => {
    window.__pinOn = true;
    const pin = () => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed && window.__pinOn) {
        const q = rr.sim.s, cc = rr.sim.course;
        const lx = (z) => (lat === null ? cc.safeX(z) : cc.centerX(z) + lat);
        q.x = lx(q.z); q.y = cc.ground(q.x, q.z); q.vx = ((lx(q.z + 1) - lx(q.z - 1)) * 30) / 2; q.vz = 30; q.vy = 0; q.speed = 30; q.grounded = true; q.heading = Math.atan2(q.vx, q.vz); q.velHeading = q.heading; q.invuln = 10;
      }
      requestAnimationFrame(pin);
    };
    pin();
    window.__gs.run.sim.s.z = from;
  }, [c.from, c.lateral ?? null]);
  const reach = (z) => page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 40000, polling: 32 }).catch(() => {});
  await reach(4470);
  await page.evaluate(() => { window.__pinOn = false; });
  const probe = () => page.evaluate(() => {
    const w = window.__gs.world;
    const cam = w.cam.camera;
    const out = { phase: window.__gs.phase, cam: cam.position.toArray().map((v) => Math.round(v * 10) / 10) };
    const s = window.__gs.run ? window.__gs.run.sim.s : null;
    if (s) out.rider = [Math.round(s.x), Math.round(s.y), Math.round(s.z)];
    const V = cam.position.constructor;
    const ndc = (o) => { const v = new V(); o.getWorldPosition(v); const d = v.distanceTo(cam.position); v.project(cam); return { ndc: [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 1000) / 1000], d: Math.round(d) }; };
    const g = w.lantern && w.lantern.greatPaper;
    if (g) out.great = ndc(g);
    out.rowN = w.row ? w.row.root.children.length : -1;
    // Candidate places for a light over the square, by metres past the line (dz), across from the course's middle
    // toward the rider's side (dx, times the side the rider is on) and up (12 m): where each falls on screen.
    if (s) {
      const cc = window.__gs.run.sim.course;
      const side = s.x > cc.centerX(s.z) ? 1 : -1;
      out.side = side;
      out.grid = [];
      for (const dz of [-28, 0, 20, 35, 50]) for (const dx of [-24, -12, 0, 12, 24]) {
        const z = cc.finishZ + dz;
        const x = cc.centerX(z) + dx * side;
        const v = new V(x, cc.ground(x, z) + 12.6, -z);
        const d = v.distanceTo(cam.position);
        v.project(cam);
        if (v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2) out.grid.push([dz, dx, Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(d)]);
      }
    }
    return out;
  });
  const shots = [];
  await page.waitForTimeout(1500); shots.push(await probe());
  await page.waitForTimeout(3500); shots.push(await probe());
  if (c.out) await page.screenshot({ path: c.out + 'probe-stop.png' });
  await page.waitForTimeout(5000); shots.push(await probe());
  if (c.out) await page.screenshot({ path: c.out + 'probe-results.png' });
  await page.goto('about:blank');
  return JSON.stringify(shots);
}
