// A frame sweep: pins the rider to the safe line at a set speed and shoots every `step` metres, from the
// chase lens and optionally turned to one side, to hunt for a defect at a place rather than a moment.
//   playwright-cli -s=sw eval "window.__sweepCfg = { base: 'http://127.0.0.1:4310/', out: 'shots/r3/sweep/', m: 0, mood: 0, from: 80, to: 900, step: 40, tier: 'high' }"
//   playwright-cli -s=sw run-code --filename=scripts/playtest/sweep.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4173/', out: 'shots/r3/sweep/', m: 0, mood: 0, from: 80, to: 900, step: 40, tier: 'high', speed: 26 }, (await page.evaluate(() => window.__sweepCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(c.base + `?debug&tier=${c.tier}&autoride=1&m=${c.m}&mood=${c.mood}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(({ z, speed }) => {
    const r = window.__gs.run;
    r.sim.s.z = z;
    const pin = () => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed) {
        const q = rr.sim.s;
        const cc = rr.sim.course;
        q.x = cc.safeX(q.z);
        q.y = cc.ground(q.x, q.z);
        q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * speed) / 2;
        q.vz = speed;
        q.vy = 0;
        q.speed = speed;
        q.grounded = true;
        q.heading = Math.atan2(q.vx, q.vz);
        q.velHeading = q.heading;
        q.invuln = 10;
      }
      requestAnimationFrame(pin);
    };
    pin();
  }, { z: c.from, speed: c.speed });
  await page.waitForTimeout(1500);
  const shots = [];
  for (let z = c.from; z <= c.to; z += c.step) {
    const ok = await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).then(() => true, () => false);
    if (!ok) break;
    const name = `m${c.m}-z${String(z).padStart(4, '0')}.png`;
    await page.screenshot({ path: c.out + name });
    shots.push(name);
  }
  await page.goto('about:blank');
  return JSON.stringify({ shots, errors });
}
