// Round 8, the light lane: the GPU's pass times (`?gpu`, pipeline.ts timer, 30-frame means) over a stretch of a
// mountain, ridden on the safe line at a pinned 30 m/s from `from`, sampled every second. Same-run figures, so
// two builds compare (never frames a second).
//   playwright-cli -s=x eval "window.__gpCfg = { base, m: 4, tier: 'high', from: 1900, seconds: 10 }" ; run-code --filename=scripts/playtest/gpuprobe.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4760/', m: 4, tier: 'high', from: 1900, seconds: 10 }, (await page.evaluate(() => window.__gpCfg).catch(() => null)) || {});
  await page.goto(c.base + `?debug&gpu&platform=mock&tier=${c.tier}&autoride=1&m=${c.m}`, { timeout: 120000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.evaluate((from) => {
    const pin = () => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed) {
        const q = rr.sim.s, cc = rr.sim.course;
        q.x = cc.safeX(q.z); q.y = cc.ground(q.x, q.z); q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * 30) / 2; q.vz = 30; q.vy = 0; q.speed = 30; q.grounded = true; q.heading = Math.atan2(q.vx, q.vz); q.velHeading = q.heading; q.invuln = 10;
      }
      requestAnimationFrame(pin);
    };
    pin();
    window.__gs.run.sim.s.z = from;
  }, c.from);
  await page.waitForTimeout(2500);
  const samples = [];
  for (let i = 0; i < c.seconds; i++) {
    await page.waitForTimeout(1000);
    samples.push(await page.evaluate(() => ({ z: Math.round(window.__gs.run?.sim.s.z ?? -1), ms: { ...window.__gs.world.post.pipe.timer.ms } })));
  }
  const keys = [...new Set(samples.flatMap((s) => Object.keys(s.ms)))];
  const mean = Object.fromEntries(keys.map((k) => [k, +(samples.reduce((a, s) => a + (s.ms[k] ?? 0), 0) / samples.length).toFixed(3)]));
  await page.goto('about:blank');
  return JSON.stringify({ m: c.m, from: c.from, z: [samples[0]?.z, samples[samples.length - 1]?.z], mean });
}
