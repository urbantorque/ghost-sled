// The living background: rides a mountain on the safe line at a set speed and shoots bursts of frames
// at set distances (the crowds turning and reacting, animals bolting, birds lifting off), optionally
// a clipped close-up of one part of the frame. Settles per jump so the idle builds are done.
//   playwright-cli -s=life eval "window.__lifeCfg = { base: 'http://127.0.0.1:4401/', out: 'shots/r5/life/', tier: 'high', jobs: [{ m: 0, mood: 0, at: [40, 600], burst: 3, gap: 250 }] }"
//   playwright-cli -s=life run-code --filename=scripts/playtest/life.js
// A job may set `clip: [x, y, w, h]` (CSS px), `speed`, `off` (metres off the safe line), `tier`, `stomp`
// (a list of distances to fire a stomp beat at, to see the crowd cheer and the birds scatter) and `url`
// (extra query, e.g. '&reduced=1'), `vp` ([w, h], a bigger viewport for a close look), `cam` (a fixed lens,
// below) and `lead` (metres before each distance it jumps to; 60).
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4401/', out: 'shots/r5/life/', tier: 'high', speed: 30, tag: '', jobs: [] }, (await page.evaluate(() => window.__lifeCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const report = [];
  for (const job of c.jobs) {
    const tier = job.tier || c.tier;
    await page.setViewportSize({ width: (job.vp || [1280, 720])[0], height: (job.vp || [1280, 720])[1] });
    await page.goto(c.base + `?debug&tier=${tier}&autoride=1&m=${job.m}&mood=${job.mood || 0}${job.url || ''}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.evaluate(([speed, off]) => {
      window.__pinSpeed = speed;
      window.__pinOff = off;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed >= 0) {
          const q = rr.sim.s;
          const cc = rr.sim.course;
          const v = window.__pinSpeed;
          q.x = cc.safeX(q.z) + (window.__pinOff || 0);
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
    }, [job.speed ?? c.speed, job.off ?? 0]);
    // A fixed lens for a close look: `cam` is [ox, oy, oz, tx, ty, tz], the lens and its target as offsets
    // from the rider in world space, put on the camera before every render the game makes.
    await page.evaluate((cam) => {
      window.__camOverride = cam || null;
      const w = window.__gs.world;
      if (w.__camHooked) return;
      w.__camHooked = true;
      const r = w.renderer;
      const orig = r.render.bind(r);
      r.render = (scene, camera) => {
        const o = window.__camOverride;
        const run = window.__gs.run;
        if (o && run && camera && camera.isPerspectiveCamera) {
          const s = run.sim.s;
          camera.position.set(s.x + o[0], s.y + o[1], -s.z + o[2]);
          camera.lookAt(s.x + o[3], s.y + o[4], -s.z + o[5]);
          camera.updateMatrixWorld();
        }
        orig(scene, camera);
      };
    }, job.cam);
    const list = job.at.slice().sort((a, b) => a - b);
    let last = -1e9;
    for (const z of list) {
      if (z - last > 160) {
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - (job.lead ?? 60));
        await page.waitForFunction(() => window.__gs.run.sim.s.z > 0 && window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - (job.lead ?? 60));
      }
      await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
      if (job.stomp && job.stomp.includes(z)) {
        await page.evaluate(() => {
          // (Straight into the two systems that hear a stomp: the crowd's cheer and the life's startle.)
          const w = window.__gs.world;
          const s = window.__gs.run.sim.s;
          const sp = w.setPieces;
          sp.cheer({ type: 'stomp' }, sp.uniforms.uRider.value, sp.lastT);
          w.life.startle(s.x, s.z, sp.lastT);
        });
      }
      const n = job.burst || 1;
      for (let k = 0; k < n; k++) {
        const name = `${c.tag}m${job.m}-${tier}-z${String(z).padStart(4, '0')}${n > 1 ? '-' + k : ''}.png`;
        await page.screenshot({ path: c.out + name, ...(job.clip ? { clip: { x: job.clip[0], y: job.clip[1], width: job.clip[2], height: job.clip[3] } } : {}) });
        report.push(name);
        if (k + 1 < n) await page.waitForTimeout(job.gap || 250);
      }
      last = z;
    }
    const st = await page.evaluate(() => {
      const w = window.__gs.world;
      const info = w.renderer?.info?.render;
      return { crowd: w.setPieces.crowd.count, calls: info?.calls, tris: info?.triangles, fps: window.__gs.frameStats ? window.__gs.frameStats().fps : null };
    });
    report.push({ m: job.m, tier, st });
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
