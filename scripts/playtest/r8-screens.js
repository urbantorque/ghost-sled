// Round 8, the screens lane: the results and the title on a real save, as a player meets them. Rides each run on the
// safe line from `from` at 30 m/s (as finish.js), lets go before the line, crosses it for real and shoots the
// results as they build (`at`, ms after the card opens); then times Run Again to riding (Space pressed to the sim's
// first moving tick) and goes on to the next run; then the title on the same save.
//   playwright-cli -s=r8-screens eval "window.__scrCfg = { base: 'http://127.0.0.1:4800/', out: 'C:/.../shots/r8/screens/x/', runs: 2 }"
//   playwright-cli -s=r8-screens --raw run-code --filename=scripts/playtest/r8-screens.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4800/', out: 'shots/r8/screens/', tier: 'high', m: 0, from: 3900, runs: 2, at: [250, 1200, 2600, 4500, 7000], skip: false, title: true, tag: 'desk' }, (await page.evaluate(() => window.__scrCfg).catch(() => null)) || {});
  const errors = [];
  const warns = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 240)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text().slice(0, 240));
    else if (msg.type() === 'warning') warns.push(msg.text().slice(0, 240));
  });
  const report = { runs: [], title: null };
  const shoot = (name) => page.screenshot({ path: c.out + `${c.tag}-${name}.png` }).catch(() => {});
  const pinFrom = (from) =>
    page.evaluate((from) => {
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
        if (window.__pinOn) requestAnimationFrame(pin);
      };
      pin();
      window.__gs.run.sim.s.z = Math.max(window.__gs.run.sim.s.z, from);
    }, from);
  const reach = (z) => page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 60000, polling: 32 }).catch(() => {});
  await page.goto(c.base + `?debug&tier=${c.tier}&autoride=1&m=${c.m}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 90000 });
  for (let run = 1; run <= c.runs; run++) {
    await page.waitForTimeout(800);
    await pinFrom(c.from);
    const fz = await page.evaluate(() => window.__gs.run.sim.course.finishZ);
    await reach(fz - 40);
    await page.evaluate(() => { window.__pinOn = false; });
    await page.waitForFunction(() => window.__gs.phase === 'results', null, { timeout: 60000, polling: 50 }).catch(() => {});
    const t0 = Date.now();
    for (const ms of c.at) {
      const wait = t0 + ms - Date.now();
      if (wait > 0) await page.waitForTimeout(wait);
      await shoot(`r${run}-${String(ms).padStart(4, '0')}`);
    }
    const res = await page.evaluate(() => {
      const r = window.__gs.results;
      const s = r && r.spine;
      return { place: r && r.finish ? r.finish.seconds : null, label: r && r.runAgainLabel ? r.runAgainLabel.text : null, primary: s ? s.primary : null, opened: s ? s.opened.map((o) => o.name) : null, ticks: s ? s.ticks.length : null, page: s ? [s.before.page, s.after.page] : null };
    }).catch(() => null);
    if (c.skip) {
      // A tap skips the sequence to its end.
      await page.mouse.click(40, 40).catch(() => {});
      await page.waitForTimeout(250);
      await shoot(`r${run}-skipped`);
    }
    if (run === c.runs) {
      report.runs.push({ run, res });
      break;
    }
    // Run Again to riding: Space pressed to the sim's first moving tick.
    await page.waitForTimeout(400);
    const tPress = await page.evaluate(() => performance.now());
    await page.keyboard.press('Space');
    const times = await page.evaluate(async (tPress) => {
      const g = window.__gs;
      let runAt = null;
      let rideAt = null;
      const until = performance.now() + 15000;
      while (performance.now() < until) {
        await new Promise((r) => requestAnimationFrame(r));
        const now = performance.now();
        if (runAt === null && g.phase === 'run') runAt = now - tPress;
        if (runAt !== null && g.run && g.run.sim.tick > 1 && g.run.sim.s.speed > 1) {
          rideAt = now - tPress;
          break;
        }
      }
      return { runAt: runAt && Math.round(runAt), rideAt: rideAt && Math.round(rideAt) };
    }, tPress);
    report.runs.push({ run, res, again: times });
  }
  if (c.title) {
    await page.goto(c.base + `?debug&tier=${c.tier}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shoot('title-1500');
    await page.waitForTimeout(3500);
    await shoot('title-5000');
    report.title = await page.evaluate(() => ({ phase: window.__gs.phase })).catch(() => null);
  }
  await page.goto('about:blank');
  return JSON.stringify({ report, errors, warns: warns.slice(0, 20) });
}
