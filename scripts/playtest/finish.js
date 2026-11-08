// The end of a run: rides the safe line from `from` at 30 m/s, lets go before the line, crosses it for
// real and shoots the coast, the stop and the results.
//   playwright-cli -s=lane-places eval "window.__finishCfg = { base: 'http://127.0.0.1:4371/', out: 'shots/finish/', jobs: [{ m: 0, mood: 0 }] }"
//   playwright-cli -s=lane-places run-code --filename=scripts/playtest/finish.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4371/', out: 'shots/finish/', tier: 'high', from: 3850, jobs: [] }, (await page.evaluate(() => window.__finishCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const report = [];
  for (const job of c.jobs) {
    await page.goto(c.base + `?debug&tier=${c.tier}&autoride=1&m=${job.m}&mood=${job.mood}`);
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
    await page.waitForTimeout(1000);
    await page.evaluate((from) => {
      window.__pinOn = true;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinOn) {
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
      window.__gs.run.sim.s.z = from;
    }, c.from);
    const tag = `m${job.m}-mood${job.mood}`;
    const shoot = async (name) => {
      await page.screenshot({ path: c.out + `${tag}-${name}.png` }).catch(() => {});
    };
    const reach = (z) => page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 40000, polling: 32 }).catch(() => {});
    const lip = await page.evaluate(() => { const l = window.__gs.run.sim.course.leaps; return l[l.length - 1].z; });
    await reach(lip - 12);
    await shoot('a-last-lip');
    await reach(lip + 90);
    await shoot('b-past-lip');
    await reach(4300);
    await shoot('c-town');
    await reach(4470);
    await page.evaluate(() => { window.__pinOn = false; });
    await reach(4505);
    await shoot('d-over-line');
    await page.waitForTimeout(1500);
    await shoot('e-coast');
    await page.waitForTimeout(3500);
    const st = await page.evaluate(() => { const g = window.__gs; return { phase: g.phase, z: g.run ? Math.round(g.run.sim.s.z) : null, speed: g.run ? g.run.sim.s.speed : null }; });
    report.push(st);
    await shoot('f-stopped');
    await page.waitForTimeout(4000);
    await shoot('g-results');
    await page.waitForTimeout(4000);
    await shoot('h-results');
    report.push(await page.evaluate(() => ({ phase: window.__gs.phase })));
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors });
}
