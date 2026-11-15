// Lanternfall's review frames that the fixed set cannot take (round 7's review loop, the m4 lane): a pool
// rider's own run (`demo=N`), shot as short strips at the hero vistas and through each set piece, so the
// states the beats drive are in a frame (lamps catching, the flame carried and guttering, the great lantern
// lighting), then a pinned pass that forces the gutter, then the title.
//   playwright-cli -s=r7-review-m4 open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=r7-review-m4 eval "window.__rvCfg = { base: 'http://127.0.0.1:4534/', out: 'C:/.../pass1/high-motion/', tier: 'high' }"
//   playwright-cli -s=r7-review-m4 run-code --filename=scripts/playtest/review-m4.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4534/', out: 'shots/r7/x/', tier: 'high', demo: 2, title: true, extra: '' }, (await page.evaluate(() => window.__rvCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const log = [];
  const state = () => page.evaluate(() => {
    const g = window.__gs;
    if (!g || !g.run) return { phase: g && g.phase };
    const sim = g.run.sim;
    const mo = sim.mo;
    const r = g.world.renderer;
    return { phase: g.phase, z: Math.round(sim.s.z), speed: Math.round(sim.s.speed), air: !sim.s.grounded, active: mo.active, mask: mo.mask, pace: +(+mo.pace).toFixed(2), at: mo.at, ahead: mo.ahead, calls: r.info.render.calls, tris: r.info.render.triangles };
  });
  const shoot = async (name) => {
    await page.screenshot({ path: c.out + name + '.png' });
    log.push({ name, ...(await state()) });
  };
  const waitZ = (z) => page.waitForFunction((d) => { const g = window.__gs; return !g.run || g.phase !== 'run' || g.run.sim.s.z >= d; }, z, { timeout: 180000, polling: 16 }).catch(() => {});
  const strip = async (tag, z, n, gap) => {
    await waitZ(z);
    for (let i = 0; i < n; i++) {
      await shoot(`${tag}-${i}`);
      if (i < n - 1) await page.waitForTimeout(gap);
    }
  };

  // ---- a pool rider's own run
  await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=4&demo=${c.demo}${c.extra}`);
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    const sim = window.__gs.run.sim;
    const cc = sim.course;
    return { fin: cc.finishZ, leaps: cc.leaps.map((l) => l.z), plays: (sim.plays || []).map((p) => ({ verb: p.verb, key: p.key, z0: p.z0, z1: p.z1 })), cloud: cc.cloud && { z0: cc.cloud.z0, z1: cc.cloud.z1 } };
  });
  log.push({ info });
  const play = (v) => info.plays.find((p) => p.verb === v);
  // (A screenshot takes over a second here and the rider covers fifty metres in it, so a strip is a list of
  // places, not of times.)
  const at = async (tag, zs) => { for (let i = 0; i < zs.length; i++) { await waitZ(zs[i]); await shoot(`${tag}-${i}`); } };
  const L = info.leaps;
  const ki = play('kindle');
  const ca = play('carry');
  // (`run: false` skips the pool rider's run and shoots only the pinned pass and the title.)
  if (c.run !== false) {
    await at('a-crown', [240, 420]);
    await at('b-lip1', [L[0] - 45, L[0] + 25, L[0] + 90]);
    const fo = play('follow');
    if (fo) await at('c-follow', [fo.z0 + 120, fo.z0 + 300, fo.z1 - 90]);
    await at('d-break', [L[1] - 75, L[1] - 20, L[1] + 40, L[1] + 100, L[1] + 160, L[1] + 240]);
    if (ki) await at('e-kindle', [ki.z0 + 10, ki.z0 + 70, ki.z0 + 130, ki.z0 + 190, ki.z1 + 15, ki.z1 + 80]);
    await at('f-road', [2620, 2800, 3050]);
    if (ca) await at('g-carry', [ca.z0 + 60, ca.z0 + 150, ca.z0 + 260]);
    await at('h-lip3', [L[2] - 30, L[2] + 30, L[2] + 95, L[2] + 180]);
    await at('i-finish', [info.fin - 150, info.fin - 60, info.fin + 2]);
    for (let i = 3; i < 6; i++) { await page.waitForTimeout(350); await shoot('i-finish-' + i); }
    await page.waitForTimeout(2500);
    await shoot('i-finish-results');
    // The scene behind the results card.
    await page.addStyleTag({ content: '#ui > *, .gs-results, [class*="results"] { opacity: 0 !important; }' });
    await page.waitForTimeout(300);
    await shoot('i-finish-lantern');
  }

  // ---- the gutter, forced: a pinned sled inside the carry, the simfix lane's state held up by hand
  await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=4${c.extra}`, { timeout: 90000 });
  await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  {
    await page.evaluate((z) => {
      window.__pinSpeed = 30;
      window.__gut = 0;
      window.__kin = -1;
      window.__gs.run.sim.s.z = z;
      const pin = () => {
        const rr = window.__gs.run;
        if (rr && !rr.sim.s.crashed && window.__pinSpeed > 0) {
          const q = rr.sim.s;
          const cc = rr.sim.course;
          const v = window.__pinSpeed;
          q.x = cc.safeX(q.z);
          q.y = cc.ground(q.x, q.z);
          q.vx = ((cc.safeX(q.z + 1) - cc.safeX(q.z - 1)) * v) / 2;
          q.vz = v;
          q.vy = 0;
          q.speed = v;
          q.grounded = true;
          q.heading = Math.atan2(q.vx, q.vz);
          q.velHeading = q.heading;
          q.invuln = 10;
          if (window.__gut) rr.sim.mo.at = 90;
          // (The kindle, lit by hand: each dark lamp catches as the sled comes level with it.)
          if (window.__kin >= 0) {
            const pl = rr.sim.plays[window.__kin];
            if (pl && rr.sim.mo.active === pl.index) (pl.lamps || []).forEach((l, i) => { if (l.z < q.z + 4) rr.sim.mo.mask |= 1 << i; });
          }
        }
        requestAnimationFrame(pin);
      };
      pin();
    }, ki ? ki.z0 - 80 : 3500);
    if (ki) {
      await page.evaluate((k) => { window.__kin = k; }, info.plays.indexOf(ki));
      await at('j-kindle', [ki.z0 + 45, ki.z0 + 100, ki.z0 + 150, ki.z1 - 15]);
      await page.evaluate(() => { window.__kin = -1; });
    }
  }
  if (ca) {
    await page.evaluate((z) => { window.__gs.run.sim.s.z = z; }, ca.z0 - 80);
    await strip('j-flame', ca.z0 + 90, 2, 500);
    await page.evaluate(() => { window.__gut = 1; });
    await page.waitForTimeout(500);
    await strip('j-gutter', 0, 3, 350);
    await page.evaluate(() => { window.__gut = 0; });
  }

  // ---- the title
  if (c.title) {
    await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&m=4${c.extra}`, { timeout: 90000 });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'title', null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await shoot('k-title-0');
    await page.waitForTimeout(4000);
    await shoot('k-title-1');
  }
  await page.goto('about:blank');
  return JSON.stringify({ log, errors });
}
