// A whole descent on the safe line at 30 m/s without a teleport: whether pieces are made ahead of the
// rider on idle time (madeNow stays 0), the longest idle job, the long frames, and a shot as the finish
// town comes into view.
//   playwright-cli -s=lane-places eval "window.__descentCfg = { base: 'http://127.0.0.1:4371/', tier: 'high', m: 0 }"
//   playwright-cli -s=lane-places run-code --filename=scripts/playtest/descent.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4371/', tier: 'high', m: 0, mood: 0, out: 'shots/descent/' }, (await page.evaluate(() => window.__descentCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(c.base + `?platform=mock&debug&fps&autoride=1&tier=${c.tier}&m=${c.m}&mood=${c.mood}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__long = 0;
    let t0 = performance.now();
    const pin = () => {
      const t = performance.now();
      if (t - t0 > 50) window.__long++;
      t0 = t;
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed && !rr.sim.s.finished) {
        const q = rr.sim.s;
        const cc = rr.sim.course;
        q.x = cc.safeX(q.z);
        q.y = cc.ground(q.x, q.z);
        q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * 30) / 2;
        q.vz = 30;
        q.vy = 0;
        q.speed = 30;
        q.grounded = true;
        q.heading = Math.atan2(q.vx, q.vz);
        q.velHeading = q.heading;
        q.invuln = 10;
      }
      requestAnimationFrame(pin);
    };
    pin();
  });
  const lip = await page.evaluate(() => { const l = window.__gs.run.sim.course.leaps; return l[l.length - 1].z; });
  for (const [name, z] of [['lip', lip - 8], ['air', lip + 60], ['stretch', 4100], ['town', 4230]]) {
    await page.waitForFunction((d) => window.__gs.run && window.__gs.run.sim.s.z >= d, z, { timeout: 200000, polling: 40 }).catch(() => {});
    await page.screenshot({ path: `${c.out}m${c.m}-${name}.png` });
  }
  await page.waitForFunction(() => window.__gs.run.sim.s.z >= 4500, null, { timeout: 60000, polling: 100 }).catch(() => {});
  const r = await page.evaluate(() => { const sp = window.__gs.world.setPieces; return { z: Math.round(window.__gs.run.sim.s.z), stats: sp.stats, plan: sp.plan.stats, long: window.__long, built: sp.built.size }; });
  await page.goto('about:blank');
  return JSON.stringify({ r, errors });
}
