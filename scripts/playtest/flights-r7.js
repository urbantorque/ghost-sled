// Round 7's review loop: stills through the flight off each leap of a mountain in the frames' own mood
// (Clear Skies; a pool rider with demo=N rides its own chaos mood instead). The sled is pinned to the safe
// line at speed until just short of the lip, then let go and the sim flies it. `per` stills `every` ms
// apart off each leap; `only` picks leaps by index.
//   playwright-cli -s=fl open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=fl eval "window.__flCfg = { base: 'http://127.0.0.1:4310/', out: 'shots/r7/x/motion', tier: 'high', m: 2 }"
//   playwright-cli -s=fl run-code --filename=scripts/playtest/flights-r7.js
async (page) => {
  const c = Object.assign({ base: '', out: '', tier: 'high', m: 2, v: 47, every: 500, per: 6, only: null, lead: 14 }, (await page.evaluate(() => window.__flCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  for (let a = 0; a < 3; a++) { try { await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${c.m}&mood=0`, { timeout: 90000 }); break; } catch (e) { if (a === 2) throw e; } }
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.evaluate((speed) => {
    window.__pinSpeed = speed;
    const pin = () => {
      const rr = window.__gs.run;
      if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
        const q = rr.sim.s, cc = rr.sim.course, v = window.__pinSpeed;
        q.x = cc.safeX(q.z); q.y = cc.ground(q.x, q.z);
        q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * v) / 2; q.vz = v; q.vy = 0; q.speed = v; q.grounded = true;
        q.heading = Math.atan2(q.vx, q.vz); q.velHeading = q.heading; q.invuln = 10;
      }
      requestAnimationFrame(pin);
    };
    pin();
    const r = window.__gs.world && window.__gs.world.renderer;
    if (r && r.info) {
      r.info.autoReset = false;
      const tick = () => { window.__frameInfo = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.reset(); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
  }, c.v);
  const lips = await page.evaluate(() => window.__gs.run.sim.course.leaps.map((l) => l.z));
  const log = [];
  for (let i = 0; i < lips.length; i++) {
    if (c.only && !c.only.includes(i)) continue;
    const lip = lips[i];
    await page.evaluate((v) => { window.__pinSpeed = v; }, c.v);
    await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, lip - 230);
    await page.waitForFunction(() => window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
    await page.waitForFunction((d) => window.__gs.run.sim.s.z >= d, lip - c.lead, { timeout: 30000, polling: 8 }).catch(() => {});
    await page.evaluate(() => { window.__pinSpeed = 0; });
    for (let k = 1; k <= c.per; k++) {
      await page.waitForTimeout(c.every);
      await page.screenshot({ path: `${c.out}/fly${i}-${k}.png` });
      log.push(await page.evaluate(() => { const q = window.__gs.run.sim.s; return { leap: 0, z: Math.round(q.z), y: Math.round(q.y), g: q.grounded, sp: Math.round(q.speed), ...(window.__frameInfo || {}) }; }));
      log[log.length - 1].leap = i;
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ lips, log, errors });
}
