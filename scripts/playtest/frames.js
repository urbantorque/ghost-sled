// Round 7's fixed frame set (the visual review loop): for each mountain, the same distances on any build
// and any tier, so a before and an after sit side by side. The list is every 150 m of the descent, each set
// piece's approach and middle, each leap's lip (the hero vistas), and the way into every street, bridge,
// tunnel, lake, ravine, terrace and finish. It rides the safe line at a pinned speed (as places.js), and
// returns the lists it used (kept in scripts/playtest/frames-r7.json). Pass `at` to shoot a given list instead.
//   playwright-cli -s=fr open --config=.playwright/cli-headless.config.json
//   playwright-cli -s=fr eval "window.__framesCfg = { base: 'http://127.0.0.1:4310/', out: 'shots/r7/before/high/', tier: 'high', ms: [0,1,2,3] }"
//   playwright-cli -s=fr run-code --filename=scripts/playtest/frames.js
async (page) => {
  const c = Object.assign({ base: 'http://127.0.0.1:4310/', out: 'shots/r7/x/', tier: 'high', speed: 30, ms: [0, 1, 2, 3], mood: 0, at: null, hud: true, every: 150, extra: '' }, (await page.evaluate(() => window.__framesCfg).catch(() => null)) || {});
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text().slice(0, 300)); });
  const lists = {};
  const report = [];
  for (const m of c.ms) {
    await page.goto(c.base + `?platform=mock&debug&tier=${c.tier}&autoride=1&m=${m}&mood=${c.mood}${c.extra}`, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__gs && window.__gs.phase === 'run' && window.__gs.run, null, { timeout: 180000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.evaluate((speed) => {
      window.__pinSpeed = speed;
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
        }
        requestAnimationFrame(pin);
      };
      pin();
      // Frame cost, summed over every pass of a frame.
      const r = window.__gs.world && window.__gs.world.renderer;
      if (r && r.info) {
        r.info.autoReset = false;
        const tick = () => { window.__frameInfo = { calls: r.info.render.calls, tris: r.info.render.triangles }; r.info.reset(); requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }
    }, c.speed);
    let list = c.at && c.at[m];
    if (!list) {
      list = await page.evaluate((every) => {
        const cc = window.__gs.run.sim.course;
        const fin = cc.finishZ;
        const out = [];
        const add = (z, why) => { z = Math.round(z); if (z > 60 && z < fin + 180) out.push({ z, why }); };
        for (let z = every; z < fin; z += every) add(z, 'even');
        add(fin - 60, 'finish-in');
        add(fin + 90, 'finish-square');
        const plays = window.__gs.run.sim.plays || [];
        for (const p of plays) { add(p.z0 - 40, 'sp-in:' + p.key); add((p.z0 + p.z1) / 2, 'sp-mid:' + p.key); }
        for (const l of cc.leaps) add(l.z - 40, 'lip');
        let last = null;
        for (let z = 0; z < fin; z += 10) {
          const s = cc.section(z);
          if (s !== last) {
            last = s;
            if (['street', 'bridge', 'tunnel', 'lake', 'ravine', 'terraces', 'finish', 'fork'].includes(s.kind)) { add(s.z0 + s.blend + 30, s.kind); add((s.z0 + s.z1) / 2, s.kind + '-mid'); }
          }
        }
        out.sort((a, b) => a.z - b.z);
        // Named frames win over the even grid when they sit within 45 m of each other.
        const kept = [];
        for (const f of out) {
          const near = kept.findIndex((k) => Math.abs(k.z - f.z) < 45);
          if (near < 0) kept.push(f);
          else if (kept[near].why === 'even' && f.why !== 'even') kept[near] = f;
        }
        return kept;
      }, c.every);
    }
    lists[m] = list;
    if (!c.hud) await page.addStyleTag({ content: '#ui, .gs-hud, [class*="hud"] { visibility: hidden !important; }' });
    let last = -1e9;
    for (const f of list) {
      const z = f.z;
      if (z - last > 160) {
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 70);
        await page.waitForFunction(() => window.__gs.run.sim.s.z > 0 && window.__gs.world.setPieces.queue.length === 0, null, { timeout: 5000, polling: 50 }).catch(() => {});
        await page.evaluate((zz) => { window.__gs.run.sim.s.z = zz; }, z - 70);
      }
      await page.waitForFunction((d) => { const r = window.__gs.run; return !r || r.sim.s.z >= d; }, z, { timeout: 30000, polling: 16 }).catch(() => {});
      const name = `m${m}-z${String(z).padStart(4, '0')}.png`;
      await page.screenshot({ path: c.out + name });
      const st = await page.evaluate(() => ({ info: window.__frameInfo || null, fps: window.__gs.frameStats ? window.__gs.frameStats() : null }));
      report.push({ name, why: f.why, calls: st.info && st.info.calls, tris: st.info && st.info.tris, fps: st.fps && st.fps.fps });
      last = z;
    }
  }
  await page.goto('about:blank');
  return JSON.stringify({ lists, report, errors });
}
